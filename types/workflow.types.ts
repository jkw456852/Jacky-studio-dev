export type ClothingStep =
  | 'WAIT_PRODUCT'
  | 'ANALYZING_PRODUCT'
  | 'WAIT_MODEL_OPTIONAL'
  | 'NEED_MODEL'
  | 'MODEL_GENERATING'
  | 'WAIT_REQUIREMENTS'
  | 'GENERATING'
  | 'DONE';

export type EcommerceWorkflowStep =
  | 'WAIT_PRODUCT'
  | 'ANALYZE_PRODUCT'
  | 'SUPPLEMENT_INFO'
  | 'ANALYZE_IMAGES'
  | 'PLAN_SCHEMES'
  | 'FINALIZE_PROMPTS'
  | 'BATCH_GENERATE'
  | 'DONE';

export type ProductType = 'top' | 'dress' | 'pants' | 'skirt' | 'set' | 'outerwear' | 'unknown';

export type ClothingAnalysis = {
  productType: ProductType;
  isSet: boolean;
  keyFeatures: string[];
  materialGuess: string[];
  colorPalette: string[];
  fitSilhouette: string[];
  anchorDescription: string;
  forbiddenChanges: string[];
  recommendedStyling: {
    accessories: string[];
    bottoms: string[];
    bags: string[];
    shoes: string[];
  };
  recommendedPoses: string[];
  shotListHints: string[];
  productAnchorIndex: number;
};

export type Requirements = {
  platform: string;
  description: string;
  targetLanguage: string;
  aspectRatio: string;
  clarity: '1K' | '2K' | '4K';
  count: number;
  templateId?: string;
  styleTags?: string[];
  backgroundTags?: string[];
  cameraTags?: string[];
  focusTags?: string[];
  extraText?: string;
  referenceUrl?: string;
};

export type ModelGenOptions = {
  gender?: string;
  ageRange?: string;
  skinTone?: string;
  pose?: string;
  expression?: string;
  hairstyle?: string;
  makeup?: string;
  extra?: string;
  count: number;
};

export type EcommerceWorkflowImage = {
  id: string;
  url: string;
  name?: string;
  title?: string;
  description?: string;
  source?: 'product' | 'reference';
};

export type EcommerceCompetitorDeckImage = {
  id: string;
  url: string;
  name?: string;
  pageIndex?: number;
};

export type EcommerceCompetitorImageAnalysisStatus =
  | 'idle'
  | 'running'
  | 'success'
  | 'failed';

export type EcommerceCompetitorImageAnalysisItem = {
  id: string;
  deckId: string;
  imageId: string;
  imageIndex: number;
  imageUrl: string;
  status: EcommerceCompetitorImageAnalysisStatus;
  requestedModel?: string | null;
  providerId?: string | null;
  baseUrl?: string | null;
  responseId?: string | null;
  responseModel?: string | null;
  finishReason?: string | null;
  responseText?: string;
  responsePreview?: string;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  latestDebugPath?: string | null;
  dailyDebugPath?: string | null;
};

export type EcommerceCompetitorDeckInput = {
  id: string;
  name?: string;
  source?: 'upload' | 'manual';
  referenceUrl?: string;
  notes?: string;
  images: EcommerceCompetitorDeckImage[];
  imageAnalyses?: EcommerceCompetitorImageAnalysisItem[];
};

export type EcommercePromptLanguage = 'zh' | 'en' | 'auto';
export type EcommerceWorkflowMode = 'quick' | 'professional';
export type EcommercePlatformMode =
  | 'general'
  | 'taobao'
  | 'jd'
  | 'pdd'
  | 'douyin'
  | 'xiaohongshu'
  | 'amazon';

export type EcommerceBatchPhaseStatus =
  | 'idle'
  | 'queued'
  | 'generating'
  | 'done'
  | 'failed';

