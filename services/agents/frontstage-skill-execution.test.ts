import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hydrateSkillCallWithFrontstageProfile,
  isFrontstageSkillMetaQuestion,
  mergePreferredSkillsWithFrontstageProfile,
  prioritizeSkillCallsForFrontstageProfile,
  repairAutonomousSkillPlan,
  resolveFrontstageSkillExecutionProfile,
  shouldBypassAutonomousChatSuppression,
  shouldExecuteFrontstageSkillSequentially,
} from './frontstage-skill-execution.ts';

test('resolveFrontstageSkillExecutionProfile reads active config and default execution recipe', () => {
  const profile = resolveFrontstageSkillExecutionProfile({
    allowAutonomousRouting: true,
    skillData: {
      id: 'autonomous-main-brain',
      name: 'Branding',
      config: {
        frontstageSkillId: 'autonomous-brand-system',
        routeIntent: 'branding',
        routeLabel: 'Branding',
        followUpMode: 'direct-run',
        preferredSkills: ['generateImage', 'workspaceSearch'],
        toolPolicy: ['Only use workspaceSearch when explicit.'],
        suggestedTaskMode: 'generate',
        isCustomSkill: true,
      },
    },
  } as any);

  assert.equal(profile.active, true);
  assert.equal(profile.frontstageSkillId, 'autonomous-brand-system');
  assert.equal(profile.routeIntent, 'branding');
  assert.equal(profile.followUpMode, 'direct-run');
  assert.deepEqual(profile.preferredSkills, ['generateImage', 'workspaceSearch']);
  assert.equal(profile.requiresResearchOptIn, true);
  assert.equal(profile.isCustomSkill, true);
  assert.equal(profile.executionRecipe.length > 0, true);
});

test('mergePreferredSkillsWithFrontstageProfile prepends selected skill preferences', () => {
  const merged = mergePreferredSkillsWithFrontstageProfile(
    ['generateCopy', 'generateImage', 'generateVideo'],
    {
      allowAutonomousRouting: true,
      skillData: {
        id: 'autonomous-main-brain',
        config: {
          preferredSkills: ['workspaceSearch', 'generateImage'],
        },
      },
    } as any,
  );

  assert.deepEqual(merged, [
    'workspaceSearch',
    'generateImage',
    'generateCopy',
    'generateVideo',
  ]);
});

test('prioritizeSkillCallsForFrontstageProfile follows execution recipe order before preferred skill order', () => {
  const prioritized = prioritizeSkillCallsForFrontstageProfile(
    [
      { skillName: 'generateVideo', params: {} },
      { skillName: 'generateImage', params: {} },
    ],
    {
      allowAutonomousRouting: true,
      skillData: {
        id: 'autonomous-main-brain',
        config: {
          routeIntent: 'video',
          preferredSkills: ['generateVideo', 'generateImage'],
          executionRecipe: [
            'visual-request :: generateImage :: Generate keyframes first',
            'final-video :: generateVideo :: Render final video after keyframes',
          ],
        },
      },
    } as any,
  );

  assert.deepEqual(
    prioritized.map((item) => item.skillName),
    ['generateImage', 'generateVideo'],
  );
});

test('prioritizeSkillCallsForFrontstageProfile removes workspaceSearch when turn-level web search is disabled', () => {
  const prioritized = prioritizeSkillCallsForFrontstageProfile(
    [
      { skillName: 'workspaceSearch', params: { query: 'latest beauty campaign trends' } },
      { skillName: 'generateImage', params: { prompt: 'Create the KV' } },
    ],
    {
      allowAutonomousRouting: true,
      enableWebSearch: false,
      skillData: {
        id: 'autonomous-main-brain',
        config: {
          routeIntent: 'branding',
          preferredSkills: ['workspaceSearch', 'generateImage'],
        },
      },
    } as any,
  );

  assert.deepEqual(
    prioritized.map((item) => item.skillName),
    ['generateImage'],
  );
});

