import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import { getMemoryKey } from '../../../services/topicMemory/key';

type UseWorkspaceConversationSessionArgs = {
  workspaceId: string | undefined;
  activeConversationId: string;
  setActiveConversationId: Dispatch<SetStateAction<string>>;
  setActiveClothingSession: (topicId: string) => void;
  setActiveEcommerceSession?: (topicId: string) => void;
};

export const useWorkspaceConversationSession = ({
  workspaceId,
  activeConversationId,
  setActiveConversationId,
  setActiveClothingSession,
  setActiveEcommerceSession,
}: UseWorkspaceConversationSessionArgs) => {
  const createConversationId = useCallback(
    () => `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    [],
  );

  const getCurrentConversationId = useCallback(
    () => String(activeConversationId || '').trim(),
    [activeConversationId],
  );

  const buildMemoryKey = useCallback(
    (conversationId: string) => {
      const normalizedWorkspaceId = String(workspaceId || '').trim();
      const normalizedConversationId = String(conversationId || '').trim();
      if (!normalizedWorkspaceId || !normalizedConversationId) return '';
      return getMemoryKey(normalizedWorkspaceId, normalizedConversationId);
    },
    [workspaceId],
  );

  const currentTopicId = useMemo(
    () => buildMemoryKey(getCurrentConversationId()),
    [buildMemoryKey, getCurrentConversationId],
  );

  const getCurrentTopicId = useCallback(() => currentTopicId, [currentTopicId]);

  const ensureConversationId = useCallback(() => {
    const existingConversationId = getCurrentConversationId();
    if (existingConversationId) return existingConversationId;
    const nextConversationId = createConversationId();
    setActiveConversationId(nextConversationId);
    return nextConversationId;
  }, [createConversationId, getCurrentConversationId, setActiveConversationId]);

  const ensureTopicId = useCallback(
    () => buildMemoryKey(ensureConversationId()),
    [buildMemoryKey, ensureConversationId],
  );

  const ensureClothingSession = useCallback(() => {
    const topicId = ensureTopicId();
    if (topicId) {
      setActiveClothingSession(topicId);
    }
    return topicId;
  }, [ensureTopicId, setActiveClothingSession]);

  const ensureEcommerceSession = useCallback(() => {
    const topicId = ensureTopicId();
    if (topicId && setActiveEcommerceSession) {
      setActiveEcommerceSession(topicId);
    }
    return topicId;
  }, [ensureTopicId, setActiveEcommerceSession]);

  return {
    createConversationId,
    getCurrentConversationId,
    buildMemoryKey,
    currentTopicId,
    getCurrentTopicId,
    ensureConversationId,
    ensureTopicId,
    ensureClothingSession,
    ensureEcommerceSession,
  };
};
