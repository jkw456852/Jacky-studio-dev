import type { WorkflowRecipeExecutionLog } from '../../../../types/capability-catalog.types.ts';
import type { WorkflowNodeInstance } from '../../../../types/workflow-node.types.ts';
import type { WorkflowRecipeDefinition } from '../../../../types/workflow-recipe.types.ts';
import type {
  WorkflowRecipeImportReport,
  WorkflowRecipePublishRecord,
  WorkflowRecipeTestingRecord,
} from '../../../../services/workflow-recipes/importer.ts';
import type { WorkflowRecipeSmokeTestReport } from '../../../../services/workflow-recipes/testing.ts';

export type WorkflowRecipeLifecycleTab = 'import' | 'testing' | 'library';

export interface WorkflowRecipeLifecycleRuntimeSummary {
  recipe?: WorkflowRecipeDefinition | null;
  importReport?: WorkflowRecipeImportReport | null;
  testingRecord?: WorkflowRecipeTestingRecord | null;
  smokeTestReport?: WorkflowRecipeSmokeTestReport | null;
  publishRecord?: WorkflowRecipePublishRecord | null;
  nodeInstance?: WorkflowNodeInstance | null;
  canvasNodeId?: string | null;
  canvasElementId?: string | null;
  logs?: WorkflowRecipeExecutionLog[];
}

export interface WorkflowRecipeImportDraft {
  rawJson: string;
  fileName?: string;
}

export interface WorkflowRecipeTestDraft {
  inputJson: string;
  constantsJson: string;
  contextJson: string;
}

export interface WorkflowRecipeLifecyclePanelProps {
  activeTab: WorkflowRecipeLifecycleTab;
  onTabChange: (tab: WorkflowRecipeLifecycleTab) => void;
  summary: WorkflowRecipeLifecycleRuntimeSummary;
  importDraft: WorkflowRecipeImportDraft;
  testDraft: WorkflowRecipeTestDraft;
  busy?: boolean;
  onImportDraftChange: (draft: WorkflowRecipeImportDraft) => void;
  onTestDraftChange: (draft: WorkflowRecipeTestDraft) => void;
  onImportRecipe?: () => void | Promise<void>;
  onRunSmokeTest?: () => void | Promise<void>;
  onPublishRecipe?: () => void | Promise<void>;
  onRollbackRecipe?: (targetVersion: string) => void | Promise<void>;
  onInsertToCanvas?: () => void | Promise<void>;
}
