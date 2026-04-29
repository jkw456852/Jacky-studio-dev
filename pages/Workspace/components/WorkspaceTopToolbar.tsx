import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Circle as CircleIcon,
  Film,
  Hand,
  Hash,
  Image as ImageIcon,
  ImagePlus,
  MapPin,
  MessageSquare,
  MousePointer2,
  Package2,
  PenTool,
  Square,
  Star,
  Triangle,
  Type,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { ShapeType } from "../../../types";

type WorkspaceTopToolbarProps = {
  activeTool: string;
  showAssistant: boolean;
  setActiveTool: (tool: string) => void;
  handleFileUpload: (
    event: React.ChangeEvent<HTMLInputElement>,
    type: "image" | "video",
  ) => void | Promise<void>;
  showFeatureComingSoon: (feature: string) => void;
  addShape: (shapeType: ShapeType) => void;
  addGenImage: () => void;
  addGenVideo: () => void;
  consistencyCheckEnabled: boolean;
  currentConsistencyAnchorUrl: string | null;
  onToggleConsistencyCheck: (enabled: boolean) => void;
  onUploadConsistencyAnchor: (file: File) => void | Promise<void>;
  onClearConsistencyAnchor: () => void | Promise<void>;
  onPreviewConsistencyAnchor: (anchorUrl: string) => void;
  onOpenEcommerceWorkflow?: () => void;
};

