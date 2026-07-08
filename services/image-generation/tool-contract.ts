import type {
  ImageReferenceRoleMode,
  ImageTextPolicy,
  PromptLanguagePolicy,
} from '../providers/types';

export type ImageToolOperation = 'generate' | 'edit';
export type ImageToolResolution = '1K' | '2K' | '4K';
export type ImageToolOutputFormat = 'png' | 'jpeg' | 'webp';
export type ImageToolBackground = 'transparent' | 'opaque' | 'auto';
export type ImageToolModeration = 'low' | 'auto';
export type ImageToolStyle = 'vivid' | 'natural';
export type ImageToolResponseFormat = 'url' | 'b64_json';
export type ImageToolQualityInput =
  | 'low'
  | 'medium'
  | 'high'
  | 'auto'
  | 'standard'
  | 'hd';
export type ImageToolResolvedQuality = 'low' | 'medium' | 'high';

export interface ImageToolFieldSpec {
  key: string;
  label: string;
  description: string;
  required?: boolean;
}

export interface ImageToolRequest {
  prompt: string;
  model?: string;
  providerId?: string | null;
  operation?: ImageToolOperation;
  aspectRatio?: string;
  imageSize?: ImageToolResolution;
  exactSize?: string;
  imageQuality?: ImageToolResolvedQuality;
  quality?: ImageToolQualityInput;
  background?: ImageToolBackground;
  outputFormat?: ImageToolOutputFormat;
  outputCompression?: number;
  moderation?: ImageToolModeration;
  n?: number;
  partialImages?: number;
  stream?: boolean;
  style?: ImageToolStyle;
  responseFormat?: ImageToolResponseFormat;
  referenceImage?: string;
  referenceImages?: string[];
  maskImage?: string;
  inputFidelity?: 'high' | 'low';
  referenceStrength?: number;
  referencePriority?: 'first' | 'all';
  referenceMode?: 'style' | 'product';
  referenceRoleMode?: ImageReferenceRoleMode;
  promptLanguagePolicy?: PromptLanguagePolicy;
  textPolicy?: ImageTextPolicy;
  consistencyContext?: {
    approvedAssetIds?: string[];
    subjectAnchors?: string[];
    referenceSummary?: string;
    forbiddenChanges?: string[];
  };
  disableTransportRetries?: boolean;
  signal?: AbortSignal;
  onSubmitted?: (payload: {
    taskId: string;
    providerId?: string | null;
    baseUrl?: string | null;
    model?: string | null;
    route?: string | null;
    transportRequestSnapshot?: import('../../types/image-generation.types').ImageTransportRequestSnapshot | null;
  }) => void;
  onTransportPrepared?: (
    snapshot: import('../../types/image-generation.types').ImageTransportRequestSnapshot,
  ) => void;
}

export interface ImageToolNegotiationWarning {
  code:
    | 'MODEL_DEFAULTED'
    | 'ASPECT_RATIO_NORMALIZED'
    | 'IMAGE_SIZE_NORMALIZED'
    | 'EXACT_SIZE_NORMALIZED'
    | 'EXACT_SIZE_DOWNGRADED'
    | 'FIELD_IGNORED';
  message: string;
}

export const IMAGE_TOOL_FIELD_SPECS: ImageToolFieldSpec[] = [
  { key: 'prompt', label: '关键词', description: 'The actual generation or edit instruction.', required: true },
  { key: 'model', label: '模型', description: 'The intended image model.' },
  { key: 'providerId', label: 'Provider', description: 'Saved provider profile that resolves endpoint and key.' },
  { key: 'aspectRatio', label: '比例', description: 'Target aspect ratio such as 1:1, 3:4, 9:16, or 16:9.' },
  { key: 'imageSize', label: '分辨率档位', description: 'Preset output tier such as 1K, 2K, or 4K.' },
  { key: 'exactSize', label: '精确分辨率', description: 'Exact WxH output when the chosen model supports it.' },
  { key: 'imageQuality', label: '质量', description: 'Normalized quality tier used by transport.' },
  { key: 'background', label: '背景', description: 'transparent, opaque, or auto.' },
  { key: 'outputFormat', label: '输出格式', description: 'png, jpeg, or webp.' },
  { key: 'outputCompression', label: '压缩率', description: 'Compression for jpeg/webp transports.' },
  { key: 'referenceImages', label: '参考图', description: 'Optional one or more reference images.' },
  { key: 'maskImage', label: '蒙版', description: 'Optional edit mask image.' },
];

export const normalizeImageToolQuality = (
  input: ImageToolQualityInput | string | null | undefined,
): ImageToolResolvedQuality | undefined => {
  const normalized = String(input || '').trim().toLowerCase();
  if (!normalized || normalized === 'auto') return undefined;
  if (normalized === 'hd' || normalized === 'high') return 'high';
  if (normalized === 'standard' || normalized === 'medium') return 'medium';
  if (normalized === 'low') return 'low';
  return undefined;
};

