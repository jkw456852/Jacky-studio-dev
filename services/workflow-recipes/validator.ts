import type {
  WorkflowRecipeDefinition,
  WorkflowRecipeValidationIssue,
  WorkflowRecipeValidationResult,
} from '../../types/workflow-recipe.types.ts';
import { findRecipeCapability } from '../capability-catalog/registry.ts';

const pushIssue = (
  issues: WorkflowRecipeValidationIssue[],
  issue: WorkflowRecipeValidationIssue,
): void => {
  issues.push(issue);
};

const collectDuplicateIds = (ids: string[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  ids.forEach((item) => {
    const normalized = String(item || '').trim();
    if (!normalized) return;
    if (seen.has(normalized)) {
      duplicates.add(normalized);
      return;
    }
    seen.add(normalized);
  });
  return Array.from(duplicates);
};

export const validateWorkflowRecipeDefinition = (
  recipe: WorkflowRecipeDefinition,
): WorkflowRecipeValidationResult => {
  const issues: WorkflowRecipeValidationIssue[] = [];

  if (!recipe || typeof recipe !== 'object') {
    return {
      valid: false,
      issues: [
        {
          code: 'invalid_type',
          message: 'Recipe definition must be an object.',
          path: 'recipe',
        },
      ],
    };
  }

  if (recipe.schemaVersion !== 1) {
    pushIssue(issues, {
      code: 'invalid_type',
      message: 'Only schemaVersion=1 is currently supported.',
      path: 'schemaVersion',
    });
  }

  if (!String(recipe.recipeId || '').trim()) {
    pushIssue(issues, {
      code: 'missing_field',
      message: 'recipeId is required.',
      path: 'recipeId',
    });
  }

  if (!String(recipe.version || '').trim()) {
    pushIssue(issues, {
      code: 'missing_field',
      message: 'version is required.',
      path: 'version',
    });
  }

  if (!String(recipe.title || '').trim()) {
    pushIssue(issues, {
      code: 'missing_field',
      message: 'title is required.',
      path: 'title',
    });
  }

  if (!Array.isArray(recipe.inputs) || recipe.inputs.length === 0) {
    pushIssue(issues, {
      code: 'missing_field',
      message: 'At least one input field is required.',
      path: 'inputs',
    });
  }

  if (!Array.isArray(recipe.outputs) || recipe.outputs.length === 0) {
    pushIssue(issues, {
      code: 'missing_field',
      message: 'At least one output field is required.',
      path: 'outputs',
    });
  }

  if (!Array.isArray(recipe.steps) || recipe.steps.length === 0) {
    pushIssue(issues, {
      code: 'missing_field',
      message: 'At least one step is required.',
      path: 'steps',
    });
  }

  const duplicateInputIds = collectDuplicateIds((recipe.inputs || []).map((item) => item.id));
  duplicateInputIds.forEach((id) => {
    pushIssue(issues, {
      code: 'duplicate_id',
      message: `Duplicate input id: ${id}`,
      path: 'inputs',
    });
  });

  const duplicateOutputIds = collectDuplicateIds((recipe.outputs || []).map((item) => item.id));
  duplicateOutputIds.forEach((id) => {
    pushIssue(issues, {
      code: 'duplicate_id',
      message: `Duplicate output id: ${id}`,
      path: 'outputs',
    });
  });

  const duplicateStepIds = collectDuplicateIds((recipe.steps || []).map((item) => item.stepId));
  duplicateStepIds.forEach((id) => {
    pushIssue(issues, {
      code: 'duplicate_id',
      message: `Duplicate step id: ${id}`,
      path: 'steps',
    });
  });

  const allowedCapabilityIds = new Set(
    Array.isArray(recipe.constraints?.allowedCapabilityIds)
      ? recipe.constraints.allowedCapabilityIds.map((item) => String(item || '').trim())
      : [],
  );

  (recipe.steps || []).forEach((step, index) => {
    const stepPath = `steps[${index}]`;
    if (!String(step.stepId || '').trim()) {
      pushIssue(issues, {
        code: 'missing_field',
        message: 'stepId is required.',
        path: `${stepPath}.stepId`,
      });
    }

    if (!String(step.title || '').trim()) {
      pushIssue(issues, {
        code: 'missing_field',
        message: 'step title is required.',
        path: `${stepPath}.title`,
      });
    }

    if (step.type === 'capability') {
      const capabilityId = String(step.capabilityRef || '').trim();
      if (!capabilityId) {
        pushIssue(issues, {
          code: 'missing_field',
          message: 'capabilityRef is required for capability steps.',
          path: `${stepPath}.capabilityRef`,
        });
      } else {
        const capability = findRecipeCapability(capabilityId);
        if (!capability) {
          pushIssue(issues, {
            code: 'invalid_reference',
            message: `Unknown capabilityRef: ${capabilityId}`,
            path: `${stepPath}.capabilityRef`,
          });
        } else if (
          allowedCapabilityIds.size > 0 &&
          !allowedCapabilityIds.has(capabilityId)
        ) {
          pushIssue(issues, {
            code: 'capability_not_allowed',
            message: `Capability ${capabilityId} is not in constraints.allowedCapabilityIds.`,
            path: `${stepPath}.capabilityRef`,
          });
        }
      }
    }

    if (
      step.onError === 'fallback' &&
      !String(step.fallbackStepId || '').trim()
    ) {
      pushIssue(issues, {
        code: 'missing_field',
        message: 'fallbackStepId is required when onError=fallback.',
        path: `${stepPath}.fallbackStepId`,
      });
    }
  });

  const maxStepCount = Number(recipe.constraints?.maxStepCount || 0);
  if (maxStepCount > 0 && (recipe.steps || []).length > maxStepCount) {
    pushIssue(issues, {
      code: 'step_limit_exceeded',
      message: `Recipe step count exceeds maxStepCount=${maxStepCount}.`,
      path: 'steps',
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
};
