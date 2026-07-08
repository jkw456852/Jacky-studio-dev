import type { AgentTaskMetadata } from '../../types/agent.types';
import type { ChatMessage } from '../../types';
import {
  isExplicitImageEditInstructionText,
  isReferenceOnlyEditContinuationText,
} from './image-edit-follow-up.ts';

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
  /(附图|上传|参考图|商品图|产品图|原图|截图|素材|logo|主图|模特图|image|images|attachment|attachments|reference)/i;
const SKILL_HELP_SIGNAL_RE =
  /(?:(?:这个|该|当前|所选).{0,6})?(?:skill|技能).{0,18}(?:能干嘛|能做什么|怎么用|怎么使用|是什么|介绍一下|介绍|用途|适合什么|help|usage|what can|how to use|about)|(?:what can this skill do|how should i use this skill|tell me about this skill)/i;
const EXECUTION_INTENT_SIGNAL_RE =
  /(?:帮我|给我|我想|我要|做|生成|创建|继续|推进|规划|分析|整理|写|产出|脑暴|brainstorm|create|generate|make|plan|design|continue|draft|build|write|analyze)/i;
const CORE_PROBLEM_SIGNAL_RE =
  /(?:想解决|解决|核心问题|核心诉求|目标|卡点|方向|创意|命名|卖点|problem|goal|objective|direction|brief)/i;
const CARRIER_SIGNAL_RE =
  /(?:品牌|brand|海报|poster|kv|key visual|视频|video|短视频|reel|shorts|社媒|轮播|carousel|包装|packaging|campaign|网页|landing page|落地页|文案|copy|分镜|storyboard|脚本|script|banner)/i;
const CONSTRAINT_SIGNAL_RE =
  /(?:必须|保留|避开|不要|别|不能|避免|沿用|延续|参考|禁止|元素|风格|must keep|avoid|constraint|do not|don't|keep)/i;

const normalizeChecklist = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];

const normalizeQuestions = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => String(item || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];

const normalizeText = (value: unknown) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeMemoryText = (value: unknown, maxLength = 240) =>
  normalizeText(value).slice(0, maxLength);

const normalizeConversationHistory = (value: unknown): ChatMessage[] =>
  Array.isArray(value)
    ? value
        .filter((item) => Boolean(item) && typeof item === 'object')
        .map((item) => item as ChatMessage)
        .slice(-10)
    : [];

const extractRecentUserEvidence = (
  history: ChatMessage[],
): {
  text: string;
  hasAttachments: boolean;
} => {
  const recentUserMessages = history.filter((message) => message.role === 'user').slice(-6);
  const text = recentUserMessages
    .map((message) => normalizeText(message.text))
    .filter(Boolean)
    .join('\n');
  const hasAttachments = recentUserMessages.some((message) => {
    const inlineAttachmentCount = Array.isArray(message.inlineParts)
      ? message.inlineParts.filter((part) => part.type === 'attachment').length
      : 0;
    return (
      (Array.isArray(message.attachments) && message.attachments.length > 0) ||
      inlineAttachmentCount > 0
    );
  });

  return {
    text,
    hasAttachments,
  };
};

const isSkillHelpRequest = (message: string) => {
  const text = normalizeText(message);
  if (!text) return false;
  return SKILL_HELP_SIGNAL_RE.test(text);
};

const isActionableExecutionRequest = (message: string) => {
  const text = normalizeText(message);
  if (!text) return false;

  return (
    isExplicitImageEditInstructionText(text) ||
    isReferenceOnlyEditContinuationText(text) ||
    EXECUTION_INTENT_SIGNAL_RE.test(text) ||
    CARRIER_SIGNAL_RE.test(text) ||
    ATTACHMENT_SIGNAL_RE.test(text)
  );
};

