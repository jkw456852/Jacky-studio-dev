import React from "react";
import { Scan, X } from "lucide-react";

type WorkspaceTouchEditIndicatorProps = {
  touchEditMode: boolean;
  onClose: () => void;
};

export const WorkspaceTouchEditIndicator: React.FC<WorkspaceTouchEditIndicatorProps> = ({
  touchEditMode,
  onClose,
}) => {
  if (!touchEditMode) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium">
      <Scan size={16} />
      <span>Touch Edit 模式 · 点击图片区域进行编辑</span>
      <button
        onClick={onClose}
        className="ml-2 w-5 h-5 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition"
      >
        <X size={12} />
      </button>
    </div>
  );
};
