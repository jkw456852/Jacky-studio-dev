import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Sparkles } from "lucide-react";
import { ChatMessage } from "../../../types";
import type { AgentTask, AgentType } from "../../../types/agent.types";
import { getAgentInfo } from "../../../services/agents";
import { getStudioUserAssetApi } from "../../../services/runtime-assets/api";
import { AgentMessage } from "./AgentMessage";
import { useAgentStore } from "../../../stores/agent.store";
import { TaskProgress } from "../../../components/agents/TaskProgress";
import { MessageAttachments } from "./MessageAttachments";
import { UserMessageInlineContent } from "./UserMessageInlineContent";
import { isEcommerceWorkflowChatMessage } from "./workflow/ecommerceWorkflowUi";
import {
  collectMessageVersionSiblings,
  getMessageVersionLabel,
  getMessageVersionSourceLabel,
} from "../conversationMeta";
import type {
  AgentMessageClothingActionsProps,
  AgentMessageEcommerceActionsProps,
} from "./AgentMessage";

interface MessageListProps {
  onSend: (text: string) => void;
  onSmartGenerate: (prompt: string, proposalId?: string) => void;
  onPreview: (url: string) => void;
  onFeedback?: (
    message: ChatMessage,
    feedback: ChatMessage["feedback"],
  ) => void | Promise<void>;
  onBranchConversation?: (message: ChatMessage) => void | Promise<void>;
  onReuseToComposer?: (message: ChatMessage) => void | Promise<void>;
  onResendMessage?: (message: ChatMessage) => void | Promise<void>;
  onRetryAssistantResponse?: (message: ChatMessage) => void | Promise<void>;
  onEditAndResendMessage?: (
    message: ChatMessage,
    nextText: string,
  ) => void | Promise<void>;
  isTyping?: boolean;
  currentTask?: AgentTask | null;
  showCurrentTaskProgress?: boolean;
  clothingActions?: AgentMessageClothingActionsProps;
  ecommerceActions?: AgentMessageEcommerceActionsProps;
}

const KNOWN_AGENT_IDS = new Set<AgentType>([
  "coco",
  "vireo",
  "cameron",
  "poster",
  "package",
  "motion",
  "campaign",
  "prompt-optimizer",
]);

