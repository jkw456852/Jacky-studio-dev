"use client";

import React, { memo } from "react";
import {
  AssistantRuntimeProvider,
  CompositeAttachmentAdapter,
  McpAppRenderer,
  McpAppsRemoteHost,
  ModelContextRegistry,
  RuntimeAdapterProvider,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  Suggestions,
  Tools,
  unstable_Interactables,
  useAssistantContext,
  useAssistantInstructions,
  useAui,
  useAuiState,
  useRemoteThreadListRuntime,
  WebSpeechDictationAdapter,
  WebSpeechSynthesisAdapter,
  useAuiToolOverrides,
  type AttachmentAdapter,
  type CompleteAttachment,
  type CreateAttachment,
  type GenericThreadHistoryAdapter,
  type FeedbackAdapter,
  type ModelContext,
  type MessageFormatAdapter,
  type MessageFormatItem,
  type RemoteThreadListAdapter,
  type SuggestionConfig,
  type ThreadHistoryAdapter,
  type ThreadMessage,
} from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useChatRuntime,
  useThreadTokenUsage,
  type ResumableClientStorage,
} from "@assistant-ui/react-ai-sdk";
import { DevToolsModal } from "@assistant-ui/react-devtools";
import { createAssistantStream } from "assistant-stream";
import {
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import {
  DownloadIcon,
  FileIcon,
  FolderOpenIcon,
  History as HistoryIcon,
  ImageIcon,
  Maximize2Icon,
  Minimize2Icon,
  PanelRightCloseIcon,
  PaperclipIcon,
  PlusIcon,
  VideoIcon,
} from "lucide-react";

import {
  ModelSelector,
  resolveModelEffort,
  type ModelSelectorEffortOption,
  type ModelOption,
} from "@/components/assistant-ui/model-selector";
import { ContextDisplay } from "@/components/assistant-ui/context-display";
import { DotMatrix } from "@/components/assistant-ui/dot-matrix";
import { Thread as AssistantThread } from "@/components/assistant-ui/thread";
import { ThreadListSidebar } from "@/components/assistant-ui/threadlist-sidebar";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { getBestModelSelection, type BestModelSelection } from "../../../services/gemini.ts";
import { getApiKey, getProviderConfigById } from "../../../services/provider-config.ts";
import { loadSearchSettings } from "../../../services/search-settings.ts";
import { useImageHostStore } from "../../../stores/imageHost.store.ts";
import { uploadImage } from "../../../utils/uploader.ts";
import {
  deleteProjectConversationBackup,
  markProjectConversationDeleted,
} from "../../../services/storage.ts";
import {
  getMappedModelConfigs,
  type MappedModelConfig,
} from "../../../services/provider-settings.ts";
import {
  normalizeAssistantUiStorageEntryRows,
} from "../../../services/assistant-ui/ui-message-normalization.ts";
import { resolveAssistantModelContextWindow } from "../../../services/assistant-ui/model-context-window.ts";
import type {
  AssistantSidebarCreateTargetElementArgs,
} from "../../../services/assistant-ui/assistant-sidebar-tool-schemas.ts";
import type {
  AssistantThreadMessageStorageEntry,
  ConversationSession,
} from "../../../types/index.ts";
import type {
  AssistantSidebarConversation,
  AssistantSidebarProps,
} from "./assistantSidebar.types";
import { AssistantSidebarImageSettingsInteractable } from "./assistantSidebarImageSettingsInteractable.tsx";
import assistantSidebarToolkit from "./assistantSidebarToolkit.tsx";
import {
  applyAssistantThreadSubmittedFeedback,
} from "../controllers/assistantThreadRepository.ts";
import {
  getConversationAssetsFromAssistantThread,
  type ConversationThreadAsset,
} from "./generatedFiles.ts";

const ASSISTANT_SIDEBAR_SYSTEM_PROMPT =
  "You are the chat-first sidebar assistant in an AI design workspace. " +
  "Answer naturally and concisely in the user's language. " +
  "Do not expose internal JSON, workflow logs, routing decisions, hidden prompts, or implementation traces. " +
  "Use tools only when they are provided through assistant-ui/AI SDK tool calls.";
const ASSISTANT_SIDEBAR_MODEL_INSTRUCTIONS =
  "You are the assistant-ui powered sidebar for an AI design workspace. " +
  "Prefer concise, direct answers. Use tools or skills only when they materially help the user.\n\n" +
  ASSISTANT_SIDEBAR_SYSTEM_PROMPT;

const ASSISTANT_SIDEBAR_PAGE_INSTANCE_ID = `page-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 10)}`;
const ASSISTANT_SIDEBAR_RESUMABLE_METADATA_KEY =
  "xc-studio:assistant-chat:resumable:metadata";
const ASSISTANT_SIDEBAR_MCP_APPS_URL = "/api/mcp-apps";
const ASSISTANT_SIDEBAR_ATTACHMENT_MAX_DATA_URL_CHARS = 120_000;
const ASSISTANT_SIDEBAR_ATTACHMENT_MAX_EDGE = 1600;
const ASSISTANT_SIDEBAR_ATTACHMENT_MIN_QUALITY = 0.58;
const ASSISTANT_SIDEBAR_ATTACHMENT_MIN_EDGE = 384;

type AssistantSidebarResumableMetadata = Record<
  string,
  {
    createdAt: number;
    ownerId: string;
    storageKey: string;
  }
>;

const readAssistantSidebarResumableMetadata =
  (): AssistantSidebarResumableMetadata => {
    if (typeof window === "undefined") return {};

    try {
      const raw = window.sessionStorage.getItem(
        ASSISTANT_SIDEBAR_RESUMABLE_METADATA_KEY,
      );
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as AssistantSidebarResumableMetadata)
        : {};
    } catch {
      return {};
    }
  };

const writeAssistantSidebarResumableMetadata = (
  metadata: AssistantSidebarResumableMetadata,
) => {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      ASSISTANT_SIDEBAR_RESUMABLE_METADATA_KEY,
      JSON.stringify(metadata),
    );
  } catch {
    // If sessionStorage is unavailable or full, fall back to non-resumable chat.
  }
};

const createAssistantSidebarResumableStorage = (options: {
  key: string;
  ownerId: string;
}): ResumableClientStorage => {
  const ownerKey = `${options.key}:owner`;

  return {
    getStreamId() {
      if (typeof window === "undefined") return null;
      const streamId = window.sessionStorage.getItem(options.key);
      if (!streamId) return null;

      const metadata = readAssistantSidebarResumableMetadata();
      const entry = metadata[streamId];
      if (!entry?.ownerId) {
        window.sessionStorage.removeItem(options.key);
        window.sessionStorage.removeItem(ownerKey);
        return null;
      }
      if (entry.ownerId === options.ownerId) {
        return null;
      }

      return streamId;
    },
    setStreamId(id) {
      if (typeof window === "undefined") return;
      window.sessionStorage.setItem(options.key, id);
      window.sessionStorage.setItem(ownerKey, options.ownerId);
      const metadata = readAssistantSidebarResumableMetadata();
      metadata[id] = {
        createdAt: Date.now(),
        ownerId: options.ownerId,
        storageKey: options.key,
      };
      writeAssistantSidebarResumableMetadata(metadata);
    },
    clear() {
      if (typeof window === "undefined") return;
      const streamId = window.sessionStorage.getItem(options.key);
      window.sessionStorage.removeItem(options.key);
      window.sessionStorage.removeItem(ownerKey);
      if (streamId) {
        const metadata = readAssistantSidebarResumableMetadata();
        if (metadata[streamId]) {
          delete metadata[streamId];
          writeAssistantSidebarResumableMetadata(metadata);
        }
      }
    },
  };
};

const assistantSidebarShouldSendAutomatically = (options: {
  messages: UIMessage[];
}) =>
  lastAssistantMessageIsCompleteWithToolCalls(options) ||
  lastAssistantMessageIsCompleteWithApprovalResponses(options);

const getAssistantSidebarFileDataUrl = async (file: File): Promise<string> => {
  if (typeof FileReader === "undefined") {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return `data:${file.type || "application/octet-stream"};base64,${btoa(binary)}`;
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read attachment."));
    reader.readAsDataURL(file);
  });
};

const loadAssistantSidebarImageElement = async (file: File): Promise<HTMLImageElement> => {
  const dataUrl = await getAssistantSidebarFileDataUrl(file);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image attachment."));
    image.src = dataUrl;
  });
};

const canvasToAssistantSidebarDataUrl = (
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): string =>
  canvas.toDataURL(type, quality);

const compressAssistantSidebarImageFile = async (file: File): Promise<{
  dataUrl: string;
  mediaType: string;
  compressed: boolean;
  originalChars: number;
  sentChars: number;
}> => {
  const originalDataUrl = await getAssistantSidebarFileDataUrl(file);
  const mustUseCompressedAttachment =
    originalDataUrl.length > ASSISTANT_SIDEBAR_ATTACHMENT_MAX_DATA_URL_CHARS;
  if (
    !mustUseCompressedAttachment ||
    typeof document === "undefined"
  ) {
    return {
      dataUrl: originalDataUrl,
      mediaType: file.type || "image/png",
      compressed: false,
      originalChars: originalDataUrl.length,
      sentChars: originalDataUrl.length,
    };
  }

  const image = await loadAssistantSidebarImageElement(file);
  const sourceWidth = image.naturalWidth || image.width || 1;
  const sourceHeight = image.naturalHeight || image.height || 1;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    return {
      dataUrl: originalDataUrl,
      mediaType: file.type || "image/png",
      compressed: false,
      originalChars: originalDataUrl.length,
      sentChars: originalDataUrl.length,
    };
  }

  let edge = Math.min(
    ASSISTANT_SIDEBAR_ATTACHMENT_MAX_EDGE,
    Math.max(sourceWidth, sourceHeight),
  );
  let bestDataUrl = originalDataUrl;

  while (edge >= ASSISTANT_SIDEBAR_ATTACHMENT_MIN_EDGE) {
    const scale = Math.min(1, edge / Math.max(sourceWidth, sourceHeight));
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, targetWidth, targetHeight);
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    let quality = 0.82;
    while (quality >= ASSISTANT_SIDEBAR_ATTACHMENT_MIN_QUALITY) {
      const nextDataUrl = canvasToAssistantSidebarDataUrl(
        canvas,
        "image/jpeg",
        quality,
      );
      if (nextDataUrl.length < bestDataUrl.length) {
        bestDataUrl = nextDataUrl;
      }
      if (nextDataUrl.length <= ASSISTANT_SIDEBAR_ATTACHMENT_MAX_DATA_URL_CHARS) {
        return {
          dataUrl: nextDataUrl,
          mediaType: "image/jpeg",
          compressed: true,
          originalChars: originalDataUrl.length,
          sentChars: nextDataUrl.length,
        };
      }
      quality -= 0.08;
    }

    edge = Math.floor(edge * 0.78);
  }

  if (bestDataUrl.length > ASSISTANT_SIDEBAR_ATTACHMENT_MAX_DATA_URL_CHARS) {
    const scale = Math.min(
      1,
      ASSISTANT_SIDEBAR_ATTACHMENT_MIN_EDGE /
        Math.max(sourceWidth, sourceHeight),
    );
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, targetWidth, targetHeight);
    context.drawImage(image, 0, 0, targetWidth, targetHeight);
    bestDataUrl = canvasToAssistantSidebarDataUrl(
      canvas,
      "image/jpeg",
      ASSISTANT_SIDEBAR_ATTACHMENT_MIN_QUALITY,
    );
  }

  if (!mustUseCompressedAttachment && bestDataUrl.length >= originalDataUrl.length) {
    return {
      dataUrl: originalDataUrl,
      mediaType: file.type || "image/png",
      compressed: false,
      originalChars: originalDataUrl.length,
      sentChars: originalDataUrl.length,
    };
  }

  return {
    dataUrl: bestDataUrl,
    mediaType: "image/jpeg",
    compressed: true,
    originalChars: originalDataUrl.length,
    sentChars: bestDataUrl.length,
  };
};

const compressAssistantSidebarImageDataUrl = async (
  dataUrl: string,
  fallbackName: string,
): Promise<{
  dataUrl: string;
  mediaType: string;
  compressed: boolean;
  originalChars: number;
  sentChars: number;
}> => {
  const file = dataUrlToAssistantSidebarFile(dataUrl, fallbackName);
  if (!file) {
    return {
      dataUrl,
      mediaType: /^data:([^;,]+)[;,]/i.exec(dataUrl)?.[1] || "image/png",
      compressed: false,
      originalChars: dataUrl.length,
      sentChars: dataUrl.length,
    };
  }
  return compressAssistantSidebarImageFile(file);
};

const isAssistantSidebarHttpImageUrl = (value: unknown): boolean =>
  /^https?:\/\//i.test(String(value || "").trim());

const isAssistantSidebarInlineImageUrl = (value: unknown): boolean =>
  /^(?:data:image\/|blob:)/i.test(String(value || "").trim());

const assistantSidebarHostedImageCache = new Map<string, Promise<string>>();

const dataUrlToAssistantSidebarFile = (
  dataUrl: string,
  fallbackName: string,
): File | null => {
  const match = /^data:([^;,]+);base64,([\s\S]+)$/i.exec(dataUrl);
  if (!match || !match[1].startsWith("image/")) return null;

  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const extension = match[1].includes("jpeg")
      ? "jpg"
      : match[1].split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "png";
    return new File([bytes], fallbackName || `assistant-image.${extension}`, {
      type: match[1],
    });
  } catch {
    return null;
  }
};

const urlToAssistantSidebarImageFile = async (
  imageUrl: string,
  fallbackName: string,
): Promise<File | null> => {
  const normalized = String(imageUrl || "").trim();
  if (!normalized) return null;

  if (/^data:image\//i.test(normalized)) {
    return dataUrlToAssistantSidebarFile(normalized, fallbackName);
  }

  if (!/^blob:/i.test(normalized)) return null;

  try {
    const response = await fetch(normalized);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return null;
    return new File([blob], fallbackName || "assistant-image.png", {
      type: blob.type || "image/png",
    });
  } catch {
    return null;
  }
};

const uploadAssistantSidebarImageFile = async (
  file: File,
): Promise<string | null> => {
  const hostedUrl = await uploadImage(file);
  return isAssistantSidebarHttpImageUrl(hostedUrl) ? hostedUrl : null;
};

const ensureAssistantSidebarHostedImageUrl = async (
  imageUrl: string,
  options: {
    fallbackName: string;
    logContext?: Record<string, unknown>;
  },
): Promise<string> => {
  const normalized = String(imageUrl || "").trim();
  if (!normalized || isAssistantSidebarHttpImageUrl(normalized)) {
    return normalized;
  }
  if (!isAssistantSidebarInlineImageUrl(normalized)) {
    return normalized;
  }

  const hostProvider = useImageHostStore.getState().selectedProvider;

  const cacheKey = `${hostProvider}\u0000${normalized}`;
  let uploadPromise = assistantSidebarHostedImageCache.get(cacheKey);
  if (!uploadPromise) {
    uploadPromise = (async () => {
      const file = await urlToAssistantSidebarImageFile(
        normalized,
        options.fallbackName,
      );
      if (!file) return normalized;

      if (hostProvider !== "none") {
        try {
          const hostedUrl = await uploadAssistantSidebarImageFile(file);
          if (hostedUrl) {
            logAssistantSidebar("image_reference_hosted", {
              provider: hostProvider,
              sourceKind: normalized.startsWith("blob:") ? "blob" : "data-url",
              compressed: false,
              ...options.logContext,
            });
            return hostedUrl;
          }
        } catch (error) {
          console.warn("[assistant-sidebar] image host upload failed", {
            provider: hostProvider,
            error: getClientErrorMessage(error),
            ...options.logContext,
          });
        }
      }

      const compressed = await compressAssistantSidebarImageFile(file);
      if (hostProvider !== "none") {
        const compressedFile = dataUrlToAssistantSidebarFile(
          compressed.dataUrl,
          options.fallbackName,
        );
        if (compressedFile) {
          try {
            const hostedUrl = await uploadAssistantSidebarImageFile(compressedFile);
            if (hostedUrl) {
              logAssistantSidebar("image_reference_hosted", {
                provider: hostProvider,
                sourceKind: normalized.startsWith("blob:") ? "blob" : "data-url",
                compressed: true,
                originalChars: compressed.originalChars,
                sentChars: compressed.sentChars,
                ...options.logContext,
              });
              return hostedUrl;
            }
          } catch (error) {
            console.warn("[assistant-sidebar] compressed image host upload failed", {
              provider: hostProvider,
              error: getClientErrorMessage(error),
              originalChars: compressed.originalChars,
              sentChars: compressed.sentChars,
              ...options.logContext,
            });
          }
        }
      }

      if (compressed.dataUrl !== normalized) {
        logAssistantSidebar("image_reference_compressed", {
          sourceKind: normalized.startsWith("blob:") ? "blob" : "data-url",
          originalChars: compressed.originalChars,
          sentChars: compressed.sentChars,
          compressed: compressed.compressed,
          ...options.logContext,
        });
      }
      return compressed.dataUrl || normalized;
    })();
    assistantSidebarHostedImageCache.set(cacheKey, uploadPromise);
  }

  try {
    const hostedUrl = await uploadPromise;
    return hostedUrl || normalized;
  } catch (error) {
    console.warn("[assistant-sidebar] image reference preparation failed", {
      provider: hostProvider,
      error: getClientErrorMessage(error),
      ...options.logContext,
    });
  }

  return normalized;
};

const getAssistantSidebarImagePartUrl = (
  part: unknown,
): string => {
  if (!part || typeof part !== "object" || Array.isArray(part)) return "";
  const record = part as Record<string, unknown>;
  return String(
    record.originalUrl ||
      record.sourceUrl ||
      record.fullImageUrl ||
      record.image ||
      record.url ||
      record.data ||
      "",
  ).trim();
};

const prepareAssistantSidebarMessageImagesForRequest = async (
  messages: UIMessage[],
): Promise<{
  messages: UIMessage[];
  preparedCount: number;
  hostedOrCompressedCount: number;
}> => {
  let preparedCount = 0;
  let hostedOrCompressedCount = 0;
  const nextMessages = await Promise.all(
    messages.map(async (message) => {
      let changed = false;
      const nextParts = await Promise.all(
        message.parts.map(async (part) => {
          if (!part || typeof part !== "object" || Array.isArray(part)) {
            return part;
          }
          const record = part as Record<string, unknown>;
          const type = String(record.type || "").trim();
          if (type !== "image" && type !== "file") return part;

          const sourceUrl = getAssistantSidebarImagePartUrl(record);
          if (!isAssistantSidebarInlineImageUrl(sourceUrl)) return part;

          const filename = String(record.filename || "").trim() ||
            `${type}-reference.png`;
          const preparedUrl = await ensureAssistantSidebarHostedImageUrl(
            sourceUrl,
            {
              fallbackName: filename,
              logContext: {
                referenceKind: "message-part",
                partType: type,
                messageId: message.id,
              },
            },
          );
          if (!preparedUrl || preparedUrl === sourceUrl) return part;

          preparedCount += 1;
          hostedOrCompressedCount += 1;
          changed = true;
          if (type === "file") {
            const nextPart: Record<string, unknown> = {
              ...record,
              url: preparedUrl,
            };
            if (typeof nextPart.data === "string") {
              delete nextPart.data;
            }
            return nextPart as UIMessage["parts"][number];
          }

          const nextPart: Record<string, unknown> = {
            ...record,
            image: preparedUrl,
          };
          if (typeof nextPart.url === "string") {
            nextPart.url = preparedUrl;
          }
          if (typeof nextPart.data === "string") {
            delete nextPart.data;
          }
          return nextPart as UIMessage["parts"][number];
        }),
      );

      return !changed
        ? message
        : {
            ...message,
            parts: nextParts as UIMessage["parts"],
          };
    }),
  );

  return {
    messages: nextMessages,
    preparedCount,
    hostedOrCompressedCount,
  };
};

