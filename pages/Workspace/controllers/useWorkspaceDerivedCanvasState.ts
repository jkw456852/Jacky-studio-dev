import { useMemo } from "react";
import type { CanvasElement } from "../../../types";
import { collectNodeDescendantIds } from "../workspaceNodeGraph";
import { resolveWorkspaceTreeNodeKind } from "../workspaceTreeNode";

type UseWorkspaceDerivedCanvasStateArgs = {
  elements: CanvasElement[];
  selectedElementId: string | null;
  focusedGroupId: string | null;
};

export const useWorkspaceDerivedCanvasState = ({
  elements,
  selectedElementId,
  focusedGroupId,
}: UseWorkspaceDerivedCanvasStateArgs) => {
  const elementById = useMemo(() => {
    const map = new Map<string, CanvasElement>();
    for (const element of elements) map.set(element.id, element);
    return map;
  }, [elements]);

  const selectedElement = useMemo(
    () => (selectedElementId ? (elementById.get(selectedElementId) ?? null) : null),
    [selectedElementId, elementById],
  );

  const visibleCanvasElements = useMemo(() => {
    const baseElements = focusedGroupId
      ? elements.filter(
          (element) =>
            (element.groupId === focusedGroupId || element.id === focusedGroupId) &&
            !element.isHidden,
        )
      : elements.filter((element) => !element.isHidden);

    const groupVisibleElements = baseElements.filter((element) => {
      if (!element.groupId || focusedGroupId === element.groupId) return true;
      const parentGroup = elementById.get(element.groupId);
      return !(parentGroup?.isCollapsed || parentGroup?.isHidden);
    });

    const collapsedTreeNodeIds = groupVisibleElements
      .filter(
        (element) =>
          resolveWorkspaceTreeNodeKind(element) === "prompt" &&
          element.treeChildrenCollapsed,
      )
      .map((element) => element.id);

    if (collapsedTreeNodeIds.length === 0) {
      return groupVisibleElements;
    }

    const hiddenDescendantIds = new Set(
      collectNodeDescendantIds(groupVisibleElements, collapsedTreeNodeIds),
    );

    return groupVisibleElements.filter(
      (element) => !hiddenDescendantIds.has(element.id),
    );
  }, [elementById, elements, focusedGroupId]);

  const rootElements = useMemo(
    () => elements.filter((element) => !element.groupId),
    [elements],
  );

  return {
    elementById,
    selectedElement,
    visibleCanvasElements,
    rootElements,
  };
};
