import React from "react";
import {
  Archive,
  Check,
  CirclePlus,
  Clock,
  GitBranch,
  Loader2,
  MessageSquare,
  Pin,
  Search,
  X,
} from "lucide-react";
import type { ChatMessage, ConversationSession } from "../../../types";
import {
  deriveConversationSidebarPreview,
  deriveConversationStatusSummary,
  groupConversationsForSidebar,
  getConversationMessageCount,
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

type AssistantSidebarHistoryPopoverProps = {
  open: boolean;
  historySearch: string;
  setHistorySearch: React.Dispatch<React.SetStateAction<string>>;
  conversations: ConversationSession[];
  activeConversationId: string;
  activeConversationRunning?: boolean;
  onToggle: () => void;
  onCreateConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, title: string) => void;
  onToggleConversationPinned: (conversationId: string) => void;
  onToggleConversationArchived: (conversationId: string) => void;
  onContinueConversation?: (conversationId: string) => void;
  onRestoreConversationInput?: (
    conversationId: string,
    message?: ChatMessage | null,
  ) => void;
  inlinePanel?: boolean;
  triggerOnly?: boolean;
};

const formatConversationTime = (updatedAt: number) =>
  new Date(updatedAt).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const resolveLatestRecoverableUserMessage = (
  conversation: ConversationSession,
): ChatMessage | null => {
  const messages = Array.isArray(conversation.messages)
    ? conversation.messages
    : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "model") continue;

    const executionTrace = message.agentData?.executionTrace;
    const isRecoverableFailure =
      Boolean(message.error) ||
      executionTrace?.status === "failed" ||
      String(executionTrace?.errorCode || "").trim() === "LOAD_INTERRUPTED";
    if (!isRecoverableFailure) continue;

    const relatedUserMessageId = String(message.responseToMessageId || "").trim();
    if (relatedUserMessageId) {
      const matched = messages.find(
        (item) => item.role === "user" && item.id === relatedUserMessageId,
      );
      if (matched) return matched;
    }

    for (let userIndex = index - 1; userIndex >= 0; userIndex -= 1) {
      if (messages[userIndex]?.role === "user") {
        return messages[userIndex];
      }
    }
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      return messages[index];
    }
  }
  return null;
};

export const AssistantSidebarHistoryPopover: React.FC<
  AssistantSidebarHistoryPopoverProps
