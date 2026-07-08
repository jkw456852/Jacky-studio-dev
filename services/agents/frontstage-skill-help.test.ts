import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFrontstageSkillHelpResponse,
  isFrontstageSkillHelpRequest,
} from './frontstage-skill-help.ts';

test('isFrontstageSkillHelpRequest recognizes common skill help phrasing', () => {
  assert.equal(isFrontstageSkillHelpRequest('这个 skill 能干嘛'), true);
  assert.equal(isFrontstageSkillHelpRequest('介绍一下这个技能怎么用'), true);
  assert.equal(isFrontstageSkillHelpRequest('帮我做一版海报'), false);
});

test('buildFrontstageSkillHelpResponse returns productized guidance for active frontstage skills', () => {
  const result = buildFrontstageSkillHelpResponse({
    message: '这个 skill 能干嘛',
    metadata: {
      allowAutonomousRouting: true,
      skillData: {
        id: 'autonomous-main-brain',
        name: '创意脑暴',
        iconName: 'Lightbulb',
        config: {
          allowAutonomousRouting: true,
          mode: 'unified-sidebar-agent',
          frontstageSkillId: 'creative-brainstorm-studio',
          routeLabel: 'Brainstorm',
          routeSummary:
            'Bias toward divergent concepts, naming routes, hook generation, concept clustering, and choosing the best route before production.',
          preferredSkills: ['generateCopy', 'workspaceSearch', 'generateImage'],
          followUpMode: 'auto-clarify',
          clarifyChecklist: ['想解决的核心问题', '希望最终落到什么载体', '有没有必须保留或避开的元素'],
          executionOutline: ['先定义问题', '再发散 3-5 条路线', '最后推荐一条继续推进'],
          outputBlueprint: ['先给脑暴目标', '再给路线比较', '最后给推荐路径'],
          toolPolicy: ['只在明确需要竞品或趋势时才联网'],
          examplePrompt:
            '我要给一个“城市夜间修复”主题的护肤 campaign 做前期脑暴。请先拉出 3 到 5 条可比较的创意路线。',
        },
      },
    } as any,
  });

  assert.ok(result);
  assert.equal(result?.message.includes('当前选中的是「创意脑暴」'), true);
  assert.equal(result?.message.includes('通常会这样推进'), true);
  assert.equal(result?.message.includes('它会优先调度'), true);
  assert.equal(result?.message.includes('你可以直接这样开'), true);
  assert.equal(Array.isArray(result?.suggestions), true);
});

test('buildFrontstageSkillHelpResponse returns null when no active autonomous skill exists', () => {
  const result = buildFrontstageSkillHelpResponse({
    message: '这个 skill 能干嘛',
    metadata: {
      allowAutonomousRouting: false,
    } as any,
  });

  assert.equal(result, null);
});
