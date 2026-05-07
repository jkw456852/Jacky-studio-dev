import type {
  AgentRoutingDecision,
  AgentTask,
  AgentTaskMetadata,
  AgentType,
} from '../../types/agent.types.ts';
import type { DesignSessionState, ProjectContext } from '../../types/common.ts';
import {
  addTopicMemoryItem,
  buildTopicPinnedContext,
  extractConstraintHints,
  upsertTopicSnapshot,
} from '../topic-memory.ts';
import {
  detectExplicitAgentPin,
  detectOptimizeThenExecuteIntent,
  stripOptimizePipelineCommand,
} from './prompt-optimizer/intent.ts';
import {
  buildExecutionTaskMetadata,
  collectInheritedReferenceUrls,
  resolveMultimodalReferences,
  resolveTopicId,
} from './orchestrator-multimodal.ts';
import {
  syncDesignSessionState,
  syncTopicSnapshotState,
} from './orchestrator-session-sync.ts';
import { validateAttachmentPassthrough } from './orchestrator-result-handlers.ts';
import { isUnifiedSidebarAgent, inferTaskModeFromRequest } from './orchestrator-routing.ts';
import { buildExecutionTask } from './orchestrator-task-assembly.ts';

export interface PreparedOrchestratorContext {
  uploadedUrls: string[];
  updatedContext: ProjectContext;
  topicId: string;
  topicPinnedContext: string;
  topicPinnedRefs: string[];
  inferredTaskMode: string;
  messageForExecution: string;
  pinnedAgent: AgentType | null;
  useOptimizeThenExecute: boolean;
  optimizerUsed: boolean;
  optimizerStatus: 'ok' | 'timeout' | 'fail' | 'skipped';
  optimizedMessageForTrace?: string;
  isUnifiedSidebarAgent: boolean;
}

export interface PreparedAgentExecutionTask {
  task: AgentTask;
  taskMetadata: AgentTaskMetadata;
  inheritedReferenceUrls: string[];
}

interface PrepareAgentExecutionTaskDependencies {
  collectInheritedReferenceUrlsFn?: typeof collectInheritedReferenceUrls;
  resolveMultimodalReferencesFn?: typeof resolveMultimodalReferences;
  buildExecutionTaskMetadataFn?: typeof buildExecutionTaskMetadata;
  syncDesignSessionStateFn?: typeof syncDesignSessionState;
  syncTopicSnapshotStateFn?: typeof syncTopicSnapshotState;
  buildExecutionTaskFn?: typeof buildExecutionTask;
  validateAttachmentPassthroughFn?: typeof validateAttachmentPassthrough;
}

interface PrepareAgentExecutionTaskOptions {
  agentId: AgentType;
  message: string;
  messageForExecution: string;
  attachments?: File[];
  metadata?: AgentTaskMetadata;
  uploadedUrls: string[];
  updatedContext: ProjectContext;
  projectActions: {
    updateDesignSession: (updates: Partial<DesignSessionState>) => void;
  };
  existingDesignSession: DesignSessionState;
  hostProvider: string;
  topicId: string;
  topicPinnedContext: string;
  topicPinnedRefs: string[];
  inferredTaskMode: string;
  optimizerUsed: boolean;
  optimizerStatus: 'ok' | 'timeout' | 'fail' | 'skipped';
  optimizedMessageForTrace?: string;
  originalMessage: string;
  shouldPreferUploadedReferences: boolean;
  roleStrategy?: AgentRoutingDecision['roleStrategy'];
  roleStrategyReason?: string;
  roleDraft?: any;
  rolePromptLabel?: string;
  rolePromptAddon?: string;
  currentTaskAssetUrls: string[];
  sessionApprovedUrls: string[];
  recentHistoryAttachmentUrls: string[];
  isAttachmentValidationStrict: boolean;
  dependencies?: PrepareAgentExecutionTaskDependencies;
}

interface PrepareOrchestratorContextOptions {
  message: string;
  attachments?: File[];
  metadata?: AgentTaskMetadata;
  userMessageId?: string;
  projectContext: ProjectContext;
  freshDesignSession: DesignSessionState;
  brandInfo: ProjectContext['brandInfo'];
  conversationHistory: ProjectContext['conversationHistory'];
  selectedHostProvider: string;
  setIsUploadingAttachments: (value: boolean) => void;
  setCurrentTask: (task: AgentTask | null) => void;
  updateMessageAttachments: (messageId: string, attachments: string[]) => void;
  setTaskMode: (taskMode: DesignSessionState['taskMode']) => void;
}

