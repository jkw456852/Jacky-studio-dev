import React from "react";
import {
  Check,
  ChevronDown,
  Crop,
  Download,
  Eraser,
  Expand,
  Layers,
  Loader2,
  MonitorUp,
  Plus,
  Scaling,
  Shirt,
  Type,
  Wand2,
  X,
  Zap,
  Box,
} from "lucide-react";
import type { CanvasElement } from "../../../types";

type WorkspaceImageSideToolbarProps = {
  element: CanvasElement;
  isDraggingElement: boolean;
  left: number;
  top: number;
  scale: number;
  toolbarExpanded: boolean;
  setToolbarExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  toolbarExpandTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  showUpscalePanel: boolean;
  setShowUpscalePanel: React.Dispatch<React.SetStateAction<boolean>>;
  selectedUpscaleRes: "2K" | "4K" | "8K";
  setSelectedUpscaleRes: React.Dispatch<
    React.SetStateAction<"2K" | "4K" | "8K">
  >;
  showUpscaleResDropdown: boolean;
  setShowUpscaleResDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  upscaleSourceSize: { width: number; height: number } | null;
  getUpscaleFactor: (res: "2K" | "4K" | "8K") => number;
  calcUpscaleTargetSize: (
    width: number,
    height: number,
    factor: number,
  ) => { width: number; height: number };
  handleUpscaleSelect: (factor: number) => void;
  handleRemoveBg: () => void | Promise<void>;
  showProductSwapPanel: boolean;
  setShowProductSwapPanel: React.Dispatch<React.SetStateAction<boolean>>;
  productSwapImages: string[];
  setProductSwapImages: React.Dispatch<React.SetStateAction<string[]>>;
  productSwapRes: "1K" | "2K" | "4K";
  setProductSwapRes: React.Dispatch<React.SetStateAction<"1K" | "2K" | "4K">>;
  showProductSwapResDropdown: boolean;
  setShowProductSwapResDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  fileToDataUrl: (file: File) => Promise<string>;
  handleProductSwap: () => void | Promise<void>;
  handleGenImage: (elementId: string) => void | Promise<void>;
  setEraserMode: React.Dispatch<React.SetStateAction<boolean>>;
  handleEditTextClick: () => void | Promise<void>;
  handleVectorRedraw: () => void | Promise<void>;
  handleDownload: () => void;
  setShowFastEdit: React.Dispatch<React.SetStateAction<boolean>>;
  consistencyCheckEnabled: boolean;
  currentConsistencyAnchorUrl: string | null;
  isCurrentElementAnchor: boolean;
  onSetCurrentAsAnchor: () => void | Promise<void>;
  onPreviewCurrentAnchor: (anchorUrl: string) => void;
};

export const WorkspaceImageSideToolbar: React.FC<
  WorkspaceImageSideToolbarProps
