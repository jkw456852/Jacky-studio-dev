import {
  getOverlayLayerVisibilityMap,
  getOverlayPanelBox,
} from "./ecommerce-overlay-layout";
import {
  inferLegacyPromptProfile,
  type LegacyPromptProfileId,
} from "./ecommerce-old-flow-template-library";
import type {
  EcommerceLayoutAreaKind,
  EcommerceLayoutSnapshot,
  EcommerceOverlayComparisonRow,
  EcommerceOverlayLayerKind,
  EcommerceOverlayReplacementProfileId,
  EcommerceOverlayReplacementQuality,
  EcommerceOverlayState,
  EcommerceOverlayStat,
  EcommerceOverlayTextAlign,
  EcommerceTextContainerIntent,
} from "../types/workflow.types";

export type EcommerceTextAnchorHint = {
  text?: string;
  role?: EcommerceOverlayLayerKind | "unknown";
  x: number;
  y: number;
  width: number;
  height: number;
  align?: EcommerceOverlayTextAlign;
  confidence?: number;
};

export type EcommerceTextLayerBlueprint = {
  id: string;
  role: EcommerceOverlayLayerKind;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: number;
  fillColor: string;
  textAlign: EcommerceOverlayTextAlign;
  lineHeight: number;
  letterSpacing: number;
};

export type EcommerceReplacementBox = {
  role: EcommerceOverlayLayerKind;
  roles?: EcommerceOverlayLayerKind[];
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
  source?: "placed" | "anchor" | "merged";
};

export type EcommerceReplacementPlanningSummary = {
  profileId?: EcommerceOverlayReplacementProfileId;
  sourceMode?: EcommerceOverlayReplacementQuality["sourceMode"];
  confidence?: EcommerceOverlayReplacementQuality["confidence"];
  anchorCount: number;
  replacementBoxCount: number;
  mergedBoxCount: number;
  summary: string;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ReplacementRoleFamily = "headline" | "info" | "action";

type RegionKey =
  | "meta"
  | "hero"
  | "sub"
  | "body"
  | "price"
  | "comparison"
  | "cta";

type RegionMap = Record<RegionKey, Rect>;

const clampNumber = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const shrinkRect = (rect: Rect, paddingX: number, paddingY = paddingX): Rect => ({
  x: rect.x + paddingX,
  y: rect.y + paddingY,
  width: Math.max(1, rect.width - paddingX * 2),
  height: Math.max(1, rect.height - paddingY * 2),
});

const expandRect = (
  rect: Rect,
  paddingX: number,
  paddingY: number,
  canvasWidth: number,
  canvasHeight: number,
): Rect => {
  const x = clampNumber(rect.x - paddingX, 0, canvasWidth);
  const y = clampNumber(rect.y - paddingY, 0, canvasHeight);
  const right = clampNumber(rect.x + rect.width + paddingX, 0, canvasWidth);
  const bottom = clampNumber(rect.y + rect.height + paddingY, 0, canvasHeight);
  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  };
};

const unionRects = (left: Rect, right: Rect): Rect => {
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  const maxX = Math.max(left.x + left.width, right.x + right.width);
  const maxY = Math.max(left.y + left.height, right.y + right.height);
  return {
    x,
    y,
    width: Math.max(1, maxX - x),
    height: Math.max(1, maxY - y),
  };
};

const getReplacementRoleFamily = (
  role: EcommerceOverlayLayerKind,
): ReplacementRoleFamily => {
  switch (role) {
    case "price":
    case "cta":
      return "action";
    case "stats":
    case "comparison":
    case "bullets":
      return "info";
    case "badge":
    case "headline":
    case "subheadline":
    case "featureTags":
    default:
      return "headline";
  }
};

const normalizeReplacementProfileId = (
  profile: LegacyPromptProfileId,
): EcommerceOverlayReplacementProfileId => {
  switch (profile) {
    case "white-bg":
      return "white-bg";
    case "selling":
      return "selling";
    case "comparison":
      return "comparison";
    case "spec":
      return "spec";
    case "detail":
      return "detail";
    case "scene":
      return "scene";
    case "conversion":
      return "conversion";
    case "hero":
    default:
      return "hero";
  }
};

const resolveReplacementProfileId = (options: {
  overlayState: EcommerceOverlayState;
  layoutMeta?: EcommerceLayoutSnapshot;
}): EcommerceOverlayReplacementProfileId => {
  const { overlayState, layoutMeta } = options;
  const inferred = inferLegacyPromptProfile({
    groupTitle: layoutMeta?.typeTitle || "",
    title: layoutMeta?.typeTitle || "",
    description: layoutMeta?.typeId || "",
    imageRole: layoutMeta?.imageRole,
    marketingGoal:
      overlayState.headline ||
      overlayState.subheadline ||
      overlayState.comparisonTitle ||
      "",
    keyMessage:
      [
        ...(overlayState.featureTags || []),
        ...(overlayState.bullets || []),
        overlayState.priceValue,
        overlayState.cta,
      ]
        .filter(Boolean)
        .join(" "),
  });
  return normalizeReplacementProfileId(inferred);
};

