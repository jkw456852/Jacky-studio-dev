import assert from 'node:assert/strict';
import test from 'node:test';

import { useAgentStore } from './agent.store.ts';
import type { AgentTask } from '../types/agent.types.ts';

const makeTask = (id: string, overrides: Partial<AgentTask> = {}): AgentTask => ({
  id,
  agentId: 'coco',
  status: 'analyzing',
  input: {
    message: `message-${id}`,
    context: {
      projectId: 'test-project',
      projectTitle: 'Test Project',
      conversationId: 'test-conversation',
      existingAssets: [],
      conversationHistory: [],
    },
  },
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

test('setCurrentTask clears streamed content when switching to a new task', () => {
  const { actions } = useAgentStore.getState();

  actions.setCurrentTask(null);
  actions.setCurrentTask(
    makeTask('task-a', {
      streamingText: 'previous visible answer',
      reasoningText: 'previous reasoning',
      thoughtTrace: ['previous thought'],
    }),
  );

  actions.setCurrentTask(makeTask('task-b'));

  const currentTask = useAgentStore.getState().currentTask;
  assert.equal(currentTask?.id, 'task-b');
  assert.equal(currentTask?.streamingText, '');
  assert.equal(currentTask?.reasoningText, '');
  assert.deepEqual(currentTask?.thoughtTrace, []);

  actions.setCurrentTask(null);
});

test('setCurrentTask preserves streamed content for incremental updates to the same task', () => {
  const { actions } = useAgentStore.getState();

  actions.setCurrentTask(null);
  actions.setCurrentTask(
    makeTask('task-a', {
      streamingText: 'current visible answer',
      reasoningText: 'current reasoning',
      thoughtTrace: ['current thought'],
    }),
  );

  actions.setCurrentTask(
    makeTask('task-a', {
      progressMessage: 'still working',
    }),
  );

  const currentTask = useAgentStore.getState().currentTask;
  assert.equal(currentTask?.id, 'task-a');
  assert.equal(currentTask?.streamingText, 'current visible answer');
  assert.equal(currentTask?.reasoningText, 'current reasoning');
  assert.deepEqual(currentTask?.thoughtTrace, ['current thought']);

  actions.setCurrentTask(null);
});
