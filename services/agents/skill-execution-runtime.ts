import type { AgentTask } from '../../types/agent.types.ts';
import type { SkillExecutionPreprocessResult } from './skill-execution-preprocessor.ts';
import { runWithTimeout } from './timeout-utils.ts';

export interface SkillExecutionCallLike {
  skillName?: string;
  params?: Record<string, any>;
}

export interface SkillExecutionResultLike extends SkillExecutionCallLike {
  result?: any;
  success: boolean;
  error?: string;
}

export interface SkillExecutionTelemetryStats {
  maxReferenceImages: number;
  uploaded_total: number;
  source_total: number;
  call_reference_total: number;
  injected_total: number;
  truncated: boolean;
  omitted_total: number;
  auto_injected_primary: string | null;
}

export interface ReferenceInjectionTelemetry {
  warningMessage?: string;
  stats: SkillExecutionTelemetryStats;
}

export const SKILL_TIMEOUTS: Record<string, number> = {
  generateImage: 180_000,
  smartEdit: 120_000,
  touchEdit: 120_000,
  generateVideo: 180_000,
  generateCopy: 15_000,
  extractText: 15_000,
  analyzeRegion: 15_000,
  export: 30_000,
};

export const DEFAULT_SKILL_TIMEOUT = 120_000;

export const resolveSkillTimeoutMs = (skillName: unknown): number => {
  const normalizedSkillName =
    typeof skillName === 'string' ? skillName.trim() : '';
  return SKILL_TIMEOUTS[normalizedSkillName] || DEFAULT_SKILL_TIMEOUT;
};

export const buildSkillTimeoutError = (
  skillName: string,
  timeoutMs: number,
): Error => new Error(`Skill ${skillName} 执行超时(${timeoutMs / 1000}s)`);

export interface ExecuteSkillWithTimeoutOptions<TResult> {
  skillName: string;
  params: Record<string, any>;
  timeoutMs?: number;
  executeSkillFn: (skillName: string, params: Record<string, any>) => Promise<TResult> | TResult;
  setTimeoutFn?: typeof globalThis.setTimeout;
  clearTimeoutFn?: typeof globalThis.clearTimeout;
}

export const executeSkillWithTimeout = async <TResult>({
  skillName,
  params,
  timeoutMs,
  executeSkillFn,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
}: ExecuteSkillWithTimeoutOptions<TResult>): Promise<TResult> => {
  const effectiveTimeoutMs =
    typeof timeoutMs === 'number' && timeoutMs > 0
      ? timeoutMs
      : DEFAULT_SKILL_TIMEOUT;

  return runWithTimeout({
    promise: Promise.resolve(executeSkillFn(skillName, params)),
    timeoutMs: effectiveTimeoutMs,
    createTimeoutError: () => buildSkillTimeoutError(skillName, effectiveTimeoutMs),
    setTimeoutFn,
    clearTimeoutFn,
  });
};

export const buildSuccessfulSkillExecutionResult = (
  call: SkillExecutionCallLike,
  result: any,
): SkillExecutionResultLike => ({
  ...call,
  result,
  success: true,
});

export const buildFailedSkillExecutionResult = (
  call: SkillExecutionCallLike,
  error: string,
): SkillExecutionResultLike => ({
  ...call,
  error,
  success: false,
});

export const buildUnhandledSkillExecutionFailureResult = (
  reason: unknown,
): SkillExecutionResultLike => ({
  skillName: 'unknown',
  success: false,
  error: String(reason || 'Unknown error'),
});

export const normalizeSettledSkillExecutionResults = (
  settled: PromiseSettledResult<SkillExecutionResultLike>[],
): SkillExecutionResultLike[] =>
  settled.map((item) => {
    if (item.status === 'fulfilled') {
      return item.value;
    }
    return buildUnhandledSkillExecutionFailureResult(item.reason);
  });

export const buildReferenceInjectionTelemetry = ({
  prepared,
  call,
  task,
  maxReferenceImages,
}: {
  prepared: SkillExecutionPreprocessResult;
  call: SkillExecutionCallLike;
  task: AgentTask;
  maxReferenceImages: number;
}): ReferenceInjectionTelemetry | null => {
  const refs = prepared.diagnostics.referencesResolved;
  if (!refs) {
    return null;
  }

  const callReferenceTotal = Array.isArray(call.params?.referenceImages)
    ? call.params.referenceImages.length
    : 0;

  return {
    warningMessage: refs.truncated
      ? `referenceImages truncated to ${maxReferenceImages}`
      : undefined,
    stats: {
      maxReferenceImages,
      uploaded_total: task.input.uploadedAttachments?.length || 0,
      source_total: refs.sourceCount,
      call_reference_total: callReferenceTotal,
      injected_total: refs.injectedCount,
      truncated: refs.truncated,
      omitted_total: refs.omittedCount,
      auto_injected_primary: refs.autoInjectedAttachmentToken || null,
    },
  };
};
