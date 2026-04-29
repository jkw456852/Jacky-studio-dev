import { useCallback, type MutableRefObject } from "react";
import { analyzeProductSwapScene, generateImage } from "../../../services/gemini";
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

const buildProductSwapPrompt = (analysis: string): string => {
  return `You are a world-class commercial product photography director. Follow the 8-phase execution pipeline strictly to perform a photorealistic product swap.

[SCENE ANALYSIS]
${analysis}

[REQUIREMENTS]
- Phase 1-4: Source analysis & physical lighting matching
- Phase 5: Precision Swap (Erase original product with Anti-Ghosting, insert new product)
- Phase 6-8: Edge blending, material fidelity, and final 8k quality check.
- Maintain product color accuracy. Ensure seamless background inpainting.
- Output photorealistic 8k composition.`;
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
      const analysisText = await analyzeProductSwapScene(sceneBase64);
      const prompt = buildProductSwapPrompt(analysisText);
      const allImages = [sceneBase64, ...productSwapImages];

      await persistEditSession("edit", el, {
        instruction:
          "Swap the current product with the provided replacement product while preserving the original scene.",
        referenceUrls: productSwapImages,
        analysis: analysisText,
        constraints: [
          "Keep the original scene lighting and perspective",
          "Blend the new product naturally into the scene",
        ],
      });

      const runProductSwap = (fixPrompt?: string) =>
        generateImage({
          prompt: fixPrompt ? `${prompt}\n\nConsistency fix: ${fixPrompt}` : prompt,
          model: "Nano Banana Pro",
          providerId: el.genProviderId,
          aspectRatio: targetAspectRatio,
          imageSize:
            productSwapRes === "1K"
              ? "1K"
              : productSwapRes === "2K"
                ? "2K"
                : "4K",
          referenceImages: allImages,
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
    }
  }, [
    applyGeneratedImageToElement,
    elementsRef,
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
