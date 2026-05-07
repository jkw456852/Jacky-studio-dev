import type {
  AgentTaskMetadata,
  ProjectContext,
} from '../../types/agent.types.ts';
import { summarizeReferenceSet } from '../topic-memory.ts';
import { getMemoryKey } from '../topicMemory/key.ts';

export type OptimizerStatus = 'ok' | 'timeout' | 'fail' | 'skipped';

export interface ReferenceResolutionPolicy {
  referencePolicy: 'default' | 'uploaded-only';
  uploadedAttachmentCount: number;
  shouldPreferUploadedReferences: boolean;
}

export interface ResolvedMultimodalContext {
  directReferenceUrls: string[];
  mergedReferenceUrls: string[];
  inheritedReferenceUrls: string[];
  effectiveReferenceUrls: string[];
  isolateVisualQa: boolean;
  referenceSummary: string;
}

export interface OrchestratorExecutionMetadata extends AgentTaskMetadata {
  topicPinnedContext?: string;
  originalMessage?: string;
  optimizedMessage?: string;
  optimizerUsed?: boolean;
  optimizerStatus?: OptimizerStatus;
  allReferenceImageUrls?: string[];
  injectedReferenceImageUrls?: string[];
  multimodalContext: NonNullable<AgentTaskMetadata['multimodalContext']>;
}

interface BuildExecutionTaskMetadataOptions {
  metadata?: AgentTaskMetadata;
  hostProvider: string;
  topicId: string;
  roleStrategy?: AgentTaskMetadata['roleStrategy'];
  roleStrategyReason?: string;
  roleDraft?: AgentTaskMetadata['roleDraft'];
  rolePromptLabel?: string;
  rolePromptAddon?: string;
  topicPinnedContext: string;
  inferredTaskMode: string;
  originalMessage: string;
  optimizedMessage?: string;
  optimizerUsed: boolean;
  optimizerStatus: OptimizerStatus;
  uploadedUrls: string[];
  resolved: ResolvedMultimodalContext;
}

interface CollectInheritedReferenceUrlsOptions {
  message: string;
  shouldPreferUploadedReferences: boolean;
  currentTaskAssetUrls?: string[];
  sessionApprovedUrls?: string[];
  recentHistoryAttachmentUrls?: string[];
}

interface ResolveMultimodalReferencesOptions {
  metadata?: AgentTaskMetadata;
  uploadedUrls: string[];
  topicPinnedRefs: string[];
  inheritedReferenceUrls: string[];
  inferredTaskMode: string;
  attachmentCount: number;
}

const dedupeUrls = (urls: string[]) =>
  urls.filter(
    (url, index, arr) =>
      typeof url === 'string' &&
      !!url &&
      arr.indexOf(url) === index,
  );

const FOLLOW_UP_REFERENCE_PATTERN =
  /(换个|换种|换成|改变|调整|重新|再来|重做|另一|不同|其他|新的风格|新的色调|新角度|change|another|different|new style|retry|redo|again)/i;

export const resolveTopicId = (
  projectContext: ProjectContext,
  metadata?: AgentTaskMetadata,
) => {
  const activeConversationId = String(projectContext.conversationId || '').trim();
  return String(
    metadata?.topicId ||
      (activeConversationId
        ? getMemoryKey(projectContext.projectId, activeConversationId)
        : '') ||
      '',
  ).trim();
};

export const getReferenceResolutionPolicy = (
  metadata?: AgentTaskMetadata,
): ReferenceResolutionPolicy => {
  const referencePolicy =
    metadata?.multimodalContext?.referencePolicy || 'default';
  const uploadedAttachmentCount =
    metadata?.multimodalContext?.uploadedAttachmentCount || 0;

  return {
    referencePolicy,
    uploadedAttachmentCount,
    shouldPreferUploadedReferences:
      referencePolicy === 'uploaded-only' || uploadedAttachmentCount > 0,
  };
};

export const collectInheritedReferenceUrls = ({
  message,
  shouldPreferUploadedReferences,
  currentTaskAssetUrls = [],
  sessionApprovedUrls = [],
  recentHistoryAttachmentUrls = [],
}: CollectInheritedReferenceUrlsOptions) => {
  const isFollowUpEdit =
    !shouldPreferUploadedReferences &&
    FOLLOW_UP_REFERENCE_PATTERN.test(message);

  if (!isFollowUpEdit) {
    return [];
  }

  return dedupeUrls([
    ...currentTaskAssetUrls.slice(0, 2),
    ...recentHistoryAttachmentUrls.slice(0, 2),
    ...sessionApprovedUrls.slice(0, 2),
  ]).slice(0, 3);
};

export const resolveMultimodalReferences = ({
  metadata,
  uploadedUrls,
  topicPinnedRefs,
  inheritedReferenceUrls,
  inferredTaskMode,
  attachmentCount,
}: ResolveMultimodalReferencesOptions): ResolvedMultimodalContext => {
  const { uploadedAttachmentCount, shouldPreferUploadedReferences } =
    getReferenceResolutionPolicy(metadata);

  const directReferenceUrls = dedupeUrls([
    ...((metadata?.multimodalContext?.referenceImageUrls || []).slice()),
    ...uploadedUrls,
  ]);

  const mergedReferenceUrls = shouldPreferUploadedReferences
    ? directReferenceUrls
    : dedupeUrls([
        ...topicPinnedRefs,
        ...directReferenceUrls,
        ...inheritedReferenceUrls,
      ]);

  const isolateVisualQa =
    metadata?.multimodalContext?.isolateVisualQa === true ||
    (inferredTaskMode === 'chat' &&
      (uploadedUrls.length > 0 ||
        uploadedAttachmentCount > 0 ||
        attachmentCount > 0));

  const effectiveReferenceUrls = isolateVisualQa
    ? directReferenceUrls
    : mergedReferenceUrls;

  return {
    directReferenceUrls,
    mergedReferenceUrls,
    inheritedReferenceUrls,
    effectiveReferenceUrls,
    isolateVisualQa,
    referenceSummary: summarizeReferenceSet(effectiveReferenceUrls),
  };
};

export const buildExecutionTaskMetadata = ({
  metadata,
  hostProvider,
  topicId,
  roleStrategy,
  roleStrategyReason,
  roleDraft,
  rolePromptLabel,
  rolePromptAddon,
  topicPinnedContext,
  inferredTaskMode,
  originalMessage,
  optimizedMessage,
  optimizerUsed,
  optimizerStatus,
  uploadedUrls,
  resolved,
}: BuildExecutionTaskMetadataOptions): OrchestratorExecutionMetadata => ({
  ...(metadata || {}),
  imageHostProvider: hostProvider,
  topicId,
  roleStrategy,
  roleStrategyReason,
  roleDraft,
  rolePromptLabel,
  rolePromptAddon,
  topicPinnedContext,
  taskMode: inferredTaskMode,
  originalMessage,
  optimizedMessage,
  optimizerUsed,
  optimizerStatus,
  allReferenceImageUrls: [...uploadedUrls],
  injectedReferenceImageUrls: [],
  multimodalContext: {
    ...(metadata?.multimodalContext || {
      referenceImageUrls: [],
    }),
    referenceImageUrls: resolved.effectiveReferenceUrls,
    hasReferences: resolved.effectiveReferenceUrls.length > 0,
    referenceSummary: resolved.referenceSummary,
    isolateVisualQa: resolved.isolateVisualQa,
  },
});
