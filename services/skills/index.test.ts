import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertRegisteredSkillName,
  isAssetProducingSkillName,
  isImageGenerationSkillName,
  isRegisteredSkillName,
  isVideoGenerationSkillName,
  isVisualEditSkillName,
  isVisualGenerationSkillName,
  isVisualReferenceResolutionSkillName,
  REGISTERED_SKILL_NAMES,
  normalizeRegisteredSkillName,
  resolveRegisteredSkillName,
  SKILL_ALIASES,
  SUPPORTED_SKILL_NAMES,
} from './skill-manifest.ts';
import {
  formatSkillExecutionResult,
  isOneclickSkillName,
  resolveSkillHandler,
} from './skill-runtime.ts';

test('skill manifest exposes canonical names and alias normalization', () => {
  assert.equal(Array.isArray(REGISTERED_SKILL_NAMES), true);
  assert.equal(REGISTERED_SKILL_NAMES.includes('generateImage'), true);
  assert.equal(SUPPORTED_SKILL_NAMES.has('generateVideo'), true);
  assert.equal(SKILL_ALIASES.imageGenSkill, 'generateImage');
  assert.equal(normalizeRegisteredSkillName(' imageGenSkill '), 'generateImage');
  assert.equal(normalizeRegisteredSkillName('generateCopy'), 'generateCopy');
  assert.equal(resolveRegisteredSkillName(' imageGenSkill '), 'generateImage');
  assert.equal(resolveRegisteredSkillName('unknown-skill'), null);
  assert.equal(isRegisteredSkillName('generateCopy'), true);
  assert.equal(isRegisteredSkillName('unknown-skill'), false);
  assert.equal(assertRegisteredSkillName('smartEditSkill'), 'smartEdit');
  assert.throws(() => assertRegisteredSkillName('unknown-skill'), /not found/);
});

test('skill manifest set stays aligned with registered skill list', () => {
  assert.equal(SUPPORTED_SKILL_NAMES.size, REGISTERED_SKILL_NAMES.length);
  REGISTERED_SKILL_NAMES.forEach((skillName) => {
    assert.equal(SUPPORTED_SKILL_NAMES.has(skillName), true);
  });
});

test('skill manifest capability helpers classify canonical and alias skill names consistently', () => {
  assert.equal(isImageGenerationSkillName('generateImage'), true);
  assert.equal(isImageGenerationSkillName('imageGenSkill'), true);
  assert.equal(isImageGenerationSkillName('generateVideo'), false);

  assert.equal(isVideoGenerationSkillName('generateVideo'), true);
  assert.equal(isVideoGenerationSkillName('videoGenSkill'), true);
  assert.equal(isVideoGenerationSkillName('smartEdit'), false);

  assert.equal(isVisualGenerationSkillName('generateImage'), true);
  assert.equal(isVisualGenerationSkillName('videoGenSkill'), true);
  assert.equal(isVisualGenerationSkillName('smartEdit'), false);

  assert.equal(isVisualEditSkillName('smartEdit'), true);
  assert.equal(isVisualEditSkillName('touchEditSkill'), true);
  assert.equal(isVisualEditSkillName('generateImage'), false);

  assert.equal(isVisualReferenceResolutionSkillName('imageGenSkill'), true);
  assert.equal(isVisualReferenceResolutionSkillName('generateVideo'), true);
  assert.equal(isVisualReferenceResolutionSkillName('smartEditSkill'), true);
  assert.equal(isVisualReferenceResolutionSkillName('touchEdit'), false);

  assert.equal(isAssetProducingSkillName('generateImage'), true);
  assert.equal(isAssetProducingSkillName('generateVideo'), true);
  assert.equal(isAssetProducingSkillName('smartEditSkill'), true);
  assert.equal(isAssetProducingSkillName('touchEdit'), true);
  assert.equal(isAssetProducingSkillName('generateCopy'), false);
});

test('resolveSkillHandler accepts canonical and alias names against shared registry', async () => {
  const imageHandler = async () => 'image-ok';
  const registry = {
    generateImage: imageHandler,
  };

  assert.equal(resolveSkillHandler(registry, 'generateImage'), imageHandler);
  assert.equal(resolveSkillHandler(registry, 'imageGenSkill'), imageHandler);
  await assert.rejects(
    async () => {
      resolveSkillHandler(registry, 'unknown-skill');
    },
    /not found/,
  );
});

test('runtime helpers format only oneclick-family outputs', () => {
  const formatter = (result: any) => `formatted:${result.summary}`;

  assert.equal(isOneclickSkillName('jkaiOneclick'), true);
  assert.equal(isOneclickSkillName('xcaiOneclick'), true);
  assert.equal(isOneclickSkillName('generateImage'), false);

  assert.equal(
    formatSkillExecutionResult({
      skillName: 'xcaiOneclick',
      result: { summary: 'alias-ok' },
      formatJkaiOneclickResultFn: formatter,
    }),
    'formatted:alias-ok',
  );

  assert.deepEqual(
    formatSkillExecutionResult({
      skillName: 'generateImage',
      result: { url: 'a.png' },
      formatJkaiOneclickResultFn: formatter,
    }),
    { url: 'a.png' },
  );
});
