import assert from "node:assert/strict";
import test from "node:test";
import type {
  ChatMessage,
  ConversationSession,
  InputBlock,
} from "../../types/common.ts";
import {
  deriveConversationSidebarPreview,
  deriveConversationStatusSummary,
  getConversationHistoryGroupKey,
  groupConversationsForSidebar,
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

test("deriveConversationStatusSummary prefers unsent draft over message-derived status", () => {
  const conversation = createConversation({
    draft: {
      inputBlocks: [createTextBlock("Need to send this later")],
    },
    messages: [
      createAssistantMessage({
        agentData: {
          executionTrace: {
            status: "completed",
          },
        },
      }),
    ],
  });

  const result = deriveConversationStatusSummary(conversation);
  assert.equal(result.kind, "draft");
  assert.equal(result.label, "Draft");
  assert.equal(result.tone, "success");
});

test("deriveConversationStatusSummary returns running for active execution traces", () => {
  const conversation = createConversation({
    messages: [
      createAssistantMessage({
        agentData: {
          executionTrace: {
            status: "executing",
            progressMessage: "Generating results",
          },
        },
      }),
    ],
  });

  const result = deriveConversationStatusSummary(conversation);
  assert.equal(result.kind, "running");
  assert.equal(result.label, "Running");
  assert.equal(result.detail, "Generating results");
  assert.equal(result.tone, "info");
});

test("deriveConversationStatusSummary recognizes need-user-input stop reasons", () => {
  const conversation = createConversation({
    messages: [
      createAssistantMessage({
        agentData: {
          executionTrace: {
            status: "completed",
            stopReasonLabel: "need-user-input",
          },
        },
      }),
    ],
  });

  const result = deriveConversationStatusSummary(conversation);
  assert.equal(result.kind, "needs-input");
  assert.equal(result.label, "Needs input");
  assert.equal(result.tone, "warning");
});

test("deriveConversationStatusSummary recognizes stopped cancelled runs", () => {
  const conversation = createConversation({
    messages: [
      createAssistantMessage({
        agentData: {
          executionTrace: {
            status: "completed",
            errorCode: "USER_CANCELLED",
          },
        },
      }),
    ],
  });

  const result = deriveConversationStatusSummary(conversation);
  assert.equal(result.kind, "stopped");
  assert.equal(result.label, "Stopped");
  assert.equal(result.tone, "warning");
});

test("deriveConversationStatusSummary recognizes stopped persisted status labels", () => {
  const conversation = createConversation({
    messages: [
      createAssistantMessage({
        agentData: {
          presentation: {
            statusLabel: "已停止",
          },
          executionTrace: {
            status: "completed",
          },
        },
      }),
    ],
  });

  const result = deriveConversationStatusSummary(conversation);
  assert.equal(result.kind, "stopped");
  assert.equal(result.label, "Stopped");
  assert.equal(result.tone, "warning");
});

test("deriveConversationStatusSummary recognizes failed replies", () => {
  const conversation = createConversation({
    messages: [
      createAssistantMessage({
        text: "Something failed badly",
        error: true,
        agentData: {
          executionTrace: {
            status: "failed",
            errorMessage: "Failure reason",
          },
        },
      }),
    ],
  });

  const result = deriveConversationStatusSummary(conversation);
  assert.equal(result.kind, "failed");
  assert.equal(result.label, "Failed");
  assert.equal(result.detail, "Failure reason");
  assert.equal(result.tone, "danger");
});

test("deriveConversationStatusSummary recognizes completed replies", () => {
  const conversation = createConversation({
    messages: [
      createAssistantMessage({
        agentData: {
          postGenerationSummary: "Assets are ready",
          executionTrace: {
            status: "completed",
          },
        },
      }),
    ],
  });

  const result = deriveConversationStatusSummary(conversation);
  assert.equal(result.kind, "completed");
  assert.equal(result.label, "Completed");
  assert.equal(result.detail, "Assets are ready");
  assert.equal(result.tone, "success");
});

test("deriveConversationStatusSummary recognizes interrupted persisted runs", () => {
  const conversation = createConversation({
    messages: [
      createAssistantMessage({
        agentData: {
          presentation: {
            statusLabel: "已中断",
          },
          executionTrace: {
            status: "failed",
            errorCode: "LOAD_INTERRUPTED",
            errorMessage: "Interrupted by refresh",
          },
        },
      }),
    ],
  });

  const result = deriveConversationStatusSummary(conversation);
  assert.equal(result.kind, "failed");
  assert.equal(result.label, "已中断");
  assert.equal(result.detail, "Interrupted by refresh");
  assert.equal(result.tone, "danger");
});

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
