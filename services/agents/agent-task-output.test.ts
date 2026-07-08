import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAgentTaskOutput,
  buildMainBrainRuntimeEnvelope,
  buildMainBrainTaskOutput,
  buildSkillExecutionRuntimeEnvelope,
  getTaskOutputAssets,
  getTaskOutputProposals,
} from './agent-task-output.ts';

test('buildSkillExecutionRuntimeEnvelope summarizes skill execution counts', () => {
  const result = buildSkillExecutionRuntimeEnvelope({
    assets: [{ id: 'a', type: 'image', url: 'u', metadata: { agentId: 'coco' } }],
    skillResults: [{ success: true }, { success: false }],
    proposals: [{ id: 'p1' }],
  });

  assert.equal(result.mode, 'skill-execution');
  assert.equal(result.assetCount, 1);
  assert.equal(result.skillCallCount, 2);
  assert.equal(result.successfulSkillCount, 1);
  assert.equal(result.failedSkillCount, 1);
  assert.equal(result.proposalCount, 1);
});

test('buildMainBrainRuntimeEnvelope includes stop reason and execution summary', () => {
  const result = buildMainBrainRuntimeEnvelope(
    {
      turns: [{}, {}] as any,
      observations: [],
      decisions: [],
      snapshots: [{ executionRounds: 1 }, { executionRounds: 2 }] as any,
      finalPlan: { proposals: [{ id: 'p1' }, { id: 'p2' }] },
      allSkillResults: [{ success: true }, { success: false }],
      allAssets: [{ id: 'a', type: 'image', url: 'u', metadata: { agentId: 'coco' } }],
      stopReason: 'stalled',
    } as any,
    'stalled',
  );

  assert.equal(result.mode, 'autonomous-main-brain');
  assert.equal(result.stopReason, 'stalled');
  assert.equal(result.stopReasonLabel, 'stalled');
  assert.equal(result.executionRounds, 2);
  assert.equal(result.turnCount, 2);
  assert.equal(result.proposalCount, 2);
});

test('task output helpers safely normalize missing assets and proposals', () => {
  assert.deepEqual(getTaskOutputAssets(undefined), []);
  assert.deepEqual(getTaskOutputProposals(undefined), []);
  assert.equal(
    getTaskOutputAssets({ output: { assets: [{ id: 'a', type: 'image', url: 'u', metadata: { agentId: 'coco' } }] } }).length,
    1,
  );
  assert.equal(
    getTaskOutputProposals({ output: { proposals: [{ id: 'p1' }] } }).length,
    1,
  );
});

test('buildMainBrainTaskOutput normalizes final plan and runtime result into task output payload', () => {
  const asset = { id: 'a', type: 'image', url: 'u', metadata: { agentId: 'coco' } } as any;
  const result = buildMainBrainTaskOutput({
    finalPlan: {
      analysis: '分析结论',
      preGenerationMessage: '开始生成',
      proposals: [{ id: 'p1' }],
    },
    assets: [asset],
    runtimeResult: {
      turns: [{}, {}] as any,
      observations: [],
      decisions: [],
      snapshots: [{ executionRounds: 2 }] as any,
      finalPlan: { proposals: [{ id: 'p1' }] },
      allSkillResults: [{ success: true, skillName: 'generateImage' }],
      allAssets: [asset],
      stopReason: 'responded',
    } as any,
    resolvedOutput: {
      message: '已完成输出',
      postGenerationSummary: '本轮总结',
      adjustments: ['继续微调'],
      stopReasonLabel: 'answered',
    },
  });

  assert.equal(result.message, '已完成输出');
  assert.equal(result.analysis, '分析结论');
  assert.equal(result.preGenerationMessage, '开始生成');
  assert.equal(result.postGenerationSummary, '本轮总结');
  assert.deepEqual(result.assets, [asset]);
  assert.deepEqual(result.imageUrls, ['u']);
  assert.deepEqual(result.skillCalls, [{ success: true, skillName: 'generateImage' }]);
  assert.deepEqual(result.adjustments, ['继续微调']);
  assert.deepEqual(result.proposals, []);
  assert.equal(result.runtime?.mode, 'autonomous-main-brain');
  assert.equal(result.runtime?.stopReasonLabel, 'answered');
});

test('buildMainBrainTaskOutput sanitizes legacy specialist handoff wording in visible fields', () => {
  const asset = { id: 'a', type: 'image', url: 'u', metadata: { agentId: 'coco' } } as any;
  const result = buildMainBrainTaskOutput({
    finalPlan: {
      analysis: '这次更适合由 Cameron（摄影与写实专家） 处理。',
      preGenerationMessage: '我先交给 Cameron（摄影与写实专家） 执行这一轮。',
      answerSegments: [
        { text: '已由 Cameron（摄影与写实专家） 负责生成第一版结果。' },
      ],
      proposals: [],
    },
    assets: [asset],
    runtimeResult: {
      turns: [{}, {}] as any,
      observations: [],
      decisions: [],
      snapshots: [{ executionRounds: 1 }] as any,
      finalPlan: { proposals: [] },
      allSkillResults: [{ success: true, skillName: 'generateImage' }],
      allAssets: [asset],
      stopReason: 'responded',
    } as any,
    resolvedOutput: {
      message: '本次任务由 Cameron（摄影与写实专家） 调度执行。',
      postGenerationSummary: '这一版已经交给 Cameron（摄影与写实专家） 处理完成。',
      adjustments: [],
      stopReasonLabel: 'answered',
    },
  });

  assert.equal(result.message, '本次任务由我直接处理。');
  assert.equal(result.analysis, '这次更适合由我直接处理。');
  assert.equal(result.preGenerationMessage, '我先直接处理这一轮。');
  assert.equal(result.postGenerationSummary, '这一版已经直接处理完成。');
  assert.equal(result.answerSegments?.[0]?.text, '我已直接生成第一版结果。');
});

test('buildAgentTaskOutput preserves role governance audit for standard completion path', () => {
  const audit = {
    summary: '已自动更新专家壳 poster 的长期 addon。',
    actions: [
      {
        action: 'addon_update',
        targetBaseAgentId: 'poster',
        promptAddonText: '先做结构化拆解，再给执行方案。',
      },
    ],
  } as any;

  const result = buildAgentTaskOutput({
    message: '普通专家完成',
    analysis: '标准完成分支',
    roleGovernanceAudit: audit,
  });

  assert.equal(result.message, '普通专家完成');
  assert.equal(result.analysis, '标准完成分支');
  assert.equal(result.roleGovernanceAudit?.summary, audit.summary);
  assert.deepEqual(result.roleGovernanceAudit?.actions, audit.actions);
});
