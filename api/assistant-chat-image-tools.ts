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
  assistantSidebarUpscaleImageParameters,
  type AssistantSidebarCreateImageArgs,
  type AssistantSidebarUpscaleImageArgs,
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
  referenceImageContexts?: AssistantChatImageReferenceContext[] | null;
  markContexts?: AssistantChatImageMarkContext[] | null;
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

type AssistantChatUpscaleImageExecutionInput = AssistantSidebarUpscaleImageArgs & {
  sourceImage?: string | null;
  referenceImages?: string[] | null;
};

export type AssistantChatImageMarkContext = {
  label: string;
  imageUrl: string;
  markerId?: string;
  normalizedX: number;
  normalizedY: number;
  imageWidth?: number;
  imageHeight?: number;
};

export type AssistantChatImageReferenceContext = {
  imageUrl: string;
  imageWidth?: number;
  imageHeight?: number;
  aspectRatio?: string;
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

const normalizeCoordinate = (value: unknown): number | null => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(1, numeric));
};

const normalizePositiveInteger = (value: unknown): number | undefined => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  return Math.round(numeric);
};

const getGreatestCommonDivisor = (left: number, right: number): number => {
  let a = Math.abs(Math.round(left));
  let b = Math.abs(Math.round(right));
  while (b > 0) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a || 1;
};

const resolveMarkContextAspectRatio = (
  context: AssistantChatImageMarkContext,
): string | undefined => {
  const width = normalizePositiveInteger(context.imageWidth);
  const height = normalizePositiveInteger(context.imageHeight);
  if (!width || !height) return undefined;

  const divisor = getGreatestCommonDivisor(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
};

const normalizeAspectRatioString = (value: unknown): string | undefined => {
  const normalized = normalizeString(value);
  if (!/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(normalized)) return undefined;
  const [widthText, heightText] = normalized.split(":");
  const width = Number(widthText);
  const height = Number(heightText);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }
  return normalized;
};