const TooltipButton = ({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) => (
  <div className="relative group">
    <button
      onClick={onClick}
      className={`p-2.5 rounded-xl transition ${active ? "bg-gray-800 text-white" : "text-gray-500 hover:text-black hover:bg-gray-100"}`}
    >
      <Icon size={18} />
    </button>
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-sm">
      {label}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
    </div>
  </div>
);

const ShapeMenuItem = ({
  icon: Icon,
  onClick,
}: {
  icon: LucideIcon;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-black transition"
  >
    <Icon size={18} strokeWidth={1.5} />
  </button>
);

export const WorkspaceTopToolbar: React.FC<WorkspaceTopToolbarProps> = ({
  activeTool,
  showAssistant,
  setActiveTool,
  handleFileUpload,
  showFeatureComingSoon,
  addShape,
  addGenImage,
  addGenVideo,
  consistencyCheckEnabled,
  currentConsistencyAnchorUrl,
  onToggleConsistencyCheck,
  onUploadConsistencyAnchor,
  onClearConsistencyAnchor,
  onPreviewConsistencyAnchor,
  onOpenEcommerceWorkflow,
}) => {
  const [showConsistencyPanel, setShowConsistencyPanel] = useState(false);
  const consistencyPanelRef = useRef<HTMLDivElement | null>(null);
  const anchorUploadRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!showConsistencyPanel) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        consistencyPanelRef.current &&
        !consistencyPanelRef.current.contains(event.target as Node)
      ) {
        setShowConsistencyPanel(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [showConsistencyPanel]);

  let NavIcon = MousePointer2;
  if (activeTool === "hand") NavIcon = Hand;

  return (
    <div
      className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-[0_2px_20px_rgba(0,0,0,0.08)] border border-gray-200/60 px-2 py-1.5 flex flex-row gap-0.5 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 items-center"
      style={{ marginLeft: showAssistant ? "-240px" : "0" }}
    >
      <div className="relative group/nav">
        <button
          className={`p-2.5 rounded-xl transition ${["select", "hand"].includes(activeTool) ? "bg-gray-800 text-white" : "text-gray-500 hover:text-black hover:bg-gray-100"}`}
        >
          <NavIcon size={18} />
        </button>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-2 z-50 hidden group-hover/nav:block">
          <div className="w-44 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5 flex flex-col gap-0.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button
              onClick={() => setActiveTool("select")}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${activeTool === "select" ? "bg-gray-100 text-black" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <div className="flex items-center gap-3">
                <MousePointer2 size={16} /> Select
              </div>
              <span className="text-xs text-gray-400 font-medium">V</span>
            </button>
            <button
              onClick={() => setActiveTool("hand")}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${activeTool === "hand" ? "bg-gray-100 text-black" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <div className="flex items-center gap-3">
                <Hand size={16} /> Hand Tool
              </div>
              <span className="text-xs text-gray-400 font-medium">H</span>
            </button>
          </div>
        </div>
      </div>

      <TooltipButton
        icon={MapPin}
        label="Mark (M)"
        onClick={() => setActiveTool("mark")}
        active={activeTool === "mark"}
      />

      <div className="relative group/ins">
        <button
          className={`p-2.5 rounded-xl transition ${activeTool === "insert" ? "bg-gray-800 text-white" : "text-gray-500 hover:text-black hover:bg-gray-100"}`}
        >
          <ImagePlus size={18} />
        </button>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-2 z-50 hidden group-hover/ins:block">
          <div className="w-44 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5 flex flex-col gap-0.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <label className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer transition text-left w-full">
              <ImageIcon size={16} /> 上传图片
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFileUpload(e, "image")}
              />
            </label>
            <label className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer transition text-left w-full">
              <Film size={16} /> 上传视频
              <input
                type="file"
                accept="video/*"
                multiple
                className="hidden"
                onChange={(e) => handleFileUpload(e, "video")}
              />
            </label>
          </div>
        </div>
      </div>

      <TooltipButton
        icon={Hash}
        label="Artboard (#)"
        onClick={() => showFeatureComingSoon("画板")}
      />

      <div className="relative group/shp">
        <button
          className={`p-2.5 rounded-xl transition ${activeTool === "shape" ? "bg-gray-800 text-white" : "text-gray-500 hover:text-black hover:bg-gray-100"}`}
        >
          <Square size={18} />
        </button>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-2 z-50 hidden group-hover/shp:block">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-3 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200 w-48">
            <div className="text-[11px] font-medium text-gray-400">形状</div>
            <div className="grid grid-cols-5 gap-1">
              <ShapeMenuItem icon={Square} onClick={() => addShape("square")} />
              <ShapeMenuItem
                icon={CircleIcon}
                onClick={() => addShape("circle")}
              />
              <ShapeMenuItem
                icon={Triangle}
                onClick={() => addShape("triangle")}
              />
              <ShapeMenuItem icon={Star} onClick={() => addShape("star")} />
              <ShapeMenuItem
                icon={MessageSquare}
                onClick={() => addShape("bubble")}
              />
            </div>
            <div className="text-[11px] font-medium text-gray-400 mt-1">
              箭头
            </div>
            <div className="grid grid-cols-5 gap-1">
              <ShapeMenuItem
                icon={ArrowLeft}
                onClick={() => addShape("arrow-left")}
              />
              <ShapeMenuItem
                icon={ArrowRight}
                onClick={() => addShape("arrow-right")}
              />
            </div>
          </div>
        </div>
      </div>

      <TooltipButton
        icon={PenTool}
        label="Draw (P)"
        onClick={() => showFeatureComingSoon("画笔")}
      />

      <TooltipButton
        icon={Type}
        label="Text (T)"
        onClick={() => setActiveTool("text")}
        active={activeTool === "text"}
      />

      <div className="w-px h-6 bg-gray-200/80 mx-1.5" />

      <TooltipButton
        icon={Package2}
        label="电商工作流"
        onClick={onOpenEcommerceWorkflow}
      />

      <TooltipButton
        icon={ImagePlus}
        label="AI 图片"
        onClick={addGenImage}
      />

      <TooltipButton
        icon={Video}
        label="AI 视频"
        onClick={addGenVideo}
      />

      <div className="relative" ref={consistencyPanelRef}>
        <button
          type="button"
          onClick={() => setShowConsistencyPanel((current) => !current)}
          className={`p-2.5 rounded-xl transition ${
            showConsistencyPanel
              ? "bg-gray-800 text-white"
              : consistencyCheckEnabled
                ? "text-gray-500 hover:text-black hover:bg-gray-100"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
          }`}
          title="一致性检测与锚点"
        >
          <ImageIcon size={18} />
        </button>

        {showConsistencyPanel ? (
          <div className="absolute bottom-full left-1/2 z-50 mb-2 w-80 -translate-x-1/2 rounded-2xl border border-gray-100 bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  一致性检测
                </div>
                <div className="mt-1 text-[11px] leading-5 text-gray-500">
                  控制当前锚点质检。关闭后，新生成结果不会再按锚点做一致性校验。
                </div>
              </div>
              <button
                type="button"
                onClick={() => onToggleConsistencyCheck(!consistencyCheckEnabled)}
                className={`inline-flex h-7 w-12 items-center rounded-full px-1 transition ${
                  consistencyCheckEnabled ? "bg-emerald-500" : "bg-gray-300"
                }`}
                aria-label="toggle consistency check"
              >
                <span
                  className={`h-5 w-5 rounded-full bg-white shadow transition ${
                    consistencyCheckEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/80 p-3">
              <div className="text-[11px] font-semibold text-gray-700">
                当前锚点图
              </div>
              {currentConsistencyAnchorUrl ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      onPreviewConsistencyAnchor(currentConsistencyAnchorUrl)
                    }
                    className="mt-2 block w-full overflow-hidden rounded-2xl border border-gray-200 bg-white"
                  >
                    <img
                      src={currentConsistencyAnchorUrl}
                      alt="current-consistency-anchor"
                      className="h-36 w-full object-cover"
                    />
                  </button>
                  <div className="mt-2 text-[11px] leading-5 text-gray-500">
                    点击缩略图可查看大图。你也可以上传新的锚点图直接替换。
                  </div>
                </>
              ) : (
                <div className="mt-2 rounded-2xl border border-dashed border-gray-200 bg-white px-3 py-6 text-center text-[11px] leading-5 text-gray-400">
                  当前还没有指定锚点图。
                </div>
              )}
            </div>

            <input
              ref={anchorUploadRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) {
                  void onUploadConsistencyAnchor(file);
                  setShowConsistencyPanel(false);
                }
              }}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => anchorUploadRef.current?.click()}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-700 transition hover:border-gray-300 hover:text-gray-900"
              >
                上传指定锚点
              </button>
              <button
                type="button"
                onClick={() => {
                  void onClearConsistencyAnchor();
                  setShowConsistencyPanel(false);
                }}
                disabled={!currentConsistencyAnchorUrl}
                className="rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-[11px] font-medium text-red-600 transition hover:border-red-200 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                清空锚点
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
