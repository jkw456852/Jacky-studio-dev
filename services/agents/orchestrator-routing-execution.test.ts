import assert from 'node:assert/strict';
import test from 'node:test';
import {
  maybeResolvePipeline,
  resolveRoutingDecision,
} from './orchestrator-routing-execution.ts';
import { buildUnifiedSidebarRoutingDecision } from './orchestrator-routing.ts';
import { shouldUseImmediateResponseShortcut } from './orchestrator-task-assembly.ts';
import { evaluateSkillClarifyGate } from './skill-clarify-gate.ts';

test('maybeResolvePipeline executes detected pipeline through injected dependencies', async () => {
  const stepUpdates: any[] = [];
  const pipeline = {
    id: 'pipeline-1',
    name: 'Demo Pipeline',
    steps: [{ agentId: 'poster' }],
  } as any;
  const pipelineResult = {
    steps: [],
    allAssets: [],
  } as any;

  const result = await maybeResolvePipeline({
    message: 'run pipeline',
    isUnifiedSidebarAgent: false,
    useOptimizeThenExecute: false,
    updatedContext: { projectId: 'p1' } as any,
    timeoutMs: 1000,
    withTimeout: async (promise) => promise,
    onStep: (stepIdx, stepResult) => {
      stepUpdates.push({ stepIdx, stepResult });
    },
    dependencies: {
      detectPipeline: () => 'pipeline-1',
      pipelines: { 'pipeline-1': pipeline } as any,
      executePipeline: async (_pipeline, _message, _context, onStep) => {
        onStep?.(0, { status: 'completed' } as any);
        return pipelineResult;
      },
    },
  });

  assert.equal(result?.pipeline, pipeline);
  assert.equal(result?.pipelineResult, pipelineResult);
  assert.equal(stepUpdates.length, 1);
  assert.equal(stepUpdates[0].stepIdx, 0);
});

test('maybeResolvePipeline skips detection for unified sidebar or optimize-then-execute flow', async () => {
  let detectCalls = 0;

  const result = await maybeResolvePipeline({
    message: 'skip pipeline',
    isUnifiedSidebarAgent: true,
    useOptimizeThenExecute: false,
    updatedContext: { projectId: 'p1' } as any,
    timeoutMs: 1000,
    withTimeout: async (promise) => promise,
    onStep: () => {},
    dependencies: {
      detectPipeline: () => {
        detectCalls += 1;
        return 'pipeline-1';
      },
      pipelines: { 'pipeline-1': { id: 'pipeline-1' } } as any,
      executePipeline: async () => ({}) as any,
    },
  });

  assert.equal(result, null);
  assert.equal(detectCalls, 0);
});

test('resolveRoutingDecision prefers pinned agent before remote routing', async () => {
  const result = await resolveRoutingDecision({
    message: 'please help',
    metadata: { agentSelectionMode: 'manual' } as any,
    attachments: [],
    updatedContext: { projectId: 'p1' } as any,
    pinnedAgent: 'cameron',
    isUnifiedSidebarAgent: false,
    shouldPreferAutonomousChatFallback: false,
    optimizerUsed: false,
    withTimeout: async (promise) => promise,
    dependencies: {
      localPreRoute: () => null,
      routeToAgent: async () => {
        throw new Error('should not call remote route');
      },
    },
  });

  assert.equal(result.targetAgent, 'cameron');
  assert.equal(result.taskType, 'manual-role');
  assert.equal(result.roleStrategy, 'reuse');
});

test('resolveRoutingDecision prefers autonomous visual chat mode before remote route when fallback is enabled', async () => {
  const result = await resolveRoutingDecision({
    message: '看看这张图里是什么',
    metadata: {} as any,
    attachments: [{} as File],
    updatedContext: { projectId: 'p1' } as any,
    pinnedAgent: null,
    isUnifiedSidebarAgent: false,
    shouldPreferAutonomousChatFallback: true,
    optimizerUsed: false,
    withTimeout: async (promise) => promise,
    dependencies: {
      localPreRoute: () => null,
      routeToAgent: async () => {
        throw new Error('route api failed');
      },
    },
  });

  assert.equal(result.targetAgent, 'coco');
  assert.equal(result.taskType, 'autonomous-visual-chat');
});

test('resolveRoutingDecision keeps unified sidebar requests on routed agent execution path', async () => {
  const result = await resolveRoutingDecision({
    message: '直接改写当前专家的长期设定并落库',
    metadata: { allowAutonomousRouting: true } as any,
    attachments: [],
    updatedContext: { projectId: 'p1' } as any,
    pinnedAgent: 'poster',
    isUnifiedSidebarAgent: true,
    shouldPreferAutonomousChatFallback: false,
    optimizerUsed: false,
    withTimeout: async (promise) => promise,
    dependencies: {
      localPreRoute: () => 'cameron' as any,
      routeToAgent: async () => ({
        action: 'respond',
        targetAgent: 'poster',
      }) as any,
    },
  });

  assert.equal(result.action, 'route');
  assert.equal(result.targetAgent, 'coco');
  assert.equal(result.taskType, 'unified-sidebar-agent');
});

test('buildUnifiedSidebarRoutingDecision never degrades into direct response actions', () => {
  const result = buildUnifiedSidebarRoutingDecision('请直接修改当前专家长期设定');

  assert.equal(result.action, 'route');
  assert.equal(result.targetAgent, 'coco');
  assert.equal(result.taskType, 'unified-sidebar-agent');
});

test('shouldUseImmediateResponseShortcut always preserves direct chat responses', () => {
  assert.equal(
    shouldUseImmediateResponseShortcut(
      { action: 'respond' } as any,
      { allowAutonomousRouting: true } as any,
    ),
    true,
  );
  assert.equal(
    shouldUseImmediateResponseShortcut(
      { action: 'clarify' } as any,
      { allowAutonomousRouting: true } as any,
    ),
    true,
  );
  assert.equal(
    shouldUseImmediateResponseShortcut(
      { action: 'respond' } as any,
      { allowAutonomousRouting: false } as any,
    ),
    true,
  );
  assert.equal(
    shouldUseImmediateResponseShortcut(
      { action: 'route' } as any,
      { allowAutonomousRouting: false } as any,
    ),
    false,
  );
});

test('evaluateSkillClarifyGate can short-circuit autonomous skill execution into clarify mode', () => {
  const result = evaluateSkillClarifyGate({
    message: '帮我继续做品牌 KV',
    attachments: [],
    metadata: {
      allowAutonomousRouting: true,
      skillFollowUpMode: 'auto-clarify',
      skillClarifyChecklist: ['品牌调性', '受众定位', '视觉参考'],
      skillData: {
        id: 'brand-skill',
        config: {
          followUpMode: 'auto-clarify',
          clarifyChecklist: ['品牌调性', '受众定位', '视觉参考'],
        },
      },
    } as any,
  });

  assert.equal(result.shouldClarify, true);
  if (!result.shouldClarify) return;
  assert.equal(result.questions.length > 0, true);
  assert.equal(result.suggestions.includes('补充品牌调性'), true);
});

