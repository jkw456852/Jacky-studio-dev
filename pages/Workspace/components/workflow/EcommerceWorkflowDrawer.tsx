import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ImagePlus,
  Loader2,
  Package2,
  X,
} from "lucide-react";
import { useEcommerceOneClickState } from "../../../../stores/ecommerceOneClick.store";
import { getMappedModelDisplaySummary } from "../../../../services/provider-settings";
import type { ExtractedCompetitorDeck } from "../../../../services/ecommerce-competitor-import";
import type {
  EcommerceCompetitorDeckInput,
  EcommerceImageAnalysis,
  EcommerceResultItem,
  EcommerceOverlayState,
  EcommercePlatformMode,
  EcommercePlanGroup,
  EcommerceRecommendedType,
  EcommerceSupplementField,
  EcommerceWorkflowMode,
  EcommerceWorkflowStep,
  WorkflowUiMessage,
} from "../../../../types/workflow.types";
import { EcommerceOneClickCards } from "./EcommerceOneClickCards";
import { EcommerceCompetitorStrategyPanel } from "./EcommerceCompetitorStrategyPanel";
import {
  ECOMMERCE_PUBLIC_STAGE_META,
  ECOMMERCE_PUBLIC_STAGE_ORDER,
  ECOMMERCE_STEP_HINTS,
  getEcommercePublicStageId,
  getEcommercePublicStageIndex,
  getEcommerceDrawerEntryStep,
  getEcommerceWorkflowSummary,
  resolveRepresentativeStepForPublicStage,
} from "./ecommerceWorkflowUi";

type EcommerceWorkflowDrawerProps = {
  open: boolean;
  showAssistant: boolean;
  workflowBusy?: boolean;
  onClose: () => void;
  onStartWorkflow?: (args: {
    brief: string;
    files: File[];
    platformMode: EcommercePlatformMode;
    workflowMode: EcommerceWorkflowMode;
  }) => Promise<void>;
  onUploadCompetitorDeck?: (
    files: File[],
    targetDeckId?: string,
  ) => Promise<void>;
  onImportCompetitorDeckFromUrl?: (
    url: string,
    options?: { title?: string | null; imageUrls?: string[] | null },
  ) => void | Promise<void>;
  onImportExtractedCompetitorDeck?: (
    deck: ExtractedCompetitorDeck,
    options?: { title?: string | null; imageUrls?: string[] | null },
  ) => void | Promise<void>;
  onSetCompetitorDecks?: (
    decks: EcommerceCompetitorDeckInput[],
  ) => void | Promise<void>;
  onAnalyzeCompetitorDecks?: () => void | Promise<void>;
  onRunCompetitorVisionSmokeTest?: (args?: {
    deckId?: string;
    imageIndex?: number;
    model?: string | null;
  }) => void | Promise<unknown>;
  onSetWorkflowStep?: (step: (typeof WORKFLOW_ORDER)[number]) => void;
  onRefineAnalysis?: (feedback: string) => void | Promise<void>;
  onConfirmTypes?: (items: EcommerceRecommendedType[]) => void | Promise<void>;
  onRetrySupplementQuestions?: () => void | Promise<void>;
  onUseSupplementFallback?: () => void | Promise<void>;
  onRetryPlanGroups?: () => void | Promise<void>;
  onUsePlanFallback?: () => void | Promise<void>;
  onAutofillImageAnalyses?: (
    items: EcommerceImageAnalysis[],
  ) => Promise<EcommerceImageAnalysis[] | null>;
  onConfirmImageAnalyses?: (
    items: EcommerceImageAnalysis[],
  ) => void | Promise<void>;
  onRetryImageAnalysis?: (imageId: string) => void | Promise<void>;
  onRewritePlanPrompt?: (
    groups: EcommercePlanGroup[],
    planItemId: string,
    feedback?: string,
  ) => Promise<string | null>;
  onGeneratePlanItem?: (
    groups: EcommercePlanGroup[],
    planItemId: string,
  ) => Promise<void>;
  onGenerateExtraPlanItem?: (
    groups: EcommercePlanGroup[],
    typeId: string,
  ) => Promise<void>;
  onOpenResultOverlayEditor?: (url: string) => void | Promise<void>;
  onCloseResultOverlayEditor?: () => void | Promise<void>;
  onSaveResultOverlayDraft?: (
    url: string,
    overlayState: EcommerceOverlayState | null,
  ) => void | Promise<void>;
  onApplyResultOverlay?: (
    url: string,
    overlayState: EcommerceOverlayState | null,
  ) => void | Promise<void>;
  onExportResultOverlayVariants?: (
    url: string,
    overlayState: EcommerceOverlayState | null,
  ) => void | Promise<void>;
  onExportSelectedOverlayVariants?: (urls: string[]) => void | Promise<void>;
  onUploadResultOverlayFont?: (
    url: string,
    file: File,
  ) => void | Promise<void>;
  onUploadResultOverlayIcon?: (
    url: string,
    file: File,
  ) => void | Promise<void>;
  onResetResultOverlay?: (url: string) => void | Promise<void>;
  onPromoteResult?: (url: string) => void;
  onPromoteSelectedResults?: (urls: string[]) => void;
  onDeleteResult?: (url: string) => void;
  onAutofillSupplements?: (
    fields: EcommerceSupplementField[],
  ) => Promise<EcommerceSupplementField[] | null>;
  onAutofillPlans?: (
    groups: EcommercePlanGroup[],
  ) => Promise<EcommercePlanGroup[] | null>;
  onConfirmSupplements?: (
    fields: EcommerceSupplementField[],
  ) => void | Promise<void>;
  onConfirmPlans?: (groups: EcommercePlanGroup[]) => void | Promise<void>;
  onSelectModel?: (
    modelId: string,
    promptLanguage?: "zh" | "en" | "auto",
  ) => void | Promise<void>;
  onSyncBatchPlanItemRatio?: (
    planItemId: string,
    ratio: string,
  ) => void | Promise<void>;
  onSyncBatchPrompt?: (
    planItemId: string,
    prompt: string,
  ) => void | Promise<void>;
  onRunBatchGenerate?: (
    promptOverrides?: Record<string, string>,
    options?: {
      promptOnly?: boolean;
      targetPlanItemIds?: string[];
      preserveExistingResults?: boolean;
    },
  ) => void | Promise<void>;
  onOpenBatchWorkbench?: () => void | Promise<void>;
  onPrepareBatchPrompts?: () => void | Promise<void>;
  onRetryFailedBatch?: () => void | Promise<void>;
  onInsertToCanvas?: (result: EcommerceResultItem | string, label?: string) => void;
  onPreviewResult?: (url: string) => void;
};

const WORKFLOW_ORDER = [
  "WAIT_PRODUCT",
  "ANALYZE_PRODUCT",
  "SUPPLEMENT_INFO",
  "ANALYZE_IMAGES",
  "PLAN_SCHEMES",
  "FINALIZE_PROMPTS",
  "BATCH_GENERATE",
  "DONE",
] as const;

const MODEL_THINKING_LABELS: Record<string, string> = {
  low: "基础",
  medium: "标准",
  high: "深入",
};

const MODEL_LANGUAGE_LABELS: Record<string, string> = {
  zh: "中文",
  en: "英文",
  auto: "自动",
};

const PROCESSING_STAGE_COPY: Record<
  string,
  {
    badge: string;
    title: string;
    detail: string;
    checkpoints: string[];
    expectedWaitText: string;
    comfortTips: string[];
  }
