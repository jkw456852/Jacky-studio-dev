import { useCallback, useRef, type MutableRefObject } from "react";
import type {
  CanvasElement,
  ChatMessage,
  WorkspaceNodeInteractionMode,
} from "../../../types";
import { imageGenSkill } from "../../../services/skills/image-gen.skill";
import { getVisualOrchestratorModelConfig } from "../../../services/provider-settings";
import {
  planVisualGenerationWithModel,
  planVisualTaskWithModel,
  type PlannedImageGeneration,
  type PlannedVisualTask,
  type PlannedVisualTaskUnit,
  runVisualAgentLoop,
  type VisualPlanningBrief,
  type VisualRoleOverlay,
} from "../../../services/vision-orchestrator";
import {
  announceWorkspaceGenerationRequest,
  appendWorkspaceGenerationTraceDiagnostics,
  patchWorkspaceGenerationTrace,
  updateWorkspaceGenerationVariantTrace,
  upsertWorkspaceGenerationTrace,
  type WorkspaceGenerationTraceDiagnostic,
} from "../browserAgentGenerationTrace";
import { resolveWorkspaceTreeNodeKind } from "../workspaceTreeNode";
import { normalizeReferenceToDataUrl } from "../../../services/image-reference-resolver";
import {
  getClosestWorkspaceImageResolutionPresetForSize,
  getDefaultWorkspaceImageSizeForAspectRatio,
  normalizeWorkspaceImageSize,
  resolveAutoWorkspaceImageSize,
  type WorkspaceImageSizeMode,
} from "../../../services/openai-image-presets";
import { getEffectiveStyleLibrary } from "../../../services/vision-orchestrator/style-library";
import {
  executeWorkspaceResearchContext,
  type WorkspaceSendReferenceWebPage,
  type WorkspaceSendResearchMode,
} from "./useWorkspaceSend.helpers";

const formatGenerationError = (error: unknown) => {
  if (!error) return "Unknown error";
  const message =
    error instanceof Error
      ? error.message || error.name || "Unknown error"
      : String(error);

  const timeoutMatch = message.match(/timeout after (\d+)ms/i);
  if (timeoutMatch) {
    const timeoutMs = Number(timeoutMatch[1]);
    const timeoutSeconds =
      Number.isFinite(timeoutMs) && timeoutMs > 0
        ? Math.round(timeoutMs / 1000)
        : null;
    return timeoutSeconds
      ? `Image generation timed out after ${timeoutSeconds}s. Try 1K or 2K, reduce references, or switch to Nano Banana 2.`
      : "Image generation timed out. Try 1K or 2K, reduce references, or switch to Nano Banana 2.";
  }

  if (/524/.test(message) || /gateway timeout/i.test(message)) {
    return "The upstream image provider timed out (524). Try 1K or 2K, reduce references, wait a bit, or switch to another image route/provider.";
  }

  if (/408/.test(message) || /upstream timeout/i.test(message)) {
    return "The upstream image provider timed out (408). Please verify the current provider mirror fully supports the current gpt-image-2 edit payload, including multi-reference uploads and field names.";
  }

  if (
    /429/.test(message) ||
    /rate limited/i.test(message) ||
    /too many requests/i.test(message)
  ) {
    return "Image generation was rate limited by the upstream provider. Wait a bit and retry, or switch to another image route/key.";
  }

  if (/400/.test(message) || /bad request/i.test(message)) {
    const compactMessage = message.replace(/\s+/g, " ").trim();
    if (/upstream image provider/i.test(compactMessage)) {
      return `${compactMessage}. Try reducing references, retrying with 1K or 2K, or checking whether the current provider mirror fully supports gpt-image-2 generation parameters.`;
    }
    return "The upstream image provider rejected the current parameters (400). Try reducing references, retrying with 1K or 2K, or switching to another image route/provider.";
  }

  return message;
};

type RuntimeRepairNote = Omit<
  WorkspaceGenerationTraceDiagnostic,
  "id" | "timestamp"
>;

const dedupeStringList = (values: string[]) =>
  Array.from(new Set(values.map((item) => String(item || "").trim()).filter(Boolean)));

const isSafeStyleReferenceImageUrl = (value: string): boolean => {
  const normalized = String(value || "").trim();
  if (!normalized) return false;
  return /^data:image\//i.test(normalized) || /^blob:/i.test(normalized) || /^https?:\/\//i.test(normalized);
};

const pickPrimaryStyleReferenceImage = (
  styleLibrary?: CanvasElement["genStyleLibrary"],
  seed?: number,
): string | undefined => {
  const normalizedLibrary = getEffectiveStyleLibrary({
    mode: styleLibrary ? "custom" : "none",
    customLibrary: styleLibrary || null,
  });
  if (!normalizedLibrary) return undefined;
  const candidates = dedupeStringList([
    normalizedLibrary.coverImageUrl || "",
    ...(normalizedLibrary.referenceImageUrls || []),
  ]).filter(isSafeStyleReferenceImageUrl);
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];
  const normalizedSeed = Number(seed);
  if (!Number.isFinite(normalizedSeed)) {
    return candidates[0];
  }
  const index = Math.abs(Math.floor(normalizedSeed)) % candidates.length;
  return candidates[index];
};

const mergeStyleReferenceIntoExecutionRefs = (args: {
  referenceImages: string[];
  styleLibrary?: CanvasElement["genStyleLibrary"];
  styleReferenceImage?: string;
}) => {
  const primaryStyleReference =
    args.styleReferenceImage || pickPrimaryStyleReferenceImage(args.styleLibrary);
  if (!primaryStyleReference) {
    return {
      referenceImages: dedupeStringList(args.referenceImages || []),
      injected: false,
      styleReferenceImage: undefined,
    };
  }

  const merged = dedupeStringList([
    primaryStyleReference,
    ...(args.referenceImages || []),
  ]);

  return {
    referenceImages: merged,
    injected: !dedupeStringList(args.referenceImages || []).includes(primaryStyleReference),
    styleReferenceImage: primaryStyleReference,
  };
};

const buildDirectStyleLibraryPrompt = (args: {
  userPrompt: string;
  styleLibrary?: CanvasElement["genStyleLibrary"];
}) => {
  const normalizedLibrary = getEffectiveStyleLibrary({
    mode: args.styleLibrary ? "custom" : "none",
    customLibrary: args.styleLibrary || null,
  });
  const basePrompt = String(args.userPrompt || "").trim();
  if (!normalizedLibrary) {
    return basePrompt;
  }

  const templateLines = [
    normalizedLibrary.title ? `- 当前风格模板：${normalizedLibrary.title}` : "",
    normalizedLibrary.summary ? `- 模板摘要：${normalizedLibrary.summary}` : "",
    normalizedLibrary.promptText
      ? `- 固定风格 Prompt：${normalizedLibrary.promptText}`
      : "",
    normalizedLibrary.tags && normalizedLibrary.tags.length > 0
      ? `- 固定风格标签：${normalizedLibrary.tags.join("、")}`
      : normalizedLibrary.keywords && normalizedLibrary.keywords.length > 0
        ? `- 固定风格标签：${normalizedLibrary.keywords.join("、")}`
        : "",
    normalizedLibrary.description
      ? `- 固定风格原则：${normalizedLibrary.description}`
      : "",
    normalizedLibrary.referenceInterpretation
      ? `- 风格图使用方式：${normalizedLibrary.referenceInterpretation}`
      : "",
    ...(normalizedLibrary.planningDirectives || []).map(
      (item) => `- 模板规划约束：${item}`,
    ),
    ...((normalizedLibrary.promptBackbone || []) as string[]).map(
      (item) => `- 模板提示词骨架：${item}`,
    ),
    ...(normalizedLibrary.promptDirectives || []).map(
      (item) => `- 模板提示词约束：${item}`,
    ),
    "- 生成时先遵守这张风格卡片定义的风格模板，再融合用户当前主体、商品和任务目标。",
    "- 保留用户任务的主体内容，但风格、镜头、光线、材质、氛围与构图组织优先向当前风格模板靠拢。",
  ].filter(Boolean);

  if (templateLines.length === 0) {
    return basePrompt;
  }

  return [
    "[Style Template Priority]",
    ...templateLines,
    "",
    "[User Request]",
    basePrompt,
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
};

const cloneStyleLibraryRuntimeOverlay = (
  overlay?: CanvasElement["genStyleLibraryRuntimeOverlay"] | null,
): CanvasElement["genStyleLibraryRuntimeOverlay"] | undefined => {
  if (!overlay) return undefined;

  const summary = String(overlay.summary || "").trim();
  const referenceInterpretation = String(
    overlay.referenceInterpretation || "",
  ).trim();
  const planningDirectives = dedupeStringList(overlay.planningDirectives || []).slice(
    0,
    8,
  );
  const promptDirectives = dedupeStringList(overlay.promptDirectives || []).slice(
    0,
    8,
  );
  const promptBackbone = dedupeStringList(overlay.promptBackbone || []).slice(0, 8);
  const promptText = String(overlay.promptText || "").trim();
  const tags = dedupeStringList(overlay.tags || []).slice(0, 12);
  const description = String(overlay.description || "").trim();
  const createdBy = String(overlay.createdBy || "").trim();
  const updatedAt = Number(overlay.updatedAt);

  if (
    !summary &&
    !referenceInterpretation &&
    planningDirectives.length === 0 &&
    promptDirectives.length === 0 &&
    promptBackbone.length === 0 &&
    !promptText &&
    tags.length === 0 &&
    !description
  ) {
    return undefined;
  }

  return {
    summary: summary || undefined,
    referenceInterpretation: referenceInterpretation || undefined,
    planningDirectives:
      planningDirectives.length > 0 ? planningDirectives : undefined,
    promptDirectives: promptDirectives.length > 0 ? promptDirectives : undefined,
    promptBackbone: promptBackbone.length > 0 ? promptBackbone : undefined,
    promptText: promptText || undefined,
    tags: tags.length > 0 ? tags : undefined,
    description: description || undefined,
    createdBy:
      createdBy === "system" || createdBy === "main-brain" || createdBy === "user"
        ? createdBy
        : undefined,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : undefined,
  };
};

const buildEffectiveStyleLibrary = (args: {
  baseLibrary?: CanvasElement["genStyleLibrary"];
  runtimeOverlay?: CanvasElement["genStyleLibraryRuntimeOverlay"] | null;
}) => {
  const base = args.baseLibrary;
  if (!base) {
    return undefined;
  }

  const runtimeOverlay = cloneStyleLibraryRuntimeOverlay(args.runtimeOverlay);
  if (!runtimeOverlay) {
    return base;
  }

  return {
    ...base,
    summary: runtimeOverlay.summary || base.summary,
    referenceInterpretation:
      runtimeOverlay.referenceInterpretation || base.referenceInterpretation,
    planningDirectives: dedupeStringList([
      ...(base.planningDirectives || []),
      ...(runtimeOverlay.planningDirectives || []),
    ]).slice(0, 8),
    promptDirectives: dedupeStringList([
      ...(base.promptDirectives || []),
      ...(runtimeOverlay.promptDirectives || []),
    ]).slice(0, 8),
    promptBackbone: dedupeStringList([
      ...((base.promptBackbone as string[] | undefined) || []),
      ...((runtimeOverlay.promptBackbone as string[] | undefined) || []),
    ]).slice(0, 8),
    promptText: runtimeOverlay.promptText || base.promptText,
    tags: dedupeStringList([...(base.tags || []), ...(runtimeOverlay.tags || [])]).slice(0, 12),
    description: runtimeOverlay.description || base.description,
    createdBy: base.createdBy,
    sourceMode: base.sourceMode,
    updatedAt: runtimeOverlay.updatedAt || base.updatedAt,
  } satisfies NonNullable<CanvasElement["genStyleLibrary"]>;
};

const buildStyleLibraryRuntimeOverlay = (
  plannerLibrary?: CanvasElement["genStyleLibrary"],
): CanvasElement["genStyleLibraryRuntimeOverlay"] | undefined => {
  if (!plannerLibrary) {
    return undefined;
  }

  return cloneStyleLibraryRuntimeOverlay({
    summary: plannerLibrary.summary,
    referenceInterpretation: plannerLibrary.referenceInterpretation,
    planningDirectives: plannerLibrary.planningDirectives,
    promptDirectives: plannerLibrary.promptDirectives,
    promptBackbone: plannerLibrary.promptBackbone,
    promptText: plannerLibrary.promptText,
    tags: plannerLibrary.tags,
    description: plannerLibrary.description,
    createdBy:
      plannerLibrary.createdBy === "user" ||
      plannerLibrary.createdBy === "system" ||
      plannerLibrary.createdBy === "main-brain"
        ? plannerLibrary.createdBy
        : "main-brain",
    updatedAt: Date.now(),
  });
};

const toTraceDiagnostics = (
  requestId: string,
  notes: RuntimeRepairNote[],
): WorkspaceGenerationTraceDiagnostic[] => {
  const baseTimestamp = Date.now();
  return notes.map((note, index) => ({
    ...note,
    id: `${requestId}:${note.source}:${note.code}:${baseTimestamp}:${index}`,
    timestamp: baseTimestamp + index,
  }));
};

const normalizeReferenceCandidate = async (
  value: string,
): Promise<string | null> => {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  if (/^data:image\//i.test(normalized) || /^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  if (/^blob:/i.test(normalized)) {
    return normalizeReferenceToDataUrl(normalized);
  }
  return null;
};

const readReferenceImageDimensions = async (
  value: string,
): Promise<{ width: number; height: number } | null> => {
  const normalized = await normalizeReferenceToDataUrl(String(value || "").trim());
  if (!normalized || typeof document === "undefined") {
    return null;
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        width: Math.max(1, image.naturalWidth || image.width || 1),
        height: Math.max(1, image.naturalHeight || image.height || 1),
      });
    image.onerror = () => resolve(null);
    image.src = normalized;
  });
};

