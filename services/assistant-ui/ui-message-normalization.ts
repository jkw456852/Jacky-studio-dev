import type { UIMessage } from "ai";
import type { AssistantThreadMessageStorageEntry } from "../../types/index.ts";

type AssistantUiMessagePart = UIMessage["parts"][number];
type AssistantUiStorageContent = Omit<UIMessage, "id"> & Record<string, unknown>;

export const ASSISTANT_UI_MESSAGE_FORMAT = "ai-sdk/v6";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const inferDataUrlMediaType = (value: string): string => {
  const match = /^data:([^;,]+)[;,]/i.exec(value);
  return match?.[1]?.trim() || "";
};

const inferFilenameMediaType = (value: unknown): string => {
  const filename = readString(value).toLowerCase();
  const extension = filename.includes(".")
    ? filename.slice(filename.lastIndexOf(".") + 1)
    : "";
  switch (extension) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    case "pdf":
      return "application/pdf";
    case "txt":
      return "text/plain";
    case "md":
    case "markdown":
      return "text/markdown";
    case "json":
      return "application/json";
    case "csv":
      return "text/csv";
    case "html":
    case "htm":
      return "text/html";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xls":
      return "application/vnd.ms-excel";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    default:
      return "";
  }
};

const inferFilePartMediaType = (part: Record<string, unknown>, url: string): string =>
  (() => {
    const explicitType =
      readString(part.mediaType) ||
      readString(part.mimeType) ||
      readString(part.contentType);
    const dataUrlType = inferDataUrlMediaType(url);
    const filenameType = inferFilenameMediaType(part.filename);
    const genericType = "application/octet-stream";
    if (explicitType && explicitType !== genericType) return explicitType;
    if (dataUrlType && dataUrlType !== genericType) return dataUrlType;
    if (filenameType) return filenameType;
    return explicitType || dataUrlType || genericType;
  })();

const cloneJson = <T>(value: T): T | undefined => {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return undefined;
  }
};

const cloneProviderMetadata = (
  value: unknown,
): Record<string, unknown> | undefined => {
  if (!isRecord(value)) return undefined;
  return cloneJson(value) ?? value;
};

const normalizeRole = (value: unknown): UIMessage["role"] | null => {
  const role = readString(value).toLowerCase();
  if (role === "user" || role === "system" || role === "assistant") {
    return role;
  }
  return null;
};

const normalizeUiPart = (part: unknown): AssistantUiMessagePart | null => {
  if (!isRecord(part)) return null;
  const type = readString(part.type);
  if (!type && typeof part.text === "string") {
    return { type: "text", text: part.text } as AssistantUiMessagePart;
  }
  if (!type) return null;

  if (type === "text") {
    const providerMetadata = cloneProviderMetadata(part.providerMetadata);
    return {
      type,
      text: String(part.text || ""),
      ...(part.state === "streaming" || part.state === "done"
        ? { state: part.state }
        : {}),
      ...(providerMetadata ? { providerMetadata } : {}),
    } as AssistantUiMessagePart;
  }

  if (type === "reasoning") {
    const providerMetadata = cloneProviderMetadata(part.providerMetadata);
    return {
      type,
      text: String(part.text || ""),
      ...(part.state === "streaming" || part.state === "done"
        ? { state: part.state }
        : {}),
      ...(providerMetadata ? { providerMetadata } : {}),
    } as AssistantUiMessagePart;
  }

  if (type === "file") {
    const url = readString(part.url) || readString(part.data);
    const mediaType = inferFilePartMediaType(part, url);
    if (!url) return null;
    const providerMetadata = cloneProviderMetadata(part.providerMetadata);
    return {
      type,
      url,
      mediaType,
      ...(readString(part.filename) ? { filename: readString(part.filename) } : {}),
      ...(providerMetadata ? { providerMetadata } : {}),
    } as AssistantUiMessagePart;
  }

  if (type === "image") {
    const url = readString(part.url) || readString(part.image);
    if (!url) return null;
    const mediaType =
      readString(part.mediaType) ||
      readString(part.mimeType) ||
      readString(part.contentType) ||
      inferDataUrlMediaType(url) ||
      "image/png";
    const providerMetadata = cloneProviderMetadata(part.providerMetadata);
    return {
      type: "file",
      url,
      mediaType,
      ...(readString(part.filename) ? { filename: readString(part.filename) } : {}),
      ...(providerMetadata ? { providerMetadata } : {}),
    } as AssistantUiMessagePart;
  }

  if (type === "source-url") {
    const sourceId = readString(part.sourceId);
    const url = readString(part.url);
    if (!sourceId || !url) return null;
    const providerMetadata = cloneProviderMetadata(part.providerMetadata);
    return {
      type,
      sourceId,
      url,
      ...(readString(part.title) ? { title: readString(part.title) } : {}),
      ...(providerMetadata ? { providerMetadata } : {}),
    } as AssistantUiMessagePart;
  }

  if (type === "source-document") {
    const sourceId = readString(part.sourceId);
    const mediaType = readString(part.mediaType);
    const title = readString(part.title);
    if (!sourceId || !mediaType || !title) return null;
    const providerMetadata = cloneProviderMetadata(part.providerMetadata);
    return {
      type,
      sourceId,
      mediaType,
      title,
      ...(readString(part.filename) ? { filename: readString(part.filename) } : {}),
      ...(providerMetadata ? { providerMetadata } : {}),
    } as AssistantUiMessagePart;
  }

  if (type === "generative-ui") {
    return (cloneJson(part) as AssistantUiMessagePart | undefined) ?? null;
  }

  if (type === "audio") {
    const audio = isRecord(part.audio) ? part.audio : null;
    const data = readString(audio?.data);
    const format = readString(audio?.format);
    if (!data || (format !== "mp3" && format !== "wav")) return null;
    return {
      type,
      audio: {
        data,
        format,
      },
    } as unknown as AssistantUiMessagePart;
  }

  if (type === "step-start") {
    return { type } as AssistantUiMessagePart;
  }

  if (type.startsWith("data-")) {
    return {
      type,
      ...(readString(part.id) ? { id: readString(part.id) } : {}),
      data: part.data,
    } as AssistantUiMessagePart;
  }

  if (type === "dynamic-tool") {
    const toolName = readString(part.toolName);
    const toolCallId = readString(part.toolCallId);
    if (!toolName || !toolCallId) return null;
    return cloneJson(part) as AssistantUiMessagePart;
  }

  if (type.startsWith("tool-") && readString(part.toolCallId)) {
    return cloneJson(part) as AssistantUiMessagePart;
  }

  return null;
};

