import { findRecipeCapability } from '../capability-catalog/registry.ts';
import type {
  WorkflowNodeInstance,
  WorkflowNodeRuntimeTrace,
  WorkflowNodeStepState,
} from '../../types/workflow-node.types.ts';
import type {
  WorkflowRecipeDefinition,
  WorkflowRecipeNodeStatus,
} from '../../types/workflow-recipe.types.ts';
import type {
  WorkflowRecipeExecutionLog,
  WorkflowRecipeRuntimeError,
} from '../../types/capability-catalog.types.ts';
import { validateWorkflowRecipeDefinition } from './validator.ts';

export type WorkflowRecipeCapabilityExecutor = (
  input: Record<string, unknown>,
) => Promise<unknown> | unknown;

export interface ExecuteWorkflowRecipeInstanceInput {
  recipe: WorkflowRecipeDefinition;
  nodeId: string;
  inputs: Record<string, unknown>;
  capabilityExecutors?: Record<string, WorkflowRecipeCapabilityExecutor>;
  constants?: Record<string, unknown>;
  context?: Record<string, unknown>;
  now?: number;
}

export interface ExecuteWorkflowRecipeInstanceResult {
  status: WorkflowRecipeNodeStatus;
  outputs: Record<string, unknown>;
  nodeInstance: WorkflowNodeInstance;
  trace: WorkflowNodeRuntimeTrace;
  logs: WorkflowRecipeExecutionLog[];
  error?: WorkflowRecipeRuntimeError;
}

const createStepStates = (
  recipe: WorkflowRecipeDefinition,
): WorkflowNodeStepState[] =>
  recipe.steps.map((step) => ({
    stepId: step.stepId,
    title: step.title,
    status: 'pending',
  }));

const buildError = (
  code: WorkflowRecipeRuntimeError['code'],
  message: string,
  stepId?: string,
  detail?: unknown,
): WorkflowRecipeRuntimeError => ({
  code,
  message,
  stepId,
  detail,
});

const readPath = (
  source: Record<string, unknown> | undefined,
  path: string,
): unknown => {
  if (!source) return undefined;
  const normalized = String(path || '').trim();
  if (!normalized) return undefined;
  return normalized.split('.').reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object' && segment in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, source);
};

const assignPath = (
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void => {
  const normalized = String(path || '').trim();
  if (!normalized) return;
  const segments = normalized.split('.');
  let cursor: Record<string, unknown> = target;
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      cursor[segment] = value;
      return;
    }
    const current = cursor[segment];
    if (!current || typeof current !== 'object') {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  });
};

const assignMappedOutput = (args: {
  path: string;
  value: unknown;
  stepOutputs: Record<string, Record<string, unknown>>;
  nodeOutputs: Record<string, unknown>;
}): void => {
  const normalized = String(args.path || '').trim();
  if (!normalized) return;

  if (normalized.startsWith('outputs.')) {
    assignPath(args.nodeOutputs, normalized.slice('outputs.'.length), args.value);
    return;
  }

  if (normalized.startsWith('steps.')) {
    const segments = normalized.split('.');
    if (segments.length >= 4 && segments[2] === 'outputs') {
      const stepId = segments[1];
      args.stepOutputs[stepId] ||= {};
      assignPath(args.stepOutputs[stepId], segments.slice(3).join('.'), args.value);
    }
  }
};

const resolveMappedValue = (args: {
  path: string;
  inputs: Record<string, unknown>;
  constants: Record<string, unknown>;
  context: Record<string, unknown>;
  stepOutputs: Record<string, Record<string, unknown>>;
}): unknown => {
  const normalized = String(args.path || '').trim();
  if (!normalized) return undefined;
  if (normalized.startsWith('inputs.')) {
    return readPath(args.inputs, normalized.slice('inputs.'.length));
  }
  if (normalized.startsWith('constants.')) {
    return readPath(args.constants, normalized.slice('constants.'.length));
  }
  if (normalized.startsWith('context.')) {
    return readPath(args.context, normalized.slice('context.'.length));
  }
  if (normalized.startsWith('steps.')) {
    const segments = normalized.split('.');
    if (segments.length >= 4 && segments[2] === 'outputs') {
      const stepId = segments[1];
      return readPath(args.stepOutputs[stepId], segments.slice(3).join('.'));
    }
  }
  return undefined;
};

const buildStepInput = (args: {
  mapping: Record<string, string> | undefined;
  inputs: Record<string, unknown>;
  constants: Record<string, unknown>;
  context: Record<string, unknown>;
  stepOutputs: Record<string, Record<string, unknown>>;
}): Record<string, unknown> => {
  const next: Record<string, unknown> = {};
  Object.entries(args.mapping || {}).forEach(([key, path]) => {
    next[key] = resolveMappedValue({
      path,
      inputs: args.inputs,
      constants: args.constants,
      context: args.context,
      stepOutputs: args.stepOutputs,
    });
  });
  return next;
};