class AssistantSidebarCompressedImageAttachmentAdapter extends SimpleImageAttachmentAdapter {
  public override async send(
    attachment: Parameters<SimpleImageAttachmentAdapter["send"]>[0],
  ): Promise<CompleteAttachment> {
    const hostProvider = useImageHostStore.getState().selectedProvider;
    if (hostProvider !== "none") {
      try {
        const hostedUrl = await uploadAssistantSidebarImageFile(attachment.file);
        if (hostedUrl) {
          logAssistantSidebar("attachment_image_hosted", {
            name: attachment.name,
            provider: hostProvider,
            originalBytes: attachment.file.size,
            mediaType: attachment.file.type || "image/png",
          });
          return {
            ...attachment,
            contentType: attachment.file.type || "image/png",
            status: { type: "complete" },
            content: [
              {
                type: "image",
                image: hostedUrl,
                filename: attachment.name,
              },
            ],
          };
        }
      } catch (error) {
        console.warn("[assistant-sidebar] attachment image host upload failed", {
          name: attachment.name,
          provider: hostProvider,
          error: getClientErrorMessage(error),
        });
      }
    }

    const compressed = await compressAssistantSidebarImageFile(attachment.file);
    if (hostProvider !== "none") {
      const compressedFile = dataUrlToAssistantSidebarFile(
        compressed.dataUrl,
        attachment.name,
      );
      if (compressedFile) {
        try {
          const hostedUrl = await uploadAssistantSidebarImageFile(compressedFile);
          if (hostedUrl) {
            logAssistantSidebar("attachment_image_hosted", {
              name: attachment.name,
              provider: hostProvider,
              originalBytes: attachment.file.size,
              originalChars: compressed.originalChars,
              sentChars: compressed.sentChars,
              compressed: true,
              mediaType: compressed.mediaType,
            });
            return {
              ...attachment,
              contentType: compressed.mediaType,
              status: { type: "complete" },
              content: [
                {
                  type: "image",
                  image: hostedUrl,
                  filename: attachment.name,
                },
              ],
            };
          }
        } catch (error) {
          console.warn("[assistant-sidebar] compressed attachment image host upload failed", {
            name: attachment.name,
            provider: hostProvider,
            error: getClientErrorMessage(error),
            originalChars: compressed.originalChars,
            sentChars: compressed.sentChars,
          });
        }
      }
    }

    logAssistantSidebar("attachment_image_prepared", {
      name: attachment.name,
      originalChars: compressed.originalChars,
      sentChars: compressed.sentChars,
      compressed: compressed.compressed,
      mediaType: compressed.mediaType,
      maxDataUrlChars: ASSISTANT_SIDEBAR_ATTACHMENT_MAX_DATA_URL_CHARS,
    });
    return {
      ...attachment,
      contentType: compressed.mediaType,
      status: { type: "complete" },
      content: [
        {
          type: "file",
          data: compressed.dataUrl,
          mimeType: compressed.mediaType,
          filename: attachment.name,
        },
      ],
    };
  }
}

const createAssistantSidebarAttachmentAdapter = (): AttachmentAdapter =>
  new CompositeAttachmentAdapter([
    new AssistantSidebarCompressedImageAttachmentAdapter(),
    new SimpleTextAttachmentAdapter(),
  ]);

const getFirstAssistantChatApiKey = (
  providerId: string | null | undefined,
): string => {
  const raw = getApiKey(false, providerId);
  return Array.isArray(raw) ? String(raw[0] || "").trim() : String(raw || "").trim();
};

const buildAssistantChatProviderConfig = (
  providerId: string | null | undefined,
) => {
  const provider = getProviderConfigById(providerId);
  return {
    id: provider.id,
    name: provider.name || provider.id,
    baseUrl: provider.baseUrl || null,
    apiKey: getFirstAssistantChatApiKey(providerId),
  };
};

type AssistantSidebarModelContextConfig = {
  apiKey: string;
  baseUrl?: string | undefined;
};

type AssistantSidebarModelOption = ModelOption & {
  providerLabel: string;
};

type AssistantSidebarModelGroup = {
  label: string;
  models: AssistantSidebarModelOption[];
};

const buildModelContextRegistry = (options: {
  provider: ReturnType<typeof buildAssistantChatProviderConfig>;
}) => {
  const registry = new ModelContextRegistry();
  registry.addProvider({
    getModelContext: () => ({
      config: {
        apiKey: options.provider.apiKey,
        baseUrl: options.provider.baseUrl || undefined,
      } satisfies AssistantSidebarModelContextConfig & NonNullable<ModelContext["config"]>,
    }),
  });
  return registry;
};

const toAssistantModelValue = (
  modelId: string,
  providerId: string | null | undefined,
) => {
  const normalizedModelId = String(modelId || "").trim();
  const normalizedProviderId = String(providerId || "").trim();
  if (!normalizedModelId) return "";
  return normalizedProviderId
    ? `${normalizedProviderId}:${normalizedModelId}`
    : normalizedModelId;
};

const parseAssistantModelValue = (
  value: string,
): BestModelSelection => {
  const raw = String(value || "").trim();
  const separatorIndex = raw.indexOf(":");
  if (separatorIndex <= 0) {
    return { modelId: raw, providerId: null };
  }
  return {
    providerId: raw.slice(0, separatorIndex).trim() || null,
    modelId: raw.slice(separatorIndex + 1).trim(),
  };
};

const isLikelyReasoningModel = (modelId: string): boolean => {
  const normalized = String(modelId || "").toLowerCase();
  return (
    normalized.startsWith("o1") ||
    normalized.startsWith("o3") ||
    normalized.startsWith("o4") ||
    normalized.startsWith("gpt-5") ||
    normalized.includes("thinking") ||
    normalized.includes("reasoning") ||
    normalized.includes("pro")
  );
};

const OPENAI_GPT5_REASONING_EFFORTS: readonly ModelSelectorEffortOption[] = [
  { id: "minimal", name: "最少" },
  { id: "low", name: "低" },
  { id: "medium", name: "中" },
  { id: "high", name: "高" },
];

const OPENAI_GPT51_REASONING_EFFORTS: readonly ModelSelectorEffortOption[] = [
  { id: "none", name: "关闭" },
  { id: "minimal", name: "最少" },
  { id: "low", name: "低" },
  { id: "medium", name: "中" },
  { id: "high", name: "高" },
];

const OPENAI_GPT51_CODEX_MAX_REASONING_EFFORTS: readonly ModelSelectorEffortOption[] = [
  ...OPENAI_GPT51_REASONING_EFFORTS,
  { id: "xhigh", name: "极高" },
];

const OPENAI_COMPATIBLE_REASONING_EFFORTS: readonly ModelSelectorEffortOption[] = [
  { id: "none", name: "关闭" },
  { id: "minimal", name: "最少" },
  { id: "low", name: "低" },
  { id: "medium", name: "中" },
  { id: "high", name: "高" },
  { id: "xhigh", name: "极高" },
];

const OPENAI_STANDARD_REASONING_EFFORTS: readonly ModelSelectorEffortOption[] = [
  { id: "low", name: "低" },
  { id: "medium", name: "中" },
  { id: "high", name: "高" },
];

const GEMINI_3_FLASH_REASONING_EFFORTS: readonly ModelSelectorEffortOption[] = [
  { id: "minimal", name: "最少" },
  { id: "low", name: "低" },
  { id: "medium", name: "中" },
  { id: "high", name: "高" },
];

const GEMINI_3_PRO_REASONING_EFFORTS: readonly ModelSelectorEffortOption[] = [
  { id: "low", name: "低" },
  { id: "high", name: "高" },
];

const GEMINI_31_PRO_REASONING_EFFORTS: readonly ModelSelectorEffortOption[] = [
  { id: "low", name: "低" },
  { id: "medium", name: "中" },
  { id: "high", name: "高" },
];

const getReasoningEffortsForModel = (
  modelId: string,
  provider?: ReturnType<typeof buildAssistantChatProviderConfig>,
): readonly ModelSelectorEffortOption[] | undefined => {
  const normalized = String(modelId || "").toLowerCase();
  if (provider && !isAssistantSidebarGoogleProvider(provider)) {
    if (isAssistantSidebarOfficialOpenAIProvider(provider)) {
      // Official OpenAI Responses models have documented restrictions:
      // xhigh is only valid for GPT-5.1-Codex-Max, and none is GPT-5.1 only.
    } else {
      return isLikelyReasoningModel(modelId)
        ? OPENAI_COMPATIBLE_REASONING_EFFORTS
        : undefined;
    }
  }
  if (
    normalized.startsWith("o1") ||
    normalized.startsWith("o3") ||
    normalized.startsWith("o4")
  ) {
    return OPENAI_STANDARD_REASONING_EFFORTS;
  }
  if (normalized.startsWith("gpt-5")) {
    if (
      normalized.startsWith("gpt-5.1-codex-max") ||
      normalized.startsWith("gpt-5-1-codex-max")
    ) {
      return OPENAI_GPT51_CODEX_MAX_REASONING_EFFORTS;
    }
    if (
      normalized.startsWith("gpt-5.1") ||
      normalized.startsWith("gpt-5-1")
    ) {
      return OPENAI_GPT51_REASONING_EFFORTS;
    }
    return OPENAI_GPT5_REASONING_EFFORTS;
  }
  if (normalized.includes("gemini-3.1-pro")) {
    return GEMINI_31_PRO_REASONING_EFFORTS;
  }
  if (normalized.includes("gemini-3") && normalized.includes("flash")) {
    return GEMINI_3_FLASH_REASONING_EFFORTS;
  }
  if (normalized.includes("gemini-3") && normalized.includes("pro")) {
    return GEMINI_3_PRO_REASONING_EFFORTS;
  }
  return isLikelyReasoningModel(modelId)
    ? OPENAI_STANDARD_REASONING_EFFORTS
    : undefined;
};

const getDefaultReasoningEffortForSelection = (
  modelOptions: readonly AssistantSidebarModelOption[],
  selectedModelValue: string,
  modelMode: string,
): string | undefined => {
  const preferred = modelMode === "thinking" ? "high" : "medium";
  const resolvedPreferred = resolveModelEffort(
    modelOptions,
    selectedModelValue,
    preferred,
  );
  if (resolvedPreferred) return resolvedPreferred;

  if (modelMode === "thinking") {
    return resolveModelEffort(modelOptions, selectedModelValue, "medium");
  }

  return undefined;
};

type AssistantSidebarReasoningDiagnosisCause =
  | "request_did_not_ask_for_reasoning"
  | "reasoning_returned"
  | "upstream_returned_final_answer_without_reasoning";

type AssistantSidebarReasoningRuntimeDiagnosis = {
  elapsedMs: number;
  likelyCause: AssistantSidebarReasoningDiagnosisCause;
  reasoningRequested: boolean;
  reasoningReturned: boolean;
  requestId: string | null;
  requestedReasoningEffort?: string | undefined;
  url: string;
};

type AssistantSidebarStreamStatusStage =
  | "request-received"
  | "model-start"
  | "model-step"
  | "tool-start"
  | "tool-finish"
  | "complete"
  | "error";

type AssistantSidebarStreamStatus = {
  stage: AssistantSidebarStreamStatusStage;
  message: string;
  requestId?: string;
  elapsedMs?: number;
  toolName?: string;
  providerId?: string;
  modelId?: string;
  receivedAt: number;
};

type AssistantSidebarStreamErrorDiagnostic = {
  chunkType: string;
  details?: Record<string, unknown>;
  elapsedMs: number;
  errorText?: string;
  request?: Record<string, unknown>;
  requestId: string | null;
  requestedReasoningEffort?: string;
  toolCallId?: string;
  toolName?: string;
  url: string;
};

const parseAssistantChatStreamErrorText = (
  value: string | undefined,
): Record<string, unknown> => {
  const text = String(value || "").trim();
  if (!text.startsWith("Assistant chat failed:")) return {};

  const detailsText = text.slice("Assistant chat failed:".length).trim();
  const details: Record<string, unknown> = {};
  for (const segment of detailsText.split(/\s+\|\s+/)) {
    const separatorIndex = segment.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = segment.slice(0, separatorIndex).trim();
    const segmentValue = segment.slice(separatorIndex + 1).trim();
    if (key) details[key] = segmentValue;
  }
  return details;
};

const isAssistantSidebarGoogleProvider = (
  provider: ReturnType<typeof buildAssistantChatProviderConfig>,
): boolean => {
  const providerId = String(provider.id || "").toLowerCase();
  const baseUrl = String(provider.baseUrl || "").toLowerCase();
  return (
    providerId === "gemini" ||
    providerId.includes("google") ||
    baseUrl.includes("googleapis.com")
  );
};

const isAssistantSidebarOfficialOpenAIProvider = (
  provider: ReturnType<typeof buildAssistantChatProviderConfig>,
): boolean => {
  const providerId = String(provider.id || "").trim().toLowerCase();
  if (providerId && providerId !== "openai") return false;

  try {
    const host = new URL(String(provider.baseUrl || "").trim()).hostname.toLowerCase();
    return host === "api.openai.com" || host.endsWith(".openai.com");
  } catch {
    return false;
  }
};

const toModelSelectorOption = (
  config: MappedModelConfig,
): AssistantSidebarModelOption => {
  const provider = buildAssistantChatProviderConfig(config.providerId);
  const efforts = getReasoningEffortsForModel(config.modelId, provider);
  return {
    id: toAssistantModelValue(config.modelId, config.providerId),
    name: config.displayLabel,
    description: config.modelId,
    keywords: [
      config.providerName || "",
      config.providerId || "",
      config.modelId,
      config.displayLabel,
    ].filter(Boolean),
    providerLabel:
      String(config.providerName || "").trim() ||
      String(config.providerId || "").trim() ||
      "其他",
    ...(efforts ? { efforts } : {}),
  };
};

const buildAssistantChatModelOptions = (): AssistantSidebarModelOption[] => {
  const mapped = getMappedModelConfigs("script")
    .map(toModelSelectorOption)
    .filter((option) => option.id);
  const seen = new Set<string>();
  const deduped = mapped.filter((option) => {
    if (seen.has(option.id)) return false;
    seen.add(option.id);
    return true;
  });
  if (deduped.length > 0) return deduped;

  const fallback = getBestModelSelection("text");
  const fallbackProvider = buildAssistantChatProviderConfig(fallback.providerId);
  const fallbackEfforts = getReasoningEffortsForModel(
    fallback.modelId,
    fallbackProvider,
  );
  return [
    {
      id: toAssistantModelValue(fallback.modelId, fallback.providerId),
      name: fallback.modelId,
      description: fallback.modelId,
      providerLabel:
        String(fallback.providerId || "").trim() || "默认",
      ...(fallbackEfforts ? { efforts: fallbackEfforts } : {}),
    },
  ];
};

const buildAssistantChatModelGroups = (
  modelOptions: readonly AssistantSidebarModelOption[],
): AssistantSidebarModelGroup[] => {
  const groups = new Map<string, AssistantSidebarModelOption[]>();
  for (const option of modelOptions) {
    const label =
      String(option.providerLabel || "").trim() || "其他";
    const items = groups.get(label);
    if (items) {
      items.push(option);
      continue;
    }
    groups.set(label, [option]);
  }

  return Array.from(groups.entries()).map(([label, models]) => ({
    label,
    models,
  }));
};

const buildAssistantChatWebSearchConfig = (
  runtimeConfig: AssistantSidebarProps["messageActions"]["runtimeConfig"],
) => {
  const settings = loadSearchSettings();
  const activeProvider =
    settings.providers.find((provider) => provider.id === settings.activeProviderId) ||
    settings.providers[0] ||
    null;
  return {
    enabled:
      runtimeConfig?.webEnabled === true ||
      settings.defaults.enabledByDefault === true,
    activeProviderId: settings.activeProviderId,
    provider: activeProvider,
    defaults: settings.defaults,
  };
};

const buildAssistantChatImageGenerationConfig = (
  runtimeConfig: AssistantSidebarProps["messageActions"]["runtimeConfig"],
) => {
  const modelId =
    String(
      runtimeConfig?.activeImageModel ||
        runtimeConfig?.preferredImageModel ||
        "",
    ).trim();
  const providerId =
    runtimeConfig?.activeImageProviderId ||
    runtimeConfig?.preferredImageProviderId ||
    null;
  const provider = buildAssistantChatProviderConfig(providerId);
  return {
    enabled: Boolean(modelId && provider.apiKey),
    modelId,
    provider,
    aspectRatio: runtimeConfig?.imageGenRatio || "1:1",
    resolution: runtimeConfig?.imageGenRes || "1K",
    count: runtimeConfig?.imageGenCount || 1,
  };
};

const IMAGE_ASPECT_RATIO_OPTIONS = [
  { id: "1:1", label: "1:1" },
  { id: "3:4", label: "3:4" },
  { id: "4:3", label: "4:3" },
  { id: "9:16", label: "9:16" },
  { id: "16:9", label: "16:9" },
] as const;

const IMAGE_RESOLUTION_OPTIONS = ["1K", "2K", "4K"] as const;
const IMAGE_COUNT_QUICK_OPTIONS = [1, 2, 4, 8, 16, 32] as const;

const normalizePositiveInteger = (value: unknown, fallback = 1): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.floor(numeric));
};

const toImageModelSelectorOption = (config: MappedModelConfig): ModelOption => ({
  id: toAssistantModelValue(config.modelId, config.providerId),
  name: config.displayLabel,
  description: config.modelId,
  keywords: [
    config.providerName || "",
    config.providerId || "",
    config.modelId,
    config.displayLabel,
  ].filter(Boolean),
});

const buildAssistantImageModelOptions = (): ModelOption[] => {
  const mapped = getMappedModelConfigs("image")
    .map(toImageModelSelectorOption)
    .filter((option) => option.id);
  const seen = new Set<string>();
  const deduped = mapped.filter((option) => {
    if (seen.has(option.id)) return false;
    seen.add(option.id);
    return true;
  });
  return deduped.length > 0
    ? deduped
    : [
        {
          id: "gemini-3-pro-image-preview",
          name: "Nano Banana Pro",
          description: "Default image model",
        },
      ];
};

const isAssistantSidebarDebugEnabled = () =>
  typeof process === "undefined" ||
  process.env.NODE_ENV !== "production";

const HIDDEN_ASSISTANT_REFERENCE_RE = /(^|\n)\[Canvas (?:mark )?reference\]/u;

const stripHiddenAssistantReferenceText = (text: string): string => {
  const match = HIDDEN_ASSISTANT_REFERENCE_RE.exec(text);
  if (!match) return text;

  const markerStart = match.index + (match[1] === "\n" ? 1 : 0);
  return text.slice(0, markerStart).trimEnd();
};

const getMessageTextPreview = (message: UIMessage | undefined): string => {
  if (!message || !Array.isArray(message.parts)) return "";
  return message.parts
    .flatMap((part) =>
      part.type === "text"
        ? [stripHiddenAssistantReferenceText(String(part.text || ""))]
        : [],
    )
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
};

const summarizeProviderBaseUrl = (
  value: string | null | undefined,
): string | undefined => {
  const raw = String(value || "").trim();
  if (!raw) return undefined;
  try {
    return new URL(raw).origin;
  } catch {
    return "[invalid-url]";
  }
};

const getReasoningPartCount = (message: UIMessage | undefined): number => {
  if (!message || !Array.isArray(message.parts)) return 0;
  return message.parts.filter((part) => part.type === "reasoning").length;
};

const getClientErrorMessage = (error: unknown): string => {
  if (error == null) return "unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const summarizeClientErrorForLog = (error: unknown): Record<string, unknown> => {
  const summary: Record<string, unknown> = {
    message: getClientErrorMessage(error),
  };

  if (error instanceof Error) {
    summary.name = error.name;
    if (typeof error.stack === "string") {
      summary.stackPreview = error.stack.split("\n").slice(0, 3).join("\n");
    }
  }

  if (isObjectRecord(error)) {
    for (const key of ["name", "status", "statusCode", "code", "requestId"]) {
      const value = error[key];
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        summary[key] = value;
      }
    }
    if (error.cause !== undefined) {
      summary.cause = getClientErrorMessage(error.cause);
    }
  }

  return summary;
};

const formatAssistantSidebarErrorForConsole = (
  error: unknown,
  fallback = "unknown error",
): string => {
  const summary = summarizeClientErrorForLog(error);
  const details = [
    `message=${String(summary.message || fallback)}`,
    summary.requestId ? `requestId=${summary.requestId}` : "",
    summary.statusCode ? `statusCode=${summary.statusCode}` : "",
    summary.status ? `status=${summary.status}` : "",
    summary.code ? `code=${summary.code}` : "",
    summary.cause ? `cause=${summary.cause}` : "",
  ].filter(Boolean);

  return details.join(" | ");
};

