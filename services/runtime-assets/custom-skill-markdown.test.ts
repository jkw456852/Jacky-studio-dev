import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCustomSkillMarkdownAsset,
  customSkillMarkdownAssetToConfig,
  parseCustomSkillMarkdownAsset,
  serializeCustomSkillMarkdownAsset,
} from './custom-skill-markdown.ts';

test('custom skill markdown asset round-trips workflow and execution recipe fields', () => {
  const asset = buildCustomSkillMarkdownAsset({
    id: 'custom-skill-branding-kv',
    name: 'Brand KV Skill',
    iconName: 'Sparkles',
    config: {
      summary: 'Reusable branding workflow.',
      activationHint: 'Good for brand KV and key visual tasks.',
      frontstageSkillId: 'autonomous-brand-system',
      routeIntent: 'branding',
      routeLabel: 'Branding',
      routeSummary: 'Bias toward brand systems and key visuals.',
      preferredSkills: ['generateImage', 'workspaceSearch'],
      suggestedTaskMode: 'generate',
      followUpMode: 'auto-clarify',
      clarifyChecklist: ['brand tone', 'audience'],
      reusableQuestions: ['What brand tone should we lean into?'],
      executionOutline: ['Align direction', 'Define KV', 'Ship execution plan'],
      executionRecipe: [
        'always :: none :: Align brand direction before visuals',
        'visual-request :: generateImage :: Validate one KV direction at a time',
      ],
      outputBlueprint: ['Direction judgment', 'KV structure'],
      toolPolicy: ['Do not skip direction alignment before visuals.'],
      instruction: 'Clarify brand direction first, then output a reusable KV plan.',
      examplePrompt: 'Create a fresh premium skincare brand KV.',
      sourceConversationTitle: 'Brand KV thread',
      sourceUserPrompt: 'Create a fresh premium skincare brand KV.',
      distilledFromConversation: true,
      distillationMethod: 'thinking-conversation-distill',
      distilledAt: 123456,
      createdAt: 123000,
      updatedAt: 123999,
      successfulRuns: 3,
      lastSuccessfulAt: 124000,
      lastSuccessfulPrompt: 'Make the KV softer and more premium.',
      lastSuccessfulSummary: 'Locked the tone first, then refined the hero composition.',
      lastSuccessfulOutput: 'Delivered a premium KV direction with softer lighting.',
    },
  });

  const markdown = serializeCustomSkillMarkdownAsset(asset);
  const parsed = parseCustomSkillMarkdownAsset(markdown, {
    fileName: 'brand-kv.md',
    filePath: '/skills/brand-kv.md',
  });
  const config = customSkillMarkdownAssetToConfig(parsed);

  assert.equal(parsed.id, 'custom-skill-branding-kv');
  assert.equal(parsed.routeIntent, 'branding');
  assert.deepEqual(parsed.executionRecipe, [
    'always :: none :: Align brand direction before visuals',
    'visual-request :: generateImage :: Validate one KV direction at a time',
  ]);
  assert.equal(config.storageFormat, 'markdown-file');
  assert.equal(config.markdownAssetId, 'custom-skill-branding-kv');
  assert.equal(config.markdownAssetPath, '/skills/brand-kv.md');
  assert.deepEqual(config.executionRecipe, parsed.executionRecipe);
  assert.equal(Number(parsed.successfulRuns || 0), 3);
  assert.equal(Number(config.successfulRuns || 0), 3);
  assert.equal(
    String(config.lastSuccessfulPrompt || ''),
    'Make the KV softer and more premium.',
  );
  assert.equal(
    String(config.lastSuccessfulSummary || ''),
    'Locked the tone first, then refined the hero composition.',
  );
  assert.equal(
    String(config.lastSuccessfulOutput || ''),
    'Delivered a premium KV direction with softer lighting.',
  );
});
