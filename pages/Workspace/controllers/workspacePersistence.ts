import type {
  CanvasElement,
  ChatMessage,
  ConversationSession,
  Marker,
  Project,
} from '../../../types';

const MAX_HISTORY_STEPS = 30;
const MAX_CONVERSATIONS = 12;
const MAX_CONVERSATION_MESSAGES = 80;
const MAX_MESSAGE_TEXT = 12000;
const MAX_ANALYSIS_TEXT = 8000;
const MAX_SUMMARY_TEXT = 4000;
const MAX_SUGGESTIONS = 12;
const MAX_IMAGE_URLS = 16;
const MAX_VIDEO_URLS = 8;
const DATA_URL_PREFIX = /^data:/i;

export type HistoryState = {
  elements: CanvasElement[];
  markers: Marker[];
};

const trimText = (value: unknown, maxLength: number): string => {
  if (typeof value !== 'string') {
    return '';
  }
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength);
};

const compactPersistedUrls = (
  items: unknown,
  maxCount: number,
): string[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    if (typeof item !== "string") {
      continue;
    }
    const normalized = trimElementUrl(item)?.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= maxCount) {
      break;
    }
  }

  return result;
};

const dedupeStrings = (items: unknown, maxCount: number): string[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    if (typeof item !== 'string') {
      continue;
    }
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= maxCount) {
      break;
    }
  }

  return result;
};

const compactInlineParts = (message: ChatMessage): ChatMessage["inlineParts"] => {
  if (!Array.isArray(message.inlineParts)) {
    return undefined;
  }

  const next = message.inlineParts
    .slice(0, 48)
    .map((part) => {
      if (!part || typeof part !== "object") {
        return null;
      }

      if (part.type === "text") {
        const text = trimText(part.text, MAX_MESSAGE_TEXT);
        return text
          ? {
              type: "text" as const,
              text,
            }
          : null;
      }

      const url = trimText(part.url, 8000);
      const label = trimText(part.label, 160);
      if (!url || !label) {
        return null;
      }

      return {
        type: "attachment" as const,
        url,
        label,
        markerInfo: part.markerInfo
          ? {
              ...part.markerInfo,
              fullImageUrl: undefined,
            }
          : undefined,
      };
    })
    .filter(Boolean) as NonNullable<ChatMessage["inlineParts"]>;

  return next.length > 0 ? next : undefined;
};

const trimChatMessage = (message: ChatMessage): ChatMessage => {
  const imageUrls = compactPersistedUrls(
    message.agentData?.imageUrls,
    MAX_IMAGE_URLS,
  );
  const videoUrls = compactPersistedUrls(
    message.agentData?.videoUrls,
    MAX_VIDEO_URLS,
  );
  const attachments = compactPersistedUrls(message.attachments, MAX_IMAGE_URLS);

  return {
    ...message,
    text: trimText(message.text, MAX_MESSAGE_TEXT),
    attachments: attachments.length > 0 ? attachments : undefined,
    attachmentMetadata: undefined,
    inlineParts: compactInlineParts(message),
    agentData: message.agentData
      ? {
          model: message.agentData.model,
          title: trimText(message.agentData.title, 120),
          description: trimText(message.agentData.description, 400),
          imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
          videoUrls: videoUrls.length > 0 ? videoUrls : undefined,
          analysis:
            trimText(message.agentData.analysis, MAX_ANALYSIS_TEXT) || undefined,
          preGenerationMessage:
            trimText(message.agentData.preGenerationMessage, MAX_SUMMARY_TEXT) ||
            undefined,
          postGenerationSummary:
            trimText(message.agentData.postGenerationSummary, MAX_SUMMARY_TEXT) ||
            undefined,
          suggestions: dedupeStrings(
            message.agentData.suggestions,
            MAX_SUGGESTIONS,
          ),
          isGenerating: message.agentData.isGenerating,
        }
      : undefined,
  };
};

export const trimConversationMessages = (
  messages: ChatMessage[],
  maxMessages: number = MAX_CONVERSATION_MESSAGES,
): ChatMessage[] => messages.slice(-maxMessages).map(trimChatMessage);

export const trimConversationsForPersist = (
  conversations: ConversationSession[],
): ConversationSession[] =>
  conversations
    .slice()
    .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0))
    .slice(0, MAX_CONVERSATIONS)
    .map((conversation) => ({
      ...conversation,
      title: trimText(conversation.title, 80) || '新对话',
      messages: trimConversationMessages(conversation.messages || []),
    }));

const trimElementUrl = (value: string | undefined): string | undefined => {
  if (!value) {
    return value;
  }
  return DATA_URL_PREFIX.test(value) ? undefined : value;
};

export const compactCanvasElement = (element: CanvasElement): CanvasElement => {
  const nextElement: CanvasElement = {
    ...element,
    url: trimElementUrl(element.url) || element.url,
    originalUrl: trimElementUrl(element.originalUrl),
    persistedOriginalUrl: trimElementUrl(element.persistedOriginalUrl) || element.persistedOriginalUrl,
    proxyUrl: trimElementUrl(element.proxyUrl),
    genRefImage: trimElementUrl(element.genRefImage),
    genRefImages: (element.genRefImages || [])
      .map(trimElementUrl)
      .filter((item): item is string => Boolean(item))
      .slice(0, MAX_IMAGE_URLS),
    genRefPreviewImage: trimElementUrl(element.genRefPreviewImage),
    genRefPreviewImages: (element.genRefPreviewImages || [])
      .map(trimElementUrl)
      .filter((item): item is string => Boolean(item))
      .slice(0, MAX_IMAGE_URLS),
    genVideoRefs: (element.genVideoRefs || [])
      .map(trimElementUrl)
      .filter((item): item is string => Boolean(item))
      .slice(0, MAX_VIDEO_URLS),
  };

  if (nextElement.genRefImages && nextElement.genRefImages.length === 0) {
    nextElement.genRefImages = undefined;
  }
  if (
    nextElement.genRefPreviewImages &&
    nextElement.genRefPreviewImages.length === 0
  ) {
    nextElement.genRefPreviewImages = undefined;
  }
  if (nextElement.genVideoRefs && nextElement.genVideoRefs.length === 0) {
    nextElement.genVideoRefs = undefined;
  }
  if (!nextElement.genRefImage && nextElement.genRefImages?.[0]) {
    nextElement.genRefImage = nextElement.genRefImages[0];
  }
  if (
    !nextElement.genRefPreviewImage &&
    nextElement.genRefPreviewImages?.[0]
  ) {
    nextElement.genRefPreviewImage = nextElement.genRefPreviewImages[0];
  }

  return nextElement;
};

export const compactElementsForHistory = (
  elements: CanvasElement[],
): CanvasElement[] => elements.map(compactCanvasElement);

export const compactHistoryState = (state: HistoryState): HistoryState => ({
  elements: compactElementsForHistory(state.elements || []),
  markers: Array.isArray(state.markers) ? [...state.markers] : [],
});

export const capHistoryLength = (history: HistoryState[]): HistoryState[] =>
  history.length <= MAX_HISTORY_STEPS
    ? history
    : history.slice(history.length - MAX_HISTORY_STEPS);

export const compactProjectForPersist = (project: Project): Project => ({
  ...project,
  thumbnail: trimElementUrl(project.thumbnail),
  elements: compactElementsForHistory(project.elements || []),
  markers: Array.isArray(project.markers) ? [...project.markers] : [],
  conversations: trimConversationsForPersist(project.conversations || []),
});