const hasImageReferenceContext = (
  attachments: File[] | undefined,
  metadata: AgentTaskMetadata | undefined,
  history: ChatMessage[],
) => {
  if (Array.isArray(attachments) && attachments.some((file) => String(file?.type || '').startsWith('image/'))) {
    return true;
  }

  const metadataUrls = Array.isArray(metadata?.multimodalContext?.referenceImageUrls)
    ? metadata?.multimodalContext?.referenceImageUrls
    : [];
  if (metadataUrls.length > 0) {
    return true;
  }

  return history.some((message) => {
    const inlineAttachmentCount = Array.isArray(message.inlineParts)
      ? message.inlineParts.filter((part) => part.type === 'attachment').length
      : 0;
    const imageUrls = Array.isArray(message.agentData?.imageUrls) ? message.agentData?.imageUrls.length : 0;
    return (
      (Array.isArray(message.attachments) && message.attachments.length > 0) ||
      inlineAttachmentCount > 0 ||
      imageUrls > 0
    );
  });
};

const matchesGenericChecklistItem = (message: string, item: string): boolean => {
  const text = normalizeText(message);
  const label = normalizeText(item);
  if (!text || !label) return false;

  if (/(想解决|核心问题|核心诉求|problem|goal|objective)/i.test(label)) {
    return CORE_PROBLEM_SIGNAL_RE.test(text) || isActionableExecutionRequest(text);
  }

  if (/(载体|落到|最终|交付|输出格式|deliverable|format|channel|platform)/i.test(label)) {
    return CARRIER_SIGNAL_RE.test(text);
  }

  if (/(保留|避开|元素|限制|约束|avoid|constraint|must keep)/i.test(label)) {
    return CONSTRAINT_SIGNAL_RE.test(text) || ATTACHMENT_SIGNAL_RE.test(text);
  }

  return false;
};

const matchesChecklistItem = (message: string, item: string): boolean => {
  const text = normalizeText(message);
  const loweredText = text.toLowerCase();
  const label = normalizeText(item);
  const loweredLabel = label.toLowerCase();
  if (!text || !label) return false;

  if (matchesGenericChecklistItem(text, label)) {
    return true;
  }

  const containsAny = (aliases: string[]) =>
    aliases.some((alias) => loweredText.includes(alias.toLowerCase()));

  const aliasMap: Array<[RegExp, string[]]> = [
    [/(品牌调性|品牌方向|brand)/i, ['调性', '品牌感', '品牌方向', '视觉系统', 'vi', '高级', '极简', '科技感', '复古']],
    [/(受众|人群|定位|audience)/i, ['受众', '人群', '定位', '客群', '用户']],
    [/(视觉参考|风格参考|参考)/i, ['参考', '案例', '对标', '附图', '截图']],
    [/(视频用途|用途|使用场景)/i, ['视频', '用途', '投放', '发布', '场景']],
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
      if (/(品牌调性|品牌方向|brand)/i.test(label)) {
        return (
          containsAny(['调性', '品牌感', '品牌方向', '视觉系统', 'vi']) ||
          (containsAny(['高级', '极简', '科技感', '复古']) &&
            containsAny(['风格', '感觉', '调性', '品牌']))
        );
      }
      if (/(受众|人群|定位|audience)/i.test(label)) {
        return (
          containsAny(['受众', '人群', '定位', '客群', '用户']) ||
          /(年龄|女性|男性|学生|宝妈|白领|消费者|新手|高端)/i.test(text)
        );
      }
      return containsAny(aliases);
    }
  }

  return loweredText.includes(loweredLabel);
};

const checklistNeedsAttachments = (item: string) =>
  /(图|素材|logo|截图|参考|商品|产品|模特|附件|image|attachment)/i.test(item);

const buildChecklistQuestion = (
  item: string,
  successfulPrompt: string,
  successfulSummary: string,
): string => {
  const normalizedItem = normalizeText(item);
  if (!normalizedItem) {
    return '请先补充这次任务里最关键的缺失信息。';
  }

  const successfulContext = [successfulPrompt, successfulSummary]
    .filter(Boolean)
    .join(' ');

  if (successfulContext && matchesChecklistItem(successfulContext, normalizedItem)) {
    return `上次跑通这个 Skill 时，${normalizedItem} 是关键输入。这次你想沿用还是调整？`;
  }

  return `请先补充${normalizedItem}。`;
};

