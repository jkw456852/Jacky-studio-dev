import type {
  MainBrainCapabilityDefinition,
  MainBrainCapabilityKind,
  RoleGovernanceMode,
  RoleSource,
} from '../../types/agent.types';
import { REGISTERED_SKILL_NAMES } from '../skills/skill-manifest.ts';
import {
  GOVERNANCE_CAPABILITIES,
  INTERNAL_MODULE_CAPABILITIES,
  MAIN_BRAIN_CAPABILITY_MANIFEST,
  SKILL_CAPABILITIES,
  SPECIALIST_AGENT_CAPABILITIES,
} from './main-brain-capability-manifest.ts';

export {
  GOVERNANCE_CAPABILITIES,
  INTERNAL_MODULE_CAPABILITIES,
  SKILL_CAPABILITIES,
  SPECIALIST_AGENT_CAPABILITIES,
};

export const MAIN_BRAIN_CAPABILITY_REGISTRY: MainBrainCapabilityDefinition[] = [
  ...MAIN_BRAIN_CAPABILITY_MANIFEST,
];

const normalizeCapabilityId = (value: string) => value.trim().toLowerCase();

const REGISTERED_SKILL_NAME_SET = new Set(
  REGISTERED_SKILL_NAMES.map((item) => normalizeCapabilityId(item)),
);

const prioritizeSkillCapabilities = (preferredSkills: string[]) => {
  const preferredSet = new Set(preferredSkills.map((item) => normalizeCapabilityId(item)));
  return [
    ...SKILL_CAPABILITIES.filter(
      (capability) =>
        preferredSet.has(normalizeCapabilityId(capability.id)) ||
        (capability.aliases || []).some((alias) => preferredSet.has(normalizeCapabilityId(alias))),
    ),
    ...SKILL_CAPABILITIES.filter(
      (capability) =>
        !preferredSet.has(normalizeCapabilityId(capability.id)) &&
        !(capability.aliases || []).some((alias) => preferredSet.has(normalizeCapabilityId(alias))),
    ),
  ];
};

const isRegisteredExecutableSkill = (capability: MainBrainCapabilityDefinition): boolean => {
  if (capability.kind !== 'skill') return false;
  const capabilityId = normalizeCapabilityId(capability.id);
  const executorKey = normalizeCapabilityId(capability.executorKey || capability.id);
  return (
    REGISTERED_SKILL_NAME_SET.has(capabilityId) ||
    REGISTERED_SKILL_NAME_SET.has(executorKey)
  );
};

const summarizeCapabilityInputs = (capability: MainBrainCapabilityDefinition) => {
  const inputs = capability.inputs || [];
  if (inputs.length === 0) {
    return 'no explicit inputs';
  }
  return inputs
    .slice(0, 3)
    .map((field) => `${field.name}${field.required ? '*' : ''}`)
    .join(', ');
};

const summarizeCapabilityPurpose = (capability: MainBrainCapabilityDefinition) =>
  capability.plannerSummary || capability.purpose;

const listCapabilitiesByKind = (kind: MainBrainCapabilityKind) =>
  MAIN_BRAIN_CAPABILITY_REGISTRY.filter((item) => item.kind === kind);

export const listMainBrainCapabilities = (
  kinds?: MainBrainCapabilityDefinition['kind'][],
): MainBrainCapabilityDefinition[] => {
  if (!kinds || kinds.length === 0) {
    return [...MAIN_BRAIN_CAPABILITY_REGISTRY];
  }
  const kindSet = new Set(kinds);
  return MAIN_BRAIN_CAPABILITY_REGISTRY.filter((item) => kindSet.has(item.kind));
};

export const findMainBrainCapability = (
  capabilityId: string,
): MainBrainCapabilityDefinition | undefined => {
  const target = normalizeCapabilityId(capabilityId);
  return MAIN_BRAIN_CAPABILITY_REGISTRY.find((item) => {
    if (normalizeCapabilityId(item.id) === target) return true;
    return (item.aliases || []).some((alias) => normalizeCapabilityId(alias) === target);
  });
};

export const listGovernanceCapabilities = (): MainBrainCapabilityDefinition[] =>
  listCapabilitiesByKind('governance-skill');

export const getGovernanceCapabilityIds = (): string[] =>
  listGovernanceCapabilities().map((item) => item.id);

export const listGovernanceCapabilityExecutorKeys = (): string[] =>
  listGovernanceCapabilities()
    .map((item) => item.executorKey || '')
    .filter(Boolean);

export const findGovernanceCapabilityByExecutorKey = (
  executorKey: string,
): MainBrainCapabilityDefinition | undefined => {
  const target = normalizeCapabilityId(executorKey);
  return listGovernanceCapabilities().find(
    (item) => normalizeCapabilityId(item.executorKey || '') === target,
  );
};

export const buildGovernanceCapabilityIdList = (): string =>
  getGovernanceCapabilityIds().join(', ');

