import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { createChatSession, getBestModelSelection } from "../../../services/gemini";
import { formatDate, getProject, saveProject } from "../../../services/storage";
import { useAgentStore } from "../../../stores/agent.store";
import type {
  CanvasElement,
  ChatMessage,
  ConversationSession,
  Marker,
  WorkspaceInputFile,
} from "../../../types";

import {
  compactElementsForHistory,
  trimConversationsForPersist,
  type HistoryState,
} from './workspacePersistence';
import {
  listTopicAssetsByTopicId,
  resolveStoredTopicAssetUrl,
  resolveTopicAssetRefUrl,
} from "../../../services/topic-memory";
import { getMemoryKey } from "../../../services/topicMemory/key";
import {
  createImagePreviewDataUrl,
  estimateDataUrlBytes,
  getElementDisplayUrl,
  getElementSourceUrl,
} from "../workspaceShared";
import {
  getAllNodeParentIds,
  resolveWorkspaceTreeNodeKind,
  TREE_PROMPT_PARENT_REFERENCE_LIMIT,
} from "../workspaceTreeNode";

type WorkspaceBootstrapLocationState = {
  initialPrompt?: string;
  initialAttachments?: File[];
  initialModelMode?: "thinking" | "fast";
  initialWebEnabled?: boolean;
  initialImageModel?: string;
  backgroundUrl?: string;
  backgroundType?: string;
};

type UseWorkspaceProjectLoaderArgs = {
  id: string | undefined;
  locationState: WorkspaceBootstrapLocationState | null | undefined;
  isLoadingRecordRef: MutableRefObject<boolean>;
  suspendAutoSaveUntilRef: MutableRefObject<number>;
  initialPromptProcessedRef: MutableRefObject<boolean>;
  chatSessionRef: MutableRefObject<ReturnType<typeof createChatSession> | null>;
  createConversationId: () => string;
  setElementsSynced: (elements: CanvasElement[]) => void;
  setMarkersSynced: Dispatch<SetStateAction<Marker[]>>;
  setConversations: Dispatch<SetStateAction<ConversationSession[]>>;
  setProjectTitle: Dispatch<SetStateAction<string>>;
  setHistory: Dispatch<SetStateAction<HistoryState[]>>;
  setHistoryStep: Dispatch<SetStateAction<number>>;
  setSelectedElementId: Dispatch<SetStateAction<string | null>>;
  setSelectedElementIds: Dispatch<SetStateAction<string[]>>;
  setActiveConversationId: Dispatch<SetStateAction<string>>;
  setZoom: Dispatch<SetStateAction<number>>;
  setPan: Dispatch<SetStateAction<{ x: number; y: number }>>;
  setInputBlocks: (
    blocks: Array<{
      id: string;
      type: "text" | "file";
      text?: string;
      file?: WorkspaceInputFile;
    }>,
  ) => void;
  setModelMode: (mode: "thinking" | "fast") => void;
  setWebEnabled: (enabled: boolean) => void;
  setImageModelEnabled: (enabled: boolean) => void;
  handleSend: (
    overridePrompt?: string,
    overrideAttachments?: File[],
    overrideWeb?: boolean,
    skillData?: ConversationSession["messages"][number]["skillData"],
  ) => Promise<void>;
  setElements: Dispatch<SetStateAction<CanvasElement[]>>;
};

const LOADED_IMAGE_DATA_URL_MAX_BYTES = 900 * 1024;
const LOADED_IMAGE_PREVIEW_MAX_DIM = 1600;
const LOADED_REF_DATA_URL_MAX_BYTES = 512 * 1024;
const SAFE_LOAD_CONVERSATION_LIMIT = 6;
const SAFE_LOAD_ACTIVE_MESSAGE_LIMIT = 24;
const SAFE_LOAD_TEXT_LIMIT = 4000;
const SAFE_LOAD_SUSPEND_AUTOSAVE_MS = 5000;
const DATA_URL_PREFIX = /^data:/i;
const HTTP_URL_PREFIX = /^https?:\/\//i;
const LOAD_INTERRUPTED_GENERATION_ERROR =
  "生成任务因页面刷新已中断，请重试。";

