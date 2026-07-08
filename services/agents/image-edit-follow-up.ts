import type { ChatMessage } from '../../types/common.ts';

const normalizeText = (value: unknown) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

export const IMAGE_EDIT_SIGNAL_RE =
  /(?:\u4fee\u6539|\u66ff\u6362|\u7f16\u8f91|\u53bb\u6389|\u62ff\u6389|\u5220\u6389|\u79fb\u9664|\u53bb\u9664|\u6362\u6210|\u6539\u6210|\u6539\u4e3a|\u8c03\u6574|remove|replace|edit|change|recolor|upscale)/i;

export const CONTEXTUAL_EDIT_FOLLOW_UP_RE =
  /(?:\u4e0d\u8981|\u53bb\u6389|\u62ff\u6389|\u5220\u6389|\u79fb\u9664|\u53bb\u9664|\u6362\u6210|\u6539\u6210|\u6539\u4e3a|\u4fdd\u7559|\u52a0\u4e0a|\u52a0\u4e2a|\u6362\u4e2a|\u53d8\u6210|\u8c03\u6210|\u5f31\u4e00\u70b9|\u5f3a\u4e00\u70b9|\u5c11\u4e00\u70b9|\u591a\u4e00\u70b9|\u4e0d\u8981\u6709|without|remove|drop|delete|replace|change|turn it into|make it)/i;

export const REFERENCE_ONLY_EDIT_CONTINUATION_RE =
  /(?:\u5c31\u6539\u4e0a\u4e00\u5f20(?:\u56fe)?|\u6539\u4e0a\u4e00\u5f20(?:\u56fe)?|\u57fa\u4e8e\u4e0a\u4e00\u5f20(?:\u56fe)?|\u6309\u4e0a\u4e00\u5f20(?:\u56fe)?|\u7ee7\u7eed\u6539(?:\u4e0a\u4e00\u5f20)?|edit (?:the )?(?:previous|last)(?: image| one)?|use (?:the )?(?:previous|last) image|same image|that one)/i;

export const isReferenceOnlyEditContinuationText = (message: string) => {
  const text = normalizeText(message);
  if (!text) return false;
  return REFERENCE_ONLY_EDIT_CONTINUATION_RE.test(text);
};

export const isExplicitImageEditInstructionText = (message: string) => {
  const text = normalizeText(message);
  if (!text) return false;
  return IMAGE_EDIT_SIGNAL_RE.test(text) || CONTEXTUAL_EDIT_FOLLOW_UP_RE.test(text);
};

export const extractLatestImageEditInstruction = (
  history: ChatMessage[] | undefined,
  options?: { excludeMessage?: string; maxMessages?: number },
): string | null => {
  const recentMessages = Array.isArray(history)
    ? history.slice(-(options?.maxMessages || 8)).reverse()
    : [];
  const excluded = normalizeText(options?.excludeMessage);

  for (const message of recentMessages) {
    if (message?.role !== 'user') continue;
    const text = normalizeText(message.text);
    if (!text || text === excluded) continue;
    if (!isExplicitImageEditInstructionText(text)) continue;
    if (isReferenceOnlyEditContinuationText(text)) continue;
    return text;
  }

  return null;
};

export const resolveFollowUpImageEditInstruction = ({
  message,
  conversationHistory,
}: {
  message: string;
  conversationHistory?: ChatMessage[];
}) => {
  const text = normalizeText(message);
  if (!text) return '';
  if (!isReferenceOnlyEditContinuationText(text)) {
    return text;
  }
  return (
    extractLatestImageEditInstruction(conversationHistory, {
      excludeMessage: text,
    }) || text
  );
};
