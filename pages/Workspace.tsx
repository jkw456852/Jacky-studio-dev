/* cspell:ignore rehost rehosted inpainting */
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  startTransition,
} from "react";
import ReactDOM from "react-dom";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ROUTES } from "../utils/routes";
import {
  ChevronDown,
  Minus,
  Plus,
  Share2,
  Maximize2,
  RotateCw,
  ArrowUp,
  Paperclip,
  Lightbulb,
  Zap,
  Globe,
  Sparkles,
  MousePointer2,
  Square,
  Type,
  PenTool,
  History,
  Settings,
  Hand,
  Command,
  Hash,
  Undo2,
  Redo2,
  FileText,
  Triangle,
  Star,
  MessageSquare,
  ArrowLeft,
  ArrowRight,
  Circle as CircleIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold as BoldIcon,
  Italic,
  Underline,
  Strikethrough,
  Type as TypeIcon,
  MoreHorizontal,
  Download,
  Search,
  Move,
  ChevronUp,
  Loader2,
  CornerUpRight,
  Link2,
  Link as LinkIcon,
  Minimize2,
  Play,
  Film,
  Clock,
  SquarePen,
  PanelRightClose,
  Eraser,
  Scissors,
  Shirt,
  Expand,
  Crop,
  MonitorUp,
  Highlighter,
  Gift,
  Store,
  Layout,
  Copy,
  Info,
  MessageSquarePlus,
  File as FileIcon,
  CirclePlus,
  Scan,
  ZoomIn,
  Scaling,
  Wand2,
  Banana,
  SlidersHorizontal,
  ChevronLeft,
} from "lucide-react";
import {
  createChatSession,
  getBestModelSelection,
  sendMessage,
  generateImage,
  generateVideo,
  extractTextFromImage,
  analyzeImageRegion,
} from "../services/gemini";
import {
  ChatMessage,
  CanvasElement,
  Marker,
  Project,
  ConversationSession,
  InputBlock,
  ImageModel,
  VideoModel,
  WorkspaceInputFile,
  WorkspaceNodeInteractionMode,
} from "../types";
import { saveProject, formatDate } from "../services/storage";
import {
  getMappedModelConfigs,
  getModelDisplayLabel,
} from "../services/provider-settings";
import { Content } from "@google/genai";
import { useWorkspaceCanvasLayerProps } from "./Workspace/controllers/useWorkspaceCanvasLayerProps";
import { useWorkspaceCanvasAssetImport } from "./Workspace/controllers/useWorkspaceCanvasAssetImport";
import { useWorkspaceCanvasElementInteraction } from "./Workspace/controllers/useWorkspaceCanvasElementInteraction";
import { useWorkspaceCanvasElementCreation } from "./Workspace/controllers/useWorkspaceCanvasElementCreation";
import { useWorkspaceCanvasPointer } from "./Workspace/controllers/useWorkspaceCanvasPointer";
import { useWorkspaceCanvasPointerHelpers } from "./Workspace/controllers/useWorkspaceCanvasPointerHelpers";
import { useWorkspaceCanvasStateHistory } from "./Workspace/controllers/useWorkspaceCanvasStateHistory";
import { useWorkspaceCanvasViewActions } from "./Workspace/controllers/useWorkspaceCanvasViewActions";
import { useWorkspaceConversationPersistence } from "./Workspace/controllers/useWorkspaceConversationPersistence";
import { useWorkspaceConversationSession } from "./Workspace/controllers/useWorkspaceConversationSession";
import { useWorkspaceDerivedCanvasState } from "./Workspace/controllers/useWorkspaceDerivedCanvasState";
import { useWorkspaceElementEditActions } from "./Workspace/controllers/useWorkspaceElementEditActions";
import { useWorkspaceElementStateActions } from "./Workspace/controllers/useWorkspaceElementStateActions";
import { useWorkspaceElementReferenceUploads } from "./Workspace/controllers/useWorkspaceElementReferenceUploads";
import { useWorkspaceImageToolActions } from "./Workspace/controllers/useWorkspaceImageToolActions";
import { useWorkspaceMarkerInputActions } from "./Workspace/controllers/useWorkspaceMarkerInputActions";
import { useWorkspaceElementMutationHelpers } from "./Workspace/controllers/useWorkspaceElementMutationHelpers";
import { useWorkspaceModelPreferences } from "./Workspace/controllers/useWorkspaceModelPreferences";
import { useWorkspaceMultiSelectTools } from "./Workspace/controllers/useWorkspaceMultiSelectTools";
import { useWorkspacePageShellProps } from "./Workspace/controllers/useWorkspacePageShellProps";
import { useWorkspaceProjectLoader } from "./Workspace/controllers/useWorkspaceProjectLoader";
import { useWorkspaceSend } from "./Workspace/controllers/useWorkspaceSend";
import { useWorkspaceSmartGenerate } from "./Workspace/controllers/useWorkspaceSmartGenerate";
import {
  buildDuplicatedCanvasSelection,
  createCanvasElementClipboardSnapshot,
  type CanvasElementClipboardSnapshot,
} from "./Workspace/controllers/workspaceElementDuplication";
import { useWorkspaceTouchEditActions } from "./Workspace/controllers/useWorkspaceTouchEditActions";
import { useWorkspaceTextToolbarUi } from "./Workspace/controllers/useWorkspaceTextToolbarUi";
import { useAgentOrchestrator } from "../hooks/useAgentOrchestrator";
import { useProjectContext } from "../hooks/useProjectContext";
import { getAgentInfo, executeAgentTask } from "../services/agents";
import { localPreRoute } from "../services/agents/local-router";
import { AgentAvatar } from "../components/agents/AgentAvatar";
import { useAgentStore, normalizeInputBlocks } from "../stores/agent.store";
import { useProjectStore } from "../stores/project.store";
import { WorkspaceCanvasStage } from "./Workspace/components/WorkspaceCanvasStage";
import { WorkspaceFocusedGroupBanner } from "./Workspace/components/WorkspaceFocusedGroupBanner";
import { WorkspaceGeneratedFilesPanel } from "./Workspace/components/WorkspaceGeneratedFilesPanel";
import { WorkspaceLayersPanel } from "./Workspace/components/WorkspaceLayersPanel";
import { WorkspacePageOverlays } from "./Workspace/components/WorkspacePageOverlays";
import { WorkspaceSidebarLayer } from "./Workspace/components/WorkspaceSidebarLayer";
import { EcommerceWorkflowDrawer } from "./Workspace/components/workflow/EcommerceWorkflowDrawer";
import { assetsToCanvasElementsAtCenter } from "../utils/canvas-helpers";
import { AgentSelector } from "../components/agents/AgentSelector";
import { TaskProgress } from "../components/agents/TaskProgress";
import { AgentType } from "../types/agent.types";
import {
  useClothingStudioChatStore,
  useClothingState,
} from "../stores/clothingStudioChat.store";
import {
  useEcommerceOneClickStore,
  useEcommerceOneClickState,
} from "../stores/ecommerceOneClick.store";
import {
  syncClothingTopicMemory,
  syncEcommerceTopicMemory,
  loadTopicSnapshot,
  resolveTopicAssetRefUrl,
} from "../services/topic-memory";
import {
  splitEcommerceImageAnalysisTextFieldList,
} from "../utils/ecommerce-image-analysis";
import { buildEcommerceTextLayerPlan } from "../utils/ecommerce-text-layer-plan";
import type { DesignTaskMode } from "../types/common";
import type {
  ClothingAnalysis,
  EcommerceResultItem,
} from "../types/workflow.types";
import type { EcommerceOneClickSessionState } from "../stores/ecommerceOneClick.store";
import { useWorkspaceSidebarProps } from "./Workspace/controllers/useWorkspaceSidebarProps";
import { useWorkspaceDesignConsistency } from "./Workspace/controllers/useWorkspaceDesignConsistency";
import { useWorkspaceClothingWorkflow } from "./Workspace/controllers/useWorkspaceClothingWorkflow";
import { useWorkspaceEcommerceWorkflow } from "./Workspace/controllers/useWorkspaceEcommerceWorkflow";
import { useWorkspaceElementImageGeneration } from "./Workspace/controllers/useWorkspaceElementImageGeneration";
import { useWorkspaceElementVideoGeneration } from "./Workspace/controllers/useWorkspaceElementVideoGeneration";
import { useWorkspaceProductSwap } from "./Workspace/controllers/useWorkspaceProductSwap";
import {
  ASPECT_RATIOS,
  calcUpscaleTargetSize,
  createImagePreviewDataUrl,
  dataURLtoFile,
  DEFAULT_PROXY_MAX_DIM,
  estimateDataUrlBytes,
  fileToDataUrl,
  FONTS,
  getCanvasCenterPoint,
  getCanvasViewportSize,
  getClosestAspectRatio,
  getElementDisplayUrl,
  getElementSourceUrl,
  isLikelyGeneratedReferencePreview,
  getNearestAspectRatio,
  getUpscaleFactor,
  loadElementSourceSize,
  makeImageProxyFromUrl,
  renderRatioIcon,
  shouldNormalizeReferenceImageSource,
} from "./Workspace/workspaceShared";
import { collectNodeDescendantIds } from "./Workspace/workspaceNodeGraph";
import {
  getAllNodeParentIds,
  isWorkspaceTreeNode,
  resolveWorkspaceTreeNodeKind,
} from "./Workspace/workspaceTreeNode";

const ECOMMERCE_LOCAL_CACHE_PREFIX = "jkstudio:ecom-oneclick:";
const LEGACY_ECOMMERCE_LOCAL_CACHE_PREFIX = "xcstudio:ecom-oneclick:";

type EcommerceLocalCache = Pick<
  EcommerceOneClickSessionState,
  | "step"
  | "platformMode"
  | "workflowMode"
  | "productImages"
  | "competitorDecks"
  | "competitorAnalyses"
  | "competitorPlanningContext"
  | "competitorPlanningStrategyMode"
  | "competitorGenerationStrategyMode"
  | "competitorStrategyMode"
  | "description"
  | "analysisSummary"
  | "analysisReview"
  | "recommendedTypes"
  | "supplementFields"
  | "imageAnalyses"
  | "imageAnalysisReview"
  | "planGroups"
  | "planReview"
  | "modelOptions"
  | "selectedModelId"
  | "batchJobs"
  | "results"
  | "editingResultUrl"
  | "overlayPanelOpen"
  | "preferredOverlayTemplateId"
  | "progress"
> & {
  savedAt: number;
};

const ECOMMERCE_LOCAL_CACHE_MAX_RESULTS = 12;
const ECOMMERCE_LOCAL_CACHE_MAX_BATCH_RESULTS_PER_JOB = 2;
const ECOMMERCE_LOCAL_CACHE_MAX_IMAGE_ANALYSIS = 12;
const ECOMMERCE_LOCAL_CACHE_MAX_PLAN_GROUPS = 12;
const ECOMMERCE_LOCAL_CACHE_MAX_PLAN_ITEMS_PER_GROUP = 8;
const ECOMMERCE_LOCAL_CACHE_MAX_TEXT = 800;

const getEcommerceLocalCacheKey = (topicId: string) =>
  `${ECOMMERCE_LOCAL_CACHE_PREFIX}${topicId}`;

const getLegacyEcommerceLocalCacheKey = (topicId: string) =>
  `${LEGACY_ECOMMERCE_LOCAL_CACHE_PREFIX}${topicId}`;

const getAllEcommerceLocalCacheKeys = (topicId: string) =>
  [getEcommerceLocalCacheKey(topicId), getLegacyEcommerceLocalCacheKey(topicId)];

const isEcommerceLocalCacheKey = (key: string | null | undefined): boolean =>
  [ECOMMERCE_LOCAL_CACHE_PREFIX, LEGACY_ECOMMERCE_LOCAL_CACHE_PREFIX].some(
    (prefix) => String(key || "").startsWith(prefix),
  );

const trimCacheText = (
  value: string | null | undefined,
  max = ECOMMERCE_LOCAL_CACHE_MAX_TEXT,
): string => String(value || "").trim().slice(0, max);

const isTransientEcommerceAssetUrl = (url: string | null | undefined): boolean =>
  /^(blob:|data:)/i.test(String(url || "").trim());

const sanitizeCachedWorkflowImages = (
  images: EcommerceOneClickSessionState["productImages"],
): EcommerceOneClickSessionState["productImages"] =>
  images
    .filter((item) => item && !isTransientEcommerceAssetUrl(item.url))
    .slice(0, 9)
    .map((item) => ({
      ...item,
      url: String(item.url || "").trim(),
      name: trimCacheText(item.name, 120),
      title: trimCacheText(item.title, 120),
      description: trimCacheText(item.description, 240),
    }));

const sanitizeCachedCompetitorDecks = (
  decks: EcommerceOneClickSessionState["competitorDecks"],
): EcommerceOneClickSessionState["competitorDecks"] =>
  (decks || []).slice(0, 6).map((deck) => ({
    ...deck,
    name: trimCacheText(deck.name, 80),
    referenceUrl: trimCacheText(deck.referenceUrl, 240),
    notes: trimCacheText(deck.notes, 240),
    images: (deck.images || [])
      .filter((image) => image && !isTransientEcommerceAssetUrl(image.url))
      .slice(0, 20)
      .map((image) => ({
        ...image,
        url: String(image.url || "").trim(),
        name: trimCacheText(image.name, 120),
      })),
  }));

const sanitizeCachedCompetitorAnalyses = (
  analyses: EcommerceOneClickSessionState["competitorAnalyses"],
): EcommerceOneClickSessionState["competitorAnalyses"] =>
  (analyses || []).slice(0, 6).map((analysis) => ({
    ...analysis,
    competitorName: trimCacheText(analysis.competitorName, 80),
    overview: {
      productPositioning: trimCacheText(
        analysis.overview?.productPositioning,
        120,
      ),
      overallStyle: trimCacheText(analysis.overview?.overallStyle, 120),
      narrativePattern: trimCacheText(
        analysis.overview?.narrativePattern,
        120,
      ),
      conversionStrategy: trimCacheText(
        analysis.overview?.conversionStrategy,
        120,
      ),
    },
    pageSequence: (analysis.pageSequence || []).slice(0, 16).map((page) => ({
      ...page,
      titleSummary: trimCacheText(page.titleSummary, 80),
      businessTask: trimCacheText(page.businessTask, 120),
      keySellingPoint: trimCacheText(page.keySellingPoint, 120),
      layoutPattern: trimCacheText(page.layoutPattern, 120),
      evidenceStyle: trimCacheText(page.evidenceStyle, 120),
      notes: trimCacheText(page.notes, 120),
    })),
    globalPatterns: {
      commonPageRoles: (analysis.globalPatterns?.commonPageRoles || [])
        .slice(0, 8)
        .map((item) => trimCacheText(item, 40)),
      commonSellingPointOrder: (
        analysis.globalPatterns?.commonSellingPointOrder || []
      )
        .slice(0, 8)
        .map((item) => trimCacheText(item, 60)),
      commonLayoutPatterns: (analysis.globalPatterns?.commonLayoutPatterns || [])
        .slice(0, 8)
        .map((item) => trimCacheText(item, 60)),
      commonTextStrategies: (analysis.globalPatterns?.commonTextStrategies || [])
        .slice(0, 8)
        .map((item) => trimCacheText(item, 60)),
      commonConversionSignals: (
        analysis.globalPatterns?.commonConversionSignals || []
      )
        .slice(0, 8)
        .map((item) => trimCacheText(item, 60)),
    },
    borrowablePrinciples: (analysis.borrowablePrinciples || [])
      .slice(0, 8)
      .map((item) => trimCacheText(item, 100)),
    avoidCopying: (analysis.avoidCopying || [])
      .slice(0, 8)
      .map((item) => trimCacheText(item, 100)),
    opportunitiesForOurProduct: (analysis.opportunitiesForOurProduct || [])
      .slice(0, 8)
      .map((item) => trimCacheText(item, 100)),
    planningHints: {
      recommendedPageSequence: (analysis.planningHints?.recommendedPageSequence || [])
        .slice(0, 8)
        .map((item) => trimCacheText(item, 50)),
      recommendedStoryOrder: (analysis.planningHints?.recommendedStoryOrder || [])
        .slice(0, 8)
        .map((item) => trimCacheText(item, 60)),
      recommendedVisualPrinciples: (
        analysis.planningHints?.recommendedVisualPrinciples || []
      )
        .slice(0, 8)
        .map((item) => trimCacheText(item, 100)),
      recommendedTextPrinciples: (
        analysis.planningHints?.recommendedTextPrinciples || []
      )
        .slice(0, 8)
        .map((item) => trimCacheText(item, 100)),
    },
  }));

const sanitizeCachedCompetitorPlanningContext = (
  context: EcommerceOneClickSessionState["competitorPlanningContext"],
): EcommerceOneClickSessionState["competitorPlanningContext"] =>
  context
    ? {
        ...context,
        recommendedPageSequence: (context.recommendedPageSequence || [])
          .slice(0, 8)
          .map((item) => trimCacheText(item, 50)),
        recommendedStoryOrder: (context.recommendedStoryOrder || [])
          .slice(0, 8)
          .map((item) => trimCacheText(item, 60)),
        recommendedVisualPrinciples: (context.recommendedVisualPrinciples || [])
          .slice(0, 8)
          .map((item) => trimCacheText(item, 100)),
        recommendedTextPrinciples: (context.recommendedTextPrinciples || [])
          .slice(0, 8)
          .map((item) => trimCacheText(item, 100)),
        borrowablePrinciples: (context.borrowablePrinciples || [])
          .slice(0, 8)
          .map((item) => trimCacheText(item, 100)),
        avoidCopying: (context.avoidCopying || [])
          .slice(0, 8)
          .map((item) => trimCacheText(item, 100)),
        opportunitiesForOurProduct: (context.opportunitiesForOurProduct || [])
          .slice(0, 8)
          .map((item) => trimCacheText(item, 100)),
      }
    : null;

const sanitizeCachedSupplementFields = (
  fields: EcommerceOneClickSessionState["supplementFields"],
): EcommerceOneClickSessionState["supplementFields"] =>
  fields.slice(0, 20).map((field) => ({
    ...field,
    label: trimCacheText(field.label, 80),
    placeholder: trimCacheText(field.placeholder, 120),
    helperText: trimCacheText(field.helperText, 160),
    options: Array.isArray(field.options)
      ? field.options.slice(0, 12).map((option) => trimCacheText(option, 60))
      : field.options,
    value:
      field.kind === "image"
        ? Array.isArray(field.value)
          ? field.value
              .filter((item) => !isTransientEcommerceAssetUrl(item))
              .slice(0, field.maxItems || 4)
          : []
        : Array.isArray(field.value)
          ? field.value.slice(0, 12).map((item) => trimCacheText(item, 80))
          : trimCacheText(field.value, 240),
  }));

const sanitizeCachedRecommendedTypes = (
  items: EcommerceOneClickSessionState["recommendedTypes"],
): EcommerceOneClickSessionState["recommendedTypes"] =>
  items.slice(0, 18).map((item) => ({
    ...item,
    title: trimCacheText(item.title, 80),
    description: trimCacheText(item.description, 180),
    reason: trimCacheText(item.reason, 180),
    goal: trimCacheText(item.goal, 120),
    platformTags: (item.platformTags || []).slice(0, 6).map((tag) => trimCacheText(tag, 30)),
    highlights: (item.highlights || []).slice(0, 5).map((entry) => trimCacheText(entry, 80)),
    evidence: (item.evidence || []).slice(0, 5).map((entry) => trimCacheText(entry, 80)),
    omittedReason: trimCacheText(item.omittedReason, 120),
  }));

const sanitizeCachedReview = <
  T extends {
    verdict: string;
    reviewerNotes: string[];
    risks?: string[];
    fallbackReason?: string;
  },
>(
  review: T | null | undefined,
): T | null =>
  review
    ? ({
        ...review,
        verdict: trimCacheText(review.verdict, 220),
        reviewerNotes: (review.reviewerNotes || [])
          .slice(0, 6)
          .map((note) => trimCacheText(note, 120)),
        risks: (review.risks || []).slice(0, 6).map((risk) => trimCacheText(risk, 120)),
        fallbackReason: trimCacheText(review.fallbackReason, 160),
      } as T)
    : null;

const sanitizeCachedImageAnalyses = (
  items: EcommerceOneClickSessionState["imageAnalyses"],
): EcommerceOneClickSessionState["imageAnalyses"] =>
  splitEcommerceImageAnalysisTextFieldList(
    items.slice(0, ECOMMERCE_LOCAL_CACHE_MAX_IMAGE_ANALYSIS),
  ).map((item) => ({
    ...item,
    title: trimCacheText(item.title, 80),
    description: trimCacheText(item.description, 220),
    analysisConclusion: trimCacheText(item.analysisConclusion, 180),
    angle: trimCacheText(item.angle, 60),
    highlights: (item.highlights || []).slice(0, 5).map((entry) => trimCacheText(entry, 80)),
    materials: (item.materials || []).slice(0, 5).map((entry) => trimCacheText(entry, 60)),
    evidence: (item.evidence || []).slice(0, 5).map((entry) => trimCacheText(entry, 80)),
  }));