const normalizeLoadedDataUrl = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") {
    return value;
  }

  let normalized = value.trim();
  if (!normalized) {
    return normalized;
  }

  while (
    /^data:image\/[a-z0-9.+-]+;base64,data:image\//i.test(normalized)
  ) {
    const nested = normalized.match(
      /^data:image\/[a-z0-9.+-]+;base64,(data:image\/.+)$/i,
    )?.[1];
    if (!nested || nested === normalized) {
      break;
    }
    normalized = nested;
  }

  return normalized;
};

const keepSafeLoadedAssetUrl = (
  value: string | undefined,
  options?: { allowSmallDataUrl?: boolean; maxDataUrlBytes?: number },
): string | undefined => {
  const normalized = normalizeLoadedDataUrl(value);
  if (!normalized) {
    return undefined;
  }

  if (!DATA_URL_PREFIX.test(normalized)) {
    return normalized;
  }

  if (!options?.allowSmallDataUrl) {
    return undefined;
  }

  const maxBytes = options.maxDataUrlBytes ?? LOADED_IMAGE_DATA_URL_MAX_BYTES;
  return estimateDataUrlBytes(normalized) <= maxBytes ? normalized : undefined;
};

const parseElementAspectRatio = (element: CanvasElement): number | null => {
  const raw = String(element.genAspectRatio || "").trim();
  if (raw.includes(":")) {
    const [widthText, heightText] = raw.split(":");
    const width = Number(widthText);
    const height = Number(heightText);
    if (
      Number.isFinite(width) &&
      Number.isFinite(height) &&
      width > 0 &&
      height > 0
    ) {
      return width / height;
    }
  }

  if (element.width > 0 && element.height > 0) {
    return element.width / element.height;
  }

  return null;
};

const isRecoverableGeneratedImageElement = (element: CanvasElement): boolean =>
  (element.type === "image" || element.type === "gen-image") &&
  !element.originalUrl &&
  Boolean(element.url) &&
  Boolean(
    element.genPrompt ||
      element.genModel ||
      element.genProviderId ||
      element.genResolution ||
      element.genImageQuality,
  );

const collectConversationImageUrls = (
  conversations: ConversationSession[] | undefined,
): string[] => {
  if (!Array.isArray(conversations) || conversations.length === 0) {
    return [];
  }

  const urls: string[] = [];
  const seen = new Set<string>();
  const orderedConversations = [...conversations].sort(
    (left, right) => (left.createdAt || 0) - (right.createdAt || 0),
  );

  for (const conversation of orderedConversations) {
    for (const message of conversation.messages || []) {
      for (const url of message.agentData?.imageUrls || []) {
        const normalized = String(url || "").trim();
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        urls.push(normalized);
      }
    }
  }

  return urls;
};

const readImageAspectRatioFromUrl = async (
  url: string,
): Promise<number | null> =>
  new Promise((resolve) => {
    let settled = false;
    const finalize = (value: number | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const img = new Image();
    img.decoding = "async";
    if (HTTP_URL_PREFIX.test(url)) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      const width = img.naturalWidth || img.width || 0;
      const height = img.naturalHeight || img.height || 0;
      finalize(width > 0 && height > 0 ? width / height : null);
    };
    img.onerror = () => finalize(null);
    window.setTimeout(() => finalize(null), 5000);
    img.src = url;
  });

const collectTopicResultAssetUrls = async (
  workspaceId: string,
  conversations: ConversationSession[] | undefined,
): Promise<string[]> => {
  const normalizedWorkspaceId = String(workspaceId || "").trim();
  if (
    !normalizedWorkspaceId ||
    !Array.isArray(conversations) ||
    conversations.length === 0
  ) {
    return [];
  }

  const urls: string[] = [];
  const seen = new Set<string>();
  const orderedConversations = [...conversations].sort(
    (left, right) => (left.createdAt || 0) - (right.createdAt || 0),
  );

  for (const conversation of orderedConversations) {
    const conversationId = String(conversation.id || "").trim();
    if (!conversationId) continue;

    const topicId = getMemoryKey(normalizedWorkspaceId, conversationId);
    if (!topicId) continue;

    const refs = await listTopicAssetsByTopicId(topicId, {
      role: "result",
      limit: 48,
    });
    for (const ref of refs) {
      const resolvedUrl =
        String(ref.url || "").trim() || (await resolveTopicAssetRefUrl(ref)) || "";
      const normalized = String(resolvedUrl || "").trim();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      urls.push(normalized);
    }
  }

  return urls;
};

