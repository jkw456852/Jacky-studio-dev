
import { GoogleGenAI, Chat, GenerateContentResponse, Part, Content, Type } from "@google/genai";
import { ProviderError } from '../utils/provider-error';
import { fetchWithResilience } from './http/api-client';
import { safeLocalStorageSetItem } from '../utils/safe-storage';
import { getApiKey, getApiKeyByProviderId, getProviderConfig, getProviderConfigById } from './provider-config';
import {
    normalizeReferenceToDataUrl,
    normalizeReferenceToModelInputDataUrl,
} from './image-reference-resolver';
import { parseMappedModelStorageEntry, resolveImageModelPostPath } from './provider-settings';
import { getStudioUserAssetApi } from './runtime-assets/api';

const isNetworkFetchError = (error: unknown): boolean => {
    const msg = ((error as any)?.message || '').toLowerCase();
    return msg.includes('failed to fetch') || msg.includes('network') || msg.includes('cors') || msg.includes('load failed');
};

export { getApiKey, getProviderConfig };

export type BestModelSelection = {
    modelId: string;
    providerId: string | null;
};

const requireApiKey = (stage: string, providerId?: string | null): string => {
    const provider = getProviderConfigById(providerId);
    const key = getApiKey(false, providerId);
    if (typeof key === 'string' && key.trim()) {
        return key;
    }

    throw new ProviderError({
        provider: provider.id || 'unknown',
        code: 'API_KEY_MISSING',
        retryable: false,
        stage: 'config',
        details: `missing_api_key:${stage}`,
        message: 'API 密钥未配置，请先在设置中填写并保存可用密钥。',
    });
};

/**
 * Normalize and clean Base URL
 */
const normalizeUrl = (baseUrl: string): string => {
    let url = (baseUrl || '').trim().replace(/\/+$/, '');
    if (!url) return 'https://generativelanguage.googleapis.com';
    return url;
};

const stableHashString = (input: string): string => {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
};

const buildImageRequestFingerprint = (parts: {
    model: string;
    route: string;
    size: string;
    aspectRatio?: string;
    prompt: string;
    providerId?: string | null;
    referenceImages?: string[];
    maskImage?: string | null;
}): {
    fingerprint: string;
    promptHash: string;
    referenceHash: string;
} => {
    const promptHash = stableHashString(parts.prompt || '');
    const normalizedRefs = (parts.referenceImages || []).map((item, index) => {
        const value = String(item || '');
        return `${index}:${estimateDataUrlBytes(value)}:${stableHashString(value)}`;
    });
    const referenceHash = stableHashString(normalizedRefs.join('|'));
    const maskHash = parts.maskImage
        ? `${estimateDataUrlBytes(parts.maskImage)}:${stableHashString(parts.maskImage)}`
        : 'none';
    const fingerprint = stableHashString(
        [
            parts.model,
            parts.route,
            parts.size,
            parts.aspectRatio || '',
            parts.providerId || '',
            promptHash,
            referenceHash,
            maskHash,
            String(normalizedRefs.length),
        ].join('||'),
    );

    return {
        fingerprint,
        promptHash,
        referenceHash,
    };
};

const shouldTryAlternateAuth = (status: number): boolean => {
    return status === 401 || status === 403 || status === 404;
};

const isRateLimited = (status: number): boolean => {
    return status === 429;
};

const isServerError = (status: number): boolean => {
    return status >= 500 && status < 600;
};

type OpenAIAuthMode = 'bearer' | 'query';
type OpenAIAuthStrategy = 'auto' | 'bearer-only' | 'query-only';

const OPENAI_QUERY_AUTH_BLOCKED_HOSTS = new Set<string>([
    'api3.wlai.vip',
    'api.xcode.best',
]);

const OPENAI_QUERY_AUTH_BLOCKED_HOST_PATH_PREFIXES: Record<string, string[]> = {
    'api.bltcy.ai': ['/v1/images/edits', '/v1/images/generations'],
};

const OPENAI_AUTH_MODE_CACHE_KEY = 'openai_auth_mode_cache_v1';
const openAIAuthModeMemoryCache = new Map<string, OpenAIAuthMode>();
const OPENAI_REQUEST_QUEUE_NEXT_AT_PREFIX = 'openai_request_queue_next_at_v1::';

const readOpenAIAuthModeCache = (): Record<string, OpenAIAuthMode> => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(OPENAI_AUTH_MODE_CACHE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const normalized: Record<string, OpenAIAuthMode> = {};
        Object.entries(parsed || {}).forEach(([key, value]) => {
            if (value === 'bearer' || value === 'query') {
                normalized[key] = value;
            }
        });
        return normalized;
    } catch {
        return {};
    }
};

const writeOpenAIAuthModeCache = (cache: Record<string, OpenAIAuthMode>): void => {
    if (typeof window === 'undefined') return;
    safeLocalStorageSetItem(OPENAI_AUTH_MODE_CACHE_KEY, JSON.stringify(cache));
};

const getOpenAIAuthCacheEntryKey = (baseUrl: string, path: string): string => {
    const root = normalizeUrl(baseUrl || '').toLowerCase();
    const normalizedPath = String(path || '').trim() || '/v1/chat/completions';
    return `${root}::${normalizedPath}`;
};

const getCachedOpenAIAuthMode = (cacheKey: string): OpenAIAuthMode | undefined => {
    const memoryHit = openAIAuthModeMemoryCache.get(cacheKey);
    if (memoryHit) return memoryHit;

    const persisted = readOpenAIAuthModeCache()[cacheKey];
    if (persisted) {
        openAIAuthModeMemoryCache.set(cacheKey, persisted);
        return persisted;
    }

    return undefined;
};

const setCachedOpenAIAuthMode = (cacheKey: string, mode: OpenAIAuthMode): void => {
    openAIAuthModeMemoryCache.set(cacheKey, mode);
    const persisted = readOpenAIAuthModeCache();
    persisted[cacheKey] = mode;
    writeOpenAIAuthModeCache(persisted);
};

const clearCachedOpenAIAuthMode = (cacheKey: string): void => {
    openAIAuthModeMemoryCache.delete(cacheKey);
    const persisted = readOpenAIAuthModeCache();
    if (persisted[cacheKey]) {
        delete persisted[cacheKey];
        writeOpenAIAuthModeCache(persisted);
    }
};

const buildOpenAIPath = (baseUrl: string, path: string): string => {
    const root = normalizeUrl(baseUrl);
    return path.startsWith('/') ? `${root}${path}` : `${root}/${path}`;
};

const shouldAllowQueryAuthFallback = (baseUrl: string, path: string): boolean => {
    const normalizedPath = String(path || '').trim() || '/v1/chat/completions';

    try {
        const host = new URL(normalizeUrl(baseUrl || '')).host.toLowerCase();
        const blockedPrefixes = OPENAI_QUERY_AUTH_BLOCKED_HOST_PATH_PREFIXES[host] || [];
        if (blockedPrefixes.some((prefix) => normalizedPath.startsWith(prefix))) {
            return false;
        }

        if (normalizedPath !== '/v1/chat/completions') {
            return true;
        }

        if (OPENAI_QUERY_AUTH_BLOCKED_HOSTS.has(host)) {
            return false;
        }
    } catch {
        if (normalizedPath !== '/v1/chat/completions') {
            return true;
        }
        // ignore URL parse errors and keep fallback enabled
    }

    return true;
};

const resolveOpenAIAuthPlans = (
    cachedMode: OpenAIAuthMode | undefined,
    authStrategy: OpenAIAuthStrategy,
    allowQueryFallback: boolean,
): OpenAIAuthMode[] => {
    if (authStrategy === 'bearer-only') return ['bearer'];
    if (authStrategy === 'query-only') return ['query'];

    if (!allowQueryFallback) {
        return ['bearer'];
    }

    if (cachedMode === 'bearer' || cachedMode === 'query') {
        const alternateMode: OpenAIAuthMode =
            cachedMode === 'bearer' ? 'query' : 'bearer';
        return [cachedMode, alternateMode];
    }

    return ['bearer', 'query'];
};

const normalizeApiKeyCandidates = (
    apiKeyOrKeys: string | string[],
): string[] => {
    const rawKeys = Array.isArray(apiKeyOrKeys)
        ? apiKeyOrKeys
        : String(apiKeyOrKeys || '').split('\n');
    return Array.from(
        new Set(
            rawKeys
                .map((key) => String(key || '').trim())
                .filter((key) => key.length > 0 && !key.startsWith('#')),
        ),
    );
};

const isVerboseOpenAIOperation = (operation: string): boolean => {
    return operation === 'ecomAnalyzeProductSkill'
        || operation.startsWith('ecomAnalyzeProductSkill.')
        || operation === 'ecomReviewGeneratedResultSkill'
        || operation.startsWith('ecomReviewGeneratedResultSkill.');
};

const summarizeOpenAIMessageContentForLog = (content: unknown): Record<string, unknown> => {
    const items = Array.isArray(content) ? content : [];
    let textPartCount = 0;
    let imagePartCount = 0;
    let totalTextLength = 0;

    items.forEach((item) => {
        const record = item as Record<string, unknown>;
        if (record?.type === 'text') {
            textPartCount += 1;
            totalTextLength += String(record?.text || '').length;
        }
        if (record?.type === 'image_url') {
            imagePartCount += 1;
        }
    });

    return {
        itemCount: items.length,
        textPartCount,
        imagePartCount,
        totalTextLength,
    };
};

const summarizeOpenAIJsonPayloadForLog = (payload: any): Record<string, unknown> => {
    const firstChoice = payload?.choices?.[0];
    const message = firstChoice?.message;
    const contentText = typeof message?.content === 'string'
        ? message.content
        : Array.isArray(message?.content)
            ? message.content
                .map((entry: any) => (typeof entry?.text === 'string' ? entry.text : ''))
                .join('')
            : '';
    const usage = payload?.usage || {};
    const completionDetails = usage?.completion_tokens_details || {};
    const promptDetails = usage?.prompt_tokens_details || {};

    return {
        id: payload?.id || null,
        model: payload?.model || null,
        finishReason: firstChoice?.finish_reason || null,
        choiceCount: Array.isArray(payload?.choices) ? payload.choices.length : 0,
        contentLength: contentText.length,
        hasReasoningField: Boolean(message?.reasoning || message?.reasoning_content),
        reasoningTokens: completionDetails?.reasoning_tokens ?? null,
        promptTokens: usage?.prompt_tokens ?? null,
        completionTokens: usage?.completion_tokens ?? null,
        totalTokens: usage?.total_tokens ?? null,
        cachedPromptTokens: promptDetails?.cached_tokens ?? null,
    };
};

const summarizeBaseUrlForLog = (baseUrl: string): string => {
    try {
        const url = new URL(baseUrl);
        return `${url.origin}${url.pathname}`;
    } catch {
        return baseUrl;
    }
};

const getSharedOpenAIQueueNextAt = (queueKey: string): number => {
    if (typeof window === 'undefined') return 0;
    try {
        const raw = window.localStorage.getItem(
            `${OPENAI_REQUEST_QUEUE_NEXT_AT_PREFIX}${queueKey}`,
        );
        const parsed = Number.parseInt(String(raw || '0'), 10);
        return Number.isFinite(parsed) ? parsed : 0;
    } catch {
        return 0;
    }
};

const setSharedOpenAIQueueNextAt = (queueKey: string, nextAt: number): void => {
    if (typeof window === 'undefined') return;
    safeLocalStorageSetItem(
        `${OPENAI_REQUEST_QUEUE_NEXT_AT_PREFIX}${queueKey}`,
        String(Math.max(0, Math.floor(nextAt))),
    );
};

const buildOpenAIHeaders = (authMode: OpenAIAuthMode, apiKey: string): Record<string, string> => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    if (authMode === 'bearer') {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }
    return headers;
};

const buildOpenAIFormHeaders = (authMode: OpenAIAuthMode, apiKey: string): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (authMode === 'bearer') {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }
    return headers;
};

const buildOpenAIUrl = (baseUrl: string, path: string, authMode: OpenAIAuthMode, apiKey: string): string => {
    const base = buildOpenAIPath(baseUrl, path);
    if (authMode === 'query') {
        return `${base}${base.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}`;
    }
    return base;
};

type UnifiedJsonStreamCallbacks = {
    onTextDelta?: (delta: string) => void;
    onReasoningDelta?: (delta: string) => void;
};

const normalizeOpenAITextValue = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
        return value.map((item) => normalizeOpenAITextValue(item)).join('');
    }
    if (value && typeof value === 'object') {
        const candidate = value as Record<string, unknown>;
        if (typeof candidate.text === 'string') return candidate.text;
        if (typeof candidate.content === 'string') return candidate.content;
        if (candidate.content !== undefined) {
            return normalizeOpenAITextValue(candidate.content);
        }
    }
    return '';
};

const parseOpenAIStreamingPayload = async <T>(
    response: Response,
    callbacks?: UnifiedJsonStreamCallbacks,
): Promise<T> => {
    if (!response.body) {
        return response.json() as Promise<T>;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let rawResponseText = '';
    let accumulatedContent = '';
    let accumulatedReasoning = '';
    let lastPayload: any = null;
    let lastUsage: any = null;
    let lastFinishReason: string | null = null;

    const handlePayload = (payload: any) => {
        lastPayload = payload;
        if (payload?.usage) {
            lastUsage = payload.usage;
        }
        const choices = Array.isArray(payload?.choices) ? payload.choices : [];
        choices.forEach((choice: any) => {
            const delta = choice?.delta || choice?.message || {};
            const textDelta = normalizeOpenAITextValue(delta?.content);
            const reasoningDelta = normalizeOpenAITextValue(
                delta?.reasoning_content ?? delta?.reasoning,
            );

            if (reasoningDelta) {
                accumulatedReasoning += reasoningDelta;
                callbacks?.onReasoningDelta?.(reasoningDelta);
            }
            if (textDelta) {
                accumulatedContent += textDelta;
                callbacks?.onTextDelta?.(textDelta);
            }
            if (typeof choice?.finish_reason === 'string' && choice.finish_reason) {
                lastFinishReason = choice.finish_reason;
            }
        });
    };

    const processBuffer = (flushRemainder: boolean) => {
        const eventBlocks = buffer.split(/\r?\n\r?\n/);
        if (!flushRemainder) {
            buffer = eventBlocks.pop() || '';
        } else {
            buffer = '';
        }

        eventBlocks.forEach((block) => {
            const dataLines = block
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => line.startsWith('data:'))
                .map((line) => line.slice(5).trimStart());

            if (dataLines.length === 0) return;
            const data = dataLines.join('\n').trim();
            if (!data || data === '[DONE]') return;

            try {
                handlePayload(JSON.parse(data));
            } catch {
                // Ignore partial or non-JSON SSE payloads.
            }
        });
    };

    while (true) {
        const { value, done } = await reader.read();
        const chunkText = decoder.decode(value || new Uint8Array(), { stream: !done });
        rawResponseText += chunkText;
        buffer += chunkText;
        processBuffer(done);
        if (done) break;
    }

    if (!lastPayload) {
        try {
            return JSON.parse(rawResponseText) as T;
        } catch {
            // Ignore and fall through to the synthetic payload builder below.
        }
    }

    const fallbackContent = normalizeOpenAITextValue(
        lastPayload?.choices?.[0]?.message?.content,
    );
    const fallbackReasoning = normalizeOpenAITextValue(
        lastPayload?.choices?.[0]?.message?.reasoning_content ??
        lastPayload?.choices?.[0]?.message?.reasoning,
    );

    if (!accumulatedContent && fallbackContent) {
        accumulatedContent = fallbackContent;
    }
    if (!accumulatedReasoning && fallbackReasoning) {
        accumulatedReasoning = fallbackReasoning;
    }

    return {
        ...(lastPayload && typeof lastPayload === 'object' ? lastPayload : {}),
        choices: [
            {
                ...(Array.isArray(lastPayload?.choices) && lastPayload.choices[0]
                    ? lastPayload.choices[0]
                    : {}),
                message: {
                    role: 'assistant',
                    content: accumulatedContent,
                    ...(accumulatedReasoning
                        ? { reasoning_content: accumulatedReasoning }
                        : {}),
                },
                finish_reason: lastFinishReason,
            },
        ],
        ...(lastUsage ? { usage: lastUsage } : {}),
    } as T;
};

