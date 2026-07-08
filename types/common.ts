
export type ImageModel = string;
export type VideoModel = string;
export type CnDetailPromptVersion = 'original' | 'new';
export type CnDetailTextMode = 'auto' | 'withText' | 'noText';
export type CnDetailRatioMode = 'adaptive' | 'fixed';

export interface ImageTextBlockBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageTextBlock {
  id: string;
  text: string;
  box: ImageTextBlockBox;
  confidence?: number;
  angle?: number;
  lineIndex?: number;
  order?: number;
}

export interface ImageTextEditBlock extends ImageTextBlock {
  editedText: string;
  isChanged?: boolean;
}

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
  preGenerationPlanningEnabled?: boolean;
  referenceSummary?: string;
  constraints: string[];
  forbiddenChanges: string[];
  approvedAssetIds: string[];
  researchSummary?: string;
  referenceWebPages?: Array<{ title: string; url: string }>;
}

export type WorkspaceStyleLibraryAuthor = 'system' | 'main-brain' | 'user';

export type WorkspaceStyleLibraryKind =
  | 'style_library'
  | 'case_transfer'
  | 'edit_template';

export type WorkspaceStyleLibraryValidationStatus =
  | 'untested'
  | 'pending'
  | 'passed'
  | 'failed';

export interface WorkspaceStyleLibraryTestCase {
  id: string;
  title: string;
  prompt: string;
  referenceImageUrls?: string[];
  aspectRatio?: string;
  imageCount?: number;
  model?: string;
  expectedFocus?: string;
}

export interface WorkspaceStyleLibraryTestResult {
  caseId: string;
  outputImageUrls: string[];
  createdAt: number;
  model?: string;
  aspectRatio?: string;
  imageCount?: number;
  passed?: boolean;
  note?: string;
  libraryVersion?: number;
}

export interface WorkspaceStyleLibrary {
  id?: string;
  slug?: string;
  title: string;
  summary: string;
  coverImageUrl?: string;
  kind?: WorkspaceStyleLibraryKind;
  referenceImageUrls?: string[];
  keywords?: string[];
  promptText?: string;
  tags?: string[];
  description?: string;
  useCases?: string[];
  warnings?: string[];
  testCases?: WorkspaceStyleLibraryTestCase[];
  latestTestResults?: WorkspaceStyleLibraryTestResult[];
  validationStatus?: WorkspaceStyleLibraryValidationStatus;
  latestValidatedAt?: number;
  version?: number;
  referenceInterpretation: string;
  planningDirectives: string[];
  promptDirectives: string[];
  promptBackbone?: string[];
  createdBy?: WorkspaceStyleLibraryAuthor;
  updatedAt?: number;
  sourceMode?: 'default' | 'poster-product' | 'custom';
}

export interface WorkspaceStyleLibraryRuntimeOverlay {
  summary?: string;
  referenceInterpretation?: string;
  planningDirectives?: string[];
  promptDirectives?: string[];
  promptBackbone?: string[];
  promptText?: string;
  tags?: string[];
  description?: string;
  createdBy?: WorkspaceStyleLibraryAuthor;
  updatedAt?: number;
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
  genSizeMode?: 'preset' | 'custom' | 'auto';
  genCustomWidth?: number;
  genCustomHeight?: number;
  genImageQuality?: 'low' | 'medium' | 'high';
  genImageCount?: number;
  genInfiniteRetry?: boolean;
  genRequirePlanApproval?: boolean;
  genReferenceRoleMode?: 'none' | 'default' | 'poster-product' | 'custom';
  genStyleLibrary?: WorkspaceStyleLibrary;
  genStyleLibraryRuntimeOverlay?: WorkspaceStyleLibraryRuntimeOverlay;
  genVisualPlanningCacheKey?: string;
  genVisualPlanningCachePayload?: string;
  genVisualPlanningCacheCreatedAt?: number;
  detectedTexts?: ImageTextEditBlock[];

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
  workflowNodeId?: string;

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
  assistantThread?: {
    headId?: string | null;
    messages: AssistantThreadMessageStorageEntry[];
  };
  createdAt: number;
  updatedAt: number;
  autoTitle?: boolean;
  pinned?: boolean;
  archivedAt?: number;
  draft?: {
    inputBlocks?: InputBlock[];
    creationMode?: "agent" | "image" | "video";
    quickSkill?: ChatMessage["skillData"];
    modelMode?: "thinking" | "fast";
    webEnabled?: boolean;
  };
  parentConversationId?: string;
  parentConversationTitle?: string;
  branchedFromMessageId?: string;
  branchPointLabel?: string;
}

