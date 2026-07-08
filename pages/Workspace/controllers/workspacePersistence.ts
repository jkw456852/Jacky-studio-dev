import type {
  CanvasElement,
  ChatMessage,
  ConversationSession,
  InputBlock,
  Marker,
  Project,
  WorkspaceInputFile,
} from '../../../types';
import {
  getRenderableImageAssetUrl,
  sanitizePersistableAttachmentPreviewUrl,
} from '../workspaceShared';
import { compactAssistantThreadForPersistence } from "./workspaceAssistantThreadPersistence.ts";

const MAX_HISTORY_STEPS = 30;
const MAX_CONVERSATION_MESSAGES = 80;
const MAX_MESSAGE_TEXT = 12000;
const MAX_ANALYSIS_TEXT = 8000;
const MAX_SUMMARY_TEXT = 4000;
const MAX_SUGGESTIONS = 12;
const MAX_IMAGE_URLS = 16;
const MAX_VIDEO_URLS = 8;
const DATA_URL_PREFIX = /^data:/i;
const MAX_PROGRESS_LOG_ITEMS = 24;
const MAX_DRAFT_INPUT_BLOCKS = 24;
const MAX_QUICK_SKILL_CONFIG_TEXT = 4000;
const MAX_QUICK_SKILL_CONFIG_DEPTH = 6;

const QUICK_SKILL_CONFIG_VOLATILE_KEYS = new Set([
  'createdAt',
  'updatedAt',
  'lastUsedAt',
  'lastSuccessfulAt',
  'distilledAt',
  'markdownAssetUpdatedAt',
]);

type PersistedExecutionTrace = NonNullable<
  NonNullable<ChatMessage["agentData"]>["executionTrace"]
>;
type PersistedResearch = NonNullable<
  NonNullable<ChatMessage["agentData"]>["research"]
>;
type PersistedBrowserSession = NonNullable<
  NonNullable<ChatMessage["agentData"]>["browserSession"]
>;
type PersistedSkillCall = NonNullable<
  NonNullable<ChatMessage["agentData"]>["skillCalls"]
>[number];
type PersistedProposal = NonNullable<
  NonNullable<ChatMessage["agentData"]>["proposals"]
>[number];

export type HistoryState = {
  elements: CanvasElement[];
  markers: Marker[];
};

const trimText = (value: unknown, maxLength: number): string => {
  if (typeof value !== 'string') {
    return '';
  }
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength);
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const shouldDropQuickSkillConfigKey = (key: string): boolean =>
  QUICK_SKILL_CONFIG_VOLATILE_KEYS.has(key) ||
  key.endsWith('UpdatedAt') ||
  key.endsWith('CreatedAt');

const sanitizeQuickSkillConfigValue = (
  value: unknown,
  depth = 0,
): unknown => {
  if (depth > MAX_QUICK_SKILL_CONFIG_DEPTH) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const next = value
      .map((item) => sanitizeQuickSkillConfigValue(item, depth + 1))
      .filter((item) => item !== undefined);
    return next.length > 0 ? next : undefined;
  }

  if (isPlainObject(value)) {
    const next = Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        if (shouldDropQuickSkillConfigKey(key)) {
          return acc;
        }
        const sanitized = sanitizeQuickSkillConfigValue(value[key], depth + 1);
        if (sanitized !== undefined) {
          acc[key] = sanitized;
        }
        return acc;
      }, {});

    return Object.keys(next).length > 0 ? next : undefined;
  }

  if (typeof value === 'string') {
    const text = trimText(value, MAX_QUICK_SKILL_CONFIG_TEXT).trim();
    return text || undefined;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return undefined;
};

