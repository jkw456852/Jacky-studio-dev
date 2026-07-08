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
  assert.equal(result.fullPrompt.includes('[Single-Agent Execution Rules]'), true);
  assert.equal(result.fullPrompt.includes('handed off, routed, delegated, or transferred to Cameron'), true);
  assert.equal(result.fullPrompt.includes('[Specialist Agents: routing targets, not skillCalls]'), false);
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

test('buildAnalyzePlanPrompt injects workflow body for built-in frontstage skills', () => {
  const result = buildAnalyzePlanPrompt({
    agentId: 'coco',
    systemPrompt: 'test system prompt',
    preferredSkills: ['generateImage', 'generateCopy', 'workspaceSearch'],
    message: '继续按这个 skill 帮我推进一版品牌视觉方案',
    context: {
      projectId: 'project-frontstage-skill-workflow',
      projectTitle: 'Frontstage Skill Workflow Test',
      conversationId: 'conversation-frontstage-skill-workflow',
      existingAssets: [],
      conversationHistory: [],
    },
    metadata: {
      allowAutonomousRouting: true,
      skillData: {
        id: 'autonomous-main-brain',
        name: '品牌视觉',
        config: {
          allowAutonomousRouting: true,
          mode: 'unified-sidebar-agent',
          routeIntent: 'branding',
          routeLabel: 'Branding',
          description: '先统一品牌方向，再落到视觉系统与 KV。',
          instruction: '先统一品牌语气、受众和参考方向，再拆成可执行的视觉系统或 KV 方案。',
          examplePrompt: '帮我为这个护肤品牌做一版高端极简 KV。',
          successfulRuns: 2,
          lastSuccessfulPrompt: '帮我做一版高端极简的护肤品牌 KV。',
          lastSuccessfulSummary: '先确认品牌调性和受众，再输出 KV 方向。',
          lastSuccessfulOutput: '已输出品牌支柱、KV 方向与执行建议。',
          reusableQuestions: ['品牌现在更想强化什么气质？', '这次主要面向谁，落在哪些应用场景？'],
          executionOutline: ['先对齐品牌方向', '再定义视觉系统', '最后给 KV 与延展执行建议'],
          outputBlueprint: ['先给方向判断', '再给系统与 KV', '最后给落地建议'],
          toolPolicy: ['先用 generateCopy 稳定方向，再决定是否进入 generateImage。'],
        },
      },
    },
    forceImageToolCall: false,
    allowAutonomousRouting: true,
  });

  assert.equal(result.fullPrompt.includes('[Frontstage Skill Workflow]'), true);
  assert.equal(result.fullPrompt.includes('active frontstage skill: 品牌视觉'), true);
  assert.equal(result.fullPrompt.includes('summary: 先统一品牌方向，再落到视觉系统与 KV。'), true);
  assert.equal(result.fullPrompt.includes('example prompt: 帮我为这个护肤品牌做一版高端极简 KV。'), true);
  assert.equal(result.fullPrompt.includes('successful runs: 2'), true);
  assert.equal(result.fullPrompt.includes('last successful prompt: 帮我做一版高端极简的护肤品牌 KV。'), true);
  assert.equal(result.fullPrompt.includes('reusable clarify questions: 品牌现在更想强化什么气质？ | 这次主要面向谁，落在哪些应用场景？'), true);
  assert.equal(result.fullPrompt.includes('execution outline: 先对齐品牌方向 | 再定义视觉系统 | 最后给 KV 与延展执行建议'), true);
  assert.equal(result.fullPrompt.includes('tool policy: 先用 generateCopy 稳定方向，再决定是否进入 generateImage。'), true);
  assert.equal(result.fullPrompt.includes('Treat this selected frontstage skill as an active workflow contract'), true);
  assert.equal(result.fullPrompt.includes('reuse its decision pattern and output framing'), true);
});

