import test from "node:test";
import assert from "node:assert/strict";

import {
  ASSISTANT_UI_MESSAGE_FORMAT,
  toAssistantUiStorageEntry,
} from "../../../services/assistant-ui/ui-message-normalization.ts";
import { compactAssistantThreadForPersistence } from "./workspaceAssistantThreadPersistence.ts";

const createThreadEntry = (
  id: string,
  role: "user" | "assistant",
  parentId: string | null,
) => {
  const entry = toAssistantUiStorageEntry({
    parentId,
    message: {
      id,
      role,
      parts: [{ type: "text", text: `message ${id}` }],
    },
  });
  assert.ok(entry);
  assert.equal(entry.format, ASSISTANT_UI_MESSAGE_FORMAT);
  return entry;
};

test("compactAssistantThreadForPersistence keeps complete official assistant-ui history", () => {
  const threadMessages = Array.from({ length: 95 }, (_, index) => {
    const id = `msg-${index + 1}`;
    const previousId = index === 0 ? null : `msg-${index}`;
    return createThreadEntry(
      id,
      index % 2 === 0 ? "user" : "assistant",
      previousId,
    );
  });

  const thread = compactAssistantThreadForPersistence({
    headId: "msg-95",
    messages: threadMessages,
  });

  assert.equal(thread?.headId, "msg-95");
  assert.equal(thread?.messages.length, 95);
  assert.equal(thread?.messages[0]?.id, "msg-1");
  assert.equal(thread?.messages.at(-1)?.id, "msg-95");
});

test("compactAssistantThreadForPersistence resolves missing head to the latest stored row", () => {
  const thread = compactAssistantThreadForPersistence({
    headId: "missing-head",
    messages: [
      createThreadEntry("msg-1", "user", null),
      createThreadEntry("msg-2", "assistant", "msg-1"),
    ],
  });

  assert.equal(thread?.headId, "msg-2");
});
