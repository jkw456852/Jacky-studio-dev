import { DEFAULT_CONVERSATION_TITLE } from "../conversationMeta";

export const NEW_CONVERSATION_DISPLAY_TITLE = "新对话";

const LEGACY_DEFAULT_CONVERSATION_TITLES = new Set([
  DEFAULT_CONVERSATION_TITLE,
  "New chat",
]);

const STATUS_LABELS_ZH: Record<string, string> = {
  Empty: "空白",
  Draft: "草稿",
  Running: "运行中",
  "Needs input": "等待输入",
  Stopped: "已停止",
  Failed: "失败",
  Completed: "已完成",
  Idle: "空闲",
};

const STATUS_DETAILS_ZH: Record<string, string> = {
  "Unsent draft in progress": "有未发送草稿",
  "No assistant reply yet": "还没有助手回复",
  "Current chat is still running": "当前对话仍在运行",
  "Waiting for your next instruction": "等待你继续",
  "Stopped and kept for follow-up": "已停止，本次上下文已保留",
  "Latest reply ended with an error": "最近一条回复执行失败",
  "Latest run finished successfully": "最近一次运行已完成",
  "Ready to continue": "可以继续下一步",
};

const HISTORY_GROUP_LABELS_ZH: Record<string, string> = {
  Pinned: "置顶",
  Today: "今天",
  Yesterday: "昨天",
  "Last 7 days": "近 7 天",
  "Last 30 days": "近 30 天",
  Older: "更早",
};

export const formatConversationTitle = (value: string) => {
  const normalized = String(value || "").trim();
  if (!normalized || LEGACY_DEFAULT_CONVERSATION_TITLES.has(normalized)) {
    return NEW_CONVERSATION_DISPLAY_TITLE;
  }
  return normalized;
};

export const formatCompactConversationTitle = (
  value: string,
  maxLength: number = 26,
) => {
  const displayTitle = formatConversationTitle(value);
  const normalized = String(displayTitle || "").trim();
  if (!normalized || normalized.length <= maxLength) {
    return displayTitle;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

export const formatStatusLabel = (value: string | null | undefined) => {
  if (!value) return null;
  return STATUS_LABELS_ZH[value] || value;
};

export const formatStatusDetail = (value: string | null | undefined) => {
  if (!value) return null;
  return STATUS_DETAILS_ZH[value] || value;
};

export const formatHistoryGroupLabel = (value: string) =>
  HISTORY_GROUP_LABELS_ZH[value] || value;

export const formatChatCount = (count: number) => `${count} 个对话`;

export const formatMessageCount = (count: number) => `${count} 条消息`;
