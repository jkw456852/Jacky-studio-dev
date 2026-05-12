import type { WorkflowRecipeDefinition } from '../../types/workflow-recipe.types.ts';

export interface WorkflowRecipeShareEnvelope {
  schemaVersion: 1;
  kind: 'workflow-recipe';
  exportedAt: number;
  recipe: WorkflowRecipeDefinition;
}

export interface SerializeWorkflowRecipeInput {
  recipe: WorkflowRecipeDefinition;
  exportedAt?: number;
}

export const buildWorkflowRecipeShareEnvelope = ({
  recipe,
  exportedAt = Date.now(),
}: SerializeWorkflowRecipeInput): WorkflowRecipeShareEnvelope => ({
  schemaVersion: 1,
  kind: 'workflow-recipe',
  exportedAt,
  recipe,
});

export const serializeWorkflowRecipe = (
  input: SerializeWorkflowRecipeInput,
): string => JSON.stringify(buildWorkflowRecipeShareEnvelope(input), null, 2);

export const parseWorkflowRecipeShareEnvelope = (
  raw: string,
): WorkflowRecipeShareEnvelope | null => {
  try {
    const parsed = JSON.parse(raw) as WorkflowRecipeShareEnvelope;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.schemaVersion !== 1 || parsed.kind !== 'workflow-recipe') return null;
    if (!parsed.recipe || typeof parsed.recipe !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};
