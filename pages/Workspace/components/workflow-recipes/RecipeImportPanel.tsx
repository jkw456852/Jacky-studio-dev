import React from 'react';
import type { WorkflowRecipeLifecyclePanelProps } from './recipeLifecycle.types.ts';

type RecipeImportPanelProps = Pick<
  WorkflowRecipeLifecyclePanelProps,
  'summary' | 'importDraft' | 'busy' | 'onImportDraftChange' | 'onImportRecipe'
>;

const renderIssueTone = (count: number): string => {
  if (count === 0) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  return 'text-amber-700 bg-amber-50 border-amber-200';
};

export const RecipeImportPanel: React.FC<RecipeImportPanelProps> = ({
  summary,
  importDraft,
  busy = false,
  onImportDraftChange,
  onImportRecipe,
}) => {
  const report = summary.importReport;
  const issueCount = report?.validationIssues.length || 0;
  const dependencyChecks = report?.compatibilityGate.dependencyChecks || [];

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900">导入 recipe 包</h3>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              粘贴或准备 workflow recipe 分享包 JSON，先进入统一导入校验，再决定是否进入测试区。
            </p>
          </div>
          <button
            type="button"
            onClick={() => onImportRecipe?.()}
            disabled={busy || !importDraft.rawJson.trim()}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
          >
            {busy ? '导入中…' : '执行导入'}
          </button>
        </div>

        <div className="mt-4 grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-gray-800">Recipe JSON</label>
            <textarea
              value={importDraft.rawJson}
              onChange={(event) =>
                onImportDraftChange({
                  ...importDraft,
                  rawJson: event.target.value,
                })
              }
              placeholder="粘贴 workflow-recipe 分享包 JSON"
              className="min-h-[240px] w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm leading-6 text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:bg-white"
            />
          </div>

          <div className="grid gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-gray-800">当前文件：</span>
              <span className="min-w-0 break-all text-gray-600">
                {importDraft.fileName?.trim() || '未选择文件，当前为粘贴模式'}
              </span>
            </div>
            <p className="text-xs leading-5 text-gray-500">
              本阶段仅提供导入骨架，不在页面层直接解析 recipe 内部执行逻辑。
            </p>
          </div>
        </div>
      </section>

      <aside className="grid gap-4">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-gray-900">导入报告摘要</h4>
          <div className="mt-3 grid gap-3 text-sm">
            <div
              className={[
                'rounded-lg border px-3 py-2',
                renderIssueTone(issueCount),
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-3">
                <span>Schema 校验</span>
                <span className="font-medium">{report?.valid ? '通过' : '待校验'}</span>
              </div>
              <div className="mt-1 text-xs opacity-80">问题数：{issueCount}</div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700">
              <div className="flex items-center justify-between gap-3">
                <span>兼容闸门</span>
                <span className="font-medium">{report?.compatibilityGate.status || '未生成'}</span>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                测试区：{report?.canEnterTesting ? '允许' : '未开放'} · 发布：
                {report?.canPublish ? '允许' : '未开放'}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-gray-900">依赖能力</h4>
          <div className="mt-3 grid gap-2">
            {dependencyChecks.length > 0 ? (
              dependencyChecks.map((item) => (
                <div
                  key={item.capabilityId}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                >
                  <div className="break-all text-sm font-medium text-gray-800">
                    {item.capabilityId}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {item.available ? '已注册' : '未注册'}
                    {item.reason ? ` · ${item.reason}` : ''}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-500">
                导入后将在这里显示 capability 依赖清单。
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-gray-900">校验问题</h4>
          <div className="mt-3 grid gap-2">
            {report?.validationIssues.length ? (
              report.validationIssues.map((issue, index) => (
                <div
                  key={`${issue.path}:${index}`}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                >
                  <div className="text-xs font-medium uppercase tracking-wide text-amber-700">
                    {issue.code}
                  </div>
                  <div className="mt-1 break-words text-sm text-amber-900">{issue.message}</div>
                  <div className="mt-1 break-all text-xs text-amber-700/80">{issue.path}</div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-500">
                当前还没有校验问题，导入执行后会在这里展示详细结果。
              </div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
};
