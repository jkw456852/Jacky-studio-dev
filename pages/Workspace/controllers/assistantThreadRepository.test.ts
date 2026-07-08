import test from "node:test";
import assert from "node:assert/strict";

import {
  applyAssistantThreadSubmittedFeedback,
  getAssistantThreadVisibleUiMessages,
  sliceConversationAssistantThreadToHead,
} from "./assistantThreadRepository.ts";
import { getConversationVisibleMessages } from "./assistantThreadLegacyProjection.ts";
import type { ChatMessage, ConversationSession } from "../../../types/index.ts";
import {
  ASSISTANT_UI_MESSAGE_FORMAT,
  toAssistantUiStorageEntry,
} from "../../../services/assistant-ui/ui-message-normalization.ts";

const createMessage = (
  id: string,
  role: ChatMessage["role"],
  text: string,
  timestamp = 1,
): ChatMessage => ({
  id,
  role,
  text,
  timestamp,
});

const createConversation = (
  overrides: Partial<ConversationSession> = {},
): ConversationSession => ({
  id: "conv-1",
  title: "Test",
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
  assert.equal(entry.format, ASSISTANT_UI_MESSAGE_FORMAT);
  return entry;
};

test("getConversationVisibleMessages falls back to stored messages without assistant thread", () => {
  const messages = [
    createMessage("user-1", "user", "hello"),
    createMessage("assistant-1", "model", "hi"),
  ];
  const conversation = createConversation({ messages });

  assert.deepEqual(getConversationVisibleMessages(conversation), messages);
});

test("getAssistantThreadVisibleUiMessages derives the active assistant-ui path", () => {
  const conversation = createConversation({
    assistantThread: {
      headId: "assistant-2",
      messages: [
        createThreadEntry("user-1", "user", null, "hello"),
        createThreadEntry("assistant-1", "assistant", "user-1", "first"),
        createThreadEntry("assistant-2", "assistant", "user-1", "second"),
      ],
    },
  });

  const messages = getAssistantThreadVisibleUiMessages(conversation.assistantThread);

  assert.deepEqual(
    messages.map((message) => ({
      id: message.id,
      role: message.role,
      text: message.parts
        .flatMap((part) => (part.type === "text" ? [part.text] : []))
        .join("\n"),
    })),
    [
      { id: "user-1", role: "user", text: "hello" },
      { id: "assistant-2", role: "assistant", text: "second" },
    ],
  );
});

test("getConversationVisibleMessages prefers assistantThread over stale legacy messages", () => {
  const conversation = createConversation({
    messages: [
      createMessage("user-legacy", "user", "legacy question"),
      createMessage("assistant-legacy", "model", "legacy answer"),
    ],
    assistantThread: {
      headId: "assistant-2",
      messages: [
        createThreadEntry("user-1", "user", null, "hello"),
        createThreadEntry("assistant-1", "assistant", "user-1", "first"),
        createThreadEntry("assistant-2", "assistant", "user-1", "second"),
      ],
    },
  });

  assert.deepEqual(getConversationVisibleMessages(conversation), [
    createMessage("user-1", "user", "hello", 1),
    createMessage("assistant-2", "model", "second", 2),
  ]);
});

test("getConversationVisibleMessages falls back when assistantThread cannot resolve a visible path", () => {
  const user1 = createMessage("user-1", "user", "hello");
  const assistant1 = createMessage("assistant-1", "model", "first");
  const conversation = createConversation({
    messages: [user1, assistant1],
    assistantThread: {
      headId: "missing-head",
      messages: [
        createThreadEntry("user-1", "user", null, "hello"),
        createThreadEntry("assistant-2", "assistant", "user-1", "second"),
      ],
    },
  });

  assert.deepEqual(getConversationVisibleMessages(conversation), [
    user1,
    assistant1,
  ]);
});

test("getConversationVisibleMessages falls back to legacy messages when the stored assistant thread is branch-corrupted", () => {
  const legacyMessages = [
    createMessage("user-1", "user", "hello", 1),
    createMessage("assistant-1", "model", "hi", 2),
    createMessage("user-2", "user", "weather", 3),
    createMessage("assistant-2", "model", "sunny", 4),
  ];
  const conversation = createConversation({
    messages: legacyMessages,
    assistantThread: {
      headId: "user-3",
      messages: [
        createThreadEntry("user-1", "user", null, "hello"),
        createThreadEntry("user-2", "user", null, "weather"),
        createThreadEntry("user-3", "user", null, "design"),
      ],
    },
  });

  assert.deepEqual(getConversationVisibleMessages(conversation), legacyMessages);
});

test("getConversationVisibleMessages falls back to legacy when the thread lost the user ancestor but kept the same tail", () => {
  const legacyMessages = [
    createMessage("user-1", "user", "hello", 1),
    createMessage("assistant-1", "model", "hi", 2),
  ];

  const conversation = createConversation({
    messages: legacyMessages,
    assistantThread: {
      headId: "assistant-1",
      messages: [
        createThreadEntry("assistant-1", "assistant", null, "hi"),
      ],
    },
  });

  assert.deepEqual(getConversationVisibleMessages(conversation), legacyMessages);
});

test("sliceConversationAssistantThreadToHead keeps only the selected ancestor path", () => {
  const thread: NonNullable<ConversationSession["assistantThread"]> = {
    headId: "assistant-2",
    messages: [
      createThreadEntry("user-1", "user", null, "hello"),
      createThreadEntry("assistant-1", "assistant", "user-1", "first"),
      createThreadEntry("assistant-2", "assistant", "user-1", "second"),
      createThreadEntry("user-2", "user", "assistant-2", "follow-up"),
    ],
  };

  assert.deepEqual(sliceConversationAssistantThreadToHead(thread, "assistant-2"), {
    headId: "assistant-2",
    messages: [
      createThreadEntry("user-1", "user", null, "hello"),
      createThreadEntry("assistant-2", "assistant", "user-1", "second"),
    ],
  });
});

test("sliceConversationAssistantThreadToHead returns undefined for missing heads", () => {
  const thread: NonNullable<ConversationSession["assistantThread"]> = {
    headId: "assistant-1",
    messages: [
      createThreadEntry("user-1", "user", null, "hello"),
      createThreadEntry("assistant-1", "assistant", "user-1", "first"),
    ],
  };

  assert.equal(sliceConversationAssistantThreadToHead(thread, "missing"), undefined);
});

test("applyAssistantThreadSubmittedFeedback stores feedback in assistant-ui metadata", () => {
  const thread: NonNullable<ConversationSession["assistantThread"]> = {
    headId: "assistant-1",
    messages: [
      createThreadEntry("user-1", "user", null, "hello"),
      createThreadEntry("assistant-1", "assistant", "user-1", "first"),
    ],
  };

  const next = applyAssistantThreadSubmittedFeedback(
    thread,
    "assistant-1",
    "positive",
  );

  assert.notEqual(next, thread);
  assert.deepEqual(next?.messages[1]?.content.metadata, {
    submittedFeedback: { type: "positive" },
  });
  assert.equal(next?.headId, "assistant-1");
});

test("applyAssistantThreadSubmittedFeedback does not write feedback to user messages", () => {
  const thread: NonNullable<ConversationSession["assistantThread"]> = {
    headId: "user-1",
    messages: [createThreadEntry("user-1", "user", null, "hello")],
  };

  assert.equal(
    applyAssistantThreadSubmittedFeedback(thread, "user-1", "negative"),
    thread,
  );
});