const normalizeCapabilityResult = (
  capabilityId: string,
  raw: unknown,
): Record<string, unknown> => {
  if (capabilityId === 'vision.analyze.region') {
    return { analysis: raw };
  }
  if (capabilityId === 'vision.ocr.extract-text') {
    return { recognizedText: raw };
  }
  if (capabilityId === 'image.generate.single') {
    if (Array.isArray(raw)) return { imageUrls: raw };
    if (typeof raw === 'string' && raw.trim()) return { imageUrls: [raw] };
    return { imageUrls: [] };
  }
  if (capabilityId === 'image.edit.smart') {
    if (Array.isArray(raw)) return { imageUrls: raw };
    if (typeof raw === 'string' && raw.trim()) return { imageUrls: [raw] };
    return { imageUrls: [] };
  }
  if (capabilityId === 'research.search.web' && raw && typeof raw === 'object') {
    return raw as Record<string, unknown>;
  }
  if (capabilityId === 'fashion.compose.tryon' && raw && typeof raw === 'object') {
    return raw as Record<string, unknown>;
  }
  if (capabilityId === 'fashion.analyze.garment' && raw && typeof raw === 'object') {
    return raw as Record<string, unknown>;
  }
  if (capabilityId === 'image.edit.touch' && raw && typeof raw === 'object') {
    return raw as Record<string, unknown>;
  }
  if (capabilityId === 'video.generate.clip') {
    if (Array.isArray(raw)) return { videoUrls: raw, assets: [] };
    if (typeof raw === 'string' && raw.trim()) return { videoUrls: [raw], assets: [] };
    if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
    return { videoUrls: [], assets: [] };
  }
  if (raw && typeof raw === 'object') {
    return raw as Record<string, unknown>;
  }
  return { value: raw };
};

const resolveCapabilityExecutor = async (args: {
  capabilityId: string;
  executorRef: string;
  kind: 'skill' | 'browser-tool' | 'workflow-adapter' | 'internal-service';
  capabilityExecutors?: Record<string, WorkflowRecipeCapabilityExecutor>;
}): Promise<WorkflowRecipeCapabilityExecutor | null> => {
  const injected =
    args.capabilityExecutors?.[args.capabilityId] ||
    args.capabilityExecutors?.[args.executorRef];
  if (injected) {
    return injected;
  }

  if (args.kind === 'skill' || args.kind === 'workflow-adapter') {
    const { executeSkill } = await import('../skills/index.ts');
    return (input) => executeSkill(args.executorRef, input);
  }

  if (args.kind === 'browser-tool') {
    const { ensureBrowserAgentRuntime } = await import('../browser-agent/runtime.ts');
    const { executeBrowserTool } = await import('../browser-agent/tool-registry.ts');
    ensureBrowserAgentRuntime();
    return (input) => executeBrowserTool(args.executorRef, input);
  }

  return null;
};

const executeCapabilityBinding = async (args: {
  capabilityId: string;
  executorRef: string;
  kind: 'skill' | 'browser-tool' | 'workflow-adapter' | 'internal-service';
  input: Record<string, unknown>;
  capabilityExecutors?: Record<string, WorkflowRecipeCapabilityExecutor>;
}): Promise<Record<string, unknown>> => {
  const executor = await resolveCapabilityExecutor({
    capabilityId: args.capabilityId,
    executorRef: args.executorRef,
    kind: args.kind,
    capabilityExecutors: args.capabilityExecutors,
  });

  if (!executor) {
    return {
      status: 'skipped',
      reason: `internal capability ${args.capabilityId} is not bound in Phase 2 yet.`,
    };
  }

  const raw = await executor(args.input);
  return normalizeCapabilityResult(args.capabilityId, raw);
};

