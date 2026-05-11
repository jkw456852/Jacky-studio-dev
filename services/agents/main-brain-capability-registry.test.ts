import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMainBrainCapabilityPromptSummary,
  buildMainBrainCapabilityTruthSnapshot,
  buildRoleGovernancePromptContract,
  findGovernanceCapabilityByExecutorKey,
  getGovernanceCapabilityIds,
  listGovernanceCapabilityExecutorKeys,
} from './main-brain-capability-registry.ts';

test('findGovernanceCapabilityByExecutorKey resolves manifest-backed governance executor metadata', () => {
  const capability = findGovernanceCapabilityByExecutorKey('addon_update');

  assert.equal(capability?.id, 'roleAddonUpdate');
  assert.equal(capability?.auditChannel, 'roleGovernanceAudit');
  assert.equal(capability?.mutation?.resource, 'role-addon');
  assert.equal(capability?.mutation?.operation, 'update');
});

test('listGovernanceCapabilityExecutorKeys stays aligned with governance capability ids', () => {
  const executorKeys = listGovernanceCapabilityExecutorKeys();
  const capabilityIds = getGovernanceCapabilityIds();

  assert.equal(executorKeys.includes('addon_update'), true);
  assert.equal(executorKeys.includes('promote'), true);
  assert.equal(executorKeys.length, capabilityIds.length);
});

test('buildRoleGovernancePromptContract derives governance capability restrictions from manifest', () => {
  const prompt = buildRoleGovernancePromptContract({
    selectedRoleId: 'role_brand_designer',
    selectedRoleSource: 'user',
    baseAgentId: 'poster',
    roleGovernanceMode: 'auto_manage',
    allowMainBrainRoleMutation: true,
    allowMainBrainRolePromotion: false,
  });

  assert.equal(prompt.includes('selectedRoleId: role_brand_designer'), true);
  assert.equal(prompt.includes('baseAgentId: poster'), true);
  assert.equal(prompt.includes('roleGovernanceMode: auto_manage'), true);
  assert.equal(prompt.includes('roleAddonUpdate'), true);
  assert.equal(prompt.includes('Never place'), true);
  assert.equal(prompt.includes('action="addon_update"'), true);
});

test('buildMainBrainCapabilityTruthSnapshot classifies direct turn-gated governance-gated and partial capabilities', () => {
  const snapshot = buildMainBrainCapabilityTruthSnapshot({
    preferredSkills: ['workspaceSearch', 'generateImage'],
    networkResearchEnabled: false,
    hasResearchContext: false,
    roleGovernanceMode: 'approval_required',
    allowMainBrainRoleMutation: false,
    allowMainBrainRolePromotion: false,
  });

  assert.equal(snapshot.includes('[Capability Truth Snapshot: use this when the user asks what you can/cannot do]'), true);
  assert.equal(snapshot.includes('[Directly Executable Now]'), true);
  assert.equal(snapshot.includes('- generateImage: registered executable skill.'), true);
  assert.equal(snapshot.includes('workspaceSearch: registered executable skill, but this turn does not currently expose network research'), true);
  assert.equal(snapshot.includes('[Governance-Gated Capability]'), true);
  assert.equal(snapshot.includes('approval_required'), true);
  assert.equal(snapshot.includes('[Partial Productization]'), true);
  assert.equal(snapshot.includes('- export: registered executable export base exists'), true);
});

test('buildMainBrainCapabilityTruthSnapshot marks governance auto execution only when auto-manage flags are enabled', () => {
  const snapshot = buildMainBrainCapabilityTruthSnapshot({
    preferredSkills: [],
    networkResearchEnabled: true,
    hasResearchContext: true,
    roleGovernanceMode: 'auto_manage',
    allowMainBrainRoleMutation: true,
    allowMainBrainRolePromotion: true,
  });

  assert.equal(snapshot.includes('workspaceSearch: registered executable skill and enabled for this turn; attached research context is already present.'), true);
  assert.equal(snapshot.includes('current mode auto_manage + mutation flag on, so it may auto-execute if runtime audit confirms it.'), true);
  assert.equal(snapshot.includes('current mode auto_manage + promotion flag on, so it may auto-execute if runtime audit confirms it.'), true);
});

test('buildMainBrainCapabilityPromptSummary reflects manifest-derived sections and filtering', () => {
  const prompt = buildMainBrainCapabilityPromptSummary({
    preferredSkills: ['workspaceSearch'],
    includeInternalModules: false,
    includeSpecialists: false,
    networkResearchEnabled: true,
    hasResearchContext: true,
  });

  assert.equal(prompt.includes('[Turn-Level System Capabilities: available for this turn]'), true);
  assert.equal(prompt.includes('[Coordinator Modules: awareness only, not valid skillCalls]'), false);
  assert.equal(prompt.includes('[Specialist Agents: routing targets, not skillCalls]'), false);
  assert.equal(prompt.includes('[Role Governance Capabilities: planning and audit actions, never direct skillCalls]'), true);
  assert.equal(prompt.includes('[Executable Skills: these are the only items that may appear in skillCalls]'), true);
  assert.equal(prompt.includes('workspaceSearch'), true);
});