const fetchOpenAIJsonWithFallback = async <T>(
    baseUrl: string,
    path: string,
    apiKeyOrKeys: string | string[],
    body: unknown,
    contextTag: string,
    requestTuning?: {
        timeoutMs?: number;
        idleTimeoutMs?: number;
        retries?: number;
        baseDelayMs?: number;
        maxDelayMs?: number;
        authStrategy?: OpenAIAuthStrategy;
        requestFingerprint?: string;
    },
): Promise<T> => {
    const cacheKey = getOpenAIAuthCacheEntryKey(baseUrl, path);
    const cachedMode = getCachedOpenAIAuthMode(cacheKey);
    const authStrategy = requestTuning?.authStrategy || 'auto';
    const allowQueryFallback = shouldAllowQueryAuthFallback(baseUrl, path);
    const plans = resolveOpenAIAuthPlans(cachedMode, authStrategy, allowQueryFallback);
    const apiKeys = normalizeApiKeyCandidates(apiKeyOrKeys);
    let lastError: any = null;

    if (apiKeys.length === 0) {
        throw new Error(`${contextTag} API failed: no available api keys`);
    }

    if (isVerboseOpenAIOperation(contextTag)) {
        console.info(`[${contextTag}] auth plan`, {
            authStrategy,
            allowQueryFallback,
            plans,
            cachedMode: cachedMode || null,
        });
    }

    for (const authMode of plans) {
        for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex++) {
            const apiKey = apiKeys[keyIndex];
            const url = buildOpenAIUrl(baseUrl, path, authMode, apiKey);
            const headers = buildOpenAIHeaders(authMode, apiKey);
            const requestStartedAt = Date.now();
            if (isVerboseOpenAIOperation(contextTag)) {
                console.log(
                    `[${contextTag}] POST [${authMode}] key=${keyIndex + 1}/${apiKeys.length} ${url.replace(apiKey, '***')}`,
                );
            }
            if (isVerboseOpenAIOperation(contextTag)) {
                console.info(`[${contextTag}] transport config`, {
                    authMode,
                    keyIndex: `${keyIndex + 1}/${apiKeys.length}`,
                    requestFingerprint: requestTuning?.requestFingerprint || null,
                    url: summarizeBaseUrlForLog(url.replace(apiKey, '***')),
                    timeoutMs: requestTuning?.timeoutMs ?? 120000,
                    idleTimeoutMs: requestTuning?.idleTimeoutMs ?? 300000,
                    retries: requestTuning?.retries ?? 3,
                });
            }
            let res: Response;
            try {
                res = await fetchWithResilience(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                }, {
                    operation: `${contextTag}.openaiPost`,
                    retries: requestTuning?.retries ?? 3,
                    baseDelayMs: requestTuning?.baseDelayMs ?? 1000,
                    maxDelayMs: requestTuning?.maxDelayMs ?? 15000,
                    timeoutMs: requestTuning?.timeoutMs ?? 120000,
                    idleTimeoutMs: requestTuning?.idleTimeoutMs ?? 300000,
                    requestFingerprint: requestTuning?.requestFingerprint,
                });
            } catch (error) {
                const isTimeoutError = isTimeoutException(error);
                if (isTimeoutError) {
                    const timeoutError: any = error instanceof Error ? error : new Error(String(error));
                    timeoutError.authMode = authMode;
                    timeoutError.keyIndex = keyIndex;
                    timeoutError.retryable = true;
                    timeoutError.timeout = true;
                    lastError = timeoutError;
                }
                if (isVerboseOpenAIOperation(contextTag)) {
                    console.warn(`[${contextTag}] transport failure`, {
                        authMode,
                        keyIndex: `${keyIndex + 1}/${apiKeys.length}`,
                        requestFingerprint: requestTuning?.requestFingerprint || null,
                        elapsedMs: Date.now() - requestStartedAt,
                        isTimeoutError,
                        errorName: error instanceof Error ? error.name : typeof error,
                        errorMessage: error instanceof Error ? error.message : String(error),
                    });
                }
                if (isTimeoutError) {
                    if (keyIndex < apiKeys.length - 1) {
                        console.warn(
                            `[${contextTag}] Timeout, switching to next api key ${keyIndex + 2}/${apiKeys.length}${requestTuning?.requestFingerprint ? `, requestId=${requestTuning.requestFingerprint}` : ''}`,
                        );
                    } else {
                        console.warn(
                            `[${contextTag}] Timeout on final api key for auth=${authMode}, will continue with next auth mode if available${requestTuning?.requestFingerprint ? `, requestId=${requestTuning.requestFingerprint}` : ''}`,
                        );
                    }
                    continue;
                }
                throw error;
            }

            if (res.ok) {
                setCachedOpenAIAuthMode(cacheKey, authMode);
                const responseParseStartedAt = Date.now();
                const payload = await res.json();
                if (isVerboseOpenAIOperation(contextTag)) {
                    console.info(`[${contextTag}] response payload`, {
                        authMode,
                        keyIndex: `${keyIndex + 1}/${apiKeys.length}`,
                        elapsedMs: Date.now() - requestStartedAt,
                        parseMs: Date.now() - responseParseStartedAt,
                        ...summarizeOpenAIJsonPayloadForLog(payload),
                    });
                }
                return payload as T;
            }

            const errBody = await res.text().catch(() => '');
            if (isVerboseOpenAIOperation(contextTag)) {
                console.warn(`[${contextTag}] response error`, {
                    authMode,
                    keyIndex: `${keyIndex + 1}/${apiKeys.length}`,
                    requestFingerprint: requestTuning?.requestFingerprint || null,
                    elapsedMs: Date.now() - requestStartedAt,
                    status: res.status,
                    bodyPreview: errBody.slice(0, 280),
                });
            }
            const isRateLimitError = isRateLimited(res.status);
            const isServerErr = isServerError(res.status);
            const err: any = new Error(`${contextTag} API error: ${res.status} [${authMode}] ${isRateLimitError ? 'Rate limited' : isServerErr ? 'Server error' : errBody}`);
            err.status = res.status;
            err.authMode = authMode;
            err.keyIndex = keyIndex;
            err.retryable = isRateLimitError || isServerErr;
            lastError = err;

            if (shouldTryAlternateAuth(res.status)) {
                clearCachedOpenAIAuthMode(cacheKey);
            }

            if (isRateLimitError) {
                if (keyIndex < apiKeys.length - 1) {
                    console.warn(
                        `[${contextTag}] Rate limited (429), switching to next api key ${keyIndex + 2}/${apiKeys.length}`,
                    );
                    continue;
                }
                const delay = 5000 + Math.random() * 5000;
                console.warn(`[${contextTag}] Rate limited (429), waiting ${delay.toFixed(0)}ms before retry`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            if (isServerErr && path === '/v1/chat/completions') {
                // For server errors on chat API, try exponential backoff before giving up
                console.warn(`[${contextTag}] Server error (${res.status}), will retry with alternate auth or next key`);
                continue;
            }

            if (!shouldTryAlternateAuth(res.status)) {
                throw err;
            }
        }
    }

    throw lastError || new Error(`${contextTag} API failed on all auth strategies`);
};

const fetchOpenAIStreamingJsonWithFallback = async <T>(
    baseUrl: string,
    path: string,
    apiKeyOrKeys: string | string[],
    body: unknown,
    contextTag: string,
    callbacks?: UnifiedJsonStreamCallbacks,
    requestTuning?: {
        timeoutMs?: number;
        idleTimeoutMs?: number;
        retries?: number;
        baseDelayMs?: number;
        maxDelayMs?: number;
        authStrategy?: OpenAIAuthStrategy;
        requestFingerprint?: string;
    },
): Promise<T> => {
    const cacheKey = getOpenAIAuthCacheEntryKey(baseUrl, path);
    const cachedMode = getCachedOpenAIAuthMode(cacheKey);
    const authStrategy = requestTuning?.authStrategy || 'auto';
    const allowQueryFallback = shouldAllowQueryAuthFallback(baseUrl, path);
    const plans = resolveOpenAIAuthPlans(cachedMode, authStrategy, allowQueryFallback);
    const apiKeys = normalizeApiKeyCandidates(apiKeyOrKeys);
    let lastError: any = null;

    if (apiKeys.length === 0) {
        throw new Error(`${contextTag} API failed: no available api keys`);
    }

    for (const authMode of plans) {
        for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex++) {
            const apiKey = apiKeys[keyIndex];
            const url = buildOpenAIUrl(baseUrl, path, authMode, apiKey);
            const headers = buildOpenAIHeaders(authMode, apiKey);
            const requestStartedAt = Date.now();
            if (isVerboseOpenAIOperation(contextTag)) {
                console.log(
                    `[${contextTag}] POST [${authMode}] key=${keyIndex + 1}/${apiKeys.length} ${url.replace(apiKey, '***')}`,
                );
            }

            let res: Response;
            try {
                res = await fetchWithResilience(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                }, {
                    operation: `${contextTag}.openaiPost`,
                    retries: requestTuning?.retries ?? 3,
                    baseDelayMs: requestTuning?.baseDelayMs ?? 1000,
                    maxDelayMs: requestTuning?.maxDelayMs ?? 15000,
                    timeoutMs: requestTuning?.timeoutMs ?? 120000,
                    idleTimeoutMs: requestTuning?.idleTimeoutMs ?? 300000,
                    requestFingerprint: requestTuning?.requestFingerprint,
                });
            } catch (error) {
                const isTimeoutError = isTimeoutException(error);
                if (isTimeoutError) {
                    const timeoutError: any = error instanceof Error ? error : new Error(String(error));
                    timeoutError.authMode = authMode;
                    timeoutError.keyIndex = keyIndex;
                    timeoutError.retryable = true;
                    timeoutError.timeout = true;
                    lastError = timeoutError;
                    continue;
                }
                throw error;
            }

            if (res.ok) {
                setCachedOpenAIAuthMode(cacheKey, authMode);
                const payload = await parseOpenAIStreamingPayload<T>(res, callbacks);
                if (isVerboseOpenAIOperation(contextTag)) {
                    console.info(`[${contextTag}] streaming payload`, {
                        authMode,
                        keyIndex: `${keyIndex + 1}/${apiKeys.length}`,
                        elapsedMs: Date.now() - requestStartedAt,
                        ...summarizeOpenAIJsonPayloadForLog(payload),
                    });
                }
                return payload;
            }

            const errBody = await res.text().catch(() => '');
            const isRateLimitError = isRateLimited(res.status);
            const isServerErr = isServerError(res.status);
            const err: any = new Error(`${contextTag} API error: ${res.status} [${authMode}] ${isRateLimitError ? 'Rate limited' : isServerErr ? 'Server error' : errBody}`);
            err.status = res.status;
            err.authMode = authMode;
            err.keyIndex = keyIndex;
            err.retryable = isRateLimitError || isServerErr;
            lastError = err;

            if (shouldTryAlternateAuth(res.status)) {
                clearCachedOpenAIAuthMode(cacheKey);
            }
            if (isRateLimitError || isServerErr) {
                continue;
            }
            if (!shouldTryAlternateAuth(res.status)) {
                throw err;
            }
        }
    }

    throw lastError || new Error(`${contextTag} API failed on all auth strategies`);
};

const fetchOpenAIFormWithFallback = async <T>(
    baseUrl: string,
    path: string,
    apiKeyOrKeys: string | string[],
    buildFormData: () => FormData,
    contextTag: string,
    requestTuning?: {
        timeoutMs?: number;
        idleTimeoutMs?: number;
        retries?: number;
        baseDelayMs?: number;
        maxDelayMs?: number;
        authStrategy?: OpenAIAuthStrategy;
        requestFingerprint?: string;
    },
): Promise<T> => {
    const cacheKey = getOpenAIAuthCacheEntryKey(baseUrl, path);
    const cachedMode = getCachedOpenAIAuthMode(cacheKey);
    const authStrategy = requestTuning?.authStrategy || 'auto';
    const allowQueryFallback = shouldAllowQueryAuthFallback(baseUrl, path);
    const plans = resolveOpenAIAuthPlans(cachedMode, authStrategy, allowQueryFallback);
    const apiKeys = normalizeApiKeyCandidates(apiKeyOrKeys);
    let lastError: any = null;

    if (apiKeys.length === 0) {
        throw new Error(`${contextTag} API failed: no available api keys`);
    }

    if (isVerboseOpenAIOperation(contextTag)) {
        console.info(`[${contextTag}] auth plan`, {
            authStrategy,
            allowQueryFallback,
            plans,
            cachedMode: cachedMode || null,
        });
    }

    for (const authMode of plans) {
        for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex++) {
            const apiKey = apiKeys[keyIndex];
            const url = buildOpenAIUrl(baseUrl, path, authMode, apiKey);
            const headers = buildOpenAIFormHeaders(authMode, apiKey);
            const requestStartedAt = Date.now();
            if (isVerboseOpenAIOperation(contextTag)) {
                console.log(
                    `[${contextTag}] POST [${authMode}] key=${keyIndex + 1}/${apiKeys.length} ${url.replace(apiKey, '***')}`,
                );
            }
            if (isVerboseOpenAIOperation(contextTag)) {
                console.info(`[${contextTag}] transport config`, {
                    authMode,
                    keyIndex: `${keyIndex + 1}/${apiKeys.length}`,
                    requestFingerprint: requestTuning?.requestFingerprint || null,
                    url: summarizeBaseUrlForLog(url.replace(apiKey, '***')),
                    timeoutMs: requestTuning?.timeoutMs ?? 120000,
                    idleTimeoutMs: requestTuning?.idleTimeoutMs ?? 300000,
                    retries: requestTuning?.retries ?? 3,
                });
            }

            let res: Response;
            try {
                res = await fetchWithResilience(url, {
                    method: 'POST',
                    headers,
                    body: buildFormData(),
                }, {
                    operation: `${contextTag}.openaiFormPost`,
                    retries: requestTuning?.retries ?? 3,
                    baseDelayMs: requestTuning?.baseDelayMs ?? 1000,
                    maxDelayMs: requestTuning?.maxDelayMs ?? 15000,
                    timeoutMs: requestTuning?.timeoutMs ?? 120000,
                    idleTimeoutMs: requestTuning?.idleTimeoutMs ?? 300000,
                    requestFingerprint: requestTuning?.requestFingerprint,
                });
            } catch (error) {
                if (isTimeoutException(error)) {
                    const timeoutError: any = error instanceof Error ? error : new Error(String(error));
                    timeoutError.authMode = authMode;
                    timeoutError.keyIndex = keyIndex;
                    timeoutError.retryable = true;
                    timeoutError.timeout = true;
                    lastError = timeoutError;
                    continue;
                }
                if (isVerboseOpenAIOperation(contextTag)) {
                    console.warn(`[${contextTag}] transport failure`, {
                        authMode,
                        keyIndex: `${keyIndex + 1}/${apiKeys.length}`,
                        requestFingerprint: requestTuning?.requestFingerprint || null,
                        elapsedMs: Date.now() - requestStartedAt,
                        errorName: error instanceof Error ? error.name : typeof error,
                        errorMessage: error instanceof Error ? error.message : String(error),
                    });
                }
                throw error;
            }

            if (res.ok) {
                setCachedOpenAIAuthMode(cacheKey, authMode);
                const payload = await res.json();
                if (isVerboseOpenAIOperation(contextTag)) {
                    console.info(`[${contextTag}] response payload`, {
                        authMode,
                        keyIndex: `${keyIndex + 1}/${apiKeys.length}`,
                        requestFingerprint: requestTuning?.requestFingerprint || null,
                        elapsedMs: Date.now() - requestStartedAt,
                        ...(typeof payload === 'object' && payload
                            ? summarizeOpenAIJsonPayloadForLog(payload)
                            : { payloadType: typeof payload }),
                    });
                }
                return payload as T;
            }

            const errBody = await res.text().catch(() => '');
            console.warn(`[${contextTag}] response error`, {
                authMode,
                keyIndex: `${keyIndex + 1}/${apiKeys.length}`,
                requestFingerprint: requestTuning?.requestFingerprint || null,
                elapsedMs: Date.now() - requestStartedAt,
                status: res.status,
                bodyPreview: errBody.slice(0, 500),
            });
            const isRateLimitError = isRateLimited(res.status);
            const isServerErr = isServerError(res.status);
            const err: any = new Error(`${contextTag} API error: ${res.status} [${authMode}] ${isRateLimitError ? 'Rate limited' : isServerErr ? 'Server error' : errBody}`);
            err.status = res.status;
            err.authMode = authMode;
            err.keyIndex = keyIndex;
            err.retryable = isRateLimitError || isServerErr;
            lastError = err;

            if (shouldTryAlternateAuth(res.status)) {
                clearCachedOpenAIAuthMode(cacheKey);
            }

            if (isRateLimitError) {
                if (keyIndex < apiKeys.length - 1) {
                    continue;
                }
                const delay = 5000 + Math.random() * 5000;
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            if (isServerErr) {
                continue;
            }

            if (!shouldTryAlternateAuth(res.status)) {
                throw err;
            }
        }
    }

    throw lastError || new Error(`${contextTag} API failed on all auth strategies`);
};