const getRoleAwareReplacementMetrics = (options: {
  profileId: EcommerceOverlayReplacementProfileId;
  role: EcommerceOverlayLayerKind;
  rect: Rect;
  canvasWidth: number;
  canvasHeight: number;
}) => {
  const { profileId, role, rect, canvasWidth, canvasHeight } = options;
  const minSide = Math.min(canvasWidth, canvasHeight);
  const baseX = Math.max(10, minSide * 0.012);
  const baseY = Math.max(8, minSide * 0.01);
  const profileScale =
    profileId === "hero"
      ? { x: 1.18, y: 1.16, radius: 1.12 }
      : profileId === "selling"
        ? { x: 1.1, y: 1.14, radius: 1.08 }
        : profileId === "comparison"
          ? { x: 1.04, y: 1.08, radius: 1.04 }
          : profileId === "spec"
            ? { x: 0.92, y: 1.02, radius: 0.95 }
            : profileId === "detail"
              ? { x: 0.9, y: 0.94, radius: 0.92 }
              : profileId === "scene"
                ? { x: 1.12, y: 1.2, radius: 1.1 }
                : profileId === "white-bg"
                  ? { x: 0.9, y: 0.96, radius: 0.9 }
                  : { x: 1, y: 1, radius: 1 };
  const applyScale = (metrics: {
    paddingX: number;
    paddingY: number;
    radius: number;
  }) => ({
    paddingX: Math.round(metrics.paddingX * profileScale.x),
    paddingY: Math.round(metrics.paddingY * profileScale.y),
    radius: Math.round(metrics.radius * profileScale.radius),
  });

  switch (role) {
    case "headline":
      return applyScale({
        paddingX: clampNumber(Math.max(baseX * 1.6, rect.width * 0.08), 12, 48),
        paddingY: clampNumber(Math.max(baseY * 1.9, rect.height * 0.42), 10, 42),
        radius: clampNumber(Math.max(14, rect.height * 0.42), 10, 40),
      });
    case "subheadline":
      return applyScale({
        paddingX: clampNumber(Math.max(baseX * 1.35, rect.width * 0.07), 10, 40),
        paddingY: clampNumber(Math.max(baseY * 1.55, rect.height * 0.32), 8, 32),
        radius: clampNumber(Math.max(12, rect.height * 0.36), 8, 32),
      });
    case "badge":
    case "featureTags":
      return applyScale({
        paddingX: clampNumber(Math.max(baseX * 1.2, rect.width * 0.1), 9, 28),
        paddingY: clampNumber(Math.max(baseY * 1.3, rect.height * 0.34), 8, 24),
        radius: clampNumber(Math.max(10, rect.height * 0.55), 8, 26),
      });
    case "price":
      return applyScale({
        paddingX: clampNumber(Math.max(baseX * 1.5, rect.width * 0.1), 12, 40),
        paddingY: clampNumber(Math.max(baseY * 1.7, rect.height * 0.34), 10, 32),
        radius: clampNumber(Math.max(12, rect.height * 0.38), 10, 34),
      });
    case "cta":
      return applyScale({
        paddingX: clampNumber(Math.max(baseX * 1.8, rect.width * 0.14), 14, 44),
        paddingY: clampNumber(Math.max(baseY * 1.8, rect.height * 0.5), 10, 28),
        radius: clampNumber(Math.max(16, rect.height * 0.72), 12, 36),
      });
    case "stats":
    case "comparison":
    case "bullets":
      return applyScale({
        paddingX: clampNumber(Math.max(baseX * 1.05, rect.width * 0.05), 8, 26),
        paddingY: clampNumber(Math.max(baseY * 1.25, rect.height * 0.22), 8, 24),
        radius: clampNumber(Math.max(10, rect.height * 0.26), 8, 22),
      });
    default:
      return applyScale({
        paddingX: clampNumber(Math.max(baseX, rect.width * 0.06), 8, 28),
        paddingY: clampNumber(Math.max(baseY, rect.height * 0.22), 8, 24),
        radius: clampNumber(Math.max(10, rect.height * 0.3), 8, 24),
      });
  }
};

const getRectOverlap = (left: Rect, right: Rect) => ({
  x: Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x),
  ),
  y: Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y),
  ),
});

const getRectGap = (left: Rect, right: Rect) => ({
  x: Math.max(
    0,
    Math.max(left.x, right.x) -
      Math.min(left.x + left.width, right.x + right.width),
  ),
  y: Math.max(
    0,
    Math.max(left.y, right.y) -
      Math.min(left.y + left.height, right.y + right.height),
  ),
});

const toAbsolutePanelRect = (
  panelBox: ReturnType<typeof getOverlayPanelBox>,
  width: number,
  height: number,
): Rect => {
  const panelWidth = panelBox.width * width;
  const panelHeight = panelBox.height * height;
  const panelX =
    typeof panelBox.left === "number"
      ? panelBox.left * width
      : width - panelWidth - (panelBox.right || 0) * width;
  const panelY =
    typeof panelBox.top === "number"
      ? panelBox.top * height
      : height - panelHeight - (panelBox.bottom || 0) * height;

  return {
    x: panelX,
    y: panelY,
    width: panelWidth,
    height: panelHeight,
  };
};

const estimateTextWidth = (text: string, fontSize: number, letterSpacing = 0) =>
  Math.max(
    fontSize * 0.8,
    Array.from(String(text || "")).length * (fontSize * 0.58 + letterSpacing),
  );

const splitTextLines = (
  text: string,
  maxCharsPerLine: number,
  maxLines: number,
): string[] => {
  const source = String(text || "").replace(/\s+/g, " ").trim();
  if (!source) return [];
  if (source.length <= maxCharsPerLine) return [source];

  const lines: string[] = [];
  let remaining = source;
  while (remaining && lines.length < maxLines) {
    if (remaining.length <= maxCharsPerLine) {
      lines.push(remaining);
      remaining = "";
      break;
    }

    let cut = maxCharsPerLine;
    const slice = remaining.slice(0, maxCharsPerLine + 1);
    const lastSpace = slice.lastIndexOf(" ");
    if (lastSpace >= Math.floor(maxCharsPerLine * 0.45)) {
      cut = lastSpace;
    }

    lines.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining && lines.length > 0) {
    lines[lines.length - 1] = `${lines[lines.length - 1].slice(
      0,
      Math.max(1, lines[lines.length - 1].length - 1),
    )}...`;
  }

  return lines.filter(Boolean);
};

const fitTextToRegion = (options: {
  text: string;
  width: number;
  initialFontSize: number;
  minFontSize: number;
  maxLines: number;
}): {
  fontSize: number;
  maxCharsPerLine: number;
  lines: string[];
} => {
  let fontSize = options.initialFontSize;
  while (fontSize > options.minFontSize) {
    const maxCharsPerLine = Math.max(
      4,
      Math.floor(options.width / Math.max(8, fontSize * 0.92)),
    );
    const lines = splitTextLines(options.text, maxCharsPerLine, options.maxLines);
    if (lines.length <= options.maxLines) {
      return {
        fontSize,
        maxCharsPerLine,
        lines,
      };
    }
    fontSize -= 2;
  }

  const maxCharsPerLine = Math.max(
    4,
    Math.floor(options.width / Math.max(8, options.minFontSize * 0.92)),
  );
  return {
    fontSize: options.minFontSize,
    maxCharsPerLine,
    lines: splitTextLines(options.text, maxCharsPerLine, options.maxLines),
  };
};

const buildColorPalette = (tone?: EcommerceOverlayState["tone"]) => {
  switch (tone) {
    case "light":
      return {
        primary: "#111827",
        secondary: "#374151",
        accent: "#B45309",
      };
    case "accent":
      return {
        primary: "#FFFFFF",
        secondary: "#FDE68A",
        accent: "#FDBA74",
      };
    case "dark":
    default:
      return {
        primary: "#FFFFFF",
        secondary: "#E5E7EB",
        accent: "#F59E0B",
      };
  }
};

