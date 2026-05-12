export type CapabilityDomain =
  | 'asset'
  | 'vision'
  | 'research'
  | 'planning'
  | 'image'
  | 'fashion'
  | 'commerce'
  | 'video'
  | 'copy'
  | 'workflow'
  | 'canvas'
  | 'package'
  | 'governance'
  | 'trace';

export type CapabilityKind =
  | 'skill'
  | 'browser-tool'
  | 'workflow-adapter'
  | 'internal-service';

export type CapabilityRuntimeAvailability =
  | 'stable'
  | 'conditional'
  | 'testing'
  | 'deprecated';

export interface CapabilityIoSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface RecipeCapabilityDefinition {
  id: string;
  label: string;
  domain: CapabilityDomain;
  kind: CapabilityKind;
  summary: string;
  inputSchema: CapabilityIoSchema;
  outputSchema: CapabilityIoSchema;
  safeForRecipe: boolean;
  runtimeAvailability: CapabilityRuntimeAvailability;
  executorRef: string;
  tags: string[];
  deprecated?: boolean;
  replacedBy?: string;
}

export interface WorkflowRecipeRuntimeError {
  code:
    | 'schema_invalid'
    | 'capability_missing'
    | 'input_invalid'
    | 'execution_failed'
    | 'output_invalid'
    | 'publish_blocked';
  message: string;
  detail?: unknown;
  stepId?: string;
}

export interface WorkflowRecipeExecutionLog {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
  stepId?: string;
}
