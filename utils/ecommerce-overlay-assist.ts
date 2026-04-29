import { normalizeReferenceToDataUrl } from "../services/image-reference-resolver";
import type {
  EcommerceLayoutSnapshot,
  EcommerceOverlayBulletStyle,
  EcommerceOverlayTemplateId,
  EcommerceOverlayTextAlign,
  EcommerceOverlayTone,
} from "../types/workflow.types";
import { getOverlayPanelBox } from "./ecommerce-overlay-layout";

type OverlaySamplePixel = {
  luminance: number;
  saturation: number;
  edge: number;
  subject: number;
};

export type EcommerceOverlayAssistSurface = {
  width: number;
  height: number;
  pixels: OverlaySamplePixel[];
};

export type EcommerceOverlayAssistMetrics = {
  blankScore: number;
  subjectOverlap: number;
  clutterScore: number;
  contrastScore: number;
  layoutFitScore: number;
  densityFitScore: number;
  readabilityScore: number;
  averageLuminance: number;
  totalScore: number;
};

export type EcommerceOverlayAssistReport = {
  recommendedTemplateId: EcommerceOverlayTemplateId;
  recommendedTextAlign: EcommerceOverlayTextAlign;
  recommendedTone: EcommerceOverlayTone;
  recommendedBulletStyle: EcommerceOverlayBulletStyle;
  recommendedZoneLabel: string;
  currentZoneLabel: string;
  currentMetrics: EcommerceOverlayAssistMetrics;
  recommendedMetrics: EcommerceOverlayAssistMetrics;
  recommendedReasons: string[];
  currentWeaknesses: string[];
  warnings: string[];
  suggestions: string[];
  summary: string;
  confidence: "high" | "medium" | "low";
};

const SAMPLE_WIDTH = 84;
const SAMPLE_HEIGHT = 105;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const getToneContrastScore = (
  tone: EcommerceOverlayTone,
  averageLuminance: number,
): number => {
  const ideal =
    tone === "light" ? 0.2 : tone === "accent" ? 0.58 : 0.76;
  const tolerance = tone === "light" ? 0.5 : 0.42;
  return clamp01(1 - Math.abs(averageLuminance - ideal) / tolerance);
};

const getTemplateZoneLabel = (
  templateId: EcommerceOverlayTemplateId,
): string => {
  switch (templateId) {
    case "hero-left":
      return "左侧留白区";
    case "hero-right":
      return "右侧留白区";
    case "hero-center":
      return "中部信息区";
    case "spec-band":
      return "底部信息带";
    default:
      return "详情页文案区";
  }
};

const getTemplateTextAlign = (
  templateId: EcommerceOverlayTemplateId,
): EcommerceOverlayTextAlign => {
  switch (templateId) {
    case "hero-right":
      return "right";
    case "hero-center":
      return "center";
    default:
      return "left";
  }
};

const getSuggestedTone = (
  averageLuminance: number,
  clutterScore: number,
): EcommerceOverlayTone => {
  if (averageLuminance <= 0.36) return "light";
  if (averageLuminance >= 0.62) return "dark";
  return clutterScore <= 0.34 ? "accent" : "dark";
};

const getSuggestedBulletStyle = (options: {
  bulletCount: number;
  statCount: number;
  comparisonCount: number;
  hasPrice: boolean;
  layoutMeta?: EcommerceLayoutSnapshot;
}): EcommerceOverlayBulletStyle => {
  const { bulletCount, statCount, comparisonCount, hasPrice, layoutMeta } = options;
  if (
    statCount > 0 ||
    comparisonCount > 0 ||
    hasPrice ||
    layoutMeta?.componentNeed === "text-and-stats" ||
    layoutMeta?.componentNeed === "comparison-heavy"
  ) {
    return "cards";
  }
  if (bulletCount >= 3 || layoutMeta?.componentNeed === "text-and-icons") {
    return "chips";
  }
  return "list";
};

