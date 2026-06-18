import { useMemo } from "react";
import { deleteTopicMemory } from "../../../services/topic-memory";
import { getMemoryKey } from "../../../services/topicMemory/key";
import type { ChatMessage, ConversationSession, InputBlock } from "../../../types";
import { createInputBlockId } from "../../../stores/agent.store";
import {
  DEFAULT_CONVERSATION_TITLE,
  deriveConversationBranchPointLabel,
  deriveConversationBranchTitle,
  resolveActiveConversationTitle,
  resolveConversationFallback,
} from "../conversationMeta";

type UseAssistantSidebarConversationUiArgs = {
  workspaceId: string;
  conversations: ConversationSession[];
  setConversations: React.Dispatch<React.SetStateAction<ConversationSession[]>>;
  activeConversationId: string;
  setActiveConversationId: (id: string) => void;
  messages: ChatMessage[];
  clearMessages: () => void;
  setMessages: (messages: ChatMessage[]) => void;
  creationMode: "agent" | "image" | "video";
  setCreationMode: (mode: "agent" | "image" | "video") => void;
  currentInputBlocks: InputBlock[];
  setInputBlocks: (blocks: InputBlock[]) => void;
  setActiveBlockId: (id: string) => void;
  clearPendingAttachments: () => void;
  getActiveQuickSkill: () => ChatMessage["skillData"] | undefined;
  setActiveQuickSkill: (skill: ChatMessage["skillData"] | null) => void;
  closeHistoryPopover: () => void;
};

type DeleteConversationOptions = {
  deferMemoryCleanup?: boolean;
};

type SelectConversationOptions = {
  restoreComposer?: boolean;
};

type DeleteConversationResult = {
  deletedConversation: ConversationSession;
  wasActive: boolean;
};

type UpdateConversationArchiveResult = {
  conversationBeforeChange: ConversationSession;
  archived: boolean;
  wasActive: boolean;
};

