import React from "react";
import { Eraser, RotateCw, Trash2 } from "lucide-react";
import type { CanvasElement } from "../../../types";

type WorkspaceImageEraserOverlayProps = {
  panelLeft: number;
  panelTop: number;
  panelScale: number;
  brushSize: number;
  eraserHasPaint: boolean;
  isDrawingEraser: boolean;
  canDrawMask: boolean;
  selectedImageEl: CanvasElement;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  cursorRef: React.RefObject<HTMLDivElement>;
  onUndo: () => void;
  onClear: () => void;
  onBrushSizeChange: (size: number) => void;
  onClose: () => void;
  onApply: () => void;
  onPointerEnter: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerDown: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerLeave: (event: React.PointerEvent<HTMLCanvasElement>) => void;
};

export const WorkspaceImageEraserOverlay: React.FC<
  WorkspaceImageEraserOverlayProps
> = ({
  panelLeft,
  panelTop,
  panelScale,
  brushSize,
  eraserHasPaint,
  isDrawingEraser,
  canDrawMask,
  selectedImageEl,
  canvasRef,
  cursorRef,
  onUndo,
  onClear,
  onBrushSizeChange,
  onClose,
  onApply,
  onPointerEnter,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
}) => {
  return (
    <>
      <div
        className="absolute bg-white/95 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.10)] border border-black/[0.06] p-3.5 z-50 animate-in zoom-in-95 fade-in duration-150"
        style={{
          left: panelLeft,
          top: panelTop,
          width: 304,
          transform: `scale(${panelScale})`,
          transformOrigin: "top left",
          pointerEvents: "auto",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Eraser size={14} className="text-gray-900" />
            橡皮工具
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onUndo}
              className="p-1.5 text-gray-500 hover:text-black hover:bg-gray-100 rounded-md transition"
              title="撤销"
            >
              <RotateCw className="-scale-x-100" size={14} />
            </button>
            <button
              onClick={onClear}
              className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-md transition"
              title="清空"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5 mb-3.5">
          <div className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center">
            <div
              className="bg-black rounded-full"
              style={{
                width: Math.max(4, brushSize / 5),
                height: Math.max(4, brushSize / 5),
              }}
            />
          </div>
          <input
            type="range"
            min="5"
            max="100"
            value={brushSize}
            onChange={(e) => onBrushSizeChange(Number(e.target.value))}
            className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
          />
          <div className="w-8 text-[11px] text-gray-500 text-right">
            {brushSize}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            className="h-8 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            取消
          </button>
          <button
            onClick={onApply}
            disabled={!canDrawMask || !eraserHasPaint}
            className="h-8 rounded-lg bg-black text-white text-xs font-medium hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            立即使用
          </button>
        </div>
      </div>

      {canDrawMask && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: selectedImageEl.x,
            top: selectedImageEl.y,
            width: selectedImageEl.width,
            height: selectedImageEl.height,
            zIndex: (selectedImageEl.zIndex || 1) + 1000,
          }}
        >
          <canvas
            ref={canvasRef}
            width={Math.max(1, Math.round(selectedImageEl.width))}
            height={Math.max(1, Math.round(selectedImageEl.height))}
            className="w-full h-full pointer-events-auto"
            style={{
              background: "transparent",
              cursor: "none",
              borderRadius: "12px",
            }}
            onPointerEnter={onPointerEnter}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerLeave}
          />
          <div
            ref={cursorRef}
            className="absolute left-0 top-0 pointer-events-none rounded-full"
            style={{
              width: Math.max(8, brushSize),
              height: Math.max(8, brushSize),
              background: isDrawingEraser
                ? "rgba(0,0,0,0.14)"
                : "rgba(0,0,0,0.08)",
              border: `${brushSize > 42 ? 1 : 2}px solid rgba(255,255,255,0.95)`,
              boxShadow:
                "0 0 0 1px rgba(0,0,0,0.45), 0 8px 20px rgba(0,0,0,0.08)",
              transform: "translate3d(-9999px,-9999px,0)",
              opacity: 0,
              zIndex: 60,
            }}
          />
        </div>
      )}
    </>
  );
};