const repairGenerationReferenceInputs = async (args: {
  manualReferenceImages: string[];
  previewReferenceImages: string[];
}) => {
  const manualCandidates = args.manualReferenceImages.map((item) =>
    String(item || "").trim(),
  );
  const previewCandidates = args.previewReferenceImages.map((item) =>
    String(item || "").trim(),
  );
  const repairedReferences: string[] = [];
  const notes: RuntimeRepairNote[] = [];
  const totalSlots = Math.max(manualCandidates.length, previewCandidates.length);

  for (let index = 0; index < totalSlots; index += 1) {
    const manualCandidate = manualCandidates[index] || "";
    const previewCandidate = previewCandidates[index] || "";

    if (manualCandidate) {
      const normalizedManual = await normalizeReferenceCandidate(manualCandidate);
      if (normalizedManual) {
        repairedReferences.push(normalizedManual);
        if (
          /^blob:/i.test(manualCandidate) &&
          normalizedManual !== manualCandidate
        ) {
          notes.push({
            code: "reference_blob_normalized",
            source: "reference-preflight",
            severity: "warning",
            message: `Reference image ${index + 1} used a transient blob URL.`,
            repaired: true,
            repairSummary:
              "Converted the blob reference into a stable inline image before planning.",
            detail: manualCandidate,
          });
        }
        continue;
      }
    }

    if (previewCandidate) {
      const normalizedPreview = await normalizeReferenceCandidate(previewCandidate);
      if (normalizedPreview) {
        repairedReferences.push(normalizedPreview);
        notes.push({
          code: "reference_preview_fallback",
          source: "reference-preflight",
          severity: "warning",
          message: `Reference image ${index + 1} could not be read from the primary chain.`,
          repaired: true,
          repairSummary:
            "Recovered the reference from the preview chain for this run. Re-upload the original reference to restore full-fidelity inputs.",
          detail: manualCandidate || previewCandidate,
        });
        continue;
      }
    }

    if (manualCandidate) {
      notes.push({
        code: "reference_unreadable",
        source: "reference-preflight",
        severity: "error",
        message: `Reference image ${index + 1} is no longer readable.`,
        repaired: false,
        repairSummary: null,
        detail: manualCandidate,
      });
    }
  }

  if (
    manualCandidates.length === 0 &&
    previewCandidates.length > 0 &&
    repairedReferences.length > 0
  ) {
    notes.push({
      code: "reference_preview_only",
      source: "reference-preflight",
      severity: "warning",
      message: "The request has preview references but no primary reference chain.",
      repaired: true,
      repairSummary:
        "Used preview references as the working inputs for this run.",
      detail: null,
    });
  }

  return {
    referenceImages: dedupeStringList(repairedReferences),
    notes,
  };
};

const toWorkspaceResearchMode = (
  mode: string | null | undefined,
): WorkspaceSendResearchMode => {
  if (mode === "images") return "images";
  if (mode === "web+images") return "web+images";
  return "off";
};

const buildResearchQuery = (args: {
  prompt: string;
  searchQueries?: string[];
  topics?: string[];
}) => {
  const preferredQuery = (args.searchQueries || [])
    .map((item) => String(item || "").trim())
    .find(Boolean);
  if (preferredQuery) return preferredQuery;

  const preferredTopic = (args.topics || [])
    .map((item) => String(item || "").trim())
    .find(Boolean);
  if (preferredTopic) {
    return `${args.prompt} ${preferredTopic}`.trim();
  }

  return String(args.prompt || "").trim();
};

const mergeResearchReferenceImages = (args: {
  baseReferenceImages: string[];
  researchReferenceImages: string[];
}) => {
  const base = dedupeStringList(args.baseReferenceImages);
  const research = dedupeStringList(args.researchReferenceImages).filter(
    (item) => !base.includes(item),
  );
  const maxResearchRefs = base.length > 0 ? 2 : 4;
  return [...base, ...research.slice(0, maxResearchRefs)];
};

const buildResearchSummary = (args: {
  query: string;
  mode: WorkspaceSendResearchMode;
  webPages: WorkspaceSendReferenceWebPage[];
  referenceImageUrls: string[];
}) => {
  const lines: string[] = [
    `预研查询：${args.query}`,
    `预研模式：${HUMAN_RESEARCH_MODE_LABELS[args.mode] || args.mode}`,
    `网页来源：${args.webPages.length} 个`,
    `图像参考：${args.referenceImageUrls.length} 张`,
  ];

  if (args.webPages[0]) {
    const topPages = args.webPages.slice(0, 3).map((page) => {
      const title = String(page.title || "").trim() || String(page.siteName || "").trim() || page.url;
      const snippet = String(page.snippet || "").trim();
      return snippet ? `${title}：${snippet}` : title;
    });
    lines.push("网页要点：");
    topPages.forEach((item) => {
      lines.push(`- ${item}`);
    });
  }

  return lines.join("\n");
};

const buildResearchStatusLines = (args: {
  mode: WorkspaceSendResearchMode;
  query: string;
  topics: string[];
}) => {
  const lines = [
    `正在执行预研：${HUMAN_RESEARCH_MODE_LABELS[args.mode] || args.mode}`,
    `查询：${args.query}`,
  ];
  if (args.topics.length > 0) {
    lines.push(`关注：${args.topics.slice(0, 3).join(" / ")}`);
  }
  lines.push("完成预研后会重新整理视觉编排");
  return lines;
};

const repairPlannedTaskUnits = (args: {
  taskMode: "single" | "set" | "iterative";
  taskUnits: PlannedVisualTaskUnit[];
  fallbackPrompt: string;
  fallbackAspectRatio: string;
}) => {
  let repairedFieldCount = 0;
  let repairedUnitCount = 0;
  const taskUnits = args.taskUnits.map((unit, index) => {
    const nextUnit = { ...unit };
    let touched = false;

    if (!String(nextUnit.id || "").trim()) {
      nextUnit.id =
        args.taskMode === "set" ? `page-${index + 1}` : `single-${index + 1}`;
      repairedFieldCount += 1;
      touched = true;
    }
    if (!String(nextUnit.title || "").trim()) {
      nextUnit.title =
        args.taskMode === "set" ? `Page ${index + 1}` : `Image ${index + 1}`;
      repairedFieldCount += 1;
      touched = true;
    }
    if (!String(nextUnit.goal || "").trim()) {
      nextUnit.goal = args.fallbackPrompt;
      repairedFieldCount += 1;
      touched = true;
    }
    if (!String(nextUnit.aspectRatio || "").trim()) {
      nextUnit.aspectRatio = args.fallbackAspectRatio || "1:1";
      repairedFieldCount += 1;
      touched = true;
    }
    if (!String(nextUnit.prompt || "").trim()) {
      nextUnit.prompt =
        args.taskMode === "set"
          ? `${args.fallbackPrompt}\n\n[Page Focus]\n${nextUnit.title}: ${nextUnit.goal}`
          : args.fallbackPrompt;
      repairedFieldCount += 1;
      touched = true;
    }

    if (touched) {
      repairedUnitCount += 1;
    }

    return nextUnit;
  });

  const notes: RuntimeRepairNote[] =
    repairedFieldCount > 0
      ? [
          {
            code: "task_unit_fields_repaired",
            source: "task-planner",
            severity: "info",
            message: `Completed minor task-unit field gaps for ${repairedUnitCount} page(s).`,
            repaired: true,
            repairSummary: `Auto-filled ${repairedFieldCount} minor missing field(s) before prompt composition and image generation.`,
            detail: null,
          },
        ]
      : [];

  return {
    taskUnits,
    notes,
  };
};

const buildRepairNoticeMessage = (notes: RuntimeRepairNote[]) => {
  const visibleNotes = notes.filter((item) => item.severity !== "info");
  if (!visibleNotes.length) return "";
  const repaired = visibleNotes.filter((item) => item.repaired);
  const unresolved = visibleNotes.filter((item) => !item.repaired);
  const lines = ["检测到执行链异常："];
  repaired.slice(0, 3).forEach((item) => {
    lines.push(`- 已处理：${item.message}${item.repairSummary ? ` ${item.repairSummary}` : ""}`);
  });
  unresolved.slice(0, 2).forEach((item) => {
    lines.push(`- 未解决：${item.message}`);
  });
  return lines.join("\n");
};