export const sanitizeQuickSkillForPersistence = (
  skill: ChatMessage['skillData'] | null | undefined,
): ChatMessage['skillData'] | undefined => {
  if (
    !skill ||
    !trimText(skill.id, 120) ||
    !trimText(skill.name, 120) ||
    !trimText(skill.iconName, 120)
  ) {
    return undefined;
  }

  const sanitizedConfig = sanitizeQuickSkillConfigValue(skill.config);

  return {
    id: trimText(skill.id, 120),
    pluginId: trimText(skill.pluginId, 120) || undefined,
    name: trimText(skill.name, 120),
    iconName: trimText(skill.iconName, 120),
    ...(isPlainObject(sanitizedConfig) ? { config: sanitizedConfig } : {}),
  };
};

const compactPersistedUrls = (
  items: unknown,
  maxCount: number,
): string[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    if (typeof item !== "string") {
      continue;
    }
    const normalized = trimElementUrl(item)?.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= maxCount) {
      break;
    }
  }

  return result;
};

const dedupeStrings = (items: unknown, maxCount: number): string[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    if (typeof item !== 'string') {
      continue;
    }
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= maxCount) {
      break;
    }
  }

  return result;
};

const compactExecutionTrace = (
  trace: ChatMessage["agentData"] | undefined extends never
    ? never
    : ChatMessage["agentData"] extends infer AgentData
      ? AgentData extends { executionTrace?: infer Trace }
        ? Trace
        : never
      : never,
): PersistedExecutionTrace | undefined => {
  if (!trace || typeof trace !== "object") {
    return undefined;
  }

  const normalizedProgressLog = Array.isArray(trace.progressLog)
    ? trace.progressLog
        .filter((item): item is string => typeof item === "string")
        .map((item) => trimText(item, 280))
        .filter(Boolean)
        .slice(-MAX_PROGRESS_LOG_ITEMS)
    : [];
  const normalizedThoughtTrace = Array.isArray((trace as any).thoughtTrace)
    ? (trace as any).thoughtTrace
        .filter((item: unknown): item is string => typeof item === "string")
        .map((item: string) => trimText(item, 280))
        .filter(Boolean)
        .slice(-MAX_PROGRESS_LOG_ITEMS)
    : normalizedProgressLog;

  const nextTrace = {
    status:
      trace.status === "analyzing" ||
      trace.status === "executing" ||
      trace.status === "completed" ||
      trace.status === "failed"
        ? trace.status
        : undefined,
    progressMessage: trimText(trace.progressMessage, 240) || undefined,
    progressStep:
      typeof trace.progressStep === "number" ? trace.progressStep : undefined,
    totalSteps:
      typeof trace.totalSteps === "number" ? trace.totalSteps : undefined,
    progressLog:
      normalizedProgressLog.length > 0 ? normalizedProgressLog : undefined,
    thoughtTrace:
      normalizedThoughtTrace.length > 0 ? normalizedThoughtTrace : undefined,
    stopReason: trimText(trace.stopReason, 80) || undefined,
    stopReasonLabel: trimText(trace.stopReasonLabel, 80) || undefined,
    errorCode: trimText(trace.errorCode, 80) || undefined,
    errorMessage: trimText(trace.errorMessage, 240) || undefined,
  };

  return Object.values(nextTrace).some((value) => value !== undefined)
    ? nextTrace
    : undefined;
};

const compactPresentation = (
  presentation: NonNullable<ChatMessage["agentData"]>["presentation"],
) => {
  if (!presentation || typeof presentation !== "object") {
    return undefined;
  }

  const nextPresentation = {
    kind:
      presentation.kind === "default" ||
      presentation.kind === "execution_plan" ||
      presentation.kind === "execution_record" ||
      presentation.kind === "research"
        ? presentation.kind
        : undefined,
    statusLabel: trimText(presentation.statusLabel, 80) || undefined,
    modeLabel: trimText(presentation.modeLabel, 80) || undefined,
    detailTitle: trimText(presentation.detailTitle, 120) || undefined,
    detailNotice: trimText(presentation.detailNotice, 320) || undefined,
  };

  return Object.values(nextPresentation).some((value) => value !== undefined)
    ? nextPresentation
    : undefined;
};