const recoverLoadedElementOriginalUrls = async ({
  workspaceId,
  elements,
  conversations,
}: {
  workspaceId: string;
  elements: CanvasElement[];
  conversations: ConversationSession[] | undefined;
}): Promise<CanvasElement[]> => {
  if (!Array.isArray(elements) || elements.length === 0) {
    return [];
  }

  const nextElements = elements.map((element) => ({ ...element }));
  const occupiedUrls = new Set<string>();

  nextElements.forEach((element) => {
    [element.originalUrl, element.proxyUrl, element.url].forEach((value) => {
      const normalized = String(value || "").trim();
      if (!normalized || DATA_URL_PREFIX.test(normalized)) return;
      occupiedUrls.add(normalized);
    });
  });

  const targetIndexes: number[] = [];
  nextElements.forEach((element, index) => {
    if (element.originalUrl) return;

    const normalizedUrl = String(element.url || "").trim();
    if (normalizedUrl && !DATA_URL_PREFIX.test(normalizedUrl)) {
      element.originalUrl = normalizedUrl;
      occupiedUrls.add(normalizedUrl);
      return;
    }

    if (isRecoverableGeneratedImageElement(element)) {
      targetIndexes.push(index);
    }
  });

  if (targetIndexes.length === 0) {
    return nextElements;
  }

  const messageUrls = collectConversationImageUrls(conversations);
  const topicAssetUrls = await collectTopicResultAssetUrls(
    workspaceId,
    conversations,
  );
  const candidateUrls = [...new Set([...messageUrls, ...topicAssetUrls])]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => !occupiedUrls.has(value));

  if (candidateUrls.length === 0) {
    return nextElements;
  }

  const shouldMeasureAspect =
    targetIndexes.length > 1 && candidateUrls.length > 1;
  const candidateRatios = shouldMeasureAspect
    ? await Promise.all(
        candidateUrls.map(async (url) => ({
          url,
          ratio: await readImageAspectRatioFromUrl(url),
        })),
      )
    : candidateUrls.map((url) => ({ url, ratio: null as number | null }));

  const usedCandidates = new Set<string>();

  for (const targetIndex of targetIndexes) {
    const element = nextElements[targetIndex];
    const targetRatio = parseElementAspectRatio(element);

    let selectedCandidate:
      | {
          url: string;
          ratio: number | null;
        }
      | undefined;

    if (targetRatio !== null) {
      selectedCandidate = candidateRatios
        .filter((candidate) => !usedCandidates.has(candidate.url))
        .sort((left, right) => {
          const leftDiff =
            left.ratio === null
              ? Number.POSITIVE_INFINITY
              : Math.abs(left.ratio - targetRatio);
          const rightDiff =
            right.ratio === null
              ? Number.POSITIVE_INFINITY
              : Math.abs(right.ratio - targetRatio);
          return leftDiff - rightDiff;
        })[0];
    }

    if (!selectedCandidate) {
      selectedCandidate = candidateRatios.find(
        (candidate) => !usedCandidates.has(candidate.url),
      );
    }

    if (!selectedCandidate) {
      break;
    }

    usedCandidates.add(selectedCandidate.url);
    nextElements[targetIndex] = {
      ...element,
      originalUrl: selectedCandidate.url,
      proxyUrl:
        element.proxyUrl ||
        (element.url && element.url !== selectedCandidate.url
          ? element.url
          : undefined),
    };
  }

  return nextElements;
};

const trimLoadText = (value: unknown, maxLength: number): string => {
  if (typeof value !== "string") {
    return "";
  }
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength);
};

