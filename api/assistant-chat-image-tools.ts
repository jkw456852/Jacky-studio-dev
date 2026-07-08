import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  createProviderRegistry,
  generateImage,
  tool,
  type GenerateImageResult,
  type ToolSet,
} from "ai";

import {
  isGoogleProvider,
  isOfficialOpenAIProvider,
  normalizeRegistryProviderId,
  normalizeGoogleBaseURL,
  normalizeOpenAIBaseURL,
  type AssistantChatProviderConfig,
} from "./assistant-chat-provider.ts";
import {
  resolveCanonicalImageModelId,
  resolveOpenAIImageSize,
} from "../services/image-generation/core/openai-image-spec.ts";
import {
  assistantSidebarCreateImageParameters,
  type AssistantSidebarCreateImageArgs,
} from "../services/assistant-ui/assistant-sidebar-tool-schemas.ts";

export type AssistantChatImageGenerationConfig = {
  enabled?: boolean;
  provider?: AssistantChatProviderConfig | null;
  modelId?: string | null;
  aspectRatio?: string | null;
  resolution?: "1K" | "2K" | "4K" | string | null;
  count?: number | null;
  minimumCount?: number | null;
  referenceImages?: string[] | null;
  enforceSettings?: boolean;
  requiresApproval?: boolean | null;
};

export type AssistantChatImageToolsResult = {
  tools: ToolSet;
  providerId?: string;
  modelId?: string;
  reason:
    | "disabled"
    | "missing_provider"
    | "missing_api_key"
    | "missing_model"
    | "unsupported_provider"
    | "registered";
};

type ImageToolDependencies = {
  generateImageFn?: typeof generateImage;
};

type AssistantChatGeneratedImagePart = {
  type: "image";
  image: string;
  filename?: string;
  mediaType?: string;
};

type AssistantChatCreateImageExecutionInput = AssistantSidebarCreateImageArgs & {
  referenceImages?: string[] | null;
  maskImage?: string | null;
};

const normalizeString = (value: unknown): string => String(value ?? "").trim();

const isValidAssistantImageReference = (value: string): boolean => {
  const normalized = normalizeString(value);
  if (!normalized) return false;
  if (/^https?:\/\//i.test(normalized)) return true;
  if (/^data:image\/(?:png|jpe?g|webp);base64,/i.test(normalized)) {
    return true;
  }
  return false;
};

const isImageEditInputRejectedError = (error: unknown): boolean => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return /invalid image file|image file or mode|unsupported.*edit|edits? endpoint|image input/i.test(
    message,
  );
};

const extensionForMimeType = (mediaType: string): string => {
  switch (mediaType) {
    case "image/png":
      return "png";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    default:
      return "png";
  }
};

const normalizeImageCount = (value: unknown, fallback = 1): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.floor(numeric));
};

const resolveRequestedImageCount = (input: {
  count?: number | null;
}): number | undefined => {
  const numeric = Number(input.count);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.max(1, Math.floor(numeric));
};

const normalizeResolution = (
  value: unknown,
): "1K" | "2K" | "4K" | undefined => {
  const normalized = normalizeString(value).toUpperCase();
  if (normalized === "1K" || normalized === "2K" || normalized === "4K") {
    return normalized;
  }
  return undefined;
};

const toGoogleImageProviderOptions = (args: {
  aspectRatio?: string;
  resolution: "1K" | "2K" | "4K" | undefined;
},
) => {
  if (!args.resolution && !args.aspectRatio) return undefined;
  return {
    google: {
      imageConfig: {
        ...(args.aspectRatio
          ? { aspectRatio: args.aspectRatio as `${number}:${number}` }
          : {}),
        ...(args.resolution ? { imageSize: args.resolution } : {}),
      },
    },
  };
};

const isOpenAIImageModel = (modelId: string): boolean => {
  const normalized = modelId.toLowerCase();
  return (
    normalized.startsWith("gpt-image-") ||
    normalized.startsWith("dall-e-") ||
    normalized === "chatgpt-image-latest"
  );
};

