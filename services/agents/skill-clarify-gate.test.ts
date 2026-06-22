import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateSkillClarifyGate } from './skill-clarify-gate.ts';

test('evaluateSkillClarifyGate asks for missing checklist items when skill is auto-clarify', () => {
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

test('evaluateSkillClarifyGate passes through when message already covers checklist and has references', () => {
  const result = evaluateSkillClarifyGate({
    message: '帮我做品牌 KV，品牌调性是高级极简，目标人群是 25-35 岁女性，参考就按我附图走',
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
