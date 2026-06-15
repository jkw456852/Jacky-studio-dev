import React from "react";
import { useNavigate } from "react-router-dom";
import { Type } from "@google/genai";
import styleDescriptionAiPrompt from "../agents/风格库风格描述ai.md?raw";
import {
  ArrowUpRight,
  FolderKanban,
  ImagePlus,
  Loader2,
  PencilLine,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import type { WorkspaceStyleLibrary } from "../types";
import type { StudioStyleLibraryCandidateAsset } from "../services/runtime-assets/user-asset-types";
import Sidebar from "../components/Sidebar";
import { ROUTES } from "../utils/routes";
import {
  listUserStyleLibraries,
} from "../services/vision-orchestrator/style-library";
import { getStudioUserAssetApi } from "../services/runtime-assets/api";
import {
  fetchGptImageInspiration,
  type GptImageInspirationCase,
  type GptImageInspirationCategory,
  type GptImageInspirationFacet,
  type GptImageInspirationPayload,
  type GptImageInspirationTemplate,
  type LocalizedText,
} from "../services/gpt-image-inspiration";
import type { SmartImportPreview } from "../services/gpt-image-smart-import";
import { generateJsonResponse, getBestModelSelection } from "../services/gemini";
import { normalizeReferenceToDataUrl } from "../services/image-reference-resolver";
import { generateImageWithProvider } from "../services/providers";
import {
  getMappedModelConfigs,
  getVisualOrchestratorModelConfig,
  type MappedModelConfig,
} from "../services/provider-settings";
import { uploadImage } from "../utils/uploader";

const shellCardClass =
  "rounded-[24px] border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]";
const inputClass =
  "h-11 w-full rounded-[12px] border border-slate-200 bg-white px-4 text-[14px] text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100";
const textareaClass =
  "min-h-[132px] w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-[14px] leading-6 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100";
const subtleButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[12px] bg-slate-950 px-4 text-[13px] font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";
const STYLE_CARD_ASPECT_RATIO_OPTIONS = ["1:1", "3:4", "4:3", "9:16", "16:9"] as const;
const STYLE_CARD_IMAGE_COUNT_OPTIONS = [1, 2, 3, 4] as const;

const STYLE_CARD_AI_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    summary: { type: Type.STRING },
    promptText: { type: Type.STRING },
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    description: { type: Type.STRING },
  },
  required: ["title", "summary", "promptText", "tags", "description"],
};

type NoticeState = {
  tone: "success" | "error";
  text: string;
};

type StyleCardScope = "user" | "candidate" | "builtIn";
type SelectableStyleCardScope = Extract<StyleCardScope, "user" | "candidate">;

type StyleCardItem = {
  scope: StyleCardScope;
  id: string;
  badge: string;
  subBadge?: string;
  library: WorkspaceStyleLibrary;
};

const isSelectableStyleCardScope = (
  scope: StyleCardScope,
): scope is SelectableStyleCardScope => scope === "user" || scope === "candidate";

const buildStyleCardSelectionKey = (
  scope: SelectableStyleCardScope,
  id: string,
) => `${scope}::${id}`;

type EditorMode = "create" | "edit" | "import";

type StyleEditorState = {
  scope: StyleCardScope | "gallery";
  mode: EditorMode;
  id?: string;
  title: string;
  coverImageUrl: string;
  sampleImageUrls: string[];
  promptText: string;
  tagsText: string;
  description: string;
  sourcePrompt: string;
  sourceLabel: string;
  sourcePreviewKey?: string;
  sourcePreviewType?: "case" | "template";
  baseLibrary: WorkspaceStyleLibrary | null;
};

type StyleSampleGeneratorState = {
  open: boolean;
  modelRaw: string;
  promptText: string;
  aspectRatio: (typeof STYLE_CARD_ASPECT_RATIO_OPTIONS)[number];
  count: (typeof STYLE_CARD_IMAGE_COUNT_OPTIONS)[number];
};

type BusyAction =
  | ""
  | "saving"
  | "uploading-set"
  | "prompt"
  | "description"
  | "gallery-import"
  | "generating-samples";

type GalleryPreviewCard = {
  key: string;
  type: "case" | "template";
  title: string;
  cover: string;
  description: string;
  prompt: string;
  chips: string[];
  preview: SmartImportPreview;
};

const readLocalizedText = (value: LocalizedText | undefined, fallback = "") => {
  const zh = String(value?.zh || "").trim();
  if (zh) return zh;
  const en = String(value?.en || "").trim();
  return en || fallback;
};

const readLocalizedLines = (
  value: LocalizedText | { zh: string[]; en: string[] } | undefined,
): string[] => {
  if (!value) return [];
  if (Array.isArray((value as { zh?: string[] }).zh)) {
    const zh = ((value as { zh?: string[] }).zh || []).map((item) => String(item || "").trim()).filter(Boolean);
    if (zh.length > 0) return zh;
    return ((value as { en?: string[] }).en || []).map((item) => String(item || "").trim()).filter(Boolean);
  }
  return [readLocalizedText(value as LocalizedText)].filter(Boolean);
};

const facetLabel = (
  value: string,
  items: Array<GptImageInspirationFacet | GptImageInspirationCategory>,
) => {
  const match = items.find((item) => item.value === value);
  return match ? readLocalizedText(match.title, value) : value;
};

