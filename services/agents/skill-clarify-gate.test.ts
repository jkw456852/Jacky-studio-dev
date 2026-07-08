import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateSkillClarifyGate } from './skill-clarify-gate.ts';

test('evaluateSkillClarifyGate asks for missing checklist items when actionable request is under-specified', () => {
  const result = evaluateSkillClarifyGate({
    message: '帮我做一版新的品牌 KV',
    attachments: [],
    metadata: {
      allowAutonomousRouting: true,
      skillFollowUpMode: 'auto-clarify',
      skillClarifyChecklist: ['品牌调性', '受众定位', '视觉参考'],
      skillData: {
        id: 'custom-brand-skill',
        config: {
          followUpMode: 'auto-clarify',
          clarifyChecklist: ['品牌调性', '受众定位', '视觉参考'],
        },
      },
    } as any,
  });

  assert.equal(result.shouldClarify, true);
  if (!result.shouldClarify) return;
  assert.equal(result.questions.length > 0, true);
  assert.equal(result.missingChecklist.includes('品牌调性'), true);
});

test('evaluateSkillClarifyGate prefers reusable question templates when available', () => {
  const result = evaluateSkillClarifyGate({
    message: '帮我继续做新的品牌 KV',
    attachments: [],
    metadata: {
      allowAutonomousRouting: true,
      skillFollowUpMode: 'auto-clarify',
      skillClarifyChecklist: ['品牌调性', '受众定位'],
      skillData: {
        id: 'custom-brand-skill',
        config: {
          followUpMode: 'auto-clarify',
          clarifyChecklist: ['品牌调性', '受众定位'],
          reusableQuestions: ['这次品牌调性更偏高级极简还是更偏科技感？', '这次目标受众主要是谁？'],
        },
      },
    } as any,
  });

  assert.equal(result.shouldClarify, true);
  if (!result.shouldClarify) return;
  assert.equal(result.questions.includes('这次品牌调性更偏高级极简还是更偏科技感？'), true);
});

test('evaluateSkillClarifyGate uses successful-run memory when reusable questions are absent', () => {
  const result = evaluateSkillClarifyGate({
    message: '帮我继续做新的 KV 方案',
    attachments: [],
    metadata: {
      allowAutonomousRouting: true,
      skillFollowUpMode: 'auto-clarify',
      skillClarifyChecklist: ['品牌调性', '受众定位'],
      skillData: {
        id: 'custom-brand-skill',
        config: {
          followUpMode: 'auto-clarify',
          clarifyChecklist: ['品牌调性', '受众定位'],
          lastSuccessfulPrompt: '帮我做一版高级极简的品牌 KV',
          lastSuccessfulSummary: '上次先确认品牌调性和目标受众，再输出 KV 方向。',
          lastSuccessfulOutput: '已输出 KV 方向与文案结构。',
        },
      },
    } as any,
  });

  assert.equal(result.shouldClarify, true);
  if (!result.shouldClarify) return;
  assert.equal(
    result.questions.some((question) => question.includes('上次') && question.includes('关键输入')),
    true,
  );
  assert.equal(
    result.suggestions.some((suggestion) => suggestion.includes('上次跑通这个 Skill')),
    true,
  );
});

test('evaluateSkillClarifyGate passes through when message already covers checklist and has references', () => {
  const result = evaluateSkillClarifyGate({
    message: '帮我做品牌 KV，品牌调性是高级极简，目标人群是 25-35 岁女性，参考就按我附图走。',
    attachments: [{} as File],
    metadata: {
      allowAutonomousRouting: true,
      skillFollowUpMode: 'auto-clarify',
      skillClarifyChecklist: ['品牌调性', '受众定位', '视觉参考'],
      skillData: {
        id: 'custom-brand-skill',
        config: {
          followUpMode: 'auto-clarify',
          clarifyChecklist: ['品牌调性', '受众定位', '视觉参考'],
        },
      },
    } as any,
  });

  assert.deepEqual(result, { shouldClarify: false });
});

test('evaluateSkillClarifyGate does not intercept contextual image edit follow-ups when prior image context exists', () => {
  const result = evaluateSkillClarifyGate({
    message: '其余不变就衣服换成泳装',
    attachments: [],
    conversationHistory: [
      {
        id: 'm1',
        role: 'model',
        text: '上一张图已生成',
        agentData: {
          imageUrls: ['https://example.com/generated-image.png'],
        },
        timestamp: Date.now() - 2000,
      },
    ] as any,
    metadata: {
      allowAutonomousRouting: true,
      skillFollowUpMode: 'auto-clarify',
      skillClarifyChecklist: ['视觉参考图', '风格方向'],
      multimodalContext: {
        referenceImageUrls: ['https://example.com/generated-image.png'],
      },
      skillData: {
        id: 'custom-image-skill',
        config: {
          followUpMode: 'auto-clarify',
          clarifyChecklist: ['视觉参考图', '风格方向'],
        },
      },
    } as any,
  });

  assert.deepEqual(result, { shouldClarify: false });
});

