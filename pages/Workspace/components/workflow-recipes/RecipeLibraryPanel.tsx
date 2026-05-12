import React from 'react';
import type { WorkflowRecipeLifecyclePanelProps } from './recipeLifecycle.types.ts';

type RecipeLibraryPanelProps = Pick<
  WorkflowRecipeLifecyclePanelProps,
  'summary' | 'busy' | 'onPublishRecipe' | 'onRollbackRecipe' | 'onInsertToCanvas'
>;

export const RecipeLibraryPanel: React.FC<RecipeLibraryPanelProps> = ({
  summary,
  busy = false,
  onPublishRecipe,
  onRollbackRecipe,
  onInsertToCanvas,
}) => {
  const publishRecord = summary.publishRecord;
  const publishHistory = publishRecord?.publishHistory || [];
  const rollbackHistory = publishRecord?.rollbackHistory || [];
  const importReport = summary.importReport;

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900">发布区 / 节点库</h3>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              只有通过统一导入校验与 smoke test 的 recipe 才能进入发布区，并保留统一的发布与回滚记录。
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onPublishRecipe?.()}
              disabled={busy || !importReport?.canPublish}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
            >
              {busy ? '发布中…' : '发布 recipe'}
            </button>
            <button
              type="button"
              onClick={() => onInsertToCanvas?.()}
              disabled={busy || !publishRecord}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-gray-900 bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
            >
              {busy ? '处理中…' : '放入画板'}
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h4 className="text-sm font-semibold text-gray-900">发布门槛</h4>
            <dl className="mt-3 grid gap-2 text-sm text-gray-700">
              <div className="flex items-center justify-between gap-3">
                <dt>导入校验</dt>
                <dd className="font-medium text-gray-900">{importReport?.valid ? '通过' : '未通过'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>兼容闸门</dt>
                <dd className="font-medium text-gray-900">
                  {importReport?.compatibilityGate.status || '未生成'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>测试结果</dt>
                <dd className="font-medium text-gray-900">
                  {summary.testingRecord?.status || '未运行'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>允许发布</dt>
                <dd className="font-medium text-gray-900">{importReport?.canPublish ? '是' : '否'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h4 className="text-sm font-semibold text-gray-900">当前发布状态</h4>
            <dl className="mt-3 grid gap-2 text-sm text-gray-700">
              <div className="flex items-center justify-between gap-3">
                <dt>recipeId</dt>
                <dd className="min-w-0 break-all text-right font-medium text-gray-900">
                  {publishRecord?.recipeId || summary.recipe?.recipeId || '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>version</dt>
                <dd className="font-medium text-gray-900">{publishRecord?.version || '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>status</dt>
                <dd className="font-medium text-gray-900">{publishRecord?.status || 'testing'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>publishedAt</dt>
                <dd className="font-medium text-gray-900">{publishRecord?.publishedAt ?? '—'}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-gray-900">发布历史</h4>
              <span className="text-xs text-gray-500">{publishHistory.length} 条</span>
            </div>
            <div className="mt-3 grid gap-2">
              {publishHistory.length ? (
                publishHistory.map((item, index) => (
                  <div
                    key={`${item.version}:${item.publishedAt}:${index}`}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-gray-900">{item.version}</div>
                      <div className="text-xs text-gray-500">{item.publishedAt}</div>
                    </div>
                    <div className="mt-1 break-words text-sm text-gray-600">{item.summary}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-500">
                  发布后将在这里显示统一 publish history。
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-gray-900">回滚历史</h4>
              <button
                type="button"
                onClick={() => onRollbackRecipe?.('previous')}
                disabled={busy || publishHistory.length === 0}
                className="inline-flex h-8 items-center justify-center rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
              >
                触发回滚骨架
              </button>
            </div>
            <div className="mt-3 grid gap-2">
              {rollbackHistory.length ? (
                rollbackHistory.map((item, index) => (
                  <div
                    key={`${item.fromVersion}:${item.toVersion}:${item.rolledBackAt}:${index}`}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-gray-900">
                        {item.fromVersion} → {item.toVersion}
                      </div>
                      <div className="text-xs text-gray-500">{item.rolledBackAt}</div>
                    </div>
                    <div className="mt-1 break-words text-sm text-gray-600">{item.reason}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-500">
                  发生回滚后将在这里展示统一 rollback history。
                </div>
              )}
            </div>
          </section>
        </div>
      </section>

      <aside className="grid gap-4">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-gray-900">发布摘要</h4>
          <div className="mt-3 grid gap-2 text-sm text-gray-700">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-xs text-gray-500">标题</div>
              <div className="mt-1 break-words text-sm text-gray-900">
                {summary.recipe?.title || publishRecord?.title || '未加载'}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-xs text-gray-500">摘要</div>
              <div className="mt-1 break-words text-sm text-gray-900">
                {summary.recipe?.summary || publishRecord?.summary || '暂无'}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-xs text-gray-500">标签</div>
              <div className="mt-1 break-words text-sm text-gray-900">
                {(summary.recipe?.tags || publishRecord?.tags || []).join(' / ') || '暂无'}
              </div>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
};
