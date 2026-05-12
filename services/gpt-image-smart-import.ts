import { Type } from "@google/genai";
import { generateJsonResponse, getBestModelId } from "./gemini";
import type { WorkspaceStyleLibrary } from "../types/common";
import type {
  GptImageInspirationCase,
  GptImageInspirationCategory,
  GptImageInspirationFacet,
  GptImageInspirationPayload,
  GptImageInspirationTemplate,
  LocalizedText,
} from "./gpt-image-inspiration";

export type SmartImportPreview =
  | { type: "case"; item: GptImageInspirationCase }
  | { type: "template"; item: GptImageInspirationTemplate };

export type SmartImportMode =
  | "style_library"
  | "case_transfer"
  | "edit_template";

export type SmartImportAnalysis = {
  mode: SmartImportMode;
  confidence: number;
  thinking: string[];
  successMessage: string;
  warnings: string[];
  library: WorkspaceStyleLibrary;
  preferredId: string;
};

const SMART_IMPORT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    mode: { type: Type.STRING },
    confidence: { type: Type.NUMBER },
    thinking: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    successMessage: { type: Type.STRING },
    warnings: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    library: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        summary: { type: Type.STRING },
        referenceInterpretation: { type: Type.STRING },
        planningDirectives: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        promptDirectives: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: [
        "title",
        "summary",
        "referenceInterpretation",
        "planningDirectives",
        "promptDirectives",
      ],
    },
  },
  required: [
    "mode",
    "confidence",
    "thinking",
    "successMessage",
    "warnings",
    "library",
  ],
};

const looksBrokenText = (value: string | undefined) => {
  const text = String(value || "");
  if (!text) return false;
  const suspicious = text.match(/\uFFFD/g) || [];
  return suspicious.length >= Math.max(3, Math.floor(text.length / 10));
};

const textFor = (value: LocalizedText | undefined, fallback = "") => {
  const zh = value?.zh || "";
  if (zh && !looksBrokenText(zh)) return zh;
  return value?.en || fallback;
};

const facetLabel = (
  value: string,
  items: Array<GptImageInspirationFacet | GptImageInspirationCategory>,
) => {
  const match = items.find((item) => item.value === value);
  return match ? textFor(match.title, value) : value;
};

const slugify = (value: string) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "style-library";

const sanitizeLines = (values: unknown, fallback: string[] = []) => {
  if (!Array.isArray(values)) return fallback;
  const next = values
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 12);
  return next.length ? next : fallback;
};

const summarizePreview = (
  preview: SmartImportPreview,
  payload: GptImageInspirationPayload | null,
) => {
  if (preview.type === "case") {
    const category = facetLabel(preview.item.category, payload?.categories || []);
    const styles = preview.item.styles.map((item) =>
      facetLabel(item, payload?.styles || []),
    );
    const scenes = preview.item.scenes.map((item) =>
      facetLabel(item, payload?.scenes || []),
    );
    return {
      id: `case-${preview.item.id}`,
      title: preview.item.title,
      category,
      styles,
      scenes,
      description: preview.item.promptPreview || preview.item.prompt,
      sourceLabel: preview.item.sourceLabel,
      fullPrompt: preview.item.prompt,
    };
  }

  return {
    id: `template-${preview.item.id}`,
    title: textFor(preview.item.title, preview.item.id),
    category: facetLabel(preview.item.category, payload?.categories || []),
    styles: preview.item.styles.map((item) =>
      facetLabel(item, payload?.styles || []),
    ),
    scenes: preview.item.scenes.map((item) =>
      facetLabel(item, payload?.scenes || []),
    ),
    description: textFor(preview.item.description),
    sourceLabel: "template",
    fullPrompt: [
      textFor(preview.item.useWhen),
      ...(Array.isArray((preview.item.guidance as { zh?: string[] })?.zh)
        ? ((preview.item.guidance as { zh?: string[] }).zh || [])
        : []),
      ...(Array.isArray((preview.item.pitfalls as { zh?: string[] })?.zh)
        ? ((preview.item.pitfalls as { zh?: string[] }).zh || [])
        : []),
    ]
      .filter(Boolean)
      .join("\n"),
  };
};

