import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import {
  clearPersonalBrowserAuthSession,
  finalizePersonalBrowserAuthSession,
  getActivePersonalBrowserAuthSession,
  getPersonalBrowserAuthPaths,
  getPersonalCompetitorBrowserAuthStatus,
  registerPersonalBrowserAuthSession,
} from "./services/dev/competitor-browser-auth-personal";
import {
  resolveBrowserExecutablePath,
  tryExtractCompetitorDeckWithBrowser,
  validateTaobaoDetailAccessWithContext,
} from "./services/dev/competitor-browser-extract";
import { apiCompetitorAnalysisDebugPlugin } from "./services/dev/competitor-analysis-debug";
import { apiCompetitorVisionSmokeDebugPlugin } from "./services/dev/competitor-vision-smoke-debug";
import { apiEcommerceProductAnalysisDebugPlugin } from "./services/dev/ecommerce-product-analysis-debug";
import { apiEcommerceSupplementDebugPlugin } from "./services/dev/ecommerce-supplement-debug";
import { apiEcommerceWorkflowDebugPlugin } from "./services/dev/ecommerce-workflow-debug";
import { apiCompetitorPageImportPlugin } from "./services/dev/competitor-page-import";

// ─────────────────────────────────────────────────────────────────────────────
// 本地开发时把 /api/fetch-image 挂在 Vite dev server 上
// 等同于 Vercel Serverless Function，解决 ImgBB 等外部图片 CORS 问题
// ─────────────────────────────────────────────────────────────────────────────
function apiFetchImagePlugin(): Plugin {
  const REQUEST_TIMEOUT_MS = 15000;
  const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

  function isPrivateHostname(hostname: string): boolean {
    const host = String(hostname || "").toLowerCase();
    if (!host || host === "localhost" || host === "::1" || host.endsWith(".local")) return true;
    if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
    return false;
  }

  return {
    name: "vite-plugin-api-fetch-image",
    configureServer(server) {
      server.middlewares.use("/api/fetch-image", async (req, res) => {
        if (req.method !== "POST") {
          res.writeHead(405, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        // 读取请求体
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const rawBody = Buffer.concat(chunks).toString("utf-8");
        let body: { imageUrl?: string } = {};
        try { body = JSON.parse(rawBody); } catch { /* ignore */ }

        const imageUrl = String(body.imageUrl || "").trim();
        if (!/^https?:\/\//i.test(imageUrl)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "imageUrl must be a valid http(s) url" }));
          return;
        }

        let parsed: URL;
        try {
          parsed = new URL(imageUrl);
          if (isPrivateHostname(parsed.hostname)) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "private_network_url_not_allowed" }));
            return;
          }
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "url_parse_failed" }));
          return;
        }

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

          const imgRes = await fetch(imageUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (compatible; Jacky-Studio-ImageFetcher/1.0)",
              "Referer": "https://jacky-studio.vercel.app/",
            },
            signal: controller.signal,
          }).finally(() => clearTimeout(timeout));

          if (!imgRes.ok) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: `fetch_failed_${imgRes.status}`, status: imgRes.status }));
            return;
          }

          const contentType = imgRes.headers.get("content-type") || "image/png";
          if (!/^image\//i.test(contentType)) {
            res.writeHead(415, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "unsupported_content_type", contentType }));
            return;
          }

          // 读取图片数据（限制大小）
          const arrayBuffer = await imgRes.arrayBuffer();
          if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "image_too_large" }));
            return;
          }

          const base64 = Buffer.from(arrayBuffer).toString("base64");
          const dataUrl = `data:${contentType};base64,${base64}`;

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            imageUrl,
            mimeType: contentType,
            dataUrl,
            size: arrayBuffer.byteLength,
            provider: "server-fetch",
          }));
        } catch (error: any) {
          if (error?.name === "AbortError") {
            res.writeHead(504, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "fetch_image_timeout" }));
            return;
          }
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error?.message || "fetch_image_failed" }));
        }
      });
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 本地开发时把 /api/search 挂在 Vite dev server 上
// 没有 Bing Key 时走免费 Wikipedia + Wikimedia + Openverse fallback
// ─────────────────────────────────────────────────────────────────────────────
function apiSearchPlugin(): Plugin {
  const REQUEST_TIMEOUT_MS = 12000;

  async function fetchJson(url: string): Promise<any> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      if (!r.ok) throw new Error(`http_${r.status}`);
      return r.json();
    } finally {
      clearTimeout(t);
    }
  }

  async function searchWiki(query: string, locale: string, count: number) {
    const lang = locale.toLowerCase().startsWith("zh") ? "zh" : "en";
    const data = await fetchJson(
      `https://${lang}.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=${count}`
    ).catch(() => ({ pages: [] }));
    return (data?.pages || []).map((item: any, i: number) => ({
      id: `w_${i + 1}`, title: item?.title || "",
      url: item?.key ? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(item.key).replace(/%20/g, "_")}` : "",
      displayUrl: `${lang}.wikipedia.org`, snippet: String(item?.excerpt || "").replace(/<[^>]+>/g, " "),
      publishedTime: "", siteName: `${lang}.wikipedia.org`,
    }));
  }

  async function searchImages(query: string, count: number) {
    const [wm, ov] = await Promise.all([
      fetchJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=${Math.min(count, 20)}&prop=imageinfo&iiprop=url|size|mime`)
        .then((d: any) => Object.values(d?.query?.pages || {}).map((p: any, i: number) => {
          const info = p?.imageinfo?.[0] || {};
          return {
            id: `i_wm_${i}`, title: p?.title || "", imageUrl: info?.url || "",
            thumbnailUrl: info?.url || "", sourcePageUrl: "", width: Number(info?.width || 0),
            height: Number(info?.height || 0), contentType: info?.mime || "", siteName: "wikimedia"
          };
        })).catch(() => []),
      fetchJson(`https://api.openverse.org/v1/images?q=${encodeURIComponent(query)}&page_size=${Math.min(count, 16)}`)
        .then((d: any) => (d?.results || []).map((p: any, i: number) => ({
          id: `i_ov_${i}`, title: p?.title || "", imageUrl: p?.url || "",
          thumbnailUrl: p?.thumbnail || "", sourcePageUrl: p?.foreign_landing_url || "",
          width: Number(p?.width || 0), height: Number(p?.height || 0),
          contentType: p?.mime_type || "", siteName: p?.source || "openverse"
        })))
        .catch(() => []),
    ]);
    const seen = new Set<string>();
    return [...wm, ...ov].filter(img => {
      if (!img.imageUrl || seen.has(img.imageUrl)) return false;
      seen.add(img.imageUrl); return true;
    }).slice(0, count);
  }

  return {
    name: "vite-plugin-api-search",
    configureServer(server) {
      server.middlewares.use("/api/search", async (req, res) => {
        if (req.method !== "POST") {
          res.writeHead(405, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        let body: any = {};
        try { body = JSON.parse(Buffer.concat(chunks).toString("utf-8")); } catch { /* ignore */ }

        const query = String(body.query || "").trim();
        if (!query) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "query is required" }));
          return;
        }

        const mode = body.mode === "images" ? "images" : body.mode === "web" ? "web" : "web+images";
        const locale = String(body.locale || "zh-CN");
        const webCount = Math.min(Number(body.count?.web) || 8, 20);
        const imageCount = Math.min(Number(body.count?.images) || 16, 50);
        const requestId = `srch_${Date.now()}`;

        try {
          const [web, images] = await Promise.all([
            mode === "images" ? [] : searchWiki(query, locale, webCount),
            mode === "web" ? [] : searchImages(query, imageCount),
          ]);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            requestId, query, mode,
            provider: { web: mode === "images" ? "none" : "wikipedia", images: mode === "web" ? "none" : "wikimedia+openverse", fallback: true },
            web, images,
            hints: { suggestedQueries: [`${query} 风格参考`, `${query} 构图`], groups: [] },
            limits: { webReturned: web.length, imagesReturned: images.length },
          }));
        } catch (error: any) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error?.message || "search_failed", requestId }));
        }
      });
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// /api/rehost-image 本地代理：没有 ImgBB Key 就 passthrough
// ─────────────────────────────────────────────────────────────────────────────
function apiRehostImagePlugin(): Plugin {
  return {
    name: "vite-plugin-api-rehost-image",
    configureServer(server) {
      server.middlewares.use("/api/rehost-image", async (req, res) => {
        if (req.method !== "POST") {
          res.writeHead(405, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        let body: any = {};
        try { body = JSON.parse(Buffer.concat(chunks).toString("utf-8")); } catch { /* ignore */ }

        const imageUrl = String(body.imageUrl || "").trim();
        if (!/^https?:\/\//i.test(imageUrl)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "imageUrl must be a valid http(s) url" }));
          return;
        }

        // 本地开发没有 ImgBB key 时直接 passthrough，不尝试上传
        const imgbbKey = process.env.IMGBB_API_KEY || "";
        if (!imgbbKey) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ imageUrl, hostedUrl: imageUrl, provider: "passthrough", fallback: true, reason: "missing_imgbb_api_key" }));
          return;
        }

        try {
          const formData = new FormData();
          formData.append("image", imageUrl);
          const uploadRes = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(imgbbKey)}`, { method: "POST", body: formData as any });
          const payload = await uploadRes.json().catch(() => null);
          if (!uploadRes.ok || !payload?.success) {
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: payload?.error?.message || `imgbb_upload_failed_${uploadRes.status}` }));
            return;
          }
          const hostedUrl = payload?.data?.image?.url || payload?.data?.url || payload?.data?.display_url;
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ imageUrl, hostedUrl, provider: "imgbb" }));
        } catch (error: any) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error?.message || "rehost_failed" }));
        }
      });
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// /api/extract 本地代理：抓取网页标题和摘要文字
// ─────────────────────────────────────────────────────────────────────────────
function apiExtractPlugin(): Plugin {
  const MAX_HTML_BYTES = 1_500_000;
  const ALLOWED_CT = ["text/html", "application/xhtml+xml", "text/plain"];

  function isPrivate(host: string): boolean {
    const h = host.toLowerCase();
    return !h || h === "localhost" || h === "::1" || h.endsWith(".local") ||
      /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h);
  }

  function stripHtml(s: string): string {
    return s.replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
      .replace(/\s+/g, " ").trim();
  }

  return {
    name: "vite-plugin-api-extract",
    configureServer(server) {
      server.middlewares.use("/api/extract", async (req, res) => {
        if (req.method !== "POST") {
          res.writeHead(405, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        let body: any = {};
        try { body = JSON.parse(Buffer.concat(chunks).toString("utf-8")); } catch { /* ignore */ }

        const targetUrl = String(body.url || "").trim();
        if (!/^https?:\/\//i.test(targetUrl)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "url must be a valid http(s) url" }));
          return;
        }
        try {
          const parsed = new URL(targetUrl);
          if (isPrivate(parsed.hostname)) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "private_network_url_not_allowed" }));
            return;
          }
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "url_parse_failed" }));
          return;
        }

        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 12000);
          const response = await fetch(targetUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; Jacky-Studio-ResearchBot/1.0)" },
            signal: ctrl.signal,
          }).finally(() => clearTimeout(t));

          if (!response.ok) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: `fetch_failed_${response.status}` }));
            return;
          }
          const ct = response.headers.get("content-type") || "";
          if (!ALLOWED_CT.some(t => ct.toLowerCase().includes(t))) {
            res.writeHead(415, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "unsupported_content_type", contentType: ct }));
            return;
          }
          const bytes = await response.arrayBuffer();
          if (bytes.byteLength > MAX_HTML_BYTES) {
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "content_too_large" }));
            return;
          }
          const html = new TextDecoder().decode(bytes);
          const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          const title = titleMatch ? stripHtml(titleMatch[1] || "") : "";
          const cleanedText = stripHtml(html);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ url: response.url || targetUrl, title, cleanedText, excerpt: cleanedText.slice(0, 1200), length: cleanedText.length }));
        } catch (error: any) {
          if (error?.name === "AbortError") {
            res.writeHead(504, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "extract_timeout" }));
          } else {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: error?.message || "extract_failed" }));
          }
        }
      });
    },
  };
}

function apiExtractCompetitorDeckPlugin(): Plugin {
  const MAX_HTML_BYTES = 2_000_000;
  const MAX_IMAGES = 16;
  const ALLOWED_CT = ["text/html", "application/xhtml+xml", "text/plain"];
  const KNOWN_IMAGE_HOST_PATTERN =
    /(alicdn\.com|360buyimg\.com|jd\.com|amazon\.com|ssl-images-amazon\.com|media-amazon\.com|pinduoduo|yangkeduo|qpic\.cn|byteimg\.com|douyinpic\.com|xiaohongshu|xhscdn\.com)/i;

  function isPrivate(host: string): boolean {
    const h = String(host || "").toLowerCase();
    return (
      !h ||
      h === "localhost" ||
      h === "::1" ||
      h.endsWith(".local") ||
      /^127\./.test(h) ||
      /^10\./.test(h) ||
      /^192\.168\./.test(h) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h)
    );
  }

  function stripHtml(s: string): string {
    return String(s || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/\s+/g, " ")
      .trim();
  }

  function decodeHtmlEntity(value: string): string {
    return String(value || "")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">");
  }

  function pickSrcFromSrcset(value: string): string {
    return String(value || "")
      .split(",")
      .map((item) => item.trim().split(/\s+/)[0] || "")
      .find(Boolean) || "";
  }

  function resolveImageUrl(candidate: string, baseUrl: string): string | null {
    const normalized = decodeHtmlEntity(String(candidate || "").trim());
    if (!normalized) return null;
    if (/^(data:|blob:|javascript:)/i.test(normalized)) return null;
    if (/^\/\//.test(normalized)) {
      return `https:${normalized}`;
    }

    try {
      const resolved = new URL(normalized, baseUrl);
      return /^https?:\/\//i.test(resolved.toString()) ? resolved.toString() : null;
    } catch {
      return null;
    }
  }

  function collectMatches(pattern: RegExp, html: string): string[] {
    const matches: string[] = [];
    const regex = new RegExp(pattern.source, pattern.flags);
    let result: RegExpExecArray | null = null;
    while ((result = regex.exec(html))) {
      matches.push(result[1] || "");
    }
    return matches;
  }

  function detectPlatformHint(hostname: string): string {
    const host = String(hostname || "").toLowerCase();
    if (/(taobao|tmall)/.test(host)) return "淘宝 / 天猫";
    if (/(jd\.com|3.cn)/.test(host)) return "京东";
    if (/(pinduoduo|yangkeduo)/.test(host)) return "拼多多";
    if (/amazon\./.test(host)) return "Amazon";
    if (/(douyin)/.test(host)) return "抖音";
    if (/(xiaohongshu|xhslink|xhscdn)/.test(host)) return "小红书";
    return "通用商品页";
  }

  function isTaobaoFamilyHost(hostname: string): boolean {
    return /(taobao|tmall)/i.test(String(hostname || "").toLowerCase());
  }

  function extractMarketplaceItemId(targetUrl: string): string | null {
    try {
      const parsed = new URL(targetUrl);
      const itemId = String(parsed.searchParams.get("id") || "").trim();
      return /^\d{6,}$/.test(itemId) ? itemId : null;
    } catch {
      return null;
    }
  }

  function readPageTitle(html: string): string {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return stripHtml(titleMatch?.[1] || "");
  }

  function looksLikeTaobaoLoginGate(html: string): boolean {
    return (
      /login\.taobao\.com\/member\/login\.jhtml/i.test(html) ||
      /login\.m\.taobao\.com\/login\.htm/i.test(html) ||
      /window\._config_\s*=\s*\{\s*"action"\s*:\s*"login"/i.test(html) ||
      /\/page\/(?:login_jump|set_x5referer)/i.test(html)
    );
  }

  function looksLikeTaobaoClientShell(html: string): boolean {
    return (
      /<title[^>]*>\s*商品详情页\s*<\/title>/i.test(html) &&
      /window\.bundleSrc/i.test(html) &&
      /h5-tb-detail/i.test(html)
    );
  }

  function summarizeCandidateOrigins(
    images: Array<{ origin: string }>,
  ): Record<string, number> {
    return images.reduce<Record<string, number>>((accumulator, image) => {
      const key = String(image.origin || "unknown").trim() || "unknown";
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {});
  }

  async function fetchHtmlDocument(
    targetUrl: string,
    userAgent: string,
  ): Promise<{
    resolvedUrl: string;
    contentType: string;
    html: string;
  }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": userAgent,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`fetch_failed_${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (!ALLOWED_CT.some((item) => contentType.toLowerCase().includes(item))) {
        const unsupportedError = new Error("unsupported_content_type");
        (unsupportedError as Error & { contentType?: string }).contentType = contentType;
        throw unsupportedError;
      }

      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > MAX_HTML_BYTES) {
        throw new Error("content_too_large");
      }

      return {
        resolvedUrl: response.url || targetUrl,
        contentType,
        html: new TextDecoder().decode(bytes),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  function scoreImage(url: string, context: string): number {
    const joined = `${url} ${context}`.toLowerCase();
    let score = 0;

    if (/\.(png|jpe?g|webp)(?:[?#]|$)/i.test(url)) score += 2;
    if (KNOWN_IMAGE_HOST_PATTERN.test(url)) score += 3;
    if (/(detail|desc|gallery|hero|main|product|banner|sku|scene|selling)/i.test(joined)) score += 4;
    if (/(1080|1200|1440|1920|2048|source|origin|raw)/i.test(joined)) score += 2;
    if (/(auctionimages|detailimages|detailgallery|swiper|mainimages|imagepath|lazyloaded)/i.test(joined)) score += 3;
    if (/(icon|logo|avatar|thumb|thumbnail|sprite|emoji|placeholder|loading|badge|qr|favicon)/i.test(joined)) score -= 6;
    if (/\.gif(?:[?#]|$)/i.test(url)) score -= 4;

    return score;
  }

  function extractCandidateImages(
    html: string,
    baseUrl: string,
    platformHint: string,
  ): Array<{ url: string; name?: string; score: number; origin: string }> {
    const seen = new Set<string>();
    const candidates: Array<{ url: string; name?: string; score: number; origin: string }> = [];

    const pushCandidate = (rawUrl: string, origin: string, context = "", name = "") => {
      const resolved = resolveImageUrl(rawUrl, baseUrl);
      if (!resolved || seen.has(resolved)) return;
      seen.add(resolved);
      const score = scoreImage(resolved, `${platformHint} ${origin} ${context} ${name}`);
      if (score < -2) return;
      candidates.push({
        url: resolved,
        name: String(name || "").trim() || undefined,
        score,
        origin,
      });
    };

    const titleMatches = collectMatches(/<title[^>]*>([\s\S]*?)<\/title>/gi, html);
    const pageTitle = stripHtml(titleMatches[0] || "");

    for (const ogImage of collectMatches(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi, html)) {
      pushCandidate(ogImage, "meta", pageTitle, "og:image");
    }
    for (const twitterImage of collectMatches(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi, html)) {
      pushCandidate(twitterImage, "meta", pageTitle, "twitter:image");
    }

    for (const bgImage of collectMatches(/background-image\s*:\s*url\((?:["']?)([^"')]+)(?:["']?)\)/gi, html)) {
      pushCandidate(bgImage, "style", "", "background-image");
    }

    const imgRegex = /<img\b([^>]+)>/gi;
    let imgMatch: RegExpExecArray | null = null;
    while ((imgMatch = imgRegex.exec(html))) {
      const attrs = imgMatch[1] || "";
      const srcMatch =
        attrs.match(/\s(?:src|data-src|data-original|data-lazy-src|data-ks-lazyload)=["']([^"']+)["']/i) ||
        attrs.match(/\ssrcset=["']([^"']+)["']/i);
      const rawUrl = srcMatch
        ? srcMatch[0].toLowerCase().includes("srcset")
          ? pickSrcFromSrcset(srcMatch[1] || "")
          : srcMatch[1] || ""
        : "";
      const altMatch = attrs.match(/\salt=["']([^"']*)["']/i);
      pushCandidate(rawUrl, "img", attrs, altMatch?.[1] || "");
    }

    const knownHostUrlRegex = new RegExp(
      `"((?:https?:)?\\\\?/\\\\?/[^"\\\\s]*(?:alicdn\\\\.com|360buyimg\\\\.com|jd\\\\.com|media-amazon\\\\.com|ssl-images-amazon\\\\.com|yangkeduo\\\\.com|pinduoduo\\\\.com|qpic\\\\.cn|byteimg\\\\.com|douyinpic\\\\.com|xhscdn\\\\.com)[^"\\\\s]*)"`,
      "gi",
    );
    let knownHostMatch: RegExpExecArray | null = null;
    while ((knownHostMatch = knownHostUrlRegex.exec(html))) {
      const candidate = String(knownHostMatch[1] || "").replace(/\\\//g, "/");
      pushCandidate(candidate, "json-cdn", "", "");
    }

    const quotedImageRegex = /"(https?:[^"\s]+\.(?:png|jpe?g|webp)(?:\?[^"]*)?)"/gi;
    let quotedMatch: RegExpExecArray | null = null;
    while ((quotedMatch = quotedImageRegex.exec(html))) {
      pushCandidate(quotedMatch[1] || "", "json", "", "");
    }

    if (platformHint === "淘宝 / 天猫") {
      for (const item of collectMatches(/"detailImage(?:s|List)?"\s*:\s*"([^"]+)"/gi, html)) {
        pushCandidate(item.replace(/\\\//g, "/"), "taobao-json", "", "detailImage");
      }
      for (const item of collectMatches(/"auctionImages"\s*:\s*\[([\s\S]*?)\]/gi, html)) {
        const urls = item.match(/https?:[^"'\s,\\]+/gi) || [];
        for (const url of urls) pushCandidate(url, "taobao-json", item, "auctionImages");
      }
    }

    if (platformHint === "京东") {
      for (const item of collectMatches(/"imagePath"\s*:\s*"([^"]+)"/gi, html)) {
        pushCandidate(item.replace(/\\\//g, "/"), "jd-json", "", "imagePath");
      }
      for (const item of collectMatches(/"mainImages"\s*:\s*\[([\s\S]*?)\]/gi, html)) {
        const urls = item.match(/https?:[^"'\s,\\]+/gi) || [];
        for (const url of urls) pushCandidate(url, "jd-json", item, "mainImages");
      }
    }

    if (platformHint === "Amazon") {
      for (const item of collectMatches(/"hiRes"\s*:\s*"([^"]+)"/gi, html)) {
        pushCandidate(item.replace(/\\\//g, "/"), "amazon-json", "", "hiRes");
      }
      for (const item of collectMatches(/"large"\s*:\s*"([^"]+)"/gi, html)) {
        pushCandidate(item.replace(/\\\//g, "/"), "amazon-json", "", "large");
      }
    }

    if (platformHint === "拼多多") {
      for (const item of collectMatches(/"(?:goods_gallery_urls|detail_gallery_urls|top_gallery)\"\s*:\s*\[([\s\S]*?)\]/gi, html)) {
        const urls = item.match(/https?:[^"'\s,\\]+/gi) || [];
        for (const url of urls) pushCandidate(url, "pdd-json", item, "gallery");
      }
      for (const item of collectMatches(/"(?:hd_url|hd_thumb_url|image_url|detail_image_url)"\s*:\s*"([^"]+)"/gi, html)) {
        pushCandidate(item.replace(/\\\//g, "/"), "pdd-json", "", "detail");
      }
    }

    if (platformHint === "抖音") {
      for (const item of collectMatches(/"url_list"\s*:\s*\[([\s\S]*?)\]/gi, html)) {
        const urls = item.match(/https?:[^"'\s,\\]+/gi) || [];
        for (const url of urls) pushCandidate(url, "douyin-json", item, "url_list");
      }
      for (const item of collectMatches(/"(?:dynamic_cover|origin_cover|cover_url|product_img)"\s*:\s*"([^"]+)"/gi, html)) {
        pushCandidate(item.replace(/\\\//g, "/"), "douyin-json", "", "cover");
      }
    }

    if (platformHint === "小红书") {
      for (const item of collectMatches(/"url_list"\s*:\s*\[([\s\S]*?)\]/gi, html)) {
        const urls = item.match(/https?:[^"'\s,\\]+/gi) || [];
        for (const url of urls) pushCandidate(url, "xhs-json", item, "url_list");
      }
      for (const item of collectMatches(/"(?:image|image_url|display_image|detail_image)"\s*:\s*"([^"]+)"/gi, html)) {
        pushCandidate(item.replace(/\\\//g, "/"), "xhs-json", "", "image");
      }
    }

    return candidates
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return left.url.localeCompare(right.url);
      })
      .slice(0, MAX_IMAGES);
  }

  function rankCandidateImages(
    candidates: Array<{ url: string; origin: string; name?: string }>,
    baseUrl: string,
    platformHint: string,
  ): Array<{ url: string; name?: string; score: number; origin: string }> {
    const seen = new Set<string>();
    const ranked: Array<{ url: string; name?: string; score: number; origin: string }> = [];

    for (const candidate of candidates) {
      const resolved = resolveImageUrl(candidate.url, baseUrl);
      if (!resolved || seen.has(resolved)) {
        continue;
      }

      seen.add(resolved);
      const score = scoreImage(
        resolved,
        `${platformHint} ${candidate.origin} ${candidate.name || ""}`,
      );
      if (score < -2) {
        continue;
      }

      ranked.push({
        url: resolved,
        name: String(candidate.name || "").trim() || undefined,
        score,
        origin: candidate.origin,
      });
    }

    return ranked
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return left.url.localeCompare(right.url);
      })
      .slice(0, MAX_IMAGES);
  }

  return {
    name: "vite-plugin-api-extract-competitor-deck",
    configureServer(server) {
      server.middlewares.use("/api/extract-competitor-deck", async (req, res) => {
        if (req.method !== "POST") {
          res.writeHead(405, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        let body: any = {};
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        } catch {
          body = {};
        }

        const targetUrl = String(body.url || "").trim();
        const personalClientId = String(body.clientId || "").trim();
        if (!/^https?:\/\//i.test(targetUrl)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "url must be a valid http(s) url" }));
          return;
        }

        try {
          const parsed = new URL(targetUrl);
          if (isPrivate(parsed.hostname)) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "private_network_url_not_allowed" }));
            return;
          }
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "url_parse_failed" }));
          return;
        }

        try {
          const desktopUserAgent = "Mozilla/5.0 (compatible; Jacky-Studio-CompetitorImporter/1.0)";
          const mobileUserAgent =
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
          let personalLaunchOptions: Record<string, any> | undefined;

          const primaryDocument = await fetchHtmlDocument(targetUrl, desktopUserAgent);
          let resolvedUrl = primaryDocument.resolvedUrl;
          let html = primaryDocument.html;
          let platformHint = detectPlatformHint(new URL(resolvedUrl).hostname);
          let title = readPageTitle(html);
          let images = extractCandidateImages(html, resolvedUrl, platformHint);
          let extractionMode: "static" | "browser" = "static";

          const debug: Record<string, any> = {
            resolvedUrl,
            pageTitle: title,
            htmlLength: html.length,
            candidateOrigins: summarizeCandidateOrigins(images),
            loginGateDetected: looksLikeTaobaoLoginGate(html),
            attemptedUrls: [resolvedUrl],
          };

          if (personalClientId) {
            try {
              const personalStatus = getPersonalCompetitorBrowserAuthStatus(personalClientId);
              debug.personalAuth = personalStatus;
              if (personalStatus.configured) {
                const personalPaths = getPersonalBrowserAuthPaths(personalClientId);
                personalLaunchOptions = {
                  profileDir: personalPaths.profileDir,
                  storageStatePath: personalPaths.storageStatePath,
                };
              }
            } catch (error: any) {
              debug.personalAuthError = String(error?.message || "personal_auth_unavailable");
            }
          }

          const itemId =
            extractMarketplaceItemId(resolvedUrl) ||
            extractMarketplaceItemId(targetUrl);

          if (images.length === 0 && isTaobaoFamilyHost(new URL(resolvedUrl).hostname) && itemId) {
            try {
              const mobileUrl = `https://h5.m.taobao.com/awp/core/detail.htm?id=${encodeURIComponent(itemId)}`;
              const mobileDocument = await fetchHtmlDocument(mobileUrl, mobileUserAgent);
              const mobilePlatformHint = detectPlatformHint(new URL(mobileDocument.resolvedUrl).hostname);
              const mobileTitle = readPageTitle(mobileDocument.html);
              const mobileImages = extractCandidateImages(
                mobileDocument.html,
                mobileDocument.resolvedUrl,
                mobilePlatformHint,
              );

              debug.attemptedUrls.push(mobileDocument.resolvedUrl);
              debug.mobilePageTitle = mobileTitle;
              debug.mobileHtmlLength = mobileDocument.html.length;
              debug.mobileCandidateOrigins = summarizeCandidateOrigins(mobileImages);
              debug.mobileShellDetected = looksLikeTaobaoClientShell(mobileDocument.html);

              if (mobileImages.length > 0) {
                resolvedUrl = mobileDocument.resolvedUrl;
                html = mobileDocument.html;
                platformHint = mobilePlatformHint;
                title = mobileTitle;
                images = mobileImages;
              }
            } catch (mobileError: any) {
              debug.mobileFetchError = String(mobileError?.message || "mobile_fetch_failed");
            }
          }

          if (images.length === 0 && isTaobaoFamilyHost(new URL(resolvedUrl).hostname)) {
            const browserTargetUrl =
              debug.attemptedUrls[debug.attemptedUrls.length - 1] || resolvedUrl;

            const browserResult = await tryExtractCompetitorDeckWithBrowser({
              targetUrl: resolvedUrl,
              mobileTargetUrl: browserTargetUrl,
              launchOptions: personalLaunchOptions,
            });

            debug.browserAttempted = true;
            debug.browserStatus = browserResult.status;
            debug.browserDebug = browserResult.debug;

            if (browserResult.status === "success") {
              const browserPlatformHint = browserResult.finalUrl
                ? detectPlatformHint(new URL(browserResult.finalUrl).hostname)
                : platformHint;
              const browserImages = rankCandidateImages(
                browserResult.candidates || [],
                browserResult.finalUrl || browserTargetUrl,
                browserPlatformHint,
              );

              debug.browserCandidateOrigins = summarizeCandidateOrigins(browserImages);

              if (browserImages.length > 0) {
                resolvedUrl = browserResult.finalUrl || resolvedUrl;
                title = browserResult.title || title;
                platformHint = browserPlatformHint;
                images = browserImages;
                extractionMode = "browser";
              }
            } else if (browserResult.status === "login_required") {
              debug.browserLoginRequired = true;
            } else if (browserResult.status === "unavailable") {
              debug.browserUnavailable = true;
            } else if (browserResult.status === "failed") {
              debug.browserFailed = true;
            }
          }

          if (images.length === 0) {
            const errorCode =
              debug.browserLoginRequired
                ? "taobao_browser_login_required"
                : debug.loginGateDetected
                ? "taobao_login_gate_detected"
                : debug.mobileShellDetected
                  ? "taobao_client_render_only"
                  : "no_usable_images_found";

            res.writeHead(422, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              error: errorCode,
              platformHint,
              debug,
            }));
            return;
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            url: resolvedUrl,
            title,
            platformHint,
            extractionMode,
            imageCount: images.length,
            images,
          }));
        } catch (error: any) {
          if (error?.name === "AbortError") {
            res.writeHead(504, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "extract_competitor_deck_timeout" }));
            return;
          }

          if (error?.message === "unsupported_content_type") {
            res.writeHead(415, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              error: "unsupported_content_type",
              contentType: error?.contentType || "",
            }));
            return;
          }

          if (error?.message === "content_too_large") {
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "content_too_large" }));
            return;
          }

          if (/^fetch_failed_\d+$/i.test(String(error?.message || ""))) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: error.message }));
            return;
          }

          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error?.message || "extract_competitor_deck_failed" }));
        }
      });
    },
  };
}

function apiCompetitorBrowserAuthPlugin(): Plugin {
  return {
    name: "vite-plugin-api-competitor-browser-auth",
    configureServer(server) {
      server.middlewares.use("/api/competitor-browser-auth", async (req, res) => {
        const requestUrl = new URL(req.url || "/", "http://localhost");
        const pathname = requestUrl.pathname;
        const normalizedPathname = pathname.startsWith("/api/competitor-browser-auth")
          ? pathname.slice("/api/competitor-browser-auth".length) || "/"
          : pathname;

        const writeJson = (statusCode: number, payload: any) => {
          res.writeHead(statusCode, { "Content-Type": "application/json" });
          res.end(JSON.stringify(payload));
        };

        const readBody = async () => {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          try {
            return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
          } catch {
            return {};
          }
        };

        if (normalizedPathname === "/personal/status") {
          if (req.method !== "GET") {
            writeJson(405, { error: "Method not allowed" });
            return;
          }

          const clientId = String(requestUrl.searchParams.get("clientId") || "").trim();
          if (!clientId) {
            writeJson(400, { error: "client_id_required" });
            return;
          }

          try {
            writeJson(200, getPersonalCompetitorBrowserAuthStatus(clientId));
          } catch (error: any) {
            writeJson(400, { error: String(error?.message || "invalid_client_id") });
          }
          return;
        }

        if (normalizedPathname === "/personal/start-login") {
          if (req.method !== "POST") {
            writeJson(405, { error: "Method not allowed" });
            return;
          }

          const body = await readBody();
          const clientId = String(body.clientId || "").trim();
          if (!clientId) {
            writeJson(400, { error: "client_id_required" });
            return;
          }

          try {
            const currentStatus = getPersonalCompetitorBrowserAuthStatus(clientId);
            if (currentStatus.loginInProgress) {
              writeJson(200, { ok: true, status: currentStatus });
              return;
            }

            const playwright = await import("playwright-core");
            const executablePath = resolveBrowserExecutablePath();
            if (!executablePath) {
              writeJson(503, {
                error: "browser_executable_not_found",
                message: "当前机器未找到可用的 Edge/Chrome，可先安装浏览器后再登录淘宝。",
              });
              return;
            }

            const paths = getPersonalBrowserAuthPaths(clientId);
            const context = await playwright.chromium.launchPersistentContext(
              paths.profileDir,
              {
                executablePath,
                headless: false,
                args: ["--disable-blink-features=AutomationControlled", "--lang=zh-CN"],
                userAgent:
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
                viewport: { width: 1440, height: 960 },
                locale: "zh-CN",
              },
            );

            const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
            await page.goto(
              "https://login.taobao.com/member/login.jhtml?redirectURL=https%3A%2F%2Fh5.m.taobao.com%2Fawp%2Fcore%2Fdetail.htm%3Fid%3D732156220927",
              { waitUntil: "domcontentloaded", timeout: 45000 },
            );
            await registerPersonalBrowserAuthSession({ clientId, context, page });
            writeJson(200, {
              ok: true,
              status: getPersonalCompetitorBrowserAuthStatus(clientId),
            });
          } catch (error: any) {
            writeJson(500, {
              error: String(error?.message || "personal_login_start_failed"),
            });
          }
          return;
        }

        if (normalizedPathname === "/personal/finish-login") {
          if (req.method !== "POST") {
            writeJson(405, { error: "Method not allowed" });
            return;
          }

          const body = await readBody();
          const clientId = String(body.clientId || "").trim();
          if (!clientId) {
            writeJson(400, { error: "client_id_required" });
            return;
          }

          try {
            const session = getActivePersonalBrowserAuthSession(clientId);
            if (!session) {
              writeJson(400, {
                error: "personal_login_session_not_found",
                message:
                  "\u672a\u627e\u5230\u672c\u6b21\u4e2a\u4eba\u6dd8\u5b9d\u767b\u5f55\u4f1a\u8bdd\u3002\u8bf7\u5148\u70b9\u201c\u767b\u5f55\u6dd8\u5b9d\u201d\u6253\u5f00\u4e13\u5c5e\u767b\u5f55\u7a97\u53e3\uff0c\u518d\u5b8c\u6210\u786e\u8ba4\u3002",
              });
              return;
            }

            const validation = await validateTaobaoDetailAccessWithContext({
              context: session.context,
              page: session.page,
            });

            if (!validation.verified) {
              writeJson(409, {
                error: "personal_taobao_login_not_verified",
                message: validation.message,
                validation,
              });
              return;
            }

            const status = await finalizePersonalBrowserAuthSession(clientId);
            writeJson(200, { ok: true, status, validation });
          } catch (error: any) {
            writeJson(400, {
              error: String(error?.message || "personal_login_finish_failed"),
            });
          }
          return;
        }

        if (normalizedPathname === "/personal/clear") {
          if (req.method !== "POST") {
            writeJson(405, { error: "Method not allowed" });
            return;
          }

          const body = await readBody();
          const clientId = String(body.clientId || "").trim();
          if (!clientId) {
            writeJson(400, { error: "client_id_required" });
            return;
          }

          try {
            const status = await clearPersonalBrowserAuthSession(clientId);
            writeJson(200, { ok: true, status });
          } catch (error: any) {
            writeJson(400, {
              error: String(error?.message || "personal_login_clear_failed"),
            });
          }
          return;
        }

        if (normalizedPathname === "/status") {
          writeJson(410, {
            error: "shared_competitor_browser_auth_disabled",
            message:
              "\u5171\u4eab\u6dd8\u5b9d\u767b\u5f55\u6001\u5165\u53e3\u5df2\u4e0b\u7ebf\uff0c\u8bf7\u6539\u7528\u5de5\u4f5c\u6d41\u91cc\u7684\u201c\u4ec5\u4f9b\u6211\u81ea\u5df1\u4f7f\u7528\u201d\u4e2a\u4eba\u767b\u5f55\u6001\u6d41\u7a0b\u3002",
          });
          return;
        }

        if (normalizedPathname === "/storage-state/import") {
          writeJson(410, {
            error: "shared_competitor_browser_auth_disabled",
            message:
              "\u5171\u4eab storage state \u5bfc\u5165\u5df2\u4e0b\u7ebf\uff0c\u4e3a\u907f\u514d\u8bef\u628a\u4e2a\u4eba\u6dd8\u5b9d\u8d26\u53f7\u5199\u5165\u5168\u7ad9\u5171\u4eab\u6001\u3002",
          });
          return;
        }

        if (normalizedPathname === "/storage-state/clear") {
          writeJson(410, {
            error: "shared_competitor_browser_auth_disabled",
            message:
              "\u5171\u4eab storage state \u6e05\u7406\u5165\u53e3\u5df2\u4e0b\u7ebf\uff0c\u8bf7\u4e0d\u518d\u4f7f\u7528\u8fd9\u6761\u5171\u4eab\u767b\u5f55\u6001\u94fe\u8def\u3002",
          });
          return;
        }

        if (normalizedPathname === "/storage-state/export") {
          writeJson(410, {
            error: "shared_competitor_browser_auth_disabled",
            message:
              "\u5171\u4eab storage state \u5bfc\u51fa\u5165\u53e3\u5df2\u4e0b\u7ebf\uff0c\u8bf7\u4ec5\u4f7f\u7528\u5f53\u524d\u6d4f\u89c8\u5668\u7684\u4e2a\u4eba\u767b\u5f55\u6001\u3002",
          });
          return;
        }

        writeJson(404, { error: "Not found" });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  const geminiKey = env.VITE_GEMINI_API_KEY || "";
  return {
    base: "/", // 确保基础路径正确
    server: {
      port: 3001,
      host: "0.0.0.0",
      watch: {
        ignored: [
          "**/.jk-studio-runtime/**",
          "**/.xc-studio-runtime/**",
        ],
      },
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    plugins: [
      react(),
      apiFetchImagePlugin(),
      apiSearchPlugin(),
      apiRehostImagePlugin(),
      apiExtractPlugin(),
      apiExtractCompetitorDeckPlugin(),
      apiCompetitorBrowserAuthPlugin(),
      apiCompetitorAnalysisDebugPlugin(),
      apiCompetitorVisionSmokeDebugPlugin(),
      apiEcommerceProductAnalysisDebugPlugin(),
      apiEcommerceSupplementDebugPlugin(),
      apiEcommerceWorkflowDebugPlugin(),
      apiCompetitorPageImportPlugin(),
    ],
    build: {
      outDir: "dist",
      assetsDir: "assets",
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            "react-vendor": ["react", "react-dom", "react-router-dom"],
            "ui-vendor": ["lucide-react", "framer-motion"],
          },
        },
      },
    },
    define: {
      "process.env.GEMINI_API_KEY": JSON.stringify(geminiKey),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
      dedupe: ["react", "react-dom"],
    },
  };
});