const getTemplateAestheticLabel = (
  templateId: EcommerceOverlayTemplateId,
): string => {
  switch (templateId) {
    case "hero-left":
      return "左侧标题型详情版";
    case "hero-right":
      return "右侧说明型详情版";
    case "hero-center":
      return "居中解释型详情版";
    case "spec-band":
      return "底部参数型详情版";
    default:
      return "通用详情版";
  }
};

const createImageElement = async (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片分析加载失败"));
    image.src = src;
  });

const loadImageForAssist = async (imageUrl: string): Promise<HTMLImageElement> => {
  try {
    return await createImageElement(imageUrl);
  } catch {
    const resolved = await normalizeReferenceToDataUrl(imageUrl);
    if (!resolved) {
      throw new Error("图片分析失败，无法读取图像内容。");
    }
    return createImageElement(resolved);
  }
};

export const prepareOverlayAssistSurface = async (
  imageUrl: string,
): Promise<EcommerceOverlayAssistSurface> => {
  const image = await loadImageForAssist(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_WIDTH;
  canvas.height = SAMPLE_HEIGHT;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("无法创建智能排版分析画布。");
  }
  ctx.drawImage(image, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  const { data } = ctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  const luminanceMap = new Array<number>(SAMPLE_WIDTH * SAMPLE_HEIGHT).fill(0);
  const saturationMap = new Array<number>(SAMPLE_WIDTH * SAMPLE_HEIGHT).fill(0);
  for (let index = 0; index < data.length; index += 4) {
    const pixelIndex = index / 4;
    const red = data[index] / 255;
    const green = data[index + 1] / 255;
    const blue = data[index + 2] / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    luminanceMap[pixelIndex] = clamp01(
      red * 0.2126 + green * 0.7152 + blue * 0.0722,
    );
    saturationMap[pixelIndex] = max === 0 ? 0 : (max - min) / max;
  }

  const centerX = (SAMPLE_WIDTH - 1) / 2;
  const centerY = (SAMPLE_HEIGHT - 1) / 2;
  const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY) || 1;
  const pixels: OverlaySamplePixel[] = [];
  for (let y = 0; y < SAMPLE_HEIGHT; y += 1) {
    for (let x = 0; x < SAMPLE_WIDTH; x += 1) {
      const index = y * SAMPLE_WIDTH + x;
      const luminance = luminanceMap[index];
      const right = x < SAMPLE_WIDTH - 1 ? luminanceMap[index + 1] : luminance;
      const bottom =
        y < SAMPLE_HEIGHT - 1
          ? luminanceMap[index + SAMPLE_WIDTH]
          : luminance;
      const edge = clamp01(
        Math.abs(luminance - right) * 2.1 +
          Math.abs(luminance - bottom) * 2.1,
      );
      const centerWeight =
        1 -
        Math.sqrt(
          Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2),
        ) /
          maxDistance;
      const subject = clamp01(
        edge * 0.56 + saturationMap[index] * 0.24 + centerWeight * 0.2,
      );
      pixels.push({
        luminance,
        saturation: saturationMap[index],
        edge,
        subject,
      });
    }
  }

  return {
    width: SAMPLE_WIDTH,
    height: SAMPLE_HEIGHT,
    pixels,
  };
};

