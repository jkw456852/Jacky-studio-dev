import React, { memo } from "react";
import {
  AlertCircle,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { CanvasElement, WorkspaceNodeInteractionMode } from "../../../types";
import {
  getModelDisplayLabel,
  getProviderDisplayLabel,
} from "../../../services/provider-settings";
import { WorkspaceGenerationStatusCard } from "./WorkspaceGenerationStatusCard";
import { WorkspaceTreePromptNode } from "./WorkspaceTreePromptNode";
import { WorkspaceTreeImageNode } from "./WorkspaceTreeImageNode";
import {
  getAllNodeParentIds,
  getWorkspaceImageNodeHeight,
  resolveWorkspaceTreeNodeKind,
  WORKSPACE_IMAGE_NODE_WIDTH,
} from "../workspaceTreeNode";
import { getElementSourceUrl } from "../workspaceShared";
import {
  WORKSPACE_NODE_FRESH_GENERATED_GLOW_SHADOW,
  WORKSPACE_NODE_EDGE_HANDLE_CLASS,
  WORKSPACE_NODE_CARD_RADIUS,
  WORKSPACE_NODE_HANDLE_BORDER,
} from "./workspaceNodeStyles";

type ResizeHandle =
  | "nw"
  | "ne"
  | "sw"
  | "se"
  | "w"
  | "e"
  | string;

type WorkspaceCanvasImageElementProps = {
  element: CanvasElement;
  nodeInteractionMode: WorkspaceNodeInteractionMode;
  isSelected: boolean;
  zoom: number;
  isExtractingText: boolean;
  elements: CanvasElement[];
  setElementsSynced: React.Dispatch<React.SetStateAction<CanvasElement[]>>;
  setPreviewUrl: React.Dispatch<React.SetStateAction<string | null>>;
  getElementDisplayUrl: (element: CanvasElement) => string | undefined;
  modelOptions: Array<{
    id: string;
    name: string;
    desc: string;
    time: string;
    providerName?: string;
  }>;
  aspectRatios: Array<{
    label: string;
    value: string;
    size: string;
  }>;
  updateSelectedElement: (updates: Partial<CanvasElement>) => void;
  onActivateNode: (elementId: string) => void;
  handleRefImageUpload: (
    e: React.ChangeEvent<HTMLInputElement>,
    elementId: string,
  ) => void | Promise<void>;
  handleGenImage: (elementId: string) => void | Promise<void>;
  setEraserMode: React.Dispatch<React.SetStateAction<boolean>>;
  isTreeConnectionActive: boolean;
  handleTreeConnectionStart: (
    elementId: string,
    port?: "input" | "output",
  ) => void;
  handleTreeConnectionComplete: (elementId: string) => void;
  deleteSelectedElement: () => void;
  onResizeStart: (
    event: React.MouseEvent,
    handle: ResizeHandle,
    elementId: string,
  ) => void;
};

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});
const LABEL_PENDING_IMAGE = "\u56fe\u7247\u8282\u70b9";
const LABEL_GENERATING = "\u751f\u56fe\u4e2d";
const LABEL_GENERATING_MAGIC = "\u6b63\u5728\u6574\u7406\u89c4\u5212";
const LABEL_GENERATION_FAILED = "\u751f\u56fe\u5931\u8d25";
const LABEL_RETRY = "\u91cd\u8bd5";
const LABEL_UNKNOWN_ERROR = "\u751f\u6210\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5";
const LABEL_AI_IMAGE = "AI\u751f\u56fe";

const formatGenerationSourceLabel = (element: CanvasElement): string => {
  const providerLabel = getProviderDisplayLabel(element.genProviderId);
  const rawModelId = String(element.genModel || "").trim();
  const modelLabel = rawModelId ? getModelDisplayLabel(rawModelId) : "";

  if (providerLabel && modelLabel) {
    return `${providerLabel} · ${modelLabel}`;
  }
  return providerLabel || modelLabel || LABEL_AI_IMAGE;
};

