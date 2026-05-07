export type MainBrainFailureCategory =
  | 'request-too-large'
  | 'rate-limited'
  | 'provider-overloaded'
  | 'network'
  | 'timeout'
  | 'auth'
  | 'quota'
  | 'validation'
  | 'user-input-required'
  | 'unknown';

export interface MainBrainFailureClassification {
  category: MainBrainFailureCategory;
  retryable: boolean;
  shouldEscalateToUser: boolean;
  userActionRequired: boolean;
  shouldFallbackProvider: boolean;
  summary: string;
  message: string;
}

export interface MainBrainRetryDecision {
  classification: MainBrainFailureClassification;
  shouldRetry: boolean;
  delayMs: number;
}

export interface MainBrainSkillFailureSummary {
  totalFailures: number;
  retryableFailures: number;
  blockingFailures: number;
  userActionFailures: number;
  fallbackCandidateFailures: number;
}

const extractMessage = (error: unknown): string => {
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || '');
  }
  return String(error ?? '');
};

interface AppErrorLike {
  type: string;
  message: string;
  timestamp: number;
  retryable?: boolean;
  context?: Record<string, any>;
}

const isAppError = (error: unknown): error is AppErrorLike =>
  typeof error === 'object' &&
  error !== null &&
  'type' in error &&
  'message' in error &&
  'timestamp' in error;

export const classifyMainBrainFailure = (
  error: unknown,
): MainBrainFailureClassification => {
  const rawMessage = extractMessage(error);
  const message = rawMessage.trim();
  const lower = message.toLowerCase();
  const appErrorType = isAppError(error) ? error.type : undefined;
  const context = isAppError(error) ? error.context : undefined;
  const httpStatus = Number(context?.httpStatus || 0);

  if (
    httpStatus === 413 ||
    lower.includes('413') ||
    lower.includes('input tokens') ||
    lower.includes('context length') ||
    lower.includes('request too large')
  ) {
    return {
      category: 'request-too-large',
      retryable: false,
      shouldEscalateToUser: true,
      userActionRequired: true,
      shouldFallbackProvider: false,
      summary: 'The request payload is too large for the current model input window.',
      message,
    };
  }

  if (
    httpStatus === 429 ||
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('resource_exhausted')
  ) {
    return {
      category: 'rate-limited',
      retryable: true,
      shouldEscalateToUser: false,
      userActionRequired: false,
      shouldFallbackProvider: false,
      summary: 'The provider rate-limited the request.',
      message,
    };
  }

  if (
    httpStatus === 503 ||
    httpStatus === 502 ||
    httpStatus === 500 ||
    lower.includes('503') ||
    lower.includes('502') ||
    lower.includes('500') ||
    lower.includes('overloaded') ||
    lower.includes('unavailable') ||
    lower.includes('bad gateway') ||
    lower.includes('internal server error')
  ) {
    return {
      category: 'provider-overloaded',
      retryable: true,
      shouldEscalateToUser: false,
      userActionRequired: false,
      shouldFallbackProvider: true,
      summary: 'The provider is overloaded or temporarily unavailable.',
      message,
    };
  }

  if (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('超时')
  ) {
    return {
      category: 'timeout',
      retryable: true,
      shouldEscalateToUser: false,
      userActionRequired: false,
      shouldFallbackProvider: true,
      summary: 'The operation timed out before completing.',
      message,
    };
  }

  if (
    appErrorType === 'NETWORK' ||
    lower.includes('fetch failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('err_network') ||
    lower.includes('network')
  ) {
    return {
      category: 'network',
      retryable: true,
      shouldEscalateToUser: false,
      userActionRequired: false,
      shouldFallbackProvider: false,
      summary: 'A transient network failure interrupted the operation.',
      message,
    };
  }

  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('api_key') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden')
  ) {
    return {
      category: 'auth',
      retryable: false,
      shouldEscalateToUser: true,
      userActionRequired: true,
      shouldFallbackProvider: false,
      summary: 'Authentication or permission is invalid for the current provider.',
      message,
    };
  }

  if (
    lower.includes('quota') ||
    lower.includes('billing') ||
    lower.includes('exceeded')
  ) {
    return {
      category: 'quota',
      retryable: false,
      shouldEscalateToUser: true,
      userActionRequired: true,
      shouldFallbackProvider: false,
      summary: 'The provider quota or billing limit has been reached.',
      message,
    };
  }

  if (
    appErrorType === 'VALIDATION' ||
    lower.includes('validate') ||
    lower.includes('invalid') ||
    lower.includes('missing required') ||
    lower.includes('please upload') ||
    lower.includes('need input') ||
    lower.includes('need more') ||
    lower.includes('缺少') ||
    lower.includes('请先上传')
  ) {
    return {
      category: lower.includes('need input') ||
        lower.includes('need more') ||
        lower.includes('please upload') ||
        lower.includes('缺少') ||
        lower.includes('请先上传')
        ? 'user-input-required'
        : 'validation',
      retryable: false,
      shouldEscalateToUser: true,
      userActionRequired: true,
      shouldFallbackProvider: false,
      summary:
        lower.includes('need input') ||
        lower.includes('need more') ||
        lower.includes('please upload') ||
        lower.includes('缺少') ||
        lower.includes('请先上传')
          ? 'The workflow is blocked until the user provides missing input.'
          : 'The request or tool parameters failed validation.',
      message,
    };
  }

  return {
    category: 'unknown',
    retryable: isAppError(error) ? error.retryable !== false : true,
    shouldEscalateToUser: false,
    userActionRequired: false,
    shouldFallbackProvider: false,
    summary: 'The failure does not match a classified recovery path yet.',
    message,
  };
};

