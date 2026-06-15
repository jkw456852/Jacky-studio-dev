import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import {
  extractTextFromImage,
  generateImage,
  validateTransparentCutoutResult,
} from "../../../services/gemini";
import type { ImageGenerationConfig } from "../../../services/gemini";
import { smartEditSkill } from "../../../services/skills/smart-edit.skill";
import type { CanvasElement, ImageTextBlock, ImageTextEditBlock } from "../../../types";
import {
  patchWorkspaceGenerationTrace,
  upsertWorkspaceGenerationTrace,
} from "../browserAgentGenerationTrace";
import type {
  ImageResultSnapshot,
  ImageUserRequestSnapshot,
} from "../../../types/image-generation.types";

type UseWorkspaceElementEditActionsOptions = {
  selectedElementId: string | null;
  elements: CanvasElement[];
  elementsRef: MutableRefObject<CanvasElement[]>;
  setElementsSynced: (nextElements: CanvasElement[]) => void;
  setSelectedElementId: (id: string | null) => void;
  urlToBase64: (url: string) => Promise<string>;
  applyGeneratedImageToElement: (
    elementId: string,
    resultUrl: string,
    keepCurrentSize?: boolean,
  ) => Promise<void>;
  setElementGeneratingState: (elementId: string, isGenerating: boolean) => void;
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
  getDesignConsistencyContext: () => Record<string, unknown> | undefined;
  retryWithConsistencyFix: (
    label: string,
    initialUrl: string,
    rerun: (fixPrompt?: string) => Promise<string | null>,
    anchorOverride?: string,
    genPrompt?: string,
    referenceCount?: number,
  ) => Promise<string>;
  loadElementSourceSize: (element: CanvasElement) => Promise<{ width: number; height: number }>;
  getNearestAspectRatio: (width: number, height: number) => string;
  detectedTexts: ImageTextEditBlock[];
  editedTexts: ImageTextEditBlock[];
  setDetectedTexts: Dispatch<SetStateAction<ImageTextEditBlock[]>>;
  setEditedTexts: Dispatch<SetStateAction<ImageTextEditBlock[]>>;
  setShowTextEditModal: Dispatch<SetStateAction<boolean>>;
  setIsExtractingText: Dispatch<SetStateAction<boolean>>;
  fastEditPrompt: string;
  setShowFastEdit: Dispatch<SetStateAction<boolean>>;
  setFastEditPrompt: Dispatch<SetStateAction<string>>;
};

