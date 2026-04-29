import { useState } from "react";
import type { CanvasElement, Marker } from "../../../types";
import { getNodeChildren } from "../workspaceNodeGraph";
import { getAllNodeParentIds } from "../workspaceTreeNode";

type AlignMode = "left" | "center" | "right" | "top" | "middle" | "bottom";
type DistributeMode = "horizontal" | "vertical" | "auto";

const AUTO_LAYOUT_GRID_GAP = 32;
const AUTO_LAYOUT_TREE_ROOT_GAP_X = 220;
const AUTO_LAYOUT_TREE_ROOT_GAP_Y = 180;
const AUTO_LAYOUT_TREE_GENERATION_GAP_Y = 160;
const AUTO_LAYOUT_TREE_BRANCH_GAP_X = 160;
const AUTO_LAYOUT_TREE_SIBLING_GAP_Y = 28;

type LayoutBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const sortByVisualOrder = (a: CanvasElement, b: CanvasElement) =>
  a.y - b.y || a.x - b.x || a.id.localeCompare(b.id);

const mergeLayoutBounds = (
  current: LayoutBounds | null,
  next: LayoutBounds,
): LayoutBounds =>
  current
    ? {
        minX: Math.min(current.minX, next.minX),
        minY: Math.min(current.minY, next.minY),
        maxX: Math.max(current.maxX, next.maxX),
        maxY: Math.max(current.maxY, next.maxY),
      }
    : next;

const getLayoutBoundsForElements = (elements: CanvasElement[]): LayoutBounds => ({
  minX: Math.min(...elements.map((element) => element.x)),
  minY: Math.min(...elements.map((element) => element.y)),
  maxX: Math.max(...elements.map((element) => element.x + element.width)),
  maxY: Math.max(...elements.map((element) => element.y + element.height)),
});

type TreeLayoutNode = {
  id: string;
  element: CanvasElement;
  generationChildIds: string[];
  branchChildIds: string[];
  subtreeWidth: number;
  subtreeHeight: number;
};

const buildSelectedTreeLayout = (selected: CanvasElement[]) => {
  const graphCandidates = selected.filter((element) => element.type !== "group");
  const selectedIdSet = new Set(graphCandidates.map((element) => element.id));
  const primaryParentByNodeId = new Map<string, string>();
  const treeNodeIdSet = new Set<string>();
  const layoutNodeMap = new Map<string, TreeLayoutNode>();

  for (const element of graphCandidates) {
    const selectedParentIds = getAllNodeParentIds(element).filter((parentId) =>
      selectedIdSet.has(parentId),
    );
    if (selectedParentIds.length === 0) {
      continue;
    }

    treeNodeIdSet.add(element.id);
    for (const parentId of selectedParentIds) {
      treeNodeIdSet.add(parentId);
    }

    primaryParentByNodeId.set(element.id, selectedParentIds[0]);
  }

  const treeNodes = graphCandidates.filter((element) => treeNodeIdSet.has(element.id));

  for (const element of treeNodes) {
    const childNodes = getNodeChildren(graphCandidates, element.id)
      .filter((child) => treeNodeIdSet.has(child.id))
      .filter((child) => primaryParentByNodeId.get(child.id) === element.id)
      .sort(sortByVisualOrder);

    layoutNodeMap.set(element.id, {
      id: element.id,
      element,
      generationChildIds: childNodes
        .filter((child) => child.nodeLinkKind !== "branch")
        .map((child) => child.id),
      branchChildIds: childNodes
        .filter((child) => child.nodeLinkKind === "branch")
        .map((child) => child.id),
      subtreeWidth: element.width,
      subtreeHeight: element.height,
    });
  }

  const rootIds = treeNodes
    .filter((element) => {
      const parentIds = getAllNodeParentIds(element).filter((parentId) =>
        treeNodeIdSet.has(parentId),
      );
      return parentIds.length === 0;
    })
    .sort(sortByVisualOrder)
    .map((element) => element.id);

  if (rootIds.length === 0 && treeNodes.length > 0) {
    rootIds.push(treeNodes.sort(sortByVisualOrder)[0].id);
  }

  const measureSubtree = (
    nodeId: string,
    visiting = new Set<string>(),
  ): { width: number; height: number } => {
    const node = layoutNodeMap.get(nodeId);
    if (!node) {
      return { width: 0, height: 0 };
    }
    if (visiting.has(nodeId)) {
      return {
        width: node.element.width,
        height: node.element.height,
      };
    }

    const nextVisiting = new Set(visiting);
    nextVisiting.add(nodeId);

    const generationSizes = node.generationChildIds.map((childId) =>
      measureSubtree(childId, nextVisiting),
    );
    const branchSizes = node.branchChildIds.map((childId) =>
      measureSubtree(childId, nextVisiting),
    );

    const generationWidth =
      generationSizes.length > 0
        ? Math.max(...generationSizes.map((size) => size.width))
        : 0;
    const generationHeight =
      generationSizes.length > 0
        ? generationSizes.reduce(
            (sum, size) => sum + size.height + AUTO_LAYOUT_TREE_GENERATION_GAP_Y,
            0,
          )
        : 0;

    const branchWidth =
      branchSizes.length > 0
        ? branchSizes.reduce(
            (sum, size, index) =>
              sum +
              size.width +
              (index > 0 ? AUTO_LAYOUT_TREE_BRANCH_GAP_X : AUTO_LAYOUT_TREE_BRANCH_GAP_X),
            0,
          )
        : 0;
    const branchHeight =
      branchSizes.length > 0
        ? Math.max(...branchSizes.map((size) => size.height))
        : 0;

    node.subtreeWidth = Math.max(
      node.element.width,
      generationWidth,
      node.element.width + branchWidth,
    );
    node.subtreeHeight = Math.max(
      node.element.height + generationHeight,
      node.element.height,
      branchHeight,
    );

    return {
      width: node.subtreeWidth,
      height: node.subtreeHeight,
    };
  };

  for (const rootId of rootIds) {
    measureSubtree(rootId);
  }

  return {
    treeNodeIdSet,
    rootIds,
    layoutNodeMap,
  };
};