const evaluateTemplateMetrics = (options: {
  surface: EcommerceOverlayAssistSurface;
  templateId: EcommerceOverlayTemplateId;
  tone: EcommerceOverlayTone;
  statCount: number;
  comparisonCount: number;
  hasPrice: boolean;
  headlineLength: number;
  subheadlineLength: number;
  bulletCount: number;
  layoutMeta?: EcommerceLayoutSnapshot;
}): EcommerceOverlayAssistMetrics => {
  const {
    surface,
    templateId,
    tone,
    statCount,
    comparisonCount,
    hasPrice,
    headlineLength,
    subheadlineLength,
    bulletCount,
    layoutMeta,
  } =
    options;
  const box = getOverlayPanelBox({
    templateId,
    statCount,
    comparisonCount,
    hasPrice,
  });
  const left = Math.max(
    0,
    Math.floor(
      (box.left != null
        ? box.left
        : 1 - (box.right || 0) - box.width) * surface.width,
    ),
  );
  const top = Math.max(
    0,
    Math.floor(
      (box.top != null
        ? box.top
        : 1 - (box.bottom || 0) - box.height) * surface.height,
    ),
  );
  const width = Math.max(1, Math.floor(box.width * surface.width));
  const height = Math.max(1, Math.floor(box.height * surface.height));
  const right = Math.min(surface.width, left + width);
  const bottom = Math.min(surface.height, top + height);

  let luminanceSum = 0;
  let clutterSum = 0;
  let subjectSum = 0;
  let sampleCount = 0;
  const luminanceValues: number[] = [];
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const pixel = surface.pixels[y * surface.width + x];
      if (!pixel) continue;
      const clutter = clamp01(
        pixel.edge * 0.58 + pixel.saturation * 0.22 + Math.abs(pixel.luminance - 0.5) * 0.2,
      );
      luminanceSum += pixel.luminance;
      clutterSum += clutter;
      subjectSum += pixel.subject;
      luminanceValues.push(pixel.luminance);
      sampleCount += 1;
    }
  }
  const averageLuminance = sampleCount > 0 ? luminanceSum / sampleCount : 0.5;
  const averageClutter = sampleCount > 0 ? clutterSum / sampleCount : 0.5;
  const averageSubject = sampleCount > 0 ? subjectSum / sampleCount : 0.5;
  const variance =
    luminanceValues.length > 0
      ? luminanceValues.reduce(
          (sum, value) => sum + Math.pow(value - averageLuminance, 2),
          0,
        ) / luminanceValues.length
      : 0;
  const blankScore = clamp01(1 - (averageClutter * 0.72 + variance * 1.35));
  const subjectOverlap = clamp01(averageSubject);
  const clutterScore = clamp01(averageClutter * 0.75 + variance * 1.1);
  const contrastScore = getToneContrastScore(tone, averageLuminance);

  const layoutFitScore = (() => {
    let score = 0.52;
    switch (layoutMeta?.layoutMode) {
      case "left-copy":
        score += templateId === "hero-left" ? 0.26 : -0.06;
        break;
      case "right-copy":
        score += templateId === "hero-right" ? 0.26 : -0.06;
        break;
      case "bottom-panel":
        score += templateId === "spec-band" ? 0.28 : -0.08;
        break;
      case "center-focus-with-edge-space":
        score += templateId === "hero-center" ? 0.18 : 0;
        break;
      default:
        break;
    }

    switch (layoutMeta?.imageRole) {
      case "hero":
      case "scene":
        score +=
          templateId === "hero-left" || templateId === "hero-right" ? 0.14 : -0.04;
        break;
      case "structure":
      case "detail":
        score +=
          templateId === "hero-right" || templateId === "spec-band" ? 0.12 : 0;
        break;
      case "comparison":
        score += templateId === "hero-center" ? 0.18 : -0.02;
        break;
      case "parameter":
        score += templateId === "spec-band" ? 0.22 : -0.04;
        break;
      default:
        break;
    }

    const reservedAreas = layoutMeta?.reservedAreas || [];
    if (reservedAreas.includes("stats") || reservedAreas.includes("comparison")) {
      score += templateId === "spec-band" ? 0.12 : 0;
    }
    if (reservedAreas.includes("headline") || reservedAreas.includes("body")) {
      score +=
        templateId === "hero-left" || templateId === "hero-right" ? 0.08 : 0;
    }
    if (reservedAreas.includes("annotation")) {
      score += templateId === "hero-right" ? 0.08 : 0;
    }
    return clamp01(score);
  })();

  const densityFitScore = (() => {
    const contentDensity =
      headlineLength * 0.014 +
      subheadlineLength * 0.008 +
      bulletCount * 0.12 +
      statCount * 0.16 +
      comparisonCount * 0.18 +
      (hasPrice ? 0.18 : 0);
    const normalizedDensity = clamp01(contentDensity / 1.25);
    if (normalizedDensity >= 0.72) {
      if (templateId === "spec-band") return 0.94;
      if (templateId === "hero-center" && comparisonCount > 0) return 0.84;
      return 0.42;
    }
    if (normalizedDensity >= 0.44) {
      if (templateId === "hero-left" || templateId === "hero-right") return 0.76;
      if (templateId === "spec-band") return 0.8;
      return 0.68;
    }
    if (templateId === "hero-left" || templateId === "hero-right") return 0.9;
    if (templateId === "hero-center") return 0.74;
    return 0.64;
  })();

  const readabilityScore = clamp01(
    blankScore * 0.42 +
      (1 - subjectOverlap) * 0.33 +
      contrastScore * 0.25,
  );

  return {
    blankScore,
    subjectOverlap,
    clutterScore,
    contrastScore,
    layoutFitScore,
    densityFitScore,
    readabilityScore,
    averageLuminance,
    totalScore: clamp01(
      readabilityScore * 0.56 + layoutFitScore * 0.24 + densityFitScore * 0.2,
    ),
  };
};

