import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStructuredCustomSkillWorkflow,
  resolveCustomSkillRoutePreset,
} from './custom-skill-workflow.ts';

test('resolveCustomSkillRoutePreset falls back to general', () => {
  const preset = resolveCustomSkillRoutePreset('unknown');
  assert.equal(preset.id, 'general');
  assert.equal(Array.isArray(preset.preferredSkills), true);
  assert.equal(preset.preferredSkills.length > 0, true);
});

test('buildStructuredCustomSkillWorkflow rebuilds weak workflow fields for the selected route', () => {
  const workflow = buildStructuredCustomSkillWorkflow({
    routeIntent: 'branding',
    summary: '高端护肤品牌 KV 与视觉系统推进',
    instruction: '先统一品牌调性和受众感知，再推进 KV 与视觉系统。',
    followUpMode: 'auto-clarify',
    currentConfig: {
      routeIntent: 'branding',
      clarifyChecklist: ['品牌调性', '受众定位', '视觉参考与应用场景'],
      reusableQuestions: ['请先补充品牌调性。'],
      executionOutline: ['先统一品牌调性和受众感知，再推进 KV 与视觉系统。'],
      executionRecipe: [],
      outputBlueprint: ['先整理品牌方向', '再输出视觉系统/KV建议'],
      toolPolicy: ['先按 品牌视觉 的工作流补齐关键输入，再进入执行。'],
    },
    forceWorkflowRefresh: true,
  });

  assert.equal(workflow.routeIntent, 'branding');
  assert.equal(workflow.followUpMode, 'auto-clarify');
  assert.equal(workflow.reusableQuestions.length > 0, true);
  assert.equal(workflow.reusableQuestions[0]?.includes('调性'), true);
  assert.equal(workflow.executionOutline.length >= 3, true);
  assert.equal(workflow.executionRecipe.length > 0, true);
  assert.equal(workflow.outputBlueprint[0]?.includes('品牌方向'), true);
  assert.equal(workflow.toolPolicy.length >= 2, true);
});

test('buildStructuredCustomSkillWorkflow preserves strong existing workflow fields when route does not change', () => {
  const workflow = buildStructuredCustomSkillWorkflow({
    routeIntent: 'social',
    summary: '社媒轮播工作流',
    instruction: '先定封面 hook 和页序，再拆每页资产。',
    followUpMode: 'direct-run',
    currentConfig: {
      routeIntent: 'social',
      reusableQuestions: ['这次封面最想打出的第一钩子是什么？'],
      executionOutline: ['先锁封面', '再拆页序', '最后给逐页执行单'],
      executionRecipe: [
        'always :: generateCopy :: 先稳定封面 hook 和页序',
        'visual-request :: generateImage :: 再按页职责分别出图',
      ],
      outputBlueprint: ['先给封面判断', '再逐页拆信息结构', '最后给执行建议'],
      toolPolicy: ['不要把整套轮播压成一张图。'],
    },
    forceWorkflowRefresh: false,
  });

  assert.deepEqual(workflow.reusableQuestions, ['这次封面最想打出的第一钩子是什么？']);
  assert.deepEqual(workflow.executionOutline, ['先锁封面', '再拆页序', '最后给逐页执行单']);
  assert.deepEqual(workflow.executionRecipe, [
    'always :: generateCopy :: 先稳定封面 hook 和页序',
    'visual-request :: generateImage :: 再按页职责分别出图',
  ]);
  assert.deepEqual(workflow.outputBlueprint, ['先给封面判断', '再逐页拆信息结构', '最后给执行建议']);
  assert.deepEqual(workflow.toolPolicy, ['不要把整套轮播压成一张图。']);
  assert.equal(workflow.followUpMode, 'direct-run');
});

test('buildStructuredCustomSkillWorkflow resets route-bound workflow when route changes', () => {
  const workflow = buildStructuredCustomSkillWorkflow({
    routeIntent: 'video',
    summary: '短视频广告 skill',
    instruction: '先稳住脚本与镜头推进，再做关键帧和视频。',
    currentConfig: {
      routeIntent: 'branding',
      reusableQuestions: ['这次品牌整体更偏什么调性？'],
      executionOutline: ['先统一品牌方向', '再推 KV'],
      executionRecipe: ['always :: generateCopy :: 先做品牌方向'],
      outputBlueprint: ['先给品牌方向', '再给 KV 建议'],
      toolPolicy: ['不要直接出图。'],
    },
    forceWorkflowRefresh: false,
  });

  assert.equal(workflow.routeIntent, 'video');
  assert.equal(workflow.reusableQuestions.some((item) => item.includes('视频')), true);
  assert.equal(workflow.executionRecipe.some((item) => item.includes('generateVideo')), true);
  assert.equal(workflow.outputBlueprint[0]?.includes('hook'), true);
});
