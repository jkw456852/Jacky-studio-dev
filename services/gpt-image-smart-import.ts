import { Type } from "@google/genai";
import { generateJsonResponse, getBestModelSelection } from "./gemini";
import { getVisualOrchestratorModelConfig } from "./provider-settings";
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
        description: { type: Type.STRING },
        promptText: { type: Type.STRING },
        tags: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        keywords: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        useCases: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        warnings: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        referenceInterpretation: { type: Type.STRING },
        promptBackbone: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
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
        "promptText",
        "tags",
        "description",
        "referenceInterpretation",
        "promptBackbone",
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

const dedupeLines = (values: Array<string | undefined | null>, limit = 8) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
};

const buildPresetTitle = (value: string, fallback = "导入风格") => {
  const base = String(value || "").trim() || fallback;
  const cleaned = base
    .replace(/\s*风格提炼$/u, "")
    .replace(/\s*案例迁移模板$/u, "")
    .replace(/\s*案例迁移$/u, "")
    .replace(/\s*风格预设$/u, "")
    .trim();
  return `${cleaned || fallback} 风格预设`;
};

const chunkPromptParagraph = (paragraph: string, maxLength = 170) => {
  const normalized = String(paragraph || "").trim();
  if (!normalized) return [];
  if (normalized.length <= maxLength) return [normalized];

  const sentenceLikeParts = normalized
    .replace(/([。！？!?；;])/gu, "$1\n")
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const grouped: string[] = [];
  let current = "";
  sentenceLikeParts.forEach((part) => {
    const next = current ? `${current} ${part}` : part;
    if (next.length > maxLength && current) {
      grouped.push(current);
      current = part;
      return;
    }
    current = next;
  });
  if (current) grouped.push(current);
  return grouped.length > 0 ? grouped : [normalized.slice(0, maxLength)];
};

const splitPromptBackboneLines = (prompt: string, limit = 4) => {
  const paragraphs = String(prompt || "")
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const lines: string[] = [];
  paragraphs.forEach((paragraph) => {
    chunkPromptParagraph(paragraph).forEach((line) => {
      if (lines.length < limit) {
        lines.push(line);
      }
    });
  });
  return lines.slice(0, limit);
};

const buildReusablePromptBackboneLines = (prompt: string) => {
  const backbone = splitPromptBackboneLines(prompt, 4);
  if (backbone.length === 0) return [];
  return [
    "尽量保留原始提示词骨架中的镜头、透视、动作、材质、特效和氛围，只替换与主体身份直接相关的部分。",
    ...backbone.map((line, index) =>
      index === 0 ? `原始提示词骨架：${line}` : `继续沿用这段提示词骨架：${line}`,
    ),
  ];
};

const buildPreviewPromptBackboneLines = (preview: SmartImportPreview) => {
  if (preview.type === "case") {
    return buildReusablePromptBackboneLines(preview.item.prompt);
  }
  const templatePrompt = [
    textFor(preview.item.useWhen),
    ...(Array.isArray((preview.item.guidance as { zh?: string[] })?.zh)
      ? ((preview.item.guidance as { zh?: string[] }).zh || [])
      : []),
    ...(Array.isArray((preview.item.pitfalls as { zh?: string[] })?.zh)
      ? ((preview.item.pitfalls as { zh?: string[] }).zh || [])
      : []),
  ]
    .filter(Boolean)
    .join("\n");
  return buildReusablePromptBackboneLines(templatePrompt);
};