const shouldIncludeRole = (
  visibilityMap: ReturnType<typeof getOverlayLayerVisibilityMap>,
  role: EcommerceOverlayLayerKind,
) => visibilityMap[role] !== false;

const collectTextContent = (overlayState: EcommerceOverlayState) => {
  const stats = (overlayState.stats || []).filter(
    (item): item is EcommerceOverlayStat =>
      Boolean(String(item?.label || "").trim() || String(item?.value || "").trim()),
  );
  const comparisonRows = (overlayState.comparisonRows || []).filter(
    (item): item is EcommerceOverlayComparisonRow =>
      Boolean(
        String(item?.label || "").trim() ||
          String(item?.before || "").trim() ||
          String(item?.after || "").trim(),
      ),
  );

  return {
    featureTags: (overlayState.featureTags || []).filter(Boolean).slice(0, 4),
    bullets: (overlayState.bullets || []).filter(Boolean).slice(0, 4),
    stats: stats.slice(0, 4),
    comparisonRows: comparisonRows.slice(0, 4),
  };
};

const buildBaseRegions = (options: {
  overlayState: EcommerceOverlayState;
  layoutMeta?: EcommerceLayoutSnapshot;
  panelRect: Rect;
}): RegionMap => {
  const { overlayState, layoutMeta, panelRect } = options;
  const templateId = overlayState.templateId || "hero-left";
  const layoutMode = layoutMeta?.layoutMode || "";
  const basePad = Math.max(12, panelRect.width * 0.05);
  const inner = shrinkRect(panelRect, basePad, Math.max(10, panelRect.height * 0.05));
  const leftHeavy = templateId === "hero-left" || layoutMode === "left-copy";
  const rightHeavy = templateId === "hero-right" || layoutMode === "right-copy";

  if (templateId === "spec-band" || layoutMode === "bottom-panel") {
    return {
      meta: {
        x: inner.x,
        y: inner.y,
        width: inner.width * 0.48,
        height: inner.height * 0.14,
      },
      hero: {
        x: inner.x,
        y: inner.y + inner.height * 0.16,
        width: inner.width * 0.52,
        height: inner.height * 0.26,
      },
      sub: {
        x: inner.x,
        y: inner.y + inner.height * 0.4,
        width: inner.width * 0.52,
        height: inner.height * 0.12,
      },
      body: {
        x: inner.x,
        y: inner.y + inner.height * 0.55,
        width: inner.width * 0.6,
        height: inner.height * 0.28,
      },
      price: {
        x: inner.x + inner.width * 0.67,
        y: inner.y + inner.height * 0.18,
        width: inner.width * 0.25,
        height: inner.height * 0.34,
      },
      comparison: {
        x: inner.x + inner.width * 0.67,
        y: inner.y + inner.height * 0.54,
        width: inner.width * 0.25,
        height: inner.height * 0.2,
      },
      cta: {
        x: inner.x + inner.width * 0.67,
        y: inner.y + inner.height * 0.78,
        width: inner.width * 0.24,
        height: inner.height * 0.12,
      },
    };
  }

  if (templateId === "hero-center" || layoutMode === "center-focus-with-edge-space") {
    return {
      meta: {
        x: inner.x + inner.width * 0.15,
        y: inner.y,
        width: inner.width * 0.7,
        height: inner.height * 0.12,
      },
      hero: {
        x: inner.x + inner.width * 0.12,
        y: inner.y + inner.height * 0.16,
        width: inner.width * 0.76,
        height: inner.height * 0.2,
      },
      sub: {
        x: inner.x + inner.width * 0.14,
        y: inner.y + inner.height * 0.38,
        width: inner.width * 0.72,
        height: inner.height * 0.12,
      },
      body: {
        x: inner.x + inner.width * 0.14,
        y: inner.y + inner.height * 0.52,
        width: inner.width * 0.72,
        height: inner.height * 0.2,
      },
      price: {
        x: inner.x + inner.width * 0.24,
        y: inner.y + inner.height * 0.5,
        width: inner.width * 0.52,
        height: inner.height * 0.16,
      },
      comparison: {
        x: inner.x + inner.width * 0.14,
        y: inner.y + inner.height * 0.54,
        width: inner.width * 0.72,
        height: inner.height * 0.2,
      },
      cta: {
        x: inner.x + inner.width * 0.28,
        y: inner.y + inner.height * 0.8,
        width: inner.width * 0.44,
        height: inner.height * 0.1,
      },
    };
  }

  if (layoutMode === "split-info") {
    const infoX = rightHeavy ? inner.x + inner.width * 0.54 : inner.x;
    return {
      meta: {
        x: infoX,
        y: inner.y,
        width: inner.width * 0.42,
        height: inner.height * 0.12,
      },
      hero: {
        x: infoX,
        y: inner.y + inner.height * 0.15,
        width: inner.width * 0.42,
        height: inner.height * 0.24,
      },
      sub: {
        x: infoX,
        y: inner.y + inner.height * 0.4,
        width: inner.width * 0.42,
        height: inner.height * 0.12,
      },
      body: {
        x: infoX,
        y: inner.y + inner.height * 0.54,
        width: inner.width * 0.42,
        height: inner.height * 0.22,
      },
      price: {
        x: infoX,
        y: inner.y + inner.height * 0.56,
        width: inner.width * 0.42,
        height: inner.height * 0.18,
      },
      comparison: {
        x: infoX,
        y: inner.y + inner.height * 0.56,
        width: inner.width * 0.42,
        height: inner.height * 0.22,
      },
      cta: {
        x: infoX,
        y: inner.y + inner.height * 0.82,
        width: inner.width * 0.3,
        height: inner.height * 0.1,
      },
    };
  }

  const infoX = rightHeavy
    ? inner.x + inner.width * 0.5
    : leftHeavy
      ? inner.x
      : inner.x + inner.width * 0.08;
  const infoWidth = rightHeavy || leftHeavy ? inner.width * 0.42 : inner.width * 0.58;

  return {
    meta: {
      x: infoX,
      y: inner.y,
      width: infoWidth,
      height: inner.height * 0.12,
    },
    hero: {
      x: infoX,
      y: inner.y + inner.height * 0.16,
      width: infoWidth,
      height: inner.height * 0.22,
    },
    sub: {
      x: infoX,
      y: inner.y + inner.height * 0.39,
      width: infoWidth,
      height: inner.height * 0.12,
    },
    body: {
      x: infoX,
      y: inner.y + inner.height * 0.54,
      width: infoWidth,
      height: inner.height * 0.22,
    },
    price: {
      x: infoX,
      y: inner.y + inner.height * 0.54,
      width: infoWidth,
      height: inner.height * 0.18,
    },
    comparison: {
      x: infoX,
      y: inner.y + inner.height * 0.54,
      width: infoWidth,
      height: inner.height * 0.22,
    },
    cta: {
      x: infoX,
      y: inner.y + inner.height * 0.82,
      width: infoWidth * 0.6,
      height: inner.height * 0.1,
    },
  };
};

