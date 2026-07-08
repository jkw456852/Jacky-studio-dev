import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createProviderRegistry, type ToolSet } from "ai";

export type AssistantChatProviderConfig = {
  id?: string | null;
  name?: string | null;
  baseUrl?: string | null;
  apiKey?: string | null;
};

export type AssistantChatProviderRequest = {
  config?: {
    modelName?: string;
    reasoningEffort?: string;
    model?: string;
    modelId?: string;
    /**
     * Deprecated migration fields. New assistant-ui ModelContext config should
     * only use official LanguageModelConfig keys.
     */
    provider?: AssistantChatProviderConfig;
    providerId?: string | null;
    providerName?: string | null;
    baseUrl?: string | null;
    apiKey?: string | null;
  };
  providerConfig?: {
    provider?: AssistantChatProviderConfig;
    providerId?: string | null;
    providerName?: string | null;
    baseUrl?: string | null;
    apiKey?: string | null;
  };
};

const DEFAULT_MODEL = "gpt-5.4-nano";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_GOOGLE_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta";

const readEnv = (name: string): string =>
  String((process.env as Record<string, string | undefined>)[name] || "").trim();

export const normalizeOpenAIBaseURL = (value: string): string => {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return DEFAULT_OPENAI_BASE_URL;
  if (!/^https?:\/\//i.test(raw)) {
    throw new Error("invalid_provider_base_url");
  }
  if (/\/v\d+(?:\/.*)?$/i.test(raw)) {
    return raw;
  }
  return `${raw}/v1`;
};

export const normalizeGoogleBaseURL = (value: string): string => {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return DEFAULT_GOOGLE_BASE_URL;
  if (!/^https?:\/\//i.test(raw)) {
    throw new Error("invalid_provider_base_url");
  }
  if (/\/v\d+(?:beta)?(?:\/.*)?$/i.test(raw)) {
    return raw;
  }
  return `${raw}/v1beta`;
};

export const isGoogleProvider = (provider: AssistantChatProviderConfig): boolean => {
  const providerId = String(provider.id || "").toLowerCase();
  const baseUrl = String(provider.baseUrl || "").toLowerCase();
  return (
    providerId === "gemini" ||
    providerId.includes("google") ||
    baseUrl.includes("googleapis.com")
  );
};

export const isOfficialOpenAIBaseURL = (value: string): boolean => {
  try {
    const host = new URL(normalizeOpenAIBaseURL(value)).hostname.toLowerCase();
    return host === "api.openai.com" || host.endsWith(".openai.com");
  } catch {
    return false;
  }
};

export const isOfficialOpenAIProvider = (
  provider: AssistantChatProviderConfig,
): boolean => {
  const providerId = String(provider.id || "").trim().toLowerCase();
  if (providerId && providerId !== "openai") return false;
  return isOfficialOpenAIBaseURL(String(provider.baseUrl || ""));
};

export const isOpenAIReasoningModelId = (modelId: string): boolean => {
  const normalized = String(modelId || "").toLowerCase();
  return (
    normalized.startsWith("o1") ||
    normalized.startsWith("o3") ||
    normalized.startsWith("o4-mini") ||
    (normalized.startsWith("gpt-5") && !normalized.startsWith("gpt-5-chat"))
  );
};

export const shouldRequestOpenAIReasoningSummary = (
  provider: AssistantChatProviderConfig,
  modelId: string,
): boolean =>
  !isGoogleProvider(provider) &&
  isOfficialOpenAIProvider(provider) &&
  isOpenAIReasoningModelId(modelId);

export const isOfficialGoogleBaseURL = (value: string): boolean => {
  try {
    const host = new URL(normalizeGoogleBaseURL(value)).hostname.toLowerCase();
    return (
      host === "generativelanguage.googleapis.com" ||
      host.endsWith(".googleapis.com")
    );
  } catch {
    return false;
  }
};

const supportsGoogleSearchTool = (modelId: string): boolean => {
  const normalized = String(modelId || "").toLowerCase();
  return (
    normalized.includes("gemini-2") ||
    normalized.includes("gemini-3") ||
    normalized.includes("nano-banana") ||
    normalized === "gemini-flash-latest" ||
    normalized === "gemini-flash-lite-latest" ||
    normalized === "gemini-pro-latest"
  );
};

const supportsGoogleMixedProviderAndFunctionTools = (modelId: string): boolean =>
  String(modelId || "").toLowerCase().includes("gemini-3");

export const normalizeRegistryProviderId = (
  providerId: string | null | undefined,
) => {
  const normalized = String(providerId || "")
    .trim()
    .replace(/[^a-zA-Z0-9_.-]/g, "_");
  return normalized || "provider";
};

const parseRegistryModelName = (
  value: string,
): { providerId?: string; modelId: string } => {
  const raw = String(value || "").trim();
  const separatorIndex = raw.indexOf(":");
  if (separatorIndex <= 0) {
    return { modelId: raw };
  }

  const providerId = raw.slice(0, separatorIndex).trim();
  const modelId = raw.slice(separatorIndex + 1).trim();
  return {
    ...(providerId ? { providerId } : {}),
    modelId,
  };
};