const splitTextToLines = (value: string) =>
  String(value || "")
    .split(/[\n,，/、]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const dedupeStrings = (values: Array<string | undefined | null>, limit = 24) => {
  const result: string[] = [];
  const seen = new Set<string>();
  values.forEach((value) => {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result.slice(0, limit);
};

const dedupeUrls = (values: Array<string | undefined | null>) =>
  dedupeStrings(values, 12).filter((item) => /^blob:|^data:|^https?:\/\//i.test(item));

const summarizeText = (value: string, fallback: string) => {
  const normalized = String(value || "").trim();
  if (!normalized) return fallback;
  return normalized.slice(0, 84);
};

const getCardPreviewBackground = (index: number) => {
  const palette = [
    "linear-gradient(135deg, #dbeafe 0%, #f8fafc 100%)",
    "linear-gradient(135deg, #ede9fe 0%, #f8fafc 100%)",
    "linear-gradient(135deg, #e2e8f0 0%, #f8fafc 100%)",
    "linear-gradient(135deg, #d1fae5 0%, #f8fafc 100%)",
  ];
  return palette[index % palette.length];
};

const buildPromptBackbone = (promptText: string, tags: string[], description: string) => {
  const promptLines = String(promptText || "")
    .split(/[\n。！？!?]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
  const descriptionLines = String(description || "")
    .split(/[\n。！？!?]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2);
  return dedupeStrings(
    [
      promptText ? `优先沿用这段生图关键词骨架：${summarizeText(promptText, "")}` : "",
      tags.length > 0 ? `风格标签：${tags.slice(0, 6).join("、")}` : "",
      ...promptLines,
      ...descriptionLines,
    ],
    6,
  );
};

const buildReferenceInterpretation = (tags: string[]) => {
  const tagClause =
    tags.length > 0
      ? `优先继承 ${tags.slice(0, 6).join("、")} 这些风格标签对应的视觉线索，`
      : "优先继承上传图里的光线、色彩、材质和构图节奏，`";
  return `${tagClause.replace("`", "")}但不要直接复刻参考图里的具体人物、商品、品牌或一次性文案。后续生成时仍以用户当前主体与任务目标为准。`;
};

const buildPlanningDirectives = (tags: string[], promptText: string) =>
  dedupeStrings(
    [
      promptText ? `先锁定这张卡片的生图关键词骨架：${summarizeText(promptText, "")}` : "先锁定上传图的光线、色彩、材质和构图节奏。",
      tags.length > 0 ? `优先保住这些标签对应的视觉气质：${tags.slice(0, 8).join("、")}。` : "",
      "只复用风格语言，不继承参考图中的具体主体身份。",
      "如果用户提供新的主体或产品，应保留用户主体，只迁移风格气质与画面组织方式。",
    ],
    6,
  );

const buildPromptDirectives = (tags: string[], promptText: string, description: string) =>
  dedupeStrings(
    [
      promptText ? summarizeText(promptText, "") : "输出时延续当前卡片的风格气质和画面组织方式。",
      tags.length > 0 ? `输出时保持这些标签对应的视觉特征：${tags.slice(0, 8).join("、")}。` : "",
      summarizeText(description, "让画面延续当前风格卡片的光线、色彩、材质和构图节奏。"),
      "不要把参考图中的专有名词、品牌名、人名和一次性文案直接带入新任务。",
    ],
    6,
  );

const buildLibraryFromEditor = (editor: StyleEditorState): WorkspaceStyleLibrary => {
  const base = editor.baseLibrary || null;
  const promptText = String(editor.promptText || "").trim();
  const tags = splitTextToLines(editor.tagsText);
  const description = String(editor.description || "").trim();
  const title =
    String(editor.title || "").trim() ||
    (tags.length > 0 ? `${tags[0]} 风格卡片` : "未命名风格卡片");
  const referenceImageUrls = dedupeUrls([editor.coverImageUrl, ...editor.sampleImageUrls]);
  const summary = description
    ? summarizeText(description, "")
    : promptText
      ? summarizeText(promptText, "从参考图提炼的可复用风格卡片。")
      : tags.length > 0
        ? `围绕 ${tags.slice(0, 3).join(" / ")} 整理的可复用风格卡片。`
        : "从参考图提炼的可复用风格卡片。";

  return {
    ...base,
    title,
    summary,
    coverImageUrl: String(editor.coverImageUrl || "").trim() || undefined,
    kind: "style_library",
    referenceImageUrls: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
    keywords: tags.length > 0 ? tags : undefined,
    promptText: promptText || undefined,
    tags: tags.length > 0 ? tags : undefined,
    description: description || undefined,
    useCases: base?.useCases,
    warnings: base?.warnings,
    testCases: base?.testCases,
    latestTestResults: base?.latestTestResults,
    validationStatus: base?.validationStatus || "untested",
    latestValidatedAt: base?.latestValidatedAt,
    version: base?.version,
    referenceInterpretation: buildReferenceInterpretation(tags),
    planningDirectives: buildPlanningDirectives(tags, promptText),
    promptDirectives: buildPromptDirectives(tags, promptText, description),
    promptBackbone: buildPromptBackbone(promptText, tags, description),
    createdBy: "user",
    updatedAt: Date.now(),
    sourceMode: "custom",
  };
};

const buildEditorFromLibrary = (item: StyleCardItem): StyleEditorState => {
  const referenceImages = item.library.referenceImageUrls || [];
  const fallbackSamples = referenceImages.filter((url) => url !== item.library.coverImageUrl);
  return {
    scope: item.scope,
    mode: item.scope === "builtIn" ? "create" : "edit",
    id: item.id,
    title: item.library.title,
    coverImageUrl: item.library.coverImageUrl || referenceImages[0] || "",
    sampleImageUrls: fallbackSamples,
    promptText: item.library.promptText || "",
    tagsText: (item.library.tags || item.library.keywords || []).join("\n"),
    description: item.library.description || "",
    sourcePrompt: "",
    sourceLabel:
      item.scope === "builtIn"
        ? "系统预设"
        : item.scope === "candidate"
          ? "待完成卡片"
          : "我的风格卡片",
    baseLibrary: item.library,
  };
};

const buildEmptyEditor = (): StyleEditorState => ({
  scope: "gallery",
  mode: "create",
  title: "",
  coverImageUrl: "",
  sampleImageUrls: [],
  promptText: "",
  tagsText: "",
  description: "",
  sourcePrompt: "",
  sourceLabel: "新增风格卡片",
  baseLibrary: null,
});

const getEditorImageUrls = (editor: StyleEditorState) =>
  dedupeUrls([editor.coverImageUrl, ...editor.sampleImageUrls]);

const mergeEditorImages = (editor: StyleEditorState, nextUrls: string[]): StyleEditorState => {
  const merged = dedupeUrls([...getEditorImageUrls(editor), ...nextUrls]);
  const nextCover = String(editor.coverImageUrl || "").trim() || merged[0] || "";
  return {
    ...editor,
    coverImageUrl: nextCover,
    sampleImageUrls: merged.filter((item) => item !== nextCover),
  };
};

const promoteEditorImageAsCover = (editor: StyleEditorState, imageUrl: string): StyleEditorState => {
  const target = String(imageUrl || "").trim();
  const merged = getEditorImageUrls(editor);
  if (!target || !merged.includes(target)) {
    return editor;
  }
  return {
    ...editor,
    coverImageUrl: target,
    sampleImageUrls: merged.filter((item) => item !== target),
  };
};

const removeEditorImage = (editor: StyleEditorState, imageUrl: string): StyleEditorState => {
  const target = String(imageUrl || "").trim();
  const nextImages = getEditorImageUrls(editor).filter((item) => item !== target);
  return {
    ...editor,
    coverImageUrl: nextImages[0] || "",
    sampleImageUrls: nextImages.slice(1),
  };
};

const buildGalleryPrompt = (
  preview: SmartImportPreview,
  payload: GptImageInspirationPayload | null,
) => {
  if (preview.type === "case") {
    return preview.item.prompt;
  }

  const styles = preview.item.styles.map((item) => facetLabel(item, payload?.styles || []));
  const scenes = preview.item.scenes.map((item) => facetLabel(item, payload?.scenes || []));
  return [
    readLocalizedText(preview.item.useWhen),
    styles.length > 0 ? `风格标签：${styles.join("、")}` : "",
    scenes.length > 0 ? `场景标签：${scenes.join("、")}` : "",
    ...readLocalizedLines(preview.item.guidance),
    ...readLocalizedLines(preview.item.pitfalls),
  ]
    .filter(Boolean)
    .join("\n");
};

const buildGalleryEditor = (
  preview: SmartImportPreview,
  payload: GptImageInspirationPayload | null,
): StyleEditorState => {
  const key = preview.type === "case" ? `case-${preview.item.id}` : `template-${preview.item.id}`;
  const coverImageUrl = preview.type === "case" ? preview.item.image : preview.item.cover;
  const title =
    preview.type === "case"
      ? preview.item.title
      : readLocalizedText(preview.item.title, preview.item.id);
  const category = facetLabel(preview.item.category, payload?.categories || []);
  const styles = preview.item.styles.map((item) => facetLabel(item, payload?.styles || []));
  const scenes = preview.item.scenes.map((item) => facetLabel(item, payload?.scenes || []));
  const tags = preview.type === "template" ? preview.item.tags || [] : [];
  const galleryTags = dedupeStrings([category, ...styles, ...scenes, ...tags], 12).join("\n");
  const galleryPrompt = buildGalleryPrompt(preview, payload);

  return {
    scope: "gallery",
    mode: "import",
    title,
    coverImageUrl,
    sampleImageUrls: [],
    promptText: galleryPrompt,
    tagsText: galleryTags,
    description: "",
    sourcePrompt: galleryPrompt,
    sourceLabel: preview.type === "case" ? "从画廊案例导入" : "从画廊模板导入",
    sourcePreviewKey: key,
    sourcePreviewType: preview.type,
    baseLibrary: null,
  };
};

const buildSearchText = (library: WorkspaceStyleLibrary) =>
  [
    library.title,
    library.summary,
    library.promptText,
    library.description,
    ...(library.tags || []),
    ...(library.keywords || []),
    ...(library.referenceImageUrls || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const buildGalleryCards = (payload: GptImageInspirationPayload | null): GalleryPreviewCard[] => {
  if (!payload) return [];

  const caseCards: GalleryPreviewCard[] = (payload.cases || []).map((item) => {
    const category = facetLabel(item.category, payload.categories || []);
    const styles = item.styles.map((style) => facetLabel(style, payload.styles || []));
    const scenes = item.scenes.map((scene) => facetLabel(scene, payload.scenes || []));
    return {
      key: `case-${item.id}`,
      type: "case" as const,
      title: item.title,
      cover: item.image,
      description: item.promptPreview || item.prompt,
      prompt: item.prompt,
      chips: dedupeStrings([category, ...styles, ...scenes], 6),
      preview: { type: "case" as const, item },
    };
  });

  const templateCards: GalleryPreviewCard[] = (payload.templates || []).map((item) => {
    const category = facetLabel(item.category, payload.categories || []);
    const styles = item.styles.map((style) => facetLabel(style, payload.styles || []));
    const scenes = item.scenes.map((scene) => facetLabel(scene, payload.scenes || []));
    return {
      key: `template-${item.id}`,
      type: "template" as const,
      title: readLocalizedText(item.title, item.id),
      cover: item.cover,
      description: readLocalizedText(item.description),
      prompt: buildGalleryPrompt({ type: "template", item }, payload),
      chips: dedupeStrings([category, ...styles, ...scenes, ...(item.tags || [])], 6),
      preview: { type: "template" as const, item },
    };
  });

  return [...caseCards, ...templateCards];
};

const toDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("读取图片失败"));
      }
    };
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });

const urlToInlinePart = async (url: string) => {
  const normalized = String(url || "").trim();
  if (!normalized) {
    throw new Error("缺少可分析的图片地址");
  }
  const dataUrl = /^data:image\//i.test(normalized)
    ? normalized
    : /^blob:/i.test(normalized)
      ? await fetch(normalized)
          .then((response) => response.blob())
          .then((blob) => toDataUrl(new File([blob], "style-card-image", { type: blob.type || "image/png" })))
      : await fetch(normalized)
          .then((response) => {
            if (!response.ok) {
              throw new Error(`图片下载失败：${response.status}`);
            }
            return response.blob();
          })
          .then((blob) => toDataUrl(new File([blob], "style-card-image", { type: blob.type || "image/png" })));
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match || !match[1] || !match[2]) {
    throw new Error("图片转 Base64 失败");
  }
  return {
    inlineData: {
      mimeType: match[1],
      data: match[2],
    },
  };
};

const parseJsonSafely = (text: string) => {
  try {
    return JSON.parse(text || "{}");
  } catch {
    const matched = String(text || "").match(/\{[\s\S]*\}/);
    if (!matched) return {};
    try {
      return JSON.parse(matched[0]);
    } catch {
      return {};
    }
  }
};

const analyzeStyleCardDraft = async (args: {
  imageUrls: string[];
  existingPromptText: string;
  existingTags: string[];
  task: "prompt" | "description";
}) => {
  const imageParts = await Promise.all(args.imageUrls.slice(0, 6).map((url) => urlToInlinePart(url)));
  const normalizedAgentPrompt = String(styleDescriptionAiPrompt || "").trim();
  const prompt =
    args.task === "prompt"
      ? [
          "你是风格卡片建模助手。",
          "请基于这些参考图，输出一份真正可用于图像生成模型的风格卡片草稿。",
          "重点不是泛泛总结，而是提炼这组图稳定生效的生图关键词骨架、标签和风格说明。",
          "promptText 必须写成后续可直接用于 GPT Image / image2 一类模型的生图关键词或 Prompt。",
          "promptText 优先保留高信号内容：镜头、构图、视角、光线、色彩、材质、氛围、线条、质感、画面节奏。",
          "不要把具体人物姓名、品牌名、商品型号、一次性文案写进 promptText。",
          "tags 返回 4 到 8 个短标签，偏风格分类词，不要写成长句。",
          normalizedAgentPrompt
            ? [
                "下面这段 markdown 是用户单独维护的“风格说明生成设定”，生成 description 时必须优先遵守，不要和你自己的默认模板冲突。",
                "[用户维护的风格说明设定开始]",
                normalizedAgentPrompt,
                "[用户维护的风格说明设定结束]",
              ].join("\n")
            : "",
          "如果外部设定与这里冲突，以用户维护的风格说明设定优先。",
          "注意：外部设定只约束 description 的内容风格，不得覆盖最终返回格式。无论如何，最终都必须返回合法 JSON，对象里必须包含 title、summary、promptText、tags、description 五个字段。",
          "title 用中文，像真实产品里的风格卡片名称。",
          "summary 用一句话概括这套风格卡片的主要气质。",
        ]
          .filter(Boolean)
          .join("\n")
      : [
          "你是风格卡片说明补全助手。",
          "请基于这些参考图、已有生图关键词和标签，只补全更准确的风格说明。",
          normalizedAgentPrompt
            ? [
                "下面这段 markdown 是用户单独维护的“风格说明生成设定”，生成 description 时必须严格遵守，并优先于代码内默认要求。",
                "[用户维护的风格说明设定开始]",
                normalizedAgentPrompt,
                "[用户维护的风格说明设定结束]",
              ].join("\n")
            : "",
          "如果外部设定与这里冲突，以用户维护的风格说明设定优先。",
          "注意：外部设定只约束 description 的内容本身，不得覆盖最终返回格式。无论如何，最终都必须返回合法 JSON，对象里必须包含 title、summary、promptText、tags、description 五个字段。",
          "不要写成案例解说，也不要写成泛泛 prose summary。",
          `已有生图关键词 / Prompt：${args.existingPromptText || "暂无"}`,
          `已有标签：${args.existingTags.join("、") || "暂无"}`,
          "同时返回 title、summary、promptText、tags 的完整 JSON；如果已有内容足够，请在返回中延续它们而不是乱改。",
        ]
          .filter(Boolean)
          .join("\n");

  const analysisModel = getVisualOrchestratorModelConfig();
  const fallbackModel = getBestModelSelection("text");
  const response = await generateJsonResponse({
    model: analysisModel?.modelId || fallbackModel.modelId,
    providerId: analysisModel?.providerId || fallbackModel.providerId || null,
    temperature: 0.2,
    responseSchema: STYLE_CARD_AI_SCHEMA,
    operation:
      args.task === "prompt" ? "styleLibraryCardPromptAnalysis" : "styleLibraryCardDescriptionAnalysis",
    parts: [{ text: prompt }, ...imageParts],
  });

  const rawResponseText = String(response.text || "").trim();
  const parsed = parseJsonSafely(rawResponseText || "{}");
  const title = String(parsed?.title || "").trim();
  const summary = String(parsed?.summary || "").trim();
  const promptText = String(parsed?.promptText || "").trim();
  const parsedDescription = String(parsed?.description || "").trim();
  const fallbackDescription =
    args.task === "description" && rawResponseText && !/^\s*\{/.test(rawResponseText)
      ? rawResponseText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim()
      : "";
  const description = parsedDescription || fallbackDescription;
  const tags = Array.isArray(parsed?.tags)
    ? parsed.tags.map((item: unknown) => String(item || "").trim()).filter(Boolean).slice(0, 12)
    : [];

  if (args.task === "description" && !description) {
    throw new Error("AI 没有返回可用的风格说明，请检查外部设定是否把 JSON 输出格式覆盖掉了。");
  }

  return {
    title,
    summary,
    promptText,
    description,
    tags,
  };
};

const pickFiles = (options?: { multiple?: boolean }) =>
  new Promise<File[]>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = Boolean(options?.multiple);
    input.onchange = () => resolve(Array.from(input.files || []));
    input.click();
  });

