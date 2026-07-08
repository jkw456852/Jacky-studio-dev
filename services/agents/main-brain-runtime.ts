import type { AgentTask, GeneratedAsset } from '../../types/agent.types.ts';
import type { ProjectContext } from '../../types/common.ts';
import {
  buildMainBrainFailureHints,
  detectMainBrainRepeatedFailedLoop,
  inferMainBrainRuntimeAction,
  summarizeMainBrainSkillRound,
} from './main-brain-recovery.ts';
import { shouldSuppressFrontstageSkillExecutionForMessage } from './frontstage-skill-execution.ts';

export type MainBrainRuntimePhase =
  | 'understand'
  | 'decide'
  | 'execute'
  | 'observe'
  | 'replan'
  | 'respond';

export type MainBrainRuntimeAction =
  | 'respond'
  | 'execute-skills'
  | 'wait-for-input';

export type MainBrainRuntimeObservation = {
  turn: number;
  phase: MainBrainRuntimePhase;
  summary: string;
  skillCallCount?: number;
  successfulSkillCount?: number;
  failedSkillCount?: number;
  assetCount?: number;
  assetUrls?: string[];
  retryableFailureCount?: number;
  blockingFailureCount?: number;
  userActionFailureCount?: number;
};

export type MainBrainRuntimeDecision = {
  turn: number;
  action: MainBrainRuntimeAction;
  summary: string;
  skillCallCount: number;
  messagePreview?: string;
};

export type MainBrainRuntimeTurn = {
  turn: number;
  inputMessage: string;
  plan: any;
  decision: MainBrainRuntimeDecision;
  skillCalls: any[];
  skillResults: any[];
  assets: GeneratedAsset[];
};

export type MainBrainRuntimeStateSnapshot = {
  currentTurn: number;
  executionRounds: number;
  lastAction: MainBrainRuntimeAction | 'none';
  lastObservation?: string;
  totalSkillCalls: number;
  totalAssets: number;
  failureCount: number;
};

export type MainBrainRuntimeResult = {
  turns: MainBrainRuntimeTurn[];
  observations: MainBrainRuntimeObservation[];
  decisions: MainBrainRuntimeDecision[];
  snapshots: MainBrainRuntimeStateSnapshot[];
  finalPlan: any;
  allSkillResults: any[];
  allAssets: GeneratedAsset[];
  stopReason:
    | 'responded'
    | 'max-turns'
    | 'max-execution-rounds'
    | 'empty-plan'
    | 'wait-for-input'
    | 'stalled';
};

export interface RunMainBrainRuntimeOptions {
  task: AgentTask;
  analyzeAndPlan: (
    message: string,
    context: ProjectContext,
    attachments?: File[],
    uploadedAttachments?: string[],
    metadata?: Record<string, any>,
  ) => Promise<any>;
  executeSkills: (skillCalls: any[], task: AgentTask) => Promise<any[]>;
  extractAssets: (skillResults: any[]) => GeneratedAsset[];
  maxTurns?: number;
  maxExecutionRounds?: number;
  onPhaseChange?: (
    phase: MainBrainRuntimePhase,
    detail: { turn: number; summary: string },
  ) => void;
}

