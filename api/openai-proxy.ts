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
};

type SerializedFormDataBody = {
  kind: 'form-data';
  entries: SerializedFormDataEntry[];
};

const REQUEST_TIMEOUT_MS = 300000;

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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
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
    return res.status(400).json({ error: 'targetUrl must be a valid http(s) url' });
  }

  try {
    const parsed = new URL(targetUrl);
    if (isPrivateHostname(parsed.hostname)) {
      return res.status(400).json({ error: 'private_network_url_not_allowed' });
    }
  } catch {
    return res.status(400).json({ error: 'url_parse_failed' });
  }

  const method = String(body.method || 'POST').trim().toUpperCase();
  const headers = normalizeHeaders(body.headers);
  const requestBody = method === 'GET' || method === 'HEAD'
    ? undefined
    : normalizeRequestBody(body.body);
  const isFormDataRequest = typeof FormData !== 'undefined' && requestBody instanceof FormData;

  if (isFormDataRequest) {
    headers.delete('Content-Type');
  } else if (!headers.has('Content-Type') && method !== 'GET' && method !== 'HEAD') {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const upstreamResponse = await fetch(targetUrl, {
      method,
      headers,
      body: requestBody,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    const contentType = upstreamResponse.headers.get('content-type') || 'application/json';
    const responseText = await upstreamResponse.text();

    res.status(upstreamResponse.status);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Proxy-Target', targetUrl);
    res.send(responseText);
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return res.status(504).json({ error: 'openai_proxy_timeout' });
    }
    return res.status(500).json({ error: error?.message || 'openai_proxy_failed' });
  }
}
