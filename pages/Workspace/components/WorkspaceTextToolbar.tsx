import React, { memo } from "react";
import ReactDOM from "react-dom";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  ChevronDown,
  Minus,
  Plus,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import type { CanvasElement } from "../../../types";

type PopoverPosition = {
  x: number;
  y: number;
} | null;

type WorkspaceTextToolbarProps = {
  selectedElementId: string | null;
  selectedElementIds: string[];
  selectedElement: CanvasElement | null;
  isDraggingElement: boolean;
  zoom: number;
  elements: CanvasElement[];
  setElementsSynced: (elements: CanvasElement[]) => void;
  textEditDraftRef: React.MutableRefObject<Record<string, string>>;
  getTextWidth: (
    text: string,
    fontSize?: number,
    fontFamily?: string,
    fontWeight?: number,
    letterSpacing?: number,
  ) => number;
  fontTriggerRef: React.RefObject<HTMLButtonElement | null>;
  weightTriggerRef: React.RefObject<HTMLButtonElement | null>;
  textSettingsTriggerRef: React.RefObject<HTMLButtonElement | null>;
  fontPopoverRef: React.RefObject<HTMLDivElement | null>;
  weightPopoverRef: React.RefObject<HTMLDivElement | null>;
  textSettingsPopoverRef: React.RefObject<HTMLDivElement | null>;
  toggleFontPicker: () => void;
  toggleWeightPicker: () => void;
  toggleTextSettings: () => void;
  showFontPicker: boolean;
  showWeightPicker: boolean;
  showTextSettings: boolean;
  fontPickerPos: PopoverPosition;
  weightPickerPos: PopoverPosition;
  textSettingsPos: PopoverPosition;
  setShowFontPicker: React.Dispatch<React.SetStateAction<boolean>>;
  setShowWeightPicker: React.Dispatch<React.SetStateAction<boolean>>;
  fonts: string[];
};

const TooltipButton = ({
  icon: Icon,
  label,
  onClick,
  active,
  showTooltipOnHover = true,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  active?: boolean;
  showTooltipOnHover?: boolean;
}) => (
  <div className="relative group">
    <button
      onClick={onClick}
      className={`p-2.5 rounded-xl transition ${active ? "text-white bg-gray-800" : "text-gray-500 hover:text-black hover:bg-gray-100"}`}
    >
      <Icon size={18} />
    </button>
    {showTooltipOnHover && (
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-sm">
        {label}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
      </div>
    )}
  </div>
);

