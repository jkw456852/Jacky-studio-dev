import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendReferenceTruncationNote,
  applyEnvironmentReferenceProtocol,
  applyResolvedReferenceAliases,
  autoInjectPrimaryAttachmentToken,
  buildImageAttachmentTokens,
  getPrimaryReferenceParamKey,
  inferAspectRatioFromMarkerInfo,
  resolveAttachmentToken,
} from './environment-input-protocol.ts';

test('buildImageAttachmentTokens keeps only image attachments', () => {
  const tokens = buildImageAttachmentTokens([
    { type: 'image/png' },
    { type: 'text/plain' },
    { type: 'image/jpeg' },
  ]);

  assert.deepEqual(tokens, ['ATTACHMENT_0', 'ATTACHMENT_2']);
});

test('getPrimaryReferenceParamKey maps smartEdit to sourceUrl', () => {
  assert.equal(getPrimaryReferenceParamKey('smartEdit'), 'sourceUrl');
  assert.equal(getPrimaryReferenceParamKey('generateImage'), 'referenceImage');
});

test('autoInjectPrimaryAttachmentToken rotates across image attachments by call index', () => {
  const task = {
    input: {
      attachments: [
        { type: 'image/png' },
        { type: 'text/plain' },
        { type: 'image/jpeg' },
      ],
    },
  } as any;

  assert.equal(autoInjectPrimaryAttachmentToken(task, 0), 'ATTACHMENT_0');
  assert.equal(autoInjectPrimaryAttachmentToken(task, 1), 'ATTACHMENT_2');
  assert.equal(autoInjectPrimaryAttachmentToken(task, 2), 'ATTACHMENT_0');
});

test('appendReferenceTruncationNote returns patched prompt only for non-empty prompt text', () => {
  const prompt = appendReferenceTruncationNote('make an image', 5, 3);
  assert.match(String(prompt), /Reference note:/i);
  assert.equal(appendReferenceTruncationNote('', 5, 3), null);
});

test('applyResolvedReferenceAliases syncs canonical and alias reference fields', () => {
  const call = { params: {} } as any;
  applyResolvedReferenceAliases(call, ['https://example.com/ref-a.png']);

  assert.deepEqual(call.params.referenceImages, ['https://example.com/ref-a.png']);
  assert.equal(call.params.referenceImage, 'https://example.com/ref-a.png');
  assert.equal(call.params.reference_image_url, 'https://example.com/ref-a.png');
  assert.equal(call.params.init_image, 'https://example.com/ref-a.png');
});

test('inferAspectRatioFromMarkerInfo derives aspect ratio buckets from marker dimensions', () => {
  assert.equal(
    inferAspectRatioFromMarkerInfo({ markerInfo: { width: 1600, height: 900 } } as any),
    '16:9',
  );
  assert.equal(
    inferAspectRatioFromMarkerInfo({ markerInfo: { width: 900, height: 1600 } } as any),
    '9:16',
  );
  assert.equal(inferAspectRatioFromMarkerInfo({ markerInfo: null } as any), null);
});

test('resolveAttachmentToken prefers hosted upload urls when host provider is enabled', async () => {
  const result = await resolveAttachmentToken(
    {
      input: {
        uploadedAttachments: ['https://example.com/uploaded.png'],
        attachments: [{ type: 'image/png' }],
        metadata: { imageHostProvider: 'mock-host' },
      },
    } as any,
    'ATTACHMENT_0',
  );

  assert.equal(result, 'https://example.com/uploaded.png');
});

test('applyEnvironmentReferenceProtocol auto-injects primary attachment token for generateImage', async () => {
  const call = {
    skillName: 'generateImage',
    params: {
      prompt: 'make an image',
    },
  } as any;

  const result = await applyEnvironmentReferenceProtocol({
    task: {
      input: {
        attachments: [{ type: 'image/png' }],
        uploadedAttachments: ['https://example.com/uploaded.png'],
        metadata: { imageHostProvider: 'mock-host' },
      },
    } as any,
    call,
    callIndex: 0,
    maxReferenceImages: 4,
    dependencies: {
      collectReferenceCandidatesFn: () => ({
        limitedCandidates: ['ATTACHMENT_0'],
        sourceCount: 1,
        truncated: false,
      }),
      resolveAttachmentTokenFn: async () => 'https://example.com/uploaded.png',
    },
  });

  assert.equal(result?.autoInjectedAttachmentToken, 'ATTACHMENT_0');
  assert.deepEqual(call.params.referenceImages, ['https://example.com/uploaded.png']);
  assert.equal(call.params.referenceImage, 'https://example.com/uploaded.png');
  assert.equal(call.params.reference_image_url, 'https://example.com/uploaded.png');
  assert.equal(call.params.init_image, 'https://example.com/uploaded.png');
});

