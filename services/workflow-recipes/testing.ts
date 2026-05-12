import type { WorkflowRecipeExecutionLog } from '../../types/capability-catalog.types.ts';
import type { WorkflowNodeInstance } from '../../types/workflow-node.types.ts';
import type { WorkflowRecipeDefinition } from '../../types/workflow-recipe.types.ts';
import {
  executeWorkflowRecipeInstance,
  type WorkflowRecipeCapabilityExecutor,
} from './executor.ts';
import type { WorkflowRecipeTestingRecord } from './importer.ts';

export interface RunWorkflowRecipeSmokeTestInput {
  recipe: WorkflowRecipeDefinition;
  nodeId?: string;
  inputs: Record<string, unknown>;
  capabilityExecutors?: Record<string, WorkflowRecipeCapabilityExecutor>;
  constants?: Record<string, unknown>;
  context?: Record<string, unknown>;
  now?: number;
}

export interface WorkflowRecipeSmokeTestReport {
  schemaPassed: boolean;
  dryRunPassed: boolean;
  smokeRunPassed: boolean;
  outputKeys: string[];
  logs: WorkflowRecipeExecutionLog[];
  errorCode?: string;
  errorMessage?: string;
}

export interface RunWorkflowRecipeSmokeTestResult {
  status: 'passed' | 'failed';
  testingRecord: WorkflowRecipeTestingRecord;
  report: WorkflowRecipeSmokeTestReport;
  nodeInstance: WorkflowNodeInstance;
}

const createTestingRecord = (args: {
  recipe: WorkflowRecipeDefinition;
  now: number;
  status: WorkflowRecipeTestingRecord['status'];
  errorCode?: WorkflowRecipeTestingRecord['lastErrorCode'];
  errorMessage?: string;
}): WorkflowRecipeTestingRecord => ({
  recipeId: args.recipe.recipeId,
  recipeVersion: args.recipe.version,
  status: args.status,
  lastRunAt: args.now,
  lastPassedAt: args.status === 'passed' ? args.now : undefined,
  lastErrorCode: args.errorCode,
  lastErrorMessage: args.errorMessage,
});

export const runWorkflowRecipeSmokeTest = async ({
  recipe,
  nodeId = `test:${recipe.recipeId}`,
  inputs,
  capabilityExecutors,
  constants,
  context,
  now = Date.now(),
}: RunWorkflowRecipeSmokeTestInput): Promise<RunWorkflowRecipeSmokeTestResult> => {
  const execution = await executeWorkflowRecipeInstance({
    recipe,
    nodeId,
    inputs,
    capabilityExecutors,
    constants,
    context,
    now,
  });

  const passed = execution.status === 'success';
  const report: WorkflowRecipeSmokeTestReport = {
    schemaPassed: execution.error?.code !== 'schema_invalid',
    dryRunPassed:
      execution.error?.code !== 'schema_invalid' &&
      execution.error?.code !== 'capability_missing',
    smokeRunPassed: passed,
    outputKeys: Object.keys(execution.outputs || {}),
    logs: execution.logs,
    errorCode: execution.error?.code,
    errorMessage: execution.error?.message,
  };

  return {
    status: passed ? 'passed' : 'failed',
    testingRecord: createTestingRecord({
      recipe,
      now,
      status: passed ? 'passed' : 'failed',
      errorCode: execution.error?.code,
      errorMessage: execution.error?.message,
    }),
    report,
    nodeInstance: execution.nodeInstance,
  };
};
