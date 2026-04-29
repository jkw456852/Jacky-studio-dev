type RetryOptions = {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryOnStatuses?: number[];
};

type FetchResilienceOptions = RetryOptions & {
  timeoutMs?: number;
  idleTimeoutMs?: number;
  operation?: string;
};

const DEFAULT_RETRYABLE_STATUSES = [408, 409, 425, 429, 500, 502, 503, 504];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const createTraceId = (): string => {
  const random = Math.random().toString(36).slice(2, 10);
  return `xc_${Date.now().toString(36)}_${random}`;
};

const isRetryableError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('network') || message.includes('fetch') || message.includes('timeout');
};

const isAbortError = (error: unknown): boolean => {
  return error instanceof DOMException && error.name === 'AbortError';
};

const isRateLimitError = (status: number): boolean => {
  return status === 429;
};

const isTimeoutStatusError = (status: number): boolean => {
  return status === 408;
};

const isVerboseFetchOperation = (operation: string): boolean => {
  return operation === 'ecomAnalyzeProductSkill.openaiPost'
    || operation === 'ecomAnalyzeProductSkill.textOnlyFallback.openaiPost'
    || operation === 'ecomGeneratePlansSkill.openaiPost'
    || operation.startsWith('ecomGeneratePlansSkill.')
    || operation === 'ecomAutofillPlansSkill.openaiPost'
    || operation.startsWith('ecomAutofillPlansSkill.')
    || operation === 'ecomReviewGeneratedResultSkill.openaiPost'
    || operation === 'ecomReviewGeneratedResultSkill.textOnlyFallback.openaiPost';
};

const summarizeRequestTarget = (input: RequestInfo | URL): string => {
  try {
    if (typeof input === 'string') {
      const url = new URL(input);
      return `${url.origin}${url.pathname}`;
    }
    if (input instanceof URL) {
      return `${input.origin}${input.pathname}`;
    }
    if (typeof Request !== 'undefined' && input instanceof Request) {
      return summarizeRequestTarget(input.url);
    }
  } catch {
    return typeof input === 'string' ? input : '[unavailable]';
  }

  return '[unavailable]';
};

const isCrossOriginRequestTarget = (input: RequestInfo | URL): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const target =
      typeof input === 'string'
        ? new URL(input)
        : input instanceof URL
          ? input
          : typeof Request !== 'undefined' && input instanceof Request
            ? new URL(input.url)
            : null;
    if (!target) return false;
    return target.origin !== window.location.origin;
  } catch {
    return false;
  }
};

