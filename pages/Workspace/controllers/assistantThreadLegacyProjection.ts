import type { UIMessage } from "ai";
import type { ChatMessage, ConversationSession } from "../../../types/index.ts";
import {
  countAssistantThreadRoots,
  getAssistantThreadVisibleUiMessages,
} from "./assistantThreadRepository.ts";

const getUiMessageText = (message: UIMessage): string =>
  message.parts
    .flatMap((part) => {
      if (part.type !== "text") {
        return [];
      }
      const text = String(part.text || "").trim();
      return text ? [text] : [];
    })
    .join("\n")
    .trim();

const getUiMessageAttachments = (message: UIMessage): string[] => {
  const seen = new Set<string>();
  const attachments: string[] = [];

  for (const part of message.parts) {
    if (part.type !== "file") {
      continue;
    }
    const url = String(part.url || "").trim();
    if (!url || seen.has(url)) {
      continue;
    }
    seen.add(url);
    attachments.push(url);
  }

  return attachments;
};

const toLegacyChatMessage = (message: UIMessage, index: number): ChatMessage => {
  const attachments = getUiMessageAttachments(message);
  return {
    id: String(message.id || `assistant-thread-${index + 1}`),
    role: message.role === "user" ? "user" : "model",
    text: getUiMessageText(message),
    ...(attachments.length > 0 ? { attachments } : {}),
    timestamp: index + 1,
  };
};

const getAssistantThreadVisibleLegacyMessages = (
  thread: ConversationSession["assistantThread"] | undefined,
): ChatMessage[] =>
  getAssistantThreadVisibleUiMessages(thread).map(toLegacyChatMessage);

const getStoredConversationMessages = (
  messages: ConversationSession["messages"] | undefined,
): ChatMessage[] => (Array.isArray(messages) ? messages : []);

const countAssistantReplies = (messages: ChatMessage[]): number =>
  messages.filter((message) => message.role === "model").length;

const countUserMessages = (messages: ChatMessage[]): number =>
  messages.filter((message) => message.role === "user").length;

const shouldPreferStoredConversationMessages = (conversation: {
  assistantThread?: ConversationSession["assistantThread"];
  messages?: ConversationSession["messages"];
}): boolean => {
  const storedMessages = getStoredConversationMessages(conversation.messages);
  if (storedMessages.length === 0) {
    return false;
  }

  const threadMessages = getAssistantThreadVisibleLegacyMessages(
    conversation.assistantThread,
  );
  if (threadMessages.length === 0) {
    return true;
  }

  const threadAssistantCount = countAssistantReplies(threadMessages);
  const storedAssistantCount = countAssistantReplies(storedMessages);
  const threadUserCount = countUserMessages(threadMessages);
  const storedUserCount = countUserMessages(storedMessages);
  const rootCount = countAssistantThreadRoots(conversation.assistantThread);
  const threadLastId = String(threadMessages.at(-1)?.id || "").trim();
  const storedLastId = String(storedMessages.at(-1)?.id || "").trim();
  const sharesLatestMessage = Boolean(
    threadLastId && storedLastId && threadLastId === storedLastId,
  );

  if (storedAssistantCount > 0 && threadAssistantCount === 0) {
    return true;
  }

  if (sharesLatestMessage && threadMessages.length < storedMessages.length) {
    return true;
  }

  if (
    sharesLatestMessage &&
    storedMessages[0]?.role === "user" &&
    threadMessages[0]?.role !== "user"
  ) {
    return true;
  }

  if (sharesLatestMessage && storedUserCount > threadUserCount) {
    return true;
  }

  if (
    rootCount > 1 &&
    storedMessages.length >= threadMessages.length &&
    storedAssistantCount >= threadAssistantCount
  ) {
    return true;
  }

  if (
    threadMessages.length < storedMessages.length &&
    storedAssistantCount > threadAssistantCount
  ) {
    return true;
  }

  return false;
};

export const getConversationVisibleMessages = (conversation: {
  messages?: ConversationSession["messages"];
  assistantThread?: ConversationSession["assistantThread"];
}): ChatMessage[] => {
  const fallbackMessages = getStoredConversationMessages(conversation.messages);
  const threadMessages = getAssistantThreadVisibleLegacyMessages(
    conversation.assistantThread,
  );

  if (
    threadMessages.length > 0 &&
    !shouldPreferStoredConversationMessages(conversation)
  ) {
    return threadMessages;
  }

  return fallbackMessages;
};