export interface BuildRoleGovernancePromptContractInput {
  selectedRoleId?: string;
  selectedRoleSource?: RoleSource | string;
  baseAgentId?: string;
  roleGovernanceMode?: RoleGovernanceMode;
  allowMainBrainRoleMutation?: boolean;
  allowMainBrainRolePromotion?: boolean;
}

export const buildRoleGovernancePromptContract = ({
  selectedRoleId = '',
  selectedRoleSource = '',
  baseAgentId = '',
  roleGovernanceMode = 'manual_only',
  allowMainBrainRoleMutation = false,
  allowMainBrainRolePromotion = false,
}: BuildRoleGovernancePromptContractInput): string => {
  const governanceCapabilityIdList = buildGovernanceCapabilityIdList();
  return `
[Role Governance]
- selectedRoleId: ${selectedRoleId || 'none'}
- selectedRoleSource: ${selectedRoleSource || 'none'}
- baseAgentId: ${baseAgentId || 'none'}
- roleGovernanceMode: ${roleGovernanceMode}
- allowMainBrainRoleMutation: ${allowMainBrainRoleMutation ? 'true' : 'false'}
- allowMainBrainRolePromotion: ${allowMainBrainRolePromotion ? 'true' : 'false'}
- Governance capabilities are planner-side decisions only. Never place ${governanceCapabilityIdList} into skillCalls.
- If you choose any role governance action, record it in roleGovernanceAudit.actions instead.
- When roleGovernanceMode is manual_only, you may read and bind roles, but must not propose mutation, addon rewrite, or promotion as completed actions.
- When roleGovernanceMode is draft_only, you may propose temporary or durable drafts, but do not claim they are already published.
- When roleGovernanceMode is approval_required, you may propose durable changes, addon rewrites, or promotions, but they must be marked requiresHumanApproval=true.
- Only when roleGovernanceMode is auto_manage and the corresponding allowMainBrainRoleMutation / allowMainBrainRolePromotion flag is true may you describe a durable role mutation, addon rewrite, or promotion as auto-executable.
- If the user explicitly asks to directly rewrite the current expert long-term setting, prefer roleGovernanceAudit.actions with action="addon_update", targetBaseAgentId, and the full promptAddonText instead of only describing suggested wording in message.
- If a durable selected role exists, prefer aligning execution with its baseAgentId instead of ignoring the selected role context.
`;
};

export interface BuildMainBrainCapabilityTruthSnapshotInput {
  preferredSkills?: string[];
  networkResearchEnabled?: boolean;
  hasResearchContext?: boolean;
  roleGovernanceMode?: RoleGovernanceMode;
  allowMainBrainRoleMutation?: boolean;
  allowMainBrainRolePromotion?: boolean;
}

const describeGovernanceTruth = ({
  capability,
  roleGovernanceMode,
  allowMainBrainRoleMutation,
  allowMainBrainRolePromotion,
}: {
  capability: MainBrainCapabilityDefinition;
  roleGovernanceMode: RoleGovernanceMode;
  allowMainBrainRoleMutation: boolean;
  allowMainBrainRolePromotion: boolean;
}): string => {
  const base = 'planner/audit capability, never a direct skillCall';

  if (capability.permissionPolicy?.requiresRolePromotion) {
    if (roleGovernanceMode === 'auto_manage' && allowMainBrainRolePromotion) {
      return `${base}; current mode auto_manage + promotion flag on, so it may auto-execute if runtime audit confirms it.`;
    }
    if (roleGovernanceMode === 'approval_required') {
      return `${base}; current mode approval_required, so promotion may be proposed but must require human approval.`;
    }
    return `${base}; current mode ${roleGovernanceMode} does not allow automatic promotion right now.`;
  }

  if (capability.permissionPolicy?.requiresRoleMutation) {
    if (roleGovernanceMode === 'auto_manage' && allowMainBrainRoleMutation) {
      return `${base}; current mode auto_manage + mutation flag on, so it may auto-execute if runtime audit confirms it.`;
    }
    if (roleGovernanceMode === 'approval_required') {
      return `${base}; current mode approval_required, so durable mutation may be proposed but must require human approval.`;
    }
    if (roleGovernanceMode === 'draft_only') {
      return `${base}; current mode draft_only, so it may draft changes but must not claim durable publish completion.`;
    }
    return `${base}; current mode ${roleGovernanceMode} only allows reasoning or binding, not durable mutation completion.`;
  }

  if (roleGovernanceMode === 'manual_only') {
    return `${base}; current mode manual_only, so keep it at analysis/binding level only.`;
  }

  if (roleGovernanceMode === 'draft_only') {
    return `${base}; current mode draft_only, so draft actions may be proposed without claiming publish completion.`;
  }

  if (roleGovernanceMode === 'approval_required') {
    return `${base}; current mode approval_required, so durable actions may be proposed but need approval evidence before claiming completion.`;
  }

  return `${base}; current mode auto_manage, so execution claims must still stay aligned with runtime audit evidence.`;
};

