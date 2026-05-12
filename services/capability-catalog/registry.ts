import type {
  CapabilityDomain,
  CapabilityIoSchema,
  RecipeCapabilityDefinition,
} from '../../types/capability-catalog.types.ts';
import { buildBrowserToolRecipeCapability } from './adapters/browser-tool-capability.adapter.ts';
import { buildInternalServiceCapability } from './adapters/internal-service-capability.adapter.ts';
import { buildSkillRecipeCapability } from './adapters/skill-capability.adapter.ts';
import { buildWorkflowAdapterCapability } from './adapters/workflow-adapter-capability.adapter.ts';

const EMPTY_OBJECT_SCHEMA: CapabilityIoSchema = {
  type: 'object',
  properties: {},
  additionalProperties: true,
};

export const RECIPE_CAPABILITY_REGISTRY: RecipeCapabilityDefinition[] = [
  buildInternalServiceCapability({
    id: 'asset.ingest.image',
    label: 'Image Asset Ingest',
    domain: 'asset',
    summary:
      'Normalize image-like user inputs into recipe-usable asset references before execution.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string' },
        sourceType: { type: 'string' },
      },
      required: ['source'],
      additionalProperties: true,
    },
    outputSchema: {
      type: 'object',
      properties: {
        assetRef: { type: 'string' },
        mimeType: { type: 'string' },
      },
      required: ['assetRef'],
      additionalProperties: true,
    },
    runtimeAvailability: 'testing',
    executorRef: 'asset.ingest.image',
    tags: ['asset', 'image', 'ingest'],
  }),
  buildSkillRecipeCapability({
    id: 'vision.analyze.region',
    label: 'Analyze Image Region',
    domain: 'vision',
    summary:
      'Inspect a selected image region and return structured analysis signals for downstream steps.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceUrl: { type: 'string' },
        region: { type: 'object' },
      },
      required: ['sourceUrl'],
      additionalProperties: true,
    },
    outputSchema: {
      type: 'object',
      properties: {
        analysis: { type: 'string' },
      },
      required: ['analysis'],
      additionalProperties: true,
    },
    runtimeAvailability: 'stable',
    executorRef: 'analyzeRegion',
    tags: ['vision', 'analysis', 'region'],
  }),
  buildSkillRecipeCapability({
    id: 'vision.ocr.extract-text',
    label: 'Extract Image Text',
    domain: 'vision',
    summary:
      'Read visible text from an image or selected visual region.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceUrl: { type: 'string' },
      },
      required: ['sourceUrl'],
      additionalProperties: true,
    },
    outputSchema: {
      type: 'object',
      properties: {
        recognizedText: { type: 'string' },
      },
      required: ['recognizedText'],
      additionalProperties: true,
    },
    runtimeAvailability: 'stable',
    executorRef: 'extractText',
    tags: ['vision', 'ocr', 'text'],
  }),
  buildSkillRecipeCapability({
    id: 'research.search.web',
    label: 'Workspace Web Search',
    domain: 'research',
    summary:
      'Run live workspace-backed web research and return citations plus extracted evidence.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        mode: { type: 'string' },
        includePageExtracts: { type: 'boolean' },
        maxExtractPages: { type: 'number' },
      },
      required: ['query'],
      additionalProperties: true,
    },
    outputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        citations: { type: 'array' },
        extractedPages: { type: 'array' },
      },
      required: ['summary'],
      additionalProperties: true,
    },
    runtimeAvailability: 'conditional',
    executorRef: 'workspaceSearch',
    tags: ['research', 'search', 'web'],
  }),
  buildInternalServiceCapability({
    id: 'planning.plan.recipe',
    label: 'Recipe Planning',
    domain: 'planning',
    summary:
      'Turn user intent plus available capabilities into a draft workflow recipe plan.',
    inputSchema: {
      type: 'object',
      properties: {
        goal: { type: 'string' },
        constraints: { type: 'array' },
      },
      required: ['goal'],
      additionalProperties: true,
    },
    outputSchema: {
      type: 'object',
      properties: {
        recipeDraft: { type: 'object' },
      },
      required: ['recipeDraft'],
      additionalProperties: true,
    },
    safeForRecipe: false,
    runtimeAvailability: 'testing',
    executorRef: 'planning.plan.recipe',
    tags: ['planning', 'recipe', 'draft'],
  }),
  buildBrowserToolRecipeCapability({
    id: 'canvas.inspect.runtime',
    label: 'Inspect Canvas Runtime',
    domain: 'canvas',
    summary:
      'Read browser-agent runtime and host snapshot information for the current canvas container.',
    inputSchema: EMPTY_OBJECT_SCHEMA,
    outputSchema: {
      type: 'object',
      properties: {
        snapshot: { type: 'object' },
        hosts: { type: 'array' },
      },
      required: ['snapshot', 'hosts'],
      additionalProperties: true,
    },
    runtimeAvailability: 'conditional',
    executorRef: 'browser.read_runtime_snapshot',
    tags: ['canvas', 'browser-tool', 'runtime', 'debug'],
    safeForRecipe: false,
  }),
  buildWorkflowAdapterCapability({
    id: 'fashion.compose.tryon',
    label: 'Fashion Try-On Workflow',
    domain: 'fashion',
    summary:
      'Run the existing clothing studio workflow adapter to compose a model try-on result from garment, model, and requirements inputs.',
    inputSchema: {
      type: 'object',
      properties: {
        productImages: { type: 'array' },
        modelImage: { type: 'string' },
        preferredImageModel: { type: 'string' },
        modelAnchorSheetUrl: { type: 'string' },
        productAnchorUrl: { type: 'string' },
        analysis: { type: 'object' },
        requirements: { type: 'object' },
      },
      required: ['productImages'],
      additionalProperties: true,
    },
    outputSchema: {
      type: 'object',
      properties: {
        ui: { type: 'object' },
        images: { type: 'array' },
        failedItems: { type: 'array' },
      },
      required: ['ui'],
      additionalProperties: true,
    },
    runtimeAvailability: 'testing',
    executorRef: 'clothingStudioWorkflow',
    tags: ['fashion', 'workflow-adapter', 'tryon'],
  }),
  buildSkillRecipeCapability({
    id: 'image.generate.single',
    label: 'Generate Image',
    domain: 'image',
    summary:
      'Generate a single image result from prompt plus optional references.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        referenceImage: { type: 'string' },
        referenceImages: { type: 'array' },
        aspectRatio: { type: 'string' },
        model: { type: 'string' },
      },
      required: ['prompt'],
      additionalProperties: true,
    },
    outputSchema: {
      type: 'object',
      properties: {
        imageUrls: { type: 'array' },
      },
      required: ['imageUrls'],
      additionalProperties: true,
    },
    runtimeAvailability: 'stable',
    executorRef: 'generateImage',
    tags: ['image', 'generate'],
  }),
  buildSkillRecipeCapability({
    id: 'image.edit.smart',
    label: 'Smart Image Edit',
    domain: 'image',
    summary:
      'Apply removal, replacement, recolor, background, or refinement edits to an existing image.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceUrl: { type: 'string' },
        instruction: { type: 'string' },
      },
      required: ['sourceUrl', 'instruction'],
      additionalProperties: true,
    },
    outputSchema: {
      type: 'object',
      properties: {
        imageUrls: { type: 'array' },
      },
      required: ['imageUrls'],
      additionalProperties: true,
    },
    runtimeAvailability: 'stable',
    executorRef: 'smartEdit',
    tags: ['image', 'edit', 'smart'],
  }),
  buildSkillRecipeCapability({
    id: 'image.edit.touch',
    label: 'Touch Edit Image',
    domain: 'image',
    summary:
      'Apply local touch-up editing to an existing image with explicit edit instruction and optional region geometry.',
    inputSchema: {
      type: 'object',
      properties: {
        imageData: { type: 'string' },
        editInstruction: { type: 'string' },
        regionX: { type: 'number' },
        regionY: { type: 'number' },
        regionWidth: { type: 'number' },
        regionHeight: { type: 'number' },
        aspectRatio: { type: 'string' },
      },
      required: ['imageData', 'editInstruction'],
      additionalProperties: true,
    },
    outputSchema: {
      type: 'object',
      properties: {
        analysis: { type: 'string' },
        editedImage: { type: 'string' },
      },
      required: ['analysis', 'editedImage'],
      additionalProperties: true,
    },
    runtimeAvailability: 'stable',
    executorRef: 'touchEdit',
    tags: ['image', 'edit', 'touch'],
  }),
  buildSkillRecipeCapability({
    id: 'video.generate.clip',
    label: 'Generate Video Clip',
    domain: 'video',
    summary:
      'Generate a video clip from prompt and optional frames or references.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        startFrame: { type: 'string' },
        endFrame: { type: 'string' },
        duration: { type: 'string' },
      },
      required: ['prompt'],
      additionalProperties: true,
    },
    outputSchema: {
      type: 'object',
      properties: {
        videoUrls: { type: 'array' },
        assets: { type: 'array' },
      },
      additionalProperties: true,
    },
    runtimeAvailability: 'stable',
    executorRef: 'generateVideo',
    tags: ['video', 'generate'],
  }),
  buildWorkflowAdapterCapability({
    id: 'fashion.analyze.garment',
    label: 'Analyze Garment Product',
    domain: 'fashion',
    summary:
      'Analyze apparel product images into structured clothing analysis suitable for try-on and styling workflows.',
    inputSchema: {
      type: 'object',
      properties: {
        productImages: { type: 'array' },
        brief: { type: 'string' },
      },
      required: ['productImages'],
      additionalProperties: true,
    },
    outputSchema: {
      type: 'object',
      properties: {
        productType: { type: 'string' },
        isSet: { type: 'boolean' },
        keyFeatures: { type: 'array' },
        materialGuess: { type: 'array' },
        colorPalette: { type: 'array' },
        fitSilhouette: { type: 'array' },
        anchorDescription: { type: 'string' },
        forbiddenChanges: { type: 'array' },
      },
      required: ['productType', 'anchorDescription'],
      additionalProperties: true,
    },
    runtimeAvailability: 'testing',
    executorRef: 'analyzeClothingProduct',
    tags: ['fashion', 'analysis', 'garment'],
  }),
  buildInternalServiceCapability({
    id: 'workflow.execute.recipe',
    label: 'Execute Workflow Recipe',
    domain: 'workflow',
    summary:
      'Run a validated workflow recipe instance through the standard recipe executor.',
    inputSchema: {
      type: 'object',
      properties: {
        recipeId: { type: 'string' },
        nodeId: { type: 'string' },
        inputs: { type: 'object' },
      },
      required: ['recipeId', 'nodeId', 'inputs'],
      additionalProperties: true,
    },
    outputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        outputs: { type: 'object' },
      },
      required: ['status', 'outputs'],
      additionalProperties: true,
    },
    safeForRecipe: false,
    runtimeAvailability: 'testing',
    executorRef: 'workflow.execute.recipe',
    tags: ['workflow', 'executor'],
  }),
  buildInternalServiceCapability({
    id: 'canvas.write.result-asset',
    label: 'Write Result To Canvas',
    domain: 'canvas',
    summary:
      'Persist a recipe output asset back into the canvas and bind it to the originating workflow node.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string' },
        asset: { type: 'object' },
      },
      required: ['nodeId', 'asset'],
      additionalProperties: true,
    },
    outputSchema: EMPTY_OBJECT_SCHEMA,
    safeForRecipe: false,
    runtimeAvailability: 'testing',
    executorRef: 'canvas.write.result-asset',
    tags: ['canvas', 'output', 'asset'],
  }),
  buildInternalServiceCapability({
    id: 'package.export.recipe',
    label: 'Export Recipe Package',
    domain: 'package',
    summary:
      'Serialize a validated workflow recipe into a shareable package payload.',
    inputSchema: {
      type: 'object',
      properties: {
        recipeId: { type: 'string' },
        version: { type: 'string' },
      },
      required: ['recipeId'],
      additionalProperties: true,
    },
    outputSchema: {
      type: 'object',
      properties: {
        packageJson: { type: 'string' },
      },
      required: ['packageJson'],
      additionalProperties: true,
    },
    safeForRecipe: false,
    runtimeAvailability: 'testing',
    executorRef: 'package.export.recipe',
    tags: ['package', 'export', 'share'],
  }),
];

export const listRecipeCapabilities = (): RecipeCapabilityDefinition[] =>
  RECIPE_CAPABILITY_REGISTRY.map((item) => ({ ...item }));

export const findRecipeCapability = (
  capabilityId: string,
): RecipeCapabilityDefinition | null => {
  const normalized = String(capabilityId || '').trim().toLowerCase();
  if (!normalized) return null;
  return (
    RECIPE_CAPABILITY_REGISTRY.find(
      (item) => String(item.id || '').trim().toLowerCase() === normalized,
    ) || null
  );
};

export const listRecipeCapabilitiesByDomain = (
  domain: CapabilityDomain,
): RecipeCapabilityDefinition[] =>
  RECIPE_CAPABILITY_REGISTRY.filter((item) => item.domain === domain).map((item) => ({
    ...item,
  }));

export const assertRecipeCapability = (
  capabilityId: string,
): RecipeCapabilityDefinition => {
  const found = findRecipeCapability(capabilityId);
  if (!found) {
    throw new Error(`Recipe capability not found: ${capabilityId}`);
  }
  return found;
};

export const listRecipeCapabilityIds = (): string[] =>
  RECIPE_CAPABILITY_REGISTRY.map((item) => item.id);