test('applyEnvironmentReferenceProtocol appends truncation note when references exceed limit', async () => {
  const call = {
    skillName: 'generateImage',
    params: {
      prompt: 'make an image',
      referenceImages: ['ATTACHMENT_0', 'ATTACHMENT_1'],
    },
  } as any;

  const result = await applyEnvironmentReferenceProtocol({
    task: {
      input: {
        attachments: [{ type: 'image/png' }, { type: 'image/png' }],
        uploadedAttachments: [],
        metadata: { imageHostProvider: 'none' },
      },
    } as any,
    call,
    callIndex: 0,
    maxReferenceImages: 1,
    dependencies: {
      collectReferenceCandidatesFn: () => ({
        limitedCandidates: ['ATTACHMENT_0'],
        sourceCount: 2,
        truncated: true,
      }),
      resolveAttachmentTokenFn: async () => 'data:image/png;base64,abc',
    },
  });

  assert.equal(result?.truncated, true);
  assert.match(String(call.params.prompt), /Reference note:/i);
  assert.deepEqual(call.params.referenceImages, ['data:image/png;base64,abc']);
});

test('applyEnvironmentReferenceProtocol infers smartEdit aspect ratio from marker info', async () => {
  const call = {
    skillName: 'smartEdit',
    params: {
      sourceUrl: 'ATTACHMENT_0',
    },
  } as any;

  const result = await applyEnvironmentReferenceProtocol({
    task: {
      input: {
        attachments: [
          {
            type: 'image/png',
            markerInfo: { width: 1600, height: 900 },
          },
        ],
        uploadedAttachments: [],
        metadata: { imageHostProvider: 'none' },
      },
    } as any,
    call,
    callIndex: 0,
    maxReferenceImages: 4,
    dependencies: {
      collectReferenceCandidatesFn: () => ({
        limitedCandidates: ['ATTACHMENT_0'],
        sourceCount: 1,
        truncated: false,
      }),
      resolveAttachmentTokenFn: async () => 'data:image/png;base64,smartedit',
      inferAspectRatioFromMarkerInfoFn: () => '16:9',
    },
  });

  assert.equal(result?.references.length, 1);
  assert.equal(call.params.sourceUrl, 'data:image/png;base64,smartedit');
  assert.equal(call.params.aspectRatio, '16:9');
});

test('applyEnvironmentReferenceProtocol prioritizes deduped marker references for smartEdit', async () => {
  const call = {
    skillName: 'smartEdit',
    params: {
      instruction: 'Add a butterfly near the marked spot.',
    },
  } as any;

  const result = await applyEnvironmentReferenceProtocol({
    task: {
      input: {
        attachments: [
          {
            type: 'image/png',
            markerName: 'Selection',
            markerInfo: {
              fullImageUrl: 'https://example.com/original.png',
              normalizedX: 0.48,
              normalizedY: 0.51,
              width: 300,
              height: 300,
              imageWidth: 1600,
              imageHeight: 900,
            },
          },
        ],
        uploadedAttachments: ['https://example.com/annotated.png'],
        metadata: { imageHostProvider: 'mock-host' },
      },
    } as any,
    call,
    callIndex: 0,
    maxReferenceImages: 4,
    dependencies: {
      collectReferenceCandidatesFn: () => ({
        limitedCandidates: ['https://example.com/annotated.png', 'ATTACHMENT_0'],
        sourceCount: 2,
        truncated: false,
      }),
      resolveAttachmentTokenFn: async (_task, value) =>
        value === 'ATTACHMENT_0' ? 'https://example.com/annotated.png' : value,
    },
  });

  assert.equal(call.params.sourceUrl, 'https://example.com/original.png');
  assert.equal(call.params.aspectRatio, '16:9');
  assert.deepEqual(call.params.referenceImages, ['https://example.com/annotated.png']);
  assert.equal(call.params.referenceImage, 'https://example.com/annotated.png');
  assert.equal(call.params.reference_image_url, 'https://example.com/annotated.png');
  assert.equal(call.params.init_image, 'https://example.com/annotated.png');
  assert.match(String(call.params.instruction), /visible marker overlay/i);
  assert.match(String(call.params.instruction), /48%/);
  assert.match(
    String(call.params.parameters?.preservePrompt),
    /marker-selected target area/i,
  );
  assert.deepEqual(result?.references, ['https://example.com/annotated.png']);
});