type UnifiedJsonGenerationOptions = {
    model: string;
    providerId?: string | null;
    parts: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }>;
    temperature?: number;
    responseSchema?: unknown;
    tools?: unknown[];
    operation?: string;
    disableTextOnlyFallback?: boolean;
    queueKey?: string;
    minIntervalMs?: number;
    onTextDelta?: (delta: string) => void;
    onReasoningDelta?: (delta: string) => void;
    onQueueEvent?: (event: {
        phase: 'waiting' | 'running';
        queueKey: string;
        waitMs: number;
    }) => void;
    requestTuning?: {
        timeoutMs?: number;
        idleTimeoutMs?: number;
        retries?: number;
        baseDelayMs?: number;
        maxDelayMs?: number;
        authStrategy?: OpenAIAuthStrategy;
        requestFingerprint?: string;
    };
};

type OpenAIChatSession = {
    __mode: 'openai';
    model: string;
    providerId?: string | null;
    history: Content[];
    systemInstruction: string;
};

type ChatSession = Chat | OpenAIChatSession;

const openAIRequestQueueTail = new Map<string, Promise<void>>();
const openAIRequestQueueNextAt = new Map<string, number>();

const runQueuedOpenAIRequest = async <T>(
    queueKey: string,
    minIntervalMs: number,
    task: () => Promise<T>,
    operationLabel?: string,
    onQueueEvent?: (event: {
        phase: 'waiting' | 'running';
        queueKey: string;
        waitMs: number;
    }) => void,
): Promise<T> => {
    const previous = openAIRequestQueueTail.get(queueKey) || Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
        release = resolve;
    });
    openAIRequestQueueTail.set(
        queueKey,
        previous.catch(() => undefined).then(() => current),
    );

    try {
        await previous.catch(() => undefined);
        const waitMs = Math.max(
            0,
            (openAIRequestQueueNextAt.get(queueKey) || 0) - Date.now(),
            getSharedOpenAIQueueNextAt(queueKey) - Date.now(),
        );
        onQueueEvent?.({
            phase: 'waiting',
            queueKey,
            waitMs,
        });
        if (operationLabel && isVerboseOpenAIOperation(operationLabel)) {
            console.info(`[${operationLabel}] queue gate`, {
                queueKey,
                waitMs,
                minIntervalMs,
            });
        }
        if (waitMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
        const reservedNextAt = Date.now() + Math.max(0, minIntervalMs);
        openAIRequestQueueNextAt.set(queueKey, reservedNextAt);
        setSharedOpenAIQueueNextAt(queueKey, reservedNextAt);
        onQueueEvent?.({
            phase: 'running',
            queueKey,
            waitMs,
        });
        const result = await task();
        return result;
    } finally {
        release();
        if (openAIRequestQueueTail.get(queueKey) === current) {
            openAIRequestQueueTail.delete(queueKey);
        }
    }
};

const isRateLimitException = (error: unknown): boolean => {
    const status = Number((error as any)?.status || 0);
    const message = String((error as any)?.message || '').toLowerCase();
    return status === 429 || message.includes('429') || message.includes('rate limit');
};

const isTimeoutException = (error: unknown): boolean => {
    const message = String((error as any)?.message || '').toLowerCase();
    return message.includes('request timeout') || message.includes('timeout after') || message.includes('idle-timeout') || message.includes('total-timeout');
};

export type UnifiedJsonGenerationResult = {
    text: string;
    candidates?: any[];
    raw?: any;
};

const toOpenAIMessageContent = (
    parts: UnifiedJsonGenerationOptions['parts']
): Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> => {
    const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [];

    for (const part of parts || []) {
        if (part?.text) {
            content.push({ type: 'text', text: part.text });
            continue;
        }

        const data = part?.inlineData?.data;
        if (data) {
            const mimeType = part.inlineData?.mimeType || 'image/png';
            content.push({
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${data}` }
            });
        }
    }

    return content;
};

const isImageInputUnsupportedError = (error: unknown): boolean => {
    const msg = String((error as any)?.message || '').toLowerCase();
    return msg.includes('does not support image input')
        || msg.includes('model does not support image')
        || msg.includes('image input is not supported')
        || msg.includes('cannot read "image')
        || msg.includes('invalid content type')
        || msg.includes('image_url');
};

const stripImageContent = (
    content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>
): Array<{ type: 'text'; text: string }> => {
    const textOnly = content.filter((c) => c.type === 'text') as Array<{ type: 'text'; text: string }>;
    if (textOnly.length > 0) return textOnly;
    return [{ type: 'text', text: '用户上传了图片作为参考，请基于文本说明继续处理。' }];
};

export const generateJsonResponse = async (
    options: UnifiedJsonGenerationOptions
): Promise<UnifiedJsonGenerationResult> => {
    const {
        model,
        providerId,
        parts,
        temperature = 0.7,
        responseSchema,
        tools,
        operation = 'generateJsonResponse',
        disableTextOnlyFallback = false,
        queueKey,
        minIntervalMs = 0,
        onTextDelta,
        onReasoningDelta,
        onQueueEvent,
        requestTuning,
    } = options;

    const provider = getProviderConfigById(providerId);
    const baseUrl = normalizeUrl(provider.baseUrl || '');
    const isGoogleDirect = provider.id === 'gemini' || !baseUrl || baseUrl.includes('googleapis.com');

    if (isGoogleDirect) {
        const response = await getClient(providerId).models.generateContent({
            model,
            contents: { parts },
            config: {
                temperature,
                responseMimeType: 'application/json',
                ...(responseSchema ? { responseSchema } : {}),
                ...(tools && tools.length > 0 ? { tools } : {})
            }
        });

        return {
            text: response.text || '{}',
            candidates: response.candidates as any,
            raw: response as any
        };
    }

    const apiKeys = getApiKey(true, providerId);
    if (!Array.isArray(apiKeys) || apiKeys.length === 0) {
        requireApiKey('generateJsonResponse', providerId);
    }
    const openAIContent = toOpenAIMessageContent(parts);

    const body = {
        model,
        temperature,
        messages: [
            {
                role: 'user',
                content: openAIContent
            }
        ],
        response_format: { type: 'json_object' },
        ...((onTextDelta || onReasoningDelta)
            ? {
                stream: true,
                stream_options: { include_usage: true },
            }
            : {}),
    };

    const requestStartedAt = Date.now();
    if (isVerboseOpenAIOperation(operation)) {
        console.info(`[${operation}] prepared`, {
            provider: provider.id || 'unknown',
            model,
            baseUrl: summarizeBaseUrlForLog(baseUrl),
            queueKey: queueKey || 'global',
            minIntervalMs,
            disableTextOnlyFallback,
            requestTuning: {
                timeoutMs: requestTuning?.timeoutMs ?? 120000,
                idleTimeoutMs: requestTuning?.idleTimeoutMs ?? 300000,
                retries: requestTuning?.retries ?? 3,
                baseDelayMs: requestTuning?.baseDelayMs ?? 1000,
                maxDelayMs: requestTuning?.maxDelayMs ?? 15000,
                authStrategy: requestTuning?.authStrategy ?? 'auto',
            },
            contentSummary: summarizeOpenAIMessageContentForLog(openAIContent),
        });
    }

    const executeOpenAIRequest = async () => {
        let data: any;
        let lastError: Error | null = null;
        const maxAttempts = 2;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                data = await fetchOpenAIJsonWithFallback<any>(
                    baseUrl,
                    '/v1/chat/completions',
                    apiKeys,
                    body,
                    operation,
                    requestTuning,
                );
                break;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (
                    attempt === 0 &&
                    !disableTextOnlyFallback &&
                    !isImageInputUnsupportedError(error) &&
                    !isRateLimitException(error)
                ) {
                    console.warn(`[${operation}] First attempt failed, trying text-only fallback`);
                    try {
                        const fallbackBody = {
                            ...body,
                            messages: [
                                {
                                    role: 'user',
                                    content: stripImageContent(openAIContent)
                                }
                            ]
                        };
                        data = await fetchOpenAIJsonWithFallback<any>(
                            baseUrl,
                            '/v1/chat/completions',
                            apiKeys,
                            fallbackBody,
                            `${operation}.textOnlyFallback`,
                            requestTuning,
                        );
                        break;
                    } catch (fallbackError) {
                        console.error(`[${operation}] Text-only fallback also failed:`, fallbackError);
                        lastError = fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError));
                    }
                } else {
                    throw error;
                }
            }
        }

        if (!data) {
            throw lastError || new Error(`[${operation}] Request failed after all attempts`);
        }

        return data;
    };

    const effectiveQueueKey = `${provider.id || 'openai'}:json:${queueKey || 'global'}`;
    const effectiveMinInterval = Math.max(minIntervalMs, 900);
    const data = await runQueuedOpenAIRequest(
        effectiveQueueKey,
        effectiveMinInterval,
        async () => {
            if (onTextDelta || onReasoningDelta) {
                const streamBody = {
                    ...body,
                    stream: true,
                    stream_options: { include_usage: true },
                };
                let streamedData: any;
                let lastError: Error | null = null;
                const maxAttempts = 2;

                for (let attempt = 0; attempt < maxAttempts; attempt++) {
                    try {
                        streamedData = await fetchOpenAIStreamingJsonWithFallback<any>(
                            baseUrl,
                            '/v1/chat/completions',
                            apiKeys,
                            streamBody,
                            operation,
                            {
                                onTextDelta,
                                onReasoningDelta,
                            },
                            requestTuning,
                        );
                        break;
                    } catch (error) {
                        lastError = error instanceof Error ? error : new Error(String(error));
                        if (
                            attempt === 0 &&
                            !disableTextOnlyFallback &&
                            !isImageInputUnsupportedError(error) &&
                            !isRateLimitException(error)
                        ) {
                            try {
                                const fallbackBody = {
                                    ...streamBody,
                                    messages: [
                                        {
                                            role: 'user',
                                            content: stripImageContent(openAIContent),
                                        },
                                    ],
                                };
                                streamedData = await fetchOpenAIStreamingJsonWithFallback<any>(
                                    baseUrl,
                                    '/v1/chat/completions',
                                    apiKeys,
                                    fallbackBody,
                                    `${operation}.textOnlyFallback`,
                                    {
                                        onTextDelta,
                                        onReasoningDelta,
                                    },
                                    requestTuning,
                                );
                                break;
                            } catch (fallbackError) {
                                lastError = fallbackError instanceof Error
                                    ? fallbackError
                                    : new Error(String(fallbackError));
                            }
                        } else {
                            throw error;
                        }
                    }
                }

                if (!streamedData) {
                    throw lastError || new Error(`[${operation}] Streaming request failed after all attempts`);
                }
                return streamedData;
            }
            return executeOpenAIRequest();
        },
        operation,
        onQueueEvent,
    );

    if (isVerboseOpenAIOperation(operation)) {
        console.info(`[${operation}] completed`, {
            elapsedMs: Date.now() - requestStartedAt,
            queueKey: effectiveQueueKey,
        });
    }

    return {
        text: data?.choices?.[0]?.message?.content || '{}',
        candidates: data?.choices || [],
        raw: data
    };
};

/**
 * Fetch available models from the provider, attempting all provided keys
 */
export const fetchAvailableModels = async (provider: string, keys: string[], baseUrl?: string) => {
    if (keys.length === 0) return [];

    const isGoogle = !baseUrl || baseUrl.includes('googleapis.com');
    const rootUrl = normalizeUrl(baseUrl || '');
    const allModels = new Set<string>();

    // 1. Special Handling: MemeFast Pricing API (Public list, high accuracy)
    const isMemeFast = rootUrl.includes('memefast.top'); /* cspell:disable-line */
    if (isMemeFast) {
        try {
            const pricingUrl = `${rootUrl}/api/pricing_new`;
            const res = await fetchWithResilience(pricingUrl, {}, { operation: 'fetchAvailableModels.memeFastPricing', retries: 1 });
            if (res.ok) {
                const json = await res.json();
                const data = json.data || [];
                if (Array.isArray(data)) {
                    data.forEach(m => {
                        if (m.model_name) allModels.add(m.model_name);
                    });
                }
            }
        } catch (e) {
            console.warn(`[fetchAvailableModels] [MemeFast] Pricing fetch failed, falling back to /v1/models`, e);
        }
    }

    // 2. Standard Logic: Iterate through all keys to find all accessible models
    const modelsPath = /\/v\d+(beta)?$/.test(rootUrl) ? `${rootUrl}/models` : `${rootUrl}/v1/models`;
    const getGoogleUrl = (k: string) => `${rootUrl}/v1/models?key=${encodeURIComponent(k)}`;

    await Promise.allSettled(
        keys.map(async (rawKey, idx) => {
            const key = rawKey.trim();
            if (!key) return;

            try {
                const plans = isGoogle
                    ? [{
                        url: getGoogleUrl(key),
                        headers: {}
                    }]
                    : [
                        {
                            url: modelsPath,
                            headers: {
                                'Authorization': `Bearer ${key}`,
                                'Content-Type': 'application/json'
                            }
                        },
                        {
                            url: `${modelsPath}?key=${encodeURIComponent(key)}`,
                            headers: { 'Content-Type': 'application/json' }
                        }
                    ];

                let keySucceeded = false;
                for (const plan of plans) {
                    const res = await fetchWithResilience(plan.url, { headers: plan.headers }, { operation: 'fetchAvailableModels.modelList', retries: 0 });

                    if (res.ok) {
                        const data = await res.json();
                        const list = data.models || data.data || (Array.isArray(data) ? data : []);
                        list.forEach((m: any) => {
                            const id = typeof m === 'string' ? m : (m.id || m.name || m.model);
                            if (id) allModels.add(id);
                        });
                        keySucceeded = true;
                        break;
                    }

                    console.warn(`[fetchAvailableModels] [${provider}] Key #${idx + 1} returned ${res.status} for ${plan.url}`);
                    if (!shouldTryAlternateAuth(res.status)) {
                        break;
                    }
                }

                if (!keySucceeded) {
                    console.warn(`[fetchAvailableModels] [${provider}] Key #${idx + 1} no model list available.`);
                }
            } catch (error) {
                console.error(`[fetchAvailableModels] [${provider}] Key #${idx + 1} failed:`, error);
            }
        })
    );

    const cleaned = Array.from(allModels).filter(Boolean);
    return cleaned;
};

// Helper to get API Base URL dynamically
const getApiUrl = (providerId?: string | null) => {
    const config = getProviderConfigById(providerId);
    return config.baseUrl;
};

