import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react";
import { smartEditSkill } from "../../../services/skills/smart-edit.skill";
import type { CanvasElement, ChatMessage } from "../../../types";
import {
  calcUpscaleTargetSize,
  getClosestAspectRatio,
  getElementSourceUrl,
  getNearestAspectRatio,
  loadElementSourceSize,
} from "../workspaceShared";

type EraserHistoryItem = {
  display: string;
  mask: string;
};

type UseWorkspaceImageToolActionsOptions = {
  selectedElementId: string | null;
  elements: CanvasElement[];
  elementsRef: MutableRefObject<CanvasElement[]>;
  showUpscalePanel: boolean;
  eraserMode: boolean;
  eraserMaskDataUrl: string | null;
  eraserHistory: EraserHistoryItem[];
  upscaleDetailPrompt: string;
  vectorRedrawPrompt: string;
  eraserCanvasRef: RefObject<HTMLCanvasElement | null>;
  eraserMaskCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
  eraserInitKeyRef: MutableRefObject<string>;
  eraserCursorRef: RefObject<HTMLDivElement | null>;
  eraserLastPointRef: MutableRefObject<{ x: number; y: number } | null>;
  setElementsSynced: (nextElements: CanvasElement[]) => void;
  setSelectedElementId: Dispatch<SetStateAction<string | null>>;
  setShowUpscalePanel: Dispatch<SetStateAction<boolean>>;
  setShowUpscaleResDropdown: Dispatch<SetStateAction<boolean>>;
  setUpscaleSourceSize: Dispatch<
    SetStateAction<{ width: number; height: number } | null>
  >;
  setEraserMode: Dispatch<SetStateAction<boolean>>;
  setEraserMaskDataUrl: Dispatch<SetStateAction<string | null>>;
  setEraserHistory: Dispatch<SetStateAction<EraserHistoryItem[]>>;
  setEraserHasPaint: Dispatch<SetStateAction<boolean>>;
  setIsDrawingEraser: Dispatch<SetStateAction<boolean>>;
  setShowLocalRedrawPanel: Dispatch<SetStateAction<boolean>>;
  setLocalRedrawPrompt: Dispatch<SetStateAction<string>>;
  addMessage: (message: ChatMessage) => void;
  urlToBase64: (url: string) => Promise<string>;
  persistEditSession: (
    mode: string,
    anchorElement: CanvasElement,
    payload: {
      instruction: string;
      constraints?: string[];
      referenceUrls?: string[];
      analysis?: string;
    },
  ) => Promise<void>;
  maybeWarnConsistencyDrift: (
    candidateUrl: string,
    label: string,
    genPrompt?: string,
  ) => Promise<unknown>;
  applyGeneratedImageToElement: (
    elementId: string,
    resultUrl: string,
    keepCurrentSize?: boolean,
  ) => Promise<void>;
};

