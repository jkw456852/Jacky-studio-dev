import type { WorkspaceStyleLibrary } from "../types/common";
import type {
  GptImageInspirationCase,
  GptImageInspirationCategory,
  GptImageInspirationFacet,
  GptImageInspirationPayload,
  GptImageInspirationTemplate,
  LocalizedText,
} from "./gpt-image-inspiration";

type ImportablePreview =
  | { type: "case"; item: GptImageInspirationCase }
  | { type: "template"; item: GptImageInspirationTemplate };

export type ImportedStyleLibraryDraft = {
  preferredId: string;
  library: WorkspaceStyleLibrary;
};

const looksBrokenText = (value: string | undefined) => {
  const text = String(value || "");
  if (!text) return false;
  const suspicious = text.match(/[�銆鍚鈥锛]/g) || [];
  return suspicious.length >= Math.max(3, Math.floor(text.length / 10));
};

const textFor = (value: LocalizedText | undefined, fallback = "") => {
  const zh = value?.zh || "";
  if (zh && !looksBrokenText(zh)) return zh;
  return value?.en || fallback;
};

const linesFor = (
  value: LocalizedText | { en: string[]; zh: string[] } | undefined,
): string[] => {
  if (!value) return [];
  if (Array.isArray((value as { zh: string[] }).zh)) {
    const zh = ((value as { zh: string[] }).zh || []).filter(
      (item) => item && !looksBrokenText(item),
    );
    if (zh.length) return zh;
    return ((value as { en: string[] }).en || []).filter(Boolean);
  }
  return [textFor(value as LocalizedText)].filter(Boolean);
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

const dedupeLines = (values: Array<string | undefined | null>, limit = 8) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
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

const buildPromptBackboneLines = (prompt: string) => {
  const backbone = splitPromptBackboneLines(prompt, 4);
  if (backbone.length === 0) return [];
  return [
    "尽量保留原始提示词中真正起作用的镜头、透视、动作、材质、特效和氛围关键词，只替换主体相关变量。",
    ...backbone.map((line, index) =>
      index === 0 ? `原始提示词骨架：${line}` : `继续沿用这段提示词骨架：${line}`,
    ),
  ];
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

const buildCaseLibrary = (
  item: GptImageInspirationCase,
  payload: GptImageInspirationPayload | null,
): ImportedStyleLibraryDraft => {
  const categoryLabel = facetLabel(item.category, payload?.categories || []);
  const styleLabels = item.styles.map((tag) =>
    facetLabel(tag, payload?.styles || []),
  );
  const sceneLabels = item.scenes.map((tag) =>
    facetLabel(tag, payload?.scenes || []),
  );
  const promptLower = item.prompt.toLowerCase();
  const isEditLikeCase =
    promptLower.includes("edit this") ||
    promptLower.includes("do not change") ||
    promptLower.includes("don't change") ||
    promptLower.includes("replace") ||
    promptLower.includes("collage");

  return {
    preferredId: `gpt-image-case-${item.id}`,
    library: {
      title: buildPresetTitle(item.title, `案例 ${item.id}`),
      slug: slugify(`${item.title}-case-${item.id}`),
      summary: `从参考图 ${item.id} 整理出的可复用风格预设。保留视觉语言与组织方式，但不绑定原始主体、品牌或一次性文案。`,
      coverImageUrl: item.image,
      kind: isEditLikeCase ? "edit_template" : "case_transfer",
      referenceImageUrls: item.image ? [item.image] : [],
      keywords: dedupeLines([categoryLabel, ...styleLabels, ...sceneLabels], 12),
      description: item.promptPreview || item.prompt,
      useCases: dedupeLines(
        [
          `适合 ${categoryLabel} 相关任务。`,
          isEditLikeCase
            ? "适合局部编辑、元素替换、保留主体身份的精修任务。"
            : "适合保留构图、镜头、动势与氛围的高保真迁移任务。",
          ...sceneLabels.map((label) => `适用场景：${label}。`),
        ],
        6,
      ),
      warnings: dedupeLines(
        [
          isEditLikeCase
            ? "该预设偏向编辑逻辑复用，使用时应明确哪些区域必须保留、哪些区域允许修改。"
            : "该预设包含较强的构图与动势信号；如果当前任务目标差异较大，应主动降低迁移强度。",
          "参考图中的品牌、人名、产品型号与一次性文案不应直接继承到新任务中。",
        ],
        6,
      ),
      testCases: [
        {
          id: `case-${item.id}-baseline`,
          title: isEditLikeCase ? "编辑边界回归测试" : "构图迁移回归测试",
          prompt: item.prompt,
          referenceImageUrls: item.image ? [item.image] : undefined,
          imageCount: 1,
          expectedFocus: isEditLikeCase
            ? "验证保留区、替换区和编辑边界是否稳定。"
            : "验证镜头、构图、动作和氛围骨架是否能稳定迁移。",
        },
      ],
      referenceInterpretation: isEditLikeCase
        ? `把这组参考图理解为一种可复用的编辑方式与视觉呈现方法。优先继承 ${categoryLabel} 的画面组织、光线、材质和编辑逻辑；如果用户提供新的主体、品牌、文案或场景，应以用户内容为准。`
        : `把这组参考图理解为一种可复用的视觉风格与构图语言。优先继承 ${categoryLabel} 的气质、镜头感、版式和材料表现；如果用户提供新的主体或产品，应只保留风格语言，不复刻原图叙事。`,
      planningDirectives: dedupeLines([
        "先继承原始提示词骨架中的构图、镜头、透视、空间关系、特效分布与氛围，再替换主体身份。",
        `优先抽取 ${categoryLabel} 的构图、光线、材质和版式规则，而不是参考图中的具体对象。`,
        styleLabels.length ? `保留风格特征：${styleLabels.join("、")}。` : "",
        sceneLabels.length ? `保留场景气质：${sceneLabels.join("、")}。` : "",
        isEditLikeCase
          ? "如果用户提供新主体，只借用编辑策略和视觉规则，不保留参考图原主体身份。"
          : "如果用户提供新主体，只借用风格和画面结构，不保留参考图原始叙事。",
        "不要把原始提示词里的强视觉关键词泛化成普通商业描述。",
        "将参考图中的专有名词、人名、品牌名、账号名、产品型号与一次性文案全部视为不可继承信息。",
        "如用户任务目标与参考内容冲突，优先保留风格语言，放弃原参考图叙事。",
      ]),
      promptBackbone: dedupeLines(buildPromptBackboneLines(item.prompt), 6),
      promptDirectives: dedupeLines([
        `输出时强调 ${categoryLabel} 的视觉语言，不直接复刻参考图中的人物、商品、品牌或文案。`,
        styleLabels.length ? `可保留的风格标签：${styleLabels.join("、")}。` : "",
        sceneLabels.length ? `可保留的氛围标签：${sceneLabels.join("、")}。` : "",
        "把参考图里的具体对象改写成可替换占位主体，如“主体 / 产品 / 场景 / 文案区”。",
        "除非用户明确要求，否则不要生成与原参考图高度相似的构图、姿态、标题或故事设定。",
        isEditLikeCase
          ? "遇到编辑类任务时，优先锁定修改目标与不改区域，只继承编辑逻辑。"
          : "遇到生成类任务时，优先沿用画面结构和审美语气，而不是原参考图内容。",
      ]),
      createdBy: "user",
      updatedAt: Date.now(),
      sourceMode: "custom",
    },
  };
};

const buildTemplateLibrary = (
  item: GptImageInspirationTemplate,
  payload: GptImageInspirationPayload | null,
): ImportedStyleLibraryDraft => {
  const title = textFor(item.title, item.id);
  const description = textFor(item.description);
  const useWhen = textFor(item.useWhen);
  const guidance = linesFor(item.guidance);
  const pitfalls = linesFor(item.pitfalls);
  const categoryLabel = facetLabel(item.category, payload?.categories || []);
  const styleLabels = item.styles.map((tag) =>
    facetLabel(tag, payload?.styles || []),
  );
  const sceneLabels = item.scenes.map((tag) =>
    facetLabel(tag, payload?.scenes || []),
  );
  const templatePrompt = [useWhen, ...guidance, ...pitfalls].filter(Boolean).join("\n");

  return {
    preferredId: `gpt-image-template-${item.id}`,
    library: {
      title: buildPresetTitle(title, item.id),
      slug: slugify(`${title}-template`),
      summary:
        description ||
        `从 ${title} 整理出的可复用风格预设，可直接作为后续生成时的风格与结构约束。`,
      coverImageUrl: item.cover,
      kind: "style_library",
      referenceImageUrls: item.cover ? [item.cover] : [],
      keywords: dedupeLines([categoryLabel, ...styleLabels, ...sceneLabels], 12),
      description: description || templatePrompt,
      useCases: dedupeLines([useWhen, ...guidance], 6),
      warnings: dedupeLines(pitfalls.map((line) => `避免：${line}`), 6),
      testCases: templatePrompt
        ? [
            {
              id: `template-${item.id}-baseline`,
              title: "模板复用回归测试",
              prompt: templatePrompt,
              referenceImageUrls: item.cover ? [item.cover] : undefined,
              imageCount: 1,
              expectedFocus: "验证模板的版式、镜头、风格边界和默认约束是否稳定复用。",
            },
          ]
        : undefined,
      referenceInterpretation: `把这个模板理解为一套稳定的 ${categoryLabel} 视觉组织方式。优先继承它的画面结构、风格语言和约束边界，但不要复刻模板封面或示例中的固定主体。`,
      planningDirectives: dedupeLines([
        useWhen,
        ...guidance,
        "优先保留模板原始提示词中的版式、镜头、风格和使用边界，不要重写成宽泛说明。",
        `优先抽取 ${categoryLabel} 任务中可复用的画面结构，再结合当前主体和目标重组内容。`,
        "模板只提供风格和组织方式，不替代当前任务对象定义。",
      ]),
      promptBackbone: dedupeLines(buildPromptBackboneLines(templatePrompt), 6),
      promptDirectives: dedupeLines([
        ...guidance,
        ...pitfalls.map((line) => `避免：${line}`),
        "保留模板风格特征，但不复刻模板示例里的具体对象、标题和品牌。",
        "当用户有自己的主体、品牌或文案时，优先替换模板中的默认示例元素。",
      ]),
      createdBy: "user",
      updatedAt: Date.now(),
      sourceMode: "custom",
    },
  };
};

export const buildImportedStyleLibrary = (
  preview: ImportablePreview,
  payload: GptImageInspirationPayload | null,
): ImportedStyleLibraryDraft =>
  preview.type === "case"
    ? buildCaseLibrary(preview.item, payload)
    : buildTemplateLibrary(preview.item, payload);