const getSelectedScriptModelSelection = (): BestModelSelection | null => {
    try {
        const selected =
            getStudioUserAssetApi().getWorkspacePreferences().selectedScriptModels;
        if (!Array.isArray(selected)) return null;
        const first = selected.find((m: unknown) => typeof m === 'string' && m.trim() && m !== 'Auto');
        if (typeof first !== 'string') return null;
        const parsed = parseMappedModelStorageEntry('script', first);
        if (!parsed.modelId) return null;
        return {
            modelId: parsed.modelId,
            providerId: parsed.providerId || null,
        };
    } catch {
        return null;
    }
};

// Initialize the GenAI client with dynamic key and url
// 统一模型获取助手：锁定云雾 API 的高阶预览模型 ID
export const getBestModelSelection = (
    type: 'text' | 'image' | 'video' | 'thinking' = 'text',
): BestModelSelection => {
    const config = getProviderConfig();
    const isProxy = config.id !== 'gemini' || (config.baseUrl && !config.baseUrl.includes('googleapis.com'));

    const isLikelyImageModel = (modelId: string): boolean => {
        const low = String(modelId || '').toLowerCase();
        return low.includes('image')
            || low.includes('dall-e')
            || low.includes('seedream')
            || low.includes('flux');
    };

    if (type === 'image') {
        const selected =
            getStudioUserAssetApi().getWorkspacePreferences().selectedImageModels;
        // 用户指定：自动选择模式下默认首选 Nano Banana Pro (gemini-3-pro-image-preview)
        if (selected.length === 0 || selected.includes('Auto')) {
            return { modelId: IMAGE_PRO_MODEL, providerId: null };
        }

        const first = selected[0];
        const parsed = typeof first === 'string' ? parseMappedModelStorageEntry('image', first) : null;
        const firstModelId = String(parsed?.modelId || first || IMAGE_PRO_MODEL);
        const firstProviderId = parsed?.providerId || null;
        if (firstModelId === 'Nano Banana Pro') return { modelId: IMAGE_PRO_MODEL, providerId: firstProviderId };
        if (firstModelId === 'NanoBanana2' || firstModelId === 'Nano Banana 2') {
            return { modelId: IMAGE_NANOBANANA_2_MODEL, providerId: firstProviderId };
        }
        if (firstModelId === 'Seedream5.0' || firstModelId === 'Seedream 5.0' || firstModelId === 'Seedream 4') {
            return { modelId: IMAGE_SEEDREAM_MODEL, providerId: firstProviderId };
        }
        if (isProxy && firstModelId.includes('1.5-flash')) {
            return { modelId: IMAGE_PRO_MODEL, providerId: firstProviderId };
        }
        return { modelId: firstModelId, providerId: firstProviderId };
    }

    if (type === 'video') {
        const selected =
            getStudioUserAssetApi().getWorkspacePreferences().selectedVideoModels;
        // 用户要求视频首选 veo3.1fast
        if (selected.length === 0 || selected.includes('Auto')) {
            return { modelId: VEO_FAST_MODEL, providerId: null };
        }
        const first = selected[0];
        const parsed = typeof first === 'string' ? parseMappedModelStorageEntry('video', first) : null;
        return {
            modelId: String(parsed?.modelId || first || VEO_FAST_MODEL),
            providerId: parsed?.providerId || null,
        };
    }

    if (type === 'thinking') {
        const selected = getSelectedScriptModelSelection();
        if (selected) {
            if (isLikelyImageModel(selected.modelId)) {
                console.warn(
                    `[model-router] selected thinking model appears to be an image model (${selected.modelId}), fallback to ${THINKING_MODEL}`,
                );
                return { modelId: THINKING_MODEL, providerId: null };
            }
            return selected;
        }
        return { modelId: THINKING_MODEL, providerId: null };
    }

    const selectedTextModel = getSelectedScriptModelSelection();
    if (selectedTextModel) {
        if (isLikelyImageModel(selectedTextModel.modelId)) {
            console.warn(
                `[model-router] selected text model appears to be an image model (${selectedTextModel.modelId}), fallback to ${FLASH_MODEL}`,
            );
            return { modelId: FLASH_MODEL, providerId: null };
        }
        // 快速模式兼容性：强制升级到 3.0 Flash
        if (selectedTextModel.modelId.toLowerCase().includes('1.5-flash')) {
            return { modelId: FLASH_MODEL, providerId: selectedTextModel.providerId };
        }
        return selectedTextModel;
    }
    return { modelId: FLASH_MODEL, providerId: null };
};

export const getBestModelId = (type: 'text' | 'image' | 'video' | 'thinking' = 'text'): string => {
    return getBestModelSelection(type).modelId;
};

export const getClient = (providerId?: string | null) => {
    const config: any = { apiKey: requireApiKey('getClient', providerId) };
    let baseUrl = getApiUrl(providerId);
    if (baseUrl) {
        // SDK 内部会自动拼装 v1/v1beta，这里需要移除版本后缀以避免重复
        baseUrl = baseUrl.replace(/\/+$/, '').replace(/\/v\d+(beta)?$/i, '');
        config.httpOptions = { baseUrl };
        console.log(`[GenAI] Active Proxy: ${baseUrl} (SDK will append version)`);
    } else {
        console.log(`[GenAI] Using direct Google endpoint`);
    }
    const client = new GoogleGenAI(config);
    (client as any).getBestModelId = getBestModelId;
    return client;
};

// Get base URL for video REST API (bypasses SDK's predictLongRunning endpoint)
const getVideoBaseUrl = (providerId?: string | null) => {
    const baseUrl = getApiUrl(providerId);
    return (baseUrl || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
};

// Models
const PRO_MODEL = 'gemini-3-pro-preview';
const FLASH_MODEL = 'gemini-3.1-flash-lite-preview';
const THINKING_MODEL = 'gemini-3.1-pro-preview';
// Image Gen models
const IMAGE_PRO_MODEL = 'gemini-3-pro-image-preview';
const IMAGE_FLASH_MODEL = 'gemini-3-pro-image-preview';
const IMAGE_NANOBANANA_2_MODEL = 'gemini-3.1-flash-image-preview';
const IMAGE_SEEDREAM_MODEL = 'doubao-seedream-5-0-260128';
// Video Gen models
const VEO_FAST_MODEL = 'veo-3.1-fast-generate-preview';
const VEO_PRO_MODEL = 'veo-3.1-generate-preview';

type VideoApiVersion = 'v1beta' | 'v1';
type VideoAuthMode = 'bearer' | 'query';

const LEGACY_VIDEO_MODEL_MAP: Record<string, string> = {
    'veo-3.1-fast': VEO_FAST_MODEL,
    'veo-3.1': VEO_PRO_MODEL,
    'veo3.1-4k': VEO_PRO_MODEL,
    'veo3.1-c': VEO_PRO_MODEL,
};

const normalizeVideoModelId = (modelId: string): string => {
    const normalized = (modelId || '').trim();
    if (!normalized) return VEO_FAST_MODEL;

    if (normalized === 'Veo 3.1 Fast') return VEO_FAST_MODEL;
    if (normalized === 'Veo 3.1' || normalized === 'Veo 3.1 Pro') return VEO_PRO_MODEL;
    if (normalized === 'Sora 2') return 'sora-2';
    if (normalized === 'Sora 2 Pro') return 'sora-2';
    if (normalized === 'Kling Pro') return 'kling-v1-5';
    if (normalized === 'Kling 3.0') return 'kling-v1-5';

    const lower = normalized.toLowerCase();
    if (LEGACY_VIDEO_MODEL_MAP[lower]) return LEGACY_VIDEO_MODEL_MAP[lower];
    if (lower === 'sora-2') return 'sora-2';
    if (lower === 'kling-3.0' || lower === 'kling pro') return 'kling-v1-5';

    return normalized;
};

const isSora2VideoModel = (modelId: string): boolean => {
    const normalized = normalizeVideoModelId(modelId || '');
    return normalized === 'sora-2';
};

const getNormalizedSelectedVideoModels = (): string[] => {
    const parsed =
        getStudioUserAssetApi().getWorkspacePreferences().selectedVideoModels;

    const source = parsed.length > 0 ? parsed : [VEO_FAST_MODEL];
    const normalized = source.map(normalizeVideoModelId).filter(Boolean);
    const deduped = Array.from(new Set(normalized));

    if (deduped.length === 0) {
        return [VEO_FAST_MODEL];
    }

    return deduped;
};

const shouldFallbackVideoAuth = (status: number): boolean => {
    return status === 401 || status === 403 || status === 404;
};

const buildVideoGenerateUrl = (
    baseUrl: string,
    version: VideoApiVersion,
    modelId: string,
    authMode: VideoAuthMode,
    apiKey: string
): string => {
    const cleanBase = normalizeUrl(baseUrl);
    const baseWithoutVersion = cleanBase.replace(/\/v1(?:beta)?$/i, '');
    const versionBase = cleanBase.endsWith(`/${version}`) ? cleanBase : `${baseWithoutVersion}/${version}`;
    const path = `${versionBase}/models/${modelId}:generateVideos`;
    if (authMode === 'query') {
        return `${path}?key=${encodeURIComponent(apiKey)}`;
    }
    return path;
};

const buildVideoPollUrl = (
    baseUrl: string,
    version: VideoApiVersion,
    operationName: string,
    authMode: VideoAuthMode,
    apiKey: string
): string => {
    const cleanBase = normalizeUrl(baseUrl);
    const baseWithoutVersion = cleanBase.replace(/\/v1(?:beta)?$/i, '');
    const versionBase = cleanBase.endsWith(`/${version}`) ? cleanBase : `${baseWithoutVersion}/${version}`;
    const path = `${versionBase}/${operationName}`;
    if (authMode === 'query') {
        return `${path}?key=${encodeURIComponent(apiKey)}`;
    }
    return path;
};

const buildVideoHeaders = (authMode: VideoAuthMode, apiKey: string): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authMode === 'bearer') {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }
    return headers;
};

const parseVideoUrlFromAnyPayload = (payload: any): string | null => {
    return payload?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
        || payload?.response?.generatedVideos?.[0]?.video?.uri
        || payload?.data?.[0]?.url
        || payload?.data?.[0]?.video?.url
        || payload?.output?.[0]?.url
        || payload?.video?.url
        || payload?.url
        || null;
};

const generateVideoOpenAICompatible = async (
    baseUrl: string,
    apiKey: string,
    modelId: string,
    config: VideoGenerationConfig
): Promise<string | null> => {
    const size = config.aspectRatio === '9:16' ? '720x1280' : '1280x720';
    const requestBody: Record<string, any> = {
        model: modelId,
        prompt: config.prompt,
        n: 1,
        size,
    };

    if (config.startFrame) {
        requestBody.image = config.startFrame;
        requestBody.input_image = config.startFrame;
    }

    const submitPlans: OpenAIAuthMode[] = ['bearer', 'query'];
    let lastError: any = null;

    for (const authMode of submitPlans) {
        try {
            const submitUrl = buildOpenAIUrl(baseUrl, '/v1/videos/generations', authMode, apiKey);
            const submitHeaders = buildOpenAIHeaders(authMode, apiKey);
            console.log(`[generateVideo/openai] POST [${authMode}] ${submitUrl.replace(apiKey, '***')}`);

            const submitRes = await fetchWithResilience(submitUrl, {
                method: 'POST',
                headers: submitHeaders,
                body: JSON.stringify(requestBody),
            }, { operation: 'generateVideo.openaiSubmit', retries: 0 });

            if (!submitRes.ok) {
                const errText = await submitRes.text().catch(() => '');
                const err: any = new Error(`openai video submit ${submitRes.status} [${authMode}]: ${errText}`);
                err.status = submitRes.status;
                lastError = err;
                if (shouldTryAlternateAuth(submitRes.status)) {
                    continue;
                }
                throw err;
            }

            const submitData = await submitRes.json();
            const directUrl = parseVideoUrlFromAnyPayload(submitData);
            if (directUrl) return directUrl;

            const taskId = submitData?.id || submitData?.task_id || submitData?.data?.[0]?.id;
            if (!taskId) {
                lastError = new Error(`openai video submit succeeded but no task id: ${JSON.stringify(submitData).slice(0, 200)}`);
                continue;
            }

            const pollPaths = [
                `/v1/videos/${taskId}`,
                `/v1/videos/generations/${taskId}`,
                `/v1/tasks/${taskId}`,
            ];

            for (let i = 0; i < 60; i++) {
                await new Promise(resolve => setTimeout(resolve, 5000));

                for (const pollPath of pollPaths) {
                    try {
                        const pollUrl = buildOpenAIUrl(baseUrl, pollPath, authMode, apiKey);
                        const pollHeaders = buildOpenAIHeaders(authMode, apiKey);
                        const pollRes = await fetchWithResilience(pollUrl, { headers: pollHeaders }, { operation: 'generateVideo.openaiPoll', retries: 1 });
                        if (!pollRes.ok) continue;
                        const pollData = await pollRes.json();

                        const doneUrl = parseVideoUrlFromAnyPayload(pollData);
                        if (doneUrl) return doneUrl;

                        const status = (pollData?.status || pollData?.state || pollData?.data?.[0]?.status || '').toLowerCase();
                        if (status === 'failed' || status === 'error' || status === 'cancelled' || status === 'canceled') {
                            throw new Error(`openai video polling failed: ${JSON.stringify(pollData).slice(0, 200)}`);
                        }
                    } catch (pollError) {
                        lastError = pollError;
                    }
                }
            }

            lastError = new Error('openai video polling timeout');
        } catch (error) {
            lastError = error;
            if (!isNetworkFetchError(error)) {
                const status = (error as any)?.status;
                if (status && !shouldTryAlternateAuth(status)) {
                    break;
                }
            }
        }
    }

    if (lastError) throw lastError;
    return null;
};

// Helper for retry logic
const retryWithBackoff = async <T>(
    fn: () => Promise<T>,
    retries: number = 4,
    delay: number = 1000,
    factor: number = 2
): Promise<T> => {
    try {
        return await fn();
    } catch (error: any) {
        const statusCode = error.status || error.code || error.httpCode;
        const msg = error.message || '';
        const normalizedMsg = String(msg).toLowerCase();

        // 可重试的错误：503（过载）、500（服务器错误）、429（限流）、网络错误
        const isRetryable =
            statusCode === 503 ||
            statusCode === 500 ||
            statusCode === 429 ||
            normalizedMsg.includes('overloaded') ||
            normalizedMsg.includes('unavailable') ||
            normalizedMsg.includes('503') ||
            normalizedMsg.includes('500') ||
            normalizedMsg.includes('429') ||
            normalizedMsg.includes('resource_exhausted') ||
            normalizedMsg.includes('rate limit') ||
            normalizedMsg.includes('too many requests') ||
            normalizedMsg.includes('internal server error') ||
            normalizedMsg.includes('fetch failed') ||
            normalizedMsg.includes('failed to fetch') ||
            normalizedMsg.includes('err_connection_reset') ||
            normalizedMsg.includes('connection reset') ||
            normalizedMsg.includes('network') ||
            normalizedMsg.includes('load failed');

        if (retries > 0 && isRetryable) {
            // 429 限流时使用更长的延迟
            const actualDelay = (statusCode === 429 || normalizedMsg.includes('429') || normalizedMsg.includes('rate limit'))
                ? Math.max(delay, 3000)
                : delay;
            console.warn(`[API重试] 错误码=${statusCode || 'unknown'}, ${actualDelay}ms 后重试... (剩余 ${retries} 次)`);
            await new Promise(resolve => setTimeout(resolve, actualDelay));
            return retryWithBackoff(fn, retries - 1, actualDelay * factor, factor);
        }
        throw error;
    }
};

const extractStatusCode = (error: any): number | undefined => {
    return error?.status || error?.code || error?.httpCode;
};

