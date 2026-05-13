import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { ChatMessage } from "../../../types";
import type { AgentType } from "../../../types/agent.types";
import { getAgentInfo } from "../../../services/agents";
import { getStudioUserAssetApi } from "../../../services/runtime-assets/api";
import { AgentMessage } from "./AgentMessage";
import { useAgentStore } from "../../../stores/agent.store";
import { TaskProgress } from "../../../components/agents/TaskProgress";
import { MessageAttachments } from "./MessageAttachments";
import { UserMessageInlineContent } from "./UserMessageInlineContent";
import { isEcommerceWorkflowChatMessage } from "./workflow/ecommerceWorkflowUi";
import type {
  AgentMessageClothingActionsProps,
  AgentMessageEcommerceActionsProps,
} from "./AgentMessage";

interface MessageListProps {
  onSend: (text: string) => void;
  onSmartGenerate: (prompt: string, proposalId?: string) => void;
  onPreview: (url: string) => void;
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
  clothingActions,
  ecommerceActions,
}) => {
  const messages = useAgentStore((s) => s.messages);
  // 渲染前去重，防止 store 里意外出现同 id 消息导致 React key 冲突
  const dedupedMessages = React.useMemo(() => {
    const seen = new Set<string>();
    return messages.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
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
  const isTyping = useAgentStore((s) => s.isTyping);
  const currentTask = useAgentStore((s) => s.currentTask);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const shouldShowUserSkillBadge = (msg: ChatMessage) =>
    Boolean(
      msg.skillData &&
        msg.skillData.id !== "autonomous-main-brain" &&
        msg.skillData.name !== "自主主脑路由",
    );
  const userProfileAvatarUrl = React.useMemo(
    () => getStudioUserAssetApi().getUserProfile().avatarUrl || "",
    [],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages, currentTask?.progressMessage]);

  return (
    <div className="space-y-4 pb-4 px-2 md:px-3">
      {visibleMessages.map((msg) => {
        const modelId = String(msg.agentData?.model || "").trim().toLowerCase();
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

        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "user" ? (
              <div className="ml-auto flex w-fit max-w-[92%] items-end gap-3">
                {shouldShowUserSkillBadge(msg) ? (
                  <div className="inline-flex w-auto max-w-[min(100%,560px)] flex-none flex-col gap-2 overflow-hidden rounded-[24px] rounded-br-md border border-gray-200 bg-white px-4 py-3 text-[13px] text-gray-800 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        {msg.skillData?.name || "快捷操作"}
                      </span>
                    </div>
                    {msg.inlineParts && msg.inlineParts.length > 0 ? (
                      <UserMessageInlineContent
                        inlineParts={msg.inlineParts}
                        onPreview={onPreview}
                        textClassName="text-[13px] text-gray-700"
                      />
                    ) : (
                      <>
                        <MessageAttachments
                          attachments={msg.attachments}
                          attachmentMetadata={msg.attachmentMetadata}
                          onPreview={onPreview}
                        />
                        <div
                          className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap break-words"
                          title={msg.text}
                        >
                          {msg.text}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="inline-flex w-auto max-w-[min(100%,560px)] flex-none flex-col gap-2 overflow-hidden rounded-[24px] rounded-br-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
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
                        <div className="text-[14px] text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                          {msg.text}
                        </div>
                      </>
                    )}
                  </div>
                )}
                {userAvatarNode}
              </div>
            ) : msg.error ? (
              <div className="flex w-fit max-w-[92%] items-start gap-3">
                {agentAvatarNode}
                <div className="inline-flex w-auto max-w-[min(100%,560px)] flex-none rounded-[24px] rounded-tl-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 whitespace-pre-wrap break-words shadow-sm">
                  {msg.text}
                </div>
              </div>
            ) : (
              <div className="flex w-fit max-w-[92%] items-start gap-3">
                {agentAvatarNode}
                <div className="min-w-0 w-auto max-w-[min(100%,560px)]">
                  <AgentMessage
                    message={msg}
                    onPreview={onPreview}
                    onAction={onSend}
                    onSmartGenerate={onSmartGenerate}
                    clothingActions={clothingActions}
                    ecommerceActions={ecommerceActions}
                  />
                </div>
              </div>
            )}
          </motion.div>
        );
      })}
      {isTyping && (
        <div className="mb-6 mt-2 ml-1 flex justify-start">
          <div className="flex w-fit max-w-[92%] items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-sky-100 bg-[#e8f3ff] text-slate-700 shadow-sm">
              <Sparkles size={17} className="animate-pulse text-sky-600" />
            </div>
            <div className="inline-flex w-auto max-w-[min(100%,560px)] items-center gap-2.5 rounded-[24px] rounded-tl-md border border-sky-100 bg-[#eef6ff] px-4 py-3 text-[13px] text-slate-600 shadow-sm">
              <span className="font-medium">我先整理一下你的要求</span>
            </div>
          </div>
        </div>
      )}
      {currentTask &&
        (currentTask.status === "analyzing" ||
          currentTask.status === "executing") && (
          <TaskProgress task={currentTask} />
        )}
      {/* 完成/失败后保留执行记录折叠入口 */}
      {currentTask &&
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
