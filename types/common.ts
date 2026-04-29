
export type ImageModel = string;
export type VideoModel = string;
export type CnDetailPromptVersion = 'original' | 'new';
export type CnDetailTextMode = 'auto' | 'withText' | 'noText';
export type CnDetailRatioMode = 'adaptive' | 'fixed';

export type CnDetailRetryPolicy = {
  maxRetriesPerShot?: number;
  tiers?: Array<{
    maxRetries?: number;
    densityScale?: number;
  }>;
};

export type DesignTaskMode =
  | 'generate'
  | 'edit'
  | 'touch-edit'
  | 'text-edit'
  | 'layout-edit'
  | 'research'
  | 'clarify'
  | 'respond'
  | 'workflow-step';

export interface BrandInfo {
  name?: string;
  colors?: string[];
  fonts?: string[];
  style?: string;
}

export interface DesignSessionState {
  taskMode: DesignTaskMode;
  brand: BrandInfo;
  styleHints: string[];
  subjectAnchors: string[];
  subjectAnchorMode?: 'auto' | 'manual';
  consistencyCheckEnabled?: boolean;
  referenceSummary?: string;
  constraints: string[];
  forbiddenChanges: string[];
  approvedAssetIds: string[];
  researchSummary?: string;
  referenceWebPages?: Array<{ title: string; url: string }>;
}

export type ShapeType = 'square' | 'circle' | 'triangle' | 'star' | 'bubble' | 'arrow-left' | 'arrow-right';
export type WorkspaceNodeInteractionMode = 'classic' | 'branch';
export type WorkspaceNodeLinkKind = 'generation' | 'branch';
export type WorkspaceTreeNodeKind = 'image' | 'prompt';
export type GenerationStatusPhase =
  | 'planning'
  | 'planned'
  | 'queued'
  | 'generating'
  | 'retrying';

export interface CanvasElement {
  id: string;
  type: 'image' | 'video' | 'shape' | 'text' | 'gen-image' | 'gen-video' | 'group';
  url?: string;
  originalUrl?: string;
  persistedOriginalUrl?: string;
  proxyUrl?: string;
  shapeType?: ShapeType;
  // Text specific properties
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  letterSpacing?: number;
  lineHeight?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textDecoration?: 'none' | 'underline' | 'line-through';
  opacity?: number;

  // Shape specific
  cornerRadius?: number;
  aspectRatioLocked?: boolean;

  // Gen Image/Video specific
  genPrompt?: string;
  genModel?: ImageModel | VideoModel;
  genProviderId?: string | null;
  genAspectRatio?: string;
  genResolution?: '1K' | '2K' | '4K';
  genImageQuality?: 'low' | 'medium' | 'high';
  genImageCount?: 1 | 2 | 3 | 4;
  genInfiniteRetry?: boolean;
  genRequirePlanApproval?: boolean;
  genReferenceRoleMode?: 'none' | 'default' | 'poster-product';
  detectedTexts?: { original: string, edited?: string }[];

  // Image Gen Reference
  genRefImage?: string;
  genRefImages?: string[];
  genRefPreviewImage?: string;
  genRefPreviewImages?: string[];
  nodeInteractionMode?: WorkspaceNodeInteractionMode;
  nodeParentId?: string;
  nodeParentIds?: string[];
  nodeLinkKind?: WorkspaceNodeLinkKind;
  treeNodeKind?: WorkspaceTreeNodeKind;
  treeNodeTone?: string;
  treeChildrenCollapsed?: boolean;

  // Video Gen Specifics
  genStartFrame?: string;
  genEndFrame?: string;
  genVideoRefs?: string[];
  genDuration?: '4s' | '6s' | '8s' | '5s' | '10s'; // keeping 5s/10s for legacy
  genQuality?: '720p' | '1080p' | '4k';
  genFirstLastMode?: 'startEnd' | 'multiRef'; // Toggle for "Start/End Frame" vs "Multi Ref" in Veo 3.1

  isGenerating?: boolean;
  generatingType?: 'upscale' | 'vector' | 'remove-bg' | 'gen-image' | 'gen-video' | 'product-swap' | 'text-edit' | 'fast-edit' | 'eraser';
  genError?: string;
  genStatusPhase?: GenerationStatusPhase;
  genStatusTitle?: string;
  genStatusLines?: string[];
  hasFreshGeneratedGlow?: boolean;

  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  isLocked?: boolean;
  isHidden?: boolean;

  // Group support
  groupId?: string;
  children?: string[];
  isCollapsed?: boolean;
  originalChildData?: Record<string, { x: number; y: number; width: number; height: number; zIndex: number }>;
}

