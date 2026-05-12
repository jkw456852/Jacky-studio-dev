import assert from 'node:assert/strict';
import test from 'node:test';
import { executeWorkflowRecipeInstance } from '../executor.ts';
import { importWorkflowRecipe } from '../importer.ts';
import { serializeWorkflowRecipe } from '../serializer.ts';
import { runWorkflowRecipeSmokeTest } from '../testing.ts';
import { FASHION_MODEL_TRYON_MVP_RECIPE } from './fashion-model-tryon-mvp.recipe.ts';

test('fashion model tryon MVP recipe round-trips through import package and enters testing', () => {
  const raw = serializeWorkflowRecipe({
    recipe: FASHION_MODEL_TRYON_MVP_RECIPE,
    exportedAt: 100,
  });

  const imported = importWorkflowRecipe({
    raw,
    now: 101,
  });

  assert.equal(imported.ok, true);
  assert.equal(imported.recipe?.recipeId, 'fashion-model-tryon-mvp');
  assert.equal(imported.report.valid, true);
  assert.equal(imported.report.canEnterTesting, true);
  assert.deepEqual(imported.report.compatibilityGate.dependencyChecks.map((item) => item.capabilityId), [
    'fashion.analyze.garment',
    'fashion.compose.tryon',
  ]);
});

test('fashion model tryon MVP recipe executes analyze + tryon path with injected executors', async () => {
  const result = await executeWorkflowRecipeInstance({
    recipe: FASHION_MODEL_TRYON_MVP_RECIPE,
    nodeId: 'workflow-node-1',
    inputs: {
      garmentImages: ['asset://garment-front.png', 'asset://garment-back.png'],
      modelImage: 'asset://model.png',
      requirements: {
        aspectRatio: '3:4',
        platform: 'taobao',
        count: 1,
      },
      tryonBrief: '保持领口、版型和颜色一致',
    },
    capabilityExecutors: {
      analyzeClothingProduct: async () => ({
        productType: 'dress',
        isSet: false,
        keyFeatures: ['v-neck'],
        materialGuess: ['cotton'],
        colorPalette: ['white'],
        fitSilhouette: ['slim'],
        anchorDescription: '保留领口、裙长与腰线结构',
        forbiddenChanges: ['不要改领型', '不要改颜色'],
      }),
      clothingStudioWorkflow: async () => ({
        ui: { type: 'clothingStudio.results', total: 1 },
        images: [{ url: 'https://example.com/tryon-result.png', label: '主图' }],
        failedItems: [],
      }),
    },
    now: 200,
  });

  assert.equal(result.status, 'success');
  assert.equal(result.trace.status, 'success');
  assert.equal(result.nodeInstance.stepStates[0]?.status, 'success');
  assert.equal(result.nodeInstance.stepStates[1]?.status, 'success');
  assert.equal(result.outputs.analysisAnchor, '保留领口、裙长与腰线结构');
  assert.deepEqual(result.outputs.resultAssets, [
    { url: 'https://example.com/tryon-result.png', label: '主图' },
  ]);
  assert.deepEqual(result.outputs.failedItems, []);
});

test('fashion model tryon MVP smoke test passes through standardized testing gate', async () => {
  const result = await runWorkflowRecipeSmokeTest({
    recipe: FASHION_MODEL_TRYON_MVP_RECIPE,
    nodeId: 'tryon-smoke-node',
    inputs: {
      garmentImages: ['asset://garment-front.png'],
      modelImage: 'asset://model.png',
      requirements: {
        aspectRatio: '3:4',
        platform: 'taobao',
        count: 1,
      },
      tryonBrief: '强调面料和版型保持一致',
    },
    capabilityExecutors: {
      analyzeClothingProduct: async () => ({
        productType: 'tops',
        isSet: false,
        keyFeatures: ['crew neck'],
        materialGuess: ['knit'],
        colorPalette: ['black'],
        fitSilhouette: ['regular'],
        anchorDescription: '保持肩线、袖长和面料纹理',
        forbiddenChanges: ['不要改袖长'],
      }),
      clothingStudioWorkflow: async () => ({
        ui: { type: 'clothingStudio.results', total: 1 },
        images: [{ url: 'https://example.com/mvp-smoke.png', label: 'smoke' }],
        failedItems: [],
      }),
    },
    now: 300,
  });

  assert.equal(result.status, 'passed');
  assert.equal(result.testingRecord.status, 'passed');
  assert.equal(result.report.schemaPassed, true);
  assert.equal(result.report.dryRunPassed, true);
  assert.equal(result.report.smokeRunPassed, true);
  assert.deepEqual(result.nodeInstance.outputValues.resultAssets, [
    { url: 'https://example.com/mvp-smoke.png', label: 'smoke' },
  ]);
}
);
