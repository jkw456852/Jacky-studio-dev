type ExtractRequest = {
  url?: string;
  query?: string;
  provider?: {
    providerType?: string;
    apiKey?: string;
    baseUrl?: string;
  };
};

const REQUEST_TIMEOUT_MS = 12000;
const MAX_HTML_BYTES = 1_500_000;
const ALLOWED_CONTENT_TYPES = ["text/html", "application/xhtml+xml", "text/plain"];

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function pickTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch) return "";
  return stripHtml(titleMatch[1] || "");
}

function isPrivateHostname(hostname: string): boolean {
  const host = String(hostname || "").toLowerCase();
  if (!host) return true;
  if (host === "localhost" || host === "::1" || host.endsWith(".local")) return true;
  if (/^127\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
}

function isSupportedContentType(value: string | null): boolean {
  const normalized = String(value || "").toLowerCase();
  return ALLOWED_CONTENT_TYPES.some((t) => normalized.includes(t));
}

function normalizeBaseUrl(rawUrl: string): string {
  return String(rawUrl || "").trim().replace(/\/+$/, "");
}

async function fetchJsonWithTimeout(url: string, init?: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        String(payload?.detail || payload?.error || payload?.message || "").trim() ||
        `http_${response.status}`;
      throw new Error(message);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function tryTavilyExtract(args: {
  url: string;
  query?: string;
  apiKey: string;
  baseUrl?: string;
}): Promise<{
  url: string;
  title: string;
  cleanedText: string;
  excerpt: string;
  length: number;
} | null> {
  const normalizedKey = String(args.apiKey || "").trim();
  if (!normalizedKey) return null;

  const rootUrl = normalizeBaseUrl(args.baseUrl || "") || "https://api.tavily.com";
  const payload = await fetchJsonWithTimeout(
    `${rootUrl}${rootUrl.endsWith("/extract") ? "" : "/extract"}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${normalizedKey}`,
      },
      body: JSON.stringify({
        urls: [args.url],
        extract_depth: "advanced",
        format: "text",
        include_images: false,
        query: String(args.query || "").trim() || undefined,
        chunks_per_source: 4,
      }),
    },
  );

  const first =
    (Array.isArray(payload?.results) ? payload.results[0] : null) ||
    (Array.isArray(payload?.data) ? payload.data[0] : null) ||
    null;
  if (!first || typeof first !== "object") return null;

  const cleanedText = String(
    first.raw_content ||
      first.content ||
      first.text ||
      first.markdown ||
      "",
  ).trim();
  if (!cleanedText) return null;

  return {
    url: String(first.url || args.url).trim() || args.url,
    title: String(first.title || "").trim(),
    cleanedText,
    excerpt: cleanedText.slice(0, 1200),
    length: cleanedText.length,
  };
}

async function readTextWithLimit(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) {
    const plain = await response.text();
    return plain.slice(0, maxBytes);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      throw new Error("content_too_large");
    }

    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body: ExtractRequest =
    typeof req.body === "string"
      ? (() => {
          try {
            return JSON.parse(req.body);
          } catch {
            return {};
          }
        })()
      : req.body || {};

  const targetUrl = String(body.url || "").trim();
  const query = String(body.query || "").trim();
  const providerType = String(body.provider?.providerType || "").trim().toLowerCase();
  const providerApiKey = String(body.provider?.apiKey || "").trim();
  const providerBaseUrl = String(body.provider?.baseUrl || "").trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    return res.status(400).json({ error: "url must be a valid http(s) url" });
  }

  try {
    const parsed = new URL(targetUrl);
    if (isPrivateHostname(parsed.hostname)) {
      return res.status(400).json({ error: "private_network_url_not_allowed" });
    }
  } catch {
    return res.status(400).json({ error: "url_parse_failed" });
  }

  try {
    if (providerType === "tavily" && providerApiKey) {
      const tavilyResult = await tryTavilyExtract({
        url: targetUrl,
        query,
        apiKey: providerApiKey,
        baseUrl: providerBaseUrl,
      });
      if (tavilyResult) {
        return res.status(200).json(tavilyResult);
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Jacky-Studio-ResearchBot/1.0; +https://jacky-studio.vercel.app)",
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      return res.status(400).json({
        error: `fetch_failed_${response.status}`,
        status: response.status,
      });
    }

    const finalUrl = response.url || targetUrl;
    try {
      const finalParsed = new URL(finalUrl);
      if (isPrivateHostname(finalParsed.hostname)) {
        return res.status(400).json({ error: "redirected_to_private_network" });
      }
    } catch {
      return res.status(400).json({ error: "final_url_parse_failed" });
    }

    const contentType = response.headers.get("content-type");
    if (!isSupportedContentType(contentType)) {
      return res.status(415).json({
        error: "unsupported_content_type",
        contentType: contentType || "unknown",
      });
    }

    const html = await readTextWithLimit(response, MAX_HTML_BYTES);
    const title = pickTitle(html);
    const cleanedText = stripHtml(html);
    const excerpt = cleanedText.slice(0, 1200);

    return res.status(200).json({
      url: finalUrl,
      title,
      cleanedText,
      excerpt,
      length: cleanedText.length,
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return res.status(504).json({ error: "extract_timeout" });
    }

    if (error?.message === "content_too_large") {
      return res.status(413).json({ error: "content_too_large" });
    }

    return res.status(500).json({
      error: error?.message || "extract_failed",
    });
  }
}
