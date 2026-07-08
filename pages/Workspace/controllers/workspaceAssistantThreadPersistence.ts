import type { ConversationSession } from "../../../types/index.ts";
import { normalizeAssistantUiStorageEntryRows } from "../../../services/assistant-ui/ui-message-normalization.ts";

type PersistedAssistantThread = NonNullable<ConversationSession["assistantThread"]>;

const trimAssistantThreadId = (value: unknown): string =>
  String(value || "").trim().slice(0, 120);

export const compactAssistantThreadForPersistence = (
  thread: ConversationSession["assistantThread"] | undefined,
): PersistedAssistantThread | undefined => {
  if (!thread || typeof thread !== "object" || !Array.isArray(thread.messages)) {
    return undefined;
  }

  const messages = normalizeAssistantUiStorageEntryRows(thread.messages).map(
    (item) => ({
      ...item,
      parent_id: trimAssistantThreadId(item.parent_id) || null,
    }),
  );

  const normalizedHeadId =
    thread.headId === null ? null : trimAssistantThreadId(thread.headId) || undefined;
  const resolvedHeadId =
    normalizedHeadId && messages.some((item) => item.id === normalizedHeadId)
      ? normalizedHeadId
      : messages.at(-1)?.id ?? null;

  if (messages.length === 0 && normalizedHeadId === undefined) {
    return undefined;
  }

  return {
    headId: resolvedHeadId,
    messages,
  };
};
