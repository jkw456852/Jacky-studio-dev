import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSidebarBrowserAgentTaskMetadata,
  getPreparedPlanContinuationStatus,
} from './assistantSidebarBrowserAgentMetadata.ts';

test('buildSidebarBrowserAgentTaskMetadata preserves role governance metadata for manual autonomous routing', () => {
  const metadata = buildSidebarBrowserAgentTaskMetadata({
    skillData: {
      id: 'autonomous-main-brain',
      name: '自主主脑路由',
      iconName: 'Sparkles',
      config: {
        allowAutonomousRouting: true,
      },
    },
    agentSelectionMode: 'manual',
    pinnedAgentId: 'coco',
    selectedRoleId: 'role-coco-pro',
    selectedRoleSource: 'user',
    baseAgentId: 'coco',
    roleGovernanceMode: 'approval_required',
    allowMainBrainRoleMutation: true,
    allowMainBrainRolePromotion: false,
  });

  assert.equal(metadata.allowAutonomousRouting, true);
  assert.equal(metadata.creationMode, 'agent');
  assert.equal(metadata.agentSelectionMode, 'manual');
  assert.equal(metadata.pinnedAgentId, 'coco');
  assert.equal(metadata.selectedRoleId, 'role-coco-pro');
  assert.equal(metadata.selectedRoleSource, 'user');
  assert.equal(metadata.baseAgentId, 'coco');
  assert.equal(metadata.roleGovernanceMode, 'approval_required');
  assert.equal(metadata.allowMainBrainRoleMutation, true);
  assert.equal(metadata.allowMainBrainRolePromotion, false);
  assert.equal(metadata.skillData?.id, 'autonomous-main-brain');
});

test('buildSidebarBrowserAgentTaskMetadata omits manual-only fields for auto selection', () => {
  const metadata = buildSidebarBrowserAgentTaskMetadata({
    skillData: {
      id: 'plain-chat',
      name: '普通对话',
      iconName: 'MessageSquare',
      config: {},
    },
    agentSelectionMode: 'auto',
    pinnedAgentId: 'poster',
    selectedRoleId: null,
    selectedRoleSource: null,
    baseAgentId: 'poster',
    roleGovernanceMode: 'manual_only',
    allowMainBrainRoleMutation: false,
    allowMainBrainRolePromotion: false,
  });

  assert.equal(metadata.allowAutonomousRouting, false);
  assert.equal(metadata.creationMode, undefined);
  assert.equal(metadata.agentSelectionMode, 'auto');
  assert.equal(metadata.pinnedAgentId, undefined);
  assert.equal(metadata.selectedRoleId, undefined);
  assert.equal(metadata.selectedRoleSource, undefined);
  assert.equal(metadata.baseAgentId, 'poster');
});

test('getPreparedPlanContinuationStatus follows planner done flag', () => {
  assert.equal(getPreparedPlanContinuationStatus({ done: true }), 'done');
  assert.equal(getPreparedPlanContinuationStatus({ done: false }), 'active');
  assert.equal(getPreparedPlanContinuationStatus(null), 'active');
});
