import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  FolderTree,
  Images,
  Package2,
  Sparkles,
} from "lucide-react";
import type {
  EcommerceAnalysisReview,
  EcommerceBatchJob,
  EcommerceCompetitorDeckAnalysis,
  EcommerceGenerationMeta,
  EcommerceImageAnalysis,
  EcommerceLayoutSnapshot,
  EcommerceOverlayLayer,
  EcommerceOverlayLayerKind,
  EcommerceOverlayPlatformPresetId,
  EcommerceOverlayState,
  EcommerceOverlayStylePresetId,
  EcommercePlatformMode,
  EcommercePlanGroup,
  EcommercePromptLanguage,
  EcommerceRecommendedType,
  EcommerceResultItem,
  EcommerceStageReview,
  EcommerceSupplementField,
  EcommerceWorkflowMode,
  WorkflowUiMessage,
} from "../../../../types/workflow.types";
import { useEcommerceOneClickState } from "../../../../stores/ecommerceOneClick.store";
import { executeSkill } from "../../../../services/skills";
import { getMappedModelDisplaySummary } from "../../../../services/provider-settings";
import {
  applyOverlayLayerArrangement,
  buildOverlaySectionOrder,
  getOrderedOverlayLayers,
  getOverlayLayerVisibilityMap,
  getOverlayDecorationProfile,
  getOverlayPanelBox,
  getOverlaySemanticMeta,
  getOverlayStylePresetConfig,
  getSmartOverlayPreset,
  normalizeOverlayLayers,
  OVERLAY_LAYER_KIND_LABELS,
  OVERLAY_STYLE_PRESET_OPTIONS,
} from "../../../../utils/ecommerce-overlay-layout";
import type {
  EcommerceOverlayAssistReport,
  EcommerceOverlayAssistSurface,
} from "../../../../utils/ecommerce-overlay-assist";
import {
  buildOverlayAssistReport,
  prepareOverlayAssistSurface,
} from "../../../../utils/ecommerce-overlay-assist";
import type { EcommerceOverlayBrandPreset } from "../../../../utils/ecommerce-overlay-production";
import {
  deleteOverlayBrandPreset,
  downloadOverlayImages,
  exportOverlayImagesZip,
  getOverlayPlatformPresetConfig,
  loadOverlayBrandPresets,
  OVERLAY_PLATFORM_PRESET_OPTIONS,
  upsertOverlayBrandPreset,
} from "../../../../utils/ecommerce-overlay-production";
import { splitEcommerceImageAnalysisTextFieldList } from "../../../../utils/ecommerce-image-analysis";
import {
  ECOMMERCE_PLAN_RATIO_OPTIONS,
  getDefaultEcommercePlanRatio,
} from "../../../../utils/ecommerce-plan-ratio";
import {
  sanitizeDownloadName,
} from "./EcommerceWorkflowResultReview";
import {
  buildEcommercePlanGroupAnchorId,
  ECOMMERCE_PLAN_GROUP_NAVIGATE_EVENT,
  rankCompetitorDeckMatchesForPlanGroup,
  rankCompetitorDeckMatchesForPlanItem,
} from "../../../../utils/ecommerce-competitor-ui";
import {
  ECOMMERCE_PUBLIC_STAGE_META,
  ECOMMERCE_PUBLIC_STAGE_ORDER,
  getEcommercePublicStageId,
} from "./ecommerceWorkflowUi";

const Card = ({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "accent";
}) => (
  <div
    className={[
      "rounded-2xl border p-4 shadow-sm",
      tone === "accent"
        ? "border-blue-100 bg-gradient-to-br from-blue-50 to-white"
        : "border-gray-200 bg-white",
    ].join(" ")}
  >
    {children}
  </div>
);

const STAGE_LABELS: Record<string, string> = {
  WAIT_PRODUCT: "等待商品",
  ANALYZE_PRODUCT: "分析商品",
  SUPPLEMENT_INFO: "补充资料",
  ANALYZE_IMAGES: "图片分析",
  PLAN_SCHEMES: "方案规划",
  FINALIZE_PROMPTS: "提示词定稿",
  BATCH_GENERATE: "批量生成",
  DONE: "已完成",
};
const PRIORITY_LABELS: Record<string, string> = {
  high: "高优先级",
  medium: "中优先级",
  low: "低优先级",
};
const FIELD_KIND_LABELS: Record<string, string> = {
  text: "单行输入",
  textarea: "文本输入",
  "single-select": "单选",
  "multi-select": "多选",
  image: "图片补充",
};
const BATCH_STATUS_LABELS: Record<string, string> = {
  idle: "待开始",
  queued: "排队中",
  generating: "生成中",
  done: "已完成",
  failed: "失败",
};

type PlanViewMode = "all" | "priority" | "problem";

const normalizeCompetitorHintText = (value: string): string =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "");

const COMPETITOR_ROLE_HINT_RULES: Array<{
  label: string;
  keywords: string[];
}> = [
  { label: "首屏承接位", keywords: ["hero", "首屏", "首图", "封面", "开场", "视觉锤"] },
  { label: "白底卖点位", keywords: ["white-bg", "白底", "卖点", "平铺"] },
  { label: "场景带入位", keywords: ["scene", "场景", "氛围", "使用"] },
  { label: "对比说明位", keywords: ["comparison", "对比", "对照", "差异"] },
  { label: "细节证明位", keywords: ["detail", "细节", "特写", "做工", "材质"] },
  { label: "参数规格位", keywords: ["spec", "参数", "规格", "尺寸"] },
  { label: "转化收口位", keywords: ["conversion", "cta", "转化", "下单", "背书", "保障"] },
  { label: "卖点展开位", keywords: ["selling", "卖点", "优势", "亮点"] },
];

const getCompetitorRoleHintFromTexts = (
  sourceTexts: Array<string | null | undefined>,
  recommendedPageSequence: string[],
): { label: string; matchedText: string } | null => {
  if (
    !Array.isArray(recommendedPageSequence) ||
    recommendedPageSequence.length === 0
  ) {
    return null;
  }

  const groupText = normalizeCompetitorHintText(sourceTexts.filter(Boolean).join(" "));

  if (!groupText) {
    return null;
  }

  let bestMatch: { label: string; matchedText: string; score: number } | null = null;

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
        const groupMatched = groupText.includes(normalizedKeyword);
        return candidateMatched && groupMatched ? sum + 1 : sum;
      }, 0);

      if (!score) {
        continue;
      }

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          label: rule.label,
          matchedText: candidate,
          score,
        };
      }
    }
  }

  return bestMatch
    ? { label: bestMatch.label, matchedText: bestMatch.matchedText }
    : null;
};

const getCompetitorRoleHint = (
  group: EcommercePlanGroup,
  recommendedPageSequence: string[],
): { label: string; matchedText: string } | null =>
  getCompetitorRoleHintFromTexts(
    [
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
    recommendedPageSequence,
  );

const getClosestCompetitorDecks = (
  group: EcommercePlanGroup,
  analyses: EcommerceCompetitorDeckAnalysis[],
  recommendedPageSequence: string[],
): Array<{ competitorId: string; label: string }> =>
  rankCompetitorDeckMatchesForPlanGroup({
    group,
    analyses,
    recommendedPageSequence,
    maxResults: 2,
  }).map((match, index) => {
    const analysisIndex = analyses.findIndex(
      (candidate) => candidate.competitorId === match.competitorId,
    );
    const analysis = analysisIndex >= 0 ? analyses[analysisIndex] : null;
    return {
      competitorId: match.competitorId,
      label: analysis?.competitorName || `竞品 ${analysisIndex >= 0 ? analysisIndex + 1 : index + 1}`,
    };
  });

const getClosestCompetitorDecksForItem = (
  group: EcommercePlanGroup,
  item: EcommercePlanGroup["items"][number],
  analyses: EcommerceCompetitorDeckAnalysis[],
  recommendedPageSequence: string[],
): Array<{ competitorId: string; label: string; reason: string }> =>
  rankCompetitorDeckMatchesForPlanItem({
    groupTitle: group.typeTitle,
    groupSummary: group.summary,
    item,
    analyses,
    recommendedPageSequence,
    maxResults: 2,
  }).map((match, index) => {
    const analysisIndex = analyses.findIndex(
      (candidate) => candidate.competitorId === match.competitorId,
    );
    const analysis = analysisIndex >= 0 ? analyses[analysisIndex] : null;
    return {
      competitorId: match.competitorId,
      label:
        analysis?.competitorName || `竞品 ${analysisIndex >= 0 ? analysisIndex + 1 : index + 1}`,
      reason: match.matchedRoleLabel
        ? `${match.matchedRoleLabel}${match.matchedSequenceText ? ` · ${match.matchedSequenceText}` : ""}`
        : "版式语义相近",
    };
  });

const parseBlockedReasonMessage = (value?: string) => {
  const text = String(value || "").replace(/\r/g, "").trim();
  if (!text) {
    return { intro: "", details: [] as string[] };
  }

  const matched = text.match(/^([\s\S]*?[。！？])\s*([\s\S]*)$/);
  const intro = matched ? matched[1].trim() : text;
  const rest = matched ? matched[2].trim() : "";
  const details = rest
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return { intro, details };
};
const BATCH_PHASE_LABELS: Record<string, string> = {
  idle: "未开始",
  queued: "排队中",
  generating: "进行中",
  done: "已完成",
  failed: "失败",
};
const PROMPT_LANGUAGE_LABELS: Record<EcommercePromptLanguage, string> = {
  zh: "中文",
  en: "英文",
  auto: "自动",
};
const THINKING_LEVEL_LABELS: Record<string, string> = {
  low: "基础",
  medium: "标准",
  high: "深入",
};
const PLATFORM_LABELS: Record<EcommercePlatformMode, string> = {
  general: "通用电商",
  taobao: "淘宝/天猫",
  jd: "京东",
  pdd: "拼多多",
  douyin: "抖音电商",
  xiaohongshu: "小红书",
  amazon: "亚马逊",
};
const WORKFLOW_MODE_LABELS: Record<EcommerceWorkflowMode, string> = {
  quick: "快速模式",
  professional: "专业模式",
};
const PLAN_ITEM_BASELINE_COUNT = 4;

const isSupplementFieldAnswered = (field: EcommerceSupplementField) => {
  if (field.kind === "image") {
    return Array.isArray(field.value) && field.value.length > 0;
  }
  if (Array.isArray(field.value)) {
    return field.value.some((item) => {
      const text = String(item || "").trim();
      return text.length > 0 && !isSupplementPlaceholderValue(text);
    });
  }
  const text = String(field.value || "").trim();
  return text.length > 0 && !isSupplementPlaceholderValue(text);
};

const isSupplementPlaceholderValue = (value?: string) => {
  const text = String(value || "").trim();
  if (!text) return false;

  return /请补充|参数请补充|其他参数|其余参数|待补充|后续补充|信息不足|建议后续覆盖|保守估填|保守估计|先做猜测补全|先按.*理解|先按.*规划/.test(
    text,
  );
};

const isBlockingSupplementField = (field: EcommerceSupplementField) =>
  field.required && field.kind !== "image";

const getSupplementFieldLayoutClass = (field: EcommerceSupplementField) => {
  const optionCount = Array.isArray(field.options) ? field.options.length : 0;

  if (field.kind === "textarea" || field.kind === "image") {
    return "xl:col-span-2";
  }

  if (field.kind === "multi-select") {
    return optionCount > 4 ? "xl:col-span-2" : "";
  }

  if (field.kind === "single-select") {
    return optionCount > 6 ? "xl:col-span-2" : "";
  }

  return "";
};

const getSupplementFieldSelectedCount = (field: EcommerceSupplementField) => {
  if (field.kind === "image") {
    return Array.isArray(field.value) ? field.value.length : 0;
  }
  if (Array.isArray(field.value)) {
    return field.value.filter((item) => String(item || "").trim().length > 0)
      .length;
  }
  return typeof field.value === "string" && field.value.trim() ? 1 : 0;
};

const getSupplementFieldGuideText = (field: EcommerceSupplementField) => {
  if (field.kind === "single-select") {
    return "作答方式：单选，点击 1 个最合适的答案即可。";
  }
  if (field.kind === "multi-select") {
    return `作答方式：多选，最多可选 ${
      field.maxItems || field.options?.length || "多"
    } 项。`;
  }
  if (field.kind === "image") {
    return `作答方式：上传补充图片，最多 ${
      field.maxItems || 6
    } 张。建议上传细节图、使用场景图或局部特写。`;
  }
  if (field.kind === "textarea") {
    return "作答方式：补充完整描述，尽量把限制条件、风格偏好和重点卖点写清楚。";
  }
  return "作答方式：输入简洁明确的关键信息，避免过于笼统。";
};

const areStringArraysEqual = (left?: string[], right?: string[]) =>
  JSON.stringify(left || []) === JSON.stringify(right || []);

const didSupplementFieldChange = (
  before: EcommerceSupplementField,
  after: EcommerceSupplementField,
) => JSON.stringify(before.value ?? null) !== JSON.stringify(after.value ?? null);

const didSupplementFieldMetaChange = (
  before: EcommerceSupplementField,
  after: EcommerceSupplementField,
) =>
  before.valueSource !== after.valueSource ||
  before.valueConfidence !== after.valueConfidence ||
  (before.valueNote || "") !== (after.valueNote || "");

const ensureStableSupplementDraftFields = (
  fields: EcommerceSupplementField[],
): EcommerceSupplementField[] => {
  const seenIds = new Map<string, number>();

  return fields.map((field, index) => {
    const rawId = String(field.id || "").trim() || `supplement_field_${index + 1}`;
    const seenCount = (seenIds.get(rawId) || 0) + 1;
    seenIds.set(rawId, seenCount);

    return {
      ...field,
      id: seenCount === 1 ? rawId : `${rawId}__${seenCount}`,
      options: Array.isArray(field.options)
        ? Array.from(
            new Set(
              field.options
                .map((option) => String(option || "").trim())
                .filter(Boolean),
            ),
          )
        : field.options,
    };
  });
};

const getSupplementFieldSourceMeta = (field: EcommerceSupplementField) => {
  if (field.valueSource === "estimated") {
    return {
      text:
        field.valueConfidence === "high"
          ? "AI 估填 · 高把握"
          : field.valueConfidence === "medium"
            ? "AI 估填 · 中把握"
            : "AI 估填 · 低把握",
      className: "bg-sky-100 text-sky-700",
    };
  }

  if (field.valueSource === "ai") {
    return {
      text:
        field.valueConfidence === "high"
          ? "AI 推断 · 高把握"
          : field.valueConfidence === "medium"
            ? "AI 推断 · 中把握"
            : "AI 推断",
      className: "bg-indigo-100 text-indigo-700",
    };
  }

  if (field.valueSource === "user" && isSupplementFieldAnswered(field)) {
    return {
      text: "已手动确认",
      className: "bg-emerald-100 text-emerald-700",
    };
  }

  return null;
};

const didImageAnalysisChange = (
  before: EcommerceImageAnalysis,
  after: EcommerceImageAnalysis,
) =>
  before.title !== after.title ||
  before.description !== after.description ||
  (before.analysisConclusion || "") !== (after.analysisConclusion || "") ||
  (before.angle || "") !== (after.angle || "") ||
  before.usableAsReference !== after.usableAsReference ||
  before.confidence !== after.confidence ||
  !areStringArraysEqual(before.highlights, after.highlights) ||
  !areStringArraysEqual(before.materials, after.materials) ||
  !areStringArraysEqual(before.evidence, after.evidence);

const sanitizeImageAnalysisDrafts = (items: EcommerceImageAnalysis[]) =>
  splitEcommerceImageAnalysisTextFieldList(items);

const didPlanItemChange = (
  before: EcommercePlanGroup["items"][number],
  after: EcommercePlanGroup["items"][number],
) =>
  before.title !== after.title ||
  before.description !== after.description ||
  before.promptOutline !== after.promptOutline ||
  before.ratio !== after.ratio ||
  (before.marketingGoal || "") !== (after.marketingGoal || "") ||
  (before.keyMessage || "") !== (after.keyMessage || "") ||
  (before.composition || "") !== (after.composition || "") ||
  (before.styling || "") !== (after.styling || "") ||
  (before.background || "") !== (after.background || "") ||
  (before.lighting || "") !== (after.lighting || "") ||
  JSON.stringify(before.layoutIntent || {}) !== JSON.stringify(after.layoutIntent || {}) ||
  !areStringArraysEqual(before.mustShow, after.mustShow) ||
  !areStringArraysEqual(before.platformFit, after.platformFit) ||
  !areStringArraysEqual(before.riskNotes, after.riskNotes);

const didPlanGroupMetaChange = (
  before: EcommercePlanGroup,
  after: EcommercePlanGroup,
) =>
  (before.summary || "") !== (after.summary || "") ||
  JSON.stringify(before.strategy || []) !== JSON.stringify(after.strategy || []) ||
  before.priority !== after.priority ||
  !areStringArraysEqual(before.platformTags, after.platformTags);

const getReviewSourceBadge = (
  review: EcommerceAnalysisReview | EcommerceStageReview,
) => {
  if (
    review.source === "ai" &&
    typeof review.fallbackReason === "string" &&
    /自动整理复核摘要|基础复核结果/.test(review.fallbackReason)
  ) {
    return {
      text: "顶部复核为自动整理",
      className: "bg-sky-100 text-sky-700",
    };
  }
  if (review.source === "fallback") {
    return {
      text: "顶部复核为容灾结果",
      className: "bg-amber-100 text-amber-700",
    };
  }
  if (review.usedFallback) {
    return {
      text: "顶部复核已自动补强",
      className: "bg-blue-100 text-blue-700",
    };
  }
  if (review.source === "ai") {
    return {
      text: "顶部复核为 AI 结果",
      className: "bg-emerald-100 text-emerald-700",
    };
  }
  return null;
};

const getImageAnalysisSourceBadge = (item: EcommerceImageAnalysis) => {
  if (item.source === "fallback") {
    return {
      text: "单图为兜底结果",
      className: "bg-amber-100 text-amber-700",
    };
  }
  if (item.usedFallback) {
    return {
      text: "单图为 AI 自动补强",
      className: "bg-blue-100 text-blue-700",
    };
  }
  if (item.source === "ai") {
    return {
      text: "单图为 AI 直出",
      className: "bg-emerald-100 text-emerald-700",
    };
  }
  return null;
};

const getConfidenceLabel = (
  confidence?: EcommerceImageAnalysis["confidence"],
) => {
  if (confidence === "high") return "高";
  if (confidence === "low") return "低";
  return "中";
};

const getImageDecisionMeta = (item: EcommerceImageAnalysis) => {
  const combinedText = [
    item.title,
    item.description,
    item.analysisConclusion || "",
    item.angle || "",
    ...(item.highlights || []),
    ...(item.evidence || []),
  ]
    .join(" ")
    .toLowerCase();
  const evidence = (item.evidence || []).filter(Boolean);
  const highlights = (item.highlights || []).filter(Boolean);
  const materials = (item.materials || []).filter(Boolean);
  const confidence = item.confidence || "medium";
  const hasFullView =
    /正面|正前|主视|主图|全貌|整体|完整|平铺|居中|主体清晰/.test(combinedText);
  const hasSideView = /侧|45|斜侧|斜拍|透视|厚度|轮廓延展/.test(combinedText);
  const hasDetailView =
    /细节|局部|特写|纹理|材质|面料|接口|拉链|纽扣|走线|logo|做工/.test(
      combinedText,
    );
  const hasSceneCue = /场景|使用|佩戴|上身|摆放|应用/.test(combinedText);

  let role: "primary" | "supporting" | "archive" = "archive";
  if (
    item.usableAsReference &&
    confidence === "high" &&
    (hasFullView || !hasDetailView)
  ) {
    role = "primary";
  } else if (item.usableAsReference) {
    role = "supporting";
  }

  const roleMeta =
    role === "primary"
      ? {
          label: "主参考图",
          className: "bg-emerald-100 text-emerald-700",
          summary: "主体信息较完整，适合作为后续生成时的核心约束图。",
        }
      : role === "supporting"
        ? {
            label: "补充参考图",
            className: "bg-sky-100 text-sky-700",
            summary: "可补充结构或细节，但不建议单独承担主体一致性约束。",
          }
        : {
            label: "仅作记录",
            className: "bg-gray-100 text-gray-700",
            summary: "当前更适合作为辅助记录，不建议直接作为核心参考图。",
          };

  const bestUse = hasDetailView
    ? "补充材质、纹理、做工和局部细节"
    : hasSideView
      ? "补充侧面结构、厚度和体积关系"
      : hasSceneCue
        ? "补充使用场景和画面氛围线索"
        : role === "primary"
          ? "控制主体外形、比例和产品一致性"
          : "补充产品结构与卖点信息";

  const reasonParts = [
    hasFullView ? "主体轮廓较完整" : "",
    hasSideView ? "能补充侧向结构信息" : "",
    hasDetailView ? "包含可用的局部细节线索" : "",
    highlights[0] ? `突出点：${highlights[0]}` : "",
    materials[0] ? `材质线索：${materials[0]}` : "",
    evidence[0] ? `判断依据：${evidence[0]}` : "",
  ].filter(Boolean);

  const riskNotes = [
    confidence === "low" ? "当前把握度偏低，建议人工复核后再继续。" : "",
    !item.usableAsReference ? "不建议把这张图直接作为主体一致性的唯一依据。" : "",
    item.usedFallback || item.source === "fallback"
      ? "这张卡片包含自动补强结果，建议重点核对结论是否贴合原图。"
      : "",
  ].filter(Boolean);

  return {
    roleMeta,
    bestUse,
    reasonText:
      reasonParts.slice(0, 3).join("；") ||
      (item.usableAsReference
        ? "主体信息相对完整，可以作为后续生成参考。"
        : "当前图面信息偏局部，更适合作为补充说明。"),
    riskNotes,
  };
};

const getRecommendedTypeSourceBadge = (item: EcommerceRecommendedType) => {
  if (item.source === "fallback") {
    return {
      text: "该项来自兜底推荐池",
      className: "bg-amber-100 text-amber-700",
    };
  }
  if (item.usedFallback) {
    return {
      text: "该项为 AI 自动补强",
      className: "bg-blue-100 text-blue-700",
    };
  }
  if (item.source === "ai") {
    return {
      text: "该项为 AI 直出",
      className: "bg-emerald-100 text-emerald-700",
    };
  }
  return null;
};

const getPlanGroupSourceBadge = (group: EcommercePlanGroup) => {
  if (group.source === "fallback") {
    return {
      text: "该组来自兜底方案池",
      className: "bg-amber-100 text-amber-700",
    };
  }
  if (group.usedFallback) {
    return {
      text: "该组为 AI 自动补强",
      className: "bg-blue-100 text-blue-700",
    };
  }
  if (group.source === "ai") {
    return {
      text: "该组为 AI 直出",
      className: "bg-emerald-100 text-emerald-700",
    };
  }
  return null;
};

const parseResultMeta = (label?: string, fallback = "结果") => {
  const fullLabel = (label || fallback).trim() || fallback;
  const match = fullLabel.match(/^(.*?)(?:\s+v(\d+))$/i);
  return match
    ? {
        fullLabel,
        title: match[1]?.trim() || fullLabel,
        version: `v${match[2]}`,
      }
    : { fullLabel, title: fullLabel, version: null as string | null };
};

const getBatchJobPromptValue = (
  job: Pick<EcommerceBatchJob, "planItemId" | "prompt" | "finalPrompt">,
  drafts: Record<string, string>,
) => drafts[job.planItemId] ?? job.finalPrompt ?? job.prompt ?? "";

const getGenerationMetaChips = (meta?: EcommerceGenerationMeta) => {
  if (!meta) return [];

  const chips: Array<{
    text: string;
    className: string;
  }> = [];

  if (meta.usedModelLabel) {
    chips.push({
      text: `最终模型 ${meta.usedModelLabel}`,
      className: "bg-slate-100 text-slate-700",
    });
  }

  if ((meta.attemptedModels || []).length > 0) {
    chips.push({
      text: `已自动切换 ${meta.attemptedModels.length} 次`,
      className: "bg-amber-100 text-amber-700",
    });
  }

  if (typeof meta.referenceImageCount === "number") {
    chips.push({
      text: `参考图 ${meta.referenceImageCount} 张`,
      className: "bg-sky-100 text-sky-700",
    });
  }

  if (meta.consistencyGuarded) {
    chips.push({
      text: "已启用一致性约束",
      className: "bg-emerald-100 text-emerald-700",
    });
  }

  return chips;
};

const IMAGE_ROLE_LABELS: Record<string, string> = {
  hero: "主视觉",
  "selling-point": "卖点图",
  parameter: "参数图",
  structure: "结构图",
  detail: "细节图",
  scene: "场景图",
  comparison: "对比图",
  summary: "总结图",
};

const LAYOUT_MODE_LABELS: Record<string, string> = {
  "top-banner": "顶部横幅",
  "left-copy": "左文右图",
  "right-copy": "右文左图",
  "bottom-panel": "底部信息区",
  "center-focus-with-edge-space": "主体居中留文案",
  "split-info": "图文分栏",
};

const COMPONENT_NEED_LABELS: Record<string, string> = {
  "text-only": "纯文案",
  "text-and-icons": "文案+图标",
  "text-and-stats": "文案+参数",
  "annotation-heavy": "标注说明",
  "comparison-heavy": "对比组件",
};

const getLayoutMetaChips = (layoutMeta?: EcommerceLayoutSnapshot) => {
  if (!layoutMeta) return [];

  const chips: Array<{
    text: string;
    className: string;
  }> = [];

  if (layoutMeta.imageRole) {
    chips.push({
      text: IMAGE_ROLE_LABELS[layoutMeta.imageRole] || layoutMeta.imageRole,
      className: "bg-blue-50 text-blue-700",
    });
  }

  if (layoutMeta.layoutMode) {
    chips.push({
      text: LAYOUT_MODE_LABELS[layoutMeta.layoutMode] || layoutMeta.layoutMode,
      className: "bg-emerald-50 text-emerald-700",
    });
  }

  if (layoutMeta.componentNeed) {
    chips.push({
      text:
        COMPONENT_NEED_LABELS[layoutMeta.componentNeed] ||
        layoutMeta.componentNeed,
      className: "bg-amber-50 text-amber-700",
    });
  }

  return chips;
};

const REPLACEMENT_PROFILE_LABELS: Record<string, string> = {
  hero: "Hero 替换",
  selling: "卖点替换",
  comparison: "对比替换",
  spec: "参数替换",
  detail: "细节替换",
  scene: "场景替换",
  conversion: "收口替换",
  "white-bg": "白底替换",
};

const REPLACEMENT_SOURCE_LABELS: Record<string, string> = {
  "anchor-only": "锚点替换",
  "template-only": "模板推导",
  hybrid: "锚点+模板",
};

const REPLACEMENT_BACKGROUND_LABELS: Record<string, string> = {
  "flat-clean": "纯净底",
  "soft-gradient": "渐变底",
  "textured-surface": "纹理底",
  "complex-photo": "复杂底",
  unknown: "背景未知",
};

const getReplacementQualityChips = (overlayState?: EcommerceOverlayState | null) => {
  const quality = overlayState?.replacementQuality;
  if (!quality) return [];

  const chips: Array<{ text: string; className: string }> = [];
  if (quality.sourceMode) {
    chips.push({
      text: REPLACEMENT_SOURCE_LABELS[quality.sourceMode] || quality.sourceMode,
      className:
        quality.sourceMode === "anchor-only"
          ? "bg-fuchsia-50 text-fuchsia-700"
          : quality.sourceMode === "hybrid"
            ? "bg-violet-50 text-violet-700"
            : "bg-slate-100 text-slate-700",
    });
  }
  if (quality.profileId) {
    chips.push({
      text: REPLACEMENT_PROFILE_LABELS[quality.profileId] || quality.profileId,
      className: "bg-sky-50 text-sky-700",
    });
  }
  if (quality.backgroundKind) {
    chips.push({
      text:
        REPLACEMENT_BACKGROUND_LABELS[quality.backgroundKind] ||
        quality.backgroundKind,
      className: "bg-amber-50 text-amber-700",
    });
  }
  if (typeof quality.replacementBoxCount === "number") {
    chips.push({
      text: `替换框 ${quality.replacementBoxCount}`,
      className: "bg-emerald-50 text-emerald-700",
    });
  }
  return chips;
};

type OverlayEditorDraft = {
  targetUrl: string;
  headline: string;
  subheadline: string;
  badge: string;
  priceLabel: string;
  priceValue: string;
  priceNote: string;
  featureTagsText: string;
  bulletsText: string;
  statsText: string;
  comparisonTitle: string;
  comparisonRowsText: string;
  cta: string;
  templateId: NonNullable<EcommerceOverlayState["templateId"]>;
  textAlign: NonNullable<EcommerceOverlayState["textAlign"]>;
  tone: NonNullable<EcommerceOverlayState["tone"]>;
  bulletStyle: NonNullable<EcommerceOverlayState["bulletStyle"]>;
  stylePresetId: EcommerceOverlayStylePresetId | "";
  platformPresetId: EcommerceOverlayPlatformPresetId | "";
  layers: EcommerceOverlayLayer[];
  activeLayerKind: EcommerceOverlayLayerKind;
  fontFamily: string;
  fontLabel: string;
  fontUrl: string;
  featureTagIconLabel: string;
  featureTagIconUrl: string;
};

const OVERLAY_TEMPLATE_OPTIONS: Array<{
  id: NonNullable<EcommerceOverlayState["templateId"]>;
  label: string;
  description: string;
}> = [
  {
    id: "hero-left",
    label: "左文右图",
    description: "适合主视觉、场景图和品牌大字标题。",
  },
  {
    id: "hero-right",
    label: "右文左图",
    description: "适合主体偏左、右侧留白的详情页版式。",
  },
  {
    id: "hero-center",
    label: "居中聚焦",
    description: "适合首屏海报式标题和居中核心卖点。",
  },
  {
    id: "spec-band",
    label: "底部参数带",
    description: "适合参数图、卖点图和底栏信息模块。",
  },
];

const OVERLAY_TONE_OPTIONS: Array<{
  id: NonNullable<EcommerceOverlayState["tone"]>;
  label: string;
}> = [
  { id: "dark", label: "深色压感" },
  { id: "light", label: "浅色留白" },
  { id: "accent", label: "品牌强调" },
];

const OVERLAY_BULLET_STYLE_OPTIONS: Array<{
  id: NonNullable<EcommerceOverlayState["bulletStyle"]>;
  label: string;
}> = [
  { id: "list", label: "列表" },
  { id: "chips", label: "标签" },
  { id: "cards", label: "卡片" },
];

type OverlayStatDraftItem = {
  label: string;
  value: string;
};

type OverlayComparisonDraftItem = {
  label: string;
  before: string;
  after: string;
};

const parseOverlayFeatureTags = (value: string): string[] =>
  String(value || "")
    .split(/\r?\n|[；;，,]+/)
    .map((item) => item.replace(/^[•\-\d.\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 4);

const parseOverlayBullets = (value: string): string[] =>
  String(value || "")
    .split(/\r?\n|[；;]+/)
    .map((item) => item.replace(/^[•\-\d.\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 4);

const parseOverlayStats = (value: string): OverlayStatDraftItem[] =>
  String(value || "")
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[:：|｜]/).map((item) => item.trim());
      if (parts.length <= 1) {
        return {
          label: "",
          value: parts[0] || "",
        };
      }
      return {
        label: parts.slice(0, -1).join(" "),
        value: parts[parts.length - 1] || "",
      };
    })
    .filter((item) => item.label || item.value)
    .slice(0, 3);

const formatOverlayStats = (
  value?: EcommerceOverlayState["stats"],
): string =>
  (value || [])
    .map((item) =>
      item?.label && item?.value
        ? `${item.label}: ${item.value}`
        : item?.value || item?.label || "",
    )
    .filter(Boolean)
    .join("\n");

const parseOverlayComparisonRows = (value: string): OverlayComparisonDraftItem[] =>
  String(value || "")
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[:：|｜]/).map((item) => item.trim());
      if (parts.length >= 3) {
        return {
          label: parts[0] || "",
          before: parts[1] || "",
          after: parts.slice(2).join(" ") || "",
        };
      }
      if (parts.length === 2) {
        return {
          label: parts[0] || "",
          before: "",
          after: parts[1] || "",
        };
      }
      return {
        label: parts[0] || "",
        before: "",
        after: "",
      };
    })
    .filter((item) => item.label || item.before || item.after)
    .slice(0, 4);

const formatOverlayComparisonRows = (
  value?: EcommerceOverlayState["comparisonRows"],
): string =>
  (value || [])
    .map((item) => {
      if (item?.before && item?.after) {
        return `${item.label}: ${item.before} | ${item.after}`;
      }
      if (item?.after) {
        return `${item.label}: ${item.after}`;
      }
      return item?.label || "";
    })
    .filter(Boolean)
    .join("\n");

const getOverlayDraftContentKinds = (draft: {
  headline: string;
  subheadline: string;
  badge: string;
  priceLabel: string;
  priceValue: string;
  priceNote: string;
  featureTagsText: string;
  bulletsText: string;
  statsText: string;
  comparisonTitle: string;
  comparisonRowsText: string;
  cta: string;
}): EcommerceOverlayLayerKind[] => {
  const featureTags = parseOverlayFeatureTags(draft.featureTagsText);
  const bullets = parseOverlayBullets(draft.bulletsText);
  const stats = parseOverlayStats(draft.statsText);
  const comparisonRows = parseOverlayComparisonRows(draft.comparisonRowsText);
  const kinds: EcommerceOverlayLayerKind[] = [];
  if (draft.badge.trim()) kinds.push("badge");
  if (draft.headline.trim()) kinds.push("headline");
  if (draft.subheadline.trim()) kinds.push("subheadline");
  if (featureTags.length > 0) kinds.push("featureTags");
  if (
    draft.priceLabel.trim() ||
    draft.priceValue.trim() ||
    draft.priceNote.trim()
  ) {
    kinds.push("price");
  }
  if (stats.length > 0) kinds.push("stats");
  if (draft.comparisonTitle.trim() || comparisonRows.length > 0) {
    kinds.push("comparison");
  }
  if (bullets.length > 0) kinds.push("bullets");
  if (draft.cta.trim()) kinds.push("cta");
  return kinds;
};

const getLayoutRecommendedOverlayKinds = (
  layoutMeta?: EcommerceLayoutSnapshot,
): EcommerceOverlayLayerKind[] => {
  if (!layoutMeta) return ["headline", "subheadline"];

  const kinds = new Set<EcommerceOverlayLayerKind>(["headline"]);

  if (
    layoutMeta.reservedAreas?.includes("subheadline") ||
    layoutMeta.reservedAreas?.includes("body")
  ) {
    kinds.add("subheadline");
  }
  if (
    layoutMeta.componentNeed === "text-and-icons" ||
    layoutMeta.reservedAreas?.includes("icons")
  ) {
    kinds.add("featureTags");
    kinds.add("bullets");
  }
  if (
    layoutMeta.componentNeed === "text-and-stats" ||
    layoutMeta.reservedAreas?.includes("stats")
  ) {
    kinds.add("stats");
  }
  if (
    layoutMeta.componentNeed === "comparison-heavy" ||
    layoutMeta.reservedAreas?.includes("comparison")
  ) {
    kinds.add("comparison");
  }
  if (
    layoutMeta.componentNeed === "annotation-heavy" ||
    layoutMeta.reservedAreas?.includes("annotation")
  ) {
    kinds.add("bullets");
  }
  if (layoutMeta.imageRole === "hero" || layoutMeta.imageRole === "scene") {
    kinds.add("badge");
    kinds.add("cta");
  }

  return Array.from(kinds);
};

const summarizeOverlayLayerDraft = (
  draft: OverlayEditorDraft,
  kind: EcommerceOverlayLayerKind,
): string => {
  switch (kind) {
    case "badge":
      return draft.badge.trim() || "未填写";
    case "headline":
      return draft.headline.trim() || "未填写";
    case "subheadline":
      return draft.subheadline.trim() || "未填写";
    case "featureTags": {
      const items = parseOverlayFeatureTags(draft.featureTagsText);
      return items.length > 0 ? `${items.length} 个标签` : "未填写";
    }
    case "price":
      return (
        draft.priceValue.trim() ||
        draft.priceLabel.trim() ||
        draft.priceNote.trim() ||
        "未填写"
      );
    case "stats": {
      const items = parseOverlayStats(draft.statsText);
      return items.length > 0 ? `${items.length} 张参数卡` : "未填写";
    }
    case "comparison": {
      const items = parseOverlayComparisonRows(draft.comparisonRowsText);
      return items.length > 0
        ? `${items.length} 条对比`
        : draft.comparisonTitle.trim() || "未填写";
    }
    case "bullets": {
      const items = parseOverlayBullets(draft.bulletsText);
      return items.length > 0 ? `${items.length} 条卖点` : "未填写";
    }
    case "cta":
      return draft.cta.trim() || "未填写";
    default:
      return "未填写";
  }
};

const getPreferredActiveOverlayLayer = (
  layers: EcommerceOverlayLayer[],
  preferred?: EcommerceOverlayLayerKind,
): EcommerceOverlayLayerKind => {
  if (preferred && layers.some((layer) => layer.kind === preferred)) {
    return preferred;
  }
  return (
    layers.find((layer) => layer.visible !== false)?.kind ||
    layers[0]?.kind ||
    "headline"
  );
};

const buildOverlayDraftState = (
  result: EcommerceResultItem,
  preferredTemplateId?: string | null,
  preferredActiveLayerKind?: EcommerceOverlayLayerKind,
): OverlayEditorDraft => {
  const meta = parseResultMeta(result.label || "结果", "结果");
  const overlayState = result.overlayState;
  const layoutMeta = result.layoutMeta;
  const defaultRoleLabel = result.layoutMeta?.imageRole
    ? IMAGE_ROLE_LABELS[result.layoutMeta.imageRole] || result.layoutMeta.imageRole
    : "";
  const smartPreset = getSmartOverlayPreset({
    layoutMeta,
    bulletCount: overlayState?.bullets?.length || 0,
    featureTagCount: overlayState?.featureTags?.length || 0,
    statCount: overlayState?.stats?.length || 0,
    comparisonCount: overlayState?.comparisonRows?.length || 0,
    hasPrice: Boolean(overlayState?.priceValue || overlayState?.priceLabel),
    headlineLength: (overlayState?.headline || meta.title).trim().length,
    currentTemplateId: overlayState?.templateId || "hero-left",
    currentTone: overlayState?.tone || "dark",
  });
  const defaultTemplateId =
    overlayState?.templateId ||
    (preferredTemplateId as NonNullable<EcommerceOverlayState["templateId"]>) ||
    smartPreset.templateId;
  const defaultTone = overlayState?.tone || smartPreset.tone;
  const defaultTextAlign = overlayState?.textAlign || smartPreset.textAlign;
  const defaultBulletStyle = overlayState?.bulletStyle || smartPreset.bulletStyle;
  const recommendedKinds = getLayoutRecommendedOverlayKinds(layoutMeta);
  const contentKinds = getOverlayDraftContentKinds({
    headline: overlayState?.headline || meta.title,
    subheadline:
      overlayState?.subheadline ||
      (defaultRoleLabel ? `${defaultRoleLabel}底图，建议放主标题与核心卖点` : ""),
    badge: overlayState?.badge || "",
    priceLabel: overlayState?.priceLabel || "",
    priceValue: overlayState?.priceValue || "",
    priceNote: overlayState?.priceNote || "",
    featureTagsText: (overlayState?.featureTags || []).join("\n"),
    bulletsText: (overlayState?.bullets || []).join("\n"),
    statsText: formatOverlayStats(overlayState?.stats),
    comparisonTitle: overlayState?.comparisonTitle || "",
    comparisonRowsText: formatOverlayComparisonRows(overlayState?.comparisonRows),
    cta: overlayState?.cta || "",
  });
  const normalizedLayers = normalizeOverlayLayers(overlayState?.layers, {
    visibleKinds: Array.from(new Set([...recommendedKinds, ...contentKinds])),
  });
  return {
    targetUrl: result.url,
    headline: overlayState?.headline || meta.title,
    subheadline:
      overlayState?.subheadline ||
      (defaultRoleLabel ? `${defaultRoleLabel}底图，建议放主标题与核心卖点` : ""),
    badge: overlayState?.badge || "",
    priceLabel: overlayState?.priceLabel || "",
    priceValue: overlayState?.priceValue || "",
    priceNote: overlayState?.priceNote || "",
    featureTagsText: (overlayState?.featureTags || []).join("\n"),
    bulletsText: (overlayState?.bullets || []).join("\n"),
    statsText: formatOverlayStats(overlayState?.stats),
    comparisonTitle: overlayState?.comparisonTitle || "",
    comparisonRowsText: formatOverlayComparisonRows(overlayState?.comparisonRows),
    cta: overlayState?.cta || "",
    templateId: defaultTemplateId,
    textAlign: defaultTextAlign,
    tone: defaultTone,
    bulletStyle: defaultBulletStyle,
    stylePresetId: overlayState?.stylePresetId || "",
    platformPresetId: overlayState?.platformPresetId || "",
    layers: normalizedLayers,
    activeLayerKind: getPreferredActiveOverlayLayer(
      normalizedLayers,
      preferredActiveLayerKind,
    ),
    fontFamily: overlayState?.fontFamily || "",
    fontLabel: overlayState?.fontLabel || "",
    fontUrl: overlayState?.fontUrl || "",
    featureTagIconLabel: overlayState?.featureTagIconLabel || "",
    featureTagIconUrl: overlayState?.featureTagIconUrl || "",
  };
};

const inferOverlayRecoveryFocus = (
  result: EcommerceResultItem,
): {
  preferredActiveLayerKind?: EcommerceOverlayLayerKind;
  editorMessage?: string;
} => {
  const statusMessage = String(result.overlayState?.renderStatusMessage || "")
    .trim()
    .toLowerCase();

  if (
    statusMessage.includes("字体") ||
    statusMessage.includes("fontface") ||
    statusMessage.includes("font")
  ) {
    return {
      preferredActiveLayerKind: "headline",
      editorMessage:
        "当前失败更像是字体资源问题，建议先检查下方“自定义字体”，必要时重新上传字体后再生成成片。",
    };
  }

  if (
    statusMessage.includes("图标") ||
    statusMessage.includes("icon")
  ) {
    return {
      preferredActiveLayerKind: "featureTags",
      editorMessage:
        "当前失败更像是标签图标资源问题，建议先检查“标签图标”区域，确认图标可正常加载后再生成。",
    };
  }

  if (
    statusMessage.includes("跨域") ||
    statusMessage.includes("底图") ||
    statusMessage.includes("origin") ||
    statusMessage.includes("tainted")
  ) {
    return {
      preferredActiveLayerKind: result.overlayState?.headline ? "headline" : "featureTags",
      editorMessage:
        "当前失败更像是底图或外部资源被浏览器拦截。建议先确认底图、字体、图标都来自项目资产，再重新生成成片。",
    };
  }

  if (
    statusMessage.includes("未落盘") ||
    statusMessage.includes("会话") ||
    statusMessage.includes("资产保存")
  ) {
    return {
      preferredActiveLayerKind: result.overlayState?.cta ? "cta" : "headline",
      editorMessage:
        "当前成片已经生成，但没有稳定落盘。你可以直接再次生成，或调整当前上字方案后重新导出。",
    };
  }

  return {
    preferredActiveLayerKind: result.overlayState?.headline ? "headline" : "featureTags",
    editorMessage:
      "已打开当前结果的上字编辑器。建议优先检查标题、字体、图标和底图来源，再重新生成。",
  };
};

const buildOverlayStateFromDraft = (
  draft: OverlayEditorDraft | null,
  previousState?: EcommerceOverlayState,
): EcommerceOverlayState | null => {
  if (!draft) return null;
  const featureTags = parseOverlayFeatureTags(draft.featureTagsText);
  const bullets = parseOverlayBullets(draft.bulletsText);
  const stats = parseOverlayStats(draft.statsText);
  const comparisonRows = parseOverlayComparisonRows(draft.comparisonRowsText);
  const visibleKinds = getOverlayDraftContentKinds(draft);
  const hasContent = Boolean(
    draft.headline.trim() ||
      draft.subheadline.trim() ||
      draft.badge.trim() ||
      draft.priceLabel.trim() ||
      draft.priceValue.trim() ||
      draft.priceNote.trim() ||
      featureTags.length > 0 ||
      draft.cta.trim() ||
      bullets.length > 0 ||
      stats.length > 0 ||
      draft.comparisonTitle.trim() ||
      comparisonRows.length > 0,
  );

  return {
    ...previousState,
    status: hasContent
      ? previousState?.renderedAssetId
        ? "applied"
        : "draft"
      : "idle",
    templateId: draft.templateId,
    stylePresetId: draft.stylePresetId || undefined,
    platformPresetId: draft.platformPresetId || undefined,
    headline: draft.headline.trim() || undefined,
    subheadline: draft.subheadline.trim() || undefined,
    badge: draft.badge.trim() || undefined,
    priceLabel: draft.priceLabel.trim() || undefined,
    priceValue: draft.priceValue.trim() || undefined,
    priceNote: draft.priceNote.trim() || undefined,
    featureTags,
    bullets,
    stats,
    comparisonTitle: draft.comparisonTitle.trim() || undefined,
    comparisonRows,
    cta: draft.cta.trim() || undefined,
    textAlign: draft.textAlign,
    tone: draft.tone,
    bulletStyle: draft.bulletStyle,
    layers: normalizeOverlayLayers(draft.layers, {
      visibleKinds,
    }),
    fontAssetId: draft.fontUrl.trim()
      ? previousState?.fontAssetId
      : undefined,
    fontFamily: draft.fontFamily.trim() || undefined,
    fontLabel: draft.fontLabel.trim() || undefined,
    fontUrl: draft.fontUrl.trim() || undefined,
    featureTagIconAssetId: draft.featureTagIconUrl.trim()
      ? previousState?.featureTagIconAssetId
      : undefined,
    featureTagIconLabel: draft.featureTagIconLabel.trim() || undefined,
    featureTagIconUrl: draft.featureTagIconUrl.trim() || undefined,
  };
};

const getResultDisplayUrl = (result: EcommerceResultItem): string =>
  result.overlayState?.renderedImageUrl || result.url;

const hasOverlayContent = (overlayState?: EcommerceOverlayState | null) =>
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

const getOverlayPreviewPanelStyle = (
  draft: Pick<
    OverlayEditorDraft,
    | "templateId"
    | "headline"
    | "subheadline"
    | "badge"
    | "cta"
    | "featureTagsText"
    | "bulletsText"
    | "statsText"
    | "priceValue"
    | "priceLabel"
    | "priceNote"
    | "comparisonRowsText"
    | "layers"
    | "tone"
    | "textAlign"
  >,
): React.CSSProperties => {
  const layerVisibility = getOverlayLayerVisibilityMap(draft.layers);
  const panelBox = getOverlayPanelBox({
    templateId: draft.templateId,
    statCount: layerVisibility.stats ? parseOverlayStats(draft.statsText).length : 0,
    comparisonCount: layerVisibility.comparison
      ? parseOverlayComparisonRows(draft.comparisonRowsText).length
      : 0,
    hasPrice: Boolean(
      layerVisibility.price &&
        (draft.priceValue.trim() ||
          draft.priceLabel.trim() ||
          draft.priceNote.trim()),
    ),
    headlineLength: draft.headline.trim().length,
    subheadlineLength: draft.subheadline.trim().length,
    bulletCount: layerVisibility.bullets ? parseOverlayBullets(draft.bulletsText).length : 0,
    featureTagCount: layerVisibility.featureTags
      ? parseOverlayFeatureTags(draft.featureTagsText).length
      : 0,
    hasBadge: layerVisibility.badge && Boolean(draft.badge.trim()),
    hasCta: layerVisibility.cta && Boolean(draft.cta.trim()),
  });
  return {
    position: "absolute",
    left: panelBox.left != null ? `${panelBox.left * 100}%` : undefined,
    right: panelBox.right != null ? `${panelBox.right * 100}%` : undefined,
    top: panelBox.top != null ? `${panelBox.top * 100}%` : undefined,
    bottom: panelBox.bottom != null ? `${panelBox.bottom * 100}%` : undefined,
    width: `${panelBox.width * 100}%`,
    height: `${panelBox.height * 100}%`,
  };
};

const getOverlayHeadlinePreviewClassName = (
  draft: Pick<OverlayEditorDraft, "headline" | "templateId">,
  compactPanel = false,
) => {
  const length = draft.headline.trim().length;
  if (draft.templateId === "spec-band") {
    return length > 18
      ? "mt-3 text-[18px] font-black leading-[1.08] tracking-[-0.03em]"
      : "mt-3 text-[21px] font-black leading-[1.06] tracking-[-0.035em]";
  }
  if (compactPanel) {
    if (length > 24) {
      return "mt-3 text-[19px] font-black leading-[1.14] tracking-[-0.03em]";
    }
    if (length > 14) {
      return "mt-3 text-[23px] font-black leading-[1.08] tracking-[-0.038em]";
    }
    return "mt-3 text-[26px] font-black leading-[1.03] tracking-[-0.042em]";
  }
  if (length > 26) {
    return "mt-4 text-[22px] font-black leading-[1.1] tracking-[-0.035em]";
  }
  if (length > 16) {
    return "mt-4 text-[26px] font-black leading-[1.08] tracking-[-0.04em]";
  }
  return "mt-4 text-[30px] font-black leading-[1.02] tracking-[-0.045em]";
};

const getOverlaySubheadlinePreviewClassName = (
  draft: Pick<OverlayEditorDraft, "subheadline" | "templateId">,
  compactPanel = false,
) => {
  const length = draft.subheadline.trim().length;
  if (draft.templateId === "spec-band") {
    return length > 34 ? "mt-2 text-[10px] leading-[1.55]" : "mt-2 text-[11px] leading-[1.6]";
  }
  if (compactPanel) {
    return length > 40 ? "mt-2 text-[10px] leading-[1.6]" : "mt-2 text-[11px] leading-[1.62]";
  }
  return length > 44 ? "mt-2 text-[11px] leading-[1.65]" : "mt-2 text-[12px] leading-[1.7]";
};

const applySmartOverlayPreset = (
  result: EcommerceResultItem | null,
  draft: OverlayEditorDraft,
): OverlayEditorDraft => {
  const preset = getSmartOverlayPreset({
    layoutMeta: result?.layoutMeta,
    bulletCount: parseOverlayBullets(draft.bulletsText).length,
    featureTagCount: parseOverlayFeatureTags(draft.featureTagsText).length,
    statCount: parseOverlayStats(draft.statsText).length,
    comparisonCount: parseOverlayComparisonRows(draft.comparisonRowsText).length,
    hasPrice: Boolean(
      draft.priceLabel.trim() || draft.priceValue.trim() || draft.priceNote.trim(),
    ),
    headlineLength: draft.headline.trim().length,
    currentTemplateId: draft.templateId,
    currentTone: draft.tone,
  });
  const layers = normalizeOverlayLayers(draft.layers, {
    visibleKinds: getOverlayDraftContentKinds(draft),
  });

  return {
    ...draft,
    templateId: preset.templateId,
    tone: preset.tone,
    textAlign: preset.textAlign,
    bulletStyle: preset.bulletStyle,
    stylePresetId: "",
    layers,
    activeLayerKind: getPreferredActiveOverlayLayer(layers, draft.activeLayerKind),
  };
};

const applyOverlayStylePresetToDraft = (
  result: EcommerceResultItem | null,
  draft: OverlayEditorDraft,
  presetId: EcommerceOverlayStylePresetId,
): OverlayEditorDraft => {
  const preset = getOverlayStylePresetConfig({
    presetId,
    layoutMeta: result?.layoutMeta,
    currentTemplateId: draft.templateId,
    currentTone: draft.tone,
  });
  const layers = applyOverlayLayerArrangement(draft.layers, preset.layerArrangement);
  return {
    ...draft,
    stylePresetId: presetId,
    templateId: preset.templateId,
    tone: preset.tone,
    textAlign: preset.textAlign,
    bulletStyle: preset.bulletStyle,
    layers,
    activeLayerKind: getPreferredActiveOverlayLayer(layers, draft.activeLayerKind),
  };
};

const applyOverlayPlatformPresetToDraft = (
  draft: OverlayEditorDraft,
  presetId: EcommerceOverlayPlatformPresetId | "",
): OverlayEditorDraft => {
  const preset = getOverlayPlatformPresetConfig(presetId);
  if (!preset) {
    return {
      ...draft,
      platformPresetId: "",
    };
  }
  return {
    ...draft,
    platformPresetId: preset.id,
    templateId: preset.templateId,
    textAlign: preset.textAlign,
    tone: preset.tone,
    bulletStyle: preset.bulletStyle,
    stylePresetId: "",
  };
};

const applyOverlayBrandPresetToDraft = (
  draft: OverlayEditorDraft,
  preset: EcommerceOverlayBrandPreset | null,
): OverlayEditorDraft => {
  if (!preset) return draft;
  return {
    ...draft,
    fontFamily: preset.fontFamily || draft.fontFamily,
    fontLabel: preset.fontLabel || draft.fontLabel,
    fontUrl: preset.fontUrl || draft.fontUrl,
    featureTagIconLabel:
      preset.featureTagIconLabel || draft.featureTagIconLabel,
    featureTagIconUrl: preset.featureTagIconUrl || draft.featureTagIconUrl,
    badge: preset.badge || draft.badge,
    cta: preset.cta || draft.cta,
    tone: preset.tone || draft.tone,
    bulletStyle: preset.bulletStyle || draft.bulletStyle,
  };
};

const loadOverlayPreviewFont = async (
  fontFamily: string,
  fontUrl: string,
): Promise<boolean> => {
  if (!fontFamily || !fontUrl || typeof FontFace === "undefined") {
    return false;
  }

  try {
    const face = new FontFace(fontFamily, `url(${fontUrl})`);
    await face.load();
    (document as Document & {
      fonts?: Set<FontFace> & { add?: (font: FontFace) => void; ready?: Promise<unknown> };
    }).fonts?.add?.(face);
    return true;
  } catch {
    return false;
  }
};

const OverlayPreviewCanvas = ({
  imageUrl,
  draft,
  layoutMeta,
  assistReport,
  onPreview,
}: {
  imageUrl: string;
  draft: OverlayEditorDraft;
  layoutMeta?: EcommerceLayoutSnapshot;
  assistReport?: EcommerceOverlayAssistReport | null;
  onPreview?: (url: string) => void;
}) => {
  const bullets = draft.bulletsText
    ? parseOverlayBullets(draft.bulletsText)
    : [];
  const featureTags = draft.featureTagsText
    ? parseOverlayFeatureTags(draft.featureTagsText)
    : [];
  const stats = draft.statsText ? parseOverlayStats(draft.statsText) : [];
  const comparisonRows = draft.comparisonRowsText
    ? parseOverlayComparisonRows(draft.comparisonRowsText)
    : [];
  const orderedLayers = getOrderedOverlayLayers(draft.layers).filter(
    (layer) => layer.visible !== false,
  );
  const layerVisibility = getOverlayLayerVisibilityMap(draft.layers);
  const panelStyle = getOverlayPreviewPanelStyle(draft);
  const recommendedPanelStyle = assistReport
    ? getOverlayPreviewPanelStyle({
        ...draft,
        templateId: assistReport.recommendedTemplateId,
        tone: assistReport.recommendedTone,
        textAlign: assistReport.recommendedTextAlign,
      })
    : null;
  const isLightTone = draft.tone === "light";
  const isAccentTone = draft.tone === "accent";
  const semanticMeta = getOverlaySemanticMeta({
    templateId: draft.templateId,
    layoutMeta,
    statCount: layerVisibility.stats ? stats.length : 0,
    comparisonCount: layerVisibility.comparison ? comparisonRows.length : 0,
    comparisonTitle: layerVisibility.comparison ? draft.comparisonTitle : "",
  });
  const decorationProfile = getOverlayDecorationProfile({
    templateId: draft.templateId,
    layoutMeta,
    statCount: layerVisibility.stats ? stats.length : 0,
    comparisonCount: layerVisibility.comparison ? comparisonRows.length : 0,
    bulletCount: layerVisibility.bullets ? bullets.length : 0,
    featureTagCount: layerVisibility.featureTags ? featureTags.length : 0,
    hasPrice: Boolean(
      draft.priceLabel.trim() || draft.priceValue.trim() || draft.priceNote.trim(),
    ),
    hasCta: Boolean(draft.cta.trim()),
    hasBadge: Boolean(draft.badge.trim()),
    headlineLength: draft.headline.trim().length,
    subheadlineLength: draft.subheadline.trim().length,
    stylePresetId: draft.stylePresetId,
  });
  const sectionOrder = buildOverlaySectionOrder({
    hasFeatureTags: layerVisibility.featureTags && featureTags.length > 0,
    hasStats: layerVisibility.stats && stats.length > 0,
    hasComparison:
      layerVisibility.comparison &&
      Boolean(draft.comparisonTitle.trim() || comparisonRows.length > 0),
    hasBullets: layerVisibility.bullets && bullets.length > 0,
  });
  const [fontReady, setFontReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!draft.fontFamily || !draft.fontUrl) {
      setFontReady(false);
      return;
    }

    loadOverlayPreviewFont(draft.fontFamily, draft.fontUrl).then((loaded) => {
      if (!cancelled) {
        setFontReady(loaded);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [draft.fontFamily, draft.fontUrl]);

  const previewFontFamily =
    fontReady && draft.fontFamily
      ? `"${draft.fontFamily}", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`
      : `"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`;
  const previewMeasurementItems = [
    ...stats.map((item) => item.value || item.label),
    ...featureTags,
    ...bullets,
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 4);
  const heroRibbonText = (
    draft.badge.trim() ||
    featureTags[0] ||
    ""
  ).trim();
  const panelShellClassName = decorationProfile.compactPanel
    ? [
        "pointer-events-none border px-4 py-3",
        decorationProfile.minimalChrome
          ? "shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
          : "shadow-[0_16px_38px_rgba(15,23,42,0.12)] backdrop-blur-sm",
        isLightTone
          ? "border-white/90 bg-white/84 text-slate-900"
          : isAccentTone
            ? "border-white/16 bg-slate-950/34 text-white"
            : "border-white/16 bg-slate-950/30 text-white",
      ].join(" ")
    : [
        "pointer-events-none border px-5 py-4 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur-md",
        isLightTone
          ? "border-white/80 bg-white/76 text-slate-900"
          : isAccentTone
            ? "border-white/18 bg-slate-950/56 text-white"
            : "border-white/16 bg-slate-950/46 text-white",
      ].join(" ");

  const renderPreviewLayer = (kind: EcommerceOverlayLayerKind) => {
    switch (kind) {
      case "badge":
        return draft.badge.trim() ? (
          <span
            style={{ fontFamily: previewFontFamily }}
            className={[
              "mt-3 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold",
              isLightTone
                ? "border-orange-200 bg-orange-50 text-orange-700"
                : "border-white/10 bg-white/8 text-white/78",
            ].join(" ")}
          >
            {draft.badge.trim()}
          </span>
        ) : null;
      case "headline":
        return draft.headline.trim() ? (
          <div
            className={getOverlayHeadlinePreviewClassName(
              draft,
              decorationProfile.compactPanel,
            )}
            style={{ fontFamily: previewFontFamily }}
          >
            {draft.headline.trim()}
          </div>
        ) : null;
      case "subheadline":
        return draft.subheadline.trim() ? (
          <div
            style={{ fontFamily: previewFontFamily }}
            className={[
              getOverlaySubheadlinePreviewClassName(
                draft,
                decorationProfile.compactPanel,
              ),
              isLightTone ? "text-slate-700" : "text-white/85",
            ].join(" ")}
          >
            {draft.subheadline.trim()}
          </div>
        ) : null;
      case "price":
        return layerVisibility.price &&
          (draft.priceValue.trim() ||
            draft.priceLabel.trim() ||
            draft.priceNote.trim()) ? (
          <div
            className={[
              "relative mt-4 w-full overflow-hidden rounded-[28px] border px-4 py-4 shadow-[0_18px_38px_rgba(15,23,42,0.12)]",
              isLightTone
                ? "border-slate-200 bg-white/82 text-slate-900"
                : "border-white/10 bg-black/12 text-white",
            ].join(" ")}
            style={{ fontFamily: previewFontFamily }}
          >
            <div
              className={[
                "absolute inset-0",
                isLightTone
                  ? "bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(255,247,237,0.88)_40%,rgba(255,255,255,0.88))]"
                  : "bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.03)_35%,rgba(255,255,255,0.08))]",
              ].join(" ")}
            />
            <div
              className={[
                "absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl",
                isLightTone ? "bg-orange-200/70" : "bg-amber-300/16",
              ].join(" ")}
            />
            <div
              className={[
                "absolute inset-x-4 top-0 h-px",
                isLightTone ? "bg-white/90" : "bg-white/18",
              ].join(" ")}
            />
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {draft.priceLabel.trim() ? (
                    <div
                      className={[
                        "text-[10px] font-semibold uppercase tracking-[0.18em]",
                        isLightTone ? "text-slate-500" : "text-white/58",
                      ].join(" ")}
                    >
                      {draft.priceLabel.trim()}
                    </div>
                  ) : null}
                  {draft.priceValue.trim() ? (
                    <div
                      className={[
                        "mt-1 text-[28px] font-black leading-none tracking-[-0.05em]",
                        isLightTone ? "text-slate-950" : "text-white",
                      ].join(" ")}
                    >
                      {draft.priceValue.trim()}
                    </div>
                  ) : null}
                </div>
                <span
                  className={[
                    "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em]",
                    isLightTone
                      ? "border-orange-200 bg-orange-50 text-orange-600"
                      : "border-amber-300/18 bg-amber-300/10 text-amber-200",
                  ].join(" ")}
                >
                  {decorationProfile.cornerStamp || "price"}
                </span>
              </div>
              {draft.priceNote.trim() ? (
                <div
                  className={[
                    "mt-3 border-t pt-2.5 text-[10px] leading-[1.65]",
                    isLightTone
                      ? "border-slate-200/80 text-slate-500"
                      : "border-white/10 text-white/62",
                  ].join(" ")}
                >
                  {draft.priceNote.trim()}
                </div>
              ) : null}
            </div>
          </div>
        ) : null;
      case "featureTags":
        return layerVisibility.featureTags && featureTags.length > 0 ? (
          <div
            className="mt-4 flex w-full flex-wrap gap-2 text-[10px] font-semibold leading-4"
            style={{ fontFamily: previewFontFamily }}
          >
            <div className="mb-1 flex w-full items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-62">
              <span
                className={[
                  "inline-flex min-w-[18px] items-center justify-center rounded-full border px-1.5 py-0.5 text-[9px] font-black",
                  isLightTone
                    ? "border-slate-200 bg-white text-slate-500"
                    : "border-white/12 bg-white/6 text-white/58",
                ].join(" ")}
              >
                {decorationProfile.showSectionNumbers && sectionOrder.featureTags
                  ? String(sectionOrder.featureTags).padStart(2, "0")
                  : "•"}
              </span>
              <span>{semanticMeta.featureTitle}</span>
              <span className={isLightTone ? "h-px flex-1 bg-slate-200" : "h-px flex-1 bg-white/10"} />
            </div>
            {featureTags.map((item, index) => (
              <span
                key={`${draft.targetUrl}-feature-tag-${index}`}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5",
                  isLightTone
                    ? "border-slate-200 bg-white/82 text-slate-700"
                    : "border-white/10 bg-white/7 text-white/82",
                ].join(" ")}
              >
                {draft.featureTagIconUrl.trim() ? (
                  <img
                    src={draft.featureTagIconUrl}
                    alt=""
                    className="h-3.5 w-3.5 rounded-[4px] object-cover"
                  />
                ) : (
                  <span
                    className={[
                      "h-1.5 w-1.5 rounded-full",
                      isLightTone ? "bg-sky-600" : "bg-amber-300",
                    ].join(" ")}
                  />
                )}
                {item}
              </span>
            ))}
          </div>
        ) : null;
      case "stats":
        return layerVisibility.stats && stats.length > 0 ? (
          <div
            className={[
              "mt-4 grid w-full gap-2.5",
              stats.length === 1 ? "grid-cols-1" : "grid-cols-2",
            ].join(" ")}
            style={{ fontFamily: previewFontFamily }}
          >
            <div className="col-span-full mb-0.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-62">
              <span
                className={[
                  "inline-flex min-w-[18px] items-center justify-center rounded-full border px-1.5 py-0.5 text-[9px] font-black",
                  isLightTone
                    ? "border-slate-200 bg-white text-slate-500"
                    : "border-white/12 bg-white/6 text-white/58",
                ].join(" ")}
              >
                {decorationProfile.showSectionNumbers && sectionOrder.stats
                  ? String(sectionOrder.stats).padStart(2, "0")
                  : "•"}
              </span>
              <span>参数速览</span>
              <span className={isLightTone ? "h-px flex-1 bg-slate-200" : "h-px flex-1 bg-white/10"} />
            </div>
            {stats.map((item, index) => (
              <div
                key={`${draft.targetUrl}-stat-${index}`}
                className={[
                  "relative overflow-hidden rounded-[22px] border px-3 py-3.5 shadow-[0_14px_30px_rgba(15,23,42,0.08)]",
                  isLightTone
                    ? "border-slate-200 bg-white/90 text-slate-900"
                    : "border-white/10 bg-white/8 text-white",
                ].join(" ")}
              >
                <div
                  className={[
                    "absolute inset-x-0 top-0 h-[3px]",
                    isLightTone ? "bg-orange-500/80" : "bg-amber-300/80",
                  ].join(" ")}
                />
                <div
                  className={[
                    "absolute -right-4 -top-5 h-14 w-14 rounded-full blur-xl",
                    isLightTone ? "bg-orange-100/90" : "bg-amber-300/14",
                  ].join(" ")}
                />
                <div className="relative z-10">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span
                      className={[
                        "inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black tracking-[0.12em]",
                        isLightTone
                          ? "border-slate-200 bg-slate-50 text-slate-500"
                          : "border-white/10 bg-white/8 text-white/62",
                      ].join(" ")}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={[
                        "h-px flex-1",
                        isLightTone ? "bg-slate-200" : "bg-white/10",
                      ].join(" ")}
                    />
                  </div>
                </div>
                {item.value ? (
                  <div className="text-[15px] font-black leading-[1.05] tracking-[-0.03em]">
                    {item.value}
                  </div>
                ) : null}
                {item.label ? (
                  <div
                    className={[
                      "mt-1.5 text-[10px] leading-[1.55]",
                      isLightTone ? "text-slate-500" : "text-white/56",
                    ].join(" ")}
                  >
                    {item.label}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null;
      case "comparison":
        return layerVisibility.comparison &&
          (draft.comparisonTitle.trim() || comparisonRows.length > 0) ? (
          <div
            className={[
              "relative mt-4 w-full overflow-hidden rounded-[28px] border px-4 py-4 shadow-[0_18px_38px_rgba(15,23,42,0.10)]",
              isLightTone
                ? "border-slate-200 bg-white/90 text-slate-900"
                : "border-white/10 bg-white/8 text-white",
            ].join(" ")}
            style={{ fontFamily: previewFontFamily }}
          >
            <div
              className={[
                "absolute inset-0",
                isLightTone
                  ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.86))]"
                  : "bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))]",
              ].join(" ")}
            />
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-62">
              <span
                className={[
                  "inline-flex min-w-[18px] items-center justify-center rounded-full border px-1.5 py-0.5 text-[9px] font-black",
                  isLightTone
                    ? "border-slate-200 bg-white text-slate-500"
                    : "border-white/12 bg-white/6 text-white/58",
                ].join(" ")}
              >
                {decorationProfile.showSectionNumbers && sectionOrder.comparison
                  ? String(sectionOrder.comparison).padStart(2, "0")
                  : "•"}
              </span>
              <span>对比说明</span>
              <span className={isLightTone ? "h-px flex-1 bg-slate-200" : "h-px flex-1 bg-white/10"} />
            </div>
            {semanticMeta.comparisonTitle ? (
              <div className={isLightTone ? "relative z-10 text-[10px] font-semibold tracking-[0.12em] text-slate-500" : "relative z-10 text-[10px] font-semibold tracking-[0.12em] text-white/50"}>
                {semanticMeta.comparisonTitle}
              </div>
            ) : null}
            <div className="relative z-10 mt-2 rounded-[20px]">
              <div
                className={[
                  "mb-2 grid grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 px-3 text-[9px] font-black uppercase tracking-[0.14em]",
                  isLightTone ? "text-slate-400" : "text-white/40",
                ].join(" ")}
              >
                <span>项目</span>
                <span>前</span>
                <span>后</span>
              </div>
              <div className="space-y-2">
              {comparisonRows.map((item, index) => (
                <div
                  key={`${draft.targetUrl}-comparison-${index}`}
                  className={[
                    "relative grid items-center gap-3 rounded-[20px] border px-3 py-3",
                    item.before ? "grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)]" : "grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
                    isLightTone ? "border-slate-200 bg-slate-50/80" : "border-white/8 bg-black/10",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "text-[10px] font-semibold",
                      isLightTone ? "text-slate-600" : "text-white/78",
                    ].join(" ")}
                  >
                    {item.label || "对比项"}
                  </div>
                  {item.before ? (
                    <>
                      <div
                        className={[
                          "text-[10px] leading-4 line-through",
                          isLightTone ? "text-slate-400" : "text-white/40",
                        ].join(" ")}
                      >
                        {item.before}
                      </div>
                      {decorationProfile.emphasizeComparisonArrow ? (
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                          <span
                            className={[
                              "rounded-full border px-2 py-0.5 text-[9px] font-black",
                              isLightTone
                                ? "border-slate-200 bg-white text-slate-500"
                                : "border-white/10 bg-white/8 text-white/62",
                            ].join(" ")}
                          >
                            UP
                          </span>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                  <div
                    className={[
                      "rounded-[14px] border px-2.5 py-2 text-[11px] font-bold leading-4",
                      isLightTone
                        ? "border-orange-200/90 bg-orange-50 text-slate-900"
                        : "border-amber-300/14 bg-amber-300/10 text-white",
                    ].join(" ")}
                  >
                    {item.after || "-"}
                  </div>
                </div>
              ))}
              </div>
            </div>
          </div>
        ) : null;
      case "bullets":
        if (!layerVisibility.bullets || bullets.length === 0) return null;
        if (draft.bulletStyle === "chips") {
          return (
            <div
              className="mt-4 flex w-full flex-wrap gap-2 text-[10px] font-semibold leading-4"
              style={{ fontFamily: previewFontFamily }}
            >
              <div className="mb-1 flex w-full items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-62">
                <span
                  className={[
                    "inline-flex min-w-[18px] items-center justify-center rounded-full border px-1.5 py-0.5 text-[9px] font-black",
                    isLightTone
                      ? "border-slate-200 bg-white text-slate-500"
                      : "border-white/12 bg-white/6 text-white/58",
                  ].join(" ")}
                >
                  {decorationProfile.showSectionNumbers && sectionOrder.bullets
                    ? String(sectionOrder.bullets).padStart(2, "0")
                    : "•"}
                </span>
                <span>{semanticMeta.bulletsTitle}</span>
                <span className={isLightTone ? "h-px flex-1 bg-slate-200" : "h-px flex-1 bg-white/10"} />
              </div>
              {bullets.map((item, index) => (
                <span
                  key={`${draft.targetUrl}-bullet-chip-${index}`}
                  className={[
                    "inline-flex items-center rounded-[16px] border px-3 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.06)]",
                    isLightTone
                      ? "border-slate-200 bg-white/88 text-slate-700"
                      : "border-white/10 bg-white/8 text-white/82",
                  ].join(" ")}
                >
                  {decorationProfile.emphasizeBulletNumbers ? (
                    <span
                      className={[
                        "mr-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full text-[9px] font-black",
                        isLightTone
                          ? "bg-orange-500 text-white"
                          : "bg-amber-300 text-slate-900",
                      ].join(" ")}
                    >
                      {index + 1}
                    </span>
                  ) : null}
                  {item}
                </span>
              ))}
            </div>
          );
        }
        if (draft.bulletStyle === "cards") {
          return (
            <div
              className="mt-4 grid w-full gap-2 text-[10px] font-semibold leading-4"
              style={{ fontFamily: previewFontFamily }}
            >
              <div className="mb-1 flex w-full items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-62">
                <span
                  className={[
                    "inline-flex min-w-[18px] items-center justify-center rounded-full border px-1.5 py-0.5 text-[9px] font-black",
                    isLightTone
                      ? "border-slate-200 bg-white text-slate-500"
                      : "border-white/12 bg-white/6 text-white/58",
                  ].join(" ")}
                >
                  {decorationProfile.showSectionNumbers && sectionOrder.bullets
                    ? String(sectionOrder.bullets).padStart(2, "0")
                    : "•"}
                </span>
                <span>{semanticMeta.bulletsTitle}</span>
                <span className={isLightTone ? "h-px flex-1 bg-slate-200" : "h-px flex-1 bg-white/10"} />
              </div>
              {bullets.map((item, index) => (
                <div
                  key={`${draft.targetUrl}-bullet-card-${index}`}
                  className={[
                    "relative overflow-hidden rounded-[22px] border px-3.5 py-3.5 shadow-[0_14px_30px_rgba(15,23,42,0.08)]",
                    isLightTone
                      ? "border-slate-200 bg-white/90 text-slate-700"
                      : "border-white/10 bg-white/8 text-white/82",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "absolute left-0 top-0 h-full w-1.5",
                      isLightTone ? "bg-orange-500/85" : "bg-amber-300/85",
                    ].join(" ")}
                  />
                  {decorationProfile.emphasizeBulletNumbers ? (
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={[
                          "inline-flex h-4 min-w-4 items-center justify-center rounded-full text-[9px] font-black",
                          isLightTone
                            ? "bg-orange-500 text-white"
                            : "bg-amber-300 text-slate-900",
                        ].join(" ")}
                      >
                        {index + 1}
                      </span>
                      <span className={isLightTone ? "text-slate-400" : "text-white/42"}>
                        重点
                      </span>
                    </div>
                  ) : null}
                  {item}
                </div>
              ))}
            </div>
          );
        }
        return (
          <div
            className="mt-4 space-y-1.5 text-[11px] font-medium leading-[1.7]"
            style={{ fontFamily: previewFontFamily }}
          >
            <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-62">
              <span
                className={[
                  "inline-flex min-w-[18px] items-center justify-center rounded-full border px-1.5 py-0.5 text-[9px] font-black",
                  isLightTone
                    ? "border-slate-200 bg-white text-slate-500"
                    : "border-white/12 bg-white/6 text-white/58",
                ].join(" ")}
              >
                {decorationProfile.showSectionNumbers && sectionOrder.bullets
                  ? String(sectionOrder.bullets).padStart(2, "0")
                  : "•"}
              </span>
              <span>{semanticMeta.bulletsTitle}</span>
              <span className={isLightTone ? "h-px flex-1 bg-slate-200" : "h-px flex-1 bg-white/10"} />
            </div>
            {bullets.map((item, index) => (
              <div key={`${draft.targetUrl}-bullet-${index}`}>
                {decorationProfile.emphasizeBulletNumbers ? `${index + 1}. ` : "• "}
                {item}
              </div>
            ))}
          </div>
        );
      case "cta":
        return draft.cta.trim() ? (
          <span
            style={{ fontFamily: previewFontFamily }}
            className={[
              "relative mt-4 inline-flex items-center gap-2 overflow-hidden rounded-full border px-4 py-2 text-[10px] font-semibold shadow-[0_16px_30px_rgba(15,23,42,0.14)]",
              isLightTone
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-white/12 bg-white/10 text-white",
            ].join(" ")}
          >
            <span
              className={[
                "absolute inset-y-0 left-0 w-10",
                isLightTone ? "bg-white/6" : "bg-white/6",
              ].join(" ")}
            />
            <span className="relative z-10">{draft.cta.trim()}</span>
            <span
              className={[
                "relative z-10 inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black",
                isLightTone ? "bg-white/14 text-white" : "bg-white/14 text-white",
              ].join(" ")}
            >
              GO
            </span>
          </span>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
      <img
        src={imageUrl}
        alt="overlay-preview"
        onClick={() => onPreview?.(imageUrl)}
        className={[
          "h-full w-full object-cover",
          onPreview ? "cursor-zoom-in" : "",
        ].join(" ")}
      />
      {decorationProfile.showCompareBackdrop ? (
        <div
          className={[
            "pointer-events-none absolute inset-0",
            isLightTone
              ? "bg-[linear-gradient(142deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0)_45%,rgba(255,255,255,0.34)_46%,rgba(255,255,255,0.82)_76%,rgba(255,255,255,0.96)_100%)]"
              : "bg-[linear-gradient(142deg,rgba(15,23,42,0)_0%,rgba(15,23,42,0)_46%,rgba(15,23,42,0.20)_47%,rgba(15,23,42,0.48)_78%,rgba(15,23,42,0.62)_100%)]",
          ].join(" ")}
        />
      ) : null}
      {decorationProfile.showAmbientGrid ? (
        <div
          className="pointer-events-none absolute left-[-6%] top-[12%] h-[34%] w-[56%] overflow-hidden opacity-85"
          style={{
            clipPath: "polygon(0 6%, 100% 0, 86% 100%, 0 82%)",
            transform: "perspective(700px) rotateX(62deg) rotateZ(-12deg)",
          }}
        >
          <div
            className={[
              "h-full w-full",
              isLightTone
                ? "bg-[linear-gradient(rgba(96,165,250,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(96,165,250,0.22)_1px,transparent_1px)]"
                : "bg-[linear-gradient(rgba(125,211,252,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.2)_1px,transparent_1px)]",
            ].join(" ")}
            style={{ backgroundSize: "24px 24px" }}
          />
        </div>
      ) : null}
      {decorationProfile.showSceneBeam ? (
        <svg
          className="pointer-events-none absolute inset-0"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="overlay-scene-beam" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(196,181,253,0)" />
              <stop offset="48%" stopColor="rgba(168,85,247,0.52)" />
              <stop offset="100%" stopColor="rgba(96,165,250,0.18)" />
            </linearGradient>
          </defs>
          <polyline
            points="79,61 92,58 100,60"
            fill="none"
            stroke="url(#overlay-scene-beam)"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
          <polyline
            points="72,67 86,66 100,72"
            fill="none"
            stroke="url(#overlay-scene-beam)"
            strokeWidth="0.7"
            strokeLinecap="round"
          />
          <circle cx="78" cy="61" r="0.7" fill="rgba(168,85,247,0.58)" />
        </svg>
      ) : null}
      {decorationProfile.showMeasurementGuides && previewMeasurementItems.length > 0 ? (
        <svg
          className="pointer-events-none absolute inset-0"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {previewMeasurementItems.map((item, index) => {
            const anchorX = index % 2 === 0 ? 36 : 66;
            const anchorY = index < 2 ? 62 : 80;
            const labelX = index % 2 === 0 ? 10 : 78;
            const labelY = index < 2 ? 34 + index * 10 : 69 + (index - 2) * 9;
            return (
              <g key={`preview-measure-${index}`}>
                <polyline
                  points={`${anchorX},${anchorY} ${anchorX},${labelY} ${labelX + (index % 2 === 0 ? 9 : -3)},${labelY}`}
                  fill="none"
                  stroke={isLightTone ? "rgba(71,85,105,0.44)" : "rgba(255,255,255,0.34)"}
                  strokeWidth="0.22"
                />
                <circle
                  cx={anchorX}
                  cy={anchorY}
                  r="0.42"
                  fill={isLightTone ? "rgba(239,68,68,0.82)" : "rgba(251,191,36,0.92)"}
                />
                <foreignObject x={labelX} y={labelY - 2.6} width="18" height="6">
                  <div
                    style={{ fontFamily: previewFontFamily }}
                    className={[
                      "truncate text-[7px] font-semibold",
                      isLightTone ? "text-slate-600" : "text-white/78",
                    ].join(" ")}
                  >
                    {item}
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
      ) : null}
      {decorationProfile.showHeroRibbon && heroRibbonText ? (
        <div
          className={[
            "pointer-events-none absolute left-0 top-0 rounded-br-[28px] rounded-tl-[12px] border px-4 py-2 shadow-[0_12px_24px_rgba(15,23,42,0.12)]",
            isLightTone
              ? "border-white/90 bg-white/78 text-slate-700"
              : "border-white/18 bg-slate-900/58 text-white/84",
          ].join(" ")}
          style={{ fontFamily: previewFontFamily }}
        >
          <div className="text-[10px] font-black tracking-[0.08em]">{heroRibbonText}</div>
        </div>
      ) : null}
      {decorationProfile.showBottomThumbnailStrip && draft.templateId !== "spec-band" ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 flex gap-3">
          {[18, 50, 82].map((position, index) => (
            <div
              key={`preview-thumb-${index}`}
              className={[
                "relative h-20 flex-1 overflow-hidden rounded-[18px] border shadow-[0_14px_28px_rgba(15,23,42,0.08)]",
                isLightTone
                  ? "border-white/90 bg-white/84"
                  : "border-white/14 bg-slate-900/56",
              ].join(" ")}
            >
              <img
                src={imageUrl}
                alt=""
                className="h-full w-full object-cover opacity-96"
                style={{ objectPosition: `${position}% ${index === 1 ? 30 : 58}%` }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0)_40%,rgba(255,255,255,0.18)_100%)]" />
            </div>
          ))}
        </div>
      ) : null}
      {assistReport && recommendedPanelStyle ? (
        <div
          style={recommendedPanelStyle}
          className={[
            "pointer-events-none absolute rounded-[30px] border-2 border-emerald-400/90 bg-emerald-400/8",
            assistReport.recommendedTemplateId === draft.templateId &&
            assistReport.recommendedTone === draft.tone
              ? "opacity-0"
              : "opacity-100",
          ].join(" ")}
        >
          <div className="absolute left-3 top-3 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm">
            建议位置
          </div>
        </div>
      ) : null}
      <div
        style={panelStyle}
        className={[
          panelShellClassName,
          decorationProfile.compactPanel ? "rounded-[24px]" : "rounded-[30px]",
        ].join(" ")}
      >
        <div
          className={[
            "absolute inset-0",
            decorationProfile.compactPanel ? "rounded-[24px]" : "rounded-[30px]",
            isLightTone
              ? decorationProfile.minimalChrome
                ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0))]"
                : "bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.78),rgba(255,255,255,0)_48%),linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0))]"
              : decorationProfile.minimalChrome
                ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0))]"
                : "bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),rgba(255,255,255,0)_42%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0))]",
          ].join(" ")}
        />
        {decorationProfile.cornerStamp ? (
          <div
            className={[
              "absolute right-4 top-4 rounded-full border px-2.5 py-1 text-[9px] font-black tracking-[0.18em]",
              isLightTone
                ? "border-slate-200/90 bg-white/88 text-slate-500"
                : "border-white/12 bg-white/8 text-white/62",
            ].join(" ")}
            style={{ fontFamily: previewFontFamily }}
          >
            {decorationProfile.cornerStamp}
          </div>
        ) : null}
        {decorationProfile.showAnnotationRail ? (
          <div
            className={[
              "absolute bottom-4 top-14 flex w-5 flex-col items-center justify-between",
              draft.templateId === "hero-right" ? "left-3" : "right-3",
            ].join(" ")}
          >
            <span className={isLightTone ? "h-full w-px bg-slate-300/80" : "h-full w-px bg-white/20"} />
            {[0, 1, 2].map((dot) => (
              <span
                key={`overlay-rail-dot-${dot}`}
                className={[
                  "absolute h-2.5 w-2.5 rounded-full border",
                  dot === 0 ? "top-[8%]" : dot === 1 ? "top-[46%]" : "top-[82%]",
                  isLightTone
                    ? "border-white bg-orange-500 shadow-[0_0_0_3px_rgba(255,255,255,0.72)]"
                    : "border-slate-950 bg-amber-300 shadow-[0_0_0_3px_rgba(15,23,42,0.35)]",
                ].join(" ")}
              />
            ))}
          </div>
        ) : null}
        <div
          className={[
            "absolute inset-[1px]",
            decorationProfile.compactPanel ? "rounded-[23px]" : "rounded-[29px]",
            isLightTone
              ? "border border-white/60"
              : "border border-white/10",
          ].join(" ")}
        />
        <div
          className={[
            "relative z-10 flex h-full flex-col",
            draft.textAlign === "center"
              ? "items-center text-center"
              : draft.textAlign === "right"
                ? "items-end text-right"
                : "items-start text-left",
          ].join(" ")}
        >
          {decorationProfile.showHeaderMeta &&
          (semanticMeta.roleLabel || semanticMeta.headerMetaText) ? (
            <div
              className={[
                "w-full text-[10px] font-semibold",
                decorationProfile.compactPanel ? "pb-1.5" : "border-b pb-2",
                isLightTone
                  ? "border-slate-200/80 text-slate-600"
                  : "border-white/10 text-white/72",
              ].join(" ")}
              style={{ fontFamily: previewFontFamily }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2">
                  <span
                    className={[
                      "h-[2px] w-5 rounded-full",
                      isLightTone ? "bg-orange-500" : "bg-amber-300/90",
                    ].join(" ")}
                  />
                  <span className="uppercase tracking-[0.16em]">{semanticMeta.roleLabel}</span>
                </div>
                {semanticMeta.headerMetaText ? (
                  <span className={isLightTone ? "text-slate-400" : "text-white/45"}>
                    {semanticMeta.headerMetaText}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
          {orderedLayers.map((layer) => (
            <React.Fragment key={`${draft.targetUrl}-${layer.kind}`}>
              {renderPreviewLayer(layer.kind)}
            </React.Fragment>
          ))}
          {draft.fontLabel.trim() ? (
            <span
              className={[
                "mt-3 inline-flex rounded-full border px-2.5 py-1 text-[9px] font-medium",
                isLightTone
                  ? "border-slate-200 bg-white/72 text-slate-500"
                  : "border-white/10 bg-white/6 text-white/52",
              ].join(" ")}
              style={{ fontFamily: previewFontFamily }}
            >
              字体：{draft.fontLabel.trim()}
            </span>
          ) : null}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-dashed border-white/35" />
    </div>
  );
};

type PlanGroupAccent = {
  shell: string;
  header: string;
  badge: string;
  line: string;
  itemBg: string;
  itemBorder: string;
};

const PLAN_GROUP_ACCENTS: PlanGroupAccent[] = [
  {
    shell: "border-sky-200 bg-sky-50/40",
    header: "border-sky-200 bg-sky-50/80",
    badge: "bg-sky-600 text-white",
    line: "border-sky-200",
    itemBg: "bg-white",
    itemBorder: "border-sky-100",
  },
  {
    shell: "border-emerald-200 bg-emerald-50/40",
    header: "border-emerald-200 bg-emerald-50/80",
    badge: "bg-emerald-600 text-white",
    line: "border-emerald-200",
    itemBg: "bg-white",
    itemBorder: "border-emerald-100",
  },
  {
    shell: "border-violet-200 bg-violet-50/35",
    header: "border-violet-200 bg-violet-50/75",
    badge: "bg-violet-600 text-white",
    line: "border-violet-200",
    itemBg: "bg-white",
    itemBorder: "border-violet-100",
  },
  {
    shell: "border-amber-200 bg-amber-50/40",
    header: "border-amber-200 bg-amber-50/80",
    badge: "bg-amber-600 text-white",
    line: "border-amber-200",
    itemBg: "bg-white",
    itemBorder: "border-amber-100",
  },
];

const getPlanGroupAccent = (index: number) =>
  PLAN_GROUP_ACCENTS[index % PLAN_GROUP_ACCENTS.length];

const summarizeText = (value?: string, max = 90) => {
  const normalized = (value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "暂无内容";
  return normalized.length > max
    ? `${normalized.slice(0, Math.max(0, max - 1))}…`
    : normalized;
};

const normalizePromptText = (value?: string) =>
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

const MAX_SINGLE_JOB_COMPARE_ITEMS = 4;
const QUICK_RATIO_OPTIONS = ECOMMERCE_PLAN_RATIO_OPTIONS;
const PROMPT_REWRITE_BASE_GUIDANCE =
  "请整理成适合 Nano Banana / Gemini 直接执行、也方便继续人工微调的最终中文生图提示词。不要只把画面描述对，要写成旗舰电商级导演指令：先明确这张图唯一的商业任务，再锁定商品主体一致性与品牌识别锚点，让商品第一眼立住，构图有主次和克制留白，背景只服务主体，光线和材质要把品质感真实打出来。整体不能像普通随手场景图，而要像成熟品牌体系里的商品图。";

const summarizeSupplementFieldsForPromptRewrite = (
  fields: EcommerceSupplementField[],
) =>
  fields
    .flatMap((field) => {
      if (field.kind === "image") return [];
      if (Array.isArray(field.value)) {
        const values = field.value
          .map((item) => String(item || "").trim())
          .filter(Boolean);
        return values.length > 0 ? [`${field.label}：${values.join("、")}`] : [];
      }
      const value = String(field.value || "").trim();
      return value ? [`${field.label}：${value}`] : [];
    })
    .join("\n");

const findPlanItemMeta = (
  groups: EcommercePlanGroup[],
  planItemId: string,
): { group: EcommercePlanGroup; item: EcommercePlanGroup["items"][number] } | null => {
  for (const group of groups) {
    const item = group.items.find((candidate) => candidate.id === planItemId);
    if (item) {
      return { group, item };
    }
  }
  return null;
};

const readFilesAsDataUrls = async (files: File[]): Promise<string[]> =>
  Promise.all(
    files.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () =>
            reject(new Error(`读取文件失败：${file.name}`));
          reader.readAsDataURL(file);
        }),
    ),
  );

type EcommerceOneClickCardsState = ReturnType<typeof useEcommerceOneClickState>;
type Props = {
  message: WorkflowUiMessage;
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
    promptLanguage?: EcommercePromptLanguage,
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

export const EcommerceOneClickCards: React.FC<Props> = ({
  message,
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
  const [draftTypes, setDraftTypes] = useState<EcommerceRecommendedType[]>([]);
  const [draftImageAnalyses, setDraftImageAnalyses] = useState<
    EcommerceImageAnalysis[]
  >([]);
  const [draftFields, setDraftFields] = useState<EcommerceSupplementField[]>(
    [],
  );
  const [draftPlanGroups, setDraftPlanGroups] = useState<EcommercePlanGroup[]>(
    [],
  );
  const [collapsedPlanGroupIds, setCollapsedPlanGroupIds] = useState<
    Record<string, boolean>
  >({});
  const [planFocusGroupId, setPlanFocusGroupId] = useState<string | null>(null);
  const [planViewMode, setPlanViewMode] = useState<PlanViewMode>("all");
  const [expandedTypeDetailIds, setExpandedTypeDetailIds] = useState<
    Record<string, boolean>
  >({});
  const [analysisFeedback, setAnalysisFeedback] = useState("");
  const [isSubmittingAnalysisFeedback, setIsSubmittingAnalysisFeedback] =
    useState(false);
  const [isSavingTypes, setIsSavingTypes] = useState(false);
  const [isSavingSupplements, setIsSavingSupplements] = useState(false);
  const [isSavingImageAnalyses, setIsSavingImageAnalyses] = useState(false);
  const [isAutofillingImageAnalyses, setIsAutofillingImageAnalyses] =
    useState(false);
  const [retryingImageAnalysisId, setRetryingImageAnalysisId] = useState<
    string | null
  >(null);
  const [isSavingPlans, setIsSavingPlans] = useState(false);
  const [isAutofillingPlans, setIsAutofillingPlans] = useState(false);
  const [lockingModelId, setLockingModelId] = useState<string | null>(null);
  const [isRunningBatchGenerate, setIsRunningBatchGenerate] = useState(false);
  const [isPreparingBatchPrompts, setIsPreparingBatchPrompts] = useState(false);
  const [isRetryingFailedBatch, setIsRetryingFailedBatch] = useState(false);
  const [batchPromptDrafts, setBatchPromptDrafts] = useState<
    Record<string, string>
  >({});
  const [batchPromptFeedbackDrafts, setBatchPromptFeedbackDrafts] = useState<
    Record<string, string>
  >({});
  const [batchPromptRewriteDialog, setBatchPromptRewriteDialog] = useState<{
    jobId: string;
    planItemId: string;
    title: string;
    feedback: string;
  } | null>(null);
  const [batchPromptQuickEditDialog, setBatchPromptQuickEditDialog] = useState<{
    jobId: string;
    planItemId: string;
    title: string;
    prompt: string;
    feedback: string;
    sourceResultLabel?: string;
  } | null>(null);
  const [batchPromptRewriteMessages, setBatchPromptRewriteMessages] = useState<
    Record<string, { tone: "success" | "error"; text: string }>
  >({});
  const [jobCompareSelections, setJobCompareSelections] = useState<
    Record<string, string[]>
  >({});
  const [jobShowHistoricalResults, setJobShowHistoricalResults] = useState<
    Record<string, boolean>
  >({});
  const [preparingPromptPlanItemId, setPreparingPromptPlanItemId] = useState<
    string | null
  >(null);
  const [rewritingPlanItemId, setRewritingPlanItemId] = useState<string | null>(
    null,
  );
  const [rewriteDialog, setRewriteDialog] = useState<{
    groupId: string;
    itemId: string;
    title: string;
    feedback: string;
  } | null>(null);
  const [generatingPlanItemId, setGeneratingPlanItemId] = useState<
    string | null
  >(null);
  const [aiAddingGroupId, setAiAddingGroupId] = useState<string | null>(null);
  const [modelLanguageDrafts, setModelLanguageDrafts] = useState<
    Record<string, EcommercePromptLanguage>
  >({});
  const [customFieldDrafts, setCustomFieldDrafts] = useState<
    Record<string, string>
  >({});
  const [supplementValidationError, setSupplementValidationError] = useState<
    string | null
  >(null);
  const [supplementAutofillMessage, setSupplementAutofillMessage] = useState<
    string | null
  >(null);
  const [imageAnalysisAutofillMessage, setImageAnalysisAutofillMessage] =
    useState<string | null>(null);
  const [planAutofillMessage, setPlanAutofillMessage] = useState<string | null>(
    null,
  );
  const [overlayEditorDraft, setOverlayEditorDraft] =
    useState<OverlayEditorDraft | null>(null);
  const [isSavingOverlayDraft, setIsSavingOverlayDraft] = useState(false);
  const [isApplyingOverlay, setIsApplyingOverlay] = useState(false);
  const [isExportingOverlayVariants, setIsExportingOverlayVariants] =
    useState(false);
  const [isExportingSelectedOverlayVariants, setIsExportingSelectedOverlayVariants] =
    useState(false);
  const [quickExportingOverlayResultUrl, setQuickExportingOverlayResultUrl] =
    useState<string | null>(null);
  const [isUploadingOverlayFont, setIsUploadingOverlayFont] = useState(false);
  const [isUploadingOverlayIcon, setIsUploadingOverlayIcon] = useState(false);
  const [overlayEditorMessage, setOverlayEditorMessage] = useState<string | null>(
    null,
  );
  const [overlayBrandPresets, setOverlayBrandPresets] = useState<
    EcommerceOverlayBrandPreset[]
  >([]);
  const [overlayBrandPresetName, setOverlayBrandPresetName] = useState("");
  const [selectedOverlayBrandPresetId, setSelectedOverlayBrandPresetId] =
    useState<string>("");
  const [selectedOverlayBatchUrls, setSelectedOverlayBatchUrls] = useState<
    string[]
  >([]);
  const [isApplyingOverlayBatch, setIsApplyingOverlayBatch] = useState(false);
  const [isExportingOverlayBatchZip, setIsExportingOverlayBatchZip] =
    useState(false);
  const [overlayAssistSurface, setOverlayAssistSurface] =
    useState<EcommerceOverlayAssistSurface | null>(null);
  const [overlayAssistLoading, setOverlayAssistLoading] = useState(false);
  const [overlayAssistError, setOverlayAssistError] = useState<string | null>(null);
  const [overlayAssistReport, setOverlayAssistReport] =
    useState<EcommerceOverlayAssistReport | null>(null);
  const [highlightedAutofilledSupplementIds, setHighlightedAutofilledSupplementIds] =
    useState<string[]>([]);
  const [highlightedAutofilledImageIds, setHighlightedAutofilledImageIds] =
    useState<string[]>([]);
  const [highlightedAutofilledPlanGroupIds, setHighlightedAutofilledPlanGroupIds] =
    useState<string[]>([]);
  const [highlightedAutofilledPlanItemIds, setHighlightedAutofilledPlanItemIds] =
    useState<string[]>([]);
  const [navigatedPlanGroupId, setNavigatedPlanGroupId] = useState<string | null>(null);
  const [highlightedMissingSupplementIds, setHighlightedMissingSupplementIds] =
    useState<string[]>([]);
  const [isAutofillingSupplements, setIsAutofillingSupplements] =
    useState(false);
  const supplementFieldRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastSyncedTypesSignatureRef = useRef<string | null>(null);
  const lastSyncedImageAnalysesSignatureRef = useRef<string | null>(null);
  const lastSyncedSupplementsSignatureRef = useRef<string | null>(null);
  const lastSyncedPlansSignatureRef = useRef<string | null>(null);
  const lastSyncedModelLockSignatureRef = useRef<string | null>(null);
  const pendingNavigatePlanGroupIdRef = useRef<string | null>(null);
  const navigateHighlightTimerRef = useRef<number | null>(null);
  const overlayFontInputRef = useRef<HTMLInputElement | null>(null);
  const overlayIconInputRef = useRef<HTMLInputElement | null>(null);
  const resultCountByPlanItem = state.batchJobs.reduce<Record<string, number>>(
    (acc, job) => ({ ...acc, [job.planItemId]: (job.results || []).length }),
    {},
  );
  const preferredResultUrl = state.results[0]?.url || null;
  const aiDirectImageAnalysisCount = draftImageAnalyses.filter(
    (item) => item.source === "ai" && !item.usedFallback,
  ).length;
  const mixedImageAnalysisCount = draftImageAnalyses.filter(
    (item) => item.source === "ai" && item.usedFallback,
  ).length;
  const fallbackImageAnalysisCount = draftImageAnalyses.filter(
    (item) => item.source === "fallback",
  ).length;
  const aiDirectRecommendedTypeCount = draftTypes.filter(
    (item) => item.source === "ai" && !item.usedFallback,
  ).length;
  const mixedRecommendedTypeCount = draftTypes.filter(
    (item) => item.source === "ai" && item.usedFallback,
  ).length;
  const fallbackRecommendedTypeCount = draftTypes.filter(
    (item) => item.source === "fallback",
  ).length;
  const aiDirectPlanGroupCount = draftPlanGroups.filter(
    (group) => group.source === "ai" && !group.usedFallback,
  ).length;
  const mixedPlanGroupCount = draftPlanGroups.filter(
    (group) => group.source === "ai" && group.usedFallback,
  ).length;
  const fallbackPlanGroupCount = draftPlanGroups.filter(
    (group) => group.source === "fallback",
  ).length;
  const planPriorityGroupIds = useMemo(() => {
    const highPriorityIds = draftPlanGroups
      .filter((group) => group.priority === "high")
      .map((group) => group.typeId);
    const fallbackIds =
      highPriorityIds.length > 0
        ? highPriorityIds
        : draftPlanGroups
            .slice(0, Math.min(3, draftPlanGroups.length))
            .map((group) => group.typeId);
    return new Set(fallbackIds);
  }, [draftPlanGroups]);
  const planProblemGroupIds = useMemo(
    () =>
      new Set(
        draftPlanGroups
          .filter((group) => {
            const groupResultCount = group.items.reduce(
              (sum, item) => sum + (resultCountByPlanItem[item.id] || 0),
              0,
            );
            return (
              group.items.length < PLAN_ITEM_BASELINE_COUNT ||
              !group.strategy?.length ||
              (group.priority === "high" && groupResultCount === 0)
            );
          })
          .map((group) => group.typeId),
      ),
    [draftPlanGroups, resultCountByPlanItem],
  );
  const visiblePlanGroups = useMemo(() => {
    if (planFocusGroupId) {
      return draftPlanGroups.filter((group) => group.typeId === planFocusGroupId);
    }
    if (planViewMode === "priority") {
      return draftPlanGroups.filter((group) => planPriorityGroupIds.has(group.typeId));
    }
    if (planViewMode === "problem") {
      return draftPlanGroups.filter((group) => planProblemGroupIds.has(group.typeId));
    }
    return draftPlanGroups;
  }, [
    draftPlanGroups,
    planFocusGroupId,
    planPriorityGroupIds,
    planProblemGroupIds,
    planViewMode,
  ]);
  const visiblePlanItemCount = visiblePlanGroups.reduce(
    (sum, group) => sum + group.items.length,
    0,
  );
  const planPriorityGroupCount = planPriorityGroupIds.size;
  const planProblemGroupCount = planProblemGroupIds.size;
  const activeEditingResult =
    state.overlayPanelOpen && state.editingResultUrl
      ? state.results.find((result) => result.url === state.editingResultUrl) || null
      : null;

  useEffect(() => {
    if (!state.overlayPanelOpen || !activeEditingResult) {
      setOverlayEditorDraft(null);
      return;
    }

    setOverlayEditorDraft((current) => {
      if (
        current?.targetUrl === activeEditingResult.url &&
        current.templateId ===
          (activeEditingResult.overlayState?.templateId ||
            (state.preferredOverlayTemplateId as
              | OverlayEditorDraft["templateId"]
              | null) ||
            "hero-left") &&
        current.headline ===
          (activeEditingResult.overlayState?.headline || current.headline) &&
        current.fontLabel ===
          (activeEditingResult.overlayState?.fontLabel || current.fontLabel) &&
        current.fontUrl ===
          (activeEditingResult.overlayState?.fontUrl || current.fontUrl) &&
        current.featureTagIconUrl ===
          (activeEditingResult.overlayState?.featureTagIconUrl ||
            current.featureTagIconUrl)
      ) {
        return current;
      }

      return buildOverlayDraftState(
        activeEditingResult,
        state.preferredOverlayTemplateId,
      );
    });
  }, [
    activeEditingResult,
    state.overlayPanelOpen,
    state.preferredOverlayTemplateId,
  ]);

  const getOverlayLayerEditorSectionClassName = (
    kinds: EcommerceOverlayLayerKind[],
  ) =>
    [
      "rounded-xl border px-3 py-3 transition",
      overlayEditorDraft &&
      kinds.includes(overlayEditorDraft.activeLayerKind)
        ? "border-blue-300 bg-blue-50/40 shadow-[0_0_0_1px_rgba(59,130,246,0.08)]"
        : "border-slate-200 bg-slate-50/50",
    ].join(" ");

  const handleApplyOverlayAssistSuggestion = () => {
    if (!overlayAssistReport) return;
    setOverlayEditorDraft((current) =>
      current
        ? {
            ...current,
            templateId: overlayAssistReport.recommendedTemplateId,
            textAlign: overlayAssistReport.recommendedTextAlign,
            tone: overlayAssistReport.recommendedTone,
            bulletStyle: overlayAssistReport.recommendedBulletStyle,
            stylePresetId: "",
          }
        : current,
    );
    setOverlayEditorMessage(
      `已应用建议位置：${overlayAssistReport.recommendedZoneLabel}。`,
    );
  };

  useEffect(() => {
    if (!state.overlayPanelOpen || !activeEditingResult?.url) {
      setOverlayAssistSurface(null);
      setOverlayAssistReport(null);
      setOverlayAssistError(null);
      setOverlayAssistLoading(false);
      return;
    }

    let cancelled = false;
    setOverlayAssistLoading(true);
    setOverlayAssistError(null);

    prepareOverlayAssistSurface(activeEditingResult.url)
      .then((surface) => {
        if (cancelled) return;
        setOverlayAssistSurface(surface);
      })
      .catch((error) => {
        if (cancelled) return;
        setOverlayAssistSurface(null);
        setOverlayAssistReport(null);
        setOverlayAssistError(
          error instanceof Error
            ? error.message
            : "智能排版分析暂时不可用。",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setOverlayAssistLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeEditingResult?.url, state.overlayPanelOpen]);

  useEffect(() => {
    if (!overlayEditorDraft || !overlayAssistSurface) {
      setOverlayAssistReport(null);
      return;
    }
    const report = buildOverlayAssistReport({
      surface: overlayAssistSurface,
      currentTemplateId: overlayEditorDraft.templateId,
      currentTone: overlayEditorDraft.tone,
      layoutMeta: activeEditingResult?.layoutMeta,
      statCount: parseOverlayStats(overlayEditorDraft.statsText).length,
      comparisonCount: parseOverlayComparisonRows(
        overlayEditorDraft.comparisonRowsText,
      ).length,
      hasPrice: Boolean(
        overlayEditorDraft.priceLabel.trim() ||
          overlayEditorDraft.priceValue.trim() ||
          overlayEditorDraft.priceNote.trim(),
      ),
      headlineLength: overlayEditorDraft.headline.trim().length,
      subheadlineLength: overlayEditorDraft.subheadline.trim().length,
      bulletCount: parseOverlayBullets(overlayEditorDraft.bulletsText).length,
    });
    setOverlayAssistReport(report);
  }, [
    activeEditingResult?.layoutMeta,
    overlayAssistSurface,
    overlayEditorDraft,
  ]);

  useEffect(() => {
    setOverlayBrandPresets(loadOverlayBrandPresets());
  }, []);

  useEffect(() => {
    const availableUrls = new Set(state.results.map((item) => item.url));
    setSelectedOverlayBatchUrls((current) =>
      current.filter((url) => availableUrls.has(url)),
    );
  }, [state.results]);

  useEffect(() => {
    if (message.type === "ecomOneClick.imageAnalyses") {
      const signature = JSON.stringify(message.items || []);
      if (lastSyncedImageAnalysesSignatureRef.current !== signature) {
        lastSyncedImageAnalysesSignatureRef.current = signature;
        setDraftImageAnalyses(sanitizeImageAnalysisDrafts(message.items));
        setImageAnalysisAutofillMessage(null);
        setIsAutofillingImageAnalyses(false);
        setHighlightedAutofilledImageIds([]);
      }
    }

    if (message.type === "ecomOneClick.supplements") {
      const signature = JSON.stringify(message.fields || []);
      if (lastSyncedSupplementsSignatureRef.current !== signature) {
        lastSyncedSupplementsSignatureRef.current = signature;
        setDraftFields(ensureStableSupplementDraftFields(message.fields));
        setSupplementValidationError(null);
        setSupplementAutofillMessage(null);
        setHighlightedMissingSupplementIds([]);
        setHighlightedAutofilledSupplementIds([]);
        setIsAutofillingSupplements(false);
        setCustomFieldDrafts({});
      }
    }

    if (message.type === "ecomOneClick.plans") {
      const signature = JSON.stringify(message.groups || []);
      if (lastSyncedPlansSignatureRef.current !== signature) {
        lastSyncedPlansSignatureRef.current = signature;
        setDraftPlanGroups(message.groups);
        setCollapsedPlanGroupIds((prev) => {
          const next: Record<string, boolean> = {};
          (message.groups || []).forEach((group) => {
            next[group.typeId] = prev[group.typeId] || false;
          });
          return next;
        });
        setPlanFocusGroupId((prev) =>
          prev && (message.groups || []).some((group) => group.typeId === prev)
            ? prev
            : null,
        );
        setPlanAutofillMessage(null);
        setIsAutofillingPlans(false);
        setHighlightedAutofilledPlanGroupIds([]);
        setHighlightedAutofilledPlanItemIds([]);
      }
    }

    if (message.type === "ecomOneClick.modelLock") {
      const signature = JSON.stringify({
        selectedModelId: message.selectedModelId,
        models: message.models.map((model) => ({
          id: model.id,
          promptLanguage: model.promptLanguage,
        })),
      });
      if (lastSyncedModelLockSignatureRef.current !== signature) {
        lastSyncedModelLockSignatureRef.current = signature;
        setModelLanguageDrafts(
          Object.fromEntries(
            message.models.map((model) => [model.id, model.promptLanguage]),
          ),
        );
      }
    }

    if (message.type === "ecomOneClick.types") {
      const signature = JSON.stringify(message.items || []);
      if (lastSyncedTypesSignatureRef.current !== signature) {
        lastSyncedTypesSignatureRef.current = signature;
        setDraftTypes(message.items);
      }
    }

    if (message.type === "ecomOneClick.batch") {
      setBatchPromptDrafts((prev) => {
        const next: Record<string, string> = {};
        message.jobs.forEach((job) => {
          const previous = prev[job.planItemId];
          next[job.planItemId] =
            typeof previous === "string" && previous.trim().length > 0
              ? previous
              : job.finalPrompt ?? "";
        });
        return next;
      });
    }
  }, [message]);

  useEffect(() => {
    if (message.type !== "ecomOneClick.types") return;
    setExpandedTypeDetailIds((prev) => {
      const next: Record<string, boolean> = {};
      message.items.forEach((item) => {
        next[item.id] = prev[item.id] || false;
      });
      return next;
    });
  }, [message]);

  useEffect(() => {
    setCollapsedPlanGroupIds((prev) => {
      const next: Record<string, boolean> = {};
      draftPlanGroups.forEach((group) => {
        next[group.typeId] = prev[group.typeId] || false;
      });
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (
        prevKeys.length === nextKeys.length &&
        nextKeys.every((key) => prev[key] === next[key])
      ) {
        return prev;
      }
      return next;
    });
    setPlanFocusGroupId((prev) =>
      prev && draftPlanGroups.some((group) => group.typeId === prev)
        ? prev
        : null,
    );
  }, [draftPlanGroups]);

  useEffect(() => {
    const handleNavigate = (event: Event) => {
      const detail = (event as CustomEvent<{ groupId?: string }>).detail;
      const groupId = String(detail?.groupId || "").trim();
      if (!groupId) {
        return;
      }

      pendingNavigatePlanGroupIdRef.current = groupId;
      setPlanFocusGroupId(null);
      setCollapsedPlanGroupIds((prev) => ({
        ...prev,
        [groupId]: false,
      }));
      setNavigatedPlanGroupId(groupId);

      if (navigateHighlightTimerRef.current) {
        window.clearTimeout(navigateHighlightTimerRef.current);
      }
      navigateHighlightTimerRef.current = window.setTimeout(() => {
        setNavigatedPlanGroupId((current) => (current === groupId ? null : current));
      }, 2600);
    };

    window.addEventListener(ECOMMERCE_PLAN_GROUP_NAVIGATE_EVENT, handleNavigate);
    return () => {
      window.removeEventListener(
        ECOMMERCE_PLAN_GROUP_NAVIGATE_EVENT,
        handleNavigate,
      );
      if (navigateHighlightTimerRef.current) {
        window.clearTimeout(navigateHighlightTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const groupId = pendingNavigatePlanGroupIdRef.current;
    if (!groupId || !draftPlanGroups.some((group) => group.typeId === groupId)) {
      return;
    }

    requestAnimationFrame(() => {
      const target = document.getElementById(buildEcommercePlanGroupAnchorId(groupId));
      if (!target) {
        return;
      }
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      pendingNavigatePlanGroupIdRef.current = null;
    });
  }, [draftPlanGroups, planFocusGroupId, collapsedPlanGroupIds]);

  useEffect(() => {
    const currentMissingIds = draftFields
      .filter(
        (field) =>
          isBlockingSupplementField(field) && !isSupplementFieldAnswered(field),
      )
      .map((field) => field.id);

    setHighlightedMissingSupplementIds((prev) => {
      const next = prev.filter((id) => currentMissingIds.includes(id));
      return next.length === prev.length &&
        next.every((item, index) => item === prev[index])
        ? prev
        : next;
    });

    if (supplementValidationError && currentMissingIds.length === 0) {
      setSupplementValidationError(null);
    }
  }, [draftFields, supplementValidationError]);

  const updateDraftField = (
    fieldId: string,
    updater: (field: EcommerceSupplementField) => EcommerceSupplementField,
  ) =>
    setDraftFields((prev) =>
      prev.map((field) => (field.id === fieldId ? updater(field) : field)),
    );
  const updateDraftFieldAsUser = (
    fieldId: string,
    updater: (field: EcommerceSupplementField) => EcommerceSupplementField,
  ) => {
    setHighlightedAutofilledSupplementIds((prev) =>
      prev.filter((id) => id !== fieldId),
    );
    updateDraftField(fieldId, (field) => {
      const next = updater(field);
      return {
        ...next,
        valueSource: "user",
        valueConfidence: undefined,
        valueNote: undefined,
      };
    });
  };
  const setCustomFieldDraft = (fieldId: string, value: string) =>
    setCustomFieldDrafts((prev) => ({ ...prev, [fieldId]: value }));
  const toggleTypeDetail = (typeId: string) =>
    setExpandedTypeDetailIds((prev) => ({
      ...prev,
      [typeId]: !prev[typeId],
    }));
  const scrollToSupplementField = (fieldId: string) => {
    requestAnimationFrame(() => {
      const container = supplementFieldRefs.current[fieldId];
      if (!container) return;
      container.scrollIntoView({ behavior: "smooth", block: "center" });
      const target = container.querySelector<
        HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement
      >(
        'input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      target?.focus();
    });
  };
  const applyCustomFieldValue = (field: EcommerceSupplementField) => {
    const customValue = (customFieldDrafts[field.id] || "").trim();
    if (!customValue) return;

    updateDraftFieldAsUser(field.id, (current) => {
      const nextOptions = Array.from(
        new Set([...(current.options || []), customValue]),
      );

      if (current.kind === "single-select") {
        return {
          ...current,
          options: nextOptions,
          value: customValue,
        };
      }

      if (current.kind === "multi-select") {
        const currentValues = Array.isArray(current.value) ? current.value : [];
        return {
          ...current,
          options: nextOptions,
          value: Array.from(new Set([...currentValues, customValue])),
        };
      }

      return current;
    });

    setCustomFieldDraft(field.id, "");
  };
  const updateImageAnalysis = (
    imageId: string,
    updater: (item: EcommerceImageAnalysis) => EcommerceImageAnalysis,
  ) =>
    setDraftImageAnalyses((prev) =>
      prev.map((item) => (item.imageId === imageId ? updater(item) : item)),
    );
  const updatePlanItem = (
    groupId: string,
    itemId: string,
    updater: (
      item: EcommercePlanGroup["items"][number],
    ) => EcommercePlanGroup["items"][number],
  ) =>
    setDraftPlanGroups((prev) =>
      prev.map((group) =>
        group.typeId !== groupId
          ? group
          : {
              ...group,
              items: group.items.map((item) =>
                item.id === itemId ? updater(item) : item,
              ),
            },
      ),
    );
  const removePlanItem = (groupId: string, itemId: string) =>
    setDraftPlanGroups((prev) =>
      prev
        .map((group) =>
          group.typeId !== groupId
            ? group
            : {
                ...group,
                items: group.items.filter((item) => item.id !== itemId),
              },
        )
        .filter((group) => group.items.length > 0),
    );
  const createManualPlanItem = (
    groupId: string,
    groupTitle: string,
    sequence: number,
  ) => ({
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: `${groupTitle} 图${sequence}`,
    description: "请补充这张图的目标人群、画面内容、构图方式与卖点表达。",
    promptOutline: "请先完成镜头规划，生图提示词在批量生成阶段统一生成。",
    ratio: getDefaultEcommercePlanRatio({
      platformMode: state.platformMode,
      typeId: groupId,
      typeTitle: groupTitle,
    }),
    referenceImageIds: [],
    status: "draft" as const,
  });
  const addPlanItems = (groupId: string, count = 1) =>
    setDraftPlanGroups((prev) =>
      prev.map((group) => {
        if (group.typeId !== groupId) return group;
        const safeCount = Math.max(1, Math.floor(count));
        const startIndex = group.items.length + 1;
        const appended = Array.from({ length: safeCount }, (_, index) =>
          createManualPlanItem(group.typeId, group.typeTitle, startIndex + index),
        );
        return {
          ...group,
          items: [...group.items, ...appended],
        };
      }),
    );
  const addPlanItem = (groupId: string) => addPlanItems(groupId, 1);
  const togglePlanGroupCollapsed = (groupId: string) =>
    setCollapsedPlanGroupIds((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  const collapseAllPlanGroups = () =>
    setCollapsedPlanGroupIds(
      Object.fromEntries(draftPlanGroups.map((group) => [group.typeId, true])),
    );
  const expandAllPlanGroups = () =>
    setCollapsedPlanGroupIds(
      Object.fromEntries(draftPlanGroups.map((group) => [group.typeId, false])),
    );
  const togglePlanFocusGroup = (groupId: string) =>
    setPlanFocusGroupId((prev) => (prev === groupId ? null : groupId));

  const handleRewritePlanPrompt = async (
    groupId: string,
    itemId: string,
    feedback?: string,
  ) => {
    if (!onRewritePlanPrompt) return;
    setRewritingPlanItemId(itemId);
    try {
      const rewritten = await onRewritePlanPrompt(
        draftPlanGroups,
        itemId,
        feedback,
      );
      if (rewritten)
        updatePlanItem(groupId, itemId, (current) => ({
          ...current,
          promptOutline: rewritten,
          status: "ready",
        }));
    } finally {
      setRewritingPlanItemId(null);
    }
  };

  const handleGeneratePlanItem = async (itemId: string) => {
    if (!onGeneratePlanItem) return;
    setGeneratingPlanItemId(itemId);
    try {
      await onGeneratePlanItem(draftPlanGroups, itemId);
    } finally {
      setGeneratingPlanItemId(null);
    }
  };

  const handleGenerateExtraPlanItem = async (groupId: string) => {
    if (!onGenerateExtraPlanItem) return;
    setAiAddingGroupId(groupId);
    try {
      await onGenerateExtraPlanItem(draftPlanGroups, groupId);
    } finally {
      setAiAddingGroupId(null);
    }
  };

  const handleSupplementImagePick = async (
    field: EcommerceSupplementField,
    files: FileList | null,
  ) => {
    if (!files || files.length === 0) return;
    const nextFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (nextFiles.length === 0) return;

    const uploaded = await readFilesAsDataUrls(nextFiles);
    updateDraftFieldAsUser(field.id, (current) => {
      const currentValues = Array.isArray(current.value) ? current.value : [];
      const maxItems = current.maxItems || 6;
      return {
        ...current,
        value: [...currentValues, ...uploaded].slice(0, maxItems),
      };
    });
  };

  const handleSubmitAnalysisFeedback = async () => {
    const trimmedFeedback = analysisFeedback.trim();
    if (!trimmedFeedback || !onRefineAnalysis || isSubmittingAnalysisFeedback) {
      return;
    }

    setIsSubmittingAnalysisFeedback(true);
    try {
      await onRefineAnalysis(trimmedFeedback);
      setAnalysisFeedback("");
    } finally {
      setIsSubmittingAnalysisFeedback(false);
    }
  };

  const handleConfirmTypesAction = async () => {
    if (!onConfirmTypes || isSavingTypes) return;
    setIsSavingTypes(true);
    try {
      await onConfirmTypes(draftTypes);
    } finally {
      setIsSavingTypes(false);
    }
  };

  const handleConfirmSupplementsAction = async () => {
    if (
      !onConfirmSupplements ||
      isSavingSupplements ||
      isAutofillingSupplements
    ) {
      return;
    }

    if (state.workflowMode === "professional" && pendingRequiredFields.length > 0) {
      setSupplementAutofillMessage(null);
      setHighlightedMissingSupplementIds(
        pendingRequiredFields.map((field) => field.id),
      );
      setSupplementValidationError(
        `当前还有 ${pendingRequiredFields.length} 个关键项未完成：${pendingRequiredFields
          .slice(0, 4)
          .map((field) => field.label)
          .join("、")}${pendingRequiredFields.length > 4 ? " 等" : ""}。请先补齐，或先点击“AI 帮我补可推断项”。`,
      );
      scrollToSupplementField(pendingRequiredFields[0].id);
      return;
    }

    setSupplementValidationError(null);
    setHighlightedMissingSupplementIds([]);
    setIsSavingSupplements(true);
    try {
      await onConfirmSupplements(draftFields);
      setSupplementAutofillMessage(null);
    } catch (error) {
      setSupplementValidationError(
        error instanceof Error
          ? error.message
          : "保存补充信息失败，请稍后重试。",
      );
    } finally {
      setIsSavingSupplements(false);
    }
  };

  const handleAutofillSupplementsAction = async () => {
    if (
      !onAutofillSupplements ||
      isAutofillingSupplements ||
      isSavingSupplements
    ) {
      return;
    }

    const previousFields = draftFields;
    setSupplementValidationError(null);
    setSupplementAutofillMessage(null);
    setHighlightedAutofilledSupplementIds([]);
    setIsAutofillingSupplements(true);

    try {
      const nextFields = await onAutofillSupplements(previousFields);
      if (!nextFields || nextFields.length === 0) {
        setSupplementAutofillMessage(
          "AI 这次没有补出新的可推断信息，建议你手动补充关键项。",
        );
        return;
      }

      const stableNextFields = ensureStableSupplementDraftFields(nextFields);
      const changedFieldIds = stableNextFields
        .filter((field) => {
          const before = previousFields.find((item) => item.id === field.id);
          return before
            ? didSupplementFieldChange(before, field) ||
                didSupplementFieldMetaChange(before, field)
            : false;
        })
        .map((field) => field.id);
      setDraftFields(stableNextFields);
      setHighlightedAutofilledSupplementIds(changedFieldIds);

      const beforeById = new Map(previousFields.map((field) => [field.id, field]));
      const autofilledCount = stableNextFields.filter((field) => {
        const before = beforeById.get(field.id);
        return (
          before &&
          !isSupplementFieldAnswered(before) &&
          isSupplementFieldAnswered(field)
        );
      }).length;
      const remainingRequired = stableNextFields.filter(
        (field) =>
          isBlockingSupplementField(field) && !isSupplementFieldAnswered(field),
      );
      const estimatedCount = stableNextFields.filter(
        (field) =>
          changedFieldIds.includes(field.id) && field.valueSource === "estimated",
      ).length;

      setHighlightedMissingSupplementIds(
        remainingRequired.map((field) => field.id),
      );

      if (autofilledCount > 0) {
        setSupplementAutofillMessage(
          remainingRequired.length > 0
            ? `AI 已补全 ${autofilledCount} 项${
                estimatedCount > 0 ? `，其中 ${estimatedCount} 项为估填` : ""
              }，仍有 ${remainingRequired.length} 个关键项建议你确认。`
            : `AI 已补全 ${autofilledCount} 项${
                estimatedCount > 0 ? `，其中 ${estimatedCount} 项为估填` : ""
              }，关键项已补齐，可以继续保存。`,
        );
      } else {
        setSupplementAutofillMessage(
          remainingRequired.length > 0
            ? "AI 这次没有补出新的可推断信息。你可以继续手动补关键项，补图项不影响进入下一步。"
            : "当前没有需要 AI 补填的项目。",
        );
      }

      if (remainingRequired.length > 0) {
        scrollToSupplementField(remainingRequired[0].id);
      }
    } catch (error) {
      setSupplementValidationError(
        error instanceof Error ? error.message : "AI 补全失败，请稍后重试。",
      );
    } finally {
      setIsAutofillingSupplements(false);
    }
  };

  const handleConfirmImageAnalysesAction = async () => {
    if (
      !onConfirmImageAnalyses ||
      isSavingImageAnalyses ||
      isAutofillingImageAnalyses
    ) {
      return;
    }
    setIsSavingImageAnalyses(true);
    try {
      await onConfirmImageAnalyses(draftImageAnalyses);
    } finally {
      setIsSavingImageAnalyses(false);
    }
  };

  const handleAutofillImageAnalysesAction = async () => {
    if (
      !onAutofillImageAnalyses ||
      isAutofillingImageAnalyses ||
      isSavingImageAnalyses
    ) {
      return;
    }
    setImageAnalysisAutofillMessage(null);
    setHighlightedAutofilledImageIds([]);
    setIsAutofillingImageAnalyses(true);
    try {
      const nextItems = await onAutofillImageAnalyses(draftImageAnalyses);
      if (!nextItems || nextItems.length === 0) {
        setImageAnalysisAutofillMessage(
          "AI 这次没有补出新的图片分析内容，当前草稿保持不变。",
        );
        return;
      }
      const changedImageIds = nextItems
        .filter((item) => {
          const before = draftImageAnalyses.find(
            (current) => current.imageId === item.imageId,
          );
          return before ? didImageAnalysisChange(before, item) : false;
        })
        .map((item) => item.imageId);
      setDraftImageAnalyses(nextItems);
      setHighlightedAutofilledImageIds(changedImageIds);
      setImageAnalysisAutofillMessage(
        changedImageIds.length > 0
          ? `AI 已更新 ${changedImageIds.length} 张图的分析内容，蓝色高亮卡片是本轮重点调整项。`
          : "AI 已检查当前图片分析，暂时没有需要调整的内容。",
      );
    } catch (error) {
      setImageAnalysisAutofillMessage(
        error instanceof Error
          ? error.message
          : "AI 图片分析补全失败，请稍后重试。",
      );
    } finally {
      setIsAutofillingImageAnalyses(false);
    }
  };

  const handleRetryImageAnalysisAction = async (imageId: string) => {
    if (!onRetryImageAnalysis || retryingImageAnalysisId) return;
    setRetryingImageAnalysisId(imageId);
    try {
      await onRetryImageAnalysis(imageId);
    } finally {
      setRetryingImageAnalysisId(null);
    }
  };

  const handleConfirmPlansAction = async () => {
    if (!onConfirmPlans || isSavingPlans || isAutofillingPlans) return;
    setIsSavingPlans(true);
    try {
      await onConfirmPlans(draftPlanGroups);
    } finally {
      setIsSavingPlans(false);
    }
  };

  const handleAutofillPlansAction = async () => {
    if (!onAutofillPlans || isAutofillingPlans || isSavingPlans) {
      return;
    }
    setPlanAutofillMessage(null);
    setHighlightedAutofilledPlanGroupIds([]);
    setHighlightedAutofilledPlanItemIds([]);
    setIsAutofillingPlans(true);
    try {
      const nextGroups = await onAutofillPlans(draftPlanGroups);
      if (!nextGroups || nextGroups.length === 0) {
        setPlanAutofillMessage(
          "AI 这次没有补出新的方案内容，当前草稿保持不变。",
        );
        return;
      }
      const changedGroupIds = nextGroups
        .filter((group) => {
          const before = draftPlanGroups.find(
            (current) => current.typeId === group.typeId,
          );
          return before ? didPlanGroupMetaChange(before, group) : false;
        })
        .map((group) => group.typeId);
      const changedItemIds = nextGroups.flatMap((group) =>
        group.items
          .filter((item) => {
            const beforeGroup = draftPlanGroups.find(
              (current) => current.typeId === group.typeId,
            );
            const beforeItem = beforeGroup?.items.find(
              (current) => current.id === item.id,
            );
            return beforeItem ? didPlanItemChange(beforeItem, item) : false;
          })
          .map((item) => item.id),
      );
      setDraftPlanGroups(nextGroups);
      setHighlightedAutofilledPlanGroupIds(changedGroupIds);
      setHighlightedAutofilledPlanItemIds(changedItemIds);
      setPlanAutofillMessage(
        changedGroupIds.length > 0 || changedItemIds.length > 0
          ? `AI 已补强 ${changedGroupIds.length} 个分组、${changedItemIds.length} 条方案，蓝色高亮区域是本轮重点更新内容。`
          : "AI 已检查当前方案草稿，暂时没有需要调整的内容。",
      );
    } catch (error) {
      setPlanAutofillMessage(
        error instanceof Error
          ? error.message
          : "AI 方案补全失败，请稍后重试。",
      );
    } finally {
      setIsAutofillingPlans(false);
    }
  };

  const handleSelectModelAction = async (
    modelId: string,
    promptLanguage?: EcommercePromptLanguage,
  ) => {
    if (!onSelectModel || lockingModelId) return;
    setLockingModelId(modelId);
    try {
      await onSelectModel(modelId, promptLanguage);
    } finally {
      setLockingModelId(null);
    }
  };

  const handleRunBatchGenerateAction = async () => {
    if (!onRunBatchGenerate || isRunningBatchGenerate) return;
    setIsRunningBatchGenerate(true);
    try {
      await onRunBatchGenerate(batchPromptDrafts);
    } finally {
      setIsRunningBatchGenerate(false);
    }
  };

  const handlePrepareBatchPromptsAction = async () => {
    if (!onPrepareBatchPrompts || isPreparingBatchPrompts) return;
    setIsPreparingBatchPrompts(true);
    try {
      await onPrepareBatchPrompts();
    } finally {
      setIsPreparingBatchPrompts(false);
    }
  };

  const handleOpenBatchWorkbenchAction = async () => {
    if (!onOpenBatchWorkbench || isPreparingBatchPrompts || isRunningBatchGenerate) {
      return;
    }
    await onOpenBatchWorkbench();
  };

  const handlePrepareBatchJobGroupAction = async (jobs: EcommerceBatchJob[]) => {
    if (!onRunBatchGenerate || isPreparingBatchPrompts || isRunningBatchGenerate) {
      return;
    }
    const targetPlanItemIds = jobs.map((job) => job.planItemId);
    if (targetPlanItemIds.length === 0) {
      return;
    }
    setIsPreparingBatchPrompts(true);
    try {
      await onRunBatchGenerate(batchPromptDrafts, {
        promptOnly: true,
        targetPlanItemIds,
        preserveExistingResults: true,
      });
    } finally {
      setIsPreparingBatchPrompts(false);
    }
  };

  const handleGenerateBatchJobGroupAction = async (jobs: EcommerceBatchJob[]) => {
    if (!onRunBatchGenerate || isRunningBatchGenerate || isPreparingBatchPrompts) {
      return;
    }
    const targetPlanItemIds = jobs.map((job) => job.planItemId);
    if (targetPlanItemIds.length === 0) {
      return;
    }
    setIsRunningBatchGenerate(true);
    try {
      await onRunBatchGenerate(batchPromptDrafts, {
        targetPlanItemIds,
        preserveExistingResults: true,
      });
    } finally {
      setIsRunningBatchGenerate(false);
    }
  };

  const handlePrepareSingleBatchPromptAction = async (
    job: EcommerceBatchJob,
    feedbackOverride?: string,
    promptOverride?: string,
  ) => {
    if (isPreparingBatchPrompts || isRunningBatchGenerate) {
      return;
    }
    setIsPreparingBatchPrompts(true);
    setPreparingPromptPlanItemId(job.planItemId);
    setBatchPromptRewriteMessages((prev) => {
      const next = { ...prev };
      delete next[job.planItemId];
      return next;
    });
    try {
      const groups = draftPlanGroups.length > 0 ? draftPlanGroups : state.planGroups;
      const planMeta = findPlanItemMeta(groups, job.planItemId);
      const supplementSummary = summarizeSupplementFieldsForPromptRewrite(
        draftFields.length > 0 ? draftFields : state.supplementFields,
      );
      const sourceAnalyses =
        draftImageAnalyses.length > 0 ? draftImageAnalyses : state.imageAnalyses;
      const promptFeedback = String(
        feedbackOverride ?? batchPromptFeedbackDrafts[job.planItemId] ?? "",
      ).trim();
      const effectiveCurrentPrompt = String(
        promptOverride ?? getBatchJobPromptValue(job, batchPromptDrafts),
      ).trim();
      if (typeof feedbackOverride === "string") {
        setBatchPromptFeedbackDrafts((prev) => ({
          ...prev,
          [job.planItemId]: feedbackOverride,
        }));
      }
      if (typeof promptOverride === "string") {
        setBatchPromptDrafts((prev) => ({
          ...prev,
          [job.planItemId]: promptOverride,
        }));
      }
      const rewriteResult = (await executeSkill("ecomRewritePrompt", {
        productDescription: state.description,
        typeTitle: planMeta?.group.typeTitle || job.title,
        planTitle: job.title,
        planDescription: planMeta?.item.description,
        currentPrompt:
          effectiveCurrentPrompt || planMeta?.item.promptOutline || job.prompt,
        supplementSummary: supplementSummary || undefined,
        targetRatio: getDefaultEcommercePlanRatio({
          platformMode: state.platformMode,
          typeId: planMeta?.group.typeId,
          typeTitle: planMeta?.group.typeTitle || job.title,
          itemTitle: planMeta?.item.title || job.title,
          itemDescription: planMeta?.item.description || job.prompt,
          preferredRatio: planMeta?.item.ratio,
        }),
        feedback: promptFeedback
          ? `${PROMPT_REWRITE_BASE_GUIDANCE}\n额外修改方向：${promptFeedback}`
          : PROMPT_REWRITE_BASE_GUIDANCE,
        imageAnalyses: sourceAnalyses
          .filter(
            (item) =>
              !planMeta?.item.referenceImageIds?.length ||
              planMeta.item.referenceImageIds.includes(item.imageId) ||
              item.usableAsReference,
          )
          .slice(0, 3)
          .map((item) => ({
            title: item.title,
            description: item.description,
            analysisConclusion: item.analysisConclusion,
            angle: item.angle,
          })),
      })) as { prompt?: string } | string;

      const nextPrompt =
        typeof rewriteResult === "string"
          ? rewriteResult.trim()
          : typeof rewriteResult?.prompt === "string"
            ? rewriteResult.prompt.trim()
            : "";

      if (!nextPrompt) {
        throw new Error("没有拿到可用的新提示词。");
      }

      setBatchPromptDrafts((prev) => ({
        ...prev,
        [job.planItemId]: nextPrompt,
      }));
      await onSyncBatchPrompt?.(job.planItemId, nextPrompt);
      setBatchPromptRewriteMessages((prev) => ({
        ...prev,
        [job.planItemId]: {
          tone: "success",
          text: promptFeedback
            ? "已按你的修改意见重新生成，可继续微调后再生图。"
            : "提示词已重新生成，可继续微调后再生图。",
        },
      }));
    } catch (error) {
      setBatchPromptRewriteMessages((prev) => ({
        ...prev,
        [job.planItemId]: {
          tone: "error",
          text:
            error instanceof Error && error.message.trim()
              ? error.message.trim()
              : "重新生成提示词失败，请稍后再试。",
        },
      }));
    } finally {
      setPreparingPromptPlanItemId(null);
      setIsPreparingBatchPrompts(false);
    }
  };

  const handleGenerateSingleBatchJobAction = async (
    job: EcommerceBatchJob,
    promptOverride?: string,
  ) => {
    if (!onRunBatchGenerate || isRunningBatchGenerate || isPreparingBatchPrompts) {
      return;
    }
    if (typeof promptOverride === "string") {
      setBatchPromptDrafts((prev) => ({
        ...prev,
        [job.planItemId]: promptOverride,
      }));
    }
    setIsRunningBatchGenerate(true);
    try {
      const effectivePrompt =
        typeof promptOverride === "string"
          ? promptOverride
          : getBatchJobPromptValue(job, batchPromptDrafts);
      await onRunBatchGenerate(
        {
          ...batchPromptDrafts,
          [job.planItemId]: effectivePrompt,
        },
        {
          targetPlanItemIds: [job.planItemId],
          preserveExistingResults: true,
        },
      );
    } finally {
      setIsRunningBatchGenerate(false);
    }
  };

  const handleSaveBatchPromptQuickEdit = async () => {
    if (!batchPromptQuickEditDialog) return;
    const { planItemId, prompt, feedback } = batchPromptQuickEditDialog;
    setBatchPromptDrafts((prev) => ({
      ...prev,
      [planItemId]: prompt,
    }));
    setBatchPromptFeedbackDrafts((prev) => ({
      ...prev,
      [planItemId]: feedback,
    }));
    await onSyncBatchPrompt?.(planItemId, prompt);
    setBatchPromptRewriteMessages((prev) => ({
      ...prev,
      [planItemId]: {
        tone: "success",
        text: "已保存这条的执行层改词，可直接继续重跑。",
      },
    }));
    setBatchPromptQuickEditDialog(null);
  };

  const handleRewriteBatchPromptQuickEdit = async (job: EcommerceBatchJob) => {
    if (!batchPromptQuickEditDialog) return;
    const { prompt, feedback } = batchPromptQuickEditDialog;
    setBatchPromptQuickEditDialog(null);
    await handlePrepareSingleBatchPromptAction(job, feedback, prompt);
  };

  const handleGenerateBatchPromptQuickEdit = async (job: EcommerceBatchJob) => {
    if (!batchPromptQuickEditDialog) return;
    const { prompt, feedback } = batchPromptQuickEditDialog;
    setBatchPromptFeedbackDrafts((prev) => ({
      ...prev,
      [job.planItemId]: feedback,
    }));
    await onSyncBatchPrompt?.(job.planItemId, prompt);
    setBatchPromptQuickEditDialog(null);
    await handleGenerateSingleBatchJobAction(job, prompt);
  };

  const openBatchPromptQuickEditDialog = (
    job: EcommerceBatchJob,
    prompt: string,
    feedback: string,
    sourceResultLabel?: string,
  ) => {
    setBatchPromptRewriteDialog(null);
    setBatchPromptQuickEditDialog({
      jobId: job.id,
      planItemId: job.planItemId,
      title: job.title,
      prompt,
      feedback,
      sourceResultLabel,
    });
  };

  const handleRetryFailedBatchAction = async () => {
    if (!onRetryFailedBatch || isRetryingFailedBatch) return;
    setIsRetryingFailedBatch(true);
    try {
      await onRetryFailedBatch();
    } finally {
      setIsRetryingFailedBatch(false);
    }
  };

  const handleOpenOverlayEditor = async (
    result: EcommerceResultItem,
    options?: {
      preferredActiveLayerKind?: EcommerceOverlayLayerKind;
      editorMessage?: string | null;
    },
  ) => {
    setOverlayEditorMessage(options?.editorMessage || null);
    setOverlayEditorDraft(
      buildOverlayDraftState(
        result,
        state.preferredOverlayTemplateId,
        options?.preferredActiveLayerKind,
      ),
    );
    await onOpenResultOverlayEditor?.(result.url);
  };

  const handleCloseOverlayEditor = async () => {
    setOverlayEditorDraft(null);
    setOverlayEditorMessage(null);
    await onCloseResultOverlayEditor?.();
  };

  const getSelectedOverlayBatchResults = () =>
    state.results.filter((result) =>
      selectedOverlayBatchUrls.includes(result.url),
    );

  const handleSaveOverlayBrandPreset = () => {
    if (!overlayEditorDraft) return;
    const presetName = overlayBrandPresetName.trim() || "未命名品牌预设";
    const nextPresets = upsertOverlayBrandPreset({
      id: `brand_${Date.now().toString(36)}`,
      name: presetName,
      fontFamily: overlayEditorDraft.fontFamily || undefined,
      fontLabel: overlayEditorDraft.fontLabel || undefined,
      fontUrl: overlayEditorDraft.fontUrl || undefined,
      featureTagIconLabel:
        overlayEditorDraft.featureTagIconLabel || undefined,
      featureTagIconUrl: overlayEditorDraft.featureTagIconUrl || undefined,
      badge: overlayEditorDraft.badge || undefined,
      cta: overlayEditorDraft.cta || undefined,
      tone: overlayEditorDraft.tone || undefined,
      bulletStyle: overlayEditorDraft.bulletStyle || undefined,
      updatedAt: Date.now(),
    });
    setOverlayBrandPresets(nextPresets);
    setSelectedOverlayBrandPresetId(nextPresets[0]?.id || "");
    setOverlayBrandPresetName("");
    setOverlayEditorMessage(`已保存品牌预设：${presetName}`);
  };

  const handleDeleteOverlayBrandPreset = () => {
    if (!selectedOverlayBrandPresetId) return;
    const target = overlayBrandPresets.find(
      (item) => item.id === selectedOverlayBrandPresetId,
    );
    const nextPresets = deleteOverlayBrandPreset(selectedOverlayBrandPresetId);
    setOverlayBrandPresets(nextPresets);
    setSelectedOverlayBrandPresetId("");
    setOverlayEditorMessage(
      `已删除品牌预设：${target?.name || "当前预设"}`,
    );
  };

  const handleApplyOverlayBrandPresetToDraft = () => {
    const preset =
      overlayBrandPresets.find(
        (item) => item.id === selectedOverlayBrandPresetId,
      ) || null;
    if (!preset) return;
    setOverlayEditorDraft((current) =>
      current ? applyOverlayBrandPresetToDraft(current, preset) : current,
    );
    setOverlayEditorMessage(`已应用品牌预设：${preset.name}`);
  };

  const handleApplyOverlayDraftToBatch = async (mode: "draft" | "apply") => {
    if (!overlayEditorDraft) return;
    const targetResults = getSelectedOverlayBatchResults();
    if (targetResults.length === 0) {
      setOverlayEditorMessage("请先勾选要批量套版的结果。");
      return;
    }
    if (mode === "draft" && !onSaveResultOverlayDraft) return;
    if (mode === "apply" && !onApplyResultOverlay) return;

    setIsApplyingOverlayBatch(true);
    try {
      for (const result of targetResults) {
        const nextState = buildOverlayStateFromDraft(
          { ...overlayEditorDraft, targetUrl: result.url },
          result.overlayState,
        );
        if (mode === "draft") {
          await onSaveResultOverlayDraft?.(result.url, nextState);
        } else {
          await onApplyResultOverlay?.(result.url, nextState);
        }
      }
      setOverlayEditorMessage(
        mode === "draft"
          ? `已把当前上字方案复用到 ${targetResults.length} 张结果，并保存为草稿。`
          : `已把当前上字方案复用到 ${targetResults.length} 张结果，并批量生成成片。`,
      );
    } finally {
      setIsApplyingOverlayBatch(false);
    }
  };

  const handleDownloadSelectedOverlayResults = () => {
    const targetResults = getSelectedOverlayBatchResults();
    if (targetResults.length === 0) {
      setOverlayEditorMessage("请先勾选要导出的结果。");
      return;
    }
    downloadOverlayImages(
      targetResults.map((result, index) => {
        const meta = parseResultMeta(
          result.label || `结果 ${index + 1}`,
          `结果 ${index + 1}`,
        );
        return {
          url: getResultDisplayUrl(result),
          label: sanitizeDownloadName(meta.fullLabel, `result-${index + 1}`),
        };
      }),
    );
    setOverlayEditorMessage(`已开始下载 ${targetResults.length} 张结果。`);
  };

  const handleExportSelectedOverlayResultsZip = async () => {
    const targetResults = getSelectedOverlayBatchResults();
    if (targetResults.length === 0) {
      setOverlayEditorMessage("请先勾选要打包导出的结果。");
      return;
    }
    setIsExportingOverlayBatchZip(true);
    try {
      await exportOverlayImagesZip({
        items: targetResults.map((result, index) => {
          const meta = parseResultMeta(
            result.label || `结果 ${index + 1}`,
            `结果 ${index + 1}`,
          );
          return {
            url: getResultDisplayUrl(result),
            label: sanitizeDownloadName(meta.fullLabel, `result-${index + 1}`),
            meta: {
              sourceUrl: result.url,
              overlayStatus: result.overlayState?.status || null,
            },
          };
        }),
        filename: sanitizeDownloadName(
          `ecom-overlay-batch-${new Date().toISOString().slice(0, 10)}`,
        ),
      });
      setOverlayEditorMessage(`已打包 ${targetResults.length} 张结果。`);
    } finally {
      setIsExportingOverlayBatchZip(false);
    }
  };

  const handleExportSelectedOverlayVariants = async () => {
    const targetResults = getSelectedOverlayBatchResults();
    if (targetResults.length === 0) {
      setOverlayEditorMessage("请先勾选要导出多平台版本的结果。");
      return;
    }
    if (!onExportSelectedOverlayVariants) return;
    setIsExportingSelectedOverlayVariants(true);
    try {
      await onExportSelectedOverlayVariants(targetResults.map((result) => result.url));
      setOverlayEditorMessage(
        `已开始导出 ${targetResults.length} 张结果的多平台版本 ZIP。`,
      );
    } finally {
      setIsExportingSelectedOverlayVariants(false);
    }
  };

  const handleSaveOverlayDraft = async () => {
    if (!overlayEditorDraft || !onSaveResultOverlayDraft) return;
    setIsSavingOverlayDraft(true);
    try {
      const previousState = activeEditingResult?.overlayState;
      await onSaveResultOverlayDraft(
        overlayEditorDraft.targetUrl,
        buildOverlayStateFromDraft(overlayEditorDraft, previousState),
      );
      setOverlayEditorMessage("草稿已保存，结果卡会记住这套上字方案。");
    } finally {
      setIsSavingOverlayDraft(false);
    }
  };

  const handleApplyOverlayDraft = async () => {
    if (!overlayEditorDraft || !onApplyResultOverlay) return;
    setIsApplyingOverlay(true);
    try {
      const previousState = activeEditingResult?.overlayState;
      await onApplyResultOverlay(
        overlayEditorDraft.targetUrl,
        buildOverlayStateFromDraft(overlayEditorDraft, previousState),
      );
      setOverlayEditorMessage("成片已生成，并已回写到这张结果卡。");
    } finally {
      setIsApplyingOverlay(false);
    }
  };

  const handleExportOverlayVariants = async () => {
    if (!overlayEditorDraft || !onExportResultOverlayVariants) return;
    setIsExportingOverlayVariants(true);
    try {
      const previousState = activeEditingResult?.overlayState;
      await onExportResultOverlayVariants(
        overlayEditorDraft.targetUrl,
        buildOverlayStateFromDraft(overlayEditorDraft, previousState),
      );
      setOverlayEditorMessage("已开始导出当前图的多平台上字版本 ZIP。");
    } finally {
      setIsExportingOverlayVariants(false);
    }
  };

  const handleQuickExportOverlayVariants = async (
    result: EcommerceResultItem,
  ) => {
    if (!onExportResultOverlayVariants || !hasOverlayContent(result.overlayState)) {
      return;
    }
    setQuickExportingOverlayResultUrl(result.url);
    try {
      await onExportResultOverlayVariants(result.url, result.overlayState || null);
    } finally {
      setQuickExportingOverlayResultUrl(null);
    }
  };

  const handleOverlayFontPick = () => {
    overlayFontInputRef.current?.click();
  };

  const handleOverlayIconPick = () => {
    overlayIconInputRef.current?.click();
  };

  const handleOverlayFontFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file || !overlayEditorDraft || !onUploadResultOverlayFont) {
      return;
    }

    setIsUploadingOverlayFont(true);
    setOverlayEditorMessage(null);
    try {
      await onUploadResultOverlayFont(overlayEditorDraft.targetUrl, file);
      const fontLabel = file.name.replace(/\.[^.]+$/, "").trim() || "自定义字体";
      setOverlayEditorDraft((current) =>
        current
          ? {
              ...current,
              fontLabel,
            }
          : current,
      );
      setOverlayEditorMessage(`字体已上传：${fontLabel}`);
    } catch (error) {
      setOverlayEditorMessage(
        error instanceof Error ? error.message : "字体上传失败，请稍后重试。",
      );
    } finally {
      setIsUploadingOverlayFont(false);
    }
  };

  const handleOverlayIconFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file || !overlayEditorDraft || !onUploadResultOverlayIcon) {
      return;
    }

    setIsUploadingOverlayIcon(true);
    setOverlayEditorMessage(null);
    try {
      await onUploadResultOverlayIcon(overlayEditorDraft.targetUrl, file);
      const iconLabel = file.name.replace(/\.[^.]+$/, "").trim() || "标签图标";
      setOverlayEditorDraft((current) =>
        current
          ? {
              ...current,
              featureTagIconLabel: iconLabel,
              featureTagIconUrl:
                activeEditingResult?.overlayState?.featureTagIconUrl ||
                current.featureTagIconUrl,
            }
          : current,
      );
      setOverlayEditorMessage(`标签图标已上传：${iconLabel}`);
    } catch (error) {
      setOverlayEditorMessage(
        error instanceof Error ? error.message : "图标上传失败，请稍后重试。",
      );
    } finally {
      setIsUploadingOverlayIcon(false);
    }
  };

  const handleResetOverlayDraft = async () => {
    if (!overlayEditorDraft) return;
    await onResetResultOverlay?.(overlayEditorDraft.targetUrl);
    if (activeEditingResult) {
      setOverlayEditorDraft(
        buildOverlayDraftState(activeEditingResult, state.preferredOverlayTemplateId),
      );
    }
    setOverlayEditorMessage("已还原为无字底图，原来的提示词与结果不会受影响。");
  };

  const renderOverlayEditorPanel = (result: EcommerceResultItem) => {
    if (
      !state.overlayPanelOpen ||
      !overlayEditorDraft ||
      overlayEditorDraft.targetUrl !== result.url
    ) {
      return null;
    }

    return (
      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              后合成工作台
            </div>
            <div className="mt-1 text-[11px] leading-5 text-slate-500">
              先在这里排标题、副标题、价格模块、图标标签、卖点、参数卡片、对比模块和 CTA，再决定是否生成成片。
              原底图不会被覆盖，后续还能继续改。
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleCloseOverlayEditor()}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            收起
          </button>
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)]">
          <OverlayPreviewCanvas
            imageUrl={result.url}
            draft={overlayEditorDraft}
            layoutMeta={result.layoutMeta}
            assistReport={overlayAssistReport}
            onPreview={onPreviewResult}
          />
          <div className="space-y-3 rounded-2xl border border-white bg-white p-3 shadow-sm">
            {getLayoutMetaChips(result.layoutMeta).length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2">
                <div className="text-[10px] font-semibold text-amber-800">
                  智能布局提示
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {getLayoutMetaChips(result.layoutMeta).map((chip) => (
                    <span
                      key={`${result.url}-layout-hint-${chip.text}`}
                      className={`rounded-full px-2 py-1 text-[10px] font-medium ${chip.className}`}
                    >
                      {chip.text}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold text-emerald-900">
                    智能排版建议
                  </div>
                  <div className="mt-1 text-[10px] leading-5 text-emerald-700/85">
                    基于图片留白、主体分布和当前文案密度给出辅助建议，不会自动改你的版式。
                  </div>
                </div>
                {overlayAssistReport ? (
                  <button
                    type="button"
                    onClick={handleApplyOverlayAssistSuggestion}
                    className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[10px] font-semibold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-50"
                  >
                    应用建议位置
                  </button>
                ) : null}
              </div>
              {overlayAssistLoading ? (
                <div className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-[10px] text-emerald-700">
                  正在分析留白、主体和可读性...
                </div>
              ) : overlayAssistError ? (
                <div className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-[10px] text-amber-700">
                  {overlayAssistError}
                </div>
              ) : overlayAssistReport ? (
                <>
                  <div className="mt-2 rounded-lg bg-white/75 px-3 py-2 text-[10px] leading-5 text-slate-700">
                    {overlayAssistReport.summary}
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/80 bg-white/70 px-3 py-2">
                      <div className="text-[10px] font-semibold text-slate-900">
                        当前区域
                      </div>
                      <div className="mt-1 text-[10px] text-slate-600">
                        {overlayAssistReport.currentZoneLabel}
                      </div>
                      <div className="mt-2 space-y-1 text-[10px] text-slate-500">
                        <div>
                          可读性 {Math.round(
                            overlayAssistReport.currentMetrics.readabilityScore * 100,
                          )}%
                        </div>
                        <div>
                          留白度 {Math.round(
                            overlayAssistReport.currentMetrics.blankScore * 100,
                          )}%
                        </div>
                        <div>
                          主体遮挡风险 {Math.round(
                            overlayAssistReport.currentMetrics.subjectOverlap * 100,
                          )}%
                        </div>
                        <div>
                          版式适配 {Math.round(
                            overlayAssistReport.currentMetrics.layoutFitScore * 100,
                          )}%
                        </div>
                        <div>
                          信息承载 {Math.round(
                            overlayAssistReport.currentMetrics.densityFitScore * 100,
                          )}%
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-white/85 px-3 py-2">
                      <div className="text-[10px] font-semibold text-emerald-900">
                        推荐区域
                      </div>
                      <div className="mt-1 text-[10px] text-emerald-700">
                        {overlayAssistReport.recommendedZoneLabel}
                      </div>
                      <div className="mt-2 space-y-1 text-[10px] text-emerald-700/85">
                        <div>
                          建议调性：
                          {overlayAssistReport.recommendedTone === "light"
                            ? "浅色留白"
                            : overlayAssistReport.recommendedTone === "accent"
                              ? "品牌强调"
                              : "深色压感"}
                        </div>
                        <div>
                          建议卖点样式：
                          {overlayAssistReport.recommendedBulletStyle === "cards"
                            ? "卡片"
                            : overlayAssistReport.recommendedBulletStyle === "chips"
                              ? "标签"
                              : "列表"}
                        </div>
                        <div>
                          可读性 {Math.round(
                            overlayAssistReport.recommendedMetrics.readabilityScore * 100,
                          )}%
                        </div>
                        <div>
                          留白度 {Math.round(
                            overlayAssistReport.recommendedMetrics.blankScore * 100,
                          )}%
                        </div>
                        <div>
                          版式适配 {Math.round(
                            overlayAssistReport.recommendedMetrics.layoutFitScore * 100,
                          )}%
                        </div>
                      </div>
                    </div>
                  </div>
                  {overlayAssistReport.currentWeaknesses.length > 0 ? (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
                      <div className="text-[10px] font-semibold text-slate-900">
                        当前短板
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {overlayAssistReport.currentWeaknesses.map((item, index) => (
                          <span
                            key={`${result.url}-overlay-weakness-${index}`}
                            className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {overlayAssistReport.recommendedReasons.length > 0 ? (
                    <div className="mt-2 rounded-lg border border-emerald-200 bg-white/85 px-3 py-2">
                      <div className="text-[10px] font-semibold text-emerald-900">
                        推荐依据
                      </div>
                      <div className="mt-1 space-y-1 text-[10px] leading-5 text-emerald-800/90">
                        {overlayAssistReport.recommendedReasons.map((item, index) => (
                          <div key={`${result.url}-overlay-reason-${index}`}>
                            {index + 1}. {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {overlayAssistReport.suggestions.length > 0 ? (
                    <div className="mt-2 rounded-lg border border-emerald-200 bg-white/80 px-3 py-2">
                      <div className="text-[10px] font-semibold text-slate-900">
                        建议动作
                      </div>
                      <div className="mt-1 space-y-1 text-[10px] leading-5 text-slate-600">
                        {overlayAssistReport.suggestions.map((item, index) => (
                          <div key={`${result.url}-overlay-suggestion-${index}`}>
                            {index + 1}. {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {overlayAssistReport.warnings.length > 0 ? (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2">
                      <div className="text-[10px] font-semibold text-amber-800">
                        可读性告警
                      </div>
                      <div className="mt-1 space-y-1 text-[10px] leading-5 text-amber-700">
                        {overlayAssistReport.warnings.map((item, index) => (
                          <div key={`${result.url}-overlay-warning-${index}`}>
                            {index + 1}. {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="text-[11px] font-semibold text-slate-900">
                平台模板
              </div>
              <div className="mt-1 text-[10px] leading-5 text-slate-500">
                用平台常见详情页风格快速约束模板、对齐、调性和卖点表现。
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {OVERLAY_PLATFORM_PRESET_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() =>
                      setOverlayEditorDraft((current) =>
                        current
                          ? applyOverlayPlatformPresetToDraft(current, option.id)
                          : current,
                      )
                    }
                    className={[
                      "rounded-xl border px-3 py-2 text-left transition",
                      overlayEditorDraft.platformPresetId === option.id
                        ? "border-sky-300 bg-sky-50 text-sky-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                    ].join(" ")}
                  >
                    <div className="text-[11px] font-semibold">{option.label}</div>
                    <div className="mt-1 text-[10px] leading-4 text-inherit/80">
                      {option.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="text-[11px] font-semibold text-slate-900">
                快捷样式
              </div>
              <div className="mt-1 text-[10px] leading-5 text-slate-500">
                一键切到更像详情页的常见版式组合，会同步调整模板、调性、卖点表现和图层显隐顺序。
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {OVERLAY_STYLE_PRESET_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() =>
                      setOverlayEditorDraft((current) =>
                        current
                          ? applyOverlayStylePresetToDraft(
                              activeEditingResult,
                              current,
                              option.id,
                            )
                          : current,
                      )
                    }
                    className={[
                      "rounded-xl border px-3 py-2 text-left transition",
                      overlayEditorDraft.stylePresetId === option.id
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                    ].join(" ")}
                  >
                    <div className="text-[11px] font-semibold">{option.label}</div>
                    <div className="mt-1 text-[10px] leading-4 text-inherit/80">
                      {option.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold text-slate-900">
                  图层顺序
                </div>
                <div className="text-[10px] text-slate-500">
                  点击某层可切换当前编辑对象
                </div>
              </div>
              <div className="mt-2 space-y-2">
                {getOrderedOverlayLayers(overlayEditorDraft.layers).map((layer, index, list) => {
                  const summary = summarizeOverlayLayerDraft(
                    overlayEditorDraft,
                    layer.kind,
                  );
                  const isActive =
                    overlayEditorDraft.activeLayerKind === layer.kind;
                  return (
                    <div
                      key={`${result.url}-overlay-layer-${layer.kind}`}
                      className={[
                        "flex items-center gap-2 rounded-xl border px-3 py-2 transition",
                        isActive
                          ? "border-blue-300 bg-blue-50"
                          : "border-slate-200 bg-white",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOverlayEditorDraft((current) =>
                            current
                              ? { ...current, activeLayerKind: layer.kind }
                              : current,
                          )
                        }
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-500">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-900">
                            {OVERLAY_LAYER_KIND_LABELS[layer.kind]}
                          </span>
                          <span
                            className={[
                              "rounded-full px-2 py-0.5 text-[9px] font-medium",
                              layer.visible !== false
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500",
                            ].join(" ")}
                          >
                            {layer.visible !== false ? "显示中" : "已隐藏"}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-[10px] text-slate-500">
                          {summary}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setOverlayEditorDraft((current) => {
                            if (!current) return current;
                            const nextLayers = current.layers.map((item) =>
                              item.kind === layer.kind
                                ? { ...item, visible: item.visible === false }
                                : item,
                            );
                            return { ...current, layers: normalizeOverlayLayers(nextLayers) };
                          })
                        }
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        {layer.visible !== false ? "隐藏" : "显示"}
                      </button>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() =>
                          setOverlayEditorDraft((current) => {
                            if (!current) return current;
                            const ordered = getOrderedOverlayLayers(current.layers);
                            const currentIndex = ordered.findIndex(
                              (item) => item.kind === layer.kind,
                            );
                            if (currentIndex <= 0) return current;
                            const currentLayer = ordered[currentIndex];
                            const previousLayer = ordered[currentIndex - 1];
                            const swapped = ordered.map((item) => {
                              if (item.kind === currentLayer.kind) {
                                return { ...item, order: previousLayer.order };
                              }
                              if (item.kind === previousLayer.kind) {
                                return { ...item, order: currentLayer.order };
                              }
                              return item;
                            });
                            return {
                              ...current,
                              layers: normalizeOverlayLayers(swapped),
                              activeLayerKind: layer.kind,
                            };
                          })
                        }
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        上移
                      </button>
                      <button
                        type="button"
                        disabled={index === list.length - 1}
                        onClick={() =>
                          setOverlayEditorDraft((current) => {
                            if (!current) return current;
                            const ordered = getOrderedOverlayLayers(current.layers);
                            const currentIndex = ordered.findIndex(
                              (item) => item.kind === layer.kind,
                            );
                            if (currentIndex < 0 || currentIndex >= ordered.length - 1) {
                              return current;
                            }
                            const currentLayer = ordered[currentIndex];
                            const nextLayer = ordered[currentIndex + 1];
                            const swapped = ordered.map((item) => {
                              if (item.kind === currentLayer.kind) {
                                return { ...item, order: nextLayer.order };
                              }
                              if (item.kind === nextLayer.kind) {
                                return { ...item, order: currentLayer.order };
                              }
                              return item;
                            });
                            return {
                              ...current,
                              layers: normalizeOverlayLayers(swapped),
                              activeLayerKind: layer.kind,
                            };
                          })
                        }
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        下移
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-2 text-[10px] leading-5 text-blue-700">
              标题、副标题、CTA 在最终导出时会自动换行并优先缩字，尽量保住完整信息。
              如果文案仍然过长，系统才会在最后一行做省略处理。
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] font-semibold text-slate-900">
                  版式模板
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setOverlayEditorDraft((current) =>
                      current ? applySmartOverlayPreset(activeEditingResult, current) : current,
                    )
                  }
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                >
                  一键智能排版
                </button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {OVERLAY_TEMPLATE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() =>
                      setOverlayEditorDraft((current) =>
                        current
                          ? { ...current, templateId: option.id, stylePresetId: "" }
                          : current,
                      )
                    }
                    className={[
                      "rounded-xl border px-3 py-2 text-left transition",
                      overlayEditorDraft.templateId === option.id
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                    ].join(" ")}
                  >
                    <div className="text-[11px] font-semibold">{option.label}</div>
                    <div className="mt-1 text-[10px] leading-4 text-inherit/80">
                      {option.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className={getOverlayLayerEditorSectionClassName(["headline", "badge"])}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold text-slate-900">
                  标题与角标
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setOverlayEditorDraft((current) =>
                      current ? { ...current, activeLayerKind: "headline" } : current,
                    )
                  }
                  className="text-[10px] font-medium text-blue-600"
                >
                  当前编辑：{OVERLAY_LAYER_KIND_LABELS[overlayEditorDraft.activeLayerKind]}
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <div className="text-[11px] font-semibold text-slate-900">
                    标题
                  </div>
                  <input
                    type="text"
                    value={overlayEditorDraft.headline}
                    onFocus={() =>
                      setOverlayEditorDraft((current) =>
                        current ? { ...current, activeLayerKind: "headline" } : current,
                      )
                    }
                    onChange={(event) =>
                      setOverlayEditorDraft((current) =>
                        current
                          ? { ...current, headline: event.target.value }
                          : current,
                      )
                    }
                    placeholder="例如：滚筒洗地更省力"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none transition focus:border-blue-300"
                  />
                </label>
                <label className="block">
                  <div className="text-[11px] font-semibold text-slate-900">
                    角标
                  </div>
                  <input
                    type="text"
                    value={overlayEditorDraft.badge}
                    onFocus={() =>
                      setOverlayEditorDraft((current) =>
                        current ? { ...current, activeLayerKind: "badge" } : current,
                      )
                    }
                    onChange={(event) =>
                      setOverlayEditorDraft((current) =>
                        current
                          ? { ...current, badge: event.target.value }
                          : current,
                      )
                    }
                    placeholder="例如：新品升级"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none transition focus:border-blue-300"
                  />
                </label>
              </div>
            </div>
            <div className={getOverlayLayerEditorSectionClassName(["subheadline"])}>
              <label className="block">
                <div className="text-[11px] font-semibold text-slate-900">
                  副标题
                </div>
                <textarea
                  value={overlayEditorDraft.subheadline}
                  onFocus={() =>
                    setOverlayEditorDraft((current) =>
                      current ? { ...current, activeLayerKind: "subheadline" } : current,
                    )
                  }
                  onChange={(event) =>
                    setOverlayEditorDraft((current) =>
                      current
                        ? { ...current, subheadline: event.target.value }
                        : current,
                    )
                  }
                  placeholder="用于补充一句价值解释或场景描述。"
                  className="mt-1 min-h-[72px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] leading-5 text-slate-700 outline-none transition focus:border-blue-300"
                />
              </label>
            </div>
            <div className={getOverlayLayerEditorSectionClassName(["price"])}>
              <div className="mb-2 text-[11px] font-semibold text-slate-900">
                价格模块
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <div className="text-[11px] font-semibold text-slate-900">
                  价格标签
                </div>
                <input
                  type="text"
                  value={overlayEditorDraft.priceLabel}
                  onFocus={() =>
                    setOverlayEditorDraft((current) =>
                      current ? { ...current, activeLayerKind: "price" } : current,
                    )
                  }
                  onChange={(event) =>
                    setOverlayEditorDraft((current) =>
                      current
                        ? { ...current, priceLabel: event.target.value }
                        : current,
                    )
                  }
                  placeholder="例如：到手价"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none transition focus:border-blue-300"
                />
              </label>
              <label className="block">
                <div className="text-[11px] font-semibold text-slate-900">
                  价格主值
                </div>
                <input
                  type="text"
                  value={overlayEditorDraft.priceValue}
                  onFocus={() =>
                    setOverlayEditorDraft((current) =>
                      current ? { ...current, activeLayerKind: "price" } : current,
                    )
                  }
                  onChange={(event) =>
                    setOverlayEditorDraft((current) =>
                      current
                        ? { ...current, priceValue: event.target.value }
                        : current,
                    )
                  }
                  placeholder="例如：￥299"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none transition focus:border-blue-300"
                />
              </label>
              <label className="block">
                <div className="text-[11px] font-semibold text-slate-900">
                  价格备注
                </div>
                <input
                  type="text"
                  value={overlayEditorDraft.priceNote}
                  onFocus={() =>
                    setOverlayEditorDraft((current) =>
                      current ? { ...current, activeLayerKind: "price" } : current,
                    )
                  }
                  onChange={(event) =>
                    setOverlayEditorDraft((current) =>
                      current
                        ? { ...current, priceNote: event.target.value }
                        : current,
                    )
                  }
                  placeholder="例如：限时立减 100 元"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none transition focus:border-blue-300"
                />
              </label>
            </div>
            </div>
            <div className={getOverlayLayerEditorSectionClassName(["featureTags", "stats"])}>
              <div className="mb-2 text-[11px] font-semibold text-slate-900">
                标签与参数
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <div className="text-[11px] font-semibold text-slate-900">
                  图标标签
                </div>
                <textarea
                  value={overlayEditorDraft.featureTagsText}
                  onFocus={() =>
                    setOverlayEditorDraft((current) =>
                      current ? { ...current, activeLayerKind: "featureTags" } : current,
                    )
                  }
                  onChange={(event) =>
                    setOverlayEditorDraft((current) =>
                      current
                        ? { ...current, featureTagsText: event.target.value }
                        : current,
                    )
                  }
                  placeholder={"一行一个标签，例如：\n热水洗地\n毛发防缠\n180°躺平"}
                  className="mt-1 min-h-[90px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] leading-5 text-slate-700 outline-none transition focus:border-blue-300"
                />
                <div className="mt-1 text-[10px] leading-5 text-slate-500">
                  更适合做图标位、能力标签、功能亮点条。
                </div>
              </label>
              <label className="block">
                <div className="text-[11px] font-semibold text-slate-900">
                  参数卡片
                </div>
                <textarea
                  value={overlayEditorDraft.statsText}
                  onFocus={() =>
                    setOverlayEditorDraft((current) =>
                      current ? { ...current, activeLayerKind: "stats" } : current,
                    )
                  }
                  onChange={(event) =>
                    setOverlayEditorDraft((current) =>
                      current
                        ? { ...current, statsText: event.target.value }
                        : current,
                    )
                  }
                  placeholder={"每行一条，格式：\n吸力: 18000Pa\n续航: 45min\n噪音: 63dB"}
                  className="mt-1 min-h-[90px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] leading-5 text-slate-700 outline-none transition focus:border-blue-300"
                />
                <div className="mt-1 text-[10px] leading-5 text-slate-500">
                  适合详情页参数图、对比图和卖点参数带。
                </div>
              </label>
            </div>
            </div>
            <div className={getOverlayLayerEditorSectionClassName(["comparison"])}>
            <label className="block">
              <div className="text-[11px] font-semibold text-slate-900">
                对比模块
              </div>
              <input
                type="text"
                value={overlayEditorDraft.comparisonTitle}
                onFocus={() =>
                  setOverlayEditorDraft((current) =>
                    current ? { ...current, activeLayerKind: "comparison" } : current,
                  )
                }
                onChange={(event) =>
                  setOverlayEditorDraft((current) =>
                    current
                      ? { ...current, comparisonTitle: event.target.value }
                      : current,
                  )
                }
                placeholder="例如：升级对比"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none transition focus:border-blue-300"
              />
              <textarea
                value={overlayEditorDraft.comparisonRowsText}
                onFocus={() =>
                  setOverlayEditorDraft((current) =>
                    current ? { ...current, activeLayerKind: "comparison" } : current,
                  )
                }
                onChange={(event) =>
                  setOverlayEditorDraft((current) =>
                    current
                      ? { ...current, comparisonRowsText: event.target.value }
                      : current,
                  )
                }
                placeholder={"每行一条，格式：\n吸力: 普通款 12000Pa | 升级款 18000Pa\n贴边: 一般 | 双侧贴边"}
                className="mt-2 min-h-[96px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] leading-5 text-slate-700 outline-none transition focus:border-blue-300"
              />
              <div className="mt-1 text-[10px] leading-5 text-slate-500">
                适合做升级对比、前后代差异、普通款与旗舰款说明。
              </div>
            </label>
            </div>
            <div className={getOverlayLayerEditorSectionClassName(["bullets"])}>
            <label className="block">
              <div className="text-[11px] font-semibold text-slate-900">
                卖点列表
              </div>
              <textarea
                value={overlayEditorDraft.bulletsText}
                onFocus={() =>
                  setOverlayEditorDraft((current) =>
                    current ? { ...current, activeLayerKind: "bullets" } : current,
                  )
                }
                onChange={(event) =>
                  setOverlayEditorDraft((current) =>
                    current
                      ? { ...current, bulletsText: event.target.value }
                      : current,
                  )
                }
                placeholder={"一行一个卖点，例如：\n180°躺平进桌底\n热水自清洁\n毛发不缠绕"}
                className="mt-1 min-h-[90px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] leading-5 text-slate-700 outline-none transition focus:border-blue-300"
              />
            </label>
            </div>
            <div className={getOverlayLayerEditorSectionClassName(["cta"])}>
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="block">
                <div className="text-[11px] font-semibold text-slate-900">
                  CTA
                </div>
                <input
                  type="text"
                  value={overlayEditorDraft.cta}
                  onFocus={() =>
                    setOverlayEditorDraft((current) =>
                      current ? { ...current, activeLayerKind: "cta" } : current,
                    )
                  }
                  onChange={(event) =>
                    setOverlayEditorDraft((current) =>
                      current ? { ...current, cta: event.target.value } : current,
                    )
                  }
                  placeholder="例如：立即了解"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none transition focus:border-blue-300"
                />
              </label>
              <label className="block">
                <div className="text-[11px] font-semibold text-slate-900">
                  对齐
                </div>
                <select
                  value={overlayEditorDraft.textAlign}
                  onChange={(event) =>
                    setOverlayEditorDraft((current) =>
                      current
                        ? {
                            ...current,
                            textAlign: event.target.value as OverlayEditorDraft["textAlign"],
                            stylePresetId: "",
                          }
                        : current,
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none transition focus:border-blue-300"
                >
                  <option value="left">左对齐</option>
                  <option value="center">居中</option>
                  <option value="right">右对齐</option>
                </select>
              </label>
              <label className="block">
                <div className="text-[11px] font-semibold text-slate-900">
                  卖点样式
                </div>
                <select
                  value={overlayEditorDraft.bulletStyle}
                  onChange={(event) =>
                    setOverlayEditorDraft((current) =>
                      current
                        ? {
                            ...current,
                            bulletStyle: event.target.value as OverlayEditorDraft["bulletStyle"],
                            stylePresetId: "",
                          }
                        : current,
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none transition focus:border-blue-300"
                >
                  {OVERLAY_BULLET_STYLE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <div className="text-[11px] font-semibold text-slate-900">
                  视觉调性
                </div>
                <select
                  value={overlayEditorDraft.tone}
                  onChange={(event) =>
                    setOverlayEditorDraft((current) =>
                      current
                        ? {
                            ...current,
                            tone: event.target.value as OverlayEditorDraft["tone"],
                            stylePresetId: "",
                          }
                        : current,
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none transition focus:border-blue-300"
                >
                  {OVERLAY_TONE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <input
                ref={overlayIconInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(event) => void handleOverlayIconFileChange(event)}
                className="hidden"
              />
              <input
                ref={overlayFontInputRef}
                type="file"
                accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
                onChange={(event) => void handleOverlayFontFileChange(event)}
                className="hidden"
              />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold text-slate-900">
                    标签图标
                  </div>
                  <div className="mt-1 text-[10px] leading-5 text-slate-500">
                    可上传一个 PNG / SVG / WebP 小图标，给图标标签统一使用，更像详情页里的功能小标识。
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleOverlayIconPick}
                    disabled={isUploadingOverlayIcon}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isUploadingOverlayIcon ? "上传中..." : "上传图标"}
                  </button>
                  {overlayEditorDraft.featureTagIconUrl.trim() ? (
                    <button
                      type="button"
                      onClick={() =>
                        setOverlayEditorDraft((current) =>
                          current
                            ? {
                                ...current,
                                featureTagIconLabel: "",
                                featureTagIconUrl: "",
                              }
                            : current,
                        )
                      }
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      清除图标
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 text-[10px] text-slate-600">
                当前图标：
                <span className="ml-1 font-semibold text-slate-800">
                  {overlayEditorDraft.featureTagIconLabel.trim() || "默认圆点"}
                </span>
              </div>
              {overlayEditorDraft.featureTagIconUrl.trim() ? (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2">
                  <img
                    src={overlayEditorDraft.featureTagIconUrl}
                    alt="当前标签图标"
                    className="h-8 w-8 rounded-lg object-cover"
                  />
                  <div className="min-w-0 text-[10px] leading-4 text-slate-500">
                    <div className="font-semibold text-slate-700">已绑定到当前结果卡</div>
                    <div className="truncate">
                      {overlayEditorDraft.featureTagIconLabel.trim() || "标签图标"}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold text-slate-900">
                    自定义字体
                  </div>
                  <div className="mt-1 text-[10px] leading-5 text-slate-500">
                    支持上传 TTF / OTF / WOFF / WOFF2。字体只绑定当前结果卡，不会影响别的图片。
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleOverlayFontPick}
                    disabled={isUploadingOverlayFont}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isUploadingOverlayFont ? "上传中..." : "上传字体"}
                  </button>
                  {overlayEditorDraft.fontLabel.trim() ? (
                    <button
                      type="button"
                      onClick={() =>
                        setOverlayEditorDraft((current) =>
                          current
                            ? {
                                ...current,
                                fontFamily: "",
                                fontLabel: "",
                                fontUrl: "",
                              }
                            : current,
                        )
                      }
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      恢复默认字体
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 text-[10px] text-slate-600">
                当前字体：
                <span className="ml-1 font-semibold text-slate-800">
                  {overlayEditorDraft.fontLabel.trim() || "默认系统字体"}
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="text-[11px] font-semibold text-slate-900">
                品牌预设
              </div>
              <div className="mt-1 text-[10px] leading-5 text-slate-500">
                保存当前字体、图标、角标、CTA 等品牌资产，后面可一键复用到别的图。
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  type="text"
                  value={overlayBrandPresetName}
                  onChange={(event) => setOverlayBrandPresetName(event.target.value)}
                  placeholder="例如：科沃斯详情页品牌预设"
                  className="min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none transition focus:border-blue-300"
                />
                <button
                  type="button"
                  onClick={handleSaveOverlayBrandPreset}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300"
                >
                  保存为品牌预设
                </button>
              </div>
              {overlayBrandPresets.length > 0 ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={selectedOverlayBrandPresetId}
                    onChange={(event) => setSelectedOverlayBrandPresetId(event.target.value)}
                    className="min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none transition focus:border-blue-300"
                  >
                    <option value="">选择已保存品牌预设</option>
                    {overlayBrandPresets.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleApplyOverlayBrandPresetToDraft}
                    disabled={!selectedOverlayBrandPresetId}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    应用到当前图
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteOverlayBrandPreset}
                    disabled={!selectedOverlayBrandPresetId}
                    className="rounded-lg border border-red-200 bg-white px-3 py-2 text-[11px] font-semibold text-red-600 transition hover:border-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    删除预设
                  </button>
                </div>
              ) : (
                <div className="mt-2 text-[10px] text-slate-500">
                  还没有保存的品牌预设。
                </div>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold text-slate-900">
                    批量套版与导出
                  </div>
                  <div className="mt-1 text-[10px] leading-5 text-slate-500">
                    先在结果卡勾选目标，再把当前这套上字方案复用到多张图，最后批量导出。
                  </div>
                </div>
                <div className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold text-slate-600">
                  已选 {selectedOverlayBatchUrls.length} 张
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleApplyOverlayDraftToBatch("draft")}
                  disabled={selectedOverlayBatchUrls.length === 0 || isApplyingOverlayBatch}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isApplyingOverlayBatch ? "处理中..." : "复用到已选并存草稿"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleApplyOverlayDraftToBatch("apply")}
                  disabled={selectedOverlayBatchUrls.length === 0 || isApplyingOverlayBatch}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isApplyingOverlayBatch ? "处理中..." : "复用到已选并批量成片"}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSelectedOverlayResults}
                  disabled={selectedOverlayBatchUrls.length === 0}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  批量下载 PNG
                </button>
                <button
                  type="button"
                  onClick={() => void handleExportSelectedOverlayVariants()}
                  disabled={
                    selectedOverlayBatchUrls.length === 0 ||
                    isExportingSelectedOverlayVariants ||
                    !onExportSelectedOverlayVariants
                  }
                  className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-3 py-2 text-[11px] font-semibold text-fuchsia-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isExportingSelectedOverlayVariants
                    ? "打包多平台中..."
                    : "批量导出多平台 ZIP"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleExportSelectedOverlayResultsZip()}
                  disabled={selectedOverlayBatchUrls.length === 0 || isExportingOverlayBatchZip}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isExportingOverlayBatchZip ? "打包中..." : "打包 ZIP"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOverlayBatchUrls([])}
                  disabled={selectedOverlayBatchUrls.length === 0}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  清空已选
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[10px] leading-5 text-slate-500">
              安全区是根据当前模板模拟的详情页留文案区域。
              现在除了文字，还可以一起组合价格块、标签条、参数卡片和对比模块。
              先保存草稿可以只记住排版，不生成新图；点击“生成成片”会把整套组件正式合成到新结果上。
            </div>
            {overlayEditorMessage ? (
              <div className="rounded-xl bg-emerald-50 px-3 py-2 text-[10px] font-medium text-emerald-700">
                {overlayEditorMessage}
              </div>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void handleResetOverlayDraft()}
                disabled={isSavingOverlayDraft || isApplyingOverlay}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                还原底图
              </button>
              <button
                type="button"
                onClick={() => void handleSaveOverlayDraft()}
                disabled={
                  isSavingOverlayDraft ||
                  isApplyingOverlay ||
                  isExportingOverlayVariants ||
                  !onSaveResultOverlayDraft
                }
                className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingOverlayDraft ? "保存中..." : "保存草稿"}
              </button>
              <button
                type="button"
                onClick={() => void handleExportOverlayVariants()}
                disabled={
                  isSavingOverlayDraft ||
                  isApplyingOverlay ||
                  isExportingOverlayVariants ||
                  !onExportResultOverlayVariants
                }
                className="rounded-xl border border-fuchsia-200 bg-fuchsia-50 px-3 py-2 text-[11px] font-semibold text-fuchsia-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isExportingOverlayVariants ? "打包多版本中..." : "导出多平台 ZIP"}
              </button>
              <button
                type="button"
                onClick={() => void handleApplyOverlayDraft()}
                disabled={
                  isSavingOverlayDraft ||
                  isApplyingOverlay ||
                  isExportingOverlayVariants ||
                  !onApplyResultOverlay
                }
                className="rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isApplyingOverlay ? "生成成片中..." : "生成成片"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAnalysisFeedbackCard = () =>
    onRefineAnalysis ? (
      <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-3">
        <div className="text-xs font-semibold text-gray-900">有其他想法？</div>
        <p className="mt-1 text-[11px] leading-5 text-gray-500">
          输入建议后可重新做商品分析，并刷新推荐类型与后续问题。
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={analysisFeedback}
            placeholder="输入建议后按回车重新分析..."
            onChange={(event) => setAnalysisFeedback(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSubmitAnalysisFeedback();
              }
            }}
            className="flex-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none focus:border-amber-400"
          />
          <button
            type="button"
            onClick={() => void handleSubmitAnalysisFeedback()}
            disabled={
              isSubmittingAnalysisFeedback ||
              analysisFeedback.trim().length === 0
            }
            className={[
              "rounded-xl px-3 py-2 text-[11px] font-semibold transition",
              isSubmittingAnalysisFeedback ||
              analysisFeedback.trim().length === 0
                ? "cursor-not-allowed bg-amber-100 text-amber-300"
                : "bg-amber-500 text-white hover:bg-amber-600",
            ].join(" ")}
          >
            {isSubmittingAnalysisFeedback ? "重新分析中..." : "重新分析"}
          </button>
        </div>
      </div>
    ) : null;

  const selectedTypeCount = draftTypes.filter((item) => item.selected).length;
  const requiredTypeCount = draftTypes.filter((item) => item.required).length;
  const recommendedTypeCount = draftTypes.filter(
    (item) => item.recommended,
  ).length;
  const selectedTypeTitles = draftTypes
    .filter((item) => item.selected)
    .map((item) => item.title);
  const answeredSupplementCount = draftFields.filter(isSupplementFieldAnswered)
    .length;
  const requiredSupplementCount = draftFields.filter(isBlockingSupplementField)
    .length;
  const answeredRequiredSupplementCount = draftFields.filter(
    (field) =>
      isBlockingSupplementField(field) && isSupplementFieldAnswered(field),
  ).length;
  const estimatedSupplementCount = draftFields.filter(
    (field) => field.valueSource === "estimated" && isSupplementFieldAnswered(field),
  ).length;
  const aiSupplementCount = draftFields.filter(
    (field) => field.valueSource === "ai" && isSupplementFieldAnswered(field),
  ).length;
  const userConfirmedSupplementCount = draftFields.filter(
    (field) => field.valueSource === "user" && isSupplementFieldAnswered(field),
  ).length;
  const pendingRequiredFields = draftFields.filter(
    (field) =>
      isBlockingSupplementField(field) && !isSupplementFieldAnswered(field),
  );
  const hasDraftSupplementFields = draftFields.length > 0;
  const hasPendingRequiredFields = pendingRequiredFields.length > 0;
  const supplementSummaryText = hasPendingRequiredFields
    ? `还有 ${pendingRequiredFields.length} 个关键项待补：${pendingRequiredFields
        .slice(0, 3)
        .map((field) => field.label)
        .join("、")}${pendingRequiredFields.length > 3 ? " 等" : ""}。`
    : "关键项已补齐，现在可以保存并进入下一步。";
  const supplementInputsDisabled =
    isSavingSupplements || isAutofillingSupplements;
  const imageAnalysisInputsDisabled =
    isSavingImageAnalyses || isAutofillingImageAnalyses;
  const planInputsDisabled = isSavingPlans || isAutofillingPlans;

  const renderFieldHeaderMeta = (field: EcommerceSupplementField) => {
    const selectedCount = getSupplementFieldSelectedCount(field);
    const sourceMeta = getSupplementFieldSourceMeta(field);
    const isBlockingRequired = isBlockingSupplementField(field);

    return (
      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-gray-500">
        <span className="rounded-full bg-white px-2 py-1">
          {FIELD_KIND_LABELS[field.kind] || field.kind}
        </span>
        <span
          className={[
            "rounded-full px-2 py-1",
            field.kind === "image"
              ? "bg-cyan-50 text-cyan-700"
              : isBlockingRequired
              ? "bg-rose-50 text-rose-600"
              : "bg-gray-100 text-gray-500",
          ].join(" ")}
        >
          {field.kind === "image"
            ? "建议补图"
            : isBlockingRequired
              ? "关键必填"
              : "选填"}
        </span>
        {field.kind === "single-select" ? (
          <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-700">
            单选，最多 1 项
          </span>
        ) : null}
        {field.kind === "multi-select" ? (
          <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-700">
            多选，可选 {field.maxItems || field.options?.length || "多"} 项
          </span>
        ) : null}
        {selectedCount > 0 ? (
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
            已填写 {selectedCount} 项
          </span>
        ) : (
          <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
            待填写
          </span>
        )}
        {sourceMeta ? (
          <span className={`rounded-full px-2 py-1 ${sourceMeta.className}`}>
            {sourceMeta.text}
          </span>
        ) : null}
      </div>
    );
  };

  const renderSupplementFieldCard = (field: EcommerceSupplementField) => {
    const isAnswered = isSupplementFieldAnswered(field);
    const isBlockingRequired = isBlockingSupplementField(field);
    const isHighlightedMissing =
      highlightedMissingSupplementIds.includes(field.id) &&
      isBlockingRequired &&
      !isAnswered;
    const isAutofilled = highlightedAutofilledSupplementIds.includes(field.id);
    const answeredStringValue =
      typeof field.value === "string" &&
      field.value.trim().length > 0 &&
      !isSupplementPlaceholderValue(field.value)
        ? field.value
        : "";
    const selectedValues =
      Array.isArray(field.value) && field.kind !== "image"
        ? field.value
            .filter((item) => String(item || "").trim().length > 0)
            .slice(0, 6)
        : [];
    const cardClassName = [
      "rounded-2xl border px-4 py-4",
      getSupplementFieldLayoutClass(field),
      isHighlightedMissing
        ? "border-rose-300 bg-rose-50/80"
        : isAnswered
          ? "border-emerald-200 bg-emerald-50/40"
          : isBlockingRequired
            ? "border-amber-200 bg-amber-50/40"
            : field.kind === "image"
              ? "border-cyan-200 bg-cyan-50/40"
              : "border-gray-200 bg-gray-50/80",
    ].join(" ");
    const statusClassName = [
      "rounded-full px-2.5 py-1 text-[10px] font-semibold",
      isHighlightedMissing
        ? "bg-rose-100 text-rose-700"
        : isAnswered
          ? "bg-emerald-100 text-emerald-700"
          : isBlockingRequired
            ? "bg-amber-100 text-amber-700"
            : field.kind === "image"
              ? "bg-cyan-100 text-cyan-700"
              : "bg-gray-100 text-gray-500",
    ].join(" ");
    const statusText = isAnswered
      ? "已完成"
      : isHighlightedMissing
        ? "请先补齐"
        : isBlockingRequired
          ? "待补关键项"
          : field.kind === "image"
            ? "建议补图"
            : "可稍后补充";

    return (
      <div
        ref={(node) => {
          supplementFieldRefs.current[field.id] = node;
        }}
        className={cardClassName}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-gray-900">
              {field.label}
            </div>
            {isAutofilled ? (
              <div className="mt-2 inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-semibold text-sky-700">
                AI 刚补全了这一项
              </div>
            ) : null}
            {renderFieldHeaderMeta(field)}
            <div className="mt-2 text-xs leading-5 text-gray-500">
              {getSupplementFieldGuideText(field)}
            </div>
          </div>
          <div className={statusClassName}>{statusText}</div>
        </div>

        {isHighlightedMissing ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs leading-6 text-rose-700">
            这是当前必须补充的关键信息。填完这一项后，系统才能更稳定地进入下一步。
          </div>
        ) : null}

        {field.helperText ? (
          <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs leading-6 text-gray-600">
            {field.helperText}
          </div>
        ) : null}

        {field.valueNote && isAnswered ? (
          <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-2 text-xs leading-6 text-sky-700">
            {field.valueNote}
          </div>
        ) : null}

        {answeredStringValue &&
        field.kind !== "text" &&
        field.kind !== "textarea" ? (
          <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs leading-6 text-gray-600">
            当前答案：{answeredStringValue}
          </div>
        ) : null}

        {selectedValues.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedValues.map((item, index) => (
              <span
                key={`${field.id}-value-${index}`}
                className="rounded-full bg-white px-2.5 py-1 text-[11px] text-gray-600"
              >
                {item}
              </span>
            ))}
          </div>
        ) : null}

        {field.kind === "text" ? (
          <input
            type="text"
            value={answeredStringValue}
            placeholder={field.placeholder}
            disabled={supplementInputsDisabled}
            onChange={(event) =>
              updateDraftFieldAsUser(field.id, (current) => ({
                ...current,
                value: event.target.value,
              }))
            }
            className={[
              "mt-2 w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400",
              isHighlightedMissing
                ? "border-rose-300 bg-rose-50/50 focus:border-rose-400"
                : "border-gray-200 focus:border-gray-400",
            ].join(" ")}
          />
        ) : null}

        {field.kind === "textarea" ? (
          <textarea
            value={answeredStringValue}
            placeholder={field.placeholder}
            disabled={supplementInputsDisabled}
            onChange={(event) =>
              updateDraftFieldAsUser(field.id, (current) => ({
                ...current,
                value: event.target.value,
              }))
            }
            className={[
              "mt-2 min-h-[96px] w-full rounded-lg border bg-white px-3 py-2.5 text-sm leading-6 text-gray-700 outline-none transition disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400",
              isHighlightedMissing
                ? "border-rose-300 bg-rose-50/50 focus:border-rose-400"
                : "border-gray-200 focus:border-gray-400",
            ].join(" ")}
          />
        ) : null}

        {field.kind === "single-select" && Array.isArray(field.options) ? (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {field.options.map((option, optionIndex) => {
                const active =
                  typeof field.value === "string" && field.value === option;
                return (
                  <button
                    key={`${field.id}-single-option-${optionIndex}-${option}`}
                    type="button"
                    onClick={() =>
                      updateDraftFieldAsUser(field.id, (current) => ({
                        ...current,
                        value: option,
                      }))
                    }
                    disabled={supplementInputsDisabled}
                    className={[
                      "rounded-2xl border px-3 py-3 text-left text-sm transition active:scale-[0.99]",
                      supplementInputsDisabled
                        ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                        : active
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                    ].join(" ")}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span>{option}</span>
                      <span
                        className={[
                          "rounded-full px-2 py-1 text-[10px] font-semibold",
                          active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-400",
                        ].join(" ")}
                      >
                        {active ? "已选" : "单选"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={customFieldDrafts[field.id] || ""}
                placeholder="没有合适选项？输入自定义答案"
                disabled={supplementInputsDisabled}
                onChange={(event) =>
                  setCustomFieldDraft(field.id, event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyCustomFieldValue(field);
                  }
                }}
                className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-gray-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
              />
              <button
                type="button"
                onClick={() => applyCustomFieldValue(field)}
                disabled={
                  supplementInputsDisabled ||
                  (customFieldDrafts[field.id] || "").trim().length === 0
                }
                className={[
                  "rounded-xl px-3 py-2 text-[11px] font-semibold transition active:scale-[0.99]",
                  supplementInputsDisabled ||
                  (customFieldDrafts[field.id] || "").trim().length === 0
                    ? "cursor-not-allowed bg-gray-200 text-gray-400"
                    : "bg-gray-900 text-white hover:bg-black",
                ].join(" ")}
              >
                使用自定义答案
              </button>
            </div>
          </div>
        ) : null}

        {field.kind === "multi-select" && Array.isArray(field.options) ? (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {field.options.map((option, optionIndex) => {
                const values = Array.isArray(field.value) ? field.value : [];
                const active = values.includes(option);
                return (
                  <button
                    key={`${field.id}-multi-option-${optionIndex}-${option}`}
                    type="button"
                    onClick={() =>
                      updateDraftFieldAsUser(field.id, (current) => {
                        const currentValues = Array.isArray(current.value)
                          ? current.value
                          : [];
                        const nextValues = currentValues.includes(option)
                          ? currentValues.filter((value) => value !== option)
                          : [...currentValues, option].slice(
                              0,
                              current.maxItems || 999,
                            );
                        return {
                          ...current,
                          value: nextValues,
                        };
                      })
                    }
                    disabled={supplementInputsDisabled}
                    className={[
                      "rounded-2xl border px-3 py-3 text-left text-sm transition active:scale-[0.99]",
                      supplementInputsDisabled
                        ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                        : active
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                    ].join(" ")}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span>{option}</span>
                      <span
                        className={[
                          "rounded-full px-2 py-1 text-[10px] font-semibold",
                          active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-400",
                        ].join(" ")}
                      >
                        {active ? "已选" : "可选"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={customFieldDrafts[field.id] || ""}
                placeholder="没有合适选项？输入自定义答案"
                disabled={supplementInputsDisabled}
                onChange={(event) =>
                  setCustomFieldDraft(field.id, event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyCustomFieldValue(field);
                  }
                }}
                className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-gray-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
              />
              <button
                type="button"
                onClick={() => applyCustomFieldValue(field)}
                disabled={
                  supplementInputsDisabled ||
                  (customFieldDrafts[field.id] || "").trim().length === 0
                }
                className={[
                  "rounded-xl px-3 py-2 text-[11px] font-semibold transition active:scale-[0.99]",
                  supplementInputsDisabled ||
                  (customFieldDrafts[field.id] || "").trim().length === 0
                    ? "cursor-not-allowed bg-gray-200 text-gray-400"
                    : "bg-gray-900 text-white hover:bg-black",
                ].join(" ")}
              >
                加入自定义答案
              </button>
            </div>
          </div>
        ) : null}

        {field.kind === "image" ? (
          <div className="mt-2 rounded-lg border border-dashed border-gray-200 bg-white px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] text-gray-500">
                {(Array.isArray(field.value) ? field.value.length : 0) > 0
                  ? `已上传 ${Array.isArray(field.value) ? field.value.length : 0} 张补充图片`
                  : "上传补充角度图、细节图或参考图"}
              </div>
              <label
                className={[
                  "inline-flex rounded-full border px-3 py-1 text-[10px] font-medium transition",
                  supplementInputsDisabled
                    ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                    : "cursor-pointer border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900 active:scale-[0.99]",
                ].join(" ")}
              >
                选择图片
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={supplementInputsDisabled}
                  onChange={(event) => {
                    void handleSupplementImagePick(field, event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            {Array.isArray(field.value) && field.value.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {field.value.map((url, index) => (
                  <div
                    key={`${field.id}-${index}`}
                    className="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                  >
                    <img
                      src={url}
                      alt={`${field.label}-${index + 1}`}
                      className="h-16 w-16 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateDraftFieldAsUser(field.id, (current) => ({
                          ...current,
                          value: Array.isArray(current.value)
                            ? current.value.filter(
                                (_, currentIndex) => currentIndex !== index,
                              )
                            : [],
                        }))
                      }
                      disabled={supplementInputsDisabled}
                      className={[
                        "absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[10px] text-white transition active:scale-[0.99]",
                        supplementInputsDisabled
                          ? "cursor-not-allowed bg-black/30"
                          : "bg-black/60",
                      ].join(" ")}
                    >
                      删
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  if (message.type === "ecomOneClick.entry") {
    return (
      <Card tone="accent">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Package2 size={16} className="text-blue-600" />
          电商一键工作流
        </div>
        <p className="mt-2 text-xs leading-5 text-gray-600">
          商品图片共 {message.productCount} 张
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-gray-500">
          <span className="rounded-full bg-white px-2 py-1">
            平台：
            {PLATFORM_LABELS[message.platformMode || state.platformMode] ||
              message.platformMode ||
              state.platformMode}
          </span>
          <span className="rounded-full bg-white px-2 py-1">
            模式：
            {WORKFLOW_MODE_LABELS[message.workflowMode || state.workflowMode] ||
              message.workflowMode ||
              state.workflowMode}
          </span>
        </div>
        <p className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-xs leading-5 text-gray-600">
          {message.description ||
            "上传 1 到 9 张商品图，再补一句商品说明，就可以开始当前阶段工作流。"}
        </p>
      </Card>
    );
  }

  if (message.type === "ecomOneClick.stage") {
    const currentStage = getEcommercePublicStageId(message.step);
    const currentIndex = ECOMMERCE_PUBLIC_STAGE_ORDER.indexOf(currentStage);
    return (
      <Card>
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Sparkles size={16} className="text-amber-500" />
          {message.title}
        </div>
        {message.detail ? (
          <p className="mt-2 text-xs leading-5 text-gray-600">
            {message.detail}
          </p>
        ) : null}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {ECOMMERCE_PUBLIC_STAGE_ORDER.map((stage, index) => (
            <div
              key={stage}
              className={[
                "rounded-xl border px-3 py-2 text-[11px] font-medium",
                index <= currentIndex
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-gray-200 bg-gray-50 text-gray-500",
              ].join(" ")}
            >
              <div>{`${index + 1}. ${ECOMMERCE_PUBLIC_STAGE_META[stage].label}`}</div>
              <div className="mt-1 text-[10px] font-normal opacity-80">
                {ECOMMERCE_PUBLIC_STAGE_META[stage].detail}
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (message.type === "ecomOneClick.analysis") {
    const competitorContext = state.competitorPlanningContext;
    return (
      <Card>
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Sparkles size={16} className="text-amber-500" />
          商品分析结论
        </div>
        {competitorContext ? (
          <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-3 text-xs text-amber-900">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">竞品策略已参与本轮商品分析</span>
              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-amber-700">
                参考了 {competitorContext.deckCount} 套竞品详情页
              </span>
              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-amber-700">
                会继续影响步骤二类型推荐
              </span>
            </div>
            <div className="mt-2 text-[11px] leading-5 text-amber-800/90">
              当前不是只分析你的商品本身，系统已经把竞品图序、叙事顺序和信息组织方式一起纳入判断。
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] leading-5 text-amber-800/90">
              {(competitorContext.recommendedPageSequence || [])
                .slice(0, 4)
                .map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-white px-2.5 py-1"
                  >
                    页序参考: {item}
                  </span>
                ))}
              {(competitorContext.borrowablePrinciples || [])
                .slice(0, 2)
                .map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-white px-2.5 py-1"
                  >
                    借鉴原则: {item}
                  </span>
                ))}
            </div>
          </div>
        ) : null}
        <div className="mt-3 rounded-xl bg-gray-50 px-3 py-3 text-xs leading-6 text-gray-700">
          {message.summary}
        </div>
        {message.review ? (
          <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-3 text-xs text-emerald-900">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">AI 复核意见</span>
              {getReviewSourceBadge(message.review) ? (
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-medium ${getReviewSourceBadge(message.review)?.className}`}
                >
                  {getReviewSourceBadge(message.review)?.text}
                </span>
              ) : null}
              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-emerald-700">
                置信度：
                {message.review.confidence === "high"
                  ? "高"
                  : message.review.confidence === "medium"
                    ? "中"
                    : "低"}
              </span>
            </div>
            <div className="mt-2 leading-5">{message.review.verdict}</div>
            {message.review.fallbackReason ? (
              <div className="mt-2 rounded-lg bg-white/80 px-3 py-2 text-[11px] leading-5 text-amber-700">
                说明：{message.review.fallbackReason}
              </div>
            ) : null}
            {message.review.reviewerNotes.length > 0 ? (
              <div className="mt-2 space-y-1 text-[11px] leading-5 text-emerald-800/90">
                {message.review.reviewerNotes.map((note, index) => (
                  <div key={`${note}-${index}`}>- {note}</div>
                ))}
              </div>
            ) : null}
            {message.review.risks && message.review.risks.length > 0 ? (
              <div className="mt-2 rounded-lg bg-white/80 px-3 py-2 text-[11px] leading-5 text-amber-700">
                风险提示：{message.review.risks.join("；")}
              </div>
            ) : null}
          </div>
        ) : null}
        {message.evolutionProposals && message.evolutionProposals.length > 0 ? (
          <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/80 px-3 py-3 text-xs text-violet-950">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">候选自进化提案</span>
              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-violet-700">
                只做显式候选，不会自动改规则
              </span>
            </div>
            <div className="mt-2 text-[11px] leading-5 text-violet-800/85">
              这些提案代表 AI 判断现有 archetype / 视觉语法对当前商品覆盖还不够精细，建议作为后续规则升级候选来审查。
            </div>
            <div className="mt-3 space-y-3">
              {message.evolutionProposals.map((proposal) => (
                <div
                  key={proposal.candidateId}
                  className="rounded-xl border border-violet-100 bg-white/90 px-3 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold text-violet-950">
                      {proposal.label}
                    </div>
                    <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-medium text-violet-700">
                      候选 ID：{proposal.candidateId}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">
                      置信度：
                      {proposal.confidence === "high"
                        ? "高"
                        : proposal.confidence === "medium"
                          ? "中"
                          : "低"}
                    </span>
                  </div>
                  <div className="mt-2 space-y-2 text-[11px] leading-5 text-violet-900/90">
                    <div>
                      <span className="font-medium text-violet-950">适用边界：</span>
                      {proposal.appliesWhen}
                    </div>
                    <div>
                      <span className="font-medium text-violet-950">为什么现有分类不够：</span>
                      {proposal.whyCurrentArchetypesFail}
                    </div>
                    {proposal.proposedDecisionFactors.length > 0 ? (
                      <div>
                        <span className="font-medium text-violet-950">新增判定因子：</span>
                        {proposal.proposedDecisionFactors.join("；")}
                      </div>
                    ) : null}
                    {proposal.proposedMustShow.length > 0 ? (
                      <div>
                        <span className="font-medium text-violet-950">必须展示：</span>
                        {proposal.proposedMustShow.join("；")}
                      </div>
                    ) : null}
                    {proposal.proposedVisualProofGrammar.length > 0 ? (
                      <div>
                        <span className="font-medium text-violet-950">建议视觉证明语法：</span>
                        {proposal.proposedVisualProofGrammar.join("；")}
                      </div>
                    ) : null}
                    {proposal.boundaryExamples.length > 0 ? (
                      <div>
                        <span className="font-medium text-violet-950">边界示例：</span>
                        {proposal.boundaryExamples.join("；")}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Card>
    );
  }

  if (message.type === "ecomOneClick.types") {
    const competitorContext = state.competitorPlanningContext;
    return (
      <Card>
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
            第 2 步
          </span>
          <FolderTree size={16} className="text-violet-500" />
          推荐输出类型
        </div>
        <div className="mt-1 text-xs leading-5 text-gray-500">
          先确认 AI 推荐的出图方向，再进入下一步补充关键信息。
        </div>
        {competitorContext ? (
          <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-amber-900">
              <span className="font-semibold">这一步已经受竞品分析影响</span>
              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-amber-700">
                已接入 {competitorContext.deckCount} 套竞品
              </span>
            </div>
            <div className="mt-2 text-[11px] leading-5 text-amber-800/90">
              当前推荐类型不是只按商品图单独判断，还会优先贴近竞品总结出的整套页序和单图职责。
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] leading-5 text-amber-800/90">
              {(competitorContext.recommendedPageSequence || [])
                .slice(0, 5)
                .map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-white px-2.5 py-1"
                  >
                    竞品页序: {item}
                  </span>
                ))}
            </div>
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-600">
          <span className="rounded-full bg-violet-50 px-3 py-1.5 text-violet-700">
            可多选，通常建议保留 4 到 7 类
          </span>
          <span className="rounded-full bg-white px-3 py-1.5 text-violet-700 ring-1 ring-violet-100">
            每张卡里的“建议生成 X 张”表示该类型后续会拆成 X 个方案项，不是只生成 1 张
          </span>
          <span className="rounded-full bg-gray-100 px-3 py-1.5">
            智能推荐 {recommendedTypeCount}
          </span>
          {requiredTypeCount > 0 ? (
            <span className="rounded-full bg-rose-50 px-3 py-1.5 text-rose-600">
              平台必需 {requiredTypeCount}
            </span>
          ) : null}
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
            已选 {selectedTypeCount}/{draftTypes.length}
          </span>
          {aiDirectRecommendedTypeCount > 0 ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
              AI 直出 {aiDirectRecommendedTypeCount} 项
            </span>
          ) : null}
          {mixedRecommendedTypeCount > 0 ? (
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">
              AI 补强 {mixedRecommendedTypeCount} 项
            </span>
          ) : null}
          {fallbackRecommendedTypeCount > 0 ? (
            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">
              兜底补全 {fallbackRecommendedTypeCount} 项
            </span>
          ) : null}
        </div>
        <div className="mt-3 space-y-3">
          <div className="rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-100">
                    当前推荐组合
                  </span>
                  <span className="text-xs text-gray-500">
                    先保留平台必需项，再围绕转化目标补足核心项和备选项
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedTypeTitles.length > 0 ? (
                    selectedTypeTitles.map((title) => (
                      <span
                        key={title}
                        className="rounded-full bg-white px-2.5 py-1 text-[11px] text-violet-700 ring-1 ring-violet-100"
                      >
                        {title}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-amber-700">
                      尚未选择，建议先使用“采用推荐组合”
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isSavingTypes}
                  onClick={() =>
                    setDraftTypes((prev) =>
                      prev.map((item) => ({
                        ...item,
                        selected: Boolean(item.required || item.recommended),
                      })),
                    )
                  }
                  className={[
                    "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                    isSavingTypes
                      ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                      : "border-violet-200 bg-white text-violet-700 hover:border-violet-300",
                  ].join(" ")}
                >
                  采用推荐组合
                </button>
                <button
                  type="button"
                  disabled={isSavingTypes}
                  onClick={() =>
                    setDraftTypes((prev) =>
                      prev.map((item) => ({
                        ...item,
                        selected: Boolean(item.required),
                      })),
                    )
                  }
                  className={[
                    "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                    isSavingTypes
                      ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300",
                  ].join(" ")}
                >
                  仅保留必需项
                </button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {draftTypes.map((item) => (
              <div
                key={item.id}
                className={[
                  "rounded-2xl border px-3.5 py-3 transition",
                  item.selected
                    ? "border-emerald-400 bg-emerald-50/90 shadow-[0_10px_28px_rgba(16,185,129,0.14)] ring-1 ring-emerald-200"
                    : "border-gray-200 bg-gray-50/80",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      !isSavingTypes &&
                      setDraftTypes((prev) =>
                        prev.map((current) =>
                          current.id === item.id
                            ? { ...current, selected: !current.selected }
                            : current,
                        ),
                      )
                    }
                    disabled={isSavingTypes}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {item.title}
                      </span>
                      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-100">
                        建议拆成 {item.imageCount} 个方案项
                      </span>
                    </span>
                    {item.goal ? (
                      <span className="mt-1 block text-[11px] leading-5 text-gray-500">
                        目标：{item.goal}
                      </span>
                    ) : null}
                    <span className="mt-2 block text-xs leading-5 text-gray-600">
                      {item.reason || item.description}
                    </span>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        !isSavingTypes &&
                        setDraftTypes((prev) =>
                          prev.map((current) =>
                            current.id === item.id
                              ? { ...current, selected: !current.selected }
                              : current,
                          ),
                        )
                      }
                      disabled={isSavingTypes}
                      className={[
                        "rounded-full border px-2.5 py-1 text-[10px] font-semibold transition active:scale-[0.99]",
                        isSavingTypes
                          ? "cursor-not-allowed border-gray-200 bg-white text-gray-400"
                          : item.selected
                            ? "border-emerald-200 bg-white text-emerald-700"
                            : "border-gray-200 bg-white text-gray-500 hover:border-gray-300",
                      ].join(" ")}
                    >
                      {item.selected ? "已选中" : "未选中"}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleTypeDetail(item.id)}
                      className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-50"
                    >
                      {expandedTypeDetailIds[item.id] ? "收起详情" : "展开详情"}
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                  <span className="rounded-full bg-white px-2 py-1 text-gray-600">
                    {PRIORITY_LABELS[item.priority] || item.priority}
                  </span>
                  {item.recommended ? (
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                      推荐优先
                    </span>
                  ) : null}
                  {item.required ? (
                    <span className="rounded-full bg-rose-50 px-2 py-1 text-rose-600">
                      平台必需
                    </span>
                  ) : null}
                  {item.confidence ? (
                    <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-700">
                      把握度
                      {item.confidence === "high"
                        ? "高"
                        : item.confidence === "medium"
                          ? "中"
                          : "低"}
                    </span>
                  ) : null}
                  {getRecommendedTypeSourceBadge(item) ? (
                    <span
                      className={`rounded-full px-2 py-1 ${getRecommendedTypeSourceBadge(item)?.className}`}
                    >
                      {getRecommendedTypeSourceBadge(item)?.text}
                    </span>
                  ) : null}
                </div>

                {item.highlights && item.highlights.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-gray-500">
                    {item.highlights.slice(0, 4).map((highlight) => (
                      <span
                        key={highlight}
                        className="rounded-full bg-white px-2 py-1"
                      >
                        {highlight}
                      </span>
                    ))}
                    {item.highlights.length > 4 ? (
                      <span className="rounded-full bg-white px-2 py-1 text-gray-400">
                        +{item.highlights.length - 4}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {expandedTypeDetailIds[item.id] ? (
                  <div className="mt-3 space-y-2 border-t border-white/80 pt-3">
                    <div className="rounded-xl bg-white px-3 py-2.5 text-xs leading-6 text-gray-600">
                      <span className="font-semibold text-gray-800">类型说明：</span>
                      {item.description}
                    </div>
                    {item.reason ? (
                      <div className="rounded-xl bg-white px-3 py-2.5 text-xs leading-6 text-gray-600">
                        <span className="font-semibold text-gray-800">推荐理由：</span>
                        {item.reason}
                      </div>
                    ) : null}
                    {item.evidence && item.evidence.length > 0 ? (
                      <div className="rounded-xl bg-white px-3 py-2.5 text-xs leading-6 text-gray-600">
                        <span className="font-semibold text-gray-800">判断依据：</span>
                        {item.evidence.join("；")}
                      </div>
                    ) : null}
                    {item.fallbackReason ? (
                      <div
                        className={[
                          "rounded-xl bg-white px-3 py-2.5 text-xs leading-6",
                          item.source === "fallback"
                            ? "text-amber-700"
                            : "text-sky-700",
                        ].join(" ")}
                      >
                        {item.source === "fallback" ? "来源说明：" : "补强说明："}
                        {item.fallbackReason}
                      </div>
                    ) : null}
                    {item.platformTags.length > 0 ? (
                      <div className="flex flex-wrap gap-2 text-[10px] text-gray-500">
                        {item.platformTags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-gray-900 px-2 py-1 text-white/90"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          {draftTypes.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs leading-6 text-gray-600">
                已选择 {selectedTypeCount}/{draftTypes.length} 种输出类型。
                {selectedTypeCount === 0
                  ? " 请至少选择 1 种需要继续策划的图型。"
                  : selectedTypeCount < 4
                    ? " 当前选择偏少，通常建议至少保留 4 类。"
                    : " 当前可以进入下一步补充关键信息。"}
              </div>
              <button
                type="button"
                onClick={() => void handleConfirmTypesAction()}
                disabled={isSavingTypes || selectedTypeCount === 0}
                className={[
                  "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                  isSavingTypes
                    ? "cursor-wait bg-gray-300 text-white"
                    : selectedTypeCount === 0
                      ? "cursor-not-allowed bg-gray-300 text-white"
                    : "bg-gray-900 text-white hover:bg-black",
                ].join(" ")}
              >
                {isSavingTypes
                  ? "保存中..."
                  : selectedTypeCount === 0
                    ? "请先选择类型"
                    : "保存类型选择"}
              </button>
            </div>
          ) : null}
          {renderAnalysisFeedbackCard()}
        </div>
      </Card>
    );
  }

  if (message.type === "ecomOneClick.supplements") {
    return (
      <Card>
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
            第 3 步
          </span>
          <FolderTree size={16} className="text-indigo-500" />
          补充信息字段
        </div>
        <div className="mt-1 text-xs leading-5 text-gray-500">
          这一阶段只负责补齐业务信息，不再重复展示上一步的类型选择内容。
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-600">
          <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-indigo-700">
            请尽量补齐关键项，系统会用这些信息修正后续分析和方案
          </span>
          <span className="rounded-full bg-cyan-50 px-3 py-1.5 text-cyan-700">
            补图为建议项，不会阻塞继续
          </span>
          <span className="rounded-full bg-gray-100 px-3 py-1.5">
            关键项 {requiredSupplementCount} 项
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
            已填写 {answeredSupplementCount} 项
          </span>
          {estimatedSupplementCount > 0 ? (
            <span className="rounded-full bg-sky-50 px-3 py-1.5 text-sky-700">
              AI 估填 {estimatedSupplementCount} 项
            </span>
          ) : null}
          {aiSupplementCount > 0 ? (
            <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-indigo-700">
              AI 推断 {aiSupplementCount} 项
            </span>
          ) : null}
          {userConfirmedSupplementCount > 0 ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
              已手动确认 {userConfirmedSupplementCount} 项
            </span>
          ) : null}
          <span className="rounded-full bg-sky-50 px-3 py-1.5 text-sky-700">
            关键项完成 {answeredRequiredSupplementCount}/{requiredSupplementCount}
          </span>
          {pendingRequiredFields.length > 0 ? (
            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">
              待补关键项 {pendingRequiredFields.length}
            </span>
          ) : (
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
              关键项已补齐
            </span>
          )}
        </div>
        <div className="mt-3 space-y-3">
          <div
            className={
              supplementValidationError
                ? "rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-xs leading-6 text-rose-700"
                : "hidden"
            }
            aria-hidden={!supplementValidationError}
          >
            {supplementValidationError ? (
              <>
                <div className="font-semibold text-rose-800">
                  保存前还有信息需要处理
                </div>
                <div className="mt-1">{supplementValidationError}</div>
              </>
            ) : null}
          </div>
          <div
            className={
              supplementAutofillMessage
                ? "rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-xs leading-6 text-sky-700"
                : "hidden"
            }
            aria-hidden={!supplementAutofillMessage}
          >
            {supplementAutofillMessage ? (
              <>
                <div className="font-semibold text-sky-800">AI 补全结果</div>
                <div className="mt-1">{supplementAutofillMessage}</div>
              </>
            ) : null}
          </div>
          <div
            className={[
              "rounded-2xl border px-4 py-3",
              hasPendingRequiredFields
                ? "border-amber-100 bg-amber-50/70"
                : "border-emerald-100 bg-emerald-50/70",
            ].join(" ")}
          >
            <div className="text-sm font-semibold text-gray-900">
              {hasPendingRequiredFields ? "当前优先补齐这些关键项" : "关键项状态已达标"}
            </div>
            <div className="mt-1 text-xs leading-6 text-gray-600">
              {hasPendingRequiredFields
                ? "这些信息会直接影响后续图片分析、方案规划和最终提示词质量。若你不清楚，稍后也可以先让 AI 保守估填。"
                : "当前关键项已经补齐，后续你只需要核对 AI 估填内容或继续补充可选项即可。"}
            </div>
            {hasPendingRequiredFields ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {pendingRequiredFields.map((field) => (
                  <button
                    key={field.id}
                    type="button"
                    onClick={() => scrollToSupplementField(field.id)}
                    className="rounded-full bg-white px-2.5 py-1 text-[11px] text-amber-700 transition hover:bg-amber-100"
                  >
                    {field.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] text-emerald-700">
                当前可以直接保存补充信息
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {hasDraftSupplementFields
              ? draftFields.map((field) => (
                  <React.Fragment key={field.id}>
                    {renderSupplementFieldCard(field)}
                  </React.Fragment>
                ))
              : null}
          </div>
          {!hasDraftSupplementFields ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-3 text-xs text-gray-500">
              当前没有需要补充的信息字段。
            </div>
          ) : null}
          <div
            className={
              hasDraftSupplementFields
                ? "flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                : "hidden"
            }
            aria-hidden={!hasDraftSupplementFields}
          >
            {hasDraftSupplementFields ? (
              <>
              <div className="text-xs leading-6 text-gray-600">
                {supplementSummaryText}{" "}
                {estimatedSupplementCount > 0
                  ? `当前有 ${estimatedSupplementCount} 项是 AI 估填，建议你优先核对。`
                  : ""}
                {estimatedSupplementCount > 0 ? " " : ""}
                单选题请选择 1 项，多选题可按题目要求选择多项；如果没有合适选项，可以直接输入自定义答案。补图项仅用于增强后续生成，不会卡住流程；不确定的文本项也可以先点“AI 帮我补可推断项”。
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                {onAutofillSupplements ? (
                  <button
                    type="button"
                    onClick={() => void handleAutofillSupplementsAction()}
                    disabled={supplementInputsDisabled}
                    className={[
                      "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                      supplementInputsDisabled
                        ? "cursor-not-allowed bg-sky-100 text-sky-300"
                        : "bg-sky-600 text-white hover:bg-sky-700",
                    ].join(" ")}
                  >
                    {isAutofillingSupplements
                      ? "AI 补全中..."
                      : "AI 帮我补可推断项"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleConfirmSupplementsAction()}
                  disabled={supplementInputsDisabled}
                  className={[
                    "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                    supplementInputsDisabled
                      ? "cursor-wait bg-gray-300 text-white"
                      : "bg-gray-900 text-white hover:bg-black",
                  ].join(" ")}
                >
                  {isSavingSupplements ? "保存中..." : "保存补充信息"}
                </button>
              </div>
              </>
            ) : null}
          </div>
          {renderAnalysisFeedbackCard()}
        </div>
      </Card>
    );
  }

  if (message.type === "ecomOneClick.supplementQuestionsBlocked") {
    const blockedReason = parseBlockedReasonMessage(message.reason);
    return (
      <Card>
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
            第 3 步
          </span>
          <FolderTree size={16} className="text-rose-500" />
          补充信息问题生成被拦截
        </div>
        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-4 text-sm leading-7 text-rose-800">
          <div className="font-semibold text-rose-900">
            这次没有再偷偷使用兜底问题
          </div>
          <div className="mt-2">
            {blockedReason.intro || message.reason}
          </div>
          {blockedReason.details.length > 0 ? (
            <div className="mt-3 rounded-xl bg-white/75 px-3 py-3 text-xs leading-6 text-rose-900">
              <div className="font-semibold text-rose-950">这次被拦截的具体原因</div>
              <div className="mt-2 space-y-1.5">
                {blockedReason.details.map((detail, index) => (
                  <div key={`${detail}-${index}`}>- {detail}</div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-3 text-xs leading-6 text-rose-700">
            你现在可以自己决定是继续重试 AI 动态补题，还是临时使用保守兜底问题推进流程。
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void onRetrySupplementQuestions?.()}
            disabled={!onRetrySupplementQuestions}
            className={[
              "rounded-lg px-3 py-2 text-xs font-semibold transition active:scale-[0.99]",
              onRetrySupplementQuestions
                ? "bg-rose-600 text-white hover:bg-rose-700"
                : "cursor-not-allowed bg-gray-200 text-gray-400",
            ].join(" ")}
          >
            重试生成补题
          </button>
          <button
            type="button"
            onClick={() => void onUseSupplementFallback?.()}
            disabled={!onUseSupplementFallback}
            className={[
              "rounded-lg px-3 py-2 text-xs font-semibold transition active:scale-[0.99]",
              onUseSupplementFallback
                ? "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                : "cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400",
            ].join(" ")}
          >
            使用保守兜底问题
          </button>
        </div>
      </Card>
    );
  }

  if (message.type === "ecomOneClick.planGroupsBlocked") {
    const blockedReason = parseBlockedReasonMessage(message.reason);
    return (
      <Card>
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
            第 5 步
          </span>
          <Sparkles size={16} className="text-amber-500" />
          方案规划生成被拦截
        </div>
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-4 text-sm leading-7 text-amber-800">
          <div className="font-semibold text-amber-900">
            这次没有再偷偷使用兜底方案骨架
          </div>
          <div className="mt-2">
            {blockedReason.intro || message.reason}
          </div>
          {blockedReason.details.length > 0 ? (
            <div className="mt-3 rounded-xl bg-white/75 px-3 py-3 text-xs leading-6 text-amber-900">
              <div className="font-semibold text-amber-950">这次被拦截的具体原因</div>
              <div className="mt-2 space-y-1.5">
                {blockedReason.details.map((detail, index) => (
                  <div key={`${detail}-${index}`}>- {detail}</div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-3 text-xs leading-6 text-amber-700">
            你现在可以自己决定是继续重试 AI 方案规划，还是临时使用保守兜底方案骨架推进流程。
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void onRetryPlanGroups?.()}
            disabled={!onRetryPlanGroups}
            className={[
              "rounded-lg px-3 py-2 text-xs font-semibold transition active:scale-[0.99]",
              onRetryPlanGroups
                ? "bg-amber-600 text-white hover:bg-amber-700"
                : "cursor-not-allowed bg-gray-200 text-gray-400",
            ].join(" ")}
          >
            重试生成方案
          </button>
          <button
            type="button"
            onClick={() => void onUsePlanFallback?.()}
            disabled={!onUsePlanFallback}
            className={[
              "rounded-lg px-3 py-2 text-xs font-semibold transition active:scale-[0.99]",
              onUsePlanFallback
                ? "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                : "cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400",
            ].join(" ")}
          >
            使用保守兜底方案骨架
          </button>
        </div>
      </Card>
    );
  }

  if (message.type === "ecomOneClick.imageAnalyses") {
    return (
      <Card>
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
          <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">
            第 4 步
          </span>
          <Images size={16} className="text-cyan-500" />
          图片分析
        </div>
        {message.review ? (
          <div className="mt-3 rounded-xl border border-cyan-100 bg-cyan-50/70 px-3 py-3 text-xs text-cyan-900">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">图片复核意见</span>
              {getReviewSourceBadge(message.review) ? (
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-medium ${getReviewSourceBadge(message.review)?.className}`}
                >
                  {getReviewSourceBadge(message.review)?.text}
                </span>
              ) : null}
              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-cyan-700">
                置信度：
                {message.review.confidence === "high"
                  ? "高"
                  : message.review.confidence === "medium"
                    ? "中"
                    : "低"}
              </span>
            </div>
            <div className="mt-2 leading-5">{message.review.verdict}</div>
            {message.review.fallbackReason ? (
              <div className="mt-2 rounded-lg bg-white/80 px-3 py-2 text-[11px] leading-5 text-amber-700">
                说明：{message.review.fallbackReason}
              </div>
            ) : null}
            {message.review.reviewerNotes.length > 0 ? (
              <div className="mt-2 space-y-1 text-[11px] leading-5 text-cyan-800/90">
                {message.review.reviewerNotes.map((note, index) => (
                  <div key={`${note}-${index}`}>- {note}</div>
                ))}
              </div>
            ) : null}
            {message.review.risks && message.review.risks.length > 0 ? (
              <div className="mt-2 rounded-lg bg-white/80 px-3 py-2 text-[11px] leading-5 text-amber-700">
                风险提示：{message.review.risks.join("；")}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-600">
          <span className="rounded-full bg-cyan-50 px-3 py-1.5 text-cyan-700">
            请重点确认哪些图片适合作为后续参考图
          </span>
          <span className="rounded-full bg-gray-100 px-3 py-1.5">
            共 {draftImageAnalyses.length} 张
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
            可参考{" "}
            {
              draftImageAnalyses.filter((item) => item.usableAsReference).length
            }{" "}
            张
          </span>
          {aiDirectImageAnalysisCount > 0 ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
              AI 直出 {aiDirectImageAnalysisCount} 张
            </span>
          ) : null}
          {mixedImageAnalysisCount > 0 ? (
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">
              AI 补强 {mixedImageAnalysisCount} 张
            </span>
          ) : null}
          {fallbackImageAnalysisCount > 0 ? (
            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">
              单图兜底 {fallbackImageAnalysisCount} 张
            </span>
          ) : null}
        </div>
        <div className="mt-3 space-y-2">
          {draftImageAnalyses.map((item) => {
            const sourceImage = state.productImages.find(
              (image) => image.id === item.imageId,
            );
            const sourceBadge = getImageAnalysisSourceBadge(item);
            const decisionMeta = getImageDecisionMeta(item);
            return (
              <div
                key={item.imageId}
                className={[
                  "rounded-2xl border bg-gray-50/80 px-4 py-4",
                  highlightedAutofilledImageIds.includes(item.imageId)
                    ? "border-cyan-300 ring-1 ring-cyan-200"
                    : "border-gray-200",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  {sourceImage ? (
                    <img
                      src={sourceImage.url}
                      alt={sourceImage.name || item.title}
                      className="h-20 w-20 shrink-0 rounded-xl border border-gray-200 bg-white object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <input
                        type="text"
                        value={item.title}
                        disabled={imageAnalysisInputsDisabled}
                        onChange={(event) =>
                          updateImageAnalysis(item.imageId, (current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-sm font-medium text-gray-800 outline-none transition focus:border-gray-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                      />
                    </div>
                    {highlightedAutofilledImageIds.includes(item.imageId) ? (
                      <div className="mt-2 inline-flex rounded-full bg-cyan-100 px-2.5 py-1 text-[10px] font-semibold text-cyan-700">
                        AI 刚补全了这张图的分析
                      </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                      <span
                        className={`rounded-full px-2.5 py-1 font-semibold ${decisionMeta.roleMeta.className}`}
                      >
                        {decisionMeta.roleMeta.label}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateImageAnalysis(item.imageId, (current) => ({
                            ...current,
                            usableAsReference: !current.usableAsReference,
                          }))
                        }
                        disabled={imageAnalysisInputsDisabled}
                        className={[
                          "rounded-full border px-2.5 py-1 font-medium transition-colors active:scale-[0.99]",
                          imageAnalysisInputsDisabled
                            ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                            : item.usableAsReference
                              ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                              : "border-gray-200 bg-white text-gray-600",
                        ].join(" ")}
                      >
                        {item.usableAsReference ? "已标记为参考图" : "普通图"}
                      </button>
                      {item.confidence ? (
                        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">
                          把握度
                          {item.confidence === "high"
                            ? "高"
                            : item.confidence === "medium"
                              ? "中"
                              : "低"}
                        </span>
                      ) : null}
                      {getImageAnalysisSourceBadge(item) ? (
                        <span
                          className={`rounded-full px-2.5 py-1 ${getImageAnalysisSourceBadge(item)?.className}`}
                        >
                          {getImageAnalysisSourceBadge(item)?.text}
                        </span>
                      ) : null}
                      {item.materials && item.materials.length > 0 ? (
                        <span className="rounded-full bg-white px-2.5 py-1 text-gray-600">
                          材质 {item.materials.length} 项
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          void handleRetryImageAnalysisAction(item.imageId)
                        }
                        disabled={
                          imageAnalysisInputsDisabled ||
                          Boolean(retryingImageAnalysisId)
                        }
                        className={[
                          "rounded-full border px-2.5 py-1 font-medium transition-colors active:scale-[0.99]",
                          imageAnalysisInputsDisabled || retryingImageAnalysisId
                            ? "cursor-wait border-gray-200 bg-gray-100 text-gray-400"
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900",
                        ].join(" ")}
                      >
                        {retryingImageAnalysisId === item.imageId
                          ? "分析中..."
                          : isAutofillingImageAnalyses
                            ? "AI 补全中..."
                          : retryingImageAnalysisId
                            ? "请稍候..."
                            : "重试分析"}
                      </button>
                    </div>
                    <div className="mt-3 rounded-2xl border border-white/70 bg-white/90 px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-[11px] font-semibold tracking-wide text-gray-500">
                          核心结论
                        </div>
                        {sourceBadge ? (
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] ${sourceBadge.className}`}
                          >
                            {sourceBadge.text}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-sm font-semibold leading-6 text-gray-900">
                        {item.analysisConclusion || decisionMeta.roleMeta.summary}
                      </div>
                      <div className="mt-2 rounded-xl bg-amber-50/80 px-3 py-2 text-[11px] leading-6 text-amber-800">
                        判断理由：{decisionMeta.reasonText}
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-3">
                        <div className="rounded-xl bg-gray-50 px-3 py-2">
                          <div className="text-[10px] font-semibold tracking-wide text-gray-500">
                            建议用途
                          </div>
                          <div className="mt-1 text-[12px] leading-5 text-gray-700">
                            {decisionMeta.bestUse}
                          </div>
                        </div>
                        <div className="rounded-xl bg-gray-50 px-3 py-2">
                          <div className="text-[10px] font-semibold tracking-wide text-gray-500">
                            观察角度
                          </div>
                          <div className="mt-1 text-[12px] leading-5 text-gray-700">
                            {item.angle || "未明确标注角度"}
                          </div>
                        </div>
                        <div className="rounded-xl bg-gray-50 px-3 py-2">
                          <div className="text-[10px] font-semibold tracking-wide text-gray-500">
                            当前状态
                          </div>
                          <div className="mt-1 text-[12px] leading-5 text-gray-700">
                            {item.usableAsReference
                              ? "已纳入后续参考图候选"
                              : "暂不作为核心参考图"}
                            {` · 把握度${getConfidenceLabel(item.confidence)}`}
                          </div>
                        </div>
                      </div>
                      {decisionMeta.riskNotes.length > 0 ? (
                        <div className="mt-3 rounded-xl bg-rose-50/80 px-3 py-2 text-[11px] leading-6 text-rose-700">
                          {decisionMeta.riskNotes.join(" ")}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-3 text-[11px] font-semibold text-gray-500">
                      观察角度
                    </div>
                    <input
                      type="text"
                      value={item.angle || ""}
                      placeholder="角度：例如正前方、45 度侧拍、细节"
                      disabled={imageAnalysisInputsDisabled}
                      onChange={(event) =>
                        updateImageAnalysis(item.imageId, (current) => ({
                          ...current,
                          angle: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-600 outline-none transition focus:border-gray-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                    />
                    <div className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-[10px] leading-5 text-gray-500">
                      用一句话说明这张图的观察视角或焦点，后面的方案规划和生图会用到它。
                    </div>
                    <div className="mt-3 text-[11px] font-semibold text-gray-500">
                      产品详描
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 text-[11px] font-semibold text-gray-500">
                      <span>当前内容</span>
                      <span className="text-[10px] font-normal text-gray-400">
                        {String(item.description || "").trim().length} 字
                      </span>
                    </div>
                    <textarea
                      value={item.description}
                      disabled={imageAnalysisInputsDisabled}
                      onChange={(event) =>
                        updateImageAnalysis(item.imageId, (current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="只描述这张图里真实可见的产品和画面事实，例如外观、结构、材质、按钮接口、logo、背景与光线。"
                      className="mt-2 min-h-[112px] w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-[11px] leading-5 text-gray-600 outline-none transition focus:border-gray-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                    />
                    <div className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-[10px] leading-5 text-gray-500">
                      这里写图中真实看得到的产品和画面事实，不要把“是否适合作为参考图”的判断混写进来。
                    </div>
                    <div className="mt-3 text-[11px] font-semibold text-gray-500">
                      分析结论
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 text-[11px] font-semibold text-gray-500">
                      <span>当前内容</span>
                      <span className="text-[10px] font-normal text-gray-400">
                        {String(item.analysisConclusion || "").trim().length} 字
                      </span>
                    </div>
                    <textarea
                      value={item.analysisConclusion || ""}
                      disabled={imageAnalysisInputsDisabled}
                      onChange={(event) =>
                        updateImageAnalysis(item.imageId, (current) => ({
                          ...current,
                          analysisConclusion: event.target.value,
                        }))
                      }
                      placeholder="说明这张图是否适合作为参考图、适合支撑哪些后续任务、还缺什么关键信息。"
                      className="mt-2 min-h-[96px] w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-[11px] leading-5 text-gray-600 outline-none transition focus:border-gray-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                    />
                    <div className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-[10px] leading-5 text-gray-500">
                      这里写这张图为什么适合或不适合作为参考图，以及它能支持后面的哪些生成任务。
                    </div>
                    {item.highlights && item.highlights.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-gray-500">
                        {item.highlights.map((highlight) => (
                          <span
                            key={highlight}
                            className="rounded-full bg-white px-2 py-1"
                          >
                            {highlight}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {item.materials && item.materials.length > 0 ? (
                      <div className="mt-2 text-[11px] text-gray-500">
                        材质线索：{item.materials.join("、")}
                      </div>
                    ) : null}
                    {item.evidence && item.evidence.length > 0 ? (
                      <div className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-[11px] leading-6 text-gray-500">
                        判断依据：{item.evidence.join("；")}
                      </div>
                    ) : null}
                    {item.fallbackReason ? (
                      <div className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-[11px] leading-6 text-amber-700">
                        来源说明：{item.fallbackReason}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          {draftImageAnalyses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-3 text-xs text-gray-500">
              当前没有返回图片分析结果。
            </div>
          ) : null}
          {imageAnalysisAutofillMessage ? (
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50/80 px-4 py-3 text-xs leading-6 text-cyan-700">
              <div className="font-semibold text-cyan-800">AI 图片分析补全</div>
              <div className="mt-1">{imageAnalysisAutofillMessage}</div>
            </div>
          ) : null}
          {draftImageAnalyses.length > 0 ? (
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="text-[11px] text-gray-500">
                已选择
                {
                  draftImageAnalyses.filter((item) => item.usableAsReference)
                    .length
                }
                /{draftImageAnalyses.length} 张可作为参考图
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {onAutofillImageAnalyses ? (
                  <button
                    type="button"
                    onClick={() => void handleAutofillImageAnalysesAction()}
                    disabled={isAutofillingImageAnalyses || isSavingImageAnalyses}
                    className={[
                      "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                      isAutofillingImageAnalyses || isSavingImageAnalyses
                        ? "cursor-not-allowed bg-cyan-100 text-cyan-300"
                        : "bg-cyan-600 text-white hover:bg-cyan-700",
                    ].join(" ")}
                  >
                    {isAutofillingImageAnalyses
                      ? "AI 补全中..."
                      : "AI 智能补全分析"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleConfirmImageAnalysesAction()}
                  disabled={isSavingImageAnalyses || isAutofillingImageAnalyses}
                  className={[
                    "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                    isSavingImageAnalyses || isAutofillingImageAnalyses
                      ? "cursor-wait bg-gray-300 text-white"
                      : "bg-gray-900 text-white hover:bg-black",
                  ].join(" ")}
                >
                  {isSavingImageAnalyses ? "保存中..." : "保存图片分析"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </Card>
    );
  }

  if (message.type === "ecomOneClick.plans") {
    return (
      <>
        <Card>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Images size={16} className="text-sky-500" />
            方案规划（按组拆镜头）
          </div>
          {state.competitorPlanningContext ? (
            <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-3 text-xs text-amber-900">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">竞品策略已注入本轮规划</span>
                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-amber-700">
                  参考了 {state.competitorPlanningContext.deckCount} 套竞品详情页
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] leading-5 text-amber-800/90">
                {(state.competitorPlanningContext.recommendedPageSequence || [])
                  .slice(0, 4)
                  .map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-white px-2.5 py-1"
                    >
                      页序参考: {item}
                    </span>
                  ))}
                {(state.competitorPlanningContext.borrowablePrinciples || [])
                  .slice(0, 2)
                  .map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-white px-2.5 py-1"
                    >
                      借鉴: {item}
                    </span>
                  ))}
              </div>
            </div>
          ) : null}
          {message.review ? (
            <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-3 text-xs text-sky-900">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">方案复核意见</span>
                {getReviewSourceBadge(message.review) ? (
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-medium ${getReviewSourceBadge(message.review)?.className}`}
                  >
                    {getReviewSourceBadge(message.review)?.text}
                  </span>
                ) : null}
                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-sky-700">
                  置信度：
                  {message.review.confidence === "high"
                    ? "高"
                    : message.review.confidence === "medium"
                      ? "中"
                      : "低"}
                </span>
              </div>
              <div className="mt-2 leading-5">{message.review.verdict}</div>
              {message.review.reviewerNotes.length > 0 ? (
                <div className="mt-2 space-y-1 text-[11px] leading-5 text-sky-800/90">
                  {message.review.reviewerNotes.map((note, index) => (
                    <div key={`${note}-${index}`}>- {note}</div>
                  ))}
                </div>
              ) : null}
              {message.review.risks && message.review.risks.length > 0 ? (
                <div className="mt-2 rounded-lg bg-white/80 px-3 py-2 text-[11px] leading-5 text-amber-700">
                  风险提示：{message.review.risks.join("；")}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="mt-3 space-y-2.5">
            <div className="flex flex-wrap gap-2 text-[11px] text-gray-600">
              <span className="rounded-full bg-gray-100 px-3 py-1.5">
                分组 {visiblePlanGroups.length}/{draftPlanGroups.length}
              </span>
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
                镜头 {visiblePlanItemCount}/
                {draftPlanGroups.reduce((sum, group) => sum + group.items.length, 0)}
              </span>
              {planViewMode === "priority" ? (
                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">
                  当前视图：待确认优先组
                </span>
              ) : null}
              {planViewMode === "problem" ? (
                <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">
                  当前视图：仅问题组
                </span>
              ) : null}
              {aiDirectPlanGroupCount > 0 ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
                  AI 直出 {aiDirectPlanGroupCount} 组
                </span>
              ) : null}
              {mixedPlanGroupCount > 0 ? (
                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">
                  AI 补强 {mixedPlanGroupCount} 组
                </span>
              ) : null}
              {fallbackPlanGroupCount > 0 ? (
                <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">
                  兜底补全 {fallbackPlanGroupCount} 组
                </span>
              ) : null}
              {planFocusGroupId ? (
                <button
                  type="button"
                  onClick={() => setPlanFocusGroupId(null)}
                  className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-[11px] font-medium text-sky-700 transition hover:bg-sky-50"
                >
                  查看全部分组
                </button>
              ) : null}
              {draftPlanGroups.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={collapseAllPlanGroups}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
                  >
                    全部折叠
                  </button>
                  <button
                    type="button"
                    onClick={expandAllPlanGroups}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
                  >
                    全部展开
                  </button>
                </>
              ) : null}
            </div>
            {draftPlanGroups.length > 1 ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50/80 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold text-gray-800">
                      方案工作视图
                    </div>
                    <div className="mt-1 text-[10px] leading-5 text-gray-500">
                      先聚焦更该确认的方案组，再决定是否展开全部镜头明细。
                    </div>
                  </div>
                  <div className="inline-flex flex-wrap gap-1 rounded-full border border-gray-200 bg-white p-1">
                    {[
                      { key: "all", label: "全部", count: draftPlanGroups.length },
                      {
                        key: "priority",
                        label: "待确认优先组",
                        count: planPriorityGroupCount,
                      },
                      {
                        key: "problem",
                        label: "仅问题组",
                        count: planProblemGroupCount,
                      },
                    ].map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setPlanViewMode(option.key as PlanViewMode)}
                        className={[
                          "rounded-full px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                          planViewMode === option.key
                            ? option.key === "problem"
                              ? "bg-amber-500 text-white"
                              : option.key === "priority"
                                ? "bg-blue-600 text-white"
                                : "bg-gray-900 text-white"
                            : "text-gray-600 hover:bg-gray-100",
                        ].join(" ")}
                      >
                        {`${option.label} (${option.count})`}
                      </button>
                    ))}
                  </div>
                </div>
                {planFocusGroupId ? (
                  <div className="mt-2 rounded-xl bg-white px-3 py-2 text-[10px] leading-5 text-sky-700">
                    当前已锁定单个方案组，视图筛选会在退出“只看当前组”后生效。
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="mt-3 space-y-2.5">
            {visiblePlanGroups.map((group, groupIndex) => {
              const sourceGroupIndex = draftPlanGroups.findIndex(
                (candidate) => candidate.typeId === group.typeId,
              );
              const displayGroupIndex =
                sourceGroupIndex >= 0 ? sourceGroupIndex : groupIndex;
              const accent = getPlanGroupAccent(displayGroupIndex);
              const competitorRoleHint = getCompetitorRoleHint(
                group,
                state.competitorPlanningContext?.recommendedPageSequence || [],
              );
              const closestCompetitorDecks = getClosestCompetitorDecks(
                group,
                state.competitorAnalyses || [],
                state.competitorPlanningContext?.recommendedPageSequence || [],
              );
              const isCollapsed = Boolean(collapsedPlanGroupIds[group.typeId]);
              const groupResultCount = group.items.reduce(
                (sum, item) => sum + (resultCountByPlanItem[item.id] || 0),
                0,
              );
              const missingBaselineCount = Math.max(
                0,
                PLAN_ITEM_BASELINE_COUNT - group.items.length,
              );
              return (
                <div
                  key={group.typeId}
                  id={buildEcommercePlanGroupAnchorId(group.typeId)}
                  className={[
                    "rounded-2xl border p-2 shadow-sm",
                    accent.shell,
                    highlightedAutofilledPlanGroupIds.includes(group.typeId)
                      ? "ring-1 ring-sky-200"
                      : "",
                    navigatedPlanGroupId === group.typeId
                      ? "ring-2 ring-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.18)]"
                      : "",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "flex flex-wrap items-start justify-between gap-2 rounded-xl border px-2.5 py-2",
                      accent.header,
                    ].join(" ")}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-semibold ${accent.badge}`}
                        >
                          方案组 {displayGroupIndex + 1}
                        </span>
                        <div className="text-[13px] font-semibold text-gray-900">
                          {group.typeTitle}
                        </div>
                      </div>
                      {highlightedAutofilledPlanGroupIds.includes(group.typeId) ? (
                        <div className="mt-2 inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-semibold text-sky-700">
                          AI 刚补全了本组策略
                        </div>
                      ) : null}
                      {group.summary ? (
                        <div className="mt-1 max-w-[760px] text-[11px] leading-5 text-gray-500">
                          {group.summary}
                        </div>
                      ) : null}
                      {competitorRoleHint ? (
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                          <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-800">
                            竞品参考位：{competitorRoleHint.label}
                          </span>
                          <span className="rounded-full bg-white px-2 py-1 text-gray-600">
                            对应页序：{competitorRoleHint.matchedText}
                          </span>
                        </div>
                      ) : null}
                      {closestCompetitorDecks.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                          {closestCompetitorDecks.map((deck) => (
                            <span
                              key={`${group.typeId}-${deck.competitorId}`}
                              className="rounded-full bg-indigo-50 px-2 py-1 font-medium text-indigo-700"
                            >
                              更像：{deck.label}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] text-gray-500">
                        <span className="rounded-full bg-white px-2 py-1">
                          本组 {group.items.length} 项
                        </span>
                        {missingBaselineCount > 0 ? (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">
                            距建议基线还差 {missingBaselineCount} 张
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">
                            已达到镜头基线
                          </span>
                        )}
                        <span className="rounded-full bg-white px-2 py-1">
                          本组已出图 {groupResultCount} 张
                        </span>
                        {group.priority ? (
                          <span className="rounded-full bg-white px-2 py-1">
                            {PRIORITY_LABELS[group.priority] || group.priority}
                          </span>
                        ) : null}
                        {group.platformTags && group.platformTags.length > 0
                          ? group.platformTags.slice(0, 2).map((tag) => (
                              <span
                                key={`${group.typeId}-${tag}`}
                                className="rounded-full bg-gray-900 px-2 py-1 text-white/90"
                              >
                                {tag}
                              </span>
                            ))
                          : null}
                        {group.platformTags && group.platformTags.length > 2 ? (
                          <span className="rounded-full bg-white px-2 py-1 text-gray-500">
                            +{group.platformTags.length - 2} 平台
                          </span>
                        ) : null}
                        {getPlanGroupSourceBadge(group) ? (
                          <span
                            className={`rounded-full px-2 py-1 ${getPlanGroupSourceBadge(group)?.className}`}
                          >
                            {getPlanGroupSourceBadge(group)?.text}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] text-gray-500">
                        {group.items.map((item, itemIndex) => (
                          <span
                            key={`${group.typeId}-${item.id}-overview`}
                            className="rounded-full bg-white px-2 py-1"
                          >
                            图{itemIndex + 1}：{summarizeText(item.title, 16)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => togglePlanGroupCollapsed(group.typeId)}
                        className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[10px] font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
                      >
                        {isCollapsed ? "展开本组" : "折叠本组"}
                      </button>
                      <button
                        type="button"
                        onClick={() => togglePlanFocusGroup(group.typeId)}
                        className={[
                          "rounded-full border px-2 py-1 text-[10px] font-medium transition",
                          planFocusGroupId === group.typeId
                            ? "border-sky-200 bg-sky-50 text-sky-700"
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900",
                        ].join(" ")}
                      >
                        {planFocusGroupId === group.typeId
                          ? "已只看本组"
                          : "只看当前组"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void handleGenerateExtraPlanItem(group.typeId)
                        }
                        disabled={
                          aiAddingGroupId === group.typeId || planInputsDisabled
                        }
                        className={[
                          "rounded-full px-2 py-1 text-[10px] font-medium transition active:scale-[0.99]",
                          aiAddingGroupId === group.typeId || planInputsDisabled
                            ? "cursor-wait bg-blue-100 text-blue-300"
                            : "bg-blue-600 text-white hover:bg-blue-700",
                        ].join(" ")}
                      >
                        {aiAddingGroupId === group.typeId
                          ? "AI 补图中..."
                          : isAutofillingPlans
                            ? "AI 补全中..."
                            : "AI 补一张"}
                      </button>
                      <button
                        type="button"
                        onClick={() => addPlanItems(group.typeId, 2)}
                        disabled={planInputsDisabled}
                        className={[
                          "rounded-full border px-2 py-1 text-[10px] font-medium transition active:scale-[0.99]",
                          planInputsDisabled
                            ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                            : "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100",
                        ].join(" ")}
                      >
                        快速 +2 张
                      </button>
                      <button
                        type="button"
                        onClick={() => addPlanItem(group.typeId)}
                        disabled={planInputsDisabled}
                        className={[
                          "rounded-full border px-2 py-1 text-[10px] font-medium transition active:scale-[0.99]",
                          planInputsDisabled
                            ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900",
                        ].join(" ")}
                      >
                        手动新增
                      </button>
                    </div>
                  </div>
                {isCollapsed ? (
                  <div className="mt-2 rounded-lg border border-dashed border-gray-200 bg-white/80 px-3 py-2 text-[11px] text-gray-500">
                    本组已折叠：共 {group.items.length} 项，已出图 {groupResultCount} 张。
                  </div>
                ) : null}
                {!isCollapsed ? (
                  <div className="mt-2 space-y-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4 text-white shadow-sm">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="rounded-full bg-amber-500 px-2 py-1 font-semibold text-white">
                          方案文案
                        </span>
                      </div>
                      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-4">
                        <div className="text-[15px] font-semibold leading-7 text-white">
                          {group.summary ||
                            `围绕“${group.typeTitle}”统一镜头语言与卖点表达，先定义这组的拍摄原则，再拆解成多张图片。`}
                        </div>
                        {group.strategy && group.strategy.length > 0 ? (
                          <div className="mt-4 grid gap-3">
                            {group.strategy.map((entry) => (
                              <div
                                key={`${group.typeId}-${entry.label}`}
                                className="flex gap-3 text-[13px] leading-6 text-white/85"
                              >
                                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                                <div>
                                  <span className="font-semibold text-amber-300">
                                    {entry.label}：
                                  </span>
                                  {entry.value}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-4 text-[12px] leading-6 text-white/55">
                            本组暂未补充策略字段，建议先明确目标、卖点和画面原则，再继续扩镜头。
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded-full bg-gray-900 px-2.5 py-1 text-white">
                        图片规划
                      </span>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                        {group.items.length} 张
                      </span>
                      <div className="flex flex-wrap gap-1.5 text-[10px] text-gray-500">
                        {group.items.map((item, itemIndex) => (
                          <span
                            key={`${group.typeId}-${item.id}-shot-chip`}
                            className="rounded-full bg-white px-2 py-1"
                          >
                            图{itemIndex + 1} {summarizeText(item.title, 14)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
                {!isCollapsed ? (
                <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
                  {group.items.map((item, itemIndex) => {
                    const itemCompetitorRoleHint = getCompetitorRoleHintFromTexts(
                      [
                        group.typeTitle,
                        group.summary,
                        item.title,
                        item.description,
                        item.marketingGoal,
                        item.keyMessage,
                        item.composition,
                      ],
                      state.competitorPlanningContext?.recommendedPageSequence || [],
                    );
                    const closestItemCompetitorDecks = getClosestCompetitorDecksForItem(
                      group,
                      item,
                      state.competitorAnalyses || [],
                      state.competitorPlanningContext?.recommendedPageSequence || [],
                    );

                    return (
                    <div
                      key={item.id}
                      className={[
                        "rounded-xl border px-2.5 py-2.5 shadow-sm",
                        "bg-gradient-to-br from-white to-gray-50/80",
                        accent.itemBorder,
                        accent.line,
                        "border-l-4",
                        highlightedAutofilledPlanItemIds.includes(item.id)
                          ? "ring-1 ring-sky-100"
                          : "",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                            <span className="rounded-lg bg-gray-900 px-2.5 py-1 font-semibold text-white">
                              {itemIndex + 1}
                            </span>
                            <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-600">
                              组{displayGroupIndex + 1} · {group.typeTitle}
                            </span>
                          </div>
                          <input
                            type="text"
                            value={item.title}
                            disabled={
                              planInputsDisabled ||
                              generatingPlanItemId === item.id ||
                              rewritingPlanItemId === item.id
                            }
                            onChange={(event) =>
                              updatePlanItem(
                                group.typeId,
                                item.id,
                                (current) => ({
                                  ...current,
                                  title: event.target.value,
                                }),
                              )
                            }
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[14px] font-semibold text-gray-900 outline-none transition focus:border-gray-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                          />
                          {highlightedAutofilledPlanItemIds.includes(item.id) ? (
                            <div className="mt-2 inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-semibold text-sky-700">
                              AI 刚补全了这一项方案
                            </div>
                          ) : null}
                          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] text-gray-500">
                            <span className="rounded-full bg-gray-100 px-2 py-1">
                              状态：
                              {BATCH_STATUS_LABELS[item.status] || item.status}
                            </span>
                            <span className="rounded-full bg-gray-100 px-2 py-1">
                              已出图 {resultCountByPlanItem[item.id] || 0} 张
                            </span>
                            {item.referenceImageIds.length > 0 ? (
                              <span className="rounded-full bg-gray-100 px-2 py-1">
                                参考图 {item.referenceImageIds.length} 张
                              </span>
                            ) : null}
                            {itemCompetitorRoleHint ? (
                              <>
                                <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">
                                  竞品位：{itemCompetitorRoleHint.label}
                                </span>
                                <span className="rounded-full bg-white px-2 py-1 text-gray-600">
                                  {itemCompetitorRoleHint.matchedText}
                                </span>
                              </>
                            ) : null}
                            {closestItemCompetitorDecks.map((deck) => (
                              <span
                                key={`${item.id}-${deck.competitorId}`}
                                className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-700"
                                title={deck.reason}
                              >
                                更像：{deck.label}
                              </span>
                            ))}
                          </div>
                          {closestItemCompetitorDecks.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-indigo-700">
                              {closestItemCompetitorDecks.map((deck) => (
                                <span
                                  key={`${item.id}-${deck.competitorId}-reason`}
                                  className="rounded-full bg-indigo-50/70 px-2 py-1"
                                >
                                  {deck.label}：{deck.reason}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <select
                          value={item.ratio}
                          disabled={
                            planInputsDisabled ||
                            generatingPlanItemId === item.id ||
                            rewritingPlanItemId === item.id
                          }
                          onChange={(event) =>
                            updatePlanItem(
                              group.typeId,
                              item.id,
                              (current) => ({
                                ...current,
                                ratio: event.target.value,
                              }),
                            )
                          }
                          className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1 text-[10px] text-gray-600 outline-none transition focus:border-gray-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                        >
                          <option value="1:1">1:1</option>
                          <option value="3:4">3:4</option>
                          <option value="4:5">4:5</option>
                          <option value="16:9">16:9</option>
                          <option value="9:16">9:16</option>
                        </select>
                      </div>
                      <textarea
                        value={item.description}
                        disabled={
                          planInputsDisabled ||
                          generatingPlanItemId === item.id ||
                          rewritingPlanItemId === item.id
                        }
                        onChange={(event) =>
                          updatePlanItem(group.typeId, item.id, (current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        className="mt-1.5 min-h-[112px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[12px] leading-6 text-gray-700 outline-none transition focus:border-gray-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                      />
                      <div className="mt-1.5 rounded-lg border border-dashed border-violet-200 bg-violet-50/60 px-3 py-2 text-[11px] leading-5 text-violet-700">
                        生图提示词将在“批量生成”阶段统一生成，可逐条编辑确认后再执行生图。
                      </div>
                      <div className="mt-1 flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => removePlanItem(group.typeId, item.id)}
                          disabled={planInputsDisabled}
                          className={[
                            "text-[10px] font-medium transition active:scale-[0.99]",
                            planInputsDisabled
                              ? "cursor-not-allowed text-gray-300"
                               : "text-gray-500 hover:text-red-600",
                          ].join(" ")}
                        >
                          删除该图
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
                ) : null}
              </div>
              );
            })}
            {visiblePlanGroups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/70 px-4 py-4 text-xs leading-6 text-amber-800">
                <div className="font-semibold">
                  {planViewMode === "priority"
                    ? "当前没有命中的待确认优先组"
                    : planViewMode === "problem"
                      ? "当前没有命中的问题组"
                      : "当前还没有可编辑的方案分组"}
                </div>
                <div className="mt-1">
                  {planViewMode === "all"
                    ? "这次没有用兜底内容硬补出“看起来完整”的方案。建议补充更明确的商品说明、关键参考图或平台目标后再重新生成。"
                    : "可先切回“全部”查看完整方案列表，或继续补充商品信息后重新生成。"}
                </div>
                {planViewMode !== "all" ? (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setPlanViewMode("all")}
                      className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-100"
                    >
                      切回全部分组
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {planAutofillMessage ? (
              <div className="rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-xs leading-6 text-sky-700">
                <div className="font-semibold text-sky-800">AI 方案补全</div>
                <div className="mt-1">{planAutofillMessage}</div>
              </div>
            ) : null}
            {draftPlanGroups.length > 0 ? (
              <div className="flex flex-wrap justify-end gap-2">
                {onAutofillPlans ? (
                  <button
                    type="button"
                    onClick={() => void handleAutofillPlansAction()}
                    disabled={isAutofillingPlans || isSavingPlans}
                    className={[
                      "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                      isAutofillingPlans || isSavingPlans
                        ? "cursor-not-allowed bg-sky-100 text-sky-300"
                        : "bg-sky-600 text-white hover:bg-sky-700",
                    ].join(" ")}
                  >
                    {isAutofillingPlans ? "AI 补全中..." : "AI 智能补全方案"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleConfirmPlansAction()}
                  disabled={isSavingPlans || isAutofillingPlans}
                  className={[
                    "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                    isSavingPlans || isAutofillingPlans
                      ? "cursor-wait bg-gray-300 text-white"
                      : "bg-gray-900 text-white hover:bg-black",
                  ].join(" ")}
                >
                  {isSavingPlans ? "保存中..." : "保存方案规划"}
                </button>
              </div>
            ) : null}
          </div>
        </Card>
        {rewriteDialog ? (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/25 p-4">
            <div className="w-full max-w-lg rounded-3xl border border-violet-100 bg-white p-5 shadow-2xl">
              <div className="text-base font-semibold text-gray-900">
                描述修改建议
              </div>
              <p className="mt-1 text-xs leading-6 text-gray-500">
                当前方案：{rewriteDialog.title}
              </p>
              <textarea
                value={rewriteDialog.feedback}
                disabled={rewritingPlanItemId === rewriteDialog.itemId}
                onChange={(event) =>
                  setRewriteDialog((current) =>
                    current
                      ? { ...current, feedback: event.target.value }
                      : current,
                  )
                }
                placeholder="例如：风格改为极简白底，突出产品质感，去掉背景人物..."
                className="mt-3 min-h-[140px] w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-700 outline-none transition focus:border-violet-300 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRewriteDialog(null)}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900 active:scale-[0.99]"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!rewriteDialog) return;
                    void handleRewritePlanPrompt(
                      rewriteDialog.groupId,
                      rewriteDialog.itemId,
                      rewriteDialog.feedback,
                    ).finally(() => setRewriteDialog(null));
                  }}
                  disabled={rewritingPlanItemId === rewriteDialog.itemId}
                  className={[
                    "rounded-xl px-4 py-2 text-sm font-semibold text-white transition active:scale-[0.99]",
                    rewritingPlanItemId === rewriteDialog.itemId
                      ? "cursor-wait bg-violet-300"
                      : "bg-violet-600 hover:bg-violet-700",
                  ].join(" ")}
                >
                  {rewritingPlanItemId === rewriteDialog.itemId
                    ? "提交中..."
                    : "提交重写"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  if (message.type === "ecomOneClick.modelLock") {
    const selectedModel =
      message.models.find((model) => model.id === message.selectedModelId) || null;
    const mappedImageSummary = getMappedModelDisplaySummary("image");
    return (
      <Card>
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <CheckCircle2 size={16} className="text-emerald-500" />
          提示词定稿
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-600">
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
            可选模型 {message.models.length}
          </span>
          <span className="rounded-full bg-gray-100 px-3 py-1.5">
            先确认默认模型与提示词语言，再进入执行生成
          </span>
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">
            设置映射 {mappedImageSummary}
          </span>
          {selectedModel ? (
            <span className="rounded-full bg-sky-50 px-3 py-1.5 text-sky-700">
              当前默认 {selectedModel.name}
            </span>
          ) : (
            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">
              尚未确认默认模型
            </span>
          )}
        </div>
        {selectedModel ? (
          <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
            <div className="text-sm font-semibold text-gray-900">
              当前默认配置
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-600">
              <span className="rounded-full bg-white px-2.5 py-1">
                模型 {selectedModel.name}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1">
                全局映射 {mappedImageSummary}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1">
                提示词语言{" "}
                {PROMPT_LANGUAGE_LABELS[
                  modelLanguageDrafts[selectedModel.id] ||
                    selectedModel.promptLanguage
                ] || selectedModel.promptLanguage}
              </span>
              {selectedModel.imageSize ? (
                <span className="rounded-full bg-white px-2.5 py-1">
                  清晰度 {selectedModel.imageSize}
                </span>
              ) : null}
              {selectedModel.thinkingLevel ? (
                <span className="rounded-full bg-white px-2.5 py-1">
                  思考强度{" "}
                  {THINKING_LEVEL_LABELS[selectedModel.thinkingLevel] ||
                    selectedModel.thinkingLevel}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="mt-3 space-y-3">
          {message.models.map((model) => (
            <div
              key={model.id}
              className={[
                "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                model.id === message.selectedModelId
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300",
              ].join(" ")}
            >
              <div className="text-sm font-semibold">{model.name}</div>
              <div className="mt-1 text-xs text-current/80">
                提示词语言：
                {PROMPT_LANGUAGE_LABELS[
                  modelLanguageDrafts[model.id] || model.promptLanguage
                ] || model.promptLanguage}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-current/80">
                {model.imageSize ? (
                  <span>清晰度：{model.imageSize}</span>
                ) : null}
                {model.thinkingLevel ? (
                  <span>
                    思考强度：
                    {THINKING_LEVEL_LABELS[model.thinkingLevel] ||
                      model.thinkingLevel}
                  </span>
                ) : null}
                {typeof model.webSearch === "boolean" ? (
                  <span>{model.webSearch ? "联网搜索已开" : "离线生成"}</span>
                ) : null}
              </div>
              {model.bestFor && model.bestFor.length > 0 ? (
                <div className="mt-2 text-[11px] leading-5 text-current/75">
                  适合：{model.bestFor.join("、")}
                </div>
              ) : null}
              {model.languageOptions && model.languageOptions.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  {model.languageOptions.map((language) => (
                    <button
                      key={`${model.id}-${language}`}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setModelLanguageDrafts((prev) => ({
                          ...prev,
                          [model.id]: language,
                        }));
                      }}
                      disabled={Boolean(lockingModelId)}
                      className={[
                        "rounded-full border px-2.5 py-1 transition active:scale-[0.99]",
                        Boolean(lockingModelId)
                          ? "cursor-not-allowed border-current/10 text-current/40"
                          : (modelLanguageDrafts[model.id] ||
                                model.promptLanguage) === language
                            ? "border-current bg-current/10"
                            : "border-current/20",
                      ].join(" ")}
                    >
                      {PROMPT_LANGUAGE_LABELS[language] || language}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() =>
                    void handleSelectModelAction(
                      model.id,
                      modelLanguageDrafts[model.id] || model.promptLanguage,
                    )
                  }
                  disabled={Boolean(lockingModelId)}
                  className={[
                    "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                    lockingModelId
                      ? "cursor-wait bg-gray-300 text-white"
                      : model.id === message.selectedModelId
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-gray-900 text-white hover:bg-black",
                  ].join(" ")}
                >
                  {lockingModelId === model.id
                    ? "确认中..."
                    : lockingModelId
                      ? "请稍候..."
                      : model.id === message.selectedModelId
                        ? "已作为默认模型"
                        : "设为默认模型"}
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[11px] text-gray-500">
          默认会优先参考设置里的图片模型映射；一旦你在这里确认默认模型，后续批量生成会沿用当前配置执行。
        </div>
      </Card>
    );
  }

  if (message.type === "ecomOneClick.batch") {
    const getJobPromptValue = (job: (typeof message.jobs)[number]) =>
      getBatchJobPromptValue(job, batchPromptDrafts);
    const getJobPromptFeedbackValue = (job: (typeof message.jobs)[number]) =>
      batchPromptFeedbackDrafts[job.planItemId] ?? "";
    const getSelectedCompareUrls = (jobId: string) =>
      jobCompareSelections[jobId] || [];
    const selectedOverlayBatchUrlSet = new Set(selectedOverlayBatchUrls);
    const selectedOverlayBatchResults = state.results.filter((result) =>
      selectedOverlayBatchUrlSet.has(result.url),
    );
    const selectedOverlayAppliedCount = selectedOverlayBatchResults.filter(
      (result) => result.overlayState?.status === "applied",
    ).length;
    const toggleOverlayBatchResultSelection = (resultUrl: string) => {
      setSelectedOverlayBatchUrls((current) =>
        current.includes(resultUrl)
          ? current.filter((item) => item !== resultUrl)
          : [...current, resultUrl],
      );
    };
    const selectOverlayBatchResults = (results: Array<{ url: string }>) => {
      const nextUrls = results.map((item) => item.url).filter(Boolean);
      if (nextUrls.length === 0) return;
      setSelectedOverlayBatchUrls((current) =>
        Array.from(new Set([...current, ...nextUrls])),
      );
    };
    const clearOverlayBatchResults = (results: Array<{ url: string }>) => {
      const clearSet = new Set(results.map((item) => item.url));
      if (clearSet.size === 0) return;
      setSelectedOverlayBatchUrls((current) =>
        current.filter((url) => !clearSet.has(url)),
      );
    };
    const toggleJobCompareResult = (jobId: string, resultUrl: string) => {
      setJobCompareSelections((prev) => {
        const current = prev[jobId] || [];
        if (current.includes(resultUrl)) {
          return {
            ...prev,
            [jobId]: current.filter((item) => item !== resultUrl),
          };
        }

        const nextSelection =
          current.length >= MAX_SINGLE_JOB_COMPARE_ITEMS
            ? [...current.slice(1), resultUrl]
            : [...current, resultUrl];

        return {
          ...prev,
          [jobId]: nextSelection,
        };
      });
    };
    const clearJobCompareSelection = (jobId: string) => {
      setJobCompareSelections((prev) => {
        if (!prev[jobId]?.length) return prev;
        return {
          ...prev,
          [jobId]: [],
        };
      });
    };
    const primeJobCompareSelection = (
      jobId: string,
      results: Array<{ url: string }>,
    ) => {
      setJobCompareSelections((prev) => ({
        ...prev,
        [jobId]: results.slice(0, 2).map((item) => item.url),
      }));
    };
    const failedCount = message.jobs.filter(
      (job) => job.status === "failed",
    ).length;
    const queuedCount = message.jobs.filter(
      (job) => job.status === "queued" || job.status === "generating",
    ).length;
    const idleCount = message.jobs.filter((job) => job.status === "idle").length;
    const promptReadyCount = message.jobs.filter(
      (job) => getJobPromptValue(job).trim().length > 0,
    ).length;
    const batchView =
      message.view || (state.step === "FINALIZE_PROMPTS" ? "finalize" : "execute");
    const isFinalizeView = batchView === "finalize";
    const isExecuteView = batchView === "execute";
    const completedPercent =
      message.total > 0 ? Math.round((message.done / message.total) * 100) : 0;
    const allPromptsReady =
      message.total > 0 && message.jobs.every((job) => getJobPromptValue(job).trim());
    const promptReadyRatio = message.total > 0 ? promptReadyCount / message.total : 0;
    const missingPromptCount = Math.max(0, message.total - promptReadyCount);
    const shouldPromotePreparePrompts = isFinalizeView && promptReadyRatio < 0.7;
    const shouldPromoteRunBatch = isFinalizeView && promptReadyRatio >= 0.7;
    const finalizePrepareButtonLabel = isPreparingBatchPrompts
      ? "整理提示词中..."
      : shouldPromoteRunBatch
        ? missingPromptCount > 0
          ? `补齐剩余提示词 (${missingPromptCount})`
          : "微调提示词细节"
        : promptReadyCount > 0
          ? "继续批量整理提示词"
          : "先批量整理提示词";
    const finalizeRunButtonLabel = isRunningBatchGenerate
      ? "批量生成中..."
      : message.total === 0
        ? "暂无可执行任务"
        : shouldPromoteRunBatch
          ? allPromptsReady
            ? "开始执行全部任务"
            : "开始执行已就绪任务"
          : allPromptsReady
            ? "一键生成全部"
            : "暂时跳过定稿，直接执行";
    const planGroupOrder = new Map(
      state.planGroups.map((group, index) => [group.typeId, index]),
    );
    const batchJobGroups = Array.from(
      message.jobs.reduce(
        (groups, job) => {
          const planMeta = findPlanItemMeta(state.planGroups, job.planItemId);
          const planGroup = planMeta?.group || null;
          const key = planGroup?.typeId || `ungrouped:${job.planItemId || job.id}`;
          const fallbackIndex = state.planGroups.length + groups.size;
          const current = groups.get(key) || {
            key,
            title: planGroup?.typeTitle || "未分组方案",
            summary: planGroup?.summary || "",
            priority: planGroup?.priority,
            platformTags: planGroup?.platformTags || [],
            planGroup,
            displayIndex: planGroup?.typeId
              ? (planGroupOrder.get(planGroup.typeId) ?? fallbackIndex)
              : fallbackIndex,
            jobs: [] as typeof message.jobs,
            resultCount: 0,
            doneCount: 0,
            failedCount: 0,
          };

          current.jobs.push(job);
          current.resultCount += job.results.length;
          if (job.status === "done") current.doneCount += 1;
          if (job.status === "failed") current.failedCount += 1;
          groups.set(key, current);
          return groups;
        },
        new Map<
          string,
          {
            key: string;
            title: string;
            summary: string;
            priority?: EcommercePlanGroup["priority"];
            platformTags: string[];
            planGroup: EcommercePlanGroup | null;
            displayIndex: number;
            jobs: typeof message.jobs;
            resultCount: number;
            doneCount: number;
            failedCount: number;
          }
        >(),
      ).values(),
    ).sort((left, right) => left.displayIndex - right.displayIndex);
    return (
      <Card>
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Sparkles size={16} className="text-fuchsia-500" />
          {isFinalizeView ? "提示词定稿队列" : "批量执行队列"}
        </div>
        <div className="mt-3 rounded-2xl border border-fuchsia-100 bg-fuchsia-50/60 px-4 py-3">
          <div className="text-xs leading-6 text-gray-600">
            {isFinalizeView ? (
              <>
                已定稿 {promptReadyCount}/{message.total}。
                {promptReadyCount < message.total
                  ? shouldPromotePreparePrompts
                    ? ` 还有 ${message.total - promptReadyCount} 条尚未整理，建议先批量补齐提示词，再进入执行。`
                    : ` 还有 ${message.total - promptReadyCount} 条尚未整理，但大部分任务已具备执行条件，建议先跑已就绪任务。`
                  : " 当前批次提示词已就绪，可以直接开始批量生成。"}
              </>
            ) : (
              <>
                已完成 {message.done}/{message.total}。
                {failedCount > 0
                  ? ` 当前有 ${failedCount} 个失败任务，建议优先处理。`
                  : queuedCount > 0
                    ? ` 当前仍有 ${queuedCount} 个任务在排队或执行中。`
                    : idleCount > 0
                      ? ` 还有 ${idleCount} 个任务尚未开始。`
                      : " 本轮任务已执行完，可以直接回看并补抽结果。"}
                {" 不满意的单条结果，可以直接在这里快速改词后重跑。"}
              </>
            )}
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 text-[10px] text-gray-500 md:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white/90 px-3 py-2">
              {isFinalizeView
                ? `定稿进度 ${promptReadyCount}/${message.total} · ${
                    message.total > 0
                      ? Math.round((promptReadyCount / message.total) * 100)
                      : 0
                  }%`
                : `完成进度 ${message.done}/${message.total} · ${completedPercent}%`}
            </div>
            <div className="rounded-xl border border-gray-200 bg-white/90 px-3 py-2">
              {isFinalizeView
                ? `待定稿 ${Math.max(0, message.total - promptReadyCount)}`
                : `提示词就绪 ${promptReadyCount}/${message.total}`}
            </div>
            <div className="rounded-xl border border-gray-200 bg-white/90 px-3 py-2">
              {isFinalizeView
                ? state.selectedModelId
                  ? `默认模型 ${state.modelOptions.find((item) => item.id === state.selectedModelId)?.name || state.selectedModelId}`
                  : "尚未确认默认模型"
                : failedCount > 0
                  ? `失败任务 ${failedCount}`
                  : queuedCount > 0
                    ? `排队/执行中 ${queuedCount}`
                    : idleCount > 0
                      ? `待开始 ${idleCount}`
                      : "本轮已跑完"}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {isFinalizeView ? (
            shouldPromoteRunBatch ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleRunBatchGenerateAction()}
                  disabled={
                    message.total === 0 ||
                    isRunningBatchGenerate ||
                    isRetryingFailedBatch
                  }
                  className={[
                    "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                    message.total === 0
                      ? "cursor-not-allowed bg-gray-200 text-gray-400"
                      : isRunningBatchGenerate || isRetryingFailedBatch
                        ? "cursor-wait bg-gray-300 text-white"
                        : "bg-gray-900 text-white hover:bg-black",
                  ].join(" ")}
                >
                  {finalizeRunButtonLabel}
                </button>
                <button
                  type="button"
                  onClick={() => void handlePrepareBatchPromptsAction()}
                  disabled={
                    message.total === 0 ||
                    isPreparingBatchPrompts ||
                    isRunningBatchGenerate ||
                    isRetryingFailedBatch
                  }
                  className={[
                    "rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                    message.total === 0
                      ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                      : isPreparingBatchPrompts ||
                          isRunningBatchGenerate ||
                          isRetryingFailedBatch
                        ? "cursor-wait border-gray-200 bg-gray-100 text-gray-400"
                        : "border-fuchsia-200 bg-white text-fuchsia-700 hover:bg-fuchsia-50",
                  ].join(" ")}
                >
                  {finalizePrepareButtonLabel}
                </button>
                <button
                  type="button"
                  onClick={() => void handleOpenBatchWorkbenchAction()}
                  disabled={
                    message.total === 0 ||
                    isPreparingBatchPrompts ||
                    isRunningBatchGenerate ||
                    isRetryingFailedBatch
                  }
                  className={[
                    "rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                    message.total === 0
                      ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                      : isPreparingBatchPrompts ||
                          isRunningBatchGenerate ||
                          isRetryingFailedBatch
                        ? "cursor-wait border-gray-200 bg-gray-100 text-gray-400"
                        : "border-gray-300 bg-white text-gray-500 hover:border-gray-400 hover:text-gray-700",
                  ].join(" ")}
                >
                  进入步骤七工作台
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void handlePrepareBatchPromptsAction()}
                  disabled={
                    message.total === 0 ||
                    isPreparingBatchPrompts ||
                    isRunningBatchGenerate ||
                    isRetryingFailedBatch
                  }
                  className={[
                    "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                    message.total === 0
                      ? "cursor-not-allowed bg-gray-200 text-gray-400"
                      : isPreparingBatchPrompts ||
                          isRunningBatchGenerate ||
                          isRetryingFailedBatch
                        ? "cursor-wait bg-sky-100 text-sky-300"
                        : "bg-sky-600 text-white hover:bg-sky-700",
                  ].join(" ")}
                >
                  {finalizePrepareButtonLabel}
                </button>
                <button
                  type="button"
                  onClick={() => void handleOpenBatchWorkbenchAction()}
                  disabled={
                    message.total === 0 ||
                    isPreparingBatchPrompts ||
                    isRunningBatchGenerate ||
                    isRetryingFailedBatch
                  }
                  className={[
                    "rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                    message.total === 0
                      ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                      : isPreparingBatchPrompts ||
                          isRunningBatchGenerate ||
                          isRetryingFailedBatch
                        ? "cursor-wait border-gray-200 bg-gray-100 text-gray-400"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400",
                  ].join(" ")}
                >
                  进入步骤七工作台
                </button>
                <button
                  type="button"
                  onClick={() => void handleRunBatchGenerateAction()}
                  disabled={
                    message.total === 0 ||
                    isRunningBatchGenerate ||
                    isRetryingFailedBatch
                  }
                  className={[
                    "rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                    message.total === 0
                      ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                      : isRunningBatchGenerate || isRetryingFailedBatch
                        ? "cursor-wait border-gray-200 bg-gray-100 text-gray-400"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400",
                  ].join(" ")}
                >
                  {finalizeRunButtonLabel}
                </button>
              </>
            )
          ) : (
            <>
              <button
                type="button"
                onClick={() => void handleRunBatchGenerateAction()}
                disabled={
                  message.total === 0 ||
                  isRunningBatchGenerate ||
                  isRetryingFailedBatch
                }
                className={[
                  "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                  message.total === 0
                    ? "cursor-not-allowed bg-gray-200 text-gray-400"
                    : isRunningBatchGenerate || isRetryingFailedBatch
                      ? "cursor-wait bg-gray-300 text-white"
                      : "bg-gray-900 text-white hover:bg-black",
                ].join(" ")}
              >
                {isRunningBatchGenerate
                  ? "批量生成中..."
                  : message.total === 0
                    ? "暂无可执行任务"
                    : "继续批量生成"}
              </button>
              {isExecuteView ? (
                <button
                  type="button"
                  onClick={() => void handleRetryFailedBatchAction()}
                  disabled={
                    failedCount === 0 ||
                    isRetryingFailedBatch ||
                    isRunningBatchGenerate
                  }
                  className={[
                    "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                    failedCount === 0 ||
                    isRetryingFailedBatch ||
                    isRunningBatchGenerate
                      ? "cursor-not-allowed bg-gray-200 text-gray-400"
                      : "border border-gray-300 bg-white text-gray-700 hover:border-gray-400",
                  ].join(" ")}
                >
                  {isRetryingFailedBatch
                    ? "重试中..."
                    : `重试失败任务${failedCount > 0 ? ` (${failedCount})` : ""}`}
                </button>
              ) : null}
            </>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-gray-500">
          <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1">
            单条：进入卡片后点“生成这一条”或“再抽一张”
          </span>
          <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1">
            单组：在方案组头部点“本组整理提示词”或“本组全部生成”
          </span>
          <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1">
            全部：顶部按钮“一键生成全部”
          </span>
        </div>
        {isExecuteView ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  批量生产工具栏
                </div>
                <div className="mt-1 text-[11px] leading-5 text-slate-500">
                  先在下方结果卡勾选目标，再统一下载或打包。批量套版仍在每张图的上字编辑器里执行。
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700">
                  已选 {selectedOverlayBatchUrls.length} 张
                </span>
                <span className="rounded-full bg-white px-3 py-1 font-semibold text-fuchsia-700">
                  已成片 {selectedOverlayAppliedCount} 张
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownloadSelectedOverlayResults}
                disabled={selectedOverlayBatchUrls.length === 0}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                批量下载 PNG
              </button>
              <button
                type="button"
                onClick={() => void handleExportSelectedOverlayVariants()}
                disabled={
                  selectedOverlayBatchUrls.length === 0 ||
                  isExportingSelectedOverlayVariants ||
                  !onExportSelectedOverlayVariants
                }
                className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-3 py-1.5 text-[11px] font-semibold text-fuchsia-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isExportingSelectedOverlayVariants
                  ? "打包多平台中..."
                  : "批量导出多平台 ZIP"}
              </button>
              <button
                type="button"
                onClick={() => void handleExportSelectedOverlayResultsZip()}
                disabled={
                  selectedOverlayBatchUrls.length === 0 || isExportingOverlayBatchZip
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isExportingOverlayBatchZip ? "打包中..." : "导出 ZIP"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedOverlayBatchUrls([])}
                disabled={selectedOverlayBatchUrls.length === 0}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                清空勾选
              </button>
            </div>
          </div>
        ) : null}
        <div className="mt-3 space-y-3">
          {batchJobGroups.map((jobGroup) => {
            const accent = getPlanGroupAccent(jobGroup.displayIndex);
            const sourceBadge = jobGroup.planGroup
              ? getPlanGroupSourceBadge(jobGroup.planGroup)
              : null;

            return (
              <div
                key={jobGroup.key}
                className={["rounded-2xl border p-2 shadow-sm", accent.shell].join(
                  " ",
                )}
              >
                <div
                  className={[
                    "flex flex-wrap items-start justify-between gap-2 rounded-xl border px-3 py-3",
                    accent.header,
                  ].join(" ")}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-semibold ${accent.badge}`}
                      >
                        方案组 {jobGroup.displayIndex + 1}
                      </span>
                      <div className="text-[13px] font-semibold text-gray-900">
                        {jobGroup.title}
                      </div>
                      {sourceBadge ? (
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] ${sourceBadge.className}`}
                        >
                          {sourceBadge.text}
                        </span>
                      ) : null}
                    </div>
                    {jobGroup.summary ? (
                      <div className="mt-1 max-w-[780px] text-[11px] leading-5 text-gray-500">
                        {jobGroup.summary}
                      </div>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] text-gray-500">
                      <span className="rounded-full bg-white px-2 py-1 font-medium text-gray-700">
                        任务 {jobGroup.jobs.length}
                      </span>
                      <span className="rounded-full bg-white px-2 py-1 font-medium text-gray-700">
                        结果 {jobGroup.resultCount}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
                        完成 {jobGroup.doneCount}
                      </span>
                      {jobGroup.failedCount > 0 ? (
                        <span className="rounded-full bg-rose-50 px-2 py-1 font-semibold text-rose-700">
                          失败 {jobGroup.failedCount}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] text-gray-400">
                      {jobGroup.priority ? (
                        <span className="rounded-full border border-white/80 bg-white/70 px-2 py-1">
                          {PRIORITY_LABELS[jobGroup.priority] || jobGroup.priority}
                        </span>
                      ) : null}
                      {jobGroup.platformTags.slice(0, 2).map((tag) => (
                        <span
                          key={`${jobGroup.key}-${tag}`}
                          className="rounded-full border border-white/80 bg-white/70 px-2 py-1 text-gray-500"
                        >
                          {tag}
                        </span>
                      ))}
                      {jobGroup.platformTags.length > 2 ? (
                        <span className="rounded-full border border-white/80 bg-white/70 px-2 py-1 text-gray-500">
                          +{jobGroup.platformTags.length - 2} 平台
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] text-gray-500">
                      {jobGroup.jobs.map((job, jobIndex) => (
                        <span
                          key={`${jobGroup.key}-${job.id}-overview`}
                          className="rounded-full border border-white/70 bg-white/70 px-2 py-1"
                        >
                          图{jobIndex + 1}：{summarizeText(job.title, 16)}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {isFinalizeView ? (
                        <button
                          type="button"
                          onClick={() => void handlePrepareBatchJobGroupAction(jobGroup.jobs)}
                          disabled={
                            isPreparingBatchPrompts ||
                            isRunningBatchGenerate ||
                            isRetryingFailedBatch
                          }
                          className={[
                            "rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition active:scale-[0.99]",
                            isPreparingBatchPrompts ||
                            isRunningBatchGenerate ||
                            isRetryingFailedBatch
                              ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                              : "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100",
                          ].join(" ")}
                        >
                          本组整理提示词
                        </button>
                      ) : null}
                      {isExecuteView ? (
                        <button
                          type="button"
                          onClick={() => void handleGenerateBatchJobGroupAction(jobGroup.jobs)}
                          disabled={
                            isPreparingBatchPrompts ||
                            isRunningBatchGenerate ||
                            isRetryingFailedBatch
                          }
                          className={[
                            "rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition active:scale-[0.99]",
                            isPreparingBatchPrompts ||
                            isRunningBatchGenerate ||
                            isRetryingFailedBatch
                              ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                              : "border-gray-900 bg-gray-900 text-white hover:bg-black",
                          ].join(" ")}
                        >
                          本组全部生成
                        </button>
                      ) : null}
                      {isExecuteView ? (
                        <button
                          type="button"
                          onClick={() =>
                            selectOverlayBatchResults(
                              jobGroup.jobs.flatMap((job) => job.results),
                            )
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700 transition hover:border-slate-300"
                        >
                          勾选本组全部结果
                        </button>
                      ) : null}
                      {isExecuteView ? (
                        <button
                          type="button"
                          onClick={() =>
                            clearOverlayBatchResults(
                              jobGroup.jobs.flatMap((job) => job.results),
                            )
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300"
                        >
                          清空本组勾选
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2.5 xl:grid-cols-2">
                  {jobGroup.jobs.map((job, jobIndex) => {
            const planMeta = findPlanItemMeta(state.planGroups, job.planItemId);
            const promptValue = getJobPromptValue(job);
            const hasPrompt = promptValue.trim().length > 0;
            const currentPromptHash = buildPromptHash(promptValue);
            const newestFirstResults = [...job.results].reverse();
            const latestResult = newestFirstResults[0];
            const currentAspectRatio = getDefaultEcommercePlanRatio({
              platformMode: state.platformMode,
              typeId: planMeta?.group.typeId,
              typeTitle: planMeta?.group.typeTitle || job.title,
              itemTitle: planMeta?.item.title || job.title,
              itemDescription: planMeta?.item.description || promptValue,
              preferredRatio: planMeta?.item.ratio,
            });
            const latestResultPromptHash =
              latestResult?.generationMeta?.promptHash ||
              job.generationMeta?.promptHash ||
              "";
            const latestResultAspectRatio =
              latestResult?.generationMeta?.aspectRatio ||
              job.generationMeta?.aspectRatio ||
              "";
            const hasPromptVersionGap = Boolean(
              currentPromptHash &&
                latestResultPromptHash &&
                latestResultPromptHash !== currentPromptHash,
            );
            const hasRatioVersionGap = Boolean(
              currentAspectRatio &&
                latestResultAspectRatio &&
                latestResultAspectRatio !== currentAspectRatio,
            );
            const hasInputVersionGap = hasPromptVersionGap || hasRatioVersionGap;
            const resultCards = newestFirstResults.map((result, resultIndex) => {
              const resultPromptHash = result.generationMeta?.promptHash || "";
              const resultAspectRatio =
                result.generationMeta?.aspectRatio || currentAspectRatio;
              const isCurrentVersion = resultPromptHash
                ? (!currentPromptHash || resultPromptHash === currentPromptHash) &&
                  (!currentAspectRatio || resultAspectRatio === currentAspectRatio)
                : !hasInputVersionGap && resultIndex === 0;
              return {
                result,
                resultIndex,
                isCurrentVersion,
                isPreferred: preferredResultUrl === result.url,
              };
            });
            const sortedResultCards = [
              ...resultCards.filter(
                (item) => item.isCurrentVersion && item.isPreferred,
              ),
              ...resultCards.filter(
                (item) => item.isCurrentVersion && !item.isPreferred,
              ),
              ...resultCards.filter(
                (item) => !item.isCurrentVersion && item.isPreferred,
              ),
              ...resultCards.filter(
                (item) => !item.isCurrentVersion && !item.isPreferred,
              ),
            ];
            const sortedResults = sortedResultCards.map((item) => item.result);
            const resultVersionMap = new Map(
              sortedResultCards.map((item) => [item.result.url, item.isCurrentVersion]),
            );
            const currentVersionResultCount = sortedResultCards.filter(
              (item) => item.isCurrentVersion,
            ).length;
            const staleResultCount = Math.max(
              0,
              sortedResultCards.length - currentVersionResultCount,
            );
            const canHideHistoricalResults =
              currentVersionResultCount > 0 && staleResultCount > 0;
            const showHistoricalResults =
              !canHideHistoricalResults || jobShowHistoricalResults[job.id] === true;
            const visibleResultCards = showHistoricalResults
              ? sortedResultCards
              : sortedResultCards.filter((item) => item.isCurrentVersion);
            const visibleResults = visibleResultCards.map((item) => item.result);
            const selectedCompareUrls = getSelectedCompareUrls(job.id);
            const compareResults = visibleResults.filter((result) =>
              selectedCompareUrls.includes(result.url),
            );
            const jobSelectedOverlayCount = visibleResults.filter((result) =>
              selectedOverlayBatchUrlSet.has(result.url),
            ).length;
            const jobCurrentVersionResults = sortedResultCards
              .filter((item) => item.isCurrentVersion)
              .map((item) => item.result);

                    return (
                      <div
                        key={job.id}
                        className={[
                          "rounded-xl border bg-gradient-to-br from-white to-gray-50/90 px-3 py-3 shadow-sm",
                          accent.itemBorder,
                          accent.line,
                          "border-l-4",
                        ].join(" ")}
                      >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="rounded-lg bg-gray-900 px-2.5 py-1 font-semibold text-white">
                        {jobIndex + 1}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <div className="text-sm font-medium text-gray-800">
                        {job.title}
                      </div>
                      {isExecuteView ? (
                        <select
                          value={currentAspectRatio}
                          onChange={(event) =>
                            void onSyncBatchPlanItemRatio?.(
                              job.planItemId,
                              event.target.value,
                            )
                          }
                          disabled={
                            isRunningBatchGenerate ||
                            isPreparingBatchPrompts ||
                            isRetryingFailedBatch
                          }
                          className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-medium text-slate-700 outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                        >
                          {QUICK_RATIO_OPTIONS.map((ratio) => (
                            <option key={`${job.planItemId}-${ratio}`} value={ratio}>
                              比例 {ratio}
                            </option>
                          ))}
                        </select>
                      ) : planMeta?.item.ratio ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-medium text-slate-600">
                          比例 {planMeta.item.ratio}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-gray-500">
                      {isExecuteView ? (
                        <span className="rounded-full bg-white px-2 py-0.5">
                          结果 {job.results.length} 张
                        </span>
                      ) : null}
                      {isExecuteView && hasPromptVersionGap ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                          已改词待重跑
                        </span>
                      ) : null}
                      {isExecuteView &&
                      !hasPromptVersionGap &&
                      hasRatioVersionGap ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                          已改比例待重跑
                        </span>
                      ) : null}
                      {isExecuteView &&
                      !hasPromptVersionGap &&
                      currentVersionResultCount > 0 ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                          当前版 {currentVersionResultCount} 张
                        </span>
                      ) : null}
                      {isExecuteView && staleResultCount > 0 ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                          旧版 {staleResultCount} 张
                        </span>
                      ) : null}
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">
                        提示词 ·
                        {BATCH_PHASE_LABELS[job.promptStatus || "idle"] ||
                          job.promptStatus ||
                          "未开始"}
                      </span>
                      {isExecuteView ? (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">
                          生图 ·
                          {BATCH_PHASE_LABELS[job.imageStatus || "idle"] ||
                            job.imageStatus ||
                            "未开始"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div
                    className={[
                      "rounded-full px-2.5 py-1 text-[10px] font-semibold",
                      job.status === "failed"
                        ? "bg-rose-100 text-rose-700"
                        : job.status === "done"
                          ? "bg-emerald-100 text-emerald-700"
                          : job.status === "generating" ||
                              job.status === "queued"
                            ? "bg-sky-100 text-sky-700"
                            : "bg-gray-200 text-gray-600",
                    ].join(" ")}
                  >
                    {BATCH_STATUS_LABELS[job.status] || job.status}
                  </div>
                </div>
                <div className="mt-2 rounded-lg bg-white px-2 py-2 text-[10px] leading-5 text-gray-600">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-gray-800">
                      {isFinalizeView ? "提示词" : "执行输入"}
                    </div>
                    {hasPrompt ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
                        已准备
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
                        待生成
                      </span>
                    )}
                  </div>
                  {getGenerationMetaChips(job.generationMeta).length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {getGenerationMetaChips(job.generationMeta).map((chip) => (
                        <span
                          key={`${job.id}-${chip.text}`}
                          className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${chip.className}`}
                        >
                          {chip.text}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {getLayoutMetaChips(job.layoutSnapshot).length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {getLayoutMetaChips(job.layoutSnapshot).map((chip) => (
                        <span
                          key={`${job.id}-layout-${chip.text}`}
                          className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${chip.className}`}
                        >
                          {chip.text}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {isFinalizeView ? (
                    hasPrompt ? (
                      <textarea
                        value={promptValue}
                        onChange={(event) =>
                          setBatchPromptDrafts((prev) => ({
                            ...prev,
                            [job.planItemId]: event.target.value,
                          }))
                        }
                        placeholder="先生成提示词，再按需微调后生图。"
                        className="mt-1 min-h-[76px] w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[11px] leading-5 text-gray-600 outline-none transition focus:border-violet-300"
                      />
                    ) : (
                      <div className="mt-1 rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-2.5 text-[10px] leading-5 text-gray-500">
                        这条还没有生成提示词。先点下方“生成这条提示词”，拿到初稿后再做局部微调。
                      </div>
                    )
                  ) : hasPrompt ? (
                    <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-[10px] leading-5 text-gray-600">
                      {summarizeText(promptValue, 160)}
                    </div>
                  ) : (
                    <div className="mt-1 rounded-md border border-dashed border-amber-200 bg-amber-50/70 px-3 py-2.5 text-[10px] leading-5 text-amber-700">
                      这条还没有定稿提示词。执行时若直接开始，系统会先补齐必要提示词再继续。
                    </div>
                  )}
                  {isExecuteView && hasInputVersionGap ? (
                    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-[10px] leading-5 text-amber-800">
                      当前执行条件已经改过，但下面结果还是旧版输出。可以直接点“保存并重跑”或“再抽一张”拿新版。
                    </div>
                  ) : null}
                  {batchPromptRewriteMessages[job.planItemId] ? (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-[9px] font-semibold",
                          batchPromptRewriteMessages[job.planItemId]?.tone ===
                          "error"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-emerald-50 text-emerald-700",
                        ].join(" ")}
                      >
                        {batchPromptRewriteMessages[job.planItemId]?.text}
                      </span>
                    </div>
                  ) : null}
                  {isFinalizeView ? (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            if (!hasPrompt) {
                              setBatchPromptRewriteDialog(null);
                              void handlePrepareSingleBatchPromptAction(job);
                              return;
                            }
                            setBatchPromptRewriteDialog({
                              jobId: job.id,
                              planItemId: job.planItemId,
                              title: job.title,
                              feedback: getJobPromptFeedbackValue(job),
                            });
                          }}
                          disabled={
                            isPreparingBatchPrompts ||
                            isRunningBatchGenerate ||
                            isRetryingFailedBatch
                          }
                          className={[
                            "rounded-lg px-2.5 py-1 text-[10px] font-semibold transition active:scale-[0.99]",
                            isPreparingBatchPrompts ||
                            isRunningBatchGenerate ||
                            isRetryingFailedBatch
                              ? "cursor-not-allowed bg-gray-200 text-gray-400"
                              : "bg-violet-100 text-violet-700 hover:bg-violet-200",
                          ].join(" ")}
                        >
                          {preparingPromptPlanItemId === job.planItemId
                            ? "正在重新生成..."
                            : hasPrompt
                              ? "重新生成提示词"
                              : "生成这条提示词"}
                        </button>
                        {batchPromptRewriteDialog?.planItemId === job.planItemId &&
                        hasPrompt ? (
                          <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-[320px] rounded-2xl border border-violet-100 bg-white p-3 shadow-xl">
                            <div className="text-[11px] font-semibold text-gray-900">
                              重新生成提示词
                            </div>
                            <div className="mt-1 text-[10px] leading-5 text-gray-500">
                              当前方案：{job.title}
                            </div>
                            <textarea
                              value={batchPromptRewriteDialog.feedback}
                              disabled={
                                isPreparingBatchPrompts ||
                                preparingPromptPlanItemId === job.planItemId
                              }
                              onChange={(event) =>
                                setBatchPromptRewriteDialog((current) =>
                                  current
                                    ? { ...current, feedback: event.target.value }
                                    : current,
                                )
                              }
                              placeholder="例如：背景更干净、构图更聚焦卖点。留空则直接重写。"
                              className="mt-2 min-h-[96px] w-full rounded-xl border border-blue-100 bg-blue-50/40 px-3 py-2 text-[11px] leading-5 text-gray-700 outline-none transition focus:border-blue-300 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                            />
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setBatchPromptRewriteDialog(null)}
                                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900 active:scale-[0.99]"
                              >
                                取消
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const feedback = batchPromptRewriteDialog.feedback;
                                  setBatchPromptRewriteDialog(null);
                                  void handlePrepareSingleBatchPromptAction(
                                    job,
                                    feedback,
                                  );
                                }}
                                disabled={
                                  isPreparingBatchPrompts ||
                                  preparingPromptPlanItemId === job.planItemId
                                }
                                className={[
                                  "rounded-lg px-3 py-1.5 text-[10px] font-semibold text-white transition active:scale-[0.99]",
                                  isPreparingBatchPrompts ||
                                  preparingPromptPlanItemId === job.planItemId
                                    ? "cursor-wait bg-violet-300"
                                    : "bg-violet-600 hover:bg-violet-700",
                                ].join(" ")}
                              >
                                {preparingPromptPlanItemId === job.planItemId
                                  ? "生成中..."
                                  : "确认重写"}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {hasPrompt ? (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              openBatchPromptQuickEditDialog(
                                job,
                                promptValue,
                                getJobPromptFeedbackValue(job),
                              );
                            }}
                            disabled={
                              isRunningBatchGenerate ||
                              isPreparingBatchPrompts ||
                              isRetryingFailedBatch
                            }
                            className={[
                              "rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition active:scale-[0.99]",
                              isRunningBatchGenerate ||
                              isPreparingBatchPrompts ||
                              isRetryingFailedBatch
                                ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                                : "border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-300 hover:bg-violet-100",
                            ].join(" ")}
                          >
                            快速改词
                          </button>
                          {batchPromptQuickEditDialog?.planItemId ===
                          job.planItemId ? (
                            <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-[360px] rounded-2xl border border-violet-100 bg-white p-3 shadow-xl">
                              <div className="text-[11px] font-semibold text-gray-900">
                                第七步快速改词
                              </div>
                              <div className="mt-1 text-[10px] leading-5 text-gray-500">
                                {batchPromptQuickEditDialog.sourceResultLabel
                                  ? `当前从「${batchPromptQuickEditDialog.sourceResultLabel}」继续微调。改完可直接重跑，不用回第六步。`
                                  : "只改这一条并就地重跑，不用回第六步。深度定稿再回“提示词定稿”统一处理。"}
                              </div>
                              <textarea
                                value={batchPromptQuickEditDialog.prompt}
                                disabled={
                                  isRunningBatchGenerate ||
                                  isPreparingBatchPrompts ||
                                  preparingPromptPlanItemId === job.planItemId
                                }
                                onChange={(event) =>
                                  setBatchPromptQuickEditDialog((current) =>
                                    current
                                      ? { ...current, prompt: event.target.value }
                                      : current,
                                  )
                                }
                                placeholder="直接改这一条提示词。"
                                className="mt-2 min-h-[110px] w-full rounded-xl border border-violet-100 bg-violet-50/40 px-3 py-2 text-[11px] leading-5 text-gray-700 outline-none transition focus:border-violet-300 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                              />
                              <input
                                type="text"
                                value={batchPromptQuickEditDialog.feedback}
                                disabled={
                                  isRunningBatchGenerate ||
                                  isPreparingBatchPrompts ||
                                  preparingPromptPlanItemId === job.planItemId
                                }
                                onChange={(event) =>
                                  setBatchPromptQuickEditDialog((current) =>
                                    current
                                      ? {
                                          ...current,
                                          feedback: event.target.value,
                                        }
                                      : current,
                                  )
                                }
                                placeholder="可选：一句话说明希望 AI 往哪改。"
                                className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-700 outline-none transition focus:border-gray-300 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                              />
                              <div className="mt-2 flex flex-wrap justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setBatchPromptQuickEditDialog(null)}
                                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900 active:scale-[0.99]"
                                >
                                  取消
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleSaveBatchPromptQuickEdit()
                                  }
                                  disabled={
                                    isRunningBatchGenerate ||
                                    isPreparingBatchPrompts ||
                                    preparingPromptPlanItemId === job.planItemId
                                  }
                                  className={[
                                    "rounded-lg border px-3 py-1.5 text-[10px] font-semibold transition active:scale-[0.99]",
                                    isRunningBatchGenerate ||
                                    isPreparingBatchPrompts ||
                                    preparingPromptPlanItemId === job.planItemId
                                      ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                                      : "border-gray-300 bg-white text-gray-700 hover:border-gray-400",
                                  ].join(" ")}
                                >
                                  只保存
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleRewriteBatchPromptQuickEdit(job)
                                  }
                                  disabled={
                                    isRunningBatchGenerate ||
                                    isPreparingBatchPrompts ||
                                    preparingPromptPlanItemId === job.planItemId
                                  }
                                  className={[
                                    "rounded-lg px-3 py-1.5 text-[10px] font-semibold transition active:scale-[0.99]",
                                    isRunningBatchGenerate ||
                                    isPreparingBatchPrompts ||
                                    preparingPromptPlanItemId === job.planItemId
                                      ? "cursor-not-allowed bg-violet-200 text-violet-400"
                                      : "bg-violet-600 text-white hover:bg-violet-700",
                                  ].join(" ")}
                                >
                                  {preparingPromptPlanItemId === job.planItemId
                                    ? "改写中..."
                                    : "AI 改写"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleGenerateBatchPromptQuickEdit(job)
                                  }
                                  disabled={
                                    isRunningBatchGenerate ||
                                    isPreparingBatchPrompts ||
                                    isRetryingFailedBatch ||
                                    !batchPromptQuickEditDialog.prompt.trim()
                                  }
                                  className={[
                                    "rounded-lg px-3 py-1.5 text-[10px] font-semibold transition active:scale-[0.99]",
                                    isRunningBatchGenerate ||
                                    isPreparingBatchPrompts ||
                                    isRetryingFailedBatch ||
                                    !batchPromptQuickEditDialog.prompt.trim()
                                      ? "cursor-not-allowed bg-gray-200 text-gray-400"
                                      : "bg-gray-900 text-white hover:bg-black",
                                  ].join(" ")}
                                >
                                  保存并重跑
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void handleGenerateSingleBatchJobAction(job)}
                        disabled={
                          isRunningBatchGenerate ||
                          isPreparingBatchPrompts ||
                          isRetryingFailedBatch ||
                          !hasPrompt
                        }
                        className={[
                          "rounded-lg px-2.5 py-1 text-[10px] font-semibold transition active:scale-[0.99]",
                          isRunningBatchGenerate ||
                          isPreparingBatchPrompts ||
                          isRetryingFailedBatch ||
                          !hasPrompt
                            ? "cursor-not-allowed bg-gray-200 text-gray-400"
                            : "bg-gray-900 text-white hover:bg-black",
                        ].join(" ")}
                      >
                        {job.results.length > 0 ? "再抽一张" : "生成这一条"}
                      </button>
                    </div>
                  )}
                </div>
                {job.error ? (
                  <div className="mt-1 text-[11px] text-red-600">
                    {job.error}
                  </div>
                ) : null}
                {isExecuteView && sortedResults.length > 0 ? (
                    <div className="mt-2">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white/80 px-2.5 py-2 text-[10px]">
                      <div className="flex flex-wrap items-center gap-1.5 text-slate-600">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                          批量套版勾选 {jobSelectedOverlayCount}
                        </span>
                        <span>支持按当前显示结果或仅当前版结果快速勾选</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => selectOverlayBatchResults(visibleResults)}
                          disabled={visibleResults.length === 0}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          勾选当前显示
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            selectOverlayBatchResults(jobCurrentVersionResults)
                          }
                          disabled={jobCurrentVersionResults.length === 0}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          仅勾选当前版
                        </button>
                        <button
                          type="button"
                          onClick={() => clearOverlayBatchResults(job.results)}
                          disabled={job.results.length === 0}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          清空本条勾选
                        </button>
                      </div>
                    </div>
                    <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                        当前版 {currentVersionResultCount}
                      </span>
                      {staleResultCount > 0 ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                          旧版 {staleResultCount}
                        </span>
                      ) : null}
                      {hasPromptVersionGap ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                          当前已改词，建议重跑刷新结果
                        </span>
                      ) : null}
                      {canHideHistoricalResults ? (
                        <button
                          type="button"
                          onClick={() => {
                            const nextShowHistorical = !showHistoricalResults;
                            setJobShowHistoricalResults((prev) => ({
                              ...prev,
                              [job.id]: nextShowHistorical,
                            }));
                            if (!nextShowHistorical) {
                              const currentUrls = new Set(
                                sortedResultCards
                                  .filter((item) => item.isCurrentVersion)
                                  .map((item) => item.result.url),
                              );
                              setJobCompareSelections((prev) => {
                                const currentSelection = prev[job.id] || [];
                                const filtered = currentSelection.filter((url) =>
                                  currentUrls.has(url),
                                );
                                if (filtered.length === currentSelection.length) {
                                  return prev;
                                }
                                return {
                                  ...prev,
                                  [job.id]: filtered,
                                };
                              });
                            }
                          }}
                          className="rounded-full border border-gray-200 bg-white px-2 py-0.5 font-semibold text-gray-600 transition hover:border-gray-300 hover:text-gray-900 active:scale-[0.99]"
                        >
                          {showHistoricalResults
                            ? `收起旧版 ${staleResultCount}`
                            : `显示旧版 ${staleResultCount}`}
                        </button>
                      ) : null}
                    </div>
                    {visibleResults.length >= 2 ? (
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-100 bg-blue-50/70 px-2.5 py-1.5 text-[10px] text-blue-900">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-blue-700">
                            对比
                          </span>
                          <span>
                            已选 {compareResults.length}/{MAX_SINGLE_JOB_COMPARE_ITEMS}
                          </span>
                          <span className="text-blue-700/80">至少 2 张</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              primeJobCompareSelection(job.id, visibleResults)
                            }
                            className="rounded-lg border border-blue-200 bg-white px-2 py-1 text-[10px] font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50 active:scale-[0.99]"
                          >
                            选前两张
                          </button>
                          <button
                            type="button"
                            onClick={() => clearJobCompareSelection(job.id)}
                            disabled={compareResults.length === 0}
                            className={[
                              "rounded-lg px-2 py-1 text-[10px] font-semibold transition active:scale-[0.99]",
                              compareResults.length === 0
                                ? "cursor-not-allowed bg-gray-200 text-gray-400"
                                : "border border-gray-300 bg-white text-gray-600 hover:border-gray-400",
                            ].join(" ")}
                          >
                            清空对比
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {visibleResultCards.map(
                        ({ result, isCurrentVersion, isPreferred }, index) => {
                        const meta = parseResultMeta(
                          result.label || job.title,
                          job.title,
                        );
                        const resultDisplayUrl = getResultDisplayUrl(result);
                        const isInCompare = selectedCompareUrls.includes(
                          result.url,
                        );
                        const isLatestResult =
                          !isPreferred && index === 0;
                        const overlayBadge =
                          result.overlayState?.status === "applied"
                            ? "已成片"
                            : result.overlayState?.status === "draft"
                              ? "有草稿"
                              : null;
                        const overlayRenderStatus =
                          result.overlayState?.renderStatus || null;
                        const overlayRenderStatusMessage = String(
                          result.overlayState?.renderStatusMessage || "",
                        ).trim();
                        const replacementQualityChips =
                          getReplacementQualityChips(result.overlayState);
                        const overlayPersistence =
                          result.overlayState?.renderedPersistence || null;
                        const overlayRecoveryFocus =
                          overlayRenderStatusMessage
                            ? inferOverlayRecoveryFocus(result)
                            : null;
                        const canQuickExportOverlayVariants =
                          Boolean(onExportResultOverlayVariants) &&
                          hasOverlayContent(result.overlayState);
                        const isQuickExportingOverlayVariants =
                          quickExportingOverlayResultUrl === result.url;
                        const isOverlayBatchSelected =
                          selectedOverlayBatchUrlSet.has(result.url);
                        return (
                          <div
                            key={`${job.id}-${result.url}`}
                            className={[
                              "overflow-hidden rounded-lg border",
                              isOverlayBatchSelected
                                ? "border-fuchsia-300 bg-fuchsia-50/40 shadow-[0_0_0_1px_rgba(217,70,239,0.16)]"
                                : isPreferred
                                ? "border-emerald-200 bg-white shadow-[0_0_0_1px_rgba(16,185,129,0.12)]"
                                : !isCurrentVersion
                                ? "border-slate-200 bg-slate-50/80"
                                : isLatestResult
                                ? "border-amber-200 bg-white shadow-[0_0_0_1px_rgba(251,191,36,0.12)]"
                                : "border-gray-200",
                            ].join(" ")}
                            >
                            <div className="flex items-center justify-between border-b border-gray-100 bg-white/90 px-1.5 py-1">
                              <button
                                type="button"
                                onClick={() =>
                                  toggleOverlayBatchResultSelection(result.url)
                                }
                                className={[
                                  "rounded-full px-2 py-0.5 text-[9px] font-semibold transition active:scale-[0.99]",
                                  isOverlayBatchSelected
                                    ? "bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-200"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                                ].join(" ")}
                              >
                                {isOverlayBatchSelected ? "已勾选套版" : "勾选套版"}
                              </button>
                              {isOverlayBatchSelected ? (
                                <span className="rounded-full bg-fuchsia-50 px-1.5 py-0.5 text-[9px] font-semibold text-fuchsia-700">
                                  批量队列
                                </span>
                              ) : null}
                            </div>
                            <img
                              src={resultDisplayUrl}
                              alt={meta.fullLabel}
                              onClick={() => onPreviewResult?.(resultDisplayUrl)}
                              className={[
                                "h-20 w-20 object-cover",
                                onPreviewResult ? "cursor-zoom-in" : "",
                              ].join(" ")}
                            />
                            <div className="border-t border-gray-100 px-1.5 py-1">
                              <div className="mb-1 flex flex-wrap items-center gap-1">
                                <span className="max-w-[64px] truncate text-[10px] font-medium text-gray-700">
                                  {meta.title}
                                </span>
                                {meta.version ? (
                                  <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-600">
                                    {meta.version}
                                  </span>
                                ) : null}
                                <span
                                  className={[
                                    "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                                    isCurrentVersion
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-slate-100 text-slate-600",
                                  ].join(" ")}
                                >
                                  {isCurrentVersion ? "当前版" : "旧版"}
                                </span>
                                {isPreferred ? (
                                  <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600">
                                    首选
                                  </span>
                                ) : isLatestResult ? (
                                  <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                                    最新
                                  </span>
                                ) : null}
                                {overlayBadge ? (
                                  <span className="rounded-full bg-fuchsia-50 px-1.5 py-0.5 text-[9px] font-semibold text-fuchsia-700">
                                    {overlayBadge}
                                  </span>
                                ) : null}
                                {overlayRenderStatus === "error" ? (
                                  <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold text-rose-700">
                                    上字失败
                                  </span>
                                ) : overlayRenderStatus === "warning" ? (
                                  <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                                    未落盘
                                  </span>
                                ) : overlayRenderStatus === "success" &&
                                  overlayPersistence === "persisted" ? (
                                  <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                                    已落盘
                                  </span>
                                ) : null}
                                {getGenerationMetaChips(
                                  result.generationMeta || job.generationMeta,
                                )
                                  .slice(0, 1)
                                  .map((chip) => (
                                    <span
                                      key={`${result.url}-${chip.text}`}
                                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${chip.className}`}
                                    >
                                      {chip.text}
                                    </span>
                                  ))}
                                {getLayoutMetaChips(
                                  result.layoutMeta || job.layoutSnapshot,
                                )
                                  .slice(0, 1)
                                  .map((chip) => (
                                    <span
                                      key={`${result.url}-layout-${chip.text}`}
                                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${chip.className}`}
                                    >
                                      {chip.text}
                                    </span>
                                  ))}
                                {replacementQualityChips
                                  .slice(0, 2)
                                  .map((chip) => (
                                    <span
                                      key={`${result.url}-replacement-${chip.text}`}
                                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${chip.className}`}
                                      title={result.overlayState?.replacementQuality?.summary}
                                    >
                                      {chip.text}
                                    </span>
                                  ))}
                              </div>
                              {result.generationMeta?.promptSummary ? (
                                <div
                                  className={[
                                    "mb-1 rounded-md px-1.5 py-1 text-[9px] leading-4",
                                    isCurrentVersion
                                      ? "bg-emerald-50/70 text-emerald-800"
                                      : "bg-slate-100 text-slate-600",
                                  ].join(" ")}
                                  title={result.generationMeta.promptSummary}
                                >
                                  {isCurrentVersion ? "本次提示词" : "旧版提示词"}：
                                  {summarizeText(
                                    result.generationMeta.promptSummary,
                                    52,
                                  )}
                                </div>
                              ) : null}
                              {overlayRenderStatusMessage ? (
                                <div
                                  className={[
                                    "mb-1 rounded-md px-1.5 py-1 text-[9px] leading-4",
                                    overlayRenderStatus === "error"
                                      ? "bg-rose-50 text-rose-700"
                                      : overlayRenderStatus === "warning"
                                        ? "bg-amber-50 text-amber-700"
                                        : "bg-fuchsia-50 text-fuchsia-700",
                                  ].join(" ")}
                                  title={overlayRenderStatusMessage}
                                >
                                  <div className="flex items-start justify-between gap-1">
                                    <div className="min-w-0 flex-1">
                                      {overlayRenderStatus === "error"
                                        ? "上字失败："
                                        : overlayPersistence === "session-only"
                                          ? "上字未落盘："
                                          : "上字状态："}
                                      {summarizeText(overlayRenderStatusMessage, 60)}
                                    </div>
                                    {(overlayRenderStatus === "error" ||
                                      overlayRenderStatus === "warning") &&
                                    overlayRecoveryFocus ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void handleOpenOverlayEditor(result, {
                                            preferredActiveLayerKind:
                                              overlayRecoveryFocus.preferredActiveLayerKind,
                                            editorMessage:
                                              overlayRecoveryFocus.editorMessage,
                                          })
                                        }
                                        className="shrink-0 rounded-md border border-current/20 bg-white/70 px-1.5 py-0.5 text-[9px] font-semibold transition hover:bg-white"
                                      >
                                        快速修复
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              ) : null}
                              {!overlayRenderStatusMessage &&
                              result.overlayState?.replacementQuality?.summary ? (
                                <div
                                  className="mb-1 rounded-md bg-fuchsia-50 px-1.5 py-1 text-[9px] leading-4 text-fuchsia-700"
                                  title={result.overlayState.replacementQuality.summary}
                                >
                                  替换判断：
                                  {summarizeText(
                                    result.overlayState.replacementQuality.summary,
                                    60,
                                  )}
                                </div>
                              ) : null}
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleJobCompareResult(job.id, result.url)
                                  }
                                  className={[
                                    "rounded-md px-1.5 py-0.5 text-[9px] font-semibold transition active:scale-[0.99]",
                                    isInCompare
                                      ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                      : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                                  ].join(" ")}
                                >
                                  {isInCompare ? "移出对比" : "加入对比"}
                                </button>
                                {isInCompare ? (
                                  <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700">
                                    对比中
                                  </span>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => onPreviewResult?.(resultDisplayUrl)}
                                  className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[9px] font-medium text-gray-600 transition hover:border-gray-300 hover:text-black active:scale-[0.99]"
                                >
                                  预览
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleOpenOverlayEditor(result)}
                                  className="rounded-md border border-fuchsia-200 bg-fuchsia-50 px-1.5 py-0.5 text-[9px] font-medium text-fuchsia-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-100 active:scale-[0.99]"
                                >
                                  {result.overlayState?.status === "applied"
                                    ? "改上字"
                                    : "上字"}
                                </button>
                                {(overlayRenderStatus === "error" ||
                                  overlayRenderStatus === "warning") &&
                                overlayRecoveryFocus ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleOpenOverlayEditor(result, {
                                        preferredActiveLayerKind:
                                          overlayRecoveryFocus.preferredActiveLayerKind,
                                        editorMessage:
                                          overlayRecoveryFocus.editorMessage,
                                      })
                                    }
                                    className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 transition hover:border-amber-300 hover:bg-amber-100 active:scale-[0.99]"
                                  >
                                    快速修复
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleQuickExportOverlayVariants(result)
                                  }
                                  disabled={
                                    !canQuickExportOverlayVariants ||
                                    isQuickExportingOverlayVariants
                                  }
                                  className={[
                                    "rounded-md border px-1.5 py-0.5 text-[9px] font-medium transition active:scale-[0.99]",
                                    !canQuickExportOverlayVariants
                                      ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                                      : isQuickExportingOverlayVariants
                                        ? "cursor-wait border-fuchsia-200 bg-fuchsia-100 text-fuchsia-500"
                                        : "border-fuchsia-200 bg-white text-fuchsia-700 hover:border-fuchsia-300 hover:bg-fuchsia-50",
                                  ].join(" ")}
                                  title={
                                    canQuickExportOverlayVariants
                                      ? "直接按全部平台模板导出当前这张图"
                                      : "先给这张图保存上字草稿，再导出多平台版本"
                                  }
                                >
                                  {isQuickExportingOverlayVariants
                                    ? "导出中..."
                                    : "多平台导出"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openBatchPromptQuickEditDialog(
                                      job,
                                      result.generationMeta?.promptText || promptValue,
                                      `基于结果「${meta.fullLabel}」继续优化：`,
                                      meta.fullLabel,
                                    )
                                  }
                                  className="rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[9px] font-medium text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 active:scale-[0.99]"
                                >
                                  基于这张改
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onPromoteResult?.(result.url)}
                                  className={[
                                    "rounded-md px-1.5 py-0.5 text-[9px] font-medium transition active:scale-[0.99]",
                                    isPreferred
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-black",
                                  ].join(" ")}
                                >
                                  {isPreferred ? "已首选" : "设首选"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onInsertToCanvas?.(
                                      result,
                                      result.label || job.title,
                                    )
                                  }
                                  className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[9px] font-semibold text-white transition hover:bg-black active:scale-[0.99]"
                                >
                                  进画布
                                </button>
                                <a
                                  href={resultDisplayUrl}
                                  download={`${sanitizeDownloadName(meta.fullLabel)}.png`}
                                  className="text-[9px] text-gray-400 transition hover:text-gray-600 active:scale-[0.99]"
                                >
                                  下载
                                </a>
                                <button
                                  type="button"
                                  onClick={() => onDeleteResult?.(result.url)}
                                  className="text-[9px] text-gray-400 transition hover:text-red-600 active:scale-[0.99]"
                                >
                                  删除
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {(() => {
                      const editingResultForJob =
                        visibleResults.find(
                          (result) => result.url === state.editingResultUrl,
                        ) || null;
                      return editingResultForJob
                        ? renderOverlayEditorPanel(editingResultForJob)
                        : null;
                    })()}
                    {compareResults.length > 0 ? (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-slate-900">
                            同条结果对比
                          </div>
                          {compareResults.length < 2 ? (
                            <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                              再选 {2 - compareResults.length} 张才会形成对比
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                              已进入同条对比模式
                            </span>
                          )}
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          {compareResults.map((result, index) => {
                            const meta = parseResultMeta(
                              result.label || job.title,
                              job.title,
                            );
                            const resultDisplayUrl = getResultDisplayUrl(result);
                            const generationMetaChips = getGenerationMetaChips(
                              result.generationMeta || job.generationMeta,
                            );
                            const layoutMetaChips = getLayoutMetaChips(
                              result.layoutMeta || job.layoutSnapshot,
                            );
                            const replacementQualityChips =
                              getReplacementQualityChips(result.overlayState);
                            const isPreferred = preferredResultUrl === result.url;
                            const isCurrentVersion = resultVersionMap.get(result.url) !== false;
                            const isLatestResult =
                              visibleResults[0]?.url === result.url &&
                              !isPreferred;
                            return (
                              <div
                                key={`${job.id}-compare-${result.url}`}
                                className={[
                                  "overflow-hidden rounded-xl border shadow-sm",
                                  isCurrentVersion
                                    ? "border-white bg-white"
                                    : "border-slate-200 bg-slate-50/80",
                                ].join(" ")}
                              >
                                <div className="border-b border-gray-100 bg-gray-50 px-3 py-2">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[9px] font-semibold text-white">
                                      对比位 {index + 1}
                                    </span>
                                    {meta.version ? (
                                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-semibold text-blue-600">
                                        {meta.version}
                                      </span>
                                    ) : null}
                                    <span
                                      className={[
                                        "rounded-full px-2 py-0.5 text-[9px] font-semibold",
                                        isCurrentVersion
                                          ? "bg-emerald-50 text-emerald-700"
                                          : "bg-slate-100 text-slate-600",
                                      ].join(" ")}
                                    >
                                      {isCurrentVersion ? "当前版" : "旧版"}
                                    </span>
                                    {isPreferred ? (
                                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
                                        当前首选
                                      </span>
                                    ) : isLatestResult ? (
                                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
                                        最新版本
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-1 text-[11px] font-semibold text-slate-800">
                                    {meta.title}
                                  </div>
                                </div>
                                <img
                                  src={resultDisplayUrl}
                                  alt={meta.fullLabel}
                                  onClick={() => onPreviewResult?.(resultDisplayUrl)}
                                  className={[
                                    "h-44 w-full object-cover",
                                    onPreviewResult ? "cursor-zoom-in" : "",
                                  ].join(" ")}
                                />
                                <div className="space-y-2 px-3 py-3 text-[10px] leading-5 text-gray-600">
                                  {generationMetaChips.length > 0 ||
                                  layoutMetaChips.length > 0 ||
                                  replacementQualityChips.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {generationMetaChips
                                        .slice(0, 2)
                                        .map((chip) => (
                                          <span
                                            key={`${result.url}-${chip.text}-compare`}
                                            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${chip.className}`}
                                          >
                                            {chip.text}
                                          </span>
                                        ))}
                                      {layoutMetaChips
                                        .slice(0, 2)
                                        .map((chip) => (
                                          <span
                                            key={`${result.url}-layout-${chip.text}-compare`}
                                            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${chip.className}`}
                                          >
                                            {chip.text}
                                          </span>
                                        ))}
                                      {replacementQualityChips
                                        .slice(0, 2)
                                        .map((chip) => (
                                          <span
                                            key={`${result.url}-replacement-${chip.text}-compare`}
                                            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${chip.className}`}
                                            title={result.overlayState?.replacementQuality?.summary}
                                          >
                                            {chip.text}
                                          </span>
                                        ))}
                                    </div>
                                  ) : null}
                                  {result.overlayState?.replacementQuality?.summary ? (
                                    <div
                                      className="rounded-lg bg-fuchsia-50 px-2 py-1 text-[9px] leading-4 text-fuchsia-700"
                                      title={result.overlayState.replacementQuality.summary}
                                    >
                                      替换判断：
                                      {summarizeText(
                                        result.overlayState.replacementQuality.summary,
                                        68,
                                      )}
                                    </div>
                                  ) : null}
                                  {result.generationMeta?.promptSummary ? (
                                    <div
                                      className={[
                                        "rounded-lg px-2 py-1 text-[9px] leading-4",
                                        isCurrentVersion
                                          ? "bg-emerald-50/70 text-emerald-800"
                                          : "bg-slate-100 text-slate-600",
                                      ].join(" ")}
                                      title={result.generationMeta.promptSummary}
                                    >
                                      {isCurrentVersion ? "本次提示词" : "旧版提示词"}：
                                      {summarizeText(
                                        result.generationMeta.promptSummary,
                                        70,
                                      )}
                                    </div>
                                  ) : null}
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => onPreviewResult?.(resultDisplayUrl)}
                                      className="rounded-lg border border-gray-200 bg-white px-2 py-1 font-semibold text-gray-700 transition hover:border-gray-300 hover:text-black active:scale-[0.99]"
                                    >
                                      预览
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleOpenOverlayEditor(result)}
                                      className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-2 py-1 font-semibold text-fuchsia-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-100 active:scale-[0.99]"
                                    >
                                      上字
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openBatchPromptQuickEditDialog(
                                          job,
                                          result.generationMeta?.promptText || promptValue,
                                          `基于结果「${meta.fullLabel}」继续优化：`,
                                          meta.fullLabel,
                                        )
                                      }
                                      className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 active:scale-[0.99]"
                                    >
                                      基于这张改
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onPromoteResult?.(result.url)}
                                      className={[
                                        "rounded-lg px-2 py-1 font-semibold transition active:scale-[0.99]",
                                        isPreferred
                                          ? "bg-emerald-50 text-emerald-700"
                                          : "border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:text-black",
                                      ].join(" ")}
                                    >
                                      {isPreferred ? "已首选" : "设首选"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onInsertToCanvas?.(
                                          result,
                                          result.label || job.title,
                                        )
                                      }
                                      className="rounded-lg bg-slate-900 px-2 py-1 font-semibold text-white transition hover:bg-black active:scale-[0.99]"
                                    >
                                      进画布
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : isFinalizeView && sortedResults.length > 0 ? (
                  <div className="mt-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-[10px] text-gray-500">
                    当前已有 {sortedResults.length} 张历史结果。执行与筛选请到第 7 步查看。
                  </div>
                ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  return null;
};