export const createChatSession = (
    model?: string,
    history: Content[] = [],
    systemInstruction?: string,
    providerId?: string | null,
): Chat => {
    const bestTextModel = getBestModelSelection('text');
    const resolvedModel = String(model || bestTextModel.modelId || FLASH_MODEL).trim() || FLASH_MODEL;
    const resolvedProviderId = providerId !== undefined ? providerId : bestTextModel.providerId || null;
    const resolvedSystemInstruction = systemInstruction || `You are XcAISTUDIO, an expert AI design assistant. You help users create posters, branding, and design elements.
      
      CRITICAL OUTPUT RULE:
      When you suggest visual designs or when the user asks for a design plan, YOU MUST provide specific actionable generation options.
      Do not just describe them in text. You MUST output a structured JSON block for each option so the user can click to generate it.
      
      Format:
      \`\`\`json:generation
      {
        "title": "Design Style Name (e.g. Minimalist Blue)",
        "description": "Short explanation of this style",
        "prompt": "The full detailed prompt for image generation..."
      }
      \`\`\`
      
      You can output multiple blocks. Keep the "title" short.`;

    const provider = getProviderConfigById(resolvedProviderId);
    const baseUrl = normalizeUrl(provider.baseUrl || '');
    const isGoogleDirect = provider.id === 'gemini' || !baseUrl || baseUrl.includes('googleapis.com');

    if (isGoogleDirect) {
        return getClient(resolvedProviderId).chats.create({
            model: resolvedModel,
            history: history,
            config: {
                systemInstruction: resolvedSystemInstruction,
                temperature: 0.7
            },
        });
    }

    return {
        __mode: 'openai',
        model: resolvedModel,
        providerId: resolvedProviderId,
        history: history || [],
        systemInstruction: resolvedSystemInstruction,
    } as OpenAIChatSession as any;
};

export const fileToPart = async (file: File): Promise<Part> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        // Determine mime type manually if missing (common for some windows configs)
        let mimeType = file.type;
        const ext = file.name.split('.').pop()?.toLowerCase();

        if (!mimeType) {
            if (ext === 'pdf') mimeType = 'application/pdf';
            else if (ext === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            else if (ext === 'doc') mimeType = 'application/msword';
            else if (ext === 'md') mimeType = 'text/markdown';
            else if (ext === 'txt') mimeType = 'text/plain';
            else if (ext === 'png') mimeType = 'image/png';
            else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
            else if (ext === 'webp') mimeType = 'image/webp';
        }

        // Treat markdown and text as text parts
        if (mimeType === 'text/markdown' || mimeType === 'text/plain' || ext === 'md') {
            reader.onloadend = () => {
                resolve({ text: reader.result as string });
            };
            reader.readAsText(file);
        } else {
            // Treat others (images, pdf, docx) as inlineData (base64)
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                resolve({
                    inlineData: {
                        data: base64String,
                        mimeType: mimeType || 'application/octet-stream'
                    }
                });
            };
            reader.readAsDataURL(file);
        }
        reader.onerror = reject;
    });
};

export const sendMessage = async (
    chat: ChatSession,
    message: string,
    attachments: File[] = [],
    enableWebSearch: boolean = false
): Promise<string> => {
    try {
        const parts: Part[] = [];

        // Add text if present
        if (message.trim()) {
            parts.push({ text: message });
        }

        // Add attachments
        for (const file of attachments) {
            const part = await fileToPart(file);
            parts.push(part);
        }

        if (parts.length === 0) return "";

        const isOpenAIChat = (chat as OpenAIChatSession)?.__mode === 'openai';

        if (isOpenAIChat) {
            const openAIChat = chat as OpenAIChatSession;
            const provider = getProviderConfigById(openAIChat.providerId);
            const baseUrl = normalizeUrl(provider.baseUrl || '');
            const apiKey = requireApiKey('sendMessage', openAIChat.providerId);

            const openAIContent = toOpenAIMessageContent(parts as any);
            const historyMessages = (openAIChat.history || []).flatMap((item) => {
                const role = item.role === 'model' ? 'assistant' : 'user';
                const textParts = (item.parts || [])
                    .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
                    .filter(Boolean)
                    .join('\n');
                if (!textParts) return [];
                return [{ role, content: [{ type: 'text', text: textParts }] }];
            });

            const requestMessages: any[] = [
                { role: 'system', content: [{ type: 'text', text: openAIChat.systemInstruction }] },
                ...historyMessages,
                { role: 'user', content: openAIContent },
            ];

            let response: any;
            const primaryBody = {
                model: openAIChat.model,
                temperature: 0.7,
                messages: requestMessages,
            };

            try {
                response = await fetchOpenAIJsonWithFallback<any>(
                    baseUrl,
                    '/v1/chat/completions',
                    apiKey,
                    primaryBody,
                    'sendMessage'
                );
            } catch (error) {
                if (!isImageInputUnsupportedError(error)) throw error;

                const fallbackMessages = requestMessages.map((m) => {
                    if (m.role !== 'user') return m;
                    return {
                        ...m,
                        content: stripImageContent(m.content || [])
                    };
                });

                response = await fetchOpenAIJsonWithFallback<any>(
                    baseUrl,
                    '/v1/chat/completions',
                    apiKey,
                    {
                        ...primaryBody,
                        messages: fallbackMessages,
                    },
                    'sendMessage.textOnlyFallback'
                );
            }

            const text = response?.choices?.[0]?.message?.content || 'I processed your request.';

            openAIChat.history.push({ role: 'user', parts: [{ text: message }] } as any);
            openAIChat.history.push({ role: 'model', parts: [{ text }] } as any);
            return text;
        }

        const config: any = {};
        if (enableWebSearch) {
            config.tools = [{ googleSearch: {} }];
        }

        const result: GenerateContentResponse = await retryWithBackoff(() => (chat as Chat).sendMessage({
            message: parts,
            config
        }));

        let text = result.text || "I processed your request.";

        const groundingChunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks && groundingChunks.length > 0) {
            const sources = groundingChunks
                .map((chunk: any) => {
                    if (chunk.web) {
                        return `[${chunk.web.title}](${chunk.web.uri})`;
                    }
                    return null;
                })
                .filter(Boolean);

            if (sources.length > 0) {
                text += `\n\n**Sources:**\n${sources.map((s: string) => `- ${s}`).join('\n')}`;
            }
        }

        return text;
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "Sorry, I encountered an error while processing your request. Please ensure the file types are supported.";
    }
};

export const analyzeImageRegion = async (imageBase64: string): Promise<string> => {
    try {
        const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);
        if (!matches) throw new Error("Invalid base64 image");

        const response = await retryWithBackoff<GenerateContentResponse>(() => getClient().models.generateContent({
            model: FLASH_MODEL,
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: matches[1],
                            data: matches[2]
                        }
                    },
                    {
                        text: "请用中文简要描述这个画面区域的主体（例如：一只猫、红色杯子）。只输出主体名称，不要任何废话，不超过5个字。"
                    }
                ]
            }
        }));

        return response.text || "Analysis failed.";
    } catch (error) {
        console.error("Analysis Error:", error);
        return "Could not analyze selection.";
    }
};

/**
 * Refines an image prompt by first analyzing the source image using a text model
 * (Flash) and then returning a detailed description suitable for image generation.
 */
export const refineImagePrompt = async (imageBase64: string, frameworkPrompt: string): Promise<string> => {
    try {
        const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);
        if (!matches) throw new Error("Invalid base64 image");

        console.log(`[refiningPrompt] Analyzing image with Flash model using framework...`);
        const response = await retryWithBackoff<GenerateContentResponse>(() => getClient().models.generateContent({
            model: FLASH_MODEL,
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: matches[1],
                            data: matches[2]
                        }
                    },
                    {
                        text: `${frameworkPrompt}\n\n请严格按上述框架深度解析此图，并在此解析的基础上输出一段用于 AI 绘画的高质量、细节极其丰富的英文提示词。`
                    }
                ]
            }
        }));

        const resultText = response.text || "";
        // Try to extract the prompt part if the model structured its response
        // If not, use the whole text (it will be descriptive)
        return resultText;
    } catch (error) {
        console.error("Prompt Refinement Error:", error);
        throw error;
    }
};

export const extractTextFromImage = async (imageBase64: string): Promise<string[]> => {
    try {
        const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);
        if (!matches) throw new Error("Invalid base64 image");

        const response = await retryWithBackoff<GenerateContentResponse>(() => getClient().models.generateContent({
            model: FLASH_MODEL,
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: matches[1],
                            data: matches[2]
                        }
                    },
                    {
                        text: "Identify all the visible text in this image. Return the result as a JSON array of strings. If there is no text, return an empty array."
                    }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        }));

        if (response.text) {
            return JSON.parse(response.text);
        }
        return [];
    } catch (error) {
        console.error("Extract Text Error:", error);
        return [];
    }
};

export const analyzeProductSwapScene = async (imageBase64: string): Promise<string> => {
    try {
        const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);
        if (!matches) throw new Error("Invalid base64 image");

        const response = await retryWithBackoff<GenerateContentResponse>(() => getClient().models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: matches[1],
                            data: matches[2]
                        }
                    },
                    {
                        text: "分析场景：识别旧产品位置、光源方向、环境纹理等。以详细自然语言描述场景，为后续AI图像生成(产品替换)准备描述参考"
                    }
                ]
            }
        }));

        if (response.text) {
            return response.text;
        }
        return "";
    } catch (error) {
        console.error("Analyze Scene Error:", error);
        return "";
    }
};

export interface ImageGenerationConfig {
    prompt: string;
    model:
        | 'Nano Banana Pro'
        | 'NanoBanana2'
        | 'Nano Banana 2'
        | 'Seedream5.0'
        | 'Seedream 5.0'
        | 'Seedream 4'
        | 'GPT Image 2'
        | 'gpt-image-2'
        | 'GPT Image 1.5'
        | 'gpt-image-1.5-all'
        | 'Flux.2 Max';
    aspectRatio: string;
    imageSize?: '1K' | '2K' | '4K';
    imageQuality?: 'low' | 'medium' | 'high';
    providerId?: string | null;
    disableTransportRetries?: boolean;
    referenceImage?: string; // base64 (legacy)
    referenceImages?: string[]; // Multiple base64 images
    maskImage?: string;
    referenceStrength?: number;
    referencePriority?: 'first' | 'all';
    referenceMode?: 'style' | 'product';
      referenceRoleMode?: 'none' | 'default' | 'poster-product' | 'custom';
    promptLanguagePolicy?: 'original-zh' | 'translate-en';
    textPolicy?: {
        enforceChinese?: boolean;
        requiredCopy?: string;
    };
    consistencyContext?: {
        approvedAssetIds?: string[];
        subjectAnchors?: string[];
        referenceSummary?: string;
        forbiddenChanges?: string[];
    };
}

