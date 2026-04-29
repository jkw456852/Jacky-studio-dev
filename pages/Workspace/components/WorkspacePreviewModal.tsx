import React, { useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, X } from "lucide-react";

type WorkspacePreviewModalProps = {
  previewUrl: string | null;
  onClose: () => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const SCALE_STEP = 0.25;

const clampScale = (value: number) =>
  Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

export const WorkspacePreviewModal: React.FC<WorkspacePreviewModalProps> = ({
  previewUrl,
  onClose,
}) => {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!previewUrl) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
      setIsDragging(false);
      return;
    }

    setScale(1);
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);
  }, [previewUrl]);

  useEffect(() => {
    if (!previewUrl) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setScale((value) => clampScale(value + SCALE_STEP));
        return;
      }

      if (event.key === "-") {
        event.preventDefault();
        setScale((value) => clampScale(value - SCALE_STEP));
        return;
      }

      if (event.key === "0") {
        event.preventDefault();
        setScale(1);
        setOffset({ x: 0, y: 0 });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, previewUrl]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!previewUrl || !viewport) return undefined;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setScale((value) =>
        clampScale(value + (event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP)),
      );
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", handleWheel);
    };
  }, [previewUrl]);

  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const updateScale = (nextScale: number) => {
    const clamped = clampScale(nextScale);
    setScale(clamped);
    if (clamped === 1) {
      setOffset({ x: 0, y: 0 });
      setIsDragging(false);
    }
  };

  if (!previewUrl) return null;

  const handleMouseDown: React.MouseEventHandler<HTMLDivElement> = (event) => {
    event.stopPropagation();
    if (scale <= 1) return;

    setIsDragging(true);
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    offsetStartRef.current = offset;
  };

  const handleMouseMove: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (!isDragging) return;

    event.preventDefault();
    const deltaX = event.clientX - dragStartRef.current.x;
    const deltaY = event.clientY - dragStartRef.current.y;
    setOffset({
      x: offsetStartRef.current.x + deltaX,
      y: offsetStartRef.current.y + deltaY,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleClick: React.MouseEventHandler<HTMLDivElement> = (event) => {
    event.stopPropagation();
    if (scale === 1) {
      updateScale(2);
      return;
    }
    resetView();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in duration-200 md:p-8"
      onClick={onClose}
    >
      <div className="absolute left-1/2 top-4 z-[101] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3 py-2 text-white shadow-lg backdrop-blur md:top-5">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            updateScale(scale - SCALE_STEP);
          }}
          disabled={scale <= MIN_SCALE}
          className="rounded-full border border-white/15 bg-white/10 p-2 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          title="\u7f29\u5c0f"
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            resetView();
          }}
          className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold transition hover:bg-white/20"
          title="\u91cd\u7f6e\u89c6\u56fe"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            updateScale(scale + SCALE_STEP);
          }}
          disabled={scale >= MAX_SCALE}
          className="rounded-full border border-white/15 bg-white/10 p-2 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          title="\u653e\u5927"
        >
          <Plus size={16} />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            resetView();
          }}
          className="rounded-full border border-white/15 bg-white/10 p-2 transition hover:bg-white/20"
          title="\u8fd8\u539f\u4f4d\u7f6e"
        >
          <RotateCcw size={16} />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          className="rounded-full border border-white/15 bg-white/10 p-2 transition hover:bg-white/20"
          title="\u5173\u95ed"
        >
          <X size={16} />
        </button>
      </div>

      <div
        className="absolute bottom-4 left-1/2 z-[101] -translate-x-1/2 rounded-full border border-white/10 bg-black/45 px-4 py-2 text-[11px] text-white/90 backdrop-blur"
        onClick={(event) => event.stopPropagation()}
      >
        {"\u6eda\u8f6e\u7f29\u653e\uff0c\u6309\u4f4f\u62d6\u62fd\u67e5\u770b\u7ec6\u8282\uff0c\u53cc\u51fb\u53ef\u5feb\u901f\u653e\u5927\u6216\u8fd8\u539f"}
      </div>

      <div
        ref={viewportRef}
        className="flex h-full w-full items-center justify-center overflow-hidden"
        onClick={(event) => event.stopPropagation()}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          role="presentation"
          className={[
            "max-h-full max-w-full select-none transition-transform duration-150 ease-out",
            scale > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in",
          ].join(" ")}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <img
            src={previewUrl}
            alt="\u9884\u89c8\u5927\u56fe"
            draggable={false}
            className="max-h-[82vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
          />
        </div>
      </div>
    </div>
  );
};
