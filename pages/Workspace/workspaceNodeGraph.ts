import type { CanvasElement, WorkspaceNodeLinkKind } from "../../types";
import { getAllNodeParentIds } from "./workspaceTreeNode";

const GENERATION_VERTICAL_GAP = 160;
const GENERATION_HORIZONTAL_GAP = 36;
const TREE_GENERATION_MAX_COLUMNS = 4;
const TREE_GENERATION_ROW_GAP = 36;
const BRANCH_HORIZONTAL_GAP = 140;

const round = (value: number) => Math.round(value * 100) / 100;

const extractGenerationTimestamp = (id: string): number | null => {
  const match = String(id || "").match(/\d{13}/);
  if (match) {
    return Number(match[0]);
  }
  if (/^\d+$/.test(String(id || "").trim())) {
    return Number(id);
  }
  return null;
};

export const canUseNodeGraphParent = (element: CanvasElement | null | undefined) =>
  Boolean(element && element.type !== "group");

export const getNodeChildren = (
  elements: CanvasElement[],
  parentId: string,
): CanvasElement[] =>
  elements.filter((element) => getAllNodeParentIds(element).includes(parentId));

const getGenerationChildren = (
  elements: CanvasElement[],
  parentId: string,
): CanvasElement[] =>
  getNodeChildren(elements, parentId).filter(
    (element) => element.nodeLinkKind !== "branch",
  );

export const collectNodeDescendantIds = (
  elements: CanvasElement[],
  parentIds: string[],
): string[] => {
  if (parentIds.length === 0) return [];

  const remaining = [...parentIds];
  const descendants: string[] = [];
  const seen = new Set<string>(parentIds);

  while (remaining.length > 0) {
    const currentParentId = remaining.shift()!;
    for (const element of elements) {
      if (
        !getAllNodeParentIds(element).includes(currentParentId) ||
        seen.has(element.id)
      ) {
        continue;
      }
      seen.add(element.id);
      descendants.push(element.id);
      remaining.push(element.id);
    }
  }

  return descendants;
};

export const resolveNodeGraphPlacement = ({
  elements,
  parentElement,
  childWidth,
  childHeight,
  preferredLinkKind = "generation",
}: {
  elements: CanvasElement[];
  parentElement: CanvasElement;
  childWidth: number;
  childHeight: number;
  preferredLinkKind?: WorkspaceNodeLinkKind;
}): {
  x: number;
  y: number;
  nodeParentId: string;
  nodeLinkKind: WorkspaceNodeLinkKind;
} => {
  const children = getNodeChildren(elements, parentElement.id);
  const generationChildren = getGenerationChildren(elements, parentElement.id);

  if (preferredLinkKind === "generation") {
    const rowY =
      generationChildren.length > 0
        ? generationChildren.reduce(
            (minY, child) => Math.min(minY, child.y),
            generationChildren[0].y,
          )
        : parentElement.y + parentElement.height + GENERATION_VERTICAL_GAP;

    return {
      x: round(parentElement.x + (parentElement.width - childWidth) / 2),
      y: round(rowY),
      nodeParentId: parentElement.id,
      nodeLinkKind: "generation",
    };
  }

  if (children.length === 0) {
    return {
      x: round(parentElement.x + (parentElement.width - childWidth) / 2),
      y: round(parentElement.y + parentElement.height + GENERATION_VERTICAL_GAP),
      nodeParentId: parentElement.id,
      nodeLinkKind: "generation",
    };
  }

  const firstGenerationChild =
    children.find((child) => child.nodeLinkKind === "generation") || children[0];
  const rightMostChild = children.reduce((rightMost, current) => {
    const currentRight = current.x + current.width;
    const bestRight = rightMost.x + rightMost.width;
    return currentRight > bestRight ? current : rightMost;
  }, children[0]);

  return {
    x: round(rightMostChild.x + rightMostChild.width + BRANCH_HORIZONTAL_GAP),
    y: round(firstGenerationChild.y),
    nodeParentId: parentElement.id,
    nodeLinkKind: "branch",
  };
};

