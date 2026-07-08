import type { AgentTaskMetadata } from '../../types/agent.types.ts';
import type { ChatMessage } from '../../types/common.ts';
import { extractImageUrlsFromResult } from './image-result-extractor.ts';
import { normalizeRegisteredSkillName } from '../skills/skill-manifest.ts';
import {
  normalizeExecutionRecipeLines,
  normalizeFrontstageSkillRouteIntent,
  parseExecutionRecipeLines,
  type FrontstageExecutionRecipeStep,
} from '../runtime-assets/frontstage-skill-recipes.ts';
import {
  IMAGE_EDIT_SIGNAL_RE as SHARED_EDIT_SIGNAL_RE,
  CONTEXTUAL_EDIT_FOLLOW_UP_RE as SHARED_CONTEXTUAL_EDIT_FOLLOW_UP_RE,
  isReferenceOnlyEditContinuationText,
  resolveFollowUpImageEditInstruction,
} from './image-edit-follow-up.ts';

export interface FrontstageSkillExecutionProfile {
  active: boolean;
  skillId: string;
  frontstageSkillId: string;
  skillLabel: string;
  routeIntent: string;
  routeLabel: string;
  routeSummary: string;
  followUpMode: 'auto-clarify' | 'direct-run' | null;
  preferredSkills: string[];
  blockedSkills: string[];
  preferredFirstSkill: string | null;
  requiresResearchOptIn: boolean;
  suggestedTaskMode: string;
  requiresAttachments: boolean;
  isCustomSkill: boolean;
  instruction: string;
  clarifyChecklist: string[];
  reusableQuestions: string[];
  executionOutline: string[];
  executionRecipeLines: string[];
  executionRecipe: FrontstageExecutionRecipeStep[];
  outputBlueprint: string[];
  toolPolicy: string[];
}

type SkillCallLike = {
  skillName?: string;
  params?: Record<string, any>;
};

type SkillExecutionResultLike = {
  skillName?: string;
  success?: boolean;
  result?: unknown;
  params?: Record<string, any>;
};

const normalizeString = (value: unknown) => String(value || '').trim();

const normalizeStringList = (value: unknown, maxItems = 8): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => normalizeString(item))
        .filter(Boolean)
        .slice(0, maxItems)
    : [];

const containsAny = (source: string, patterns: string[]) =>
  patterns.some((pattern) => source.includes(pattern));

const getSkillConfig = (metadata?: Record<string, any>) => {
  const skillData =
    metadata?.skillData && typeof metadata.skillData === 'object'
      ? (metadata.skillData as Record<string, unknown>)
      : null;
  const config =
    skillData?.config && typeof skillData.config === 'object'
      ? (skillData.config as Record<string, unknown>)
      : null;
  return { skillData, config };
};

const canExecuteWorkspaceSearch = (
  metadata?: AgentTaskMetadata | Record<string, any>,
) => {
  const typedMetadata = metadata as Record<string, any> | undefined;
  return (
    typedMetadata?.enableWebSearch === true &&
    typedMetadata?.webResearchStatus !== 'failed'
  );
};

