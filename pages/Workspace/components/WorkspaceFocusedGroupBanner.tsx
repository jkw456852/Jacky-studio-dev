import React from "react";
import { ChevronLeft } from "lucide-react";
import type { CanvasElement } from "../../../types";

type WorkspaceFocusedGroupBannerProps = {
  focusedGroupId: string | null;
  elements: CanvasElement[];
  onExit: () => void;
};

export const WorkspaceFocusedGroupBanner: React.FC<WorkspaceFocusedGroupBannerProps> = ({
  focusedGroupId,
  elements,
  onExit,
}) => {
  if (!focusedGroupId) return null;

  const focusedGroup = elements.find((element) => element.id === focusedGroupId);

  return (
    <div className="absolute top-[52px] left-0 right-0 px-2 py-1.5 bg-blue-50/90 backdrop-blur-md border-b border-blue-100/50 z-[45] flex items-center justify-between">
      <button
        onClick={onExit}
        className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium text-xs transition"
      >
        <ChevronLeft size={14} /> 退出组视图
      </button>
      <span className="text-[10px] text-blue-400 truncate max-w-[100px]">
        正在编辑: {focusedGroup?.id.slice(0, 8)}...
      </span>
    </div>
  );
};
