import React from "react";
import {
  Check,
  Box,
  ChevronDown,
  ChevronUp,
  Copy,
  ImagePlus,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import type { CanvasElement, ImageModel } from "../../../types";
import {
  WORKSPACE_NODE_BERSERK_SHADOW,
  WORKSPACE_NODE_RADIUS,
  WORKSPACE_NODE_SELECTION_RADIUS,
  WORKSPACE_NODE_SELECTION_SHADOW,
} from "./workspaceNodeStyles";
import { getAllNodeParentIds, TREE_NODE_CARD_WIDTH } from "../workspaceTreeNode";
import { normalizeMappedModelId } from "../../../services/provider-settings";

const LABEL_COPY = "\u590d\u5236\u5185\u5bb9";
const LABEL_DELETE = "\u5220\u9664\u8282\u70b9";
const LABEL_UPLOAD = "\u4e0a\u4f20\u53c2\u8003\u56fe";
const LABEL_GENERATE = "\u751f\u6210";
const LABEL_EXPAND = "\u5c55\u5f00\u5b50\u8282\u70b9";
const LABEL_COLLAPSE = "\u6536\u8d77\u5b50\u8282\u70b9";
const LABEL_GENERATING = "Generating";
const LABEL_BERSERK_RETRY = "\u72c2\u66b4\u91cd\u8bd5";
const LABEL_BERSERK_SHORT = "\u72c2\u66b4";
const LABEL_BERSERK_ACTIVE = "\u72c2\u66b4\u4e2d";
const LABEL_BERSERK_RETRY_HINT =
  "\u6253\u5f00\u540e\uff0c\u751f\u56fe\u5931\u8d25\u4f1a\u5728\u539f\u56fe\u7247\u8282\u70b9\u4e0a\u7acb\u5373\u8fdb\u5165\u8f6e\u8be2\u91cd\u8bd5\uff0c\u4e0d\u7b49\u5f85\u3001\u4e0d\u65b0\u5f00\u8282\u70b9\uff0c\u76f4\u5230\u6210\u529f\u6216\u5237\u65b0\u9875\u9762\u3002";
const LABEL_MODEL = "\u6a21\u578b";
const LABEL_REF = "\u53c2\u8003\u56fe";
const LABEL_GENERATING_SHORT = "\u751f\u56fe\u4e2d";
const LABEL_STYLE_LIBRARY = "\u98ce\u683c\u5e93";
const LABEL_STYLE_LIBRARY_NONE = "\u65e0\u7ea6\u675f";
const LABEL_STYLE_LIBRARY_DEFAULT = "\u591a\u89d2\u5ea6\u4e3b\u4f53";
const LABEL_STYLE_LIBRARY_POSTER = "\u6d77\u62a5\u590d\u523b";
const LABEL_STYLE_LIBRARY_NONE_HINT =
  "\u5173\u95ed\u9ed8\u8ba4\u98ce\u683c\u5e93\u7ea6\u675f\uff0c\u4e0d\u5f3a\u884c\u5957\u7528\u591a\u89d2\u5ea6/\u6d77\u62a5\u6a21\u5f0f\uff0c\u4f46\u4ecd\u4f1a\u5c3d\u91cf\u4fdd\u7559\u53c2\u8003\u56fe\u91cc\u7684\u4ea7\u54c1\u8eab\u4efd\u4e0e\u54c1\u724c\u4fe1\u606f\u3002";
const LABEL_STYLE_LIBRARY_DEFAULT_HINT =
  "\u628a\u591a\u5f20\u53c2\u8003\u56fe\u7406\u89e3\u6210\u540c\u4e00\u4e3b\u4f53\u7684\u591a\u89d2\u5ea6/\u8865\u5145\u7ec6\u8282\uff0c\u9002\u5408\u540c\u6b3e\u4ea7\u54c1\u6216\u540c\u4e00\u4e3b\u4f53\u7684\u8fd8\u539f\u3002";
const LABEL_STYLE_LIBRARY_POSTER_HINT =
  "\u7b2c 1 \u5f20\u53c2\u8003\u56fe\u4f5c\u4e3a\u6d77\u62a5/\u6784\u56fe/\u98ce\u683c\u53c2\u8003\uff0c\u7b2c 2 \u5f20\u53c2\u8003\u56fe\u4f5c\u4e3a\u4ea7\u54c1\u4e3b\u4f53\u53c2\u8003\uff0c\u4f18\u5148\u505a\u51fa\u201c\u7528\u56fe 2 \u4ea7\u54c1\u91cd\u505a\u56fe 1 \u6d77\u62a5\u201d\u7684\u6548\u679c\u3002";
const LABEL_STYLE_LIBRARY_POSTER_DISABLED_HINT =
  "\u81f3\u5c11\u9700\u8981 2 \u5f20\u53c2\u8003\u56fe\uff1a\u7b2c 1 \u5f20\u653e\u6d77\u62a5\u53c2\u8003\uff0c\u7b2c 2 \u5f20\u653e\u4ea7\u54c1\u53c2\u8003\u3002";
const IMAGE_QUALITY_OPTIONS = ["high", "medium", "low"] as const;
const IMAGE_QUALITY_SHORT_LABEL: Record<
  (typeof IMAGE_QUALITY_OPTIONS)[number],
  "H" | "M" | "L"
> = {
  high: "H",
  medium: "M",
  low: "L",
};
const IMAGE_COUNT_OPTIONS = [1, 2, 3, 4] as const;

type WorkspaceTreePromptNodeProps = {
  element: CanvasElement;
  zoom: number;
  hasUrl: boolean;
  displayUrl?: string;
  thumbUrls: string[];
  sourceRefUrls: string[];
  promptValue: string;
  setElementsSynced: React.Dispatch<React.SetStateAction<CanvasElement[]>>;
  setPreviewUrl: React.Dispatch<React.SetStateAction<string | null>>;
  isGenerating: boolean;
  isSelected: boolean;
  modelOptions: Array<{
    id: string;
    name: string;
    desc: string;
    time: string;
    providerId?: string | null;
    providerName?: string;
  }>;
  aspectRatios: Array<{
    label: string;
    value: string;
    size: string;
  }>;
  selectElement: (elementId: string) => void;
  updateSelectedElement: (updates: Partial<CanvasElement>) => void;
  handleRefImageUpload: (
    e: React.ChangeEvent<HTMLInputElement>,
    elementId: string,
  ) => void | Promise<void>;
  handleGenImage: (elementId: string) => void | Promise<void>;
  onDelete: () => void;
  refUploadInputId: string;
};

const TREE_PROMPT_TONES = [
  { id: "lavender", border: "#7657FF", fill: "#EBE9F2", swatch: "#8C78FF" },
  { id: "sage", border: "#7A9A78", fill: "#E9EEE8", swatch: "#90B48A" },
  { id: "amber", border: "#C29445", fill: "#F3EBDC", swatch: "#E5BD6D" },
  { id: "sky", border: "#6B8FD5", fill: "#EAF0F7", swatch: "#7FB2F0" },
  { id: "rose", border: "#D58DA9", fill: "#F5EAF0", swatch: "#ED9DBB" },
] as const;

const CARD_MAX_WIDTH = TREE_NODE_CARD_WIDTH;
const CARD_BASE_HEIGHT = 356;
const CONTROL_BLOCK_HEIGHT = 86;
const SINGLE_REF_BLOCK_HEIGHT = 66;
const MULTI_REF_BLOCK_HEIGHT = 58;

const getEstimatedPromptExtraHeight = (prompt: string) => {
  const normalizedPrompt = String(prompt || "").trim();
  const estimatedLineCount = Math.max(
    3,
    Math.ceil(Math.max(normalizedPrompt.length, 72) / 22),
  );
  return Math.max(0, estimatedLineCount - 4) * 18;
};

const getTreePromptCardHeight = (
  prompt: string,
  thumbCount: number,
) => {
  const visibleThumbCount = Math.min(Math.max(thumbCount, 0), 4);
  const referenceBlockHeight =
    visibleThumbCount <= 0
      ? 0
      : visibleThumbCount === 1
        ? SINGLE_REF_BLOCK_HEIGHT
        : MULTI_REF_BLOCK_HEIGHT;

  return Math.max(
    CARD_BASE_HEIGHT,
    210 +
      referenceBlockHeight +
      CONTROL_BLOCK_HEIGHT +
      getEstimatedPromptExtraHeight(prompt),
  );
};

const ReferenceThumbStrip: React.FC<{
  thumbUrls: string[];
  sourceRefUrls: string[];
  setPreviewUrl: React.Dispatch<React.SetStateAction<string | null>>;
}> = ({ thumbUrls, sourceRefUrls, setPreviewUrl }) => {
  const visibleThumbs = thumbUrls.slice(0, 4);
  if (visibleThumbs.length === 0) return null;

  if (visibleThumbs.length === 1) {
    const thumbUrl = visibleThumbs[0];
    const previewUrl = sourceRefUrls[0] || thumbUrl;
    return (
      <button
        type="button"
        className="mx-auto mb-4 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-white/80 bg-[#f7f4ed] shadow-[0_10px_22px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setPreviewUrl(previewUrl);
        }}
      >
        <img
          src={thumbUrl}
          className="h-full w-full object-cover"
          draggable={false}
        />
      </button>
    );
  }

  return (
    <div className="mx-auto mb-4 flex w-fit shrink-0 items-center justify-center px-1.5">
      {visibleThumbs.map((thumbUrl, index) => {
        const previewUrl = sourceRefUrls[index] || thumbUrl;
        return (
          <button
            key={`${thumbUrl}-${index}`}
            type="button"
            className="-ml-1.5 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-white/80 bg-[#f7f4ed] shadow-[0_8px_18px_rgba(15,23,42,0.07)] transition first:ml-0 hover:-translate-y-0.5"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setPreviewUrl(previewUrl);
            }}
          >
            <img
              src={thumbUrl}
              className="h-full w-full object-cover"
              draggable={false}
            />
          </button>
        );
      })}
    </div>
  );
};

