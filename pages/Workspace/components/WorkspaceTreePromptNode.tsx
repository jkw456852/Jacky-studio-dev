import React from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Box,
  ChevronDown,
  ChevronUp,
  Copy,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import type {
  CanvasElement,
  ImageModel,
  WorkspaceStyleLibrary,
} from "../../../types";
import {
  WORKSPACE_NODE_BERSERK_SHADOW,
  WORKSPACE_NODE_RADIUS,
  WORKSPACE_NODE_SELECTION_RADIUS,
  WORKSPACE_NODE_SELECTION_SHADOW,
} from "./workspaceNodeStyles";
import { TREE_NODE_CARD_WIDTH } from "../workspaceTreeNode";
import { normalizeMappedModelId } from "../../../services/provider-settings";
import {
  STYLE_LIBRARY_MODE_META,
  createStyleLibraryDraftFromMode,
  getEffectiveStyleLibrary,
  getStyleLibraryLabel,
  getPresetStyleLibrary,
  listBuiltInStyleLibraries,
  listUserStyleLibraries,
  normalizeWorkspaceStyleLibrary,
} from "../../../services/vision-orchestrator/style-library";
import { getStudioUserAssetApi } from "../../../services/runtime-assets/api";

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
const LABEL_STYLE_LIBRARY_CUSTOM = "\u81ea\u5b9a\u4e49";
const LABEL_STYLE_LIBRARY_DETAILS = "\u8be6\u60c5";
const LABEL_STYLE_LIBRARY_EDIT = "\u7f16\u8f91";
const LABEL_STYLE_LIBRARY_CONVERT = "\u8f6c\u4e3a\u81ea\u5b9a\u4e49";
const LABEL_STYLE_LIBRARY_CREATE = "\u65b0\u5efa\u98ce\u683c\u5e93";
const LABEL_STYLE_LIBRARY_SAVE = "\u4fdd\u5b58";
const LABEL_STYLE_LIBRARY_SAVE_ASSET = "\u5b58\u4e3a\u6b63\u5f0f\u98ce\u683c\u5e93";
const LABEL_STYLE_LIBRARY_DELETE = "\u5220\u9664\u8d44\u4ea7";
const LABEL_STYLE_LIBRARY_SYSTEM = "\u7cfb\u7edf\u5185\u7f6e";
const LABEL_STYLE_LIBRARY_USER = "\u7528\u6237\u8d44\u4ea7";
const LABEL_STYLE_LIBRARY_RUNTIME = "\u4e34\u65f6\u98ce\u683c";
const LABEL_STYLE_LIBRARY_USAGE = "\u9002\u7528\u573a\u666f";
const LABEL_STYLE_LIBRARY_EMPTY =
  "\u5f53\u524d\u8fd8\u6ca1\u6709\u6b63\u5f0f\u4fdd\u5b58\u7684\u7528\u6237\u98ce\u683c\u5e93\u3002";
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
  connectedParentCount: number;
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
  if (thumbUrls.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {thumbUrls.map((thumbUrl, index) => {
        const previewUrl = sourceRefUrls[index] || thumbUrl;
        const isPrimary = index === 0;
        return (
          <button
            key={`${thumbUrl}-${index}`}
            type="button"
            className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-white/80 bg-[#f7f4ed] transition hover:-translate-y-0.5 ${
              isPrimary
                ? "h-12 w-12 rounded-[14px] shadow-[0_10px_22px_rgba(15,23,42,0.08)]"
                : "h-10 w-10 rounded-[12px] shadow-[0_8px_18px_rgba(15,23,42,0.07)]"
            }`}
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

const TreePromptReferenceUploadTrigger: React.FC<{
  refCount: number;
  refUploadInputId: string;
  onActivate: () => void;
}> = ({ refCount, refUploadInputId, onActivate }) => (
  <label
    htmlFor={refUploadInputId}
    className={TREE_PROMPT_REF_TRIGGER_CLASS}
    title={LABEL_UPLOAD}
    onMouseDown={(event) => {
      onActivate();
      event.stopPropagation();
    }}
    onClick={(event) => {
      onActivate();
      event.stopPropagation();
    }}
  >
    <Plus size={22} strokeWidth={1.8} />
    {refCount > 0 ? (
      <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#6b4eff] px-1.5 text-[10px] font-semibold leading-none text-white shadow-[0_6px_14px_rgba(107,78,255,0.34)]">
        {refCount}
      </span>
    ) : null}
  </label>
);

type StyleLibraryDraftState = {
  title: string;
  summary: string;
  referenceInterpretation: string;
  planningDirectivesText: string;
  promptDirectivesText: string;
};

const toDirectiveText = (values: string[] | undefined) =>
  Array.isArray(values) ? values.join("\n") : "";

const buildStyleLibraryDraft = (
  library?: WorkspaceStyleLibrary | null,
): StyleLibraryDraftState => {
  const normalized = normalizeWorkspaceStyleLibrary(library);
  return {
    title: normalized?.title || "",
    summary: normalized?.summary || "",
    referenceInterpretation: normalized?.referenceInterpretation || "",
    planningDirectivesText: toDirectiveText(normalized?.planningDirectives),
    promptDirectivesText: toDirectiveText(normalized?.promptDirectives),
  };
};

const parseDirectiveText = (value: string) =>
  String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const buildStyleLibraryFromDraft = (
  draft: StyleLibraryDraftState,
  createdBy: WorkspaceStyleLibrary["createdBy"] = "user",
): WorkspaceStyleLibrary | undefined =>
  normalizeWorkspaceStyleLibrary({
    title: draft.title,
    summary: draft.summary,
    referenceInterpretation: draft.referenceInterpretation,
    planningDirectives: parseDirectiveText(draft.planningDirectivesText),
    promptDirectives: parseDirectiveText(draft.promptDirectivesText),
    createdBy,
    updatedAt: Date.now(),
  });

const persistUserStyleLibraryAsset = (
  library: WorkspaceStyleLibrary | undefined,
  sourceMode?: "default" | "poster-product" | "custom",
) => {
  if (!library) return null;
  return getStudioUserAssetApi().saveStyleLibrary(library, {
    sourceMode: sourceMode || "custom",
  });
};

const buildDetachedStyleLibraryAsset = (
  library: WorkspaceStyleLibrary | undefined,
): WorkspaceStyleLibrary | undefined => {
  const normalized = normalizeWorkspaceStyleLibrary(library);
  if (!normalized) return undefined;
  return {
    ...normalized,
    id: undefined,
    slug: undefined,
    updatedAt: undefined,
    createdBy: "user",
  };
};

const getStyleLibrarySourceLabel = (
  library: WorkspaceStyleLibrary | null | undefined,
) => {
  const normalized = normalizeWorkspaceStyleLibrary(library);
  if (!normalized) return LABEL_STYLE_LIBRARY_RUNTIME;
  if (normalized.createdBy === "system") return LABEL_STYLE_LIBRARY_SYSTEM;
  if (normalized.id) return LABEL_STYLE_LIBRARY_USER;
  return LABEL_STYLE_LIBRARY_RUNTIME;
};

type TreePromptStyleLibraryModalProps = {
  canUsePosterProductMode: boolean;
  effectiveStyleLibrary?: WorkspaceStyleLibrary;
  isEditingStyleLibrary: boolean;
  normalizedStyleLibraryMode: NonNullable<CanvasElement["genReferenceRoleMode"]>;
  onApplyDraft: () => boolean;
  onClose: () => void;
  onDeleteSelectedUserStyleLibrary: () => void;
  onSaveDetachedAsset: () => void;
  onSeedCustomStyleLibrary: () => void;
  onSelectMode: (mode: NonNullable<CanvasElement["genReferenceRoleMode"]>) => void;
  onSelectUserLibrary: (libraryId: string | null) => void;
  onStartEditing: () => void;
  onStopEditing: () => void;
  onStyleDraftChange: React.Dispatch<React.SetStateAction<StyleLibraryDraftState>>;
  onUseSelectedUserLibrary: (library: WorkspaceStyleLibrary) => void;
  onEditSelectedUserLibrary: (library: WorkspaceStyleLibrary) => void;
  selectedUserStyleLibrary: WorkspaceStyleLibrary | null;
  setShowStyleLibraryDetails: React.Dispatch<React.SetStateAction<boolean>>;
  showStyleLibraryDetails: boolean;
  styleLibraryDraft: StyleLibraryDraftState;
  styleLibraryOptions: Array<{
    value: NonNullable<CanvasElement["genReferenceRoleMode"]>;
    label: string;
    hint: string;
    disabled?: boolean;
  }>;
  userStyleLibraries: WorkspaceStyleLibrary[];
};

const TreePromptStyleLibraryModal: React.FC<TreePromptStyleLibraryModalProps> = ({
  onClose,
}) => {
  void onClose;
  return null;
};

type TreePromptStyleGalleryItemV2 = {
  key: string;
  title: string;
  summary: string;
  badge: string;
  subBadge?: string;
  library?: WorkspaceStyleLibrary;
  mode?: NonNullable<CanvasElement["genReferenceRoleMode"]>;
  origin: "system" | "user" | "runtime";
  disabled?: boolean;
  isActive: boolean;
  sortOrder: number;
};

const TreePromptStyleLibraryModalV2: React.FC<TreePromptStyleLibraryModalProps> = ({
  canUsePosterProductMode,
  effectiveStyleLibrary,
  isEditingStyleLibrary,
  normalizedStyleLibraryMode,
  onApplyDraft,
  onClose,
  onDeleteSelectedUserStyleLibrary,
  onSaveDetachedAsset,
  onSeedCustomStyleLibrary,
  onSelectMode,
  onSelectUserLibrary,
  onStartEditing,
  onStopEditing,
  onStyleDraftChange,
  onUseSelectedUserLibrary,
  onEditSelectedUserLibrary,
  selectedUserStyleLibrary,
  setShowStyleLibraryDetails,
  showStyleLibraryDetails,
  styleLibraryDraft,
  styleLibraryOptions,
  userStyleLibraries,
}) => {
  const [activeTab, setActiveTab] = React.useState<"gallery" | "mine" | "current">("gallery");
  const [activeFilter, setActiveFilter] = React.useState<
    "all" | "system" | "user" | "runtime" | "active"
  >("all");
  const [searchValue, setSearchValue] = React.useState("");
  const [portalReady, setPortalReady] = React.useState(false);

  React.useEffect(() => {
    setPortalReady(true);
  }, []);

  React.useEffect(() => {
    setActiveFilter("all");
  }, [activeTab]);

  const builtInLibraries = React.useMemo(
    () =>
      listBuiltInStyleLibraries().map(({ mode, library }) => ({
        id: mode,
        mode,
        library,
        label: STYLE_LIBRARY_MODE_META[mode].label,
        hint: STYLE_LIBRARY_MODE_META[mode].hint,
      })),
    [],
  );

  const normalizedSearch = searchValue.trim().toLowerCase();
  const currentModeItem = React.useMemo(
    () => styleLibraryOptions.find((option) => option.value === normalizedStyleLibraryMode),
    [normalizedStyleLibraryMode, styleLibraryOptions],
  );

  const currentModeLibrary = React.useMemo(() => {
    if (normalizedStyleLibraryMode === "custom") {
      return effectiveStyleLibrary;
    }
    return (
      builtInLibraries.find((item) => item.mode === normalizedStyleLibraryMode)?.library ||
      effectiveStyleLibrary
    );
  }, [builtInLibraries, effectiveStyleLibrary, normalizedStyleLibraryMode]);

  const allGalleryItems = React.useMemo<TreePromptStyleGalleryItemV2[]>(() => {
    const modeItems = styleLibraryOptions.map((option, index) => {
      const builtIn = builtInLibraries.find((item) => item.mode === option.value);
      const isActive = normalizedStyleLibraryMode === option.value;
      const isCustom = option.value === "custom";
      const previewTitle =
        option.value === "none"
          ? option.label
          : builtIn?.library.title || effectiveStyleLibrary?.title || option.label;
      const previewSummary =
        option.value === "none"
          ? option.hint
          : builtIn?.library.summary || effectiveStyleLibrary?.summary || option.hint;
      return {
        key: `mode-${option.value}`,
        title: previewTitle,
        summary: previewSummary,
        badge:
          option.value === "none"
            ? "OFF"
            : isCustom
              ? LABEL_STYLE_LIBRARY_RUNTIME
              : LABEL_STYLE_LIBRARY_SYSTEM,
        subBadge:
          option.value === "poster-product" && !canUsePosterProductMode
            ? "Need 2 refs"
            : isActive
              ? "当前使用"
              : undefined,
        library: option.value === "none" ? undefined : builtIn?.library || effectiveStyleLibrary,
        mode: option.value,
        origin: isCustom ? "runtime" : "system",
        disabled: option.disabled,
        isActive,
        sortOrder: index,
      };
    });

    const userItems = userStyleLibraries.map((library, index) => ({
      key: `user-${library.id || index}`,
      title: library.title,
      summary: library.summary,
      badge: LABEL_STYLE_LIBRARY_USER,
      subBadge:
        effectiveStyleLibrary?.id && effectiveStyleLibrary.id === library.id
          ? "当前使用"
          : library.sourceMode || "custom",
      library,
      mode: "custom" as NonNullable<CanvasElement["genReferenceRoleMode"]>,
      origin: "user" as const,
      disabled: false,
      isActive: Boolean(effectiveStyleLibrary?.id && effectiveStyleLibrary.id === library.id),
      sortOrder: 100 + index,
    }));

    return [...modeItems, ...userItems];
  }, [
    builtInLibraries,
    canUsePosterProductMode,
    effectiveStyleLibrary,
    normalizedStyleLibraryMode,
    styleLibraryOptions,
    userStyleLibraries,
  ]);

  const visibleGalleryItems = React.useMemo(() => {
    let items = allGalleryItems;

    if (activeTab === "gallery") {
      items = items.filter((item) => item.origin !== "user");
    } else if (activeTab === "mine") {
      items = items.filter((item) => item.origin === "user" || item.origin === "runtime");
    } else {
      items = items.filter(
        (item) =>
          item.isActive ||
          item.mode === normalizedStyleLibraryMode ||
          (selectedUserStyleLibrary?.id && item.library?.id === selectedUserStyleLibrary.id),
      );
    }

    if (activeFilter !== "all") {
      items = items.filter((item) => {
        if (activeFilter === "active") return item.isActive;
        return item.origin === activeFilter;
      });
    }

    if (normalizedSearch) {
      items = items.filter((item) =>
        [
          item.title,
          item.summary,
          item.badge,
          item.subBadge || "",
          item.library?.referenceInterpretation || "",
          item.library?.sourceMode || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch),
      );
    }

    return items.sort(
      (a, b) => Number(b.isActive) - Number(a.isActive) || a.sortOrder - b.sortOrder,
    );
  }, [
    activeFilter,
    activeTab,
    allGalleryItems,
    normalizedSearch,
    normalizedStyleLibraryMode,
    selectedUserStyleLibrary?.id,
  ]);

  const detailItem =
    visibleGalleryItems.find(
      (item) => item.library?.id && item.library.id === selectedUserStyleLibrary?.id,
    ) ||
    visibleGalleryItems.find((item) => item.isActive) ||
    visibleGalleryItems[0] ||
    allGalleryItems.find((item) => item.mode === normalizedStyleLibraryMode) ||
    null;

  const detailLibrary = detailItem?.library || currentModeLibrary;
  const detailTitle =
    detailItem?.title ||
    currentModeLibrary?.title ||
    currentModeItem?.label ||
    "当前未启用风格库";
  const detailSummary =
    detailItem?.summary ||
    currentModeLibrary?.summary ||
    currentModeItem?.hint ||
    "当前节点还没有附加的风格约束。";
  const detailDirectives = detailLibrary?.planningDirectives || [];
  const promptDirectives = detailLibrary?.promptDirectives || [];

  const filterChips = [
    { id: "all", label: "全部" },
    { id: "system", label: "系统内置" },
    { id: "user", label: "用户资产" },
    { id: "runtime", label: "临时风格" },
    { id: "active", label: "当前使用" },
  ] as const;

  const handleSelectGalleryItem = (item: TreePromptStyleGalleryItemV2) => {
    setShowStyleLibraryDetails(true);
    if (item.origin === "user") {
      onSelectUserLibrary(item.library?.id || null);
      return;
    }
    if (item.mode === "custom") {
      if (item.library) {
        onSelectUserLibrary(null);
        return;
      }
      onSeedCustomStyleLibrary();
      return;
    }
    if (item.mode) {
      onSelectUserLibrary(null);
      onSelectMode(item.mode);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[260] bg-[rgba(15,23,42,0.42)] backdrop-blur-[6px]"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={onClose}
    >
      <div
        className="absolute inset-[16px] overflow-hidden rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,248,252,0.97))] shadow-[0_28px_120px_rgba(15,23,42,0.26)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid h-full min-h-0 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-h-0 flex-col border-r border-[#edf0f6]">
            <div className="border-b border-[#edf0f6] px-7 pb-4 pt-6">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9aa4b7]">
                    STYLE LIBRARY
                  </div>
                  <h3 className="mt-3 text-[34px] font-semibold tracking-[-0.04em] text-[#0f172a]">
                    风格资源广场
                  </h3>
                  <p className="mt-2 max-w-[520px] text-[14px] leading-6 text-[#64748b]">
                    给关键词节点选择系统风格、用户资产，或者临时组织一套新的风格脑。
                  </p>
                </div>
                <button
                  type="button"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#e6eaf2] bg-white/92 text-[#6b7280] transition hover:border-[#cfd5e3] hover:text-[#111827]"
                  onClick={onClose}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                {[
                  { id: "gallery", label: "广场" },
                  { id: "mine", label: "我的风格" },
                  { id: "current", label: "当前配置" },
                ].map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={`rounded-[14px] px-4 py-2.5 text-[13px] font-semibold transition ${
                        active
                          ? "bg-[#111827] text-white shadow-[0_12px_28px_rgba(17,24,39,0.18)]"
                          : "bg-[#f3f5f9] text-[#475569] hover:bg-[#e9edf5]"
                      }`}
                      onClick={() =>
                        setActiveTab(tab.id as "gallery" | "mine" | "current")
                      }
                    >
                      {tab.label}
                    </button>
                  );
                })}

                <label className="ml-auto flex h-12 min-w-[280px] flex-1 items-center gap-3 rounded-[16px] border border-[#e7eaf1] bg-[#f6f8fb] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] md:max-w-[440px] md:flex-none">
                  <Search size={15} className="text-[#94a3b8]" />
                  <input
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder="搜索风格名称、用途或约束方向"
                    className="h-full w-full bg-transparent text-[13px] text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                {filterChips.map((chip) => {
                  const active = activeFilter === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      className={`rounded-[12px] px-3.5 py-2 text-[12px] font-medium transition ${
                        active
                          ? "bg-[#e8eefc] text-[#315efb]"
                          : "bg-transparent text-[#556274] hover:bg-[#f3f6fb]"
                      }`}
                      onClick={() => setActiveFilter(chip.id)}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {activeTab === "mine" ? (
                <button
                  type="button"
                  className="mb-5 flex h-[88px] w-full items-center justify-center gap-3 rounded-[22px] border border-dashed border-[#d6ddeb] bg-[linear-gradient(180deg,#ffffff,#f7f9fc)] text-[14px] font-semibold text-[#315efb] transition hover:border-[#315efb] hover:shadow-[0_14px_32px_rgba(49,94,251,0.10)]"
                  onClick={onSeedCustomStyleLibrary}
                >
                  <Plus size={16} />
                  鏂板缓涓€涓鏍煎簱
                </button>
              ) : null}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
                {visibleGalleryItems.map((item, index) => {
                  const active =
                    item.isActive ||
                    Boolean(
                      selectedUserStyleLibrary?.id &&
                        item.library?.id === selectedUserStyleLibrary.id,
                    );
                  return (
                    <button
                      key={item.key}
                      type="button"
                      disabled={item.disabled}
                      className={`group overflow-hidden rounded-[22px] border text-left transition ${
                        active
                          ? "border-[#315efb] bg-white shadow-[0_16px_38px_rgba(49,94,251,0.16)]"
                          : "border-[#edf1f6] bg-white/96 hover:-translate-y-0.5 hover:border-[#d7dfeb] hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)]"
                      } disabled:cursor-not-allowed disabled:opacity-45`}
                      onClick={() => handleSelectGalleryItem(item)}
                    >
                      <div
                        className="relative h-[126px] overflow-hidden px-4 py-4"
                        style={{
                          background:
                            item.origin === "user"
                              ? "linear-gradient(135deg, rgba(238,242,255,0.95), rgba(255,255,255,0.96))"
                              : item.origin === "runtime"
                                ? "linear-gradient(135deg, rgba(255,247,237,0.96), rgba(255,255,255,0.96))"
                                : index % 3 === 0
                                  ? "linear-gradient(135deg, rgba(240,244,255,0.98), rgba(255,255,255,0.96))"
                                  : index % 3 === 1
                                    ? "linear-gradient(135deg, rgba(245,242,255,0.98), rgba(255,255,255,0.96))"
                                    : "linear-gradient(135deg, rgba(242,248,247,0.98), rgba(255,255,255,0.96))",
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="rounded-full bg-white/86 px-2.5 py-1 text-[10px] font-semibold text-[#697386] shadow-[0_4px_10px_rgba(15,23,42,0.06)]">
                            {item.badge}
                          </span>
                          {active ? (
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#111827] text-white shadow-[0_8px_18px_rgba(17,24,39,0.16)]">
                              <Check size={14} />
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-7 line-clamp-2 text-[22px] font-semibold leading-[1.15] tracking-[-0.03em] text-[#0f172a]">
                          {item.title}
                        </div>
                        {item.subBadge ? (
                          <div className="mt-3 text-[11px] font-semibold tracking-[0.08em] text-[#73819b]">
                            {item.subBadge}
                          </div>
                        ) : null}
                      </div>
                      <div className="px-4 pb-4 pt-3">
                        <div className="line-clamp-3 min-h-[66px] text-[12px] leading-6 text-[#5b6678]">
                          {item.summary}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {visibleGalleryItems.length === 0 ? (
                <div className="flex h-[260px] items-center justify-center rounded-[24px] border border-dashed border-[#d8dfeb] bg-white/76 text-[14px] text-[#8a94a7]">
                  当前筛选下还没有可用风格库
                </div>
              ) : null}
            </div>
          </div>

          <aside
            className={`${
              showStyleLibraryDetails ? "flex" : "hidden xl:flex"
            } min-h-0 flex-col border-t border-[#edf0f6] bg-[linear-gradient(180deg,rgba(251,252,255,0.98),rgba(246,248,252,0.96))] xl:border-l xl:border-t-0`}
          >
            <div className="border-b border-[#edf0f6] px-6 pb-5 pt-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9aa4b7]">
                LIVE DETAIL
              </div>
              <div className="mt-3 text-[28px] font-semibold leading-[1.18] tracking-[-0.04em] text-[#0f172a]">
                {isEditingStyleLibrary ? "编辑风格库" : detailTitle}
              </div>
              <p className="mt-3 text-[13px] leading-6 text-[#64748b]">
                {isEditingStyleLibrary
                  ? "把参考图解释、规划约束和 Prompt 指令整理成可复用资产。"
                  : detailSummary}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {!isEditingStyleLibrary && selectedUserStyleLibrary ? (
                  <>
                    <button
                      type="button"
                      className="rounded-[14px] bg-[#111827] px-4 py-2.5 text-[12px] font-semibold text-white"
                      onClick={() => onUseSelectedUserLibrary(selectedUserStyleLibrary)}
                    >
                      直接使用
                    </button>
                    <button
                      type="button"
                      className="rounded-[14px] border border-[#dbe2ed] bg-white px-4 py-2.5 text-[12px] font-semibold text-[#475569]"
                      onClick={() => onEditSelectedUserLibrary(selectedUserStyleLibrary)}
                    >
                      {LABEL_STYLE_LIBRARY_EDIT}
                    </button>
                    <button
                      type="button"
                      className="rounded-[14px] bg-[#fff1f2] px-4 py-2.5 text-[12px] font-semibold text-[#be123c]"
                      onClick={onDeleteSelectedUserStyleLibrary}
                    >
                      {LABEL_STYLE_LIBRARY_DELETE}
                    </button>
                  </>
                ) : null}

                {!isEditingStyleLibrary && !selectedUserStyleLibrary ? (
                  <>
                    <button
                      type="button"
                      className="rounded-[14px] bg-[#111827] px-4 py-2.5 text-[12px] font-semibold text-white"
                      onClick={() => setShowStyleLibraryDetails((value) => !value)}
                    >
                      {showStyleLibraryDetails ? "鏀惰捣璇︽儏" : LABEL_STYLE_LIBRARY_DETAILS}
                    </button>
                    <button
                      type="button"
                      className="rounded-[14px] border border-[#dbe2ed] bg-white px-4 py-2.5 text-[12px] font-semibold text-[#475569]"
                      onClick={() => {
                        setShowStyleLibraryDetails(true);
                        onStartEditing();
                      }}
                    >
                      {normalizedStyleLibraryMode === "custom"
                        ? LABEL_STYLE_LIBRARY_EDIT
                        : LABEL_STYLE_LIBRARY_CONVERT}
                    </button>
                    <button
                      type="button"
                      className="rounded-[14px] border border-[#dbe2ed] bg-white px-4 py-2.5 text-[12px] font-semibold text-[#475569]"
                      onClick={onSaveDetachedAsset}
                    >
                      {LABEL_STYLE_LIBRARY_SAVE_ASSET}
                    </button>
                  </>
                ) : null}

                {isEditingStyleLibrary ? (
                  <>
                    <button
                      type="button"
                      className="rounded-[14px] border border-[#dbe2ed] bg-white px-4 py-2.5 text-[12px] font-semibold text-[#475569]"
                      onClick={() => {
                        onStopEditing();
                        setShowStyleLibraryDetails(true);
                      }}
                    >
                      返回预览
                    </button>
                    <button
                      type="button"
                      className="rounded-[14px] border border-[#dbe2ed] bg-white px-4 py-2.5 text-[12px] font-semibold text-[#475569]"
                      onClick={onSaveDetachedAsset}
                    >
                      {LABEL_STYLE_LIBRARY_SAVE_ASSET}
                    </button>
                    <button
                      type="button"
                      className="rounded-[14px] bg-[#111827] px-4 py-2.5 text-[12px] font-semibold text-white"
                      onClick={() => {
                        if (onApplyDraft()) {
                          onClose();
                        }
                      }}
                    >
                      {LABEL_STYLE_LIBRARY_SAVE}
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {isEditingStyleLibrary ? (
                <div className="space-y-4">
                  <label className="block">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">
                      标题
                    </div>
                    <input
                      value={styleLibraryDraft.title}
                      className="h-12 w-full rounded-[16px] border border-[#e4e8f0] bg-white px-4 text-[13px] text-[#0f172a] outline-none transition focus:border-[#315efb]"
                      placeholder="给这套风格起一个便于复用的名字"
                      onChange={(event) =>
                        onStyleDraftChange((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">
                      用途说明
                    </div>
                    <textarea
                      value={styleLibraryDraft.summary}
                      className="min-h-[108px] w-full rounded-[18px] border border-[#e4e8f0] bg-white px-4 py-3 text-[13px] leading-6 text-[#0f172a] outline-none transition focus:border-[#315efb]"
                      placeholder="一句话说明这套风格适合什么场景"
                      onChange={(event) =>
                        onStyleDraftChange((current) => ({
                          ...current,
                          summary: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">
                      参考图解释方式
                    </div>
                    <textarea
                      value={styleLibraryDraft.referenceInterpretation}
                      className="min-h-[132px] w-full rounded-[18px] border border-[#e4e8f0] bg-white px-4 py-3 text-[13px] leading-6 text-[#0f172a] outline-none transition focus:border-[#315efb]"
                      placeholder="描述参考图应该怎样被主脑理解、拆解和使用"
                      onChange={(event) =>
                        onStyleDraftChange((current) => ({
                          ...current,
                          referenceInterpretation: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">
                      规划指令
                    </div>
                    <textarea
                      value={styleLibraryDraft.planningDirectivesText}
                      className="min-h-[160px] w-full rounded-[18px] border border-[#e4e8f0] bg-white px-4 py-3 text-[13px] leading-6 text-[#0f172a] outline-none transition focus:border-[#315efb]"
                      placeholder="每行一条，填写主脑在规划阶段必须遵守的约束"
                      onChange={(event) =>
                        onStyleDraftChange((current) => ({
                          ...current,
                          planningDirectivesText: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">
                      Prompt 指令
                    </div>
                    <textarea
                      value={styleLibraryDraft.promptDirectivesText}
                      className="min-h-[160px] w-full rounded-[18px] border border-[#e4e8f0] bg-white px-4 py-3 text-[13px] leading-6 text-[#0f172a] outline-none transition focus:border-[#315efb]"
                      placeholder="每行一条，填写最终落到提示词里的硬约束"
                      onChange={(event) =>
                        onStyleDraftChange((current) => ({
                          ...current,
                          promptDirectivesText: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-[22px] border border-[#edf1f6] bg-white p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#f3f5f9] px-3 py-1 text-[10px] font-semibold text-[#697386]">
                        {detailItem?.badge || getStyleLibrarySourceLabel(detailLibrary)}
                      </span>
                      {detailItem?.subBadge ? (
                        <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-[10px] font-semibold text-[#315efb]">
                          {detailItem.subBadge}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">
                      参考图解释
                    </div>
                    <p className="mt-3 text-[13px] leading-6 text-[#475569]">
                      {detailLibrary?.referenceInterpretation ||
                        "当前没有额外参考图解释，主脑会按默认语义理解。"}
                    </p>
                  </div>

                  {showStyleLibraryDetails ? (
                    <>
                      <div className="rounded-[22px] border border-[#edf1f6] bg-white p-5">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">
                          规划阶段约束
                        </div>
                        <div className="mt-4 space-y-2">
                          {detailDirectives.length > 0 ? (
                            detailDirectives.map((item) => (
                              <div
                                key={item}
                                className="rounded-[14px] bg-[#f8fafc] px-3.5 py-3 text-[12px] leading-5 text-[#475569]"
                              >
                                {item}
                              </div>
                            ))
                          ) : (
                            <div className="rounded-[14px] bg-[#f8fafc] px-3.5 py-3 text-[12px] leading-5 text-[#94a3b8]">
                              暂无额外规划约束
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-[#edf1f6] bg-white p-5">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">
                          Prompt 阶段约束
                        </div>
                        <div className="mt-4 space-y-2">
                          {promptDirectives.length > 0 ? (
                            promptDirectives.map((item) => (
                              <div
                                key={item}
                                className="rounded-[14px] bg-[#f8fafc] px-3.5 py-3 text-[12px] leading-5 text-[#475569]"
                              >
                                {item}
                              </div>
                            ))
                          ) : (
                            <div className="rounded-[14px] bg-[#f8fafc] px-3.5 py-3 text-[12px] leading-5 text-[#94a3b8]">
                              暂无额外 Prompt 约束
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : null}

                  <div className="rounded-[22px] border border-dashed border-[#d8dfeb] bg-[linear-gradient(180deg,#ffffff,#f7f9fc)] p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">
                      当前状态
                    </div>
                    <div className="mt-4 grid gap-3">
                      <div className="rounded-[16px] bg-[#f8fafc] px-4 py-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
                          Active Mode
                        </div>
                        <div className="mt-1 text-[13px] font-semibold text-[#0f172a]">
                          {normalizedStyleLibraryMode}
                        </div>
                      </div>
                      <div className="rounded-[16px] bg-[#f8fafc] px-4 py-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
                          Asset ID
                        </div>
                        <div className="mt-1 break-all text-[12px] leading-5 text-[#475569]">
                          {detailLibrary?.id || "runtime-only"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );

  if (!portalReady || typeof document === "undefined") {
    return null;
  }

  return createPortal(modalContent, document.body);
};

const TreePromptToolbar: React.FC<{
  activeTone: string;
  canUsePosterProductMode: boolean;
  isBerserkRetryEnabled: boolean;
  onToneChange: (tone: string) => void;
  onStyleLibraryChange: (
    mode: NonNullable<CanvasElement["genReferenceRoleMode"]>,
  ) => void;
  onStyleLibrarySave: (library: WorkspaceStyleLibrary | undefined) => void;
  onToggleBerserkRetry: () => void;
  onCopy: () => void;
  onDelete: () => void;
  styleLibraryMode?: CanvasElement["genReferenceRoleMode"];
  currentStyleLibrary?: WorkspaceStyleLibrary;
}> = ({
  activeTone,
  canUsePosterProductMode,
  isBerserkRetryEnabled,
  onToneChange,
  onStyleLibraryChange,
  onStyleLibrarySave,
  onToggleBerserkRetry,
  onCopy,
  onDelete,
  styleLibraryMode,
  currentStyleLibrary,
}) => {
  const [showStyleLibraryPicker, setShowStyleLibraryPicker] = React.useState(false);
  const [showStyleLibraryDetails, setShowStyleLibraryDetails] =
    React.useState(false);
  const [isEditingStyleLibrary, setIsEditingStyleLibrary] = React.useState(false);
  const [styleLibraryRevision, setStyleLibraryRevision] = React.useState(0);
  const [selectedUserStyleLibraryId, setSelectedUserStyleLibraryId] =
    React.useState<string | null>(null);
  const [styleLibraryDraft, setStyleLibraryDraft] =
    React.useState<StyleLibraryDraftState>(() =>
      buildStyleLibraryDraft(currentStyleLibrary),
    );
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
  const normalizedStyleLibraryMode = (
    styleLibraryMode || "default"
  ) as NonNullable<CanvasElement["genReferenceRoleMode"]>;
  const styleLibraryLabel = getStyleLibraryLabel(
    normalizedStyleLibraryMode,
    currentStyleLibrary,
  );
  const compactStyleLibraryLabel =
    styleLibraryLabel.length > 10
      ? `${styleLibraryLabel.slice(0, 10).trim()}...`
      : styleLibraryLabel;
  const effectiveStyleLibrary = getEffectiveStyleLibrary({
    mode: normalizedStyleLibraryMode,
    customLibrary: currentStyleLibrary,
  });
  const selectedUserStyleLibrary = React.useMemo(
    () =>
      selectedUserStyleLibraryId
        ? getStudioUserAssetApi().getStyleLibraryById(selectedUserStyleLibraryId)
        : null,
    [selectedUserStyleLibraryId, styleLibraryRevision],
  );
  const userStyleLibraries = React.useMemo(
    () => listUserStyleLibraries(),
    [currentStyleLibrary, styleLibraryDraft, showStyleLibraryDetails, styleLibraryRevision],
  );
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
    {
      value: "custom",
      label: LABEL_STYLE_LIBRARY_CUSTOM,
      hint: STYLE_LIBRARY_MODE_META.custom.hint,
    },
  ];

  React.useEffect(() => {
    setStyleLibraryDraft(buildStyleLibraryDraft(currentStyleLibrary));
  }, [currentStyleLibrary, normalizedStyleLibraryMode]);

  React.useEffect(() => {
    if (!userStyleLibraries.length) {
      setSelectedUserStyleLibraryId(null);
      return;
    }
    const matchedLibraryId = effectiveStyleLibrary?.id
      ? userStyleLibraries.find((item) => item.id === effectiveStyleLibrary.id)?.id || null
      : null;
    setSelectedUserStyleLibraryId((current) => {
      if (matchedLibraryId) return matchedLibraryId;
      if (current && userStyleLibraries.some((item) => item.id === current)) return current;
      return userStyleLibraries[0]?.id || null;
    });
  }, [effectiveStyleLibrary?.id, userStyleLibraries]);

  const applyStyleLibraryDraft = React.useCallback(() => {
    const nextLibrary = buildStyleLibraryFromDraft(
      styleLibraryDraft,
      normalizedStyleLibraryMode === "custom" ? "user" : "user",
    );
    if (!nextLibrary) {
      return false;
    }
    const persistedLibrary =
      persistUserStyleLibraryAsset(nextLibrary, "custom") || nextLibrary;
    onStyleLibrarySave(persistedLibrary);
    onStyleLibraryChange("custom");
    setIsEditingStyleLibrary(false);
    setStyleLibraryRevision((value) => value + 1);
    setSelectedUserStyleLibraryId(persistedLibrary.id || null);
    return true;
  }, [
    onStyleLibraryChange,
    onStyleLibrarySave,
    normalizedStyleLibraryMode,
    styleLibraryDraft,
  ]);

  const seedCustomStyleLibrary = React.useCallback(() => {
    const seededLibrary =
      normalizeWorkspaceStyleLibrary(currentStyleLibrary) ||
      createStyleLibraryDraftFromMode(normalizedStyleLibraryMode, "user");
    const persistedLibrary =
      persistUserStyleLibraryAsset(seededLibrary, normalizedStyleLibraryMode) ||
      seededLibrary;
    onStyleLibrarySave(persistedLibrary);
    onStyleLibraryChange("custom");
    setStyleLibraryDraft(buildStyleLibraryDraft(persistedLibrary));
    setShowStyleLibraryDetails(true);
    setIsEditingStyleLibrary(true);
    setStyleLibraryRevision((value) => value + 1);
    setSelectedUserStyleLibraryId(persistedLibrary.id || null);
  }, [
    currentStyleLibrary,
    normalizedStyleLibraryMode,
    onStyleLibraryChange,
    onStyleLibrarySave,
  ]);

  const handleSaveStyleLibraryAsAsset = React.useCallback(() => {
    const assetCandidate = buildDetachedStyleLibraryAsset(
      normalizedStyleLibraryMode === "custom"
        ? buildStyleLibraryFromDraft(styleLibraryDraft, "user") || effectiveStyleLibrary
        : effectiveStyleLibrary,
    );
    if (!assetCandidate) {
      return;
    }
    const persistedLibrary =
      persistUserStyleLibraryAsset(assetCandidate, normalizedStyleLibraryMode) ||
      assetCandidate;
    onStyleLibrarySave(persistedLibrary);
    onStyleLibraryChange("custom");
    setStyleLibraryDraft(buildStyleLibraryDraft(persistedLibrary));
    setShowStyleLibraryDetails(true);
    setIsEditingStyleLibrary(false);
    setStyleLibraryRevision((value) => value + 1);
    setSelectedUserStyleLibraryId(persistedLibrary.id || null);
  }, [
    effectiveStyleLibrary,
    normalizedStyleLibraryMode,
    onStyleLibraryChange,
    onStyleLibrarySave,
    styleLibraryDraft,
  ]);

  const handleDeleteSelectedUserStyleLibrary = React.useCallback(() => {
    if (!selectedUserStyleLibrary?.id) {
      return;
    }
    getStudioUserAssetApi().removeStyleLibrary(selectedUserStyleLibrary.id);
    if (currentStyleLibrary?.id === selectedUserStyleLibrary.id) {
      onStyleLibrarySave(undefined);
      onStyleLibraryChange("default");
    }
    setStyleLibraryRevision((value) => value + 1);
    setSelectedUserStyleLibraryId(null);
  }, [
    currentStyleLibrary?.id,
    onStyleLibraryChange,
    onStyleLibrarySave,
    selectedUserStyleLibrary?.id,
  ]);

  const handleSelectStyleLibraryMode = React.useCallback(
    (mode: NonNullable<CanvasElement["genReferenceRoleMode"]>) => {
      if (mode === "custom") {
        seedCustomStyleLibrary();
        return;
      }
      onStyleLibraryChange(mode);
      setIsEditingStyleLibrary(false);
      setShowStyleLibraryDetails(mode !== "none");
    },
    [onStyleLibraryChange, seedCustomStyleLibrary],
  );

  const handleUseSelectedUserStyleLibrary = React.useCallback(
    (library: WorkspaceStyleLibrary) => {
      onStyleLibrarySave(library);
      onStyleLibraryChange("custom");
      setStyleLibraryDraft(buildStyleLibraryDraft(library));
      setIsEditingStyleLibrary(false);
      setShowStyleLibraryDetails(true);
      setSelectedUserStyleLibraryId(library.id || null);
    },
    [onStyleLibraryChange, onStyleLibrarySave],
  );

  const handleEditSelectedUserStyleLibrary = React.useCallback(
    (library: WorkspaceStyleLibrary) => {
      onStyleLibrarySave(library);
      onStyleLibraryChange("custom");
      setStyleLibraryDraft(buildStyleLibraryDraft(library));
      setIsEditingStyleLibrary(true);
      setShowStyleLibraryDetails(true);
      setSelectedUserStyleLibraryId(library.id || null);
    },
    [onStyleLibraryChange, onStyleLibrarySave],
  );

  const handleStartEditingStyleLibrary = React.useCallback(() => {
    const draftSource =
      effectiveStyleLibrary ||
      normalizeWorkspaceStyleLibrary(currentStyleLibrary) ||
      createStyleLibraryDraftFromMode(normalizedStyleLibraryMode, "user");
    setStyleLibraryDraft(buildStyleLibraryDraft(draftSource));
    setIsEditingStyleLibrary(true);
    setShowStyleLibraryDetails(true);
  }, [
    currentStyleLibrary,
    effectiveStyleLibrary,
    normalizedStyleLibraryMode,
  ]);

  React.useEffect(() => {
    if (!showStyleLibraryPicker) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowStyleLibraryPicker(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showStyleLibraryPicker]);

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
            {compactStyleLibraryLabel}
          </span>
          <ChevronDown size={12} className="opacity-50" />
        </button>
      </div>
      {showStyleLibraryPicker ? (
        <TreePromptStyleLibraryModalV2
          canUsePosterProductMode={canUsePosterProductMode}
          effectiveStyleLibrary={effectiveStyleLibrary}
          isEditingStyleLibrary={isEditingStyleLibrary}
          normalizedStyleLibraryMode={normalizedStyleLibraryMode}
          onApplyDraft={applyStyleLibraryDraft}
          onClose={() => setShowStyleLibraryPicker(false)}
          onDeleteSelectedUserStyleLibrary={handleDeleteSelectedUserStyleLibrary}
          onSaveDetachedAsset={handleSaveStyleLibraryAsAsset}
          onSeedCustomStyleLibrary={seedCustomStyleLibrary}
          onSelectMode={handleSelectStyleLibraryMode}
          onSelectUserLibrary={setSelectedUserStyleLibraryId}
          onStartEditing={handleStartEditingStyleLibrary}
          onStopEditing={() => setIsEditingStyleLibrary(false)}
          onStyleDraftChange={setStyleLibraryDraft}
          onUseSelectedUserLibrary={handleUseSelectedUserStyleLibrary}
          onEditSelectedUserLibrary={handleEditSelectedUserStyleLibrary}
          selectedUserStyleLibrary={selectedUserStyleLibrary}
          setShowStyleLibraryDetails={setShowStyleLibraryDetails}
          showStyleLibraryDetails={showStyleLibraryDetails}
          styleLibraryDraft={styleLibraryDraft}
          styleLibraryOptions={styleLibraryOptions}
          userStyleLibraries={userStyleLibraries}
        />
      ) : null}
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

const TREE_PROMPT_REF_TRIGGER_CLASS =
  "relative z-[8] flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-[#d8d6df] bg-white/88 text-[#b4b8c4] shadow-[0_12px_28px_rgba(15,23,42,0.10)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-[#c8cedd] hover:bg-white hover:text-[#8f96a8]";

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

type TreePromptModelOption = {
  id: string;
  name: string;
  desc: string;
  time: string;
  providerId?: string | null;
  providerName?: string;
};

const TreePromptModelPickerModal: React.FC<{
  currentModelId: string;
  currentProviderId: string | null;
  modelOptions: TreePromptModelOption[];
  onClose: () => void;
  onSelect: (model: TreePromptModelOption) => void;
}> = ({
  currentModelId,
  currentProviderId,
  modelOptions,
  onClose,
  onSelect,
}) => {
  const [isVisible, setIsVisible] = React.useState(false);

  const normalizedModelOptions = React.useMemo(
    () =>
      modelOptions.map((model) => {
        const description = String(model.desc || "").trim() || "适合当前节点的图像生成模型。";
        const chips = [
          model.providerName ? `${model.providerName}` : "",
          model.time ? `${model.time}` : "",
          description.includes("多参考图")
            ? "多参考图"
            : description.includes("reference")
              ? "参考图"
              : "",
        ]
          .map((item) => String(item || "").trim())
          .filter(Boolean)
          .slice(0, 3);

        return {
          ...model,
          description,
          chips,
        };
      }),
    [modelOptions],
  );

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className={`fixed inset-0 z-[250] bg-[rgba(15,23,42,0.28)] backdrop-blur-[5px] transition-opacity duration-180 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      onMouseDown={onClose}
    >
      <div
        className={`absolute left-1/2 top-1/2 w-[min(980px,calc(100vw-40px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[26px] border border-[rgba(221,228,239,0.92)] bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(249,251,255,0.985))] shadow-[0_32px_120px_rgba(15,23,42,0.20)] transition-all duration-180 ${
          isVisible ? "scale-100 opacity-100" : "scale-[0.97] opacity-0"
        }`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex max-h-[min(82vh,820px)] min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-[#edf1f7] px-6 py-4 md:px-7 md:py-4.5">
            <h3 className="text-[17px] font-semibold tracking-[-0.03em] text-[#111827] md:text-[18px]">
              选择模型
            </h3>
            <button
              type="button"
              className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e5eaf2] bg-white text-[#8b95a7] transition hover:border-[#cfd7e4] hover:text-[#111827]"
              onClick={onClose}
            >
              <X size={17} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-4.5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {normalizedModelOptions.map((model, index) => {
                const active =
                  currentModelId === model.id &&
                  (model.providerId || null) === currentProviderId;

                return (
                  <button
                    key={`${model.providerName || "default"}-${model.id}-${index}`}
                    type="button"
                    className={`group flex min-h-[108px] items-start gap-4 rounded-[18px] border px-4 py-4 text-left transition md:min-h-[122px] md:px-5 md:py-5 ${
                      active
                        ? "border-[#7c8cff] bg-[linear-gradient(180deg,rgba(236,244,255,0.98),rgba(247,250,255,0.98))] shadow-[0_18px_42px_rgba(96,129,255,0.18)]"
                        : "border-[#dbe3ef] bg-white hover:border-[#c8d4e7] hover:bg-[#fbfcff] hover:shadow-[0_14px_32px_rgba(15,23,42,0.08)]"
                    }`}
                    onClick={() => onSelect(model)}
                  >
                    <span
                      className={`mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] ${
                        active
                          ? "bg-[#e8f0ff] text-[#5c6dff]"
                          : "bg-[#f4f7fb] text-[#99a3b6] group-hover:bg-[#eef3fb]"
                      }`}
                    >
                      <Box size={18} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0 pr-2">
                          <span className="block text-[15px] font-semibold leading-6 text-[#1f2937] md:text-[16px]">
                            {model.name}
                          </span>
                          <span className="mt-1.5 block text-[12px] leading-5 text-[#8b95a7] md:text-[13px]">
                            {model.description}
                          </span>
                        </span>
                        {active ? (
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#111827] text-white shadow-[0_10px_20px_rgba(17,24,39,0.18)]">
                            <Check size={13} />
                          </span>
                        ) : null}
                      </span>

                      {model.chips.length > 0 ? (
                        <span className="mt-3 flex flex-wrap gap-1.5">
                          {model.chips.map((tag) => (
                            <span
                              key={`${model.id}-${tag}`}
                              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                                active
                                  ? "bg-[#dcebff] text-[#5c6dff]"
                                  : "bg-[#f3f5f8] text-[#9aa3b2]"
                              }`}
                            >
                              {tag}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

const TreePromptSettingsModal: React.FC<{
  aspectRatios: Array<{
    label: string;
    value: string;
    size: string;
  }>;
  anchorRect: DOMRect | null;
  currentAspectRatio: string;
  currentImageCount: number;
  currentQuality: (typeof IMAGE_QUALITY_OPTIONS)[number];
  currentResolution: "1K" | "2K" | "4K";
  onClose: () => void;
  onSelectAspectRatio: (value: string) => void;
  onSelectImageCount: (value: number) => void;
  onSelectQuality: (value: (typeof IMAGE_QUALITY_OPTIONS)[number]) => void;
  onSelectResolution: (value: "1K" | "2K" | "4K") => void;
}> = ({
  aspectRatios,
  anchorRect,
  currentAspectRatio,
  currentImageCount,
  currentQuality,
  currentResolution,
  onClose,
  onSelectAspectRatio,
  onSelectImageCount,
  onSelectQuality,
  onSelectResolution,
}) => {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const panelLeft = anchorRect
    ? anchorRect.left + anchorRect.width / 2
    : window.innerWidth / 2;
  const panelBottom = anchorRect
    ? window.innerHeight - anchorRect.top + 10
    : window.innerHeight / 2 + 34;

  return createPortal(
    <div
      className={`fixed inset-0 z-[320] transition-opacity duration-180 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      onMouseDown={onClose}
    >
      <div className="pointer-events-none absolute inset-0">
        <div
          className={`pointer-events-auto absolute bottom-[calc(50%-34px)] left-1/2 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-[24px] border border-[rgba(224,229,238,0.96)] bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,253,0.985))] shadow-[0_24px_64px_rgba(15,23,42,0.18)] transition-all duration-180 ${
            isVisible ? "scale-100 opacity-100" : "scale-[0.94] opacity-0"
          }`}
          style={{
            left: `${panelLeft}px`,
            bottom: `${panelBottom}px`,
            transformOrigin: "bottom center",
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="absolute left-1/2 top-full h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-[rgba(224,229,238,0.96)] bg-[rgba(248,250,253,0.985)]" />
          <div className="max-h-[min(68vh,620px)] overflow-y-auto px-4 py-4">
            <div className="space-y-4">
              <section>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                  分辨率
                </div>
                <div className="grid grid-cols-3 gap-2 rounded-[18px] bg-[#f4f6fa] p-1.5">
                  {(["1K", "2K", "4K"] as const).map((resolution) => {
                    const active = currentResolution === resolution;
                    return (
                      <button
                        key={resolution}
                        type="button"
                        className={`rounded-[14px] px-3 py-2.5 text-[13px] font-semibold transition ${
                          active
                            ? "bg-white text-[#111827] shadow-[0_8px_18px_rgba(15,23,42,0.08)]"
                            : "text-[#6b7280] hover:text-[#111827]"
                        }`}
                        onClick={() => onSelectResolution(resolution)}
                      >
                        {resolution}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                  比例
                </div>
                <div className="grid grid-cols-4 gap-2 rounded-[18px] bg-[#f7f8fb] p-1.5">
                  {aspectRatios.map((ratio) => {
                    const active = currentAspectRatio === ratio.value;
                    return (
                      <button
                        key={ratio.value}
                        type="button"
                        className={`flex min-h-[58px] items-center justify-center rounded-[14px] px-2 py-2 text-center text-[13px] font-semibold transition ${
                          active
                            ? "bg-white text-[#111827] shadow-[0_8px_18px_rgba(15,23,42,0.08)]"
                            : "text-[#6b7280] hover:bg-white/78 hover:text-[#111827]"
                        }`}
                        onClick={() => onSelectAspectRatio(ratio.value)}
                      >
                        {ratio.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                  张数
                </div>
                <div className="grid grid-cols-4 gap-2 rounded-[18px] bg-[#f4f6fa] p-1.5">
                  {IMAGE_COUNT_OPTIONS.map((count) => {
                    const active = currentImageCount === count;
                    return (
                      <button
                        key={count}
                        type="button"
                        className={`rounded-[14px] px-3 py-2.5 text-[13px] font-semibold transition ${
                          active
                            ? "bg-white text-[#111827] shadow-[0_8px_18px_rgba(15,23,42,0.08)]"
                            : "text-[#6b7280] hover:text-[#111827]"
                        }`}
                        onClick={() => onSelectImageCount(count)}
                      >
                        {count}p
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                  画质
                </div>
                <div className="grid grid-cols-3 gap-2 rounded-[18px] bg-[#f4f6fa] p-1.5">
                  {IMAGE_QUALITY_OPTIONS.map((quality) => {
                    const active = currentQuality === quality;
                    const label =
                      quality === "low" ? "低" : quality === "medium" ? "中" : "高";
                    return (
                      <button
                        key={quality}
                        type="button"
                        className={`rounded-[14px] px-3 py-2.5 text-[13px] font-semibold transition ${
                          active
                            ? "bg-white text-[#111827] shadow-[0_8px_18px_rgba(15,23,42,0.08)]"
                            : "text-[#6b7280] hover:text-[#111827]"
                        }`}
                        onClick={() => onSelectQuality(quality)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

const TreePromptGenerateControls: React.FC<{
  element: CanvasElement;
  modelOptions: TreePromptModelOption[];
  aspectRatios: Array<{
    label: string;
    value: string;
    size: string;
  }>;
  selectElement: (elementId: string) => void;
  updateSelectedElement: (updates: Partial<CanvasElement>) => void;
  handleGenImage: (elementId: string) => void | Promise<void>;
  className?: string;
}> = ({
  element,
  modelOptions,
  aspectRatios,
  selectElement,
  updateSelectedElement,
  handleGenImage,
  className = "",
}) => {
  const [showModelPicker, setShowModelPicker] = React.useState(false);
  const [showSettingsPicker, setShowSettingsPicker] = React.useState(false);
  const [settingsAnchorRect, setSettingsAnchorRect] = React.useState<DOMRect | null>(null);
  const settingsTriggerRef = React.useRef<HTMLButtonElement | null>(null);
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
  const currentResolution = (element.genResolution || "1K") as "1K" | "2K" | "4K";
  const currentAspectRatio = element.genAspectRatio || "1:1";
  const settingsSummary = `${currentResolution} | ${currentAspectRatio} | ${imageCount}p`;

  const closeAllPickers = () => {
    setShowModelPicker(false);
    setShowSettingsPicker(false);
  };

  const stopBubble = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  const activateNode = () => {
    selectElement(element.id);
  };

  React.useEffect(() => {
    if (!showSettingsPicker) {
      return;
    }

    const updateAnchorRect = () => {
      setSettingsAnchorRect(settingsTriggerRef.current?.getBoundingClientRect() || null);
    };

    updateAnchorRect();
    window.addEventListener("resize", updateAnchorRect);
    window.addEventListener("scroll", updateAnchorRect, true);
    return () => {
      window.removeEventListener("resize", updateAnchorRect);
      window.removeEventListener("scroll", updateAnchorRect, true);
    };
  }, [showSettingsPicker]);

  return (
    <div className={`relative z-[12] shrink-0 space-y-2 pointer-events-auto ${className}`}>
      <div className="grid grid-cols-[minmax(0,1.05fr)_minmax(0,1.15fr)_104px] gap-2">
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
              setShowSettingsPicker(false);
            }}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Box size={13} className="shrink-0 text-[#7b8192]" />
              <span className="truncate text-left">{currentModelLabel}</span>
            </span>
            <ChevronDown size={11} className="shrink-0 opacity-50" />
          </button>
          {showModelPicker ? (
            <TreePromptModelPickerModal
              currentModelId={normalizedCurrentModelId}
              currentProviderId={normalizedCurrentProviderId}
              modelOptions={modelOptions}
              onClose={() => setShowModelPicker(false)}
              onSelect={(model) => {
                activateNode();
                updateSelectedElement({
                  genModel: model.id as ImageModel,
                  genProviderId: model.providerId || null,
                });
                closeAllPickers();
              }}
            />
          ) : null}
        </div>

        <div className="relative min-w-0">
          <button
            ref={settingsTriggerRef}
            type="button"
            className={`${CONTROL_PILL_CLASS} w-full justify-between gap-2 px-2.5`}
            onMouseDown={(event) => {
              activateNode();
              stopBubble(event);
            }}
            onClick={(event) => {
              activateNode();
              stopBubble(event);
              setSettingsAnchorRect(event.currentTarget.getBoundingClientRect());
              setShowSettingsPicker(true);
              setShowModelPicker(false);
            }}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f3efff] text-[#8b90a0]">
                <Sparkles size={13} />
              </span>
              <span className="flex min-w-0 flex-1 items-center text-left">
                <span className="truncate text-[11px] font-semibold leading-none text-[#4b5563]">
                  {settingsSummary}
                </span>
              </span>
            </span>
            <ChevronDown size={11} className="shrink-0 opacity-50" />
          </button>
          {showSettingsPicker ? (
            <TreePromptSettingsModal
              anchorRect={settingsAnchorRect}
              aspectRatios={aspectRatios}
              currentAspectRatio={currentAspectRatio}
              currentImageCount={imageCount}
              currentQuality={imageQuality}
              currentResolution={currentResolution}
              onClose={() => setShowSettingsPicker(false)}
              onSelectAspectRatio={(value) => updateSelectedElement({ genAspectRatio: value })}
              onSelectImageCount={(value) => updateSelectedElement({ genImageCount: value })}
              onSelectQuality={(value) => updateSelectedElement({ genImageQuality: value })}
              onSelectResolution={(value) => updateSelectedElement({ genResolution: value })}
            />
          ) : null}
        </div>

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
  connectedParentCount,
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
  const refImageCount = sourceRefUrls.length;
  const hasReferenceThumbs = thumbUrls.length > 0;

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
            onStyleLibrarySave={(library) =>
              {
                const persistedLibrary =
                  persistUserStyleLibraryAsset(library, "custom") || library;
                updateSelectedElement({
                  genReferenceRoleMode: "custom",
                  genStyleLibrary: persistedLibrary,
                });
              }
            }
            onToggleBerserkRetry={() =>
              updateSelectedElement({
                genInfiniteRetry: !element.genInfiniteRetry,
              })
            }
            onCopy={() => void handleCopyPrompt()}
            onDelete={onDelete}
            styleLibraryMode={element.genReferenceRoleMode}
            currentStyleLibrary={element.genStyleLibrary}
          />
        ) : null}
        <div
          className="relative grid h-full w-full grid-rows-[auto_minmax(0,1fr)_auto] border px-8 pb-6 pt-6 text-[#111827] transition-[box-shadow,border-color] duration-200"
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
          <div className="relative z-[1] flex min-h-[136px] shrink-0 flex-col items-center">
            <div className="flex min-h-[52px] w-full items-center justify-center gap-3">
              {hasReferenceThumbs ? (
                <ReferenceThumbStrip
                  thumbUrls={thumbUrls}
                  sourceRefUrls={sourceRefUrls}
                  setPreviewUrl={setPreviewUrl}
                />
              ) : null}
              <TreePromptReferenceUploadTrigger
                refCount={refImageCount}
                refUploadInputId={refUploadInputId}
                onActivate={activateNode}
              />
            </div>
            <div className="mt-3 flex min-h-[44px] w-full items-start justify-center" />
            <div className="mt-2 flex h-6 items-center justify-center text-[12px] leading-none">
              {connectedParentCount > 0 ? (
                <span className="rounded-[8px] bg-[#f3efff] px-2 py-1 text-center font-medium text-[#6b4eff] shadow-[inset_0_0_0_1px_rgba(107,78,255,0.10)]">
                  已连接 {connectedParentCount} 个父级节点
                </span>
              ) : null}
            </div>
          </div>

          <div className="relative z-[1] min-h-0 flex-1">
            <textarea
              value={promptValue}
              placeholder="generate one mockup in similar photograph angle and frame composition, clean and professional."
              className="h-full min-h-[112px] w-full resize-none bg-transparent text-[15px] font-semibold leading-[1.75] tracking-[-0.01em] text-[#111111] outline-none placeholder:text-[#8b94a7]"
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
            selectElement={selectElement}
            updateSelectedElement={updateSelectedElement}
            handleGenImage={handleGenImage}
            className="mt-4"
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

