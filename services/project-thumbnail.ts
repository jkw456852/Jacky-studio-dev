import type { ChatMessage, Project } from "../types";

const BLOB_URL_PREFIX = /^blob:/i;

const normalizeThumbnailUrl = (
  value: string | null | undefined,
): string | null => {
  const normalized = String(value || "").trim();
  if (!normalized || BLOB_URL_PREFIX.test(normalized)) {
    return null;
  }
  return normalized;
};

const collectMessageImageCandidates = (message: ChatMessage): string[] => {
  const candidates: string[] = [];

  if (Array.isArray(message.inlineParts)) {
    message.inlineParts.forEach((part) => {
      if (part?.type === "attachment") {
        const normalized = normalizeThumbnailUrl(part.url);
        if (normalized) {
          candidates.push(normalized);
        }
      }
    });
  }

  if (Array.isArray(message.attachments)) {
    message.attachments.forEach((item) => {
      const normalized = normalizeThumbnailUrl(item);
      if (normalized) {
        candidates.push(normalized);
      }
    });
  }

  return candidates;
};

export const resolveFirstUploadedProjectThumbnail = (
  project: Project | null | undefined,
): string | null => {
  const conversations = Array.isArray(project?.conversations)
    ? [...project.conversations]
    : [];

  conversations.sort((left, right) => {
    const leftTime = Number(left.createdAt || 0);
    const rightTime = Number(right.createdAt || 0);
    return leftTime - rightTime;
  });

  for (const conversation of conversations) {
    const messages = Array.isArray(conversation.messages)
      ? [...conversation.messages]
      : [];

    messages.sort((left, right) => {
      const leftTime = Number(left.timestamp || 0);
      const rightTime = Number(right.timestamp || 0);
      return leftTime - rightTime;
    });

    for (const message of messages) {
      if (message.role !== "user") continue;
      const firstCandidate = collectMessageImageCandidates(message)[0];
      if (firstCandidate) {
        return firstCandidate;
      }
    }
  }

  return null;
};

export const resolveProjectThumbnail = (
  project: Project | null | undefined,
): string => {
  const uploadedThumbnail = resolveFirstUploadedProjectThumbnail(project);
  if (uploadedThumbnail) {
    return uploadedThumbnail;
  }

  const existingThumbnail = normalizeThumbnailUrl(project?.thumbnail);
  if (existingThumbnail) {
    return existingThumbnail;
  }

  const firstCanvasImage = (project?.elements || []).find(
    (element) => element.type === "image" || element.type === "gen-image",
  );

  return (
    normalizeThumbnailUrl(firstCanvasImage?.originalUrl) ||
    normalizeThumbnailUrl(firstCanvasImage?.url) ||
    ""
  );
};
