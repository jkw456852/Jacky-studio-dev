import React from "react";
import { Trash2 } from "lucide-react";
import type { CanvasElement, WorkspaceNodeInteractionMode } from "../../../types";
import { isWorkspaceTreeNode } from "../workspaceTreeNode";
import {
  WORKSPACE_NODE_SELECTION_RADIUS,
  WORKSPACE_NODE_SELECTION_SHADOW,
} from "./workspaceNodeStyles";

type WorkspaceCanvasElementShellProps = {
  element: CanvasElement;
  nodeInteractionMode: WorkspaceNodeInteractionMode;
  isSelected: boolean;
  isLocked: boolean;
  isCtrlPressed: boolean;
  activeTool: string;
  editingTextId: string | null;
  isDraggingElement: boolean;
  onMouseDown: (event: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onDelete: () => void;
  children: React.ReactNode;
};

export const WorkspaceCanvasElementShell: React.FC<
  WorkspaceCanvasElementShellProps
> = ({
  element,
  nodeInteractionMode,
  isSelected,
  isLocked,
  isCtrlPressed,
  activeTool,
  editingTextId,
  isDraggingElement,
  onMouseDown,
  onDoubleClick,
  onDelete,
  children,
}) => {
  const isTreeNode = isWorkspaceTreeNode(element, nodeInteractionMode);
  const showSelectionOutline =
    isSelected &&
    (element.type !== "text" || editingTextId !== element.id) &&
    !isTreeNode;
  const showDefaultDeleteChip =
    !isTreeNode &&
    (isSelected || isDraggingElement) &&
    editingTextId !== element.id;

  return (
    <div
      id={`canvas-el-${element.id}`}
      data-canvas-element-type={element.type}
      data-node-interaction-mode={element.nodeInteractionMode || "classic"}
      data-tree-node={isTreeNode ? "true" : "false"}
      className={`absolute group ${isLocked ? "pointer-events-none" : ""}`}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        zIndex: element.zIndex,
        cursor:
          isCtrlPressed || activeTool === "mark"
            ? "none"
            : activeTool === "select"
              ? isLocked
                ? "default"
                : "move"
              : activeTool === "text"
                ? "text"
                : "default",
        whiteSpace: element.type === "text" ? "nowrap" : "normal",
        wordBreak: element.type === "text" ? "keep-all" : "break-word",
        overflow:
          element.type === "text" || isTreeNode ? "visible" : "hidden",
      }}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
    >
      {showSelectionOutline && (
        <div
          className="pointer-events-none absolute -inset-[4px] z-10"
          style={{
            borderRadius: WORKSPACE_NODE_SELECTION_RADIUS,
            boxShadow: WORKSPACE_NODE_SELECTION_SHADOW,
          }}
        />
      )}
      {showDefaultDeleteChip && (
        <div className="absolute -top-8 right-0 z-50 cursor-pointer rounded-md bg-white p-1 shadow-md hover:bg-red-50 hover:text-red-500">
          <Trash2
            size={14}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          />
        </div>
      )}
      {children}
    </div>
  );
};
