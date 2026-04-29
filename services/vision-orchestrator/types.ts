import type {
  ImageGenSkillParams,
  ImageReferenceRoleMode,
  ImageTextPolicy,
  PromptLanguagePolicy,
} from "../../types";

export type VisualTaskIntent =
  | "poster_rebuild"
  | "product_scene"
  | "product_lock"
  | "background_replace"
  | "subject_consistency"
  | "multi_reference_fusion"
  | "text_preserve"
  | "style_transfer"
  | "unknown";

export type VisualReferenceRole =
  | "layout"
  | "style"
  | "product"
  | "brand"
  | "subject"
  | "detail"
  | "background"
  | "supporting";

export type VisualConstraintLock = {
  brandIdentity: boolean;
  subjectShape: boolean;
  packagingLayout: boolean;
  composition: boolean;
  textLayout: boolean;
  materialTexture: boolean;
};

export type VisualReferencePlan = {
  id: string;
  url: string;
  role: VisualReferenceRole;
  weight: number;
  source: "manual" | "consistency-anchor";
  notes?: string;
};

export type VisualGenerationPlan = {
  intent: VisualTaskIntent;
  strategyId: string;
  userGoal: string;
  references: VisualReferencePlan[];
  taskRoleOverlay?: VisualRoleOverlay;
  locks: VisualConstraintLock;
  allowedEdits: string[];
  forbiddenEdits: string[];
  qualityHint: NonNullable<ImageGenSkillParams["imageQuality"]>;
  plannerNotes: string[];
  requestedReferenceRoleMode: ImageReferenceRoleMode;
  effectiveReferenceRoleMode: ImageReferenceRoleMode;
};

export type PlannerConsistencyContext = {
  approvedAssetIds?: string[];
  subjectAnchors?: string[];
  referenceSummary?: string;
  forbiddenChanges?: string[];
};

export type PlannedImageGeneration = {
  plan: VisualGenerationPlan;
  plannerMeta?: {
    source: "rule" | "model";
    modelId?: string;
    providerId?: string | null;
  };
  execution: {
    basePrompt: string;
    composedPrompt: string;
    referenceImages: string[];
    referencePriority?: "first" | "all";
    referenceStrength?: number;
    referenceRoleMode: ImageReferenceRoleMode;
    promptLanguagePolicy: PromptLanguagePolicy;
    textPolicy?: ImageTextPolicy;
    disableTransportRetries: boolean;
    consistencyContext?: PlannerConsistencyContext;
  };
};

export type PlanVisualGenerationInput = {
  prompt: string;
  manualReferenceImages: string[];
  referenceImages: string[];
  selectedGenerationModel?: string;
  taskRoleOverlay?: VisualRoleOverlay;
  taskPlanningBrief?: VisualPlanningBrief;
  requestedReferenceRoleMode?: ImageReferenceRoleMode;
  imageQuality?: NonNullable<ImageGenSkillParams["imageQuality"]>;
  translatePromptToEnglish?: boolean;
  enforceChineseTextInImage?: boolean;
  requiredChineseCopy?: string;
  disableTransportRetries?: boolean;
  consistencyContext?: PlannerConsistencyContext;
};

export type VisualPlannerModelConfig = {
  modelId: string;
  providerId?: string | null;
  label?: string;
};

export type VisualExecutionMode = "single" | "set" | "iterative";

export type SharedStyleGuide = {
  subjectIdentity: string[];
  brandLocks: string[];
  visualTone: string[];
  compositionGrammar: string[];
  materialLanguage: string[];
  forbiddenDrift: string[];
  preferredAspectRatios?: string[];
  continuityAnchorPolicy?: "none" | "first_approved" | "latest_approved";
};

export type VisualPageRole =
  | "cover"
  | "selling_point"
  | "detail"
  | "comparison"
  | "usage_scene"
  | "size_spec"
  | "story"
  | "custom";

export type VisualResearchMode = "none" | "images" | "web+images";

export type VisualResearchDecision = {
  shouldResearch: boolean;
  mode: VisualResearchMode;
  reason: string;
  topics: string[];
  searchQueries: string[];
};

export type VisualPagePlan = {
  id: string;
  title: string;
  goal: string;
  pageRole: VisualPageRole;
  aspectRatio: string;
  mustShow: string[];
  optionalShow?: string[];
  forbiddenEdits: string[];
  dependsOn?: string[];
  executionPrompt?: string;
};

export type VisualPlanningBrief = {
  requestType: string;
  deliverableForm: string;
  aspectRatioStrategy: string;
  researchFocus: string[];
  researchDecision: VisualResearchDecision;
  modelFitNotes: string[];
  promptDirectives: string[];
  risks: string[];
};

export type VisualRoleOverlayRole = {
  role: string;
  mission: string;
  focus: string[];
  outputContract: string[];
};

export type VisualRoleOverlay = {
  summary: string;
  mindset: string;
  planningPolicy: string[];
  executionDirectives: string[];
  roles: VisualRoleOverlayRole[];
};

export type VisualTaskPlan = {
  mode: VisualExecutionMode;
  userGoal: string;
  intent: string;
  reasoningSummary: string;
  toolChain: string[];
  planningBrief?: VisualPlanningBrief;
  roleOverlay?: VisualRoleOverlay;
  sharedStyleGuide?: SharedStyleGuide;
  pages?: VisualPagePlan[];
  single?: VisualGenerationPlan;
};

export type PlanVisualTaskInput = {
  prompt: string;
  manualReferenceImages: string[];
  referenceImages: string[];
  selectedGenerationModel?: string;
  requestedImageCount?: number;
  currentAspectRatio?: string;
  imageSize?: string;
  imageQuality?: NonNullable<ImageGenSkillParams["imageQuality"]>;
  requestedReferenceRoleMode?: ImageReferenceRoleMode;
  translatePromptToEnglish?: boolean;
  enforceChineseTextInImage?: boolean;
  requiredChineseCopy?: string;
  consistencyContext?: PlannerConsistencyContext;
};

export type PlannedVisualTaskUnit = {
  id: string;
  title: string;
  goal: string;
  aspectRatio: string;
  prompt: string;
  pageRole?: VisualPageRole;
  pageIndex: number;
  totalPages: number;
};

export type PlannedVisualTask = {
  taskPlan: VisualTaskPlan;
  units: PlannedVisualTaskUnit[];
};

export type VisualPlanningThoughtEvent = {
  phase: "task-planner" | "generation-planner";
  title?: string;
  message: string;
};

export type VisualPlanningThoughtHandler = (
  event: VisualPlanningThoughtEvent,
) => void;