const clipLiveLogText = (value: string, maxLength = 88) => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength).trim()}...`
    : normalized;
};

const formatElapsedSeconds = (elapsedMs: number) => {
  const seconds = Math.max(1, Math.round(elapsedMs / 1000));
  return `${seconds}s`;
};

const buildReferenceRepairLogLines = (notes: RuntimeRepairNote[]) =>
  notes
    .filter((note) => note.severity !== "info")
    .slice(0, 3)
    .map((note) => {
      const summary = clipLiveLogText(note.repairSummary || note.message, 92);
      return note.repaired ? `已修复：${summary}` : `未修复：${summary}`;
    })
    .filter(Boolean);

const buildTaskThoughtLogLines = (args: {
  taskPlan: {
    intent: string;
    reasoningSummary: string;
    toolChain: string[];
    planningBrief?: VisualPlanningBrief | null;
    roleOverlay?: VisualRoleOverlay | null;
  };
  taskUnits: PlannedVisualTaskUnit[];
  selectedGenerationModel: string;
}) => {
  const lines: string[] = [];
  lines.push(
    `任务判断：${
      args.taskPlan.planningBrief?.requestType ||
      HUMAN_INTENT_LABELS[args.taskPlan.intent] ||
      args.taskPlan.intent
    }`,
  );
  if (args.taskPlan.reasoningSummary) {
    lines.push(`思考：${clipLiveLogText(args.taskPlan.reasoningSummary, 110)}`);
  }
  if (args.taskPlan.roleOverlay?.summary) {
    lines.push(`角色脑：${clipLiveLogText(args.taskPlan.roleOverlay.summary, 92)}`);
  }
  if (args.taskPlan.planningBrief?.researchDecision?.shouldResearch) {
    lines.push(
      `继续动作：先做${
        HUMAN_RESEARCH_MODE_LABELS[args.taskPlan.planningBrief.researchDecision.mode] ||
        args.taskPlan.planningBrief.researchDecision.mode
      }`,
    );
  }
  if (args.taskUnits.length > 0) {
    const labels = args.taskUnits
      .slice(0, 3)
      .map((unit) => `${buildTaskUnitLabel(unit)} ${unit.aspectRatio}`)
      .join(" / ");
    lines.push(
      args.taskUnits.length > 1
        ? `拆分输出：${args.taskUnits.length} 张，${clipLiveLogText(labels, 96)}`
        : `输出规格：${clipLiveLogText(labels, 96)}`,
    );
  }
  if (args.selectedGenerationModel) {
    lines.push(`准备调用生图模型：${args.selectedGenerationModel}`);
  }
  return lines.slice(0, 5);
};

const HUMAN_INTENT_LABELS: Record<string, string> = {
  poster_rebuild: "海报复刻",
  multi_reference_fusion: "多图融合",
  product_lock: "主体锁定",
  product_scene: "场景生成",
  background_replace: "背景替换",
  text_preserve: "文案版式保留",
};

const HUMAN_REFERENCE_ROLE_MODE_LABELS: Record<string, string> = {
  none: "无约束",
  default: "智能分配",
  "poster-product": "海报参考 + 产品参考",
};

const HUMAN_REFERENCE_ROLE_MODE_LABELS_V2: Record<string, string> = {
  none: "无约束",
  default: "智能分配",
  "poster-product": "海报参考 + 产品参考",
  custom: "自定义风格库",
};

const HUMAN_RESEARCH_MODE_LABELS: Record<string, string> = {
  none: "无需预研",
  images: "先找图像参考",
  "web+images": "先做网页与图像预研",
};

const HUMAN_QUALITY_LABELS: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

const buildTaskUnitLabel = (
  unit: Pick<PlannedVisualTaskUnit, "title" | "pageIndex" | "totalPages">,
) => {
  const title = String(unit.title || "").trim();
  if (!title) {
    return unit.totalPages > 1 ? `${unit.pageIndex + 1}/${unit.totalPages}` : "1/1";
  }
  if (/^\d+\s*p/i.test(title)) {
    return title;
  }
  return unit.totalPages > 1 ? `${unit.pageIndex + 1}P ${title}` : title;
};

const formatPlannerNote = (note: string): string => {
  const value = String(note || "").trim();
  if (!value) return "";
  if (value.startsWith("planner-model=")) {
    return `编排模型：${value.slice("planner-model=".length)}`;
  }
  if (value.startsWith("intent=")) {
    const intent = value.slice("intent=".length);
    return `识别意图：${HUMAN_INTENT_LABELS[intent] || intent}`;
  }
  if (value.startsWith("reference-role-mode=")) {
    const mode = value.slice("reference-role-mode=".length);
    return `参考图分工：${HUMAN_REFERENCE_ROLE_MODE_LABELS_V2[mode] || mode}`;
  }
  return value;
};

const buildPlannedStatusLines = ({
  intent,
  strategyId,
  referenceRoleMode,
  plannerNotes,
  planningBrief,
  selectedGenerationModel,
}: {
  intent: string;
  strategyId: string;
  referenceRoleMode: string;
  plannerNotes: string[];
  planningBrief?: VisualPlanningBrief | null;
  selectedGenerationModel?: string | null;
}) => {
  const lines = [
    `意图：${HUMAN_INTENT_LABELS[intent] || intent}`,
    `分工：${HUMAN_REFERENCE_ROLE_MODE_LABELS_V2[referenceRoleMode] || referenceRoleMode}`,
    `策略：${strategyId}`,
  ];

  if (planningBrief?.deliverableForm) {
    lines.push(`交付：${planningBrief.deliverableForm}`);
  }
  if (planningBrief?.researchDecision) {
    const decision = planningBrief.researchDecision;
    lines.push(
      `预研：${
        decision.shouldResearch
          ? HUMAN_RESEARCH_MODE_LABELS[decision.mode] || decision.mode
          : "当前信息已足够"
      }`,
    );
  }
  if (selectedGenerationModel) {
    lines.push(`模型：${selectedGenerationModel}`);
  }
  if (planningBrief?.modelFitNotes?.[0]) {
    lines.push(`模型特性：${planningBrief.modelFitNotes[0]}`);
  }

  for (const note of plannerNotes.map(formatPlannerNote)) {
    if (!note) continue;
    if (lines.includes(note)) continue;
    lines.push(note);
    if (lines.length >= 5) break;
  }

  return lines.slice(0, 5);
};

const formatPlanningBriefLine = (label: string, value: string) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return `${label}${normalized}`;
};

const buildPlanningBriefMessage = (args: {
  planningBrief?: VisualPlanningBrief | null;
  roleOverlay?: VisualRoleOverlay | null;
  taskUnits: PlannedVisualTaskUnit[];
  isSetTask: boolean;
  imageCount: number;
  composedPrompt: string;
  selectedGenerationModel?: string | null;
}) => {
  const {
    planningBrief,
    roleOverlay,
    taskUnits,
    isSetTask,
    imageCount,
    composedPrompt,
    selectedGenerationModel,
  } = args;
  const lines: string[] = [];

  if (planningBrief?.deliverableForm) {
    lines.push(
      formatPlanningBriefLine("\u51c6\u5907\u4ea4\u4ed8\uff1a", planningBrief.deliverableForm),
    );
  }
  if (selectedGenerationModel) {
    lines.push(
      formatPlanningBriefLine("当前生图模型：", selectedGenerationModel),
    );
  }
  if (planningBrief?.researchDecision) {
    const decision = planningBrief.researchDecision;
    lines.push(
      formatPlanningBriefLine(
        "预研判断：",
        decision.shouldResearch
          ? HUMAN_RESEARCH_MODE_LABELS[decision.mode] || decision.mode
          : "当前不需要额外预研",
      ),
    );
    lines.push(formatPlanningBriefLine("判断原因：", decision.reason));
    if (decision.topics?.[0]) {
      lines.push(
        formatPlanningBriefLine("优先研究：", decision.topics.join(" / ")),
      );
    }
  }
  if (roleOverlay?.summary) {
    lines.push(formatPlanningBriefLine("本次角色脑：", roleOverlay.summary));
  }
  if (roleOverlay?.roles?.length) {
    lines.push(
      formatPlanningBriefLine(
        "临时角色：",
        roleOverlay.roles.map((item) => item.role).join(" / "),
      ),
    );
  }
  if (isSetTask && taskUnits.length > 0) {
    lines.push("\u9875\u9762\u89c4\u5212\uff1a");
    taskUnits.slice(0, 3).forEach((unit) => {
      const title = buildTaskUnitLabel(unit);
      const goal = String(unit.goal || "").trim();
      const ratio = String(unit.aspectRatio || "").trim() || "?";
      lines.push(`- ${title} | ${ratio} | ${goal}`);
    });
  }
  if (planningBrief?.risks?.[0]) {
    lines.push(formatPlanningBriefLine("\u98ce\u9669\uff1a", planningBrief.risks[0]));
  }
  if (isSetTask && taskUnits.length > 3) {
    lines.push(`\u66f4\u591a\u9875\u9762\uff1a\u5171 ${taskUnits.length} \u5f20\uff0c\u5269\u4f59\u5185\u5bb9\u5c06\u6309\u7f16\u6392\u987a\u5e8f\u6267\u884c\u3002`);
  }

  const heading = isSetTask
    ? `\u5df2\u5b8c\u6210\u5957\u56fe\u89c4\u5212\uff0c\u51c6\u5907\u751f\u6210 ${imageCount} \u5f20\u9875\u9762\u3002`
    : imageCount > 1
      ? `\u5df2\u5b8c\u6210\u89c6\u89c9\u7f16\u6392\uff0c\u51c6\u5907\u751f\u6210 ${imageCount} \u5f20\u56fe\u3002`
      : "\u5df2\u5b8c\u6210\u89c6\u89c9\u7f16\u6392\uff0c\u51c6\u5907\u5f00\u59cb\u751f\u56fe\u3002";

  return [heading, ...lines.filter(Boolean).slice(0, 5)].join("\n");
};

const buildGeneratingStatusLines = ({
  imageCount,
  variantLabel,
  model,
  aspectRatio,
  imageSize,
  imageQuality,
  referenceCount,
  planLines,
}: {
  imageCount: number;
  variantLabel: string;
  model: string;
  aspectRatio: string;
  imageSize: string;
  imageQuality: string;
  referenceCount: number;
  planLines: string[];
}) => {
  const lines = [
    imageCount > 1 ? `当前批次：${variantLabel}` : "已完成视觉编排，正在请求生图",
    `模型：${model}`,
    `参数：${aspectRatio} · ${imageSize} · 质量${HUMAN_QUALITY_LABELS[imageQuality] || imageQuality}`,
    `参考图：${referenceCount} 张`,
  ];

  const importantPlanLine = planLines.find((line) => line.startsWith("分工："));
  if (importantPlanLine) {
    lines.push(importantPlanLine);
  }

  return lines.slice(0, 5);
};

const buildExecutionPlanSummaryLines = (args: {
  taskPlan: {
    planningBrief?: VisualPlanningBrief | null;
    reasoningSummary: string;
  };
  plan: {
    strategyId: string;
    plannerNotes?: string[];
  };
  referenceRoleMode: string;
  isSetTask: boolean;
  taskUnits: PlannedVisualTaskUnit[];
  primaryTaskUnit: PlannedVisualTaskUnit;
}) =>
  [
    `编排完成：${clipLiveLogText(args.taskPlan.planningBrief?.deliverableForm || args.plan.strategyId, 96)}`,
    `参考分工：${HUMAN_REFERENCE_ROLE_MODE_LABELS_V2[args.referenceRoleMode] || args.referenceRoleMode}`,
    args.plan.plannerNotes?.[0]
      ? `策略理由：${clipLiveLogText(formatPlannerNote(args.plan.plannerNotes[0]), 96)}`
      : `策略理由：${clipLiveLogText(args.taskPlan.reasoningSummary, 96)}`,
    args.isSetTask
      ? `页面拆分：${args.taskUnits
          .slice(0, 3)
          .map((unit) => buildTaskUnitLabel(unit))
          .join(" / ")}${args.taskUnits.length > 3 ? " ..." : ""}`
      : `输出目标：${clipLiveLogText(args.primaryTaskUnit.goal, 96)}`,
  ].filter(Boolean);

const buildQueuedStatusLines = ({
  variantLabel,
  waitingForLabel,
  planLines,
}: {
  variantLabel: string;
  waitingForLabel?: string;
  planLines: string[];
}) => {
  const lines = [
    `当前批次：${variantLabel}`,
    waitingForLabel
      ? `正在等待前序任务 ${waitingForLabel} 完成`
      : "正在等待前序任务完成",
    "轮到当前节点时会自动开始生图",
  ];

  const importantPlanLine = planLines.find((line) => line.startsWith("分工："));
  if (importantPlanLine) {
    lines.push(importantPlanLine);
  }

  return lines.slice(0, 5);
};

const STREAMED_LOG_DELAY_MS = 120;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const createGenerationLogStreamer = (args: {
  getTargetIds: () => string[];
  appendElementsGenerationLog: (
    elementIds: string[],
    update: {
      phase?: "planning" | "planned" | "queued" | "generating" | "retrying";
      title?: string;
      lines: string[];
    },
  ) => void;
}) => {
  let queue = Promise.resolve();

  const push = (update: {
    phase?: "planning" | "planned" | "queued" | "generating" | "retrying";
    title?: string;
    line?: string | null;
    lines?: string[];
    delayMs?: number;
  }) => {
    const targetIds = args.getTargetIds().filter(Boolean);
    const normalizedLines = (update.lines || [])
      .concat(update.line ? [update.line] : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    if (targetIds.length === 0 || normalizedLines.length === 0) return queue;

    normalizedLines.forEach((line, index) => {
      queue = queue.then(async () => {
        args.appendElementsGenerationLog(targetIds, {
          phase: update.phase,
          title: index === 0 ? update.title : undefined,
          lines: [line],
        });
        await sleep(update.delayMs ?? STREAMED_LOG_DELAY_MS);
      });
    });

    return queue;
  };

  return {
    push,
    flush: () => queue,
  };
};

const buildResearchKickoffLines = (args: {
  decision: VisualPlanningBrief["researchDecision"];
  researchQuery: string;
}) => {
  const lines = [
    `判断这次要先做${HUMAN_RESEARCH_MODE_LABELS[args.decision.mode] || args.decision.mode}，不是直接生图。`,
    `原因：${clipLiveLogText(args.decision.reason, 110)}`,
    `先查：${clipLiveLogText(args.researchQuery, 110)}`,
  ];
  if (args.decision.topics?.[0]) {
    lines.push(`重点补齐：${clipLiveLogText(args.decision.topics.join(" / "), 110)}`);
  }
  return lines;
};

const buildResearchCompletedLines = (args: {
  webCount: number;
  imageCount: number;
  mergedReferenceCount: number;
}) => [
  `调研完成：网页 ${args.webCount} 条，补充图片参考 ${args.imageCount} 张。`,
  `已把调研结果并回编排链路，可用参考总数变成 ${args.mergedReferenceCount} 张。`,
  "接下来会根据这些结果重新判断页面结构、卖点优先级和 prompt 写法。",
];

type VisualPlanningCachePayload = {
  cacheKey: string;
  createdAt: number;
  taskPlan: PlannedVisualTask["taskPlan"];
  taskUnits: PlannedVisualTaskUnit[];
  referenceImages: string[];
  consistencyContext?: Record<string, unknown>;
  referenceRoleMode: NonNullable<CanvasElement["genReferenceRoleMode"]>;
  styleLibrary?: CanvasElement["genStyleLibrary"];
  styleLibraryRuntimeOverlay?: CanvasElement["genStyleLibraryRuntimeOverlay"];
  pageGenerationPlans?: PlannedImageGeneration[];
};

const VISUAL_PLANNING_CACHE_SCHEMA_VERSION = 2;

const buildVisualPlanningCacheKey = (args: {
  prompt: string;
  manualReferenceImages: string[];
  mergedReferenceImages: string[];
  aspectRatio: string;
  imageCount: number;
  model: string;
  imageSize: string;
  imageQuality: string;
  referenceRoleMode: string;
  styleLibrary?: CanvasElement["genStyleLibrary"];
  translatePromptToEnglish: boolean;
  enforceChineseTextInImage: boolean;
  requiredChineseCopy: string;
}) =>
  JSON.stringify({
    schemaVersion: VISUAL_PLANNING_CACHE_SCHEMA_VERSION,
    prompt: String(args.prompt || "").trim(),
    manualReferenceImages: dedupeStringList(args.manualReferenceImages || []),
    mergedReferenceImages: dedupeStringList(args.mergedReferenceImages || []),
    aspectRatio: String(args.aspectRatio || "").trim(),
    imageCount: Number(args.imageCount || 1),
    model: String(args.model || "").trim(),
    imageSize: String(args.imageSize || "").trim(),
    imageQuality: String(args.imageQuality || "").trim(),
    referenceRoleMode: String(args.referenceRoleMode || "").trim(),
    styleLibrary: args.styleLibrary || null,
    translatePromptToEnglish: Boolean(args.translatePromptToEnglish),
    enforceChineseTextInImage: Boolean(args.enforceChineseTextInImage),
    requiredChineseCopy: String(args.requiredChineseCopy || "").trim(),
  });

const readVisualPlanningCachePayload = (
  element: CanvasElement,
  cacheKey: string,
): VisualPlanningCachePayload | null => {
  if (String(element.genVisualPlanningCacheKey || "") !== cacheKey) {
    return null;
  }

  const rawPayload = String(element.genVisualPlanningCachePayload || "").trim();
  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as VisualPlanningCachePayload | null;
    if (!parsed || parsed.cacheKey !== cacheKey || !Array.isArray(parsed.taskUnits)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

type UseWorkspaceElementImageGenerationOptions = {
  elementsRef: MutableRefObject<CanvasElement[]>;
  nodeInteractionMode: WorkspaceNodeInteractionMode;
  updateElementById: (
    elementId: string,
    updates: Partial<CanvasElement>,
  ) => boolean;
  setElementGeneratingState: (
    elementId: string,
    isGenerating: boolean,
    errorMessage?: string,
  ) => void;
  setElementsGenerationStatus: (
    elementIds: string[],
    status?: {
      phase?: "planning" | "planned" | "queued" | "generating" | "retrying";
      title?: string;
      lines?: string[];
    } | null,
  ) => void;
  appendElementsGenerationLog: (
    elementIds: string[],
    update: {
      phase?: "planning" | "planned" | "queued" | "generating" | "retrying";
      title?: string;
      lines: string[];
    },
  ) => void;
  addMessage: (message: ChatMessage) => void;
  translatePromptToEnglish: boolean;
  enforceChineseTextInImage: boolean;
  requiredChineseCopy: string;
  preGenerationPlanningEnabled: boolean;
  getDesignConsistencyContext: () => Record<string, unknown>;
  mergeConsistencyAnchorIntoReferences: (referenceUrls?: string[]) => string[];
  retryWithConsistencyFix: (
    label: string,
    initialUrl: string,
    rerun: (fixPrompt?: string) => Promise<string | null>,
    anchorOverride?: string,
    genPrompt?: string,
    referenceCount?: number,
  ) => Promise<string>;
  applyGeneratedImageToElement: (
    elementId: string,
    resultUrl: string,
    keepCurrentSize?: boolean,
  ) => Promise<void>;
  createGeneratingImagesNearElement: (
    sourceElementId: string,
    additionalCount: number,
  ) => string[];
  createGeneratingTreeImageChildren: (
    sourceElementId: string,
    totalCount: number,
  ) => string[];
  getClosestAspectRatio: (width: number, height: number) => string;
};

export function useWorkspaceElementImageGeneration(
  options: UseWorkspaceElementImageGenerationOptions,
) {
  const {
    elementsRef,
    nodeInteractionMode,
    updateElementById,
    setElementGeneratingState,
    setElementsGenerationStatus,
    appendElementsGenerationLog,
    addMessage,
    translatePromptToEnglish,
    enforceChineseTextInImage,
    requiredChineseCopy,
    preGenerationPlanningEnabled,
    mergeConsistencyAnchorIntoReferences,
    getDesignConsistencyContext,
    retryWithConsistencyFix,
    applyGeneratedImageToElement,
    createGeneratingImagesNearElement,
    createGeneratingTreeImageChildren,
    getClosestAspectRatio,
  } = options;
  const activeRequestsRef = useRef(new Set<string>());
  const activePlanningKeysRef = useRef(new Set<string>());
  const activePlanningPayloadRef = useRef(
    new Map<
      string,
      {
        promise: Promise<VisualPlanningCachePayload | null>;
        resolve: (payload: VisualPlanningCachePayload | null) => void;
        reject: (error: unknown) => void;
      }
    >(),
  );

  return useCallback(
    async (elementId: string) => {
      const requestElement = elementsRef.current.find(
        (element) => element.id === elementId,
      );
      if (!requestElement) return null;
      const isTreePromptRequest =
        resolveWorkspaceTreeNodeKind(requestElement, nodeInteractionMode) ===
        "prompt";
      const requestKey = isTreePromptRequest
        ? `${elementId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
        : elementId;

      if (!isTreePromptRequest && activeRequestsRef.current.has(requestKey)) {
        return null;
      }
      activeRequestsRef.current.add(requestKey);
      const requestStartedAt = Date.now();
      const traceRequestId = `${elementId}:${requestStartedAt}:${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      announceWorkspaceGenerationRequest(elementId, traceRequestId);
      console.info("[workspace.imggen] request.queued", {
        requestId: traceRequestId,
        elementId,
        queuedAt: requestStartedAt,
      });
      let plannerStartedAt = 0;
      let taskPlannerStartedAt = 0;
      let taskPlannerRunCount = 0;
      let shouldTrackSourceElementState = false;
      let targetElementIds: string[] = [];
      let sourceRequestLockKey: string | null = null;
      let planningInflightKey: string | null = null;
      let ownsPlanningExecution = false;
      let rejectPlanningPayloadSession: (error: unknown) => void = () => {};
      try {
        const el = elementsRef.current.find((element) => element.id === elementId);
        if (!el) return traceRequestId;
        const isTreePromptNode =
          resolveWorkspaceTreeNodeKind(el, nodeInteractionMode) === "prompt";
        const isTreeImageNode =
          resolveWorkspaceTreeNodeKind(el, nodeInteractionMode) === "image";
        const parentPromptElement =
          isTreeImageNode && el.nodeParentId
            ? elementsRef.current.find(
                (element) =>
                  element.id === el.nodeParentId &&
                  resolveWorkspaceTreeNodeKind(element, nodeInteractionMode) ===
                    "prompt",
              ) || null
            : null;
        const sourceElement = parentPromptElement || el;
        if (!sourceElement.genPrompt) return traceRequestId;
        sourceRequestLockKey = `source:${sourceElement.id}`;
        if (activeRequestsRef.current.has(sourceRequestLockKey)) {
          return null;
        }
        activeRequestsRef.current.add(sourceRequestLockKey);
        shouldTrackSourceElementState = !isTreePromptNode;
        if (shouldTrackSourceElementState) {
          setElementGeneratingState(elementId, true);
        }

        const fallbackAspectRatio =
          sourceElement.genAspectRatio ||
          getClosestAspectRatio(sourceElement.width, sourceElement.height);
        const model = sourceElement.genModel || "Nano Banana Pro";
        const imageSize = sourceElement.genResolution || "1K";
        const imageQuality = sourceElement.genImageQuality || "medium";
        const currentSizeMode =
          (sourceElement.genSizeMode || "preset") as WorkspaceImageSizeMode;
        const requestedImageCount = isTreePromptNode
          ? Math.max(1, Math.min(4, sourceElement.genImageCount || 1))
          : 1;
        const rawManualReferenceImages =
          sourceElement.genRefImages ||
          (sourceElement.genRefImage ? [sourceElement.genRefImage] : []);
        const rawPreviewReferenceImages =
          sourceElement.genRefPreviewImages ||
          (sourceElement.genRefPreviewImage
            ? [sourceElement.genRefPreviewImage]
            : []);
        const repairedReferenceInput = await repairGenerationReferenceInputs({
          manualReferenceImages: rawManualReferenceImages,
          previewReferenceImages: rawPreviewReferenceImages,
        });
        const baseCustomSize =
          Number.isFinite(sourceElement.genCustomWidth) &&
          Number.isFinite(sourceElement.genCustomHeight) &&
          Number(sourceElement.genCustomWidth) > 0 &&
          Number(sourceElement.genCustomHeight) > 0
            ? normalizeWorkspaceImageSize({
                width: Number(sourceElement.genCustomWidth),
                height: Number(sourceElement.genCustomHeight),
              })
            : getDefaultWorkspaceImageSizeForAspectRatio({
                aspectRatio: fallbackAspectRatio,
                resolution: imageSize,
              });
        const autoReferenceDimensions =
          currentSizeMode === "auto" && repairedReferenceInput.referenceImages[0]
            ? await readReferenceImageDimensions(repairedReferenceInput.referenceImages[0])
            : null;
        const resolvedWorkspaceImageSize =
          currentSizeMode === "auto"
            ? resolveAutoWorkspaceImageSize({
                model,
                referenceWidth: autoReferenceDimensions?.width ?? null,
                referenceHeight: autoReferenceDimensions?.height ?? null,
                fallbackAspectRatio,
                fallbackResolution: imageSize,
              })
            : baseCustomSize;
        const currentAspectRatio = resolvedWorkspaceImageSize.aspectRatio;
        const exactSize =
          currentSizeMode === "preset"
            ? undefined
            : `${resolvedWorkspaceImageSize.width}x${resolvedWorkspaceImageSize.height}`;
        const resolvedImageSizePreset =
          currentSizeMode === "preset"
            ? imageSize
            : getClosestWorkspaceImageResolutionPresetForSize({
                aspectRatio: currentAspectRatio,
                width: resolvedWorkspaceImageSize.width,
                height: resolvedWorkspaceImageSize.height,
              });
        const manualReferenceImages = repairedReferenceInput.referenceImages;
        const referenceImages = mergeConsistencyAnchorIntoReferences(
          manualReferenceImages,
        );
        const consistencyAnchorInjected =
          referenceImages.length > 0 &&
          (manualReferenceImages.length === 0 ||
            referenceImages[0] !== manualReferenceImages[0] ||
            referenceImages.length !== manualReferenceImages.length);
        const visualOrchestratorModel = getVisualOrchestratorModelConfig();

        upsertWorkspaceGenerationTrace({
          requestId: traceRequestId,
          requestElementId: elementId,
          sourceElementId: sourceElement.id,
          targetElementIds,
          startedAt: requestStartedAt,
          updatedAt: Date.now(),
          status: "planning",
          sourcePrompt: sourceElement.genPrompt,
          plannerModel: visualOrchestratorModel
            ? {
                modelId: visualOrchestratorModel.modelId,
                providerId: visualOrchestratorModel.providerId || null,
                label: visualOrchestratorModel.displayLabel,
              }
            : null,
          manualReferenceCount: rawManualReferenceImages.length,
          referenceCount: referenceImages.length,
          model: String(model),
          aspectRatio: currentAspectRatio,
          imageSize,
          imageQuality,
          imageCount: requestedImageCount,
          diagnostics: [],
          variantResults: [],
        });
        console.info("[workspace.imggen] request.start", {
          requestId: traceRequestId,
          elementId,
          sourceElementId: sourceElement.id,
          requestedImageCount,
          model,
          aspectRatio: currentAspectRatio,
          imageSize,
          imageQuality,
          manualReferenceCount: manualReferenceImages.length,
          referenceCount: referenceImages.length,
        });

        if (repairedReferenceInput.notes.length > 0) {
          appendWorkspaceGenerationTraceDiagnostics(
            traceRequestId,
            toTraceDiagnostics(traceRequestId, repairedReferenceInput.notes),
          );
          const repairNoticeMessage = buildRepairNoticeMessage(
            repairedReferenceInput.notes,
          );
          if (repairNoticeMessage) {
            addMessage({
              id: `gen-repair-${traceRequestId}`,
              role: "model",
              text: repairNoticeMessage,
              timestamp: Date.now(),
            });
          }
        }

        if (
          rawManualReferenceImages.length > 0 &&
          manualReferenceImages.length === 0
        ) {
          throw new Error(
            "Reference images were attached, but none of them could be recovered from the primary or preview chain. Please re-upload the reference images before generating again.",
          );
        }

        if (isTreePromptNode) {
          targetElementIds = createGeneratingTreeImageChildren(
            elementId,
            requestedImageCount,
          );
          if (targetElementIds.length === 0) {
            throw new Error("Failed to create tree image placeholders");
          }
        }

        const liveStatusTargetIds =
          isTreePromptNode && targetElementIds.length > 0
            ? targetElementIds
            : [elementId];
        setElementsGenerationStatus(liveStatusTargetIds, {
          phase: "planning",
          title: "等待规划模型返回",
          lines: [],
        });
        const planningLogStreamer = createGenerationLogStreamer({
          getTargetIds: () =>
            isTreePromptNode && targetElementIds.length > 0
              ? targetElementIds
              : [elementId],
          appendElementsGenerationLog,
        });

        if (repairedReferenceInput.notes.length > 0) {
          planningLogStreamer.push({
            phase: "planning",
            title: "正在修复输入链路",
            lines: buildReferenceRepairLogLines(repairedReferenceInput.notes),
          });
        }

        const plannerModelConfig = visualOrchestratorModel
          ? {
              modelId: visualOrchestratorModel.modelId,
              providerId: visualOrchestratorModel.providerId || null,
              label: visualOrchestratorModel.displayLabel,
            }
          : null;

        let currentReferenceImages = referenceImages;
        let currentConsistencyContext = getDesignConsistencyContext();
        let currentReferenceRoleMode: NonNullable<
          CanvasElement["genReferenceRoleMode"]
        > = sourceElement.genReferenceRoleMode || "default";
        let currentBaseStyleLibrary = getEffectiveStyleLibrary({
          mode: currentReferenceRoleMode,
          customLibrary: sourceElement.genStyleLibrary,
        });
        let currentStyleLibraryRuntimeOverlay = cloneStyleLibraryRuntimeOverlay(
          sourceElement.genStyleLibraryRuntimeOverlay,
        );
        let currentStyleLibrary = buildEffectiveStyleLibrary({
          baseLibrary: currentBaseStyleLibrary,
          runtimeOverlay: currentStyleLibraryRuntimeOverlay,
        });
        let currentStyleReferenceImage = pickPrimaryStyleReferenceImage(
          currentStyleLibrary,
          requestStartedAt,
        );
        currentReferenceImages = mergeStyleReferenceIntoExecutionRefs({
          referenceImages: currentReferenceImages,
          styleLibrary: currentStyleLibrary,
          styleReferenceImage: currentStyleReferenceImage,
        }).referenceImages;
        const planningBypassReason = !preGenerationPlanningEnabled
          ? "global-pre-generation-planning-disabled"
          : null;
        const planningCacheKey = buildVisualPlanningCacheKey({
          prompt: sourceElement.genPrompt || "",
          manualReferenceImages,
          mergedReferenceImages: currentReferenceImages,
          aspectRatio: currentAspectRatio,
          imageCount: requestedImageCount,
          model: String(model),
          imageSize,
          imageQuality,
          referenceRoleMode: currentReferenceRoleMode,
          styleLibrary: currentStyleLibrary,
          translatePromptToEnglish,
          enforceChineseTextInImage,
          requiredChineseCopy,
        });
        let cachedPlanningPayload = !planningBypassReason
          ? readVisualPlanningCachePayload(sourceElement, planningCacheKey)
          : null;
        const shouldBypassPlanning = Boolean(planningBypassReason);
        planningInflightKey = `${sourceElement.id}:${planningCacheKey}`;

        const waitForReusablePlanningPayload = async () => {
          if (!planningInflightKey) {
            return null;
          }
          const activeSession = activePlanningPayloadRef.current.get(planningInflightKey);
          if (!activeSession) {
            return null;
          }
          try {
            return await activeSession.promise;
          } catch {
            return null;
          }
        };

        const resolvePlanningPayloadSession = (
          payload: VisualPlanningCachePayload | null,
        ) => {
          if (!planningInflightKey) {
            return;
          }
          const activeSession = activePlanningPayloadRef.current.get(planningInflightKey);
          if (activeSession) {
            activeSession.resolve(payload);
            activePlanningPayloadRef.current.delete(planningInflightKey);
          }
          if (ownsPlanningExecution) {
            activePlanningKeysRef.current.delete(planningInflightKey);
            ownsPlanningExecution = false;
          }
        };

        rejectPlanningPayloadSession = (error: unknown) => {
          if (!planningInflightKey) {
            return;
          }
          const activeSession = activePlanningPayloadRef.current.get(planningInflightKey);
          if (activeSession) {
            activeSession.reject(error);
            activePlanningPayloadRef.current.delete(planningInflightKey);
          }
          if (ownsPlanningExecution) {
            activePlanningKeysRef.current.delete(planningInflightKey);
            ownsPlanningExecution = false;
          }
        };

        const persistSourceStyleLibraryRuntimeOverlay = (
          runtimeOverlay: CanvasElement["genStyleLibraryRuntimeOverlay"] | undefined,
        ) => {
          const liveSourceElement =
            elementsRef.current.find((item) => item.id === sourceElement.id) || null;
          const normalizedRuntimeOverlay = cloneStyleLibraryRuntimeOverlay(runtimeOverlay);
          const sameRuntimeOverlay =
            JSON.stringify(liveSourceElement?.genStyleLibraryRuntimeOverlay || null) ===
            JSON.stringify(normalizedRuntimeOverlay || null);
          if (sameRuntimeOverlay) {
            return;
          }
          updateElementById(sourceElement.id, {
            genStyleLibraryRuntimeOverlay: normalizedRuntimeOverlay,
          });
        };

        const buildDirectTask = (): PlannedVisualTask => ({
          taskPlan: {
            mode: "single" as const,
            userGoal: sourceElement.genPrompt || "",
            intent: "unknown",
            reasoningSummary:
              "已关闭生图前视觉编排，直接使用当前关键词与参考图进入生成。",
            toolChain: ["direct-generate"],
            planningBrief: {
              requestType: "direct_prompt",
              deliverableForm:
                requestedImageCount > 1 ? "multi-variant-image" : "single-image",
              aspectRatioStrategy: `使用当前画幅 ${currentAspectRatio}`,
              researchFocus: [],
              researchDecision: {
                shouldResearch: false,
                mode: "none" as const,
                reason: "已关闭生图前视觉编排，直接进入生成。",
                topics: [],
                searchQueries: [],
              },
              modelFitNotes: ["直接沿用当前关键词，不做额外视觉编排。"],
              promptDirectives: [
                "直接使用当前关键词与参考图生成，不追加视觉编排扩写。",
              ],
              risks: [],
            },
          },
          units: [
            {
              id: "single-1",
              title: requestedImageCount > 1 ? "基础提示词" : "单图",
              goal: sourceElement.genPrompt || "",
              aspectRatio: currentAspectRatio,
              prompt: sourceElement.genPrompt || "",
              pageIndex: 0,
              totalPages: 1,
            },
          ],
        });

        const buildDirectPageGenerationPlan = (
          taskUnit: PlannedVisualTaskUnit,
        ): PlannedImageGeneration => {
          const promptLanguagePolicy = translatePromptToEnglish
            ? "translate-en"
            : "original-zh";
          const trimmedRequiredChineseCopy = String(requiredChineseCopy || "").trim();
          const textPolicy =
            enforceChineseTextInImage || trimmedRequiredChineseCopy
              ? {
                  enforceChinese: enforceChineseTextInImage,
                  requiredCopy: trimmedRequiredChineseCopy || undefined,
                }
              : undefined;
          const mergedExecutionReferences = mergeStyleReferenceIntoExecutionRefs({
            referenceImages: currentReferenceImages,
            styleLibrary: currentStyleLibrary,
            styleReferenceImage: currentStyleReferenceImage,
          }).referenceImages;

          return {
            plan: {
              intent: "unknown",
              strategyId: "direct-prompt",
              userGoal: taskUnit.goal || sourceElement.genPrompt || "",
              references: mergedExecutionReferences.map((url, index) => {
                const isInjectedAnchor =
                  consistencyAnchorInjected &&
                  (manualReferenceImages.length === 0 || manualReferenceImages[index] !== url);
                return {
                  id: `direct-ref-${index + 1}`,
                  url,
                  role:
                    currentReferenceRoleMode === "poster-product"
                      ? "product"
                      : index === 0
                        ? "subject"
                        : "supporting",
                  weight: index === 0 ? 1 : 0.85,
                  source: isInjectedAnchor ? "consistency-anchor" : "manual",
                  notes: isInjectedAnchor
                    ? "Injected approved consistency anchor."
                    : "Direct generation reference.",
                };
              }),
              locks: {
                brandIdentity: false,
                subjectShape: false,
                packagingLayout: false,
                composition: false,
                textLayout: false,
                materialTexture: false,
              },
              allowedEdits: [],
              forbiddenEdits: [],
              qualityHint: imageQuality,
              plannerNotes: [
                "生图前视觉编排已关闭，当前直接使用原始关键词与参考图。",
              ],
              requestedReferenceRoleMode: currentReferenceRoleMode,
              effectiveReferenceRoleMode: currentReferenceRoleMode,
            },
            plannerMeta: {
              source: "rule",
            },
            execution: {
              basePrompt: taskUnit.prompt || sourceElement.genPrompt || "",
              composedPrompt: buildDirectStyleLibraryPrompt({
                userPrompt: taskUnit.prompt || sourceElement.genPrompt || "",
                styleLibrary: currentStyleLibrary,
              }),
              referenceImages: mergedExecutionReferences,
              referencePriority:
                mergedExecutionReferences.length > 1
                  ? "all"
                  : mergedExecutionReferences.length === 1
                    ? "first"
                    : undefined,
              referenceStrength:
                mergedExecutionReferences.length > 0 ? 0.85 : undefined,
              referenceRoleMode: currentReferenceRoleMode,
              promptLanguagePolicy,
              textPolicy,
              disableTransportRetries: Boolean(sourceElement.genInfiniteRetry),
              consistencyContext:
                currentConsistencyContext as PlannedImageGeneration["execution"]["consistencyContext"],
            },
          };
        };

        const runTaskPlanner = async () => {
          taskPlannerRunCount += 1;
          const taskPlannerRun = taskPlannerRunCount;
          taskPlannerStartedAt = Date.now();
          console.info("[workspace.imggen] task-planner.start", {
            requestId: traceRequestId,
            run: taskPlannerRun,
            elementId,
            sourceElementId: sourceElement.id,
            requestedImageCount,
            model,
            aspectRatio: currentAspectRatio,
            imageSize,
            imageQuality,
            manualReferenceCount: manualReferenceImages.length,
            repairedReferenceCount: manualReferenceImages.length,
            mergedReferenceCount: currentReferenceImages.length,
            requestedReferenceRoleMode: currentReferenceRoleMode,
            visualOrchestratorModel: plannerModelConfig,
          });
          return planVisualTaskWithModel(
            {
              prompt: sourceElement.genPrompt || "",
              manualReferenceImages,
              referenceImages: currentReferenceImages,
              selectedGenerationModel: String(model),
              requestedImageCount,
              currentAspectRatio,
              imageSize,
              imageQuality,
              requestedReferenceRoleMode: currentReferenceRoleMode,
              currentStyleLibrary,
              translatePromptToEnglish,
              enforceChineseTextInImage,
              requiredChineseCopy,
              consistencyContext: currentConsistencyContext,
            },
            plannerModelConfig,
            {
              requestId: traceRequestId,
              onThought: (event) => {
                planningLogStreamer.push({
                  phase: "planning",
                  title: event.title || "正在思考",
                  line: event.message,
                });
              },
              onQueueEvent: (event) => {
                if (event.phase === "waiting" && event.waitMs > 800) {
                  console.info("[workspace.imggen] task-planner.queue", {
                    requestId: traceRequestId,
                    run: taskPlannerRun,
                    elementId,
                    sourceElementId: sourceElement.id,
                    queueKey: event.queueKey,
                    waitMs: event.waitMs,
                    status: "queued",
                  });
                }
              },
            },
          );
        };

        if (!shouldBypassPlanning && !cachedPlanningPayload && planningInflightKey) {
          if (activePlanningPayloadRef.current.has(planningInflightKey)) {
            planningLogStreamer.push({
              phase: "planning",
              title: "等待复用首个视觉编排",
              lines: ["相同关键词与参考图的视觉编排正在执行，等待首个结果写入缓存。"],
            });
            const inflightPlanningPayload = await waitForReusablePlanningPayload();
            if (inflightPlanningPayload) {
              cachedPlanningPayload = inflightPlanningPayload;
            }
          }
          if (
            !cachedPlanningPayload &&
            !activePlanningPayloadRef.current.has(planningInflightKey)
          ) {
            let resolvePlanningPayload: (
              payload: VisualPlanningCachePayload | null,
            ) => void = () => {};
            let rejectPlanningPayload: (error: unknown) => void = () => {};
            const planningPromise = new Promise<VisualPlanningCachePayload | null>(
              (resolve, reject) => {
                resolvePlanningPayload = resolve;
                rejectPlanningPayload = reject;
              },
            );
            activePlanningPayloadRef.current.set(planningInflightKey, {
              promise: planningPromise,
              resolve: resolvePlanningPayload,
              reject: rejectPlanningPayload,
            });
            activePlanningKeysRef.current.add(planningInflightKey);
            ownsPlanningExecution = true;
          }
        }

        if (shouldBypassPlanning) {
          planningLogStreamer.push({
            phase: "planning",
            title: "已跳过视觉编排",
            lines: ["当前已关闭全局生图前编排，本次会直接按关键词和参考图生成。"],
          });
        } else if (cachedPlanningPayload) {
          currentReferenceImages = cachedPlanningPayload.referenceImages;
          currentConsistencyContext =
            cachedPlanningPayload.consistencyContext || currentConsistencyContext;
          currentReferenceRoleMode = cachedPlanningPayload.referenceRoleMode;
          currentBaseStyleLibrary =
            cachedPlanningPayload.styleLibrary || currentBaseStyleLibrary;
          currentStyleLibraryRuntimeOverlay = cloneStyleLibraryRuntimeOverlay(
            cachedPlanningPayload.styleLibraryRuntimeOverlay,
          );
          currentStyleLibrary = buildEffectiveStyleLibrary({
            baseLibrary: currentBaseStyleLibrary,
            runtimeOverlay: currentStyleLibraryRuntimeOverlay,
          });
          currentStyleReferenceImage = pickPrimaryStyleReferenceImage(
            currentStyleLibrary,
            requestStartedAt,
          );
          currentReferenceImages = mergeStyleReferenceIntoExecutionRefs({
            referenceImages: currentReferenceImages,
            styleLibrary: currentStyleLibrary,
            styleReferenceImage: currentStyleReferenceImage,
          }).referenceImages;
          planningLogStreamer.push({
            phase: "planning",
            title: "沿用上次视觉编排",
            lines: [
              "当前关键词、参考图和生成参数未变化，直接沿用最近一次视觉编排结果。",
            ],
          });
        }

        let plannedTask = shouldBypassPlanning
          ? buildDirectTask()
          : cachedPlanningPayload
            ? {
                taskPlan: cachedPlanningPayload.taskPlan,
                units: cachedPlanningPayload.taskUnits,
              }
            : await runTaskPlanner();
        await planningLogStreamer.flush();
        let taskPlan = plannedTask.taskPlan;
        let repairedTaskUnits = repairPlannedTaskUnits({
          taskMode: taskPlan.mode,
          taskUnits: plannedTask.units,
          fallbackPrompt: sourceElement.genPrompt,
          fallbackAspectRatio: currentAspectRatio,
        });
        let taskUnits = repairedTaskUnits.taskUnits;
        if (taskPlan.styleLibrary) {
          if (currentBaseStyleLibrary) {
            currentStyleLibraryRuntimeOverlay = buildStyleLibraryRuntimeOverlay(
              taskPlan.styleLibrary,
            );
            currentStyleLibrary = buildEffectiveStyleLibrary({
              baseLibrary: currentBaseStyleLibrary,
              runtimeOverlay: currentStyleLibraryRuntimeOverlay,
            });
            persistSourceStyleLibraryRuntimeOverlay(currentStyleLibraryRuntimeOverlay);
          } else {
            currentBaseStyleLibrary = taskPlan.styleLibrary;
            currentStyleLibraryRuntimeOverlay = undefined;
            currentStyleLibrary = taskPlan.styleLibrary;
          }
          currentStyleReferenceImage = pickPrimaryStyleReferenceImage(
            currentStyleLibrary,
            requestStartedAt,
          );
          taskPlan = {
            ...taskPlan,
            styleLibrary: currentStyleLibrary,
          };
          currentReferenceImages = mergeStyleReferenceIntoExecutionRefs({
            referenceImages: currentReferenceImages,
            styleLibrary: currentStyleLibrary,
            styleReferenceImage: currentStyleReferenceImage,
          }).referenceImages;
        }

        const researchDecision = taskPlan.planningBrief?.researchDecision;
        if (!cachedPlanningPayload && researchDecision?.shouldResearch) {
          const researchMode = toWorkspaceResearchMode(researchDecision.mode);
          const researchQuery = buildResearchQuery({
            prompt: sourceElement.genPrompt,
            searchQueries: researchDecision.searchQueries,
            topics: researchDecision.topics,
          });

          if (researchMode === "off") {
            throw new Error(
              "Visual task planner requested research, but returned an invalid research mode.",
            );
          }

          planningLogStreamer.push({
            phase: "planning",
            title: "正在执行预研",
            lines: buildResearchKickoffLines({
              decision: researchDecision,
              researchQuery,
            }),
          });

          const researchContext = await executeWorkspaceResearchContext(
            researchQuery,
            researchMode,
          );
          const researchSummary = buildResearchSummary({
            query: researchQuery,
            mode: researchMode,
            webPages: researchContext.researchWebPages,
            referenceImageUrls: researchContext.researchReferenceImageUrls,
          });

          currentReferenceImages = mergeResearchReferenceImages({
            baseReferenceImages: currentReferenceImages,
            researchReferenceImages: researchContext.researchReferenceImageUrls,
          });
          currentConsistencyContext = {
            ...currentConsistencyContext,
            referenceSummary: [
              currentConsistencyContext.referenceSummary,
              researchSummary,
            ]
              .filter(Boolean)
              .join("\n\n"),
          };

          appendWorkspaceGenerationTraceDiagnostics(
            traceRequestId,
            toTraceDiagnostics(traceRequestId, [
              {
                code: "research_completed",
                source: "task-planner",
                severity: "info",
                message: `Executed ${researchMode} research before generation planning.`,
                repaired: true,
                repairSummary:
                  "Injected research summary and curated research references back into the orchestration chain.",
                detail: researchQuery,
              },
            ]),
          );

          addMessage({
            id: `gen-research-${traceRequestId}`,
            role: "model",
            text: `已完成预研，正在用研究结果重排任务。\n${researchSummary}`,
            timestamp: Date.now(),
          });

          planningLogStreamer.push({
            phase: "planning",
            title: "预研完成，正在重排任务",
            lines: buildResearchCompletedLines({
              webCount: researchContext.researchWebPages.length,
              imageCount: researchContext.researchReferenceImageUrls.length,
              mergedReferenceCount: currentReferenceImages.length,
            }),
          });

          plannedTask = await runTaskPlanner();
          await planningLogStreamer.flush();
          taskPlan = plannedTask.taskPlan;
          if (taskPlan.styleLibrary) {
            if (currentBaseStyleLibrary) {
              currentStyleLibraryRuntimeOverlay = buildStyleLibraryRuntimeOverlay(
                taskPlan.styleLibrary,
              );
              currentStyleLibrary = buildEffectiveStyleLibrary({
                baseLibrary: currentBaseStyleLibrary,
                runtimeOverlay: currentStyleLibraryRuntimeOverlay,
              });
              persistSourceStyleLibraryRuntimeOverlay(
                currentStyleLibraryRuntimeOverlay,
              );
            } else {
              currentBaseStyleLibrary = taskPlan.styleLibrary;
              currentStyleLibraryRuntimeOverlay = undefined;
              currentStyleLibrary = taskPlan.styleLibrary;
            }
            currentStyleReferenceImage = pickPrimaryStyleReferenceImage(
              currentStyleLibrary,
              requestStartedAt,
            );
            taskPlan = {
              ...taskPlan,
              styleLibrary: currentStyleLibrary,
            };
            currentReferenceImages = mergeStyleReferenceIntoExecutionRefs({
              referenceImages: currentReferenceImages,
              styleLibrary: currentStyleLibrary,
              styleReferenceImage: currentStyleReferenceImage,
            }).referenceImages;
          }
          if (taskPlan.planningBrief?.researchDecision?.shouldResearch) {
            taskPlan = {
              ...taskPlan,
              planningBrief: {
                ...taskPlan.planningBrief,
                researchDecision: {
                  shouldResearch: false,
                  mode: "none",
                  reason: "本轮预研已完成，当前将按研究结果继续视觉编排。",
                  topics: [],
                  searchQueries: [],
                },
              },
            };
          }
          repairedTaskUnits = repairPlannedTaskUnits({
            taskMode: taskPlan.mode,
            taskUnits: plannedTask.units,
            fallbackPrompt: sourceElement.genPrompt,
            fallbackAspectRatio: currentAspectRatio,
          });
          taskUnits = repairedTaskUnits.taskUnits;
        }

        const isSetTask = taskPlan.mode === "set" && taskUnits.length > 1;
        const imageCount = isSetTask ? taskUnits.length : requestedImageCount;
        const normalizedTaskPages = taskUnits.map((unit, index) => ({
          id: unit.id,
          title: unit.title,
          goal: unit.goal,
          pageRole:
            taskPlan.pages?.[index]?.pageRole || unit.pageRole || "custom",
          aspectRatio: unit.aspectRatio,
        }));

        if (isTreePromptNode && imageCount > targetElementIds.length) {
          const extraTargetElementIds = createGeneratingTreeImageChildren(
            elementId,
            imageCount - targetElementIds.length,
          );
          targetElementIds = [...targetElementIds, ...extraTargetElementIds];
        }

        if (shouldBypassPlanning) {
          console.info("[workspace.imggen] task-planner.skipped", {
            requestId: traceRequestId,
            elementId,
            sourceElementId: sourceElement.id,
            taskMode: taskPlan.mode,
            taskIntent: taskPlan.intent,
            reason: planningBypassReason || "pre-generation-planning-disabled",
            taskPageCount: taskUnits.length,
            taskToolChain: taskPlan.toolChain,
          });
        } else if (cachedPlanningPayload) {
          console.info("[workspace.imggen] task-planner.reused", {
            requestId: traceRequestId,
            run: "cache",
            elementId,
            sourceElementId: sourceElement.id,
            taskMode: taskPlan.mode,
            taskIntent: taskPlan.intent,
            taskPageCount: taskUnits.length,
            taskToolChain: taskPlan.toolChain,
            taskRoleOverlaySummary: taskPlan.roleOverlay?.summary || null,
            taskRoleOverlayRoles:
              taskPlan.roleOverlay?.roles.map((item) => item.role) || [],
          });
        } else {
          console.info("[workspace.imggen] task-planner.success", {
            requestId: traceRequestId,
            run: taskPlannerRunCount,
            elementId,
            sourceElementId: sourceElement.id,
            elapsedMs: Date.now() - taskPlannerStartedAt,
            taskMode: taskPlan.mode,
            taskIntent: taskPlan.intent,
            plannerSource:
              taskPlan.toolChain?.[0] === "rule-planner" ? "rule-fallback" : "model",
            taskPageCount: taskUnits.length,
            taskToolChain: taskPlan.toolChain,
            taskRoleOverlaySummary: taskPlan.roleOverlay?.summary || null,
            taskRoleOverlayRoles:
              taskPlan.roleOverlay?.roles.map((item) => item.role) || [],
          });
        }

        if (repairedTaskUnits.notes.length > 0) {
          appendWorkspaceGenerationTraceDiagnostics(
            traceRequestId,
            toTraceDiagnostics(traceRequestId, repairedTaskUnits.notes),
          );
          const visibleRepairLines = buildReferenceRepairLogLines(
            repairedTaskUnits.notes,
          );
          if (visibleRepairLines.length > 0) {
            appendElementsGenerationLog(
            isTreePromptNode && targetElementIds.length > 0
              ? targetElementIds
              : [elementId],
            {
              phase: "planning",
              title: "正在整理任务结构",
              lines: visibleRepairLines,
            },
          );
          }
        }

        appendElementsGenerationLog(
          isTreePromptNode && targetElementIds.length > 0
            ? targetElementIds
            : [elementId],
          {
            phase: "planning",
            title: "正在整理任务结构",
            lines: buildTaskThoughtLogLines({
              taskPlan,
              taskUnits,
              selectedGenerationModel: String(model),
            }),
          },
        );

        patchWorkspaceGenerationTrace(traceRequestId, {
          updatedAt: Date.now(),
          targetElementIds,
          imageCount,
          taskMode: taskPlan.mode,
          taskIntent: taskPlan.intent,
          taskReasoningSummary: taskPlan.reasoningSummary,
          taskToolChain: taskPlan.toolChain,
          taskPlanningBrief: taskPlan.planningBrief || null,
          taskRoleOverlay: taskPlan.roleOverlay
            ? {
                summary: taskPlan.roleOverlay.summary,
                mindset: taskPlan.roleOverlay.mindset,
                roles: taskPlan.roleOverlay.roles.map((item) => item.role),
                executionDirectives: taskPlan.roleOverlay.executionDirectives,
              }
            : null,
          taskPages: normalizedTaskPages,
        });

        plannerStartedAt = Date.now();
        appendElementsGenerationLog(
          isTreePromptNode && targetElementIds.length > 0
            ? targetElementIds
            : [elementId],
          {
            phase: "planning",
            title: "正在编排执行方案",
            lines: [
              `开始组合参考图分工与提示词策略`,
              taskPlan.toolChain?.length > 0
                ? `执行链：${clipLiveLogText(taskPlan.toolChain.join(" -> "), 96)}`
                : "执行链：classify -> plan -> compose -> generate",
            ],
          },
        );
        const primaryTaskUnit =
          taskUnits[0] || {
            id: "single-1",
            title: "单图",
            goal: sourceElement.genPrompt,
            aspectRatio: currentAspectRatio,
            prompt: sourceElement.genPrompt,
            pageIndex: 0,
            totalPages: 1,
          };
        if (!shouldBypassPlanning && !cachedPlanningPayload && !isSetTask && imageCount === 1) {
          if (!isTreePromptNode) {
            targetElementIds = [elementId];
          }
          const singleTargetElementId = targetElementIds[0] || elementId;
          let runtimeGenerationContext: Record<string, unknown> | null = null;
          let runtimeVariantStartedAt = 0;

          const runtimeResult = await runVisualAgentLoop({
            sessionId: traceRequestId,
            prompt: sourceElement.genPrompt,
            manualReferenceImages,
            referenceImages: currentReferenceImages,
            selectedGenerationModel: String(model),
            currentAspectRatio,
            imageSize,
            imageQuality,
            requestedReferenceRoleMode: currentReferenceRoleMode,
            translatePromptToEnglish,
            enforceChineseTextInImage,
            requiredChineseCopy,
            consistencyContext: currentConsistencyContext,
            taskPlan,
            taskUnit: primaryTaskUnit,
            modelConfig: plannerModelConfig,
            onRuntimeEvent: (event) => {
              const plannedGeneration = event.session.plannedGeneration;
              if (
                event.stage === "generation_plan" &&
                event.kind === "completed" &&
                plannedGeneration
              ) {
                const {
                  plan,
                  plannerMeta,
                  execution: {
                    basePrompt,
                    composedPrompt,
                    referenceImages: plannedReferenceImages,
                    referencePriority,
                    referenceStrength,
                    referenceRoleMode,
                  },
                } = plannedGeneration;

                patchWorkspaceGenerationTrace(traceRequestId, {
                  updatedAt: Date.now(),
                  status: "generating",
                  targetElementIds: [singleTargetElementId],
                  composedPrompt,
                  composedPromptPreview:
                    composedPrompt.length > 320
                      ? `${composedPrompt.slice(0, 320)}...`
                      : composedPrompt,
                  basePrompt,
                  planIntent: plan.intent,
                  planStrategy: plan.strategyId,
                  plannerSource: plannerMeta?.source || "model",
                  plannerNotes: plan.plannerNotes || [],
                  referenceRoleMode,
                  manualReferenceCount: manualReferenceImages.length,
                  referenceCount: plannedReferenceImages.length,
                  model: String(model),
                  aspectRatio: currentAspectRatio,
                  imageSize,
                  imageQuality,
                  imageCount: 1,
                  taskPlanningBrief: taskPlan.planningBrief || null,
                  taskRoleOverlay: taskPlan.roleOverlay
                    ? {
                        summary: taskPlan.roleOverlay.summary,
                        mindset: taskPlan.roleOverlay.mindset,
                        roles: taskPlan.roleOverlay.roles.map((item) => item.role),
                        executionDirectives:
                          taskPlan.roleOverlay.executionDirectives,
                      }
                    : null,
                });

                const runtimePlanSummaryLines = buildExecutionPlanSummaryLines({
                  taskPlan,
                  plan,
                  referenceRoleMode,
                  isSetTask: false,
                  taskUnits: [primaryTaskUnit],
                  primaryTaskUnit,
                });

                appendElementsGenerationLog([singleTargetElementId], {
                  phase: "generating",
                  title: "执行方案已确定",
                  lines: runtimePlanSummaryLines,
                });

                const runtimePlanningPayload = {
                  cacheKey: planningCacheKey,
                  createdAt: Date.now(),
                  taskPlan,
                  taskUnits,
                  referenceImages: currentReferenceImages,
                  consistencyContext: currentConsistencyContext,
                  referenceRoleMode: currentReferenceRoleMode,
                  styleLibrary: currentBaseStyleLibrary,
                  styleLibraryRuntimeOverlay: currentStyleLibraryRuntimeOverlay,
                  pageGenerationPlans: [plannedGeneration],
                } satisfies VisualPlanningCachePayload;
                updateElementById(sourceElement.id, {
                  genVisualPlanningCacheKey: planningCacheKey,
                  genVisualPlanningCachePayload: JSON.stringify(runtimePlanningPayload),
                  genVisualPlanningCacheCreatedAt: Date.now(),
                });
                resolvePlanningPayloadSession(runtimePlanningPayload);

                runtimeGenerationContext = {
                  requestId: traceRequestId,
                  elementId,
                  sourceElementId: sourceElement.id,
                  imageCount: 1,
                  taskMode: taskPlan.mode,
                  taskIntent: taskPlan.intent,
                  taskPageCount: 1,
                  taskRoleOverlaySummary: taskPlan.roleOverlay?.summary || null,
                  taskRoleOverlayRoles:
                    taskPlan.roleOverlay?.roles.map((item) => item.role) || [],
                  model,
                  aspectRatio: currentAspectRatio,
                  imageSize,
                  imageQuality,
                  manualReferenceCount: manualReferenceImages.length,
                  referenceCount: plannedReferenceImages.length,
                  referenceRoleMode,
                  referencePriority: referencePriority || null,
                  referenceStrength: referenceStrength ?? null,
                  consistencyAnchorInjected,
                  planIntent: plan.intent,
                  planStrategy: plan.strategyId,
                  plannerSource: plannerMeta?.source || "rule",
                  composedPromptPreview:
                    composedPrompt.length > 320
                      ? `${composedPrompt.slice(0, 320)}...`
                      : composedPrompt,
                  visualOrchestratorModel: visualOrchestratorModel
                    ? {
                        modelId: visualOrchestratorModel.modelId,
                        providerId:
                          visualOrchestratorModel.providerId || null,
                        label: visualOrchestratorModel.displayLabel,
                      }
                    : null,
                  planReferenceRoles: plan.references.map((item) => ({
                    role: item.role,
                    source: item.source,
                    weight: item.weight,
                  })),
                  planLocks: plan.locks,
                  plannerNotes: plan.plannerNotes,
                  taskToolChain: taskPlan.toolChain,
                  taskPlanningBrief: taskPlan.planningBrief || null,
                  taskRoleOverlay: taskPlan.roleOverlay || null,
                  manualReferenceKinds: manualReferenceImages.map((item) =>
                    String(item || "").startsWith("data:") ? "data" : "url",
                  ),
                  finalReferenceKinds: plannedReferenceImages.map((item) =>
                    String(item || "").startsWith("data:") ? "data" : "url",
                  ),
                };
              }

              if (event.stage === "generate" && event.kind === "started") {
                const plannedGenerationForStart = event.session.plannedGeneration;
                if (!plannedGenerationForStart) return;
                const runtimePlanSummaryLines = buildExecutionPlanSummaryLines({
                  taskPlan,
                  plan: plannedGenerationForStart.plan,
                  referenceRoleMode:
                    plannedGenerationForStart.execution.referenceRoleMode,
                  isSetTask: false,
                  taskUnits: [primaryTaskUnit],
                  primaryTaskUnit,
                });
                setElementGeneratingState(singleTargetElementId, true);
                appendElementsGenerationLog([singleTargetElementId], {
                  phase: "generating",
                  title: "正在执行当前生图",
                  lines: buildGeneratingStatusLines({
                    imageCount: 1,
                    variantLabel: "1/1",
                    model: String(model),
                    aspectRatio: currentAspectRatio,
                    imageSize,
                    imageQuality,
                    referenceCount:
                      plannedGenerationForStart.execution.referenceImages.length,
                    planLines: runtimePlanSummaryLines,
                  }),
                });
              }
            },
            generateImage: async ({ plannedGeneration, taskUnit }) => {
              const {
                execution: {
                  composedPrompt,
                  referenceImages: plannedReferenceImages,
                  referencePriority,
                  referenceStrength,
                  referenceRoleMode,
                  promptLanguagePolicy,
                  textPolicy,
                  consistencyContext,
                  disableTransportRetries,
                },
              } = plannedGeneration;

              runtimeVariantStartedAt = Date.now();
              updateWorkspaceGenerationVariantTrace({
                requestId: traceRequestId,
                variantLabel: "1/1",
                targetElementId: singleTargetElementId,
                attempt: 1,
                status: "generating",
                updatedAt: Date.now(),
              });
              patchWorkspaceGenerationTrace(traceRequestId, {
                updatedAt: Date.now(),
                status: "generating",
                targetElementIds: [singleTargetElementId],
              });
              console.info("[workspace.imggen] variant.start", {
                ...(runtimeGenerationContext || {
                  requestId: traceRequestId,
                  elementId,
                  sourceElementId: sourceElement.id,
                  imageCount: 1,
                  model,
                  aspectRatio: currentAspectRatio,
                  imageSize,
                  imageQuality,
                }),
                variant: "1/1",
                attempt: 1,
                targetElementId: singleTargetElementId,
                taskUnitId: taskUnit.id,
                taskUnitTitle: taskUnit.title,
                promptPreview:
                  composedPrompt.length > 220
                    ? `${composedPrompt.slice(0, 220)}...`
                    : composedPrompt,
                referenceCount: plannedReferenceImages.length,
              });

              try {
                const resultUrl = await imageGenSkill({
                  prompt: composedPrompt,
                  model,
                  providerId: sourceElement.genProviderId,
                  aspectRatio: currentAspectRatio,
                  imageSize: resolvedImageSizePreset,
                  exactSize,
                  imageQuality,
                  disableTransportRetries,
                  referenceImages: plannedReferenceImages,
                  referencePriority,
                  referenceStrength,
                  referenceRoleMode,
                  promptLanguagePolicy,
                  textPolicy,
                  consistencyContext,
                });
                if (!resultUrl) {
                  throw new Error("No result returned");
                }

                const consistencyAnchor =
                  plannedReferenceImages.length > 0
                    ? plannedReferenceImages[0]
                    : undefined;
                return retryWithConsistencyFix(
                  "Canvas image result 1/1",
                  resultUrl,
                  (fixPrompt?: string) =>
                    imageGenSkill({
                      prompt: fixPrompt
                        ? `${composedPrompt}\n\nConsistency fix: ${fixPrompt}`
                        : composedPrompt,
                      model,
                      providerId: sourceElement.genProviderId,
                      aspectRatio: currentAspectRatio,
                      imageSize: resolvedImageSizePreset,
                      exactSize,
                      imageQuality,
                      disableTransportRetries,
                      referenceImages: plannedReferenceImages,
                      referencePriority,
                      referenceStrength,
                      referenceRoleMode,
                      promptLanguagePolicy,
                      textPolicy,
                      consistencyContext,
                    }),
                  consistencyAnchor,
                  composedPrompt,
                  plannedReferenceImages.length,
                );
              } catch (error) {
                const reason = formatGenerationError(error);
                console.error("[workspace.imggen] variant.failed", {
                  ...(runtimeGenerationContext || {}),
                  variant: "1/1",
                  taskUnitId: taskUnit.id,
                  taskUnitTitle: taskUnit.title,
                  attempt: 1,
                  elapsedMs: Date.now() - runtimeVariantStartedAt,
                  error: reason,
                  targetElementId: singleTargetElementId,
                });
                updateWorkspaceGenerationVariantTrace({
                  requestId: traceRequestId,
                  variantLabel: "1/1",
                  targetElementId: singleTargetElementId,
                  attempt: 1,
                  status: "failed",
                  updatedAt: Date.now(),
                  error: reason,
                  elapsedMs: Date.now() - runtimeVariantStartedAt,
                });
                patchWorkspaceGenerationTrace(traceRequestId, {
                  updatedAt: Date.now(),
                  lastError: reason,
                });
                throw error;
              }
            },
          });

          if (runtimeResult.status !== "completed") {
            throw new Error(
              runtimeResult.status === "failed"
                ? runtimeResult.error
                : `Visual runtime handed off unexpectedly: ${runtimeResult.reason}`,
            );
          }

          await applyGeneratedImageToElement(
            singleTargetElementId,
            runtimeResult.resultUrl,
            true,
          );
          console.info("[workspace.imggen] request.complete", {
            ...(runtimeGenerationContext || {}),
            successCount: 1,
            failedCount: 0,
            elapsedMs: Date.now() - requestStartedAt,
          });
          updateWorkspaceGenerationVariantTrace({
            requestId: traceRequestId,
            variantLabel: "1/1",
            targetElementId: singleTargetElementId,
            attempt: 1,
            status: "succeeded",
            updatedAt: Date.now(),
            elapsedMs: Date.now() - runtimeVariantStartedAt,
          });
          patchWorkspaceGenerationTrace(traceRequestId, {
            updatedAt: Date.now(),
            completedAt: Date.now(),
            status: "completed",
            targetElementIds: [singleTargetElementId],
            lastError: null,
          });
          setElementGeneratingState(singleTargetElementId, false);
          if (shouldTrackSourceElementState) {
            setElementGeneratingState(elementId, false);
          }
          return traceRequestId;
        }
        const pageGenerationPlans = shouldBypassPlanning
          ? [buildDirectPageGenerationPlan(primaryTaskUnit)]
          : cachedPlanningPayload?.pageGenerationPlans &&
              cachedPlanningPayload.pageGenerationPlans.length >=
                (isSetTask ? taskUnits.length : 1)
            ? cachedPlanningPayload.pageGenerationPlans
            : await Promise.all(
                (isSetTask ? taskUnits : [primaryTaskUnit]).map((taskUnit) =>
                  planVisualGenerationWithModel(
                    {
                      prompt: isSetTask
                        ? taskUnit.prompt
                        : sourceElement.genPrompt || "",
                      manualReferenceImages,
                      referenceImages: mergeStyleReferenceIntoExecutionRefs({
                        referenceImages: currentReferenceImages,
                        styleLibrary: taskPlan.styleLibrary,
                      }).referenceImages,
                      selectedGenerationModel: String(model),
                      taskRoleOverlay: taskPlan.roleOverlay,
                      taskPlanningBrief: taskPlan.planningBrief,
                      styleLibrary: taskPlan.styleLibrary,
                      requestedReferenceRoleMode: currentReferenceRoleMode,
                      imageQuality,
                      translatePromptToEnglish,
                      enforceChineseTextInImage,
                      requiredChineseCopy,
                      disableTransportRetries: Boolean(sourceElement.genInfiniteRetry),
                      consistencyContext: currentConsistencyContext,
                    },
                    plannerModelConfig,
                  ),
                ),
              );
        if (!shouldBypassPlanning) {
          updateElementById(sourceElement.id, {
            genVisualPlanningCacheKey: planningCacheKey,
            genVisualPlanningCachePayload: JSON.stringify({
              cacheKey: planningCacheKey,
              createdAt: Date.now(),
              taskPlan,
              taskUnits,
              referenceImages: currentReferenceImages,
              consistencyContext: currentConsistencyContext,
              referenceRoleMode: currentReferenceRoleMode,
              styleLibrary: currentBaseStyleLibrary,
              styleLibraryRuntimeOverlay: currentStyleLibraryRuntimeOverlay,
              pageGenerationPlans,
            } satisfies VisualPlanningCachePayload),
            genVisualPlanningCacheCreatedAt: Date.now(),
          });
        }

        const plannedGeneration = pageGenerationPlans[0];
        const {
          plan,
          plannerMeta,
          execution: {
            basePrompt,
            composedPrompt,
            referenceImages: plannedReferenceImages,
            referencePriority,
            referenceStrength,
            referenceRoleMode,
            promptLanguagePolicy,
            textPolicy,
            disableTransportRetries,
            consistencyContext,
          },
        } = plannedGeneration;
        patchWorkspaceGenerationTrace(traceRequestId, {
          updatedAt: Date.now(),
          status: imageCount > 1 ? "planned" : "generating",
          targetElementIds,
          composedPrompt,
          composedPromptPreview:
            composedPrompt.length > 320
              ? `${composedPrompt.slice(0, 320)}...`
              : composedPrompt,
          basePrompt,
          planIntent: plan.intent,
          planStrategy: plan.strategyId,
          plannerSource: plannerMeta?.source || "model",
          plannerNotes: plan.plannerNotes || [],
          referenceRoleMode,
          manualReferenceCount: manualReferenceImages.length,
          referenceCount: plannedReferenceImages.length,
          model: String(model),
          aspectRatio: currentAspectRatio,
          imageSize,
          imageQuality,
          imageCount,
          taskPlanningBrief: taskPlan.planningBrief || null,
          taskRoleOverlay: taskPlan.roleOverlay
            ? {
                summary: taskPlan.roleOverlay.summary,
                mindset: taskPlan.roleOverlay.mindset,
                roles: taskPlan.roleOverlay.roles.map((item) => item.role),
                executionDirectives: taskPlan.roleOverlay.executionDirectives,
              }
            : null,
        });

        const generationContext = {
          requestId: traceRequestId,
          elementId,
          sourceElementId: sourceElement.id,
          imageCount,
          taskMode: taskPlan.mode,
          taskIntent: taskPlan.intent,
          taskPageCount: taskUnits.length,
          taskRoleOverlaySummary: taskPlan.roleOverlay?.summary || null,
          taskRoleOverlayRoles:
            taskPlan.roleOverlay?.roles.map((item) => item.role) || [],
          model,
          aspectRatio: currentAspectRatio,
          imageSize,
          imageQuality,
          manualReferenceCount: manualReferenceImages.length,
          referenceCount: plannedReferenceImages.length,
          referenceRoleMode,
          referencePriority: referencePriority || null,
          referenceStrength: referenceStrength ?? null,
          consistencyAnchorInjected,
          planIntent: plan.intent,
          planStrategy: plan.strategyId,
          plannerSource: plannerMeta?.source || "rule",
          composedPromptPreview:
            composedPrompt.length > 320
              ? `${composedPrompt.slice(0, 320)}...`
              : composedPrompt,
          visualOrchestratorModel: visualOrchestratorModel
            ? {
                modelId: visualOrchestratorModel.modelId,
                providerId: visualOrchestratorModel.providerId || null,
                label: visualOrchestratorModel.displayLabel,
              }
            : null,
          planReferenceRoles: plan.references.map((item) => ({
            role: item.role,
            source: item.source,
            weight: item.weight,
          })),
          planLocks: plan.locks,
          plannerNotes: plan.plannerNotes,
          taskToolChain: taskPlan.toolChain,
          taskPlanningBrief: taskPlan.planningBrief || null,
          taskRoleOverlay: taskPlan.roleOverlay || null,
          manualReferenceKinds: manualReferenceImages.map((item) =>
            String(item || "").startsWith("data:") ? "data" : "url",
          ),
          finalReferenceKinds: plannedReferenceImages.map((item) =>
            String(item || "").startsWith("data:") ? "data" : "url",
          ),
        };
        if (!isTreePromptNode) {
          targetElementIds =
            imageCount > 1
              ? [
                  elementId,
                  ...createGeneratingImagesNearElement(elementId, imageCount - 1),
                ]
              : [elementId];
        }

        patchWorkspaceGenerationTrace(traceRequestId, {
          updatedAt: Date.now(),
          status: imageCount > 1 ? "planned" : "generating",
          targetElementIds,
        });

        const planSummaryLines = buildExecutionPlanSummaryLines({
          taskPlan,
          plan,
          referenceRoleMode,
          isSetTask,
          taskUnits,
          primaryTaskUnit,
        });

        appendElementsGenerationLog(
          isTreePromptNode && targetElementIds.length > 0
            ? targetElementIds
            : [elementId],
          {
            phase: imageCount > 1 ? "planned" : "generating",
            title: "执行方案已确定",
            lines: planSummaryLines,
          },
        );

        if (imageCount > 1) {
          targetElementIds.slice(1).forEach((queuedElementId, queuedIndex) => {
            const variantOrder = queuedIndex + 2;
            const queuedTaskUnit = taskUnits[queuedIndex + 1] || primaryTaskUnit;
            const queuedVariantLabel = isSetTask
              ? buildTaskUnitLabel(queuedTaskUnit)
              : `${variantOrder}/${imageCount}`;
            setElementsGenerationStatus([queuedElementId], {
              phase: "queued",
              title: "等待前序执行",
              lines: [
                `已排队：${queuedVariantLabel}`,
                isSetTask
                  ? `页面目标：${clipLiveLogText(queuedTaskUnit.goal, 88)}`
                  : `等待当前批次完成后开始执行`,
              ],
            });
          });
        }

        const buildVariantPrompt = (index: number, fixPrompt?: string) => {
          const pageGeneration = pageGenerationPlans[index] || plannedGeneration;
          const pagePrompt = isSetTask
            ? pageGeneration.execution.composedPrompt
            : basePromptSource;
          const basePrompt = fixPrompt
            ? `${pagePrompt}\n\nConsistency fix: ${fixPrompt}`
            : pagePrompt;
          if (isSetTask || index === 0 || imageCount <= 1) {
            return basePrompt;
          }
          return `${basePrompt}\n\nVariation ${index + 1}/${imageCount}: keep the same subject and core prompt intent, but use a clearly different composition and framing.`;
        };
        const basePromptSource = composedPrompt;
        const getVariantAspectRatio = (index: number) =>
          taskUnits[index]?.aspectRatio || currentAspectRatio;

        const runGeneration = (index: number, fixPrompt?: string) => {
          const pageGeneration = pageGenerationPlans[index] || plannedGeneration;
          return imageGenSkill({
            prompt: buildVariantPrompt(index, fixPrompt),
            model,
            providerId: sourceElement.genProviderId,
            aspectRatio: getVariantAspectRatio(index),
            imageSize: resolvedImageSizePreset,
            exactSize,
            imageQuality,
            disableTransportRetries:
              pageGeneration.execution.disableTransportRetries,
            referenceImages: pageGeneration.execution.referenceImages,
            referencePriority: pageGeneration.execution.referencePriority,
            referenceStrength: pageGeneration.execution.referenceStrength,
            referenceRoleMode: pageGeneration.execution.referenceRoleMode,
            promptLanguagePolicy: pageGeneration.execution.promptLanguagePolicy,
            textPolicy: pageGeneration.execution.textPolicy,
            consistencyContext: pageGeneration.execution.consistencyContext,
          });
        };

        let successCount = 0;
        const failedResults: string[] = [];

        for (let index = 0; index < imageCount; index += 1) {
          const taskUnit = taskUnits[index] || primaryTaskUnit;
          const variantLabel = isSetTask
            ? buildTaskUnitLabel(taskUnit)
            : `${index + 1}/${imageCount}`;
          const targetElementId = targetElementIds[index] || elementId;
          let attempt = 0;
          let enteredInfiniteRetry = false;

          while (true) {
            attempt += 1;
            const variantStartedAt = Date.now();
            targetElementIds.slice(index + 1).forEach((queuedElementId, queuedOffset) => {
              const queuedOrder = index + queuedOffset + 2;
              const queuedTaskUnit =
                taskUnits[index + queuedOffset + 1] || primaryTaskUnit;
              const queuedVariantLabel = isSetTask
                ? buildTaskUnitLabel(queuedTaskUnit)
                : `${queuedOrder}/${imageCount}`;
              appendElementsGenerationLog([queuedElementId], {
                phase: "queued",
                title: "等待前序执行",
                lines: [
                  `当前排队：${queuedVariantLabel}`,
                  `前面正在处理：${variantLabel}`,
                ],
              });
            });
            appendElementsGenerationLog([targetElementId], {
              phase: enteredInfiniteRetry ? "retrying" : "generating",
              title:
                enteredInfiniteRetry
                  ? `正在自动重试 ${variantLabel}`
                  : imageCount > 1
                    ? `正在执行 ${variantLabel}`
                    : "正在执行当前生图",
              lines: [
                `开始执行：${variantLabel} | ${getVariantAspectRatio(index)}`,
                `调用模型：${model} · ${imageSize} · ${HUMAN_QUALITY_LABELS[imageQuality] || imageQuality}`,
                plannedReferenceImages.length > 0
                  ? `参考输入：${plannedReferenceImages.length} 张`
                  : "参考输入：0 张，仅按任务规划执行",
                isSetTask
                  ? `本页目标：${clipLiveLogText(taskUnit.goal, 88)}`
                  : `本次意图：${clipLiveLogText(primaryTaskUnit.goal, 88)}`,
              ],
            });
            updateWorkspaceGenerationVariantTrace({
              requestId: traceRequestId,
              variantLabel,
              targetElementId,
              attempt,
              status: enteredInfiniteRetry ? "retrying" : "generating",
              updatedAt: Date.now(),
            });
            patchWorkspaceGenerationTrace(traceRequestId, {
              updatedAt: Date.now(),
              status: enteredInfiniteRetry ? "retrying" : "generating",
            });
            console.info("[workspace.imggen] variant.start", {
              ...generationContext,
              variant: variantLabel,
              attempt,
              targetElementId,
              taskUnitId: taskUnit.id,
              taskUnitTitle: taskUnit.title,
              promptPreview: clipLiveLogText(buildVariantPrompt(index), 220),
              referenceCount:
                pageGenerationPlans[index]?.execution.referenceImages.length ??
                plannedReferenceImages.length,
            });

            if (attempt === 1 && imageCount > 1) {
              addMessage({
                id: `gen-progress-${Date.now()}-${index}`,
                role: "model",
                text: isSetTask
                  ? `正在生成页面 ${variantLabel}...`
                  : `Generating image ${variantLabel}...`,
                timestamp: Date.now(),
              });
            }

            try {
              const resultUrl = await runGeneration(index);
              if (!resultUrl) {
                throw new Error("No result returned");
              }

              const consistencyAnchor =
                plannedReferenceImages.length > 0
                  ? plannedReferenceImages[0]
                  : undefined;
              const finalUrl =
                index === 0
                  ? await retryWithConsistencyFix(
                      `Canvas image result ${variantLabel}`,
                      resultUrl,
                      (fixPrompt?: string) => runGeneration(index, fixPrompt),
                      consistencyAnchor,
                      basePromptSource,
                      plannedReferenceImages.length,
                    )
                  : resultUrl;

              await applyGeneratedImageToElement(targetElementId, finalUrl, true);
              successCount += 1;
              updateWorkspaceGenerationVariantTrace({
                requestId: traceRequestId,
                variantLabel,
                targetElementId,
                attempt,
                status: "succeeded",
                updatedAt: Date.now(),
                elapsedMs: Date.now() - variantStartedAt,
              });
              break;
            } catch (error) {
              const reason = formatGenerationError(error);
              const liveTarget = elementsRef.current.find(
                (element) => element.id === targetElementId,
              );
              const liveSource = elementsRef.current.find(
                (element) => element.id === sourceElement.id,
              );
              const shouldInfiniteRetry =
                Boolean(liveSource?.genInfiniteRetry) &&
                Boolean(liveTarget);

              if (shouldInfiniteRetry) {
                if (!enteredInfiniteRetry) {
                  enteredInfiniteRetry = true;
                  addMessage({
                    id: `gen-autoretry-${Date.now()}-${targetElementId}`,
                    role: "model",
                    text:
                      imageCount > 1
                        ? `Image ${variantLabel} failed once and will now start berserk polling retries on the same node until it succeeds or the page is refreshed.`
                        : "Image generation failed once and will now start berserk polling retries on the same node until it succeeds or the page is refreshed.",
                    timestamp: Date.now(),
                  });
                }

                setElementGeneratingState(targetElementId, true);
                appendElementsGenerationLog([targetElementId], {
                  phase: "retrying",
                  title: imageCount > 1 ? `正在自动重试 ${variantLabel}` : "正在自动重试当前节点",
                  lines: [
                    imageCount > 1 ? `刚刚失败：${variantLabel}` : "刚刚失败：当前节点",
                    `失败原因：${clipLiveLogText(reason, 96)}`,
                    "处理方式：留在当前节点继续轮询重试",
                    "不会新建图片节点，直到成功或页面刷新",
                  ],
                });
                if (attempt === 1) {
                  console.warn("[workspace.imggen] variant.berserk-retrying", {
                    ...generationContext,
                    variant: variantLabel,
                    attempt,
                    retryDelayMs: 0,
                    disableTransportRetries: true,
                    error: reason,
                    targetElementId,
                  });
                }
                updateWorkspaceGenerationVariantTrace({
                  requestId: traceRequestId,
                  variantLabel,
                  targetElementId,
                  attempt,
                  status: "retrying",
                  updatedAt: Date.now(),
                  error: reason,
                });
                patchWorkspaceGenerationTrace(traceRequestId, {
                  updatedAt: Date.now(),
                  status: "retrying",
                  lastError: reason,
                });
                await Promise.resolve();
                continue;
              }

              failedResults.push(
                isSetTask ? `${variantLabel}: ${reason}` : `Image ${index + 1}: ${reason}`,
              );
              setElementsGenerationStatus([targetElementId], null);
              setElementGeneratingState(targetElementId, false, reason);
              console.error("[workspace.imggen] variant.failed", {
                ...generationContext,
                variant: variantLabel,
                taskUnitId: taskUnit.id,
                taskUnitTitle: taskUnit.title,
                attempt,
                elapsedMs: Date.now() - variantStartedAt,
                error: reason,
                targetElementId,
              });
              updateWorkspaceGenerationVariantTrace({
                requestId: traceRequestId,
                variantLabel,
                targetElementId,
                attempt,
                status: "failed",
                updatedAt: Date.now(),
                error: reason,
                elapsedMs: Date.now() - variantStartedAt,
              });
              patchWorkspaceGenerationTrace(traceRequestId, {
                updatedAt: Date.now(),
                lastError: reason,
              });
              break;
            }
          }
        }

        if (successCount === 0) {
          patchWorkspaceGenerationTrace(traceRequestId, {
            updatedAt: Date.now(),
            completedAt: Date.now(),
            status: "failed",
            lastError:
              failedResults.length > 0 ? failedResults[0] : "No result returned",
          });
          if (shouldTrackSourceElementState) {
            setElementGeneratingState(elementId, false);
          }
          addMessage({
            id: Date.now().toString(),
            role: "model",
            text:
              failedResults.length > 0
                ? isSetTask
                  ? `整套任务生成失败，共 ${imageCount} 页。${failedResults[0]}`
                  : `Image generation failed for all ${imageCount} images. ${failedResults[0]}`
                : "Image generation returned no result. Please try again.",
            timestamp: Date.now(),
          });
          return;
        }

        if (shouldTrackSourceElementState) {
          setElementGeneratingState(elementId, false);
        }

        console.info("[workspace.imggen] request.complete", {
          ...generationContext,
          successCount,
          failedCount: failedResults.length,
          elapsedMs: Date.now() - requestStartedAt,
        });
        patchWorkspaceGenerationTrace(traceRequestId, {
          updatedAt: Date.now(),
          completedAt: Date.now(),
          status: failedResults.length > 0 ? "completed" : "completed",
          lastError: failedResults.length > 0 ? failedResults[0] : null,
        });

        if (failedResults.length > 0) {
          addMessage({
            id: `gen-summary-${Date.now()}`,
            role: "model",
            text: isSetTask
              ? `整套任务已完成 ${successCount}/${imageCount} 页，失败 ${failedResults.length} 页。`
              : `Generated ${successCount}/${imageCount} images. ${failedResults.length} failed.`,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        rejectPlanningPayloadSession(error);
        const reason = formatGenerationError(error);
        if (taskPlannerStartedAt > 0 && plannerStartedAt === 0) {
          console.error("[workspace.imggen] task-planner.failed", {
            requestId: traceRequestId,
            run: taskPlannerRunCount,
            elementId,
            elapsedMs: Date.now() - taskPlannerStartedAt,
            error: reason,
          });
        }
        if (plannerStartedAt > 0) {
          console.error("[workspace.imggen] planner.failed", {
            requestId: traceRequestId,
            elementId,
            elapsedMs: Date.now() - plannerStartedAt,
            error: reason,
          });
        }
        console.error("[workspace.imggen] request.failed", {
          requestId: traceRequestId,
          elementId,
          elapsedMs: Date.now() - requestStartedAt,
          error: reason,
        });
        patchWorkspaceGenerationTrace(traceRequestId, {
          updatedAt: Date.now(),
          completedAt: Date.now(),
          status: "failed",
          targetElementIds,
          lastError: reason,
        });
        if (targetElementIds.length > 0) {
          setElementsGenerationStatus(targetElementIds, null);
          targetElementIds.forEach((targetElementId) => {
            setElementGeneratingState(targetElementId, false, reason);
          });
        }
        if (shouldTrackSourceElementState) {
          setElementGeneratingState(elementId, false);
        }
        addMessage({
          id: Date.now().toString(),
          role: "model",
          text: `Image generation failed: ${reason}`,
          timestamp: Date.now(),
        });
      } finally {
        if (ownsPlanningExecution && planningInflightKey) {
          activePlanningKeysRef.current.delete(planningInflightKey);
          activePlanningPayloadRef.current.delete(planningInflightKey);
        }
        if (sourceRequestLockKey) {
          activeRequestsRef.current.delete(sourceRequestLockKey);
        }
        activeRequestsRef.current.delete(requestKey);
      }
      return traceRequestId;
    },
    [
      activeRequestsRef,
      addMessage,
      applyGeneratedImageToElement,
      elementsRef,
      enforceChineseTextInImage,
      getDesignConsistencyContext,
      getClosestAspectRatio,
      mergeConsistencyAnchorIntoReferences,
      nodeInteractionMode,
      requiredChineseCopy,
      retryWithConsistencyFix,
      createGeneratingImagesNearElement,
      createGeneratingTreeImageChildren,
      appendElementsGenerationLog,
      setElementsGenerationStatus,
      setElementGeneratingState,
      translatePromptToEnglish,
      updateElementById,
    ],
  );
}