const toAssistantSidebarStreamStatus = (
  data: unknown,
): AssistantSidebarStreamStatus | null => {
  if (!isObjectRecord(data)) return null;
  if (data.type !== "data-assistant-status") return null;
  const payload = isObjectRecord(data.data) ? data.data : {};
  const stage = String(payload.stage || "").trim();
  if (
    stage !== "request-received" &&
    stage !== "model-start" &&
    stage !== "model-step" &&
    stage !== "tool-start" &&
    stage !== "tool-finish" &&
    stage !== "complete" &&
    stage !== "error"
  ) {
    return null;
  }

  const message = String(payload.message || "").trim();
  if (!message) return null;

  return {
    stage,
    message,
    requestId:
      typeof payload.requestId === "string" ? payload.requestId : undefined,
    elapsedMs:
      typeof payload.elapsedMs === "number" ? payload.elapsedMs : undefined,
    toolName:
      typeof payload.toolName === "string" ? payload.toolName : undefined,
    providerId:
      typeof payload.providerId === "string" ? payload.providerId : undefined,
    modelId: typeof payload.modelId === "string" ? payload.modelId : undefined,
    receivedAt: Date.now(),
  };
};

const formatAssistantSidebarLogDetailsForConsole = (
  details: Record<string, unknown> = {},
): string => {
  try {
    return JSON.stringify(details, (_key, value) => {
      if (typeof value === "function") return "[function]";
      if (value instanceof Error) return summarizeClientErrorForLog(value);
      return value;
    });
  } catch {
    return "[unserializable]";
  }
};

const formatAssistantSidebarDiagnosticForConsole = (
  diagnostic: AssistantSidebarStreamErrorDiagnostic | null | undefined,
): string => {
  if (!diagnostic) return "";
  const details = diagnostic.details || {};
  const request = diagnostic.request || {};
  return formatAssistantSidebarLogDetailsForConsole({
    chunkType: diagnostic.chunkType,
    errorText: diagnostic.errorText,
    requestId: diagnostic.requestId || details.requestId,
    stage: details.stage,
    providerId: details.providerId || request.providerId,
    providerBaseUrl: details.providerBaseUrl || request.providerBaseUrl,
    modelId: details.modelId || request.modelId,
    imageProviderId: details.imageProviderId || request.imageProviderId,
    imageProviderBaseUrl:
      details.imageProviderBaseUrl || request.imageProviderBaseUrl,
    imageModelId: details.imageModelId || request.imageModelId,
    webSearchProviderId:
      request.webSearchProviderId || request.webSearchActiveProviderId,
    webSearchProviderType: request.webSearchProviderType,
    statusCode: details.statusCode,
    status: details.status,
    code: details.code,
    toolName: diagnostic.toolName || details.toolName,
    toolCallId: diagnostic.toolCallId,
    requestedToolChoice: details.requestedToolChoice || request.toolChoice,
    toolChoice: details.toolChoice,
    activeTools: details.activeTools,
    elapsedMs: diagnostic.elapsedMs,
  });
};

const logAssistantSidebar = (
  event: string,
  details: Record<string, unknown> = {},
) => {
  if (!isAssistantSidebarDebugEnabled()) return;
  console.info(
    `[assistant-sidebar] ${event} ${formatAssistantSidebarLogDetailsForConsole(details)}`,
    details,
  );
};

const inferAssistantSidebarDataUrlMediaType = (value: unknown): string => {
  const match = /^data:([^;,]+)[;,]/i.exec(String(value || "").trim());
  return match?.[1]?.trim() || "";
};

const inferAssistantSidebarFilenameMediaType = (value: unknown): string => {
  const filename = String(value || "").trim().toLowerCase();
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
    default:
      return "";
  }
};

const isAssistantSidebarImageMessagePart = (part: unknown): boolean => {
  if (!isObjectRecord(part)) return false;
  if (part.type === "file") {
    const url = String(part.url || part.data || "").trim();
    const mediaType = String(
      part.mediaType ||
        part.mimeType ||
        part.contentType ||
        inferAssistantSidebarDataUrlMediaType(url) ||
        inferAssistantSidebarFilenameMediaType(part.filename) ||
        "",
    ).trim();
    return mediaType.startsWith("image/") && Boolean(url);
  }
  if (part.type === "image") {
    const url = String(part.image || part.url || part.data || "").trim();
    const mediaType = String(
      part.mediaType ||
        part.mimeType ||
        part.contentType ||
        inferAssistantSidebarDataUrlMediaType(url) ||
        "image/png",
    ).trim();
    return Boolean(url) && mediaType.startsWith("image/");
  }
  return false;
};

const getAssistantSidebarPartPayloadText = (part: Record<string, unknown>): string => {
  if (part.type === "file") {
    return String(part.url || part.data || "").trim();
  }
  if (part.type === "image") {
    return String(part.image || part.url || part.data || "").trim();
  }
  return "";
};

const summarizeUiMessageFileParts = (messages: unknown[]) => {
  let filePartCount = 0;
  let imageFilePartCount = 0;
  let imagePartCount = 0;
  let filePayloadCharCount = 0;
  let imagePayloadCharCount = 0;
  let largestFilePayloadChars = 0;
  let largestImagePayloadChars = 0;

  for (const message of messages) {
    const parts = isObjectRecord(message) && Array.isArray(message.parts)
      ? message.parts
      : [];
    for (const part of parts) {
      if (!isObjectRecord(part)) continue;
      const payloadLength = getAssistantSidebarPartPayloadText(part).length;
      if (part.type === "image") {
        imagePartCount += 1;
        imagePayloadCharCount += payloadLength;
        largestImagePayloadChars = Math.max(largestImagePayloadChars, payloadLength);
      }
      if (part.type === "file") {
        filePartCount += 1;
        filePayloadCharCount += payloadLength;
        largestFilePayloadChars = Math.max(largestFilePayloadChars, payloadLength);
      }
      if (isAssistantSidebarImageMessagePart(part)) {
        imageFilePartCount += 1;
        imagePayloadCharCount += part.type === "file" ? payloadLength : 0;
        largestImagePayloadChars = Math.max(largestImagePayloadChars, payloadLength);
      }
    }
  }

  return {
    filePartCount,
    imageFilePartCount,
    imagePartCount,
    filePayloadCharCount,
    imagePayloadCharCount,
    largestFilePayloadChars,
    largestImagePayloadChars,
  };
};

const summarizeAssistantChatRequestBody = (body: unknown) => {
  if (typeof body !== "string") {
    return { bodyType: typeof body };
  }

  try {
    const parsed = JSON.parse(body) as {
      messages?: UIMessage[];
      trigger?: string;
      tools?: Record<string, unknown>;
      toolChoice?: unknown;
      activeTools?: string[];
      config?: {
        modelId?: string;
        modelName?: string;
        model?: string;
        reasoningEffort?: string;
      };
      providerConfig?: {
        provider?: {
          id?: string | null;
          name?: string | null;
          baseUrl?: string | null;
        } | null;
        providerId?: string | null;
      };
      webSearch?: {
        enabled?: boolean;
        activeProviderId?: string | null;
        provider?: {
          id?: string | null;
          name?: string | null;
          catalogId?: string | null;
          providerType?: string | null;
          baseUrl?: string | null;
        } | null;
        defaults?: {
          mode?: string | null;
          webCount?: number | null;
          imageCount?: number | null;
          timeRange?: string | null;
          compressionMode?: string | null;
        } | null;
      };
      imageGeneration?: {
        enabled?: boolean;
        modelId?: string | null;
        aspectRatio?: string | null;
        resolution?: string | null;
        count?: number | null;
        enforceSettings?: boolean;
        provider?: {
          id?: string | null;
          name?: string | null;
          baseUrl?: string | null;
        } | null;
      };
    };
    const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
    const fileSummary = summarizeUiMessageFileParts(messages);
    const lastMessage = messages.at(-1);
    return {
      bodyType: "json",
      messageCount: messages.length,
      ...fileSummary,
      lastRole: lastMessage?.role,
      lastTextPreview: getMessageTextPreview(lastMessage),
      trigger: parsed.trigger,
      toolCount:
        parsed.tools && typeof parsed.tools === "object"
          ? Object.keys(parsed.tools).length
          : 0,
      activeToolCount: Array.isArray(parsed.activeTools)
        ? parsed.activeTools.length
        : 0,
      toolChoice: parsed.toolChoice,
      providerId:
        parsed.providerConfig?.provider?.id ||
        parsed.providerConfig?.providerId ||
        undefined,
      providerName: parsed.providerConfig?.provider?.name || undefined,
      providerBaseUrl: summarizeProviderBaseUrl(
        parsed.providerConfig?.provider?.baseUrl || undefined,
      ),
      modelId:
        parsed.config?.modelId ||
        parsed.config?.modelName ||
        parsed.config?.model,
      reasoningEffort:
        typeof parsed.config?.reasoningEffort === "string" &&
        parsed.config.reasoningEffort.trim()
          ? parsed.config.reasoningEffort.trim()
          : undefined,
      webSearchEnabled: parsed.webSearch?.enabled === true,
      webSearchActiveProviderId:
        parsed.webSearch?.activeProviderId || undefined,
      webSearchProviderId: parsed.webSearch?.provider?.id || undefined,
      webSearchProviderName: parsed.webSearch?.provider?.name || undefined,
      webSearchProviderType:
        parsed.webSearch?.provider?.providerType ||
        parsed.webSearch?.provider?.catalogId ||
        undefined,
      webSearchProviderBaseUrl: summarizeProviderBaseUrl(
        parsed.webSearch?.provider?.baseUrl || undefined,
      ),
      webSearchMode: parsed.webSearch?.defaults?.mode || undefined,
      webSearchWebCount:
        typeof parsed.webSearch?.defaults?.webCount === "number"
          ? parsed.webSearch.defaults.webCount
          : undefined,
      webSearchImageCount:
        typeof parsed.webSearch?.defaults?.imageCount === "number"
          ? parsed.webSearch.defaults.imageCount
          : undefined,
      webSearchTimeRange: parsed.webSearch?.defaults?.timeRange || undefined,
      webSearchCompressionMode:
        parsed.webSearch?.defaults?.compressionMode || undefined,
      imageGenerationEnabled: parsed.imageGeneration?.enabled === true,
      imageModelId: parsed.imageGeneration?.modelId || undefined,
      imageAspectRatio: parsed.imageGeneration?.aspectRatio || undefined,
      imageResolution: parsed.imageGeneration?.resolution || undefined,
      imageCount:
        typeof parsed.imageGeneration?.count === "number"
          ? parsed.imageGeneration.count
          : undefined,
      imageSettingsLocked:
        parsed.imageGeneration?.enforceSettings === true,
      imageProviderId: parsed.imageGeneration?.provider?.id || undefined,
      imageProviderName:
        parsed.imageGeneration?.provider?.name || undefined,
      imageProviderBaseUrl: summarizeProviderBaseUrl(
        parsed.imageGeneration?.provider?.baseUrl || undefined,
      ),
    };
  } catch {
    return {
      bodyType: "text",
      bodyLength: body.length,
    };
  }
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const summarizeAssistantChatToolOutputForLog = (output: unknown) => {
  if (!isObjectRecord(output)) return { outputType: typeof output };
  const images = Array.isArray(output.images) ? output.images : undefined;
  const error = typeof output.error === "string" ? output.error : undefined;
  return {
    outputKeys: Object.keys(output),
    ...(images ? { imageCount: images.length } : {}),
    ...(error ? { error } : {}),
  };
};

type AssistantChatUiStreamDebugState = {
  buffer: string;
  lastError: AssistantSidebarStreamErrorDiagnostic | null;
  loggedFirstChunkTypes: Set<string>;
  onStreamError?: (diagnostic: AssistantSidebarStreamErrorDiagnostic) => void;
  startedAt: number;
  requestId: string | null;
  requestedReasoningEffort?: string;
  requestSummary?: Record<string, unknown>;
  sawReasoningStart: boolean;
  sawReasoningDelta: boolean;
  sawReasoningEnd: boolean;
  toolNamesByCallId: Map<string, string>;
  toolStartedAtByCallId: Map<string, number>;
  url: string;
};

const summarizeAssistantSidebarReasoningDiagnosis = (
  state: AssistantChatUiStreamDebugState,
) => {
  const reasoningRequested = Boolean(state.requestedReasoningEffort);
  const reasoningReturned =
    state.sawReasoningStart || state.sawReasoningDelta || state.sawReasoningEnd;
  const likelyCause = !reasoningRequested
    ? "request_did_not_ask_for_reasoning"
    : reasoningReturned
      ? "reasoning_returned"
      : "upstream_returned_final_answer_without_reasoning";

  return {
    reasoningRequested,
    reasoningReturned,
    likelyCause: likelyCause as AssistantSidebarReasoningDiagnosisCause,
  };
};

const logAssistantChatUiStreamChunk = (
  state: AssistantChatUiStreamDebugState,
  chunk: unknown,
) => {
  if (!isObjectRecord(chunk) || typeof chunk.type !== "string") return;

  const elapsedMs = Math.round(performance.now() - state.startedAt);
  const logFirst = (eventType: string, details: Record<string, unknown> = {}) => {
    if (state.loggedFirstChunkTypes.has(eventType)) return;
    state.loggedFirstChunkTypes.add(eventType);
    logAssistantSidebar(`assistant-chat ui_first_${eventType}`, {
      url: state.url,
      requestId: state.requestId,
      elapsedMs,
      ...details,
    });
  };

  switch (chunk.type) {
    case "reasoning-start":
      state.sawReasoningStart = true;
      logFirst("reasoning_start", {
        reasoningId: typeof chunk.id === "string" ? chunk.id : undefined,
      });
      return;
    case "text-delta":
      logFirst("text_delta", {
        deltaLength: typeof chunk.delta === "string" ? chunk.delta.length : 0,
      });
      return;
    case "reasoning-delta":
      state.sawReasoningDelta = true;
      logFirst("reasoning_delta", {
        deltaLength: typeof chunk.delta === "string" ? chunk.delta.length : 0,
      });
      return;
    case "reasoning-end":
      state.sawReasoningEnd = true;
      logFirst("reasoning_end", {
        reasoningId: typeof chunk.id === "string" ? chunk.id : undefined,
      });
      return;
    case "tool-input-start":
    case "tool-input-available": {
      const toolCallId = String(chunk.toolCallId || "");
      const toolName = String(chunk.toolName || "");
      if (toolCallId) {
        state.toolNamesByCallId.set(toolCallId, toolName);
        if (!state.toolStartedAtByCallId.has(toolCallId)) {
          state.toolStartedAtByCallId.set(toolCallId, performance.now());
        }
      }
      logAssistantSidebar(`assistant-chat ui_${chunk.type}`, {
        url: state.url,
        requestId: state.requestId,
        toolCallId,
        toolName,
        elapsedMs,
      });
      return;
    }
    case "tool-output-available": {
      const toolCallId = String(chunk.toolCallId || "");
      const startedAt = state.toolStartedAtByCallId.get(toolCallId);
      logAssistantSidebar("assistant-chat ui_tool-output-available", {
        url: state.url,
        requestId: state.requestId,
        toolCallId,
        toolName: state.toolNamesByCallId.get(toolCallId),
        elapsedMs,
        ...(startedAt
          ? { toolElapsedMs: Math.round(performance.now() - startedAt) }
          : {}),
        ...summarizeAssistantChatToolOutputForLog(chunk.output),
      });
      return;
    }
    case "error":
    case "tool-input-error":
    case "tool-output-error": {
      const errorText =
        typeof chunk.errorText === "string" ? chunk.errorText : undefined;
      const errorDetails = parseAssistantChatStreamErrorText(errorText);
      const toolCallId = String(chunk.toolCallId || "");
      const toolName =
        typeof chunk.toolName === "string"
          ? chunk.toolName
          : toolCallId
            ? state.toolNamesByCallId.get(toolCallId)
            : undefined;
      const diagnostic: AssistantSidebarStreamErrorDiagnostic = {
        chunkType: chunk.type,
        elapsedMs,
        errorText,
        request: state.requestSummary,
        requestId: state.requestId,
        requestedReasoningEffort: state.requestedReasoningEffort,
        ...(toolCallId ? { toolCallId } : {}),
        ...(toolName ? { toolName } : {}),
        ...(Object.keys(errorDetails).length > 0 ? { details: errorDetails } : {}),
        url: state.url,
      };
      state.lastError = diagnostic;
      state.onStreamError?.(diagnostic);
      if (errorText) {
        console.error(
          `[assistant-sidebar] assistant-chat ${chunk.type}: ${formatAssistantSidebarErrorForConsole(errorText)} | stream=${formatAssistantSidebarDiagnosticForConsole(diagnostic)}`,
        );
      }
      logAssistantSidebar(`assistant-chat ui_${chunk.type}`, {
        url: state.url,
        requestId: state.requestId,
        elapsedMs,
        errorText,
        details: errorDetails,
        toolCallId,
        toolName,
      });
      return;
    }
    case "finish":
      logAssistantSidebar("assistant-chat ui_finish", {
        url: state.url,
        requestId: state.requestId,
        elapsedMs,
        finishReason:
          typeof chunk.finishReason === "string"
            ? chunk.finishReason
            : undefined,
      });
      return;
    default:
      logFirst(chunk.type.replace(/-/g, "_"));
  }
};

const processAssistantChatUiStreamText = (
  state: AssistantChatUiStreamDebugState,
  text: string,
) => {
  if (!text) return;
  state.buffer += text;
  const lines = state.buffer.split(/\r?\n/);
  state.buffer = lines.pop() ?? "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      logAssistantChatUiStreamChunk(state, JSON.parse(payload));
    } catch {
      // SSE chunks can be split mid-payload; keep diagnostics non-invasive.
    }
  }
};

const installAssistantSidebarDiagnostics = () => {
  if (typeof window === "undefined") return;
  const globalKey = "__xcAssistantSidebarDiagnosticsInstalled";
  const globalWindow = window as typeof window & Record<string, unknown>;
  if (globalWindow[globalKey]) return;
  globalWindow[globalKey] = true;

  window.addEventListener("error", (event) => {
    logAssistantSidebar("window_error", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: getClientErrorMessage(event.error),
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    logAssistantSidebar("unhandled_rejection", {
      error: getClientErrorMessage(event.reason),
    });
  });
};

const prepareAssistantChatFetchInit = async (
  init: RequestInit | undefined,
): Promise<RequestInit | undefined> => {
  if (typeof init?.body !== "string") return init;

  try {
    const parsed = JSON.parse(init.body) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return init;
    }
    const body = parsed as Record<string, unknown>;
    const messages = Array.isArray(body.messages)
      ? (body.messages as UIMessage[])
      : null;
    if (!messages || messages.length === 0) return init;

    const prepared = await prepareAssistantSidebarMessageImagesForRequest(messages);
    if (prepared.preparedCount === 0) return init;

    logAssistantSidebar("assistant-chat request_images_prepared", {
      messageCount: messages.length,
      preparedCount: prepared.preparedCount,
      hostedOrCompressedCount: prepared.hostedOrCompressedCount,
    });

    return {
      ...init,
      body: JSON.stringify({
        ...body,
        messages: prepared.messages,
      }),
    };
  } catch (error) {
    console.warn("[assistant-sidebar] request image preparation failed", {
      error: getClientErrorMessage(error),
    });
    return init;
  }
};