export interface ImageEditConfig {
    sourceImage: string;
    prompt: string;
    model?: string;
    aspectRatio?: string;
    imageSize?: '1K' | '2K' | '4K';
    providerId?: string | null;
    maskImage?: string;
    referenceImages?: string[];
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const strengthToRepeats = (strength: number): number => {
    if (strength >= 0.85) return 3;
    if (strength >= 0.65) return 2;
    return 1;
};

const buildConstrainedPrompt = (
    userPrompt: string,
    opts: {
        strength: number;
        mode: 'style' | 'product';
        referenceRoleMode?: 'none' | 'default' | 'poster-product' | 'custom';
        referenceCount?: number;
        priority?: 'first' | 'all';
        forbiddenChanges?: string[];
        approvedSummary?: string;
    },
): string => {
    const hard = opts.strength >= 0.7;
    const referenceCount = Math.max(0, opts.referenceCount || 0);
    const multiReference = referenceCount > 1;
    const isPosterProductMode =
        opts.referenceRoleMode === 'poster-product' && referenceCount >= 2;

    if (isPosterProductMode) {
        const approvedContext = opts.approvedSummary
            ? `
[Approved Anchor]
- Continue from the latest approved result as the current design baseline.
- Approved summary: ${opts.approvedSummary}
`
            : '';

        const forbiddenSection = opts.forbiddenChanges && opts.forbiddenChanges.length > 0
            ? `
[Forbidden Changes]
${opts.forbiddenChanges.map((item) => `- ${item}`).join('\n')}
`
            : '';

        return `
[Poster Reconstruction Mode]
- Reference image 1 is the poster/layout anchor.
- Reference image 2 is the product identity anchor.
- Rebuild the overall poster composition, framing, camera angle, background style, lighting direction, text-safe empty space, and design language from reference image 1 as closely as possible.
- Replace only the main product/hero subject in reference image 1 with the product from reference image 2.
- Keep the product from reference image 2 exact in silhouette, structure, proportions, color family, materials, logos, placement, and distinctive details.
- Do not create a brand-new composition.
- Do not merge both references into a different scene.
- If there is any conflict, preserve poster layout/style from reference image 1 and preserve product identity/details from reference image 2.
- Any additional references beyond the first two are supporting detail only and must not override those role assignments.
${approvedContext}${forbiddenSection}
[Do Not]
- Do not redesign the poster structure.
- Do not replace the composition with a generic ad layout.
- Do not change the product type, shape, or key details.
- Do not drift away from the visual hierarchy of reference image 1.

[User Request]
${userPrompt}`.trim();
    }

    const constraints = opts.mode === 'product'
        ? `
[Consistency Requirements]
- Keep product silhouette, cut, structure, color family, material texture, and major details consistent with references.
- Do not add/remove logos, stitching lines, trims, or hardware when they are visible.
- Preserve relative logo placement and key detailing when visible in references.
- Allowed changes: background, ambience, props, and composition only.
`
        : `
[Style Requirements]
- Keep visual style, color language, and composition tendency aligned with references.
- Preserve the overall mood and design direction across outputs.
`;

    const referenceInstructions = multiReference
        ? `
[Multi-Reference Policy]
- Treat all reference images as the same subject shown from different angles or with complementary details.
- Synthesize identity using ALL references together instead of copying only the first image.
- If references conflict, prioritize silhouette, logo placement, signature details, material texture, and core color family.
- Merge the strongest consistent traits across all references into one coherent final subject.
`
        : opts.priority === 'first'
            ? `
[Reference Priority]
- The first reference is the primary identity anchor.
- Secondary references may add detail, but must not override the main subject identity.
`
            : '';

    const negatives = hard
        ? `
[Do Not]
- Do not change product type or core shape.
- Do not drift to a different SKU-like design.
- Do not over-stylize and lose material realism.
`
        : '';

    const approvedContext = opts.approvedSummary
        ? `
[Approved Anchor]
- Continue from the latest approved result as the current design baseline.
- Approved summary: ${opts.approvedSummary}
`
        : '';

    const forbiddenSection = opts.forbiddenChanges && opts.forbiddenChanges.length > 0
        ? `
[Forbidden Changes]
${opts.forbiddenChanges.map((item) => `- ${item}`).join('\n')}
`
        : '';

    return `${constraints}${referenceInstructions}${approvedContext}${forbiddenSection}${negatives}
[User Request]
${userPrompt}`.trim();
};

const buildReferenceGroundingPrompt = (
    userPrompt: string,
    opts: {
        referenceCount?: number;
    },
): string => {
    const referenceCount = Math.max(0, opts.referenceCount || 0);
    const inferredReferenceRoles = inferExplicitReferenceRoleAssignment(
        userPrompt,
        referenceCount,
    );
    const multiReferenceSection = referenceCount >= 2
        ? `
[Multiple Reference Handling]
- Read all reference images together instead of randomly following only one image.
- If the user assigns different roles to different references, follow that assignment exactly.
- Do not swap reference roles or ignore the product identity reference.
`
        : '';
    const explicitRoleSection = inferredReferenceRoles
        ? `
[Explicit Reference Role Assignment]
- The user explicitly assigned different roles to the references.
- Reference image ${inferredReferenceRoles.layoutReferenceIndex} is the layout/style/composition anchor.
- Reference image ${inferredReferenceRoles.productReferenceIndex} is the product identity and branding anchor.
- Keep the overall poster/layout direction from reference image ${inferredReferenceRoles.layoutReferenceIndex}, while preserving the product shape, packaging, brand spelling, logo placement, and key details from reference image ${inferredReferenceRoles.productReferenceIndex}.
- Do not replace the assigned product brand with unrelated new branding.
`
        : '';

    return `
[Reference Grounding]
- Do not apply any hidden style-library preset or extra composition template beyond the user's own request.
- Follow the user's written instruction as the only creative directive.
- Keep the main product identity faithful to the relevant reference image(s).
- Preserve visible brand name, logo spelling, packaging layout, silhouette, proportions, materials, colors, and signature details unless the user explicitly asks to change them.
- Do not invent a new brand, replace the visible logo with another brand, or redesign the product into a different SKU-like object.
- If exact brand text cannot be rendered perfectly, prefer keeping the original packaging structure and brand placement rather than replacing it with unrelated new branding.
${multiReferenceSection}${explicitRoleSection}
[User Request]
${userPrompt}`.trim();
};

const normalizePromptForReferenceRoleParsing = (value: string): string =>
    String(value || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

const REF1_ALIASES = [
    '参考图一', '参考图1', '图一', '图1', '第一张', '第1张', '第一幅', '第1幅',
    'ref1', 'ref 1', 'reference1', 'reference 1', 'image1', 'image 1',
];

const REF2_ALIASES = [
    '参考图二', '参考图2', '图二', '图2', '第二张', '第2张', '第二幅', '第2幅',
    'ref2', 'ref 2', 'reference2', 'reference 2', 'image2', 'image 2',
];

const LAYOUT_ROLE_CUES = [
    '海报', '构图', '版式', '排版', '布局', '画面', '风格', '样式', '氛围', 'style', 'layout', 'composition', 'poster',
];

const PRODUCT_ROLE_CUES = [
    '产品', '商品', '主体', '包装', '瓶子', '瓶身', '品牌', 'logo', '标志', '主物', 'product', 'brand', 'packaging',
];

const findOccurrences = (text: string, needles: string[]): number[] => {
    const hits: number[] = [];
    for (const needle of needles) {
        let startIndex = 0;
        while (startIndex < text.length) {
            const hitIndex = text.indexOf(needle, startIndex);
            if (hitIndex === -1) break;
            hits.push(hitIndex);
            startIndex = hitIndex + needle.length;
        }
    }
    return hits;
};

const hasAliasCueProximity = (
    text: string,
    aliases: string[],
    cues: string[],
    maxDistance = 28,
): boolean => {
    const aliasHits = findOccurrences(text, aliases);
    const cueHits = findOccurrences(text, cues);
    if (aliasHits.length === 0 || cueHits.length === 0) {
        return false;
    }
    for (const aliasHit of aliasHits) {
        for (const cueHit of cueHits) {
            if (Math.abs(aliasHit - cueHit) <= maxDistance) {
                return true;
            }
        }
    }
    return false;
};

const hasAnyAlias = (text: string, aliases: string[]): boolean =>
    aliases.some((alias) => text.includes(alias));

const inferExplicitReferenceRoleAssignment = (
    userPrompt: string,
    referenceCount: number,
): {
    layoutReferenceIndex: 1 | 2;
    productReferenceIndex: 1 | 2;
} | null => {
    if (referenceCount < 2) {
        return null;
    }

    const prompt = normalizePromptForReferenceRoleParsing(userPrompt);
    if (!prompt) {
        return null;
    }

    const ref1Mentioned = hasAnyAlias(prompt, REF1_ALIASES);
    const ref2Mentioned = hasAnyAlias(prompt, REF2_ALIASES);
    if (!ref1Mentioned || !ref2Mentioned) {
        return null;
    }

    const ref1Layout = hasAliasCueProximity(prompt, REF1_ALIASES, LAYOUT_ROLE_CUES);
    const ref1Product = hasAliasCueProximity(prompt, REF1_ALIASES, PRODUCT_ROLE_CUES);
    const ref2Layout = hasAliasCueProximity(prompt, REF2_ALIASES, LAYOUT_ROLE_CUES);
    const ref2Product = hasAliasCueProximity(prompt, REF2_ALIASES, PRODUCT_ROLE_CUES);

    const explicitPattern12 =
        /(?:参考图[一1]|图[一1]|第[一1]张).{0,24}(?:海报|构图|版式|布局|风格|样式|画面|poster|layout|composition|style)/i.test(prompt) ||
        /(?:用|把|换成|替换成).{0,12}(?:参考图[二2]|图[二2]|第[二2]张|ref ?2|reference ?2).{0,12}(?:产品|商品|主体|包装|品牌|logo|product|brand|packaging)/i.test(prompt);

    const explicitPattern21 =
        /(?:参考图[二2]|图[二2]|第[二2]张).{0,24}(?:海报|构图|版式|布局|风格|样式|画面|poster|layout|composition|style)/i.test(prompt) ||
        /(?:用|把|换成|替换成).{0,12}(?:参考图[一1]|图[一1]|第[一1]张|ref ?1|reference ?1).{0,12}(?:产品|商品|主体|包装|品牌|logo|product|brand|packaging)/i.test(prompt);

    if ((ref1Layout && ref2Product) || (explicitPattern12 && !ref2Layout)) {
        return {
            layoutReferenceIndex: 1,
            productReferenceIndex: 2,
        };
    }

    if ((ref2Layout && ref1Product) || (explicitPattern21 && !ref1Layout)) {
        return {
            layoutReferenceIndex: 2,
            productReferenceIndex: 1,
        };
    }

    return null;
};

const buildEditPrompt = (prompt: string, hasMask: boolean): string => {
    const maskRule = hasMask
        ? `
[Mask Rule]
- The second image is a binary mask.
- White area means editable region.
- Black area means locked region and must stay unchanged.
- Seamlessly blend edited area with surrounding pixels.
`
        : '';

    return `${maskRule}
[Edit Goal]
${prompt}

[Hard Constraints]
- Keep identity, product structure, and non-edited regions unchanged.
- Preserve camera perspective and global composition unless explicitly requested.
`.trim();
};

const CHINESE_CHAR_RE = /[\u3400-\u9FFF]/;

const translatePromptToEnglish = async (prompt: string): Promise<string> => {
    const source = String(prompt || '').trim();
    if (!source) return source;
    if (!CHINESE_CHAR_RE.test(source)) return source;

    try {
        const response = await retryWithBackoff<GenerateContentResponse>(() =>
            getClient().models.generateContent({
                model: FLASH_MODEL,
                contents: {
                    parts: [{
                        text: `Translate the following image-generation prompt into natural, high-fidelity English. Keep all visual details and constraints unchanged. Return only the translated prompt text, no explanation:\n\n${source}`
                    }]
                },
                config: {
                    temperature: 0.2,
                },
            }),
        );

        const translated = String(response?.text || '').trim();
        return translated || source;
    } catch (error: any) {
        console.warn('[imggen] translate prompt failed, fallback to original prompt:', error?.message || error);
        return source;
    }
};

const buildTextPolicySuffix = (
    textPolicy?: {
        enforceChinese?: boolean;
        requiredCopy?: string;
    },
): string => {
    const enforceChinese = textPolicy?.enforceChinese !== false;
    const requiredCopy = String(textPolicy?.requiredCopy || '').trim();

    const rules: string[] = ['[Text Rendering Rules]'];
    if (enforceChinese) {
        rules.push('- Any visible text in the generated image must be Simplified Chinese only. Do not render English letters, pinyin, or mixed-language text.');
    } else {
        rules.push('- If visible text is needed, prefer Simplified Chinese.');
    }

    if (requiredCopy) {
        rules.push(`- The visible text must exactly match this copy: "${requiredCopy}". Do not add, remove, paraphrase, or translate any character.`);
    }

    return rules.join('\n');
};

const isOpenAICompatibleImageModel = (model: string): boolean => {
    const normalized = String(model || '').trim().toLowerCase();
    return normalized === 'gpt-image-2'
        || normalized === 'gpt image 2'
        || normalized === 'gpt-image-1.5-all'
        || normalized === 'gpt image 1.5'
        || normalized.startsWith('gpt-image-')
        || normalized.includes('gpt-image-2')
        || normalized.includes('gpt image 2')
        || normalized.includes('gpt-image-1.5')
        || normalized.includes('gpt image 1.5');
};

const normalizeOpenAICompatibleImageModelId = (model: string): string => {
    const normalized = String(model || '').trim().toLowerCase();
    if (!normalized) return '';
    if (normalized.includes('gpt-image-2') || normalized.includes('gpt image 2')) {
        return 'gpt-image-2';
    }
    if (
        normalized.includes('gpt-image-1.5-all')
        || normalized.includes('gpt image 1.5')
        || normalized.includes('gpt-image-1.5')
    ) {
        return 'gpt-image-1.5-all';
    }
    return String(model || '').trim();
};

type OpenAIImageRequestMode = 'standard-openai' | 'reverse-compat' | 'official-transfer';

const getOpenAIImageRequestMode = (
    model: string,
    imageSize?: '1K' | '2K' | '4K',
): OpenAIImageRequestMode => {
    const normalizedModel = normalizeOpenAICompatibleImageModelId(model);
    if (normalizedModel === 'gpt-image-2' && imageSize && imageSize !== '1K') {
        return 'official-transfer';
    }
    if (normalizedModel === 'gpt-image-2') {
        return 'reverse-compat';
    }
    return 'standard-openai';
};

const normalizeOpenAIImageAspectRatio = (aspectRatio: string): string => {
    const normalized = String(aspectRatio || '').trim();
    if (
        normalized === '1:1'
        || normalized === '3:4'
        || normalized === '4:3'
        || normalized === '9:16'
        || normalized === '16:9'
        || normalized === '2:3'
        || normalized === '3:2'
        || normalized === '4:5'
        || normalized === '5:4'
    ) {
        return normalized;
    }

    if (normalized === '21:9' || normalized === '8:1' || normalized === '4:1') {
        return '16:9';
    }
    if (normalized === '1:4' || normalized === '1:8') {
        return '9:16';
    }

    return '1:1';
};

const resolveOpenAIImageSize = (
    model: string,
    aspectRatio: string,
    imageSize?: '1K' | '2K' | '4K',
): string => {
    const ratio = normalizeOpenAIImageAspectRatio(aspectRatio);
    const preset = imageSize || '1K';
    const requestMode = getOpenAIImageRequestMode(model, preset);

    const map: Record<'1K' | '2K' | '4K', Record<string, string>> = {
        '1K': {
            '1:1': '1024x1024',
            '3:4': '768x1024',
            '4:3': '1024x768',
            '9:16': '864x1536',
            '16:9': '1536x864',
            '2:3': '1024x1536',
            '3:2': '1536x1024',
            '4:5': '1024x1280',
            '5:4': '1280x1024',
        },
        '2K': {
            '1:1': '1440x1440',
            '3:4': '1224x1632',
            '4:3': '1632x1224',
            '9:16': '1152x2048',
            '16:9': '2048x1152',
            '2:3': '1152x1728',
            '3:2': '1728x1152',
            '4:5': '1280x1600',
            '5:4': '1600x1280',
        },
        '4K': {
            '1:1': '2880x2880',
            '3:4': '2448x3264',
            '4:3': '3264x2448',
            '9:16': '2304x4096',
            '16:9': '4096x2304',
            '2:3': '2304x3456',
            '3:2': '3456x2304',
            '4:5': '2560x3200',
            '5:4': '3200x2560',
        },
    };

    if (requestMode === 'reverse-compat') {
        return map['1K'][ratio] || map['1K']['1:1'];
    }

    return map[preset][ratio] || map[preset]['1:1'];
};

const mimeTypeToFileExtension = (mimeType: string): string => {
    const normalized = String(mimeType || '').toLowerCase();
    if (normalized.includes('png')) return 'png';
    if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
    if (normalized.includes('webp')) return 'webp';
    return 'bin';
};

const dataUrlToFilePayload = (
    dataUrl: string,
    fallbackName: string,
): { blob: Blob; filename: string } | null => {
    const match = String(dataUrl || '').match(/^data:(.+);base64,(.+)$/);
    if (!match) return null;

    const mimeType = match[1];
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return {
        blob: new Blob([bytes], { type: mimeType }),
        filename: `${fallbackName}.${mimeTypeToFileExtension(mimeType)}`,
    };
};

const estimateDataUrlBytes = (dataUrl: string): number => {
    const match = String(dataUrl || '').match(/^data:(.+);base64,(.+)$/);
    if (!match) return 0;
    const base64 = match[2];
    const padding = (base64.match(/=*$/)?.[0]?.length || 0);
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
};

const extractOpenAIImageResult = (payload: any): string | null => {
    const first = Array.isArray(payload?.data) ? payload.data[0] : null;
    if (!first) return null;

    if (typeof first?.b64_json === 'string' && first.b64_json) {
        return `data:image/png;base64,${first.b64_json}`;
    }
    if (typeof first?.url === 'string' && first.url) {
        return first.url;
    }
    if (typeof first?.b64 === 'string' && first.b64) {
        return `data:image/png;base64,${first.b64}`;
    }
    if (typeof first === 'string' && first) {
        return first.startsWith('data:') ? first : `data:image/png;base64,${first}`;
    }

    return null;
};

const getOpenAIImageRequestTuning = (
    requestKind: 'edit' | 'generate',
    requestMode: OpenAIImageRequestMode,
    options?: {
        disableTransportRetries?: boolean;
    },
) => {
    const disableTransportRetries = options?.disableTransportRetries === true;
    const applyRetryMode = <T extends {
        retries: number;
        baseDelayMs: number;
        maxDelayMs: number;
    }>(tuning: T): T => {
        if (!disableTransportRetries) {
            return tuning;
        }

        return {
            ...tuning,
            retries: 0,
            baseDelayMs: 0,
            maxDelayMs: 0,
        };
    };

    if (requestKind === 'edit') {
        if (requestMode === 'official-transfer') {
            return applyRetryMode({
                authStrategy: 'bearer-only' as const,
                timeoutMs: 480000,
                idleTimeoutMs: 480000,
                retries: 5,
                baseDelayMs: 750,
                maxDelayMs: 12500,
            });
        }
        return applyRetryMode({
            authStrategy: 'bearer-only' as const,
            timeoutMs: 420000,
            idleTimeoutMs: 420000,
            retries: 4,
            baseDelayMs: 600,
            maxDelayMs: 10000,
        });
    }

    if (requestMode === 'official-transfer') {
        return applyRetryMode({
            authStrategy: 'bearer-only' as const,
            timeoutMs: 300000,
            idleTimeoutMs: 300000,
            retries: 4,
            baseDelayMs: 600,
            maxDelayMs: 10000,
        });
    }

    return applyRetryMode({
        authStrategy: 'bearer-only' as const,
        timeoutMs: 240000,
        idleTimeoutMs: 240000,
        retries: 3,
        baseDelayMs: 500,
        maxDelayMs: 7500,
    });
};

const buildOpenAIImageEditFormData = (opts: {
    model: string;
    prompt: string;
    size: string;
    quality?: 'low' | 'medium' | 'high';
    referenceImages: string[];
    maskImage?: string | null;
}): {
    formData: FormData;
    imageFieldName: string;
    referenceMimeTypes: string[];
    maskMimeType: string | null;
} => {
    const formData = new FormData();
    formData.append('model', opts.model);
    formData.append('prompt', opts.prompt);
    formData.append('size', opts.size);
    if (opts.quality) {
        formData.append('quality', opts.quality);
    }

    const imageFieldName = 'image';
    const referenceMimeTypes: string[] = [];
    opts.referenceImages.forEach((dataUrl, index) => {
        const filePayload = dataUrlToFilePayload(dataUrl, `image-${index + 1}`);
        if (filePayload) {
            formData.append(imageFieldName, filePayload.blob, filePayload.filename);
            referenceMimeTypes.push(filePayload.blob.type || 'application/octet-stream');
        }
    });

    let maskMimeType: string | null = null;
    if (opts.maskImage) {
        const maskPayload = dataUrlToFilePayload(opts.maskImage, 'mask');
        if (maskPayload) {
            formData.append('mask', maskPayload.blob, maskPayload.filename);
            maskMimeType = maskPayload.blob.type || 'application/octet-stream';
        }
    }

    return {
        formData,
        imageFieldName,
        referenceMimeTypes,
        maskMimeType,
    };
};

const requestOpenAICompatibleImage = async (opts: {
    model: string;
    prompt: string;
    aspectRatio: string;
    imageSize?: '1K' | '2K' | '4K';
    imageQuality?: 'low' | 'medium' | 'high';
    disableTransportRetries?: boolean;
    referenceImages?: string[];
    maskImage?: string | null;
    providerId?: string | null;
    contextTag: string;
}): Promise<string | null> => {
    const provider = getProviderConfigById(opts.providerId);
    const baseUrl = normalizeUrl(provider.baseUrl || 'https://api.openai.com');
    const apiKeys = getApiKeyByProviderId(opts.providerId, true);

    if (!Array.isArray(apiKeys) || apiKeys.length === 0) {
        throw new ProviderError({
            provider: provider.id || 'unknown',
            code: 'API_KEY_MISSING',
            retryable: false,
            stage: 'config',
            details: `missing_api_key:${opts.contextTag}`,
            message: 'API 密钥未配置，请先在设置中填写并保存可用密钥。',
        });
    }

    const normalizedReferences: string[] = [];
    for (const input of opts.referenceImages || []) {
        const normalized = await normalizeReferenceToModelInputDataUrl(input);
        if (normalized) normalizedReferences.push(normalized);
    }

    const normalizedMask = opts.maskImage
        ? await normalizeReferenceToDataUrl(opts.maskImage)
        : null;

    const route =
        normalizedReferences.length > 0 || normalizedMask
            ? '/v1/images/edits'
            : '/v1/images/generations';
    const isEditRequest = normalizedReferences.length > 0 || !!normalizedMask;
    const effectiveRoute =
        resolveImageModelPostPath({
            providerId: provider.id || opts.providerId || null,
            modelId: opts.model,
            hasReferences: isEditRequest,
        });
    const requestMode = getOpenAIImageRequestMode(opts.model, opts.imageSize);
    const size = resolveOpenAIImageSize(opts.model, opts.aspectRatio, opts.imageSize);
    const normalizedAspectRatio = normalizeOpenAIImageAspectRatio(opts.aspectRatio);
    const requestTuning = getOpenAIImageRequestTuning(isEditRequest ? 'edit' : 'generate', requestMode, {
        disableTransportRetries: opts.disableTransportRetries,
    });
    const referenceBytes = normalizedReferences.map((item) => estimateDataUrlBytes(item));
    const totalReferenceBytes = referenceBytes.reduce((sum, item) => sum + item, 0);
    const requestFingerprintMeta = buildImageRequestFingerprint({
        model: opts.model,
        route: effectiveRoute,
        size,
        aspectRatio: opts.aspectRatio,
        prompt: opts.prompt,
        providerId: provider.id || opts.providerId || null,
        referenceImages: normalizedReferences,
        maskImage: normalizedMask,
    });
    const requestTuningWithFingerprint = {
        ...(requestTuning || {}),
        requestFingerprint: requestFingerprintMeta.fingerprint,
    };
    const editFormMeta =
        isEditRequest
            ? buildOpenAIImageEditFormData({
                model: opts.model,
                prompt: opts.prompt,
                size,
                quality: opts.imageQuality,
                referenceImages: normalizedReferences,
                maskImage: normalizedMask,
            })
            : null;
    const imageFieldMode =
        isEditRequest
            ? normalizedReferences.length > 1
                ? 'multi-file-repeated-field'
                : 'single-file'
            : 'json';

    if (isVerboseOpenAIOperation(opts.contextTag)) {
        console.info(`[${opts.contextTag}] request summary`, {
            route: effectiveRoute,
            defaultRoute: route,
            model: opts.model,
            requestMode,
            reverseCompat: requestMode === 'reverse-compat',
            disableTransportRetries: opts.disableTransportRetries === true,
            aspectRatio: opts.aspectRatio,
            imageSize: opts.imageSize || '1K',
            imageQuality: opts.imageQuality || 'medium',
            size,
            providerId: provider.id || opts.providerId || null,
            requestFingerprint: requestFingerprintMeta.fingerprint,
            promptHash: requestFingerprintMeta.promptHash,
            referenceHash: requestFingerprintMeta.referenceHash,
            promptChars: opts.prompt.length,
            referenceCount: normalizedReferences.length,
            imageFieldMode,
            imageFieldName: editFormMeta?.imageFieldName || null,
            referenceMimeTypes: editFormMeta?.referenceMimeTypes || [],
            referenceBytes,
            totalReferenceBytes,
            referenceKinds: normalizedReferences.map((item) => item.startsWith('data:') ? 'data' : 'other'),
            hasMask: !!normalizedMask,
            maskMimeType: editFormMeta?.maskMimeType || null,
        });
    }

    if (isEditRequest) {
        if (isVerboseOpenAIOperation(opts.contextTag)) {
            console.info(`[${opts.contextTag}] form payload`, {
                model: opts.model,
                requestMode,
                providerId: provider.id || opts.providerId || null,
                requestFingerprint: requestFingerprintMeta.fingerprint,
                promptHash: requestFingerprintMeta.promptHash,
                referenceHash: requestFingerprintMeta.referenceHash,
                quality: opts.imageQuality || 'medium',
                imageFieldName: editFormMeta?.imageFieldName || 'image',
                imagePartCount: normalizedReferences.length,
                size,
                aspect_ratio: null,
                hasMask: !!normalizedMask,
                promptChars: opts.prompt.length,
            });
        }
        const payload = await fetchOpenAIFormWithFallback<any>(
            baseUrl,
            effectiveRoute,
            apiKeys,
            () => buildOpenAIImageEditFormData({
                model: opts.model,
                prompt: opts.prompt,
                size,
                quality: opts.imageQuality,
                referenceImages: normalizedReferences,
                maskImage: normalizedMask,
            }).formData,
            opts.contextTag,
            requestTuningWithFingerprint,
        );
        return extractOpenAIImageResult(payload);
    }

    const payload = await fetchOpenAIJsonWithFallback<any>(
        baseUrl,
        effectiveRoute,
        apiKeys,
        {
            model: opts.model,
            prompt: opts.prompt,
            size,
            quality: opts.imageQuality,
            aspect_ratio: normalizedAspectRatio,
        },
        opts.contextTag,
        requestTuningWithFingerprint,
    );

    return extractOpenAIImageResult(payload);
};

export const editImage = async (config: ImageEditConfig): Promise<string | null> => {
    const sourceDataUrl = await normalizeReferenceToDataUrl(config.sourceImage);
    if (!sourceDataUrl) {
        throw new Error('Invalid source image for edit');
    }

    const maskDataUrl = config.maskImage
        ? await normalizeReferenceToDataUrl(config.maskImage)
        : null;

    const refs: string[] = [];
    for (const input of config.referenceImages || []) {
        const normalized = await normalizeReferenceToModelInputDataUrl(input);
        if (normalized) refs.push(normalized);
    }

    const sourceMatch = sourceDataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!sourceMatch) {
        throw new Error('Invalid source image payload');
    }

    const parts: any[] = [
        {
            inlineData: {
                mimeType: sourceMatch[1],
                data: sourceMatch[2],
            },
        },
    ];

    if (maskDataUrl) {
        const maskMatch = maskDataUrl.match(/^data:(.+);base64,(.+)$/);
        if (maskMatch) {
            parts.push({
                inlineData: {
                    mimeType: maskMatch[1],
                    data: maskMatch[2],
                },
            });
        }
    }

    for (const ref of refs) {
        const match = ref.match(/^data:(.+);base64,(.+)$/);
        if (!match) continue;
        parts.push({
            inlineData: {
                mimeType: match[1],
                data: match[2],
            },
        });
    }

    const editPrompt = buildEditPrompt(config.prompt, !!maskDataUrl);
    parts.push({ text: editPrompt });

    const requestedModel = (config.model || IMAGE_PRO_MODEL).trim() || IMAGE_PRO_MODEL;
    const model = normalizeOpenAICompatibleImageModelId(requestedModel) || requestedModel;
    const aspectRatio = config.aspectRatio || '1:1';
    const requestMode = getOpenAIImageRequestMode(model, config.imageSize);

    console.info('[imgedit] route decision', {
        requestedModel,
        normalizedModel: model,
        requestMode,
        providerId: config.providerId || null,
        hasMask: !!maskDataUrl,
        referenceCount: refs.length + 1,
        useOpenAIImageRoute: isOpenAICompatibleImageModel(model),
    });

    if (isOpenAICompatibleImageModel(model)) {
        return requestOpenAICompatibleImage({
            contextTag: `editImage.${model}`,
            model,
            prompt: editPrompt,
            aspectRatio,
            imageSize: config.imageSize,
            referenceImages: [sourceDataUrl, ...refs],
            maskImage: maskDataUrl,
            providerId: config.providerId,
        });
    }

    console.info('[imgedit] request', {
        model,
        hasMask: !!maskDataUrl,
        refCount: refs.length,
        promptChars: editPrompt.length,
        providerId: config.providerId || null,
        providerBaseUrl: getApiUrl(config.providerId),
    });

    const response = await retryWithBackoff<GenerateContentResponse>(() =>
        getClient(config.providerId).models.generateContent({
            model,
            contents: { parts },
            config: {
                imageConfig: {
                    aspectRatio,
                },
            },
        }),
    );

    const outParts = response.candidates?.[0]?.content?.parts || [];
    for (const part of outParts) {
        if (part.inlineData?.data) {
            return `data:image/png;base64,${part.inlineData.data}`;
        }
    }

    return null;
};

// Seedream 使用 dall-e-3 格式 (OpenAI 兼容的 /v1/images/generations 端点)
const generateImageDallE3 = async (
    model: string,
    prompt: string,
    aspectRatio: string,
    providerId?: string | null,
): Promise<string | null> => {
    const baseUrl = normalizeUrl(getApiUrl(providerId) || 'https://yunwu.ai');
    const apiKey = requireApiKey('generateImageDallE3', providerId);
    const route = resolveImageModelPostPath({
        providerId,
        modelId: model,
        hasReferences: false,
    });

    // 将宽高比转换为 dall-e-3 支持的尺寸
    let size = '1024x1024';
    if (aspectRatio === '16:9') size = '1792x1024';
    else if (aspectRatio === '9:16') size = '1024x1792';
    else if (aspectRatio === '4:3') size = '1024x768';
    else if (aspectRatio === '3:4') size = '768x1024';

    console.log(`[generateImageDallE3] model=${model}, size=${size}`);

    let response: any;
    try {
        response = await retryWithBackoff(async () => {
            return fetchOpenAIJsonWithFallback<any>(
                baseUrl,
                route,
                apiKey,
                {
                    model,
                    prompt,
                    size,
                },
                'generateImageDallE3'
            );
        });
    } catch (error: any) {
        const status = extractStatusCode(error);
        throw new ProviderError({
            provider: getProviderConfigById(providerId).id || 'unknown',
            code: status === 401 || status === 403 ? 'AUTH_FAILED' : 'IMAGE_GENERATION_FAILED',
            status,
            retryable: status === 429 || status === 500 || status === 503,
            stage: 'generateRequest',
            details: error?.message,
            message: status === 401 || status === 403
                ? '图像生成鉴权失败，请检查 API Key。'
                : '图像生成请求失败，请稍后重试。'
        });
    }

    const b64 = response?.data?.[0]?.b64_json;
    if (b64) {
        console.log(`[generateImageDallE3] Success with model: ${model}`);
        return `data:image/png;base64,${b64}`;
    }

    // 如果返回的是 url 格式
    const url = response?.data?.[0]?.url;
    if (url) {
        console.log(`[generateImageDallE3] Got URL result from model: ${model}`);
        return url;
    }

    return null;
};

export const generateImage = async (config: ImageGenerationConfig): Promise<string | null> => {
    const references = config.referenceImages || (config.referenceImage ? [config.referenceImage] : []);
    const hasReferences = references.length > 0;
    const requestedModel = (config.model || '').trim();
    const normalizedRequestedModel = normalizeOpenAICompatibleImageModelId(requestedModel);
    const provider = getProviderConfigById(config.providerId);

    // Seedream 使用 dall-e-3 格式，走单独的路径
    if (
        (requestedModel === 'Seedream5.0' ||
            requestedModel === 'Seedream 5.0' ||
            requestedModel === 'Seedream 4') &&
        !hasReferences
    ) {
        try {
            const result = await generateImageDallE3(IMAGE_SEEDREAM_MODEL, config.prompt, config.aspectRatio, config.providerId);
            if (result) return result;
        } catch (error: any) {
            console.warn(`[generateImage] Seedream dall-e-3 failed:`, error.message || error);
        }
        // Seedream 失败后 fallback 到 Gemini 模型
        console.log(`[generateImage] Seedream failed, falling back to Gemini model`);
    }

    // 自动选择时固定优先使用 gemini-3-pro-image-preview。
    // 仅当调用方明确传入模型偏好时，才按该偏好路由。
    let targetModelId = IMAGE_PRO_MODEL;

    if (requestedModel && requestedModel !== 'Auto') {
        if (requestedModel === 'Nano Banana Pro') {
            targetModelId = IMAGE_PRO_MODEL;
        } else if (requestedModel === 'NanoBanana2' || requestedModel === 'Nano Banana 2') {
            targetModelId = IMAGE_NANOBANANA_2_MODEL;
        } else if (
            requestedModel === 'Seedream5.0' ||
            requestedModel === 'Seedream 5.0' ||
            requestedModel === 'Seedream 4'
        ) {
            targetModelId = IMAGE_SEEDREAM_MODEL;
        } else if (requestedModel.includes('1.5-flash')) {
            // 强制防止回退到云雾不支持的旧 ID
            targetModelId = IMAGE_PRO_MODEL;
        } else if (normalizedRequestedModel) {
            targetModelId = normalizedRequestedModel;
        } else {
            // 允许上层传入已是底层 ID 的模型
            targetModelId = requestedModel;
        }
    }

    // Concurrency check: If user has multi-key, the getApiKey() will handle its own poll.
    // Here we focus on model rotation.

    const modelsToTry = Array.from(new Set([targetModelId]));

    const isProxy = provider.id !== 'gemini' || (provider.baseUrl && !provider.baseUrl.includes('googleapis.com'));

    let validAspectRatio = config.aspectRatio;

    // Expand supported ratios for proxy-based models (Yunwu, etc.)
    const supported = isProxy
        ? ["1:1", "3:4", "4:3", "9:16", "16:9", "21:9", "3:2", "2:3", "5:4", "4:5", "8:1", "4:1", "1:4", "1:8"]
        : ["1:1", "3:4", "4:3", "9:16", "16:9"];

    if (!supported.includes(validAspectRatio)) {
        if (validAspectRatio === '21:9') validAspectRatio = '16:9';
        else if (validAspectRatio === '8:1') validAspectRatio = '16:9';
        else if (validAspectRatio === '4:1') validAspectRatio = '16:9';
        else if (validAspectRatio === '3:2') validAspectRatio = '16:9';
        else if (validAspectRatio === '2:3') validAspectRatio = '9:16';
        else if (validAspectRatio === '5:4') validAspectRatio = '4:3';
        else if (validAspectRatio === '4:5') validAspectRatio = '3:4';
        else if (validAspectRatio === '1:4') validAspectRatio = '9:16';
        else if (validAspectRatio === '1:8') validAspectRatio = '9:16';
        else validAspectRatio = '1:1';
    }

    // Prepare parts: Image(s) should generally come before or alongside text for multimodal models
    const parts: any[] = [];

    const strength = clamp01(Number.isFinite(config.referenceStrength as number) ? Number(config.referenceStrength) : 0.75);
    const mode = config.referenceMode || 'product';
    const priority = config.referencePriority || (references.length > 1 ? 'all' : 'first');
    const repeats = hasReferences && priority === 'first' ? strengthToRepeats(strength) : 1;

    const orderedReferences = priority === 'first'
        ? references
        : references;

    const referencesToInject: string[] = [];
    if (orderedReferences[0] && priority === 'first') {
        for (let i = 0; i < repeats; i += 1) {
            referencesToInject.push(orderedReferences[0]);
        }
        referencesToInject.push(...orderedReferences.slice(1));
    } else {
        referencesToInject.push(...orderedReferences);
    }

    for (const imageInput of referencesToInject) {
        const normalizedDataUrl = await normalizeReferenceToModelInputDataUrl(imageInput);
        if (!normalizedDataUrl) continue;
        const matches = normalizedDataUrl.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
            parts.push({
                inlineData: {
                    mimeType: matches[1],
                    data: matches[2]
                }
            });
        }
    }

