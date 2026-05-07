import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildProcessMessageErrorTask,
  buildProposalExecutionErrorTask,
  finalizeExecutionSuccess,
  validateAttachmentPassthrough,
} from './orchestrator-result-handlers.ts';

test('buildProcessMessageErrorTask returns unified failed output envelope', () => {
  const result = buildProcessMessageErrorTask(
    'hello',
    {} as any,
    new Error('upload format invalid'),
  );

  assert.equal(result.status, 'failed');
  assert.equal(result.output?.runtime?.mode, 'direct-response');
  assert.match(String(result.output?.message || ''), /重新上传|再试|retry/i);
});

test('buildProposalExecutionErrorTask preserves prior output envelope fields', () => {
  const result = buildProposalExecutionErrorTask({
    id: 't1',
    agentId: 'coco',
    status: 'executing',
    input: { message: 'x', context: {} as any },
    output: {
      analysis: 'a',
      proposals: [{ id: 'p1', title: 'p', description: 'd', skillCalls: [] }],
      runtime: { mode: 'skill-execution', assetCount: 1 },
    },
    createdAt: 1,
    updatedAt: 1,
  } as any);

  assert.equal(result.status, 'failed');
  assert.equal(result.output?.runtime?.mode, 'skill-execution');
  assert.equal(result.output?.analysis, 'a');
  assert.equal(result.output?.proposals?.length, 1);
});

test('validateAttachmentPassthrough does not throw when counts match', () => {
  assert.doesNotThrow(() =>
    validateAttachmentPassthrough({
      task: {
        input: {
          attachments: [{ name: 'a' }] as any,
          uploadedAttachments: ['https://example.com/a.png'],
        },
      } as any,
      originalAttachmentCount: 1,
      originalUploadedCount: 1,
      isStrict: true,
    }),
  );
});

test('validateAttachmentPassthrough throws in strict mode when counts mismatch', () => {
  assert.throws(
    () =>
      validateAttachmentPassthrough({
        task: {
          input: {
            attachments: [] as any,
            uploadedAttachments: [],
          },
        } as any,
        originalAttachmentCount: 1,
        originalUploadedCount: 1,
        isStrict: true,
      }),
    /Attachment passthrough mismatch/i,
  );
});

test('finalizeExecutionSuccess inserts assets and syncs approved urls', async () => {
  const insertedAssets: any[] = [];
  const designSessionUpdates: any[] = [];

  const result = {
    output: {
      assets: [
        {
          id: 'img-1',
          type: 'image',
          url: 'https://example.com/out.png',
          metadata: {},
        },
      ],
      imageUrls: ['https://example.com/out.png'],
    },
  } as any;

  const summary = await finalizeExecutionSuccess({
    result,
    topicId: 'topic-1',
    decisionLabel: 'test sync',
    addAssetsToCanvas: async (assets) => {
      insertedAssets.push(...assets);
    },
    updateDesignSession: (updates) => {
      designSessionUpdates.push(updates);
    },
    getCurrentApprovedAssetIds: () => [],
    getCurrentSubjectAnchors: () => [],
    persistApprovedAssets: async () => {},
  });

  assert.equal(insertedAssets.length, 1);
  assert.equal(summary.assets.length, 1);
  assert.equal(summary.approvedUrls.length, 1);
  assert.equal(designSessionUpdates.length, 1);
  assert.deepEqual(designSessionUpdates[0].approvedAssetIds, [
    'https://example.com/out.png',
  ]);
});
