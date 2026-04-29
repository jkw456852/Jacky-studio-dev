import { useCallback, type MutableRefObject } from "react";
import type { CanvasElement } from "../../../types";
import type { DesignTaskMode } from "../../../types/common";
import { smartEditSkill } from "../../../services/skills/smart-edit.skill";

type PersistEditDetails = {
  instruction: string;
  referenceUrls?: string[];
  analysis?: string;
  constraints?: string[];
  researchSummary?: string;
};

type UseWorkspaceElementEditingOptions = {
  selectedElementId: string | null;
  elementsRef: MutableRefObject<CanvasElement[]>;
  setElementGeneratingState: (elementId: string, isGenerating: boolean) => void;
  urlToBase64: (url: string) => Promise<string>;
  persistEditSession: (
    mode: DesignTaskMode,
    element: CanvasElement,
    details: PersistEditDetails,
  ) => Promise<void>;
  maybeWarnConsistencyDrift: (
    candidateUrl: string,
    label: string,
    genPrompt?: string,
    anchorOverride?: string,
  ) => Promise<{ pass: boolean; reasons: string[] }>;
  applyGeneratedImageToElement: (
    elementId: string,
    resultUrl: string,
    keepCurrentSize?: boolean,
  ) => Promise<void>;
};

export function useWorkspaceElementEditing(
  options: UseWorkspaceElementEditingOptions,
) {
  const {
    selectedElementId,
    elementsRef,
    setElementGeneratingState,
    urlToBase64,
    persistEditSession,
    maybeWarnConsistencyDrift,
    applyGeneratedImageToElement,
  } = options;

  const handleUpscale = useCallback(async () => {
    if (!selectedElementId) return;
    const el = elementsRef.current.find((element) => element.id === selectedElementId);
    if (!el || !el.url) return;
    setElementGeneratingState(selectedElementId, true);

    try {
      const base64Ref = await urlToBase64(el.url);
      await persistEditSession("edit", el, {
        instruction:
          "Upscale this image while preserving identity, composition, and all visible details.",
        constraints: [
          "Increase clarity and visible detail",
          "Keep the subject and composition unchanged",
        ],
      });
      const resultUrl = await smartEditSkill({
        sourceUrl: base64Ref,
        editType: "upscale",
        parameters: {
          factor: 4,
          providerId: el.genProviderId,
          preservePrompt:
            "Preserve identity, composition, textures, text layout, and all visible details while increasing clarity and resolution.",
        },
      });

      if (!resultUrl) {
        throw new Error("No result");
      }

      await maybeWarnConsistencyDrift(
        resultUrl,
        "Upscale result",
        el.genPrompt ||
          "Upscale this image while preserving identity, composition, and all visible details.",
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

  const handleRemoveBg = useCallback(async () => {
    if (!selectedElementId) return;
    const el = elementsRef.current.find((element) => element.id === selectedElementId);
    if (!el || !el.url) return;
    setElementGeneratingState(selectedElementId, true);

    try {
      const base64Ref = await urlToBase64(el.url);
      await persistEditSession("edit", el, {
        instruction:
          "Remove the background while preserving the main subject exactly.",
        constraints: [
          "Remove only the background",
          "Keep subject silhouette and material details unchanged",
        ],
      });
      const resultUrl = await smartEditSkill({
        sourceUrl: base64Ref,
        editType: "background-remove",
        parameters: {
          providerId: el.genProviderId,
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
        el.genPrompt ||
          "Remove the background while preserving the main subject exactly.",
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

  return {
    handleUpscale,
    handleRemoveBg,
  };
}