const buildCandidateMeta = (candidate: StudioStyleLibraryCandidateAsset) => {
  if (candidate.status === "ready_to_save") {
    return { badge: "待完成", subBadge: "已整理" };
  }
  if (candidate.status === "ready_for_test") {
    return { badge: "待完成", subBadge: "已导入" };
  }
  return { badge: "待完成", subBadge: "草稿" };
};

const removeSelectedStyleCards = (selectedKeys: string[]) => {
  const normalizedKeys = Array.from(
    new Set(selectedKeys.map((item) => String(item || "").trim()).filter(Boolean)),
  );
  if (normalizedKeys.length === 0) {
    return 0;
  }

  const api = getStudioUserAssetApi();
  const snapshot = api.getSnapshot();
  let removedCount = 0;

  normalizedKeys.forEach((key) => {
    if (key.startsWith("candidate::")) {
      const candidateId = key.slice("candidate::".length).trim();
      if (candidateId && snapshot.styleLibraryCandidates[candidateId]) {
        delete snapshot.styleLibraryCandidates[candidateId];
        removedCount += 1;
      }
      return;
    }

    if (key.startsWith("user::")) {
      const libraryId = key.slice("user::".length).trim();
      if (libraryId && snapshot.styleLibraries[libraryId]) {
        delete snapshot.styleLibraries[libraryId];
        removedCount += 1;
      }
    }
  });

  if (removedCount === 0) {
    return 0;
  }

  api.replaceSnapshot(snapshot, {
    audit: {
      action: "update",
      targetKind: "style-library",
      summary:
        removedCount === 1
          ? "Removed 1 style card via bulk delete."
          : `Removed ${removedCount} style cards via bulk delete.`,
    },
  });

  return removedCount;
};

