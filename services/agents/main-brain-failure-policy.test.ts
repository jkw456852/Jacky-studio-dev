import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyMainBrainFailure,
  computeMainBrainRetryDelay,
  decideMainBrainRetry,
  retryMainBrainOperation,
  summarizeMainBrainSkillFailures,
} from './main-brain-failure-policy.ts';

test('classifyMainBrainFailure marks rate limits as retryable', () => {
  const result = classifyMainBrainFailure(new Error('429 rate limit exceeded'));

  assert.equal(result.category, 'rate-limited');
  assert.equal(result.retryable, true);
  assert.equal(result.userActionRequired, false);
});

test('classifyMainBrainFailure marks missing uploads as user action required', () => {
  const result = classifyMainBrainFailure(
    new Error('请先上传至少 1 张商品图片，我再继续执行。'),
  );

  assert.equal(result.category, 'user-input-required');
  assert.equal(result.retryable, false);
  assert.equal(result.userActionRequired, true);
});

test('decideMainBrainRetry stops retrying once max retries is reached', () => {
  const result = decideMainBrainRetry({
    error: new Error('503 overloaded'),
    attempt: 3,
    maxRetries: 3,
  });

  assert.equal(result.classification.category, 'provider-overloaded');
  assert.equal(result.shouldRetry, false);
});

test('summarizeMainBrainSkillFailures counts retryable and blocking failures separately', () => {
  const result = summarizeMainBrainSkillFailures([
    { success: false, error: '503 overloaded' },
    { success: false, error: '请先上传商品图' },
    { success: true },
  ]);

  assert.equal(result.totalFailures, 2);
  assert.equal(result.retryableFailures, 1);
  assert.equal(result.userActionFailures, 1);
  assert.equal(result.blockingFailures, 1);
});

test('computeMainBrainRetryDelay applies a higher floor to rate limited retries', () => {
  assert.equal(computeMainBrainRetryDelay(0, 1500), 1500);
  assert.equal(
    computeMainBrainRetryDelay(0, 1500, {
      category: 'rate-limited',
      retryable: true,
      shouldEscalateToUser: false,
      userActionRequired: false,
      shouldFallbackProvider: false,
      summary: 'rate limited',
      message: 'rate limited',
    }),
    3000,
  );
  assert.equal(
    computeMainBrainRetryDelay(1, 1500, {
      category: 'rate-limited',
      retryable: true,
      shouldEscalateToUser: false,
      userActionRequired: false,
      shouldFallbackProvider: false,
      summary: 'rate limited',
      message: 'rate limited',
    }),
    6000,
  );
});

test('retryMainBrainOperation accepts object signature and invokes operation', async () => {
  let called = 0;

  const result = await retryMainBrainOperation({
    operation: async () => {
      called += 1;
      return 'ok';
    },
    label: 'test.main-brain',
    maxRetries: 1,
  });

  assert.equal(result, 'ok');
  assert.equal(called, 1);
});