export interface AssistantThreadMessageStorageEntry {
  id: string;
  parent_id: string | null;
  format: string;
  content: Record<string, any>;
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

export type ChatMessageVersionSource =
  | 'send'
  | 'resend'
  | 'edit_resend'
  | 'assistant_retry';

export interface ChatMessageLineage {
  versionRootMessageId: string;
  previousVersionMessageId?: string;
  versionNumber: number;
  source: ChatMessageVersionSource;
  triggerMessageId?: string;
}

export interface ChatSendOptions {
  lineage?: {
    source?: ChatMessageVersionSource;
    versionRootMessageId?: string;
    previousVersionMessageId?: string;
    previousAssistantMessageId?: string;
    triggerMessageId?: string;
  };
  quote?: {
    text: string;
    messageId: string;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  kind?: 'text' | 'workflow_ui';
  workflowUi?: WorkflowUiMessage;
  timestamp: number;
  responseToMessageId?: string;
  quote?: {
    text: string;
    messageId: string;
  };
  lineage?: ChatMessageLineage;
  feedback?: 'up' | 'down' | null;
  feedbackUpdatedAt?: number;
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
      toolCallId?: string;
      result?: any;
      artifact?: any;
      modelContent?: any;
      params?: Record<string, any>;
      error?: string;
    }>;
    adjustments?: string[];
    analysis?: string;
    answerSegments?: Array<{
      text: string;
      citationOrdinals?: number[];
    }>;
    preGenerationMessage?: string;
    postGenerationSummary?: string;
    suggestions?: string[]; // 可点击的建议按钮（如"温馨日常故事"、"科技感风格"）
    isGenerating?: boolean;
    presentation?: {
      kind?: 'default' | 'execution_plan' | 'execution_record' | 'research';
      statusLabel?: string;
      modeLabel?: string;
      detailTitle?: string;
      detailNotice?: string;
    };
    executionTrace?: {
      status?: 'analyzing' | 'executing' | 'completed' | 'failed';
      progressMessage?: string;
      progressStep?: number;
      totalSteps?: number;
      progressLog?: string[];
      thoughtTrace?: string[];
      streamingText?: string;
      reasoningText?: string;
      stopReason?: string;
      stopReasonLabel?: string;
      errorCode?: string;
      errorMessage?: string;
    };
    research?: {
      status: 'searching' | 'completed' | 'failed';
      mode?: 'web' | 'images' | 'web+images';
      query?: string;
      summary?: string;
      providerLabel?: string;
      fallback?: boolean;
      webCount?: number;
      imageCount?: number;
      extractedCount?: number;
      citations?: Array<{
        title: string;
        url: string;
        host?: string;
        siteName?: string;
        snippet?: string;
        excerpt?: string;
      }>;
      extractedPages?: Array<{
        title: string;
        url: string;
        excerpt?: string;
        cleanedTextExcerpt?: string;
        length?: number;
        error?: string;
      }>;
      suggestedQueries?: string[];
    };
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
    pluginId?: string;
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
  cropUrl?: string;
  // 归一化坐标（0-1），表示标记点在原图的位置
  normalizedX?: number;
  normalizedY?: number;
  // 兼容旧数据：x/y/width/height 是裁切框（已废弃，仅用于回放历史）
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
  _pendingPreviewRect?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  _pendingAnchorBlockId?: string;
  _pendingAnchorIndex?: number;
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
import type { WorkflowUiMessage } from './workflow.types.ts';