    const consistencyContext = config.consistencyContext || {};
    const shouldDisableHiddenConstraints = config.referenceRoleMode === 'none';
    const basePrompt = shouldDisableHiddenConstraints
        ? hasReferences
            ? buildReferenceGroundingPrompt(config.prompt, {
                referenceCount: references.length,
            })
            : config.prompt
        : hasReferences || consistencyContext?.forbiddenChanges?.length || consistencyContext?.referenceSummary
        ? buildConstrainedPrompt(config.prompt, {
            strength,
            mode,
            referenceRoleMode: config.referenceRoleMode,
            referenceCount: references.length,
            priority,
            forbiddenChanges: consistencyContext?.forbiddenChanges,
            approvedSummary: consistencyContext?.referenceSummary,
        })
        : config.prompt;

    const policy = config.promptLanguagePolicy || 'original-zh';
    const languageAdjustedPrompt = policy === 'translate-en'
        ? await translatePromptToEnglish(basePrompt)
        : basePrompt;
    const textPolicySuffix = buildTextPolicySuffix(config.textPolicy);
    const finalPrompt = `${languageAdjustedPrompt}\n\n${textPolicySuffix}`.trim();
    const useOpenAIImageRoute = isOpenAICompatibleImageModel(targetModelId) || isOpenAICompatibleImageModel(requestedModel);
    const openAIImageRequestMode = useOpenAIImageRoute
        ? getOpenAIImageRequestMode(targetModelId, config.imageSize)
        : null;

