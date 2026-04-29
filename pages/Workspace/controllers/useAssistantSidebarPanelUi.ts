import { useState } from 'react';
import { useAgentStore } from '../../../stores/agent.store';

const TASK_STATUS_LABELS: Record<string, string> = {
  analyzing: 'AI 正在深度分析中...',
  executing: '正在生成设计中...',
};

export const useAssistantSidebarPanelUi = () => {
  const currentTask = useAgentStore((state) => state.currentTask);
  const [showHistoryPopover, setShowHistoryPopover] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [showFileListModal, setShowFileListModal] = useState(false);

  return {
    currentTask,
    currentTaskLabel: currentTask?.status
      ? TASK_STATUS_LABELS[currentTask.status] || null
      : null,
    showHistoryPopover,
    historySearch,
    showFileListModal,
    setHistorySearch,
    toggleHistoryPopover: () =>
      setShowHistoryPopover((previous) => !previous),
    closeHistoryPopover: () => setShowHistoryPopover(false),
    toggleFileListModal: () =>
      setShowFileListModal((previous) => !previous),
  };
};
