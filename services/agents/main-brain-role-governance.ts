import type {
  AgentRoleDraft,
  AgentTask,
  AgentType,
  MainBrainCapabilityDefinition,
  MainBrainMutationEnvelope,
  MainBrainRoleGovernanceAction,
  MainBrainRoleGovernanceAudit,
  RoleGovernanceMode,
  StudioRoleEntity,
} from '../../types/agent.types';
import { getStudioUserAssetApi } from '../runtime-assets/api.ts';
import {
  findGovernanceCapabilityByExecutorKey,
  findMainBrainCapability,
} from './main-brain-capability-registry.ts';

type GovernanceExecutionState = {
  draftId: string | null;
  promotedRoleId: string | null;
  notes: string[];
};

type GovernanceActionContext = {
  task: AgentTask;
  draft: AgentRoleDraft | null;
  action: MainBrainRoleGovernanceAction;
  state: GovernanceExecutionState;
  mode: RoleGovernanceMode;
  capability?: MainBrainCapabilityDefinition;
  mutation?: MainBrainMutationEnvelope;
};

type GovernanceActionHandler = (context: GovernanceActionContext) => void;

const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : String(value ?? '').trim();

const normalizeStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => normalizeText(item))
        .filter(Boolean)
        .slice(0, 24)
    : [];

const normalizeRoleGovernanceMode = (
  value: unknown,
): RoleGovernanceMode | undefined => {
  const mode = normalizeText(value) as RoleGovernanceMode;
  return mode === 'manual_only' ||
    mode === 'draft_only' ||
    mode === 'approval_required' ||
    mode === 'auto_manage'
    ? mode
    : undefined;
};

const normalizeRoleDraft = (value: unknown): AgentRoleDraft | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const title = normalizeText(raw.title);
  const summary = normalizeText(raw.summary);
  const instructions = normalizeStringList(raw.instructions);
  if (!title && !summary && instructions.length === 0) {
    return null;
  }
  return {
    title: title || '未命名角色草案',
    summary,
    instructions,
  };
};

const normalizeMutationEnvelope = (
  value: unknown,
  fallbackReason = '',
): MainBrainMutationEnvelope | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const resource = normalizeText(raw.resource) as MainBrainMutationEnvelope['resource'];
  const operation = normalizeText(raw.operation) as MainBrainMutationEnvelope['operation'];
  const allowedResources: MainBrainMutationEnvelope['resource'][] = [
    'role',
    'role-addon',
    'main-brain-soul',
    'main-brain-user',
    'main-brain-workflow',
    'main-brain-memory',
    'main-brain-heartbeat',
    'main-brain-bootstrap',
  ];
  const allowedOperations: MainBrainMutationEnvelope['operation'][] = [
    'read',
    'create',
    'update',
    'archive',
    'promote',
    'delete',
    'bind',
    'suggest',
  ];
  if (!allowedResources.includes(resource) || !allowedOperations.includes(operation)) {
    return undefined;
  }
  const reason = normalizeText(raw.reason) || fallbackReason;
  if (!reason) return undefined;
  const payload =
    raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload)
      ? (raw.payload as Record<string, unknown>)
      : undefined;
  return {
    resource,
    operation,
    targetId: normalizeText(raw.targetId) || undefined,
    targetBaseAgentId: (normalizeText(raw.targetBaseAgentId) || undefined) as
      | AgentType
      | undefined,
    payload,
    governanceMode: normalizeRoleGovernanceMode(raw.governanceMode),
    requiresHumanApproval: raw.requiresHumanApproval === true,
    reason,
  };
};

const asGovernanceCapability = (
  capability?: MainBrainCapabilityDefinition,
): MainBrainCapabilityDefinition | undefined =>
  capability?.kind === 'governance-skill' ? capability : undefined;

const resolveGovernanceCapability = (
  action: Pick<MainBrainRoleGovernanceAction, 'action' | 'capabilityId'>,
): MainBrainCapabilityDefinition | undefined => {
  const fromCapabilityId = action.capabilityId
    ? asGovernanceCapability(findMainBrainCapability(action.capabilityId))
    : undefined;
  return fromCapabilityId || findGovernanceCapabilityByExecutorKey(action.action);
};

const inferMutationEnvelope = (
  action: MainBrainRoleGovernanceAction,
  capability?: MainBrainCapabilityDefinition,
): MainBrainMutationEnvelope | undefined => {
  if (!capability?.mutation) return undefined;
  const promptAddonText = normalizeText(action.promptAddonText);
  const payload =
    action.action === 'addon_update' && promptAddonText
      ? { promptAddonText }
      : undefined;
  return {
    resource: capability.mutation.resource,
    operation: capability.mutation.operation,
    targetId: normalizeText(action.targetRoleId) || undefined,
    targetBaseAgentId: (normalizeText(action.targetBaseAgentId) || undefined) as
      | AgentType
      | undefined,
    payload,
    governanceMode: action.governanceMode,
    requiresHumanApproval: action.requiresHumanApproval,
    reason: action.reason,
  };
};

