import type {
  AgentRoleDraft,
  AgentRoutingDecision,
  AgentTask,
  AgentTaskMetadata,
  AgentType,
} from '../../types/agent.types.ts';
import type { ProjectContext } from '../../types/common.ts';
import { buildAgentTaskOutput } from './agent-task-output.ts';

export interface RolePromptLayer {
  rolePromptLabel?: string;
  rolePromptAddon?: string;
}

export interface AutoRoleSessionState {
  targetAgent: AgentType;
  roleStrategy: 'reuse' | 'augment' | 'create';
  roleStrategyReason: string;
  roleDraft: {
    title: string;
    summary: string;
    instructions: string[];
  } | null;
  updatedAt: number;
}

export interface RoutingDecisionLike
  extends Pick<
    AgentRoutingDecision,
    | 'targetAgent'
    | 'handoffMessage'
    | 'message'
    | 'questions'
    | 'suggestions'
    | 'roleStrategy'
    | 'roleStrategyReason'
  > {
  roleDraft?: AgentRoleDraft;
}

export interface BuildResponseTaskOptions {
  decision: Pick<RoutingDecisionLike, 'message' | 'handoffMessage' | 'questions' | 'suggestions'>;
  messageForExecution: string;
  attachments?: File[];
  uploadedUrls: string[];
  updatedContext: ProjectContext;
  metadata?: AgentTaskMetadata;
}

export interface BuildExecutionTaskOptions {
  agentId: AgentType;
  messageForExecution: string;
  attachments?: File[];
  uploadedUrls: string[];
  updatedContext: ProjectContext;
  taskMetadata: AgentTaskMetadata;
}

export const buildRolePromptAddonFromDecision = (
  decision: Pick<
    RoutingDecisionLike,
    'roleStrategy' | 'roleStrategyReason' | 'handoffMessage' | 'targetAgent' | 'roleDraft'
  >,
  messageForExecution: string,
): RolePromptLayer => {
  const strategy = String(decision.roleStrategy || '').trim();
  const reason = String(decision.roleStrategyReason || '').trim();
  const handoffMessage = String(decision.handoffMessage || '').trim();
  const draftTitle = String(decision.roleDraft?.title || '').trim();
  const draftSummary = String(decision.roleDraft?.summary || '').trim();
  const draftInstructions = Array.isArray(decision.roleDraft?.instructions)
    ? decision.roleDraft.instructions
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    : [];

  const draftBlock =
    draftTitle || draftSummary || draftInstructions.length > 0
      ? [
          draftTitle ? `Temporary role draft title: ${draftTitle}` : '',
          draftSummary ? `Temporary role draft summary: ${draftSummary}` : '',
          draftInstructions.length > 0
            ? `Temporary role draft instructions:\n${draftInstructions
                .map((item) => `- ${item}`)
                .join('\n')}`
            : '',
        ]
          .filter(Boolean)
          .join('\n')
      : '';

  if (!strategy || strategy === 'reuse') {
    return {};
  }

  if (strategy === 'augment') {
    return {
      rolePromptLabel: `augment:${decision.targetAgent}`,
      rolePromptAddon: [
        'Reuse your existing specialist identity as the base role.',
        reason ? `Task-specific augmentation reason: ${reason}` : '',
        draftBlock,
        handoffMessage ? `Task handoff context: ${handoffMessage}` : '',
        `Current user request: ${messageForExecution}`,
        'Add only the missing task-specific constraints. Do not discard your existing specialist strengths.',
      ]
        .filter(Boolean)
        .join('\n'),
    };
  }

  if (strategy === 'create') {
    return {
      rolePromptLabel: `create:${decision.targetAgent}`,
      rolePromptAddon: [
        'Treat your built-in role as an execution shell, but switch to a temporary task brain for this request.',
        reason ? `Why a temporary task brain is needed: ${reason}` : '',
        draftBlock,
        handoffMessage ? `Temporary brain brief: ${handoffMessage}` : '',
        `Current user request: ${messageForExecution}`,
        'Compose the missing role logic dynamically, but keep tool discipline and output quality strict.',
      ]
        .filter(Boolean)
        .join('\n'),
    };
  }

  return {};
};

export const buildAutoRoleSessionState = (
  decision: Pick<
    RoutingDecisionLike,
    'targetAgent' | 'roleStrategy' | 'roleStrategyReason' | 'roleDraft'
  >,
): AutoRoleSessionState => ({
  targetAgent: decision.targetAgent,
  roleStrategy:
    decision.roleStrategy === 'augment' || decision.roleStrategy === 'create'
      ? decision.roleStrategy
      : 'reuse',
  roleStrategyReason: String(decision.roleStrategyReason || '').trim(),
  roleDraft: decision.roleDraft
    ? {
        title: String(decision.roleDraft.title || '').trim(),
        summary: String(decision.roleDraft.summary || '').trim(),
        instructions: Array.isArray(decision.roleDraft.instructions)
          ? decision.roleDraft.instructions
              .map((item) => String(item || '').trim())
              .filter(Boolean)
          : [],
      }
    : null,
  updatedAt: Date.now(),
});

export const shouldUseImmediateResponseShortcut = (
  decision: Pick<AgentRoutingDecision, 'action'>,
  metadata?: AgentTaskMetadata,
): boolean => {
  if (decision.action !== 'respond' && decision.action !== 'clarify') {
    return false;
  }
  return metadata?.allowAutonomousRouting !== true;
};

export const buildImmediateResponseTask = ({
  decision,
  messageForExecution,
  attachments,
  uploadedUrls,
  updatedContext,
  metadata,
}: BuildResponseTaskOptions): AgentTask => {
  const guidance = [
    ...(decision.questions || []),
    ...(decision.suggestions || []),
  ].filter(Boolean);
  const guidanceText = guidance.length > 0 ? `\n\n${guidance.join('\n')}` : '';

  return {
    id: `task-${Date.now()}`,
    agentId: 'coco',
    status: 'completed',
    input: {
      message: messageForExecution,
      attachments,
      uploadedAttachments: uploadedUrls.length > 0 ? uploadedUrls : undefined,
      context: updatedContext,
      metadata,
    },
    output: buildAgentTaskOutput({
      message: `${decision.message || decision.handoffMessage || 'Let me first organize the request.'}${guidanceText}`,
      questions: decision.questions,
      suggestions: decision.suggestions,
      runtime: {
        mode: 'direct-response',
      },
    }),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
};

export const buildExecutionTask = ({
  agentId,
  messageForExecution,
  attachments,
  uploadedUrls,
  updatedContext,
  taskMetadata,
}: BuildExecutionTaskOptions): AgentTask => ({
  id: `task-${Date.now()}`,
  agentId,
  status: 'pending',
  input: {
    message: messageForExecution,
    attachments,
    uploadedAttachments: uploadedUrls.length > 0 ? uploadedUrls : undefined,
    context: updatedContext,
    metadata: taskMetadata,
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