export function useWorkspaceElementEditActions(
  options: UseWorkspaceElementEditActionsOptions,
) {
  const {
    selectedElementId,
    elements,
    elementsRef,
    setElementsSynced,
    setSelectedElementId,
    urlToBase64,
    applyGeneratedImageToElement,
    setElementGeneratingState,
    persistEditSession,
    maybeWarnConsistencyDrift,
    retryWithConsistencyFix,
    loadElementSourceSize,
    getNearestAspectRatio,
    detectedTexts,
    editedTexts,
    setDetectedTexts,
    setEditedTexts,
    setShowTextEditModal,
    setIsExtractingText,
    fastEditPrompt,
    setShowFastEdit,
    setFastEditPrompt,
  } = options;

  const resolveImageModel = useCallback(
    (element: CanvasElement): ImageGenerationConfig["model"] => {
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
    },
    [],
  );

  const resolveEditModelId = useCallback((element: CanvasElement): string => {
    const model = resolveImageModel(element);
    if (model === "Nano Banana Pro") return "gemini-3-pro-image-preview";
    if (model === "NanoBanana2") return "gemini-3.1-flash-image-preview";
    if (model === "Seedream5.0") return "doubao-seedream-5-0-260128";
    if (model === "gpt-image-2") return "gpt-image-2";
    if (model === "GPT Image 1.5" || model === "gpt-image-1.5-all") return "gpt-image-1.5-all";
    if (model === "Flux.2 Max") return "flux-pro-max";
    return String(model);
  }, [resolveImageModel]);

  const cloneTextEditBlock = (block: ImageTextEditBlock): ImageTextEditBlock => ({
    ...block,
    box: { ...block.box },
  });

  const buildEditableTextBlocks = (blocks: ImageTextBlock[]): ImageTextEditBlock[] =>
    blocks.map((block, index) => ({
      ...block,
      id: block.id || `text-block-${index + 1}`,
      box: { ...block.box },
      editedText: block.text,
      isChanged: false,
    }));

  const hasUsableTextBox = (block: Pick<ImageTextBlock, "box">): boolean =>
    Number(block.box?.width) > 0 && Number(block.box?.height) > 0;

  type TextMaskMode = "bw" | "alpha";

  const resolveTextMaskMode = (element: CanvasElement): TextMaskMode => {
    const model = String(resolveImageModel(element) || "").toLowerCase();
    return model.includes("gpt-image") ? "alpha" : "bw";
  };

  const buildTextMaskDataUrl = (
    width: number,
    height: number,
    blocks: ImageTextEditBlock[],
    mode: TextMaskMode,
  ): string => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("无法创建文字蒙版");
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    if (mode === "alpha") {
      context.fillStyle = "rgba(0, 0, 0, 1)";
      context.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      context.fillStyle = "#000000";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#FFFFFF";
    }

    blocks.forEach((block) => {
      const paddingX = Math.max(8, Math.round(block.box.height * 0.24));
      const paddingY = Math.max(6, Math.round(block.box.height * 0.18));
      const x = Math.max(0, Math.round(block.box.x - paddingX));
      const y = Math.max(0, Math.round(block.box.y - paddingY));
      const right = Math.min(
        canvas.width,
        Math.round(block.box.x + block.box.width + paddingX),
      );
      const bottom = Math.min(
        canvas.height,
        Math.round(block.box.y + block.box.height + paddingY),
      );
      const boxWidth = Math.max(1, right - x);
      const boxHeight = Math.max(1, bottom - y);
      const radius = Math.min(12, Math.max(4, Math.round(boxHeight * 0.2)));

      context.beginPath();
      context.moveTo(x + radius, y);
      context.lineTo(x + boxWidth - radius, y);
      context.quadraticCurveTo(x + boxWidth, y, x + boxWidth, y + radius);
      context.lineTo(x + boxWidth, y + boxHeight - radius);
      context.quadraticCurveTo(
        x + boxWidth,
        y + boxHeight,
        x + boxWidth - radius,
        y + boxHeight,
      );
      context.lineTo(x + radius, y + boxHeight);
      context.quadraticCurveTo(x, y + boxHeight, x, y + boxHeight - radius);
      context.lineTo(x, y + radius);
      context.quadraticCurveTo(x, y, x + radius, y);
      context.closePath();
      if (mode === "alpha") {
        context.save();
        context.globalCompositeOperation = "destination-out";
        context.fill();
        context.restore();
      } else {
        context.fill();
      }
    });

    return canvas.toDataURL("image/png");
  };

  const appendTemporaryClone = useCallback(
    (
      element: CanvasElement,
      generatingType: CanvasElement["generatingType"],
      zIndex: number,
      idPrefix: string,
    ) => {
      const newId = `${idPrefix}-${Date.now()}`;
      const newElement: CanvasElement = {
        ...element,
        id: newId,
        x: element.x + element.width + 20,
        isGenerating: true,
        generatingType,
        url: undefined,
        zIndex,
      };
      const nextElements = [...elementsRef.current, newElement];
      setElementsSynced(nextElements);
      setSelectedElementId(newId);
      return { newId, newElement };
    },
    [elementsRef, setElementsSynced, setSelectedElementId],
  );

  const removeTemporaryElement = useCallback(
    (elementId: string, fallbackSelectedId?: string | null) => {
      const nextElements = elementsRef.current.filter((element) => element.id !== elementId);
      setElementsSynced(nextElements);
      if (fallbackSelectedId !== undefined) {
        setSelectedElementId(fallbackSelectedId);
      }
    },
    [elementsRef, setElementsSynced, setSelectedElementId],
  );

  const handleUpscale = useCallback(async () => {
    if (!selectedElementId) return;
    const element = elementsRef.current.find((item) => item.id === selectedElementId);
    if (!element || !element.url) return;
    setElementGeneratingState(selectedElementId, true);

    try {
      const base64Ref = await urlToBase64(element.url);
      const editIntent =
        element.genPrompt ||
        "Upscale this image while preserving identity, composition, and all visible details.";
      await persistEditSession("edit", element, {
        instruction:
          "Upscale this image while preserving identity, composition, and all visible details.",
        constraints: ["Improve clarity and detail", "Keep subject and composition unchanged"],
      });
      const resultUrl = await smartEditSkill({
        sourceUrl: base64Ref,
        editType: "upscale",
        parameters: {
          factor: 4,
          providerId: element.genProviderId,
          preservePrompt:
            "Preserve identity, composition, textures, text layout, and all visible details while increasing clarity and resolution.",
        },
      });

      if (!resultUrl) {
        throw new Error("No result");
      }

      await maybeWarnConsistencyDrift(resultUrl, "Upscale result", editIntent);
      await applyGeneratedImageToElement(selectedElementId, resultUrl, true);
    } catch (error) {
      console.error(error);
      setElementGeneratingState(selectedElementId, false);
    }
  }, [
    applyGeneratedImageToElement,
    elementsRef,
    maybeWarnConsistencyDrift,
    persistEditSession,
    selectedElementId,
    setElementGeneratingState,
    urlToBase64,
  ]);

  const handleRemoveBg = useCallback(async () => {
    if (!selectedElementId) return;
    const element = elementsRef.current.find((item) => item.id === selectedElementId);
    if (!element || !element.url) return;
    setElementGeneratingState(selectedElementId, true);

    try {
      const base64Ref = await urlToBase64(element.url);
      const editIntent =
        element.genPrompt ||
        "Remove the background while preserving the main subject exactly.";
      await persistEditSession("edit", element, {
        instruction:
          "Remove the background while preserving the main subject exactly.",
        constraints: ["Remove only the background", "Keep subject silhouette and material unchanged"],
      });
      const resultUrl = await smartEditSkill({
        sourceUrl: base64Ref,
        editType: "background-remove",
        parameters: {
          providerId: element.genProviderId,
          preservePrompt:
            "Preserve the exact subject identity, silhouette, materials, and visible details. Remove only the background.",
        },
      });

      if (!resultUrl) {
        throw new Error("No result");
      }

      const validation = await validateTransparentCutoutResult(resultUrl);
      if (!validation.ok) {
        throw new Error(
          validation.reason === "not-data-url"
            ? "当前模型返回的不是透明抠图结果，暂不接受为去背景成功结果"
            : validation.reason === "missing-alpha-output"
              ? "当前结果没有透明背景，去背景失败"
              : "透明背景校验失败",
        );
      }

      await maybeWarnConsistencyDrift(
        resultUrl,
        "Background removal result",
        editIntent,
      );
      await applyGeneratedImageToElement(selectedElementId, resultUrl, true);
    } catch (error) {
      console.error(error);
      setElementGeneratingState(selectedElementId, false);
    }
  }, [
    applyGeneratedImageToElement,
    elementsRef,
    maybeWarnConsistencyDrift,
    persistEditSession,
    selectedElementId,
    setElementGeneratingState,
    urlToBase64,
  ]);

  const handleEditTextClick = useCallback(async () => {
    if (!selectedElementId) return;
    const element = elementsRef.current.find((item) => item.id === selectedElementId);
    if (!element || !element.url) return;

    setIsExtractingText(true);
    try {
      const base64Ref = await urlToBase64(element.url);
      const extractedTexts = await extractTextFromImage(base64Ref);
      const editableTexts = buildEditableTextBlocks(extractedTexts);
      setDetectedTexts(editableTexts.map(cloneTextEditBlock));
      setEditedTexts(editableTexts.map(cloneTextEditBlock));
      setShowTextEditModal(true);
    } catch (error) {
      console.error("Text extraction failed", error);
    } finally {
      setIsExtractingText(false);
    }
  }, [
    elementsRef,
    selectedElementId,
    setDetectedTexts,
    setEditedTexts,
    setIsExtractingText,
    setShowTextEditModal,
    urlToBase64,
  ]);

  const handleApplyTextEdits = useCallback(async () => {
    if (!selectedElementId || detectedTexts.length === 0) return;
    const element = elementsRef.current.find((item) => item.id === selectedElementId);
    if (!element || !element.url) return;

    const changedBlocks: ImageTextEditBlock[] = [];
    editedTexts.forEach((block, index) => {
      const original = detectedTexts[index];
      if (!original) return;
      const editedText = String(block.editedText ?? original.text ?? "").trim();
      if (!editedText || editedText === original.text) {
        return;
      }
      changedBlocks.push({
        ...block,
        text: original.text,
        editedText,
        box: { ...block.box },
        isChanged: true,
      });
    });

    if (changedBlocks.length === 0) return;

    const changes = changedBlocks.map(
      (block) => `Replace text "${block.text}" with "${block.editedText}"`,
    );
    const editPrompt =
      "Edit only the text inside the masked area. " +
      changes.join(". ") +
      ". Match the original font family, weight, size, color, effects, spacing, alignment, perspective and layout as closely as possible. Keep all unmasked regions unchanged.";

    setShowTextEditModal(false);

    const sourceSize = await loadElementSourceSize(element);
    const targetAspectRatio = getNearestAspectRatio(
      sourceSize.width,
      sourceSize.height,
    );
    const maskMode = resolveTextMaskMode(element);
    const { newId } = appendTemporaryClone(
      element,
      "text-edit",
      elements.length + 10,
      "text-edit",
    );
    const traceRequestId = `text-edit-${newId}-${Date.now()}`;

    try {
      const base64Ref = await urlToBase64(element.url);
      const maskedBlocks = changedBlocks.filter(hasUsableTextBox);
      upsertWorkspaceGenerationTrace({
        requestId: traceRequestId,
        requestElementId: newId,
        sourceElementId: element.id,
        targetElementIds: [newId],
        startedAt: Date.now(),
        updatedAt: Date.now(),
        status: "generating",
        sourcePrompt: editPrompt,
        model: String(resolveImageModel(element)),
        aspectRatio: targetAspectRatio,
        imageCount: 1,
        userRequestSnapshot: {
          requestedModel: String(resolveImageModel(element)),
          requestedAspectRatio: targetAspectRatio,
          requestedImageSize: null,
          requestedExactSize: null,
          requestedImageQuality: null,
          referenceCount: 1,
          hasMask: maskedBlocks.length > 0,
        } satisfies ImageUserRequestSnapshot,
        diagnostics: [],
        variantResults: [],
      });
      await persistEditSession("text-edit", element, {
        instruction: editPrompt,
        constraints: maskedBlocks.length > 0
          ? [
              maskMode === "alpha"
                ? "Edit only the transparent masked text regions"
                : "Edit only the white masked text regions",
              "Keep all unmasked regions unchanged",
              "Maintain original typography and layout as much as possible",
            ]
          : [
              "Edit only the text in the image",
              "Keep font style, layout, and background as stable as possible",
            ],
      });

      let resultUrl: string | null;
      if (maskedBlocks.length > 0) {
        const maskImage = buildTextMaskDataUrl(
          sourceSize.width,
          sourceSize.height,
          maskedBlocks,
          maskMode,
        );
        resultUrl = await smartEditSkill({
          sourceUrl: base64Ref,
          maskImage,
          editType: "object-remove",
          parameters: {
            prompt: editPrompt,
            preservePrompt:
              "Preserve all unmasked areas exactly. In the masked area only, replace the original text with the requested new text while matching the original typography, lighting, texture, color and blending.",
            editModel: resolveEditModelId(element),
            providerId: element.genProviderId,
            aspectRatio: targetAspectRatio,
          },
        });
      } else {
        resultUrl = await generateImage({
          prompt: editPrompt,
          model: resolveImageModel(element),
          providerId: element.genProviderId,
          aspectRatio: targetAspectRatio,
          referenceImage: base64Ref,
          onTransportPrepared: (transportRequestSnapshot) => {
            patchWorkspaceGenerationTrace(traceRequestId, {
              updatedAt: Date.now(),
              transportRequestSnapshot,
            });
          },
          onSubmitted: ({ taskId, transportRequestSnapshot }) => {
            patchWorkspaceGenerationTrace(traceRequestId, {
              updatedAt: Date.now(),
              transportRequestSnapshot: transportRequestSnapshot || null,
              resultSnapshot: {
                status: "submitted",
                taskId,
                resultKind: null,
                error: null,
              } satisfies ImageResultSnapshot,
            });
          },
        });
      }

      if (!resultUrl) {
        throw new Error("No result");
      }

      const finalUrl = await retryWithConsistencyFix(
        "Text edit result",
        resultUrl,
        async (fixPrompt?: string) => {
          const nextPrompt = fixPrompt
            ? `${editPrompt}\n\nConsistency fix: ${fixPrompt}`
            : editPrompt;
          if (maskedBlocks.length > 0) {
            const maskImage = buildTextMaskDataUrl(
              sourceSize.width,
              sourceSize.height,
              maskedBlocks,
              maskMode,
            );
            return smartEditSkill({
              sourceUrl: base64Ref,
              maskImage,
              editType: "object-remove",
              parameters: {
                prompt: nextPrompt,
                preservePrompt:
                  "Preserve all unmasked areas exactly. In the masked area only, replace the original text with the requested new text while matching the original typography, lighting, texture, color and blending.",
                editModel: resolveEditModelId(element),
                providerId: element.genProviderId,
                aspectRatio: targetAspectRatio,
              },
            });
          }
          return generateImage({
            prompt: nextPrompt,
            model: resolveImageModel(element),
            providerId: element.genProviderId,
            aspectRatio: targetAspectRatio,
            referenceImage: base64Ref,
          });
        },
        undefined,
        editPrompt,
        1,
      );
      await applyGeneratedImageToElement(newId, finalUrl, true);
      patchWorkspaceGenerationTrace(traceRequestId, {
        updatedAt: Date.now(),
        completedAt: Date.now(),
        status: "completed",
        lastError: null,
        resultSnapshot: {
          status: "completed",
          taskId: null,
          resultKind: String(finalUrl || "").startsWith("data:") ? "data-url" : "remote-url",
          error: null,
        } satisfies ImageResultSnapshot,
      });
    } catch (error) {
      console.error("Text Edit Failed:", error);
      patchWorkspaceGenerationTrace(traceRequestId, {
        updatedAt: Date.now(),
        completedAt: Date.now(),
        status: "failed",
        lastError: error instanceof Error ? error.message : String(error),
        resultSnapshot: {
          status: "failed",
          taskId: null,
          resultKind: null,
          error: error instanceof Error ? error.message : String(error),
        } satisfies ImageResultSnapshot,
      });
      removeTemporaryElement(newId);
    }
  }, [
    appendTemporaryClone,
    applyGeneratedImageToElement,
    detectedTexts,
    editedTexts,
    elements,
    elementsRef,
    getNearestAspectRatio,
    loadElementSourceSize,
    persistEditSession,
    removeTemporaryElement,
    resolveEditModelId,
    resolveImageModel,
    retryWithConsistencyFix,
    selectedElementId,
    setShowTextEditModal,
    urlToBase64,
  ]);

  const handleFastEditRun = useCallback(async () => {
    if (!selectedElementId || !fastEditPrompt) return;
    const element = elementsRef.current.find((item) => item.id === selectedElementId);
    if (!element || !element.url) return;

    setShowFastEdit(false);

    const sourceSize = await loadElementSourceSize(element);
    const targetAspectRatio = getNearestAspectRatio(
      sourceSize.width,
      sourceSize.height,
    );
    const { newId } = appendTemporaryClone(
      element,
      "fast-edit",
      elements.length + 10,
      "fast-edit",
    );

    try {
      const base64Ref = await urlToBase64(element.url);
      await persistEditSession("edit", element, {
        instruction: fastEditPrompt,
        constraints: ["Apply a controlled edit on top of the source image", "Keep subject and composition continuity as much as possible"],
      });
      const editInstruction = [
        `Only apply the requested change: ${fastEditPrompt}`,
        "Keep identity, subject, composition, perspective, lighting, shadows, materials, texture, text layout, and all untouched areas unchanged.",
        "Do not redesign or restyle the whole image.",
      ].join(" ");

      const resultUrl = await smartEditSkill({
        sourceUrl: base64Ref,
        editType: "style-transfer",
        parameters: {
          prompt: editInstruction,
          model: resolveImageModel(element),
          editModel: resolveEditModelId(element),
          providerId: element.genProviderId,
          aspectRatio: targetAspectRatio,
          imageSize: "2K",
          preservePrompt:
            "Preserve identity, composition, perspective, lighting, shadows, materials, text layout, and all untouched regions exactly.",
        },
      });

      if (!resultUrl) {
        throw new Error("No result");
      }

      const finalUrl = await retryWithConsistencyFix(
        "Fast edit result",
        resultUrl,
        async (fixPrompt?: string) =>
          smartEditSkill({
            sourceUrl: base64Ref,
            editType: "style-transfer",
            parameters: {
              prompt: fixPrompt
                ? `${editInstruction}\n\nConsistency fix: ${fixPrompt}`
                : editInstruction,
              model: resolveImageModel(element),
              editModel: resolveEditModelId(element),
              providerId: element.genProviderId,
              aspectRatio: targetAspectRatio,
              imageSize: "2K",
              preservePrompt:
                "Preserve identity, composition, perspective, lighting, shadows, materials, text layout, and all untouched regions exactly.",
            },
          }),
        undefined,
        editInstruction,
        1,
      );
      await applyGeneratedImageToElement(newId, finalUrl, true);
      setFastEditPrompt("");
    } catch (error) {
      console.error(error);
      removeTemporaryElement(newId, element.id);
    }
  }, [
    appendTemporaryClone,
    applyGeneratedImageToElement,
    elements,
    elementsRef,
    fastEditPrompt,
    getNearestAspectRatio,
    loadElementSourceSize,
    persistEditSession,
    removeTemporaryElement,
    resolveEditModelId,
    resolveImageModel,
    retryWithConsistencyFix,
    selectedElementId,
    setFastEditPrompt,
    setShowFastEdit,
    urlToBase64,
  ]);

  return {
    handleUpscale,
    handleRemoveBg,
    handleEditTextClick,
    handleApplyTextEdits,
    handleFastEditRun,
  };
}
