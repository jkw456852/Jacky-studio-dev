import React, { memo } from "react";
import {
  Box,
  Check,
  ChevronDown,
  Download,
  Eraser,
  Loader2,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import type { CanvasElement } from "../../../types";

type VideoToolbarTab = "frames" | "motion" | "multi";

type WorkspaceVideoToolbarProps = {
  selectedElementId: string | null;
  selectedElementIds: string[];
  selectedElement: CanvasElement | null;
  isDraggingElement: boolean;
  zoom: number;
  videoToolbarTab: VideoToolbarTab;
  setVideoToolbarTab: React.Dispatch<React.SetStateAction<VideoToolbarTab>>;
  updateSelectedElement: (updates: Partial<CanvasElement>) => void;
  handleVideoRefUpload: (
    event: React.ChangeEvent<HTMLInputElement>,
    type: "start" | "end" | "ref",
    index?: number,
  ) => void | Promise<void>;
  showVideoModelPicker: boolean;
  setShowVideoModelPicker: React.Dispatch<React.SetStateAction<boolean>>;
  showRatioPicker: boolean;
  setShowRatioPicker: React.Dispatch<React.SetStateAction<boolean>>;
  handleGenVideo: (elementId: string) => void | Promise<void>;
};

export const WorkspaceVideoToolbar: React.FC<WorkspaceVideoToolbarProps> = memo(({
  selectedElementId,
  selectedElementIds,
  selectedElement,
  isDraggingElement,
  zoom,
  videoToolbarTab,
  setVideoToolbarTab,
  updateSelectedElement,
  handleVideoRefUpload,
  showVideoModelPicker,
  setShowVideoModelPicker,
  showRatioPicker,
  setShowRatioPicker,
  handleGenVideo,
}) => {
    if (
      !selectedElementId ||
      selectedElementIds.length > 1 ||
      isDraggingElement
    )
      return null;
    const el = selectedElement;
    if (!el || (el.type !== "gen-video" && el.type !== "video")) return null;

    // Canvas-space coordinates (toolbar lives inside the CSS transform layer)
    const elX = el.x;
    const elY = el.y;
    const canvasCenterX = elX + el.width / 2;
    // Calculate adaptive scaling logic for video toolbar
    const adaptiveScale = Math.max(0.4, Math.min(2.0, zoom / 100));
    const flexibleScale = 1 + (1 / adaptiveScale - 1) * 0.6;

    if (el.url) {
      // Generated state
      const topToolbarTop = elY - 60 / adaptiveScale;
      return (
        <div
          id="active-floating-toolbar"
          className={`absolute bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100/50 px-2 py-1.5 flex items-center gap-1 z-50 ${isDraggingElement ? "" : "animate-in fade-in zoom-in-95 duration-200"} whitespace-nowrap backdrop-blur-sm`}
          style={{
            left: canvasCenterX,
            top: topToolbarTop,
            transform: `translateX(-50%) scale(${flexibleScale})`,
            transformOrigin: "bottom center",
            pointerEvents: "auto",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button className="px-2.5 py-1.5 text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg flex items-center gap-2 text-[13px] font-medium transition-colors group">
            <div className="border-[1.5px] border-current rounded-[3px] px-0.5 text-[9px] font-bold opacity-70 group-hover:opacity-100 transition-opacity">
              HD
            </div>
            放大
          </button>
          <button className="px-2.5 py-1.5 text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg flex items-center gap-2 text-[13px] font-medium transition-colors group">
            <div className="relative">
              <Eraser
                size={14}
                className="opacity-70 group-hover:opacity-100 transition-opacity"
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-white border border-gray-600 rounded-full"></div>
            </div>
            移除背景
          </button>
          <div className="w-px h-4 bg-gray-200 mx-1"></div>
          <a
            href={el.url}
            download={`video-${el.id}.mp4`}
            className="p-1.5 text-gray-500 hover:text-black hover:bg-gray-50 rounded-lg transition-colors"
            target="_blank"
            rel="noreferrer"
          >
            <Download size={16} strokeWidth={2} />
          </a>
        </div>
      );
    } else {
      // Config state
      const toolbarTop = elY + el.height + 16;
      const inverseScale = 100 / zoom;

      return (
        <div
          id="active-floating-toolbar"
          className="absolute bg-[#F8F9FA] rounded-[20px] shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-gray-200/60 z-[100] animate-in fade-in zoom-in-95 duration-200 overflow-visible origin-top flex flex-col"
          style={{
            left: canvasCenterX,
            top: toolbarTop,
            minWidth: `420px`,
            width: `max-content`,
            transform: `translateX(-50%) scale(${inverseScale})`,
            pointerEvents: "auto",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Prompt textarea */}
          <div className="px-4 pt-4 pb-1 flex-grow">
            <textarea
              placeholder="今天我们要创作什么"
              className="w-full text-[14px] font-medium text-gray-800 placeholder:text-gray-400/80 bg-transparent border-none outline-none resize-none h-12 p-0 mb-0 leading-relaxed"
              value={el.genPrompt || ""}
              onChange={(e) =>
                updateSelectedElement({ genPrompt: e.target.value })
              }
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>

          <div
            className={`px-4 pb-2 relative z-10 ${videoToolbarTab === "frames" ? "block" : "hidden"}`}
          >
            <div className="flex items-center gap-2.5 w-max relative">
              {/* 首帧 Card */}
              <div
                className="relative group/startframe w-10 h-10 transition-colors z-20 cursor-pointer shadow-sm bg-white rounded-[10px] border border-gray-200 flex flex-col justify-center items-center overflow-visible"
                onClick={() =>
                  document.getElementById(`start-frame-${el.id}`)?.click()
                }
              >
                {el.genStartFrame ? (
                  <>
                    <div className="w-full h-full rounded-[10px] overflow-hidden relative">
                      <img
                        src={el.genStartFrame}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-[8px] text-white py-0.5 text-center">
                        首帧
                      </div>
                    </div>
                    <div
                      className="absolute -top-1.5 -right-1.5 bg-gray-600/90 text-white rounded-full p-0.5 cursor-pointer hover:bg-red-500 opacity-0 group-hover/startframe:opacity-100 transition-opacity z-30"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        updateSelectedElement({ genStartFrame: undefined });
                      }}
                    >
                      <X size={8} />
                    </div>
                  </>
                ) : (
                  <>
                    <Plus size={14} className="text-gray-400" />
                    <span className="text-[8px] text-gray-400 font-bold">
                      首帧
                    </span>
                  </>
                )}
                <input
                  type="file"
                  id={`start-frame-${el.id}`}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => handleVideoRefUpload(e, "start")}
                />
              </div>

              {/* 尾帧 Card */}
              <div
                className="relative group/endframe w-10 h-10 transition-colors z-10 cursor-pointer shadow-sm bg-white rounded-[10px] border border-gray-200 flex flex-col justify-center items-center overflow-visible"
                onClick={() =>
                  document.getElementById(`end-frame-${el.id}`)?.click()
                }
              >
                {el.genEndFrame ? (
                  <>
                    <div className="w-full h-full rounded-[10px] overflow-hidden relative">
                      <img
                        src={el.genEndFrame}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-[8px] text-white py-0.5 text-center">
                        尾帧
                      </div>
                    </div>
                    <div
                      className="absolute -top-1.5 -right-1.5 bg-gray-600/90 text-white rounded-full p-0.5 cursor-pointer hover:bg-red-500 opacity-0 group-hover/endframe:opacity-100 transition-opacity z-30"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        updateSelectedElement({ genEndFrame: undefined });
                      }}
                    >
                      <X size={8} />
                    </div>
                  </>
                ) : (
                  <>
                    <Plus size={14} className="text-gray-400" />
                    <span className="text-[8px] text-gray-400 font-bold">
                      尾帧
                    </span>
                  </>
                )}
                <input
                  type="file"
                  id={`end-frame-${el.id}`}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => handleVideoRefUpload(e, "end")}
                />
              </div>
            </div>
          </div>

          {/* Multi-Ref Upload Panel */}
          <div
            className={`px-4 pb-2 relative ${videoToolbarTab === "multi" ? "block" : "hidden"}`}
          >
            <div className="flex items-center gap-2.5 w-max">
              {(el.genVideoRefs || []).map((refImage, index) => (
                <div
                  key={index}
                  className="relative group/multiref shrink-0 overflow-visible"
                >
                  <div
                    className="w-10 h-10 rounded-[10px] border border-gray-200 relative cursor-pointer shadow-sm overflow-visible"
                    onClick={() =>
                      document
                        .getElementById(`multi-frame-${el.id}-${index}`)
                        ?.click()
                    }
                  >
                    <div className="w-full h-full rounded-[10px] overflow-hidden">
                      <img
                        src={refImage}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div
                      className="absolute -top-1.5 -right-1.5 bg-gray-600 text-white rounded-full p-0.5 cursor-pointer hover:bg-red-500 opacity-0 group-hover/multiref:opacity-100 transition z-30"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        const newRefs = [...(el.genVideoRefs || [])];
                        newRefs.splice(index, 1);
                        updateSelectedElement({ genVideoRefs: newRefs });
                      }}
                    >
                      <X size={8} />
                    </div>
                  </div>
                  <input
                    type="file"
                    id={`multi-frame-${el.id}-${index}`}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleVideoRefUpload(e, "ref", index)}
                  />
                </div>
              ))}
              {(el.genVideoRefs || []).length < 5 && (
                <div className="relative group/upload shrink-0 w-10 h-10">
                  <div
                    onClick={() =>
                      document
                        .getElementById(`multi-frame-new-${el.id}`)
                        ?.click()
                    }
                    className="relative w-full h-full bg-white border border-dashed border-gray-300 rounded-[10px] flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition z-10"
                  >
                    <Plus
                      size={14}
                      className="text-gray-400 group-hover/upload:text-blue-500"
                    />
                    <span className="text-[8px] text-gray-400 group-hover/upload:text-blue-500">
                      参考图
                    </span>
                  </div>
                  <input
                    type="file"
                    id={`multi-frame-new-${el.id}`}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleVideoRefUpload(e, "ref")}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Bottom Controls Bar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-transparent relative z-30">
            {/* Left: Tabs (Pill style) */}
            <div className="flex items-center gap-0 bg-[#F0F2F5] rounded-full p-[3px] relative shrink-0">
              <button
                onClick={() => {
                  updateSelectedElement({ genFirstLastMode: "startEnd" });
                  setVideoToolbarTab("frames");
                }}
                className={`px-4 py-1.5 text-[12px] font-medium rounded-full transition-all duration-300 whitespace-nowrap shrink-0 ${videoToolbarTab === "frames" ? "bg-white text-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.06)]" : "text-gray-500 hover:text-gray-700 bg-transparent"}`}
                tabIndex={-1}
              >
                {el.genModel === "Sora 2" ? "单图参考" : "首尾帧"}
              </button>
              {el.genModel === "Veo 3.1" ? (
                <button
                  onClick={() => {
                    updateSelectedElement({ genFirstLastMode: "multiRef" });
                    setVideoToolbarTab("multi");
                  }}
                  className={`px-4 py-1.5 text-[12px] font-medium rounded-full transition-all duration-300 whitespace-nowrap shrink-0 ${videoToolbarTab === "multi" ? "bg-white text-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.06)]" : "text-gray-500 hover:text-gray-700 bg-transparent"}`}
                  tabIndex={-1}
                >
                  多图参考
                </button>
              ) : (
                <button
                  className={`px-4 py-1.5 text-[12px] font-medium rounded-full transition-all duration-300 text-gray-500 hover:text-gray-700 bg-transparent whitespace-nowrap shrink-0`}
                  tabIndex={-1}
                >
                  动作控制
                </button>
              )}
            </div>

            {/* Right: Model, Ratio, Generate */}
            <div className="flex items-center gap-1.5 relative z-20 shrink-0">
              {/* Model Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowVideoModelPicker(!showVideoModelPicker)}
                  className={`h-8 px-2.5 flex items-center gap-1.5 text-[12px] font-semibold transition whitespace-nowrap overflow-hidden max-w-[150px] shrink-0 rounded-lg ${showVideoModelPicker ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-800 hover:bg-gray-50/80"}`}
                  tabIndex={-1}
                >
                  <Box
                    size={14}
                    className={`shrink-0 ${showVideoModelPicker ? "text-blue-500" : "text-gray-400"}`}
                  />
                  <span className="truncate">
                    {el.genModel || "Veo 3.1 Fast"}
                  </span>
                  <ChevronDown
                    size={12}
                    className={`text-gray-400 transition-transform duration-300 shrink-0 ${showVideoModelPicker ? "rotate-180" : ""}`}
                  />
                </button>
                {showVideoModelPicker && (
                  <div className="absolute bottom-full right-0 mb-3 w-48 bg-white rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-gray-100/80 p-1.5 z-[9999] animate-in fade-in slide-in-from-bottom-2 duration-200 custom-scrollbar">
                    <div className="px-2 py-1.5 text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                      选择视频模型
                    </div>
                    <button
                      onClick={() => {
                        updateSelectedElement({
                          genModel: "Kling 2.6",
                          genFirstLastMode: "startEnd",
                        });
                        setShowVideoModelPicker(false);
                        setVideoToolbarTab("motion");
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors ${el.genModel === "Kling 2.6" ? "bg-blue-50 text-blue-700 font-bold" : "text-gray-700 hover:bg-gray-50 font-medium"}`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-5 h-5 flex items-center justify-center rounded-md ${el.genModel === "Kling 2.6" ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"}`}
                        >
                          <Box size={12} />
                        </div>
                        <span>Kling 2.6</span>
                      </div>
                      {el.genModel === "Kling 2.6" && <Check size={14} />}
                    </button>
                    <button
                      onClick={() => {
                        updateSelectedElement({
                          genModel: "Veo 3.1",
                          genFirstLastMode: "startEnd",
                        });
                        setShowVideoModelPicker(false);
                        setVideoToolbarTab("frames");
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors ${el.genModel === "Veo 3.1" ? "bg-blue-50 text-blue-700 font-bold" : "text-gray-700 hover:bg-gray-50 font-medium"}`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-5 h-5 flex items-center justify-center rounded-md ${el.genModel === "Veo 3.1" ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"}`}
                        >
                          <Box size={12} />
                        </div>
                        <span>Veo 3.1</span>
                      </div>
                      {el.genModel === "Veo 3.1" && <Check size={14} />}
                    </button>
                    <button
                      onClick={() => {
                        updateSelectedElement({
                          genModel: "Sora 2",
                          genFirstLastMode: "startEnd",
                          genAspectRatio: "16:9",
                          genDuration: "10s",
                          genEndFrame: undefined,
                          genVideoRefs: el.genStartFrame ? [el.genStartFrame] : [],
                        });
                        setShowVideoModelPicker(false);
                        setVideoToolbarTab("frames");
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors ${el.genModel === "Sora 2" ? "bg-blue-50 text-blue-700 font-bold" : "text-gray-700 hover:bg-gray-50 font-medium"}`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-5 h-5 flex items-center justify-center rounded-md ${el.genModel === "Sora 2" ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"}`}
                        >
                          <Sparkles size={12} />
                        </div>
                        <div className="flex flex-col leading-tight">
                          <span>Sora 2</span>
                          <span className="text-[10px] font-medium opacity-70">
                            仅支持单张参考图
                          </span>
                        </div>
                      </div>
                      {el.genModel === "Sora 2" && <Check size={14} />}
                    </button>
                    <button
                      onClick={() => {
                        updateSelectedElement({
                          genModel: "Veo 3.1 Fast",
                          genFirstLastMode: "startEnd",
                        });
                        setShowVideoModelPicker(false);
                        setVideoToolbarTab("frames");
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors ${el.genModel === "Veo 3.1 Fast" ? "bg-blue-50 text-blue-700 font-bold" : "text-gray-700 hover:bg-gray-50 font-medium"}`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-5 h-5 flex items-center justify-center rounded-md ${el.genModel === "Veo 3.1 Fast" ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"}`}
                        >
                          <Box size={12} />
                        </div>
                        <span>Veo 3.1 Fast</span>
                      </div>
                      {el.genModel === "Veo 3.1 Fast" && <Check size={14} />}
                    </button>
                  </div>
                )}
              </div>

              {/* Ratio / Duration / Quality Settings Popover */}
              <div className="relative flex items-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRatioPicker(!showRatioPicker);
                    setShowVideoModelPicker(false);
                  }}
                  className={`h-8 px-2.5 rounded-lg text-[12px] transition flex items-center gap-1.5 font-semibold shrink-0 whitespace-nowrap ${showRatioPicker ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-800 hover:bg-gray-50/80"}`}
                  tabIndex={-1}
                >
                  {el.genAspectRatio || "16:9"} • {el.genDuration || "8s"}
                  <ChevronDown
                    size={12}
                    className={`text-gray-400 transition-transform duration-300 ${showRatioPicker ? "rotate-180" : ""}`}
                  />
                </button>
                {showRatioPicker && (
                  <div className="absolute bottom-full right-0 mb-3 w-[260px] bg-white rounded-[20px] shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-gray-100/80 p-4 z-[9999] animate-in fade-in slide-in-from-bottom-2 duration-200">
                    {/* Size section */}
                    <div className="mb-5">
                      <div className="text-[11px] text-gray-400 uppercase tracking-widest font-bold mb-3 flex items-center justify-between">
                        <span>比例</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            updateSelectedElement({ genAspectRatio: "16:9" })
                          }
                          className={`flex-1 flex flex-col items-center justify-center py-3 rounded-[12px] border transition-all ${(el.genAspectRatio || "16:9") === "16:9" ? "border-blue-500 bg-blue-50/50" : "border-gray-100 hover:border-gray-300 bg-white"} gap-2`}
                        >
                          <div
                            className={`w-8 h-4 border-[1.5px] rounded-[3px] ${(el.genAspectRatio || "16:9") === "16:9" ? "border-blue-500" : "border-gray-400"}`}
                          ></div>
                          <span
                            className={`text-xs font-bold ${(el.genAspectRatio || "16:9") === "16:9" ? "text-blue-600" : "text-gray-600"}`}
                          >
                            16:9
                          </span>
                        </button>
                        <button
                          onClick={() =>
                            updateSelectedElement({ genAspectRatio: "9:16" })
                          }
                          className={`flex-1 flex flex-col items-center justify-center py-3 rounded-[12px] border transition-all ${(el.genAspectRatio || "16:9") === "9:16" ? "border-blue-500 bg-blue-50/50" : "border-gray-100 hover:border-gray-300 bg-white"} gap-2`}
                        >
                          <div
                            className={`w-4 h-8 border-[1.5px] rounded-[3px] ${(el.genAspectRatio || "16:9") === "9:16" ? "border-blue-500" : "border-gray-400"}`}
                          ></div>
                          <span
                            className={`text-xs font-bold ${(el.genAspectRatio || "16:9") === "9:16" ? "text-blue-600" : "text-gray-600"}`}
                          >
                            9:16
                          </span>
                        </button>
                        {el.genModel !== "Sora 2" && (
                          <button
                            onClick={() =>
                              updateSelectedElement({ genAspectRatio: "1:1" })
                            }
                            className={`flex-1 flex flex-col items-center justify-center py-3 rounded-[12px] border transition-all ${(el.genAspectRatio || "16:9") === "1:1" ? "border-blue-500 bg-blue-50/50" : "border-gray-100 hover:border-gray-300 bg-white"} gap-2`}
                          >
                            <div
                              className={`w-5 h-5 border-[1.5px] rounded-[3px] ${(el.genAspectRatio || "16:9") === "1:1" ? "border-blue-500" : "border-gray-400"}`}
                            ></div>
                            <span
                              className={`text-xs font-bold ${(el.genAspectRatio || "16:9") === "1:1" ? "text-blue-600" : "text-gray-600"}`}
                            >
                              1:1
                            </span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Duration section */}
                    <div className="mb-5">
                      <div className="text-[11px] text-gray-400 uppercase tracking-widest font-bold mb-3">
                        时长
                      </div>
                      <div className="flex bg-[#F5F5F7] rounded-[10px] p-1">
                        {(
                          el.genModel === "Sora 2" ? ["10s", "15s"] : ["4s", "6s", "8s"]
                        ).map((dur) => (
                          <button
                            key={dur}
                            onClick={() =>
                              updateSelectedElement({
                                genDuration:
                                  dur as NonNullable<CanvasElement["genDuration"]>,
                              })
                            }
                            className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${(el.genDuration || "8s") === dur ? "bg-white shadow-sm text-black" : "text-gray-500 hover:text-gray-800"}`}
                          >
                            {dur}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => handleGenVideo(el.id)}
                disabled={!el.genPrompt || el.isGenerating}
                className={`h-9 w-12 ml-1 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm ${!el.genPrompt || el.isGenerating ? "bg-gray-100 text-gray-400" : "bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)] hover:shadow-[0_6px_16px_rgba(79,70,229,0.4)] hover:-translate-y-0.5"}`}
                tabIndex={-1}
              >
                {el.isGenerating ? (
                  <Loader2 size={16} className="animate-spin text-white/80" />
                ) : (
                  <Sparkles
                    size={16}
                    fill="currentColor"
                    className={!el.genPrompt ? "opacity-60" : "opacity-100"}
                    strokeWidth={1.5}
                  />
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }
});
