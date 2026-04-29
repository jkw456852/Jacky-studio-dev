import { useMemo } from 'react';
import { deleteTopicMemory } from '../../../services/topic-memory';
import { getMemoryKey } from '../../../services/topicMemory/key';
import type { ChatMessage, ConversationSession } from '../../../types';

type UseAssistantSidebarConversationUiArgs = {
  workspaceId: string;
  conversations: ConversationSession[];
  setConversations: React.Dispatch<React.SetStateAction<ConversationSession[]>>;
  activeConversationId: string;
  setActiveConversationId: (id: string) => void;
  messages: ChatMessage[];
  clearMessages: () => void;
  setMessages: (messages: ChatMessage[]) => void;
  setPrompt: (prompt: string) => void;
  setCreationMode: (mode: 'agent' | 'image' | 'video') => void;
  resetActiveQuickSkill: () => void;
  closeHistoryPopover: () => void;
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
  setPrompt,
  setCreationMode,
  resetActiveQuickSkill,
  closeHistoryPopover,
}: UseAssistantSidebarConversationUiArgs) => {
  const createConversationId = () =>
    `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const toMemoryKey = (conversationId: string) => {
    if (!workspaceId || !conversationId) return conversationId;
    if (conversationId.includes(':')) return conversationId;
    return getMemoryKey(workspaceId, conversationId);
  };

  const handleCreateConversation = () => {
    setActiveConversationId(createConversationId());
    clearMessages();
    setPrompt('');
    setCreationMode('agent');
    resetActiveQuickSkill();
    closeHistoryPopover();
  };

  const handleSelectConversation = (conversationId: string) => {
    if (activeConversationId === conversationId) return;
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation) return;
    setActiveConversationId(conversationId);
    setMessages(conversation.messages);
    closeHistoryPopover();
  };

  const handleDeleteConversation = (conversationId: string) => {
    const updatedConversations = conversations.filter(
      (conversation) => conversation.id !== conversationId,
    );
    setConversations(updatedConversations);
    void deleteTopicMemory(toMemoryKey(conversationId));
    if (activeConversationId === conversationId) {
      setActiveConversationId(createConversationId());
      clearMessages();
    }
  };

  const activeConversationTitle = useMemo(() => {
    if (messages.length === 0) return '新对话';
    return (
      conversations.find((conversation) => conversation.id === activeConversationId)?.title ||
      '对话中'
    );
  }, [messages.length, conversations, activeConversationId]);

  return {
    handleCreateConversation,
    handleSelectConversation,
    handleDeleteConversation,
    activeConversationTitle,
  };
};
