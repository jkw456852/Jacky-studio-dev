import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorkflowRecipeDefinition } from '../../types/workflow-recipe.types.ts';
import { importWorkflowRecipe } from './importer.ts';
import { publishWorkflowRecipe, rollbackWorkflowRecipePublication } from './publisher.ts';
import { serializeWorkflowRecipe } from './serializer.ts';
import { runWorkflowRecipeSmokeTest } from './testing.ts';

const createRecipe = (): WorkflowRecipeDefinition => ({
  schemaVersion: 1,
  recipeId: 'fashion-model-tryon',
  version: '0.1.0',
  title: '模特换装工作流',
  summary: '用于验证导入、测试、发布骨架的最小 recipe。',
  category: 'workflow',
  tags: ['fashion', 'tryon'],
  status: 'testing',
  inputs: [
    {
      id: 'garmentImage',
      label: '服装图',
      description: '服装参考图',
      dataType: 'image',
      validation: { required: true },
    },
  ],
  outputs: [
    {
      id: 'resultImage',
      label: '结果图',
      description: '换装结果输出',
      dataType: 'image',
      required: true,
    },
  ],
  steps: [
    {
      stepId: 'analyze-garment',
      type: 'capability',
      title: '分析服装',
      capabilityRef: 'vision.analyze.region',
      inputMapping: {
        sourceUrl: 'inputs.garmentImage',
      },
      outputMapping: {
        analysis: 'steps.analyze-garment.outputs.analysis',
      },
      onError: 'stop',
    },
    {
      stepId: 'generate-result',
      type: 'capability',
      title: '生成结果图',
      capabilityRef: 'image.generate.single',
      inputMapping: {
        prompt: 'constants.defaultPrompt',
      },
      outputMapping: {
        imageUrls: 'outputs.resultImage',
      },
      onError: 'stop',
    },
  ],
  ui: {
    sections: [
      {
        id: 'basic',
        title: '基础参数',
        fieldIds: ['garmentImage'],
        defaultExpanded: true,
      },
    ],
    showDebugTrace: true,
  },
  constraints: {
    allowedCapabilityIds: ['vision.analyze.region', 'image.generate.single'],
    maxStepCount: 6,
    allowPublish: true,
    allowSharing: true,
    requiresSmokeTest: true,
  },
  dependencies: {
    capabilityIds: ['vision.analyze.region', 'image.generate.single'],
    minimumPlatformVersion: '0.1.0',
  },
  sharing: {
    author: 'roo',
    summary: 'Phase 3 lifecycle smoke recipe',
    tags: ['fashion', 'mvp'],
    compatibilityVersion: 1,
    createdAt: 1,
    updatedAt: 1,
  },
});

test('serializer and importer keep workflow recipe package round-trippable', () => {
  const recipe = createRecipe();
  const raw = serializeWorkflowRecipe({
    recipe,
    exportedAt: 123,
  });

  const result = importWorkflowRecipe({
    raw,
    now: 456,
  });

  assert.equal(result.ok, true);
  assert.equal(result.report.valid, true);
  assert.equal(result.report.canEnterTesting, true);
  assert.equal(result.report.compatibilityGate.status, 'compatible');
  assert.equal(result.testingRecord?.status, 'idle');
  assert.equal(result.recipe?.recipeId, recipe.recipeId);
});

test('smoke test runs imported workflow recipe through the testing gate', async () => {
  const recipe = createRecipe();

  const result = await runWorkflowRecipeSmokeTest({
    recipe,
    nodeId: 'test-node',
    inputs: {
      garmentImage: 'asset://garment.png',
    },
    capabilityExecutors: {
      analyzeRegion: async () => '区域分析完成',
      generateImage: async () => 'https://example.com/result.png',
    },
    constants: {
      defaultPrompt: 'make a try-on image',
    },
    now: 789,
  });

  assert.equal(result.status, 'passed');
  assert.equal(result.testingRecord.status, 'passed');
  assert.equal(result.report.schemaPassed, true);
  assert.equal(result.report.dryRunPassed, true);
  assert.equal(result.report.smokeRunPassed, true);
  assert.deepEqual(result.nodeInstance.outputValues.resultImage, ['https://example.com/result.png']);
});

test('publisher and rollback keep publish history and rollback history centralized', () => {
  const recipe = createRecipe();
  const imported = importWorkflowRecipe({
    raw: serializeWorkflowRecipe({ recipe, exportedAt: 1000 }),
    now: 1001,
  });

  assert.equal(imported.ok, true);

  const published = publishWorkflowRecipe({
    recipe,
    report: imported.report,
    now: 1002,
  });

  assert.equal(published.ok, true);
  assert.equal(published.record?.status, 'published');
  assert.equal(published.record?.publishHistory.length, 1);
  assert.equal(published.libraryEntry?.recipeId, recipe.recipeId);

  const rolledBack = rollbackWorkflowRecipePublication({
    target: published.record!,
    toVersion: '0.0.9',
    reason: 'smoke regression found',
    now: 1003,
  });

  assert.equal(rolledBack.status, 'rolled_back');
  assert.equal(rolledBack.rollbackHistory.length, 1);
  assert.equal(rolledBack.rollbackHistory[0]?.fromVersion, '0.1.0');
  assert.equal(rolledBack.rollbackHistory[0]?.toVersion, '0.0.9');
});
