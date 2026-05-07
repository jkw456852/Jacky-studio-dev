import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDecision,
  buildRuntimeMessage,
  buildRuntimeSnapshot,
  collectExecutableSkillCalls,
} from './main-brain-runtime.ts';

const baseTurns = [
  {
    turn: 1,
    inputMessage: '生成一张商品图',
    plan: { message: '先生成' },
    decision: {
      turn: 1,
      action: 'execute-skills',
      summary: 'Planner returned a decision. Next action: execute 1 skill call(s).',
      skillCallCount: 1,
      messagePreview: '先生成',
    },
    skillCalls: [{ skillName: 'generateImage', params: { prompt: 'a' } }],
    skillResults: [{ success: true, result: 'https://img.example/1.png' }],
    assets: [{ id: 'asset-1', type: 'image', url: 'https://img.example/1.png', metadata: {} }],
  },
] as any;

const baseObservations = [
  {
    turn: 0,
    phase: 'understand',
    summary: 'Loaded raw user request, attachments, and current workspace context.',
  },
  {
    turn: 1,
    phase: 'observe',
    summary: 'Tool round finished with 1 success and 0 failure. Produced 1 asset(s).',
    skillCallCount: 1,
    successfulSkillCount: 1,
    failedSkillCount: 0,
    assetCount: 1,
  },
] as any;

test('buildRuntimeSnapshot summarizes turns, assets, and failures', () => {
  const snapshot = buildRuntimeSnapshot(baseTurns, baseObservations, 2);

  assert.equal(snapshot.currentTurn, 1);
  assert.equal(snapshot.executionRounds, 2);
  assert.equal(snapshot.lastAction, 'execute-skills');
  assert.equal(snapshot.lastObservation, baseObservations[1].summary);
  assert.equal(snapshot.totalSkillCalls, 1);
  assert.equal(snapshot.totalAssets, 1);
  assert.equal(snapshot.failureCount, 0);
});

test('buildRuntimeMessage includes snapshot, observations, and latest turn hints', () => {
  const snapshot = buildRuntimeSnapshot(baseTurns, baseObservations, 2);
  const message = buildRuntimeMessage('帮我生成商品图', baseTurns, baseObservations, snapshot);

  assert.match(message, /\[Original User Request\]/);
  assert.match(message, /帮我生成商品图/);
  assert.match(message, /\[Runtime State Snapshot\]/);
  assert.match(message, /totalSkillCalls=1/);
  assert.match(message, /\[Runtime Observations\]/);
  assert.match(message, /\[Latest Turn Result\]/);
  assert.match(message, /latestAssetUrls=https:\/\/img\.example\/1\.png/);
  assert.match(message, /\[Decision Instruction\]/);
});

test('collectExecutableSkillCalls returns only populated skill call arrays', () => {
  assert.deepEqual(collectExecutableSkillCalls(null), []);
  assert.deepEqual(collectExecutableSkillCalls({}), []);
  assert.deepEqual(collectExecutableSkillCalls({ skillCalls: [] }), []);
  assert.deepEqual(collectExecutableSkillCalls({ skillCalls: [{ skillName: 'generateImage' }] }), [
    { skillName: 'generateImage' },
  ]);
});

test('buildDecision infers execution intent from plan skill calls', () => {
  const decision = buildDecision(2, {
    message: '继续执行',
    analysis: '需要再调一次工具',
    skillCalls: [{ skillName: 'generateImage' }],
  }, [{ skillName: 'generateImage' }]);

  assert.equal(decision.turn, 2);
  assert.equal(decision.action, 'execute-skills');
  assert.equal(decision.skillCallCount, 1);
  assert.equal(decision.messagePreview, '继续执行');
  assert.match(decision.summary, /execute 1 skill call\(s\)/);
});
