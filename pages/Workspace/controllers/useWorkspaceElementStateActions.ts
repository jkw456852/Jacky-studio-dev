import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { CanvasElement, Marker } from "../../../types";
import {
  getAllNodeParentIds,
  resolveWorkspaceTreeNodeKind,
  TREE_PROMPT_PARENT_REFERENCE_LIMIT,
} from "../workspaceTreeNode";
import {
  getElementDisplayUrl,
  getElementSourceUrl,
} from "../workspaceShared";

const resolveTreePromptReferenceState = (
  elements: CanvasElement[],
  parentIds: string[],
): Pick<
  CanvasElement,
  "genRefImages" | "genRefImage" | "genRefPreviewImages" | "genRefPreviewImage"
> => {
  const sourceRefs: string[] = [];
  const previewRefs: string[] = [];

  for (const parentId of parentIds) {
    const parent = elements.find((element) => element.id === parentId) || null;
    if (resolveWorkspaceTreeNodeKind(parent) !== "image") {
      continue;
    }

    const sourceRef = String(getElementSourceUrl(parent) || "").trim();
    if (!sourceRef) {
      continue;
    }

    sourceRefs.push(sourceRef);
    previewRefs.push(
      String(getElementDisplayUrl(parent) || sourceRef).trim() || sourceRef,
    );

    if (sourceRefs.length >= TREE_PROMPT_PARENT_REFERENCE_LIMIT) {
      break;
    }
  }

  return {
    genRefImages: sourceRefs.length > 0 ? sourceRefs : undefined,
    genRefImage: sourceRefs[0],
    genRefPreviewImages: previewRefs.length > 0 ? previewRefs : undefined,
    genRefPreviewImage: previewRefs[0],
  };
};

const reconcileDeletedTreeNodeRelations = (
  elements: CanvasElement[],
  deletedIds: Set<string>,
): CanvasElement[] =>
  elements.map((element) => {
    const parentIds = getAllNodeParentIds(element);
    if (parentIds.length === 0) {
      return element;
    }

    const remainingParentIds = parentIds.filter((id) => !deletedIds.has(id));
    const parentIdsChanged = remainingParentIds.length !== parentIds.length;
    const isTreePromptNode = resolveWorkspaceTreeNodeKind(element) === "prompt";

    if (!parentIdsChanged && !isTreePromptNode) {
      return element;
    }

    const nextElement: CanvasElement = {
      ...element,
      nodeParentId: remainingParentIds[0],
      nodeParentIds:
        remainingParentIds.length > 0 ? remainingParentIds : undefined,
      nodeLinkKind:
        remainingParentIds.length > 0 ? element.nodeLinkKind : undefined,
    };

    if (!isTreePromptNode) {
      return nextElement;
    }

    const nextReferenceState = resolveTreePromptReferenceState(
      elements,
      remainingParentIds,
    );

    nextElement.genRefImages = nextReferenceState.genRefImages;
    nextElement.genRefImage = nextReferenceState.genRefImage;
    nextElement.genRefPreviewImages = nextReferenceState.genRefPreviewImages;
    nextElement.genRefPreviewImage = nextReferenceState.genRefPreviewImage;

    return nextElement;
  });

type UseWorkspaceElementStateActionsOptions = {
  selectedElementId: string | null;
  selectedElementIds: string[];
  elementsRef: MutableRefObject<CanvasElement[]>;
  markersRef: MutableRefObject<Marker[]>;
  textEditDraftRef: MutableRefObject<Record<string, string>>;
  setElementsSynced: (nextElements: CanvasElement[]) => void;
  setMarkersSynced: (nextMarkers: Marker[]) => void;
  setSelectedElementId: Dispatch<SetStateAction<string | null>>;
  setSelectedElementIds: Dispatch<SetStateAction<string[]>>;
  saveToHistory: (nextElements: CanvasElement[], nextMarkers: Marker[]) => void;
  getTextWidth: (
    text: string,
    fontSize?: number,
    fontFamily?: string,
    fontWeight?: string | number,
    letterSpacing?: number,
  ) => number;
};

