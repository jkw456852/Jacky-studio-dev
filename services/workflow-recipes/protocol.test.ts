import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertRecipeCapability,
  findRecipeCapability,
  listRecipeCapabilities,
  listRecipeCapabilitiesByDomain,
  listRecipeCapabilityIds,
} from '../capability-catalog/registry.ts';
import { executeWorkflowRecipeInstance } from './executor.ts';
import { validateWorkflowRecipeDefinition } from './validator.ts';
import type { WorkflowRecipeDefinition } from '../../types/workflow-recipe.types.ts';

const createValidRecipe = (): WorkflowRecipeDefinition => ({
  schemaVersion: 1,
  recipeId: 'fashion-model-tryon',
  version: '0.1.0',
  title: '模特换装工作流',
  summary: '用于验证协议层骨架的最小可用 recipe。',
  category: 'workflow',
  tags: ['fashion', 'tryon'],
  status: 'draft',
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
      onError: 'fallback',
      fallbackStepId: 'write-output',
    },
    {
      stepId: 'write-output',
      type: 'output',
      title: '整理输出',
      outputMapping: {
        resultImage: 'outputs.resultImage',
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
    summary: '协议层 smoke recipe',
    tags: ['fashion', 'mvp'],
    compatibilityVersion: 1,
    createdAt: 1,
    updatedAt: 1,
  },
});

test('recipe capability registry exposes stable lookup helpers', () => {
  const all = listRecipeCapabilities();
  const ids = listRecipeCapabilityIds();
  const visionOnly = listRecipeCapabilitiesByDomain('vision');

  assert.equal(all.length > 0, true);
  assert.equal(ids.includes('image.generate.single'), true);
  assert.equal(Boolean(findRecipeCapability('research.search.web')), true);
  assert.equal(visionOnly.some((item) => item.id === 'vision.ocr.extract-text'), true);
  assert.equal(assertRecipeCapability('canvas.write.result-asset').domain, 'canvas');
  assert.throws(() => assertRecipeCapability('unknown.capability'), /not found/);
});

test('recipe capability registry covers skill browser-tool workflow-adapter and internal-service kinds through shared builders', () => {
  const all = listRecipeCapabilities();
  const byId = new Map(all.map((item) => [item.id, item]));

  assert.equal(byId.get('vision.analyze.region')?.kind, 'skill');
  assert.equal(byId.get('canvas.inspect.runtime')?.kind, 'browser-tool');
  assert.equal(byId.get('fashion.compose.tryon')?.kind, 'workflow-adapter');
  assert.equal(byId.get('workflow.execute.recipe')?.kind, 'internal-service');
  assert.equal(byId.get('fashion.compose.tryon')?.executorRef, 'clothingStudioWorkflow');
  assert.equal(byId.get('canvas.inspect.runtime')?.executorRef, 'browser.read_runtime_snapshot');
});

test('validator accepts a well-formed recipe scaffold', () => {
  const result = validateWorkflowRecipeDefinition(createValidRecipe());

  assert.equal(result.valid, true);
  assert.deepEqual(result.issues, []);
});

test('validator blocks capability references outside the whitelist and missing fallback target', () => {
  const recipe = createValidRecipe();
  recipe.steps[1] = {
    ...recipe.steps[1],
    capabilityRef: 'research.search.web',
    fallbackStepId: '',
  };

  const result = validateWorkflowRecipeDefinition(recipe);

  assert.equal(result.valid, false);
  assert.equal(
    result.issues.some((item) => item.code === 'capability_not_allowed'),
    true,
  );
  assert.equal(
    result.issues.some(
      (item) =>
        item.code === 'missing_field' && item.path.endsWith('.fallbackStepId'),
    ),
    true,
  );
});

test('executor runs bound capability executors through the standardized recipe path', async () => {
  const recipe = createValidRecipe();
  const result = await executeWorkflowRecipeInstance({
    recipe,
    nodeId: 'node-1',
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
    now: 100,
  });

  assert.equal(result.status, 'success');
  assert.equal(result.nodeInstance.recipeId, recipe.recipeId);
  assert.equal(result.trace.status, 'success');
  assert.equal(result.nodeInstance.stepStates[0]?.status, 'success');
  assert.equal(result.nodeInstance.stepStates[1]?.status, 'success');
  assert.equal(result.nodeInstance.stepStates[2]?.status, 'skipped');
  assert.equal(result.logs.some((item) => item.message.includes('executed via analyzeRegion')), true);
  assert.deepEqual(result.outputs.resultImage, ['https://example.com/result.png']);
});

test('executor fails fast for invalid recipes before any step execution', async () => {
  const recipe = createValidRecipe();
  recipe.recipeId = '';

  const result = await executeWorkflowRecipeInstance({
    recipe,
    nodeId: 'node-invalid',
    inputs: {},
    now: 200,
  });

  assert.equal(result.status, 'failed');
  assert.equal(result.error?.code, 'schema_invalid');
  assert.equal(result.trace.status, 'failed');
  assert.equal(result.nodeInstance.lastErrorCode, 'schema_invalid');
});