const TreePromptToolbar: React.FC<{
  activeTone: string;
  canUsePosterProductMode: boolean;
  isBerserkRetryEnabled: boolean;
  onToneChange: (tone: string) => void;
  onStyleLibraryChange: (
    mode: NonNullable<CanvasElement["genReferenceRoleMode"]>,
  ) => void;
  onToggleBerserkRetry: () => void;
  onCopy: () => void;
  onDelete: () => void;
  styleLibraryMode?: CanvasElement["genReferenceRoleMode"];
}> = ({
  activeTone,
  canUsePosterProductMode,
  isBerserkRetryEnabled,
  onToneChange,
  onStyleLibraryChange,
  onToggleBerserkRetry,
  onCopy,
  onDelete,
  styleLibraryMode,
}) => {
  const [showStyleLibraryPicker, setShowStyleLibraryPicker] = React.useState(false);
  const stopToolbarPointerEvent = (
    event:
      | React.MouseEvent<HTMLElement>
      | React.PointerEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const stopToolbarClickEvent = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };
  const normalizedStyleLibraryMode = styleLibraryMode || "default";
  const styleLibraryLabel =
    normalizedStyleLibraryMode === "none"
      ? LABEL_STYLE_LIBRARY_NONE
      : normalizedStyleLibraryMode === "poster-product"
        ? LABEL_STYLE_LIBRARY_POSTER
        : LABEL_STYLE_LIBRARY_DEFAULT;
  const styleLibraryOptions: Array<{
    value: NonNullable<CanvasElement["genReferenceRoleMode"]>;
    label: string;
    hint: string;
    disabled?: boolean;
  }> = [
    {
      value: "none",
      label: LABEL_STYLE_LIBRARY_NONE,
      hint: LABEL_STYLE_LIBRARY_NONE_HINT,
    },
    {
      value: "default",
      label: LABEL_STYLE_LIBRARY_DEFAULT,
      hint: LABEL_STYLE_LIBRARY_DEFAULT_HINT,
    },
    {
      value: "poster-product",
      label: LABEL_STYLE_LIBRARY_POSTER,
      hint: canUsePosterProductMode
        ? LABEL_STYLE_LIBRARY_POSTER_HINT
        : LABEL_STYLE_LIBRARY_POSTER_DISABLED_HINT,
      disabled: !canUsePosterProductMode,
    },
  ];

  return (
    <div
      data-tree-prompt-toolbar="true"
      className="pointer-events-auto absolute left-1/2 top-0 z-[130] flex -translate-x-1/2 -translate-y-[calc(100%+12px)] items-center gap-1.5 rounded-full border border-[#e7e6ef] bg-white/98 px-2 py-1.5 shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur-sm"
      onPointerDown={stopToolbarPointerEvent}
      onMouseDown={stopToolbarPointerEvent}
      onClick={stopToolbarClickEvent}
    >
      <div className="flex items-center gap-1 rounded-full border border-[#efedf5] bg-[#faf9fc] px-1.5 py-1">
        {TREE_PROMPT_TONES.map((tone) => {
          const active = activeTone === tone.id;
          return (
            <button
              key={tone.id}
              type="button"
              aria-label={`Set tone ${tone.id}`}
              className="flex h-6 w-6 items-center justify-center rounded-full transition hover:scale-105"
              onPointerDown={stopToolbarPointerEvent}
              onMouseDown={stopToolbarPointerEvent}
              onClick={(event) => {
                event.stopPropagation();
                onToneChange(tone.id);
              }}
            >
              <span
                className="block h-4 w-4 rounded-full border"
                style={{
                  backgroundColor: tone.swatch,
                  borderColor: active ? tone.border : "rgba(148,163,184,0.46)",
                  boxShadow: active
                    ? `0 0 0 2px #ffffff, 0 0 0 3px ${tone.border}`
                    : "none",
                }}
              />
            </button>
          );
        })}
      </div>
      <div className="h-5 w-px bg-[#ebe9f1]" />
      <div className="group/berserk relative">
        <button
          type="button"
          aria-label={LABEL_BERSERK_RETRY}
          aria-pressed={isBerserkRetryEnabled}
          className={`flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 whitespace-nowrap text-[12px] font-medium transition ${
            isBerserkRetryEnabled
              ? "bg-[#111111] text-white shadow-[0_8px_18px_rgba(17,17,17,0.18)]"
              : "text-[#111827] hover:bg-[#f5f3ff]"
          }`}
          onPointerDown={stopToolbarPointerEvent}
          onMouseDown={stopToolbarPointerEvent}
          onClick={(event) => {
            event.stopPropagation();
            onToggleBerserkRetry();
          }}
        >
          <Zap size={12} fill={isBerserkRetryEnabled ? "currentColor" : "none"} />
          <span className="text-[11px]">{LABEL_BERSERK_SHORT}</span>
        </button>
        <div className="pointer-events-none absolute bottom-full left-1/2 z-[170] mb-2 w-44 -translate-x-1/2 rounded-xl bg-[#111827] px-3 py-2 text-[10px] leading-4 text-white opacity-0 shadow-[0_12px_30px_rgba(15,23,42,0.26)] transition duration-150 group-hover/berserk:opacity-100">
          {LABEL_BERSERK_RETRY_HINT}
        </div>
      </div>
      <div className="h-5 w-px bg-[#ebe9f1]" />
      <div className="relative">
        <button
          type="button"
          className="flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 whitespace-nowrap text-[12px] font-medium text-[#111827] transition hover:bg-[#f5f3ff]"
          onPointerDown={stopToolbarPointerEvent}
          onMouseDown={stopToolbarPointerEvent}
          onClick={(event) => {
            event.stopPropagation();
            setShowStyleLibraryPicker((value) => !value);
          }}
        >
          <span>{LABEL_STYLE_LIBRARY}</span>
          <span className="rounded-full bg-[#f3efff] px-2 py-0.5 text-[10px] font-semibold text-[#6b4eff]">
            {styleLibraryLabel}
          </span>
          <ChevronDown size={12} className="opacity-50" />
        </button>
        {showStyleLibraryPicker ? (
          <div
            className="absolute bottom-full left-0 z-[160] mb-2 w-64 rounded-2xl border border-[#e7e6ef] bg-white p-1.5 shadow-[0_18px_44px_rgba(15,23,42,0.16)]"
            onPointerDown={stopToolbarPointerEvent}
            onMouseDown={stopToolbarPointerEvent}
            onClick={stopToolbarClickEvent}
          >
            <div className="mb-1 border-b border-[#f1f2f7] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#98a2b3]">
              {LABEL_STYLE_LIBRARY}
            </div>
            {styleLibraryOptions.map((option) => {
              const active = normalizedStyleLibraryMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={option.disabled}
                  className={`w-full rounded-xl px-3 py-2.5 text-left text-xs transition ${
                    active
                      ? "bg-[#f2efff] text-[#6b4eff]"
                      : "text-[#344054] hover:bg-[#f8f9fc]"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (option.disabled) {
                      return;
                    }
                    onStyleLibraryChange(option.value);
                    setShowStyleLibraryPicker(false);
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{option.label}</span>
                    {active ? <Check size={12} /> : null}
                  </div>
                  <div className="mt-1 text-[10px] leading-4 text-[#98a2b3]">
                    {option.hint}
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="h-5 w-px bg-[#ebe9f1]" />
      <button
        type="button"
        className="flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 whitespace-nowrap text-[12px] font-medium text-[#111827] transition hover:bg-[#f5f3ff]"
        onPointerDown={stopToolbarPointerEvent}
        onMouseDown={stopToolbarPointerEvent}
        onClick={(event) => {
          event.stopPropagation();
          onCopy();
        }}
      >
        <Copy size={12} />
        <span>{LABEL_COPY}</span>
      </button>
      <button
        type="button"
        className="flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 whitespace-nowrap text-[12px] font-medium text-[#111827] transition hover:bg-[#fff1f2] hover:text-[#dc2626]"
        onPointerDown={stopToolbarPointerEvent}
        onMouseDown={stopToolbarPointerEvent}
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 size={12} />
        <span>{LABEL_DELETE}</span>
      </button>
    </div>
  );
};

const CONTROL_PILL_CLASS =
  "flex h-9 items-center gap-2 rounded-[16px] border border-white/82 bg-white/76 px-3 text-[11px] font-semibold text-[#374151] shadow-[0_6px_16px_rgba(15,23,42,0.05)] transition hover:border-[#d8dced] hover:bg-white";
const CONTROL_PILL_SECONDARY_CLASS =
  "flex h-8 items-center gap-1.5 rounded-[14px] border border-white/78 bg-white/72 px-2.5 text-[10px] font-semibold text-[#4b5563] shadow-[0_5px_14px_rgba(15,23,42,0.045)] transition hover:border-[#d8dced] hover:bg-white";

const getModelControlLabel = (model: {
  id: string;
  name: string;
}) => {
  const normalizedName = String(model.name || model.id || "Model").trim();
  const compactAliases: Record<string, string> = {
    "gpt-image-2": "GPT-Image-2",
    "nano banana": "Banana",
    "nano banana pro": "Banana Pro",
  };
  const alias = compactAliases[normalizedName.toLowerCase()];
  if (alias) {
    return alias;
  }
  return normalizedName.length > 18
    ? `${normalizedName.slice(0, 18).trim()}...`
    : normalizedName;
};

const TreePromptGenerateControls: React.FC<{
  element: CanvasElement;
  modelOptions: Array<{
    id: string;
    name: string;
    desc: string;
    time: string;
    providerId?: string | null;
    providerName?: string;
  }>;
  aspectRatios: Array<{
    label: string;
    value: string;
    size: string;
  }>;
  sourceRefUrls: string[];
  refUploadInputId: string;
  selectElement: (elementId: string) => void;
  updateSelectedElement: (updates: Partial<CanvasElement>) => void;
  handleGenImage: (elementId: string) => void | Promise<void>;
}> = ({
  element,
  modelOptions,
  aspectRatios,
  sourceRefUrls,
  refUploadInputId,
  selectElement,
  updateSelectedElement,
  handleGenImage,
}) => {
  const [showModelPicker, setShowModelPicker] = React.useState(false);
  const [showCountPicker, setShowCountPicker] = React.useState(false);
  const [showResPicker, setShowResPicker] = React.useState(false);
  const [showRatioPicker, setShowRatioPicker] = React.useState(false);
  const [showQualityPicker, setShowQualityPicker] = React.useState(false);
  const refImageCount = sourceRefUrls.length;
  const normalizedCurrentModelId = normalizeMappedModelId(
    "image",
    String(element.genModel || modelOptions[0]?.id || "Nano Banana Pro"),
  );
  const currentModelOption =
    modelOptions.find(
      (model) =>
        model.id === normalizedCurrentModelId &&
        (element.genProviderId
          ? (model.providerId || null) === element.genProviderId
          : true),
    ) ||
    modelOptions.find((model) => model.id === normalizedCurrentModelId) ||
    modelOptions[0] || {
      id: normalizedCurrentModelId,
      name: normalizedCurrentModelId,
      desc: "",
      time: "",
      providerId: null,
      providerName: "",
    };
  const normalizedCurrentProviderId = currentModelOption.providerId || null;
  const hasPrompt = Boolean(String(element.genPrompt || "").trim());
  const imageCount = element.genImageCount || 1;
  const imageQuality = element.genImageQuality || "medium";
  const currentModelLabel = getModelControlLabel(currentModelOption);

  const closeAllPickers = () => {
    setShowModelPicker(false);
    setShowCountPicker(false);
    setShowResPicker(false);
    setShowRatioPicker(false);
    setShowQualityPicker(false);
  };

  const stopBubble = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  const activateNode = () => {
    selectElement(element.id);
  };

  return (
    <div className="relative z-[12] mt-4 shrink-0 space-y-2 pt-1 pointer-events-auto">
      <div className="grid grid-cols-[minmax(0,1.1fr)_92px_104px] gap-2">
        <div className="relative min-w-0">
          <button
            type="button"
            className={`${CONTROL_PILL_CLASS} w-full justify-between`}
            onMouseDown={(event) => {
              activateNode();
              stopBubble(event);
            }}
            onClick={(event) => {
              activateNode();
              stopBubble(event);
              setShowModelPicker((value) => !value);
              setShowCountPicker(false);
              setShowResPicker(false);
              setShowRatioPicker(false);
              setShowQualityPicker(false);
            }}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Box size={13} className="shrink-0 text-[#7b8192]" />
              <span className="truncate text-left">{currentModelLabel}</span>
            </span>
            <ChevronDown size={11} className="shrink-0 opacity-50" />
          </button>
          {showModelPicker ? (
            <div
              className="absolute bottom-full left-0 z-[70] mb-2 w-64 rounded-2xl border border-[#e6e8f0] bg-white p-1.5 shadow-[0_18px_44px_rgba(15,23,42,0.16)]"
              onMouseDown={stopBubble}
            >
              <div className="mb-1 border-b border-[#f1f2f7] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#98a2b3]">
                {LABEL_MODEL}
              </div>
              {modelOptions.map((model, index) => {
                const active =
                  normalizedCurrentModelId === model.id &&
                  (model.providerId || null) === normalizedCurrentProviderId;
                return (
                  <button
                    key={`${model.providerName || "default"}-${model.id}-${index}`}
                    type="button"
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition ${
                      active
                        ? "bg-[#f2efff] font-semibold text-[#6b4eff]"
                        : "text-[#344054] hover:bg-[#f8f9fc]"
                    }`}
                    onClick={(event) => {
                      activateNode();
                      stopBubble(event);
                      updateSelectedElement({
                        genModel: model.id as ImageModel,
                        genProviderId: model.providerId || null,
                      });
                      closeAllPickers();
                    }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate font-medium">
                        <span className="truncate">{model.name}</span>
                        {model.providerName ? (
                          <span className="text-[9px] font-semibold text-[#98a2b3]">
                            {model.providerName}
                          </span>
                        ) : null}
                      </div>
                      <div className="truncate text-[10px] font-normal text-[#98a2b3]">
                        {model.desc}
                      </div>
                    </div>
                    <div className="ml-3 flex shrink-0 items-center gap-1.5">
                      {model.time ? (
                        <span className="text-[9px] text-[#98a2b3]">{model.time}</span>
                      ) : null}
                      {active ? <Check size={12} /> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <label
          htmlFor={refUploadInputId}
          className={`${CONTROL_PILL_CLASS} justify-between overflow-hidden px-2.5 ${
            refImageCount >= 6 ? "cursor-not-allowed opacity-40" : "cursor-pointer"
          }`}
          onMouseDown={(event) => {
            activateNode();
            stopBubble(event);
          }}
          title={LABEL_REF}
        >
          <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap leading-none">
            <ImagePlus size={14} className="shrink-0 text-[#7b8192]" />
            <span className="block whitespace-nowrap leading-none">Ref</span>
          </span>
          <span className="inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#f3efff] px-1.5 text-[10px] font-semibold leading-none text-[#6b4eff]">
            {refImageCount}
          </span>
        </label>

        <button
          type="button"
          className={`flex h-9 w-full items-center justify-center gap-1.5 rounded-[16px] px-3 text-[11px] font-bold transition-all ${
            !hasPrompt
              ? "bg-[#eef1f5] text-[#98a2b3]"
              : "bg-[#111111] text-white shadow-[0_10px_20px_rgba(17,17,17,0.14)] hover:-translate-y-0.5 hover:bg-black"
          }`}
          disabled={!hasPrompt}
          onMouseDown={(event) => {
            activateNode();
            stopBubble(event);
          }}
          onClick={(event) => {
            activateNode();
            stopBubble(event);
            void handleGenImage(element.id);
          }}
        >
          {element.isGenerating ? (
            <>
              <Sparkles size={13} className="animate-pulse" />
              <span>{LABEL_GENERATING_SHORT}</span>
            </>
          ) : (
            <>
              <Zap size={13} fill="currentColor" />
              <span>{LABEL_GENERATE}</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="relative min-w-0">
          <button
            type="button"
            className={`${CONTROL_PILL_SECONDARY_CLASS} w-full justify-between`}
            onMouseDown={(event) => {
              activateNode();
              stopBubble(event);
            }}
            onClick={(event) => {
              activateNode();
              stopBubble(event);
              setShowCountPicker((value) => !value);
              setShowModelPicker(false);
              setShowResPicker(false);
              setShowRatioPicker(false);
              setShowQualityPicker(false);
            }}
          >
            <span>{imageCount}p</span>
            <ChevronDown size={11} className="opacity-50" />
          </button>
          {showCountPicker ? (
            <div
              className="absolute bottom-full right-0 z-[70] mb-2 w-24 rounded-xl border border-[#e6e8f0] bg-white p-1 shadow-[0_16px_34px_rgba(15,23,42,0.14)]"
              onMouseDown={stopBubble}
            >
              {IMAGE_COUNT_OPTIONS.map((count) => {
                const active = imageCount === count;
                return (
                  <button
                    key={count}
                    type="button"
                    className={`w-full rounded-lg px-3 py-2 text-left text-xs transition ${
                      active
                        ? "bg-[#f2efff] font-semibold text-[#6b4eff]"
                        : "text-[#475467] hover:bg-[#f8f9fc]"
                    }`}
                    onClick={(event) => {
                      activateNode();
                      stopBubble(event);
                      updateSelectedElement({ genImageCount: count });
                      closeAllPickers();
                    }}
                  >
                    {count}p
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="relative min-w-0">
          <button
            type="button"
            className={`${CONTROL_PILL_SECONDARY_CLASS} w-full justify-between`}
            onMouseDown={(event) => {
              activateNode();
              stopBubble(event);
            }}
            onClick={(event) => {
              activateNode();
              stopBubble(event);
              setShowResPicker((value) => !value);
              setShowModelPicker(false);
              setShowCountPicker(false);
              setShowRatioPicker(false);
              setShowQualityPicker(false);
            }}
          >
            <span>{element.genResolution || "1K"}</span>
            <ChevronDown size={11} className="opacity-50" />
          </button>
          {showResPicker ? (
            <div
              className="absolute bottom-full right-0 z-[70] mb-2 w-24 rounded-xl border border-[#e6e8f0] bg-white p-1 shadow-[0_16px_34px_rgba(15,23,42,0.14)]"
              onMouseDown={stopBubble}
            >
              {(["1K", "2K", "4K"] as const).map((resolution) => {
                const active = (element.genResolution || "1K") === resolution;
                return (
                  <button
                    key={resolution}
                    type="button"
                    className={`w-full rounded-lg px-3 py-2 text-left text-xs transition ${
                      active
                        ? "bg-[#f2efff] font-semibold text-[#6b4eff]"
                        : "text-[#475467] hover:bg-[#f8f9fc]"
                    }`}
                    onClick={(event) => {
                      activateNode();
                      stopBubble(event);
                      updateSelectedElement({ genResolution: resolution });
                      closeAllPickers();
                    }}
                  >
                    {resolution}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="relative min-w-0">
          <button
            type="button"
            className={`${CONTROL_PILL_SECONDARY_CLASS} w-full justify-between`}
            onMouseDown={(event) => {
              activateNode();
              stopBubble(event);
            }}
            onClick={(event) => {
              activateNode();
              stopBubble(event);
              setShowRatioPicker((value) => !value);
              setShowModelPicker(false);
              setShowCountPicker(false);
              setShowResPicker(false);
              setShowQualityPicker(false);
            }}
          >
            <span>{element.genAspectRatio || "1:1"}</span>
            <ChevronDown size={11} className="opacity-50" />
          </button>
          {showRatioPicker ? (
            <div
              className="absolute bottom-full right-0 z-[70] mb-2 max-h-72 w-44 overflow-y-auto rounded-2xl border border-[#e6e8f0] bg-white p-1.5 shadow-[0_18px_44px_rgba(15,23,42,0.16)]"
              onMouseDown={stopBubble}
            >
              {aspectRatios.map((ratio) => {
                const active = (element.genAspectRatio || "1:1") === ratio.value;
                return (
                  <button
                    key={ratio.value}
                    type="button"
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition ${
                      active
                        ? "bg-[#f2efff] font-semibold text-[#6b4eff]"
                        : "text-[#475467] hover:bg-[#f8f9fc]"
                    }`}
                    onClick={(event) => {
                      activateNode();
                      stopBubble(event);
                      updateSelectedElement({ genAspectRatio: ratio.value });
                      closeAllPickers();
                    }}
                  >
                    <span>{ratio.label}</span>
                    <span className="text-[10px] text-[#98a2b3]">{ratio.size}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="relative min-w-0">
          <button
            type="button"
            className={`${CONTROL_PILL_SECONDARY_CLASS} w-full justify-between`}
            onMouseDown={(event) => {
              activateNode();
              stopBubble(event);
            }}
            onClick={(event) => {
              activateNode();
              stopBubble(event);
              setShowQualityPicker((value) => !value);
              setShowModelPicker(false);
              setShowCountPicker(false);
              setShowResPicker(false);
              setShowRatioPicker(false);
            }}
          >
            <span>{IMAGE_QUALITY_SHORT_LABEL[imageQuality]}</span>
            <ChevronDown size={11} className="opacity-50" />
          </button>
          {showQualityPicker ? (
            <div
              className="absolute bottom-full right-0 z-[70] mb-2 w-28 rounded-xl border border-[#e6e8f0] bg-white p-1 shadow-[0_16px_34px_rgba(15,23,42,0.14)]"
              onMouseDown={stopBubble}
            >
              {IMAGE_QUALITY_OPTIONS.map((quality) => {
                const active = imageQuality === quality;
                return (
                  <button
                    key={quality}
                    type="button"
                    className={`w-full rounded-lg px-3 py-2 text-left text-xs transition ${
                      active
                        ? "bg-[#f2efff] font-semibold text-[#6b4eff]"
                        : "text-[#475467] hover:bg-[#f8f9fc]"
                    }`}
                    onClick={(event) => {
                      activateNode();
                      stopBubble(event);
                      updateSelectedElement({ genImageQuality: quality });
                      closeAllPickers();
                    }}
                  >
                    {IMAGE_QUALITY_SHORT_LABEL[quality]}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

    </div>
  );
};

export const WorkspaceTreePromptNode: React.FC<
  WorkspaceTreePromptNodeProps
> = ({
  element,
  zoom,
  thumbUrls,
  sourceRefUrls,
  promptValue,
  setElementsSynced,
  setPreviewUrl,
  isGenerating,
  isSelected,
  modelOptions,
  aspectRatios,
  selectElement,
  updateSelectedElement,
  handleRefImageUpload,
  handleGenImage,
  onDelete,
  refUploadInputId,
}) => {
  const parentIds = getAllNodeParentIds(element);
  const helperCount = Math.max(1, parentIds.length || thumbUrls.length);
  const activeToneId = element.treeNodeTone || "lavender";
  const activeTone =
    TREE_PROMPT_TONES.find((tone) => tone.id === activeToneId) ||
    TREE_PROMPT_TONES[0];
  const isCollapsed = Boolean(element.treeChildrenCollapsed);
  const normalizedPrompt = (promptValue || "").trim();
  const promptText =
    normalizedPrompt ||
      "generate one mockup in similar photograph angle and frame composition, clean and professional.";
  const normalizedCardHeight = getTreePromptCardHeight(promptText, thumbUrls.length);

  React.useEffect(() => {
    const normalizedWidth = CARD_MAX_WIDTH;
    const normalizedHeight = normalizedCardHeight;

    if (
      element.width === normalizedWidth &&
      element.height === normalizedHeight
    ) {
      return;
    }

    setElementsSynced((currentElements) =>
      currentElements.map((item) =>
        item.id === element.id
          ? {
              ...item,
              width: normalizedWidth,
              height: normalizedHeight,
            }
          : item,
      ),
    );
  }, [
    element.height,
    element.id,
    element.width,
    normalizedCardHeight,
    setElementsSynced,
  ]);

  const updatePrompt = (nextPrompt: string) => {
    setElementsSynced((currentElements) =>
      currentElements.map((item) =>
        item.id === element.id
          ? {
              ...item,
              genPrompt: nextPrompt,
              genStatusPhase: undefined,
              genStatusTitle: undefined,
              genStatusLines: undefined,
            }
          : item,
      ),
    );
  };

  const activateNode = () => {
    selectElement(element.id);
  };

  const handleCopyPrompt = React.useCallback(async () => {
    const text = (promptValue || "").trim();
    if (!text || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.warn("[tree-node] copy prompt failed", error);
    }
  }, [promptValue]);

  const cardHeight = normalizedCardHeight;
  const canUsePosterProductMode = sourceRefUrls.length >= 2;
  const isBerserkEnabled = Boolean(element.genInfiniteRetry);
  const showBerserkVisualState = isBerserkEnabled && isGenerating;

  return (
    <div
      className="relative h-full w-full overflow-visible"
      data-tree-prompt-node-version="2026-04-29"
    >
      <div
        className="relative mx-auto"
        style={{
          width: `${Math.min(CARD_MAX_WIDTH, element.width)}px`,
          maxWidth: "100%",
          height: `${cardHeight}px`,
        }}
      >
        {isSelected ? (
          <div
            className="pointer-events-none absolute -inset-[4px]"
            style={{
              borderRadius: WORKSPACE_NODE_SELECTION_RADIUS,
              boxShadow: WORKSPACE_NODE_SELECTION_SHADOW,
            }}
          />
        ) : null}
        {showBerserkVisualState ? (
          <div
            className="pointer-events-none absolute -inset-[4px]"
            style={{
              borderRadius: WORKSPACE_NODE_SELECTION_RADIUS,
              boxShadow: WORKSPACE_NODE_BERSERK_SHADOW,
            }}
          />
        ) : null}
        {isSelected ? (
          <TreePromptToolbar
            activeTone={activeTone.id}
            canUsePosterProductMode={canUsePosterProductMode}
            isBerserkRetryEnabled={Boolean(element.genInfiniteRetry)}
            onToneChange={(tone) => updateSelectedElement({ treeNodeTone: tone })}
            onStyleLibraryChange={(mode) =>
              updateSelectedElement({ genReferenceRoleMode: mode })
            }
            onToggleBerserkRetry={() =>
              updateSelectedElement({
                genInfiniteRetry: !element.genInfiniteRetry,
              })
            }
            onCopy={() => void handleCopyPrompt()}
            onDelete={onDelete}
            styleLibraryMode={element.genReferenceRoleMode}
          />
        ) : null}
        <div
          className="relative grid h-full w-full grid-rows-[auto_minmax(0,1fr)_auto] border px-8 pb-6 pt-8 text-[#111827] transition-[box-shadow,border-color] duration-200"
          style={{
            borderRadius: WORKSPACE_NODE_RADIUS,
            background: showBerserkVisualState
              ? `linear-gradient(180deg, rgba(255,246,241,0.96) 0%, rgba(255,225,211,0.82) 16%, ${activeTone.fill} 38%, ${activeTone.fill} 100%)`
              : `linear-gradient(180deg, rgba(255,255,255,0.46) 0%, ${activeTone.fill} 24%, ${activeTone.fill} 100%)`,
            borderColor: isSelected
              ? "rgba(255,255,255,0.92)"
              : showBerserkVisualState
                ? "rgba(255,137,92,0.88)"
              : "rgba(209,212,219,0.9)",
            boxShadow: isSelected
              ? "0 14px 32px rgba(15,23,42,0.08)"
              : showBerserkVisualState
                ? "0 16px 34px rgba(255,106,61,0.12)"
                : "0 10px 24px rgba(15,23,42,0.04)",
          }}
        >
          {showBerserkVisualState ? (
            <div className="pointer-events-none absolute right-5 top-5 z-[6] rounded-full border border-[rgba(255,161,118,0.92)] bg-[rgba(255,103,46,0.94)] px-2.5 py-1 text-[10px] font-bold tracking-[0.04em] text-white shadow-[0_10px_24px_rgba(255,94,0,0.26)]">
              {LABEL_BERSERK_ACTIVE}
            </div>
          ) : null}
          <ReferenceThumbStrip
            thumbUrls={thumbUrls}
            sourceRefUrls={sourceRefUrls}
            setPreviewUrl={setPreviewUrl}
          />

          <div className="relative z-[1] min-h-0">
            <div className="mb-3 flex justify-center text-[12px] leading-none">
              <span className="rounded-[8px] bg-[#f3efff] px-2 py-1 text-center font-medium text-[#6b4eff] shadow-[inset_0_0_0_1px_rgba(107,78,255,0.10)]">
                跟进生成 {helperCount} 个节点
              </span>
            </div>

            <textarea
              value={promptValue}
              placeholder="generate one mockup in similar photograph angle and frame composition, clean and professional."
              className="h-[calc(100%-28px)] min-h-[128px] w-full resize-none bg-transparent text-[15px] font-semibold leading-[1.75] tracking-[-0.01em] text-[#111111] outline-none placeholder:text-[#8b94a7]"
              onMouseDown={(event) => {
                activateNode();
                event.stopPropagation();
              }}
              onChange={(event) => updatePrompt(event.target.value)}
              style={{
                fontSize: `${Math.max(14, 15 * (100 / Math.max(zoom, 100)))}px`,
              }}
            />
          </div>

          <TreePromptGenerateControls
            element={element}
            modelOptions={modelOptions}
            aspectRatios={aspectRatios}
            sourceRefUrls={sourceRefUrls}
            refUploadInputId={refUploadInputId}
            selectElement={selectElement}
            updateSelectedElement={updateSelectedElement}
            handleGenImage={handleGenImage}
          />

          <input
            id={refUploadInputId}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => void handleRefImageUpload(event, element.id)}
          />

          {isGenerating ? (
            <div
              className={`pointer-events-none absolute inset-0 ${
                showBerserkVisualState
                  ? "bg-[rgba(255,104,47,0.10)]"
                  : "bg-white/18"
              }`}
              style={{ borderRadius: WORKSPACE_NODE_RADIUS }}
            />
          ) : null}

          <button
            type="button"
            aria-label={isCollapsed ? LABEL_EXPAND : LABEL_COLLAPSE}
            className="absolute left-1/2 top-full z-20 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#d8d6df] bg-[#f8f8fb] text-[#7b8090] shadow-[0_6px_14px_rgba(15,23,42,0.10)] transition hover:text-[#111827]"
            onMouseDown={(event) => {
              activateNode();
              event.stopPropagation();
            }}
            onClick={(event) => {
              activateNode();
              event.stopPropagation();
              updateSelectedElement({
                treeChildrenCollapsed: !isCollapsed,
              });
            }}
          >
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
};
