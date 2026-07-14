import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  createIdGenerator,
  pruneMessages,
  safeValidateUIMessages,
  smoothStream,
  stepCountIs,
  streamText,
  type JSONSchema7,
  type InferUIMessageChunk,
  type ModelMessage,
  type ToolChoice,
  type ToolSet,
  type UIMessage,
} from "ai";
import type { ProviderOptions } from "@ai-sdk/provider-utils";
import {
  injectQuoteContext as injectAssistantQuoteContext,
  unstable_injectInteractableContext,
} from "@assistant-ui/react-ai-sdk";
import { unstable_defaultDirectiveFormatter } from "@assistant-ui/core";
import type { ToolJSONSchema } from "assistant-stream";
import { z } from "zod";
import {
  createAssistantAiSdkToolkit,
} from "../services/assistant-ui/assistant-ai-sdk-toolkit-server.ts";
import {
  createAssistantChatResumableResponse,
  createAssistantChatResumableStreamId,
} from "../services/assistant-ui/assistant-chat-resumable.ts";
import { createAssistantSidebarServerToolkit } from "../services/assistant-ui/assistant-sidebar-server-toolkit.ts";
import { normalizeAssistantUiMessages } from "../services/assistant-ui/ui-message-normalization.ts";
import {
  createLanguageModelBundle,
  isGoogleProvider,
  isOfficialOpenAIProvider,
  normalizeOpenAIBaseURL,
  resolveModelId,
  resolveProviderConfig,
  shouldRequestOpenAIReasoningSummary,
  type AssistantChatProviderConfig,
  type AssistantChatProviderRequest,
} from "../services/assistant-ui/assistant-chat-provider.ts";
import {
  createAssistantChatImageTools,
  type AssistantChatImageGenerationConfig,
  type AssistantChatImageMarkContext,
  type AssistantChatImageReferenceContext,
} from "../services/assistant-ui/assistant-chat-image-tools.ts";
import {
  createAssistantChatWebSearchTools,
  extractAssistantChatWebSearchSources,
  type AssistantChatWebSearchConfig,
} from "../services/assistant-ui/assistant-chat-web-search.ts";
import {
  createAssistantChatWeatherTools,
  shouldRegisterAssistantChatWeatherTools,
  type AssistantChatWeatherToolsConfig,
} from "../services/assistant-ui/assistant-chat-weather-tools.ts";
import {
  createAssistantChatStudioSkillTools,
} from "../services/assistant-ui/assistant-chat-studio-skills.ts";
import {
  createAssistantChatWorkspaceKnowledgeTools,
  extractAssistantChatWorkspaceKnowledgeSources,
} from "../services/assistant-ui/assistant-chat-workspace-knowledge.ts";

export type AssistantChatToolChoiceRequest =
  | "auto"
  | "none"
  | "required"
  | {
      type?: string;
      toolName?: string;
    };

type AssistantChatRequestBody = AssistantChatProviderRequest & {
  callSettings?: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
    seed?: number;
    headers?: Record<string, string | undefined>;
  };
  messages?: UIMessage[];
  system?: string;
  tools?: Record<string, unknown>;
  trigger?: string;
  webSearch?: AssistantChatWebSearchConfig;
  imageGeneration?: AssistantChatImageGenerationConfig;
  weather?: AssistantChatWeatherToolsConfig;
  toolChoice?: AssistantChatToolChoiceRequest;
  activeTools?: string[];
};

type AssistantChatAiSdkCallSettings = {
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  seed?: number;
  headers?: Record<string, string | undefined>;
};

type AssistantChatDirectiveMention = {
  type: string;
  id: string;
  label: string;
};

type AssistantChatDirectiveRequestOverrides = {
  directiveMentions: AssistantChatDirectiveMention[];
  explicitWebSearchRequested: boolean;
  explicitWeatherRequested: boolean;
  explicitImageGenerationRequested: boolean;
  webSearch: AssistantChatWebSearchConfig | undefined;
  weather: AssistantChatWeatherToolsConfig | undefined;
  activeTools: unknown;
  toolChoice: AssistantChatToolChoiceRequest | undefined;
};

type AssistantChatProviderOptions = ProviderOptions;

type AssistantChatStatusStage =
  | "request-received"
  | "model-start"
  | "model-step"
  | "tool-start"
  | "tool-finish"
  | "complete"
  | "error";

type AssistantChatStatusData = {
  stage: AssistantChatStatusStage;
  message: string;
  requestId: string;
  elapsedMs: number;
  toolName?: string;
  providerId?: string;
  modelId?: string;
};

type AssistantChatDataParts = {
  "assistant-status": AssistantChatStatusData;
};

const assistantChatStatusStageSchema = z.enum([
  "request-received",
  "model-start",
  "model-step",
  "tool-start",
  "tool-finish",
  "complete",
  "error",
]);

export const ASSISTANT_CHAT_DATA_SCHEMAS = {
  "assistant-status": z.object({
    stage: assistantChatStatusStageSchema,
    message: z.string(),
    requestId: z.string(),
    elapsedMs: z.number(),
    toolName: z.string().optional(),
    providerId: z.string().optional(),
    modelId: z.string().optional(),
  }),
} satisfies Parameters<
  typeof safeValidateUIMessages<AssistantChatUiMessage>
>[0]["dataSchemas"];