const extractTimestamp = (id: string): number | null => {
  const match = id.match(/\d{13}/);
  if (match) {
    return Number(match[0]);
  }
  if (/^\d+$/.test(id)) {
    return Number(id);
  }
  return null;
};

const formatRelativeTime = (id: string): string => {
  const timestamp = extractTimestamp(id);
  if (!timestamp) return "Just now";

  const diffMs = Date.now() - timestamp;
  if (!Number.isFinite(diffMs) || diffMs < 60_000) {
    return "Just now";
  }

  const diffMinutes = Math.round(diffMs / 60_000);
  if (diffMinutes < 60) {
    return RELATIVE_TIME_FORMATTER.format(-diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return RELATIVE_TIME_FORMATTER.format(-diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return RELATIVE_TIME_FORMATTER.format(-diffDays, "day");
};

const parseAspectRatioDimensions = (
  aspectRatio: string | null | undefined,
): { width: number; height: number } | null => {
  const raw = String(aspectRatio || "").trim();
  if (!raw.includes(":")) return null;
  const [widthText, heightText] = raw.split(":");
  const width = Number(widthText);
  const height = Number(heightText);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
};

const ResizeHandles: React.FC<{
  element: CanvasElement;
  zoom: number;
  onResizeStart: WorkspaceCanvasImageElementProps["onResizeStart"];
}> = ({ element, zoom, onResizeStart }) => (
  <>
    <div
      className="absolute top-0 left-0 z-30 h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-nw-resize rounded-full border-2 bg-white shadow-[0_4px_12px_rgba(115,87,255,0.16)] transition hover:scale-125"
      style={{ borderColor: WORKSPACE_NODE_HANDLE_BORDER }}
      onMouseDown={(event) => onResizeStart(event, "nw", element.id)}
    />
    <div
      className="absolute top-0 right-0 z-30 h-3 w-3 translate-x-1/2 -translate-y-1/2 cursor-ne-resize rounded-full border-2 bg-white shadow-[0_4px_12px_rgba(115,87,255,0.16)] transition hover:scale-125"
      style={{ borderColor: WORKSPACE_NODE_HANDLE_BORDER }}
      onMouseDown={(event) => onResizeStart(event, "ne", element.id)}
    />
    <div
      className="absolute bottom-0 left-0 z-30 h-3 w-3 -translate-x-1/2 translate-y-1/2 cursor-sw-resize rounded-full border-2 bg-white shadow-[0_4px_12px_rgba(115,87,255,0.16)] transition hover:scale-125"
      style={{ borderColor: WORKSPACE_NODE_HANDLE_BORDER }}
      onMouseDown={(event) => onResizeStart(event, "sw", element.id)}
    />
    <div
      className="absolute right-0 bottom-0 z-30 h-3 w-3 translate-x-1/2 translate-y-1/2 cursor-se-resize rounded-full border-2 bg-white shadow-[0_4px_12px_rgba(115,87,255,0.16)] transition hover:scale-125"
      style={{ borderColor: WORKSPACE_NODE_HANDLE_BORDER }}
      onMouseDown={(event) => onResizeStart(event, "se", element.id)}
    />
    <div
      className={`${WORKSPACE_NODE_EDGE_HANDLE_CLASS} top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize`}
      style={{ borderColor: WORKSPACE_NODE_HANDLE_BORDER }}
      onMouseDown={(event) => onResizeStart(event, "w", element.id)}
    />
    <div
      className={`${WORKSPACE_NODE_EDGE_HANDLE_CLASS} top-1/2 right-0 translate-x-1/2 -translate-y-1/2 cursor-ew-resize`}
      style={{ borderColor: WORKSPACE_NODE_HANDLE_BORDER }}
      onMouseDown={(event) => onResizeStart(event, "e", element.id)}
    />

    <div
      className="pointer-events-none absolute top-0 left-0 z-50 flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-gray-700 opacity-0 transition-opacity delay-75 duration-200 group-hover:opacity-100"
      style={{
        transform: `scale(${100 / zoom}) translateY(calc(-100% - 4px))`,
        transformOrigin: "bottom left",
      }}
    >
      <ImageIcon size={12} className="opacity-80" />
      <span>{element.type === "gen-image" ? "Gen Image" : "Image"}</span>
    </div>

    <div
      className="pointer-events-none absolute top-0 right-0 z-50 whitespace-nowrap font-mono text-[10px] font-medium text-gray-500 opacity-0 transition-opacity delay-75 duration-200 group-hover:opacity-100"
      style={{
        transform: `scale(${100 / zoom}) translateY(calc(-100% - 6px))`,
        transformOrigin: "bottom right",
      }}
    >
      {Math.round(element.width)} x {Math.round(element.height)}
    </div>
  </>
);

const ImageCardFooter: React.FC<{
  sourceLabel: string;
  timestampLabel: string;
}> = ({ sourceLabel, timestampLabel }) => (
  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/82 via-black/35 to-transparent px-5 pb-4 pt-10 text-white">
    <div
      className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium"
      title={sourceLabel}
    >
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#4ADE80] shadow-[0_0_0_3px_rgba(74,222,128,0.22)]" />
      <span className="truncate">{sourceLabel}</span>
    </div>
    <span className="pl-3 text-[12px] font-medium text-white/92">
      {timestampLabel}
    </span>
  </div>
);

const RoundedImageNode: React.FC<{
  element: CanvasElement;
  displayUrl?: string;
  timestampLabel: string;
}> = ({ element, displayUrl, timestampLabel }) => {
  const sourceLabel = formatGenerationSourceLabel(element);

  return (
    <div className="relative h-full w-full">
      {element.hasFreshGeneratedGlow ? (
        <div
          className={`pointer-events-none absolute -inset-[4px] ${WORKSPACE_NODE_CARD_RADIUS}`}
          style={{ boxShadow: WORKSPACE_NODE_FRESH_GENERATED_GLOW_SHADOW }}
        />
      ) : null}
      <button
        type="button"
        className={`group/result relative block h-full w-full overflow-hidden bg-[#e9e9e9] text-left shadow-[0_18px_46px_rgba(20,20,20,0.14)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(20,20,20,0.18)] ${WORKSPACE_NODE_CARD_RADIUS}`}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            className="h-full w-full object-cover transition duration-300 group-hover/result:scale-[1.02]"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#e9eef5] text-[#98a2b3]">
            <ImageIcon size={52} strokeWidth={1.5} />
          </div>
        )}
        <ImageCardFooter
          sourceLabel={sourceLabel}
          timestampLabel={timestampLabel}
        />
        {element.isGenerating ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/16 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-full bg-white/92 px-3 py-2 text-[12px] font-semibold text-[#18181b] shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
              <Loader2 size={14} className="animate-spin" />
              <span>Generating</span>
            </div>
          </div>
        ) : null}
      </button>
    </div>
  );
};

const GenerationFailureState: React.FC<{
  errorMessage?: string;
  onRetry?: () => void;
  compact?: boolean;
}> = ({ errorMessage, onRetry, compact = false }) => (
  <div className="relative z-10 flex w-full flex-col items-center gap-3 px-4 text-center">
    <div
      className={`flex items-center justify-center rounded-full bg-[#fff1f2] text-[#dc2626] shadow-[0_10px_24px_rgba(127,29,29,0.10)] ${
        compact ? "h-11 w-11" : "h-14 w-14"
      }`}
    >
      <AlertCircle size={compact ? 18 : 22} />
    </div>
    <div className="space-y-1.5">
      <div className={`font-semibold text-[#111827] ${compact ? "text-[13px]" : "text-sm"}`}>
        {LABEL_GENERATION_FAILED}
      </div>
      <p
        className={`mx-auto max-w-[240px] leading-5 text-[#6b7280] ${
          compact ? "text-[11px]" : "text-[12px]"
        }`}
        style={{
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: compact ? 3 : 4,
          overflow: "hidden",
          wordBreak: "break-word",
        }}
      >
        {errorMessage || LABEL_UNKNOWN_ERROR}
      </p>
    </div>
    {onRetry ? (
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full bg-[#111827] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#1f2937]"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onRetry();
        }}
      >
        <RefreshCw size={13} />
        <span>{LABEL_RETRY}</span>
      </button>
    ) : null}
  </div>
);

