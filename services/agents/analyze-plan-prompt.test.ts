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

test('buildAnalyzePlanPrompt keeps unified sidebar agent prompt free of legacy role governance overlays', () => {
  const result = buildAnalyzePlanPrompt({
    agentId: 'coco',
    systemPrompt: '你是测试主脑。',
    preferredSkills: ['generateImage', 'workspaceSearch'],
    message: '继续处理这个侧边栏任务',
    context: {
      projectId: 'project-unified-sidebar-prompt',
      projectTitle: '统一侧边栏提示词测试',
      conversationId: 'conversation-unified-sidebar-prompt',
      existingAssets: [],
      conversationHistory: [],
    },
    metadata: {
      allowAutonomousRouting: true,
      skillData: {
        id: 'autonomous-main-brain',
        config: {
          allowAutonomousRouting: true,
          mode: 'unified-sidebar-agent',
        },
      },
      selectedRoleId: 'role-coco-pro',
      selectedRoleSource: 'user',
      baseAgentId: 'poster',
      roleGovernanceMode: 'approval_required',
      allowMainBrainRoleMutation: true,
      allowMainBrainRolePromotion: true,
    },
    forceImageToolCall: false,
    allowAutonomousRouting: true,
  });

  assert.equal(result.fullPrompt.includes('[Role Governance]'), false);
  assert.equal(result.fullPrompt.includes('# Runtime Role Layer'), false);
  assert.equal(result.fullPrompt.includes('selectedRoleId: role-coco-pro'), false);
  assert.equal(result.fullPrompt.includes('roleGovernanceMode: approval_required'), false);
  assert.equal(result.fullPrompt.includes('[Capability Truth Snapshot]'), true);
  assert.equal(result.fullPrompt.includes('workspaceSearch'), true);
});

test('buildAnalyzePlanPrompt injects reusable custom skill context for custom skills', () => {
  const result = buildAnalyzePlanPrompt({
    agentId: 'coco',
    systemPrompt: '你是测试主脑。',
    preferredSkills: ['generateImage', 'workspaceSearch'],
    message: '继续用这个 skill 帮我做一版新的方案',
    context: {
      projectId: 'project-custom-skill',
      projectTitle: '自定义 Skill 测试',
      conversationId: 'conversation-custom-skill',
      existingAssets: [],
      conversationHistory: [],
    },
    metadata: {
      allowAutonomousRouting: true,
      skillData: {
        id: 'custom-skill-001',
        name: '电商海报 Skill',
        config: {
          isCustomSkill: true,
          allowAutonomousRouting: true,
          mode: 'unified-sidebar-agent',
          summary: '先补齐卖点和受众，再整理成稳定的电商海报执行步骤。',
          instruction:
            '优先补齐商品信息、卖点、人群与场景，再输出可直接执行的海报方案与图像任务。',
          examplePrompt: '帮我基于这个商品图做一版胶原炮海报',
          sourceConversationTitle: '胶原炮海报项目',
        },
      },
    },
    forceImageToolCall: false,
    allowAutonomousRouting: true,
  });

  assert.equal(result.fullPrompt.includes('[Custom Skill Context]'), true);
  assert.equal(result.fullPrompt.includes('active custom skill: 电商海报 Skill'), true);
  assert.equal(result.fullPrompt.includes('reusable instruction:'), true);
  assert.equal(result.fullPrompt.includes('questioning style, sequencing, output structure'), true);
});
