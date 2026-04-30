import type { ImageReferenceRoleMode } from "../../types";
import type {
  PlanVisualGenerationInput,
  VisualReferencePlan,
  VisualReferenceRole,
} from "./types";

const REF1_ALIASES = [
  "图1",
  "图一",
  "参考图1",
  "参考图一",
  "第一张",
  "第1张",
  "ref1",
  "ref 1",
  "image1",
  "image 1",
];

const REF2_ALIASES = [
  "图2",
  "图二",
  "参考图2",
  "参考图二",
  "第二张",
  "第2张",
  "ref2",
  "ref 2",
  "image2",
  "image 2",
];

const LAYOUT_ROLE_CUES = [
  "海报",
  "构图",
  "版式",
  "排版",
  "布局",
  "画面",
  "风格",
  "style",
  "layout",
  "composition",
  "poster",
];

const PRODUCT_ROLE_CUES = [
  "产品",
  "商品",
  "主体",
  "包装",
  "品牌",
  "logo",
  "瓶子",
  "product",
  "brand",
  "packaging",
];

const normalizePrompt = (value: string) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const mentionsRole = (
  prompt: string,
  refAliases: string[],
  roleCues: string[],
): boolean =>
  refAliases.some((alias) => prompt.includes(alias)) &&
  roleCues.some((cue) => prompt.includes(cue));

const inferExplicitPosterProductIntent = (prompt: string) => {
  const normalized = normalizePrompt(prompt);
  const ref1IsLayout = mentionsRole(normalized, REF1_ALIASES, LAYOUT_ROLE_CUES);
  const ref2IsProduct = mentionsRole(normalized, REF2_ALIASES, PRODUCT_ROLE_CUES);

  const ref1IsProduct = mentionsRole(normalized, REF1_ALIASES, PRODUCT_ROLE_CUES);
  const ref2IsLayout = mentionsRole(normalized, REF2_ALIASES, LAYOUT_ROLE_CUES);

  if (ref1IsLayout && ref2IsProduct) {
    return { layoutIndex: 0, productIndex: 1 };
  }

  if (ref2IsLayout && ref1IsProduct) {
    return { layoutIndex: 1, productIndex: 0 };
  }

  return null;
};

const dedupeUrls = (items: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const normalized = String(item || "").trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
};

const createReference = (
  url: string,
  index: number,
  role: VisualReferenceRole,
  source: "manual" | "consistency-anchor",
  weight: number,
  notes?: string,
): VisualReferencePlan => ({
  id: `${source}-${index + 1}`,
  url,
  role,
  weight,
  source,
  notes,
});

export const resolveReferenceRoleMode = (
  requestedMode: ImageReferenceRoleMode | undefined,
  manualReferenceCount: number,
  totalReferenceCount: number,
  explicitPosterProductIntent: boolean,
  strictRequestedMode = false,
): ImageReferenceRoleMode => {
  if (strictRequestedMode) {
    if (requestedMode === "poster-product" && manualReferenceCount >= 2) {
      return "poster-product";
    }

    if (requestedMode === "none") {
      return "none";
    }

    if (requestedMode === "custom") {
      return totalReferenceCount > 0 ? "custom" : "default";
    }

    return totalReferenceCount > 0 ? "default" : requestedMode || "default";
  }

  if (
    (requestedMode === "poster-product" || explicitPosterProductIntent) &&
    manualReferenceCount >= 2
  ) {
    return "poster-product";
  }

  if (requestedMode === "none") {
    return "none";
  }

  if (requestedMode === "custom") {
    return totalReferenceCount > 0 ? "custom" : "default";
  }

  return totalReferenceCount > 0 ? "default" : requestedMode || "default";
};

export const analyzeVisualReferences = (
  input: Pick<
    PlanVisualGenerationInput,
    "prompt" | "manualReferenceImages" | "referenceImages" | "requestedReferenceRoleMode"
  >,
  options?: {
    strictRequestedMode?: boolean;
  },
) => {
  const manualReferenceImages = dedupeUrls(input.manualReferenceImages || []);
  const allReferenceImages = dedupeUrls(input.referenceImages || []);
  const explicitPosterProductIntent = inferExplicitPosterProductIntent(
    input.prompt,
  );
  const effectiveReferenceRoleMode = resolveReferenceRoleMode(
    input.requestedReferenceRoleMode,
    manualReferenceImages.length,
    allReferenceImages.length,
    Boolean(explicitPosterProductIntent),
    Boolean(options?.strictRequestedMode),
  );

  const manualSet = new Set(manualReferenceImages);
  const consistencyAnchors = allReferenceImages.filter((url) => !manualSet.has(url));

  if (
    effectiveReferenceRoleMode === "poster-product" &&
    manualReferenceImages.length >= 2
  ) {
    const layoutIndex = explicitPosterProductIntent?.layoutIndex ?? 0;
    const productIndex = explicitPosterProductIntent?.productIndex ?? 1;
    const references: VisualReferencePlan[] = [];
    const orderedUrls: string[] = [];

    const pushManual = (
      url: string,
      manualIndex: number,
      role: VisualReferenceRole,
      weight: number,
      notes?: string,
    ) => {
      references.push(createReference(url, manualIndex, role, "manual", weight, notes));
      orderedUrls.push(url);
    };

    pushManual(
      manualReferenceImages[layoutIndex],
      layoutIndex,
      "layout",
      1,
      "Poster/layout anchor",
    );
    pushManual(
      manualReferenceImages[productIndex],
      productIndex,
      "product",
      1,
      "Product identity anchor",
    );

    manualReferenceImages.forEach((url, index) => {
      if (index === layoutIndex || index === productIndex) return;
      pushManual(url, index, "detail", 0.7, "Supporting detail reference");
    });

    consistencyAnchors.forEach((url, index) => {
      references.push(
        createReference(
          url,
          index,
          "supporting",
          "consistency-anchor",
          0.62,
          "Consistency anchor kept after manual poster/product references to avoid overriding role slots",
        ),
      );
      orderedUrls.push(url);
    });

    return {
      effectiveReferenceRoleMode,
      references,
      orderedReferenceImages: orderedUrls,
      explicitPosterProductIntent,
    };
  }

  const references = allReferenceImages.map((url, index) => {
    const source = manualSet.has(url) ? "manual" : "consistency-anchor";
    const isOnlyReference = allReferenceImages.length === 1;
    const isPrimary = index === 0;
    const role: VisualReferenceRole =
      effectiveReferenceRoleMode === "none"
        ? isOnlyReference
          ? "subject"
          : isPrimary
            ? "subject"
            : "supporting"
        : isOnlyReference
          ? "product"
          : isPrimary
            ? "subject"
            : "detail";

    return createReference(
      url,
      index,
      role,
      source,
      isPrimary ? 0.92 : 0.76,
      source === "consistency-anchor"
        ? "Injected consistency anchor"
        : undefined,
    );
  });

  return {
    effectiveReferenceRoleMode,
    references,
    orderedReferenceImages: allReferenceImages,
    explicitPosterProductIntent,
  };
};