> = ({
  open,
  historySearch,
  setHistorySearch,
  conversations,
  activeConversationId,
  activeConversationRunning = false,
  onToggle,
  onCreateConversation,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onToggleConversationPinned,
  onToggleConversationArchived,
  onContinueConversation,
  onRestoreConversationInput,
  inlinePanel = false,
  triggerOnly = false,
}) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [editingConversationId, setEditingConversationId] = React.useState<
    string | null
  >(null);
  const [editingTitle, setEditingTitle] = React.useState("");
  const [showArchived, setShowArchived] = React.useState(false);
  const [showNeedsAttentionOnly, setShowNeedsAttentionOnly] = React.useState(false);

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

  const normalizedSearch = historySearch.trim();
  const hasSearch = normalizedSearch.length > 0;

  const filteredConversations = React.useMemo(
    () =>
      conversations.filter(
        (conversation) =>
          isConversationArchived(conversation) === showArchived &&
          (!showNeedsAttentionOnly ||
            ["failed", "running", "needs-input", "stopped"].includes(
              deriveConversationStatusSummary(conversation).kind,
            )) &&
          matchesConversationSearch(conversation, historySearch),
      ),
    [conversations, historySearch, showArchived, showNeedsAttentionOnly],
  );
  const groupedConversations = React.useMemo(
    () => groupConversationsForSidebar(filteredConversations),
    [filteredConversations],
  );

  const currentViewConversationCount = showArchived
    ? archivedConversationCount
    : activeConversationCount;

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
    const normalizedTitle = String(editingTitle || "").trim();
    if (!normalizedTitle) {
      cancelRename();
      return;
    }
    onRenameConversation(editingConversationId, normalizedTitle);
    setEditingConversationId(null);
    setEditingTitle("");
  }, [cancelRename, editingConversationId, editingTitle, onRenameConversation]);

  React.useEffect(() => {
    if (!open) {
      cancelRename();
    }
  }, [cancelRename, open]);

  React.useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (inlinePanel) return;
      const target = event.target;
      if (target instanceof Node && containerRef.current?.contains(target)) {
        return;
      }
      onToggle();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onToggle();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [inlinePanel, onToggle, open]);

  const handleCreateConversation = React.useCallback(() => {
    onCreateConversation();
    onToggle();
  }, [onCreateConversation, onToggle]);

  const handleSelectConversation = React.useCallback(
    (conversationId: string) => {
      onSelectConversation(conversationId);
      onToggle();
    },
    [onSelectConversation, onToggle],
  );

  const clearSearch = React.useCallback(() => {
    setHistorySearch("");
  }, [setHistorySearch]);

  const emptyTitle = showArchived
    ? hasSearch
      ? "没有匹配的归档对话"
      : "还没有归档对话"
    : showNeedsAttentionOnly
      ? "没有待处理的对话"
    : hasSearch
      ? "没有匹配的对话"
      : "还没有对话";
  const emptyDescription = showArchived
    ? hasSearch
      ? "换个关键词试试，或回到活跃对话继续工作。"
      : "归档后的对话会保存在这里，方便之后查阅。"
    : showNeedsAttentionOnly
      ? "当前活跃对话都比较干净，你可以回到全部列表继续浏览。"
    : hasSearch
      ? "清空搜索，或为下一个任务新建对话。"
      : "新建一个对话后，工作区里的聊天记录会显示在这里。";

  return (
    <div ref={containerRef} className={inlinePanel ? "contents" : "relative"}>
      {!inlinePanel ? (
        <button
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 ${
            open
              ? "bg-white text-slate-700 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.95),0_8px_18px_-16px_rgba(15,23,42,0.22)]"
              : "bg-white/66 text-slate-400 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.72)] hover:bg-white hover:text-slate-700"
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          title="打开对话历史"
          aria-label="打开对话历史"
          aria-expanded={open}
        >
          <Clock size={15} strokeWidth={1.8} />
        </button>
      ) : null}

      {open && !triggerOnly ? (
        <div
          data-assistant-inline-panel={inlinePanel ? "history" : undefined}
          className={`overflow-hidden text-left ${
            inlinePanel
              ? "flex h-full flex-col bg-[#f8f9fc]"
              : "absolute right-0 top-full z-[60] mt-2 w-[296px] max-w-[calc(100vw-1rem)] rounded-[20px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.988),rgba(248,249,252,0.97))] shadow-[0_20px_52px_-36px_rgba(15,23,42,0.24)] backdrop-blur-md"
          }`}
        >
          <div
            className={`${
              inlinePanel
                ? "border-b border-slate-200/80 bg-[#f8f9fc] px-4 py-3.5"
                : "border-b border-slate-200/80 px-3 py-2.5"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {!inlinePanel ? (
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold leading-5 text-slate-900">
                      对话历史
                    </div>
                    <div className="mt-1 text-[10.5px] leading-4 text-slate-500">
                      快速切换和整理当前工作区对话
                    </div>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-slate-500">
                      管理工作区对话
                    </div>
                  </div>
                )}

                <div className="mt-2 hidden flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.92)]">
                    <MessageSquare size={10} strokeWidth={2} />
                    <span>
                      {showArchived ? "归档" : "活跃"} {currentViewConversationCount}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.92)]">
                    <Pin size={10} strokeWidth={2} />
                    <span>{pinnedConversationCount} 个置顶</span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.92)]">
                    <Archive size={10} strokeWidth={2} />
                    <span>{archivedConversationCount} 个归档</span>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateConversation}
                className={`inline-flex shrink-0 items-center justify-center transition ${
                  inlinePanel
                    ? "h-9 w-9 rounded-2xl bg-slate-900 text-white shadow-[0_14px_26px_-20px_rgba(15,23,42,0.45)] hover:bg-slate-800"
                    : "h-8 w-8 rounded-full bg-slate-900 text-white shadow-[0_12px_22px_-18px_rgba(15,23,42,0.4)] hover:bg-slate-800"
                }`}
                title={NEW_CONVERSATION_DISPLAY_TITLE}
                aria-label={NEW_CONVERSATION_DISPLAY_TITLE}
              >
                <CirclePlus size={13} strokeWidth={1.8} />
              </button>
            </div>

            <div className="relative mt-2">
              <Search
                size={13}
                strokeWidth={1.8}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="搜索标题或消息内容"
                className="h-9 w-full rounded-full bg-white/88 pl-9 pr-10 text-[12px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:bg-white shadow-[inset_0_0_0_1px_rgba(226,232,240,0.95)]"
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

            <div className="mt-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowArchived(false)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.25 text-[10px] font-semibold transition ${
                  !showArchived
                    ? "bg-slate-900 text-white"
                    : "bg-white/88 text-slate-500 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.92)] hover:bg-white hover:text-slate-800"
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
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.25 text-[10px] font-semibold transition ${
                  showArchived
                    ? "bg-slate-900 text-white"
                    : "bg-white/88 text-slate-500 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.92)] hover:bg-white hover:text-slate-800"
                }`}
              >
                <Archive size={10} strokeWidth={2} />
                <span>归档</span>
                <span className={showArchived ? "text-white/70" : "text-slate-400"}>
                  {archivedConversationCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setShowNeedsAttentionOnly((current) => !current)
                }
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.25 text-[10px] font-semibold transition ${
                  showNeedsAttentionOnly
                    ? "bg-rose-50 text-rose-700 shadow-[inset_0_0_0_1px_rgba(254,205,211,0.95)]"
                    : "bg-white/88 text-slate-500 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.92)] hover:bg-white hover:text-slate-800"
                }`}
              >
                <span>待处理</span>
              </button>
            </div>
          </div>

          <div
              className={`overflow-y-auto px-2.5 py-2.5 custom-scrollbar ${
                inlinePanel ? "min-h-0 flex-1 bg-[#f8f9fc]" : "max-h-[304px]"
              }`}
          >
            {groupedConversations.length > 0 ? (
              <div className="space-y-2">
                {groupedConversations.map((group) => (
                  <section key={group.key} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 px-1">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        {formatHistoryGroupLabel(group.label)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                        {formatChatCount(group.conversations.length)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {group.conversations.map((conversation) => {
                        const isActive = activeConversationId === conversation.id;
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
                        const compactPreviewText =
                          preview.text && effectiveStatusTone === "danger"
                            ? "这轮回复没有成功完成，可点开继续处理。"
                            : preview.text;
                        const previewFallbackText =
                          effectiveStatusTone === "danger"
                            ? "这轮回复没有成功完成，点击查看详情或继续重试。"
                            : displayStatusDetail ||
                              (hasDraft ? "有未发送草稿" : "暂无消息预览");
                        const showContinueAction =
                          Boolean(onContinueConversation) &&
                          ["draft", "needs-input", "stopped"].includes(
                            statusSummary.kind,
                          );
                        const showRestoreInputAction =
                          Boolean(onRestoreConversationInput) &&
                          statusSummary.kind === "failed";
                        const recoverableUserMessage = showRestoreInputAction
                          ? resolveLatestRecoverableUserMessage(conversation)
                          : null;
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
                            role="listitem"
                            onClick={() => {
                              if (!isEditing) handleSelectConversation(conversation.id);
                            }}
                            className={`group relative flex w-full items-start gap-2 rounded-[13px] px-2.5 py-2 text-left transition-all duration-200 outline-none ${
                              isActive
                                ? "bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_14px_28px_-28px_rgba(15,23,42,0.16),inset_0_0_0_1px_rgba(214,228,255,0.96)]"
                                : "bg-white/78 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.78)] hover:bg-white hover:shadow-[0_12px_22px_-28px_rgba(15,23,42,0.1),inset_0_0_0_1px_rgba(203,213,225,0.88)]"
                            }`}
                          >
                            {isActive ? (
                              <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-slate-900/88" />
                            ) : null}
                            <div
                              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${
                                isActive
                                  ? "bg-slate-900 text-white shadow-[0_10px_20px_-16px_rgba(15,23,42,0.55)]"
                                  : "bg-slate-100/90 text-slate-500"
                              }`}
                            >
                              <MessageSquare size={12} strokeWidth={1.8} />
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
                                    className="h-8 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-[12px] font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                  />
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      commitRename();
                                    }}
                                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
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
                                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-slate-700"
                                    aria-label="取消重命名"
                                  >
                                    <X size={13} strokeWidth={2} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-start gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div
                                      role="button"
                                      tabIndex={0}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleSelectConversation(conversation.id);
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          handleSelectConversation(conversation.id);
                                        }
                                      }}
                                      className="block w-full cursor-pointer text-left outline-none"
                                    >
                                      <div
                                        className={`truncate text-[12.5px] font-semibold ${
                                          isActive ? "text-slate-900" : "text-slate-700"
                                        }`}
                                        title={formatConversationTitle(conversation.title)}
                                      >
                                        {formatCompactConversationTitle(
                                          conversation.title,
                                          28,
                                        )}
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
                                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                            <Pin size={10} strokeWidth={2} />
                                            置顶
                                          </span>
                                        ) : null}
                                        {conversation.parentConversationId && !inlinePanel ? (
                                          <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                            <GitBranch size={10} strokeWidth={2} />
                                            <span className="truncate max-w-[160px]">
                                              来自{" "}
                                              {conversation.parentConversationTitle ||
                                                "源对话"}
                                            </span>
                                          </span>
                                        ) : null}
                                      </div>
                                      <div className="mt-1 line-clamp-1 text-[10.5px] leading-4 text-slate-500">
                                        {compactPreviewText || previewFallbackText}
                                      </div>
                                    </div>
                                    {showContinueAction || showRestoreInputAction ? (
                                      <div
                                        className="mt-1.5 flex flex-wrap items-center gap-1.5"
                                        onClick={(event) => event.stopPropagation()}
                                      >
                                        {showContinueAction ? (
                                          <button
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              onContinueConversation?.(conversation.id);
                                            }}
                                            className="inline-flex h-7 items-center justify-center rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                                          >
                                            继续处理
                                          </button>
                                        ) : null}
                                        {showRestoreInputAction ? (
                                          <button
                                            type="button"
                                            data-restore-input-button={conversation.id}
                                            onClick={(event) => {
                                              (
                                                window as typeof window & {
                                                  __restoreButtonHit?: Record<string, unknown>;
                                                }
                                              ).__restoreButtonHit = {
                                                conversationId: conversation.id,
                                                ts: Date.now(),
                                              };
                                              event.preventDefault();
                                              event.stopPropagation();
                                              onRestoreConversationInput?.(
                                                conversation.id,
                                                recoverableUserMessage,
                                              );
                                            }}
                                            className="inline-flex h-7 items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-2.5 text-[10px] font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                                          >
                                            恢复输入
                                          </button>
                                        ) : null}
                                        {showRestoreInputAction ? (
                                          <button
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              onContinueConversation?.(
                                                conversation.id,
                                              );
                                            }}
                                            className="inline-flex h-7 items-center justify-center rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                                          >
                                            打开对话
                                          </button>
                                        ) : null}
                                      </div>
                                    ) : null}
                                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] leading-4 text-slate-400">
                                      <span>{formatConversationTime(conversation.updatedAt)}</span>
                                      <span>·</span>
                                      <span>{formatMessageCount(messageCount)}</span>
                                      {isDraftPreview ? (
                                        <>
                                          <span>·</span>
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
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[24px] bg-white/78 px-6 text-center shadow-[inset_0_0_0_1px_rgba(226,232,240,0.86)]">
                <div className="flex h-11 w-11 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 shadow-sm">
                  {showArchived ? (
                    <Archive size={17} strokeWidth={1.8} />
                  ) : hasSearch ? (
                    <Search size={17} strokeWidth={1.8} />
                  ) : (
                    <MessageSquare size={17} strokeWidth={1.8} />
                  )}
                </div>
                <div className="mt-3.5 text-[13px] font-semibold text-slate-800">
                  {emptyTitle}
                </div>
                <div className="mt-2 max-w-[240px] text-[11px] leading-5 text-slate-500">
                  {emptyDescription}
                </div>
                <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleCreateConversation}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <CirclePlus size={13} strokeWidth={1.8} />
                    <span>{NEW_CONVERSATION_DISPLAY_TITLE}</span>
                  </button>
                  {hasSearch ? (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <X size={13} strokeWidth={1.8} />
                      <span>清空搜索</span>
                    </button>
                  ) : null}
                  {showArchived ? (
                    <button
                      type="button"
                      onClick={() => setShowArchived(false)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-900 px-3.5 text-[11px] font-semibold text-white transition hover:bg-slate-800"
                    >
                      <MessageSquare size={13} strokeWidth={1.8} />
                      <span>查看活跃</span>
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
