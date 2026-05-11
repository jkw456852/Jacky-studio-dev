import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAnalyzePlanPrompt } from './analyze-plan-prompt.ts';

test('buildAnalyzePlanPrompt injects capability truth snapshot and boundary-answering rules for capability questions', () => {
  const result = buildAnalyzePlanPrompt({
    agentId: 'coco',
    systemPrompt: '你是测试主脑。',
    preferredSkills: ['generateImage', 'generateCopy'],
    message: '你现在有哪些权限和能力，哪些是本轮能做的？',
    context: {
      projectId: 'project-capability-test',
      projectTitle: '能力问答测试项目',
      conversationId: 'conversation-capability-test',
      existingAssets: [],
      conversationHistory: [],
    },
    metadata: {
      enableWebSearch: false,
      allowAutonomousRouting: true,
      roleGovernanceMode: 'approval_required',
      allowMainBrainRoleMutation: false,
      allowMainBrainRolePromotion: false,
    },
    forceImageToolCall: false,
    allowAutonomousRouting: true,
  });

  assert.equal(
    result.fullPrompt.includes('[Capability Truth Snapshot]'),
    true,
  );
  assert.equal(
    result.fullPrompt.includes('[Capability Boundary Answering Rules]'),
    true,
  );
  assert.equal(
    result.fullPrompt.includes(
      'workspaceSearch: registered executable skill, but this turn does not currently expose network research.',
    ),
    true,
  );
  assert.equal(
    result.fullPrompt.includes('已注册但本轮未开启'),
    true,
  );
  assert.equal(
    result.fullPrompt.includes('受治理门控'),
    true,
  );
  assert.equal(
    result.fullPrompt.includes('prefer a direct capability answer and avoid unnecessary skillCalls'),
    true,
  );
});
