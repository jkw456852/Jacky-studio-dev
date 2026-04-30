import type {
  CanvasElement,
  WorkspaceNodeInteractionMode,
  WorkspaceTreeNodeKind,
} from "../../types";

export const WORKSPACE_IMAGE_NODE_WIDTH = 380;
export const TREE_NODE_CARD_WIDTH = WORKSPACE_IMAGE_NODE_WIDTH;
export const TREE_NODE_IMAGE_MIN_HEIGHT = 220;
export const TREE_NODE_IMAGE_MAX_HEIGHT = 520;
export const TREE_PROMPT_PARENT_REFERENCE_LIMIT = 24;

export const getAllNodeParentIds = (
  element: CanvasElement | null | undefined,
): string[] =>
  Array.from(
    new Set(
      [
        ...(element?.nodeParentIds || []),
        ...(element?.nodeParentId ? [element.nodeParentId] : []),
      ].filter(Boolean),
    ),
  );

export const getWorkspaceImageNodeHeight = (
  sourceWidth: number,
  sourceHeight: number,
): number => {
  const safeWidth = Math.max(1, sourceWidth);
  const safeHeight = Math.max(1, sourceHeight);
  return Math.max(
    1,
    Math.round((safeHeight / safeWidth) * WORKSPACE_IMAGE_NODE_WIDTH),
  );
};

export const getTreeImageNodeHeight = getWorkspaceImageNodeHeight;

export const resolveWorkspaceTreeNodeKind = (
  element: CanvasElement | null | undefined,
  currentMode?: WorkspaceNodeInteractionMode | null,
): WorkspaceTreeNodeKind | null => {
  if (!element) {
    return null;
  }

  const allowImageInCurrentBranchMode =
    currentMode === "branch" && element.type === "image";

  if (element.nodeInteractionMode !== "branch" && !allowImageInCurrentBranchMode) {
    return null;
  }

  if (element.treeNodeKind === "image" || element.treeNodeKind === "prompt") {
    return element.treeNodeKind;
  }

  if (element.type === "image") {
    return "image";
  }

  if (element.type === "gen-image") {
    return "prompt";
  }

  return null;
};

export const isWorkspaceTreeNode = (
  element: CanvasElement | null | undefined,
  currentMode?: WorkspaceNodeInteractionMode | null,
): boolean => resolveWorkspaceTreeNodeKind(element, currentMode) !== null;
