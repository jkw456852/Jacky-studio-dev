import { buildDefaultExecutionRecipeLines } from './frontstage-skill-recipes.ts';

export type CustomSkillRouteIntentOption =
  | 'general'
  | 'video'
  | 'social'
  | 'branding'
  | 'commerce';

export type CustomSkillRoutePreset = {
  id: CustomSkillRouteIntentOption;
  label: string;
  routeLabel: string;
  routeSummary: string;
  preferredSkills: string[];
  suggestedTaskMode: string;
  defaultFollowUpMode: 'auto-clarify' | 'direct-run';
  clarifyChecklist: string[];
  frontstageSkillId?: string;
};

export const CUSTOM_SKILL_ROUTE_PRESETS: Record<
  CustomSkillRouteIntentOption,
  CustomSkillRoutePreset
> = {
  general: {
    id: 'general',
    label: '通用推进',
    routeLabel: 'Custom Skill',
    routeSummary:
      'Reuse the proven workflow from the source conversation and adapt it to the new request.',
    preferredSkills: ['generateImage', 'generateCopy'],
    suggestedTaskMode: 'generate',
    defaultFollowUpMode: 'direct-run',
    clarifyChecklist: ['目标结果', '关键限制', '输出格式'],
  },
  video: {
    id: 'video',
    label: '视频优先',
    frontstageSkillId: 'autonomous-video-director',
    routeLabel: 'Video',
    routeSummary:
      'Bias toward storyboard, motion, clip sequencing, and video-first asset decisions.',
    preferredSkills: ['generateVideo', 'generateImage', 'smartEdit'],
    suggestedTaskMode: 'generate',
    defaultFollowUpMode: 'auto-clarify',
    clarifyChecklist: ['视频用途', '时长节奏', '镜头/风格参考'],
  },
  social: {
    id: 'social',
    label: '社媒传播',
    frontstageSkillId: 'autonomous-social-campaign',
    routeLabel: 'Social Media',
    routeSummary:
      'Bias toward social campaigns, cover art, poster variants, and multi-asset content flows.',
    preferredSkills: ['generateImage', 'generateCopy', 'generateVideo'],
    suggestedTaskMode: 'generate',
    defaultFollowUpMode: 'auto-clarify',
    clarifyChecklist: ['发布渠道', '受众/卖点', '素材规格与数量'],
  },
  branding: {
    id: 'branding',
    label: '品牌视觉',
    frontstageSkillId: 'autonomous-brand-system',
    routeLabel: 'Branding',
    routeSummary:
      'Bias toward brand direction, visual systems, key visuals, and identity-aware execution.',
    preferredSkills: ['generateImage', 'generateCopy', 'workspaceSearch'],
    suggestedTaskMode: 'generate',
    defaultFollowUpMode: 'auto-clarify',
    clarifyChecklist: ['品牌调性', '受众定位', '视觉参考与应用场景'],
  },
  commerce: {
    id: 'commerce',
    label: '电商执行',
    frontstageSkillId: 'ecom-oneclick-workflow',
    routeLabel: 'E-Commerce',
    routeSummary:
      'Bias toward product assets, detail-page structure, conversion modules, and commerce-ready outputs.',
    preferredSkills: ['workspaceSearch', 'generateImage', 'smartEdit', 'generateCopy'],
    suggestedTaskMode: 'generate',
    defaultFollowUpMode: 'auto-clarify',
    clarifyChecklist: ['商品与卖点', '目标平台', '商品图/参考素材'],
  },
};

const clip = (value: unknown, maxChars: number): string =>
  String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);

const normalizeStringList = (
  value: unknown,
  maxItems: number,
  maxCharsPerItem: number,
): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => clip(item, maxCharsPerItem))
        .filter(Boolean)
        .slice(0, maxItems)
    : [];

const normalizeFollowUpMode = (
  value: unknown,
): 'auto-clarify' | 'direct-run' | null => {
  const normalized = clip(value, 40);
  if (normalized === 'auto-clarify' || normalized === 'direct-run') {
    return normalized;
  }
  return null;
};