const sanitizeLoadedMessage = (message: ChatMessage): ChatMessage => ({
  id: message.id,
  role: message.role,
  text: trimLoadText(message.text, SAFE_LOAD_TEXT_LIMIT),
  kind: message.kind,
  timestamp: message.timestamp,
  error: message.error,
  relatedMarkerId: message.relatedMarkerId,
  agentData: message.agentData
    ? {
        model: message.agentData.model,
        title: trimLoadText(message.agentData.title, 120) || undefined,
        description: trimLoadText(message.agentData.description, 240) || undefined,
        analysis: trimLoadText(message.agentData.analysis, 800) || undefined,
        preGenerationMessage:
          trimLoadText(message.agentData.preGenerationMessage, 600) || undefined,
        postGenerationSummary:
          trimLoadText(message.agentData.postGenerationSummary, 600) || undefined,
        suggestions: Array.isArray(message.agentData.suggestions)
          ? message.agentData.suggestions
              .filter((item): item is string => typeof item === "string")
              .slice(0, 4)
              .map((item) => trimLoadText(item, 80))
          : [],
        isGenerating: false,
      }
    : undefined,
});

const clearLoadedMessageGeneratingState = (
  message: ChatMessage,
): ChatMessage =>
  message.agentData?.isGenerating
    ? {
        ...message,
        agentData: {
          ...message.agentData,
          isGenerating: false,
        },
      }
    : message;

const resolveLoadedTreePromptReferenceState = (
  elements: CanvasElement[],
  parentIds: string[],
): {
  hasImageParents: boolean;
  genRefImages?: string[];
  genRefImage?: string;
  genRefPreviewImages?: string[];
  genRefPreviewImage?: string;
} => {
  const sourceRefs: string[] = [];
  const previewRefs: string[] = [];
  let hasImageParents = false;

  for (const currentParentId of parentIds) {
    const currentParent =
      elements.find((element) => element.id === currentParentId) || null;

    if (resolveWorkspaceTreeNodeKind(currentParent) !== "image") {
      continue;
    }

    hasImageParents = true;

    const sourceRef = (getElementSourceUrl(currentParent) || "").trim();
    if (!sourceRef) {
      continue;
    }

    sourceRefs.push(sourceRef);

    const previewRef =
      (getElementDisplayUrl(currentParent) || sourceRef).trim() || sourceRef;
    previewRefs.push(previewRef);

    if (sourceRefs.length >= TREE_PROMPT_PARENT_REFERENCE_LIMIT) {
      break;
    }
  }

  return {
    hasImageParents,
    genRefImages: sourceRefs.length > 0 ? sourceRefs : undefined,
    genRefImage: sourceRefs[0],
    genRefPreviewImages: previewRefs.length > 0 ? previewRefs : undefined,
    genRefPreviewImage: previewRefs[0],
  };
};

const reconcileLoadedElements = (
  elements: CanvasElement[],
): CanvasElement[] =>
  elements.map((element) => {
    let nextElement = element;

    if (element.isGenerating) {
      nextElement = {
        ...nextElement,
        isGenerating: false,
        generatingType: undefined,
        genError:
          nextElement.genError || LOAD_INTERRUPTED_GENERATION_ERROR,
      };
    }

    if (resolveWorkspaceTreeNodeKind(nextElement) !== "prompt") {
      return nextElement;
    }

    const parentIds = getAllNodeParentIds(nextElement);
    if (parentIds.length === 0) {
      return nextElement;
    }

    const nextReferenceState = resolveLoadedTreePromptReferenceState(
      elements,
      parentIds,
    );

    if (!nextReferenceState.hasImageParents) {
      return nextElement;
    }

    return {
      ...nextElement,
      genRefImages: nextReferenceState.genRefImages,
      genRefImage: nextReferenceState.genRefImage,
      genRefPreviewImages: nextReferenceState.genRefPreviewImages,
      genRefPreviewImage: nextReferenceState.genRefPreviewImage,
    };
  });

const estimateConversationMessageCount = (
  conversations: ConversationSession[] | undefined,
): number =>
  Array.isArray(conversations)
    ? conversations.reduce(
        (sum, conversation) => sum + (conversation.messages?.length || 0),
        0,
      )
    : 0;