export const ASSISTANT_CHAT_METADATA_SCHEMA = z
  .object({
    usage: z.unknown().optional(),
    modelId: z.string().optional(),
    providerId: z.string().optional(),
    submittedFeedback: z
      .object({
        type: z.enum(["positive", "negative"]),
      })
      .passthrough()
      .optional(),
    custom: z
      .object({
        quote: z
          .object({
            text: z.string(),
            messageId: z.string().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

type AssistantChatMessageMetadata = z.infer<
  typeof ASSISTANT_CHAT_METADATA_SCHEMA
>;

type AssistantChatUiMessage = UIMessage<
  AssistantChatMessageMetadata,
  AssistantChatDataParts
>;

const ASSISTANT_CHAT_IMAGE_MODE_SYSTEM_HINT =
  "Image mode is enabled for this turn. If you generate or edit an image, " +
  "respect the selected image settings for model, size, aspect ratio, and count. " +
  "Keep chatting normally while the user is still discussing or refining the brief, " +
  "and only call the available image generation tool when the user clearly wants you to create or edit an image now.";
const ASSISTANT_CHAT_MULTI_IMAGE_SYSTEM_HINT =
  "When the user asks for multiple separate images, an image set, or a product-detail-page set, use the image tool's count/n parameter for separate outputs instead of asking the image model to compose a single collage, grid, or contact sheet. If the user specifies an exact count, pass that count through to the image tool. If no exact count is specified, create 4 separate images. Preserve available product/reference images through the image tool's images input when relevant.";
const ASSISTANT_CHAT_UPSCALE_SYSTEM_HINT =
  "When the user asks to upscale, enlarge to 2K/4K/8K, make an existing image higher-resolution, sharpen, enhance clarity, or perform super-resolution while preserving the same image, call upscaleImage instead of createImage. Do not redesign, rewrite text, change composition, or generate a related new image for pure upscale requests.";
const ASSISTANT_CHAT_MULTI_IMAGE_PLANNING_SYSTEM_HINT =
  "For product-detail-page sets or other multi-image creative asset requests, do not jump straight to the image tool. First write a concise user-visible plan in the user's language: identify the product/reference constraints, define the separate image/page roles, and state that the outputs should be separate images rather than one collage. Then call createImage only after that brief plan when the user is asking to generate now.";
const ASSISTANT_CHAT_STUDIO_SKILLS_SYSTEM_HINT =
  "For Studio creative workflows such as product-detail-page sets, brand systems, social carousels, or multi-image asset plans, use listStudioSkills first when it is available. Treat the result as workflow guidance only, not as a legacy skill execution chain. Then use official execution tools such as createImage only when the user clearly wants generation or editing now.";
const ASSISTANT_CHAT_STUDIO_WORKFLOW_PLAN_SYSTEM_HINT =
  "For product-detail-page sets, multi-image product assets, or product-consistency work, call planStudioWorkflow after listStudioSkills when it is available. Use that tool result as the visible workflow plan before calling createImage. Do not ask the image model to create one collage when the user requested separate images.";
const ASSISTANT_CHAT_VISIBLE_LANGUAGE_SYSTEM_HINT =
  "Match the language of the user's latest message for all user-visible content. " +
  "This includes final answers, clarifying questions, tool-use explanations, " +
  "reasoning summaries/reasoning parts, and recovery text. If the latest user " +
  "message is Chinese, all visible natural-language content should be Chinese. " +
  "Keep technical identifiers such as tool names, model ids, and JSON keys unchanged.";
const ASSISTANT_CHAT_CHINESE_VISIBLE_LANGUAGE_SYSTEM_HINT =
  "本轮用户最新消息使用中文。所有对用户可见的自然语言内容都必须使用中文，" +
  "包括最终回复、澄清问题、工具调用说明、reasoning summary/reasoning parts " +
  "和错误恢复文案。不要用英文撰写思考过程，除非用户明确要求英文；工具名、" +
  "模型 ID、JSON key 等技术标识保持原文。";

const parseRequestBody = (value: unknown): AssistantChatRequestBody => {
  if (!value) return {};
  if (typeof value === "string") {
    const text = value.replace(/^\uFEFF/, "");
    try {
      return JSON.parse(text) as AssistantChatRequestBody;
    } catch {
      return {};
    }
  }
  if (typeof value === "object") {
    return value as AssistantChatRequestBody;
  }
  return {};
};

const getAssistantChatPartPayloadText = (part: Record<string, unknown>): string => {
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
    const parts = isRecord(message) && Array.isArray(message.parts)
      ? message.parts
      : [];
    for (const part of parts) {
      if (!isRecord(part)) continue;
      const payloadLength = getAssistantChatPartPayloadText(part).length;
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
      if (getAssistantChatImagePartReference(part)) {
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

const summarizeRequestBodyShape = (value: unknown) => {
  if (typeof value === "string") {
    const text = value.replace(/^\uFEFF/, "");
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const config = isRecord(parsed.config) ? parsed.config : undefined;
      const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
      const fileSummary = summarizeUiMessageFileParts(messages);
      return {
        bodyType: "json-string",
        bodyLength: text.length,
        hasMessages: Array.isArray(parsed.messages),
        messageCount: messages.length,
        ...fileSummary,
        hasConfig: isRecord(parsed.config),
        hasTools: isRecord(parsed.tools),
        modelName:
          typeof config?.modelName === "string"
            ? config.modelName
            : typeof config?.modelId === "string"
              ? config.modelId
              : typeof config?.model === "string"
                ? config.model
                : undefined,
        reasoningEffort:
          typeof config?.reasoningEffort === "string" &&
          config.reasoningEffort.trim()
            ? config.reasoningEffort.trim()
            : undefined,
        toolChoice: parsed.toolChoice,
        activeToolCount: Array.isArray(parsed.activeTools)
          ? parsed.activeTools.length
          : 0,
        trigger:
          typeof parsed.trigger === "string" ? parsed.trigger : undefined,
      };
    } catch {
      return {
        bodyType: "text",
        bodyLength: text.length,
      };
    }
  }

  if (isRecord(value)) {
    const config = isRecord(value.config) ? value.config : undefined;
    const messages = Array.isArray(value.messages) ? value.messages : [];
    const fileSummary = summarizeUiMessageFileParts(messages);
    return {
      bodyType: "object",
      hasMessages: Array.isArray(value.messages),
      messageCount: messages.length,
      ...fileSummary,
      hasConfig: isRecord(value.config),
      hasTools: isRecord(value.tools),
      modelName:
        typeof config?.modelName === "string"
          ? config.modelName
          : typeof config?.modelId === "string"
            ? config.modelId
            : typeof config?.model === "string"
              ? config.model
              : undefined,
      reasoningEffort:
        typeof config?.reasoningEffort === "string" &&
        config.reasoningEffort.trim()
          ? config.reasoningEffort.trim()
          : undefined,
      toolChoice: value.toolChoice,
      activeToolCount: Array.isArray(value.activeTools)
        ? value.activeTools.length
        : 0,
      trigger: typeof value.trigger === "string" ? value.trigger : undefined,
    };
  }

  return {
    bodyType: typeof value,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const HIDDEN_ASSISTANT_REFERENCE_RE = /(^|\n)\[Canvas (?:mark )?reference\]/u;

export const stripHiddenAssistantReferenceText = (text: string): string => {
  const match = HIDDEN_ASSISTANT_REFERENCE_RE.exec(text);
  if (!match) return text;

  const markerStart = match.index + (match[1] === "\n" ? 1 : 0);
  return text.slice(0, markerStart).trimEnd();
};

const getUiMessageText = (message: UIMessage | undefined): string => {
  if (!message) return "";
  return message.parts
    .flatMap((part) =>
      part.type === "text"
        ? [stripHiddenAssistantReferenceText(String(part.text || ""))]
        : [],
    )
    .join("\n")
    .trim();
};

const getUiMessageTextWithoutDirectiveMentions = (
  message: UIMessage | undefined,
): string => {
  if (!message) return "";

  return message.parts
    .flatMap((part) => {
      if (part.type !== "text") return [];
      const text = stripHiddenAssistantReferenceText(String(part.text || ""));
      if (!text.trim()) return [];

      return unstable_defaultDirectiveFormatter
        .parse(text)
        .flatMap((segment) =>
          segment.kind === "text" ? [String(segment.text || "")] : [],
        );
    })
    .join("\n")
    .trim();
};

const hasAssistantChatCjkText = (value: string | undefined): boolean =>
  /[\u3400-\u9FFF\uF900-\uFAFF]/u.test(String(value || ""));

export const buildAssistantChatVisibleLanguageSystemHint = (
  latestUserText: string | undefined,
): string => {
  const parts = [ASSISTANT_CHAT_VISIBLE_LANGUAGE_SYSTEM_HINT];
  if (hasAssistantChatCjkText(latestUserText)) {
    parts.push(ASSISTANT_CHAT_CHINESE_VISIBLE_LANGUAGE_SYSTEM_HINT);
  }
  return parts.join("\n\n");
};

const MAX_ASSISTANT_CHAT_MODEL_IMAGE_DATA_URL_CHARS = 120_000;
const MAX_ASSISTANT_CHAT_IMAGE_MEMORY_TEXT_CHARS = 360;
export const ASSISTANT_CHAT_STREAM_TEXT_INCLUDE_SETTINGS = {
  requestBody: false,
} as const;

type AssistantChatMessageMetadataPart = {
  type: string;
  totalUsage?: unknown;
  response?: {
    modelId?: string | null;
  };
};

export const createAssistantChatMessageMetadata = (
  part: AssistantChatMessageMetadataPart,
  options: {
    modelId: string;
    providerId: string;
  },
) => {
  if (part.type === "finish") {
    return {
      usage: part.totalUsage,
      modelId: options.modelId,
      providerId: options.providerId,
    };
  }

  if (part.type === "finish-step") {
    return {
      modelId: part.response?.modelId || options.modelId,
      providerId: options.providerId,
    };
  }

  return undefined;
};

const ASSISTANT_CHAT_IMAGE_MEMORY_CONTEXT_PREFIX =
  "[Thread image memory - text summary only; image binaries are omitted from the language-model prompt]";
const ASSISTANT_CHAT_MODEL_BINARY_PLACEHOLDER =
  "[omitted generated image binary data from the language-model prompt]";

const isAssistantChatImageDataUrl = (value: unknown): boolean =>
  /^data:image\/[^;,]+;base64,/i.test(String(value || "").trim());

const isAssistantChatImageReferenceUrl = (value: unknown): boolean =>
  /^(?:https?:\/\/|data:image\/[^;,]+;base64,)/i.test(
    String(value || "").trim(),
  );

const isAssistantChatHttpImageReferenceUrl = (value: unknown): boolean =>
  /^https?:\/\//i.test(String(value || "").trim());

const isAssistantChatOversizedModelImageDataUrl = (
  value: unknown,
  maxDataUrlChars: number,
): boolean => {
  const normalized = String(value || "").trim();
  return (
    isAssistantChatImageDataUrl(normalized) &&
    normalized.length > maxDataUrlChars
  );
};

const inferAssistantChatDataUrlMediaType = (value: unknown): string => {
  const match = /^data:([^;,]+)[;,]/i.exec(String(value || "").trim());
  return match?.[1]?.trim() || "";
};

const inferAssistantChatFilenameMediaType = (value: unknown): string => {
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
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    default:
      return "";
  }
};

const inferAssistantChatFilePartMediaType = (
  part: Record<string, unknown>,
  url: string,
): string => {
  const explicitType = String(
    part.mediaType || part.mimeType || part.contentType || "",
  ).trim();
  const dataUrlType = inferAssistantChatDataUrlMediaType(url);
  const filenameType = inferAssistantChatFilenameMediaType(part.filename);
  const genericType = "application/octet-stream";
  if (explicitType && explicitType !== genericType) return explicitType;
  if (dataUrlType && dataUrlType !== genericType) return dataUrlType;
  if (filenameType) return filenameType;
  return explicitType || dataUrlType || "";
};

type AssistantChatImagePartReference = {
  url: string;
  mediaType: string;
  filename?: string;
  imageWidth?: number;
  imageHeight?: number;
  aspectRatio?: string;
  markContext?: AssistantChatImageMarkContext;
};

const getAssistantChatFiniteNumber = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const getAssistantChatMarkerLabelFromPart = (
  part: Record<string, unknown>,
): string => {
  const explicitLabel = String(part.markerLabel || "").trim();
  if (explicitLabel) return explicitLabel;

  const filename = String(part.filename || "").trim();
  const filenameMatch = /^(mark\d+)/i.exec(filename);
  return filenameMatch?.[1] || "";
};

const getAssistantChatMarkerContextFromPart = (
  part: Record<string, unknown>,
  imageUrl: string,
): AssistantChatImageMarkContext | undefined => {
  const label = getAssistantChatMarkerLabelFromPart(part);
  const normalizedX = getAssistantChatFiniteNumber(part.markerNormalizedX);
  const normalizedY = getAssistantChatFiniteNumber(part.markerNormalizedY);
  if (!label || normalizedX == null || normalizedY == null) return undefined;

  const imageWidth = getAssistantChatFiniteNumber(part.markerImageWidth);
  const imageHeight = getAssistantChatFiniteNumber(part.markerImageHeight);
  const markerId = String(part.markerId || "").trim();

  return {
    label,
    imageUrl,
    normalizedX,
    normalizedY,
    ...(markerId ? { markerId } : {}),
    ...(imageWidth != null ? { imageWidth } : {}),
    ...(imageHeight != null ? { imageHeight } : {}),
  };
};

const getAssistantChatImageReferenceDimensionsFromPart = (
  part: Record<string, unknown>,
): { imageWidth?: number; imageHeight?: number } => {
  const width =
    getAssistantChatFiniteNumber(part.canvasImageWidth) ??
    getAssistantChatFiniteNumber(part.markerImageWidth) ??
    getAssistantChatFiniteNumber(part.imageWidth);
  const height =
    getAssistantChatFiniteNumber(part.canvasImageHeight) ??
    getAssistantChatFiniteNumber(part.markerImageHeight) ??
    getAssistantChatFiniteNumber(part.imageHeight);

  return {
    ...(width != null && width > 0 ? { imageWidth: width } : {}),
    ...(height != null && height > 0 ? { imageHeight: height } : {}),
  };
};

const getAssistantChatImageReferenceContext = (
  imageReference: AssistantChatImagePartReference,
): AssistantChatImageReferenceContext | null => {
  const context: AssistantChatImageReferenceContext = {
    imageUrl: imageReference.url,
    ...(imageReference.imageWidth ? { imageWidth: imageReference.imageWidth } : {}),
    ...(imageReference.imageHeight ? { imageHeight: imageReference.imageHeight } : {}),
    ...(imageReference.aspectRatio ? { aspectRatio: imageReference.aspectRatio } : {}),
  };
  if (!context.imageWidth && !context.imageHeight && !context.aspectRatio) {
    return null;
  }
  return context;
};

const getAssistantChatPreferredImageReferenceUrl = (
  part: Record<string, unknown>,
  fallbackUrl: string,
): string => {
  const metadataKeys = ["originalUrl", "sourceUrl", "fullImageUrl"] as const;

  for (const key of metadataKeys) {
    const value = String(part[key] || "").trim();
    if (isAssistantChatHttpImageReferenceUrl(value)) {
      return value;
    }
  }

  for (const key of metadataKeys) {
    const value = String(part[key] || "").trim();
    if (isAssistantChatImageReferenceUrl(value)) {
      return value;
    }
  }
  return fallbackUrl;
};

const getAssistantChatImagePartReference = (
  part: unknown,
): AssistantChatImagePartReference | null => {
  if (!isRecord(part)) return null;

  const type = String(part.type || "").trim();
  const filename =
    typeof part.filename === "string" && part.filename.trim()
      ? part.filename.trim()
      : undefined;

  if (type === "file") {
    const fallbackUrl = String(part.url || part.data || "").trim();
    const url = getAssistantChatPreferredImageReferenceUrl(part, fallbackUrl);
    const mediaType = inferAssistantChatFilePartMediaType(part, url);
    if (!url || !mediaType.startsWith("image/")) return null;
    return {
      url,
      mediaType,
      filename,
      ...getAssistantChatImageReferenceDimensionsFromPart(part),
      markContext: getAssistantChatMarkerContextFromPart(part, url),
    };
  }

  if (type === "image") {
    const fallbackUrl = String(part.image || part.url || part.data || "").trim();
    const url = getAssistantChatPreferredImageReferenceUrl(part, fallbackUrl);
    const mediaType = String(
      part.mediaType ||
        part.mimeType ||
        part.contentType ||
        inferAssistantChatDataUrlMediaType(url) ||
        "image/png",
    ).trim();
    if (!url || !mediaType.startsWith("image/")) return null;
    return {
      url,
      mediaType,
      filename,
      ...getAssistantChatImageReferenceDimensionsFromPart(part),
      markContext: getAssistantChatMarkerContextFromPart(part, url),
    };
  }

  return null;
};

const normalizeAssistantChatImagePartForModel = (
  part: UIMessage["parts"][number],
): { part: UIMessage["parts"][number]; replaced: boolean } => {
  if (!isRecord(part)) return { part, replaced: false };

  const type = String(part.type || "").trim();
  if (type !== "file" && type !== "image") {
    return { part, replaced: false };
  }

  const record = part as Record<string, unknown>;
  const fallbackUrl =
    type === "file"
      ? String(record.url || record.data || "").trim()
      : String(record.image || record.url || record.data || "").trim();
  const preferredUrl = getAssistantChatPreferredImageReferenceUrl(record, fallbackUrl);

  if (
    !preferredUrl ||
    preferredUrl === fallbackUrl ||
    !isAssistantChatImageReferenceUrl(preferredUrl)
  ) {
    return { part, replaced: false };
  }

  if (type === "file") {
    const nextPart: Record<string, unknown> = {
      ...part,
      url: preferredUrl,
    };
    if (typeof nextPart.data === "string" && isAssistantChatImageDataUrl(nextPart.data)) {
      delete nextPart.data;
    }
    return {
      part: nextPart as UIMessage["parts"][number],
      replaced: true,
    };
  }

  const nextPart: Record<string, unknown> = {
      ...record,
      image: preferredUrl,
      ...(typeof record.url === "string" ? { url: preferredUrl } : {}),
    };
  if (typeof nextPart.data === "string" && isAssistantChatImageDataUrl(nextPart.data)) {
    delete nextPart.data;
  }
  return {
    part: nextPart as unknown as UIMessage["parts"][number],
    replaced: true,
  };
};

const truncateAssistantChatImageMemoryText = (value: unknown): string => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= MAX_ASSISTANT_CHAT_IMAGE_MEMORY_TEXT_CHARS) return text;
  return `${text.slice(0, MAX_ASSISTANT_CHAT_IMAGE_MEMORY_TEXT_CHARS - 1)}...`;
};

const isLikelyAssistantChatBase64Payload = (value: string): boolean => {
  const normalized = value.replace(/\s+/g, "");
  return (
    normalized.length > 0 &&
    normalized.length % 4 === 0 &&
    /^[A-Za-z0-9+/_-]+={0,2}$/.test(normalized)
  );
};

const isAssistantChatBinaryPayloadKey = (key: string | undefined): boolean => {
  const normalized = String(key || "").toLowerCase();
  return (
    normalized === "data" ||
    normalized === "base64" ||
    normalized === "image" ||
    normalized === "url"
  );
};

const isAssistantChatFilePartSupportedByModel = (
  part: UIMessage["parts"][number],
  options: {
    provider?: AssistantChatProviderConfig | null;
    modelId?: string | null;
  },
): boolean => {
  if (!isRecord(part) || part.type !== "file") return true;
  const record = part as Record<string, unknown>;
  const mediaType = inferAssistantChatFilePartMediaType(
    record,
    String(record.url || record.data || "").trim(),
  ).toLowerCase();
  if (!mediaType || mediaType.startsWith("image/")) return true;

  const provider = options.provider || {};
  const modelId = String(options.modelId || "").trim().toLowerCase();
  if (isGoogleProvider(provider)) return true;

  if (isOfficialOpenAIProvider(provider)) {
    if (mediaType === "application/pdf") return true;
    if (
      modelId === "gpt-4o-audio-preview" &&
      /^(?:audio\/mpeg|audio\/mp3|audio\/wav|audio\/wave|audio\/x-wav)$/.test(
        mediaType,
      )
    ) {
      return true;
    }
  }

  return false;
};

const createUnsupportedAssistantChatFilePartPlaceholder = (
  part: UIMessage["parts"][number],
): UIMessage["parts"][number] => {
  const record: Record<string, unknown> = isRecord(part) ? part : {};
  const filename = String(record.filename || "").trim();
  const mediaType = inferAssistantChatFilePartMediaType(
    record,
    String(record.url || record.data || "").trim(),
  );
  const label = filename ? ` "${filename}"` : "";
  const typeLabel = mediaType ? ` (${mediaType})` : "";
  return {
    type: "text",
    text:
      `[Attached file${label}${typeLabel} omitted from the language-model prompt ` +
      `because the selected provider/model does not support generic AI SDK file parts. ` +
      `The official UIMessage file part remains stored in the thread history.]`,
  };
};

export const stripOversizedImageFilePartsForModelMessages = (
  messages: UIMessage[],
  options: {
    maxDataUrlChars?: number;
    provider?: AssistantChatProviderConfig | null;
    modelId?: string | null;
    preserveLatestUserImages?: boolean;
  } = {},
): {
  messages: UIMessage[];
  strippedCount: number;
  strippedChars: number;
  strippedImageFilePartCount: number;
  strippedImageFilePartChars: number;
  strippedBinaryPayloadCount: number;
  strippedBinaryPayloadChars: number;
  strippedUnsupportedFilePartCount: number;
  modelImageUrlReplacementCount: number;
} => {
  const maxDataUrlChars =
    options.maxDataUrlChars ?? MAX_ASSISTANT_CHAT_MODEL_IMAGE_DATA_URL_CHARS;
  let strippedCount = 0;
  let strippedChars = 0;
  let strippedImageFilePartCount = 0;
  let strippedImageFilePartChars = 0;
  let strippedBinaryPayloadCount = 0;
  let strippedBinaryPayloadChars = 0;
  let strippedUnsupportedFilePartCount = 0;
  let modelImageUrlReplacementCount = 0;
  const preserveLatestUserImages = options.preserveLatestUserImages !== false;
  let latestUserMessageIndex = -1;
  if (preserveLatestUserImages) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.role === "user") {
        latestUserMessageIndex = index;
        break;
      }
    }
  }

  const stripModelPayloadValue = (
    value: unknown,
    key?: string,
  ): { value: unknown; changed: boolean } => {
    if (typeof value === "string") {
      const normalized = value.trim();
      if (isAssistantChatImageDataUrl(normalized)) {
        strippedCount += 1;
        strippedChars += normalized.length;
        strippedBinaryPayloadCount += 1;
        strippedBinaryPayloadChars += normalized.length;
        return {
          value: ASSISTANT_CHAT_MODEL_BINARY_PLACEHOLDER,
          changed: true,
        };
      }

      if (
        normalized.length > maxDataUrlChars &&
        isAssistantChatBinaryPayloadKey(key) &&
        isLikelyAssistantChatBase64Payload(normalized)
      ) {
        strippedCount += 1;
        strippedChars += normalized.length;
        strippedBinaryPayloadCount += 1;
        strippedBinaryPayloadChars += normalized.length;
        return {
          value: ASSISTANT_CHAT_MODEL_BINARY_PLACEHOLDER,
          changed: true,
        };
      }

      return { value, changed: false };
    }

    if (Array.isArray(value)) {
      let changed = false;
      const nextValue = value.map((item) => {
        const result = stripModelPayloadValue(item, key);
        changed ||= result.changed;
        return result.value;
      });
      return changed ? { value: nextValue, changed } : { value, changed };
    }

    if (isRecord(value)) {
      let changed = false;
      const nextValue: Record<string, unknown> = {};
      for (const [entryKey, entryValue] of Object.entries(value)) {
        const result = stripModelPayloadValue(entryValue, entryKey);
        changed ||= result.changed;
        nextValue[entryKey] = result.value;
      }
      return changed ? { value: nextValue, changed } : { value, changed };
    }

    return { value, changed: false };
  };

  const sanitizedMessages = messages.map((message, messageIndex) => {
    const shouldPreserveMessageImages =
      preserveLatestUserImages && messageIndex === latestUserMessageIndex;
    const nextParts = message.parts.flatMap((part) => {
      if (part.type === "text") {
        const visibleText = stripHiddenAssistantReferenceText(
          String(part.text || ""),
        );
        if (!visibleText.trim()) return [];
        return [
          visibleText === part.text
            ? part
            : ({ ...part, text: visibleText } as UIMessage["parts"][number]),
        ];
      }

      if (part.type !== "file") {
        const normalizedPart = normalizeAssistantChatImagePartForModel(part);
        if (normalizedPart.replaced) {
          modelImageUrlReplacementCount += 1;
        }
        const effectivePart = normalizedPart.part;
        const imageReference = getAssistantChatImagePartReference(effectivePart);
        if (
          shouldPreserveMessageImages &&
          imageReference &&
          !isAssistantChatOversizedModelImageDataUrl(
            imageReference.url,
            maxDataUrlChars,
          )
        ) {
          return [effectivePart];
        }
        if (
          imageReference &&
          !isAssistantChatOversizedModelImageDataUrl(
            imageReference.url,
            maxDataUrlChars,
          )
        ) {
          return [effectivePart];
        }
        if (
          imageReference &&
          isAssistantChatOversizedModelImageDataUrl(
            imageReference.url,
            maxDataUrlChars,
          )
        ) {
          strippedCount += 1;
          strippedChars += imageReference.url.length;
          strippedImageFilePartCount += 1;
          strippedImageFilePartChars += imageReference.url.length;
          return [effectivePart];
        }

        const result = stripModelPayloadValue(effectivePart);
        return [
          result.changed
            ? result.value as UIMessage["parts"][number]
            : effectivePart,
        ];
      }

      const normalizedPart = normalizeAssistantChatImagePartForModel(part);
      if (normalizedPart.replaced) {
        modelImageUrlReplacementCount += 1;
      }
      const effectivePart = normalizedPart.part;
      const imageReference = getAssistantChatImagePartReference(effectivePart);
      const url = imageReference?.url || "";
      if (
        shouldPreserveMessageImages &&
        imageReference &&
        !isAssistantChatOversizedModelImageDataUrl(url, maxDataUrlChars)
      ) {
        return [effectivePart];
      }
      if (
        !imageReference &&
        !isAssistantChatFilePartSupportedByModel(effectivePart, options)
      ) {
        strippedUnsupportedFilePartCount += 1;
        return [createUnsupportedAssistantChatFilePartPlaceholder(effectivePart)];
      }

      if (
        !imageReference ||
        !isAssistantChatImageDataUrl(url) ||
        !isAssistantChatOversizedModelImageDataUrl(url, maxDataUrlChars)
      ) {
        return [effectivePart];
      }

      strippedCount += 1;
      strippedChars += url.length;
      strippedImageFilePartCount += 1;
      strippedImageFilePartChars += url.length;
      return [effectivePart];
    });

    return nextParts === message.parts
      ? message
      : {
          ...message,
          parts: nextParts as UIMessage["parts"],
        };
  });

  return {
    messages: sanitizedMessages,
    strippedCount,
    strippedChars,
    strippedImageFilePartCount,
    strippedImageFilePartChars,
    strippedBinaryPayloadCount,
    strippedBinaryPayloadChars,
    strippedUnsupportedFilePartCount,
    modelImageUrlReplacementCount,
  };
};

export const buildAssistantChatSystemPrompt = (options: {
  system: string | undefined;
  imageModeEnabled: boolean;
  imageToolAvailable: boolean;
  upscaleToolAvailable?: boolean;
  studioSkillsToolAvailable?: boolean;
  studioWorkflowPlanToolAvailable?: boolean;
  latestUserText?: string | undefined;
}): string | undefined => {
  const parts = [
    String(options.system || "").trim(),
    buildAssistantChatVisibleLanguageSystemHint(options.latestUserText),
  ].filter(Boolean);
  if (options.imageModeEnabled && options.imageToolAvailable) {
    parts.push(ASSISTANT_CHAT_IMAGE_MODE_SYSTEM_HINT);
  }
  if (
    options.upscaleToolAvailable &&
    isAssistantChatUpscaleImageRequest(options.latestUserText || "")
  ) {
    parts.push(ASSISTANT_CHAT_UPSCALE_SYSTEM_HINT);
  }
  if (
    options.imageToolAvailable &&
    isAssistantChatMultiImageAssetRequest(options.latestUserText || "")
  ) {
    parts.push(ASSISTANT_CHAT_MULTI_IMAGE_SYSTEM_HINT);
    parts.push(ASSISTANT_CHAT_MULTI_IMAGE_PLANNING_SYSTEM_HINT);
    if (options.studioSkillsToolAvailable) {
      parts.push(ASSISTANT_CHAT_STUDIO_SKILLS_SYSTEM_HINT);
    }
    if (options.studioWorkflowPlanToolAvailable) {
      parts.push(ASSISTANT_CHAT_STUDIO_WORKFLOW_PLAN_SYSTEM_HINT);
    }
  }
  return parts.length > 0 ? parts.join("\n\n") : undefined;
};

export const extractAssistantChatLatestUserDirectiveMentions = (
  messages: UIMessage[],
): AssistantChatDirectiveMention[] => {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");
  if (!latestUserMessage) return [];

  const mentions: AssistantChatDirectiveMention[] = [];
  for (const part of latestUserMessage.parts) {
    if (part.type !== "text") continue;
    const text = String(part.text || "");
    if (!text.trim()) continue;
    const segments = unstable_defaultDirectiveFormatter.parse(text);
    for (const segment of segments) {
      if (segment.kind !== "mention") continue;
      mentions.push({
        type: String(segment.type || "").trim(),
        id: String(segment.id || "").trim(),
        label: String(segment.label || "").trim(),
      });
    }
  }

  return mentions.filter(
    (mention) => Boolean(mention.type && mention.id && mention.label),
  );
};

const isExplicitWeatherDirective = (
  mention: AssistantChatDirectiveMention,
): boolean => {
  if (mention.type === "context" && mention.id === "weather") {
    return true;
  }

  return mention.type === "tool" && mention.id === "getWeather";
};

const isExplicitWebSearchDirective = (
  mention: AssistantChatDirectiveMention,
): boolean => {
  if (mention.type === "context" && mention.id === "web-search") {
    return true;
  }

  return (
    mention.type === "tool" &&
    (mention.id === "webSearch" ||
      mention.id === "web_search" ||
      mention.id === "google_search")
  );
};

const isExplicitImageToolDirective = (
  mention: AssistantChatDirectiveMention,
): boolean => mention.type === "tool" && mention.id === "createImage";

const IMAGE_GENERATION_ACTION_TERMS = [
  "\u751f\u6210",
  "\u51fa\u56fe",
  "\u505a\u56fe",
  "\u753b",
  "\u7ed8\u5236",
  "\u8bbe\u8ba1",
  "\u5236\u4f5c",
  "\u6e32\u67d3",
  "generate",
  "create",
  "draw",
  "render",
  "make",
];

const IMAGE_GENERATION_TARGET_TERMS = [
  "\u56fe\u7247",
  "\u56fe",
  "\u7167\u7247",
  "\u6d77\u62a5",
  "\u5c01\u9762",
  "banner",
  "poster",
  "image",
  "picture",
  "photo",
  "visual",
  "illustration",
  "rendering",
];

const IMAGE_GENERATION_REQUEST_PATTERN = new RegExp(
  `(?:${IMAGE_GENERATION_ACTION_TERMS.join("|")})[^\\n\\r\\u3002\\uff01\\uff1f.!?]{0,80}(?:${IMAGE_GENERATION_TARGET_TERMS.join("|")})|(?:${IMAGE_GENERATION_TARGET_TERMS.join("|")})[^\\n\\r\\u3002\\uff01\\uff1f.!?]{0,80}(?:${IMAGE_GENERATION_ACTION_TERMS.join("|")}|\\u505a\\u51fa\\u6765|\\u753b\\u51fa\\u6765)`,
  "i",
);

const MULTI_IMAGE_ASSET_REQUEST_PATTERN =
  /(?:\u591a\u5f20(?:\u56fe|\u56fe\u7247)?|\u591a\u56fe|\u5957\u56fe|\u6574\u5957(?:\u56fe|\u56fe\u7247|\u89c6\u89c9|\u7269\u6599|\u8d44\u4ea7)|\u4e00\u5957(?:\u56fe|\u56fe\u7247|\u89c6\u89c9|\u7269\u6599|\u8d44\u4ea7|\u8be6\u60c5\u9875)|\u975e\u5355\u5f20|\u5206\u5c4f|\u9010\u5c4f|\u591a\u5c4f|\u591a\u9875|\u8be6\u60c5\u9875|\u5546\u54c1\u9875|\u4ea7\u54c1\u9875|\u4e3b\u56fe\u5957\u56fe|\u8f6e\u64ad\u56fe|multiple\s+images?|separate\s+images?|image\s+set|set\s+of\s+images?|not\s+a\s+single|detail\s+page|product\s+detail\s+page|listing\s+images?)/i;

const PRODUCT_REFERENCE_ASSET_REQUEST_PATTERN =
  /(?:\u8fd9\u6b3e|\u8fd9\u4e2a\u4ea7\u54c1|\u5546\u54c1|\u4ea7\u54c1|\u8be6\u60c5\u9875|\u5957\u56fe|\u4e3b\u56fe|\u5356\u70b9|\u7535\u5546|product|sku|listing|detail\s+page|pdp|e[-\s]?commerce)/i;

const UPSCALE_IMAGE_REQUEST_PATTERN =
  /(?:\u7b49\u6bd4)?(?:\u653e\u5927|\u653e\u5927\u5230|\u653e\u81f3|\u9ad8\u6e05\u653e\u5927|\u8d85\u5206|\u8d85\u5206\u8fa8\u7387|\u63d0\u9ad8\u5206\u8fa8\u7387|\u589e\u5f3a\u6e05\u6670\u5ea6|\u53d8\u6e05\u6670|\u4fee\u590d\u753b\u8d28)|(?:upscale|super[-\s]?resolution|hi[-\s]?res|high[-\s]?resolution|enhance\s+(?:resolution|clarity)|increase\s+resolution|make\s+it\s+sharper)/i;

const UPSCALE_EXISTING_IMAGE_HINT_PATTERN =
  /(?:\u8fd9\u5f20|\u539f\u56fe|\u53c2\u8003\u56fe|\u56fe\u4e00|\u56fe\u4e8c|\u56fe\d+|image\s*#?\d*|this\s+image|attached\s+image|source\s+image|same\s+image|\u4e0d\u8981\u6539|\u4fdd\u6301|\u7b49\u6bd4)/i;

const UPSCALE_RESOLUTION_HINT_PATTERN =
  /(?:\b[248]k\b|\b[248]K\b|2K|4K|8K|\d{3,5}\s*x\s*\d{3,5}|\u5206\u8fa8\u7387|\u50cf\u7d20|\u9ad8\u6e05)/;

const CHINESE_IMAGE_COUNT_WORDS: Record<string, number> = {
  "\u96f6": 0,
  "\u3007": 0,
  "\u4e00": 1,
  "\u4e24": 2,
  "\u4e8c": 2,
  "\u4e09": 3,
  "\u56db": 4,
  "\u4e94": 5,
  "\u516d": 6,
  "\u4e03": 7,
  "\u516b": 8,
  "\u4e5d": 9,
};

const CHINESE_IMAGE_COUNT_SECTION_UNITS: Record<string, number> = {
  "\u5341": 10,
  "\u767e": 100,
  "\u5343": 1000,
};

const CHINESE_IMAGE_COUNT_LARGE_UNITS: Record<string, number> = {
  "\u4e07": 10000,
  "\u4ebf": 100000000,
};

const parseAssistantChatChineseCountSection = (
  value: string,
): number | undefined => {
  let section = 0;
  let digit: number | undefined;
  let parsed = false;

  for (const char of value) {
    if (Object.prototype.hasOwnProperty.call(CHINESE_IMAGE_COUNT_WORDS, char)) {
      digit = CHINESE_IMAGE_COUNT_WORDS[char];
      parsed = true;
      continue;
    }

    const unit = CHINESE_IMAGE_COUNT_SECTION_UNITS[char];
    if (!unit) return undefined;

    section += (digit ?? 1) * unit;
    digit = undefined;
    parsed = true;
  }

  if (digit != null) section += digit;
  return parsed ? section : undefined;
};

const parseAssistantChatChineseImageCount = (value: string): number | undefined => {
  const normalized = String(value || "").trim();
  if (!normalized) return undefined;
  if (Object.prototype.hasOwnProperty.call(CHINESE_IMAGE_COUNT_WORDS, normalized)) {
    return CHINESE_IMAGE_COUNT_WORDS[normalized];
  }

  let total = 0;
  let sectionText = "";
  let parsed = false;

  for (const char of normalized) {
    const largeUnit = CHINESE_IMAGE_COUNT_LARGE_UNITS[char];
    if (!largeUnit) {
      sectionText += char;
      continue;
    }

    const section = sectionText
      ? parseAssistantChatChineseCountSection(sectionText)
      : 1;
    if (!Number.isFinite(section)) return undefined;
    total += section! * largeUnit;
    sectionText = "";
    parsed = true;
  }

  const trailingSection = sectionText
    ? parseAssistantChatChineseCountSection(sectionText)
    : 0;
  if (!Number.isFinite(trailingSection)) return undefined;
  const count = total + trailingSection!;
  return parsed || sectionText ? count : undefined;
};

export const isAssistantChatMultiImageAssetRequest = (text: string): boolean =>
  MULTI_IMAGE_ASSET_REQUEST_PATTERN.test(String(text || ""));

export const isAssistantChatUpscaleImageRequest = (text: string): boolean => {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  if (!UPSCALE_IMAGE_REQUEST_PATTERN.test(normalized)) return false;
  return (
    UPSCALE_EXISTING_IMAGE_HINT_PATTERN.test(normalized) ||
    UPSCALE_RESOLUTION_HINT_PATTERN.test(normalized)
  );
};

export const shouldUseRecentUserImagesForImageAssetRequest = (
  messages: UIMessage[],
): boolean => {
  const latestUserText = getLatestUserText(messages);
  return (
    isAssistantChatMultiImageAssetRequest(latestUserText) ||
    PRODUCT_REFERENCE_ASSET_REQUEST_PATTERN.test(latestUserText)
  );
};

export const resolveAssistantChatRequestedImageCount = (
  text: string,
): number | undefined => {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;

  const numericMatch =
    /(\d+)\s*(?:\u5f20|\u5e45|\u9875|\u5c4f|images?|pages?|screens?)/i.exec(
      normalized,
    );
  if (numericMatch) {
    const count = Number(numericMatch[1]);
    if (Number.isFinite(count)) {
      return Math.max(1, Math.floor(count));
    }
  }

  const chineseMatch =
    /([\u96f6\u3007\u4e00\u4e24\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u4ebf]+)\s*(?:\u5f20|\u5e45|\u9875|\u5c4f)/.exec(
      normalized,
    );
  if (chineseMatch) {
    const count = parseAssistantChatChineseImageCount(chineseMatch[1]);
    if (Number.isFinite(count)) return Math.max(1, Math.floor(count!));
  }

  return isAssistantChatMultiImageAssetRequest(normalized) ? 4 : undefined;
};

export const isExplicitAssistantChatImageGenerationRequest = (
  text: string,
): boolean => {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  return IMAGE_GENERATION_REQUEST_PATTERN.test(normalized);
};

export const deriveAssistantChatDirectiveRequestOverrides = (
  body: Pick<
    AssistantChatRequestBody,
    "webSearch" | "weather" | "imageGeneration" | "activeTools" | "toolChoice"
  >,
  messages: UIMessage[],
): AssistantChatDirectiveRequestOverrides => {
  const directiveMentions = extractAssistantChatLatestUserDirectiveMentions(
    messages,
  );
  const explicitWebSearchRequested = directiveMentions.some(
    isExplicitWebSearchDirective,
  );
  const explicitWeatherRequested = directiveMentions.some(
    isExplicitWeatherDirective,
  );
  const explicitImageToolRequested = directiveMentions.some(
    isExplicitImageToolDirective,
  );
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");
  const latestUserText = getUiMessageText(latestUserMessage);
  const latestUserTextWithoutDirectiveMentions =
    getUiMessageTextWithoutDirectiveMentions(latestUserMessage);
  const imageModeEnabled = body.imageGeneration?.enforceSettings === true;
  const explicitImageGenerationRequested =
    isExplicitAssistantChatImageGenerationRequest(
      latestUserTextWithoutDirectiveMentions,
    );
  const explicitUpscaleRequested = isAssistantChatUpscaleImageRequest(
    latestUserTextWithoutDirectiveMentions,
  );
  const multiImageAssetRequested = isAssistantChatMultiImageAssetRequest(
    latestUserTextWithoutDirectiveMentions,
  );
  const imageReferenceContinuationRequested =
    shouldUseRecentGeneratedImagesAsReferences(messages);

  const requestedActiveTools = Array.isArray(body.activeTools)
    ? body.activeTools
    : undefined;
  const hasExplicitActiveTools = Boolean(
    requestedActiveTools?.some((toolName) => String(toolName || "").trim()),
  );
  const requestedToolChoice = body.toolChoice;
  const canPromoteWeatherToolChoice =
    requestedToolChoice === undefined || requestedToolChoice === "auto";
  const promotedActiveTools =
    explicitUpscaleRequested && !hasExplicitActiveTools
      ? ["upscaleImage"]
      : multiImageAssetRequested && !hasExplicitActiveTools
      ? ["listStudioSkills", "planStudioWorkflow", "createImage"]
      : (explicitImageGenerationRequested ||
            imageReferenceContinuationRequested) &&
          !hasExplicitActiveTools
        ? ["createImage"]
        : explicitImageToolRequested && !hasExplicitActiveTools
          ? ["createImage"]
          : imageModeEnabled && !hasExplicitActiveTools
            ? ["createImage"]
            : explicitWeatherRequested && !hasExplicitActiveTools
              ? ["getWeather"]
              : body.activeTools;
  const promotedToolChoice =
    explicitWeatherRequested &&
          !hasExplicitActiveTools &&
          canPromoteWeatherToolChoice
        ? ({ type: "tool", toolName: "getWeather" } as const)
        : body.toolChoice;

  return {
    directiveMentions,
    explicitWebSearchRequested,
    explicitWeatherRequested,
    explicitImageGenerationRequested,
    webSearch:
      explicitWebSearchRequested || body.webSearch
        ? {
            ...(body.webSearch || {}),
            enabled:
              explicitWebSearchRequested || body.webSearch?.enabled === true,
          }
        : undefined,
    weather:
      explicitWeatherRequested || body.weather
        ? {
            ...(body.weather || {}),
            enabled:
              explicitWeatherRequested || body.weather?.enabled === true,
          }
        : undefined,
    activeTools: promotedActiveTools,
    toolChoice: promotedToolChoice,
  };
};

export const sanitizeAssistantChatFrontendTools = (
  tools: unknown,
): Record<string, ToolJSONSchema> => {
  if (!isRecord(tools)) return {};

  const assistantSidebarFrontendToolNames = new Set([
    "webSearch",
    "web_search",
    "google_search",
    "getWeather",
    "createImage",
    "listStudioSkills",
    "planStudioWorkflow",
    "searchWorkspaceKnowledge",
    "createTargetElement",
  ]);

  return Object.fromEntries(
    Object.entries(tools).flatMap(([name, tool]) => {
      const toolName = String(name || "").trim();
      if (
        !toolName ||
        !assistantSidebarFrontendToolNames.has(toolName) ||
        !isRecord(tool) ||
        !isRecord(tool.parameters)
      ) {
        return [];
      }
      return [
        [
          toolName,
          {
            ...(typeof tool.description === "string" && tool.description.trim()
              ? { description: tool.description.trim() }
              : {}),
            parameters: tool.parameters as JSONSchema7,
            ...(isRecord(tool.providerOptions)
              ? { providerOptions: tool.providerOptions }
              : {}),
          },
        ],
      ];
    }),
  ) as Record<string, ToolJSONSchema>;
};

const toValidationTools = (tools: ToolSet) =>
  tools as Parameters<typeof safeValidateUIMessages<AssistantChatUiMessage>>[0]["tools"];

const normalizeReasoningEffort = (value: unknown): string | undefined => {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
};

const isGemini3Model = (modelId: string): boolean =>
  String(modelId || "").toLowerCase().includes("gemini-3");

const normalizeOfficialOpenAIReasoningEffort = (
  modelId: string,
  value: unknown,
): string | undefined => {
  const reasoningEffort = normalizeReasoningEffort(value);
  if (!reasoningEffort) return undefined;

  const normalizedModelId = String(modelId || "").toLowerCase();
  const isGpt51 =
    normalizedModelId.startsWith("gpt-5.1") ||
    normalizedModelId.startsWith("gpt-5-1");
  const isGpt51CodexMax =
    normalizedModelId.startsWith("gpt-5.1-codex-max") ||
    normalizedModelId.startsWith("gpt-5-1-codex-max");

  if (reasoningEffort === "none") {
    return isGpt51 ? "none" : undefined;
  }

  if (reasoningEffort === "xhigh") {
    return isGpt51CodexMax ? "xhigh" : undefined;
  }

  return reasoningEffort;
};

export const buildAssistantChatProviderOptions = (options: {
  providerId: string;
  isGoogleProvider: boolean;
  isOfficialOpenAIProvider: boolean;
  modelId: string;
  reasoningEffort?: string;
}): AssistantChatProviderOptions | undefined => {
  if (options.isGoogleProvider) {
    const reasoningEffort = normalizeReasoningEffort(options.reasoningEffort);
    return {
      google: {
        thinkingConfig: {
          ...(reasoningEffort && isGemini3Model(options.modelId)
            ? { thinkingLevel: reasoningEffort }
            : {}),
          includeThoughts: true,
        },
      },
    };
  }

  if (options.isOfficialOpenAIProvider) {
    const reasoningEffort = normalizeOfficialOpenAIReasoningEffort(
      options.modelId,
      options.reasoningEffort,
    );
    return {
      openai: {
        ...(reasoningEffort ? { reasoningEffort } : {}),
        reasoningSummary: "auto",
      },
    };
  }

  const reasoningEffort = normalizeReasoningEffort(options.reasoningEffort);
  if (reasoningEffort) {
    return {
      openaiCompatible: {
        reasoningEffort,
      },
      [providerConfigKey(options.providerId)]: {
        reasoningEffort,
      },
    };
  }

  return undefined;
};

const providerConfigKey = (providerId: string): string =>
  String(providerId || "")
    .trim()
    .replace(/-([a-zA-Z0-9])/g, (_, char: string) => char.toUpperCase()) ||
  "openaiCompatible";

const finiteNumber = (value: unknown): number | undefined => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

export const resolveAssistantChatToolChoice = (
  requestedToolChoice: AssistantChatToolChoiceRequest | undefined,
  tools: ToolSet,
) => {
  const hasTools = Object.keys(tools).length > 0;
  if (requestedToolChoice === "auto") return "auto" as const;
  if (requestedToolChoice === "none") return "none" as const;
  if (requestedToolChoice === "required") {
    return hasTools ? ("required" as const) : undefined;
  }
  if (!isRecord(requestedToolChoice)) return undefined;
  if (requestedToolChoice.type !== "tool") return undefined;

  const toolName = String(requestedToolChoice.toolName || "").trim();
  if (!toolName || !Object.prototype.hasOwnProperty.call(tools, toolName)) {
    return undefined;
  }

  return {
    type: "tool" as const,
    toolName,
  };
};

export const resolveAssistantChatEffectiveToolChoice = (options: {
  provider: AssistantChatProviderConfig;
  requestedToolChoice: AssistantChatToolChoiceRequest | undefined;
  activeTools: string[] | undefined;
  tools: ToolSet;
}) => {
  const resolved = resolveAssistantChatToolChoice(
    options.requestedToolChoice,
    options.tools,
  );

  if (
    resolved &&
    typeof resolved === "object" &&
    !isGoogleProvider(options.provider) &&
    !isOfficialOpenAIProvider(options.provider)
  ) {
    return "auto" as const;
  }

  return resolved;
};

export const sanitizeAssistantChatActiveTools = (
  requestedActiveTools: unknown,
  tools: ToolSet,
): string[] | undefined => {
  if (!Array.isArray(requestedActiveTools)) return undefined;

  const allowedToolNames = new Set(Object.keys(tools));
  const activeTools = requestedActiveTools
    .map((toolName) => String(toolName || "").trim())
    .filter(
      (toolName, index, array) =>
        Boolean(toolName) &&
        allowedToolNames.has(toolName) &&
        array.indexOf(toolName) === index,
    );

  return activeTools.length > 0 ? activeTools : undefined;
};

export const resolveAssistantChatRequestedActiveTools = (options: {
  requestedActiveTools: unknown;
  nativeOpenAIImageGenerationEnabled: boolean;
}): unknown => {
  if (
    !options.nativeOpenAIImageGenerationEnabled ||
    !Array.isArray(options.requestedActiveTools)
  ) {
    return options.requestedActiveTools;
  }

  const mapped = options.requestedActiveTools.map((toolName) =>
    String(toolName || "").trim() === "createImage"
      ? "image_generation"
      : toolName,
  );
  return mapped;
};

const ASSISTANT_CHAT_STUDIO_WORKFLOW_PLANNING_TOOLS = [
  "listStudioSkills",
  "planStudioWorkflow",
] as const;

const hasAssistantChatStepTool = (
  step: unknown,
  toolName: string,
): boolean => {
  if (!isRecord(step)) return false;

  const toolCollections = [
    step.toolCalls,
    step.toolResults,
    step.staticToolCalls,
    step.staticToolResults,
    step.dynamicToolCalls,
    step.dynamicToolResults,
    step.content,
  ];

  return toolCollections.some(
    (collection) =>
      Array.isArray(collection) &&
      collection.some(
        (part) => isRecord(part) && String(part.toolName || "") === toolName,
      ),
  );
};

const getAssistantChatRegisteredActiveTools = (options: {
  toolNames: readonly string[];
  activeTools: string[] | undefined;
  tools: ToolSet;
}): string[] => {
  const activeToolSet = options.activeTools
    ? new Set(options.activeTools)
    : undefined;

  return options.toolNames.filter(
    (toolName) =>
      Object.prototype.hasOwnProperty.call(options.tools, toolName) &&
      (!activeToolSet || activeToolSet.has(toolName)),
  );
};

export const resolveAssistantChatStudioWorkflowPrepareStep = (options: {
  studioWorkflowPlanningRequired: boolean;
  stepNumber: number;
  steps: unknown[];
  activeTools: string[] | undefined;
  toolChoice: ToolChoice<ToolSet> | undefined;
  tools: ToolSet;
}):
  | {
      activeTools?: string[];
      toolChoice?: ToolChoice<ToolSet>;
    }
  | undefined => {
  if (!options.studioWorkflowPlanningRequired) return undefined;

  const planningTools = getAssistantChatRegisteredActiveTools({
    toolNames: ASSISTANT_CHAT_STUDIO_WORKFLOW_PLANNING_TOOLS,
    activeTools: options.activeTools,
    tools: options.tools,
  });
  if (!planningTools.includes("planStudioWorkflow")) return undefined;

  const planAlreadyReturned = options.steps.some((step) =>
    hasAssistantChatStepTool(step, "planStudioWorkflow"),
  );
  if (planAlreadyReturned) {
    return options.activeTools
      ? {
          activeTools: options.activeTools,
          ...(options.toolChoice ? { toolChoice: options.toolChoice } : {}),
        }
      : undefined;
  }

  return {
    activeTools: planningTools,
    toolChoice: "required",
  };
};

export const shouldEnableAssistantChatNativeWebSearch = (options: {
  requested: boolean | undefined;
  webSearchTools: ToolSet;
}) => options.requested === true && Object.keys(options.webSearchTools).length === 0;

const toNativeOpenAIImageGenerationSize = (
  aspectRatio: unknown,
): "1024x1024" | "1024x1536" | "1536x1024" | undefined => {
  switch (String(aspectRatio || "").trim()) {
    case "1:1":
      return "1024x1024";
    case "2:3":
    case "3:4":
    case "9:16":
      return "1024x1536";
    case "3:2":
    case "4:3":
    case "16:9":
      return "1536x1024";
    default:
      return undefined;
  }
};

const sameNormalizedOpenAIBaseUrl = (left: unknown, right: unknown): boolean => {
  try {
    return normalizeOpenAIBaseURL(String(left || "")) ===
      normalizeOpenAIBaseURL(String(right || ""));
  } catch {
    return false;
  }
};

export const resolveAssistantChatNativeOpenAIImageGeneration = (options: {
  chatProvider: AssistantChatProviderConfig;
  imageGeneration: AssistantChatImageGenerationConfig | undefined;
  defaultReferenceImageCount: number;
  explicitImageToolRequested: boolean;
}): {
  enabled: boolean;
  reason:
    | "registered"
    | "not_explicit_image_request"
    | "image_generation_disabled"
    | "provider_not_official_openai"
    | "image_provider_mismatch"
    | "unsupported_settings"
    | "has_reference_images";
  tool?: {
    model?: string;
    outputFormat: "png";
    quality: "auto";
    size: "1024x1024" | "1024x1536" | "1536x1024";
  };
} => {
  if (!options.explicitImageToolRequested) {
    return { enabled: false, reason: "not_explicit_image_request" };
  }

  const imageGeneration = options.imageGeneration;
  if (imageGeneration?.enabled !== true) {
    return { enabled: false, reason: "image_generation_disabled" };
  }

  const imageProvider = imageGeneration.provider;
  if (
    !isOfficialOpenAIProvider(options.chatProvider) ||
    !isOfficialOpenAIProvider(imageProvider || {})
  ) {
    return { enabled: false, reason: "provider_not_official_openai" };
  }

  if (
    String(options.chatProvider.id || "").trim() !==
      String(imageProvider?.id || "").trim() ||
    !sameNormalizedOpenAIBaseUrl(
      options.chatProvider.baseUrl,
      imageProvider?.baseUrl,
    )
  ) {
    return { enabled: false, reason: "image_provider_mismatch" };
  }

  if (options.defaultReferenceImageCount > 0) {
    return { enabled: false, reason: "has_reference_images" };
  }

  const size = toNativeOpenAIImageGenerationSize(
    imageGeneration.aspectRatio || "1:1",
  );
  const count = finiteNumber(imageGeneration.count) ?? 1;
  const resolution = String(imageGeneration.resolution || "1K").toUpperCase();
  if (!size || count !== 1 || resolution !== "1K") {
    return { enabled: false, reason: "unsupported_settings" };
  }

  return {
    enabled: true,
    reason: "registered",
    tool: {
      model: String(imageGeneration.modelId || "").trim() || undefined,
      outputFormat: "png",
      quality: "auto",
      size,
    },
  };
};

export const preserveAssistantChatServerToolApproval = (
  toolkitTools: ToolSet,
  serverTools: ToolSet,
): ToolSet => {
  const entries = Object.entries(toolkitTools).map(([name, toolEntry]) => {
    const needsApproval = serverTools[name]?.needsApproval;
    if (needsApproval == null) return [name, toolEntry] as const;
    return [
      name,
      {
        ...toolEntry,
        needsApproval,
      },
    ] as const;
  });

  return Object.fromEntries(entries) as ToolSet;
};

export const buildAssistantChatCallSettings = (
  callSettings: AssistantChatRequestBody["callSettings"],
): AssistantChatAiSdkCallSettings => {
  if (!callSettings || typeof callSettings !== "object") return {};

  const maxOutputTokens = finiteNumber(callSettings.maxTokens);
  const temperature = finiteNumber(callSettings.temperature);
  const topP = finiteNumber(callSettings.topP);
  const presencePenalty = finiteNumber(callSettings.presencePenalty);
  const frequencyPenalty = finiteNumber(callSettings.frequencyPenalty);
  const seed = finiteNumber(callSettings.seed);

  return {
    ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    ...(topP !== undefined ? { topP } : {}),
    ...(presencePenalty !== undefined ? { presencePenalty } : {}),
    ...(frequencyPenalty !== undefined ? { frequencyPenalty } : {}),
    ...(seed !== undefined ? { seed } : {}),
    ...(callSettings.headers ? { headers: callSettings.headers } : {}),
  };
};

export const pruneAssistantChatModelMessagesForContext = (
  messages: ModelMessage[],
): ModelMessage[] =>
  pruneMessages({
    messages,
    reasoning: "all",
    toolCalls: "before-last-2-messages",
    emptyMessages: "remove",
  });

const createAssistantChatSmoothStreamTransform = () => {
  const segmenter =
    typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
      ? new Intl.Segmenter("zh", { granularity: "word" })
      : undefined;

  return smoothStream({
    delayInMs: 8,
    chunking: segmenter || "line",
  });
};

export const getLatestUserImageFilePartUrls = (messages: UIMessage[]): string[] => {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");
  if (!latestUserMessage) return [];

  return latestUserMessage.parts
    .flatMap((part) => {
      const imageReference = getAssistantChatImagePartReference(part);
      return imageReference ? [imageReference.url] : [];
    })
    .map((url) => String(url || "").trim())
    .filter(Boolean);
};

export const getLatestUserImageMarkContexts = (
  messages: UIMessage[],
): AssistantChatImageMarkContext[] => {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");
  if (!latestUserMessage) return [];

  const contexts: AssistantChatImageMarkContext[] = [];
  const seen = new Set<string>();
  for (const part of latestUserMessage.parts) {
    const imageReference = getAssistantChatImagePartReference(part);
    const markContext = imageReference?.markContext;
    if (!markContext) continue;

    const key = [
      markContext.label,
      markContext.markerId || "",
      markContext.imageUrl,
      markContext.normalizedX,
      markContext.normalizedY,
    ].join("\u0000");
    if (seen.has(key)) continue;
    seen.add(key);
    contexts.push(markContext);
  }
  return contexts;
};

export const getLatestUserImageReferenceContexts = (
  messages: UIMessage[],
): AssistantChatImageReferenceContext[] => {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");
  if (!latestUserMessage) return [];

  const contexts: AssistantChatImageReferenceContext[] = [];
  const seen = new Set<string>();
  for (const part of latestUserMessage.parts) {
    const imageReference = getAssistantChatImagePartReference(part);
    if (!imageReference) continue;

    const context = getAssistantChatImageReferenceContext(imageReference);
    if (!context || seen.has(context.imageUrl)) continue;
    seen.add(context.imageUrl);
    contexts.push(context);
  }
  return contexts;
};

const getLatestUserText = (messages: UIMessage[]): string =>
  getUiMessageText([...messages].reverse().find((message) => message.role === "user"));

const IMAGE_REFERENCE_CONTINUATION_PATTERN =
  /(?:\u539f\u56fe|\u539f\u6765\u7684\u56fe|\u539f\u6765\u56fe\u7247|\u4e00\u5f00\u59cb\u53d1\u7684\u56fe|\u4e0a\u4e00\u5f20|\u4e0a\u5f20|\u4e0a\u6b21\u90a3\u5f20|\u4e0a\u4f20\u7684\u56fe|\u4e0a\u4f20\u56fe\u7247|\u521a\u624d\u90a3\u5f20|\u521a\u521a\u90a3\u5f20|\u521a\u751f\u6210|\u524d\u4e00\u5f20|\u8fd9\u5f20|\u90a3\u5f20|\u8fd9\u5e45|\u90a3\u5e45|\u57fa\u4e8e|\u53c2\u8003|\u6cbf\u7528|\u7ee7\u7eed|\u4fee\u6539|\u6539\u4e00\u4e0b|\u6539\u6210|\u8c03\u6574|\u91cd\u753b|\u6362\u6210|\u4fdd\u6301|\u4e0d\u7b26\u5408|\u540c\u6b3e|\u540c\u98ce\u683c|\u53d8\u4f53|original\s+image|previous\s+image|last\s+image|that\s+image|this\s+image|based\s+on|referenc|edit|modify|variation|same\s+style)/i;

export const shouldUseRecentGeneratedImagesAsReferences = (
  messages: UIMessage[],
): boolean => IMAGE_REFERENCE_CONTINUATION_PATTERN.test(getLatestUserText(messages));

const getImageUrlFromGeneratedImageOutput = (value: unknown): string[] => {
  if (!isRecord(value)) return [];
  const images = Array.isArray(value.images) ? value.images : [];
  return images
    .flatMap((image) => {
      if (!isRecord(image)) return [];
      const imageUrl = String(image.image || image.url || "").trim();
      if (/^(?:https?:\/\/|data:image\/)/i.test(imageUrl)) return [imageUrl];
      const mediaType = String(image.mediaType || "").trim();
      const data = String(image.data || "").trim();
      if (mediaType.startsWith("image/") && data) {
        return [`data:${mediaType};base64,${data}`];
      }
      return [];
    })
    .filter(Boolean);
};

const getAssistantChatToolPartRecord = (
  part: unknown,
  toolName: string,
): Record<string, unknown> | null => {
  if (!isRecord(part)) return null;
  const record = part as Record<string, unknown>;
  const type = String(record.type || "");
  const partToolName = String(record.toolName || "");
  if (type !== `tool-${toolName}` && partToolName !== toolName) return null;
  return record;
};

export const getRecentGeneratedImageReferenceUrls = (
  messages: UIMessage[],
  options: { maxImages?: number } = {},
): string[] => {
  const maxImages =
    options.maxImages == null
      ? Number.POSITIVE_INFINITY
      : Math.max(1, Math.floor(Number(options.maxImages) || 1));
  const urls: string[] = [];

  for (const message of [...messages].reverse()) {
    if (message.role !== "assistant") continue;
    for (const part of [...message.parts].reverse()) {
      const partRecord = getAssistantChatToolPartRecord(part, "createImage");
      const outputUrls = partRecord
        ? getImageUrlFromGeneratedImageOutput(partRecord.output)
        : [];
      for (const url of outputUrls) {
        if (!urls.includes(url)) urls.push(url);
        if (urls.length >= maxImages) return urls;
      }

      const imageReference = getAssistantChatImagePartReference(part);
      if (!imageReference) continue;
      const url = imageReference.url;
      if (!isAssistantChatImageReferenceUrl(url)) continue;
      if (!urls.includes(url)) urls.push(url);
      if (urls.length >= maxImages) return urls;
    }
  }

  return urls;
};

export const getRecentUserImageReferenceUrls = (
  messages: UIMessage[],
  options: { maxImages?: number } = {},
): string[] => {
  const maxImages =
    options.maxImages == null
      ? Number.POSITIVE_INFINITY
      : Math.max(1, Math.floor(Number(options.maxImages) || 1));
  const urls: string[] = [];

  for (const message of [...messages].reverse()) {
    if (message.role !== "user") continue;
    for (const part of [...message.parts].reverse()) {
      const imageReference = getAssistantChatImagePartReference(part);
      if (!imageReference) continue;
      const url = imageReference.url;
      if (!isAssistantChatImageReferenceUrl(url)) continue;
      if (!urls.includes(url)) urls.push(url);
      if (urls.length >= maxImages) return urls;
    }
  }

  return urls;
};

export const getRecentImageReferenceUrls = (
  messages: UIMessage[],
  options: { maxImages?: number } = {},
): string[] => {
  const maxImages =
    options.maxImages == null
      ? Number.POSITIVE_INFINITY
      : Math.max(1, Math.floor(Number(options.maxImages) || 1));
  const urls: string[] = [];

  for (const message of [...messages].reverse()) {
    if (message.role === "user") {
      for (const part of [...message.parts].reverse()) {
        const imageReference = getAssistantChatImagePartReference(part);
        if (!imageReference) continue;
        const url = imageReference.url;
        if (!isAssistantChatImageReferenceUrl(url)) continue;
        if (!urls.includes(url)) urls.push(url);
        if (urls.length >= maxImages) return urls;
      }
      continue;
    }

    if (message.role !== "assistant") continue;
    for (const part of [...message.parts].reverse()) {
      const partRecord = getAssistantChatToolPartRecord(part, "createImage");
      const outputUrls = partRecord
        ? getImageUrlFromGeneratedImageOutput(partRecord.output)
        : [];
      for (const url of outputUrls) {
        if (!isAssistantChatImageReferenceUrl(url)) continue;
        if (!urls.includes(url)) urls.push(url);
        if (urls.length >= maxImages) return urls;
      }

      const imageReference = getAssistantChatImagePartReference(part);
      if (!imageReference) continue;
      const url = imageReference.url;
      if (!isAssistantChatImageReferenceUrl(url)) continue;
      if (!urls.includes(url)) urls.push(url);
      if (urls.length >= maxImages) return urls;
    }
  }

  return urls;
};

export const getDefaultImageReferenceUrls = (messages: UIMessage[]): string[] => {
  const latestUserImageReferences = getLatestUserImageFilePartUrls(messages);
  if (latestUserImageReferences.length > 0) {
    return latestUserImageReferences;
  }
  if (shouldUseRecentUserImagesForImageAssetRequest(messages)) {
    return getRecentUserImageReferenceUrls(messages);
  }
  if (!shouldUseRecentGeneratedImagesAsReferences(messages)) {
    return [];
  }
  return getRecentImageReferenceUrls(messages);
};

type AssistantChatImageMemoryItem = {
  kind: "user-upload" | "generated";
  messageId: string;
  filename?: string;
  mediaType?: string;
  providerName?: string;
  providerId?: string;
  modelId?: string;
  prompt?: string;
  size?: string;
  aspectRatio?: string;
  resolution?: string;
  count?: number;
  referenceAvailable: boolean;
};

export const getAssistantChatImageMemoryItems = (
  messages: UIMessage[],
  options: { maxItems?: number } = {},
): AssistantChatImageMemoryItem[] => {
  const maxItems =
    options.maxItems == null
      ? Number.POSITIVE_INFINITY
      : Math.max(1, Math.floor(Number(options.maxItems) || 1));
  const items: AssistantChatImageMemoryItem[] = [];

  for (const message of [...messages].reverse()) {
    if (message.role === "user") {
      for (const part of [...message.parts].reverse()) {
        const imageReference = getAssistantChatImagePartReference(part);
        if (!imageReference) continue;
        items.push({
          kind: "user-upload",
          messageId: message.id,
          filename: imageReference.filename,
          mediaType: imageReference.mediaType,
          referenceAvailable: isAssistantChatImageReferenceUrl(
            imageReference.url,
          ),
        });
        if (items.length >= maxItems) return items;
      }
      continue;
    }

    if (message.role !== "assistant") continue;
    for (const part of [...message.parts].reverse()) {
      const partRecord = getAssistantChatToolPartRecord(part, "createImage");
      if (partRecord) {
        const output = isRecord(partRecord.output) ? partRecord.output : {};
        const imageUrls = getImageUrlFromGeneratedImageOutput(output);
        if (imageUrls.length > 0) {
          items.push({
            kind: "generated",
            messageId: message.id,
            providerName: truncateAssistantChatImageMemoryText(output.providerName),
            providerId: truncateAssistantChatImageMemoryText(output.providerId),
            modelId: truncateAssistantChatImageMemoryText(output.modelId),
            prompt: truncateAssistantChatImageMemoryText(output.prompt),
            size: truncateAssistantChatImageMemoryText(output.size),
            aspectRatio: truncateAssistantChatImageMemoryText(output.aspectRatio),
            resolution: truncateAssistantChatImageMemoryText(output.resolution),
            count:
              typeof output.count === "number" && Number.isFinite(output.count)
                ? output.count
                : imageUrls.length,
            referenceAvailable: imageUrls.some(isAssistantChatImageReferenceUrl),
          });
          if (items.length >= maxItems) return items;
          continue;
        }
      }

      const imageReference = getAssistantChatImagePartReference(part);
      if (!imageReference) continue;
      items.push({
        kind: "generated",
        messageId: message.id,
        filename: imageReference.filename,
        mediaType: imageReference.mediaType,
        count: 1,
        referenceAvailable: isAssistantChatImageReferenceUrl(
          imageReference.url,
        ),
      });
      if (items.length >= maxItems) return items;
    }
  }

  return items;
};

export const buildAssistantChatImageMemoryContext = (
  messages: UIMessage[],
): string => {
  const items = getAssistantChatImageMemoryItems(messages);
  if (items.length === 0) return "";

  const lines = items.map((item, index) => {
    const ordinal = index + 1;
    if (item.kind === "user-upload") {
      return [
        `${ordinal}. User uploaded image`,
        item.filename ? `filename: ${item.filename}` : "",
        item.mediaType ? `type: ${item.mediaType}` : "",
        item.referenceAvailable ? "reference: available" : "reference: unavailable",
        `message: ${item.messageId}`,
      ]
        .filter(Boolean)
        .join("; ");
    }

    return [
      `${ordinal}. Assistant generated image`,
      item.providerName || item.providerId
        ? `provider: ${item.providerName || item.providerId}`
        : "",
      item.modelId ? `model: ${item.modelId}` : "",
      item.size ? `size: ${item.size}` : "",
      item.aspectRatio ? `aspect ratio: ${item.aspectRatio}` : "",
      item.resolution ? `resolution: ${item.resolution}` : "",
      item.count ? `count: ${item.count}` : "",
      item.prompt ? `prompt: ${item.prompt}` : "",
      item.referenceAvailable ? "reference: available" : "reference: unavailable",
      `message: ${item.messageId}`,
    ]
      .filter(Boolean)
      .join("; ");
  });

  return [
    ASSISTANT_CHAT_IMAGE_MEMORY_CONTEXT_PREFIX,
    "Most recent images first. Use this as text memory only; do not assume hidden image pixels are visible to the language model.",
    "When the user asks to edit or continue from a previous image, call createImage; the server attaches the relevant recent image references when available.",
    ...lines,
  ].join("\n");
};

export const injectAssistantImageMemoryContext = (
  messages: UIMessage[],
  options: { sourceMessages?: UIMessage[] } = {},
): UIMessage[] => {
  const context = buildAssistantChatImageMemoryContext(
    options.sourceMessages ?? messages,
  );
  if (!context) return messages;

  const latestUserIndex = (() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.role === "user") return index;
    }
    return -1;
  })();
  if (latestUserIndex < 0) return messages;

  return messages.map((message, index) => {
    if (index !== latestUserIndex) return message;
    const firstPart = message.parts[0];
    if (
      firstPart?.type === "text" &&
      String(firstPart.text || "").startsWith(ASSISTANT_CHAT_IMAGE_MEMORY_CONTEXT_PREFIX)
    ) {
      return message;
    }
    return {
      ...message,
      parts: [
        { type: "text" as const, text: `${context}\n\n` },
        ...(message.parts || []),
      ],
    };
  });
};

const isAssistantChatDebugEnabled = () => process.env.NODE_ENV !== "production";

const getErrorMessage = (error: unknown): string => {
  if (error == null) return "unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const truncateAssistantChatLogValue = (value: unknown, maxLength = 1200) => {
  if (value == null) return undefined;
  const text =
    typeof value === "string"
      ? value
      : (() => {
          try {
            return JSON.stringify(value);
          } catch {
            return String(value);
          }
        })();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};

const getErrorObjectField = (
  error: Record<string, unknown>,
  keys: string[],
): unknown => {
  for (const key of keys) {
    if (error[key] !== undefined) return error[key];
  }
  return undefined;
};

const summarizeAssistantChatErrorForLog = (
  error: unknown,
): Record<string, unknown> => {
  const summary: Record<string, unknown> = {
    message: getErrorMessage(error),
  };

  if (error instanceof Error) {
    summary.name = error.name;
  }

  if (!isRecord(error)) return summary;

  for (const key of [
    "name",
    "status",
    "statusCode",
    "code",
    "requestId",
    "url",
    "modelId",
    "providerId",
  ]) {
    const value = error[key];
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      summary[key] = value;
    }
  }

  const responseBody = getErrorObjectField(error, [
    "responseBody",
    "responseText",
    "body",
    "data",
  ]);
  const responseBodyPreview = truncateAssistantChatLogValue(responseBody);
  if (responseBodyPreview) summary.responseBodyPreview = responseBodyPreview;

  const cause = error.cause;
  if (cause !== undefined) {
    summary.cause = getErrorMessage(cause);
    if (isRecord(cause)) {
      const causeStatus = getErrorObjectField(cause, ["status", "statusCode"]);
      if (
        typeof causeStatus === "string" ||
        typeof causeStatus === "number" ||
        typeof causeStatus === "boolean"
      ) {
        summary.causeStatus = causeStatus;
      }
      const causeBody = getErrorObjectField(cause, [
        "responseBody",
        "responseText",
        "body",
        "data",
      ]);
      const causeBodyPreview = truncateAssistantChatLogValue(causeBody);
      if (causeBodyPreview) summary.causeBodyPreview = causeBodyPreview;
    }
  }

  return summary;
};

const formatAssistantChatStreamErrorText = (
  error: unknown,
  context: Record<string, unknown>,
  options: { includeResponseDetails?: boolean } = {},
): string => {
  const summary = summarizeAssistantChatErrorForLog(error);
  const includeResponseDetails = options.includeResponseDetails !== false;
  const details = [
    `message=${String(summary.message || "unknown error")}`,
    context.requestId ? `requestId=${context.requestId}` : "",
    context.stage ? `stage=${context.stage}` : "",
    context.providerId ? `providerId=${context.providerId}` : "",
    context.providerBaseUrl ? `providerBaseUrl=${context.providerBaseUrl}` : "",
    context.modelId ? `modelId=${context.modelId}` : "",
    context.imageProviderId
      ? `imageProviderId=${context.imageProviderId}`
      : "",
    context.imageProviderBaseUrl
      ? `imageProviderBaseUrl=${context.imageProviderBaseUrl}`
      : "",
    context.imageModelId ? `imageModelId=${context.imageModelId}` : "",
    summary.statusCode ? `statusCode=${summary.statusCode}` : "",
    summary.status ? `status=${summary.status}` : "",
    summary.code ? `code=${summary.code}` : "",
    summary.url ? `url=${summary.url}` : "",
    context.requestedToolChoice
      ? `requestedToolChoice=${truncateAssistantChatLogValue(context.requestedToolChoice, 240)}`
      : "",
    context.toolChoice
      ? `toolChoice=${truncateAssistantChatLogValue(context.toolChoice, 240)}`
      : "",
    context.activeTools
      ? `activeTools=${truncateAssistantChatLogValue(context.activeTools, 240)}`
      : "",
    includeResponseDetails && summary.responseBodyPreview
      ? `body=${truncateAssistantChatLogValue(summary.responseBodyPreview, 360)}`
      : "",
    summary.cause ? `cause=${String(summary.cause)}` : "",
    includeResponseDetails && summary.causeBodyPreview
      ? `causeBody=${truncateAssistantChatLogValue(summary.causeBodyPreview, 360)}`
      : "",
  ].filter(Boolean);

  return `Assistant chat failed: ${details.join(" | ")}`;
};

const isAssistantChatUiErrorChunk = (
  chunk: unknown,
): chunk is {
  type: string;
  errorText?: string;
  toolCallId?: string;
  toolName?: string;
} =>
  isRecord(chunk) &&
  (chunk.type === "error" ||
    chunk.type === "tool-input-error" ||
    chunk.type === "tool-output-error");

const enrichAssistantChatUiErrorChunk = <
  T extends {
    type: string;
    errorText?: string;
    toolCallId?: string;
    toolName?: string;
  },
>(
  chunk: T,
  context: Record<string, unknown>,
  details: Record<string, unknown> = {},
): T => {
  const errorText = String(chunk.errorText || "").trim();
  if (errorText.startsWith("Assistant chat failed:")) return chunk;

  const message = formatAssistantChatStreamErrorText(
    errorText || chunk,
    {
      ...context,
      ...details,
    },
    {
      includeResponseDetails:
        chunk.type === "tool-output-error" || isAssistantChatDebugEnabled(),
    },
  );

  return {
    ...chunk,
    errorText: message,
  };
};

const summarizeProviderBaseUrl = (value: string | null | undefined): string => {
  try {
    const url = new URL(String(value || ""));
    return url.origin;
  } catch {
    return value ? "[invalid-url]" : "";
  }
};

const logAssistantChat = (
  requestId: string,
  event: string,
  details: Record<string, unknown> = {},
) => {
  if (!isAssistantChatDebugEnabled()) return;
  console.info(`[assistant-chat:${requestId}] ${event}`, details);
};

const logAssistantChatError = (
  requestId: string,
  event: string,
  details: Record<string, unknown> = {},
) => {
  if (!isAssistantChatDebugEnabled()) return;
  console.error(`[assistant-chat:${requestId}] ${event}`, details);
};

const summarizeToolOutputForLog = (output: unknown) => {
  if (!isRecord(output)) return { outputType: typeof output };

  const images = Array.isArray(output.images) ? output.images : undefined;
  const error = typeof output.error === "string" ? output.error : undefined;
  return {
    outputKeys: Object.keys(output),
    ...(images ? { imageCount: images.length } : {}),
    ...(error ? { error } : {}),
  };
};

const getAssistantChatToolStatusLabel = (toolName: string | undefined) => {
  switch (toolName) {
    case "createImage":
      return "正在调用图片生成工具...";
    case "getWeather":
      return "正在查询天气...";
    case "planStudioWorkflow":
      return "正在规划 Studio 工作流...";
    case "webSearch":
    case "web_search":
    case "google_search":
      return "正在联网搜索...";
    case "createTargetElement":
      return "正在准备画布目标...";
    default:
      return "正在调用工具...";
  }
};

const getAssistantChatToolFinishedStatusLabel = (
  toolName: string | undefined,
) => {
  switch (toolName) {
    case "createImage":
      return "图片结果已返回，正在整理回复...";
    case "getWeather":
      return "天气结果已返回，正在整理回复...";
    case "planStudioWorkflow":
      return "工作流规划已返回，正在整理回复...";
    case "webSearch":
    case "web_search":
    case "google_search":
      return "搜索结果已返回，正在整理回复...";
    case "createTargetElement":
      return "画布目标已返回，正在整理回复...";
    default:
      return "工具结果已返回，正在整理回复...";
  }
};

const getReadableAssistantChatStatusMessage = (
  data: Omit<AssistantChatStatusData, "elapsedMs" | "requestId">,
): string => {
  switch (data.stage) {
    case "model-start":
      return "正在请求模型...";
    case "tool-start":
      switch (data.toolName) {
        case "createImage":
          return "正在调用图片生成工具...";
        case "getWeather":
          return "正在查询天气...";
        case "planStudioWorkflow":
          return "正在规划 Studio 工作流...";
        case "webSearch":
        case "web_search":
        case "google_search":
          return "正在联网搜索...";
        case "createTargetElement":
          return "正在准备画布目标...";
        default:
          return "正在调用工具...";
      }
    case "tool-finish":
      switch (data.toolName) {
        case "createImage":
          return "图片结果已返回，正在整理回复...";
        case "getWeather":
          return "天气结果已返回，正在整理回复...";
        case "planStudioWorkflow":
          return "工作流规划已返回，正在整理回复...";
        case "webSearch":
        case "web_search":
        case "google_search":
          return "搜索结果已返回，正在整理回复...";
        case "createTargetElement":
          return "画布目标已返回，正在整理回复...";
        default:
          return "工具结果已返回，正在整理回复...";
      }
    case "error":
      return "请求出错，正在整理错误信息...";
    default:
      return data.message;
  }
};

const createAssistantChatStatusChunk = (
  data: Omit<AssistantChatStatusData, "elapsedMs" | "requestId">,
  context: {
    requestId: string;
    startedAt: number;
    providerId?: string;
    modelId?: string;
  },
) => ({
  type: "data-assistant-status",
  data: {
    providerId: context.providerId,
    modelId: context.modelId,
    ...data,
    message: getReadableAssistantChatStatusMessage(data),
    requestId: context.requestId,
    elapsedMs: Date.now() - context.startedAt,
  } satisfies AssistantChatStatusData,
  transient: true,
} satisfies InferUIMessageChunk<AssistantChatUiMessage>);

const summarizeToolInputForLog = (input: unknown) => {
  if (!isRecord(input)) return { inputType: typeof input };

  const text = typeof input.text === "string"
    ? input.text
    : typeof input.prompt === "string"
      ? input.prompt
      : undefined;
  const images = Array.isArray(input.images) ? input.images : undefined;
  const referenceImages = Array.isArray(input.referenceImages)
    ? input.referenceImages
    : undefined;

  return {
    inputKeys: Object.keys(input),
    ...(text
      ? { textPreview: truncateAssistantChatLogValue(text, 240) }
      : {}),
    ...(typeof input.aspectRatio === "string"
      ? { aspectRatio: input.aspectRatio }
      : {}),
    ...(typeof input.size === "string" ? { size: input.size } : {}),
    ...(typeof input.count === "number" ? { count: input.count } : {}),
    ...(typeof input.location === "string" ? { location: input.location } : {}),
    ...(images ? { imageInputCount: images.length } : {}),
    ...(referenceImages
      ? { referenceImageInputCount: referenceImages.length }
      : {}),
  };
};

const writeWebResponse = async (
  response: Response,
  res: any,
  context: { requestId: string; startedAt: number },
) => {
  logAssistantChat(context.requestId, "stream_response_start", {
    status: response.status,
    contentType: response.headers.get("content-type"),
    elapsedMs: Date.now() - context.startedAt,
  });
  res.status(response.status);
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Assistant-Request-Id", context.requestId);

  if (!response.body) {
    res.end();
    return;
  }

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  const reader = response.body.getReader();
  let chunkCount = 0;
  let byteCount = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value && value.length > 0) {
        chunkCount += 1;
        byteCount += value.length;
        if (chunkCount === 1) {
          logAssistantChat(context.requestId, "stream_first_chunk", {
            elapsedMs: Date.now() - context.startedAt,
            bytes: value.length,
          });
        }
        res.write(Buffer.from(value));
      }
    }
    logAssistantChat(context.requestId, "stream_response_end", {
      elapsedMs: Date.now() - context.startedAt,
      chunkCount,
      byteCount,
    });
  } finally {
    reader.releaseLock();
  }
  res.end();
};

