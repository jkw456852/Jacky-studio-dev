import React from 'react';
import type { WorkflowRecipeLifecycleRuntimeSummary } from './recipeLifecycle.types.ts';

export interface RecipeRuntimeInspectorProps {
  summary: WorkflowRecipeLifecycleRuntimeSummary;
}

export const RecipeRuntimeInspector: React.FC<RecipeRuntimeInspectorProps> = ({ summary }) => {
  const logs = summary.logs || summary.smokeTestReport?.logs || [];
  const dependencyChecks = summary.importReport?.compatibilityGate.dependencyChecks || [];
  const nodeInstance = summary.nodeInstance;

  return (
    <aside className="grid gap-4">
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h4 className="text-sm font-semibold text-gray-900">运行摘要</h4>
        <dl className="mt-3 grid gap-2 text-sm text-gray-700">
          <div className="flex items-center justify-between gap-3">
            <dt>recipeId</dt>
            <dd className="min-w-0 break-all text-right font-medium text-gray-900">
              {summary.recipe?.recipeId || '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt>版本</dt>
            <dd className="font-medium text-gray-900">{summary.recipe?.version || '—'}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt>导入状态</dt>
            <dd className="font-medium text-gray-900">
              {summary.importReport?.compatibilityGate.status || '未导入'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt>测试状态</dt>
            <dd className="font-medium text-gray-900">{summary.testingRecord?.status || '未运行'}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt>节点运行态</dt>
            <dd className="font-medium text-gray-900">{nodeInstance?.status || '未实例化'}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt>发布状态</dt>
            <dd className="font-medium text-gray-900">{summary.publishRecord?.status || '未发布'}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt>canvasNodeId</dt>
            <dd className="min-w-0 break-all text-right font-medium text-gray-900">
              {summary.canvasNodeId || '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt>canvasElementId</dt>
            <dd className="min-w-0 break-all text-right font-medium text-gray-900">
              {summary.canvasElementId || '—'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h4 className="text-sm font-semibold text-gray-900">依赖摘要</h4>
        <div className="mt-3 grid gap-2">
          {dependencyChecks.length ? (
            dependencyChecks.map((item) => (
              <div
                key={item.capabilityId}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
              >
                <div className="break-all text-sm font-medium text-gray-900">{item.capabilityId}</div>
                <div className="mt-1 text-xs text-gray-500">
                  {item.available ? '可用' : '不可用'}
                  {item.reason ? ` · ${item.reason}` : ''}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-500">
              导入后将在这里显示 capability 依赖摘要。
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h4 className="text-sm font-semibold text-gray-900">最近日志</h4>
        <div className="mt-3 grid gap-2">
          {logs.length ? (
            logs.slice(0, 6).map((item, index) => (
              <div
                key={`${item.timestamp}:${index}`}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
                  <span>{item.level}</span>
                  <span>{item.timestamp}</span>
                </div>
                <div className="mt-1 break-words text-sm text-gray-900">{item.message}</div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-500">
              执行后将在这里显示统一运行日志摘要。
            </div>
          )}
        </div>
      </section>
    </aside>
  );
};