test('evaluateSkillClarifyGate reuses recent conversation answers instead of re-asking the same checklist items', () => {
  const result = evaluateSkillClarifyGate({
    message: '那就按这个方向继续做',
    attachments: [],
    conversationHistory: [
      {
        id: 'u1',
        role: 'user',
        text: '品牌调性走高级极简，目标人群是 25-35 岁女性',
        timestamp: Date.now() - 1000,
      },
    ] as any,
    metadata: {
      allowAutonomousRouting: true,
      skillFollowUpMode: 'auto-clarify',
      skillClarifyChecklist: ['品牌调性', '受众定位'],
      skillData: {
        id: 'custom-brand-skill',
        config: {
          followUpMode: 'auto-clarify',
          clarifyChecklist: ['品牌调性', '受众定位'],
        },
      },
    } as any,
  });

  assert.deepEqual(result, { shouldClarify: false });
});

test('evaluateSkillClarifyGate treats recent conversation attachments as valid reference evidence', () => {
  const result = evaluateSkillClarifyGate({
    message: '继续往下做就行',
    attachments: [],
    conversationHistory: [
      {
        id: 'u1',
        role: 'user',
        text: '参考就按我刚发的图走',
        attachments: ['https://example.com/reference.png'],
        timestamp: Date.now() - 1000,
      },
    ] as any,
    metadata: {
      allowAutonomousRouting: true,
      skillFollowUpMode: 'auto-clarify',
      skillClarifyChecklist: ['视觉参考'],
      skillData: {
        id: 'custom-brand-skill',
        config: {
          followUpMode: 'auto-clarify',
          clarifyChecklist: ['视觉参考'],
        },
      },
    } as any,
  });

  assert.deepEqual(result, { shouldClarify: false });
});

test('evaluateSkillClarifyGate does not intercept skill help questions', () => {
  const result = evaluateSkillClarifyGate({
    message: '这个 skill 能干嘛',
    attachments: [],
    metadata: {
      allowAutonomousRouting: true,
      skillFollowUpMode: 'auto-clarify',
      skillClarifyChecklist: ['想解决的核心问题', '希望最终落到什么载体', '有没有必须保留或避开的元素'],
      skillData: {
        id: 'creative-brainstorm-studio',
        config: {
          followUpMode: 'auto-clarify',
          clarifyChecklist: ['想解决的核心问题', '希望最终落到什么载体', '有没有必须保留或避开的元素'],
        },
      },
    } as any,
  });

  assert.deepEqual(result, { shouldClarify: false });
});

test('evaluateSkillClarifyGate treats a concrete generic brief as sufficient for brainstorm skills', () => {
  const result = evaluateSkillClarifyGate({
    message:
      '帮我做一个城市夜间修复主题的护肤 campaign 脑暴，最后要落到品牌和海报方向，保留都市夜色和修复感，不要廉价医美感。',
    attachments: [],
    metadata: {
      allowAutonomousRouting: true,
      skillFollowUpMode: 'auto-clarify',
      skillClarifyChecklist: ['想解决的核心问题', '希望最终落到什么载体', '有没有必须保留或避开的元素'],
      skillData: {
        id: 'creative-brainstorm-studio',
        config: {
          followUpMode: 'auto-clarify',
          clarifyChecklist: ['想解决的核心问题', '希望最终落到什么载体', '有没有必须保留或避开的元素'],
        },
      },
    } as any,
  });

  assert.deepEqual(result, { shouldClarify: false });
});

test('evaluateSkillClarifyGate allows execution when only one non-critical generic checklist item is missing', () => {
  const result = evaluateSkillClarifyGate({
    message: '帮我做护肤 campaign 脑暴，想解决方向发散问题，先落到品牌方向。',
    attachments: [],
    metadata: {
      allowAutonomousRouting: true,
      skillFollowUpMode: 'auto-clarify',
      skillClarifyChecklist: ['想解决的核心问题', '希望最终落到什么载体', '有没有必须保留或避开的元素'],
      skillData: {
        id: 'creative-brainstorm-studio',
        config: {
          followUpMode: 'auto-clarify',
          clarifyChecklist: ['想解决的核心问题', '希望最终落到什么载体', '有没有必须保留或避开的元素'],
        },
      },
    } as any,
  });

  assert.deepEqual(result, { shouldClarify: false });
});
