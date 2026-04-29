export type ExtractedCompetitorDeckImage = {
  url: string;
  name?: string;
  score?: number;
  origin?: string;
  width?: number;
  height?: number;
};

export type ExtractedCompetitorDeck = {
  url: string;
  title: string;
  platformHint?: string;
  extractionMode?: "static" | "browser";
  images: ExtractedCompetitorDeckImage[];
};

export type CompetitorDeckExtractErrorCode =
  | "taobao_login_gate_detected"
  | "taobao_client_render_only"
  | "taobao_browser_login_required"
  | "no_usable_images_found"
  | "unsupported_content_type"
  | "content_too_large"
  | "extract_competitor_deck_timeout"
  | "url_parse_failed"
  | "private_network_url_not_allowed"
  | `fetch_failed_${number}`
  | string;

export class CompetitorDeckExtractError extends Error {
  code: CompetitorDeckExtractErrorCode;
  status: number;
  payload: any;

  constructor(options: {
    code: CompetitorDeckExtractErrorCode;
    message: string;
    status: number;
    payload: any;
  }) {
    super(options.message);
    this.name = "CompetitorDeckExtractError";
    this.code = options.code;
    this.status = options.status;
    this.payload = options.payload;
  }
}

const normalizeUrl = (value: string): string => String(value || "").trim();

const normalizeCompetitorExtractError = (
  payload: any,
  status: number,
): string => {
  const rawError = String(payload?.message || payload?.error || "").trim();
  const platformHint = String(payload?.platformHint || "").trim();
  const platformLabel = platformHint ? `${platformHint}链接` : "该商品链接";

  if (rawError === "taobao_login_gate_detected") {
    return `${platformLabel}当前打开到的是淘宝/天猫的登录或风控跳转页，不是真正的商品详情内容，所以系统拿不到商品图和详情图。这个链接本身可以访问，但服务端抓取会先被站点拦住。建议先改用可直接访问的详情页链接，或直接上传商品图/详情页截图。`;
  }

  if (rawError === "taobao_client_render_only") {
    return `${platformLabel}已经进入淘宝移动详情壳页，但图片内容需要在浏览器里再跑前端脚本后才会出现，当前服务端静态抓取不到真实商品图。建议直接上传截图，或后续接入更重型的浏览器级抓取。`;
  }

  if (rawError === "taobao_browser_login_required") {
    return `${platformLabel}已经切到浏览器级抓取，但淘宝真实详情接口仍然要求登录态或命中了风控校验，所以现在还是拿不到商品图。你可以直接上传详情页截图，或在本机提供已登录的浏览器状态后再重试。`;
  }

  if (rawError === "no_usable_images_found" || status === 422) {
    return `${platformLabel}已成功打开，但当前规则没有抓到可用的商品图或详情图。常见原因是详情内容由脚本动态加载、需要登录、或站点做了反爬限制。建议优先换 PC 详情页链接，或直接上传截图。`;
  }

  if (rawError === "unsupported_content_type") {
    return "这个链接返回的不是可解析的商品网页内容，暂时不能直接做竞品抓图。";
  }

  if (rawError === "content_too_large") {
    return "这个商品页内容过大，当前抓取器没有完成解析。建议换更直接的商品详情页链接。";
  }

  if (rawError === "extract_competitor_deck_timeout") {
    return "商品链接解析超时，目标站点响应太慢或限制了抓取。请稍后重试。";
  }

  if (/^fetch_failed_403$/i.test(rawError)) {
    return "目标站点拒绝了当前抓取请求（403），大概率有反爬限制。建议改用可直接访问的商品页，或手动上传截图。";
  }

  if (/^fetch_failed_404$/i.test(rawError)) {
    return "这个商品链接返回 404，页面可能已失效或地址不完整。";
  }

  if (/^fetch_failed_\d+$/i.test(rawError)) {
    return `目标站点当前返回了 ${rawError.replace("fetch_failed_", "")}，暂时无法完成商品页抓取。`;
  }

  if (rawError === "url_parse_failed") {
    return "商品链接格式不正确，请检查后重试。";
  }

  if (rawError === "private_network_url_not_allowed") {
    return "暂不支持解析局域网或本地地址。";
  }

  return rawError || `extract_competitor_deck_failed_${status}`;
};

