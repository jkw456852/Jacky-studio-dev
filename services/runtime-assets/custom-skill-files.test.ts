import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  deleteCustomSkillMarkdownFile,
  listCustomSkillMarkdownFiles,
  saveCustomSkillMarkdownFile,
  updateCustomSkillMarkdownFile,
} from './custom-skill-files.ts';

test('custom skill files can be saved, listed, and deleted with execution recipe', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xc-custom-skill-'));

  const saved = await saveCustomSkillMarkdownFile({
    rootDir,
    id: 'custom-skill-social-seed',
    name: 'Social Cover Skill',
    iconName: 'Sparkles',
    config: {
      summary: 'Reusable social cover workflow.',
      routeIntent: 'social',
      routeLabel: 'Social Media',
      routeSummary: 'Bias toward cover art and multi-asset flows.',
      preferredSkills: ['generateImage', 'workspaceSearch'],
      followUpMode: 'auto-clarify',
      allowAutonomousRouting: true,
      mode: 'unified-sidebar-agent',
      clarifyChecklist: ['platform', 'hook'],
      reusableQuestions: ['Which platform is this for?'],
      executionOutline: ['Align platform and hook', 'Output cover direction'],
      executionRecipe: [
        'always :: none :: Align platform and hook before visuals',
        'visual-request :: generateImage :: Generate cover visuals one asset at a time',
      ],
      outputBlueprint: ['Cover hook', 'Visual direction'],
      toolPolicy: ['Do not compress multiple assets into one image.'],
      instruction: 'Clarify platform and main angle first, then output a reusable cover plan.',
      sourceUserPrompt: 'Create a new social cover.',
    },
  });

  const listed = await listCustomSkillMarkdownFiles({ rootDir });

  assert.equal(saved.id, 'custom-skill-social-seed');
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.id, 'custom-skill-social-seed');
  assert.deepEqual(listed[0]?.executionRecipe, [
    'always :: none :: Align platform and hook before visuals',
    'visual-request :: generateImage :: Generate cover visuals one asset at a time',
  ]);

  const removed = await deleteCustomSkillMarkdownFile({
    rootDir,
    skillId: 'custom-skill-social-seed',
  });
  const listedAfterDelete = await listCustomSkillMarkdownFiles({ rootDir });

  assert.equal(removed, true);
  assert.equal(listedAfterDelete.length, 0);
});

test('custom skill markdown file can persist successful-run memory updates', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xc-custom-skill-update-'));

  await saveCustomSkillMarkdownFile({
    rootDir,
    id: 'custom-skill-memory-seed',
    name: 'Memory Skill',
    iconName: 'Sparkles',
    config: {
      summary: 'Reusable workflow with learned memory.',
      routeIntent: 'branding',
      routeLabel: 'Branding',
      routeSummary: 'Bias toward repeatable visual workflows.',
      preferredSkills: ['generateImage', 'generateCopy'],
      followUpMode: 'direct-run',
      allowAutonomousRouting: true,
      mode: 'unified-sidebar-agent',
      instruction: 'Reuse the strongest prior workflow.',
    },
  });

  const updated = await updateCustomSkillMarkdownFile({
    rootDir,
    skillId: 'custom-skill-memory-seed',
    mutate: (current) => ({
      ...current,
      successfulRuns: Number(current.successfulRuns || 0) + 1,
      lastSuccessfulAt: 456789,
      lastSuccessfulPrompt: 'Refine the KV into a softer campaign visual.',
      lastSuccessfulSummary: 'Reused the composition logic and adjusted the tone.',
      lastSuccessfulOutput: 'Produced a softer premium KV execution route.',
    }),
  });

  const listed = await listCustomSkillMarkdownFiles({ rootDir });

  assert.equal(Number(updated?.successfulRuns || 0), 1);
  assert.equal(Number(listed[0]?.successfulRuns || 0), 1);
  assert.equal(
    String(listed[0]?.lastSuccessfulPrompt || ''),
    'Refine the KV into a softer campaign visual.',
  );
  assert.equal(
    String(listed[0]?.lastSuccessfulSummary || ''),
    'Reused the composition logic and adjusted the tone.',
  );
  assert.equal(
    String(listed[0]?.lastSuccessfulOutput || ''),
    'Produced a softer premium KV execution route.',
  );
});