export function useWorkspaceImageToolActions(
  options: UseWorkspaceImageToolActionsOptions,
) {
  const {
    selectedElementId,
    elements,
    elementsRef,
    showUpscalePanel,
    eraserMode,
    eraserMaskDataUrl,
    eraserHistory,
    upscaleDetailPrompt,
    vectorRedrawPrompt,
    eraserCanvasRef,
    eraserMaskCanvasRef,
    eraserInitKeyRef,
    eraserCursorRef,
    eraserLastPointRef,
    setElementsSynced,
    setSelectedElementId,
    setShowUpscalePanel,
    setShowUpscaleResDropdown,
    setUpscaleSourceSize,
    setEraserMode,
    setEraserMaskDataUrl,
    setEraserHistory,
    setEraserHasPaint,
    setIsDrawingEraser,
    setShowLocalRedrawPanel,
    setLocalRedrawPrompt,
    addMessage,
    urlToBase64,
    persistEditSession,
    maybeWarnConsistencyDrift,
    applyGeneratedImageToElement,
  } = options;

  const resolveEditModelId = useCallback((element: CanvasElement): string => {
    const model = String(element.genModel || "").trim();
    if (!model) return "gemini-3-pro-image-preview";

    if (model === "Nano Banana Pro" || model === "gemini-3-pro-image-preview") {
      return "gemini-3-pro-image-preview";
    }
    if (
      model === "NanoBanana2" ||
      model === "Nano Banana 2" ||
      model === "gemini-3.1-flash-image-preview"
    ) {
      return "gemini-3.1-flash-image-preview";
    }
    if (
      model === "Seedream5.0" ||
      model === "Seedream 5.0" ||
      model === "Seedream 4" ||
      model === "doubao-seedream-5-0-260128"
    ) {
      return "doubao-seedream-5-0-260128";
    }
    if (
      model === "GPT Image 2" ||
      model === "gpt-image-2" ||
      model === "GPT Image 2 All" ||
      model === "gpt-image-2-all"
    ) {
      return "gpt-image-2";
    }
    if (model === "GPT Image 1.5" || model === "gpt-image-1.5-all") {
      return "gpt-image-1.5-all";
    }
    if (model === "Flux.2 Max" || model === "flux-pro-max") {
      return "flux-pro-max";
    }

    return model;
  }, []);

  const appendTemporaryClone = useCallback(
    (
      element: CanvasElement,
      generatingType: CanvasElement["generatingType"],
      idPrefix: string,
      zIndexBoost: number,
    ) => {
      const newId = `${idPrefix}-${Date.now()}`;
      const newElement: CanvasElement = {
        ...element,
        id: newId,
        x: element.x + element.width + 20,
        isGenerating: true,
        generatingType,
        url: undefined,
        zIndex: elementsRef.current.length + zIndexBoost,
      };
      setElementsSynced([...elementsRef.current, newElement]);
      setSelectedElementId(newId);
      return newId;
    },
    [elementsRef, setElementsSynced, setSelectedElementId],
  );

  const removeTemporaryElement = useCallback(
    (elementId: string) => {
      const nextElements = elementsRef.current.filter(
        (element) => element.id !== elementId,
      );
      setElementsSynced(nextElements);
    },
    [elementsRef, setElementsSynced],
  );

  const resetEraserSession = useCallback(() => {
    setEraserMode(false);
    setIsDrawingEraser(false);
    setEraserMaskDataUrl(null);
    setEraserHistory([]);
    setEraserHasPaint(false);
    eraserMaskCanvasRef.current = null;
    eraserInitKeyRef.current = "";
    eraserLastPointRef.current = null;

    const cursor = eraserCursorRef.current;
    if (cursor) {
      cursor.style.opacity = "0";
      cursor.style.transform = "translate3d(-9999px,-9999px,0)";
    }
  }, [
    eraserCursorRef,
    eraserInitKeyRef,
    eraserLastPointRef,
    eraserMaskCanvasRef,
    setEraserHasPaint,
    setEraserHistory,
    setEraserMaskDataUrl,
    setEraserMode,
    setIsDrawingEraser,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (!showUpscalePanel || !selectedElementId) {
      setUpscaleSourceSize(null);
      return;
    }

    const element = elements.find((item) => item.id === selectedElementId);
    if (!element || !element.url) {
      setUpscaleSourceSize(null);
      return;
    }

    loadElementSourceSize(element).then((size) => {
      if (!cancelled) {
        setUpscaleSourceSize(size);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    elements,
    selectedElementId,
    setUpscaleSourceSize,
    showUpscalePanel,
  ]);

  useEffect(() => {
    if (!eraserMode || !selectedElementId) {
      return;
    }

    const element = elements.find((item) => item.id === selectedElementId);
    if (
      !element ||
      (element.type !== "image" && element.type !== "gen-image")
    ) {
      return;
    }

    const displayCanvas = eraserCanvasRef.current;
    if (!displayCanvas) {
      return;
    }

    const width = Math.max(1, Math.round(element.width));
    const height = Math.max(1, Math.round(element.height));
    const initKey = `${element.id}:${width}x${height}`;

    if (
      eraserInitKeyRef.current === initKey &&
      eraserMaskCanvasRef.current
    ) {
      return;
    }

    displayCanvas.width = width;
    displayCanvas.height = height;
    const displayContext = displayCanvas.getContext("2d");
    if (!displayContext) {
      return;
    }
    displayContext.clearRect(0, 0, width, height);

    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskContext = maskCanvas.getContext("2d");
    if (!maskContext) {
      return;
    }

    maskContext.fillStyle = "#000000";
    maskContext.fillRect(0, 0, width, height);

    eraserMaskCanvasRef.current = maskCanvas;
    eraserInitKeyRef.current = initKey;
    setEraserMaskDataUrl(maskCanvas.toDataURL("image/png"));
    setEraserHistory([]);
    setEraserHasPaint(false);
  }, [
    elements,
    eraserCanvasRef,
    eraserInitKeyRef,
    eraserMaskCanvasRef,
    eraserMode,
    selectedElementId,
    setEraserHasPaint,
    setEraserHistory,
    setEraserMaskDataUrl,
  ]);

  const handleUpscaleSelect = useCallback(
    async (factor: number) => {
      setShowUpscalePanel(false);
      setShowUpscaleResDropdown(false);

      if (!selectedElementId) {
        return;
      }

      const element = elementsRef.current.find(
        (item) => item.id === selectedElementId,
      );
      if (!element || !element.url) {
        return;
      }

      const sourceSize = await loadElementSourceSize(element);
      const targetSize = calcUpscaleTargetSize(
        sourceSize.width,
        sourceSize.height,
        factor,
      );
      const targetAspectRatio = getNearestAspectRatio(
        sourceSize.width,
        sourceSize.height,
      );
      const newId = appendTemporaryClone(element, "upscale", "upscale", 10);

      try {
        const base64Ref = await urlToBase64(element.url);
        const result = await smartEditSkill({
          sourceUrl: base64Ref,
          editType: "upscale",
          parameters: {
            factor,
            providerId: element.genProviderId,
            prompt: upscaleDetailPrompt,
            targetWidth: targetSize.width,
            targetHeight: targetSize.height,
            aspectRatio: targetAspectRatio,
            sourceWidth: sourceSize.width,
            sourceHeight: sourceSize.height,
          },
        });

        if (!result) {
          removeTemporaryElement(newId);
          return;
        }

        await maybeWarnConsistencyDrift(
          result,
          "Upscale result",
          element.genPrompt || upscaleDetailPrompt,
        );
        await applyGeneratedImageToElement(newId, result, true);
      } catch (error) {
        console.error("Upscale failed:", error);
        removeTemporaryElement(newId);
      }
    },
    [
      appendTemporaryClone,
      applyGeneratedImageToElement,
      elementsRef,
      maybeWarnConsistencyDrift,
      removeTemporaryElement,
      selectedElementId,
      setShowUpscalePanel,
      setShowUpscaleResDropdown,
      upscaleDetailPrompt,
      urlToBase64,
    ],
  );

  const handleUndoEraser = useCallback(() => {
    if (eraserHistory.length === 0) {
      return;
    }

    const canvas = eraserCanvasRef.current;
    const maskCanvas = eraserMaskCanvasRef.current;
    if (!canvas || !maskCanvas) {
      return;
    }

    const previous = eraserHistory[eraserHistory.length - 1];
    const context = canvas.getContext("2d");
    const maskContext = maskCanvas.getContext("2d");
    if (!context || !maskContext) {
      return;
    }

    const displayImage = new Image();
    const maskImage = new Image();
    let displayReady = false;
    let maskReady = false;

    const flush = () => {
      if (!displayReady || !maskReady) {
        return;
      }

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(displayImage, 0, 0, canvas.width, canvas.height);
      maskContext.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      maskContext.drawImage(maskImage, 0, 0, maskCanvas.width, maskCanvas.height);

      setEraserMaskDataUrl(previous.mask);
      setEraserHistory((items) => items.slice(0, -1));

      const imageData = maskContext.getImageData(
        0,
        0,
        maskCanvas.width,
        maskCanvas.height,
      ).data;

      let hasPaint = false;
      for (let index = 0; index < imageData.length; index += 4) {
        if (imageData[index] > 0) {
          hasPaint = true;
          break;
        }
      }

      setEraserHasPaint(hasPaint);
    };

    displayImage.onload = () => {
      displayReady = true;
      flush();
    };
    maskImage.onload = () => {
      maskReady = true;
      flush();
    };

    displayImage.src = previous.display;
    maskImage.src = previous.mask;
  }, [
    eraserCanvasRef,
    eraserHistory,
    eraserMaskCanvasRef,
    setEraserHasPaint,
    setEraserHistory,
    setEraserMaskDataUrl,
  ]);

  const handleClearEraser = useCallback(() => {
    const canvas = eraserCanvasRef.current;
    const maskCanvas = eraserMaskCanvasRef.current;
    if (!canvas || !maskCanvas) {
      return;
    }

    const context = canvas.getContext("2d");
    const maskContext = maskCanvas.getContext("2d");
    if (!context || !maskContext) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    maskContext.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    setEraserMaskDataUrl(maskCanvas.toDataURL("image/png"));
    setEraserHistory([]);
    setEraserHasPaint(false);
    eraserLastPointRef.current = null;
  }, [
    eraserCanvasRef,
    eraserLastPointRef,
    eraserMaskCanvasRef,
    setEraserHasPaint,
    setEraserHistory,
    setEraserMaskDataUrl,
  ]);

  const executeMaskedEdit = useCallback(
    async (args: {
      sessionInstruction: string;
      editPrompt: string;
      preservePrompt: string;
      resultLabel: string;
      errorLabel: string;
      generatingType: CanvasElement["generatingType"];
      idPrefix: string;
      driftPrompt?: string;
      constraints?: string[];
    }) => {
      if (!selectedElementId || !eraserMaskDataUrl) {
        resetEraserSession();
        return;
      }

      const element = elementsRef.current.find(
        (item) => item.id === selectedElementId,
      );
      if (!element || !element.url) {
        resetEraserSession();
        return;
      }

      const newId = appendTemporaryClone(
        element,
        args.generatingType,
        args.idPrefix,
        100,
      );

      try {
        const sourceImage = await urlToBase64(
          getElementSourceUrl(element) || element.url,
        );
        await persistEditSession("edit", element, {
          instruction: args.sessionInstruction,
          constraints:
            args.constraints || [
              "Only modify the white masked region",
              "Keep all unmasked regions unchanged",
            ],
        });

        const result = await smartEditSkill({
          sourceUrl: sourceImage,
          maskImage: eraserMaskDataUrl,
          editType: "object-remove",
          parameters: {
            prompt: args.editPrompt,
            preservePrompt: args.preservePrompt,
            editModel: resolveEditModelId(element),
            providerId: element.genProviderId,
            aspectRatio: getClosestAspectRatio(element.width, element.height),
          },
        });

        if (!result) {
          throw new Error(`No result from ${args.idPrefix} edit`);
        }

        await maybeWarnConsistencyDrift(
          result,
          args.resultLabel,
          args.driftPrompt || args.editPrompt,
        );
        await applyGeneratedImageToElement(newId, result, true);
      } catch (error) {
        console.error(args.errorLabel, error);
        removeTemporaryElement(newId);
        addMessage({
          id: Date.now().toString(),
          role: "model",
          text: `${args.errorLabel}: ${error instanceof Error ? error.message : "Unknown error"}`,
          timestamp: Date.now(),
        });
      } finally {
        resetEraserSession();
      }
    },
    [
      addMessage,
      appendTemporaryClone,
      applyGeneratedImageToElement,
      elementsRef,
      eraserMaskDataUrl,
      maybeWarnConsistencyDrift,
      persistEditSession,
      removeTemporaryElement,
      resolveEditModelId,
      resetEraserSession,
      selectedElementId,
      urlToBase64,
    ],
  );

  const handleExecuteEraser = useCallback(async () => {
    await executeMaskedEdit({
      sessionInstruction:
        "Remove objects in the white mask area only. Keep the black mask area unchanged and blend naturally.",
      editPrompt:
        "Remove objects in the white mask area only. Keep the black mask area unchanged. Blend naturally.",
      preservePrompt:
        "Preserve the original product identity, lighting direction, scene composition, typography, and all unmasked areas.",
      resultLabel: "Eraser result",
      errorLabel: "Eraser generation failed",
      generatingType: "eraser",
      idPrefix: "eraser",
      driftPrompt:
        "Remove objects in the white mask area only. Keep the black mask area unchanged and blend naturally.",
    });
  }, [executeMaskedEdit]);

  const handleApplyLocalRedraw = useCallback(
    async (instruction: string) => {
      const trimmedInstruction = instruction.trim();
      if (!trimmedInstruction) {
        resetEraserSession();
        return;
      }

      await executeMaskedEdit({
        sessionInstruction: `Redraw only the white masked area: ${trimmedInstruction}`,
        editPrompt: [
          `Only redraw the content inside the white masked area according to this instruction: ${trimmedInstruction}.`,
          "Do not modify anything outside the masked area.",
          "Match the surrounding edges, lighting, perspective, texture, typography, and material rendering so the edited region blends seamlessly with the original image.",
        ].join(" "),
        preservePrompt:
          "Preserve all unmasked regions exactly. In the white masked region only, redraw the requested content while matching surrounding lighting, perspective, texture, material detail, and composition.",
        resultLabel: "Local redraw result",
        errorLabel: "Local redraw failed",
        generatingType: "eraser",
        idPrefix: "local-redraw",
        driftPrompt: trimmedInstruction,
      });
    },
    [executeMaskedEdit, resetEraserSession],
  );

  const handleVectorRedraw = useCallback(async () => {
    if (!selectedElementId) {
      return;
    }

    const element = elementsRef.current.find(
      (item) => item.id === selectedElementId,
    );
    if (!element || !element.url) {
      return;
    }

    setLocalRedrawPrompt("");
    setShowLocalRedrawPanel(true);
    setEraserMode(true);
  }, [
    elementsRef,
    selectedElementId,
    setEraserMode,
    setLocalRedrawPrompt,
    setShowLocalRedrawPanel,
  ]);

  return {
    handleUpscaleSelect,
    handleUndoEraser,
    handleClearEraser,
    handleCloseEraser: resetEraserSession,
    handleExecuteEraser,
    handleApplyLocalRedraw,
    handleVectorRedraw,
  };
}
