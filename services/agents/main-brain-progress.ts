import type { MainBrainRuntimePhase } from './main-brain-runtime';

export const buildMainBrainProgressMessage = (
  phase: MainBrainRuntimePhase,
  detail: string,
) => {
  switch (phase) {
    case 'understand':
      return '正在读取需求、附件和当前工作区上下文...';
    case 'decide':
      return '正在判断应该直接回答、先调查，还是调用工具继续执行...';
    case 'execute':
      return detail || '正在调用主脑选中的接口与工具...';
    case 'observe':
      return '正在读取刚刚返回的结果，并判断下一步...';
    case 'replan':
      return '正在根据最新结果重新规划下一步动作...';
    case 'respond':
      return '正在整理主脑的最终回复...';
    default:
      return '正在处理当前请求...';
  }
};
