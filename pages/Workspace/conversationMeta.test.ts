import assert from "node:assert/strict";
import test from "node:test";
import type {
  ChatMessage,
  ConversationSession,
  InputBlock,
} from "../../types/common.ts";
import { toAssistantUiStorageEntry } from "../../services/assistant-ui/ui-message-normalization.ts";
import {
  deriveConversationSearchText,
  deriveConversationSidebarPreview,
  getConversationMessageCount,
  getConversationHistoryGroupKey,
  groupConversationsForSidebar,
  matchesConversationSearch,
  resolveActiveConversationTitle,
  resolveConversationFallback,
} from "./conversationMeta.ts";

const createTextBlock = (text: string): InputBlock => ({
  id: `text-${text}`,
  type: "text",
  text,
});

const createAssistantMessage = (
  overrides: Partial<ChatMessage> = {},
): ChatMessage => ({
  id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  role: "model",
  text: "Assistant reply",
  timestamp: Date.now(),
  ...overrides,
});

const createConversation = (
  overrides: Partial<ConversationSession> = {},
): ConversationSession => ({
  id: "conv-1",
  title: "新对话",
  messages: [],
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const createThreadEntry = (
  id: string,
  role: "user" | "assistant",
  parentId: string | null,
  text: string,
) => {
  const entry = toAssistantUiStorageEntry({
    parentId,
    message: {
      id,
      role,
      parts: [{ type: "text", text }],
    },
  });
  assert.ok(entry);
  return entry;
};

test("deriveConversationSidebarPreview falls back to draft preview when messages have no summary", () => {
  const conversation = createConversation({
    draft: {
      inputBlocks: [createTextBlock("draft preview text")],
    },
    messages: [
      createAssistantMessage({
        text: "",
        inlineParts: [],
        attachments: [],
      }),
    ],
  });

  const result = deriveConversationSidebarPreview(conversation);
  assert.equal(result.source, "draft");
  assert.equal(result.text, "draft preview text");
});

test("conversation metadata prefers official assistant-ui thread parts over empty legacy messages", () => {
  const conversation = createConversation({
    title: "Thread title",
    messages: [],
    assistantThread: {
      headId: "assistant-1",
      messages: [
        createThreadEntry("user-1", "user", null, "official thread prompt"),
        createThreadEntry("assistant-1", "assistant", "user-1", "official thread reply"),
      ],
    },
  });

  const preview = deriveConversationSidebarPreview(conversation);

  assert.equal(preview.source, "message");
  assert.equal(preview.text, "official thread reply");
  assert.match(deriveConversationSearchText(conversation), /official thread prompt/);
  assert.equal(matchesConversationSearch(conversation, "thread reply"), true);
  assert.equal(getConversationMessageCount(conversation), 2);
});

test("groupConversationsForSidebar groups pinned and recency buckets in product order", () => {
  const now = new Date(2026, 5, 15, 15, 0, 0, 0).getTime();
  const createTimestamp = (year: number, month: number, day: number, hour: number) =>
    new Date(year, month, day, hour, 0, 0, 0).getTime();

  const pinnedRecent = createConversation({
    id: "pinned-recent",
    pinned: true,
    updatedAt: createTimestamp(2026, 5, 15, 14),
  });
  const pinnedOlder = createConversation({
    id: "pinned-older",
    pinned: true,
    updatedAt: createTimestamp(2026, 5, 14, 11),
  });
  const todayConversation = createConversation({
    id: "today",
    updatedAt: createTimestamp(2026, 5, 15, 9),
  });
  const yesterdayConversation = createConversation({
    id: "yesterday",
    updatedAt: createTimestamp(2026, 5, 14, 18),
  });
  const last7Conversation = createConversation({
    id: "last-7-days",
    updatedAt: createTimestamp(2026, 5, 11, 10),
  });
  const last30Conversation = createConversation({
    id: "last-30-days",
    updatedAt: createTimestamp(2026, 4, 30, 10),
  });
  const olderConversation = createConversation({
    id: "older",
    updatedAt: createTimestamp(2026, 3, 1, 10),
  });

  const result = groupConversationsForSidebar(
    [
      olderConversation,
      yesterdayConversation,
      pinnedOlder,
      last30Conversation,
      todayConversation,
      pinnedRecent,
      last7Conversation,
    ],
    now,
  );

  assert.deepEqual(
    result.map((group) => group.key),
    ["pinned", "today", "yesterday", "last7Days", "last30Days", "older"],
  );
  assert.deepEqual(
    result[0].conversations.map((conversation) => conversation.id),
    ["pinned-recent", "pinned-older"],
  );
  assert.deepEqual(
    result.slice(1).map((group) => group.conversations[0]?.id),
    ["today", "yesterday", "last-7-days", "last-30-days", "older"],
  );
});

test("getConversationHistoryGroupKey keeps same-day chats in today bucket", () => {
  const now = new Date(2026, 5, 15, 23, 30, 0, 0).getTime();
  const conversation = createConversation({
    updatedAt: new Date(2026, 5, 15, 0, 15, 0, 0).getTime(),
  });

  const result = getConversationHistoryGroupKey(conversation, now);
  assert.equal(result, "today");
});

test("resolveConversationFallback prefers the next active chat in sorted order", () => {
  const active = createConversation({
    id: "active",
    updatedAt: 200,
  });
  const next = createConversation({
    id: "next",
    updatedAt: 100,
  });

  const result = resolveConversationFallback({
    activeConversationId: "active",
    conversations: [active, next],
    excludeConversationId: "active",
  });

  assert.equal(result?.id, "next");
});

test("resolveConversationFallback skips archived chats when an active fallback exists", () => {
  const active = createConversation({
    id: "active",
    updatedAt: 300,
  });
  const archived = createConversation({
    id: "archived",
    updatedAt: 250,
    archivedAt: 999,
  });
  const available = createConversation({
    id: "available",
    updatedAt: 200,
  });

  const result = resolveConversationFallback({
    activeConversationId: "active",
    conversations: [active, archived, available],
    excludeConversationId: "active",
  });

  assert.equal(result?.id, "available");
});

test("resolveActiveConversationTitle prefers explicit renamed title even when chat is empty", () => {
  const renamedEmptyConversation = createConversation({
    id: "renamed-empty",
    title: "Header Rename Smoke Test",
    messages: [],
  });

  const result = resolveActiveConversationTitle({
    activeConversationId: "renamed-empty",
    conversations: [renamedEmptyConversation],
  });

  assert.equal(result, "Header Rename Smoke Test");
});

test("resolveActiveConversationTitle falls back to default when active chat has no title", () => {
  const untitledConversation = createConversation({
    id: "untitled",
    title: "   ",
  });

  const result = resolveActiveConversationTitle({
    activeConversationId: "untitled",
    conversations: [untitledConversation],
  });

  assert.equal(result, "新对话");
});
