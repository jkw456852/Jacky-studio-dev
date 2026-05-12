import type {
  WorkflowRecipeNodeStatus,
  WorkflowRecipeStepStatus,
} from './workflow-recipe.types';

export interface WorkflowNodeStepState {
  stepId: string;
  title: string;
  status: WorkflowRecipeStepStatus;
  startedAt?: number;
  completedAt?: number;
  skipped?: boolean;
  inputSnapshot?: Record<string, unknown>;
  outputSnapshot?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
}

export interface WorkflowNodeRuntimeTrace {
  runId: string;
  recipeId: string;
  recipeVersion: string;
  startedAt: number;
  completedAt?: number;
  status: WorkflowRecipeNodeStatus;
  stepStates: WorkflowNodeStepState[];
  logs: string[];
}

export interface WorkflowNodeInstance {
  nodeId: string;
  recipeId: string;
  recipeVersion: string;
  title: string;
  summary?: string;
  status: WorkflowRecipeNodeStatus;
  inputValues: Record<string, unknown>;
  outputValues: Record<string, unknown>;
  stepStates: WorkflowNodeStepState[];
  lastRunId?: string;
  lastRunAt?: number;
  lastCompletedAt?: number;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  trace?: WorkflowNodeRuntimeTrace;
}

export interface WorkflowNodeLibraryRecord {
  recipeId: string;
  version: string;
  title: string;
  summary: string;
  tags: string[];
  publishedAt: number;
  updatedAt: number;
  source: 'system' | 'user' | 'shared';
}

export interface WorkflowNodeCanvasBinding {
  canvasElementId: string;
  workflowNodeId: string;
  recipeId: string;
  role?: 'entry' | 'processor' | 'output';
}
