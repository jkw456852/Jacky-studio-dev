import test from "node:test";
import assert from "node:assert/strict";

import { ASSISTANT_UI_MESSAGE_FORMAT } from "../../../services/assistant-ui/ui-message-normalization.ts";
import {
  getConversationAssetsFromAssistantThread,
  getGeneratedConversationFilesFromAssistantThread,
  getGeneratedConversationImageUrls,
} from "./generatedFiles.ts";
import type { ConversationSession } from "../../../types/index.ts";

const createAssistantThread = (
  messages: Array<{
    id: string;
    parentId: string | null;
    role: "user" | "assistant";
    parts: unknown[];
    metadata?: Record<string, unknown>;
  }>,
  headId = messages.at(-1)?.id ?? null,
): NonNullable<ConversationSession["assistantThread"]> => ({
  headId,
  messages: messages.map((message) => ({
    id: message.id,
    parent_id: message.parentId,
    format: ASSISTANT_UI_MESSAGE_FORMAT,
    content: {
      role: message.role,
      ...(message.metadata ? { metadata: message.metadata } : {}),
      parts: message.parts,
    },
  })),
});

test("generated files include official assistant-ui createImage tool output", () => {
  const imageUrl = "data:image/png;base64,Z2VuZXJhdGVk";
  const thread = createAssistantThread([
    {
      id: "msg-user",
      parentId: null,
      role: "user",
      parts: [{ type: "text", text: "Generate an image." }],
    },
    {
      id: "msg-assistant",
      parentId: "msg-user",
      role: "assistant",
      metadata: {
        providerId: "custom-provider",
        modelId: "gpt-image-2",
        createdAt: 1783000000000,
      },
      parts: [
        {
          type: "tool-createImage",
          toolCallId: "tool-1",
          state: "output-available",
          output: {
            providerName: "Plato",
            modelId: "gpt-image-2",
            images: [
              {
                type: "image",
                image: imageUrl,
                mediaType: "image/png",
                filename: "generated-image-1.png",
              },
            ],
          },
        },
      ],
    },
  ]);

  assert.deepEqual(getGeneratedConversationFilesFromAssistantThread(thread), [
    {
      url: imageUrl,
      type: "image",
      title: "generated-image-1.png",
      time: 1783000000000,
      model: "custom-provider - gpt-image-2",
    },
  ]);
});

test("generated files include assistant file parts but ignore user upload parts", () => {
  const userUpload = "data:image/png;base64,dXNlci11cGxvYWQ=";
  const generatedVideo = "data:video/mp4;base64,Z2VuZXJhdGVkLXZpZGVv";
  const thread = createAssistantThread([
    {
      id: "msg-user",
      parentId: null,
      role: "user",
      parts: [
        { type: "text", text: "Here is a reference." },
        {
          type: "file",
          url: userUpload,
          mediaType: "image/png",
          filename: "reference.png",
        },
      ],
    },
    {
      id: "msg-assistant",
      parentId: "msg-user",
      role: "assistant",
      parts: [
        {
          type: "file",
          url: generatedVideo,
          mediaType: "video/mp4",
          filename: "generated-video.mp4",
        },
      ],
    },
  ]);

  assert.deepEqual(getGeneratedConversationFilesFromAssistantThread(thread), [
    {
      url: generatedVideo,
      type: "video",
      title: "generated-video.mp4",
      time: 2,
      model: "AI",
    },
  ]);
});

test("conversation assets include user uploads and assistant generated files", () => {
  const userUpload = "data:image/png;base64,dXNlci11cGxvYWQ=";
  const generatedImage = "data:image/png;base64,Z2VuZXJhdGVk";
  const thread = createAssistantThread([
    {
      id: "msg-user",
      parentId: null,
      role: "user",
      parts: [
        { type: "text", text: "Use this reference." },
        {
          type: "file",
          data: userUpload,
          mimeType: "image/png",
          filename: "reference.png",
        },
      ],
    },
    {
      id: "msg-assistant",
      parentId: "msg-user",
      role: "assistant",
      metadata: {
        providerId: "custom-provider",
        modelId: "gpt-image-2",
        createdAt: 1783000000000,
      },
      parts: [
        {
          type: "tool-createImage",
          toolCallId: "tool-1",
          state: "output-available",
          output: {
            providerName: "Plato",
            modelId: "gpt-image-2",
            images: [
              {
                image: generatedImage,
                mediaType: "image/png",
                filename: "generated.png",
              },
            ],
          },
        },
      ],
    },
  ]);

  assert.deepEqual(getConversationAssetsFromAssistantThread(thread), [
    {
      id: "user-msg-user-1",
      url: userUpload,
      type: "image",
      title: "reference.png",
      time: 1,
      source: "user",
      mediaType: "image/png",
    },
    {
      id: "assistant-msg-assistant-0",
      url: generatedImage,
      type: "image",
      title: "generated.png",
      time: 1783000000000,
      source: "assistant",
      mediaType: "image/png",
      model: "custom-provider - gpt-image-2",
    },
  ]);
});

test("generated files expose official assistant thread images for workspace recovery", () => {
  const imageUrl = "data:image/png;base64,c2FtZQ==";
  const thread = createAssistantThread([
    {
      id: "msg-user",
      parentId: null,
      role: "user",
      parts: [{ type: "text", text: "Generate image." }],
    },
    {
      id: "msg-assistant",
      parentId: "msg-user",
      role: "assistant",
      parts: [
        {
          type: "tool-createImage",
          toolCallId: "tool-1",
          state: "output-available",
          output: {
            providerName: "Official Provider",
            modelId: "gpt-image-2",
            images: [
              {
                type: "image",
                image: imageUrl,
                mediaType: "image/png",
                filename: "official.png",
              },
            ],
          },
        },
      ],
    },
  ]);

  assert.deepEqual(
    getGeneratedConversationImageUrls({
      assistantThread: thread,
    }),
    [imageUrl],
  );
});

test("generated image urls do not merge stale legacy history", () => {
  const officialImageUrl = "data:image/png;base64,b2ZmaWNpYWw=";
  const duplicateUrl = "data:image/png;base64,ZHVwbGljYXRl";
  const thread = createAssistantThread([
    {
      id: "msg-user",
      parentId: null,
      role: "user",
      parts: [{ type: "text", text: "Generate image." }],
    },
    {
      id: "msg-assistant",
      parentId: "msg-user",
      role: "assistant",
      parts: [
        {
          type: "tool-createImage",
          toolCallId: "tool-1",
          state: "output-available",
          output: {
            providerName: "Official Provider",
            modelId: "gpt-image-2",
            images: [
              {
                type: "image",
                image: duplicateUrl,
                mediaType: "image/png",
              },
              {
                type: "image",
                image: officialImageUrl,
                mediaType: "image/png",
              },
            ],
          },
        },
      ],
    },
  ]);

  assert.deepEqual(
    getGeneratedConversationImageUrls({
      assistantThread: thread,
    }),
    [duplicateUrl, officialImageUrl],
  );
});