export default async function handler(req: any, res: any) {
  const startedAt = Date.now();
  const requestId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  let stage = "method";

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  stage = "parse_body";
  logAssistantChat(requestId, "http_request_received", {
    method: req.method,
    body: summarizeRequestBodyShape(req.body),
    elapsedMs: Date.now() - startedAt,
  });
  const body = parseRequestBody(req.body);
  stage = "normalize_messages";
  const messages = normalizeAssistantUiMessages(body.messages);
  logAssistantChat(requestId, "request_received", {
    messageCount: messages.length,
    hasToolsPayload: isRecord(body.tools),
    trigger: isRecord(body) ? body.trigger : undefined,
    elapsedMs: Date.now() - startedAt,
  });
  if (messages.length === 0) {
    return res.status(400).json({ error: "messages are required" });
  }

  const directiveRequestOverrides =
    deriveAssistantChatDirectiveRequestOverrides(body, messages);
    logAssistantChat(requestId, "directive_overrides_ready", {
      directiveMentions: directiveRequestOverrides.directiveMentions,
      explicitWebSearchRequested:
        directiveRequestOverrides.explicitWebSearchRequested,
      explicitWeatherRequested:
        directiveRequestOverrides.explicitWeatherRequested,
      explicitUpscaleRequested: isAssistantChatUpscaleImageRequest(
        getLatestUserText(messages),
      ),
      elapsedMs: Date.now() - startedAt,
    });

  stage = "resolve_provider";
  const provider = resolveProviderConfig(body);
    logAssistantChat(requestId, "provider_resolved", {
      providerId: provider.id,
      providerName: provider.name,
      baseUrl: summarizeProviderBaseUrl(provider.baseUrl),
      hasApiKey: Boolean(provider.apiKey),
      elapsedMs: Date.now() - startedAt,
    });
  if (!provider.apiKey) {
    return res.status(400).json({
      error: "assistant_chat_api_key_missing",
      providerId: provider.id,
    });
  }

  let aiToolkit: Awaited<ReturnType<typeof createAssistantAiSdkToolkit>> | null =
    null;
  let aiToolkitClosed = false;
  const closeAiToolkit = async () => {
    if (aiToolkitClosed) return;
    aiToolkitClosed = true;

    try {
      await aiToolkit?.close();
    } catch (error) {
      logAssistantChatError(requestId, "toolkit_close_failed", {
        stage,
        providerId: provider.id,
        message: getErrorMessage(error),
        elapsedMs: Date.now() - startedAt,
      });
    }
  };

  try {
    stage = "resolve_model";
    const modelId = resolveModelId(body, provider);
    logAssistantChat(requestId, "model_resolved", {
      providerId: provider.id,
      modelId,
      elapsedMs: Date.now() - startedAt,
    });
    stage = "sanitize_frontend_tools";
    const frontendToolSchemas = sanitizeAssistantChatFrontendTools(body.tools);
    logAssistantChat(requestId, "frontend_tools_sanitized", {
      frontendToolCount: Object.keys(frontendToolSchemas).length,
      elapsedMs: Date.now() - startedAt,
    });
    stage = "create_web_search_tools";
    const webSearchConfig =
      directiveRequestOverrides.webSearch ?? body.webSearch;
    const weatherConfig = directiveRequestOverrides.weather ?? body.weather;
    const requestedActiveTools =
      directiveRequestOverrides.activeTools ?? body.activeTools;
    const requestedToolChoice =
      directiveRequestOverrides.toolChoice ?? body.toolChoice;
    const webSearchTools = createAssistantChatWebSearchTools(webSearchConfig);
    logAssistantChat(requestId, "web_search_tools_ready", {
      reason: webSearchTools.reason,
      providerId: webSearchTools.providerId,
      providerType: webSearchTools.providerType,
      enabled: webSearchConfig?.enabled === true,
      toolCount: Object.keys(webSearchTools.tools).length,
      elapsedMs: Date.now() - startedAt,
    });
    stage = "create_image_tools";
    const latestUserImageReferences = getLatestUserImageFilePartUrls(messages);
    const latestUserImageReferenceContexts =
      getLatestUserImageReferenceContexts(messages);
    const latestUserImageMarkContexts = getLatestUserImageMarkContexts(messages);
    const recentGeneratedImageReferences =
      getRecentGeneratedImageReferenceUrls(messages);
    const defaultImageReferences = getDefaultImageReferenceUrls(messages);
    const requestedImageCountFromText = resolveAssistantChatRequestedImageCount(
      getLatestUserText(messages),
    );
    const nativeOpenAIImageGeneration =
      resolveAssistantChatNativeOpenAIImageGeneration({
        chatProvider: provider,
        imageGeneration: body.imageGeneration,
        defaultReferenceImageCount: defaultImageReferences.length,
        explicitImageToolRequested:
          directiveRequestOverrides.explicitImageGenerationRequested ||
          body.imageGeneration?.enforceSettings === true,
      });
    const imageTools = createAssistantChatImageTools({
      ...(body.imageGeneration || {}),
      minimumCount: requestedImageCountFromText,
      referenceImages: defaultImageReferences,
      referenceImageContexts: latestUserImageReferenceContexts,
      markContexts: latestUserImageMarkContexts,
    });
    logAssistantChat(requestId, "image_tools_ready", {
      reason: imageTools.reason,
      providerId: imageTools.providerId,
      providerName:
        typeof body.imageGeneration?.provider?.name === "string"
          ? body.imageGeneration.provider.name
          : undefined,
      providerBaseUrl: summarizeProviderBaseUrl(
        typeof body.imageGeneration?.provider?.baseUrl === "string"
          ? body.imageGeneration.provider.baseUrl
          : undefined,
      ),
      modelId: imageTools.modelId,
      requestedAspectRatio: body.imageGeneration?.aspectRatio || null,
      requestedResolution: body.imageGeneration?.resolution || null,
      requestedCount: body.imageGeneration?.count || null,
      requestedCountFromText: requestedImageCountFromText || null,
      settingsLocked: body.imageGeneration?.enforceSettings === true,
      defaultReferenceImageCount: latestUserImageReferences.length,
      recentGeneratedReferenceImageCount: recentGeneratedImageReferences.length,
      effectiveDefaultReferenceImageCount: defaultImageReferences.length,
      latestUserReferenceContextCount: latestUserImageReferenceContexts.length,
      latestUserMarkContextCount: latestUserImageMarkContexts.length,
      recentGeneratedReferencesEnabled:
        latestUserImageReferences.length === 0 &&
        shouldUseRecentGeneratedImagesAsReferences(messages),
      nativeOpenAIImageGenerationEnabled: nativeOpenAIImageGeneration.enabled,
      nativeOpenAIImageGenerationReason: nativeOpenAIImageGeneration.reason,
      toolCount: Object.keys(imageTools.tools).length,
      elapsedMs: Date.now() - startedAt,
    });
    stage = "create_weather_tools";
    const shouldRegisterWeatherTools =
      weatherConfig?.enabled === true ||
      shouldRegisterAssistantChatWeatherTools(messages);
    const weatherTools = shouldRegisterWeatherTools
      ? createAssistantChatWeatherTools(weatherConfig, { messages })
      : ({ tools: {}, reason: "disabled" } as const);
    logAssistantChat(requestId, "weather_tools_ready", {
      reason: weatherTools.reason,
      enabled: weatherConfig?.enabled === true,
      toolCount: Object.keys(weatherTools.tools).length,
      elapsedMs: Date.now() - startedAt,
    });
    stage = "create_studio_skill_tools";
    const studioSkillTools = createAssistantChatStudioSkillTools();
    logAssistantChat(requestId, "studio_skill_tools_ready", {
      toolCount: Object.keys(studioSkillTools.tools).length,
      elapsedMs: Date.now() - startedAt,
    });
    stage = "create_workspace_knowledge_tools";
    const workspaceKnowledgeTools = createAssistantChatWorkspaceKnowledgeTools();
    logAssistantChat(requestId, "workspace_knowledge_tools_ready", {
      toolCount: Object.keys(workspaceKnowledgeTools.tools).length,
      elapsedMs: Date.now() - startedAt,
    });
    const serverTools = {
      ...webSearchTools.tools,
      ...imageTools.tools,
      ...weatherTools.tools,
      ...studioSkillTools.tools,
      ...workspaceKnowledgeTools.tools,
    };
    const serverToolCount = Object.keys(serverTools).length;
    stage = "create_server_toolkit";
    const serverToolkit = createAssistantSidebarServerToolkit({
      webSearchTools: webSearchTools.tools,
      imageTools: imageTools.tools,
      weatherTools: weatherTools.tools,
      studioSkillTools: studioSkillTools.tools,
      workspaceKnowledgeTools: workspaceKnowledgeTools.tools,
    });
    aiToolkit = await createAssistantAiSdkToolkit(serverToolkit);
    stage = "create_toolkit_tools";
    const toolkitTools = preserveAssistantChatServerToolApproval(
      (await aiToolkit.tools({
        frontend: frontendToolSchemas,
      })) as ToolSet,
      serverTools as ToolSet,
    );
    logAssistantChat(requestId, "toolkit_tools_ready", {
      toolkitToolCount: Object.keys(toolkitTools).length,
      approvalToolCount: Object.values(toolkitTools).filter(
        (toolEntry) => toolEntry?.needsApproval != null,
      ).length,
      serverToolCount,
      frontendToolCount: Object.keys(frontendToolSchemas).length,
      elapsedMs: Date.now() - startedAt,
    });

    stage = "create_language_model";
    const nativeWebSearchEnabled = shouldEnableAssistantChatNativeWebSearch({
      requested: webSearchConfig?.enabled === true,
      webSearchTools: webSearchTools.tools,
    });
    const hasFunctionTools = Object.keys(toolkitTools).length > 0;
    const { model, providerTools } = createLanguageModelBundle(provider, modelId, {
      hasFunctionTools,
      enableNativeWebSearch: nativeWebSearchEnabled,
      nativeOpenAIImageGeneration: nativeOpenAIImageGeneration.tool,
    });
    logAssistantChat(requestId, "language_model_ready", {
      providerId: provider.id,
      modelProvider: (model as any).provider,
      modelId: (model as any).modelId || modelId,
      specificationVersion: (model as any).specificationVersion,
      providerToolCount: Object.keys(providerTools).length,
      nativeWebSearchEnabled,
      elapsedMs: Date.now() - startedAt,
    });
    stage = "create_ai_sdk_tools";
    const aiSdkTools = {
      ...toolkitTools,
      ...providerTools,
    } as ToolSet;
    logAssistantChat(requestId, "ai_sdk_tools_ready", {
      toolCount: Object.keys(aiSdkTools).length,
      toolkitToolCount: Object.keys(toolkitTools).length,
      providerToolCount: Object.keys(providerTools).length,
      serverToolCount,
      elapsedMs: Date.now() - startedAt,
    });
    stage = "validate_ui_messages";
    const validation = await safeValidateUIMessages<AssistantChatUiMessage>({
      messages,
      metadataSchema: ASSISTANT_CHAT_METADATA_SCHEMA,
      dataSchemas: ASSISTANT_CHAT_DATA_SCHEMAS,
      tools: toValidationTools(aiSdkTools),
    });
    if (validation.success === false) {
      return res.status(400).json({
        error: "assistant_chat_invalid_messages",
        message: validation.error.message,
        providerId: provider.id,
      });
    }
    const validatedMessages = validation.data;
    const googleProvider = isGoogleProvider(provider);
    const openAIReasoningSummaryEnabled =
      shouldRequestOpenAIReasoningSummary(provider, modelId);
    const providerOptions = buildAssistantChatProviderOptions({
      providerId: provider.id,
      isGoogleProvider: googleProvider,
      isOfficialOpenAIProvider: openAIReasoningSummaryEnabled,
      modelId,
      reasoningEffort: body.config?.reasoningEffort,
    });
    const googleProviderOptions = isRecord(providerOptions?.google)
      ? providerOptions.google
      : undefined;
    const googleThinkingConfig = isRecord(googleProviderOptions?.thinkingConfig)
      ? googleProviderOptions.thinkingConfig
      : undefined;
    const openaiProviderOptions = isRecord(providerOptions?.openai)
      ? providerOptions.openai
      : undefined;
    const openaiCompatibleProviderOptions = isRecord(
      providerOptions?.openaiCompatible,
    )
      ? providerOptions.openaiCompatible
      : undefined;
    logAssistantChat(requestId, "reasoning_options_ready", {
      requestedReasoningEffort: body.config?.reasoningEffort,
      providerOptionsKeys: providerOptions ? Object.keys(providerOptions) : [],
      googleIncludeThoughts:
        googleThinkingConfig?.includeThoughts === true,
      googleThinkingLevel: googleThinkingConfig?.thinkingLevel,
      openaiReasoningEffort: openaiProviderOptions?.reasoningEffort,
      openaiReasoningSummary: openaiProviderOptions?.reasoningSummary,
      openaiCompatibleReasoningEffort:
        openaiCompatibleProviderOptions?.reasoningEffort,
      officialOpenAIReasoningSummaryEnabled: openAIReasoningSummaryEnabled,
      elapsedMs: Date.now() - startedAt,
    });
    const aiSdkCallSettings = buildAssistantChatCallSettings(body.callSettings);

    stage = "convert_model_messages";
    const modelMessageSource = stripOversizedImageFilePartsForModelMessages(
      validatedMessages,
      { provider, modelId },
    );
    const rawModelMessages = await convertToModelMessages(
      unstable_injectInteractableContext(
        injectAssistantImageMemoryContext(
          injectAssistantQuoteContext(modelMessageSource.messages),
          { sourceMessages: validatedMessages },
        ),
      ),
      {
        tools: aiSdkTools,
        ignoreIncompleteToolCalls: true,
      },
    );
    const modelMessages =
      pruneAssistantChatModelMessagesForContext(rawModelMessages);
    logAssistantChat(requestId, "model_messages_ready", {
      modelMessageCount: modelMessages.length,
      rawModelMessageCount: rawModelMessages.length,
      prunedModelMessageCount: rawModelMessages.length - modelMessages.length,
      toolCount: Object.keys(aiSdkTools).length,
      isGoogleProvider: googleProvider,
      reasoningEffort: body.config?.reasoningEffort,
      hasProviderOptions: Boolean(providerOptions),
      callSettingKeys: Object.keys(aiSdkCallSettings),
      strippedOversizedImageFilePartCount:
        modelMessageSource.strippedImageFilePartCount,
      strippedOversizedImageFilePartChars:
        modelMessageSource.strippedImageFilePartChars,
      strippedImageFilePartCount: modelMessageSource.strippedImageFilePartCount,
      strippedImageFilePartChars: modelMessageSource.strippedImageFilePartChars,
      strippedBinaryPayloadCount: modelMessageSource.strippedBinaryPayloadCount,
      strippedBinaryPayloadChars: modelMessageSource.strippedBinaryPayloadChars,
      strippedUnsupportedFilePartCount:
        modelMessageSource.strippedUnsupportedFilePartCount,
      modelImageUrlReplacementCount:
        modelMessageSource.modelImageUrlReplacementCount,
      elapsedMs: Date.now() - startedAt,
    });

    stage = "stream_text";
    const effectiveRequestedActiveTools = resolveAssistantChatRequestedActiveTools({
      requestedActiveTools,
      nativeOpenAIImageGenerationEnabled: nativeOpenAIImageGeneration.enabled,
    });
    const activeTools = sanitizeAssistantChatActiveTools(
      effectiveRequestedActiveTools,
      aiSdkTools,
    );
    const systemPrompt = buildAssistantChatSystemPrompt({
      system: typeof body.system === "string" ? body.system : undefined,
      imageModeEnabled: body.imageGeneration?.enforceSettings === true,
      imageToolAvailable: Object.prototype.hasOwnProperty.call(
        aiSdkTools,
        "createImage",
      ) || Object.prototype.hasOwnProperty.call(aiSdkTools, "image_generation"),
      upscaleToolAvailable: Object.prototype.hasOwnProperty.call(
        aiSdkTools,
        "upscaleImage",
      ),
      studioSkillsToolAvailable: Object.prototype.hasOwnProperty.call(
        aiSdkTools,
        "listStudioSkills",
      ),
      studioWorkflowPlanToolAvailable: Object.prototype.hasOwnProperty.call(
        aiSdkTools,
        "planStudioWorkflow",
      ),
      latestUserText: getLatestUserText(validatedMessages),
    });
    const toolChoice = resolveAssistantChatEffectiveToolChoice({
      provider,
      requestedToolChoice,
      activeTools,
      tools: aiSdkTools,
    });
    const studioWorkflowPlanningRequired =
      activeTools?.includes("planStudioWorkflow") === true &&
      activeTools.includes("createImage") &&
      isAssistantChatMultiImageAssetRequest(getLatestUserText(validatedMessages));
    const streamErrorContext = () => ({
      stage,
      requestId,
      providerId: provider.id,
      providerName: provider.name,
      providerBaseUrl: summarizeProviderBaseUrl(provider.baseUrl),
      modelId,
      imageProviderId: imageTools.providerId,
      imageProviderName:
        typeof body.imageGeneration?.provider?.name === "string"
          ? body.imageGeneration.provider.name
          : undefined,
      imageProviderBaseUrl: summarizeProviderBaseUrl(
        typeof body.imageGeneration?.provider?.baseUrl === "string"
          ? body.imageGeneration.provider.baseUrl
          : undefined,
      ),
      imageModelId: imageTools.modelId,
      activeTools,
      requestedActiveTools,
      effectiveRequestedActiveTools,
      requestedToolChoice,
      toolChoice,
      studioWorkflowPlanningRequired,
      nativeOpenAIImageGenerationReason: nativeOpenAIImageGeneration.reason,
      elapsedMs: Date.now() - startedAt,
    });
    logAssistantChat(requestId, "tool_choice_ready", {
      requestedActiveTools,
      effectiveRequestedActiveTools,
      activeTools,
      requestedToolChoice,
      toolChoice,
      studioWorkflowPlanningRequired,
      nativeOpenAIImageGenerationEnabled: nativeOpenAIImageGeneration.enabled,
      nativeOpenAIImageGenerationReason: nativeOpenAIImageGeneration.reason,
      imageModeInstructionApplied:
        systemPrompt?.includes(ASSISTANT_CHAT_IMAGE_MODE_SYSTEM_HINT) === true,
      elapsedMs: Date.now() - startedAt,
    });
    const toolCallStartedAt = new Map<string, number>();
    const firstChunkByType = new Set<string>();
    const logFirstStreamEvent = (
      eventType: string,
      details: Record<string, unknown> = {},
    ) => {
      if (firstChunkByType.has(eventType)) return;
      firstChunkByType.add(eventType);
      logAssistantChat(requestId, `stream_first_${eventType}`, {
        ...details,
        elapsedMs: Date.now() - startedAt,
      });
    };
    const result = streamText({
      model,
      messages: modelMessages,
      experimental_include: ASSISTANT_CHAT_STREAM_TEXT_INCLUDE_SETTINGS,
      experimental_transform: createAssistantChatSmoothStreamTransform(),
      ...(systemPrompt ? { system: systemPrompt } : {}),
      ...aiSdkCallSettings,
      ...(providerOptions ? { providerOptions } : {}),
      stopWhen: stepCountIs(10),
      tools: aiSdkTools,
      ...(activeTools ? { activeTools: activeTools as Array<keyof typeof aiSdkTools> } : {}),
      ...(toolChoice ? { toolChoice } : {}),
      prepareStep: ({ stepNumber, steps }) => {
        const stepOverride = resolveAssistantChatStudioWorkflowPrepareStep({
          studioWorkflowPlanningRequired,
          stepNumber,
          steps,
          activeTools,
          toolChoice,
          tools: aiSdkTools,
        });

        if (stepOverride) {
          logAssistantChat(requestId, "prepare_step_override", {
            stepNumber,
            activeTools: stepOverride.activeTools,
            toolChoice: stepOverride.toolChoice,
            reason: "studio_workflow_plan_before_image_generation",
            elapsedMs: Date.now() - startedAt,
          });
          return {
            ...stepOverride,
            activeTools: stepOverride.activeTools as
              | Array<keyof typeof aiSdkTools>
              | undefined,
          };
        }

        return undefined;
      },
      experimental_onStart: (event) => {
        logAssistantChat(requestId, "ai_sdk_start", {
          modelProvider: event.model.provider,
          modelId: event.model.modelId,
          messageCount: Array.isArray(event.messages)
            ? event.messages.length
            : undefined,
          toolCount: event.tools ? Object.keys(event.tools).length : 0,
          activeTools: event.activeTools,
          toolChoice: event.toolChoice,
          elapsedMs: Date.now() - startedAt,
        });
      },
      experimental_onStepStart: (event) => {
        logAssistantChat(requestId, "ai_sdk_step_start", {
          stepNumber: event.stepNumber,
          modelProvider: event.model.provider,
          modelId: event.model.modelId,
          messageCount: event.messages.length,
          previousStepCount: event.steps.length,
          toolCount: event.tools ? Object.keys(event.tools).length : 0,
          activeTools: event.activeTools,
          toolChoice: event.toolChoice,
          elapsedMs: Date.now() - startedAt,
        });
      },
      experimental_onToolCallStart: (event) => {
        toolCallStartedAt.set(event.toolCall.toolCallId, Date.now());
        logAssistantChat(requestId, "ai_sdk_tool_call_start", {
          stepNumber: event.stepNumber,
          modelProvider: event.model?.provider,
          modelId: event.model?.modelId,
          toolCallId: event.toolCall.toolCallId,
          toolName: event.toolCall.toolName,
          ...summarizeToolInputForLog(event.toolCall.input),
          elapsedMs: Date.now() - startedAt,
        });
      },
      experimental_onToolCallFinish: (event) => {
        const startedAtForTool = toolCallStartedAt.get(
          event.toolCall.toolCallId,
        );
        const baseDetails = {
          stepNumber: event.stepNumber,
          modelProvider: event.model?.provider,
          modelId: event.model?.modelId,
          toolCallId: event.toolCall.toolCallId,
          toolName: event.toolCall.toolName,
          durationMs: event.durationMs,
          elapsedMs: Date.now() - startedAt,
          ...(startedAtForTool
            ? { observedToolElapsedMs: Date.now() - startedAtForTool }
            : {}),
        };

        if (event.success) {
          logAssistantChat(requestId, "ai_sdk_tool_call_finish", {
            ...baseDetails,
            success: true,
            ...summarizeToolOutputForLog(event.output),
          });
          return;
        }

        logAssistantChatError(requestId, "ai_sdk_tool_call_finish", {
          ...baseDetails,
          success: false,
          error: summarizeAssistantChatErrorForLog(event.error),
        });
      },
      onChunk: ({ chunk }) => {
        if (chunk.type === "text-delta") {
          logFirstStreamEvent("text_delta", {
            deltaLength: chunk.text.length,
          });
          return;
        }

        if (chunk.type === "reasoning-delta") {
          logFirstStreamEvent("reasoning_delta", {
            deltaLength: chunk.text.length,
          });
          return;
        }

        if (chunk.type === "tool-input-start") {
          toolCallStartedAt.set(chunk.id, Date.now());
          logAssistantChat(requestId, "stream_tool_input_start", {
            toolCallId: chunk.id,
            toolName: chunk.toolName,
            elapsedMs: Date.now() - startedAt,
          });
          return;
        }

        if (chunk.type === "tool-call") {
          toolCallStartedAt.set(chunk.toolCallId, Date.now());
          logAssistantChat(requestId, "stream_tool_call", {
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
            elapsedMs: Date.now() - startedAt,
          });
          return;
        }

        if (chunk.type === "tool-result") {
          const startedAtForTool = toolCallStartedAt.get(chunk.toolCallId);
          logAssistantChat(requestId, "stream_tool_result", {
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
            elapsedMs: Date.now() - startedAt,
            ...(startedAtForTool
              ? { toolElapsedMs: Date.now() - startedAtForTool }
              : {}),
            ...summarizeToolOutputForLog(chunk.output),
          });
          return;
        }

        logFirstStreamEvent(chunk.type);
      },
      onStepFinish: (event) => {
        logAssistantChat(requestId, "stream_step_finish", {
          finishReason: event.finishReason,
          toolCallCount: event.toolCalls.length,
          toolResultCount: event.toolResults.length,
          usage: event.usage,
          elapsedMs: Date.now() - startedAt,
        });
      },
      onFinish: (event) => {
        logAssistantChat(requestId, "stream_finish", {
          finishReason: event.finishReason,
          stepCount: event.steps.length,
          totalUsage: event.totalUsage,
          elapsedMs: Date.now() - startedAt,
        });
        return closeAiToolkit();
      },
      onError: ({ error }) => {
        logAssistantChatError(requestId, "stream_text_error", {
          ...streamErrorContext(),
          error: summarizeAssistantChatErrorForLog(error),
        });
      },
    });
    logAssistantChat(requestId, "stream_text_created", {
      elapsedMs: Date.now() - startedAt,
    });

    stage = "create_ui_message_response";
    const uiMessageStreamOptions = {
      originalMessages: validatedMessages,
      generateMessageId: createIdGenerator({
        prefix: "msg",
        size: 16,
      }),
      sendReasoning: true,
      sendSources: true,
      onError: (error) => {
        const message = formatAssistantChatStreamErrorText(
          error,
          streamErrorContext(),
        );
        logAssistantChatError(requestId, "stream_error", {
          ...streamErrorContext(),
          message,
          error: summarizeAssistantChatErrorForLog(error),
        });
        return isAssistantChatDebugEnabled()
          ? message
          : "Assistant chat failed.";
      },
      messageMetadata: ({ part }) => {
        return createAssistantChatMessageMetadata(part, {
          modelId,
          providerId: provider.id,
        });
      },
    };
    const uiMessageStream = createUIMessageStream<AssistantChatUiMessage>({
      execute: async ({ writer }) => {
        const toolNameByCallId = new Map<string, string>();
        const toolStartStatusByCallId = new Set<string>();
        const toolFinishStatusByCallId = new Set<string>();

        const writeStatus = (
          status: Omit<AssistantChatStatusData, "elapsedMs" | "requestId">,
        ) => {
          writer.write(
            createAssistantChatStatusChunk(status, {
              requestId,
              startedAt,
              providerId: provider.id,
              modelId,
            }),
          );
        };

        try {
          writeStatus({
            stage: "model-start",
            message: "正在请求模型...",
          });

          for await (const chunk of result.toUIMessageStream(uiMessageStreamOptions)) {
            if (chunk.type === "tool-input-start") {
              toolNameByCallId.set(chunk.toolCallId, chunk.toolName);
              if (!toolStartStatusByCallId.has(chunk.toolCallId)) {
                toolStartStatusByCallId.add(chunk.toolCallId);
                writeStatus({
                  stage: "tool-start",
                  message: getAssistantChatToolStatusLabel(chunk.toolName),
                  toolName: chunk.toolName,
                });
              }
              writer.write(chunk);
              continue;
            }

            if (chunk.type === "tool-input-available") {
              toolNameByCallId.set(chunk.toolCallId, chunk.toolName);
              if (!toolStartStatusByCallId.has(chunk.toolCallId)) {
                toolStartStatusByCallId.add(chunk.toolCallId);
                writeStatus({
                  stage: "tool-start",
                  message: getAssistantChatToolStatusLabel(chunk.toolName),
                  toolName: chunk.toolName,
                });
              }
              writer.write(chunk);
              continue;
            }

            if (isAssistantChatUiErrorChunk(chunk)) {
              writeStatus({
                stage: "error",
                message: "请求出错，正在整理错误信息...",
                toolName:
                  chunk.toolName ||
                  (chunk.toolCallId
                    ? toolNameByCallId.get(chunk.toolCallId)
                    : undefined),
              });
              writer.write(
                enrichAssistantChatUiErrorChunk(chunk, streamErrorContext(), {
                  toolName:
                    chunk.toolName ||
                    (chunk.toolCallId
                      ? toolNameByCallId.get(chunk.toolCallId)
                      : undefined),
                }),
              );
              continue;
            }

            if (chunk.type === "tool-output-available") {
              const toolName = toolNameByCallId.get(chunk.toolCallId);
              if (!toolFinishStatusByCallId.has(chunk.toolCallId)) {
                toolFinishStatusByCallId.add(chunk.toolCallId);
                writeStatus({
                  stage: "tool-finish",
                  message: getAssistantChatToolFinishedStatusLabel(toolName),
                  toolName,
                });
              }
            }

            writer.write(chunk);

            if (chunk.type !== "tool-output-available") continue;

            const toolName = toolNameByCallId.get(chunk.toolCallId);
            if (toolName === "webSearch") {
              const sources = extractAssistantChatWebSearchSources(chunk.output);
              if (sources.length === 0) continue;

              logAssistantChat(requestId, "search_sources_injected", {
                toolCallId: chunk.toolCallId,
                sourceCount: sources.length,
                elapsedMs: Date.now() - startedAt,
              });

              sources.forEach((source, index) => {
                writer.write({
                  type: "source-url",
                  sourceId: `${chunk.toolCallId}-source-${index + 1}`,
                  url: source.url,
                  title: source.title,
                });
              });
              continue;
            }

            if (toolName !== "searchWorkspaceKnowledge") continue;

            const sources = extractAssistantChatWorkspaceKnowledgeSources(
              chunk.output,
            );
            if (sources.length === 0) continue;

            logAssistantChat(requestId, "workspace_knowledge_sources_injected", {
              toolCallId: chunk.toolCallId,
              sourceCount: sources.length,
              elapsedMs: Date.now() - startedAt,
            });

            sources.forEach((source, index) => {
              writer.write({
                type: "source-document",
                sourceId: `${chunk.toolCallId}-source-${index + 1}`,
                mediaType: "text/markdown",
                title: source.title,
                filename: source.path,
              });
            });
          }
          writeStatus({
            stage: "complete",
            message: "回复已完成。",
          });
        } finally {
          await closeAiToolkit();
        }
      },
      onError: (error) => {
        const message = formatAssistantChatStreamErrorText(
          error,
          streamErrorContext(),
        );
        logAssistantChatError(requestId, "stream_error", {
          ...streamErrorContext(),
          message,
          error: summarizeAssistantChatErrorForLog(error),
        });
        return isAssistantChatDebugEnabled()
          ? message
          : "Assistant chat failed.";
      },
    });
    const response = createUIMessageStreamResponse({
      stream: uiMessageStream,
    });
    const resumableStreamId = createAssistantChatResumableStreamId();
    const resumableResponse = await createAssistantChatResumableResponse({
      response,
      streamId: resumableStreamId,
    });
    logAssistantChat(requestId, "resumable_stream_ready", {
      streamId: resumableStreamId,
      elapsedMs: Date.now() - startedAt,
    });

    stage = "write_response";
    await writeWebResponse(resumableResponse, res, { requestId, startedAt });
  } catch (error: any) {
    await closeAiToolkit();
    logAssistantChatError(requestId, "handler_failed", {
      stage,
      error: error?.message || "assistant_chat_failed",
      providerId: provider.id,
      elapsedMs: Date.now() - startedAt,
    });
    if (res.headersSent || res.writableEnded) {
      try {
        res.end();
      } catch {
        // ignore response finalization failures after the stream has started
      }
      return;
    }
    return res.status(500).json({
      error: "assistant_chat_failed",
      message: error?.message || "Assistant chat failed",
      providerId: provider.id,
      requestId,
      stage,
    });
  }
}