const sanitizeCachedPlanGroups = (
  groups: EcommerceOneClickSessionState["planGroups"],
): EcommerceOneClickSessionState["planGroups"] =>
  groups.slice(0, ECOMMERCE_LOCAL_CACHE_MAX_PLAN_GROUPS).map((group) => ({
    ...group,
    typeTitle: trimCacheText(group.typeTitle, 80),
    summary: trimCacheText(group.summary, 200),
    strategy: (group.strategy || [])
      .slice(0, 6)
      .map((entry) => ({
        label: trimCacheText(entry.label, 40),
        value: trimCacheText(entry.value, 100),
      })),
    platformTags: (group.platformTags || []).slice(0, 6).map((tag) => trimCacheText(tag, 30)),
    items: group.items
      .slice(0, ECOMMERCE_LOCAL_CACHE_MAX_PLAN_ITEMS_PER_GROUP)
      .map((item) => ({
        ...item,
        title: trimCacheText(item.title, 80),
        description: trimCacheText(item.description, 180),
        promptOutline: trimCacheText(item.promptOutline, 320),
        ratio: trimCacheText(item.ratio, 20),
        marketingGoal: trimCacheText(item.marketingGoal, 100),
        keyMessage: trimCacheText(item.keyMessage, 120),
        mustShow: (item.mustShow || []).slice(0, 6).map((entry) => trimCacheText(entry, 60)),
        composition: trimCacheText(item.composition, 100),
        styling: trimCacheText(item.styling, 100),
        background: trimCacheText(item.background, 100),
        lighting: trimCacheText(item.lighting, 100),
        platformFit: (item.platformFit || []).slice(0, 6).map((entry) => trimCacheText(entry, 40)),
        riskNotes: (item.riskNotes || []).slice(0, 5).map((entry) => trimCacheText(entry, 80)),
        copyPlan: item.copyPlan
          ? {
              badge: trimCacheText(item.copyPlan.badge, 40),
              headline: trimCacheText(item.copyPlan.headline, 80),
              subheadline: trimCacheText(item.copyPlan.subheadline, 140),
              priceLabel: trimCacheText(item.copyPlan.priceLabel, 40),
              priceValue: trimCacheText(item.copyPlan.priceValue, 40),
              priceNote: trimCacheText(item.copyPlan.priceNote, 60),
              featureTags: (item.copyPlan.featureTags || [])
                .slice(0, 6)
                .map((entry) => trimCacheText(entry, 40)),
              bullets: (item.copyPlan.bullets || [])
                .slice(0, 6)
                .map((entry) => trimCacheText(entry, 60)),
              stats: (item.copyPlan.stats || []).slice(0, 4).map((entry) => ({
                label: trimCacheText(entry.label, 30),
                value: trimCacheText(entry.value, 40),
              })),
              comparisonTitle: trimCacheText(item.copyPlan.comparisonTitle, 50),
              comparisonRows: (item.copyPlan.comparisonRows || []).slice(0, 4).map((entry) => ({
                label: trimCacheText(entry.label, 30),
                before: trimCacheText(entry.before, 30),
                after: trimCacheText(entry.after, 30),
              })),
              cta: trimCacheText(item.copyPlan.cta, 30),
            }
          : item.copyPlan,
        textContainerIntents: (item.textContainerIntents || []).slice(0, 6).map((entry) => ({
          id: trimCacheText(entry.id, 40),
          role: entry.role,
          area: entry.area,
          replacementMode: entry.replacementMode,
          priority: entry.priority,
          maxLines: entry.maxLines,
          maxChars: entry.maxChars,
          textAlign: entry.textAlign,
          placementHint: trimCacheText(entry.placementHint, 100),
        })),
      })),
  }));

const sanitizeCachedOverlayState = (
  overlayState: EcommerceOneClickSessionState["results"][number]["overlayState"],
) =>
  overlayState
    ? {
        ...overlayState,
        headline: trimCacheText(overlayState.headline, 80),
        subheadline: trimCacheText(overlayState.subheadline, 140),
        badge: trimCacheText(overlayState.badge, 40),
        priceLabel: trimCacheText(overlayState.priceLabel, 40),
        priceValue: trimCacheText(overlayState.priceValue, 40),
        priceNote: trimCacheText(overlayState.priceNote, 60),
        featureTags: (overlayState.featureTags || [])
          .slice(0, 4)
          .map((entry) => trimCacheText(entry, 40)),
        bullets: (overlayState.bullets || [])
          .slice(0, 4)
          .map((entry) => trimCacheText(entry, 60)),
        stats: (overlayState.stats || [])
          .slice(0, 3)
          .map((entry) => ({
            label: trimCacheText(entry?.label, 24),
            value: trimCacheText(entry?.value, 40),
          }))
          .filter((entry) => entry.label || entry.value),
        comparisonTitle: trimCacheText(overlayState.comparisonTitle, 50),
        comparisonRows: (overlayState.comparisonRows || [])
          .slice(0, 4)
          .map((entry) => ({
            label: trimCacheText(entry?.label, 24),
            before: trimCacheText(entry?.before, 30),
            after: trimCacheText(entry?.after, 30),
          }))
          .filter((entry) => entry.label || entry.before || entry.after),
        cta: trimCacheText(overlayState.cta, 40),
        fontFamily: trimCacheText(overlayState.fontFamily, 80),
        fontLabel: trimCacheText(overlayState.fontLabel, 80),
        featureTagIconLabel: trimCacheText(overlayState.featureTagIconLabel, 80),
        renderStatusMessage: trimCacheText(overlayState.renderStatusMessage, 220),
        textContainerIntents: (overlayState.textContainerIntents || []).slice(0, 6).map((entry) => ({
          id: trimCacheText(entry.id, 40),
          role: entry.role,
          area: entry.area,
          replacementMode: entry.replacementMode,
          priority: entry.priority,
          maxLines: entry.maxLines,
          maxChars: entry.maxChars,
          textAlign: entry.textAlign,
          placementHint: trimCacheText(entry.placementHint, 100),
        })),
        fontUrl:
          overlayState.fontUrl && !isTransientEcommerceAssetUrl(overlayState.fontUrl)
            ? String(overlayState.fontUrl || "").trim()
            : undefined,
        featureTagIconUrl:
          overlayState.featureTagIconUrl &&
          !isTransientEcommerceAssetUrl(overlayState.featureTagIconUrl)
            ? String(overlayState.featureTagIconUrl || "").trim()
            : undefined,
        baseImageUrl:
          overlayState.baseImageUrl &&
          !isTransientEcommerceAssetUrl(overlayState.baseImageUrl)
            ? String(overlayState.baseImageUrl || "").trim()
            : undefined,
        renderedImageUrl:
          overlayState.renderedImageUrl &&
          !isTransientEcommerceAssetUrl(overlayState.renderedImageUrl)
            ? String(overlayState.renderedImageUrl || "").trim()
            : undefined,
      }
    : undefined;

const sanitizeCachedLayoutSnapshot = (
  layoutMeta:
    | EcommerceOneClickSessionState["results"][number]["layoutMeta"]
    | EcommerceOneClickSessionState["batchJobs"][number]["layoutSnapshot"],
) =>
  layoutMeta
    ? {
        ...layoutMeta,
        reservedAreas: (layoutMeta.reservedAreas || []).slice(0, 6),
        typeTitle: trimCacheText(layoutMeta.typeTitle, 60),
      }
    : undefined;

const hydrateCachedOverlayState = async (
  overlayState: EcommerceOneClickSessionState["results"][number]["overlayState"],
) => {
  if (!overlayState) {
    return undefined;
  }

  if (
    overlayState.renderedImageUrl &&
    !isTransientEcommerceAssetUrl(overlayState.renderedImageUrl) &&
    (!overlayState.baseAssetId ||
      (overlayState.baseImageUrl &&
        !isTransientEcommerceAssetUrl(overlayState.baseImageUrl)))
  ) {
    if (
      (!overlayState.fontAssetId ||
        (overlayState.fontUrl &&
          !isTransientEcommerceAssetUrl(overlayState.fontUrl))) &&
      (!overlayState.featureTagIconAssetId ||
        (overlayState.featureTagIconUrl &&
          !isTransientEcommerceAssetUrl(overlayState.featureTagIconUrl)))
    ) {
      return overlayState;
    }
  }

  if (!overlayState.renderedAssetId) {
    if (
      overlayState.baseImageUrl &&
      !isTransientEcommerceAssetUrl(overlayState.baseImageUrl) &&
      overlayState.fontUrl &&
      !isTransientEcommerceAssetUrl(overlayState.fontUrl)
    ) {
      if (
        overlayState.featureTagIconUrl &&
        !isTransientEcommerceAssetUrl(overlayState.featureTagIconUrl)
      ) {
        return overlayState;
      }
      if (!overlayState.featureTagIconAssetId) {
        return overlayState;
      }
    }
    if (!overlayState.fontAssetId && !overlayState.featureTagIconAssetId) {
      return overlayState;
    }
  }
  const [resolvedRenderedUrl, resolvedBaseUrl, resolvedFontUrl, resolvedIconUrl] = await Promise.all([
    overlayState.renderedAssetId
      ? resolveTopicAssetRefUrl({
          assetId: overlayState.renderedAssetId,
          role: "result",
          createdAt: overlayState.lastEditedAt || Date.now(),
        })
      : Promise.resolve(null),
    overlayState.baseAssetId
      ? resolveTopicAssetRefUrl({
          assetId: overlayState.baseAssetId,
          role: "result",
          createdAt: overlayState.lastEditedAt || Date.now(),
        })
      : Promise.resolve(null),
    overlayState.fontAssetId
      ? resolveTopicAssetRefUrl({
          assetId: overlayState.fontAssetId,
          role: "font",
          createdAt: overlayState.lastEditedAt || Date.now(),
        })
      : Promise.resolve(null),
    overlayState.featureTagIconAssetId
      ? resolveTopicAssetRefUrl({
          assetId: overlayState.featureTagIconAssetId,
          role: "icon",
          createdAt: overlayState.lastEditedAt || Date.now(),
        })
      : Promise.resolve(null),
  ]);

  return {
    ...overlayState,
    baseImageUrl: resolvedBaseUrl || overlayState.baseImageUrl,
    renderedImageUrl:
      resolvedRenderedUrl || overlayState.renderedImageUrl,
    fontUrl: resolvedFontUrl || overlayState.fontUrl,
    featureTagIconUrl: resolvedIconUrl || overlayState.featureTagIconUrl,
  };
};

const sanitizeCachedResults = (
  results: EcommerceOneClickSessionState["results"],
  limit = ECOMMERCE_LOCAL_CACHE_MAX_RESULTS,
): EcommerceOneClickSessionState["results"] =>
  results
    .filter((item) => item && !isTransientEcommerceAssetUrl(item.url))
    .slice(0, limit)
    .map((item) => ({
      assetId: item.assetId,
      url: String(item.url || "").trim(),
      label: trimCacheText(item.label, 120),
      review: item.review
        ? {
            ...item.review,
            summary: trimCacheText(item.review.summary, 180),
            strengths: (item.review.strengths || [])
              .slice(0, 4)
              .map((entry) => trimCacheText(entry, 80)),
            issues: (item.review.issues || [])
              .slice(0, 4)
              .map((entry) => trimCacheText(entry, 80)),
            recommendedUse: trimCacheText(item.review.recommendedUse, 100),
          }
        : undefined,
      generationMeta: item.generationMeta
        ? {
            ...item.generationMeta,
            usedModelLabel: trimCacheText(item.generationMeta.usedModelLabel, 80),
            usedModel: trimCacheText(item.generationMeta.usedModel, 80),
            attemptedModels: (item.generationMeta.attemptedModels || [])
              .slice(0, 4)
              .map((entry) => trimCacheText(entry, 80)),
            aspectRatio: trimCacheText(item.generationMeta.aspectRatio, 20),
            promptHash: trimCacheText(item.generationMeta.promptHash, 40),
            promptSummary: trimCacheText(item.generationMeta.promptSummary, 180),
            promptText: trimCacheText(item.generationMeta.promptText, 500),
          }
        : undefined,
      layoutMeta: sanitizeCachedLayoutSnapshot(item.layoutMeta),
      overlayState: sanitizeCachedOverlayState(item.overlayState),
    }));

const sanitizeCachedBatchJobs = (
  jobs: EcommerceOneClickSessionState["batchJobs"],
): EcommerceOneClickSessionState["batchJobs"] =>
  jobs.slice(0, 24).map((job) => ({
    ...job,
    title: trimCacheText(job.title, 80),
    prompt: trimCacheText(job.prompt, 240),
    finalPrompt: trimCacheText(job.finalPrompt, 320),
    error: trimCacheText(job.error, 180),
    results: sanitizeCachedResults(
      job.results || [],
      ECOMMERCE_LOCAL_CACHE_MAX_BATCH_RESULTS_PER_JOB,
    ),
    layoutSnapshot: sanitizeCachedLayoutSnapshot(job.layoutSnapshot),
    generationMeta: job.generationMeta
      ? {
          ...job.generationMeta,
          usedModelLabel: trimCacheText(job.generationMeta.usedModelLabel, 80),
          usedModel: trimCacheText(job.generationMeta.usedModel, 80),
          attemptedModels: (job.generationMeta.attemptedModels || [])
            .slice(0, 4)
            .map((entry) => trimCacheText(entry, 80)),
          aspectRatio: trimCacheText(job.generationMeta.aspectRatio, 20),
          promptHash: trimCacheText(job.generationMeta.promptHash, 40),
          promptSummary: trimCacheText(job.generationMeta.promptSummary, 180),
          promptText: trimCacheText(job.generationMeta.promptText, 500),
        }
      : undefined,
  }));

const buildEcommerceLocalCachePayload = (
  state: EcommerceOneClickSessionState,
): EcommerceLocalCache => ({
  step: state.step,
  platformMode: state.platformMode,
  workflowMode: state.workflowMode,
  productImages: sanitizeCachedWorkflowImages(state.productImages),
  competitorDecks: sanitizeCachedCompetitorDecks(state.competitorDecks),
  competitorAnalyses: sanitizeCachedCompetitorAnalyses(state.competitorAnalyses),
  competitorPlanningContext: sanitizeCachedCompetitorPlanningContext(
    state.competitorPlanningContext,
  ),
  competitorPlanningStrategyMode: state.competitorPlanningStrategyMode,
  competitorGenerationStrategyMode: state.competitorGenerationStrategyMode,
  competitorStrategyMode: state.competitorStrategyMode,
  description: trimCacheText(state.description, 1000),
  analysisSummary: trimCacheText(state.analysisSummary, 1200),
  analysisReview: sanitizeCachedReview(state.analysisReview),
  recommendedTypes: sanitizeCachedRecommendedTypes(state.recommendedTypes),
  supplementFields: sanitizeCachedSupplementFields(state.supplementFields),
  imageAnalyses: sanitizeCachedImageAnalyses(state.imageAnalyses),
  imageAnalysisReview: sanitizeCachedReview(state.imageAnalysisReview),
  planGroups: sanitizeCachedPlanGroups(state.planGroups),
  planReview: sanitizeCachedReview(state.planReview),
  modelOptions: state.modelOptions.slice(0, 8),
  selectedModelId: state.selectedModelId,
  batchJobs: sanitizeCachedBatchJobs(state.batchJobs),
  results: sanitizeCachedResults(state.results),
  editingResultUrl: state.editingResultUrl,
  overlayPanelOpen: state.overlayPanelOpen,
  preferredOverlayTemplateId: state.preferredOverlayTemplateId,
  progress: {
    done: state.progress.done,
    total: state.progress.total,
    text: trimCacheText(state.progress.text, 120),
  },
  savedAt: Date.now(),
});

const buildMinimalEcommerceLocalCachePayload = (
  payload: EcommerceLocalCache,
): EcommerceLocalCache => ({
  ...payload,
  productImages: payload.productImages.slice(0, 4).map((item) => ({
    id: item.id,
    url: item.url,
    name: trimCacheText(item.name, 80),
    source: item.source,
  })),
  competitorDecks: payload.competitorDecks.slice(0, 2).map((deck) => ({
    ...deck,
    name: trimCacheText(deck.name, 60),
    referenceUrl: trimCacheText(deck.referenceUrl, 160),
    notes: trimCacheText(deck.notes, 120),
    images: deck.images.slice(0, 6).map((image) => ({
      ...image,
      name: trimCacheText(image.name, 80),
      url: image.url,
    })),
  })),
  competitorAnalyses: payload.competitorAnalyses.slice(0, 2).map((analysis) => ({
    ...analysis,
    competitorName: trimCacheText(analysis.competitorName, 60),
    pageSequence: (analysis.pageSequence || []).slice(0, 6).map((page) => ({
      ...page,
      titleSummary: trimCacheText(page.titleSummary, 60),
      businessTask: trimCacheText(page.businessTask, 80),
      keySellingPoint: trimCacheText(page.keySellingPoint, 80),
      layoutPattern: trimCacheText(page.layoutPattern, 60),
      evidenceStyle: trimCacheText(page.evidenceStyle, 60),
      notes: trimCacheText(page.notes, 80),
    })),
    borrowablePrinciples: (analysis.borrowablePrinciples || [])
      .slice(0, 4)
      .map((item) => trimCacheText(item, 80)),
    avoidCopying: (analysis.avoidCopying || [])
      .slice(0, 4)
      .map((item) => trimCacheText(item, 80)),
    opportunitiesForOurProduct: (analysis.opportunitiesForOurProduct || [])
      .slice(0, 4)
      .map((item) => trimCacheText(item, 80)),
  })),
  competitorPlanningContext: payload.competitorPlanningContext
    ? {
        ...payload.competitorPlanningContext,
        recommendedPageSequence: (
          payload.competitorPlanningContext.recommendedPageSequence || []
        )
          .slice(0, 6)
          .map((item) => trimCacheText(item, 40)),
        recommendedStoryOrder: (
          payload.competitorPlanningContext.recommendedStoryOrder || []
        )
          .slice(0, 6)
          .map((item) => trimCacheText(item, 50)),
        recommendedVisualPrinciples: (
          payload.competitorPlanningContext.recommendedVisualPrinciples || []
        )
          .slice(0, 4)
          .map((item) => trimCacheText(item, 80)),
        recommendedTextPrinciples: (
          payload.competitorPlanningContext.recommendedTextPrinciples || []
        )
          .slice(0, 4)
          .map((item) => trimCacheText(item, 80)),
        borrowablePrinciples: (payload.competitorPlanningContext.borrowablePrinciples || [])
          .slice(0, 4)
          .map((item) => trimCacheText(item, 80)),
        avoidCopying: (payload.competitorPlanningContext.avoidCopying || [])
          .slice(0, 4)
          .map((item) => trimCacheText(item, 80)),
        opportunitiesForOurProduct: (
          payload.competitorPlanningContext.opportunitiesForOurProduct || []
        )
          .slice(0, 4)
          .map((item) => trimCacheText(item, 80)),
      }
    : null,
  competitorPlanningStrategyMode: payload.competitorPlanningStrategyMode,
  competitorGenerationStrategyMode: payload.competitorGenerationStrategyMode,
  competitorStrategyMode: payload.competitorStrategyMode,
  supplementFields: payload.supplementFields.map((field) => ({
    ...field,
    options: undefined,
    helperText: undefined,
    value:
      field.kind === "image"
        ? []
        : Array.isArray(field.value)
          ? field.value.slice(0, 6)
          : trimCacheText(field.value, 120),
  })),
  imageAnalyses: splitEcommerceImageAnalysisTextFieldList(payload.imageAnalyses.slice(0, 6)).map(
    (item) => ({
      imageId: item.imageId,
      title: trimCacheText(item.title, 60),
      description: trimCacheText(item.description, 120),
      analysisConclusion: trimCacheText(item.analysisConclusion, 100),
      usableAsReference: item.usableAsReference,
      angle: trimCacheText(item.angle, 40),
    }),
  ),
  planGroups: payload.planGroups.slice(0, 4).map((group) => ({
    typeId: group.typeId,
    typeTitle: trimCacheText(group.typeTitle, 60),
    summary: trimCacheText(group.summary, 100),
    priority: group.priority,
    items: group.items.slice(0, 3).map((item) => ({
      id: item.id,
      title: trimCacheText(item.title, 60),
      description: trimCacheText(item.description, 100),
      promptOutline: trimCacheText(item.promptOutline, 140),
      ratio: trimCacheText(item.ratio, 12),
      referenceImageIds: item.referenceImageIds.slice(0, 4),
      status: item.status,
      copyPlan: item.copyPlan
        ? {
            headline: trimCacheText(item.copyPlan.headline, 60),
            subheadline: trimCacheText(item.copyPlan.subheadline, 80),
            badge: trimCacheText(item.copyPlan.badge, 24),
            featureTags: (item.copyPlan.featureTags || [])
              .slice(0, 4)
              .map((entry) => trimCacheText(entry, 24)),
            bullets: (item.copyPlan.bullets || [])
              .slice(0, 4)
              .map((entry) => trimCacheText(entry, 32)),
            comparisonTitle: trimCacheText(item.copyPlan.comparisonTitle, 40),
            cta: trimCacheText(item.copyPlan.cta, 20),
          }
        : item.copyPlan,
      textContainerIntents: (item.textContainerIntents || []).slice(0, 4).map((entry) => ({
        id: trimCacheText(entry.id, 24),
        role: entry.role,
        area: entry.area,
        replacementMode: entry.replacementMode,
        priority: entry.priority,
      })),
    })),
  })),
  batchJobs: payload.batchJobs.slice(0, 12).map((job) => ({
    id: job.id,
    planItemId: job.planItemId,
    title: trimCacheText(job.title, 60),
    prompt: trimCacheText(job.prompt, 120),
    status: job.status,
    promptStatus: job.promptStatus,
    imageStatus: job.imageStatus,
    finalPrompt: undefined,
    results: [],
    error: job.error,
    layoutSnapshot: sanitizeCachedLayoutSnapshot(job.layoutSnapshot),
  })),
  results: [],
  editingResultUrl: payload.editingResultUrl,
  overlayPanelOpen: payload.overlayPanelOpen,
  preferredOverlayTemplateId: payload.preferredOverlayTemplateId,
});

