import React from "react";
import { Loader2 } from "lucide-react";

type WorkspaceImageFastEditPanelProps = {
  show: boolean;
  left: number;
  top: number;
  scale: number;
  prompt: string;
  isGenerating: boolean;
  setPrompt: (value: string) => void;
  onClose: () => void;
  onRun: () => void;
};

export const WorkspaceImageFastEditPanel: React.FC<
  WorkspaceImageFastEditPanelProps
> = ({
  show,
  left,
  top,
  scale,
  prompt,
  isGenerating,
  setPrompt,
  onClose,
  onRun,
}) => {
  if (!show) return null;

  return (
    <div
      id="active-floating-toolbar-fast-edit"
      className="absolute bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-200 w-[320px]"
      style={{
        left,
        top,
        transform: `translateX(-50%) scale(${scale})`,
        transformOrigin: "top center",
        pointerEvents: "auto",
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <textarea
        autoFocus
        className="w-full text-[13px] text-gray-800 placeholder:text-gray-400 bg-transparent border-none outline-none resize-none h-14 mb-2 p-1"
        placeholder="Describe your edit here..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onRun();
          }
          e.stopPropagation();
        }}
      />
      <div className="flex justify-between items-center px-1">
        <span className="text-[11px] text-gray-400 pointer-events-none">
          Hit Return to generate
        </span>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-gray-500 text-xs font-medium hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={onRun}
            disabled={!prompt || isGenerating}
            className="bg-gray-900 hover:bg-black text-white text-xs font-medium px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 size={12} className="animate-spin" />
            ) : null}
            生成{" "}
            {isGenerating ? "" : <span className="opacity-60 font-normal">/</span>}
          </button>
        </div>
      </div>
    </div>
  );
};
