import { useState } from 'react';
import { useAgentStore } from '../../../stores/agent.store';

const TASK_STATUS_LABELS: Record<string, string> = {
  analyzing: 'Agent 正在理解你的请求...',
  executing: 'Agent 正在处理当前任务...',
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