export type EcommerceRecommendedType = {
  id: string;
  title: string;
  description: string;
  imageCount: number;
  priority: 'high' | 'medium' | 'low';
  platformTags: string[];
  selected: boolean;
  reason?: string;
  highlights?: string[];
  recommended?: boolean;
  required?: boolean;
  goal?: string;
  confidence?: 'high' | 'medium' | 'low';
  evidence?: string[];
  omittedReason?: string;
  source?: 'ai' | 'fallback';
  usedFallback?: boolean;
  fallbackReason?: string;
};

export type EcommerceArchetypeEvolutionProposal = {
  candidateId: string;
  label: string;
  appliesWhen: string;
  whyCurrentArchetypesFail: string;
  proposedDecisionFactors: string[];
  proposedMustShow: string[];
  proposedVisualProofGrammar: string[];
  boundaryExamples: string[];
  confidence: 'high' | 'medium' | 'low';
};

export type EcommerceReviewSource = 'ai' | 'fallback';

export type EcommerceCompetitorPageRole =
  | 'hero'
  | 'white-bg'
  | 'selling'
  | 'scene'
  | 'comparison'
  | 'detail'
  | 'spec'
  | 'conversion'
  | 'other';

export type EcommerceCompetitorTextDensity = 'low' | 'medium' | 'high';

export type EcommerceCompetitorDeckOverview = {
  productPositioning: string;
  overallStyle: string;
  narrativePattern: string;
  conversionStrategy: string;
};

export type EcommerceCompetitorPageAnalysis = {
  pageIndex: number;
  pageRole: EcommerceCompetitorPageRole;
  titleSummary: string;
  businessTask: string;
  keySellingPoint: string;
  layoutPattern: string;
  textDensity: EcommerceCompetitorTextDensity;
  evidenceStyle: string;
  notes: string;
};

export type EcommerceCompetitorPlanningHints = {
  recommendedPageSequence: string[];
  recommendedStoryOrder: string[];
  recommendedVisualPrinciples: string[];
  recommendedTextPrinciples: string[];
};

export type EcommerceCompetitorStrategyMode =
  | 'off'
  | 'sequence-only'
  | 'sequence-story'
  | 'full';

export type EcommerceCompetitorDeckAnalysis = {
  competitorId: string;
  competitorName?: string;
  overview: EcommerceCompetitorDeckOverview;
  pageSequence: EcommerceCompetitorPageAnalysis[];
  globalPatterns: {
    commonPageRoles: string[];
    commonSellingPointOrder: string[];
    commonLayoutPatterns: string[];
    commonTextStrategies: string[];
    commonConversionSignals: string[];
  };
  borrowablePrinciples: string[];
  avoidCopying: string[];
  opportunitiesForOurProduct: string[];
  planningHints: EcommerceCompetitorPlanningHints;
};

export type EcommerceCompetitorPlanningContext = {
  deckCount: number;
  recommendedPageSequence: string[];
  recommendedStoryOrder: string[];
  recommendedVisualPrinciples: string[];
  recommendedTextPrinciples: string[];
  borrowablePrinciples: string[];
  avoidCopying: string[];
  opportunitiesForOurProduct: string[];
};

export type EcommerceAnalysisReview = {
  confidence: 'high' | 'medium' | 'low';
  verdict: string;
  reviewerNotes: string[];
  risks?: string[];
  source?: EcommerceReviewSource;
  usedFallback?: boolean;
  fallbackReason?: string;
};

export type EcommerceStageReview = {
  confidence: 'high' | 'medium' | 'low';
  verdict: string;
  reviewerNotes: string[];
  risks?: string[];
  source?: EcommerceReviewSource;
  usedFallback?: boolean;
  fallbackReason?: string;
};

export type EcommerceSupplementField = {
  id: string;
  label: string;
  kind: 'text' | 'textarea' | 'single-select' | 'multi-select' | 'image';
  required: boolean;
  placeholder?: string;
  options?: string[];
  value?: string | string[];
  helperText?: string;
  maxItems?: number;
  valueSource?: 'user' | 'ai' | 'estimated';
  valueConfidence?: 'high' | 'medium' | 'low';
  valueNote?: string;
};

