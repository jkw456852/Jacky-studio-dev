import type { ChatMessage, ConversationSession } from "../../../types/index.ts";

const hasAssistantThreadMessages = (
  conversation: ConversationSession | undefined,
): boolean =>
  Array.isArray(conversation?.assistantThread?.messages) &&
  conversation.assistantThread.messages.length > 0;

const getStoredConversationMessages = (
  conversation: ConversationSession | undefined,
): ChatMessage[] =>
  Array.isArray(conversation?.messages)
    ? [...conversation.messages]
    : [];

export const resolveLegacyConversationMessagesForPersistence = (args: {
  existingConversation: ConversationSession | undefined;
  nextLegacyMessages: ChatMessage[];
  legacyMessagesChanged: boolean;
  conversationChanged: boolean;
}): ChatMessage[] => {
  const {
    existingConversation,
    nextLegacyMessages,
    legacyMessagesChanged,
    conversationChanged,
  } = args;

  if (
    !legacyMessagesChanged ||
    conversationChanged ||
    hasAssistantThreadMessages(existingConversation)
  ) {
    return getStoredConversationMessages(existingConversation);
  }

  return [...nextLegacyMessages];
};
