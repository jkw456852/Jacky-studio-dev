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
  providerId?: string | null;
  aspectRatio: string;
  imageSize?: '1K' | '2K' | '4K';
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
}

export interface VideoGenerationRequest {
  prompt: string;
  providerId?: string | null;
  aspectRatio: string;
  startFrame?: string; // base64
  endFrame?: string; // base64
  referenceImages?: string[];
}

export type ProviderAuthMode = 'bearer' | 'apiKeyQuery' | 'both';
export type ProviderApiStyle = 'google' | 'openai' | 'custom';

export interface ProviderCapability {
  authMode: ProviderAuthMode;
  apiStyle: ProviderApiStyle;
  supports: Array<'modelList' | 'chat' | 'image' | 'video'>;
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
