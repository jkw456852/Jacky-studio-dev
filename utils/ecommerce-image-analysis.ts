import type { EcommerceImageAnalysis } from "../types/workflow.types";

const DESCRIPTION_LABEL_PATTERN =
  /^(?:产品详描|产品描述|图片描述|图像描述|描述|description)\s*[:：-]\s*/i;
const CONCLUSION_LABEL_PATTERN =
  /^(?:分析结论|参考判断|参考结论|结论|建议|analysisConclusion|referenceAssessment|referenceConclusion|recommendation|verdict)\s*[:：-]\s*/i;

const CONCLUSION_MARKER_PATTERNS = [
  /(?:非常|比较|较为|更|最)?(?:适合|不适合|更适合)(?:作为|用作|用于|做)?/i,
  /(?:可|可以|能够|能|足以)(?:作为|用作|用于|支撑|支持|承担)/i,
  /(?:建议|不建议)(?:作为|用于|做)/i,
  /(?:还缺|缺少|欠缺)/i,
  /(?:不足以|不够)(?:支撑|判断|作为|用于)/i,
  /(?:能|可)(?:支持|覆盖|满足)/i,
];

const FACTUAL_HINT_PATTERN =
  /(?:展示|呈现|可见|看到|主体|产品|机身|按钮|接口|材质|背景|光线|角度|视角|包装|配件|结构|颜色|logo|标识|纹理|细节|边角|底部|顶部|侧面|正面|背面|轮廓|尺寸|表面|屏幕|面板|镜头|把手|刷头|滚轮|底盘|线缆|说明书|充电口|开关)/i;

type SegmentTarget = "description" | "conclusion";

const normalizeText = (value: unknown): string =>
  String(value || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

const cleanSegment = (value: string): string =>
  value
    .replace(/\s+/g, " ")
    .replace(/^[，,、；;:：\s]+/, "")
    .replace(/[，,、；;:：\s]+$/, "")
    .trim();

const splitIntoSegments = (value: string): string[] => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [];
  }

  const sentences = normalized.match(/[^。！？；\n]+[。！？；]?/g) || [normalized];
  return sentences.map(cleanSegment).filter(Boolean);
};

const findFirstConclusionMarkerIndex = (value: string): number => {
  let index = -1;

  for (const pattern of CONCLUSION_MARKER_PATTERNS) {
    const matchIndex = value.search(pattern);
    if (matchIndex >= 0 && (index < 0 || matchIndex < index)) {
      index = matchIndex;
    }
  }

  return index;
};

const looksLikeFactualPrefix = (value: string): boolean => {
  const cleaned = cleanSegment(value);
  if (!cleaned) {
    return false;
  }

  if (FACTUAL_HINT_PATTERN.test(cleaned)) {
    return true;
  }

  return cleaned.length >= 16 && /[，,、:：]/.test(value);
};

const pushUnique = (bucket: string[], value: string) => {
  const cleaned = cleanSegment(value);
  if (!cleaned) {
    return;
  }

  if (!bucket.some((entry) => cleanSegment(entry) === cleaned)) {
    bucket.push(cleaned);
  }
};

const collectSegments = (
  value: string,
  preferredTarget: SegmentTarget,
  descriptionBucket: string[],
  conclusionBucket: string[],
) => {
  for (const rawSegment of splitIntoSegments(value)) {
    let segment = rawSegment;
    let target = preferredTarget;

    if (CONCLUSION_LABEL_PATTERN.test(segment)) {
      segment = cleanSegment(segment.replace(CONCLUSION_LABEL_PATTERN, ""));
      target = "conclusion";
    } else if (DESCRIPTION_LABEL_PATTERN.test(segment)) {
      segment = cleanSegment(segment.replace(DESCRIPTION_LABEL_PATTERN, ""));
      target = "description";
    }

    if (!segment) {
      continue;
    }

    const markerIndex = findFirstConclusionMarkerIndex(segment);
    if (markerIndex < 0) {
      pushUnique(target === "description" ? descriptionBucket : conclusionBucket, segment);
      continue;
    }

    const descriptionPrefix = cleanSegment(segment.slice(0, markerIndex));
    const conclusionSuffix = cleanSegment(segment.slice(markerIndex));

    if (descriptionPrefix && looksLikeFactualPrefix(descriptionPrefix)) {
      pushUnique(descriptionBucket, descriptionPrefix);
    } else if (target === "description" && !conclusionSuffix) {
      pushUnique(descriptionBucket, segment);
      continue;
    }

    pushUnique(conclusionBucket, conclusionSuffix || segment);
  }
};

export const splitEcommerceImageAnalysisTextFields = (
  item: EcommerceImageAnalysis,
): EcommerceImageAnalysis => {
  const descriptionSegments: string[] = [];
  const conclusionSegments: string[] = [];

  collectSegments(
    normalizeText(item.description),
    "description",
    descriptionSegments,
    conclusionSegments,
  );
  collectSegments(
    normalizeText(item.analysisConclusion),
    "conclusion",
    descriptionSegments,
    conclusionSegments,
  );

  return {
    ...item,
    description: descriptionSegments.join(" ").trim(),
    analysisConclusion: conclusionSegments.join(" ").trim() || undefined,
  };
};

export const splitEcommerceImageAnalysisTextFieldList = (
  items: EcommerceImageAnalysis[],
): EcommerceImageAnalysis[] => items.map(splitEcommerceImageAnalysisTextFields);