const PendingImageNode: React.FC<{
  element: CanvasElement;
  onRetry?: () => void;
}> = ({ element, onRetry }) => {
  const generationStatusTitle = element.genStatusTitle || LABEL_GENERATING;
  const generationStatusLines = Array.isArray(element.genStatusLines)
    ? element.genStatusLines.filter(Boolean).slice(-8)
    : [];
  const statusTone = element.genStatusPhase === "retrying" ? "berserk" : "default";
  const showStatusCard = Boolean(element.isGenerating);

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden border border-[#d8e0ea] bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] shadow-[0_18px_42px_rgba(15,23,42,0.08)] ${WORKSPACE_NODE_CARD_RADIUS}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.85),transparent_72%)]" />
      {showStatusCard ? (
        <WorkspaceGenerationStatusCard
          title={generationStatusTitle}
          lines={generationStatusLines}
          tone={statusTone}
          className="h-full w-full rounded-[inherit]"
        />
      ) : element.genError ? (
        <GenerationFailureState
          errorMessage={element.genError}
          onRetry={onRetry}
          compact
        />
      ) : (
        <div className="relative z-10 flex flex-col items-center gap-3 text-[#64748b]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
            <ImageIcon size={18} />
          </div>
          <div className="text-[13px] font-medium">{LABEL_PENDING_IMAGE}</div>
        </div>
      )}
    </div>
  );
};