const isLikelyBrowserDirectAccessBlocked = (
  input: RequestInfo | URL,
  error: unknown,
): boolean => {
  if (!isCrossOriginRequestTarget(input) || !(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes('failed to fetch')
    || message.includes('load failed')
    || message.includes('networkerror')
    || message.includes('network error');
};

const buildBrowserDirectAccessBlockedMessage = (target: string): string =>
  `浏览器无法直接访问 ${target}。该接口可能未开启 CORS，或上游网关不允许前端直连。请改用支持浏览器跨域的中转地址，或通过同源服务端代理转发。`;

const computeBackoff = (attempt: number, baseDelayMs: number, maxDelayMs: number, isRateLimit: boolean = false): number => {
  // For 429 rate limit errors, use aggressive exponential backoff
  if (isRateLimit) {
    const exponential = baseDelayMs * Math.pow(2, attempt + 1);
    const jitter = Math.floor(Math.random() * 2000);
    return Math.min(exponential + jitter, maxDelayMs);
  }
  
  const jitter = Math.floor(Math.random() * 250);
  const exponential = baseDelayMs * Math.pow(2, attempt);
  return Math.min(exponential + jitter, maxDelayMs);
};

export async function fetchWithResilience(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchResilienceOptions = {}
): Promise<Response> {
  const {
    timeoutMs = 45000,
    idleTimeoutMs,
    retries = 2,
    baseDelayMs = 500,
    maxDelayMs = 5000,
    retryOnStatuses = DEFAULT_RETRYABLE_STATUSES,
    operation = 'http.request',
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const externalSignal = init.signal;
    let abortSource: 'external' | 'total-timeout' | 'idle-timeout' | null = null;
    const attemptStartedAt = Date.now();
    const target = summarizeRequestTarget(input);

    const abortWithSource = (source: 'external' | 'total-timeout' | 'idle-timeout') => {
      if (controller.signal.aborted) return;
      abortSource = source;
      controller.abort();
    };

    const onExternalAbort = () => abortWithSource('external');
    if (externalSignal) {
      if (externalSignal.aborted) {
        abortWithSource('external');
      } else {
        externalSignal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const totalTimeoutId = timeoutMs > 0
      ? setTimeout(() => abortWithSource('total-timeout'), timeoutMs)
      : undefined;
    const idleTimeoutId = idleTimeoutMs && idleTimeoutMs > 0
      ? setTimeout(() => abortWithSource('idle-timeout'), idleTimeoutMs)
      : undefined;

    try {
      const headers = new Headers(init.headers || {});
      if (!headers.has('x-trace-id')) {
        headers.set('x-trace-id', createTraceId());
      }
      const traceId = headers.get('x-trace-id') || 'missing-trace-id';

      if (isVerboseFetchOperation(operation)) {
        console.info(`[${operation}] fetch start`, {
          attempt: `${attempt + 1}/${retries + 1}`,
          traceId,
          target,
          timeoutMs,
          idleTimeoutMs: idleTimeoutMs ?? null,
          method: init.method || 'GET',
        });
      }

      const response = await fetch(input, {
        ...init,
        headers,
        signal: controller.signal,
      });

      if (totalTimeoutId) clearTimeout(totalTimeoutId);
      if (idleTimeoutId) clearTimeout(idleTimeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }

      if (isVerboseFetchOperation(operation)) {
        console.info(`[${operation}] fetch response`, {
          attempt: `${attempt + 1}/${retries + 1}`,
          traceId,
          status: response.status,
          ok: response.ok,
          elapsedMs: Date.now() - attemptStartedAt,
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length'),
        });
      }

      if (response.ok || !retryOnStatuses.includes(response.status) || attempt === retries) {
        return response;
      }

      const isRateLimit = isRateLimitError(response.status);
      const isTimeoutStatus = isTimeoutStatusError(response.status);
      const delay = computeBackoff(attempt, baseDelayMs, maxDelayMs, isRateLimit || isTimeoutStatus);
      const statusMsg = isRateLimit ? '(rate limited)' : isTimeoutStatus ? '(upstream timeout)' : '';
      console.warn(`[${operation}] retrying status=${response.status} ${statusMsg}, attempt=${attempt + 1}/${retries + 1}, wait=${delay}ms`);
      await sleep(delay);
    } catch (error) {
      if (totalTimeoutId) clearTimeout(totalTimeoutId);
      if (idleTimeoutId) clearTimeout(idleTimeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
      lastError = error;

      if (isAbortError(error)) {
        if (abortSource === 'external') {
          throw error;
        }

        if (abortSource === 'idle-timeout' || abortSource === 'total-timeout') {
          if (isVerboseFetchOperation(operation)) {
            console.warn(`[${operation}] fetch aborted`, {
              attempt: `${attempt + 1}/${retries + 1}`,
              abortSource,
              elapsedMs: Date.now() - attemptStartedAt,
              timeoutMs,
              idleTimeoutMs: idleTimeoutMs ?? null,
            });
          }
          if (attempt === retries) {
            throw new Error(`[${operation}] request timeout after ${abortSource === 'idle-timeout' ? `idle ${idleTimeoutMs}ms` : `${timeoutMs}ms`}`);
          }

          const delay = computeBackoff(attempt, baseDelayMs, maxDelayMs);
          console.warn(`[${operation}] retrying ${abortSource}, attempt=${attempt + 1}/${retries + 1}, wait=${delay}ms`);
          await sleep(delay);
          continue;
        }
      }

      if (isLikelyBrowserDirectAccessBlocked(input, error)) {
        throw new Error(
          `[${operation}] ${buildBrowserDirectAccessBlockedMessage(target)}`,
        );
      }

      if (isVerboseFetchOperation(operation)) {
        console.warn(`[${operation}] fetch error`, {
          attempt: `${attempt + 1}/${retries + 1}`,
          elapsedMs: Date.now() - attemptStartedAt,
          errorName: error instanceof Error ? error.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }

      if (!isRetryableError(error) || attempt === retries) {
        throw error;
      }

      const delay = computeBackoff(attempt, baseDelayMs, maxDelayMs);
      console.warn(`[${operation}] retrying network error, attempt=${attempt + 1}/${retries + 1}, wait=${delay}ms`);
      await sleep(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed after retries');
}