export const executeWorkflowRecipeInstance = async ({
  recipe,
  nodeId,
  inputs,
  capabilityExecutors,
  constants = {},
  context = {},
  now = Date.now(),
}: ExecuteWorkflowRecipeInstanceInput): Promise<ExecuteWorkflowRecipeInstanceResult> => {
  const validation = validateWorkflowRecipeDefinition(recipe);
  const logs: WorkflowRecipeExecutionLog[] = [
    {
      level: 'info',
      message: `Starting recipe ${recipe.recipeId}@${recipe.version}`,
      timestamp: now,
    },
  ];

  const stepStates = createStepStates(recipe);
  const trace: WorkflowNodeRuntimeTrace = {
    runId: `${nodeId}:${now}`,
    recipeId: recipe.recipeId,
    recipeVersion: recipe.version,
    startedAt: now,
    status: 'running',
    stepStates,
    logs: logs.map((item) => item.message),
  };

  const nodeInstance: WorkflowNodeInstance = {
    nodeId,
    recipeId: recipe.recipeId,
    recipeVersion: recipe.version,
    title: recipe.title,
    summary: recipe.summary,
    status: 'running',
    inputValues: { ...inputs },
    outputValues: {},
    stepStates,
    lastRunId: trace.runId,
    lastRunAt: now,
    trace,
  };

  if (!validation.valid) {
    const error = buildError(
      'schema_invalid',
      'Workflow recipe validation failed before execution.',
      undefined,
      validation.issues,
    );
    nodeInstance.status = 'failed';
    nodeInstance.lastErrorCode = error.code;
    nodeInstance.lastErrorMessage = error.message;
    trace.status = 'failed';
    trace.completedAt = now;
    logs.push({
      level: 'error',
      message: error.message,
      timestamp: now,
    });
    trace.logs = logs.map((item) => item.message);
    return {
      status: 'failed',
      outputs: {},
      nodeInstance,
      trace,
      logs,
      error,
    };
  }

  const stepOutputs: Record<string, Record<string, unknown>> = {};

  for (const [index, step] of recipe.steps.entries()) {
    const stepState = stepStates[index];
    stepState.startedAt = now;

    if (step.type !== 'capability') {
      stepState.status = 'skipped';
      stepState.completedAt = now;
      logs.push({
        level: 'info',
        message: `Step ${step.stepId} is ${step.type} and remains scaffolded in Phase 2.`,
        timestamp: now,
        stepId: step.stepId,
      });
      continue;
    }

    const capability = findRecipeCapability(step.capabilityRef || '');
    if (!capability) {
      const error = buildError(
        'capability_missing',
        `Capability binding not found: ${step.capabilityRef}`,
        step.stepId,
      );
      stepState.status = 'failed';
      stepState.completedAt = now;
      stepState.errorCode = error.code;
      stepState.errorMessage = error.message;
      nodeInstance.status = 'failed';
      nodeInstance.lastErrorCode = error.code;
      nodeInstance.lastErrorMessage = error.message;
      trace.status = 'failed';
      trace.completedAt = now;
      logs.push({
        level: 'error',
        message: error.message,
        timestamp: now,
        stepId: step.stepId,
      });
      trace.logs = logs.map((item) => item.message);
      return {
        status: 'failed',
        outputs: {},
        nodeInstance,
        trace,
        logs,
        error,
      };
    }

    try {
      const mappedInput = buildStepInput({
        mapping: step.inputMapping,
        inputs,
        constants,
        context,
        stepOutputs,
      });
      stepState.inputSnapshot = mappedInput;
      stepState.status = 'running';

      const normalizedResult = await executeCapabilityBinding({
        capabilityId: capability.id,
        executorRef: capability.executorRef,
        kind: capability.kind,
        input: mappedInput,
        capabilityExecutors,
      });

      stepOutputs[step.stepId] = normalizedResult;
      stepState.outputSnapshot = normalizedResult;
      stepState.status = capability.kind === 'internal-service' ? 'skipped' : 'success';
      stepState.completedAt = now;

      Object.entries(step.outputMapping || {}).forEach(([resultKey, outputPath]) => {
        assignMappedOutput({
          path: outputPath,
          value: normalizedResult[resultKey],
          stepOutputs,
          nodeOutputs: nodeInstance.outputValues,
        });
      });

      logs.push({
        level: 'info',
        message:
          capability.kind === 'internal-service'
            ? `Step ${step.stepId} remains scaffolded because ${capability.id} is not bound yet.`
            : `Step ${step.stepId} executed via ${capability.executorRef}.`,
        timestamp: now,
        stepId: step.stepId,
      });
    } catch (error) {
      const runtimeError = buildError(
        'execution_failed',
        error instanceof Error ? error.message : String(error),
        step.stepId,
        error,
      );
      stepState.status = 'failed';
      stepState.completedAt = now;
      stepState.errorCode = runtimeError.code;
      stepState.errorMessage = runtimeError.message;
      nodeInstance.status = 'failed';
      nodeInstance.lastErrorCode = runtimeError.code;
      nodeInstance.lastErrorMessage = runtimeError.message;
      trace.status = 'failed';
      trace.completedAt = now;
      logs.push({
        level: 'error',
        message: runtimeError.message,
        timestamp: now,
        stepId: step.stepId,
      });
      trace.logs = logs.map((item) => item.message);
      return {
        status: 'failed',
        outputs: nodeInstance.outputValues,
        nodeInstance,
        trace,
        logs,
        error: runtimeError,
      };
    }
  }

  const outputs = Object.fromEntries(
    recipe.outputs.map((output) => [output.id, nodeInstance.outputValues[output.id] ?? null]),
  );

  nodeInstance.outputValues = outputs;
  nodeInstance.status = 'success';
  trace.status = 'success';
  trace.completedAt = now;
  trace.logs = logs.map((item) => item.message);

  return {
    status: 'success',
    outputs,
    nodeInstance,
    trace,
    logs,
  };
};