const normalizeGovernanceAction = (
  value: unknown,
): MainBrainRoleGovernanceAction | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const action = normalizeText(raw.action) as MainBrainRoleGovernanceAction['action'];
  const allowedActions: MainBrainRoleGovernanceAction['action'][] = [
    'read',
    'bind',
    'draft_create',
    'draft_update',
    'promote',
    'archive',
    'addon_update',
    'suggest_replacement',
  ];
  if (!allowedActions.includes(action)) return null;

  const capabilityId = normalizeText(raw.capabilityId) || undefined;
  const reason = normalizeText(raw.reason);
  const normalized: MainBrainRoleGovernanceAction = {
    action,
    capabilityId,
    targetRoleId: normalizeText(raw.targetRoleId) || undefined,
    targetBaseAgentId: (normalizeText(raw.targetBaseAgentId) || undefined) as
      | AgentType
      | undefined,
    governanceMode: normalizeRoleGovernanceMode(raw.governanceMode),
    requiresHumanApproval: raw.requiresHumanApproval === true,
    promptAddonText: normalizeText(raw.promptAddonText) || undefined,
    reason,
  };
  const capability = resolveGovernanceCapability(normalized);
  const mutation =
    normalizeMutationEnvelope(raw.mutation, normalized.reason) ||
    inferMutationEnvelope(normalized, capability);
  const effectiveReason = normalized.reason || mutation?.reason || '';
  if (!effectiveReason) return null;
  return {
    ...normalized,
    capabilityId: capability?.id || normalized.capabilityId,
    mutation,
    reason: effectiveReason,
  };
};

const normalizeGovernanceAudit = (
  value: unknown,
): MainBrainRoleGovernanceAudit | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const actions = Array.isArray(raw.actions)
    ? raw.actions
        .map((item) => normalizeGovernanceAction(item))
        .filter(Boolean) as MainBrainRoleGovernanceAction[]
    : [];
  if (actions.length === 0) return null;
  return {
    summary: normalizeText(raw.summary) || undefined,
    actions,
  };
};

const resolveRoleGovernanceMode = (task: AgentTask): RoleGovernanceMode => {
  const mode = normalizeRoleGovernanceMode(task.input.metadata?.roleGovernanceMode);
  return mode || 'manual_only';
};

const resolveSelectedRole = (task: AgentTask): StudioRoleEntity | null => {
  const roleId = normalizeText(task.input.metadata?.selectedRoleId);
  if (!roleId) return null;
  return getStudioUserAssetApi().getRoleById(roleId);
};

const resolveBaseAgentId = (
  task: AgentTask,
  action: MainBrainRoleGovernanceAction,
): AgentType => {
  const fromMutation = normalizeText(action.mutation?.targetBaseAgentId) as AgentType;
  if (fromMutation) return fromMutation;
  const fromAction = normalizeText(action.targetBaseAgentId) as AgentType;
  if (fromAction) return fromAction;
  const fromMetadata = normalizeText(task.input.metadata?.baseAgentId) as AgentType;
  if (fromMetadata) return fromMetadata;
  const selectedRole = resolveSelectedRole(task);
  if (selectedRole?.baseAgentId) return selectedRole.baseAgentId;
  return 'coco';
};

const resolveActionTargetRoleId = (
  task: AgentTask,
  action: MainBrainRoleGovernanceAction,
): string | null =>
  normalizeText(action.mutation?.targetId) ||
  normalizeText(action.targetRoleId) ||
  normalizeText(task.input.metadata?.selectedRoleId) ||
  null;

const resolveActionPromptAddonText = (
  action: MainBrainRoleGovernanceAction,
): string => {
  const payloadPromptAddon =
    action.mutation?.payload && typeof action.mutation.payload.promptAddonText === 'string'
      ? action.mutation.payload.promptAddonText
      : '';
  return normalizeText(payloadPromptAddon || action.promptAddonText);
};

