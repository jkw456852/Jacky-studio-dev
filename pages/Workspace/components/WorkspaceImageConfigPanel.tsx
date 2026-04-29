import React, {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Box,
  Check,
  ChevronDown,
  ImagePlus,
  Loader2,
  X,
  Zap,
} from "lucide-react";
import type { CanvasElement, ImageModel } from "../../../types";
import { normalizeMappedModelId } from "../../../services/provider-settings";
import { isLikelyGeneratedReferencePreview } from "../workspaceShared";

const IMAGE_QUALITY_OPTIONS = ["high", "medium", "low"] as const;

type ImageModelOption = {
  id: string;
  name: string;
  desc: string;
  time: string;
  providerId?: string | null;
  providerName?: string;
};

type AspectRatioOption = {
  label: string;
  value: string;
  size: string;
};

type WorkspaceImageConfigPanelProps = {
  element: CanvasElement;
  visible?: boolean;
  canvasCenterX: number;
  elementY: number;
  zoom: number;
  screenPosition?: {
    left: number;
    top: number;
  } | null;
  translatePromptToEnglish: boolean;
  enforceChineseTextInImage: boolean;
  requiredChineseCopy: string;
  showModelPicker: boolean;
  showResPicker: boolean;
  showRatioPicker: boolean;
  modelOptions: ImageModelOption[];
  aspectRatios: AspectRatioOption[];
  renderRatioIcon: (ratioStr: string, isActive?: boolean) => React.ReactNode;
  setTranslatePromptToEnglish: (value: boolean) => void;
  setEnforceChineseTextInImage: (value: boolean) => void;
  setRequiredChineseCopy: (value: string) => void;
  setShowModelPicker: React.Dispatch<React.SetStateAction<boolean>>;
  setShowResPicker: React.Dispatch<React.SetStateAction<boolean>>;
  setShowRatioPicker: React.Dispatch<React.SetStateAction<boolean>>;
  updateSelectedElement: (updates: Partial<CanvasElement>) => void;
  handleRefImageUpload: (
    e: React.ChangeEvent<HTMLInputElement>,
    elementId: string,
  ) => void | Promise<void>;
  handleGenImage: (elementId: string) => void | Promise<void>;
};

const WorkspaceImageConfigPanelImpl: React.FC<
  WorkspaceImageConfigPanelProps