export const evaluateSkillClarifyGate = ({
  message,
  attachments,
  metadata,
  conversationHistory,
}: {
  message: string;
  attachments?: File[];
  metadata?: AgentTaskMetadata;
  conversationHistory?: ChatMessage[];
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

  const followUpMode = String(metadata?.skillFollowUpMode || skillConfig.followUpMode || '').trim();
  if (followUpMode !== 'auto-clarify') {
    return { shouldClarify: false };
  }

  const checklist = normalizeChecklist(metadata?.skillClarifyChecklist || skillConfig.clarifyChecklist);
  const reusableQuestions = normalizeQuestions(skillConfig.reusableQuestions);
  const successfulPrompt = normalizeMemoryText(
    skillConfig.lastSuccessfulPrompt || skillConfig.examplePrompt || skillConfig.sourceUserPrompt,
    200,
  );
  const successfulSummary = normalizeMemoryText(
    skillConfig.lastSuccessfulSummary || skillConfig.summary,
    220,
  );
  const successfulOutput = normalizeMemoryText(skillConfig.lastSuccessfulOutput, 180);

  if (checklist.length === 0) {
    return { shouldClarify: false };
  }

  const normalizedMessage = normalizeText(message);
  if (isSkillHelpRequest(normalizedMessage)) {
    return { shouldClarify: false };
  }

  const recentHistory = normalizeConversationHistory(conversationHistory);
  const contextualImageEditFollowUp =
    hasImageReferenceContext(attachments, metadata, recentHistory) &&
    (isExplicitImageEditInstructionText(normalizedMessage) ||
      isReferenceOnlyEditContinuationText(normalizedMessage));
  if (contextualImageEditFollowUp) {
    return { shouldClarify: false };
  }
  const recentUserEvidence = extractRecentUserEvidence(recentHistory);
  const evidenceText = [recentUserEvidence.text, normalizedMessage]
    .filter(Boolean)
    .join('\n');
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  const hasConversationAttachmentEvidence = recentUserEvidence.hasAttachments;

  const missingChecklist = checklist.filter((item) => {
    if (matchesChecklistItem(evidenceText, item)) {
      return false;
    }
    if (
      checklistNeedsAttachments(item) &&
      (hasAttachments ||
        hasConversationAttachmentEvidence ||
        ATTACHMENT_SIGNAL_RE.test(evidenceText))
    ) {
      return false;
    }
    return true;
  });

  const needsAttachmentButMissing =
    checklist.some((item) => checklistNeedsAttachments(item)) &&
    !hasAttachments &&
    !hasConversationAttachmentEvidence &&
    !ATTACHMENT_SIGNAL_RE.test(evidenceText);
  const actionableRequest = isActionableExecutionRequest(evidenceText);

  if (missingChecklist.length === 0 && !needsAttachmentButMissing) {
    return { shouldClarify: false };
  }

  if (!actionableRequest) {
    return { shouldClarify: false };
  }

  if (missingChecklist.length <= 1 && !needsAttachmentButMissing) {
    return { shouldClarify: false };
  }

  const visibleMissing = missingChecklist.slice(0, 3);
  const reusableQuestionMatches = reusableQuestions.filter((question) =>
    visibleMissing.some((item) => {
      const normalizedItem = normalizeText(item);
      return normalizedItem && question.includes(normalizedItem);
    }),
  );

  const suggestionSet = new Set<string>();
  if (needsAttachmentButMissing) {
    suggestionSet.add('补一张参考图或商品图');
  }
  visibleMissing.forEach((item) => suggestionSet.add(`补充${item}`));
  if (successfulPrompt) {
    suggestionSet.add('参考上次跑通这个 Skill 的输入方式补齐关键信息');
  }
  if (successfulOutput) {
    suggestionSet.add('补齐输入后我会按这个 Skill 之前跑通的结构继续执行');
  }

  return {
    shouldClarify: true,
    message:
      '先别急着执行，这个 Skill 还缺几项关键信息。我先把最影响结果的部分补齐，再继续往下跑会更稳。',
    questions:
      reusableQuestionMatches.length > 0
        ? reusableQuestionMatches.slice(0, 3)
        : visibleMissing.map((item) => buildChecklistQuestion(item, successfulPrompt, successfulSummary)),
    suggestions: Array.from(suggestionSet).slice(0, 4),
    missingChecklist,
  };
};
