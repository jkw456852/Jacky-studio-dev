import {
  normalizeRegisteredSkillName,
  resolveRegisteredSkillName,
} from '../skills/skill-manifest.ts';

export type FrontstageSkillRouteIntent =
  | 'general'
  | 'video'
  | 'social'
  | 'branding'
  | 'commerce';

export type FrontstageExecutionRecipeCondition =
  | 'always'
  | 'explicit-research'
  | 'visual-request'
  | 'final-video'
  | 'attachment-edit';

export interface FrontstageExecutionRecipeStep {
  when: FrontstageExecutionRecipeCondition;
  skillName: string | null;
  goal: string;
  raw: string;
}

const RECIPE_LINE_RE =
  /^(always|explicit-research|visual-request|final-video|attachment-edit)\s*::\s*([a-zA-Z0-9-]+|none)\s*::\s*(.+)$/i;

const clip = (value: unknown, maxChars: number): string =>
  String(value || '').replace(/\r\n/g, '\n').trim().slice(0, maxChars);

export const normalizeFrontstageSkillRouteIntent = (
  value: unknown,
): FrontstageSkillRouteIntent => {
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

export const buildDefaultExecutionRecipeLines = (
  routeIntent: unknown,
): string[] => {
  switch (normalizeFrontstageSkillRouteIntent(routeIntent)) {
    case 'video':
      return [
        'always :: none :: 先锁定 hook、脚本节奏和镜头推进，再进入视觉或视频执行',
        'visual-request :: generateImage :: 先生成关键帧或 lookframe，给后续视频提供视觉锚点',
        'final-video :: generateVideo :: 在关键帧或镜头方向稳定后再进入最终视频生成',
      ];
    case 'social':
      return [
        'always :: none :: 先确定封面 hook、传播主线和页序角色，再进入执行',
        'explicit-research :: workspaceSearch :: 仅在用户明确要案例、趋势或平台参考时补研究',
        'visual-request :: generateImage :: 按封面或分页职责分别出图，不要把整套内容压成一张图',
        'final-video :: generateVideo :: 只有明确要动态社媒资产时再进入视频生成',
      ];
    case 'branding':
      return [
        'always :: none :: 先统一品牌调性、受众和应用场景，再进入视觉执行',
        'explicit-research :: workspaceSearch :: 仅在用户明确要竞品、趋势或案例时补研究',
        'visual-request :: generateImage :: 一次验证一个 KV 或系统方向，不要把整套 campaign 压成一张图',
      ];
    case 'commerce':
      return [
        'always :: none :: 先锁定商品真值、卖点和页面结构，再进入执行',
        'explicit-research :: workspaceSearch :: 仅在用户明确要竞品、平台趋势或案例时补研究',
        'visual-request :: generateImage :: 按页面或模块职责分别出图，不要退化成单张海报',
      ];
    case 'general':
    default:
      return [
        'always :: none :: 先复用已验证的执行路径，再补齐缺失输入后继续推进',
        'explicit-research :: workspaceSearch :: 仅在用户明确要联网研究时调用搜索',
        'visual-request :: generateImage :: 在方向明确后再进入视觉执行',
      ];
  }
};

export const normalizeExecutionRecipeLines = (
  value: unknown,
  routeIntent?: unknown,
  maxItems = 8,
): string[] => {
  const rawLines = Array.isArray(value)
    ? value
        .map((item) => clip(item, 240))
        .filter(Boolean)
        .slice(0, maxItems)
    : [];
  if (rawLines.length > 0) {
    return rawLines;
  }
  return buildDefaultExecutionRecipeLines(routeIntent).slice(0, maxItems);
};

export const parseExecutionRecipeLine = (
  value: unknown,
): FrontstageExecutionRecipeStep | null => {
  const raw = clip(value, 240);
  if (!raw) return null;

  const matched = raw.match(RECIPE_LINE_RE);
  if (!matched) {
    return {
      when: 'always',
      skillName: null,
      goal: raw,
      raw,
    };
  }

  const when = matched[1].toLowerCase() as FrontstageExecutionRecipeCondition;
  const rawSkillName = normalizeRegisteredSkillName(matched[2]);
  const skillName =
    rawSkillName.toLowerCase() === 'none' || !resolveRegisteredSkillName(rawSkillName)
      ? null
      : rawSkillName;

  return {
    when,
    skillName,
    goal: clip(matched[3], 220),
    raw,
  };
};

export const parseExecutionRecipeLines = (
  value: unknown,
  routeIntent?: unknown,
  maxItems = 8,
): FrontstageExecutionRecipeStep[] =>
  normalizeExecutionRecipeLines(value, routeIntent, maxItems)
    .map((line) => parseExecutionRecipeLine(line))
    .filter((step): step is FrontstageExecutionRecipeStep => Boolean(step?.goal));
