import type { WorkflowNodeLibraryRecord } from '../../types/workflow-node.types.ts';
import type { WorkflowRecipeDefinition } from '../../types/workflow-recipe.types.ts';
import type {
  WorkflowRecipeImportReport,
  WorkflowRecipePublishRecord,
} from './importer.ts';

export interface PublishWorkflowRecipeInput {
  recipe: WorkflowRecipeDefinition;
  report: WorkflowRecipeImportReport;
  existing?: WorkflowRecipePublishRecord | null;
  now?: number;
}

export interface PublishWorkflowRecipeResult {
  ok: boolean;
  record?: WorkflowRecipePublishRecord;
  libraryEntry?: WorkflowNodeLibraryRecord;
  reason?: string;
}

export interface RollbackWorkflowRecipePublicationInput {
  target: WorkflowRecipePublishRecord;
  toVersion: string;
  reason: string;
  now?: number;
}

const buildLibraryEntry = (
  recipe: WorkflowRecipeDefinition,
  publishedAt: number,
): WorkflowNodeLibraryRecord => ({
  recipeId: recipe.recipeId,
  version: recipe.version,
  title: recipe.title,
  summary: recipe.summary,
  tags: recipe.tags,
  publishedAt,
  updatedAt: publishedAt,
  source: 'user',
});

export const publishWorkflowRecipe = ({
  recipe,
  report,
  existing,
  now = Date.now(),
}: PublishWorkflowRecipeInput): PublishWorkflowRecipeResult => {
  if (!report.canPublish) {
    return {
      ok: false,
      reason: 'Recipe is blocked from publish until validation and testing gates pass.',
    };
  }

  const libraryEntry = buildLibraryEntry(recipe, now);
  const publishHistory = [
    ...(existing?.publishHistory || []),
    {
      publishedAt: now,
      version: recipe.version,
      summary: recipe.sharing.summary,
    },
  ];

  const record: WorkflowRecipePublishRecord = {
    ...libraryEntry,
    status: 'published',
    publishHistory,
    rollbackHistory: existing?.rollbackHistory || [],
  };

  return {
    ok: true,
    record,
    libraryEntry,
  };
};

export const rollbackWorkflowRecipePublication = ({
  target,
  toVersion,
  reason,
  now = Date.now(),
}: RollbackWorkflowRecipePublicationInput): WorkflowRecipePublishRecord => ({
  ...target,
  version: toVersion,
  status: 'rolled_back',
  updatedAt: now,
  rollbackHistory: [
    ...target.rollbackHistory,
    {
      rolledBackAt: now,
      fromVersion: target.version,
      toVersion,
      reason,
    },
  ],
});
