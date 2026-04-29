import React from "react";
import { Layers, Trash2, Unlink } from "lucide-react";
import type { CanvasElement } from "../../../types";
import {
  WORKSPACE_NODE_CARD_RADIUS,
  WORKSPACE_NODE_OUTLINE_RADIUS,
  WORKSPACE_NODE_SELECTION_SHADOW,
} from "./workspaceNodeStyles";

type WorkspaceCanvasGroupElementProps = {
  element: CanvasElement;
  isSelected: boolean;
  isLocked: boolean;
  activeTool: string;
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onUngroup: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onDelete: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

const LABEL_GROUP_COLLAPSED = "\u5df2\u5408\u5e76";
const LABEL_ITEMS = "\u4e2a\u56fe\u5c42";
const LABEL_UNGROUP = "\u62c6\u5206";

export const WorkspaceCanvasGroupElement: React.FC<
  WorkspaceCanvasGroupElementProps
> = ({
  element,
  isSelected,
  isLocked,
  activeTool,
  onMouseDown,
  onUngroup,
  onDelete,
}) => {
  return (
    <div
      id={`canvas-el-${element.id}`}
      data-canvas-element-type={element.type}
      className={`absolute ${isLocked ? "pointer-events-none" : ""}`}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        zIndex: element.zIndex,
        cursor:
          activeTool === "select" ? (isLocked ? "default" : "move") : "default",
      }}
      onMouseDown={onMouseDown}
    >
      {isSelected ? (
        <div
          className={`pointer-events-none absolute -inset-[4px] z-10 ${WORKSPACE_NODE_OUTLINE_RADIUS}`}
          style={{ boxShadow: WORKSPACE_NODE_SELECTION_SHADOW }}
        />
      ) : null}

      {element.isCollapsed ? (
        <div
          className={`relative flex h-full w-full items-center justify-center border border-[#d9dce5] bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(243,245,249,0.96)_100%)] backdrop-blur-sm shadow-[0_14px_34px_rgba(15,23,42,0.08)] ${WORKSPACE_NODE_CARD_RADIUS}`}
        >
          <div className="flex items-center gap-2 text-[12px] font-semibold text-[#5b6472]">
            <Layers size={16} />
            <span>
              {LABEL_GROUP_COLLAPSED} · {element.children?.length || 0} {LABEL_ITEMS}
            </span>
          </div>
        </div>
      ) : (
        <div
          className={`pointer-events-none h-full w-full border border-dashed border-[#b8a8ff] bg-[linear-gradient(180deg,rgba(247,243,255,0.82)_0%,rgba(241,236,255,0.48)_100%)] ${WORKSPACE_NODE_CARD_RADIUS}`}
        />
      )}

      {isSelected ? (
        <div className="absolute -top-8 right-0 z-50 flex items-center gap-1">
          <button
            className="flex cursor-pointer items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-xs text-gray-500 shadow-md transition hover:bg-[#f5f3ff] hover:text-[#6d4bff]"
            onClick={onUngroup}
          >
            <Unlink size={12} />
            <span>{LABEL_UNGROUP}</span>
          </button>
          <button
            className="cursor-pointer rounded-full bg-white p-2 shadow-md transition hover:bg-red-50 hover:text-red-500"
            onClick={onDelete}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ) : null}
    </div>
  );
};
