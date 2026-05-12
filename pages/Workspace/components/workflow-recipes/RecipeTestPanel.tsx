import React from 'react';
import type { WorkflowRecipeLifecyclePanelProps } from './recipeLifecycle.types.ts';

type RecipeTestPanelProps = Pick<
  WorkflowRecipeLifecyclePanelProps,
  'summary' | 'testDraft' | 'busy' | 'onTestDraftChange' | 'onRunSmokeTest'
>;

export const RecipeTestPanel: React.FC<RecipeTestPanelProps> = ({
  summary,
  testDraft,
  busy = false,
  onTestDraftChange,
  onRunSmokeTest,
}) => {
  const smokeTestReport = summary.smokeTestReport;
  const testingRecord = summary.testingRecord;

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900">测试区</h3>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              在统一测试区填写 sample input，运行 smoke test，并查看输出结构、错误码和日志。
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRunSmokeTest?.()}
            disabled={busy}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
          >
            {busy ? '测试中…' : '运行 smoke test'}
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-gray-800">输入参数</label>
            <textarea
              value={testDraft.inputJson}
              onChange={(event) =>
                onTestDraftChange({
                  ...testDraft,
                  inputJson: event.target.value,
                })
              }
              placeholder='例如：{"garmentImage":"asset://garment.png"}'
              className="min-h-[180px] w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm leading-6 text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:bg-white"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-gray-800">常量</label>
            <textarea
              value={testDraft.constantsJson}
              onChange={(event) =>
                onTestDraftChange({
                  ...testDraft,
                  constantsJson: event.target.value,
                })
              }
              placeholder='例如：{"defaultPrompt":"make a try-on image"}'
              className="min-h-[180px] w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm leading-6 text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:bg-white"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-gray-800">上下文</label>
            <textarea
              value={testDraft.contextJson}
              onChange={(event) =>
                onTestDraftChange({
                  ...testDraft,
                  contextJson: event.target.value,
                })
              }
              placeholder='例如：{"requestId":"demo-smoke-run"}'
              className="min-h-[180px] w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm leading-6 text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:bg-white"
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h4 className="text-sm font-semibold text-gray-900">测试结果摘要</h4>
            <dl className="mt-3 grid gap-2 text-sm text-gray-700">
              <div className="flex items-center justify-between gap-3">
                <dt>当前状态</dt>
                <dd className="font-medium text-gray-900">{testingRecord?.status || 'idle'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Schema</dt>
                <dd className="font-medium text-gray-900">
                  {smokeTestReport ? (smokeTestReport.schemaPassed ? '通过' : '失败') : '未运行'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Dry-run</dt>
                <dd className="font-medium text-gray-900">
                  {smokeTestReport ? (smokeTestReport.dryRunPassed ? '通过' : '失败') : '未运行'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Smoke run</dt>
                <dd className="font-medium text-gray-900">
                  {smokeTestReport ? (smokeTestReport.smokeRunPassed ? '通过' : '失败') : '未运行'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h4 className="text-sm font-semibold text-gray-900">错误与输出</h4>
            <div className="mt-3 grid gap-2 text-sm text-gray-700">
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                <div className="text-xs text-gray-500">错误码</div>
                <div className="mt-1 break-all text-sm text-gray-900">
                  {smokeTestReport?.errorCode || '—'}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                <div className="text-xs text-gray-500">输出字段</div>
                <div className="mt-1 break-words text-sm text-gray-900">
                  {smokeTestReport?.outputKeys.length
                    ? smokeTestReport.outputKeys.join(' / ')
                    : '未产生输出'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside className="grid gap-4">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-gray-900">最近测试记录</h4>
          <div className="mt-3 grid gap-2 text-sm text-gray-700">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-xs text-gray-500">lastRunAt</div>
              <div className="mt-1 text-sm text-gray-900">{testingRecord?.lastRunAt ?? '—'}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-xs text-gray-500">lastPassedAt</div>
              <div className="mt-1 text-sm text-gray-900">{testingRecord?.lastPassedAt ?? '—'}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-xs text-gray-500">错误信息</div>
              <div className="mt-1 break-words text-sm text-gray-900">
                {testingRecord?.lastErrorMessage || '暂无'}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-gray-900">执行日志</h4>
          <div className="mt-3 grid gap-2">
            {smokeTestReport?.logs.length ? (
              smokeTestReport.logs.map((item, index) => (
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
                运行后将在这里显示统一执行日志。
              </div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
};
