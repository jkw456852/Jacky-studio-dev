import React from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Box,
  ChevronDown,
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
  WorkspaceStyleLibraryRuntimeOverlay,
} from "../../../types";
import { uploadImage } from "../../../utils/uploader.ts";
import {
  WORKSPACE_NODE_BERSERK_SHADOW,
  WORKSPACE_NODE_RADIUS,
  WORKSPACE_NODE_SELECTION_RADIUS,
  WORKSPACE_NODE_SELECTION_SHADOW,
} from "./workspaceNodeStyles";
import { TREE_NODE_CARD_WIDTH } from "../workspaceTreeNode";
import { normalizeMappedModelId } from "../../../services/provider-settings";
import {
  getClosestWorkspaceAspectRatioFromSize,
  getClosestWorkspaceImageResolutionPresetForSize,
  getDefaultWorkspaceImageSizeForAspectRatio,
  getImageModelSupportState,
  getNormalizedAspectRatioForImageModel,
  isGptImage2AllModel,
  isWorkspaceImageAutoSizeSupportedForModel,
  normalizeWorkspaceImageSize,
  type WorkspaceImageResolutionPreset,
  type WorkspaceImageSizeMode,
  type WorkspaceImageSupportStatus,
} from "../../../services/openai-image-presets.ts";
import {
  STYLE_LIBRARY_MODE_META,
  createStyleLibraryDraftFromMode,
  getEffectiveStyleLibrary,
  getStyleLibraryLabel,
  getPresetStyleLibrary,
  listBuiltInStyleLibraries,
  listUserStyleLibraries,
  normalizeWorkspaceStyleLibrary,
} from "../../../services/vision-orchestrator/style-library.ts";
import {
  buildStyleLibraryDraft,
  buildStyleLibraryFromDraft,
  createEmptyStyleLibraryDraftTestCase,
  createEmptyStyleLibraryDraftTestResult,
  type StyleLibraryDraftState,
  type StyleLibraryDraftTestCase,
  type StyleLibraryDraftTestResult,
} from "../../../services/vision-orchestrator/style-library-draft";
import { getStudioUserAssetApi } from "../../../services/runtime-assets/api";

const LABEL_COPY = "\u590d\u5236\u5185\u5bb9";
const LABEL_DELETE = "\u5220\u9664\u8282\u70b9";
const LABEL_UPLOAD = "\u4e0a\u4f20\u53c2\u8003\u56fe";
const LABEL_GENERATE = "\u751f\u6210";
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
const LABEL_STYLE_LIBRARY_SAVE = "\u5e94\u7528\u5230\u5f53\u524d\u8282\u70b9";
const LABEL_STYLE_LIBRARY_SAVE_ASSET = "\u5b58\u4e3a\u6b63\u5f0f\u98ce\u683c\u5e93";
const LABEL_STYLE_LIBRARY_DELETE = "\u5220\u9664\u8d44\u4ea7";
const LABEL_STYLE_LIBRARY_SYSTEM = "\u7cfb\u7edf\u5185\u7f6e";
const LABEL_STYLE_LIBRARY_USER = "\u7528\u6237\u8d44\u4ea7";
const LABEL_STYLE_LIBRARY_RUNTIME = "\u4e34\u65f6\u98ce\u683c";
const LABEL_STYLE_LIBRARY_USAGE = "\u9002\u7528\u573a\u666f";
const LABEL_STYLE_LIBRARY_USE = "\u4f7f\u7528\u6b64\u98ce\u683c";
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
const IMAGE_COUNT_QUICK_OPTIONS = [1, 2, 4, 8, 16, 32] as const;

const normalizePositiveInteger = (value: unknown, fallback = 1): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.floor(numeric));
};

const getSupportPillClass = (
  status: WorkspaceImageSupportStatus,
  active: boolean,
) => {
  if (status === "disabled") {
    return active
      ? "border border-[#d7dde7] bg-[#f2f4f7] text-[#b7bfcb]"
      : "border border-transparent bg-transparent text-[#c3cad5]";
  }
  if (status === "warning") {
    return active
      ? "border border-[#f3cf74] bg-[#fff7db] text-[#9a6700]"
      : "border border-transparent bg-[#fff8e6] text-[#b7791f] hover:bg-[#fff2c2]";
  }
  return active
    ? "border border-transparent bg-white text-[#111827] shadow-[0_8px_18px_rgba(15,23,42,0.08)]"
    : "border border-transparent text-[#6b7280] hover:bg-white/78 hover:text-[#111827]";
};

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
  handleGenImage: (
    elementId: string,
  ) => string | null | undefined | Promise<string | null | undefined>;
  stopImageGeneration?: (elementId: string) => boolean | Promise<boolean>;
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

