import type {
  AgentRoutingDecision,
  AgentTaskMetadata,
  AgentType,
} from '../../types/agent.types.ts';

const QUESTION_INTENT_PATTERN =
  /\b(what|why|how|which|explain|describe|analy[sz]e|identify|tell me|look at)\b/i;
const RESEARCH_INTENT_PATTERN =
  /\b(research|investigate|study|look up|reference|compare)\b/i;
const LAYOUT_INTENT_PATTERN = /\blayout\b/i;
const TEXT_INTENT_PATTERN = /\btext\b/i;
const TOUCH_INTENT_PATTERN = /\b(touch|region)\b/i;
const EDIT_INTENT_PATTERN =
  /\b(edit|replace|remove|move|align|resize|delete|insert|modify)\b/i;
const GENERATION_INTENT_PATTERN =
  /\b(generate|create|draw|poster|banner|design)\b/i;

const QUESTION_HINTS = [
  '这是什么',
  '这是啥',
  '帮我看看',
  '看一下',
  '解释',
  '说明',
  '分析',
  '怎么',
  '为什么',
  '识别',
];

const RESEARCH_HINTS = [
  '调查',
  '调研',
  '研究',
  '查资料',
  '竞品',
  '品牌信息',
  '产品信息',
  '搜索',
];

const LAYOUT_HINTS = ['排版', '版式'];
const TEXT_HINTS = ['文字', '文案', '改字'];
const TOUCH_HINTS = ['局部', '区域', '圈选'];
const EDIT_HINTS = [
  '修改',
  '替换',
  '编辑',
  '改成',
  '换成',
  '移动',
  '对齐',
  '缩放',
  '删除',
  '插入',
];
const GENERATION_HINTS = ['生成', '出图', '做图', '海报', '横幅', '设计'];

const includesAny = (text: string, hints: string[]) =>
  hints.some((hint) => text.includes(hint));

const hasReferenceImages = (metadata?: AgentTaskMetadata) =>
  Array.isArray(metadata?.multimodalContext?.referenceImageUrls) &&
  metadata.multimodalContext.referenceImageUrls.length > 0;

const isQuestionLike = (message: string) => {
  const lower = String(message || '').toLowerCase();
  return QUESTION_INTENT_PATTERN.test(lower) || includesAny(message, QUESTION_HINTS);
};

const isResearchIntent = (message: string) => {
  const lower = String(message || '').toLowerCase();
  return RESEARCH_INTENT_PATTERN.test(lower) || includesAny(message, RESEARCH_HINTS);
};

const isLayoutIntent = (message: string) => {
  const lower = String(message || '').toLowerCase();
  return LAYOUT_INTENT_PATTERN.test(lower) || includesAny(message, LAYOUT_HINTS);
};

const isTextIntent = (message: string) => {
  const lower = String(message || '').toLowerCase();
  return (
    TEXT_INTENT_PATTERN.test(lower) ||
    lower.includes('copy') ||
    includesAny(message, TEXT_HINTS)
  );
};

const isTouchIntent = (message: string) => {
  const lower = String(message || '').toLowerCase();
  return TOUCH_INTENT_PATTERN.test(lower) || includesAny(message, TOUCH_HINTS);
};

const isEditIntent = (message: string) => {
  const lower = String(message || '').toLowerCase();
  return EDIT_INTENT_PATTERN.test(lower) || includesAny(message, EDIT_HINTS);
};

const isExplicitGenerationIntent = (message: string) => {
  const lower = String(message || '').toLowerCase();
  return (
    GENERATION_INTENT_PATTERN.test(lower) ||
    includesAny(message, GENERATION_HINTS)
  );
};