const createAssistantChatDebugFetch = ({
  baseFetch = fetch,
  onReasoningDiagnosis,
  onStreamError,
}: {
  baseFetch?: typeof fetch;
  onReasoningDiagnosis?:
    | ((diagnosis: AssistantSidebarReasoningRuntimeDiagnosis) => void)
    | undefined;
  onStreamError?:
    | ((diagnostic: AssistantSidebarStreamErrorDiagnostic) => void)
    | undefined;
} = {}): typeof fetch =>
  async (input, init) => {
    const preparedInit = await prepareAssistantChatFetchInit(init);
    const debugEnabled = isAssistantSidebarDebugEnabled();
    if (!debugEnabled && typeof onReasoningDiagnosis !== "function") {
      return baseFetch(input, preparedInit);
    }

    const startedAt = performance.now();
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;
    const requestSummary = summarizeAssistantChatRequestBody(preparedInit?.body);
    const requestSummaryRecord = isObjectRecord(requestSummary)
      ? requestSummary
      : {};
    const requestedReasoningEffort =
      typeof requestSummary === "object" &&
      requestSummary !== null &&
      "reasoningEffort" in requestSummary &&
      typeof (requestSummary as { reasoningEffort?: unknown }).reasoningEffort ===
        "string"
        ? String(
            (requestSummary as { reasoningEffort?: string }).reasoningEffort,
          ).trim() || undefined
        : undefined;
    logAssistantSidebar("assistant-chat request", {
      url,
      method: preparedInit?.method || "POST",
      request: requestSummary,
    });

    try {
      const response = await baseFetch(input, preparedInit);
      const requestId = response.headers.get("x-assistant-request-id");
      logAssistantSidebar("assistant-chat response", {
        url,
        status: response.status,
        elapsedMs: Math.round(performance.now() - startedAt),
        contentType: response.headers.get("content-type"),
        requestId,
        requestedReasoningEffort,
      });
      if (!response.ok) {
        const clone = response.clone();
        if (debugEnabled) {
          clone.text().then((text) => {
            console.error("[assistant-sidebar] assistant-chat error body", {
              url,
              status: response.status,
              bodyPreview: text.slice(0, 1000),
            });
          }).catch((error) => {
            console.error("[assistant-sidebar] assistant-chat error body read failed", {
              url,
              status: response.status,
              error: summarizeClientErrorForLog(error),
            });
          });
        }
      }
      if (response.ok && response.body) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("text/event-stream")) {
          let chunkCount = 0;
          let byteCount = 0;
          const decoder = new TextDecoder();
          const uiStreamDebugState: AssistantChatUiStreamDebugState = {
            buffer: "",
            lastError: null,
            loggedFirstChunkTypes: new Set(),
            onStreamError,
            startedAt,
            requestId,
            requestedReasoningEffort,
            requestSummary: requestSummaryRecord,
            sawReasoningStart: false,
            sawReasoningDelta: false,
            sawReasoningEnd: false,
            toolNamesByCallId: new Map(),
            toolStartedAtByCallId: new Map(),
            url,
          };
          const tappedBody = response.body.pipeThrough(
            new TransformStream<Uint8Array, Uint8Array>({
              transform(chunk, controller) {
                chunkCount += 1;
                byteCount += chunk.byteLength;
                processAssistantChatUiStreamText(
                  uiStreamDebugState,
                  decoder.decode(chunk, { stream: true }),
                );
                if (chunkCount === 1) {
                  logAssistantSidebar("assistant-chat first_stream_chunk", {
                    url,
                    requestId,
                    elapsedMs: Math.round(performance.now() - startedAt),
                    bytes: chunk.byteLength,
                  });
                }
                controller.enqueue(chunk);
              },
              flush() {
                processAssistantChatUiStreamText(
                  uiStreamDebugState,
                  decoder.decode(),
                );
                const reasoningDiagnosis =
                  summarizeAssistantSidebarReasoningDiagnosis(
                    uiStreamDebugState,
                  );
                onReasoningDiagnosis?.({
                  elapsedMs: Math.round(performance.now() - startedAt),
                  likelyCause: reasoningDiagnosis.likelyCause,
                  reasoningRequested: reasoningDiagnosis.reasoningRequested,
                  reasoningReturned: reasoningDiagnosis.reasoningReturned,
                  requestId,
                  requestedReasoningEffort:
                    uiStreamDebugState.requestedReasoningEffort,
                  url,
                });
                logAssistantSidebar("assistant-chat stream_complete", {
                  url,
                  requestId,
                  elapsedMs: Math.round(performance.now() - startedAt),
                  chunkCount,
                  byteCount,
                  requestedReasoningEffort:
                    uiStreamDebugState.requestedReasoningEffort,
                  sawReasoningStart: uiStreamDebugState.sawReasoningStart,
                  sawReasoningDelta: uiStreamDebugState.sawReasoningDelta,
                  sawReasoningEnd: uiStreamDebugState.sawReasoningEnd,
                  reasoningReturned: reasoningDiagnosis.reasoningReturned,
                  reasoningDiagnosis: reasoningDiagnosis.likelyCause,
                });
                logAssistantSidebar("assistant-chat reasoning_diagnosis", {
                  url,
                  requestId,
                  elapsedMs: Math.round(performance.now() - startedAt),
                  requestedReasoningEffort:
                    uiStreamDebugState.requestedReasoningEffort,
                  reasoningRequested: reasoningDiagnosis.reasoningRequested,
                  reasoningReturned: reasoningDiagnosis.reasoningReturned,
                  likelyCause: reasoningDiagnosis.likelyCause,
                });
              },
            }),
          );
          return new Response(tappedBody, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        }
      }
      return response;
    } catch (error) {
      if (debugEnabled) {
        console.error(
          `[assistant-sidebar] assistant-chat fetch failed: ${getClientErrorMessage(error)}`,
        );
        console.error("[assistant-sidebar] assistant-chat fetch failed", {
          url,
          elapsedMs: Math.round(performance.now() - startedAt),
          error: summarizeClientErrorForLog(error),
        });
      }
      throw error;
    }
  };

const toThreadLastMessageDate = (conversation: AssistantSidebarConversation) =>
  new Date(conversation.updatedAt || conversation.createdAt || Date.now());

const getConversationTitle = (conversation: AssistantSidebarConversation) =>
  String(conversation.title || "").trim() || "New Thread";

const buildOfficialThreadSuggestions = (
  selectedElementLabel: string | null | undefined,
): SuggestionConfig[] => {
  const selectedSurface = String(selectedElementLabel || "").trim();
  return [
    {
      title: "Review the canvas",
      label: "Find the highest-priority design issues",
      prompt: selectedSurface
        ? `Review the selected "${selectedSurface}" on the canvas. Tell me what feels incomplete, confusing, or visually unstable, then list the fixes by priority.`
        : "Review the current canvas. Tell me what feels incomplete, confusing, or visually unstable, then list the fixes by priority.",
    },
    {
      title: "Plan the work",
      label: "Turn this into a practical build plan",
      prompt:
        "Turn this workspace idea into a practical build plan. Break it into milestones, call out risks, and suggest the fastest high-quality path forward.",
    },
    {
      title: "Shape visual direction",
      label: "Create a stronger visual concept",
      prompt:
        "Create a stronger visual direction for this project. Give me a clear image concept and describe composition, lighting, material, and style details.",
    },
  ];
};

const buildThreadTitle = (messages: readonly ThreadMessage[]) => {
  const firstUserText = messages
    .find((message) => message.role === "user")
    ?.content.flatMap((part) =>
      part.type === "text" ? [String(part.text || "").trim()] : [],
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!firstUserText) return "New Thread";
  return firstUserText.length > 40
    ? `${firstUserText.slice(0, 37)}...`
    : firstUserText;
};