const compactResearch = (
  research: NonNullable<ChatMessage["agentData"]>["research"],
): PersistedResearch | undefined => {
  if (!research || typeof research !== "object") {
    return undefined;
  }

  const citations = Array.isArray(research.citations)
    ? research.citations
        .slice(0, 8)
        .map((item) =>
          item && typeof item === "object"
            ? {
                title: trimText(item.title, 160),
                url: trimText(item.url, 400),
                host: trimText(item.host, 120) || undefined,
                siteName: trimText(item.siteName, 120) || undefined,
                snippet: trimText(item.snippet, 280) || undefined,
                excerpt: trimText(item.excerpt, 360) || undefined,
              }
            : null,
        )
        .filter((item) => Boolean(item?.title) && Boolean(item?.url))
    : [];

  const extractedPages = Array.isArray(research.extractedPages)
    ? research.extractedPages
        .slice(0, 6)
        .map((item) =>
          item && typeof item === "object"
            ? {
                title: trimText(item.title, 160),
                url: trimText(item.url, 400),
                excerpt: trimText(item.excerpt, 320) || undefined,
                cleanedTextExcerpt:
                  trimText(item.cleanedTextExcerpt, 520) || undefined,
                length:
                  typeof item.length === "number" ? item.length : undefined,
                error: trimText(item.error, 200) || undefined,
              }
            : null,
        )
        .filter((item) => Boolean(item?.title) && Boolean(item?.url))
    : [];

  const nextResearch = {
    status:
      research.status === "searching" ||
      research.status === "completed" ||
      research.status === "failed"
        ? research.status
        : undefined,
    mode:
      research.mode === "web" ||
      research.mode === "images" ||
      research.mode === "web+images"
        ? research.mode
        : undefined,
    query: trimText(research.query, 240) || undefined,
    summary: trimText(research.summary, 320) || undefined,
    providerLabel: trimText(research.providerLabel, 120) || undefined,
    fallback: research.fallback === true ? true : undefined,
    webCount:
      typeof research.webCount === "number" ? research.webCount : undefined,
    imageCount:
      typeof research.imageCount === "number" ? research.imageCount : undefined,
    extractedCount:
      typeof research.extractedCount === "number"
        ? research.extractedCount
        : undefined,
    citations: citations.length > 0 ? citations : undefined,
    extractedPages: extractedPages.length > 0 ? extractedPages : undefined,
    suggestedQueries: dedupeStrings(research.suggestedQueries, 6),
  };

  return Object.values(nextResearch).some((value) => value !== undefined)
    ? nextResearch
    : undefined;
};