const dedupeStrings = (items: string[]): string[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalized = clip(item, 240);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

const arraysEqual = (left: string[], right: string[]) =>
  left.length === right.length &&
  left.every((item, index) => clip(item, 240) === clip(right[index], 240));

const LEGACY_GENERIC_OUTPUT_BLUEPRINTS: Record<CustomSkillRouteIntentOption, string[]> = {
  general: ['先澄清目标', '再给执行方案'],
  video: ['先给脚本/镜头拆解', '再给视频执行方案'],
  social: ['先明确传播角度', '再拆分封面/海报/文案资产'],
  branding: ['先整理品牌方向', '再输出视觉系统/KV建议'],
  commerce: ['先补齐商品卖点', '再输出转化导向物料方案'],
};

const buildActivationHint = ({
  routePreset,
  summary,
  instruction,
}: {
  routePreset: CustomSkillRoutePreset;
  summary: string;
  instruction: string;
}) => {
  const focus = clip(instruction || summary, 80);
  if (!focus) {
    return `适合复用「${routePreset.label}」这类任务里已经验证过的推进方式。`;
  }
  return `适合 ${focus} 这类任务，复用这套已经验证过的推进顺序。`;
};

const buildClarifyQuestions = ({
  checklist,
  routeIntent,
}: {
  checklist: string[];
  routeIntent: CustomSkillRouteIntentOption;
}) =>
  checklist.map((item) => {
    if (/品牌调性|brand/i.test(item)) {
      return '这次品牌整体更偏什么调性，必须避免什么感觉？';
    }
    if (/受众|人群|定位/i.test(item)) {
      return '这次主要想打到哪类人群，她们最在意什么？';
    }
    if (/视觉参考|参考|应用场景/i.test(item)) {
      return '有没有参考图、参考品牌，或者明确的应用场景要一起考虑？';
    }
    if (/视频用途/i.test(item)) {
      return '这条视频主要发在哪，想让用户看完做什么？';
    }
    if (/时长|节奏/i.test(item)) {
      return '预期时长和节奏是什么，前几秒要先打出什么信息？';
    }
    if (/镜头|风格/i.test(item)) {
      return '有没有想参考的镜头语言、画面风格或分镜案例？';
    }
    if (/发布渠道|平台/i.test(item)) {
      return '这次主要发在哪个平台，不同平台有没有不同尺寸或语气要求？';
    }
    if (/卖点|受众/i.test(item) && routeIntent === 'social') {
      return '这次最想打的卖点和目标受众分别是什么？';
    }
    if (/素材规格|数量/i.test(item)) {
      return '这次预计要产出多少张/多少页，尺寸或素材规格有没有限制？';
    }
    if (/商品与卖点|商品/i.test(item)) {
      return '这次的商品是什么，最核心的卖点和不能改动的真值分别是什么？';
    }
    if (/目标平台/i.test(item)) {
      return '主要要落在哪个平台，是天猫、京东、亚马逊还是其它渠道？';
    }
    if (/商品图|参考素材/i.test(item)) {
      return '现在手上有哪些商品图、细节图或参考素材，哪些是必须沿用的？';
    }
    if (/目标结果/i.test(item)) {
      return '这次你最希望最终直接拿到什么结果？';
    }
    if (/关键限制/i.test(item)) {
      return '这次有哪些不能动的限制、边界或必须遵守的要求？';
    }
    if (/输出格式/i.test(item)) {
      return '你更希望我最后按什么格式交付，清单、脚本、页面结构还是可直接执行的方案？';
    }
    return `请先补充${item}。`;
  });

const buildExecutionOutline = ({
  routeIntent,
  summary,
  instruction,
}: {
  routeIntent: CustomSkillRouteIntentOption;
  summary: string;
  instruction: string;
}) => {
  const focus = clip(instruction || summary, 100);
  const firstLine = focus
    ? `先锁定这次要复用的核心任务：${focus}`
    : '先把这次任务的目标、边界和优先级锁定清楚';

  switch (routeIntent) {
    case 'video':
      return [
        firstLine,
        '再按 hook、镜头推进、关键帧和成片目标拆清执行顺序',
        '最后给出视频生成/拍摄所需素材、步骤和补问提醒',
      ];
    case 'social':
      return [
        firstLine,
        '再拆封面 hook、页序/资产角色和每个内容位的职责',
        '最后给出逐资产执行建议、规格提醒和后续延展路径',
      ];
    case 'branding':
      return [
        firstLine,
        '再统一品牌调性、视觉边界、KV 或系统化输出方向',
        '最后给出执行顺序、参考需求和下一步落地建议',
      ];
    case 'commerce':
      return [
        firstLine,
        '再拆商品真值、页型结构、卖点顺序和转化重点',
        '最后给出每屏/每模块执行建议与所需素材提醒',
      ];
    case 'general':
    default:
      return [
        firstLine,
        '再梳理这次任务真正缺失的输入与最稳妥的推进顺序',
        '最后给出可直接继续执行的结构、步骤和补充信息提醒',
      ];
  }
};

const buildOutputBlueprint = ({
  routeIntent,
}: {
  routeIntent: CustomSkillRouteIntentOption;
}) => {
  switch (routeIntent) {
    case 'video':
      return [
        '先给任务目标与 hook 判断',
        '再拆脚本、镜头、关键帧或 lookframe 方向',
        '最后给视频生成/拍摄执行建议与缺失素材提醒',
      ];
    case 'social':
      return [
        '先给传播主线、封面 hook 和页序判断',
        '再逐页/逐资产拆标题、信息点与视觉角色',
        '最后给执行建议、规格提醒和可继续延展的内容位',
      ];
    case 'branding':
      return [
        '先给品牌方向、受众感知和视觉边界判断',
        '再拆 KV、视觉系统或应用场景的执行结构',
        '最后给后续生成、参考研究或延展资产建议',
      ];
    case 'commerce':
      return [
        '先给商品卖点优先级与页型结构判断',
        '再逐屏/逐模块拆标题、视觉重点和转化角色',
        '最后给执行建议、素材缺口和后续产出顺序',
      ];
    case 'general':
    default:
      return [
        '先确认目标结果与缺失输入',
        '再给最稳妥的执行结构和推进步骤',
        '最后给继续落地所需的补充信息与下一步建议',
      ];
  }
};

const buildToolPolicy = ({
  routeIntent,
}: {
  routeIntent: CustomSkillRouteIntentOption;
}) => {
  switch (routeIntent) {
    case 'video':
      return [
        '优先稳住脚本、镜头和节奏，再决定是否直接进视频生成。',
        '需要视觉锚点时先做关键帧或 lookframe，不要一上来直接出成片。',
        '最终视频生成建立在镜头结构已经稳定的前提上。',
      ];
    case 'social':
      return [
        '先明确传播主线和页序，再进入封面、轮播或短视频执行。',
        '多资产内容按页面/资产职责分别推进，不要压成一张大杂烩图。',
        '需要延展视频时，也要先让封面 hook 和信息结构成立。',
      ];
    case 'branding':
      return [
        '先统一品牌方向、受众感知和风格边界，再进入视觉生成。',
        '研究或参考搜索只在确实需要补竞品、趋势或案例时再调用。',
        '每次先验证一个 KV 或系统方向，不要一次把整套品牌资产混成一张图。',
      ];
    case 'commerce':
      return [
        '优先锁定商品真值、卖点顺序和页型结构，再进入详情页或主图执行。',
        '电商任务按模块和页型分别推进，不要退化成单张海报思路。',
        '涉及商品图改造时，先明确哪些细节必须保真，再进入编辑或生成。',
      ];
    case 'general':
    default:
      return [
        '先复用已经验证过的推进顺序，不要每次都从空白 prompt 重来。',
        '关键信息不足时先补问，再进入真正执行。',
        '需要搜索、生成或编辑时，按任务目标选择最贴合的步骤，不要盲目并行乱跑。',
      ];
  }
};

const isWeakReusableQuestions = (value: string[]) =>
  value.length === 0 || value.every((item) => /^请先补充/.test(clip(item, 120)));

const isWeakExecutionOutline = (value: string[], instruction: string) =>
  value.length === 0 ||
  (value.length === 1 && clip(value[0], 240) === clip(instruction, 240));

const isWeakOutputBlueprint = (
  value: string[],
  routeIntent: CustomSkillRouteIntentOption,
) => value.length === 0 || arraysEqual(value, LEGACY_GENERIC_OUTPUT_BLUEPRINTS[routeIntent]);

const isWeakToolPolicy = (value: string[], routePreset: CustomSkillRoutePreset) =>
  value.length === 0 ||
  (value.length === 1 &&
    clip(value[0], 240) === clip(`先按 ${routePreset.label} 的工作流补齐关键输入，再进入执行。`, 240));

const normalizeRouteIntent = (value: unknown): CustomSkillRouteIntentOption => {
  const normalized = clip(value, 40).toLowerCase();
  if (
    normalized === 'video' ||
    normalized === 'social' ||
    normalized === 'branding' ||
    normalized === 'commerce'
  ) {
    return normalized;
  }
  return 'general';
};

export const resolveCustomSkillRoutePreset = (
  value: unknown,
): CustomSkillRoutePreset => {
  const key = normalizeRouteIntent(value);
  return CUSTOM_SKILL_ROUTE_PRESETS[key] || CUSTOM_SKILL_ROUTE_PRESETS.general;
};

export const buildStructuredCustomSkillWorkflow = (args: {
  currentConfig?: Record<string, unknown> | null;
  routeIntent?: unknown;
  summary?: string;
  instruction?: string;
  followUpMode?: unknown;
  forceWorkflowRefresh?: boolean;
}) => {
  const currentConfig = args.currentConfig || {};
  const routePreset = resolveCustomSkillRoutePreset(args.routeIntent);
  const currentRouteIntent = normalizeRouteIntent(currentConfig.routeIntent);
  const routeChanged = currentRouteIntent !== routePreset.id;
  const forceWorkflowRefresh = args.forceWorkflowRefresh === true;
  const summary = clip(
    args.summary || currentConfig.summary || currentConfig.description,
    220,
  );
  const instruction = clip(
    args.instruction || currentConfig.instruction || currentConfig.customInstruction,
    420,
  );
  const clarifyChecklist = normalizeStringList(currentConfig.clarifyChecklist, 8, 40);
  const reusableQuestions = normalizeStringList(currentConfig.reusableQuestions, 8, 120);
  const executionOutline = normalizeStringList(currentConfig.executionOutline, 8, 180);
  const executionRecipe = normalizeStringList(currentConfig.executionRecipe, 8, 220);
  const outputBlueprint = normalizeStringList(currentConfig.outputBlueprint, 8, 180);
  const toolPolicy = normalizeStringList(currentConfig.toolPolicy, 8, 220);
  const followUpMode =
    normalizeFollowUpMode(args.followUpMode) ||
    normalizeFollowUpMode(currentConfig.followUpMode) ||
    routePreset.defaultFollowUpMode;

  const nextChecklist =
    !routeChanged && clarifyChecklist.length > 0
      ? clarifyChecklist
      : routePreset.clarifyChecklist;
  const nextReusableQuestions =
    !forceWorkflowRefresh &&
    !routeChanged &&
    !isWeakReusableQuestions(reusableQuestions)
      ? reusableQuestions
      : buildClarifyQuestions({
          checklist: nextChecklist,
          routeIntent: routePreset.id,
        });
  const nextExecutionOutline =
    !forceWorkflowRefresh &&
    !routeChanged &&
    !isWeakExecutionOutline(executionOutline, instruction)
      ? executionOutline
      : buildExecutionOutline({
          routeIntent: routePreset.id,
          summary,
          instruction,
        });
  const nextExecutionRecipe =
    !routeChanged && executionRecipe.length > 0
      ? executionRecipe
      : buildDefaultExecutionRecipeLines(routePreset.id);
  const nextOutputBlueprint =
    !forceWorkflowRefresh &&
    !routeChanged &&
    !isWeakOutputBlueprint(outputBlueprint, routePreset.id)
      ? outputBlueprint
      : buildOutputBlueprint({
          routeIntent: routePreset.id,
        });
  const nextToolPolicy =
    !forceWorkflowRefresh &&
    !routeChanged &&
    !isWeakToolPolicy(toolPolicy, routePreset)
      ? toolPolicy
      : buildToolPolicy({
          routeIntent: routePreset.id,
        });

  return {
    frontstageSkillId: routePreset.frontstageSkillId,
    routeIntent: routePreset.id,
    routeLabel: routePreset.routeLabel,
    routeSummary: routePreset.routeSummary,
    preferredSkills: [...routePreset.preferredSkills],
    suggestedTaskMode: routePreset.suggestedTaskMode,
    followUpMode,
    clarifyChecklist: [...nextChecklist],
    reusableQuestions: dedupeStrings(nextReusableQuestions).slice(0, 6),
    executionOutline: dedupeStrings(nextExecutionOutline).slice(0, 6),
    executionRecipe: dedupeStrings(nextExecutionRecipe).slice(0, 6),
    outputBlueprint: dedupeStrings(nextOutputBlueprint).slice(0, 6),
    toolPolicy: dedupeStrings(nextToolPolicy).slice(0, 6),
    activationHint:
      clip(currentConfig.activationHint, 200) ||
      buildActivationHint({
        routePreset,
        summary,
        instruction,
      }),
  };
};
