import test from "node:test";
import assert from "node:assert/strict";

import {
  ASSISTANT_UI_MESSAGE_FORMAT,
  normalizeAssistantUiMessage,
  normalizeAssistantUiMessages,
  normalizeAssistantUiStorageEntryRows,
  normalizeAssistantUiStorageEntries,
  readAssistantUiStorageEntryRow,
  readAssistantUiStorageEntry,
  toAssistantUiStorageEntry,
} from "./ui-message-normalization.ts";

const assistantMessage = {
  id: "msg-assistant-1",
  role: "assistant" as const,
  metadata: {
    modelId: "gpt-5.4",
  },
  parts: [
    { type: "reasoning", text: "short reasoning summary", state: "done" },
    { type: "text", text: "Hello from the AI SDK message.", state: "done" },
    {
      type: "source-url",
      sourceId: "source-1",
      url: "https://example.com/reference",
      title: "Reference",
    },
  ],
};

test("normalizes official AI SDK UIMessage parts", () => {
  assert.deepEqual(normalizeAssistantUiMessage(assistantMessage), assistantMessage);
});

test("preserves AI SDK file parts used for image references", () => {
  const message = {
    id: "msg-user-image-reference",
    role: "user" as const,
    parts: [
      { type: "text", text: "Use this as the reference image." },
      {
        type: "file",
        mediaType: "image/png",
        url: "data:image/png;base64,iVBORw0KGgo=",
        filename: "reference.png",
      },
    ],
  };

  assert.deepEqual(normalizeAssistantUiMessage(message), message);
});

test("preserves official UIMessage providerMetadata on message parts", () => {
  const message = {
    id: "msg-provider-metadata",
    role: "user" as const,
    parts: [
      {
        type: "text",
        text: "Use low image detail.",
        providerMetadata: {
          openai: {
            imageDetail: "low",
          },
        },
      },
      {
        type: "file",
        mediaType: "image/png",
        url: "data:image/png;base64,cHJvZHVjdA==",
        filename: "product.png",
        providerMetadata: {
          openai: {
            imageDetail: "high",
          },
        },
      },
      {
        type: "source-url",
        sourceId: "source-1",
        url: "https://example.com/source",
        providerMetadata: {
          provider: {
            citationId: "source-1",
          },
        },
      },
    ],
  };

  const entry = toAssistantUiStorageEntry({
    parentId: null,
    message,
  });

  assert.deepEqual(normalizeAssistantUiMessage(message), message);
  assert.ok(entry);
  assert.deepEqual(readAssistantUiStorageEntry(entry), {
    parentId: null,
    message,
  });
});

test("preserves assistant-ui generative UI and audio parts", () => {
  const message = {
    id: "msg-assistant-rich-parts",
    role: "assistant" as const,
    parts: [
      {
        type: "generative-ui",
        spec: {
          root: {
            component: "Card",
            props: { title: "Generated UI" },
            children: ["Hello"],
          },
        },
        id: "gen-ui-1",
      },
      {
        type: "audio",
        audio: {
          data: "SUQz",
          format: "mp3",
        },
      },
    ],
  };

  const entry = toAssistantUiStorageEntry({
    parentId: null,
    message,
  });

  assert.deepEqual(normalizeAssistantUiMessage(message), message);
  assert.ok(entry);
  assert.deepEqual(readAssistantUiStorageEntry(entry), {
    parentId: null,
    message,
  });
});

test("normalizes assistant-ui image attachment parts into AI SDK file parts", () => {
  assert.deepEqual(
    normalizeAssistantUiMessage({
      id: "msg-user-core-image-reference",
      role: "user",
      parts: [
        { type: "text", text: "Edit this image." },
        {
          type: "image",
          image: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==",
          filename: "reference.jpg",
        },
      ],
    }),
    {
      id: "msg-user-core-image-reference",
      role: "user",
      parts: [
        { type: "text", text: "Edit this image." },
        {
          type: "file",
          url: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==",
          mediaType: "image/jpeg",
          filename: "reference.jpg",
        },
      ],
    },
  );
});

test("normalizes assistant-ui file attachment parts into AI SDK file parts", () => {
  assert.deepEqual(
    normalizeAssistantUiMessage({
      id: "msg-user-core-file-reference",
      role: "user",
      parts: [
        {
          type: "file",
          data: "data:application/pdf;base64,JVBERi0xLjQK",
          mimeType: "application/pdf",
          filename: "brief.pdf",
        },
      ],
    }),
    {
      id: "msg-user-core-file-reference",
      role: "user",
      parts: [
        {
          type: "file",
          url: "data:application/pdf;base64,JVBERi0xLjQK",
          mediaType: "application/pdf",
          filename: "brief.pdf",
        },
      ],
    },
  );
});

test("infers official AI SDK file mediaType from data URLs when uploads have empty MIME", () => {
  assert.deepEqual(
    normalizeAssistantUiMessage({
      id: "msg-user-empty-mime-upload",
      role: "user",
      parts: [
        {
          type: "file",
          data: "data:image/webp;base64,UklGRg==",
          mimeType: "",
          filename: "reference",
        },
      ],
    }),
    {
      id: "msg-user-empty-mime-upload",
      role: "user",
      parts: [
        {
          type: "file",
          url: "data:image/webp;base64,UklGRg==",
          mediaType: "image/webp",
          filename: "reference",
        },
      ],
    },
  );
});