test('buildAnalyzePlanPrompt includes autonomous routing bias for custom skills with frontstage execution hints', () => {
  const result = buildAnalyzePlanPrompt({
    agentId: 'coco',
    systemPrompt: 'test system prompt',
    preferredSkills: ['generateImage', 'generateCopy'],
    message: '继续用这个 skill 帮我做新一版品牌 KV',
    context: {
      projectId: 'project-custom-skill-routing',
      projectTitle: 'Custom Skill Routing Test',
      conversationId: 'conversation-custom-skill-routing',
      existingAssets: [],
      conversationHistory: [],
    },
    metadata: {
      allowAutonomousRouting: true,
      skillData: {
        id: 'custom-skill-brand-001',
        name: '品牌视觉 Skill',
        config: {
          isCustomSkill: true,
          allowAutonomousRouting: true,
          mode: 'unified-sidebar-agent',
          routeIntent: 'branding',
          routeLabel: 'Branding',
          routeSummary:
            'Bias toward visual systems, key visuals, and identity-aware execution.',
          followUpMode: 'auto-clarify',
          clarifyChecklist: ['品牌调性', '受众定位', '视觉参考'],
          preferredSkills: ['generateImage', 'generateCopy', 'workspaceSearch'],
          suggestedTaskMode: 'generate',
          summary: '先整理品牌语气与视觉系统，再推进 KV 与延展素材。',
          instruction: '优先补齐品牌调性、受众和核心卖点，再产出 KV 执行方案。',
        },
      },
    },
    forceImageToolCall: false,
    allowAutonomousRouting: true,
  });

  assert.equal(result.fullPrompt.includes('[Autonomous Skill Bias]'), true);
  assert.equal(result.fullPrompt.includes('selected frontstage skill: Branding'), true);
  assert.equal(result.fullPrompt.includes('route intent: branding'), true);
  assert.equal(result.fullPrompt.includes('follow-up mode: auto-clarify'), true);
  assert.equal(result.fullPrompt.includes('clarify checklist: 品牌调性, 受众定位, 视觉参考'), true);
  assert.equal(
    result.fullPrompt.includes(
      'preferred executable skills for this skill: generateImage, generateCopy, workspaceSearch',
    ),
    true,
  );
});

test('buildAnalyzePlanPrompt includes structured reusable seed fields for custom skills', () => {
  const result = buildAnalyzePlanPrompt({
    agentId: 'coco',
    systemPrompt: 'test system prompt',
    preferredSkills: ['generateImage'],
    message: '继续按这个 skill 推进一版新方案',
    context: {
      projectId: 'project-custom-skill-seed',
      projectTitle: 'Custom Skill Seed Test',
      conversationId: 'conversation-custom-skill-seed',
      existingAssets: [],
      conversationHistory: [],
    },
    metadata: {
      allowAutonomousRouting: true,
      skillData: {
        id: 'custom-skill-seed-001',
        name: 'Structured Skill',
        config: {
          isCustomSkill: true,
          allowAutonomousRouting: true,
          mode: 'unified-sidebar-agent',
          summary: '先补齐关键信息，再按既定步骤推进。',
          instruction: '先澄清缺失输入，再输出执行方案。',
          reusableQuestions: ['目标人群是谁？', '核心卖点是什么？'],
          executionOutline: ['先补齐卖点和人群', '再输出方案与任务'],
          outputBlueprint: ['先给分析', '再给执行建议'],
        },
      },
    },
    forceImageToolCall: false,
    allowAutonomousRouting: true,
  });

  assert.equal(result.fullPrompt.includes('reusable question patterns:'), true);
  assert.equal(result.fullPrompt.includes('execution outline:'), true);
  assert.equal(result.fullPrompt.includes('output blueprint:'), true);
});