const compactBrowserSession = (
  browserSession: NonNullable<ChatMessage["agentData"]>["browserSession"],
): PersistedBrowserSession | undefined => {
  if (!browserSession || typeof browserSession !== "object") {
    return undefined;
  }

  const steps = Array.isArray(browserSession.steps)
    ? browserSession.steps
        .slice(0, 24)
        .map((step) =>
          step && typeof step === "object"
            ? {
                id: trimText(step.id, 80),
                title: trimText(step.title, 160),
                status: trimText(step.status, 40),
                statusLabel: trimText(step.statusLabel, 80) || undefined,
                kind:
                  step.kind === "tool" || step.kind === "host_action"
                    ? step.kind
                    : "tool",
                actionLabel: trimText(step.actionLabel, 120) || undefined,
                summary: trimText(step.summary, 240) || undefined,
                error: trimText(step.error, 240) || undefined,
                inputSummary: dedupeStrings(step.inputSummary, 6),
                resultSummary: dedupeStrings(step.resultSummary, 6),
                media: Array.isArray(step.media)
                  ? step.media
                      .slice(0, 6)
                      .map((item) =>
                        item && typeof item === "object"
                          ? {
                              url: trimText(item.url, 400),
                              title: trimText(item.title, 120),
                              subtitle:
                                trimText(item.subtitle, 160) || undefined,
                            }
                          : null,
                      )
                      .filter((item) => Boolean(item?.url) && Boolean(item?.title))
                  : undefined,
              }
            : null,
        )
        .filter((step) => Boolean(step?.id) && Boolean(step?.title))
    : [];

  const nextBrowserSession = {
    sessionId: trimText(browserSession.sessionId, 120),
    status: trimText(browserSession.status, 40),
    statusLabel: trimText(browserSession.statusLabel, 80) || undefined,
    title: trimText(browserSession.title, 160) || undefined,
    summary: trimText(browserSession.summary, 280) || undefined,
    diagnosisSummary:
      trimText(browserSession.diagnosisSummary, 240) || undefined,
    repairSummary: trimText(browserSession.repairSummary, 240) || undefined,
    repairNotes: dedupeStrings(browserSession.repairNotes, 6),
    diagnosisIssues: dedupeStrings(browserSession.diagnosisIssues, 6),
    currentStepTitle:
      trimText(browserSession.currentStepTitle, 160) || undefined,
    targetElementId:
      trimText(browserSession.targetElementId, 120) || undefined,
    targetElementLabel:
      trimText(browserSession.targetElementLabel, 160) || undefined,
    stepStats:
      browserSession.stepStats && typeof browserSession.stepStats === "object"
        ? {
            total:
              typeof browserSession.stepStats.total === "number"
                ? browserSession.stepStats.total
                : 0,
            completed:
              typeof browserSession.stepStats.completed === "number"
                ? browserSession.stepStats.completed
                : 0,
            failed:
              typeof browserSession.stepStats.failed === "number"
                ? browserSession.stepStats.failed
                : 0,
            running:
              typeof browserSession.stepStats.running === "number"
                ? browserSession.stepStats.running
                : 0,
            pending:
              typeof browserSession.stepStats.pending === "number"
                ? browserSession.stepStats.pending
                : 0,
          }
        : undefined,
    steps: steps.length > 0 ? steps : undefined,
  };

  return nextBrowserSession.sessionId && nextBrowserSession.status
    ? nextBrowserSession
    : undefined;
};

const compactSkillCalls = (
  skillCalls: NonNullable<ChatMessage["agentData"]>["skillCalls"],
): PersistedSkillCall[] | undefined => {
  if (!Array.isArray(skillCalls)) {
    return undefined;
  }

  const next = skillCalls
    .slice(0, 12)
    .map((call) =>
      call && typeof call === "object"
        ? {
            skillName: trimText(call.skillName, 80),
            toolCallId: trimText(call.toolCallId, 120) || undefined,
            success:
              typeof call.success === "boolean" ? call.success : undefined,
            description: trimText(call.description, 200) || undefined,
            title: trimText(call.title, 120) || undefined,
            error: trimText(call.error, 240) || undefined,
            result:
              call.result !== undefined
                ? call.result
                : undefined,
            artifact:
              call.artifact !== undefined
                ? call.artifact
                : undefined,
            modelContent:
              call.modelContent !== undefined
                ? call.modelContent
                : undefined,
          }
        : null,
    )
    .filter((item) => Boolean(item?.skillName)) as PersistedSkillCall[];

  return next.length > 0 ? next : undefined;
};

const compactProposals = (
  proposals: NonNullable<ChatMessage["agentData"]>["proposals"],
): PersistedProposal[] | undefined => {
  if (!Array.isArray(proposals)) {
    return undefined;
  }

  const next = proposals
    .slice(0, 8)
    .map((proposal, index) =>
      proposal && typeof proposal === "object"
        ? {
            id: trimText(proposal.id, 120) || `proposal-${index}`,
            title: trimText(proposal.title, 160) || undefined,
            description: trimText(proposal.description, 320) || undefined,
            prompt: trimText(proposal.prompt, 1200) || undefined,
            previewUrl: trimElementUrl(trimText(proposal.previewUrl, 400)),
            concept_image: trimElementUrl(
              trimText(proposal.concept_image, 400),
            ),
            skillCalls: Array.isArray(proposal.skillCalls)
              ? proposal.skillCalls
                  .slice(0, 4)
                  .map((call) =>
                    call && typeof call === "object"
                      ? {
                          skillName: trimText(call.skillName, 80),
                          params:
                            call.params && typeof call.params === "object"
                              ? call.params
                              : undefined,
                        }
                      : null,
                  )
                  .filter((item) => Boolean(item?.skillName))
              : undefined,
          }
        : null,
    )
    .filter((item) => Boolean(item?.id)) as PersistedProposal[];

  return next.length > 0 ? next : undefined;
};