export const reflowGenerationRowForParent = (
  elements: CanvasElement[],
  parentElement: CanvasElement,
): CanvasElement[] => {
  const generationChildren = getGenerationChildren(elements, parentElement.id)
    .slice()
    .sort((left, right) => {
      const leftTimestamp = extractGenerationTimestamp(left.id);
      const rightTimestamp = extractGenerationTimestamp(right.id);
      if (
        leftTimestamp !== null &&
        rightTimestamp !== null &&
        leftTimestamp !== rightTimestamp
      ) {
        return leftTimestamp - rightTimestamp;
      }
      if (leftTimestamp !== null && rightTimestamp === null) {
        return -1;
      }
      if (leftTimestamp === null && rightTimestamp !== null) {
        return 1;
      }
      if (left.x !== right.x) {
        return left.x - right.x;
      }
      if (left.y !== right.y) {
        return left.y - right.y;
      }
      return left.id.localeCompare(right.id);
    });

  if (generationChildren.length <= 1) {
    return elements;
  }

  const offsetById = new Map<string, { dx: number; dy: number }>();

  const firstRowY = round(
    generationChildren.reduce(
      (minY, child) => Math.min(minY, child.y),
      parentElement.y + parentElement.height + GENERATION_VERTICAL_GAP,
    ),
  );
  const shouldWrapTreeRows = parentElement.treeNodeKind === "prompt";

  if (shouldWrapTreeRows) {
    for (let rowStart = 0; rowStart < generationChildren.length; rowStart += TREE_GENERATION_MAX_COLUMNS) {
      const rowChildren = generationChildren.slice(
        rowStart,
        rowStart + TREE_GENERATION_MAX_COLUMNS,
      );
      if (rowChildren.length === 0) continue;

      const rowWidth =
        rowChildren.reduce((sum, child) => sum + child.width, 0) +
        GENERATION_HORIZONTAL_GAP * Math.max(0, rowChildren.length - 1);
      let cursorX = round(
        parentElement.x + (parentElement.width - rowWidth) / 2,
      );
      const rowY =
        rowStart === 0
          ? firstRowY
          : round(
              firstRowY +
                (Math.floor(rowStart / TREE_GENERATION_MAX_COLUMNS) *
                  (rowChildren[0].height + TREE_GENERATION_ROW_GAP)),
            );

      for (const child of rowChildren) {
        offsetById.set(child.id, {
          dx: round(cursorX - child.x),
          dy: round(rowY - child.y),
        });
        cursorX = round(cursorX + child.width + GENERATION_HORIZONTAL_GAP);
      }
    }
  } else {
    const latestChild = generationChildren[generationChildren.length - 1];
    const latestChildAnchorX = round(
      parentElement.x + (parentElement.width - latestChild.width) / 2,
    );
    const widthToLeft =
      generationChildren
        .slice(0, -1)
        .reduce((sum, child) => sum + child.width, 0) +
      GENERATION_HORIZONTAL_GAP * Math.max(0, generationChildren.length - 1);
    let cursorX = round(latestChildAnchorX - widthToLeft);

    for (const child of generationChildren) {
      offsetById.set(child.id, {
        dx: round(cursorX - child.x),
        dy: round(firstRowY - child.y),
      });
      cursorX = round(cursorX + child.width + GENERATION_HORIZONTAL_GAP);
    }
  }

  if (
    Array.from(offsetById.values()).every(
      ({ dx, dy }) => Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01,
    )
  ) {
    return elements;
  }

  const appliedOffsetByElementId = new Map<string, { dx: number; dy: number }>();

  for (const child of generationChildren) {
    const offset = offsetById.get(child.id);
    if (!offset) {
      continue;
    }

    const subtreeIds = [
      child.id,
      ...collectNodeDescendantIds(elements, [child.id]),
    ];

    for (const subtreeId of subtreeIds) {
      if (!appliedOffsetByElementId.has(subtreeId)) {
        appliedOffsetByElementId.set(subtreeId, offset);
      }
    }
  }

  return elements.map((element) => {
    const offset = appliedOffsetByElementId.get(element.id);
    if (!offset) {
      return element;
    }

    if (Math.abs(offset.dx) < 0.01 && Math.abs(offset.dy) < 0.01) {
      return element;
    }

    return {
      ...element,
      x: round(element.x + offset.dx),
      y: round(element.y + offset.dy),
    };
  });
};

export const getNodeGraphEdgePoints = (
  parent: CanvasElement,
  child: CanvasElement,
) => {
  const startX = round(parent.x + parent.width / 2);
  const startY = round(parent.y + parent.height);
  const endX = round(child.x + child.width / 2);
  const endY = round(child.y);
  const deltaY = Math.max(48, Math.abs(endY - startY) * 0.45);

  return {
    startX,
    startY,
    endX,
    endY,
    control1X: startX,
    control1Y: round(startY + deltaY),
    control2X: endX,
    control2Y: round(endY - deltaY),
  };
};
