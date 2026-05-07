import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveMainBrainOutput } from './main-brain-output.ts';

const baseTask = {
  id: 'task-1',
  agentId: 'coco',
  status: 'completed',
  input: {
    message: '帮我看看这个功能',
    context: {} as any,
  },
  createdAt: 1,
  updatedAt: 1,
} as any;

test('resolveMainBrainOutput marks wait-for-input explicitly', () => {
  const result = resolveMainBrainOutput({
    task: baseTask,
    runtimeResult: {
      turns: [],
      observations: [],
      decisions: [],
      snapshots: [],
      finalPlan: {},
      allSkillResults: [],
      allAssets: [],
      stopReason: 'wait-for-input',
    },
    finalPlan: {
      questions: ['请补一张正面截图'],
    },
    assets: [],
    getAdjustments: () => [],
    composePostGenerationSummary: () => undefined,
  });

  assert.equal(result.shouldAskUserForNextInput, true);
  assert.equal(result.stopReasonLabel, 'need-user-input');
  assert.deepEqual(result.adjustments, ['请补一张正面截图']);
});

test('resolveMainBrainOutput builds retry suggestions for stalled failures', () => {
  const result = resolveMainBrainOutput({
    task: baseTask,
    runtimeResult: {
      turns: [
        {
          turn: 1,
          inputMessage: 'x',
          plan: {},
          decision: { turn: 1, action: 'execute-skills', summary: 'x', skillCallCount: 1 },
          skillCalls: [{ skillName: 'generateImage', params: {} }],
          skillResults: [{ success: false, error: '503 overloaded' }],
          assets: [],
        },
      ],
      observations: [],
      decisions: [],
      snapshots: [],
      finalPlan: {},
      allSkillResults: [],
      allAssets: [],
      stopReason: 'stalled',
    },
    finalPlan: {},
    assets: [],
    getAdjustments: () => [],
    composePostGenerationSummary: () => undefined,
  });

  assert.equal(result.stopReasonLabel, 'stalled');
  assert.deepEqual(result.adjustments, ['稍后重试一次']);
});
