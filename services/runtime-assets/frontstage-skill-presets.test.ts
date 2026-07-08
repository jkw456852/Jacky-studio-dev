import assert from 'node:assert/strict';
import test from 'node:test';
import { listFrontstageSkillPresets } from './frontstage-skill-presets.ts';

test('listFrontstageSkillPresets returns markdown-backed presets with execution recipes', () => {
  const presets = listFrontstageSkillPresets();
  const presetIds = new Set(presets.map((preset) => preset.id));

  assert.equal(presetIds.has('autonomous-social-campaign'), true);
  assert.equal(presetIds.has('social-carousel-system'), true);
  assert.equal(presetIds.has('brand-style-guide'), true);
  assert.equal(presetIds.has('poster-campaign-system'), true);
  assert.equal(presetIds.has('moodboard-direction-lab'), true);
  assert.equal(presetIds.has('creative-brainstorm-studio'), true);

  const carouselPreset = presets.find((preset) => preset.id === 'social-carousel-system');
  assert.equal(carouselPreset?.skillData.id, 'autonomous-main-brain');
  assert.equal(carouselPreset?.skillData.config?.routeIntent, 'social');
  assert.equal(carouselPreset?.tab, 'social');
  assert.equal(Array.isArray(carouselPreset?.skillData.config?.executionRecipe), true);
  assert.equal((carouselPreset?.skillData.config?.executionRecipe as string[]).length > 0, true);
  assert.equal(
    typeof carouselPreset?.skillData.config?.examplePrompt,
    'string',
  );

  const brainstormPreset = presets.find((preset) => preset.id === 'creative-brainstorm-studio');
  assert.equal(brainstormPreset?.skillData.config?.routeLabel, 'Brainstorm');
  assert.equal(
    Array.isArray(brainstormPreset?.skillData.config?.preferredSkills),
    true,
  );
  assert.equal(
    (brainstormPreset?.skillData.config?.preferredSkills as string[]).includes('generateCopy'),
    true,
  );
});
