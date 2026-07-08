import { UI_MESSAGE_STREAM_HEADERS } from "ai";
import {
  RESUMABLE_STREAM_ID_HEADER,
  createInMemoryResumableStreamStore,
  createResumableStreamContext,
  type ResumableStreamContext,
  type ResumableStreamStore,
} from "assistant-stream/resumable";
import type { NodeRedisLike } from "assistant-stream/resumable/redis";

const GLOBAL_KEY = Symbol.for("xc-studio.assistant-chat-resumable-context");

type GlobalSlot = typeof globalThis & {
  [GLOBAL_KEY]?: Promise<ResumableStreamContext>;
};

const slot = globalThis as GlobalSlot;

const createFallbackStreamId = () =>
  `stream-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const createAssistantChatResumableStreamId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return createFallbackStreamId();
};

export const getAssistantChatResumableContext =
  async (): Promise<ResumableStreamContext> => {
    if (slot[GLOBAL_KEY]) return slot[GLOBAL_KEY];

    const promise = (async () => {
      const store = await createAssistantChatResumableStore();
      return createResumableStreamContext({ store });
    })();

    promise.catch(() => {
      if (slot[GLOBAL_KEY] === promise) {
        delete slot[GLOBAL_KEY];
      }
    });

    slot[GLOBAL_KEY] = promise;
    return promise;
  };

const createAssistantChatResumableStore =
  async (): Promise<ResumableStreamStore> => {
    const redisUrl = process.env["REDIS_URL"];
    if (!redisUrl) {
      return createInMemoryResumableStreamStore();
    }

    const { createClient } = await import("redis");
    const { createRedisResumableStreamStore } = await import(
      "assistant-stream/resumable/redis"
    );

    const client = createClient({ url: redisUrl });
    client.on("error", (error) => {
      console.error("[assistant-chat] resumable redis client error", error);
    });
    await client.connect();

    return createRedisResumableStreamStore(client as unknown as NodeRedisLike);
  };

export const createAssistantChatResumableResponse = async (options: {
  response: Response;
  streamId: string;
}): Promise<Response> => {
  const { response, streamId } = options;
  if (!response.body) {
    const headers = new Headers(response.headers);
    headers.set(RESUMABLE_STREAM_ID_HEADER, streamId);
    return new Response(null, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const context = await getAssistantChatResumableContext();
  const stream = await context.run(streamId, () => response.body!);
  const headers = new Headers(response.headers);
  headers.set(RESUMABLE_STREAM_ID_HEADER, streamId);

  return new Response(stream, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export const resumeAssistantChatStreamResponse = async (
  streamId: string,
): Promise<Response | null> => {
  const context = await getAssistantChatResumableContext();
  const stream = await context.resume(streamId);
  if (!stream) return null;

  return new Response(stream, {
    headers: {
      ...UI_MESSAGE_STREAM_HEADERS,
      [RESUMABLE_STREAM_ID_HEADER]: streamId,
    },
  });
};
