import type { ImageReferenceRoleMode } from "../../types";
import type {
  PlanVisualGenerationInput,
  VisualReferencePlan,
  VisualReferenceReasoning,
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

const LAYOUT_LOCK_DOMAINS = [
  "composition",
  "layout",
  "camera",
  "atmosphere",
  "typography-spacing",
];

const PRODUCT_LOCK_DOMAINS = [
  "product-identity",
  "branding",
  "logo",
  "packaging",
  "materials",
  "claims",
  "factual-details",
];

const PRODUCT_LOCK_CUES = [
  "不能变",
  "不要变",
  "保持",
  "保留",
  "以图二的产品为主",
  "以图2的产品为主",
  "以第二张的产品为主",
  "主体不能变",
  "产品不能变",
  "品牌不能变",
  "外观不能变",
  "不能变成图一的产品",
  "keep the product",
  "keep product identity",
  "product must stay",
  "do not change the product",
];

const REFERENCE_COMPARISON_CUES = [
  "对不上",
  "不一致",
  "冲突",
  "改成",
  "替换成",
  "用图一",
  "用图二",
  "参考图一",
  "参考图二",
  "match",
  "mismatch",
  "conflict",
  "replace with",
  "use ref1",
  "use ref2",
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

const inferReferenceReasoningSignals = (prompt: string) => {
  const normalized = normalizePrompt(prompt);
  const posterProductIntent = inferExplicitPosterProductIntent(prompt);
  const preserveProductIdentity = PRODUCT_LOCK_CUES.some((cue) =>
    normalized.includes(cue),
  );
  const shouldAnalyzeMismatch =
    Boolean(posterProductIntent) &&
    (preserveProductIdentity ||
      REFERENCE_COMPARISON_CUES.some((cue) => normalized.includes(cue)));

  return {
    posterProductIntent,
    preserveProductIdentity,
    shouldAnalyzeMismatch,
  };
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

const buildReferenceReasoning = (args: {
  references: VisualReferencePlan[];
  preserveProductIdentity: boolean;
  shouldAnalyzeMismatch: boolean;
}): VisualReferenceReasoning | undefined => {
  const { references, preserveProductIdentity, shouldAnalyzeMismatch } = args;
  const hasLayoutAnchor = references.some((reference) => reference.role === "layout");
  const hasProductAnchor = references.some((reference) => reference.role === "product");
  const shouldReconcile =
    Boolean(shouldAnalyzeMismatch) || (hasLayoutAnchor && hasProductAnchor);

  if (!shouldReconcile) {
    return undefined;
  }

  const roleSummary: string[] = [];
  if (hasLayoutAnchor) {
    roleSummary.push(
      "layout-like references contribute structure, framing, visual rhythm, and atmosphere",
    );
  }
  if (hasProductAnchor) {
    roleSummary.push(
      "product-like references contribute product truth, branding, packaging, materials, and factual details",
    );
  }

  return {
    shouldReconcile: true,
    lockedAttributeDomains: preserveProductIdentity
      ? [...LAYOUT_LOCK_DOMAINS, ...PRODUCT_LOCK_DOMAINS]
      : [...LAYOUT_LOCK_DOMAINS, "product-identity", "branding", "packaging"],
    roleSummary,
  };
};

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
  const reasoningSignals = inferReferenceReasoningSignals(input.prompt);
  const explicitPosterProductIntent = reasoningSignals.posterProductIntent;
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
      reasoningSignals.shouldAnalyzeMismatch
        ? "Layout anchor only. Borrow composition, typography rhythm, atmosphere, and spatial hierarchy from this reference."
        : "Layout anchor",
    );
    pushManual(
      manualReferenceImages[productIndex],
      productIndex,
      "product",
      1,
      reasoningSignals.preserveProductIdentity || reasoningSignals.shouldAnalyzeMismatch
        ? "Product truth anchor. Override conflicting product appearance, branding, packaging, materials, and factual details with this reference."
        : "Product identity anchor",
    );

    manualReferenceImages.forEach((url, index) => {
      if (index === layoutIndex || index === productIndex) return;
      pushManual(
        url,
        index,
        "detail",
        0.7,
        "Supporting detail reference. Use only when it does not conflict with the primary product truth anchor.",
      );
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
      preserveProductIdentity: reasoningSignals.preserveProductIdentity,
      shouldAnalyzeMismatch: reasoningSignals.shouldAnalyzeMismatch,
      referenceReasoning: buildReferenceReasoning({
        references,
        preserveProductIdentity: reasoningSignals.preserveProductIdentity,
        shouldAnalyzeMismatch: reasoningSignals.shouldAnalyzeMismatch,
      }),
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
    preserveProductIdentity: reasoningSignals.preserveProductIdentity,
    shouldAnalyzeMismatch: reasoningSignals.shouldAnalyzeMismatch,
    referenceReasoning: buildReferenceReasoning({
      references,
      preserveProductIdentity: reasoningSignals.preserveProductIdentity,
      shouldAnalyzeMismatch: reasoningSignals.shouldAnalyzeMismatch,
    }),
  };
};
