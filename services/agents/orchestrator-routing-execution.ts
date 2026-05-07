import type {
  AgentTask,
  AgentTaskMetadata,
  AgentType,
  GeneratedAsset,
} from '../../types/agent.types.ts';
import type { ProjectContext } from '../../types/common.ts';
import type { EnhancedRoutingDecision } from './enhanced-orchestrator.ts';
import {
  buildAutonomousChatRoutingDecision,
  buildFallbackRoutingDecision,
  buildUnifiedSidebarRoutingDecision,
} from './orchestrator-routing.ts';
import type { TimeoutExecutor } from './timeout-utils.ts';

interface PipelineDescriptor {
  id: string;
  name?: string;
  description: string;
  steps?: Array<{ agentId: AgentType }>;
}

interface PipelineExecutionResult {
  steps: AgentTask[];
  allAssets: GeneratedAsset[];
}

type DetectPipelineFn = (message: string) => string | null;
type ExecutePipelineStepCallback = (stepIndex: number, result: AgentTask) => void;
type ExecutePipelineFn = (
  pipeline: PipelineDescriptor,
  message: string,
  context: ProjectContext,
  onStep?: ExecutePipelineStepCallback,
) => Promise<PipelineExecutionResult>;
type RouteToAgentFn = (
  message: string,
  context: ProjectContext,
) => Promise<EnhancedRoutingDecision | null>;
type LocalPreRouteFn = (message: string) => AgentType | null;

export interface ResolveRoutingDecisionOptions {
  message: string;
  metadata?: AgentTaskMetadata;
  attachments?: File[];
  updatedContext: ProjectContext;
  pinnedAgent: AgentType | null;
  isUnifiedSidebarAgent: boolean;
  shouldPreferAutonomousChatFallback: boolean;
  optimizerUsed: boolean;
  optimizedMessageForTrace?: string;
  withTimeout: TimeoutExecutor;
  dependencies?: RoutingExecutionDependencies;
}

export interface RoutingExecutionDependencies {
  detectPipeline?: DetectPipelineFn;
  executePipeline?: ExecutePipelineFn;
  pipelines?: Record<string, PipelineDescriptor>;
  routeToAgent?: RouteToAgentFn;
  localPreRoute?: LocalPreRouteFn;
}

export interface ExecutePipelineOptions {
  message: string;
  isUnifiedSidebarAgent: boolean;
  useOptimizeThenExecute: boolean;
  updatedContext: ProjectContext;
  timeoutMs: number;
  withTimeout: TimeoutExecutor;
  onStep: ExecutePipelineStepCallback | undefined;
  dependencies?: RoutingExecutionDependencies;
}

export const maybeResolvePipeline = async ({
  message,
  isUnifiedSidebarAgent,
  useOptimizeThenExecute,
  updatedContext,
  timeoutMs,
  withTimeout,
  onStep,
  dependencies,
}: ExecutePipelineOptions): Promise<{
  pipeline: PipelineDescriptor;
  pipelineResult: PipelineExecutionResult;
} | null> => {
  let detectPipelineFn = dependencies?.detectPipeline;
  let executePipelineFn = dependencies?.executePipeline;
  let pipelines = dependencies?.pipelines;

  if (
    (!detectPipelineFn || !executePipelineFn || !pipelines) &&
    !useOptimizeThenExecute &&
    !isUnifiedSidebarAgent
  ) {
    const pipelineModule = await import('./pipeline.ts');
    detectPipelineFn = detectPipelineFn || pipelineModule.detectPipeline;
    executePipelineFn = executePipelineFn || (pipelineModule.executePipeline as ExecutePipelineFn);
    pipelines = pipelines || (pipelineModule.PIPELINES as Record<string, PipelineDescriptor>);
  }

  const pipelineId =
    !useOptimizeThenExecute && !isUnifiedSidebarAgent && detectPipelineFn
      ? detectPipelineFn(message)
      : null;

  if (!pipelineId || !pipelines?.[pipelineId] || !executePipelineFn) {
    return null;
  }

  const pipeline = pipelines[pipelineId];
  const pipelineResult = await withTimeout(
    executePipelineFn(pipeline, message, updatedContext, onStep),
    timeoutMs,
    'Pipeline execution timed out',
  );

  return {
    pipeline,
    pipelineResult,
  };
};

export const resolveRoutingDecision = async ({
  message,
  metadata,
  attachments,
  updatedContext,
  pinnedAgent,
  isUnifiedSidebarAgent,
  shouldPreferAutonomousChatFallback,
  optimizerUsed,
  optimizedMessageForTrace,
  withTimeout,
  dependencies,
}: ResolveRoutingDecisionOptions): Promise<EnhancedRoutingDecision> => {
  let localPreRouteFn = dependencies?.localPreRoute;
  let routeToAgentFn = dependencies?.routeToAgent;

  if (!localPreRouteFn && !isUnifiedSidebarAgent) {
    const localRouterModule = await import('./local-router.ts');
    localPreRouteFn = localRouterModule.localPreRoute as LocalPreRouteFn;
  }

  const localAgent = isUnifiedSidebarAgent || !localPreRouteFn ? null : localPreRouteFn(message);
  let decision: EnhancedRoutingDecision | null = null;

  if (isUnifiedSidebarAgent) {
    decision = buildUnifiedSidebarRoutingDecision(message) as EnhancedRoutingDecision;
  } else if (shouldPreferAutonomousChatFallback) {
    decision = buildAutonomousChatRoutingDecision(message) as EnhancedRoutingDecision;
  } else if (pinnedAgent) {
    decision = {
      action: 'route',
      targetAgent: pinnedAgent,
      taskType: metadata?.agentSelectionMode === 'manual' ? 'manual-role' : 'optimized-routed',
      complexity: 'simple',
      handoffMessage:
        optimizerUsed && optimizedMessageForTrace
          ? `User request (optimized): ${message}`
          : `User request: ${message}`,
      confidence: 0.9,
      roleStrategy: 'reuse',
      roleStrategyReason:
        metadata?.agentSelectionMode === 'manual'
          ? 'User manually pinned this role.'
          : 'Pinned role reused after optimization flow.',
    } as EnhancedRoutingDecision;
  } else if (localAgent) {
    decision = {
      action: 'route',
      targetAgent: localAgent,
      taskType: 'local-routed',
      complexity: 'simple',
      handoffMessage: `User request: ${message}`,
      confidence: 0.75,
      roleStrategy: 'reuse',
      roleStrategyReason: 'Local keyword routing matched an existing specialist.',
    } as EnhancedRoutingDecision;
  } else {
    try {
      if (!routeToAgentFn) {
        const orchestratorModule = await import('./enhanced-orchestrator.ts');
        routeToAgentFn = orchestratorModule.routeToAgent as RouteToAgentFn;
      }

      decision = await withTimeout(
        routeToAgentFn(message, updatedContext),
        60000,
        'Routing request timed out',
      );
    } catch (error) {
      if (shouldPreferAutonomousChatFallback) {
        console.warn(
          '[orchestrator-routing-execution] Route API failed during autonomous visual chat, forcing coco fallback.',
          error,
        );
        decision = buildAutonomousChatRoutingDecision(
          message,
          'autonomous-visual-chat-fallback',
        ) as EnhancedRoutingDecision;
      } else {
        throw error;
      }
    }
  }

  if (!decision) {
    const fallbackAgent = shouldPreferAutonomousChatFallback ? 'coco' : 'poster';
    decision = buildFallbackRoutingDecision(
      message,
      fallbackAgent as AgentType,
    ) as EnhancedRoutingDecision;
  }

  return decision;
};
