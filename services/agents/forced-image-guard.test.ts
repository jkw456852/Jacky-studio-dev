import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildForcedGenerateImageCall,
  ensureForcedImagePlan,
  extractOriginalUserRequestFromRuntimeMessage,
} from './forced-image-guard.ts';

test('buildForcedGenerateImageCall respects explicit 9:16 and 4K in message', () => {
  const call = buildForcedGenerateImageCall(
    'Generate a portrait poster, 9:16, 4K',
    [],
    {
      preferredAspectRatio: '1:1',
      preferredImageSize: '1K',
    },
  );

  assert.equal(call.params.aspectRatio, '9:16');
  assert.equal(call.params.imageSize, '4K');
  assert.match(call.params.prompt, /9:16 portrait orientation/i);
  assert.match(call.params.prompt, /4k quality/i);
});

test('buildForcedGenerateImageCall falls back to metadata when message has no explicit image settings', () => {
  const call = buildForcedGenerateImageCall(
    'Generate a Japanese fashion poster',
    [],
    {
      preferredAspectRatio: '16:9',
      preferredImageSize: '2K',
    },
  );

  assert.equal(call.params.aspectRatio, '16:9');
  assert.equal(call.params.imageSize, '2K');
});

test('buildForcedGenerateImageCall reuses preferred model and provider metadata', () => {
  const call = buildForcedGenerateImageCall(
    'Generate a tech poster',
    [],
    {
      preferredAspectRatio: '1:1',
      preferredImageSize: '2K',
      preferredImageModel: 'GPT Image 2',
      preferredImageProviderId: 'plato',
    },
  );

  assert.equal(call.params.model, 'GPT Image 2');
  assert.equal(call.params.providerId, 'plato');
  assert.equal(call.params.aspectRatio, '1:1');
  assert.equal(call.params.imageSize, '2K');
  assert.equal(call.params.exactSize, '1440x1440');
});

test('buildForcedGenerateImageCall normalizes unsupported GPT Image 2 aspect ratio to nearest official preset', () => {
  const call = buildForcedGenerateImageCall(
    'Generate a portrait cover image with ratio 1:4',
    [],
    {
      preferredImageModel: 'GPT Image 2',
      preferredImageProviderId: 'plato',
      preferredImageSize: '4K',
    },
  );

  assert.equal(call.params.model, 'GPT Image 2');
  assert.equal(call.params.aspectRatio, '9:16');
  assert.equal(call.params.imageSize, '4K');
  assert.equal(call.params.exactSize, '2160x3840');
});

test('extractOriginalUserRequestFromRuntimeMessage unwraps autonomous runtime envelope', () => {
  const message = `[Original User Request]
生成日本年轻女生，在泳池边cosplay，全身照，白天，1k 3:4

[Runtime State Snapshot]
- turn=1
- executionRounds=0`;

  assert.equal(
    extractOriginalUserRequestFromRuntimeMessage(message),
    '生成日本年轻女生，在泳池边cosplay，全身照，白天，1k 3:4',
  );
});

test('buildForcedGenerateImageCall uses original user request instead of runtime snapshot wrapper', () => {
  const message = `[Original User Request]
生成日本年轻女生，在泳池边cosplay，全身照，白天，1k 3:4

[Runtime State Snapshot]
- turn=1
- executionRounds=0`;

  const call = buildForcedGenerateImageCall(message, [], {
    preferredAspectRatio: '1:1',
    preferredImageSize: '2K',
  });

  assert.equal(call.params.aspectRatio, '3:4');
  assert.equal(call.params.imageSize, '1K');
  assert.match(call.params.prompt, /生成日本年轻女生，在泳池边cosplay，全身照，白天，1k 3:4/);
  assert.doesNotMatch(call.params.prompt, /\[Runtime State Snapshot\]/);
});

test('ensureForcedImagePlan injects generateImage skill call for plain-text planner reply', () => {
  const parsedPlan = {
    message: '我会直接生成这张图，并控制为人物主体清晰。',
    skillCalls: [],
  };

  const repaired = ensureForcedImagePlan({
    parsedPlan,
    message: `[Original User Request]
生成日本年轻女生，在泳池边cosplay，全身照，白天，1k 3:4

[Runtime State Snapshot]
- turn=1
- executionRounds=0`,
    attachments: [],
    metadata: {
      preferredAspectRatio: '1:1',
      preferredImageSize: '2K',
    },
  });

  assert.equal(Array.isArray(repaired.skillCalls), true);
  assert.equal(repaired.skillCalls.length, 1);
  assert.equal(repaired.skillCalls[0]?.skillName, 'generateImage');
  assert.equal(repaired.skillCalls[0]?.params?.aspectRatio, '3:4');
  assert.equal(repaired.skillCalls[0]?.params?.imageSize, '1K');
});
