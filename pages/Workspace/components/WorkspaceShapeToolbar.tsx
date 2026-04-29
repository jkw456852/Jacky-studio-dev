import React, { memo } from "react";
import { CornerUpRight, Download, Link2, Unlink } from "lucide-react";
import type { CanvasElement } from "../../../types";

type WorkspaceShapeToolbarProps = {
  selectedElementId: string | null;
  selectedElementIds: string[];
  selectedElement: CanvasElement | null;
  elements: CanvasElement[];
  setElementsSynced: (elements: CanvasElement[]) => void;
  updateSelectedElement: (updates: Partial<CanvasElement>) => void;
};

export const WorkspaceShapeToolbar: React.FC<WorkspaceShapeToolbarProps> = memo(({
  selectedElementId,
  selectedElementIds,
  selectedElement,
  elements,
  setElementsSynced,
  updateSelectedElement,
}) => {
  if (!selectedElementId || selectedElementIds.length > 1) return null;
  const element = selectedElement;
  if (!element || element.type !== "shape") return null;

  const updateFillColor = (fillColor: string) => {
    const newElements = elements.map((item) =>
      item.id === element.id ? { ...item, fillColor } : item,
    );
    setElementsSynced(newElements);
  };

  return (
    <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-lg border border-gray-200 p-1.5 flex items-center gap-3 z-40 animate-in fade-in slide-in-from-top-2 px-3 whitespace-nowrap">
      <div className="relative w-8 h-8 rounded-full overflow-hidden border border-gray-300 shadow-sm cursor-pointer hover:ring-2 hover:ring-gray-200 transition">
        <div
          className="w-full h-full"
          style={{ backgroundColor: element.fillColor }}
        ></div>
        <input
          type="color"
          value={element.fillColor}
          onChange={(e) => updateFillColor(e.target.value)}
          className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      <div className="relative w-8 h-8 rounded-full overflow-hidden border border-gray-300 shadow-sm cursor-pointer hover:ring-2 hover:ring-gray-200 transition bg-white flex items-center justify-center">
        <div
          className="w-5 h-5 rounded-full border-2"
          style={{
            borderColor:
              element.strokeColor === "transparent"
                ? "#E5E7EB"
                : element.strokeColor,
          }}
        ></div>
        {element.strokeColor === "transparent" && (
          <div className="absolute w-full h-0.5 bg-red-400 rotate-45"></div>
        )}
        <input
          type="color"
          value={
            element.strokeColor === "transparent"
              ? "#ffffff"
              : element.strokeColor
          }
          onChange={(e) =>
            updateSelectedElement({ strokeColor: e.target.value })
          }
          className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      <div className="w-px h-6 bg-gray-200"></div>
      <div className="flex items-center gap-2 text-gray-500">
        <CornerUpRight size={16} />
        <input
          type="number"
          value={element.cornerRadius || 0}
          onChange={(e) =>
            updateSelectedElement({ cornerRadius: Number(e.target.value) })
          }
          className="w-12 h-7 bg-gray-50 border border-gray-200 rounded-md text-xs px-1 text-center focus:outline-none focus:border-gray-400"
          min="0"
        />
      </div>
      <div className="w-px h-6 bg-gray-200"></div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-400">W</span>
        <input
          type="number"
          value={Math.round(element.width)}
          onChange={(e) =>
            updateSelectedElement({ width: Number(e.target.value) })
          }
          className="w-14 h-8 bg-gray-50 border border-gray-200 rounded-lg text-sm px-2 text-center focus:outline-none focus:border-gray-400"
        />
      </div>
      <button
        onClick={() =>
          updateSelectedElement({
            aspectRatioLocked: !element.aspectRatioLocked,
          })
        }
        className={`p-1 rounded-md transition ${element.aspectRatioLocked ? "text-blue-500 bg-blue-50" : "text-gray-400 hover:text-black hover:bg-gray-100"}`}
      >
        {element.aspectRatioLocked ? <Link2 size={14} /> : <Unlink size={14} />}
      </button>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-400">H</span>
        <input
          type="number"
          value={Math.round(element.height)}
          onChange={(e) =>
            updateSelectedElement({ height: Number(e.target.value) })
          }
          className="w-14 h-8 bg-gray-50 border border-gray-200 rounded-lg text-sm px-2 text-center focus:outline-none focus:border-gray-400"
        />
      </div>
      <div className="w-px h-6 bg-gray-200"></div>
      <button className="p-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg transition">
        <Download size={16} />
      </button>
    </div>
  );
});
