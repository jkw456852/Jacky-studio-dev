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
} from 'lucide-react';
import { AgentTask } from '../../types/agent.types';

interface TaskProgressProps {
  task: AgentTask;
}

const STEP_ICONS: Record<string, string> = {
  分析: '🔎',
  路由: '🧭',
  规划: '📝',
  执行: '⚙️',
  生成: '🖼️',
  图片: '🖼️',
  上传: '⬆️',
  完成: '✅',
  搜索: '🔍',
  优化: '✨',
  压缩: '📦',
  同步: '🔄',
};

function getStepIcon(msg: string): string {
  for (const [key, icon] of Object.entries(STEP_ICONS)) {
    if (msg.includes(key)) return icon;
  }
  return '•';
}

export const TaskProgress: React.FC<TaskProgressProps> = ({ task }) => {
  const [expanded, setExpanded] = useState(false);
  const [seconds, setSeconds] = React.useState(0);

  React.useEffect(() => {
    if (task.status === 'executing' || task.status === 'analyzing') {
      const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
      return () => clearInterval(timer);
    }
    return undefined;
  }, [task.status]);

  const isRunning = task.status === 'analyzing' || task.status === 'executing';
  const isDone = task.status === 'completed' || task.status === 'failed';
  const log = task.progressLog || [];

  if (!isRunning && !(isDone && log.length > 0)) return null;

  const step = task.progressStep || 1;
  const total = task.totalSteps || 4;
  const progressMsg =
    task.progressMessage ||
    (task.status === 'analyzing' ? '正在分析需求...' : '正在生成中...');

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-[420px]"
    >
      {isRunning && (
        <div className="py-2">
          <div className="mb-2.5 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-100">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                initial={{ width: 0 }}
                animate={{ width: `${(step / total) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <span className="shrink-0 font-mono text-[10px] text-gray-400">
              {step}/{total}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black">
              <Sparkles size={10} className="text-white" />
            </div>
            <AnimatePresence mode="wait">
              <motion.span
                key={progressMsg}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 5 }}
                transition={{ duration: 0.2 }}
                className="flex-1 text-[12px] font-medium text-gray-600"
              >
                {progressMsg}
                {isRunning && seconds > 0 ? ` · ${seconds}s` : ''}
              </motion.span>
            </AnimatePresence>
            <Loader2 size={12} className="shrink-0 animate-spin text-gray-400" />
          </div>
        </div>
      )}

      {log.length > 0 && (
        <div className="mt-1">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="group flex items-center gap-1.5 py-1 text-[11px] text-gray-400 transition-colors hover:text-gray-600"
          >
            {isDone ? (
              task.status === 'completed' ? (
                <CheckCircle2 size={11} className="text-green-500" />
              ) : (
                <XCircle size={11} className="text-red-400" />
              )
            ) : (
              <Clock size={11} className="text-blue-400" />
            )}
            <span className="underline-offset-2 group-hover:underline">
              {expanded ? '收起' : '展开'}思考过程
            </span>
            <span className="text-gray-300">({log.length} 步)</span>
            {expanded ? (
              <ChevronUp size={10} className="text-gray-400" />
            ) : (
              <ChevronDown size={10} className="text-gray-400" />
            )}
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="ml-1 space-y-1.5 border-l-2 border-gray-100 pl-3 pb-2 pt-1">
                  {log.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-start gap-2"
                    >
                      <span className="mt-0.5 shrink-0 text-[11px] leading-none">
                        {getStepIcon(msg)}
                      </span>
                      <span
                        className={`text-[11px] leading-relaxed ${
                          i === log.length - 1 && isRunning
                            ? 'font-medium text-gray-700'
                            : 'text-gray-400'
                        }`}
                      >
                        {msg}
                      </span>
                    </motion.div>
                  ))}
                  {isRunning && (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="h-1 w-1 animate-pulse rounded-full bg-blue-400" />
                      <span
                        className="h-1 w-1 animate-pulse rounded-full bg-blue-400"
                        style={{ animationDelay: '0.2s' }}
                      />
                      <span
                        className="h-1 w-1 animate-pulse rounded-full bg-blue-400"
                        style={{ animationDelay: '0.4s' }}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
};