const resolveReferenceContextAspectRatio = (
  context: AssistantChatImageReferenceContext,
): string | undefined => {
  const explicit = normalizeAspectRatioString(context.aspectRatio);
  if (explicit) return explicit;

  const width = normalizePositiveInteger(context.imageWidth);
  const height = normalizePositiveInteger(context.imageHeight);
  if (!width || !height) return undefined;

  const divisor = getGreatestCommonDivisor(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
};

const resolveInheritedReferenceAspectRatio = (
  args: {
    referenceContexts: AssistantChatImageReferenceContext[];
    markContexts: AssistantChatImageMarkContext[];
  },
): string | undefined => {
  for (const context of args.referenceContexts) {
    const aspectRatio = resolveReferenceContextAspectRatio(context);
    if (aspectRatio) return aspectRatio;
  }
  for (const context of args.markContexts) {
    const aspectRatio = resolveMarkContextAspectRatio(context);
    if (aspectRatio) return aspectRatio;
  }
  return undefined;
};

const normalizeMarkContexts = (
  value: AssistantChatImageMarkContext[] | null | undefined,
): AssistantChatImageMarkContext[] => {
  if (!Array.isArray(value)) return [];
  const contexts: AssistantChatImageMarkContext[] = [];
  for (const item of value) {
    const label = normalizeString(item?.label);
    const imageUrl = normalizeString(item?.imageUrl);
    const normalizedX = normalizeCoordinate(item?.normalizedX);
    const normalizedY = normalizeCoordinate(item?.normalizedY);
    if (
      !label ||
      !isValidAssistantImageReference(imageUrl) ||
      normalizedX == null ||
      normalizedY == null
    ) {
      continue;
    }
    const imageWidth = normalizePositiveInteger(item.imageWidth);
    const imageHeight = normalizePositiveInteger(item.imageHeight);
    contexts.push({
      label,
      imageUrl,
      normalizedX,
      normalizedY,
      ...(normalizeString(item.markerId)
        ? { markerId: normalizeString(item.markerId) }
        : {}),
      ...(imageWidth ? { imageWidth } : {}),
      ...(imageHeight ? { imageHeight } : {}),
    });
  }
  return contexts;
};

const normalizeReferenceImageContexts = (
  value: AssistantChatImageReferenceContext[] | null | undefined,
): AssistantChatImageReferenceContext[] => {
  if (!Array.isArray(value)) return [];
  const contexts: AssistantChatImageReferenceContext[] = [];
  for (const item of value) {
    const imageUrl = normalizeString(item?.imageUrl);
    if (!isValidAssistantImageReference(imageUrl)) continue;

    const imageWidth = normalizePositiveInteger(item.imageWidth);
    const imageHeight = normalizePositiveInteger(item.imageHeight);
    const aspectRatio = normalizeAspectRatioString(item.aspectRatio);
    contexts.push({
      imageUrl,
      ...(imageWidth ? { imageWidth } : {}),
      ...(imageHeight ? { imageHeight } : {}),
      ...(aspectRatio ? { aspectRatio } : {}),
    });
  }
  return contexts;
};

const resolveApplicableMarkContexts = (args: {
  markContexts: AssistantChatImageMarkContext[];
  promptText: string;
  resolvedReferenceImages: string[];
}): AssistantChatImageMarkContext[] => {
  if (args.markContexts.length === 0) return [];
  const referenceSet = new Set(args.resolvedReferenceImages.map(normalizeString));
  const promptText = normalizeString(args.promptText).toLowerCase();

  return args.markContexts.filter((context) => {
    if (referenceSet.has(context.imageUrl)) return true;
    return promptText.includes(context.label.toLowerCase());
  });
};

const resolveApplicableReferenceContexts = (args: {
  referenceContexts: AssistantChatImageReferenceContext[];
  resolvedReferenceImages: string[];
}): AssistantChatImageReferenceContext[] => {
  if (args.referenceContexts.length === 0) return [];
  const referenceSet = new Set(args.resolvedReferenceImages.map(normalizeString));
  return args.referenceContexts.filter((context) =>
    referenceSet.has(context.imageUrl),
  );
};

const mergeMarkContextReferenceImages = (
  referenceImages: string[],
  markContexts: AssistantChatImageMarkContext[],
): string[] => {
  const merged = [...referenceImages];
  for (const context of markContexts) {
    if (!merged.includes(context.imageUrl)) {
      merged.push(context.imageUrl);
    }
  }
  return merged;
};

const appendMarkContextsToPrompt = (
  promptText: string,
  markContexts: AssistantChatImageMarkContext[],
): string => {
  const text = normalizeString(promptText);
  if (markContexts.length === 0) return text;

  const lines = markContexts.map((context, index) => {
    const imageSize =
      context.imageWidth && context.imageHeight
        ? `; source image size ${context.imageWidth}x${context.imageHeight}px`
        : "";
    const markerId = context.markerId ? `; markerId ${context.markerId}` : "";
    return (
      `${index + 1}. ${context.label}: exact user-selected canvas mark at ` +
      `normalized coordinates x=${context.normalizedX.toFixed(4)}, ` +
      `y=${context.normalizedY.toFixed(4)} on the matching reference image` +
      `${imageSize}${markerId}. Treat this as the spatial anchor for any edit ` +
      `or generation instruction that mentions ${context.label}; preserve ` +
      `unmentioned areas unless the user asks otherwise.`
    );
  });

  return [
    text,
    "[Canvas mark contexts for image tool]",
    ...lines,
  ].join("\n\n");
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

const normalizeUpscaleResolution = (
  value: unknown,
): "2K" | "4K" | "8K" => {
  const normalized = normalizeString(value).toUpperCase();
  if (normalized === "2K" || normalized === "4K" || normalized === "8K") {
    return normalized;
  }
  return "4K";
};

const toImageGenerationResolution = (
  value: "2K" | "4K" | "8K",
): "2K" | "4K" => (value === "2K" ? "2K" : "4K");

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
    operation?: string;
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
    ...(context.operation ? { operation: context.operation } : {}),
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

const buildUpscalePrompt = (args: {
  resolution: "2K" | "4K" | "8K";
  extraPrompt?: string;
}): string =>
  [
    `Content-preserving AI super-resolution upscale to ${args.resolution}.`,
    "Use the attached image as the exact source image.",
    "Preserve the original composition, crop, aspect ratio, subject identity, product shape, typography, Chinese text, logos, colors, lighting, background, and all layout positions.",
    "Do not redesign, recompose, replace text, add new promotional blocks, change objects, or generate a related new poster.",
    "Only improve apparent resolution, edge clarity, fine detail, texture fidelity, and compression artifacts while keeping the image visually the same.",
    args.extraPrompt ? `Extra user instruction: ${args.extraPrompt}` : "",
  ]
    .filter(Boolean)
    .join("\n");

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
  const defaultReferenceImageContexts = normalizeReferenceImageContexts(
    config.referenceImageContexts,
  );
  const defaultMarkContexts = normalizeMarkContexts(config.markContexts);
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
        async execute(input, options) {
          const executionInput = input as AssistantChatCreateImageExecutionInput;
          const referenceImages = [
            ...(executionInput.images || []),
            ...(executionInput.referenceImages || []),
          ]
            .map(normalizeString)
            .filter(isValidAssistantImageReference);
          const baseReferenceImages =
            referenceImages.length > 0 ? referenceImages : defaultReferenceImages;
          const mask =
            normalizeString(executionInput.mask) ||
            normalizeString(executionInput.maskImage);
          const imageCount = settingsLocked
            ? defaultCount
            : Math.max(minimumCount, normalizeImageCount(input.count, defaultCount));
          const promptText = normalizeString(input.text) || input.prompt;
          const applicableMarkContexts = resolveApplicableMarkContexts({
            markContexts: defaultMarkContexts,
            promptText,
            resolvedReferenceImages: baseReferenceImages,
          });
          const resolvedReferenceImages = mergeMarkContextReferenceImages(
            baseReferenceImages,
            applicableMarkContexts,
          );
          const applicableReferenceContexts = resolveApplicableReferenceContexts({
            referenceContexts: defaultReferenceImageContexts,
            resolvedReferenceImages,
          });
          const finalPromptText = appendMarkContextsToPrompt(
            promptText,
            applicableMarkContexts,
          );
          const explicitAspectRatio = normalizeString(input.aspectRatio);
          const explicitSize = normalizeString(input.size);
          const inheritedAspectRatio =
            !settingsLocked && !explicitAspectRatio && !explicitSize
              ? resolveInheritedReferenceAspectRatio({
                  referenceContexts: applicableReferenceContexts,
                  markContexts: applicableMarkContexts,
                })
              : undefined;
          const aspectRatio = settingsLocked
            ? defaultAspectRatio
            : explicitAspectRatio || inheritedAspectRatio || defaultAspectRatio;
          const size = !googleImageModel
            ? toOpenAICompatibleSize(
                canonicalModelId,
                aspectRatio,
                defaultResolution,
                settingsLocked ? undefined : explicitSize || undefined,
              )
            : undefined;
          const prompt =
            resolvedReferenceImages.length > 0 || mask
              ? {
                  text: finalPromptText,
                  images: resolvedReferenceImages,
                  ...(mask ? { mask } : {}),
                }
              : finalPromptText;

          const generateOptions = {
            model: imageModel as any,
            prompt,
            n: imageCount,
            maxRetries: 0,
            ...(options?.abortSignal
              ? { abortSignal: options.abortSignal }
              : {}),
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
              prompt: finalPromptText,
            });
          }

          const output = toImageToolOutput(result, {
            providerId: resolvedProvider.id,
            providerName: resolvedProvider.name,
            modelId: canonicalModelId,
            prompt: finalPromptText,
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
      upscaleImage: tool({
        description:
          "Content-preserving AI super-resolution / upscale for an existing source image. Use this for requests like upscale, enlarge to 4K, make higher-resolution, sharpen, or improve clarity while keeping the image the same. Do not use createImage for pure upscaling.",
        inputSchema: assistantSidebarUpscaleImageParameters,
        needsApproval: true,
        async execute(input, options) {
          const executionInput = input as AssistantChatUpscaleImageExecutionInput;
          const sourceImage = [
            executionInput.image,
            executionInput.sourceImage,
            ...(executionInput.images || []),
            ...(executionInput.referenceImages || []),
            ...defaultReferenceImages,
          ]
            .map(normalizeString)
            .find(isValidAssistantImageReference);

          if (!sourceImage) {
            throw new Error(
              "upscaleImage requires an image reference. Attach or reference an image before asking for AI upscale.",
            );
          }

          const requestedUpscaleResolution = normalizeUpscaleResolution(
            executionInput.resolution,
          );
          const generationResolution = toImageGenerationResolution(
            requestedUpscaleResolution,
          );
          const referenceContexts = resolveApplicableReferenceContexts({
            referenceContexts: defaultReferenceImageContexts,
            resolvedReferenceImages: [sourceImage],
          });
          const inheritedAspectRatio =
            resolveInheritedReferenceAspectRatio({
              referenceContexts,
              markContexts: [],
            }) || defaultAspectRatio;
          const size = !googleImageModel
            ? toOpenAICompatibleSize(
                canonicalModelId,
                inheritedAspectRatio,
                generationResolution,
                undefined,
              )
            : undefined;
          const promptText = buildUpscalePrompt({
            resolution: requestedUpscaleResolution,
            extraPrompt: executionInput.prompt,
          });
          const result = await runGenerateImage({
            model: imageModel as any,
            prompt: {
              text: promptText,
              images: [sourceImage],
            },
            n: 1,
            maxRetries: 0,
            ...(options?.abortSignal
              ? { abortSignal: options.abortSignal }
              : {}),
            ...(size ? { size } : {}),
            ...(!size && inheritedAspectRatio
              ? { aspectRatio: inheritedAspectRatio as `${number}:${number}` }
              : {}),
            ...(googleImageModel
              ? {
                  providerOptions: toGoogleImageProviderOptions({
                    aspectRatio: inheritedAspectRatio,
                    resolution: generationResolution,
                  }),
                }
              : {}),
          });

          const output = toImageToolOutput(result, {
            providerId: resolvedProvider.id,
            providerName: resolvedProvider.name,
            modelId: canonicalModelId,
            prompt: promptText,
            referenceCount: 1,
            size,
            aspectRatio: inheritedAspectRatio,
            resolution: generationResolution,
            count: 1,
            settingsLocked: false,
            operation: "upscale",
          });

          return requestedUpscaleResolution === "8K"
            ? {
                ...output,
                requestedResolution: requestedUpscaleResolution,
                warnings: [
                  ...(Array.isArray(output.warnings) ? output.warnings : []),
                  "The configured AI SDK image provider only exposes up to 4K through this route, so the upscale was requested at 4K instead of 8K.",
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
                `Upscaled ${output.images.length} image${output.images.length === 1 ? "" : "s"}.`,
                output.providerName || output.providerId
                  ? `Provider: ${output.providerName || output.providerId}.`
                  : "",
                output.modelId ? `Model: ${output.modelId}.` : "",
                output.size ? `Size: ${output.size}.` : "",
                output.aspectRatio ? `Aspect ratio: ${output.aspectRatio}.` : "",
                output.resolution ? `Resolution: ${output.resolution}.` : "",
                "The result was produced from the attached source image for content-preserving upscale; no text-only fallback was used.",
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
