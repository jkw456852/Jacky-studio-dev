import type { GeneratedAsset } from '../../types/agent.types.ts';
import type {
  MainBrainRuntimeAction,
  MainBrainRuntimeTurn,
} from './main-brain-runtime.ts';
import { summarizeMainBrainSkillFailures } from './main-brain-failure-policy.ts';

export interface MainBrainSkillRoundHealth {
  summary: string;
  successfulSkillCount: number;
  failedSkillCount: number;
  assetCount: number;
  needsRetry: boolean;
  shouldEscalateToUser: boolean;
  retryableFailureCount: number;
  blockingFailureCount: number;
  userActionFailureCount: number;
  providerFallbackFailureCount: number;
}

const truncateText = (value: unknown, maxChars = 200): string => {
  const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  if (!text) return '';
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}...`;
};

export const inferMainBrainRuntimeAction = (
  plan: any,
  skillCalls: any[],
): MainBrainRuntimeAction => {
  if (skillCalls.length > 0) {
    return 'execute-skills';
  }

  const message = truncateText(plan?.message || plan?.analysis || '', 200).toLowerCase();
  if (
    /\?$/.test(message) ||
    /(please provide|need more|which one|clarify|upload|missing|cannot continue|need input|needs input|需要|请提供|补充|确认)/i.test(
      message,
    )
  ) {
    return 'wait-for-input';
  }

  return 'respond';
};

export const summarizeMainBrainSkillRound = (
  skillResults: any[],
  assets: GeneratedAsset[],
): MainBrainSkillRoundHealth => {
  const successfulSkillCount = skillResults.filter((item) => item?.success).length;
  const failedSkillCount = skillResults.filter((item) => item && item.success === false).length;
  const assetCount = assets.length;
  const failureSummary = summarizeMainBrainSkillFailures(skillResults);

  let summary = 'Tool round finished.';
  if (successfulSkillCount > 0 || failedSkillCount > 0) {
    summary = `Tool round finished with ${successfulSkillCount} success and ${failedSkillCount} failure.`;
  }
  if (assetCount > 0) {
    summary += ` Produced ${assetCount} asset(s).`;
  }
  if (failureSummary.userActionFailures > 0) {
    summary += ' User input is required before another tool round.';
  } else if (failureSummary.retryableFailures > 0 && assetCount === 0) {
    summary += ' Some failures look retryable from the current state.';
  }

  const allFailed = skillResults.length > 0 && failedSkillCount === skillResults.length;
  return {
    summary,
    successfulSkillCount,
    failedSkillCount,
    assetCount,
    needsRetry:
      failureSummary.retryableFailures > 0 &&
      failureSummary.userActionFailures === 0 &&
      assetCount === 0,
    shouldEscalateToUser:
      failureSummary.userActionFailures > 0 ||
      (allFailed && assetCount === 0 && failureSummary.retryableFailures === 0),
    retryableFailureCount: failureSummary.retryableFailures,
    blockingFailureCount: failureSummary.blockingFailures,
    userActionFailureCount: failureSummary.userActionFailures,
    providerFallbackFailureCount: failureSummary.fallbackCandidateFailures,
  };
};

const areSkillCallsEquivalent = (left: any[], right: any[]) => {
  try {
    return JSON.stringify(left || []) === JSON.stringify(right || []);
  } catch {
    return false;
  }
};

export const detectMainBrainRepeatedFailedLoop = (
  previousTurn: MainBrainRuntimeTurn | null,
  nextSkillCalls: any[],
): boolean => {
  if (!previousTurn || nextSkillCalls.length === 0) {
    return false;
  }

  const previousHadFailure = previousTurn.skillResults.some(
    (item) => item && item.success === false,
  );

  return (
    previousHadFailure &&
    previousTurn.skillCalls.length > 0 &&
    areSkillCallsEquivalent(previousTurn.skillCalls, nextSkillCalls)
  );
};

export const buildMainBrainFailureHints = (skillResults: any[]): string[] => {
  return skillResults
    .filter((item) => item && item.success === false)
    .slice(0, 3)
    .map((item) =>
      truncateText(item?.error || item?.message || 'Tool execution failed.', 140),
    )
    .filter(Boolean);
};