export const WorkspaceTextToolbar: React.FC<WorkspaceTextToolbarProps> = memo(({
  selectedElementId,
  selectedElementIds,
  selectedElement,
  isDraggingElement,
  zoom,
  elements,
  setElementsSynced,
  textEditDraftRef,
  getTextWidth,
  fontTriggerRef,
  weightTriggerRef,
  textSettingsTriggerRef,
  fontPopoverRef,
  weightPopoverRef,
  textSettingsPopoverRef,
  toggleFontPicker,
  toggleWeightPicker,
  toggleTextSettings,
  showFontPicker,
  showWeightPicker,
  showTextSettings,
  fontPickerPos,
  weightPickerPos,
  textSettingsPos,
  setShowFontPicker,
  setShowWeightPicker,
  fonts,
}) => {
    if (
      !selectedElementId ||
      selectedElementIds.length > 1 ||
      isDraggingElement // 拖动时隐藏工具栏，防止卡顿
    )
      return null;
    const el = selectedElement;
    if (!el || el.type !== "text") return null;

    // 文字工具栏保持屏幕可读尺寸：与画布缩放做反向抵消
    const dynamicScale = Math.max(0.1, 100 / zoom);

    const canvasCenterX = el.x + el.width / 2;
    const toolbarTop = el.y - 64 * dynamicScale;
    const updateEl = (patch: Partial<CanvasElement>) => {
      const newElements = elements.map(item =>
        item.id === el.id ? { ...item, ...patch } : item
      );
      setElementsSynced(newElements);
    };

    const updateFontSize = (newSize: number) => {
      const currentText = textEditDraftRef.current[el.id] || el.text || "";
      const newWidth = getTextWidth(currentText, newSize, el.fontFamily, el.fontWeight, el.letterSpacing);
      updateEl({
        fontSize: newSize,
        width: newWidth,
        height: newSize * (el.lineHeight || 1.2)
      });
    };

    return (
      <>
        <div
          id="active-floating-toolbar"
          className={`absolute z-50 ${isDraggingElement ? "" : "animate-in fade-in zoom-in-95 duration-200"} pointer-events-auto origin-bottom-center flex items-center bg-white rounded-2xl px-3 py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.15)] border border-gray-100 gap-2`}
          style={{
            left: canvasCenterX,
            top: toolbarTop,
            transform: `translateX(-50%) scale(${dynamicScale})`, // 应用自适应缩放因子
            whiteSpace: "nowrap",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Color Picker */}
          <div className="relative w-6 h-6 rounded-full overflow-hidden border border-gray-200 cursor-pointer shadow-sm shrink-0 hover:ring-2 hover:ring-blue-100 transition-all">
            <input
              type="color"
              value={el.fillColor || "#000000"}
              onChange={(e) => updateEl({ fillColor: e.target.value })}
              className="absolute -top-3 -left-3 w-12 h-12 cursor-pointer p-0 border-0"
            />
          </div>

          <div className="w-px h-4 bg-gray-100 mx-0.5 shrink-0"></div>

          {/* Font Family Dropdown */}
          <button
            ref={fontTriggerRef}
            onClick={toggleFontPicker}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold transition-all group ${showFontPicker ? "bg-gray-900 text-white shadow-md" : "hover:bg-gray-50 text-gray-700"}`}
          >
            <span className="truncate max-w-[70px]">
              {el.fontFamily || "Inter"}
            </span>
            <ChevronDown
              size={12}
              className={showFontPicker ? "text-white/60" : "text-gray-400"}
            />
          </button>

          {/* Font Weight Dropdown */}
          <button
            ref={weightTriggerRef}
            onClick={toggleWeightPicker}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold transition-all group ${showWeightPicker ? "bg-gray-900 text-white shadow-md" : "hover:bg-gray-50 text-gray-700"}`}
          >
            <span className="w-14 text-center">
              {el.fontWeight === 700
                ? "Bold"
                : el.fontWeight === 600
                  ? "Semibold"
                  : el.fontWeight === 500
                    ? "Medium"
                    : "Regular"}
            </span>
            <ChevronDown
              size={12}
              className={showWeightPicker ? "text-white/60" : "text-gray-400"}
            />
          </button>

          <div className="w-px h-5 bg-gray-100 mx-1 shrink-0"></div>

          {/* Font Size Control */}
          <div className="flex items-center bg-gray-50 rounded-xl px-1.5 py-0.5">
            <button
              onClick={() => updateFontSize(Math.max(8, (el.fontSize || 16) - 2))}
              className="p-1 hover:bg-white hover:shadow-sm rounded-lg transition-all text-gray-400 hover:text-gray-900"
            >
              <Minus size={14} />
            </button>
            <input
              type="number"
              value={el.fontSize || 16}
              onChange={(e) => updateFontSize(Number(e.target.value))}
              className="w-9 bg-transparent border-none text-center text-sm font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-gray-900"
            />
            <button
              onClick={() => updateFontSize((el.fontSize || 16) + 2)}
              className="p-1 hover:bg-white hover:shadow-sm rounded-lg transition-all text-gray-400 hover:text-gray-900"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="w-px h-5 bg-gray-100 mx-1 shrink-0"></div>

          {/* Alignment Controls */}
          <div className="flex items-center bg-gray-50 rounded-xl px-1 py-0.5">
            <TooltipButton
              icon={AlignLeft}
              label="左对齐"
              active={el.textAlign === "left"}
              onClick={() => updateEl({ textAlign: "left" })}
            />
            <TooltipButton
              icon={AlignCenter}
              label="居中对齐"
              active={el.textAlign === "center" || !el.textAlign}
              onClick={() => updateEl({ textAlign: "center" })}
            />
            <TooltipButton
              icon={AlignRight}
              label="右对齐"
              active={el.textAlign === "right"}
              onClick={() => updateEl({ textAlign: "right" })}
            />
          </div>

          <div className="w-px h-5 bg-gray-100 mx-1 shrink-0"></div>

          {/* Advanced Settings Toggle */}
          <button
            ref={textSettingsTriggerRef}
            onClick={toggleTextSettings}
            className={`p-1.5 rounded-xl transition-all ${showTextSettings ? "bg-gray-900 text-white shadow-md" : "text-gray-400 hover:bg-gray-50 hover:text-gray-700"}`}
          >
            <SlidersHorizontal size={17} />
          </button>
        </div>

        {/* Font Picker Portal */}
        {showFontPicker &&
          fontPickerPos &&
          ReactDOM.createPortal(
            <div
              ref={fontPopoverRef}
              className="fixed w-48 max-h-64 overflow-y-auto bg-white/95 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] border border-gray-100 p-1.5 z-[9999] backdrop-blur-md animate-in fade-in zoom-in-95 duration-200"
              style={{ left: fontPickerPos.x, top: fontPickerPos.y }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col gap-0.5">
                {fonts.map((font) => (
                  <button
                    key={font}
                    onClick={() => {
                      updateEl({ fontFamily: font });
                      setShowFontPicker(false);
                    }}
                    className={`h-10 w-full text-left px-3 rounded-xl text-sm transition-all flex items-center justify-between ${el.fontFamily === font ? "bg-gray-900 text-white font-bold" : "hover:bg-gray-50 text-gray-700"}`}
                    style={{ fontFamily: font }}
                  >
                    <span>{font}</span>
                    {el.fontFamily === font && <Check size={14} />}
                  </button>
                ))}
              </div>
            </div>,
            document.body,
          )}

        {/* Weight Picker Portal */}
        {showWeightPicker &&
          weightPickerPos &&
          ReactDOM.createPortal(
            <div
              ref={weightPopoverRef}
              className="fixed w-36 bg-white/95 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] border border-gray-100 p-1.5 z-[9999] backdrop-blur-md animate-in fade-in zoom-in-95 duration-200"
              style={{ left: weightPickerPos.x, top: weightPickerPos.y }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col gap-0.5">
                {[400, 500, 600, 700].map((w) => (
                  <button
                    key={w}
                    onClick={() => {
                      updateEl({ fontWeight: w });
                      setShowWeightPicker(false);
                    }}
                    className={`h-10 w-full text-left px-3 rounded-xl text-sm transition-all flex items-center justify-between ${el.fontWeight === w ? "bg-gray-900 text-white font-bold" : "hover:bg-gray-50 text-gray-700"}`}
                  >
                    <span>
                      {w === 400
                        ? "Regular"
                        : w === 500
                          ? "Medium"
                          : w === 600
                            ? "Semibold"
                            : "Bold"}
                    </span>
                    {el.fontWeight === w && <Check size={14} />}
                  </button>
                ))}
              </div>
            </div>,
            document.body,
          )}

        {/* Advanced Text Settings Portal (LH / LS) */}
        {showTextSettings &&
          textSettingsPos &&
          ReactDOM.createPortal(
            <div
              ref={textSettingsPopoverRef}
              className="fixed w-52 bg-white/95 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] border border-gray-100 p-3 z-[9999] backdrop-blur-md animate-in fade-in zoom-in-95 duration-200"
              style={{ left: textSettingsPos.x, top: textSettingsPos.y }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[11px] font-bold text-gray-400 px-1">
                    <span>LINE HEIGHT</span>
                    <span className="text-gray-900">
                      {(el.lineHeight || 1.2).toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.8}
                    max={3}
                    step={0.1}
                    value={el.lineHeight || 1.2}
                    onChange={(e) => {
                      const newVal = Number(e.target.value);
                      const currentText = textEditDraftRef.current[el.id] || el.text || "";
                      const newWidth = getTextWidth(currentText, el.fontSize, el.fontFamily, el.fontWeight, newVal);
                      updateEl({
                        lineHeight: newVal,
                        width: newWidth
                      });
                    }}
                    className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-gray-900"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[11px] font-bold text-gray-400 px-1">
                    <span>LETTER SPACING</span>
                    <span className="text-gray-900">
                      {(el.letterSpacing || 0).toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-5}
                    max={30}
                    step={0.5}
                    value={el.letterSpacing || 0}
                    onChange={(e) => {
                      const newVal = Number(e.target.value);
                      const currentText = textEditDraftRef.current[el.id] || el.text || "";
                      const newWidth = getTextWidth(currentText, el.fontSize, el.fontFamily, el.fontWeight, newVal);
                      updateEl({
                        letterSpacing: newVal,
                        width: newWidth
                      });
                    }}
                    className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-gray-900"
                  />
                </div>
              </div>
            </div>,
            document.body,
          )}
      </>
    );
});
