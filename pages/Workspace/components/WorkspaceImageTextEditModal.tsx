import React from "react";
import { Loader2, Type, Zap } from "lucide-react";

type WorkspaceImageTextEditModalProps = {
  show: boolean;
  left: number;
  top: number;
  scale: number;
  detectedTexts: string[];
  editedTexts: string[];
  isExtractingText: boolean;
  setEditedTexts: (texts: string[]) => void;
  onClose: () => void;
  onApply: () => void;
};

export const WorkspaceImageTextEditModal: React.FC<
  WorkspaceImageTextEditModalProps
> = ({
  show,
  left,
  top,
  scale,
  detectedTexts,
  editedTexts,
  isExtractingText,
  setEditedTexts,
  onClose,
  onApply,
}) => {
  if (!show) return null;

  return (
    <div
      className="absolute bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-gray-100 p-4 z-[60] w-72 animate-in fade-in slide-in-from-left-2 duration-200 flex flex-col gap-3"
      style={{
        left,
        top,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        pointerEvents: "auto",
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <span className="text-sm font-bold text-gray-900">编辑文字</span>

      {detectedTexts.length > 0 ? (
        <>
          <div className="max-h-56 overflow-y-auto pr-1 flex flex-col gap-2.5 custom-scrollbar">
            {detectedTexts.map((original, idx) => (
              <div key={`${original}-${idx}`} className="flex flex-col gap-1">
                <span className="text-[11px] text-gray-400 font-medium truncate px-0.5">
                  {original}
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    value={editedTexts[idx] ?? original}
                    onChange={(e) => {
                      const nextTexts = [...editedTexts];
                      nextTexts[idx] = e.target.value;
                      setEditedTexts(nextTexts);
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder={original}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
            <button
              onClick={onClose}
              className="flex-1 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition border border-gray-100"
            >
              取消
            </button>
            <button
              onClick={onApply}
              className="flex-1 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-black transition shadow-sm flex items-center justify-center gap-1.5"
            >
              立即使用
              <Zap size={11} fill="currentColor" />
            </button>
          </div>
        </>
      ) : isExtractingText ? (
        <div className="py-6 flex flex-col items-center justify-center text-gray-400 gap-2">
          <Loader2 size={24} className="animate-spin text-blue-500" />
          <span className="text-xs text-gray-500">正在识别图片文字...</span>
        </div>
      ) : (
        <div className="py-6 flex flex-col items-center justify-center text-gray-400 gap-2">
          <Type size={24} className="opacity-30" />
          <span className="text-xs">未检测到可编辑文字</span>
        </div>
      )}
    </div>
  );
};
