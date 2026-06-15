import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildOpenAIFormHeaders,
  buildOpenAIHeaders,
  buildOpenAIPath,
  buildOpenAIUrl,
  clearCachedOpenAIAuthMode,
  getCachedOpenAIAuthMode,
  getOpenAIAuthCacheEntryKey,
  isRateLimited,
  isServerError,
  normalizeApiKeyCandidates,
  normalizeUrl,
  resolveOpenAIAuthPlans,
  setCachedOpenAIAuthMode,
  shouldAllowQueryAuthFallback,
  shouldTryAlternateAuth,
} from './auth.ts'

const createLocalStorageStub = () => {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
    dump: () => Object.fromEntries(store.entries()),
  }
}

test('auth helpers normalize URLs and build auth-specific paths/headers', () => {
  assert.equal(normalizeUrl(' https://api.openai.com/v1/ '), 'https://api.openai.com/v1')
  assert.equal(normalizeUrl(''), 'https://generativelanguage.googleapis.com')

  assert.equal(
    buildOpenAIPath('https://api.openai.com/v1/', '/images/generations'),
    'https://api.openai.com/v1/images/generations',
  )
  assert.equal(
    buildOpenAIUrl('https://api.openai.com/v1', '/images/generations', 'query', 'k ey'),
    'https://api.openai.com/v1/images/generations?key=k%20ey',
  )

  assert.deepEqual(buildOpenAIHeaders('bearer', 'secret'), {
    'Content-Type': 'application/json',
    Authorization: 'Bearer secret',
  })
  assert.deepEqual(buildOpenAIHeaders('query', 'secret'), {
    'Content-Type': 'application/json',
  })
  assert.deepEqual(buildOpenAIFormHeaders('bearer', 'secret'), {
    Authorization: 'Bearer secret',
  })
})

test('auth strategy helpers choose plans and host/path fallback rules correctly', () => {
  assert.equal(shouldTryAlternateAuth(401), true)
  assert.equal(shouldTryAlternateAuth(404), true)
  assert.equal(shouldTryAlternateAuth(500), false)
  assert.equal(isRateLimited(429), true)
  assert.equal(isServerError(503), true)

  assert.deepEqual(resolveOpenAIAuthPlans(undefined, 'bearer-only', true), ['bearer'])
  assert.deepEqual(resolveOpenAIAuthPlans(undefined, 'query-only', true), ['query'])
  assert.deepEqual(resolveOpenAIAuthPlans(undefined, 'auto', false), ['bearer'])
  assert.deepEqual(resolveOpenAIAuthPlans('query', 'auto', true), ['query', 'bearer'])

  assert.equal(shouldAllowQueryAuthFallback('https://api3.wlai.vip', '/v1/chat/completions'), false)
  assert.equal(shouldAllowQueryAuthFallback('https://api.bltcy.ai', '/v1/images/edits'), false)
  assert.equal(shouldAllowQueryAuthFallback('https://api.bltcy.ai', '/v1/responses'), true)
})

test('auth helpers normalize api key candidates and persist cached auth mode', () => {
  const originalWindow = (globalThis as any).window
  const localStorage = createLocalStorageStub()
  ;(globalThis as any).window = { localStorage }

  try {
    const cacheKey = getOpenAIAuthCacheEntryKey('https://api.openai.com/v1/', '/images/generations')
    clearCachedOpenAIAuthMode(cacheKey)

    assert.deepEqual(normalizeApiKeyCandidates([' key-a ', '', '#comment', 'key-b', 'key-a']), [
      'key-a',
      'key-b',
    ])

    assert.equal(getCachedOpenAIAuthMode(cacheKey), undefined)
    setCachedOpenAIAuthMode(cacheKey, 'bearer')
    assert.equal(getCachedOpenAIAuthMode(cacheKey), 'bearer')
    assert.match(
      String(localStorage.getItem('openai_auth_mode_cache_v1')),
      /bearer/,
    )

    clearCachedOpenAIAuthMode(cacheKey)
    assert.equal(getCachedOpenAIAuthMode(cacheKey), undefined)
  } finally {
    ;(globalThis as any).window = originalWindow
  }
})
