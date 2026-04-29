import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { ChatMessage, ConversationSession } from "../../../types";

import {
  trimConversationMessages,
  trimConversationsForPersist,
} from './workspacePersistence';

type UseWorkspaceConversationPersistenceArgs = {
  messages: ChatMessage[];
  workspaceId: string | undefined;
  activeConversationId: string;
  projectTitle: string;
  setConversations: Dispatch<SetStateAction<ConversationSession[]>>;
};

export const useWorkspaceConversationPersistence = ({
  messages,
  workspaceId,
  activeConversationId,
  projectTitle,
  setConversations,
}: UseWorkspaceConversationPersistenceArgs) => {
  useEffect(() => {
    if (messages.length === 0 || !workspaceId) return;

    setConversations((previous) => {
      const conversationId = activeConversationId;
      if (!conversationId) return previous;

      const updated = [...previous];
      const existingIndex = updated.findIndex(
        (conversation) => conversation.id === conversationId,
      );
      const trimmedMessages = trimConversationMessages(messages);

      if (existingIndex === -1) {
        const firstUserMessage = messages.find((message) => message.role === "user");
        let title = "新对话";
        if (firstUserMessage) {
          title =
            firstUserMessage.text.slice(0, 15) +
            (firstUserMessage.text.length > 15 ? "..." : "");
        } else if (projectTitle !== "未命名") {
          title = projectTitle;
        }

        updated.push({
          id: conversationId,
          title,
          messages: trimmedMessages,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      } else {
        updated[existingIndex] = {
          ...updated[existingIndex],
          messages: trimmedMessages,
          updatedAt: Date.now(),
        };
      }

      return trimConversationsForPersist(updated);
    });
  }, [messages, workspaceId, activeConversationId, projectTitle, setConversations]);
};