const getDefaultRegionForArea = (area: EcommerceLayoutAreaKind): RegionKey => {
  switch (area) {
    case "headline":
      return "hero";
    case "subheadline":
      return "sub";
    case "stats":
      return "body";
    case "icons":
      return "meta";
    case "comparison":
      return "comparison";
    case "annotation":
      return "meta";
    case "body":
    default:
      return "body";
  }
};

const getDefaultRegionForRole = (role: EcommerceOverlayLayerKind): RegionKey => {
  switch (role) {
    case "badge":
    case "featureTags":
      return "meta";
    case "headline":
      return "hero";
    case "subheadline":
      return "sub";
    case "price":
      return "price";
    case "stats":
      return "body";
    case "comparison":
      return "comparison";
    case "bullets":
      return "body";
    case "cta":
      return "cta";
    default:
      return "body";
  }
};

const normalizeAnchorRect = (
  anchor: EcommerceTextAnchorHint,
  canvasWidth: number,
  canvasHeight: number,
): Rect => ({
  x: clampNumber(anchor.x, 0, 1) * canvasWidth,
  y: clampNumber(anchor.y, 0, 1) * canvasHeight,
  width: clampNumber(anchor.width, 0.02, 1) * canvasWidth,
  height: clampNumber(anchor.height, 0.02, 1) * canvasHeight,
});

const buildRoleTextCorpus = (
  overlayState: EcommerceOverlayState,
  role: EcommerceOverlayLayerKind,
) => {
  switch (role) {
    case "badge":
      return [overlayState.badge];
    case "headline":
      return [overlayState.headline];
    case "subheadline":
      return [overlayState.subheadline];
    case "price":
      return [overlayState.priceLabel, overlayState.priceValue, overlayState.priceNote];
    case "featureTags":
      return overlayState.featureTags || [];
    case "stats":
      return (overlayState.stats || []).flatMap((item) => [item.label, item.value]);
    case "comparison":
      return [
        overlayState.comparisonTitle,
        ...(overlayState.comparisonRows || []).flatMap((item) => [
          item.label,
          item.before,
          item.after,
        ]),
      ];
    case "bullets":
      return overlayState.bullets || [];
    case "cta":
      return [overlayState.cta];
    default:
      return [];
  }
};

const scoreTextSimilarity = (left: string, right: string) => {
  const a = Array.from(String(left || "").replace(/\s+/g, "").toLowerCase());
  const b = Array.from(String(right || "").replace(/\s+/g, "").toLowerCase());
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const overlap = a.filter((char) => setB.has(char)).length;
  return overlap / Math.max(a.length, b.length);
};

const findBestAnchorForRole = (options: {
  role: EcommerceOverlayLayerKind;
  overlayState: EcommerceOverlayState;
  anchorHints: EcommerceTextAnchorHint[];
  targetRect?: Rect;
  canvasWidth?: number;
  canvasHeight?: number;
}) => {
  const { role, overlayState, anchorHints, targetRect, canvasWidth, canvasHeight } =
    options;
  const corpus = buildRoleTextCorpus(overlayState, role)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  let best: EcommerceTextAnchorHint | null = null;
  let bestScore = 0;

  anchorHints.forEach((anchor) => {
    let score = 0;
    if (anchor.role === role) {
      score += 1.1;
    } else if (
      (role === "headline" || role === "subheadline") &&
      (anchor.role === "headline" || anchor.role === "subheadline")
    ) {
      score += 0.34;
    } else if (
      (role === "featureTags" ||
        role === "stats" ||
        role === "comparison" ||
        role === "bullets") &&
      (anchor.role === "featureTags" ||
        anchor.role === "stats" ||
        anchor.role === "comparison" ||
        anchor.role === "bullets")
    ) {
      score += 0.24;
    } else if (anchor.role === "unknown") {
      score += 0.12;
    }
    if (role === "headline" && anchor.height >= 0.08) score += 0.25;
    if (role === "subheadline" && anchor.height < 0.12) score += 0.12;
    if (role === "cta" && anchor.width <= 0.45) score += 0.16;
    if (role === "price" && anchor.width <= 0.38) score += 0.14;
    if (anchor.confidence) score += clampNumber(anchor.confidence, 0, 1) * 0.35;

    if (targetRect && canvasWidth && canvasHeight) {
      const anchorRect = normalizeAnchorRect(anchor, canvasWidth, canvasHeight);
      const overlap = getRectOverlap(anchorRect, targetRect);
      const gap = getRectGap(anchorRect, targetRect);
      const overlapRatio =
        (overlap.x * overlap.y) /
        Math.max(
          1,
          Math.min(
            anchorRect.width * anchorRect.height,
            targetRect.width * targetRect.height,
          ),
        );
      const centerGapX =
        Math.abs(
          anchorRect.x + anchorRect.width / 2 - (targetRect.x + targetRect.width / 2),
        ) / Math.max(1, canvasWidth);
      const centerGapY =
        Math.abs(
          anchorRect.y + anchorRect.height / 2 - (targetRect.y + targetRect.height / 2),
        ) / Math.max(1, canvasHeight);
      score += Math.min(0.4, overlapRatio * 0.55);
      if (gap.x <= canvasWidth * 0.04) score += 0.06;
      if (gap.y <= canvasHeight * 0.05) score += 0.09;
      score += Math.max(0, 0.18 - centerGapX * 0.22);
      score += Math.max(0, 0.2 - centerGapY * 0.24);
    }

    if (anchor.text && corpus.length > 0) {
      score += Math.max(
        ...corpus.map((item) => scoreTextSimilarity(item, String(anchor.text || ""))),
      );
    }

    if (score > bestScore) {
      best = anchor;
      bestScore = score;
    }
  });

  return bestScore >= 0.42 ? best : null;
};

const mergeRectWithAnchor = (
  rect: Rect,
  anchor: EcommerceTextAnchorHint | null,
  canvasWidth: number,
  canvasHeight: number,
): Rect => {
  if (!anchor) return rect;
  const anchorRect = normalizeAnchorRect(anchor, canvasWidth, canvasHeight);
  const merged = unionRects(rect, anchorRect);
  const expandX = Math.max(10, anchorRect.width * 0.08);
  const expandY = Math.max(8, anchorRect.height * 0.12);
  return expandRect(merged, expandX, expandY, canvasWidth, canvasHeight);
};

