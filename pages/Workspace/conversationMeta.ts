import type {
  ChatMessage,
  ChatMessageLineage,
  ConversationSession,
} from "../../types";
import { getAssistantThreadVisibleUiMessages } from "./controllers/assistantThreadRepository.ts";
import { normalizeLegacyAssistantMessageText } from "./legacyAssistantText.ts";

export const DEFAULT_CONVERSATION_TITLE = "新对话";
const LEGACY_DEFAULT_CONVERSATION_TITLES = new Set(["New chat", "新对话"]);

const MAX_TITLE_LENGTH = 36;
const MAX_PREVIEW_LENGTH = 96;

const normalizeWhitespace = (value: string): string =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeMessageText = (value: string): string =>
  normalizeWhitespace(normalizeLegacyAssistantMessageText(value || ""));

const isDefaultConversationTitle = (value: string | null | undefined): boolean =>
  LEGACY_DEFAULT_CONVERSATION_TITLES.has(normalizeWhitespace(value || ""));

const truncateText = (value: string, maxLength: number): string => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
};

type MessageSummaryTarget = Pick<
  ChatMessage,
  "text" | "inlineParts" | "attachments"
>;

const getInlinePartSummary = (message: MessageSummaryTarget): string => {
  const inlineParts = Array.isArray(message.inlineParts) ? message.inlineParts : [];
  if (inlineParts.length === 0) return "";

  const textParts = inlineParts
    .flatMap((part) => {
      if (part.type === "text") return [part.text];
      if (part.type === "attachment") return [part.label];
      return [];
    })
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  return textParts.join(" ");
};

export const getMessageSummaryText = (message: MessageSummaryTarget): string => {
  const directText = normalizeMessageText(message.text || "");
  if (directText) return directText;

  const inlinePartSummary = getInlinePartSummary(message);
  if (inlinePartSummary) return inlinePartSummary;

  const attachmentCount = Array.isArray(message.attachments)
    ? message.attachments.length
    : 0;
  if (attachmentCount > 0) {
    return attachmentCount === 1 ? "1 个附件" : `${attachmentCount} 个附件`;
  }

  return "";
};

const getFirstMeaningfulMessageText = (
  messages: ChatMessage[],
  role?: ChatMessage["role"],
): string => {
  const found = messages.find((message) => {
    if (role && message.role !== role) return false;
    return Boolean(getMessageSummaryText(message));
  });
  return found ? getMessageSummaryText(found) : "";
};

const getLastMeaningfulMessageText = (messages: ChatMessage[]): string => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const summary = getMessageSummaryText(messages[index]);
    if (summary) return summary;
  }
  return "";
};

type AssistantThreadMessage = ReturnType<
  typeof getAssistantThreadVisibleUiMessages
>[number];

const getAssistantThreadMessageSummaryText = (
  message: AssistantThreadMessage,
): string => {
  const textParts: string[] = [];
  let fileCount = 0;

  for (const part of message.parts || []) {
    if (part.type === "text") {
      const text = normalizeMessageText(part.text || "");
      if (text) textParts.push(text);
      continue;
    }

    if (part.type === "file") {
      const label =
        normalizeWhitespace(part.filename || "") ||
        normalizeWhitespace(part.mediaType || "");
      textParts.push(label || "附件");
      fileCount += 1;
    }
  }

  const summary = normalizeWhitespace(textParts.join(" "));
  if (summary) return summary;
  if (fileCount > 0) {
    return fileCount === 1 ? "1 个附件" : `${fileCount} 个附件`;
  }
  return "";
};

const getAssistantThreadMeaningfulTexts = (
  thread: ConversationSession["assistantThread"] | undefined,
): string[] =>
  getAssistantThreadVisibleUiMessages(thread)
    .map((message) => getAssistantThreadMessageSummaryText(message))
    .filter(Boolean);

const getFirstAssistantThreadMeaningfulText = (
  thread: ConversationSession["assistantThread"] | undefined,
  role?: "user" | "assistant",
): string => {
  const message = getAssistantThreadVisibleUiMessages(thread).find((item) => {
    if (role && item.role !== role) return false;
    return Boolean(getAssistantThreadMessageSummaryText(item));
  });
  return message ? getAssistantThreadMessageSummaryText(message) : "";
};