const compactInlineParts = (message: ChatMessage): ChatMessage["inlineParts"] => {
  if (!Array.isArray(message.inlineParts)) {
    return undefined;
  }

  const next = message.inlineParts
    .slice(0, 48)
    .map((part) => {
      if (!part || typeof part !== "object") {
        return null;
      }

      if (part.type === "text") {
        const text = trimText(part.text, MAX_MESSAGE_TEXT);
        return text
          ? {
              type: "text" as const,
              text,
            }
          : null;
      }

      const url = sanitizePersistableAttachmentPreviewUrl(part.url);
      const label = trimText(part.label, 160);
      if (!url || !label) {
        return null;
      }

      return {
        type: "attachment" as const,
        url,
        label,
        markerInfo: part.markerInfo
          ? {
              ...part.markerInfo,
              fullImageUrl: undefined,
            }
          : undefined,
      };
    })
    .filter(Boolean) as NonNullable<ChatMessage["inlineParts"]>;

  return next.length > 0 ? next : undefined;
};

const compactDraftInputBlocks = (
  blocks: unknown,
): InputBlock[] | undefined => {
  if (!Array.isArray(blocks)) {
    return undefined;
  }

  const nextBlocks = blocks
    .slice(0, MAX_DRAFT_INPUT_BLOCKS)
    .map((block, index) => {
      if (!block || typeof block !== "object") {
        return null;
      }

      const rawBlock = block as InputBlock;
      const normalizedId =
        trimText(rawBlock.id, 120) || `draft-block-${Date.now()}-${index}`;

      if (rawBlock.type === "text") {
        const text = trimText(rawBlock.text, MAX_MESSAGE_TEXT);
        return {
          id: normalizedId,
          type: "text" as const,
          text,
        };
      }

      if (rawBlock.type !== "file" || !rawBlock.file) {
        return null;
      }

      const file = rawBlock.file as WorkspaceInputFile;
      const previewUrl = sanitizePersistableAttachmentPreviewUrl(
        file._chipPreviewUrl,
      );
      const markerName = trimText(file.markerName, 160) || undefined;
      const attachmentId = trimText(file._attachmentId, 120) || undefined;
      const canvasElId = trimText(file._canvasElId, 120) || undefined;
      const markerId = trimText(file.markerId, 120) || undefined;
      const name = trimText(file.name, 160) || "attachment.png";
      const hasRecoverableSource =
        Boolean(previewUrl) || Boolean(canvasElId) || Boolean(file._canvasAutoInsert);

      if (!hasRecoverableSource) {
        return null;
      }

      const persistedFile = new File([], name, {
        type: file.type || "image/png",
        lastModified:
          typeof file.lastModified === "number" ? file.lastModified : Date.now(),
      }) as WorkspaceInputFile;
      persistedFile.markerId = markerId;
      persistedFile.markerName = markerName;
      persistedFile.markerInfo = file.markerInfo;
      persistedFile.lastAiAnalysis = trimText(file.lastAiAnalysis, 800) || undefined;
      persistedFile._canvasAutoInsert = file._canvasAutoInsert === true;
      persistedFile._canvasElId = canvasElId;
      persistedFile._canvasWidth =
        typeof file._canvasWidth === "number" ? file._canvasWidth : undefined;
      persistedFile._canvasHeight =
        typeof file._canvasHeight === "number" ? file._canvasHeight : undefined;
      persistedFile._canvasW =
        typeof file._canvasW === "number" ? file._canvasW : undefined;
      persistedFile._canvasH =
        typeof file._canvasH === "number" ? file._canvasH : undefined;
      persistedFile._chipPreviewUrl = previewUrl;
      persistedFile._attachmentId = attachmentId;

      return {
        id: normalizedId,
        type: "file" as const,
        file: persistedFile,
      };
    })
    .filter(Boolean) as InputBlock[];

  return nextBlocks.length > 0 ? nextBlocks : undefined;
};

