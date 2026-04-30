import { ImageModel, VideoModel } from './common';

export interface ImageTextPolicy {
  enforceChinese?: boolean;
  requiredCopy?: string;
}

export type PromptLanguagePolicy = 'original-zh' | 'translate-en';
export type ImageReferenceRoleMode =
  | 'none'
  | 'default'
  | 'poster-product'
  | 'custom';

export interface ImageGenSkillParams {
  prompt: string;
  model: ImageModel;
  providerId?: string | null;
  aspectRatio: string;
  imageSize?: '1K' | '2K' | '4K';
  imageQuality?: 'low' | 'medium' | 'high';
  disableTransportRetries?: boolean;
  referenceImage?: string;
  referenceImageUrl?: string;
  reference_image_url?: string;
  initImage?: string;
  init_image?: string;
  referenceImages?: string[];
  referenceStrength?: number;
  referencePriority?: 'first' | 'all';
  referenceMode?: 'style' | 'product';
  referenceRoleMode?: ImageReferenceRoleMode;
  promptLanguagePolicy?: PromptLanguagePolicy;
  textPolicy?: ImageTextPolicy;
  brandContext?: {
    colors?: string[];
    style?: string;
  };
  consistencyContext?: {
    approvedAssetIds?: string[];
    subjectAnchors?: string[];
    referenceSummary?: string;
    forbiddenChanges?: string[];
  };
  maskImage?: string;
}

export interface VideoGenSkillParams {
  prompt: string;
  model: VideoModel;
  providerId?: string | null;
  aspectRatio: string;
  startFrame?: string;
  endFrame?: string;
  referenceImages?: string[];
}

export interface TextExtractSkillParams {
  imageData: string;
}

export interface RegionAnalyzeSkillParams {
  imageData: string;
  regionPrompt: string;
}

export interface TouchEditSkillParams {
  imageData: string;
  regionX: number;
  regionY: number;
  regionWidth: number;
  regionHeight: number;
  editInstruction: string;
  aspectRatio?: string;
  imageSize?: '1K' | '2K' | '4K';
  preservePrompt?: string;
}
