import type {
  AgentTaskRuntimeEnvelope,
  GeneratedAsset,
  SkillCall,
} from '../../types/agent.types';
import type { MainBrainRuntimeResult } from './main-brain-runtime';

export interface BuildAgentTaskOutputOptions {
  message: string;
  analysis?: string;
  preGenerationMessage?: string;
  postGenerationSummary?: string;
  questions?: string[];
  suggestions?: string[];
  proposals?: any[];
  assets?: GeneratedAsset[];
  skillCalls?: SkillCall[] | any[];
  adjustments?: string[];
  runtime?: AgentTaskRuntimeEnvelope;
}

export const getTaskOutputAssets = (taskLike: {
  output?: { assets?: GeneratedAsset[] };
} | null | undefined): GeneratedAsset[] =>
  Array.isArray(taskLike?.output?.assets) ? taskLike.output.assets : [];

export const getTaskOutputProposals = (taskLike: {
  output?: { proposals?: any[] };
} | null | undefined): any[] =>
  Array.isArray(taskLike?.output?.proposals) ? taskLike.output.proposals : [];

export const buildSkillExecutionRuntimeEnvelope = ({
  assets,
  skillResults,
  proposals,
}: {
  assets: GeneratedAsset[];
  skillResults: Array<SkillCall | any>;
  proposals?: any[];
}): AgentTaskRuntimeEnvelope => {
  const successfulSkillCount = skillResults.filter((item) => item?.success).length;
  const failedSkillCount = skillResults.filter(
    (item) => item && item.success === false,
  ).length;

  return {
    mode: 'skill-execution',
    proposalCount: Array.isArray(proposals) ? proposals.length : 0,
    assetCount: assets.length,
    skillCallCount: skillResults.length,
    successfulSkillCount,
    failedSkillCount,
  };
};

export const buildMainBrainRuntimeEnvelope = (
  runtimeResult: MainBrainRuntimeResult,
  stopReasonLabel: AgentTaskRuntimeEnvelope['stopReasonLabel'],
): AgentTaskRuntimeEnvelope => ({
  mode: 'autonomous-main-brain',
  stopReason: runtimeResult.stopReason,
  stopReasonLabel,
  assetCount: runtimeResult.allAssets.length,
  skillCallCount: runtimeResult.allSkillResults.length,
  successfulSkillCount: runtimeResult.allSkillResults.filter((item) => item?.success).length,
  failedSkillCount: runtimeResult.allSkillResults.filter(
    (item) => item && item.success === false,
  ).length,
  executionRounds:
    runtimeResult.snapshots[runtimeResult.snapshots.length - 1]?.executionRounds || 0,
  turnCount: runtimeResult.turns.length,
  proposalCount: Array.isArray(runtimeResult.finalPlan?.proposals)
    ? runtimeResult.finalPlan.proposals.length
    : 0,
});

export interface BuildMainBrainTaskOutputOptions {
  finalPlan: any;
  assets: GeneratedAsset[];
  runtimeResult: MainBrainRuntimeResult;
  resolvedOutput: {
    message: string;
    postGenerationSummary?: string;
    adjustments: string[];
    stopReasonLabel: AgentTaskRuntimeEnvelope['stopReasonLabel'];
  };
}

export const buildMainBrainTaskOutput = ({
  finalPlan,
  assets,
  runtimeResult,
  resolvedOutput,
}: BuildMainBrainTaskOutputOptions) =>
  buildAgentTaskOutput({
    message: resolvedOutput.message,
    analysis:
      typeof finalPlan.analysis === 'string' ? finalPlan.analysis : undefined,
    preGenerationMessage:
      typeof finalPlan.preGenerationMessage === 'string'
        ? finalPlan.preGenerationMessage
        : undefined,
    postGenerationSummary: resolvedOutput.postGenerationSummary,
    proposals:
      Array.isArray(finalPlan.proposals) && assets.length === 0
        ? finalPlan.proposals
        : [],
    assets,
    skillCalls: runtimeResult.allSkillResults,
    adjustments: resolvedOutput.adjustments,
    runtime: buildMainBrainRuntimeEnvelope(
      runtimeResult,
      resolvedOutput.stopReasonLabel,
    ),
  });

export const buildAgentTaskOutput = ({
  message,
  analysis,
  preGenerationMessage,
  postGenerationSummary,
  questions,
  suggestions,
  proposals,
  assets = [],
  skillCalls = [],
  adjustments = [],
  runtime,
}: BuildAgentTaskOutputOptions) => {
  const normalizedProposals = Array.isArray(proposals) ? proposals : [];
  const normalizedSkillCalls = Array.isArray(skillCalls) ? skillCalls : [];
  const normalizedAssets = Array.isArray(assets) ? assets : [];
  const normalizedQuestions = Array.isArray(questions) ? questions : undefined;
  const normalizedSuggestions = Array.isArray(suggestions) ? suggestions : undefined;
  const normalizedAdjustments = Array.isArray(adjustments) ? adjustments : [];

  return {
    message,
    analysis,
    preGenerationMessage,
    postGenerationSummary,
    questions: normalizedQuestions,
    suggestions: normalizedSuggestions,
    proposals: normalizedProposals,
    assets: normalizedAssets,
    imageUrls: normalizedAssets.map((asset) => asset.url),
    skillCalls: normalizedSkillCalls,
    adjustments: normalizedAdjustments,
    runtime,
  };
};