> = ({
  element,
  isDraggingElement,
  left,
  top,
  scale,
  toolbarExpanded,
  setToolbarExpanded,
  toolbarExpandTimer,
  showUpscalePanel,
  setShowUpscalePanel,
  selectedUpscaleRes,
  setSelectedUpscaleRes,
  showUpscaleResDropdown,
  setShowUpscaleResDropdown,
  upscaleSourceSize,
  getUpscaleFactor,
  calcUpscaleTargetSize,
  handleUpscaleSelect,
  handleRemoveBg,
  showProductSwapPanel,
  setShowProductSwapPanel,
  productSwapImages,
  setProductSwapImages,
  productSwapRes,
  setProductSwapRes,
  showProductSwapResDropdown,
  setShowProductSwapResDropdown,
  fileToDataUrl,
  handleProductSwap,
  handleGenImage,
  setEraserMode,
  handleEditTextClick,
  handleVectorRedraw,
  handleDownload,
  setShowFastEdit,
  consistencyCheckEnabled,
  currentConsistencyAnchorUrl,
  isCurrentElementAnchor,
  onSetCurrentAsAnchor,
  onPreviewCurrentAnchor,
}) => {
  const [isVisible, setIsVisible] = React.useState(isDraggingElement);

  React.useEffect(() => {
    if (isDraggingElement) {
      setIsVisible(true);
      return;
    }

    setIsVisible(false);
    const rafId = window.requestAnimationFrame(() => setIsVisible(true));

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [element.id, isDraggingElement]);

  return (
    <div
      id="active-floating-toolbar"
      className="absolute z-50 pointer-events-auto origin-top-left"
      style={{
        left,
        top,
        opacity: isDraggingElement ? 1 : isVisible ? 1 : 0,
        transform: isDraggingElement
          ? `scale(${scale})`
          : `translate3d(0, ${isVisible ? "0px" : "6px"}, 0) scale(${
              scale * (isVisible ? 1 : 0.96)
            })`,
        transition: isDraggingElement
          ? "none"
          : "opacity 180ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: isDraggingElement ? "transform" : "transform, opacity",
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className={`flex flex-col bg-white rounded-[16px] p-2 shadow-[0_4px_24px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)] border border-gray-100/80 items-stretch gap-0.5 transition-all duration-300 ease-out ${toolbarExpanded ? "w-[150px]" : "w-[48px]"}`}
        onMouseEnter={() => {
          toolbarExpandTimer.current = setTimeout(
            () => setToolbarExpanded(true),
            800,
          );
        }}
        onMouseLeave={() => {
          if (toolbarExpandTimer.current) {
            clearTimeout(toolbarExpandTimer.current);
          }
          setToolbarExpanded(false);
        }}
      >
        <div
          onClick={() => setShowFastEdit(true)}
          className={`flex items-center gap-2.5 px-2 py-1.5 rounded-[10px] cursor-pointer transition-all hover:bg-gray-50 ${toolbarExpanded ? "justify-between" : "justify-center"}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center text-[8px] font-black tracking-tighter leading-none flex-shrink-0">
              JK
            </span>
            {toolbarExpanded && (
              <span className="text-[13px] font-medium text-gray-800 whitespace-nowrap">
                快捷编辑
              </span>
            )}
          </div>
          {toolbarExpanded && (
            <span className="text-[11px] text-gray-400 font-medium flex-shrink-0">
              Tab
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => void onSetCurrentAsAnchor()}
          className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[10px] transition-colors ${toolbarExpanded ? "" : "justify-center"} ${
            isCurrentElementAnchor
              ? "bg-emerald-50 text-emerald-700"
              : "text-gray-600 hover:bg-gray-50"
          }`}
          title={
            isCurrentElementAnchor
              ? "当前图片已作为锚点"
              : "将当前图片设为锚点"
          }
        >
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
              isCurrentElementAnchor
                ? "bg-emerald-600 text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {isCurrentElementAnchor ? <Check size={12} /> : <Box size={12} />}
          </div>
          {toolbarExpanded && (
            <span className="text-[13px] whitespace-nowrap">
              {isCurrentElementAnchor ? "当前锚点" : "设为锚点"}
            </span>
          )}
        </button>

        {toolbarExpanded && currentConsistencyAnchorUrl ? (
          <button
            type="button"
            onClick={() => onPreviewCurrentAnchor(currentConsistencyAnchorUrl)}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[10px] text-gray-600 hover:bg-gray-50 transition-colors"
            title="查看当前锚点图"
          >
            <img
              src={currentConsistencyAnchorUrl}
              alt="current-anchor"
              className="w-5 h-5 rounded-md object-cover border border-gray-200 flex-shrink-0"
            />
            <span className="text-[13px] whitespace-nowrap">
              {consistencyCheckEnabled ? "查看当前锚点" : "锚点已保留"}
            </span>
          </button>
        ) : null}

        <div className="relative">
          <button
            onClick={() => {
              setShowUpscalePanel(!showUpscalePanel);
              setToolbarExpanded(false);
            }}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 text-gray-600 hover:bg-gray-50 rounded-[10px] transition-colors ${toolbarExpanded ? "" : "justify-center"} ${showUpscalePanel ? "bg-gray-100 text-black" : ""}`}
          >
            <div className="border-[1.5px] border-current rounded-[3px] w-4 h-4 flex items-center justify-center text-[8px] font-black tracking-tighter flex-shrink-0">
              HD
            </div>
            {toolbarExpanded && (
              <span className="text-[13px] whitespace-nowrap">放大</span>
            )}
          </button>

          {showUpscalePanel && (
            <div
              className="absolute top-0 left-full ml-2 bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-gray-100 p-4 z-[70] w-64 animate-in slide-in-from-left-2 duration-200 flex flex-col gap-4"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-900">高清放大</span>
                <button
                  onClick={() => setShowUpscalePanel(false)}
                  className="text-gray-400 hover:text-black transition"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">
                  生成尺寸
                </span>
                <div className="relative">
                  <button
                    onClick={() =>
                      setShowUpscaleResDropdown(!showUpscaleResDropdown)
                    }
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{selectedUpscaleRes}</span>
                      <span className="text-[10px] text-gray-400 font-normal">
                        {(() => {
                          const factor = getUpscaleFactor(selectedUpscaleRes);
                          const source = upscaleSourceSize || {
                            width: Math.round(element.width),
                            height: Math.round(element.height),
                          };
                          const target = calcUpscaleTargetSize(
                            source.width,
                            source.height,
                            factor,
                          );
                          return `${target.width}x${target.height}`;
                        })()}
                      </span>
                    </div>
                    <ChevronDown
                      size={14}
                      className={`text-gray-400 transition-transform ${showUpscaleResDropdown ? "rotate-180" : ""}`}
                    />
                  </button>

                  {showUpscaleResDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 p-1 z-10 overflow-hidden">
                      {(["2K", "4K", "8K"] as const).map((res) => (
                        <button
                          key={res}
                          onClick={() => {
                            setSelectedUpscaleRes(res);
                            setShowUpscaleResDropdown(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${selectedUpscaleRes === res ? "bg-blue-50 text-blue-600 font-bold" : "text-gray-600 hover:bg-gray-50"}`}
                        >
                          <div className="flex items-center gap-2">
                            <span>{res}</span>
                            <span className="text-[10px] text-gray-400 font-normal">
                              {(() => {
                                const factor = getUpscaleFactor(res);
                                const source = upscaleSourceSize || {
                                  width: Math.round(element.width),
                                  height: Math.round(element.height),
                                };
                                const target = calcUpscaleTargetSize(
                                  source.width,
                                  source.height,
                                  factor,
                                );
                                return `${target.width}x${target.height}`;
                              })()}
                            </span>
                          </div>
                          {selectedUpscaleRes === res && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => setShowUpscalePanel(false)}
                    className="flex-1 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition border border-gray-100"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      const factor = getUpscaleFactor(selectedUpscaleRes);
                      handleUpscaleSelect(factor);
                      setShowUpscalePanel(false);
                    }}
                    className="flex-1 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-black transition shadow-sm"
                  >
                    开始
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleRemoveBg}
          className={`w-full flex items-center gap-2.5 px-2 py-1.5 text-gray-600 hover:bg-gray-50 rounded-[10px] transition-colors ${toolbarExpanded ? "" : "justify-center"}`}
        >
          <Wand2 size={16} strokeWidth={2} className="flex-shrink-0" />
          {toolbarExpanded && (
            <span className="text-[13px] whitespace-nowrap">去背景</span>
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => setShowProductSwapPanel(!showProductSwapPanel)}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 text-gray-600 hover:bg-gray-50 rounded-[10px] transition-colors ${toolbarExpanded ? "" : "justify-center"}`}
          >
            <Shirt size={16} strokeWidth={2} className="flex-shrink-0" />
            {toolbarExpanded && (
              <span className="text-[13px] whitespace-nowrap">产品替换</span>
            )}
          </button>

          {showProductSwapPanel && (
            <div
              className="absolute top-0 left-full ml-2 bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-gray-100 p-4 z-[70] w-72 animate-in slide-in-from-left-2 duration-200 flex flex-col gap-4"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-900">
                  上传产品图替换
                </span>
                <button
                  onClick={() => setShowProductSwapPanel(false)}
                  className="text-gray-400 hover:text-black transition"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">
                  上传产品细节图（最多 3 张）
                </span>
                <div className="flex flex-wrap gap-2">
                  {productSwapImages.map((imgUrl, i) => (
                    <div
                      key={i}
                      className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 group"
                    >
                      <img src={imgUrl} className="w-full h-full object-cover" />
                      <button
                        onClick={() =>
                          setProductSwapImages((prev) =>
                            prev.filter((_, idx) => idx !== i),
                          )
                        }
                        className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  {productSwapImages.length < 3 && (
                    <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 cursor-pointer transition">
                      <Plus size={16} />
                      <span className="text-[9px] mt-1">上传</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length === 0) return;
                          const toProcess = files.slice(
                            0,
                            3 - productSwapImages.length,
                          );
                          const newImages: string[] = [];
                          for (const file of toProcess) {
                            const base64 = await fileToDataUrl(file);
                            newImages.push(base64);
                          }
                          setProductSwapImages((prev) => [
                            ...prev,
                            ...newImages,
                          ]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">
                  生成尺寸
                </span>
                <div className="relative">
                  <button
                    onClick={() =>
                      setShowProductSwapResDropdown(!showProductSwapResDropdown)
                    }
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                  >
                    <span className="font-bold">{productSwapRes}</span>
                    <ChevronDown
                      size={14}
                      className={`text-gray-400 transition-transform ${showProductSwapResDropdown ? "rotate-180" : ""}`}
                    />
                  </button>

                  {showProductSwapResDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 p-1 z-10 overflow-hidden">
                      {(["1K", "2K", "4K"] as const).map((res) => (
                        <button
                          key={res}
                          onClick={() => {
                            setProductSwapRes(res);
                            setShowProductSwapResDropdown(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${productSwapRes === res ? "bg-blue-50 text-blue-600 font-bold" : "text-gray-600 hover:bg-gray-50"}`}
                        >
                          <span>{res}</span>
                          {productSwapRes === res && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setShowProductSwapPanel(false)}
                    className="flex-1 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition border border-gray-100"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleProductSwap}
                    disabled={productSwapImages.length === 0}
                    className="flex-1 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-black transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    开始替换
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {element.type === "gen-image" && (
          <button
            onClick={() => handleGenImage(element.id)}
            disabled={!element.genPrompt || element.isGenerating}
            title={element.isGenerating ? "生成中..." : "重新生成"}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[10px] transition-colors ${toolbarExpanded ? "" : "justify-center"} ${!element.genPrompt || element.isGenerating ? "text-gray-300 cursor-not-allowed" : "text-gray-600 hover:bg-gray-50"}`}
          >
            {element.isGenerating ? (
              <Loader2 size={16} className="flex-shrink-0 animate-spin" />
            ) : (
              <Zap size={16} strokeWidth={2} className="flex-shrink-0" />
            )}
            {toolbarExpanded && (
              <span className="text-[13px] whitespace-nowrap">
                {element.isGenerating ? "生成中" : "重新生成"}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => setEraserMode(true)}
          className={`w-full flex items-center gap-2.5 px-2 py-1.5 text-gray-600 hover:bg-gray-50 rounded-[10px] transition-colors ${toolbarExpanded ? "" : "justify-center"}`}
        >
          <Eraser size={16} strokeWidth={2} className="flex-shrink-0" />
          {toolbarExpanded && (
            <span className="text-[13px] whitespace-nowrap">橡皮工具</span>
          )}
        </button>

        <button
          className={`w-full flex items-center gap-2.5 px-2 py-1.5 text-gray-600 hover:bg-gray-50 rounded-[10px] transition-colors ${toolbarExpanded ? "" : "justify-center"}`}
        >
          <Layers size={16} strokeWidth={2} className="flex-shrink-0" />
          {toolbarExpanded && (
            <span className="text-[13px] whitespace-nowrap">编辑元素</span>
          )}
        </button>

        <button
          onClick={handleEditTextClick}
          className={`w-full flex items-center gap-2.5 px-2 py-1.5 text-gray-600 hover:bg-gray-50 rounded-[10px] transition-colors ${toolbarExpanded ? "" : "justify-center"}`}
        >
          <Type size={16} strokeWidth={2} className="flex-shrink-0" />
          {toolbarExpanded && (
            <span className="text-[13px] whitespace-nowrap">编辑文字</span>
          )}
        </button>

        <button
          className={`w-full flex items-center gap-2.5 px-2 py-1.5 text-gray-600 hover:bg-gray-50 rounded-[10px] transition-colors relative ${toolbarExpanded ? "" : "justify-center"}`}
        >
          <div className="relative flex-shrink-0">
            <Box size={16} strokeWidth={2} />
          </div>
          {toolbarExpanded && (
            <span className="text-[13px] whitespace-nowrap">多视角</span>
          )}
        </button>

        <button
          className={`w-full flex items-center gap-2.5 px-2 py-1.5 text-gray-600 hover:bg-gray-50 rounded-[10px] transition-colors ${toolbarExpanded ? "" : "justify-center"}`}
        >
          <Expand size={16} strokeWidth={2} className="flex-shrink-0" />
          {toolbarExpanded && (
            <span className="text-[13px] whitespace-nowrap">扩展</span>
          )}
        </button>

        <button
          className={`w-full flex items-center gap-2.5 px-2 py-1.5 text-gray-600 hover:bg-gray-50 rounded-[10px] transition-colors relative ${toolbarExpanded ? "" : "justify-center"}`}
        >
          <div className="relative flex-shrink-0">
            <MonitorUp size={16} strokeWidth={2} className="rotate-90" />
          </div>
          {toolbarExpanded && (
            <span className="text-[13px] whitespace-nowrap">调整</span>
          )}
        </button>

        <button
          className={`w-full flex items-center gap-2.5 px-2 py-1.5 text-gray-600 hover:bg-gray-50 rounded-[10px] transition-colors ${toolbarExpanded ? "" : "justify-center"}`}
        >
          <Crop size={16} strokeWidth={2} className="flex-shrink-0" />
          {toolbarExpanded && (
            <span className="text-[13px] whitespace-nowrap">裁剪</span>
          )}
        </button>

        <button
          onClick={handleVectorRedraw}
          className={`w-full flex items-center gap-2.5 px-2 py-1.5 text-gray-600 hover:bg-gray-50 rounded-[10px] transition-colors relative ${toolbarExpanded ? "" : "justify-center"}`}
        >
          <div className="relative flex-shrink-0">
            <Scaling size={16} strokeWidth={2} />
          </div>
          {toolbarExpanded && (
            <span className="text-[13px] whitespace-nowrap">矢量</span>
          )}
        </button>

        <div className="h-px bg-gray-100 mx-1 my-0.5"></div>

        <button
          onClick={handleDownload}
          className={`w-full flex items-center gap-2.5 px-2 py-1.5 text-gray-600 hover:bg-gray-50 rounded-[10px] transition-colors ${toolbarExpanded ? "" : "justify-center"}`}
        >
          <Download size={16} strokeWidth={2} className="flex-shrink-0" />
          {toolbarExpanded && (
            <span className="text-[13px] whitespace-nowrap">下载</span>
          )}
        </button>
      </div>
    </div>
  );
};




