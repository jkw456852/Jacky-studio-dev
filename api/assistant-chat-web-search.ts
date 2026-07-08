import { webSearch as exaWebSearch } from "@exalabs/ai-sdk";
import { perplexitySearch } from "@perplexity-ai/ai-sdk";
import {
  tavilyCrawl,
  tavilyExtract,
  tavilyMap,
  tavilySearch,
} from "@tavily/ai-sdk";
import type { ToolSet } from "ai";

export type AssistantChatSearchProviderType =
  | "bing"
  | "searxng"
  | "tavily"
  | "exa"
  | "perplexity"
  | "custom";

export type AssistantChatSearchProviderConfig = {
  id?: string | null;
  name?: string | null;
  catalogId?: string | null;
  providerType?: AssistantChatSearchProviderType | string | null;
  apiKey?: string | null;
  baseUrl?: string | null;
};

export type AssistantChatSearchDefaultsConfig = {
  enabledByDefault?: boolean;
  mode?: "web+images" | "web" | "images" | string;
  webCount?: number;
  imageCount?: number;
  safeSearch?: "off" | "moderate" | "strict" | string;
  timeRange?: "day" | "week" | "month" | "year" | "any" | string;
  includeDate?: boolean;
  compressionMode?: "none" | "balanced" | string;
  blockedDomains?: string[];
};

export type AssistantChatWebSearchConfig = {
  enabled?: boolean;
  provider?: AssistantChatSearchProviderConfig | null;
  providers?: AssistantChatSearchProviderConfig[];
  activeProviderId?: string | null;
  defaults?: AssistantChatSearchDefaultsConfig | null;
};

export type AssistantChatWebSearchToolResult = {
  tools: ToolSet;
  providerId?: string;
  providerType?: AssistantChatSearchProviderType;
  reason:
    | "disabled"
    | "mode_images_only"
    | "missing_provider"
    | "missing_api_key"
    | "unsupported_provider"
    | "registered";
};

export type AssistantChatWebSearchSource = {
  title: string;
  url: string;
};

const SUPPORTED_PROVIDER_TYPES = new Set<AssistantChatSearchProviderType>([
  "bing",
  "searxng",
  "tavily",
  "exa",
  "perplexity",
  "custom",
]);

const normalizeString = (value: unknown): string => String(value ?? "").trim();

const pickNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (normalized) return normalized;
  }
  return "";
};

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const pickSourceUrl = (record: Record<string, unknown>): string => {
  const directUrl = pickNonEmptyString(
    record.url,
    record.link,
    record.href,
    record.sourceUrl,
    record.source_url,
    record.citationUrl,
    record.citation_url,
    record.displayUrl,
    record.display_url,
  );
  if (isHttpUrl(directUrl)) return directUrl;

  for (const key of ["metadata", "citation", "reference", "source"]) {
    const nested = record[key];
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) continue;
    const nestedUrl = pickSourceUrl(nested as Record<string, unknown>);
    if (nestedUrl) return nestedUrl;
  }

  return "";
};

const normalizeProviderType = (
  value: unknown,
): AssistantChatSearchProviderType | undefined => {
  const normalized = normalizeString(value).toLowerCase();
  return SUPPORTED_PROVIDER_TYPES.has(
    normalized as AssistantChatSearchProviderType,
  )
    ? (normalized as AssistantChatSearchProviderType)
    : undefined;
};

const getEnv = (name: string): string =>
  normalizeString((process.env as Record<string, string | undefined>)[name]);

const getProviderApiKey = (
  provider: AssistantChatSearchProviderConfig,
  providerType: AssistantChatSearchProviderType,
) => {
  const explicitKey = normalizeString(provider.apiKey);
  if (explicitKey) return explicitKey;

  if (providerType === "tavily") return getEnv("TAVILY_API_KEY");
  if (providerType === "exa") return getEnv("EXA_API_KEY");
  if (providerType === "perplexity") return getEnv("PERPLEXITY_API_KEY");
  return "";
};

const findActiveProvider = (
  config: AssistantChatWebSearchConfig,
): AssistantChatSearchProviderConfig | null => {
  if (config.provider) return config.provider;

  const providers = Array.isArray(config.providers) ? config.providers : [];
  if (providers.length === 0) return null;

  const activeId = normalizeString(config.activeProviderId);
  return (
    providers.find((provider) => normalizeString(provider.id) === activeId) ||
    providers[0] ||
    null
  );
};

const toMaxResults = (value: unknown, fallback = 6): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.floor(numeric));
};

const toBlockedDomains = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => normalizeString(item)).filter(Boolean)
    : [];

const toTavilyTimeRange = (
  value: unknown,
): "day" | "week" | "month" | "year" | undefined => {
  const normalized = normalizeString(value).toLowerCase();
  if (
    normalized === "day" ||
    normalized === "week" ||
    normalized === "month" ||
    normalized === "year"
  ) {
    return normalized;
  }
  return undefined;
};

const toPerplexityRecency = toTavilyTimeRange;

const shouldIncludeImages = (
  defaults: AssistantChatSearchDefaultsConfig | null | undefined,
) => defaults?.mode === "web+images";

