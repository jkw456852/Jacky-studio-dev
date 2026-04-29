import React from "react";
import { Film, Loader2, Video } from "lucide-react";
import type { CanvasElement } from "../../../types";
import {
  WORKSPACE_NODE_CARD_RADIUS,
  WORKSPACE_NODE_EDGE_HANDLE_CLASS,
  WORKSPACE_NODE_HANDLE_BORDER,
  WORKSPACE_NODE_RESIZE_HANDLE_CLASS,
} from "./workspaceNodeStyles";

type ResizeHandle =
  | "nw"
  | "ne"
  | "sw"
  | "se"
  | "w"
  | "e"
  | string;

type WorkspaceCanvasVideoElementProps = {
  element: CanvasElement;
  isSelected: boolean;
  zoom: number;
  onResizeStart: (
    event: React.MouseEvent,
    handle: ResizeHandle,
    elementId: string,
  ) => void;
};

const LABEL_VIDEO = "\u89c6\u9891";
const LABEL_VIDEO_GEN = "\u89c6\u9891\u751f\u6210\u5668";

export const WorkspaceCanvasVideoElement: React.FC<
  WorkspaceCanvasVideoElementProps
> = ({ element, isSelected, zoom, onResizeStart }) => {
  if (element.type !== "gen-video" && element.type !== "video") return null;

  return (
    <div
      className={`relative flex h-full w-full flex-col transition-all ${WORKSPACE_NODE_CARD_RADIUS} ${
        element.url
          ? "overflow-hidden bg-black shadow-[0_18px_42px_rgba(15,23,42,0.24)]"
          : "border border-[#e7e1ff] bg-[linear-gradient(180deg,#faf8ff_0%,#f4f0ff_100%)] shadow-[0_18px_42px_rgba(15,23,42,0.08)]"
      }`}
    >
      {element.url ? (
        <>
          <div className="relative flex h-full w-full items-center justify-center">
            <video
              src={element.url}
              className="h-full w-full object-contain"
              controls
            />
          </div>
          {isSelected ? (
            <>
              <div
                className={`${WORKSPACE_NODE_RESIZE_HANDLE_CLASS} top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nw-resize`}
                style={{ borderColor: WORKSPACE_NODE_HANDLE_BORDER }}
                onMouseDown={(event) => onResizeStart(event, "nw", element.id)}
              />
              <div
                className={`${WORKSPACE_NODE_RESIZE_HANDLE_CLASS} top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-ne-resize`}
                style={{ borderColor: WORKSPACE_NODE_HANDLE_BORDER }}
                onMouseDown={(event) => onResizeStart(event, "ne", element.id)}
              />
              <div
                className={`${WORKSPACE_NODE_RESIZE_HANDLE_CLASS} bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-sw-resize`}
                style={{ borderColor: WORKSPACE_NODE_HANDLE_BORDER }}
                onMouseDown={(event) => onResizeStart(event, "sw", element.id)}
              />
              <div
                className={`${WORKSPACE_NODE_RESIZE_HANDLE_CLASS} right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-se-resize`}
                style={{ borderColor: WORKSPACE_NODE_HANDLE_BORDER }}
                onMouseDown={(event) => onResizeStart(event, "se", element.id)}
              />
              <div
                className={`${WORKSPACE_NODE_EDGE_HANDLE_CLASS} top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize`}
                style={{ borderColor: WORKSPACE_NODE_HANDLE_BORDER }}
                onMouseDown={(event) => onResizeStart(event, "w", element.id)}
              />
              <div
                className={`${WORKSPACE_NODE_EDGE_HANDLE_CLASS} top-1/2 right-0 translate-x-1/2 -translate-y-1/2 cursor-ew-resize`}
                style={{ borderColor: WORKSPACE_NODE_HANDLE_BORDER }}
                onMouseDown={(event) => onResizeStart(event, "e", element.id)}
              />

              <div
                className="pointer-events-none absolute top-0 left-0 z-50 flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-white opacity-0 mix-blend-difference transition-opacity delay-75 duration-200 group-hover:opacity-100"
                style={{
                  transform: `scale(${100 / zoom}) translateY(calc(-100% - 4px))`,
                }}
              >
                <Video size={12} className="opacity-80" />
                <span>{LABEL_VIDEO}</span>
              </div>

              <div
                className="pointer-events-none absolute top-0 right-0 z-50 whitespace-nowrap font-mono text-[10px] font-medium text-white opacity-0 mix-blend-difference transition-opacity delay-75 duration-200 group-hover:opacity-100"
                style={{
                  transform: `scale(${100 / zoom}) translateY(calc(-100% - 6px))`,
                }}
              >
                {Math.round(element.width)} x {Math.round(element.height)}
              </div>
            </>
          ) : null}
        </>
      ) : (
        <>
          {isSelected ? (
            <>
              <div
                className="pointer-events-none absolute top-0 left-0 z-50 flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-gray-700"
                style={{
                  transform: `scale(${100 / zoom}) translateY(calc(-100% - 4px))`,
                }}
              >
                <Video size={12} className="opacity-80" />
                <span>{LABEL_VIDEO_GEN}</span>
              </div>
              <div
                className="pointer-events-none absolute top-0 right-0 z-50 whitespace-nowrap font-mono text-[10px] font-medium text-gray-500"
                style={{
                  transform: `scale(${100 / zoom}) translateY(calc(-100% - 6px))`,
                }}
              >
                {Math.round(element.width)} x {Math.round(element.height)}
              </div>
            </>
          ) : null}
          <div className="relative flex flex-1 items-center justify-center transition-colors group-hover:bg-[#efe8ff]/60">
            {element.isGenerating ? (
              <div
                className="flex flex-col items-center gap-4"
                style={{ transform: `scale(${100 / zoom})` }}
              >
                <Loader2 size={48} className="animate-spin text-[#7C5CFF]" />
                <span className="whitespace-nowrap text-sm font-medium text-[#9a86ff]">
                  Creating magic...
                </span>
              </div>
            ) : (
              <div
                className="flex flex-col items-center gap-2 text-[#cabdff]"
                style={{ transform: `scale(${100 / zoom})` }}
              >
                <Film size={48} strokeWidth={1.5} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
