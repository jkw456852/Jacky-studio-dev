import type {
  EcommerceLayoutSnapshot,
  EcommerceOverlayBulletStyle,
  EcommerceOverlayLayer,
  EcommerceOverlayLayerKind,
  EcommerceOverlayStylePresetId,
  EcommerceOverlayTemplateId,
  EcommerceOverlayTextAlign,
  EcommerceOverlayTone,
} from "../types/workflow.types";

export type OverlayPanelBox = {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  width: number;
  height: number;
};

export type OverlaySectionKey =
  | "featureTags"
  | "stats"
  | "comparison"
  | "bullets";

export type OverlayDecorationProfile = {
  cornerStamp: string;
  compactPanel: boolean;
  minimalChrome: boolean;
  showHeaderMeta: boolean;
  showAnnotationRail: boolean;
  showSectionNumbers: boolean;
  emphasizeStatCapsules: boolean;
  emphasizeComparisonArrow: boolean;
  emphasizeBulletNumbers: boolean;
  showHeroRibbon: boolean;
  showAmbientGrid: boolean;
  showMeasurementGuides: boolean;
  showSceneBeam: boolean;
  showCompareBackdrop: boolean;
  showBottomThumbnailStrip: boolean;
};

export const OVERLAY_LAYER_KIND_ORDER: EcommerceOverlayLayerKind[] = [
  "badge",
  "headline",
  "subheadline",
  "featureTags",
  "price",
  "stats",
  "comparison",
  "bullets",
  "cta",
];

export const OVERLAY_LAYER_KIND_LABELS: Record<EcommerceOverlayLayerKind, string> = {
  badge: "角标",
  headline: "标题",
  subheadline: "副标题",
  featureTags: "图标标签",
  price: "价格模块",
  stats: "参数卡片",
  comparison: "对比模块",
  bullets: "卖点列表",
  cta: "行动按钮",
};

export const OVERLAY_STYLE_PRESET_OPTIONS: Array<{
  id: EcommerceOverlayStylePresetId;
  label: string;
  description: string;
}> = [
  {
    id: "minimal-panel",
    label: "极简信息板",
    description: "保留标题与核心说明，适合通用详情页留白区。",
  },
  {
    id: "feature-callouts",
    label: "卖点标签版",
    description: "强化标签和卖点，适合功能亮点图与首屏卖点图。",
  },
  {
    id: "spec-focus",
    label: "参数详情版",
    description: "强化价格和参数卡，更像详情页参数模块。",
  },
  {
    id: "comparison-focus",
    label: "对比说明版",
    description: "突出升级对比和结构说明，适合解释型详情图。",
  },
];

const getDefaultOverlayLayerOrder = (
  kind: EcommerceOverlayLayerKind,
): number => OVERLAY_LAYER_KIND_ORDER.indexOf(kind);

export const buildDefaultOverlayLayers = (): EcommerceOverlayLayer[] =>
  OVERLAY_LAYER_KIND_ORDER.map((kind, index) => ({
    id: kind,
    kind,
    label: OVERLAY_LAYER_KIND_LABELS[kind],
    visible: true,
    order: index,
  }));

export const normalizeOverlayLayers = (
  layers?: EcommerceOverlayLayer[] | null,
  options?: {
    visibleKinds?: EcommerceOverlayLayerKind[];
  },
): EcommerceOverlayLayer[] => {
  const visibleSet = options?.visibleKinds
    ? new Set(options.visibleKinds)
    : null;
  const inputMap = new Map<EcommerceOverlayLayerKind, EcommerceOverlayLayer>();
  (layers || []).forEach((layer) => {
    if (!layer || !OVERLAY_LAYER_KIND_ORDER.includes(layer.kind)) {
      return;
    }
    inputMap.set(layer.kind, layer);
  });
  return OVERLAY_LAYER_KIND_ORDER.map((kind, index) => {
    const existing = inputMap.get(kind);
    const defaultVisible = visibleSet ? visibleSet.has(kind) : true;
    return {
      id: existing?.id || kind,
      kind,
      label: existing?.label || OVERLAY_LAYER_KIND_LABELS[kind],
      visible: existing?.visible ?? defaultVisible,
      order:
        typeof existing?.order === "number"
          ? existing.order
          : index,
      locked: existing?.locked ?? false,
    };
  }).sort((left, right) => {
    const orderDelta = (left.order ?? 0) - (right.order ?? 0);
    if (orderDelta !== 0) return orderDelta;
    return (
      getDefaultOverlayLayerOrder(left.kind) -
      getDefaultOverlayLayerOrder(right.kind)
    );
  });
};

