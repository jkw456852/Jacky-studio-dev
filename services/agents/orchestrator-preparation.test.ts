import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareAgentExecutionTask } from './orchestrator-preparation.ts';

test('prepareAgentExecutionTask assembles task metadata, syncs state, and validates passthrough', async () => {
  const designSessionUpdates: any[] = [];
  const topicSnapshotUpdates: any[] = [];
  const validations: any[] = [];

  const result = await prepareAgentExecutionTask({
    agentId: 'poster',
    message: '继续这个方向',
    messageForExecution: '继续这个方向 - 执行版',
    attachments: [{ name: 'ref.png' } as any],
    metadata: {
      multimodalContext: {
        referenceImageUrls: ['https://example.com/ref-a.png'],
      },
    } as any,
    uploadedUrls: ['https://example.com/uploaded.png'],
    updatedContext: {
      projectId: 'project-1',
      designSession: {
        taskMode: 'generate',
        brand: { name: 'Brand' },
        styleHints: [],
        subjectAnchors: [],
        constraints: [],
        forbiddenChanges: [],
        approvedAssetIds: [],
        referenceWebPages: [],
      },
      conversationHistory: [],
      existingAssets: [],
    } as any,
    projectActions: {
      updateDesignSession: (updates) => {
        designSessionUpdates.push(updates);
      },
    },
    existingDesignSession: {
      taskMode: 'generate',
      brand: { name: 'Brand' },
      styleHints: [],
      subjectAnchors: [],
      constraints: [],
      forbiddenChanges: [],
      approvedAssetIds: [],
      referenceWebPages: [],
    },
    hostProvider: 'mock-host',
    topicId: 'topic-1',
    topicPinnedContext: 'Pinned context',
    topicPinnedRefs: ['https://example.com/pinned.png'],
    inferredTaskMode: 'generate',
    optimizerUsed: true,
    optimizerStatus: 'ok',
    optimizedMessageForTrace: 'optimized prompt',
    originalMessage: '继续这个方向',
    shouldPreferUploadedReferences: true,
    roleStrategy: 'augment',
    roleStrategyReason: 'Need temporary role overlay',
    roleDraft: { title: 'Temp', summary: 'Summary', instructions: ['Do X'] },
    rolePromptLabel: 'augment:poster',
    rolePromptAddon: 'Temporary role addon',
    currentTaskAssetUrls: ['https://example.com/current.png'],
    sessionApprovedUrls: ['https://example.com/approved.png'],
    recentHistoryAttachmentUrls: ['https://example.com/history.png'],
    isAttachmentValidationStrict: true,
    dependencies: {
      collectInheritedReferenceUrlsFn: () => ['https://example.com/current.png'],
      resolveMultimodalReferencesFn: () => ({
        referenceImageUrls: ['https://example.com/current.png'],
        referenceSummary: 'current summary',
      }) as any,
      buildExecutionTaskMetadataFn: (input) => ({
        ...(input.metadata || {}),
        topicId: input.topicId,
        rolePromptLabel: input.rolePromptLabel,
        rolePromptAddon: input.rolePromptAddon,
        multimodalContext: {
          referenceImageUrls: ['https://example.com/current.png'],
          referenceSummary: 'current summary',
        },
      }) as any,
      syncDesignSessionStateFn: (payload) => {
        designSessionUpdates.push(payload);
      },
      syncTopicSnapshotStateFn: async (payload) => {
        topicSnapshotUpdates.push(payload);
      },
      buildExecutionTaskFn: (input) => ({
        id: 'task-1',
        agentId: input.agentId,
        status: 'pending',
        input: {
          message: input.messageForExecution,
          attachments: input.attachments,
          uploadedAttachments: input.uploadedUrls,
          context: input.updatedContext,
          metadata: input.taskMetadata,
        },
        createdAt: 1,
        updatedAt: 1,
      }) as any,
      validateAttachmentPassthroughFn: (payload) => {
        validations.push(payload);
      },
    },
  });

  assert.equal(result.task.agentId, 'poster');
  assert.equal(result.task.input.message, '继续这个方向 - 执行版');
  assert.deepEqual(result.inheritedReferenceUrls, ['https://example.com/current.png']);
  assert.equal(result.taskMetadata.topicId, 'topic-1');
  assert.equal(result.taskMetadata.rolePromptLabel, 'augment:poster');
  assert.equal(designSessionUpdates.length, 1);
  assert.equal(topicSnapshotUpdates.length, 1);
  assert.equal(validations.length, 1);
  assert.equal(validations[0].isStrict, true);
  assert.equal(validations[0].originalAttachmentCount, 1);
  assert.equal(validations[0].originalUploadedCount, 1);
});
