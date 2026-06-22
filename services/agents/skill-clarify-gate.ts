import type { AgentTaskMetadata } from '../../types/agent.types';

type SkillGateDecision =
  | {
      shouldClarify: false;
    }
  | {
      shouldClarify: true;
      message: string;
      questions: string[];
      suggestions: string[];
      missingChecklist: string[];
    };

const ATTACHMENT_SIGNAL_RE =
  /(附图|上传|参考图|商品图|原图|截图|素材|logo|主图|模特图|产品图|图\b|image|images|attachment|attachments|reference)/i;

const normalizeChecklist = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];

const normalizeText = (value: string) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const matchesChecklistItem = (message: string, item: string): boolean => {
  const text = normalizeText(message).toLowerCase();
  const label = normalizeText(item).toLowerCase();
  if (!text || !label) return false;

  const aliasMap: Array<[RegExp, string[]]> = [
    [/(品牌调性|品牌方向|brand)/i, ['调性', '品牌感', '品牌方向', '视觉系统', 'vi', '高级', '极简', '科技感', '复古']],
    [/(受众|人群|定位)/i, ['受众', '人群', '定位', '客群', '用户']],
    [/(视觉参考|风格参考|参考)/i, ['参考', '案例', '对标', '附图', '截图']],
    [/(视频用途|用途)/i, ['视频', '用途', '投放', '发布', '场景']],
    [/(时长|节奏)/i, ['时长', '秒', '节奏', '镜头']],
    [/(镜头|风格参考)/i, ['镜头', '分镜', '风格', '参考']],
    [/(发布渠道|平台)/i, ['小红书', '抖音', '快手', 'instagram', 'facebook', '平台', '渠道']],
    [/(卖点|目标结果|目标)/i, ['卖点', '目标', '诉求', '想要', '结果']],
    [/(规格|数量|页数)/i, ['规格', '尺寸', '数量', '页数', '张']],
    [/(商品|商品图|素材)/i, ['商品', '产品', '商品图', '产品图', '素材', 'sku']],
    [/(logo)/i, ['logo', '标志']],
    [/(服饰图|模特图)/i, ['服饰', '模特', '上身', '穿搭']],
  ];

  for (const [pattern, aliases] of aliasMap) {
    if (pattern.test(label)) {
      return aliases.some((alias) => text.includes(alias.toLowerCase()));
    }
  }

  return text.includes(label);
};

const checklistNeedsAttachments = (item: string) =>
  /(图|素材|logo|截图|参考|商品|产品|模特)/i.test(item);

export const evaluateSkillClarifyGate = ({
  message,
  attachments,
  metadata,
}: {
  message: string;
  attachments?: File[];
  metadata?: AgentTaskMetadata;
}): SkillGateDecision => {
  if (metadata?.allowAutonomousRouting !== true) {
    return { shouldClarify: false };
  }

  const skillConfig =
    metadata?.skillData?.config && typeof metadata.skillData.config === 'object'
      ? (metadata.skillData.config as Record<string, unknown>)
      : null;
  if (!skillConfig) {
    return { shouldClarify: false };
  }

  const followUpMode = String(
    metadata?.skillFollowUpMode ||
      skillConfig.followUpMode ||
      '',
  ).trim();

  if (followUpMode !== 'auto-clarify') {
    return { shouldClarify: false };
  }

  const checklist = normalizeChecklist(
    metadata?.skillClarifyChecklist || skillConfig.clarifyChecklist,
  );

  if (checklist.length === 0) {
    return { shouldClarify: false };
  }

  const normalizedMessage = normalizeText(message);
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

  const missingChecklist = checklist.filter((item) => {
    if (matchesChecklistItem(normalizedMessage, item)) {
      return false;
    }
    if (checklistNeedsAttachments(item) && (hasAttachments || ATTACHMENT_SIGNAL_RE.test(normalizedMessage))) {
      return false;
    }
    return true;
  });

  const needsAttachmentButMissing =
    checklist.some((item) => checklistNeedsAttachments(item)) &&
    !hasAttachments &&
    !ATTACHMENT_SIGNAL_RE.test(normalizedMessage);

  if (missingChecklist.length === 0 && !needsAttachmentButMissing) {
    return { shouldClarify: false };
  }

  const visibleMissing = missingChecklist.slice(0, 3);
  const suggestionSet = new Set<string>();
  if (needsAttachmentButMissing) {
    suggestionSet.add('补一张参考图或商品图');
  }
  visibleMissing.forEach((item) => suggestionSet.add(`补充${item}`));

  return {
    shouldClarify: true,
    message:
      '先别急着执行，这个 Skill 还缺几项关键信息。我先把最影响结果的部分补齐，再继续往下跑会更稳。',
    questions: visibleMissing.map((item) => `请补充${item}。`),
    suggestions: Array.from(suggestionSet).slice(0, 4),
    missingChecklist,
  };
};
