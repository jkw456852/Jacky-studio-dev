import type { EcommercePlatformMode } from "../types/workflow.types";

export const ECOMMERCE_PLAN_RATIO_OPTIONS = [
  "1:1",
  "3:4",
  "4:5",
  "16:9",
  "9:16",
] as const;

export type EcommercePlanRatioOption =
  (typeof ECOMMERCE_PLAN_RATIO_OPTIONS)[number];

type ResolveRatioParams = {
  platformMode?: EcommercePlatformMode;
  typeId?: string;
  typeTitle?: string;
  itemTitle?: string;
  itemDescription?: string;
  preferredRatio?: string | null | undefined;
};

const PRIMARY_TYPE_IDS = new Set(["hero_multi", "main_image"]);
const SQUARE_TYPE_IDS = new Set(["white_bg"]);
const DETAIL_MODULE_TYPE_IDS = new Set([
  "selling_points",
  "ingredient_story",
  "steps",
  "size_hold",
  "structure",
  "feature_comparison",
]);
const SCENE_TYPE_IDS = new Set(["usage_scene", "lifestyle", "lifestyle_scene"]);
const FOCUS_VERTICAL_TYPE_IDS = new Set(["detail_highlights", "texture_demo"]);

const normalizeLookupValue = (value?: string): string =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-:|/\\(){}\[\],.;'"`~!@#$%^&*+=?<>]+/g, "");

const normalizeTextValue = (value?: string): string =>
  String(value || "")
    .trim()
    .toLowerCase();

const normalizePlanRatioValue = (
  value?: string | null,
): string | undefined => {
  const trimmed = String(value || "").trim();
  return trimmed || undefined;
};

const getPlatformPrimaryRatio = (
  platformMode?: EcommercePlatformMode,
): EcommercePlanRatioOption => {
  if (platformMode === "xiaohongshu") {
    return "3:4";
  }
  if (platformMode === "douyin") {
    return "4:5";
  }
  return "1:1";
};

const getPlatformContentRatio = (
  platformMode?: EcommercePlatformMode,
): EcommercePlanRatioOption => {
  if (platformMode === "xiaohongshu") {
    return "3:4";
  }
  return "4:5";
};

const resolveRatioTypeHint = (
  params: Omit<ResolveRatioParams, "preferredRatio" | "platformMode">,
): string | null => {
  const normalizedTypeId = normalizeLookupValue(params.typeId);
  const normalizedText = normalizeTextValue(
    [
      params.typeTitle,
      params.itemTitle,
      params.itemDescription,
      params.typeId,
    ]
      .filter(Boolean)
      .join(" "),
  );

  if (
    SQUARE_TYPE_IDS.has(normalizedTypeId) ||
    /白底|标准图|标准白底|纯白背景|商品主白底/.test(normalizedText)
  ) {
    return "white_bg";
  }

  if (
    PRIMARY_TYPE_IDS.has(normalizedTypeId) ||
    /主图|首图|封面|轮播|主视觉|hero|cover|main image/.test(normalizedText)
  ) {
    return "hero_multi";
  }

  if (
    DETAIL_MODULE_TYPE_IDS.has(normalizedTypeId) ||
    /卖点|成分|步骤|尺寸|结构|对比|参数|模块|详情页/.test(normalizedText)
  ) {
    return "detail_module";
  }

  if (
    FOCUS_VERTICAL_TYPE_IDS.has(normalizedTypeId) ||
    /细节|特写|质地|泡沫|纹理|局部|上手细节/.test(normalizedText)
  ) {
    return "focus_vertical";
  }

  if (
    SCENE_TYPE_IDS.has(normalizedTypeId) ||
    /场景|生活方式|氛围|使用情境|家居|通勤|桌面|上脸|上身/.test(normalizedText)
  ) {
    return "scene";
  }

  return normalizedTypeId || null;
};

const shouldOverridePlannerSquareRatio = (params: ResolveRatioParams): boolean => {
  const preferredRatio = normalizePlanRatioValue(params.preferredRatio);
  if (preferredRatio !== "1:1") {
    return false;
  }

  const typeHint = resolveRatioTypeHint(params);
  if (typeHint === "white_bg") {
    return false;
  }

  return (
    getDefaultEcommercePlanRatio({
      ...params,
      preferredRatio: undefined,
    }) !== "1:1"
  );
};

export const getDefaultEcommercePlanRatio = (
  params: ResolveRatioParams,
): string => {
  const preferredRatio = normalizePlanRatioValue(params.preferredRatio);
  if (preferredRatio) {
    return preferredRatio;
  }

  const typeHint = resolveRatioTypeHint(params);
  if (typeHint === "white_bg") {
    return "1:1";
  }
  if (typeHint === "hero_multi") {
    return getPlatformPrimaryRatio(params.platformMode);
  }
  if (typeHint === "detail_module") {
    return "4:5";
  }
  if (typeHint === "focus_vertical" || typeHint === "scene") {
    return getPlatformContentRatio(params.platformMode);
  }

  return getPlatformContentRatio(params.platformMode);
};

export const resolveEcommercePlanRatio = (
  params: ResolveRatioParams,
): string =>
  normalizePlanRatioValue(params.preferredRatio) ||
  getDefaultEcommercePlanRatio(params);

export const normalizePlannedEcommercePlanRatio = (
  params: ResolveRatioParams,
): string => {
  const preferredRatio = normalizePlanRatioValue(params.preferredRatio);
  if (preferredRatio && !shouldOverridePlannerSquareRatio(params)) {
    return preferredRatio;
  }

  return getDefaultEcommercePlanRatio({
    ...params,
    preferredRatio: undefined,
  });
};
