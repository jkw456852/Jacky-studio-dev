import React from "react";
import { Check, CirclePlus, GitBranch, Loader2, Maximize2, Minimize2, PanelRightClose, X } from "lucide-react";
import type { ChatMessage, ConversationSession } from "../../../types";
import { isConversationArchived } from "../conversationMeta";
import { AssistantSidebarConversationActions } from "./AssistantSidebarConversationActions";
import { AssistantSidebarFilesPopover } from "./AssistantSidebarFilesPopover";
import { AssistantSidebarHistoryPopover } from "./AssistantSidebarHistoryPopover";
import { formatCompactConversationTitle, formatConversationTitle } from "./conversationDisplay";

type AssistantSidebarHeaderProps = {
  title: string;
  historyOpen: boolean;
  historySearch: string;
  setHistorySearch: React.Dispatch<React.SetStateAction<string>>;
  conversations: ConversationSession[];
  activeConversationId: string;
  activeConversationRunning?: boolean;
  activeConversationHasDraft?: boolean;
  filesOpen: boolean;
  messages: ChatMessage[];
  onPreview: (url: string) => void;
  onToggleHistory: () => void;
  onCreateConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, title: string) => void;
  onToggleConversationPinned: (conversationId: string) => void;
  onToggleConversationArchived: (conversationId: string) => void;
  onContinueConversation?: (conversationId: string) => void;
  onRestoreConversationInput?: (conversationId: string) => void;
  branchInfo?: {
    parentTitle: string;
    branchPointLabel?: string;
    onOpenParent: () => void;
  } | null;
  onToggleFiles: () => void;
  onClose: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
};

const NEW_CONVERSATION_LABEL = "新对话";
const ENTER_FULLSCREEN_LABEL = "进入全屏";
const EXIT_FULLSCREEN_LABEL = "退出全屏";
const COLLAPSE_SIDEBAR_LABEL = "收起侧边栏";

