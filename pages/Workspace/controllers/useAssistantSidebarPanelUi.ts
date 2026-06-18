import { useMemo, useState } from 'react';
import { useAgentStore } from '../../../stores/agent.store';
import type { ConversationSession } from "../../../types";

const TASK_STATUS_LABELS: Record<string, string> = {
  analyzing: '正在理解你的请求并整理上下文...',
  executing: '正在执行当前任务...',
  completed: '本轮任务已完成',
  failed: '本轮任务未完成',
};

type UseAssistantSidebarPanelUiArgs = {
  activeConversation?: ConversationSession | null;
  currentTaskConversationId?: string | null;
  currentTaskVisible?: boolean;
  isTyping?: boolean;
  isBrowserConversationBusy?: boolean;
  browserStepTitle?: string | null;
};

export const useAssistantSidebarPanelUi = ({
  activeConversation = null,
  currentTaskConversationId = null,
  currentTaskVisible = false,
  isTyping = false,
  isBrowserConversationBusy = false,
  browserStepTitle = null,
}: UseAssistantSidebarPanelUiArgs = {}) => {
  const currentTask = useAgentStore((state) => state.currentTask);
  const [activePanel, setActivePanel] = useState<"history" | "files" | null>(
    null,
  );
  const [historySearch, setHistorySearch] = useState('');
  const showHistoryPopover = activePanel === "history";
  const showFileListModal = activePanel === "files";
  const hasDraft = Boolean(
    activeConversation?.draft?.inputBlocks?.some((block) =>
      block.type === "text"
        ? Boolean(String(block.text || "").trim())
        : Boolean(block.file),
    ),
  );
  const shouldShowTaskLabel = currentTaskVisible;
  const currentTaskLabel = useMemo(() => {
    if (isBrowserConversationBusy && browserStepTitle) {
      return browserStepTitle;
    }
    if (isBrowserConversationBusy) {
      return "当前对话仍在执行...";
    }
    if (shouldShowTaskLabel && currentTask?.status && isTyping) {
      return TASK_STATUS_LABELS[currentTask.status] || null;
    }
    if (shouldShowTaskLabel && isTyping) {
      return "正在准备本轮回复...";
    }
    if (hasDraft) {
      return "已保存当前对话草稿";
    }
    return null;
  }, [
    browserStepTitle,
    currentTask?.status,
    hasDraft,
    isBrowserConversationBusy,
    isTyping,
    shouldShowTaskLabel,
  ]);

  return {
    currentTask,
    currentTaskLabel,
    showHistoryPopover,
    historySearch,
    showFileListModal,
    setHistorySearch,
    toggleHistoryPopover: () =>
      setActivePanel((previous) =>
        previous === "history" ? null : "history",
      ),
    closeHistoryPopover: () =>
      setActivePanel((previous) =>
        previous === "history" ? null : previous,
      ),
    toggleFileListModal: () =>
      setActivePanel((previous) => (previous === "files" ? null : "files")),
  };
};