export type EcommerceImageAnalysis = {
  imageId: string;
  title: string;
  description: string;
  analysisConclusion?: string;
  angle?: string;
  usableAsReference: boolean;
  highlights?: string[];
  materials?: string[];
  confidence?: 'high' | 'medium' | 'low';
  evidence?: string[];
  source?: 'ai' | 'fallback';
  usedFallback?: boolean;
  fallbackReason?: string;
};

export type EcommerceLayoutAreaKind =
  | 'headline'
  | 'subheadline'
  | 'stats'
  | 'icons'
  | 'body'
  | 'comparison'
  | 'annotation';

export type EcommerceLayoutMode =
  | 'top-banner'
  | 'left-copy'
  | 'right-copy'
  | 'bottom-panel'
  | 'center-focus-with-edge-space'
  | 'split-info';

export type EcommerceImageRole =
  | 'hero'
  | 'selling-point'
  | 'parameter'
  | 'structure'
  | 'detail'
  | 'scene'
  | 'comparison'
  | 'summary';

export type EcommerceComponentNeed =
  | 'text-only'
  | 'text-and-icons'
  | 'text-and-stats'
  | 'annotation-heavy'
  | 'comparison-heavy';

export type EcommerceLayoutIntent = {
  imageRole?: EcommerceImageRole;
  layoutMode?: EcommerceLayoutMode;
  componentNeed?: EcommerceComponentNeed;
  reservedAreas?: EcommerceLayoutAreaKind[];
};

export type EcommerceLayoutSnapshot = EcommerceLayoutIntent & {
  sourcePlanItemId?: string;
  typeId?: string;
  typeTitle?: string;
};

export type EcommerceOverlayTemplateId =
  | 'hero-left'
  | 'hero-right'
  | 'hero-center'
  | 'spec-band';

export type EcommerceOverlayTextAlign = 'left' | 'center' | 'right';

export type EcommerceOverlayTone = 'light' | 'dark' | 'accent';

export type EcommerceOverlayBulletStyle = 'list' | 'chips' | 'cards';

export type EcommerceOverlayLayerKind =
  | 'badge'
  | 'headline'
  | 'subheadline'
  | 'featureTags'
  | 'price'
  | 'stats'
  | 'comparison'
  | 'bullets'
  | 'cta';

export type EcommerceOverlayStylePresetId =
  | 'minimal-panel'
  | 'feature-callouts'
  | 'spec-focus'
  | 'comparison-focus';

export type EcommerceOverlayPlatformPresetId =
  | 'general-detail'
  | 'taobao-detail'
  | 'jd-detail'
  | 'douyin-window'
  | 'xiaohongshu-cover'
  | 'amazon-infographic';

export type EcommerceOverlayLayer = {
  id: string;
  kind: EcommerceOverlayLayerKind;
  label?: string;
  visible?: boolean;
  order?: number;
  locked?: boolean;
};

export type EcommerceOverlayStat = {
  label: string;
  value: string;
};

export type EcommerceOverlayComparisonRow = {
  label: string;
  before?: string;
  after: string;
};

export type EcommerceTextContainerReplacementMode =
  | 'reserve-space'
  | 'replace-generated-text'
  | 'overlay-only';

export type EcommerceOverlayReplacementProfileId =
  | 'hero'
  | 'selling'
  | 'comparison'
  | 'spec'
  | 'detail'
  | 'scene'
  | 'conversion'
  | 'white-bg';

export type EcommerceOverlayReplacementSourceMode =
  | 'anchor-only'
  | 'template-only'
  | 'hybrid';

export type EcommerceOverlayReplacementBackgroundKind =
  | 'flat-clean'
  | 'soft-gradient'
  | 'textured-surface'
  | 'complex-photo'
  | 'unknown';

export type EcommerceOverlayReplacementEraseStrategy =
  | 'clean-plate'
  | 'soft-blend'
  | 'texture-rebuild'
  | 'photo-reconstruct'
  | 'generic';

export type EcommerceOverlayReplacementQuality = {
  profileId?: EcommerceOverlayReplacementProfileId;
  sourceMode?: EcommerceOverlayReplacementSourceMode;
  backgroundKind?: EcommerceOverlayReplacementBackgroundKind;
  eraseStrategy?: EcommerceOverlayReplacementEraseStrategy;
  confidence?: 'high' | 'medium' | 'low';
  anchorCount?: number;
  replacementBoxCount?: number;
  mergedBoxCount?: number;
  summary?: string;
};

