import test from "node:test";
import assert from "node:assert/strict";

import type { ChatMessage, ConversationSession } from "../../../types/index.ts";
import { toAssistantUiStorageEntry } from "../../../services/assistant-ui/ui-message-normalization.ts";
import { resolveLegacyConversationMessagesForPersistence } from "./conversationMessagePersistence.ts";

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
  return entry;
};

test("resolveLegacyConversationMessagesForPersistence keeps stored messages when only the active conversation changes", () => {
  const existingMessages = [
    createMessage("user-1", "user", "old"),
    createMessage("assistant-1", "model", "reply"),
  ];

  assert.deepEqual(
    resolveLegacyConversationMessagesForPersistence({
      existingConversation: createConversation({ messages: existingMessages }),
      nextLegacyMessages: [createMessage("user-2", "user", "new active thread")],
      legacyMessagesChanged: false,
      conversationChanged: true,
    }),
    existingMessages,
  );
});

test("resolveLegacyConversationMessagesForPersistence keeps assistant-ui derived messages authoritative", () => {
  const existingMessages = [
    createMessage("user-1", "user", "hello"),
    createMessage("assistant-1", "model", "hi"),
  ];

  assert.deepEqual(
    resolveLegacyConversationMessagesForPersistence({
      existingConversation: createConversation({
        messages: existingMessages,
        assistantThread: {
          headId: "assistant-1",
          messages: [
            createThreadEntry("user-1", "user", null, "hello"),
            createThreadEntry("assistant-1", "assistant", "user-1", "hi"),
          ],
        },
      }),
      nextLegacyMessages: [createMessage("user-2", "user", "legacy overwrite attempt")],
      legacyMessagesChanged: true,
      conversationChanged: false,
    }),
    existingMessages,
  );
});

test("resolveLegacyConversationMessagesForPersistence still persists legacy messages for legacy-only conversations", () => {
  const nextMessages = [
    createMessage("user-2", "user", "legacy question"),
    createMessage("assistant-2", "model", "legacy answer"),
  ];

  assert.deepEqual(
    resolveLegacyConversationMessagesForPersistence({
      existingConversation: createConversation({
        messages: [createMessage("user-1", "user", "old")],
      }),
      nextLegacyMessages: nextMessages,
      legacyMessagesChanged: true,
      conversationChanged: false,
    }),
    nextMessages,
  );
});
