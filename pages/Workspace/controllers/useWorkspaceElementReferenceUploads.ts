import { useCallback } from "react";
import type { ChangeEvent, MutableRefObject } from "react";
import type { CanvasElement, Marker } from "../../../types";
import {
  compressImage,
  createImagePreviewDataUrl,
  fileToDataUrl,
} from "../workspaceShared";

const REFERENCE_IMAGE_MAX_DIM = 1280;

type UseWorkspaceElementReferenceUploadsOptions = {
  selectedElementId: string | null;
  elementsRef: MutableRefObject<CanvasElement[]>;
  markersRef: MutableRefObject<Marker[]>;
  setElementsSynced: (nextElements: CanvasElement[]) => void;
  saveToHistory: (nextElements: CanvasElement[], nextMarkers: Marker[]) => void;
};

export function useWorkspaceElementReferenceUploads(
  options: UseWorkspaceElementReferenceUploadsOptions,
) {
  const {
    selectedElementId,
    elementsRef,
    markersRef,
    setElementsSynced,
    saveToHistory,
  } = options;

  const updateElementById = useCallback(
    (
      elementId: string,
      updater: (element: CanvasElement) => CanvasElement,
    ) => {
      let changed = false;
      const nextElements = elementsRef.current.map((element) => {
        if (element.id !== elementId) {
          return element;
        }

        changed = true;
        return updater(element);
      });

      if (!changed) {
        return;
      }

      setElementsSynced(nextElements);
      saveToHistory(nextElements, markersRef.current);
    },
    [elementsRef, markersRef, saveToHistory, setElementsSynced],
  );

  const handleRefImageUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>, elementId: string) => {
      const files = event.target.files;
      if (!files || files.length === 0) {
        return;
      }

      const element = elementsRef.current.find((item) => item.id === elementId);
      if (!element) {
        return;
      }

      const currentImages =
        element.genRefImages || (element.genRefImage ? [element.genRefImage] : []);
      const currentPreviewImages =
        element.genRefPreviewImages ||
        (element.genRefPreviewImage ? [element.genRefPreviewImage] : []);
      if (currentImages.length >= 6) {
        return;
      }

      const remainingSlots = 6 - currentImages.length;
      const filesToProcess = Array.from(files).slice(0, remainingSlots);
      const uploadedImages = await Promise.all(
        filesToProcess.map(async (file) => {
          const source = await compressImage(file, REFERENCE_IMAGE_MAX_DIM);
          return {
            source,
            preview: await createImagePreviewDataUrl(source),
          };
        }),
      );
      const nextImages = [...currentImages, ...uploadedImages.map((item) => item.source)];
      const nextPreviewImages = [
        ...currentPreviewImages,
        ...uploadedImages.map((item) => item.preview),
      ];

      updateElementById(elementId, (current) => ({
        ...current,
        genRefImages: nextImages,
        genRefImage: nextImages[0],
        genRefPreviewImages: nextPreviewImages,
        genRefPreviewImage: nextPreviewImages[0],
      }));
    },
    [elementsRef, updateElementById],
  );

  const handleVideoRefUpload = useCallback(
    async (
      event: ChangeEvent<HTMLInputElement>,
      type: "start" | "end" | "ref",
      index?: number,
    ) => {
      const file = event.target.files?.[0];
      if (!file || !selectedElementId) {
        return;
      }

      const result = await fileToDataUrl(file);

      updateElementById(selectedElementId, (element) => {
        if (type === "start") {
          return { ...element, genStartFrame: result };
        }

        if (type === "end") {
          return { ...element, genEndFrame: result };
        }

        const currentRefs = element.genVideoRefs || [];
        if (index !== undefined) {
          const nextRefs = [...currentRefs];
          nextRefs[index] = result;
          return { ...element, genVideoRefs: nextRefs };
        }

        return {
          ...element,
          genVideoRefs: [...currentRefs, result],
        };
      });
    },
    [selectedElementId, updateElementById],
  );

  return {
    handleRefImageUpload,
    handleVideoRefUpload,
  };
}
