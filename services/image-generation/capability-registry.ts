import {
  getClosestWorkspaceAspectRatioFromSize,
  getImageModelSupportState,
  getOfficialGptImage2Size,
  getPresetImageSizeDimensions,
  getNormalizedAspectRatioForImageModel,
  isGptImage2FamilyModel,
  parseImageSizeString,
  type WorkspaceImageResolutionPreset,
} from '../openai-image-presets.ts';
import { resolveCanonicalImageModelId } from './core/openai-image-spec.ts';

export interface ImageModelCapability {
  model: string;
  canonicalModel: string;
  providerFamily: 'openai-compatible' | 'gemini-native' | 'generic';
  supportsExactSize: boolean;
  supportsMultipleReferences: boolean;
  supportsMask: boolean;
  supportsStreaming: boolean;
  presetResolutions: WorkspaceImageResolutionPreset[];
  allowedAspectRatios?: string[];
}

const GEMINI_31_FLASH_RATIOS = [
  '1:1',
  '1:4',
  '1:8',
  '2:3',
  '3:2',
  '3:4',
  '4:1',
  '4:3',
  '4:5',
  '5:4',
  '8:1',
  '9:16',
  '16:9',
  '21:9',
] as const;

const GEMINI_31_PRO_RATIOS = [
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '9:16',
  '16:9',
  '21:9',
] as const;

const GEMINI_25_FLASH_RATIOS = [
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '9:16',
  '16:9',
  '21:9',
] as const;

export const resolveImageModelCapability = (
  model: string | null | undefined,
): ImageModelCapability => {
  const canonicalModel = resolveCanonicalImageModelId(String(model || ''));

  if (canonicalModel === 'gpt-image-2' || canonicalModel === 'gpt-image-2-all') {
    return {
      model: String(model || ''),
      canonicalModel,
      providerFamily: 'openai-compatible',
      supportsExactSize: true,
      supportsMultipleReferences: true,
      supportsMask: true,
      supportsStreaming: false,
      presetResolutions: ['1K', '2K', '4K'],
      allowedAspectRatios: ['21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16'],
    };
  }

  if (canonicalModel === 'gpt-image-1.5-all') {
    return {
      model: String(model || ''),
      canonicalModel,
      providerFamily: 'openai-compatible',
      supportsExactSize: false,
      supportsMultipleReferences: true,
      supportsMask: true,
      supportsStreaming: true,
      presetResolutions: ['1K'],
      allowedAspectRatios: ['1:1', '3:2', '2:3'],
    };
  }

  if (canonicalModel === 'gemini-3.1-flash-image-preview') {
    return {
      model: String(model || ''),
      canonicalModel,
      providerFamily: 'gemini-native',
      supportsExactSize: false,
      supportsMultipleReferences: true,
      supportsMask: false,
      supportsStreaming: false,
      presetResolutions: ['1K', '2K', '4K'],
      allowedAspectRatios: [...GEMINI_31_FLASH_RATIOS],
    };
  }

  if (canonicalModel === 'gemini-3-pro-image-preview') {
    return {
      model: String(model || ''),
      canonicalModel,
      providerFamily: 'gemini-native',
      supportsExactSize: false,
      supportsMultipleReferences: true,
      supportsMask: false,
      supportsStreaming: false,
      presetResolutions: ['1K', '2K', '4K'],
      allowedAspectRatios: [...GEMINI_31_PRO_RATIOS],
    };
  }

  if (canonicalModel === 'gemini-2.5-flash-image') {
    return {
      model: String(model || ''),
      canonicalModel,
      providerFamily: 'gemini-native',
      supportsExactSize: false,
      supportsMultipleReferences: true,
      supportsMask: false,
      supportsStreaming: false,
      presetResolutions: ['1K'],
      allowedAspectRatios: [...GEMINI_25_FLASH_RATIOS],
    };
  }

  return {
    model: String(model || ''),
    canonicalModel,
    providerFamily: 'generic',
    supportsExactSize: false,
    supportsMultipleReferences: true,
    supportsMask: true,
    supportsStreaming: false,
    presetResolutions: ['1K', '2K', '4K'],
  };
};

export const normalizeAspectRatioForModelCapability = (
  model: string | null | undefined,
  aspectRatio: string | null | undefined,
): string => {
  const normalized = String(aspectRatio || '').trim() || '1:1';
  const capability = resolveImageModelCapability(model);

  if (capability.providerFamily === 'openai-compatible') {
    return getNormalizedAspectRatioForImageModel(model, normalized);
  }

  if (capability.allowedAspectRatios?.includes(normalized)) {
    return normalized;
  }

  if (!capability.allowedAspectRatios?.length) {
    return normalized;
  }

  const closest = getClosestWorkspaceAspectRatioFromSize(
    ...(() => {
      const dims = getPresetImageSizeDimensions({
        aspectRatio: normalized,
        resolution: '1K',
      });
      if (dims) return [dims.width, dims.height] as const;
      return [1024, 1024] as const;
    })(),
  );

  if (capability.allowedAspectRatios.includes(closest)) {
    return closest;
  }

  return capability.allowedAspectRatios[0] || '1:1';
};

export const resolveExactSizeForModelCapability = (args: {
  model: string | null | undefined;
  aspectRatio: string;
  imageSize: WorkspaceImageResolutionPreset;
  exactSize?: string | null | undefined;
}): string | undefined => {
  const capability = resolveImageModelCapability(args.model);
  const normalizedExactSize = String(args.exactSize || '').trim();

  if (!capability.supportsExactSize) {
    return undefined;
  }

  if (normalizedExactSize) {
    const parsed = parseImageSizeString(normalizedExactSize);
    if (parsed) {
      return `${parsed.width}x${parsed.height}`;
    }
  }

  if (isGptImage2FamilyModel(args.model)) {
    const support = getImageModelSupportState({
      model: args.model,
      aspectRatio: args.aspectRatio,
      resolution: args.imageSize,
    });
    return support.actualSize || getOfficialGptImage2Size(args.aspectRatio, args.imageSize) || undefined;
  }

  return undefined;
};
