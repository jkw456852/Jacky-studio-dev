import assert from 'node:assert/strict'
import test from 'node:test'

import {
  decideOpenAIImageRoute,
  isOfficialOpenAIBaseUrl,
} from './request-router.ts'

const normalizeUrl = (baseUrl: string) => String(baseUrl || '').replace(/\/+$/, '')

test('isOfficialOpenAIBaseUrl detects official OpenAI hosts', () => {
  assert.equal(isOfficialOpenAIBaseUrl(normalizeUrl, 'https://api.openai.com/v1'), true)
  assert.equal(isOfficialOpenAIBaseUrl(normalizeUrl, 'https://foo.openai.com'), true)
  assert.equal(isOfficialOpenAIBaseUrl(normalizeUrl, 'https://example.com'), false)
})

test('decideOpenAIImageRoute returns generate route for plain text-to-image requests', () => {
  const route = decideOpenAIImageRoute({
    baseUrl: 'https://api.openai.com',
    model: 'gpt-image-2',
    providerId: null,
    normalizedReferenceCount: 0,
    hasMask: false,
    size: '1024x1024',
    requestMode: 'standard',
    resolveImageModelPostPath: ({ hasReferences }) =>
      hasReferences ? '/v1/images/edits' : '/v1/images/generations',
    isGptImage2FamilyModel: () => true,
    normalizeUrl,
  })

  assert.equal(route.route, '/v1/images/generations')
  assert.equal(route.effectiveRoute, '/v1/images/generations')
  assert.equal(route.isEditRequest, false)
  assert.equal(route.shouldUseJsonEditPayload, false)
  assert.equal(route.imageFieldMode, 'json')
})

test('decideOpenAIImageRoute chooses json edit payload for official GPT Image 2 edit transfers', () => {
  const route = decideOpenAIImageRoute({
    baseUrl: 'https://api.openai.com',
    model: 'gpt-image-2',
    providerId: 'openai',
    normalizedReferenceCount: 2,
    hasMask: false,
    size: 'auto',
    requestMode: 'official-transfer',
    resolveImageModelPostPath: () => '/v1/images/edits',
    isGptImage2FamilyModel: () => true,
    normalizeUrl,
  })

  assert.equal(route.route, '/v1/images/edits')
  assert.equal(route.isEditRequest, true)
  assert.equal(route.shouldUseJsonEditPayload, true)
  assert.equal(route.imageFieldMode, 'json-image-ref-array')
})

test('decideOpenAIImageRoute falls back to multipart modes for non-official or non-transfer edits', () => {
  const multi = decideOpenAIImageRoute({
    baseUrl: 'https://proxy.example.com',
    model: 'gpt-image-2',
    providerId: 'proxy',
    normalizedReferenceCount: 3,
    hasMask: false,
    size: '1024x1024',
    requestMode: 'standard',
    resolveImageModelPostPath: () => '/v1/images/edits',
    isGptImage2FamilyModel: () => true,
    normalizeUrl,
  })

  assert.equal(multi.shouldUseJsonEditPayload, false)
  assert.equal(multi.imageFieldMode, 'multi-file-repeated-field')

  const single = decideOpenAIImageRoute({
    baseUrl: 'https://proxy.example.com',
    model: 'gpt-image-2',
    providerId: 'proxy',
    normalizedReferenceCount: 1,
    hasMask: true,
    size: '1024x1024',
    requestMode: 'standard',
    resolveImageModelPostPath: () => '/v1/images/edits',
    isGptImage2FamilyModel: () => true,
    normalizeUrl,
  })

  assert.equal(single.shouldUseJsonEditPayload, false)
  assert.equal(single.imageFieldMode, 'single-file')
})