const getEstimatedPromptExtraHeight = (_prompt: string) => {
  // 关键词 / 提示词再长也不继续把节点整体撑高，
  // 超出部分交给输入区内部滚动，保持节点高度稳定。
  return 0;
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


const persistUserStyleLibraryAsset = (
  library: WorkspaceStyleLibrary | undefined,
  sourceMode?: "default" | "poster-product" | "custom",
) => {
  if (!library) return null;
  return getStudioUserAssetApi().saveStyleLibrary(library, {
    preferredId: library.id,
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

const buildRuntimeStyleLibraryDraftResult = (
  library: WorkspaceStyleLibrary | undefined,
): WorkspaceStyleLibrary | undefined => {
  const normalized = normalizeWorkspaceStyleLibrary(library);
  if (!normalized) return undefined;
  return {
    ...normalized,
    id: undefined,
    slug: undefined,
    updatedAt: Date.now(),
    createdBy: "main-brain",
    sourceMode: "custom",
  };
};

const dedupeStyleLibraryLines = (values: Array<string | undefined | null>) =>
  Array.from(new Set(values.map((item) => String(item || "").trim()).filter(Boolean)));

const normalizeStyleLibraryRuntimeOverlay = (
  overlay?: WorkspaceStyleLibraryRuntimeOverlay | null,
): WorkspaceStyleLibraryRuntimeOverlay | undefined => {
  if (!overlay) return undefined;

  const summary = String(overlay.summary || "").trim();
  const referenceInterpretation = String(overlay.referenceInterpretation || "").trim();
  const planningDirectives = dedupeStyleLibraryLines(overlay.planningDirectives || []).slice(
    0,
    8,
  );
  const promptDirectives = dedupeStyleLibraryLines(overlay.promptDirectives || []).slice(
    0,
    8,
  );
  const promptBackbone = dedupeStyleLibraryLines(overlay.promptBackbone || []).slice(0, 8);
  const promptText = String(overlay.promptText || "").trim();
  const tags = dedupeStyleLibraryLines(overlay.tags || []).slice(0, 12);
  const description = String(overlay.description || "").trim();
  const createdBy = String(overlay.createdBy || "").trim();
  const updatedAt = Number(overlay.updatedAt);

  if (
    !summary &&
    !referenceInterpretation &&
    planningDirectives.length === 0 &&
    promptDirectives.length === 0 &&
    promptBackbone.length === 0 &&
    !promptText &&
    tags.length === 0 &&
    !description
  ) {
    return undefined;
  }

  return {
    summary: summary || undefined,
    referenceInterpretation: referenceInterpretation || undefined,
    planningDirectives:
      planningDirectives.length > 0 ? planningDirectives : undefined,
    promptDirectives: promptDirectives.length > 0 ? promptDirectives : undefined,
    promptBackbone: promptBackbone.length > 0 ? promptBackbone : undefined,
    promptText: promptText || undefined,
    tags: tags.length > 0 ? tags : undefined,
    description: description || undefined,
    createdBy:
      createdBy === "system" || createdBy === "main-brain" || createdBy === "user"
        ? createdBy
        : undefined,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : undefined,
  };
};

const buildEffectiveRuntimeStyleLibrary = (args: {
  baseLibrary?: WorkspaceStyleLibrary | null;
  runtimeOverlay?: WorkspaceStyleLibraryRuntimeOverlay | null;
}) => {
  const normalizedBase = normalizeWorkspaceStyleLibrary(args.baseLibrary);
  if (!normalizedBase) return undefined;

  const runtimeOverlay = normalizeStyleLibraryRuntimeOverlay(args.runtimeOverlay);
  if (!runtimeOverlay) {
    return normalizedBase;
  }

  return (
    normalizeWorkspaceStyleLibrary({
      ...normalizedBase,
      summary: runtimeOverlay.summary || normalizedBase.summary,
      referenceInterpretation:
        runtimeOverlay.referenceInterpretation || normalizedBase.referenceInterpretation,
      planningDirectives: dedupeStyleLibraryLines([
        ...(normalizedBase.planningDirectives || []),
        ...(runtimeOverlay.planningDirectives || []),
      ]).slice(0, 8),
      promptDirectives: dedupeStyleLibraryLines([
        ...(normalizedBase.promptDirectives || []),
        ...(runtimeOverlay.promptDirectives || []),
      ]).slice(0, 8),
      promptBackbone: dedupeStyleLibraryLines([
        ...((normalizedBase.promptBackbone as string[] | undefined) || []),
        ...((runtimeOverlay.promptBackbone as string[] | undefined) || []),
      ]).slice(0, 8),
      promptText: runtimeOverlay.promptText || normalizedBase.promptText,
      tags: dedupeStyleLibraryLines([
        ...(normalizedBase.tags || []),
        ...(runtimeOverlay.tags || []),
      ]).slice(0, 12),
      description: runtimeOverlay.description || normalizedBase.description,
      createdBy: normalizedBase.createdBy,
      updatedAt: runtimeOverlay.updatedAt || normalizedBase.updatedAt,
      sourceMode: normalizedBase.sourceMode,
    }) || normalizedBase
  );
};

const getStoredStyleLibraryOrigin = (
  library: WorkspaceStyleLibrary | null | undefined,
): "user" | "runtime" => {
  const normalized = normalizeWorkspaceStyleLibrary(library);
  if (!normalized) return "runtime";
  if (normalized.createdBy === "main-brain") return "runtime";
  return "user";
};

const getStyleLibrarySourceLabel = (
  library: WorkspaceStyleLibrary | null | undefined,
) => {
  const normalized = normalizeWorkspaceStyleLibrary(library);
  if (!normalized) return LABEL_STYLE_LIBRARY_RUNTIME;
  if (normalized.createdBy === "system") return LABEL_STYLE_LIBRARY_SYSTEM;
  return getStoredStyleLibraryOrigin(normalized) === "runtime"
    ? LABEL_STYLE_LIBRARY_RUNTIME
    : LABEL_STYLE_LIBRARY_USER;
};

type TreePromptStyleLibraryModalProps = {
  canUsePosterProductMode: boolean;
  effectiveStyleLibrary?: WorkspaceStyleLibrary;
  isEditingStyleLibrary: boolean;
  normalizedStyleLibraryMode: NonNullable<CanvasElement["genReferenceRoleMode"]>;
  onApplyDraft: () => boolean;
  onClose: () => void;
  onDeleteSelectedUserStyleLibrary: () => void;
  onDeleteStyleLibraries: (libraryIds: string[]) => void;
  onDisableStyleLibrary: () => void;
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

const STYLE_GALLERY_PREVIEW_BACKGROUNDS = [
  "linear-gradient(135deg, rgba(249,244,236,0.98), rgba(255,255,255,0.98))",
  "linear-gradient(135deg, rgba(242,244,255,0.98), rgba(255,255,255,0.98))",
  "linear-gradient(135deg, rgba(241,248,245,0.98), rgba(255,255,255,0.98))",
  "linear-gradient(135deg, rgba(247,241,255,0.98), rgba(255,255,255,0.98))",
] as const;

const getStyleGalleryPreviewBackground = (
  origin: TreePromptStyleGalleryItemV2["origin"],
  index: number,
) => {
  if (origin === "user") {
    return "linear-gradient(135deg, rgba(239,244,255,0.98), rgba(255,255,255,0.98))";
  }
  if (origin === "runtime") {
    return "linear-gradient(135deg, rgba(255,246,237,0.98), rgba(255,255,255,0.98))";
  }
  return STYLE_GALLERY_PREVIEW_BACKGROUNDS[
    index % STYLE_GALLERY_PREVIEW_BACKGROUNDS.length
  ];
};

const getStyleGalleryBadgeClass = (
  origin: TreePromptStyleGalleryItemV2["origin"],
) => {
  if (origin === "user") {
    return "bg-[#edf3ff] text-[#2457ff]";
  }
  if (origin === "runtime") {
    return "bg-[#fff1e7] text-[#c76a16]";
  }
  return "bg-[#f3efe8] text-[#6a5f52]";
};

const TreePromptStyleLibraryModalV2: React.FC<TreePromptStyleLibraryModalProps> = ({
  canUsePosterProductMode,
  effectiveStyleLibrary,
  isEditingStyleLibrary,
  normalizedStyleLibraryMode,
  onApplyDraft,
  onClose,
  onDeleteSelectedUserStyleLibrary,
  onDeleteStyleLibraries,
  onDisableStyleLibrary,
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
  styleLibraryDraft,
  styleLibraryOptions,
  userStyleLibraries,
}) => {
  const [activeTab, setActiveTab] = React.useState<"gallery" | "mine" | "current">("mine");
  const [activeFilter, setActiveFilter] = React.useState<
    "all" | "system" | "user" | "runtime" | "active"
  >("all");
  const [searchValue, setSearchValue] = React.useState("");
  const [portalReady, setPortalReady] = React.useState(false);
  const [batchSelectionEnabled, setBatchSelectionEnabled] = React.useState(false);
  const [selectedLibraryIds, setSelectedLibraryIds] = React.useState<string[]>([]);
  const [sortMode, setSortMode] = React.useState<"recommended" | "title">(
    "recommended",
  );

  React.useEffect(() => {
    setPortalReady(true);
  }, []);

  React.useEffect(() => {
    setActiveFilter("all");
    setBatchSelectionEnabled(false);
    setSelectedLibraryIds([]);
  }, [activeTab]);

  React.useEffect(() => {
    setSelectedLibraryIds((current) =>
      current.filter((id) => userStyleLibraries.some((library) => library.id === id)),
    );
  }, [userStyleLibraries]);

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
    const modeItems: TreePromptStyleGalleryItemV2[] = styleLibraryOptions.map((option, index) => {
      const builtIn = builtInLibraries.find((item) => item.mode === option.value);
      const isActive = normalizedStyleLibraryMode === option.value;
      const isCustom = option.value === "custom";
      const previewTitle =
        option.value === "none"
          ? option.label
          : option.value === "custom"
            ? option.label
            : builtIn?.library.title || option.label;
      const previewSummary =
        option.value === "none"
          ? option.hint
          : option.value === "custom"
            ? option.hint
            : builtIn?.library.summary || option.hint;
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
          option.value === "custom"
            ? normalizedStyleLibraryMode === "custom"
              ? "当前使用"
              : undefined
            : option.value === "poster-product" && !canUsePosterProductMode
              ? "Need 2 refs"
              : isActive
                ? "当前使用"
                : undefined,
        library:
          option.value === "none"
            ? undefined
            : option.value === "custom"
              ? normalizedStyleLibraryMode === "custom"
                ? effectiveStyleLibrary
                : undefined
              : builtIn?.library,
        mode: option.value,
        origin: isCustom ? "runtime" : "system",
        disabled: option.disabled,
        isActive,
        sortOrder: index,
      };
    });

    const userItems: TreePromptStyleGalleryItemV2[] = userStyleLibraries.map((library, index) => {
      const origin = getStoredStyleLibraryOrigin(library);
      const isSelectedLibrary =
        activeTab !== "gallery" &&
        Boolean(selectedUserStyleLibrary?.id && selectedUserStyleLibrary.id === library.id);
      return {
        key: `user-${library.id || index}`,
        title: library.title,
        summary: library.summary,
        badge: origin === "runtime" ? LABEL_STYLE_LIBRARY_RUNTIME : LABEL_STYLE_LIBRARY_USER,
        subBadge: isSelectedLibrary
          ? "当前使用"
          : origin === "runtime"
            ? "临时组织"
            : library.sourceMode || "custom",
        library,
        mode: "custom",
        origin,
        disabled: false,
        isActive: isSelectedLibrary,
        sortOrder: 100 + index,
      };
    });

    return [...modeItems, ...userItems];
  }, [
    activeTab,
    builtInLibraries,
    canUsePosterProductMode,
    effectiveStyleLibrary,
    normalizedStyleLibraryMode,
    selectedUserStyleLibrary?.id,
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

    return items.sort((a, b) => {
      if (sortMode === "title") {
        return a.title.localeCompare(b.title, "zh-CN");
      }
      return a.sortOrder - b.sortOrder;
    });
  }, [
    activeFilter,
    activeTab,
    allGalleryItems,
    normalizedSearch,
    normalizedStyleLibraryMode,
    selectedUserStyleLibrary?.id,
    sortMode,
  ]);

  const filterChips = [
    { id: "all", label: "全部" },
    { id: "system", label: "系统内置" },
    { id: "user", label: "用户资产" },
    { id: "runtime", label: "临时风格" },
    { id: "active", label: "当前使用" },
  ] as const;

  const handleSelectGalleryItem = (item: TreePromptStyleGalleryItemV2) => {
    if ((item.origin === "user" || item.origin === "runtime") && item.library) {
      onUseSelectedUserLibrary(item.library);
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
      className="fixed inset-0 z-[260] bg-[rgba(17,24,39,0.26)] p-3 backdrop-blur-[2px] sm:p-4"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={onClose}
    >
      <div
        className="mx-auto flex h-full w-full max-w-[1600px] overflow-hidden rounded-[20px] border border-[#dfe4ea] bg-white shadow-[0_22px_80px_rgba(15,23,42,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative flex h-full min-h-0 w-full flex-col">
          <div className="flex items-center gap-3 border-b border-[#eef2f7] px-4 py-4 sm:px-6">
            <div className="flex items-center gap-2 rounded-[12px] bg-[#f4f6f9] p-1">
              {[ 
                { id: "mine", label: "我的收藏" },
                { id: "gallery", label: "广场" },
                { id: "current", label: "最近使用" },
              ].map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`rounded-[10px] px-4 py-2 text-[14px] font-medium transition ${
                      active
                        ? "bg-white text-[#111827] shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
                        : "text-[#6b7280] hover:bg-white/70"
                    }`}
                    onClick={() =>
                      setActiveTab(tab.id as "gallery" | "mine" | "current")
                    }
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <label className="ml-auto flex h-11 min-w-0 flex-1 items-center gap-3 rounded-[12px] bg-[#f4f6f9] px-4 sm:max-w-[440px]">
              <Search size={16} className="text-[#9ca3af]" />
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="输入模型名称、作者、标签搜索"
                className="h-full w-full bg-transparent text-[14px] text-[#111827] outline-none placeholder:text-[#9ca3af]"
              />
            </label>

            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#6b7280] transition hover:bg-[#f3f4f6] hover:text-[#111827]"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex flex-col gap-3 border-b border-[#eef2f7] px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {filterChips.map((chip) => {
                const active = activeFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    className={`rounded-[10px] px-4 py-1.5 text-[13px] transition ${
                      active
                        ? "bg-[#eef2ff] text-[#1d4ed8]"
                        : "bg-transparent text-[#4b5563] hover:bg-[#f3f4f6]"
                    }`}
                    onClick={() => setActiveFilter(chip.id)}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {normalizedStyleLibraryMode !== "none" ? (
                <button
                  type="button"
                  className="rounded-[10px] border border-[#fecaca] bg-[#fff1f2] px-4 py-2 text-[13px] font-medium text-[#be123c] transition hover:bg-[#ffe4e6]"
                  onClick={() => {
                    onDisableStyleLibrary();
                  }}
                >
                  停用当前风格
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-[10px] bg-[#f4f6f9] px-4 py-2 text-[13px] text-[#4b5563] transition hover:bg-[#eceff3]"
                onClick={() =>
                  setSortMode(sortMode === "recommended" ? "title" : "recommended")
                }
              >
                {sortMode === "recommended" ? "推荐" : "名称排序"}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {activeTab === "mine" ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-dashed border-[#d9dee7] bg-[#fafbfd] px-4 py-4">
                <div>
                  <div className="text-[13px] font-medium text-[#111827]">节点侧只保留轻量应用</div>
                  <div className="mt-1 text-[12px] leading-5 text-[#6b7280]">
                    资产的新建、编辑、删除和批量治理后续统一迁入独立风格库中心；这里仅负责快速选择并应用。
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-[#e5e7eb] bg-white px-4 text-[13px] font-medium text-[#374151] transition hover:bg-[#f9fafb]"
                  onClick={() => {
                    window.open("/style-library-center", "_blank", "noopener,noreferrer");
                  }}
                >
                  <Plus size={16} />
                  打开风格库中心
                </button>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4 xl:grid-cols-7 2xl:grid-cols-8">
              {visibleGalleryItems.map((item, index) => {
                const active =
                  item.isActive ||
                  Boolean(
                    selectedUserStyleLibrary?.id &&
                      item.library?.id === selectedUserStyleLibrary.id,
                  );
                const canSelectForBatch =
                  activeTab === "mine" && batchSelectionEnabled && Boolean(item.library?.id);
                const batchSelected = Boolean(
                  item.library?.id && selectedLibraryIds.includes(item.library.id),
                );

                return (
                  <button
                    key={item.key}
                    type="button"
                    disabled={item.disabled}
                    title={item.summary || item.title}
                    className="group text-left disabled:cursor-not-allowed disabled:opacity-45"
                    onClick={() => {
                      if (canSelectForBatch && item.library?.id) {
                        setSelectedLibraryIds((current) =>
                          current.includes(item.library!.id!)
                            ? current.filter((id) => id !== item.library!.id)
                            : [...current, item.library!.id!],
                        );
                        return;
                      }
                      handleSelectGalleryItem(item);
                    }}
                    onDoubleClick={() => {
                      if (item.library && item.origin !== "system") {
                        window.open("/style-library-center", "_blank", "noopener,noreferrer");
                      }
                    }}
                  >
                    <div
                      className={`relative aspect-[0.72] overflow-hidden rounded-[12px] border bg-white transition ${
                        active || batchSelected
                          ? "border-[#7aa2ff] ring-2 ring-[#7aa2ff]"
                          : "border-[#e5e7eb] hover:border-[#cfd6e0]"
                      }`}
                      style={{
                        background: item.library?.coverImageUrl
                          ? `linear-gradient(180deg, rgba(15,23,42,0.02), rgba(15,23,42,0.08)), url(${item.library.coverImageUrl}) center/cover no-repeat`
                          : getStyleGalleryPreviewBackground(item.origin, index),
                      }}
                    >
                      {(active || batchSelected) && (
                        <div className="absolute bottom-3 left-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#111827] text-white shadow-[0_8px_20px_rgba(15,23,42,0.22)]">
                          <Check size={14} />
                        </div>
                      )}
                    </div>
                    <div className="px-1 pt-2">
                      <div className="line-clamp-1 text-[14px] font-medium text-[#111827]">
                        {item.title}
                      </div>
                      <div className="mt-1 line-clamp-1 text-[12px] text-[#6b7280]">
                        {item.badge}
                        {item.subBadge ? ` · ${item.subBadge}` : ""}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {visibleGalleryItems.length === 0 ? (
              <div className="flex h-[240px] items-center justify-center rounded-[16px] border border-dashed border-[#d1d5db] bg-[#fafafa] text-[14px] text-[#6b7280]">
                当前筛选下还没有可用风格库
              </div>
            ) : null}
          </div>

          {isEditingStyleLibrary && (
            <div className="absolute inset-0 z-[3] flex items-center justify-center bg-[rgba(15,23,42,0.28)] p-4 backdrop-blur-[2px]">
              <div className="flex h-[min(88vh,860px)] w-full max-w-[760px] min-h-0 flex-col overflow-hidden rounded-[20px] border border-[#e5e7eb] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
                <div className="flex items-start justify-between border-b border-[#eef2f7] px-5 py-5">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9ca3af]">
                      STYLE EDITOR
                    </div>
                    <div className="mt-3 text-[22px] font-semibold text-[#111827]">
                      编辑风格卡片
                    </div>
                    <p className="mt-3 text-[13px] leading-6 text-[#4b5563]">
                      这里可以修改标题、定位、标签、参考图集和规则内容。“应用到当前节点”只影响当前生图节点，只有“存为正式风格库”才会进入我的风格。
                    </p>
                  </div>
                  <button
                    type="button"
                    className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#6b7280] transition hover:bg-[#f3f4f6] hover:text-[#111827]"
                    onClick={() => {
                      onStopEditing();
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2.5 border-b border-[#eef2f7] px-5 py-4">
                  <button
                    type="button"
                    className="rounded-full border border-[#e5e7eb] bg-white px-4 py-2.5 text-[12px] font-semibold text-[#374151]"
                    onClick={() => {
                      onStopEditing();
                    }}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-[#e5e7eb] bg-white px-4 py-2.5 text-[12px] font-semibold text-[#374151]"
                    onClick={onSaveDetachedAsset}
                  >
                    {LABEL_STYLE_LIBRARY_SAVE_ASSET}
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-[#111827] px-4 py-2.5 text-[12px] font-semibold text-white"
                    onClick={() => {
                      if (onApplyDraft()) {
                        onStopEditing();
                      }
                    }}
                  >
                    {LABEL_STYLE_LIBRARY_SAVE}
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                  <div className="space-y-4">
                    <label className="block">
                      <div className="mb-2 text-[12px] font-medium text-[#6b7280]">标题</div>
                      <input
                        value={styleLibraryDraft.title}
                        className="h-11 w-full rounded-[12px] border border-[#e5e7eb] bg-white px-4 text-[13px] text-[#111827] outline-none transition focus:border-[#111827]"
                        placeholder="给这套风格起一个名字"
                        onChange={(event) =>
                          onStyleDraftChange((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="block">
                      <div className="mb-2 text-[12px] font-medium text-[#6b7280]">用途说明</div>
                      <textarea
                        value={styleLibraryDraft.summary}
                        className="min-h-[96px] w-full rounded-[12px] border border-[#e5e7eb] bg-white px-4 py-3 text-[13px] leading-6 text-[#111827] outline-none transition focus:border-[#111827]"
                        placeholder="一句话说明适合什么场景"
                        onChange={(event) =>
                          onStyleDraftChange((current) => ({
                            ...current,
                            summary: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <div className="mb-2 text-[12px] font-medium text-[#6b7280]">资产类型</div>
                        <select
                          value={styleLibraryDraft.kind}
                          className="h-11 w-full rounded-[12px] border border-[#e5e7eb] bg-white px-4 text-[13px] text-[#111827] outline-none transition focus:border-[#111827]"
                          onChange={(event) =>
                            onStyleDraftChange((current) => ({
                              ...current,
                              kind: event.target.value as NonNullable<WorkspaceStyleLibrary["kind"]>,
                            }))
                          }
                        >
                          <option value="style_library">抽象风格库</option>
                          <option value="case_transfer">强迁移预设</option>
                          <option value="edit_template">编辑型预设</option>
                        </select>
                      </label>

                      <label className="block">
                        <div className="mb-2 text-[12px] font-medium text-[#6b7280]">关键词标签</div>
                        <textarea
                          value={styleLibraryDraft.keywordsText}
                          className="min-h-[96px] w-full rounded-[12px] border border-[#e5e7eb] bg-white px-4 py-3 text-[13px] leading-6 text-[#111827] outline-none transition focus:border-[#111827]"
                          placeholder="每行一个关键词，如：低机位 / 强透视 / 科技感"
                          onChange={(event) =>
                            onStyleDraftChange((current) => ({
                              ...current,
                              keywordsText: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>

                    <label className="block">
                      <div className="mb-2 text-[12px] font-medium text-[#6b7280]">详细描述</div>
                      <textarea
                        value={styleLibraryDraft.description}
                        className="min-h-[120px] w-full rounded-[12px] border border-[#e5e7eb] bg-white px-4 py-3 text-[13px] leading-6 text-[#111827] outline-none transition focus:border-[#111827]"
                        placeholder="补充这套风格的视觉语言、使用边界和典型特征"
                        onChange={(event) =>
                          onStyleDraftChange((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="block">
                      <div className="mb-2 text-[12px] font-medium text-[#6b7280]">封面图片</div>
                      <div className="rounded-[12px] border border-[#e5e7eb] bg-[#fafbfc] p-3">
                        {styleLibraryDraft.coverImageUrl ? (
                          <div className="overflow-hidden rounded-[10px] border border-[#e5e7eb] bg-white">
                            <img
                              src={styleLibraryDraft.coverImageUrl}
                              alt="风格封面"
                              className="h-44 w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-44 items-center justify-center rounded-[10px] border border-dashed border-[#d1d5db] bg-white text-[13px] text-[#9ca3af]">
                            暂无封面，可上传一张作为卡片封面
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-[10px] border border-[#e5e7eb] bg-white px-4 py-2 text-[12px] font-medium text-[#374151] transition hover:bg-[#f9fafb]"
                            onClick={async () => {
                              const input = document.createElement("input");
                              input.type = "file";
                              input.accept = "image/*";
                              input.onchange = async () => {
                                const file = input.files?.[0];
                                if (!file) return;
                                try {
                                  const nextUrl = await uploadImage(file);
                                  onStyleDraftChange((current) => ({
                                    ...current,
                                    coverImageUrl: nextUrl,
                                  }));
                                } catch (error) {
                                  console.error("[style-library] cover upload failed", error);
                                }
                              };
                              input.click();
                            }}
                          >
                            上传封面
                          </button>
                          {styleLibraryDraft.coverImageUrl ? (
                            <button
                              type="button"
                              className="rounded-[10px] border border-[#f3d3d8] bg-[#fff5f6] px-4 py-2 text-[12px] font-medium text-[#be123c] transition hover:bg-[#ffe4e6]"
                              onClick={() =>
                                onStyleDraftChange((current) => ({
                                  ...current,
                                  coverImageUrl: "",
                                }))
                              }
                            >
                              删除封面
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </label>

                    <label className="block">
                      <div className="mb-2 text-[12px] font-medium text-[#6b7280]">参考图集</div>
                      <textarea
                        value={styleLibraryDraft.referenceImageUrlsText}
                        className="min-h-[120px] w-full rounded-[12px] border border-[#e5e7eb] bg-white px-4 py-3 text-[13px] leading-6 text-[#111827] outline-none transition focus:border-[#111827]"
                        placeholder="每行一个参考图 URL，可用于保存这套风格资产自己的图集"
                        onChange={(event) =>
                          onStyleDraftChange((current) => ({
                            ...current,
                            referenceImageUrlsText: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <div className="mb-2 text-[12px] font-medium text-[#6b7280]">适用场景</div>
                        <textarea
                          value={styleLibraryDraft.useCasesText}
                          className="min-h-[120px] w-full rounded-[12px] border border-[#e5e7eb] bg-white px-4 py-3 text-[13px] leading-6 text-[#111827] outline-none transition focus:border-[#111827]"
                          placeholder="每行一个使用场景"
                          onChange={(event) =>
                            onStyleDraftChange((current) => ({
                              ...current,
                              useCasesText: event.target.value,
                            }))
                          }
                        />
                      </label>

                      <label className="block">
                        <div className="mb-2 text-[12px] font-medium text-[#6b7280]">风险提醒</div>
                        <textarea
                          value={styleLibraryDraft.warningsText}
                          className="min-h-[120px] w-full rounded-[12px] border border-[#e5e7eb] bg-white px-4 py-3 text-[13px] leading-6 text-[#111827] outline-none transition focus:border-[#111827]"
                          placeholder="每行一条风险或使用边界"
                          onChange={(event) =>
                            onStyleDraftChange((current) => ({
                              ...current,
                              warningsText: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>

                    <label className="block">
                      <div className="mb-2 text-[12px] font-medium text-[#6b7280]">参考图解释方式</div>
                      <textarea
                        value={styleLibraryDraft.referenceInterpretation}
                        className="min-h-[120px] w-full rounded-[12px] border border-[#e5e7eb] bg-white px-4 py-3 text-[13px] leading-6 text-[#111827] outline-none transition focus:border-[#111827]"
                        placeholder="描述参考图应该怎样被理解和使用"
                        onChange={(event) =>
                          onStyleDraftChange((current) => ({
                            ...current,
                            referenceInterpretation: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <div className="rounded-[12px] border border-[#e5e7eb] bg-[#fafbfc] px-4 py-3">
                      <div className="text-[13px] font-medium text-[#111827]">编排治理说明</div>
                      <div className="mt-1 text-[12px] leading-5 text-[#6b7280]">
                        风格库现在只负责定义参考图解释方式、规划约束和提示词骨架；是否执行生图前编排统一由全局开关控制，不再由单个风格库单独关闭。
                      </div>
                    </div>

                    <label className="block">
                      <div className="mb-2 text-[12px] font-medium text-[#6b7280]">Prompt 骨架</div>
                      <textarea
                        value={styleLibraryDraft.promptBackboneText}
                        className="min-h-[120px] w-full rounded-[12px] border border-[#e5e7eb] bg-white px-4 py-3 text-[13px] leading-6 text-[#111827] outline-none transition focus:border-[#111827]"
                        placeholder="每行一段高信号提示词骨架，如镜头、透视、动作、材质、氛围"
                        onChange={(event) =>
                          onStyleDraftChange((current) => ({
                            ...current,
                            promptBackboneText: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="block">
                      <div className="mb-2 text-[12px] font-medium text-[#6b7280]">规划指令</div>
                      <textarea
                        value={styleLibraryDraft.planningDirectivesText}
                        className="min-h-[140px] w-full rounded-[12px] border border-[#e5e7eb] bg-white px-4 py-3 text-[13px] leading-6 text-[#111827] outline-none transition focus:border-[#111827]"
                        placeholder="每行一条"
                        onChange={(event) =>
                          onStyleDraftChange((current) => ({
                            ...current,
                            planningDirectivesText: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="block">
                      <div className="mb-2 text-[12px] font-medium text-[#6b7280]">Prompt 指令</div>
                      <textarea
                        value={styleLibraryDraft.promptDirectivesText}
                        className="min-h-[140px] w-full rounded-[12px] border border-[#e5e7eb] bg-white px-4 py-3 text-[13px] leading-6 text-[#111827] outline-none transition focus:border-[#111827]"
                        placeholder="每行一条"
                        onChange={(event) =>
                          onStyleDraftChange((current) => ({
                            ...current,
                            promptDirectivesText: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <div className="rounded-[16px] border border-[#e5e7eb] bg-[#fafbfc] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-[13px] font-semibold text-[#111827]">测试样例</div>
                          <div className="mt-1 text-[12px] leading-5 text-[#6b7280]">
                            为这套风格保存几条回归样例，后续做导入验证和版本对比时会直接复用。
                          </div>
                        </div>
                        <button
                          type="button"
                          className="rounded-[10px] border border-[#e5e7eb] bg-white px-3 py-2 text-[12px] font-medium text-[#374151] transition hover:bg-[#f9fafb]"
                          onClick={() =>
                            onStyleDraftChange((current) => ({
                              ...current,
                              testCases: [...current.testCases, createEmptyStyleLibraryDraftTestCase()],
                            }))
                          }
                        >
                          新增测试样例
                        </button>
                      </div>

                      <div className="mt-4 space-y-3">
                        {styleLibraryDraft.testCases.length === 0 ? (
                          <div className="rounded-[12px] border border-dashed border-[#d1d5db] bg-white px-4 py-4 text-[12px] leading-5 text-[#6b7280]">
                            还没有测试样例。建议至少保存一条“标准复现样例”，方便后续验证这套风格是否稳定。
                          </div>
                        ) : (
                          styleLibraryDraft.testCases.map((item, index) => (
                            <div
                              key={item.id}
                              className="rounded-[12px] border border-[#e5e7eb] bg-white p-4"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-[13px] font-medium text-[#111827]">
                                  测试样例 {index + 1}
                                </div>
                                <button
                                  type="button"
                                  className="rounded-[8px] border border-[#f3d3d8] bg-[#fff5f6] px-2.5 py-1.5 text-[11px] font-medium text-[#be123c] transition hover:bg-[#ffe4e6]"
                                  onClick={() =>
                                    onStyleDraftChange((current) => ({
                                      ...current,
                                      testCases: current.testCases.filter((caseItem) => caseItem.id !== item.id),
                                    }))
                                  }
                                >
                                  删除
                                </button>
                              </div>

                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <label className="block">
                                  <div className="mb-2 text-[12px] font-medium text-[#6b7280]">样例标题</div>
                                  <input
                                    value={item.title}
                                    className="h-10 w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 text-[13px] text-[#111827] outline-none transition focus:border-[#111827]"
                                    placeholder="如：构图迁移基线"
                                    onChange={(event) =>
                                      onStyleDraftChange((current) => ({
                                        ...current,
                                        testCases: current.testCases.map((caseItem) =>
                                          caseItem.id === item.id
                                            ? { ...caseItem, title: event.target.value }
                                            : caseItem,
                                        ),
                                      }))
                                    }
                                  />
                                </label>

                                <label className="block">
                                  <div className="mb-2 text-[12px] font-medium text-[#6b7280]">期望重点</div>
                                  <input
                                    value={item.expectedFocus}
                                    className="h-10 w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 text-[13px] text-[#111827] outline-none transition focus:border-[#111827]"
                                    placeholder="如：保持低机位、强透视和外溅动势"
                                    onChange={(event) =>
                                      onStyleDraftChange((current) => ({
                                        ...current,
                                        testCases: current.testCases.map((caseItem) =>
                                          caseItem.id === item.id
                                            ? { ...caseItem, expectedFocus: event.target.value }
                                            : caseItem,
                                        ),
                                      }))
                                    }
                                  />
                                </label>
                              </div>

                              <label className="mt-3 block">
                                <div className="mb-2 text-[12px] font-medium text-[#6b7280]">测试 Prompt</div>
                                <textarea
                                  value={item.prompt}
                                  className="min-h-[120px] w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 py-3 text-[13px] leading-6 text-[#111827] outline-none transition focus:border-[#111827]"
                                  placeholder="填写这条样例的测试提示词"
                                  onChange={(event) =>
                                    onStyleDraftChange((current) => ({
                                      ...current,
                                      testCases: current.testCases.map((caseItem) =>
                                        caseItem.id === item.id
                                          ? { ...caseItem, prompt: event.target.value }
                                          : caseItem,
                                      ),
                                    }))
                                  }
                                />
                              </label>

                              <div className="mt-3 grid gap-3 md:grid-cols-3">
                                <label className="block md:col-span-2">
                                  <div className="mb-2 text-[12px] font-medium text-[#6b7280]">参考图 URL</div>
                                  <textarea
                                    value={item.referenceImageUrlsText}
                                    className="min-h-[96px] w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 py-3 text-[13px] leading-6 text-[#111827] outline-none transition focus:border-[#111827]"
                                    placeholder="每行一个 URL"
                                    onChange={(event) =>
                                      onStyleDraftChange((current) => ({
                                        ...current,
                                        testCases: current.testCases.map((caseItem) =>
                                          caseItem.id === item.id
                                            ? {
                                                ...caseItem,
                                                referenceImageUrlsText: event.target.value,
                                              }
                                            : caseItem,
                                        ),
                                      }))
                                    }
                                  />
                                </label>

                                <div className="grid gap-3">
                                  <label className="block">
                                    <div className="mb-2 text-[12px] font-medium text-[#6b7280]">张数</div>
                                    <input
                                      type="number"
                                      min={1}
                                      step={1}
                                      value={item.imageCount}
                                      className="h-10 w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 text-[13px] text-[#111827] outline-none transition focus:border-[#111827]"
                                      onChange={(event) =>
                                        onStyleDraftChange((current) => ({
                                          ...current,
                                          testCases: current.testCases.map((caseItem) =>
                                            caseItem.id === item.id
                                              ? {
                                                  ...caseItem,
                                                  imageCount: event.target.value as StyleLibraryDraftTestCase["imageCount"],
                                                }
                                              : caseItem,
                                          ),
                                        }))
                                      }
                                      placeholder="默认"
                                    />
                                  </label>

                                  <label className="block">
                                    <div className="mb-2 text-[12px] font-medium text-[#6b7280]">比例</div>
                                    <input
                                      value={item.aspectRatio}
                                      className="h-10 w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 text-[13px] text-[#111827] outline-none transition focus:border-[#111827]"
                                      placeholder="如 4:5"
                                      onChange={(event) =>
                                        onStyleDraftChange((current) => ({
                                          ...current,
                                          testCases: current.testCases.map((caseItem) =>
                                            caseItem.id === item.id
                                              ? { ...caseItem, aspectRatio: event.target.value }
                                              : caseItem,
                                          ),
                                        }))
                                      }
                                    />
                                  </label>

                                  <label className="block">
                                    <div className="mb-2 text-[12px] font-medium text-[#6b7280]">模型</div>
                                    <input
                                      value={item.model}
                                      className="h-10 w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 text-[13px] text-[#111827] outline-none transition focus:border-[#111827]"
                                      placeholder="如 Nano Banana Pro"
                                      onChange={(event) =>
                                        onStyleDraftChange((current) => ({
                                          ...current,
                                          testCases: current.testCases.map((caseItem) =>
                                            caseItem.id === item.id
                                              ? { ...caseItem, model: event.target.value }
                                              : caseItem,
                                          ),
                                        }))
                                      }
                                    />
                                  </label>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-[16px] border border-[#e5e7eb] bg-[#fafbfc] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-[13px] font-semibold text-[#111827]">最近验证结果</div>
                          <div className="mt-1 text-[12px] leading-5 text-[#6b7280]">
                            保存最近几次验证结论，让这套风格不只是“看起来像”，而是“被验证过”。
                          </div>
                        </div>
                        <button
                          type="button"
                          className="rounded-[10px] border border-[#e5e7eb] bg-white px-3 py-2 text-[12px] font-medium text-[#374151] transition hover:bg-[#f9fafb]"
                          onClick={() =>
                            onStyleDraftChange((current) => ({
                              ...current,
                              latestTestResults: [
                                ...current.latestTestResults,
                                createEmptyStyleLibraryDraftTestResult(),
                              ],
                            }))
                          }
                        >
                          新增验证结果
                        </button>
                      </div>

                      <div className="mt-4 space-y-3">
                        {styleLibraryDraft.latestTestResults.length === 0 ? (
                          <div className="rounded-[12px] border border-dashed border-[#d1d5db] bg-white px-4 py-4 text-[12px] leading-5 text-[#6b7280]">
                            还没有验证记录。后续做风格回归时，可以把通过/失败结论直接沉淀到这里。
                          </div>
                        ) : (
                          styleLibraryDraft.latestTestResults.map((item, index) => (
                            <div
                              key={`${item.caseId || "result"}-${index}`}
                              className="rounded-[12px] border border-[#e5e7eb] bg-white p-4"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-[13px] font-medium text-[#111827]">
                                  验证结果 {index + 1}
                                </div>
                                <button
                                  type="button"
                                  className="rounded-[8px] border border-[#f3d3d8] bg-[#fff5f6] px-2.5 py-1.5 text-[11px] font-medium text-[#be123c] transition hover:bg-[#ffe4e6]"
                                  onClick={() =>
                                    onStyleDraftChange((current) => ({
                                      ...current,
                                      latestTestResults: current.latestTestResults.filter(
                                        (_, resultIndex) => resultIndex !== index,
                                      ),
                                    }))
                                  }
                                >
                                  删除
                                </button>
                              </div>

                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <label className="block">
                                  <div className="mb-2 text-[12px] font-medium text-[#6b7280]">对应样例 ID</div>
                                  <input
                                    value={item.caseId}
                                    className="h-10 w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 text-[13px] text-[#111827] outline-none transition focus:border-[#111827]"
                                    placeholder="如 case-001"
                                    onChange={(event) =>
                                      onStyleDraftChange((current) => ({
                                        ...current,
                                        latestTestResults: current.latestTestResults.map(
                                          (resultItem, resultIndex) =>
                                            resultIndex === index
                                              ? { ...resultItem, caseId: event.target.value }
                                              : resultItem,
                                        ),
                                      }))
                                    }
                                  />
                                </label>

                                <label className="block">
                                  <div className="mb-2 text-[12px] font-medium text-[#6b7280]">结论</div>
                                  <select
                                    value={item.passed}
                                    className="h-10 w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 text-[13px] text-[#111827] outline-none transition focus:border-[#111827]"
                                    onChange={(event) =>
                                      onStyleDraftChange((current) => ({
                                        ...current,
                                        latestTestResults: current.latestTestResults.map(
                                          (resultItem, resultIndex) =>
                                            resultIndex === index
                                              ? {
                                                  ...resultItem,
                                                  passed: event.target.value as StyleLibraryDraftTestResult["passed"],
                                                }
                                              : resultItem,
                                        ),
                                      }))
                                    }
                                  >
                                    <option value="pending">待判断</option>
                                    <option value="passed">通过</option>
                                    <option value="failed">失败</option>
                                  </select>
                                </label>
                              </div>

                              <div className="mt-3 grid gap-3 md:grid-cols-3">
                                <label className="block">
                                  <div className="mb-2 text-[12px] font-medium text-[#6b7280]">时间戳</div>
                                  <input
                                    value={item.createdAt}
                                    className="h-10 w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 text-[13px] text-[#111827] outline-none transition focus:border-[#111827]"
                                    placeholder="默认自动生成"
                                    onChange={(event) =>
                                      onStyleDraftChange((current) => ({
                                        ...current,
                                        latestTestResults: current.latestTestResults.map(
                                          (resultItem, resultIndex) =>
                                            resultIndex === index
                                              ? { ...resultItem, createdAt: event.target.value }
                                              : resultItem,
                                        ),
                                      }))
                                    }
                                  />
                                </label>

                                <label className="block">
                                  <div className="mb-2 text-[12px] font-medium text-[#6b7280]">比例</div>
                                  <input
                                    value={item.aspectRatio}
                                    className="h-10 w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 text-[13px] text-[#111827] outline-none transition focus:border-[#111827]"
                                    placeholder="如 3:4"
                                    onChange={(event) =>
                                      onStyleDraftChange((current) => ({
                                        ...current,
                                        latestTestResults: current.latestTestResults.map(
                                          (resultItem, resultIndex) =>
                                            resultIndex === index
                                              ? { ...resultItem, aspectRatio: event.target.value }
                                              : resultItem,
                                        ),
                                      }))
                                    }
                                  />
                                </label>

                                <label className="block">
                                  <div className="mb-2 text-[12px] font-medium text-[#6b7280]">张数</div>
                                  <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={item.imageCount}
                                    className="h-10 w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 text-[13px] text-[#111827] outline-none transition focus:border-[#111827]"
                                    onChange={(event) =>
                                      onStyleDraftChange((current) => ({
                                        ...current,
                                        latestTestResults: current.latestTestResults.map(
                                          (resultItem, resultIndex) =>
                                            resultIndex === index
                                              ? {
                                                  ...resultItem,
                                                  imageCount: event.target.value as StyleLibraryDraftTestResult["imageCount"],
                                                }
                                              : resultItem,
                                        ),
                                      }))
                                    }
                                    placeholder="默认"
                                  />
                                </label>
                              </div>

                              <label className="mt-3 block">
                                <div className="mb-2 text-[12px] font-medium text-[#6b7280]">输出图片 URL</div>
                                <textarea
                                  value={item.outputImageUrlsText}
                                  className="min-h-[96px] w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 py-3 text-[13px] leading-6 text-[#111827] outline-none transition focus:border-[#111827]"
                                  placeholder="每行一个结果图 URL"
                                  onChange={(event) =>
                                    onStyleDraftChange((current) => ({
                                      ...current,
                                      latestTestResults: current.latestTestResults.map(
                                        (resultItem, resultIndex) =>
                                          resultIndex === index
                                            ? {
                                                ...resultItem,
                                                outputImageUrlsText: event.target.value,
                                              }
                                            : resultItem,
                                      ),
                                    }))
                                  }
                                />
                              </label>

                              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                                <label className="block">
                                  <div className="mb-2 text-[12px] font-medium text-[#6b7280]">备注</div>
                                  <textarea
                                    value={item.note}
                                    className="min-h-[96px] w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 py-3 text-[13px] leading-6 text-[#111827] outline-none transition focus:border-[#111827]"
                                    placeholder="记录为什么通过 / 失败，便于后续回归定位"
                                    onChange={(event) =>
                                      onStyleDraftChange((current) => ({
                                        ...current,
                                        latestTestResults: current.latestTestResults.map(
                                          (resultItem, resultIndex) =>
                                            resultIndex === index
                                              ? { ...resultItem, note: event.target.value }
                                              : resultItem,
                                        ),
                                      }))
                                    }
                                  />
                                </label>

                                <label className="block">
                                  <div className="mb-2 text-[12px] font-medium text-[#6b7280]">模型</div>
                                  <input
                                    value={item.model}
                                    className="h-10 w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 text-[13px] text-[#111827] outline-none transition focus:border-[#111827]"
                                    placeholder="如 Nano Banana Pro"
                                    onChange={(event) =>
                                      onStyleDraftChange((current) => ({
                                        ...current,
                                        latestTestResults: current.latestTestResults.map(
                                          (resultItem, resultIndex) =>
                                            resultIndex === index
                                              ? { ...resultItem, model: event.target.value }
                                              : resultItem,
                                        ),
                                      }))
                                    }
                                  />
                                </label>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
  onStyleLibraryRuntimeOverlayChange: (
    runtimeOverlay: WorkspaceStyleLibraryRuntimeOverlay | undefined,
  ) => void;
  onToggleBerserkRetry: () => void;
  onCopy: () => void;
  onDelete: () => void;
  styleLibraryMode?: CanvasElement["genReferenceRoleMode"];
  currentStyleLibrary?: WorkspaceStyleLibrary;
  currentStyleLibraryRuntimeOverlay?: WorkspaceStyleLibraryRuntimeOverlay;
}> = ({
  activeTone,
  canUsePosterProductMode,
  isBerserkRetryEnabled,
  onToneChange,
  onStyleLibraryChange,
  onStyleLibrarySave,
  onStyleLibraryRuntimeOverlayChange,
  onToggleBerserkRetry,
  onCopy,
  onDelete,
  styleLibraryMode,
  currentStyleLibrary,
  currentStyleLibraryRuntimeOverlay,
}) => {
  const [showStyleLibraryPicker, setShowStyleLibraryPicker] = React.useState(false);
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
    styleLibraryMode === "default" ||
    styleLibraryMode === "poster-product" ||
    styleLibraryMode === "custom"
      ? styleLibraryMode
      : "none"
  ) as NonNullable<CanvasElement["genReferenceRoleMode"]>;
  const styleLibraryLabel = getStyleLibraryLabel(
    normalizedStyleLibraryMode,
    currentStyleLibrary,
  );
  const compactStyleLibraryLabel =
    styleLibraryLabel.length > 10
      ? `${styleLibraryLabel.slice(0, 10).trim()}...`
      : styleLibraryLabel;
  const styleLibraryEnabled = normalizedStyleLibraryMode !== "none";
  const styleLibraryStatusLabel = styleLibraryEnabled ? "已启用" : "未启用";
  const baseStyleLibrary = getEffectiveStyleLibrary({
    mode: normalizedStyleLibraryMode,
    customLibrary: currentStyleLibrary,
  });
  const effectiveStyleLibrary = buildEffectiveRuntimeStyleLibrary({
    baseLibrary: baseStyleLibrary,
    runtimeOverlay: currentStyleLibraryRuntimeOverlay,
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
    [currentStyleLibrary, styleLibraryDraft, styleLibraryRevision],
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
      return null;
    });
  }, [effectiveStyleLibrary?.id, userStyleLibraries]);

  const applyStyleLibraryDraft = React.useCallback(() => {
    const nextLibrary = buildStyleLibraryFromDraft(
      styleLibraryDraft,
      "user",
      normalizedStyleLibraryMode === "custom"
        ? currentStyleLibrary || selectedUserStyleLibrary
        : selectedUserStyleLibrary,
    );
    if (!nextLibrary) {
      return false;
    }
    const runtimeLibrary =
      buildRuntimeStyleLibraryDraftResult(nextLibrary) || nextLibrary;
    onStyleLibrarySave(runtimeLibrary);
    onStyleLibraryRuntimeOverlayChange(undefined);
    onStyleLibraryChange("custom");
    setIsEditingStyleLibrary(false);
    setStyleLibraryRevision((value) => value + 1);
    setSelectedUserStyleLibraryId(null);
    return true;
  }, [
    currentStyleLibrary,
    onStyleLibraryChange,
    onStyleLibraryRuntimeOverlayChange,
    onStyleLibrarySave,
    normalizedStyleLibraryMode,
    selectedUserStyleLibrary,
    styleLibraryDraft,
  ]);

  const seedCustomStyleLibrary = React.useCallback(() => {
    const seededLibrary =
      normalizeWorkspaceStyleLibrary(currentStyleLibrary) ||
      createStyleLibraryDraftFromMode(normalizedStyleLibraryMode, "user");
    onStyleLibrarySave(seededLibrary);
    onStyleLibraryRuntimeOverlayChange(undefined);
    onStyleLibraryChange("custom");
    setStyleLibraryDraft(buildStyleLibraryDraft(seededLibrary));
    setIsEditingStyleLibrary(true);
    setSelectedUserStyleLibraryId(null);
  }, [
    currentStyleLibrary,
    normalizedStyleLibraryMode,
    onStyleLibraryChange,
    onStyleLibraryRuntimeOverlayChange,
    onStyleLibrarySave,
  ]);

  const handleSaveStyleLibraryAsAsset = React.useCallback(() => {
    const assetCandidate = buildDetachedStyleLibraryAsset(
      normalizedStyleLibraryMode === "custom"
        ? buildStyleLibraryFromDraft(
            styleLibraryDraft,
            "user",
            currentStyleLibrary || selectedUserStyleLibrary,
          ) || effectiveStyleLibrary
        : effectiveStyleLibrary,
    );
    if (!assetCandidate) {
      return;
    }
    const assetSourceMode =
      normalizedStyleLibraryMode === "poster-product"
        ? "poster-product"
        : normalizedStyleLibraryMode === "custom"
          ? "custom"
          : "default";
    const persistedLibrary =
      persistUserStyleLibraryAsset(assetCandidate, assetSourceMode) ||
      assetCandidate;
    onStyleLibrarySave(persistedLibrary);
    onStyleLibraryRuntimeOverlayChange(undefined);
    onStyleLibraryChange("custom");
    setStyleLibraryDraft(buildStyleLibraryDraft(persistedLibrary));
    setIsEditingStyleLibrary(false);
    setStyleLibraryRevision((value) => value + 1);
    setSelectedUserStyleLibraryId(persistedLibrary.id || null);
  }, [
    currentStyleLibrary,
    effectiveStyleLibrary,
    normalizedStyleLibraryMode,
    onStyleLibraryChange,
    onStyleLibraryRuntimeOverlayChange,
    onStyleLibrarySave,
    selectedUserStyleLibrary,
    styleLibraryDraft,
  ]);

  const handleDeleteSelectedUserStyleLibrary = React.useCallback(() => {
    if (!selectedUserStyleLibrary?.id) {
      return;
    }
    getStudioUserAssetApi().removeStyleLibrary(selectedUserStyleLibrary.id);
    if (currentStyleLibrary?.id === selectedUserStyleLibrary.id) {
      onStyleLibrarySave(undefined);
      onStyleLibraryRuntimeOverlayChange(undefined);
      onStyleLibraryChange("none");
    }
    setStyleLibraryRevision((value) => value + 1);
    setSelectedUserStyleLibraryId(null);
  }, [
    currentStyleLibrary?.id,
    onStyleLibraryChange,
    onStyleLibraryRuntimeOverlayChange,
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
    },
    [onStyleLibraryChange, seedCustomStyleLibrary],
  );

  const handleUseSelectedUserStyleLibrary = React.useCallback(
    (library: WorkspaceStyleLibrary) => {
      onStyleLibrarySave(library);
      onStyleLibraryRuntimeOverlayChange(undefined);
      onStyleLibraryChange("custom");
      setStyleLibraryDraft(buildStyleLibraryDraft(library));
      setIsEditingStyleLibrary(false);
      setSelectedUserStyleLibraryId(library.id || null);
    },
    [onStyleLibraryChange, onStyleLibraryRuntimeOverlayChange, onStyleLibrarySave],
  );

  const handleDisableStyleLibrary = React.useCallback(() => {
    onStyleLibrarySave(undefined);
    onStyleLibraryRuntimeOverlayChange(undefined);
    onStyleLibraryChange("none");
    setSelectedUserStyleLibraryId(null);
    setIsEditingStyleLibrary(false);
  }, [onStyleLibraryChange, onStyleLibraryRuntimeOverlayChange, onStyleLibrarySave]);

  const handleEditSelectedUserStyleLibrary = React.useCallback(
    (library: WorkspaceStyleLibrary) => {
      onStyleLibrarySave(library);
      onStyleLibraryRuntimeOverlayChange(undefined);
      onStyleLibraryChange("custom");
      setStyleLibraryDraft(buildStyleLibraryDraft(library));
      setIsEditingStyleLibrary(true);
      setSelectedUserStyleLibraryId(library.id || null);
    },
    [onStyleLibraryChange, onStyleLibraryRuntimeOverlayChange, onStyleLibrarySave],
  );

  const handleStartEditingStyleLibrary = React.useCallback(() => {
    const draftSource =
      effectiveStyleLibrary ||
      normalizeWorkspaceStyleLibrary(currentStyleLibrary) ||
      createStyleLibraryDraftFromMode(normalizedStyleLibraryMode, "user");
    setStyleLibraryDraft(buildStyleLibraryDraft(draftSource));
    setIsEditingStyleLibrary(true);
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
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              styleLibraryEnabled
                ? "bg-[#ecfdf3] text-[#15803d]"
                : "bg-[#f3f4f6] text-[#6b7280]"
            }`}
          >
            {styleLibraryStatusLabel}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              styleLibraryEnabled
                ? "bg-[#f3efff] text-[#6b4eff]"
                : "bg-[#f9fafb] text-[#9ca3af]"
            }`}
          >
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
          onDeleteStyleLibraries={(libraryIds) => {
            const normalizedIds = Array.from(
              new Set(
                libraryIds
                  .map((item) => String(item || "").trim())
                  .filter(Boolean),
              ),
            );
            if (normalizedIds.length === 0) return;
            normalizedIds.forEach((id) => {
              getStudioUserAssetApi().removeStyleLibrary(id);
            });
            if (
              currentStyleLibrary?.id &&
              normalizedIds.includes(currentStyleLibrary.id)
            ) {
              onStyleLibrarySave(undefined);
              onStyleLibraryRuntimeOverlayChange(undefined);
              onStyleLibraryChange("none");
            }
            if (
              selectedUserStyleLibrary?.id &&
              normalizedIds.includes(selectedUserStyleLibrary.id)
            ) {
              setSelectedUserStyleLibraryId(null);
            }
            setStyleLibraryRevision((value) => value + 1);
          }}
          onDisableStyleLibrary={handleDisableStyleLibrary}
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
  currentModelId: string;
  currentAspectRatio: string;
  currentImageCount: number;
  currentQuality: (typeof IMAGE_QUALITY_OPTIONS)[number];
  currentResolution: WorkspaceImageResolutionPreset;
  currentSizeMode: WorkspaceImageSizeMode;
  currentCustomWidth: number;
  currentCustomHeight: number;
  onClose: () => void;
  onSelectAspectRatio: (value: string) => void;
  onSelectImageCount: (value: number) => void;
  onSelectQuality: (value: (typeof IMAGE_QUALITY_OPTIONS)[number]) => void;
  onSelectResolution: (value: WorkspaceImageResolutionPreset) => void;
  onApplyCustomSize: (width: number, height: number) => void;
  onSelectAutoSize: () => void;
}> = ({
  aspectRatios,
  anchorRect,
  currentModelId,
  currentAspectRatio,
  currentImageCount,
  currentQuality,
  currentResolution,
  currentSizeMode,
  currentCustomWidth,
  currentCustomHeight,
  onClose,
  onSelectAspectRatio,
  onSelectImageCount,
  onSelectQuality,
  onSelectResolution,
  onApplyCustomSize,
  onSelectAutoSize,
}) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [draftWidth, setDraftWidth] = React.useState("1024");
  const [draftHeight, setDraftHeight] = React.useState("1024");

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
  const normalizedAspectRatio = getNormalizedAspectRatioForImageModel(
    currentModelId,
    currentAspectRatio,
  );
  const isAutoSizeSupported = isWorkspaceImageAutoSizeSupportedForModel(
    currentModelId,
  );
  const currentNormalizedSize = React.useMemo(() => {
    if (
      Number.isFinite(currentCustomWidth) &&
      Number.isFinite(currentCustomHeight) &&
      Number(currentCustomWidth) > 0 &&
      Number(currentCustomHeight) > 0
    ) {
      return normalizeWorkspaceImageSize({
        width: Number(currentCustomWidth),
        height: Number(currentCustomHeight),
      });
    }

    return getDefaultWorkspaceImageSizeForAspectRatio({
      aspectRatio: currentAspectRatio,
      resolution: currentResolution,
    });
  }, [currentAspectRatio, currentCustomHeight, currentCustomWidth, currentResolution]);
  const resolutionOptions = (["1K", "2K", "4K"] as const).map((resolution) => ({
    value: resolution,
    support: getImageModelSupportState({
      model: currentModelId,
      aspectRatio: normalizedAspectRatio,
      resolution,
    }),
  }));
  const aspectRatioOptions = aspectRatios.map((ratio) => ({
    ...ratio,
    support: getImageModelSupportState({
      model: currentModelId,
      aspectRatio: ratio.value,
      resolution: currentResolution,
    }),
  }));

  const commitDraftCustomSize = React.useCallback(() => {
    if (currentSizeMode === "auto") {
      return;
    }
    const nextWidth = Number(draftWidth);
    const nextHeight = Number(draftHeight);
    if (!Number.isFinite(nextWidth) || !Number.isFinite(nextHeight)) {
      return;
    }
    if (nextWidth <= 0 || nextHeight <= 0) {
      return;
    }
    onApplyCustomSize(nextWidth, nextHeight);
  }, [currentSizeMode, draftHeight, draftWidth, onApplyCustomSize]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        commitDraftCustomSize();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commitDraftCustomSize, onClose]);

  React.useEffect(() => {
    setDraftWidth(String(currentNormalizedSize.width));
    setDraftHeight(String(currentNormalizedSize.height));
  }, [currentNormalizedSize.height, currentNormalizedSize.width]);

  return createPortal(
    <div
      className={`fixed inset-0 z-[320] transition-opacity duration-180 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      onMouseDown={() => {
        commitDraftCustomSize();
        onClose();
      }}
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
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                      尺寸
                    </div>
                    <div className="mt-1 text-[10px] leading-4 text-[#98a2b3]">
                      自动吸附到 16px 倍数，并限制最大边长 / 总像素 / 长短边比。
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!isAutoSizeSupported}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                      currentSizeMode === "auto"
                        ? "bg-[#111827] text-white"
                        : isAutoSizeSupported
                          ? "border border-[#dbe3ef] bg-white text-[#4b5563] hover:bg-[#f8fafc]"
                          : "bg-[#eef2f7] text-[#b7bfcb] cursor-not-allowed"
                    }`}
                    onClick={() => {
                      if (!isAutoSizeSupported) return;
                      onSelectAutoSize();
                    }}
                  >
                    auto
                  </button>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-[18px] bg-[#f4f6fa] p-2">
                  <input
                    type="number"
                    min={16}
                    step={16}
                    value={draftWidth}
                    onChange={(event) => setDraftWidth(event.target.value)}
                    onBlur={commitDraftCustomSize}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === "Enter") {
                        commitDraftCustomSize();
                        (event.target as HTMLInputElement).blur();
                      }
                    }}
                    className="h-11 rounded-[14px] border border-[#dbe3ef] bg-white px-3 text-[15px] font-semibold text-[#111827] outline-none transition focus:border-[#111827]"
                    placeholder="W"
                  />
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dbe3ef] bg-white text-[#7b8192] transition hover:bg-[#f8fafc]"
                    onClick={() => {
                      const nextWidth = draftHeight;
                      const nextHeight = draftWidth;
                      setDraftWidth(nextWidth);
                      setDraftHeight(nextHeight);
                      onApplyCustomSize(Number(nextWidth), Number(nextHeight));
                    }}
                  >
                    ↔
                  </button>
                  <input
                    type="number"
                    min={16}
                    step={16}
                    value={draftHeight}
                    onChange={(event) => setDraftHeight(event.target.value)}
                    onBlur={commitDraftCustomSize}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === "Enter") {
                        commitDraftCustomSize();
                        (event.target as HTMLInputElement).blur();
                      }
                    }}
                    className="h-11 rounded-[14px] border border-[#dbe3ef] bg-white px-3 text-[15px] font-semibold text-[#111827] outline-none transition focus:border-[#111827]"
                    placeholder="H"
                  />
                </div>
                <div className="mt-2 flex min-w-0 items-center justify-between gap-3 px-1 text-[10px] text-[#98a2b3]">
                  <span className="min-w-0 truncate">
                    {currentSizeMode === "auto"
                      ? "当前：Auto · 由模型自动决定"
                      : `当前：${currentNormalizedSize.size} · ${getClosestWorkspaceAspectRatioFromSize(currentNormalizedSize.width, currentNormalizedSize.height)}`}
                  </span>
                  <span className="shrink-0 text-right">
                    {currentSizeMode === "custom"
                      ? "自定义尺寸"
                      : currentSizeMode === "auto"
                        ? "自动尺寸"
                        : `预设 ${currentResolution}`}
                  </span>
                </div>
              </section>

              <section>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                  分辨率
                </div>
                <div className="grid grid-cols-3 gap-2 rounded-[18px] bg-[#f4f6fa] p-1.5">
                  {resolutionOptions.map(({ value, support }) => {
                    const active = currentResolution === value;
                    const disabled = support.status === "disabled";
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={disabled}
                        title={support.reason || undefined}
                        className={`rounded-[14px] px-3 py-2.5 text-[13px] font-semibold transition ${getSupportPillClass(support.status, active)} ${disabled ? "cursor-not-allowed" : ""}`}
                        onClick={() => {
                          if (disabled) return;
                          onSelectResolution(value);
                        }}
                      >
                        <span className="block">{value}</span>
                        <span className="mt-1 block text-[10px] font-mono opacity-80">
                          {support.actualSize || "--"}
                        </span>
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
                  {aspectRatioOptions.map((ratio) => {
                    const active = currentAspectRatio === ratio.value;
                    const disabled = ratio.support.status === "disabled";
                    return (
                      <button
                        key={ratio.value}
                        type="button"
                        disabled={disabled}
                        title={ratio.support.reason || undefined}
                        className={`flex min-h-[58px] flex-col items-center justify-center rounded-[14px] px-2 py-2 text-center text-[13px] font-semibold transition ${getSupportPillClass(ratio.support.status, active)} ${disabled ? "cursor-not-allowed" : ""}`}
                        onClick={() => {
                          if (disabled) return;
                          onSelectAspectRatio(ratio.value);
                        }}
                      >
                        <span>{ratio.label}</span>
                        <span className="mt-1 text-[10px] font-mono opacity-80">
                          {ratio.support.actualSize || "--"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {currentModelId === "gpt-image-2" ||
                isGptImage2AllModel(currentModelId) ? (
                  <div className="mt-2 px-1 text-[10px] leading-4 text-[#b7791f]">
                    {"\u9ec4\u8272\u8868\u793a\u5b98\u65b9\u53ef\u7528\uff0c\u4f46\u4e91\u96fe\u6587\u6863\u672a\u5217\u4e3a\u5f53\u524d\u6a21\u578b\u7684\u6807\u51c6\u5c3a\u5bf8\u3002"}
                  </div>
                ) : null}
              </section>

              <section>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                  张数
                </div>
                <div className="rounded-[18px] bg-[#f4f6fa] p-1.5">
                  <div className="grid grid-cols-5 gap-2">
                  {IMAGE_COUNT_QUICK_OPTIONS.map((count) => {
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
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={normalizePositiveInteger(currentImageCount)}
                    onChange={(event) =>
                      onSelectImageCount(
                        normalizePositiveInteger(
                          event.currentTarget.value,
                          currentImageCount,
                        ),
                      )
                    }
                    className="mt-2 h-9 w-full rounded-[14px] border border-transparent bg-white px-3 text-center text-[13px] font-semibold text-[#111827] outline-none focus:border-[#d7dde7]"
                    aria-label="图片生成张数"
                  />
                  <div className="mt-1 px-1 text-[10px] leading-4 text-[#98a2b3]">
                    常用预设只是快捷按钮；项目不设最大张数，实际由供应商决定。
                  </div>
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
  handleGenImage: (
    elementId: string,
  ) => string | null | undefined | Promise<string | null | undefined>;
  stopImageGeneration?: (elementId: string) => boolean | Promise<boolean>;
  className?: string;
}> = ({
  element,
  modelOptions,
  aspectRatios,
  selectElement,
  updateSelectedElement,
  handleGenImage,
  stopImageGeneration,
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
  const imageCount = normalizePositiveInteger(element.genImageCount);
  const imageQuality = element.genImageQuality || "medium";
  const currentModelLabel = getModelControlLabel(currentModelOption);
  const currentResolution = (element.genResolution || "1K") as WorkspaceImageResolutionPreset;
  const currentAspectRatio = element.genAspectRatio || "1:1";
  const currentSizeMode =
    (element.genSizeMode || "preset") as WorkspaceImageSizeMode;
  const currentCustomSize =
    Number.isFinite(element.genCustomWidth) &&
    Number.isFinite(element.genCustomHeight) &&
    Number(element.genCustomWidth) > 0 &&
    Number(element.genCustomHeight) > 0
      ? normalizeWorkspaceImageSize({
          width: Number(element.genCustomWidth),
          height: Number(element.genCustomHeight),
        })
      : getDefaultWorkspaceImageSizeForAspectRatio({
          aspectRatio: currentAspectRatio,
          resolution: currentResolution,
        });
  const settingsSummary =
    currentSizeMode === "auto"
      ? `Auto | ${imageCount}p`
      : currentSizeMode === "custom"
        ? `${currentCustomSize.size} · ${imageCount}p`
        : `${currentResolution} | ${currentAspectRatio} | ${imageCount}p`;

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
    const nextAspectRatio = getNormalizedAspectRatioForImageModel(
      normalizedCurrentModelId,
      currentAspectRatio,
    );
    if (nextAspectRatio !== currentAspectRatio) {
      updateSelectedElement({ genAspectRatio: nextAspectRatio });
    }
  }, [currentAspectRatio, normalizedCurrentModelId, updateSelectedElement]);

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
                const nextAspectRatio = getNormalizedAspectRatioForImageModel(
                  model.id,
                  currentAspectRatio,
                );
                const fallbackSize = getDefaultWorkspaceImageSizeForAspectRatio({
                  aspectRatio: nextAspectRatio,
                  resolution: currentResolution,
                });
                updateSelectedElement({
                  genModel: model.id as ImageModel,
                  genProviderId: model.providerId || null,
                  genAspectRatio: nextAspectRatio,
                  genCustomWidth: fallbackSize.width,
                  genCustomHeight: fallbackSize.height,
                  genSizeMode:
                    currentSizeMode === "auto" &&
                    !isWorkspaceImageAutoSizeSupportedForModel(model.id)
                      ? "preset"
                      : currentSizeMode,
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
              currentModelId={normalizedCurrentModelId}
              currentAspectRatio={currentAspectRatio}
              currentImageCount={imageCount}
              currentQuality={imageQuality}
              currentResolution={currentResolution}
              currentSizeMode={currentSizeMode}
              currentCustomWidth={currentCustomSize.width}
              currentCustomHeight={currentCustomSize.height}
              onClose={() => setShowSettingsPicker(false)}
              onSelectAspectRatio={(value) => {
                const preset = getDefaultWorkspaceImageSizeForAspectRatio({
                  aspectRatio: value,
                  resolution: currentResolution,
                });
                updateSelectedElement({
                  genAspectRatio: value,
                  genSizeMode: "preset",
                  genCustomWidth: preset.width,
                  genCustomHeight: preset.height,
                });
              }}
              onSelectImageCount={(value) =>
                updateSelectedElement({ genImageCount: normalizePositiveInteger(value) })
              }
              onSelectQuality={(value) => updateSelectedElement({ genImageQuality: value })}
              onSelectResolution={(value) => {
                const preset = getDefaultWorkspaceImageSizeForAspectRatio({
                  aspectRatio: currentAspectRatio,
                  resolution: value,
                });
                updateSelectedElement({
                  genResolution: value,
                  genSizeMode: "preset",
                  genCustomWidth: preset.width,
                  genCustomHeight: preset.height,
                });
              }}
              onApplyCustomSize={(width, height) => {
                const normalized = normalizeWorkspaceImageSize({ width, height });
                const nextAspectRatio = getClosestWorkspaceAspectRatioFromSize(
                  normalized.width,
                  normalized.height,
                );
                const nextResolution = getClosestWorkspaceImageResolutionPresetForSize({
                  aspectRatio: nextAspectRatio,
                  width: normalized.width,
                  height: normalized.height,
                });
                updateSelectedElement({
                  genSizeMode: "custom",
                  genResolution: nextResolution,
                  genAspectRatio: nextAspectRatio,
                  genCustomWidth: normalized.width,
                  genCustomHeight: normalized.height,
                });
              }}
              onSelectAutoSize={() =>
                updateSelectedElement({
                  genSizeMode: "auto",
                })
              }
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
              updateSelectedElement({
                genReferenceRoleMode: mode,
                ...(mode === "custom"
                  ? null
                  : { genStyleLibraryRuntimeOverlay: undefined }),
              })
            }
            onStyleLibrarySave={(library) => {
              updateSelectedElement({
                genReferenceRoleMode: library ? "custom" : "none",
                genStyleLibrary: library,
              });
            }}
            onStyleLibraryRuntimeOverlayChange={(runtimeOverlay) => {
              updateSelectedElement({
                genStyleLibraryRuntimeOverlay: runtimeOverlay,
              });
            }}
            onToggleBerserkRetry={() =>
              updateSelectedElement({
                genInfiniteRetry: !element.genInfiniteRetry,
              })
            }
            onCopy={() => void handleCopyPrompt()}
            onDelete={onDelete}
            styleLibraryMode={element.genReferenceRoleMode}
            currentStyleLibrary={element.genStyleLibrary}
            currentStyleLibraryRuntimeOverlay={element.genStyleLibraryRuntimeOverlay}
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

          <div className="relative z-[1] min-h-0 flex-1 overflow-hidden">
            <textarea
              value={promptValue}
              placeholder="generate one mockup in similar photograph angle and frame composition, clean and professional."
              className="h-full min-h-[112px] w-full resize-none overflow-y-auto bg-transparent pr-1 text-[15px] font-semibold leading-[1.75] tracking-[-0.01em] text-[#111111] outline-none placeholder:text-[#8b94a7] custom-scrollbar"
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
        </div>
      </div>
    </div>
  );
};
