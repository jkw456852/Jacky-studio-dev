import type { ChatMessage } from "../../../types";

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

type AssetRecord = Record<string, unknown>;

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

const normalizeFileType = (value: unknown): "image" | "video" | null => {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    normalized === "image" ||
    normalized === "img" ||
    normalized === "photo" ||
    normalized === "picture"
  ) {
    return "image";
  }
  if (
    normalized === "video" ||
    normalized === "movie" ||
    normalized === "clip"
  ) {
    return "video";
  }
  return null;
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

const resolveFileType = (
  asset: AssetRecord | null,
  url: string,
  fallbackType: "image" | "video" | null,
): "image" | "video" => {
  return (
    inferFileTypeFromUrl(url) ||
    (asset ? normalizeFileType(asset.type ?? asset.kind) : null) ||
    fallbackType ||
    "image"
  );
};

const buildFallbackTitle = (
  type: "image" | "video",
  messageIndex: number,
  fileIndex: number,
): string =>
  `${type === "image" ? IMAGE_TITLE_PREFIX : VIDEO_TITLE_PREFIX} ${
    messageIndex + 1
  }-${fileIndex + 1}`;

const resolveTitle = (
  asset: AssetRecord | null,
  messageTitle: string | undefined,
  fallbackTitle: string,
): string => {
  if (messageTitle) return messageTitle;

  const assetMetadata = asset && isRecord(asset.metadata) ? asset.metadata : null;

  return (
    readString(asset?.title) ||
    readString(asset?.name) ||
    (assetMetadata
      ? readString(assetMetadata.title) || readString(assetMetadata.name)
      : undefined) ||
    fallbackTitle
  );
};

const resolveModel = (
  asset: AssetRecord | null,
  messageModel: string | undefined,
): string => {
  const assetMetadata = asset && isRecord(asset.metadata) ? asset.metadata : null;

  return (
    readString(asset?.model) ||
    (assetMetadata ? readString(assetMetadata.model) : undefined) ||
    messageModel ||
    DEFAULT_MODEL
  );
};

const createCandidate = (
  file: GeneratedConversationFile,
  priority: number,
): GeneratedFileCandidate => ({
  ...file,
  priority,
});

const appendUrlCandidates = ({
  urls,
  fallbackType,
  messageIndex,
  time,
  messageTitle,
  messageModel,
  priority,
}: {
  urls: unknown;
  fallbackType: "image" | "video";
  messageIndex: number;
  time: number;
  messageTitle: string | undefined;
  messageModel: string | undefined;
  priority: number;
}): GeneratedFileCandidate[] => {
  if (!Array.isArray(urls)) return [];

  return urls.flatMap((value, fileIndex) => {
    const url = readString(value);
    if (!url) return [];

    const type = resolveFileType(null, url, fallbackType);
    const title = messageTitle || buildFallbackTitle(type, messageIndex, fileIndex);

    return [
      createCandidate(
        {
          url,
          type,
          title,
          time,
          model: messageModel || DEFAULT_MODEL,
        },
        priority,
      ),
    ];
  });
};

export const getGeneratedConversationFilesFromAgentData = (
  agentData: ChatMessage["agentData"],
  time: number,
  messageIndex: number = 0,
): GeneratedConversationFile[] => {
  if (!agentData) return [];

  const messageTitle = readString(agentData.title);
  const messageModel = readString(agentData.model);

  const assetCandidates: GeneratedFileCandidate[] = Array.isArray(
    agentData.assets,
  )
    ? agentData.assets.flatMap((value, fileIndex) => {
        const asset = isRecord(value) ? value : null;
        const url = readString(asset?.url);
        if (!asset || !url) return [];

        const type = resolveFileType(asset, url, null);
        const title = resolveTitle(
          asset,
          messageTitle,
          buildFallbackTitle(type, messageIndex, fileIndex),
        );

        return [
          createCandidate(
            {
              url,
              type,
              title,
              time,
              model: resolveModel(asset, messageModel),
            },
            3,
          ),
        ];
      })
    : [];

  const videoCandidates = appendUrlCandidates({
    urls: agentData.videoUrls,
    fallbackType: "video",
    messageIndex,
    time,
    messageTitle,
    messageModel,
    priority: 2,
  });
  const imageCandidates = appendUrlCandidates({
    urls: agentData.imageUrls,
    fallbackType: "image",
    messageIndex,
    time,
    messageTitle,
    messageModel,
    priority: 1,
  });

  const deduped = new Map<string, GeneratedFileCandidate>();
  for (const candidate of [...assetCandidates, ...videoCandidates, ...imageCandidates]) {
    const existing = deduped.get(candidate.url);
    if (!existing || candidate.priority > existing.priority) {
      deduped.set(candidate.url, candidate);
    }
  }

  return Array.from(deduped.values()).map(({ priority, ...file }) => file);
};

export const getGeneratedConversationFiles = (
  messages: ChatMessage[],
): GeneratedConversationFile[] =>
  messages.flatMap((message, messageIndex) =>
    getGeneratedConversationFilesFromAgentData(
      message.agentData,
      message.timestamp,
      messageIndex,
    ),
  );