test('repairAutonomousSkillPlan injects keyframe plus video fallback for direct-run video skills', () => {
  const repaired = repairAutonomousSkillPlan({
    plan: {
      analysis: '',
      message: '',
      skillCalls: [],
    },
    originalMessage: 'Continue this skill and create a new short video ad.',
    attachments: [],
    metadata: {
      allowAutonomousRouting: true,
      taskMode: 'generate',
      skillData: {
        id: 'custom-skill-video',
        config: {
          isCustomSkill: true,
          routeIntent: 'video',
          followUpMode: 'direct-run',
          preferredSkills: ['generateVideo', 'generateImage'],
        },
      },
    } as any,
  });

  assert.equal(Array.isArray(repaired.skillCalls), true);
  assert.deepEqual(
    repaired.skillCalls.map((item: any) => item.skillName),
    ['generateImage', 'generateVideo'],
  );
  assert.match(String(repaired.preGenerationMessage), /开始处理|继续执行|生成流程/i);
});

test('repairAutonomousSkillPlan can direct-run selected skill during ordinary chat when request is executable', () => {
  const repaired = repairAutonomousSkillPlan({
    plan: {
      analysis: '',
      message: '',
      skillCalls: [],
    },
    originalMessage: '继续做这个短视频广告，先把关键帧和视频都跑起来。',
    attachments: [],
    metadata: {
      allowAutonomousRouting: true,
      taskMode: 'chat',
      skillData: {
        id: 'custom-skill-video',
        config: {
          isCustomSkill: true,
          routeIntent: 'video',
          followUpMode: 'direct-run',
          preferredSkills: ['generateCopy', 'generateImage', 'generateVideo'],
          executionRecipe: [
            'always :: generateCopy :: Stabilize hook and shot structure first',
            'visual-request :: generateImage :: Generate keyframes first',
            'final-video :: generateVideo :: Render final video after keyframes',
          ],
        },
      },
    } as any,
  });

  assert.deepEqual(
    repaired.skillCalls.map((item: any) => item.skillName),
    ['generateCopy', 'generateImage', 'generateVideo'],
  );
});

test('repairAutonomousSkillPlan backfills missing prerequisite recipe steps into an existing plan', () => {
  const repaired = repairAutonomousSkillPlan({
    plan: {
      analysis: '',
      message: '',
      skillCalls: [
        {
          skillName: 'generateVideo',
          params: {
            prompt: 'Create the final short ad video.',
          },
        },
      ],
    },
    originalMessage: 'Continue this short video skill and make the final ad video.',
    attachments: [],
    metadata: {
      allowAutonomousRouting: true,
      taskMode: 'chat',
      skillData: {
        id: 'custom-skill-video',
        config: {
          isCustomSkill: true,
          routeIntent: 'video',
          followUpMode: 'direct-run',
          preferredSkills: ['generateCopy', 'generateImage', 'generateVideo'],
          executionRecipe: [
            'always :: generateCopy :: Stabilize hook and shot structure first',
            'visual-request :: generateImage :: Generate keyframes first',
            'final-video :: generateVideo :: Render final video after keyframes',
          ],
        },
      },
    } as any,
  });

  assert.deepEqual(
    repaired.skillCalls.map((item: any) => item.skillName),
    ['generateCopy', 'generateImage', 'generateVideo'],
  );
  assert.match(String(repaired.preGenerationMessage || ''), /missing prerequisite steps/i);
});

test('repairAutonomousSkillPlan avoids blocked final video fallback inferred from tool policy', () => {
  const repaired = repairAutonomousSkillPlan({
    plan: {
      skillCalls: [],
    },
    originalMessage: 'Continue this skill and create a new ad video.',
    attachments: [],
    metadata: {
      allowAutonomousRouting: true,
      taskMode: 'generate',
      skillData: {
        id: 'custom-skill-video',
        config: {
          isCustomSkill: true,
          routeIntent: 'video',
          followUpMode: 'direct-run',
          preferredSkills: ['generateVideo', 'generateImage'],
          toolPolicy: ['不要一上来直接出成片。'],
        },
      },
    } as any,
  });

  assert.deepEqual(
    repaired.skillCalls.map((item: any) => item.skillName),
    ['generateImage'],
  );
});

