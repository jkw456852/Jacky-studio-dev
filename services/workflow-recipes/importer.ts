import type {
  WorkflowRecipeDefinition,
  WorkflowRecipeValidationIssue,
} from '../../types/workflow-recipe.types.ts';
import type { WorkflowNodeLibraryRecord } from '../../types/workflow-node.types.ts';
import type { WorkflowRecipeRuntimeError } from '../../types/capability-catalog.types.ts';
import {
  parseWorkflowRecipeShareEnvelope,
  type WorkflowRecipeShareEnvelope,
} from './serializer.ts';
import { validateWorkflowRecipeDefinition } from './validator.ts';

export type WorkflowRecipeImportCompatibilityStatus =
  | 'compatible'
  | 'testing_only'
  | 'blocked';

export interface WorkflowRecipeImportDependencyCheck {
  capabilityId: string;
  available: boolean;
  requiredByRecipe: boolean;
  reason?: string;
}

export interface WorkflowRecipeImportCompatibilityGate {
  status: WorkflowRecipeImportCompatibilityStatus;
  reasons: string[];
  dependencyChecks: WorkflowRecipeImportDependencyCheck[];
}

export interface WorkflowRecipeImportReport {
  recipeId: string;
  recipeVersion: string;
  valid: boolean;
  canEnterTesting: boolean;
  canPublish: boolean;
  validationIssues: WorkflowRecipeValidationIssue[];
  compatibilityGate: WorkflowRecipeImportCompatibilityGate;
  warnings: string[];
}

export interface WorkflowRecipeTestingRecord {
  recipeId: string;
  recipeVersion: string;
  status: 'idle' | 'queued' | 'running' | 'passed' | 'failed';
  lastRunAt?: number;
  lastPassedAt?: number;
  lastErrorCode?: WorkflowRecipeRuntimeError['code'];
  lastErrorMessage?: string;
}

export interface WorkflowRecipePublishRecord extends WorkflowNodeLibraryRecord {
  status: 'testing' | 'published' | 'rolled_back';
  publishHistory: Array<{
    publishedAt: number;
    version: string;
    summary: string;
  }>;
  rollbackHistory: Array<{
    rolledBackAt: number;
    fromVersion: string;
    toVersion: string;
    reason: string;
  }>;
}

export type WorkflowRecipeImportEnvelope = WorkflowRecipeShareEnvelope;

export interface ImportWorkflowRecipeInput {
  raw: string;
  now?: number;
}

export interface ImportWorkflowRecipeResult {
  ok: boolean;
  recipe?: WorkflowRecipeDefinition;
  report: WorkflowRecipeImportReport;
  testingRecord?: WorkflowRecipeTestingRecord;
}

const createBlockedReport = (args: {
  recipeId?: string;
  recipeVersion?: string;
  issues?: WorkflowRecipeValidationIssue[];
  reason: string;
}): WorkflowRecipeImportReport => ({
  recipeId: args.recipeId || 'unknown',
  recipeVersion: args.recipeVersion || 'unknown',
  valid: false,
  canEnterTesting: false,
  canPublish: false,
  validationIssues: args.issues || [],
  compatibilityGate: {
    status: 'blocked',
    reasons: [args.reason],
    dependencyChecks: [],
  },
  warnings: [],
});

const buildCompatibilityGate = (
  recipe: WorkflowRecipeDefinition,
): WorkflowRecipeImportCompatibilityGate => {
  const dependencyChecks = (recipe.dependencies?.capabilityIds || []).map((capabilityId) => ({
    capabilityId,
    available: true,
    requiredByRecipe: true,
  }));

  return {
    status: 'compatible',
    reasons: [],
    dependencyChecks,
  };
};

const buildTestingRecord = (
  recipe: WorkflowRecipeDefinition,
  now: number,
): WorkflowRecipeTestingRecord => ({
  recipeId: recipe.recipeId,
  recipeVersion: recipe.version,
  status: 'idle',
  lastRunAt: now,
});

export const importWorkflowRecipe = ({
  raw,
  now = Date.now(),
}: ImportWorkflowRecipeInput): ImportWorkflowRecipeResult => {
  const envelope = parseWorkflowRecipeShareEnvelope(raw);
  if (!envelope) {
    return {
      ok: false,
      report: createBlockedReport({
        reason: 'Invalid workflow recipe package. Expected schemaVersion=1 and kind=workflow-recipe.',
      }),
    };
  }

  const recipe = envelope.recipe;
  const validation = validateWorkflowRecipeDefinition(recipe);
  const compatibilityGate = buildCompatibilityGate(recipe);
  const report: WorkflowRecipeImportReport = {
    recipeId: recipe.recipeId,
    recipeVersion: recipe.version,
    valid: validation.valid,
    canEnterTesting: validation.valid && compatibilityGate.status !== 'blocked',
    canPublish: validation.valid && compatibilityGate.status === 'compatible',
    validationIssues: validation.issues,
    compatibilityGate,
    warnings: [],
  };

  if (!validation.valid) {
    return {
      ok: false,
      recipe,
      report,
    };
  }

  return {
    ok: true,
    recipe,
    report,
    testingRecord: buildTestingRecord(recipe, now),
  };
};