const buildImportPrompt = (
  preview: SmartImportPreview,
  payload: GptImageInspirationPayload | null,
) => {
  const summary = summarizePreview(preview, payload);
  return `
你是一个“案例导入转换智能体”。

目标：
用户点击导入时，不要死规则提炼。请你根据案例内容，智能判断这个案例更适合转换成哪一种可复用资产：
1. style_library：抽象风格库，强调审美语言，不追求高度像原案例
2. case_transfer：强案例迁移模板，强调构图、姿势、服装、光线、氛围高度接近原案例，但主体可替换
3. edit_template：编辑型模板，强调“哪里改，哪里不改”，适合局部编辑任务

你必须输出一个适合当前案例的风格库结构，但这个风格库应该能明确指导下游系统更像“抽象风格”还是“强案例迁移”。

重要要求：
- 如果案例显然适合“上传自己人物后，保留案例姿势/服装/构图/氛围”，优先判断为 case_transfer
- 不要机械地禁止复刻一切；而是根据案例类型决定保留到什么程度
- thinking 要写成给用户看的转换思路，简洁清楚，3-6 条
- successMessage 要告诉用户这次导入到底会偏向什么效果
- warnings 写潜在风险，没有可为空数组
- library.title 必须是用户能看懂的中文标题
- library.summary 必须说明这个导入项的用途
- library.referenceInterpretation 必须明确说明后续生成时应该如何同时使用“案例”和“用户上传图”
- planningDirectives / promptDirectives 必须是下游可直接消费的明确约束

当前案例信息：
${JSON.stringify(summary, null, 2)}

只返回 JSON。
`.trim();
};

const normalizeMode = (value: unknown): SmartImportMode => {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "case_transfer") return "case_transfer";
  if (mode === "edit_template") return "edit_template";
  return "style_library";
};

const normalizeImportedLibrary = (
  preview: SmartImportPreview,
  analysis: any,
): SmartImportAnalysis => {
  const title =
    String(analysis?.library?.title || "").trim() ||
    `${preview.type === "case" ? preview.item.title : textFor(preview.item.title, preview.item.id)} 导入风格`;
  const mode = normalizeMode(analysis?.mode);
  return {
    mode,
    confidence: Number(analysis?.confidence || 0.72),
    thinking: sanitizeLines(analysis?.thinking, ["已根据案例内容完成智能转换。"]),
    successMessage:
      String(analysis?.successMessage || "").trim() ||
      "已完成智能导入转换。",
    warnings: sanitizeLines(analysis?.warnings, []),
    preferredId: `${mode}-${slugify(title)}`,
    library: {
      title,
      slug: slugify(title),
      summary:
        String(analysis?.library?.summary || "").trim() ||
        "从案例中智能转换得到的可复用风格资产。",
      coverImageUrl:
        preview.type === "case"
          ? preview.item.image
          : preview.item.cover,
      referenceInterpretation:
        String(analysis?.library?.referenceInterpretation || "").trim() ||
        "生成时同时参考案例图与用户上传图，优先保持案例风格与用户主体身份。",
      planningDirectives: sanitizeLines(analysis?.library?.planningDirectives, [
        "优先判断案例是抽象风格参考，还是强案例迁移参考。",
        "如果用户提供人物图，优先保留用户人物身份与面部特征。",
      ]),
      promptDirectives: sanitizeLines(analysis?.library?.promptDirectives, [
        "尽量保留案例的风格、构图、光线与氛围。",
        "如果用户提供主体图，用用户主体替换案例原主体。",
      ]),
      createdBy: "user",
      updatedAt: Date.now(),
      sourceMode: "custom",
    },
  };
};

export const analyzeSmartStyleImport = async (
  preview: SmartImportPreview,
  payload: GptImageInspirationPayload | null,
): Promise<SmartImportAnalysis> => {
  const response = await generateJsonResponse({
    model: getBestModelId("text"),
    parts: [{ text: buildImportPrompt(preview, payload) }],
    temperature: 0.25,
    responseSchema: SMART_IMPORT_RESPONSE_SCHEMA,
    operation: "gptImageSmartImport",
    queueKey: "gptImageSmartImport",
    minIntervalMs: 300,
    requestTuning: {
      timeoutMs: 45000,
      retries: 1,
      baseDelayMs: 600,
      maxDelayMs: 2500,
    },
  });

  let parsed: any = {};
  try {
    parsed = JSON.parse(response.text || "{}");
  } catch {
    parsed = {};
  }

  return normalizeImportedLibrary(preview, parsed);
};
