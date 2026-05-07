import assert from 'node:assert/strict';
import test from 'node:test';
import {
  injectVisualConsistencyDefaults,
  prepareSkillExecutionCall,
  shouldResolveVisualReferences,
  validateForcedAttachmentRequirements,
} from './skill-execution-preprocessor.ts';

test('injectVisualConsistencyDefaults fills generateImage consistency defaults', () => {
  const call = {
    skillName: 'generateImage',
    params: {},
  } as any;
  const task = {
    input: {
      context: {
        designSession: {
          approvedAssetIds: ['asset-1'],
          subjectAnchors: ['anchor-a', 'anchor-b'],
          referenceSummary: 'keep product identity',
          forbiddenChanges: ['change logo'],
        },
      },
    },
  } as any;

  injectVisualConsistencyDefaults(call, task);

  assert.equal(call.params.referenceStrength, 0.75);
  assert.equal(call.params.referencePriority, 'all');
  assert.equal(call.params.referenceMode, 'product');
  assert.deepEqual(call.params.consistencyContext, {
    approvedAssetIds: ['asset-1'],
    subjectAnchors: ['anchor-a', 'anchor-b'],
    referenceSummary: 'keep product identity',
    forbiddenChanges: ['change logo'],
  });
});

test('validateForcedAttachmentRequirements throws when forced visual skill loses attachments', () => {
  assert.throws(
    () =>
      validateForcedAttachmentRequirements(
        {
          skillName: 'generateImage',
          params: {
            referenceImage: 'ATTACHMENT_0',
          },
        },
        {
          input: {
            metadata: { forceSkills: true },
            attachments: [],
          },
        } as any,
      ),
    /缺少参考附件/,
  );
});

test('validateForcedAttachmentRequirements allows non-forced calls without attachments', () => {
  assert.doesNotThrow(() =>
    validateForcedAttachmentRequirements(
      {
        skillName: 'generateImage',
        params: {
          referenceImage: 'ATTACHMENT_0',
        },
      },
      {
        input: {
          metadata: { forceSkills: false },
          attachments: [],
        },
      } as any,
    ),
  );
});

test('shouldResolveVisualReferences matches only visual generation/edit skills', () => {
  assert.equal(shouldResolveVisualReferences('generateImage'), true);
  assert.equal(shouldResolveVisualReferences('generateVideo'), true);
  assert.equal(shouldResolveVisualReferences('smartEdit'), true);
  assert.equal(shouldResolveVisualReferences('generateCopy'), false);
});

test('prepareSkillExecutionCall applies protocol through injected dependency and returns diagnostics', async () => {
  const call = {
    skillName: 'generateImage',
    params: '{}',
  } as any;

  const task = {
    input: {
      metadata: {
        creationMode: 'image',
        preferredAspectRatio: '1:1',
        preferredImageSize: '2K',
        promptLanguagePolicy: 'translate-en',
        forceSkills: false,
      },
      attachments: [{ name: 'ref.png' }],
      context: {
        designSession: {
          approvedAssetIds: [],
          subjectAnchors: ['anchor-1'],
          forbiddenChanges: [],
        },
      },
    },
  } as any;

  const result = await prepareSkillExecutionCall({
    call,
    task,
    callIndex: 0,
    maxReferenceImages: 4,
    dependencies: {
      applyEnvironmentReferenceProtocolFn: async ({ call: receivedCall }) => {
        receivedCall.params.referenceImages = ['https://example.com/ref.png'];
        receivedCall.params.referenceImage = 'https://example.com/ref.png';
        return {
          references: ['https://example.com/ref.png'],
          sourceCount: 2,
          truncated: true,
          omittedCount: 1,
          autoInjectedAttachmentToken: 'ATTACHMENT_0',
        } as any;
      },
    },
  });

  assert.equal(call.params.aspectRatio, '1:1');
  assert.equal(call.params.imageSize, '2K');
  assert.equal(call.params.promptLanguagePolicy, 'translate-en');
  assert.equal(call.params.referenceStrength, 0.75);
  assert.equal(call.params.referencePriority, 'first');
  assert.equal(call.params.referenceMode, 'product');
  assert.deepEqual(call.params.referenceImages, ['https://example.com/ref.png']);
  assert.deepEqual(result.diagnostics.referencesResolved, {
    sourceCount: 2,
    injectedCount: 1,
    truncated: true,
    omittedCount: 1,
    autoInjectedAttachmentToken: 'ATTACHMENT_0',
  });
});

test('prepareSkillExecutionCall skips environment protocol for non-visual skills', async () => {
  let protocolCalls = 0;
  const call = {
    skillName: 'generateCopy',
    params: {},
  } as any;

  const result = await prepareSkillExecutionCall({
    call,
    task: {
      input: {
        metadata: {},
        context: { designSession: {} },
      },
    } as any,
    callIndex: 0,
    maxReferenceImages: 4,
    dependencies: {
      applyEnvironmentReferenceProtocolFn: async () => {
        protocolCalls += 1;
        return null;
      },
    },
  });

  assert.equal(protocolCalls, 0);
  assert.equal(result.diagnostics.referencesResolved, undefined);
});
