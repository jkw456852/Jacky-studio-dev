type SearchMode = "web+images" | "web" | "images";
type SearchProviderType = "bing" | "searxng" | "tavily" | "exa" | "custom";

type SearchRequest = {
  query: string;
  mode?: SearchMode;
  locale?: string;
  count?: {
    web?: number;
    images?: number;
  };
  safeSearch?: "off" | "moderate" | "strict";
  timeRange?: "day" | "week" | "month" | "year" | "any";
  blockedDomains?: string[];
  provider?: {
    id?: string;
    catalogId?: string;
    providerType?: SearchProviderType;
    apiKey?: string;
    baseUrl?: string;
  };
};

type SearchProviderMeta = {
  web: string;
  images: string;
  fallback?: boolean;
};

const REQUEST_TIMEOUT_MS = 12000;

const DEFAULT_WEB_COUNT = 8;
const DEFAULT_IMAGE_COUNT = 16;

type NormalizedWebItem = {
  id: string;
  title: string;
  url: string;
  displayUrl: string;
  snippet: string;
  publishedTime: string;
  siteName: string;
  excerpt?: string;
  cleanedTextExcerpt?: string;
  length?: number;
};

type NormalizedImageItem = {
  id: string;
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  sourcePageUrl: string;
  width: number;
  height: number;
  contentType: string;
  siteName: string;
};

function asJson(body: any): SearchRequest {
  if (!body) return { query: "" };
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return { query: "" };
    }
  }
  return body as SearchRequest;
}

function toCount(value: unknown, fallback: number, max: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(max, Math.round(num));
}

function toSafeSearch(value: unknown): "Off" | "Moderate" | "Strict" {
  const raw = String(value || "moderate").toLowerCase();
  if (raw === "off") return "Off";
  if (raw === "strict") return "Strict";
  return "Moderate";
}

function mapWebTimeFilter(range: unknown): string {
  const value = String(range || "any").toLowerCase();
  if (value === "day") return "Day";
  if (value === "week") return "Week";
  if (value === "month") return "Month";
  return "";
}

function hostFromUrl(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return "";
  }
}

function normalizeBaseUrl(rawUrl: string): string {
  return String(rawUrl || "").trim().replace(/\/+$/, "");
}

function normalizeSearchProviderType(value: unknown): SearchProviderType {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    normalized === "searxng" ||
    normalized === "tavily" ||
    normalized === "exa" ||
    normalized === "custom"
  ) {
    return normalized;
  }
  return "bing";
}

function normalizeBlockedDomains(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 50);
}

function shouldBlockHost(host: string, blockedDomains: string[]): boolean {
  const normalizedHost = String(host || "").trim().toLowerCase();
  if (!normalizedHost || blockedDomains.length === 0) return false;
  return blockedDomains.some((rule) => {
    const normalizedRule = String(rule || "").trim().toLowerCase();
    if (!normalizedRule) return false;
    return (
      normalizedHost === normalizedRule ||
      normalizedHost.endsWith(`.${normalizedRule}`)
    );
  });
}

