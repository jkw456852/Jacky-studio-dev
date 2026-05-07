import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildProposalExecutionTask,
  executeProposalTaskFlow,
} from './orchestrator-proposal-execution.ts';

test('buildProposalExecutionTask clones proposal skill params into forced execution task', () => {
  const curTask = {
    agentId: 'coco',
    input: {
      message: '原任务',
      attachments: [{ name: 'source.png' }],
      uploadedAttachments: ['https://example.com/source.png'],
      context: { projectId: 'p1' },
      metadata: {
        topicId: 'topic-1',
      },
    },
    output: {
      proposals: [
        {
          id: 'proposal-1',
          title: '方向一',
          description: 'desc',
          skillCalls: [
            {
              skillName: 'generateImage',
              params: {
                prompt: 'demo',
                nested: { keep: true },
              },
            },
          ],
        },
      ],
    },
  } as any;

  const task = buildProposalExecutionTask({
    curTask,
    proposalId: 'proposal-1',
    projectContext: { projectId: 'fallback' } as any,
  });

  assert.equal(task.status, 'executing');
  assert.equal(task.input.metadata?.forceSkills, true);
  assert.equal(task.input.metadata?.executeProposalId, 'proposal-1');
  assert.equal(task.input.metadata?.selectedSkillCalls?.length, 1);
  assert.notEqual(
    task.input.metadata?.selectedSkillCalls?.[0]?.params,
    curTask.output.proposals[0].skillCalls[0].params,
  );
  assert.deepEqual(task.input.metadata?.selectedSkillCalls?.[0]?.params, {
    prompt: 'demo',
    nested: { keep: true },
  });
});

test('executeProposalTaskFlow executes task, inserts assets, and syncs approved urls', async () => {
  const insertedAssets: any[] = [];
  const designSessionUpdates: any[] = [];
  const persistedPayloads: any[] = [];
  const executedTasks: any[] = [];

  const curTask = {
    agentId: 'coco',
    input: {
      message: '原任务',
      attachments: [{ name: 'source.png' }],
      uploadedAttachments: ['https://example.com/source.png'],
      context: { projectId: 'p1' },
      metadata: {
        topicId: 'topic-1',
      },
    },
    output: {
      proposals: [
        {
          id: 'proposal-1',
          title: '方向一',
          description: 'desc',
          skillCalls: [
            {
              skillName: 'generateImage',
              params: {
                prompt: 'demo',
              },
            },
          ],
        },
      ],
    },
  } as any;

  const result = {
    status: 'completed',
    output: {
      assets: [
        {
          id: 'img-1',
          type: 'image',
          url: 'https://example.com/result.png',
          metadata: {},
        },
      ],
      imageUrls: ['https://example.com/result.png'],
    },
  } as any;

  const summary = await executeProposalTaskFlow({
    curTask,
    proposalId: 'proposal-1',
    projectContext: { projectId: 'fallback' } as any,
    executeTask: async (task) => {
      executedTasks.push(task);
      return result;
    },
    addAssetsToCanvas: async (assets) => {
      insertedAssets.push(...assets);
    },
    updateDesignSession: (updates) => {
      designSessionUpdates.push(updates);
    },
    getCurrentApprovedAssetIds: () => [],
    getCurrentSubjectAnchors: () => [],
    persistApprovedAssets: async (payload) => {
      persistedPayloads.push(payload);
    },
  });

  assert.equal(executedTasks.length, 1);
  assert.equal(insertedAssets.length, 1);
  assert.equal(summary.result, result);
  assert.equal(summary.resultAssets.length, 1);
  assert.deepEqual(summary.proposalApprovedUrls, [
    'https://example.com/result.png',
  ]);
  assert.equal(summary.proposalTitle, '方向一');
  assert.equal(summary.proposalTopicId, 'topic-1');
  assert.equal(designSessionUpdates.length, 1);
  assert.deepEqual(designSessionUpdates[0].approvedAssetIds, [
    'https://example.com/result.png',
  ]);
  assert.equal(persistedPayloads.length, 1);
  assert.deepEqual(persistedPayloads[0], {
    topicId: 'topic-1',
    approvedUrls: ['https://example.com/result.png'],
    decisionLabel: 'Proposal result was adopted as a downstream design anchor: 方向一',
  });
});

test('executeProposalTaskFlow skips approved asset sync when topic id is absent', async () => {
  const designSessionUpdates: any[] = [];
  const persistedPayloads: any[] = [];

  const curTask = {
    agentId: 'coco',
    input: {
      message: '原任务',
      attachments: [],
      uploadedAttachments: [],
      context: { projectId: 'p1' },
      metadata: {},
    },
    output: {
      proposals: [
        {
          id: 'proposal-1',
          title: '方向一',
          description: 'desc',
          skillCalls: [
            {
              skillName: 'generateImage',
              params: { prompt: 'demo' },
            },
          ],
        },
      ],
    },
  } as any;

  await executeProposalTaskFlow({
    curTask,
    proposalId: 'proposal-1',
    projectContext: { projectId: 'fallback' } as any,
    executeTask: async () => ({
      status: 'completed',
      output: {
        assets: [],
        imageUrls: ['https://example.com/result.png'],
      },
    }) as any,
    addAssetsToCanvas: async () => {},
    updateDesignSession: (updates) => {
      designSessionUpdates.push(updates);
    },
    getCurrentApprovedAssetIds: () => [],
    getCurrentSubjectAnchors: () => [],
    persistApprovedAssets: async (payload) => {
      persistedPayloads.push(payload);
    },
  });

  assert.equal(designSessionUpdates.length, 0);
  assert.equal(persistedPayloads.length, 0);
});
