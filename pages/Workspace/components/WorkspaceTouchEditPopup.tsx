import React from "react";
import { Loader2, Scan, X } from "lucide-react";

type TouchEditPopupState = {
  analysis: string;
  x: number;
  y: number;
  elementId: string;
};

type WorkspaceTouchEditPopupProps = {
  popup: TouchEditPopupState | null;
  instruction: string;
  isTouchEditing: boolean;
  onClose: () => void;
  onInstructionChange: (value: string) => void;
  onExecute: () => void;
};

export const WorkspaceTouchEditPopup: React.FC<WorkspaceTouchEditPopupProps> = ({
  popup,
  instruction,
  isTouchEditing,
  onClose,
  onInstructionChange,
  onExecute,
}) => {
  if (!popup) return null;

  return (
    <div
      className="fixed bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-72 z-[60] animate-in fade-in duration-200"
      style={{
        left: Math.min(popup.x, window.innerWidth - 300),
        top: Math.min(popup.y, window.innerHeight - 250),
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-gray-700 font-medium text-sm">
          <Scan size={14} /> 区域分析
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition"
        >
          <X size={14} />
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-3 leading-relaxed">{popup.analysis}</p>
      <input
        value={instruction}
        onChange={(event) => onInstructionChange(event.target.value)}
        placeholder="输入编辑指令，如：换成红色"
        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 mb-2"
        onKeyDown={(event) => {
          if (event.key === "Enter") onExecute();
        }}
      />
      <button
        onClick={onExecute}
        disabled={!instruction.trim() || isTouchEditing}
        className="w-full py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-900 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isTouchEditing ? (
          <>
            <Loader2 size={14} className="animate-spin" /> 处理中...
          </>
        ) : (
          "执行编辑"
        )}
      </button>
    </div>
  );
};