const truncateText = (value: unknown, maxChars = 220): string => {
  const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  if (!text) return '';
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}...`;
};

const summarizeRuntimeAssetRef = (value: unknown): string => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';

  const dataUrlMatch = text.match(/^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([\s\S]+)$/i);
  if (dataUrlMatch) {
    const mimeType = dataUrlMatch[1] || 'image/*';
    const base64Chars = (dataUrlMatch[2] || '').length;
    return `[inline image ${mimeType}, base64 ${base64Chars} chars]`;
  }

  return truncateText(text, 160);
};

const buildLatestSkillResultEvidence = (skillResults: any[]): string[] => {
  const latestSuccessfulSearch = [...(skillResults || [])]
    .reverse()
    .find(
      (item) =>
        item?.success &&
        item?.skillName === 'workspaceSearch' &&
        item?.result &&
        typeof item.result === 'object',
    );

  if (!latestSuccessfulSearch?.result) {
    return [];
  }

  const result = latestSuccessfulSearch.result as {
    query?: unknown;
    summary?: unknown;
    provider?: { web?: unknown; images?: unknown; fallback?: unknown };
    citations?: Array<{ title?: unknown; url?: unknown }>;
    extractedPages?: Array<{ title?: unknown; cleanedTextExcerpt?: unknown; excerpt?: unknown }>;
  };

  const citations = Array.isArray(result.citations) ? result.citations : [];
  const extractedPages = Array.isArray(result.extractedPages) ? result.extractedPages : [];
  const providerLabel = [result.provider?.web, result.provider?.images]
    .filter(Boolean)
    .map((item) => String(item))
    .join(' / ');

  const lines = [
    `- workspaceSearch.query=${truncateText(result.query || '', 160)}`,
    `- workspaceSearch.summary=${truncateText(result.summary || '', 600)}`,
  ];

  if (providerLabel) {
    lines.push(
      `- workspaceSearch.provider=${providerLabel}${result.provider?.fallback ? ' (fallback)' : ''}`,
    );
  }

  if (citations.length > 0) {
    lines.push(
      `- workspaceSearch.citations=${citations
        .slice(0, 4)
        .map((item) => `${truncateText(item.title || '', 80)} ${truncateText(item.url || '', 120)}`.trim())
        .join(' | ')}`,
    );
  }

  if (extractedPages.length > 0) {
    lines.push(
      `- workspaceSearch.extractedFacts=${extractedPages
        .slice(0, 2)
        .map((item) => {
          const title = truncateText(item.title || '', 80);
          const excerpt = truncateText(item.cleanedTextExcerpt || item.excerpt || '', 180);
          return `${title}: ${excerpt}`.trim();
        })
        .join(' | ')}`,
    );
  }

  return lines.filter((line) => !/=$/.test(line));
};

const formatObservationList = (observations: MainBrainRuntimeObservation[]) =>
  observations
    .map((item) => {
      const extra: string[] = [];
      if (typeof item.skillCallCount === 'number') {
        extra.push(`skillCalls=${item.skillCallCount}`);
      }
      if (typeof item.successfulSkillCount === 'number') {
        extra.push(`success=${item.successfulSkillCount}`);
      }
      if (typeof item.failedSkillCount === 'number') {
        extra.push(`failed=${item.failedSkillCount}`);
      }
      if (typeof item.assetCount === 'number') {
        extra.push(`assets=${item.assetCount}`);
      }
      if (typeof item.retryableFailureCount === 'number') {
        extra.push(`retryableFailures=${item.retryableFailureCount}`);
      }
      if (typeof item.blockingFailureCount === 'number') {
        extra.push(`blockingFailures=${item.blockingFailureCount}`);
      }
      if (typeof item.userActionFailureCount === 'number') {
        extra.push(`userActionFailures=${item.userActionFailureCount}`);
      }
      return `- Turn ${item.turn} [${item.phase}] ${item.summary}${extra.length > 0 ? ` (${extra.join(', ')})` : ''}`;
    })
    .join('\n');

export const buildRuntimeSnapshot = (
  turns: MainBrainRuntimeTurn[],
  observations: MainBrainRuntimeObservation[],
  executionRounds: number,
): MainBrainRuntimeStateSnapshot => {
  const allSkillResults = turns.flatMap((turn) => turn.skillResults);
  const lastDecision = turns.length > 0 ? turns[turns.length - 1].decision.action : 'none';
  return {
    currentTurn: turns.length,
    executionRounds,
    lastAction: lastDecision,
    lastObservation: observations.length > 0 ? observations[observations.length - 1].summary : undefined,
    totalSkillCalls: turns.reduce((sum, turn) => sum + turn.skillCalls.length, 0),
    totalAssets: turns.reduce((sum, turn) => sum + turn.assets.length, 0),
    failureCount: allSkillResults.filter((item) => item && item.success === false).length,
  };
};

export const buildRuntimeMessage = (
  originalMessage: string,
  turns: MainBrainRuntimeTurn[],
  observations: MainBrainRuntimeObservation[],
  snapshot: MainBrainRuntimeStateSnapshot,
) => {
  const latestTurn = turns.length > 0 ? turns[turns.length - 1] : null;
  const latestAssets =
    latestTurn?.assets
      .slice(-3)
      .map((asset) => summarizeRuntimeAssetRef(asset.url))
      .filter(Boolean) || [];
  const latestFailures = latestTurn
    ? buildMainBrainFailureHints(latestTurn.skillResults).slice(-2)
    : [];
  const latestSkillEvidence = latestTurn
    ? buildLatestSkillResultEvidence(latestTurn.skillResults)
    : [];

  const parts = [
    '[Original User Request]',
    originalMessage,
    '',
    '[Runtime State Snapshot]',
    `- turn=${snapshot.currentTurn}`,
    `- executionRounds=${snapshot.executionRounds}`,
    `- totalSkillCalls=${snapshot.totalSkillCalls}`,
    `- totalAssets=${snapshot.totalAssets}`,
    `- failureCount=${snapshot.failureCount}`,
    `- lastAction=${snapshot.lastAction}`,
  ];

  if (snapshot.lastObservation) {
    parts.push(`- lastObservation=${snapshot.lastObservation}`);
  }

  if (observations.length > 0) {
    parts.push('', '[Runtime Observations]', formatObservationList(observations));
  }

  if (latestTurn) {
    parts.push(
      '',
      '[Latest Turn Result]',
      `- action=${latestTurn.decision.action}`,
      `- skillCallCount=${latestTurn.skillCalls.length}`,
      `- plannerSummary=${latestTurn.decision.summary}`,
    );

    if (latestAssets.length > 0) {
      parts.push(`- latestAssetUrls=${latestAssets.join(', ')}`);
    }

    if (latestFailures.length > 0) {
      parts.push(`- latestFailures=${latestFailures.join(' | ')}`);
    }
  }

  if (latestSkillEvidence.length > 0) {
    parts.push(...latestSkillEvidence);
  }

  parts.push(
    '',
    '[Decision Instruction]',
    'Decide the next best action from the latest state.',
    'If the task is complete, answer directly.',
    'If the user must respond before progress can continue, answer directly and ask only the necessary question.',
    'If the latest tool round failed because of model alias, provider routing, invalid parameters, or other repairable configuration mistakes, prefer returning corrected skillCalls instead of pretending the task is done.',
    'If the latest failure indicates the requested model name is not recognized, normalize it to a known configured model or explicitly ask the user to choose a valid model.',
    'If the latest turn already contains successful workspaceSearch evidence, use that evidence in your next answer or replan instead of claiming that no search result exists.',
    'Only return skillCalls when another tool round is genuinely necessary.',
  );

  return parts.join('\n');
};

export const collectExecutableSkillCalls = (
  plan: any,
  options?: {
    originalMessage?: string;
    metadata?: AgentTask['input']['metadata'];
  },
): any[] => {
  if (
    options?.originalMessage &&
    shouldSuppressFrontstageSkillExecutionForMessage({
      message: options.originalMessage,
      metadata: options.metadata,
    })
  ) {
    return [];
  }
  if (!plan || typeof plan !== 'object') return [];
  if (Array.isArray(plan.skillCalls) && plan.skillCalls.length > 0) {
    return plan.skillCalls;
  }
  return [];
};

const summarizeDecision = (
  plan: any,
  action: MainBrainRuntimeAction,
  skillCallCount: number,
): string => {
  const base =
    truncateText(plan?.analysis || plan?.message || plan?.preGenerationMessage || '', 180) ||
    'Planner returned a decision.';

  if (action === 'execute-skills') {
    return `${base} Next action: execute ${skillCallCount} skill call(s).`;
  }
  if (action === 'wait-for-input') {
    return `${base} Next action: wait for user input.`;
  }
  return `${base} Next action: respond directly.`;
};

export const buildDecision = (
  turn: number,
  plan: any,
  skillCalls: any[],
): MainBrainRuntimeDecision => {
  const action = inferMainBrainRuntimeAction(plan, skillCalls);
  return {
    turn,
    action,
    summary: summarizeDecision(plan, action, skillCalls.length),
    skillCallCount: skillCalls.length,
    messagePreview: truncateText(plan?.message || plan?.analysis || '', 160) || undefined,
  };
};

export const runMainBrainRuntime = async ({
  task,
  analyzeAndPlan,
  executeSkills,
  extractAssets,
  maxTurns = 3,
  maxExecutionRounds = 2,
  onPhaseChange,
}: RunMainBrainRuntimeOptions): Promise<MainBrainRuntimeResult> => {
  const turns: MainBrainRuntimeTurn[] = [];
  const observations: MainBrainRuntimeObservation[] = [
    {
      turn: 0,
      phase: 'understand',
      summary: 'Loaded raw user request, attachments, and current workspace context.',
    },
  ];
  const decisions: MainBrainRuntimeDecision[] = [];
  const snapshots: MainBrainRuntimeStateSnapshot[] = [];

  const emit = (phase: MainBrainRuntimePhase, turn: number, summary: string) => {
    onPhaseChange?.(phase, { turn, summary });
  };

  let finalPlan: any = null;
  let allSkillResults: any[] = [];
  let allAssets: GeneratedAsset[] = [];
  let executionRounds = 0;
  let turn = 1;

  emit('understand', 0, '已读取原始请求并完成运行态准备。');

  while (turn <= maxTurns) {
    const snapshotBeforeDecision = buildRuntimeSnapshot(
      turns,
      observations,
      executionRounds,
    );
    snapshots.push(snapshotBeforeDecision);
    const inputMessage = buildRuntimeMessage(
      task.input.message,
      turns,
      observations,
      snapshotBeforeDecision,
    );

    emit('decide', turn, '正在判断接下来应直接回复、等待补充，还是继续调用工具。');
    const plan = await analyzeAndPlan(
      inputMessage,
      task.input.context,
      task.input.attachments,
      task.input.uploadedAttachments,
      task.input.metadata,
    );

    finalPlan = plan;
    const skillCalls = collectExecutableSkillCalls(plan, {
      originalMessage: task.input.message,
      metadata: task.input.metadata,
    });
    const decision = buildDecision(turn, plan, skillCalls);
    decisions.push(decision);

    if (decision.action === 'respond') {
      observations.push({
        turn,
        phase: 'respond',
        summary: '当前不需要继续调用工具，主脑将直接组织回复。',
      });
      emit('respond', turn, '无需继续调用工具，正在准备最终回复。');
      turns.push({
        turn,
        inputMessage,
        plan,
        decision,
        skillCalls: [],
        skillResults: [],
        assets: [],
      });
      return {
        turns,
        observations,
        decisions,
        snapshots,
        finalPlan,
        allSkillResults,
        allAssets,
        stopReason: turns.length === 0 ? 'empty-plan' : 'responded',
      };
    }

    if (decision.action === 'wait-for-input') {
      observations.push({
        turn,
        phase: 'respond',
        summary: '主脑判断需要用户补充信息后才能继续。',
      });
      emit('respond', turn, '需要用户补充信息后才能继续。');
      turns.push({
        turn,
        inputMessage,
        plan,
        decision,
        skillCalls: [],
        skillResults: [],
        assets: [],
      });
      return {
        turns,
        observations,
        decisions,
        snapshots,
        finalPlan,
        allSkillResults,
        allAssets,
        stopReason: 'wait-for-input',
      };
    }

    if (executionRounds >= maxExecutionRounds) {
      observations.push({
        turn,
        phase: 'respond',
        summary: '已达到执行轮次上限，返回当前最新状态。',
        skillCallCount: skillCalls.length,
      });
      emit('respond', turn, '已达到执行轮次上限，正在返回最新结果。');
      return {
        turns,
        observations,
        decisions,
        snapshots,
        finalPlan,
        allSkillResults,
        allAssets,
        stopReason: 'max-execution-rounds',
      };
    }

    const previousTurn = turns.length > 0 ? turns[turns.length - 1] : null;
    const repeatedFailedLoop = detectMainBrainRepeatedFailedLoop(
      previousTurn,
      skillCalls,
    );

    if (repeatedFailedLoop) {
      observations.push({
        turn,
        phase: 'respond',
        summary:
          '检测到重复失败的工具计划，已停止继续循环。',
        skillCallCount: skillCalls.length,
      });
      emit('respond', turn, '检测到重复失败的工具计划，正在返回最新状态。');
      return {
        turns,
        observations,
        decisions,
        snapshots,
        finalPlan,
        allSkillResults,
        allAssets,
        stopReason: 'stalled',
      };
    }

    emit('execute', turn, `正在执行 ${skillCalls.length} 个工具调用。`);
    const skillResults = await executeSkills(skillCalls, task);
    const assets = extractAssets(skillResults);
    const roundHealth = summarizeMainBrainSkillRound(skillResults, assets);

    turns.push({
      turn,
      inputMessage,
      plan,
      decision,
      skillCalls,
      skillResults,
      assets,
    });

    allSkillResults = [...allSkillResults, ...skillResults];
    allAssets = [...allAssets, ...assets];
    executionRounds += 1;

    observations.push({
      turn,
      phase: 'observe',
      summary: roundHealth.summary,
      skillCallCount: skillCalls.length,
      successfulSkillCount: roundHealth.successfulSkillCount,
      failedSkillCount: roundHealth.failedSkillCount,
      assetCount: assets.length,
      assetUrls: assets.map((asset) => asset.url),
      retryableFailureCount: roundHealth.retryableFailureCount,
      blockingFailureCount: roundHealth.blockingFailureCount,
      userActionFailureCount: roundHealth.userActionFailureCount,
    });
    emit('observe', turn, '已读取工具结果，并更新当前运行状态。');

    const snapshotAfterExecution = buildRuntimeSnapshot(
      turns,
      observations,
      executionRounds,
    );
    snapshots.push(snapshotAfterExecution);
    emit(
      'replan',
      turn,
      roundHealth.failedSkillCount > 0
        ? '工具结果中包含失败项，正在基于最新状态重新规划。'
        : '已完成本轮观察，正在基于最新状态重新规划。',
    );

    turn += 1;
  }

  emit('respond', turn - 1, '已达到当前运行轮次上限，正在返回最新结果。');
  return {
    turns,
    observations,
    decisions,
    snapshots,
    finalPlan,
    allSkillResults,
    allAssets,
    stopReason: 'max-turns',
  };
};