    console.info('[imggen] route decision', {
        requestedModel,
        normalizedRequestedModel: normalizedRequestedModel || null,
        targetModelId,
        requestMode: openAIImageRequestMode,
        providerId: config.providerId || null,
        providerBaseUrl: provider.baseUrl || null,
        hasReferences,
        referenceCount: references.length,
        referenceRoleMode: config.referenceRoleMode || 'default',
        hiddenConstraintsDisabled: shouldDisableHiddenConstraints,
        hasMask: !!config.maskImage,
        imageSize: config.imageSize || '1K',
        aspectRatio: validAspectRatio,
        useOpenAIImageRoute,
    });

    if (useOpenAIImageRoute) {
        return requestOpenAICompatibleImage({
            contextTag: `generateImage.${targetModelId}`,
            model: normalizeOpenAICompatibleImageModelId(targetModelId) || targetModelId,
            prompt: finalPrompt,
            aspectRatio: validAspectRatio,
            imageSize: config.imageSize,
            imageQuality: config.imageQuality,
            disableTransportRetries: config.disableTransportRetries,
            referenceImages: references,
            maskImage: config.maskImage,
            providerId: config.providerId,
        });
    }

    parts.push({ text: finalPrompt });

    if (hasReferences) {
        console.info('[imggen] reference control', {
            model: targetModelId,
            refs: references.length,
            priority,
            strength,
            repeats,
            promptChars: finalPrompt.length,
        });
    }

    const imageConfig: any = {
        aspectRatio: validAspectRatio,
    };

    // 所有走 Gemini imageConfig 的模型都支持 imageSize，不仅限于 Nano Banana Pro
    if (config.imageSize) {
        imageConfig.imageSize = config.imageSize;
    }

    let lastError: any = null;

    for (const modelToUse of modelsToTry) {
        try {
            console.log(`[generateImage] Trying model: ${modelToUse} at ${getApiUrl(config.providerId)}`);
            const response = await retryWithBackoff<GenerateContentResponse>(() => getClient(config.providerId).models.generateContent({
                model: modelToUse,
                contents: { parts },
                config: {
                    // responseModalities removed for better compatibility with 1.5/Imagen models via proxies
                    imageConfig
                }
            }));

            if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) {
                        console.log(`[generateImage] Success with model: ${modelToUse}`);
                        return `data:image/png;base64,${part.inlineData.data}`;
                    }
                }
            }

            // If we're here, no image data was found in the response
            console.warn(`[generateImage] No image data in response from ${modelToUse}. Candidate:`, JSON.stringify(response.candidates?.[0]).slice(0, 500));
        } catch (error: any) {
            lastError = error;
            console.warn(`[generateImage] Model ${modelToUse} failed:`, error.message || error);
            if (error.status === 401 || error.status === 403 || error.status === 429) {
                // For Auth or Quota errors, don't try next model as it will likely fail too
                break;
            }
            // 继续尝试下一个模型
        }
    }

    if (lastError) {
        console.error("Image Generation Error: all models failed", lastError);
    } else {
        console.error("Image Generation Error: models returned successful response but no image data");
    }
    throw lastError || new Error('所有图片生成模型均不可用或返回数据异常');
};

export interface VideoGenerationConfig {
    prompt: string;
    model: string;
    aspectRatio: string;
    startFrame?: string; // base64
    endFrame?: string; // base64
    referenceImages?: string[]; // array of base64
}

export const generateVideo = async (config: VideoGenerationConfig): Promise<string | null> => {
    try {
        const win = window as any;
        if (win.aistudio) {
            const hasKey = await win.aistudio.hasSelectedApiKey();
            if (!hasKey) {
                await win.aistudio.openSelectKey();
            }
        }

        let validAspectRatio = config.aspectRatio;
        if (validAspectRatio !== '16:9' && validAspectRatio !== '9:16') {
            validAspectRatio = '16:9';
        }

        // 1. Determine the target model ID
        let targetModelId = normalizeVideoModelId(config.model || '');

        if (!targetModelId) {
            const candidates = getNormalizedSelectedVideoModels();
            const storageKeyIdx = `service_poll_index_video`;
            let currentIdx = parseInt(localStorage.getItem(storageKeyIdx) || '0', 10);
            if (currentIdx >= candidates.length) currentIdx = 0;
            targetModelId = candidates[currentIdx];
            safeLocalStorageSetItem(storageKeyIdx, ((currentIdx + 1) % candidates.length).toString());
        }

        const modelId = normalizeVideoModelId(targetModelId || VEO_FAST_MODEL);
        const baseUrl = getVideoBaseUrl();
        const apiKey = requireApiKey('generateVideo');
        console.log(`[generateVideo] model=${modelId}, baseUrl=${baseUrl}, prompt=${config.prompt.slice(0, 50)}...`);
        const isSora2 = isSora2VideoModel(modelId);

        // 2. Build request body
        const genConfig: any = { numberOfVideos: 1, aspectRatio: validAspectRatio };
        const body: any = { model: `models/${modelId}`, prompt: config.prompt, config: genConfig };
        const isFastModel = modelId.includes('fast');

        if (config.startFrame) {
            const matches = config.startFrame.match(/^data:(.+);base64,(.+)$/);
            if (matches) {
                body.image = { mimeType: matches[1], imageBytes: matches[2] };
            }
        }
        if (config.endFrame) {
            const matches = config.endFrame.match(/^data:(.+);base64,(.+)$/);
            if (matches) {
                genConfig.lastFrame = { mimeType: matches[1], imageBytes: matches[2] };
            }
        }
        const normalizedReferenceImages = isSora2
            ? (config.referenceImages || []).slice(0, 1)
            : (config.referenceImages || []);

        if (normalizedReferenceImages.length > 0 && !isFastModel) {
            const refPayload: any[] = [];
            for (const imgStr of normalizedReferenceImages) {
                const matches = imgStr.match(/^data:(.+);base64,(.+)$/);
                if (matches) {
                    refPayload.push({
                        image: { mimeType: matches[1], imageBytes: matches[2] },
                        referenceType: 'ASSET'
                    });
                }
            }
            if (refPayload.length > 0) genConfig.referenceImages = refPayload;
        }

        if (isSora2 && !body.image && normalizedReferenceImages[0]) {
            const matches = normalizedReferenceImages[0].match(/^data:(.+);base64,(.+)$/);
            if (matches) {
                body.image = { mimeType: matches[1], imageBytes: matches[2] };
            }
        }

        // 3. POST via fetch — uses generateVideos endpoint (not SDK's predictLongRunning)
        const isGoogleDirect = baseUrl.includes('googleapis.com');
        const directGoogleUrl = `${baseUrl}/v1beta/models/${modelId}:generateVideos?key=${encodeURIComponent(apiKey)}`;
        let generateContext: { version: VideoApiVersion; authMode: VideoAuthMode } = { version: 'v1beta', authMode: 'query' };

        const genRes = await retryWithBackoff(async () => {
            if (isGoogleDirect) {
                console.log(`[generateVideo] POST ${directGoogleUrl.replace(apiKey, '***')}`);
                const r = await fetchWithResilience(directGoogleUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                }, { operation: 'generateVideo.googleDirectSubmit', retries: 0 });
                if (!r.ok) {
                    const errBody = await r.text();
                    const err: any = new Error(`generateVideos ${r.status}: ${errBody}`);
                    err.status = r.status;
                    throw err;
                }
                return r.json();
            }

            const plans: Array<{ version: VideoApiVersion; authMode: VideoAuthMode }> = [
                { version: 'v1beta', authMode: 'bearer' },
                { version: 'v1beta', authMode: 'query' },
                { version: 'v1', authMode: 'bearer' },
                { version: 'v1', authMode: 'query' },
            ];

            let lastError: any = null;

            for (const plan of plans) {
                try {
                    const generateUrl = buildVideoGenerateUrl(baseUrl, plan.version, modelId, plan.authMode, apiKey);
                    const headers = buildVideoHeaders(plan.authMode, apiKey);
                    console.log(`[generateVideo] POST [${plan.version}/${plan.authMode}] ${generateUrl.replace(apiKey, '***')}`);

                    const r = await fetchWithResilience(generateUrl, { method: 'POST', headers, body: JSON.stringify(body) }, { operation: 'generateVideo.generateVideosSubmit', retries: 0 });
                    if (r.ok) {
                        generateContext = plan;
                        return r.json();
                    }

                    const errBody = await r.text();
                    const err: any = new Error(`generateVideos ${r.status} [${plan.version}/${plan.authMode}]: ${errBody}`);
                    err.status = r.status;
                    err.version = plan.version;
                    err.authMode = plan.authMode;
                    lastError = err;

                    if (!shouldFallbackVideoAuth(r.status)) {
                        throw err;
                    }
                } catch (networkErr) {
                    lastError = networkErr;
                    if (!isNetworkFetchError(networkErr)) {
                        throw networkErr;
                    }
                }
            }

            console.warn('[generateVideo] Google-style generateVideos failed, trying OpenAI-compatible video endpoint fallback');
            const openAiUrl = await generateVideoOpenAICompatible(baseUrl, apiKey, modelId, config);
            if (openAiUrl) {
                return { __openaiVideoUrl: openAiUrl } as any;
            }

            throw lastError || new Error('generateVideos failed on all auth/version strategies');
        });

        const openAiDirectUrl = (genRes as any)?.__openaiVideoUrl;
        if (openAiDirectUrl) {
            return openAiDirectUrl;
        }

        const operationName = genRes.name;
        if (!operationName) {
            throw new Error(`生成请求未返回 operation name: ${JSON.stringify(genRes).slice(0, 200)}`);
        }
        console.log(`[generateVideo] Operation created: ${operationName}`);

        // 4. Poll for completion
        let pollCount = 0;
        const MAX_POLLS = 60;

        while (pollCount < MAX_POLLS) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            pollCount++;

            const pollPlans: Array<{ version: VideoApiVersion; authMode: VideoAuthMode }> = isGoogleDirect
                ? [{ version: 'v1beta', authMode: 'query' }]
                : [
                    generateContext,
                    { version: 'v1beta', authMode: 'bearer' },
                    { version: 'v1beta', authMode: 'query' },
                    { version: 'v1', authMode: 'bearer' },
                    { version: 'v1', authMode: 'query' },
                ];

            let pollData: any = null;
            let lastPollError: any = null;

            try {
                for (const plan of pollPlans) {
                    const pollUrl = buildVideoPollUrl(baseUrl, plan.version, operationName, plan.authMode, apiKey);
                    const pollHeaders = buildVideoHeaders(plan.authMode, apiKey);
                    const pollRes = await fetchWithResilience(pollUrl, { headers: pollHeaders }, { operation: 'generateVideo.generateVideosPoll', retries: 1 });

                    if (!pollRes.ok) {
                        const errBody = await pollRes.text().catch(() => '');
                        const err: any = new Error(`poll ${pollRes.status} [${plan.version}/${plan.authMode}]: ${errBody}`);
                        err.status = pollRes.status;
                        lastPollError = err;
                        if (shouldFallbackVideoAuth(pollRes.status)) continue;
                        break;
                    }

                    pollData = await pollRes.json();
                    break;
                }

                if (!pollData) {
                    if (lastPollError) throw lastPollError;
                    throw new Error('轮询失败：无可用响应');
                }

                console.log(`[generateVideo] Poll #${pollCount}: done=${pollData.done}`);

                if (pollData.done) {
                    if (pollData.error) {
                        throw new Error(`生成失败: ${pollData.error.message || JSON.stringify(pollData.error)}`);
                    }
                    const uri = pollData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
                        || pollData.response?.generatedVideos?.[0]?.video?.uri;
                    if (uri) {
                        if (isGoogleDirect) {
                            return `${uri}${uri.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}`;
                        }
                        return uri;
                    }
                    throw new Error(`未获取到视频资源: ${JSON.stringify(pollData.response || pollData).slice(0, 300)}`);
                }
            } catch (pollErr: any) {
                if (pollErr.message?.startsWith('生成失败') || pollErr.message?.startsWith('未获取到')) throw pollErr;
                console.warn(`[generateVideo] Poll #${pollCount} error:`, pollErr.message);
            }
        }

        throw new Error("视频生成超时，请稍后在项目中查看。");

    } catch (error: any) {
        console.error("Video Generation Detailed Error:", error);
        const status = extractStatusCode(error);
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('requested entity was not found')) {
            throw new ProviderError({
                provider: getProviderConfig().id || 'unknown',
                code: 'MODEL_NOT_FOUND',
                status,
                retryable: false,
                stage: 'modelResolve',
                details: error?.message,
                message: "模型无法在当前节点找到，请检查设置中的模型映射。"
            });
        } else if (msg.includes('503') || msg.includes('overloaded') || msg.includes('unavailable')) {
            throw new ProviderError({
                provider: getProviderConfig().id || 'unknown',
                code: 'PROVIDER_OVERLOADED',
                status: status || 503,
                retryable: true,
                stage: 'generateRequest',
                details: error?.message,
                message: "服务商节点当前过载 (503)，请稍后重试或切换 API 节点。"
            });
        } else if (msg.includes('403') || msg.includes('permission') || msg.includes('401')) {
            throw new ProviderError({
                provider: getProviderConfig().id || 'unknown',
                code: 'AUTH_FAILED',
                status: status || 401,
                retryable: false,
                stage: 'generateRequest',
                details: error?.message,
                message: "API 密钥权限不足或已失效，请检查设置。"
            });
        }

        if (error instanceof ProviderError) {
            throw error;
        }

        throw new ProviderError({
            provider: getProviderConfig().id || 'unknown',
            code: 'VIDEO_GENERATION_FAILED',
            status,
            retryable: status === 429 || status === 500 || status === 503,
            stage: 'unknown',
            details: error?.message,
            message: error?.message || '视频生成失败，请稍后重试。'
        });
    }
}
