import type { AgentTask, GeneratedAsset } from '../../types/agent.types.ts';
import { mergeUniqueStrings, summarizeReferenceSet } from '../topic-memory.ts';
import { getTaskOutputAssets } from './agent-task-output.ts';
import { collectApprovedImageUrls } from './orchestrator-result-handlers.ts';
import { persistApprovedAssetsToTopic } from './orchestrator-session-sync.ts';

interface ExecuteProposalTaskOptions {
  curTask: AgentTask;
  proposalId: string;
  projectContext: AgentTask['input']['context'];
}

interface ExecuteProposalTaskFlowOptions {
  curTask: AgentTask;
  proposalId: string;
  projectContext: AgentTask['input']['context'];
  executeTask: (task: AgentTask) => Promise<AgentTask>;
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

const resolveProposalExecutionSelection = (
  curTask: AgentTask,
  proposalId: string,
) => {
  const proposal = curTask.output?.proposals?.find((p) => p.id === proposalId);
  if (!proposal) {
    throw new Error(`Proposal not found: ${proposalId}`);
  }

  return {
    proposal,
    proposalTitle: proposal.title,
    proposalTopicId: curTask.input.metadata?.topicId as string | undefined,
  };
};

export const buildProposalExecutionTask = ({
  curTask,
  proposalId,
  projectContext,
}: ExecuteProposalTaskOptions): AgentTask => {
  const { proposal } = resolveProposalExecutionSelection(curTask, proposalId);

  return {
    id: `task-${Date.now()}`,
    agentId: curTask.agentId,
    status: 'executing',
    input: {
      message: `执行方案: ${proposal.title}`,
      attachments: curTask.input.attachments,
      uploadedAttachments: curTask.input.uploadedAttachments,
      context: curTask.input.context || projectContext,
      metadata: {
        ...(curTask.input.metadata || {}),
        forceSkills: true,
        executeProposalId: proposal.id,
        selectedSkillCalls: (proposal.skillCalls || []).map((call) => ({
          ...call,
          params: { ...(call.params || {}) },
        })),
      },
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
};

export const executeProposalTaskFlow = async ({
  curTask,
  proposalId,
  projectContext,
  executeTask,
  addAssetsToCanvas,
  updateDesignSession,
  getCurrentApprovedAssetIds,
  getCurrentSubjectAnchors,
  persistApprovedAssets,
}: ExecuteProposalTaskFlowOptions) => {
  const { proposalTitle, proposalTopicId } = resolveProposalExecutionSelection(
    curTask,
    proposalId,
  );
  const task = buildProposalExecutionTask({
    curTask,
    proposalId,
    projectContext,
  });
  const result = await executeTask(task);
  const resultAssets = getTaskOutputAssets(result);

  if (resultAssets.length > 0) {
    await addAssetsToCanvas(resultAssets);
  }

  const proposalApprovedUrls = collectApprovedImageUrls(result);
  if (proposalTopicId && proposalApprovedUrls.length > 0) {
    await syncProposalApprovedAssets({
      proposalTitle,
      proposalTopicId,
      proposalApprovedUrls,
      updateDesignSession,
      currentApprovedAssetIds: getCurrentApprovedAssetIds(),
      currentSubjectAnchors: getCurrentSubjectAnchors(),
      persistApprovedAssets,
    });
  }

  return {
    result,
    resultAssets,
    proposalApprovedUrls,
    proposalTitle,
    proposalTopicId,
  };
};

interface SyncProposalApprovedAssetsOptions {
  proposalTitle: string;
  proposalTopicId: string;
  proposalApprovedUrls: string[];
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

export const syncProposalApprovedAssets = async ({
  proposalTitle,
  proposalTopicId,
  proposalApprovedUrls,
  updateDesignSession,
  currentApprovedAssetIds,
  currentSubjectAnchors,
  persistApprovedAssets,
}: SyncProposalApprovedAssetsOptions) => {
  updateDesignSession({
    approvedAssetIds: mergeUniqueStrings(
      currentApprovedAssetIds || [],
      proposalApprovedUrls,
      12,
    ),
    subjectAnchors: mergeUniqueStrings(
      currentSubjectAnchors || [],
      proposalApprovedUrls,
      8,
    ),
    referenceSummary: summarizeReferenceSet(proposalApprovedUrls),
  });

  await (persistApprovedAssets || persistApprovedAssetsToTopic)({
    topicId: proposalTopicId,
    approvedUrls: proposalApprovedUrls,
    decisionLabel: `Proposal result was adopted as a downstream design anchor: ${proposalTitle}`,
  });
};
