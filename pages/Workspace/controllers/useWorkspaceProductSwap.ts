import { useCallback, type MutableRefObject } from "react";
import {
  analyzeProductSwapScene,
  generateImage,
  type ImageGenerationConfig,
} from "../../../services/gemini";
import type { CanvasElement } from "../../../types";
import type { DesignTaskMode } from "../../../types/common";

type PersistEditDetails = {
  instruction: string;
  referenceUrls?: string[];
  analysis?: string;
  constraints?: string[];
  researchSummary?: string;
};

type UseWorkspaceProductSwapOptions = {
  selectedElementId: string | null;
  productSwapImages: string[];
  productSwapRes: "1K" | "2K" | "4K";
  setShowProductSwapPanel: (show: boolean) => void;
  elementsRef: MutableRefObject<CanvasElement[]>;
  setElementsSynced: (nextElements: CanvasElement[]) => void;
  setSelectedElementId: (id: string | null) => void;
  urlToBase64: (url: string) => Promise<string>;
  loadElementSourceSize: (
    element: CanvasElement,
  ) => Promise<{ width: number; height: number }>;
  getNearestAspectRatio: (width: number, height: number) => string;
  persistEditSession: (
    mode: DesignTaskMode,
    element: CanvasElement,
    details: PersistEditDetails,
  ) => Promise<void>;
  getDesignConsistencyContext: () => Record<string, unknown>;
  retryWithConsistencyFix: (
    label: string,
    initialUrl: string,
    rerun: (fixPrompt?: string) => Promise<string | null>,
    anchorOverride?: string,
    genPrompt?: string,
    referenceCount?: number,
  ) => Promise<string>;
  applyGeneratedImageToElement: (
    elementId: string,
    resultUrl: string,
    keepCurrentSize?: boolean,
  ) => Promise<void>;
};

const resolveProductSwapModel = (
  element: CanvasElement,
): ImageGenerationConfig["model"] => {
  const model = element.genModel;
  if (model === "Nano Banana Pro") return "Nano Banana Pro";
  if (model === "NanoBanana2" || model === "Nano Banana 2") return "NanoBanana2";
  if (model === "Seedream5.0" || model === "Seedream 5.0") return "Seedream5.0";
  if (model === "Seedream 4") return "Seedream 4";
  if (model === "GPT Image 2" || model === "gpt-image-2") return "gpt-image-2";
  if (model === "GPT Image 2 All" || model === "gpt-image-2-all") return "gpt-image-2";
  if (model === "GPT Image 1.5" || model === "gpt-image-1.5-all") return "gpt-image-1.5-all";
  if (model === "Flux.2 Max") return "Flux.2 Max";
  return "Nano Banana Pro";
};

const buildProductSwapPrompt = (analysis: string, replacementCount: number): string => {
  return `You are a world-class commercial product photography director performing a controlled product replacement.

[CAPABILITY BOUNDARY]
- This is a controlled scene reconstruction task guided by replacement product references.
- Keep the original scene as stable as possible, but do not pretend this is a pixel-perfect local mask replacement.
- Replace only the featured product identity with the referenced replacement product.

[SCENE ANALYSIS]
${analysis}

[TASK STRUCTURE]
- Reference image 1 is the original scene that must remain the composition anchor.
- Reference images 2-${replacementCount + 1} are replacement product references.
- Preserve framing, camera angle, perspective, lighting direction, shadow logic, environment textures, props, copy blocks, and background layout unless a change is required for a believable replacement.
- Match the replacement product's silhouette, material finish, branding-visible details, and color accuracy to the uploaded references.
- If the new product differs in size or proportions, rebuild only the necessary surrounding contact area naturally and avoid ghosting from the old product.
- Keep the result photorealistic, commercially usable, and visually consistent with the original scene.`;
};

export function useWorkspaceProductSwap(options: UseWorkspaceProductSwapOptions) {
  const {
    selectedElementId,
    productSwapImages,
    productSwapRes,
    setShowProductSwapPanel,
    elementsRef,
    setElementsSynced,
    setSelectedElementId,
    urlToBase64,
    loadElementSourceSize,
    getNearestAspectRatio,
    persistEditSession,
    getDesignConsistencyContext,
    retryWithConsistencyFix,
    applyGeneratedImageToElement,
  } = options;

  return useCallback(async () => {
    if (!selectedElementId || productSwapImages.length === 0) return;
    const el = elementsRef.current.find((element) => element.id === selectedElementId);
    if (!el || !el.url) return;

    setShowProductSwapPanel(false);

    const sourceSize = await loadElementSourceSize(el);
    const targetAspectRatio = getNearestAspectRatio(
      sourceSize.width,
      sourceSize.height,
    );

    const newId = `product-swap-${Date.now()}`;
    const newEl: CanvasElement = {
      ...el,
      id: newId,
      x: el.x + el.width + 20,
      isGenerating: true,
      generatingType: "product-swap",
      url: undefined,
      zIndex: elementsRef.current.length + 10,
    };
    setElementsSynced([...elementsRef.current, newEl]);
    setSelectedElementId(newId);

    try {
      const sceneBase64 = await urlToBase64(el.url);
      const analysisText = (await analyzeProductSwapScene(sceneBase64)).trim();
      if (!analysisText) {
        throw new Error("Scene analysis failed");
      }
      const prompt = buildProductSwapPrompt(analysisText, productSwapImages.length);
      const allImages = [sceneBase64, ...productSwapImages];
      const selectedModel = resolveProductSwapModel(el);
      const constraints = [
        "Treat the original scene image as the composition anchor",
        "Keep the original scene lighting, perspective, and environment layout as stable as possible",
        "Use uploaded product references to rebuild the featured product faithfully",
        "Do not promise pixel-perfect local replacement; prefer believable controlled scene reconstruction",
      ];

      await persistEditSession("edit", el, {
        instruction:
          "Run a controlled reference-based product replacement that preserves the original scene as much as possible.",
        referenceUrls: productSwapImages,
        analysis: analysisText,
        constraints,
        researchSummary:
          "Current phase uses controlled multi-reference scene reconstruction rather than true local mask replacement.",
      });

      const runProductSwap = (fixPrompt?: string) =>
        generateImage({
          prompt: fixPrompt ? `${prompt}\n\nConsistency fix: ${fixPrompt}` : prompt,
          model: selectedModel,
          providerId: el.genProviderId,
          aspectRatio: targetAspectRatio,
          imageSize: productSwapRes,
          referenceImages: allImages,
          referenceMode: "product",
          referencePriority: "all",
          consistencyContext: getDesignConsistencyContext(),
        });

      const result = await runProductSwap();
      if (!result) {
        throw new Error("No result generated");
      }

      const finalResult = await retryWithConsistencyFix(
        "Product swap result",
        result,
        runProductSwap,
        undefined,
        prompt,
        allImages.length,
      );
      await applyGeneratedImageToElement(newId, finalResult, true);
    } catch (error) {
      console.error("Product Swap Failed:", error);
      setElementsSynced(
        elementsRef.current.filter((element) => element.id !== newId),
      );
      setSelectedElementId(el.id);
    }
  }, [
    applyGeneratedImageToElement,
    elementsRef,
    getDesignConsistencyContext,
    getNearestAspectRatio,
    loadElementSourceSize,
    persistEditSession,
    productSwapImages,
    productSwapRes,
    retryWithConsistencyFix,
    selectedElementId,
    setElementsSynced,
    setSelectedElementId,
    setShowProductSwapPanel,
    urlToBase64,
  ]);
}
