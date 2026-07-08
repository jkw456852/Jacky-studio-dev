import assert from 'node:assert/strict';
import test from 'node:test';
import {
  prepareAgentExecutionTask,
  prepareOrchestratorContext,
} from './orchestrator-preparation.ts';

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

test('prepareAgentExecutionTask preserves selected durable role governance metadata into execution task', async () => {
  const result = await prepareAgentExecutionTask({
    agentId: 'coco',
    message: '沿用当前长期角色执行',
    messageForExecution: '沿用当前长期角色执行',
    attachments: [],
    metadata: {
      agentSelectionMode: 'manual',
      pinnedAgentId: 'coco',
      selectedRoleId: 'role-coco-pro',
      selectedRoleSource: 'user',
      baseAgentId: 'coco',
      roleGovernanceMode: 'approval_required',
      allowMainBrainRoleMutation: false,
      allowMainBrainRolePromotion: true,
      multimodalContext: {
        referenceImageUrls: [],
      },
    } as any,
    uploadedUrls: [],
    updatedContext: {
      projectId: 'project-2',
      designSession: {
        taskMode: 'respond',
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
      updateDesignSession: () => {},
    },
    existingDesignSession: {
      taskMode: 'respond',
      brand: { name: 'Brand' },
      styleHints: [],
      subjectAnchors: [],
      constraints: [],
      forbiddenChanges: [],
      approvedAssetIds: [],
      referenceWebPages: [],
    },
    hostProvider: 'mock-host',
    topicId: 'topic-role',
    topicPinnedContext: '',
    topicPinnedRefs: [],
    inferredTaskMode: 'chat',
    optimizerUsed: false,
    optimizerStatus: 'skipped',
    originalMessage: '沿用当前长期角色执行',
    shouldPreferUploadedReferences: false,
    currentTaskAssetUrls: [],
    sessionApprovedUrls: [],
    recentHistoryAttachmentUrls: [],
    isAttachmentValidationStrict: true,
    dependencies: {
      collectInheritedReferenceUrlsFn: () => [],
      resolveMultimodalReferencesFn: () => ({
        directReferenceUrls: [],
        mergedReferenceUrls: [],
        inheritedReferenceUrls: [],
        effectiveReferenceUrls: [],
        isolateVisualQa: false,
        referenceSummary: 'no refs',
      }) as any,
      syncDesignSessionStateFn: () => {},
      syncTopicSnapshotStateFn: async () => {},
      validateAttachmentPassthroughFn: () => {},
    },
  });

  assert.equal(result.taskMetadata.selectedRoleId, 'role-coco-pro');
  assert.equal(result.taskMetadata.selectedRoleSource, 'user');
  assert.equal(result.taskMetadata.baseAgentId, 'coco');
  assert.equal(result.taskMetadata.roleGovernanceMode, 'approval_required');
  assert.equal(result.taskMetadata.allowMainBrainRoleMutation, false);
  assert.equal(result.taskMetadata.allowMainBrainRolePromotion, true);
  assert.equal(result.task.input.metadata?.selectedRoleId, 'role-coco-pro');
  assert.equal(result.task.input.metadata?.baseAgentId, 'coco');
  assert.equal(result.task.input.metadata?.roleGovernanceMode, 'approval_required');
});

test('prepareOrchestratorContext keeps unified sidebar agent skill-first even when legacy role state exists', async () => {
  const result = await prepareOrchestratorContext({
    message: 'Continue with the sidebar task',
    attachments: [],
    metadata: {
      allowAutonomousRouting: true,
      agentSelectionMode: 'manual',
      pinnedAgentId: 'poster',
      selectedRoleId: 'legacy-role',
      baseAgentId: 'poster',
      skillData: {
        id: 'autonomous-main-brain',
        config: {
          allowAutonomousRouting: true,
          mode: 'unified-sidebar-agent',
        },
      },
    } as any,
    projectContext: {
      projectId: 'project-unified-sidebar',
      conversationId: '',
      designSession: {
        taskMode: 'chat',
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
    freshDesignSession: {
      taskMode: 'chat' as any,
      brand: { name: 'Brand' },
      styleHints: [],
      subjectAnchors: [],
      constraints: [],
      forbiddenChanges: [],
      approvedAssetIds: [],
      referenceWebPages: [],
    } as any,
    brandInfo: { name: 'Brand' } as any,
    conversationHistory: [],
    selectedHostProvider: 'none',
    setIsUploadingAttachments: () => {},
    setCurrentTask: () => {},
    updateMessageAttachments: () => {},
    setTaskMode: () => {},
  });

  assert.equal(result.isUnifiedSidebarAgent, true);
  assert.equal(result.pinnedAgent, null);
});

test('prepareAgentExecutionTask strips legacy role governance metadata from unified sidebar agent tasks', async () => {
  const result = await prepareAgentExecutionTask({
    agentId: 'coco',
    message: 'Use the unified sidebar agent',
    messageForExecution: 'Use the unified sidebar agent',
    attachments: [],
    metadata: {
      allowAutonomousRouting: true,
      agentSelectionMode: 'manual',
      pinnedAgentId: 'coco',
      selectedRoleId: 'role-coco-pro',
      selectedRoleSource: 'user',
      baseAgentId: 'coco',
      roleGovernanceMode: 'approval_required',
      allowMainBrainRoleMutation: false,
      allowMainBrainRolePromotion: true,
      skillData: {
        id: 'autonomous-main-brain',
        config: {
          allowAutonomousRouting: true,
          mode: 'unified-sidebar-agent',
        },
      },
      multimodalContext: {
        referenceImageUrls: [],
      },
    } as any,
    uploadedUrls: [],
    updatedContext: {
      projectId: 'project-unified-sidebar-task',
      designSession: {
        taskMode: 'chat',
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
      updateDesignSession: () => {},
    },
    existingDesignSession: {
      taskMode: 'chat',
      brand: { name: 'Brand' },
      styleHints: [],
      subjectAnchors: [],
      constraints: [],
      forbiddenChanges: [],
      approvedAssetIds: [],
      referenceWebPages: [],
    } as any,
    hostProvider: 'mock-host',
    topicId: 'topic-unified-sidebar',
    topicPinnedContext: '',
    topicPinnedRefs: [],
    inferredTaskMode: 'chat' as any,
    optimizerUsed: false,
    optimizerStatus: 'skipped',
    originalMessage: 'Use the unified sidebar agent',
    shouldPreferUploadedReferences: false,
    currentTaskAssetUrls: [],
    sessionApprovedUrls: [],
    recentHistoryAttachmentUrls: [],
    isAttachmentValidationStrict: true,
    dependencies: {
      collectInheritedReferenceUrlsFn: () => [],
      resolveMultimodalReferencesFn: () => ({
        directReferenceUrls: [],
        mergedReferenceUrls: [],
        inheritedReferenceUrls: [],
        effectiveReferenceUrls: [],
        isolateVisualQa: false,
        referenceSummary: 'no refs',
      }) as any,
      syncDesignSessionStateFn: () => {},
      syncTopicSnapshotStateFn: async () => {},
      validateAttachmentPassthroughFn: () => {},
    },
  });

  assert.equal(result.taskMetadata.allowAutonomousRouting, true);
  assert.equal(result.taskMetadata.selectedRoleId, undefined);
  assert.equal(result.taskMetadata.selectedRoleSource, undefined);
  assert.equal(result.taskMetadata.baseAgentId, undefined);
  assert.equal(result.taskMetadata.roleGovernanceMode, undefined);
  assert.equal(result.taskMetadata.pinnedAgentId, undefined);
  assert.equal(result.taskMetadata.agentSelectionMode, undefined);
  assert.equal(result.taskMetadata.allowMainBrainRoleMutation, undefined);
  assert.equal(result.taskMetadata.allowMainBrainRolePromotion, undefined);
  assert.equal(result.task.input.metadata?.selectedRoleId, undefined);
  assert.equal(result.task.input.metadata?.baseAgentId, undefined);
});
