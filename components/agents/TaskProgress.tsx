import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Clock,
  Square,
} from 'lucide-react';
import type { ChatMessage } from '../../types';
import type { AgentTask } from '../../types/agent.types';
import { deriveThinkingSummary } from '../../pages/Workspace/components/AgentMessage.helpers';

type TaskProgressTrace = NonNullable<
  NonNullable<ChatMessage['agentData']>['executionTrace']
>;

interface TaskProgressProps {
  task?: AgentTask | null;
  trace?: TaskProgressTrace;
  className?: string;
}

const STEP_ICONS: Array<{ keyword: string; icon: React.ReactNode }> = [
  { keyword: '分析', icon: '·' },
  { keyword: '路由', icon: '·' },
  { keyword: '规划', icon: '·' },
  { keyword: '执行', icon: '·' },
  { keyword: '生成', icon: '·' },
  { keyword: '图片', icon: '·' },
  { keyword: '上传', icon: '·' },
  { keyword: '完成', icon: '·' },
  { keyword: '搜索', icon: '·' },
  { keyword: '优化', icon: '·' },
  { keyword: '同步', icon: '·' },
  { keyword: '停止', icon: <Square size={8} className="fill-current" /> },
];

const getStepIcon = (message: string): React.ReactNode => {
  const matched = STEP_ICONS.find((item) => message.includes(item.keyword));
  return matched?.icon || '·';
};

export const TaskProgress: React.FC<TaskProgressProps> = ({
  task,
  trace,
  className = '',
}) => {
  const [expanded, setExpanded] = useState(false);
  const [seconds, setSeconds] = React.useState(0);

  const status = task?.status || trace?.status || 'completed';
  const progressStep = task?.progressStep || trace?.progressStep || 1;
  const totalSteps = task?.totalSteps || trace?.totalSteps || 4;
  const progressMessage =
    task?.progressMessage ||
    trace?.progressMessage ||
    (status === 'analyzing' ? '正在分析需求...' : '正在继续处理...');
  const progressLog = task?.progressLog || trace?.progressLog || [];
  const reasoningSummary = deriveThinkingSummary(
    String(task?.reasoningText || trace?.reasoningText || '').trim(),
    progressMessage,
  );
  const errorCode = trace?.errorCode || '';
  const errorMessage = trace?.errorMessage || '';
  const stopReasonLabel = trace?.stopReasonLabel || '';

  React.useEffect(() => {
    if (status === 'executing' || status === 'analyzing') {
      setSeconds(0);
      const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
      return () => clearInterval(timer);
    }

    setSeconds(0);
    return undefined;
  }, [status]);

  const isRunning = status === 'analyzing' || status === 'executing';
  const isDone = status === 'completed' || status === 'failed';
  const isCancelled =
    errorCode === 'USER_CANCELLED' || stopReasonLabel === 'need-user-input';

  if (!isRunning && !(isDone && progressLog.length > 0)) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`w-full max-w-[420px] ${className}`.trim()}
    >
      {isRunning ? (
        <div className="rounded-2xl border border-sky-100 bg-[#f4f9ff] px-3.5 py-3 shadow-sm">
          <div className="mb-2.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sky-100">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500"
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.min(
                    100,
                    Math.max(0, (progressStep / Math.max(totalSteps, 1)) * 100),
                  )}%`,
                }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <span className="shrink-0 font-mono text-[10px] text-slate-400">
              {progressStep}/{totalSteps}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900">
              <Sparkles size={11} className="text-white" />
            </div>
            <AnimatePresence mode="wait">
              <motion.span
                key={progressMessage}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 5 }}
                transition={{ duration: 0.2 }}
                className="flex-1 text-[12px] font-medium text-slate-700"
              >
                {progressMessage}
                {seconds > 0 ? ` · ${seconds}s` : ''}
              </motion.span>
            </AnimatePresence>
            <Loader2 size={12} className="shrink-0 animate-spin text-sky-500" />
          </div>
          {reasoningSummary && reasoningSummary !== progressMessage ? (
            <div className="mt-3 rounded-2xl border border-sky-100/80 bg-white/85 px-3 py-2.5">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-600">
                Thinking
              </div>
              <div className="whitespace-pre-wrap text-[11px] leading-5 text-slate-600">
                {reasoningSummary}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {progressLog.length > 0 ? (
        <div className={isRunning ? 'mt-2' : ''}>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="group flex items-center gap-1.5 py-1 text-[11px] text-slate-400 transition-colors hover:text-slate-600"
          >
            {isDone ? (
              status === 'completed' ? (
                isCancelled ? (
                  <Clock size={11} className="text-slate-400" />
                ) : (
                  <CheckCircle2 size={11} className="text-emerald-500" />
                )
              ) : (
                <XCircle size={11} className="text-red-400" />
              )
            ) : (
              <Clock size={11} className="text-sky-500" />
            )}
            <span className="underline-offset-2 group-hover:underline">
              {expanded ? '收起' : '查看'}执行记录
            </span>
            <span className="text-slate-300">({progressLog.length} 条)</span>
            {expanded ? (
              <ChevronUp size={10} className="text-slate-400" />
            ) : (
              <ChevronDown size={10} className="text-slate-400" />
            )}
          </button>

          <AnimatePresence initial={false}>
            {expanded ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="ml-1 space-y-1.5 border-l-2 border-slate-100 pl-3 pb-2 pt-1">
                  {progressLog.map((message, index) => (
                    <motion.div
                      key={`${message}-${index}`}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="flex items-start gap-2"
                    >
                      <span className="mt-0.5 shrink-0 text-[11px] leading-none text-slate-400">
                        {getStepIcon(message)}
                      </span>
                      <span
                        className={`text-[11px] leading-relaxed ${
                          index === progressLog.length - 1 && isRunning
                            ? 'font-medium text-slate-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {message}
                      </span>
                    </motion.div>
                  ))}

                  {!isRunning && errorMessage ? (
                    <div
                      className={`rounded-lg px-2.5 py-2 text-[11px] leading-relaxed ${
                        isCancelled
                          ? 'border border-slate-200 bg-slate-50 text-slate-500'
                          : 'border border-red-100 bg-red-50 text-red-600'
                      }`}
                    >
                      {errorMessage}
                    </div>
                  ) : null}

                  {isRunning ? (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="h-1 w-1 animate-pulse rounded-full bg-sky-500" />
                      <span
                        className="h-1 w-1 animate-pulse rounded-full bg-sky-500"
                        style={{ animationDelay: '0.2s' }}
                      />
                      <span
                        className="h-1 w-1 animate-pulse rounded-full bg-sky-500"
                        style={{ animationDelay: '0.4s' }}
                      />
                    </div>
                  ) : null}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
    </motion.div>
  );
};
