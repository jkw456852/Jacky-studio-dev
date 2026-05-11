import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertSkillExists,
  buildGenerateImageTextPolicy,
  ensureSkillParamsObject,
  injectExecutionPreferences,
  normalizeImageReferenceParams,
  normalizeSkillCalls,
  normalizeSkillName,
  parseSkillParamsString,
  SKILL_ALIASES,
  SUPPORTED_SKILL_NAMES,
} from './skill-call-normalizer.ts';

test('normalizeSkillName resolves alias and preserves canonical names', () => {
  assert.equal(normalizeSkillName('imageGenSkill'), 'generateImage');
  assert.equal(normalizeSkillName('generateVideo'), 'generateVideo');
  assert.equal(normalizeSkillName('  smartEditSkill  '), 'smartEdit');
});

test('parseSkillParamsString parses fenced json and falls back to empty object', () => {
  assert.deepEqual(
    parseSkillParamsString('```json\n{"prompt":"hello"}\n```'),
    { prompt: 'hello' },
  );
  assert.deepEqual(parseSkillParamsString('not-json'), {});
});

test('normalizeImageReferenceParams promotes alias reference fields', () => {
  const call = {
    params: {
      reference_image_url: 'https://example.com/ref.png',
    },
  } as any;

  const normalized = normalizeImageReferenceParams(call);
  assert.equal(normalized.params.referenceImage, 'https://example.com/ref.png');
});

test('normalizeSkillCalls resolves skill aliases for each call', () => {
  const normalized = normalizeSkillCalls([
    { skillName: 'imageGenSkill', params: {} },
    { skillName: 'generateCopy', params: {} },
  ] as any);

  assert.equal(normalized[0].skillName, 'generateImage');
  assert.equal(normalized[1].skillName, 'generateCopy');
});

test('ensureSkillParamsObject parses string params and normalizes invalid values to object', () => {
  const parsed = ensureSkillParamsObject({
    params: '{"prompt":"hello"}',
  } as any);
  assert.deepEqual(parsed.params, { prompt: 'hello' });

  const fallback = ensureSkillParamsObject({
    params: 123,
  } as any);
  assert.deepEqual(fallback.params, {});
});

test('assertSkillExists normalizes alias names and rejects unsupported skill names', () => {
  const call = { skillName: 'imageGenSkill' } as any;
  assert.doesNotThrow(() => assertSkillExists(call));
  assert.equal(call.skillName, 'generateImage');

  assert.throws(
    () => assertSkillExists({ skillName: 'unknown-skill' } as any),
    /not found/,
  );
});

test('buildGenerateImageTextPolicy normalizes text render policy shape', () => {
  assert.deepEqual(buildGenerateImageTextPolicy(null), undefined);
  assert.deepEqual(
    buildGenerateImageTextPolicy({
      enforceChinese: false,
      requiredCopy: '  核心卖点  ',
    }),
    {
      enforceChinese: false,
      requiredCopy: '核心卖点',
    },
  );
});

test('injectExecutionPreferences injects image generation preferences without overwriting existing values', () => {
  const call = {
    skillName: 'generateImage',
    params: {},
  } as any;

  injectExecutionPreferences(
    call,
    {
      input: {
        metadata: {
          creationMode: 'image',
          preferredAspectRatio: '3:4',
          preferredImageModel: 'GPT Image 2',
          preferredImageProviderId: 'openai-like',
          preferredImageSize: '2K',
          promptLanguagePolicy: 'translate-en',
          textRenderPolicy: {
            enforceChinese: true,
            requiredCopy: '主标题',
          },
        },
      },
    } as any,
  );

  assert.equal(call.params.aspectRatio, '3:4');
  assert.equal(call.params.model, 'GPT Image 2');
  assert.equal(call.params.providerId, 'openai-like');
  assert.equal(call.params.imageSize, '2K');
  assert.equal(call.params.promptLanguagePolicy, 'translate-en');
  assert.deepEqual(call.params.textPolicy, {
    enforceChinese: true,
    requiredCopy: '主标题',
  });
});

test('injectExecutionPreferences scopes aspect ratio to matching creation mode', () => {
  const call = {
    skillName: 'generateVideo',
    params: {},
  } as any;

  injectExecutionPreferences(
    call,
    {
      input: {
        metadata: {
          creationMode: 'video',
          preferredAspectRatio: '16:9',
          preferredImageModel: 'GPT Image 2',
          preferredImageProviderId: 'openai-like',
        },
      },
    } as any,
  );

  assert.equal(call.params.aspectRatio, '16:9');
  assert.equal(call.params.model, undefined);
  assert.equal(call.params.providerId, undefined);
});

test('skill registry helpers expose expected canonical coverage', () => {
  assert.equal(SKILL_ALIASES.imageGenSkill, 'generateImage');
  assert.equal(SUPPORTED_SKILL_NAMES.has('generateImage'), true);
  assert.equal(SUPPORTED_SKILL_NAMES.has('ecomReviewGeneratedResult'), true);
});