const buildPreviewPlanningFallbackLines = (preview: SmartImportPreview) => {
  if (preview.type === "case") {
    return [
      "先继承原始提示词骨架中的构图、镜头、透视、空间关系、特效分布与氛围，再替换主体身份。",
      "如果用户提供主体素材，只替换主体、服装、产品或文案等任务变量，不要把强视觉关键词泛化成普通商业描述。",
    ];
  }
  return [
    "优先保留模板原始提示词中的版式、镜头、风格和使用边界，不要重写成宽泛说明。",
  ];
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
你是一个“风格预设导入转换智能体”。
目标：用户点击导入时，不要机械提炼。请根据参考内容，智能判断这个素材更适合转换成哪一种可复用资产：
1. style_library：抽象风格库，强调审美语言，不追求高度像原参考图
2. case_transfer：强迁移预设，强调构图、姿势、服装、光线、氛围高度接近参考图，但主体可替换
3. edit_template：编辑型预设，强调“哪里改，哪里不改”，适合局部编辑任务

你必须输出一个适合当前素材的风格库结构，但这个风格库应该明确指导下游系统更像“抽象风格”还是“强迁移预设”。

重要要求：
- 如果素材显然适合“上传自己人物后，保留参考图姿势、服装、构图和氛围”，优先判断为 case_transfer。
- 不要机械地禁止复刻一切；而是根据素材类型决定保留到什么程度。
- thinking 要写成给用户看的转换思路，简洁清楚，3-6 条。
- successMessage 要告诉用户这次导入会偏向什么效果。
- warnings 写潜在风险，没有可为空数组。
- library.title 必须是用户能看懂的中文标题。
- library.summary 必须说明这个导入项的用途。
- library.promptText 必须输出为后续可直接用于图像生成模型的固定风格 Prompt，尽量保留原始 prompt 中真正起效果的高信号骨架。
- library.tags 必须输出 4 到 8 个短标签，用于浏览和分类，不要写成长句。
- library.description 不要写成普通说明文，必须写成“风格原则卡”，聚焦主体呈现、镜头视角、构图骨架、光线色彩、材质渲染、氛围控制、漂移禁区。
- library.referenceInterpretation 必须明确说明后续生成时应该如何同时使用“参考图”和“用户上传图”。
- library.promptBackbone 必须尽量保留原始 prompt 中真正起效果的骨架段落，优先保留镜头角度、透视关系、动作姿态、空间结构、材质词、特效词、光线词、氛围词、平台 UI 语义、构图节奏。
- planningDirectives / promptDirectives 必须是下游可直接消费的明确约束。
- library.title、summary、referenceInterpretation、planningDirectives、promptDirectives 都必须写成“可复用风格预设”的语气，不要写成“案例说明”。
- 不要反复使用“案例图 / 案例侧 / 原案例”这类词，统一改写成“参考图 / 参考内容 / 用户主体 / 当前任务目标”。
- 不要把原本有效的提示词洗成泛化说明。要尽量保留原始 prompt 中真正起效果的关键词骨架，例如镜头角度、透视关系、动作姿态、空间结构、材质词、特效词、光线词、氛围词、平台 UI 语义、构图节奏。
- promptDirectives 应该尽量像“可复用改写版 prompt”，而不是纯解释文字。做法是：保留原 prompt 的高信号描述，只把原主体、人名、品牌名、一次性文案替换成可插槽变量，比如“用户主体 / 用户产品 / 用户文案”。
- 对 case_transfer 类型，优先保留原 prompt 的镜头和动势骨架，不要把“低机位冲出屏幕、透明手机、碎片外溅、强透视”改写成空泛的“有空间感、比较有动势”。

当前素材信息：
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
    buildPresetTitle(
      preview.type === "case"
        ? preview.item.title
        : textFor(preview.item.title, preview.item.id),
    );
  const mode = normalizeMode(analysis?.mode);
  const previewCategory = facetLabel(
    preview.item.category,
    (preview.type === "case" ? analysis?.payload?.categories : analysis?.payload?.categories) || [],
  );
  const styleLabels = preview.item.styles.map((item) =>
    facetLabel(item, []),
  );
  const sceneLabels = preview.item.scenes.map((item) =>
    facetLabel(item, []),
  );
  const coverImageUrl =
    preview.type === "case" ? preview.item.image : preview.item.cover;
  const fullPrompt =
    preview.type === "case"
      ? preview.item.prompt
      : [
          textFor(preview.item.useWhen),
          ...(Array.isArray((preview.item.guidance as { zh?: string[] })?.zh)
            ? ((preview.item.guidance as { zh?: string[] }).zh || [])
            : []),
          ...(Array.isArray((preview.item.pitfalls as { zh?: string[] })?.zh)
            ? ((preview.item.pitfalls as { zh?: string[] }).zh || [])
            : []),
        ]
          .filter(Boolean)
          .join("\n");
  const useCases = dedupeLines(
    sanitizeLines(analysis?.library?.useCases, []).concat(
      preview.type === "case"
        ? [
            mode === "edit_template"
              ? "适合局部编辑、替换元素、保持主体身份的任务。"
              : "适合保留构图、镜头和氛围骨架的迁移任务。",
          ]
        : [textFor(preview.item.useWhen)],
    ),
    6,
  );
  const libraryWarnings = dedupeLines(
    sanitizeLines(analysis?.library?.warnings, []).concat(
      sanitizeLines(analysis?.warnings, []),
      mode === "edit_template"
        ? ["使用该预设时需要明确哪些区域必须保留、哪些区域允许修改。"]
        : ["如当前任务目标与参考内容差异较大，应主动降低迁移强度，避免误把参考图当成复刻目标。"],
    ),
    6,
  );
  return {
    mode,
    confidence: Number(analysis?.confidence || 0.72),
    thinking: sanitizeLines(analysis?.thinking, ["已根据参考内容完成智能转换。"]),
    successMessage:
      String(analysis?.successMessage || "").trim() ||
      "已完成风格预设导入，可直接作为后续生成约束使用。",
    warnings: sanitizeLines(analysis?.warnings, []),
    preferredId: `${mode}-${slugify(title)}`,
    library: {
      title,
      slug: slugify(title),
      summary:
        String(analysis?.library?.summary || "").trim() ||
        "从参考内容中智能转换得到的可复用风格预设，可直接约束后续生成的风格、结构与主体替换方式。",
      coverImageUrl,
      kind: mode,
      referenceImageUrls: coverImageUrl ? [coverImageUrl] : [],
      keywords: dedupeLines(
        sanitizeLines(analysis?.library?.keywords, []).concat(
          previewCategory,
          ...styleLabels,
          ...sceneLabels,
        ),
        12,
      ),
      promptText:
        String(analysis?.library?.promptText || "").trim() || fullPrompt,
      tags: dedupeLines(
        sanitizeLines(analysis?.library?.tags, []).concat(
          sanitizeLines(analysis?.library?.keywords, []),
          previewCategory,
          ...styleLabels,
          ...sceneLabels,
        ),
        12,
      ),
      description:
        String(analysis?.library?.description || "").trim() ||
        (preview.type === "case"
          ? preview.item.promptPreview || preview.item.prompt
          : textFor(preview.item.description) || fullPrompt),
      useCases: useCases.length > 0 ? useCases : undefined,
      warnings: libraryWarnings.length > 0 ? libraryWarnings : undefined,
      testCases: fullPrompt
        ? [
            {
              id: `${mode}-${slugify(title)}-baseline`,
              title:
                mode === "edit_template"
                  ? "编辑边界回归测试"
                  : mode === "case_transfer"
                    ? "迁移效果回归测试"
                    : "风格复用回归测试",
              prompt: fullPrompt,
              referenceImageUrls: coverImageUrl ? [coverImageUrl] : undefined,
              imageCount: 1,
              expectedFocus:
                mode === "edit_template"
                  ? "验证修改边界、保留区和替换区是否稳定。"
                  : mode === "case_transfer"
                    ? "验证构图、镜头、动作和氛围骨架是否稳定迁移。"
                    : "验证风格语言、版式和关键词骨架是否可复用。",
            },
          ]
        : undefined,
      referenceInterpretation:
        String(analysis?.library?.referenceInterpretation || "").trim() ||
        "生成时同时参考参考图与用户上传图，优先保留参考内容里真正起作用的提示词骨架，并以用户主体身份、产品信息和当前任务目标为准，只替换主体相关变量。",
      promptBackbone: dedupeLines(
        sanitizeLines(analysis?.library?.promptBackbone, []).concat(
          buildPreviewPromptBackboneLines(preview),
        ),
        6,
      ),
      planningDirectives: dedupeLines(
        sanitizeLines(analysis?.library?.planningDirectives, []).concat(
          buildPreviewPlanningFallbackLines(preview),
          [
            "优先判断参考图承担的是抽象风格参考、强迁移参考，还是编辑规则参考。",
            "如果用户提供人物图，优先保留用户人物身份与面部特征。",
          ],
        ),
      ),
      promptDirectives: dedupeLines(
        sanitizeLines(analysis?.library?.promptDirectives, []).concat(
          buildPreviewPromptBackboneLines(preview),
          [
            "如果用户提供主体图，用用户主体替换原提示词中的默认主体，但尽量不要改动镜头、透视、动作、特效与氛围骨架。",
          ],
        ),
      ),
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
  const analysisModel = getVisualOrchestratorModelConfig();
  const fallbackModel = getBestModelSelection("text");
  const response = await generateJsonResponse({
    model: analysisModel?.modelId || fallbackModel.modelId,
    providerId: analysisModel?.providerId || fallbackModel.providerId || null,
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