const buildUltraMinimalEcommerceLocalCachePayload = (
  payload: EcommerceLocalCache,
): EcommerceLocalCache => ({
  step: payload.step,
  platformMode: payload.platformMode,
  workflowMode: payload.workflowMode,
  productImages: payload.productImages.slice(0, 3).map((item) => ({
    id: item.id,
    url: item.url,
    name: trimCacheText(item.name, 80),
    title: "",
    description: "",
    source: item.source,
  })),
  competitorDecks: payload.competitorDecks.slice(0, 1).map((deck) => ({
    ...deck,
    name: trimCacheText(deck.name, 40),
    referenceUrl: trimCacheText(deck.referenceUrl, 120),
    notes: "",
    images: deck.images.slice(0, 3).map((image) => ({
      ...image,
      name: trimCacheText(image.name, 40),
    })),
  })),
  competitorAnalyses: [],
  competitorPlanningContext: payload.competitorPlanningContext
    ? {
        ...payload.competitorPlanningContext,
        recommendedPageSequence: (
          payload.competitorPlanningContext.recommendedPageSequence || []
        )
          .slice(0, 4)
          .map((item) => trimCacheText(item, 30)),
        recommendedStoryOrder: (
          payload.competitorPlanningContext.recommendedStoryOrder || []
        )
          .slice(0, 4)
          .map((item) => trimCacheText(item, 36)),
        recommendedVisualPrinciples: [],
        recommendedTextPrinciples: [],
        borrowablePrinciples: [],
        avoidCopying: [],
        opportunitiesForOurProduct: [],
      }
    : null,
  competitorPlanningStrategyMode: payload.competitorPlanningStrategyMode,
  competitorGenerationStrategyMode: payload.competitorGenerationStrategyMode,
  competitorStrategyMode: payload.competitorStrategyMode,
  description: trimCacheText(payload.description, 240),
  analysisSummary: trimCacheText(payload.analysisSummary, 360),
  analysisReview: null,
  recommendedTypes: payload.recommendedTypes
    .filter((item) => item.selected || item.required || item.recommended)
    .slice(0, 6)
    .map((item) => ({
      id: item.id,
      title: trimCacheText(item.title, 60),
      description: "",
      imageCount: item.imageCount,
      priority: item.priority,
      platformTags: [],
      selected: item.selected,
      recommended: item.recommended,
      required: item.required,
    })),
  supplementFields: [],
  imageAnalyses: [],
  imageAnalysisReview: null,
  planGroups: [],
  planReview: null,
  modelOptions: payload.modelOptions.slice(0, 3).map((model) => ({
    id: model.id,
    name: trimCacheText(model.name, 60),
    provider: model.provider,
    promptLanguage: model.promptLanguage,
  })),
  selectedModelId: payload.selectedModelId,
  batchJobs: [],
  results: [],
  editingResultUrl: payload.editingResultUrl,
  overlayPanelOpen: false,
  preferredOverlayTemplateId: payload.preferredOverlayTemplateId,
  progress: {
    done: payload.progress.done,
    total: payload.progress.total,
    text: trimCacheText(payload.progress.text, 80),
  },
  savedAt: payload.savedAt,
});

const isQuotaExceededError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === "QuotaExceededError" || error.code === 22
    : /quota/i.test(String((error as { message?: unknown })?.message || ""));

const cleanupOldEcommerceLocalCaches = (currentTopicId: string): void => {
  if (typeof window === "undefined") return;

  const staleKeys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (
      key &&
      isEcommerceLocalCacheKey(key) &&
      !getAllEcommerceLocalCacheKeys(currentTopicId).includes(key)
    ) {
      staleKeys.push(key);
    }
  }

  staleKeys
    .sort()
    .slice(0, Math.max(0, staleKeys.length - 2))
    .forEach((key) => {
      try {
        window.localStorage.removeItem(key);
      } catch (error) {
        console.warn("[EcommerceWorkflow] 清理旧本地缓存失败:", error);
      }
    });
};

const cleanupAllOtherEcommerceLocalCaches = (currentTopicId: string): void => {
  if (typeof window === "undefined") return;

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (
      key &&
      isEcommerceLocalCacheKey(key) &&
      !getAllEcommerceLocalCacheKeys(currentTopicId).includes(key)
    ) {
      try {
        window.localStorage.removeItem(key);
      } catch (error) {
        console.warn("[EcommerceWorkflow] 清理其他本地缓存失败:", error);
      }
    }
  }
};

const readEcommerceLocalCache = (
  topicId: string,
): EcommerceLocalCache | null => {
  if (typeof window === "undefined" || !topicId) return null;

  try {
    const raw = getAllEcommerceLocalCacheKeys(topicId)
      .map((key) => window.localStorage.getItem(key))
      .find(Boolean);
    if (!raw) return null;
    return JSON.parse(raw) as EcommerceLocalCache;
  } catch (error) {
    console.error("[EcommerceWorkflow] 读取本地缓存失败:", error);
    return null;
  }
};

const writeEcommerceLocalCache = (
  topicId: string,
  payload: EcommerceLocalCache,
): void => {
  if (typeof window === "undefined" || !topicId) return;

  try {
    window.localStorage.setItem(
      getEcommerceLocalCacheKey(topicId),
      JSON.stringify(payload),
    );
    window.localStorage.removeItem(getLegacyEcommerceLocalCacheKey(topicId));
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      console.error("[EcommerceWorkflow] 写入本地缓存失败:", error);
      return;
    }

    try {
      cleanupOldEcommerceLocalCaches(topicId);
      const fallbackPayload = buildMinimalEcommerceLocalCachePayload(payload);
      window.localStorage.setItem(
        getEcommerceLocalCacheKey(topicId),
        JSON.stringify(fallbackPayload),
      );
      window.localStorage.removeItem(getLegacyEcommerceLocalCacheKey(topicId));
      console.warn("[EcommerceWorkflow] Local cache exceeded, downgraded to compact snapshot.");
    } catch (retryError) {
      if (!isQuotaExceededError(retryError)) {
        console.error("[EcommerceWorkflow] 写入精简本地缓存仍然失败:", retryError);
        return;
      }

      try {
        cleanupAllOtherEcommerceLocalCaches(topicId);
        const ultraMinimalPayload =
          buildUltraMinimalEcommerceLocalCachePayload(payload);
        window.localStorage.setItem(
          getEcommerceLocalCacheKey(topicId),
          JSON.stringify(ultraMinimalPayload),
        );
        window.localStorage.removeItem(getLegacyEcommerceLocalCacheKey(topicId));
        console.warn("[EcommerceWorkflow] Local cache exceeded again, downgraded to ultra-minimal snapshot.");
      } catch (finalError) {
        console.error("[EcommerceWorkflow] 写入超轻量本地缓存仍然失败:", finalError);
      }
    }
  }
};

const removeEcommerceLocalCache = (topicId: string): void => {
  if (typeof window === "undefined" || !topicId) return;

  try {
    getAllEcommerceLocalCacheKeys(topicId).forEach((key) => {
      window.localStorage.removeItem(key);
    });
  } catch (error) {
    console.error("[EcommerceWorkflow] 删除本地缓存失败:", error);
  }
};

const UPSCALE_STRATEGIES = {
  standard: {
    name: "Standard Upscale",
    desc: "Higher resolution while keeping original composition.",
    prompt:
      "Enhance and upscale this image to higher resolution while preserving all details.",
  },
  vector: {
    name: "Vector Redraw",
    desc: "Extract clean line-art for vector-like output.",
    prompt:
      "Redraw this image as clean monochrome line art with clear structure and minimal noise.",
  },
  color: {
    name: "Color Analyze",
    desc: "Summarize dominant palette and color blocks.",
    prompt:
      "Analyze this image into major color blocks and output a clean color composition summary.",
  },
  detail: {
    name: "Detail Redraw",
    desc: "Analyze and regenerate with richer details.",
    prompt:
      "Analyze the scene, preserve composition, and regenerate with richer high-frequency details and cleaner edges.",
  },
};

type ToolType =
  | "select"
  | "hand"
  | "mark"
  | "insert"
  | "shape"
  | "text"
  | "brush"
  | "eraser";

interface HistoryState {
  elements: CanvasElement[];
  markers: Marker[];
}

export type TreeConnectionDraft = {
  fromId: string;
  fromPort: "input" | "output";
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  targetId?: string | null;
} | null;

// (Removed legacy localStorage conversation logic - now completely handled by IndexedDB within the Project object to prevent QuotaExceeded errors and isolate conversations)

// Using IndexedDB now for saveConversations via saveProject