const createTreePositionMap = ({
  rootIds,
  layoutNodeMap,
  startX,
  startY,
}: {
  rootIds: string[];
  layoutNodeMap: Map<string, TreeLayoutNode>;
  startX: number;
  startY: number;
}) => {
  const positionMap = new Map<string, { x: number; y: number }>();
  let currentRootX = startX;

  const placeNode = (
    nodeId: string,
    x: number,
    y: number,
    visiting = new Set<string>(),
  ) => {
    const node = layoutNodeMap.get(nodeId);
    if (!node || visiting.has(nodeId)) return;

    positionMap.set(nodeId, { x, y });
    const nextVisiting = new Set(visiting);
    nextVisiting.add(nodeId);

    let currentGenerationY = y + node.element.height + AUTO_LAYOUT_TREE_GENERATION_GAP_Y;
    for (const childId of node.generationChildIds) {
      const child = layoutNodeMap.get(childId);
      if (!child) continue;
      placeNode(
        childId,
        x + (node.element.width - child.element.width) / 2,
        currentGenerationY,
        nextVisiting,
      );
      currentGenerationY += child.subtreeHeight + AUTO_LAYOUT_TREE_SIBLING_GAP_Y;
    }

    let currentBranchX = x + node.element.width + AUTO_LAYOUT_TREE_BRANCH_GAP_X;
    for (const childId of node.branchChildIds) {
      const child = layoutNodeMap.get(childId);
      if (!child) continue;
      placeNode(childId, currentBranchX, y, nextVisiting);
      currentBranchX += child.subtreeWidth + AUTO_LAYOUT_TREE_BRANCH_GAP_X;
    }
  };

  for (const rootId of rootIds) {
    const root = layoutNodeMap.get(rootId);
    if (!root) continue;
    placeNode(rootId, currentRootX, startY);
    currentRootX += root.subtreeWidth + AUTO_LAYOUT_TREE_ROOT_GAP_X;
  }

  const remainingNodes = [...layoutNodeMap.values()]
    .filter((node) => !positionMap.has(node.id))
    .sort((a, b) => sortByVisualOrder(a.element, b.element));

  for (const node of remainingNodes) {
    placeNode(node.id, currentRootX, startY);
    currentRootX += node.subtreeWidth + AUTO_LAYOUT_TREE_ROOT_GAP_X;
  }

  return positionMap;
};

type UseWorkspaceMultiSelectToolsArgs = {
  elementsRef: React.MutableRefObject<CanvasElement[]>;
  markersRef: React.MutableRefObject<Marker[]>;
  selectedElementId: string | null;
  selectedElementIds: string[];
  setElementsSynced: (elements: CanvasElement[]) => void;
  setSelectedElementId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
  saveToHistory: (elements: CanvasElement[], markers: Marker[]) => void;
};