const dataUrlToFile = (
  dataUrl: string,
  filename: string,
  fallbackMimeType = "image/jpeg",
): File => {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid data URL returned by image proxy.");
  }

  const mimeType = match[1] || fallbackMimeType;
  const base64 = match[2] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], filename, {
    type: mimeType,
    lastModified: Date.now(),
  });
};

const inferFilename = (
  imageUrl: string,
  fallbackIndex: number,
  mimeType?: string,
): string => {
  let extension = "jpg";

  if (mimeType === "image/png") extension = "png";
  else if (mimeType === "image/webp") extension = "webp";
  else if (mimeType === "image/gif") extension = "gif";

  try {
    const pathname = new URL(imageUrl).pathname || "";
    const lastSegment = pathname.split("/").filter(Boolean).pop() || "";
    const cleaned = lastSegment.replace(/[?#].*$/, "");
    if (/\.[a-z0-9]{2,5}$/i.test(cleaned)) {
      return cleaned;
    }
  } catch {
    // Ignore URL parsing issues and fall back to a generated filename.
  }

  return `competitor-import-${fallbackIndex + 1}.${extension}`;
};

export async function extractCompetitorDeckFromUrl(
  url: string,
  options?: {
    clientId?: string | null;
  },
): Promise<ExtractedCompetitorDeck> {
  const targetUrl = normalizeUrl(url);
  if (!/^https?:\/\//i.test(targetUrl)) {
    throw new Error("Please enter a valid product URL.");
  }

  const response = await fetch("/api/extract-competitor-deck", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: targetUrl,
      clientId: String(options?.clientId || "").trim() || undefined,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code = String(payload?.error || payload?.message || "").trim() || `extract_competitor_deck_failed_${response.status}`;
    throw new CompetitorDeckExtractError({
      code,
      message: normalizeCompetitorExtractError(payload, response.status),
      status: response.status,
      payload,
    });
  }

  const images = Array.isArray(payload?.images)
    ? payload.images
        .map((image: any) => ({
          url: normalizeUrl(image?.url),
          name: String(image?.name || "").trim() || undefined,
          score:
            typeof image?.score === "number" && Number.isFinite(image.score)
              ? image.score
              : undefined,
          origin: String(image?.origin || "").trim() || undefined,
          width:
            typeof image?.width === "number" && Number.isFinite(image.width)
              ? image.width
              : undefined,
          height:
            typeof image?.height === "number" && Number.isFinite(image.height)
              ? image.height
              : undefined,
        }))
        .filter((image) => /^https?:\/\//i.test(image.url))
    : [];

  return {
    url: normalizeUrl(payload?.url || targetUrl),
    title: String(payload?.title || "").trim(),
    platformHint: String(payload?.platformHint || "").trim() || undefined,
    extractionMode:
      payload?.extractionMode === "browser" ? "browser" : "static",
    images,
  };
}

export async function fetchCompetitorImportImageFile(
  imageUrl: string,
  fallbackIndex: number,
): Promise<File> {
  const normalizedImageUrl = normalizeUrl(imageUrl);
  if (!/^https?:\/\//i.test(normalizedImageUrl)) {
    throw new Error("Invalid competitor image URL.");
  }

  const response = await fetch("/api/fetch-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageUrl: normalizedImageUrl }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.dataUrl) {
    const detail =
      String(payload?.error || payload?.message || "").trim() ||
      `fetch_competitor_image_failed_${response.status}`;
    throw new Error(detail);
  }

  const mimeType = String(payload?.mimeType || "image/jpeg");
  const filename = inferFilename(normalizedImageUrl, fallbackIndex, mimeType);
  return dataUrlToFile(String(payload.dataUrl), filename, mimeType);
}
