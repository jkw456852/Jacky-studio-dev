import { Type } from "@google/genai";
import { useCallback, useEffect, useRef } from "react";
import type { ChatMessage, InputBlock } from "../../../types";
import type {
  EcommerceAnalysisReview,
  EcommerceArchetypeEvolutionProposal,
  EcommerceBatchJob,
  EcommerceCompetitorDeckAnalysis,
  EcommerceCompetitorDeckInput,
  EcommerceCompetitorImageAnalysisItem,
  EcommerceCompetitorPlanningContext,
  EcommerceCompetitorStrategyMode,
  EcommerceCopyPlan,
  EcommerceImageAnalysis,
  EcommerceLayoutAreaKind,
  EcommerceLayoutIntent,
  EcommerceLayoutSnapshot,
  EcommerceOverlayComparisonRow,
  EcommerceOverlayLayer,
  EcommerceOverlayLayerKind,
  EcommerceOverlayState,
  EcommerceOverlayStat,
  EcommercePlatformMode,
  EcommercePlanGroup,
  EcommercePlanItem,
  EcommerceTextContainerIntent,
  EcommercePromptLanguage,
  EcommerceRecommendedType,
  EcommerceResultItem,
  EcommerceStageReview,
  EcommerceSupplementField,
  EcommerceWorkflowImage,
  EcommerceWorkflowMode,
  WorkflowUiMessage,
} from "../../../types/workflow.types";
import type { EcommerceOneClickSessionState } from "../../../stores/ecommerceOneClick.store";
import { executeSkill } from "../../../services/skills";
import { generateJsonResponse } from "../../../services/gemini";
import {
  analyzeCompetitorDeckImageRaw,
  analyzeEcommerceCompetitorDecks,
  runCompetitorVisionSmokeTest,
} from "../../../services/ecommerce-competitor-analysis";
import { persistEcommerceWorkflowDebugSnapshot } from "../../../services/ecommerce-workflow-debug";
import {
  extractCompetitorDeckFromUrl,
  fetchCompetitorImportImageFile,
  type ExtractedCompetitorDeck,
} from "../../../services/ecommerce-competitor-import";
import { getPersonalCompetitorBrowserClientId } from "../../../services/competitor-browser-personal-auth";
import { smartEditSkill } from "../../../services/skills/smart-edit.skill";
import {
  buildTopicAssetUrl,
  resolveTopicAssetRefUrl,
  saveTopicAssetFromFile,
} from "../../../services/topic-memory";
import { splitEcommerceImageAnalysisTextFieldList } from "../../../utils/ecommerce-image-analysis";
import {
  getOrderedOverlayLayers,
  getOverlayLayerVisibilityMap,
  buildOverlaySectionOrder,
  getSmartOverlayPreset,
  normalizeOverlayLayers,
  getOverlayDecorationProfile,
  getOverlayPanelBox,
  getOverlaySemanticMeta,
} from "../../../utils/ecommerce-overlay-layout";
import {
  exportOverlayImagesZip,
  OVERLAY_PLATFORM_PRESET_OPTIONS,
} from "../../../utils/ecommerce-overlay-production";
import { getDefaultEcommercePlanRatio } from "../../../utils/ecommerce-plan-ratio";
import {
  buildEcommerceTextLayerPlan,
  type EcommerceTextAnchorHint,
} from "../../../utils/ecommerce-text-layer-plan";
import {
  buildOldFlowDirectTextPrincipleLines,
  buildOldFlowPlanningContextBlock,
  buildOldFlowPromptPolishLines,
  buildOldFlowSingleImagePrincipleLines,
} from "../../../utils/ecommerce-old-flow-prompt";
import { buildCompetitorPlanningContextFromRawImageAnalyses } from "../../../utils/ecommerce-competitor-planning";
import {
  buildLegacyLayoutIntentDefaults,
  buildLegacyPromptExecutionLines,
  buildLegacyPromptPrincipleLines,
  buildLegacyPromptProfile,
  buildLegacyPromptProfileLines,
  buildLegacyTypeTemplateLibraryBlock,
  inferLegacyPromptProfile,
  type LegacyPromptProfile,
  type LegacyPromptProfileId,
} from "../../../utils/ecommerce-old-flow-template-library";
import { uploadImage } from "../../../utils/uploader";

type EcommerceActions = {
  getSession: (sessionId: string) => EcommerceOneClickSessionState;
  reset: (sessionId?: string) => void;
  setStep: (
    step: EcommerceOneClickSessionState["step"],
    sessionId?: string,
  ) => void;
  setPlatformMode: (mode: EcommercePlatformMode, sessionId?: string) => void;
  setWorkflowMode: (mode: EcommerceWorkflowMode, sessionId?: string) => void;
  addProductImages: (
    images: EcommerceWorkflowImage[],
    sessionId?: string,
  ) => void;
  setCompetitorDecks: (
    decks: EcommerceCompetitorDeckInput[],
    sessionId?: string,
  ) => void;
  setCompetitorAnalyses: (
    analyses: EcommerceCompetitorDeckAnalysis[],
    sessionId?: string,
  ) => void;
  setCompetitorPlanningContext: (
    context: EcommerceCompetitorPlanningContext | null,
    sessionId?: string,
  ) => void;
  setDescription: (description: string, sessionId?: string) => void;
  setAnalysisSummary: (summary: string, sessionId?: string) => void;
  setAnalysisReview: (
    review: EcommerceAnalysisReview | null,
    sessionId?: string,
  ) => void;
  setAnalysisEvolutionProposals: (
    proposals: EcommerceArchetypeEvolutionProposal[],
    sessionId?: string,
  ) => void;
  setRecommendedTypes: (
    items: EcommerceRecommendedType[],
    sessionId?: string,
  ) => void;
  setSupplementFields: (
    fields: EcommerceSupplementField[],
    sessionId?: string,
  ) => void;
  setImageAnalyses: (
    items: EcommerceImageAnalysis[],
    sessionId?: string,
  ) => void;
  setImageAnalysisReview: (
    review: EcommerceStageReview | null,
    sessionId?: string,
  ) => void;
  setPlanGroups: (groups: EcommercePlanGroup[], sessionId?: string) => void;
  setPlanReview: (
    review: EcommerceStageReview | null,
    sessionId?: string,
  ) => void;
  setModelOptions: (
    models: EcommerceOneClickSessionState["modelOptions"],
    sessionId?: string,
  ) => void;
  setSelectedModelId: (modelId: string | null, sessionId?: string) => void;
  setBatchJobs: (jobs: EcommerceBatchJob[], sessionId?: string) => void;
  setResults: (images: EcommerceResultItem[], sessionId?: string) => void;
  setEditingResultUrl: (url: string | null, sessionId?: string) => void;
  setOverlayPanelOpen: (open: boolean, sessionId?: string) => void;
  setPreferredOverlayTemplateId: (
    templateId: string | null,
    sessionId?: string,
  ) => void;
  setProgress: (
    progress: EcommerceOneClickSessionState["progress"],
    sessionId?: string,
  ) => void;
};

type HandleWorkflowSendArgs = {
  text: string;
  attachments: File[];
  platformMode?: EcommercePlatformMode;
  workflowMode?: EcommerceWorkflowMode;
};

type BatchRunOptions = {
  promptOnly?: boolean;
  promptOverrides?: Record<string, string>;
  targetPlanItemIds?: string[];
  preserveExistingResults?: boolean;
};

const COMPETITOR_DECK_IMPORT_MAX_IMAGES = 99;

type UseWorkspaceEcommerceWorkflowOptions = {
  addMessage: (message: ChatMessage) => void;
  ecommerceState: EcommerceOneClickSessionState;
  ecommerceActions: EcommerceActions;
  ensureEcommerceSession: () => string;
  setEcommerceWorkflowError: (message: string | null) => void;
  setInputBlocks: (blocks: InputBlock[]) => void;
  setIsTyping: (typing: boolean) => void;
};

const EMPTY_INPUT_BLOCKS: InputBlock[] = [
  { id: "init", type: "text", text: "" },
];

const createWorkflowMessageId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getTraceNow = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const getElapsedMs = (startedAt: number): number =>
  Math.max(0, Math.round(getTraceNow() - startedAt));

const logStep7Trace = (stage: string, payload: Record<string, unknown>) => {
  console.info(`[ecomStep7.generate] ${stage}`, payload);
};

const queueStep7RenderTrace = (
  stage: string,
  payload: Record<string, unknown>,
) => {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      logStep7Trace(stage, payload);
    });
    return;
  }

  logStep7Trace(stage, payload);
};

const TRANSIENT_ECOMMERCE_ASSET_URL_PATTERN = /^(?:blob:|data:)/i;

const sanitizeGeneratedAssetFileName = (value: string): string =>
  (value || "ecom-result")
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, " ")
    .trim() || "ecom-result";

const inferGeneratedImageExtension = (mimeType: string): string => {
  if (/png/i.test(mimeType)) return "png";
  if (/webp/i.test(mimeType)) return "webp";
  if (/jpe?g/i.test(mimeType)) return "jpg";
  if (/gif/i.test(mimeType)) return "gif";
  return "png";
};

const persistGeneratedResultAsset = async (
  sessionId: string,
  imageUrl: string,
  label?: string,
) => {
  if (!TRANSIENT_ECOMMERCE_ASSET_URL_PATTERN.test(imageUrl)) {
    return null;
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`result asset fetch failed: ${response.status}`);
  }

  const blob = await response.blob();
  const mimeType = blob.type || "image/png";
  const extension = inferGeneratedImageExtension(mimeType);
  const fileName = `${sanitizeGeneratedAssetFileName(label || "ecom-result")}.${extension}`;
  const file = new File([blob], fileName, { type: mimeType });

  return saveTopicAssetFromFile(sessionId, "result", file);
};

const PLAN_ITEMS_MIN_BY_MODE: Record<EcommerceWorkflowMode, number> = {
  professional: 4,
  quick: 3,
};

const PLAN_ITEMS_MAX_PER_GROUP = 8;

const getTargetPlanItemCount = (
  imageCount: number | null | undefined,
  workflowMode: EcommerceWorkflowMode,
): number => {
  const min = PLAN_ITEMS_MIN_BY_MODE[workflowMode] || 3;
  const safeCount = Number.isFinite(imageCount) ? Number(imageCount) : min;
  return Math.max(min, Math.min(PLAN_ITEMS_MAX_PER_GROUP, Math.round(safeCount)));
};

const normalizeRecommendedTypes = (
  value: unknown,
): EcommerceRecommendedType[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is EcommerceRecommendedType =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as { id?: unknown }).id === "string" &&
          typeof (item as { title?: unknown }).title === "string" &&
          typeof (item as { description?: unknown }).description === "string" &&
          typeof (item as { imageCount?: unknown }).imageCount === "number" &&
          Array.isArray((item as { platformTags?: unknown }).platformTags),
      )
    : [];

const normalizeAnalysisReview = (
  value: unknown,
): EcommerceAnalysisReview | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    confidence?: unknown;
    verdict?: unknown;
    reviewerNotes?: unknown;
    risks?: unknown;
    source?: unknown;
    usedFallback?: unknown;
    fallbackReason?: unknown;
  };

  if (
    (candidate.confidence !== "high" &&
      candidate.confidence !== "medium" &&
      candidate.confidence !== "low") ||
    typeof candidate.verdict !== "string" ||
    !Array.isArray(candidate.reviewerNotes)
  ) {
    return null;
  }

  return {
    confidence: candidate.confidence,
    verdict: candidate.verdict,
    reviewerNotes: candidate.reviewerNotes.filter(
      (item): item is string => typeof item === "string",
    ),
    risks: Array.isArray(candidate.risks)
      ? candidate.risks.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    source:
      candidate.source === "ai" || candidate.source === "fallback"
        ? candidate.source
        : undefined,
    usedFallback:
      typeof candidate.usedFallback === "boolean"
        ? candidate.usedFallback
        : undefined,
    fallbackReason:
      typeof candidate.fallbackReason === "string"
        ? candidate.fallbackReason
        : undefined,
  };
};

const normalizeAnalysisEvolutionProposals = (
  value: unknown,
): EcommerceArchetypeEvolutionProposal[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is EcommerceArchetypeEvolutionProposal =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { candidateId?: unknown }).candidateId === "string" &&
        typeof (item as { label?: unknown }).label === "string" &&
        typeof (item as { appliesWhen?: unknown }).appliesWhen === "string" &&
        typeof (item as { whyCurrentArchetypesFail?: unknown })
          .whyCurrentArchetypesFail === "string" &&
        Array.isArray(
          (item as { proposedDecisionFactors?: unknown })
            .proposedDecisionFactors,
        ) &&
        Array.isArray((item as { proposedMustShow?: unknown }).proposedMustShow) &&
        Array.isArray(
          (item as { proposedVisualProofGrammar?: unknown })
            .proposedVisualProofGrammar,
        ) &&
        Array.isArray((item as { boundaryExamples?: unknown }).boundaryExamples) &&
        ((item as { confidence?: unknown }).confidence === "high" ||
          (item as { confidence?: unknown }).confidence === "medium" ||
          (item as { confidence?: unknown }).confidence === "low"),
    )
    .map((item) => ({
      ...item,
      proposedDecisionFactors: item.proposedDecisionFactors.filter(
        (entry): entry is string => typeof entry === "string",
      ),
      proposedMustShow: item.proposedMustShow.filter(
        (entry): entry is string => typeof entry === "string",
      ),
      proposedVisualProofGrammar: item.proposedVisualProofGrammar.filter(
        (entry): entry is string => typeof entry === "string",
      ),
      boundaryExamples: item.boundaryExamples.filter(
        (entry): entry is string => typeof entry === "string",
      ),
    }));
};

const normalizeStageReview = (value: unknown): EcommerceStageReview | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    confidence?: unknown;
    verdict?: unknown;
    reviewerNotes?: unknown;
    risks?: unknown;
    source?: unknown;
    usedFallback?: unknown;
    fallbackReason?: unknown;
  };

  if (
    (candidate.confidence !== "high" &&
      candidate.confidence !== "medium" &&
      candidate.confidence !== "low") ||
    typeof candidate.verdict !== "string" ||
    !Array.isArray(candidate.reviewerNotes)
  ) {
    return null;
  }

  return {
    confidence: candidate.confidence,
    verdict: candidate.verdict,
    reviewerNotes: candidate.reviewerNotes.filter(
      (item): item is string => typeof item === "string",
    ),
    risks: Array.isArray(candidate.risks)
      ? candidate.risks.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    source:
      candidate.source === "ai" || candidate.source === "fallback"
        ? candidate.source
        : undefined,
    usedFallback:
      typeof candidate.usedFallback === "boolean"
        ? candidate.usedFallback
        : undefined,
    fallbackReason:
      typeof candidate.fallbackReason === "string"
        ? candidate.fallbackReason
        : undefined,
  };
};

const normalizeSupplementFields = (
  value: unknown,
): EcommerceSupplementField[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenIds = new Map<string, number>();

  return value
    .filter(
      (item): item is EcommerceSupplementField =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { id?: unknown }).id === "string" &&
        typeof (item as { label?: unknown }).label === "string" &&
        typeof (item as { kind?: unknown }).kind === "string",
    )
    .map((field, index) => {
      const rawId = String(field.id || "").trim() || `supplement_field_${index + 1}`;
      const seenCount = (seenIds.get(rawId) || 0) + 1;
      seenIds.set(rawId, seenCount);

      return {
        ...field,
        id: seenCount === 1 ? rawId : `${rawId}__${seenCount}`,
        required: field.kind === "image" ? false : Boolean(field.required),
        options: Array.isArray(field.options)
          ? Array.from(
              new Set(
                field.options
                  .map((option) => String(option || "").trim())
                  .filter(Boolean),
              ),
            )
          : field.options,
        valueSource:
          field.valueSource === "user" ||
          field.valueSource === "ai" ||
          field.valueSource === "estimated"
            ? field.valueSource
            : undefined,
        valueConfidence:
          field.valueConfidence === "high" ||
          field.valueConfidence === "medium" ||
          field.valueConfidence === "low"
            ? field.valueConfidence
            : undefined,
        valueNote:
          typeof field.valueNote === "string" ? field.valueNote : undefined,
      };
    });
};

const normalizeImageAnalyses = (value: unknown): EcommerceImageAnalysis[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is EcommerceImageAnalysis =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as { imageId?: unknown }).imageId === "string" &&
          typeof (item as { title?: unknown }).title === "string" &&
          typeof (item as { description?: unknown }).description === "string",
      )
    : [];

const normalizePlanGroups = (value: unknown): EcommercePlanGroup[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is EcommercePlanGroup =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as { typeId?: unknown }).typeId === "string" &&
          typeof (item as { typeTitle?: unknown }).typeTitle === "string" &&
          Array.isArray((item as { items?: unknown }).items),
      )
    : [];

const buildDefaultAnalysisReview = (
  recommendedTypes: EcommerceRecommendedType[],
  context: "initial" | "refine",
): EcommerceAnalysisReview => ({
  confidence:
    recommendedTypes.length >= 5 &&
    recommendedTypes.some((item) => item.required || item.priority === "high")
      ? "medium"
      : "low",
  verdict:
    context === "refine"
      ? "已完成重新复核，请重点确认推荐类型是否更贴近你的业务目标。"
      : "已完成基础复核，可继续确认推荐类型并进入下一步。",
  reviewerNotes: [
    `当前保留 ${recommendedTypes.length} 类推荐出图方向。`,
    recommendedTypes.some((item) => item.required)
      ? "已包含至少一类平台必需图型。"
      : "当前没有显式平台必需图型，建议人工确认是否要补标准主图或白底图。",
  ],
  risks: [],
  source: "fallback",
  usedFallback: true,
  fallbackReason:
    context === "refine"
      ? "分析复核未返回可用结构，当前展示的是基础复核结果。"
      : "商品分析复核未返回可用结构，当前展示的是基础复核结果。",
});

const buildDefaultStageReview = (
  kind: "image" | "plan",
  count: number,
): EcommerceStageReview => ({
  confidence: count >= 1 ? "medium" : "low",
  verdict:
    kind === "image"
      ? "已完成基础图片复核，请重点确认哪些商品图最适合做后续参考图。"
      : "已完成基础方案复核，请重点确认每组图是否真的服务于当前平台转化目标。",
  reviewerNotes: [
    kind === "image"
      ? `当前共整理 ${count} 张商品图分析结果。`
      : `当前共整理 ${count} 个方案分组。`,
  ],
  risks: [],
  source: "fallback",
  usedFallback: true,
  fallbackReason:
    kind === "image"
      ? "图片复核未返回可用结构，当前展示的是基础复核结果。"
      : "方案复核未返回可用结构，当前展示的是基础复核结果。",
});

const classifyGenerationFailure = (error: unknown): string => {
  const message = getErrorMessage(error, "生成失败，请稍后重试。");
  const normalized = message.toLowerCase();

  if (
    /reference|参考图|anchor|image input|image too large|图片/.test(message)
  ) {
    return `参考图条件异常：${message}。建议检查参考图数量、清晰度或是否缺少关键角度。`;
  }
  if (/prompt|提示词|safety|policy/.test(normalized + message)) {
    return `提示词阶段失败：${message}。建议缩短提示词、去掉高风险描述，或先用 AI 改写后再试。`;
  }
  if (/ratio|aspect|尺寸|size/.test(normalized + message)) {
    return `画幅或尺寸设置可能不兼容：${message}。建议改用 1:1、3:4 或 4:5 后重试。`;
  }
  if (/timeout|timed out|network|fetch/.test(normalized)) {
    return `生成服务超时或网络异常：${message}。建议直接重试当前任务。`;
  }

  return `生成失败：${message}。建议检查模型、提示词和参考图后再试。`;
};

const getEmptyRequiredSupplementFields = (
  fields: EcommerceSupplementField[],
): EcommerceSupplementField[] =>
  fields.filter((field) => {
    if (!field.required || field.kind === "image") {
      return false;
    }
    if (Array.isArray(field.value)) {
      return (
        field.value.length === 0 ||
        !field.value.some((item) => {
          const text = String(item || "").trim();
          return text.length > 0 && !isPlaceholderSupplementValue(text);
        })
      );
    }
    const text = String(field.value || "").trim();
    return !text || isPlaceholderSupplementValue(text);
  });

const LEGACY_AUTOFILLABLE_SUPPLEMENT_DEFAULTS: Record<string, string[]> = {
  texture_direction: ["轻薄水润", "清透啫喱感"],
  brand_tone: ["医美专业感"],
  finish_direction: ["清透自然"],
  style_direction: ["暖感疗愈风"],
};

const isPlaceholderSupplementValue = (value?: string) => {
  const text = String(value || "").trim();
  if (!text) return false;

  return /请补充|参数请补充|其他参数|其余参数|待补充|后续补充|信息不足|建议后续覆盖|保守估填|保守估计|先做猜测补全|先按.*理解|先按.*规划/.test(
    text,
  );
};

const sanitizeSupplementFields = (
  fields: EcommerceSupplementField[],
): EcommerceSupplementField[] =>
  fields.map((field) => {
    if (field.kind === "image") {
      return field;
    }

    if (Array.isArray(field.value)) {
      const nextValues = field.value.filter((item) => {
        const text = String(item || "").trim();
        return text.length > 0 && !isPlaceholderSupplementValue(text);
      });

      if (nextValues.length === field.value.length) {
        return field;
      }

      return {
        ...field,
        value: nextValues,
      };
    }

    const text = String(field.value || "").trim();
    if (!text || !isPlaceholderSupplementValue(text)) {
      return field;
    }

    return {
      ...field,
      value: "",
    };
  });

const mergeAutofilledSupplementFields = (
  baseFields: EcommerceSupplementField[],
  incomingFields: EcommerceSupplementField[],
): EcommerceSupplementField[] =>
  baseFields.map((field) => {
    const incoming = incomingFields.find((candidate) => candidate.id === field.id);
    if (!incoming || field.kind === "image") {
      return field;
    }
    const currentText = Array.isArray(field.value)
      ? ""
      : String(field.value || "").trim();
    const isLegacyDefaultValue =
      currentText.length > 0 &&
      (LEGACY_AUTOFILLABLE_SUPPLEMENT_DEFAULTS[field.id] || []).includes(
        currentText,
      );
    const canOverwriteExistingValue =
      field.valueSource === "ai" ||
      field.valueSource === "estimated" ||
      isLegacyDefaultValue;
    if (
      Array.isArray(field.value)
        ? field.value.some((item) => String(item || "").trim().length > 0) &&
          !canOverwriteExistingValue
        : currentText.length > 0 && !canOverwriteExistingValue
    ) {
      return field;
    }

    if (field.kind === "multi-select") {
      const incomingValues = Array.isArray(incoming.value)
        ? incoming.value
            .map((item) => String(item || "").trim())
            .filter(
              (item) =>
                item.length > 0 && !isPlaceholderSupplementValue(item),
            )
        : typeof incoming.value === "string" && incoming.value.trim().length > 0
          ? isPlaceholderSupplementValue(incoming.value.trim())
            ? []
            : [incoming.value.trim()]
          : [];
      if (incomingValues.length === 0) {
        return field;
      }
      const nextOptions = Array.from(
        new Set([...(field.options || []), ...incomingValues]),
      );
      return {
        ...field,
        options: nextOptions,
        value: incomingValues.slice(0, field.maxItems || incomingValues.length),
        valueSource: incoming.valueSource || "estimated",
        valueConfidence: incoming.valueConfidence,
        valueNote: incoming.valueNote,
      };
    }

    const incomingText = Array.isArray(incoming.value)
      ? String(incoming.value[0] || "").trim()
      : String(incoming.value || "").trim();
    if (!incomingText || isPlaceholderSupplementValue(incomingText)) {
      return field;
    }

    if (field.kind === "single-select") {
      return {
        ...field,
        options: Array.from(new Set([...(field.options || []), incomingText])),
        value: incomingText,
        valueSource: incoming.valueSource || "estimated",
        valueConfidence: incoming.valueConfidence,
        valueNote: incoming.valueNote,
      };
    }

    return {
      ...field,
      value: incomingText,
      valueSource: incoming.valueSource || "estimated",
      valueConfidence: incoming.valueConfidence,
      valueNote: incoming.valueNote,
    };
  });

const mergeAutofilledImageAnalyses = (
  baseItems: EcommerceImageAnalysis[],
  incomingItems: EcommerceImageAnalysis[],
): EcommerceImageAnalysis[] =>
  baseItems.map((item) => {
    const incoming = incomingItems.find(
      (candidate) => candidate.imageId === item.imageId,
    );
    if (!incoming) {
      return item;
    }

    return {
      ...item,
      title: incoming.title || item.title,
      description: incoming.description || item.description,
      analysisConclusion:
        incoming.analysisConclusion || item.analysisConclusion,
      angle: incoming.angle || item.angle,
      usableAsReference:
        typeof incoming.usableAsReference === "boolean"
          ? incoming.usableAsReference
          : item.usableAsReference,
      highlights:
        incoming.highlights && incoming.highlights.length > 0
          ? incoming.highlights
          : item.highlights,
      materials:
        incoming.materials && incoming.materials.length > 0
          ? incoming.materials
          : item.materials,
      confidence: incoming.confidence || item.confidence,
      evidence:
        incoming.evidence && incoming.evidence.length > 0
          ? incoming.evidence
          : item.evidence,
      source: incoming.source || item.source,
      usedFallback:
        typeof incoming.usedFallback === "boolean"
          ? incoming.usedFallback
          : item.usedFallback,
      fallbackReason: incoming.fallbackReason || item.fallbackReason,
    };
  });

const sanitizeImageAnalysesForWorkflow = (
  items: EcommerceImageAnalysis[],
): EcommerceImageAnalysis[] => splitEcommerceImageAnalysisTextFieldList(items);

const mergeAutofilledPlanGroups = (
  baseGroups: EcommercePlanGroup[],
  incomingGroups: EcommercePlanGroup[],
): EcommercePlanGroup[] =>
  baseGroups.map((group) => {
    const incomingGroup = incomingGroups.find(
      (candidate) => candidate.typeId === group.typeId,
    );
    if (!incomingGroup) {
      return group;
    }

    return {
      ...group,
      typeTitle: incomingGroup.typeTitle || group.typeTitle,
      summary: incomingGroup.summary || group.summary,
      strategy:
        incomingGroup.strategy && incomingGroup.strategy.length > 0
          ? incomingGroup.strategy
          : group.strategy,
      platformTags:
        incomingGroup.platformTags && incomingGroup.platformTags.length > 0
          ? incomingGroup.platformTags
          : group.platformTags,
      priority: incomingGroup.priority || group.priority,
      source: incomingGroup.source || group.source,
      usedFallback:
        typeof incomingGroup.usedFallback === "boolean"
          ? incomingGroup.usedFallback
          : group.usedFallback,
      fallbackReason: incomingGroup.fallbackReason || group.fallbackReason,
      items: group.items.map((item) => {
        const incomingItem = incomingGroup.items.find(
          (candidate) => candidate.id === item.id,
        );
        if (!incomingItem) {
          return item;
        }
        return {
          ...item,
          title: incomingItem.title || item.title,
          description: incomingItem.description || item.description,
          promptOutline: incomingItem.promptOutline || item.promptOutline,
          ratio: incomingItem.ratio || item.ratio,
          marketingGoal: incomingItem.marketingGoal || item.marketingGoal,
          keyMessage: incomingItem.keyMessage || item.keyMessage,
          mustShow:
            incomingItem.mustShow && incomingItem.mustShow.length > 0
              ? incomingItem.mustShow
              : item.mustShow,
          composition: incomingItem.composition || item.composition,
          styling: incomingItem.styling || item.styling,
          background: incomingItem.background || item.background,
          lighting: incomingItem.lighting || item.lighting,
          platformFit:
            incomingItem.platformFit && incomingItem.platformFit.length > 0
              ? incomingItem.platformFit
              : item.platformFit,
          riskNotes:
            incomingItem.riskNotes && incomingItem.riskNotes.length > 0
              ? incomingItem.riskNotes
              : item.riskNotes,
        };
      }),
    };
  });

const buildBatchJobs = (
  groups: EcommercePlanGroup[],
  previousJobs: EcommerceBatchJob[] = [],
  platformMode?: EcommercePlatformMode,
): EcommerceBatchJob[] => {
  const previousJobByPlanItemId = new Map(
    previousJobs.map((job) => [job.planItemId, job]),
  );

  return groups.flatMap((group) =>
    group.items.map((item) => {
      const previousJob = previousJobByPlanItemId.get(item.id);
      const layoutSnapshot = buildLayoutSnapshotFromPlanItem(group, item);
      const currentAspectRatio = getDefaultEcommercePlanRatio({
        platformMode,
        typeId: group.typeId,
        typeTitle: group.typeTitle,
        itemTitle: item.title,
        itemDescription: item.description,
        preferredRatio: item.ratio,
      });
      const previousAspectRatio =
        previousJob?.generationMeta?.aspectRatio ||
        previousJob?.results?.[0]?.generationMeta?.aspectRatio ||
        "1:1";
      const isExecutionInputChanged =
        previousJob?.prompt !== item.promptOutline ||
        previousJob?.title !== item.title ||
        previousAspectRatio !== currentAspectRatio;

      return {
        id: `ecom-job-${group.typeId}-${item.id}`,
        planItemId: item.id,
        title: item.title,
        prompt: item.promptOutline,
        layoutSnapshot,
        status: isExecutionInputChanged ? "idle" : previousJob?.status || "idle",
        promptStatus: isExecutionInputChanged
          ? "idle"
          : previousJob?.promptStatus ||
            (previousJob?.finalPrompt ? "done" : "idle"),
        imageStatus: isExecutionInputChanged
          ? "idle"
          : previousJob?.imageStatus || previousJob?.status || "idle",
        finalPrompt: isExecutionInputChanged ? undefined : previousJob?.finalPrompt,
        results: isExecutionInputChanged
          ? []
          : (previousJob?.results || []).map((result) =>
              seedResultItemFromPlan({
                result,
                group,
                item,
              }),
            ),
        error: isExecutionInputChanged ? undefined : previousJob?.error,
        generationMeta: {
          ...(isExecutionInputChanged ? {} : previousJob?.generationMeta),
          aspectRatio: currentAspectRatio,
        },
      };
    }),
  );
};

const syncPlanGroupReferences = (
  groups: EcommercePlanGroup[],
  analyses: EcommerceImageAnalysis[],
): EcommercePlanGroup[] => {
  const usableReferenceIds = analyses
    .filter((item) => item.usableAsReference)
    .map((item) => item.imageId);
  const usableReferenceIdSet = new Set(usableReferenceIds);

  return groups.map((group) => ({
    ...group,
    items: group.items.map((planItem) => ({
      ...planItem,
      referenceImageIds:
        planItem.referenceImageIds.length > 0
          ? planItem.referenceImageIds.filter((imageId) =>
              usableReferenceIdSet.has(imageId),
            )
          : usableReferenceIds.slice(0, MAX_GENERATION_REFERENCE_IMAGES),
    })),
  }));
};

const collectBatchResults = (
  jobs: EcommerceBatchJob[],
): EcommerceResultItem[] =>
  jobs.flatMap((job) =>
    (job.results || []).map((result) => ({
      assetId: result.assetId,
      url: result.url,
      label: result.label || job.title,
      review: result.review,
      generationMeta: result.generationMeta || job.generationMeta,
      layoutMeta: result.layoutMeta || cloneLayoutSnapshot(job.layoutSnapshot),
      overlayState: result.overlayState,
    })),
  );

const cloneLayoutSnapshot = (
  value?: EcommerceLayoutSnapshot,
): EcommerceLayoutSnapshot | undefined =>
  value
    ? {
        ...value,
        reservedAreas: value.reservedAreas ? [...value.reservedAreas] : value.reservedAreas,
      }
    : undefined;

const cloneOverlayStatList = (
  items?: EcommerceOverlayStat[],
): EcommerceOverlayStat[] | undefined =>
  items ? items.map((item) => ({ ...item })) : items;

const cloneOverlayComparisonRows = (
  rows?: EcommerceOverlayComparisonRow[],
): EcommerceOverlayComparisonRow[] | undefined =>
  rows ? rows.map((row) => ({ ...row })) : rows;

const cloneOverlayLayers = (
  layers?: EcommerceOverlayLayer[],
): EcommerceOverlayLayer[] | undefined =>
  layers ? layers.map((layer) => ({ ...layer })) : layers;

const cloneTextContainerIntents = (
  items?: EcommerceTextContainerIntent[],
): EcommerceTextContainerIntent[] | undefined =>
  items ? items.map((item) => ({ ...item })) : items;

const normalizeLayoutReservedAreas = (
  items?: EcommerceLayoutAreaKind[],
): EcommerceLayoutAreaKind[] | undefined => {
  const normalized = Array.from(
    new Set(
      (items || [])
        .map((item) => String(item || "").trim())
        .filter(Boolean) as EcommerceLayoutAreaKind[],
    ),
  );
  return normalized.length > 0 ? normalized : undefined;
};

const buildLayoutSnapshotFromPlanItem = (
  group: EcommercePlanGroup,
  item: EcommercePlanGroup["items"][number],
): EcommerceLayoutSnapshot => ({
  sourcePlanItemId: item.id,
  typeId: group.typeId,
  typeTitle: group.typeTitle,
  imageRole: item.layoutIntent?.imageRole,
  layoutMode: item.layoutIntent?.layoutMode,
  componentNeed: item.layoutIntent?.componentNeed,
  reservedAreas: normalizeLayoutReservedAreas(item.layoutIntent?.reservedAreas),
});

const hasCopyPlanContent = (copyPlan?: EcommerceCopyPlan): boolean =>
  Boolean(
    String(copyPlan?.badge || "").trim() ||
      String(copyPlan?.headline || "").trim() ||
      String(copyPlan?.subheadline || "").trim() ||
      String(copyPlan?.priceLabel || "").trim() ||
      String(copyPlan?.priceValue || "").trim() ||
      String(copyPlan?.priceNote || "").trim() ||
      (copyPlan?.featureTags && copyPlan.featureTags.length > 0) ||
      (copyPlan?.bullets && copyPlan.bullets.length > 0) ||
      (copyPlan?.stats && copyPlan.stats.length > 0) ||
      String(copyPlan?.comparisonTitle || "").trim() ||
      (copyPlan?.comparisonRows && copyPlan.comparisonRows.length > 0) ||
      String(copyPlan?.cta || "").trim(),
  );

const getDefaultAreaForOverlayRole = (
  role: EcommerceOverlayLayerKind,
): EcommerceLayoutAreaKind => {
  switch (role) {
    case "headline":
      return "headline";
    case "subheadline":
      return "subheadline";
    case "stats":
      return "stats";
    case "comparison":
      return "comparison";
    case "badge":
    case "featureTags":
      return "annotation";
    case "price":
    case "bullets":
    case "cta":
    default:
      return "body";
  }
};

const getDefaultIntentPriorityForRole = (
  role: EcommerceOverlayLayerKind,
): EcommerceTextContainerIntent["priority"] =>
  role === "headline" || role === "price" || role === "cta"
    ? "primary"
    : role === "subheadline" || role === "featureTags"
      ? "secondary"
      : "support";

const getOverlayLayerContentKinds = (options: {
  headline?: string;
  subheadline?: string;
  badge?: string;
  priceLabel?: string;
  priceValue?: string;
  priceNote?: string;
  featureTags: string[];
  bullets: string[];
  stats: EcommerceOverlayStat[];
  comparisonTitle?: string;
  comparisonRows: EcommerceOverlayComparisonRow[];
  cta?: string;
}): EcommerceOverlayLayerKind[] => {
  const kinds: EcommerceOverlayLayerKind[] = [];
  if (String(options.badge || "").trim()) kinds.push("badge");
  if (String(options.headline || "").trim()) kinds.push("headline");
  if (String(options.subheadline || "").trim()) kinds.push("subheadline");
  if (options.featureTags.length > 0) kinds.push("featureTags");
  if (
    String(options.priceLabel || "").trim() ||
    String(options.priceValue || "").trim() ||
    String(options.priceNote || "").trim()
  ) {
    kinds.push("price");
  }
  if (options.stats.length > 0) kinds.push("stats");
  if (
    String(options.comparisonTitle || "").trim() ||
    options.comparisonRows.length > 0
  ) {
    kinds.push("comparison");
  }
  if (options.bullets.length > 0) kinds.push("bullets");
  if (String(options.cta || "").trim()) kinds.push("cta");
  return kinds;
};

const buildPreferredTextContainerIntents = (options: {
  copyPlan?: EcommerceCopyPlan;
  itemTextContainerIntents?: EcommerceTextContainerIntent[];
  previousTextContainerIntents?: EcommerceTextContainerIntent[];
}): EcommerceTextContainerIntent[] | undefined => {
  const {
    copyPlan,
    itemTextContainerIntents,
    previousTextContainerIntents,
  } = options;
  const preferredRoles = hasCopyPlanContent(copyPlan)
    ? getOverlayLayerContentKinds({
        headline: copyPlan?.headline,
        subheadline: copyPlan?.subheadline,
        badge: copyPlan?.badge,
        priceLabel: copyPlan?.priceLabel,
        priceValue: copyPlan?.priceValue,
        priceNote: copyPlan?.priceNote,
        featureTags: copyPlan?.featureTags || [],
        bullets: copyPlan?.bullets || [],
        stats: copyPlan?.stats || [],
        comparisonTitle: copyPlan?.comparisonTitle,
        comparisonRows: copyPlan?.comparisonRows || [],
        cta: copyPlan?.cta,
      })
    : [];

  const source =
    cloneTextContainerIntents(previousTextContainerIntents) ||
    cloneTextContainerIntents(itemTextContainerIntents) ||
    [];

  if (preferredRoles.length === 0) {
    return source.length > 0 ? source : undefined;
  }

  const sourceByRole = new Map(
    source.map((item) => [item.role, item] as const),
  );

  return preferredRoles.map((role, index) => {
    const existing = sourceByRole.get(role);
    return {
      id: existing?.id || `direct-text-${role}-${index + 1}`,
      role,
      area: existing?.area || getDefaultAreaForOverlayRole(role),
      replacementMode: "replace-generated-text",
      priority: existing?.priority || getDefaultIntentPriorityForRole(role),
      maxLines: existing?.maxLines,
      maxChars: existing?.maxChars,
      textAlign: existing?.textAlign,
      placementHint: existing?.placementHint,
    };
  });
};

const cloneOverlayState = (
  value?: EcommerceOverlayState,
): EcommerceOverlayState | undefined =>
  value
    ? {
        ...value,
        replacementQuality: value.replacementQuality
          ? { ...value.replacementQuality }
          : value.replacementQuality,
        featureTags: value.featureTags ? [...value.featureTags] : value.featureTags,
        bullets: value.bullets ? [...value.bullets] : value.bullets,
        stats: cloneOverlayStatList(value.stats),
        comparisonRows: cloneOverlayComparisonRows(value.comparisonRows),
        layers: cloneOverlayLayers(value.layers),
        textContainerIntents: cloneTextContainerIntents(value.textContainerIntents),
      }
    : undefined;

const cloneResultItems = (items: EcommerceResultItem[]): EcommerceResultItem[] =>
  items.map((item) => ({
    ...item,
    generationMeta: item.generationMeta
      ? {
          ...item.generationMeta,
          attemptedModels: item.generationMeta.attemptedModels
            ? [...item.generationMeta.attemptedModels]
            : item.generationMeta.attemptedModels,
        }
      : item.generationMeta,
    review: item.review
      ? {
          ...item.review,
          strengths: [...item.review.strengths],
          issues: [...item.review.issues],
        }
      : item.review,
    layoutMeta: cloneLayoutSnapshot(item.layoutMeta),
    overlayState: cloneOverlayState(item.overlayState),
  }));

const normalizeOverlayState = (
  value: EcommerceOverlayState | null | undefined,
  previous?: EcommerceOverlayState,
): EcommerceOverlayState | undefined => {
  if (!value) {
    return undefined;
  }

  const featureTags = (value.featureTags || [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const bullets = (value.bullets || [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const stats = (value.stats || [])
    .map((item) => ({
      label: String(item.label || "").trim(),
      value: String(item.value || "").trim(),
    }))
    .filter((item) => item.label || item.value);
  const comparisonRows = (value.comparisonRows || [])
    .map((item) => ({
      label: String(item.label || "").trim(),
      before: String(item.before || "").trim() || undefined,
      after: String(item.after || "").trim(),
    }))
    .filter((item) => item.label || item.before || item.after);
  const textContainerIntents = cloneTextContainerIntents(value.textContainerIntents)
    ?.map((item) => ({
      ...item,
      id: String(item.id || "").trim(),
      placementHint: String(item.placementHint || "").trim() || undefined,
    }))
    .filter((item) => item.id && item.role);

  const hasContent = Boolean(
    String(value.headline || "").trim() ||
      String(value.subheadline || "").trim() ||
      String(value.badge || "").trim() ||
      String(value.priceLabel || "").trim() ||
      String(value.priceValue || "").trim() ||
      String(value.priceNote || "").trim() ||
      featureTags.length > 0 ||
      bullets.length > 0 ||
      stats.length > 0 ||
      String(value.comparisonTitle || "").trim() ||
      comparisonRows.length > 0 ||
      String(value.cta || "").trim(),
  );
  const visibleKinds = getOverlayLayerContentKinds({
    headline: value.headline,
    subheadline: value.subheadline,
    badge: value.badge,
    priceLabel: value.priceLabel,
    priceValue: value.priceValue,
    priceNote: value.priceNote,
    featureTags,
    bullets,
    stats,
    comparisonTitle: value.comparisonTitle,
    comparisonRows,
    cta: value.cta,
  });

  return {
    ...cloneOverlayState(previous),
    ...value,
    status: hasContent ? value.status || "draft" : "idle",
    templateId: value.templateId || previous?.templateId || "hero-left",
    stylePresetId: value.stylePresetId || previous?.stylePresetId,
    platformPresetId: value.platformPresetId || previous?.platformPresetId,
    headline: String(value.headline || "").trim() || undefined,
    subheadline: String(value.subheadline || "").trim() || undefined,
    badge: String(value.badge || "").trim() || undefined,
    priceLabel: String(value.priceLabel || "").trim() || undefined,
    priceValue: String(value.priceValue || "").trim() || undefined,
    priceNote: String(value.priceNote || "").trim() || undefined,
    featureTags,
    bullets,
    stats,
    comparisonTitle: String(value.comparisonTitle || "").trim() || undefined,
    comparisonRows,
    cta: String(value.cta || "").trim() || undefined,
    textAlign: value.textAlign || previous?.textAlign || "left",
    tone: value.tone || previous?.tone || "dark",
    bulletStyle: value.bulletStyle || previous?.bulletStyle || "list",
    renderStatus:
      "renderStatus" in value ? value.renderStatus : previous?.renderStatus,
    renderStatusMessage:
      "renderStatusMessage" in value
        ? String(value.renderStatusMessage || "").trim() || undefined
        : previous?.renderStatusMessage,
    replacementQuality:
      "replacementQuality" in value
        ? value.replacementQuality
          ? {
              ...value.replacementQuality,
              profileId: value.replacementQuality.profileId,
              sourceMode: value.replacementQuality.sourceMode,
              backgroundKind: value.replacementQuality.backgroundKind,
              eraseStrategy: value.replacementQuality.eraseStrategy,
              confidence: value.replacementQuality.confidence,
              anchorCount:
                typeof value.replacementQuality.anchorCount === "number"
                  ? value.replacementQuality.anchorCount
                  : undefined,
              replacementBoxCount:
                typeof value.replacementQuality.replacementBoxCount === "number"
                  ? value.replacementQuality.replacementBoxCount
                  : undefined,
              mergedBoxCount:
                typeof value.replacementQuality.mergedBoxCount === "number"
                  ? value.replacementQuality.mergedBoxCount
                  : undefined,
              summary:
                String(value.replacementQuality.summary || "").trim() || undefined,
            }
          : undefined
        : previous?.replacementQuality,
    renderedPersistence:
      "renderedPersistence" in value
        ? value.renderedPersistence
        : previous?.renderedPersistence,
    layers: normalizeOverlayLayers(
      value.layers || previous?.layers,
      hasContent ? { visibleKinds } : undefined,
    ),
    fontFamily: String(value.fontFamily || "").trim() || previous?.fontFamily,
    fontLabel: String(value.fontLabel || "").trim() || previous?.fontLabel,
    fontUrl: String(value.fontUrl || "").trim() || previous?.fontUrl,
    fontAssetId: value.fontAssetId || previous?.fontAssetId,
    featureTagIconUrl:
      String(value.featureTagIconUrl || "").trim() ||
      previous?.featureTagIconUrl,
    featureTagIconAssetId:
      value.featureTagIconAssetId || previous?.featureTagIconAssetId,
    featureTagIconLabel:
      String(value.featureTagIconLabel || "").trim() ||
      previous?.featureTagIconLabel,
    textContainerIntents:
      textContainerIntents && textContainerIntents.length > 0
        ? textContainerIntents
        : previous?.textContainerIntents,
    baseImageUrl:
      String(value.baseImageUrl || "").trim() || previous?.baseImageUrl,
    renderedImageUrl: value.renderedImageUrl || previous?.renderedImageUrl,
    renderedAssetId: value.renderedAssetId || previous?.renderedAssetId,
    renderedAt:
      "renderedAt" in value ? value.renderedAt : previous?.renderedAt,
    baseAssetId: value.baseAssetId || previous?.baseAssetId,
    lastEditedAt: Date.now(),
  };
};

const cloneBatchJobs = (jobs: EcommerceBatchJob[]): EcommerceBatchJob[] =>
  jobs.map((job) => ({
    ...job,
    generationMeta: job.generationMeta
      ? {
          ...job.generationMeta,
          attemptedModels: job.generationMeta.attemptedModels
            ? [...job.generationMeta.attemptedModels]
            : job.generationMeta.attemptedModels,
        }
      : job.generationMeta,
    layoutSnapshot: cloneLayoutSnapshot(job.layoutSnapshot),
    results: cloneResultItems(job.results || []),
  }));

const buildVersionedResultLabel = (
  title: string,
  existingResults: EcommerceResultItem[],
): string => {
  const nextVersion = Math.max(1, (existingResults || []).length + 1);
  return `${title} v${nextVersion}`;
};

const normalizePromptText = (value?: string): string =>
  String(value || "").replace(/\s+/g, " ").trim();

const buildPromptHash = (value?: string): string => {
  const normalized = normalizePromptText(value);
  if (!normalized) return "";
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return `p${hash.toString(36)}`;
};

const summarizePromptSnapshot = (value?: string, max = 120): string => {
  const normalized = normalizePromptText(value);
  if (!normalized) return "";
  return normalized.length > max
    ? `${normalized.slice(0, Math.max(0, max - 1))}…`
    : normalized;
};

const findPlanItem = (
  groups: EcommercePlanGroup[],
  planItemId: string,
): {
  group: EcommercePlanGroup;
  item: EcommercePlanGroup["items"][number];
} | null => {
  for (const group of groups) {
    const item = group.items.find((candidate) => candidate.id === planItemId);
    if (item) {
      return { group, item };
    }
  }
  return null;
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const summarizeSupplementFields = (
  fields: EcommerceSupplementField[],
): string => {
  const lines = fields
    .map((field) => {
      const rawValue =
        field.kind === "image" && Array.isArray(field.value)
          ? field.value.length > 0
            ? `已上传 ${field.value.length} 张补充图片`
            : ""
          : Array.isArray(field.value)
            ? field.value.join("、")
            : typeof field.value === "string"
              ? field.value.trim()
              : "";

      if (!rawValue || isPlaceholderSupplementValue(rawValue)) return null;
      return `${field.label}: ${rawValue}`;
    })
    .filter((line): line is string => Boolean(line));

  return lines.join("\n");
};

const summarizeSelectedTypes = (items: EcommerceRecommendedType[]): string =>
  items
    .filter((item) => item.selected)
    .map((item) => item.title)
    .join("、");

const MAX_GENERATION_REFERENCE_IMAGES = 3;

const buildSeedOverlayStateFromPlanItem = (options: {
  item: EcommercePlanGroup["items"][number];
  layoutMeta?: EcommerceLayoutSnapshot;
  previous?: EcommerceOverlayState;
  baseImageUrl?: string;
  baseAssetId?: string;
}): EcommerceOverlayState | undefined => {
  const { item, layoutMeta, previous, baseImageUrl, baseAssetId } = options;
  const copyPlan = item.copyPlan;
  const textContainerIntents = buildPreferredTextContainerIntents({
    copyPlan,
    itemTextContainerIntents: item.textContainerIntents,
    previousTextContainerIntents: previous?.textContainerIntents,
  });

  if (!hasCopyPlanContent(copyPlan) && (!textContainerIntents || textContainerIntents.length === 0)) {
    return normalizeOverlayState(previous, previous);
  }

  const smartPreset = getSmartOverlayPreset({
    layoutMeta,
    bulletCount: copyPlan?.bullets?.length || 0,
    featureTagCount: copyPlan?.featureTags?.length || 0,
    statCount: copyPlan?.stats?.length || 0,
    comparisonCount: copyPlan?.comparisonRows?.length || 0,
    hasPrice: Boolean(
      String(copyPlan?.priceLabel || "").trim() ||
        String(copyPlan?.priceValue || "").trim() ||
        String(copyPlan?.priceNote || "").trim(),
    ),
    headlineLength: String(copyPlan?.headline || "").trim().length,
    currentTemplateId: previous?.templateId || "hero-left",
    currentTone: previous?.tone || "dark",
  });

  return normalizeOverlayState(
    {
      ...copyPlan,
      ...previous,
      status:
        previous?.status === "applied"
          ? "draft"
          : previous?.status || "draft",
      templateId: previous?.templateId || smartPreset.templateId,
      tone: previous?.tone || smartPreset.tone,
      textAlign: previous?.textAlign || smartPreset.textAlign,
      bulletStyle: previous?.bulletStyle || smartPreset.bulletStyle,
      textContainerIntents,
      baseImageUrl: previous?.baseImageUrl || baseImageUrl,
      baseAssetId: previous?.baseAssetId || baseAssetId,
    },
    previous,
  );
};

const seedResultItemFromPlan = (options: {
  result: EcommerceResultItem;
  group: EcommercePlanGroup;
  item: EcommercePlanGroup["items"][number];
}): EcommerceResultItem => {
  const { result, group, item } = options;
  const layoutMeta =
    cloneLayoutSnapshot(result.layoutMeta) || buildLayoutSnapshotFromPlanItem(group, item);
  const overlayState = buildSeedOverlayStateFromPlanItem({
    item,
    layoutMeta,
    previous: result.overlayState,
    baseImageUrl: result.overlayState?.baseImageUrl || result.url,
    baseAssetId: result.overlayState?.baseAssetId || result.assetId,
  });

  return {
    ...result,
    layoutMeta,
    overlayState,
  };
};

const buildGenerationLayoutIntentText = (
  item: EcommercePlanGroup["items"][number],
): string[] => {
  const layoutMeta = item.layoutIntent;
  if (!layoutMeta) {
    return [];
  }

  const lines: string[] = [];
  if (layoutMeta.imageRole) {
    lines.push(`单图职责：这张图优先承担 ${layoutMeta.imageRole} 类型的详情页任务。`);
  }
  if (layoutMeta.layoutMode) {
    lines.push(`版式结构：优先生成适配 ${layoutMeta.layoutMode} 的构图，主体与信息区必须可分离。`);
  }
  if (layoutMeta.componentNeed) {
    lines.push(`信息负载：后续会叠加 ${layoutMeta.componentNeed} 类型的信息模块，画面不能被主体和装饰完全塞满。`);
  }
  if (layoutMeta.reservedAreas && layoutMeta.reservedAreas.length > 0) {
    lines.push(`预留区域：优先给 ${layoutMeta.reservedAreas.join("、")} 保留干净可编辑空间。`);
  }
  return lines;
};

const dedupePromptTextList = (
  items: Array<string | null | undefined>,
): string[] =>
  Array.from(
    new Set(
      items
        .map((item) => String(item || "").trim())
        .filter((item) => item.length > 0),
    ),
  );

const normalizeCompetitorHintText = (value: string): string =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "");

const COMPETITOR_ROLE_HINT_RULES: Array<{
  label: string;
  keywords: string[];
  executionLines: string[];
}> = [
  {
    label: "首屏承接位",
    keywords: ["hero", "首屏", "首图", "封面", "开场", "视觉锤"],
    executionLines: [
      "当前单图要承担首屏承接任务，先让商品第一眼立住，再交付主标题和第一卖点。",
      "构图优先大主体、强价值感和成熟电商首图气质，不要把首图做成说明页或细节页。",
    ],
  },
  {
    label: "白底卖点位",
    keywords: ["white-bg", "白底", "卖点", "平铺"],
    executionLines: [
      "当前单图更接近白底卖点位，要强调主体清楚、信息干净、卖点直接。",
      "白底或浅底要服务商品识别和结构理解，不要把画面做得像普通目录照。",
    ],
  },
  {
    label: "场景带入位",
    keywords: ["scene", "场景", "氛围", "使用"],
    executionLines: [
      "当前单图更接近场景带入位，要用场景解释商品如何被使用，而不是做纯氛围写真。",
      "文字和主体要顺着场景留白自然落位，让用户一眼看懂使用关系。",
    ],
  },
  {
    label: "对比说明位",
    keywords: ["comparison", "对比", "对照", "差异"],
    executionLines: [
      "当前单图更接近对比说明位，要把差异点落成可见证据，而不是只写结论。",
      "主商品必须更强，信息层级要让用户一眼读懂为什么它更好。",
    ],
  },
  {
    label: "细节证明位",
    keywords: ["detail", "细节", "特写", "做工", "材质"],
    executionLines: [
      "当前单图更接近细节证明位，要明确放大一个关键细节，让细节本身能自证价值。",
      "用镜头和光线把工艺、材质、结构边界打出来，不要靠长文案补救。",
    ],
  },
  {
    label: "参数规格位",
    keywords: ["spec", "参数", "规格", "尺寸"],
    executionLines: [
      "当前单图更接近参数规格位，要像高质量说明模块一样清楚理性。",
      "参数承载区和主体区必须分层稳定，避免文字和主体互相挤占。",
    ],
  },
  {
    label: "转化收口位",
    keywords: ["conversion", "cta", "转化", "下单", "背书", "保障"],
    executionLines: [
      "当前单图更接近转化收口位，要稳、值、可信，帮助用户完成下单前的最后确认。",
      "不要再开启新的复杂叙事，重点是收束信心和成交感。",
    ],
  },
  {
    label: "卖点展开位",
    keywords: ["selling", "卖点", "优势", "亮点"],
    executionLines: [
      "当前单图更接近卖点展开位，要围绕一个核心优势展开，不要一张图塞太多任务。",
      "卖点必须可视化，用户要在一眼内看到证据，而不是只看到形容词。",
    ],
  },
];

const getCompetitorRoleHint = (options: {
  sourceTexts: Array<string | null | undefined>;
  recommendedPageSequence: string[];
}): { label: string; matchedText: string; executionLines: string[] } | null => {
  const { sourceTexts, recommendedPageSequence } = options;
  if (!Array.isArray(recommendedPageSequence) || recommendedPageSequence.length === 0) {
    return null;
  }

  const source = normalizeCompetitorHintText(sourceTexts.filter(Boolean).join(" "));
  if (!source) {
    return null;
  }

  let bestMatch:
    | { label: string; matchedText: string; executionLines: string[]; score: number }
    | null = null;

  for (const candidate of recommendedPageSequence.slice(0, 8)) {
    const normalizedCandidate = normalizeCompetitorHintText(candidate);
    if (!normalizedCandidate) {
      continue;
    }

    for (const rule of COMPETITOR_ROLE_HINT_RULES) {
      const score = rule.keywords.reduce((sum, keyword) => {
        const normalizedKeyword = normalizeCompetitorHintText(keyword);
        const candidateMatched =
          normalizedCandidate.includes(normalizedKeyword) ||
          normalizedKeyword.includes(normalizedCandidate);
        const sourceMatched = source.includes(normalizedKeyword);
        return candidateMatched && sourceMatched ? sum + 1 : sum;
      }, 0);

      if (!score) {
        continue;
      }

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          label: rule.label,
          matchedText: candidate,
          executionLines: rule.executionLines,
          score,
        };
      }
    }
  }

  return bestMatch
    ? {
        label: bestMatch.label,
        matchedText: bestMatch.matchedText,
        executionLines: bestMatch.executionLines,
      }
    : null;
};

const buildCompetitorPlanningLines = (
  context: EcommerceCompetitorPlanningContext | null | undefined,
  mode: EcommerceCompetitorStrategyMode = "sequence-story",
): string[] => {
  if (!context || context.deckCount <= 0) {
    return [];
  }

  const includeSequence = mode !== "off";
  const includeStory = mode === "sequence-story" || mode === "full";
  const includeVisual = mode === "full";
  const includeText = mode === "full";
  const includeBorrowable = mode === "full";
  const includeAvoidCopying = mode !== "off";
  const includeOpportunities = mode === "full";

  if (
    !includeSequence &&
    !includeStory &&
    !includeVisual &&
    !includeText &&
    !includeBorrowable &&
    !includeAvoidCopying &&
    !includeOpportunities
  ) {
    return [];
  }

  return [
    `已额外分析 ${context.deckCount} 套竞品详情页，这些结论只作为策略参考，不允许直接复刻竞品页面。`,
    includeSequence && context.recommendedPageSequence.length > 0
      ? `推荐图序：${context.recommendedPageSequence.join(" -> ")}`
      : "",
    includeStory && context.recommendedStoryOrder.length > 0
      ? `推荐讲述顺序：${context.recommendedStoryOrder.join(" -> ")}`
      : "",
    includeVisual && context.recommendedVisualPrinciples.length > 0
      ? `视觉借鉴：${context.recommendedVisualPrinciples.slice(0, 4).join("；")}`
      : "",
    includeText && context.recommendedTextPrinciples.length > 0
      ? `文字借鉴：${context.recommendedTextPrinciples.slice(0, 4).join("；")}`
      : "",
    includeBorrowable && context.borrowablePrinciples.length > 0
      ? `可借鉴原则：${context.borrowablePrinciples.slice(0, 4).join("；")}`
      : "",
    includeAvoidCopying && context.avoidCopying.length > 0
      ? `避免照搬：${context.avoidCopying.slice(0, 3).join("；")}`
      : "",
    includeOpportunities && context.opportunitiesForOurProduct.length > 0
      ? `我方机会点：${context.opportunitiesForOurProduct.slice(0, 3).join("；")}`
      : "",
  ].filter(Boolean);
};

const buildPlanGenerationCompetitorContextBlock = (
  context: EcommerceCompetitorPlanningContext | null | undefined,
  mode: EcommerceCompetitorStrategyMode = "sequence-story",
): string => {
  const competitorPlanningLines = buildCompetitorPlanningLines(context, mode);
  if (competitorPlanningLines.length === 0) {
    return "";
  }

  return [
    "竞品策略规划参考：",
    ...competitorPlanningLines,
    "要求：这些结论必须前置参与方案规划，帮助决定图序、单图职责和叙事顺序，但不能直接照搬竞品文案和页面。",
  ].join("\n");
};

const appendPlanGenerationContextText = (
  source: string,
  extraBlock: string,
): string => {
  const normalizedSource = String(source || "").trim();
  const normalizedBlock = String(extraBlock || "").trim();
  if (!normalizedBlock) {
    return normalizedSource;
  }
  if (!normalizedSource) {
    return normalizedBlock;
  }
  if (normalizedSource.includes("竞品策略规划参考：")) {
    return normalizedSource;
  }
  return `${normalizedSource}\n\n${normalizedBlock}`;
};

const getPlanningStageCompetitorMode = (
  session: EcommerceOneClickSessionState,
): EcommerceCompetitorStrategyMode =>
  session.competitorPlanningStrategyMode ||
  session.competitorStrategyMode ||
  "sequence-story";

const getGenerationStageCompetitorMode = (
  session: EcommerceOneClickSessionState,
): EcommerceCompetitorStrategyMode =>
  session.competitorGenerationStrategyMode ||
  session.competitorStrategyMode ||
  "sequence-story";

const buildPlanningStageContextBlock = (options: {
  session: EcommerceOneClickSessionState;
  selectedTypes?: Array<{ id: string; title: string; imageCount: number }>;
}): string => {
  const { session, selectedTypes = [] } = options;
  const planningMode = getPlanningStageCompetitorMode(session);
  const oldFlowBlock = buildOldFlowPlanningContextBlock({
    brief: session.description,
    platformMode: session.platformMode,
    supplementSummary: summarizeSupplementFields(session.supplementFields),
    selectedTypes,
  });
  const typeTemplateLibraryBlock = buildLegacyTypeTemplateLibraryBlock({
    selectedTypes,
  });
  const competitorBlock = buildPlanGenerationCompetitorContextBlock(
    session.competitorPlanningContext,
    planningMode,
  );

  return [oldFlowBlock, typeTemplateLibraryBlock, competitorBlock]
    .filter(Boolean)
    .join("\n\n");
};

const buildCompetitorItemHintLines = (options: {
  groupTitle: string;
  item: EcommercePlanItem;
  context: EcommerceCompetitorPlanningContext | null | undefined;
  mode?: EcommerceCompetitorStrategyMode;
}): string[] => {
  const { groupTitle, item, context, mode = "sequence-story" } = options;
  if (!context || mode === "off") {
    return [];
  }

  const hint = getCompetitorRoleHint({
    sourceTexts: [
      groupTitle,
      item.title,
      item.description,
      item.marketingGoal,
      item.keyMessage,
      item.composition,
    ],
    recommendedPageSequence: context.recommendedPageSequence || [],
  });

  if (!hint) {
    return [];
  }

  return [
    `当前单图优先参考的竞品页角色：${hint.label}。`,
    `对应竞品页序语义：${hint.matchedText}。`,
    ...hint.executionLines,
  ];
};

const appendCompetitorPromptOutline = (options: {
  promptOutline: string;
  context: EcommerceCompetitorPlanningContext | null | undefined;
  itemHintLines?: string[];
  mode?: EcommerceCompetitorStrategyMode;
}): string => {
  const { promptOutline, context, itemHintLines = [], mode = "sequence-story" } = options;
  const source = String(promptOutline || "").trim();
  const competitorLines = buildCompetitorPlanningLines(context, mode);
  const normalizedItemHintLines = dedupePromptTextList(itemHintLines);
  if (competitorLines.length === 0 && normalizedItemHintLines.length === 0) {
    return source;
  }

  const strategyMarker = "竞品策略参考：";
  const itemMarker = "单图竞品参考位：";
  if (source.includes(strategyMarker) || source.includes(itemMarker)) {
    return source;
  }

  const segments: string[] = [];
  if (normalizedItemHintLines.length > 0) {
    segments.push(itemMarker, ...normalizedItemHintLines);
  }
  if (competitorLines.length > 0) {
    segments.push(strategyMarker, ...competitorLines);
  }

  if (!source) {
    return segments.join("\n");
  }

  return [source, "", ...segments].join("\n");
};

const mergeLayoutIntent = (
  base: EcommerceLayoutIntent | undefined,
  fallback: EcommerceLayoutIntent,
): EcommerceLayoutIntent => ({
  imageRole: base?.imageRole || fallback.imageRole,
  layoutMode: base?.layoutMode || fallback.layoutMode,
  componentNeed: base?.componentNeed || fallback.componentNeed,
  reservedAreas:
    normalizeLayoutReservedAreas(base?.reservedAreas) ||
    normalizeLayoutReservedAreas(fallback.reservedAreas),
});

const appendLegacyPromptOutline = (options: {
  promptOutline: string;
  profile: LegacyPromptProfileId;
  profileConfig: LegacyPromptProfile;
}): string => {
  const { promptOutline, profile, profileConfig } = options;
  const source = String(promptOutline || "").trim();
  const marker = `模板执行：${profileConfig.label}`;
  if (!source) {
    return [
      marker,
      `商业任务：${profileConfig.businessRole}`,
      `构图：${profileConfig.composition}`,
      `背景：${profileConfig.background}`,
      `光线：${profileConfig.lighting}`,
      `材质：${profileConfig.material}`,
      `避免：${profileConfig.avoid}`,
    ].join("\n");
  }
  if (source.includes(marker)) {
    return source;
  }
  return [
    source,
    "",
    marker,
    `商业任务：${profileConfig.businessRole}`,
    `构图：${profileConfig.composition}`,
    `背景：${profileConfig.background}`,
    `光线：${profileConfig.lighting}`,
    `材质：${profileConfig.material}`,
    `避免：${profileConfig.avoid}`,
  ].join("\n");
};

const enrichPlanItemWithLegacyProfile = (
  groupTitle: string,
  item: EcommercePlanItem,
): EcommercePlanItem => {
  const profile = inferLegacyPromptProfile({ groupTitle, item });
  const profileConfig = buildLegacyPromptProfile(profile);
  const layoutIntentDefaults = buildLegacyLayoutIntentDefaults(profile);

  return {
    ...item,
    marketingGoal:
      String(item.marketingGoal || "").trim() || profileConfig.businessRole,
    keyMessage:
      String(item.keyMessage || "").trim() ||
      `${profileConfig.label}下优先把当前单图任务讲清楚`,
    composition:
      String(item.composition || "").trim() || profileConfig.composition,
    styling:
      String(item.styling || "").trim() ||
      "商业广告级、电商可落地、商品第一眼立住、信息层级清楚",
    background:
      String(item.background || "").trim() || profileConfig.background,
    lighting:
      String(item.lighting || "").trim() || profileConfig.lighting,
    mustShow:
      (item.mustShow || []).length > 0
        ? item.mustShow
        : ["商品主体一致", "当前单图核心任务", "与该任务对应的视觉证据"],
    riskNotes:
      (item.riskNotes || []).length > 0
        ? item.riskNotes
        : [profileConfig.avoid],
    layoutIntent: mergeLayoutIntent(item.layoutIntent, layoutIntentDefaults),
    promptOutline: appendLegacyPromptOutline({
      promptOutline: item.promptOutline,
      profile,
      profileConfig,
    }),
  };
};

const enrichPlanItemWithCompetitorContext = (
  groupTitle: string,
  item: EcommercePlanItem,
  context: EcommerceCompetitorPlanningContext | null | undefined,
  mode: EcommerceCompetitorStrategyMode = "sequence-story",
): EcommercePlanItem => {
  if (!context || mode === "off") {
    return item;
  }

  const competitorItemHintLines = buildCompetitorItemHintLines({
    groupTitle,
    item,
    context,
    mode,
  });

  return {
    ...item,
    promptOutline: appendCompetitorPromptOutline({
      promptOutline: item.promptOutline,
      context,
      itemHintLines: competitorItemHintLines,
      mode,
    }),
    riskNotes: dedupePromptTextList([
      ...(item.riskNotes || []),
      ...context.avoidCopying.slice(0, 2),
    ]),
  };
};

const enrichPlanGroupsWithLegacyProfiles = (
  groups: EcommercePlanGroup[],
): EcommercePlanGroup[] =>
  groups.map((group) => ({
    ...group,
    items: group.items.map((item) =>
      enrichPlanItemWithLegacyProfile(group.typeTitle, item),
    ),
  }));

const enrichPlanGroupsWithCompetitorContext = (
  groups: EcommercePlanGroup[],
  context: EcommerceCompetitorPlanningContext | null | undefined,
  options?: {
    planningMode?: EcommerceCompetitorStrategyMode;
    generationMode?: EcommerceCompetitorStrategyMode;
  },
): EcommercePlanGroup[] =>
  !context
    ? groups
    : groups.map((group) => {
        const planningMode = options?.planningMode || "sequence-story";
        const generationMode = options?.generationMode || "sequence-story";
        const includeSequence = planningMode !== "off";
        const includeStory =
          planningMode === "sequence-story" || planningMode === "full";
        const includeVisual = planningMode === "full";
        const groupHint = getCompetitorRoleHint({
          sourceTexts: [
            group.typeTitle,
            group.summary,
            ...group.items.flatMap((item) => [
              item.title,
              item.description,
              item.marketingGoal,
              item.keyMessage,
              item.composition,
            ]),
          ],
          recommendedPageSequence: context.recommendedPageSequence || [],
        });
        const competitorStrategyEntries = dedupePromptTextList([
          includeStory && context.recommendedStoryOrder.length > 0
            ? context.recommendedStoryOrder.slice(0, 3).join(" -> ")
            : "",
        ]);
        const mergedStrategy = [
          ...(group.strategy || []),
          ...(includeSequence && groupHint
            ? [
                {
                  label: "竞品页序映射",
                  value: `${groupHint.label} <- ${groupHint.matchedText}`,
                },
              ]
            : []),
          ...(competitorStrategyEntries.length > 0
            ? [
                {
                  label: "竞品叙事借鉴",
                  value: competitorStrategyEntries[0],
                },
              ]
            : []),
          ...(includeVisual && context.recommendedVisualPrinciples.length > 0
            ? [
                {
                  label: "竞品视觉借鉴",
                  value: context.recommendedVisualPrinciples
                    .slice(0, 2)
                    .join("；"),
                },
              ]
            : []),
        ].filter(
          (entry, index, list) =>
            list.findIndex(
              (candidate) =>
                candidate.label === entry.label && candidate.value === entry.value,
            ) === index,
        );

        return {
          ...group,
          strategy: mergedStrategy,
          items: group.items.map((item) =>
            enrichPlanItemWithCompetitorContext(
              group.typeTitle,
              item,
              context,
              generationMode,
            ),
          ),
        };
      });

const buildGenerationConsistencyContext = ({
  item,
  relevantAnalyses,
}: {
  item: EcommercePlanGroup["items"][number];
  relevantAnalyses: EcommerceImageAnalysis[];
}) => {
  const referenceSummary = relevantAnalyses
    .slice(0, MAX_GENERATION_REFERENCE_IMAGES)
    .map((analysis, index) =>
        [
          `参考图${index + 1}`,
          analysis.title,
          analysis.angle ? `角度:${analysis.angle}` : "",
          analysis.analysisConclusion
            ? `参考判断:${analysis.analysisConclusion}`
            : "",
          analysis.highlights?.length
            ? `亮点:${analysis.highlights.join("、")}`
            : "",
      ]
        .filter(Boolean)
        .join(" | "),
    )
    .join("\n");

  const forbiddenChanges = Array.from(
    new Set(
      [
        "不要改变商品品类和主体外轮廓",
        "不要改变主色关系和主要材质趋势",
        "不要改变关键结构、按钮、接口、瓶盖或主体比例",
        "不要新增原参考图中不存在的装饰、配件或品牌元素",
        "不要把单商品任务生成成多商品或拼图",
        ...(item.mustShow || []).map((entry) => `必须保留：${entry}`),
      ].filter((entry) => entry.trim().length > 0),
    ),
  );

  return {
    subjectAnchors: relevantAnalyses
      .map((analysis) => analysis.title)
      .slice(0, MAX_GENERATION_REFERENCE_IMAGES),
    referenceSummary: referenceSummary || undefined,
    forbiddenChanges,
  };
};

const getRelevantImageAnalyses = (
  session: EcommerceOneClickSessionState,
  referenceImageIds: string[],
): EcommerceImageAnalysis[] => {
  const prioritized = session.imageAnalyses.filter((item) =>
    referenceImageIds.includes(item.imageId),
  );
  const fallback = session.imageAnalyses.filter(
    (item) =>
      item.usableAsReference &&
      !prioritized.some((candidate) => candidate.imageId === item.imageId),
  );

  return [...prioritized, ...fallback].slice(0, MAX_GENERATION_REFERENCE_IMAGES);
};

const buildGenerationBasePrompt = ({
  session,
  groupTitle,
  item,
  relevantAnalyses,
  supplementSummary,
}: {
  session: EcommerceOneClickSessionState;
  groupTitle: string;
  item: EcommercePlanGroup["items"][number];
  relevantAnalyses: EcommerceImageAnalysis[];
  supplementSummary: string;
}): string => {
  const mustShow = (item.mustShow || []).filter(Boolean).join("、");
  const platformFit = (item.platformFit || []).filter(Boolean).join("、");
  const riskNotes = (item.riskNotes || []).filter(Boolean).join("；");
  const layoutIntentLines = buildGenerationLayoutIntentText(item);
  const legacyPromptProfile = inferLegacyPromptProfile({ groupTitle, item });
  const legacyPromptPrincipleLines =
    buildLegacyPromptPrincipleLines(legacyPromptProfile);
  const legacyPromptProfileLines =
    buildLegacyPromptProfileLines(legacyPromptProfile);
  const legacyExecutionLines =
    buildLegacyPromptExecutionLines(legacyPromptProfile);
  const oldFlowPrincipleLines = buildOldFlowSingleImagePrincipleLines({
    brief: session.description,
    platformMode: session.platformMode,
    groupTitle,
    itemTitle: item.title,
    itemDescription: item.description,
  });
  const directTextPrincipleLines = buildOldFlowDirectTextPrincipleLines(item.copyPlan);
  const competitorPlanningLines = buildCompetitorPlanningLines(
    session.competitorPlanningContext,
    getGenerationStageCompetitorMode(session),
  );
  const competitorItemHintLines = buildCompetitorItemHintLines({
    groupTitle,
    item,
    context: session.competitorPlanningContext,
    mode: getGenerationStageCompetitorMode(session),
  });
  const copyPlan = item.copyPlan;
  const directTextLines = hasCopyPlanContent(copyPlan)
    ? [
        "",
        "【文字生成策略】",
        ...directTextPrincipleLines,
        copyPlan?.badge ? `角标文案：${copyPlan.badge}` : "",
        copyPlan?.headline ? `主标题文案：${copyPlan.headline}` : "",
        copyPlan?.subheadline ? `副标题文案：${copyPlan.subheadline}` : "",
        copyPlan?.priceLabel ? `价格标签：${copyPlan.priceLabel}` : "",
        copyPlan?.priceValue ? `价格主值：${copyPlan.priceValue}` : "",
        copyPlan?.priceNote ? `价格补充：${copyPlan.priceNote}` : "",
        copyPlan?.featureTags?.length
          ? `短卖点标签：${copyPlan.featureTags.join("、")}`
          : "",
        copyPlan?.bullets?.length
          ? `补充卖点：${copyPlan.bullets.join("、")}`
          : "",
        copyPlan?.comparisonTitle
          ? `对比标题：${copyPlan.comparisonTitle}`
          : "",
        copyPlan?.comparisonRows?.length
          ? `对比信息：${copyPlan.comparisonRows
              .map((row) =>
                [row.label, row.before, row.after].filter(Boolean).join(" / "),
              )
              .join("；")}`
          : "",
        copyPlan?.cta ? `行动引导：${copyPlan.cta}` : "",
      ].filter(Boolean)
    : [];
  const analysisAnchors = relevantAnalyses
    .map((analysis, index) =>
      [
        `参考锚点 ${index + 1}：${analysis.title}`,
        analysis.angle ? `角度/焦点：${analysis.angle}` : "",
        `产品详描：${analysis.description}`,
        analysis.analysisConclusion
          ? `参考判断：${analysis.analysisConclusion}`
          : "",
        analysis.highlights && analysis.highlights.length > 0
          ? `亮点：${analysis.highlights.join("、")}`
          : "",
        analysis.evidence && analysis.evidence.length > 0
          ? `依据：${analysis.evidence.join("；")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");

  return [
    `你要生成 1 张电商商品图，任务属于「${groupTitle} / ${item.title}」。`,
    "",
    "【主体锁定】",
    "把所有参考图都视为同一个真实商品主体，只允许更换场景、镜头和光线，不允许重新设计商品。",
    "不得改变商品品类、主体外轮廓、关键结构、主色关系、材质趋势、按钮/接口/盖体/瓶身等核心部件的位置与比例。",
    "如果参考图信息不足，宁可保守简洁，也不要脑补新的结构、装饰、配件或品牌元素。",
    "",
    "【商品锚点】",
    session.description ? `商品说明：${session.description}` : "商品说明：未提供，请以参考图中的商品为唯一主体。",
    relevantAnalyses.length > 1
      ? `参考图使用原则：本次最多使用 ${MAX_GENERATION_REFERENCE_IMAGES} 张参考图，第 1 张优先锁定主体，其余仅用于补充角度、细节和结构证据。`
      : "",
    analysisAnchors || "参考图锚点：未提供结构化图片分析，请严格以参考图中的商品主体为准。",
    mustShow ? `必须保留：${mustShow}` : "必须保留：商品主体、轮廓、主要结构与包装识别度。",
    "",
    "【当前出图任务】",
    `图型：${groupTitle}`,
    `标题：${item.title}`,
    item.description ? `任务说明：${item.description}` : "",
    item.marketingGoal ? `营销目标：${item.marketingGoal}` : "",
    item.keyMessage ? `核心信息：${item.keyMessage}` : "",
    item.promptOutline ? `方案草稿：${item.promptOutline}` : "",
    "",
    "【老流程原则吸收】",
    ...oldFlowPrincipleLines,
    "",
    "【老流程图型原理块】",
    ...legacyPromptPrincipleLines,
    "",
    "【老流程图型模板】",
    ...legacyPromptProfileLines,
    "",
    "【当前图型加压】",
    ...legacyExecutionLines,
    "",
    ...(competitorItemHintLines.length > 0
      ? ["【当前单图竞品参考位】", ...competitorItemHintLines, ""]
      : []),
    ...(competitorPlanningLines.length > 0
      ? ["【竞品策略参考】", ...competitorPlanningLines, ""]
      : []),
    "【画面执行】",
    ...layoutIntentLines,
    item.composition ? `构图：${item.composition}` : "构图：商品必须是画面主角，主体完整清晰，避免被场景元素盖住。",
    item.styling ? `风格：${item.styling}` : "风格：像有预算的商业电商主视觉，商品要立得住，不要做成普通场景记录图，也不要做成脱离商品的概念海报。",
    item.background ? `背景：${item.background}` : "背景：背景只做衬托，不得喧宾夺主，避免廉价、杂乱、像随手布景的普通感。",
    item.lighting ? `光线：${item.lighting}` : "光线：不仅要看清主体，还要把材质、轮廓、体积和品质感打出来，避免平均、发灰、平铺直叙的照明。",
    "卖点视觉化：如果当前任务在讲功能、结构、参数、对比或细节，必须把卖点转成可见证据，如局部放大、结构分区、路径示意、before/after、参数承载或真实动作，而不是只给抽象气氛。",
    "系统统一：这一张必须延续整套详情页统一的主色/辅色、背景材质、光影色温、镜头语言和说明图形语气，不能像另一套图。",
    `画幅比例：${item.ratio || "1:1"}`,
    platformFit ? `优先平台：${platformFit}` : "",
    supplementSummary ? `补充约束：\n${supplementSummary}` : "",
    ...directTextLines,
    "",
    "【硬性限制】",
    "只输出单张完成图，不要拼图，不要九宫格，不要多商品，不要把商品做成完全不同的型号。",
    "不要擅自改品牌名、logo 位置、包装文字样式、按钮数量、瓶盖/机身/喷头/接口等关键识别特征。",
    "不要让人物、手部、家具或场景道具抢走主体，商品必须始终清楚可辨。",
    hasCopyPlanContent(copyPlan)
      ? "不要故意做成无字底图，不要只留大片空白占位。优先交付完整带字海报，再由系统做原位替换。 "
      : "",
    riskNotes ? `注意风险：${riskNotes}` : "",
    "",
    "【最终目标】",
    "在保留参考图中同一商品主体一致性的前提下，完成这张可直接用于电商运营的商业主视觉图：既不是普通白描记录图，也不是空泛氛围图，而是能明确承担点击、转化或品质感建立任务的电商成图。",
  ]
    .filter(Boolean)
    .join("\n");
};

const enforceDirectTextMainlinePrompt = (
  prompt: string,
  item: EcommercePlanGroup["items"][number],
): string => {
  const normalized = String(prompt || "").trim();
  const legacyPromptProfile = inferLegacyPromptProfile({
    groupTitle: item.title || "",
    item,
  });
  const legacyPromptPrincipleSummary = buildLegacyPromptPrincipleLines(
    legacyPromptProfile,
  ).slice(0, 3);
  const legacyPromptProfileSummary = buildLegacyPromptProfileLines(
    legacyPromptProfile,
  ).slice(0, 3);
  const legacyExecutionSummary = buildLegacyPromptExecutionLines(
    legacyPromptProfile,
  ).slice(0, 3);
  const oldFlowPolishLines = buildOldFlowPromptPolishLines();
  const suffix = [
    "",
    "补充执行要求：",
    ...oldFlowPolishLines,
    "继续沿用当前匹配到的老流程图型原理块：",
    ...legacyPromptPrincipleSummary,
    "继续沿用当前匹配到的老流程图型模板纪律：",
    ...legacyPromptProfileSummary,
    "并额外严格执行这些当前图型要求：",
    ...legacyExecutionSummary,
  ].join("\n");

  if (!hasCopyPlanContent(item.copyPlan)) {
    return `${normalized}${suffix}`;
  }

  const directTextPolishLines = buildOldFlowDirectTextPrincipleLines(item.copyPlan);
  const directTextSuffix = [
    ...directTextPolishLines,
  ].join("\n");

  return `${normalized}${suffix}\n${directTextSuffix}`;
};

const resolveGenerationModel = (
  session: EcommerceOneClickSessionState,
): string => {
  const selected =
    session.modelOptions.find((item) => item.id === session.selectedModelId) ||
    session.modelOptions[0];
  const rawId = String(selected?.id || "").trim();
  const rawName = String(selected?.name || "").trim();
  const normalized = `${rawId} ${rawName}`.toLowerCase();

  if (
    /nanobanana2|nano banana 2|nanobanana 2/.test(normalized)
  ) {
    return "NanoBanana2";
  }
  if (/nano banana pro|nanobanana pro/.test(normalized)) {
    return "Nano Banana Pro";
  }
  if (/seedream5\.0|seedream 5\.0|seedream 4/.test(normalized)) {
    return "Seedream5.0";
  }

  return rawId || rawName || "Nano Banana Pro";
};

type GenerationModelCandidate = {
  id: string;
  label: string;
  model: string;
  imageSize: "1K" | "2K" | "4K";
  promptLanguagePolicy: "original-zh" | "translate-en";
};

const getGenerationModelCandidates = (
  session: EcommerceOneClickSessionState,
): GenerationModelCandidate[] => {
  const ordered = [
    session.modelOptions.find((item) => item.id === session.selectedModelId),
    ...session.modelOptions.filter((item) => item.id !== session.selectedModelId),
  ].filter(Boolean) as EcommerceOneClickSessionState["modelOptions"];

  const candidates = (ordered.length > 0 ? ordered : session.modelOptions).map(
    (item) => ({
      id: item.id,
      label: item.name || item.id,
      model: resolveGenerationModel({
        ...session,
        modelOptions: [item],
        selectedModelId: item.id,
      }),
      imageSize: item.imageSize || "2K",
      promptLanguagePolicy:
        item.promptLanguage === "en"
          ? ("translate-en" as const)
          : ("original-zh" as const),
    }),
  );

  return candidates.filter(
    (candidate, index, list) =>
      list.findIndex((item) => item.model === candidate.model) === index,
  );
};

const shouldFallbackToNextModel = (error: unknown): boolean => {
  const message = getErrorMessage(error, "生成失败，请稍后重试。");
  const normalized = message.toLowerCase();
  return /503|service unavailable|无可用渠道|distributor|channel unavailable|backend error|server error|timeout|timed out|network|fetch/.test(
    normalized + message,
  );
};

const generateImageWithModelFallback = async ({
  session,
  prompt,
  aspectRatio,
  referenceImages,
  consistencyContext,
  onFallback,
}: {
  session: EcommerceOneClickSessionState;
  prompt: string;
  aspectRatio: string;
  referenceImages: string[];
  consistencyContext?: {
    subjectAnchors?: string[];
    referenceSummary?: string;
    forbiddenChanges?: string[];
  };
  onFallback?: (payload: {
    failedModelLabel: string;
    nextModelLabel: string;
    reason: string;
  }) => void;
}): Promise<{
  imageUrl: string;
  usedModelLabel: string;
  usedModel: string;
  attemptedModels: string[];
}> => {
  const candidates = getGenerationModelCandidates(session);
  const attemptedMessages: string[] = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    try {
      const generated = (await executeSkill("generateImage", {
        prompt,
        model: candidate.model,
        aspectRatio,
        imageSize: candidate.imageSize,
        referenceImages,
        referenceMode: "product",
        referencePriority: "all",
        promptLanguagePolicy: candidate.promptLanguagePolicy,
        consistencyContext,
      })) as string | null;

      if (!generated) {
        throw new Error("生成结果为空，未拿到有效图片地址。");
      }

      return {
        imageUrl: generated,
        usedModelLabel: candidate.label,
        usedModel: candidate.model,
        attemptedModels: attemptedMessages,
      };
    } catch (error) {
      const reason = getErrorMessage(
        error,
        `模型 ${candidate.label} 生成失败。`,
      );
      attemptedMessages.push(`${candidate.label}: ${reason}`);

      const nextCandidate = candidates[index + 1];
      if (nextCandidate && shouldFallbackToNextModel(error)) {
        onFallback?.({
          failedModelLabel: candidate.label,
          nextModelLabel: nextCandidate.label,
          reason,
        });
        continue;
      }

      throw new Error(
        attemptedMessages.length > 1
          ? `已尝试 ${candidates.map((item) => item.label).join("、")}。最后失败原因：${reason}`
          : reason,
      );
    }
  }

  throw new Error("当前没有可用的生图模型。");
};

const normalizePromptLanguage = (
  value: string | null | undefined,
): EcommercePromptLanguage =>
  value === "en" || value === "auto" ? value : "zh";

const extractRewrittenPrompt = (
  value: { prompt?: string } | string | null | undefined,
): string =>
  typeof value === "string"
    ? value.trim()
    : typeof value?.prompt === "string"
      ? value.prompt.trim()
      : "";

const AUTO_FINALIZE_PROMPT_FEEDBACK =
  "请整理成适合 Nano Banana 2 / Gemini 图像生成模型直接执行、也方便继续人工微调的最终中文提示词。不要只停留在“描述正确”，而要写成真正有电商主视觉感的导演指令：商品第一眼就立住，画面层级清楚，背景和道具只服务商品，整体气质更像有预算的商业电商图而不是普通场景图。优先压缩重复约束和防御式表述，按“生成目标 -> 主体锁定 -> 镜头构图 -> 背景场景 -> 光线材质 -> 电商用途 -> 结尾少量关键限制”的顺序组织，优先锁定同一商品主体一致性，并明确写出这张图要承担的点击、种草、卖点承接或品质感建立任务。还要吸收老流程的原则：输出目标不是普通海报，而是可落地的电商成图；每张图只承担一个核心商业任务；主体区、标题区、卖点区、说明区层级必须清楚；卖点必须转成可见证据，少说空话，多给结构、特写、参数、引线、对比、路径或动作结果。";

const buildFinalizePromptFeedback = (
  session: EcommerceOneClickSessionState,
  groupTitle: string,
  item: EcommercePlanGroup["items"][number],
): string => {
  const legacyPromptProfile = inferLegacyPromptProfile({ groupTitle, item });
  const legacyPromptPrincipleLines =
    buildLegacyPromptPrincipleLines(legacyPromptProfile);
  const legacyPromptProfileLines =
    buildLegacyPromptProfileLines(legacyPromptProfile);
  const legacyExecutionLines =
    buildLegacyPromptExecutionLines(legacyPromptProfile);
  const oldFlowPrincipleLines = buildOldFlowSingleImagePrincipleLines({
    brief: session.description,
    platformMode: session.platformMode,
    groupTitle,
    itemTitle: item.title,
    itemDescription: item.description,
  });
  const directTextPrincipleLines = buildOldFlowDirectTextPrincipleLines(item.copyPlan);
  const competitorPlanningLines = buildCompetitorPlanningLines(
    session.competitorPlanningContext,
    getGenerationStageCompetitorMode(session),
  );
  const competitorItemHintLines = buildCompetitorItemHintLines({
    groupTitle,
    item,
    context: session.competitorPlanningContext,
    mode: getGenerationStageCompetitorMode(session),
  });

  return [
    AUTO_FINALIZE_PROMPT_FEEDBACK,
    "",
    "继续吸收这组老流程单图原则：",
    ...oldFlowPrincipleLines,
    "",
    "继续吸收这组老流程图型原理块：",
    ...legacyPromptPrincipleLines,
    "",
    "当前图型请继续遵循这组老流程模板纪律：",
    ...legacyPromptProfileLines,
    "",
    "这次还要重点压住下面这些执行细节：",
    ...legacyExecutionLines,
    ...(directTextPrincipleLines.length > 0
      ? ["", "当前仍然走直出带字主链：", ...directTextPrincipleLines]
      : []),
    ...(competitorItemHintLines.length > 0
      ? ["", "当前单图还要优先贴近以下竞品参考位：", ...competitorItemHintLines]
      : []),
    ...(competitorPlanningLines.length > 0
      ? ["", "同时参考以下竞品策略结论：", ...competitorPlanningLines]
      : []),
  ].join("\n");
};

const collectSupplementReferenceImages = (
  fields: EcommerceSupplementField[],
): string[] =>
  fields.flatMap((field) =>
    field.kind === "image" && Array.isArray(field.value)
      ? field.value.filter(
          (item): item is string => typeof item === "string" && item.length > 0,
        )
      : [],
  );

const loadImageElement = async (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`图片加载失败：${response.status}`);
        }
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onload = () => {
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error("图片解析失败。"));
          image.src = String(reader.result || "");
        };
        reader.onerror = () => reject(new Error("图片读取失败。"));
        reader.readAsDataURL(blob);
      } catch (error) {
        reject(error instanceof Error ? error : new Error("图片加载失败。"));
      }
    };
    image.src = url;
  });

const getUnknownErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error || "");

const getClosestImageAspectRatio = (width: number, height: number): string => {
  const ratio = width / Math.max(1, height);
  const candidates = [
    { label: "1:1", value: 1 },
    { label: "4:5", value: 4 / 5 },
    { label: "3:4", value: 3 / 4 },
    { label: "2:3", value: 2 / 3 },
    { label: "9:16", value: 9 / 16 },
    { label: "16:9", value: 16 / 9 },
    { label: "3:2", value: 3 / 2 },
    { label: "4:3", value: 4 / 3 },
  ];
  return candidates.reduce((best, current) =>
    Math.abs(current.value - ratio) < Math.abs(best.value - ratio)
      ? current
      : best,
  ).label;
};

const buildReplacementMaskDataUrl = (options: {
  width: number;
  height: number;
  boxes: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    radius?: number;
  }>;
}): string => {
  const canvas = document.createElement("canvas");
  canvas.width = options.width;
  canvas.height = options.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("无法创建擦字蒙版。");
  }

  context.fillStyle = "#000000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#FFFFFF";
  const traceRoundedRect = (
    box: { x: number; y: number; width: number; height: number; radius?: number },
  ) => {
    const radius = Math.max(
      0,
      Math.min(
        Number(box.radius) || 0,
        box.width / 2,
        box.height / 2,
      ),
    );
    if (radius <= 0) {
      context.fillRect(box.x, box.y, box.width, box.height);
      return;
    }

    context.beginPath();
    context.moveTo(box.x + radius, box.y);
    context.lineTo(box.x + box.width - radius, box.y);
    context.quadraticCurveTo(
      box.x + box.width,
      box.y,
      box.x + box.width,
      box.y + radius,
    );
    context.lineTo(box.x + box.width, box.y + box.height - radius);
    context.quadraticCurveTo(
      box.x + box.width,
      box.y + box.height,
      box.x + box.width - radius,
      box.y + box.height,
    );
    context.lineTo(box.x + radius, box.y + box.height);
    context.quadraticCurveTo(
      box.x,
      box.y + box.height,
      box.x,
      box.y + box.height - radius,
    );
    context.lineTo(box.x, box.y + radius);
    context.quadraticCurveTo(box.x, box.y, box.x + radius, box.y);
    context.closePath();
    context.fill();
  };
  options.boxes.forEach((box) => {
    traceRoundedRect(box);
  });

  return canvas.toDataURL("image/png");
};

const analyzeReplacementBackground = (options: {
  image: HTMLImageElement;
  boxes: Array<{ x: number; y: number; width: number; height: number }>;
}): NonNullable<EcommerceOverlayState["replacementQuality"]> => {
  const { image, boxes } = options;
  if (!boxes.length) {
    return {
      backgroundKind: "unknown",
      eraseStrategy: "generic",
      confidence: "low",
      summary: "未检测到可用于擦字的背景样本。",
    };
  }

  try {
    const canvas = document.createElement("canvas");
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("无法读取底图像素。");
    }

    context.drawImage(image, 0, 0, width, height);

    let sampleCount = 0;
    let luminanceSum = 0;
    let luminanceSquareSum = 0;
    let edgeSum = 0;
    let edgeCount = 0;

    boxes.slice(0, 8).forEach((box) => {
      const x = Math.max(0, Math.floor(box.x));
      const y = Math.max(0, Math.floor(box.y));
      const boxWidth = Math.max(1, Math.floor(box.width));
      const boxHeight = Math.max(1, Math.floor(box.height));
      const safeWidth = Math.min(boxWidth, width - x);
      const safeHeight = Math.min(boxHeight, height - y);
      if (safeWidth <= 0 || safeHeight <= 0) {
        return;
      }

      const imageData = context.getImageData(x, y, safeWidth, safeHeight).data;
      const stepX = Math.max(1, Math.floor(safeWidth / 24));
      const stepY = Math.max(1, Math.floor(safeHeight / 24));
      const getLuma = (index: number) =>
        imageData[index] * 0.2126 +
        imageData[index + 1] * 0.7152 +
        imageData[index + 2] * 0.0722;

      for (let py = 0; py < safeHeight; py += stepY) {
        for (let px = 0; px < safeWidth; px += stepX) {
          const index = (py * safeWidth + px) * 4;
          const luma = getLuma(index);
          luminanceSum += luma;
          luminanceSquareSum += luma * luma;
          sampleCount += 1;

          if (px + stepX < safeWidth) {
            const nextIndex = (py * safeWidth + (px + stepX)) * 4;
            edgeSum += Math.abs(luma - getLuma(nextIndex));
            edgeCount += 1;
          }
          if (py + stepY < safeHeight) {
            const nextIndex = ((py + stepY) * safeWidth + px) * 4;
            edgeSum += Math.abs(luma - getLuma(nextIndex));
            edgeCount += 1;
          }
        }
      }
    });

    if (sampleCount < 20 || edgeCount < 10) {
      return {
        backgroundKind: "unknown",
        eraseStrategy: "generic",
        confidence: "low",
        summary: "底图背景采样不足，先按通用擦字策略处理。",
      };
    }

    const mean = luminanceSum / sampleCount;
    const variance = Math.max(
      0,
      luminanceSquareSum / sampleCount - mean * mean,
    );
    const edgeScore = edgeSum / Math.max(1, edgeCount);

    if (variance < 90 && edgeScore < 12) {
      return {
        backgroundKind: "flat-clean",
        eraseStrategy: "clean-plate",
        confidence: "high",
        summary: "底图更像纯净棚拍底，可走干净补板式擦字。",
      };
    }
    if (variance < 220 && edgeScore < 22) {
      return {
        backgroundKind: "soft-gradient",
        eraseStrategy: "soft-blend",
        confidence: "medium",
        summary: "底图带柔和渐变或光晕，擦字时要保住渐变过渡。",
      };
    }
    if (variance < 720 && edgeScore < 40) {
      return {
        backgroundKind: "textured-surface",
        eraseStrategy: "texture-rebuild",
        confidence: "medium",
        summary: "底图带纹理或材质细节，擦字时要优先续上肌理。",
      };
    }
    return {
      backgroundKind: "complex-photo",
      eraseStrategy: "photo-reconstruct",
      confidence: "medium",
      summary: "底图是复杂摄影背景，擦字时要重建真实局部内容。",
    };
  } catch (error) {
    console.warn("[ecomOverlay] background analysis failed", error);
    return {
      backgroundKind: "unknown",
      eraseStrategy: "generic",
      confidence: "low",
      summary: "底图背景分析失败，已回退到通用擦字策略。",
    };
  }
};

const buildReplacementEditPrompt = (options: {
  backgroundKind?: NonNullable<EcommerceOverlayState["replacementQuality"]>["backgroundKind"];
  sourceMode?: NonNullable<EcommerceOverlayState["replacementQuality"]>["sourceMode"];
}) => {
  const { backgroundKind, sourceMode } = options;
  const sourceLine =
    sourceMode === "anchor-only"
      ? "The mask is anchor-driven and closely follows original text blocks."
      : sourceMode === "template-only"
        ? "The mask is template-inferred, so remove only actual text traces and rebuild nearby layout carefully."
        : "The mask combines detected anchors and template inference, so remove text completely while keeping surrounding layout relationships stable.";
  const backgroundLine =
    backgroundKind === "flat-clean"
      ? "Rebuild a clean studio plate with smooth solid tones, soft shadow falloff, and no repair blotches."
      : backgroundKind === "soft-gradient"
        ? "Rebuild smooth gradients, glows, halo transitions, and gentle lighting falloff naturally."
        : backgroundKind === "textured-surface"
          ? "Rebuild local texture, material grain, reflections, brushed surfaces, cloth or paper continuity naturally."
          : backgroundKind === "complex-photo"
            ? "Reconstruct photographic details, reflections, props, highlights, and local scene content naturally."
            : "Rebuild the underlying surface naturally and avoid visible repair seams.";
  return [
    "Remove only the visible text, letters, numbers, and typography artifacts inside the white mask area.",
    sourceLine,
    backgroundLine,
    "Do not create new text, new icons, new labels, or new decorative elements.",
  ].join(" ");
};

const ECOMMERCE_TEXT_ANCHOR_ROLE_VALUES = [
  "badge",
  "headline",
  "subheadline",
  "featureTags",
  "price",
  "stats",
  "comparison",
  "bullets",
  "cta",
  "unknown",
] as const;

const normalizeTextAnchorRole = (
  value: unknown,
): EcommerceTextAnchorHint["role"] => {
  const next = String(value || "").trim();
  return ECOMMERCE_TEXT_ANCHOR_ROLE_VALUES.includes(
    next as (typeof ECOMMERCE_TEXT_ANCHOR_ROLE_VALUES)[number],
  )
    ? (next as EcommerceTextAnchorHint["role"])
    : "unknown";
};

const normalizeTextAnchorAlign = (
  value: unknown,
): EcommerceTextAnchorHint["align"] | undefined => {
  const next = String(value || "").trim();
  return next === "left" || next === "center" || next === "right"
    ? next
    : undefined;
};

const clampUnitNumber = (value: unknown, min = 0, max = 1) => {
  const next = Number(value);
  if (!Number.isFinite(next)) return min;
  return Math.max(min, Math.min(max, next));
};

const blobToDataUrl = async (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image blob."));
    reader.readAsDataURL(blob);
  });

const imageUrlToDataUrl = async (url: string): Promise<string> => {
  if (/^data:/i.test(url)) {
    return url;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image for anchor detection: ${response.status}`);
  }

  return blobToDataUrl(await response.blob());
};

const normalizeTextAnchorHints = (value: unknown): EcommerceTextAnchorHint[] => {
  const source = Array.isArray(value)
    ? value
    : value &&
        typeof value === "object" &&
        Array.isArray((value as { anchors?: unknown[] }).anchors)
      ? (value as { anchors: unknown[] }).anchors
      : [];

  return source
    .map((entry) => {
      const record =
        entry && typeof entry === "object"
          ? (entry as Record<string, unknown>)
          : null;
      if (!record) return null;

      const x = clampUnitNumber(record.x, 0, 0.98);
      const y = clampUnitNumber(record.y, 0, 0.98);
      const width = clampUnitNumber(record.width, 0.01, 1 - x);
      const height = clampUnitNumber(record.height, 0.01, 1 - y);
      if (width <= 0.012 || height <= 0.012) {
        return null;
      }

      return {
        text: String(record.text || "").trim() || undefined,
        role: normalizeTextAnchorRole(record.role),
        x,
        y,
        width,
        height,
        align: normalizeTextAnchorAlign(record.align),
        confidence: clampUnitNumber(record.confidence, 0, 1),
      } satisfies EcommerceTextAnchorHint;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
};

const isCanvasSecurityRelatedError = (error: unknown): boolean => {
  const message = getUnknownErrorMessage(error).toLowerCase();
  return (
    (error instanceof DOMException && error.name === "SecurityError") ||
    message.includes("securityerror") ||
    message.includes("tainted") ||
    message.includes("cross-origin") ||
    message.includes("cross origin") ||
    message.includes("origin-clean") ||
    message.includes("origin clean")
  );
};

const ensureOverlayFontFace = async (
  overlayState?: EcommerceOverlayState,
): Promise<string | undefined> => {
  const fontUrl = String(overlayState?.fontUrl || "").trim();
  if (!fontUrl) {
    return overlayState?.fontFamily;
  }

  if (typeof FontFace === "undefined") {
    throw new Error(
      "当前浏览器不支持自定义字体渲染，请改用系统字体或更换浏览器后再试。",
    );
  }

  const family =
    String(overlayState?.fontFamily || "").trim() ||
    `ecom_overlay_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const face = new FontFace(family, `url(${fontUrl})`);
    await face.load();
    (document as Document & {
      fonts?: Set<FontFace> & { add?: (font: FontFace) => void };
    }).fonts?.add?.(face);
    await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
    return family;
  } catch (error) {
    throw new Error(
      `自定义字体加载失败，请重新上传后再试。${getUnknownErrorMessage(error) ? ` ${getUnknownErrorMessage(error)}` : ""}`,
    );
  }
};

const canvasToBlob = async (
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
            return;
          }
          reject(new Error("浏览器没有返回可保存的图片数据。"));
        },
        type,
        quality,
      );
    } catch (error) {
      reject(error);
    }
  });

type OverlayComposeResult = {
  blob: Blob;
  dataUrl: string;
  mimeType: string;
};

const buildOverlayPlatformVariantState = (
  overlayState: EcommerceOverlayState,
  preset: (typeof OVERLAY_PLATFORM_PRESET_OPTIONS)[number],
): EcommerceOverlayState => ({
  ...overlayState,
  platformPresetId: preset.id,
  templateId: preset.templateId,
  textAlign: preset.textAlign,
  tone: preset.tone,
  bulletStyle: preset.bulletStyle,
  stylePresetId: undefined,
  renderStatus: undefined,
  renderStatusMessage: undefined,
  renderedPersistence: undefined,
  renderedImageUrl: undefined,
  renderedAssetId: undefined,
  renderedAt: undefined,
});

const wrapCanvasText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    const chars = Array.from(text);
    const lines: string[] = [];
    let current = "";
    for (const char of chars) {
      const next = current + char;
      if (current && ctx.measureText(next).width > maxWidth) {
        lines.push(current);
        current = char;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(next).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
};

const clampCanvasTextWithEllipsis = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string => {
  const value = String(text || "").trim();
  if (!value) return "";
  if (ctx.measureText(value).width <= maxWidth) {
    return value;
  }
  const ellipsis = "…";
  let current = value;
  while (current.length > 0) {
    const next = `${current}${ellipsis}`;
    if (ctx.measureText(next).width <= maxWidth) {
      return next;
    }
    current = current.slice(0, -1);
  }
  return ellipsis;
};

const fitWrappedCanvasText = (
  ctx: CanvasRenderingContext2D,
  options: {
    text: string;
    maxWidth: number;
    maxLines: number;
    initialSize: number;
    minSize: number;
    weight: string;
    fontFamily: string;
  },
): {
  fontSize: number;
  lines: string[];
  truncated: boolean;
} => {
  const value = String(options.text || "").trim();
  if (!value) {
    return {
      fontSize: options.initialSize,
      lines: [],
      truncated: false,
    };
  }
  const step = Math.max(1, Math.round(options.initialSize * 0.08));
  for (
    let fontSize = options.initialSize;
    fontSize >= options.minSize;
    fontSize -= step
  ) {
    ctx.font = `${options.weight} ${fontSize}px ${options.fontFamily}`;
    const lines = wrapCanvasText(ctx, value, options.maxWidth);
    if (lines.length <= options.maxLines) {
      return {
        fontSize,
        lines,
        truncated: false,
      };
    }
  }

  ctx.font = `${options.weight} ${options.minSize}px ${options.fontFamily}`;
  const fallbackLines = wrapCanvasText(ctx, value, options.maxWidth).slice(
    0,
    options.maxLines,
  );
  if (fallbackLines.length > 0) {
    fallbackLines[fallbackLines.length - 1] = clampCanvasTextWithEllipsis(
      ctx,
      fallbackLines[fallbackLines.length - 1] || "",
      options.maxWidth,
    );
  }
  return {
    fontSize: options.minSize,
    lines: fallbackLines,
    truncated: true,
  };
};

const composeOverlayImage = async (
  baseUrl: string,
  overlayState: EcommerceOverlayState,
  layoutMeta?: EcommerceLayoutSnapshot,
): Promise<OverlayComposeResult> => {
  let image: HTMLImageElement;
  try {
    image = await loadImageElement(baseUrl);
  } catch (error) {
    throw new Error(
      isCanvasSecurityRelatedError(error)
        ? "底图来源不允许浏览器二次绘制，无法生成上字成片。请先把底图保存到项目资产后再试。"
        : `底图加载失败，无法生成上字成片。${getUnknownErrorMessage(error) ? ` ${getUnknownErrorMessage(error)}` : ""}`,
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("无法创建上字画布。");
  }

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const family = (await ensureOverlayFontFace(overlayState)) || "sans-serif";
  const templateId = overlayState.templateId || "hero-left";
  const align = overlayState.textAlign || "left";
  const isLightTone = overlayState.tone === "light";
  const isAccentTone = overlayState.tone === "accent";
  const featureTags = (overlayState.featureTags || []).slice(0, 6);
  const bullets = (overlayState.bullets || []).slice(0, 6);
  const stats = (overlayState.stats || []).slice(0, 4);
  const comparisonRows = (overlayState.comparisonRows || []).slice(0, 4);
  const layerVisibility = getOverlayLayerVisibilityMap(overlayState.layers);
  const semanticMeta = getOverlaySemanticMeta({
    templateId,
    layoutMeta,
    statCount: layerVisibility.stats ? stats.length : 0,
    comparisonCount: layerVisibility.comparison ? comparisonRows.length : 0,
    comparisonTitle: layerVisibility.comparison ? overlayState.comparisonTitle : "",
  });
  const decorationProfile = getOverlayDecorationProfile({
    templateId,
    layoutMeta,
    statCount: layerVisibility.stats ? stats.length : 0,
    comparisonCount: layerVisibility.comparison ? comparisonRows.length : 0,
    bulletCount: layerVisibility.bullets ? bullets.length : 0,
    featureTagCount: layerVisibility.featureTags ? featureTags.length : 0,
    hasPrice: Boolean(
      String(overlayState.priceLabel || "").trim() ||
        String(overlayState.priceValue || "").trim() ||
        String(overlayState.priceNote || "").trim(),
    ),
    hasCta: Boolean(String(overlayState.cta || "").trim()),
    hasBadge: Boolean(String(overlayState.badge || "").trim()),
    headlineLength: String(overlayState.headline || "").trim().length,
    subheadlineLength: String(overlayState.subheadline || "").trim().length,
    stylePresetId: overlayState.stylePresetId || "",
  });
  const sectionOrder = buildOverlaySectionOrder({
    hasFeatureTags: layerVisibility.featureTags && featureTags.length > 0,
    hasStats: layerVisibility.stats && stats.length > 0,
    hasComparison:
      layerVisibility.comparison &&
      Boolean(semanticMeta.comparisonTitle || comparisonRows.length > 0),
    hasBullets: layerVisibility.bullets && bullets.length > 0,
  });
  const roleLabel = semanticMeta.roleLabel;
  const headerMetaText = semanticMeta.headerMetaText;
  const comparisonTitle = semanticMeta.comparisonTitle;
  const featureTitle = semanticMeta.featureTitle;
  const bulletsTitle = semanticMeta.bulletsTitle;
  const decorationGuideItems = [
    ...stats.map((item) => item.value || item.label),
    ...featureTags,
    ...bullets,
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 4);

  const roundRect = (
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) => {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  const panelBox = getOverlayPanelBox({
    templateId,
    statCount: stats.length,
    comparisonCount: comparisonRows.length,
    hasPrice: Boolean(
      String(overlayState.priceLabel || "").trim() ||
        String(overlayState.priceValue || "").trim() ||
        String(overlayState.priceNote || "").trim(),
    ),
    headlineLength: String(overlayState.headline || "").trim().length,
    subheadlineLength: String(overlayState.subheadline || "").trim().length,
    bulletCount: bullets.length,
    featureTagCount: featureTags.length,
    hasBadge: Boolean(String(overlayState.badge || "").trim()),
    hasCta: Boolean(String(overlayState.cta || "").trim()),
  });
  const panel = {
    x:
      (panelBox.left != null
        ? panelBox.left
        : 1 - (panelBox.right || 0) - panelBox.width) * canvas.width,
    y:
      (panelBox.top != null
        ? panelBox.top
        : 1 - (panelBox.bottom || 0) - panelBox.height) * canvas.height,
    w: canvas.width * panelBox.width,
    h: canvas.height * panelBox.height,
  };

  const colors = (() => {
    if (isLightTone) {
      return {
        panelTop: decorationProfile.compactPanel
          ? "rgba(255,255,255,0.92)"
          : "rgba(255,255,255,0.88)",
        panelBottom: decorationProfile.compactPanel
          ? "rgba(255,255,255,0.78)"
          : "rgba(252,252,253,0.72)",
        panelStroke: decorationProfile.compactPanel
          ? "rgba(255,255,255,0.94)"
          : "rgba(255,255,255,0.82)",
        panelDash: "rgba(148,163,184,0.16)",
        glow: decorationProfile.minimalChrome
          ? "rgba(255,255,255,0.14)"
          : "rgba(255,255,255,0.28)",
        primary: "#0f172a",
        secondary: "rgba(15,23,42,0.68)",
        tertiary: "rgba(15,23,42,0.42)",
        accent: "#f07f45",
        accentSoft: "rgba(240,127,69,0.08)",
        chipBg: "rgba(255,255,255,0.56)",
        cardBg: "rgba(255,255,255,0.78)",
        cardStroke: "rgba(148,163,184,0.18)",
        ctaText: "#ffffff",
      };
    }
    if (isAccentTone) {
      return {
        panelTop: decorationProfile.compactPanel
          ? "rgba(15,23,42,0.44)"
          : "rgba(15,23,42,0.70)",
        panelBottom: decorationProfile.compactPanel
          ? "rgba(15,23,42,0.24)"
          : "rgba(15,23,42,0.48)",
        panelStroke: "rgba(255,255,255,0.16)",
        panelDash: "rgba(255,255,255,0.10)",
        glow: decorationProfile.minimalChrome
          ? "rgba(255,255,255,0.04)"
          : "rgba(255,255,255,0.10)",
        primary: "#f8fafc",
        secondary: "rgba(248,250,252,0.78)",
        tertiary: "rgba(248,250,252,0.52)",
        accent: "#f2b36f",
        accentSoft: "rgba(242,179,111,0.08)",
        chipBg: "rgba(255,255,255,0.07)",
        cardBg: "rgba(255,255,255,0.06)",
        cardStroke: "rgba(255,255,255,0.10)",
        ctaText: "#ffffff",
      };
    }
    return {
      panelTop: decorationProfile.compactPanel
        ? "rgba(15,23,42,0.40)"
        : "rgba(15,23,42,0.62)",
      panelBottom: decorationProfile.compactPanel
        ? "rgba(15,23,42,0.24)"
        : "rgba(15,23,42,0.42)",
      panelStroke: "rgba(255,255,255,0.14)",
      panelDash: "rgba(255,255,255,0.08)",
      glow: decorationProfile.minimalChrome
        ? "rgba(255,255,255,0.03)"
        : "rgba(255,255,255,0.06)",
      primary: "#f8fafc",
      secondary: "rgba(248,250,252,0.78)",
      tertiary: "rgba(248,250,252,0.48)",
      accent: "#f0b06c",
      accentSoft: "rgba(240,176,108,0.08)",
      chipBg: "rgba(255,255,255,0.06)",
      cardBg: "rgba(255,255,255,0.05)",
      cardStroke: "rgba(255,255,255,0.10)",
      ctaText: "#ffffff",
    };
  })();

  const radius = decorationProfile.compactPanel
    ? Math.max(16, canvas.width * 0.019)
    : Math.max(20, canvas.width * 0.024);
  const innerPadding = panel.w * (decorationProfile.compactPanel ? 0.07 : 0.08);
  const contentLeft = panel.x + innerPadding;
  const contentRight = panel.x + panel.w - innerPadding;
  const contentWidth = panel.w - innerPadding * 2;
  const contentCenter = panel.x + panel.w / 2;
  const canvasFontFamily =
    family === "sans-serif"
      ? `"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`
      : `"${family}", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`;
  const textAnchor =
    align === "center" ? contentCenter : align === "right" ? contentRight : contentLeft;
  let cursorY = panel.y + panel.h * (decorationProfile.compactPanel ? 0.09 : 0.08);

  const setText = (size: number, weight: string, color: string) => {
    ctx.font = `${weight} ${size}px ${canvasFontFamily}`;
    ctx.fillStyle = color;
    ctx.textBaseline = "top";
    ctx.textAlign = align as CanvasTextAlign;
  };

  const drawTextLines = (
    text: string,
    size: number,
    weight: string,
    color: string,
    options?: {
      maxLines?: number;
      topGap?: number;
      lineGap?: number;
    },
  ) => {
    const value = String(text || "").trim();
    if (!value) return;
    cursorY += options?.topGap || 0;
    const fitted = fitWrappedCanvasText(ctx, {
      text: value,
      maxWidth: contentWidth,
      maxLines: options?.maxLines || 3,
      initialSize: size,
      minSize: Math.max(12, Math.round(size * 0.72)),
      weight,
      fontFamily: canvasFontFamily,
    });
    setText(fitted.fontSize, weight, color);
    const lines = fitted.lines;
    for (const line of lines) {
      ctx.fillText(line, textAnchor, cursorY, contentWidth);
      cursorY +=
        fitted.fontSize +
        (options?.lineGap ?? Math.max(6, fitted.fontSize * 0.24));
    }
  };

  const drawDecorations = () => {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const glow = ctx.createRadialGradient(
      panel.x + panel.w * 0.2,
      panel.y + panel.h * 0.18,
      0,
      panel.x + panel.w * 0.2,
      panel.y + panel.h * 0.18,
      panel.w * 0.82,
    );
    glow.addColorStop(0, colors.glow);
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    roundRect(
      panel.x - panel.w * 0.02,
      panel.y - panel.h * 0.02,
      panel.w * 1.04,
      panel.h * 1.04,
      radius * 1.15,
    );
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = decorationProfile.minimalChrome
      ? "rgba(15,23,42,0.08)"
      : "rgba(15,23,42,0.14)";
    ctx.shadowBlur = decorationProfile.compactPanel
      ? Math.max(10, canvas.width * 0.014)
      : Math.max(18, canvas.width * 0.026);
    ctx.shadowOffsetY = decorationProfile.compactPanel
      ? Math.max(4, canvas.height * 0.006)
      : Math.max(8, canvas.height * 0.012);
    const panelGradient = ctx.createLinearGradient(
      panel.x,
      panel.y,
      panel.x,
      panel.y + panel.h,
    );
    panelGradient.addColorStop(0, colors.panelTop);
    panelGradient.addColorStop(1, colors.panelBottom);
    ctx.fillStyle = panelGradient;
    roundRect(panel.x, panel.y, panel.w, panel.h, radius);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.lineWidth = Math.max(1.25, canvas.width * 0.0015);
    ctx.strokeStyle = colors.panelStroke;
    roundRect(panel.x, panel.y, panel.w, panel.h, radius);
    ctx.stroke();
    ctx.restore();

    if (!decorationProfile.minimalChrome) {
      const stripeHeight = Math.max(5, panel.h * 0.016);
      ctx.save();
      ctx.fillStyle = colors.accent;
      roundRect(panel.x + panel.w * 0.05, panel.y + panel.h * 0.035, panel.w * 0.18, stripeHeight, stripeHeight / 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = colors.panelDash;
      ctx.lineWidth = Math.max(1.1, canvas.width * 0.0012);
      const guideStartX = panel.x + panel.w * 0.74;
      const guideEndX = panel.x + panel.w * 0.9;
      const guideBaseY = panel.y + panel.h * 0.11;
      for (let index = 0; index < 3; index += 1) {
        const currentY = guideBaseY + index * Math.max(10, panel.h * 0.018);
        ctx.beginPath();
        ctx.moveTo(guideStartX, currentY);
        ctx.lineTo(guideEndX, currentY);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  const drawHeroRibbonDecor = () => {
    if (!decorationProfile.showHeroRibbon) return;
    const ribbonHeight = Math.max(34, canvas.height * 0.045);
    const ribbonText = String(
      overlayState.badge || featureTags[0] || "",
    ).trim();
    if (!ribbonText) return;
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.max(14, canvas.width * 0.014)}px ${canvasFontFamily}`;
    const ribbonWidth = Math.min(
      canvas.width * 0.5,
      ctx.measureText(ribbonText).width + ribbonHeight * 1.6,
    );
    const x = canvas.width * 0.03;
    const y = canvas.height * 0.025;
    ctx.fillStyle = isLightTone ? "rgba(255,255,255,0.84)" : "rgba(15,23,42,0.54)";
    ctx.strokeStyle = isLightTone ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.12)";
    roundRect(x, y, ribbonWidth, ribbonHeight, Math.max(12, ribbonHeight * 0.42));
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = isLightTone ? "rgba(51,65,85,0.86)" : "rgba(248,250,252,0.88)";
    ctx.fillText(ribbonText, x + ribbonHeight * 0.44, y + ribbonHeight / 2, ribbonWidth - ribbonHeight * 0.8);
    ctx.restore();
  };

  const drawAmbientGridDecor = () => {
    if (!decorationProfile.showAmbientGrid) return;
    const x = canvas.width * 0.03;
    const y = canvas.height * 0.12;
    const w = canvas.width * 0.46;
    const h = canvas.height * 0.22;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.14);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w * 0.82, y + h);
    ctx.lineTo(x, y + h * 0.82);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = isLightTone ? "rgba(96,165,250,0.20)" : "rgba(125,211,252,0.18)";
    ctx.lineWidth = Math.max(1, canvas.width * 0.0011);
    const step = Math.max(18, canvas.width * 0.018);
    for (let gridX = x - h; gridX < x + w + h; gridX += step) {
      ctx.beginPath();
      ctx.moveTo(gridX, y + h);
      ctx.lineTo(gridX + h * 0.52, y);
      ctx.stroke();
    }
    for (let gridY = y; gridY < y + h + step; gridY += step) {
      ctx.beginPath();
      ctx.moveTo(x, gridY);
      ctx.lineTo(x + w, gridY - h * 0.12);
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawSceneBeamDecor = () => {
    if (!decorationProfile.showSceneBeam) return;
    const startX = canvas.width * 0.73;
    const startY = canvas.height * 0.62;
    const paths = [
      [
        [startX, startY],
        [canvas.width * 0.86, canvas.height * 0.59],
        [canvas.width, canvas.height * 0.61],
      ],
      [
        [canvas.width * 0.69, canvas.height * 0.68],
        [canvas.width * 0.84, canvas.height * 0.66],
        [canvas.width, canvas.height * 0.72],
      ],
    ];
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    paths.forEach((segments, index) => {
      const gradient = ctx.createLinearGradient(
        segments[0][0],
        segments[0][1],
        segments[segments.length - 1][0],
        segments[segments.length - 1][1],
      );
      gradient.addColorStop(0, "rgba(168,85,247,0)");
      gradient.addColorStop(0.42, "rgba(168,85,247,0.56)");
      gradient.addColorStop(1, "rgba(96,165,250,0.12)");
      ctx.strokeStyle = gradient;
      ctx.lineWidth = Math.max(4, canvas.width * (index === 0 ? 0.006 : 0.004));
      ctx.beginPath();
      ctx.moveTo(segments[0][0], segments[0][1]);
      for (let i = 1; i < segments.length; i += 1) {
        ctx.lineTo(segments[i][0], segments[i][1]);
      }
      ctx.stroke();
    });
    ctx.fillStyle = "rgba(168,85,247,0.52)";
    ctx.beginPath();
    ctx.arc(startX, startY, Math.max(4, canvas.width * 0.004), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawCompareBackdropDecor = () => {
    if (!decorationProfile.showCompareBackdrop) return;
    ctx.save();
    const splitGradient = ctx.createLinearGradient(canvas.width * 0.4, canvas.height * 0.3, canvas.width, canvas.height);
    splitGradient.addColorStop(0, isLightTone ? "rgba(255,255,255,0)" : "rgba(15,23,42,0)");
    splitGradient.addColorStop(0.48, isLightTone ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.04)");
    splitGradient.addColorStop(1, isLightTone ? "rgba(255,255,255,0.42)" : "rgba(15,23,42,0.28)");
    ctx.fillStyle = splitGradient;
    ctx.beginPath();
    ctx.moveTo(canvas.width * 0.42, canvas.height * 0.28);
    ctx.lineTo(canvas.width, canvas.height * 0.18);
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(canvas.width * 0.58, canvas.height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const drawMeasurementGuidesDecor = () => {
    if (!decorationProfile.showMeasurementGuides || decorationGuideItems.length === 0) return;
    const anchors = [
      { x: canvas.width * 0.37, y: canvas.height * 0.63, tx: canvas.width * 0.08, ty: canvas.height * 0.28 },
      { x: canvas.width * 0.63, y: canvas.height * 0.62, tx: canvas.width * 0.76, ty: canvas.height * 0.36 },
      { x: canvas.width * 0.43, y: canvas.height * 0.82, tx: canvas.width * 0.09, ty: canvas.height * 0.72 },
      { x: canvas.width * 0.7, y: canvas.height * 0.81, tx: canvas.width * 0.79, ty: canvas.height * 0.75 },
    ];
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.max(11, canvas.width * 0.0105)}px ${canvasFontFamily}`;
    decorationGuideItems.forEach((item, index) => {
      const anchor = anchors[index];
      if (!anchor) return;
      const elbowX = index % 2 === 0 ? anchor.x : anchor.tx - canvas.width * 0.03;
      ctx.strokeStyle = isLightTone ? "rgba(71,85,105,0.38)" : "rgba(255,255,255,0.28)";
      ctx.lineWidth = Math.max(1, canvas.width * 0.0012);
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(elbowX, anchor.ty);
      ctx.lineTo(anchor.tx, anchor.ty);
      ctx.stroke();
      ctx.fillStyle = colors.accent;
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, Math.max(3, canvas.width * 0.0026), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = isLightTone ? "rgba(51,65,85,0.84)" : "rgba(248,250,252,0.82)";
      const maxWidth = canvas.width * 0.16;
      const lines = wrapCanvasText(ctx, item, maxWidth).slice(0, 2);
      lines.forEach((line, lineIndex) => {
        ctx.fillText(line, anchor.tx, anchor.ty + lineIndex * Math.max(14, canvas.height * 0.018), maxWidth);
      });
    });
    ctx.restore();
  };

  const drawBottomThumbnailStripDecor = () => {
    if (!decorationProfile.showBottomThumbnailStrip || templateId === "spec-band") return;
    const stripY = canvas.height * 0.8;
    const stripX = canvas.width * 0.04;
    const gap = canvas.width * 0.014;
    const thumbW = (canvas.width * 0.92 - gap * 2) / 3;
    const thumbH = canvas.height * 0.12;
    [0.18, 0.5, 0.82].forEach((focusX, index) => {
      const x = stripX + index * (thumbW + gap);
      const y = stripY;
      ctx.save();
      ctx.fillStyle = isLightTone ? "rgba(255,255,255,0.88)" : "rgba(15,23,42,0.52)";
      ctx.strokeStyle = isLightTone ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.12)";
      roundRect(x, y, thumbW, thumbH, Math.max(16, canvas.width * 0.014));
      ctx.fill();
      ctx.stroke();
      roundRect(x + 2, y + 2, thumbW - 4, thumbH - 4, Math.max(14, canvas.width * 0.012));
      ctx.clip();
      const sourceW = canvas.width * 0.28;
      const sourceH = canvas.height * 0.24;
      const sourceX = Math.max(0, Math.min(canvas.width - sourceW, canvas.width * focusX - sourceW / 2));
      const sourceY = canvas.height * (index === 1 ? 0.2 : 0.46);
      ctx.drawImage(
        image,
        sourceX,
        Math.max(0, Math.min(canvas.height - sourceH, sourceY)),
        sourceW,
        sourceH,
        x,
        y,
        thumbW,
        thumbH,
      );
      ctx.restore();
    });
  };

  const drawCornerStamp = () => {
    if (!decorationProfile.cornerStamp) return;
    const stampHeight = Math.max(22, panel.h * 0.04);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${Math.max(10, canvas.width * 0.0098)}px ${canvasFontFamily}`;
    const stampWidth = Math.max(
      stampHeight * 2.1,
      ctx.measureText(decorationProfile.cornerStamp).width + stampHeight * 1.05,
    );
    const stampX = panel.x + panel.w - stampWidth - panel.w * 0.05;
    const stampY = panel.y + panel.h * 0.04;
    ctx.fillStyle = isLightTone ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.05)";
    ctx.strokeStyle = colors.cardStroke;
    roundRect(stampX, stampY, stampWidth, stampHeight, stampHeight / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = isLightTone ? "rgba(71,85,105,0.86)" : "rgba(248,250,252,0.58)";
    ctx.fillText(
      decorationProfile.cornerStamp,
      stampX + stampWidth / 2,
      stampY + stampHeight / 2,
      stampWidth - stampHeight * 0.3,
    );
    ctx.restore();
  };

  const drawAnnotationRail = () => {
    if (!decorationProfile.showAnnotationRail) return;
    const railX =
      templateId === "hero-right"
        ? panel.x + panel.w * 0.06
        : panel.x + panel.w * 0.94;
    const railTop = panel.y + panel.h * 0.16;
    const railBottom = panel.y + panel.h * 0.9;
    ctx.save();
    ctx.strokeStyle = isLightTone ? "rgba(148,163,184,0.62)" : "rgba(255,255,255,0.22)";
    ctx.lineWidth = Math.max(1.1, canvas.width * 0.0012);
    ctx.beginPath();
    ctx.moveTo(railX, railTop);
    ctx.lineTo(railX, railBottom);
    ctx.stroke();

    [railTop, railTop + (railBottom - railTop) * 0.45, railBottom].forEach((pointY) => {
      ctx.fillStyle = colors.accent;
      ctx.beginPath();
      ctx.arc(railX, pointY, Math.max(4, panel.w * 0.012), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isLightTone ? "rgba(255,255,255,0.92)" : "rgba(15,23,42,0.5)";
      ctx.lineWidth = Math.max(2, canvas.width * 0.0024);
      ctx.stroke();
    });
    ctx.restore();
  };

  const drawHeaderMeta = () => {
    if (!decorationProfile.showHeaderMeta || (!roleLabel && !headerMetaText)) return;
    const barHeight = decorationProfile.compactPanel
      ? Math.max(18, panel.h * 0.05)
      : Math.max(22, panel.h * 0.036);
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = colors.accent;
    roundRect(contentLeft, cursorY + barHeight * 0.42, Math.max(16, panel.w * 0.032), Math.max(3, barHeight * 0.12), Math.max(2, barHeight * 0.06));
    ctx.fill();

    ctx.font = `700 ${Math.max(11, canvas.width * 0.0105)}px ${canvasFontFamily}`;
    ctx.fillStyle = colors.primary;
    ctx.fillText(
      roleLabel,
      contentLeft + Math.max(22, panel.w * 0.046),
      cursorY + barHeight / 2,
      contentWidth * 0.44,
    );

    if (headerMetaText) {
      ctx.font = `500 ${Math.max(10, canvas.width * 0.0098)}px ${canvasFontFamily}`;
      ctx.fillStyle = colors.tertiary;
      ctx.textAlign = "right";
      ctx.fillText(
        headerMetaText,
        contentLeft + contentWidth,
        cursorY + barHeight / 2,
        contentWidth * 0.5,
      );
    }
    if (!decorationProfile.compactPanel) {
      ctx.strokeStyle = colors.panelDash;
      ctx.lineWidth = Math.max(1, canvas.width * 0.0011);
      ctx.beginPath();
      ctx.moveTo(contentLeft, cursorY + barHeight + Math.max(4, panel.h * 0.006));
      ctx.lineTo(contentLeft + contentWidth, cursorY + barHeight + Math.max(4, panel.h * 0.006));
      ctx.stroke();
    }
    ctx.restore();
    cursorY += barHeight + Math.max(10, panel.h * (decorationProfile.compactPanel ? 0.016 : 0.02));
    ctx.textAlign = align as CanvasTextAlign;
  };

  const drawSectionTitle = (
    title: string,
    sectionKey?: "featureTags" | "stats" | "comparison" | "bullets",
  ) => {
    const value = String(title || "").trim();
    if (!value) return;
    const titleHeight = Math.max(18, panel.h * 0.032);
    cursorY += Math.max(4, panel.h * 0.006);
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.max(11, canvas.width * 0.0105)}px ${canvasFontFamily}`;
    const sectionNumber = sectionKey ? sectionOrder[sectionKey] : undefined;
    const prefixText =
      decorationProfile.showSectionNumbers && sectionNumber
        ? String(sectionNumber).padStart(2, "0")
        : "•";
    const prefixWidth = Math.max(titleHeight * 0.86, ctx.measureText(prefixText).width + titleHeight * 0.38);
    ctx.fillStyle = colors.chipBg;
    ctx.strokeStyle = colors.cardStroke;
    roundRect(contentLeft, cursorY + titleHeight * 0.1, prefixWidth, titleHeight * 0.82, titleHeight / 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = `800 ${Math.max(10, canvas.width * 0.0096)}px ${canvasFontFamily}`;
    ctx.fillStyle = colors.tertiary;
    ctx.fillText(
      prefixText,
      contentLeft + prefixWidth / 2,
      cursorY + titleHeight * 0.54,
      prefixWidth - titleHeight * 0.2,
    );
    ctx.font = `700 ${Math.max(11, canvas.width * 0.0105)}px ${canvasFontFamily}`;
    ctx.fillStyle = colors.secondary;
    ctx.fillText(
      value,
      contentLeft + prefixWidth + titleHeight * 0.42,
      cursorY + titleHeight * 0.52,
      contentWidth * 0.48,
    );
    ctx.strokeStyle = colors.cardStroke;
    ctx.lineWidth = Math.max(1, canvas.width * 0.0012);
    ctx.beginPath();
    ctx.moveTo(contentLeft + prefixWidth + titleHeight * 1.9, cursorY + titleHeight * 0.56);
    ctx.lineTo(contentLeft + contentWidth, cursorY + titleHeight * 0.56);
    ctx.stroke();
    ctx.restore();
    cursorY += titleHeight + Math.max(6, panel.h * 0.008);
    ctx.textAlign = align as CanvasTextAlign;
  };

  const loadFeatureIcon = async (): Promise<HTMLImageElement | null> => {
    if (!overlayState.featureTagIconUrl) return null;
    try {
      return await loadImageElement(overlayState.featureTagIconUrl);
    } catch (error) {
      throw new Error(
        isCanvasSecurityRelatedError(error)
          ? "标签图标来源不允许浏览器绘制，无法继续生成成片。请重新上传图标后再试。"
          : `标签图标加载失败，请重新上传后再试。${getUnknownErrorMessage(error) ? ` ${getUnknownErrorMessage(error)}` : ""}`,
      );
    }
  };

  const drawBadge = () => {
    const text = String(overlayState.badge || "").trim();
    if (!text) return;
    setText(Math.max(13, canvas.width * 0.0125), "700", colors.secondary);
    const textWidth = Math.min(contentWidth, ctx.measureText(text).width + panel.w * 0.065);
    const badgeHeight = Math.max(26, canvas.height * 0.034);
    const badgeX =
      align === "center"
        ? contentCenter - textWidth / 2
        : align === "right"
          ? contentRight - textWidth
          : contentLeft;
    ctx.save();
    ctx.fillStyle = colors.chipBg;
    ctx.strokeStyle = colors.cardStroke;
    roundRect(badgeX, cursorY, textWidth, badgeHeight, badgeHeight / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colors.secondary;
    ctx.textAlign = "center";
    ctx.fillText(text, badgeX + textWidth / 2, cursorY + badgeHeight * 0.18, textWidth - badgeHeight * 0.4);
    ctx.restore();
    cursorY += badgeHeight + Math.max(14, panel.h * 0.022);
  };

  const drawFeatureChips = async () => {
    if (featureTags.length === 0) return;
    drawSectionTitle(featureTitle, "featureTags");
    const iconImage = await loadFeatureIcon();
    const chipHeight = Math.max(28, canvas.height * 0.036);
    const chipGap = Math.max(8, panel.w * 0.016);
    let chipX = contentLeft;
    let chipY = cursorY;
    ctx.textAlign = "left";
    ctx.font = `700 ${Math.max(15, canvas.width * 0.015)}px ${canvasFontFamily}`;
    for (const tag of featureTags) {
      const text = String(tag || "").trim();
      if (!text) continue;
      const iconSize = iconImage ? chipHeight * 0.46 : chipHeight * 0.18;
      const chipWidth = Math.min(
        contentWidth,
        ctx.measureText(text).width + chipHeight * 1.05 + (iconImage ? iconSize * 0.8 : 0),
      );
      if (chipX + chipWidth > contentLeft + contentWidth) {
        chipX = contentLeft;
        chipY += chipHeight + chipGap;
      }
      ctx.save();
      ctx.fillStyle = colors.chipBg;
      ctx.strokeStyle = colors.cardStroke;
      roundRect(chipX, chipY, chipWidth, chipHeight, chipHeight / 2);
      ctx.fill();
      ctx.stroke();
      if (iconImage) {
        ctx.save();
        roundRect(chipX + chipHeight * 0.22, chipY + chipHeight * 0.18, iconSize, iconSize, Math.max(4, iconSize * 0.24));
        ctx.clip();
        ctx.drawImage(
          iconImage,
          chipX + chipHeight * 0.22,
          chipY + chipHeight * 0.18,
          iconSize,
          iconSize,
        );
        ctx.restore();
      } else {
        ctx.fillStyle = colors.accent;
        ctx.beginPath();
        ctx.arc(
          chipX + chipHeight * 0.34,
          chipY + chipHeight / 2,
          Math.max(3, chipHeight * 0.1),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.fillStyle = colors.primary;
      ctx.fillText(
        text,
        chipX + chipHeight * 0.58 + (iconImage ? iconSize * 0.82 : 0),
        chipY + chipHeight * 0.22,
        chipWidth - chipHeight * 0.82,
      );
      ctx.restore();
      chipX += chipWidth + chipGap;
    }
    cursorY = chipY + chipHeight + Math.max(14, panel.h * 0.022);
    ctx.textAlign = align as CanvasTextAlign;
  };

  const drawPriceBlock = () => {
    if (
      !String(overlayState.priceLabel || "").trim() &&
      !String(overlayState.priceValue || "").trim() &&
      !String(overlayState.priceNote || "").trim()
    ) {
      return;
    }
    cursorY += Math.max(8, panel.h * 0.012);
    const boxHeight = Math.max(112, panel.h * 0.168);
    ctx.save();
    const boxGradient = ctx.createLinearGradient(
      contentLeft,
      cursorY,
      contentLeft + contentWidth,
      cursorY + boxHeight,
    );
    boxGradient.addColorStop(0, isLightTone ? "rgba(255,255,255,0.94)" : "rgba(255,255,255,0.12)");
    boxGradient.addColorStop(0.42, isLightTone ? "rgba(255,247,237,0.86)" : "rgba(255,255,255,0.05)");
    boxGradient.addColorStop(1, colors.cardBg);
    ctx.fillStyle = boxGradient;
    ctx.strokeStyle = colors.cardStroke;
    roundRect(contentLeft, cursorY, contentWidth, boxHeight, Math.max(24, radius * 0.8));
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = isLightTone ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.12)";
    roundRect(contentLeft + contentWidth * 0.05, cursorY, contentWidth * 0.5, Math.max(2, boxHeight * 0.018), Math.max(1, boxHeight * 0.01));
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = isLightTone ? 0.85 : 0.18;
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(
      contentLeft + contentWidth - boxHeight * 0.12,
      cursorY + boxHeight * 0.18,
      boxHeight * 0.22,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();

    const stampHeight = Math.max(20, boxHeight * 0.2);
    const stampText = decorationProfile.cornerStamp || "PRICE";
    ctx.font = `900 ${Math.max(10, canvas.width * 0.0098)}px ${canvasFontFamily}`;
    const stampWidth = Math.max(stampHeight * 1.9, ctx.measureText(stampText).width + stampHeight * 0.95);
    ctx.fillStyle = isLightTone ? "rgba(255,247,237,0.94)" : "rgba(242,179,111,0.12)";
    ctx.strokeStyle = isLightTone ? "rgba(251,146,60,0.22)" : "rgba(242,179,111,0.14)";
    roundRect(
      contentLeft + contentWidth - stampWidth - boxHeight * 0.18,
      cursorY + boxHeight * 0.16,
      stampWidth,
      stampHeight,
      stampHeight / 2,
    );
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = isLightTone ? "rgba(194,65,12,0.88)" : "rgba(255,244,214,0.88)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      stampText,
      contentLeft + contentWidth - stampWidth / 2 - boxHeight * 0.18,
      cursorY + boxHeight * 0.16 + stampHeight / 2,
      stampWidth - stampHeight * 0.22,
    );

    let localY = cursorY + boxHeight * 0.26;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    if (overlayState.priceLabel) {
      ctx.font = `700 ${Math.max(12, canvas.width * 0.0118)}px ${canvasFontFamily}`;
      ctx.fillStyle = colors.tertiary;
      ctx.fillText(
        String(overlayState.priceLabel).trim(),
        contentLeft + boxHeight * 0.18,
        localY,
        contentWidth - boxHeight * 0.32,
      );
      localY += Math.max(18, boxHeight * 0.22);
    }
    if (overlayState.priceValue) {
      ctx.font = `900 ${Math.max(42, canvas.width * 0.039)}px ${canvasFontFamily}`;
      ctx.fillStyle = colors.primary;
      ctx.fillText(
        String(overlayState.priceValue).trim(),
        contentLeft + boxHeight * 0.18,
        localY,
        contentWidth - boxHeight * 0.32,
      );
      localY += Math.max(36, boxHeight * 0.4);
    }
    if (overlayState.priceNote) {
      localY += Math.max(4, boxHeight * 0.04);
      ctx.strokeStyle = isLightTone ? "rgba(148,163,184,0.16)" : "rgba(255,255,255,0.08)";
      ctx.lineWidth = Math.max(1, canvas.width * 0.0012);
      ctx.beginPath();
      ctx.moveTo(contentLeft + boxHeight * 0.18, localY);
      ctx.lineTo(contentLeft + contentWidth - boxHeight * 0.18, localY);
      ctx.stroke();
      localY += Math.max(10, boxHeight * 0.09);
      ctx.font = `500 ${Math.max(12, canvas.width * 0.0115)}px ${canvasFontFamily}`;
      ctx.fillStyle = colors.tertiary;
      const lines = wrapCanvasText(ctx, String(overlayState.priceNote).trim(), contentWidth - boxHeight * 0.32).slice(0, 2);
      for (const line of lines) {
        ctx.fillText(line, contentLeft + boxHeight * 0.18, localY, contentWidth - boxHeight * 0.32);
        localY += Math.max(16, canvas.height * 0.022);
      }
    }
    ctx.restore();
    cursorY += boxHeight + Math.max(14, panel.h * 0.022);
    ctx.textAlign = align as CanvasTextAlign;
  };

  const drawStatsGrid = () => {
    if (stats.length === 0) return;
    drawSectionTitle("参数速览", "stats");
    const columns = stats.length === 1 ? 1 : 2;
    const cardGap = Math.max(10, panel.w * 0.018);
    const cardWidth = columns === 1 ? contentWidth : (contentWidth - cardGap) / 2;
    const cardHeight = Math.max(64, panel.h * 0.14);
    let maxY = cursorY;

    stats.forEach((item, index) => {
      const column = columns === 1 ? 0 : index % 2;
      const row = columns === 1 ? index : Math.floor(index / 2);
      const x = contentLeft + column * (cardWidth + cardGap);
      const y = cursorY + row * (cardHeight + cardGap);
      ctx.save();
      const statGradient = ctx.createLinearGradient(x, y, x, y + cardHeight);
      statGradient.addColorStop(0, isLightTone ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.10)");
      statGradient.addColorStop(1, colors.cardBg);
      ctx.fillStyle = statGradient;
      ctx.strokeStyle = colors.cardStroke;
      roundRect(x, y, cardWidth, cardHeight, Math.max(18, radius * 0.6));
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = colors.accent;
      roundRect(x, y, cardWidth, Math.max(4, cardHeight * 0.04), Math.max(2, cardHeight * 0.02));
      ctx.fill();
      ctx.save();
      ctx.globalAlpha = isLightTone ? 0.9 : 0.18;
      ctx.fillStyle = colors.accent;
      ctx.beginPath();
      ctx.arc(x + cardWidth * 0.84, y + cardHeight * 0.18, cardHeight * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      const pillW = Math.max(cardWidth * 0.16, canvas.width * 0.045);
      const pillH = Math.max(cardHeight * 0.18, canvas.height * 0.024);
      ctx.fillStyle = isLightTone ? "rgba(248,250,252,0.96)" : "rgba(255,255,255,0.09)";
      ctx.strokeStyle = colors.cardStroke;
      roundRect(x + cardWidth * 0.08, y + cardHeight * 0.14, pillW, pillH, pillH / 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = `900 ${Math.max(10, canvas.width * 0.01)}px ${canvasFontFamily}`;
      ctx.fillStyle = colors.tertiary;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        String(index + 1).padStart(2, "0"),
        x + cardWidth * 0.08 + pillW / 2,
        y + cardHeight * 0.14 + pillH / 2,
        pillW - 8,
      );
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      if (item.value) {
        ctx.font = `900 ${Math.max(24, canvas.width * 0.024)}px ${canvasFontFamily}`;
        ctx.fillStyle = colors.primary;
        ctx.fillText(item.value, x + cardWidth * 0.14, y + cardHeight * 0.38, cardWidth * 0.72);
      }
      if (item.label) {
        ctx.font = `600 ${Math.max(13, canvas.width * 0.012)}px ${canvasFontFamily}`;
        ctx.fillStyle = colors.secondary;
        const labelY = y + (item.value ? cardHeight * 0.66 : cardHeight * 0.42);
        const lines = wrapCanvasText(ctx, item.label, cardWidth * 0.72).slice(0, 2);
        lines.forEach((line, lineIndex) => {
          ctx.fillText(line, x + cardWidth * 0.14, labelY + lineIndex * (canvas.height * 0.02), cardWidth * 0.72);
        });
      }
      ctx.restore();
      maxY = Math.max(maxY, y + cardHeight);
    });

    cursorY = maxY + Math.max(14, panel.h * 0.022);
    ctx.textAlign = align as CanvasTextAlign;
  };

  const drawComparisonBoard = () => {
    if (!comparisonTitle && comparisonRows.length === 0) {
      return;
    }
    drawSectionTitle("对比说明", "comparison");
    const rowHeight = Math.max(42, panel.h * 0.08);
    const headerHeight = Math.max(26, panel.h * 0.04);
    const boardHeight =
      Math.max(86, panel.h * 0.13) +
      comparisonRows.length * (rowHeight + Math.max(8, panel.h * 0.012));
    ctx.save();
    const boardGradient = ctx.createLinearGradient(contentLeft, cursorY, contentLeft, cursorY + boardHeight);
    boardGradient.addColorStop(0, isLightTone ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.08)");
    boardGradient.addColorStop(1, colors.cardBg);
    ctx.fillStyle = boardGradient;
    ctx.strokeStyle = colors.cardStroke;
    roundRect(contentLeft, cursorY, contentWidth, boardHeight, Math.max(18, radius * 0.6));
    ctx.fill();
    ctx.stroke();
    let localY = cursorY + Math.max(14, panel.h * 0.02);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    if (comparisonTitle) {
      ctx.font = `800 ${Math.max(14, canvas.width * 0.013)}px ${canvasFontFamily}`;
      ctx.fillStyle = colors.secondary;
      ctx.fillText(
        comparisonTitle,
        contentLeft + contentWidth * 0.07,
        localY,
        contentWidth * 0.86,
      );
      localY += Math.max(22, panel.h * 0.03);
    }
    const headerX = contentLeft + contentWidth * 0.09;
    const headerW = contentWidth * 0.82;
    const labelX = headerX;
    const beforeX = headerX + headerW * 0.28;
    const afterX = headerX + headerW * 0.58;
    ctx.font = `900 ${Math.max(10, canvas.width * 0.0096)}px ${canvasFontFamily}`;
    ctx.fillStyle = colors.tertiary;
    ctx.fillText("项目", labelX, localY + headerHeight * 0.1, headerW * 0.2);
    if (comparisonRows.some((row) => row.before)) {
      ctx.fillText("前", beforeX, localY + headerHeight * 0.1, headerW * 0.18);
    }
    ctx.fillText("后", afterX, localY + headerHeight * 0.1, headerW * 0.2);
    localY += headerHeight;
    comparisonRows.forEach((row) => {
      ctx.save();
      const rowGradient = ctx.createLinearGradient(0, localY, 0, localY + rowHeight);
      rowGradient.addColorStop(0, isLightTone ? "rgba(248,250,252,0.98)" : "rgba(255,255,255,0.06)");
      rowGradient.addColorStop(1, isLightTone ? "rgba(248,250,252,0.78)" : "rgba(255,255,255,0.03)");
      ctx.fillStyle = rowGradient;
      ctx.strokeStyle = isLightTone ? "rgba(148,163,184,0.14)" : "rgba(255,255,255,0.06)";
      roundRect(
        contentLeft + contentWidth * 0.05,
        localY,
        contentWidth * 0.90,
        rowHeight,
        Math.max(14, radius * 0.44),
      );
      ctx.fill();
      ctx.stroke();
      const x = headerX;
      const innerW = headerW;
      ctx.font = `700 ${Math.max(13, canvas.width * 0.012)}px ${canvasFontFamily}`;
      ctx.fillStyle = colors.secondary;
      ctx.fillText(String(row.label || "对比项").trim(), x, localY + rowHeight * 0.18, innerW * 0.24);
      if (row.before) {
        ctx.font = `500 ${Math.max(12, canvas.width * 0.011)}px ${canvasFontFamily}`;
        ctx.fillStyle = colors.tertiary;
        ctx.fillText(String(row.before).trim(), x + innerW * 0.28, localY + rowHeight * 0.2, innerW * 0.22);
        const beforeWidth = Math.min(innerW * 0.22, ctx.measureText(String(row.before).trim()).width);
        ctx.strokeStyle = colors.tertiary;
        ctx.lineWidth = Math.max(1.2, canvas.width * 0.0014);
        ctx.beginPath();
        ctx.moveTo(x + innerW * 0.28, localY + rowHeight * 0.48);
        ctx.lineTo(x + innerW * 0.28 + beforeWidth, localY + rowHeight * 0.48);
        ctx.stroke();
        if (decorationProfile.emphasizeComparisonArrow) {
          const pillW = Math.max(innerW * 0.11, canvas.width * 0.048);
          const pillH = Math.max(rowHeight * 0.36, canvas.height * 0.022);
          const pillX = x + innerW * 0.49 - pillW / 2;
          const pillY = localY + rowHeight * 0.17;
          ctx.fillStyle = colors.accent;
          roundRect(pillX, pillY, pillW, pillH, pillH / 2);
          ctx.fill();
          ctx.font = `900 ${Math.max(10, canvas.width * 0.01)}px ${canvasFontFamily}`;
          ctx.fillStyle = isLightTone ? "#ffffff" : "#0f172a";
          ctx.textAlign = "center";
          ctx.fillText("UP", pillX + pillW / 2, pillY + pillH * 0.18, pillW - 6);
        }
      }
      ctx.fillStyle = isLightTone ? "rgba(255,247,237,0.92)" : "rgba(242,179,111,0.10)";
      ctx.strokeStyle = isLightTone ? "rgba(251,146,60,0.16)" : "rgba(242,179,111,0.12)";
      roundRect(
        x + (row.before ? innerW * 0.54 : innerW * 0.30),
        localY + rowHeight * 0.12,
        row.before ? innerW * 0.29 : innerW * 0.52,
        rowHeight * 0.76,
        Math.max(12, rowHeight * 0.28),
      );
      ctx.fill();
      ctx.stroke();
      ctx.font = `800 ${Math.max(13, canvas.width * 0.012)}px ${canvasFontFamily}`;
      ctx.fillStyle = colors.primary;
      ctx.fillText(
        String(row.after || "-").trim(),
        x + (row.before ? innerW * 0.56 : innerW * 0.32),
        localY + rowHeight * 0.18,
        row.before ? innerW * 0.26 : innerW * 0.48,
      );
      ctx.restore();
      localY += rowHeight + Math.max(8, panel.h * 0.012);
    });
    ctx.restore();
    cursorY += boardHeight + Math.max(14, panel.h * 0.022);
    ctx.textAlign = align as CanvasTextAlign;
  };

  const drawBullets = () => {
    if (bullets.length === 0) return;
    drawSectionTitle(bulletsTitle, "bullets");

    if (overlayState.bulletStyle === "chips") {
      const chipHeight = Math.max(30, canvas.height * 0.038);
      const chipGap = Math.max(8, panel.w * 0.016);
      let chipX = contentLeft;
      let chipY = cursorY;
      ctx.textAlign = "left";
      ctx.font = `700 ${Math.max(14, canvas.width * 0.013)}px ${canvasFontFamily}`;
      bullets.forEach((bullet, index) => {
        const text = String(bullet || "").trim();
        if (!text) return;
        const chipWidth = Math.min(
          contentWidth,
          ctx.measureText(text).width + chipHeight * 0.9,
        );
        if (chipX + chipWidth > contentLeft + contentWidth) {
          chipX = contentLeft;
          chipY += chipHeight + chipGap;
        }
        ctx.save();
        const chipGradient = ctx.createLinearGradient(chipX, chipY, chipX, chipY + chipHeight);
        chipGradient.addColorStop(0, isLightTone ? "rgba(255,255,255,0.94)" : "rgba(255,255,255,0.10)");
        chipGradient.addColorStop(1, colors.chipBg);
        ctx.fillStyle = chipGradient;
        ctx.strokeStyle = colors.cardStroke;
        roundRect(chipX, chipY, chipWidth, chipHeight, Math.max(12, chipHeight * 0.44));
        ctx.fill();
        ctx.stroke();
        if (decorationProfile.emphasizeBulletNumbers) {
          ctx.fillStyle = colors.accent;
          ctx.beginPath();
          ctx.arc(chipX + chipHeight * 0.28, chipY + chipHeight / 2, Math.max(6, chipHeight * 0.18), 0, Math.PI * 2);
          ctx.fill();
          ctx.font = `900 ${Math.max(10, canvas.width * 0.01)}px ${canvasFontFamily}`;
          ctx.fillStyle = isLightTone ? "#ffffff" : "#0f172a";
          ctx.textAlign = "center";
          ctx.fillText(String(index + 1), chipX + chipHeight * 0.28, chipY + chipHeight * 0.22);
          ctx.textAlign = "left";
        }
        ctx.fillStyle = colors.primary;
        ctx.fillText(
          text,
          chipX + (decorationProfile.emphasizeBulletNumbers ? chipHeight * 0.58 : chipHeight * 0.34),
          chipY + chipHeight * 0.22,
          chipWidth - chipHeight * 0.5,
        );
        ctx.restore();
        chipX += chipWidth + chipGap;
      });
      cursorY = chipY + chipHeight + Math.max(14, panel.h * 0.022);
      ctx.textAlign = align as CanvasTextAlign;
      return;
    }

    if (overlayState.bulletStyle === "cards") {
      const cardGap = Math.max(10, panel.w * 0.016);
      const cardHeight = Math.max(52, panel.h * 0.092);
      bullets.slice(0, 4).forEach((bullet, index) => {
        ctx.save();
        const bulletGradient = ctx.createLinearGradient(contentLeft, cursorY, contentLeft, cursorY + cardHeight);
        bulletGradient.addColorStop(0, isLightTone ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.10)");
        bulletGradient.addColorStop(1, colors.cardBg);
        ctx.fillStyle = bulletGradient;
        ctx.strokeStyle = colors.cardStroke;
        roundRect(contentLeft, cursorY, contentWidth, cardHeight, Math.max(16, radius * 0.5));
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = colors.accent;
        roundRect(contentLeft, cursorY, Math.max(8, contentWidth * 0.018), cardHeight, Math.max(4, contentWidth * 0.01));
        ctx.fill();
        if (decorationProfile.emphasizeBulletNumbers) {
          const pillW = Math.max(cardHeight * 0.34, canvas.width * 0.04);
          const pillH = Math.max(cardHeight * 0.28, canvas.height * 0.02);
          ctx.fillStyle = isLightTone ? "rgba(248,250,252,0.98)" : "rgba(255,255,255,0.08)";
          ctx.strokeStyle = colors.cardStroke;
          roundRect(contentLeft + contentWidth - pillW - cardHeight * 0.3, cursorY + cardHeight * 0.14, pillW, pillH, pillH / 2);
          ctx.fill();
          ctx.stroke();
          ctx.font = `900 ${Math.max(10, canvas.width * 0.01)}px ${canvasFontFamily}`;
          ctx.fillStyle = colors.tertiary;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            String(index + 1),
            contentLeft + contentWidth - pillW / 2 - cardHeight * 0.3,
            cursorY + cardHeight * 0.14 + pillH / 2,
            pillW - 4,
          );
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
        }
        ctx.font = `700 ${Math.max(14, canvas.width * 0.013)}px ${canvasFontFamily}`;
        ctx.fillStyle = colors.primary;
        const lines = wrapCanvasText(ctx, String(bullet || "").trim(), contentWidth - cardHeight * 1.1).slice(0, 2);
        lines.forEach((line, index) => {
          ctx.fillText(
            line,
            contentLeft + cardHeight * 0.58,
            cursorY + cardHeight * 0.18 + index * Math.max(16, canvas.height * 0.02),
            contentWidth - cardHeight * 0.92,
          );
        });
        ctx.restore();
        cursorY += cardHeight + cardGap;
      });
      cursorY += Math.max(6, panel.h * 0.01);
      return;
    }

    bullets.slice(0, 4).forEach((bullet, index) => {
      setText(Math.max(16, canvas.width * 0.015), "600", colors.primary);
      const prefix = decorationProfile.emphasizeBulletNumbers ? `${index + 1}. ` : "• ";
      const lines = wrapCanvasText(ctx, `${prefix}${String(bullet || "").trim()}`, contentWidth).slice(0, 2);
      for (const line of lines) {
        ctx.fillText(line, textAnchor, cursorY, contentWidth);
        cursorY += Math.max(18, canvas.height * 0.024);
      }
      cursorY += Math.max(6, panel.h * 0.008);
    });
  };

  const drawCta = () => {
    const text = String(overlayState.cta || "").trim();
    if (!text) return;
    const ctaHeight = Math.max(44, canvas.height * 0.056);
    const ctaFont = fitWrappedCanvasText(ctx, {
      text,
      maxWidth: Math.max(72, contentWidth - ctaHeight * 1.1),
      maxLines: 1,
      initialSize: Math.max(16, canvas.width * 0.015),
      minSize: Math.max(11, canvas.width * 0.011),
      weight: "800",
      fontFamily: canvasFontFamily,
    });
    ctx.font = `800 ${ctaFont.fontSize}px ${canvasFontFamily}`;
    const ctaText = ctaFont.lines[0] || text;
    const width = Math.min(
      contentWidth,
      ctx.measureText(ctaText).width + ctaHeight * 1.62,
    );
    const x =
      align === "center"
        ? contentCenter - width / 2
        : align === "right"
          ? contentRight - width
          : contentLeft;
    cursorY += Math.max(8, panel.h * 0.012);
    ctx.save();
    const ctaGradient = ctx.createLinearGradient(x, cursorY, x + width, cursorY + ctaHeight);
    ctaGradient.addColorStop(0, colors.accent);
    ctaGradient.addColorStop(1, isLightTone ? "#dc6f35" : "#d89b58");
    ctx.fillStyle = ctaGradient;
    ctx.strokeStyle = isLightTone ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.14)";
    roundRect(x, cursorY, width, ctaHeight, ctaHeight / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    roundRect(x + ctaHeight * 0.24, cursorY + ctaHeight * 0.16, ctaHeight * 0.66, ctaHeight * 0.68, ctaHeight * 0.34);
    ctx.fill();
    ctx.fillStyle = isLightTone ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.16)";
    ctx.beginPath();
    ctx.arc(x + width - ctaHeight * 0.42, cursorY + ctaHeight / 2, ctaHeight * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.ctaText;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${ctaFont.fontSize}px ${canvasFontFamily}`;
    ctx.fillText(
      ctaText,
      x + width / 2 - ctaHeight * 0.08,
      cursorY + ctaHeight / 2,
      width - ctaHeight * 0.9,
    );
    ctx.restore();
    cursorY += ctaHeight + Math.max(12, panel.h * 0.018);
    ctx.textAlign = align as CanvasTextAlign;
  };

  const drawLayerMap: Record<EcommerceOverlayLayerKind, () => Promise<void> | void> = {
    badge: drawBadge,
    headline: () =>
      drawTextLines(
        String(overlayState.headline || ""),
        decorationProfile.compactPanel
          ? Math.max(26, canvas.width * 0.03)
          : Math.max(34, canvas.width * 0.04),
        "900",
        colors.primary,
        {
          maxLines: templateId === "spec-band" ? 2 : 3,
          lineGap: Math.max(
            decorationProfile.compactPanel ? 7 : 10,
            canvas.height * (decorationProfile.compactPanel ? 0.007 : 0.01),
          ),
        },
      ),
    subheadline: () =>
      drawTextLines(
        String(overlayState.subheadline || ""),
        decorationProfile.compactPanel
          ? Math.max(12, canvas.width * 0.0122)
          : Math.max(15, canvas.width * 0.0148),
        "500",
        colors.secondary,
        {
          maxLines: templateId === "spec-band" ? 2 : 3,
          topGap: Math.max(6, panel.h * 0.008),
          lineGap: Math.max(
            decorationProfile.compactPanel ? 6 : 8,
            canvas.height * (decorationProfile.compactPanel ? 0.006 : 0.008),
          ),
        },
      ),
    featureTags: drawFeatureChips,
    price: drawPriceBlock,
    stats: drawStatsGrid,
    comparison: drawComparisonBoard,
    bullets: drawBullets,
    cta: drawCta,
  };
  const orderedLayers = getOrderedOverlayLayers(overlayState.layers).filter(
    (layer) => layer.visible !== false,
  );

  drawCompareBackdropDecor();
  drawAmbientGridDecor();
  drawSceneBeamDecor();
  drawMeasurementGuidesDecor();
  drawBottomThumbnailStripDecor();
  drawHeroRibbonDecor();
  drawDecorations();
  drawCornerStamp();
  drawAnnotationRail();
  drawHeaderMeta();
  for (const layer of orderedLayers) {
    await drawLayerMap[layer.kind]?.();
  }

  const footerPills = [
    String(overlayState.fontLabel || "").trim()
      ? `字体 ${String(overlayState.fontLabel).trim()}`
      : "",
    String(overlayState.featureTagIconLabel || "").trim()
      ? `图标 ${String(overlayState.featureTagIconLabel).trim()}`
      : "",
  ].filter(Boolean);

  if (footerPills.length > 0) {
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${Math.max(11, canvas.width * 0.0105)}px ${canvasFontFamily}`;
    const noteHeight = Math.max(24, canvas.height * 0.03);
    const noteY = panel.y + panel.h - noteHeight - panel.h * 0.05;
    let noteX = contentLeft;
    footerPills.forEach((noteText) => {
      const noteWidth = Math.min(contentWidth * 0.48, ctx.measureText(noteText).width + 26);
      ctx.fillStyle = colors.chipBg;
      ctx.strokeStyle = colors.cardStroke;
      roundRect(noteX, noteY, noteWidth, noteHeight, noteHeight / 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = colors.tertiary;
      ctx.fillText(noteText, noteX + 13, noteY + noteHeight / 2, noteWidth - 20);
      noteX += noteWidth + Math.max(8, panel.w * 0.014);
    });
    ctx.restore();
  }

  let blob: Blob;
  try {
    blob = await canvasToBlob(canvas, "image/png");
  } catch (error) {
    throw new Error(
      isCanvasSecurityRelatedError(error)
        ? "当前图片资源被浏览器跨域策略拦截，无法导出上字成片。请先把底图或图标保存到项目资产后再试。"
        : `上字成片导出失败。${getUnknownErrorMessage(error) ? ` ${getUnknownErrorMessage(error)}` : ""}`,
    );
  }

  let dataUrl = "";
  try {
    dataUrl = canvas.toDataURL("image/png");
  } catch {
    dataUrl = URL.createObjectURL(blob);
  }

  return {
    blob,
    dataUrl,
    mimeType: "image/png",
  };
};

const getProgressForStep = (
  step: EcommerceOneClickSessionState["step"],
): EcommerceOneClickSessionState["progress"] => {
  switch (step) {
    case "WAIT_PRODUCT":
      return { done: 0, total: 6, text: "等待上传商品图片。" };
    case "ANALYZE_PRODUCT":
      return { done: 2, total: 6, text: "商品分析已完成，请确认出图类型。" };
    case "SUPPLEMENT_INFO":
      return { done: 3, total: 6, text: "请补充并确认商品信息。" };
    case "ANALYZE_IMAGES":
      return { done: 4, total: 6, text: "请确认图片分析结果。" };
    case "PLAN_SCHEMES":
      return { done: 5, total: 6, text: "请确认方案分组与执行项。" };
    case "FINALIZE_PROMPTS":
      return { done: 5, total: 6, text: "请确认提示词与本轮默认模型。" };
    case "BATCH_GENERATE":
      return { done: 5, total: 6, text: "批量任务已就绪，可开始执行生成。" };
    case "DONE":
      return { done: 6, total: 6, text: "结果已生成，可继续筛选和导出。" };
    default:
      return { done: 0, total: 6, text: "等待上传商品图片。" };
  }
};

export function useWorkspaceEcommerceWorkflow(
  options: UseWorkspaceEcommerceWorkflowOptions,
) {
  const {
    addMessage,
    ecommerceState,
    ecommerceActions,
    ensureEcommerceSession,
    setEcommerceWorkflowError,
    setInputBlocks,
    setIsTyping,
  } = options;
  const runningActionKeysRef = useRef(new Set<string>());
  const textAnchorCacheRef = useRef(new Map<string, EcommerceTextAnchorHint[]>());

  const handleRunCompetitorVisionSmokeTest = useCallback(
    async (args?: {
      deckId?: string;
      imageIndex?: number;
      model?: string | null;
    }) => {
      const sessionId = ensureEcommerceSession();
      const session = ecommerceActions.getSession(sessionId);
      const decks = Array.isArray(session.competitorDecks)
        ? session.competitorDecks
        : [];

      const targetDeck =
        (args?.deckId
          ? decks.find((deck) => deck.id === args.deckId)
          : null) ||
        decks.find((deck) => Array.isArray(deck.images) && deck.images.length > 0) ||
        null;

      if (!targetDeck) {
        throw new Error("当前 session 里没有可用的竞品截图组。");
      }

      return runCompetitorVisionSmokeTest({
        deck: targetDeck,
        imageIndex: args?.imageIndex,
        model: args?.model,
      });
    },
    [ecommerceActions, ensureEcommerceSession],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const globalWindow = window as typeof window & {
      __jkRunCompetitorVisionSmokeTest?: (args?: {
        deckId?: string;
        imageIndex?: number;
        model?: string | null;
      }) => Promise<unknown>;
      __jkListCompetitorDecks?: () => Array<{
        id: string;
        name?: string;
        imageCount: number;
      }>;
    };

    const runHelper = (args?: {
      deckId?: string;
      imageIndex?: number;
      model?: string | null;
    }) => handleRunCompetitorVisionSmokeTest(args);
    const listHelper = () => {
      const sessionId = ensureEcommerceSession();
      const session = ecommerceActions.getSession(sessionId);
      return (session.competitorDecks || []).map((deck) => ({
        id: deck.id,
        name: deck.name,
        imageCount: Array.isArray(deck.images) ? deck.images.length : 0,
      }));
    };
    globalWindow.__jkRunCompetitorVisionSmokeTest = runHelper;
    globalWindow.__jkListCompetitorDecks = listHelper;

    return () => {
      if (globalWindow.__jkRunCompetitorVisionSmokeTest === runHelper) {
        delete globalWindow.__jkRunCompetitorVisionSmokeTest;
      }
      if (globalWindow.__jkListCompetitorDecks === listHelper) {
        delete globalWindow.__jkListCompetitorDecks;
      }
    };
  }, [ecommerceActions, ensureEcommerceSession, handleRunCompetitorVisionSmokeTest]);

  const pushWorkflowUiMessage = useCallback(
    (ui: WorkflowUiMessage, text = "电商一键工作流") => {
      addMessage({
        id: createWorkflowMessageId("ecom-workflow"),
        role: "model",
        text,
        kind: "workflow_ui",
        workflowUi: ui,
        timestamp: Date.now(),
      } as ChatMessage);
    },
    [addMessage],
  );
  const acquireActionLock = useCallback((key: string) => {
    if (runningActionKeysRef.current.has(key)) {
      return false;
    }
    runningActionKeysRef.current.add(key);
    return true;
  }, []);
  const releaseActionLock = useCallback((key: string) => {
    runningActionKeysRef.current.delete(key);
  }, []);

  const persistPlanDebugSnapshot = useCallback(
    (
      sessionId: string,
      stage: string,
      note: string,
      extra?: Record<string, unknown>,
    ) => {
      const session = ecommerceActions.getSession(sessionId);
      const mergedMeta = {
        step: session.step,
        progressText: String(session.progress.text || "").trim(),
        selectedTypeCount: session.recommendedTypes.filter((item) => item.selected).length,
        imageAnalysisCount: session.imageAnalyses.length,
        planGroupCount: session.planGroups.length,
        competitorDeckCount: session.competitorDecks.length,
        competitorAnalysisCount: session.competitorAnalyses.length,
        hasCompetitorPlanningContext: Boolean(session.competitorPlanningContext),
        ...(extra || {}),
      };

      console.info("[ecomPlanStageDebug]", {
        sessionId,
        stage,
        note,
        ...mergedMeta,
      });

      void persistEcommerceWorkflowDebugSnapshot({
        sessionId,
        stage,
        session,
        note: `${note} | ${JSON.stringify(mergedMeta).slice(0, 260)}`.slice(0, 380),
      });
    },
    [ecommerceActions],
  );

  const handleEcommerceResolveTextAnchors = useCallback(
    async (result: EcommerceResultItem): Promise<EcommerceTextAnchorHint[]> => {
      const cacheKey = String(result.url || "").trim();
      if (!cacheKey) {
        return [];
      }

      const cached = textAnchorCacheRef.current.get(cacheKey);
      if (cached) {
        return cached;
      }

      try {
        const dataUrl = await imageUrlToDataUrl(cacheKey);
        const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
        if (!matches) {
          throw new Error("Invalid image data URL.");
        }

        const response = await generateJsonResponse({
          model: "gpt-5.4",
          operation: "ecomTextAnchorDetection",
          queueKey: "ecomTextAnchorDetection",
          minIntervalMs: 1200,
          temperature: 0.1,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              anchors: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING },
                    role: { type: Type.STRING },
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                    width: { type: Type.NUMBER },
                    height: { type: Type.NUMBER },
                    align: { type: Type.STRING },
                    confidence: { type: Type.NUMBER },
                  },
                  required: ["x", "y", "width", "height"],
                },
              },
            },
            required: ["anchors"],
          },
          parts: [
            {
              inlineData: {
                mimeType: matches[1],
                data: matches[2],
              },
            },
            {
              text: [
                "Detect the main editable marketing text blocks in this ecommerce image.",
                "Return JSON only.",
                "For each visible text block, return: text, role, x, y, width, height, align, confidence.",
                "Coordinates must be normalized to 0..1 relative to the full image.",
                "Use role from: badge, headline, subheadline, featureTags, price, stats, comparison, bullets, cta, unknown.",
                "Return block-level boxes, not single-character boxes. Merge adjacent lines that clearly belong to the same editable block.",
                "Prefer the minimal set of marketing text groups that would be safe to erase and replace with editable layers.",
                "Preserve the natural grouping of ecommerce layouts such as headline plus subheadline, price cluster, bullet cluster, or CTA button text.",
                "Ignore tiny watermarks, logos, decorative micro text, packaging micro copy, interface chrome, and non-marketing labels.",
                "If a text block is heavily stylized but still looks like editable headline or selling copy, still return a coarse replacement-safe box.",
              ].join(" "),
            },
          ],
        });

        const parsed = normalizeTextAnchorHints(
          JSON.parse(response.text || '{"anchors":[]}'),
        );
        textAnchorCacheRef.current.set(cacheKey, parsed);
        return parsed;
      } catch (error) {
        console.warn("[ecomOverlay] text anchor detection failed", error);
        textAnchorCacheRef.current.set(cacheKey, []);
        return [];
      }
    },
    [],
  );

  const startEcommerceWorkflow = useCallback(() => {
    const sessionId = ensureEcommerceSession();
    ecommerceActions.reset(sessionId);
    ecommerceActions.setStep("WAIT_PRODUCT", sessionId);
    ecommerceActions.setProgress(
      { done: 0, total: 6, text: "等待上传商品图片。" },
      sessionId,
    );
    setEcommerceWorkflowError(null);

    pushWorkflowUiMessage(
      {
        type: "ecomOneClick.entry",
        productCount: 0,
      },
      "电商一键工作流已就绪。上传商品图片并补充一句简短说明后即可继续。",
    );
  }, [
    ecommerceActions,
    ensureEcommerceSession,
    pushWorkflowUiMessage,
    setEcommerceWorkflowError,
  ]);

  const syncPlanGroups = useCallback(
    (sessionId: string, groups: EcommercePlanGroup[]) => {
      const session = ecommerceActions.getSession(sessionId);
      const nextBatchJobs = cloneBatchJobs(
        buildBatchJobs(groups, session.batchJobs || [], session.platformMode),
      );
      const nextResults = cloneResultItems(collectBatchResults(nextBatchJobs));

      ecommerceActions.setPlanGroups(groups, sessionId);
      ecommerceActions.setBatchJobs(cloneBatchJobs(nextBatchJobs), sessionId);
      ecommerceActions.setResults(cloneResultItems(nextResults), sessionId);

      return {
        nextBatchJobs,
        nextResults,
      };
    },
    [ecommerceActions],
  );

  const patchResultCollections = useCallback(
    (
      sessionId: string,
      resultUrl: string,
      updater: (result: EcommerceResultItem) => EcommerceResultItem,
    ): EcommerceResultItem | null => {
      const session = ecommerceActions.getSession(sessionId);
      let updatedResult: EcommerceResultItem | null = null;

      const nextBatchJobs = session.batchJobs.map((job) => ({
        ...job,
        results: (job.results || []).map((result) => {
          if (result.url !== resultUrl) {
            return result;
          }
          updatedResult = updater(result);
          return updatedResult;
        }),
      }));

      const nextResults = session.results.map((result) => {
        if (result.url !== resultUrl) {
          return result;
        }
        updatedResult = updater(result);
        return updatedResult;
      });

      if (!updatedResult) {
        return null;
      }

      ecommerceActions.setBatchJobs(nextBatchJobs, sessionId);
      ecommerceActions.setResults(
        nextResults.length > 0
          ? cloneResultItems(nextResults)
          : cloneResultItems(collectBatchResults(nextBatchJobs)),
        sessionId,
      );

      return updatedResult;
    },
    [ecommerceActions],
  );

  const handleEcommercePrepareResultForCanvas = useCallback(
    async (input: EcommerceResultItem): Promise<EcommerceResultItem> => {
      const sessionId = ensureEcommerceSession();
      const session = ecommerceActions.getSession(sessionId);
      const target =
        session.results.find((item) => item.url === input.url) || input;
      const normalized = normalizeOverlayState(
        target.overlayState,
        target.overlayState,
      );

      if (!normalized) {
        return target;
      }

      const baseUrl = String(normalized.baseImageUrl || target.url || "").trim();
      if (!baseUrl) {
        return target;
      }

      const replacementRequested = (normalized.textContainerIntents || []).some(
        (item) => item.replacementMode === "replace-generated-text",
      );
      if (!replacementRequested) {
        return {
          ...target,
          overlayState: normalized,
        };
      }

      if (
        normalized.baseImageUrl &&
        normalized.baseImageUrl !== target.url
      ) {
        return {
          ...target,
          overlayState: normalized,
        };
      }

      const image = await loadImageElement(baseUrl);
      const anchorHints = await handleEcommerceResolveTextAnchors(target);
      const plan = buildEcommerceTextLayerPlan({
        overlayState: normalized,
        layoutMeta: target.layoutMeta,
        canvasWidth: image.naturalWidth || image.width,
        canvasHeight: image.naturalHeight || image.height,
        anchorHints,
      });
      const replacementBackgroundAnalysis = analyzeReplacementBackground({
        image,
        boxes: plan.replacementBoxes,
      });
      const replacementQuality = {
        ...plan.replacementPlanningSummary,
        backgroundKind: replacementBackgroundAnalysis.backgroundKind,
        eraseStrategy: replacementBackgroundAnalysis.eraseStrategy,
        confidence:
          plan.replacementPlanningSummary.confidence === "high" &&
          replacementBackgroundAnalysis.confidence !== "low"
            ? "high"
            : plan.replacementPlanningSummary.sourceMode === "template-only" ||
                replacementBackgroundAnalysis.confidence === "low"
              ? "low"
              : "medium",
        summary: [
          plan.replacementPlanningSummary.summary,
          replacementBackgroundAnalysis.summary,
        ]
          .filter(Boolean)
          .join(" "),
      } satisfies NonNullable<EcommerceOverlayState["replacementQuality"]>;

      if (plan.replacementBoxes.length === 0) {
        return {
          ...target,
          overlayState: normalizeOverlayState(
            {
              ...normalized,
              replacementQuality,
            },
            normalized,
          ),
        };
      }

      const cleanedImageUrl = await smartEditSkill({
        sourceUrl: baseUrl,
        maskImage: buildReplacementMaskDataUrl({
          width: image.naturalWidth || image.width,
          height: image.naturalHeight || image.height,
          boxes: plan.replacementBoxes,
        }),
        editType: "object-remove",
        parameters: {
          prompt: buildReplacementEditPrompt({
            backgroundKind: replacementQuality.backgroundKind,
            sourceMode: replacementQuality.sourceMode,
          }),
          preservePrompt:
            "Preserve the product identity, camera angle, composition, lighting, materials, and all unmasked pixels exactly. Do not add icons, labels, or extra decorations.",
          editModel: "gemini-3-pro-image-preview",
          aspectRatio: getClosestImageAspectRatio(
            image.naturalWidth || image.width,
            image.naturalHeight || image.height,
          ),
        },
      });

      if (!cleanedImageUrl) {
        throw new Error("底图擦字失败，未返回可用结果。");
      }

      let nextBaseImageUrl = cleanedImageUrl;
      let nextBaseAssetId: string | undefined;
      try {
        const response = await fetch(cleanedImageUrl);
        if (!response.ok) {
          throw new Error(`擦字结果下载失败：${response.status}`);
        }
        const blob = await response.blob();
        const file = new File(
          [blob],
          `${sanitizeGeneratedAssetFileName(target.label || "ecom-overlay-base")}-clean.${inferGeneratedImageExtension(blob.type || "image/png")}`,
          {
            type: blob.type || "image/png",
          },
        );
        const assetRef = await saveTopicAssetFromFile(sessionId, "result", file);
        const persistedUrl = await resolveTopicAssetRefUrl(assetRef);
        nextBaseImageUrl = persistedUrl || cleanedImageUrl;
        nextBaseAssetId = assetRef?.assetId || undefined;
      } catch (error) {
        console.warn("[ecomOverlay] persist cleaned base failed", error);
      }

      const updated = patchResultCollections(sessionId, target.url, (result) => ({
        ...result,
        overlayState: normalizeOverlayState(
          {
            ...(result.overlayState || normalized),
            baseImageUrl: nextBaseImageUrl,
            baseAssetId: nextBaseAssetId || result.overlayState?.baseAssetId || normalized.baseAssetId,
            replacementQuality,
            renderStatus:
              result.overlayState?.renderStatus === "error"
                ? undefined
                : result.overlayState?.renderStatus,
            renderStatusMessage:
              result.overlayState?.renderStatus === "error"
                ? undefined
                : result.overlayState?.renderStatusMessage,
          },
          result.overlayState || normalized,
        ),
      }));

      return (
        updated || {
          ...target,
          overlayState: normalizeOverlayState(
            {
              ...normalized,
              baseImageUrl: nextBaseImageUrl,
              baseAssetId: nextBaseAssetId || normalized.baseAssetId,
              replacementQuality,
            },
            normalized,
          ),
        }
      );
    },
    [
      ecommerceActions,
      ensureEcommerceSession,
      handleEcommerceResolveTextAnchors,
      patchResultCollections,
    ],
  );

  const requestSupplementQuestions = useCallback(
    async (
      sessionId: string,
      selectedTypes: EcommerceRecommendedType[],
      fallbackMode: "block" | "allow" | "force" = "block",
    ): Promise<{
      fields: EcommerceSupplementField[];
      mode: "ai" | "fallback";
      reason?: string;
    }> => {
      const session = ecommerceActions.getSession(sessionId);
      const supplementsResult = (await executeSkill(
        "ecomSupplementQuestions",
        {
          productImages: session.productImages.map((image) => ({
            id: image.id,
            url: image.url,
            name: image.name,
          })),
          brief: session.description,
          analysisSummary: session.analysisSummary,
          platformMode: session.platformMode,
          workflowMode: session.workflowMode,
          fallbackMode,
          recommendedTypes: selectedTypes.map((item) => ({
            id: item.id,
            title: item.title,
            selected: item.selected,
          })),
        },
      )) as {
        fields?: unknown;
        mode?: unknown;
        reason?: unknown;
      };

      const supplementFields = normalizeSupplementFields(
        supplementsResult?.fields,
      );
      if (supplementFields.length === 0) {
        throw new Error("补充信息问题为空，当前已阻止自动兜底。");
      }

      return {
        fields: supplementFields,
        mode: supplementsResult?.mode === "fallback" ? "fallback" : "ai",
        reason:
          typeof supplementsResult?.reason === "string"
            ? supplementsResult.reason
            : undefined,
      };
    },
    [ecommerceActions],
  );

  const requestPlanGroups = useCallback(
    async (
      sessionId: string,
      selectedTypes: EcommerceRecommendedType[],
      imageAnalyses: EcommerceImageAnalysis[],
      fallbackMode: "block" | "allow" | "force" = "block",
    ): Promise<{
      groups: EcommercePlanGroup[];
      review: EcommerceStageReview;
      mode: "ai" | "fallback";
      reason?: string;
    }> => {
      const session = ecommerceActions.getSession(sessionId);
      const planningStageBlock = buildPlanningStageContextBlock({
        session,
        selectedTypes: selectedTypes.map((item) => ({
          id: item.id,
          title: item.title,
          imageCount: getTargetPlanItemCount(item.imageCount, session.workflowMode),
        })),
      });

      persistPlanDebugSnapshot(
        sessionId,
        "plan-groups-request",
        "方案规划请求开始。",
        {
          fallbackMode,
          inputSelectedTypeCount: selectedTypes.length,
          inputImageAnalysisCount: imageAnalyses.length,
        },
      );

      const planResult = (await executeSkill("ecomGeneratePlans", {
        selectedTypes: selectedTypes.map((item) => ({
          id: item.id,
          title: item.title,
          imageCount: getTargetPlanItemCount(
            item.imageCount,
            session.workflowMode,
          ),
        })),
        brief: appendPlanGenerationContextText(
          session.description,
          planningStageBlock,
        ),
        platformMode: session.platformMode,
        workflowMode: session.workflowMode,
        supplementSummary: summarizeSupplementFields(session.supplementFields),
        fallbackMode,
        imageAnalyses: imageAnalyses.map((item) => ({
          imageId: item.imageId,
          title: item.title,
          description: item.description,
          analysisConclusion: item.analysisConclusion,
        })),
      })) as {
        groups?: unknown;
        review?: unknown;
        mode?: unknown;
        reason?: unknown;
      };

      const rawGroupsValue = planResult?.groups;
      const rawGroupsShape = Array.isArray(rawGroupsValue)
        ? `array:${rawGroupsValue.length}`
        : rawGroupsValue && typeof rawGroupsValue === "object"
          ? `object:${Object.keys(rawGroupsValue as Record<string, unknown>)
              .slice(0, 8)
              .join("|")}`
          : typeof rawGroupsValue;
      const rawGroupsPreview = (() => {
        try {
          return JSON.stringify(rawGroupsValue).slice(0, 200);
        } catch {
          return String(rawGroupsValue || "").slice(0, 200);
        }
      })();
      persistPlanDebugSnapshot(
        sessionId,
        "plan-groups-raw-result",
        "方案规划原始返回已拿到，准备判断是模型空结果还是归一化过滤。",
        {
          fallbackMode,
          resultMode: planResult?.mode === "fallback" ? "fallback" : "ai",
          hasGroupsKey:
            Boolean(planResult) &&
            Object.prototype.hasOwnProperty.call(planResult, "groups"),
          rawGroupsShape,
          rawGroupsPreview,
          reviewShape:
            planResult?.review && typeof planResult.review === "object"
              ? `object:${Object.keys(planResult.review as Record<string, unknown>)
                  .slice(0, 8)
                  .join("|")}`
              : typeof planResult?.review,
          reason:
            typeof planResult?.reason === "string"
              ? planResult.reason.slice(0, 120)
              : undefined,
        },
      );

      const rawPlanGroups = normalizePlanGroups(planResult?.groups);
      persistPlanDebugSnapshot(
        sessionId,
        "plan-groups-normalized",
        "方案规划结果已返回，准备归一化并注入竞品上下文。",
        {
          fallbackMode,
          resultMode: planResult?.mode === "fallback" ? "fallback" : "ai",
          rawGroupCount: rawPlanGroups.length,
          rawGroupsShape,
          reason:
            typeof planResult?.reason === "string"
              ? planResult.reason.slice(0, 120)
              : undefined,
        },
      );

      const normalizedPlanGroups = enrichPlanGroupsWithCompetitorContext(
        enrichPlanGroupsWithLegacyProfiles(rawPlanGroups),
        session.competitorPlanningContext,
        {
          planningMode: getPlanningStageCompetitorMode(session),
          generationMode: getGenerationStageCompetitorMode(session),
        },
      );
      const nextPlanGroups = syncPlanGroupReferences(
        normalizedPlanGroups,
        imageAnalyses,
      );
      if (nextPlanGroups.length === 0) {
        persistPlanDebugSnapshot(
          sessionId,
          "plan-groups-empty",
          "方案规划返回后被归一化为空。",
          {
            fallbackMode,
            rawGroupCount: rawPlanGroups.length,
            enrichedGroupCount: normalizedPlanGroups.length,
            referencedGroupCount: nextPlanGroups.length,
          },
        );
        throw new Error("方案分组为空，当前已阻止自动兜底。");
      }

      return {
        groups: nextPlanGroups,
        review:
          normalizeStageReview(planResult?.review) ||
          buildDefaultStageReview("plan", nextPlanGroups.length),
        mode: planResult?.mode === "fallback" ? "fallback" : "ai",
        reason:
          typeof planResult?.reason === "string"
            ? planResult.reason
            : undefined,
      };
    },
    [ecommerceActions, persistPlanDebugSnapshot, syncPlanGroupReferences],
  );

  const handleEcommerceSyncBatchPrompt = useCallback(
    async (planItemId: string, prompt: string) => {
      const sessionId = ensureEcommerceSession();
      const session = ecommerceActions.getSession(sessionId);
      const trimmedPrompt = String(prompt || "").trim();
      if (!trimmedPrompt) return;

      let planUpdated = false;
      const nextGroups = session.planGroups.map((group) => ({
        ...group,
        items: group.items.map((item) => {
          if (item.id !== planItemId || item.promptOutline === trimmedPrompt) {
            return item;
          }
          planUpdated = true;
          return {
            ...item,
            promptOutline: trimmedPrompt,
            status: "ready" as const,
          };
        }),
      }));

      let batchUpdated = false;
      const nextBatchJobs = session.batchJobs.map((job) => {
        if (job.planItemId !== planItemId) {
          return job;
        }

        const hasResults = (job.results || []).length > 0;
        if (
          job.prompt === trimmedPrompt &&
          job.finalPrompt === trimmedPrompt &&
          job.promptStatus === "done" &&
          (!hasResults || (job.status === "idle" && job.imageStatus === "idle")) &&
          !job.error
        ) {
          return job;
        }

        batchUpdated = true;
        return {
          ...job,
          prompt: trimmedPrompt,
          finalPrompt: trimmedPrompt,
          promptStatus: "done" as const,
          status: "idle" as const,
          imageStatus: "idle" as const,
          error: undefined,
          generationMeta: {
            ...(job.generationMeta || {}),
            aspectRatio:
              nextGroups
                .flatMap((group) => group.items)
                .find((item) => item.id === planItemId)?.ratio ||
              job.generationMeta?.aspectRatio,
            promptHash: buildPromptHash(trimmedPrompt),
            promptSummary: summarizePromptSnapshot(trimmedPrompt),
            promptText: trimmedPrompt,
          },
        };
      });

      if (!planUpdated && !batchUpdated) {
        return;
      }

      const nextResults = cloneResultItems(collectBatchResults(nextBatchJobs));
      const done = nextBatchJobs.filter((job) => job.status === "done").length;

      ecommerceActions.setPlanGroups(nextGroups, sessionId);
      ecommerceActions.setBatchJobs(nextBatchJobs, sessionId);
      ecommerceActions.setResults(nextResults, sessionId);

      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.plans",
          groups: nextGroups,
          review: session.planReview || undefined,
        },
        "已同步最新提示词到方案定稿区。",
      );
      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.batch",
          jobs: nextBatchJobs,
          done,
          total: nextBatchJobs.length,
          view: session.step === "FINALIZE_PROMPTS" ? "finalize" : "execute",
        },
        "当前条目提示词已更新，旧结果先保留，可继续重跑。",
      );
    },
    [
      ecommerceActions,
      ensureEcommerceSession,
      pushWorkflowUiMessage,
    ],
  );

  const handleEcommerceSyncBatchPlanItemRatio = useCallback(
    async (planItemId: string, ratio: string) => {
      const sessionId = ensureEcommerceSession();
      const session = ecommerceActions.getSession(sessionId);
      const trimmedRatio = String(ratio || "").trim();
      if (!trimmedRatio) return;

      let planUpdated = false;
      const nextGroups = session.planGroups.map((group) => ({
        ...group,
        items: group.items.map((item) => {
          if (item.id !== planItemId || item.ratio === trimmedRatio) {
            return item;
          }
          planUpdated = true;
          return {
            ...item,
            ratio: trimmedRatio,
            status: "ready" as const,
          };
        }),
      }));

      if (!planUpdated) {
        return;
      }

      let batchUpdated = false;
      const nextBatchJobs = session.batchJobs.map((job) => {
        if (job.planItemId !== planItemId) {
          return job;
        }
        batchUpdated = true;
        return {
          ...job,
          status: "idle" as const,
          imageStatus: "idle" as const,
          error: undefined,
          generationMeta: {
            ...(job.generationMeta || {}),
            aspectRatio: trimmedRatio,
          },
        };
      });

      const nextResults = cloneResultItems(collectBatchResults(nextBatchJobs));
      const done = nextBatchJobs.filter((job) => job.status === "done").length;

      ecommerceActions.setPlanGroups(nextGroups, sessionId);
      if (batchUpdated) {
        ecommerceActions.setBatchJobs(nextBatchJobs, sessionId);
        ecommerceActions.setResults(nextResults, sessionId);
      }

      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.plans",
          groups: nextGroups,
          review: session.planReview || undefined,
        },
        `已把当前方案比例改为 ${trimmedRatio}。`,
      );
      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.batch",
          jobs: batchUpdated ? nextBatchJobs : session.batchJobs,
          done,
          total: session.batchJobs.length,
          view: session.step === "FINALIZE_PROMPTS" ? "finalize" : "execute",
        },
        "比例已同步到执行区，旧结果先保留，可直接重跑。",
      );
    },
    [
      ecommerceActions,
      ensureEcommerceSession,
      pushWorkflowUiMessage,
    ],
  );

  const handleEcommerceWorkflowSend = useCallback(
    async ({
      text,
      attachments,
      platformMode = "general",
      workflowMode = "professional",
    }: HandleWorkflowSendArgs) => {
      if (attachments.length === 0) {
        startEcommerceWorkflow();
        return;
      }

      const sessionId = ensureEcommerceSession();
      const lockKey = `${sessionId}:workflow-send`;
      if (!acquireActionLock(lockKey)) {
        return;
      }
      const previousSession = ecommerceActions.getSession(sessionId);
      const preservedCompetitorDecks = (
        previousSession.competitorDecks || []
      ).filter((deck) => Array.isArray(deck.images) && deck.images.length > 0);
      const trimmedBrief = text.trim();
      const productFiles = attachments.slice(0, 9);
      setIsTyping(true);
      setEcommerceWorkflowError(null);

      try {
        ecommerceActions.reset(sessionId);
        ecommerceActions.setPlatformMode(platformMode, sessionId);
        ecommerceActions.setWorkflowMode(workflowMode, sessionId);
        if (preservedCompetitorDecks.length > 0) {
          ecommerceActions.setCompetitorDecks(preservedCompetitorDecks, sessionId);
        }
        const uploadedImages: EcommerceWorkflowImage[] = [];
        const failedFileNames: string[] = [];

        for (const file of productFiles) {
          try {
            const uploadedUrl = await uploadImage(file);
            const persistedAssetRef = /^blob:/i.test(uploadedUrl)
              ? await saveTopicAssetFromFile(sessionId, "product", file).catch(
                  () => null,
                )
              : null;
            uploadedImages.push({
              id:
                persistedAssetRef?.assetId ||
                createWorkflowMessageId("ecom-product"),
              url: uploadedUrl,
              name: file.name,
              source: "product",
            });
          } catch (error) {
            console.error("[EcommerceWorkflow] upload failed", error);
            failedFileNames.push(file.name || "未命名文件");
          }
        }

        if (uploadedImages.length === 0) {
          throw new Error("商品图片上传失败，请重试。");
        }

        if (failedFileNames.length > 0) {
          throw new Error(
            `部分商品图片上传失败：${failedFileNames.join("、")}`,
          );
        }

        ecommerceActions.addProductImages(uploadedImages, sessionId);
        ecommerceActions.setDescription(trimmedBrief, sessionId);
        ecommerceActions.setStep("ANALYZE_PRODUCT", sessionId);
        ecommerceActions.setProgress(
          {
            done: 1,
            total: 6,
            text: "商品资料已上传。",
          },
          sessionId,
        );

        pushWorkflowUiMessage({
          type: "ecomOneClick.entry",
          productCount: uploadedImages.length,
          description: trimmedBrief,
          platformMode,
          workflowMode,
        });

        const analyzeResult = (await executeSkill("ecomAnalyzeProduct", {
          productImages: uploadedImages.map((item) => item.url),
          brief: trimmedBrief,
          platformMode,
          workflowMode,
        })) as {
          summary?: string;
          recommendedTypes?: unknown;
          review?: unknown;
          evolutionProposals?: unknown;
        };

        const recommendedTypes = normalizeRecommendedTypes(
          analyzeResult?.recommendedTypes,
        );
        const analysisEvolutionProposals = normalizeAnalysisEvolutionProposals(
          analyzeResult?.evolutionProposals,
        );
        const analysisReview =
          normalizeAnalysisReview(analyzeResult?.review) ||
          buildDefaultAnalysisReview(recommendedTypes, "initial");
        if (recommendedTypes.length === 0) {
          throw new Error("商品分析未返回可用的出图类型。");
        }

        ecommerceActions.setAnalysisSummary(
          analyzeResult.summary || "商品分析已完成，请确认推荐的出图类型。",
          sessionId,
        );
        ecommerceActions.setAnalysisReview(analysisReview, sessionId);
        ecommerceActions.setAnalysisEvolutionProposals(
          analysisEvolutionProposals,
          sessionId,
        );
        ecommerceActions.setRecommendedTypes(recommendedTypes, sessionId);
        const sessionAfterProductAnalysis = ecommerceActions.getSession(sessionId);
        ecommerceActions.setProgress(
          {
            done: 2,
            total: 6,
            text: "商品分析已完成。",
          },
          sessionId,
        );

        pushWorkflowUiMessage(
          {
            type: "ecomOneClick.analysis",
            summary:
              analyzeResult.summary || "商品分析已完成，请确认推荐的出图类型。",
            review: analysisReview,
            evolutionProposals: analysisEvolutionProposals,
          },
          "商品分析结论已生成。",
        );

        pushWorkflowUiMessage(
          {
            type: "ecomOneClick.types",
            items: recommendedTypes,
          },
          analyzeResult.summary || "商品分析已完成，请确认推荐的出图类型。",
        );

        void persistEcommerceWorkflowDebugSnapshot({
          sessionId,
          stage: "post-product-analysis",
          session: sessionAfterProductAnalysis,
          note: "商品分析与步骤二推荐类型已生成。",
        });

        if (preservedCompetitorDecks.length > 0) {
          ecommerceActions.setProgress(
            {
              done: 2,
              total: 6,
              text: "正在补充竞品详情页分析…",
            },
            sessionId,
          );

          try {
            const { analyses, failedDecks } = await analyzeEcommerceCompetitorDecks({
              decks: preservedCompetitorDecks,
            });

            if (analyses.length > 0) {
              ecommerceActions.setCompetitorAnalyses(analyses, sessionId);
              const liveSession = ecommerceActions.getSession(sessionId);
              pushWorkflowUiMessage(
                {
                  type: "ecomOneClick.competitorAnalysis",
                  analyses,
                  planningContext:
                    liveSession.competitorPlanningContext || undefined,
                },
                failedDecks.length > 0
                  ? `竞品分析已完成 ${analyses.length} 套，另有 ${failedDecks.length} 套失败。`
                  : "竞品详情页分析已完成，并已注入后续规划参考。",
              );

              void persistEcommerceWorkflowDebugSnapshot({
                sessionId,
                stage: "post-auto-competitor-analysis",
                session: liveSession,
                note:
                  failedDecks.length > 0
                    ? `自动竞品分析已部分完成，成功 ${analyses.length} 套，失败 ${failedDecks.length} 套。`
                    : "自动竞品分析已完成，并写入步骤二到后续规划的上下文。",
              });
            }

            if (failedDecks.length > 0) {
              const failedSummary = failedDecks
                .slice(0, 2)
                .map((item) => `${item.deckName}: ${item.reason}`)
                .join("；");
              addMessage({
                id: createWorkflowMessageId("ecom-competitor-analysis-auto-partial"),
                role: "model",
                text: `竞品分析已部分完成，但仍有失败项：${failedSummary}`,
                timestamp: Date.now(),
                error: true,
              });
            }
          } catch (error) {
            const competitorMessage = getErrorMessage(
              error,
              "竞品详情页自动分析失败。",
            );
            addMessage({
              id: createWorkflowMessageId("ecom-competitor-analysis-auto-error"),
              role: "model",
              text: `竞品详情页自动分析失败：${competitorMessage}`,
              timestamp: Date.now(),
              error: true,
            });
          }

          ecommerceActions.setProgress(
            {
              done: 2,
              total: 6,
              text: "竞品分析已写入后续规划参考。",
            },
            sessionId,
          );
        }
        addMessage({
          id: createWorkflowMessageId("ecom-analysis-ready"),
          role: "model",
          text: "商品分析已完成，请确认推荐的出图类型后继续。",
          timestamp: Date.now(),
        });

        setInputBlocks(EMPTY_INPUT_BLOCKS);
      } catch (error) {
        const message = getErrorMessage(error, "电商一键工作流启动失败。");
        setEcommerceWorkflowError(message);
        addMessage({
          id: createWorkflowMessageId("ecom-workflow-error"),
          role: "model",
          text: `电商一键工作流启动失败：${message}`,
          timestamp: Date.now(),
          error: true,
        });
      } finally {
        releaseActionLock(lockKey);
        setIsTyping(false);
      }
    },
    [
      acquireActionLock,
      addMessage,
      ecommerceActions,
      ensureEcommerceSession,
      pushWorkflowUiMessage,
      releaseActionLock,
      setEcommerceWorkflowError,
      setInputBlocks,
      setIsTyping,
      startEcommerceWorkflow,
    ],
  );

  const handleEcommerceRefineAnalysis = useCallback(
    async (feedback: string) => {
      const trimmedFeedback = feedback.trim();
      if (!trimmedFeedback) {
        addMessage({
          id: createWorkflowMessageId("ecom-analysis-feedback-empty"),
          role: "model",
          text: "请先输入想调整的分析意见，再重新分析。",
          timestamp: Date.now(),
          error: true,
        });
        return;
      }

      const sessionId = ensureEcommerceSession();
      const lockKey = `${sessionId}:refine-analysis`;
      if (!acquireActionLock(lockKey)) {
        return;
      }
      const session = ecommerceActions.getSession(sessionId);
      if (session.productImages.length === 0) {
        addMessage({
          id: createWorkflowMessageId("ecom-analysis-feedback-no-images"),
          role: "model",
          text: "当前还没有商品图，暂时无法重新分析。",
          timestamp: Date.now(),
          error: true,
        });
        releaseActionLock(lockKey);
        return;
      }

      setIsTyping(true);
      setEcommerceWorkflowError(null);
      ecommerceActions.setStep("ANALYZE_PRODUCT", sessionId);
      ecommerceActions.setProgress(
        {
          done: 1,
          total: 6,
          text: "正在根据反馈重新分析商品...",
        },
        sessionId,
      );

      try {
        const analyzeResult = (await executeSkill("ecomAnalyzeProduct", {
          productImages: session.productImages.map((item) => item.url),
          brief: session.description,
          feedback: trimmedFeedback,
          platformMode: session.platformMode,
          workflowMode: session.workflowMode,
        })) as {
          summary?: string;
          recommendedTypes?: unknown;
          review?: unknown;
          evolutionProposals?: unknown;
        };

        const recommendedTypes = normalizeRecommendedTypes(
          analyzeResult?.recommendedTypes,
        );
        const analysisEvolutionProposals = normalizeAnalysisEvolutionProposals(
          analyzeResult?.evolutionProposals,
        );
        const analysisReview =
          normalizeAnalysisReview(analyzeResult?.review) ||
          buildDefaultAnalysisReview(recommendedTypes, "refine");
        if (recommendedTypes.length === 0) {
          throw new Error("重新分析后没有拿到可用的推荐类型。");
        }

        ecommerceActions.setAnalysisSummary(
          analyzeResult.summary || "商品分析已更新，请重新确认推荐的出图类型。",
          sessionId,
        );
        ecommerceActions.setAnalysisReview(analysisReview, sessionId);
        ecommerceActions.setAnalysisEvolutionProposals(
          analysisEvolutionProposals,
          sessionId,
        );
        ecommerceActions.setRecommendedTypes(recommendedTypes, sessionId);
        ecommerceActions.setSupplementFields([], sessionId);
        ecommerceActions.setImageAnalysisReview(null, sessionId);
        ecommerceActions.setImageAnalyses([], sessionId);
        ecommerceActions.setPlanReview(null, sessionId);
        ecommerceActions.setPlanGroups([], sessionId);
        ecommerceActions.setBatchJobs([], sessionId);
        ecommerceActions.setResults([], sessionId);
        ecommerceActions.setSelectedModelId(null, sessionId);
        ecommerceActions.setProgress(
          {
            done: 2,
            total: 6,
            text: "已根据反馈更新商品分析。",
          },
          sessionId,
        );

        pushWorkflowUiMessage(
          {
            type: "ecomOneClick.analysis",
            summary:
              analyzeResult.summary ||
              "商品分析已更新，请重新确认推荐的出图类型。",
            review: analysisReview,
            evolutionProposals: analysisEvolutionProposals,
          },
          "已根据你的反馈重新分析商品。",
        );
        pushWorkflowUiMessage(
          {
            type: "ecomOneClick.types",
            items: recommendedTypes,
          },
          "推荐出图类型已重新生成。",
        );
        addMessage({
          id: createWorkflowMessageId("ecom-analysis-feedback-done"),
          role: "model",
          text: `已根据反馈重新分析：${trimmedFeedback}`,
          timestamp: Date.now(),
        });
      } catch (error) {
        const message = getErrorMessage(error, "重新分析商品失败。");
        setEcommerceWorkflowError(message);
        addMessage({
          id: createWorkflowMessageId("ecom-analysis-feedback-error"),
          role: "model",
          text: `重新分析商品失败：${message}`,
          timestamp: Date.now(),
          error: true,
        });
      } finally {
        releaseActionLock(lockKey);
        setIsTyping(false);
      }
    },
    [
      acquireActionLock,
      addMessage,
      ecommerceActions,
      ensureEcommerceSession,
      pushWorkflowUiMessage,
      releaseActionLock,
      setEcommerceWorkflowError,
      setIsTyping,
    ],
  );

  const handleEcommerceSelectModel = useCallback(
    (modelId: string, promptLanguage?: EcommercePromptLanguage) => {
      const sessionId = ensureEcommerceSession();
      const session = ecommerceActions.getSession(sessionId);
      const nextModelOptions = session.modelOptions.map((item) =>
        item.id === modelId
          ? {
              ...item,
              promptLanguage: normalizePromptLanguage(
                promptLanguage || item.promptLanguage,
              ),
            }
          : item,
      );

      ecommerceActions.setModelOptions(nextModelOptions, sessionId);
      ecommerceActions.setSelectedModelId(modelId, sessionId);
      ecommerceActions.setStep("FINALIZE_PROMPTS", sessionId);
      ecommerceActions.setProgress(
        {
          done: 5,
          total: 6,
          text: "默认模型已确认，请继续定稿提示词。",
        },
        sessionId,
      );

      const liveSession = ecommerceActions.getSession(sessionId);
      const done = liveSession.batchJobs.filter(
        (job) => job.status === "done",
      ).length;

      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.modelLock",
          models: nextModelOptions,
          selectedModelId: modelId,
        },
        `已确认默认生成模型：${
          nextModelOptions.find((item) => item.id === modelId)?.name || modelId
        }`,
      );

      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.batch",
          jobs: liveSession.batchJobs,
          done,
          total: liveSession.batchJobs.length,
          view: "finalize",
        },
        "提示词定稿队列已就绪。",
      );
    },
    [ecommerceActions, ensureEcommerceSession, pushWorkflowUiMessage],
  );
  const handleEcommerceConfirmTypes = useCallback(
    async (items: EcommerceRecommendedType[]) => {
      const sessionId = ensureEcommerceSession();
      const lockKey = `${sessionId}:stage-flow`;
      if (!acquireActionLock(lockKey)) {
        return;
      }
      const selectedTypes = items.filter((item) => item.selected);

      ecommerceActions.setRecommendedTypes(items, sessionId);
      ecommerceActions.setSupplementFields([], sessionId);
      ecommerceActions.setImageAnalysisReview(null, sessionId);
      ecommerceActions.setImageAnalyses([], sessionId);
      ecommerceActions.setPlanReview(null, sessionId);
      ecommerceActions.setPlanGroups([], sessionId);
      ecommerceActions.setBatchJobs([], sessionId);
      ecommerceActions.setResults([], sessionId);
      ecommerceActions.setSelectedModelId(null, sessionId);

      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.types",
          items,
        },
        "已保存出图类型选择。",
      );

      if (selectedTypes.length === 0) {
        addMessage({
          id: createWorkflowMessageId("ecom-type-empty"),
          role: "model",
          text: "请至少选择一种输出类型后再继续。",
          timestamp: Date.now(),
          error: true,
        });
        releaseActionLock(lockKey);
        return;
      }

      const session = ecommerceActions.getSession(sessionId);
      setIsTyping(true);
      setEcommerceWorkflowError(null);
      ecommerceActions.setStep("SUPPLEMENT_INFO", sessionId);
      ecommerceActions.setProgress(
        {
          done: 2,
          total: 6,
          text: "正在生成补充信息问题。",
        },
        sessionId,
      );

      try {
        const supplementsResult = await requestSupplementQuestions(
          sessionId,
          selectedTypes,
          "block",
        );
        ecommerceActions.setSupplementFields(supplementsResult.fields, sessionId);
        ecommerceActions.setProgress(
          {
            done: 3,
            total: 6,
            text: "补充信息问题已准备完成。",
          },
          sessionId,
        );

        pushWorkflowUiMessage(
          {
            type: "ecomOneClick.supplements",
            fields: supplementsResult.fields,
          },
          "补充信息问题已准备完成。",
        );
      } catch (error) {
        ecommerceActions.setStep("SUPPLEMENT_INFO", sessionId);
        ecommerceActions.setProgress(
          {
            done: 2,
            total: 6,
            text: "补充信息问题生成失败，请重试或手动选择是否使用兜底问题。",
          },
          sessionId,
        );
        const message = getErrorMessage(
          error,
          "补充信息问题生成失败，且已阻止自动兜底。",
        );
        setEcommerceWorkflowError(message);
        pushWorkflowUiMessage(
          {
            type: "ecomOneClick.supplementQuestionsBlocked",
            reason: message,
          },
          "补充信息问题生成失败，已停止自动兜底。",
        );
        addMessage({
          id: createWorkflowMessageId("ecom-supplement-error"),
          role: "model",
          text: `补充信息问题生成失败：${message}`,
          timestamp: Date.now(),
          error: true,
        });
      } finally {
        releaseActionLock(lockKey);
        setIsTyping(false);
      }
    },
    [
      acquireActionLock,
      addMessage,
      ecommerceActions,
      ensureEcommerceSession,
      pushWorkflowUiMessage,
      releaseActionLock,
      requestSupplementQuestions,
      setEcommerceWorkflowError,
      setIsTyping,
    ],
  );
  const handleEcommerceRetrySupplementQuestions = useCallback(async () => {
    const sessionId = ensureEcommerceSession();
      const lockKey = `${sessionId}:stage-flow`;
    if (!acquireActionLock(lockKey)) {
      return;
    }

    try {
      const session = ecommerceActions.getSession(sessionId);
      const selectedTypes = session.recommendedTypes.filter((item) => item.selected);
      if (selectedTypes.length === 0) {
        throw new Error("当前还没有已确认的出图类型，无法重试补充问题。");
      }

      setIsTyping(true);
      setEcommerceWorkflowError(null);
      ecommerceActions.setStep("SUPPLEMENT_INFO", sessionId);
      ecommerceActions.setProgress(
        {
          done: 2,
          total: 6,
          text: "正在重新生成补充信息问题。",
        },
        sessionId,
      );

      const supplementsResult = await requestSupplementQuestions(
        sessionId,
        selectedTypes,
        "block",
      );
      ecommerceActions.setSupplementFields(supplementsResult.fields, sessionId);
      ecommerceActions.setProgress(
        {
          done: 3,
          total: 6,
          text: "补充信息问题已重新生成完成。",
        },
        sessionId,
      );
      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.supplements",
          fields: supplementsResult.fields,
        },
        "补充信息问题已重新生成完成。",
      );
    } catch (error) {
      const message = getErrorMessage(
        error,
        "补充信息问题重新生成失败，且已阻止自动兜底。",
      );
      setEcommerceWorkflowError(message);
      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.supplementQuestionsBlocked",
          reason: message,
        },
        "补充信息问题重新生成失败，已停止自动兜底。",
      );
      addMessage({
        id: createWorkflowMessageId("ecom-supplement-retry-error"),
        role: "model",
        text: `补充信息问题重新生成失败：${message}`,
        timestamp: Date.now(),
        error: true,
      });
    } finally {
      releaseActionLock(lockKey);
      setIsTyping(false);
    }
  }, [
    acquireActionLock,
    addMessage,
    ecommerceActions,
    ensureEcommerceSession,
    pushWorkflowUiMessage,
    releaseActionLock,
    requestSupplementQuestions,
    setEcommerceWorkflowError,
    setIsTyping,
  ]);
  const handleEcommerceUseSupplementFallback = useCallback(async () => {
    const sessionId = ensureEcommerceSession();
      const lockKey = `${sessionId}:stage-flow`;
    if (!acquireActionLock(lockKey)) {
      return;
    }

    try {
      const session = ecommerceActions.getSession(sessionId);
      const selectedTypes = session.recommendedTypes.filter((item) => item.selected);
      if (selectedTypes.length === 0) {
        throw new Error("当前还没有已确认的出图类型，无法使用兜底问题。");
      }

      setIsTyping(true);
      setEcommerceWorkflowError(null);
      const supplementsResult = await requestSupplementQuestions(
        sessionId,
        selectedTypes,
        "force",
      );
      ecommerceActions.setSupplementFields(supplementsResult.fields, sessionId);
      ecommerceActions.setStep("SUPPLEMENT_INFO", sessionId);
      ecommerceActions.setProgress(
        {
          done: 3,
          total: 6,
          text: "已按你的选择使用保守兜底问题。",
        },
        sessionId,
      );
      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.supplements",
          fields: supplementsResult.fields,
        },
        "已按你的选择使用保守兜底问题。",
      );
      addMessage({
        id: createWorkflowMessageId("ecom-supplement-fallback-confirm"),
        role: "model",
        text:
          "本次补充问题已按你的选择改为保守兜底版本。它更适合临时推进流程，不代表问题一定精准，建议后续优先人工改一遍关键项。",
        timestamp: Date.now(),
      });
    } catch (error) {
      const message = getErrorMessage(error, "使用保守兜底问题失败。");
      setEcommerceWorkflowError(message);
      addMessage({
        id: createWorkflowMessageId("ecom-supplement-fallback-error"),
        role: "model",
        text: `使用保守兜底问题失败：${message}`,
        timestamp: Date.now(),
        error: true,
      });
    } finally {
      releaseActionLock(lockKey);
      setIsTyping(false);
    }
  }, [
    acquireActionLock,
    addMessage,
    ecommerceActions,
    ensureEcommerceSession,
    pushWorkflowUiMessage,
    releaseActionLock,
    requestSupplementQuestions,
    setEcommerceWorkflowError,
    setIsTyping,
  ]);
  const handleEcommerceConfirmImageAnalyses = useCallback(
    async (items: EcommerceImageAnalysis[]) => {
      const sessionId = ensureEcommerceSession();
      const lockKey = `${sessionId}:stage-flow`;
      if (!acquireActionLock(lockKey)) {
        return;
      }
      const session = ecommerceActions.getSession(sessionId);
      const sanitizedItems = sanitizeImageAnalysesForWorkflow(items);
      const selectedTypes = session.recommendedTypes.filter(
        (item) => item.selected,
      );

      ecommerceActions.setImageAnalyses(sanitizedItems, sessionId);
      ecommerceActions.setPlanReview(null, sessionId);
      ecommerceActions.setPlanGroups([], sessionId);
      ecommerceActions.setBatchJobs([], sessionId);
      ecommerceActions.setResults([], sessionId);
      ecommerceActions.setSelectedModelId(null, sessionId);

      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.imageAnalyses",
          items: sanitizedItems,
          review: session.imageAnalysisReview || undefined,
        },
        "已保存图片分析。",
      );

      if (selectedTypes.length === 0) {
        addMessage({
          id: createWorkflowMessageId("ecom-plan-missing-types"),
          role: "model",
          text: "当前没有选中的输出类型，暂时无法生成方案。",
          timestamp: Date.now(),
          error: true,
        });
        releaseActionLock(lockKey);
        return;
      }

      if (!sanitizedItems.some((item) => item.usableAsReference)) {
        addMessage({
          id: createWorkflowMessageId("ecom-image-no-reference"),
          role: "model",
          text:
            session.workflowMode === "professional"
              ? "当前没有标记任何可参考商品图。专业模式下建议至少保留 1 张参考图，以免方案和生图偏差过大。"
              : "当前没有标记参考图，系统会退回使用原始商品图前几张作为兜底参考。",
          timestamp: Date.now(),
          error: session.workflowMode === "professional",
        });

        if (session.workflowMode === "professional") {
          releaseActionLock(lockKey);
          return;
        }
      }

      setIsTyping(true);
      setEcommerceWorkflowError(null);
      ecommerceActions.setStep("PLAN_SCHEMES", sessionId);
      ecommerceActions.setProgress(
        {
          done: 4,
          total: 6,
          text: "正在生成方案分组。",
        },
        sessionId,
      );
      persistPlanDebugSnapshot(
        sessionId,
        "plan-stage-enter",
        "已进入步骤三方案规划，准备请求方案分组。",
        {
          selectedTypeCount: selectedTypes.length,
          imageAnalysisCount: sanitizedItems.length,
          usableReferenceCount: sanitizedItems.filter((item) => item.usableAsReference)
            .length,
        },
      );

      try {
        const plansResult = await requestPlanGroups(
          sessionId,
          selectedTypes,
          sanitizedItems,
          "block",
        );
        const nextPlanGroups = plansResult.groups;
        const planReview = plansResult.review;
        const nextBatchJobs = buildBatchJobs(
          nextPlanGroups,
          [],
          session.platformMode,
        );

        ecommerceActions.setPlanGroups(nextPlanGroups, sessionId);
        ecommerceActions.setPlanReview(planReview, sessionId);
        ecommerceActions.setBatchJobs(nextBatchJobs, sessionId);
        ecommerceActions.setResults([], sessionId);
        ecommerceActions.setProgress(
          {
            done: 5,
            total: 6,
            text: "方案分组已生成，请确认。",
          },
          sessionId,
        );
        persistPlanDebugSnapshot(
          sessionId,
          "plan-groups-applied",
          "方案分组已写入 session。",
          {
            groupCount: nextPlanGroups.length,
            batchJobCount: nextBatchJobs.length,
            reviewConfidence: planReview.confidence,
          },
        );

        pushWorkflowUiMessage(
          {
            type: "ecomOneClick.plans",
            groups: nextPlanGroups,
            review: planReview,
          },
          "方案分组已生成，请确认。",
        );
      } catch (error) {
        ecommerceActions.setStep("PLAN_SCHEMES", sessionId);
        ecommerceActions.setProgress(
          {
            done: 4,
            total: 6,
            text: "方案规划生成失败，请重试或手动选择是否使用兜底方案骨架。",
          },
          sessionId,
        );
        const message = getErrorMessage(
          error,
          "方案规划生成失败，且已阻止自动兜底。",
        );
        setEcommerceWorkflowError(message);
        persistPlanDebugSnapshot(
          sessionId,
          "plan-groups-error",
          "方案规划生成失败。",
          {
            message,
            selectedTypeCount: selectedTypes.length,
            imageAnalysisCount: sanitizedItems.length,
          },
        );
        pushWorkflowUiMessage(
          {
            type: "ecomOneClick.planGroupsBlocked",
            reason: message,
          },
          "方案规划生成失败，已停止自动兜底。",
        );
        addMessage({
          id: createWorkflowMessageId("ecom-plan-error"),
          role: "model",
          text: `方案规划生成失败：${message}`,
          timestamp: Date.now(),
          error: true,
        });
      } finally {
        releaseActionLock(lockKey);
        setIsTyping(false);
      }
    },
    [
      acquireActionLock,
      addMessage,
      ecommerceActions,
      ensureEcommerceSession,
      persistPlanDebugSnapshot,
      pushWorkflowUiMessage,
      releaseActionLock,
      requestPlanGroups,
      setEcommerceWorkflowError,
      setIsTyping,
    ],
  );
  const handleEcommerceRetryPlanGroups = useCallback(async () => {
    const sessionId = ensureEcommerceSession();
    const lockKey = `${sessionId}:stage-flow`;
    if (!acquireActionLock(lockKey)) {
      return;
    }

    try {
      const session = ecommerceActions.getSession(sessionId);
      const selectedTypes = session.recommendedTypes.filter((item) => item.selected);
      const sanitizedItems = sanitizeImageAnalysesForWorkflow(session.imageAnalyses);

      if (selectedTypes.length === 0) {
        throw new Error("当前还没有已确认的出图类型，无法重试方案规划。");
      }
      if (sanitizedItems.length === 0) {
        throw new Error("当前还没有可用于规划的图片分析结果，无法重试方案规划。");
      }

      setIsTyping(true);
      setEcommerceWorkflowError(null);
      ecommerceActions.setStep("PLAN_SCHEMES", sessionId);
      ecommerceActions.setProgress(
        {
          done: 4,
          total: 6,
          text: "正在重新生成方案分组。",
        },
        sessionId,
      );
      persistPlanDebugSnapshot(
        sessionId,
        "plan-groups-retry-start",
        "开始重试方案规划。",
        {
          selectedTypeCount: selectedTypes.length,
          imageAnalysisCount: sanitizedItems.length,
          existingPlanGroupCount: session.planGroups.length,
        },
      );

      const plansResult = await requestPlanGroups(
        sessionId,
        selectedTypes,
        sanitizedItems,
        "block",
      );
      const nextBatchJobs = buildBatchJobs(
        plansResult.groups,
        [],
        session.platformMode,
      );

      ecommerceActions.setPlanGroups(plansResult.groups, sessionId);
      ecommerceActions.setPlanReview(plansResult.review, sessionId);
      ecommerceActions.setBatchJobs(nextBatchJobs, sessionId);
      ecommerceActions.setResults([], sessionId);
      ecommerceActions.setProgress(
        {
          done: 5,
          total: 6,
          text: "方案分组已重新生成完成，请确认。",
        },
        sessionId,
      );
      persistPlanDebugSnapshot(
        sessionId,
        "plan-groups-retry-applied",
        "重试后的方案分组已写入 session。",
        {
          groupCount: plansResult.groups.length,
          batchJobCount: nextBatchJobs.length,
          reviewConfidence: plansResult.review.confidence,
        },
      );
      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.plans",
          groups: plansResult.groups,
          review: plansResult.review,
        },
        "方案分组已重新生成完成，请确认。",
      );
    } catch (error) {
      ecommerceActions.setStep("PLAN_SCHEMES", sessionId);
      ecommerceActions.setProgress(
        {
          done: 4,
          total: 6,
          text: "方案规划重新生成失败，请重试或手动选择是否使用兜底方案骨架。",
        },
        sessionId,
      );
      const message = getErrorMessage(
        error,
        "方案规划重新生成失败，且已阻止自动兜底。",
      );
      setEcommerceWorkflowError(message);
      const liveSession = ecommerceActions.getSession(sessionId);
      persistPlanDebugSnapshot(
        sessionId,
        "plan-groups-retry-error",
        "重试方案规划失败。",
        {
          message,
          selectedTypeCount: liveSession.recommendedTypes.filter((item) => item.selected)
            .length,
          imageAnalysisCount: liveSession.imageAnalyses.length,
        },
      );
      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.planGroupsBlocked",
          reason: message,
        },
        "方案规划重新生成失败，已停止自动兜底。",
      );
      addMessage({
        id: createWorkflowMessageId("ecom-plan-retry-error"),
        role: "model",
        text: `方案规划重新生成失败：${message}`,
        timestamp: Date.now(),
        error: true,
      });
    } finally {
      releaseActionLock(lockKey);
      setIsTyping(false);
    }
  }, [
    acquireActionLock,
    addMessage,
    ecommerceActions,
    ensureEcommerceSession,
    persistPlanDebugSnapshot,
    pushWorkflowUiMessage,
    releaseActionLock,
    requestPlanGroups,
    setEcommerceWorkflowError,
    setIsTyping,
  ]);
  const handleEcommerceUsePlanFallback = useCallback(async () => {
    const sessionId = ensureEcommerceSession();
      const lockKey = `${sessionId}:stage-flow`;
    if (!acquireActionLock(lockKey)) {
      return;
    }

    try {
      const session = ecommerceActions.getSession(sessionId);
      const selectedTypes = session.recommendedTypes.filter((item) => item.selected);
      const sanitizedItems = sanitizeImageAnalysesForWorkflow(session.imageAnalyses);

      if (selectedTypes.length === 0) {
        throw new Error("当前还没有已确认的出图类型，无法使用兜底方案骨架。");
      }
      if (sanitizedItems.length === 0) {
        throw new Error("当前还没有可用于规划的图片分析结果，无法使用兜底方案骨架。");
      }

      setIsTyping(true);
      setEcommerceWorkflowError(null);
      ecommerceActions.setStep("PLAN_SCHEMES", sessionId);
      ecommerceActions.setProgress(
        {
          done: 4,
          total: 6,
          text: "正在按你的选择生成保守兜底方案骨架。",
        },
        sessionId,
      );

      const plansResult = await requestPlanGroups(
        sessionId,
        selectedTypes,
        sanitizedItems,
        "force",
      );
      const nextBatchJobs = buildBatchJobs(
        plansResult.groups,
        [],
        session.platformMode,
      );

      ecommerceActions.setPlanGroups(plansResult.groups, sessionId);
      ecommerceActions.setPlanReview(plansResult.review, sessionId);
      ecommerceActions.setBatchJobs(nextBatchJobs, sessionId);
      ecommerceActions.setResults([], sessionId);
      ecommerceActions.setProgress(
        {
          done: 5,
          total: 6,
          text: "已按你的选择使用保守兜底方案骨架，请确认。",
        },
        sessionId,
      );
      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.plans",
          groups: plansResult.groups,
          review: plansResult.review,
        },
        "已按你的选择使用保守兜底方案骨架，请确认。",
      );
      addMessage({
        id: createWorkflowMessageId("ecom-plan-fallback-confirm"),
        role: "model",
        text:
          "本次方案规划已按你的选择改为保守兜底方案骨架。它更适合先把流程推进下去，不代表方案已经足够精准，建议后续优先人工校对关键分组和标题。",
        timestamp: Date.now(),
      });
    } catch (error) {
      const message = getErrorMessage(error, "使用保守兜底方案骨架失败。");
      setEcommerceWorkflowError(message);
      addMessage({
        id: createWorkflowMessageId("ecom-plan-fallback-error"),
        role: "model",
        text: `使用保守兜底方案骨架失败：${message}`,
        timestamp: Date.now(),
        error: true,
      });
    } finally {
      releaseActionLock(lockKey);
      setIsTyping(false);
    }
  }, [
    acquireActionLock,
    addMessage,
    ecommerceActions,
    ensureEcommerceSession,
    pushWorkflowUiMessage,
    releaseActionLock,
    requestPlanGroups,
    setEcommerceWorkflowError,
    setIsTyping,
  ]);
  const handleEcommerceAutofillImageAnalyses = useCallback(
    async (
      items: EcommerceImageAnalysis[],
    ): Promise<EcommerceImageAnalysis[]> => {
      const sessionId = ensureEcommerceSession();
      const lockKey = `${sessionId}:autofill-image-analyses`;
      if (!acquireActionLock(lockKey)) {
        return items;
      }

      try {
        const session = ecommerceActions.getSession(sessionId);
        const imageAnalysisResult = (await executeSkill(
          "ecomAutofillImageAnalyses",
          {
            productImages: session.productImages.map((image) => ({
              id: image.id,
              url: image.url,
              name: image.name,
            })),
            brief: session.description,
            platformMode: session.platformMode,
            workflowMode: session.workflowMode,
            supplementSummary: summarizeSupplementFields(
              session.supplementFields,
            ),
            currentItems: items,
          },
        )) as { items?: unknown } | null;

        const normalizedItems = normalizeImageAnalyses(imageAnalysisResult?.items);
        return mergeAutofilledImageAnalyses(
          items,
          normalizedItems.length > 0 ? normalizedItems : items,
        );
      } catch (error) {
        console.error("ecomAutofillImageAnalyses error:", error);
        throw new Error(
          getErrorMessage(
            error,
            "AI 暂时无法补全当前图片分析，请稍后再试。",
          ),
        );
      } finally {
        releaseActionLock(lockKey);
      }
    },
    [ecommerceActions, ensureEcommerceSession],
  );
  const handleEcommerceRetryImageAnalysis = useCallback(
    async (imageId: string) => {
      const sessionId = ensureEcommerceSession();
      const lockKey = `${sessionId}:retry-image-analysis:${imageId}`;
      if (!acquireActionLock(lockKey)) {
        return;
      }
      const session = ecommerceActions.getSession(sessionId);
      const targetImage = session.productImages.find(
        (image) => image.id === imageId,
      );

      if (!targetImage) {
        addMessage({
          id: createWorkflowMessageId("ecom-image-analysis-missing"),
          role: "model",
          text: "未找到要重试分析的商品图片。",
          timestamp: Date.now(),
          error: true,
        });
        releaseActionLock(lockKey);
        return;
      }

      setIsTyping(true);
      setEcommerceWorkflowError(null);

      try {
        const imageAnalysisResult = (await executeSkill("ecomAnalyzeImages", {
          productImages: [
            {
              id: targetImage.id,
              url: targetImage.url,
              name: targetImage.name,
            },
          ],
          brief: session.description,
          platformMode: session.platformMode,
          workflowMode: session.workflowMode,
          supplementSummary: summarizeSupplementFields(
            session.supplementFields,
          ),
        })) as { items?: unknown };

        const retriedItems = normalizeImageAnalyses(imageAnalysisResult?.items);
        const retriedItem = retriedItems[0];

        if (!retriedItem) {
          throw new Error("单张图片分析没有返回结果。");
        }

        const nextImageAnalyses = session.imageAnalyses.some(
          (item) => item.imageId === imageId,
        )
          ? session.imageAnalyses.map((item) =>
              item.imageId === imageId ? retriedItem : item,
            )
          : [...session.imageAnalyses, retriedItem];
        const nextPlanGroups = syncPlanGroupReferences(
          session.planGroups,
          nextImageAnalyses,
        );

        ecommerceActions.setImageAnalyses(nextImageAnalyses, sessionId);
        if (nextPlanGroups.length > 0) {
          ecommerceActions.setPlanGroups(nextPlanGroups, sessionId);
        }

        pushWorkflowUiMessage(
          {
            type: "ecomOneClick.imageAnalyses",
            items: nextImageAnalyses,
            review: session.imageAnalysisReview || undefined,
          },
          `已重新分析图片：${retriedItem.title}`,
        );

        if (nextPlanGroups.length > 0) {
          pushWorkflowUiMessage(
            {
              type: "ecomOneClick.plans",
              groups: nextPlanGroups,
              review: session.planReview || undefined,
            },
            "方案参考图已根据最新单张分析结果同步更新。",
          );
        }

        addMessage({
          id: createWorkflowMessageId("ecom-image-analysis-retry"),
          role: "model",
          text: `已完成单张图片重试分析：${retriedItem.title}`,
          timestamp: Date.now(),
        });
      } catch (error) {
        const message = getErrorMessage(error, "单张图片分析重试失败。");
        setEcommerceWorkflowError(message);
        addMessage({
          id: createWorkflowMessageId("ecom-image-analysis-retry-error"),
          role: "model",
          text: `单张图片分析重试失败：${message}`,
          timestamp: Date.now(),
          error: true,
        });
      } finally {
        releaseActionLock(lockKey);
        setIsTyping(false);
      }
    },
    [
      acquireActionLock,
      addMessage,
      ecommerceActions,
      ensureEcommerceSession,
      pushWorkflowUiMessage,
      releaseActionLock,
      setEcommerceWorkflowError,
      setIsTyping,
    ],
  );

  const handleEcommerceRewritePlanPrompt = useCallback(
    async (
      groups: EcommercePlanGroup[],
      planItemId: string,
      feedback?: string,
    ) => {
      const sessionId = ensureEcommerceSession();
      const lockKey = `${sessionId}:rewrite-plan:${planItemId}`;
      if (!acquireActionLock(lockKey)) {
        return null;
      }
      const session = ecommerceActions.getSession(sessionId);
      const targetPlan = findPlanItem(groups, planItemId);

      if (!targetPlan) {
        addMessage({
          id: createWorkflowMessageId("ecom-plan-rewrite-missing"),
          role: "model",
          text: "未找到要改写提示词的方案项。",
          timestamp: Date.now(),
          error: true,
        });
        releaseActionLock(lockKey);
        return null;
      }

      setIsTyping(true);
      setEcommerceWorkflowError(null);

      try {
        const rewriteResult = (await executeSkill("ecomRewritePrompt", {
          productDescription: session.description,
          typeTitle: targetPlan.group.typeTitle,
          planTitle: targetPlan.item.title,
          planDescription: targetPlan.item.description,
          currentPrompt: targetPlan.item.promptOutline,
          supplementSummary: summarizeSupplementFields(
            session.supplementFields,
          ),
          targetRatio: targetPlan.item.ratio,
          feedback: feedback?.trim() || undefined,
          imageAnalyses: session.imageAnalyses
            .filter(
              (item) =>
                targetPlan.item.referenceImageIds.includes(item.imageId) ||
                item.usableAsReference,
            )
            .slice(0, MAX_GENERATION_REFERENCE_IMAGES)
            .map((item) => ({
              title: item.title,
              description: item.description,
              analysisConclusion: item.analysisConclusion,
              angle: item.angle,
            })),
        })) as { prompt?: string } | string;

        const nextPrompt = extractRewrittenPrompt(rewriteResult);

        if (!nextPrompt) {
          throw new Error("AI 改写后没有返回可用提示词。");
        }

        const nextGroups: EcommercePlanGroup[] = groups.map((group) => ({
          ...group,
          items: group.items.map((item) =>
            item.id === planItemId
              ? {
                  ...item,
                  promptOutline: nextPrompt,
                  status: "ready" as const,
                }
              : item,
          ),
        }));
        const { nextBatchJobs } = syncPlanGroups(sessionId, nextGroups);
        const done = nextBatchJobs.filter(
          (job) => job.status === "done",
        ).length;

        pushWorkflowUiMessage(
          {
            type: "ecomOneClick.plans",
            groups: nextGroups,
          },
          `已改写方案提示词：${targetPlan.item.title}`,
        );
        pushWorkflowUiMessage(
          {
            type: "ecomOneClick.batch",
            jobs: nextBatchJobs,
            done,
            total: nextBatchJobs.length,
          },
          "批量任务提示词已同步更新。",
        );
        addMessage({
          id: createWorkflowMessageId("ecom-plan-rewrite"),
          role: "model",
          text: feedback?.trim()
            ? `已按建议改写提示词：${targetPlan.item.title}`
            : `已完成 AI 提示词改写：${targetPlan.item.title}`,
          timestamp: Date.now(),
        });

        return nextPrompt;
      } catch (error) {
        const message = getErrorMessage(error, "方案提示词改写失败。");
        setEcommerceWorkflowError(message);
        addMessage({
          id: createWorkflowMessageId("ecom-plan-rewrite-error"),
          role: "model",
          text: `方案提示词改写失败：${message}`,
          timestamp: Date.now(),
          error: true,
        });
        return null;
      } finally {
        releaseActionLock(lockKey);
        setIsTyping(false);
      }
    },
    [
      acquireActionLock,
      addMessage,
      ecommerceActions,
      ensureEcommerceSession,
      pushWorkflowUiMessage,
      releaseActionLock,
      setEcommerceWorkflowError,
      setIsTyping,
      syncPlanGroups,
    ],
  );

  const handleEcommerceGenerateExtraPlanItem = useCallback(
    async (groups: EcommercePlanGroup[], typeId: string) => {
      const sessionId = ensureEcommerceSession();
      const lockKey = `${sessionId}:generate-extra-plan:${typeId}`;
      if (!acquireActionLock(lockKey)) {
        return;
      }
      const session = ecommerceActions.getSession(sessionId);
      const targetGroup = groups.find((group) => group.typeId === typeId);

      if (!targetGroup) {
        addMessage({
          id: createWorkflowMessageId("ecom-plan-extra-missing-group"),
          role: "model",
          text: "未找到要扩充的方案分组。",
          timestamp: Date.now(),
          error: true,
        });
        releaseActionLock(lockKey);
        return;
      }

      setIsTyping(true);
      setEcommerceWorkflowError(null);

      try {
        const planningStageBlock = buildPlanningStageContextBlock({
          session,
          selectedTypes: [
            {
              id: targetGroup.typeId,
              title: targetGroup.typeTitle,
              imageCount: Math.max(1, targetGroup.items.length + 1),
            },
          ],
        });
        const planResult = (await executeSkill("ecomGeneratePlans", {
          selectedTypes: [
            {
              id: targetGroup.typeId,
              title: targetGroup.typeTitle,
              imageCount: Math.max(1, targetGroup.items.length + 1),
            },
          ],
          imageAnalyses: session.imageAnalyses.map((item) => ({
            imageId: item.imageId,
            title: item.title,
            description: item.description,
              analysisConclusion: item.analysisConclusion,
            })),
          brief: appendPlanGenerationContextText(
            session.description,
            planningStageBlock,
          ),
          platformMode: session.platformMode,
          workflowMode: session.workflowMode,
          supplementSummary: summarizeSupplementFields(session.supplementFields),
        })) as { groups?: unknown; review?: unknown };

        const generatedGroups = enrichPlanGroupsWithCompetitorContext(
          enrichPlanGroupsWithLegacyProfiles(normalizePlanGroups(planResult?.groups)),
          session.competitorPlanningContext,
          {
            planningMode: getPlanningStageCompetitorMode(session),
            generationMode: getGenerationStageCompetitorMode(session),
          },
        );
        const planReview =
          normalizeStageReview(planResult?.review) || session.planReview;
        const generatedGroup = generatedGroups.find(
          (group) => group.typeId === typeId,
        );
        const extraCandidate =
          generatedGroup?.items.find(
            (candidate) =>
              !targetGroup.items.some(
                (current) =>
                  current.title === candidate.title &&
                  current.description === candidate.description,
              ),
          ) || generatedGroup?.items[generatedGroup.items.length - 1];

        if (!extraCandidate) {
          throw new Error("AI 没有生成新的方案项。");
        }

        const nextGroups = groups.map((group) =>
          group.typeId !== typeId
            ? group
            : {
                ...group,
                summary: generatedGroup?.summary || group.summary,
                strategy: generatedGroup?.strategy || group.strategy,
                platformTags:
                  generatedGroup?.platformTags || group.platformTags,
                priority: generatedGroup?.priority || group.priority,
                items: [
                  ...group.items,
                  {
                    ...extraCandidate,
                    id: `${typeId}-extra-${Date.now()}`,
                    status: "ready" as const,
                  },
                ],
              },
        );

        const { nextBatchJobs } = syncPlanGroups(sessionId, nextGroups);
        const done = nextBatchJobs.filter(
          (job) => job.status === "done",
        ).length;
        if (planReview) {
          ecommerceActions.setPlanReview(planReview, sessionId);
        }

        pushWorkflowUiMessage(
          {
            type: "ecomOneClick.plans",
            groups: nextGroups,
            review: planReview || undefined,
          },
          `AI 已补充新方案：${targetGroup.typeTitle}`,
        );
        pushWorkflowUiMessage(
          {
            type: "ecomOneClick.batch",
            jobs: nextBatchJobs,
            done,
            total: nextBatchJobs.length,
          },
          "批量任务已同步加入新增方案。",
        );
        addMessage({
          id: createWorkflowMessageId("ecom-plan-extra-added"),
          role: "model",
          text: `已为「${targetGroup.typeTitle}」新增 1 条 AI 方案。`,
          timestamp: Date.now(),
        });
      } catch (error) {
        const message = getErrorMessage(error, "AI 补充方案失败。");
        setEcommerceWorkflowError(message);
        addMessage({
          id: createWorkflowMessageId("ecom-plan-extra-error"),
          role: "model",
          text: `AI 补充方案失败：${message}`,
          timestamp: Date.now(),
          error: true,
        });
      } finally {
        releaseActionLock(lockKey);
        setIsTyping(false);
      }
    },
    [
      acquireActionLock,
      addMessage,
      ecommerceActions,
      ensureEcommerceSession,
      pushWorkflowUiMessage,
      releaseActionLock,
      setEcommerceWorkflowError,
      setIsTyping,
      syncPlanGroups,
    ],
  );

  const handleEcommerceGeneratePlanItem = useCallback(
    async (groups: EcommercePlanGroup[], planItemId: string) => {
      const traceStartedAt = getTraceNow();
      const sessionId = ensureEcommerceSession();
      const lockKey = `${sessionId}:generate-plan:${planItemId}`;
      if (!acquireActionLock(lockKey)) {
        return;
      }
      logStep7Trace("single.start", {
        flow: "single-plan-item",
        sessionId,
        planItemId,
      });
      const targetPlan = findPlanItem(groups, planItemId);

      if (!targetPlan) {
        addMessage({
          id: createWorkflowMessageId("ecom-plan-generate-missing"),
          role: "model",
          text: "未找到要生成的方案项。",
          timestamp: Date.now(),
          error: true,
        });
        releaseActionLock(lockKey);
        return;
      }

      const { nextBatchJobs: syncedJobs } = syncPlanGroups(sessionId, groups);
      const targetIndex = syncedJobs.findIndex(
        (job) => job.planItemId === planItemId,
      );

      if (targetIndex < 0) {
        addMessage({
          id: createWorkflowMessageId("ecom-plan-job-missing"),
          role: "model",
          text: "当前方案还没有对应的批量任务。",
          timestamp: Date.now(),
          error: true,
        });
        releaseActionLock(lockKey);
        return;
      }

      const updateBatchUi = (batchJobs: EcommerceBatchJob[], text: string) => {
        const batchJobSnapshot = cloneBatchJobs(batchJobs);
        const resultSnapshot = cloneResultItems(
          collectBatchResults(batchJobSnapshot),
        );
        const done = batchJobSnapshot.filter(
          (item) => item.status === "done",
        ).length;
        ecommerceActions.setBatchJobs(batchJobSnapshot, sessionId);
        ecommerceActions.setResults(resultSnapshot, sessionId);
        pushWorkflowUiMessage(
          {
            type: "ecomOneClick.batch",
            jobs: batchJobSnapshot,
            done,
            total: batchJobSnapshot.length,
            view: "execute",
          },
          text,
        );
      };

      const jobs = syncedJobs.map((job, index) =>
        index === targetIndex
          ? {
              ...job,
              status: "queued" as const,
              promptStatus: "queued" as const,
              imageStatus: "idle" as const,
              finalPrompt: undefined,
              error: undefined,
              results: job.results || [],
            }
          : job,
      );

      setIsTyping(true);
      setEcommerceWorkflowError(null);
      ecommerceActions.setStep("BATCH_GENERATE", sessionId);
      ecommerceActions.setProgress(
        {
          done: 0,
          total: 1,
          text: `正在整理提示词：${targetPlan.item.title}`,
        },
        sessionId,
      );
      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.stage",
          step: "BATCH_GENERATE",
          title: "单条方案生成",
          detail: `仅生成当前方案：${targetPlan.item.title}`,
        },
        `开始生成：${targetPlan.item.title}`,
      );
      updateBatchUi(jobs, `已加入生成队列：${targetPlan.item.title}`);

      try {
        const prepareStartedAt = getTraceNow();
        const liveSession = ecommerceActions.getSession(sessionId);
        const referenceUrlById = new Map(
          liveSession.productImages.map((img) => [img.id, img.url]),
        );
        const supplementReferenceImages = collectSupplementReferenceImages(
          liveSession.supplementFields,
        );
        const referenceImages = Array.from(
          new Set([
            ...targetPlan.item.referenceImageIds
              .map((refId) => referenceUrlById.get(refId))
              .filter((url): url is string => typeof url === "string"),
            ...supplementReferenceImages,
          ]),
        ).slice(0, MAX_GENERATION_REFERENCE_IMAGES);
        const effectiveReferenceImages =
          referenceImages.length > 0
            ? referenceImages
            : liveSession.productImages
                .slice(0, MAX_GENERATION_REFERENCE_IMAGES)
                .map((img) => img.url);
        const targetAspectRatio = getDefaultEcommercePlanRatio({
          platformMode: liveSession.platformMode,
          typeId: targetPlan.group.typeId,
          typeTitle: targetPlan.group.typeTitle,
          itemTitle: targetPlan.item.title,
          itemDescription: targetPlan.item.description,
          preferredRatio: targetPlan.item.ratio,
        });
        const supplementSummary = summarizeSupplementFields(
          liveSession.supplementFields,
        );
        const relevantAnalyses = getRelevantImageAnalyses(
          liveSession,
          targetPlan.item.referenceImageIds,
        );
        const basePrompt = buildGenerationBasePrompt({
          session: liveSession,
          groupTitle: targetPlan.group.typeTitle,
          item: targetPlan.item,
          relevantAnalyses,
          supplementSummary,
        });
        const consistencyContext = buildGenerationConsistencyContext({
          item: targetPlan.item,
          relevantAnalyses,
        });
        logStep7Trace("single.prepare.done", {
          flow: "single-plan-item",
          planItemId,
          elapsedMs: getElapsedMs(prepareStartedAt),
          totalElapsedMs: getElapsedMs(traceStartedAt),
          referenceImageCount: effectiveReferenceImages.length,
          supplementReferenceCount: supplementReferenceImages.length,
          analysisCount: relevantAnalyses.length,
          basePromptChars: basePrompt.length,
        });

        jobs[targetIndex] = {
          ...jobs[targetIndex],
          status: "generating",
          promptStatus: "generating",
          imageStatus: "idle",
          error: undefined,
        };
        ecommerceActions.setProgress(
          {
            done: 0,
            total: 1,
            text: `正在整理提示词：${targetPlan.item.title}`,
          },
          sessionId,
        );
        updateBatchUi(jobs, `正在整理提示词：${targetPlan.item.title}`);

        const rewriteStartedAt = getTraceNow();
        logStep7Trace("single.prompt.rewrite.start", {
          flow: "single-plan-item",
          planItemId,
          basePromptChars: basePrompt.length,
          totalElapsedMs: getElapsedMs(traceStartedAt),
        });
        const rewriteResult = (await executeSkill("ecomRewritePrompt", {
          productDescription: liveSession.description,
          typeTitle: targetPlan.group.typeTitle,
          planTitle: targetPlan.item.title,
          planDescription: targetPlan.item.description,
          currentPrompt: basePrompt,
          supplementSummary,
          targetRatio: targetPlan.item.ratio,
          feedback: buildFinalizePromptFeedback(
            liveSession,
            targetPlan.group.typeTitle,
            targetPlan.item,
          ),
          imageAnalyses: relevantAnalyses.map((item) => ({
            title: item.title,
            description: item.description,
            analysisConclusion: item.analysisConclusion,
            angle: item.angle,
          })),
        })) as { prompt?: string } | string;
        const finalPrompt = enforceDirectTextMainlinePrompt(
          extractRewrittenPrompt(rewriteResult) || basePrompt,
          targetPlan.item,
        );
        logStep7Trace("single.prompt.rewrite.done", {
          flow: "single-plan-item",
          planItemId,
          elapsedMs: getElapsedMs(rewriteStartedAt),
          totalElapsedMs: getElapsedMs(traceStartedAt),
          finalPromptChars: finalPrompt.length,
          usedBasePromptFallback: finalPrompt === basePrompt,
        });

        jobs[targetIndex] = {
          ...jobs[targetIndex],
          status: "generating",
          promptStatus: "done",
          imageStatus: "generating",
          finalPrompt,
          error: undefined,
        };
        ecommerceActions.setProgress(
          {
            done: 0,
            total: 1,
            text: `正在生成图片：${targetPlan.item.title}`,
          },
          sessionId,
        );
        updateBatchUi(
          jobs,
          `提示词已完成，正在生成图片：${targetPlan.item.title}`,
        );

        const generationStartedAt = getTraceNow();
        logStep7Trace("single.image.generate.start", {
          flow: "single-plan-item",
          planItemId,
          aspectRatio: targetAspectRatio,
          referenceImageCount: effectiveReferenceImages.length,
          totalElapsedMs: getElapsedMs(traceStartedAt),
        });
        const generationResult = await generateImageWithModelFallback({
          session: liveSession,
          prompt: finalPrompt,
          aspectRatio: targetAspectRatio,
          referenceImages: effectiveReferenceImages,
          consistencyContext,
          onFallback: ({ failedModelLabel, nextModelLabel }) => {
            updateBatchUi(
              jobs,
              `模型 ${failedModelLabel} 当前不可用，已自动切换到 ${nextModelLabel} 重试：${targetPlan.item.title}`,
            );
          },
        });
        logStep7Trace("single.image.generate.done", {
          flow: "single-plan-item",
          planItemId,
          elapsedMs: getElapsedMs(generationStartedAt),
          totalElapsedMs: getElapsedMs(traceStartedAt),
          usedModel: generationResult.usedModel,
          usedModelLabel: generationResult.usedModelLabel,
          fallbackCount: generationResult.attemptedModels.length,
        });
        const generated = generationResult.imageUrl;
        const resultLabel = buildVersionedResultLabel(
          targetPlan.item.title,
          jobs[targetIndex].results || [],
        );

        const persistStartedAt = getTraceNow();
        const persistedResultAssetRef = await persistGeneratedResultAsset(
          sessionId,
          generated,
          resultLabel,
        ).catch((error) => {
          logStep7Trace("single.result.persist.failed", {
            flow: "single-plan-item",
            planItemId,
            elapsedMs: getElapsedMs(persistStartedAt),
            totalElapsedMs: getElapsedMs(traceStartedAt),
            message: getErrorMessage(error, "persist result asset failed"),
          });
          return null;
        });
        if (persistedResultAssetRef?.assetId) {
          logStep7Trace("single.result.persist.done", {
            flow: "single-plan-item",
            planItemId,
            elapsedMs: getElapsedMs(persistStartedAt),
            totalElapsedMs: getElapsedMs(traceStartedAt),
            assetId: persistedResultAssetRef.assetId,
          });
        }

        const seededResult = seedResultItemFromPlan({
          result: {
            assetId: persistedResultAssetRef?.assetId,
            url: generated,
            label: resultLabel,
            generationMeta: {
              usedModelLabel: generationResult.usedModelLabel,
              usedModel: generationResult.usedModel,
              attemptedModels: generationResult.attemptedModels,
              referenceImageCount: effectiveReferenceImages.length,
              consistencyGuarded: true,
              aspectRatio: targetAspectRatio,
              promptHash: buildPromptHash(finalPrompt),
              promptSummary: summarizePromptSnapshot(finalPrompt),
              promptText: finalPrompt,
            },
          },
          group: targetPlan.group,
          item: targetPlan.item,
        });

        jobs[targetIndex] = {
          ...jobs[targetIndex],
          status: "done",
          promptStatus: "done",
          imageStatus: "done",
          generationMeta: {
            usedModelLabel: generationResult.usedModelLabel,
            usedModel: generationResult.usedModel,
            attemptedModels: generationResult.attemptedModels,
            referenceImageCount: effectiveReferenceImages.length,
            consistencyGuarded: true,
            aspectRatio: targetAspectRatio,
            promptHash: buildPromptHash(finalPrompt),
            promptSummary: summarizePromptSnapshot(finalPrompt),
            promptText: finalPrompt,
          },
          results: [
            ...(jobs[targetIndex].results || []),
            seededResult,
          ],
        };

        const stateCommitStartedAt = getTraceNow();
        const batchJobSnapshot = cloneBatchJobs(jobs);
        const resultImages = cloneResultItems(
          collectBatchResults(batchJobSnapshot),
        );
        ecommerceActions.setBatchJobs(batchJobSnapshot, sessionId);
        ecommerceActions.setResults(resultImages, sessionId);
        ecommerceActions.setProgress(
          {
            done: 1,
            total: 1,
            text: `已完成：${targetPlan.item.title}`,
          },
          sessionId,
        );
        logStep7Trace("single.state.commit.done", {
          flow: "single-plan-item",
          planItemId,
          elapsedMs: getElapsedMs(stateCommitStartedAt),
          totalElapsedMs: getElapsedMs(traceStartedAt),
          resultCount: resultImages.length,
        });
        queueStep7RenderTrace("single.render.commit", {
          flow: "single-plan-item",
          planItemId,
          totalElapsedMs: getElapsedMs(traceStartedAt),
          resultCount: resultImages.length,
        });

        pushWorkflowUiMessage(
          {
            type: "ecomOneClick.batch",
            jobs: batchJobSnapshot,
            done: batchJobSnapshot.filter((item) => item.status === "done")
              .length,
            total: batchJobSnapshot.length,
          },
          `已完成单条生成：${targetPlan.item.title}`,
        );
        pushWorkflowUiMessage(
          {
            type: "ecomOneClick.results",
            images: resultImages,
          },
          `当前共有 ${resultImages.length} 张生成结果。`,
        );
        addMessage({
          id: createWorkflowMessageId("ecom-plan-generate"),
          role: "model",
          text:
            generationResult.attemptedModels.length > 0
              ? `已完成单条生成：${targetPlan.item.title}，并已自动切换到 ${generationResult.usedModelLabel}。`
              : `已完成单条生成：${targetPlan.item.title}`,
          timestamp: Date.now(),
        });
      } catch (error) {
        logStep7Trace("single.failed", {
          flow: "single-plan-item",
          planItemId,
          totalElapsedMs: getElapsedMs(traceStartedAt),
          message: getErrorMessage(error, "单条方案生成失败。"),
        });
        const message = getErrorMessage(error, "单条方案生成失败。");
        const promptFinished = jobs[targetIndex]?.promptStatus === "done";
        jobs[targetIndex] = {
          ...jobs[targetIndex],
          status: "failed",
          promptStatus: promptFinished ? "done" : "failed",
          imageStatus: promptFinished ? "failed" : "idle",
          error: classifyGenerationFailure(error),
        };
        const batchJobSnapshot = cloneBatchJobs(jobs);
        ecommerceActions.setBatchJobs(batchJobSnapshot, sessionId);
        ecommerceActions.setResults(
          cloneResultItems(collectBatchResults(batchJobSnapshot)),
          sessionId,
        );
        setEcommerceWorkflowError(message);
        pushWorkflowUiMessage(
          {
            type: "ecomOneClick.batch",
            jobs: batchJobSnapshot,
            done: batchJobSnapshot.filter((item) => item.status === "done")
              .length,
            total: batchJobSnapshot.length,
          },
          `单条生成失败：${targetPlan.item.title}`,
        );
        addMessage({
          id: createWorkflowMessageId("ecom-plan-generate-error"),
          role: "model",
          text: `单条方案生成失败：${message}`,
          timestamp: Date.now(),
          error: true,
        });
      } finally {
        logStep7Trace("single.finish", {
          flow: "single-plan-item",
          planItemId,
          totalElapsedMs: getElapsedMs(traceStartedAt),
        });
        releaseActionLock(lockKey);
        setIsTyping(false);
      }
    },
    [
      acquireActionLock,
      addMessage,
      ecommerceActions,
      ensureEcommerceSession,
      pushWorkflowUiMessage,
      releaseActionLock,
      setEcommerceWorkflowError,
      setIsTyping,
      syncPlanGroups,
    ],
  );

  const handleEcommercePromoteResult = useCallback(
    (url: string) => {
      const sessionId = ensureEcommerceSession();
      const session = ecommerceActions.getSession(sessionId);
      const currentResults = session.results || [];
      const target = currentResults.find((item) => item.url === url);

      if (!target) return;

      const nextResults = [
        target,
        ...currentResults.filter((item) => item.url !== url),
      ];

      ecommerceActions.setResults(nextResults, sessionId);
      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.results",
          images: nextResults,
        },
        `已将结果置顶：${target.label || "当前图片"}`,
      );
      addMessage({
        id: createWorkflowMessageId("ecom-result-promote"),
        role: "model",
        text: `已设为当前首选结果：${target.label || "当前图片"}`,
        timestamp: Date.now(),
      });
    },
    [
      addMessage,
      ecommerceActions,
      ensureEcommerceSession,
      pushWorkflowUiMessage,
    ],
  );

  const handleEcommercePromoteSelectedResults = useCallback(
    (urls: string[]) => {
      if (urls.length === 0) return;

      const sessionId = ensureEcommerceSession();
      const session = ecommerceActions.getSession(sessionId);
      const currentResults = session.results || [];
      const selectedUrlSet = new Set(urls);
      const selectedResults = currentResults.filter((item) =>
        selectedUrlSet.has(item.url),
      );

      if (selectedResults.length === 0) return;

      const nextResults = [
        ...selectedResults,
        ...currentResults.filter((item) => !selectedUrlSet.has(item.url)),
      ];

      ecommerceActions.setResults(nextResults, sessionId);
      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.results",
          images: nextResults,
        },
        `已将 ${selectedResults.length} 张结果提到结果列表前列。`,
      );
      addMessage({
        id: createWorkflowMessageId("ecom-result-promote-selected"),
        role: "model",
        text:
          selectedResults.length === 1
            ? `已把选中结果设为优先结果：${selectedResults[0]?.label || "当前图片"}`
            : `已按当前画廊顺序提升 ${selectedResults.length} 张选中结果。`,
        timestamp: Date.now(),
      });
    },
    [
      addMessage,
      ecommerceActions,
      ensureEcommerceSession,
      pushWorkflowUiMessage,
    ],
  );

  const handleEcommerceDeleteResult = useCallback(
    (url: string) => {
      const sessionId = ensureEcommerceSession();
      const session = ecommerceActions.getSession(sessionId);
      const matchedResult = session.results.find((item) => item.url === url);

      const nextBatchJobs = session.batchJobs.map((job) => {
        const nextJobResults = (job.results || []).filter(
          (result) => result.url !== url,
        );
        if (nextJobResults.length === job.results.length) {
          return job;
        }
        return {
          ...job,
          results: nextJobResults,
          status:
            nextJobResults.length === 0 && job.status === "done"
              ? ("idle" as const)
              : job.status,
          promptStatus:
            nextJobResults.length === 0 && job.status === "done"
              ? ("idle" as const)
              : job.promptStatus,
          imageStatus:
            nextJobResults.length === 0 && job.status === "done"
              ? ("idle" as const)
              : job.imageStatus,
          finalPrompt:
            nextJobResults.length === 0 && job.status === "done"
              ? undefined
              : job.finalPrompt,
        };
      });
      const nextResults = collectBatchResults(nextBatchJobs);
      const nextDone = nextBatchJobs.filter(
        (job) => job.status === "done",
      ).length;

      ecommerceActions.setBatchJobs(nextBatchJobs, sessionId);
      ecommerceActions.setResults(nextResults, sessionId);

      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.batch",
          jobs: nextBatchJobs,
          done: nextDone,
          total: nextBatchJobs.length,
        },
        "批量任务结果已同步更新。",
      );
      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.results",
          images: nextResults,
        },
        `当前剩余 ${nextResults.length} 张生成结果。`,
      );
      addMessage({
        id: createWorkflowMessageId("ecom-result-delete"),
        role: "model",
        text: `已删除结果：${matchedResult?.label || "当前图片"}`,
        timestamp: Date.now(),
      });
    },
    [
      addMessage,
      ecommerceActions,
      ensureEcommerceSession,
      pushWorkflowUiMessage,
    ],
  );

  const handleEcommerceOpenOverlayEditor = useCallback(
    (url: string) => {
      const sessionId = ensureEcommerceSession();
      const session = ecommerceActions.getSession(sessionId);
      const target = session.results.find((item) => item.url === url);
      if (!target) {
        return;
      }

      ecommerceActions.setEditingResultUrl(url, sessionId);
      ecommerceActions.setOverlayPanelOpen(true, sessionId);
      ecommerceActions.setPreferredOverlayTemplateId(
        target.overlayState?.templateId || target.layoutMeta?.layoutMode || null,
        sessionId,
      );
    },
    [ecommerceActions, ensureEcommerceSession],
  );

  const handleEcommerceCloseOverlayEditor = useCallback(() => {
    const sessionId = ensureEcommerceSession();
    ecommerceActions.setOverlayPanelOpen(false, sessionId);
    ecommerceActions.setEditingResultUrl(null, sessionId);
  }, [ecommerceActions, ensureEcommerceSession]);

  const handleEcommerceSaveResultOverlayDraft = useCallback(
    async (url: string, overlayState: EcommerceOverlayState | null) => {
      const sessionId = ensureEcommerceSession();
      const updated = patchResultCollections(sessionId, url, (result) => ({
        ...result,
        overlayState: normalizeOverlayState(
          overlayState
            ? {
                ...overlayState,
                status: overlayState.status === "applied" ? "draft" : "draft",
                renderStatus: undefined,
                renderStatusMessage: undefined,
                renderedPersistence: undefined,
              }
            : null,
          result.overlayState,
        ),
      }));

      if (!updated) {
        throw new Error("未找到要保存上字草稿的结果。");
      }

      ecommerceActions.setPreferredOverlayTemplateId(
        updated.overlayState?.templateId || null,
        sessionId,
      );
      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.results",
          images: ecommerceActions.getSession(sessionId).results,
        },
        `已保存上字草稿：${updated.label || "当前图片"}`,
      );
    },
    [
      ecommerceActions,
      ensureEcommerceSession,
      patchResultCollections,
      pushWorkflowUiMessage,
    ],
  );

  const handleEcommerceApplyResultOverlay = useCallback(
    async (url: string, overlayState: EcommerceOverlayState | null) => {
      const sessionId = ensureEcommerceSession();
      const session = ecommerceActions.getSession(sessionId);
      const target = session.results.find((item) => item.url === url);
      if (!target) {
        throw new Error("未找到要上字的结果。");
      }

      const preparedTarget = await handleEcommercePrepareResultForCanvas(target);
      const normalized = normalizeOverlayState(
        overlayState,
        preparedTarget.overlayState || target.overlayState,
      );
      if (!normalized) {
        throw new Error("当前没有可应用的上字内容。");
      }

      try {
        const rendered = await composeOverlayImage(
          preparedTarget.overlayState?.baseImageUrl || target.url,
          normalized,
          preparedTarget.layoutMeta || target.layoutMeta,
        );
        let renderedImageUrl = rendered.dataUrl;
        let renderedAssetId: string | undefined;
        let applySuccessMessage = `已回写上字成片：${target.label || "当前图片"}`;
        let renderedPersistence: EcommerceOverlayState["renderedPersistence"] =
          "persisted";
        let renderStatus: EcommerceOverlayState["renderStatus"] = "success";

        try {
          const fileName = `${sanitizeGeneratedAssetFileName(
            `${target.label || "ecom-overlay-result"}-overlay`,
          )}.${inferGeneratedImageExtension(rendered.mimeType)}`;
          const file = new File([rendered.blob], fileName, {
            type: rendered.mimeType,
          });
          const assetRef = await saveTopicAssetFromFile(sessionId, "result", file);
          const persistedUrl = await resolveTopicAssetRefUrl(assetRef);
          renderedImageUrl = persistedUrl || rendered.dataUrl;
          renderedAssetId = assetRef?.assetId || undefined;
          if (!assetRef?.assetId) {
            renderedPersistence = "session-only";
            renderStatus = "warning";
            applySuccessMessage = `已生成上字成片，但未能落盘为项目资产：${target.label || "当前图片"}`;
          }
        } catch (error) {
          console.warn("[ecomOverlay] persist rendered asset failed", error);
          renderedPersistence = "session-only";
          renderStatus = "warning";
          applySuccessMessage = `已生成上字成片，但资产保存失败，仅保留当前会话结果：${target.label || "当前图片"}`;
        }
        if (normalized.replacementQuality?.summary) {
          applySuccessMessage = `${applySuccessMessage} ${normalized.replacementQuality.summary}`;
        }

        const updated = patchResultCollections(sessionId, url, (result) => ({
          ...result,
          overlayState: normalizeOverlayState(
            {
              ...normalized,
              status: "applied",
              renderStatus,
              renderStatusMessage: applySuccessMessage,
              renderedPersistence,
              renderedImageUrl,
              renderedAssetId,
              renderedAt: Date.now(),
            },
            result.overlayState,
          ),
        }));

        if (!updated) {
          throw new Error("上字成片回写失败。");
        }

        ecommerceActions.setPreferredOverlayTemplateId(
          updated.overlayState?.templateId || null,
          sessionId,
        );
        pushWorkflowUiMessage(
          {
            type: "ecomOneClick.results",
            images: ecommerceActions.getSession(sessionId).results,
          },
          applySuccessMessage.replace(
            target.label || "当前图片",
            updated.label || target.label || "当前图片",
          ),
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "上字成片生成失败。";
        patchResultCollections(sessionId, url, (result) => ({
          ...result,
          overlayState: normalizeOverlayState(
            {
              ...(result.overlayState || normalized),
              status:
                result.overlayState?.status === "applied" ? "draft" : "draft",
              renderStatus: "error",
              renderStatusMessage: errorMessage,
              renderedPersistence: undefined,
            },
            result.overlayState,
          ),
        }));
        throw error instanceof Error ? error : new Error(errorMessage);
      }
    },
    [
      ecommerceActions,
      ensureEcommerceSession,
      handleEcommercePrepareResultForCanvas,
      patchResultCollections,
      pushWorkflowUiMessage,
    ],
  );

  const handleEcommerceExportResultOverlayVariants = useCallback(
    async (url: string, overlayState: EcommerceOverlayState | null) => {
      const sessionId = ensureEcommerceSession();
      const session = ecommerceActions.getSession(sessionId);
      const target = session.results.find((item) => item.url === url);
      if (!target) {
        throw new Error("未找到要导出多版本上字的结果。");
      }

      const preparedTarget = await handleEcommercePrepareResultForCanvas(target);
      const normalized = normalizeOverlayState(
        overlayState,
        preparedTarget.overlayState || target.overlayState,
      );
      if (!normalized) {
        throw new Error("当前没有可导出的上字内容。");
      }

      const variantUrls: string[] = [];
      try {
        const items = [];
        for (const preset of OVERLAY_PLATFORM_PRESET_OPTIONS) {
          const variantState = buildOverlayPlatformVariantState(normalized, preset);
          const rendered = await composeOverlayImage(
            preparedTarget.overlayState?.baseImageUrl || target.url,
            variantState,
            preparedTarget.layoutMeta || target.layoutMeta,
          );
          const objectUrl = URL.createObjectURL(rendered.blob);
          variantUrls.push(objectUrl);
          items.push({
            url: objectUrl,
            label: sanitizeGeneratedAssetFileName(
              `${target.label || "ecom-overlay"}-${preset.label}`,
            ),
            meta: {
              platformPresetId: preset.id,
              platformPresetLabel: preset.label,
              templateId: preset.templateId,
              sourceUrl: target.url,
            },
          });
        }

        await exportOverlayImagesZip({
          items,
          filename: sanitizeGeneratedAssetFileName(
            `${target.label || "ecom-overlay"}-platform-variants`,
          ),
        });

        pushWorkflowUiMessage(
          {
            type: "ecomOneClick.results",
            images: ecommerceActions.getSession(sessionId).results,
          },
          `已导出多平台上字版本：${target.label || "当前图片"}（${items.length} 份）`,
        );
      } finally {
        variantUrls.forEach((item) => URL.revokeObjectURL(item));
      }
    },
    [
      ecommerceActions,
      ensureEcommerceSession,
      handleEcommercePrepareResultForCanvas,
      pushWorkflowUiMessage,
    ],
  );

  const handleEcommerceExportSelectedOverlayVariants = useCallback(
    async (urls: string[]) => {
      const selectedUrls = Array.from(
        new Set(
          (urls || [])
            .map((item) => String(item || "").trim())
            .filter(Boolean),
        ),
      );
      if (selectedUrls.length === 0) {
        throw new Error("请先勾选要导出多平台版本的结果。");
      }

      const sessionId = ensureEcommerceSession();
      const session = ecommerceActions.getSession(sessionId);
      const targets = selectedUrls
        .map((url) => session.results.find((item) => item.url === url) || null)
        .filter((item): item is EcommerceResultItem => Boolean(item));

      if (targets.length === 0) {
        throw new Error("未找到要批量导出的结果。");
      }

      const exportableTargets = targets.filter((item) =>
        normalizeOverlayState(item.overlayState, item.overlayState),
      );
      if (exportableTargets.length === 0) {
        throw new Error("已勾选结果里还没有可导出的上字内容。");
      }

      const variantUrls: string[] = [];
      try {
        const items: Array<{
          url: string;
          label: string;
          meta?: Record<string, unknown>;
        }> = [];

        for (const target of exportableTargets) {
          const preparedTarget = await handleEcommercePrepareResultForCanvas(target);
          const normalized = normalizeOverlayState(
            preparedTarget.overlayState,
            preparedTarget.overlayState,
          );
          if (!normalized) continue;

          for (const preset of OVERLAY_PLATFORM_PRESET_OPTIONS) {
            const variantState = buildOverlayPlatformVariantState(
              normalized,
              preset,
            );
            const rendered = await composeOverlayImage(
              preparedTarget.overlayState?.baseImageUrl || target.url,
              variantState,
              preparedTarget.layoutMeta || target.layoutMeta,
            );
            const objectUrl = URL.createObjectURL(rendered.blob);
            variantUrls.push(objectUrl);
            items.push({
              url: objectUrl,
              label: sanitizeGeneratedAssetFileName(
                `${target.label || "ecom-overlay"}-${preset.label}`,
              ),
              meta: {
                sourceUrl: target.url,
                sourceLabel: target.label || null,
                platformPresetId: preset.id,
                platformPresetLabel: preset.label,
                templateId: preset.templateId,
              },
            });
          }
        }

        if (items.length === 0) {
          throw new Error("当前勾选结果暂时没有生成出可导出的多平台版本。");
        }

        await exportOverlayImagesZip({
          items,
          filename: sanitizeGeneratedAssetFileName(
            `ecom-overlay-batch-platform-variants-${new Date()
              .toISOString()
              .slice(0, 10)}`,
          ),
        });

        const skippedCount = targets.length - exportableTargets.length;
        pushWorkflowUiMessage(
          {
            type: "ecomOneClick.results",
            images: ecommerceActions.getSession(sessionId).results,
          },
          skippedCount > 0
            ? `已导出 ${exportableTargets.length} 张结果的多平台版本（共 ${items.length} 份），另有 ${skippedCount} 张因没有上字内容被跳过。`
            : `已导出 ${exportableTargets.length} 张结果的多平台版本（共 ${items.length} 份）。`,
        );
      } finally {
        variantUrls.forEach((item) => URL.revokeObjectURL(item));
      }
    },
    [
      ecommerceActions,
      ensureEcommerceSession,
      handleEcommercePrepareResultForCanvas,
      pushWorkflowUiMessage,
    ],
  );

  const handleEcommerceUploadResultOverlayFont = useCallback(
    async (url: string, file: File) => {
      const sessionId = ensureEcommerceSession();
      const assetRef = await saveTopicAssetFromFile(sessionId, "font", file);
      const uploadedUrl =
        (await resolveTopicAssetRefUrl(assetRef)) || (await uploadImage(file));
      const fontLabel =
        file.name.replace(/\.[^.]+$/, "").trim() || "自定义字体";

      const updated = patchResultCollections(sessionId, url, (result) => ({
        ...result,
        overlayState: normalizeOverlayState(
          {
            ...(result.overlayState || {}),
            status:
              result.overlayState?.status === "applied" ? "draft" : "draft",
            renderStatus: undefined,
            renderStatusMessage: undefined,
            renderedPersistence: undefined,
            fontAssetId: assetRef?.assetId,
            fontUrl: uploadedUrl,
            fontLabel,
            fontFamily:
              result.overlayState?.fontFamily ||
              `ecom_font_${Math.random().toString(36).slice(2, 8)}`,
          },
          result.overlayState,
        ),
      }));

      if (!updated) {
        throw new Error("字体上传成功，但没有找到对应结果项。");
      }
    },
    [ensureEcommerceSession, patchResultCollections],
  );

  const handleEcommerceUploadResultOverlayIcon = useCallback(
    async (url: string, file: File) => {
      const sessionId = ensureEcommerceSession();
      const assetRef = await saveTopicAssetFromFile(sessionId, "icon", file);
      const uploadedUrl =
        (await resolveTopicAssetRefUrl(assetRef)) || (await uploadImage(file));
      const iconLabel = file.name.replace(/\.[^.]+$/, "").trim() || "标签图标";

      const updated = patchResultCollections(sessionId, url, (result) => ({
        ...result,
        overlayState: normalizeOverlayState(
          {
            ...(result.overlayState || {}),
            status:
              result.overlayState?.status === "applied" ? "draft" : "draft",
            renderStatus: undefined,
            renderStatusMessage: undefined,
            renderedPersistence: undefined,
            featureTagIconAssetId: assetRef?.assetId,
            featureTagIconUrl: uploadedUrl,
            featureTagIconLabel: iconLabel,
          },
          result.overlayState,
        ),
      }));

      if (!updated) {
        throw new Error("图标上传成功，但没有找到对应结果项。");
      }
    },
    [ensureEcommerceSession, patchResultCollections],
  );

  const handleEcommerceResetResultOverlay = useCallback(
    async (url: string) => {
      const sessionId = ensureEcommerceSession();
      const updated = patchResultCollections(sessionId, url, (result) => ({
        ...result,
        overlayState: undefined,
      }));

      if (!updated) {
        throw new Error("未找到要重置上字的结果。");
      }

      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.results",
          images: ecommerceActions.getSession(sessionId).results,
        },
        `已还原无字底图：${updated.label || "当前图片"}`,
      );
    },
    [
      ecommerceActions,
      ensureEcommerceSession,
      patchResultCollections,
      pushWorkflowUiMessage,
    ],
  );

  const handleEcommerceConfirmPlans = useCallback(
    (groups: EcommercePlanGroup[]) => {
      const sessionId = ensureEcommerceSession();
      const session = ecommerceActions.getSession(sessionId);
      const planItemCount = groups.reduce(
        (sum, group) => sum + group.items.length,
        0,
      );

      if (planItemCount === 0) {
        addMessage({
          id: createWorkflowMessageId("ecom-plan-empty"),
          role: "model",
          text: "当前没有可执行的方案项，请至少保留 1 张方案图后再继续。",
          timestamp: Date.now(),
          error: true,
        });
        return;
      }

      const { nextBatchJobs, nextResults } = syncPlanGroups(sessionId, groups);
      const done = nextBatchJobs.filter((job) => job.status === "done").length;

      ecommerceActions.setStep("FINALIZE_PROMPTS", sessionId);
      ecommerceActions.setProgress(
        {
          done: 5,
          total: 6,
          text: "方案已确认，请继续定稿提示词并确认模型。",
        },
        sessionId,
      );

      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.plans",
          groups,
          review: session.planReview || undefined,
        },
        "方案分组已保存。",
      );

      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.modelLock",
          models: session.modelOptions,
          selectedModelId: session.selectedModelId || undefined,
        },
        "请选择生成模型后继续。",
      );

      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.batch",
          jobs: nextBatchJobs,
          done,
          total: nextBatchJobs.length,
        },
        "批量任务队列已准备完成。",
      );

      addMessage({
        id: createWorkflowMessageId("ecom-plan-save"),
        role: "model",
        text:
          nextBatchJobs.length > 0
            ? nextResults.length > 0
              ? `方案分组已保存，已准备 ${nextBatchJobs.length} 个批量任务，并保留 ${nextResults.length} 张已有结果。`
              : `方案分组已保存，已准备 ${nextBatchJobs.length} 个批量任务。`
            : "方案分组已保存，但当前还没有可执行的批量任务。",
        timestamp: Date.now(),
      });
    },
    [
      addMessage,
      ecommerceActions,
      ensureEcommerceSession,
      pushWorkflowUiMessage,
      syncPlanGroups,
    ],
  );
  const handleEcommerceAutofillPlans = useCallback(
    async (groups: EcommercePlanGroup[]): Promise<EcommercePlanGroup[]> => {
      const sessionId = ensureEcommerceSession();
      const lockKey = `${sessionId}:autofill-plans`;
      if (!acquireActionLock(lockKey)) {
        return groups;
      }

      try {
        const session = ecommerceActions.getSession(sessionId);
        const selectedTypes = session.recommendedTypes.filter(
          (item) => item.selected,
        );
        const planningStageBlock = buildPlanningStageContextBlock({
          session,
          selectedTypes: selectedTypes.map((item) => ({
            id: item.id,
            title: item.title,
            imageCount: getTargetPlanItemCount(item.imageCount, session.workflowMode),
          })),
        });
        const planResult = (await executeSkill("ecomAutofillPlans", {
          selectedTypes: selectedTypes.map((item) => ({
            id: item.id,
            title: item.title,
            imageCount: getTargetPlanItemCount(
              item.imageCount,
              session.workflowMode,
            ),
          })),
          imageAnalyses: session.imageAnalyses.map((item) => ({
            imageId: item.imageId,
            title: item.title,
            description: item.description,
            analysisConclusion: item.analysisConclusion,
          })),
          brief: appendPlanGenerationContextText(
            session.description,
            planningStageBlock,
          ),
          supplementSummary: summarizeSupplementFields(session.supplementFields),
          platformMode: session.platformMode,
          workflowMode: session.workflowMode,
          currentGroups: groups,
        })) as { groups?: unknown } | null;

        const normalizedGroups = enrichPlanGroupsWithCompetitorContext(
          enrichPlanGroupsWithLegacyProfiles(normalizePlanGroups(planResult?.groups)),
          session.competitorPlanningContext,
          {
            planningMode: getPlanningStageCompetitorMode(session),
            generationMode: getGenerationStageCompetitorMode(session),
          },
        );
        const referencedGroups = syncPlanGroupReferences(
          normalizedGroups.length > 0 ? normalizedGroups : groups,
          session.imageAnalyses,
        );
        return mergeAutofilledPlanGroups(groups, referencedGroups);
      } catch (error) {
        console.error("ecomAutofillPlans error:", error);
        throw new Error(
          getErrorMessage(error, "AI 暂时无法补全当前方案草稿，请稍后再试。"),
        );
      } finally {
        releaseActionLock(lockKey);
      }
    },
    [ecommerceActions, ensureEcommerceSession],
  );
  const handleEcommerceAutofillSupplements = useCallback(
    async (
      fields: EcommerceSupplementField[],
    ): Promise<EcommerceSupplementField[]> => {
      const sessionId = ensureEcommerceSession();
      const lockKey = `${sessionId}:autofill-supplements`;
      if (!acquireActionLock(lockKey)) {
        return fields;
      }

      try {
        const session = ecommerceActions.getSession(sessionId);
        const sanitizedFields = sanitizeSupplementFields(fields);
        const autofillResult = (await executeSkill("ecomAutofillSupplements", {
          productImages: session.productImages.map((image) => ({
            id: image.id,
            url: image.url,
            name: image.name,
          })),
          brief: session.description,
          platformMode: session.platformMode,
          workflowMode: session.workflowMode,
          recommendedTypes: session.recommendedTypes
            .filter((item) => item.selected)
            .map((item) => ({
              id: item.id,
              title: item.title,
              selected: item.selected,
            })),
          fields: sanitizedFields,
        })) as { fields?: unknown } | null;

        const normalizedFields = normalizeSupplementFields(
          autofillResult?.fields,
        );

        return mergeAutofilledSupplementFields(
          sanitizedFields,
          normalizedFields.length > 0 ? normalizedFields : sanitizedFields,
        );
      } catch (error) {
        console.error("ecomAutofillSupplements error:", error);
        throw new Error(
          getErrorMessage(
            error,
            "AI 暂时无法补全这些信息，请稍后再试，或先手动填写关键项。",
          ),
        );
      } finally {
        releaseActionLock(lockKey);
      }
    },
    [ecommerceActions, ensureEcommerceSession],
  );
  const handleEcommerceConfirmSupplements = useCallback(
    async (fields: EcommerceSupplementField[]) => {
      const sessionId = ensureEcommerceSession();
      const lockKey = `${sessionId}:stage-flow`;
      if (!acquireActionLock(lockKey)) {
        return;
      }
      const session = ecommerceActions.getSession(sessionId);
      const sanitizedFields = sanitizeSupplementFields(fields);
      const missingRequiredFields = getEmptyRequiredSupplementFields(
        sanitizedFields,
      );

      if (
        session.workflowMode === "professional" &&
        missingRequiredFields.length > 0
      ) {
        setEcommerceWorkflowError(
          `还有 ${missingRequiredFields.length} 个必填项未完成，请先补齐补充信息。`,
        );
        addMessage({
          id: createWorkflowMessageId("ecom-supplement-required-missing"),
          role: "model",
          text: `还有必填补充信息未完成：${missingRequiredFields
            .map((field) => field.label)
            .join("、")}。专业模式下建议先补齐再继续。`,
          timestamp: Date.now(),
          error: true,
        });
        releaseActionLock(lockKey);
        return;
      }

      if (
        session.workflowMode === "quick" &&
        missingRequiredFields.length > 0
      ) {
        addMessage({
          id: createWorkflowMessageId("ecom-supplement-quick-warning"),
          role: "model",
          text: `快速模式下将跳过未填写的必填信息：${missingRequiredFields
            .map((field) => field.label)
            .join("、")}。后续方案可能更偏通用。`,
          timestamp: Date.now(),
        });
      }

      ecommerceActions.setSupplementFields(sanitizedFields, sessionId);
      ecommerceActions.setImageAnalysisReview(null, sessionId);
      ecommerceActions.setImageAnalyses([], sessionId);
      ecommerceActions.setPlanReview(null, sessionId);
      ecommerceActions.setPlanGroups([], sessionId);
      ecommerceActions.setBatchJobs([], sessionId);
      ecommerceActions.setResults([], sessionId);
      ecommerceActions.setSelectedModelId(null, sessionId);

      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.supplements",
          fields: sanitizedFields,
        },
        "补充信息已保存。",
      );

      setIsTyping(true);
      setEcommerceWorkflowError(null);
      ecommerceActions.setStep("ANALYZE_IMAGES", sessionId);
      ecommerceActions.setProgress(
        {
          done: 3,
          total: 6,
          text: "正在分析商品图片。",
        },
        sessionId,
      );

      try {
        const imageAnalysisResult = (await executeSkill("ecomAnalyzeImages", {
          productImages: session.productImages.map((image) => ({
            id: image.id,
            url: image.url,
            name: image.name,
          })),
          brief: session.description,
          platformMode: session.platformMode,
          workflowMode: session.workflowMode,
          supplementSummary: summarizeSupplementFields(fields),
        })) as { items?: unknown; review?: unknown };

        const imageAnalyses = normalizeImageAnalyses(
          imageAnalysisResult?.items,
        );
        const imageAnalysisReview =
          normalizeStageReview(imageAnalysisResult?.review) ||
          buildDefaultStageReview("image", imageAnalyses.length);

        ecommerceActions.setImageAnalyses(imageAnalyses, sessionId);
        ecommerceActions.setImageAnalysisReview(imageAnalysisReview, sessionId);
        ecommerceActions.setProgress(
          {
            done: 4,
            total: 6,
            text: "图片分析已完成，请确认。",
          },
          sessionId,
        );

        pushWorkflowUiMessage(
          {
            type: "ecomOneClick.imageAnalyses",
            items: imageAnalyses,
            review: imageAnalysisReview,
          },
          "图片分析已完成，请确认。",
        );
      } catch (error) {
        ecommerceActions.setStep("SUPPLEMENT_INFO", sessionId);
        const message = getErrorMessage(error, "图片分析失败。");
        setEcommerceWorkflowError(message);
        addMessage({
          id: createWorkflowMessageId("ecom-image-analysis-error"),
          role: "model",
          text: `图片分析失败：${message}`,
          timestamp: Date.now(),
          error: true,
        });
      } finally {
        releaseActionLock(lockKey);
        setIsTyping(false);
      }
    },
    [
      acquireActionLock,
      addMessage,
      ecommerceActions,
      ensureEcommerceSession,
      pushWorkflowUiMessage,
      releaseActionLock,
      setEcommerceWorkflowError,
      setIsTyping,
    ],
  );
  const handleEcommerceRunBatchGenerate = useCallback(
    async (failedOnly = false, options?: BatchRunOptions) => {
      const traceStartedAt = getTraceNow();
      const promptOnly = Boolean(options?.promptOnly);
      const promptOverrides = options?.promptOverrides || {};
      const targetPlanItemIds = Array.isArray(options?.targetPlanItemIds)
        ? options.targetPlanItemIds.filter(
            (item): item is string => typeof item === "string" && item.length > 0,
          )
        : [];
      const targetPlanItemIdSet =
        targetPlanItemIds.length > 0 ? new Set(targetPlanItemIds) : null;
      const isTargetedRun = Boolean(targetPlanItemIdSet);
      const preserveExistingResults = Boolean(
        options?.preserveExistingResults ?? isTargetedRun,
      );
      const sessionId = ensureEcommerceSession();
      const lockKey = `${sessionId}:batch-generate:${
        promptOnly ? "prompt" : failedOnly ? "retry" : "all"
      }:${targetPlanItemIds.join(",") || "all"}`;
      if (!acquireActionLock(lockKey)) {
        return;
      }
      logStep7Trace("batch.start", {
        flow: isTargetedRun ? "batch-targeted" : "batch-all",
        sessionId,
        promptOnly,
        failedOnly,
        targetPlanItemIds,
        preserveExistingResults,
      });
      const initialSession = ecommerceActions.getSession(sessionId);
      const currentJobs = initialSession.batchJobs || [];

      if (currentJobs.length === 0) {
        addMessage({
          id: createWorkflowMessageId("ecom-batch-empty"),
          role: "model",
          text: "当前还没有可执行的批量任务，请先完成方案规划。",
          timestamp: Date.now(),
          error: true,
        });
        releaseActionLock(lockKey);
        return;
      }

      if (!initialSession.selectedModelId) {
        addMessage({
          id: createWorkflowMessageId("ecom-batch-model-missing"),
          role: "model",
          text: "请先确认默认生成模型，再开始批量生成。",
          timestamp: Date.now(),
          error: true,
        });
        releaseActionLock(lockKey);
        return;
      }

      const jobs: EcommerceBatchJob[] = currentJobs.map((job) => {
        if (targetPlanItemIdSet && !targetPlanItemIdSet.has(job.planItemId)) {
          return job;
        }

        if (failedOnly) {
          return job.status === "failed"
            ? {
                ...job,
                status: "idle" as const,
                promptStatus: "idle" as const,
                imageStatus: "idle" as const,
                finalPrompt: undefined,
                error: undefined,
              }
            : job;
        }

        return {
          ...job,
          status: (promptOnly ? job.status : "idle") as EcommerceBatchJob["status"],
          promptStatus: "idle" as const,
          imageStatus: (promptOnly
            ? (job.imageStatus || "idle")
            : "idle") as EcommerceBatchJob["imageStatus"],
          finalPrompt: promptOnly
            ? undefined
            : (promptOverrides[job.planItemId] || "").trim() ||
              (job.finalPrompt || ""),
          error: promptOnly ? job.error : undefined,
          results:
            promptOnly || preserveExistingResults ? job.results || [] : [],
        };
      });
      const targetIndices = jobs
        .map((job, index) => ({ job, index }))
        .filter(({ job }) => {
          if (targetPlanItemIdSet && !targetPlanItemIdSet.has(job.planItemId)) {
            return false;
          }
          return failedOnly ? job.status === "idle" : true;
        })
        .map(({ index }) => index);

      if (targetIndices.length === 0) {
        addMessage({
          id: createWorkflowMessageId("ecom-batch-none"),
          role: "model",
          text: failedOnly
            ? "当前没有失败任务可重试。"
            : "当前没有可执行的生成任务。",
          timestamp: Date.now(),
        });
        releaseActionLock(lockKey);
        return;
      }

      const updateBatchUi = (batchJobs: EcommerceBatchJob[], text: string) => {
        const batchJobSnapshot = cloneBatchJobs(batchJobs);
        const resultSnapshot = cloneResultItems(
          collectBatchResults(batchJobSnapshot),
        );
        const done = batchJobSnapshot.filter(
          (item) => item.status === "done",
        ).length;
        ecommerceActions.setBatchJobs(batchJobSnapshot, sessionId);
        ecommerceActions.setResults(resultSnapshot, sessionId);
        pushWorkflowUiMessage(
          {
            type: "ecomOneClick.batch",
            jobs: batchJobSnapshot,
            done,
            total: batchJobSnapshot.length,
            view: promptOnly ? "finalize" : "execute",
          },
          text,
        );
      };

      setIsTyping(true);
      setEcommerceWorkflowError(null);
      ecommerceActions.setStep(
        promptOnly ? "FINALIZE_PROMPTS" : "BATCH_GENERATE",
        sessionId,
      );
      ecommerceActions.setProgress(
        {
          done: 0,
          total: targetIndices.length,
          text: promptOnly
            ? "正在批量定稿提示词..."
            : failedOnly
              ? "正在重试失败任务..."
              : "正在执行批量生成...",
        },
        sessionId,
      );
      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.stage",
          step: promptOnly ? "FINALIZE_PROMPTS" : "BATCH_GENERATE",
          title: promptOnly ? "提示词定稿" : failedOnly ? "重试失败任务" : "批量生成",
          detail: promptOnly
            ? `将生成 ${targetIndices.length} 条可编辑提示词。`
            : `将使用当前默认模型执行 ${targetIndices.length} 个任务。`,
        },
        promptOnly
          ? "提示词定稿已开始。"
          : failedOnly
            ? "失败任务已开始重试。"
            : "批量生成已开始。",
      );

      try {
        let completed = 0;

        updateBatchUi(
          jobs,
          promptOnly
            ? "已重置并开始提示词定稿。"
            : failedOnly
            ? "失败任务已重置并重新加入队列。"
            : "批量队列已重置并加入待生成状态。",
        );

        for (const index of targetIndices) {
          const current = jobs[index];
          if (!current) continue;
          const itemTraceStartedAt = getTraceNow();

          jobs[index] = {
            ...current,
            status: promptOnly ? current.status : "queued",
            promptStatus:
              current.finalPrompt && current.finalPrompt.trim()
                ? "done"
                : "queued",
            imageStatus: "idle",
            finalPrompt:
              (promptOverrides[current.planItemId] || "").trim() ||
              current.finalPrompt,
            error: undefined,
          };
          updateBatchUi(
            jobs,
            promptOnly
              ? `任务已排队（提示词）：${current.title}`
              : `任务已排队：${current.title}`,
          );
          logStep7Trace("batch.item.start", {
            flow: isTargetedRun ? "batch-targeted" : "batch-all",
            promptOnly,
            failedOnly,
            planItemId: current.planItemId,
            title: current.title,
            index: completed + 1,
            total: targetIndices.length,
            totalElapsedMs: getElapsedMs(traceStartedAt),
          });

          try {
            const prepareStartedAt = getTraceNow();
            const liveSession = ecommerceActions.getSession(sessionId);
            const relatedPlanMeta = findPlanItem(
              liveSession.planGroups,
              current.planItemId,
            );
            const relatedPlan = relatedPlanMeta?.item;

            const referenceUrlById = new Map(
              liveSession.productImages.map((img) => [img.id, img.url]),
            );
            const supplementReferenceImages = collectSupplementReferenceImages(
              liveSession.supplementFields,
            );
            const referenceImages = Array.from(
              new Set([
                ...(relatedPlan?.referenceImageIds
                  .map((refId) => referenceUrlById.get(refId))
                  .filter((url): url is string => typeof url === "string") ||
                  []),
                ...supplementReferenceImages,
              ]),
            ).slice(0, MAX_GENERATION_REFERENCE_IMAGES);
            const effectiveReferenceImages =
              referenceImages.length > 0
                ? referenceImages
                : liveSession.productImages
                    .slice(0, MAX_GENERATION_REFERENCE_IMAGES)
                    .map((img) => img.url);
            const supplementSummary = summarizeSupplementFields(
              liveSession.supplementFields,
            );
            const relevantAnalyses = getRelevantImageAnalyses(
              liveSession,
              relatedPlan?.referenceImageIds || [],
            );
            const resolvedAspectRatio = getDefaultEcommercePlanRatio({
              platformMode: liveSession.platformMode,
              typeId: relatedPlanMeta?.group.typeId,
              typeTitle: relatedPlanMeta?.group.typeTitle || current.title,
              itemTitle: relatedPlan?.title || current.title,
              itemDescription: relatedPlan?.description || current.title,
              preferredRatio: relatedPlan?.ratio,
            });
            const planItemForPrompt = {
              ...(relatedPlan || {
                id: current.planItemId,
                title: current.title,
                description: current.title,
                promptOutline: current.prompt || current.title,
                ratio: resolvedAspectRatio,
                referenceImageIds: [],
                status: "ready" as const,
                mustShow: [],
              }),
              promptOutline:
                current.prompt || relatedPlan?.promptOutline || current.title,
              ratio: resolvedAspectRatio,
            };
            const basePrompt = buildGenerationBasePrompt({
              session: liveSession,
              groupTitle: relatedPlanMeta?.group.typeTitle || current.title,
              item: planItemForPrompt,
              relevantAnalyses,
              supplementSummary,
            });
            const consistencyContext = buildGenerationConsistencyContext({
              item: planItemForPrompt,
              relevantAnalyses,
            });
            logStep7Trace("batch.item.prepare.done", {
              flow: isTargetedRun ? "batch-targeted" : "batch-all",
              promptOnly,
              planItemId: current.planItemId,
              title: current.title,
              elapsedMs: getElapsedMs(prepareStartedAt),
              itemElapsedMs: getElapsedMs(itemTraceStartedAt),
              totalElapsedMs: getElapsedMs(traceStartedAt),
              referenceImageCount: effectiveReferenceImages.length,
              supplementReferenceCount: supplementReferenceImages.length,
              analysisCount: relevantAnalyses.length,
              basePromptChars: basePrompt.length,
            });

            const overridePrompt = (promptOverrides[current.planItemId] || "").trim();
            const existingPrompt = String(current.finalPrompt || "").trim();
            const shouldReusePrompt = !promptOnly && (overridePrompt || existingPrompt);
            const finalPrompt = enforceDirectTextMainlinePrompt(
              overridePrompt ||
                existingPrompt ||
                (await (async () => {
                const rewriteStartedAt = getTraceNow();
                jobs[index] = {
                  ...jobs[index],
                  status: "generating",
                  promptStatus: "generating",
                  imageStatus: "idle",
                  error: undefined,
                };
                updateBatchUi(jobs, `正在整理提示词：${current.title}`);
                logStep7Trace("batch.item.prompt.rewrite.start", {
                  flow: isTargetedRun ? "batch-targeted" : "batch-all",
                  promptOnly,
                  planItemId: current.planItemId,
                  title: current.title,
                  basePromptChars: basePrompt.length,
                  itemElapsedMs: getElapsedMs(itemTraceStartedAt),
                  totalElapsedMs: getElapsedMs(traceStartedAt),
                });

                const rewriteResult = (await executeSkill("ecomRewritePrompt", {
                  productDescription: liveSession.description,
                  typeTitle: relatedPlanMeta?.group.typeTitle || current.title,
                  planTitle: current.title,
                  planDescription: relatedPlan?.description,
                  currentPrompt: basePrompt,
                  supplementSummary,
                  targetRatio: resolvedAspectRatio,
                  feedback: buildFinalizePromptFeedback(
                    liveSession,
                    relatedPlanMeta?.group.typeTitle || current.title,
                    planItemForPrompt,
                  ),
                  imageAnalyses: relevantAnalyses.map((item) => ({
                    title: item.title,
                    description: item.description,
                    analysisConclusion: item.analysisConclusion,
                    angle: item.angle,
                  })),
                })) as { prompt?: string } | string;
                const rewrittenPrompt =
                  extractRewrittenPrompt(rewriteResult) || basePrompt;
                logStep7Trace("batch.item.prompt.rewrite.done", {
                  flow: isTargetedRun ? "batch-targeted" : "batch-all",
                  promptOnly,
                  planItemId: current.planItemId,
                  title: current.title,
                  elapsedMs: getElapsedMs(rewriteStartedAt),
                  itemElapsedMs: getElapsedMs(itemTraceStartedAt),
                  totalElapsedMs: getElapsedMs(traceStartedAt),
                  finalPromptChars: rewrittenPrompt.length,
                  usedBasePromptFallback: rewrittenPrompt === basePrompt,
                });

                  return rewrittenPrompt;
                })()),
              planItemForPrompt,
            );
            if (shouldReusePrompt) {
              logStep7Trace("batch.item.prompt.reuse", {
                flow: isTargetedRun ? "batch-targeted" : "batch-all",
                promptOnly,
                planItemId: current.planItemId,
                title: current.title,
                reusedPromptChars: finalPrompt.length,
                source: overridePrompt ? "override" : "existing",
                itemElapsedMs: getElapsedMs(itemTraceStartedAt),
                totalElapsedMs: getElapsedMs(traceStartedAt),
              });
            }

            jobs[index] = {
              ...jobs[index],
              status: promptOnly ? current.status : "generating",
              promptStatus: "done",
              imageStatus: promptOnly
                ? (current.imageStatus || "idle")
                : "generating",
              finalPrompt,
              error: undefined,
            };
            updateBatchUi(
              jobs,
              promptOnly
                ? `提示词已完成：${current.title}`
                : shouldReusePrompt
                  ? `复用已确认提示词，正在生成图片：${current.title}`
                  : `提示词已完成，正在生成图片：${current.title}`,
            );

            if (promptOnly) {
              completed += 1;
              ecommerceActions.setProgress(
                {
                  done: completed,
                  total: targetIndices.length,
                  text: `已完成提示词 ${completed}/${targetIndices.length}。`,
                },
                sessionId,
              );
              updateBatchUi(
                jobs,
                `提示词定稿进度：${completed}/${targetIndices.length}`,
              );
              logStep7Trace("batch.item.finish", {
                flow: isTargetedRun ? "batch-targeted" : "batch-all",
                promptOnly,
                planItemId: current.planItemId,
                title: current.title,
                itemElapsedMs: getElapsedMs(itemTraceStartedAt),
                totalElapsedMs: getElapsedMs(traceStartedAt),
              });
              continue;
            }

            const generationStartedAt = getTraceNow();
            logStep7Trace("batch.item.image.generate.start", {
              flow: isTargetedRun ? "batch-targeted" : "batch-all",
              planItemId: current.planItemId,
              title: current.title,
              aspectRatio: resolvedAspectRatio,
              referenceImageCount: effectiveReferenceImages.length,
              itemElapsedMs: getElapsedMs(itemTraceStartedAt),
              totalElapsedMs: getElapsedMs(traceStartedAt),
            });
            const generationResult = await generateImageWithModelFallback({
              session: liveSession,
              prompt: finalPrompt,
              aspectRatio: resolvedAspectRatio,
              referenceImages: effectiveReferenceImages,
              consistencyContext,
              onFallback: ({ failedModelLabel, nextModelLabel }) => {
                updateBatchUi(
                  jobs,
                  `模型 ${failedModelLabel} 当前不可用，已自动切换到 ${nextModelLabel} 重试：${current.title}`,
                );
              },
            });
            logStep7Trace("batch.item.image.generate.done", {
              flow: isTargetedRun ? "batch-targeted" : "batch-all",
              planItemId: current.planItemId,
              title: current.title,
              elapsedMs: getElapsedMs(generationStartedAt),
              itemElapsedMs: getElapsedMs(itemTraceStartedAt),
              totalElapsedMs: getElapsedMs(traceStartedAt),
              usedModel: generationResult.usedModel,
              usedModelLabel: generationResult.usedModelLabel,
              fallbackCount: generationResult.attemptedModels.length,
            });
            const generated = generationResult.imageUrl;
            const resultLabel = buildVersionedResultLabel(
              current.title,
              jobs[index].results || [],
            );
            const currentPlan = findPlanItem(
              liveSession.planGroups || [],
              current.planItemId,
            );

            const persistStartedAt = getTraceNow();
            const persistedResultAssetRef = await persistGeneratedResultAsset(
              sessionId,
              generated,
              resultLabel,
            ).catch((error) => {
              logStep7Trace("batch.item.result.persist.failed", {
                flow: isTargetedRun ? "batch-targeted" : "batch-all",
                planItemId: current.planItemId,
                title: current.title,
                elapsedMs: getElapsedMs(persistStartedAt),
                itemElapsedMs: getElapsedMs(itemTraceStartedAt),
                totalElapsedMs: getElapsedMs(traceStartedAt),
                message: getErrorMessage(error, "persist result asset failed"),
              });
              return null;
            });
            if (persistedResultAssetRef?.assetId) {
              logStep7Trace("batch.item.result.persist.done", {
                flow: isTargetedRun ? "batch-targeted" : "batch-all",
                planItemId: current.planItemId,
                title: current.title,
                elapsedMs: getElapsedMs(persistStartedAt),
                itemElapsedMs: getElapsedMs(itemTraceStartedAt),
                totalElapsedMs: getElapsedMs(traceStartedAt),
                assetId: persistedResultAssetRef.assetId,
              });
            }

            const baseGeneratedResult: EcommerceResultItem = {
              assetId: persistedResultAssetRef?.assetId,
              url: generated,
              label: resultLabel,
              generationMeta: {
                usedModelLabel: generationResult.usedModelLabel,
                usedModel: generationResult.usedModel,
                attemptedModels: generationResult.attemptedModels,
                referenceImageCount: effectiveReferenceImages.length,
                consistencyGuarded: true,
                aspectRatio: resolvedAspectRatio,
                promptHash: buildPromptHash(finalPrompt),
                promptSummary: summarizePromptSnapshot(finalPrompt),
                promptText: finalPrompt,
              },
              layoutMeta: cloneLayoutSnapshot(jobs[index].layoutSnapshot),
            };
            const seededResult = currentPlan
              ? seedResultItemFromPlan({
                  result: baseGeneratedResult,
                  group: currentPlan.group,
                  item: currentPlan.item,
                })
              : baseGeneratedResult;

            jobs[index] = {
              ...jobs[index],
              status: "done",
              promptStatus: "done",
              imageStatus: "done",
              generationMeta: {
                usedModelLabel: generationResult.usedModelLabel,
                usedModel: generationResult.usedModel,
                attemptedModels: generationResult.attemptedModels,
                referenceImageCount: effectiveReferenceImages.length,
                consistencyGuarded: true,
                aspectRatio: resolvedAspectRatio,
                promptHash: buildPromptHash(finalPrompt),
                promptSummary: summarizePromptSnapshot(finalPrompt),
                promptText: finalPrompt,
              },
              results: [
                ...(preserveExistingResults ? jobs[index].results || [] : []),
                seededResult,
              ],
              error:
                generationResult.attemptedModels.length > 0
                  ? `已自动切换到 ${generationResult.usedModelLabel} 完成生成。`
                  : undefined,
            };
          } catch (error) {
            logStep7Trace("batch.item.failed", {
              flow: isTargetedRun ? "batch-targeted" : "batch-all",
              promptOnly,
              planItemId: current.planItemId,
              title: current.title,
              itemElapsedMs: getElapsedMs(itemTraceStartedAt),
              totalElapsedMs: getElapsedMs(traceStartedAt),
              message: getErrorMessage(
                error,
                promptOnly ? "提示词生成失败。" : "批量生成失败。",
              ),
            });
            const promptFinished = jobs[index]?.promptStatus === "done";
            jobs[index] = {
              ...jobs[index],
              status: "failed",
              promptStatus: promptFinished ? "done" : "failed",
              imageStatus: promptFinished ? "failed" : "idle",
              error: classifyGenerationFailure(error),
            };
          }

          completed += 1;
          ecommerceActions.setProgress(
            {
              done: completed,
              total: targetIndices.length,
              text: `已完成 ${completed}/${targetIndices.length} 个任务。`,
            },
            sessionId,
          );
          updateBatchUi(jobs, `批量进度：${completed}/${targetIndices.length}`);
          logStep7Trace("batch.item.finish", {
            flow: isTargetedRun ? "batch-targeted" : "batch-all",
            promptOnly,
            planItemId: current.planItemId,
            title: current.title,
            completed,
            total: targetIndices.length,
            itemElapsedMs: getElapsedMs(itemTraceStartedAt),
            totalElapsedMs: getElapsedMs(traceStartedAt),
          });
        }

        const stateCommitStartedAt = getTraceNow();
        const batchJobSnapshot = cloneBatchJobs(jobs);
        const resultImages = cloneResultItems(
          collectBatchResults(batchJobSnapshot),
        );
        ecommerceActions.setBatchJobs(batchJobSnapshot, sessionId);
        ecommerceActions.setResults(resultImages, sessionId);
        logStep7Trace("batch.state.commit.done", {
          flow: isTargetedRun ? "batch-targeted" : "batch-all",
          promptOnly,
          resultCount: resultImages.length,
          targetCount: targetIndices.length,
          elapsedMs: getElapsedMs(stateCommitStartedAt),
          totalElapsedMs: getElapsedMs(traceStartedAt),
        });
        queueStep7RenderTrace("batch.render.commit", {
          flow: isTargetedRun ? "batch-targeted" : "batch-all",
          promptOnly,
          resultCount: resultImages.length,
          targetCount: targetIndices.length,
          totalElapsedMs: getElapsedMs(traceStartedAt),
        });
        if (promptOnly) {
          pushWorkflowUiMessage(
            {
              type: "ecomOneClick.batch",
              jobs: batchJobSnapshot,
              done: batchJobSnapshot.filter((item) => item.status === "done")
                .length,
              total: batchJobSnapshot.length,
            },
            "可编辑提示词已生成，请确认后开始生图。",
          );
        } else if (isTargetedRun) {
          pushWorkflowUiMessage(
            {
              type: "ecomOneClick.batch",
              jobs: batchJobSnapshot,
              done: batchJobSnapshot.filter((item) => item.status === "done")
                .length,
              total: batchJobSnapshot.length,
            },
            `单条生成已完成，当前共有 ${resultImages.length} 张结果。`,
          );
          pushWorkflowUiMessage(
            {
              type: "ecomOneClick.results",
              images: resultImages,
            },
            `已更新单条生成结果，当前共有 ${resultImages.length} 张图像可继续筛选。`,
          );
        } else {
          ecommerceActions.setStep("DONE", sessionId);
          pushWorkflowUiMessage(
            {
              type: "ecomOneClick.results",
              images: resultImages,
            },
            `批量生成完成，当前共有 ${resultImages.length} 张结果可用。`,
          );
        }
      } catch (error) {
        logStep7Trace("batch.failed", {
          flow: isTargetedRun ? "batch-targeted" : "batch-all",
          promptOnly,
          failedOnly,
          targetPlanItemIds,
          totalElapsedMs: getElapsedMs(traceStartedAt),
          message: getErrorMessage(
            error,
            promptOnly ? "提示词生成失败。" : "批量生成失败。",
          ),
        });
        const message = getErrorMessage(
          error,
          promptOnly ? "提示词生成失败。" : "批量生成失败。",
        );
        setEcommerceWorkflowError(message);
        addMessage({
          id: createWorkflowMessageId(
            promptOnly ? "ecom-prompt-prepare-error" : "ecom-batch-error",
          ),
          role: "model",
          text: promptOnly ? `提示词生成失败：${message}` : `批量生成失败：${message}`,
          timestamp: Date.now(),
          error: true,
        });
      } finally {
        logStep7Trace("batch.finish", {
          flow: isTargetedRun ? "batch-targeted" : "batch-all",
          promptOnly,
          failedOnly,
          targetPlanItemIds,
          totalElapsedMs: getElapsedMs(traceStartedAt),
        });
        releaseActionLock(lockKey);
        setIsTyping(false);
      }
    },
    [
      acquireActionLock,
      addMessage,
      ecommerceActions,
      ensureEcommerceSession,
      pushWorkflowUiMessage,
      releaseActionLock,
      setEcommerceWorkflowError,
      setIsTyping,
    ],
  );

  const handleEcommercePrepareBatchPrompts = useCallback(async () => {
    await handleEcommerceRunBatchGenerate(false, { promptOnly: true });
  }, [handleEcommerceRunBatchGenerate]);

  const handleEcommerceOpenBatchWorkbench = useCallback(async () => {
    const sessionId = ensureEcommerceSession();
    const session = ecommerceActions.getSession(sessionId);

    if ((session.batchJobs || []).length === 0 && session.planGroups.length > 0) {
      await handleEcommercePrepareBatchPrompts();
      return;
    }

    ecommerceActions.setStep("BATCH_GENERATE", sessionId);
    ecommerceActions.setProgress(getProgressForStep("BATCH_GENERATE"), sessionId);
  }, [
    ecommerceActions,
    ensureEcommerceSession,
    handleEcommercePrepareBatchPrompts,
  ]);

  const handleEcommerceUploadCompetitorDeck = useCallback(
    async (files: File[], targetDeckId?: string) => {
      const normalizedFiles = Array.isArray(files)
        ? files.filter((file) => file instanceof File).slice(0, 20)
        : [];
      if (normalizedFiles.length === 0) {
        return;
      }

      const sessionId = ensureEcommerceSession();
      const session = ecommerceActions.getSession(sessionId);
      const nextDeckIndex = session.competitorDecks.length + 1;
      const targetDeck = targetDeckId
        ? session.competitorDecks.find((deck) => deck.id === targetDeckId) || null
        : null;
      const images: NonNullable<EcommerceCompetitorDeckInput["images"]> = [];

      for (const [index, file] of normalizedFiles.entries()) {
        const assetRef = await saveTopicAssetFromFile(sessionId, "reference", file);
        if (!assetRef?.assetId) {
          continue;
        }
        images.push({
          id: createWorkflowMessageId(`ecom-competitor-image-${index + 1}`),
          url: buildTopicAssetUrl(assetRef.assetId),
          name: file.name,
          pageIndex: index + 1,
        });
      }

      if (images.length === 0) {
        throw new Error("竞品截图上传失败，请重试。");
      }

      const nextDecks = targetDeck
        ? session.competitorDecks.map((deck) =>
            deck.id === targetDeck.id
              ? {
                  ...deck,
                  images: [...(deck.images || []), ...images].map((image, imageIndex) => ({
                    ...image,
                    pageIndex: imageIndex + 1,
                  })),
                }
              : deck,
          )
        : [
            ...session.competitorDecks,
            {
              id: createWorkflowMessageId("ecom-competitor-deck"),
              name: `竞品 ${nextDeckIndex}`,
              source: "upload" as const,
              images,
            },
          ];

      ecommerceActions.setCompetitorDecks(nextDecks, sessionId);
      ecommerceActions.setCompetitorAnalyses([], sessionId);
      ecommerceActions.setCompetitorPlanningContext(null, sessionId);
      ecommerceActions.setPlanReview(null, sessionId);
      ecommerceActions.setPlanGroups([], sessionId);
      ecommerceActions.setBatchJobs([], sessionId);
      ecommerceActions.setResults([], sessionId);

      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.competitorDecks",
          decks: nextDecks,
        },
        targetDeck
          ? `已向 ${targetDeck.name || "当前竞品套"} 补充 ${images.length} 张截图。`
          : `已新增 1 套竞品详情页，当前共 ${nextDecks.length} 套。`,
      );
    },
    [ecommerceActions, ensureEcommerceSession, pushWorkflowUiMessage],
  );

  const persistImportedCompetitorDeck = useCallback(
    async (params: {
      sessionId: string;
      session: EcommerceOneClickSessionState;
      extracted: ExtractedCompetitorDeck;
      options?: {
        title?: string | null;
        imageUrls?: string[] | null;
      };
      successMessage: string;
      emptyMessage: string;
    }) => {
      const { sessionId, session, extracted, options, successMessage, emptyMessage } =
        params;
      const nextDeckIndex = session.competitorDecks.length + 1;
      const selectedUrls = Array.isArray(options?.imageUrls)
        ? options.imageUrls
            .map((item) => String(item || "").trim())
            .filter((item) => /^https?:\/\//i.test(item))
        : [];
      const extractedImages = Array.isArray(extracted.images) ? extracted.images : [];
      const candidates = (
        selectedUrls.length > 0
          ? extractedImages.filter((item) => selectedUrls.includes(item.url))
          : extractedImages
      ).slice(0, COMPETITOR_DECK_IMPORT_MAX_IMAGES);

      if (candidates.length === 0) {
        throw new Error(
          selectedUrls.length > 0
            ? "\u8bf7\u81f3\u5c11\u9009\u62e9 1 \u5f20\u9700\u8981\u4fdd\u7559\u7684\u56fe\u7247\u3002"
            : emptyMessage,
        );
      }

      const settled = await Promise.allSettled(
        candidates.map(async (candidate, index) => {
          const file = await fetchCompetitorImportImageFile(candidate.url, index);
          const assetRef = await saveTopicAssetFromFile(sessionId, "reference", file);
          if (!assetRef?.assetId) {
            throw new Error("competitor_import_asset_save_failed");
          }

          return {
            id: createWorkflowMessageId(`ecom-competitor-import-${index + 1}`),
            url: buildTopicAssetUrl(assetRef.assetId),
            name:
              String(candidate.name || "").trim() ||
              file.name ||
              `import-${index + 1}`,
            pageIndex: index + 1,
          };
        }),
      );

      const importedImages = settled
        .filter((item): item is PromiseFulfilledResult<{
          id: string;
          url: string;
          name: string;
          pageIndex: number;
        }> => item.status === "fulfilled")
        .map((item) => item.value);

      if (importedImages.length === 0) {
        throw new Error(
          "\u5df2\u627e\u5230\u5019\u9009\u56fe\uff0c\u4f46\u62c9\u53d6\u548c\u4fdd\u5b58\u672c\u5730\u8d44\u4ea7\u65f6\u5168\u90e8\u5931\u8d25\u3002",
        );
      }

      const deckName =
        String(options?.title || "").trim().slice(0, 80) ||
        String(extracted.title || "").trim().slice(0, 80) ||
        `\u7ade\u54c1 ${nextDeckIndex}`;
      const nextDecks = [
        ...session.competitorDecks,
        {
          id: createWorkflowMessageId("ecom-competitor-deck"),
          name: deckName,
          source: "manual" as const,
          referenceUrl: String(extracted.url || "").trim() || undefined,
          notes:
            importedImages.length < candidates.length
              ? "\u90e8\u5206\u5019\u9009\u56fe\u62c9\u53d6\u5931\u8d25\uff0c\u672c deck \u5df2\u4fdd\u5b58\u6210\u529f\u56fe\u7247\u3002"
              : undefined,
          images: importedImages,
        },
      ];

      ecommerceActions.setCompetitorDecks(nextDecks, sessionId);
      ecommerceActions.setCompetitorAnalyses([], sessionId);
      ecommerceActions.setCompetitorPlanningContext(null, sessionId);
      ecommerceActions.setPlanReview(null, sessionId);
      ecommerceActions.setPlanGroups([], sessionId);
      ecommerceActions.setBatchJobs([], sessionId);
      ecommerceActions.setResults([], sessionId);

      if (importedImages.length < candidates.length) {
        setEcommerceWorkflowError(
          `\u5df2\u5bfc\u5165 ${importedImages.length} \u5f20\u56fe\uff0c\u53e6\u6709 ${
            candidates.length - importedImages.length
          } \u5f20\u62c9\u53d6\u5931\u8d25\u3002`,
        );
      }

      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.competitorDecks",
          decks: nextDecks,
        },
        successMessage.replace(
          "{count}",
          String(importedImages.length),
        ),
      );
    },
    [ecommerceActions, pushWorkflowUiMessage, setEcommerceWorkflowError],
  );

  const handleEcommerceImportCompetitorDeckFromUrl = useCallback(
    async (
      referenceUrl: string,
      options?: {
        title?: string | null;
        imageUrls?: string[] | null;
      },
    ) => {
      const actionKey = "ecomImportCompetitorDeckFromUrl";
      if (!acquireActionLock(actionKey)) {
        return;
      }

      const normalizedReferenceUrl = String(referenceUrl || "").trim();
      if (!/^https?:\/\//i.test(normalizedReferenceUrl)) {
        releaseActionLock(actionKey);
        throw new Error(
          "\u8bf7\u5148\u8f93\u5165\u6709\u6548\u7684\u5546\u54c1\u94fe\u63a5\u3002",
        );
      }

      const sessionId = ensureEcommerceSession();
      const session = ecommerceActions.getSession(sessionId);

      setEcommerceWorkflowError(null);
      setIsTyping(true);

      try {
        const extracted = await extractCompetitorDeckFromUrl(
          normalizedReferenceUrl,
          {
            clientId: getPersonalCompetitorBrowserClientId(),
          },
        );
        await persistImportedCompetitorDeck({
          sessionId,
          session,
          extracted: {
            ...extracted,
            url: extracted.url || normalizedReferenceUrl,
          },
          options,
          successMessage:
            "\u5df2\u4ece\u5546\u54c1\u94fe\u63a5\u5bfc\u5165 1 \u5957\u7ade\u54c1\u8be6\u60c5\u9875\uff0c\u5171\u4fdd\u5b58 {count} \u5f20\u56fe\u3002",
          emptyMessage:
            "\u8be5\u5546\u54c1\u9875\u6682\u672a\u89e3\u6790\u51fa\u53ef\u7528\u7684\u4e3b\u56fe\u6216\u8be6\u60c5\u56fe\u3002",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setEcommerceWorkflowError(
          message ||
            "\u5546\u54c1\u94fe\u63a5\u89e3\u6790\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002",
        );
        throw error;
      } finally {
        setIsTyping(false);
        releaseActionLock(actionKey);
      }
    },
    [
      acquireActionLock,
      ecommerceActions,
      ensureEcommerceSession,
      pushWorkflowUiMessage,
      releaseActionLock,
      setEcommerceWorkflowError,
      setIsTyping,
      persistImportedCompetitorDeck,
    ],
  );

  const handleEcommerceImportExtractedCompetitorDeck = useCallback(
    async (
      extracted: ExtractedCompetitorDeck,
      options?: {
        title?: string | null;
        imageUrls?: string[] | null;
      },
    ) => {
      const actionKey = "ecomImportExtractedCompetitorDeck";
      if (!acquireActionLock(actionKey)) {
        return;
      }

      const normalizedExtracted = {
        ...extracted,
        url: String(extracted?.url || "").trim(),
        title: String(extracted?.title || "").trim(),
        images: Array.isArray(extracted?.images) ? extracted.images : [],
      } satisfies ExtractedCompetitorDeck;

      if (normalizedExtracted.images.length === 0) {
        releaseActionLock(actionKey);
        throw new Error(
          "\u672a\u627e\u5230\u53ef\u5bfc\u5165\u7684\u5f53\u524d\u9875\u56fe\u7247\u3002",
        );
      }

      const sessionId = ensureEcommerceSession();
      const session = ecommerceActions.getSession(sessionId);

      setEcommerceWorkflowError(null);
      setIsTyping(true);

      try {
        await persistImportedCompetitorDeck({
          sessionId,
          session,
          extracted: normalizedExtracted,
          options,
          successMessage:
            "\u5df2\u4ece\u5f53\u524d\u9875\u5bfc\u5165 1 \u5957\u7ade\u54c1\u8be6\u60c5\u9875\uff0c\u5171\u4fdd\u5b58 {count} \u5f20\u56fe\u3002",
          emptyMessage:
            "\u8be5\u5f53\u524d\u9875\u6682\u672a\u63d0\u4ea4\u51fa\u53ef\u7528\u7684\u4e3b\u56fe\u6216\u8be6\u60c5\u56fe\u3002",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setEcommerceWorkflowError(
          message ||
            "\u5f53\u524d\u9875\u7ade\u54c1\u5bfc\u5165\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002",
        );
        throw error;
      } finally {
        setIsTyping(false);
        releaseActionLock(actionKey);
      }
    },
    [
      acquireActionLock,
      ecommerceActions,
      ensureEcommerceSession,
      persistImportedCompetitorDeck,
      releaseActionLock,
      setEcommerceWorkflowError,
      setIsTyping,
    ],
  );

  const handleEcommerceSetCompetitorDecks = useCallback(
    (decks: EcommerceCompetitorDeckInput[]) => {
      const sessionId = ensureEcommerceSession();
      const normalizedDecks = Array.isArray(decks) ? decks : [];
      ecommerceActions.setCompetitorDecks(normalizedDecks, sessionId);
      ecommerceActions.setCompetitorAnalyses([], sessionId);
      ecommerceActions.setCompetitorPlanningContext(null, sessionId);
      ecommerceActions.setPlanReview(null, sessionId);
      ecommerceActions.setPlanGroups([], sessionId);
      ecommerceActions.setBatchJobs([], sessionId);
      ecommerceActions.setResults([], sessionId);

      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.competitorDecks",
          decks: normalizedDecks,
        },
        normalizedDecks.length > 0
          ? `已记录 ${normalizedDecks.length} 套竞品详情页，可继续分析并注入后续规划。`
          : "已清空竞品详情页输入。",
      );
    },
    [ecommerceActions, ensureEcommerceSession, pushWorkflowUiMessage],
  );

  const handleEcommerceApplyCompetitorAnalyses = useCallback(
    (analyses: EcommerceCompetitorDeckAnalysis[]) => {
      const sessionId = ensureEcommerceSession();
      const normalizedAnalyses = Array.isArray(analyses) ? analyses : [];
      ecommerceActions.setCompetitorAnalyses(normalizedAnalyses, sessionId);
      ecommerceActions.setPlanReview(null, sessionId);
      ecommerceActions.setPlanGroups([], sessionId);
      ecommerceActions.setBatchJobs([], sessionId);
      ecommerceActions.setResults([], sessionId);
      const nextSession = ecommerceActions.getSession(sessionId);

      pushWorkflowUiMessage(
        {
          type: "ecomOneClick.competitorAnalysis",
          analyses: normalizedAnalyses,
          planningContext: nextSession.competitorPlanningContext || undefined,
        },
        normalizedAnalyses.length > 0
          ? "竞品原理分析已写入，会影响后续整套详情页规划。"
          : "已清空竞品分析结果。",
      );

      void persistEcommerceWorkflowDebugSnapshot({
        sessionId,
        stage: "manual-competitor-analysis",
        session: nextSession,
        note:
          normalizedAnalyses.length > 0
            ? `手动触发竞品分析后，当前已有 ${normalizedAnalyses.length} 套竞品分析结果。`
            : "手动清空了竞品分析结果。",
      });
    },
    [
      ecommerceActions,
      ensureEcommerceSession,
      pushWorkflowUiMessage,
    ],
  );

  const buildDeckImageAnalysisSeeds = useCallback(
    (
      deck: EcommerceCompetitorDeckInput,
    ): EcommerceCompetitorImageAnalysisItem[] =>
      (deck.images || []).map((image, index) => {
        const existing =
          (deck.imageAnalyses || []).find((item) => item.imageId === image.id) || null;
        return {
          id: `${deck.id}:${image.id || `image-${index + 1}`}`,
          deckId: deck.id,
          imageId: String(image.id || `image-${index + 1}`),
          imageIndex: index + 1,
          imageUrl: String(image.url || ""),
          status: existing?.status || "idle",
          requestedModel: existing?.requestedModel || null,
          providerId: existing?.providerId || null,
          baseUrl: existing?.baseUrl || null,
          responseId: existing?.responseId || null,
          responseModel: existing?.responseModel || null,
          finishReason: existing?.finishReason || null,
          responseText: existing?.responseText || "",
          responsePreview: existing?.responsePreview || "",
          errorMessage: existing?.errorMessage || null,
          startedAt: existing?.startedAt || null,
          completedAt: existing?.completedAt || null,
          latestDebugPath: existing?.latestDebugPath || null,
          dailyDebugPath: existing?.dailyDebugPath || null,
        };
      }),
    [],
  );

  const handleEcommerceAnalyzeCompetitorDecks = useCallback(async () => {
    const actionKey = "ecomAnalyzeCompetitorDecks";
    if (!acquireActionLock(actionKey)) {
      return;
    }

    const sessionId = ensureEcommerceSession();
    const session = ecommerceActions.getSession(sessionId);
    const decks = (session.competitorDecks || []).filter(
      (deck) => Array.isArray(deck.images) && deck.images.length > 0,
    );

    if (decks.length === 0) {
      releaseActionLock(actionKey);
      throw new Error("请先上传至少一套竞品详情页。");
    }

    setEcommerceWorkflowError(null);
    setIsTyping(true);

    try {
      let workingDecks: EcommerceCompetitorDeckInput[] = (session.competitorDecks || []).map((deck) =>
        decks.some((candidate) => candidate.id === deck.id)
          ? {
              ...deck,
              imageAnalyses: buildDeckImageAnalysisSeeds(deck).map((item) => ({
                ...item,
                status: "idle" as const,
                errorMessage: null,
              })),
            }
          : deck,
      );

      ecommerceActions.setCompetitorDecks(workingDecks, sessionId);
      ecommerceActions.setCompetitorAnalyses([], sessionId);
      ecommerceActions.setCompetitorPlanningContext(null, sessionId);
      ecommerceActions.setPlanReview(null, sessionId);
      ecommerceActions.setPlanGroups([], sessionId);
      ecommerceActions.setBatchJobs([], sessionId);
      ecommerceActions.setResults([], sessionId);

      const patchImageAnalysis = (
        deckId: string,
        imageId: string,
        updater: (
          current: EcommerceCompetitorImageAnalysisItem,
        ) => EcommerceCompetitorImageAnalysisItem,
      ) => {
        workingDecks = workingDecks.map((deck) => {
          if (deck.id !== deckId) {
            return deck;
          }
          return {
            ...deck,
            imageAnalyses: (deck.imageAnalyses || []).map((item) =>
              item.imageId === imageId ? updater(item) : item,
            ),
          };
        });
        ecommerceActions.setCompetitorDecks(workingDecks, sessionId);
      };

      const failures: Array<{ deckName: string; imageIndex: number; reason: string }> = [];
      let successCount = 0;

      for (const deck of decks) {
        for (const [index, image] of (deck.images || []).entries()) {
          const startedAt = new Date().toISOString();
          patchImageAnalysis(deck.id, String(image.id || `image-${index + 1}`), (current) => ({
            ...current,
            status: "running" as const,
            errorMessage: null,
            startedAt,
            completedAt: null,
          }));

          try {
            const result = await analyzeCompetitorDeckImageRaw({
              deck,
              imageIndex: index,
            });
            if (result.status === "success") {
              successCount += 1;
            } else {
              failures.push({
                deckName: String(deck.name || "").trim() || deck.id,
                imageIndex: index + 1,
                reason: result.errorMessage || "逐图竞品分析返回了空内容。",
              });
            }
            patchImageAnalysis(deck.id, result.imageId, () => result);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error || "逐图竞品分析失败。");
            failures.push({
              deckName: String(deck.name || "").trim() || deck.id,
              imageIndex: index + 1,
              reason: message,
            });
            patchImageAnalysis(
              deck.id,
              String(image.id || `image-${index + 1}`),
              (current) => ({
                ...current,
                status: "failed" as const,
                errorMessage: message,
                completedAt: new Date().toISOString(),
              }),
            );
          }
        }
      }

      const competitorPlanningContext =
        buildCompetitorPlanningContextFromRawImageAnalyses(workingDecks);
      ecommerceActions.setCompetitorPlanningContext(
        competitorPlanningContext,
        sessionId,
      );

      const nextSession = ecommerceActions.getSession(sessionId);
      void persistEcommerceWorkflowDebugSnapshot({
        sessionId,
        stage: "manual-competitor-image-analysis",
        session: nextSession,
        note: `逐图竞品分析已执行，成功 ${successCount} 张，失败 ${failures.length} 张，${
          competitorPlanningContext
            ? "并已生成步骤二可用的轻量竞品摘要。"
            : "但尚未形成可注入步骤二的竞品摘要。"
        }`,
      });

      if (successCount === 0) {
        throw new Error(
          failures[0]?.reason || "竞品逐图分析失败，请稍后重试。",
        );
      }

      if (failures.length > 0) {
        const failedSummary = failures
          .slice(0, 3)
          .map((item) => `${item.deckName} 第 ${item.imageIndex} 张：${item.reason}`)
          .join("；");
        setEcommerceWorkflowError(`部分逐图分析未完成：${failedSummary}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setEcommerceWorkflowError(message || "竞品逐图分析失败。");
      throw error;
    } finally {
      setIsTyping(false);
      releaseActionLock(actionKey);
    }
  }, [
    acquireActionLock,
    buildDeckImageAnalysisSeeds,
    ecommerceActions,
    ensureEcommerceSession,
    releaseActionLock,
    setEcommerceWorkflowError,
    setIsTyping,
  ]);

  const handleEcommerceRunCompetitorVisionSmokeTest = useCallback(
    async (args?: {
      deckId?: string;
      imageIndex?: number;
      model?: string | null;
    }) => {
      const actionKey = "ecomCompetitorVisionSmokeTest";
      if (!acquireActionLock(actionKey)) {
        return null;
      }

      setEcommerceWorkflowError(null);
      setIsTyping(true);

      try {
        const result = await handleRunCompetitorVisionSmokeTest(args);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setEcommerceWorkflowError(message || "竞品单图冒烟测试失败。");
        throw error;
      } finally {
        setIsTyping(false);
        releaseActionLock(actionKey);
      }
    },
    [
      acquireActionLock,
      handleRunCompetitorVisionSmokeTest,
      releaseActionLock,
      setEcommerceWorkflowError,
      setIsTyping,
    ],
  );

  const handleEcommerceBacktrackToStep = useCallback(
    (step: EcommerceOneClickSessionState["step"]) => {
      const sessionId = ensureEcommerceSession();

      switch (step) {
        case "WAIT_PRODUCT":
          ecommerceActions.reset(sessionId);
          ecommerceActions.setStep("WAIT_PRODUCT", sessionId);
          ecommerceActions.setProgress(
            getProgressForStep("WAIT_PRODUCT"),
            sessionId,
          );
          break;
        case "ANALYZE_PRODUCT":
          ecommerceActions.setSupplementFields([], sessionId);
          ecommerceActions.setImageAnalysisReview(null, sessionId);
          ecommerceActions.setImageAnalyses([], sessionId);
          ecommerceActions.setPlanReview(null, sessionId);
          ecommerceActions.setPlanGroups([], sessionId);
          ecommerceActions.setBatchJobs([], sessionId);
          ecommerceActions.setResults([], sessionId);
          ecommerceActions.setSelectedModelId(null, sessionId);
          ecommerceActions.setStep(step, sessionId);
          ecommerceActions.setProgress(getProgressForStep(step), sessionId);
          break;
        case "SUPPLEMENT_INFO":
          ecommerceActions.setImageAnalysisReview(null, sessionId);
          ecommerceActions.setImageAnalyses([], sessionId);
          ecommerceActions.setPlanReview(null, sessionId);
          ecommerceActions.setPlanGroups([], sessionId);
          ecommerceActions.setBatchJobs([], sessionId);
          ecommerceActions.setResults([], sessionId);
          ecommerceActions.setSelectedModelId(null, sessionId);
          ecommerceActions.setStep(step, sessionId);
          ecommerceActions.setProgress(getProgressForStep(step), sessionId);
          break;
        case "ANALYZE_IMAGES":
          ecommerceActions.setPlanReview(null, sessionId);
          ecommerceActions.setPlanGroups([], sessionId);
          ecommerceActions.setBatchJobs([], sessionId);
          ecommerceActions.setResults([], sessionId);
          ecommerceActions.setSelectedModelId(null, sessionId);
          ecommerceActions.setStep(step, sessionId);
          ecommerceActions.setProgress(getProgressForStep(step), sessionId);
          break;
        case "PLAN_SCHEMES":
          ecommerceActions.setBatchJobs([], sessionId);
          ecommerceActions.setResults([], sessionId);
          ecommerceActions.setSelectedModelId(null, sessionId);
          ecommerceActions.setStep(step, sessionId);
          ecommerceActions.setProgress(getProgressForStep(step), sessionId);
          break;
        case "FINALIZE_PROMPTS":
          ecommerceActions.setResults([], sessionId);
          ecommerceActions.setStep(step, sessionId);
          ecommerceActions.setProgress(getProgressForStep(step), sessionId);
          break;
        default:
          ecommerceActions.setStep(step, sessionId);
          ecommerceActions.setProgress(getProgressForStep(step), sessionId);
          break;
      }
    },
    [ecommerceActions, ensureEcommerceSession],
  );

  return {
    ecommerceState,
    pushWorkflowUiMessage,
    startEcommerceWorkflow,
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
    handleEcommerceApplyCompetitorAnalyses,
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
    handleEcommerceAutofillPlans,
    handleEcommerceAutofillSupplements,
    handleEcommerceBacktrackToStep,
    handleEcommerceConfirmSupplements,
    handleEcommerceRetrySupplementQuestions,
    handleEcommerceUseSupplementFallback,
    handleEcommerceRetryPlanGroups,
    handleEcommerceUsePlanFallback,
    handleEcommerceSyncBatchPlanItemRatio,
    handleEcommerceSyncBatchPrompt,
    handleEcommerceSelectModel,
    handleEcommerceOpenBatchWorkbench,
    handleEcommercePrepareBatchPrompts,
    handleEcommerceRunBatchGenerate,
  };
}