const estimateElementPayloadBytes = (
  elements: CanvasElement[] | undefined,
): number => {
  if (!Array.isArray(elements) || elements.length === 0) {
    return 0;
  }

  let totalBytes = 0;
  for (const element of elements) {
    totalBytes += estimateDataUrlBytes(element.url);
    totalBytes += estimateDataUrlBytes(element.originalUrl);
    totalBytes += estimateDataUrlBytes(element.proxyUrl);
    totalBytes += estimateDataUrlBytes(element.genRefImage);
    totalBytes += estimateDataUrlBytes(element.genRefPreviewImage);
    totalBytes += estimateDataUrlBytes(element.genStartFrame);
    totalBytes += estimateDataUrlBytes(element.genEndFrame);

    if (Array.isArray(element.genRefImages)) {
      for (const item of element.genRefImages) {
        totalBytes += estimateDataUrlBytes(item);
      }
    }
    if (Array.isArray(element.genRefPreviewImages)) {
      for (const item of element.genRefPreviewImages) {
        totalBytes += estimateDataUrlBytes(item);
      }
    }
    if (Array.isArray(element.genVideoRefs)) {
      for (const item of element.genVideoRefs) {
        totalBytes += estimateDataUrlBytes(item);
      }
    }
  }

  return totalBytes;
};

const shouldUseSafeProjectLoad = (project: {
  elements?: CanvasElement[];
  conversations?: ConversationSession[];
}): boolean => {
  const elementCount = project.elements?.length || 0;
  const messageCount = estimateConversationMessageCount(project.conversations);
  const payloadBytes = estimateElementPayloadBytes(project.elements);

  return (
    payloadBytes > 2 * 1024 * 1024 ||
    elementCount > 120 ||
    messageCount > 40
  );
};

const buildLoadedConversations = (
  conversations: ConversationSession[] | undefined,
  safeMode: boolean,
): {
  conversations: ConversationSession[];
  activeConversationId: string | null;
} => {
  const trimmedConversations = trimConversationsForPersist(conversations || []);
  if (trimmedConversations.length === 0) {
    return { conversations: [], activeConversationId: null };
  }

  const orderedConversations = [...trimmedConversations].sort(
    (left, right) => (right.updatedAt || 0) - (left.updatedAt || 0),
  );
  const activeConversationId = orderedConversations[0]?.id || null;

  if (!safeMode) {
    return {
      conversations: trimmedConversations.map((conversation) => ({
        ...conversation,
        messages: (conversation.messages || []).map(
          clearLoadedMessageGeneratingState,
        ),
      })),
      activeConversationId,
    };
  }

  const safeConversations = orderedConversations
    .slice(0, SAFE_LOAD_CONVERSATION_LIMIT)
    .map((conversation) => ({
      ...conversation,
      messages:
        conversation.id === activeConversationId
          ? conversation.messages
              .slice(-SAFE_LOAD_ACTIVE_MESSAGE_LIMIT)
              .map(sanitizeLoadedMessage)
          : [],
    }));

  return {
    conversations: safeConversations,
    activeConversationId,
  };
};

const buildInitialHistoryElements = (
  elements: CanvasElement[],
  safeMode: boolean,
): CanvasElement[] => {
  if (!safeMode) {
    return elements;
  }

  return elements.map((element) => ({
    ...element,
    // Safe-load should keep the original source chain intact for preview/download.
    // We only trim render-facing proxy/reference payloads here.
    originalUrl: normalizeLoadedDataUrl(element.originalUrl),
    proxyUrl: keepSafeLoadedAssetUrl(element.proxyUrl, {
      allowSmallDataUrl: true,
    }),
    genRefImage: undefined,
    genRefImages: undefined,
    genRefPreviewImage: undefined,
    genRefPreviewImages: undefined,
    genVideoRefs: undefined,
  }));
};

