import type { AgentTask, GeneratedAsset } from '../../types/agent.types';
import type { MainBrainRuntimeResult } from './main-brain-runtime';
import { classifyMainBrainFailure } from './main-brain-failure-policy.ts';

export interface MainBrainOutputResolution {
  message: string;
  postGenerationSummary?: string;
  adjustments: string[];
  shouldAskUserForNextInput: boolean;
  stopReasonLabel:
    | 'answered'
    | 'need-user-input'
    | 'retry-limit'
    | 'stalled'
    | 'turn-limit'
    | 'empty-plan';
}

const stripGenerationBlocks = (value: string): string =>
  value.replace(/```json:generation\s*[\s\S]*?```/g, '').trim();

const mapStopReasonLabel = (
  stopReason: MainBrainRuntimeResult['stopReason'],
): MainBrainOutputResolution['stopReasonLabel'] => {
  switch (stopReason) {
    case 'wait-for-input':
      return 'need-user-input';
    case 'max-execution-rounds':
      return 'retry-limit';
    case 'stalled':
      return 'stalled';
    case 'max-turns':
      return 'turn-limit';
    case 'empty-plan':
      return 'empty-plan';
    default:
      return 'answered';
  }
};

const buildFallbackMessage = (
  runtimeResult: MainBrainRuntimeResult,
  assetCount: number,
): string => {
  if (runtimeResult.stopReason === 'wait-for-input') {
    return '我已经完成当前判断，但还需要你补充关键信息，才能继续往下执行。';
  }
  if (runtimeResult.stopReason === 'stalled') {
    return '我识别到当前执行在重复失败，为了避免空转，先停在这里并把问题暴露出来。';
  }
  if (runtimeResult.stopReason === 'max-execution-rounds') {
    return '我已经完成当前允许范围内的执行回合，并基于现有结果收束这一轮输出。';
  }
  if (runtimeResult.stopReason === 'max-turns') {
    return '我已经完成当前允许范围内的推理轮次，并基于现有状态给出阶段性结果。';
  }
  if (assetCount > 0) {
    return `我已经根据当前需求完成了 ${assetCount} 个结果，并基于这些结果收束为本轮输出。`;
  }
  return '我已经根据当前需求完成了这一轮判断与处理。';
};

const buildFallbackPostSummary = (
  task: AgentTask,
  finalPlan: any,
  assets: GeneratedAsset[],
  composePostGenerationSummary: (
    task: AgentTask,
    plan: any,
    assetCount: number,
  ) => string | undefined,
) => {
  if (
    typeof finalPlan.postGenerationSummary === 'string' &&
    finalPlan.postGenerationSummary.trim().length > 0
  ) {
    return finalPlan.postGenerationSummary.trim();
  }

  if (assets.length > 0) {
    return composePostGenerationSummary(task, finalPlan, assets.length);
  }

  return undefined;
};

const buildWaitForInputAdjustments = (finalPlan: any): string[] => {
  if (Array.isArray(finalPlan.questions) && finalPlan.questions.length > 0) {
    return finalPlan.questions.filter((item: unknown) => typeof item === 'string');
  }
  if (Array.isArray(finalPlan.suggestions) && finalPlan.suggestions.length > 0) {
    return finalPlan.suggestions.filter((item: unknown) => typeof item === 'string');
  }
  return ['补充缺失信息后继续', '上传参考内容后继续'];
};

const buildFailureDrivenAdjustments = (
  runtimeResult: MainBrainRuntimeResult,
): string[] => {
  const latestTurn =
    runtimeResult.turns.length > 0
      ? runtimeResult.turns[runtimeResult.turns.length - 1]
      : null;
  const failures = (latestTurn?.skillResults || [])
    .filter((item) => item && item.success === false)
    .slice(0, 3);

  const suggestions = new Set<string>();
  failures.forEach((item) => {
    const classification = classifyMainBrainFailure(
      item?.error || item?.message || '',
    );
    if (classification.category === 'user-input-required') {
      suggestions.add('补充缺失输入后继续');
    } else if (classification.category === 'request-too-large') {
      suggestions.add('缩小输入范围后重试');
    } else if (classification.category === 'auth') {
      suggestions.add('检查当前模型或服务配置');
    } else if (classification.category === 'quota') {
      suggestions.add('切换可用模型或检查额度');
    } else if (classification.retryable) {
      suggestions.add('稍后重试一次');
    }
  });

  return [...suggestions];
};

export const resolveMainBrainOutput = ({
  task,
  runtimeResult,
  finalPlan,
  assets,
  getAdjustments,
  composePostGenerationSummary,
}: {
  task: AgentTask;
  runtimeResult: MainBrainRuntimeResult;
  finalPlan: any;
  assets: GeneratedAsset[];
  getAdjustments: (message: string, proposals: any[]) => string[];
  composePostGenerationSummary: (
    task: AgentTask,
    plan: any,
    assetCount: number,
  ) => string | undefined;
}): MainBrainOutputResolution => {
  const baseMessage =
    typeof finalPlan.message === 'string' && finalPlan.message.trim().length > 0
      ? finalPlan.message.trim()
      : typeof finalPlan.analysis === 'string' && finalPlan.analysis.trim().length > 0
        ? finalPlan.analysis.trim()
        : buildFallbackMessage(runtimeResult, assets.length);

  const postGenerationSummary = buildFallbackPostSummary(
    task,
    finalPlan,
    assets,
    composePostGenerationSummary,
  );

  const finalMessage = stripGenerationBlocks(
    assets.length > 0 && postGenerationSummary
      ? `${baseMessage}\n\n${postGenerationSummary}`
      : baseMessage,
  );

  const shouldAskUserForNextInput = runtimeResult.stopReason === 'wait-for-input';
  const stopReasonLabel = mapStopReasonLabel(runtimeResult.stopReason);
  const adjustments = shouldAskUserForNextInput
    ? buildWaitForInputAdjustments(finalPlan)
    : assets.length > 0
      ? getAdjustments(
          task.input.message,
          Array.isArray(finalPlan.proposals) ? finalPlan.proposals : [],
        )
      : runtimeResult.stopReason === 'stalled' ||
          runtimeResult.stopReason === 'max-execution-rounds'
        ? buildFailureDrivenAdjustments(runtimeResult)
      : Array.isArray(finalPlan.suggestions)
        ? finalPlan.suggestions
        : [];

  return {
    message: finalMessage,
    postGenerationSummary,
    adjustments,
    shouldAskUserForNextInput,
    stopReasonLabel,
  };
};
