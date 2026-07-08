import type { UIMessage } from "ai";
import type { ConversationSession } from "../../../types";
import {
  normalizeAssistantUiStorageEntries,
  normalizeAssistantUiStorageEntryRows,
} from "../../../services/assistant-ui/ui-message-normalization.ts";

export type GeneratedConversationFile = {
  url: string;
  type: "image" | "video";
  title: string;
  time: number;
  model: string;
};

type GeneratedFileCandidate = GeneratedConversationFile & {
  priority: number;
};

export type ConversationThreadAsset = {
  id: string;
  url: string;
  type: "image" | "video" | "file";
  title: string;
  time: number;
  source: "user" | "assistant";
  mediaType?: string;
  model?: string;
};

type ConversationThreadAssetCandidate = ConversationThreadAsset & {
  priority: number;
};

type AssetRecord = Record<string, unknown>;
type AssistantThread = ConversationSession["assistantThread"];
type AssistantUiPart = UIMessage["parts"][number];

const DEFAULT_MODEL = "AI";
const IMAGE_TITLE_PREFIX = "\u751f\u6210\u56fe\u7247";
const VIDEO_TITLE_PREFIX = "\u751f\u6210\u89c6\u9891";

const IMAGE_URL_PATTERN =
  /\.(?:png|jpe?g|webp|gif|bmp|svg|avif)(?:[?#].*)?$/i;
const VIDEO_URL_PATTERN =
  /\.(?:mp4|mov|webm|avi|mkv|m4v|mpeg|mpg)(?:[?#].*)?$/i;
const DATA_IMAGE_URL_PATTERN = /^data:image\//i;
const DATA_VIDEO_URL_PATTERN = /^data:video\//i;

const isRecord = (value: unknown): value is AssetRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const readNumber = (value: unknown): number | undefined => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const inferFileTypeFromUrl = (url: string): "image" | "video" | null => {
  if (!url) return null;
  if (DATA_VIDEO_URL_PATTERN.test(url) || VIDEO_URL_PATTERN.test(url)) {
    return "video";
  }
  if (DATA_IMAGE_URL_PATTERN.test(url) || IMAGE_URL_PATTERN.test(url)) {
    return "image";
  }
  return null;
};

const inferAssetType = (
  url: string,
  mediaType?: string,
): ConversationThreadAsset["type"] => {
  if (mediaType?.startsWith("image/")) return "image";
  if (mediaType?.startsWith("video/")) return "video";
  return inferFileTypeFromUrl(url) || "file";
};

const inferMediaTypeFromDataUrl = (url: string): string | undefined => {
  const match = /^data:([^;,]+)[;,]/i.exec(url);
  return match?.[1]?.trim() || undefined;
};

const buildFallbackTitle = (
  type: "image" | "video",
  messageIndex: number,
  fileIndex: number,
): string =>
  `${type === "image" ? IMAGE_TITLE_PREFIX : VIDEO_TITLE_PREFIX} ${
    messageIndex + 1
  }-${fileIndex + 1}`;

const buildFallbackAssetTitle = (
  type: ConversationThreadAsset["type"],
  messageIndex: number,
  fileIndex: number,
): string => {
  if (type === "file") return `文件 ${messageIndex + 1}-${fileIndex + 1}`;
  return buildFallbackTitle(type, messageIndex, fileIndex);
};

const resolveAssistantMessageTime = (
  message: UIMessage,
  messageIndex: number,
): number => {
  const metadata = isRecord(message.metadata) ? message.metadata : null;
  return (
    readNumber(metadata?.createdAt) ||
    readNumber(metadata?.timestamp) ||
    readNumber(metadata?.time) ||
    messageIndex + 1
  );
};

const resolveAssistantMessageModel = (
  message: UIMessage,
  fallbackModel?: string,
): string => {
  const metadata = isRecord(message.metadata) ? message.metadata : null;
  const providerId = readString(metadata?.providerId);
  const modelId = readString(metadata?.modelId);
  if (providerId && modelId) return `${providerId} - ${modelId}`;
  return modelId || providerId || fallbackModel || DEFAULT_MODEL;
};

const createCandidate = (
  file: GeneratedConversationFile,
  priority: number,
): GeneratedFileCandidate => ({
  ...file,
  priority,
});

const dedupeCandidates = (
  candidates: GeneratedFileCandidate[],
): GeneratedConversationFile[] => {
  const deduped = new Map<string, GeneratedFileCandidate>();
  for (const candidate of candidates) {
    const existing = deduped.get(candidate.url);
    if (!existing || candidate.priority > existing.priority) {
      deduped.set(candidate.url, candidate);
    }
  }

  return Array.from(deduped.values()).map(({ priority, ...file }) => file);
};

const dedupeAssetCandidates = (
  candidates: ConversationThreadAssetCandidate[],
): ConversationThreadAsset[] => {
  const deduped = new Map<string, ConversationThreadAssetCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.source}:${candidate.url}`;
    const existing = deduped.get(key);
    if (!existing || candidate.priority > existing.priority) {
      deduped.set(key, candidate);
    }
  }

  return Array.from(deduped.values()).map(({ priority, ...asset }) => asset);
};

const buildVisibleAssistantThreadMessageIds = (
  thread: AssistantThread | undefined,
): string[] => {
  const rows = normalizeAssistantUiStorageEntryRows(thread?.messages);
  if (!thread || rows.length === 0) return [];

  const parentById = new Map<string, string | null>();
  const orderedIds: string[] = [];

  for (const row of rows) {
    const id = readString(row.id);
    if (!id) continue;
    orderedIds.push(id);
    parentById.set(id, row.parent_id ? String(row.parent_id) : null);
  }

  const fallbackHeadId = orderedIds.at(-1) || "";
  const headId =
    thread.headId === null ? "" : readString(thread.headId) || fallbackHeadId;
  if (!headId || !parentById.has(headId)) return [];

  const path: string[] = [];
  const seen = new Set<string>();
  let currentId: string | null = headId;

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    path.push(currentId);
    currentId = parentById.get(currentId) ?? null;
  }

  return path.reverse();
};

const getVisibleAssistantThreadMessages = (
  thread: AssistantThread | undefined,
): UIMessage[] => {
  const visibleIds = buildVisibleAssistantThreadMessageIds(thread);
  if (visibleIds.length === 0) return [];

  const messagesById = new Map(
    normalizeAssistantUiStorageEntries(thread?.messages).map((entry) => [
      entry.message.id,
      entry.message,
    ]),
  );

  return visibleIds.flatMap((id) => {
    const message = messagesById.get(id);
    return message ? [message] : [];
  });
};

const getAssistantPartToolOutput = (
  part: AssistantUiPart,
  toolName: string,
): AssetRecord | null => {
  if (!isRecord(part)) return null;
  const partRecord = part as AssetRecord;
  const type = readString(partRecord.type);
  if (type !== `tool-${toolName}`) return null;
  const output = isRecord(partRecord.output) ? partRecord.output : null;
  return output;
};

const createAssistantFileCandidate = ({
  url,
  mediaType,
  filename,
  message,
  messageIndex,
  fileIndex,
  fallbackModel,
  priority,
}: {
  url: string;
  mediaType?: string;
  filename?: string;
  message: UIMessage;
  messageIndex: number;
  fileIndex: number;
  fallbackModel?: string;
  priority: number;
}): GeneratedFileCandidate | null => {
  const resolvedType =
    (mediaType?.startsWith("video/") ? "video" : null) ||
    (mediaType?.startsWith("image/") ? "image" : null) ||
    inferFileTypeFromUrl(url);
  if (!resolvedType) return null;

  return createCandidate(
    {
      url,
      type: resolvedType,
      title:
        filename ||
        buildFallbackTitle(resolvedType, messageIndex, fileIndex),
      time: resolveAssistantMessageTime(message, messageIndex),
      model: resolveAssistantMessageModel(message, fallbackModel),
    },
    priority,
  );
};

const extractAssistantGeneratedImageCandidates = (
  message: UIMessage,
  messageIndex: number,
): GeneratedFileCandidate[] =>
  message.parts.flatMap((part) => {
    const output = getAssistantPartToolOutput(part, "createImage");
    if (!output || !Array.isArray(output.images)) return [];

    const providerName =
      readString(output.providerName) || readString(output.providerId);
    const modelId = readString(output.modelId);
    const fallbackModel =
      providerName && modelId ? `${providerName} - ${modelId}` : modelId || providerName;

    return output.images.flatMap((item, fileIndex) => {
      const image = isRecord(item) ? item : null;
      const url =
        readString(image?.image) ||
        readString(image?.url) ||
        readString(item);
      if (!url) return [];

      const mediaType =
        readString(image?.mediaType) ||
        readString(image?.mimeType) ||
        inferMediaTypeFromDataUrl(url);
      const candidate = createAssistantFileCandidate({
        url,
        mediaType,
        filename:
          readString(image?.filename) ||
          readString(image?.name) ||
          undefined,
        message,
        messageIndex,
        fileIndex,
        fallbackModel,
        priority: 5,
      });
      return candidate ? [candidate] : [];
    });
  });

const extractAssistantFilePartCandidates = (
  message: UIMessage,
  messageIndex: number,
): GeneratedFileCandidate[] => {
  if (message.role !== "assistant") return [];

  return message.parts.flatMap((part, fileIndex) => {
    if (!isRecord(part)) return [];
    const partRecord = part as AssetRecord;
    const type = readString(partRecord.type);
    if (type !== "file") return [];

    const url =
      readString(partRecord.url) ||
      readString(partRecord.data) ||
      readString(partRecord.image);
    if (!url) return [];

    const mediaType =
      readString(partRecord.mediaType) ||
      readString(partRecord.mimeType) ||
      inferMediaTypeFromDataUrl(url);
    const candidate = createAssistantFileCandidate({
      url,
      mediaType,
      filename: readString(partRecord.filename) || readString(partRecord.name),
      message,
      messageIndex,
      fileIndex,
      priority: 4,
    });
    return candidate ? [candidate] : [];
  });
};

const createConversationThreadAssetCandidate = ({
  url,
  mediaType,
  filename,
  message,
  messageIndex,
  fileIndex,
  source,
  fallbackModel,
  priority,
}: {
  url: string;
  mediaType?: string;
  filename?: string;
  message: UIMessage;
  messageIndex: number;
  fileIndex: number;
  source: ConversationThreadAsset["source"];
  fallbackModel?: string;
  priority: number;
}): ConversationThreadAssetCandidate => {
  const type = inferAssetType(url, mediaType);
  const model =
    source === "assistant"
      ? resolveAssistantMessageModel(message, fallbackModel)
      : undefined;

  return {
    id: `${source}-${message.id || messageIndex}-${fileIndex}`,
    url,
    type,
    title: filename || buildFallbackAssetTitle(type, messageIndex, fileIndex),
    time: resolveAssistantMessageTime(message, messageIndex),
    source,
    mediaType,
    ...(model ? { model } : {}),
    priority,
  };
};

const extractConversationFilePartAssetCandidates = (
  message: UIMessage,
  messageIndex: number,
): ConversationThreadAssetCandidate[] =>
  message.parts.flatMap((part, fileIndex) => {
    if (!isRecord(part)) return [];
    const partRecord = part as AssetRecord;
    const type = readString(partRecord.type);
    if (type !== "file" && type !== "image") return [];

    const url =
      readString(partRecord.url) ||
      readString(partRecord.data) ||
      readString(partRecord.image);
    if (!url) return [];

    const mediaType =
      readString(partRecord.mediaType) ||
      readString(partRecord.mimeType) ||
      inferMediaTypeFromDataUrl(url);

    return [
      createConversationThreadAssetCandidate({
        url,
        mediaType,
        filename: readString(partRecord.filename) || readString(partRecord.name),
        message,
        messageIndex,
        fileIndex,
        source: message.role === "user" ? "user" : "assistant",
        priority: message.role === "user" ? 6 : 4,
      }),
    ];
  });

const extractGeneratedImageAssetCandidates = (
  message: UIMessage,
  messageIndex: number,
): ConversationThreadAssetCandidate[] =>
  message.parts.flatMap((part) => {
    const output = getAssistantPartToolOutput(part, "createImage");
    if (!output || !Array.isArray(output.images)) return [];

    const providerName =
      readString(output.providerName) || readString(output.providerId);
    const modelId = readString(output.modelId);
    const fallbackModel =
      providerName && modelId ? `${providerName} - ${modelId}` : modelId || providerName;

    return output.images.flatMap((item, fileIndex) => {
      const image = isRecord(item) ? item : null;
      const url =
        readString(image?.image) ||
        readString(image?.url) ||
        readString(item);
      if (!url) return [];

      const mediaType =
        readString(image?.mediaType) ||
        readString(image?.mimeType) ||
        inferMediaTypeFromDataUrl(url);

      return [
        createConversationThreadAssetCandidate({
          url,
          mediaType,
          filename:
            readString(image?.filename) ||
            readString(image?.name) ||
            undefined,
          message,
          messageIndex,
          fileIndex,
          source: "assistant",
          fallbackModel,
          priority: 8,
        }),
      ];
    });
  });

export const getGeneratedConversationFilesFromAssistantThread = (
  thread: AssistantThread | undefined,
): GeneratedConversationFile[] => {
  const messages = getVisibleAssistantThreadMessages(thread);
  return dedupeCandidates(
    messages.flatMap((message, messageIndex) => [
      ...extractAssistantGeneratedImageCandidates(message, messageIndex),
      ...extractAssistantFilePartCandidates(message, messageIndex),
    ]),
  );
};

export const getConversationAssetsFromAssistantThread = (
  thread: AssistantThread | undefined,
): ConversationThreadAsset[] => {
  const messages = getVisibleAssistantThreadMessages(thread);
  return dedupeAssetCandidates(
    messages.flatMap((message, messageIndex) => [
      ...extractGeneratedImageAssetCandidates(message, messageIndex),
      ...extractConversationFilePartAssetCandidates(message, messageIndex),
    ]),
  ).sort((left, right) => left.time - right.time);
};

export const getGeneratedConversationImageUrls = (
  conversation: Pick<ConversationSession, "assistantThread">,
): string[] => {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const file of getGeneratedConversationFilesFromAssistantThread(
    conversation.assistantThread,
  )) {
    if (file.type !== "image") continue;
    const normalized = String(file.url || "").trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    urls.push(normalized);
  }

  return urls;
};