const buildRuntimeLoadedElements = (
  elements: CanvasElement[],
  safeMode: boolean,
): CanvasElement[] => {
  if (!safeMode) {
    return elements;
  }

  return elements.map((element) => ({
    ...element,
    // Keep the original asset available after reload so zoom preview and
    // downloads do not silently fall back to the compressed display proxy.
    originalUrl: normalizeLoadedDataUrl(element.originalUrl),
    proxyUrl: keepSafeLoadedAssetUrl(element.proxyUrl, {
      allowSmallDataUrl: true,
    }),
    genRefImage: undefined,
    genRefImages: undefined,
    genStartFrame: undefined,
    genEndFrame: undefined,
    genVideoRefs: undefined,
  }));
};

const shrinkLoadedDataUrl = async (
  value: string | undefined,
  maxBytes: number,
  maxDim: number,
): Promise<string | undefined> => {
  if (!value || !DATA_URL_PREFIX.test(value)) {
    return value;
  }

  if (estimateDataUrlBytes(value) <= maxBytes) {
    return value;
  }

  try {
    const preview = await createImagePreviewDataUrl(value, maxDim, 0.8);
    return preview.length < value.length ? preview : value;
  } catch {
    return value;
  }
};

const sanitizeLoadedElement = async (
  element: CanvasElement,
): Promise<CanvasElement> => {
  const nextElement: CanvasElement = { ...element };
  nextElement.persistedOriginalUrl =
    typeof nextElement.persistedOriginalUrl === "string"
      ? nextElement.persistedOriginalUrl.trim() || undefined
      : nextElement.persistedOriginalUrl;

  const resolvedStoredOriginalUrl = await resolveStoredTopicAssetUrl(
    nextElement.originalUrl || nextElement.persistedOriginalUrl,
  );
  nextElement.url = normalizeLoadedDataUrl(nextElement.url);
  nextElement.originalUrl = normalizeLoadedDataUrl(
    resolvedStoredOriginalUrl || nextElement.originalUrl,
  );
  nextElement.proxyUrl = normalizeLoadedDataUrl(nextElement.proxyUrl);
  nextElement.genRefImage = normalizeLoadedDataUrl(nextElement.genRefImage);
  nextElement.genRefPreviewImage = normalizeLoadedDataUrl(
    nextElement.genRefPreviewImage,
  );
  nextElement.genStartFrame = normalizeLoadedDataUrl(nextElement.genStartFrame);
  nextElement.genEndFrame = normalizeLoadedDataUrl(nextElement.genEndFrame);
  nextElement.genRefImages = Array.isArray(nextElement.genRefImages)
    ? nextElement.genRefImages.map(normalizeLoadedDataUrl).filter(Boolean) as string[]
    : nextElement.genRefImages;
  nextElement.genRefPreviewImages = Array.isArray(nextElement.genRefPreviewImages)
    ? nextElement.genRefPreviewImages
        .map(normalizeLoadedDataUrl)
        .filter(Boolean) as string[]
    : nextElement.genRefPreviewImages;
  nextElement.genVideoRefs = Array.isArray(nextElement.genVideoRefs)
    ? nextElement.genVideoRefs.map(normalizeLoadedDataUrl).filter(Boolean) as string[]
    : nextElement.genVideoRefs;

  const nextDisplayUrl = await shrinkLoadedDataUrl(
    nextElement.proxyUrl || nextElement.url,
    LOADED_IMAGE_DATA_URL_MAX_BYTES,
    LOADED_IMAGE_PREVIEW_MAX_DIM,
  );

  if (nextDisplayUrl) {
    nextElement.url = nextDisplayUrl;
    nextElement.proxyUrl =
      nextElement.originalUrl && nextDisplayUrl !== nextElement.originalUrl
        ? nextDisplayUrl
        : undefined;
  }

  // Keep the recovered original source even when it is a large data URL.
  // The render-facing `url/proxyUrl` chain is already shrunk separately; dropping
  // `originalUrl` here would cause preview/download to fall back to the proxy.

  if (nextElement.genRefImage) {
    nextElement.genRefImage =
      (await shrinkLoadedDataUrl(
        nextElement.genRefImage,
        LOADED_REF_DATA_URL_MAX_BYTES,
        1280,
      )) || nextElement.genRefImage;
  }

  if (Array.isArray(nextElement.genRefImages) && nextElement.genRefImages.length > 0) {
    const nextImages: string[] = [];
    for (const item of nextElement.genRefImages) {
      nextImages.push(
        (await shrinkLoadedDataUrl(
          item,
          LOADED_REF_DATA_URL_MAX_BYTES,
          1280,
        )) || item,
      );
    }
    nextElement.genRefImages = nextImages;
  }

  if (Array.isArray(nextElement.genRefPreviewImages) && nextElement.genRefPreviewImages.length > 0) {
    const nextPreviewImages: string[] = [];
    for (const item of nextElement.genRefPreviewImages) {
      nextPreviewImages.push(
        (await shrinkLoadedDataUrl(item, 180 * 1024, 320)) || item,
      );
    }
    nextElement.genRefPreviewImages = nextPreviewImages;
  }

  if (nextElement.genRefPreviewImage) {
    nextElement.genRefPreviewImage =
      (await shrinkLoadedDataUrl(nextElement.genRefPreviewImage, 180 * 1024, 320)) ||
      nextElement.genRefPreviewImage;
  }

  return nextElement;
};