export type EcommerceTextContainerIntent = {
  id: string;
  role: EcommerceOverlayLayerKind;
  area?: EcommerceLayoutAreaKind;
  replacementMode?: EcommerceTextContainerReplacementMode;
  priority?: 'primary' | 'secondary' | 'support';
  maxLines?: number;
  maxChars?: number;
  textAlign?: EcommerceOverlayTextAlign;
  placementHint?: string;
};

export type EcommerceCopyPlan = {
  badge?: string;
  headline?: string;
  subheadline?: string;
  priceLabel?: string;
  priceValue?: string;
  priceNote?: string;
  featureTags?: string[];
  bullets?: string[];
  stats?: EcommerceOverlayStat[];
  comparisonTitle?: string;
  comparisonRows?: EcommerceOverlayComparisonRow[];
  cta?: string;
};

export type EcommerceOverlayState = {
  status?: 'idle' | 'draft' | 'ready' | 'applied';
  renderStatus?: 'success' | 'warning' | 'error';
  renderStatusMessage?: string;
  renderedPersistence?: 'persisted' | 'session-only';
  replacementQuality?: EcommerceOverlayReplacementQuality;
  templateId?: EcommerceOverlayTemplateId;
  stylePresetId?: EcommerceOverlayStylePresetId;
  platformPresetId?: EcommerceOverlayPlatformPresetId;
  headline?: string;
  subheadline?: string;
  badge?: string;
  priceLabel?: string;
  priceValue?: string;
  priceNote?: string;
  featureTags?: string[];
  bullets?: string[];
  stats?: EcommerceOverlayStat[];
  comparisonTitle?: string;
  comparisonRows?: EcommerceOverlayComparisonRow[];
  cta?: string;
  textAlign?: EcommerceOverlayTextAlign;
  tone?: EcommerceOverlayTone;
  bulletStyle?: EcommerceOverlayBulletStyle;
  layers?: EcommerceOverlayLayer[];
  fontFamily?: string;
  fontLabel?: string;
  fontAssetId?: string;
  fontUrl?: string;
  featureTagIconAssetId?: string;
  featureTagIconUrl?: string;
  featureTagIconLabel?: string;
  textContainerIntents?: EcommerceTextContainerIntent[];
  baseAssetId?: string;
  baseImageUrl?: string;
  renderedAssetId?: string;
  renderedImageUrl?: string;
  renderedAt?: number;
  lastEditedAt?: number;
};

export type EcommercePlanItem = {
  id: string;
  title: string;
  description: string;
  promptOutline: string;
  ratio: string;
  referenceImageIds: string[];
  status: 'draft' | 'ready';
  marketingGoal?: string;
  keyMessage?: string;
  mustShow?: string[];
  composition?: string;
  styling?: string;
  background?: string;
  lighting?: string;
  platformFit?: string[];
  riskNotes?: string[];
  layoutIntent?: EcommerceLayoutIntent;
  copyPlan?: EcommerceCopyPlan;
  textContainerIntents?: EcommerceTextContainerIntent[];
};

export type EcommercePlanGroup = {
  typeId: string;
  typeTitle: string;
  items: EcommercePlanItem[];
  summary?: string;
  strategy?: Array<{ label: string; value: string }>;
  platformTags?: string[];
  priority?: 'high' | 'medium' | 'low';
  source?: 'ai' | 'fallback';
  usedFallback?: boolean;
  fallbackReason?: string;
};

export type EcommerceResultReview = {
  score: number;
  confidence: 'high' | 'medium' | 'low';
  summary: string;
  strengths: string[];
  issues: string[];
  recommendedUse?: string;
};

export type EcommerceGenerationMeta = {
  usedModelLabel?: string;
  usedModel?: string;
  attemptedModels?: string[];
  referenceImageCount?: number;
  consistencyGuarded?: boolean;
  aspectRatio?: string;
  promptHash?: string;
  promptSummary?: string;
  promptText?: string;
  imageRole?: EcommerceImageRole;
  layoutMode?: EcommerceLayoutMode;
  componentNeed?: EcommerceComponentNeed;
};