export const buildMainBrainCapabilityTruthSnapshot = ({
  preferredSkills = [],
  networkResearchEnabled = false,
  hasResearchContext = false,
  roleGovernanceMode = 'manual_only',
  allowMainBrainRoleMutation = false,
  allowMainBrainRolePromotion = false,
}: BuildMainBrainCapabilityTruthSnapshotInput = {}): string => {
  const prioritizedSkills = prioritizeSkillCapabilities(preferredSkills);
  const directSkills = prioritizedSkills.filter(
    (capability) =>
      isRegisteredExecutableSkill(capability) &&
      capability.id !== 'workspaceSearch' &&
      capability.id !== 'export',
  );

  return [
    '[Capability Truth Snapshot: use this when the user asks what you can/cannot do]',
    '- Read this section before giving any capability boundary answer.',
    '- Distinguish directly executable, turn-gated, governance-gated, and partial capabilities.',
    '- Never collapse a gated capability into "I cannot do that" when the capability is registered.',
    '[Directly Executable Now]',
    ...directSkills.map(
      (capability) =>
        `- ${capability.id}: registered executable skill. Use when: ${capability.useWhen[0]}.`,
    ),
    '[Turn-Gated Capability]',
    networkResearchEnabled
      ? `- workspaceSearch: registered executable skill and enabled for this turn${hasResearchContext ? '; attached research context is already present.' : '; it may be triggered when online verification is needed.'}`
      : '- workspaceSearch: registered executable skill, but this turn does not currently expose network research. Describe it as conditional instead of unavailable.',
    '[Governance-Gated Capability]',
    ...GOVERNANCE_CAPABILITIES.map(
      (capability) =>
        `- ${capability.id}: ${describeGovernanceTruth({
          capability,
          roleGovernanceMode,
          allowMainBrainRoleMutation,
          allowMainBrainRolePromotion,
        })}`,
    ),
    '[Partial Productization]',
    '- export: registered executable export base exists, but if the user expects a polished file-download or delivery workflow, describe it conservatively as only partially productized.',
  ].join('\n');
};

export const buildMainBrainCapabilityPromptSummary = ({
  preferredSkills = [],
  includeInternalModules = true,
  includeSpecialists = true,
  networkResearchEnabled = false,
  hasResearchContext = false,
}: {
  preferredSkills?: string[];
  includeInternalModules?: boolean;
  includeSpecialists?: boolean;
  networkResearchEnabled?: boolean;
  hasResearchContext?: boolean;
} = {}): string => {
  const sections: string[] = [];

  if (networkResearchEnabled) {
    sections.push(
      '[Turn-Level System Capabilities: available for this turn]',
      `- networkResearch: The workspace can perform network-backed research through the search pipeline. Use when the user asks for facts, comparison, investigation, or recent information. Access pattern: ${hasResearchContext ? 'research context is already attached to this turn; use it before asking for more search.' : 'search may be provided through the executable workspaceSearch skill, turn-level research support, or model-side search augmentation.'}`,
    );
  }

  if (includeInternalModules) {
    sections.push(
      '[Coordinator Modules: awareness only, not valid skillCalls]',
      ...INTERNAL_MODULE_CAPABILITIES.map(
        (capability) =>
          `- ${capability.id}: ${summarizeCapabilityPurpose(capability)} Inputs: ${summarizeCapabilityInputs(capability)}.`,
      ),
    );
  }

  sections.push(
    '[Role Governance Capabilities: planning and audit actions, never direct skillCalls]',
    ...GOVERNANCE_CAPABILITIES.map(
      (capability) =>
        `- ${capability.id}: ${summarizeCapabilityPurpose(capability)} Use when: ${capability.useWhen[0]} Inputs: ${summarizeCapabilityInputs(capability)}. Record any intended action inside roleGovernanceAudit instead of putting this capability into skillCalls.`,
    ),
    '- Governance rule: specialist agents are routing targets, executable skills are runtime tools, and governance capabilities are planner-side decisions plus audit records.',
  );

  const prioritizedSkills = prioritizeSkillCapabilities(preferredSkills);

  sections.push(
    '[Executable Skills: these are the only items that may appear in skillCalls]',
    ...prioritizedSkills.map((capability) => {
      const aliases =
        capability.aliases && capability.aliases.length > 0
          ? ` Aliases: ${capability.aliases.join(', ')}.`
          : '';
      return `- ${capability.id}: ${summarizeCapabilityPurpose(capability)} Use when: ${capability.useWhen[0]} Inputs: ${summarizeCapabilityInputs(capability)}.${aliases}`;
    }),
  );

  if (includeSpecialists) {
    sections.push(
      '[Specialist Agents: routing targets, not skillCalls]',
      ...SPECIALIST_AGENT_CAPABILITIES.map(
        (capability) =>
          `- ${capability.id}: ${summarizeCapabilityPurpose(capability)} Use when: ${capability.useWhen[0]}.`,
      ),
      '- If a durable selected role exists, prefer keeping its baseAgentId aligned with the routed specialist shell instead of ignoring the selected role context.',
    );
  }

  return sections.join('\n');
};