const Workspace: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();

  const [zoom, setZoom] = useState(30);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(30);
  const panRef = useRef({ x: 0, y: 0 });
  const lastPointerClientRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const elementsRef = useRef<CanvasElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const textEditDraftRef = useRef<Record<string, string>>({});
  const pendingSelectAllTextIdRef = useRef<string | null>(null);
  const [projectTitle, setProjectTitle] = useState("Untitled");
  const [nodeInteractionMode, setNodeInteractionMode] =
    useState<WorkspaceNodeInteractionMode>("branch");
  const nodeInteractionModeRef = useRef(nodeInteractionMode);
  const [activeTool, setActiveTool] = useState<ToolType>("select");

  useEffect(() => {
    nodeInteractionModeRef.current = nodeInteractionMode;
  }, [nodeInteractionMode]);
  const [isPanning, setIsPanning] = useState(false);
  const isSpacePressedRef = useRef(false);
  const [isDraggingElement, setIsDraggingElement] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [elementStartPos, setElementStartPos] = useState({ x: 0, y: 0 });
  const pendingDragElementIdRef = useRef<string | null>(null);
  const dragDidMoveRef = useRef(false);
  const cutterTrailGlowRef = useRef<SVGPathElement | null>(null);
  const cutterTrailPathRef = useRef<SVGPathElement | null>(null);
  const cutterTrailTipRef = useRef<SVGCircleElement | null>(null);
  const dragSelectionIdsRef = useRef<string[]>([]);
  const pendingAltDragDuplicateRef = useRef<{
    anchorId: string;
    selectionIds: string[];
  } | null>(null);
  const didDuplicateOnCurrentDragRef = useRef(false);
  const alignmentGuideVRef = useRef<HTMLDivElement | null>(null);
  const alignmentGuideHRef = useRef<HTMLDivElement | null>(null);
  const groupDragStartRef = useRef<Record<string, { x: number; y: number }>>(
    {},
  );
  const elementClipboardRef = useRef<CanvasElementClipboardSnapshot | null>(
    null,
  );
  // Marquee selection state
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState({ x: 0, y: 0 });
  const [marqueeEnd, setMarqueeEnd] = useState({ x: 0, y: 0 });
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [treeConnectionDraft, setTreeConnectionDraft] =
    useState<TreeConnectionDraft>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    left: number;
    top: number;
    fontSize: number;
  }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    left: 0,
    top: 0,
    fontSize: 16,
  });
  const [focusedGroupId, setFocusedGroupId] = useState<string | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const markersRef = useRef<Marker[]>([]);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [isCtrlMarkTargetHovered, setIsCtrlMarkTargetHovered] = useState(false);
  const [hoveredMarkerId, setHoveredMarkerId] = useState<number | null>(null);
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [editingMarkerLabel, setEditingMarkerLabel] = useState("");

  const [leftPanelMode, setLeftPanelMode] = useState<"layers" | "files" | null>(
    null,
  );
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const suppressNextCanvasContextMenuRef = useRef(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showRatioPicker, setShowRatioPicker] = useState(false);
  const [showResPicker, setShowResPicker] = useState(false);
  const [videoToolbarTab, setVideoToolbarTab] = useState<
    "frames" | "motion" | "multi"
  >("frames");
  const [showFramePanel, setShowFramePanel] = useState(false);
  const [showFastEdit, setShowFastEdit] = useState(false);
  const fastEditPrompt = useAgentStore((s) => s.fastEditPrompt);
  const [history, setHistory] = useState<HistoryState[]>([
    { elements: [], markers: [] },
  ]);
  const [historyStep, setHistoryStep] = useState(0);
  const {
    saveToHistory,
    setElementsSynced,
    setMarkersSynced,
    updateMarkersAndSaveHistory,
    appendElementsAndSaveHistory,
    undo,
    redo,
  } = useWorkspaceCanvasStateHistory({
    history,
    historyStep,
    elementsRef,
    markersRef,
    setHistory,
    setHistoryStep,
    setElements,
    setMarkers,
  });
  const [prompt, setPrompt] = useState("");
  const messages = useAgentStore((s) => s.messages);
  const isTyping = useAgentStore((s) => s.isTyping);
  // Conversation history
  const [conversations, setConversations] = useState<ConversationSession[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>("");
  const isLoadingRecord = useRef(false);
  const suspendAutoSaveUntilRef = useRef(0);

  const [showAssistant, setShowAssistant] = useState(true);
  const [isEcommerceWorkflowOpen, setIsEcommerceWorkflowOpen] = useState(false);
  const showAssistantRef = useRef(true);
  const [featureNotice, setFeatureNotice] = useState<string | null>(null);
  const featureNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
  const [isHoveringVideoFrames, setIsHoveringVideoFrames] = useState<{
    [id: string]: boolean;
  }>({});

  useEffect(() => {
    showAssistantRef.current = showAssistant;
  }, [showAssistant]);

  useEffect(() => {
    return () => {
      if (featureNoticeTimerRef.current) {
        clearTimeout(featureNoticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  const composerState = useAgentStore((s) => s.composer);
  const inputBlocks = composerState.inputBlocks;
  const activeBlockId = composerState.activeBlockId;
  const selectionIndex = composerState.selectionIndex;
  const [selectedChipId, setSelectedChipId] = useState<string | null>(null); // For arrow key chip selection
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [hoveredChipId, setHoveredChipId] = useState<string | null>(null); // For hover preview

  // prompt/attachments legacy states replaced by inputBlocks effectively,
  // but keeping 'prompt' sync for other potential uses if needed, or simply deriving in handleSend.
  // We will ignore 'prompt' and 'attachments' state for the INPUT area.
  const modelMode = useAgentStore((s) => s.modelMode);
  const webEnabled = useAgentStore((s) => s.webEnabled);
  const agentSelectionMode = useAgentStore((s) => s.agentSelectionMode);
  const pinnedAgentId = useAgentStore((s) => s.pinnedAgentId);
  const imageModelEnabled = useAgentStore((s) => s.imageModelEnabled);
  const translatePromptToEnglish = useAgentStore(
    (s) => s.translatePromptToEnglish,
  );
  const enforceChineseTextInImage = useAgentStore(
    (s) => s.enforceChineseTextInImage,
  );
  const requiredChineseCopy = useAgentStore((s) => s.requiredChineseCopy);

  // Store actions
  const {
    setMessages,
    addMessage,
    clearMessages,
    setInputBlocks,
    setActiveBlockId,
    setSelectionIndex,
    setIsTyping,
    setModelMode,
    setWebEnabled,
    setImageModelEnabled,
    setImageGenRatio,
    setImageGenRes,
    setImageGenUploads,
    setIsPickingFromCanvas,
    setVideoGenRatio,
    setVideoGenDuration,
    setVideoGenQuality,
    setVideoGenModel,
    setVideoGenMode,
    setVideoStartFrame,
    setVideoEndFrame,
    setVideoMultiRefs,
    setShowVideoModelDropdown,
    setDetectedTexts,
    setEditedTexts,
    setIsExtractingText,
    setFastEditPrompt,
    setBrushSize,
    setIsAgentMode,
    setTranslatePromptToEnglish,
    setEnforceChineseTextInImage,
    setRequiredChineseCopy,
    insertInputFile,
    setPendingAttachments,
    addPendingAttachment,
    confirmPendingAttachments,
    clearPendingAttachments,
  } = useAgentStore((s) => s.actions);

  // Reactive focus: when activeBlockId changes (e.g. after insertInputFile), focus the new block
  useEffect(() => {
    const el = document.getElementById(
      `input-block-${activeBlockId}`,
    ) as HTMLInputElement;
    if (el) el.focus();
  }, [activeBlockId]);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Creation mode: 'agent' | 'image' | 'video'
  type CreationMode = "agent" | "image" | "video";
  const [creationMode, setCreationMode] = useState<CreationMode>("agent");
  const [researchMode] = useState<"off" | "images" | "web+images">(
    "web+images",
  );
  const [showModeSelector, setShowModeSelector] = useState(false);

  // Image generation states (from store)
  const imageGenRatio = useAgentStore((s) => s.generation.imageGenRatio);
  const imageGenRes = useAgentStore((s) => s.generation.imageGenRes);
  const imageGenCount = useAgentStore((s) => s.generation.imageGenCount);
  const imageGenUploads = useAgentStore((s) => s.generation.imageGenUploads);
  const isPickingFromCanvas = useAgentStore((s) => s.generation.isPickingFromCanvas);

  // Video generation states (from store)
  const videoGenRatio = useAgentStore((s) => s.generation.videoGenRatio);
  const videoGenDuration = useAgentStore((s) => s.generation.videoGenDuration);
  const videoGenQuality = useAgentStore((s) => s.generation.videoGenQuality);
  const videoGenModel = useAgentStore((s) => s.generation.videoGenModel);
  const videoGenMode = useAgentStore((s) => s.generation.videoGenMode);

  // Video upload frame/reference states (from store)
  const videoStartFrame = useAgentStore((s) => s.generation.videoStartFrame);
  const videoEndFrame = useAgentStore((s) => s.generation.videoEndFrame);
  const videoMultiRefs = useAgentStore((s) => s.generation.videoMultiRefs);

  // Video bottom toolbar dropdowns
  const showVideoModelDropdown = useAgentStore((s) => s.generation.showVideoModelDropdown);
  const [showVideoSettingsDropdown, setShowVideoSettingsDropdown] =
    useState(false);

  const getInputBlockMarkerId = useCallback(
    (block: InputBlock): string | undefined =>
      block.type === "file" ? block.file?.markerId : undefined,
    [],
  );

  const restoreClothingAnalysis = useCallback(
    (analysis: {
      anchorDescription: string;
      forbiddenChanges: string[];
      recommendedPoses: string[];
      recommendedStyling?: {
        accessories?: string[];
        bottoms?: string[];
        bags?: string[];
        shoes?: string[];
      };
    }): ClothingAnalysis => ({
      productType: "unknown",
      isSet: false,
      keyFeatures: [],
      materialGuess: [],
      colorPalette: [],
      fitSilhouette: [],
      anchorDescription: analysis.anchorDescription || "",
      forbiddenChanges: Array.isArray(analysis.forbiddenChanges)
        ? analysis.forbiddenChanges
        : [],
      recommendedStyling: {
        accessories: Array.isArray(analysis.recommendedStyling?.accessories)
          ? analysis.recommendedStyling.accessories
          : [],
        bottoms: Array.isArray(analysis.recommendedStyling?.bottoms)
          ? analysis.recommendedStyling.bottoms
          : [],
        bags: Array.isArray(analysis.recommendedStyling?.bags)
          ? analysis.recommendedStyling.bags
          : [],
        shoes: Array.isArray(analysis.recommendedStyling?.shoes)
          ? analysis.recommendedStyling.shoes
          : [],
      },
      recommendedPoses: Array.isArray(analysis.recommendedPoses)
        ? analysis.recommendedPoses
        : [],
      shotListHints: [],
      productAnchorIndex: 0,
    }),
    [],
  );

  // Hover and panel states
  const [isVideoPanelHovered, setIsVideoPanelHovered] = useState(false);
  const [showVideoModelPicker, setShowVideoModelPicker] = useState(false);

  // Agent mode (from store)
  const agentMode = useAgentStore((s) => s.isAgentMode);

  // Image Toolbar States (from store)
  const [toolbarExpanded, setToolbarExpanded] = useState(false);
  const toolbarExpandTimer = useRef<NodeJS.Timeout | null>(null);
  const [eraserMode, setEraserMode] = useState(false);
  const brushSize = useAgentStore((s) => s.brushSize);
  const [eraserMaskDataUrl, setEraserMaskDataUrl] = useState<string | null>(
    null,
  );
  const [eraserHistory, setEraserHistory] = useState<
    Array<{ display: string; mask: string }>
  >([]);
  const [eraserHasPaint, setEraserHasPaint] = useState(false);
  const [isDrawingEraser, setIsDrawingEraser] = useState(false);
  const eraserCanvasRef = useRef<HTMLCanvasElement>(null);
  const eraserMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const eraserInitKeyRef = useRef<string>("");
  const eraserCursorRef = useRef<HTMLDivElement>(null);
  const eraserLastPointRef = useRef<{ x: number; y: number } | null>(null);
  const eraserCanvasRectRef = useRef<DOMRect | null>(null);

  // Touch Edit States
  const [touchEditMode, setTouchEditMode] = useState(false);
  const [touchEditPopup, setTouchEditPopup] = useState<{
    analysis: string;
    x: number;
    y: number;
    elementId: string;
  } | null>(null);
  const [touchEditInstruction, setTouchEditInstruction] = useState("");
  const [isTouchEditing, setIsTouchEditing] = useState(false);

  // Upscale States
  // Upscale States
  const [showUpscalePanel, setShowUpscalePanel] = useState(false);
  const [selectedUpscaleRes, setSelectedUpscaleRes] = useState<
    "2K" | "4K" | "8K"
  >("2K");
  const [showUpscaleResDropdown, setShowUpscaleResDropdown] = useState(false);
  const [upscaleSourceSize, setUpscaleSourceSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Product Swap States
  const [showProductSwapPanel, setShowProductSwapPanel] = useState(false);
  const [productSwapImages, setProductSwapImages] = useState<string[]>([]);
  const [productSwapRes, setProductSwapRes] = useState<"1K" | "2K" | "4K">(
    "2K",
  );
  const [showProductSwapResDropdown, setShowProductSwapResDropdown] =
    useState(false);

  const clothingState = useClothingState();
  const clothingActions = useClothingStudioChatStore((s) => s.actions);
  const [clothingWorkflowError, setClothingWorkflowError] = useState<
    string | null
  >(null);
  const ecommerceState = useEcommerceOneClickState();
  const ecommerceActions = useEcommerceOneClickStore((s) => s.actions);
  const [ecommerceWorkflowError, setEcommerceWorkflowError] = useState<
    string | null
  >(null);

  const projectActions = useProjectStore((s) => s.actions);

  const {
    createConversationId,
    getCurrentConversationId,
    buildMemoryKey,
    currentTopicId,
    getCurrentTopicId,
    ensureConversationId,
    ensureTopicId,
    ensureClothingSession,
    ensureEcommerceSession,
  } = useWorkspaceConversationSession({
    workspaceId: id,
    activeConversationId,
    setActiveConversationId,
    setActiveClothingSession: (topicId) => {
      useClothingStudioChatStore.getState().actions.setActiveSession(topicId);
    },
    setActiveEcommerceSession: (topicId) => {
      useEcommerceOneClickStore.getState().actions.setActiveSession(topicId);
    },
  });

  const openEcommerceWorkflow = useCallback(() => {
    ensureEcommerceSession();
    setShowAssistant(true);
    setIsEcommerceWorkflowOpen(true);
  }, [ensureEcommerceSession]);

  const closeEcommerceWorkflow = useCallback(() => {
    setIsEcommerceWorkflowOpen(false);
  }, []);

  const {
    persistEditSession,
    getDesignConsistencyContext,
    mergeConsistencyAnchorIntoReferences,
    setConsistencyCheckEnabled,
    setApprovedAnchor,
    setApprovedAnchorFromFile,
    clearApprovedAnchor,
    validateAgainstApprovedAnchor,
  } = useWorkspaceDesignConsistency({
    ensureTopicId,
    addMessage,
  });
  const designSession = useProjectStore((state) => state.designSession);
  const consistencyCheckEnabled =
    designSession.consistencyCheckEnabled !== false;
  const currentConsistencyAnchorUrl =
    designSession.subjectAnchors?.[designSession.subjectAnchors.length - 1] ||
    null;
  const approvedConsistencyAssetIds = designSession.approvedAssetIds || [];

  const maybeWarnConsistencyDrift = useCallback(
    async (candidateUrl: string, label: string, genPrompt?: string) => {
      const validation = await validateAgainstApprovedAnchor(
        candidateUrl,
        genPrompt,
      );
      if (!validation.pass) {
        const reasonText =
          validation.reasons && validation.reasons.length > 0
            ? validation.reasons.join("；")
            : "当前结果与已采用锚点存在明显偏差。";
        addMessage({
          id: `consistency-warn-${Date.now()}`,
          role: "model",
          text: `${label}与当前已采用锚点存在偏差：${reasonText}${validation.suggestedFix ? `。建议：${validation.suggestedFix}` : ""}`,
          timestamp: Date.now(),
          error: true,
        });
      }
      return validation;
    },
    [validateAgainstApprovedAnchor],
  );

  const retryWithConsistencyFix = useCallback(
    async (
      label: string,
      initialUrl: string,
      rerun: (fixPrompt?: string) => Promise<string | null>,
      _anchorOverride?: string,
      genPrompt?: string,
      referenceCount?: number,
    ) => {
      const validation = await maybeWarnConsistencyDrift(
        initialUrl,
        label,
        genPrompt,
      );
      // When the generation uses multiple reference images, the "correct" result
      // may intentionally deviate from the anchor (e.g. product swap / install overlay).
      // In that case we only warn but do not auto-rerun with suggested fixes.
      if (
        (typeof referenceCount === "number" && referenceCount > 1) ||
        validation.pass ||
        !validation.suggestedFix
      ) {
        return initialUrl;
      }

      addMessage({
        id: `consistency-retry-${Date.now()}`,
        role: "model",
        text: `${label}正在根据一致性质检建议自动修正一次：${validation.suggestedFix}`,
        timestamp: Date.now(),
      });

      const retriedUrl = await rerun(validation.suggestedFix);
      if (!retriedUrl) {
        return initialUrl;
      }

      const retriedPrompt = genPrompt
        ? `${genPrompt}\n\nConsistency fix: ${validation.suggestedFix}`
        : validation.suggestedFix;
      await maybeWarnConsistencyDrift(
        retriedUrl,
        `${label} (auto-fixed)`,
        retriedPrompt,
      );
      return retriedUrl;
    },
    [maybeWarnConsistencyDrift],
  );

  const handleToggleConsistencyCheck = useCallback(
    (enabled: boolean) => {
      setConsistencyCheckEnabled(enabled);
    },
    [setConsistencyCheckEnabled],
  );

  const handlePreviewConsistencyAnchor = useCallback(
    (anchorUrl: string) => {
      if (!anchorUrl) {
        return;
      }
      setPreviewUrl(anchorUrl);
    },
    [setPreviewUrl],
  );

  const handleSetConsistencyAnchorFromElement = useCallback(
    async (element: CanvasElement | null) => {
      const anchorUrl = String(
        element?.originalUrl || element?.url || "",
      ).trim();
      if (!anchorUrl) {
        return;
      }

      await setApprovedAnchor(anchorUrl, {
        approvedAssetId: element?.id,
        decision: element?.genPrompt
          ? `Set current canvas image as design anchor: ${element.genPrompt}`
          : `Set canvas image ${element?.id || ""} as design anchor.`,
      });
    },
    [setApprovedAnchor],
  );

  const handleUploadConsistencyAnchor = useCallback(
    async (file: File) => {
      await setApprovedAnchorFromFile(file);
    },
    [setApprovedAnchorFromFile],
  );

  const handleClearConsistencyAnchor = useCallback(() => {
    clearApprovedAnchor();
  }, [clearApprovedAnchor]);

  useEffect(() => {
    const topicId = currentTopicId;
    if (!topicId) return;
    const store = useClothingStudioChatStore.getState();
    store.actions.setActiveSession(topicId);

    (async () => {
      const snapshot = await loadTopicSnapshot(topicId);
      if (snapshot?.clothingStudio) {
        const cs = snapshot.clothingStudio;
        const actions = store.actions;
        if (cs.productImageRefs?.length) {
          actions.addProductImages(
            cs.productImageRefs.map((r) => ({
              id: r.assetId,
              url: r.url || "",
            })),
            topicId,
          );
        }
        if (cs.productAnchorRef?.url) {
          actions.setProductAnchorUrl(cs.productAnchorRef.url, topicId);
        }
        if (cs.modelAnchorSheetRef?.url) {
          actions.setModelAnchorSheetUrl(cs.modelAnchorSheetRef.url, topicId);
        }
        if (cs.modelRef?.url) {
          actions.setModelImage(
            { id: cs.modelRef.assetId, url: cs.modelRef.url },
            topicId,
          );
        }
        if (cs.analysis) {
          actions.setAnalysis(restoreClothingAnalysis(cs.analysis), topicId);
        }
        if (cs.requirements) {
          actions.setRequirements(cs.requirements, topicId);
        }
      }
    })();
  }, [currentTopicId]);

  useEffect(() => {
    const topicId = currentTopicId;
    if (!topicId) return;

    const productRefs = clothingState.productImages
      .map((item) => ({
        assetId: item.id,
        role: "product" as const,
        url: item.url,
        createdAt: Date.now(),
      }))
      .slice(0, 6);

    const productAnchorRef = clothingState.productAnchorUrl
      ? {
          assetId: `product-anchor-${topicId}`,
          role: "product_anchor" as const,
          url: clothingState.productAnchorUrl,
          createdAt: Date.now(),
        }
      : undefined;

    const modelAnchorSheetRef = clothingState.modelAnchorSheetUrl
      ? {
          assetId: `model-anchor-sheet-${topicId}`,
          role: "model_anchor_sheet" as const,
          url: clothingState.modelAnchorSheetUrl,
          createdAt: Date.now(),
        }
      : undefined;

    const modelRef = clothingState.modelImage?.url
      ? {
          assetId: clothingState.modelImage.id,
          role: "model" as const,
          url: clothingState.modelImage.url,
          createdAt: Date.now(),
        }
      : undefined;

    const timer = window.setTimeout(() => {
      void syncClothingTopicMemory(topicId, {
        productImageRefs: productRefs,
        productAnchorRef,
        modelAnchorSheetRef,
        modelRef,
        analysis: clothingState.analysis
          ? {
              anchorDescription: clothingState.analysis.anchorDescription,
              forbiddenChanges: clothingState.analysis.forbiddenChanges,
              recommendedPoses: clothingState.analysis.recommendedPoses,
              recommendedStyling: clothingState.analysis.recommendedStyling,
            }
          : undefined,
        requirements: {
          platform: clothingState.requirements.platform,
          aspectRatio: clothingState.requirements.aspectRatio,
          targetLanguage: clothingState.requirements.targetLanguage,
          clarity: "2K",
          count: Math.max(
            1,
            Math.min(10, clothingState.requirements.count || 1),
          ),
          referenceUrl: clothingState.requirements.referenceUrl,
          description: clothingState.requirements.description,
        },
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [
    currentTopicId,
    clothingState.productImages,
    clothingState.productAnchorUrl,
    clothingState.modelAnchorSheetUrl,
    clothingState.modelImage,
    clothingState.analysis,
    clothingState.requirements,
  ]);

  useEffect(() => {
    const topicId = currentTopicId;
    if (!topicId) return;
    const store = useEcommerceOneClickStore.getState();
    store.actions.setActiveSession(topicId);

    let cancelled = false;

    (async () => {
      const cached = readEcommerceLocalCache(topicId);

      try {
        const snapshot = await loadTopicSnapshot(topicId);
        if (!snapshot?.ecommerceOneClick) {
          if (!cancelled && cached) {
            store.actions.hydrateSession(cached, topicId);
          }
          return;
        }

        const ecommerce = snapshot.ecommerceOneClick;
        const productImages = (
          await Promise.all(
            (ecommerce.productImageRefs || []).map(async (ref) => {
              const resolvedUrl = await resolveTopicAssetRefUrl(ref);
              if (!resolvedUrl) return null;
              return {
                id: ref.assetId,
                url: resolvedUrl,
                name: ref.assetId,
                source: "product" as const,
              };
            }),
          )
        ).filter(
          (
            item,
          ): item is {
            id: string;
            url: string;
            name: string;
            source: "product";
          } => Boolean(item),
        );
        const rawBatchJobs =
          ecommerce.batchJobs && ecommerce.batchJobs.length > 0
            ? ecommerce.batchJobs
            : cached?.batchJobs || [];
        const batchJobs = await Promise.all(
          rawBatchJobs.map(async (job) => ({
            ...job,
            results: await Promise.all(
              (job.results || []).map(async (result) => ({
                ...result,
                overlayState: await hydrateCachedOverlayState(result.overlayState),
              })),
            ),
          })),
        );
        const hydratedResultImages = await Promise.all(
          (ecommerce.resultImageRefs || []).map(
            async (ref): Promise<EcommerceResultItem | null> => {
              const resolvedUrl = await resolveTopicAssetRefUrl(ref);
              if (!resolvedUrl) return null;
              const matchedFromJobs =
                batchJobs
                  .flatMap((job) => job.results || [])
                  .find(
                    (item) =>
                      item.assetId === ref.assetId ||
                      item.url === ref.url ||
                      item.url === resolvedUrl,
                  ) ||
                null;
              return {
                assetId: ref.assetId,
                url: resolvedUrl,
                label: matchedFromJobs?.label || ref.assetId,
                review: matchedFromJobs?.review,
                generationMeta: matchedFromJobs?.generationMeta,
                layoutMeta: matchedFromJobs?.layoutMeta,
                overlayState: await hydrateCachedOverlayState(
                  matchedFromJobs?.overlayState,
                ),
              };
            },
          ),
        );
        const resultImages = hydratedResultImages.filter(
          (item): item is EcommerceResultItem => Boolean(item),
        );
        const competitorDecks = sanitizeCachedCompetitorDecks(
          ecommerce.competitorDecks?.length
            ? ecommerce.competitorDecks
            : cached?.competitorDecks || [],
        );
        const competitorAnalyses = sanitizeCachedCompetitorAnalyses(
          ecommerce.competitorAnalyses?.length
            ? ecommerce.competitorAnalyses
            : cached?.competitorAnalyses || [],
        );
        const competitorPlanningContext =
          ecommerce.competitorPlanningContext !== undefined
            ? sanitizeCachedCompetitorPlanningContext(
                ecommerce.competitorPlanningContext,
              )
            : cached?.competitorPlanningContext !== undefined
              ? sanitizeCachedCompetitorPlanningContext(
                  cached.competitorPlanningContext,
                )
              : undefined;

        if (cancelled) return;

        store.actions.hydrateSession(
          {
            step: ecommerce.step || cached?.step || "WAIT_PRODUCT",
            platformMode:
              ecommerce.platformMode || cached?.platformMode || "general",
            workflowMode:
              ecommerce.workflowMode || cached?.workflowMode || "professional",
            productImages:
              productImages.length > 0 ? productImages : cached?.productImages || [],
            competitorDecks,
            competitorAnalyses,
            ...(competitorPlanningContext !== undefined
              ? { competitorPlanningContext }
              : {}),
            description: ecommerce.description || cached?.description || "",
            analysisSummary:
              ecommerce.analysisSummary || cached?.analysisSummary || "",
            analysisReview: ecommerce.analysisReview || cached?.analysisReview || null,
            recommendedTypes:
              ecommerce.recommendedTypes?.length
                ? ecommerce.recommendedTypes
                : cached?.recommendedTypes || [],
            supplementFields:
              ecommerce.supplementFields?.length
                ? ecommerce.supplementFields
                : cached?.supplementFields || [],
            imageAnalyses:
              ecommerce.imageAnalyses?.length
                ? ecommerce.imageAnalyses
                : cached?.imageAnalyses || [],
            imageAnalysisReview:
              ecommerce.imageAnalysisReview || cached?.imageAnalysisReview || null,
            planGroups:
              ecommerce.planGroups?.length
                ? ecommerce.planGroups
                : cached?.planGroups || [],
            planReview: ecommerce.planReview || cached?.planReview || null,
            selectedModelId:
              ecommerce.selectedModelId ?? cached?.selectedModelId ?? null,
            batchJobs,
            results: resultImages.length > 0 ? resultImages : cached?.results || [],
            editingResultUrl:
              ecommerce.editingResultUrl ?? cached?.editingResultUrl ?? null,
            overlayPanelOpen:
              ecommerce.overlayPanelOpen ?? cached?.overlayPanelOpen ?? false,
            preferredOverlayTemplateId:
              ecommerce.preferredOverlayTemplateId ??
              cached?.preferredOverlayTemplateId ??
              null,
            progress:
              ecommerce.progress ||
              cached?.progress || { done: 0, total: 0, text: "" },
            ...(ecommerce.modelOptions && ecommerce.modelOptions.length > 0
              ? { modelOptions: ecommerce.modelOptions }
              : cached?.modelOptions && cached.modelOptions.length > 0
                ? { modelOptions: cached.modelOptions }
                : {}),
          },
          topicId,
        );
      } catch (error) {
        console.error("[EcommerceWorkflow] 鎭㈠宸ヤ綔娴佸揩鐓уけ璐?", error);
        if (!cancelled && cached) {
          store.actions.hydrateSession(cached, topicId);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentTopicId]);

  useEffect(() => {
    const topicId = currentTopicId;
    if (!topicId) return;

    const hasEcommerceData =
      ecommerceState.platformMode !== "general" ||
      ecommerceState.workflowMode !== "professional" ||
      ecommerceState.productImages.length > 0 ||
      ecommerceState.competitorDecks.length > 0 ||
      ecommerceState.competitorAnalyses.length > 0 ||
      Boolean(ecommerceState.competitorPlanningContext) ||
      ecommerceState.description.trim().length > 0 ||
      ecommerceState.analysisSummary.trim().length > 0 ||
      Boolean(ecommerceState.analysisReview) ||
      ecommerceState.recommendedTypes.length > 0 ||
      ecommerceState.supplementFields.length > 0 ||
      ecommerceState.imageAnalyses.length > 0 ||
      Boolean(ecommerceState.imageAnalysisReview) ||
      ecommerceState.planGroups.length > 0 ||
      Boolean(ecommerceState.planReview) ||
      ecommerceState.batchJobs.length > 0 ||
      ecommerceState.results.length > 0;

    if (!hasEcommerceData) {
      removeEcommerceLocalCache(topicId);
      return;
    }

    const cachePayload = buildEcommerceLocalCachePayload(ecommerceState);
    writeEcommerceLocalCache(topicId, cachePayload);

    const productImageRefs = ecommerceState.productImages
      .map((item) => ({
        assetId: item.id,
        role: "product" as const,
        url: /^blob:/i.test(item.url) ? undefined : item.url,
        createdAt: Date.now(),
      }))
      .slice(0, 9);

    const resultImageRefs = ecommerceState.results
      .map((item, index) => ({
        assetId: item.assetId || `ecom-result-${topicId}-${index + 1}`,
        role: "result" as const,
        url:
          item.assetId && isTransientEcommerceAssetUrl(item.url)
            ? undefined
            : /^blob:/i.test(item.url)
              ? undefined
              : item.url,
        createdAt: Date.now(),
      }))
      .slice(0, 20);

    const timer = window.setTimeout(() => {
      void syncEcommerceTopicMemory(topicId, {
        step: cachePayload.step,
        platformMode: cachePayload.platformMode,
        workflowMode: cachePayload.workflowMode,
        productImageRefs,
        competitorDecks: cachePayload.competitorDecks,
        competitorAnalyses: cachePayload.competitorAnalyses,
        competitorPlanningContext: cachePayload.competitorPlanningContext,
        description: cachePayload.description,
        analysisSummary: cachePayload.analysisSummary,
        analysisReview: cachePayload.analysisReview,
        recommendedTypes: cachePayload.recommendedTypes,
        supplementFields: cachePayload.supplementFields,
        imageAnalyses: cachePayload.imageAnalyses,
        imageAnalysisReview: cachePayload.imageAnalysisReview,
        planGroups: cachePayload.planGroups,
        planReview: cachePayload.planReview,
        modelOptions: cachePayload.modelOptions,
        selectedModelId: cachePayload.selectedModelId,
        batchJobs: cachePayload.batchJobs,
        resultImageRefs,
        editingResultUrl: cachePayload.editingResultUrl,
        overlayPanelOpen: cachePayload.overlayPanelOpen,
        preferredOverlayTemplateId: cachePayload.preferredOverlayTemplateId,
        progress: cachePayload.progress,
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [
    currentTopicId,
    ecommerceState.step,
    ecommerceState.platformMode,
    ecommerceState.workflowMode,
    ecommerceState.productImages,
    ecommerceState.competitorDecks,
    ecommerceState.competitorAnalyses,
    ecommerceState.competitorPlanningContext,
    ecommerceState.description,
    ecommerceState.analysisSummary,
    ecommerceState.analysisReview,
    ecommerceState.recommendedTypes,
    ecommerceState.supplementFields,
    ecommerceState.imageAnalyses,
    ecommerceState.imageAnalysisReview,
    ecommerceState.planGroups,
    ecommerceState.planReview,
    ecommerceState.modelOptions,
    ecommerceState.selectedModelId,
    ecommerceState.batchJobs,
    ecommerceState.results,
    ecommerceState.editingResultUrl,
    ecommerceState.overlayPanelOpen,
    ecommerceState.preferredOverlayTemplateId,
    ecommerceState.progress,
  ]);

  const {
    activeImageModel,
    activeImageProviderId,
    activeVideoProviderId,
    handleModeSwitch,
    modelPreferences,
    modeSwitchDialog,
  } = useWorkspaceModelPreferences({
    modelMode,
    clearMessages,
    setModelMode,
  });

  // Drag-and-drop state
  const [isDragOver, setIsDragOver] = useState(false);

  // Global click deselection: only clear when clicking blank canvas
  useEffect(() => {
    const handleGlobalMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Only handle clicks inside the canvas container.
      if (!containerRef.current?.contains(target)) {
        return;
      }

      // Exclude non-canvas overlay UI: sidebars, dialogs, popovers, input, and toolbars.
      const isSidebar =
        target.closest(".assistant-sidebar") ||
        target.closest(".right-sidebar");
      const isInputArea =
        target.closest(".input-flow-container") ||
        target.closest(".message-list") ||
        target.closest('[class*="InputArea"]');
      const isPopupUI =
        target.closest(".history-popover-content") ||
        target.closest(".file-list-modal") ||
        target.closest(".settings-modal") ||
        target.closest(".dialog-overlay") ||
        target.closest("[data-tree-prompt-toolbar='true']") ||
        target.closest('[class*="Modal"]') ||
        target.closest('[class*="Dialog"]');

      if (isSidebar || isInputArea || isPopupUI) {
        return;
      }

      const isCanvasBackgroundClick =
        target === containerRef.current ||
        target === canvasLayerRef.current ||
        target.classList.contains("canvas-background");

      if (!isCanvasBackgroundClick) return;

      // If middle/right click, let context menu logic handle it.
      if (e.button !== 0) return;

      // Only blank-canvas click should clear current selection and related popovers.
      setSelectedElementId(null);
      setSelectedElementIds([]);
      setSelectedChipId(null);
      setEditingTextId(null);
      setShowFontPicker(false);
      setShowModelPicker(false);
      setShowResPicker(false);
      setShowRatioPicker(false);
      setShowUpscalePanel(false);
      setShowUpscaleResDropdown(false);
      clearPendingAttachments();
    };

    window.addEventListener("mousedown", handleGlobalMouseDown, true);
    return () =>
      window.removeEventListener("mousedown", handleGlobalMouseDown, true);
  }, [activeTool]);

  // Model preference data
  const IMAGE_MODEL_META: Record<
    string,
    { name: string; desc: string; time: string }
  > = {
    "gemini-3-pro-image-preview": {
      name: "Nano Banana Pro",
      desc: "High-quality image generation with rich details.",
      time: "~20s",
    },
    "gemini-3.1-flash-image-preview": {
      name: "Nano Banana 2",
      desc: "Next-gen fast image generation.",
      time: "~5s",
    },
    "doubao-seedream-5-0-260128": {
      name: "Seedream 5.0",
      desc: "Cinematic aesthetics with high-fidelity quality.",
      time: "~15s",
    },
    "gpt-image-2": {
      name: "GPT Image 2",
      desc: "OpenAI-style image generation with native reference-image support.",
      time: "~30s",
    },
    "gpt-image-1.5-all": {
      name: "GPT Image 1.5",
      desc: "Creative image generation with diverse styles.",
      time: "~120s",
    },
    "flux-pro-max": {
      name: "Flux.2 Max",
      desc: "Fast image generation with efficiency first.",
      time: "~10s",
    },
  };
  const [modelMappingVersion, setModelMappingVersion] = useState(0);
  const mappedImageModelOptions = useMemo(() => {
    const mappedConfigs = getMappedModelConfigs("image");
    if (mappedConfigs.length === 0) {
      return [
        {
          id: "gemini-3-pro-image-preview" as ImageModel,
          name: "Nano Banana Pro",
          desc: "High-quality image generation with rich details.",
          time: "~20s",
          providerId: null,
          providerName: "",
        },
      ];
    }

    return mappedConfigs.map((config) => {
      const meta = IMAGE_MODEL_META[config.modelId] || {
        name: getModelDisplayLabel(config.modelId),
        desc: config.providerName
          ? `Mapped from ${config.providerName}.`
          : "Mapped image model from Settings.",
        time: "~--",
      };

      return {
        id: config.modelId as ImageModel,
        name: meta.name,
        desc: meta.desc,
        time: meta.time,
        providerId: config.providerId || null,
        providerName: config.providerName || "",
      };
    });
  }, [modelMappingVersion]);

  useEffect(() => {
    const handleModelMappingChanged = () => {
      setModelMappingVersion((value) => value + 1);
    };

    window.addEventListener(
      "provider-settings-updated",
      handleModelMappingChanged as EventListener,
    );
    window.addEventListener("storage", handleModelMappingChanged);
    window.addEventListener("focus", handleModelMappingChanged);

    return () => {
      window.removeEventListener(
        "provider-settings-updated",
        handleModelMappingChanged as EventListener,
      );
      window.removeEventListener("storage", handleModelMappingChanged);
      window.removeEventListener("focus", handleModelMappingChanged);
    };
  }, []);

  // Agent orchestration
  const projectContext = useProjectContext(
    id || "",
    projectTitle,
    elements,
    getCurrentConversationId(),
  );
  const {
    currentTask,
    isUploadingAttachments,
    processMessage,
    executeProposal,
  } = useAgentOrchestrator({
    projectContext,
    canvasState: { elements, pan, zoom, showAssistant },
    onElementsUpdate: (els) => {
      elementsRef.current = els;
      setElements(els);
    },
    onHistorySave: (els) => saveToHistory(els, markersRef.current),
    autoAddToCanvas: true,
  });

  // Close video dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      setShowVideoModelDropdown(false);
      setShowVideoSettingsDropdown(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Sync markers with inputBlocks - remove markers that don't have corresponding chips in inputBlocks
  // Only sync when inputBlocks has at least one marker file (meaning user is actively working with markers)
  useEffect(() => {
    const hasMarkerFiles = inputBlocks.some(
      (block: InputBlock) => typeof getInputBlockMarkerId(block) === "string",
    );

    // Only sync if user has marker files in input (active session)
    // Skip sync if inputBlocks is just the initial empty state
    if (
      !hasMarkerFiles &&
      inputBlocks.length === 1 &&
      inputBlocks[0].type === "text" &&
      !inputBlocks[0].text
    ) {
      // Initial state or clean state - don't clear markers from loaded project
      return;
    }

    const markerIdsInInput = inputBlocks
      .map(getInputBlockMarkerId)
      .filter((markerId: string | undefined): markerId is string => typeof markerId === "string");

    setMarkersSynced((prev) => {
      // If there are no marker files in input but there are markers, clear them
      // This handles the case when user removes all marker chips
      if (!hasMarkerFiles && prev.length > 0) {
        return [];
      }

      const filtered = prev.filter((m) => markerIdsInInput.includes(m.id));
      if (filtered.length !== prev.length) {
        return filtered;
      }
      return prev;
    });
  }, [getInputBlockMarkerId, inputBlocks]);

  // Reverse sync: when markers change, remove orphan marker chips in inputBlocks.
  useEffect(() => {
    const markerIds = markers.map((m) => m.id);
    const currentBlocks = useAgentStore.getState().composer.inputBlocks;
    const hasOrphanChip = currentBlocks.some(
      (b) =>
        b.type === "file" &&
        typeof b.file?.markerId === "string" &&
        !markerIds.includes(b.file.markerId),
    );
    if (!hasOrphanChip) return;
    let filtered = currentBlocks.filter(
      (b) =>
        !(
          b.type === "file" &&
          typeof b.file?.markerId === "string" &&
          !markerIds.includes(b.file.markerId)
        ),
    );
    filtered = normalizeInputBlocks(filtered);
    // Keep original markerId as a stable unique identifier.
    setInputBlocks(filtered);
  }, [markers]);

  // Auto-insert selected canvas images into input as chips (at cursor position).
  const prevSelectedIdsRef = useRef<string[]>([]);
  const pendingPickRequestRef = useRef(0);
  const selectionAttachmentSyncTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  useEffect(() => {
    if (selectionAttachmentSyncTimerRef.current) {
      clearTimeout(selectionAttachmentSyncTimerRef.current);
      selectionAttachmentSyncTimerRef.current = null;
    }

    // Merge single-select and multi-select IDs.
    const ids =
      selectedElementIds.length > 0
        ? selectedElementIds
        : selectedElementId
          ? [selectedElementId]
          : [];
    const prev = prevSelectedIdsRef.current;

    // Only run auto insert/cleanup logic in agent mode.
    if (creationMode !== "agent") {
      const requestId = pendingPickRequestRef.current + 1;
      pendingPickRequestRef.current = requestId;
      selectionAttachmentSyncTimerRef.current = setTimeout(() => {
        if (pendingPickRequestRef.current !== requestId) return;
        startTransition(() => {
          clearPendingAttachments();
        });
      }, 120);
      prevSelectedIdsRef.current = ids;
      return;
    }
    // Clear pending attachments when selection becomes empty.
    if (ids.length === 0) {
      const requestId = pendingPickRequestRef.current + 1;
      pendingPickRequestRef.current = requestId;
      selectionAttachmentSyncTimerRef.current = setTimeout(() => {
        if (pendingPickRequestRef.current !== requestId) return;
        startTransition(() => {
          clearPendingAttachments();
        });
      }, 120);
      prevSelectedIdsRef.current = ids;
      return;
    }

    // Skip if selection list is unchanged.
    if (JSON.stringify(ids) === JSON.stringify(prev)) return;

    // When deselecting all, remove auto-inserted canvas image chips.
    if (ids.length === 0 && prev.length > 0) {
      pendingPickRequestRef.current += 1;
      const currentBlocks = useAgentStore.getState().composer.inputBlocks;
      const filtered = currentBlocks.filter((b) => {
        if (b.type !== "file" || !b.file) return true;
        if (b.file._canvasAutoInsert) return false;
        return true;
      });
      setInputBlocks(normalizeInputBlocks(filtered));
      clearPendingAttachments();
      prevSelectedIdsRef.current = ids;
      return;
    }

    // Record current selected IDs.
    prevSelectedIdsRef.current = ids;

    // Find newly selected elements.
    const newIds = ids.filter((id) => !prev.includes(id));
    if (newIds.length === 0) return;

    // Soft selection: allow multiple pending targets.
    const imageEls = elements.filter(
      (e) =>
        newIds.includes(e.id) &&
        (e.type === "image" || e.type === "gen-image") &&
        e.url,
    );
    if (imageEls.length === 0) return;

    const requestId = pendingPickRequestRef.current + 1;
    pendingPickRequestRef.current = requestId;

    // Soft-selection preview (pending), do not directly inject into input stream.
    selectionAttachmentSyncTimerRef.current = setTimeout(() => {
      if (pendingPickRequestRef.current !== requestId) return;

      const nextPendingAttachments = [
        ...(useAgentStore.getState().composer.pendingAttachments || []),
      ];
      const seenCanvasIds = new Set(
        nextPendingAttachments
          .map((item) => item.canvasElId)
          .filter(Boolean),
      );

      for (const targetEl of imageEls) {
        if (!(getElementDisplayUrl(targetEl) || getElementSourceUrl(targetEl))) {
          continue;
        }
        if (seenCanvasIds.has(targetEl.id)) {
          continue;
        }

        const file = new File(
          [new Uint8Array(1)],
          `canvas-${targetEl.id.slice(-6)}.png`,
          { type: "image/png" },
        ) as WorkspaceInputFile;
        file._chipPreviewUrl =
          getElementDisplayUrl(targetEl) || getElementSourceUrl(targetEl) || "";
        file._canvasAutoInsert = true;
        file._canvasElId = targetEl.id;
        file._canvasWidth = targetEl.width;
        file._canvasHeight = targetEl.height;
        file._attachmentId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        nextPendingAttachments.push({
          id: file._attachmentId!,
          file,
          source: "canvas",
          canvasElId: targetEl.id,
        });
        seenCanvasIds.add(targetEl.id);
      }

      if (
        nextPendingAttachments.length ===
        (useAgentStore.getState().composer.pendingAttachments || []).length
      ) {
        return;
      }

      startTransition(() => {
        setPendingAttachments(nextPendingAttachments);
      });
    }, 64);
  }, [
    selectedElementIds,
    selectedElementId,
    creationMode,
    elements,
    getElementSourceUrl,
    clearPendingAttachments,
    setPendingAttachments,
    selectionAttachmentSyncTimerRef,
    nodeInteractionMode,
  ]);

  useEffect(() => {
    return () => {
      if (selectionAttachmentSyncTimerRef.current) {
        clearTimeout(selectionAttachmentSyncTimerRef.current);
      }
    };
  }, []);

  // Text Edit Feature State
  const [showTextEditModal, setShowTextEditModal] = useState(false);
  const detectedTexts = useAgentStore((s) => s.detectedTexts);
  const editedTexts = useAgentStore((s) => s.editedTexts);
  const isExtractingText = useAgentStore((s) => s.isExtractingText);
  const [showFileListModal, setShowFileListModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const refImageInputRef = useRef<HTMLInputElement>(null);
  const chatSessionRef = useRef<ReturnType<typeof createChatSession> | null>(
    null,
  );
  const fontTriggerRef = useRef<HTMLButtonElement>(null);
  const weightTriggerRef = useRef<HTMLButtonElement>(null);
  const textSettingsTriggerRef = useRef<HTMLButtonElement>(null);
  const fontPopoverRef = useRef<HTMLDivElement>(null);
  const weightPopoverRef = useRef<HTMLDivElement>(null);
  const textSettingsPopoverRef = useRef<HTMLDivElement>(null);
  const {
    showFontPicker,
    setShowFontPicker,
    showWeightPicker,
    setShowWeightPicker,
    fontPickerPos,
    setFontPickerPos,
    weightPickerPos,
    setWeightPickerPos,
    showTextSettings,
    setShowTextSettings,
    textSettingsPos,
    setTextSettingsPos,
    toggleFontPicker,
    toggleWeightPicker,
    toggleTextSettings,
  } = useWorkspaceTextToolbarUi({
    fontTriggerRef,
    weightTriggerRef,
    textSettingsTriggerRef,
    elements,
    selectedElementId,
    zoom,
    pan,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasLayerRef = useRef<HTMLDivElement>(null);
  const marqueeBoxRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialPromptProcessedRef = useRef(false);
  // Performance: store drag positions in ref to avoid re-renders during drag
  const dragOffsetsRef = useRef<Record<string, { x: number; y: number }>>({});
  const rafIdRef = useRef<number>(0);
  const panRafIdRef = useRef<number>(0);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panChangedRef = useRef(false);
  const marqueePreviewIdsRef = useRef<string[]>([]);
  const resizeRafIdRef = useRef<number>(0);
  const dragOthersCacheRef = useRef<{
    key: string;
    source: CanvasElement[];
    others: CanvasElement[];
  } | null>(null);
  const resizePreviewRef = useRef<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize?: number;
  } | null>(null);
  const {
    pushWorkflowUiMessage,
    insertResultToCanvas,
    startClothingWorkflow,
    handleClothingGenerateModel,
    handleClothingPickModel,
    handleClothingSubmitRequirements,
    handleClothingRetryFailed,
    handleClothingWorkflowSend,
  } = useWorkspaceClothingWorkflow({
    addMessage,
    showAssistant,
    pan,
    zoom,
    elementsRef,
    markersRef,
    setElementsSynced,
    saveToHistory,
    setSelectedElementId,
    clothingState,
    clothingActions,
    setClothingWorkflowError,
    autoModelSelect: modelPreferences.autoModelSelect,
    preferredImageModel: modelPreferences.preferredImageModel,
    getCurrentTopicId,
    ensureTopicId,
    ensureClothingSession,
    setInputBlocks,
    setIsTyping,
  });

  const {
    handleEcommerceBacktrackToStep,
    handleEcommerceWorkflowSend,
    handleEcommerceRefineAnalysis,
    handleEcommerceConfirmTypes,
    handleEcommerceAutofillImageAnalyses,
    handleEcommerceConfirmImageAnalyses,
    handleEcommerceRetryImageAnalysis,
    handleEcommerceRewritePlanPrompt,
    handleEcommerceGenerateExtraPlanItem,
    handleEcommerceGeneratePlanItem,
    handleEcommercePrepareResultForCanvas,
    handleEcommerceResolveTextAnchors,
    handleEcommerceUploadCompetitorDeck,
    handleEcommerceImportCompetitorDeckFromUrl,
    handleEcommerceImportExtractedCompetitorDeck,
    handleEcommerceSetCompetitorDecks,
    handleEcommerceAnalyzeCompetitorDecks,
    handleEcommerceRunCompetitorVisionSmokeTest,
    handleEcommerceOpenOverlayEditor,
    handleEcommerceCloseOverlayEditor,
    handleEcommerceSaveResultOverlayDraft,
    handleEcommerceApplyResultOverlay,
    handleEcommerceExportResultOverlayVariants,
    handleEcommerceExportSelectedOverlayVariants,
    handleEcommerceUploadResultOverlayFont,
    handleEcommerceUploadResultOverlayIcon,
    handleEcommerceResetResultOverlay,
    handleEcommercePromoteResult,
    handleEcommercePromoteSelectedResults,
    handleEcommerceDeleteResult,
    handleEcommerceConfirmPlans,
    handleEcommerceRetrySupplementQuestions,
    handleEcommerceUseSupplementFallback,
    handleEcommerceRetryPlanGroups,
    handleEcommerceUsePlanFallback,
    handleEcommerceAutofillSupplements,
    handleEcommerceAutofillPlans,
    handleEcommerceConfirmSupplements,
    handleEcommerceSyncBatchPlanItemRatio,
    handleEcommerceSyncBatchPrompt,
    handleEcommerceSelectModel,
    handleEcommercePrepareBatchPrompts,
    handleEcommerceOpenBatchWorkbench,
    handleEcommerceRunBatchGenerate,
  } = useWorkspaceEcommerceWorkflow({
    addMessage,
    ecommerceState,
    ecommerceActions,
    ensureEcommerceSession,
    setEcommerceWorkflowError,
    setInputBlocks,
    setIsTyping,
  });

  const { handleRefImageUpload, handleVideoRefUpload } =
    useWorkspaceElementReferenceUploads({
      selectedElementId,
      elementsRef,
      markersRef,
      setElementsSynced,
      saveToHistory,
    });

  useEffect(() => {
    const candidates = elements
      .map((element) => {
        if (
          element.type !== "gen-image" ||
          element.url ||
          element.isGenerating
        ) {
          return null;
        }

        const sourceRefs =
          element.genRefImages ||
          (element.genRefImage ? [element.genRefImage] : []);
        if (sourceRefs.length === 0) {
          return null;
        }

        const previewRefs =
          element.genRefPreviewImages ||
          (element.genRefPreviewImage ? [element.genRefPreviewImage] : []);

        const needsPreviewBackfill =
          previewRefs.length !== sourceRefs.length ||
          previewRefs.some((item) => !isLikelyGeneratedReferencePreview(item));

        if (!needsPreviewBackfill) {
          return null;
        }

        return {
          element,
          sourceWeight: sourceRefs.reduce(
            (sum, item) => sum + estimateDataUrlBytes(item),
            0,
          ),
        };
      })
      .filter(
        (
          item,
        ): item is {
          element: CanvasElement;
          sourceWeight: number;
        } => Boolean(item),
      )
      .sort((left, right) => right.sourceWeight - left.sourceWeight)
      .map((item) => item.element);

    if (candidates.length === 0) {
      return;
    }

    let cancelled = false;
    const timerId = window.setTimeout(() => {
      void (async () => {
        const previewUpdates = await Promise.all(
          candidates.slice(0, 1).map(async (element) => {
            const sourceRefs =
              element.genRefImages ||
              (element.genRefImage ? [element.genRefImage] : []);
            const currentPreviewRefs =
              element.genRefPreviewImages ||
              (element.genRefPreviewImage ? [element.genRefPreviewImage] : []);
            const nextPreviewRefs = await Promise.all(
              sourceRefs.map((src, index) => {
                const currentPreview = currentPreviewRefs[index];
                if (isLikelyGeneratedReferencePreview(currentPreview)) {
                  return currentPreview;
                }
                return createImagePreviewDataUrl(src);
              }),
            );

            const previewChanged =
              currentPreviewRefs.length !== nextPreviewRefs.length ||
              currentPreviewRefs.some(
                (item, index) => item !== nextPreviewRefs[index],
              );

            if (!previewChanged) {
              return null;
            }

            return {
              id: element.id,
              previewRefs: nextPreviewRefs,
            };
          }),
        );

        if (cancelled || previewUpdates.length === 0) {
          return;
        }

        setElements((previousElements) => {
          let changed = false;
          const previewMap = new Map(
            previewUpdates
              .filter((item): item is NonNullable<typeof item> => Boolean(item))
              .map((item) => [item.id, item]),
          );

          const nextElements = previousElements.map((element) => {
            const update = previewMap.get(element.id);
            if (!update) {
              return element;
            }

            const currentPreviewRefs =
              element.genRefPreviewImages ||
              (element.genRefPreviewImage ? [element.genRefPreviewImage] : []);
            const previewUnchanged =
              currentPreviewRefs.length === update.previewRefs.length &&
              currentPreviewRefs.every(
                (item, index) => item === update.previewRefs[index],
              );

            if (previewUnchanged) {
              return element;
            }

            changed = true;
            return {
              ...element,
              genRefPreviewImages: update.previewRefs,
              genRefPreviewImage: update.previewRefs[0],
            };
          });

          return changed ? nextElements : previousElements;
        });
      })();
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [elements, setElements]);

  const { removeInputBlock, handleSaveMarkerLabel } =
    useWorkspaceMarkerInputActions({
      markersRef,
      updateMarkersAndSaveHistory,
      setActiveBlockId,
      setInputBlocks,
      setEditingMarkerId,
    });

  const startTextEditing = useCallback((elementId: string, text: string) => {
    textEditDraftRef.current[elementId] = text;
    pendingSelectAllTextIdRef.current = elementId;
    setEditingTextId(elementId);
  }, []);

  const {
    addElement,
    addShape,
    addText,
    addTextAtClientPoint,
    addGenImage,
    addGenVideo,
  } = useWorkspaceCanvasElementCreation({
    showAssistant,
    pan,
    zoom,
    containerRef,
    elementsRef,
    markersRef,
    setElementsSynced,
    saveToHistory,
    setSelectedElementId,
    setSelectedElementIds,
    startTextEditing,
    setActiveTool,
    activeImageModel,
    activeImageProviderId,
    videoGenModel,
    activeVideoProviderId,
    videoGenRatio,
    videoGenQuality,
    videoGenDuration,
    videoStartFrame,
    videoEndFrame,
    videoMultiRefs,
    nodeInteractionMode,
    selectedElementId,
  });

  const mergeUniqueUrlList = useCallback(
    (existing: string[], incoming: string[]) =>
      [...existing, ...incoming]
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item, index, array) => array.indexOf(item) === index)
        .slice(0, 6),
    [],
  );

  const resolveTreePromptReferenceState = useCallback(
    (baseElements: CanvasElement[], parentIds: string[]) => {
      const sourceRefs: string[] = [];
      const previewRefs: string[] = [];
      const seenSourceRefs = new Set<string>();

      for (const currentParentId of parentIds) {
        const currentParent =
          baseElements.find((element) => element.id === currentParentId) || null;

        if (
          !currentParent ||
          resolveWorkspaceTreeNodeKind(currentParent, nodeInteractionMode) !==
            "image"
        ) {
          continue;
        }

        const sourceRef = (getElementSourceUrl(currentParent) || "").trim();
        if (!sourceRef || seenSourceRefs.has(sourceRef)) {
          continue;
        }

        seenSourceRefs.add(sourceRef);
        sourceRefs.push(sourceRef);

        const previewRef =
          (getElementDisplayUrl(currentParent) || sourceRef).trim() || sourceRef;
        previewRefs.push(previewRef);

        if (sourceRefs.length >= 6) {
          break;
        }
      }

      return {
        genRefImages: sourceRefs.length > 0 ? sourceRefs : undefined,
        genRefImage: sourceRefs[0],
        genRefPreviewImages: previewRefs.length > 0 ? previewRefs : undefined,
        genRefPreviewImage: previewRefs[0],
      };
    },
    [getElementDisplayUrl, getElementSourceUrl, nodeInteractionMode],
  );

  const resolveClientToCanvasPoint = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return null;

      return {
        x: (clientX - rect.left - panRef.current.x) / (zoomRef.current / 100),
        y: (clientY - rect.top - panRef.current.y) / (zoomRef.current / 100),
      };
    },
    [containerRef, panRef, zoomRef],
  );

  const handleTreeConnectionStart = useCallback(
    (elementId: string, port: "input" | "output" = "output") => {
      const element =
        elementsRef.current.find((item) => item.id === elementId) || null;
      if (!element || !isWorkspaceTreeNode(element, nodeInteractionMode)) return;

      const anchorY =
        port === "input" ? element.y : element.y + element.height;

      setTreeConnectionDraft({
        fromId: elementId,
        fromPort: port,
        fromX: element.x + element.width / 2,
        fromY: anchorY,
        toX: element.x + element.width / 2,
        toY: anchorY,
        targetId: null,
      });
    },
    [elementsRef, nodeInteractionMode],
  );

  const handleTreeConnectionDrag = useCallback(
    (clientX: number, clientY: number) => {
      setTreeConnectionDraft((current) => {
        if (!current) return current;
        const point = resolveClientToCanvasPoint(clientX, clientY);
        if (!point) return current;

        const hoveredNodeId =
          document
            .elementsFromPoint(clientX, clientY)
            .map((node) => {
              if (!(node instanceof HTMLElement)) return null;
              const target = node.closest("[id^='canvas-el-']");
              if (!(target instanceof HTMLElement)) return null;
              if (target.dataset.treeNode !== "true") return null;
              return target.id.replace("canvas-el-", "");
            })
            .find((id) => id && id !== current.fromId) || null;

        const targetElement = hoveredNodeId
          ? elementsRef.current.find((element) => element.id === hoveredNodeId) ||
            null
          : null;

        const nextToX = targetElement
          ? targetElement.x + targetElement.width / 2
          : point.x;
        const nextToY = targetElement
          ? current.fromPort === "output"
            ? targetElement.y
            : targetElement.y + targetElement.height
          : point.y;

        if (
          current.toX === nextToX &&
          current.toY === nextToY &&
          current.targetId === hoveredNodeId
        ) {
          return current;
        }
        return {
          ...current,
          toX: nextToX,
          toY: nextToY,
          targetId: hoveredNodeId,
        };
      });
    },
    [elementsRef, resolveClientToCanvasPoint],
  );

  const isMarkableCanvasElementAtPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (typeof document === "undefined") return false;

      const hoveredElementId =
        document
          .elementsFromPoint(clientX, clientY)
          .map((node) => {
            if (!(node instanceof HTMLElement)) return null;
            const target = node.closest("[id^='canvas-el-']");
            if (!(target instanceof HTMLElement)) return null;
            return target.id.replace("canvas-el-", "");
          })
          .find(Boolean) || null;

      if (!hoveredElementId) return false;
      const hoveredElement =
        elementsRef.current.find((element) => element.id === hoveredElementId) ||
        null;
      return Boolean(
        hoveredElement &&
          (hoveredElement.type === "image" || hoveredElement.type === "gen-image") &&
          hoveredElement.url,
      );
    },
    [elementsRef],
  );

  const effectiveCtrlMarkActive = isCtrlPressed && isCtrlMarkTargetHovered;

  const handleTreeConnectionCancel = useCallback(() => {
    setTreeConnectionDraft(null);
  }, []);

  const handleTreeConnectionComplete = useCallback(
    (targetId: string) => {
      const draft = treeConnectionDraft;
      if (!draft || draft.fromId === targetId) {
        setTreeConnectionDraft(null);
        return;
      }

      const baseElements = elementsRef.current;
      const source =
        baseElements.find((element) => element.id === draft.fromId) || null;
      const target =
        baseElements.find((element) => element.id === targetId) || null;
      const parent = draft.fromPort === "output" ? source : target;
      const child = draft.fromPort === "output" ? target : source;

      if (
        !parent ||
        !child ||
        !isWorkspaceTreeNode(parent, nodeInteractionMode) ||
        !isWorkspaceTreeNode(child, nodeInteractionMode)
      ) {
        setTreeConnectionDraft(null);
        return;
      }

      const childDescendants = new Set(
        collectNodeDescendantIds(baseElements, [child.id]),
      );
      if (childDescendants.has(parent.id)) {
        setTreeConnectionDraft(null);
        return;
      }

      const parentIds = Array.from(
        new Set(
          [
            ...(child.nodeParentIds || []),
            ...(child.nodeParentId ? [child.nodeParentId] : []),
            parent.id,
          ].filter(Boolean),
        ),
      );

      let changed = false;
      const nextElements = baseElements.map((element) => {
        if (element.id !== child.id) return element;

        const nextElement: CanvasElement = {
          ...element,
          nodeParentId: element.nodeParentId || parent.id,
          nodeParentIds: parentIds,
          nodeLinkKind:
            element.nodeLinkKind ||
            (element.y >= parent.y + parent.height * 0.5
              ? "generation"
              : "branch"),
        };

        if (
          resolveWorkspaceTreeNodeKind(parent, nodeInteractionMode) === "image" &&
          resolveWorkspaceTreeNodeKind(element, nodeInteractionMode) === "prompt"
        ) {
          const nextReferenceState = resolveTreePromptReferenceState(
            baseElements,
            parentIds,
          );
          const mergedSourceRefs = nextReferenceState.genRefImages || [];

          nextElement.genRefImages = nextReferenceState.genRefImages;
          nextElement.genRefImage = nextReferenceState.genRefImage;
          nextElement.genRefPreviewImages =
            nextReferenceState.genRefPreviewImages;
          nextElement.genRefPreviewImage =
            nextReferenceState.genRefPreviewImage;

          if (mergedSourceRefs.length > 0) {
            nextElement.height = Math.max(
              element.height,
              280 + Math.max(0, Math.ceil(mergedSourceRefs.length / 4) - 1) * 64,
            );
          }
        }

        changed =
          changed ||
          nextElement.nodeParentId !== element.nodeParentId ||
          (nextElement.nodeParentIds || []).join("|") !==
            (element.nodeParentIds || []).join("|") ||
          nextElement.nodeLinkKind !== element.nodeLinkKind ||
          nextElement.genRefImage !== element.genRefImage ||
          (nextElement.genRefImages || []).join("|") !==
            (element.genRefImages || []).join("|") ||
          nextElement.genRefPreviewImage !== element.genRefPreviewImage ||
          (nextElement.genRefPreviewImages || []).join("|") !==
            (element.genRefPreviewImages || []).join("|") ||
          nextElement.height !== element.height;

        return nextElement;
      });

      setTreeConnectionDraft(null);

      if (!changed) return;

      setElementsSynced(nextElements);
      saveToHistory(nextElements, markersRef.current);
    },
    [
      treeConnectionDraft,
      elementsRef,
      markersRef,
      nodeInteractionMode,
      resolveTreePromptReferenceState,
      saveToHistory,
      setElementsSynced,
    ],
  );

  const handleTreeConnectionDisconnect = useCallback(
    (parentId: string, childId: string) => {
      const baseElements = elementsRef.current;
      const parent =
        baseElements.find((element) => element.id === parentId) || null;
      const child =
        baseElements.find((element) => element.id === childId) || null;

      if (
        !parent ||
        !child ||
        !isWorkspaceTreeNode(parent, nodeInteractionMode) ||
        !isWorkspaceTreeNode(child, nodeInteractionMode)
      ) {
        return;
      }

      let changed = false;
      const nextElements = baseElements.map((element) => {
        if (element.id !== childId) return element;

        const remainingParentIds = getAllNodeParentIds(element).filter(
          (id) => id !== parentId,
        );

        const nextElement: CanvasElement = {
          ...element,
          nodeParentId: remainingParentIds[0],
          nodeParentIds:
            remainingParentIds.length > 0 ? remainingParentIds : undefined,
          nodeLinkKind:
            remainingParentIds.length > 0 ? element.nodeLinkKind : undefined,
        };

        if (
          resolveWorkspaceTreeNodeKind(parent, nodeInteractionMode) === "image" &&
          resolveWorkspaceTreeNodeKind(element, nodeInteractionMode) === "prompt"
        ) {
          const nextReferenceState = resolveTreePromptReferenceState(
            baseElements,
            remainingParentIds,
          );

          nextElement.genRefImages = nextReferenceState.genRefImages;
          nextElement.genRefImage = nextReferenceState.genRefImage;
          nextElement.genRefPreviewImages =
            nextReferenceState.genRefPreviewImages;
          nextElement.genRefPreviewImage =
            nextReferenceState.genRefPreviewImage;
        }

        changed =
          changed ||
          nextElement.nodeParentId !== element.nodeParentId ||
          (nextElement.nodeParentIds || []).join("|") !==
            (element.nodeParentIds || []).join("|") ||
          nextElement.nodeLinkKind !== element.nodeLinkKind ||
          nextElement.genRefImage !== element.genRefImage ||
          (nextElement.genRefImages || []).join("|") !==
            (element.genRefImages || []).join("|") ||
          nextElement.genRefPreviewImage !== element.genRefPreviewImage ||
          (nextElement.genRefPreviewImages || []).join("|") !==
            (element.genRefPreviewImages || []).join("|");

        return nextElement;
      });

      if (!changed) return;

      setElementsSynced(nextElements);
      saveToHistory(nextElements, markersRef.current);
    },
    [
      elementsRef,
      markersRef,
      nodeInteractionMode,
      resolveTreePromptReferenceState,
      saveToHistory,
      setElementsSynced,
    ],
  );

  const createReferencedGenImageFromSelection = useCallback(() => {
    const candidateSelectionIds =
      selectedElementIds.length > 0
        ? selectedElementIds
        : selectedElementId
        ? [selectedElementId]
        : [];

    if (candidateSelectionIds.length === 0) {
      return false;
    }

    const selectedImageElements = candidateSelectionIds
      .map((elementId) => elements.find((element) => element.id === elementId))
      .filter(
        (element): element is CanvasElement =>
          !!element &&
          (element.type === "image" || element.type === "gen-image") &&
          !!getElementSourceUrl(element),
      );

    if (selectedImageElements.length === 0) {
      return false;
    }

    const referenceEntries = selectedImageElements.reduce<
      Array<{ initialRef: string; sourceRef: string }>
    >((items, element) => {
      const sourceRef = getElementSourceUrl(element)?.trim() || "";
      const displayRef =
        getElementDisplayUrl(element)?.trim() || sourceRef;
      if (!sourceRef) {
        return items;
      }

      const initialRef = shouldNormalizeReferenceImageSource(sourceRef)
        ? displayRef
        : sourceRef;

      if (!initialRef) {
        return items;
      }

      if (
        items.some(
          (item) =>
            item.initialRef === initialRef || item.sourceRef === sourceRef,
        )
      ) {
        return items;
      }

      items.push({ initialRef, sourceRef });
      return items;
    }, []).slice(0, 6);

    if (referenceEntries.length === 0) {
      return false;
    }
    const initialPreviewImages = referenceEntries.map((item) => item.initialRef);
    const sourceReferenceImages = referenceEntries.map((item) => item.sourceRef);

    const maxX = Math.max(
      ...selectedImageElements.map((element) => element.x + element.width),
    );
    const minX = Math.min(...selectedImageElements.map((element) => element.x));
    const minY = Math.min(...selectedImageElements.map((element) => element.y));
    const maxY = Math.max(
      ...selectedImageElements.map((element) => element.y + element.height),
    );
    const nodeSize = 1024;
    const gap = 140;
    const isBranchMode = nodeInteractionMode === "branch";
    const isSingleReference = selectedImageElements.length === 1;
    const branchNodeWidth = 380;
    const branchNodeHeight = Math.max(
      280,
      280 + Math.max(0, Math.ceil(referenceEntries.length / 4) - 1) * 64,
    );
    const selectionCenterX = minX + (maxX - minX) / 2;

    const newElementId = addGenImage({
      x:
        isBranchMode
          ? selectionCenterX - branchNodeWidth / 2
          : maxX + gap,
      y:
        isBranchMode
          ? maxY + gap
          : minY + (maxY - minY - nodeSize) / 2,
      width: isBranchMode ? branchNodeWidth : undefined,
      height:
        isBranchMode
          ? branchNodeHeight
          : undefined,
      genRefImages: sourceReferenceImages,
      genRefPreviewImages: initialPreviewImages,
      nodeInteractionMode,
      parentElementId:
        isBranchMode && isSingleReference
          ? selectedImageElements[0]?.id
          : undefined,
      parentElementIds:
        isBranchMode && isSingleReference
          ? selectedImageElements.map((element) => element.id)
          : undefined,
      disableAutoParentLink: isBranchMode && !isSingleReference,
    });

    void (async () => {
      try {
        const nextPreviewRefs = await Promise.all(
          sourceReferenceImages.map((source) =>
            createImagePreviewDataUrl(source),
          ),
        );

        setElements((previousElements) => {
          let changed = false;
          const nextElements = previousElements.map((element) => {
            if (element.id !== newElementId) {
              return element;
            }

            const currentSourceRefs =
              element.genRefImages ||
              (element.genRefImage ? [element.genRefImage] : []);
            const currentPreviewRefs =
              element.genRefPreviewImages ||
              (element.genRefPreviewImage ? [element.genRefPreviewImage] : []);
            const previewUnchanged =
              currentPreviewRefs.length === nextPreviewRefs.length &&
              currentPreviewRefs.every(
                (item, index) => item === nextPreviewRefs[index],
              );

            const sourceUnchanged =
              currentSourceRefs.length === sourceReferenceImages.length &&
              currentSourceRefs.every(
                (item, index) => item === sourceReferenceImages[index],
              );

            if (sourceUnchanged && previewUnchanged) {
              return element;
            }

            changed = true;
            return {
              ...element,
              genRefImages: sourceReferenceImages,
              genRefImage: sourceReferenceImages[0],
              genRefPreviewImages: nextPreviewRefs,
              genRefPreviewImage: nextPreviewRefs[0],
            };
          });

          return changed ? nextElements : previousElements;
        });
      } catch {
        // Keep the lightweight refs if normalization fails.
      }
    })();

    pendingPickRequestRef.current += 1;
    if (selectionAttachmentSyncTimerRef.current) {
      clearTimeout(selectionAttachmentSyncTimerRef.current);
      selectionAttachmentSyncTimerRef.current = null;
    }
    startTransition(() => {
      clearPendingAttachments();
    });

    return true;
  }, [
    addGenImage,
    clearPendingAttachments,
    elements,
    selectedElementId,
    selectedElementIds,
    selectionAttachmentSyncTimerRef,
    nodeInteractionMode,
  ]);

  const getTextWidth = (
    text: string,
    fontSize: number,
    fontFamily: string,
    fontWeight: string | number = 400,
    letterSpacing: number = 0,
  ): number => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return text.length * (fontSize * 0.6);
    context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const measurementText = text || " ";
    const metrics = context.measureText(measurementText);
    return metrics.width + measurementText.length * letterSpacing;
  };

  const hasEcommerceEditableOverlayContent = (
    overlayState?: EcommerceResultItem["overlayState"] | null,
  ) =>
    Boolean(
      overlayState?.headline ||
        overlayState?.subheadline ||
        overlayState?.badge ||
        overlayState?.priceLabel ||
        overlayState?.priceValue ||
        overlayState?.priceNote ||
        (overlayState?.featureTags && overlayState.featureTags.length > 0) ||
        overlayState?.cta ||
        (overlayState?.bullets && overlayState.bullets.length > 0) ||
        (overlayState?.stats && overlayState.stats.length > 0) ||
        overlayState?.comparisonTitle ||
        (overlayState?.comparisonRows && overlayState.comparisonRows.length > 0),
    );

  const loadCanvasImageSize = useCallback(async (url: string) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("图片尺寸读取失败。"));
      image.src = url;
    });
    return {
      width: image.naturalWidth || image.width || 1,
      height: image.naturalHeight || image.height || 1,
    };
  }, []);

  const insertEcommerceResultToCanvas = useCallback(
    async (resultOrUrl: EcommerceResultItem | string, label?: string) => {
      try {
        if (typeof resultOrUrl === "string") {
          insertResultToCanvas(resultOrUrl, label);
          return;
        }

        const preparedResult =
          await handleEcommercePrepareResultForCanvas(resultOrUrl);
        const overlayState = preparedResult.overlayState;
        const useEditableText =
          Boolean(overlayState) && hasEcommerceEditableOverlayContent(overlayState);
        const imageUrl = useEditableText
          ? overlayState?.baseImageUrl || preparedResult.url
          : preparedResult.overlayState?.renderedImageUrl || preparedResult.url;
        const sourceSize = await loadCanvasImageSize(imageUrl);
        const maxWidth = 560;
        const maxHeight = 700;
        const scale = Math.min(
          1,
          maxWidth / sourceSize.width,
          maxHeight / sourceSize.height,
        );
        const imageWidth = Math.max(120, Math.round(sourceSize.width * scale));
        const imageHeight = Math.max(120, Math.round(sourceSize.height * scale));
        const canvasCenter = getCanvasCenterPoint({
          showAssistant,
          pan,
          zoom,
        });
        const imageX = canvasCenter.x - imageWidth / 2;
        const imageY = canvasCenter.y - imageHeight / 2;
        const nextZBase = elementsRef.current.length + 1;
        const createdAt = Date.now();
        const imageElementId = `ecom-result-${createdAt}-image`;
        const imageElement: CanvasElement = {
          id: imageElementId,
          type: "image",
          url: imageUrl,
          originalUrl: preparedResult.url,
          x: imageX,
          y: imageY,
          width: imageWidth,
          height: imageHeight,
          zIndex: nextZBase,
          genPrompt: label || preparedResult.label || "Ecommerce result",
        };

        const nextElements: CanvasElement[] = [...elementsRef.current, imageElement];
        const selectionIds = [imageElementId];

        if (useEditableText && overlayState) {
          const anchorHints =
            await handleEcommerceResolveTextAnchors(preparedResult);
          const textPlan = buildEcommerceTextLayerPlan({
            overlayState,
            layoutMeta: preparedResult.layoutMeta,
            canvasWidth: imageWidth,
            canvasHeight: imageHeight,
            anchorHints,
          });
          const textElements: CanvasElement[] = textPlan.textLayers.map((layer, index) => {
            const elementId = `ecom-result-${createdAt}-text-${index + 1}`;
            selectionIds.push(elementId);
            return {
              id: elementId,
              type: "text" as const,
              text: layer.text,
              x: imageX + layer.x,
              y: imageY + layer.y,
              width: layer.width,
              height: layer.height,
              fontSize: layer.fontSize,
              fontFamily: overlayState.fontFamily || "Arial",
              fontWeight: layer.fontWeight,
              fillColor: layer.fillColor,
              strokeColor: "transparent",
              textAlign: layer.textAlign,
              lineHeight: layer.lineHeight,
              letterSpacing: layer.letterSpacing,
              textTransform: "none" as const,
              zIndex: nextZBase + index + 1,
            };
          });
          nextElements.push(...textElements);

          if (textElements.length > 0) {
            const allCreated: CanvasElement[] = [imageElement, ...textElements];
            const groupId = `group-${createdAt}-${Math.random().toString(36).slice(2, 8)}`;
            const originalChildData = Object.fromEntries(
              allCreated.map((element) => [
                element.id,
                {
                  x: element.x,
                  y: element.y,
                  width: element.width,
                  height: element.height,
                  zIndex: element.zIndex,
                },
              ]),
            );
            allCreated.forEach((element) => {
              element.groupId = groupId;
            });
            nextElements.push({
              id: groupId,
              type: "group",
              x: imageX,
              y: imageY,
              width: imageWidth,
              height: imageHeight,
              zIndex: nextZBase + textElements.length + 1,
              children: allCreated.map((element) => element.id),
              isCollapsed: false,
              originalChildData,
            });
            setSelectedElementId(groupId);
          } else {
            setSelectedElementId(imageElementId);
          }
        } else {
          setSelectedElementId(imageElementId);
        }

        setElementsSynced(nextElements);
        saveToHistory(nextElements, markersRef.current);
        setSelectedElementIds(selectionIds);
      } catch (error) {
        addMessage({
          id: `${Date.now()}`,
          role: "model",
          text: `进入画板失败：${error instanceof Error ? error.message : "未知错误"}`,
          timestamp: Date.now(),
          error: true,
        });
      }
    },
    [
      addMessage,
      elementsRef,
      handleEcommercePrepareResultForCanvas,
      handleEcommerceResolveTextAnchors,
      insertResultToCanvas,
      loadCanvasImageSize,
      markersRef,
      pan,
      saveToHistory,
      setElementsSynced,
      setSelectedElementId,
      setSelectedElementIds,
      showAssistant,
      zoom,
    ],
  );

  const { updateElementById, updateSelectedElement, deleteSelectedElement, commitTextEdit } =
    useWorkspaceElementStateActions({
      selectedElementId,
      selectedElementIds,
      elementsRef,
      markersRef,
      textEditDraftRef,
      setElementsSynced,
      setMarkersSynced,
      setSelectedElementId,
      setSelectedElementIds,
      saveToHistory,
      getTextWidth,
    });

  const { fitToScreen, handleContextMenu, handleManualPaste, handleDownload } =
    useWorkspaceCanvasViewActions({
      elements,
      showAssistant,
      setPan,
      setZoom,
      addElement,
      selectedElementId,
      setContextMenu,
      getElementSourceUrl,
      suppressNextContextMenuRef: suppressNextCanvasContextMenuRef,
    });

  const showFeatureComingSoon = (name: string) => {
    if (featureNoticeTimerRef.current) {
      clearTimeout(featureNoticeTimerRef.current);
    }
    setFeatureNotice(`${name} is under development`);
    featureNoticeTimerRef.current = setTimeout(() => {
      setFeatureNotice(null);
      featureNoticeTimerRef.current = null;
    }, 1800);
  };

  const { elementById, selectedElement, visibleCanvasElements, rootElements } =
    useWorkspaceDerivedCanvasState({
      elements,
      selectedElementId,
      focusedGroupId,
    });

  const {
    setSelectedElementIdsIfChanged,
    setMarqueeEndIfChanged,
    getCachedDragOthers,
  } = useWorkspaceCanvasPointerHelpers({
    elements: visibleCanvasElements,
    dragOthersCacheRef,
    setSelectedElementIds,
    setMarqueeEnd,
  });

  const setAlignmentGuides = useCallback(
    (guides: { type: "h" | "v"; pos: number }[]) => {
      if (!alignmentGuideVRef.current || !alignmentGuideHRef.current) {
        alignmentGuideVRef.current = document.getElementById(
          "workspace-align-guide-v",
        ) as HTMLDivElement | null;
        alignmentGuideHRef.current = document.getElementById(
          "workspace-align-guide-h",
        ) as HTMLDivElement | null;
      }

      const verticalGuide = guides.find((guide) => guide.type === "v") ?? null;
      const horizontalGuide = guides.find((guide) => guide.type === "h") ?? null;

      if (alignmentGuideVRef.current) {
        if (verticalGuide) {
          alignmentGuideVRef.current.style.display = "block";
          alignmentGuideVRef.current.style.left = `${verticalGuide.pos}px`;
        } else {
          alignmentGuideVRef.current.style.display = "none";
        }
      }

      if (alignmentGuideHRef.current) {
        if (horizontalGuide) {
          alignmentGuideHRef.current.style.display = "block";
          alignmentGuideHRef.current.style.top = `${horizontalGuide.pos}px`;
        } else {
          alignmentGuideHRef.current.style.display = "none";
        }
      }
    },
    [],
  );

  // contentEditable cursor helper functions
  const getCECursorPos = (el: HTMLElement): number => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 0;
    const range = sel.getRangeAt(0);
    const pre = range.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.startContainer, range.startOffset);
    return pre.toString().length;
  };
  const setCECursorPos = (el: HTMLElement, pos: number) => {
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let cur = 0;
    let node = walker.nextNode();
    while (node) {
      const len = (node.textContent || "").length;
      if (cur + len >= pos) {
        const range = document.createRange();
        range.setStart(node, pos - cur);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      cur += len;
      node = walker.nextNode();
    }
    // fallback: move caret to the end
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  };
  useEffect(() => {
    if (!id || isLoadingRecord.current) return;
    const save = async () => {
      if (isLoadingRecord.current) return;
      if (Date.now() < suspendAutoSaveUntilRef.current) return;
      const firstImage = elementsRef.current.find(
        (el) => el.type === "image" || el.type === "gen-image",
      );
      const thumbnail = firstImage?.url || "";
      await saveProject({
        id,
        title: projectTitle,
        updatedAt: formatDate(Date.now()),
        elements: elementsRef.current,
        markers: markersRef.current,
        thumbnail,
        conversations,
      });
    };
    const timeout = setTimeout(save, 1000);
    return () => clearTimeout(timeout);
  }, [elements, markers, conversations, id, projectTitle]);

  useEffect(() => {
    setShowFastEdit(false);
    setFastEditPrompt("");
    setShowTextEditModal(false);
  }, [selectedElementId]);

  const {
    urlToBase64,
    applyGeneratedImageToElement,
    createGeneratingImagesNearElement,
    createGeneratingTreeImageChildren,
    appendElementsGenerationLog,
    setElementsGenerationStatus,
    setElementGeneratingState,
  } = useWorkspaceElementMutationHelpers({
    showAssistant,
    nodeInteractionMode,
    elementsRef,
    markersRef,
    setElementsSynced,
    saveToHistory,
    getCurrentTopicId,
    updateDesignSession: projectActions.updateDesignSession,
  });

  // --- Image Processing Handlers ---

  const handleProductSwap = useWorkspaceProductSwap({
    selectedElementId,
    productSwapImages,
    productSwapRes,
    setShowProductSwapPanel,
    elementsRef,
    setElementsSynced,
    setSelectedElementId,
    urlToBase64,
    loadElementSourceSize,
    getNearestAspectRatio,
    persistEditSession,
    getDesignConsistencyContext,
    retryWithConsistencyFix,
    applyGeneratedImageToElement,
  });

  const {
    handleUpscale,
    handleRemoveBg,
    handleEditTextClick,
    handleApplyTextEdits,
    handleFastEditRun,
  } = useWorkspaceElementEditActions({
    selectedElementId,
    elements,
    elementsRef,
    setElementsSynced,
    setSelectedElementId,
    urlToBase64,
    applyGeneratedImageToElement,
    setElementGeneratingState,
    persistEditSession,
    maybeWarnConsistencyDrift,
    getDesignConsistencyContext,
    retryWithConsistencyFix,
    loadElementSourceSize,
    getNearestAspectRatio,
    detectedTexts,
    editedTexts,
    setDetectedTexts,
    setEditedTexts,
    setShowTextEditModal,
    setIsExtractingText,
    fastEditPrompt,
    setShowFastEdit,
    setFastEditPrompt,
  });

  const {
    handleUpscaleSelect,
    handleUndoEraser,
    handleClearEraser,
    handleCloseEraser,
    handleExecuteEraser,
    handleVectorRedraw,
  } = useWorkspaceImageToolActions({
    selectedElementId,
    elements,
    elementsRef,
    showUpscalePanel,
    eraserMode,
    eraserMaskDataUrl,
    eraserHistory,
    upscaleDetailPrompt: UPSCALE_STRATEGIES.detail.prompt,
    vectorRedrawPrompt: UPSCALE_STRATEGIES.vector.prompt,
    eraserCanvasRef,
    eraserMaskCanvasRef,
    eraserInitKeyRef,
    eraserCursorRef,
    eraserLastPointRef,
    setElementsSynced,
    setSelectedElementId,
    setShowUpscalePanel,
    setShowUpscaleResDropdown,
    setUpscaleSourceSize,
    setEraserMode,
    setEraserMaskDataUrl,
    setEraserHistory,
    setEraserHasPaint,
    setIsDrawingEraser,
    addMessage,
    urlToBase64,
    persistEditSession,
    maybeWarnConsistencyDrift,
    applyGeneratedImageToElement,
  });

  const handleSmartGenerate = useWorkspaceSmartGenerate({
    addMessage,
    setIsTyping,
    executeProposal,
    showAssistant,
    pan,
    zoom,
    elementsRef,
    setElementsSynced,
    setSelectedElementId,
    selectedElementId,
    activeImageModel,
    activeImageProviderId,
    nodeInteractionMode,
    translatePromptToEnglish,
    enforceChineseTextInImage,
    requiredChineseCopy,
    getDesignConsistencyContext: () => getDesignConsistencyContext() || {},
    mergeConsistencyAnchorIntoReferences,
    retryWithConsistencyFix: (
      label,
      initialUrl,
      rerun,
      anchorOverride,
      genPrompt,
      referenceCount,
    ) =>
      retryWithConsistencyFix(
        label,
        initialUrl,
        rerun,
        anchorOverride,
        genPrompt,
        referenceCount,
      ),
    applyGeneratedImageToElement,
    createGeneratingTreeImageChildren,
  });

  const handleSend = useWorkspaceSend({
    isUploadingAttachments,
    isTyping,
    webEnabled,
    agentSelectionMode,
    pinnedAgentId,
    creationMode,
    researchMode,
    imageGenRatio,
    imageGenRes,
    imageGenCount,
    videoGenRatio,
    translatePromptToEnglish,
    enforceChineseTextInImage,
    requiredChineseCopy,
    selectedElementId,
    selectedElementIds,
    elementsRef,
    getElementSourceUrl,
    ensureConversationId,
    buildMemoryKey,
    processMessage,
    addMessage,
    setIsTyping,
    setInputBlocks,
    clearInputDom: () => {
      document.querySelectorAll('[id^="input-block-"]').forEach((element) => {
        (element as HTMLElement).textContent = "";
      });
    },
    handleSpecialSkillData: async ({ text, attachments, skillData }) => {
      if (skillData?.id === "clothing-studio-workflow") {
        await handleClothingWorkflowSend({
          text,
          attachments,
        });
        return true;
      }

      if (skillData?.id === "ecom-oneclick-workflow") {
        await handleEcommerceWorkflowSend({
          text,
          attachments,
        });
        return true;
      }

      return false;
    },
  });

  const { handleTouchEditClick, handleTouchEditExecute } =
    useWorkspaceTouchEditActions({
      elements,
      elementsRef,
      touchEditMode,
      touchEditPopup,
      touchEditInstruction,
      setElementsSynced,
      setTouchEditPopup,
      setTouchEditInstruction,
      setIsTouchEditing,
      urlToBase64,
      persistEditSession,
      getNearestAspectRatio,
      maybeWarnConsistencyDrift,
      applyGeneratedImageToElement,
    });

  // Handle Model Mode Switching
  useEffect(() => {
    const selectedModel = getBestModelSelection(
      modelMode === "thinking" ? "thinking" : "text",
    );

    // Preserve history when switching models if possible, but basic recreation here
    const historyContent: Content[] = messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));
    chatSessionRef.current = createChatSession(
      selectedModel.modelId,
      historyContent,
      undefined,
      selectedModel.providerId,
    );
  }, [modelMode]);

  useWorkspaceProjectLoader({
    id,
    locationState: location.state,
    isLoadingRecordRef: isLoadingRecord,
    suspendAutoSaveUntilRef,
    initialPromptProcessedRef,
    chatSessionRef,
    createConversationId,
    setElementsSynced,
    setMarkersSynced,
    setConversations,
    setProjectTitle,
    setHistory,
    setHistoryStep,
    setSelectedElementId,
    setSelectedElementIds,
    setActiveConversationId,
    setInputBlocks,
    setModelMode,
    setWebEnabled,
    setImageModelEnabled,
    handleSend,
    setElements,
  });

  // Ctrl key listener: toggle custom cursor state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control") {
        setIsCtrlPressed(true);
        const lastPoint = lastPointerClientRef.current;
        setIsCtrlMarkTargetHovered(
          lastPoint
            ? isMarkableCanvasElementAtPoint(lastPoint.x, lastPoint.y)
            : false,
        );
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control") {
        setIsCtrlPressed(false);
        setIsCtrlMarkTargetHovered(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isMarkableCanvasElementAtPoint]);

  useWorkspaceConversationPersistence({
    messages,
    workspaceId: id,
    activeConversationId,
    projectTitle,
    setConversations,
  });

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      setContextMenu(null);
      const target = e.target as HTMLElement;
      const clickedInFontTrigger =
        !!fontTriggerRef.current && fontTriggerRef.current.contains(target);
      const clickedInWeightTrigger =
        !!weightTriggerRef.current && weightTriggerRef.current.contains(target);
      const clickedInTextSettingsTrigger =
        !!textSettingsTriggerRef.current &&
        textSettingsTriggerRef.current.contains(target);
      const clickedInFontPopover =
        !!fontPopoverRef.current && fontPopoverRef.current.contains(target);
      const clickedInWeightPopover =
        !!weightPopoverRef.current && weightPopoverRef.current.contains(target);
      const clickedInTextSettingsPopover =
        !!textSettingsPopoverRef.current &&
        textSettingsPopoverRef.current.contains(target);
      if (
        !clickedInFontTrigger &&
        !clickedInWeightTrigger &&
        !clickedInTextSettingsTrigger &&
        !clickedInFontPopover &&
        !clickedInWeightPopover &&
        !clickedInTextSettingsPopover &&
        !target.closest(".relative")
      ) {
        setShowFontPicker(false);
        setShowWeightPicker(false);
        setShowTextSettings(false);
        setShowResPicker(false);
        setShowRatioPicker(false);
        setShowModelPicker(false);
        setShowFileListModal(false);
      }
    };
    const handleWindowPaste = (e: ClipboardEvent) => {
      if (
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.getAttribute("contenteditable")
      )
        return;
      if (e.clipboardData?.files.length) {
        e.preventDefault();
        const file = e.clipboardData.files[0];
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const result = event.target?.result as string;
            const img = new Image();
            img.onload = () => {
              const containerW =
                window.innerWidth - (showAssistantRef.current ? 480 : 0);
              const containerH = window.innerHeight;
              const centerX =
                (containerW / 2 - panRef.current.x) / (zoomRef.current / 100);
              const centerY =
                (containerH / 2 - panRef.current.y) / (zoomRef.current / 100);
              const newElement: CanvasElement = {
                id: Date.now().toString(),
                type: "image",
                url: result,
                x: centerX - img.width / 2,
                y: centerY - img.height / 2,
                width: img.width,
                height: img.height,
                zIndex: elementsRef.current.length + 1,
                nodeInteractionMode:
                  nodeInteractionModeRef.current === "branch"
                    ? "branch"
                    : undefined,
                treeNodeKind:
                  nodeInteractionModeRef.current === "branch"
                    ? "image"
                    : undefined,
              };
              const newElements = [...elementsRef.current, newElement];
              setElementsSynced(newElements);
              saveToHistory(newElements, markersRef.current);
            };
            img.src = result;
          };
          reader.readAsDataURL(file);
        }
      }
    };
    window.addEventListener("click", handleGlobalClick);
    window.addEventListener("paste", handleWindowPaste);

    // Native wheel listener for non-passive behavior (Prevent Browser Zoom and enable Pan)
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const oldZoom = zoomRef.current;
        const oldPan = panRef.current;

        // Dynamic zoom step for both trackpads (small deltaY) and mice (large deltaY)
        let step = Math.max(1, Math.min(20, Math.abs(e.deltaY) * 0.1));
        const delta = e.deltaY > 0 ? -step : step;
        const newZoom = Math.max(10, Math.min(500, oldZoom + delta));

        // The mathematical offset to keep the mouse stationary under the document is:
        // NewPan = MouseCoord - (MouseCoord - OldPan) * (NewZoom / OldZoom)
        const zoomFactor = newZoom / oldZoom;

        const newPan = {
          x: mouseX - (mouseX - oldPan.x) * zoomFactor,
          y: mouseY - (mouseY - oldPan.y) * zoomFactor,
        };

        zoomRef.current = newZoom;
        panRef.current = newPan;

        setZoom(newZoom);
        setPan(newPan);
      } else {
        if (e.ctrlKey) {
          e.preventDefault();
          return;
        }
        const target = e.target as HTMLElement | null;
        // Allow scrolling in popovers/modals/textareas/sidebars
        if (
          target?.closest(
            ".overflow-y-auto, textarea, input, .history-popover-content, .sidebar, .right-sidebar",
          )
        ) {
          return;
        }
        e.preventDefault();

        const oldPan = panRef.current;
        const newPan = {
          x: oldPan.x - e.deltaX,
          y: oldPan.y - e.deltaY,
        };

        panRef.current = newPan;
        setPan(newPan);
      }
    };

    // Attach to window to catch all scrolls and prevent browser zoom
    window.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      window.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("paste", handleWindowPaste);
      window.removeEventListener("wheel", onWheel);
    };
  }, []);

  const resolveCurrentCanvasSelectionIds = useCallback(() => {
    const rawIds =
      selectedElementIds.length > 0
        ? selectedElementIds
        : selectedElementId
          ? [selectedElementId]
          : [];

    return Array.from(new Set(rawIds));
  }, [selectedElementId, selectedElementIds]);

  const duplicateCanvasSelection = useCallback(
    ({
      anchorId,
      offset,
      persistHistory = true,
      selectionIds,
      sourceElements,
    }: {
      anchorId?: string | null;
      offset?: { x: number; y: number };
      persistHistory?: boolean;
      selectionIds: string[];
      sourceElements?: CanvasElement[];
    }) => {
      const duplication = buildDuplicatedCanvasSelection({
        anchorId,
        offset,
        selectionIds,
        sourceElements: sourceElements || elementsRef.current,
        targetElements: elementsRef.current,
      });

      if (!duplication) {
        return null;
      }

      setElementsSynced(duplication.nextElements);
      setSelectedElementId(duplication.duplicatedAnchorId);
      setSelectedElementIds(duplication.duplicatedSelectionIds);

      if (persistHistory) {
        saveToHistory(duplication.nextElements, markersRef.current);
      }

      return duplication;
    },
    [elementsRef, markersRef, saveToHistory, setElementsSynced],
  );

  const copyCanvasSelectionToClipboard = useCallback(() => {
    const selectionIds = resolveCurrentCanvasSelectionIds();
    const clipboardSnapshot = createCanvasElementClipboardSnapshot({
      anchorId: selectedElementId || selectionIds[0] || null,
      selectionIds,
      sourceElements: elementsRef.current,
    });

    if (!clipboardSnapshot) {
      return false;
    }

    elementClipboardRef.current = clipboardSnapshot;
    return true;
  }, [elementsRef, resolveCurrentCanvasSelectionIds, selectedElementId]);

  const pasteCanvasSelectionFromClipboard = useCallback(() => {
    const clipboardSnapshot = elementClipboardRef.current;
    if (!clipboardSnapshot) {
      return false;
    }

    const nextPasteCount = clipboardSnapshot.pasteCount + 1;
    const duplication = duplicateCanvasSelection({
      anchorId: clipboardSnapshot.anchorId,
      offset: {
        x: 32 * nextPasteCount,
        y: 32 * nextPasteCount,
      },
      persistHistory: true,
      selectionIds: clipboardSnapshot.selectionIds,
      sourceElements: clipboardSnapshot.elements,
    });

    if (!duplication) {
      return false;
    }

    elementClipboardRef.current = {
      ...clipboardSnapshot,
      pasteCount: nextPasteCount,
    };
    return true;
  }, [duplicateCanvasSelection]);

  const beginAltDragDuplicate = useCallback(
    (selectionIds: string[], anchorId: string) => {
      const duplication = duplicateCanvasSelection({
        anchorId,
        offset: { x: 0, y: 0 },
        persistHistory: false,
        selectionIds,
      });

      if (!duplication) {
        return null;
      }

      didDuplicateOnCurrentDragRef.current = true;
      return {
        anchorId: duplication.duplicatedAnchorId,
        selectionIds: duplication.duplicatedSelectionIds,
        startPositions: duplication.duplicatedStartPositions,
      };
    },
    [duplicateCanvasSelection],
  );

  const handleGenImage = useWorkspaceElementImageGeneration({
    elementsRef,
    nodeInteractionMode,
    setElementGeneratingState,
    setElementsGenerationStatus,
    appendElementsGenerationLog,
    addMessage,
    translatePromptToEnglish,
    enforceChineseTextInImage,
    requiredChineseCopy,
    getDesignConsistencyContext,
    mergeConsistencyAnchorIntoReferences,
    retryWithConsistencyFix,
    applyGeneratedImageToElement,
    createGeneratingImagesNearElement,
    createGeneratingTreeImageChildren,
    getClosestAspectRatio,
  });

  useEffect(() => {
    const pending = elements.filter(
      (el) => el.type === "gen-image" && !!el.url && !el.originalUrl,
    );
    if (pending.length === 0) return;

    let cancelled = false;

    void (async () => {
      const viewport = getCanvasViewportSize(showAssistant);
      const updates: Array<{
        id: string;
        url: string;
        originalUrl: string;
        proxyUrl: string | undefined;
        width: number;
        height: number;
        genAspectRatio: string;
      } | null> = [];
      const queue = pending.slice(0, 1);

      for (const el of queue) {
        try {
          const proxy = await makeImageProxyFromUrl(
            el.url!,
            DEFAULT_PROXY_MAX_DIM,
            viewport,
          );
          updates.push({
            id: el.id,
            url: proxy.displayUrl,
            originalUrl: proxy.originalUrl,
            proxyUrl:
              proxy.displayUrl !== proxy.originalUrl
                ? proxy.displayUrl
                : undefined,
            width: proxy.displayWidth,
            height: proxy.displayHeight,
            genAspectRatio: `${proxy.originalWidth}:${proxy.originalHeight}`,
          });
        } catch {
          updates.push(null);
        }
      }

      const patch = new Map(
        updates
          .filter((u): u is NonNullable<typeof u> => Boolean(u))
          .map((u) => [u.id, u]),
      );
      if (patch.size === 0 || cancelled) return;

      setElements((prev) => {
        let changed = false;
        const next = prev.map((el) => {
          const hit = patch.get(el.id);
          if (!hit) return el;
          changed = true;
          return {
            ...el,
            url: hit.url,
            originalUrl: hit.originalUrl,
            proxyUrl: hit.proxyUrl,
            width: hit.width,
            height: hit.height,
            genAspectRatio: hit.genAspectRatio,
          };
        });
        return changed ? next : prev;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [elements, showAssistant]);

  const handleGenVideo = useWorkspaceElementVideoGeneration({
    elementsRef,
    markersRef,
    setElementGeneratingState,
    setElementsSynced,
    saveToHistory,
    addMessage,
  });

  const { handleFileUpload, handleCanvasDrop } = useWorkspaceCanvasAssetImport({
    showAssistant,
    pan,
    zoom,
    nodeInteractionMode,
    containerRef,
    elementsRef,
    appendElementsAndSaveHistory,
  });

  const {
    handleMouseDown: canvasHandleMouseDown,
    handleMouseMove: canvasHandleMouseMove,
    handleMouseUp: canvasHandleMouseUp,
  } = useWorkspaceCanvasPointer({
    contextMenu,
    setContextMenu,
    suppressNextContextMenuRef: suppressNextCanvasContextMenuRef,
    cutterTrailGlowRef,
    cutterTrailPathRef,
    cutterTrailTipRef,
    activeTool,
    isSpacePressedRef,
    setIsPanning,
    setDragStart,
    panRef,
    panStartRef,
    panChangedRef,
    containerRef,
    canvasLayerRef,
    marqueeBoxRef,
    marqueePreviewIdsRef,
    addTextAtClientPoint,
    setIsMarqueeSelecting,
    setMarqueeStart,
    setMarqueeEndIfChanged,
    isResizing,
    selectedElementId,
    resizeStart,
    zoom,
    resizeHandle,
    elementById,
    resizePreviewRef,
    resizeRafIdRef,
    isPanning,
    dragStart,
    panRafIdRef,
    isMarqueeSelecting,
    marqueeStart,
    pan,
    elements,
    visibleElements: visibleCanvasElements,
    setSelectedElementIdsIfChanged,
    setSelectedElementId,
    isDraggingElement,
    dragDidMoveRef,
    pendingDragElementIdRef,
    dragSelectionIdsRef,
    pendingAltDragDuplicateRef,
    didDuplicateOnCurrentDragRef,
    elementStartPos,
    setElementStartPos,
    selectedElementIds,
    getCachedDragOthers,
    setAlignmentGuides,
    groupDragStartRef,
    dragOffsetsRef,
    rafIdRef,
    getClosestAspectRatio,
    elementsRef,
    setElementsSynced,
    saveToHistory,
    markersRef,
    setIsResizing,
    setResizeHandle,
    setPan,
    setIsDraggingElement,
    beginAltDragDuplicate,
    onDisconnectEdge: handleTreeConnectionDisconnect,
  });

  const handleCanvasMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      lastPointerClientRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
      setIsCtrlMarkTargetHovered(
        isMarkableCanvasElementAtPoint(event.clientX, event.clientY),
      );
      if (treeConnectionDraft) {
        handleTreeConnectionDrag(event.clientX, event.clientY);
      }
      canvasHandleMouseMove(event);
    },
    [
      canvasHandleMouseMove,
      handleTreeConnectionDrag,
      isMarkableCanvasElementAtPoint,
      treeConnectionDraft,
    ],
  );

  const handleCanvasMouseUp = useCallback(() => {
    if (treeConnectionDraft) {
      if (treeConnectionDraft.targetId) {
        handleTreeConnectionComplete(treeConnectionDraft.targetId);
      } else {
        handleTreeConnectionCancel();
      }
    }
    canvasHandleMouseUp();
  }, [
    canvasHandleMouseUp,
    handleTreeConnectionCancel,
    handleTreeConnectionComplete,
    treeConnectionDraft,
  ]);

  const {
    handleElementMouseDown: canvasHandleElementMouseDown,
    handleResizeStart: canvasHandleResizeStart,
  } = useWorkspaceCanvasElementInteraction({
    isSpacePressedRef,
    activeTool,
    creationMode,
    isPickingFromCanvas,
    elementById,
    getElementSourceUrl,
    setImageGenUploads,
    setIsPickingFromCanvas,
    setSelectedElementId,
    setSelectedElementIds,
    textEditDraftRef,
    pendingSelectAllTextIdRef,
    setEditingTextId,
    setActiveTool,
    addTextAtClientPoint,
    dataURLtoFile,
    showAssistant,
    setShowAssistant,
    markers,
    markersRef,
    setInputBlocks,
    setMarkersSynced,
    updateMarkersAndSaveHistory,
    insertInputFile,
    containerRef,
    zoom,
    pan,
    setZoom,
    setPan,
    selectedElementId,
    selectedElementIds,
    pendingDragElementIdRef,
    dragSelectionIdsRef,
    pendingAltDragDuplicateRef,
    setIsDraggingElement,
    setDragStart,
    setElementStartPos,
    setElementsSynced,
    groupDragStartRef,
    setIsResizing,
    setResizeHandle,
    setResizeStart,
  });

  // ===== Multi-select Alignment & Spacing Functions =====
  const {
    showAlignMenu,
    showSpacingMenu,
    setShowAlignMenu,
    setShowSpacingMenu,
    alignSelectedElements,
    distributeSelectedElements,
    handleGroupSelected,
    handleMergeSelected,
    handleUngroupSelected,
  } = useWorkspaceMultiSelectTools({
    elementsRef,
    markersRef,
    selectedElementId,
    selectedElementIds,
    setElementsSynced,
    setSelectedElementId,
    setSelectedElementIds,
    saveToHistory,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ae = document.activeElement as HTMLElement | null;
      const isInTextInput =
        ae?.tagName === "TEXTAREA" ||
        ae?.tagName === "INPUT" ||
        ae?.getAttribute("contenteditable") === "true";

      if (editingTextId && e.key === "Escape") {
        e.preventDefault();
        setEditingTextId(null);
        return;
      }

      if (isInTextInput) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
        if (copyCanvasSelectionToClipboard()) {
          e.preventDefault();
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") {
        if (pasteCanvasSelectionFromClipboard()) {
          e.preventDefault();
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        setZoom((z) => Math.min(200, z + 10));
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "-") {
        e.preventDefault();
        setZoom((z) => Math.max(10, z - 10));
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        setZoom(100);
        return;
      }
      if (e.shiftKey && e.key === "1") {
        e.preventDefault();
        fitToScreen();
        return;
      }
      if (e.code === "Space" && !e.repeat) {
        const isTyping =
          ae?.tagName === "TEXTAREA" ||
          ae?.tagName === "INPUT" ||
          ae?.getAttribute("contenteditable") === "true";
        if (!isTyping) {
          e.preventDefault();
          if (ae?.tagName === "BUTTON") ae.blur();
          isSpacePressedRef.current = true;
        }
      }

      if (e.key === "Tab") {
        e.preventDefault();
        if (createReferencedGenImageFromSelection()) {
          return;
        }
        if (selectedElementId) {
          const el = elements.find((item) => item.id === selectedElementId);
          if (
            el &&
            (el.type === "gen-image" || el.type === "image") &&
            el.url
          ) {
            setShowFastEdit((prev) => !prev);
            return;
          }
        }
        textareaRef.current?.focus();
      }

      if ((e.key === "Backspace" || e.key === "Delete") && selectedChipId) {
        e.preventDefault();
        e.stopPropagation();
        removeInputBlock(selectedChipId);
        setSelectedChipId(null);
        return;
      }

      if (
        isInTextInput &&
        (e.key === "Backspace" || e.key === "Delete") &&
        selectedElementId
      ) {
        const textContent =
          (ae as HTMLTextAreaElement | HTMLInputElement)?.value ??
          ae?.textContent ??
          "";
        if (!textContent) {
          e.preventDefault();
          (ae as HTMLElement)?.blur();
          deleteSelectedElement();
        }
        return;
      }

      if (!isInTextInput) {
        if (e.altKey && selectedElementIds.length > 1) {
          const k = e.key.toLowerCase();
          if (k === "a") {
            e.preventDefault();
            alignSelectedElements("left");
            return;
          }
          if (k === "d") {
            e.preventDefault();
            alignSelectedElements("right");
            return;
          }
          if (k === "h") {
            e.preventDefault();
            alignSelectedElements("center");
            return;
          }
          if (k === "w") {
            e.preventDefault();
            alignSelectedElements("top");
            return;
          }
          if (k === "s") {
            e.preventDefault();
            alignSelectedElements("bottom");
            return;
          }
          if (k === "v") {
            e.preventDefault();
            alignSelectedElements("middle");
            return;
          }
        }

        if (
          e.shiftKey &&
          !e.ctrlKey &&
          !e.metaKey &&
          selectedElementIds.length > 1
        ) {
          const k = e.key.toUpperCase();
          if (k === "H") {
            e.preventDefault();
            distributeSelectedElements("horizontal");
            return;
          }
          if (k === "V") {
            e.preventDefault();
            distributeSelectedElements("vertical");
            return;
          }
          if (k === "A") {
            e.preventDefault();
            distributeSelectedElements("auto");
            return;
          }
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
          e.preventDefault();
          if (e.shiftKey) {
            const sel = elements.find((el) => el.id === selectedElementId);
            if (sel?.type === "group") {
              handleUngroupSelected();
            } else if (selectedElementIds.length > 1) {
              handleMergeSelected();
            }
          } else if (selectedElementIds.length > 1) {
            handleGroupSelected();
          }
          return;
        }

        if (e.key.toLowerCase() === "v" && !(e.metaKey || e.ctrlKey)) {
          setActiveTool("select");
        }
        if (e.key.toLowerCase() === "h" && !e.altKey) setActiveTool("hand");
        if (e.key.toLowerCase() === "m") setActiveTool("mark");
        if (e.key.toLowerCase() === "t" && !e.altKey) setActiveTool("text");
        if (e.key === "Backspace" || e.key === "Delete") {
          deleteSelectedElement();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") isSpacePressedRef.current = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    selectedElementId,
    selectedElementIds,
    history,
    historyStep,
    elements,
    markers,
    selectedChipId,
    editingTextId,
    copyCanvasSelectionToClipboard,
    createReferencedGenImageFromSelection,
    pasteCanvasSelectionFromClipboard,
    alignSelectedElements,
    distributeSelectedElements,
    handleGroupSelected,
    handleMergeSelected,
    handleUngroupSelected,
    fitToScreen,
    deleteSelectedElement,
  ]);

  const { workspaceLeftPanelProps, assistantSidebarProps } =
    useWorkspaceSidebarProps({
      leftPanelMode,
      setLeftPanelMode,
      elements,
      rootElements,
      elementById,
      selectedElementId,
      selectedElementIds,
      isHistoryExpanded,
      setIsHistoryExpanded,
      handleElementMouseDown: canvasHandleElementMouseDown,
      setElements,
      setFocusedGroupId,
      messages,
      setPreviewUrl,
      focusedGroupId,
      id,
      conversations,
      setConversations,
      activeConversationId,
      setActiveConversationId,
      showAssistant,
      setShowAssistant,
      onOpenEcommerceWorkflow: openEcommerceWorkflow,
      handleSend,
      handleSmartGenerate,
      addGenImage,
      activeImageModel,
      activeImageProviderId,
      imageGenRatio,
      imageGenRes,
      creationMode,
      setCreationMode,
      setPrompt,
      handleModeSwitch,
      fileInputRef,
      selectedChipId,
      setSelectedChipId,
      hoveredChipId,
      setHoveredChipId,
      showModeSelector,
      setShowModeSelector,
      showRatioPicker,
      setShowRatioPicker,
      showModelPicker,
      setShowModelPicker,
      isInputFocused,
      setIsInputFocused,
      isDragOver,
      setIsDragOver,
      isVideoPanelHovered,
      setIsVideoPanelHovered,
      showVideoSettingsDropdown,
      setShowVideoSettingsDropdown,
      modelPreferences,
      markers,
      handleSaveMarkerLabel,
      handleClothingSubmitRequirements,
      handleClothingGenerateModel,
      handleClothingPickModel,
      insertResultToCanvas,
      handleClothingRetryFailed,
      handleEcommerceRefineAnalysis,
      handleEcommerceConfirmTypes,
      handleEcommerceConfirmImageAnalyses,
      handleEcommerceRetryImageAnalysis,
      handleEcommerceRewritePlanPrompt,
      handleEcommerceGenerateExtraPlanItem,
      handleEcommerceGeneratePlanItem,
      handleEcommerceOpenOverlayEditor,
      handleEcommerceCloseOverlayEditor,
      handleEcommerceSaveResultOverlayDraft,
      handleEcommerceApplyResultOverlay,
      handleEcommerceUploadResultOverlayFont,
      handleEcommerceUploadResultOverlayIcon,
      handleEcommerceResetResultOverlay,
      handleEcommercePromoteResult,
      handleEcommercePromoteSelectedResults,
      handleEcommerceDeleteResult,
      handleEcommerceConfirmPlans,
      handleEcommerceConfirmSupplements,
      handleEcommerceSelectModel,
      handleEcommerceSyncBatchPlanItemRatio,
      handleEcommerceSyncBatchPrompt,
      handleEcommerceOpenBatchWorkbench,
      handleEcommerceRunBatchGenerate: (promptOverrides, options) =>
        handleEcommerceRunBatchGenerate(false, {
          promptOverrides,
          ...options,
        }),
      handleEcommerceRetryFailedBatch: () =>
        handleEcommerceRunBatchGenerate(true),
      handleEcommerceInsertToCanvas: insertEcommerceResultToCanvas,
    });

  const {
    workspaceCanvasElementsLayerProps,
    workspaceCanvasOverlayLayerProps,
  } = useWorkspaceCanvasLayerProps({
    canvasLayerRef,
    visibleCanvasElements,
    nodeInteractionMode,
    selectedElementId,
    selectedElementIds,
    elementById,
    activeTool,
    isCtrlPressed: effectiveCtrlMarkActive,
    editingTextId,
    isDraggingElement,
    textEditDraftRef,
    pendingSelectAllTextIdRef,
    setElementsSynced,
    setEditingTextId,
    setPreviewUrl,
    zoom,
    elements,
    getTextWidth,
    commitTextEdit,
    handleResizeStart: canvasHandleResizeStart,
    isExtractingText,
    getElementDisplayUrl,
    getElementSourceUrl,
    handleElementMouseDown: canvasHandleElementMouseDown,
    handleUngroupSelected,
    deleteSelectedElement,
    markers,
    dragOffsetsRef,
    hoveredChipId,
    inputBlocks,
    editingMarkerId,
    setEditingMarkerId,
    editingMarkerLabel,
    setEditingMarkerLabel,
    setZoom,
    handleSaveMarkerLabel,
    selectedElement,
    translatePromptToEnglish,
    enforceChineseTextInImage,
    requiredChineseCopy,
    showModelPicker,
    showResPicker,
    showRatioPicker,
    imageModelOptions: mappedImageModelOptions,
    aspectRatios: ASPECT_RATIOS,
    renderRatioIcon,
    setTranslatePromptToEnglish,
    setEnforceChineseTextInImage,
    setRequiredChineseCopy,
    setShowModelPicker,
    setShowResPicker,
    setShowRatioPicker,
    setSelectedElementId,
    setSelectedElementIds,
    updateSelectedElement,
    handleRefImageUpload,
    handleGenImage,
    isTreeConnectionActive: Boolean(treeConnectionDraft),
    handleTreeConnectionStart,
    handleTreeConnectionComplete,
    handleTreeConnectionDisconnect,
    showTextEditModal,
    detectedTexts,
    editedTexts,
    setEditedTexts,
    setShowTextEditModal,
    handleApplyTextEdits,
    eraserMode,
    eraserMaskCanvasRef,
    setEraserMaskDataUrl,
    eraserCanvasRef,
    eraserCanvasRectRef,
    brushSize,
    eraserCursorRef,
    setEraserHistory,
    setIsDrawingEraser,
    isDrawingEraser,
    setEraserHasPaint,
    eraserHasPaint,
    eraserLastPointRef,
    handleUndoEraser,
    handleClearEraser,
    setBrushSize,
    setEraserMode,
    handleCloseEraser,
    handleExecuteEraser,
    toolbarExpanded,
    setToolbarExpanded,
    toolbarExpandTimer,
    showUpscalePanel,
    setShowUpscalePanel,
    selectedUpscaleRes,
    setSelectedUpscaleRes,
    showUpscaleResDropdown,
    setShowUpscaleResDropdown,
    upscaleSourceSize,
    getUpscaleFactor,
    calcUpscaleTargetSize,
    handleUpscaleSelect,
    handleRemoveBg,
    showProductSwapPanel,
    setShowProductSwapPanel,
    productSwapImages,
    setProductSwapImages,
    productSwapRes,
    setProductSwapRes,
    showProductSwapResDropdown,
    setShowProductSwapResDropdown,
    fileToDataUrl,
    handleProductSwap,
    handleEditTextClick,
    handleVectorRedraw,
    handleDownload,
    showFastEdit,
    setShowFastEdit,
    fastEditPrompt,
    setFastEditPrompt,
     handleFastEditRun,
     consistencyCheckEnabled,
     currentConsistencyAnchorUrl,
     approvedConsistencyAssetIds,
     handleSetConsistencyAnchorFromElement,
     handlePreviewConsistencyAnchor,
    videoToolbarTab,
    setVideoToolbarTab,
    handleVideoRefUpload,
    showVideoModelPicker,
    setShowVideoModelPicker,
    handleGenVideo,
    showAlignMenu,
    showSpacingMenu,
    setShowAlignMenu,
    setShowSpacingMenu,
    alignSelectedElements,
    distributeSelectedElements,
    handleGroupSelected,
    handleMergeSelected,
    fontTriggerRef,
    weightTriggerRef,
    textSettingsTriggerRef,
    fontPopoverRef,
    weightPopoverRef,
    textSettingsPopoverRef,
    toggleFontPicker,
    toggleWeightPicker,
    toggleTextSettings,
    showFontPicker,
    showWeightPicker,
    showTextSettings,
    fontPickerPos,
    weightPickerPos,
    textSettingsPos,
    setShowFontPicker,
    setShowWeightPicker,
    fonts: FONTS,
    treeConnectionDraft,
  });
  const {
    workspaceSidebarLayerProps,
    workspaceCanvasStageProps,
    workspacePageOverlaysProps,
  } = useWorkspacePageShellProps({
    workspaceLeftPanelProps,
    assistantSidebarProps,
    workspaceCanvasElementsLayerProps,
    workspaceCanvasOverlayLayerProps,
    showAssistant,
    setShowAssistant,
    isCtrlPressed: effectiveCtrlMarkActive,
    projectTitle,
    setProjectTitle,
    nodeInteractionMode,
    setNodeInteractionMode,
    navigateToDashboard: () => navigate(ROUTES.dashboard),
    leftPanelMode,
    setLeftPanelMode,
    zoom,
    setZoom,
    containerRef,
    canvasLayerRef,
    marqueeBoxRef,
    cutterTrailGlowRef,
    cutterTrailPathRef,
    cutterTrailTipRef,
    creationMode,
    isPickingFromCanvas,
    activeTool,
    setActiveTool: setActiveTool as (tool: string) => void,
    imageModelOptions: mappedImageModelOptions,
    aspectRatioOptions: ASPECT_RATIOS,
    isPanning,
    handleContextMenu,
    handleMouseDown: canvasHandleMouseDown,
    handleMouseMove: handleCanvasMouseMove,
    handleMouseUp: handleCanvasMouseUp,
    handleCanvasDrop,
    handleFileUpload,
    showFeatureComingSoon,
    addShape,
    addGenImage,
    addGenVideo,
    consistencyCheckEnabled,
    currentConsistencyAnchorUrl,
    handleToggleConsistencyCheck,
    handleUploadConsistencyAnchor,
    handleClearConsistencyAnchor,
    handlePreviewConsistencyAnchor,
    isMarqueeSelecting,
    marqueeStart,
    marqueeEnd,
    pan,
    elements,
    visibleCanvasElements,
    rootElements,
    contextMenu,
    selectedElementId,
    selectedElementIds,
    selectedElement,
    setSelectedElementId,
    setSelectedElementIds,
    updateElementById,
    handleGenImage,
    handleManualPaste,
    handleDownload,
    fitToScreen,
    setContextMenu,
    previewUrl,
    setPreviewUrl,
    modeSwitchDialog,
    featureNotice,
    touchEditMode,
    setTouchEditMode,
    touchEditPopup,
    touchEditInstruction,
    isTouchEditing,
    setTouchEditPopup,
    setTouchEditInstruction,
    handleTouchEditExecute,
  });

  return (
    <div
      className="flex h-screen w-screen overflow-hidden bg-[#E8E8E8] font-sans"
      style={{ cursor: activeTool === "text" ? "crosshair" : "default" }}
    >
      <div className="flex flex-1 relative overflow-hidden">
        <WorkspacePageOverlays {...workspacePageOverlaysProps} />
        <WorkspaceSidebarLayer {...workspaceSidebarLayerProps} />
        <WorkspaceCanvasStage {...workspaceCanvasStageProps} />
        <EcommerceWorkflowDrawer
          open={isEcommerceWorkflowOpen}
          showAssistant={showAssistant}
          workflowBusy={isTyping}
          onClose={closeEcommerceWorkflow}
          onStartWorkflow={({ brief, files, platformMode, workflowMode }) =>
            handleEcommerceWorkflowSend({
              text: brief,
              attachments: files,
              platformMode,
              workflowMode,
            })
          }
          onUploadCompetitorDeck={handleEcommerceUploadCompetitorDeck}
          onImportCompetitorDeckFromUrl={
            handleEcommerceImportCompetitorDeckFromUrl
          }
          onImportExtractedCompetitorDeck={
            handleEcommerceImportExtractedCompetitorDeck
          }
          onSetCompetitorDecks={handleEcommerceSetCompetitorDecks}
          onAnalyzeCompetitorDecks={handleEcommerceAnalyzeCompetitorDecks}
          onRunCompetitorVisionSmokeTest={
            handleEcommerceRunCompetitorVisionSmokeTest
          }
          onSetWorkflowStep={handleEcommerceBacktrackToStep}
          onRefineAnalysis={handleEcommerceRefineAnalysis}
          onConfirmTypes={handleEcommerceConfirmTypes}
          onRetrySupplementQuestions={handleEcommerceRetrySupplementQuestions}
          onUseSupplementFallback={handleEcommerceUseSupplementFallback}
          onRetryPlanGroups={handleEcommerceRetryPlanGroups}
          onUsePlanFallback={handleEcommerceUsePlanFallback}
          onAutofillImageAnalyses={handleEcommerceAutofillImageAnalyses}
          onConfirmImageAnalyses={handleEcommerceConfirmImageAnalyses}
          onRetryImageAnalysis={handleEcommerceRetryImageAnalysis}
          onRewritePlanPrompt={handleEcommerceRewritePlanPrompt}
          onGenerateExtraPlanItem={handleEcommerceGenerateExtraPlanItem}
          onGeneratePlanItem={handleEcommerceGeneratePlanItem}
          onOpenResultOverlayEditor={handleEcommerceOpenOverlayEditor}
          onCloseResultOverlayEditor={handleEcommerceCloseOverlayEditor}
          onSaveResultOverlayDraft={handleEcommerceSaveResultOverlayDraft}
          onApplyResultOverlay={handleEcommerceApplyResultOverlay}
          onExportResultOverlayVariants={handleEcommerceExportResultOverlayVariants}
          onExportSelectedOverlayVariants={handleEcommerceExportSelectedOverlayVariants}
          onUploadResultOverlayFont={handleEcommerceUploadResultOverlayFont}
          onUploadResultOverlayIcon={handleEcommerceUploadResultOverlayIcon}
          onResetResultOverlay={handleEcommerceResetResultOverlay}
          onPromoteResult={handleEcommercePromoteResult}
          onPromoteSelectedResults={handleEcommercePromoteSelectedResults}
          onDeleteResult={handleEcommerceDeleteResult}
          onAutofillSupplements={handleEcommerceAutofillSupplements}
          onAutofillPlans={handleEcommerceAutofillPlans}
          onConfirmSupplements={handleEcommerceConfirmSupplements}
          onConfirmPlans={handleEcommerceConfirmPlans}
          onSelectModel={handleEcommerceSelectModel}
          onSyncBatchPlanItemRatio={handleEcommerceSyncBatchPlanItemRatio}
          onSyncBatchPrompt={handleEcommerceSyncBatchPrompt}
          onPrepareBatchPrompts={handleEcommercePrepareBatchPrompts}
          onOpenBatchWorkbench={handleEcommerceOpenBatchWorkbench}
          onRunBatchGenerate={(promptOverrides, options) =>
            handleEcommerceRunBatchGenerate(false, {
              promptOverrides,
              ...options,
            })
          }
          onRetryFailedBatch={() => handleEcommerceRunBatchGenerate(true)}
          onInsertToCanvas={insertEcommerceResultToCanvas}
          onPreviewResult={setPreviewUrl}
        />
      </div>
    </div>
  );
};

export default Workspace;