const ClassicEmptyGenNode: React.FC<{
  element: CanvasElement;
  isSelected: boolean;
  zoom: number;
  onRetry?: () => void;
}> = ({ element, isSelected, zoom, onRetry }) => {
  return (
    <div
      className={`relative flex h-full w-full flex-col overflow-hidden border border-[#e7e1ff] bg-[linear-gradient(180deg,#faf8ff_0%,#f4f0ff_100%)] transition-colors ${WORKSPACE_NODE_CARD_RADIUS}`}
    >
      {isSelected ? (
        <>
          <div
            className="pointer-events-none absolute top-0 left-0 z-50 flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-gray-700"
            style={{
              transform: `scale(${100 / zoom}) translateY(calc(-100% - 4px))`,
              transformOrigin: "bottom left",
            }}
          >
            <ImageIcon size={12} className="opacity-80" />
            <span>{LABEL_AI_IMAGE}</span>
          </div>
          <div
            className="pointer-events-none absolute top-0 right-0 z-50 whitespace-nowrap font-mono text-[10px] font-medium text-gray-500"
            style={{
              transform: `scale(${100 / zoom}) translateY(calc(-100% - 6px))`,
              transformOrigin: "bottom right",
            }}
          >
            {Math.round(element.width)} x {Math.round(element.height)}
          </div>
        </>
      ) : null}

      <div className="flex flex-1 items-center justify-center transition-colors group-hover:bg-[#efe8ff]/60">
        {element.isGenerating ? (
          <div
            className="flex flex-col items-center gap-4"
            style={{ transform: `scale(${100 / zoom})` }}
          >
            <Loader2 size={48} className="animate-spin text-[#7C5CFF]" />
            <div className="flex flex-col items-center gap-1">
              <span className="whitespace-nowrap text-sm font-bold text-[#7C5CFF]">
                {LABEL_GENERATING}
              </span>
              <span className="animate-pulse text-[10px] text-[#9a86ff]">
                {LABEL_GENERATING_MAGIC}
              </span>
            </div>
          </div>
        ) : element.genError ? (
          <div style={{ transform: `scale(${100 / zoom})` }}>
            <GenerationFailureState
              errorMessage={element.genError}
              onRetry={onRetry}
            />
          </div>
        ) : (
          <div
            className="flex flex-col items-center gap-2 text-[#cabdff]"
            style={{ transform: `scale(${100 / zoom})` }}
          >
            <ImageIcon size={48} strokeWidth={1.5} />
          </div>
        )}
      </div>
    </div>
  );
};