export const inferTaskModeFromRequest = (
  message: string,
  metadata?: AgentTaskMetadata,
) => {
  const effectiveTaskMode = String(metadata?.taskMode || '').trim().toLowerCase();

  if (effectiveTaskMode) {
    return effectiveTaskMode as
      | 'chat'
      | 'research'
      | 'layout-edit'
      | 'text-edit'
      | 'touch-edit'
      | 'edit'
      | 'generate';
  }

  if (metadata?.allowAutonomousRouting === true) {
    if (hasReferenceImages(metadata) && isQuestionLike(message)) return 'chat' as const;
    if (
      metadata?.enableWebSearch ||
      metadata?.multimodalContext?.research ||
      isResearchIntent(message)
    ) {
      return 'research' as const;
    }
    if (isLayoutIntent(message)) return 'layout-edit' as const;
    if (isTextIntent(message)) return 'text-edit' as const;
    if (isTouchIntent(message)) return 'touch-edit' as const;
    if (isEditIntent(message)) return 'edit' as const;
    return 'chat' as const;
  }

  if (
    metadata?.enableWebSearch ||
    metadata?.multimodalContext?.research ||
    isResearchIntent(message)
  ) {
    return 'research' as const;
  }

  if (
    metadata?.skillData?.name?.toLowerCase?.().includes('text') ||
    isTextIntent(message)
  ) {
    return 'text-edit' as const;
  }

  if (isLayoutIntent(message)) return 'layout-edit' as const;
  if (isTouchIntent(message)) return 'touch-edit' as const;
  if (isEditIntent(message)) return 'edit' as const;
  return 'generate' as const;
};

export const isUnifiedSidebarAgent = (metadata?: AgentTaskMetadata) =>
  metadata?.allowAutonomousRouting === true &&
  metadata?.skillData?.id === 'autonomous-main-brain' &&
  metadata?.skillData?.config &&
  typeof metadata.skillData.config === 'object' &&
  (metadata.skillData.config as Record<string, unknown>).mode ===
    'unified-sidebar-agent';

export const shouldPreferAutonomousChatFallback = (
  message: string,
  metadata?: AgentTaskMetadata,
  attachments?: File[],
) => {
  if (metadata?.allowAutonomousRouting !== true) return false;
  const taskMode = String(metadata?.taskMode || '').trim().toLowerCase();
  if (taskMode && taskMode !== 'chat') return false;

  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  return (
    (hasAttachments || hasReferenceImages(metadata)) &&
    isQuestionLike(message) &&
    !isExplicitGenerationIntent(message)
  );
};

export const buildUnifiedSidebarRoutingDecision = (
  message: string,
): AgentRoutingDecision => ({
  action: 'route',
  targetAgent: 'coco',
  taskType: 'unified-sidebar-agent',
  complexity: 'simple',
  handoffMessage: [
    'Read the user message, attachments, and current workspace context first.',
    'Decide whether this request is best handled as an answer, research, planning, or workspace execution.',
    'Do not force the request into a fixed workflow unless the user clearly requires execution.',
    `Original user request: ${message}`,
  ].join('\n'),
  confidence: 0.98,
  roleStrategy: 'reuse',
  roleStrategyReason:
    'Unified sidebar agent should see the raw user input first and decide the next workflow itself.',
});

export const buildAutonomousChatRoutingDecision = (
  message: string,
  taskType:
    | 'autonomous-visual-chat'
    | 'autonomous-visual-chat-fallback' = 'autonomous-visual-chat',
): AgentRoutingDecision => ({
  action: 'route',
  targetAgent: 'coco',
  taskType,
  complexity: 'simple',
  handoffMessage: [
    'Answer from the fresh visual input first.',
    'Do not enter image generation, poster creation, or execution flow unless the request truly needs it.',
    `User request: ${message}`,
  ].join('\n'),
  confidence: taskType === 'autonomous-visual-chat' ? 0.92 : 0.85,
  roleStrategy: 'reuse',
  roleStrategyReason:
    taskType === 'autonomous-visual-chat'
      ? 'Autonomous multimodal chat should answer first when the user is asking about fresh visual input.'
      : 'Route API failed, so the safest fallback is to keep the request in autonomous multimodal chat mode.',
});

export const buildFallbackRoutingDecision = (
  message: string,
  targetAgent: AgentType,
): AgentRoutingDecision => ({
  action: 'route',
  targetAgent,
  taskType: 'fallback',
  complexity: 'simple',
  handoffMessage: `User request: ${message}`,
  confidence: 0.4,
  roleStrategy: 'reuse',
  roleStrategyReason:
    targetAgent === 'coco'
      ? 'Fallback kept the request in autonomous multimodal chat mode.'
      : 'Fallback used the safest default specialist path.',
});