export const useAssistantSidebarConversationUi = ({
  workspaceId,
  conversations,
  setConversations,
  activeConversationId,
  setActiveConversationId,
  messages,
  clearMessages,
  setMessages,
  creationMode,
  setCreationMode,
  currentInputBlocks,
  setInputBlocks,
  setActiveBlockId,
  clearPendingAttachments,
  getActiveQuickSkill,
  setActiveQuickSkill,
  closeHistoryPopover,
}: UseAssistantSidebarConversationUiArgs) => {
  const createConversationId = () =>
    `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const toMemoryKey = (conversationId: string) => {
    if (!workspaceId || !conversationId) return conversationId;
    if (conversationId.includes(":")) return conversationId;
    return getMemoryKey(workspaceId, conversationId);
  };

  const buildCurrentDraftSnapshot = () => {
    const nextBlocks = Array.isArray(currentInputBlocks)
      ? currentInputBlocks.map((block) => ({ ...block }))
      : [];
    const hasMeaningfulInput = nextBlocks.some((block) =>
      block.type === "text"
        ? Boolean(String(block.text || "").trim())
        : Boolean(block.file),
    );

    return hasMeaningfulInput
      ? {
          inputBlocks: nextBlocks,
          creationMode,
          quickSkill: getActiveQuickSkill(),
        }
      : undefined;
  };

  const persistDraftForConversation = (conversationId: string) => {
    const normalizedConversationId = String(conversationId || "").trim();
    if (!normalizedConversationId) return;
    const nextDraft = buildCurrentDraftSnapshot();
    setConversations((previous) => {
      const existingConversation = previous.find(
        (conversation) => conversation.id === normalizedConversationId,
      );

      if (!existingConversation) {
        if (!nextDraft) {
          return previous;
        }

        return [
          {
            id: normalizedConversationId,
            title: DEFAULT_CONVERSATION_TITLE,
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            autoTitle: true,
            draft: nextDraft,
          },
          ...previous,
        ];
      }

      return previous.map((conversation) =>
        conversation.id === normalizedConversationId
          ? {
              ...conversation,
              draft: nextDraft,
              updatedAt: Date.now(),
            }
          : conversation,
      );
    });
  };

  const restoreComposerState = (draft?: ConversationSession["draft"]) => {
    const textId = createInputBlockId("text");
    const restoredBlocks =
      Array.isArray(draft?.inputBlocks) && draft.inputBlocks.length > 0
        ? draft.inputBlocks.map((block, index) => ({
            ...block,
            id:
              String(block.id || "").trim() ||
              `${block.type}-${Date.now()}-${index}`,
          }))
        : [{ id: textId, type: "text" as const, text: "" }];
    clearPendingAttachments();
    setCreationMode(draft?.creationMode || "agent");
    setInputBlocks(restoredBlocks);
    const trailingTextBlock =
      [...restoredBlocks]
        .reverse()
        .find((block) => block.type === "text") || restoredBlocks[0];
    setActiveBlockId(trailingTextBlock?.id || textId);
    setActiveQuickSkill(draft?.quickSkill || null);
  };

  const handleCreateConversation = () => {
    persistDraftForConversation(activeConversationId);
    setActiveConversationId(createConversationId());
    clearMessages();
    restoreComposerState();
    closeHistoryPopover();
  };

  const handleSelectConversation = (
    conversationId: string,
    options?: SelectConversationOptions,
  ) => {
    const shouldRestoreComposer = options?.restoreComposer !== false;
    if (activeConversationId === conversationId) {
      if (shouldRestoreComposer) {
        const activeConversation = conversations.find(
          (item) => item.id === conversationId,
        );
        restoreComposerState(activeConversation?.draft);
      }
      closeHistoryPopover();
      return;
    }
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation) return;
    persistDraftForConversation(activeConversationId);
    setActiveConversationId(conversationId);
    setMessages(conversation.messages);
    if (shouldRestoreComposer) {
      restoreComposerState(conversation.draft);
    }
    closeHistoryPopover();
  };

  const handleDeleteConversation = (conversationId: string) => {
    const normalizedConversationId = String(conversationId || "").trim();
    if (!normalizedConversationId) return null;

    const targetConversation = conversations.find(
      (conversation) => conversation.id === normalizedConversationId,
    );
    if (!targetConversation) return null;

    const wasActive = activeConversationId === normalizedConversationId;
    const fallbackConversation = wasActive
      ? resolveConversationFallback({
          activeConversationId,
          conversations,
          excludeConversationId: normalizedConversationId,
          preferArchived: false,
        })
      : null;
    const updatedConversations = conversations.filter(
      (conversation) => conversation.id !== normalizedConversationId,
    );
    setConversations(updatedConversations);
    if (activeConversationId === normalizedConversationId) {
      if (fallbackConversation) {
        setActiveConversationId(fallbackConversation.id);
        setMessages(fallbackConversation.messages);
        restoreComposerState(fallbackConversation.draft);
      } else {
        setActiveConversationId(createConversationId());
        clearMessages();
        restoreComposerState();
      }
    }

    return {
      deletedConversation: targetConversation,
      wasActive,
    } satisfies DeleteConversationResult;
  };

  const handleDeleteConversationWithOptions = (
    conversationId: string,
    options?: DeleteConversationOptions,
  ) => {
    const fallbackConversation = resolveConversationFallback({
      activeConversationId,
      conversations,
      excludeConversationId: conversationId,
      preferArchived: false,
    });
    const deletionResult = handleDeleteConversation(conversationId);
    if (!deletionResult) return null;

    if (!options?.deferMemoryCleanup) {
      void deleteTopicMemory(toMemoryKey(conversationId));
    }

    return {
      ...deletionResult,
      fallbackConversation,
    };
  };

  const finalizeDeletedConversation = (conversationId: string) => {
    void deleteTopicMemory(toMemoryKey(conversationId));
  };

  const restoreConversationSnapshot = (
    conversation: ConversationSession,
    options?: {
      activate?: boolean;
    },
  ) => {
    const normalizedConversationId = String(conversation.id || "").trim();
    if (!normalizedConversationId) return;

    setConversations((previous) => {
      const existingConversation = previous.find(
        (item) => item.id === normalizedConversationId,
      );
      if (existingConversation) {
        return previous.map((item) =>
          item.id === normalizedConversationId ? conversation : item,
        );
      }

      return [conversation, ...previous];
    });

    if (options?.activate) {
      persistDraftForConversation(activeConversationId);
      setActiveConversationId(normalizedConversationId);
      setMessages(conversation.messages);
      restoreComposerState(conversation.draft);
      closeHistoryPopover();
    }
  };

  const updateConversationArchivedState = (
    conversationId: string,
    nextArchivedAt: number | undefined,
  ) => {
    const normalizedConversationId = String(conversationId || "").trim();
    if (!normalizedConversationId) return null;

    const targetConversation = conversations.find(
      (conversation) => conversation.id === normalizedConversationId,
    );
    if (!targetConversation) return null;

    const archived = typeof nextArchivedAt === "number" && nextArchivedAt > 0;
    const wasActive = activeConversationId === normalizedConversationId;
    const fallbackConversation =
      wasActive && archived
        ? resolveConversationFallback({
            activeConversationId,
            conversations,
            excludeConversationId: normalizedConversationId,
            preferArchived: false,
          })
        : null;

    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === normalizedConversationId
          ? {
              ...conversation,
              archivedAt: nextArchivedAt,
              updatedAt: Date.now(),
            }
          : conversation,
      ),
    );

    if (wasActive && archived) {
      persistDraftForConversation(normalizedConversationId);
      if (fallbackConversation) {
        setActiveConversationId(fallbackConversation.id);
        setMessages(fallbackConversation.messages);
        restoreComposerState(fallbackConversation.draft);
      } else {
        setActiveConversationId(createConversationId());
        clearMessages();
        restoreComposerState();
      }
    }

    return {
      conversationBeforeChange: targetConversation,
      archived,
      wasActive,
    } satisfies UpdateConversationArchiveResult;
  };

  const handleRenameConversation = (conversationId: string, nextTitle: string) => {
    const normalizedConversationId = String(conversationId || "").trim();
    const normalizedTitle = String(nextTitle || "").trim();
    if (!normalizedConversationId || !normalizedTitle) return;

    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === normalizedConversationId
          ? {
              ...conversation,
              title: normalizedTitle,
              updatedAt: Date.now(),
              autoTitle: false,
            }
          : conversation,
      ),
    );
    closeHistoryPopover();
  };

  const handleToggleConversationPinned = (conversationId: string) => {
    const normalizedConversationId = String(conversationId || "").trim();
    if (!normalizedConversationId) return;

    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === normalizedConversationId
          ? {
              ...conversation,
              pinned: conversation.pinned !== true,
              updatedAt: Date.now(),
            }
          : conversation,
      ),
    );
  };

  const handleToggleConversationArchived = (conversationId: string) => {
    const normalizedConversationId = String(conversationId || "").trim();
    if (!normalizedConversationId) return;

    const targetConversation = conversations.find(
      (conversation) => conversation.id === normalizedConversationId,
    );
    if (!targetConversation) return;

    return updateConversationArchivedState(
      normalizedConversationId,
      targetConversation.archivedAt ? undefined : Date.now(),
    );
  };

  const handleBranchConversationFromMessage = (message: ChatMessage) => {
    const normalizedMessageId = String(message.id || "").trim();
    if (!normalizedMessageId) return;

    const activeConversation = conversations.find(
      (conversation) => conversation.id === activeConversationId,
    );
    const sourceMessages = activeConversation?.messages || messages;
    const branchIndex = sourceMessages.findIndex(
      (item) => item.id === normalizedMessageId,
    );
    if (branchIndex === -1) return;

    const nextConversationId = createConversationId();
    const now = Date.now();
    const branchedMessages = sourceMessages.slice(0, branchIndex + 1);
    const branchPointLabel = deriveConversationBranchPointLabel(message);

    const nextConversation: ConversationSession = {
      id: nextConversationId,
      title: deriveConversationBranchTitle({
        parentTitle: activeConversation?.title,
        branchPointLabel,
      }),
      messages: branchedMessages,
      createdAt: now,
      updatedAt: now,
      autoTitle: true,
      parentConversationId: activeConversation?.id || activeConversationId,
      parentConversationTitle: activeConversation?.title || undefined,
      branchedFromMessageId: normalizedMessageId,
      branchPointLabel: branchPointLabel || undefined,
    };

    setConversations((previous) => {
      const deduped = previous.filter(
        (conversation) => conversation.id !== nextConversationId,
      );
      return [nextConversation, ...deduped];
    });
    persistDraftForConversation(activeConversationId);
    setActiveConversationId(nextConversationId);
    setMessages(branchedMessages);
    restoreComposerState();
    closeHistoryPopover();
  };

  const activeConversationTitle = useMemo(() => {
    return resolveActiveConversationTitle({
      activeConversationId,
      conversations,
    });
  }, [conversations, activeConversationId]);

  return {
    handleCreateConversation,
    handleSelectConversation,
    handleDeleteConversation: handleDeleteConversationWithOptions,
    finalizeDeletedConversation,
    restoreConversationSnapshot,
    handleRenameConversation,
    handleToggleConversationPinned,
    handleToggleConversationArchived,
    handleBranchConversationFromMessage,
    persistDraftForConversation,
    activeConversationTitle,
  };
};
