import React from 'react';
import { RecipeImportPanel } from './RecipeImportPanel.tsx';
import { RecipeLibraryPanel } from './RecipeLibraryPanel.tsx';
import { RecipeRuntimeInspector } from './RecipeRuntimeInspector.tsx';
import { RecipeTestPanel } from './RecipeTestPanel.tsx';
import type {
  WorkflowRecipeLifecyclePanelProps,
  WorkflowRecipeLifecycleTab,
} from './recipeLifecycle.types.ts';

const TAB_LABELS: Record<WorkflowRecipeLifecycleTab, string> = {
  import: '导入',
  testing: '测试区',
  library: '发布库',
};

export const RecipeLifecyclePanel: React.FC<WorkflowRecipeLifecyclePanelProps> = ({
  activeTab,
  onTabChange,
  summary,
  importDraft,
  testDraft,
  busy = false,
  onImportDraftChange,
  onTestDraftChange,
  onImportRecipe,
  onRunSmokeTest,
  onPublishRecipe,
  onRollbackRecipe,
  onInsertToCanvas,
}) => {
  return (
    <div className="flex h-full min-h-0 flex-col bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-4 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-gray-900">Workflow Recipe Lifecycle</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              统一承载导入、测试、发布与回滚骨架，避免 recipe 生命周期分散实现。
            </p>
          </div>
          <div className="grid gap-2 text-sm text-gray-600 lg:text-right">
            <div className="min-w-0 break-all">
              recipeId：<span className="font-medium text-gray-900">{summary.recipe?.recipeId || '未加载'}</span>
            </div>
            <div>
              version：<span className="font-medium text-gray-900">{summary.recipe?.version || '—'}</span>
            </div>
            <div>
              状态：
              <span className="font-medium text-gray-900">
                {summary.publishRecord?.status || summary.testingRecord?.status || 'idle'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(TAB_LABELS) as WorkflowRecipeLifecycleTab[]).map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onTabChange(tab)}
                className={[
                  'inline-flex h-9 items-center justify-center rounded-lg border px-4 text-sm font-medium transition',
                  active
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                ].join(' ')}
              >
                {TAB_LABELS[tab]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="min-h-0 pr-1">
          {activeTab === 'import' ? (
            <RecipeImportPanel
              summary={summary}
              importDraft={importDraft}
              busy={busy}
              onImportDraftChange={onImportDraftChange}
              onImportRecipe={onImportRecipe}
            />
          ) : null}

          {activeTab === 'testing' ? (
            <RecipeTestPanel
              summary={summary}
              testDraft={testDraft}
              busy={busy}
              onTestDraftChange={onTestDraftChange}
              onRunSmokeTest={onRunSmokeTest}
            />
          ) : null}

          {activeTab === 'library' ? (
            <RecipeLibraryPanel
              summary={summary}
              busy={busy}
              onPublishRecipe={onPublishRecipe}
              onRollbackRecipe={onRollbackRecipe}
              onInsertToCanvas={onInsertToCanvas}
            />
          ) : null}
        </div>

        <div className="min-h-0">
          <RecipeRuntimeInspector summary={summary} />
        </div>
      </div>
    </div>
  );
};