const getLastAssistantThreadMeaningfulText = (
  thread: ConversationSession["assistantThread"] | undefined,
): string => {
  const messages = getAssistantThreadVisibleUiMessages(thread);
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const summary = getAssistantThreadMessageSummaryText(messages[index]);
    if (summary) return summary;
  }
  return "";
};

export const deriveConversationTitle = (
  messages: ChatMessage[],
  projectTitle?: string,
  assistantThread?: ConversationSession["assistantThread"],
): string => {
  const firstThreadUserMessage = getFirstAssistantThreadMeaningfulText(
    assistantThread,
    "user",
  );
  if (firstThreadUserMessage) {
    return truncateText(firstThreadUserMessage, MAX_TITLE_LENGTH);
  }

  const firstUserMessage = getFirstMeaningfulMessageText(messages, "user");
  if (firstUserMessage) {
    return truncateText(firstUserMessage, MAX_TITLE_LENGTH);
  }

  const normalizedProjectTitle = normalizeWhitespace(projectTitle || "");
  if (
    normalizedProjectTitle &&
    normalizedProjectTitle.toLowerCase() !== "untitled" &&
    !isDefaultConversationTitle(normalizedProjectTitle)
  ) {
    return truncateText(normalizedProjectTitle, MAX_TITLE_LENGTH);
  }

  const firstMessage = getFirstMeaningfulMessageText(messages);
  if (firstMessage) {
    return truncateText(firstMessage, MAX_TITLE_LENGTH);
  }

  return DEFAULT_CONVERSATION_TITLE;
};

export const deriveConversationPreview = (
  conversation: Pick<ConversationSession, "messages" | "assistantThread">,
): string => {
  const previewText =
    getLastAssistantThreadMeaningfulText(conversation.assistantThread) ||
    getLastMeaningfulMessageText(conversation.messages || []);
  return truncateText(previewText, MAX_PREVIEW_LENGTH);
};

export const deriveDraftPreview = (
  draft: ConversationSession["draft"] | undefined,
): string => {
  const inputBlocks = Array.isArray(draft?.inputBlocks) ? draft.inputBlocks : [];
  if (inputBlocks.length === 0) return "";

  const textParts = inputBlocks
    .flatMap((block) => {
      if (block.type === "text") {
        const text = normalizeWhitespace(block.text || "");
        return text ? [text] : [];
      }
      if (block.type === "file") {
        const label =
          normalizeWhitespace(block.file?.markerName || block.file?.name || "") ||
          "附件";
        return [label];
      }
      return [];
    })
    .filter(Boolean);

  return truncateText(textParts.join(" "), MAX_PREVIEW_LENGTH);
};

export const hasConversationDraft = (
  conversation: Pick<ConversationSession, "draft">,
): boolean => {
  const inputBlocks = Array.isArray(conversation.draft?.inputBlocks)
    ? conversation.draft?.inputBlocks
    : [];

  return inputBlocks.some((block) =>
    block.type === "text"
      ? Boolean(normalizeWhitespace(block.text || ""))
      : Boolean(block.file),
  );
};

export const deriveConversationSidebarPreview = (
  conversation: Pick<ConversationSession, "messages" | "assistantThread" | "draft">,
): {
  text: string;
  source: "message" | "draft" | "empty";
} => {
  const messagePreview = deriveConversationPreview({
    messages: conversation.messages,
    assistantThread: conversation.assistantThread,
  });
  if (messagePreview) {
    return {
      text: messagePreview,
      source: "message",
    };
  }

  const draftPreview = deriveDraftPreview(conversation.draft);
  if (draftPreview) {
    return {
      text: draftPreview,
      source: "draft",
    };
  }

  return {
    text: "",
    source: "empty",
  };
};

export type ConversationHistoryGroupKey =
  | "pinned"
  | "today"
  | "yesterday"
  | "last7Days"
  | "last30Days"
  | "older";

export type ConversationHistoryGroup = {
  key: ConversationHistoryGroupKey;
  label: string;
  conversations: ConversationSession[];
};