> = {
  ANALYZE_PRODUCT: {
    badge: "AI 商品分析中",
    title: "正在解析商品定位、卖点和建议图型",
    detail:
      "系统会结合商品图、商品说明、平台目标和工作模式，输出更贴合当前商品的分析结论与推荐出图方向。",
    checkpoints: [
      "识别商品品类、材质、包装形态和视觉风格",
      "判断平台更需要哪些主图、场景图、卖点图和详情图",
      "生成带理由的推荐图型卡片，供你确认",
    ],
    expectedWaitText: "通常 15 到 45 秒，接口繁忙时会更久。",
    comfortTips: [
      "分析期间不需要重复点击，系统会自动继续执行。",
      "你可以先切去画布做别的事情，结果会自动回写到当前工作流。",
      "推荐图型出来后就能继续下一步，不需要重新上传商品图。",
    ],
  },
  SUPPLEMENT_INFO: {
    badge: "AI 补题整理中",
    title: "正在生成更有针对性的补充问题",
    detail:
      "系统会根据已选图型和商品分析结果，挑出真正影响方案质量的缺失信息，而不是给一组固定模板问题。",
    checkpoints: [
      "筛出对平台转化最关键的信息缺口",
      "把补充问题拆成易回答的字段和选择项",
      "准备进入下一步图片分析与方案规划",
    ],
    expectedWaitText: "通常 10 到 30 秒。",
    comfortTips: [
      "这一步不是固定模板问卷，而是在按当前商品动态补题。",
      "字段出来后你可以手动改，也可以继续让 AI 帮忙补全。",
      "如果暂时没看到结果，多半是在排队，不需要重新开始工作流。",
    ],
  },
  ANALYZE_IMAGES: {
    badge: "AI 图片复核中",
    title: "正在逐张判断图片可用性和参考价值",
    detail:
      "系统会分析每张商品图的角度、清晰度、信息完整度和参考稳定性，帮你挑出更适合后续生成的参考图。",
    checkpoints: [
      "识别每张图的角度、主体完整度和材质信息",
      "标记哪些图适合作为后续参考图",
      "输出图片级复核意见，减少后续跑偏",
    ],
    expectedWaitText: "通常每张图 10 到 25 秒，图片越多越久。",
    comfortTips: [
      "这一步会逐张判断图片，不是卡住了，只是仍在处理中。",
      "图片复核完成后，后续提示词和主体一致性会更稳定。",
      "少量但高质量的商品图，通常比堆很多角度图更快更稳。",
    ],
  },
  PLAN_SCHEMES: {
    badge: "AI 方案规划中",
    title: "正在把图型需求拆成可执行方案",
    detail:
      "系统会把确认后的图型、补充信息和参考图整合成分组方案与单项分镜，方便后续逐项生成和批量执行。",
    checkpoints: [
      "按图型生成分组方案与单项标题",
      "补齐每项的构图、卖点和镜头规划",
      "输出可编辑的方案规划结果（提示词在批量阶段生成）",
    ],
    expectedWaitText: "通常 20 到 60 秒，图型越多越久。",
    comfortTips: [
      "这一步会同时整理分组策略和单项草稿，所以体感会更慢一些。",
      "方案出来后你可以逐项改写、单条生成或直接批量生成。",
      "如果等得久，通常是在生成更完整的方案，不是页面失去响应。",
    ],
  },
  FINALIZE_PROMPTS: {
    badge: "AI 提示词定稿中",
    title: "正在整理最终可执行提示词",
    detail:
      "系统会按当前方案逐条整理可编辑提示词，并结合默认模型配置补齐必要执行约束，供你在真正生图前统一确认。",
    checkpoints: [
      "逐条补齐最终提示词草稿",
      "确认默认模型与提示词语言",
      "为进入批量执行准备最终输入",
    ],
    expectedWaitText: "通常单条 5 到 20 秒，方案越多越久。",
    comfortTips: [
      "这一步仍属于执行前准备，不会真正开始生图。",
      "前面的提示词会先出来，你可以边看边改，不需要等全部完成。",
      "确认完提示词和默认模型后，再进入批量生成会更稳定。",
    ],
  },
  BATCH_GENERATE: {
    badge: "AI 批量生成中",
    title: "正在按已定稿任务执行生图",
    detail:
      "系统会按当前默认模型执行批量生图；如果仍有未定稿项，会先补齐必要提示词后继续执行。成功结果会持续写回当前分组，失败项也会标注原因。",
    checkpoints: [
      "校验当前任务是否已具备可执行提示词",
      "按批量队列执行当前方案",
      "持续回写结果与失败归因",
    ],
    expectedWaitText: "通常单张 20 到 90 秒，受模型和渠道状态影响较大。",
    comfortTips: [
      "批量阶段会一项一项推进，前面的结果会先出来，不需要等全部结束。",
      "如果某个模型暂时不可用，系统会自动切换或重试，不需要你反复点。",
      "你可以先关闭抽屉去做别的事，结果会持续保存在当前会话里。",
    ],
  },
};

const formatElapsedTime = (seconds: number) => {
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainSeconds = seconds % 60;
  return remainSeconds === 0
    ? `${minutes} 分钟`
    : `${minutes} 分 ${remainSeconds} 秒`;
};

const getProcessingPatienceLabel = (seconds: number) => {
  if (seconds < 20) return "正在启动本阶段";
  if (seconds < 45) return "正在持续处理中";
  if (seconds < 90) return "耗时偏长，但仍属常见情况";
  return "当前等待较久，系统仍在继续执行";
};

const hasSelectedStepContent = (
  step: (typeof WORKFLOW_ORDER)[number],
  state: ReturnType<typeof useEcommerceOneClickState>,
) => {
  switch (step) {
    case "WAIT_PRODUCT":
      return state.productImages.length > 0;
    case "ANALYZE_PRODUCT":
      return Boolean(state.analysisSummary) || state.recommendedTypes.length > 0;
    case "SUPPLEMENT_INFO":
      return state.supplementFields.length > 0;
    case "ANALYZE_IMAGES":
      return state.imageAnalyses.length > 0;
    case "PLAN_SCHEMES":
      return state.planGroups.length > 0;
    case "FINALIZE_PROMPTS":
      return state.modelOptions.length > 0;
    case "BATCH_GENERATE":
      return state.batchJobs.length > 0 || state.results.length > 0;
    case "DONE":
      return state.results.length > 0;
    default:
      return false;
  }
};

type CompletedStageSummary = {
  step: EcommerceWorkflowStep;
  title: string;
  status: string;
  detail: string;
  chips: string[];
};

const getFieldAnswered = (field: EcommerceSupplementField): boolean => {
  if (field.kind === "image") {
    return Array.isArray(field.value) && field.value.length > 0;
  }
  if (Array.isArray(field.value)) {
    return field.value.some((item) => String(item || "").trim().length > 0);
  }
  return String(field.value || "").trim().length > 0;
};

