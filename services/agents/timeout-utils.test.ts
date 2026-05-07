import assert from 'node:assert/strict';
import test from 'node:test';
import { runWithTimeout, withTimeout } from './timeout-utils.ts';

test('runWithTimeout resolves promise and clears timer', async () => {
  const timerToken = { id: 'timer-1' } as any;
  let clearCalledWith: unknown = null;

  const result = await runWithTimeout({
    promise: Promise.resolve('ok'),
    timeoutMs: 1000,
    createTimeoutError: () => new Error('timeout'),
    setTimeoutFn: ((() => timerToken) as unknown) as typeof globalThis.setTimeout,
    clearTimeoutFn: (((token: unknown) => {
      clearCalledWith = token;
    }) as unknown) as typeof globalThis.clearTimeout,
  });

  assert.equal(result, 'ok');
  assert.equal(clearCalledWith, timerToken);
});

test('runWithTimeout rejects with custom error when timer wins', async () => {
  await assert.rejects(
    () =>
      runWithTimeout({
        promise: new Promise(() => undefined),
        timeoutMs: 5000,
        createTimeoutError: () => new Error('custom-timeout'),
        setTimeoutFn: (((handler: (...args: any[]) => void) => {
          handler();
          return 1 as any;
        }) as unknown) as typeof globalThis.setTimeout,
        clearTimeoutFn: ((() => undefined) as unknown) as typeof globalThis.clearTimeout,
      }),
    /custom-timeout/,
  );
});

test('withTimeout resolves fulfilled promise with shared default wrapper', async () => {
  const result = await withTimeout(Promise.resolve('done'), 1000, 'timed out');
  assert.equal(result, 'done');
});
