import {
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { ChatMessage, ConversationSession, InputBlock } from "../../../types";

import {
  sanitizeQuickSkillForPersistence,
  trimConversationMessages,
  trimConversationsForPersist,
} from "./workspacePersistence.ts";
import {
  DEFAULT_CONVERSATION_TITLE,
  deriveConversationTitle,
  deriveDraftPreview,
} from "../conversationMeta.ts";

type UseWorkspaceConversationPersistenceArgs = {
  workspaceId: string | undefined;
  activeConversationId: string;
  projectTitle: string;
  currentInputBlocks: InputBlock[];
  creationMode: "agent" | "image" | "video";
  modelMode: "thinking" | "fast";
  webEnabled: boolean;
  isLoadingRecordRef?: MutableRefObject<boolean>;
  suspendAutoSaveUntilRef?: MutableRefObject<number>;
  setConversations: Dispatch<SetStateAction<ConversationSession[]>>;
};

const normalizeInputBlocksForSignature = (blocks: InputBlock[] | undefined) =>
  Array.isArray(blocks)
    ? blocks.map((block) => {
        if (block.type === "text") {
          return {
            type: "text" as const,
            text: String(block.text || ""),
          };
        }

        const file = block.file;
        return {
          type: "file" as const,
          file: file
            ? {
                name: String(file.name || ""),
                type: String(file.type || ""),
                lastModified: Number(file.lastModified || 0),
                markerId: String(file.markerId || ""),
                markerName: String(file.markerName || ""),
                attachmentId: String(file._attachmentId || ""),
                canvasElId: String(file._canvasElId || ""),
                chipPreviewUrl: String(file._chipPreviewUrl || ""),
                autoInsert: file._canvasAutoInsert === true,
              }
            : null,
        };
      })
    : [];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const sortForStableSignature = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortForStableSignature);
  }

  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortForStableSignature(value[key]);
        return acc;
      }, {});
  }

  return value;
};

const buildConversationPersistenceSignature = (args: {
  title: string;
  autoTitle?: boolean;
  messages: ChatMessage[];
  draft?: ConversationSession["draft"];
}) =>
  JSON.stringify(
    sortForStableSignature({
      title: String(args.title || ""),
      autoTitle: args.autoTitle !== false,
      messages: trimConversationMessages(args.messages || []),
      draft: args.draft
        ? {
            creationMode: args.draft.creationMode,
            modelMode: args.draft.modelMode,
            webEnabled: args.draft.webEnabled === true,
            quickSkill: sanitizeQuickSkillForPersistence(args.draft.quickSkill),
            inputBlocks: normalizeInputBlocksForSignature(args.draft.inputBlocks),
          }
        : null,
    }),
  );

export const useWorkspaceConversationPersistence = ({
  workspaceId,
  activeConversationId,
  projectTitle,
  currentInputBlocks,
  creationMode,
  modelMode,
  webEnabled,
  isLoadingRecordRef,
  suspendAutoSaveUntilRef,
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

  const persistFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActiveConversationIdRef = useRef(activeConversationId);

  useEffect(() => {
    return () => {
      if (persistFlushTimerRef.current) {
        clearTimeout(persistFlushTimerRef.current);
        persistFlushTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    if (isLoadingRecordRef?.current) return;
    if (
      suspendAutoSaveUntilRef?.current &&
      Date.now() < suspendAutoSaveUntilRef.current
    ) {
      return;
    }

    const conversationChanged =
      lastActiveConversationIdRef.current !== activeConversationId;

    const runPersist = () => {
      persistFlushTimerRef.current = null;
      lastActiveConversationIdRef.current = activeConversationId;

      setConversations((previous) => {
        const conversationId = String(activeConversationId || "").trim();
        if (!conversationId) return previous;
        if (previous.length === 0) {
          return previous;
        }

        const updated = [...previous];
        const existingIndex = updated.findIndex(
          (conversation) => conversation.id === conversationId,
        );
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
          modelMode !== "fast" || webEnabled;
        const hasDraft = hasDraftContent || hasNonDefaultPreferences;
        const nextDraft = hasDraft
          ? {
              inputBlocks: draftInputBlocks,
              creationMode,
              modelMode,
              webEnabled,
            }
          : undefined;
        const existingConversation =
          existingIndex >= 0 ? updated[existingIndex] : undefined;
        const nextStoredMessages = Array.isArray(existingConversation?.messages)
          ? [...existingConversation.messages]
          : [];
        const shouldRefreshTitle =
          existingConversation?.assistantThread?.messages?.length
            ? !String(existingConversation.title || "").trim()
            : existingConversation?.autoTitle !== false ||
              !String(existingConversation?.title || "").trim();

        if (existingIndex === -1) {
          updated.push({
            id: conversationId,
            title: derivePersistedConversationTitle(
              nextStoredMessages,
              projectTitle,
              nextDraft,
            ),
            messages: nextStoredMessages,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            autoTitle: true,
            draft: nextDraft,
          });
        } else {
          const nextTitle = shouldRefreshTitle
            ? derivePersistedConversationTitle(
                nextStoredMessages,
                projectTitle,
                nextDraft,
              )
            : existingConversation.title;
          const nextAutoTitle = shouldRefreshTitle
            ? true
            : existingConversation.autoTitle;
          const existingSignature = buildConversationPersistenceSignature({
            title: existingConversation.title,
            autoTitle: existingConversation.autoTitle,
            messages: existingConversation.messages || [],
            draft: existingConversation.draft,
          });
          const nextSignature = buildConversationPersistenceSignature({
            title: nextTitle,
            autoTitle: nextAutoTitle,
            messages: nextStoredMessages,
            draft: nextDraft,
          });

          if (existingSignature === nextSignature) {
            return previous;
          }

          updated[existingIndex] = {
            ...existingConversation,
            ...(shouldRefreshTitle
              ? {
                  title: nextTitle,
                  autoTitle: true,
                }
              : {}),
            messages: nextStoredMessages,
            draft: nextDraft,
            updatedAt: Date.now(),
          };
        }

        return trimConversationsForPersist(updated);
      });
    };

    if (conversationChanged) {
      if (persistFlushTimerRef.current) {
        clearTimeout(persistFlushTimerRef.current);
        persistFlushTimerRef.current = null;
      }
      runPersist();
      return;
    }

    if (persistFlushTimerRef.current) {
      clearTimeout(persistFlushTimerRef.current);
    }
    persistFlushTimerRef.current = setTimeout(runPersist, 300);

    return () => {
      // keep pending timer; we want the latest snapshot to flush eventually
    };
  }, [
    workspaceId,
    activeConversationId,
    projectTitle,
    currentInputBlocks,
    creationMode,
    modelMode,
    webEnabled,
    isLoadingRecordRef,
    suspendAutoSaveUntilRef,
    setConversations,
  ]);
};
