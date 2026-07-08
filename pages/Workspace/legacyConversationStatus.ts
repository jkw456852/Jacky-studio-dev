import type { ChatMessage, ConversationSession } from "../../types";
import { hasConversationDraft } from "./conversationMeta.ts";
import { normalizeLegacyAssistantMessageText } from "./legacyAssistantText.ts";

const STOPPED_ERROR_CODES = new Set(["USER_CANCELLED"]);
const FAILED_ERROR_CODES = new Set(["LOAD_INTERRUPTED"]);
const STOPPED_STATUS_LABELS = new Set(["已停止", "Stopped"]);

const normalizeWhitespace = (value: string): string =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeMessageText = (value: string): string =>
  normalizeWhitespace(normalizeLegacyAssistantMessageText(value || ""));

export type ConversationStatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

export type ConversationStatusSummary = {
  kind:
    | "empty"
    | "draft"
    | "running"
    | "needs-input"
    | "stopped"
    | "failed"
    | "completed"
    | "idle";
  label: string;
  detail?: string;
  tone: ConversationStatusTone;
};

const getLastAssistantMessage = (
  conversation: Pick<ConversationSession, "messages">,
): ChatMessage | null => {
  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "model") return messages[index];
  }
  return null;
};

export const deriveConversationStatusSummary = (
  conversation: Pick<ConversationSession, "messages" | "draft">,
): ConversationStatusSummary => {
  if (hasConversationDraft(conversation)) {
    return {
      kind: "draft",
      label: "草稿",
      detail: "还有未发送的内容",
      tone: "success",
    };
  }

  const lastAssistantMessage = getLastAssistantMessage(conversation);
  if (!lastAssistantMessage) {
    return {
      kind: "empty",
      label: "空白",
      detail: "还没有助手回复",
      tone: "neutral",
    };
  }

  const executionTrace = lastAssistantMessage.agentData?.executionTrace;
  const browserSession = lastAssistantMessage.agentData?.browserSession;
  const presentation = lastAssistantMessage.agentData?.presentation;
  const stopReasonLabel = String(executionTrace?.stopReasonLabel || "").trim();
  const errorCode = String(executionTrace?.errorCode || "").trim();
  const statusLabel =
    String(
      presentation?.statusLabel ||
        browserSession?.statusLabel ||
        browserSession?.status ||
        "",
    ).trim() || undefined;
  const normalizedStatusLabel = normalizeWhitespace(statusLabel || "");
  const detail =
    String(
      browserSession?.summary ||
        lastAssistantMessage.agentData?.postGenerationSummary ||
        lastAssistantMessage.agentData?.description ||
        "",
    ).trim() || undefined;

  if (
    lastAssistantMessage.agentData?.isGenerating ||
    executionTrace?.status === "analyzing" ||
    executionTrace?.status === "executing" ||
    browserSession?.status === "running" ||
    browserSession?.status === "pending"
  ) {
    return {
      kind: "running",
      label: statusLabel || "运行中",
      detail: detail || executionTrace?.progressMessage || "当前对话仍在处理",
      tone: "info",
    };
  }

  if (stopReasonLabel === "need-user-input") {
    return {
      kind: "needs-input",
      label: "等待你继续",
      detail: detail || "需要你补充下一步指令",
      tone: "warning",
    };
  }

  if (
    STOPPED_ERROR_CODES.has(errorCode) ||
    STOPPED_STATUS_LABELS.has(normalizedStatusLabel)
  ) {
    return {
      kind: "stopped",
      label: "已停止",
      detail: detail || "已停止，保留现场方便继续",
      tone: "warning",
    };
  }

  if (
    FAILED_ERROR_CODES.has(errorCode) ||
    executionTrace?.status === "failed" ||
    lastAssistantMessage.error
  ) {
    return {
      kind: "failed",
      label: statusLabel || "失败",
      detail:
        detail ||
        normalizeMessageText(
          String(executionTrace?.errorMessage || lastAssistantMessage.text || ""),
        ) ||
        "这次回复执行失败",
      tone: "danger",
    };
  }

  if (executionTrace?.status === "completed") {
    return {
      kind: "completed",
      label: statusLabel || "已完成",
      detail: detail || "这次处理已经完成",
      tone: "success",
    };
  }

  return {
    kind: "idle",
    label: "空闲",
    detail: detail || "可以继续下一步",
    tone: "neutral",
  };
};
