import React from "react";
import {
  Archive,
  Check,
  CirclePlus,
  GitBranch,
  Loader2,
  MessageSquare,
  Pin,
  Search,
  X,
} from "lucide-react";
import type { ConversationSession } from "../../../types";
import {
  deriveConversationSidebarPreview,
  deriveConversationStatusSummary,
  getConversationMessageCount,
  groupConversationsForSidebar,
  hasConversationDraft,
  isConversationArchived,
  matchesConversationSearch,
} from "../conversationMeta";
import { AssistantSidebarConversationActions } from "./AssistantSidebarConversationActions";
import {
  formatChatCount,
  formatCompactConversationTitle,
  formatConversationTitle,
  formatHistoryGroupLabel,
  formatMessageCount,
  formatStatusDetail,
  formatStatusLabel,
  NEW_CONVERSATION_DISPLAY_TITLE,
} from "./conversationDisplay";

type AssistantSidebarHistoryPanelProps = {
  title?: string;
  historySearch: string;
  setHistorySearch: React.Dispatch<React.SetStateAction<string>>;
  conversations: ConversationSession[];
  activeConversationId: string;
  activeConversationRunning?: boolean;
  onCreateConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, title: string) => void;
  onToggleConversationPinned: (conversationId: string) => void;
  onToggleConversationArchived: (conversationId: string) => void;
};

const formatConversationTime = (updatedAt: number) =>
  new Date(updatedAt).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const AssistantSidebarHistoryPanel: React.FC<
  AssistantSidebarHistoryPanelProps