const StyleLibraryCenter: React.FC = () => {
  const navigate = useNavigate();
  const [revision, setRevision] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const [notice, setNotice] = React.useState<NoticeState | null>(null);
  const [busyAction, setBusyAction] = React.useState<BusyAction>("");
  const [editor, setEditor] = React.useState<StyleEditorState | null>(null);
  const [showGalleryPicker, setShowGalleryPicker] = React.useState(false);
  const [galleryQuery, setGalleryQuery] = React.useState("");
  const [galleryPayload, setGalleryPayload] = React.useState<GptImageInspirationPayload | null>(null);
  const [galleryStatus, setGalleryStatus] = React.useState<"idle" | "loading" | "ready" | "error">("idle");
  const [galleryError, setGalleryError] = React.useState("");
  const imageModelConfigs = React.useMemo(() => getMappedModelConfigs("image"), []);
  const defaultImageModelRaw = imageModelConfigs[0]?.raw || imageModelConfigs[0]?.modelId || "";
  const [sampleGenerator, setSampleGenerator] = React.useState<StyleSampleGeneratorState>({
    open: false,
    modelRaw: "",
    promptText: "",
    aspectRatio: "3:4",
    count: 1,
  });
  const [isSelectionMode, setIsSelectionMode] = React.useState(false);
  const [selectedCardKeys, setSelectedCardKeys] = React.useState<string[]>([]);
  const galleryImportRequestRef = React.useRef(0);

  const builtInLibraries = React.useMemo(() => [], []);
  const userLibraries = React.useMemo(() => {
    return [...listUserStyleLibraries()].sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0));
  }, [revision]);
  const candidateLibraries = React.useMemo(() => {
    return [...getStudioUserAssetApi().listStyleLibraryCandidates()].sort(
      (left, right) => (right.updatedAt || 0) - (left.updatedAt || 0),
    );
  }, [revision]);

  const userCards = React.useMemo<StyleCardItem[]>(() => {
    return userLibraries.map((library) => ({
      scope: "user",
      id: String(library.id || library.slug || library.title),
      badge: "我的风格",
      subBadge: library.validationStatus === "passed" ? "已验证" : undefined,
      library,
    }));
  }, [userLibraries]);

  const candidateCards = React.useMemo<StyleCardItem[]>(() => {
    return candidateLibraries.map((library) => {
      const meta = buildCandidateMeta(library);
      return {
        scope: "candidate",
        id: library.id,
        badge: meta.badge,
        subBadge: meta.subBadge,
        library,
      };
    });
  }, [candidateLibraries]);

  const builtInCards = React.useMemo<StyleCardItem[]>(() => {
    return builtInLibraries.map(({ mode, library }) => ({
      scope: "builtIn",
      id: `built-in-${mode}`,
      badge: "系统预设",
      subBadge: mode === "poster-product" ? "商品海报" : "通用风格",
      library,
    }));
  }, [builtInLibraries]);

  const normalizedQuery = query.trim().toLowerCase();
  const filterCards = React.useCallback(
    (items: StyleCardItem[]) => {
      if (!normalizedQuery) return items;
      return items.filter((item) => buildSearchText(item.library).includes(normalizedQuery));
    },
    [normalizedQuery],
  );

  const filteredUserCards = React.useMemo(() => filterCards(userCards), [filterCards, userCards]);
  const filteredCandidateCards = React.useMemo(() => filterCards(candidateCards), [candidateCards, filterCards]);
  const filteredBuiltInCards = React.useMemo(() => filterCards(builtInCards), [builtInCards, filterCards]);
  const manageableCards = React.useMemo(() => [...userCards, ...candidateCards], [candidateCards, userCards]);
  const visibleSelectableCards = React.useMemo(
    () => [...filteredUserCards, ...filteredCandidateCards],
    [filteredCandidateCards, filteredUserCards],
  );
  const visibleSelectableKeys = React.useMemo(
    () =>
      visibleSelectableCards.map((item) =>
        buildStyleCardSelectionKey(item.scope as SelectableStyleCardScope, item.id),
      ),
    [visibleSelectableCards],
  );
  const selectedCardKeySet = React.useMemo(() => new Set(selectedCardKeys), [selectedCardKeys]);
  const selectedCardCount = selectedCardKeys.length;

  const galleryCards = React.useMemo(() => buildGalleryCards(galleryPayload), [galleryPayload]);
  const filteredGalleryCards = React.useMemo(() => {
    const normalized = galleryQuery.trim().toLowerCase();
    if (!normalized) return galleryCards;
    return galleryCards.filter((item) =>
      [item.title, item.description, item.prompt, ...item.chips].join(" ").toLowerCase().includes(normalized),
    );
  }, [galleryCards, galleryQuery]);

  React.useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  React.useEffect(() => {
    const validKeys = new Set(
      manageableCards.map((item) =>
        buildStyleCardSelectionKey(item.scope as SelectableStyleCardScope, item.id),
      ),
    );
    setSelectedCardKeys((current) => {
      const next = current.filter((key) => validKeys.has(key));
      return next.length === current.length ? current : next;
    });
  }, [manageableCards]);

  React.useEffect(() => {
    if (!showGalleryPicker) return;
    if (galleryPayload) {
      setGalleryStatus("ready");
      return;
    }
    let cancelled = false;
    const load = async () => {
      setGalleryStatus("loading");
      setGalleryError("");
      try {
        const payload = await fetchGptImageInspiration();
        if (cancelled) return;
        setGalleryPayload(payload);
        setGalleryStatus("ready");
      } catch (error) {
        if (cancelled) return;
        setGalleryStatus("error");
        setGalleryError(error instanceof Error ? error.message : String(error));
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [galleryPayload, showGalleryPicker]);

  const currentImages = React.useMemo(() => {
    if (!editor) return [];
    return getEditorImageUrls(editor);
  }, [editor]);

  const currentSampleGeneratorModel = React.useMemo<MappedModelConfig | null>(() => {
    const currentRaw = String(sampleGenerator.modelRaw || defaultImageModelRaw).trim();
    if (!currentRaw) return imageModelConfigs[0] || null;
    return (
      imageModelConfigs.find((item) => (item.raw || item.modelId) === currentRaw) ||
      imageModelConfigs[0] ||
      null
    );
  }, [defaultImageModelRaw, imageModelConfigs, sampleGenerator.modelRaw]);

  const handleOpenCreate = React.useCallback(() => {
    setEditor(buildEmptyEditor());
  }, []);

  const handleOpenCard = React.useCallback((item: StyleCardItem) => {
    setEditor(buildEditorFromLibrary(item));
  }, []);

  const handleToggleSelectionMode = React.useCallback(() => {
    setIsSelectionMode((current) => {
      if (current) {
        setSelectedCardKeys([]);
      }
      return !current;
    });
  }, []);

  const handleToggleCardSelection = React.useCallback((item: StyleCardItem) => {
    if (!isSelectableStyleCardScope(item.scope)) {
      return;
    }
    const key = buildStyleCardSelectionKey(item.scope, item.id);
    setSelectedCardKeys((current) =>
      current.includes(key)
        ? current.filter((value) => value !== key)
        : [...current, key],
    );
  }, []);

  const handleSelectAllVisible = React.useCallback(() => {
    setSelectedCardKeys(visibleSelectableKeys);
  }, [visibleSelectableKeys]);

  const handleInvertVisible = React.useCallback(() => {
    setSelectedCardKeys((current) => {
      const visibleKeySet = new Set(visibleSelectableKeys);
      const retained = current.filter((key) => !visibleKeySet.has(key));
      const invertedVisible = visibleSelectableKeys.filter((key) => !current.includes(key));
      return [...retained, ...invertedVisible];
    });
  }, [visibleSelectableKeys]);

  const handleClearSelection = React.useCallback(() => {
    setSelectedCardKeys([]);
  }, []);

  const handleBatchDelete = React.useCallback(() => {
    if (selectedCardKeys.length === 0) {
      return;
    }
    const confirmed = window.confirm(`确认删除已选 ${selectedCardKeys.length} 张风格卡片吗？`);
    if (!confirmed) {
      return;
    }
    try {
      const deletedCount = removeSelectedStyleCards(selectedCardKeys);
      if (deletedCount === 0) {
        throw new Error("没有找到可删除的风格卡片记录。");
      }
      const currentEditorKey =
        editor?.id && (editor.scope === "user" || editor.scope === "candidate")
          ? buildStyleCardSelectionKey(editor.scope, editor.id)
          : null;
      if (currentEditorKey && selectedCardKeys.includes(currentEditorKey)) {
        setEditor(null);
      }
      setRevision((current) => current + 1);
      setSelectedCardKeys([]);
      setIsSelectionMode(false);
      setNotice({ tone: "success", text: `已删除 ${selectedCardKeys.length} 张风格卡片。` });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "批量删除失败。",
      });
    }
  }, [editor, selectedCardKeys]);

  const handleReplaceImageSet = React.useCallback(async () => {
    const files = await pickFiles({ multiple: true });
    if (files.length === 0) return;
    setBusyAction("uploading-set");
    try {
      const uploadedUrls = await Promise.all(files.map((file) => uploadImage(file)));
      setEditor((current) => {
        if (!current) return current;
        return mergeEditorImages(current, uploadedUrls);
      });
      setNotice({ tone: "success", text: "样图已加入列表；如当前没有封面，系统已自动使用第一张。" });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "上传样图失败。",
      });
    } finally {
      setBusyAction("");
    }
  }, []);

  const handleSelectPreviewImage = React.useCallback((imageUrl: string) => {
    setEditor((current) => {
      if (!current) return current;
      return promoteEditorImageAsCover(current, imageUrl);
    });
  }, []);

  const handleRemovePreviewImage = React.useCallback((imageUrl: string) => {
    setEditor((current) => {
      if (!current) return current;
      return removeEditorImage(current, imageUrl);
    });
  }, []);

  const handleOpenSampleGenerator = React.useCallback(() => {
    if (!editor) return;
    setSampleGenerator((current) => ({
      open: true,
      modelRaw: current.modelRaw || defaultImageModelRaw,
      promptText: String(editor.promptText || "").trim(),
      aspectRatio: current.aspectRatio || "3:4",
      count: current.count || 1,
    }));
  }, [defaultImageModelRaw, editor]);

  const handleGenerateSampleImages = React.useCallback(async () => {
    if (!editor) return;
    const prompt = String(sampleGenerator.promptText || "").trim();
    if (!prompt) {
      setNotice({ tone: "error", text: "请先填写这次样图生成要使用的关键词。" });
      return;
    }
    const modelConfig = currentSampleGeneratorModel;
    if (!modelConfig) {
      setNotice({ tone: "error", text: "当前没有可用的图片模型，请先到设置里确认模型映射。" });
      return;
    }

    setBusyAction("generating-samples");
    try {
      const requests = Array.from({ length: sampleGenerator.count }, () =>
        generateImageWithProvider(
          {
            prompt,
            providerId: modelConfig.providerId || null,
            aspectRatio: sampleGenerator.aspectRatio,
            imageSize: "1K",
          },
          modelConfig.modelId,
        ),
      );
      const generatedUrls = (await Promise.all(requests)).filter(
        (item): item is string => Boolean(String(item || "").trim()),
      );
      if (generatedUrls.length === 0) {
        throw new Error("样图生成失败，模型没有返回图片。");
      }
      setEditor((current) => {
        if (!current) return current;
        return mergeEditorImages(current, generatedUrls);
      });
      setSampleGenerator((current) => ({ ...current, open: false, promptText: prompt }));
      setNotice({ tone: "success", text: `已生成 ${generatedUrls.length} 张样图，并加入样图列表。` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "样图生成失败。";
      const normalizedMessage = String(message || "").toLowerCase();
      const isRateLimited =
        normalizedMessage.includes("429") ||
        normalizedMessage.includes("rate limit") ||
        normalizedMessage.includes("too many requests");
      setNotice({
        tone: "error",
        text: isRateLimited
          ? "当前生图请求太频繁，服务商正在限流，请稍等片刻再重试。"
          : message,
      });
    } finally {
      setBusyAction("");
    }
  }, [currentSampleGeneratorModel, editor, sampleGenerator]);

  const handleAnalyzePrompt = React.useCallback(async () => {
    if (!editor) return;
    const imageUrls = dedupeUrls([editor.coverImageUrl, ...editor.sampleImageUrls]);
    if (imageUrls.length === 0) {
      setNotice({ tone: "error", text: "请先上传风格图，再分析生图关键词。" });
      return;
    }
    setBusyAction("prompt");
    try {
      const result = await analyzeStyleCardDraft({
        imageUrls,
        existingPromptText: editor.promptText,
        existingTags: splitTextToLines(editor.tagsText),
        task: "prompt",
      });
      setEditor((current) => {
        if (!current) return current;
        return {
          ...current,
          title: String(current.title || "").trim() || result.title || current.title,
          promptText: result.promptText || current.promptText,
          tagsText: result.tags.length > 0 ? result.tags.join("\n") : current.tagsText,
          description: current.description || result.description,
        };
      });
      setNotice({ tone: "success", text: "已根据风格图补齐生图关键词，并同步生成标签。" });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "AI 分析生图关键词失败。",
      });
    } finally {
      setBusyAction("");
    }
  }, [editor]);

  const handleGenerateDescription = React.useCallback(async () => {
    if (!editor) return;
    const imageUrls = dedupeUrls([editor.coverImageUrl, ...editor.sampleImageUrls]);
    if (imageUrls.length === 0) {
      setNotice({ tone: "error", text: "请先上传风格图，再生成风格说明。" });
      return;
    }
    setBusyAction("description");
    try {
      const result = await analyzeStyleCardDraft({
        imageUrls,
        existingPromptText: editor.promptText,
        existingTags: splitTextToLines(editor.tagsText),
        task: "description",
      });
      if (!String(result.description || "").trim()) {
        throw new Error("AI 没有返回可用的风格说明。请检查当前外部设定是否与 JSON 输出格式冲突。");
      }
      setEditor((current) => {
        if (!current) return current;
        return {
          ...current,
          title: String(current.title || "").trim() || result.title || current.title,
          promptText: current.promptText || result.promptText,
          tagsText: current.tagsText || (result.tags.length > 0 ? result.tags.join("\n") : ""),
          description: result.description || current.description,
        };
      });
      setNotice({ tone: "success", text: "已根据风格图、生图关键词和标签生成风格说明。" });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "AI 生成风格说明失败。",
      });
    } finally {
      setBusyAction("");
    }
  }, [editor]);

  const handleOpenGallery = React.useCallback(() => {
    setShowGalleryPicker(true);
  }, []);

  const handleImportFromGalleryLegacy = React.useCallback(
    async (preview: SmartImportPreview) => {
      const nextEditor = buildGalleryEditor(preview, galleryPayload);
      const cachedCoverImageUrl = await normalizeReferenceToDataUrl(nextEditor.coverImageUrl);
      const hydratedEditor = cachedCoverImageUrl
        ? {
            ...nextEditor,
            coverImageUrl: cachedCoverImageUrl,
          }
        : nextEditor;
      setShowGalleryPicker(false);
      setEditor(hydratedEditor);
      try {
        const result = await analyzeStyleCardDraft({
          imageUrls: dedupeUrls([hydratedEditor.coverImageUrl, ...hydratedEditor.sampleImageUrls]),
          existingPromptText: hydratedEditor.promptText,
          existingTags: splitTextToLines(hydratedEditor.tagsText),
          task: "description",
        });
        setEditor((current) => {
          if (!current || current.sourcePreviewKey !== hydratedEditor.sourcePreviewKey) {
            return current;
          }
          return {
            ...current,
            title: String(current.title || "").trim() || result.title || current.title,
            promptText: current.promptText || result.promptText,
            tagsText: current.tagsText || (result.tags.length > 0 ? result.tags.join("\n") : ""),
            description: result.description || current.description,
          };
        });
        setNotice({
          tone: "success",
          text: result.description ? "已沿用画廊现成 Prompt 和标签，并补齐风格说明。" : "已沿用画廊现成 Prompt 和标签。",
        });
      } catch (error) {
        setNotice({
          tone: "error",
          text:
            error instanceof Error
              ? `画廊风格说明生成失败：${error.message}`
              : "画廊风格说明生成失败。",
        });
      } finally {
      }
    },
    [galleryPayload],
  );

  const handleImportFromGallery = React.useCallback(
    async (preview: SmartImportPreview) => {
      const nextEditor = buildGalleryEditor(preview, galleryPayload);
      const requestId = galleryImportRequestRef.current + 1;
      galleryImportRequestRef.current = requestId;

      setShowGalleryPicker(false);
      setEditor(nextEditor);

      void (async () => {
        let hydratedEditor = nextEditor;

        try {
          const cachedCoverImageUrl = await normalizeReferenceToDataUrl(
            nextEditor.coverImageUrl,
          );
          if (requestId !== galleryImportRequestRef.current) {
            return;
          }
          if (cachedCoverImageUrl) {
            hydratedEditor = {
              ...nextEditor,
              coverImageUrl: cachedCoverImageUrl,
            };
            setEditor((current) => {
              if (!current || current.sourcePreviewKey !== nextEditor.sourcePreviewKey) {
                return current;
              }
              if (
                current.coverImageUrl &&
                current.coverImageUrl !== nextEditor.coverImageUrl
              ) {
                return current;
              }
              return {
                ...current,
                coverImageUrl: cachedCoverImageUrl,
              };
            });
          }
        } catch {
          // Do not block the editor if cover hydration fails on slow or touch devices.
        }

        try {
          const result = await analyzeStyleCardDraft({
            imageUrls: dedupeUrls([
              hydratedEditor.coverImageUrl,
              ...hydratedEditor.sampleImageUrls,
            ]),
            existingPromptText: hydratedEditor.promptText,
            existingTags: splitTextToLines(hydratedEditor.tagsText),
            task: "description",
          });
          if (requestId !== galleryImportRequestRef.current) {
            return;
          }
          setEditor((current) => {
            if (!current || current.sourcePreviewKey !== hydratedEditor.sourcePreviewKey) {
              return current;
            }
            return {
              ...current,
              title: String(current.title || "").trim() || result.title || current.title,
              promptText: current.promptText || result.promptText,
              tagsText:
                current.tagsText || (result.tags.length > 0 ? result.tags.join("\n") : ""),
              description: result.description || current.description,
            };
          });
          setNotice({
            tone: "success",
            text: result.description
              ? "已沿用画廊现成 Prompt 和标签，并补齐风格说明。"
              : "已沿用画廊现成 Prompt 和标签。",
          });
        } catch (error) {
          if (requestId !== galleryImportRequestRef.current) {
            return;
          }
          setNotice({
            tone: "error",
            text:
              error instanceof Error
                ? `画廊风格说明生成失败：${error.message}`
                : "画廊风格说明生成失败。",
          });
        }
      })();
    },
    [galleryPayload],
  );

  const handleSaveEditor = React.useCallback(() => {
    if (!editor) return;
    const title = String(editor.title || "").trim();
    const cover = String(editor.coverImageUrl || "").trim();
    const promptText = String(editor.promptText || "").trim();
    const tags = splitTextToLines(editor.tagsText);
    const description = String(editor.description || "").trim();

    if (!cover && editor.sampleImageUrls.length === 0) {
      setNotice({ tone: "error", text: "至少上传 1 张风格图后才能完成。" });
      return;
    }
    if (!promptText) {
      setNotice({ tone: "error", text: "请填写该风格图的生图关键词 / Prompt。" });
      return;
    }
    if (!description) {
      setNotice({ tone: "error", text: "请填写风格说明，或先用 AI 生成。" });
      return;
    }

    setBusyAction("saving");
    try {
      const api = getStudioUserAssetApi();
      const nextLibrary = buildLibraryFromEditor({
        ...editor,
        title: title || editor.title,
        coverImageUrl: cover,
        promptText,
        tagsText: tags.join("\n"),
        description,
      });
      const preferredId =
        editor.scope === "user" || editor.scope === "candidate"
          ? editor.id
          : editor.sourcePreviewKey
            ? `style-card-${editor.sourcePreviewKey}`
            : undefined;
      const saved = api.saveStyleLibrary(nextLibrary, {
        preferredId,
        sourceMode: "custom",
      });
      if (!saved) {
        throw new Error("风格卡片保存失败。");
      }
      if (editor.scope === "candidate" && editor.id) {
        api.removeStyleLibraryCandidate(editor.id);
      }
      setRevision((current) => current + 1);
      setEditor(null);
      setNotice({
        tone: "success",
        text:
          editor.mode === "edit" ? "风格卡片已更新。" : "风格卡片已创建。",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "风格卡片保存失败。",
      });
    } finally {
      setBusyAction("");
    }
  }, [editor]);

  const handleDeleteEditor = React.useCallback(() => {
    if (!editor || !editor.id) return;
    const confirmed = window.confirm(
      editor.scope === "candidate" ? "确认删除这张待完成卡片吗？" : "确认删除这张风格卡片吗？",
    );
    if (!confirmed) return;
    try {
      const api = getStudioUserAssetApi();
      if (editor.scope === "candidate") {
        api.removeStyleLibraryCandidate(editor.id);
      } else if (editor.scope === "user") {
        api.removeStyleLibrary(editor.id);
      } else {
        return;
      }
      setRevision((current) => current + 1);
      setEditor(null);
      setNotice({ tone: "success", text: "风格卡片已删除。" });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "删除失败。",
      });
    }
  }, [editor]);

  const renderCardGrid = (items: StyleCardItem[], emptyText: string) => {
    if (items.length === 0) {
      return (
        <div className="flex h-[240px] items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-slate-50 text-[14px] text-slate-500">
          {emptyText}
        </div>
      );
    }

    return (
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(168px,1fr))]">
        {items.map((item, index) => {
          const previewUrl = item.library.coverImageUrl || item.library.referenceImageUrls?.[0] || "";
          const selectable = isSelectableStyleCardScope(item.scope);
          const selectionKey = selectable
            ? buildStyleCardSelectionKey(
                item.scope as SelectableStyleCardScope,
                item.id,
              )
            : null;
          const selected = selectionKey ? selectedCardKeySet.has(selectionKey) : false;
          return (
            <button
              key={`${item.scope}-${item.id}`}
              type="button"
              onClick={() => {
                if (isSelectionMode && selectable) {
                  handleToggleCardSelection(item);
                  return;
                }
                handleOpenCard(item);
              }}
              className="group text-left"
            >
              <div
                className={`relative aspect-[0.72] overflow-hidden rounded-[14px] border bg-white transition group-hover:border-slate-300 group-hover:shadow-[0_16px_36px_rgba(15,23,42,0.10)] ${
                  selected ? "border-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.14)]" : "border-slate-200"
                }`}
                style={{
                  background: previewUrl
                    ? `linear-gradient(180deg, rgba(15,23,42,0.02), rgba(15,23,42,0.10)), url(${previewUrl}) center/cover no-repeat`
                    : getCardPreviewBackground(index),
                }}
              >
                {isSelectionMode && selectable ? (
                  <div className="absolute left-3 top-3 z-10">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur ${
                        selected
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-white/90 bg-white/92 text-slate-700"
                      }`}
                    >
                      {selected ? "已选择" : "选择"}
                    </span>
                  </div>
                ) : null}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent px-3 pb-3 pt-10">
                  <div className="inline-flex rounded-full bg-white/88 px-2.5 py-1 text-[11px] font-medium text-slate-700 backdrop-blur">
                    {item.badge}
                    {item.subBadge ? ` · ${item.subBadge}` : ""}
                  </div>
                </div>
              </div>
              <div className="px-1 pt-2.5">
                <div className="line-clamp-1 text-[14px] font-medium text-slate-900">
                  {item.library.title}
                </div>
                <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-slate-500">
                  {item.library.description || item.library.summary}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const isBusy = busyAction !== "";

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-900">
      <Sidebar />
      <div className="mx-auto max-w-[1480px] px-4 pb-16 pt-8 md:px-8 lg:pl-28 lg:pr-10">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-medium text-slate-500">
              <FolderKanban size={14} />
              风格卡片库
            </div>
            <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.02em] text-slate-950">
              用卡片管理风格，不再堆一堆后台字段
            </h1>
            <p className="mt-3 max-w-[760px] text-[14px] leading-7 text-slate-600">
              首页只看风格卡片预览。编辑时只保留封面 / 样图、生图关键词 Prompt、标签、风格说明四件事。新增风格和从画廊导入也走同一套最小闭环。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={subtleButtonClass}
              onClick={() => navigate(ROUTES.gptImageInspiration)}
            >
              <ArrowUpRight size={16} />
              打开画廊
            </button>
            <button type="button" className={subtleButtonClass} onClick={handleOpenGallery}>
              <ImagePlus size={16} />
              从画廊导入风格
            </button>
            <button type="button" className={primaryButtonClass} onClick={handleOpenCreate}>
              <Plus size={16} />
              新增风格
            </button>
          </div>
        </div>

        {notice ? (
          <div
            className={`mb-5 rounded-[16px] border px-4 py-3 text-[13px] leading-6 ${
              notice.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {notice.text}
          </div>
        ) : null}

        <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className={`${shellCardClass} flex items-center gap-3 px-4 py-3`}>
            <Search size={16} className="text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full border-0 bg-transparent text-[14px] text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="搜索风格名称、标签、Prompt 或风格说明"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "我的风格", value: String(userCards.length) },
              { label: "待完成", value: String(candidateCards.length) },
              { label: "系统预设", value: String(builtInCards.length) },
            ].slice(0, 2).map((item) => (
              <div key={item.label} className={`${shellCardClass} min-w-[120px] px-4 py-3`}>
                <div className="text-[12px] text-slate-500">{item.label}</div>
                <div className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-slate-950">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${shellCardClass} mb-6 flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between`}>
          <div>
            <div className="text-[14px] font-medium text-slate-900">批量管理</div>
            <div className="mt-1 text-[12px] leading-6 text-slate-500">
              {isSelectionMode
                ? `已选 ${selectedCardCount} 张风格卡片，可对当前搜索结果执行全选、反选和删除。`
                : "进入批量管理后，可对“我的风格”和“待完成”执行全选、反选与批量删除。"}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={subtleButtonClass} onClick={handleToggleSelectionMode}>
              {isSelectionMode ? "退出批量管理" : "批量管理"}
            </button>
            {isSelectionMode ? (
              <>
                <button
                  type="button"
                  className={subtleButtonClass}
                  onClick={handleSelectAllVisible}
                  disabled={visibleSelectableKeys.length === 0}
                >
                  全选当前结果
                </button>
                <button
                  type="button"
                  className={subtleButtonClass}
                  onClick={handleInvertVisible}
                  disabled={visibleSelectableKeys.length === 0}
                >
                  反选当前结果
                </button>
                <button
                  type="button"
                  className={subtleButtonClass}
                  onClick={handleClearSelection}
                  disabled={selectedCardCount === 0}
                >
                  清空选择
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-rose-200 bg-rose-50 px-4 text-[13px] font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleBatchDelete}
                  disabled={selectedCardCount === 0}
                >
                  删除所选
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div className="space-y-6">
          <section className={shellCardClass}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <div className="text-[16px] font-semibold text-slate-950">我的风格</div>
                <div className="mt-1 text-[13px] text-slate-500">
                  这里放已经能直接使用的风格卡片。
                </div>
              </div>
            </div>
            <div className="p-5">{renderCardGrid(filteredUserCards, "还没有风格卡片，先新增一张。")}</div>
          </section>

          {candidateCards.length > 0 ? (
            <section className={shellCardClass}>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <div className="text-[16px] font-semibold text-slate-950">待完成</div>
                  <div className="mt-1 text-[13px] text-slate-500">
                    这里收拢以前导入过但还没整理成正式卡片的内容。
                  </div>
                </div>
              </div>
              <div className="p-5">{renderCardGrid(filteredCandidateCards, "当前没有待完成卡片。")}</div>
            </section>
          ) : null}

          {false && <section className={shellCardClass}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <div className="text-[16px] font-semibold text-slate-950">系统预设</div>
                <div className="mt-1 text-[13px] text-slate-500">
                  看中哪张就点开，直接改成自己的风格卡片即可。
                </div>
              </div>
            </div>
            <div className="p-5">{renderCardGrid(filteredBuiltInCards, "没有可展示的系统预设。")}</div>
          </section>}
        </div>
      </div>

      {showGalleryPicker ? (
        <div className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.42)] p-4 backdrop-blur-[2px]">
          <div className="mx-auto flex h-[min(90vh,920px)] w-full max-w-[1180px] min-h-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-5">
              <div>
                <div className="text-[22px] font-semibold tracking-[-0.02em] text-slate-950">
                  从画廊导入风格
                </div>
                <p className="mt-2 text-[13px] leading-6 text-slate-500">
                  直接复用画廊里的封面和 prompt，再自动补一段可编辑的风格说明。
                </p>
              </div>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
                onClick={() => setShowGalleryPicker(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3 rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3">
                <Search size={16} className="text-slate-400" />
                <input
                  value={galleryQuery}
                  onChange={(event) => setGalleryQuery(event.target.value)}
                  className="w-full border-0 bg-transparent text-[14px] text-slate-900 outline-none placeholder:text-slate-400"
                  placeholder="搜索画廊标题、关键词或 prompt"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {galleryStatus === "loading" ? (
                <div className="flex h-full items-center justify-center gap-3 text-[14px] text-slate-500">
                  <Loader2 size={18} className="animate-spin" />
                  正在加载画廊内容…
                </div>
              ) : null}

              {galleryStatus === "error" ? (
                <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-4 text-[13px] leading-6 text-rose-700">
                  {galleryError || "画廊加载失败。"}
                </div>
              ) : null}

              {galleryStatus === "ready" ? (
                filteredGalleryCards.length > 0 ? (
                  <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
                    {filteredGalleryCards.map((item, index) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handleImportFromGallery(item.preview)}
                        className="group text-left"
                      >
                        <div
                          className="relative aspect-[0.78] overflow-hidden rounded-[16px] border border-slate-200 bg-white transition group-hover:border-slate-300 group-hover:shadow-[0_16px_36px_rgba(15,23,42,0.10)]"
                          style={{
                            background: item.cover
                              ? `linear-gradient(180deg, rgba(15,23,42,0.02), rgba(15,23,42,0.10)), url(${item.cover}) center/cover no-repeat`
                              : getCardPreviewBackground(index),
                          }}
                        >
                          <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-700 backdrop-blur">
                            {item.type === "case" ? "画廊案例" : "画廊模板"}
                          </div>
                        </div>
                        <div className="px-1 pt-3">
                          <div className="line-clamp-1 text-[14px] font-medium text-slate-900">
                            {item.title}
                          </div>
                          <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-slate-500">
                            {item.description || item.prompt}
                          </div>
                          {item.chips.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {item.chips.slice(0, 3).map((chip) => (
                                <span
                                  key={`${item.key}-${chip}`}
                                  className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600"
                                >
                                  {chip}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-slate-50 text-[14px] text-slate-500">
                    当前搜索下没有可导入的画廊风格。
                  </div>
                )
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {editor ? (
        <div className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.42)] p-4 backdrop-blur-[2px]">
          <div className="mx-auto flex h-[min(92vh,940px)] w-full max-w-[1120px] min-h-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] lg:flex-row">
            <div className="border-b border-slate-100 bg-slate-50/70 p-5 lg:w-[380px] lg:border-b-0 lg:border-r">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[12px] font-medium text-slate-500">{editor.sourceLabel}</div>
                  <div className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-slate-950">
                    {editor.mode === "edit"
                      ? "编辑风格卡片"
                      : editor.mode === "import"
                        ? "导入风格卡片"
                        : "新增风格卡片"}
                  </div>
                </div>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-white hover:text-slate-900"
                  onClick={() => setEditor(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-5 rounded-[18px] border border-slate-200 bg-white p-3">
                <div
                  className="relative aspect-[0.72] overflow-hidden rounded-[14px] border border-slate-200"
                  style={{
                    background: editor.coverImageUrl
                      ? `linear-gradient(180deg, rgba(15,23,42,0.02), rgba(15,23,42,0.10)), url(${editor.coverImageUrl}) center/cover no-repeat`
                      : getCardPreviewBackground(0),
                  }}
                />
                <div className="px-1 pt-3">
                  <div className="line-clamp-1 text-[16px] font-semibold text-slate-950">
                    {editor.title || "未命名风格卡片"}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {splitTextToLines(editor.tagsText).slice(0, 6).map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600"
                      >
                        {item}
                      </span>
                    ))}
                    {splitTextToLines(editor.tagsText).length === 0 ? (
                      <span className="rounded-full border border-dashed border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-400">
                        还没有标签
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 text-[12px] font-medium text-slate-500">样图列表</div>
                {currentImages.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {currentImages.map((url, index) => {
                      const active = url === editor.coverImageUrl;
                      return (
                        <div key={`${url}-${index}`} className="relative">
                          <button
                            type="button"
                            className={`group overflow-hidden rounded-[14px] border bg-white text-left transition ${
                              active
                                ? "border-slate-900 shadow-[0_10px_24px_rgba(15,23,42,0.14)]"
                                : "border-slate-200 hover:border-slate-300"
                            }`}
                            onClick={() => handleSelectPreviewImage(url)}
                            title={active ? "当前封面" : "点击设为封面并在上方预览"}
                          >
                            <img src={url} alt={`风格图 ${index + 1}`} className="h-20 w-20 object-cover" />
                          </button>
                          <button
                            type="button"
                            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/92 text-slate-500 shadow-sm transition hover:bg-white hover:text-rose-600"
                            onClick={() => handleRemovePreviewImage(url)}
                            title="删除这张样图"
                          >
                            <X size={12} />
                          </button>
                          <div className="mt-1 text-center text-[10px] font-medium text-slate-500">
                            {active ? "封面" : `样图 ${index + 1}`}
                          </div>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      className="flex h-20 w-20 flex-col items-center justify-center rounded-[14px] border border-dashed border-slate-300 bg-white text-[11px] font-medium text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
                      onClick={handleOpenSampleGenerator}
                    >
                      <Sparkles size={16} />
                      <span className="mt-1">生成样图</span>
                    </button>
                  </div>
                ) : (
                  <div className="rounded-[14px] border border-dashed border-slate-300 bg-white p-4">
                    <div className="text-[13px] leading-6 text-slate-400">上传后的图片和生成结果都会进入这里。点击任意小图即可切换上方预览并设为封面。</div>
                    <button
                      type="button"
                      className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-dashed border-slate-300 bg-white px-4 text-[13px] font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800"
                      onClick={handleOpenSampleGenerator}
                    >
                      <Sparkles size={16} />
                      先生成一组样图
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className={subtleButtonClass}
                    onClick={handleReplaceImageSet}
                    disabled={busyAction === "uploading-set" || isBusy}
                  >
                    {busyAction === "uploading-set" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <ImagePlus size={16} />
                    )}
                    上传样图
                  </button>
                </div>
                <div className="mt-2 text-[12px] leading-5 text-slate-500">
                  只保留最小编辑项：样图、生图关键词 Prompt、标签、风格说明。上传后的图片会进入样图列表，第一张会自动做封面，后续也可以点小图切换封面。
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                <div className="space-y-5">
                  <label className="block">
                    <div className="mb-2 text-[13px] font-medium text-slate-700">风格名称</div>
                    <input
                      value={editor.title}
                      onChange={(event) =>
                        setEditor((current) =>
                          current ? { ...current, title: event.target.value } : current,
                        )
                      }
                      className={inputClass}
                      placeholder="给这张风格卡片起一个用户能看懂的名字"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium text-slate-700">生图关键词 / Prompt</span>
                      <button
                        type="button"
                        className={subtleButtonClass}
                        onClick={handleAnalyzePrompt}
                        disabled={busyAction === "prompt" || isBusy}
                      >
                        {busyAction === "prompt" ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Sparkles size={16} />
                        )}
                        AI 分析生图关键词
                      </button>
                    </div>
                    <textarea
                      value={editor.promptText}
                      onChange={(event) =>
                        setEditor((current) =>
                          current ? { ...current, promptText: event.target.value } : current,
                        )
                      }
                      className="min-h-[180px] w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-[14px] leading-7 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                      placeholder="填写该风格图对应的生图关键词 / Prompt。可手动输入，也可让 AI 根据上传图分析；AI 分析时会顺便补齐标签。"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 text-[13px] font-medium text-slate-700">标签</div>
                    <textarea
                      value={editor.tagsText}
                      onChange={(event) =>
                        setEditor((current) =>
                          current ? { ...current, tagsText: event.target.value } : current,
                        )
                      }
                      className={textareaClass}
                      placeholder="一行一个标签。画廊导入会自动沿用原有标签；新建风格时 AI 分析生图关键词也会顺便补齐标签。"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium text-slate-700">风格说明</span>
                      <button
                        type="button"
                        className={subtleButtonClass}
                        onClick={handleGenerateDescription}
                        disabled={busyAction === "description" || isBusy}
                      >
                        {busyAction === "description" ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Wand2 size={16} />
                        )}
                        AI 生成风格说明
                      </button>
                    </div>
                    <textarea
                      value={editor.description}
                      onChange={(event) =>
                        setEditor((current) =>
                          current ? { ...current, description: event.target.value } : current,
                        )
                      }
                      className="min-h-[220px] w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-[14px] leading-7 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                      placeholder="写这套风格真正稳定的部分：色彩、光线、镜头、材质、氛围、构图、版式节奏。也可以直接让 AI 根据图片、Prompt 和标签生成。"
                    />
                  </label>
                </div>
              </div>

              <div className="border-t border-slate-100 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    {(editor.scope === "user" || editor.scope === "candidate") && editor.id ? (
                      <button
                        type="button"
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-rose-200 bg-rose-50 px-4 text-[13px] font-medium text-rose-700 transition hover:bg-rose-100"
                        onClick={handleDeleteEditor}
                        disabled={isBusy}
                      >
                        <Trash2 size={16} />
                        删除卡片
                      </button>
                    ) : (
                      <div className="text-[12px] leading-5 text-slate-500">
                        测试位置后续再补，这一版先把风格卡片做成最小可用闭环。
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      className={subtleButtonClass}
                      onClick={() => setEditor(null)}
                      disabled={isBusy}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      className={primaryButtonClass}
                      onClick={handleSaveEditor}
                      disabled={busyAction === "saving" || isBusy}
                    >
                      {busyAction === "saving" ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : editor.mode === "edit" ? (
                        <PencilLine size={16} />
                      ) : (
                        <Plus size={16} />
                      )}
                      {editor.scope === "builtIn"
                        ? "保存为我的风格"
                        : editor.mode === "edit"
                          ? "完成更新"
                          : "完成创建"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {sampleGenerator.open ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[rgba(15,23,42,0.14)] p-4">
              <div className="w-full max-w-[560px] rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[18px] font-semibold text-slate-950">生成样图</div>
                    <div className="mt-1 text-[12px] leading-5 text-slate-500">
                      使用当前风格关键词直接出图，生成结果会自动加入样图列表。
                    </div>
                  </div>
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
                    onClick={() => setSampleGenerator((current) => ({ ...current, open: false }))}
                    disabled={busyAction === "generating-samples"}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  <label className="block">
                    <div className="mb-2 text-[13px] font-medium text-slate-700">模型选择</div>
                    <select
                      value={sampleGenerator.modelRaw || defaultImageModelRaw}
                      onChange={(event) =>
                        setSampleGenerator((current) => ({
                          ...current,
                          modelRaw: event.target.value,
                        }))
                      }
                      className={inputClass}
                    >
                      {imageModelConfigs.map((item) => {
                        const optionValue = item.raw || item.modelId;
                        return (
                          <option key={optionValue} value={optionValue}>
                            {item.displayLabel}
                          </option>
                        );
                      })}
                    </select>
                  </label>

                  <label className="block">
                    <div className="mb-2 text-[13px] font-medium text-slate-700">关键词输入</div>
                    <textarea
                      value={sampleGenerator.promptText}
                      onChange={(event) =>
                        setSampleGenerator((current) => ({
                          ...current,
                          promptText: event.target.value,
                        }))
                      }
                      className="min-h-[160px] w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-[14px] leading-7 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                      placeholder="默认会带入当前风格卡片的生图关键词，你也可以在这里临时微调后再生成。"
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="mb-2 text-[13px] font-medium text-slate-700">比例</div>
                      <div className="grid grid-cols-3 gap-2">
                        {STYLE_CARD_ASPECT_RATIO_OPTIONS.map((ratio) => {
                          const active = sampleGenerator.aspectRatio === ratio;
                          return (
                            <button
                              key={ratio}
                              type="button"
                              className={`h-10 rounded-[12px] border text-[12px] font-medium transition ${
                                active
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                              }`}
                              onClick={() =>
                                setSampleGenerator((current) => ({
                                  ...current,
                                  aspectRatio: ratio,
                                }))
                              }
                            >
                              {ratio}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-[13px] font-medium text-slate-700">生图数量</div>
                      <div className="grid grid-cols-4 gap-2">
                        {STYLE_CARD_IMAGE_COUNT_OPTIONS.map((count) => {
                          const active = sampleGenerator.count === count;
                          return (
                            <button
                              key={count}
                              type="button"
                              className={`h-10 rounded-[12px] border text-[12px] font-medium transition ${
                                active
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                              }`}
                              onClick={() =>
                                setSampleGenerator((current) => ({
                                  ...current,
                                  count,
                                }))
                              }
                            >
                              {count} 张
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] leading-6 text-slate-500">
                    当前模型：{currentSampleGeneratorModel?.displayLabel || "未设置"}；这里是纯文生图测试，只看这段关键词本身的出图效果，不额外带风格参考图。
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    className={subtleButtonClass}
                    onClick={() => setSampleGenerator((current) => ({ ...current, open: false }))}
                    disabled={busyAction === "generating-samples"}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className={primaryButtonClass}
                    onClick={handleGenerateSampleImages}
                    disabled={busyAction === "generating-samples"}
                  >
                    {busyAction === "generating-samples" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    开始生图
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default StyleLibraryCenter;
