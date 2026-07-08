import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPromptModeCopyPrompt,
  buildStructuredCopyPrompt,
  isPromptModeCopyRequest,
  parseCopyResultByMode,
} from './copy-gen.shared.ts';

test('buildStructuredCopyPrompt keeps legacy structured marketing mode compatible', () => {
  const prompt = buildStructuredCopyPrompt({
    copyType: 'headline',
    brandName: 'Aurora Skin',
    product: 'Radiance Serum',
    targetAudience: 'Premium skincare shoppers',
    tone: 'luxury',
    keyMessage: 'Visible glow after one routine',
    variations: 4,
    maxLength: 18,
  });

  assert.match(prompt, /Generate 4 headline variations/i);
  assert.match(prompt, /Brand: Aurora Skin/);
  assert.match(prompt, /Product: Radiance Serum/);
  assert.match(prompt, /Audience: Premium skincare shoppers/);
  assert.match(prompt, /Tone: luxury/);
  assert.match(prompt, /Max Length: 18 characters/);
  assert.match(prompt, /JSON array of strings/);
});

test('prompt mode is recognized for workflow-oriented skill calls', () => {
  assert.equal(
    isPromptModeCopyRequest({
      prompt: 'Plan a 6-page carousel with cover hook and page-by-page outline.',
    }),
    true,
  );
  assert.equal(
    isPromptModeCopyRequest({
      brandName: 'Aurora Skin',
      keyMessage: 'Glow fast',
    }),
    false,
  );
});

test('buildPromptModeCopyPrompt supports workflow planning prompts', () => {
  const prompt = buildPromptModeCopyPrompt({
    prompt: 'Plan a storyboard-first premium ad workflow.',
    outputMode: 'json-array',
    variationCount: 2,
  });

  assert.match(prompt, /storyboard-first premium ad workflow/i);
  assert.match(prompt, /Generate 2 high-signal planning or copy outputs/i);
  assert.match(prompt, /Return only a JSON array of strings/i);
});

test('parseCopyResultByMode handles json array and markdown/plain-text outputs', () => {
  assert.deepEqual(
    parseCopyResultByMode('["Hook first","Page flow second"]', 'json-array'),
    ['Hook first', 'Page flow second'],
  );

  assert.deepEqual(
    parseCopyResultByMode('- Hook first\n- Page flow second', 'json-array'),
    ['Hook first', 'Page flow second'],
  );

  assert.equal(
    parseCopyResultByMode('## Hook\nShort markdown answer', 'markdown'),
    '## Hook\nShort markdown answer',
  );
});