export const normalizeAssistantUiMessage = (
  value: unknown,
  options: {
    fallbackId?: string;
    fallbackRole?: UIMessage["role"];
  } = {},
): UIMessage | null => {
  if (!isRecord(value)) return null;

  const id = readString(value.id) || options.fallbackId || "";
  const role = normalizeRole(value.role) || options.fallbackRole || null;
  if (!id || !role) return null;

  if (!Array.isArray(value.parts)) return null;
  const parts = value.parts
    .map(normalizeUiPart)
    .filter((part): part is AssistantUiMessagePart => Boolean(part));
  if (parts.length === 0) return null;

  return {
    id,
    role,
    ...(isRecord(value.metadata)
      ? { metadata: cloneJson(value.metadata) ?? value.metadata }
      : {}),
    parts,
  };
};

export const normalizeAssistantUiMessages = (
  messages: unknown,
): UIMessage[] => {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((message, index) =>
      normalizeAssistantUiMessage(message, {
        fallbackId: `message-${index + 1}`,
      }),
    )
    .filter((message): message is UIMessage => Boolean(message));
};

export const readAssistantUiStorageEntry = (
  value: unknown,
): { parentId: string | null; message: UIMessage } | null => {
  if (!isRecord(value)) return null;

  const id = readString(value.id);
  const parentId =
    value.parent_id === null
      ? null
      : readString(value.parent_id) || readString(value.parentId) || null;
  const format = readString(value.format);
  const content = isRecord(value.content) ? value.content : null;

  if (!id || !content || format !== ASSISTANT_UI_MESSAGE_FORMAT) return null;

  const message = normalizeAssistantUiMessage({
    id,
    ...content,
  });
  return message ? { parentId, message } : null;
};

export const readAssistantUiStorageEntryRow = (
  value: unknown,
): AssistantThreadMessageStorageEntry | null => {
  if (!isRecord(value)) return null;

  const id = readString(value.id);
  const parentId =
    value.parent_id === null
      ? null
      : readString(value.parent_id) || readString(value.parentId) || null;
  const format = readString(value.format);
  const content = isRecord(value.content)
    ? cloneJson(value.content) ?? value.content
    : null;

  if (!id || !format || !content) return null;

  return {
    id,
    parent_id: parentId,
    format,
    content,
  };
};

export const normalizeAssistantUiStorageEntryRows = (
  entries: unknown,
  options: {
    format?: string | null;
  } = {},
): AssistantThreadMessageStorageEntry[] => {
  if (!Array.isArray(entries)) return [];
  const expectedFormat = readString(options.format);
  const seen = new Set<string>();
  const result: AssistantThreadMessageStorageEntry[] = [];

  for (const entry of entries) {
    const normalized = readAssistantUiStorageEntryRow(entry);
    if (!normalized || seen.has(normalized.id)) continue;
    if (expectedFormat && normalized.format !== expectedFormat) continue;
    seen.add(normalized.id);
    result.push(normalized);
  }

  const ids = new Set(result.map((entry) => entry.id));
  return result.map((entry) => ({
    ...entry,
    parent_id:
      entry.parent_id && ids.has(entry.parent_id) ? entry.parent_id : null,
  }));
};

export const toAssistantUiStorageEntry = (item: {
  parentId: string | null;
  message: unknown;
}): AssistantThreadMessageStorageEntry | null => {
  const message = normalizeAssistantUiMessage(item.message);
  if (!message) return null;

  const content = cloneJson({
    role: message.role,
    ...(message.metadata !== undefined ? { metadata: message.metadata } : {}),
    parts: message.parts,
  } satisfies AssistantUiStorageContent);
  if (!content) return null;

  return {
    id: message.id,
    parent_id: item.parentId ? String(item.parentId) : null,
    format: ASSISTANT_UI_MESSAGE_FORMAT,
    content,
  };
};

export const normalizeAssistantUiStorageEntries = (
  entries: unknown,
): Array<{ parentId: string | null; message: UIMessage }> => {
  if (!Array.isArray(entries)) return [];
  const seen = new Set<string>();
  const result: Array<{ parentId: string | null; message: UIMessage }> = [];
  for (const entry of entries) {
    const normalized = readAssistantUiStorageEntry(entry);
    if (!normalized || seen.has(normalized.message.id)) continue;
    seen.add(normalized.message.id);
    result.push(normalized);
  }
  return result;
};