function applyBlockedDomains<T extends { url?: string; sourcePageUrl?: string }>(
  items: T[],
  blockedDomains: string[],
): T[] {
  if (blockedDomains.length === 0) return items;
  return items.filter((item) => {
    const primaryHost = hostFromUrl(String(item.url || item.sourcePageUrl || ""));
    const secondaryHost = hostFromUrl(String(item.sourcePageUrl || item.url || ""));
    return (
      !shouldBlockHost(primaryHost, blockedDomains) &&
      !shouldBlockHost(secondaryHost, blockedDomains)
    );
  });
}

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`http_${res.status}`);
    }
    return res.json();
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("search_timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function searchBing(
  query: string,
  mkt: string,
  mode: SearchMode,
  webCount: number,
  imageCount: number,
  safeSearch: "Off" | "Moderate" | "Strict",
  freshness: string,
  key: string,
): Promise<{
  provider: SearchProviderMeta;
  web: NormalizedWebItem[];
  images: NormalizedImageItem[];
  suggestedQueries: string[];
}> {
  const headers = {
    "Ocp-Apim-Subscription-Key": key,
  };

  const webPromise =
    mode === "images"
      ? Promise.resolve(null)
      : fetchJson(
          `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&mkt=${encodeURIComponent(mkt)}&count=${webCount}${freshness ? `&freshness=${freshness}` : ""}`,
          { headers },
        );

  const imagePromise =
    mode === "web"
      ? Promise.resolve(null)
      : fetchJson(
          `https://api.bing.microsoft.com/v7.0/images/search?q=${encodeURIComponent(query)}&mkt=${encodeURIComponent(mkt)}&count=${imageCount}&safeSearch=${safeSearch}`,
          { headers },
        );

  const [webRaw, imageRaw] = await Promise.all([webPromise, imagePromise]);

  const web: NormalizedWebItem[] = (webRaw?.webPages?.value || []).map(
    (item: any, idx: number) => ({
      id: `w_${idx + 1}`,
      title: item?.name || "",
      url: item?.url || "",
      displayUrl: item?.displayUrl || "",
      snippet: item?.snippet || "",
      publishedTime: item?.dateLastCrawled || "",
      siteName: item?.siteName || "",
    }),
  );

  const images: NormalizedImageItem[] = (imageRaw?.value || [])
    .map((item: any, idx: number) => ({
      id: `i_${idx + 1}`,
      title: item?.name || "",
      imageUrl: item?.contentUrl || "",
      thumbnailUrl: item?.thumbnailUrl || "",
      sourcePageUrl: item?.hostPageUrl || "",
      width: Number(item?.width || 0),
      height: Number(item?.height || 0),
      contentType: item?.encodingFormat
        ? `image/${String(item.encodingFormat).toLowerCase()}`
        : "",
      siteName: item?.hostPageDomainFriendlyName || "",
    }))
    .filter((item: NormalizedImageItem) => /^https?:\/\//i.test(item.imageUrl));

  const suggestedQueries = [
    ...(webRaw?.relatedSearches?.value || [])
      .map((q: any) => q?.text)
      .filter(Boolean),
    ...(imageRaw?.queryExpansions || []).map((q: any) => q?.text).filter(Boolean),
  ].slice(0, 8);

  return {
    provider: {
      web: mode === "images" ? "none" : "bing",
      images: mode === "web" ? "none" : "bing",
    },
    web,
    images,
    suggestedQueries,
  };
}

async function searchWikipediaWeb(
  query: string,
  locale: string,
  webCount: number,
): Promise<NormalizedWebItem[]> {
  const lang = locale.toLowerCase().startsWith("zh") ? "zh" : "en";
  const data = await fetchJson(
    `https://${lang}.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=${webCount}`,
  );

  return (data?.pages || []).map((item: any, idx: number) => {
    const url = item?.key
      ? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(item.key).replace(/%20/g, "_")}`
      : "";
    return {
      id: `w_${idx + 1}`,
      title: item?.title || "",
      url,
      displayUrl: hostFromUrl(url),
      snippet: String(item?.excerpt || "").replace(/<[^>]+>/g, " "),
      publishedTime: "",
      siteName: `${lang}.wikipedia.org`,
    };
  });
}

async function searchWikimediaImages(
  query: string,
  imageCount: number,
): Promise<NormalizedImageItem[]> {
  const raw = await fetchJson(
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=${Math.min(imageCount, 30)}&prop=imageinfo&iiprop=url|size|mime`,
  );

  const pages = Object.values(raw?.query?.pages || {}) as any[];
  return pages.map((item: any, idx: number) => {
    const info = item?.imageinfo?.[0] || {};
    const imageUrl = String(info?.url || "");
    const sourcePageUrl = item?.title
      ? `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(item.title).replace(/ /g, "_"))}`
      : "";
    return {
      id: `i_wm_${idx + 1}`,
      title: item?.title || "",
      imageUrl,
      thumbnailUrl: imageUrl,
      sourcePageUrl,
      width: Number(info?.width || 0),
      height: Number(info?.height || 0),
      contentType: info?.mime || "",
      siteName: "commons.wikimedia.org",
    };
  });
}

async function searchOpenverseImages(
  query: string,
  imageCount: number,
): Promise<NormalizedImageItem[]> {
  const raw = await fetchJson(
    `https://api.openverse.org/v1/images?q=${encodeURIComponent(query)}&page_size=${Math.min(imageCount, 20)}`,
  );

  return (raw?.results || []).map((item: any, idx: number) => ({
    id: `i_ov_${idx + 1}`,
    title: item?.title || "",
    imageUrl: item?.url || "",
    thumbnailUrl: item?.thumbnail || "",
    sourcePageUrl: item?.foreign_landing_url || item?.detail_url || "",
    width: Number(item?.width || 0),
    height: Number(item?.height || 0),
    contentType: item?.mime_type || "",
    siteName: item?.source || "openverse",
  }));
}

function dedupeImages(items: NormalizedImageItem[], max: number): NormalizedImageItem[] {
  const seen = new Set<string>();
  const result: NormalizedImageItem[] = [];
  for (const item of items) {
    const key = item.imageUrl.trim();
    if (!/^https?:\/\//i.test(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= max) break;
  }
  return result;
}

async function searchFree(
  query: string,
  locale: string,
  mode: SearchMode,
  webCount: number,
  imageCount: number,
): Promise<{
  provider: SearchProviderMeta;
  web: NormalizedWebItem[];
  images: NormalizedImageItem[];
  suggestedQueries: string[];
}> {
  const webPromise =
    mode === "images"
      ? Promise.resolve([] as NormalizedWebItem[])
      : searchWikipediaWeb(query, locale, webCount).catch(() => []);

  const imagePromise =
    mode === "web"
      ? Promise.resolve([] as NormalizedImageItem[])
      : Promise.all([
          searchWikimediaImages(query, imageCount).catch(() => []),
          searchOpenverseImages(query, imageCount).catch(() => []),
        ]).then(([wm, ov]) => dedupeImages([...wm, ...ov], imageCount));

  const [web, images] = await Promise.all([webPromise, imagePromise]);

  return {
    provider: {
      web: mode === "images" ? "none" : "wikipedia",
      images: mode === "web" ? "none" : "wikimedia+openverse",
      fallback: true,
    },
    web,
    images,
    suggestedQueries: [
      `${query} 风格参考`,
      `${query} 构图`,
      `${query} 文案`,
    ].slice(0, 8),
  };
}

type SearchExecutionResult = {
  provider: SearchProviderMeta;
  web: NormalizedWebItem[];
  images: NormalizedImageItem[];
  suggestedQueries: string[];
};

async function searchSearxng(
  query: string,
  locale: string,
  mode: SearchMode,
  webCount: number,
  imageCount: number,
  safeSearch: "Off" | "Moderate" | "Strict",
  baseUrl: string,
  apiKey?: string,
): Promise<SearchExecutionResult> {
  const rootUrl = normalizeBaseUrl(baseUrl);
  if (!rootUrl) {
    throw new Error("missing_search_base_url");
  }

  const headers: Record<string, string> = {};
  const normalizedKey = String(apiKey || "").trim();
  if (normalizedKey) {
    headers["Authorization"] = `Bearer ${normalizedKey}`;
    headers["X-API-Key"] = normalizedKey;
  }

  const lang = locale.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
  const safeSearchLevel =
    safeSearch === "Off" ? "0" : safeSearch === "Strict" ? "2" : "1";

  const buildSearchUrl = (category: "general" | "images", count: number) =>
    `${rootUrl}${rootUrl.endsWith("/search") ? "" : "/search"}`
    + `?format=json&q=${encodeURIComponent(query)}`
    + `&language=${encodeURIComponent(lang)}`
    + `&categories=${encodeURIComponent(category)}`
    + `&safesearch=${encodeURIComponent(safeSearchLevel)}`
    + `&pageno=1`;

  const webRaw =
    mode === "images"
      ? null
      : await fetchJson(buildSearchUrl("general", webCount), { headers });
  const imageRaw =
    mode === "web"
      ? null
      : await fetchJson(buildSearchUrl("images", imageCount), { headers });

  const web: NormalizedWebItem[] = (webRaw?.results || [])
    .map((item: any, idx: number) => ({
      id: `w_sx_${idx + 1}`,
      title: String(item?.title || ""),
      url: String(item?.url || ""),
      displayUrl: hostFromUrl(String(item?.url || "")),
      snippet: String(item?.content || item?.snippet || ""),
      publishedTime: String(item?.publishedDate || item?.published_date || ""),
      siteName: String(item?.engine || item?.parsed_url?.[1] || hostFromUrl(String(item?.url || "")) || ""),
    }))
    .filter((item: NormalizedWebItem) => /^https?:\/\//i.test(item.url))
    .slice(0, webCount);

  const images: NormalizedImageItem[] = (imageRaw?.results || [])
    .map((item: any, idx: number) => ({
      id: `i_sx_${idx + 1}`,
      title: String(item?.title || item?.alt || ""),
      imageUrl: String(item?.img_src || item?.image || item?.thumbnail || ""),
      thumbnailUrl: String(item?.thumbnail_src || item?.thumbnail || item?.img_src || ""),
      sourcePageUrl: String(item?.url || item?.source_url || ""),
      width: Number(item?.width || 0),
      height: Number(item?.height || 0),
      contentType: String(item?.content_type || ""),
      siteName: String(item?.engine || hostFromUrl(String(item?.url || "")) || ""),
    }))
    .filter((item: NormalizedImageItem) => /^https?:\/\//i.test(item.imageUrl))
    .slice(0, imageCount);

  const suggestedQueries = Array.from(
    new Set([...(webRaw?.suggestions || []), ...(imageRaw?.suggestions || [])]),
  )
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 8);

  return {
    provider: {
      web: mode === "images" ? "none" : "searxng",
      images: mode === "web" ? "none" : "searxng",
    },
    web,
    images,
    suggestedQueries,
  };
}

async function searchTavily(
  query: string,
  mode: SearchMode,
  webCount: number,
  baseUrl: string,
  apiKey: string,
): Promise<SearchExecutionResult> {
  const rootUrl = normalizeBaseUrl(baseUrl) || "https://api.tavily.com";
  const normalizedKey = String(apiKey || "").trim();
  if (!normalizedKey) {
    throw new Error("missing_search_api_key");
  }

  const raw = await fetchJson(
    `${rootUrl}${rootUrl.endsWith("/search") ? "" : "/search"}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${normalizedKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "advanced",
        topic: "general",
        max_results: Math.max(1, Math.min(20, webCount)),
        include_images: mode !== "web",
        include_image_descriptions: false,
        include_answer: "advanced",
        include_raw_content: "text",
        chunks_per_source: 3,
      }),
    },
  );

  const web: NormalizedWebItem[] = (raw?.results || [])
    .map((item: any, idx: number) => ({
      id: `w_tv_${idx + 1}`,
      title: String(item?.title || item?.url || ""),
      url: String(item?.url || ""),
      displayUrl: hostFromUrl(String(item?.url || "")),
      snippet: String(item?.content || ""),
      publishedTime: String(item?.published_date || ""),
      siteName: hostFromUrl(String(item?.url || "")),
      excerpt: String(item?.content || "").trim() || undefined,
      cleanedTextExcerpt: String(
        item?.raw_content || item?.content || "",
      ).trim() || undefined,
      length: typeof item?.raw_content === "string"
        ? item.raw_content.length
        : typeof item?.content === "string"
          ? item.content.length
          : undefined,
    }))
    .filter((item: NormalizedWebItem) => /^https?:\/\//i.test(item.url))
    .slice(0, webCount);

  const images: NormalizedImageItem[] = mode === "web"
    ? []
    : ((raw?.images || []) as any[])
        .map((item: any, idx: number) => {
          const imageUrl = typeof item === "string"
            ? item
            : String(item?.url || item?.image_url || item?.src || "");
          return {
            id: `i_tv_${idx + 1}`,
            title: query,
            imageUrl,
            thumbnailUrl: imageUrl,
            sourcePageUrl: web[idx]?.url || "",
            width: 0,
            height: 0,
            contentType: "",
            siteName: hostFromUrl(web[idx]?.url || ""),
          };
        })
        .filter((item: NormalizedImageItem) => /^https?:\/\//i.test(item.imageUrl))
        .slice(0, DEFAULT_IMAGE_COUNT);

  const suggestedQueries = Array.from(new Set([
    ...web.map((item) => item.title).filter(Boolean),
    String(raw?.answer || "").trim(),
  ]))
    .filter(Boolean)
    .slice(0, 8);

  return {
    provider: {
      web: mode === "images" ? "none" : "tavily",
      images: mode === "web" ? "none" : images.length > 0 ? "tavily" : "none",
    },
    web,
    images,
    suggestedQueries,
  };
}

async function searchExa(
  query: string,
  webCount: number,
  baseUrl: string,
  apiKey: string,
): Promise<SearchExecutionResult> {
  const rootUrl = normalizeBaseUrl(baseUrl) || "https://api.exa.ai";
  const normalizedKey = String(apiKey || "").trim();
  if (!normalizedKey) {
    throw new Error("missing_search_api_key");
  }

  const raw = await fetchJson(
    `${rootUrl}${rootUrl.endsWith("/search") ? "" : "/search"}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": normalizedKey,
      },
      body: JSON.stringify({
        query,
        numResults: Math.max(1, Math.min(20, webCount)),
        type: "auto",
        livecrawl: "always",
        contents: {
          text: {
            maxCharacters: 2400,
          },
          highlights: true,
          summary: true,
        },
      }),
    },
  );

  const web: NormalizedWebItem[] = (raw?.results || [])
    .map((item: any, idx: number) => ({
      id: `w_ex_${idx + 1}`,
      title: String(item?.title || item?.url || ""),
      url: String(item?.url || ""),
      displayUrl: hostFromUrl(String(item?.url || "")),
      snippet: Array.isArray(item?.highlights)
        ? item.highlights.map((entry: unknown) => String(entry || "").trim()).filter(Boolean).join(" ")
        : String(item?.summary || item?.text || ""),
      publishedTime: String(item?.publishedDate || item?.published_date || ""),
      siteName: hostFromUrl(String(item?.url || "")),
      excerpt: String(item?.summary || "").trim() || undefined,
      cleanedTextExcerpt: String(item?.text || "").trim() || undefined,
      length: typeof item?.text === "string" ? item.text.length : undefined,
    }))
    .filter((item: NormalizedWebItem) => /^https?:\/\//i.test(item.url))
    .slice(0, webCount);

  const suggestedQueries = web
    .map((item) => item.title)
    .filter(Boolean)
    .slice(0, 8);

  return {
    provider: {
      web: "exa",
      images: "none",
    },
    web,
    images: [],
    suggestedQueries,
  };
}

const SEARCH_ADAPTERS: Record<
  SearchProviderType,
  (args: {
    query: string;
    locale: string;
    mode: SearchMode;
    webCount: number;
    imageCount: number;
    safeSearch: "Off" | "Moderate" | "Strict";
    freshness: string;
    apiKey: string;
    baseUrl: string;
    envBingKey: string;
    mkt: string;
  }) => Promise<SearchExecutionResult>
> = {
  bing: async ({
    query,
    mode,
    webCount,
    imageCount,
    safeSearch,
    freshness,
    apiKey,
    envBingKey,
    mkt,
    locale,
  }) => {
    void locale;
    const effectiveKey = apiKey || envBingKey;
    if (!effectiveKey) {
      return searchFree(query, "zh-CN", mode, webCount, imageCount);
    }
    return searchBing(
      query,
      mkt,
      mode,
      webCount,
      imageCount,
      safeSearch,
      freshness,
      effectiveKey,
    );
  },
  searxng: async ({
    query,
    locale,
    mode,
    webCount,
    imageCount,
    safeSearch,
    apiKey,
    baseUrl,
  }) => {
    if (!baseUrl) {
      return searchFree(query, locale, mode, webCount, imageCount);
    }
    return searchSearxng(
      query,
      locale,
      mode,
      webCount,
      imageCount,
      safeSearch,
      baseUrl,
      apiKey,
    );
  },
  tavily: async ({ query, locale, mode, webCount, imageCount, apiKey, baseUrl }) => {
    void locale;
    void imageCount;
    return searchTavily(query, mode, webCount, baseUrl, apiKey);
  },
  exa: async ({ query, locale, mode, webCount, imageCount, apiKey, baseUrl }) => {
    void locale;
    void mode;
    void imageCount;
    return searchExa(query, webCount, baseUrl, apiKey);
  },
  custom: async ({
    query,
    locale,
    mode,
    webCount,
    imageCount,
    safeSearch,
    apiKey,
    baseUrl,
  }) => {
    if (!baseUrl) {
      return searchFree(query, locale, mode, webCount, imageCount);
    }
    return searchSearxng(
      query,
      locale,
      mode,
      webCount,
      imageCount,
      safeSearch,
      baseUrl,
      apiKey,
    );
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const envBingKey = process.env.BING_SEARCH_API_KEY;

  const body = asJson(req.body);
  const query = String(body.query || "").trim();
  if (!query) {
    return res.status(400).json({ error: "query is required" });
  }

  const mode: SearchMode =
    body.mode === "images" || body.mode === "web" ? body.mode : "web+images";
  const locale = String(body.locale || "zh-CN");
  const mkt = locale.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
  const webCount = toCount(body.count?.web, DEFAULT_WEB_COUNT, 20);
  const imageCount = toCount(body.count?.images, DEFAULT_IMAGE_COUNT, 50);
  const safeSearch = toSafeSearch(body.safeSearch);
  const freshness = mapWebTimeFilter(body.timeRange);
  const blockedDomains = normalizeBlockedDomains(body.blockedDomains);
  const providerType = normalizeSearchProviderType(
    body.provider?.providerType || body.provider?.catalogId,
  );
  const providerApiKey = String(body.provider?.apiKey || "").trim();
  const providerBaseUrl = String(body.provider?.baseUrl || "").trim();

  const requestId = `srch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const adapter = SEARCH_ADAPTERS[providerType] || SEARCH_ADAPTERS.bing;
    const searchResult = await adapter({
      query,
      locale,
      mode,
      webCount,
      imageCount,
      safeSearch,
      freshness,
      apiKey: providerApiKey,
      baseUrl: providerBaseUrl,
      envBingKey: String(envBingKey || "").trim(),
      mkt,
    });

    const filteredWeb = applyBlockedDomains(searchResult.web, blockedDomains);
    const filteredImages = applyBlockedDomains(searchResult.images, blockedDomains);

    return res.status(200).json({
      requestId,
      query,
      mode,
      provider: {
        ...searchResult.provider,
        fallback:
          Boolean(searchResult.provider.fallback) ||
          ((providerType === "searxng" || providerType === "custom") && !providerBaseUrl) ||
          ((providerType === "tavily" || providerType === "exa") && !providerApiKey) ||
          (providerType === "bing" && !(providerApiKey || envBingKey)),
      },
      web: filteredWeb,
      images: filteredImages,
      hints: {
        suggestedQueries: searchResult.suggestedQueries,
        groups: [],
      },
      limits: {
        webReturned: filteredWeb.length,
        imagesReturned: filteredImages.length,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "search_failed",
      requestId,
      provider: {
        web: "none",
        images: "none",
        fallback: Boolean(envBingKey),
      },
    });
  }
}
