import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { ChatMessage, ConversationSession, InputBlock } from "../../../types";

import {
  trimConversationMessages,
  trimConversationsForPersist,
} from "./workspacePersistence";
import {
  DEFAULT_CONVERSATION_TITLE,
  deriveConversationTitle,
  deriveDraftPreview,
} from "../conversationMeta";

type UseWorkspaceConversationPersistenceArgs = {
  messages: ChatMessage[];
  workspaceId: string | undefined;
  activeConversationId: string;
  projectTitle: string;
  currentInputBlocks: InputBlock[];
  creationMode: "agent" | "image" | "video";
  activeQuickSkill?: ChatMessage["skillData"];
  modelMode: "thinking" | "fast";
  webEnabled: boolean;
  setConversations: Dispatch<SetStateAction<ConversationSession[]>>;
};

export const useWorkspaceConversationPersistence = ({
  messages,
  workspaceId,
  activeConversationId,
  projectTitle,
  currentInputBlocks,
  creationMode,
  activeQuickSkill,
  modelMode,
  webEnabled,
  setConversations,
}: UseWorkspaceConversationPersistenceArgs) => {
  const derivePersistedConversationTitle = (
    nextMessages: ChatMessage[],
    nextProjectTitle: string,
    nextDraft:
      | {
          inputBlocks: InputBlock[];
          creationMode: "agent" | "image" | "video";
          quickSkill?: ChatMessage["skillData"];
          modelMode?: "thinking" | "fast";
          webEnabled?: boolean;
        }
      | undefined,
  ) => {
    const draftTitle = deriveDraftPreview(nextDraft);
    if (draftTitle) return draftTitle;

    const title = deriveConversationTitle(nextMessages, nextProjectTitle);
    return title === "未命名项目" ? DEFAULT_CONVERSATION_TITLE : title;
  };

  useEffect(() => {
    if (!workspaceId) return;

    setConversations((previous) => {
      const conversationId = String(activeConversationId || "").trim();
      if (!conversationId) return previous;

      const updated = [...previous];
      const existingIndex = updated.findIndex(
        (conversation) => conversation.id === conversationId,
      );
      const trimmedMessages = trimConversationMessages(messages);
      const draftInputBlocks = Array.isArray(currentInputBlocks)
        ? currentInputBlocks.map((block) => ({ ...block }))
        : [];
      const hasDraftContent =
        draftInputBlocks.length > 0 &&
        draftInputBlocks.some((block) =>
          block.type === "text"
            ? Boolean(String(block.text || "").trim())
            : Boolean(block.file),
        );
      const hasNonDefaultPreferences =
        modelMode !== "fast" || webEnabled || Boolean(activeQuickSkill);
      const hasDraft = hasDraftContent || hasNonDefaultPreferences;
      const nextDraft = hasDraft
        ? {
            inputBlocks: draftInputBlocks,
            creationMode,
            quickSkill: activeQuickSkill,
            modelMode,
            webEnabled,
          }
        : undefined;

      if (existingIndex === -1) {
        updated.push({
          id: conversationId,
          title: derivePersistedConversationTitle(
            messages,
            projectTitle,
            nextDraft,
          ),
          messages: trimmedMessages,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          autoTitle: true,
          draft: nextDraft,
        });
      } else {
        const existingConversation = updated[existingIndex];
        const shouldRefreshTitle =
          existingConversation.autoTitle !== false ||
          !String(existingConversation.title || "").trim();

        updated[existingIndex] = {
          ...existingConversation,
          ...(shouldRefreshTitle
            ? {
                title: derivePersistedConversationTitle(
                  messages,
                  projectTitle,
                  nextDraft,
                ),
                autoTitle: true,
              }
            : {}),
          messages: trimmedMessages,
          draft: nextDraft,
          updatedAt: Date.now(),
        };
      }

      return trimConversationsForPersist(updated);
    });
  }, [
    messages,
    workspaceId,
    activeConversationId,
    projectTitle,
    currentInputBlocks,
    creationMode,
    activeQuickSkill,
    modelMode,
    webEnabled,
    setConversations,
  ]);
};
