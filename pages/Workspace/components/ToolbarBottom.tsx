import React from "react";
import { Folder, Layers, Minus, Plus } from "lucide-react";

interface ToolbarBottomProps {
  leftPanelMode: "layers" | "files" | null;
  setLeftPanelMode: (mode: "layers" | "files" | null) => void;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
}

export const ToolbarBottom: React.FC<ToolbarBottomProps> = ({
  leftPanelMode,
  setLeftPanelMode,
  zoom,
  setZoom,
}) => (
  <div className="absolute bottom-5 left-5 z-40 flex items-center gap-1.5 pointer-events-auto">
    <button
      onClick={() => setLeftPanelMode(leftPanelMode === "layers" ? null : "layers")}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
        leftPanelMode === "layers"
          ? "bg-gray-200/80 text-gray-900"
          : "text-gray-500 hover:bg-white/60 hover:text-gray-800"
      }`}
      title="Layers"
    >
      <Layers size={15} strokeWidth={1.8} />
    </button>
    <button
      onClick={() => setLeftPanelMode(leftPanelMode === "files" ? null : "files")}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
        leftPanelMode === "files"
          ? "bg-gray-200/80 text-gray-900"
          : "text-gray-500 hover:bg-white/60 hover:text-gray-800"
      }`}
      title="Files"
    >
      <Folder size={15} strokeWidth={1.8} />
    </button>
    <div className="mx-0.5 h-4 w-px bg-gray-300/60" />
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => setZoom((value) => Math.max(10, value - 10))}
        className="flex h-6 w-6 items-center justify-center rounded-md text-gray-500 transition hover:bg-white/60 hover:text-black"
      >
        <Minus size={13} />
      </button>
      <span className="w-9 select-none text-center text-[11px] font-medium text-gray-600">
        {Math.round(zoom)}%
      </span>
      <button
        onClick={() => setZoom((value) => Math.min(200, value + 10))}
        className="flex h-6 w-6 items-center justify-center rounded-md text-gray-500 transition hover:bg-white/60 hover:text-black"
      >
        <Plus size={13} />
      </button>
    </div>
  </div>
);
