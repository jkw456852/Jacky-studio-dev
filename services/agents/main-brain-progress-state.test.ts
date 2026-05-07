import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMainBrainTaskProgressUpdate, resolveMainBrainProgressState } from './main-brain-progress-state.ts';

test('resolveMainBrainProgressState maps execute to step 3 executing', () => {
  const result = resolveMainBrainProgressState('execute');
  assert.equal(result.status, 'executing');
  assert.equal(result.progressStep, 3);
  assert.equal(result.totalSteps, 4);
});

test('resolveMainBrainProgressState maps respond to final step', () => {
  const result = resolveMainBrainProgressState('respond');
  assert.equal(result.status, 'executing');
  assert.equal(result.progressStep, 4);
  assert.equal(result.totalSteps, 4);
});

test('buildMainBrainTaskProgressUpdate merges progress state and message into task payload', () => {
  const task = {
    id: 'task-1',
    status: 'pending',
    input: {
      message: '生成一张商品图',
      context: {},
    },
    createdAt: 1,
    updatedAt: 1,
  } as any;

  const result = buildMainBrainTaskProgressUpdate(
    task,
    'execute',
    '正在执行 2 个工具调用。',
  );

  assert.equal(result.status, 'executing');
  assert.equal(result.progressStep, 3);
  assert.equal(result.totalSteps, 4);
  assert.equal(result.progressMessage, '正在执行 2 个工具调用。');
  assert.equal(result.id, task.id);
});