const isGoogleImageModel = (modelId: string): boolean => {
  const normalized = modelId.toLowerCase();
  return normalized.startsWith("gemini-") || normalized.startsWith("imagen-");
};

const normalizeOpenAIImageModelId = (modelId: string): string => {
  const canonical = resolveCanonicalImageModelId(modelId);
  if (canonical === "gpt-image-2-all") return "gpt-image-2";
  if (canonical === "gpt-image-1.5-all") return "gpt-image-1.5";
  if (canonical === "Auto") return "gpt-image-1";
  return canonical;
};

const normalizeGoogleImageModelId = (modelId: string): string => {
  const canonical = resolveCanonicalImageModelId(modelId);
  if (canonical === "Auto") return "gemini-3.1-flash-image-preview";
  return canonical;
};

const createImageModel = (
  provider: Required<AssistantChatProviderConfig>,
  requestedModelId: string,
) => {
  const registryProviderId = normalizeRegistryProviderId(provider.id);
  if (isGoogleImageModel(requestedModelId)) {
    const google = createGoogleGenerativeAI({
      apiKey: provider.apiKey,
      baseURL: normalizeGoogleBaseURL(provider.baseUrl),
      name: provider.id || "google.generative-ai",
    });
    const registry = createProviderRegistry({
      [registryProviderId]: google,
    });
    const modelId = normalizeGoogleImageModelId(requestedModelId);
    return registry.imageModel(`${registryProviderId}:${modelId}` as any);
  }

  const modelId = normalizeOpenAIImageModelId(requestedModelId);
  if (isOfficialOpenAIProvider(provider)) {
    const openai = createOpenAI({
      apiKey: provider.apiKey,
      baseURL: normalizeOpenAIBaseURL(provider.baseUrl),
      name: provider.id || "openai",
    });
    const registry = createProviderRegistry({
      [registryProviderId]: openai,
    });
    return registry.imageModel(`${registryProviderId}:${modelId}` as any);
  }

  const compatible = createOpenAICompatible({
    apiKey: provider.apiKey,
    baseURL: normalizeOpenAIBaseURL(provider.baseUrl),
    name: provider.id || "openai-compatible",
  });
  const registry = createProviderRegistry({
    [registryProviderId]: compatible,
  });
  return registry.imageModel(`${registryProviderId}:${modelId}` as any);
};

const toOpenAICompatibleSize = (
  modelId: string,
  aspectRatio: string,
  resolution: "1K" | "2K" | "4K" | undefined,
  explicitSize: string | undefined,
): `${number}x${number}` | undefined => {
  const resolved = explicitSize || resolveOpenAIImageSize(
    modelId,
    aspectRatio,
    resolution || "1K",
  );
  return /^\d+x\d+$/.test(resolved)
    ? (resolved as `${number}x${number}`)
    : undefined;
};

const extractRevisedPrompt = (
  result: GenerateImageResult,
): string | undefined => {
  const providerMetadata = result.providerMetadata as
    | Record<string, Record<string, unknown> | undefined>
    | undefined;
  if (!providerMetadata) return undefined;

  for (const metadata of Object.values(providerMetadata)) {
    if (!metadata || typeof metadata !== "object") continue;
    const revisedPrompt = metadata.revisedPrompt;
    if (typeof revisedPrompt === "string" && revisedPrompt.trim()) {
      return revisedPrompt.trim();
    }
  }

  return undefined;
};

