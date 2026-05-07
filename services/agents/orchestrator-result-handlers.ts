import type { AgentTask } from '../../types/agent.types';
import { mergeUniqueStrings, summarizeReferenceSet } from '../topic-memory.ts';
import { persistApprovedAssetsToTopic } from './orchestrator-session-sync.ts';
import { buildAgentTaskOutput } from './agent-task-output.ts';
import { getTaskOutputAssets } from './agent-task-output.ts';
import type { GeneratedAsset } from '../../types/agent.types';

export const collectApprovedImageUrls = (task: AgentTask): string[] =>
  [
    ...(task.output?.imageUrls || []),
    ...((task.output?.assets || [])
      .filter((asset) => asset?.type === 'image' && typeof asset.url === 'string')
      .map((asset) => asset.url)),
  ].filter((url, index, arr) => !!url && arr.indexOf(url) === index);

export interface ValidateAttachmentPassthroughOptions {
  task: AgentTask;
  originalAttachmentCount: number;
  originalUploadedCount: number;
  isStrict?: boolean;
}

export const validateAttachmentPassthrough = ({
  task,
  originalAttachmentCount,
  originalUploadedCount,
  isStrict = false,
}: ValidateAttachmentPassthroughOptions) => {
  const passthroughAttachmentCount = task.input.attachments?.length || 0;
  const passthroughUploadedCount = task.input.uploadedAttachments?.length || 0;

  if (
    passthroughAttachmentCount === originalAttachmentCount &&
    passthroughUploadedCount === originalUploadedCount
  ) {
    return;
  }

  const errorMessage =
    `[orchestrator-result-handlers] Attachment passthrough mismatch: attachments ${passthroughAttachmentCount}/${originalAttachmentCount}, uploaded ${passthroughUploadedCount}/${originalUploadedCount}`;

  if (isStrict) {
    throw new Error(errorMessage);
  }

  console.error(errorMessage);
};

export interface FinalizeExecutionSuccessOptions {
  result: AgentTask;
  topicId?: string;
  decisionLabel: string;
  addAssetsToCanvas: (assets: GeneratedAsset[]) => Promise<void> | void;
  updateDesignSession: (updates: {
    approvedAssetIds?: string[];
    subjectAnchors?: string[];
    referenceSummary?: string;
  }) => void;
  getCurrentApprovedAssetIds: () => string[];
  getCurrentSubjectAnchors: () => string[];
  persistApprovedAssets?: (args: {
    topicId: string;
    approvedUrls: string[];
    decisionLabel: string;
  }) => Promise<void>;
}

export const finalizeExecutionSuccess = async ({
  result,
  topicId,
  decisionLabel,
  addAssetsToCanvas,
  updateDesignSession,
  getCurrentApprovedAssetIds,
  getCurrentSubjectAnchors,
  persistApprovedAssets,
}: FinalizeExecutionSuccessOptions) => {
  const resultAssets = getTaskOutputAssets(result);
  if (resultAssets.length > 0) {
    await addAssetsToCanvas(resultAssets);
  }

  const approvedUrls = collectApprovedImageUrls(result);
  if (!topicId || approvedUrls.length === 0) {
    return {
      assets: resultAssets,
      approvedUrls,
    };
  }

  await syncExecutionApprovedAssets({
    topicId,
    approvedUrls,
    decisionLabel,
    updateDesignSession,
    currentApprovedAssetIds: getCurrentApprovedAssetIds(),
    currentSubjectAnchors: getCurrentSubjectAnchors(),
    persistApprovedAssets,
  });

  return {
    assets: resultAssets,
    approvedUrls,
  };
};

interface SyncExecutionApprovedAssetsOptions {
  topicId: string;
  approvedUrls: string[];
  decisionLabel: string;
  updateDesignSession: (updates: {
    approvedAssetIds?: string[];
    subjectAnchors?: string[];
    referenceSummary?: string;
  }) => void;
  currentApprovedAssetIds: string[];
  currentSubjectAnchors: string[];
  persistApprovedAssets?: (args: {
    topicId: string;
    approvedUrls: string[];
    decisionLabel: string;
  }) => Promise<void>;
}

export const syncExecutionApprovedAssets = async ({
  topicId,
  approvedUrls,
  decisionLabel,
  updateDesignSession,
  currentApprovedAssetIds,
  currentSubjectAnchors,
  persistApprovedAssets,
}: SyncExecutionApprovedAssetsOptions) => {
  const approvedAssetIds = mergeUniqueStrings(
    currentApprovedAssetIds || [],
    approvedUrls,
    12,
  );

  updateDesignSession({
    approvedAssetIds,
    subjectAnchors: mergeUniqueStrings(
      currentSubjectAnchors || [],
      approvedUrls,
      8,
    ),
    referenceSummary: summarizeReferenceSet(approvedUrls),
  });

  await (persistApprovedAssets || persistApprovedAssetsToTopic)({
    topicId,
    approvedUrls,
    decisionLabel,
  });
};

export const buildProcessMessageErrorTask = (
  message: string,
  projectContext: AgentTask['input']['context'],
  error: unknown,
): AgentTask => {
  const rawMessage = error instanceof Error ? error.message : String(error || '');
  const imageFailure = /image|upload|base64|attachment|mime|format/i.test(rawMessage);
  const failMessage = imageFailure
    ? '图片处理失败，请重新上传后再试。'
    : '执行失败，可能是网络或解析异常，请重试。';

  return {
    id: `task-${Date.now()}`,
    agentId: 'coco',
    status: 'failed',
    input: { message, context: projectContext },
    output: buildAgentTaskOutput({
      message: failMessage,
      runtime: { mode: 'direct-response' },
    }),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
};

export const buildProposalExecutionErrorTask = (curTask: AgentTask): AgentTask => ({
  ...curTask,
  status: 'failed',
  output: buildAgentTaskOutput({
    message: '抱歉，生成过程中遇到网络或解析错误，请重试。',
    analysis: curTask.output?.analysis,
    preGenerationMessage: curTask.output?.preGenerationMessage,
    postGenerationSummary: curTask.output?.postGenerationSummary,
    questions: curTask.output?.questions,
    suggestions: curTask.output?.suggestions,
    proposals: curTask.output?.proposals,
    assets: curTask.output?.assets || [],
    skillCalls: curTask.output?.skillCalls || [],
    adjustments: curTask.output?.adjustments || [],
    runtime: curTask.output?.runtime,
  }),
  updatedAt: Date.now(),
});