const findIntentForRole = (
  intents: EcommerceTextContainerIntent[] | undefined,
  role: EcommerceOverlayLayerKind,
) => intents?.find((item) => item.role === role);

const getRegionForRole = (
  regions: RegionMap,
  role: EcommerceOverlayLayerKind,
  intents: EcommerceTextContainerIntent[] | undefined,
) => {
  const intent = findIntentForRole(intents, role);
  const regionKey = intent?.area
    ? getDefaultRegionForArea(intent.area)
    : getDefaultRegionForRole(role);
  return {
    rect: regions[regionKey],
    intent,
    regionKey,
  };
};

const getPlacementForRole = (options: {
  regions: RegionMap;
  role: EcommerceOverlayLayerKind;
  intents: EcommerceTextContainerIntent[] | undefined;
  overlayState: EcommerceOverlayState;
  anchorHints: EcommerceTextAnchorHint[];
  canvasWidth: number;
  canvasHeight: number;
  defaultAlign: EcommerceOverlayTextAlign;
}) => {
  const {
    regions,
    role,
    intents,
    overlayState,
    anchorHints,
    canvasWidth,
    canvasHeight,
    defaultAlign,
  } = options;
  const placement = getRegionForRole(regions, role, intents);
  const anchor = findBestAnchorForRole({
    role,
    overlayState,
    anchorHints,
    targetRect: placement.rect,
    canvasWidth,
    canvasHeight,
  });
  const rect = mergeRectWithAnchor(
    placement.rect,
    anchor,
    canvasWidth,
    canvasHeight,
  );

  return {
    ...placement,
    rect,
    anchor,
    cursorKey: anchor ? `anchor:${role}` : `region:${placement.regionKey}`,
    align: anchor?.align || placement.intent?.textAlign || defaultAlign,
  };
};

const computeTextX = (
  rect: Rect,
  contentWidth: number,
  align: EcommerceOverlayTextAlign,
) => {
  if (align === "center") {
    return rect.x + (rect.width - contentWidth) / 2;
  }
  if (align === "right") {
    return rect.x + rect.width - contentWidth;
  }
  return rect.x;
};

const shouldMergeReplacementBoxes = (
  profileId: EcommerceOverlayReplacementProfileId,
  left: EcommerceReplacementBox,
  right: EcommerceReplacementBox,
) => {
  const overlap = getRectOverlap(left, right);
  const gap = getRectGap(left, right);
  if (overlap.x > 0 && overlap.y > 0) {
    return true;
  }

  const sameFamily =
    getReplacementRoleFamily(left.role) === getReplacementRoleFamily(right.role);
  if (!sameFamily) {
    return false;
  }

  const minWidth = Math.min(left.width, right.width);
  const minHeight = Math.min(left.height, right.height);
  const horizontalGapThreshold =
    profileId === "hero" || profileId === "scene"
      ? Math.max(16, minWidth * 0.28)
      : profileId === "comparison" || profileId === "spec"
        ? Math.max(10, minWidth * 0.18)
        : Math.max(12, minWidth * 0.24);
  const verticalGapThreshold =
    profileId === "hero" || profileId === "scene"
      ? Math.max(14, minHeight * 0.95)
      : profileId === "comparison" || profileId === "spec"
        ? Math.max(8, minHeight * 0.65)
        : Math.max(10, minHeight * 0.8);

  if (
    overlap.x > Math.min(left.width, right.width) * 0.22 &&
    gap.y <= verticalGapThreshold
  ) {
    return true;
  }

  if (
    overlap.y > Math.min(left.height, right.height) * 0.18 &&
    gap.x <= horizontalGapThreshold
  ) {
    return true;
  }

  return false;
};

const mergeReplacementBoxes = (
  profileId: EcommerceOverlayReplacementProfileId,
  boxes: EcommerceReplacementBox[],
): EcommerceReplacementBox[] => {
  const queue = [...boxes].sort((left, right) =>
    left.y === right.y ? left.x - right.x : left.y - right.y,
  );
  const merged: EcommerceReplacementBox[] = [];

  while (queue.length > 0) {
    let current = queue.shift()!;
    let changed = true;
    while (changed) {
      changed = false;
      for (let index = 0; index < queue.length; index += 1) {
        const candidate = queue[index];
        if (!shouldMergeReplacementBoxes(profileId, current, candidate)) {
          continue;
        }

        const combined = unionRects(current, candidate);
        current = {
          role:
            current.width * current.height >= candidate.width * candidate.height
              ? current.role
              : candidate.role,
          roles: Array.from(
            new Set([...(current.roles || [current.role]), ...(candidate.roles || [candidate.role])]),
          ),
          x: combined.x,
          y: combined.y,
          width: combined.width,
          height: combined.height,
          radius: Math.max(current.radius || 0, candidate.radius || 0),
          source: "merged",
        };
        queue.splice(index, 1);
        changed = true;
        break;
      }
    }
    merged.push(current);
  }

  return merged;
};

