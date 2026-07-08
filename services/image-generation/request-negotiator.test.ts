import assert from 'node:assert/strict';
import test from 'node:test';

import { negotiateImageToolRequest } from './request-negotiator.ts';

test('negotiateImageToolRequest does not impose a project-level maximum for image count', () => {
  const negotiated = negotiateImageToolRequest({
    prompt: 'Generate 24 separate product detail page images, not a collage.',
    model: 'GPT Image 2',
    n: 24,
  });

  assert.equal(negotiated.normalized.n, 24);
  assert.equal(negotiated.request.n, 24);
});

test('negotiateImageToolRequest normalizes GPT Image 2 ratio, quality, and exact size', () => {
  const negotiated = negotiateImageToolRequest({
    prompt: '生成一张竖版主视觉',
    model: 'GPT Image 2',
    aspectRatio: '1:4',
    imageSize: '4K',
    quality: 'hd',
  });

  assert.equal(negotiated.normalized.model, 'gpt-image-2');
  assert.equal(negotiated.request.aspectRatio, '9:16');
  assert.equal(negotiated.request.imageSize, '4K');
  assert.equal(negotiated.request.exactSize, '2160x3840');
  assert.equal(negotiated.request.imageQuality, 'high');
  assert.equal(
    negotiated.warnings.some((item) => item.code === 'ASPECT_RATIO_NORMALIZED'),
    true,
  );
});

test('negotiateImageToolRequest keeps Gemini 3.1 Flash 9:16 4K preset request intact', () => {
  const negotiated = negotiateImageToolRequest({
    prompt: 'Generate a 9:16 poster',
    model: 'NanoBanana2',
    aspectRatio: '9:16',
    imageSize: '4K',
    quality: 'medium',
  });

  assert.equal(negotiated.request.aspectRatio, '9:16');
  assert.equal(negotiated.request.imageSize, '4K');
  assert.equal(negotiated.request.exactSize, undefined);
  assert.equal(negotiated.request.imageQuality, 'medium');
  assert.equal(negotiated.capability.providerFamily, 'gemini-native');
});

test('negotiateImageToolRequest backfills ratio and size from prompt hints when fields are omitted', () => {
  const negotiated = negotiateImageToolRequest({
    prompt: '生成一张亚洲年轻美女图，4K，9:16',
    model: 'GPT Image 2',
  });

  assert.equal(negotiated.request.aspectRatio, '9:16');
  assert.equal(negotiated.request.imageSize, '4K');
});