const createConversationId = () =>
  `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type WorkspaceConversationRefs = {
  conversationsRef: React.MutableRefObject<AssistantSidebarConversation[]>;
  activeConversationIdRef: React.MutableRefObject<string>;
  isThreadListHydratedRef: React.MutableRefObject<boolean>;
  waitForThreadListHydration: () => Promise<void>;
  workspaceId: string;
  setConversations: AssistantSidebarProps["session"]["setConversations"];
  setActiveConversationId: AssistantSidebarProps["session"]["setActiveConversationId"];
};

type WorkspaceAssistantStorageRepository = {
  headId: string | null;
  messages: AssistantThreadMessageStorageEntry[];
};

const createWorkspaceHistoryAdapter = (
  refs: WorkspaceConversationRefs,
  scope: {
    getConversationId: () => string | null;
    ensureConversationId: () => Promise<string | null>;
  },
): ThreadHistoryAdapter => {
  const normalizeRepository = (
    repository: WorkspaceAssistantStorageRepository,
    options: { format?: string | null } = {},
  ): WorkspaceAssistantStorageRepository => {
    const messages = normalizeAssistantUiStorageEntryRows(repository.messages, {
      format: options.format,
    });
    const messageIds = new Set(messages.map((item) => item.id));
    const requestedHeadId =
      repository.headId === null
        ? null
        : String(repository.headId || "").trim() || undefined;
    const headId =
      requestedHeadId && messageIds.has(requestedHeadId)
        ? requestedHeadId
        : messages.at(-1)?.id ?? null;

    return {
      headId,
      messages,
    };
  };

  const loadRepository = (
    conversationId: string,
    format?: string | null,
  ): WorkspaceAssistantStorageRepository => {
    const conversation = refs.conversationsRef.current.find(
      (item) => item.id === conversationId,
    );

    const thread = conversation?.assistantThread;
    const items = thread?.messages || [];

    return normalizeRepository({
      headId: thread?.headId ?? null,
      messages: items,
    }, { format });
  };

  const loadRepositoryFromConversations = (
    conversations: ConversationSession[],
    conversationId: string,
    format?: string | null,
  ): WorkspaceAssistantStorageRepository => {
    const conversation = conversations.find((item) => item.id === conversationId);
    const thread = conversation?.assistantThread;
    const items = thread?.messages || [];
    return normalizeRepository({
      headId: thread?.headId ?? null,
      messages: items,
    }, { format });
  };

  const saveRepositoryToConversations = (
    previous: ConversationSession[],
    conversationId: string,
    repository: WorkspaceAssistantStorageRepository,
    format?: string | null,
  ): ConversationSession[] => {
    const now = Date.now();
    const normalizedRepository = normalizeRepository(repository, { format });
    const existing = previous.find((item) => item.id === conversationId);
    const nextConversation: ConversationSession = existing || {
      id: conversationId,
      title: "New Thread",
      messages: [],
      createdAt: now,
      updatedAt: now,
      autoTitle: true,
    };
    const assistantThread = {
      headId:
        normalizedRepository.headId ??
        normalizedRepository.messages.at(-1)?.id ??
        null,
      messages: normalizedRepository.messages,
    };

    const next = {
      ...nextConversation,
      assistantThread,
      messages: Array.isArray(nextConversation.messages)
        ? nextConversation.messages
        : [],
      updatedAt: now,
    };

    if (existing) {
      return previous.map((item) => (item.id === conversationId ? next : item));
    }
    return [next, ...previous];
  };

  const saveRepository = (
    conversationId: string,
    repository: WorkspaceAssistantStorageRepository,
    format?: string | null,
  ) => {
    refs.setConversations((previous) =>
      saveRepositoryToConversations(previous, conversationId, repository, format)
    );
  };

  const deleteRepositoryMessages = (
    repository: WorkspaceAssistantStorageRepository,
    items: MessageFormatItem<unknown>[],
    getId: (message: unknown) => string,
  ): WorkspaceAssistantStorageRepository => {
    const deleteItems = items.flatMap((item) => {
      const id = String(getId(item.message) || "").trim();
      return id ? [{ id, parentId: item.parentId ? String(item.parentId) : null }] : [];
    });
    if (deleteItems.length === 0) return repository;

    const deleteIds = new Set(deleteItems.map((item) => item.id));
    const rowsById = new Map(repository.messages.map((row) => [row.id, row]));
    const replacementByDeletedId = new Map<string, string | null>();

    const resolveReplacement = (candidate: string | null): string | null => {
      let replacementId = candidate;
      const seen = new Set<string>();
      while (replacementId && deleteIds.has(replacementId) && !seen.has(replacementId)) {
        seen.add(replacementId);
        replacementId =
          replacementByDeletedId.get(replacementId) ??
          rowsById.get(replacementId)?.parent_id ??
          null;
      }
      return replacementId && rowsById.has(replacementId) ? replacementId : null;
    };

    for (const item of deleteItems) {
      const storedParentId = rowsById.get(item.id)?.parent_id ?? null;
      replacementByDeletedId.set(
        item.id,
        resolveReplacement(item.parentId ?? storedParentId),
      );
    }

    const messages = repository.messages.flatMap((row) => {
      if (deleteIds.has(row.id)) return [];
      const parentId = resolveReplacement(row.parent_id);
      return parentId === row.parent_id ? [row] : [{ ...row, parent_id: parentId }];
    });
    const survivingIds = new Set(messages.map((row) => row.id));
    const currentHeadId = repository.headId && survivingIds.has(repository.headId)
      ? repository.headId
      : null;
    const deletedHeadReplacement =
      repository.headId && deleteIds.has(repository.headId)
        ? replacementByDeletedId.get(repository.headId) ?? null
        : null;
    const headId =
      currentHeadId ??
      (deletedHeadReplacement && survivingIds.has(deletedHeadReplacement)
        ? deletedHeadReplacement
        : messages.at(-1)?.id ?? null);

    return { headId, messages };
  };

  return {
    async load() {
      return { messages: [] };
    },
    async append() {},
    withFormat<TMessage, TStorageFormat extends Record<string, unknown>>(
      formatAdapter: MessageFormatAdapter<TMessage, TStorageFormat>,
    ): GenericThreadHistoryAdapter<TMessage> {
      const toStorageEntry = (
        item: MessageFormatItem<TMessage>,
      ): AssistantThreadMessageStorageEntry | null => {
        const id = String(formatAdapter.getId(item.message) || "").trim();
        if (!id) return null;
        const encoded = formatAdapter.encode(item) as Record<string, unknown>;
        return {
          id,
          parent_id: item.parentId ? String(item.parentId) : null,
          format: formatAdapter.format,
          content: encoded,
        };
      };

      return {
        async load() {
          const remoteId = scope.getConversationId();
          if (!remoteId) return { messages: [] };

          const repo = loadRepository(remoteId, formatAdapter.format);

          const decodedMessages = repo.messages.flatMap((row) => {
            try {
              const decoded = formatAdapter.decode({
                id: row.id,
                parent_id: row.parent_id,
                format: row.format,
                content: row.content as TStorageFormat,
              });
              return [decoded];
            } catch (error) {
              console.warn("[assistant-sidebar] skipped invalid history row", {
                id: row.id,
                format: row.format,
                error: getClientErrorMessage(error),
              });
              return [];
            }
          });

          return {
            headId: repo.headId,
            messages: decodedMessages,
          };
        },
        async append(item: MessageFormatItem<TMessage>) {
          const remoteId = await scope.ensureConversationId();
          if (!remoteId) return;

          refs.setConversations((previous) => {
            const current = loadRepositoryFromConversations(previous, remoteId, formatAdapter.format);

            const encodedItem = toStorageEntry(item);
            if (!encodedItem) return previous;

            const existingIndex = current.messages.findIndex(
              (entry) => entry.id === encodedItem.id,
            );
            const nextMessages =
              existingIndex >= 0
                ? current.messages.map((entry, index) =>
                    index === existingIndex ? encodedItem : entry,
                  )
                : [...current.messages, encodedItem];

            return saveRepositoryToConversations(
              previous,
              remoteId,
              {
                headId: encodedItem.id,
                messages: nextMessages,
              },
              formatAdapter.format,
            );
          });
        },
        async update(item: MessageFormatItem<TMessage>, localMessageId: string) {
          const remoteId = await scope.ensureConversationId();
          if (!remoteId) return;
          refs.setConversations((previous) => {
            const current = loadRepositoryFromConversations(
              previous,
              remoteId,
              formatAdapter.format,
            );
            const encodedItem = toStorageEntry(item);
            if (!encodedItem) return previous;
            const existingIndex = current.messages.findIndex(
              (entry) => entry.id === localMessageId,
            );
            const nextMessages =
              existingIndex >= 0
                ? current.messages.map((entry) =>
                    entry.id === localMessageId ? encodedItem : entry,
                  )
                : [...current.messages, encodedItem];
            return saveRepositoryToConversations(
              previous,
              remoteId,
              {
                headId: current.headId ?? encodedItem.id,
                messages: nextMessages,
              },
              formatAdapter.format,
            );
          });
        },
        async delete(items: MessageFormatItem<TMessage>[]) {
          const remoteId = await scope.ensureConversationId();
          if (!remoteId) return;
          refs.setConversations((previous) => {
            const current = loadRepositoryFromConversations(
              previous,
              remoteId,
              formatAdapter.format,
            );
            const nextRepository = deleteRepositoryMessages(
              current,
              items as MessageFormatItem<unknown>[],
              (message) => formatAdapter.getId(message as TMessage),
            );
            return saveRepositoryToConversations(
              previous,
              remoteId,
              nextRepository,
              formatAdapter.format,
            );
          });
        },
      };
    },
  };
};

type WorkspaceRuntimeAdapterProps = {
  refs: WorkspaceConversationRefs;
  children: React.ReactNode;
};

const WorkspaceRuntimeAdapters: React.FC<WorkspaceRuntimeAdapterProps> = ({
  refs,
  children,
}) => {
  const aui = useAui();

  const getConversationId = React.useCallback(() => {
    if (!aui.threadListItem.source) {
      return null;
    }
    const remoteId = aui.threadListItem().getState().remoteId;
    const normalizedRemoteId = String(remoteId || "").trim();
    return normalizedRemoteId || null;
  }, [aui]);
  const ensureConversationId = React.useCallback(async () => {
    if (!aui.threadListItem.source) {
      return null;
    }
    const threadListItem = aui.threadListItem();
    const currentRemoteId = String(threadListItem.getState().remoteId || "").trim();
    if (currentRemoteId) {
      return currentRemoteId;
    }
    const initialized = await threadListItem.initialize();
    const initializedRemoteId = String(initialized?.remoteId || "").trim();
    return initializedRemoteId || null;
  }, [aui]);
  const history = React.useMemo(
    () =>
      createWorkspaceHistoryAdapter(refs, {
        getConversationId,
        ensureConversationId,
      }),
    [aui, ensureConversationId, getConversationId, refs],
  );
  const speech = React.useMemo(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return undefined;
    }
    return new WebSpeechSynthesisAdapter();
  }, []);
  const dictation = React.useMemo(() => {
    if (typeof window === "undefined" || !WebSpeechDictationAdapter.isSupported()) {
      return undefined;
    }
    return new WebSpeechDictationAdapter({
      language:
        typeof navigator !== "undefined" && navigator.language
          ? navigator.language
        : "zh-CN",
    });
  }, []);
  const feedback = React.useMemo<FeedbackAdapter>(
    () => ({
      submit: ({ message, type }) => {
        const conversationId = getConversationId();
        const messageId = String(message.id || "").trim();
        if (!conversationId || !messageId) {
          return;
        }

        refs.setConversations((previous) => {
          const now = Date.now();
          let changed = false;
          const next = previous.map((conversation) => {
            if (conversation.id !== conversationId) {
              return conversation;
            }

            const assistantThread = applyAssistantThreadSubmittedFeedback(
              conversation.assistantThread,
              messageId,
              type,
            );
            if (assistantThread === conversation.assistantThread) {
              return conversation;
            }

            changed = true;
            return {
              ...conversation,
              assistantThread,
              updatedAt: now,
            };
          });

          return changed ? next : previous;
        });
      },
    }),
    [getConversationId, refs],
  );
  const attachments = React.useMemo(
    () => createAssistantSidebarAttachmentAdapter(),
    [],
  );
  const adapters = React.useMemo(
    () => ({
      history,
      feedback,
      attachments,
      ...(speech ? { speech } : {}),
      ...(dictation ? { dictation } : {}),
    }),
    [attachments, dictation, feedback, history, speech],
  );

  return (
    <RuntimeAdapterProvider adapters={adapters}>
      {children}
    </RuntimeAdapterProvider>
  );
};

const createWorkspaceRemoteThreadListAdapter = (
  refs: WorkspaceConversationRefs,
): RemoteThreadListAdapter => ({
  async list() {
    await refs.waitForThreadListHydration();
    const sorted = [...refs.conversationsRef.current].sort((left, right) => {
      if (left.pinned && !right.pinned) return -1;
      if (!left.pinned && right.pinned) return 1;
      return (right.updatedAt || 0) - (left.updatedAt || 0);
    });
    return {
      threads: sorted.map((conversation) => ({
        remoteId: conversation.id,
        status: conversation.archivedAt ? "archived" : "regular",
        title: getConversationTitle(conversation),
        lastMessageAt: toThreadLastMessageDate(conversation),
        custom: { pinned: Boolean(conversation.pinned) },
      })),
    };
  },
  async initialize(threadId) {
    const now = Date.now();
    const remoteId = threadId.startsWith("__LOCALID_") ? createConversationId() : threadId;
    refs.activeConversationIdRef.current = remoteId;
    refs.setConversations((previous) => {
      if (previous.some((conversation) => conversation.id === remoteId)) {
        return previous;
      }
      return [
        {
          id: remoteId,
          title: "New Thread",
          messages: [],
          createdAt: now,
          updatedAt: now,
          autoTitle: true,
        },
        ...previous,
      ];
    });
    refs.setActiveConversationId(remoteId);
    return { remoteId, externalId: undefined };
  },
  async rename(remoteId, title) {
    refs.setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === remoteId
          ? { ...conversation, title, autoTitle: false, updatedAt: Date.now() }
          : conversation,
      ),
    );
  },
  async updateCustom(remoteId, custom) {
    refs.setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === remoteId && typeof custom?.pinned === "boolean"
          ? { ...conversation, pinned: custom.pinned, updatedAt: Date.now() }
          : conversation,
      ),
    );
  },
  async archive(remoteId) {
    refs.setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === remoteId
          ? { ...conversation, archivedAt: Date.now(), updatedAt: Date.now() }
          : conversation,
      ),
    );
  },
  async unarchive(remoteId) {
    refs.setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === remoteId
          ? { ...conversation, archivedAt: undefined, updatedAt: Date.now() }
          : conversation,
      ),
    );
  },
  async delete(remoteId) {
    markProjectConversationDeleted(refs.workspaceId, remoteId);
    void deleteProjectConversationBackup(refs.workspaceId, remoteId);
    refs.setConversations((previous) =>
      previous.filter((conversation) => conversation.id !== remoteId),
    );
  },
  async fetch(remoteId) {
    const conversation = refs.conversationsRef.current.find(
      (item) => item.id === remoteId,
    );
    if (!conversation) throw new Error("Thread not found");
    return {
      remoteId: conversation.id,
      status: conversation.archivedAt ? "archived" : "regular",
      title: getConversationTitle(conversation),
      lastMessageAt: toThreadLastMessageDate(conversation),
      custom: { pinned: Boolean(conversation.pinned) },
    };
  },
  async generateTitle(remoteId, messages) {
    const title = buildThreadTitle(messages);
    refs.setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === remoteId && conversation.autoTitle !== false
          ? { ...conversation, title, updatedAt: Date.now() }
          : conversation,
      ),
    );
    return createAssistantStream((controller) => {
      controller.appendText(title);
    });
  },
  unstable_Provider({ children }) {
    return (
      <WorkspaceRuntimeAdapters refs={refs}>
        {children}
      </WorkspaceRuntimeAdapters>
    );
  },
});

const buildConversationThreadListSignature = (
  conversations: AssistantSidebarConversation[],
): string =>
  conversations
    .map((conversation) =>
      [
        conversation.id,
        conversation.title || "",
        conversation.updatedAt || 0,
        conversation.archivedAt || 0,
        conversation.pinned === true ? 1 : 0,
      ].join(":"),
    )
    .join("|");

const sanitizeAssistantAssetFilename = (
  value: string | undefined,
  fallback: string,
): string =>
  (value || fallback)
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim() || fallback;

const getAssistantAssetExtension = (
  asset: ConversationThreadAsset,
): string => {
  const fromTitle = /\.([a-z0-9]{2,8})$/i.exec(asset.title)?.[1];
  if (fromTitle) return fromTitle.toLowerCase();
  const fromMediaType = asset.mediaType?.split("/")[1]?.split(";")[0]?.trim();
  if (fromMediaType) return fromMediaType.toLowerCase();
  if (asset.type === "image") return "png";
  if (asset.type === "video") return "mp4";
  return "file";
};

const toAssistantAssetAttachment = (
  asset: ConversationThreadAsset,
): CreateAttachment => {
  const contentType =
    asset.mediaType ||
    (asset.type === "image"
      ? "image/png"
      : asset.type === "video"
        ? "video/mp4"
        : "application/octet-stream");
  const filename = sanitizeAssistantAssetFilename(
    asset.title,
    `asset-${asset.id}.${getAssistantAssetExtension(asset)}`,
  );

  return {
    id: `asset-${asset.id}-${Date.now()}`,
    type: asset.type === "image" ? "image" : "file",
    name: filename,
    contentType,
    content:
      asset.type === "image"
        ? [
            {
              type: "image",
              image: asset.url,
              filename,
            },
          ]
        : [
            {
              type: "file",
              data: asset.url,
              mimeType: contentType,
              filename,
            },
          ],
  };
};

const toCanvasElementAttachment = (options: {
  elementId: string;
  label: string | null;
  previewUrl: string;
  originalUrl?: string | null;
  type?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
}): CreateAttachment => {
  const normalizedType = String(options.type || "").toLowerCase();
  const originalUrl = String(options.originalUrl || "").trim();
  const isVideo =
    normalizedType === "video" ||
    normalizedType === "gen-video" ||
    /^data:video\//i.test(options.previewUrl) ||
    /\.(?:mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(options.previewUrl);
  const contentType = isVideo ? "video/mp4" : "image/png";
  const extension = isVideo ? "mp4" : "png";
  const filename = sanitizeAssistantAssetFilename(
    options.label || `canvas-${options.elementId}`,
    `canvas-${options.elementId}.${extension}`,
  );
  const normalizedFilename = /\.[a-z0-9]{2,8}$/i.test(filename)
    ? filename
    : `${filename}.${extension}`;

  return {
    id: getCanvasReferenceDirectiveId({
      elementId: options.elementId,
    }),
    type: isVideo ? "file" : "image",
    name: normalizedFilename,
    contentType,
    content: isVideo
      ? [
          {
            type: "file",
            data: options.previewUrl,
            mimeType: contentType,
            filename: normalizedFilename,
            ...(originalUrl ? { originalUrl, sourceUrl: originalUrl } : {}),
          },
        ] as CreateAttachment["content"]
      : [
          {
            type: "text",
            text:
              `[Canvas reference] ${normalizedFilename}: canvasElementId=${options.elementId}; ` +
              `use the visible directive label in the user message to refer to this image. ` +
              `The original image URL is stored on the attached image part metadata.`,
          },
          {
            type: "image",
            image: originalUrl || options.previewUrl,
            filename: normalizedFilename,
            assistantReferenceKind: "canvas",
            canvasElementId: options.elementId,
            previewUrl: options.previewUrl,
            canvasImageWidth: options.imageWidth,
            canvasImageHeight: options.imageHeight,
            ...(originalUrl ? { originalUrl, sourceUrl: originalUrl } : {}),
          },
        ] as CreateAttachment["content"],
  };
};

type SelectedCanvasComposerAsset = {
  elementId: string;
  previewUrl: string;
  originalUrl: string | null;
  label: string | null;
  type: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
};

type SelectedMarkerComposerAsset = {
  markerId: string;
  elementId: string;
  previewUrl: string;
  originalUrl: string | null;
  cropUrl: string | null;
  label: string | null;
  normalizedX: number | null;
  normalizedY: number | null;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  imageWidth: number | null;
  imageHeight: number | null;
};

type AssistantReferenceComposerAsset =
  | (SelectedCanvasComposerAsset & { kind: "canvas" })
  | (SelectedMarkerComposerAsset & { kind: "mark" });

type CanvasDirectivePreview = {
  previewUrl: string;
  chipPreviewUrl?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  markerX?: number | null;
  markerY?: number | null;
  type: string | null;
  kind?: "canvas" | "mark";
};

const escapeAssistantSidebarRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getCanvasReferenceDirectiveId = (
  asset: { elementId: string },
): string => `canvas-${asset.elementId.replace(/[}\n\r]/g, "-")}`;

const getMarkerReferenceDirectiveId = (
  asset: SelectedMarkerComposerAsset,
): string => `mark-${asset.markerId.replace(/[}\n\r]/g, "-")}`;

const getAssistantReferenceDirectiveId = (
  asset: AssistantReferenceComposerAsset,
): string =>
  asset.kind === "mark"
    ? getMarkerReferenceDirectiveId(asset)
    : getCanvasReferenceDirectiveId(asset);

const getCanvasReferenceLabelPrefix = (
  asset: SelectedCanvasComposerAsset,
): "image" | "video" => {
  const normalizedType = String(asset.type || "").toLowerCase();
  return normalizedType === "video" || normalizedType === "gen-video"
    ? "video"
    : "image";
};

const getAssistantReferenceDirectiveType = (
  asset: AssistantReferenceComposerAsset,
): "canvas" | "mark" => asset.kind;

const getAssistantReferenceLabelPrefix = (
  asset: AssistantReferenceComposerAsset,
): "image" | "video" | "mark" =>
  asset.kind === "mark" ? "mark" : getCanvasReferenceLabelPrefix(asset);

const resolveAssistantReferenceDirective = (
  text: string,
  asset: AssistantReferenceComposerAsset,
): { directive: string; directiveId: string; label: string; exists: boolean } => {
  const directiveId = getAssistantReferenceDirectiveId(asset);
  const directiveType = getAssistantReferenceDirectiveType(asset);
  const existingPattern = new RegExp(
    `:${directiveType}\\[([^\\]\\n]+)\\]\\{name=${escapeAssistantSidebarRegExp(
      directiveId,
    )}\\}`,
    "u",
  );
  const existing = existingPattern.exec(text);
  if (existing?.[1]) {
    return {
      directive: existing[0],
      directiveId,
      label: existing[1],
      exists: true,
    };
  }

  const prefix = getAssistantReferenceLabelPrefix(asset);
  const labelPattern = new RegExp(`:${directiveType}\\[${prefix}(\\d{2,})\\]`, "gu");
  let maxIndex = 0;
  for (const match of text.matchAll(labelPattern)) {
    maxIndex = Math.max(maxIndex, Number(match[1] || 0));
  }
  const label = `${prefix}${String(maxIndex + 1).padStart(2, "0")}`;
  return {
    directive: `:${directiveType}[${label}]{name=${directiveId}}`,
    directiveId,
    label,
    exists: false,
  };
};

const resolveCanvasReferenceDirective = (
  text: string,
  asset: SelectedCanvasComposerAsset,
): { directive: string; directiveId: string; label: string; exists: boolean } =>
  resolveAssistantReferenceDirective(text, { ...asset, kind: "canvas" });

const hasCanvasReferenceAttachment = (
  attachments: readonly { id?: string }[],
  directiveId: string,
): boolean => attachments.some((attachment) => attachment.id === directiveId);

const CANVAS_REFERENCE_DIRECTIVE_RE =
  /:(?:canvas|mark)\[([^\]\n]{1,1024})\]\{name=([^}\n]{1,1024})\}/gu;

const toMarkerReferenceAttachment = (options: SelectedMarkerComposerAsset & {
  directiveLabel: string;
}): CreateAttachment => {
  const previewUrl = String(options.previewUrl || options.originalUrl || "").trim();
  const originalUrl = String(options.originalUrl || previewUrl || "").trim();
  const modelImageUrl = originalUrl || previewUrl;
  const filename = sanitizeAssistantAssetFilename(
    options.label || `mark-${options.markerId}`,
    `mark-${options.markerId}.png`,
  );
  const normalizedFilename = /\.[a-z0-9]{2,8}$/i.test(filename)
    ? filename
    : `${filename}.png`;
  const coordinateText =
    options.normalizedX != null && options.normalizedY != null
      ? `normalizedX=${options.normalizedX.toFixed(4)}; normalizedY=${options.normalizedY.toFixed(4)}; `
      : "";
  const pixelText =
    options.x != null && options.y != null
      ? `x=${Math.round(options.x)}; y=${Math.round(options.y)}; `
      : "";
  const sizeText =
    options.width != null && options.height != null
      ? `region=${Math.round(options.width)}x${Math.round(options.height)}; `
      : "";
  const imageSizeText =
    options.imageWidth != null && options.imageHeight != null
      ? `imageSize=${Math.round(options.imageWidth)}x${Math.round(options.imageHeight)}; `
      : "";

  return {
    id: getMarkerReferenceDirectiveId(options),
    type: "image",
    name: normalizedFilename,
    contentType: "image/png",
    content: [
      {
        type: "text",
        text:
          `[Canvas mark reference] ${options.directiveLabel}: markerId=${options.markerId}; ` +
          `canvasElementId=${options.elementId}; ${coordinateText}${pixelText}${sizeText}${imageSizeText}` +
          `Treat ${options.directiveLabel} as the exact user-selected anchor on the original image. ` +
          `The original image URL is stored on the attached image part metadata.`,
      },
      {
        type: "image",
        image: modelImageUrl,
        filename: normalizedFilename,
        assistantReferenceKind: "mark",
        originalUrl,
        sourceUrl: originalUrl,
        previewUrl,
        cropUrl: options.cropUrl,
        canvasElementId: options.elementId,
        markerId: options.markerId,
        markerLabel: options.directiveLabel,
        markerNormalizedX: options.normalizedX,
        markerNormalizedY: options.normalizedY,
        markerImageWidth: options.imageWidth,
        markerImageHeight: options.imageHeight,
      },
    ] as CreateAttachment["content"],
  };
};

const ensureHostedAssistantReferenceAsset = async (
  asset: AssistantReferenceComposerAsset,
): Promise<AssistantReferenceComposerAsset> => {
  if (asset.kind === "canvas") {
    const modelUrl = String(asset.originalUrl || asset.previewUrl || "").trim();
    const hostedUrl = await ensureAssistantSidebarHostedImageUrl(modelUrl, {
      fallbackName: `canvas-${asset.elementId}.png`,
      logContext: {
        referenceKind: "canvas",
        elementId: asset.elementId,
      },
    });
    return {
      ...asset,
      originalUrl: hostedUrl || asset.originalUrl,
    };
  }

  const modelUrl = String(asset.originalUrl || asset.previewUrl || "").trim();
  const hostedUrl = await ensureAssistantSidebarHostedImageUrl(modelUrl, {
    fallbackName: `mark-${asset.markerId}.png`,
    logContext: {
      referenceKind: "mark",
      elementId: asset.elementId,
      markerId: asset.markerId,
    },
  });
  return {
    ...asset,
    originalUrl: hostedUrl || asset.originalUrl,
  };
};

const mapCanvasReferenceVisibleOffsetToSourceOffset = (
  text: string,
  visibleOffset: number,
): number => {
  const safeVisibleOffset = Math.max(0, visibleOffset);
  let visibleCursor = 0;
  let sourceCursor = 0;

  for (const match of text.matchAll(CANVAS_REFERENCE_DIRECTIVE_RE)) {
    const matchIndex = match.index ?? 0;
    const directiveText = match[0] || "";
    const label = match[1] || "";
    const plainTextBeforeDirective = text.slice(sourceCursor, matchIndex);
    const plainTextEndVisible = visibleCursor + plainTextBeforeDirective.length;

    if (safeVisibleOffset <= plainTextEndVisible) {
      return sourceCursor + (safeVisibleOffset - visibleCursor);
    }

    visibleCursor = plainTextEndVisible;
    const directiveEndVisible = visibleCursor + label.length;
    if (safeVisibleOffset <= directiveEndVisible) {
      const midpoint = visibleCursor + label.length / 2;
      return safeVisibleOffset <= midpoint
        ? matchIndex
        : matchIndex + directiveText.length;
    }

    visibleCursor = directiveEndVisible;
    sourceCursor = matchIndex + directiveText.length;
  }

  const trailingText = text.slice(sourceCursor);
  const trailingEndVisible = visibleCursor + trailingText.length;
  if (safeVisibleOffset <= trailingEndVisible) {
    return sourceCursor + (safeVisibleOffset - visibleCursor);
  }

  return text.length;
};

const getActiveAssistantComposerTextOffset = (): number | null => {
  if (typeof window === "undefined") return null;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
    return null;
  }

  const anchorNode = selection.anchorNode;
  const anchorElement =
    anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
  const inputRoot = anchorElement?.closest(".aui-lexical-input");
  if (!inputRoot) return null;

  try {
    const range = selection.getRangeAt(0);
    const beforeRange = range.cloneRange();
    beforeRange.selectNodeContents(inputRoot);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    return beforeRange.toString().length;
  } catch {
    return null;
  }
};

const insertCanvasReferenceDirectiveIntoText = (
  text: string,
  directive: string,
  visibleOffsetOverride?: number | null,
): string => {
  const visibleOffset =
    typeof visibleOffsetOverride === "number"
      ? visibleOffsetOverride
      : getActiveAssistantComposerTextOffset();
  if (typeof visibleOffset !== "number" || visibleOffset < 0) {
    return text.trim()
      ? `${text.trimEnd()} ${directive} `
      : `${directive} `;
  }

  const offset = mapCanvasReferenceVisibleOffsetToSourceOffset(
    text,
    visibleOffset,
  );
  const before = text.slice(0, offset);
  const after = text.slice(offset);
  const beforeSpacer = before && !/\s$/.test(before) ? " " : "";
  const afterSpacer = after && !/^\s/.test(after) ? " " : "";
  return `${before}${beforeSpacer}${directive}${afterSpacer}${after}`;
};

const getAssistantAssetDownloadName = (
  asset: ConversationThreadAsset,
): string => {
  const extension = getAssistantAssetExtension(asset);
  const title = sanitizeAssistantAssetFilename(asset.title, `asset-${asset.id}`);
  return /\.[a-z0-9]{2,8}$/i.test(title) ? title : `${title}.${extension}`;
};

const AssistantThreadAssetsPopover: React.FC<{
  assets: ConversationThreadAsset[];
  onAttachAsset: (asset: ConversationThreadAsset) => Promise<void>;
  onImportAssetToCanvas?: (asset: ConversationThreadAsset) => Promise<void>;
}> = ({ assets, onAttachAsset, onImportAssetToCanvas }) => {
  const [attachingAssetId, setAttachingAssetId] = React.useState<string | null>(null);
  const [importingAssetId, setImportingAssetId] = React.useState<string | null>(null);
  const reversedAssets = React.useMemo(() => [...assets].reverse(), [assets]);

  const handleAttach = React.useCallback(
    async (asset: ConversationThreadAsset) => {
      setAttachingAssetId(asset.id);
      try {
        await onAttachAsset(asset);
      } finally {
        setAttachingAssetId(null);
      }
    },
    [onAttachAsset],
  );

  const handleImportToCanvas = React.useCallback(
    async (asset: ConversationThreadAsset) => {
      if (!onImportAssetToCanvas || asset.type === "file") return;
      setImportingAssetId(asset.id);
      try {
        await onImportAssetToCanvas(asset);
      } finally {
        setImportingAssetId(null);
      }
    },
    [onImportAssetToCanvas],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <TooltipIconButton
          tooltip="话题资产"
          side="bottom"
          type="button"
          variant="outline"
          className="bg-background/90 text-foreground hover:bg-background size-8 rounded-full border border-slate-200/80 shadow-sm backdrop-blur"
          aria-label="打开话题资产"
        >
          <FolderOpenIcon className="size-4" />
        </TooltipIconButton>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        className="w-[21rem] overflow-hidden rounded-2xl border-slate-200/80 bg-white/95 p-0 shadow-xl shadow-slate-950/10 backdrop-blur dark:border-white/10 dark:bg-[#171717]/95"
      >
        <div className="border-b border-slate-100 px-3 py-2.5 dark:border-white/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                话题资产
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                当前聊天里的上传文件和生成文件
              </div>
            </div>
            <div className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
              {assets.length}
            </div>
          </div>
        </div>
        {reversedAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
            <PaperclipIcon className="size-5 text-slate-300 dark:text-slate-600" />
            <div className="text-xs text-slate-500 dark:text-slate-400">
              这个话题里还没有可引用的文件。
            </div>
          </div>
        ) : (
          <div className="max-h-[24rem] overflow-y-auto p-2">
            {reversedAssets.map((asset) => {
              const isAttaching = attachingAssetId === asset.id;
              const isImporting = importingAssetId === asset.id;
              const canImportToCanvas =
                typeof onImportAssetToCanvas === "function" &&
                (asset.type === "image" || asset.type === "video");
              const sourceLabel =
                asset.source === "user" ? "用户上传" : "助手生成";
              return (
                <div
                  key={`${asset.source}-${asset.id}-${asset.url}`}
                  className="group flex gap-2 rounded-xl p-2 transition hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
                    {asset.type === "image" ? (
                      <img
                        src={asset.url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : asset.type === "video" ? (
                      <VideoIcon className="size-4 text-slate-500" />
                    ) : (
                      <FileIcon className="size-4 text-slate-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                      {asset.title}
                    </div>
                    <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                      <span>{sourceLabel}</span>
                      {asset.model ? (
                        <>
                          <span>·</span>
                          <span className="truncate">{asset.model}</span>
                        </>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        className="h-6 rounded-full px-2 text-[11px]"
                        disabled={isAttaching}
                        onClick={() => void handleAttach(asset)}
                      >
                        <PlusIcon className="size-3" />
                        {isAttaching ? "引用中" : "引用"}
                      </Button>
                      {canImportToCanvas ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="h-6 rounded-full px-2 text-[11px] text-slate-500"
                          disabled={isImporting}
                          onClick={() => void handleImportToCanvas(asset)}
                        >
                          <ImageIcon className="size-3" />
                          {isImporting ? "放入中" : "放入画布"}
                        </Button>
                      ) : null}
                      <Button
                        asChild
                        variant="ghost"
                        size="xs"
                        className="h-6 rounded-full px-2 text-[11px] text-slate-500"
                      >
                        <a
                          href={asset.url}
                          download={getAssistantAssetDownloadName(asset)}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <DownloadIcon className="size-3" />
                          下载
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

const AssistantSurfaceControls: React.FC<{
  assets: ConversationThreadAsset[];
  isFullscreen: boolean;
  onAttachAsset: (asset: ConversationThreadAsset) => Promise<void>;
  onHideAssistant: () => void;
  onImportAssetToCanvas?: (asset: ConversationThreadAsset) => Promise<void>;
  onToggleFullscreen: () => void;
}> = ({
  assets,
  isFullscreen,
  onAttachAsset,
  onHideAssistant,
  onImportAssetToCanvas,
  onToggleFullscreen,
}) => {
  const { open: isThreadHistoryOpen, toggleSidebar } = useSidebar();

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-end gap-2 px-4 pt-4">
      <div className="pointer-events-auto">
        <TooltipIconButton
          tooltip={isThreadHistoryOpen ? "隐藏历史话题" : "打开历史话题"}
          side="bottom"
          type="button"
          variant="outline"
          onClick={toggleSidebar}
          className="bg-background/90 text-foreground hover:bg-background size-8 rounded-full border border-slate-200/80 shadow-sm backdrop-blur"
          aria-label={isThreadHistoryOpen ? "隐藏历史话题" : "打开历史话题"}
        >
          <HistoryIcon className="size-4" />
        </TooltipIconButton>
      </div>
      <div className="pointer-events-auto">
        <AssistantThreadAssetsPopover
          assets={assets}
          onAttachAsset={onAttachAsset}
          onImportAssetToCanvas={onImportAssetToCanvas}
        />
      </div>
      <div className="pointer-events-auto">
        <TooltipIconButton
          tooltip={isFullscreen ? "Exit fullscreen chat" : "Open fullscreen chat"}
          side="bottom"
          type="button"
          variant="outline"
          onClick={onToggleFullscreen}
          className="bg-background/90 text-foreground hover:bg-background size-8 rounded-full border border-slate-200/80 shadow-sm backdrop-blur"
          aria-label={isFullscreen ? "Exit fullscreen chat" : "Open fullscreen chat"}
        >
          {isFullscreen ? (
            <Minimize2Icon className="size-4" />
          ) : (
            <Maximize2Icon className="size-4" />
          )}
        </TooltipIconButton>
      </div>
      <div className="pointer-events-auto">
        <TooltipIconButton
          tooltip="隐藏助手侧边栏"
          side="bottom"
          type="button"
          variant="outline"
          onClick={onHideAssistant}
          className="bg-background/90 text-foreground hover:bg-background size-8 rounded-full border border-slate-200/80 shadow-sm backdrop-blur"
          aria-label="隐藏助手侧边栏"
        >
          <PanelRightCloseIcon className="size-4" />
        </TooltipIconButton>
      </div>
    </div>
  );
};

const AssistantComposerModelSelector: React.FC<{
  modelGroups: AssistantSidebarModelGroup[];
  modelOptions: AssistantSidebarModelOption[];
  onModelChange: (value: string) => void;
  onReasoningEffortChange: (value: string) => void;
  reasoningEffort?: string | undefined;
  selectedModelValue: string;
}> = ({
  modelGroups,
  modelOptions,
  onModelChange,
  onReasoningEffortChange,
  reasoningEffort,
  selectedModelValue,
}) => (
  <ModelSelector.Root
    models={modelOptions}
    effort={reasoningEffort ?? ""}
    onEffortChange={onReasoningEffortChange}
    onValueChange={onModelChange}
    value={selectedModelValue}
  >
    <ModelSelector.ModelContext />
    <ModelSelector.Trigger
      className="h-8 min-w-0 max-w-[9.5rem] shrink rounded-full border-transparent bg-transparent px-2 text-xs font-medium text-[#444746] shadow-none hover:bg-[#444746]/8 hover:text-[#1f1f1f] dark:text-[#c4c7c5] dark:hover:bg-[#c4c7c5]/10 dark:hover:text-[#e3e3e3] @max-sm:max-w-[7.5rem]"
      size="sm"
      variant="ghost"
    >
      <ModelSelector.Value showEffort />
    </ModelSelector.Trigger>
    <ModelSelector.Content className="z-[80] w-80 max-w-[calc(100vw-2rem)]">
      <ModelSelector.Search placeholder="搜索模型..." />
      <ModelSelector.List>
        <ModelSelector.Empty>
          {"没有匹配的模型"}
        </ModelSelector.Empty>
        {modelGroups.map((group) => (
          <ModelSelector.Group key={group.label} heading={group.label}>
            {group.models.map((model) => (
              <ModelSelector.Item key={model.id} model={model} />
            ))}
          </ModelSelector.Group>
        ))}
      </ModelSelector.List>
      <ModelSelector.Effort label="思考强度" />
    </ModelSelector.Content>
  </ModelSelector.Root>
);

const AssistantSidebarInstructions: React.FC = () => {
  useAssistantInstructions(ASSISTANT_SIDEBAR_MODEL_INSTRUCTIONS);
  return null;
};

const buildAssistantSidebarWorkspaceContext = (options: {
  browserAgent: AssistantSidebarProps["browserAgent"];
  workspaceId: string;
}) => {
  const lines = [
    "[XC Studio workspace context]",
    options.workspaceId ? `Workspace id: ${options.workspaceId}` : "",
    typeof options.browserAgent.canvasElementCount === "number"
      ? `Canvas elements: ${options.browserAgent.canvasElementCount}`
      : "",
    typeof options.browserAgent.rootElementCount === "number"
      ? `Root canvas elements: ${options.browserAgent.rootElementCount}`
      : "",
    typeof options.browserAgent.selectedElementCount === "number"
      ? `Selected elements: ${options.browserAgent.selectedElementCount}`
      : "",
    options.browserAgent.selectedElementId
      ? `Selected element id: ${options.browserAgent.selectedElementId}`
      : "",
    options.browserAgent.selectedElementType
      ? `Selected element type: ${options.browserAgent.selectedElementType}`
      : "",
    options.browserAgent.selectedTreeNodeKind
      ? `Selected tree node kind: ${options.browserAgent.selectedTreeNodeKind}`
      : "",
    options.browserAgent.selectedElementLabel
      ? `Selected element label: ${options.browserAgent.selectedElementLabel}`
      : "",
    "This context is lightweight text only. It does not include hidden image pixels, image URLs, inline binary payloads, or legacy chat messages.",
  ].filter(Boolean);

  return lines.length > 2 ? lines.join("\n") : "";
};

const AssistantSidebarWorkspaceContext: React.FC<{
  browserAgent: AssistantSidebarProps["browserAgent"];
  workspaceId: string;
}> = ({ browserAgent, workspaceId }) => {
  useAssistantContext({
    getContext: () =>
      buildAssistantSidebarWorkspaceContext({
        browserAgent,
        workspaceId,
      }),
  });
  return null;
};

const AssistantComposerImageModeControls: React.FC<{
  imageGenerationUi?: AssistantSidebarProps["imageGenerationUi"];
  imageModeEnabled: boolean;
  onImageModeEnabledChange: (enabled: boolean) => void;
  imageModePanelOpen: boolean;
  onImageModePanelOpenChange: (open: boolean) => void;
  runtimeConfig?: AssistantSidebarProps["messageActions"]["runtimeConfig"];
}> = ({
  imageGenerationUi,
  imageModeEnabled,
  onImageModeEnabledChange,
  imageModePanelOpen,
  onImageModePanelOpenChange,
  runtimeConfig,
}) => {
  const [settingsRevision, setSettingsRevision] = React.useState(0);
  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleProviderSettingsUpdated = () => {
      setSettingsRevision((current) => current + 1);
    };
    window.addEventListener(
      "provider-settings-updated",
      handleProviderSettingsUpdated,
    );
    return () => {
      window.removeEventListener(
        "provider-settings-updated",
        handleProviderSettingsUpdated,
      );
    };
  }, []);
  const imageModelOptions = React.useMemo(
    () => buildAssistantImageModelOptions(),
    [settingsRevision],
  );
  const selectedModelValue = React.useMemo(
    () =>
      toAssistantModelValue(
        runtimeConfig?.activeImageModel || runtimeConfig?.preferredImageModel || "",
        runtimeConfig?.activeImageProviderId || runtimeConfig?.preferredImageProviderId,
      ) || imageModelOptions[0]?.id || "",
    [
      imageModelOptions,
      runtimeConfig?.activeImageModel,
      runtimeConfig?.activeImageProviderId,
      runtimeConfig?.preferredImageModel,
      runtimeConfig?.preferredImageProviderId,
    ],
  );
  const selectedModel =
    imageModelOptions.find((option) => option.id === selectedModelValue) ||
    imageModelOptions[0];
  const isToolReady = buildAssistantChatImageGenerationConfig(runtimeConfig).enabled;
  const disabled = !imageGenerationUi;
  const imageGenCount = normalizePositiveInteger(runtimeConfig?.imageGenCount);
  const currentSummary = `${runtimeConfig?.imageGenRatio || "1:1"} · ${runtimeConfig?.imageGenRes || "1K"} · ${imageGenCount} 张`;
  const selectedModelLabel = imageGenerationUi?.autoModelSelect
    ? "自动选择模型"
    : selectedModel?.name || runtimeConfig?.activeImageModel || "未配置模型";
  const handleToggleImageMode = React.useCallback(
    () => {
      if (imageModeEnabled) {
        if (!imageModePanelOpen) {
          onImageModePanelOpenChange(true);
          return;
        }
        onImageModeEnabledChange(false);
        onImageModePanelOpenChange(false);
        return;
      }
      onImageModeEnabledChange(true);
      onImageModePanelOpenChange(true);
    },
    [
      imageModeEnabled,
      imageModePanelOpen,
      onImageModeEnabledChange,
      onImageModePanelOpenChange,
    ],
  );

  const handleModelSelect = React.useCallback(
    (value: string) => {
      if (value === "__auto__") {
        imageGenerationUi?.setAutoModelSelect(true);
        return;
      }
      const selection = parseAssistantModelValue(value);
      if (!selection.modelId) return;
      imageGenerationUi?.setAutoModelSelect(false);
      imageGenerationUi?.setPreferredImageModel(selection.modelId);
      imageGenerationUi?.setPreferredImageProviderId(selection.providerId || null);
    },
    [imageGenerationUi],
  );

  return (
    <Popover
      open={imageModeEnabled && imageModePanelOpen}
      onOpenChange={onImageModePanelOpenChange}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          onClick={handleToggleImageMode}
          aria-label={imageModeEnabled ? "关闭图片模式" : "打开图片模式"}
          aria-pressed={imageModeEnabled}
          disabled={disabled}
          variant={imageModeEnabled ? "default" : "ghost"}
          size="sm"
          className={cn(
            "h-8 shrink-0 rounded-full px-2 text-xs",
            imageModeEnabled
              ? "shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <ImageIcon className="size-3.5" />
          <span>图片</span>
          {imageModeEnabled ? (
            <span className="hidden max-w-[5.5rem] truncate text-[11px] opacity-80 @md:inline">
              {runtimeConfig?.imageGenRatio || "1:1"} · {imageGenCount} 张
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="z-[90] w-[20rem] overflow-hidden rounded-xl border border-border bg-popover p-0 text-popover-foreground shadow-lg"
      >
        <div className="border-b border-border/70 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span>图片模式</span>
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    isToolReady ? "bg-emerald-500" : "bg-amber-500",
                  )}
                  aria-hidden="true"
                />
              </div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {selectedModelLabel}
              </div>
            </div>
            <div className="shrink-0 rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
              {currentSummary}
            </div>
          </div>
        </div>

        <div className="space-y-3 p-3">
          <div className="grid gap-1.5">
            <div className="text-[11px] font-medium text-muted-foreground">
              模型
            </div>
            <select
              value={imageGenerationUi?.autoModelSelect ? "__auto__" : selectedModelValue}
              onChange={(event) => handleModelSelect(event.currentTarget.value)}
              disabled={disabled || imageModelOptions.length === 0}
              className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="图片生成模型"
            >
              <option value="__auto__">自动选择</option>
              {imageModelOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <div className="text-[11px] font-medium text-muted-foreground">
              比例
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {IMAGE_ASPECT_RATIO_OPTIONS.map((option) => {
                const active = (runtimeConfig?.imageGenRatio || "1:1") === option.id;
                return (
                  <Button
                    key={option.id}
                    type="button"
                    variant={active ? "default" : "secondary"}
                    size="xs"
                    onClick={() => imageGenerationUi?.setImageGenRatio(option.id)}
                    className={cn(
                      "h-7 rounded-md px-2 text-xs shadow-none",
                      !active && "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
            <div className="grid gap-1.5">
              <div className="text-[11px] font-medium text-muted-foreground">
                分辨率
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {IMAGE_RESOLUTION_OPTIONS.map((resolution) => {
                  const active = (runtimeConfig?.imageGenRes || "1K") === resolution;
                  return (
                    <Button
                      key={resolution}
                      type="button"
                      variant={active ? "default" : "secondary"}
                      size="xs"
                      onClick={() => imageGenerationUi?.setImageGenRes(resolution)}
                      className={cn(
                        "h-7 rounded-md px-2 text-xs shadow-none",
                        !active && "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {resolution}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">
                  张数
                </span>
                <span className="text-[10px] text-muted-foreground">
                  不限上限
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="grid grid-cols-6 gap-1">
                  {IMAGE_COUNT_QUICK_OPTIONS.map((count) => {
                    const active = imageGenCount === count;
                    return (
                      <Button
                        key={count}
                        type="button"
                        variant={active ? "default" : "secondary"}
                        size="xs"
                        onClick={() => imageGenerationUi?.setImageGenCount(count)}
                        className={cn(
                          "h-7 min-w-0 rounded-md px-0 text-xs shadow-none",
                          !active && "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {count}
                      </Button>
                    );
                  })}
                </div>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={imageGenCount}
                  onChange={(event) =>
                    imageGenerationUi?.setImageGenCount(
                      normalizePositiveInteger(event.currentTarget.value, imageGenCount),
                    )
                  }
                  onWheel={(event) => event.currentTarget.blur()}
                  className="h-8 rounded-md text-center text-xs font-medium shadow-none"
                  aria-label="图片生成张数"
                />
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const AssistantSidebarToolOverrides: React.FC<{
  browserAgent: AssistantSidebarProps["browserAgent"];
}> = ({ browserAgent }) => {
  const createTargetElementRef = React.useRef(browserAgent.createTargetElement);

  React.useEffect(() => {
    createTargetElementRef.current = browserAgent.createTargetElement;
  }, [browserAgent.createTargetElement]);

  useAuiToolOverrides({
    createTargetElement: {
      execute: async (args: AssistantSidebarCreateTargetElementArgs) => {
        const createTargetElement = createTargetElementRef.current;
        if (typeof createTargetElement !== "function") {
          return {
            ok: false,
            elementId: null,
            prompt: args.prompt || "",
            referenceCount: args.referenceImages?.length || 0,
            error: "Canvas target creation is unavailable in this workspace.",
          };
        }

        const elementId = createTargetElement({
          prompt: args.prompt,
          referenceImages: args.referenceImages || [],
        });
        return {
          ok: Boolean(elementId),
          elementId,
          prompt: args.prompt || "",
          referenceCount: args.referenceImages?.length || 0,
          ...(elementId ? {} : { error: "No canvas target was created." }),
        };
      },
    },
  });

  return null;
};

const AssistantStreamStatusFooter: React.FC<{
  status: AssistantSidebarStreamStatus | null;
}> = ({ status }) => {
  if (!status) return null;

  const isToolStatus =
    status.stage === "tool-start" || status.stage === "tool-finish";
  const isError = status.stage === "error";

  return (
    <div
      className={`flex min-w-0 items-center gap-2 rounded-2xl border px-3 py-2 text-xs ${
        isError
          ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
          : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
      }`}
      aria-live="polite"
    >
      <DotMatrix
        state={isError ? "error" : isToolStatus ? "loading" : "streaming"}
        label={status.message}
        className={isError ? "text-rose-500" : "text-[#1f3b9b] dark:text-[#a8c7fa]"}
      />
      <span className="min-w-0 truncate">{status.message}</span>
    </div>
  );
};

const AssistantComposerFooter: React.FC<{
  modelContextWindow?: number | undefined;
  status: AssistantSidebarStreamStatus | null;
}> = ({ modelContextWindow, status }) => {
  const usage = useThreadTokenUsage();
  const showContextUsage = Boolean(modelContextWindow && usage?.totalTokens);

  if (!status && !showContextUsage) return null;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="min-w-0 flex-1">
        <AssistantStreamStatusFooter status={status} />
      </div>
      {showContextUsage ? (
        <ContextDisplay.Ring
          modelContextWindow={modelContextWindow!}
          usage={usage}
          side="top"
          className="shrink-0 rounded-full hover:bg-[#444746]/8 dark:hover:bg-[#c4c7c5]/10"
        />
      ) : null}
    </div>
  );
};

const useAssistantChatRuntime = (
  runtimeConfig: AssistantSidebarProps["messageActions"]["runtimeConfig"],
  activeConversationArchived: boolean,
  imageModeEnabled: boolean,
  selectedModelValue: string,
  onStreamStatus?:
    | ((status: AssistantSidebarStreamStatus | null) => void)
    | undefined,
  onReasoningDiagnosis?:
    | ((diagnosis: AssistantSidebarReasoningRuntimeDiagnosis) => void)
    | undefined,
) => {
  const [searchSettingsRevision, setSearchSettingsRevision] = React.useState(0);
  const threadRuntimeId = useAuiState((state) => state.threadListItem.id);
  const modelMode = runtimeConfig?.modelMode || "fast";
  const fallbackSelection = getBestModelSelection(modelMode === "thinking" ? "thinking" : "text");
  const parsedSelection = parseAssistantModelValue(selectedModelValue);
  const selection = parsedSelection.modelId ? parsedSelection : fallbackSelection;
  const provider = buildAssistantChatProviderConfig(selection.providerId);
  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleSearchSettingsUpdated = () => {
      setSearchSettingsRevision((current) => current + 1);
    };
    window.addEventListener(
      "search-settings-updated",
      handleSearchSettingsUpdated,
    );
    return () => {
      window.removeEventListener(
        "search-settings-updated",
        handleSearchSettingsUpdated,
      );
    };
  }, []);
  const webSearchConfig = React.useMemo(
    () => buildAssistantChatWebSearchConfig(runtimeConfig),
    [runtimeConfig?.webEnabled, searchSettingsRevision],
  );
  const imageGenerationConfig = React.useMemo(
    () => ({
      ...buildAssistantChatImageGenerationConfig(runtimeConfig),
      enforceSettings: imageModeEnabled,
    }),
    [
      runtimeConfig?.activeImageModel,
      runtimeConfig?.activeImageProviderId,
      runtimeConfig?.preferredImageModel,
      runtimeConfig?.preferredImageProviderId,
      runtimeConfig?.imageGenRatio,
      runtimeConfig?.imageGenRes,
      runtimeConfig?.imageGenCount,
      imageModeEnabled,
    ],
  );
  const resumableStorage = React.useMemo(
    () =>
      createAssistantSidebarResumableStorage({
        key: `xc-studio:assistant-chat:resumable:${threadRuntimeId || "default"}`,
        ownerId: ASSISTANT_SIDEBAR_PAGE_INSTANCE_ID,
      }),
    [threadRuntimeId],
  );
  const lastStreamErrorDiagnosticRef =
    React.useRef<AssistantSidebarStreamErrorDiagnostic | null>(null);
  const lastRuntimeConfigLogSignatureRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const details = {
      threadRuntimeId,
      modelMode,
      modelName: toAssistantModelValue(selection.modelId, selection.providerId),
      providerId: provider.id,
      providerName: provider.name,
      providerBaseUrl: summarizeProviderBaseUrl(provider.baseUrl),
      hasApiKey: Boolean(provider.apiKey),
      webSearchEnabled: webSearchConfig.enabled,
      webSearchActiveProviderId: webSearchConfig.activeProviderId,
      webSearchProviderId: webSearchConfig.provider?.id,
      webSearchProviderName: webSearchConfig.provider?.name,
      webSearchProviderType:
        webSearchConfig.provider?.providerType ||
        webSearchConfig.provider?.catalogId,
      webSearchProviderBaseUrl: summarizeProviderBaseUrl(
        webSearchConfig.provider?.baseUrl,
      ),
      webSearchMode: webSearchConfig.defaults?.mode,
      webSearchWebCount: webSearchConfig.defaults?.webCount,
      webSearchImageCount: webSearchConfig.defaults?.imageCount,
      webSearchTimeRange: webSearchConfig.defaults?.timeRange,
      webSearchCompressionMode: webSearchConfig.defaults?.compressionMode,
      imageGenerationEnabled: imageGenerationConfig.enabled,
      imageModeEnabled,
      imageModelId: imageGenerationConfig.modelId,
      imageProviderId: imageGenerationConfig.provider.id,
      imageProviderName: imageGenerationConfig.provider.name,
      imageProviderBaseUrl: summarizeProviderBaseUrl(
        imageGenerationConfig.provider.baseUrl,
      ),
      imageAspectRatio: imageGenerationConfig.aspectRatio,
      imageResolution: imageGenerationConfig.resolution,
      imageCount: imageGenerationConfig.count,
      imageSettingsLocked: imageGenerationConfig.enforceSettings === true,
      hasPendingResumableStream: Boolean(resumableStorage.getStreamId()),
      archived: activeConversationArchived,
    };
    const signature = JSON.stringify(details);
    if (lastRuntimeConfigLogSignatureRef.current === signature) return;
    lastRuntimeConfigLogSignatureRef.current = signature;
    logAssistantSidebar("runtime_config_ready", details);
  }, [
    activeConversationArchived,
    imageGenerationConfig.enforceSettings,
    imageGenerationConfig.enabled,
    imageGenerationConfig.modelId,
    imageGenerationConfig.provider.id,
    imageGenerationConfig.aspectRatio,
    imageGenerationConfig.resolution,
    imageGenerationConfig.count,
    imageModeEnabled,
    modelMode,
    provider.apiKey,
    provider.id,
    resumableStorage,
    selection.modelId,
    selection.providerId,
    threadRuntimeId,
    webSearchConfig.enabled,
    webSearchConfig.activeProviderId,
    webSearchConfig.provider?.id,
    webSearchConfig.provider?.name,
    webSearchConfig.provider?.providerType,
    webSearchConfig.provider?.catalogId,
    webSearchConfig.provider?.baseUrl,
    webSearchConfig.defaults?.mode,
    webSearchConfig.defaults?.webCount,
    webSearchConfig.defaults?.imageCount,
    webSearchConfig.defaults?.timeRange,
    webSearchConfig.defaults?.compressionMode,
  ]);
  const transport = React.useMemo(
    () =>
      new AssistantChatTransport({
        api: "/api/assistant-chat",
        fetch: createAssistantChatDebugFetch({
          onReasoningDiagnosis,
          onStreamError: (diagnostic) => {
            lastStreamErrorDiagnosticRef.current = diagnostic;
          },
        }),
        resumable: {
          storage: resumableStorage,
          resumeApi: (streamId) =>
            `/api/assistant-chat/resume/${encodeURIComponent(streamId)}`,
        },
        body: {
          providerConfig: {
            provider,
          },
            webSearch: webSearchConfig,
            imageGeneration: imageGenerationConfig,
          },
        prepareSendMessagesRequest: (options) => {
          const messages = Array.isArray(options.messages) ? options.messages : [];
          const lastMessage = messages.at(-1);
          lastStreamErrorDiagnosticRef.current = null;
          logAssistantSidebar("prepare_send_messages", {
            threadRuntimeId,
            id: options.id,
            trigger: options.trigger,
            messageId: options.messageId,
            messageCount: messages.length,
            lastRole: lastMessage?.role,
            lastTextPreview: getMessageTextPreview(lastMessage),
          });
          return undefined;
        },
      }),
    [
      provider.apiKey,
      provider.baseUrl,
      provider.id,
      provider.name,
      resumableStorage,
      selection.modelId,
      selection.providerId,
      threadRuntimeId,
      webSearchConfig,
      imageGenerationConfig,
      imageModeEnabled,
      onStreamStatus,
      onReasoningDiagnosis,
    ],
  );

  return useChatRuntime({
    transport,
    isSendDisabled: activeConversationArchived,
    sendAutomaticallyWhen: assistantSidebarShouldSendAutomatically,
    onData: (data) => {
      const streamStatus = toAssistantSidebarStreamStatus(data);
      if (streamStatus) {
        if (
          streamStatus.stage === "complete" ||
          streamStatus.stage === "error"
        ) {
          if (streamStatus.stage === "error") {
            onStreamStatus?.(streamStatus);
          }
          window.setTimeout(() => {
            onStreamStatus?.(null);
          }, 1200);
        } else {
          onStreamStatus?.(streamStatus);
        }
      }
      logAssistantSidebar("stream_data", {
        type:
          data && typeof data === "object" && "type" in data
            ? String((data as { type?: unknown }).type)
            : typeof data,
      });
    },
    onError: (error) => {
      resumableStorage.clear();
      onStreamStatus?.(null);
      const streamError = lastStreamErrorDiagnosticRef.current;
      console.error(
        `[assistant-sidebar] chat runtime error: ${formatAssistantSidebarErrorForConsole(error)}${
          streamError
            ? ` | lastStreamError=${formatAssistantSidebarLogDetailsForConsole(streamError)}`
            : ""
        }`,
      );
      console.error("[assistant-sidebar] chat runtime error", {
        error: summarizeClientErrorForLog(error),
        streamError,
      });
      logAssistantSidebar("resumable_stream_cleared", {
        reason: "runtime_error",
      });
    },
    onFinish: ({ message, messages, isAbort, isDisconnect, isError }) => {
      if (isError || isAbort || isDisconnect) {
        resumableStorage.clear();
        onStreamStatus?.(null);
        logAssistantSidebar("resumable_stream_cleared", {
          reason: isError
            ? "stream_error"
            : isAbort
            ? "stream_abort"
            : "stream_disconnect",
        });
      }
      logAssistantSidebar("stream_finish", {
        messageId: message?.id,
        messagePartCount: Array.isArray(message?.parts)
          ? message.parts.length
          : undefined,
        reasoningPartCount: getReasoningPartCount(message),
        totalMessages: Array.isArray(messages) ? messages.length : undefined,
        isAbort,
        isDisconnect,
        isError,
      });
    },
  });
};

type AssistantSidebarAiSdkRuntimeInnerProps = AssistantSidebarProps & {
  modelGroups: AssistantSidebarModelGroup[];
  modelOptions: AssistantSidebarModelOption[];
  onSelectedModelValueChange: (value: string) => void;
  onSelectedReasoningEffortChange: (value: string) => void;
  reasoningEffort: string | undefined;
  selectedModelValue: string;
  selectedReasoningEffort?: string | undefined;
};

const AssistantSidebarAiSdkRuntimeInner: React.FC<AssistantSidebarAiSdkRuntimeInnerProps> = (props) => {
  const { session, panelUi, messageActions, browserAgent } = props;
  const {
    activeConversationId,
    conversations,
    isHydrated: isSessionHydrated = !session.workspaceId,
    setActiveConversationId,
    setConversations,
    workspaceId,
  } = session;
  const {
    isFullscreen = false,
    setShowAssistant,
    setIsFullscreen = () => {},
    onToggleFullscreen,
  } = panelUi;
  const [isThreadListOpen, setIsThreadListOpen] = React.useState(isFullscreen);
  const conversationsRef = React.useRef(conversations);
  const activeConversationIdRef = React.useRef(activeConversationId);
  const isThreadListHydratedRef = React.useRef(
    !workspaceId || isSessionHydrated || conversations.length > 0,
  );
  const threadListHydrationWaitersRef = React.useRef<Array<() => void>>([]);
  const activeConversation = React.useMemo(
    () => conversations.find((item) => item.id === activeConversationId) || null,
    [activeConversationId, conversations],
  );
  const activeConversationArchived = Boolean(activeConversation?.archivedAt);
  const [imageModeEnabled, setImageModeEnabled] = React.useState(false);
  const [imageModePanelOpen, setImageModePanelOpen] = React.useState(false);
  const [streamStatus, setStreamStatus] =
    React.useState<AssistantSidebarStreamStatus | null>(null);
  const runtimeConfigRef = React.useRef(messageActions.runtimeConfig);
  const imageGenerationUiRef = React.useRef(props.imageGenerationUi);
  runtimeConfigRef.current = messageActions.runtimeConfig;
  imageGenerationUiRef.current = props.imageGenerationUi;

  React.useEffect(() => {
    installAssistantSidebarDiagnostics();
  }, []);

  React.useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  React.useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  React.useEffect(() => {
    const hydrated =
      !workspaceId ||
      isSessionHydrated ||
      conversations.length > 0;
    isThreadListHydratedRef.current = hydrated;
    if (!hydrated) return;
    const waiters = threadListHydrationWaitersRef.current.splice(0);
    waiters.forEach((resolve) => resolve());
  }, [conversations.length, isSessionHydrated, workspaceId]);

  const waitForThreadListHydration = React.useCallback(async () => {
    if (isThreadListHydratedRef.current) return;
    await new Promise<void>((resolve) => {
      threadListHydrationWaitersRef.current.push(resolve);
    });
  }, []);

  React.useEffect(() => {
    if (isFullscreen) {
      setIsThreadListOpen(true);
    }
  }, [isFullscreen]);

  React.useEffect(() => {
    if (!imageModeEnabled && imageModePanelOpen) {
      setImageModePanelOpen(false);
    }
  }, [imageModeEnabled, imageModePanelOpen]);

  const refs = React.useMemo<WorkspaceConversationRefs>(
    () => ({
      conversationsRef,
      activeConversationIdRef,
      isThreadListHydratedRef,
      waitForThreadListHydration,
      workspaceId,
      setConversations,
      setActiveConversationId,
    }),
    [
      setActiveConversationId,
      setConversations,
      waitForThreadListHydration,
      workspaceId,
    ],
  );
  const threadListAdapter = React.useMemo(
    () => createWorkspaceRemoteThreadListAdapter(refs),
    [refs],
  );
  const welcomeSuggestions = React.useMemo(
    () => buildOfficialThreadSuggestions(browserAgent.selectedElementLabel),
    [browserAgent.selectedElementLabel],
  );
  const aui = useAui({
    unstable_interactables: unstable_Interactables(),
    tools: Tools({
      toolkit: assistantSidebarToolkit,
      mcpApp: McpAppRenderer({
        host: McpAppsRemoteHost({ url: ASSISTANT_SIDEBAR_MCP_APPS_URL }),
        hostInfo: {
          name: "XC Studio",
          version: "assistant-ui-sidebar",
        },
      }),
    }),
    suggestions: Suggestions(welcomeSuggestions),
  });
  const handleReasoningDiagnosis = React.useCallback(
    (diagnosis: AssistantSidebarReasoningRuntimeDiagnosis) => {
      logAssistantSidebar("reasoning_diagnosis", {
        threadId: activeConversationIdRef.current || null,
        requestId: diagnosis.requestId,
        requestedReasoningEffort: diagnosis.requestedReasoningEffort,
        reasoningRequested: diagnosis.reasoningRequested,
        reasoningReturned: diagnosis.reasoningReturned,
        likelyCause: diagnosis.likelyCause,
        elapsedMs: diagnosis.elapsedMs,
        url: diagnosis.url,
      });
      if (
        diagnosis.reasoningRequested &&
        !diagnosis.reasoningReturned &&
        isAssistantSidebarDebugEnabled()
      ) {
        console.info(
          "[assistant-sidebar] 已请求 reasoning，但上游流没有返回 AI SDK reasoning part；这通常表示当前供应商/模型未返回 reasoning summary，或中转没有透传 reasoning 事件。",
          diagnosis,
        );
      }
    },
    [],
  );

  const runtime = useRemoteThreadListRuntime({
    adapter: threadListAdapter,
    threadId: activeConversationId,
    onThreadIdChange: (threadId) => {
      if (threadId && threadId !== activeConversationIdRef.current) {
        activeConversationIdRef.current = threadId;
        setActiveConversationId(threadId);
      }
    },
    runtimeHook: function WorkspaceAssistantChatRuntime() {
      return useAssistantChatRuntime(
        messageActions.runtimeConfig,
        activeConversationArchived,
        imageModeEnabled,
        props.selectedModelValue,
        setStreamStatus,
        handleReasoningDiagnosis,
      );
    },
  });
  const activeConversationAssets = React.useMemo(
    () =>
      getConversationAssetsFromAssistantThread(
        activeConversation?.assistantThread,
      ),
    [activeConversation?.assistantThread],
  );
  const handleAttachConversationAsset = React.useCallback(
    async (asset: ConversationThreadAsset) => {
      await runtime.thread.composer.addAttachment(
        toAssistantAssetAttachment(asset),
      );
    },
    [runtime],
  );
  const handleImportConversationAssetToCanvas = React.useCallback(
    async (asset: ConversationThreadAsset) => {
      const importAssetToCanvas = browserAgent.importAssetToCanvas;
      if (typeof importAssetToCanvas !== "function") return;
      const elementId = await importAssetToCanvas({
        url: asset.url,
        type: asset.type,
        title: asset.title,
        mediaType: asset.mediaType,
      });
      logAssistantSidebar("topic_asset_imported_to_canvas", {
        assetId: asset.id,
        assetType: asset.type,
        assetSource: asset.source,
        elementId,
      });
    },
    [browserAgent.importAssetToCanvas],
  );
  const selectedCanvasAsset = React.useMemo(() => {
    const elementId = String(
      browserAgent.referenceElementId || browserAgent.selectedElementId || "",
    ).trim();
    if (!elementId || typeof browserAgent.resolveElementAsset !== "function") {
      return null;
    }
    const asset = browserAgent.resolveElementAsset(elementId);
    const previewUrl = String(asset?.previewUrl || "").trim();
    if (!previewUrl) return null;
    return {
      elementId,
      previewUrl,
      originalUrl: String(asset?.originalUrl || "").trim() || null,
      label: asset?.label || browserAgent.selectedElementLabel || null,
      type: asset?.type || browserAgent.selectedElementType || null,
      imageWidth:
        Number.isFinite(Number(asset?.imageWidth)) && Number(asset?.imageWidth) > 0
          ? Number(asset?.imageWidth)
          : null,
      imageHeight:
        Number.isFinite(Number(asset?.imageHeight)) && Number(asset?.imageHeight) > 0
          ? Number(asset?.imageHeight)
          : null,
    };
  }, [
    browserAgent.resolveElementAsset,
    browserAgent.referenceElementId,
    browserAgent.referenceSelectionNonce,
    browserAgent.selectedElementId,
    browserAgent.selectedElementLabel,
    browserAgent.selectedElementType,
  ]);
  const selectedMarkerAsset = React.useMemo(() => {
    const markerId = String(browserAgent.selectedMarkerId || "").trim();
    if (!markerId || typeof browserAgent.resolveMarkerAsset !== "function") {
      return null;
    }
    const asset = browserAgent.resolveMarkerAsset(markerId);
    const previewUrl = String(asset?.previewUrl || asset?.originalUrl || "").trim();
    if (!asset || !previewUrl) return null;
    return {
      markerId: asset.markerId,
      elementId: asset.elementId,
      previewUrl,
      originalUrl: String(asset.originalUrl || "").trim() || previewUrl,
      cropUrl: asset.cropUrl,
      label: asset.label,
      normalizedX: asset.normalizedX,
      normalizedY: asset.normalizedY,
      x: asset.x,
      y: asset.y,
      width: asset.width,
      height: asset.height,
      imageWidth: asset.imageWidth,
      imageHeight: asset.imageHeight,
    };
  }, [
    browserAgent.resolveMarkerAsset,
    browserAgent.selectedMarkerId,
  ]);
  const selectedReferenceAsset = React.useMemo<AssistantReferenceComposerAsset | null>(() => {
    if (selectedCanvasAsset && Number(browserAgent.referenceSelectionNonce || 0) > 0) {
      return { ...selectedCanvasAsset, kind: "canvas" };
    }
    if (selectedMarkerAsset) return { ...selectedMarkerAsset, kind: "mark" };
    if (selectedCanvasAsset) return { ...selectedCanvasAsset, kind: "canvas" };
    return null;
  }, [
    browserAgent.referenceSelectionNonce,
    selectedCanvasAsset,
    selectedMarkerAsset,
  ]);
  const [canvasDirectivePreviews, setCanvasDirectivePreviews] = React.useState<
    Record<string, CanvasDirectivePreview>
  >({});
  const [pendingCanvasReferenceAssets, setPendingCanvasReferenceAssets] =
    React.useState<Record<string, AssistantReferenceComposerAsset>>({});
  const composerVisibleCursorOffsetRef = React.useRef<number | null>(null);
  const pendingCanvasReferenceAssetsRef = React.useRef(pendingCanvasReferenceAssets);
  const confirmedCanvasReferenceIdsRef = React.useRef<Set<string>>(new Set());
  const handledCanvasReferenceSelectionTokenRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    pendingCanvasReferenceAssetsRef.current = pendingCanvasReferenceAssets;
  }, [pendingCanvasReferenceAssets]);
  const rememberComposerVisibleCursorOffset = React.useCallback(() => {
    const visibleOffset = getActiveAssistantComposerTextOffset();
    if (typeof visibleOffset === "number" && visibleOffset >= 0) {
      composerVisibleCursorOffsetRef.current = visibleOffset;
    }
  }, []);
  const cacheCanvasDirectivePreview = React.useCallback((
    directiveId: string,
    asset: AssistantReferenceComposerAsset,
  ) => {
    setCanvasDirectivePreviews((current) => ({
      ...current,
      [directiveId]: {
        previewUrl:
          asset.kind === "mark"
            ? asset.originalUrl || asset.previewUrl
            : asset.previewUrl,
        chipPreviewUrl:
          asset.kind === "mark"
            ? asset.originalUrl || asset.previewUrl || asset.cropUrl
            : null,
        imageWidth:
          asset.kind === "mark"
            ? asset.imageWidth
            : asset.imageWidth,
        imageHeight:
          asset.kind === "mark"
            ? asset.imageHeight
            : asset.imageHeight,
        markerX:
          asset.kind === "mark"
            ? asset.normalizedX
            : null,
        markerY:
          asset.kind === "mark"
            ? asset.normalizedY
            : null,
        type: asset.kind === "canvas" ? asset.type : "mark",
        kind: asset.kind,
      },
    }));
  }, []);
  const insertPendingCanvasReferenceDirective = React.useCallback(async (
    asset: AssistantReferenceComposerAsset,
  ) => {
    const composer = runtime.thread.composer;
    const composerState = composer.getState();
    const reference = resolveAssistantReferenceDirective(
      composerState.text,
      asset,
    );
    cacheCanvasDirectivePreview(reference.directiveId, asset);
    const attachmentIndex = composerState.attachments.findIndex(
      (attachment) => attachment.id === reference.directiveId,
    );
    const hasAttachment = attachmentIndex >= 0;
    if (reference.exists && hasAttachment) {
      confirmedCanvasReferenceIdsRef.current.add(reference.directiveId);
      setPendingCanvasReferenceAssets((current) => {
        if (!current[reference.directiveId]) return current;
        const next = { ...current };
        delete next[reference.directiveId];
        return next;
      });
      return;
    }
    if (!reference.exists) {
      confirmedCanvasReferenceIdsRef.current.delete(reference.directiveId);
      if (hasAttachment) {
        await composer.getAttachmentByIndex(attachmentIndex).remove();
      }
    }
    setPendingCanvasReferenceAssets((current) => ({
      ...current,
      [reference.directiveId]: asset,
    }));
    if (!reference.exists) {
      composer.setText(
        insertCanvasReferenceDirectiveIntoText(
          composerState.text,
          reference.directive,
          composerVisibleCursorOffsetRef.current,
        ),
      );
    }
    logAssistantSidebar("selected_canvas_asset_pending", {
      elementId: asset.elementId,
      elementType: asset.kind === "canvas" ? asset.type : "mark",
      markerId: asset.kind === "mark" ? asset.markerId : undefined,
      directive: reference.directive,
      directiveId: reference.directiveId,
      label: reference.label,
      textInserted: !reference.exists,
    });
  }, [cacheCanvasDirectivePreview, runtime]);
  React.useEffect(() => {
    if (!selectedReferenceAsset) return;
    const selectionToken =
      selectedReferenceAsset.kind === "canvas"
        ? `canvas:${selectedReferenceAsset.elementId}:${Number(
            browserAgent.referenceSelectionNonce || 0,
          )}`
        : `mark:${selectedReferenceAsset.markerId}`;
    if (handledCanvasReferenceSelectionTokenRef.current === selectionToken) {
      return;
    }
    handledCanvasReferenceSelectionTokenRef.current = selectionToken;
    void insertPendingCanvasReferenceDirective(selectedReferenceAsset);
  }, [
    browserAgent.referenceSelectionNonce,
    insertPendingCanvasReferenceDirective,
    selectedReferenceAsset,
  ]);
  const handleCommitCanvasReferenceAsset = React.useCallback(async (
    asset: AssistantReferenceComposerAsset,
  ): Promise<boolean> => {
    try {
      const initialComposerState = runtime.thread.composer.getState();
      const initialReference = resolveAssistantReferenceDirective(
        initialComposerState.text,
        asset,
      );
      if (!initialReference.exists) {
        setPendingCanvasReferenceAssets((current) => {
          if (!current[initialReference.directiveId]) return current;
          const next = { ...current };
          delete next[initialReference.directiveId];
          return next;
        });
        return true;
      }
      const hostedReferenceAsset =
        await ensureHostedAssistantReferenceAsset(asset);
      const composer = runtime.thread.composer;
      const composerState = composer.getState();
      const reference = resolveAssistantReferenceDirective(
        composerState.text,
        hostedReferenceAsset,
      );
      if (!reference.exists) {
        setPendingCanvasReferenceAssets((current) => {
          if (!current[reference.directiveId]) return current;
          const next = { ...current };
          delete next[reference.directiveId];
          return next;
        });
        return true;
      }
      if (!hasCanvasReferenceAttachment(composerState.attachments, reference.directiveId)) {
        await composer.addAttachment(
          hostedReferenceAsset.kind === "mark"
            ? toMarkerReferenceAttachment({
                ...hostedReferenceAsset,
                directiveLabel: reference.label,
              })
            : toCanvasElementAttachment(hostedReferenceAsset),
        );
      }
      confirmedCanvasReferenceIdsRef.current.add(reference.directiveId);
      cacheCanvasDirectivePreview(reference.directiveId, hostedReferenceAsset);
      setPendingCanvasReferenceAssets((current) => {
        if (!current[reference.directiveId]) return current;
        const next = { ...current };
        delete next[reference.directiveId];
        return next;
      });
      logAssistantSidebar("selected_canvas_asset_attached", {
        elementId: hostedReferenceAsset.elementId,
        elementType:
          hostedReferenceAsset.kind === "canvas"
            ? hostedReferenceAsset.type
            : "mark",
        markerId:
          hostedReferenceAsset.kind === "mark"
            ? hostedReferenceAsset.markerId
            : undefined,
        directive: reference.directive,
        directiveId: reference.directiveId,
        label: reference.label,
        textInserted: !reference.exists,
        hasPreviewUrl: Boolean(hostedReferenceAsset.previewUrl),
        hasOriginalUrl: Boolean(hostedReferenceAsset.originalUrl),
      });
      return true;
    } catch (error) {
      console.warn("[assistant-sidebar] selected canvas asset attach failed", {
        error: getClientErrorMessage(error),
      });
      return false;
    }
  }, [cacheCanvasDirectivePreview, runtime]);
  const handleCommitPendingCanvasReferences = React.useCallback(async () => {
    const pendingAssets = Object.values(pendingCanvasReferenceAssetsRef.current);
    if (pendingAssets.length === 0) return true;
    for (const asset of pendingAssets) {
      const ok = await handleCommitCanvasReferenceAsset(asset);
      if (!ok) return false;
    }
    return true;
  }, [handleCommitCanvasReferenceAsset]);
  const getCanvasDirectivePreview = React.useCallback(
    (directiveId: string) => {
      const cachedPreview = canvasDirectivePreviews[directiveId];
      if (cachedPreview) return cachedPreview;

      const selectedDirectiveId = selectedReferenceAsset
        ? getAssistantReferenceDirectiveId(selectedReferenceAsset)
        : "";
      if (directiveId !== selectedDirectiveId || !selectedReferenceAsset) {
        return null;
      }
      return {
        previewUrl:
          selectedReferenceAsset.kind === "mark"
            ? selectedReferenceAsset.originalUrl ||
              selectedReferenceAsset.previewUrl
            : selectedReferenceAsset.previewUrl,
        chipPreviewUrl:
          selectedReferenceAsset.kind === "mark"
            ? selectedReferenceAsset.originalUrl ||
              selectedReferenceAsset.previewUrl ||
              selectedReferenceAsset.cropUrl
            : null,
        imageWidth:
          selectedReferenceAsset.kind === "mark"
            ? selectedReferenceAsset.imageWidth
            : selectedReferenceAsset.imageWidth,
        imageHeight:
          selectedReferenceAsset.kind === "mark"
            ? selectedReferenceAsset.imageHeight
            : selectedReferenceAsset.imageHeight,
        markerX:
          selectedReferenceAsset.kind === "mark"
            ? selectedReferenceAsset.normalizedX
            : null,
        markerY:
          selectedReferenceAsset.kind === "mark"
            ? selectedReferenceAsset.normalizedY
            : null,
        type:
          selectedReferenceAsset.kind === "canvas"
            ? selectedReferenceAsset.type
            : "mark",
        kind: selectedReferenceAsset.kind,
      };
    },
    [canvasDirectivePreviews, selectedReferenceAsset],
  );
  const consumedBootstrapRequestIdRef = React.useRef<number | null>(null);
  const bootstrapRequestInFlightIdRef = React.useRef<number | null>(null);
  const bootstrapRuntimeRef = React.useRef(runtime);
  const bootstrapConsumedCallbackRef = React.useRef(
    props.onBootstrapRequestConsumed,
  );
  const latestBootstrapRequestIdRef = React.useRef<number | null>(
    props.bootstrapRequest?.id ?? null,
  );
  const bootstrapMountedRef = React.useRef(true);
  bootstrapRuntimeRef.current = runtime;
  bootstrapConsumedCallbackRef.current = props.onBootstrapRequestConsumed;
  latestBootstrapRequestIdRef.current = props.bootstrapRequest?.id ?? null;

  React.useEffect(() => {
    bootstrapMountedRef.current = true;
    return () => {
      bootstrapMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    const request = props.bootstrapRequest;
    if (
      !request ||
      !isSessionHydrated ||
      consumedBootstrapRequestIdRef.current === request.id ||
      bootstrapRequestInFlightIdRef.current === request.id
    ) {
      return;
    }

    bootstrapRequestInFlightIdRef.current = request.id;
    const sendBootstrapRequest = async () => {
      try {
        logAssistantSidebar("bootstrap_send_start", {
          requestId: request.id,
          hasPrompt: Boolean(String(request.prompt || "").trim()),
          attachmentCount: request.attachments?.length || 0,
          activeConversationId: activeConversationIdRef.current || null,
          isHydrated: isSessionHydrated,
          conversationCount: conversationsRef.current.length,
        });
        await waitForThreadListHydration();
        logAssistantSidebar("bootstrap_project_thread_ready", {
          requestId: request.id,
          activeConversationId: activeConversationIdRef.current || null,
        });
        if (
          !bootstrapMountedRef.current ||
          latestBootstrapRequestIdRef.current !== request.id
        ) {
          return;
        }

        const currentRuntime = bootstrapRuntimeRef.current;
        const targetConversationId = activeConversationIdRef.current;
        if (!targetConversationId) {
          await currentRuntime.threads.switchToNewThread();
        }
        logAssistantSidebar("bootstrap_runtime_thread_ready", {
          requestId: request.id,
          activeConversationId: activeConversationIdRef.current || null,
        });
        if (
          !bootstrapMountedRef.current ||
          latestBootstrapRequestIdRef.current !== request.id
        ) {
          return;
        }
        const composer = currentRuntime.thread.composer;
        logAssistantSidebar("bootstrap_composer_reset_start", {
          requestId: request.id,
        });
        await composer.reset();
        logAssistantSidebar("bootstrap_composer_reset_finish", {
          requestId: request.id,
        });
        for (const attachment of request.attachments || []) {
          if (
            !bootstrapMountedRef.current ||
            latestBootstrapRequestIdRef.current !== request.id
          ) {
            return;
          }
          await composer.addAttachment(attachment);
        }
        if (
          !bootstrapMountedRef.current ||
          latestBootstrapRequestIdRef.current !== request.id
        ) {
          return;
        }
        composer.setText(String(request.prompt || ""));
        composer.send({ startRun: true });
        consumedBootstrapRequestIdRef.current = request.id;
        bootstrapRequestInFlightIdRef.current = null;
        logAssistantSidebar("bootstrap_send_sent", {
          requestId: request.id,
          activeConversationId: activeConversationIdRef.current || null,
        });
        bootstrapConsumedCallbackRef.current?.(request.id);
      } catch (error) {
        if (bootstrapRequestInFlightIdRef.current === request.id) {
          bootstrapRequestInFlightIdRef.current = null;
        }
        logAssistantSidebar("bootstrap_send_failed", {
          requestId: request.id,
          error: getClientErrorMessage(error),
        });
        console.error("[assistant-sidebar] bootstrap send failed", {
          error: getClientErrorMessage(error),
        });
      }
    };

    void sendBootstrapRequest();
  }, [
    isSessionHydrated,
    props.bootstrapRequest,
    waitForThreadListHydration,
  ]);
  const threadListReloadSignature = React.useMemo(
    () => buildConversationThreadListSignature(conversations),
    [conversations],
  );
  const lastThreadListReloadSignatureRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!threadListReloadSignature) {
      return;
    }
    if (lastThreadListReloadSignatureRef.current === threadListReloadSignature) {
      return;
    }
    lastThreadListReloadSignatureRef.current = threadListReloadSignature;
    void runtime.threads.reload().catch((error) => {
      console.warn("[assistant-sidebar] thread list reload failed", {
        error: getClientErrorMessage(error),
      });
    });
  }, [runtime, threadListReloadSignature]);

  const handleToggleFullscreen = React.useCallback(() => {
    if (typeof onToggleFullscreen === "function") {
      onToggleFullscreen();
      return;
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen, onToggleFullscreen, setIsFullscreen]);
  const handleHideAssistant = React.useCallback(() => {
    setShowAssistant(false);
  }, [setShowAssistant]);
  const handleComposerSlashCommand = React.useCallback((commandId: string) => {
    if (commandId === "image" || commandId === "edit-image") {
      setImageModeEnabled(true);
      setImageModePanelOpen(true);
    }
  }, []);
  const modelContextWindow = React.useMemo(
    () =>
      resolveAssistantModelContextWindow(
        parseAssistantModelValue(props.selectedModelValue).modelId,
      ),
    [props.selectedModelValue],
  );
  const ComposerInlineControls = React.useCallback(
    () => (
      <div className="flex w-full min-w-0 max-w-full flex-1 items-center justify-between gap-1 overflow-hidden">
        <AssistantComposerImageModeControls
          imageGenerationUi={imageGenerationUiRef.current}
          imageModeEnabled={imageModeEnabled}
          onImageModeEnabledChange={setImageModeEnabled}
          imageModePanelOpen={imageModePanelOpen}
          onImageModePanelOpenChange={setImageModePanelOpen}
          runtimeConfig={runtimeConfigRef.current}
        />
        <AssistantComposerModelSelector
          modelGroups={props.modelGroups}
          modelOptions={props.modelOptions}
          onModelChange={props.onSelectedModelValueChange}
          onReasoningEffortChange={props.onSelectedReasoningEffortChange}
          reasoningEffort={props.reasoningEffort}
          selectedModelValue={props.selectedModelValue}
        />
      </div>
    ),
    [
      imageModeEnabled,
      imageModePanelOpen,
      props.modelGroups,
      props.modelOptions,
      props.onSelectedModelValueChange,
      props.onSelectedReasoningEffortChange,
      props.reasoningEffort,
      props.selectedModelValue,
    ],
  );
  const ComposerFooter = React.useCallback(
    () => (
      <AssistantComposerFooter
        modelContextWindow={modelContextWindow}
        status={streamStatus}
      />
    ),
    [modelContextWindow, streamStatus],
  );
  const threadComponents = React.useMemo(
    () => ({
      ComposerFooter,
      ComposerInlineControls,
      getCanvasDirectivePreview,
      isCanvasDirectivePending: (directiveId: string) =>
        Boolean(pendingCanvasReferenceAssets[directiveId]),
      onComposerInputIntent: () => {
        rememberComposerVisibleCursorOffset();
        void handleCommitPendingCanvasReferences();
      },
      onComposerSendIntent: async () => {
        return handleCommitPendingCanvasReferences();
      },
      onSlashCommand: handleComposerSlashCommand,
    }),
    [
      ComposerFooter,
      ComposerInlineControls,
      getCanvasDirectivePreview,
      handleCommitPendingCanvasReferences,
      handleComposerSlashCommand,
      pendingCanvasReferenceAssets,
      rememberComposerVisibleCursorOffset,
    ],
  );

  return (
    <AssistantRuntimeProvider runtime={runtime} aui={aui}>
      {import.meta.env.DEV ? <DevToolsModal /> : null}
      <AssistantSidebarInstructions />
      <AssistantSidebarWorkspaceContext
        browserAgent={browserAgent}
        workspaceId={workspaceId}
      />
      <AssistantSidebarImageSettingsInteractable
        runtimeConfig={messageActions.runtimeConfig}
        imageGenerationUi={props.imageGenerationUi}
        imageModeEnabled={imageModeEnabled}
        onImageModeEnabledChange={setImageModeEnabled}
      />
      <AssistantSidebarToolOverrides browserAgent={browserAgent} />
      <TooltipProvider delayDuration={0}>
        <SidebarProvider
          open={isThreadListOpen}
          onOpenChange={setIsThreadListOpen}
          className={`h-full !min-h-full ${
            isFullscreen ? "fixed inset-0 z-50" : "relative"
          }`}
        >
          <div
            data-assistant-sidebar-root
            className={`flex h-full min-h-0 overflow-hidden bg-[linear-gradient(180deg,#f9fafc_0%,#f3f5f8_100%)] [&_a]:!no-underline ${
              isFullscreen
                ? "w-full max-w-none border-l-0 shadow-none"
                : "relative h-full w-full min-w-0 shadow-none"
            } [&_[data-slot='sidebar-container']]:!absolute [&_[data-slot='sidebar-container']]:!h-full [&_[data-slot='sidebar-gap']]:!transition-[width,left,right] [&_[data-slot='sidebar-wrapper']]:!min-h-full`}
          >
            <ThreadListSidebar
              className={`z-20 h-full ${
                isFullscreen
                  ? "border-r border-slate-200/80 shadow-none"
                  : "shadow-[18px_0_48px_rgba(15,23,42,0.12)]"
              }`}
              style={
                {
                  "--sidebar-width": isFullscreen ? "20rem" : "17rem",
                } as React.CSSProperties
              }
            />
            <SidebarInset className="!m-0 min-h-0 overflow-hidden bg-[linear-gradient(180deg,#fafbfd_0%,#f4f6fa_100%)]">
              <AssistantSurfaceControls
                assets={activeConversationAssets}
                isFullscreen={isFullscreen}
                onAttachAsset={handleAttachConversationAsset}
                onHideAssistant={handleHideAssistant}
                onImportAssetToCanvas={handleImportConversationAssetToCanvas}
                onToggleFullscreen={handleToggleFullscreen}
              />
              <AssistantThread
                components={threadComponents}
                showReasoning
              />
            </SidebarInset>
          </div>
        </SidebarProvider>
      </TooltipProvider>
    </AssistantRuntimeProvider>
  );
};

export const AssistantSidebarAiSdkRuntime: React.FC<AssistantSidebarProps> = memo((props) => {
  const modelMode = props.messageActions.runtimeConfig?.modelMode || "fast";
  const defaultSelection = React.useMemo(
    () => {
      const selection = getBestModelSelection(modelMode === "thinking" ? "thinking" : "text");
      return toAssistantModelValue(selection.modelId, selection.providerId);
    },
    [modelMode],
  );
  const [settingsRevision, setSettingsRevision] = React.useState(0);
  const [selectedModelValue, setSelectedModelValue] = React.useState(defaultSelection);
  const [selectedReasoningEffort, setSelectedReasoningEffort] = React.useState<
    string | undefined
  >(modelMode === "thinking" ? "high" : undefined);

  React.useEffect(() => {
    setSelectedModelValue(defaultSelection);
  }, [defaultSelection]);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleProviderSettingsUpdated = () => {
      setSettingsRevision((current) => current + 1);
    };
    window.addEventListener(
      "provider-settings-updated",
      handleProviderSettingsUpdated,
    );
    return () => {
      window.removeEventListener(
        "provider-settings-updated",
        handleProviderSettingsUpdated,
      );
    };
  }, []);

  const modelOptions = React.useMemo(
    () => buildAssistantChatModelOptions(),
    [settingsRevision],
  );
  const modelGroups = React.useMemo(
    () => buildAssistantChatModelGroups(modelOptions),
    [modelOptions],
  );
  React.useEffect(() => {
    if (!modelOptions.some((option) => option.id === selectedModelValue)) {
      setSelectedModelValue(modelOptions[0]?.id || defaultSelection);
    }
  }, [defaultSelection, modelOptions, selectedModelValue]);
  React.useEffect(() => {
    const defaultEffort = getDefaultReasoningEffortForSelection(
      modelOptions,
      selectedModelValue,
      modelMode,
    );
    setSelectedReasoningEffort((current) => {
      if (resolveModelEffort(modelOptions, selectedModelValue, current)) {
        return current;
      }
      return defaultEffort;
    });
  }, [modelMode, modelOptions, selectedModelValue]);
  const selectedModelSelection = React.useMemo(
    () => parseAssistantModelValue(selectedModelValue || defaultSelection),
    [defaultSelection, selectedModelValue],
  );
  const assistantChatProvider = React.useMemo(
    () => buildAssistantChatProviderConfig(selectedModelSelection.providerId),
    [selectedModelSelection.providerId, settingsRevision],
  );
  const effectiveReasoningEffort = React.useMemo(
    () =>
      resolveModelEffort(
        modelOptions,
        selectedModelValue,
        selectedReasoningEffort ??
          getDefaultReasoningEffortForSelection(
            modelOptions,
            selectedModelValue,
            modelMode,
          ),
      ),
    [modelMode, modelOptions, selectedModelValue, selectedReasoningEffort],
  );
  const modelContextRegistry = React.useMemo(
    () =>
      buildModelContextRegistry({
        provider: assistantChatProvider,
      }),
    [assistantChatProvider],
  );

  return (
    <RuntimeAdapterProvider adapters={{ modelContext: modelContextRegistry }}>
      <AssistantSidebarAiSdkRuntimeInner
        {...props}
        modelGroups={modelGroups}
        modelOptions={modelOptions}
        onSelectedModelValueChange={setSelectedModelValue}
        onSelectedReasoningEffortChange={setSelectedReasoningEffort}
        reasoningEffort={effectiveReasoningEffort}
        selectedModelValue={selectedModelValue}
        selectedReasoningEffort={selectedReasoningEffort}
      />
    </RuntimeAdapterProvider>
  );
});

