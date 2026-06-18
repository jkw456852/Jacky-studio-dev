import {
  ImageProvider,
  VideoProvider,
  ImageGenerationRequest,
  VideoGenerationRequest,
} from "./types";
import { geminiImageProvider, geminiVideoProvider } from "./gemini.provider";
import { replicateImageProvider } from "./replicate.provider";
import { klingVideoProvider } from "./kling.provider";
import { ProviderError } from "../../utils/provider-error";
import { resolveCanonicalImageModelDisplayName } from "../image-generation/core/openai-image-spec";

// All registered providers
const imageProviders: Map<string, ImageProvider> = new Map([
  ["gemini", geminiImageProvider],
  ["replicate", replicateImageProvider],
]);

const videoProviders: Map<string, VideoProvider> = new Map([
  ["gemini", geminiVideoProvider],
  ["kling", klingVideoProvider],
]);

export const getImageProviderById = (providerId?: string | null): ImageProvider | undefined => {
  if (!providerId) return undefined;
  return imageProviders.get(String(providerId).trim());
};

export const getVideoProviderById = (providerId?: string | null): VideoProvider | undefined => {
  if (!providerId) return undefined;
  return videoProviders.get(String(providerId).trim());
};

// Model → Provider lookup (built from provider registry)
const modelToImageProvider: Record<string, string> = {};
const modelToVideoProvider: Record<string, string> = {};

const registerModels = (
  mapping: Record<string, string>,
  providerId: string,
  models: string[],
) => {
  models.forEach((model) => {
    mapping[model] = providerId;
  });
};

imageProviders.forEach((provider, providerId) =>
  registerModels(modelToImageProvider, providerId, provider.models),
);
videoProviders.forEach((provider, providerId) =>
  registerModels(modelToVideoProvider, providerId, provider.models),
);

const resolvePreferredImageProviderId = (): string | null => {
  try {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem('workspace_preferred_image_provider_id');
      if (raw) return raw;
    }
  } catch {
    // ignore
  }
  return null;
};

// Video model aliases for compatibility with old settings/model ids
const VIDEO_MODEL_ALIASES: Record<string, string> = {
  auto: "Veo 3.1 Fast",
  "veo-3.1-fast": "Veo 3.1 Fast",
  "veo_3_1-fast": "Veo 3.1 Fast",
  "veo-3.1-fast-generate-preview": "Veo 3.1 Fast",
  "veo-3.1": "Veo 3.1",
  "veo-3.1-generate-preview": "Veo 3.1",
  "veo3.1-4k": "Veo 3.1",
  "veo3.1-c": "Veo 3.1",
  "veo 3.1 fast": "Veo 3.1 Fast",
  "veo 3.1 pro": "Veo 3.1",
  "sora-2": "Sora 2",
  "kling-3.0": "Kling Pro",
  "kling 3.0": "Kling Pro",
};

const resolveVideoModel = (model: string): string => {
  const normalized = (model || "").trim();
  if (!normalized) return "Veo 3.1 Fast";
  return VIDEO_MODEL_ALIASES[normalized.toLowerCase()] || normalized;
};

const resolveImageModel = (model: string): string => {
  return resolveCanonicalImageModelDisplayName(model);
};

const warnModelFallback = (
  type: "image" | "video",
  requestedModel: string,
  resolvedModel: string,
  fallbackProviderId: string,
) => {
  console.warn(
    `[provider-router] Unknown ${type} model "${requestedModel}" (resolved: "${resolvedModel}") -> fallback provider "${fallbackProviderId}"`,
  );
};

const shouldUseStrictModelRouting = (): boolean => {
  if (typeof window === "undefined") return false;
  const strictFlag = window.localStorage.getItem("strict_model_routing");
  if (strictFlag === "1" || strictFlag === "true") return true;
  return false;
};

const createModelNotFoundError = (
  type: "image" | "video",
  requestedModel: string,
  resolvedModel: string,
) => {
  return new ProviderError({
    provider: "router",
    code: "MODEL_NOT_FOUND",
    retryable: false,
    stage: "config",
    details: `${type}:${requestedModel}->${resolvedModel}`,
    message: `未识别${type === "image" ? "图像" : "视频"}模型: ${requestedModel}`,
  });
};

export function getAvailableImageModels(): string[] {
  return Object.keys(modelToImageProvider);
}

export function getAvailableVideoModels(): string[] {
  return Object.keys(modelToVideoProvider);
}

export async function generateImageWithProvider(
  request: ImageGenerationRequest,
  model: string,
): Promise<string | null> {
  const requestedModel = String(model || "").trim();
  const resolvedModel = resolveImageModel(requestedModel);
  const matchedProviderId = modelToImageProvider[resolvedModel];
  const preferredProviderId = request.providerId || resolvePreferredImageProviderId();
  if (!matchedProviderId && shouldUseStrictModelRouting()) {
    throw createModelNotFoundError("image", requestedModel, resolvedModel);
  }
  const providerId = matchedProviderId
    || (preferredProviderId && imageProviders.has(preferredProviderId) ? preferredProviderId : null)
    || "gemini"; // 默认回落到 Gemini / 云雾中转大管家
  if (!matchedProviderId) {
    warnModelFallback("image", requestedModel, resolvedModel, providerId);
  }
  const provider = imageProviders.get(providerId);

  if (!provider) {
    // custom provider — delegate to the full generateImage path which handles custom channels
    const { generateImage } = await import('../gemini');
    return generateImage({
      prompt: request.prompt,
      signal: request.signal,
      model: resolvedModel,
      providerId,
      aspectRatio: request.aspectRatio,
      imageSize: request.imageSize as '1K' | '2K' | '4K' | undefined,
      exactSize: request.exactSize,
      imageQuality: request.imageQuality,
      referenceImage: request.referenceImage,
      referenceImages: request.referenceImages,
      maskImage: request.maskImage,
      referenceStrength: request.referenceStrength,
      referencePriority: request.referencePriority,
      referenceMode: request.referenceMode,
      referenceRoleMode: request.referenceRoleMode,
      promptLanguagePolicy: request.promptLanguagePolicy,
      textPolicy: request.textPolicy,
      consistencyContext: request.consistencyContext,
      onSubmitted: request.onSubmitted as any,
      onTransportPrepared: request.onTransportPrepared as any,
    });
  }

  return provider.generateImage(request, resolvedModel);
}

export async function generateVideoWithProvider(
  request: VideoGenerationRequest,
  model: string,
): Promise<string | null> {
  const resolvedModel = resolveVideoModel(model);

  // 对 Kling 的显式识别，如果是 kling 开头的模型或者指定的关键字
  const isKling = resolvedModel.toLowerCase().includes("kling");
  const matchedProviderId = modelToVideoProvider[resolvedModel];
  if (!matchedProviderId && shouldUseStrictModelRouting()) {
    throw createModelNotFoundError("video", model, resolvedModel);
  }
  const providerId = matchedProviderId || (isKling ? "kling" : "gemini");
  if (!matchedProviderId) {
    warnModelFallback("video", model, resolvedModel, providerId);
  }

  const provider = videoProviders.get(providerId);
  if (!provider) {
    throw new ProviderError({
      provider: providerId,
      code: "PROVIDER_NOT_FOUND",
      retryable: false,
      stage: "config",
      details: `video:${resolvedModel}`,
      message: `未找到提供商: ${providerId}`,
    });
  }

  return provider.generateVideo(request, resolvedModel);
}

export { imageProviders, videoProviders };