const TreeNodePorts: React.FC<{
  elementId: string;
  isSelected: boolean;
  isTreeConnectionActive: boolean;
  showTopPort?: boolean;
  showBottomPort?: boolean;
  onStart: (elementId: string, port?: "input" | "output") => void;
}> = ({
  elementId,
  isSelected,
  isTreeConnectionActive,
  showTopPort = true,
  showBottomPort = true,
  onStart,
}) => {
  const handleStart = (
    event: React.MouseEvent,
    port: "input" | "output",
  ) => {
    event.stopPropagation();
    event.preventDefault();
    onStart(elementId, port);
  };

  const portClassName = `absolute left-1/2 z-40 flex -translate-x-1/2 items-center justify-center rounded-full border border-[#efe9ff] bg-white shadow-[0_10px_26px_rgba(124,92,255,0.22)] transition-all duration-200 ${
    isSelected || isTreeConnectionActive
      ? "opacity-100 scale-100"
      : "pointer-events-none opacity-0 scale-75 group-hover:pointer-events-auto group-hover:opacity-80 group-hover:scale-100"
  }`;

  return (
    <>
      {showTopPort ? (
        <button
          type="button"
          aria-label="Tree input port"
          className={`${portClassName} top-0 h-4 w-4 -translate-y-1/2`}
          onMouseDown={(event) => handleStart(event, "input")}
        >
          <span className="h-[6px] w-[6px] rounded-full bg-[#7C5CFF]" />
        </button>
      ) : null}
      {showBottomPort ? (
        <button
          type="button"
          aria-label="Tree output port"
          className={`${portClassName} top-full h-4 w-4 -translate-y-1/2`}
          onMouseDown={(event) => handleStart(event, "output")}
        >
          <span className="h-[6px] w-[6px] rounded-full bg-[#7C5CFF]" />
        </button>
      ) : null}
    </>
  );
};

const WorkspaceCanvasImageElementImpl: React.FC<
  WorkspaceCanvasImageElementProps
