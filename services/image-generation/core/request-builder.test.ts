import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildOpenAIImageEditFormData,
  buildOpenAIImageEditJsonPayload,
  buildOpenAIImageGenerationBody,
} from './request-builder.ts'

test('buildOpenAIImageEditJsonPayload emits OpenAI-compatible image edit shape', () => {
  const payload = buildOpenAIImageEditJsonPayload({
    model: 'gpt-image-2',
    prompt: 'replace background',
    size: '1024x1024',
    quality: 'high',
    referenceImages: ['data:image/png;base64,aaa', 'data:image/png;base64,bbb'],
    maskImage: 'data:image/png;base64,mask',
  })

  assert.deepEqual(payload, {
    model: 'gpt-image-2',
    prompt: 'replace background',
    images: [
      { image_url: 'data:image/png;base64,aaa' },
      { image_url: 'data:image/png;base64,bbb' },
    ],
    size: '1024x1024',
    quality: 'high',
    mask: { image_url: 'data:image/png;base64,mask' },
  })
})

test('buildOpenAIImageGenerationBody only includes optional fields when present', () => {
  const withOptional = buildOpenAIImageGenerationBody({
    model: 'gpt-image-2',
    prompt: 'generate a poster',
    size: '1536x1024',
    quality: 'medium',
    background: 'transparent',
    outputFormat: 'webp',
    outputCompression: 85,
    moderation: 'low',
    n: 1,
    partialImages: 1,
    stream: true,
    normalizedAspectRatio: '3:2',
  })

  assert.deepEqual(withOptional, {
    model: 'gpt-image-2',
    prompt: 'generate a poster',
    size: '1536x1024',
    quality: 'medium',
    background: 'transparent',
    output_format: 'webp',
    output_compression: 85,
    moderation: 'low',
    n: 1,
    partial_images: 1,
    stream: true,
    aspect_ratio: '3:2',
  })

  const minimal = buildOpenAIImageGenerationBody({
    model: 'gpt-image-2',
    prompt: 'generate a poster',
    size: '1024x1024',
    normalizedAspectRatio: null,
  })

  assert.deepEqual(minimal, {
    model: 'gpt-image-2',
    prompt: 'generate a poster',
    size: '1024x1024',
  })
})

test('buildOpenAIImageEditFormData appends references and mask in stable order', async () => {
  const payloadCalls: Array<{ dataUrl: string; baseName: string }> = []
  const result = buildOpenAIImageEditFormData({
    model: 'gpt-image-2',
    prompt: 'edit image',
    size: '1024x1024',
    quality: 'low',
    referenceImages: ['data:image/png;base64,aaa', 'data:image/jpeg;base64,bbb'],
    maskImage: 'data:image/png;base64,mask',
    dataUrlToFilePayload: (dataUrl, baseName) => {
      payloadCalls.push({ dataUrl, baseName })
      const mimeType = dataUrl.includes('jpeg') ? 'image/jpeg' : 'image/png'
      return {
        blob: new Blob([baseName], { type: mimeType }),
        filename: `${baseName}.${mimeType === 'image/jpeg' ? 'jpg' : 'png'}`,
      }
    },
  })

  assert.equal(result.imageFieldName, 'image[]')
  assert.deepEqual(result.referenceMimeTypes, ['image/png', 'image/jpeg'])
  assert.equal(result.maskMimeType, 'image/png')
  assert.deepEqual(payloadCalls, [
    { dataUrl: 'data:image/png;base64,aaa', baseName: 'image-1' },
    { dataUrl: 'data:image/jpeg;base64,bbb', baseName: 'image-2' },
    { dataUrl: 'data:image/png;base64,mask', baseName: 'mask' },
  ])

  const entries = Array.from(result.formData.entries())
  assert.deepEqual(
    entries.map(([key, value]) => [key, typeof value === 'string' ? value : value.name]),
    [
      ['model', 'gpt-image-2'],
      ['prompt', 'edit image'],
      ['size', '1024x1024'],
      ['quality', 'low'],
      ['output_format', 'png'],
      ['n', '1'],
      ['response_format', 'b64_json'],
      ['image[]', 'image-1.png'],
      ['image[]', 'image-2.jpg'],
      ['mask', 'mask.png'],
    ],
  )

  const imageFiles = await Promise.all(
    entries
      .filter(([key]) => key === 'image[]')
      .map(async ([, value]) => ({
        name: (value as File).name,
        type: (value as File).type,
        text: await (value as File).text(),
      })),
  )

  assert.deepEqual(imageFiles, [
    { name: 'image-1.png', type: 'image/png', text: 'image-1' },
    { name: 'image-2.jpg', type: 'image/jpeg', text: 'image-2' },
  ])
})

test('buildOpenAIImageEditFormData skips invalid data urls instead of throwing', () => {
  const result = buildOpenAIImageEditFormData({
    model: 'gpt-image-2',
    prompt: 'edit image',
    size: '1024x1024',
    referenceImages: ['data:image/png;base64,%%%not-valid%%%'],
    maskImage: 'data:image/png;base64,a Gk',
    dataUrlToFilePayload: (dataUrl, baseName) => {
      if (baseName === 'image-1') return null
      return {
        blob: new Blob(['ok'], { type: 'image/png' }),
        filename: `${baseName}.png`,
      }
    },
  })

  const entries = Array.from(result.formData.entries())
  assert.equal(entries.filter(([key]) => key === 'image[]').length, 0)
  assert.equal(entries.filter(([key]) => key === 'mask').length, 1)
})