export function useWorkspaceElementStateActions(
  options: UseWorkspaceElementStateActionsOptions,
) {
  const {
    selectedElementId,
    selectedElementIds,
    elementsRef,
    markersRef,
    textEditDraftRef,
    setElementsSynced,
    setMarkersSynced,
    setSelectedElementId,
    setSelectedElementIds,
    saveToHistory,
    getTextWidth,
  } = options;

  const updateElementById = useCallback(
    (targetElementId: string, updates: Partial<CanvasElement>) => {
      const normalizedTargetId = String(targetElementId || "").trim();
      if (!normalizedTargetId) {
        return false;
      }

      let changed = false;
      const nextElements = elementsRef.current.map((element) => {
        if (element.id !== normalizedTargetId) {
          return element;
        }

        const normalizedUpdates = { ...updates };
        let updatedElement = { ...element, ...normalizedUpdates };

        if (
          normalizedUpdates.genAspectRatio &&
          normalizedUpdates.genAspectRatio !== element.genAspectRatio
        ) {
          const [width, height] = normalizedUpdates.genAspectRatio
            .split(":")
            .map(Number);
          const ratio = width / height;
          if (element.width && element.height) {
            const area = element.width * element.height;
            updatedElement.width = Math.sqrt(area * ratio);
            updatedElement.height = Math.sqrt(area / ratio);
          }
        }

        if (element.aspectRatioLocked && !normalizedUpdates.genAspectRatio) {
          if (normalizedUpdates.width && !normalizedUpdates.height) {
            const ratio = element.height / element.width;
            normalizedUpdates.height = normalizedUpdates.width * ratio;
          } else if (normalizedUpdates.height && !normalizedUpdates.width) {
            const ratio = element.width / element.height;
            normalizedUpdates.width = normalizedUpdates.height * ratio;
          }
          updatedElement = { ...element, ...normalizedUpdates };
        }

        changed = true;
        return updatedElement;
      });

      if (!changed) {
        return false;
      }

      setElementsSynced(nextElements);
      saveToHistory(nextElements, markersRef.current);
      return true;
    },
    [
      elementsRef,
      markersRef,
      saveToHistory,
      setElementsSynced,
    ],
  );

  const updateSelectedElement = useCallback(
    (updates: Partial<CanvasElement>) => {
      const targetElementId =
        selectedElementId ||
        (selectedElementIds.length === 1 ? selectedElementIds[0] : null);

      if (!targetElementId) {
        return;
      }

      updateElementById(targetElementId, updates);
    },
    [selectedElementId, selectedElementIds, updateElementById],
  );

  const deleteSelectedElement = useCallback(() => {
    const idsToDelete =
      selectedElementIds.length > 0
        ? selectedElementIds
        : selectedElementId
          ? [selectedElementId]
          : [];
    if (idsToDelete.length === 0) {
      return;
    }

    const deletedIdSet = new Set(idsToDelete);
    const filteredElements = elementsRef.current.filter(
      (element) => !idsToDelete.includes(element.id),
    );
    const nextElements = reconcileDeletedTreeNodeRelations(
      filteredElements,
      deletedIdSet,
    );
    const nextMarkers = markersRef.current.filter(
      (marker) => !idsToDelete.includes(marker.elementId),
    );

    setElementsSynced(nextElements);
    setMarkersSynced(nextMarkers);
    setSelectedElementId(null);
    setSelectedElementIds([]);
    saveToHistory(nextElements, nextMarkers);
  }, [
    elementsRef,
    markersRef,
    saveToHistory,
    selectedElementId,
    selectedElementIds,
    setElementsSynced,
    setMarkersSynced,
    setSelectedElementId,
    setSelectedElementIds,
  ]);

  const commitTextEdit = useCallback(
    (elementId: string, rawText: string) => {
      const nextText = rawText || "";
      const hasVisibleText = nextText.trim().length > 0;
      delete textEditDraftRef.current[elementId];

      const previousElement = elementsRef.current.find(
        (element) => element.id === elementId,
      );
      if (!previousElement || previousElement.type !== "text") {
        return;
      }

      if (!hasVisibleText) {
        const filteredElements = elementsRef.current.filter(
          (element) => element.id !== elementId,
        );
        setElementsSynced(filteredElements);
        setSelectedElementId((previousId) =>
          previousId === elementId ? null : previousId,
        );
        setSelectedElementIds((previousIds) =>
          previousIds.filter((id) => id !== elementId),
        );
        saveToHistory(filteredElements, markersRef.current);
        return;
      }

      const finalWidth = getTextWidth(
        nextText,
        previousElement.fontSize,
        previousElement.fontFamily,
        previousElement.fontWeight,
        previousElement.letterSpacing,
      );

      const nextElements = elementsRef.current.map((element) =>
        element.id === elementId
          ? {
              ...element,
              text: nextText,
              width: Math.max(10, finalWidth),
              height:
                previousElement.fontSize *
                (previousElement.lineHeight || 1.2),
            }
          : element,
      );

      setElementsSynced(nextElements);
      saveToHistory(nextElements, markersRef.current);
    },
    [
      elementsRef,
      getTextWidth,
      markersRef,
      saveToHistory,
      setElementsSynced,
      setSelectedElementId,
      setSelectedElementIds,
      textEditDraftRef,
    ],
  );

  return {
    updateElementById,
    updateSelectedElement,
    deleteSelectedElement,
    commitTextEdit,
  };
}
