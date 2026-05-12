export type WorkflowRecipeSchemaVersion = 1;

export type WorkflowRecipeCategory =
  | 'visual-edit'
  | 'visual-generate'
  | 'analysis'
  | 'workflow'
  | 'other';

export type WorkflowRecipeStatus =
  | 'draft'
  | 'testing'
  | 'published'
  | 'archived';

export type WorkflowRecipeDataType =
  | 'image'
  | 'image_list'
  | 'text'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'json';

export type WorkflowRecipeFieldScope =
  | 'input'
  | 'step-output'
  | 'context'
  | 'constant';

export type WorkflowRecipeVisibility = 'user' | 'system' | 'hidden';

export type WorkflowRecipeStepType =
  | 'capability'
  | 'transform'
  | 'condition'
  | 'output';

export type WorkflowRecipeStepStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'skipped';

export type WorkflowRecipeNodeStatus =
  | 'idle'
  | 'configured'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled';

export type WorkflowRecipeOnErrorPolicy = 'stop' | 'skip' | 'fallback';

export type WorkflowRecipeConditionOperator =
  | 'exists'
  | 'not_exists'
  | 'equals'
  | 'not_equals'
  | 'in'
  | 'not_in';

export interface WorkflowRecipeFieldOption {
  value: string;
  label: string;
  description?: string;
}

export interface WorkflowRecipeFieldValidation {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface WorkflowRecipeInputField {
  id: string;
  label: string;
  description: string;
  dataType: WorkflowRecipeDataType;
  visibility?: WorkflowRecipeVisibility;
  validation?: WorkflowRecipeFieldValidation;
  defaultValue?: unknown;
  options?: WorkflowRecipeFieldOption[];
  allowMultiple?: boolean;
  placeholder?: string;
}

export interface WorkflowRecipeOutputField {
  id: string;
  label: string;
  description: string;
  dataType: WorkflowRecipeDataType;
  required?: boolean;
}

export interface WorkflowRecipeValueReference {
  path: string;
  scope: WorkflowRecipeFieldScope;
}

export interface WorkflowRecipeConditionClause {
  left: WorkflowRecipeValueReference;
  operator: WorkflowRecipeConditionOperator;
  right?: unknown;
}

export interface WorkflowRecipeConditionGroup {
  mode: 'all' | 'any';
  clauses: WorkflowRecipeConditionClause[];
}

export interface WorkflowRecipeUiSection {
  id: string;
  title: string;
  description?: string;
  fieldIds: string[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export interface WorkflowRecipeUiSchema {
  icon?: string;
  accentColor?: string;
  sections: WorkflowRecipeUiSection[];
  resultPanelTitle?: string;
  showDebugTrace?: boolean;
}

export interface WorkflowRecipeConstraintSet {
  allowedCapabilityIds: string[];
  maxStepCount?: number;
  allowPublish?: boolean;
  allowSharing?: boolean;
  requiresSmokeTest?: boolean;
}

export interface WorkflowRecipeDependencySummary {
  capabilityIds: string[];
  minimumPlatformVersion?: string;
}

export interface WorkflowRecipeShareMeta {
  author: string;
  summary: string;
  tags: string[];
  compatibilityVersion: number;
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowRecipeStep {
  stepId: string;
  type: WorkflowRecipeStepType;
  title: string;
  description?: string;
  capabilityRef?: string;
  inputMapping?: Record<string, string>;
  outputMapping?: Record<string, string>;
  runWhen?: WorkflowRecipeConditionGroup;
  onError?: WorkflowRecipeOnErrorPolicy;
  fallbackStepId?: string;
}

export interface WorkflowRecipeDefinition {
  schemaVersion: WorkflowRecipeSchemaVersion;
  recipeId: string;
  version: string;
  title: string;
  summary: string;
  category: WorkflowRecipeCategory;
  tags: string[];
  status: WorkflowRecipeStatus;
  inputs: WorkflowRecipeInputField[];
  outputs: WorkflowRecipeOutputField[];
  steps: WorkflowRecipeStep[];
  ui: WorkflowRecipeUiSchema;
  constraints: WorkflowRecipeConstraintSet;
  dependencies: WorkflowRecipeDependencySummary;
  sharing: WorkflowRecipeShareMeta;
}

export interface WorkflowRecipeValidationIssue {
  code:
    | 'missing_field'
    | 'duplicate_id'
    | 'invalid_type'
    | 'invalid_reference'
    | 'invalid_condition'
    | 'capability_not_allowed'
    | 'step_limit_exceeded';
  message: string;
  path: string;
}

export interface WorkflowRecipeValidationResult {
  valid: boolean;
  issues: WorkflowRecipeValidationIssue[];
}
