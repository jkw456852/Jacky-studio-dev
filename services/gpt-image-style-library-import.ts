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
      title: `${item.title} 风格提炼`,
      slug: slugify(`${item.title}-case-${item.id}`),
      summary: `从案例 ${item.id} 提炼出的可复用风格库。保留视觉语言，不复刻原案例主体。`,
      coverImageUrl: item.image,
      referenceInterpretation: isEditLikeCase
        ? `把这个案例理解为一种“编辑方式和视觉呈现方法”，不是固定成图。优先借鉴 ${categoryLabel} 的画面组织、光线、材质和编辑逻辑，但必须替换原案例中的具体主体、品牌、文案和场景。`
        : `把这个案例理解为一种“视觉风格和构图语言”，不是固定示例。优先继承 ${categoryLabel} 的气质、镜头感、版式和材料表现，但不能直接复刻原案例中的人物、商品、标题和叙事。`,
      planningDirectives: dedupeLines([
        `优先抽取 ${categoryLabel} 的构图、光线、材质和版式规则，而不是原案例里的具体对象。`,
        styleLabels.length ? `保留风格特征：${styleLabels.join("、")}。` : "",
        sceneLabels.length ? `保留场景气质：${sceneLabels.join("、")}。` : "",
        isEditLikeCase
          ? "如果用户提供新主体，只借用编辑策略和视觉规则，不保留原案例主体身份。"
          : "如果用户提供新主体，只借用风格和画面结构，不保留原案例叙事内容。",
        "将案例中的专有名词、人名、品牌名、账号名、产品型号与一次性文案全部视为不可继承信息。",
        "如用户任务目标与案例内容冲突，优先保留风格语言，放弃案例原始叙事。",
      ]),
      promptDirectives: dedupeLines([
        `输出时强调 ${categoryLabel} 的视觉语言，不直接复刻案例中的人物、商品、品牌或文案。`,
        styleLabels.length ? `可保留的风格标签：${styleLabels.join("、")}。` : "",
        sceneLabels.length ? `可保留的氛围标签：${sceneLabels.join("、")}。` : "",
        "把案例里的具体对象改写成可替换占位主体，如“主体 / 产品 / 场景 / 文案区”。",
        "除非用户明确要求，否则不要生成与原案例高度相似的构图、姿态、标题或故事设定。",
        isEditLikeCase
          ? "遇到编辑类任务时，优先锁定修改目标与不改区域，只继承编辑逻辑。"
          : "遇到生成类任务时，优先沿用画面结构和审美语气，而不是原案例内容。",
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

  return {
    preferredId: `gpt-image-template-${item.id}`,
    library: {
      title: `${title} 风格提炼`,
      slug: slugify(`${title}-template`),
      summary: description || `从模板 ${title} 提炼出的可复用风格库。`,
      coverImageUrl: item.cover,
      referenceInterpretation: `把这个模板理解为一套稳定的 ${categoryLabel} 视觉组织方式。优先继承它的画面结构、风格语言和约束边界，但不要复刻模板封面或示例中的固定主体。`,
      planningDirectives: dedupeLines([
        useWhen,
        ...guidance,
        `优先抽取 ${categoryLabel} 任务中可复用的画面结构，再结合当前主体和目标重组内容。`,
        "模板只提供风格和组织方式，不替代当前任务对象定义。",
      ]),
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