test('hydrateSkillCallWithFrontstageProfile injects workflow contract and upstream image refs into video calls', () => {
  const hydrated = hydrateSkillCallWithFrontstageProfile({
    call: {
      skillName: 'generateVideo',
      params: {
        prompt: 'Create the final premium ad video.',
      },
    },
    metadata: {
      allowAutonomousRouting: true,
      skillData: {
        id: 'custom-skill-video',
        name: 'Video Workflow',
        config: {
          routeIntent: 'video',
          routeLabel: 'Short Video',
          routeSummary: 'Bias toward hooks, pacing, and publish-ready short video output.',
          instruction: 'Lock hook and pacing before final video generation.',
          executionOutline: ['Define hook', 'Generate keyframe', 'Render video'],
          executionRecipe: [
            'visual-request :: generateImage :: Generate keyframes first',
            'final-video :: generateVideo :: Render final video after keyframes',
          ],
          outputBlueprint: ['Hook', 'Storyboard', 'Video delivery'],
        },
      },
    } as any,
    originalMessage: 'Create the final premium ad video.',
    priorResults: [
      {
        skillName: 'workspaceSearch',
        success: true,
        result: {
          summary: 'Collected premium skincare ad references.',
        },
      },
      {
        skillName: 'generateImage',
        success: true,
        result: 'https://example.com/keyframe.png',
      },
    ],
  });

  assert.equal(
    String(hydrated.params?.prompt || '').includes('[Frontstage Skill Contract]'),
    true,
  );
  assert.equal(
    (hydrated.params?.referenceImages as string[] | undefined)?.includes(
      'https://example.com/keyframe.png',
    ),
    true,
  );
  assert.equal(hydrated.params?.startFrame, 'https://example.com/keyframe.png');
});

test('hydrateSkillCallWithFrontstageProfile injects workflow contract into generateCopy calls', () => {
  const hydrated = hydrateSkillCallWithFrontstageProfile({
    call: {
      skillName: 'generateCopy',
      params: {
        prompt: 'Write the hook and page-by-page outline.',
      },
    },
    metadata: {
      allowAutonomousRouting: true,
      skillData: {
        id: 'custom-skill-social',
        name: 'Carousel Workflow',
        config: {
          routeIntent: 'social',
          routeLabel: 'Carousel',
          routeSummary: 'Bias toward hook-first multi-slide storytelling.',
          instruction: 'Lock cover hook and page order before visuals.',
          executionRecipe: [
            'always :: generateCopy :: Stabilize hook and page sequence first',
            'visual-request :: generateImage :: Generate per-page visuals after copy',
          ],
        },
      },
    } as any,
    originalMessage: '做一套社媒轮播图。',
  });

  assert.equal(
    String(hydrated.params?.prompt || '').includes('[Frontstage Skill Contract]'),
    true,
  );
});

test('hydrateSkillCallWithFrontstageProfile keeps generateImage prompts free of frontstage contract wrappers', () => {
  const hydrated = hydrateSkillCallWithFrontstageProfile({
    call: {
      skillName: 'generateImage',
      params: {
        prompt: 'Create a premium poolside cosplay portrait, full body, daylight, 3:4.',
      },
    },
    metadata: {
      allowAutonomousRouting: true,
      skillData: {
        id: 'custom-skill-brand',
        name: 'Brand Visual',
        config: {
          routeIntent: 'branding',
          routeLabel: 'Brand Visual',
          routeSummary: 'Bias toward premium lifestyle visuals.',
          instruction: 'Keep the visual clean and commercial.',
          executionRecipe: [
            'visual-request :: generateImage :: Generate the hero visual',
          ],
        },
      },
    } as any,
    originalMessage: 'Create a premium poolside cosplay portrait, full body, daylight, 3:4.',
  });

  assert.equal(
    String(hydrated.params?.prompt || '').includes('[Frontstage Skill Contract]'),
    false,
  );
  assert.match(String(hydrated.params?.prompt || ''), /Create a premium poolside cosplay portrait/);
  assert.match(String(hydrated.params?.prompt || ''), /Creative focus:/);
});