export type EcommerceResultItem = {
  assetId?: string;
  url: string;
  label?: string;
  review?: EcommerceResultReview;
  generationMeta?: EcommerceGenerationMeta;
  layoutMeta?: EcommerceLayoutSnapshot;
  overlayState?: EcommerceOverlayState;
};

export type EcommerceModelOption = {
  id: string;
  name: string;
  provider?: string;
  promptLanguage: EcommercePromptLanguage;
  bestFor?: string[];
  imageSize?: '1K' | '2K' | '4K';
  webSearch?: boolean;
  thinkingLevel?: 'low' | 'medium' | 'high';
  languageOptions?: EcommercePromptLanguage[];
};

export type EcommerceBatchJob = {
  id: string;
  planItemId: string;
  title: string;
  prompt: string;
  status: 'idle' | 'queued' | 'generating' | 'done' | 'failed';
  promptStatus?: EcommerceBatchPhaseStatus;
  imageStatus?: EcommerceBatchPhaseStatus;
  finalPrompt?: string;
  results: EcommerceResultItem[];
  error?: string;
  generationMeta?: EcommerceGenerationMeta;
  layoutSnapshot?: EcommerceLayoutSnapshot;
};

export type WorkflowUiMessage =
  | { type: 'clothingStudio.product'; productCount: number; max: 6 }
  | { type: 'clothingStudio.analyzing' }
  | { type: 'clothingStudio.analysis'; analysis: ClothingAnalysis }
  | { type: 'clothingStudio.needModel' }
  | { type: 'clothingStudio.generateModelForm'; defaults: ModelGenOptions }
  | { type: 'clothingStudio.modelCandidates'; images: Array<{ url: string }> }
  | { type: 'clothingStudio.requirementsForm'; defaults: Requirements }
  | { type: 'clothingStudio.progress'; done: number; total: number; text?: string }
  | { type: 'clothingStudio.results'; images: Array<{ url: string; label?: string }> }
  | {
      type: 'ecomOneClick.entry';
      productCount: number;
      description?: string;
      platformMode?: EcommercePlatformMode;
      workflowMode?: EcommerceWorkflowMode;
    }
  | {
      type: 'ecomOneClick.competitorDecks';
      decks: EcommerceCompetitorDeckInput[];
    }
  | {
      type: 'ecomOneClick.competitorAnalysis';
      analyses: EcommerceCompetitorDeckAnalysis[];
      planningContext?: EcommerceCompetitorPlanningContext;
    }
  | {
      type: 'ecomOneClick.analysis';
      summary: string;
      review?: EcommerceAnalysisReview;
      evolutionProposals?: EcommerceArchetypeEvolutionProposal[];
    }
  | {
      type: 'ecomOneClick.stage';
      step: EcommerceWorkflowStep;
      title: string;
      detail?: string;
    }
  | { type: 'ecomOneClick.types'; items: EcommerceRecommendedType[] }
  | { type: 'ecomOneClick.supplements'; fields: EcommerceSupplementField[] }
  | {
      type: 'ecomOneClick.supplementQuestionsBlocked';
      reason: string;
    }
  | {
      type: 'ecomOneClick.planGroupsBlocked';
      reason: string;
    }
  | {
      type: 'ecomOneClick.imageAnalyses';
      items: EcommerceImageAnalysis[];
      review?: EcommerceStageReview;
    }
  | {
      type: 'ecomOneClick.plans';
      groups: EcommercePlanGroup[];
      review?: EcommerceStageReview;
    }
  | {
      type: 'ecomOneClick.modelLock';
      models: EcommerceModelOption[];
      selectedModelId?: string;
    }
  | {
      type: 'ecomOneClick.batch';
      jobs: EcommerceBatchJob[];
      done: number;
      total: number;
      view?: 'finalize' | 'execute';
    }
  | { type: 'ecomOneClick.results'; images: EcommerceResultItem[] };
