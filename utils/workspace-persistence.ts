import type {
  CanvasElement,
  ChatMessage,
  ConversationSession,
  Marker,
  Project,
  WorkspaceMarkerInfo,
} from "../types";

export const MAX_WORKSPACE_HISTORY_STEPS = 20;
export const MAX_WORKSPACE_CONVERSATIONS = 12;
export const MAX_WORKSPACE_CONVERSATION_MESSAGES = 80;

const BLOB_URL_PREFIX = /^blob:/i;

const trimText = (value: unknown, maxLength: number): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  return value.length > maxLength ? value.slice(0, maxLength) : value;
};

const compactUrlList = (
  value: unknown,
  options: { maxItems: number; stripBlob?: boolean },
): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const next = value
    .filter((item): item is string => typeof item === "string" && item.length > 0)
    .filter((item) => !(options.stripBlob && BLOB_URL_PREFIX.test(item)))
    .slice(0, options.maxItems);

  return next.length > 0 ? next : undefined;
};

const sameStringArray = (left?: string[], right?: string[]) => {
  if (!left || !right || left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
};

const compactMarkerInfo = (
  markerInfo: WorkspaceMarkerInfo | undefined,
): WorkspaceMarkerInfo | undefined => {
  if (!markerInfo) {
    return undefined;
  }

  return {
    ...markerInfo,
    fullImageUrl: undefined,
  };
};

const compactInlineParts = (
  inlineParts: ChatMessage["inlineParts"],
): ChatMessage["inlineParts"] => {
  if (!Array.isArray(inlineParts)) {
    return undefined;
  }

  const next = inlineParts
    .slice(0, 48)
    .map((part) => {
      if (!part || typeof part !== "object") {
        return null;
      }

      if (part.type === "text") {
        const text = trimText(part.text, 4_000);
        return text
          ? {
              type: "text" as const,
              text,
            }
          : null;
      }

      const url = trimText(part.url, 8_000);
      const label = trimText(part.label, 160);
      if (!url || !label) {
        return null;
      }

      return {
        type: "attachment" as const,
        url,
        label,
        markerInfo: compactMarkerInfo(part.markerInfo),
      };
    })
    .filter(Boolean) as NonNullable<ChatMessage["inlineParts"]>;

  return next.length > 0 ? next : undefined;
};

const compactAgentData = (
  agentData: ChatMessage["agentData"],
): ChatMessage["agentData"] => {
  if (!agentData) {
    return undefined;
  }

  const imageUrls = compactUrlList(agentData.imageUrls, { maxItems: 24 });
  const videoUrls = compactUrlList(agentData.videoUrls, { maxItems: 12 });
  const proposals = Array.isArray(agentData.proposals)
    ? agentData.proposals.slice(0, 8).map((proposal) => ({
        id: proposal.id,
        title: trimText(proposal.title, 160),
        description: trimText(proposal.description, 1_200),
        prompt: trimText(proposal.prompt, 4_000),
        previewUrl: trimText(proposal.previewUrl, 8_000),
        concept_image: trimText(proposal.concept_image, 8_000),
        skillCalls: Array.isArray(proposal.skillCalls)
          ? proposal.skillCalls.slice(0, 4).map((skillCall) => ({
              skillName:
                typeof skillCall?.skillName === "string"
                  ? skillCall.skillName
                  : undefined,
              params:
                typeof skillCall?.params?.prompt === "string"
                  ? { prompt: trimText(skillCall.params.prompt, 4_000) }
                  : undefined,
            }))
          : undefined,
      }))
    : undefined;
  const skillCalls = Array.isArray(agentData.skillCalls)
    ? agentData.skillCalls.slice(0, 12).map((skillCall) => ({
        skillName:
          typeof skillCall?.skillName === "string" ? skillCall.skillName : undefined,
        success: skillCall?.success,
        description: trimText(skillCall?.description, 800),
        title: trimText(skillCall?.title, 200),
        error: trimText(skillCall?.error, 1_200),
        params:
          typeof skillCall?.params?.prompt === "string"
            ? { prompt: trimText(skillCall.params.prompt, 4_000) }
            : undefined,
      }))
    : undefined;
  const suggestions = Array.isArray(agentData.suggestions)
    ? agentData.suggestions
        .filter((item): item is string => typeof item === "string" && item.length > 0)
        .slice(0, 12)
        .map((item) => trimText(item, 280) || "")
    : undefined;

  return {
    model: trimText(agentData.model, 120),
    title: trimText(agentData.title, 160),
    description: trimText(agentData.description, 2_000),
    imageUrls,
    videoUrls,
    assets:
      Array.isArray(agentData.assets) && agentData.assets.length > 0 ? [{}] : undefined,
    proposals,
    skillCalls,
    adjustments: suggestions,
    analysis: trimText(agentData.analysis, 8_000),
    preGenerationMessage: trimText(agentData.preGenerationMessage, 2_000),
    postGenerationSummary: trimText(agentData.postGenerationSummary, 2_000),
    suggestions,
    isGenerating: agentData.isGenerating,
  };
};

export const compactCanvasElement = (element: CanvasElement): CanvasElement => {
  const genRefImages = compactUrlList(element.genRefImages, { maxItems: 12 });
  const genRefPreviewImages = compactUrlList(element.genRefPreviewImages, {
    maxItems: 12,
  });
  const hasSamePreviewSet = sameStringArray(genRefImages, genRefPreviewImages);

  return {
    ...element,
    originalUrl:
      element.originalUrl && element.originalUrl !== element.url
        ? element.originalUrl
        : undefined,
    proxyUrl:
      element.proxyUrl &&
      element.proxyUrl !== element.url &&
      element.proxyUrl !== element.originalUrl
        ? element.proxyUrl
        : undefined,
    genRefImages,
    genRefImage:
      genRefImages && genRefImages[0] && genRefImages[0] !== element.genRefImage
        ? element.genRefImage
        : undefined,
    genRefPreviewImages: hasSamePreviewSet ? undefined : genRefPreviewImages,
    genRefPreviewImage:
      !hasSamePreviewSet &&
      genRefPreviewImages &&
      genRefPreviewImages[0] &&
      genRefPreviewImages[0] !== element.genRefPreviewImage
        ? element.genRefPreviewImage
        : undefined,
  };
};

export const compactCanvasSnapshot = (
  elements: CanvasElement[],
  markers: Marker[],
): { elements: CanvasElement[]; markers: Marker[] } => ({
  elements: elements.map(compactCanvasElement),
  markers: markers.map((marker) => ({ ...marker })),
});

export const compactHistoryStack = <
  TSnapshot extends { elements: CanvasElement[]; markers: Marker[] },
>(
  history: TSnapshot[],
  nextSnapshot: TSnapshot,
  maxItems: number = MAX_WORKSPACE_HISTORY_STEPS,
): TSnapshot[] => {
  if (history.length < maxItems) {
    return [...history, nextSnapshot];
  }

  return [...history.slice(history.length - maxItems + 1), nextSnapshot];
};

export const compactConversationMessage = (message: ChatMessage): ChatMessage => ({
  ...message,
  attachments: compactUrlList(message.attachments, {
    maxItems: 12,
    stripBlob: true,
  }),
  attachmentMetadata: Array.isArray(message.attachmentMetadata)
    ? message.attachmentMetadata.slice(0, 12).map((metadata) => {
        if (!metadata || typeof metadata !== "object") {
          return metadata;
        }

        const nextMetadata = metadata as Record<string, unknown>;
        return {
          ...nextMetadata,
          markerName: trimText(nextMetadata.markerName, 160),
          markerInfo: compactMarkerInfo(
            nextMetadata.markerInfo as WorkspaceMarkerInfo | undefined,
          ),
        };
      })
    : undefined,
  inlineParts: compactInlineParts(message.inlineParts),
  agentData: compactAgentData(message.agentData),
});

export const compactConversations = (
  conversations: ConversationSession[],
): ConversationSession[] =>
  [...conversations]
    .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0))
    .slice(0, MAX_WORKSPACE_CONVERSATIONS)
    .map((conversation) => ({
      ...conversation,
      messages: conversation.messages
        .slice(-MAX_WORKSPACE_CONVERSATION_MESSAGES)
        .map(compactConversationMessage),
    }));

export const sanitizeProjectForStorage = (project: Project): Project => ({
  ...project,
  elements: Array.isArray(project.elements)
    ? project.elements.map(compactCanvasElement)
    : project.elements,
  markers: Array.isArray(project.markers)
    ? project.markers.map((marker) => ({ ...marker }))
    : project.markers,
  conversations: Array.isArray(project.conversations)
    ? compactConversations(project.conversations)
    : project.conversations,
});