const toImageToolOutput = (
  result: GenerateImageResult,
  context: {
    providerId: string;
    providerName: string;
    modelId: string;
    prompt: string;
    referenceCount: number;
    size?: string;
    aspectRatio?: string;
    resolution?: "1K" | "2K" | "4K";
    count?: number;
    settingsLocked?: boolean;
  },
) => {
  const revisedPrompt = extractRevisedPrompt(result);

  return {
    providerId: context.providerId,
    providerName: context.providerName,
    modelId: context.modelId,
    prompt: context.prompt,
    referenceCount: context.referenceCount,
    size: context.size,
    aspectRatio: context.aspectRatio,
    resolution: context.resolution,
    count: context.count,
    settingsLocked: context.settingsLocked === true,
    images: result.images.map(
      (image, index): AssistantChatGeneratedImagePart => ({
        type: "image",
        image: `data:${image.mediaType};base64,${image.base64}`,
        filename: `generated-image-${index + 1}.${extensionForMimeType(image.mediaType)}`,
        mediaType: image.mediaType,
      }),
    ),
    ...(revisedPrompt ? { metadata: { revisedPrompt } } : {}),
    warnings: result.warnings,
    usage: result.usage,
  };
};

export const createAssistantChatImageTools = (
  config: AssistantChatImageGenerationConfig | null | undefined,
  dependencies: ImageToolDependencies = {},
): AssistantChatImageToolsResult => {
  if (!config?.enabled) {
    return { tools: {}, reason: "disabled" };
  }

  const provider = config.provider;
  if (!provider) {
    return { tools: {}, reason: "missing_provider" };
  }

  const resolvedProvider: Required<AssistantChatProviderConfig> = {
    id: normalizeString(provider.id) || "image-provider",
    name: normalizeString(provider.name) || normalizeString(provider.id) || "Image provider",
    baseUrl: normalizeString(provider.baseUrl),
    apiKey: normalizeString(provider.apiKey),
  };

  if (!resolvedProvider.apiKey) {
    return {
      tools: {},
      providerId: resolvedProvider.id,
      reason: "missing_api_key",
    };
  }

  const requestedModelId = normalizeString(config.modelId);
  if (!requestedModelId) {
    return {
      tools: {},
      providerId: resolvedProvider.id,
      reason: "missing_model",
    };
  }

  const resolvedCanonicalModelId = resolveCanonicalImageModelId(requestedModelId);
  const canonicalModelId =
    isGoogleProvider(resolvedProvider) ||
    isGoogleImageModel(resolvedCanonicalModelId)
      ? normalizeGoogleImageModelId(requestedModelId)
      : normalizeOpenAIImageModelId(requestedModelId);
  const googleImageModel = isGoogleImageModel(canonicalModelId);
  if (!googleImageModel && !isOpenAIImageModel(canonicalModelId)) {
    return {
      tools: {},
      providerId: resolvedProvider.id,
      modelId: canonicalModelId,
      reason: "unsupported_provider",
    };
  }

  const imageModel = createImageModel(resolvedProvider, canonicalModelId);
  const defaultAspectRatio = normalizeString(config.aspectRatio) || "1:1";
  const defaultResolution = normalizeResolution(config.resolution);
  const defaultCount = normalizeImageCount(config.count);
  const settingsLocked = config.enforceSettings === true;
  const minimumCount = settingsLocked ? 1 : normalizeImageCount(config.minimumCount, 1);
  const defaultReferenceImages = (Array.isArray(config.referenceImages)
    ? config.referenceImages
    : [])
    .map(normalizeString)
    .filter(isValidAssistantImageReference);
  const runGenerateImage = dependencies.generateImageFn || generateImage;
  const needsImageApproval =
    config.requiresApproval === true
      ? true
      : (input: AssistantSidebarCreateImageArgs) => {
          const executionInput = input as AssistantChatCreateImageExecutionInput;
          const requestedCount = resolveRequestedImageCount(input);
          const effectiveCount = settingsLocked
            ? defaultCount
            : Math.max(minimumCount, requestedCount ?? defaultCount);
          const explicitReferenceCount = [
            ...(executionInput.images || []),
            ...(executionInput.referenceImages || []),
          ].filter((image) => isValidAssistantImageReference(normalizeString(image))).length;

          return (
            effectiveCount > 1 ||
            explicitReferenceCount > 0 ||
            defaultReferenceImages.length > 0
          );
        };

  return {
    providerId: resolvedProvider.id,
    modelId: canonicalModelId,
    reason: "registered",
    tools: {
      createImage: tool({
        description:
          "Generate or edit images using the configured AI SDK image model. Use this for visual creation, reference-image edits, and image variations.",
        inputSchema: assistantSidebarCreateImageParameters,
        needsApproval: needsImageApproval,
        async execute(input) {
          const executionInput = input as AssistantChatCreateImageExecutionInput;
          const referenceImages = [
            ...(executionInput.images || []),
            ...(executionInput.referenceImages || []),
          ]
            .map(normalizeString)
            .filter(isValidAssistantImageReference);
          const resolvedReferenceImages =
            referenceImages.length > 0 ? referenceImages : defaultReferenceImages;
          const mask =
            normalizeString(executionInput.mask) ||
            normalizeString(executionInput.maskImage);
          const aspectRatio = settingsLocked
            ? defaultAspectRatio
            : normalizeString(input.aspectRatio) || defaultAspectRatio;
          const imageCount = settingsLocked
            ? defaultCount
            : Math.max(minimumCount, normalizeImageCount(input.count, defaultCount));
          const size = !googleImageModel
            ? toOpenAICompatibleSize(
                canonicalModelId,
                aspectRatio,
                defaultResolution,
                settingsLocked
                  ? undefined
                  : normalizeString(input.size) || undefined,
              )
            : undefined;
          const promptText = normalizeString(input.text) || input.prompt;
          const prompt =
            resolvedReferenceImages.length > 0 || mask
              ? {
                  text: promptText,
                  images: resolvedReferenceImages,
                  ...(mask ? { mask } : {}),
                }
              : promptText;

          const generateOptions = {
            model: imageModel as any,
            prompt,
            n: imageCount,
            ...(size ? { size } : {}),
            ...(!size && aspectRatio
              ? { aspectRatio: aspectRatio as `${number}:${number}` }
              : {}),
            ...(googleImageModel && defaultResolution
              ? {
                  providerOptions: toGoogleImageProviderOptions({
                    aspectRatio,
                    resolution: defaultResolution,
                  }),
                }
              : {}),
          };

          let result: GenerateImageResult;
          let referenceFallbackWarning: string | undefined;
          try {
            result = await runGenerateImage(generateOptions);
          } catch (error) {
            if (
              resolvedReferenceImages.length === 0 ||
              !isImageEditInputRejectedError(error)
            ) {
              throw error;
            }

            referenceFallbackWarning =
              "The selected image provider rejected the attached reference image input, so this result was generated from the finalized text prompt only.";
            result = await runGenerateImage({
              ...generateOptions,
              prompt: promptText,
            });
          }

          const output = toImageToolOutput(result, {
            providerId: resolvedProvider.id,
            providerName: resolvedProvider.name,
            modelId: canonicalModelId,
            prompt: promptText,
            referenceCount: referenceFallbackWarning
              ? 0
              : resolvedReferenceImages.length,
            size,
            aspectRatio,
            resolution: defaultResolution,
            count: imageCount,
            settingsLocked,
          });
          return referenceFallbackWarning
            ? {
                ...output,
                warnings: [
                  ...(Array.isArray(output.warnings) ? output.warnings : []),
                  referenceFallbackWarning,
                ],
              }
            : output;
        },
        toModelOutput: ({ output }) => ({
          type: "content",
          value: [
            {
              type: "text",
              text: [
                `Generated ${output.images.length} image${output.images.length === 1 ? "" : "s"}.`,
                output.providerName || output.providerId
                  ? `Provider: ${output.providerName || output.providerId}.`
                  : "",
                output.modelId ? `Model: ${output.modelId}.` : "",
                output.size ? `Size: ${output.size}.` : "",
                output.aspectRatio ? `Aspect ratio: ${output.aspectRatio}.` : "",
                output.resolution ? `Resolution: ${output.resolution}.` : "",
                "Images were returned to the UI as tool output and remain available to future createImage calls as references; image bytes are intentionally not included in the language-model tool result.",
                output.prompt ? `Prompt: ${output.prompt}` : "",
              ]
                .filter(Boolean)
                .join(" "),
            },
          ],
        }),
      }),
    },
  };
};