const dedupeSkills = (skills: string[]) => {
  const seen = new Set<string>();
  return skills.filter((skill) => {
    const normalized = normalizeRegisteredSkillName(skill);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

const dedupeStrings = (items: string[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalized = normalizeString(item);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

const inferBlockedSkillsFromToolPolicy = (toolPolicy: string[]): string[] => {
  const text = toolPolicy.join('\n').toLowerCase();
  const blocked = new Set<string>();

  if (
    containsAny(text, [
      '不要一上来直接出成片',
      '不要一上来直接出视频',
      '不要直接出成片',
      '先不要直接生成视频',
      '不要先做视频',
      'do not jump straight into final video',
      "don't start with final video",
      'do not generate final video first',
    ])
  ) {
    blocked.add('generateVideo');
  }

  if (
    containsAny(text, [
      '不要把整套轮播压成一张图',
      '不要把多屏压成一张图',
      '不要压成一张图',
      'do not compress the whole set into one image',
      'do not compress multiple pages into one image',
    ])
  ) {
    blocked.add('generateImage');
  }

  return [...blocked];
};

const inferPreferredFirstSkillFromToolPolicy = (
  toolPolicy: string[],
  preferredSkills: string[],
): string | null => {
  const text = toolPolicy.join('\n').toLowerCase();

  if (
    containsAny(text, [
      '先用 generatecopy',
      '优先用 generatecopy',
      'use generatecopy first',
      'start with generatecopy',
    ]) &&
    preferredSkills.includes('generateCopy')
  ) {
    return 'generateCopy';
  }
  if (
    containsAny(text, [
      '先用 workspacesearch',
      '先搜索',
      '先研究',
      'use workspacesearch first',
      'start with workspacesearch',
      'start with research',
    ]) &&
    preferredSkills.includes('workspaceSearch')
  ) {
    return 'workspaceSearch';
  }
  if (
    containsAny(text, [
      '先用 smartedit',
      '先编辑',
      'use smartedit first',
      'start with smartedit',
    ]) &&
    preferredSkills.includes('smartEdit')
  ) {
    return 'smartEdit';
  }

  return preferredSkills[0] || null;
};

const inferRequiresResearchOptInFromToolPolicy = (toolPolicy: string[]) => {
  const text = toolPolicy.join('\n').toLowerCase();
  return containsAny(text, [
    '只有用户明确要补竞品',
    '只有用户明确要补研究',
    '明确要补竞品',
    '明确要补趋势',
    '才调用 workspacesearch',
    'only when the user explicitly asks for research',
    'only search when explicit',
    'only use workspacesearch when explicit',
    'only call workspacesearch when',
  ]);
};

const GENERATION_SIGNAL_RE =
  /(生成|出图|做图|来一版|做一版|新一版|海报|封面|KV|详情页|轮播|社媒|视频|短视频|分镜|广告|视觉|banner|poster|hero|carousel|storyboard|video|shorts)/i;
const RESEARCH_SIGNAL_RE =
  /(研究|调研|查找|搜索|联网|资料|竞品|趋势|reference|research|compare|search|look up)/i;
const EDIT_SIGNAL_RE =
  /(修改|替换|编辑|去掉|抠图|去背景|remove|replace|edit|recolor|upscale)/i;
const VIDEO_SIGNAL_RE =
  /(video|reel|shorts|motion|storyboard|视频|短视频|分镜|镜头)/i;

const COPY_SIGNAL_RE =
  /(copy|headline|tagline|caption|script|outline|story|brief|hook|messaging|narrative|title|slogan|文案|标题|脚本|提纲|分镜)/i;
const EXECUTION_CONTINUATION_SIGNAL_RE =
  /(continue|keep going|move ahead|proceed|finish this|start making|build it|create it|继续|接着|往下|推进|开始做|继续做|做这个|跑一下)/i;

const FRONTSTAGE_CONTRACT_MARKER = '[Frontstage Skill Contract]';
const FRONTSTAGE_EDIT_MARKER = '[Frontstage Skill Edit Contract]';
const UPSTREAM_CONTEXT_MARKER = '[Upstream Workflow Context]';
const CONTEXTUAL_EDIT_FOLLOW_UP_RE =
  /(?:\u4e0d\u8981|\u53bb\u6389|\u62ff\u6389|\u5220\u6389|\u79fb\u9664|\u53bb\u9664|\u6362\u6210|\u6539\u6210|\u6539\u4e3a|\u4fdd\u7559|\u52a0\u4e0a|\u52a0\u4e2a|\u6362\u4e2a|\u53d8\u6210|\u8c03\u6210|\u5f31\u4e00\u70b9|\u5f3a\u4e00\u70b9|\u5c11\u4e00\u70b9|\u591a\u4e00\u70b9|\u4e0d\u8981\u6709|without|remove|drop|delete|replace|change|turn it into|make it)/i;

const extractActionableSkillRequest = (message: string) => {
  const text = normalizeString(message);
  if (!text) return '';

  const runtimeMatch = text.match(
    /\[Original User Request\]\s*([\s\S]*?)\s*\[Runtime State Snapshot\]/i,
  );
  if (runtimeMatch?.[1]) {
    return normalizeString(runtimeMatch[1]);
  }

  return text;
};

const SKILL_META_SUBJECT_RE =
  /(?:\bskills?\b|\bworkflow\b|\bpreset\b|\u6280\u80fd|\u5de5\u4f5c\u6d41|\u9884\u8bbe|\u5feb\u6377\u64cd\u4f5c)/i;
const SKILL_META_QUERY_RE =
  /(?:\u54ea\u4e2a|\u54ea\u4e00\u4e2a|\u4ec0\u4e48|\u5f53\u524d|\u9009\u4e2d|\u6b63\u5728\u7528|\u770b\u5230|\u6211\u95ee\u7684|\u600e\u4e48|\u5982\u4f55|\u89e3\u91ca|\u8bf4\u660e|which|what|current|selected|active|see|using|explain|tell me|show me|can you|how)/i;
const SKILL_META_DIRECT_EXECUTION_RE =
  /(?:\u751f\u6210|\u51fa\u56fe|\u505a\u56fe|\u753b\u4e00|\u6267\u884c|\u8fd0\u884c|\u5f00\u59cb|\u7ee7\u7eed|generate|create|make|run|execute|render|start|continue)/i;

export const isFrontstageSkillMetaQuestion = (message: string): boolean => {
  const text = extractActionableSkillRequest(normalizeString(message));
  if (!text) return false;
  if (!SKILL_META_SUBJECT_RE.test(text) || !SKILL_META_QUERY_RE.test(text)) {
    return false;
  }
  return !SKILL_META_DIRECT_EXECUTION_RE.test(text);
};

export const shouldSuppressFrontstageSkillExecutionForMessage = ({
  message,
  metadata,
}: {
  message: string;
  metadata?: AgentTaskMetadata | Record<string, any>;
}): boolean => {
  const profile = resolveFrontstageSkillExecutionProfile(metadata);
  return profile.active && isFrontstageSkillMetaQuestion(message);
};

const hasImageLikeAttachments = (attachments?: File[]) =>
  Array.isArray(attachments) &&
  attachments.some((file) => String(file?.type || '').startsWith('image/'));

const getReferenceImageUrls = (
  metadata?: AgentTaskMetadata | Record<string, any>,
): string[] =>
  normalizeStringList(
    (metadata as Record<string, any> | undefined)?.multimodalContext?.referenceImageUrls,
    8,
  );

const getConversationHistory = (
  metadata?: AgentTaskMetadata | Record<string, any>,
): ChatMessage[] => {
  const history = (metadata as Record<string, any> | undefined)?.conversationHistory;
  return Array.isArray(history) ? (history as ChatMessage[]) : [];
};

const resolveSmartEditInstruction = ({
  message,
  metadata,
  conversationHistory,
}: {
  message: string;
  metadata?: AgentTaskMetadata | Record<string, any>;
  conversationHistory?: ChatMessage[];
}) =>
  resolveFollowUpImageEditInstruction({
    message,
    conversationHistory:
      conversationHistory && conversationHistory.length > 0
        ? conversationHistory
        : getConversationHistory(metadata),
  });

const isContextualImageEditFollowUp = ({
  message,
  attachments,
  metadata,
}: {
  message: string;
  attachments?: File[];
  metadata?: AgentTaskMetadata | Record<string, any>;
}) =>
  hasImageEditContext({ attachments, metadata }) &&
  isEditRequest({ message, attachments, metadata });

const hasImageEditContext = ({
  attachments,
  metadata,
}: {
  attachments?: File[];
  metadata?: AgentTaskMetadata | Record<string, any>;
}) => hasImageLikeAttachments(attachments) || getReferenceImageUrls(metadata).length > 0;

const buildAttachmentTokens = (attachments?: File[]) =>
  Array.isArray(attachments)
    ? attachments
        .map((file, index) =>
          String(file?.type || '').startsWith('image/') ? `ATTACHMENT_${index}` : '',
        )
        .filter(Boolean)
    : [];

const extractAspectRatioFromMessage = (message: string): string | null => {
  const normalized = normalizeString(message);
  if (/(横版|横屏|宽屏|16\s*[:：]\s*9|landscape)/i.test(normalized)) return '16:9';
  if (/(竖版|竖屏|手机屏|9\s*[:：]\s*16|portrait)/i.test(normalized)) return '9:16';
  if (/(方图|正方形|1\s*[:：]\s*1|square)/i.test(normalized)) return '1:1';
  if (/(3\s*[:：]\s*4)/i.test(normalized)) return '3:4';
  if (/(4\s*[:：]\s*3)/i.test(normalized)) return '4:3';
  return null;
};

const extractImageSizeFromMessage = (
  message: string,
): '1K' | '2K' | '4K' | null => {
  const normalized = normalizeString(message);
  if (/(4K|4096|3840|超清|超高分辨率)/i.test(normalized)) return '4K';
  if (/(2K|2048|高清|高分辨率)/i.test(normalized)) return '2K';
  if (/(1K|1024)/i.test(normalized)) return '1K';
  return null;
};

const createVisualGenerationFallbackCall = ({
  skillName,
  message,
  attachments,
}: {
  skillName: 'generateImage' | 'generateVideo';
  message: string;
  attachments?: File[];
}) => {
  const attachmentTokens = buildAttachmentTokens(attachments);
  const params: Record<string, unknown> = {
    prompt: message,
  };
  const aspectRatio = extractAspectRatioFromMessage(message);
  const imageSize = extractImageSizeFromMessage(message);

  if (aspectRatio) {
    params.aspectRatio = aspectRatio;
  }

  if (attachmentTokens.length > 0) {
    if (skillName === 'generateImage') {
      params.referenceImage = attachmentTokens[0];
      params.referenceImages = attachmentTokens;
      params.referencePriority = attachmentTokens.length > 1 ? 'all' : 'first';
    } else {
      params.referenceImages = attachmentTokens;
      params.startFrame = attachmentTokens[0];
    }
  }

  if (skillName === 'generateImage' && imageSize) {
    params.imageSize = imageSize;
  }

  return {
    skillName,
    params,
  };
};

const createSearchFallbackCall = (message: string) => ({
  skillName: 'workspaceSearch',
  params: {
    query: message,
    mode: 'web',
    includePageExtracts: true,
    maxExtractPages: 2,
  },
});

const isContinuationExecutionRequest = ({
  message,
  profile,
}: {
  message: string;
  profile: FrontstageSkillExecutionProfile;
}) => {
  const text = normalizeString(message);
  if (!text || !EXECUTION_CONTINUATION_SIGNAL_RE.test(text)) {
    return false;
  }

  return (
    profile.routeIntent !== 'general' ||
    profile.preferredSkills.length > 0 ||
    profile.executionRecipe.some((step) => Boolean(step.skillName))
  );
};

const isVisualRequest = ({
  message,
  attachments,
  metadata,
}: {
  message: string;
  attachments?: File[];
  metadata?: AgentTaskMetadata | Record<string, any>;
}) => {
  const taskMode = normalizeString((metadata as Record<string, any> | undefined)?.taskMode).toLowerCase();
  return (
    GENERATION_SIGNAL_RE.test(message) ||
    hasImageLikeAttachments(attachments) ||
    taskMode === 'generate' ||
    taskMode === 'edit' ||
    taskMode === 'touch-edit'
  );
};

const isVideoRequest = ({
  message,
  metadata,
  profile,
}: {
  message: string;
  metadata?: AgentTaskMetadata | Record<string, any>;
  profile: FrontstageSkillExecutionProfile;
}) => {
  const taskMode = normalizeString((metadata as Record<string, any> | undefined)?.taskMode).toLowerCase();
  return (
    profile.routeIntent === 'video' ||
    taskMode === 'video' ||
    VIDEO_SIGNAL_RE.test(message)
  );
};

const isResearchRequest = ({
  message,
  metadata,
}: {
  message: string;
  metadata?: AgentTaskMetadata | Record<string, any>;
}) => {
  const taskMode = normalizeString((metadata as Record<string, any> | undefined)?.taskMode).toLowerCase();
  return RESEARCH_SIGNAL_RE.test(message) || taskMode === 'research';
};

const isEditRequest = ({
  message,
  attachments,
  metadata,
}: {
  message: string;
  attachments?: File[];
  metadata?: AgentTaskMetadata | Record<string, any>;
}) => {
  const taskMode = normalizeString((metadata as Record<string, any> | undefined)?.taskMode).toLowerCase();
  if (
    EDIT_SIGNAL_RE.test(message) ||
    SHARED_EDIT_SIGNAL_RE.test(message) ||
    taskMode === 'edit' ||
    taskMode === 'touch-edit'
  ) {
    return true;
  }

  return (
    hasImageEditContext({ attachments, metadata }) &&
    (
      CONTEXTUAL_EDIT_FOLLOW_UP_RE.test(message) ||
      SHARED_CONTEXTUAL_EDIT_FOLLOW_UP_RE.test(message) ||
      isReferenceOnlyEditContinuationText(message)
    )
  );
};

const shouldTriggerCopyPlanning = ({
  message,
  wantsVisual,
  wantsVideo,
  wantsEdit,
  wantsResearch,
  profile,
}: {
  message: string;
  wantsVisual: boolean;
  wantsVideo: boolean;
  wantsEdit: boolean;
  wantsResearch: boolean;
  profile: FrontstageSkillExecutionProfile;
}) => {
  if (wantsVisual || wantsVideo || wantsEdit) {
    return true;
  }
  if (COPY_SIGNAL_RE.test(message)) {
    return true;
  }
  if (wantsResearch) {
    return false;
  }
  return isContinuationExecutionRequest({ message, profile });
};

const selectActiveRecipeSteps = ({
  profile,
  message,
  attachments,
  metadata,
}: {
  profile: FrontstageSkillExecutionProfile;
  message: string;
  attachments?: File[];
  metadata?: AgentTaskMetadata | Record<string, any>;
}) => {
  const wantsVisual = isVisualRequest({ message, attachments, metadata });
  const wantsVideo = isVideoRequest({ message, metadata, profile });
  const wantsResearch = isResearchRequest({ message, metadata });
  const wantsEdit = isEditRequest({ message, attachments, metadata });
  const hasAttachments = hasImageEditContext({ attachments, metadata });

  return profile.executionRecipe.filter((step) => {
    switch (step.when) {
      case 'always':
        return true;
      case 'explicit-research':
        return wantsResearch;
      case 'visual-request':
        return wantsVisual || wantsVideo;
      case 'final-video':
        return wantsVideo;
      case 'attachment-edit':
        return wantsEdit && hasAttachments;
      default:
        return false;
    }
  });
};

const getRecipeSkillOrder = (profile: FrontstageSkillExecutionProfile) => {
  const order = new Map<string, number>();
  profile.executionRecipe.forEach((step, index) => {
    const skillName = normalizeRegisteredSkillName(step.skillName);
    if (!skillName || order.has(skillName)) return;
    order.set(skillName, index);
  });
  return order;
};

const truncateLine = (value: unknown, maxChars: number) => {
  const text = normalizeString(value);
  if (!text) return '';
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}...`;
};

const readSearchContextLines = (result: unknown): string[] => {
  if (!result || typeof result !== 'object') return [];
  const record = result as Record<string, unknown>;
  const lines: string[] = [];

  if (typeof record.summary === 'string' && record.summary.trim()) {
    lines.push(truncateLine(record.summary, 220));
  }

  if (Array.isArray(record.extractedPages)) {
    for (const item of record.extractedPages.slice(0, 2)) {
      if (!item || typeof item !== 'object') continue;
      const excerpt = truncateLine(
        (item as Record<string, unknown>).cleanedTextExcerpt ||
          (item as Record<string, unknown>).excerpt,
        180,
      );
      if (excerpt) {
        lines.push(excerpt);
      }
    }
  }

  return dedupeStrings(lines).slice(0, 2);
};

const readCopyContextLines = (result: unknown): string[] => {
  if (!Array.isArray(result)) return [];
  return dedupeStrings(
    result
      .map((item) => truncateLine(item, 120))
      .filter(Boolean),
  ).slice(0, 3);
};

const buildUpstreamWorkflowContext = (
  priorResults: SkillExecutionResultLike[],
): {
  notes: string[];
  imageUrls: string[];
} => {
  const notes: string[] = [];
  const imageUrls: string[] = [];

  for (const item of priorResults || []) {
    if (!item?.success) continue;
    const skillName = normalizeRegisteredSkillName(item.skillName);
    if (skillName === 'workspaceSearch') {
      notes.push(...readSearchContextLines(item.result));
      continue;
    }
    if (skillName === 'generateCopy') {
      notes.push(...readCopyContextLines(item.result));
      continue;
    }
    if (skillName === 'generateImage') {
      imageUrls.push(...extractImageUrlsFromResult(item.result));
    }
  }

  return {
    notes: dedupeStrings(notes).slice(0, 4),
    imageUrls: dedupeStrings(imageUrls).slice(0, 4),
  };
};

const buildFrontstageContractPrompt = ({
  profile,
  prompt,
  upstreamNotes,
  activeRecipe,
}: {
  profile: FrontstageSkillExecutionProfile;
  prompt: string;
  upstreamNotes: string[];
  activeRecipe: FrontstageExecutionRecipeStep[];
}) => {
  const lines = [
    FRONTSTAGE_CONTRACT_MARKER,
    `Skill: ${profile.routeLabel || profile.skillLabel || profile.frontstageSkillId || profile.skillId}`,
    profile.routeSummary ? `Focus: ${profile.routeSummary}` : '',
    profile.instruction ? `Instruction: ${truncateLine(profile.instruction, 260)}` : '',
    profile.executionOutline.length > 0
      ? `Execution Outline: ${profile.executionOutline.map((item) => truncateLine(item, 96)).join(' | ')}`
      : '',
    activeRecipe.length > 0
      ? `Execution Recipe: ${activeRecipe.map((step) => truncateLine(step.goal, 96)).join(' | ')}`
      : '',
    profile.outputBlueprint.length > 0
      ? `Deliverable: ${profile.outputBlueprint.map((item) => truncateLine(item, 96)).join(' | ')}`
      : '',
    upstreamNotes.length > 0
      ? `${UPSTREAM_CONTEXT_MARKER}: ${upstreamNotes.map((item) => truncateLine(item, 140)).join(' | ')}`
      : '',
    '',
    '[Current Request]',
    prompt,
  ].filter(Boolean);

  return lines.join('\n');
};

const extractPromptBodyFromFrontstageContract = (prompt: string) => {
  const normalized = normalizeString(prompt);
  if (!normalized.includes(FRONTSTAGE_CONTRACT_MARKER)) {
    return normalized;
  }

  const currentRequestMatch = normalized.match(
    /\[Current Request\]\s*([\s\S]*)$/i,
  );
  if (currentRequestMatch?.[1]) {
    return normalizeString(currentRequestMatch[1]);
  }

  return normalized
    .replace(/\[Frontstage Skill Contract\][\s\S]*?(?=\[Current Request\]|$)/i, '')
    .replace(/\[Current Request\]/gi, '')
    .trim();
};

const buildFrontstageVisualPrompt = ({
  profile,
  prompt,
  upstreamNotes,
}: {
  profile: FrontstageSkillExecutionProfile;
  prompt: string;
  upstreamNotes: string[];
}) => {
  const basePrompt = extractPromptBodyFromFrontstageContract(prompt);
  if (!basePrompt) {
    return '';
  }

  const flavorLines = [
    profile.routeSummary ? `Creative focus: ${truncateLine(profile.routeSummary, 180)}.` : '',
    profile.instruction ? `Workflow note: ${truncateLine(profile.instruction, 180)}.` : '',
    upstreamNotes.length > 0
      ? `Useful context: ${upstreamNotes.map((item) => truncateLine(item, 120)).join(' | ')}.`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return flavorLines ? `${basePrompt}\n\n${flavorLines}` : basePrompt;
};

const buildFrontstageEditInstruction = ({
  profile,
  instruction,
  upstreamNotes,
}: {
  profile: FrontstageSkillExecutionProfile;
  instruction: string;
  upstreamNotes: string[];
}) => {
  const lines = [
    FRONTSTAGE_EDIT_MARKER,
    `Skill: ${profile.routeLabel || profile.skillLabel || profile.frontstageSkillId || profile.skillId}`,
    profile.routeSummary ? `Focus: ${profile.routeSummary}` : '',
    profile.instruction ? `Instruction: ${truncateLine(profile.instruction, 220)}` : '',
    upstreamNotes.length > 0
      ? `${UPSTREAM_CONTEXT_MARKER}: ${upstreamNotes.map((item) => truncateLine(item, 140)).join(' | ')}`
      : '',
    '',
    '[Current Edit Request]',
    instruction,
  ].filter(Boolean);

  return lines.join('\n');
};

const mergeReferenceImages = (current: unknown, next: string[]) => {
  const merged = Array.isArray(current)
    ? dedupeStrings([...current.map((item) => normalizeString(item)), ...next])
    : dedupeStrings(next);
  return merged.slice(0, 6);
};

export const resolveFrontstageSkillExecutionProfile = (
  metadata?: AgentTaskMetadata | Record<string, any>,
): FrontstageSkillExecutionProfile => {
  const typedMetadata = metadata as Record<string, any> | undefined;
  const { skillData, config } = getSkillConfig(typedMetadata);
  const skillId = normalizeString(skillData?.id);
  const frontstageSkillId =
    normalizeString(config?.frontstageSkillId) || skillId;
  const preferredSkills = dedupeSkills(
    normalizeStringList(config?.preferredSkills).map((item) =>
      normalizeRegisteredSkillName(item),
    ),
  );
  const toolPolicy = normalizeStringList(config?.toolPolicy, 8);
  const blockedSkills = dedupeSkills(
    inferBlockedSkillsFromToolPolicy(toolPolicy).map((item) =>
      normalizeRegisteredSkillName(item),
    ),
  );
  const networkResearchEnabled = canExecuteWorkspaceSearch(metadata);
  if (!networkResearchEnabled) {
    blockedSkills.push('workspaceSearch');
  }
  const preferredFirstSkill = normalizeRegisteredSkillName(
    inferPreferredFirstSkillFromToolPolicy(toolPolicy, preferredSkills),
  );
  const followUpModeRaw =
    normalizeString((typedMetadata as Record<string, any> | undefined)?.skillFollowUpMode) ||
    normalizeString(config?.followUpMode);
  const followUpMode =
    followUpModeRaw === 'auto-clarify' || followUpModeRaw === 'direct-run'
      ? followUpModeRaw
      : null;
  const routeIntent = normalizeFrontstageSkillRouteIntent(config?.routeIntent);
  const executionRecipeLines = normalizeExecutionRecipeLines(
    config?.executionRecipe,
    routeIntent,
    8,
  );

  return {
    active:
      typedMetadata?.allowAutonomousRouting === true &&
      Boolean(skillId || frontstageSkillId),
    skillId,
    frontstageSkillId,
    skillLabel: normalizeString(skillData?.name),
    routeIntent,
    routeLabel: normalizeString(config?.routeLabel || skillData?.name),
    routeSummary: normalizeString(config?.routeSummary),
    followUpMode,
    preferredSkills,
    blockedSkills: dedupeSkills(blockedSkills),
    preferredFirstSkill:
      preferredFirstSkill && !blockedSkills.includes(preferredFirstSkill)
        ? preferredFirstSkill
        : null,
    requiresResearchOptIn: inferRequiresResearchOptInFromToolPolicy(toolPolicy),
    suggestedTaskMode: normalizeString(config?.suggestedTaskMode).toLowerCase(),
    requiresAttachments: config?.requiresAttachments === true,
    isCustomSkill: config?.isCustomSkill === true,
    instruction: normalizeString(config?.instruction || config?.customInstruction),
    clarifyChecklist: normalizeStringList(config?.clarifyChecklist, 8),
    reusableQuestions: normalizeStringList(config?.reusableQuestions, 8),
    executionOutline: normalizeStringList(config?.executionOutline, 8),
    executionRecipeLines,
    executionRecipe: parseExecutionRecipeLines(executionRecipeLines, routeIntent, 8),
    outputBlueprint: normalizeStringList(config?.outputBlueprint, 8),
    toolPolicy,
  };
};

export const mergePreferredSkillsWithFrontstageProfile = (
  agentPreferredSkills: string[],
  metadata?: AgentTaskMetadata | Record<string, any>,
): string[] => {
  const profile = resolveFrontstageSkillExecutionProfile(metadata);
  if (!profile.active || profile.preferredSkills.length === 0) {
    return dedupeSkills(
      (agentPreferredSkills || []).map((item) => normalizeRegisteredSkillName(item)),
    );
  }

  return dedupeSkills([
    ...profile.preferredSkills,
    ...(agentPreferredSkills || []).map((item) => normalizeRegisteredSkillName(item)),
  ]);
};

export const prioritizeSkillCallsForFrontstageProfile = (
  skillCalls: any[],
  metadata?: AgentTaskMetadata | Record<string, any>,
): any[] => {
  const profile = resolveFrontstageSkillExecutionProfile(metadata);
  if (!profile.active || !Array.isArray(skillCalls)) {
    return skillCalls || [];
  }

  const recipeOrder = getRecipeSkillOrder(profile);
  const preferredOrder = new Map(
    profile.preferredSkills.map((skill, index) => [normalizeRegisteredSkillName(skill), index]),
  );

  const filtered = [...skillCalls].filter((call) => {
    const skillName = normalizeRegisteredSkillName(call?.skillName);
    if (!skillName) return true;
    if (profile.blockedSkills.includes(skillName)) {
      return false;
    }
    if (
      profile.requiresResearchOptIn &&
      skillName === 'workspaceSearch' &&
      !RESEARCH_SIGNAL_RE.test(String(call?.params?.query || call?.params?.prompt || ''))
    ) {
      return false;
    }
    return true;
  });

  return filtered.sort((left, right) => {
    const leftSkill = normalizeRegisteredSkillName(left?.skillName);
    const rightSkill = normalizeRegisteredSkillName(right?.skillName);

    const leftRecipeRank = recipeOrder.get(leftSkill);
    const rightRecipeRank = recipeOrder.get(rightSkill);
    if (leftRecipeRank !== undefined || rightRecipeRank !== undefined) {
      if (leftRecipeRank === undefined) return 1;
      if (rightRecipeRank === undefined) return -1;
      if (leftRecipeRank !== rightRecipeRank) {
        return leftRecipeRank - rightRecipeRank;
      }
    }

    if (profile.preferredFirstSkill) {
      if (leftSkill === profile.preferredFirstSkill && rightSkill !== profile.preferredFirstSkill) {
        return -1;
      }
      if (rightSkill === profile.preferredFirstSkill && leftSkill !== profile.preferredFirstSkill) {
        return 1;
      }
    }
    const leftRank = preferredOrder.get(leftSkill);
    const rightRank = preferredOrder.get(rightSkill);

    if (leftRank === undefined && rightRank === undefined) return 0;
    if (leftRank === undefined) return 1;
    if (rightRank === undefined) return -1;
    return leftRank - rightRank;
  });
};

export const shouldBypassAutonomousChatSuppression = (
  metadata?: AgentTaskMetadata | Record<string, any>,
  message?: string,
) => {
  if (message && shouldSuppressFrontstageSkillExecutionForMessage({ message, metadata })) {
    return false;
  }
  const profile = resolveFrontstageSkillExecutionProfile(metadata);
  return (
    profile.active &&
    (profile.followUpMode === 'direct-run' ||
      (message
        ? isContextualImageEditFollowUp({
            message,
            metadata,
          })
        : false))
  );
};

const shouldAttemptExecutionFallback = ({
  message,
  attachments,
  metadata,
  profile,
}: {
  message: string;
  attachments?: File[];
  metadata?: AgentTaskMetadata | Record<string, any>;
  profile: FrontstageSkillExecutionProfile;
}) => {
  if (!profile.active) return false;
  if (isFrontstageSkillMetaQuestion(message)) return false;

  const taskMode = normalizeString((metadata as Record<string, any> | undefined)?.taskMode).toLowerCase();
  const normalizedMessage = normalizeString(message);
  if (!normalizedMessage) return false;

  const contextualEditFollowUp = isContextualImageEditFollowUp({
    message: normalizedMessage,
    attachments,
    metadata,
  });
  if (profile.followUpMode !== 'direct-run' && !contextualEditFollowUp) return false;

  if (profile.requiresAttachments && !hasImageEditContext({ attachments, metadata })) {
    return false;
  }

  const actionable =
    GENERATION_SIGNAL_RE.test(normalizedMessage) ||
    RESEARCH_SIGNAL_RE.test(normalizedMessage) ||
    isEditRequest({ message: normalizedMessage, attachments, metadata }) ||
    hasImageLikeAttachments(attachments) ||
    isContinuationExecutionRequest({
      message: normalizedMessage,
      profile,
    });

  if (!taskMode || taskMode === 'chat') {
    return actionable;
  }

  return actionable;
};

type FrontstageFallbackBuildContext = {
  actionableMessage: string;
  attachments?: File[];
  metadata?: AgentTaskMetadata | Record<string, any>;
  profile: FrontstageSkillExecutionProfile;
  wantsResearch: boolean;
  wantsEdit: boolean;
  wantsVideo: boolean;
  wantsVisual: boolean;
  activeRecipe: FrontstageExecutionRecipeStep[];
};

const buildFrontstageFallbackContext = ({
  message,
  attachments,
  metadata,
  profile,
  conversationHistory,
}: {
  message: string;
  attachments?: File[];
  metadata?: AgentTaskMetadata | Record<string, any>;
  profile: FrontstageSkillExecutionProfile;
  conversationHistory?: ChatMessage[];
}): FrontstageFallbackBuildContext => {
  const actionableMessage = resolveSmartEditInstruction({
    message: extractActionableSkillRequest(normalizeString(message)),
    metadata,
    conversationHistory,
  });
  const wantsResearch = isResearchRequest({
    message: actionableMessage,
    metadata,
  });
  const wantsEdit = isEditRequest({
    message: actionableMessage,
    attachments,
    metadata,
  });
  const wantsVideo = isVideoRequest({
    message: actionableMessage,
    metadata,
    profile,
  });
  const wantsVisual = isVisualRequest({
    message: actionableMessage,
    attachments,
    metadata,
  });
  const activeRecipe = selectActiveRecipeSteps({
    profile,
    message: actionableMessage,
    attachments,
    metadata,
  });

  return {
    actionableMessage,
    attachments,
    metadata,
    profile,
    wantsResearch,
    wantsEdit,
    wantsVideo,
    wantsVisual,
    activeRecipe,
  };
};

const buildCopyFallbackCall = ({
  actionableMessage,
  profile,
  activeRecipe,
}: Pick<
  FrontstageFallbackBuildContext,
  'actionableMessage' | 'profile' | 'activeRecipe'
>) => ({
  skillName: 'generateCopy',
  params: {
    prompt: buildFrontstageContractPrompt({
      profile,
      prompt: [
        actionableMessage,
        '',
        'Return concise planning-first copy outputs as a JSON array of strings.',
        'Prefer hooks, outlines, page structures, shot lists, captions, scripts, or messaging skeletons over generic slogans.',
      ]
        .filter(Boolean)
        .join('\n'),
      upstreamNotes: [],
      activeRecipe,
    }),
    variations: 3,
  },
});

const buildFrontstageFallbackCallForSkill = ({
  skillName,
  actionableMessage,
  attachments,
  metadata,
  profile,
  wantsResearch,
  wantsEdit,
  wantsVideo,
  wantsVisual,
  activeRecipe,
}: FrontstageFallbackBuildContext & {
  skillName: string | null;
}): { skillName: string; params: Record<string, unknown> } | null => {
  const normalizedSkillName = normalizeRegisteredSkillName(skillName);
  if (!normalizedSkillName || profile.blockedSkills.includes(normalizedSkillName)) {
    return null;
  }

  switch (normalizedSkillName) {
    case 'smartEdit':
      if (wantsEdit) {
        const sourceUrl =
          buildAttachmentTokens(attachments)[0] || getReferenceImageUrls(metadata)[0];
        if (!sourceUrl) {
          return null;
        }
        return {
          skillName: 'smartEdit',
          params: {
            sourceUrl,
            instruction: actionableMessage,
          },
        };
      }
      return null;
    case 'workspaceSearch':
      if (profile.requiresResearchOptIn && !wantsResearch) {
        return null;
      }
      return wantsResearch ? createSearchFallbackCall(actionableMessage) : null;
    case 'generateCopy':
      return shouldTriggerCopyPlanning({
        message: actionableMessage,
        wantsVisual,
        wantsVideo,
        wantsEdit,
        wantsResearch,
        profile,
      })
        ? buildCopyFallbackCall({
            actionableMessage,
            profile,
            activeRecipe,
          })
        : null;
    case 'generateImage':
      return wantsVisual || wantsVideo
        ? createVisualGenerationFallbackCall({
            skillName: 'generateImage',
            message: actionableMessage,
            attachments,
          })
        : null;
    case 'generateVideo':
      return wantsVideo
        ? createVisualGenerationFallbackCall({
            skillName: 'generateVideo',
            message: actionableMessage,
            attachments,
          })
        : null;
    default:
      return null;
  }
};

const buildExecutionFallbackSkillCalls = ({
  message,
  attachments,
  metadata,
  profile,
  conversationHistory,
}: {
  message: string;
  attachments?: File[];
  metadata?: AgentTaskMetadata | Record<string, any>;
  profile: FrontstageSkillExecutionProfile;
  conversationHistory?: ChatMessage[];
}) => {
  const preferred = profile.preferredSkills;
  const {
    actionableMessage,
    wantsResearch,
    wantsEdit,
    wantsVideo,
    wantsVisual,
    activeRecipe,
  } = buildFrontstageFallbackContext({
    message,
    attachments,
    metadata,
    profile,
    conversationHistory,
  });

  const fallbackCalls: Array<{ skillName: string; params: Record<string, unknown> }> = [];
  const seenSkillNames = new Set<string>();

  const pushFallbackCall = (
    call: { skillName: string; params: Record<string, unknown> } | null,
  ) => {
    if (!call) return;
    const normalizedSkillName = normalizeRegisteredSkillName(call.skillName);
    if (!normalizedSkillName || seenSkillNames.has(normalizedSkillName)) {
      return;
    }
    seenSkillNames.add(normalizedSkillName);
    fallbackCalls.push({
      ...call,
      skillName: normalizedSkillName,
    });
  };

  if (
    wantsEdit &&
    preferred.includes('smartEdit') &&
    !profile.blockedSkills.includes('smartEdit') &&
    hasImageEditContext({ attachments, metadata })
  ) {
    const smartEditCall = buildFrontstageFallbackCallForSkill({
      skillName: 'smartEdit',
      actionableMessage,
      attachments,
      metadata,
      profile,
      wantsResearch,
      wantsEdit,
      wantsVideo,
      wantsVisual,
      activeRecipe,
    });
    return smartEditCall ? [smartEditCall] : [];
  }

  activeRecipe.forEach((step) => {
    pushFallbackCall(
      buildFrontstageFallbackCallForSkill({
        skillName: step.skillName,
        actionableMessage,
        attachments,
        metadata,
        profile,
        wantsResearch,
        wantsEdit,
        wantsVideo,
        wantsVisual,
        activeRecipe,
      }),
    );
  });

  if (profile.preferredFirstSkill) {
    pushFallbackCall(
      buildFrontstageFallbackCallForSkill({
        skillName: profile.preferredFirstSkill,
        actionableMessage,
        attachments,
        metadata,
        profile,
        wantsResearch,
        wantsEdit,
        wantsVideo,
        wantsVisual,
        activeRecipe,
      }),
    );
  }

  if (wantsResearch && preferred.includes('workspaceSearch')) {
    pushFallbackCall(
      buildFrontstageFallbackCallForSkill({
        skillName: 'workspaceSearch',
        actionableMessage,
        attachments,
        metadata,
        profile,
        wantsResearch,
        wantsEdit,
        wantsVideo,
        wantsVisual,
        activeRecipe,
      }),
    );
  }

  if (preferred.includes('generateCopy')) {
    pushFallbackCall(
      buildFrontstageFallbackCallForSkill({
        skillName: 'generateCopy',
        actionableMessage,
        attachments,
        metadata,
        profile,
        wantsResearch,
        wantsEdit,
        wantsVideo,
        wantsVisual,
        activeRecipe,
      }),
    );
  }

  if (wantsVideo && preferred.includes('generateImage')) {
    pushFallbackCall(
      buildFrontstageFallbackCallForSkill({
        skillName: 'generateImage',
        actionableMessage,
        attachments,
        metadata,
        profile,
        wantsResearch,
        wantsEdit,
        wantsVideo,
        wantsVisual,
        activeRecipe,
      }),
    );
  }

  if (wantsVideo && preferred.includes('generateVideo')) {
    pushFallbackCall(
      buildFrontstageFallbackCallForSkill({
        skillName: 'generateVideo',
        actionableMessage,
        attachments,
        metadata,
        profile,
        wantsResearch,
        wantsEdit,
        wantsVideo,
        wantsVisual,
        activeRecipe,
      }),
    );
  }

  if (fallbackCalls.length === 0 && wantsVisual && preferred.includes('generateImage')) {
    pushFallbackCall(
      buildFrontstageFallbackCallForSkill({
        skillName: 'generateImage',
        actionableMessage,
        attachments,
        metadata,
        profile,
        wantsResearch,
        wantsEdit,
        wantsVideo,
        wantsVisual,
        activeRecipe,
      }),
    );
  }

  if (fallbackCalls.length === 0 && wantsResearch) {
    return preferred.includes('workspaceSearch') &&
      !profile.blockedSkills.includes('workspaceSearch')
      ? [createSearchFallbackCall(actionableMessage)]
      : [];
  }

  return prioritizeSkillCallsForFrontstageProfile(fallbackCalls, metadata);
};

const backfillMissingFrontstageRecipeSkillCalls = ({
  skillCalls,
  originalMessage,
  attachments,
  metadata,
  profile,
  conversationHistory,
}: {
  skillCalls: any[];
  originalMessage: string;
  attachments?: File[];
  metadata?: AgentTaskMetadata | Record<string, any>;
  profile: FrontstageSkillExecutionProfile;
  conversationHistory?: ChatMessage[];
}): {
  skillCalls: any[];
  injectedSkillNames: string[];
} => {
  if (!profile.active || !Array.isArray(skillCalls) || skillCalls.length === 0) {
    return {
      skillCalls: prioritizeSkillCallsForFrontstageProfile(skillCalls || [], metadata),
      injectedSkillNames: [],
    };
  }

  const {
    actionableMessage,
    wantsResearch,
    wantsEdit,
    wantsVideo,
    wantsVisual,
    activeRecipe,
  } = buildFrontstageFallbackContext({
    message: originalMessage,
    attachments,
    metadata,
    profile,
    conversationHistory,
  });

  const existingNormalizedSkillNames = new Set(
    (skillCalls || [])
      .map((call) => normalizeRegisteredSkillName(call?.skillName))
      .filter(Boolean),
  );
  const injectedSkillNames: string[] = [];
  const injectedCalls: any[] = [];

  activeRecipe.forEach((step) => {
    const normalizedRecipeSkillName = normalizeRegisteredSkillName(step.skillName);
    if (!normalizedRecipeSkillName || existingNormalizedSkillNames.has(normalizedRecipeSkillName)) {
      return;
    }

    const fallbackCall = buildFrontstageFallbackCallForSkill({
      skillName: normalizedRecipeSkillName,
      actionableMessage,
      attachments,
      metadata,
      profile,
      wantsResearch,
      wantsEdit,
      wantsVideo,
      wantsVisual,
      activeRecipe,
    });

    if (!fallbackCall) return;
    existingNormalizedSkillNames.add(normalizedRecipeSkillName);
    injectedSkillNames.push(normalizedRecipeSkillName);
    injectedCalls.push(fallbackCall);
  });

  return {
    skillCalls: prioritizeSkillCallsForFrontstageProfile(
      [...injectedCalls, ...(skillCalls || [])],
      metadata,
    ),
    injectedSkillNames,
  };
};

export type RepairAutonomousSkillPlanRepairEvent =
  | {
      kind: 'backfill';
      injectedSkillNames: string[];
      skillCallsBefore: number;
      skillCallsAfter: number;
    }
  | {
      kind: 'fallback';
      firstSkillName: string;
      skillCallsAfter: number;
      reason: string;
    };

export const repairAutonomousSkillPlan = ({
  plan,
  originalMessage,
  attachments,
  metadata,
  conversationHistory,
  onRepair,
}: {
  plan: Record<string, any>;
  originalMessage: string;
  attachments?: File[];
  metadata?: AgentTaskMetadata | Record<string, any>;
  conversationHistory?: ChatMessage[];
  onRepair?: (event: RepairAutonomousSkillPlanRepairEvent) => void;
}) => {
  const nextPlan = plan && typeof plan === 'object' ? plan : {};
  const existingSkillCalls = Array.isArray(nextPlan.skillCalls) ? nextPlan.skillCalls : [];
  const profile = resolveFrontstageSkillExecutionProfile(metadata);

  if (profile.active && isFrontstageSkillMetaQuestion(originalMessage)) {
    nextPlan.skillCalls = [];
    nextPlan.message =
      normalizeString(nextPlan.message) ||
      `当前选中的 Skill 是 ${profile.routeLabel || profile.skillLabel || profile.frontstageSkillId || profile.skillId || '当前 Skill'}。`;
    return nextPlan;
  }

  if (existingSkillCalls.length > 0) {
    const repairedExistingSkillCalls = backfillMissingFrontstageRecipeSkillCalls({
      skillCalls: existingSkillCalls,
      originalMessage,
      attachments,
      metadata,
      profile,
      conversationHistory,
    });
    nextPlan.skillCalls = repairedExistingSkillCalls.skillCalls;
    if (repairedExistingSkillCalls.injectedSkillNames.length > 0) {
      try {
        onRepair?.({
          kind: 'backfill',
          injectedSkillNames: repairedExistingSkillCalls.injectedSkillNames.slice(0, 8),
          skillCallsBefore: existingSkillCalls.length,
          skillCallsAfter: Array.isArray(nextPlan.skillCalls) ? nextPlan.skillCalls.length : 0,
        });
      } catch {
        /* best effort: repair observer must never break execution */
      }
      const injectedLabel = repairedExistingSkillCalls.injectedSkillNames.join(', ');
      nextPlan.analysis =
        normalizeString(nextPlan.analysis) ||
        `Auto-repaired the selected skill workflow by restoring missing prerequisite steps: ${injectedLabel}.`;
      nextPlan.preGenerationMessage =
        normalizeString(nextPlan.preGenerationMessage) ||
        `The selected skill had missing prerequisite steps, so I restored ${injectedLabel} before continuing.`;
    }
    return nextPlan;
  }

  if (
    !shouldAttemptExecutionFallback({
      message: originalMessage,
      attachments,
      metadata,
      profile,
    })
  ) {
    return nextPlan;
  }

  const fallbackSkillCalls = buildExecutionFallbackSkillCalls({
    message: originalMessage,
    attachments,
    metadata,
    profile,
    conversationHistory,
  });
  if (fallbackSkillCalls.length === 0) {
    return nextPlan;
  }

  const firstSkillName = normalizeRegisteredSkillName(fallbackSkillCalls[0]?.skillName);
  try {
    onRepair?.({
      kind: 'fallback',
      firstSkillName: firstSkillName || '',
      skillCallsAfter: fallbackSkillCalls.length,
      reason: 'no plan skillCalls; injected execution fallback',
    });
  } catch {
    /* best effort: repair observer must never break execution */
  }
  return {
    ...nextPlan,
    analysis:
      normalizeString(nextPlan.analysis) ||
      `已根据当前技能流程补齐执行步骤，准备继续生成。`,
    preGenerationMessage:
      normalizeString(nextPlan.preGenerationMessage) ||
      `我已经接入生成流程，先按你的当前要求开始处理。`,
    message:
      normalizeString(nextPlan.message) ||
      '好的，正在继续执行。',
    skillCalls: prioritizeSkillCallsForFrontstageProfile(
      fallbackSkillCalls,
      metadata,
    ),
  };
};

export const shouldExecuteFrontstageSkillSequentially = ({
  skillCalls,
  metadata,
}: {
  skillCalls: SkillCallLike[];
  metadata?: AgentTaskMetadata | Record<string, any>;
}) => {
  const profile = resolveFrontstageSkillExecutionProfile(metadata);
  if (!profile.active || !Array.isArray(skillCalls) || skillCalls.length < 2) {
    return false;
  }

  const normalizedSkillNames = skillCalls.map((call) =>
    normalizeRegisteredSkillName(call?.skillName),
  );
  const hasWorkflowBridgeSkill = normalizedSkillNames.some((skillName) =>
    ['workspaceSearch', 'generateCopy', 'generateVideo'].includes(skillName),
  );

  return hasWorkflowBridgeSkill;
};

export const hydrateSkillCallWithFrontstageProfile = ({
  call,
  metadata,
  originalMessage,
  priorResults = [],
}: {
  call: SkillCallLike;
  metadata?: AgentTaskMetadata | Record<string, any>;
  originalMessage?: string;
  priorResults?: SkillExecutionResultLike[];
}): SkillCallLike => {
  const profile = resolveFrontstageSkillExecutionProfile(metadata);
  if (!profile.active) {
    return call;
  }

  const nextCall: SkillCallLike = {
    ...call,
    params: {
      ...(call?.params || {}),
    },
  };
  const skillName = normalizeRegisteredSkillName(call?.skillName);
  const baseText = extractActionableSkillRequest(
    normalizeString(
      nextCall.params?.prompt ||
        nextCall.params?.instruction ||
        nextCall.params?.query ||
        originalMessage,
    ),
  );
  const upstream = buildUpstreamWorkflowContext(priorResults);
  const activeRecipe = selectActiveRecipeSteps({
    profile,
    message: baseText,
    attachments: undefined,
    metadata,
  });

  if (
    (skillName === 'generateImage' || skillName === 'generateVideo') &&
    typeof nextCall.params?.prompt !== 'string'
  ) {
    nextCall.params = {
      ...(nextCall.params || {}),
      prompt: baseText,
    };
  }

  if (skillName === 'generateImage') {
    const currentPrompt = normalizeString(nextCall.params?.prompt || baseText);
    const visualPrompt = buildFrontstageVisualPrompt({
      profile,
      prompt: currentPrompt,
      upstreamNotes: upstream.notes,
    });
    if (visualPrompt) {
      nextCall.params = {
        ...(nextCall.params || {}),
        prompt: visualPrompt,
      };
    }
  }

  if (skillName === 'generateVideo') {
    const currentPrompt = normalizeString(nextCall.params?.prompt || baseText);
    if (currentPrompt && !currentPrompt.includes(FRONTSTAGE_CONTRACT_MARKER)) {
      nextCall.params = {
        ...(nextCall.params || {}),
        prompt: buildFrontstageContractPrompt({
          profile,
          prompt: currentPrompt,
          upstreamNotes: upstream.notes,
          activeRecipe,
        }),
      };
    }

    if (skillName === 'generateVideo' && upstream.imageUrls.length > 0) {
      nextCall.params = {
        ...(nextCall.params || {}),
        referenceImages: mergeReferenceImages(
          nextCall.params?.referenceImages,
          upstream.imageUrls,
        ),
        startFrame:
          normalizeString(nextCall.params?.startFrame) ||
          upstream.imageUrls[0],
      };
    }
  }

  if (skillName === 'generateCopy') {
    const currentPrompt = normalizeString(nextCall.params?.prompt || baseText);
    if (currentPrompt && !currentPrompt.includes(FRONTSTAGE_CONTRACT_MARKER)) {
      nextCall.params = {
        ...(nextCall.params || {}),
        prompt: buildFrontstageContractPrompt({
          profile,
          prompt: currentPrompt,
          upstreamNotes: upstream.notes,
          activeRecipe,
        }),
      };
    }
  }

  if (skillName === 'workspaceSearch' && !normalizeString(nextCall.params?.query)) {
    nextCall.params = {
      ...(nextCall.params || {}),
      query: baseText,
    };
  }

  if (skillName === 'smartEdit') {
    const currentInstruction = normalizeString(
      nextCall.params?.instruction || nextCall.params?.editInstruction || baseText,
    );
    if (currentInstruction && !currentInstruction.includes(FRONTSTAGE_EDIT_MARKER)) {
      nextCall.params = {
        ...(nextCall.params || {}),
        instruction: buildFrontstageEditInstruction({
          profile,
          instruction: currentInstruction,
          upstreamNotes: upstream.notes,
        }),
      };
    }
  }

  return nextCall;
};
