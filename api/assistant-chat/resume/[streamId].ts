import { resumeAssistantChatStreamResponse } from "../../../services/assistant-ui/assistant-chat-resumable.ts";

const getRequestStreamId = (req: {
  query?: Record<string, unknown>;
  url?: string;
}): string => {
  const queryValue = req.query?.streamId;
  if (Array.isArray(queryValue)) {
    return String(queryValue[0] || "").trim();
  }
  if (typeof queryValue === "string") {
    return queryValue.trim();
  }

  const url = new URL(String(req.url || "/"), "http://localhost");
  const pathnameParts = url.pathname.split("/").filter(Boolean);
  return decodeURIComponent(pathnameParts.at(-1) || "").trim();
};

const writeFetchResponse = async (response: Response, res: any) => {
  res.status(response.status);
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  if (!response.body) {
    res.end();
    return;
  }

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  const reader = response.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value && value.length > 0) {
        res.write(Buffer.from(value));
      }
    }
  } finally {
    reader.releaseLock();
  }

  res.end();
};

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const streamId = getRequestStreamId(req);
  if (!streamId) {
    return res.status(400).json({ error: "assistant_chat_stream_id_missing" });
  }

  const response = await resumeAssistantChatStreamResponse(streamId);
  if (!response) {
    return res.status(404).json({ error: "assistant_chat_stream_not_found" });
  }

  await writeFetchResponse(response, res);
}