const trimChatMessage = (message: ChatMessage): ChatMessage => {
  const attachments = compactPersistedUrls(message.attachments, MAX_IMAGE_URLS);

  return {
    ...message,
    text: trimText(message.text, MAX_MESSAGE_TEXT),
    feedback:
      message.feedback === "up" || message.feedback === "down"
        ? message.feedback
        : undefined,
    feedbackUpdatedAt:
      typeof message.feedbackUpdatedAt === "number"
        ? message.feedbackUpdatedAt
        : undefined,
    quote:
      message.quote && typeof message.quote === "object"
        ? {
            text: trimText(message.quote.text, 800),
            messageId: trimText(message.quote.messageId, 120),
          }
        : undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
    attachmentMetadata: undefined,
    inlineParts: compactInlineParts(message),
    agentData: message.agentData
        ? {
          model: message.agentData.model,
          title: trimText(message.agentData.title, 120),
          description: trimText(message.agentData.description, 400),
          proposals: compactProposals(message.agentData.proposals),
          skillCalls: compactSkillCalls(message.agentData.skillCalls),
          analysis:
            trimText(message.agentData.analysis, MAX_ANALYSIS_TEXT) || undefined,
          answerSegments: Array.isArray(message.agentData.answerSegments)
            ? message.agentData.answerSegments
                .map((item) =>
                  item && typeof item === "object"
                    ? {
                        text: trimText(item.text, 1200),
                        citationOrdinals: Array.isArray(item.citationOrdinals)
                          ? item.citationOrdinals
                              .map((value) => Number(value))
                              .filter(
                                (value) =>
                                  Number.isInteger(value) && value > 0,
                              )
                              .slice(0, 6)
                          : undefined,
                      }
                    : null,
                )
                .filter((item) => Boolean(item?.text))
                .slice(0, 16)
            : undefined,
          preGenerationMessage:
            trimText(message.agentData.preGenerationMessage, MAX_SUMMARY_TEXT) ||
            undefined,
          postGenerationSummary:
            trimText(message.agentData.postGenerationSummary, MAX_SUMMARY_TEXT) ||
            undefined,
          suggestions: dedupeStrings(
            message.agentData.suggestions,
            MAX_SUGGESTIONS,
          ),
          isGenerating: message.agentData.isGenerating,
          presentation: compactPresentation(message.agentData.presentation),
          executionTrace: compactExecutionTrace(
            message.agentData.executionTrace,
          ),
          research: compactResearch(message.agentData.research),
          browserSession: compactBrowserSession(message.agentData.browserSession),
        }
      : undefined,
  };
};

export const trimConversationMessages = (
  messages: ChatMessage[],
  maxMessages: number = MAX_CONVERSATION_MESSAGES,
): ChatMessage[] => messages.slice(-maxMessages).map(trimChatMessage);

export const trimConversationsForPersist = (
  conversations: ConversationSession[],
): ConversationSession[] =>
  conversations
    .slice()
    .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0))
    .map((conversation) => ({
      ...conversation,
      pinned: conversation.pinned === true ? true : undefined,
      archivedAt:
        typeof conversation.archivedAt === "number" &&
        conversation.archivedAt > 0
          ? conversation.archivedAt
          : undefined,
      title: trimText(conversation.title, 80) || '新对话',
      parentConversationId:
        trimText(conversation.parentConversationId, 120) || undefined,
      parentConversationTitle:
        trimText(conversation.parentConversationTitle, 80) || undefined,
      branchedFromMessageId:
        trimText(conversation.branchedFromMessageId, 120) || undefined,
      branchPointLabel:
        trimText(conversation.branchPointLabel, 120) || undefined,
      assistantThread: compactAssistantThreadForPersistence(
        conversation.assistantThread,
      ),
      draft:
        conversation.draft &&
        typeof conversation.draft === "object"
          ? {
              inputBlocks: compactDraftInputBlocks(
                conversation.draft.inputBlocks,
              ),
              creationMode:
                conversation.draft.creationMode === "image" ||
                conversation.draft.creationMode === "video" ||
                conversation.draft.creationMode === "agent"
                  ? conversation.draft.creationMode
                  : undefined,
              quickSkill: sanitizeQuickSkillForPersistence(
                conversation.draft.quickSkill,
              ),
              modelMode:
                conversation.draft.modelMode === "thinking" ||
                conversation.draft.modelMode === "fast"
                  ? conversation.draft.modelMode
                  : undefined,
              webEnabled:
                typeof conversation.draft.webEnabled === "boolean"
                  ? conversation.draft.webEnabled
                  : undefined,
            }
          : undefined,
      messages: trimConversationMessages(conversation.messages || []),
    }));

