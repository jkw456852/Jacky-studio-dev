import { getPersonalCompetitorBrowserClientId } from "./competitor-browser-personal-auth";
import type { ExtractedCompetitorDeck } from "./ecommerce-competitor-import";

export type CompetitorLivePageImportPreview = ExtractedCompetitorDeck & {
  importId: string;
  submittedAt: string;
  source: "taobao-live-page";
};

function getClientId(clientId?: string | null): string {
  return String(clientId || "").trim() || getPersonalCompetitorBrowserClientId();
}

function getAppOrigin(appOrigin?: string | null): string {
  if (String(appOrigin || "").trim()) {
    return String(appOrigin).trim().replace(/\/+$/, "");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }
  throw new Error("app_origin_unavailable");
}

export function buildTaobaoCurrentPageImportScript(options?: {
  clientId?: string | null;
  appOrigin?: string | null;
}): string {
  const clientId = getClientId(options?.clientId);
  const appOrigin = getAppOrigin(options?.appOrigin);
  const bridgeUrl = `${appOrigin}/competitor-live-import.html`;
  const config = JSON.stringify({ clientId, bridgeUrl });

  return [
    "(async () => {",
    `  const CONFIG = ${config};`,
    "  const reservedWindow = (() => {",
    "    try {",
    "      return window.open('', '_blank');",
    "    } catch (error) {",
    "      return null;",
    "    }",
    "  })();",
    "  const normalizeUrl = (value) => {",
    "    const raw = String(value || '').trim();",
    "    if (!raw || raw.startsWith('data:')) return '';",
    "    if (/^https?:\\/\\//i.test(raw)) return raw;",
    "    if (raw.startsWith('//')) return location.protocol + raw;",
    "    if (raw.startsWith('/')) return location.origin + raw;",
    "    return '';",
    "  };",
    "  const isLikelyImageUrl = (value) => {",
    "    const url = normalizeUrl(value);",
    "    if (!url) return false;",
    "    if (/\\.(css|js|map|json|html?|woff2?|ttf|eot)(?:$|[?#])/i.test(url)) return false;",
    "    if (/\\.(png|jpe?g|webp|gif|bmp|avif)(?:$|[?#_])/i.test(url)) return true;",
    "    return /(img\\.alicdn|gw\\.alicdn|gtms\\d+\\.alicdn|imgextra|bao\\/uploaded|uploaded\\/i\\d+\\/|O1CN)/i.test(url);",
    "  };",
    "  const imageMap = new Map();",
    "  const pushImage = (value, origin, name, extraScore) => {",
    "    const url = normalizeUrl(value);",
    "    if (!url) return;",
    "    if (!isLikelyImageUrl(url)) return;",
    "    if (/\\.(svg)(\\?|$)/i.test(url)) return;",
    "    const existing = imageMap.get(url);",
    "    const nextScore = [",
    "      /dom-img/i.test(origin || '') ? 4 : 0,",
    "      /(alicdn|tbcdn|taobaocdn|imgextra|img\\.alicdn|gw\\.alicdn)/i.test(url) ? 3 : 0,",
    "      /(detail|desc|content|sku|main|auction|item)/i.test(url) ? 1 : 0,",
    "      /(icon|logo|avatar|wangwang|member|shopmanager|51-24|172-108)/i.test(url) ? -3 : 0,",
    "      /_(50x50|60x60|80x80|100x100|120x120)/i.test(url) ? -2 : 0,",
    "      Number.isFinite(extraScore) ? extraScore : 0,",
    "    ].reduce((sum, item) => sum + item, 0);",
    "    if (existing) {",
    "      existing.score = Math.max(existing.score || 0, nextScore);",
    "      existing.origin = existing.origin || origin || undefined;",
    "      existing.name = existing.name || name || undefined;",
    "      return;",
    "    }",
    "    imageMap.set(url, {",
    "      url,",
    "      origin: origin || undefined,",
    "      name: name || undefined,",
    "      score: nextScore,",
    "      width: undefined,",
    "      height: undefined,",
    "    });",
    "  };",
    "  const updateImageDimensions = (value, width, height) => {",
    "    const url = normalizeUrl(value);",
    "    if (!url) return;",
    "    const current = imageMap.get(url);",
    "    if (!current) return;",
    "    const nextWidth = Number(width || 0);",
    "    const nextHeight = Number(height || 0);",
    "    if (nextWidth > 0) current.width = Math.max(Number(current.width || 0), nextWidth);",
    "    if (nextHeight > 0) current.height = Math.max(Number(current.height || 0), nextHeight);",
    "  };",
    "  const scrollForLazyContent = async () => {",
    "    const maxScrollTop = Math.max(",
    "      document.documentElement ? document.documentElement.scrollHeight - window.innerHeight : 0,",
    "      document.body ? document.body.scrollHeight - window.innerHeight : 0,",
    "      0",
    "    );",
    "    if (maxScrollTop <= 0) return;",
    "    const originalTop = window.scrollY || window.pageYOffset || 0;",
    "    const steps = 8;",
    "    for (let index = 1; index <= steps; index += 1) {",
    "      const nextTop = Math.round((maxScrollTop * index) / steps);",
    "      window.scrollTo({ top: nextTop, behavior: 'auto' });",
    "      await new Promise((resolve) => setTimeout(resolve, 220));",
    "    }",
    "    await new Promise((resolve) => setTimeout(resolve, 320));",
    "    window.scrollTo({ top: originalTop, behavior: 'auto' });",
    "    await new Promise((resolve) => setTimeout(resolve, 120));",
    "  };",
    "  await scrollForLazyContent();",
    "  document.querySelectorAll('img').forEach((img, index) => {",
    "    const el = img;",
    "    const sizeBonus = (() => {",
    "      const width = Number(el.naturalWidth || el.width || 0);",
    "      const height = Number(el.naturalHeight || el.height || 0);",
    "      const minEdge = Math.min(width || 0, height || 0);",
    "      if (minEdge >= 320) return 2;",
    "      if (minEdge >= 180) return 1;",
    "      if (minEdge > 0 && minEdge < 80) return -4;",
    "      if (minEdge > 0 && minEdge < 140) return -2;",
    "      return 0;",
    "    })();",
    "    [el.currentSrc, el.src, el.getAttribute('data-src'), el.getAttribute('data-ks-lazyload')].forEach((value) => {",
    "      pushImage(value, 'dom-img', el.alt || ('image-' + (index + 1)), sizeBonus);",
    "      updateImageDimensions(value, el.naturalWidth || el.width || 0, el.naturalHeight || el.height || 0);",
    "    });",
    "  });",
    "  document.querySelectorAll('[style*=\"background-image\"]').forEach((node) => {",
    "    const style = String(node.getAttribute('style') || '');",
    "    const matches = style.match(/url\\((['\"]?)(.*?)\\1\\)/gi) || [];",
    "    matches.forEach((item) => {",
    "      const matched = item.match(/url\\((['\"]?)(.*?)\\1\\)/i);",
    "      pushImage(matched && matched[2], 'background-image');",
    "    });",
    "  });",
    "  const html = document.documentElement ? document.documentElement.outerHTML : '';",
    "  const htmlMatches = html.match(/https?:\\/\\/[^\\\"'`\\\\s<>()]*(?:alicdn|tbcdn|taobaocdn|imgextra|img\\.alicdn|gw\\.alicdn)[^\\\"'`\\\\s<>()]*/gi) || [];",
    "  htmlMatches.forEach((url) => pushImage(url, 'html-regex'));",
    "  if (typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function') {",
    "    performance.getEntriesByType('resource').forEach((entry) => {",
    "      pushImage(entry && entry.name, 'performance');",
    "    });",
    "  }",
    "  const images = Array.from(imageMap.values())",
    "    .sort((left, right) => (right.score || 0) - (left.score || 0))",
    "    .slice(0, 99);",
    "  if (images.length === 0) throw new Error('NO_USABLE_IMAGES_FOUND');",
    "  const payload = {",
    "    clientId: CONFIG.clientId,",
    "    source: 'taobao-live-page',",
    "    pageUrl: location.href,",
    "    title: (document.title || '').trim() || location.href,",
    "    platformHint: /tmall/i.test(location.hostname) ? '天猫' : /taobao/i.test(location.hostname) ? '淘宝' : location.hostname,",
    "    images,",
    "  };",
    "  const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));",
    "  const targetUrl = CONFIG.bridgeUrl + '#payload=' + encoded;",
    "  if (reservedWindow && !reservedWindow.closed) {",
    "    try {",
    "      reservedWindow.location.href = targetUrl;",
    "      alert('已打开 XC Studio 导入桥接页。请在桥接页完成提交后，回到工作流点击“读取最近一次导入结果”。共整理 ' + images.length + ' 张图。');",
    "      return { ok: true, imageCount: images.length, mode: 'popup' };",
    "    } catch (error) {",
    "      try { reservedWindow.close(); } catch (_) {}",
    "    }",
    "  }",
    "  location.href = targetUrl;",
    "  return { ok: true, imageCount: images.length };",
    "})().catch((error) => {",
    "  alert('当前页导入失败：' + String((error && error.message) || error || 'UNKNOWN_ERROR'));",
    "  throw error;",
    "});",
  ].join("\n");
}

