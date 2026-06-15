import assert from 'node:assert/strict'
import test from 'node:test'

import {
  pollOpenAICompatibleImageResult,
  runOpenAITransportWithFallback,
  type OpenAITransportAuthMode,
} from './transport-runner.ts'

const createJsonResponse = (payload: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(payload), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  })

test('runOpenAITransportWithFallback returns parsed success payload and caches winning auth mode', async () => {
  const authModeHits: OpenAITransportAuthMode[] = []

  const result = await runOpenAITransportWithFallback<{ ok: boolean }>({
    baseUrl: 'https://example.com',
    path: '/v1/images/generations',
    apiKeys: ['key-a'],
    authPlans: ['bearer'],
    contextTag: 'transport.success',
    isTimeoutError: () => false,
    shouldTryAlternateAuth: () => false,
    isRateLimited: () => false,
    isServerError: () => false,
    onAuthModeSuccess: (mode) => {
      authModeHits.push(mode)
    },
    send: async () => createJsonResponse({ ok: true }),
    parseSuccess: async (response) => response.json() as Promise<{ ok: boolean }>,
  })

  assert.deepEqual(result, { ok: true })
  assert.deepEqual(authModeHits, ['bearer'])
})

test('runOpenAITransportWithFallback retries next api key after timeout', async () => {
  const attempts: Array<{ authMode: OpenAITransportAuthMode; keyIndex: number }> = []

  const result = await runOpenAITransportWithFallback<{ winner: string }>({
    baseUrl: 'https://example.com',
    path: '/v1/images/generations',
    apiKeys: ['key-a', 'key-b'],
    authPlans: ['bearer'],
    contextTag: 'transport.timeout',
    isTimeoutError: (error) => String((error as Error)?.message || '').includes('timeout'),
    shouldTryAlternateAuth: () => false,
    isRateLimited: () => false,
    isServerError: () => false,
    send: async ({ authMode, keyIndex }) => {
      attempts.push({ authMode, keyIndex })
      if (keyIndex === 0) {
        throw new Error('request timeout after 10s')
      }
      return createJsonResponse({ winner: 'key-b' })
    },
    parseSuccess: async (response) => response.json() as Promise<{ winner: string }>,
  })

  assert.equal(result.winner, 'key-b')
  assert.deepEqual(attempts, [
    { authMode: 'bearer', keyIndex: 0 },
    { authMode: 'bearer', keyIndex: 1 },
  ])
})

test('runOpenAITransportWithFallback rejects auth mode and falls through to next plan on 401', async () => {
  const rejected: Array<{ mode: OpenAITransportAuthMode; status: number }> = []

  const result = await runOpenAITransportWithFallback<{ mode: string }>({
    baseUrl: 'https://example.com',
    path: '/v1/images/generations',
    apiKeys: ['key-a'],
    authPlans: ['bearer', 'query'],
    contextTag: 'transport.auth-fallback',
    isTimeoutError: () => false,
    shouldTryAlternateAuth: (status) => status === 401,
    isRateLimited: () => false,
    isServerError: () => false,
    onAuthModeRejected: (mode, status) => {
      rejected.push({ mode, status })
    },
    send: async ({ authMode }) => {
      if (authMode === 'bearer') {
        return new Response('unauthorized', { status: 401 })
      }
      return createJsonResponse({ mode: 'query' })
    },
    parseSuccess: async (response) => response.json() as Promise<{ mode: string }>,
  })

  assert.equal(result.mode, 'query')
  assert.deepEqual(rejected, [{ mode: 'bearer', status: 401 }])
})

test('runOpenAITransportWithFallback delegates 429 and 5xx continuation policy', async () => {
  let rateLimitContinues = 0
  let serverContinues = 0
  let attempt = 0

  const result = await runOpenAITransportWithFallback<{ ok: boolean }>({
    baseUrl: 'https://example.com',
    path: '/v1/chat/completions',
    apiKeys: ['key-a'],
    authPlans: ['bearer'],
    contextTag: 'transport.http-policy',
    isTimeoutError: () => false,
    shouldTryAlternateAuth: () => false,
    isRateLimited: (status) => status === 429,
    isServerError: (status) => status >= 500,
    shouldContinueOnRateLimit: async () => {
      rateLimitContinues += 1
      return true
    },
    shouldContinueOnServerError: () => {
      serverContinues += 1
      return true
    },
    send: async () => {
      attempt += 1
      if (attempt === 1) return new Response('rate limit', { status: 429 })
      if (attempt === 2) return new Response('server error', { status: 503 })
      return createJsonResponse({ ok: true })
    },
    parseSuccess: async (response) => response.json() as Promise<{ ok: boolean }>,
  })

  assert.equal(result.ok, true)
  assert.equal(rateLimitContinues, 1)
  assert.equal(serverContinues, 1)
})

test('pollOpenAICompatibleImageResult returns direct image when polling payload resolves', async () => {
  const seenPaths: string[] = []

  const result = await pollOpenAICompatibleImageResult({
    taskId: 'task-1',
    contextTag: 'poll.direct',
    intervalMs: 0,
    maxAttempts: 1,
    fetchJson: async (path) => {
      seenPaths.push(path)
      return {
        data: [{ url: 'https://example.com/out.png' }],
      }
    },
  })

  assert.equal(result, 'https://example.com/out.png')
  assert.deepEqual(seenPaths, ['/v1/images/task-1'])
})

test('pollOpenAICompatibleImageResult throws failed task payload errors', async () => {
  await assert.rejects(
    async () => {
      await pollOpenAICompatibleImageResult({
        taskId: 'task-2',
        contextTag: 'poll.failed',
        intervalMs: 0,
        maxAttempts: 1,
        fetchJson: async () => ({
          id: 'task-2',
          status: 'failed',
        }),
      })
    },
    /openai image polling failed/,
  )
})