const sanitizeLoadedElements = async (
  elements: CanvasElement[] | undefined,
): Promise<CanvasElement[]> => {
  if (!Array.isArray(elements) || elements.length === 0) {
    return [];
  }

  const nextElements: CanvasElement[] = [];
  for (const element of elements) {
    nextElements.push(await sanitizeLoadedElement(element));
  }
  return nextElements;
};

export const useWorkspaceProjectLoader = ({
  id,
  locationState,
  isLoadingRecordRef,
  suspendAutoSaveUntilRef,
  initialPromptProcessedRef,
  chatSessionRef,
  createConversationId,
  setElementsSynced,
  setMarkersSynced,
  setConversations,
  setProjectTitle,
  setHistory,
  setHistoryStep,
  setSelectedElementId,
  setSelectedElementIds,
  setActiveConversationId,
  setZoom,
  setPan,
  setInputBlocks,
  setModelMode,
  setWebEnabled,
  setImageModelEnabled,
  handleSend,
  setElements,
}: UseWorkspaceProjectLoaderArgs) => {
  useEffect(() => {
    let cancelled = false;

    if (id) {
      const loadProject = async () => {
        isLoadingRecordRef.current = true;
        suspendAutoSaveUntilRef.current =
          Date.now() + SAFE_LOAD_SUSPEND_AUTOSAVE_MS;
        console.log("[Workspace] Loading project:", id);

        setElementsSynced([]);
        setMarkersSynced([]);
        setConversations([]);
        setProjectTitle("Untitled");
        setHistory([{ elements: [], markers: [] }]);
        setHistoryStep(0);
        setSelectedElementId(null);
        setSelectedElementIds([]);
        setActiveConversationId("");
        setZoom(100);
        setPan({ x: 0, y: 0 });

        useAgentStore.getState().actions.reset();

        try {
          const project = await getProject(id);
          if (cancelled) {
            return;
          }
          if (project) {
            console.log("[Workspace] Project found, restoring state");
            const safeLoadMode = shouldUseSafeProjectLoad(project);
            if (safeLoadMode) {
              console.warn("[Workspace] Safe load mode enabled for heavy project");
            }
            const sanitizedElements = await sanitizeLoadedElements(project.elements);
            const recoveredElements = await recoverLoadedElementOriginalUrls({
              workspaceId: id,
              elements: sanitizedElements,
              conversations: project.conversations,
            });
            if (cancelled) {
              return;
            }
            const runtimeElements = reconcileLoadedElements(
              buildRuntimeLoadedElements(
                recoveredElements,
                safeLoadMode,
              ),
            );
            if (runtimeElements.length > 0) {
              setElementsSynced(runtimeElements);
            }
            if (project.title) setProjectTitle(project.title);
            if (project.conversations && project.conversations.length > 0) {
              const loadedConversationState = buildLoadedConversations(
                project.conversations,
                safeLoadMode,
              );
              setConversations(loadedConversationState.conversations);
              const activeConversation = loadedConversationState.conversations.find(
                (conversation) =>
                  conversation.id === loadedConversationState.activeConversationId,
              );
              if (activeConversation) {
                setActiveConversationId(activeConversation.id);
                useAgentStore
                  .getState()
                  .actions.setMessages(activeConversation.messages || []);
              }
            } else {
              setActiveConversationId(createConversationId());
            }
            setHistory([
              {
                elements: buildInitialHistoryElements(
                  runtimeElements.length > 0
                    ? runtimeElements
                    : compactElementsForHistory(recoveredElements || []),
                  safeLoadMode,
                ),
                markers: [],
              },
            ]);
            setHistoryStep(0);
          } else {
            console.log("[Workspace] New project, saving initial record");
            setZoom(100);
            setPan({ x: 0, y: 0 });
            await saveProject({
              id,
              title: "Untitled",
              updatedAt: formatDate(Date.now()),
              elements: [],
              markers: [],
              thumbnail: "",
              conversations: [],
            });
          }
        } catch (error) {
          if (!cancelled) {
            console.error("[Workspace] Load failed:", error);
          }
        } finally {
          setTimeout(() => {
            if (cancelled) {
              return;
            }
            isLoadingRecordRef.current = false;
            suspendAutoSaveUntilRef.current =
              Date.now() + SAFE_LOAD_SUSPEND_AUTOSAVE_MS;
            console.log("[Workspace] Load complete, persistence enabled");
          }, 300);
        }
      };

      void loadProject();
    }

    if (locationState?.initialPrompt || locationState?.initialAttachments) {
      if (!initialPromptProcessedRef.current) {
        initialPromptProcessedRef.current = true;
        const blocks: Array<{
          id: string;
          type: "text" | "file";
          text?: string;
          file?: File;
        }> = [];

        if (locationState.initialAttachments) {
          locationState.initialAttachments.forEach((file, index) => {
            blocks.push({
              id: `file-${Date.now()}-${index}`,
              type: "file",
              file,
            });
            blocks.push({
              id: `text-${Date.now()}-${index}`,
              type: "text",
              text: "",
            });
          });
        }

        if (locationState.initialPrompt) {
          if (blocks.length > 0 && blocks[blocks.length - 1].type === "text") {
            blocks[blocks.length - 1].text = locationState.initialPrompt;
          } else {
            blocks.push({
              id: `text-${Date.now()}`,
              type: "text",
              text: locationState.initialPrompt,
            });
          }
        }

        if (blocks.length === 0) {
          blocks.push({ id: "init", type: "text", text: "" });
        }

        setInputBlocks(blocks);

        if (locationState.initialModelMode) {
          setModelMode(locationState.initialModelMode);
        }
        if (locationState.initialWebEnabled) {
          setWebEnabled(locationState.initialWebEnabled);
        }
        if (locationState.initialImageModel) {
          setImageModelEnabled(true);
        }

        void handleSend(
          locationState.initialPrompt,
          locationState.initialAttachments,
          locationState.initialWebEnabled,
        );
      }
    }

    if (locationState?.backgroundUrl) {
      const type =
        locationState.backgroundType === "video" ? "video" : "image";
      const url = locationState.backgroundUrl;
      const containerWidth = window.innerWidth - 400;
      const containerHeight = window.innerHeight;
      const newElement: CanvasElement = {
        id: Date.now().toString(),
        type,
        url,
        x: containerWidth / 2 - 200,
        y: containerHeight / 2 - 150,
        width: 400,
        height: 300,
        zIndex: 1,
      };

      setElements((previous) => {
        const next = [...previous, newElement];
        setHistory([{ elements: next, markers: [] }]);
        return next;
      });
    }

    if (!chatSessionRef.current) {
      const selectedModel = getBestModelSelection("text");
      chatSessionRef.current = createChatSession(
        selectedModel.modelId,
        [],
        undefined,
        selectedModel.providerId,
      );
    }

    return () => {
      cancelled = true;
    };
  }, [id]);
};