export async function copyTaobaoCurrentPageImportScript(options?: {
  clientId?: string | null;
  appOrigin?: string | null;
}): Promise<string> {
  const script = buildTaobaoCurrentPageImportScript(options);
  if (
    typeof navigator === "undefined" ||
    !navigator.clipboard ||
    typeof navigator.clipboard.writeText !== "function"
  ) {
    throw new Error("clipboard_write_unavailable");
  }
  await navigator.clipboard.writeText(script);
  return script;
}

async function readJson(response: Response): Promise<any> {
  return response.json().catch(() => null);
}

export async function consumeLatestCompetitorLivePageImport(options?: {
  clientId?: string | null;
}): Promise<CompetitorLivePageImportPreview> {
  const clientId = getClientId(options?.clientId);
  const response = await fetch("/api/competitor-page-import/pending/latest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ clientId }),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    const message =
      String(payload?.message || payload?.error || "").trim() ||
      "consume_live_page_import_failed";
    throw new Error(message);
  }

  return {
    importId: String(payload?.importId || "").trim(),
    submittedAt: String(payload?.submittedAt || "").trim(),
    source: "taobao-live-page",
    url: String(payload?.url || "").trim(),
    title: String(payload?.title || "").trim(),
    platformHint: String(payload?.platformHint || "").trim() || undefined,
    extractionMode: payload?.extractionMode === "browser" ? "browser" : "browser",
    images: Array.isArray(payload?.images)
      ? payload.images
          .map((image: any) => ({
            url: String(image?.url || "").trim(),
            name: String(image?.name || "").trim() || undefined,
            score:
              typeof image?.score === "number" && Number.isFinite(image.score)
                ? image.score
                : undefined,
            origin: String(image?.origin || "").trim() || undefined,
          }))
          .filter((image: any) => /^https?:\/\//i.test(image.url))
      : [],
  };
}