> = ({
  element,
  nodeInteractionMode,
  isSelected,
  zoom,
  isExtractingText,
  elements,
  setElementsSynced,
  setPreviewUrl,
  getElementDisplayUrl,
  modelOptions,
  aspectRatios,
  updateSelectedElement,
  onActivateNode,
  handleRefImageUpload,
  handleGenImage,
  setEraserMode,
  isTreeConnectionActive,
  handleTreeConnectionStart,
  handleTreeConnectionComplete,
  deleteSelectedElement,
  onResizeStart,
}) => {
  if (element.type !== "image" && element.type !== "gen-image") return null;

  const hasUrl = Boolean(element.url);
  const treeNodeKind = resolveWorkspaceTreeNodeKind(element, nodeInteractionMode);
  const isTreePromptNode = treeNodeKind === "prompt";
  const isTreeImageNode = treeNodeKind === "image";
  const isTreeNode = isTreePromptNode || isTreeImageNode;
  const displayUrl = hasUrl ? getElementDisplayUrl(element) : undefined;
  const sourceUrl = element.originalUrl || element.url || undefined;
  const sourceRefUrls =
    element.genRefImages || (element.genRefImage ? [element.genRefImage] : []);
  const previewRefUrls =
    element.genRefPreviewImages ||
    (element.genRefPreviewImage ? [element.genRefPreviewImage] : []);
  const connectedImageParents = getAllNodeParentIds(element)
    .map((parentId) => elements.find((item) => item.id === parentId) || null)
    .filter(
      (item): item is CanvasElement =>
        resolveWorkspaceTreeNodeKind(item, nodeInteractionMode) === "image",
    );
  const parentDerivedSourceRefs = connectedImageParents
    .map((item) => String(getElementSourceUrl(item) || "").trim())
    .filter(Boolean);
  const parentDerivedPreviewRefs = connectedImageParents
    .map(
      (item) =>
        String(getElementDisplayUrl(item) || getElementSourceUrl(item) || "").trim(),
    )
    .filter(Boolean);
  const effectiveSourceRefUrls =
    connectedImageParents.length > 0 ? parentDerivedSourceRefs : sourceRefUrls;
  const effectivePreviewRefUrls =
    connectedImageParents.length > 0 ? parentDerivedPreviewRefs : previewRefUrls;
  const refThumbs =
    effectivePreviewRefUrls.length > 0
      ? effectivePreviewRefUrls
      : effectiveSourceRefUrls;
  const connectedParentCount = connectedImageParents.length;
  const promptValue = element.genPrompt || "";
  const refUploadInputId = `tree-node-ref-upload-${element.id}`;
  const timestampLabel = formatRelativeTime(element.id);
  const updateTreePromptElement = React.useCallback(
    (updates: Partial<CanvasElement>) => {
      setElementsSynced((currentElements) =>
        currentElements.map((item) =>
          item.id === element.id ? { ...item, ...updates } : item,
        ),
      );
    },
    [element.id, setElementsSynced],
  );

  return (
    <div
      className={`group relative flex h-full w-full flex-col ${
        isTreeNode ? "overflow-visible" : ""
      }`}
    >
      {isTreePromptNode ? (
        <>
          <WorkspaceTreePromptNode
            element={element}
            zoom={zoom}
            hasUrl={hasUrl}
            displayUrl={displayUrl}
            thumbUrls={refThumbs}
            sourceRefUrls={effectiveSourceRefUrls}
            connectedParentCount={connectedParentCount}
            promptValue={promptValue}
            setElementsSynced={setElementsSynced}
            setPreviewUrl={setPreviewUrl}
            isGenerating={Boolean(element.isGenerating)}
            isSelected={isSelected}
            modelOptions={modelOptions}
            aspectRatios={aspectRatios}
            selectElement={onActivateNode}
            updateSelectedElement={updateTreePromptElement}
            handleRefImageUpload={handleRefImageUpload}
            handleGenImage={handleGenImage}
            onDelete={deleteSelectedElement}
            refUploadInputId={refUploadInputId}
          />
          <TreeNodePorts
            elementId={element.id}
            isSelected={isSelected}
            isTreeConnectionActive={isTreeConnectionActive}
            showTopPort
            showBottomPort
            onStart={handleTreeConnectionStart}
          />
        </>
      ) : hasUrl ? (
        <>
          {isTreeImageNode ? (
            <WorkspaceTreeImageNode
              element={element}
              isSelected={isSelected}
              displayUrl={displayUrl}
              sourceUrl={sourceUrl}
              timestampLabel={timestampLabel}
              onStartMaskEdit={() => setEraserMode(true)}
              onDelete={deleteSelectedElement}
              onRetry={() => {
                void handleGenImage(element.id);
              }}
            />
          ) : (
            <RoundedImageNode
              element={element}
              displayUrl={displayUrl}
              timestampLabel={timestampLabel}
            />
          )}
          {isTreeImageNode ? (
            <TreeNodePorts
              elementId={element.id}
              isSelected={isSelected}
              isTreeConnectionActive={isTreeConnectionActive}
              showTopPort
              showBottomPort
              onStart={handleTreeConnectionStart}
            />
          ) : null}
          {isSelected && isExtractingText ? (
            <div
              className={`pointer-events-none absolute inset-0 z-30 overflow-hidden ${WORKSPACE_NODE_CARD_RADIUS}`}
            >
              <div className="absolute inset-0 bg-blue-600/20 backdrop-blur-[2px]" />
              <div
                className="absolute right-0 left-0 h-1"
                style={{
                  background:
                    "linear-gradient(180deg, transparent, rgba(59,130,246,0.6), transparent)",
                  animation: "textExtractScan 1.8s ease-in-out infinite",
                  boxShadow: "0 0 20px 8px rgba(59,130,246,0.25)",
                }}
              />
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ transform: `scale(${100 / zoom})` }}
              >
                <div className="flex items-center gap-2 rounded-full bg-blue-600/80 px-4 py-2 text-xs font-bold text-white shadow-lg backdrop-blur-sm">
                  <Loader2 size={14} className="animate-spin" />
                  Extracting text
                </div>
              </div>
              <style>{`
                @keyframes textExtractScan {
                  0% { top: 0; }
                  50% { top: 100%; }
                  100% { top: 0; }
                }
              `}</style>
            </div>
          ) : null}
          {isSelected ? (
            <ResizeHandles
              element={element}
              zoom={zoom}
              onResizeStart={onResizeStart}
            />
          ) : null}
        </>
      ) : element.type === "image" ? (
        <>
          <PendingImageNode
            element={element}
            onRetry={() => {
              void handleGenImage(element.id);
            }}
          />
          {isTreeImageNode ? (
            <TreeNodePorts
              elementId={element.id}
              isSelected={isSelected}
              isTreeConnectionActive={isTreeConnectionActive}
              showTopPort
              showBottomPort
              onStart={handleTreeConnectionStart}
            />
          ) : null}
          {isSelected ? (
            <ResizeHandles
              element={element}
              zoom={zoom}
              onResizeStart={onResizeStart}
            />
          ) : null}
        </>
      ) : (
        <>
          <ClassicEmptyGenNode
            element={element}
            isSelected={isSelected}
            zoom={zoom}
            onRetry={() => {
              void handleGenImage(element.id);
            }}
          />
          {isSelected ? (
            <ResizeHandles
              element={element}
              zoom={zoom}
              onResizeStart={onResizeStart}
            />
          ) : null}
        </>
      )}
    </div>
  );
};

