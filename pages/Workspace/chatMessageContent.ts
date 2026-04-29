import type {
  ChatMessage,
  InputBlock,
  WorkspaceInputFile,
} from "../../types";
import { createImagePreviewDataUrl } from "./workspaceShared";

type MessageAttachmentMetadata = NonNullable<ChatMessage["attachmentMetadata"]>[number];

type BuildUserChatMessagePayloadArgs = {
  inputBlocks: InputBlock[];
  pendingFiles?: WorkspaceInputFile[];
  previewMaxDim?: number;
  previewQuality?: number;
};

const isTransientAttachmentPreviewUrl = (value: string | null | undefined) =>
  /^blob:/i.test(String(value || "").trim());

const stripFileExtension = (value: string | undefined) =>
  String(value || "").replace(/\.[^/.]+$/, "").trim();

const buildFileChipLabel = (
  file: WorkspaceInputFile,
  inputBlocks: InputBlock[],
  blockId?: string,
) => {
  if (file.markerId) {
    return String(file.markerName || "").trim() || "区域";
  }

  if (file._canvasAutoInsert) {
    let index = 0;
    for (const block of inputBlocks) {
      if (block.type !== "file" || !block.file?._canvasAutoInsert) continue;
      index += 1;
      if (block.id === blockId) {
        return `图片${index}`;
      }
    }
    return "图片";
  }

  if (file._canvasElId) {
    let index = 0;
    for (const block of inputBlocks) {
      if (
        block.type !== "file" ||
        !block.file?._canvasElId ||
        block.file?._canvasAutoInsert
      ) {
        continue;
      }
      index += 1;
      if (block.id === blockId) {
        return `参考内容 ${index}`;
      }
    }
    return "参考内容";
  }

  return stripFileExtension(file.name) || "参考内容";
};

const resolveAttachmentPreviewUrl = async (
  file: WorkspaceInputFile,
  maxDim: number,
  quality: number,
) => {
  if (
    file._chipPreviewUrl &&
    !isTransientAttachmentPreviewUrl(file._chipPreviewUrl)
  ) {
    return file._chipPreviewUrl;
  }

  const previewUrl = await createImagePreviewDataUrl(file, maxDim, quality);
  file._chipPreviewUrl = previewUrl;
  return previewUrl;
};

const buildAttachmentInlinePart = async ({
  file,
  inputBlocks,
  blockId,
  previewMaxDim,
  previewQuality,
}: {
  file: WorkspaceInputFile;
  inputBlocks: InputBlock[];
  blockId?: string;
  previewMaxDim: number;
  previewQuality: number;
}) => {
  const url = await resolveAttachmentPreviewUrl(file, previewMaxDim, previewQuality);
  const label = buildFileChipLabel(file, inputBlocks, blockId);
  const metadata: MessageAttachmentMetadata = {
    markerName: label,
    markerInfo: file.markerInfo,
  };

  return {
    inlinePart: {
      type: "attachment" as const,
      url,
      label,
      markerInfo: file.markerInfo,
    },
    attachmentUrl: url,
    attachmentMetadata: metadata,
  };
};

export const buildUserChatMessagePayloadFromInputBlocks = async ({
  inputBlocks,
  pendingFiles = [],
  previewMaxDim = 512,
  previewQuality = 0.82,
}: BuildUserChatMessagePayloadArgs) => {
  const inlineParts: NonNullable<ChatMessage["inlineParts"]> = [];
  const attachments: string[] = [];
  const attachmentMetadata: NonNullable<ChatMessage["attachmentMetadata"]> = [];

  for (const block of inputBlocks) {
    if (block.type === "text") {
      if (typeof block.text === "string" && block.text.length > 0) {
        inlineParts.push({
          type: "text",
          text: block.text,
        });
      }
      continue;
    }

    if (block.type !== "file" || !block.file) {
      continue;
    }

    const payload = await buildAttachmentInlinePart({
      file: block.file,
      inputBlocks,
      blockId: block.id,
      previewMaxDim,
      previewQuality,
    });
    inlineParts.push(payload.inlinePart);
    attachments.push(payload.attachmentUrl);
    attachmentMetadata.push(payload.attachmentMetadata);
  }

  for (const pendingFile of pendingFiles) {
    const payload = await buildAttachmentInlinePart({
      file: pendingFile,
      inputBlocks,
      previewMaxDim,
      previewQuality,
    });
    inlineParts.push(payload.inlinePart);
    attachments.push(payload.attachmentUrl);
    attachmentMetadata.push(payload.attachmentMetadata);
  }

  return {
    attachments: attachments.length > 0 ? attachments : undefined,
    attachmentMetadata:
      attachmentMetadata.length > 0 ? attachmentMetadata : undefined,
    inlineParts: inlineParts.length > 0 ? inlineParts : undefined,
  };
};
