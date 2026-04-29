import { useCallback, type MutableRefObject } from "react";
import { extractTextFromImage, generateImage } from "../../../services/gemini";
import type { ImageGenerationConfig } from "../../../services/gemini";
import { smartEditSkill } from "../../../services/skills/smart-edit.skill";
import type { CanvasElement } from "../../../types";
import type { DesignTaskMode } from "../../../types/common";

type PersistEditDetails = {
  instruction: string;
  referenceUrls?: string[];
  analysis?: string;
  constraints?: string[];
  researchSummary?: string;
};

type UseWorkspaceTextEditingOptions = {
  selectedElementId: string | null;
  detectedTexts: string[];
  editedTexts: string[];
  fastEditPrompt: string;
  elementsRef: MutableRefObject<CanvasElement[]>;
  setElementsSynced: (nextElements: CanvasElement[]) => void;
  setSelectedElementId: (id: string | null) => void;
  setShowTextEditModal: (show: boolean) => void;
  setIsExtractingText: (value: boolean) => void;
  setDetectedTexts: (texts: string[]) => void;
  setEditedTexts: (texts: string[]) => void;
  setShowFastEdit: (show: boolean) => void;
  setFastEditPrompt: (value: string) => void;
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

export function useWorkspaceTextEditing(options: UseWorkspaceTextEditingOptions) {
  const {
    selectedElementId,
    detectedTexts,
    editedTexts,
    fastEditPrompt,
    elementsRef,
    setElementsSynced,
    setSelectedElementId,
    setShowTextEditModal,
    setIsExtractingText,
    setDetectedTexts,
    setEditedTexts,
    setShowFastEdit,
    setFastEditPrompt,
    urlToBase64,
    loadElementSourceSize,
    getNearestAspectRatio,
    persistEditSession,
    retryWithConsistencyFix,
    applyGeneratedImageToElement,
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

  const handleEditTextClick = useCallback(async () => {
    if (!selectedElementId) return;
    const el = elementsRef.current.find((element) => element.id === selectedElementId);
    if (!el || !el.url) return;

    setIsExtractingText(true);
    try {
      const base64Ref = await urlToBase64(el.url);
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
    const el = elementsRef.current.find((element) => element.id === selectedElementId);
    if (!el || !el.url) return;

    let editPrompt = "Edit the text in the image. ";
    const changes: string[] = [];
    for (let index = 0; index < detectedTexts.length; index++) {
      if (detectedTexts[index] !== editedTexts[index]) {
        changes.push(
          `Replace text "${detectedTexts[index]}" with "${editedTexts[index]}"`,
        );
      }
    }

    if (changes.length === 0) {
      return;
    }

    editPrompt +=
      changes.join(". ") +
      ". Maintain the original font style, size, color and layout as much as possible. Keep the background and all other elements identical.";

    setShowTextEditModal(false);

    const sourceSize = await loadElementSourceSize(el);
    const targetAspectRatio = getNearestAspectRatio(
      sourceSize.width,
      sourceSize.height,
    );

    const newId = `text-edit-${Date.now()}`;
    const newEl: CanvasElement = {
      ...el,
      id: newId,
      x: el.x + el.width + 20,
      isGenerating: true,
      generatingType: "text-edit",
      url: undefined,
      zIndex: elementsRef.current.length + 10,
    };
    setElementsSynced([...elementsRef.current, newEl]);
    setSelectedElementId(newId);

    try {
      const base64Ref = await urlToBase64(el.url);
      await persistEditSession("text-edit", el, {
        instruction: editPrompt,
        constraints: [
          "Only change the text in the image",
          "Keep font style, layout, and background as unchanged as possible",
        ],
      });

      const runTextEdit = (fixPrompt?: string) =>
        generateImage({
          prompt: fixPrompt
            ? `${editPrompt}\n\nConsistency fix: ${fixPrompt}`
            : editPrompt,
          model: resolveImageModel(el),
          providerId: el.genProviderId,
          aspectRatio: targetAspectRatio,
          referenceImage: base64Ref,
        });

      const resultUrl = await runTextEdit();
      if (!resultUrl) {
        throw new Error("No result");
      }

      const finalUrl = await retryWithConsistencyFix(
        "Text edit result",
        resultUrl,
        runTextEdit,
        undefined,
        editPrompt,
        1,
      );
      await applyGeneratedImageToElement(newId, finalUrl, true);
    } catch (error) {
      console.error("Text Edit Failed:", error);
      setElementsSynced(
        elementsRef.current.filter((element) => element.id !== newId),
      );
    }
  }, [
    applyGeneratedImageToElement,
    detectedTexts,
    editedTexts,
    elementsRef,
    getNearestAspectRatio,
    loadElementSourceSize,
    persistEditSession,
    resolveImageModel,
    retryWithConsistencyFix,
    selectedElementId,
    setElementsSynced,
    setSelectedElementId,
    setShowTextEditModal,
    urlToBase64,
  ]);

  const handleFastEditRun = useCallback(async () => {
    if (!selectedElementId || !fastEditPrompt) return;
    const el = elementsRef.current.find((element) => element.id === selectedElementId);
    if (!el || !el.url) return;

    setShowFastEdit(false);

    const sourceSize = await loadElementSourceSize(el);
    const targetAspectRatio = getNearestAspectRatio(
      sourceSize.width,
      sourceSize.height,
    );

    const newId = `fast-edit-${Date.now()}`;
    const newEl: CanvasElement = {
      ...el,
      id: newId,
      x: el.x + el.width + 20,
      isGenerating: true,
      generatingType: "fast-edit",
      url: undefined,
      zIndex: elementsRef.current.length + 10,
    };
    setElementsSynced([...elementsRef.current, newEl]);
    setSelectedElementId(newId);

    try {
      const base64Ref = await urlToBase64(el.url);
      await persistEditSession("edit", el, {
        instruction: fastEditPrompt,
        constraints: [
          "Make a controlled edit on top of the original image",
          "Preserve subject identity and composition continuity",
        ],
      });

      const editInstruction = [
        `Only apply the requested change: ${fastEditPrompt}`,
        "Keep identity, subject, composition, perspective, lighting, shadows, materials, texture, text layout, and all untouched areas unchanged.",
        "Do not redesign or restyle the whole image.",
      ].join(" ");

      const runFastEdit = (fixPrompt?: string) =>
        smartEditSkill({
          sourceUrl: base64Ref,
          editType: "style-transfer",
          parameters: {
            prompt: fixPrompt
              ? `${editInstruction}\n\nConsistency fix: ${fixPrompt}`
              : editInstruction,
            model: resolveImageModel(el),
            editModel: resolveEditModelId(el),
            providerId: el.genProviderId,
            aspectRatio: targetAspectRatio,
            imageSize: "2K",
            preservePrompt:
              "Preserve identity, composition, perspective, lighting, shadows, materials, text layout, and all untouched regions exactly.",
          },
        });

      const resultUrl = await runFastEdit();
      if (!resultUrl) {
        throw new Error("No result");
      }

      const finalUrl = await retryWithConsistencyFix(
        "Fast edit result",
        resultUrl,
        runFastEdit,
        undefined,
        editInstruction,
        1,
      );
      await applyGeneratedImageToElement(newId, finalUrl, true);
      setFastEditPrompt("");
    } catch (error) {
      console.error(error);
      setElementsSynced(
        elementsRef.current.filter((element) => element.id !== newId),
      );
      setSelectedElementId(el.id);
    }
  }, [
    applyGeneratedImageToElement,
    elementsRef,
    fastEditPrompt,
    getNearestAspectRatio,
    loadElementSourceSize,
    persistEditSession,
    resolveEditModelId,
    resolveImageModel,
    retryWithConsistencyFix,
    selectedElementId,
    setElementsSynced,
    setFastEditPrompt,
    setSelectedElementId,
    setShowFastEdit,
    urlToBase64,
  ]);

  return {
    handleEditTextClick,
    handleApplyTextEdits,
    handleFastEditRun,
  };
}