export const computeMainBrainRetryDelay = (
  attempt: number,
  baseDelayMs = 1500,
  classification?: MainBrainFailureClassification,
) => {
  const minDelay =
    classification?.category === 'rate-limited'
      ? Math.max(baseDelayMs, 3000)
      : baseDelayMs;
  return minDelay * Math.pow(2, Math.max(0, attempt));
};

export const decideMainBrainRetry = ({
  error,
  attempt,
  maxRetries,
  baseDelayMs = 1500,
}: {
  error: unknown;
  attempt: number;
  maxRetries: number;
  baseDelayMs?: number;
}): MainBrainRetryDecision => {
  const classification = classifyMainBrainFailure(error);
  return {
    classification,
    shouldRetry:
      classification.retryable &&
      !classification.userActionRequired &&
      attempt < maxRetries,
    delayMs: computeMainBrainRetryDelay(
      attempt,
      baseDelayMs,
      classification,
    ),
  };
};

export const summarizeMainBrainSkillFailures = (
  skillResults: any[],
): MainBrainSkillFailureSummary => {
  const failures = (skillResults || []).filter(
    (item) => item && item.success === false,
  );

  return failures.reduce<MainBrainSkillFailureSummary>(
    (summary, item) => {
      const classification = classifyMainBrainFailure(
        item?.error || item?.message || '',
      );
      summary.totalFailures += 1;
      if (classification.retryable) {
        summary.retryableFailures += 1;
      }
      if (classification.userActionRequired) {
        summary.userActionFailures += 1;
      }
      if (classification.shouldFallbackProvider) {
        summary.fallbackCandidateFailures += 1;
      }
      if (!classification.retryable || classification.userActionRequired) {
        summary.blockingFailures += 1;
      }
      return summary;
    },
    {
      totalFailures: 0,
      retryableFailures: 0,
      blockingFailures: 0,
      userActionFailures: 0,
      fallbackCandidateFailures: 0,
    },
  );
};

export const retryMainBrainOperation = async <T>({
  operation,
  label,
  maxRetries = 3,
  baseDelayMs = 1500,
}: {
  operation: () => Promise<T>;
  label: string;
  maxRetries?: number;
  baseDelayMs?: number;
}): Promise<T> => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const decision = decideMainBrainRetry({
        error,
        attempt,
        maxRetries,
        baseDelayMs,
      });

      if (!decision.shouldRetry) {
        throw error;
      }

      console.warn(
        `[${label}] retrying after ${decision.classification.category}; wait=${decision.delayMs}ms; remaining=${maxRetries - attempt}`,
      );
      await new Promise((resolve) => setTimeout(resolve, decision.delayMs));
    }
  }
};
