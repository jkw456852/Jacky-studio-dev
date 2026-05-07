import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatSkillExecutionResult,
  isOneclickSkillName,
  resolveSkillHandler,
} from './skill-runtime.ts';

test('isOneclickSkillName recognizes canonical and alias oneclick names', () => {
  assert.equal(isOneclickSkillName('jkaiOneclick'), true);
  assert.equal(isOneclickSkillName('xcaiOneclick'), true);
  assert.equal(isOneclickSkillName('imageGenSkill'), false);
});

test('resolveSkillHandler returns canonical handler and rejects unknown names', () => {
  const registry = {
    generateImage: async () => 'ok',
    generateVideo: async () => 'video',
  };

  assert.equal(resolveSkillHandler(registry, 'generateImage'), registry.generateImage);
  assert.equal(resolveSkillHandler(registry, 'imageGenSkill'), registry.generateImage);

  assert.throws(
    () => resolveSkillHandler(registry, 'unknown-skill'),
    /not found/,
  );
});

test('resolveSkillHandler rejects when skill is valid but missing from runtime registry', () => {
  const registry = {
    generateImage: async () => 'ok',
  };

  assert.throws(
    () => resolveSkillHandler(registry, 'generateVideo'),
    /generateVideo not registered in registry/,
  );
});

test('formatSkillExecutionResult only formats oneclick outputs', () => {
  const formatter = (result: any) => `formatted:${result.summary}`;

  assert.equal(
    formatSkillExecutionResult({
      skillName: 'jkaiOneclick',
      result: { summary: 'done' },
      formatJkaiOneclickResultFn: formatter,
    }),
    'formatted:done',
  );

  assert.deepEqual(
    formatSkillExecutionResult({
      skillName: 'generateImage',
      result: { url: 'x.png' },
      formatJkaiOneclickResultFn: formatter,
    }),
    { url: 'x.png' },
  );
});