> = ({
  element,
  visible = true,
  canvasCenterX,
  elementY,
  zoom,
  screenPosition,
  translatePromptToEnglish,
  enforceChineseTextInImage,
  requiredChineseCopy,
  showModelPicker,
  showResPicker,
  showRatioPicker,
  modelOptions,
  aspectRatios,
  renderRatioIcon,
  setTranslatePromptToEnglish,
  setEnforceChineseTextInImage,
  setRequiredChineseCopy,
  setShowModelPicker,
  setShowResPicker,
  setShowRatioPicker,
  updateSelectedElement,
  handleRefImageUpload,
  handleGenImage,
}) => {
  const shouldRender =
    element.type === "gen-image" && !element.url && !element.isGenerating;
  const [showCountPicker, setShowCountPicker] = useState(false);
  const [showReferenceThumbnails, setShowReferenceThumbnails] = useState(false);
  const [showQualityPicker, setShowQualityPicker] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setShowCountPicker(false);
    setShowQualityPicker(false);
  }, [element.id]);

  const toolbarTop = elementY + element.height + 16;
  const toolbarDesignWidth = 520;
  const inverseScale = 100 / zoom;
  const isScreenPositioned = !!screenPosition;
  const entryScale = visible ? 1 : 0.92;
  const promptValue = element.genPrompt || "";
  const hasPrompt = promptValue.trim().length > 0;
  const refImageCount = element.genRefImages?.length || 0;
  const sourceRefUrls = useMemo(() => {
    if (!element.genRefImages || element.genRefImages.length === 0) {
      return element.genRefImage ? [element.genRefImage] : [];
    }
    return element.genRefImages;
  }, [element.genRefImage, element.genRefImages]);

  const previewRefUrls = useMemo(() => {
    if (!element.genRefPreviewImages || element.genRefPreviewImages.length === 0) {
      return element.genRefPreviewImage ? [element.genRefPreviewImage] : [];
    }
    return element.genRefPreviewImages;
  }, [element.genRefPreviewImage, element.genRefPreviewImages]);

  const thumbnailUrls = useMemo(() => {
    if (
      previewRefUrls.length === sourceRefUrls.length &&
      previewRefUrls.length > 0 &&
      previewRefUrls.every((url) => isLikelyGeneratedReferencePreview(url))
    ) {
      return previewRefUrls;
    }
    return [];
  }, [previewRefUrls, sourceRefUrls]);
  const normalizedCurrentModelId = useMemo(
    () =>
      normalizeMappedModelId(
        "image",
        String(element.genModel || modelOptions[0]?.id || "Nano Banana Pro"),
      ),
    [element.genModel, modelOptions],
  );
  const currentModelOption = useMemo(() => {
    const exactMatch = modelOptions.find(
      (model) =>
        model.id === normalizedCurrentModelId &&
        (element.genProviderId
          ? (model.providerId || null) === element.genProviderId
          : true),
    );

    return (
      exactMatch ||
      modelOptions.find((model) => model.id === normalizedCurrentModelId) ||
      modelOptions[0] || {
        id: normalizedCurrentModelId,
        name: normalizedCurrentModelId,
        desc: "Mapped image model from Settings.",
        time: "~--",
        providerId: null,
        providerName: "",
      }
    );
  }, [element.genProviderId, modelOptions, normalizedCurrentModelId]);
  const normalizedCurrentProviderId = currentModelOption.providerId || null;

  useEffect(() => {
    setShowReferenceThumbnails(false);

    if (!visible || sourceRefUrls.length === 0) {
      return;
    }

    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;
    const timerId = window.setTimeout(() => {
      raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          if (!cancelled) {
            setShowReferenceThumbnails(true);
          }
        });
      });
    }, 40);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
      if (raf1) {
        window.cancelAnimationFrame(raf1);
      }
      if (raf2) {
        window.cancelAnimationFrame(raf2);
      }
    };
  }, [element.id, sourceRefUrls.length, visible]);

  useEffect(() => {
    if (!visible || sourceRefUrls.length === 0) {
      return;
    }

    const currentPreviewUrls = previewRefUrls.slice(0, sourceRefUrls.length);
    const hasCompletePreviewSet =
      currentPreviewUrls.length === sourceRefUrls.length &&
      currentPreviewUrls.every((url) => isLikelyGeneratedReferencePreview(url));

    if (hasCompletePreviewSet) {
      return;
    }

    const idleCallback =
      typeof window !== "undefined" &&
      typeof (window as any).requestIdleCallback === "function"
        ? (window as any).requestIdleCallback
        : null;
    const cancelIdleCallback =
      typeof window !== "undefined" &&
      typeof (window as any).cancelIdleCallback === "function"
        ? (window as any).cancelIdleCallback
        : null;

    const runBackfill = () => {
      void (async () => {
        const { createImagePreviewDataUrl } = await import("../workspaceShared");
        const nextPreviewUrls = await Promise.all(
          sourceRefUrls.map((src, index) => {
            const currentPreview = currentPreviewUrls[index];
            if (isLikelyGeneratedReferencePreview(currentPreview)) {
              return currentPreview;
            }
            return createImagePreviewDataUrl(src);
          }),
        );

        updateSelectedElement({
          genRefPreviewImages: nextPreviewUrls,
          genRefPreviewImage: nextPreviewUrls[0],
        });
      })();
    };

    const timerId = idleCallback
      ? idleCallback(runBackfill, { timeout: 600 })
      : window.setTimeout(runBackfill, 180);

    return () => {
      if (idleCallback && cancelIdleCallback) {
        cancelIdleCallback(timerId);
        return;
      }
      window.clearTimeout(timerId);
    };
  }, [previewRefUrls, sourceRefUrls, updateSelectedElement, visible]);

  useEffect(() => {
    if (!isScreenPositioned) {
      return;
    }

    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    panel.style.left = `${screenPosition?.left ?? -100000}px`;
    panel.style.top = `${screenPosition?.top ?? -100000}px`;
  }, [isScreenPositioned, screenPosition]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      id="active-empty-gen-toolbar"
      className={`${isScreenPositioned ? "fixed" : "absolute"} overflow-visible bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-100 p-4 z-[120] origin-top`}
      style={{
        left: isScreenPositioned ? screenPosition.left : canvasCenterX,
        top: isScreenPositioned ? screenPosition.top : toolbarTop,
        width: `${toolbarDesignWidth}px`,
        transform: isScreenPositioned
          ? `translateX(-50%) scale(${entryScale})`
          : `translateX(-50%) scale(${inverseScale * entryScale})`,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        willChange: "transform, opacity",
        transition:
          "opacity 180ms ease, transform 240ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      aria-hidden={!visible}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <textarea
        placeholder="描述你想生成的画面..."
        className="w-full text-sm font-medium text-gray-700 placeholder:text-gray-300 bg-transparent border-none outline-none resize-none h-20 mb-4 p-1 leading-relaxed"
        value={promptValue}
        onChange={(e) => updateSelectedElement({ genPrompt: e.target.value })}
        onKeyDown={(e) => e.stopPropagation()}
      />

      {sourceRefUrls.length > 0 ? (
        showReferenceThumbnails ? (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 max-w-full no-scrollbar">
          {sourceRefUrls.map((img, idx) => (
            <div key={`${element.id}-${idx}`} className="relative w-14 h-14 shrink-0 group/ref">
              {thumbnailUrls[idx] ? (
                <img
                  src={thumbnailUrls[idx]}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover rounded-xl border border-gray-100 shadow-sm"
                />
              ) : (
                <div className="w-full h-full rounded-xl border border-gray-100 bg-gray-100/90 animate-pulse" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const nextImages = [...sourceRefUrls];
                  const nextPreviewImages = [...previewRefUrls];
                  nextImages.splice(idx, 1);
                  nextPreviewImages.splice(idx, 1);
                  updateSelectedElement({
                    genRefImages: nextImages,
                    genRefImage: nextImages[0],
                    genRefPreviewImages: nextPreviewImages,
                    genRefPreviewImage: nextPreviewImages[0],
                  });
                }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 shadow-sm transition-all hover:scale-110 active:scale-95 z-10"
                title="移除参考图"
              >
                <X size={10} strokeWidth={3} />
              </button>
            </div>
          ))}
        </div>
        ) : (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
            <ImagePlus size={14} className="text-gray-400" />
            <span>{sourceRefUrls.length} 张参考图已就绪</span>
          </div>
        )
      ) : null}

      <div className="flex items-center gap-2 mb-3 px-1 overflow-x-auto no-scrollbar">
        <button
          onClick={() =>
            setTranslatePromptToEnglish(!translatePromptToEnglish)
          }
          className={`h-8 px-2.5 rounded-full text-[11px] font-bold border transition whitespace-nowrap shrink-0 ${translatePromptToEnglish ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
          title="生成前自动增强并转为英文提示词"
        >
          英文增强
        </button>
        <button
          onClick={() =>
            setEnforceChineseTextInImage(!enforceChineseTextInImage)
          }
          className={`h-8 px-2.5 rounded-full text-[11px] font-bold border transition whitespace-nowrap shrink-0 ${enforceChineseTextInImage ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
          title="要求画面里保留可见中文文案"
        >
          中文文案
        </button>
        <input
          type="text"
          value={requiredChineseCopy}
          onChange={(e) => setRequiredChineseCopy(e.target.value)}
          placeholder="指定中文文案"
          className="h-8 w-32 px-2 rounded-full border border-gray-200 text-[11px] font-medium text-gray-700 bg-white focus:outline-none focus:border-gray-400 shrink-0"
          title="可选：指定必须出现在画面里的中文文案"
        />
      </div>

      <div className="flex items-center justify-between border-t border-gray-100/80 pt-4 gap-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => {
                setShowModelPicker(!showModelPicker);
                setShowResPicker(false);
                setShowRatioPicker(false);
                setShowCountPicker(false);
                setShowQualityPicker(false);
              }}
              className="flex items-center gap-2 text-xs font-semibold text-gray-700 hover:text-black transition px-3 py-2 hover:bg-gray-50 rounded-full border border-gray-200 hover:border-gray-300"
            >
              <Box size={14} strokeWidth={2} className="text-gray-500" />
              <span className="truncate max-w-[132px]">
                {currentModelOption.providerName
                  ? `${currentModelOption.name} · ${currentModelOption.providerName}`
                  : currentModelOption.name}
              </span>
              <ChevronDown size={12} className="opacity-40" />
            </button>
            {showModelPicker && (
              <div className="absolute bottom-full mb-2 left-0 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 p-1.5 z-[60]">
                <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-gray-400 tracking-wider border-b border-gray-50 mb-1">
                  模型
                </div>
                {modelOptions.map((model, index) => (
                  <button
                    key={`${model.providerName || "default"}-${model.id}-${index}`}
                    onClick={() => {
                      updateSelectedElement({
                        genModel: model.id as ImageModel,
                        genProviderId: model.providerId || null,
                      });
                      setShowModelPicker(false);
                      setShowQualityPicker(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 rounded-xl text-xs transition flex items-center justify-between ${normalizedCurrentModelId === model.id && (model.providerId || null) === normalizedCurrentProviderId ? "text-blue-600 bg-blue-50/50 font-semibold" : "text-gray-700"}`}
                  >
                    <div>
                      <div className="font-medium flex items-center gap-1.5">
                        <span>{model.name}</span>
                        {model.providerName ? (
                          <span className="text-[9px] font-semibold text-gray-400">
                            {model.providerName}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[9px] font-normal text-gray-400 opacity-80">
                        {model.desc}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9px] text-gray-400">{model.time}</span>
                      {normalizedCurrentModelId === model.id &&
                        (model.providerId || null) === normalizedCurrentProviderId && (
                        <Check size={12} />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <label
            className={`p-2 rounded-full transition border border-transparent hover:border-gray-200 cursor-pointer relative ${refImageCount >= 6 ? "opacity-30 cursor-not-allowed" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"}`}
            title="参考图"
          >
            <ImagePlus size={18} strokeWidth={1.5} />
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={refImageCount >= 6}
              onChange={(e) => handleRefImageUpload(e, element.id)}
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => {
                setShowCountPicker(!showCountPicker);
                setShowModelPicker(false);
                setShowResPicker(false);
                setShowRatioPicker(false);
                setShowQualityPicker(false);
              }}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-black transition px-2 py-1.5 hover:bg-gray-50 rounded-lg"
            >
              {element.genImageCount || 1}张
              <ChevronDown size={10} className="opacity-50" />
            </button>
            {showCountPicker && (
              <div className="absolute bottom-full mb-2 right-0 w-28 bg-white rounded-xl shadow-xl border border-gray-100 p-1 z-[60]">
                {([1, 2, 3, 4] as const).map((count) => (
                  <button
                    key={count}
                    onClick={() => {
                      updateSelectedElement({ genImageCount: count });
                      setShowCountPicker(false);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg text-xs transition ${
                      (element.genImageCount || 1) === count
                        ? "text-blue-600 font-bold bg-blue-50/30"
                        : "text-gray-600"
                    }`}
                  >
                    {count}张
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => {
                setShowResPicker(!showResPicker);
                setShowCountPicker(false);
                setShowModelPicker(false);
                setShowRatioPicker(false);
                setShowQualityPicker(false);
              }}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-black transition px-2 py-1.5 hover:bg-gray-50 rounded-lg"
            >
              {element.genResolution || "1K"}
              <ChevronDown size={10} className="opacity-50" />
            </button>
            {showResPicker && (
              <div className="absolute bottom-full mb-2 right-0 w-28 bg-white rounded-xl shadow-xl border border-gray-100 p-1 z-[60]">
                {["1K", "2K", "4K"].map((resolution) => (
                  <button
                    key={resolution}
                    onClick={() => {
                      updateSelectedElement({
                        genResolution: resolution as "1K" | "2K" | "4K",
                      });
                      setShowResPicker(false);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg text-xs transition ${element.genResolution === resolution ? "text-blue-600 font-bold bg-blue-50/30" : "text-gray-600"}`}
                  >
                    {resolution}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => {
                setShowRatioPicker(!showRatioPicker);
                setShowCountPicker(false);
                setShowModelPicker(false);
                setShowResPicker(false);
                setShowQualityPicker(false);
              }}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-black transition px-2 py-1.5 hover:bg-gray-50 rounded-lg"
            >
              {element.genAspectRatio || "1:1"}
              <ChevronDown size={10} className="opacity-50" />
            </button>
            {showRatioPicker && (
              <div className="absolute bottom-full mb-2 right-0 w-48 bg-white rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-gray-100/80 p-1.5 z-[60] max-h-72 overflow-y-auto custom-scrollbar">
                <div className="px-2 py-1.5 text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">
                  比例
                </div>
                {aspectRatios.map((ratio) => {
                  const isActive = element.genAspectRatio === ratio.value;
                  return (
                    <button
                      key={ratio.value}
                      onClick={() => {
                        updateSelectedElement({ genAspectRatio: ratio.value });
                        setShowRatioPicker(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 hover:bg-gray-50 rounded-lg text-xs transition flex items-center justify-between group ${isActive ? "text-blue-600 bg-blue-50/50 font-bold" : "text-gray-700 font-medium"}`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`text-gray-400 ${isActive ? "text-blue-600" : "group-hover:text-gray-600"}`}
                        >
                          {renderRatioIcon(ratio.value, isActive)}
                        </div>
                        <span>{ratio.label}</span>
                      </div>
                      <span
                        className={`text-[10px] font-mono ${isActive ? "text-blue-400/80" : "text-gray-400/80"}`}
                      >
                        {ratio.size}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => {
                setShowQualityPicker(!showQualityPicker);
                setShowCountPicker(false);
                setShowModelPicker(false);
                setShowResPicker(false);
                setShowRatioPicker(false);
              }}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-black transition px-2 py-1.5 hover:bg-gray-50 rounded-lg"
            >
              {element.genImageQuality || "medium"}
              <ChevronDown size={10} className="opacity-50" />
            </button>
            {showQualityPicker && (
              <div className="absolute bottom-full mb-2 right-0 w-28 bg-white rounded-xl shadow-xl border border-gray-100 p-1 z-[60]">
                {IMAGE_QUALITY_OPTIONS.map((quality) => (
                  <button
                    key={quality}
                    onClick={() => {
                      updateSelectedElement({
                        genImageQuality: quality,
                      });
                      setShowQualityPicker(false);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg text-xs transition ${
                      (element.genImageQuality || "medium") === quality
                        ? "text-blue-600 font-bold bg-blue-50/30"
                        : "text-gray-600"
                    }`}
                  >
                    {quality}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => handleGenImage(element.id)}
            disabled={!hasPrompt || element.isGenerating}
            title={element.isGenerating ? "生成中..." : "生成"}
            className={`h-8 px-3 rounded-xl flex items-center gap-1.5 transition-all font-bold text-[11px] ${!hasPrompt || element.isGenerating ? "bg-gray-100 text-gray-400" : "bg-[#CBD5E1] hover:bg-black text-white"}`}
          >
            {element.isGenerating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>生成中...</span>
              </>
            ) : (
              <>
                <Zap size={14} fill="currentColor" />
                <span>生成</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export const WorkspaceImageConfigPanel = memo(
  WorkspaceImageConfigPanelImpl,
  (prev, next) =>
    prev.element === next.element &&
    prev.visible === next.visible &&
    prev.canvasCenterX === next.canvasCenterX &&
    prev.elementY === next.elementY &&
    prev.zoom === next.zoom &&
    prev.screenPosition?.left === next.screenPosition?.left &&
    prev.screenPosition?.top === next.screenPosition?.top &&
    prev.translatePromptToEnglish === next.translatePromptToEnglish &&
    prev.enforceChineseTextInImage === next.enforceChineseTextInImage &&
    prev.requiredChineseCopy === next.requiredChineseCopy &&
    prev.showModelPicker === next.showModelPicker &&
    prev.showResPicker === next.showResPicker &&
    prev.showRatioPicker === next.showRatioPicker,
);
