type SerializedFormDataEntry =
  | {
      key: string;
      type: 'text';
      value: string;
    }
  | {
      key: string;
      type: 'file';
      name: string;
      mimeType: string;
      dataUrl: string;
    };

type OpenAIProxyRequest = {
  targetUrl?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  stream?: boolean;
};

type SerializedFormDataBody = {
  kind: 'form-data';
  entries: SerializedFormDataEntry[];
};

const REQUEST_TIMEOUT_MS = 300000;
const MAX_REQUEST_TIMEOUT_MS = 900000;

function createProxyTraceId(): string {
  return `openai_proxy_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function readHeader(req: any, name: string): string | null {
  const headers = req?.headers || {};
  const value = headers[name] || headers[name.toLowerCase()];
  if (Array.isArray(value)) return String(value[0] || '').trim() || null;
  return String(value || '').trim() || null;
}

function resolveProxyTraceId(req: any): string {
  return readHeader(req, 'x-trace-id') || createProxyTraceId();
}

function summarizeTargetUrl(targetUrl: string): string {
  try {
    const url = new URL(targetUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return '[invalid-target-url]';
  }
}

function summarizeProxyBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    return {};
  }

  const payload = body as Record<string, any>;
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const firstMessageContent = messages[0]?.content;
  const firstMessageParts = Array.isArray(firstMessageContent)
    ? firstMessageContent
    : typeof firstMessageContent === 'string'
      ? [{ type: 'text', text: firstMessageContent }]
      : [];

  return {
    model: typeof payload.model === 'string' ? payload.model : null,
    stream: payload.stream === true,
    messageCount: messages.length,
    firstMessagePartCount: firstMessageParts.length,
    textPartCount: firstMessageParts.filter((part: any) => part?.type === 'text').length,
    imagePartCount: firstMessageParts.filter((part: any) => part?.type === 'image_url').length,
  };
}

function isPrivateHostname(hostname: string): boolean {
  const host = String(hostname || '').toLowerCase();
  if (!host) return true;
  if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return true;
  if (/^127\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
}

function normalizeHeaders(raw: Record<string, string> | undefined): Headers {
  const headers = new Headers();
  Object.entries(raw || {}).forEach(([key, value]) => {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) return;
    const lower = normalizedKey.toLowerCase();
    if (lower === 'host' || lower === 'content-length' || lower === 'connection') {
      return;
    }
    const normalizedValue = String(value || '').trim();
    if (!normalizedValue) return;
    headers.set(normalizedKey, normalizedValue);
  });
  return headers;
}

function parseDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } | null {
  const match = String(dataUrl || '').match(/^data:(.+);base64,(.+)$/);
  if (!match) return null;
  const mimeType = match[1];
  const base64 = match[2];
  const bytes = Buffer.from(base64, 'base64');
  return {
    mimeType,
    bytes,
  };
}

function buildFormData(entries: SerializedFormDataEntry[]): FormData {
  const formData = new FormData();
  entries.forEach((entry) => {
    if (entry.type === 'text') {
      formData.append(entry.key, entry.value);
      return;
    }

    const parsed = parseDataUrl(entry.dataUrl);
    if (!parsed) {
      return;
    }

    const safeBytes = new Uint8Array(parsed.bytes.length);
    safeBytes.set(parsed.bytes);
    const blob = new Blob([safeBytes], {
      type: parsed.mimeType || entry.mimeType || 'application/octet-stream',
    });
    formData.append(entry.key, blob, entry.name || 'upload.bin');
  });
  return formData;
}

function normalizeRequestBody(body: unknown): BodyInit | undefined {
  if (body === undefined || body === null) return undefined;
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) {
    return Buffer.from(body).toString('utf-8');
  }

  const maybeForm = body as SerializedFormDataBody;
  if (maybeForm && maybeForm.kind === 'form-data' && Array.isArray(maybeForm.entries)) {
    return buildFormData(maybeForm.entries);
  }

  return JSON.stringify(body);
}

async function pipeWebStreamToNodeResponse(stream: ReadableStream<Uint8Array>, res: any) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value && value.length > 0) {
        res.write(Buffer.from(value));
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export default async function handler(req: any, res: any) {
  const traceId = resolveProxyTraceId(req);
  const startedAt = Date.now();

  if (req.method !== 'POST') {
    console.warn('[openai-proxy] rejected', {
      traceId,
      reason: 'method_not_allowed',
      method: req.method || null,
    });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body: OpenAIProxyRequest =
    typeof req.body === 'string'
      ? (() => {
          try {
            return JSON.parse(req.body);
          } catch {
            return {};
          }
        })()
      : req.body || {};

  const targetUrl = String(body.targetUrl || '').trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    console.warn('[openai-proxy] rejected', {
      traceId,
      reason: 'invalid_target_url',
      elapsedMs: Date.now() - startedAt,
    });
    return res.status(400).json({ error: 'targetUrl must be a valid http(s) url' });
  }

  const targetSummary = summarizeTargetUrl(targetUrl);

  try {
    const parsed = new URL(targetUrl);
    if (isPrivateHostname(parsed.hostname)) {
      console.warn('[openai-proxy] rejected', {
        traceId,
        target: targetSummary,
        reason: 'private_network_url_not_allowed',
        elapsedMs: Date.now() - startedAt,
      });
      return res.status(400).json({ error: 'private_network_url_not_allowed' });
    }
  } catch {
    console.warn('[openai-proxy] rejected', {
      traceId,
      reason: 'url_parse_failed',
      elapsedMs: Date.now() - startedAt,
    });
    return res.status(400).json({ error: 'url_parse_failed' });
  }

  const method = String(body.method || 'POST').trim().toUpperCase();
  const shouldStreamResponse = body.stream === true;
  const requestedTimeoutMs = Number(body.timeoutMs);
  const effectiveTimeoutMs = Number.isFinite(requestedTimeoutMs) && requestedTimeoutMs > 0
    ? Math.min(MAX_REQUEST_TIMEOUT_MS, Math.max(1000, requestedTimeoutMs))
    : REQUEST_TIMEOUT_MS;
  const headers = normalizeHeaders(body.headers);
  const requestBody = method === 'GET' || method === 'HEAD'
    ? undefined
    : normalizeRequestBody(body.body);
  const isFormDataRequest = typeof FormData !== 'undefined' && requestBody instanceof FormData;

  console.log('[openai-proxy] request start', {
    traceId,
    target: targetSummary,
    method,
    stream: shouldStreamResponse,
    timeoutMs: effectiveTimeoutMs,
    body: summarizeProxyBody(body.body),
  });

  if (isFormDataRequest) {
    headers.delete('Content-Type');
  } else if (!headers.has('Content-Type') && method !== 'GET' && method !== 'HEAD') {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), effectiveTimeoutMs);
    const upstreamResponse = await fetch(targetUrl, {
      method,
      headers,
      body: requestBody,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    const contentType = upstreamResponse.headers.get('content-type') || 'application/json';
    console.log('[openai-proxy] upstream response', {
      traceId,
      target: targetSummary,
      status: upstreamResponse.status,
      ok: upstreamResponse.ok,
      stream: shouldStreamResponse,
      contentType,
      elapsedMs: Date.now() - startedAt,
    });
    res.status(upstreamResponse.status);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Proxy-Target', targetUrl);
    res.setHeader('X-Proxy-Upstream-Status', String(upstreamResponse.status));

    if (shouldStreamResponse && upstreamResponse.body) {
      res.setHeader('Transfer-Encoding', 'chunked');
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }
      await pipeWebStreamToNodeResponse(upstreamResponse.body as ReadableStream<Uint8Array>, res);
      res.end();
      console.log('[openai-proxy] stream completed', {
        traceId,
        target: targetSummary,
        status: upstreamResponse.status,
        elapsedMs: Date.now() - startedAt,
      });
      return;
    }

    const responseBuffer = Buffer.from(await upstreamResponse.arrayBuffer());
    res.end(responseBuffer);
    console.log('[openai-proxy] request completed', {
      traceId,
      target: targetSummary,
      status: upstreamResponse.status,
      bytes: responseBuffer.byteLength,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      console.warn('[openai-proxy] timeout', {
        traceId,
        target: targetSummary,
        method,
        stream: shouldStreamResponse,
        elapsedMs: Date.now() - startedAt,
      });
      return res.status(504).json({ error: 'openai_proxy_timeout' });
    }
    console.error('[openai-proxy] failed', {
      traceId,
      target: targetSummary,
      method,
      stream: shouldStreamResponse,
      elapsedMs: Date.now() - startedAt,
      error: error?.message || 'openai_proxy_failed',
      errorName: error?.name || 'Error',
    });
    return res.status(500).json({
      error: error?.message || 'openai_proxy_failed',
      errorName: error?.name || 'Error',
      targetUrl,
      method,
      stream: shouldStreamResponse,
    });
  }
}
