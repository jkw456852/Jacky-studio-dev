import React from "react";
import type { CanvasElement } from "../../../types";
import { WORKSPACE_NODE_RESIZE_HANDLE_CLASS } from "./workspaceNodeStyles";

type ResizeHandle =
  | "nw"
  | "ne"
  | "sw"
  | "se"
  | "w"
  | "e"
  | string;

type WorkspaceCanvasTextElementProps = {
  element: CanvasElement;
  isSelected: boolean;
  isEditing: boolean;
  zoom: number;
  elements: CanvasElement[];
  textEditDraftRef: React.MutableRefObject<Record<string, string>>;
  pendingSelectAllTextIdRef: React.MutableRefObject<string | null>;
  setElementsSynced: (elements: CanvasElement[]) => void;
  setEditingTextId: (id: string | null) => void;
  getTextWidth: (
    text: string,
    fontSize: number,
    fontFamily: string,
    fontWeight?: string | number,
    letterSpacing?: number,
  ) => number;
  commitTextEdit: (elementId: string, rawText: string) => void;
  handleResizeStart: (
    event: React.MouseEvent,
    handle: ResizeHandle,
    elementId: string,
  ) => void;
};

export const WorkspaceCanvasTextElement: React.FC<
  WorkspaceCanvasTextElementProps
> = ({
  element,
  isSelected,
  isEditing,
  zoom,
  elements,
  textEditDraftRef,
  pendingSelectAllTextIdRef,
  setElementsSynced,
  setEditingTextId,
  getTextWidth,
  commitTextEdit,
  handleResizeStart,
}) => {
  if (element.type !== "text") return null;

  return (
    <>
      <div className="flex h-full w-full items-start justify-start">
        {isEditing ? (
          <textarea
            autoFocus
            className={`text-inner-target h-full w-full resize-none overflow-visible border-none bg-transparent outline-none ${
              element.textAlign === "left"
                ? "text-left"
                : element.textAlign === "right"
                  ? "text-right"
                  : "text-center"
            }`}
            style={{
              color: element.fillColor,
              fontSize: `${element.fontSize}px`,
              fontWeight: element.fontWeight,
              fontFamily: element.fontFamily,
              lineHeight: element.lineHeight || 1.2,
              textAlign: element.textAlign || "center",
              textDecoration: element.textDecoration || "none",
              letterSpacing: `${element.letterSpacing || 0}px`,
              textTransform: element.textTransform || "none",
              padding: 0,
              margin: 0,
              minHeight: "1em",
              overflow: "hidden",
              whiteSpace: "pre",
              scrollbarWidth: "none",
            }}
            defaultValue={
              textEditDraftRef.current[element.id] ?? element.text ?? ""
            }
            onFocus={(event) => {
              if (pendingSelectAllTextIdRef.current === element.id) {
                event.currentTarget.select();
                pendingSelectAllTextIdRef.current = null;
              }
            }}
            onChange={(event) => {
              const value = event.target.value;
              textEditDraftRef.current[element.id] = value;
              const currentWidth = getTextWidth(
                value,
                element.fontSize,
                element.fontFamily,
                element.fontWeight,
                element.letterSpacing,
              );

              const targetWidth = Math.max(10, currentWidth);
              const targetHeight =
                element.fontSize * (element.lineHeight || 1.2);

              setElementsSynced(
                elements.map((item) =>
                  item.id === element.id
                    ? {
                        ...item,
                        text: value,
                        width: targetWidth,
                        height: targetHeight,
                      }
                    : item,
                ),
              );
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                const prevText = element.text || "";
                textEditDraftRef.current[element.id] = prevText;
                event.currentTarget.value = prevText;
                event.currentTarget.blur();
              }
            }}
            onMouseDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onBlur={(event) => {
              commitTextEdit(element.id, event.currentTarget.value);
              setEditingTextId(null);
            }}
          />
        ) : (
          <div
            className={`text-inner-target flex h-full w-full flex-col justify-start overflow-visible ${
              element.textAlign === "left"
                ? "items-start text-left"
                : element.textAlign === "right"
                  ? "items-end text-right"
                  : "items-center text-center"
            }`}
            style={{
              color: element.fillColor,
              fontSize: `${element.fontSize}px`,
              fontWeight: element.fontWeight,
              fontFamily: element.fontFamily,
              lineHeight: element.lineHeight || 1.2,
              textAlign: element.textAlign || "center",
              textDecoration: element.textDecoration || "none",
              letterSpacing: `${element.letterSpacing || 0}px`,
              textTransform: element.textTransform || "none",
              whiteSpace: "nowrap",
              margin: 0,
              padding: 0,
              width: "100%",
              height: "100%",
            }}
          >
            {element.text || ""}
          </div>
        )}
      </div>

      {isSelected && !isEditing ? (
        <>
          <div
            className={`${WORKSPACE_NODE_RESIZE_HANDLE_CLASS} top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nw-resize`}
            onMouseDown={(event) => handleResizeStart(event, "nw", element.id)}
          />
          <div
            className={`${WORKSPACE_NODE_RESIZE_HANDLE_CLASS} top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-ne-resize`}
            onMouseDown={(event) => handleResizeStart(event, "ne", element.id)}
          />
          <div
            className={`${WORKSPACE_NODE_RESIZE_HANDLE_CLASS} bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-sw-resize`}
            onMouseDown={(event) => handleResizeStart(event, "sw", element.id)}
          />
          <div
            className={`${WORKSPACE_NODE_RESIZE_HANDLE_CLASS} right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-se-resize`}
            onMouseDown={(event) => handleResizeStart(event, "se", element.id)}
          />
          <div
            className="pointer-events-none absolute top-0 right-0 z-50 whitespace-nowrap font-mono text-[10px] font-medium text-gray-500"
            style={{
              transform: `scale(${100 / zoom}) translateY(calc(-100% - 6px))`,
              transformOrigin: "top right",
            }}
          >
            {Math.round(element.width)} x {Math.round(element.height)} ·{" "}
            {Math.round(element.fontSize || 16)}px
          </div>
        </>
      ) : null}
    </>
  );
};