const trimElementUrl = (value: string | undefined): string | undefined => {
  if (!value) {
    return value;
  }
  return DATA_URL_PREFIX.test(value) ? undefined : value;
};

export const compactCanvasElement = (element: CanvasElement): CanvasElement => {
  const nextElement: CanvasElement = {
    ...element,
    url: trimElementUrl(element.url) || element.url,
    originalUrl: trimElementUrl(element.originalUrl),
    persistedOriginalUrl: trimElementUrl(element.persistedOriginalUrl) || element.persistedOriginalUrl,
    proxyUrl: trimElementUrl(element.proxyUrl),
    genRefImage: trimElementUrl(element.genRefImage),
    genRefImages: (element.genRefImages || [])
      .map(trimElementUrl)
      .filter((item): item is string => Boolean(item))
      .slice(0, MAX_IMAGE_URLS),
    genRefPreviewImage: trimElementUrl(element.genRefPreviewImage),
    genRefPreviewImages: (element.genRefPreviewImages || [])
      .map(trimElementUrl)
      .filter((item): item is string => Boolean(item))
      .slice(0, MAX_IMAGE_URLS),
    genVideoRefs: (element.genVideoRefs || [])
      .map(trimElementUrl)
      .filter((item): item is string => Boolean(item))
      .slice(0, MAX_VIDEO_URLS),
  };

  if (nextElement.genRefImages && nextElement.genRefImages.length === 0) {
    nextElement.genRefImages = undefined;
  }
  if (
    nextElement.genRefPreviewImages &&
    nextElement.genRefPreviewImages.length === 0
  ) {
    nextElement.genRefPreviewImages = undefined;
  }
  if (nextElement.genVideoRefs && nextElement.genVideoRefs.length === 0) {
    nextElement.genVideoRefs = undefined;
  }
  if (!nextElement.genRefImage && nextElement.genRefImages?.[0]) {
    nextElement.genRefImage = nextElement.genRefImages[0];
  }
  if (
    !nextElement.genRefPreviewImage &&
    nextElement.genRefPreviewImages?.[0]
  ) {
    nextElement.genRefPreviewImage = nextElement.genRefPreviewImages[0];
  }

  return nextElement;
};

export const compactElementsForHistory = (
  elements: CanvasElement[],
): CanvasElement[] => elements.map(compactCanvasElement);

export const compactHistoryState = (state: HistoryState): HistoryState => ({
  elements: compactElementsForHistory(state.elements || []),
  markers: Array.isArray(state.markers) ? [...state.markers] : [],
});

export const capHistoryLength = (history: HistoryState[]): HistoryState[] =>
  history.length <= MAX_HISTORY_STEPS
    ? history
    : history.slice(history.length - MAX_HISTORY_STEPS);

export const compactProjectForPersist = (project: Project): Project => ({
  ...project,
  thumbnail: getRenderableImageAssetUrl(project.thumbnail),
  elements: compactElementsForHistory(project.elements || []),
  markers: Array.isArray(project.markers) ? [...project.markers] : [],
  conversations: trimConversationsForPersist(project.conversations || []),
});