const buildDraftPayload = ({
  task,
  draft,
  action,
}: {
  task: AgentTask;
  draft: AgentRoleDraft | null;
  action: MainBrainRoleGovernanceAction;
}): {
  targetRoleId: string | null;
  targetBaseAgentId: AgentType;
  title: string;
  summary: string;
  instructions: string[];
  roleStrategy: 'augment' | 'create';
  roleStrategyReason: string;
  sourceTaskId: string;
  sourceConversationId?: string;
  promotionSuggested: boolean;
} => ({
  targetRoleId: resolveActionTargetRoleId(task, action),
  targetBaseAgentId: resolveBaseAgentId(task, action),
  title:
    normalizeText(draft?.title) ||
    (action.action === 'draft_update' ? '角色更新草案' : '新角色草案'),
  summary: normalizeText(draft?.summary) || action.reason,
  instructions:
    normalizeStringList(draft?.instructions).length > 0
      ? normalizeStringList(draft?.instructions)
      : [action.reason],
  roleStrategy: action.action === 'draft_update' ? 'augment' : 'create',
  roleStrategyReason: action.reason,
  sourceTaskId: task.id,
  sourceConversationId: normalizeText(task.input.metadata?.topicId) || undefined,
  promotionSuggested:
    resolveRoleGovernanceMode(task) === 'approval_required' ||
    task.input.metadata?.allowMainBrainRolePromotion === true,
});

const isGovernanceModeAllowed = (
  mode: RoleGovernanceMode,
  capability?: MainBrainCapabilityDefinition,
): boolean => {
  const allowedModes = capability?.permissionPolicy?.governanceModes;
  if (!allowedModes || allowedModes.length === 0) {
    return true;
  }
  return allowedModes.includes(mode);
};

const canPersistDraft = (
  mode: RoleGovernanceMode,
  capability?: MainBrainCapabilityDefinition,
) =>
  isGovernanceModeAllowed(mode, capability) &&
  (mode === 'draft_only' || mode === 'approval_required' || mode === 'auto_manage');

const canAutoExecuteMutation = (
  task: AgentTask,
  action: MainBrainRoleGovernanceAction,
  capability?: MainBrainCapabilityDefinition,
) => {
  const mode =
    action.mutation?.governanceMode ||
    action.governanceMode ||
    resolveRoleGovernanceMode(task);
  if (mode !== 'auto_manage') {
    return false;
  }
  if (!isGovernanceModeAllowed(mode, capability)) {
    return false;
  }
  if (
    action.requiresHumanApproval === true ||
    action.mutation?.requiresHumanApproval === true
  ) {
    return false;
  }
  if (capability?.permissionPolicy?.requiresRolePromotion) {
    return task.input.metadata?.allowMainBrainRolePromotion === true;
  }
  if (capability?.permissionPolicy?.requiresRoleMutation) {
    return task.input.metadata?.allowMainBrainRoleMutation === true;
  }
  return true;
};

const ensureDraftId = ({
  task,
  draft,
  action,
  state,
}: {
  task: AgentTask;
  draft: AgentRoleDraft | null;
  action: MainBrainRoleGovernanceAction;
  state: GovernanceExecutionState;
}): string | null => {
  if (state.draftId) return state.draftId;
  const persisted = getStudioUserAssetApi().saveTemporaryRoleDraft(
    buildDraftPayload({ task, draft, action }),
  );
  if (!persisted?.id) {
    state.notes.push(`角色治理：未能保存临时角色草案（${action.reason}）。`);
    return null;
  }
  state.draftId = persisted.id;
  state.notes.push(`角色治理：已保存临时角色草案“${persisted.title}”。`);
  return state.draftId;
};

