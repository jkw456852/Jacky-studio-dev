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


test('resolveMainBrainOutput surfaces upstream details when skills fail and no assets land', () => {
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
          skillResults: [
            {
              success: false,
              skillName: 'generateImage',
              error: 'AI 服务调用失败，请稍后重试',
              errorDetail: {
                rawMessage: 'generateImage.gpt-image-2 API error: 502 [bearer] Server error',
                httpStatus: 502,
                proxyTarget: 'https://www.jisuanyun01.com/v1/images/generations',
              },
            },
          ],
          assets: [],
        },
      ],
      observations: [],
      decisions: [],
      snapshots: [],
      finalPlan: {},
      allSkillResults: [],
      allAssets: [],
      stopReason: 'answered' as any,
    },
    finalPlan: {},
    assets: [],
    getAdjustments: () => [],
    composePostGenerationSummary: () => undefined,
  });

  assert.match(result.message, /generateImage/);
  assert.match(result.message, /www\.jisuanyun01\.com/);
  assert.match(result.message, /502/);
});

test('resolveMainBrainOutput appends failure summary when LLM message omits failure', () => {
  const result = resolveMainBrainOutput({
    task: baseTask,
    runtimeResult: {
      turns: [
        {
          turn: 1,
          inputMessage: 'x',
          plan: {},
          decision: { turn: 1, action: 'respond', summary: 'x', skillCallCount: 1 },
          skillCalls: [{ skillName: 'generateImage', params: {} }],
          skillResults: [
            {
              success: false,
              skillName: 'generateImage',
              error: 'AI 服务调用失败，请稍后重试',
              errorDetail: { httpStatus: 503 },
            },
          ],
          assets: [],
        },
      ],
      observations: [],
      decisions: [],
      snapshots: [],
      finalPlan: { message: '我已经根据当前需求完成了这一轮判断与处理。' },
      allSkillResults: [],
      allAssets: [],
      stopReason: 'answered' as any,
    },
    finalPlan: { message: '我已经根据当前需求完成了这一轮判断与处理。' },
    assets: [],
    getAdjustments: () => [],
    composePostGenerationSummary: () => undefined,
  });

  assert.match(result.message, /我已经根据当前需求完成了这一轮判断与处理/);
  assert.match(result.message, /generateImage/);
  assert.match(result.message, /503/);
});


test('resolveMainBrainOutput tells the user when planner skipped all tools', () => {
  const result = resolveMainBrainOutput({
    task: baseTask,
    runtimeResult: {
      turns: [
        {
          turn: 1,
          inputMessage: '生成一张4k分辨率的日本美女图',
          plan: {},
          decision: { turn: 1, action: 'respond', summary: 'x', skillCallCount: 0 },
          skillCalls: [],
          skillResults: [],
          assets: [],
        },
      ],
      observations: [],
      decisions: [],
      snapshots: [],
      finalPlan: {},
      allSkillResults: [],
      allAssets: [],
      stopReason: 'responded' as any,
    },
    finalPlan: {},
    assets: [],
    getAdjustments: () => [],
    composePostGenerationSummary: () => undefined,
  });

  assert.match(result.message, /没有调用任何工具/);
  assert.doesNotMatch(result.message, /完成了这一轮判断与处理/);
});
