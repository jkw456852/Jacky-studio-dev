import type { AgentTask } from '../../types/agent.types';
import { buildMainBrainProgressMessage } from './main-brain-progress.ts';
import type { MainBrainRuntimePhase } from './main-brain-runtime.ts';

export interface MainBrainProgressState {
  status: 'analyzing' | 'executing';
  progressStep: number;
  totalSteps: number;
}

export const resolveMainBrainProgressState = (
  phase: MainBrainRuntimePhase,
): MainBrainProgressState => {
  switch (phase) {
    case 'understand':
      return { status: 'analyzing', progressStep: 1, totalSteps: 4 };
    case 'decide':
    case 'replan':
      return { status: 'analyzing', progressStep: 2, totalSteps: 4 };
    case 'execute':
    case 'observe':
      return { status: 'executing', progressStep: 3, totalSteps: 4 };
    case 'respond':
      return { status: 'executing', progressStep: 4, totalSteps: 4 };
    default:
      return { status: 'analyzing', progressStep: 2, totalSteps: 4 };
  }
};

export const buildMainBrainTaskProgressUpdate = (
  task: AgentTask,
  phase: MainBrainRuntimePhase,
  detail: string,
): AgentTask => {
  const progressState = resolveMainBrainProgressState(phase);
  return {
    ...task,
    status: progressState.status,
    progressMessage: buildMainBrainProgressMessage(phase, detail),
    progressStep: progressState.progressStep,
    totalSteps: progressState.totalSteps,
  };
};
