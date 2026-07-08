import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatMessage } from '../../types';
import {
  distillCustomSkillFromConversation,
  extractLatestSuccessfulSkillRunSnapshot,
} from './custom-skill-distiller.ts';

const sampleConversation: ChatMessage[] = [
  {
    id: 'u1',
    role: 'user',
    text: 'Help me create a premium skincare brand KV for women 28-40.',
    timestamp: Date.now(),
  },
  {
    id: 'm1',
    role: 'model',
    text: 'Before we execute, should the tone feel luxury-minimal or clinical-tech? Any reference brands?',
    timestamp: Date.now() + 1,
  },
  {
    id: 'u2',
    role: 'user',
    text: 'Luxury-minimal. Think restrained, glossy, high-end.',
    timestamp: Date.now() + 2,
  },
  {
    id: 'm2',
    role: 'model',
    text: 'Great. First I will align brand direction, then define the KV structure, then turn it into an execution-ready visual plan.',
    timestamp: Date.now() + 3,
  },
];

test('distillCustomSkillFromConversation uses model-distilled execution recipe when available', async () => {
  const seed = await distillCustomSkillFromConversation({
    conversationTitle: 'Skincare Brand KV',
    recentMessages: sampleConversation,
    generate: async () =>
      JSON.stringify({
        name: 'Skincare Brand KV Skill',
        summary: 'Reusable workflow for premium skincare KV tasks.',
        routeIntent: 'branding',
        followUpMode: 'auto-clarify',
        activationHint: 'Best for premium brand KV and visual system tasks.',
        instruction: 'Clarify brand tone, audience, and references first, then output an execution-ready KV plan.',
        clarifyChecklist: ['brand tone', 'audience', 'references'],
        reusableQuestions: ['Should the tone feel luxury-minimal or clinical-tech?'],
        executionOutline: ['Align direction', 'Define KV structure', 'Ship execution plan'],
        executionRecipe: [
          'always :: none :: Align brand direction before visuals',
          'visual-request :: generateImage :: Validate one KV direction at a time',
        ],
        outputBlueprint: ['Direction judgment', 'KV structure', 'Execution next steps'],
        toolPolicy: ['Do not skip direction alignment before visuals.'],
      }),
  });

  assert.equal(seed.name, 'Skincare Brand KV Skill');
  assert.equal(seed.routeIntent, 'branding');
  assert.equal(seed.followUpMode, 'auto-clarify');
  assert.equal(seed.executionRecipe.length, 2);
  assert.equal(seed.executionRecipe[0], 'always :: none :: Align brand direction before visuals');
  assert.equal(seed.sourceConversationTitle, 'Skincare Brand KV');
  assert.equal(
    seed.sourceUserPrompt,
    'Help me create a premium skincare brand KV for women 28-40.',
  );
});

test('distillCustomSkillFromConversation falls back to heuristic execution recipe when generator fails', async () => {
  const seed = await distillCustomSkillFromConversation({
    conversationTitle: 'Skincare Brand KV',
    recentMessages: sampleConversation,
    generate: async () => {
      throw new Error('upstream unavailable');
    },
  });

  assert.equal(seed.routeIntent, 'branding');
  assert.equal(seed.executionOutline.length > 0, true);
  assert.equal(seed.executionRecipe.length > 0, true);
  assert.equal(seed.toolPolicy.length > 0, true);
});

test('distillCustomSkillFromConversation uses heuristic fallback for too-short conversations', async () => {
  const seed = await distillCustomSkillFromConversation({
    conversationTitle: 'Short Video',
    recentMessages: [
      {
        id: 'u1',
        role: 'user',
        text: 'Help me create a short video storyboard.',
        timestamp: Date.now(),
      },
    ],
  });

  assert.equal(seed.routeIntent, 'video');
  assert.equal(seed.examplePrompt, 'Help me create a short video storyboard.');
  assert.equal(seed.executionRecipe.length > 0, true);
  assert.equal(seed.name.includes('Skill'), true);
});

test('distillCustomSkillFromConversation reuses latest successful execution evidence when available', async () => {
  const recentMessages: ChatMessage[] = [
    {
      id: 'u1',
      role: 'user',
      text: '给我做一组 7 页的小红书轮播，主题是抗老护肤误区。',
      timestamp: Date.now(),
    },
    {
      id: 'm1',
      role: 'model',
      text: '先确认页数、封面 hook 和每页职责。',
      timestamp: Date.now() + 1,
    },
    {
      id: 'u2',
      role: 'user',
      text: '就按 7 页推进，封面想要冲击感。',
      timestamp: Date.now() + 2,
    },
    {
      id: 'm2',
      role: 'model',
      text: '我已经按轮播工作流拆好了封面、页序和每页信息结构。',
      timestamp: Date.now() + 3,
      responseToMessageId: 'u2',
      agentData: {
        analysis: '先锁封面 hook，再稳定页序和每页角色。',
        postGenerationSummary: '已输出轮播主线、逐页结构和结尾 CTA。',
        skillCalls: [
          {
            skillName: 'generateCopy',
            success: true,
            description: '稳定轮播页序和文案骨架',
          },
          {
            skillName: 'generateImage',
            success: true,
            description: '按页面职责分别验证视觉方向',
          },
        ],
      },
    },
  ];

  const seed = await distillCustomSkillFromConversation({
    conversationTitle: '抗老轮播',
    recentMessages,
    generate: async () => {
      throw new Error('force heuristic fallback');
    },
  });

  assert.equal(seed.sourceUserPrompt, '就按 7 页推进，封面想要冲击感。');
  assert.equal(seed.executionRecipe[0], 'always :: generateCopy :: 稳定轮播页序和文案骨架');
  assert.equal(
    seed.executionRecipe[1],
    'visual-request :: generateImage :: 按页面职责分别验证视觉方向',
  );
  assert.equal(seed.toolPolicy.some((item) => item.includes('先稳定脚本、结构或文案骨架')), true);
});

test('extractLatestSuccessfulSkillRunSnapshot returns latest successful execution payload', () => {
  const messages: ChatMessage[] = [
    {
      id: 'u1',
      role: 'user',
      text: '帮我做品牌 KV。',
      timestamp: Date.now(),
    },
    {
      id: 'm1',
      role: 'model',
      text: '已输出品牌方向、KV 结构和执行建议。',
      timestamp: Date.now() + 1,
      responseToMessageId: 'u1',
      agentData: {
        analysis: '先统一品牌方向，再定义 KV 结构。',
        postGenerationSummary: '已输出品牌方向和 KV 执行框架。',
      },
    },
  ];

  const snapshot = extractLatestSuccessfulSkillRunSnapshot(messages);
  assert.equal(snapshot?.prompt, '帮我做品牌 KV。');
  assert.equal(snapshot?.summary, '已输出品牌方向和 KV 执行框架。');
  assert.equal(snapshot?.outputText, '已输出品牌方向、KV 结构和执行建议。');
});
