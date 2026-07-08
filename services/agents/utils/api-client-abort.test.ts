import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchWithResilience } from '../../http/api-client.ts';

test('fetchWithResilience stops retry backoff when external signal aborts after a retryable response', async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  let fetchCalls = 0;

  globalThis.fetch = (async () => {
    fetchCalls += 1;
    controller.abort();
    return new Response('rate limited', {
      status: 429,
      headers: {
        'content-type': 'text/plain',
      },
    });
  }) as typeof globalThis.fetch;

  try {
    await assert.rejects(
      () =>
        fetchWithResilience(
          'https://example.com/image',
          {
            signal: controller.signal,
          },
          {
            operation: 'test.fetchWithResilience',
            retries: 2,
            baseDelayMs: 10,
            maxDelayMs: 10,
          },
        ),
      (error: unknown) =>
        error instanceof DOMException && error.name === 'AbortError',
    );

    assert.equal(fetchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