export const AssistantSidebarHeader: React.FC<AssistantSidebarHeaderProps> = ({
  title,
  historyOpen,
  historySearch,
  setHistorySearch,
  conversations,
  activeConversationId,
  activeConversationRunning = false,
  activeConversationHasDraft = false,
  filesOpen,
  messages,
  onPreview,
  onToggleHistory,
  onCreateConversation,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onToggleConversationPinned,
  onToggleConversationArchived,
  onContinueConversation,
  onRestoreConversationInput,
  branchInfo = null,
  onToggleFiles,
  onClose,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  const fullscreenToggleLabel = isFullscreen
    ? EXIT_FULLSCREEN_LABEL
    : ENTER_FULLSCREEN_LABEL;
  const activePanelMode = isFullscreen
    ? historyOpen
      ? "history"
      : filesOpen
        ? "files"
        : null
    : null;

  const activeConversation = React.useMemo(
    () =>
      conversations.find((conversation) => conversation.id === activeConversationId) ||
      null,
    [activeConversationId, conversations],
  );

  const activeConversationArchived = React.useMemo(
    () =>
      activeConversation ? isConversationArchived(activeConversation) : false,
    [activeConversation],
  );

  const [isRenamingActiveConversation, setIsRenamingActiveConversation] =
    React.useState(false);
  const [editingTitle, setEditingTitle] = React.useState("");

  React.useEffect(() => {
    setIsRenamingActiveConversation(false);
    setEditingTitle("");
  }, [activeConversationId]);

  const startRenameActiveConversation = React.useCallback(() => {
    if (!activeConversation) return;
    setEditingTitle(formatConversationTitle(activeConversation.title || ""));
    setIsRenamingActiveConversation(true);
  }, [activeConversation]);

  const cancelRenameActiveConversation = React.useCallback(() => {
    setIsRenamingActiveConversation(false);
    setEditingTitle("");
  }, []);

  const commitRenameActiveConversation = React.useCallback(() => {
    if (!activeConversation) return;
    const normalizedTitle = String(editingTitle || "").trim();
    if (!normalizedTitle) {
      cancelRenameActiveConversation();
      return;
    }
    onRenameConversation(activeConversation.id, normalizedTitle);
    setIsRenamingActiveConversation(false);
    setEditingTitle("");
  }, [
    activeConversation,
    cancelRenameActiveConversation,
    editingTitle,
    onRenameConversation,
  ]);

  const displayTitle = formatConversationTitle(title);
  const compactDisplayTitle = formatCompactConversationTitle(title, 24);
  const headerTitle =
    activePanelMode === "history"
      ? "历史记录"
      : activePanelMode === "files"
        ? "本轮产出"
        : compactDisplayTitle;
  const headerCaption =
    activePanelMode === "history"
      ? "切换、管理和回看当前工作区里的对话"
      : activePanelMode === "files"
        ? "集中查看当前对话里生成的图片、视频和文件"
        : branchInfo?.branchPointLabel || null;

  return (
    <div className="relative z-[90] flex shrink-0 items-center justify-between gap-3 overflow-visible border-b border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(249,250,252,0.9))] px-4 pb-2.5 pt-3 backdrop-blur-xl">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            {isRenamingActiveConversation && activeConversation ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={editingTitle}
                  autoFocus
                  onChange={(event) => setEditingTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitRenameActiveConversation();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      cancelRenameActiveConversation();
                    }
                  }}
                  className="h-8 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
                  aria-label="重命名当前对话"
                />
                <button
                  type="button"
                  onClick={commitRenameActiveConversation}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                  aria-label="保存对话标题"
                >
                  <Check size={13} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={cancelRenameActiveConversation}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-slate-700"
                  aria-label="取消重命名"
                >
                  <X size={13} strokeWidth={2} />
                </button>
              </div>
            ) : (
              <>
                <div className="flex min-w-0 items-center gap-2">
                  <div
                    className="truncate text-[16px] font-semibold leading-5 text-slate-950"
                    title={activePanelMode ? headerTitle : displayTitle}
                  >
                    {headerTitle}
                  </div>
                  {activeConversationRunning && !activePanelMode ? (
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 shadow-[inset_0_0_0_1px_rgba(191,219,254,0.95)]">
                      <Loader2 size={11} strokeWidth={2} className="animate-spin" />
                    </span>
                  ) : null}
                </div>
                {headerCaption ? (
                  <div className="mt-1 truncate text-[11px] leading-4 text-slate-400">
                    {headerCaption}
                  </div>
                ) : null}
              </>
            )}
          </div>

          {!isRenamingActiveConversation &&
          activeConversation &&
          !activePanelMode ? (
            <AssistantSidebarConversationActions
              archivedView={activeConversationArchived}
              isPinned={activeConversation.pinned === true}
              conversationTitle={activeConversation.title}
              compact
              alwaysVisible
              onPin={() => onToggleConversationPinned(activeConversation.id)}
              onRename={startRenameActiveConversation}
              onArchive={() => onToggleConversationArchived(activeConversation.id)}
              onDelete={() => onDeleteConversation(activeConversation.id)}
            />
          ) : null}
        </div>

        {branchInfo && !activePanelMode ? (
          <button
            type="button"
            onClick={branchInfo.onOpenParent}
            className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-white/86 px-2.5 py-1 text-[11px] text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
            title={`回到源对话：${branchInfo.parentTitle}`}
          >
            <GitBranch size={11} strokeWidth={2} />
            <span className="truncate">来自 {branchInfo.parentTitle} 的分支</span>
          </button>
        ) : null}

      </div>

      <div className="flex shrink-0 items-center gap-1 rounded-full bg-white/84 p-1 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.92),0_10px_24px_-20px_rgba(15,23,42,0.12)]">
        {!isFullscreen ? (
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.92),0_10px_20px_-18px_rgba(15,23,42,0.18)] transition-all duration-200 hover:bg-slate-50 hover:text-slate-950"
            onClick={onCreateConversation}
            title={NEW_CONVERSATION_LABEL}
            aria-label={NEW_CONVERSATION_LABEL}
          >
            <CirclePlus size={14} strokeWidth={1.7} />
          </button>
        ) : null}

        {!isFullscreen ? (
          <AssistantSidebarHistoryPopover
            open={historyOpen}
            historySearch={historySearch}
            setHistorySearch={setHistorySearch}
            conversations={conversations}
            activeConversationId={activeConversationId}
            activeConversationRunning={activeConversationRunning}
            onToggle={onToggleHistory}
            onCreateConversation={onCreateConversation}
            onSelectConversation={onSelectConversation}
            onDeleteConversation={onDeleteConversation}
            onRenameConversation={onRenameConversation}
            onToggleConversationPinned={onToggleConversationPinned}
            onToggleConversationArchived={onToggleConversationArchived}
            onContinueConversation={onContinueConversation}
            onRestoreConversationInput={onRestoreConversationInput}
          />
        ) : null}

        <AssistantSidebarFilesPopover
          open={filesOpen}
          messages={messages}
          onPreview={onPreview}
          onToggle={onToggleFiles}
          triggerOnly={false}
        />

        {onToggleFullscreen ? (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/66 text-slate-400 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.72)] transition hover:bg-white hover:text-slate-700"
            title={fullscreenToggleLabel}
            aria-label={fullscreenToggleLabel}
          >
            {isFullscreen ? (
              <Minimize2 size={15} strokeWidth={1.7} />
            ) : (
              <Maximize2 size={15} strokeWidth={1.7} />
            )}
          </button>
        ) : null}

        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/66 text-slate-400 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.72)] transition hover:bg-white hover:text-slate-700"
          title={COLLAPSE_SIDEBAR_LABEL}
          aria-label={COLLAPSE_SIDEBAR_LABEL}
        >
          <PanelRightClose size={15} strokeWidth={1.6} />
        </button>
      </div>
    </div>
  );
};