export const MessageList: React.FC<MessageListProps> = ({
  onSend,
  onSmartGenerate,
  onPreview,
  onFeedback,
  onBranchConversation,
  onReuseToComposer,
  onResendMessage,
  onRetryAssistantResponse,
  onEditAndResendMessage,
  isTyping = false,
  currentTask = null,
  showCurrentTaskProgress = true,
  clothingActions,
  ecommerceActions,
}) => {
  const messages = useAgentStore((s) => s.messages);
  // 渲染前去重，防止 store 里意外出现同 id 消息导致 React key 冲突
  const dedupedMessages = React.useMemo(() => {
    const seen = new Set<string>();
    return messages.filter((message) => {
      if (seen.has(message.id)) return false;
      seen.add(message.id);
      return true;
    });
  }, [messages]);
  const visibleMessages = React.useMemo(
    () =>
      dedupedMessages.filter(
        (message) => !isEcommerceWorkflowChatMessage(message),
      ),
    [dedupedMessages],
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(
    null,
  );
  const [editingText, setEditingText] = React.useState("");
  const [isSubmittingEdit, setIsSubmittingEdit] = React.useState(false);
  const [copiedUserMessageId, setCopiedUserMessageId] = React.useState<
    string | null
  >(null);
  const isCurrentTaskRunning = Boolean(
    currentTask &&
      (currentTask.status === "analyzing" || currentTask.status === "executing"),
  );
  const liveTaskMessage = React.useMemo<ChatMessage | null>(() => {
    if (!showCurrentTaskProgress || !currentTask || !isCurrentTaskRunning) {
      return null;
    }

    return {
      id: `live-task-${currentTask.id}`,
      role: "model",
      text:
        String(currentTask.streamingText || "").trim() ||
        String(currentTask.progressMessage || "").trim() ||
        "",
      timestamp: currentTask.updatedAt || currentTask.createdAt || Date.now(),
      error: false,
      agentData: {
        model: currentTask.agentId,
        executionTrace: {
          status:
            currentTask.status === "analyzing" ? "analyzing" : "executing",
          progressMessage: currentTask.progressMessage,
          progressStep: currentTask.progressStep,
          totalSteps: currentTask.totalSteps,
          progressLog: currentTask.progressLog,
          streamingText: currentTask.streamingText,
          reasoningText: currentTask.reasoningText,
        },
      },
    };
  }, [currentTask, isCurrentTaskRunning, showCurrentTaskProgress]);

  const shouldShowUserSkillBadge = (message: ChatMessage) =>
    Boolean(
      message.skillData &&
        message.skillData.id !== "autonomous-main-brain" &&
        message.skillData.name !== "自主 Agent 路由",
    );
  const userProfileAvatarUrl = React.useMemo(
    () => getStudioUserAssetApi().getUserProfile().avatarUrl || "",
    [],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages, currentTask?.progressMessage]);

  useEffect(() => {
    if (
      editingMessageId &&
      !visibleMessages.some((message) => message.id === editingMessageId)
    ) {
      setEditingMessageId(null);
      setEditingText("");
      setIsSubmittingEdit(false);
    }
  }, [editingMessageId, visibleMessages]);

  const startEditingMessage = React.useCallback((message: ChatMessage) => {
    setEditingMessageId(message.id);
    setEditingText(String(message.text || ""));
  }, []);

  const cancelEditingMessage = React.useCallback(() => {
    setEditingMessageId(null);
    setEditingText("");
    setIsSubmittingEdit(false);
  }, []);

  const submitEditedMessage = React.useCallback(
    async (message: ChatMessage) => {
      if (!onEditAndResendMessage || isSubmittingEdit) return;
      setIsSubmittingEdit(true);
      try {
        await onEditAndResendMessage(message, editingText);
        setEditingMessageId(null);
        setEditingText("");
      } finally {
        setIsSubmittingEdit(false);
      }
    },
    [editingText, isSubmittingEdit, onEditAndResendMessage],
  );

  const scrollToMessage = React.useCallback(
    (messageId: string | null | undefined) => {
      const normalizedMessageId = String(messageId || "").trim();
      if (!normalizedMessageId) return;
      document
        .getElementById(`chat-message-${normalizedMessageId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [],
  );

  const copyUserMessage = React.useCallback(async (message: ChatMessage) => {
    const text = String(message.text || "").trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUserMessageId(message.id);
      window.setTimeout(() => {
        setCopiedUserMessageId((current) =>
          current === message.id ? null : current,
        );
      }, 1600);
    } catch (error) {
      console.warn("[assistant-sidebar] copy user message failed", error);
    }
  }, []);

  return (
    <div className="space-y-3 px-2 pb-4 md:px-3">
      {visibleMessages.map((msg) => {
        const isEditingThisMessage = editingMessageId === msg.id;
        const hasMessageAttachments =
          Array.isArray(msg.attachments) && msg.attachments.length > 0;
        const modelId = String(msg.agentData?.model || "").trim().toLowerCase();
        const executionTrace = msg.agentData?.executionTrace;
        const isStoppedMessage =
          executionTrace?.errorCode === "USER_CANCELLED" ||
          executionTrace?.stopReasonLabel === "need-user-input";
        const shouldRenderAsAgentCard = !msg.error || Boolean(executionTrace);
        const versionSiblings = collectMessageVersionSiblings(visibleMessages, msg);
        const activeVersionIndex = versionSiblings.findIndex(
          (item) => item.id === msg.id,
        );
        const previousVersion =
          activeVersionIndex > 0 ? versionSiblings[activeVersionIndex - 1] : null;
        const nextVersion =
          activeVersionIndex >= 0 && activeVersionIndex < versionSiblings.length - 1
            ? versionSiblings[activeVersionIndex + 1]
            : null;
        const versionLabel = getMessageVersionLabel(msg);
        const versionSourceLabel = getMessageVersionSourceLabel(msg.lineage);
        const agentInfo = KNOWN_AGENT_IDS.has(modelId as AgentType)
          ? getAgentInfo(modelId as AgentType)
          : null;

        const userAvatarNode = (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white text-[14px] font-semibold leading-none text-slate-700 shadow-sm">
            {userProfileAvatarUrl ? (
              <img
                src={userProfileAvatarUrl}
                alt="用户头像"
                className="h-full w-full object-cover"
              />
            ) : (
              <span>我</span>
            )}
          </div>
        );

        const agentAvatarNode = (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-sky-100 bg-[#e8f3ff] text-slate-700 shadow-sm">
            {agentInfo ? (
              <span className="text-[20px] leading-none">{agentInfo.avatar}</span>
            ) : (
              <Sparkles size={17} className="text-sky-600" />
            )}
          </div>
        );

        const userLineageNode =
          versionLabel || versionSourceLabel || versionSiblings.length > 1 ? (
            <div className="mt-2 flex flex-wrap items-center justify-end gap-2 px-0.5 text-[11px]">
              {versionLabel ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-medium text-slate-600">
                  {versionLabel}
                </span>
              ) : null}
              {versionSourceLabel ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 font-medium text-amber-700">
                  {versionSourceLabel}
                </span>
              ) : null}
              {versionSiblings.length > 1 ? (
                <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1 py-1 text-slate-500">
                  <button
                    type="button"
                    onClick={() => scrollToMessage(previousVersion?.id)}
                    disabled={!previousVersion}
                    className="rounded-full px-2 py-0.5 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    上一版
                  </button>
                  <span className="px-1 text-[10px] text-slate-400">
                    {activeVersionIndex + 1}/{versionSiblings.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => scrollToMessage(nextVersion?.id)}
                    disabled={!nextVersion}
                    className="rounded-full px-2 py-0.5 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    下一版
                  </button>
                </div>
              ) : null}
            </div>
          ) : null;

        const userActionNode = isEditingThisMessage ? (
          <div className="mt-3 space-y-3 px-0.5">
            <textarea
              value={editingText}
              onChange={(event) => setEditingText(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  void submitEditedMessage(msg);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelEditingMessage();
                }
              }}
              rows={4}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] leading-6 text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              placeholder="修改后直接重发这条消息"
              autoFocus
            />
            {hasMessageAttachments ? (
              <div className="text-[11px] text-slate-500">
                这条消息已带附件，保存后会一并重发。
              </div>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={cancelEditingMessage}
                disabled={isSubmittingEdit}
                className="inline-flex h-8 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void submitEditedMessage(msg)}
                disabled={
                  isSubmittingEdit ||
                  (editingText.trim().length === 0 && !hasMessageAttachments)
                }
                className="inline-flex h-8 items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-3 text-[11px] font-medium text-blue-700 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmittingEdit ? "发送中..." : "保存并重发"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap justify-end gap-1.5 px-0.5 text-slate-500">
            <button
              type="button"
              onClick={() => void copyUserMessage(msg)}
              disabled={!String(msg.text || "").trim()}
              className="inline-flex h-7 items-center justify-center gap-1.5 rounded-full px-2 text-[10px] font-medium transition-colors hover:bg-white/80 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              title={copiedUserMessageId === msg.id ? "已复制" : "复制消息"}
            >
              {copiedUserMessageId === msg.id ? (
                <Check size={12} className="text-emerald-500" />
              ) : (
                <Copy size={12} />
              )}
              <span>{copiedUserMessageId === msg.id ? "已复制" : "复制"}</span>
            </button>
            {onEditAndResendMessage ? (
              <button
                type="button"
                onClick={() => startEditingMessage(msg)}
                className="inline-flex h-7 items-center justify-center rounded-full px-2 text-[10px] font-medium transition-colors hover:bg-white/80 hover:text-slate-900"
                title="编辑这条消息后直接重发"
              >
                编辑
              </button>
            ) : null}
            {onResendMessage ? (
              <button
                type="button"
                onClick={() => void onResendMessage(msg)}
                className="inline-flex h-7 items-center justify-center rounded-full px-2 text-[10px] font-medium transition-colors hover:bg-white/80 hover:text-slate-900"
                title="重新发送这一条消息"
              >
                重发
              </button>
            ) : null}
            {onReuseToComposer ? (
              <button
                type="button"
                onClick={() => void onReuseToComposer(msg)}
                className="inline-flex h-7 items-center justify-center rounded-full px-2 text-[10px] font-medium transition-colors hover:bg-white/80 hover:text-slate-900"
                title="回填到输入框继续编辑"
              >
                回填到输入框
              </button>
            ) : null}
          </div>
        );

        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={msg.id}
            id={`chat-message-${msg.id}`}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "user" ? (
              <div className="ml-auto flex w-full items-end justify-end gap-2.5 pl-10">
                {shouldShowUserSkillBadge(msg) ? (
                  <div className="inline-flex w-auto max-w-[min(calc(100%-56px),520px)] min-w-0 flex-none flex-col gap-1.5 overflow-hidden rounded-[22px] rounded-br-md border border-slate-200/90 bg-white px-3.5 py-2.5 text-[12.5px] text-gray-800 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.12)]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        {msg.skillData?.name || "快捷操作"}
                      </span>
                    </div>
                    {msg.inlineParts && msg.inlineParts.length > 0 ? (
                      <UserMessageInlineContent
                        inlineParts={msg.inlineParts}
                        onPreview={onPreview}
                        textClassName="text-[12.5px] text-gray-700"
                      />
                    ) : (
                      <>
                        <MessageAttachments
                          attachments={msg.attachments}
                          attachmentMetadata={msg.attachmentMetadata}
                          onPreview={onPreview}
                        />
                        <div
                          className="whitespace-pre-wrap break-words text-[12.5px] leading-[1.7] text-gray-700"
                          title={msg.text}
                        >
                          {msg.text}
                        </div>
                      </>
                    )}
                    {userLineageNode}
                    {userActionNode}
                  </div>
                ) : (
                  <div className="inline-flex w-auto max-w-[min(calc(100%-56px),520px)] min-w-0 flex-none flex-col gap-1.5 overflow-hidden rounded-[22px] rounded-br-md border border-slate-200/90 bg-white px-3.5 py-2.5 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.12)]">
                    {msg.inlineParts && msg.inlineParts.length > 0 ? (
                      <UserMessageInlineContent
                        inlineParts={msg.inlineParts}
                        onPreview={onPreview}
                      />
                    ) : (
                      <>
                        <MessageAttachments
                          attachments={msg.attachments}
                          attachmentMetadata={msg.attachmentMetadata}
                          onPreview={onPreview}
                        />
                        <div className="whitespace-pre-wrap break-words text-[13px] leading-[1.72] text-gray-800">
                          {msg.text}
                        </div>
                      </>
                    )}
                    {userLineageNode}
                    {userActionNode}
                  </div>
                )}
                {userAvatarNode}
              </div>
            ) : msg.error && !shouldRenderAsAgentCard ? (
              <div className="flex w-fit max-w-[92%] items-start gap-2.5">
                {agentAvatarNode}
                <div className="min-w-0 w-auto max-w-[min(100%,560px)]">
                  <div className="w-auto max-w-[min(100%,520px)] rounded-[22px] rounded-tl-md border border-rose-200 bg-rose-50/90 px-3.5 py-2.5 text-[12.5px] text-rose-800 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.12)]">
                    <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                      回复失败
                    </div>
                    <div className="whitespace-pre-wrap break-words leading-6">
                      {msg.text}
                    </div>
                  </div>
                  {onRetryAssistantResponse ? (
                    <div className="mt-2 flex items-center gap-2 px-1 text-gray-300">
                      <button
                        type="button"
                        onClick={() => void onRetryAssistantResponse(msg)}
                        className="inline-flex h-8 items-center justify-center rounded-full border border-rose-200 bg-white px-3 text-[11px] font-semibold text-rose-600 shadow-sm transition-colors hover:border-rose-300 hover:bg-rose-50"
                        title="重新尝试这条回复"
                      >
                        重试
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex w-fit max-w-[92%] items-start gap-2.5">
                {agentAvatarNode}
                <div className="min-w-0 w-auto max-w-[min(100%,520px)]">
                  <AgentMessage
                    message={msg}
                    versionSiblings={versionSiblings}
                    activeVersionIndex={activeVersionIndex}
                    onPreview={onPreview}
                    onAction={onSend}
                    onSmartGenerate={onSmartGenerate}
                    onFeedback={onFeedback}
                    onBranchConversation={onBranchConversation}
                    onReuseToComposer={onReuseToComposer}
                    onRetryResponse={onRetryAssistantResponse}
                    clothingActions={clothingActions}
                    ecommerceActions={ecommerceActions}
                  />
                  {!msg.agentData?.browserSession &&
                  executionTrace &&
                  executionTrace.status !== "analyzing" &&
                  executionTrace.status !== "executing" ? (
                    <div className="mt-2 px-1">
                      <TaskProgress trace={executionTrace} />
                    </div>
                  ) : null}
                  {isStoppedMessage ? (
                    <div className="mt-2 px-1">
                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-medium text-slate-500 shadow-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        <span>已停止，本次上下文已保留</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </motion.div>
        );
      })}

      {liveTaskMessage ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 mt-1.5 ml-1 flex justify-start"
        >
          <div className="flex w-fit max-w-[92%] items-start gap-2.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-sky-100 bg-[#e8f3ff] text-slate-700 shadow-sm">
              {KNOWN_AGENT_IDS.has(
                String(liveTaskMessage.agentData?.model || "").trim().toLowerCase() as AgentType,
              ) ? (
                <span className="text-[20px] leading-none">
                  {getAgentInfo(
                    String(liveTaskMessage.agentData?.model || "").trim().toLowerCase() as AgentType,
                  ).avatar}
                </span>
              ) : (
                <Sparkles size={17} className="animate-pulse text-sky-600" />
              )}
            </div>
            <div className="min-w-0 w-auto max-w-[min(100%,520px)]">
              <AgentMessage
                message={liveTaskMessage}
                onPreview={onPreview}
                onAction={onSend}
                onSmartGenerate={onSmartGenerate}
                onFeedback={onFeedback}
                onBranchConversation={onBranchConversation}
                onReuseToComposer={onReuseToComposer}
                onRetryResponse={onRetryAssistantResponse}
                clothingActions={clothingActions}
                ecommerceActions={ecommerceActions}
              />
            </div>
          </div>
        </motion.div>
      ) : null}

      {isTyping && showCurrentTaskProgress && !liveTaskMessage && (
        <div className="mb-5 mt-1.5 ml-1 flex justify-start">
          <div className="flex w-fit max-w-[92%] items-start gap-2.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-sky-100 bg-[#e8f3ff] text-slate-700 shadow-sm">
              <Sparkles size={17} className="animate-pulse text-sky-600" />
            </div>
            <div className="inline-flex w-auto max-w-[min(100%,520px)] items-center gap-3 rounded-[22px] rounded-tl-md border border-sky-100 bg-[#eef6ff] px-3.5 py-2.5 text-[12.5px] text-slate-600 shadow-sm">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400 [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-300 [animation-delay:240ms]" />
              </span>
              <span className="font-medium">我先整理一下你的要求</span>
            </div>
          </div>
        </div>
      )}

      {showCurrentTaskProgress &&
        currentTask &&
        !liveTaskMessage &&
        (currentTask.status === "analyzing" ||
          currentTask.status === "executing") && (
          <TaskProgress task={currentTask} className="ml-1" />
        )}

      {/* 完成或失败后保留执行记录折叠入口 */}
      {showCurrentTaskProgress &&
        currentTask &&
        (currentTask.status === "completed" ||
          currentTask.status === "failed") &&
        (currentTask.progressLog?.length ?? 0) > 0 && (
          <div className="ml-1">
            <TaskProgress task={currentTask} />
          </div>
        )}

      <div ref={messagesEndRef} />
    </div>
  );
};