export const buildOverlayAssistReport = (options: {
  surface: EcommerceOverlayAssistSurface;
  currentTemplateId: EcommerceOverlayTemplateId;
  currentTone: EcommerceOverlayTone;
  layoutMeta?: EcommerceLayoutSnapshot;
  statCount: number;
  comparisonCount: number;
  hasPrice: boolean;
  headlineLength: number;
  subheadlineLength: number;
  bulletCount: number;
}): EcommerceOverlayAssistReport => {
  const {
    surface,
    currentTemplateId,
    currentTone,
    layoutMeta,
    statCount,
    comparisonCount,
    hasPrice,
    headlineLength,
    subheadlineLength,
    bulletCount,
  } = options;

  const currentMetrics = evaluateTemplateMetrics({
    surface,
    templateId: currentTemplateId,
    tone: currentTone,
    statCount,
    comparisonCount,
    hasPrice,
    headlineLength,
    subheadlineLength,
    bulletCount,
    layoutMeta,
  });

  const templates: EcommerceOverlayTemplateId[] = [
    "hero-left",
    "hero-right",
    "hero-center",
    "spec-band",
  ];

  const candidates = templates.map((templateId) => {
    const baseMetrics = evaluateTemplateMetrics({
      surface,
      templateId,
      tone: currentTone,
      statCount,
      comparisonCount,
      hasPrice,
      headlineLength,
      subheadlineLength,
      bulletCount,
      layoutMeta,
    });
    const suggestedTone = getSuggestedTone(
      baseMetrics.averageLuminance,
      baseMetrics.clutterScore,
    );
    const tunedMetrics = evaluateTemplateMetrics({
      surface,
      templateId,
      tone: suggestedTone,
      statCount,
      comparisonCount,
      hasPrice,
      headlineLength,
      subheadlineLength,
      bulletCount,
      layoutMeta,
    });
    return {
      templateId,
      tone: suggestedTone,
      metrics: tunedMetrics,
    };
  });

  const recommended =
    candidates.sort(
      (left, right) => right.metrics.totalScore - left.metrics.totalScore,
    )[0] || candidates[0];

  const warnings: string[] = [];
  const currentWeaknesses: string[] = [];
  if (currentMetrics.subjectOverlap >= 0.34) {
    warnings.push("当前文案区与主体重叠偏高，容易压住商品主体。");
    currentWeaknesses.push("主体避让不足");
  }
  if (currentMetrics.blankScore <= 0.42) {
    warnings.push("当前文案区背景纹理偏多，文字容易发花。");
    currentWeaknesses.push("留白不够干净");
  }
  if (currentMetrics.contrastScore <= 0.5) {
    warnings.push("当前调性与底图亮度不够匹配，建议切换文字底板调性。");
    currentWeaknesses.push("底图对比度偏弱");
  }
  if (currentMetrics.layoutFitScore <= 0.54) {
    currentWeaknesses.push("当前区域和详情页结构不够匹配");
  }
  if (currentMetrics.densityFitScore <= 0.56) {
    currentWeaknesses.push("当前信息量与版式承载不够匹配");
  }
  if (currentMetrics.readabilityScore <= 0.52) {
    warnings.push("当前可读性偏低，建议换到更空的位置或减少文案密度。");
  }
  if (headlineLength >= 18) {
    warnings.push("标题偏长，建议拆成主标题加副标题，避免首行过满。");
  }
  if (subheadlineLength >= 38) {
    warnings.push("副标题偏长，建议拆成两行或转入卖点列表。");
  }
  if (bulletCount >= 5 && currentTemplateId !== "spec-band") {
    warnings.push("卖点条目较多，更适合参数带或卡片式版式。");
  }

  const suggestions: string[] = [];
  const recommendedReasons: string[] = [];
  if (recommended.templateId !== currentTemplateId) {
    suggestions.push(
      `建议改用${getTemplateZoneLabel(recommended.templateId)}，留白和主体避让更好。`,
    );
  }
  if (recommended.tone !== currentTone) {
    suggestions.push(
      `建议切换为${
        recommended.tone === "light"
          ? "浅色留白"
          : recommended.tone === "accent"
            ? "品牌强调"
            : "深色压感"
      }，当前区域的底图亮度更适合这种调性。`,
    );
  }
  if (headlineLength >= 18) {
    suggestions.push("建议把标题控制在 12 到 16 字内，核心价值放第一行。");
  }
  if (recommended.metrics.blankScore >= currentMetrics.blankScore + 0.08) {
    recommendedReasons.push("推荐区域留白更完整，详情页标题更容易立住。");
  }
  if (recommended.metrics.subjectOverlap <= currentMetrics.subjectOverlap - 0.08) {
    recommendedReasons.push("推荐区域离商品主体更远，不容易压住产品轮廓。");
  }
  if (recommended.metrics.layoutFitScore >= currentMetrics.layoutFitScore + 0.06) {
    recommendedReasons.push(
      `${getTemplateAestheticLabel(recommended.templateId)}更符合当前图的详情页信息结构。`,
    );
  }
  if (recommended.metrics.densityFitScore >= currentMetrics.densityFitScore + 0.06) {
    recommendedReasons.push("当前信息量放到推荐版式里会更自然，不会显得又挤又散。");
  }
  if (recommended.tone !== currentTone) {
    recommendedReasons.push("推荐调性能让文字底板和底图明暗关系更稳定。");
  }
  if (recommendedReasons.length === 0) {
    recommendedReasons.push("当前版式已经接近较优解，主要建议做轻微微调。");
  }

  const summary =
    recommended.templateId === currentTemplateId &&
    recommended.tone === currentTone &&
    currentMetrics.readabilityScore >= 0.62
      ? `当前文案区整体可读性不错，${getTemplateZoneLabel(currentTemplateId)}基本适合继续排版。`
      : `建议优先尝试${getTemplateZoneLabel(recommended.templateId)}，它更像${getTemplateAestheticLabel(recommended.templateId)}，留白、主体避让和信息承载都会更接近成熟详情页。`;

  const confidence: "high" | "medium" | "low" =
    recommended.metrics.totalScore >= 0.72
      ? "high"
      : recommended.metrics.totalScore >= 0.56
        ? "medium"
        : "low";

  return {
    recommendedTemplateId: recommended.templateId,
    recommendedTextAlign: getTemplateTextAlign(recommended.templateId),
    recommendedTone: recommended.tone,
    recommendedBulletStyle: getSuggestedBulletStyle({
      bulletCount,
      statCount,
      comparisonCount,
      hasPrice,
      layoutMeta,
    }),
    recommendedZoneLabel: getTemplateZoneLabel(recommended.templateId),
    currentZoneLabel: getTemplateZoneLabel(currentTemplateId),
    currentMetrics,
    recommendedMetrics: recommended.metrics,
    recommendedReasons,
    currentWeaknesses,
    warnings,
    suggestions,
    summary,
    confidence,
  };
};
