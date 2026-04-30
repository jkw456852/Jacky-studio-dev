import { useCallback } from "react";
import type { ChangeEvent, MutableRefObject } from "react";
import type { CanvasElement, Marker } from "../../../types";
import {
  DEFAULT_PROXY_MAX_DIM,
  compressImage,
  createImagePreviewDataUrl,
  fileToDataUrl,
  makeImageProxyDataUrl,
} from "../workspaceShared";
import {
  getAllNodeParentIds,
  getWorkspaceImageNodeHeight,
  TREE_PROMPT_PARENT_REFERENCE_LIMIT,
  WORKSPACE_IMAGE_NODE_WIDTH,
} from "../workspaceTreeNode";

const REFERENCE_IMAGE_MAX_DIM = 1280;
const TREE_REFERENCE_PARENT_GAP = 28;
const TREE_REFERENCE_PARENT_VERTICAL_GAP = 124;

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

      const isTreePromptNode =
        element.type === "gen-image" &&
        element.nodeInteractionMode === "branch" &&
        element.treeNodeKind === "prompt";

      if (isTreePromptNode) {
        const parentIds = getAllNodeParentIds(element);
        const existingParentImages = parentIds
          .map((parentId) => elementsRef.current.find((item) => item.id === parentId) || null)
          .filter(
            (item): item is CanvasElement =>
              Boolean(
                item &&
                  item.type === "image" &&
                  item.nodeInteractionMode === "branch" &&
                  item.treeNodeKind === "image",
              ),
          );

        const remainingSlots = Math.max(
          0,
          TREE_PROMPT_PARENT_REFERENCE_LIMIT - existingParentImages.length,
        );
        if (remainingSlots === 0) {
          event.target.value = "";
          return;
        }

        const filesToProcess = Array.from(files).slice(0, remainingSlots);
        if (filesToProcess.length === 0) {
          event.target.value = "";
          return;
        }

        const uploadedParents = await Promise.all(
          filesToProcess.map(async (file, index) => {
            const {
              originalUrl,
              displayUrl,
              originalWidth,
              originalHeight,
            } = await makeImageProxyDataUrl(file, DEFAULT_PROXY_MAX_DIM);
            return {
              id: `tree-ref-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
              type: "image" as const,
              url: displayUrl,
              originalUrl,
              proxyUrl: displayUrl !== originalUrl ? displayUrl : undefined,
              width: WORKSPACE_IMAGE_NODE_WIDTH,
              height: getWorkspaceImageNodeHeight(originalWidth, originalHeight),
              genAspectRatio: `${originalWidth}:${originalHeight}`,
            };
          }),
        );

        const baseZIndex =
          elementsRef.current.reduce(
            (max, current) => Math.max(max, current.zIndex || 0),
            0,
          ) + 1;

        const existingRowY =
          existingParentImages.length > 0
            ? existingParentImages.reduce(
                (minY, current) => Math.min(minY, current.y),
                existingParentImages[0].y,
              )
            : null;
        const maxNewParentHeight = uploadedParents.reduce(
          (max, current) => Math.max(max, current.height),
          0,
        );
        const nextRowY =
          existingRowY !== null
            ? existingRowY
            : Math.round(
                element.y - maxNewParentHeight - TREE_REFERENCE_PARENT_VERTICAL_GAP,
              );

        const totalNewWidth =
          uploadedParents.reduce((sum, current) => sum + current.width, 0) +
          TREE_REFERENCE_PARENT_GAP * Math.max(0, uploadedParents.length - 1);
        const rowStartX =
          existingParentImages.length > 0
            ? Math.round(
                existingParentImages.reduce(
                  (maxRight, current) =>
                    Math.max(maxRight, current.x + current.width),
                  existingParentImages[0].x + existingParentImages[0].width,
                ) + TREE_REFERENCE_PARENT_GAP,
              )
            : Math.round(element.x + (element.width - totalNewWidth) / 2);

        let cursorX = rowStartX;
        const nextParentElements: CanvasElement[] = uploadedParents.map(
          (parent, index) => {
            const nextParent: CanvasElement = {
              id: parent.id,
              type: parent.type,
              url: parent.url,
              originalUrl: parent.originalUrl,
              proxyUrl: parent.proxyUrl,
              x: cursorX,
              y: nextRowY,
              width: parent.width,
              height: parent.height,
              zIndex: baseZIndex + index,
              genAspectRatio: parent.genAspectRatio,
              nodeInteractionMode: "branch",
              treeNodeKind: "image",
              treeNodeTone: element.treeNodeTone,
            };
            cursorX += parent.width + TREE_REFERENCE_PARENT_GAP;
            return nextParent;
          },
        );

        const mergedParentImages = [
          ...existingParentImages,
          ...nextParentElements,
        ].slice(0, TREE_PROMPT_PARENT_REFERENCE_LIMIT);
        const nextParentIds = mergedParentImages.map((item) => item.id);
        const nextSourceRefs = mergedParentImages
          .map((item) => String(item.originalUrl || item.url || "").trim())
          .filter(Boolean);
        const nextPreviewRefs = mergedParentImages
          .map((item) => String(item.url || item.originalUrl || "").trim())
          .filter(Boolean);
        const nextPromptHeight =
          nextSourceRefs.length > 0
            ? Math.max(
                element.height,
                280 + Math.max(0, Math.ceil(nextSourceRefs.length / 4) - 1) * 64,
              )
            : element.height;

        const nextElements = elementsRef.current.map((current) =>
          current.id === elementId
            ? {
                ...current,
                nodeParentId: nextParentIds[0],
                nodeParentIds: nextParentIds,
                nodeLinkKind: "generation",
                genRefImages: nextSourceRefs,
                genRefImage: nextSourceRefs[0],
                genRefPreviewImages: nextPreviewRefs,
                genRefPreviewImage: nextPreviewRefs[0],
                height: nextPromptHeight,
              }
            : current,
        );

        setElementsSynced([...nextElements, ...nextParentElements]);
        saveToHistory([...nextElements, ...nextParentElements], markersRef.current);
        event.target.value = "";
        return;
      }

      const currentImages =
        element.genRefImages || (element.genRefImage ? [element.genRefImage] : []);
      const currentPreviewImages =
        element.genRefPreviewImages ||
        (element.genRefPreviewImage ? [element.genRefPreviewImage] : []);
      if (currentImages.length >= 24) {
        return;
      }

      const remainingSlots = 24 - currentImages.length;
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
      event.target.value = "";
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
