import type { AgentTaskMetadata } from '../../types/agent.types.ts';
import { listFrontstageSkillPresets } from '../runtime-assets/frontstage-skill-presets.ts';
import {
  getFrontstageSkillId,
  normalizeFrontstageSkillPresentation,
} from '../runtime-assets/skill-identity.ts';

type SkillHelpResponse = {
  message: string;
  suggestions?: string[];
};

const SKILL_HELP_SIGNAL_RE =
  /(?:(?:这个|该|当前|所选).{0,6})?(?:skill|技能).{0,18}(?:能干嘛|能做什么|怎么用|怎么使用|是什么|介绍一下|介绍|用途|适合什么|help|usage|what can|how to use|about)|(?:what can this skill do|how should i use this skill|tell me about this skill)/i;

const normalizeString = (value: unknown) => String(value || '').replace(/\s+/g, ' ').trim();

const normalizeStringList = (value: unknown, maxItems = 6): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => normalizeString(item))
        .filter(Boolean)
        .slice(0, maxItems)
    : [];

const getSkillConfig = (metadata?: AgentTaskMetadata | Record<string, any>) => {
  const typedMetadata = metadata as Record<string, any> | undefined;
  const skillData =
    typedMetadata?.skillData && typeof typedMetadata.skillData === 'object'
      ? normalizeFrontstageSkillPresentation(typedMetadata.skillData)
      : null;
  const config =
    skillData?.config && typeof skillData.config === 'object'
      ? (skillData.config as Record<string, unknown>)
      : null;
  return { skillData, config };
};

const prettifySkillName = (skillName: string) => {
  switch (skillName) {
    case 'generateCopy':
      return '文案/结构规划';
    case 'generateImage':
      return '出图';
    case 'generateVideo':
      return '视频生成';
    case 'workspaceSearch':
      return '联网检索';
    case 'smartEdit':
      return '智能编辑';
    default:
      return skillName;
  }
};

export const isFrontstageSkillHelpRequest = (message: string) =>
  SKILL_HELP_SIGNAL_RE.test(normalizeString(message));

export const buildFrontstageSkillHelpResponse = ({
  message,
  metadata,
}: {
  message: string;
  metadata?: AgentTaskMetadata | Record<string, any>;
}): SkillHelpResponse | null => {
  if (!isFrontstageSkillHelpRequest(message)) {
    return null;
  }

  const { skillData, config } = getSkillConfig(metadata);
  if (!skillData || !config || config.allowAutonomousRouting !== true) {
    return null;
  }

  const frontstageSkillId = getFrontstageSkillId(skillData);
  const preset = listFrontstageSkillPresets().find(
    (item) =>
      item.id === frontstageSkillId ||
      getFrontstageSkillId(item.skillData) === frontstageSkillId,
  );

  const skillName =
    normalizeString(skillData.name) ||
    normalizeString(preset?.name) ||
    normalizeString(config.routeLabel) ||
    '当前 Skill';
  const description =
    normalizeString(preset?.description) ||
    normalizeString(config.summary) ||
    normalizeString(config.routeSummary);
  const activationHint =
    normalizeString(preset?.activationHint) || normalizeString(config.activationHint);
  const executionOutline = normalizeStringList(config.executionOutline, 4);
  const executionRecipe = normalizeStringList(config.executionRecipe, 4);
  const outputBlueprint = normalizeStringList(config.outputBlueprint, 4);
  const clarifyChecklist = normalizeStringList(config.clarifyChecklist, 4);
  const toolPolicy = normalizeStringList(config.toolPolicy, 3);
  const preferredSkills = normalizeStringList(config.preferredSkills, 4).map(prettifySkillName);
  const followUpMode = normalizeString(config.followUpMode);
  const examplePrompt =
    normalizeString(config.lastSuccessfulPrompt) ||
    normalizeString(config.examplePrompt) ||
    normalizeString(config.sourceUserPrompt);
  const successfulRuns = Number(config.successfulRuns || 0);

  const lines = [
    `当前选中的是「${skillName}」。`,
    description ? `它主要适合：${description}` : '',
    activationHint ? `适用场景：${activationHint}` : '',
    executionOutline.length > 0
      ? `通常会这样推进：${executionOutline.join(' -> ')}`
      : executionRecipe.length > 0
        ? `默认执行链路：${executionRecipe.join(' -> ')}`
        : '',
    outputBlueprint.length > 0
      ? `常见产出：${outputBlueprint.join('；')}`
      : '',
    preferredSkills.length > 0
      ? `它会优先调度：${preferredSkills.join('、')}`
      : '',
    followUpMode === 'auto-clarify' && clarifyChecklist.length > 0
      ? `信息不够时会先补这几类输入：${clarifyChecklist.join('、')}`
      : followUpMode === 'direct-run'
        ? '信息基本够用时，它会直接进入执行，不会先来回补问。'
        : '',
    toolPolicy.length > 0 ? `使用方式上会特别注意：${toolPolicy.join('；')}` : '',
    examplePrompt ? `你可以直接这样开：${examplePrompt}` : '',
    successfulRuns > 0 ? `这个 Skill 最近已成功跑通 ${successfulRuns} 次。` : '',
  ].filter(Boolean);

  const suggestions = [
    examplePrompt ? '直接按示例改成你的需求发我' : '',
    clarifyChecklist.length > 0 ? `先补齐：${clarifyChecklist.slice(0, 2).join('、')}` : '',
    preset?.requiresAttachments ? '如果有参考图或商品图，可以一并发上来' : '',
  ].filter(Boolean);

  return {
    message: lines.join('\n'),
    ...(suggestions.length > 0 ? { suggestions } : {}),
  };
};
