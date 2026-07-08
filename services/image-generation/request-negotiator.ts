import type { ImageGenerationRequest } from '../providers/types';
import { getProviderConfigById } from '../provider-config.ts';
import type { ImageTransportRequestSnapshot } from '../../types/image-generation.types';
import {
  extractAspectRatioHint,
  extractExactSizeHint,
  extractImageSizeHint,
} from './request-hints.ts';
import {
  normalizeAspectRatioForModelCapability,
  resolveExactSizeForModelCapability,
  resolveImageModelCapability,
} from './capability-registry.ts';
import {
  IMAGE_TOOL_FIELD_SPECS,
  normalizeImageToolQuality,
  type ImageToolNegotiationWarning,
  type ImageToolRequest,
} from './tool-contract.ts';
import {
  resolveCanonicalImageModelDisplayName,
  resolveCanonicalImageModelId,
} from './core/openai-image-spec.ts';

export interface NegotiatedImageToolRequest {
  request: ImageGenerationRequest;
  normalized: ImageToolRequest;
  capability: ReturnType<typeof resolveImageModelCapability>;
  warnings: ImageToolNegotiationWarning[];
  contractSummary: {
    toolName: 'generateImage';
    fieldSpecs: typeof IMAGE_TOOL_FIELD_SPECS;
    selectedModel: string;
    canonicalModel: string;
    providerId: string | null;
    endpointBaseUrl: string | null;
  };
}

const normalizeResolution = (
  value: string | null | undefined,
): '1K' | '2K' | '4K' | undefined => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === '1K' || normalized === '2K' || normalized === '4K') return normalized;
  return undefined;
};

const normalizeCompression = (value: unknown): number | undefined => {
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
  const rounded = Math.round(num);
  if (rounded < 0 || rounded > 100) return undefined;
  return rounded;
};

const normalizeMinimumCount = (value: unknown, min: number): number | undefined => {
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
  const rounded = Math.round(num);
  if (rounded < min) return undefined;
  return rounded;
};

const normalizeBoundedCount = (value: unknown, min: number, max: number): number | undefined => {
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
  const rounded = Math.round(num);
  if (rounded < min || rounded > max) return undefined;
  return rounded;
};

export const negotiateImageToolRequest = (
  input: ImageToolRequest,
): NegotiatedImageToolRequest => {
  const prompt = String(input.prompt || '').trim();
  if (!prompt) {
    throw new Error('generateImage requires a prompt.');
  }

  const requestedModel = String(input.model || '').trim();
  const canonicalModel = resolveCanonicalImageModelId(requestedModel || 'Auto');
  const selectedModel = resolveCanonicalImageModelDisplayName(requestedModel || 'Auto');
  const providerId = (() => {
    const raw = String(input.providerId || '').trim();
    if (!raw) return null;
    if (raw.toLowerCase() === 'default' || raw.toLowerCase() === 'auto') {
      return null;
    }
    return raw;
  })();
  const provider = getProviderConfigById(providerId);
  const capability = resolveImageModelCapability(canonicalModel);
  const warnings: ImageToolNegotiationWarning[] = [];

  if (!requestedModel) {
    warnings.push({
      code: 'MODEL_DEFAULTED',
      message: 'Model was not provided, so the preferred/default image model was used.',
    });
  }

  const requestedAspectRatio =
    String(input.aspectRatio || '').trim() ||
    extractAspectRatioHint(prompt) ||
    '1:1';
  const normalizedAspectRatio = normalizeAspectRatioForModelCapability(
    canonicalModel,
    requestedAspectRatio,
  );
  if (normalizedAspectRatio !== requestedAspectRatio) {
    warnings.push({
      code: 'ASPECT_RATIO_NORMALIZED',
      message: `Aspect ratio normalized from ${requestedAspectRatio} to ${normalizedAspectRatio}.`,
    });
  }

  const requestedImageSize =
    normalizeResolution(input.imageSize) ||
    extractImageSizeHint(prompt) ||
    '2K';
  const normalizedImageSize = capability.presetResolutions.includes(requestedImageSize)
    ? requestedImageSize
    : capability.presetResolutions[0] || '1K';
  if (normalizedImageSize !== requestedImageSize) {
    warnings.push({
      code: 'IMAGE_SIZE_NORMALIZED',
      message: `Image size normalized from ${requestedImageSize} to ${normalizedImageSize}.`,
    });
  }

  const requestedExactSize =
    String(input.exactSize || '').trim() ||
    extractExactSizeHint(prompt) ||
    '';
  const resolvedExactSize = resolveExactSizeForModelCapability({
    model: canonicalModel,
    aspectRatio: normalizedAspectRatio,
    imageSize: normalizedImageSize,
    exactSize: requestedExactSize || undefined,
  });
  if (requestedExactSize && !resolvedExactSize) {
    warnings.push({
      code: 'FIELD_IGNORED',
      message: 'The selected model does not use exactSize, so exactSize was ignored.',
    });
  } else if (requestedExactSize && resolvedExactSize && resolvedExactSize !== requestedExactSize) {
    warnings.push({
      code: 'EXACT_SIZE_NORMALIZED',
      message: `Exact size normalized from ${requestedExactSize} to ${resolvedExactSize}.`,
    });
  }

  const normalizedQuality =
    normalizeImageToolQuality(input.imageQuality || input.quality) || 'medium';

  const normalized: ImageToolRequest = {
    ...input,
    prompt,
    model: selectedModel,
    providerId,
    aspectRatio: normalizedAspectRatio,
    imageSize: normalizedImageSize,
    exactSize: resolvedExactSize,
    imageQuality: normalizedQuality,
    quality: input.quality,
    outputCompression: normalizeCompression(input.outputCompression),
    n: normalizeMinimumCount(input.n, 1),
    partialImages: normalizeBoundedCount(input.partialImages, 0, 3),
  };

  const request: ImageGenerationRequest = {
    prompt,
    signal: input.signal,
    providerId,
    aspectRatio: normalizedAspectRatio,
    imageSize: normalizedImageSize,
    exactSize: resolvedExactSize,
    imageQuality: normalizedQuality,
    disableTransportRetries: Boolean(input.disableTransportRetries),
    n: normalized.n,
    partialImages: normalized.partialImages,
    referenceImage: input.referenceImage,
    referenceImages: Array.isArray(input.referenceImages) ? input.referenceImages : undefined,
    maskImage: input.maskImage,
    referenceStrength: input.referenceStrength,
    referencePriority: input.referencePriority,
    referenceMode: input.referenceMode,
    referenceRoleMode: input.referenceRoleMode,
    promptLanguagePolicy: input.promptLanguagePolicy,
    textPolicy: input.textPolicy,
    consistencyContext: input.consistencyContext,
    onSubmitted: input.onSubmitted,
    onTransportPrepared: (snapshot: ImageTransportRequestSnapshot) => {
      const mergedWarnings = [
        ...warnings.map((item) => ({ code: item.code as any, message: item.message })),
        ...(Array.isArray(snapshot.warnings) ? snapshot.warnings : []),
      ];
      input.onTransportPrepared?.({
        ...snapshot,
        warnings: mergedWarnings,
      });
    },
  };

  return {
    request,
    normalized,
    capability,
    warnings,
    contractSummary: {
      toolName: 'generateImage',
      fieldSpecs: IMAGE_TOOL_FIELD_SPECS,
      selectedModel,
      canonicalModel,
      providerId: provider.id || providerId,
      endpointBaseUrl: provider.baseUrl || null,
    },
  };
};