test("keeps official file parts render-safe when only filename identifies the upload type", () => {
  assert.deepEqual(
    normalizeAssistantUiMessage({
      id: "msg-user-filename-only-upload",
      role: "user",
      parts: [
        {
          type: "file",
          url: "blob:http://localhost/upload-1",
          mediaType: "",
          filename: "brief.pdf",
        },
        {
          type: "file",
          url: "blob:http://localhost/upload-2",
          filename: "unknown-file",
        },
      ],
    }),
    {
      id: "msg-user-filename-only-upload",
      role: "user",
      parts: [
        {
          type: "file",
          url: "blob:http://localhost/upload-1",
          mediaType: "application/pdf",
          filename: "brief.pdf",
        },
        {
          type: "file",
          url: "blob:http://localhost/upload-2",
          mediaType: "application/octet-stream",
          filename: "unknown-file",
        },
      ],
    },
  );
});

test("prefers filename media type over generic octet-stream upload hints", () => {
  assert.deepEqual(
    normalizeAssistantUiMessage({
      id: "msg-user-generic-upload",
      role: "user",
      parts: [
        {
          type: "file",
          url: "data:application/octet-stream;base64,JVBERi0xLjQK",
          mediaType: "application/octet-stream",
          filename: "brief.pdf",
        },
      ],
    }),
    {
      id: "msg-user-generic-upload",
      role: "user",
      parts: [
        {
          type: "file",
          url: "data:application/octet-stream;base64,JVBERi0xLjQK",
          mediaType: "application/pdf",
          filename: "brief.pdf",
        },
      ],
    },
  );
});

test("round-trips assistant-ui ai-sdk/v6 storage entries", () => {
  const entry = toAssistantUiStorageEntry({
    parentId: "msg-user-1",
    message: assistantMessage,
  });

  assert.ok(entry);
  assert.equal(entry.format, ASSISTANT_UI_MESSAGE_FORMAT);
  assert.equal(entry.parent_id, "msg-user-1");
  assert.deepEqual(readAssistantUiStorageEntry(entry), {
    parentId: "msg-user-1",
    message: assistantMessage,
  });
  assert.deepEqual(normalizeAssistantUiStorageEntries([entry]), [
    {
      parentId: "msg-user-1",
      message: assistantMessage,
    },
  ]);
});

test("rejects legacy ChatMessage-like objects instead of converting them", () => {
  const legacyMessage = {
    id: "legacy-model-1",
    role: "model",
    text: "Old sidebar text should not become a new assistant-ui message.",
    timestamp: Date.now(),
    agentData: {
      research: {
        citations: [
          {
            title: "Legacy citation",
            url: "https://example.com/legacy",
          },
        ],
      },
    },
  };

  assert.equal(normalizeAssistantUiMessage(legacyMessage), null);
  assert.deepEqual(normalizeAssistantUiMessages([legacyMessage]), []);
  assert.equal(
    toAssistantUiStorageEntry({
      parentId: null,
      message: legacyMessage,
    }),
    null,
  );
});

test("rejects unformatted or non-ai-sdk/v6 storage entries", () => {
  const unformattedEntry = {
    id: "msg-unformatted",
    parent_id: null,
    content: {
      role: "assistant",
      parts: [{ type: "text", text: "missing format" }],
    },
  };
  const legacyFormattedEntry = {
    id: "msg-legacy-format",
    parent_id: null,
    format: "aui/v0",
    content: {
      role: "assistant",
      parts: [{ type: "text", text: "legacy format" }],
    },
  };

  assert.equal(readAssistantUiStorageEntry(unformattedEntry), null);
  assert.equal(readAssistantUiStorageEntry(legacyFormattedEntry), null);
  assert.deepEqual(
    normalizeAssistantUiStorageEntries([unformattedEntry, legacyFormattedEntry]),
    [],
  );
});

test("normalizes assistant-ui storage rows without interpreting content", () => {
  const rows = normalizeAssistantUiStorageEntryRows(
    [
      {
        id: "msg-1",
        parent_id: null,
        format: "ai-sdk/v6",
        content: {
          role: "assistant",
          parts: [
            {
              type: "tool-futureOfficialPart",
              toolCallId: "tool-1",
              state: "output-available",
              output: { ok: true },
            },
          ],
        },
      },
      {
        id: "msg-2",
        parent_id: "missing-parent",
        format: "ai-sdk/v6",
        content: { arbitrary: "adapter-owned content" },
      },
      {
        id: "msg-2",
        parent_id: "msg-1",
        format: "ai-sdk/v6",
        content: { duplicate: true },
      },
      {
        id: "legacy",
        parent_id: null,
        format: "legacy",
        content: { role: "assistant" },
      },
    ],
    { format: "ai-sdk/v6" },
  );

  assert.deepEqual(rows, [
    {
      id: "msg-1",
      parent_id: null,
      format: "ai-sdk/v6",
      content: {
        role: "assistant",
        parts: [
          {
            type: "tool-futureOfficialPart",
            toolCallId: "tool-1",
            state: "output-available",
            output: { ok: true },
          },
        ],
      },
    },
    {
      id: "msg-2",
      parent_id: null,
      format: "ai-sdk/v6",
      content: { arbitrary: "adapter-owned content" },
    },
  ]);
});

test("reads storage rows with adapter-owned content", () => {
  assert.deepEqual(
    readAssistantUiStorageEntryRow({
      id: "msg-row",
      parentId: "msg-parent",
      format: "ai-sdk/v6",
      content: { unknown: { nested: true } },
    }),
    {
      id: "msg-row",
      parent_id: "msg-parent",
      format: "ai-sdk/v6",
      content: { unknown: { nested: true } },
    },
  );
});