export const getOrderedOverlayLayers = (
  layers?: EcommerceOverlayLayer[] | null,
): EcommerceOverlayLayer[] => normalizeOverlayLayers(layers);

export const applyOverlayLayerArrangement = (
  layers: EcommerceOverlayLayer[] | null | undefined,
  arrangement: Partial<
    Record<
      EcommerceOverlayLayerKind,
      {
        visible?: boolean;
        order?: number;
      }
    >
  >,
): EcommerceOverlayLayer[] =>
  normalizeOverlayLayers(layers).map((layer) => ({
    ...layer,
    visible: arrangement[layer.kind]?.visible ?? layer.visible,
    order: arrangement[layer.kind]?.order ?? layer.order,
  })).sort((left, right) => {
    const orderDelta = (left.order ?? 0) - (right.order ?? 0);
    if (orderDelta !== 0) return orderDelta;
    return (
      getDefaultOverlayLayerOrder(left.kind) -
      getDefaultOverlayLayerOrder(right.kind)
    );
  });

export const getOverlayLayerVisibilityMap = (
  layers?: EcommerceOverlayLayer[] | null,
): Record<EcommerceOverlayLayerKind, boolean> => {
  const map = {} as Record<EcommerceOverlayLayerKind, boolean>;
  normalizeOverlayLayers(layers).forEach((layer) => {
    map[layer.kind] = layer.visible !== false;
  });
  return map;
};

const OVERLAY_STYLE_LAYER_ARRANGEMENTS: Record<
  EcommerceOverlayStylePresetId,
  Partial<
    Record<
      EcommerceOverlayLayerKind,
      {
        visible?: boolean;
        order?: number;
      }
    >
  >
> = {
  "minimal-panel": {
    badge: { visible: true, order: 0 },
    headline: { visible: true, order: 1 },
    subheadline: { visible: true, order: 2 },
    featureTags: { visible: false, order: 3 },
    price: { visible: false, order: 4 },
    stats: { visible: false, order: 5 },
    comparison: { visible: false, order: 6 },
    bullets: { visible: true, order: 7 },
    cta: { visible: true, order: 8 },
  },
  "feature-callouts": {
    badge: { visible: true, order: 0 },
    headline: { visible: true, order: 1 },
    subheadline: { visible: true, order: 2 },
    featureTags: { visible: true, order: 3 },
    bullets: { visible: true, order: 4 },
    price: { visible: false, order: 5 },
    stats: { visible: false, order: 6 },
    comparison: { visible: false, order: 7 },
    cta: { visible: true, order: 8 },
  },
  "spec-focus": {
    badge: { visible: true, order: 0 },
    headline: { visible: true, order: 1 },
    subheadline: { visible: true, order: 2 },
    price: { visible: true, order: 3 },
    stats: { visible: true, order: 4 },
    bullets: { visible: true, order: 5 },
    featureTags: { visible: true, order: 6 },
    comparison: { visible: false, order: 7 },
    cta: { visible: true, order: 8 },
  },
  "comparison-focus": {
    badge: { visible: true, order: 0 },
    headline: { visible: true, order: 1 },
    subheadline: { visible: true, order: 2 },
    comparison: { visible: true, order: 3 },
    bullets: { visible: true, order: 4 },
    featureTags: { visible: false, order: 5 },
    price: { visible: false, order: 6 },
    stats: { visible: false, order: 7 },
    cta: { visible: true, order: 8 },
  },
};