const buildCompletedStageSummary = (
  step: EcommerceWorkflowStep,
  state: ReturnType<typeof useEcommerceOneClickState>,
): CompletedStageSummary | null => {
  switch (step) {
    case "WAIT_PRODUCT":
      return state.productImages.length > 0
        ? {
            step,
            title: "商品资料",
            status: "已上传",
            detail: `已上传 ${state.productImages.length} 张商品图，并建立本轮平台与工作模式。`,
            chips: [
              `商品图 ${state.productImages.length}`,
              `平台 ${summaryPlatformLabel(state.platformMode)}`,
              `模式 ${state.workflowMode === "quick" ? "快速" : "专业"}`,
            ],
          }
        : null;
    case "ANALYZE_PRODUCT": {
      if (!state.analysisSummary && state.recommendedTypes.length === 0) return null;
      const selectedTypes = state.recommendedTypes.filter((item) => item.selected);
      return {
        step,
        title: "商品分析",
        status: "已完成",
        detail:
          state.analysisSummary ||
          "已完成商品分析，并给出推荐图型组合。",
        chips: [
          `推荐 ${state.recommendedTypes.length} 类`,
          `已选 ${selectedTypes.length} 类`,
          ...selectedTypes.slice(0, 5).map((item) => item.title),
        ],
      };
    }
    case "SUPPLEMENT_INFO": {
      if (state.supplementFields.length === 0) return null;
      const answeredCount = state.supplementFields.filter(getFieldAnswered).length;
      return {
        step,
        title: "补充信息",
        status: "已确认",
        detail: `已确认 ${answeredCount}/${state.supplementFields.length} 项补充信息，用于稳定后续图片分析与方案规划。`,
        chips: [
          `已答 ${answeredCount}/${state.supplementFields.length}`,
          ...state.supplementFields
            .filter(getFieldAnswered)
            .slice(0, 4)
            .map((field) => field.label),
        ],
      };
    }
    case "ANALYZE_IMAGES": {
      if (state.imageAnalyses.length === 0) return null;
      const referenceCount = state.imageAnalyses.filter(
        (item) => item.usableAsReference,
      ).length;
      return {
        step,
        title: "图片分析",
        status: "已完成",
        detail: `已完成 ${state.imageAnalyses.length} 张商品图复核，并确认 ${referenceCount} 张可作为后续参考图。`,
        chips: [
          `分析 ${state.imageAnalyses.length} 张`,
          `参考图 ${referenceCount} 张`,
          ...state.imageAnalyses
            .filter((item) => item.usableAsReference)
            .slice(0, 4)
            .map((item) => item.title),
        ],
      };
    }
    case "PLAN_SCHEMES": {
      if (state.planGroups.length === 0) return null;
      const itemCount = state.planGroups.reduce(
        (sum, group) => sum + group.items.length,
        0,
      );
      return {
        step,
        title: "出图方案",
        status: "已确认",
        detail: `已整理 ${state.planGroups.length} 个方案分组，共 ${itemCount} 个执行项，后续会先进入提示词定稿，再执行批量生成。`,
        chips: [
          `分组 ${state.planGroups.length}`,
          `执行项 ${itemCount}`,
          ...state.planGroups.slice(0, 6).map((group) => group.typeTitle),
        ],
      };
    }
    case "FINALIZE_PROMPTS": {
      const selectedModel = state.modelOptions.find(
        (item) => item.id === state.selectedModelId,
      );
      if (!selectedModel) return null;
      const mappedImageSummary = getMappedModelDisplaySummary("image");
      return {
        step,
        title: "提示词定稿",
        status: "已确认",
        detail: `当前工作流已进入执行前定稿阶段。设置里的图片映射是 ${mappedImageSummary}，本轮会优先沿用当前默认模型配置执行；后续还应支持按组或按任务做局部覆盖。`,
        chips: [
          `默认模型 ${selectedModel.name}`,
          `映射 ${mappedImageSummary}`,
          selectedModel.imageSize ? `imageSize: ${selectedModel.imageSize}` : "",
          typeof selectedModel.webSearch === "boolean"
            ? `web_search: ${selectedModel.webSearch ? "true" : "false"}`
            : "",
          selectedModel.thinkingLevel
            ? `thinkingLevel: ${
                MODEL_THINKING_LABELS[selectedModel.thinkingLevel] ||
                selectedModel.thinkingLevel
              }`
            : "",
          selectedModel.promptLanguage
            ? MODEL_LANGUAGE_LABELS[selectedModel.promptLanguage] ||
              selectedModel.promptLanguage
            : "",
        ].filter(Boolean),
      };
    }
    case "BATCH_GENERATE": {
      if (state.batchJobs.length === 0 && state.results.length === 0) return null;
      const doneCount = state.batchJobs.filter((item) => item.status === "done").length;
      const failedCount = state.batchJobs.filter(
        (item) => item.status === "failed",
      ).length;
      return {
        step,
        title: "图片批处理",
        status: failedCount > 0 ? "部分完成" : "已执行",
        detail:
          failedCount > 0
            ? `批量生成已完成 ${doneCount}/${state.batchJobs.length} 项，仍有 ${failedCount} 个失败任务待处理。`
            : `批量生成已执行 ${doneCount}/${state.batchJobs.length} 项，结果正在持续写回当前分组。`,
        chips: [
          `成功 ${doneCount}`,
          failedCount > 0 ? `失败 ${failedCount}` : "",
          `结果 ${state.results.length}`,
        ].filter(Boolean),
      };
    }
    default:
      return null;
  }
};

const summaryPlatformLabel = (platform: EcommercePlatformMode): string => {
  switch (platform) {
    case "taobao":
      return "淘宝/天猫";
    case "jd":
      return "京东";
    case "pdd":
      return "拼多多";
    case "douyin":
      return "抖音电商";
    case "xiaohongshu":
      return "小红书";
    case "amazon":
      return "亚马逊";
    default:
      return "通用电商";
  }
};

