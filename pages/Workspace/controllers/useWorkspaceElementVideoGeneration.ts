import { useCallback, type MutableRefObject } from "react";
import type { CanvasElement, ChatMessage, Marker, VideoModel } from "../../../types";
import { videoGenSkill } from "../../../services/skills/video-gen.skill";

type UseWorkspaceElementVideoGenerationOptions = {
  elementsRef: MutableRefObject<CanvasElement[]>;
  markersRef: MutableRefObject<Marker[]>;
  setElementGeneratingState: (elementId: string, isGenerating: boolean) => void;
  setElementsSynced: (nextElements: CanvasElement[]) => void;
  saveToHistory: (newElements: CanvasElement[], newMarkers: Marker[]) => void;
  addMessage: (message: ChatMessage) => void;
};

const blobUrlToBase64 = async (url: string): Promise<string> => {
  if (!url || url.startsWith("data:")) return url;
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export function useWorkspaceElementVideoGeneration(
  options: UseWorkspaceElementVideoGenerationOptions,
) {
  const {
    elementsRef,
    markersRef,
    setElementGeneratingState,
    setElementsSynced,
    saveToHistory,
    addMessage,
  } = options;

  return useCallback(
    async (elementId: string) => {
      const el = elementsRef.current.find((element) => element.id === elementId);
      if (!el || !el.genPrompt) return;
      setElementGeneratingState(elementId, true);

      try {
        const currentVideoModel = (el.genModel as VideoModel) || "Veo 3.1 Fast";
        const isSora2Model = /sora\s*2/i.test(currentVideoModel);

        let startFrame = el.genStartFrame;
        if (
          !startFrame &&
          el.genModel?.includes("Fast") &&
          el.genVideoRefs?.[0]
        ) {
          startFrame = el.genVideoRefs[0];
        }
        if (startFrame) startFrame = await blobUrlToBase64(startFrame);

        let endFrame = el.genEndFrame;
        if (isSora2Model) {
          endFrame = undefined;
        }
        if (endFrame) endFrame = await blobUrlToBase64(endFrame);

        let refImages: string[] | undefined;
        if (el.genVideoRefs && el.genVideoRefs.length > 0) {
          refImages = await Promise.all(el.genVideoRefs.map(blobUrlToBase64));
          if (isSora2Model && refImages.length > 1) {
            refImages = refImages.slice(0, 1);
          }
        }

        if (isSora2Model && !startFrame && refImages && refImages.length > 0) {
          startFrame = refImages[0];
        }

        const resultUrl = await videoGenSkill({
          prompt: el.genPrompt,
          aspectRatio: el.genAspectRatio || "16:9",
          model: currentVideoModel,
          providerId: el.genProviderId,
          startFrame,
          endFrame,
          referenceImages: refImages,
        });

        if (!resultUrl) {
          setElementGeneratingState(elementId, false);
          addMessage({
            id: Date.now().toString(),
            role: "model",
            text: "Video generation returned no result. Please try again.",
            timestamp: Date.now(),
          });
          return;
        }

        const nextElements = elementsRef.current.map((element) =>
          element.id === elementId
            ? { ...element, isGenerating: false, url: resultUrl }
            : element,
        );
        setElementsSynced(nextElements);
        saveToHistory(nextElements, markersRef.current);
      } catch (error) {
        console.error(error);
        setElementGeneratingState(elementId, false);
        const errMsg =
          error instanceof Error ? error.message : "Unknown error";
        addMessage({
          id: Date.now().toString(),
          role: "model",
          text: `Video generation failed: ${errMsg}`,
          timestamp: Date.now(),
        });
      }
    },
    [
      addMessage,
      elementsRef,
      markersRef,
      saveToHistory,
      setElementGeneratingState,
      setElementsSynced,
    ],
  );
}
