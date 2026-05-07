import type { AgentTaskMetadata } from '../../types/agent.types';

export interface QueuedOrchestratorMessage {
  message: string;
  attachments?: File[];
  metadata?: AgentTaskMetadata;
  userMessageId?: string;
}

export const enqueueOrchestratorMessage = (
  queue: QueuedOrchestratorMessage[],
  nextItem: QueuedOrchestratorMessage,
) => {
  queue.push(nextItem);
  return queue.length;
};

export const dequeueNextOrchestratorMessage = (
  queue: QueuedOrchestratorMessage[],
): QueuedOrchestratorMessage | null => {
  if (queue.length === 0) {
    return null;
  }

  return queue.shift() || null;
};