test('buildAnalyzePlanPrompt injects successful custom skill memory for reuse', () => {
  const result = buildAnalyzePlanPrompt({
    agentId: 'coco',
    systemPrompt: 'test system prompt',
    preferredSkills: ['generateImage'],
    message: '继续按这个 skill 做一版新的社媒封面',
    context: {
      projectId: 'project-custom-skill-memory',
      projectTitle: 'Custom Skill Memory Test',
      conversationId: 'conversation-custom-skill-memory',
      existingAssets: [],
      conversationHistory: [],
    },
    metadata: {
      allowAutonomousRouting: true,
      skillData: {
        id: 'custom-skill-memory-001',
        name: '社媒内容 Skill',
        config: {
          isCustomSkill: true,
          allowAutonomousRouting: true,
          mode: 'unified-sidebar-agent',
          summary: '先补齐传播目标，再输出社媒内容方案。',
          lastSuccessfulPrompt: '帮我做一套新品发售社媒封面',
          lastSuccessfulSummary: '先确认平台和卖点，再输出封面方向与文案结构。',
          lastSuccessfulOutput: '已输出 3 张封面方向和对应文案结构。',
          successfulRuns: 3,
        },
      },
    },
    forceImageToolCall: false,
    allowAutonomousRouting: true,
  });

  assert.equal(result.fullPrompt.includes('successful runs: 3'), true);
  assert.equal(
    result.fullPrompt.includes('last successful prompt: 帮我做一套新品发售社媒封面'),
    true,
  );
  assert.equal(
    result.fullPrompt.includes('last successful summary: 先确认平台和卖点，再输出封面方向与文案结构。'),
    true,
  );
  assert.equal(
    result.fullPrompt.includes('reuse the successful decision pattern'),
    true,
  );
});

test('buildAnalyzePlanPrompt includes marker anchor details for marked image edit attachments', () => {
  const markerFile = {
    name: 'marker-annotated-1.png',
    type: 'image/png',
    markerName: 'Selection',
    markerInfo: {
      fullImageUrl: 'https://example.com/original.png',
      normalizedX: 0.48,
      normalizedY: 0.51,
      width: 300,
      height: 300,
    },
  } as any as File;

  const result = buildAnalyzePlanPrompt({
    agentId: 'coco',
    systemPrompt: 'test system prompt',
    preferredSkills: ['smartEdit'],
    message: '帮我修改这张图，在狗鼻子位置加一只蝴蝶',
    context: {
      projectId: 'project-marker-prompt',
      projectTitle: 'Marker Prompt Test',
      conversationId: 'conversation-marker-prompt',
      existingAssets: [],
      conversationHistory: [],
    },
    attachments: [markerFile],
    uploadedAttachments: ['https://example.com/annotated.png'],
    metadata: {},
    forceImageToolCall: false,
    allowAutonomousRouting: true,
  });

  assert.equal(result.fullPrompt.includes('[Smart Edit Rules]'), true);
  assert.equal(result.fullPrompt.includes('exact user-selected edit anchor'), true);
  assert.equal(result.fullPrompt.includes('48% from the left'), true);
  assert.equal(result.fullPrompt.includes('51% from the top'), true);
  assert.equal(result.fullPrompt.includes('https://example.com/original.png'), true);
  assert.equal(result.fullPrompt.includes('https://example.com/annotated.png'), true);
});

test('buildAnalyzePlanPrompt includes execution recipe lines for frontstage workflows', () => {
  const result = buildAnalyzePlanPrompt({
    agentId: 'coco',
    systemPrompt: 'test system prompt',
    preferredSkills: ['generateImage', 'generateVideo'],
    message: 'Continue with this video workflow.',
    context: {
      projectId: 'project-frontstage-execution-recipe',
      projectTitle: 'Frontstage Execution Recipe Test',
      conversationId: 'conversation-frontstage-execution-recipe',
      existingAssets: [],
      conversationHistory: [],
    },
    metadata: {
      allowAutonomousRouting: true,
      skillData: {
        id: 'autonomous-main-brain',
        name: 'Video Workflow',
        config: {
          allowAutonomousRouting: true,
          mode: 'unified-sidebar-agent',
          routeIntent: 'video',
          routeLabel: 'Short Video',
          instruction: 'Lock hook and pacing before final video generation.',
          executionOutline: ['Define hook', 'Create keyframe', 'Render final video'],
          executionRecipe: [
            'visual-request :: generateImage :: Create keyframes first',
            'final-video :: generateVideo :: Render final video after keyframes',
          ],
          outputBlueprint: ['Hook', 'Storyboard', 'Video delivery'],
        },
      },
    },
    forceImageToolCall: false,
    allowAutonomousRouting: true,
  });

  assert.equal(result.fullPrompt.includes('execution recipe:'), true);
  assert.equal(result.fullPrompt.includes('Create keyframes first'), true);
  assert.equal(
    result.fullPrompt.includes(
      'If you output multiple skillCalls, order them according to the execution recipe',
    ),
    true,
  );
});
