import type { UIMessage } from "ai";
import type { ConversationSession } from "../../../types/index.ts";
import {
  normalizeAssistantUiStorageEntries,
  normalizeAssistantUiStorageEntryRows,
} from "../../../services/assistant-ui/ui-message-normalization.ts";

const buildVisibleAssistantThreadMessageIds = (
  thread: ConversationSession["assistantThread"] | undefined,
): string[] => {
  const items = normalizeAssistantUiStorageEntryRows(thread?.messages);
  if (!thread || items.length === 0) {
    return [];
  }

  const parentById = new Map<string, string | null>();
  const orderedIds: string[] = [];

  for (const item of items) {
    const messageId = String(item.id || "").trim();
    if (!messageId) continue;
    orderedIds.push(messageId);
    parentById.set(messageId, item.parent_id ? String(item.parent_id) : null);
  }

  const fallbackHeadId = orderedIds.at(-1) || "";
  const headId =
    thread.headId === null
      ? ""
      : String(thread.headId || "").trim() || fallbackHeadId;
  if (!headId || !parentById.has(headId)) {
    return [];
  }

  const path: string[] = [];
  const seen = new Set<string>();
  let currentId: string | null = headId;

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    path.push(currentId);
    currentId = parentById.get(currentId) ?? null;
  }

  return path.reverse();
};

const buildAncestorAssistantThreadMessageIds = (
  thread: ConversationSession["assistantThread"] | undefined,
  headId: string,
): string[] => {
  const normalizedHeadId = String(headId || "").trim();
  const items = normalizeAssistantUiStorageEntryRows(thread?.messages);
  if (
    !thread ||
    items.length === 0 ||
    !normalizedHeadId
  ) {
    return [];
  }

  const parentById = new Map<string, string | null>();
  for (const item of items) {
    const messageId = String(item.id || "").trim();
    if (!messageId) continue;
    parentById.set(messageId, item.parent_id ? String(item.parent_id) : null);
  }

  if (!parentById.has(normalizedHeadId)) {
    return [];
  }

  const path: string[] = [];
  const seen = new Set<string>();
  let currentId: string | null = normalizedHeadId;

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    path.push(currentId);
    currentId = parentById.get(currentId) ?? null;
  }

  return path.reverse();
};

const getAssistantThreadVisibleUiMessageEntries = (
  thread: ConversationSession["assistantThread"] | undefined,
): UIMessage[] => {
  const visibleIds = buildVisibleAssistantThreadMessageIds(thread);
  if (visibleIds.length === 0) {
    return [];
  }

  const visibleIdSet = new Set<string>(visibleIds);
  const messagesById = new Map(
    normalizeAssistantUiStorageEntries(thread?.messages).flatMap((entry) => {
      const messageId = String(entry.message.id || "").trim();
      if (!messageId || !visibleIdSet.has(messageId)) {
        return [];
      }
      return [[messageId, entry.message] as const];
    }),
  );

  return visibleIds.flatMap((messageId) => {
    const message = messagesById.get(messageId);
    return message ? [message] : [];
  });
};

export const getAssistantThreadVisibleUiMessages = (
  thread: ConversationSession["assistantThread"] | undefined,
): UIMessage[] => getAssistantThreadVisibleUiMessageEntries(thread);

export const countAssistantThreadRoots = (
  thread: ConversationSession["assistantThread"] | undefined,
): number =>
  normalizeAssistantUiStorageEntryRows(thread?.messages).filter(
    (item) => !item.parent_id,
  ).length;

export const resolveAssistantThreadHeadId = (
  thread: ConversationSession["assistantThread"] | undefined,
): string | null => {
  const messages = normalizeAssistantUiStorageEntryRows(thread?.messages);
  if (!thread || messages.length === 0 || thread.headId === null) {
    return null;
  }

  const storedHeadId = String(thread.headId || "").trim();
  if (storedHeadId && messages.some((message) => message.id === storedHeadId)) {
    return storedHeadId;
  }

  return messages.at(-1)?.id || null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const applyAssistantThreadSubmittedFeedback = (
  thread: ConversationSession["assistantThread"] | undefined,
  messageId: string,
  type: "positive" | "negative",
): ConversationSession["assistantThread"] | undefined => {
  const normalizedMessageId = String(messageId || "").trim();
  if (!thread || !normalizedMessageId) {
    return thread;
  }

  const messages = normalizeAssistantUiStorageEntryRows(thread.messages);
  let changed = false;
  const nextMessages = messages.map((item) => {
    if (item.id !== normalizedMessageId) {
      return item;
    }

    const content = isRecord(item.content) ? item.content : {};
    if (content.role !== "assistant") {
      return item;
    }

    const metadata = isRecord(content.metadata) ? content.metadata : {};
    const currentFeedback = isRecord(metadata.submittedFeedback)
      ? metadata.submittedFeedback
      : undefined;
    if (currentFeedback?.type === type) {
      return item;
    }

    changed = true;
    return {
      ...item,
      content: {
        ...content,
        metadata: {
          ...metadata,
          submittedFeedback: { type },
        },
      },
    };
  });

  if (!changed) {
    return thread;
  }

  const normalizedHeadId =
    thread.headId === null
      ? null
      : String(thread.headId || "").trim() || undefined;
  const headId =
    normalizedHeadId && nextMessages.some((item) => item.id === normalizedHeadId)
      ? normalizedHeadId
      : nextMessages.at(-1)?.id ?? null;

  return {
    headId,
    messages: nextMessages,
  };
};

export const sliceConversationAssistantThreadToHead = (
  thread: ConversationSession["assistantThread"] | undefined,
  headId: string,
): ConversationSession["assistantThread"] | undefined => {
  const visibleIds = buildAncestorAssistantThreadMessageIds(thread, headId);
  if (visibleIds.length === 0 || !thread) {
    return undefined;
  }

  const visibleIdSet = new Set<string>(visibleIds);
  const messages = normalizeAssistantUiStorageEntryRows(thread.messages).filter((item) => {
    const messageId = String(item.id || "").trim();
    if (!messageId || !visibleIdSet.has(messageId)) {
      return false;
    }
    return true;
  });

  const normalizedHeadId = String(headId || "").trim();
  const resolvedHeadId = messages.some((item) => item.id === normalizedHeadId)
    ? normalizedHeadId
    : messages.at(-1)?.id || null;

  return messages.length > 0
    ? {
        headId: resolvedHeadId,
        messages,
      }
    : undefined;
};