export interface Marker {
  id: string;
  x: number; // Relative to the element
  y: number; // Relative to the element
  elementId: string;
  cropUrl?: string; // The zoomed-in image data of the marked area
  label?: string; // User defined label
  analysis?: string; // AI analysis result
  width?: number; // Optional width of the marked region
  height?: number; // Optional height of the marked region
}


export interface ConversationSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  title: string;
  updatedAt: string;
  thumbnail?: string;
  elements?: CanvasElement[];
  markers?: Marker[];
  conversations?: ConversationSession[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  kind?: 'text' | 'workflow_ui';
  workflowUi?: WorkflowUiMessage;
  timestamp: number;
  attachments?: string[]; // Array of base64 images
  attachmentMetadata?: any[]; // Metadata for attachments (e.g. marker info)
  inlineParts?: Array<
    | {
        type: 'text';
        text: string;
      }
    | {
        type: 'attachment';
        url: string;
        label: string;
        markerInfo?: WorkspaceMarkerInfo;
      }
  >;
  error?: boolean;
  relatedMarkerId?: string;
  // Agent structured data (Lovart-style)
  agentData?: {
    model?: string;
    title?: string;
    description?: string;
    imageUrls?: string[];
    videoUrls?: string[];
    assets?: any[];
    proposals?: Array<{
      id: string;
      title: string;
      description: string;
      skillCalls?: Array<{
        skillName: string;
        params: Record<string, any>;
      }>;
      prompt?: string;
      previewUrl?: string;
      concept_image?: string;
    }>;
    skillCalls?: Array<{
      skillName: string;
      success?: boolean;
      description?: string;
      title?: string;
      result?: any;
      params?: Record<string, any>;
      error?: string;
    }>;
    adjustments?: string[];
    analysis?: string;
    preGenerationMessage?: string;
    postGenerationSummary?: string;
    suggestions?: string[]; // 可点击的建议按钮（如"温馨日常故事"、"科技感风格"）
    isGenerating?: boolean;
    browserSession?: {
      sessionId: string;
      status: string;
      statusLabel?: string;
      title?: string;
      summary?: string;
      diagnosisSummary?: string | null;
      repairSummary?: string | null;
      repairNotes?: string[];
      diagnosisIssues?: string[];
      currentStepTitle?: string | null;
      targetElementId?: string | null;
      targetElementLabel?: string | null;
      stepStats?: {
        total: number;
        completed: number;
        failed: number;
        running: number;
        pending: number;
      };
      steps?: Array<{
        id: string;
        title: string;
        status: string;
        statusLabel?: string;
        kind: 'tool' | 'host_action';
        actionLabel?: string;
        summary?: string;
        error?: string | null;
        inputSummary?: string[];
        resultSummary?: string[];
        media?: Array<{
          url: string;
          title: string;
          subtitle?: string | null;
        }>;
      }>;
    };
  };
  // User skill invocation structured data
  skillData?: {
    id: string;
    name: string;
    iconName: string;
    config?: (Record<string, any> & {
      defaults?: Record<string, any> & {
        promptVersion?: CnDetailPromptVersion;
        textMode?: CnDetailTextMode;
        ratioMode?: CnDetailRatioMode;
        fixedAspectRatio?: string;
        qualityThreshold?: number;
        replacementBudget?: number;
        retryPolicy?: CnDetailRetryPolicy;
      };
    });
  };
}

export interface Template {
  id: string;
  title: string;
  description: string;
  image: string;
}

export interface WorkspaceMarkerInfo {
  fullImageUrl?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
}

export type WorkspaceInputFile = File & {
  markerId?: string;
  markerName?: string;
  markerInfo?: WorkspaceMarkerInfo;
  lastAiAnalysis?: string;
  _canvasAutoInsert?: boolean;
  _canvasElId?: string;
  _canvasWidth?: number;
  _canvasHeight?: number;
  _canvasW?: number;
  _canvasH?: number;
  _chipPreviewUrl?: string;
  _attachmentId?: string;
};

export interface InputBlock {
  id: string;
  type: 'text' | 'file';
  text?: string;
  file?: WorkspaceInputFile;
}

// Agent System Types
export interface AgentChatMessage extends ChatMessage {
  agentId?: string;
  taskId?: string;
  skillCalls?: Array<{
    skillName: string;
    params: Record<string, any>;
    result?: any;
    error?: string;
  }>;
}

export interface ProjectContext {
  projectId: string;
  projectTitle: string;
  conversationId: string;
  brandInfo?: BrandInfo;
  designSession?: DesignSessionState;
  existingAssets: CanvasElement[];
  conversationHistory: ChatMessage[];
}
import type { WorkflowUiMessage } from './workflow.types';