export const extractAssistantChatWebSearchSources = (
  result: unknown,
): AssistantChatWebSearchSource[] => {
  if (!result || (typeof result !== "object" && typeof result !== "string")) {
    return [];
  }

  const citations: AssistantChatWebSearchSource[] = [];
  const seen = new Set<string>();
  const push = (item: unknown, depth = 0) => {
    if (depth > 5 || !item) return;

    if (typeof item === "string") {
      const url = normalizeString(item);
      if (!/^https?:\/\//i.test(url) || seen.has(url)) return;
      seen.add(url);
      citations.push({ title: url, url });
      return;
    }

    if (Array.isArray(item)) {
      for (const entry of item) push(entry, depth + 1);
      return;
    }

    if (typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const url = pickSourceUrl(record);
    if (url && !seen.has(url)) {
      seen.add(url);
      citations.push({
        title: pickNonEmptyString(
          record.title,
          record.name,
          record.sourceName,
          record.source_name,
          record.hostname,
          url,
        ),
        url,
      });
    }

    for (const key of [
      "citations",
      "sources",
      "references",
      "results",
      "data",
      "pages",
      "urls",
      "items",
      "documents",
      "subpages",
      "organic",
      "answer",
      "metadata",
      "citation",
      "reference",
    ]) {
      push(record[key], depth + 1);
    }

    if (record.extras && typeof record.extras === "object") {
      const extras = record.extras as Record<string, unknown>;
      push(extras.links, depth + 1);
    }

    for (const key of ["resultsMap", "map"]) {
      const nested = record[key];
      if (nested && typeof nested === "object" && !Array.isArray(nested)) {
        push(Object.values(nested as Record<string, unknown>), depth + 1);
      }
    }
  };

  push(result);

  return citations;
};

export const createAssistantChatWebSearchTools = (
  config: AssistantChatWebSearchConfig | null | undefined,
): AssistantChatWebSearchToolResult => {
  if (!config?.enabled) {
    return { tools: {}, reason: "disabled" };
  }

  const defaults = config.defaults || {};
  if (defaults.mode === "images") {
    return { tools: {}, reason: "mode_images_only" };
  }

  const provider = findActiveProvider(config);
  if (!provider) {
    return { tools: {}, reason: "missing_provider" };
  }

  const providerType = normalizeProviderType(
    provider.providerType || provider.catalogId || provider.id,
  );
  if (!providerType) {
    return {
      tools: {},
      providerId: normalizeString(provider.id) || undefined,
      reason: "unsupported_provider",
    };
  }

  const providerId = normalizeString(provider.id) || providerType;
  const apiKey = getProviderApiKey(provider, providerType);
  if (!apiKey) {
    return {
      tools: {},
      providerId,
      providerType,
      reason: "missing_api_key",
    };
  }

  const maxResults = toMaxResults(defaults.webCount, 6);
  const excludeDomains = toBlockedDomains(defaults.blockedDomains);

  if (providerType === "tavily") {
    const timeRange = toTavilyTimeRange(defaults.timeRange);
    const includeImages = shouldIncludeImages(defaults);
    const tavilyClientOptions = {
      apiKey,
      ...(normalizeString(provider.baseUrl)
        ? { apiBaseURL: normalizeString(provider.baseUrl) }
        : {}),
    };
    return {
      tools: {
        webSearch: tavilySearch({
          ...tavilyClientOptions,
          searchDepth: "advanced",
          includeAnswer: true,
          includeImages,
          includeImageDescriptions: includeImages,
          maxResults,
          ...(timeRange ? { timeRange } : {}),
          ...(excludeDomains.length > 0 ? { excludeDomains } : {}),
        }),
        tavilyExtract: tavilyExtract({
          ...tavilyClientOptions,
          extractDepth: "advanced",
          format: "markdown",
          includeImages,
        }),
        tavilyCrawl: tavilyCrawl({
          ...tavilyClientOptions,
          maxDepth: 2,
          limit: maxResults,
          extractDepth: "advanced",
          format: "markdown",
          includeImages,
          allowExternal: false,
        }),
        tavilyMap: tavilyMap({
          ...tavilyClientOptions,
          maxDepth: 2,
          limit: Math.max(maxResults, 10),
          allowExternal: false,
        }),
      },
      providerId,
      providerType,
      reason: "registered",
    };
  }

  if (providerType === "exa") {
    const now = new Date();
    const timeRange = toTavilyTimeRange(defaults.timeRange);
    const startPublishedDate =
      timeRange === "day"
        ? new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
        : timeRange === "week"
          ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
          : timeRange === "month"
            ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
            : timeRange === "year"
              ? new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()
              : undefined;
    return {
      tools: {
        webSearch: exaWebSearch({
          apiKey,
          type: "auto",
          numResults: maxResults,
          contents: {
            text: {
              maxCharacters:
                defaults.compressionMode === "none" ? 3000 : 1200,
            },
            summary: defaults.compressionMode !== "none",
            livecrawl: "fallback",
          },
          ...(startPublishedDate ? { startPublishedDate } : {}),
          ...(excludeDomains.length > 0 ? { excludeDomains } : {}),
        }),
      },
      providerId,
      providerType,
      reason: "registered",
    };
  }

  if (providerType === "perplexity") {
    return {
      tools: {
        webSearch: perplexitySearch({ apiKey }),
      },
      providerId,
      providerType,
      reason: "registered",
    };
  }

  return {
    tools: {},
    providerId,
    providerType,
    reason: "unsupported_provider",
  };
};
