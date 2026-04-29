import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { extractTextFromImage, generateImage } from "../../../services/gemini";
import type { ImageGenerationConfig } from "../../../services/gemini";
import { smartEditSkill } from "../../../services/skills/smart-edit.skill";
import type { CanvasElement } from "../../../types";

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
  detectedTexts: string[];
  editedTexts: string[];
  setDetectedTexts: Dispatch<SetStateAction<string[]>>;
  setEditedTexts: Dispatch<SetStateAction<string[]>>;
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
      return model === "Nano Banana Pro" ||
        model === "NanoBanana2" ||
        model === "Seedream5.0" ||
        model === "GPT Image 2" ||
        model === "gpt-image-2" ||
        model === "GPT Image 1.5" ||
        model === "gpt-image-1.5-all" ||
        model === "Flux.2 Max"
        ? model
        : "Nano Banana Pro";
    },
    [],
  );

  const resolveEditModelId = useCallback((element: CanvasElement): string => {
    const model = resolveImageModel(element);
    if (model === "Nano Banana Pro") return "gemini-3-pro-image-preview";
    if (model === "NanoBanana2") return "gemini-3.1-flash-image-preview";
    if (model === "Seedream5.0") return "doubao-seedream-5-0-260128";
    if (model === "GPT Image 2" || model === "gpt-image-2") return "gpt-image-2";
    if (model === "GPT Image 1.5" || model === "gpt-image-1.5-all") return "gpt-image-1.5-all";
    if (model === "Flux.2 Max") return "flux-pro-max";
    return String(model);
  }, [resolveImageModel]);

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
      setDetectedTexts(extractedTexts);
      setEditedTexts([...extractedTexts]);
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

    const changes: string[] = [];
    for (let index = 0; index < detectedTexts.length; index++) {
      if (detectedTexts[index] !== editedTexts[index]) {
        changes.push(
          `Replace text "${detectedTexts[index]}" with "${editedTexts[index]}"`,
        );
      }
    }

    if (changes.length === 0) return;

    const editPrompt =
      "Edit the text in the image. " +
      changes.join(". ") +
      ". Maintain the original font style, size, color and layout as much as possible. Keep the background and all other elements identical.";

    setShowTextEditModal(false);

    const sourceSize = await loadElementSourceSize(element);
    const targetAspectRatio = getNearestAspectRatio(
      sourceSize.width,
      sourceSize.height,
    );
    const { newId } = appendTemporaryClone(
      element,
      "text-edit",
      elements.length + 10,
      "text-edit",
    );

    try {
      const base64Ref = await urlToBase64(element.url);
      await persistEditSession("text-edit", element, {
        instruction: editPrompt,
        constraints: ["Edit only the text in the image", "Keep font style, layout, and background as stable as possible"],
      });
      const resultUrl = await generateImage({
        prompt: editPrompt,
        model: resolveImageModel(element),
        providerId: element.genProviderId,
        aspectRatio: targetAspectRatio,
        referenceImage: base64Ref,
      });

      if (!resultUrl) {
        throw new Error("No result");
      }

      const finalUrl = await retryWithConsistencyFix(
        "Text edit result",
        resultUrl,
        async (fixPrompt?: string) =>
          generateImage({
            prompt: fixPrompt
              ? `${editPrompt}\n\nConsistency fix: ${fixPrompt}`
              : editPrompt,
            model: resolveImageModel(element),
            providerId: element.genProviderId,
            aspectRatio: targetAspectRatio,
            referenceImage: base64Ref,
          }),
        undefined,
        editPrompt,
        1,
      );
      await applyGeneratedImageToElement(newId, finalUrl, true);
    } catch (error) {
      console.error("Text Edit Failed:", error);
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
