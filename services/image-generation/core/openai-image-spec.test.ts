import assert from 'node:assert/strict'
import test from 'node:test'

import {
  resolveCanonicalImageModelDisplayName,
  resolveCanonicalImageModelId,
  resolveOpenAIImageSize,
} from './openai-image-spec.ts'

test('resolveCanonicalImageModelId normalizes Nano Banana family aliases', () => {
  assert.equal(resolveCanonicalImageModelId('Auto'), 'Auto')
  assert.equal(resolveCanonicalImageModelId('Nano Banana Pro'), 'gemini-3-pro-image-preview')
  assert.equal(resolveCanonicalImageModelId('nanobanana pro'), 'gemini-3-pro-image-preview')
  assert.equal(resolveCanonicalImageModelId('gemini-3-pro-image-preview'), 'gemini-3-pro-image-preview')

  assert.equal(resolveCanonicalImageModelId('NanoBanana2'), 'gemini-3.1-flash-image-preview')
  assert.equal(resolveCanonicalImageModelId('nano banana 2'), 'gemini-3.1-flash-image-preview')
  assert.equal(resolveCanonicalImageModelId('gemini-3.1-flash-image-preview'), 'gemini-3.1-flash-image-preview')
})

test('resolveCanonicalImageModelId normalizes Seedream and GPT aliases', () => {
  assert.equal(resolveCanonicalImageModelId('Seedream5.0'), 'doubao-seedream-5-0-260128')
  assert.equal(resolveCanonicalImageModelId('seedream 4'), 'doubao-seedream-5-0-260128')
  assert.equal(resolveCanonicalImageModelId('doubao-seedream-5-0-260128'), 'doubao-seedream-5-0-260128')

  assert.equal(resolveCanonicalImageModelId('gpt-image-2'), 'gpt-image-2')
  assert.equal(resolveCanonicalImageModelId('GPT Image 2'), 'gpt-image-2')
  assert.equal(resolveCanonicalImageModelId('gptimage2'), 'gpt-image-2')
  assert.equal(resolveCanonicalImageModelId('image 2'), 'gpt-image-2')

  assert.equal(resolveCanonicalImageModelId('gpt-image-2-all'), 'gpt-image-2-all')
  assert.equal(resolveCanonicalImageModelId('GPT Image 1.5'), 'gpt-image-1.5-all')
})

test('resolveCanonicalImageModelId handles unknown or empty models gracefully', () => {
  assert.equal(resolveCanonicalImageModelId(''), 'Auto')
  assert.equal(resolveCanonicalImageModelId('some-custom-model'), 'some-custom-model')
  assert.equal(resolveCanonicalImageModelId('Flux.2 Max'), 'flux-pro-max')
})

test('resolveCanonicalImageModelDisplayName maps canonical IDs to product-visible names', () => {
  assert.equal(resolveCanonicalImageModelDisplayName('Auto'), 'NanoBanana2')
  assert.equal(resolveCanonicalImageModelDisplayName('Nano Banana Pro'), 'Nano Banana Pro')
  assert.equal(resolveCanonicalImageModelDisplayName('gemini-3.1-flash-image-preview'), 'NanoBanana2')
  assert.equal(resolveCanonicalImageModelDisplayName('doubao-seedream-5-0-260128'), 'Seedream5.0')
  assert.equal(resolveCanonicalImageModelDisplayName('gpt-image-2-all'), 'gpt-image-2-all')
  assert.equal(resolveCanonicalImageModelDisplayName('flux-pro-max'), 'flux-pro-max')
  assert.equal(resolveCanonicalImageModelDisplayName('unknown-model'), 'unknown-model')
})

test('resolveOpenAIImageSize honors explicit exact sizes over presets', () => {
  assert.equal(
    resolveOpenAIImageSize('gpt-image-2', '1:1', '1K', '1537x865'),
    '1536x864',
  )
  assert.equal(
    resolveOpenAIImageSize('gpt-image-2', '1:1', '1K', '1600x900'),
    '1600x896',
  )
})
