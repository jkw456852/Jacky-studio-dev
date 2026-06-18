import type { ImageTransportRequestSnapshot } from '../../types/image-generation.types';

export type PromptLanguagePolicy = 'original-zh' | 'translate-en';
export type ImageReferenceRoleMode =
  | 'none'
  | 'default'
  | 'poster-product'
  | 'custom';

export interface ImageTextPolicy {
  enforceChinese?: boolean;
  requiredCopy?: string;
}

export interface ImageGenerationRequest {
  prompt: string;
  signal?: AbortSignal;
  providerId?: string | null;
  aspectRatio: string;
  imageSize?: '1K' | '2K' | '4K';
  exactSize?: string;
  imageQuality?: 'low' | 'medium' | 'high';
  disableTransportRetries?: boolean;
  referenceImage?: string; // base64
  referenceImages?: string[];
  maskImage?: string;
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
  onSubmitted?: (payload: {
    taskId: string;
    providerId?: string | null;
    baseUrl?: string | null;
    model?: string | null;
    route?: string | null;
    transportRequestSnapshot?: ImageTransportRequestSnapshot | null;
  }) => void;
  onTransportPrepared?: (snapshot: ImageTransportRequestSnapshot) => void;
}

export interface VideoGenerationRequest {
  prompt: string;
  signal?: AbortSignal;
  providerId?: string | null;
  aspectRatio: string;
  startFrame?: string; // base64
  endFrame?: string; // base64
  referenceImages?: string[];
}

export type ProviderAuthMode = 'bearer' | 'apiKeyQuery' | 'both';
export type ProviderApiStyle = 'google' | 'openai' | 'custom';

export type ImageTransportRouteStyle =
  | 'openai-compatible'
  | 'gemini-inline'
  | 'replicate-prediction'
  | 'custom';

export type ImageTransportRequestMode =
  | 'standard-openai'
  | 'reverse-compat'
  | 'official-transfer'
  | 'gemini-inline'
  | 'replicate-prediction';

export type ImageEditPayloadMode =
  | 'json-image-ref-array'
  | 'multi-file-repeated-field'
  | 'single-file'
  | 'none';

export interface ImageTransportProfile {
  routeStyle: ImageTransportRouteStyle;
  generationRoute?: string;
  editRoute?: string;
  requestModes?: ImageTransportRequestMode[];
  editPayloadModes?: ImageEditPayloadMode[];
  jsonEditOfficialOnly?: boolean;
  supportsMultipartEdit?: boolean;
  supportsMultiReference?: boolean;
  supportsMask?: boolean;
  supportsExactSize?: boolean;
  aspectRatioPolicy?: 'strict-openai' | 'proxy-expanded' | 'provider-native';
  pollingResultMode?: 'direct' | 'task-poll' | 'prediction-poll';
  gptImage2EditFormat?: 'json-body' | 'chat-messages' | 'unsupported';
}

export interface ProviderCapability {
  authMode: ProviderAuthMode;
  apiStyle: ProviderApiStyle;
  supports: Array<'modelList' | 'chat' | 'image' | 'video'>;
  imageTransportProfile?: ImageTransportProfile;
}

export interface ImageProvider {
  id: string;
  name: string;
  models: string[];
  capability: ProviderCapability;
  generateImage(request: ImageGenerationRequest, model: string): Promise<string | null>;
}

export interface VideoProvider {
  id: string;
  name: string;
  models: string[];
  capability: ProviderCapability;
  generateVideo(request: VideoGenerationRequest, model: string): Promise<string | null>;
}

export type ProviderType = 'image' | 'video';