test('hydrateSkillCallWithFrontstageProfile strips inherited frontstage contract wrappers from generateImage prompts', () => {
  const hydrated = hydrateSkillCallWithFrontstageProfile({
    call: {
      skillName: 'generateImage',
      params: {
        prompt: `[Frontstage Skill Contract]
Skill: Brand Visual
Instruction: Keep the visual clean and commercial.

[Current Request]
Create a premium poolside cosplay portrait, full body, daylight, 3:4.`,
      },
    },
    metadata: {
      allowAutonomousRouting: true,
      skillData: {
        id: 'custom-skill-brand',
        name: 'Brand Visual',
        config: {
          routeIntent: 'branding',
          routeLabel: 'Brand Visual',
          routeSummary: 'Bias toward premium lifestyle visuals.',
          instruction: 'Keep the visual clean and commercial.',
        },
      },
    } as any,
    originalMessage: 'Create a premium poolside cosplay portrait, full body, daylight, 3:4.',
  });

  assert.equal(
    String(hydrated.params?.prompt || '').includes('[Frontstage Skill Contract]'),
    false,
  );
  assert.equal(
    String(hydrated.params?.prompt || '').includes('[Current Request]'),
    false,
  );
  assert.match(String(hydrated.params?.prompt || ''), /Create a premium poolside cosplay portrait/);
});

test('repairAutonomousSkillPlan fallback generateImage extracts explicit ratio and size from message', () => {
  const repaired = repairAutonomousSkillPlan({
    plan: {},
    originalMessage: '生成一张亚洲年轻美女图，日式樱花妹的感觉的，9:16，4K分辨率',
    metadata: {
      allowAutonomousRouting: true,
      skillData: {
        id: 'custom-skill-brand',
        config: {
          routeIntent: 'branding',
          routeLabel: '品牌视觉',
          followUpMode: 'direct-run',
          preferredSkills: ['generateImage'],
        },
      },
    } as any,
  });

  const firstCall = Array.isArray(repaired.skillCalls) ? repaired.skillCalls[0] : null;
  assert.equal(firstCall?.skillName, 'generateImage');
  assert.equal(firstCall?.params?.aspectRatio, '9:16');
  assert.equal(firstCall?.params?.imageSize, '4K');
});

test('shouldBypassAutonomousChatSuppression only opens chat execution for active direct-run skill', () => {
  assert.equal(
    shouldBypassAutonomousChatSuppression({
      allowAutonomousRouting: true,
      taskMode: 'chat',
      skillData: {
        id: 'custom-skill-brand',
        config: {
          routeIntent: 'branding',
          followUpMode: 'direct-run',
        },
      },
    } as any),
    true,
  );

  assert.equal(
    shouldBypassAutonomousChatSuppression({
      allowAutonomousRouting: true,
      taskMode: 'chat',
      skillData: {
        id: 'custom-skill-brand',
        config: {
          routeIntent: 'branding',
          followUpMode: 'auto-clarify',
        },
      },
    } as any),
    false,
  );
});