const getCompactSummaryDetail = (detail: string, maxLength = 110): string => {
  if (detail.length <= maxLength) {
    return detail;
  }
  return `${detail.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

const getCompactSummaryChips = (chips: string[], limit = 3): string[] => {
  if (chips.length <= limit) {
    return chips;
  }
  return [...chips.slice(0, limit), `+${chips.length - limit}`];
};

type WorkflowActionBarState = {
  tone: "sky" | "amber" | "fuchsia" | "rose" | "emerald";
  title: string;
  description: string;
  blockerText?: string;
  badges: string[];
  primaryActionLabel: string;
  primaryTargetStep: (typeof WORKFLOW_ORDER)[number];
  secondaryActionLabel?: string;
  secondaryTargetStep?: (typeof WORKFLOW_ORDER)[number];
};

const WORKFLOW_ACTION_BAR_TONE_STYLES: Record<
  WorkflowActionBarState["tone"],
  {
    shell: string;
    badge: string;
    blocker: string;
    primary: string;
    secondary: string;
  }
> = {
  sky: {
    shell: "border-blue-200 bg-blue-50/80",
    badge: "bg-blue-600 text-white",
    blocker: "bg-white/80 text-blue-700",
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "border-blue-200 bg-white text-blue-700 hover:bg-blue-50",
  },
  amber: {
    shell: "border-amber-200 bg-amber-50/80",
    badge: "bg-amber-500 text-white",
    blocker: "bg-white/80 text-amber-700",
    primary: "bg-amber-500 text-white hover:bg-amber-600",
    secondary: "border-amber-200 bg-white text-amber-700 hover:bg-amber-50",
  },
  fuchsia: {
    shell: "border-fuchsia-200 bg-fuchsia-50/80",
    badge: "bg-fuchsia-600 text-white",
    blocker: "bg-white/80 text-fuchsia-700",
    primary: "bg-fuchsia-600 text-white hover:bg-fuchsia-700",
    secondary: "border-fuchsia-200 bg-white text-fuchsia-700 hover:bg-fuchsia-50",
  },
  rose: {
    shell: "border-rose-200 bg-rose-50/80",
    badge: "bg-rose-600 text-white",
    blocker: "bg-white/80 text-rose-700",
    primary: "bg-rose-600 text-white hover:bg-rose-700",
    secondary: "border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
  },
  emerald: {
    shell: "border-emerald-200 bg-emerald-50/80",
    badge: "bg-emerald-600 text-white",
    blocker: "bg-white/80 text-emerald-700",
    primary: "bg-emerald-600 text-white hover:bg-emerald-700",
    secondary: "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50",
  },
};

const EcommerceWorkflowDrawerBody: React.FC<EcommerceWorkflowDrawerProps> = ({
  open,
  showAssistant,
  workflowBusy = false,
  onClose,
  onStartWorkflow,
  onUploadCompetitorDeck,
  onImportCompetitorDeckFromUrl,
  onImportExtractedCompetitorDeck,
  onSetCompetitorDecks,
  onAnalyzeCompetitorDecks,
  onRunCompetitorVisionSmokeTest,
  onSetWorkflowStep,
  onRefineAnalysis,
  onConfirmTypes,
  onRetrySupplementQuestions,
  onUseSupplementFallback,
  onRetryPlanGroups,
  onUsePlanFallback,
  onAutofillImageAnalyses,
  onConfirmImageAnalyses,
  onRetryImageAnalysis,
  onRewritePlanPrompt,
  onGenerateExtraPlanItem,
  onGeneratePlanItem,
  onOpenResultOverlayEditor,
  onCloseResultOverlayEditor,
  onSaveResultOverlayDraft,
  onApplyResultOverlay,
  onExportResultOverlayVariants,
  onExportSelectedOverlayVariants,
  onUploadResultOverlayFont,
  onUploadResultOverlayIcon,
  onResetResultOverlay,
  onPromoteResult,
  onPromoteSelectedResults,
  onDeleteResult,
  onAutofillSupplements,
  onAutofillPlans,
  onConfirmSupplements,
  onConfirmPlans,
  onSelectModel,
  onSyncBatchPlanItemRatio,
  onSyncBatchPrompt,
  onRunBatchGenerate,
  onOpenBatchWorkbench,
  onPrepareBatchPrompts,
  onRetryFailedBatch,
  onInsertToCanvas,
  onPreviewResult,
}) => {
  const state = useEcommerceOneClickState();
  const summary = getEcommerceWorkflowSummary(state);
  const currentIndex = Math.max(0, WORKFLOW_ORDER.indexOf(state.step));
  const currentPublicStage = getEcommercePublicStageId(state.step);
  const currentPublicIndex = Math.max(0, getEcommercePublicStageIndex(state.step));
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedStep, setSelectedStep] = useState<
    (typeof WORKFLOW_ORDER)[number]
  >(state.step);
  const [startBrief, setStartBrief] = useState("");
  const [startFiles, setStartFiles] = useState<File[]>([]);
  const [startPlatformMode, setStartPlatformMode] =
    useState<EcommercePlatformMode>("general");
  const [startWorkflowMode, setStartWorkflowMode] =
    useState<EcommerceWorkflowMode>("professional");
  const [isStartingWorkflow, setIsStartingWorkflow] = useState(false);
  const [processingStartedAt, setProcessingStartedAt] = useState<number | null>(
    null,
  );
  const [processingElapsedSeconds, setProcessingElapsedSeconds] = useState(0);
  const preferredResultUrl = state.results[0]?.url || null;
  const activeRunningStep =
    workflowBusy && WORKFLOW_ORDER.includes(state.step)
      ? state.step
      : null;
  const processingCopy =
    activeRunningStep && PROCESSING_STAGE_COPY[activeRunningStep]
      ? PROCESSING_STAGE_COPY[activeRunningStep]
      : null;
  const selectedStepHasContent = hasSelectedStepContent(selectedStep, state);
  const shouldShowProcessingPanel =
    Boolean(processingCopy) &&
    (!selectedStepHasContent || selectedStep !== state.step);
  const activeComfortTips = processingCopy?.comfortTips || [];
  const rotatingComfortTip =
    activeComfortTips.length > 0
      ? activeComfortTips[
          Math.min(
            activeComfortTips.length - 1,
            Math.floor(processingElapsedSeconds / 18),
          )
        ]
      : "";
  const patienceLabel = getProcessingPatienceLabel(processingElapsedSeconds);
  const processingProgressPercent =
    summary.progressTotal > 0
      ? Math.max(
          8,
          Math.min(
            100,
            Math.round((summary.progressDone / summary.progressTotal) * 100),
          ),
        )
      : 28;

  useEffect(() => {
    if (open) {
      setSelectedStep(getEcommerceDrawerEntryStep(state));
    }
  }, [open, state.step, state.results.length, summary.failedJobs]);

  useEffect(() => {
    if (open && !summary.hasData) {
      setStartBrief(state.description || "");
      setStartFiles([]);
      setStartPlatformMode(state.platformMode || "general");
      setStartWorkflowMode(state.workflowMode || "professional");
    }
  }, [
    open,
    state.description,
    state.platformMode,
    state.workflowMode,
    summary.hasData,
  ]);

  useEffect(() => {
    if (state.productImages.length > 0) {
      setStartFiles([]);
    }
  }, [state.productImages.length]);

  useEffect(() => {
    if (!open || !workflowBusy || !activeRunningStep) {
      setProcessingStartedAt(null);
      setProcessingElapsedSeconds(0);
      return;
    }

    setProcessingStartedAt((prev) => prev ?? Date.now());
  }, [activeRunningStep, open, workflowBusy]);

  useEffect(() => {
    if (!processingStartedAt || !open || !workflowBusy || !activeRunningStep) {
      return;
    }

    const tick = () => {
      setProcessingElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - processingStartedAt) / 1000)),
      );
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [activeRunningStep, open, processingStartedAt, workflowBusy]);

  const selectedIndex = Math.max(0, WORKFLOW_ORDER.indexOf(selectedStep));
  const selectedPublicStage = getEcommercePublicStageId(selectedStep);
  const batchStepIndex = WORKFLOW_ORDER.indexOf("BATCH_GENERATE");
  const doneStepIndex = WORKFLOW_ORDER.indexOf("DONE");
  const maxAvailableIndex = !summary.hasData
    ? 0
    : Math.max(
        currentIndex,
        state.batchJobs.length > 0 ? batchStepIndex : 0,
        state.results.length > 0 ? doneStepIndex : 0,
      );
  const maxAvailablePublicIndex = !summary.hasData
    ? 0
    : Math.max(
        currentPublicIndex,
        state.batchJobs.length > 0 ? ECOMMERCE_PUBLIC_STAGE_ORDER.indexOf("GENERATE") : 0,
        state.results.length > 0 ? ECOMMERCE_PUBLIC_STAGE_ORDER.indexOf("GENERATE") : 0,
      );
  const selectedStepHint =
    ECOMMERCE_STEP_HINTS[selectedStep] || ECOMMERCE_STEP_HINTS.WAIT_PRODUCT;
  const hasCompetitorReferenceData =
    state.competitorDecks.length > 0 || state.competitorAnalyses.length > 0;
  const shouldShowCompetitorReferencePanel = selectedStep === "WAIT_PRODUCT";
  const shouldShowCompetitorReferenceSummary =
    selectedStep !== "WAIT_PRODUCT" && hasCompetitorReferenceData;
  const completedSummaryByStep = useMemo(
    () =>
      new Map(
        WORKFLOW_ORDER.slice(0, Math.max(currentIndex, 0))
          .map((step) => {
            const summaryItem = buildCompletedStageSummary(step, state);
            return summaryItem ? ([step, summaryItem] as const) : null;
          })
          .filter(
            (
              item,
            ): item is readonly [EcommerceWorkflowStep, CompletedStageSummary] =>
              Boolean(item),
          ),
      ),
    [currentIndex, state],
  );
  const completedSummaryByPublicStage = useMemo(
    () =>
      new Map(
        ECOMMERCE_PUBLIC_STAGE_ORDER.map((stage) => {
          const steps = ECOMMERCE_PUBLIC_STAGE_META[stage].internalSteps;
          const summaries = steps
            .map((step) => completedSummaryByStep.get(step))
            .filter((item): item is CompletedStageSummary => Boolean(item));
          if (summaries.length === 0) {
            return [stage, null] as const;
          }
          const latest = summaries[summaries.length - 1];
          const chips = Array.from(
            new Set(summaries.flatMap((item) => item.chips).filter(Boolean)),
          ).slice(0, 3);
          return [
            stage,
            {
              detail: latest.detail,
              chips,
            },
          ] as const;
        }),
      ),
    [completedSummaryByStep],
  );
  const workflowActionBarState = useMemo<WorkflowActionBarState | null>(() => {
    const planItemCount = state.planGroups.reduce(
      (sum, group) => sum + group.items.length,
      0,
    );
    const priorityPlanGroupCount = state.planGroups.filter(
      (group) => group.priority === "high",
    ).length;
    const problemPlanGroupCount = state.planGroups.filter((group) => {
      const groupResultCount = group.items.reduce(
        (sum, item) =>
          sum +
          state.batchJobs
            .filter((job) => job.planItemId === item.id)
            .reduce((jobSum, job) => jobSum + (job.results?.length || 0), 0),
        0,
      );
      return (
        group.items.length < 4 ||
        !group.strategy?.length ||
        (group.priority === "high" && groupResultCount === 0)
      );
    }).length;
    const batchJobCount = state.batchJobs.length;
    const promptReadyCount = state.batchJobs.filter((job) => job.prompt?.trim()).length;
    const promptReadyRatio = batchJobCount > 0 ? promptReadyCount / batchJobCount : 0;
    const failedBatchCount = state.batchJobs.filter(
      (job) => job.status === "failed",
    ).length;
    const idleBatchCount = state.batchJobs.filter((job) => job.status === "idle").length;
    const doneBatchCount = state.batchJobs.filter((job) => job.status === "done").length;
    const selectedModel = state.modelOptions.find(
      (item) => item.id === state.selectedModelId,
    );

    switch (selectedStep) {
      case "PLAN_SCHEMES":
        return {
          tone: problemPlanGroupCount > 0 ? "amber" : "sky",
          title: "当前主决策：先确认方案结构",
          description:
            state.planGroups.length > 0
              ? `先看高优先级或问题组，确认每组策略与镜头基线是否成立，再决定是否继续补图。当前共 ${state.planGroups.length} 组、${planItemCount} 个镜头项。`
              : "当前还没有可确认的方案分组，需先完成前置分析与方案生成。",
          blockerText:
            state.planGroups.length === 0
              ? "还没有方案组可供确认。"
              : problemPlanGroupCount > 0
                ? `仍有 ${problemPlanGroupCount} 个问题组建议优先检查。`
                : "当前方案结构已具备继续进入提示词定稿的基础。",
          badges: [
            `分组 ${state.planGroups.length}`,
            `镜头 ${planItemCount}`,
            priorityPlanGroupCount > 0 ? `高优先级 ${priorityPlanGroupCount}` : "",
          ].filter(Boolean),
          primaryActionLabel: "查看方案规划",
          primaryTargetStep: "PLAN_SCHEMES",
          secondaryActionLabel: batchJobCount > 0 ? "预览提示词定稿" : undefined,
          secondaryTargetStep: batchJobCount > 0 ? "FINALIZE_PROMPTS" : undefined,
        };
      case "FINALIZE_PROMPTS": {
        const missingPromptCount = Math.max(0, batchJobCount - promptReadyCount);
        if (batchJobCount === 0) {
          return {
            tone: "amber",
            title: "当前主决策：先准备可执行任务",
            description: "方案已进入后半程，但当前还没有批量任务可供定稿。",
            blockerText: "需先确认方案规划并生成批量任务后，才能进入提示词定稿。",
            badges: [`结果 ${state.results.length}`],
            primaryActionLabel: "返回方案规划",
            primaryTargetStep: "PLAN_SCHEMES",
          };
        }
        const shouldPromotePrepare = promptReadyRatio < 0.7;
        return {
          tone: shouldPromotePrepare ? "amber" : "fuchsia",
          title: shouldPromotePrepare
            ? "当前主决策：先补齐剩余提示词"
            : "当前主决策：开始执行已就绪任务",
          description: shouldPromotePrepare
            ? `当前已有 ${promptReadyCount}/${batchJobCount} 条提示词就绪，建议先批量整理剩余项，再进入执行。`
            : `当前已有 ${promptReadyCount}/${batchJobCount} 条提示词就绪，可以先开始执行，再补齐少量剩余项。`,
          blockerText:
            missingPromptCount > 0
              ? `还有 ${missingPromptCount} 条提示词未就绪。`
              : "当前提示词已全部就绪，可以直接进入执行阶段。",
          badges: [
            `定稿 ${promptReadyCount}/${batchJobCount}`,
            selectedModel?.name ? `默认模型 ${selectedModel.name}` : "尚未确认默认模型",
          ].filter(Boolean),
          primaryActionLabel: shouldPromotePrepare ? "查看提示词定稿" : "切到执行队列",
          primaryTargetStep: shouldPromotePrepare ? "FINALIZE_PROMPTS" : "BATCH_GENERATE",
          secondaryActionLabel: shouldPromotePrepare ? "预览执行队列" : "继续补齐剩余提示词",
          secondaryTargetStep: shouldPromotePrepare ? "BATCH_GENERATE" : "FINALIZE_PROMPTS",
        };
      }
      case "BATCH_GENERATE":
        return {
          tone:
            failedBatchCount > 0
              ? "rose"
              : idleBatchCount > 0
                ? "fuchsia"
                : "emerald",
          title:
            failedBatchCount > 0
              ? "当前主决策：先处理失败任务"
              : idleBatchCount > 0
                ? "当前主决策：执行未开始任务"
                : "当前主决策：回看并筛选结果",
          description:
            failedBatchCount > 0
              ? `当前已有 ${failedBatchCount} 个失败任务，建议先在执行队列里定位并重试。`
              : idleBatchCount > 0
                ? `当前还有 ${idleBatchCount} 个任务未开始，可直接进入执行队列继续批量生成。`
                : "当前批量任务已基本跑完，可以先筛选最新结果，再决定是否补抽。",
          blockerText:
            batchJobCount === 0
              ? "当前暂无批量任务，但已有结果可回看。"
              : failedBatchCount > 0
                ? `失败 ${failedBatchCount} / ${batchJobCount}`
                : idleBatchCount > 0
                  ? `待开始 ${idleBatchCount} / ${batchJobCount}`
                  : `已完成 ${doneBatchCount}/${batchJobCount}`,
          badges: [
            `任务 ${batchJobCount}`,
            `结果 ${state.results.length}`,
            failedBatchCount > 0 ? `失败 ${failedBatchCount}` : `完成 ${doneBatchCount}`,
          ].filter(Boolean),
          primaryActionLabel: "查看执行队列",
          primaryTargetStep: "BATCH_GENERATE",
          secondaryActionLabel: state.results.length > 0 ? "查看结果" : "返回提示词定稿",
          secondaryTargetStep: state.results.length > 0 ? "DONE" : "FINALIZE_PROMPTS",
        };
      default:
        return null;
    }
  }, [selectedStep, state.batchJobs, state.modelOptions, state.planGroups, state.results.length, state.selectedModelId]);

  const handlePickFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files || [])
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 9);
    setStartFiles(nextFiles);
  };

  const handleStartWorkflow = async () => {
    if (!onStartWorkflow || startFiles.length === 0 || isStartingWorkflow) {
      return;
    }

    setIsStartingWorkflow(true);
    try {
      await onStartWorkflow({
        brief: startBrief.trim(),
        files: startFiles,
        platformMode: startPlatformMode,
        workflowMode: startWorkflowMode,
      });
    } finally {
      setIsStartingWorkflow(false);
    }
  };

  const cards = useMemo<WorkflowUiMessage[]>(() => {
    const entryCard: WorkflowUiMessage = {
      type: "ecomOneClick.entry",
      productCount: state.productImages.length,
      description:
        state.description ||
        "先上传商品图和一句商品说明，再从这里逐步完成分析、规划和批量生成。",
      platformMode: state.platformMode,
      workflowMode: state.workflowMode,
    };

    switch (selectedStep) {
      case "WAIT_PRODUCT":
        return [
          {
            ...entryCard,
            description:
              "先在右侧输入区上传 1 到 9 张商品图，并补一句商品说明。发送后流程会从商品分析开始逐步推进。",
          },
        ];
      case "ANALYZE_PRODUCT":
        return [
          ...(state.analysisSummary
            ? [
                {
                  type: "ecomOneClick.analysis",
                  summary: state.analysisSummary,
                  review: state.analysisReview || undefined,
                  evolutionProposals:
                    state.analysisEvolutionProposals.length > 0
                      ? state.analysisEvolutionProposals
                      : undefined,
                } as WorkflowUiMessage,
              ]
            : []),
          ...(state.recommendedTypes.length > 0
            ? [
                {
                  type: "ecomOneClick.types",
                  items: state.recommendedTypes,
                } as WorkflowUiMessage,
              ]
            : []),
        ];
      case "SUPPLEMENT_INFO":
        return [
          ...(state.supplementFields.length > 0
            ? [
                {
                  type: "ecomOneClick.supplements",
                  fields: state.supplementFields,
                } as WorkflowUiMessage,
              ]
            : []),
        ];
      case "ANALYZE_IMAGES":
        return [
          ...(state.imageAnalyses.length > 0
            ? [
                {
                  type: "ecomOneClick.imageAnalyses",
                  items: state.imageAnalyses,
                  review: state.imageAnalysisReview || undefined,
                } as WorkflowUiMessage,
              ]
            : []),
        ];
      case "PLAN_SCHEMES":
        return [
          ...(state.planGroups.length > 0
            ? [
                {
                  type: "ecomOneClick.plans",
                  groups: state.planGroups,
                  review: state.planReview || undefined,
                } as WorkflowUiMessage,
              ]
            : []),
        ];
      case "FINALIZE_PROMPTS":
        return [
          {
            type: "ecomOneClick.modelLock",
            models: state.modelOptions,
            selectedModelId: state.selectedModelId || undefined,
          },
          ...(state.batchJobs.length > 0
            ? [
                {
                  type: "ecomOneClick.batch",
                  jobs: state.batchJobs,
                  done: state.batchJobs.filter((job) => job.status === "done")
                    .length,
                  total: state.batchJobs.length,
                  view: "finalize",
                } as WorkflowUiMessage,
              ]
            : []),
        ];
      case "BATCH_GENERATE":
        return [
          ...(state.batchJobs.length > 0
            ? [
                {
                  type: "ecomOneClick.batch",
                  jobs: state.batchJobs,
                  done: state.batchJobs.filter((job) => job.status === "done")
                    .length,
                  total: state.batchJobs.length,
                  view: "execute",
                } as WorkflowUiMessage,
              ]
            : []),
        ];
      case "DONE":
        return [];
      default:
        return [];
    }
  }, [selectedStep, state, summary.hasData]);
  return (
    <div
      className="absolute inset-y-0 left-0 z-[55]"
      style={{ right: showAssistant ? 480 : 0 }}
    >
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/10 backdrop-blur-[1px]"
            aria-label="关闭电商工作流"
          />

          <motion.aside
            initial={{ x: -32, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -32, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="absolute inset-3 overflow-hidden rounded-[30px] border border-gray-200 bg-[#f7f8fb] shadow-[0_30px_80px_rgba(15,23,42,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-full flex-col">
              <div className="border-b border-gray-200 bg-white px-5 py-4">
                <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[340px_minmax(0,1fr)_auto] xl:grid-cols-[380px_minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-base font-semibold text-gray-900">
                      <Package2 size={18} className="text-blue-600" />
                      {"\u7535\u5546\u4e00\u952e\u5de5\u4f5c\u6d41"}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      {summary.statusText}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-gray-500">
                      <span className="rounded-full bg-gray-100 px-3 py-1">
                        {`\u5e73\u53f0\uff1a${summary.platformLabel}`}
                      </span>
                      <span className="rounded-full bg-gray-100 px-3 py-1">
                        {`\u6a21\u5f0f\uff1a${summary.workflowModeLabel}`}
                      </span>
                    </div>
                  </div>
                  <div className="hidden min-w-0 lg:block">
                    <div className="rounded-2xl border border-gray-200 bg-[#f7f8fb] px-4 py-3 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                          <CheckCircle2 size={15} />
                        </span>
                        <div className="text-lg font-semibold tracking-tight text-gray-900">
                          {"\u5f53\u524d\u67e5\u770b\uff1a"}
                          {selectedStepHint.label}
                        </div>
                        {summary.progressTotal > 0 ? (
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600">
                            {`\u8fdb\u5ea6 ${summary.progressDone}/${summary.progressTotal}`}
                          </span>
                        ) : null}
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600">
                          {`\u65b9\u6848 ${summary.planCount}`}
                        </span>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600">
                          {`\u7ed3\u679c ${state.results.length}`}
                        </span>
                        {summary.failedJobs > 0 ? (
                          <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-600">
                            {`\u5931\u8d25 ${summary.failedJobs}`}
                          </span>
                        ) : null}
                        {selectedStep !== state.step &&
                        selectedIndex <= currentIndex ? (
                          <button
                            type="button"
                            onClick={() =>
                              !workflowBusy && onSetWorkflowStep?.(selectedStep)
                            }
                            disabled={workflowBusy}
                            title={
                              workflowBusy
                                ? "\u5f53\u524d\u6d41\u7a0b\u6b63\u5728\u6267\u884c\uff0c\u8bf7\u7a0d\u540e\u518d\u56de\u9000"
                                : "\u56de\u9000\u4f1a\u4fdd\u7559\u5f53\u524d\u6b65\u9aa4\u6240\u9700\u6570\u636e\uff0c\u5e76\u6e05\u7a7a\u540e\u7eed\u6b65\u9aa4\u7ed3\u679c"
                            }
                            className={[
                              "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                              workflowBusy
                                ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                                : "border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300",
                            ].join(" ")}
                          >
                            {"\u5207\u56de\u8fd9\u91cc"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="justify-self-end rounded-full border border-gray-200 bg-white p-2 text-gray-500 transition hover:text-gray-900 active:scale-[0.96]"
                  >
                    <X size={16} />
                  </button>
                </div>

                {workflowActionBarState ? (
                  <div
                    className={[
                      "mt-4 rounded-2xl border px-4 py-4 shadow-sm",
                      WORKFLOW_ACTION_BAR_TONE_STYLES[workflowActionBarState.tone].shell,
                    ].join(" ")}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={[
                              "rounded-full px-2.5 py-1 text-[10px] font-semibold",
                              WORKFLOW_ACTION_BAR_TONE_STYLES[workflowActionBarState.tone].badge,
                            ].join(" ")}
                          >
                            阶段主决策
                          </span>
                          <div className="text-sm font-semibold text-gray-900">
                            {workflowActionBarState.title}
                          </div>
                        </div>
                        <div className="mt-1 text-xs leading-5 text-gray-600">
                          {workflowActionBarState.description}
                        </div>
                        {workflowActionBarState.badges.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-gray-600">
                            {workflowActionBarState.badges.map((badge) => (
                              <span
                                key={badge}
                                className="rounded-full bg-white/85 px-2.5 py-1"
                              >
                                {badge}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {workflowActionBarState.blockerText ? (
                          <div
                            className={[
                              "mt-2 rounded-xl px-3 py-2 text-[11px] font-medium leading-5",
                              WORKFLOW_ACTION_BAR_TONE_STYLES[workflowActionBarState.tone].blocker,
                            ].join(" ")}
                          >
                            阻塞说明：{workflowActionBarState.blockerText}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedStep(workflowActionBarState.primaryTargetStep)
                          }
                          className={[
                            "rounded-full px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                            WORKFLOW_ACTION_BAR_TONE_STYLES[workflowActionBarState.tone].primary,
                          ].join(" ")}
                        >
                          {workflowActionBarState.primaryActionLabel}
                        </button>
                        {workflowActionBarState.secondaryActionLabel &&
                        workflowActionBarState.secondaryTargetStep ? (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedStep(workflowActionBarState.secondaryTargetStep!)
                            }
                            className={[
                              "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                              WORKFLOW_ACTION_BAR_TONE_STYLES[workflowActionBarState.tone].secondary,
                            ].join(" ")}
                          >
                            {workflowActionBarState.secondaryActionLabel}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex min-h-0 flex-1 overflow-hidden">
                <aside className="hidden h-full w-[300px] shrink-0 flex-col border-r border-gray-200 bg-[#fbfcfe] lg:flex xl:w-[340px]">
                  <div className="border-b border-gray-200 px-4 py-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-gray-900">
                        {"\u6d41\u7a0b\u5bfc\u822a"}
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                        {`${currentPublicIndex + 1} / ${ECOMMERCE_PUBLIC_STAGE_ORDER.length} \u9636\u6bb5`}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-gray-500">
                      <span className="rounded-full bg-white px-2.5 py-1">
                        {`\u5546\u54c1\u56fe ${state.productImages.length}`}
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-1">
                        {`\u65b9\u6848 ${summary.planCount}`}
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-1">
                        {`\u7ed3\u679c ${state.results.length}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-2">
                      {ECOMMERCE_PUBLIC_STAGE_ORDER.map((stage, index) => {
                        const meta = ECOMMERCE_PUBLIC_STAGE_META[stage];
                        const isUnlocked = index <= maxAvailablePublicIndex;
                        const isCurrent = index === currentPublicIndex;
                        const isSelected = stage === selectedPublicStage;
                        const completedSummary =
                          completedSummaryByPublicStage.get(stage);
                        const compactChips = completedSummary
                          ? getCompactSummaryChips(completedSummary.chips, 2)
                          : [];
                        return (
                          <button
                            key={`sidebar-step-${stage}`}
                            type="button"
                            disabled={!isUnlocked}
                            onClick={() =>
                              isUnlocked &&
                              setSelectedStep(
                                resolveRepresentativeStepForPublicStage(stage, state),
                              )
                            }
                            className={[
                              "flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition active:scale-[0.99]",
                              isSelected
                                ? "border-blue-200 bg-blue-50"
                                : isCurrent
                                  ? "border-emerald-200 bg-emerald-50"
                                  : "border-gray-200 bg-white",
                              isUnlocked
                                ? "hover:border-gray-300"
                                : "cursor-not-allowed opacity-50",
                            ].join(" ")}
                          >
                            <span
                              className={[
                                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                                isSelected
                                  ? "bg-blue-100 text-blue-700"
                                  : isCurrent
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-gray-100 text-gray-500",
                              ].join(" ")}
                            >
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="block text-sm font-semibold text-gray-900">
                                  {meta.label}
                                </span>
                                {index < currentPublicIndex ? (
                                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                    已完成
                                  </span>
                                ) : isCurrent ? (
                                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                    当前
                                  </span>
                                ) : null}
                              </span>
                              <span className="mt-1 block text-[11px] leading-5 text-gray-500">
                                {completedSummary
                                  ? getCompactSummaryDetail(
                                      completedSummary.detail,
                                      48,
                                    )
                                  : meta.detail}
                              </span>
                              {compactChips.length > 0 ? (
                                <span className="mt-2 flex flex-wrap gap-1.5">
                                  {compactChips.map((chip, chipIndex) => (
                                    <span
                                      key={`${stage}-${chip}-${chipIndex}`}
                                      className="rounded-full bg-white px-2 py-1 text-[10px] text-gray-600"
                                    >
                                      {chip}
                                    </span>
                                  ))}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </aside>

                <div className="flex-1 overflow-y-auto px-6 py-5 lg:px-8 xl:px-10">
                <div className="mb-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
                  {ECOMMERCE_PUBLIC_STAGE_ORDER.map((stage, index) => {
                    const meta = ECOMMERCE_PUBLIC_STAGE_META[stage];
                    const isUnlocked = index <= maxAvailablePublicIndex;
                    const isSelected = stage === selectedPublicStage;
                    return (
                      <button
                        key={`mobile-step-${stage}`}
                        type="button"
                        disabled={!isUnlocked}
                        onClick={() =>
                          isUnlocked &&
                          setSelectedStep(
                            resolveRepresentativeStepForPublicStage(stage, state),
                          )
                        }
                        className={[
                          "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                          isSelected
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : index < currentPublicIndex
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-gray-200 bg-white text-gray-500",
                          isUnlocked
                            ? "hover:border-gray-300"
                            : "cursor-not-allowed opacity-50",
                        ].join(" ")}
                      >
                        {`${index + 1}. ${meta.label}`}
                      </button>
                    );
                  })}
                </div>

                {!summary.hasData && selectedStep === "WAIT_PRODUCT" ? (
                  <div className="mb-5 rounded-3xl border border-dashed border-blue-200 bg-blue-50/60 p-5">
                    <div className="text-sm font-semibold text-gray-900">
                      先建立商品资料
                    </div>
                    <div className="mt-2 text-sm leading-6 text-gray-600">
                      先在这里上传 1 到 9
                      张商品图，并补一句商品说明。点击开始分析后，流程会继续进入商品分析，而不是直接出单张图。
                    </div>
                    <div className="mt-4 rounded-3xl border border-white/80 bg-white p-4 shadow-sm">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handlePickFiles}
                      />

                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-2 rounded-2xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black active:scale-[0.99]"
                        >
                          <ImagePlus size={16} />
                          选择商品图
                        </button>
                        <div className="text-xs text-gray-500">
                          已选择 {startFiles.length}/9 张图片
                        </div>
                      </div>

                      {startFiles.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {startFiles.map((file) => (
                            <span
                              key={`${file.name}-${file.size}`}
                              className="rounded-full bg-gray-100 px-3 py-1.5 text-[11px] text-gray-600"
                            >
                              {file.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 text-[11px] text-gray-500">
                          建议上传多角度商品图，后续分析和方案规划会更准确。
                        </div>
                      )}

                      <div className="mt-4">
                        <label className="mb-2 block text-xs font-semibold text-gray-700">
                          目标平台
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            ["general", "通用电商"],
                            ["taobao", "淘宝/天猫"],
                            ["jd", "京东"],
                            ["pdd", "拼多多"],
                            ["douyin", "抖音电商"],
                            ["xiaohongshu", "小红书"],
                            ["amazon", "亚马逊"],
                          ].map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() =>
                                setStartPlatformMode(
                                  value as EcommercePlatformMode,
                                )
                              }
                              className={[
                                "rounded-full border px-3 py-1.5 text-[11px] font-medium transition active:scale-[0.99]",
                                startPlatformMode === value
                                  ? "border-blue-200 bg-blue-50 text-blue-700"
                                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                              ].join(" ")}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="mb-2 block text-xs font-semibold text-gray-700">
                          工作模式
                        </label>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => setStartWorkflowMode("quick")}
                            className={[
                              "rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99]",
                              startWorkflowMode === "quick"
                                ? "border-emerald-200 bg-emerald-50"
                                : "border-gray-200 bg-white hover:border-gray-300",
                            ].join(" ")}
                          >
                            <div className="text-sm font-semibold text-gray-900">
                              快速模式
                            </div>
                            <div className="mt-1 text-xs leading-5 text-gray-500">
                              更少校验，优先快速走完整条链路，缺信息时允许兜底。
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setStartWorkflowMode("professional")}
                            className={[
                              "rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99]",
                              startWorkflowMode === "professional"
                                ? "border-blue-200 bg-blue-50"
                                : "border-gray-200 bg-white hover:border-gray-300",
                            ].join(" ")}
                          >
                            <div className="text-sm font-semibold text-gray-900">
                              专业模式
                            </div>
                            <div className="mt-1 text-xs leading-5 text-gray-500">
                              更严格校验和复核，优先保证电商策划质量与可执行性。
                            </div>
                          </button>
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="mb-2 block text-xs font-semibold text-gray-700">
                          商品说明
                        </label>
                        <textarea
                          value={startBrief}
                          onChange={(event) =>
                            setStartBrief(event.target.value)
                          }
                          rows={4}
                          placeholder="例如：便携式艾灸仪，主打家用轻养生、暖色极简风，偏淘宝主图与场景图。"
                          className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-blue-300"
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
                          <span className="rounded-full bg-gray-100 px-3 py-1.5">
                            1. 上传商品图
                          </span>
                          <span className="rounded-full bg-gray-100 px-3 py-1.5">
                            2. 可选导入竞品参考
                          </span>
                          <span className="rounded-full bg-gray-100 px-3 py-1.5">
                            3. 选平台和模式
                          </span>
                          <span className="rounded-full bg-gray-100 px-3 py-1.5">
                            4. 填一句商品说明
                          </span>
                          <span className="rounded-full bg-gray-100 px-3 py-1.5">
                            5. 开始分析
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleStartWorkflow()}
                          disabled={
                            startFiles.length === 0 || isStartingWorkflow
                          }
                          className={[
                            "rounded-2xl px-4 py-2 text-sm font-semibold transition active:scale-[0.99]",
                            startFiles.length === 0 || isStartingWorkflow
                              ? "cursor-not-allowed bg-gray-200 text-gray-400"
                              : "bg-blue-600 text-white hover:bg-blue-700",
                          ].join(" ")}
                        >
                          {isStartingWorkflow ? "分析中..." : "开始分析"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {summary.hasData && selectedStep === "WAIT_PRODUCT" ? (
                  <div className="mb-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="text-sm font-semibold text-gray-900">
                      商品资料
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      已上传 {state.productImages.length} 张商品图 · {state.platformMode === "general" ? "通用电商" : state.platformMode} · {state.workflowMode === "professional" ? "专业模式" : "快速模式"}
                    </div>
                    {state.productImages.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {state.productImages.map((img) => (
                          <div
                            key={img.id}
                            className="relative h-16 w-16 overflow-hidden rounded-xl border border-gray-100 bg-gray-50"
                          >
                            <img
                              src={img.url}
                              alt={img.name || "商品图"}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {state.description ? (
                      <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600">
                        {state.description}
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handlePickFiles}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-700 transition hover:border-gray-300 active:scale-[0.99]"
                      >
                        <ImagePlus size={13} />
                        追加商品图
                      </button>
                      {startFiles.length > 0 ? (
                        <>
                          <span className="text-[11px] text-gray-500">
                            待追加 {startFiles.length} 张
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (onStartWorkflow && startFiles.length > 0) {
                                void onStartWorkflow({
                                  brief: state.description,
                                  files: startFiles,
                                  platformMode: state.platformMode,
                                  workflowMode: state.workflowMode,
                                });
                              }
                            }}
                            className="rounded-full bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-blue-700 active:scale-[0.99]"
                          >
                            重新分析
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {shouldShowProcessingPanel && processingCopy ? (
                  <div className="mb-3 overflow-hidden rounded-2xl border border-blue-200 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_58%,#f8fafc_100%)] px-3 py-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-blue-700">
                        <Loader2 size={12} className="animate-spin" />
                        {processingCopy.badge}
                      </span>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] text-blue-700">
                        {patienceLabel}
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] text-gray-600">
                        已等待 {formatElapsedTime(processingElapsedSeconds)}
                      </span>
                      {summary.progressTotal > 0 ? (
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] text-gray-600">
                          进度 {summary.progressDone}/{summary.progressTotal}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-900">
                          {selectedStep !== state.step
                            ? `当前实际执行：${
                                (
                                  ECOMMERCE_STEP_HINTS[state.step] ||
                                  ECOMMERCE_STEP_HINTS.WAIT_PRODUCT
                                ).label
                              }`
                            : processingCopy.title}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-5 text-gray-600">
                          <span>{summary.progressText}</span>
                          <span>{processingCopy.expectedWaitText}</span>
                          {rotatingComfortTip ? (
                            <span className="text-blue-700">{rotatingComfortTip}</span>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-700 transition hover:border-gray-300 hover:text-gray-900 active:scale-[0.99]"
                      >
                        先去做别的
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-blue-100">
                        <div
                          className="h-full rounded-full bg-blue-600 transition-all duration-500"
                          style={{
                            width: `${processingProgressPercent}%`,
                          }}
                        />
                      </div>
                      <span className="text-[11px] font-medium text-blue-700">
                        {processingProgressPercent}%
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-gray-600">
                      {processingCopy.checkpoints.slice(0, 3).map((checkpoint, index) => (
                        <span
                          key={`${checkpoint}-${index}`}
                          className="rounded-full bg-white px-2 py-1"
                        >
                          {index + 1}. {checkpoint}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-4">
                  {shouldShowCompetitorReferencePanel ? (
                    <EcommerceCompetitorStrategyPanel
                      workflowBusy={workflowBusy}
                      onUploadCompetitorDeck={onUploadCompetitorDeck}
                      onImportCompetitorDeckFromUrl={
                        onImportCompetitorDeckFromUrl
                      }
                      onImportExtractedCompetitorDeck={
                        onImportExtractedCompetitorDeck
                      }
                      onSetCompetitorDecks={onSetCompetitorDecks}
                      onAnalyzeCompetitorDecks={onAnalyzeCompetitorDecks}
                      onRunCompetitorVisionSmokeTest={
                        onRunCompetitorVisionSmokeTest
                      }
                    />
                  ) : shouldShowCompetitorReferenceSummary ? (
                    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 px-4 py-3 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                            <Package2 size={15} className="text-amber-600" />
                            <span>竞品参考已接入本轮流程</span>
                          </div>
                          <div className="mt-1 text-xs leading-5 text-gray-600">
                            第一步已收集竞品详情页参考，后续会和你的商品信息一起参与分析、方案规划和生图提示词生成，这里只保留摘要，不再重复展开完整设置区。
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                            <span className="rounded-full bg-white px-2.5 py-1">
                              {`竞品组 ${state.competitorDecks.length}`}
                            </span>
                            <span className="rounded-full bg-white px-2.5 py-1">
                              {`已分析 ${state.competitorAnalyses.length}`}
                            </span>
                            <span className="rounded-full bg-white px-2.5 py-1">
                              生效阶段: 产品分析 / 方案规划 / 生图提示词
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedStep("WAIT_PRODUCT")}
                          className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-700 transition hover:border-amber-300 hover:text-amber-800 active:scale-[0.99]"
                        >
                          回到第一步调整
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {cards.map((card, index) => (
                    <EcommerceOneClickCards
                      key={card.type}
                      message={card}
                      onRefineAnalysis={onRefineAnalysis}
                      onConfirmTypes={onConfirmTypes}
                      onRetrySupplementQuestions={onRetrySupplementQuestions}
                      onUseSupplementFallback={onUseSupplementFallback}
                      onRetryPlanGroups={onRetryPlanGroups}
                      onUsePlanFallback={onUsePlanFallback}
                      onAutofillImageAnalyses={onAutofillImageAnalyses}
                      onConfirmImageAnalyses={onConfirmImageAnalyses}
                      onRetryImageAnalysis={onRetryImageAnalysis}
                      onRewritePlanPrompt={onRewritePlanPrompt}
                      onGenerateExtraPlanItem={onGenerateExtraPlanItem}
                      onGeneratePlanItem={onGeneratePlanItem}
                      onOpenResultOverlayEditor={onOpenResultOverlayEditor}
                      onCloseResultOverlayEditor={onCloseResultOverlayEditor}
                      onSaveResultOverlayDraft={onSaveResultOverlayDraft}
                      onApplyResultOverlay={onApplyResultOverlay}
                      onExportResultOverlayVariants={onExportResultOverlayVariants}
                      onExportSelectedOverlayVariants={onExportSelectedOverlayVariants}
                      onUploadResultOverlayFont={onUploadResultOverlayFont}
                      onUploadResultOverlayIcon={onUploadResultOverlayIcon}
                      onResetResultOverlay={onResetResultOverlay}
                      onPromoteResult={onPromoteResult}
                      onPromoteSelectedResults={onPromoteSelectedResults}
                      onDeleteResult={onDeleteResult}
                      onAutofillSupplements={onAutofillSupplements}
                      onAutofillPlans={onAutofillPlans}
                      onConfirmSupplements={onConfirmSupplements}
                      onConfirmPlans={onConfirmPlans}
                      onSelectModel={onSelectModel}
                      onSyncBatchPlanItemRatio={onSyncBatchPlanItemRatio}
                      onSyncBatchPrompt={onSyncBatchPrompt}
                      onRunBatchGenerate={onRunBatchGenerate}
                      onOpenBatchWorkbench={onOpenBatchWorkbench}
                      onPrepareBatchPrompts={onPrepareBatchPrompts}
                      onRetryFailedBatch={onRetryFailedBatch}
                      onInsertToCanvas={onInsertToCanvas}
                      onPreviewResult={onPreviewResult}
                    />
                  ))}
                </div>

                </div>
              </div>
            </div>
          </motion.aside>
    </div>
  );
};

export const EcommerceWorkflowDrawer = React.memo(
  (props: EcommerceWorkflowDrawerProps) => {
    if (!props.open) {
      return null;
    }

    return (
      <AnimatePresence>
        <EcommerceWorkflowDrawerBody {...props} />
      </AnimatePresence>
    );
  },
);