export const WorkspaceCanvasImageElement = memo(
  WorkspaceCanvasImageElementImpl,
  (prev, next) =>
    prev.element === next.element &&
    prev.nodeInteractionMode === next.nodeInteractionMode &&
    prev.isSelected === next.isSelected &&
    prev.zoom === next.zoom &&
    prev.isExtractingText === next.isExtractingText &&
    prev.elements === next.elements &&
    prev.getElementDisplayUrl === next.getElementDisplayUrl &&
    prev.modelOptions === next.modelOptions &&
    prev.aspectRatios === next.aspectRatios &&
    prev.updateSelectedElement === next.updateSelectedElement &&
    prev.onActivateNode === next.onActivateNode &&
    prev.handleRefImageUpload === next.handleRefImageUpload &&
    prev.handleGenImage === next.handleGenImage &&
    prev.setEraserMode === next.setEraserMode &&
    prev.isTreeConnectionActive === next.isTreeConnectionActive &&
    prev.handleTreeConnectionStart === next.handleTreeConnectionStart &&
    prev.handleTreeConnectionComplete === next.handleTreeConnectionComplete &&
    prev.deleteSelectedElement === next.deleteSelectedElement &&
    prev.onResizeStart === next.onResizeStart &&
    prev.setElementsSynced === next.setElementsSynced &&
    prev.setPreviewUrl === next.setPreviewUrl,
);
