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
  createImagePreviewDataUrl,
  estimateDataUrlBytes,
  getElementDisplayUrl,
  getElementSourceUrl,
} from "../workspaceShared";
import {
  getAllNodeParentIds,
  resolveWorkspaceTreeNodeKind,
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
  const seenSourceRefs = new Set<string>();
  let hasImageParents = false;

  for (const currentParentId of parentIds) {
    const currentParent =
      elements.find((element) => element.id === currentParentId) || null;

    if (resolveWorkspaceTreeNodeKind(currentParent) !== "image") {
      continue;
    }

    hasImageParents = true;

    const sourceRef = (getElementSourceUrl(currentParent) || "").trim();
    if (!sourceRef || seenSourceRefs.has(sourceRef)) {
      continue;
    }

    seenSourceRefs.add(sourceRef);
    sourceRefs.push(sourceRef);

    const previewRef =
      (getElementDisplayUrl(currentParent) || sourceRef).trim() || sourceRef;
    previewRefs.push(previewRef);

    if (sourceRefs.length >= 6) {
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
    originalUrl: undefined,
    proxyUrl: undefined,
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
    originalUrl: undefined,
    proxyUrl: undefined,
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
  nextElement.url = normalizeLoadedDataUrl(nextElement.url);
  nextElement.originalUrl = normalizeLoadedDataUrl(nextElement.originalUrl);
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

  if (
    nextElement.originalUrl &&
    DATA_URL_PREFIX.test(nextElement.originalUrl) &&
    estimateDataUrlBytes(nextElement.originalUrl) > LOADED_IMAGE_DATA_URL_MAX_BYTES
  ) {
    nextElement.originalUrl = undefined;
  }

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
        setProjectTitle("未命名");
        setHistory([{ elements: [], markers: [] }]);
        setHistoryStep(0);
        setSelectedElementId(null);
        setSelectedElementIds([]);
        setActiveConversationId("");

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
            if (cancelled) {
              return;
            }
            const runtimeElements = reconcileLoadedElements(
              buildRuntimeLoadedElements(
                sanitizedElements,
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
                    : compactElementsForHistory(project.elements || []),
                  safeLoadMode,
                ),
                markers: [],
              },
            ]);
            setHistoryStep(0);
          } else {
            console.log("[Workspace] New project, saving initial record");
            await saveProject({
              id,
              title: "未命名",
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