test('skill meta questions do not bypass chat suppression or run selected skill', () => {
  const metadata = {
    allowAutonomousRouting: true,
    taskMode: 'chat',
    skillData: {
      id: 'custom-skill-ugc',
      config: {
        routeIntent: 'social',
        followUpMode: 'direct-run',
        preferredSkills: ['generateImage'],
        isCustomSkill: true,
      },
    },
  } as any;
  const question = '\u4f60\u80fd\u770b\u5230\u6211\u95ee\u7684\u662f\u54ea\u4e2askill\u5417';

  assert.equal(isFrontstageSkillMetaQuestion(question), true);
  assert.equal(shouldBypassAutonomousChatSuppression(metadata, question), false);

  const repaired = repairAutonomousSkillPlan({
    plan: {
      message: 'The active skill is UGC.',
      skillCalls: [{ skillName: 'generateImage', params: { prompt: 'UGC image' } }],
    },
    originalMessage: question,
    metadata,
  });

  assert.deepEqual(repaired.skillCalls, []);
});

test('shouldExecuteFrontstageSkillSequentially enables workflow chaining for bridge skills', () => {
  const enabled = shouldExecuteFrontstageSkillSequentially({
    skillCalls: [
      { skillName: 'workspaceSearch', params: { query: 'premium skincare references' } },
      { skillName: 'generateImage', params: { prompt: 'Create the KV' } },
    ],
    metadata: {
      allowAutonomousRouting: true,
      skillData: {
        id: 'custom-skill-brand',
        config: {
          routeIntent: 'branding',
          followUpMode: 'direct-run',
        },
      },
    } as any,
  });

  const disabled = shouldExecuteFrontstageSkillSequentially({
    skillCalls: [{ skillName: 'generateImage', params: { prompt: 'Create the KV' } }],
    metadata: {
      allowAutonomousRouting: true,
      skillData: {
        id: 'custom-skill-brand',
        config: {
          routeIntent: 'branding',
          followUpMode: 'direct-run',
        },
      },
    } as any,
  });

  assert.equal(enabled, true);
  assert.equal(disabled, false);
});

test('repairAutonomousSkillPlan invokes onRepair for backfill events', () => {
  const events: any[] = [];
  repairAutonomousSkillPlan({
    plan: {
      skillCalls: [
        { skillName: 'generateImage', params: { prompt: 'KV' } },
      ],
    },
    originalMessage: '继续推进 KV，然后出最终视频',
    metadata: {
      allowAutonomousRouting: true,
      enableWebSearch: true,
      taskMode: 'video',
      skillData: {
        id: 'autonomous-main-brain',
        name: 'Video',
        config: {
          frontstageSkillId: 'autonomous-video-director',
          routeIntent: 'video',
          followUpMode: 'direct-run',
          preferredSkills: ['generateImage', 'generateVideo'],
          executionRecipe: [
            'visual-request :: generateImage :: 先做关键帧',
            'final-video :: generateVideo :: 再合成视频',
          ],
        },
      },
    } as any,
    onRepair: (event) => events.push(event),
  });

  assert.ok(events.length >= 1);
  const backfill = events.find((event) => event.kind === 'backfill');
  assert.ok(backfill, 'expected a backfill repair event');
  assert.ok(Array.isArray(backfill.injectedSkillNames));
  assert.ok(backfill.injectedSkillNames.length > 0);
});

test('repairAutonomousSkillPlan invokes onRepair for fallback execution path', () => {
  const events: any[] = [];
  repairAutonomousSkillPlan({
    plan: {},
    originalMessage: '继续给我做一张主视觉海报',
    metadata: {
      allowAutonomousRouting: true,
      enableWebSearch: true,
      taskMode: 'generate',
      skillData: {
        id: 'autonomous-main-brain',
        name: 'Brand',
        config: {
          frontstageSkillId: 'autonomous-brand-system',
          routeIntent: 'branding',
          followUpMode: 'direct-run',
          preferredSkills: ['generateImage'],
        },
      },
    } as any,
    onRepair: (event) => events.push(event),
  });

  const fallback = events.find((event) => event.kind === 'fallback');
  assert.ok(fallback, 'expected a fallback repair event');
  assert.equal(typeof fallback.skillCallsAfter, 'number');
});

