import type {
  AgentTaskMetadata,
  ProjectContext,
} from '../../types/agent.types.ts';
import type { ChatMessage } from '../../types/common.ts';
import {
  isNormalizedImageDataUrl,
  normalizeImageDataUrlString,
} from './data-url-helpers.ts';
import { isUnifiedSidebarAgentSkill } from '../runtime-assets/skill-identity.ts';
import { summarizeReferenceSet } from '../topic-memory.ts';
import { getMemoryKey } from '../topicMemory/key.ts';
import { getStudioUserAssetApi } from '../runtime-assets/api.ts';

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

const HTTP_URL_PATTERN = /^https?:\/\//i;
const IMAGE_URL_PATTERN =
  /\.(png|jpe?g|webp|gif|bmp|svg)(?:[?#].*)?$/i;

const normalizeImageUrl = (value: unknown): string => {
  const url = typeof value === 'string' ? value.trim() : '';
  if (!HTTP_URL_PATTERN.test(url)) return '';
  if (IMAGE_URL_PATTERN.test(url)) return url;
  return '';
};

const normalizeReferenceCandidate = (value: unknown): string => {
  const url = typeof value === 'string' ? value.trim() : '';
  if (!url) return '';
  if (HTTP_URL_PATTERN.test(url) && IMAGE_URL_PATTERN.test(url)) return url;
  const normalizedDataUrl = normalizeImageDataUrlString(url);
  if (normalizedDataUrl) return normalizedDataUrl;
  return '';
};

const collectImageAssetUrls = (assets: unknown): string[] =>
  Array.isArray(assets)
    ? assets
        .map((asset) => {
          if (!asset || typeof asset !== 'object') return '';
          const typedAsset = asset as { type?: unknown; url?: unknown };
          if (typedAsset.type && typedAsset.type !== 'image') return '';
          return normalizeReferenceCandidate(typedAsset.url);
        })
        .filter(Boolean)
    : [];

export const extractReferenceImageUrlsFromMessage = (
  message: Pick<ChatMessage, 'attachments' | 'inlineParts' | 'agentData'> | null | undefined,
): string[] =>
  dedupeUrls([
    ...((message?.attachments || []).map(normalizeReferenceCandidate).filter(Boolean)),
    ...((message?.inlineParts || [])
      .map((part) =>
        part?.type === 'attachment' ? normalizeReferenceCandidate(part.url) : '',
      )
      .filter(Boolean)),
    ...((message?.agentData?.imageUrls || [])
      .map(normalizeReferenceCandidate)
      .filter(Boolean)),
    ...collectImageAssetUrls(message?.agentData?.assets),
  ]);

export interface DesignSessionReferenceSnapshot {
  approvedAssetIds?: unknown;
  subjectAnchors?: unknown;
}

export const extractDesignSessionReferenceUrls = (
  designSession: DesignSessionReferenceSnapshot | null | undefined,
  options?: { maxUrls?: number },
): string[] => {
  const maxUrls = Math.max(1, options?.maxUrls || 8);
  const approvedList = Array.isArray(designSession?.approvedAssetIds)
    ? (designSession?.approvedAssetIds as unknown[])
    : [];
  const anchorList = Array.isArray(designSession?.subjectAnchors)
    ? (designSession?.subjectAnchors as unknown[])
    : [];
  const merged: string[] = [];
  for (const candidate of [...approvedList, ...anchorList]) {
    const url = normalizeImageUrl(candidate);
    if (!url) continue;
    if (!merged.includes(url)) merged.push(url);
    if (merged.length >= maxUrls) break;
  }
  return merged;
};

export const collectConversationReferenceImageUrls = (
  messages: ChatMessage[],
  options?: {
    maxMessages?: number;
    maxUrls?: number;
  },
): string[] => {
  const maxMessages = Math.max(1, options?.maxMessages || 6);
  const maxUrls = Math.max(1, options?.maxUrls || 6);
  const recentMessages = Array.isArray(messages)
    ? messages.slice(-maxMessages).reverse()
    : [];
  const collected: string[] = [];

  for (const message of recentMessages) {
    const urls = extractReferenceImageUrlsFromMessage(message);
    for (const url of urls) {
      if (!collected.includes(url)) {
        collected.push(url);
      }
      if (collected.length >= maxUrls) {
        return collected;
      }
    }
  }

  return collected;
};

const isUnifiedSidebarAgentMetadata = (metadata?: AgentTaskMetadata) =>
  metadata?.allowAutonomousRouting === true &&
  isUnifiedSidebarAgentSkill(metadata?.skillData);

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
    /(换个|换一|换成|改成|修改|调整|重来|再来|重新|上一张|上一张图|前一张|前一张图|刚刚那张|这张|这次|change|another|different|new style|retry|redo|again)/i.test(
      message,
    );

  if (!isFollowUpEdit) {
    return [];
  }

  return dedupeUrls([
    ...currentTaskAssetUrls.slice(0, 2),
    ...recentHistoryAttachmentUrls.slice(0, 3),
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
    metadata?.multimodalContext?.isolateVisualQa === true;

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
}: BuildExecutionTaskMetadataOptions): OrchestratorExecutionMetadata => {
  const unifiedSidebarAgent = isUnifiedSidebarAgentMetadata(metadata);
  const baseMetadata = metadata ? { ...metadata } : undefined;

  if (unifiedSidebarAgent && baseMetadata) {
    delete baseMetadata.agentSelectionMode;
    delete baseMetadata.pinnedAgentId;
    delete baseMetadata.selectedRoleId;
    delete baseMetadata.selectedRoleSource;
    delete baseMetadata.baseAgentId;
    delete baseMetadata.roleGovernanceMode;
    delete baseMetadata.allowMainBrainRoleMutation;
    delete baseMetadata.allowMainBrainRolePromotion;
  }

  const selectedRoleId = String(baseMetadata?.selectedRoleId || '').trim();
  const selectedRole = selectedRoleId
    ? getStudioUserAssetApi().getRoleById(selectedRoleId)
    : null;
  const selectedRoleAddon = String(
    selectedRole?.promptLayers?.durableRoleAddon || '',
  ).trim();
  const mergedRolePromptAddon = [selectedRoleAddon, String(rolePromptAddon || '').trim()]
    .filter(Boolean)
    .join('\n\n')
    .trim();
  const mergedRolePromptLabel = String(rolePromptLabel || '').trim()
    ? rolePromptLabel
    : selectedRoleId
      ? `selected:${selectedRoleId}`
      : undefined;

  return {
    ...(baseMetadata || {}),
    imageHostProvider: hostProvider,
    topicId,
    roleStrategy,
    roleStrategyReason,
    roleDraft,
    rolePromptLabel: mergedRolePromptLabel,
    rolePromptAddon: mergedRolePromptAddon || undefined,
    topicPinnedContext,
    taskMode: inferredTaskMode,
    originalMessage,
    optimizedMessage,
    optimizerUsed,
    optimizerStatus,
    allReferenceImageUrls: [...uploadedUrls],
    injectedReferenceImageUrls: [],
    multimodalContext: {
      ...(baseMetadata?.multimodalContext || {
        referenceImageUrls: [],
      }),
      referenceImageUrls: resolved.effectiveReferenceUrls,
      hasReferences: resolved.effectiveReferenceUrls.length > 0,
      referenceSummary: resolved.referenceSummary,
      isolateVisualQa: resolved.isolateVisualQa,
    },
  };
};
