import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFailedSkillExecutionResult,
  buildReferenceInjectionTelemetry,
  buildSuccessfulSkillExecutionResult,
  buildUnhandledSkillExecutionFailureResult,
  buildSkillTimeoutError,
  DEFAULT_SKILL_TIMEOUT,
  executeSkillWithTimeout,
  normalizeSettledSkillExecutionResults,
  resolveSkillTimeoutMs,
} from './skill-execution-runtime.ts';

test('resolveSkillTimeoutMs returns configured timeout and default fallback', () => {
  assert.equal(resolveSkillTimeoutMs('generateImage'), 180_000);
  assert.equal(resolveSkillTimeoutMs('unknownSkill'), DEFAULT_SKILL_TIMEOUT);
  assert.equal(resolveSkillTimeoutMs('  generateCopy  '), 15_000);
});

test('buildSkillTimeoutError includes skill name and seconds', () => {
  const error = buildSkillTimeoutError('generateImage', 180_000);
  assert.match(error.message, /generateImage/);
  assert.match(error.message, /180s/);
});

test('executeSkillWithTimeout resolves successful skill results and clears timer', async () => {
  const timerToken = { id: 'timer-1' } as any;
  let clearCalledWith: unknown = null;

  const result = await executeSkillWithTimeout({
    skillName: 'generateCopy',
    params: { prompt: 'hello' },
    timeoutMs: 1500,
    executeSkillFn: async () => 'ok',
    setTimeoutFn: ((() => timerToken) as unknown) as typeof globalThis.setTimeout,
    clearTimeoutFn: (((token: unknown) => {
      clearCalledWith = token;
    }) as unknown) as typeof globalThis.clearTimeout,
  });

  assert.equal(result, 'ok');
  assert.equal(clearCalledWith, timerToken);
});

test('executeSkillWithTimeout rejects with timeout error when timer fires first', async () => {
  await assert.rejects(
    () =>
      executeSkillWithTimeout({
        skillName: 'smartEdit',
        params: {},
        timeoutMs: 5000,
        executeSkillFn: () => new Promise(() => undefined),
        setTimeoutFn: (((handler: (...args: any[]) => void) => {
          handler();
          return 1 as any;
        }) as unknown) as typeof globalThis.setTimeout,
        clearTimeoutFn: ((() => undefined) as unknown) as typeof globalThis.clearTimeout,
      }),
    /smartEdit.*5s/,
  );
});

test('result envelope helpers normalize success, handled failure, and unhandled failure', () => {
  const success = buildSuccessfulSkillExecutionResult(
    { skillName: 'generateImage', params: { prompt: 'x' } },
    'result-url',
  );
  const failure = buildFailedSkillExecutionResult(
    { skillName: 'generateImage', params: { prompt: 'x' } },
    'failed',
  );
  const unhandled = buildUnhandledSkillExecutionFailureResult(new Error('boom'));

  assert.deepEqual(success, {
    skillName: 'generateImage',
    params: { prompt: 'x' },
    result: 'result-url',
    success: true,
  });
  assert.deepEqual(failure, {
    skillName: 'generateImage',
    params: { prompt: 'x' },
    error: 'failed',
    success: false,
  });
  assert.equal(unhandled.skillName, 'unknown');
  assert.equal(unhandled.success, false);
  assert.match(String(unhandled.error), /boom/);
});

test('normalizeSettledSkillExecutionResults converts rejected items into unknown failure envelopes', () => {
  const result = normalizeSettledSkillExecutionResults([
    {
      status: 'fulfilled',
      value: {
        skillName: 'generateImage',
        params: {},
        result: 'u',
        success: true,
      },
    },
    {
      status: 'rejected',
      reason: new Error('bad'),
    },
  ]);

  assert.equal(result.length, 2);
  assert.equal(result[0].success, true);
  assert.equal(result[1].skillName, 'unknown');
  assert.equal(result[1].success, false);
  assert.match(String(result[1].error), /bad/);
});

test('buildReferenceInjectionTelemetry returns null when no references were resolved', () => {
  const telemetry = buildReferenceInjectionTelemetry({
    prepared: {
      call: { skillName: 'generateImage', params: {} },
      diagnostics: {},
    },
    call: { skillName: 'generateImage', params: {} },
    task: {
      input: {
        uploadedAttachments: ['a', 'b'],
      },
    } as any,
    maxReferenceImages: 8,
  });

  assert.equal(telemetry, null);
});

test('buildReferenceInjectionTelemetry summarizes truncation and injected reference stats', () => {
  const telemetry = buildReferenceInjectionTelemetry({
    prepared: {
      call: {
        skillName: 'generateImage',
        params: { referenceImages: ['r1', 'r2', 'r3'] },
      },
      diagnostics: {
        referencesResolved: {
          sourceCount: 6,
          injectedCount: 3,
          truncated: true,
          omittedCount: 3,
          autoInjectedAttachmentToken: 'ATTACHMENT_1',
        },
      },
    },
    call: {
      skillName: 'generateImage',
      params: { referenceImages: ['r1', 'r2', 'r3'] },
    },
    task: {
      input: {
        uploadedAttachments: ['up1', 'up2'],
      },
    } as any,
    maxReferenceImages: 3,
  });

  assert.ok(telemetry);
  assert.equal(telemetry?.warningMessage, 'referenceImages truncated to 3');
  assert.deepEqual(telemetry?.stats, {
    maxReferenceImages: 3,
    uploaded_total: 2,
    source_total: 6,
    call_reference_total: 3,
    injected_total: 3,
    truncated: true,
    omitted_total: 3,
    auto_injected_primary: 'ATTACHMENT_1',
  });
});