> = ({
  title = "历史对话",
  historySearch,
  setHistorySearch,
  conversations,
  activeConversationId,
  activeConversationRunning = false,
  onCreateConversation,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onToggleConversationPinned,
  onToggleConversationArchived,
}) => {
  const [editingConversationId, setEditingConversationId] = React.useState<
    string | null
  >(null);
  const [editingTitle, setEditingTitle] = React.useState("");
  const [showArchived, setShowArchived] = React.useState(false);

  const filteredConversations = React.useMemo(
    () =>
      conversations.filter(
        (conversation) =>
          isConversationArchived(conversation) === showArchived &&
          matchesConversationSearch(conversation, historySearch),
      ),
    [conversations, historySearch, showArchived],
  );

  const groupedConversations = React.useMemo(
    () => groupConversationsForSidebar(filteredConversations),
    [filteredConversations],
  );

  const activeConversationCount = React.useMemo(
    () =>
      conversations.filter((conversation) => !isConversationArchived(conversation))
        .length,
    [conversations],
  );

  const archivedConversationCount = React.useMemo(
    () =>
      conversations.filter((conversation) => isConversationArchived(conversation))
        .length,
    [conversations],
  );

  const pinnedConversationCount = React.useMemo(
    () => conversations.filter((conversation) => conversation.pinned).length,
    [conversations],
  );

  const hasSearch = historySearch.trim().length > 0;

  const startRename = React.useCallback((conversation: ConversationSession) => {
    setEditingConversationId(conversation.id);
    setEditingTitle(formatConversationTitle(conversation.title));
  }, []);

  const cancelRename = React.useCallback(() => {
    setEditingConversationId(null);
    setEditingTitle("");
  }, []);

  const commitRename = React.useCallback(() => {
    if (!editingConversationId) return;
    const normalizedTitle = editingTitle.trim();
    if (!normalizedTitle) {
      cancelRename();
      return;
    }
    onRenameConversation(editingConversationId, normalizedTitle);
    setEditingConversationId(null);
    setEditingTitle("");
  }, [cancelRename, editingConversationId, editingTitle, onRenameConversation]);

  const clearSearch = React.useCallback(() => {
    setHistorySearch("");
  }, [setHistorySearch]);

  const emptyTitle = showArchived
    ? hasSearch
      ? "没有匹配的归档对话"
      : "还没有归档对话"
    : hasSearch
      ? "没有匹配的对话"
      : "还没有对话";

  const emptyDescription = showArchived
    ? hasSearch
      ? "换个关键词试试，或者回到活跃对话继续工作。"
      : "归档后的对话会保存在这里，方便之后回查。"
    : hasSearch
      ? "清空搜索，或者直接新建一个对话继续。"
      : "新建一个对话后，这里的列表会成为你的工作记录。";

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-slate-200/80 bg-[linear-gradient(180deg,#fafbfd_0%,#f4f6fa_100%)]">
      <div className="border-b border-slate-200/80 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[15px] font-semibold leading-5 text-slate-900">
              {title}
            </div>
            <div className="mt-1 text-[11px] leading-4 text-slate-400">
              像工作台一样管理每一段会话
            </div>
          </div>
          <button
            type="button"
            onClick={onCreateConversation}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.12)] transition hover:border-slate-300 hover:bg-slate-50"
          >
            <CirclePlus size={14} strokeWidth={1.8} />
            <span>{NEW_CONVERSATION_DISPLAY_TITLE}</span>
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/80 px-2.5 py-1">
            <MessageSquare size={10} strokeWidth={2} />
            {showArchived ? "归档" : "活跃"} {showArchived ? archivedConversationCount : activeConversationCount}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/80 px-2.5 py-1">
            <Pin size={10} strokeWidth={2} />
            {pinnedConversationCount} 个置顶
          </span>
        </div>

        <div className="relative mt-3">
          <Search
            size={14}
            strokeWidth={1.8}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={historySearch}
            onChange={(event) => setHistorySearch(event.target.value)}
            placeholder="搜索标题或消息内容"
            className="h-10 w-full rounded-2xl border border-slate-200/90 bg-white/86 pl-9 pr-10 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
          />
          {hasSearch ? (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="清空搜索"
            >
              <X size={12} strokeWidth={2} />
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowArchived(false)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
              !showArchived
                ? "bg-slate-900 text-white shadow-[0_10px_18px_-16px_rgba(15,23,42,0.34)]"
                : "bg-white/86 text-slate-500 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.84)] hover:bg-white hover:text-slate-800"
            }`}
          >
            <MessageSquare size={10} strokeWidth={2} />
            <span>活跃</span>
            <span className={!showArchived ? "text-white/70" : "text-slate-400"}>
              {activeConversationCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setShowArchived(true)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
              showArchived
                ? "bg-slate-900 text-white shadow-[0_10px_18px_-16px_rgba(15,23,42,0.34)]"
                : "bg-white/86 text-slate-500 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.84)] hover:bg-white hover:text-slate-800"
            }`}
          >
            <Archive size={10} strokeWidth={2} />
            <span>归档</span>
            <span className={showArchived ? "text-white/70" : "text-slate-400"}>
              {archivedConversationCount}
            </span>
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 custom-scrollbar">
        {groupedConversations.length > 0 ? (
          <div className="space-y-3">
            {groupedConversations.map((group) => (
              <section key={group.key} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    {formatHistoryGroupLabel(group.label)}
                  </span>
                  <span className="rounded-full border border-slate-200/80 bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                    {formatChatCount(group.conversations.length)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {group.conversations.map((conversation) => {
                    const isActive = conversation.id === activeConversationId;
                    const isEditing = editingConversationId === conversation.id;
                    const preview = deriveConversationSidebarPreview(conversation);
                    const statusSummary = deriveConversationStatusSummary(conversation);
                    const messageCount = getConversationMessageCount(conversation);
                    const hasDraft = hasConversationDraft(conversation);
                    const isRunning = isActive && activeConversationRunning;
                    const isDraftPreview = preview.source === "draft";
                    const effectiveStatusLabel = isRunning
                      ? "Running"
                      : statusSummary.label;
                    const displayStatusLabel =
                      formatStatusLabel(effectiveStatusLabel) || effectiveStatusLabel;
                    const effectiveStatusTone = isRunning
                      ? "info"
                      : statusSummary.tone;
                    const effectiveStatusDetail = isRunning
                      ? "当前对话仍在运行"
                      : statusSummary.detail;
                    const displayStatusDetail =
                      formatStatusDetail(effectiveStatusDetail);
                    const statusBadgeClass =
                      effectiveStatusTone === "info"
                        ? "bg-blue-50 text-blue-700"
                        : effectiveStatusTone === "success"
                          ? "bg-emerald-50 text-emerald-700"
                          : effectiveStatusTone === "warning"
                            ? "bg-amber-50 text-amber-700"
                            : effectiveStatusTone === "danger"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-slate-100 text-slate-500";

                    return (
                      <div
                        key={conversation.id}
                        role="button"
                        tabIndex={isEditing ? -1 : 0}
                        onClick={() => {
                          if (!isEditing) onSelectConversation(conversation.id);
                        }}
                        onKeyDown={(event) => {
                          if (isEditing) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onSelectConversation(conversation.id);
                          }
                        }}
                        className={`group flex w-full items-start gap-2 rounded-[18px] border px-2.5 py-2.5 text-left transition outline-none ${
                          isActive
                            ? "border-slate-200/90 bg-white shadow-[0_18px_34px_-28px_rgba(15,23,42,0.14)]"
                            : "border-transparent bg-transparent hover:border-slate-200/90 hover:bg-white/88"
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${
                            isActive
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <MessageSquare size={13} strokeWidth={1.8} />
                        </div>

                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <div
                              className="flex items-center gap-1.5"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <input
                                type="text"
                                value={editingTitle}
                                autoFocus
                                onChange={(event) => setEditingTitle(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    commitRename();
                                  } else if (event.key === "Escape") {
                                    event.preventDefault();
                                    cancelRename();
                                  }
                                }}
                                className="h-8 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-[12px] font-semibold text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                                aria-label="重命名对话"
                              />
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  commitRename();
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                                aria-label="保存对话标题"
                              >
                                <Check size={13} strokeWidth={2} />
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  cancelRename();
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-slate-700"
                                aria-label="取消重命名"
                              >
                                <X size={13} strokeWidth={2} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <div
                                  className={`truncate text-[12.5px] font-semibold ${
                                    isActive ? "text-slate-900" : "text-slate-700"
                                  }`}
                                  title={formatConversationTitle(conversation.title)}
                                >
                                  {formatCompactConversationTitle(conversation.title, 28)}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeClass}`}
                                  >
                                    {isRunning ? (
                                      <Loader2
                                        size={10}
                                        strokeWidth={2}
                                        className="animate-spin"
                                      />
                                    ) : effectiveStatusTone === "success" ? (
                                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                                    ) : null}
                                    {displayStatusLabel}
                                  </span>
                                  {conversation.pinned ? (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                      <Pin size={10} strokeWidth={2} />
                                      置顶
                                    </span>
                                  ) : null}
                                  {conversation.parentConversationId ? (
                                    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200/80 bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                      <GitBranch size={10} strokeWidth={2} />
                                      <span className="truncate max-w-[180px]">
                                        来自 {conversation.parentConversationTitle || "源对话"}
                                      </span>
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">
                                  {preview.text ||
                                    displayStatusDetail ||
                                    (hasDraft ? "有未发送草稿" : "暂无消息预览")}
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] leading-4 text-slate-400">
                                  <span>{formatConversationTime(conversation.updatedAt)}</span>
                                  <span>路</span>
                                  <span>{formatMessageCount(messageCount)}</span>
                                  {isDraftPreview ? (
                                    <>
                                      <span>路</span>
                                      <span>草稿预览</span>
                                    </>
                                  ) : null}
                                </div>
                              </div>

                              <AssistantSidebarConversationActions
                                archivedView={showArchived}
                                isPinned={conversation.pinned === true}
                                conversationTitle={conversation.title}
                                compact
                                alwaysVisible
                                onPin={() => onToggleConversationPinned(conversation.id)}
                                onRename={() => startRename(conversation)}
                                onArchive={() =>
                                  onToggleConversationArchived(conversation.id)
                                }
                                onDelete={() => onDeleteConversation(conversation.id)}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-white/70 px-6 text-center shadow-[0_18px_34px_-28px_rgba(15,23,42,0.12)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-white text-slate-400 shadow-[0_10px_18px_-16px_rgba(15,23,42,0.14)]">
              {showArchived ? (
                <Archive size={18} strokeWidth={1.8} />
              ) : hasSearch ? (
                <Search size={18} strokeWidth={1.8} />
              ) : (
                <MessageSquare size={18} strokeWidth={1.8} />
              )}
            </div>
            <div className="mt-4 text-[14px] font-semibold text-slate-800">
              {emptyTitle}
            </div>
            <div className="mt-2 max-w-[240px] text-[12px] leading-5 text-slate-500">
              {emptyDescription}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={onCreateConversation}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-700 shadow-[0_10px_18px_-16px_rgba(15,23,42,0.12)] transition hover:border-slate-300 hover:bg-slate-50"
              >
                <CirclePlus size={14} strokeWidth={1.8} />
                <span>{NEW_CONVERSATION_DISPLAY_TITLE}</span>
              </button>
              {hasSearch ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-700 shadow-[0_10px_18px_-16px_rgba(15,23,42,0.12)] transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <X size={14} strokeWidth={1.8} />
                  <span>清空搜索</span>
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