export const getOverlayStylePresetConfig = (options: {
  presetId: EcommerceOverlayStylePresetId;
  layoutMeta?: EcommerceLayoutSnapshot;
  currentTemplateId: EcommerceOverlayTemplateId;
  currentTone: EcommerceOverlayTone;
}): {
  templateId: EcommerceOverlayTemplateId;
  tone: EcommerceOverlayTone;
  textAlign: EcommerceOverlayTextAlign;
  bulletStyle: EcommerceOverlayBulletStyle;
  layerArrangement: Partial<
    Record<
      EcommerceOverlayLayerKind,
      {
        visible?: boolean;
        order?: number;
      }
    >
  >;
} => {
  const { presetId, layoutMeta, currentTemplateId, currentTone } = options;
  switch (presetId) {
    case "minimal-panel":
      return {
        templateId:
          layoutMeta?.layoutMode === "right-copy" ? "hero-right" : "hero-left",
        tone: layoutMeta?.imageRole === "parameter" ? "light" : currentTone,
        textAlign: layoutMeta?.layoutMode === "right-copy" ? "right" : "left",
        bulletStyle: "list",
        layerArrangement: OVERLAY_STYLE_LAYER_ARRANGEMENTS[presetId],
      };
    case "feature-callouts":
      return {
        templateId:
          layoutMeta?.layoutMode === "center-focus-with-edge-space"
            ? "hero-center"
            : currentTemplateId === "spec-band"
              ? "hero-left"
              : currentTemplateId,
        tone: "accent",
        textAlign: "left",
        bulletStyle: "chips",
        layerArrangement: OVERLAY_STYLE_LAYER_ARRANGEMENTS[presetId],
      };
    case "spec-focus":
      return {
        templateId: "spec-band",
        tone: "light",
        textAlign: "left",
        bulletStyle: "cards",
        layerArrangement: OVERLAY_STYLE_LAYER_ARRANGEMENTS[presetId],
      };
    case "comparison-focus":
      return {
        templateId: "hero-center",
        tone: layoutMeta?.imageRole === "comparison" ? "light" : currentTone,
        textAlign: "center",
        bulletStyle: "cards",
        layerArrangement: OVERLAY_STYLE_LAYER_ARRANGEMENTS[presetId],
      };
    default:
      return {
        templateId: currentTemplateId,
        tone: currentTone,
        textAlign: "left",
        bulletStyle: "list",
        layerArrangement: {},
      };
  }
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const getOverlayContentBalance = (options: {
  templateId: EcommerceOverlayTemplateId;
  statCount: number;
  comparisonCount: number;
  hasPrice: boolean;
  headlineLength?: number;
  subheadlineLength?: number;
  bulletCount?: number;
  featureTagCount?: number;
  hasBadge?: boolean;
  hasCta?: boolean;
}) => {
  const headlineLength = options.headlineLength || 0;
  const subheadlineLength = options.subheadlineLength || 0;
  const bulletCount = options.bulletCount || 0;
  const featureTagCount = options.featureTagCount || 0;
  const heroTemplate =
    options.templateId === "hero-left" || options.templateId === "hero-right";
  const infoDensity =
    featureTagCount * 0.6 +
    bulletCount * 0.92 +
    options.statCount * 1.2 +
    options.comparisonCount * 1.4 +
    (options.hasPrice ? 0.96 : 0) +
    (options.hasCta ? 0.22 : 0);
  const textDensity = Math.min(
    2.4,
    headlineLength * 0.055 +
      subheadlineLength * 0.026 +
      bulletCount * 0.2 +
      featureTagCount * 0.12 +
      (options.hasBadge ? 0.16 : 0) +
      (options.hasCta ? 0.1 : 0),
  );
  const contentWeight = infoDensity + textDensity;
  const compactHero =
    heroTemplate &&
    options.statCount === 0 &&
    options.comparisonCount === 0 &&
    !options.hasPrice &&
    bulletCount <= 2 &&
    featureTagCount <= 3 &&
    contentWeight <= 3.05;
  const minimalHero =
    compactHero &&
    bulletCount === 0 &&
    featureTagCount <= 2 &&
    subheadlineLength <= 48 &&
    headlineLength <= 30;

  return {
    infoDensity,
    textDensity,
    contentWeight,
    compactHero,
    minimalHero,
  };
};

export const getOverlayPanelBox = (options: {
  templateId: EcommerceOverlayTemplateId;
  statCount: number;
  comparisonCount: number;
  hasPrice: boolean;
  headlineLength?: number;
  subheadlineLength?: number;
  bulletCount?: number;
  featureTagCount?: number;
  hasBadge?: boolean;
  hasCta?: boolean;
}): OverlayPanelBox => {
  const {
    templateId,
    statCount,
    comparisonCount,
    hasPrice,
    headlineLength = 0,
    subheadlineLength = 0,
    bulletCount = 0,
    featureTagCount = 0,
    hasBadge = false,
    hasCta = false,
  } = options;
  const contentBalance = getOverlayContentBalance({
    templateId,
    statCount,
    comparisonCount,
    hasPrice,
    headlineLength,
    subheadlineLength,
    bulletCount,
    featureTagCount,
    hasBadge,
    hasCta,
  });

  if (templateId === "hero-right") {
    if (contentBalance.compactHero) {
      return {
        right: 0.05,
        top: contentBalance.minimalHero ? 0.12 : 0.1,
        width: clampNumber(
          0.4 +
            Math.min(0.1, headlineLength * 0.002 + subheadlineLength * 0.001),
          0.4,
          0.5,
        ),
        height: clampNumber(
          0.22 +
            (hasBadge ? 0.04 : 0) +
            (subheadlineLength > 0 ? 0.06 : 0) +
            Math.min(0.08, bulletCount * 0.035) +
            Math.min(0.06, featureTagCount * 0.022) +
            (hasCta ? 0.035 : 0),
          0.22,
          0.42,
        ),
      };
    }
    return {
      right: 0.06,
      top: 0.1,
      width: clampNumber(
        0.41 + Math.min(0.05, featureTagCount * 0.012 + bulletCount * 0.008),
        0.41,
        0.46,
      ),
      height: clampNumber(
        0.5 +
          Math.min(0.12, bulletCount * 0.03 + featureTagCount * 0.018) +
          (hasCta ? 0.025 : 0),
        0.5,
        0.66,
      ),
    };
  }
  if (templateId === "hero-center") {
    return {
      left: 0.14,
      top: 0.08,
      width: 0.72,
      height: 0.72,
    };
  }
  if (templateId === "spec-band") {
    return {
      left: 0.08,
      bottom: 0.07,
      width: 0.84,
      height: statCount > 0 || comparisonCount > 0 || hasPrice ? 0.38 : 0.23,
    };
  }
  if (contentBalance.compactHero) {
    return {
      left: 0.05,
      top: contentBalance.minimalHero ? 0.12 : 0.1,
      width: clampNumber(
        0.4 +
          Math.min(0.1, headlineLength * 0.002 + subheadlineLength * 0.001),
        0.4,
        0.5,
      ),
      height: clampNumber(
        0.22 +
          (hasBadge ? 0.04 : 0) +
          (subheadlineLength > 0 ? 0.06 : 0) +
          Math.min(0.08, bulletCount * 0.035) +
          Math.min(0.06, featureTagCount * 0.022) +
          (hasCta ? 0.035 : 0),
        0.22,
        0.42,
      ),
    };
  }
  return {
    left: 0.06,
    top: 0.1,
    width: clampNumber(
      0.41 + Math.min(0.05, featureTagCount * 0.012 + bulletCount * 0.008),
      0.41,
      0.46,
    ),
    height: clampNumber(
      0.5 +
        Math.min(0.12, bulletCount * 0.03 + featureTagCount * 0.018) +
        (hasCta ? 0.025 : 0),
      0.5,
      0.66,
    ),
  };
};

export const getOverlaySemanticMeta = (options: {
  templateId: EcommerceOverlayTemplateId;
  layoutMeta?: EcommerceLayoutSnapshot;
  statCount: number;
  comparisonCount: number;
  comparisonTitle?: string;
}): {
  roleLabel: string;
  layoutLabel: string;
  componentLabel: string;
  headerMetaText: string;
  comparisonTitle: string;
  featureTitle: string;
  bulletsTitle: string;
} => {
  const { templateId, layoutMeta, statCount, comparisonCount, comparisonTitle } = options;

  const roleLabel = (() => {
    switch (layoutMeta?.imageRole) {
      case "hero":
        return "主视觉卖点";
      case "selling-point":
        return "卖点说明";
      case "parameter":
        return "参数亮点";
      case "structure":
        return "结构说明";
      case "detail":
        return "细节特写";
      case "scene":
        return "场景表达";
      case "comparison":
        return "升级对比";
      case "summary":
        return "重点总结";
      default:
        return templateId === "spec-band" ? "信息版式" : "详情页版式";
    }
  })();

  const layoutLabel = (() => {
    switch (layoutMeta?.layoutMode) {
      case "top-banner":
        return "顶部横幅";
      case "left-copy":
        return "左侧文案";
      case "right-copy":
        return "右侧文案";
      case "bottom-panel":
        return "底部信息带";
      case "center-focus-with-edge-space":
        return "中心聚焦";
      case "split-info":
        return "分栏信息";
      default:
        return templateId === "hero-center" ? "居中模块" : "";
    }
  })();

  const componentLabel = (() => {
    switch (layoutMeta?.componentNeed) {
      case "text-only":
        return "文案重点";
      case "text-and-icons":
        return "图标标签";
      case "text-and-stats":
        return "图文参数";
      case "annotation-heavy":
        return "说明注释";
      case "comparison-heavy":
        return "对比信息";
      default:
        return "";
    }
  })();

  return {
    roleLabel,
    layoutLabel,
    componentLabel,
    headerMetaText: [layoutLabel, componentLabel].filter(Boolean).join(" · "),
    comparisonTitle:
      String(comparisonTitle || "").trim() || (comparisonCount > 0 ? "升级对比" : ""),
    featureTitle: statCount > 0 || comparisonCount > 0 ? "核心标签" : roleLabel,
    bulletsTitle:
      layoutMeta?.imageRole === "scene"
        ? "使用场景"
        : layoutMeta?.imageRole === "detail"
          ? "细节说明"
          : statCount > 0
            ? "补充说明"
            : "重点信息",
  };
};

export const getOverlayDecorationProfile = (options: {
  templateId: EcommerceOverlayTemplateId;
  layoutMeta?: EcommerceLayoutSnapshot;
  statCount: number;
  comparisonCount: number;
  bulletCount: number;
  featureTagCount: number;
  hasPrice?: boolean;
  hasCta?: boolean;
  hasBadge?: boolean;
  headlineLength?: number;
  subheadlineLength?: number;
  stylePresetId?: EcommerceOverlayStylePresetId | "";
}): OverlayDecorationProfile => {
  const {
    templateId,
    layoutMeta,
    statCount,
    comparisonCount,
    bulletCount,
    featureTagCount,
    hasPrice,
    hasCta,
    hasBadge,
    headlineLength,
    subheadlineLength,
  } =
    options;
  const role = layoutMeta?.imageRole || "";
  const componentNeed = layoutMeta?.componentNeed || "";
  const layoutMode = layoutMeta?.layoutMode || "";
  const reservedAreas = layoutMeta?.reservedAreas || [];

  const contentBalance = getOverlayContentBalance({
    templateId,
    statCount,
    comparisonCount,
    hasPrice: Boolean(hasPrice),
    headlineLength,
    subheadlineLength,
    bulletCount,
    featureTagCount,
    hasBadge,
    hasCta,
  });
  const infoDensity = contentBalance.infoDensity;
  const technicalScore =
    statCount * 1.26 +
    comparisonCount * 1.08 +
    (reservedAreas.includes("annotation") ? 0.8 : 0) +
    (reservedAreas.includes("stats") ? 0.65 : 0) +
    (layoutMode === "split-info" ? 0.72 : 0) +
    (layoutMode === "bottom-panel" ? 0.34 : 0) +
    (componentNeed === "annotation-heavy" ? 0.9 : 0);
  const commerceScore =
    (hasPrice ? 1.05 : 0) +
    (hasCta ? 0.55 : 0) +
    featureTagCount * 0.22 +
    bulletCount * 0.18;
  const storytellingScore =
    bulletCount * 0.26 +
    featureTagCount * 0.18 +
    (layoutMode === "center-focus-with-edge-space" ? 0.52 : 0) +
    (role === "scene" ? 0.78 : 0);
  const compactHeadline = (headlineLength || 0) > 0 && (headlineLength || 0) <= 26;
  const compactPanel = contentBalance.compactHero;
  const minimalChrome =
    compactPanel &&
    comparisonCount === 0 &&
    technicalScore < 1.4 &&
    infoDensity < 2.35;

  const cornerStamp = (() => {
    if (minimalChrome) return "";
    switch (role) {
      case "parameter":
        return "PARAM";
      case "structure":
        return "STRUCT";
      case "detail":
        return "DETAIL";
      case "comparison":
        return "VS";
      case "scene":
        return "SCENE";
      case "hero":
        return "HERO";
      case "summary":
        return "SUMMARY";
      default:
        return templateId === "spec-band" ? "INFO" : "DETAIL";
    }
  })();

  return {
    cornerStamp,
    compactPanel,
    minimalChrome,
    showHeaderMeta:
      !minimalChrome &&
      Boolean(role || layoutMode || componentNeed) &&
      (templateId === "spec-band" ||
        technicalScore >= 0.9 ||
        infoDensity >= 2.15 ||
        role === "detail" ||
        role === "parameter" ||
        role === "comparison"),
    showAnnotationRail:
      !minimalChrome &&
      (technicalScore >= 2 ||
        comparisonCount > 0 ||
        role === "structure" ||
        role === "detail"),
    showSectionNumbers: !compactPanel && infoDensity >= 2.7,
    emphasizeStatCapsules:
      statCount > 0 && (technicalScore >= 1.7 || templateId === "spec-band"),
    emphasizeComparisonArrow: comparisonCount > 0,
    emphasizeBulletNumbers:
      bulletCount > 0 &&
      (technicalScore >= 1.35 ||
        infoDensity >= 3.4 ||
        templateId === "hero-right"),
    showHeroRibbon:
      !minimalChrome &&
      compactHeadline &&
      infoDensity <= 3.1 &&
      commerceScore >= 0.45 &&
      Boolean(hasBadge || featureTagCount > 0),
    showAmbientGrid: !compactPanel && (technicalScore >= 1.55 || comparisonCount > 0),
    showMeasurementGuides: !compactPanel && technicalScore >= 2.25,
    showSceneBeam:
      !compactPanel &&
      (comparisonCount > 0 || (storytellingScore >= 1.08 && templateId !== "spec-band")),
    showCompareBackdrop: comparisonCount > 0,
    showBottomThumbnailStrip:
      !compactPanel &&
      templateId !== "spec-band" &&
      infoDensity >= 2.45 &&
      compactHeadline &&
      (commerceScore >= 0.9 || bulletCount + featureTagCount >= 3),
  };
};

export const buildOverlaySectionOrder = (options: {
  hasFeatureTags: boolean;
  hasStats: boolean;
  hasComparison: boolean;
  hasBullets: boolean;
}): Record<OverlaySectionKey, number | undefined> => {
  const order: Record<OverlaySectionKey, number | undefined> = {
    featureTags: undefined,
    stats: undefined,
    comparison: undefined,
    bullets: undefined,
  };
  const sequence: OverlaySectionKey[] = [];
  if (options.hasFeatureTags) sequence.push("featureTags");
  if (options.hasStats) sequence.push("stats");
  if (options.hasComparison) sequence.push("comparison");
  if (options.hasBullets) sequence.push("bullets");
  sequence.forEach((key, index) => {
    order[key] = index + 1;
  });
  return order;
};

export const getSmartOverlayPreset = (options: {
  layoutMeta?: EcommerceLayoutSnapshot;
  bulletCount: number;
  featureTagCount: number;
  statCount: number;
  comparisonCount: number;
  hasPrice: boolean;
  headlineLength: number;
  currentTemplateId: EcommerceOverlayTemplateId;
  currentTone: EcommerceOverlayTone;
}): {
  templateId: EcommerceOverlayTemplateId;
  tone: EcommerceOverlayTone;
  textAlign: EcommerceOverlayTextAlign;
  bulletStyle: EcommerceOverlayBulletStyle;
} => {
  const {
    layoutMeta,
    bulletCount,
    featureTagCount,
    statCount,
    comparisonCount,
    hasPrice,
    headlineLength,
    currentTemplateId,
    currentTone,
  } = options;
  const role = layoutMeta?.imageRole || "";
  const componentNeed = layoutMeta?.componentNeed || "";
  const layoutMode = layoutMeta?.layoutMode || "";
  const heroTemplateId =
    layoutMode === "right-copy"
      ? "hero-right"
      : layoutMode === "center-focus-with-edge-space" && comparisonCount > 0
        ? "hero-center"
        : "hero-left";
  const contentBalance = getOverlayContentBalance({
    templateId: heroTemplateId,
    statCount,
    comparisonCount,
    hasPrice,
    headlineLength,
    bulletCount,
    featureTagCount,
  });

  const templateId =
    statCount > 0 ||
    hasPrice ||
    componentNeed === "text-and-stats" ||
    role === "parameter" ||
    role === "detail"
      ? "spec-band"
      : comparisonCount > 0 || componentNeed === "comparison-heavy" || role === "comparison"
        ? "hero-center"
        : componentNeed === "annotation-heavy"
          ? "hero-right"
          : role === "hero" || role === "scene"
            ? heroTemplateId
            : currentTemplateId;

  const tone =
    statCount > 0 || hasPrice || role === "parameter" || role === "structure"
      ? "light"
      : contentBalance.compactHero && (role === "hero" || role === "scene")
        ? "light"
        : featureTagCount > 0 || componentNeed === "text-and-icons"
        ? "accent"
        : currentTone;

  const textAlign =
    templateId === "hero-center"
      ? "center"
      : templateId === "hero-right"
        ? "right"
        : "left";

  const bulletStyle =
    statCount > 0
      ? "cards"
      : bulletCount >= 3
        ? templateId === "spec-band"
          ? "chips"
          : "cards"
        : featureTagCount >= 3 || headlineLength <= 14
          ? "chips"
          : "list";

  return {
    templateId,
    tone,
    textAlign,
    bulletStyle,
  };
};