const GOVERNANCE_ACTION_HANDLERS: Record<string, GovernanceActionHandler> = {
  read: ({ state }) => {
    state.notes.push('角色治理：本轮仅进行了角色读取分析。');
  },
  bind: ({ task, action, state }) => {
    const targetRoleId = normalizeText(action.mutation?.targetId || action.targetRoleId);
    const targetBaseAgentId = resolveBaseAgentId(task, action);
    state.notes.push(
      targetRoleId
        ? `角色治理：执行阶段已按角色 ${targetRoleId} / ${targetBaseAgentId} 进行绑定解释。`
        : `角色治理：执行阶段已按专家壳 ${targetBaseAgentId} 进行绑定解释。`,
    );
  },
  suggest_replacement: ({ state }) => {
    state.notes.push('角色治理：已记录角色替代建议，未自动改写长期角色资产。');
  },
  draft_create: ({ task, draft, action, state, mode, capability }) => {
    if (!canPersistDraft(mode, capability)) {
      state.notes.push(
        `角色治理：当前模式 ${mode} 不允许落临时角色草案，已跳过“${action.reason}”。`,
      );
      return;
    }
    ensureDraftId({ task, draft, action, state });
  },
  draft_update: ({ task, draft, action, state, mode, capability }) => {
    if (!canPersistDraft(mode, capability)) {
      state.notes.push(
        `角色治理：当前模式 ${mode} 不允许落临时角色草案，已跳过“${action.reason}”。`,
      );
      return;
    }
    ensureDraftId({ task, draft, action, state });
  },
  promote: ({ task, draft, action, state, capability }) => {
    if (!canAutoExecuteMutation(task, action, capability)) {
      state.notes.push(
        '角色治理：升级长期角色需要更高权限或人工确认，本轮仅保留审计建议。',
      );
      return;
    }
    const draftId = ensureDraftId({ task, draft, action, state });
    if (!draftId) return;
    const promoted = getStudioUserAssetApi().promoteTemporaryRole(draftId, {
      targetRoleId: resolveActionTargetRoleId(task, action),
    });
    if (!promoted?.id) {
      state.notes.push('角色治理：长期角色升级失败，未产生可持久化角色实体。');
      return;
    }
    state.promotedRoleId = promoted.id;
    state.notes.push(`角色治理：已自动升级为长期角色“${promoted.title}”。`);
  },
  archive: ({ task, action, state, capability }) => {
    const targetRoleId = normalizeText(action.mutation?.targetId || action.targetRoleId);
    if (!targetRoleId) {
      state.notes.push('角色治理：归档动作缺少 targetRoleId，已跳过。');
      return;
    }
    if (!canAutoExecuteMutation(task, action, capability)) {
      state.notes.push(`角色治理：角色 ${targetRoleId} 的归档仅记录为建议，未自动执行。`);
      return;
    }
    getStudioUserAssetApi().archiveRole(targetRoleId);
    state.notes.push(`角色治理：已自动归档角色 ${targetRoleId}。`);
  },
  addon_update: ({ task, action, state, capability }) => {
    const targetBaseAgentId = resolveBaseAgentId(task, action);
    const promptAddonText = resolveActionPromptAddonText(action);
    if (!promptAddonText) {
      state.notes.push(
        `角色治理：专家壳 ${targetBaseAgentId} 的长期 addon 改写缺少 promptAddonText，已跳过。`,
      );
      return;
    }
    if (!canAutoExecuteMutation(task, action, capability)) {
      state.notes.push(
        `角色治理：专家壳 ${targetBaseAgentId} 的长期 addon 改写仅记录为建议，未自动执行。`,
      );
      return;
    }
    getStudioUserAssetApi().setAgentPromptAddon(targetBaseAgentId, promptAddonText);
    state.notes.push(`角色治理：已自动更新专家壳 ${targetBaseAgentId} 的长期 addon。`);
  },
};

export const applyMainBrainRoleGovernanceAudit = ({
  task,
  finalPlan,
}: {
  task: AgentTask;
  finalPlan: any;
}): MainBrainRoleGovernanceAudit | undefined => {
  const audit = normalizeGovernanceAudit(finalPlan?.roleGovernanceAudit);
  if (!audit) return undefined;

  const draft = normalizeRoleDraft(finalPlan?.roleDraft || task.input.metadata?.roleDraft);
  const mode = resolveRoleGovernanceMode(task);
  const state: GovernanceExecutionState = {
    draftId: null,
    promotedRoleId: null,
    notes: [],
  };

  for (const action of audit.actions) {
    const capability = resolveGovernanceCapability(action);
    const mutation = action.mutation || inferMutationEnvelope(action, capability);
    const executorKey = capability?.executorKey || action.action;
    const handler = executorKey ? GOVERNANCE_ACTION_HANDLERS[executorKey] : undefined;
    if (!handler) {
      state.notes.push(`角色治理：未找到动作 ${action.action} 的执行处理器，已跳过。`);
      continue;
    }
    handler({
      task,
      draft,
      action: mutation ? { ...action, mutation } : action,
      state,
      mode,
      capability,
      mutation,
    });
  }

  const summaryParts = [normalizeText(audit.summary), ...state.notes].filter(Boolean);
  return {
    summary: summaryParts.join(' '),
    actions: audit.actions,
  };
};

export const finalizeRoleGovernancePlan = ({
  task,
  finalPlan,
}: {
  task: AgentTask;
  finalPlan: any;
}) => {
  const normalizedFinalPlan =
    finalPlan && typeof finalPlan === 'object' ? finalPlan : {};
  const appliedRoleGovernanceAudit = applyMainBrainRoleGovernanceAudit({
    task,
    finalPlan: normalizedFinalPlan,
  });

  return appliedRoleGovernanceAudit
    ? {
        ...normalizedFinalPlan,
        roleGovernanceAudit: appliedRoleGovernanceAudit,
      }
    : normalizedFinalPlan;
};
