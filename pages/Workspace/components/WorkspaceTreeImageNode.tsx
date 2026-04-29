import React from "react";
import {
  AlertCircle,
  Download,
  Image as ImageIcon,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import type { CanvasElement } from "../../../types";
import {
  getModelDisplayLabel,
  getProviderDisplayLabel,
} from "../../../services/provider-settings";
import { downloadFromUrls } from "../../../utils/download";
import { WorkspaceGenerationStatusCard } from "./WorkspaceGenerationStatusCard";
import {
  WORKSPACE_NODE_BERSERK_SHADOW,
  WORKSPACE_NODE_FRESH_GENERATED_GLOW_SHADOW,
  WORKSPACE_NODE_OUTLINE_RADIUS,
  WORKSPACE_NODE_SELECTION_RADIUS,
  WORKSPACE_NODE_SELECTION_SHADOW,
} from "./workspaceNodeStyles";

const LABEL_EDIT = "\u7f16\u8f91";
const LABEL_DOWNLOAD = "\u4e0b\u8f7d";
const LABEL_DELETE = "\u5220\u9664\u8282\u70b9";
const LABEL_DOUBLE_CLICK_PREVIEW = "\u53cc\u51fb\u9884\u89c8";
const LABEL_TREE_IMAGE_NODE = "\u6811\u72b6\u56fe\u7247\u8282\u70b9";
const LABEL_GENERATING = "\u751f\u56fe\u4e2d";
const LABEL_GENERATION_FAILED = "\u751f\u56fe\u5931\u8d25";
const LABEL_RETRY = "\u91cd\u8bd5";
const LABEL_UNKNOWN_ERROR = "\u751f\u6210\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5";
const LABEL_BERSERK = "\u72c2\u66b4";

const formatGenerationSourceLabel = (element: CanvasElement): string => {
  const providerLabel = getProviderDisplayLabel(element.genProviderId);
  const modelLabel = String(element.genModel || "").trim()
    ? getModelDisplayLabel(String(element.genModel || "").trim())
    : "";

  if (providerLabel && modelLabel) {
    return `${providerLabel} · ${modelLabel}`;
  }
  return providerLabel || modelLabel || "未记录模型";
};

type WorkspaceTreeImageNodeProps = {
  element: CanvasElement;
  isSelected: boolean;
  displayUrl?: string;
  sourceUrl?: string;
  timestampLabel: string;
  onStartMaskEdit: () => void;
  onDelete: () => void;
  onRetry?: () => void;
};

const ImageCardFooter: React.FC<{
  sourceLabel: string;
  timestampLabel: string;
}> = ({ sourceLabel, timestampLabel }) => (
  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/82 via-black/28 to-transparent px-4 pb-3 pt-12 text-white">
    <div
      className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium tracking-[0.01em]"
      title={sourceLabel}
    >
      <span className="inline-block h-2 w-2 rounded-full bg-[#8BC34A] shadow-[0_0_0_3px_rgba(139,195,74,0.18)]" />
      <span className="truncate">{sourceLabel}</span>
    </div>
    <span className="pl-3 text-[11px] font-medium text-white/86">{timestampLabel}</span>
  </div>
);

const ToolbarButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}> = ({ icon, label, disabled = false, destructive = false, onClick }) => (
  <button
    type="button"
    aria-label={label}
    className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition ${
      destructive
        ? "text-[#111827] hover:bg-[#fff1f2] hover:text-[#dc2626]"
        : "text-[#111827] hover:bg-[#f6f3ff]"
    } disabled:cursor-not-allowed disabled:opacity-40`}
    disabled={disabled}
    onMouseDown={(event) => event.stopPropagation()}
    onClick={onClick}
  >
    {icon}
    <span className="whitespace-nowrap">{label}</span>
  </button>
);

const TreeImageToolbar: React.FC<{
  canEdit: boolean;
  isVisible: boolean;
  onStartMaskEdit: () => void;
  onDownload: () => void;
  onDelete: () => void;
}> = ({
  canEdit,
  isVisible,
  onStartMaskEdit,
  onDownload,
  onDelete,
}) =>
  !isVisible ? null : (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center transition-opacity duration-200 opacity-100">
    <div
      className="pointer-events-auto flex w-max items-center gap-0.5 rounded-full border border-white/82 bg-[rgba(255,255,255,0.98)] px-2 py-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.10),0_1px_0_rgba(255,255,255,0.78)_inset] backdrop-blur-md transition-[transform,opacity] duration-200"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      style={{
        transform: "translateY(calc(-100% - 12px)) scale(1)",
        transformOrigin: "center bottom",
      }}
    >
      <ToolbarButton
        icon={<Pencil size={14} />}
        label={LABEL_EDIT}
        disabled={!canEdit}
        onClick={(event) => {
          event.stopPropagation();
          onStartMaskEdit();
        }}
      />
      <ToolbarButton
        icon={<Download size={14} />}
        label={LABEL_DOWNLOAD}
        onClick={(event) => {
          event.stopPropagation();
          onDownload();
        }}
      />
      <ToolbarButton
        icon={<Trash2 size={14} />}
        label={LABEL_DELETE}
        destructive
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      />
    </div>
    </div>
  );

const DoubleClickHint: React.FC<{
  isVisible: boolean;
}> = ({ isVisible }) => (
  <div
    aria-hidden={!isVisible}
    className={`pointer-events-none absolute right-3 top-3 z-[4] rounded-full border border-white/72 bg-[rgba(17,24,39,0.38)] px-2.5 py-1 text-[10px] font-medium tracking-[0.01em] text-white shadow-[0_8px_22px_rgba(0,0,0,0.16)] backdrop-blur-md transition-[opacity,transform] duration-200 ${
      isVisible ? "opacity-100" : "opacity-0"
    }`}
    style={{
      transform: `translateY(${isVisible ? "0px" : "-4px"}) scale(${isVisible ? 1 : 0.96})`,
      transformOrigin: "top right",
    }}
  >
    {LABEL_DOUBLE_CLICK_PREVIEW}
  </div>
);

export const WorkspaceTreeImageNode: React.FC<
  WorkspaceTreeImageNodeProps
> = ({
  element,
  isSelected,
  displayUrl,
  sourceUrl,
  timestampLabel,
  onStartMaskEdit,
  onDelete,
  onRetry,
}) => {
  const isBerserkNode = Boolean(element.genInfiniteRetry);
  const showBerserkVisualState = isBerserkNode && Boolean(element.isGenerating);
  const generationStatusTitle = element.genStatusTitle || LABEL_GENERATING;
  const generationStatusLines = Array.isArray(element.genStatusLines)
    ? element.genStatusLines.filter(Boolean).slice(-8)
    : [];
  const statusTone = showBerserkVisualState ? "berserk" : "default";
  const showStatusOverlay = Boolean(element.isGenerating);
  const sourceLabel = formatGenerationSourceLabel(element);
  const handleDownload = React.useCallback(async () => {
    try {
      await downloadFromUrls(
        [sourceUrl, displayUrl],
        `tree-image-${element.id}`,
      );
    } catch (error) {
      console.error("Tree image download failed", error);
    }
  }, [displayUrl, element.id, sourceUrl]);

  return (
    <div className="relative h-full w-full overflow-visible">
      {isSelected ? (
        <div
          className={`pointer-events-none absolute -inset-[4px] z-10 ${WORKSPACE_NODE_OUTLINE_RADIUS}`}
          style={{
            borderRadius: WORKSPACE_NODE_SELECTION_RADIUS,
            boxShadow: WORKSPACE_NODE_SELECTION_SHADOW,
          }}
        />
      ) : null}
      {element.hasFreshGeneratedGlow ? (
        <div
          className={`pointer-events-none absolute -inset-[4px] ${WORKSPACE_NODE_OUTLINE_RADIUS}`}
          style={{
            borderRadius: WORKSPACE_NODE_SELECTION_RADIUS,
            boxShadow: WORKSPACE_NODE_FRESH_GENERATED_GLOW_SHADOW,
          }}
        />
      ) : null}
      {showBerserkVisualState ? (
        <div
          className={`pointer-events-none absolute -inset-[4px] ${WORKSPACE_NODE_OUTLINE_RADIUS}`}
          style={{
            borderRadius: WORKSPACE_NODE_SELECTION_RADIUS,
            boxShadow: WORKSPACE_NODE_BERSERK_SHADOW,
          }}
        />
      ) : null}
      <TreeImageToolbar
        canEdit={Boolean(displayUrl)}
        isVisible={isSelected}
        onStartMaskEdit={onStartMaskEdit}
        onDownload={handleDownload}
        onDelete={onDelete}
      />
      <button
        type="button"
        aria-label={LABEL_TREE_IMAGE_NODE}
        className={`group/result relative block h-full w-full overflow-hidden rounded-[30px] border bg-[#ebe8e2] text-left transition duration-200 ${
          isSelected
            ? "z-20 border-white/82 shadow-[0_18px_42px_rgba(15,23,42,0.13)]"
            : "border-transparent shadow-[0_14px_30px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(15,23,42,0.12)]"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0 z-[1] rounded-[30px] shadow-[0_1px_0_rgba(255,255,255,0.4)_inset]" />
        <div className="pointer-events-none absolute inset-0 z-[2] rounded-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0)_34%,rgba(0,0,0,0.02)_100%)]" />
        {showBerserkVisualState ? (
          <div className="pointer-events-none absolute left-3 top-3 z-[4] rounded-full border border-[rgba(255,161,118,0.92)] bg-[rgba(255,103,46,0.94)] px-2.5 py-1 text-[10px] font-bold tracking-[0.04em] text-white shadow-[0_10px_24px_rgba(255,94,0,0.26)]">
            {LABEL_BERSERK}
          </div>
        ) : null}
        {displayUrl ? (
          <img
            src={displayUrl}
            className="h-full w-full object-cover transition duration-300 group-hover/result:scale-[1.018]"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#ece8e3] text-[#9ca3af]">
            <ImageIcon size={52} strokeWidth={1.5} />
          </div>
        )}
        <DoubleClickHint isVisible={isSelected} />
        {isSelected ? (
          <div className="pointer-events-none absolute inset-0 z-[3] rounded-[30px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_42%)]" />
        ) : null}
        <ImageCardFooter sourceLabel={sourceLabel} timestampLabel={timestampLabel} />
        {showStatusOverlay ? (
          <div
            className={`pointer-events-none absolute inset-0 flex items-center justify-center backdrop-blur-[1.5px] ${
              showBerserkVisualState ? "bg-[rgba(255,104,47,0.10)]" : "bg-[rgba(248,250,252,0.20)]"
            }`}
          >
            <WorkspaceGenerationStatusCard
              title={generationStatusTitle}
              lines={generationStatusLines}
              tone={statusTone}
              className="h-full w-full rounded-[inherit]"
            />
          </div>
        ) : element.genError ? (
          <div className="absolute inset-0 z-[5] flex items-center justify-center bg-[rgba(18,18,18,0.38)] px-5 backdrop-blur-[2px]">
            <div
              className="flex w-full max-w-[280px] flex-col items-center gap-3 rounded-[22px] border border-white/70 bg-[rgba(255,255,255,0.96)] px-4 py-4 text-center shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fff1f2] text-[#dc2626]">
                <AlertCircle size={18} />
              </div>
              <div className="space-y-1">
                <div className="text-[13px] font-semibold text-[#111827]">
                  {LABEL_GENERATION_FAILED}
                </div>
                <p
                  className="text-[11px] leading-5 text-[#6b7280]"
                  style={{
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 3,
                    overflow: "hidden",
                    wordBreak: "break-word",
                  }}
                >
                  {element.genError || LABEL_UNKNOWN_ERROR}
                </p>
              </div>
              {onRetry ? (
                <div
                  role="button"
                  tabIndex={0}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#111827] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#1f2937]"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRetry();
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    onRetry();
                  }}
                >
                  <RefreshCw size={13} />
                  <span>{LABEL_RETRY}</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </button>
    </div>
  );
};