export type ResolveConversationFallbackArgs = {
  activeConversationId: string;
  conversations: ConversationSession[];
  excludeConversationId: string;
  preferArchived?: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const CONVERSATION_HISTORY_GROUPS: Array<{
  key: ConversationHistoryGroupKey;
  label: string;
}> = [
  { key: "pinned", label: "Pinned" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7Days", label: "Last 7 days" },
  { key: "last30Days", label: "Last 30 days" },
  { key: "older", label: "Older" },
];

const getStartOfLocalDay = (timestamp: number): number => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

export const deriveConversationSearchText = (
  conversation: Pick<ConversationSession, "title" | "messages" | "assistantThread">,
): string => {
  const threadCorpus = getAssistantThreadMeaningfulTexts(
    conversation.assistantThread,
  ).join(" ");
  const legacyCorpus = (conversation.messages || [])
    .map((message) => getMessageSummaryText(message))
    .filter(Boolean)
    .join(" ");
  const messageCorpus = threadCorpus || legacyCorpus;

  return [conversation.title, messageCorpus]
    .map((value) => normalizeWhitespace(value || ""))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

export const matchesConversationSearch = (
  conversation: Pick<ConversationSession, "title" | "messages" | "assistantThread">,
  search: string,
): boolean => {
  const normalizedSearch = normalizeWhitespace(search).toLowerCase();
  if (!normalizedSearch) return true;
  return deriveConversationSearchText(conversation).includes(normalizedSearch);
};

export const isConversationArchived = (
  conversation: Pick<ConversationSession, "archivedAt">,
): boolean =>
  typeof conversation.archivedAt === "number" && conversation.archivedAt > 0;

export const sortConversationsForSidebar = (
  conversations: ConversationSession[],
): ConversationSession[] =>
  [...conversations].sort((left, right) => {
    const leftPinned = left.pinned === true ? 1 : 0;
    const rightPinned = right.pinned === true ? 1 : 0;
    if (leftPinned !== rightPinned) {
      return rightPinned - leftPinned;
    }
    return (right.updatedAt || 0) - (left.updatedAt || 0);
  });

export const getConversationHistoryGroupKey = (
  conversation: Pick<ConversationSession, "pinned" | "updatedAt">,
  now = Date.now(),
): ConversationHistoryGroupKey => {
  if (conversation.pinned === true) return "pinned";

  const updatedAt = Number(conversation.updatedAt || 0);
  const startOfToday = getStartOfLocalDay(now);

  if (updatedAt >= startOfToday) return "today";
  if (updatedAt >= startOfToday - DAY_MS) return "yesterday";
  if (updatedAt >= startOfToday - DAY_MS * 7) return "last7Days";
  if (updatedAt >= startOfToday - DAY_MS * 30) return "last30Days";
  return "older";
};

export const groupConversationsForSidebar = (
  conversations: ConversationSession[],
  now = Date.now(),
): ConversationHistoryGroup[] => {
  const buckets = new Map<ConversationHistoryGroupKey, ConversationSession[]>(
    CONVERSATION_HISTORY_GROUPS.map((group) => [group.key, []]),
  );

  sortConversationsForSidebar(conversations).forEach((conversation) => {
    const groupKey = getConversationHistoryGroupKey(conversation, now);
    buckets.get(groupKey)?.push(conversation);
  });

  return CONVERSATION_HISTORY_GROUPS.flatMap((group) => {
    const groupedConversations = buckets.get(group.key) || [];
    if (groupedConversations.length === 0) return [];
    return [
      {
        key: group.key,
        label: group.label,
        conversations: groupedConversations,
      },
    ];
  });
};

export const resolveConversationFallback = ({
  activeConversationId,
  conversations,
  excludeConversationId,
  preferArchived = false,
}: ResolveConversationFallbackArgs): ConversationSession | null => {
  const normalizedActiveConversationId = String(activeConversationId || "").trim();
  const normalizedExcludeConversationId = String(excludeConversationId || "").trim();
  const remainingConversations = conversations.filter(
    (conversation) => conversation.id !== normalizedExcludeConversationId,
  );
  if (remainingConversations.length === 0) return null;

  const orderedRemainingConversations =
    sortConversationsForSidebar(remainingConversations);
  const activeIndex = orderedRemainingConversations.findIndex(
    (conversation) => conversation.id === normalizedActiveConversationId,
  );
  const fallbackByPosition =
    activeIndex >= 0
      ? orderedRemainingConversations[activeIndex] ||
        orderedRemainingConversations[activeIndex - 1] ||
        null
      : null;

  const preferredPool = orderedRemainingConversations.filter((conversation) =>
    preferArchived
      ? isConversationArchived(conversation)
      : !isConversationArchived(conversation),
  );
  const alternatePool = orderedRemainingConversations.filter((conversation) =>
    preferArchived
      ? !isConversationArchived(conversation)
      : isConversationArchived(conversation),
  );

  if (fallbackByPosition) {
    const fallbackIsPreferred = preferArchived
      ? isConversationArchived(fallbackByPosition)
      : !isConversationArchived(fallbackByPosition);
    if (fallbackIsPreferred) return fallbackByPosition;
  }

  return preferredPool[0] || fallbackByPosition || alternatePool[0] || null;
};

export const resolveActiveConversationTitle = (args: {
  activeConversationId: string;
  conversations: Pick<ConversationSession, "id" | "title">[];
}): string => {
  const activeConversation = args.conversations.find(
    (conversation) => conversation.id === args.activeConversationId,
  );
  const explicitTitle = normalizeWhitespace(activeConversation?.title || "");
  if (!explicitTitle || isDefaultConversationTitle(explicitTitle)) {
    return DEFAULT_CONVERSATION_TITLE;
  }
  return explicitTitle;
};

export const getConversationMessageCount = (
  conversation: Pick<ConversationSession, "messages" | "assistantThread">,
): number =>
  getAssistantThreadMeaningfulTexts(conversation.assistantThread).length ||
  (Array.isArray(conversation.messages)
    ? conversation.messages.filter((message) => Boolean(getMessageSummaryText(message))).length
    : 0);

export const deriveConversationBranchPointLabel = (
  message: Pick<ChatMessage, "text" | "inlineParts" | "attachments">,
): string => {
  const summary = getMessageSummaryText(message);
  return truncateText(summary || DEFAULT_CONVERSATION_TITLE, 48);
};

export const deriveConversationBranchTitle = (args: {
  parentTitle?: string;
  branchPointLabel?: string;
}): string => {
  const parentTitle = normalizeWhitespace(args.parentTitle || "");
  const branchPointLabel = normalizeWhitespace(args.branchPointLabel || "");

  if (parentTitle && branchPointLabel) {
    return truncateText(`${parentTitle} · 分支`, MAX_TITLE_LENGTH);
  }
  if (parentTitle) {
    return truncateText(`${parentTitle} · 分支`, MAX_TITLE_LENGTH);
  }
  if (branchPointLabel) {
    return truncateText(`${branchPointLabel} · 分支`, MAX_TITLE_LENGTH);
  }

  return DEFAULT_CONVERSATION_TITLE;
};

export const getMessageVersionRootId = (
  message: Pick<ChatMessage, "id" | "lineage">,
): string => {
  const rootId = String(message.lineage?.versionRootMessageId || "").trim();
  return rootId || String(message.id || "").trim();
};

export const getMessageVersionNumber = (
  message: Pick<ChatMessage, "lineage">,
): number => {
  const versionNumber = Number(message.lineage?.versionNumber || 0);
  return Number.isFinite(versionNumber) && versionNumber > 0 ? versionNumber : 1;
};

export const getMessageVersionLabel = (
  message: Pick<ChatMessage, "role" | "lineage">,
): string | null => {
  const versionNumber = getMessageVersionNumber(message);
  const source = message.lineage?.source;

  if (versionNumber <= 1 && source === "send") return null;
  if (message.role === "user") {
    return `第 ${versionNumber} 版`;
  }
  return source === "assistant_retry"
    ? `重试第 ${versionNumber} 版`
    : `回复第 ${versionNumber} 版`;
};

export const getMessageVersionSourceLabel = (
  lineage: ChatMessageLineage | undefined,
): string | null => {
  if (!lineage) return null;
  switch (lineage.source) {
    case "resend":
      return "重发";
    case "edit_resend":
      return "编辑后重发";
    case "assistant_retry":
      return "重试";
    default:
      return null;
  }
};

export const collectMessageVersionSiblings = (
  messages: ChatMessage[],
  message: ChatMessage,
): ChatMessage[] => {
  const versionRootId = getMessageVersionRootId(message);
  return messages
    .filter(
      (item) =>
        item.role === message.role &&
        getMessageVersionRootId(item) === versionRootId,
    )
    .sort(
      (left, right) =>
        getMessageVersionNumber(left) - getMessageVersionNumber(right) ||
        left.timestamp - right.timestamp,
    );
};