export const prepareOrchestratorContext = async ({
  message,
  attachments,
  metadata,
  userMessageId,
  projectContext,
  freshDesignSession,
  brandInfo,
  conversationHistory,
  selectedHostProvider,
  setIsUploadingAttachments,
  setCurrentTask,
  updateMessageAttachments,
  setTaskMode,
}: PrepareOrchestratorContextOptions): Promise<PreparedOrchestratorContext> => {
  let uploadedUrls: string[] = [];

  if (attachments && attachments.length > 0 && selectedHostProvider !== 'none') {
    setIsUploadingAttachments(true);
    setCurrentTask({
      id: `upload-${Date.now()}`,
      agentId: 'coco',
      status: 'analyzing',
      progressMessage: 'Uploading attachments...',
      input: { message, attachments, context: projectContext },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    try {
      const { uploadImage } = await import('../../utils/uploader.ts');
      const uploadResults = await Promise.allSettled(
        attachments.map((file) => uploadImage(file)),
      );
      const failedUploads = uploadResults.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );

      if (failedUploads.length > 0) {
        throw new Error('Attachment upload failed');
      }

      uploadedUrls = uploadResults
        .filter(
          (result): result is PromiseFulfilledResult<string> =>
            result.status === 'fulfilled',
        )
        .map((result) => result.value)
        .filter((url) => /^https?:\/\//i.test(url));

      if (uploadedUrls.length !== attachments.length) {
        throw new Error('Attachment upload result mismatch');
      }

      if (userMessageId) {
        updateMessageAttachments(userMessageId, uploadedUrls);
      }
    } finally {
      setIsUploadingAttachments(false);
    }
  }

  const updatedContext: ProjectContext = {
    ...projectContext,
    designSession: {
      ...freshDesignSession,
      brand: {
        ...freshDesignSession.brand,
        ...brandInfo,
      },
    },
    conversationHistory,
  };

  const topicId = resolveTopicId(projectContext, metadata);
  let topicPinnedContext = '';
  let topicPinnedRefs: string[] = [];
  const inferredTaskMode = inferTaskModeFromRequest(message, metadata);
  setTaskMode(inferredTaskMode as DesignSessionState['taskMode']);

  if (topicId) {
    try {
      const pinned = await buildTopicPinnedContext(topicId);
      topicPinnedContext = pinned.text;
      topicPinnedRefs = pinned.refs;

      const hints = extractConstraintHints(message);
      if (hints.length > 0) {
        await upsertTopicSnapshot(topicId, {
          pinned: {
            constraints: hints,
            decisions: [],
          },
        });
      }

      if (message.trim()) {
        await addTopicMemoryItem({
          topicId,
          type: 'instruction',
          text: message.trim(),
        });
      }
    } catch {
    }
  }

  const optimizerEnabled = import.meta.env.VITE_PROMPT_OPTIMIZER_ENABLED !== 'false';
  const optimizerPipelineEnabled =
    import.meta.env.VITE_PROMPT_OPTIMIZER_PIPELINE_ENABLED !== 'false';
  const isInternalCall = metadata?.internalCall === true;

  let messageForExecution = message;
  let pinnedAgent: AgentType | null = null;
  let useOptimizeThenExecute = false;
  let optimizerUsed = false;
  let optimizerStatus: 'ok' | 'timeout' | 'fail' | 'skipped' = 'skipped';
  let optimizedMessageForTrace: string | undefined;
  const unifiedSidebarAgent = isUnifiedSidebarAgent(metadata) === true;

  if (
    !isInternalCall &&
    optimizerEnabled &&
    optimizerPipelineEnabled &&
    detectOptimizeThenExecuteIntent(message)
  ) {
    useOptimizeThenExecute = true;
    optimizerUsed = true;
    const strippedInput = stripOptimizePipelineCommand(message) || message;
    const { optimizeUserText } = await import('./prompt-optimizer/service.ts');
    const optimized = await optimizeUserText(strippedInput, updatedContext, {
      requestId: userMessageId,
    });
    if (optimized.ok && optimized.optimizedText) {
      messageForExecution = optimized.optimizedText;
      optimizedMessageForTrace = optimized.optimizedText;
      optimizerStatus = 'ok';
    } else {
      const failReason = (optimized as { reason?: string }).reason || '';
      optimizerStatus = failReason === 'timeout' ? 'timeout' : 'fail';
    }

    const pinned = detectExplicitAgentPin(message);
    if (
      pinned &&
      ['coco', 'vireo', 'cameron', 'poster', 'package', 'motion', 'campaign'].includes(
        pinned,
      )
    ) {
      pinnedAgent = pinned as AgentType;
    }
  }

  if (
    metadata?.agentSelectionMode === 'manual' &&
    metadata?.pinnedAgentId &&
    ['coco', 'vireo', 'cameron', 'poster', 'package', 'motion', 'campaign', 'prompt-optimizer'].includes(
      metadata.pinnedAgentId,
    )
  ) {
    pinnedAgent = metadata.pinnedAgentId;
  }

  return {
    uploadedUrls,
    updatedContext,
    topicId,
    topicPinnedContext,
    topicPinnedRefs,
    inferredTaskMode,
    messageForExecution,
    pinnedAgent,
    useOptimizeThenExecute,
    optimizerUsed,
    optimizerStatus,
    optimizedMessageForTrace,
    isUnifiedSidebarAgent: unifiedSidebarAgent,
  };
};

export const prepareAgentExecutionTask = async ({
  agentId,
  message,
  messageForExecution,
  attachments,
  metadata,
  uploadedUrls,
  updatedContext,
  projectActions,
  existingDesignSession,
  hostProvider,
  topicId,
  topicPinnedContext,
  topicPinnedRefs,
  inferredTaskMode,
  optimizerUsed,
  optimizerStatus,
  optimizedMessageForTrace,
  originalMessage,
  shouldPreferUploadedReferences,
  roleStrategy,
  roleStrategyReason,
  roleDraft,
  rolePromptLabel,
  rolePromptAddon,
  currentTaskAssetUrls,
  sessionApprovedUrls,
  recentHistoryAttachmentUrls,
  isAttachmentValidationStrict,
  dependencies,
}: PrepareAgentExecutionTaskOptions): Promise<PreparedAgentExecutionTask> => {
  const collectInheritedReferenceUrlsFn =
    dependencies?.collectInheritedReferenceUrlsFn || collectInheritedReferenceUrls;
  const resolveMultimodalReferencesFn =
    dependencies?.resolveMultimodalReferencesFn || resolveMultimodalReferences;
  const buildExecutionTaskMetadataFn =
    dependencies?.buildExecutionTaskMetadataFn || buildExecutionTaskMetadata;
  const syncDesignSessionStateFn =
    dependencies?.syncDesignSessionStateFn || syncDesignSessionState;
  const syncTopicSnapshotStateFn =
    dependencies?.syncTopicSnapshotStateFn || syncTopicSnapshotState;
  const buildExecutionTaskFn =
    dependencies?.buildExecutionTaskFn || buildExecutionTask;
  const validateAttachmentPassthroughFn =
    dependencies?.validateAttachmentPassthroughFn || validateAttachmentPassthrough;

  const inheritedReferenceUrls = collectInheritedReferenceUrlsFn({
    message,
    shouldPreferUploadedReferences,
    currentTaskAssetUrls,
    sessionApprovedUrls,
    recentHistoryAttachmentUrls,
  });

  const resolvedMultimodal = resolveMultimodalReferencesFn({
    metadata,
    uploadedUrls,
    topicPinnedRefs,
    inheritedReferenceUrls,
    inferredTaskMode,
    attachmentCount: attachments?.length || 0,
  });

  const taskMetadata = buildExecutionTaskMetadataFn({
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
    optimizedMessage: optimizedMessageForTrace,
    optimizerUsed,
    optimizerStatus,
    uploadedUrls,
    resolved: resolvedMultimodal,
  });

  syncDesignSessionStateFn({
    projectActions,
    existingDesignSession,
    metadata,
    inferredTaskMode,
    message: originalMessage,
    referenceSummary: taskMetadata.multimodalContext.referenceSummary || '',
    referenceImageUrls: taskMetadata.multimodalContext.referenceImageUrls,
  });

  if (topicId) {
    await syncTopicSnapshotStateFn({
      topicId,
      existingDesignSession,
      metadata,
      message: originalMessage,
      referenceSummary: taskMetadata.multimodalContext.referenceSummary || '',
    });
  }

  const task = buildExecutionTaskFn({
    agentId,
    messageForExecution,
    attachments,
    uploadedUrls,
    updatedContext,
    taskMetadata,
  });

  validateAttachmentPassthroughFn({
    task,
    originalAttachmentCount: attachments?.length || 0,
    originalUploadedCount: uploadedUrls.length,
    isStrict: isAttachmentValidationStrict,
  });

  return {
    task,
    taskMetadata,
    inheritedReferenceUrls,
  };
};