export const buildEcommerceTextLayerPlan = (options: {
  overlayState: EcommerceOverlayState;
  layoutMeta?: EcommerceLayoutSnapshot;
  canvasWidth: number;
  canvasHeight: number;
  anchorHints?: EcommerceTextAnchorHint[];
}) => {
  const {
    overlayState,
    layoutMeta,
    canvasWidth,
    canvasHeight,
    anchorHints = [],
  } = options;
  const replacementProfileId = resolveReplacementProfileId({
    overlayState,
    layoutMeta,
  });
  const { featureTags, bullets, stats, comparisonRows } =
    collectTextContent(overlayState);
  const visibilityMap = getOverlayLayerVisibilityMap(overlayState.layers);
  const panelRect = toAbsolutePanelRect(
    getOverlayPanelBox({
      templateId: overlayState.templateId || "hero-left",
      statCount: stats.length,
      comparisonCount: comparisonRows.length,
      hasPrice: Boolean(
        String(overlayState.priceLabel || "").trim() ||
          String(overlayState.priceValue || "").trim() ||
          String(overlayState.priceNote || "").trim(),
      ),
      headlineLength: String(overlayState.headline || "").trim().length,
      subheadlineLength: String(overlayState.subheadline || "").trim().length,
      bulletCount: bullets.length,
      featureTagCount: featureTags.length,
      hasBadge: Boolean(String(overlayState.badge || "").trim()),
      hasCta: Boolean(String(overlayState.cta || "").trim()),
    }),
    canvasWidth,
    canvasHeight,
  );
  const regions = buildBaseRegions({
    overlayState,
    layoutMeta,
    panelRect,
  });
  const palette = buildColorPalette(overlayState.tone);
  const defaultAlign =
    overlayState.textAlign ||
    (overlayState.templateId === "hero-center"
      ? "center"
      : overlayState.templateId === "hero-right"
        ? "right"
        : "left");

  const layers: EcommerceTextLayerBlueprint[] = [];
  const roleBoxes = new Map<EcommerceOverlayLayerKind, EcommerceReplacementBox>();
  const regionCursors = Object.fromEntries(
    Object.entries(regions).map(([key, rect]) => [key, rect.y]),
  ) as Record<string, number>;

  const registerRoleBox = (
    role: EcommerceOverlayLayerKind,
    layerRect: Rect,
  ) => {
    const existing = roleBoxes.get(role);
    const next: EcommerceReplacementBox = existing
      ? {
          role,
          x: Math.min(existing.x, layerRect.x),
          y: Math.min(existing.y, layerRect.y),
          width:
            Math.max(existing.x + existing.width, layerRect.x + layerRect.width) -
            Math.min(existing.x, layerRect.x),
          height:
            Math.max(existing.y + existing.height, layerRect.y + layerRect.height) -
            Math.min(existing.y, layerRect.y),
        }
      : {
          role,
          x: layerRect.x,
          y: layerRect.y,
          width: layerRect.width,
          height: layerRect.height,
        };
    roleBoxes.set(role, next);
  };

  const pushTextBlock = (options: {
    role: EcommerceOverlayLayerKind;
    text: string;
    rect: Rect;
    align?: EcommerceOverlayTextAlign;
    fontSize: number;
    minFontSize: number;
    fontWeight: number;
    fillColor: string;
    maxLines: number;
    lineHeight: number;
    letterSpacing?: number;
    gapAfter?: number;
    cursorKey: string;
  }) => {
    const text = String(options.text || "").trim();
    if (!text) return;

    const align = options.align || defaultAlign;
    const fit = fitTextToRegion({
      text,
      width: options.rect.width,
      initialFontSize: options.fontSize,
      minFontSize: options.minFontSize,
      maxLines: options.maxLines,
    });
    const lineHeight = options.lineHeight;
    const blockHeight = fit.lines.length * fit.fontSize * lineHeight;
    const cursorY =
      regionCursors[options.cursorKey] ?? options.rect.y;
    const y = clampNumber(
      cursorY,
      options.rect.y,
      options.rect.y + Math.max(0, options.rect.height - blockHeight),
    );

    fit.lines.forEach((line, index) => {
      const lineWidth = Math.min(
        options.rect.width,
        Math.max(
          options.rect.width * 0.45,
          estimateTextWidth(line, fit.fontSize, options.letterSpacing || 0),
        ),
      );
      const height = fit.fontSize * lineHeight;
      const x = computeTextX(options.rect, lineWidth, align);
      const layer: EcommerceTextLayerBlueprint = {
        id: `${options.role}-${layers.length + 1}`,
        role: options.role,
        text: line,
        x,
        y: y + index * height,
        width: lineWidth,
        height,
        fontSize: fit.fontSize,
        fontWeight: options.fontWeight,
        fillColor: options.fillColor,
        textAlign: align,
        lineHeight,
        letterSpacing: options.letterSpacing || 0,
      };
      layers.push(layer);
      registerRoleBox(options.role, layer);
    });

    regionCursors[options.cursorKey] =
      y + blockHeight + (options.gapAfter || Math.max(8, fit.fontSize * 0.24));
  };

  const pushInlineTagRow = (options: {
    role: EcommerceOverlayLayerKind;
    items: string[];
    rect: Rect;
    fontSize: number;
    fontWeight: number;
    fillColor: string;
    cursorKey: string;
    gapX: number;
    gapY: number;
    align?: EcommerceOverlayTextAlign;
  }) => {
    const items = options.items.map((item) => String(item || "").trim()).filter(Boolean);
    if (items.length === 0) return;

    const align = options.align || defaultAlign;
    let cursorX = options.rect.x;
    let cursorY = regionCursors[options.cursorKey] ?? options.rect.y;
    let rowWidth = 0;
    const rowHeight = options.fontSize * 1.08;
    let maxRight = options.rect.x;

    items.forEach((item) => {
      const width = Math.min(
        options.rect.width * 0.48,
        estimateTextWidth(item, options.fontSize, 0.2) + options.fontSize * 0.9,
      );
      if (cursorX > options.rect.x && cursorX + width > options.rect.x + options.rect.width) {
        cursorX = options.rect.x;
        cursorY += rowHeight + options.gapY;
        rowWidth = 0;
      }

      const lineWidth = width;
      const x =
        align === "center" && rowWidth === 0
          ? options.rect.x + (options.rect.width - Math.min(options.rect.width, width * items.length)) / 2
          : cursorX;
      const layer: EcommerceTextLayerBlueprint = {
        id: `${options.role}-${layers.length + 1}`,
        role: options.role,
        text: item,
        x,
        y: cursorY,
        width: lineWidth,
        height: rowHeight,
        fontSize: options.fontSize,
        fontWeight: options.fontWeight,
        fillColor: options.fillColor,
        textAlign: align === "right" ? "right" : "left",
        lineHeight: 1.08,
        letterSpacing: 0.2,
      };
      layers.push(layer);
      registerRoleBox(options.role, layer);
      cursorX = x + width + options.gapX;
      rowWidth += width + options.gapX;
      maxRight = Math.max(maxRight, x + width);
    });

    regionCursors[options.cursorKey] =
      cursorY + rowHeight + Math.max(options.gapY, options.fontSize * 0.4);
  };

  const pushGridText = (options: {
    role: EcommerceOverlayLayerKind;
    items: string[];
    rect: Rect;
    cursorKey: string;
    columns: number;
    fontSize: number;
    fontWeight: number;
    fillColor: string;
    align?: EcommerceOverlayTextAlign;
  }) => {
    const items = options.items.map((item) => String(item || "").trim()).filter(Boolean);
    if (items.length === 0) return;
    const align = options.align || defaultAlign;
    const columns = Math.max(1, options.columns);
    const colGap = Math.max(12, options.rect.width * 0.04);
    const cellWidth =
      (options.rect.width - colGap * (columns - 1)) / columns;
    const rowHeight = options.fontSize * 1.18;
    const startY = regionCursors[options.cursorKey] ?? options.rect.y;

    items.forEach((item, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = options.rect.x + col * (cellWidth + colGap);
      const y = startY + row * (rowHeight + Math.max(10, options.fontSize * 0.3));
      const layer: EcommerceTextLayerBlueprint = {
        id: `${options.role}-${layers.length + 1}`,
        role: options.role,
        text: item,
        x,
        y,
        width: cellWidth,
        height: rowHeight,
        fontSize: options.fontSize,
        fontWeight: options.fontWeight,
        fillColor: options.fillColor,
        textAlign: align,
        lineHeight: 1.18,
        letterSpacing: 0,
      };
      layers.push(layer);
      registerRoleBox(options.role, layer);
    });

    const rows = Math.ceil(items.length / columns);
    regionCursors[options.cursorKey] =
      startY + rows * rowHeight + Math.max(14, options.fontSize * 0.55);
  };

  if (shouldIncludeRole(visibilityMap, "badge") && overlayState.badge) {
    const placement = getPlacementForRole({
      regions,
      role: "badge",
      intents: overlayState.textContainerIntents,
      overlayState,
      anchorHints,
      canvasWidth,
      canvasHeight,
      defaultAlign,
    });
    pushTextBlock({
      role: "badge",
      text: overlayState.badge,
      rect: placement.rect,
      cursorKey: placement.cursorKey,
      align: placement.align,
      fontSize: 18,
      minFontSize: 14,
      fontWeight: 700,
      fillColor: palette.accent,
      maxLines: 1,
      lineHeight: 1.02,
      letterSpacing: 0.5,
      gapAfter: 10,
    });
  }

  if (shouldIncludeRole(visibilityMap, "featureTags") && featureTags.length > 0) {
    const placement = getPlacementForRole({
      regions,
      role: "featureTags",
      intents: overlayState.textContainerIntents,
      overlayState,
      anchorHints,
      canvasWidth,
      canvasHeight,
      defaultAlign,
    });
    pushInlineTagRow({
      role: "featureTags",
      items: featureTags,
      rect: placement.rect,
      cursorKey: placement.cursorKey,
      fontSize: 14,
      fontWeight: 700,
      fillColor: palette.secondary,
      gapX: Math.max(10, placement.rect.width * 0.035),
      gapY: 8,
      align: placement.align,
    });
  }

  if (shouldIncludeRole(visibilityMap, "headline") && overlayState.headline) {
    const placement = getPlacementForRole({
      regions,
      role: "headline",
      intents: overlayState.textContainerIntents,
      overlayState,
      anchorHints,
      canvasWidth,
      canvasHeight,
      defaultAlign,
    });
    pushTextBlock({
      role: "headline",
      text: overlayState.headline,
      rect: placement.rect,
      cursorKey: placement.cursorKey,
      align: placement.align,
      fontSize:
        overlayState.templateId === "spec-band"
          ? 34
          : overlayState.templateId === "hero-center"
            ? 40
            : 42,
      minFontSize: 24,
      fontWeight: 800,
      fillColor: palette.primary,
      maxLines: overlayState.templateId === "hero-center" ? 3 : 2,
      lineHeight: 1.04,
      letterSpacing: 0.15,
      gapAfter: 12,
    });
  }

  if (shouldIncludeRole(visibilityMap, "subheadline") && overlayState.subheadline) {
    const placement = getPlacementForRole({
      regions,
      role: "subheadline",
      intents: overlayState.textContainerIntents,
      overlayState,
      anchorHints,
      canvasWidth,
      canvasHeight,
      defaultAlign,
    });
    pushTextBlock({
      role: "subheadline",
      text: overlayState.subheadline,
      rect: placement.rect,
      cursorKey: placement.cursorKey,
      align: placement.align,
      fontSize: overlayState.templateId === "spec-band" ? 17 : 18,
      minFontSize: 13,
      fontWeight: 500,
      fillColor: palette.secondary,
      maxLines: 2,
      lineHeight: 1.16,
      gapAfter: 12,
    });
  }

  if (shouldIncludeRole(visibilityMap, "price")) {
    const placement = getPlacementForRole({
      regions,
      role: "price",
      intents: overlayState.textContainerIntents,
      overlayState,
      anchorHints,
      canvasWidth,
      canvasHeight,
      defaultAlign,
    });
    const priceAlign = placement.align;
    pushTextBlock({
      role: "price",
      text: overlayState.priceLabel || "",
      rect: placement.rect,
      cursorKey: placement.cursorKey,
      align: priceAlign,
      fontSize: 14,
      minFontSize: 12,
      fontWeight: 600,
      fillColor: palette.secondary,
      maxLines: 1,
      lineHeight: 1,
      gapAfter: 6,
    });
    pushTextBlock({
      role: "price",
      text: overlayState.priceValue || "",
      rect: placement.rect,
      cursorKey: placement.cursorKey,
      align: priceAlign,
      fontSize: overlayState.templateId === "spec-band" ? 34 : 30,
      minFontSize: 20,
      fontWeight: 800,
      fillColor: palette.accent,
      maxLines: 1,
      lineHeight: 1,
      gapAfter: 6,
    });
    pushTextBlock({
      role: "price",
      text: overlayState.priceNote || "",
      rect: placement.rect,
      cursorKey: placement.cursorKey,
      align: priceAlign,
      fontSize: 13,
      minFontSize: 11,
      fontWeight: 500,
      fillColor: palette.secondary,
      maxLines: 2,
      lineHeight: 1.12,
      gapAfter: 10,
    });
  }

  if (shouldIncludeRole(visibilityMap, "stats") && stats.length > 0) {
    const placement = getPlacementForRole({
      regions,
      role: "stats",
      intents: overlayState.textContainerIntents,
      overlayState,
      anchorHints,
      canvasWidth,
      canvasHeight,
      defaultAlign,
    });
    pushGridText({
      role: "stats",
      items: stats.map(
        (item) =>
          `${String(item.value || "").trim()} ${String(item.label || "").trim()}`.trim(),
      ),
      rect: placement.rect,
      cursorKey: placement.cursorKey,
      columns: placement.rect.width > canvasWidth * 0.26 ? 2 : 1,
      fontSize: 15,
      fontWeight: 700,
      fillColor: palette.primary,
      align: placement.align,
    });
  }

  if (shouldIncludeRole(visibilityMap, "comparison")) {
    const placement = getPlacementForRole({
      regions,
      role: "comparison",
      intents: overlayState.textContainerIntents,
      overlayState,
      anchorHints,
      canvasWidth,
      canvasHeight,
      defaultAlign,
    });
    if (overlayState.comparisonTitle) {
      pushTextBlock({
        role: "comparison",
        text: overlayState.comparisonTitle,
        rect: placement.rect,
        cursorKey: placement.cursorKey,
        align: placement.align,
        fontSize: 17,
        minFontSize: 13,
        fontWeight: 700,
        fillColor: palette.primary,
        maxLines: 1,
        lineHeight: 1.05,
        gapAfter: 8,
      });
    }
    comparisonRows.forEach((item) => {
      const before = String(item.before || "").trim();
      const after = String(item.after || "").trim();
      const label = String(item.label || "").trim();
      const rowText = before
        ? `${label}: ${before} -> ${after}`
        : `${label}: ${after}`;
      pushTextBlock({
        role: "comparison",
        text: rowText,
        rect: placement.rect,
        cursorKey: placement.cursorKey,
        align: placement.align,
        fontSize: 14,
        minFontSize: 11,
        fontWeight: 600,
        fillColor: palette.secondary,
        maxLines: 1,
        lineHeight: 1.12,
        gapAfter: 7,
      });
    });
  }

  if (shouldIncludeRole(visibilityMap, "bullets") && bullets.length > 0) {
    const placement = getPlacementForRole({
      regions,
      role: "bullets",
      intents: overlayState.textContainerIntents,
      overlayState,
      anchorHints,
      canvasWidth,
      canvasHeight,
      defaultAlign,
    });
    bullets.forEach((item) => {
      pushTextBlock({
        role: "bullets",
        text: item,
        rect: placement.rect,
        cursorKey: placement.cursorKey,
        align: placement.align,
        fontSize: 15,
        minFontSize: 12,
        fontWeight: 600,
        fillColor: palette.secondary,
        maxLines: 1,
        lineHeight: 1.12,
        gapAfter: 8,
      });
    });
  }

  if (shouldIncludeRole(visibilityMap, "cta") && overlayState.cta) {
    const placement = getPlacementForRole({
      regions,
      role: "cta",
      intents: overlayState.textContainerIntents,
      overlayState,
      anchorHints,
      canvasWidth,
      canvasHeight,
      defaultAlign,
    });
    pushTextBlock({
      role: "cta",
      text: overlayState.cta,
      rect: placement.rect,
      cursorKey: placement.cursorKey,
      align: placement.align,
      fontSize: 17,
      minFontSize: 13,
      fontWeight: 800,
      fillColor: palette.primary,
      maxLines: 1,
      lineHeight: 1,
      letterSpacing: 0.3,
      gapAfter: 0,
    });
  }

  const replacementRoles = new Set(
    (overlayState.textContainerIntents || [])
      .filter((item) => item.replacementMode === "replace-generated-text")
      .map((item) => item.role),
  );
  const rawReplacementBoxes = (Array.from(replacementRoles) as EcommerceOverlayLayerKind[])
      .map((role) => {
        const placedBox = roleBoxes.get(role);
        const placement = getRegionForRole(
          regions,
          role,
          overlayState.textContainerIntents,
        );
        const anchor = findBestAnchorForRole({
          role,
          overlayState,
          anchorHints,
          targetRect: placement.rect,
          canvasWidth,
          canvasHeight,
        });
        const anchorRect = anchor
          ? normalizeAnchorRect(anchor, canvasWidth, canvasHeight)
          : null;
        if (!placedBox && !anchorRect) {
          return null;
        }

        const merged = placedBox
          ? anchorRect
            ? unionRects(placedBox, anchorRect)
            : {
                x: placedBox.x,
                y: placedBox.y,
                width: placedBox.width,
                height: placedBox.height,
              }
          : {
              x: anchorRect!.x,
              y: anchorRect!.y,
              width: anchorRect!.width,
              height: anchorRect!.height,
            };

        const metrics = getRoleAwareReplacementMetrics({
          profileId: replacementProfileId,
          role,
          rect: merged,
          canvasWidth,
          canvasHeight,
        });
        const expanded = expandRect(
          merged,
          metrics.paddingX,
          metrics.paddingY,
          canvasWidth,
          canvasHeight,
        );

        return {
          role,
          roles: [role],
          x: expanded.x,
          y: expanded.y,
          width: expanded.width,
          height: expanded.height,
          radius: metrics.radius,
          source:
            placedBox && anchorRect
              ? "merged"
              : anchorRect
                ? "anchor"
                : "placed",
        } satisfies EcommerceReplacementBox;
      })
      .filter(Boolean) as EcommerceReplacementBox[];

  const replacementBoxes = mergeReplacementBoxes(
    replacementProfileId,
    rawReplacementBoxes,
  ).map((box) => ({
    ...box,
    width: Math.min(box.width, canvasWidth - box.x),
    height: Math.min(box.height, canvasHeight - box.y),
    radius: Math.min(
      box.radius || 0,
      Math.min(box.width, box.height) / 2,
    ),
  }));

  const anchorDrivenBoxCount = replacementBoxes.filter(
    (box) => box.source === "anchor" || box.source === "merged",
  ).length;
  const templateDrivenBoxCount = replacementBoxes.filter(
    (box) => box.source === "placed",
  ).length;
  const mergedBoxCount = replacementBoxes.filter(
    (box) => box.source === "merged" || (box.roles || []).length > 1,
  ).length;
  const sourceMode: EcommerceReplacementPlanningSummary["sourceMode"] =
    anchorDrivenBoxCount > 0 && templateDrivenBoxCount > 0
      ? "hybrid"
      : anchorDrivenBoxCount > 0
        ? "anchor-only"
        : "template-only";
  const confidence: EcommerceReplacementPlanningSummary["confidence"] =
    sourceMode === "anchor-only"
      ? "high"
      : sourceMode === "hybrid"
        ? "medium"
        : "low";
  const replacementPlanningSummary: EcommerceReplacementPlanningSummary = {
    profileId: replacementProfileId,
    sourceMode,
    confidence,
    anchorCount: anchorHints.length,
    replacementBoxCount: replacementBoxes.length,
    mergedBoxCount,
    summary:
      sourceMode === "anchor-only"
        ? `以锚点替换为主，匹配到 ${anchorDrivenBoxCount} 个文字块。`
        : sourceMode === "hybrid"
          ? `锚点与模板联合替换，锚点块 ${anchorDrivenBoxCount} 个，模板补位 ${templateDrivenBoxCount} 个。`
          : `以模板推导替换为主，当前未稳定命中可用锚点。`,
  };

  return {
    layoutMeta,
    panelRect,
    textLayers: layers,
    replacementBoxes,
    replacementPlanningSummary,
  };
};