export const useWorkspaceMultiSelectTools = ({
  elementsRef,
  markersRef,
  selectedElementId,
  selectedElementIds,
  setElementsSynced,
  setSelectedElementId,
  setSelectedElementIds,
  saveToHistory,
}: UseWorkspaceMultiSelectToolsArgs) => {
  const [showAlignMenu, setShowAlignMenu] = useState(false);
  const [showSpacingMenu, setShowSpacingMenu] = useState(false);

  const alignSelectedElements = (direction: AlignMode) => {
    const ids = selectedElementIds.length > 1 ? selectedElementIds : [];
    if (ids.length < 2) return;

    const selected = elementsRef.current.filter((element) => ids.includes(element.id));
    const minX = Math.min(...selected.map((element) => element.x));
    const maxX = Math.max(...selected.map((element) => element.x + element.width));
    const minY = Math.min(...selected.map((element) => element.y));
    const maxY = Math.max(...selected.map((element) => element.y + element.height));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const newElements = elementsRef.current.map((element) => {
      if (!ids.includes(element.id)) return element;
      switch (direction) {
        case "left":
          return { ...element, x: minX };
        case "right":
          return { ...element, x: maxX - element.width };
        case "center":
          return { ...element, x: centerX - element.width / 2 };
        case "top":
          return { ...element, y: minY };
        case "bottom":
          return { ...element, y: maxY - element.height };
        case "middle":
          return { ...element, y: centerY - element.height / 2 };
        default:
          return element;
      }
    });

    setElementsSynced(newElements);
    saveToHistory(newElements, markersRef.current);
  };

  const distributeSelectedElements = (direction: DistributeMode) => {
    const ids = selectedElementIds.length > 1 ? selectedElementIds : [];
    if (ids.length < 2) return;

    const selected = elementsRef.current.filter((element) => ids.includes(element.id));

    if (direction === "auto") {
      const sorted = [...selected].sort(sortByVisualOrder);
      const selectedBounds = getLayoutBoundsForElements(sorted);
      const { treeNodeIdSet, rootIds, layoutNodeMap } =
        buildSelectedTreeLayout(sorted);
      const treePositionMap = createTreePositionMap({
        rootIds,
        layoutNodeMap,
        startX: selectedBounds.minX,
        startY: selectedBounds.minY,
      });

      let treeBounds: LayoutBounds | null = null;
      for (const [nodeId, position] of treePositionMap.entries()) {
        const node = layoutNodeMap.get(nodeId);
        if (!node) continue;
        treeBounds = mergeLayoutBounds(treeBounds, {
          minX: position.x,
          minY: position.y,
          maxX: position.x + node.element.width,
          maxY: position.y + node.element.height,
        });
      }

      const nonTreeNodes = sorted.filter((element) => !treeNodeIdSet.has(element.id));
      const nonTreePositionMap = new Map<string, { x: number; y: number }>();
      if (nonTreeNodes.length > 0) {
        const cols = Math.ceil(Math.sqrt(nonTreeNodes.length));
        const maxWidth = Math.max(...nonTreeNodes.map((element) => element.width));
        const maxHeight = Math.max(...nonTreeNodes.map((element) => element.height));
        const startX = treeBounds
          ? treeBounds.maxX + AUTO_LAYOUT_GRID_GAP * 2
          : selectedBounds.minX;
        const startY = selectedBounds.minY;

        nonTreeNodes.forEach((element, index) => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          nonTreePositionMap.set(element.id, {
            x: startX + col * (maxWidth + AUTO_LAYOUT_GRID_GAP),
            y: startY + row * (maxHeight + AUTO_LAYOUT_GRID_GAP),
          });
        });
      }

      const newElements = elementsRef.current.map((element) => {
        const treePosition = treePositionMap.get(element.id);
        if (treePosition) {
          return {
            ...element,
            x: treePosition.x,
            y: treePosition.y,
          };
        }

        const nonTreePosition = nonTreePositionMap.get(element.id);
        if (nonTreePosition) {
          return {
            ...element,
            x: nonTreePosition.x,
            y: nonTreePosition.y,
          };
        }

        return element;
      });

      setElementsSynced(newElements);
      saveToHistory(newElements, markersRef.current);
      return;
    }

    if (direction === "horizontal") {
      const sorted = [...selected].sort((a, b) => a.x - b.x);
      const totalWidth = sorted.reduce((sum, element) => sum + element.width, 0);
      const minX = sorted[0].x;
      const maxRight = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width;
      const totalSpace = maxRight - minX - totalWidth;
      const gap = ids.length > 2 ? totalSpace / (ids.length - 1) : 20;
      let currentX = minX;
      const positionMap: Record<string, number> = {};

      for (const element of sorted) {
        positionMap[element.id] = currentX;
        currentX += element.width + gap;
      }

      const newElements = elementsRef.current.map((element) =>
        positionMap[element.id] !== undefined
          ? { ...element, x: positionMap[element.id] }
          : element,
      );

      setElementsSynced(newElements);
      saveToHistory(newElements, markersRef.current);
      return;
    }

    const sorted = [...selected].sort((a, b) => a.y - b.y);
    const totalHeight = sorted.reduce((sum, element) => sum + element.height, 0);
    const minY = sorted[0].y;
    const maxBottom = sorted[sorted.length - 1].y + sorted[sorted.length - 1].height;
    const totalSpace = maxBottom - minY - totalHeight;
    const gap = ids.length > 2 ? totalSpace / (ids.length - 1) : 20;
    let currentY = minY;
    const positionMap: Record<string, number> = {};

    for (const element of sorted) {
      positionMap[element.id] = currentY;
      currentY += element.height + gap;
    }

    const newElements = elementsRef.current.map((element) =>
      positionMap[element.id] !== undefined
        ? { ...element, y: positionMap[element.id] }
        : element,
    );

    setElementsSynced(newElements);
    saveToHistory(newElements, markersRef.current);
  };

  const createGroup = (isCollapsed: boolean) => {
    if (selectedElementIds.length < 2) return;

    const ids = [...selectedElementIds];
    saveToHistory(elementsRef.current, markersRef.current);
    const groupId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const targets = elementsRef.current.filter((element) => ids.includes(element.id));
    const minX = Math.min(...targets.map((element) => element.x));
    const minY = Math.min(...targets.map((element) => element.y));
    const maxX = Math.max(...targets.map((element) => element.x + element.width));
    const maxY = Math.max(...targets.map((element) => element.y + element.height));
    const maxZ = Math.max(...targets.map((element) => element.zIndex));
    const originalChildData: Record<
      string,
      { x: number; y: number; width: number; height: number; zIndex: number }
    > = {};

    for (const target of targets) {
      originalChildData[target.id] = {
        x: target.x,
        y: target.y,
        width: target.width,
        height: target.height,
        zIndex: target.zIndex,
      };
    }

    const newElements = elementsRef.current.map((element) =>
      ids.includes(element.id) ? { ...element, groupId } : element,
    );

    const groupElement: CanvasElement = {
      id: groupId,
      type: "group",
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      zIndex: maxZ + 1,
      children: ids,
      isCollapsed,
      originalChildData,
    };

    setElementsSynced([...newElements, groupElement]);
    setSelectedElementId(groupId);
    setSelectedElementIds([groupId]);
  };

  const handleGroupSelected = () => createGroup(false);
  const handleMergeSelected = () => createGroup(true);

  const handleUngroupSelected = () => {
    const selected = elementsRef.current.find((element) => element.id === selectedElementId);
    if (!selected || selected.type !== "group") return;

    saveToHistory(elementsRef.current, markersRef.current);
    const childIds = selected.children || [];
    const originalData = selected.originalChildData || {};
    const newElements = elementsRef.current
      .filter((element) => element.id !== selected.id)
      .map((element) => {
        if (!childIds.includes(element.id)) return element;
        const original = originalData[element.id];
        return original
          ? {
              ...element,
              groupId: undefined,
              x: original.x,
              y: original.y,
              width: original.width,
              height: original.height,
              zIndex: original.zIndex,
            }
          : { ...element, groupId: undefined };
      });

    setElementsSynced(newElements);
    setSelectedElementIds(childIds);
    setSelectedElementId(childIds[0] || null);
  };

  return {
    showAlignMenu,
    showSpacingMenu,
    setShowAlignMenu,
    setShowSpacingMenu,
    alignSelectedElements,
    distributeSelectedElements,
    handleGroupSelected,
    handleMergeSelected,
    handleUngroupSelected,
  };
};
