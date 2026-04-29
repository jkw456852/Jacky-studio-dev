import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { touchEditSkill } from "../../../services/skills/touch-edit.skill";
import type { CanvasElement } from "../../../types";

type TouchEditPopup = {
  analysis: string;
  x: number;
  y: number;
  elementId: string;
} | null;

type UseWorkspaceTouchEditActionsOptions = {
  elements: CanvasElement[];
  elementsRef: MutableRefObject<CanvasElement[]>;
  touchEditMode: boolean;
  touchEditPopup: TouchEditPopup;
  touchEditInstruction: string;
  setElementsSynced: (nextElements: CanvasElement[]) => void;
  setTouchEditPopup: Dispatch<SetStateAction<TouchEditPopup>>;
  setTouchEditInstruction: Dispatch<SetStateAction<string>>;
  setIsTouchEditing: Dispatch<SetStateAction<boolean>>;
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
  getNearestAspectRatio: (width: number, height: number) => string;
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

export function useWorkspaceTouchEditActions(
  options: UseWorkspaceTouchEditActionsOptions,
) {
  const {
    elements,
    elementsRef,
    touchEditMode,
    touchEditPopup,
    touchEditInstruction,
    setElementsSynced,
    setTouchEditPopup,
    setTouchEditInstruction,
    setIsTouchEditing,
    urlToBase64,
    persistEditSession,
    getNearestAspectRatio,
    maybeWarnConsistencyDrift,
    applyGeneratedImageToElement,
  } = options;

  const handleTouchEditClick = useCallback(
    async (
      elementId: string,
      clickX: number,
      clickY: number,
      screenX: number,
      screenY: number,
    ) => {
      const element = elements.find((item) => item.id === elementId);
      if (!element || !element.url || !touchEditMode) return;

      setIsTouchEditing(true);
      try {
        const base64Ref = await urlToBase64(element.url);
        await persistEditSession("touch-edit", element, {
          instruction: `Analyze local region near (${clickX}, ${clickY}) for precise edit intent.`,
          constraints: [
            "Focus only on the clicked local region",
            "Keep the overall composition and main subject consistent",
          ],
        });

        const result = await touchEditSkill({
          imageData: base64Ref,
          regionX: clickX,
          regionY: clickY,
          regionWidth: 128,
          regionHeight: 128,
          editInstruction: "",
        });

        setTouchEditPopup({
          analysis: result.analysis,
          x: screenX,
          y: screenY,
          elementId,
        });
      } catch (error) {
        console.error("Touch edit analysis failed:", error);
      } finally {
        setIsTouchEditing(false);
      }
    },
    [
      elements,
      persistEditSession,
      setIsTouchEditing,
      setTouchEditPopup,
      touchEditMode,
      urlToBase64,
    ],
  );

  const handleTouchEditExecute = useCallback(async () => {
    if (!touchEditPopup || !touchEditInstruction.trim()) return;

    const element = elementsRef.current.find(
      (item) => item.id === touchEditPopup.elementId,
    );
    if (!element || !element.url) return;

    setIsTouchEditing(true);
    setElementsSynced(
      elementsRef.current.map((item) =>
        item.id === touchEditPopup.elementId
          ? { ...item, isGenerating: true }
          : item,
      ),
    );

    try {
      const base64Ref = await urlToBase64(element.url);
      const aspectRatio = getNearestAspectRatio(element.width, element.height);

      await persistEditSession("touch-edit", element, {
        instruction: touchEditInstruction,
        analysis: touchEditPopup.analysis,
        constraints: [
          "Only edit the requested target region",
          "Keep overall visual continuity unchanged",
        ],
      });

      const result = await touchEditSkill({
        imageData: base64Ref,
        regionX: 0,
        regionY: 0,
        regionWidth: element.width,
        regionHeight: element.height,
        editInstruction: touchEditInstruction,
        aspectRatio,
        preservePrompt:
          "Preserve overall composition, perspective, identity, lighting, materials, typography, and all untouched regions. Apply a localized edit only where requested.",
      });

      if (!result.editedImage) {
        setElementsSynced(
          elementsRef.current.map((item) =>
            item.id === touchEditPopup.elementId
              ? { ...item, isGenerating: false }
              : item,
          ),
        );
        return;
      }

      await maybeWarnConsistencyDrift(
        result.editedImage,
        "Touch edit result",
        element.genPrompt || touchEditInstruction,
      );
      await applyGeneratedImageToElement(
        touchEditPopup.elementId,
        result.editedImage,
        true,
      );
    } catch (error) {
      console.error("Touch edit execute failed:", error);
      setElementsSynced(
        elementsRef.current.map((item) =>
          item.id === touchEditPopup.elementId
            ? { ...item, isGenerating: false }
            : item,
        ),
      );
    } finally {
      setIsTouchEditing(false);
      setTouchEditPopup(null);
      setTouchEditInstruction("");
    }
  }, [
    applyGeneratedImageToElement,
    elementsRef,
    getNearestAspectRatio,
    maybeWarnConsistencyDrift,
    persistEditSession,
    setElementsSynced,
    setIsTouchEditing,
    setTouchEditInstruction,
    setTouchEditPopup,
    touchEditInstruction,
    touchEditPopup,
    urlToBase64,
  ]);

  return {
    handleTouchEditClick,
    handleTouchEditExecute,
  };
}