test('repairAutonomousSkillPlan promotes contextual follow-up edit requests into smartEdit', () => {
  const repaired = repairAutonomousSkillPlan({
    plan: {},
    originalMessage: '不要包包',
    attachments: [],
    metadata: {
      allowAutonomousRouting: true,
      taskMode: 'chat',
      skillData: {
        id: 'custom-skill-image',
        config: {
          routeIntent: 'branding',
          followUpMode: 'direct-run',
          preferredSkills: ['smartEdit', 'generateImage'],
        },
      },
      multimodalContext: {
        referenceImageUrls: ['https://example.com/current-image.png'],
      },
    } as any,
  });

  assert.deepEqual(
    repaired.skillCalls?.map((item: any) => item.skillName),
    ['smartEdit'],
  );
  assert.equal(
    repaired.skillCalls?.[0]?.params?.sourceUrl,
    'https://example.com/current-image.png',
  );
  assert.equal(repaired.skillCalls?.[0]?.params?.instruction, '不要包包');
});

test('repairAutonomousSkillPlan still prefers fresh attachment token for smartEdit when present', () => {
  const repaired = repairAutonomousSkillPlan({
    plan: {},
    originalMessage: 'remove the bag',
    attachments: [{ type: 'image/png' } as File],
    metadata: {
      allowAutonomousRouting: true,
      taskMode: 'chat',
      skillData: {
        id: 'custom-skill-image',
        config: {
          routeIntent: 'branding',
          followUpMode: 'direct-run',
          preferredSkills: ['smartEdit'],
        },
      },
      multimodalContext: {
        referenceImageUrls: ['https://example.com/older-image.png'],
      },
    } as any,
  });

  assert.equal(repaired.skillCalls?.[0]?.skillName, 'smartEdit');
  assert.equal(repaired.skillCalls?.[0]?.params?.sourceUrl, 'ATTACHMENT_0');
});

test('repairAutonomousSkillPlan promotes contextual edit follow-ups into smartEdit even when follow-up mode is auto-clarify', () => {
  const repaired = repairAutonomousSkillPlan({
    plan: {},
    originalMessage: '其余不变就衣服换成泳装',
    attachments: [],
    metadata: {
      allowAutonomousRouting: true,
      taskMode: 'chat',
      skillData: {
        id: 'custom-skill-image',
        config: {
          routeIntent: 'branding',
          followUpMode: 'auto-clarify',
          preferredSkills: ['smartEdit', 'generateImage'],
        },
      },
      multimodalContext: {
        referenceImageUrls: ['https://example.com/current-image.png'],
      },
    } as any,
  });

  assert.deepEqual(
    repaired.skillCalls?.map((item: any) => item.skillName),
    ['smartEdit'],
  );
  assert.equal(
    repaired.skillCalls?.[0]?.params?.instruction,
    '其余不变就衣服换成泳装',
  );
});

test('repairAutonomousSkillPlan reuses the latest explicit edit instruction for reference-only follow-ups', () => {
  const repaired = repairAutonomousSkillPlan({
    plan: {},
    originalMessage: '就改上一张啊',
    attachments: [],
    conversationHistory: [
      {
        id: 'u1',
        role: 'user',
        text: '其余不变就衣服换成泳装',
        timestamp: Date.now() - 1000,
      },
    ] as any,
    metadata: {
      allowAutonomousRouting: true,
      taskMode: 'chat',
      skillData: {
        id: 'custom-skill-image',
        config: {
          routeIntent: 'branding',
          followUpMode: 'auto-clarify',
          preferredSkills: ['smartEdit'],
        },
      },
      multimodalContext: {
        referenceImageUrls: ['https://example.com/current-image.png'],
      },
    } as any,
  });

  assert.equal(repaired.skillCalls?.[0]?.skillName, 'smartEdit');
  assert.equal(
    repaired.skillCalls?.[0]?.params?.instruction,
    '其余不变就衣服换成泳装',
  );
});