export const resolveProviderConfig = (
  body: AssistantChatProviderRequest,
): Required<AssistantChatProviderConfig> => {
  const provider = body.providerConfig?.provider || body.config?.provider || {};
  const modelNameSelection = parseRegistryModelName(
    String(body.config?.modelName || ""),
  );
  const providerId =
    provider.id ||
    body.providerConfig?.providerId ||
    modelNameSelection.providerId ||
    body.config?.providerId ||
    readEnv("ASSISTANT_CHAT_PROVIDER_ID") ||
    "openai";
  const googleLike =
    String(providerId || "").toLowerCase() === "gemini" ||
    String(providerId || "").toLowerCase().includes("google");
  const id = String(providerId).trim();
  const name = String(
    provider.name ||
      body.providerConfig?.providerName ||
      body.config?.providerName ||
      readEnv("ASSISTANT_CHAT_PROVIDER_NAME") ||
      id ||
      "openai",
  ).trim();
  const baseUrl = String(
    provider.baseUrl ||
      body.providerConfig?.baseUrl ||
      body.config?.baseUrl ||
      readEnv("ASSISTANT_CHAT_BASE_URL") ||
      (googleLike
        ? readEnv("GOOGLE_GENERATIVE_AI_BASE_URL") || readEnv("GEMINI_BASE_URL")
        : readEnv("OPENAI_BASE_URL")) ||
      DEFAULT_OPENAI_BASE_URL,
  ).trim();
  const apiKey = String(
    provider.apiKey ||
      body.providerConfig?.apiKey ||
      body.config?.apiKey ||
      readEnv("ASSISTANT_CHAT_API_KEY") ||
      (googleLike
        ? readEnv("GOOGLE_GENERATIVE_AI_API_KEY") || readEnv("GEMINI_API_KEY")
        : readEnv("OPENAI_API_KEY")) ||
      "",
  ).trim();

  return { id, name, baseUrl, apiKey };
};

export const resolveModelId = (
  body: AssistantChatProviderRequest,
  provider: AssistantChatProviderConfig,
): string => {
  const modelNameSelection = parseRegistryModelName(
    String(body.config?.modelName || ""),
  );
  const fallbackModel = isGoogleProvider(provider)
    ? readEnv("GOOGLE_GENERATIVE_AI_MODEL") ||
      readEnv("GEMINI_MODEL") ||
      "gemini-2.5-flash"
    : DEFAULT_MODEL;

  return (
    String(
      modelNameSelection.modelId ||
        body.config?.modelId ||
        body.config?.model ||
        readEnv("ASSISTANT_CHAT_MODEL") ||
        readEnv("OPENAI_MODEL") ||
        fallbackModel,
    ).trim() || fallbackModel
  );
};

export const createLanguageModelBundle = (
  provider: Required<AssistantChatProviderConfig>,
  modelId: string,
  options: {
    hasFunctionTools: boolean;
    enableNativeWebSearch?: boolean;
    nativeOpenAIImageGeneration?: {
      model?: string;
      outputFormat?: "png" | "jpeg" | "webp";
      quality?: "auto" | "low" | "medium" | "high";
      size?: "auto" | "1024x1024" | "1024x1536" | "1536x1024";
    };
  },
) => {
  const registryProviderId = normalizeRegistryProviderId(provider.id);
  if (isGoogleProvider(provider)) {
    const google = createGoogleGenerativeAI({
      apiKey: provider.apiKey,
      baseURL: normalizeGoogleBaseURL(provider.baseUrl),
      name: provider.id || "google.generative-ai",
    });
    const registry = createProviderRegistry({
      [registryProviderId]: google,
    });
    const shouldUseGoogleSearch =
      options.enableNativeWebSearch === true &&
      isOfficialGoogleBaseURL(provider.baseUrl) &&
      supportsGoogleSearchTool(modelId) &&
      (!options.hasFunctionTools ||
        supportsGoogleMixedProviderAndFunctionTools(modelId));
    return {
      model: registry.languageModel(`${registryProviderId}:${modelId}` as any),
      providerTools: shouldUseGoogleSearch
        ? ({
            google_search: google.tools.googleSearch({
              searchTypes: { webSearch: {} },
            }),
          } as ToolSet)
        : ({} as ToolSet),
    };
  }

  const openai = createOpenAI({
    apiKey: provider.apiKey,
    baseURL: normalizeOpenAIBaseURL(provider.baseUrl),
    name: provider.id || "openai",
  });
  const shouldUseResponsesApi = isOfficialOpenAIProvider(provider);
  if (!shouldUseResponsesApi) {
    const compatible = createOpenAICompatible({
      apiKey: provider.apiKey,
      baseURL: normalizeOpenAIBaseURL(provider.baseUrl),
      name: provider.id || "openai-compatible",
      includeUsage: true,
    });
    const registry = createProviderRegistry({
      [registryProviderId]: compatible,
    });
    return {
      model: registry.languageModel(`${registryProviderId}:${modelId}` as any),
      providerTools: {} as ToolSet,
    };
  }

  const registry = createProviderRegistry({
    [registryProviderId]: openai,
  });
  return {
    model: registry.languageModel(`${registryProviderId}:${modelId}` as any),
    providerTools: {
      ...(shouldUseResponsesApi && options.enableNativeWebSearch === true
        ? {
            web_search: openai.tools.webSearch({
              externalWebAccess: true,
              searchContextSize: "medium",
            }),
          }
        : {}),
      ...(options.nativeOpenAIImageGeneration
        ? {
            image_generation: openai.tools.imageGeneration(
              options.nativeOpenAIImageGeneration,
            ),
          }
        : {}),
    } as ToolSet,
  };
};
