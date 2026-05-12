import type { WorkflowRecipeDefinition } from '../../../types/workflow-recipe.types.ts';

export const FASHION_MODEL_TRYON_MVP_RECIPE: WorkflowRecipeDefinition = {
  schemaVersion: 1,
  recipeId: 'fashion-model-tryon-mvp',
  version: '0.1.0',
  title: '模特换装 MVP',
  summary: '基于服装分析与换装编排能力的最小可运行模特换装 recipe。',
  category: 'workflow',
  tags: ['fashion', 'tryon', 'mvp'],
  status: 'testing',
  inputs: [
    {
      id: 'garmentImages',
      label: '服装图',
      description: '用于服装分析与换装的商品图列表，至少 1 张。',
      dataType: 'image_list',
      allowMultiple: true,
      validation: { required: true },
    },
    {
      id: 'modelImage',
      label: '模特图',
      description: '模特或模特锚点图。',
      dataType: 'image',
      validation: { required: true },
    },
    {
      id: 'requirements',
      label: '换装要求',
      description: '结构化换装要求对象。',
      dataType: 'json',
      validation: { required: true },
    },
    {
      id: 'tryonBrief',
      label: '补充说明',
      description: '给服装分析器的补充 brief。',
      dataType: 'text',
      placeholder: '例如：强调材质、领口、衣长和袖型保持一致',
    },
  ],
  outputs: [
    {
      id: 'analysisAnchor',
      label: '分析锚点摘要',
      description: '服装分析阶段产出的锚点描述。',
      dataType: 'text',
      required: true,
    },
    {
      id: 'resultAssets',
      label: '换装结果',
      description: '换装产出的结果资产数组。',
      dataType: 'json',
      required: true,
    },
    {
      id: 'failedItems',
      label: '失败项',
      description: '换装失败或待重试项。',
      dataType: 'json',
    },
  ],
  steps: [
    {
      stepId: 'analyze-garment',
      type: 'capability',
      title: '分析服装商品图',
      capabilityRef: 'fashion.analyze.garment',
      inputMapping: {
        productImages: 'inputs.garmentImages',
        brief: 'inputs.tryonBrief',
      },
      outputMapping: {
        anchorDescription: 'outputs.analysisAnchor',
      },
      onError: 'stop',
    },
    {
      stepId: 'compose-tryon',
      type: 'capability',
      title: '执行换装编排',
      capabilityRef: 'fashion.compose.tryon',
      inputMapping: {
        productImages: 'inputs.garmentImages',
        modelImage: 'inputs.modelImage',
        analysis: 'steps.analyze-garment.outputs',
        requirements: 'inputs.requirements',
      },
      outputMapping: {
        images: 'outputs.resultAssets',
        failedItems: 'outputs.failedItems',
      },
      onError: 'stop',
    },
  ],
  ui: {
    icon: 'shirt',
    accentColor: '#6b7280',
    resultPanelTitle: '模特换装结果',
    showDebugTrace: true,
    sections: [
      {
        id: 'assets',
        title: '素材输入',
        description: '服装图与模特图。',
        fieldIds: ['garmentImages', 'modelImage'],
        defaultExpanded: true,
      },
      {
        id: 'requirements',
        title: '换装要求',
        description: '传给换装编排能力的结构化要求。',
        fieldIds: ['requirements', 'tryonBrief'],
        defaultExpanded: true,
      },
    ],
  },
  constraints: {
    allowedCapabilityIds: ['fashion.analyze.garment', 'fashion.compose.tryon'],
    maxStepCount: 4,
    allowPublish: true,
    allowSharing: true,
    requiresSmokeTest: true,
  },
  dependencies: {
    capabilityIds: ['fashion.analyze.garment', 'fashion.compose.tryon'],
    minimumPlatformVersion: '0.1.0',
  },
  sharing: {
    author: 'roo',
    summary: '模特换装 MVP workflow recipe',
    tags: ['fashion', 'tryon', 'mvp'],
    compatibilityVersion: 1,
    createdAt: 1747000000000,
    updatedAt: 1747000000000,
  },
};
