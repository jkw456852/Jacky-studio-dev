import type {
  CapabilityDomain,
  CapabilityIoSchema,
  CapabilityRuntimeAvailability,
  RecipeCapabilityDefinition,
} from '../../../types/capability-catalog.types.ts';

export interface BuildWorkflowAdapterCapabilityInput {
  id: string;
  label: string;
  domain: CapabilityDomain;
  summary: string;
  inputSchema: CapabilityIoSchema;
  outputSchema: CapabilityIoSchema;
  runtimeAvailability?: CapabilityRuntimeAvailability;
  tags?: string[];
  executorRef?: string;
  safeForRecipe?: boolean;
  deprecated?: boolean;
  replacedBy?: string;
}

export const buildWorkflowAdapterCapability = (
  input: BuildWorkflowAdapterCapabilityInput,
): RecipeCapabilityDefinition => ({
  id: input.id,
  label: input.label,
  domain: input.domain,
  kind: 'workflow-adapter',
  summary: input.summary,
  inputSchema: input.inputSchema,
  outputSchema: input.outputSchema,
  safeForRecipe: input.safeForRecipe !== false,
  runtimeAvailability: input.runtimeAvailability || 'testing',
  executorRef: input.executorRef || input.id,
  tags: Array.isArray(input.tags) ? input.tags : [],
  ...(input.deprecated ? { deprecated: true } : {}),
  ...(input.replacedBy ? { replacedBy: input.replacedBy } : {}),
});
