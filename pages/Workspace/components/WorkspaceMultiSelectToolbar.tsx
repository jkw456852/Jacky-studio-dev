import React from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowUp,
  Box,
  ChevronDown,
  Download,
  Layers,
  Layout,
  Minus,
} from "lucide-react";
import type { CanvasElement } from "../../../types";

type AlignMode = "left" | "right" | "center" | "top" | "bottom" | "middle";
type DistributeMode = "horizontal" | "vertical" | "auto";

type WorkspaceMultiSelectToolbarProps = {
  selectedElementIds: string[];
  elements: CanvasElement[];
  isDraggingElement: boolean;
  dragOffsetsRef: React.MutableRefObject<Record<string, { x: number; y: number }>>;
  zoom: number;
  showAlignMenu: boolean;
  showSpacingMenu: boolean;
  setShowAlignMenu: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSpacingMenu: React.Dispatch<React.SetStateAction<boolean>>;
  alignSelectedElements: (mode: AlignMode) => void;
  distributeSelectedElements: (mode: DistributeMode) => void;
  handleDownload: () => void;
  handleGroupSelected: () => void;
  handleMergeSelected: () => void;
};

export const WorkspaceMultiSelectToolbar: React.FC<
  WorkspaceMultiSelectToolbarProps
> = ({
  selectedElementIds,
  elements,
  isDraggingElement,
  dragOffsetsRef,
  zoom,
  showAlignMenu,
  showSpacingMenu,
  setShowAlignMenu,
  setShowSpacingMenu,
  alignSelectedElements,
  distributeSelectedElements,
  handleDownload,
  handleGroupSelected,
  handleMergeSelected,
}) => {
  if (selectedElementIds.length < 2) return null;

  const selectedElements = elements.filter((el) =>
    selectedElementIds.includes(el.id),
  );
  if (selectedElements.length === 0) return null;

  const getPosition = (el: CanvasElement) => {
    const dragPos = isDraggingElement ? dragOffsetsRef.current[el.id] : null;
    return { x: dragPos ? dragPos.x : el.x, y: dragPos ? dragPos.y : el.y };
  };

  const minX = Math.min(...selectedElements.map((el) => getPosition(el).x));
  const minY = Math.min(...selectedElements.map((el) => getPosition(el).y));
  const maxX = Math.max(
    ...selectedElements.map((el) => getPosition(el).x + el.width),
  );

  const canvasCenterX = (minX + maxX) / 2;
  const counterScale = 100 / zoom;
  const topToolbarTop = minY - 52 * counterScale;

  return (
    <div
      id="active-floating-toolbar"
      className={`absolute bg-white rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.1)] border border-gray-100 px-2 py-1.5 flex items-center gap-1 z-50 ${isDraggingElement ? "" : "animate-in fade-in zoom-in-95 duration-200"} whitespace-nowrap`}
      style={{
        left: canvasCenterX,
        top: topToolbarTop,
        transform: `translateX(-50%) scale(${counterScale})`,
        transformOrigin: "bottom center",
        pointerEvents: "auto",
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => distributeSelectedElements("auto")}
        className="px-2 py-1.5 text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors"
        title="自动排列 Shift+A"
      >
        <Layout size={14} /> 自动布局
      </button>

      <div className="w-px h-5 bg-gray-200"></div>

      <div className="relative">
        <button
          onClick={() => {
            setShowAlignMenu(!showAlignMenu);
            setShowSpacingMenu(false);
          }}
          className={`px-2 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors ${showAlignMenu ? "bg-gray-100 text-black" : "text-gray-600 hover:text-black hover:bg-gray-50"}`}
        >
          <AlignLeft size={14} /> 对齐 <ChevronDown size={10} />
        </button>

        {showAlignMenu && (
          <div className="absolute top-full mt-2 left-0 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-[60] animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => {
                alignSelectedElements("left");
                setShowAlignMenu(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-sm text-gray-700 transition"
            >
              <span className="flex items-center gap-2">
                <AlignLeft size={14} /> 左对齐
              </span>
              <span className="text-xs text-gray-400">Alt + A</span>
            </button>
            <button
              onClick={() => {
                alignSelectedElements("center");
                setShowAlignMenu(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-sm text-gray-700 transition"
            >
              <span className="flex items-center gap-2">
                <AlignCenter size={14} /> 水平居中
              </span>
              <span className="text-xs text-gray-400">Alt + H</span>
            </button>
            <button
              onClick={() => {
                alignSelectedElements("right");
                setShowAlignMenu(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-sm text-gray-700 transition"
            >
              <span className="flex items-center gap-2">
                <AlignRight size={14} /> 右对齐
              </span>
              <span className="text-xs text-gray-400">Alt + D</span>
            </button>
            <div className="h-px bg-gray-100 my-1"></div>
            <button
              onClick={() => {
                alignSelectedElements("top");
                setShowAlignMenu(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-sm text-gray-700 transition"
            >
              <span className="flex items-center gap-2">
                <ArrowUp size={14} /> 顶部对齐
              </span>
              <span className="text-xs text-gray-400">Alt + W</span>
            </button>
            <button
              onClick={() => {
                alignSelectedElements("middle");
                setShowAlignMenu(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-sm text-gray-700 transition"
            >
              <span className="flex items-center gap-2">
                <Minus size={14} /> 垂直居中
              </span>
              <span className="text-xs text-gray-400">Alt + V</span>
            </button>
            <button
              onClick={() => {
                alignSelectedElements("bottom");
                setShowAlignMenu(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-sm text-gray-700 transition"
            >
              <span className="flex items-center gap-2">
                <ArrowUp size={14} className="rotate-180" /> 底部对齐
              </span>
              <span className="text-xs text-gray-400">Alt + S</span>
            </button>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => {
            setShowSpacingMenu(!showSpacingMenu);
            setShowAlignMenu(false);
          }}
          className={`px-2 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors ${showSpacingMenu ? "bg-gray-100 text-black" : "text-gray-600 hover:text-black hover:bg-gray-50"}`}
        >
          <Minus size={14} /> 间距 <ChevronDown size={10} />
        </button>

        {showSpacingMenu && (
          <div className="absolute top-full mt-2 left-0 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-[60] animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => {
                distributeSelectedElements("horizontal");
                setShowSpacingMenu(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-sm text-gray-700 transition"
            >
              <span className="flex items-center gap-2">
                <Minus size={14} /> 水平间距
              </span>
              <span className="text-xs text-gray-400">Shift + H</span>
            </button>
            <button
              onClick={() => {
                distributeSelectedElements("vertical");
                setShowSpacingMenu(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-sm text-gray-700 transition"
            >
              <span className="flex items-center gap-2">
                <Minus size={14} className="rotate-90" /> 垂直间距
              </span>
              <span className="text-xs text-gray-400">Shift + V</span>
            </button>
            <button
              onClick={() => {
                distributeSelectedElements("auto");
                setShowSpacingMenu(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-sm text-gray-700 transition"
            >
              <span className="flex items-center gap-2">
                <Layout size={14} /> 自动排列
              </span>
              <span className="text-xs text-gray-400">Shift + A</span>
            </button>
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-gray-200"></div>

      <button
        onClick={handleDownload}
        className="p-1.5 text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg flex items-center justify-center transition-colors"
        title="下载"
      >
        <Download size={14} />
      </button>

      <div className="w-px h-5 bg-gray-200"></div>

      <button
        onClick={handleGroupSelected}
        className="px-2 py-1.5 text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors"
        title="创建编组 Ctrl+G"
      >
        <Box size={14} /> 编组
      </button>

      <button
        onClick={handleMergeSelected}
        className="px-2 py-1.5 text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors"
        title="合并图层 Ctrl+Shift+G"
      >
        <Layers size={14} /> 合并
      </button>
    </div>
  );
};
