import test from "node:test";
import assert from "node:assert/strict";

import {
  applyAssistantThreadSubmittedFeedback,
  getAssistantThreadVisibleUiMessages,
  resolveAssistantThreadHeadId,
  sliceConversationAssistantThreadToHead,
} from "./assistantThreadRepository.ts";
import type { ConversationSession } from "../../../types/index.ts";
import {
  ASSISTANT_UI_MESSAGE_FORMAT,
  toAssistantUiStorageEntry,
} from "../../../services/assistant-ui/ui-message-normalization.ts";

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

test("resolveAssistantThreadHeadId uses the stored head or latest official row", () => {
  const messages = [
    createThreadEntry("user-1", "user", null, "hello"),
    createThreadEntry("assistant-1", "assistant", "user-1", "first"),
  ];

  assert.equal(resolveAssistantThreadHeadId({ headId: "user-1", messages }), "user-1");
  assert.equal(resolveAssistantThreadHeadId({ messages }), "assistant-1");
  assert.equal(resolveAssistantThreadHeadId({ headId: null, messages }), null);
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
