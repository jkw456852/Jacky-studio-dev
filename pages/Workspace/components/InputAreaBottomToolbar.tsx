import React from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  ArrowUp,
  Banana,
  Box,
  Check,
  ChevronDown,
  Globe,
  Hash,
  Image as ImageIcon,
  Library,
  Lightbulb,
  Paperclip,
  Sparkles,
  Type,
  Video,
  X,
  Zap,
  Layers,
  Cloud,
} from 'lucide-react';
import type {
  ChatMessage,
  ChatSendOptions,
  InputBlock,
  ImageModel,
  VideoModel,
} from '../../../types';
import {
  getMappedModelConfigs,
  getMappedModelDisplaySummary,
  getMappedPrimaryModelConfig,
  getMappedPrimaryModelLabel,
  getModelDisplayLabel,
} from '../../../services/provider-settings';
import { getStudioUserAssetApi } from '../../../services/runtime-assets/api';
import {
  setActiveQuickSkillPreference,
  upsertCustomSkillPreference,
} from '../../../services/runtime-assets/preferences';
import { getFrontstageSkillId } from '../../../services/runtime-assets/skill-identity';
import { useAgentStore } from '../../../stores/agent.store';

const MODEL_OPTIONS: Record<
  string,
  {
    id: string;
    name: string;
    desc: string;
    time?: string;
    icon: React.ElementType;
    badge?: string;
  }[]
> = {
  image: [
    { id: 'Nano Banana Pro', name: 'Nano Banana Pro', desc: "Professional's choice for advanced outputs.", time: '20s', icon: Banana },
    { id: 'NanoBanana2', name: 'Nano Banana 2', desc: 'Generalist fast image generation model.', time: '15s', icon: Zap },
    { id: 'dall-e-3', name: 'DALL路E 3', desc: "OpenAI's most advanced image model.", time: '120s', icon: Sparkles },
    { id: 'Seedream5.0', name: 'Seedream 5.0 Lite', desc: "Bytedance's latest image generation model.", time: '120s', icon: Activity },
    { id: 'flux-schnell', name: 'Flux Schnell', desc: "BFL's fast image generation model.", time: '10s', icon: Layers },
    { id: 'flux-pro', name: 'Flux.1 Pro', desc: "BFL's image generation model.", time: '10s', icon: Layers },
    { id: 'gemini-1.5-pro', name: 'Gemini Imagen 4', desc: "Google's most advanced image model.", time: '10s', icon: Sparkles },
    { id: 'midjourney', name: 'Midjourney', desc: 'A model that transforms text into artistic visuals.', time: '20s', icon: Globe },
  ],
  video: [
    { id: 'veo-3.1-fast-generate-preview', name: 'Veo 3.1 Fast', desc: "Google's ultra-fast video generation model.", time: '10s', icon: Cloud, badge: '极速版' },
    { id: 'veo-3.1-generate-preview', name: 'Veo 3.1 Pro', desc: "Google's high-quality video generation model.", time: '180s', icon: Cloud, badge: '专业版' },
    { id: 'kling-3.0', name: 'Kling 3.0', desc: "Kling's latest video model.", time: '300s', icon: Video, badge: '蓝海5型' },
    { id: 'sora-2', name: 'Sora 2', desc: "OpenAI's flagship video generation model. Single image only.", time: '300s', icon: Sparkles, badge: '单图参考' },
    { id: 'runway-gen3', name: 'Runway Gen-3', desc: 'Video generation model with built-in audio.', time: '600s', icon: Activity },
  ],
  '3d': [{ id: 'Tripo', name: 'Tripo', desc: 'High-quality 3D model generator.', icon: Box }],
};

type ToolbarModelOption = {
  optionKey?: string;
  id: string;
  name: string;
  desc: string;
  time?: string;
  icon: React.ElementType;
  badge?: string;
  providerId?: string | null;
  providerName?: string | null;
};

const DEFAULT_MODEL_ICON_BY_CATEGORY: Record<'image' | 'video' | '3d', React.ElementType> = {
  image: Sparkles,
  video: Video,
  '3d': Box,
};

const toToolbarOptions = (
  options: {
    id: string;
    name: string;
    desc: string;
    time?: string;
    icon: React.ElementType;
    badge?: string;
  }[],
): ToolbarModelOption[] =>
  options.map((option) => ({
    ...option,
    optionKey: option.id,
    providerId: null,
    providerName: null,
  }));

type InputAreaBottomToolbarProps = {
  creationMode: 'agent' | 'image' | 'video';
  setCreationMode: (mode: 'agent' | 'image' | 'video') => void;
  handleSend: (
    overridePrompt?: string,
    overrideAttachments?: File[],
    overrideWeb?: boolean,
    skillData?: ChatMessage['skillData'],
    sendOptions?: ChatSendOptions,
  ) => Promise<void>;
  handleModeSwitch: (mode: 'thinking' | 'fast') => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  showModeSelector: boolean;
  setShowModeSelector: (value: boolean) => void;
  showRatioPicker: boolean;
  setShowRatioPicker: (value: boolean) => void;
  showModelPicker: boolean;
  setShowModelPicker: (value: boolean) => void;
  showVideoSettingsDropdown: boolean;
  setShowVideoSettingsDropdown: (value: boolean) => void;
  showModelPreference: boolean;
  setShowModelPreference: (value: boolean) => void;
  modelPreferenceTab: 'image' | 'video' | '3d';
  setModelPreferenceTab: (tab: 'image' | 'video' | '3d') => void;
  autoModelSelect: boolean;
  setAutoModelSelect: (value: boolean) => void;
  preferredImageModel: ImageModel;
  setPreferredImageModel: (value: ImageModel) => void;
  preferredImageProviderId: string | null;
  setPreferredImageProviderId: (value: string | null) => void;
  preferredVideoModel: VideoModel;
  setPreferredVideoModel: (value: VideoModel) => void;
  preferredVideoProviderId: string | null;
  setPreferredVideoProviderId: (value: string | null) => void;
  preferred3DModel: string;
  setPreferred3DModel: (value: string) => void;
  imageGenRatio: string;
  setImageGenRatio: (value: string) => void;
  imageGenRes: '1K' | '2K' | '4K';
  setImageGenRes: (value: string) => void;
  imageGenCount: 1 | 2 | 3 | 4;
  setImageGenCount: (value: 1 | 2 | 3 | 4) => void;
  imageGenUploads: File[];
  videoGenRatio: string;
  setVideoGenRatio: (value: string) => void;
  videoGenDuration: string;
  setVideoGenDuration: (value: string) => void;
  videoGenModel: VideoModel;
  setVideoGenModel: (value: VideoModel) => void;
  videoGenMode: 'startEnd' | 'multiRef';
  setVideoGenMode: (value: 'startEnd' | 'multiRef') => void;
  modelMode: 'thinking' | 'fast';
  webEnabled: boolean;
  setWebEnabled: (value: boolean) => void;
  setIsAgentMode: (value: boolean) => void;
  translatePromptToEnglish: boolean;
  setTranslatePromptToEnglish: (value: boolean) => void;
  enforceChineseTextInImage: boolean;
  setEnforceChineseTextInImage: (value: boolean) => void;
  requiredChineseCopy: string;
  setRequiredChineseCopy: (value: string) => void;
  inputBlocks: InputBlock[];
  browserAgent?: {
    chatEnabled: boolean;
    setChatEnabled: (value: boolean) => void;
    plannerModelLabel: string;
    isPlanning?: boolean;
    isRunning?: boolean;
    isStarting?: boolean;
    isContinuing?: boolean;
    isRefreshing?: boolean;
    onCancel?: () => void;
  };
  sendSkill?: ChatMessage['skillData'];
  setSendSkill?: (skill: ChatMessage['skillData'] | null) => void;
  skillBookContext?: {
    activeConversationTitle?: string;
    recentMessages?: ChatMessage[];
    onCreateSkillFromConversation?: () => void;
  };
  isSoraVideoModel: boolean;
  handlePickedFiles: (files: File[]) => void;
  archivedReadOnly?: boolean;
};

type QuickSkillPreset = {
  id: string;
  name: string;
  description: string;
  category: 'workflow' | 'agent' | 'edit' | 'research';
  frontstagePriority: 'primary' | 'secondary';
  executionType: 'agent' | 'workflow' | 'skill';
  activationHint: string;
  requiresAttachments?: boolean;
  followUpMode?: 'auto-clarify' | 'direct-run';
  icon: React.ElementType;
  skillData: NonNullable<ChatMessage['skillData']>;
};

type SkillSectionKey = 'my-skills' | 'lovart-skills' | 'more-skills';

type SkillCategoryTab = 'video' | 'social' | 'commerce' | 'branding';

type CustomSkillConfig = Record<string, unknown> & {
  name?: string;
  iconName?: string;
  summary?: string;
  description?: string;
  activationHint?: string;
  requiresAttachments?: boolean;
  frontstageSkillId?: string;
  routeIntent?: string;
  routeLabel?: string;
  routeSummary?: string;
  preferredSkills?: string[];
  suggestedTaskMode?: string;
  followUpMode?: 'auto-clarify' | 'direct-run';
  clarifyChecklist?: string[];
  reusableQuestions?: string[];
  executionOutline?: string[];
  outputBlueprint?: string[];
  instruction?: string;
  customInstruction?: string;
  examplePrompt?: string;
  sourceConversationTitle?: string | null;
  sourceUserPrompt?: string;
  isCustomSkill?: boolean;
  createdAt?: number;
  updatedAt?: number;
  lastUsedAt?: number;
};

type SkillRouteIntentOption = 'general' | 'video' | 'social' | 'branding' | 'commerce';

type SkillRoutePreset = {
  id: SkillRouteIntentOption;
  label: string;
  routeLabel: string;
  routeSummary: string;
  preferredSkills: string[];
  suggestedTaskMode: string;
  defaultFollowUpMode: 'auto-clarify' | 'direct-run';
  clarifyChecklist: string[];
  frontstageSkillId?: string;
};

const formatRelativeSkillTime = (timestamp?: number): string => {
  const value = Number(timestamp || 0);
  if (!Number.isFinite(value) || value <= 0) return '';
  const diff = Date.now() - value;
  if (diff < 60 * 1000) return '刚刚使用';
  if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diff / (60 * 1000)))} 分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.max(1, Math.floor(diff / (60 * 60 * 1000)))} 小时前`;
  return `${Math.max(1, Math.floor(diff / (24 * 60 * 60 * 1000)))} 天前`;
};

const QUICK_SKILL_EXECUTION_LABELS: Record<
  QuickSkillPreset['executionType'],
  string
> = {
  agent: 'Skill',
  workflow: 'Workflow',
  skill: 'Skill',
};

const SKILL_ROUTE_PRESETS: Record<SkillRouteIntentOption, SkillRoutePreset> = {
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
    routeLabel: 'E-Commerce',
    routeSummary:
      'Bias toward product assets, detail-page structure, conversion modules, and commerce-ready outputs.',
    preferredSkills: ['workspaceSearch', 'generateImage', 'smartEdit', 'generateCopy'],
    suggestedTaskMode: 'generate',
    defaultFollowUpMode: 'auto-clarify',
    clarifyChecklist: ['商品与卖点', '目标平台', '商品图/参考素材'],
  },
};

const resolveSkillRoutePreset = (value: unknown): SkillRoutePreset => {
  const key = String(value || '').trim().toLowerCase() as SkillRouteIntentOption;
  return SKILL_ROUTE_PRESETS[key] || SKILL_ROUTE_PRESETS.general;
};

const QUICK_SKILL_PRESETS: QuickSkillPreset[] = [
  {
    id: 'autonomous-video-director',
    name: '视频创作',
    description: '先理解脚本、镜头与参考，再优先往视频生成与分镜方向组织执行。',
    category: 'agent',
    frontstagePriority: 'primary',
    executionType: 'agent',
    activationHint: '适合短视频、动画、分镜到视频、镜头节奏这类任务。',
    followUpMode: 'auto-clarify',
    icon: Video,
    skillData: {
      id: 'autonomous-main-brain',
      name: '视频创作',
      iconName: 'Sparkles',
      config: {
        frontstageSkillId: 'autonomous-video-director',
        allowAutonomousRouting: true,
        mode: 'unified-sidebar-agent',
        routeIntent: 'video',
        routeLabel: 'Video',
        routeSummary: 'Prioritize storyboard, motion, video generation, and clip sequencing when the request allows it.',
        preferredSkills: ['generateVideo', 'generateImage', 'smartEdit'],
        suggestedTaskMode: 'generate',
        followUpMode: 'auto-clarify',
        clarifyChecklist: SKILL_ROUTE_PRESETS.video.clarifyChecklist,
      },
    },
  },
  {
    id: 'autonomous-social-campaign',
    name: '社媒内容',
    description: '围绕封面、帖子、社媒系列图与传播场景来组织创意和执行。',
    category: 'agent',
    frontstagePriority: 'primary',
    executionType: 'agent',
    activationHint: '适合小红书、封面、海报、社媒系列内容和传播导向任务。',
    followUpMode: 'auto-clarify',
    icon: Hash,
    skillData: {
      id: 'autonomous-main-brain',
      name: '社媒内容',
      iconName: 'Hash',
      config: {
        frontstageSkillId: 'autonomous-social-campaign',
        allowAutonomousRouting: true,
        mode: 'unified-sidebar-agent',
        routeIntent: 'social',
        routeLabel: 'Social Media',
        routeSummary: 'Bias toward campaign, poster, copy, and multi-asset social content workflows.',
        preferredSkills: ['generateImage', 'generateCopy', 'generateVideo'],
        suggestedTaskMode: 'generate',
        followUpMode: 'auto-clarify',
        clarifyChecklist: SKILL_ROUTE_PRESETS.social.clarifyChecklist,
      },
    },
  },
  {
    id: 'ecom-oneclick-workflow',
    name: '电商一键方案',
    description: '围绕商品图与诉求自动补问并推进整套电商工作流。',
    category: 'workflow',
    frontstagePriority: 'primary',
    executionType: 'workflow',
    activationHint: '进入电商工作流，会先补问再推进，不是普通聊天。',
    requiresAttachments: true,
    followUpMode: 'auto-clarify',
    icon: Library,
    skillData: {
      id: 'ecom-oneclick-workflow',
      name: '电商一键工作流',
      iconName: 'Library',
      config: {
        allowAutonomousRouting: true,
        mode: 'workflow',
        followUpMode: 'auto-clarify',
        clarifyChecklist: SKILL_ROUTE_PRESETS.commerce.clarifyChecklist,
      },
    },
  },
  {
    id: 'autonomous-brand-system',
    name: '品牌视觉',
    description: '围绕品牌语气、视觉系统、KV 与延展素材来拆解和推进任务。',
    category: 'agent',
    frontstagePriority: 'primary',
    executionType: 'agent',
    activationHint: '适合品牌调性、视觉系统、KV、campaign look and feel 这类任务。',
    followUpMode: 'auto-clarify',
    icon: Lightbulb,
    skillData: {
      id: 'autonomous-main-brain',
      name: '品牌视觉',
      iconName: 'Lightbulb',
      config: {
        frontstageSkillId: 'autonomous-brand-system',
        allowAutonomousRouting: true,
        mode: 'unified-sidebar-agent',
        routeIntent: 'branding',
        routeLabel: 'Branding',
        routeSummary: 'Bias toward visual systems, brand direction, key visuals, and identity-aware execution.',
        preferredSkills: ['generateImage', 'generateCopy', 'workspaceSearch'],
        suggestedTaskMode: 'generate',
        followUpMode: 'auto-clarify',
        clarifyChecklist: SKILL_ROUTE_PRESETS.branding.clarifyChecklist,
      },
    },
  },
  {
    id: 'clothing-studio-workflow',
    name: '服饰工作流',
    description: '适合服饰图、模特图和穿搭任务的多阶段处理流程。',
    category: 'workflow',
    frontstagePriority: 'secondary',
    executionType: 'workflow',
    activationHint: '进入服饰工作流，会围绕服装图和诉求分阶段推进。',
    requiresAttachments: true,
    followUpMode: 'auto-clarify',
    icon: ImageIcon,
    skillData: {
      id: 'clothing-studio-workflow',
      name: '服饰工作流',
      iconName: 'ImageIcon',
      config: {
        allowAutonomousRouting: true,
        mode: 'workflow',
        followUpMode: 'auto-clarify',
        clarifyChecklist: ['服饰图/模特图', '风格目标', '需要保留或规避的限制'],
      },
    },
  },
  {
    id: 'cn-detail-page',
    name: '中文详情页',
    description: '基于商品图和 brief 直接产出中文详情页套图。',
    category: 'workflow',
    frontstagePriority: 'primary',
    executionType: 'skill',
    activationHint: '直接进入详情页套图执行，最好先附上商品图。',
    requiresAttachments: true,
    followUpMode: 'direct-run',
    icon: Box,
    skillData: {
      id: 'cn-detail-page',
      name: '中文详情页套图',
      iconName: 'Box',
      config: {
        followUpMode: 'direct-run',
        clarifyChecklist: ['商品图', '卖点', '详情页页数/规格'],
      },
    },
  },
  {
    id: 'jkai-oneclick',
    name: 'One Click',
    description: '走 JKAI One-Click 流程，适合快速生成整套方案建议。',
    category: 'workflow',
    executionType: 'skill',
    activationHint: '直接进入 One Click 执行链路，优先给出整套方案建议。',
    followUpMode: 'direct-run',
    icon: Zap,
    skillData: {
      id: 'jkai-oneclick',
      name: 'JKAI One-Click',
      iconName: 'Zap',
      config: {
        followUpMode: 'direct-run',
        clarifyChecklist: ['目标结果', '参考方向', '是否有素材'],
      },
    },
  },
];

const SKILL_CATEGORY_TABS: Array<{
  id: SkillCategoryTab;
  label: string;
}> = [
  { id: 'video', label: 'Video' },
  { id: 'social', label: 'Social Media' },
  { id: 'commerce', label: 'E-Commerce' },
  { id: 'branding', label: 'Branding' },
];

const getSkillCategoryTab = (skill: QuickSkillPreset): SkillCategoryTab => {
  if (skill.id === 'autonomous-video-director') {
    return 'video';
  }
  if (skill.id === 'autonomous-social-campaign' || skill.id === 'jkai-oneclick') {
    return 'social';
  }
  if (skill.id === 'cn-detail-page' || skill.id === 'ecom-oneclick-workflow') {
    return 'commerce';
  }
  if (skill.id === 'autonomous-brand-system' || skill.id === 'clothing-studio-workflow') {
    return 'branding';
  }
  return 'video';
};

const inferSkillSeedRouting = (
  conversationTitle: string,
  summary: string,
  lastUserPrompt: string,
): Pick<
  CustomSkillConfig,
  | 'frontstageSkillId'
  | 'routeIntent'
  | 'routeLabel'
  | 'routeSummary'
  | 'preferredSkills'
  | 'suggestedTaskMode'
> => {
  const combined = `${conversationTitle}\n${summary}\n${lastUserPrompt}`.toLowerCase();
  const toRoutingConfig = (preset: SkillRoutePreset) => ({
    frontstageSkillId: preset.frontstageSkillId,
    routeIntent: preset.id,
    routeLabel: preset.routeLabel,
    routeSummary: preset.routeSummary,
    preferredSkills: preset.preferredSkills,
    suggestedTaskMode: preset.suggestedTaskMode,
    followUpMode: preset.defaultFollowUpMode,
    clarifyChecklist: preset.clarifyChecklist,
  });

  if (/(video|镜头|分镜|动画|动效|短视频|脚本)/i.test(combined)) {
    return toRoutingConfig(SKILL_ROUTE_PRESETS.video);
  }

  if (/(品牌|brand|kv|campaign|视觉系统|vi|logo|调性)/i.test(combined)) {
    return toRoutingConfig(SKILL_ROUTE_PRESETS.branding);
  }

  if (/(社媒|小红书|封面|海报|social|campaign|帖子|种草)/i.test(combined)) {
    return toRoutingConfig(SKILL_ROUTE_PRESETS.social);
  }

  if (/(电商|详情页|商品图|主图|sku|卖点|转化|淘宝|天猫|京东|亚马逊)/i.test(combined)) {
    return toRoutingConfig(SKILL_ROUTE_PRESETS.commerce);
  }

  return toRoutingConfig(SKILL_ROUTE_PRESETS.general);
};

const CLARIFY_SIGNAL_RE =
  /(请提供|补充|确认|方便说下|还需要|先告诉我|上传|给我看看|\?|？|which|what|need|missing|clarify)/i;

const inferSkillSeedFollowUpMode = (
  recentMessages: ChatMessage[],
  routePreset: SkillRoutePreset,
): 'auto-clarify' | 'direct-run' => {
  const recentModelTurns = recentMessages
    .filter((message) => message.role === 'model')
    .slice(-2);

  if (recentModelTurns.some((message) => CLARIFY_SIGNAL_RE.test(String(message.text || '')))) {
    return 'auto-clarify';
  }

  return routePreset.defaultFollowUpMode;
};

const extractReusableQuestions = (messages: ChatMessage[]): string[] => {
  const assistantTexts = messages
    .filter((message) => message.role === 'model')
    .map((message) => String(message.text || '').trim())
    .filter(Boolean)
    .slice(-4);

  const matches = assistantTexts.flatMap((text) => {
    const candidates = text.match(/[^。！？\n]*[？?]/g) || [];
    return candidates
      .map((item) => item.replace(/\s+/g, ' ').trim())
      .filter((item) => item.length >= 4 && item.length <= 60);
  });

  return Array.from(new Set(matches)).slice(0, 5);
};

const extractExecutionOutline = (message?: ChatMessage | null): string[] => {
  const text = String(message?.text || '').trim();
  if (!text) return [];

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s>*-]+/, '').trim())
    .filter(Boolean);

  const stepLike = lines.filter((line) =>
    /^(\d+[\.\)、]|第.+步|先|再|然后|最后)/.test(line),
  );
  if (stepLike.length > 0) {
    return Array.from(new Set(stepLike.map((line) => line.slice(0, 80)))).slice(0, 6);
  }

  return lines.slice(0, 4).map((line) => line.slice(0, 80));
};

const inferOutputBlueprint = (
  routePreset: SkillRoutePreset,
  lastModelMessage?: ChatMessage | null,
): string[] => {
  const text = String(lastModelMessage?.text || '').toLowerCase();
  const blueprint: string[] = [];

  if (routePreset.id === 'video') {
    blueprint.push('先给脚本/镜头拆解', '再给视频执行方案');
  } else if (routePreset.id === 'branding') {
    blueprint.push('先整理品牌方向', '再输出视觉系统/KV建议');
  } else if (routePreset.id === 'social') {
    blueprint.push('先明确传播角度', '再拆分封面/海报/文案资产');
  } else if (routePreset.id === 'commerce') {
    blueprint.push('先补齐商品卖点', '再输出转化导向物料方案');
  } else {
    blueprint.push('先澄清目标', '再给执行方案');
  }

  if (/(清单|checklist|步骤|step)/i.test(text)) {
    blueprint.push('适合按步骤清单式输出');
  }
  if (/(表格|table|模块|section)/i.test(text)) {
    blueprint.push('适合模块化结构输出');
  }

  return Array.from(new Set(blueprint)).slice(0, 4);
};

export const InputAreaBottomToolbar: React.FC<InputAreaBottomToolbarProps> = (
  props,
) => {
  const {
    creationMode,
    setCreationMode,
    handleSend,
    handleModeSwitch,
    fileInputRef,
    showModeSelector,
    setShowModeSelector,
    showRatioPicker,
    setShowRatioPicker,
    showModelPicker,
    setShowModelPicker,
    showVideoSettingsDropdown,
    setShowVideoSettingsDropdown,
    showModelPreference,
    setShowModelPreference,
    modelPreferenceTab,
    setModelPreferenceTab,
    autoModelSelect,
    setAutoModelSelect,
    preferredImageModel,
    setPreferredImageModel,
    preferredImageProviderId,
    setPreferredImageProviderId,
    preferredVideoModel,
    setPreferredVideoModel,
    preferredVideoProviderId,
    setPreferredVideoProviderId,
    preferred3DModel,
    setPreferred3DModel,
    imageGenRatio,
    setImageGenRatio,
    imageGenRes,
    setImageGenRes,
    imageGenCount,
    setImageGenCount,
    imageGenUploads,
    videoGenRatio,
    setVideoGenRatio,
    videoGenDuration,
    setVideoGenDuration,
    videoGenModel,
    setVideoGenModel,
    videoGenMode,
    setVideoGenMode,
    modelMode,
    webEnabled,
    setWebEnabled,
    setIsAgentMode,
    translatePromptToEnglish,
    setTranslatePromptToEnglish,
    enforceChineseTextInImage,
    setEnforceChineseTextInImage,
    requiredChineseCopy,
    setRequiredChineseCopy,
    inputBlocks,
    browserAgent,
    sendSkill,
    setSendSkill,
    skillBookContext,
    isSoraVideoModel,
    handlePickedFiles,
    archivedReadOnly = false,
  } = props;
  const isTyping = useAgentStore((state) => state.isTyping);
  const cancelChatGeneration = useAgentStore(
    (state) => state.actions.cancelChatGeneration,
  );
  const isBrowserAgentBusy = Boolean(
    browserAgent &&
      (browserAgent.isPlanning ||
        browserAgent.isStarting ||
        browserAgent.isContinuing ||
        browserAgent.isRefreshing ||
        browserAgent.isRunning),
  );
  const showStopButton = isTyping || isBrowserAgentBusy;
  const handleStop = React.useCallback(() => {
    if (isBrowserAgentBusy) {
      browserAgent?.onCancel();
      return;
    }
    cancelChatGeneration();
  }, [browserAgent, cancelChatGeneration, isBrowserAgentBusy]);

  const mappedImageSummary = getMappedModelDisplaySummary('image');
  const mappedVideoSummary = getMappedModelDisplaySummary('video');
  const mappedPrimaryImageConfig = getMappedPrimaryModelConfig('image');
  const mappedPrimaryVideoConfig = getMappedPrimaryModelConfig('video');
  const activeMappingSummary =
    creationMode === 'video' ? mappedVideoSummary : mappedImageSummary;
  const activePrimaryModel =
    creationMode === 'video'
      ? getMappedPrimaryModelLabel('video')
      : getMappedPrimaryModelLabel('image');
  const mappedPrimaryImagePreference = (mappedPrimaryImageConfig
    ? getModelDisplayLabel(mappedPrimaryImageConfig.modelId)
    : preferredImageModel) as ImageModel;
  const mappedPrimaryVideoPreference = (
    mappedPrimaryVideoConfig?.modelId || preferredVideoModel
  ) as VideoModel;
  const effectiveImagePreference = autoModelSelect
    ? mappedPrimaryImagePreference
    : preferredImageModel;
  const effectiveVideoPreference = autoModelSelect
    ? mappedPrimaryVideoPreference
    : preferredVideoModel;
  const mappedImageOptions = React.useMemo<ToolbarModelOption[]>(() => {
    const presetMap = new Map(MODEL_OPTIONS.image.map((item) => [item.id, item]));
    return getMappedModelConfigs('image')
      .map((config) => {
        const preset =
          presetMap.get(config.modelId) ||
          presetMap.get(getModelDisplayLabel(config.modelId));
        return {
          optionKey: config.raw || `${config.providerId || 'default'}::${config.modelId}`,
          id: getModelDisplayLabel(config.modelId),
          name: getModelDisplayLabel(config.modelId),
          providerId: config.providerId || null,
          providerName: config.providerName || null,
          desc:
            preset?.desc ||
            (config.providerName
              ? `当前默认来自 ${config.providerName}`
              : '当前默认选项'),
          time: preset?.time,
          icon: preset?.icon || DEFAULT_MODEL_ICON_BY_CATEGORY.image,
          badge: preset?.badge,
        };
      });
  }, [mappedImageSummary]);
  const mappedVideoOptions = React.useMemo<ToolbarModelOption[]>(() => {
    const presetMap = new Map(MODEL_OPTIONS.video.map((item) => [item.id, item]));
    return getMappedModelConfigs('video')
      .map((config) => {
        const preset =
          presetMap.get(config.modelId) ||
          presetMap.get(getModelDisplayLabel(config.modelId));
        return {
          optionKey: config.raw || `${config.providerId || 'default'}::${config.modelId}`,
          id: config.modelId,
          name: getModelDisplayLabel(config.modelId),
          providerId: config.providerId || null,
          providerName: config.providerName || null,
          desc:
            preset?.desc ||
            (config.providerName
              ? `当前默认来自 ${config.providerName}`
              : '当前默认选项'),
          time: preset?.time,
          icon: preset?.icon || DEFAULT_MODEL_ICON_BY_CATEGORY.video,
          badge: preset?.badge,
        };
      });
  }, [mappedVideoSummary]);
  const visibleImageOptions: ToolbarModelOption[] =
    mappedImageOptions.length > 0
      ? mappedImageOptions
      : toToolbarOptions(MODEL_OPTIONS.image);
  const visibleVideoOptions: ToolbarModelOption[] =
    mappedVideoOptions.length > 0
      ? mappedVideoOptions
      : toToolbarOptions(MODEL_OPTIONS.video);
  const visible3DOptions: ToolbarModelOption[] = React.useMemo(
    () => toToolbarOptions(MODEL_OPTIONS['3d']),
    [],
  );
  const [showImageCountPicker, setShowImageCountPicker] = React.useState(false);
  const [showImageTextSettings, setShowImageTextSettings] = React.useState(false);
  const [showSkillBook, setShowSkillBook] = React.useState(false);
  const ratioPickerTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const ratioPickerPanelRef = React.useRef<HTMLDivElement | null>(null);
  const videoSettingsTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const videoSettingsPanelRef = React.useRef<HTMLDivElement | null>(null);
  const imageCountPickerTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const imageCountPickerPanelRef = React.useRef<HTMLDivElement | null>(null);
  const imageTextSettingsTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const imageTextSettingsPanelRef = React.useRef<HTMLDivElement | null>(null);
  const modeSelectorTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const modeSelectorPanelRef = React.useRef<HTMLDivElement | null>(null);
  const skillBookTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const skillBookPanelRef = React.useRef<HTMLDivElement | null>(null);
  const modelPickerTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const modelPickerPanelRef = React.useRef<HTMLDivElement | null>(null);
  const modelPreferenceTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const modelPreferencePanelRef = React.useRef<HTMLDivElement | null>(null);
  const [modelPickerAnchorRect, setModelPickerAnchorRect] = React.useState<DOMRect | null>(null);
  const [skillBookAnchorRect, setSkillBookAnchorRect] = React.useState<DOMRect | null>(null);
  const [skillCategoryTab, setSkillCategoryTab] = React.useState<SkillCategoryTab>('video');
  const [skillPreferenceVersion, setSkillPreferenceVersion] = React.useState(0);
  const [editingCustomSkillId, setEditingCustomSkillId] = React.useState<string | null>(null);
  const [customSkillDraftName, setCustomSkillDraftName] = React.useState('');
  const [customSkillDraftSummary, setCustomSkillDraftSummary] = React.useState('');
  const [customSkillDraftInstruction, setCustomSkillDraftInstruction] = React.useState('');
  const [customSkillDraftRouteIntent, setCustomSkillDraftRouteIntent] =
    React.useState<SkillRouteIntentOption>('general');
  const [customSkillDraftFollowUpMode, setCustomSkillDraftFollowUpMode] =
    React.useState<'auto-clarify' | 'direct-run'>('direct-run');
  const videoStartFrame = useAgentStore((state) => state.generation.videoStartFrame);
  const videoEndFrame = useAgentStore((state) => state.generation.videoEndFrame);
  const videoMultiRefs = useAgentStore((state) => state.generation.videoMultiRefs);
  const syncModelPickerPosition = React.useCallback(() => {
    if (!modelPickerTriggerRef.current) return;
    setModelPickerAnchorRect(modelPickerTriggerRef.current.getBoundingClientRect());
  }, []);
  const syncSkillBookPosition = React.useCallback(() => {
    if (!skillBookTriggerRef.current) return;
    setSkillBookAnchorRect(skillBookTriggerRef.current.getBoundingClientRect());
  }, []);
  const assistantModeLabel =
    creationMode === 'agent'
      ? '智能对话'
      : creationMode === 'image'
        ? '图片任务'
        : '视频任务';
  const activeQuickSkillId = getFrontstageSkillId(sendSkill);
  const hasActiveQuickSkill = activeQuickSkillId.length > 0;
  const skillPreferences = React.useMemo(
    () => getStudioUserAssetApi().getSkillPreferences(),
    [skillPreferenceVersion],
  );
  const visibleQuickSkills = React.useMemo(() => {
    const curatedOrder = new Map(
      QUICK_SKILL_PRESETS.map((skill, index) => [skill.id, index]),
    );
    return [...QUICK_SKILL_PRESETS].sort((left, right) => {
      const leftOrder = curatedOrder.get(left.id) ?? 999;
      const rightOrder = curatedOrder.get(right.id) ?? 999;
      return leftOrder - rightOrder;
    });
  }, []);
  const lovartSkillBookSkills = React.useMemo(
    () => visibleQuickSkills,
    [visibleQuickSkills],
  );
  const visibleLovartSkillBookSkills = React.useMemo(
    () => {
      const inCategory = lovartSkillBookSkills.filter(
        (skill) => getSkillCategoryTab(skill) === skillCategoryTab,
      );
      return inCategory.length > 0 ? inCategory : lovartSkillBookSkills;
    },
    [lovartSkillBookSkills, skillCategoryTab],
  );
  const customSkillPresets = React.useMemo<QuickSkillPreset[]>(() => {
    const customConfigs = skillPreferences.customSkillConfigs || {};
    return Object.entries(customConfigs)
      .map(([skillId, config]) => {
        const name = String(config?.name || '').trim();
        const iconName = String(config?.iconName || 'Sparkles').trim();
        if (!name) return null;
        return {
          id: skillId,
          name,
          description: String(
            config?.summary ||
              config?.description ||
              '基于最近一次成功对话沉淀出的可复用 Skill。',
          ).trim(),
          category: 'workflow',
          frontstagePriority: 'primary',
          executionType: 'skill',
          activationHint: String(
            config?.activationHint || '复用这次对话里沉淀下来的执行方式。',
          ).trim(),
          followUpMode:
            config?.followUpMode === 'auto-clarify'
              ? 'auto-clarify'
              : resolveSkillRoutePreset(config?.routeIntent).defaultFollowUpMode,
          icon: Sparkles,
          skillData: {
            id: skillId,
            name,
            iconName,
            config: {
              ...(typeof config === 'object' ? config : {}),
              isCustomSkill: true,
            },
          },
        } satisfies QuickSkillPreset;
      })
      .filter((skill): skill is QuickSkillPreset => Boolean(skill))
      .sort((left, right) => {
        const leftConfig = left.skillData.config as CustomSkillConfig | undefined;
        const rightConfig = right.skillData.config as CustomSkillConfig | undefined;
        const leftScore = Number(leftConfig?.lastUsedAt || leftConfig?.updatedAt || 0);
        const rightScore = Number(rightConfig?.lastUsedAt || rightConfig?.updatedAt || 0);
        return rightScore - leftScore;
      });
  }, [skillPreferences.customSkillConfigs]);
  const mySkillEntries = customSkillPresets;
  const blendedSkillEntries = React.useMemo(
    () => [...mySkillEntries, ...visibleLovartSkillBookSkills],
    [mySkillEntries, visibleLovartSkillBookSkills],
  );

  const editingCustomSkillConfig = React.useMemo(() => {
    if (!editingCustomSkillId) return null;
    const config = skillPreferences.customSkillConfigs?.[editingCustomSkillId];
    if (!config || typeof config !== 'object') return null;
    return config as CustomSkillConfig;
  }, [editingCustomSkillId, skillPreferences.customSkillConfigs]);

  const handleCreateSkillFromConversation = React.useCallback(() => {
    const recentMessages = skillBookContext?.recentMessages || [];
    const userMessages = recentMessages.filter((message) => message.role === 'user');
    const modelMessages = recentMessages.filter((message) => message.role === 'model');
    const lastUserMessage = userMessages[userMessages.length - 1];
    const lastModelMessage = modelMessages[modelMessages.length - 1];
    const baseName = String(skillBookContext?.activeConversationTitle || lastUserMessage?.text || '新 Skill')
      .trim()
      .slice(0, 24);
    const skillId = `custom-skill-${Date.now()}`;
    const summary =
      String(lastModelMessage?.text || lastUserMessage?.text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120) || '基于当前对话总结出的可复用 Skill。';
    const sourceConversationTitle = skillBookContext?.activeConversationTitle || null;
    const sourceUserPrompt = String(lastUserMessage?.text || '').trim();
    const inferredRouting = inferSkillSeedRouting(
      String(sourceConversationTitle || ''),
      summary,
      sourceUserPrompt,
    );
    const routePreset = resolveSkillRoutePreset(inferredRouting.routeIntent);
    const inferredFollowUpMode = inferSkillSeedFollowUpMode(recentMessages, routePreset);
    const reusableQuestions = extractReusableQuestions(recentMessages);
    const executionOutline = extractExecutionOutline(lastModelMessage);
    const outputBlueprint = inferOutputBlueprint(routePreset, lastModelMessage);
    upsertCustomSkillPreference({
      id: skillId,
      name: `${baseName} Skill`,
      iconName: 'Sparkles',
      pin: true,
      config: {
        summary,
        activationHint: '基于此对话创建的 Skill Seed，可继续补充配置。',
        ...inferredRouting,
        followUpMode: inferredFollowUpMode,
        clarifyChecklist: routePreset.clarifyChecklist,
        reusableQuestions,
        executionOutline,
        outputBlueprint,
        instruction:
          String(lastModelMessage?.text || lastUserMessage?.text || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 360) ||
          '先复用这次对话里验证过的思路，再根据新的输入补齐缺失信息并继续执行。',
        examplePrompt: sourceUserPrompt.slice(0, 200),
        sourceConversationTitle,
        sourceUserPrompt,
        allowAutonomousRouting: true,
        mode: 'unified-sidebar-agent',
      },
    });
    const createdSkill = {
      id: skillId,
      name: `${baseName} Skill`,
      iconName: 'Sparkles',
        config: {
          isCustomSkill: true,
          allowAutonomousRouting: true,
          mode: 'unified-sidebar-agent',
          ...inferredRouting,
          followUpMode: inferredFollowUpMode,
          clarifyChecklist: routePreset.clarifyChecklist,
          reusableQuestions,
          executionOutline,
          outputBlueprint,
          summary,
          instruction:
            String(lastModelMessage?.text || lastUserMessage?.text || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 360) ||
          '先复用这次对话里验证过的思路，再根据新的输入补齐缺失信息并继续执行。',
        examplePrompt: sourceUserPrompt.slice(0, 200),
        sourceConversationTitle,
        sourceUserPrompt,
      },
    } satisfies NonNullable<ChatMessage['skillData']>;
    setSendSkill?.(createdSkill);
    setActiveQuickSkillPreference(createdSkill);
    setSkillPreferenceVersion((value) => value + 1);
    skillBookContext?.onCreateSkillFromConversation?.();
  }, [setSendSkill, skillBookContext]);

  const openCustomSkillEditor = React.useCallback((skillId: string) => {
    const config = skillPreferences.customSkillConfigs?.[skillId];
    if (!config || typeof config !== 'object') return;
    const typedConfig = config as CustomSkillConfig;
    const routePreset = resolveSkillRoutePreset(typedConfig.routeIntent);
    setEditingCustomSkillId(skillId);
    setCustomSkillDraftName(String(typedConfig.name || '').trim());
    setCustomSkillDraftSummary(
      String(typedConfig.summary || typedConfig.description || '').trim(),
    );
    setCustomSkillDraftInstruction(
      String(typedConfig.instruction || typedConfig.customInstruction || '').trim(),
    );
    setCustomSkillDraftRouteIntent(routePreset.id);
    setCustomSkillDraftFollowUpMode(
      typedConfig.followUpMode === 'auto-clarify' ? 'auto-clarify' : 'direct-run',
    );
  }, [skillPreferences.customSkillConfigs]);

  const closeCustomSkillEditor = React.useCallback(() => {
    setEditingCustomSkillId(null);
    setCustomSkillDraftName('');
    setCustomSkillDraftSummary('');
    setCustomSkillDraftInstruction('');
    setCustomSkillDraftRouteIntent('general');
    setCustomSkillDraftFollowUpMode('direct-run');
  }, []);

  const handleSaveCustomSkill = React.useCallback(() => {
    if (!editingCustomSkillId || !editingCustomSkillConfig) return;
    const routePreset = resolveSkillRoutePreset(customSkillDraftRouteIntent);
    const nextName = customSkillDraftName.trim() || String(editingCustomSkillConfig.name || 'Custom Skill').trim();
    const nextSummary =
      customSkillDraftSummary.trim() ||
      String(editingCustomSkillConfig.summary || editingCustomSkillConfig.description || '').trim();
    const nextInstruction =
      customSkillDraftInstruction.trim() ||
      String(editingCustomSkillConfig.instruction || editingCustomSkillConfig.customInstruction || '').trim();
    upsertCustomSkillPreference({
      id: editingCustomSkillId,
      name: nextName,
      iconName: String(editingCustomSkillConfig.iconName || 'Sparkles'),
      config: {
        ...editingCustomSkillConfig,
        frontstageSkillId: routePreset.frontstageSkillId,
        routeIntent: routePreset.id,
        routeLabel: routePreset.routeLabel,
        routeSummary: routePreset.routeSummary,
        preferredSkills: routePreset.preferredSkills,
        suggestedTaskMode: routePreset.suggestedTaskMode,
        followUpMode: customSkillDraftFollowUpMode,
        clarifyChecklist: routePreset.clarifyChecklist,
        summary: nextSummary,
        description: nextSummary,
        instruction: nextInstruction,
        customInstruction: nextInstruction,
      },
    });
    if (activeQuickSkillId === editingCustomSkillId) {
      const nextSkill = {
        id: editingCustomSkillId,
        name: nextName,
        iconName: String(editingCustomSkillConfig.iconName || 'Sparkles'),
        config: {
          ...editingCustomSkillConfig,
          isCustomSkill: true,
          frontstageSkillId: routePreset.frontstageSkillId,
          routeIntent: routePreset.id,
          routeLabel: routePreset.routeLabel,
          routeSummary: routePreset.routeSummary,
          preferredSkills: routePreset.preferredSkills,
          suggestedTaskMode: routePreset.suggestedTaskMode,
          followUpMode: customSkillDraftFollowUpMode,
          clarifyChecklist: routePreset.clarifyChecklist,
          summary: nextSummary,
          description: nextSummary,
          instruction: nextInstruction,
          customInstruction: nextInstruction,
        },
      } satisfies NonNullable<ChatMessage['skillData']>;
      setSendSkill?.(nextSkill);
      setActiveQuickSkillPreference(nextSkill);
    }
    setSkillPreferenceVersion((value) => value + 1);
    closeCustomSkillEditor();
  }, [
    activeQuickSkillId,
    closeCustomSkillEditor,
    customSkillDraftFollowUpMode,
    customSkillDraftInstruction,
    customSkillDraftName,
    customSkillDraftRouteIntent,
    customSkillDraftSummary,
    editingCustomSkillConfig,
    editingCustomSkillId,
    setSendSkill,
  ]);

  React.useEffect(() => {
    const handleOpenEditor = () => {
      const activeSkillId = getFrontstageSkillId(sendSkill);
      if (!activeSkillId) return;
      const activeConfig = sendSkill?.config as Record<string, unknown> | undefined;
      if (activeConfig?.isCustomSkill !== true) return;
      openCustomSkillEditor(activeSkillId);
    };
    window.addEventListener('workspace:edit-active-skill', handleOpenEditor as EventListener);
    return () => {
      window.removeEventListener('workspace:edit-active-skill', handleOpenEditor as EventListener);
    };
  }, [openCustomSkillEditor, sendSkill?.config, sendSkill?.id]);

  const renderSkillBookMeta = React.useCallback((skill: QuickSkillPreset) => {
    const isCustomSkill =
      (skill.skillData?.config as Record<string, unknown> | undefined)?.isCustomSkill === true;
    const metaTokens: string[] = [];
    if (isCustomSkill) metaTokens.push('My Skill');
    if (skill.requiresAttachments) metaTokens.push('需参考图');
    if (skill.followUpMode === 'direct-run') metaTokens.push('直接执行');
    if (!skill.requiresAttachments && skill.followUpMode === 'auto-clarify') {
      metaTokens.push('会先补问');
    }
    if (!isCustomSkill && metaTokens.length === 0) {
      metaTokens.push(QUICK_SKILL_EXECUTION_LABELS[skill.executionType]);
    }
    return metaTokens.slice(0, 2);
  }, []);

  const renderSkillBookDescription = React.useCallback((skill: QuickSkillPreset) => {
    const config =
      skill.skillData?.config && typeof skill.skillData.config === 'object'
        ? (skill.skillData.config as Record<string, unknown>)
        : undefined;
    const summary = String(config?.summary || config?.description || '').trim();
    const examplePrompt = String(config?.examplePrompt || config?.sourceUserPrompt || '').trim();
    if ((config?.isCustomSkill as boolean | undefined) === true) {
      return summary || examplePrompt || skill.description;
    }
    return skill.description;
  }, []);

  const renderSkillBookSecondaryMeta = React.useCallback((skill: QuickSkillPreset) => {
    const config =
      skill.skillData?.config && typeof skill.skillData.config === 'object'
        ? (skill.skillData.config as CustomSkillConfig)
        : undefined;
    const sourceConversation = String(config?.sourceConversationTitle || '').trim();
    const lastUsedText = formatRelativeSkillTime(Number(config?.lastUsedAt || 0));
    const examplePrompt = String(config?.examplePrompt || config?.sourceUserPrompt || '').trim();
    if ((config?.isCustomSkill as boolean | undefined) !== true) return null;
    return {
      sourceConversation,
      lastUsedText,
      examplePrompt,
    };
  }, []);

  const renderSkillBookCard = React.useCallback(
    (skill: QuickSkillPreset) => {
      const isActive = activeQuickSkillId === skill.id;
      const isCustomSkill =
        (skill.skillData?.config as Record<string, unknown> | undefined)?.isCustomSkill === true;
      const metaTokens = renderSkillBookMeta(skill);
      const description = renderSkillBookDescription(skill);
      const secondaryMeta = renderSkillBookSecondaryMeta(skill);
      return (
        <button
          key={skill.id}
          type="button"
          data-skill-book-select={skill.id}
          onClick={() => {
            setSendSkill?.(skill.skillData);
            setActiveQuickSkillPreference(skill.skillData);
            setCreationMode('agent');
            setIsAgentMode(true);
            setShowSkillBook(false);
          }}
          title={skill.activationHint}
          className={`group flex w-full items-start gap-3 rounded-[18px] border px-3 py-3 text-left transition ${
            isActive
              ? 'border-slate-300/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] text-slate-900 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.22)]'
              : 'border-transparent bg-white/70 hover:border-slate-200/90 hover:bg-slate-50/82'
          }`}
        >
          <div
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/70 ${
              isActive
                ? 'bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.98),rgba(226,232,240,0.96))] text-slate-700 shadow-[0_10px_22px_-18px_rgba(15,23,42,0.28)]'
                : 'bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.98),rgba(241,245,249,0.94))] text-slate-500'
            }`}
          >
            <skill.icon size={15} strokeWidth={1.9} />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="truncate text-[12.5px] font-medium tracking-[-0.01em] text-slate-900">
                {skill.name}
              </div>
              {isCustomSkill ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openCustomSkillEditor(skill.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    event.stopPropagation();
                    openCustomSkillEditor(skill.id);
                  }}
                  className="mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-slate-600"
                  title="编辑 Skill"
                  aria-label="编辑 Skill"
                >
                  编辑
                </span>
              ) : null}
            </div>
            <div className={`mt-1 line-clamp-2 text-[12px] leading-5 ${
              isCustomSkill ? 'text-violet-600/70' : 'text-slate-500'
            }`}>
              {description}
            </div>
            {isCustomSkill && secondaryMeta ? (
              <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-400">
                {secondaryMeta.sourceConversation ? (
                  <span className="truncate">
                    来源：{secondaryMeta.sourceConversation}
                  </span>
                ) : null}
                {secondaryMeta.lastUsedText ? (
                  <span>{secondaryMeta.lastUsedText}</span>
                ) : null}
                {!secondaryMeta.sourceConversation && secondaryMeta.examplePrompt ? (
                  <span className="truncate">示例：{secondaryMeta.examplePrompt}</span>
                ) : null}
              </div>
            ) : null}
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
              {metaTokens.map((token) => (
                <span
                  key={`${skill.id}-${token}`}
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                    isCustomSkill
                      ? 'bg-violet-50 text-violet-600/80'
                      : 'bg-slate-100/90 text-slate-500'
                  }`}
                >
                  {token}
                </span>
              ))}
            </div>
          </div>
        </button>
      );
    },
    [
      activeQuickSkillId,
      openCustomSkillEditor,
      renderSkillBookDescription,
      renderSkillBookMeta,
      renderSkillBookSecondaryMeta,
      setCreationMode,
      setIsAgentMode,
      setSendSkill,
    ],
  );
  const inlineAttachmentFiles = React.useMemo(
    () =>
      inputBlocks
        .filter((block) => block.type === 'file' && block.file)
        .map((block) => block.file as File),
    [inputBlocks],
  );
  const imageTaskAttachments = React.useMemo(() => {
    const files = [...inlineAttachmentFiles];
    imageGenUploads.forEach((file) => {
      if (!files.includes(file)) {
        files.push(file);
      }
    });
    return files;
  }, [imageGenUploads, inlineAttachmentFiles]);
  const videoTaskAttachments = React.useMemo(() => {
    const files = [...inlineAttachmentFiles];
    const push = (file?: File | null) => {
      if (!file || files.includes(file)) return;
      files.push(file);
    };
    push(videoStartFrame);
    push(videoEndFrame);
    videoMultiRefs.forEach(push);
    return files;
  }, [inlineAttachmentFiles, videoEndFrame, videoMultiRefs, videoStartFrame]);
  const hasTextContent = React.useMemo(
    () =>
      inputBlocks.some(
        (block) => block.type === 'text' && String(block.text || '').trim().length > 0,
      ),
    [inputBlocks],
  );
  const canSendAgentMessage =
    !archivedReadOnly &&
    !inputBlocks.every((block) => block.type === 'text' && !block.text);
  const agentModeSummaryLabel = modelMode === 'thinking' ? '深思' : '快速';
  const agentNetworkSummaryLabel = webEnabled ? '联网检索已开启' : '仅使用当前上下文';
  const updateChatWebEnabled = (nextValue: boolean) => {
    setWebEnabled(nextValue);
    getStudioUserAssetApi().setWorkspacePreferences({ chatWebEnabled: nextValue });
  };
  const unifiedIconButtonClass =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200';
  const secondaryToolbarButtonClass =
    'bg-white text-slate-500 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)] hover:bg-slate-50 hover:text-slate-700';
  const secondaryToolbarActiveDotClass =
    'absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-white bg-slate-900';
  const lovartModePillClass =
    'inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-[12px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900';
  const floatingPanelClass =
    'overflow-hidden rounded-[20px] border border-slate-200/85 bg-white/97 shadow-[0_18px_44px_-28px_rgba(15,23,42,0.22)] backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200';
  const currentModelPreferenceLabel =
    modelPreferenceTab === 'video'
      ? effectiveVideoPreference
      : modelPreferenceTab === 'image'
        ? effectiveImagePreference
        : preferred3DModel;
  const shouldShowCreateSkillRow = Boolean(
    skillBookContext?.activeConversationTitle ||
      (skillBookContext?.recentMessages?.length || 0) > 0,
  );
  React.useEffect(() => {
    if (!showModeSelector) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (modeSelectorPanelRef.current?.contains(target)) return;
      if (modeSelectorTriggerRef.current?.contains(target)) return;
      setShowModeSelector(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowModeSelector(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [setShowModeSelector, showModeSelector]);
  React.useEffect(() => {
    if (!showModelPicker) return;

    syncModelPickerPosition();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (modelPickerPanelRef.current?.contains(target)) return;
      if (modelPickerTriggerRef.current?.contains(target)) return;
      setShowModelPicker(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowModelPicker(false);
      }
    };
    const handleViewportChange = () => {
      syncModelPickerPosition();
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showModelPicker, setShowModelPicker, syncModelPickerPosition]);
  React.useEffect(() => {
    if (!showSkillBook) return;

    syncSkillBookPosition();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (skillBookPanelRef.current?.contains(target)) return;
      if (skillBookTriggerRef.current?.contains(target)) return;
      setShowSkillBook(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowSkillBook(false);
      }
    };
    const handleViewportChange = () => {
      syncSkillBookPosition();
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSkillBook, syncSkillBookPosition]);
  const closeInlineToolPopovers = React.useCallback(() => {
    setShowRatioPicker(false);
    setShowVideoSettingsDropdown(false);
    setShowImageCountPicker(false);
    setShowImageTextSettings(false);
    setShowModelPreference(false);
    setShowSkillBook(false);
  }, [setShowModelPreference, setShowRatioPicker, setShowVideoSettingsDropdown]);
  React.useEffect(() => {
    const openPopovers = [
      {
        open: showRatioPicker,
        panelRef: ratioPickerPanelRef,
        triggerRef: ratioPickerTriggerRef,
      },
      {
        open: showVideoSettingsDropdown,
        panelRef: videoSettingsPanelRef,
        triggerRef: videoSettingsTriggerRef,
      },
      {
        open: showImageCountPicker,
        panelRef: imageCountPickerPanelRef,
        triggerRef: imageCountPickerTriggerRef,
      },
      {
        open: showImageTextSettings,
        panelRef: imageTextSettingsPanelRef,
        triggerRef: imageTextSettingsTriggerRef,
      },
      {
        open: showModelPreference,
        panelRef: modelPreferencePanelRef,
        triggerRef: modelPreferenceTriggerRef,
      },
    ].filter((entry) => entry.open);

    if (openPopovers.length === 0) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const isInsideOpenPopover = openPopovers.some(
        ({ panelRef, triggerRef }) =>
          panelRef.current?.contains(target) || triggerRef.current?.contains(target),
      );
      if (isInsideOpenPopover) return;
      closeInlineToolPopovers();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeInlineToolPopovers();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    closeInlineToolPopovers,
    showImageCountPicker,
    showImageTextSettings,
    showModelPreference,
    showRatioPicker,
    showVideoSettingsDropdown,
  ]);
  const modeOptions = [
    {
      id: 'agent' as const,
      label: '智能对话',
      icon: Sparkles,
    },
    {
      id: 'image' as const,
      label: '图片任务',
      icon: ImageIcon,
    },
    {
      id: 'video' as const,
      label: '视频任务',
      icon: Video,
    },
  ];
  const modeSelectorMenu = showModeSelector ? (
    <div
      ref={modeSelectorPanelRef}
      className="absolute bottom-full left-0 z-[120] mb-3 w-[244px] overflow-hidden rounded-[22px] border border-slate-200/80 bg-white/96 p-1.25 shadow-[0_20px_48px_-32px_rgba(15,23,42,0.26)] backdrop-blur-md"
    >
      <div className="space-y-0.75">
        {modeOptions.map((mode) => {
          const Icon = mode.icon;
          const isActive = creationMode === mode.id;
          return (
            <button
              key={`mode-switch-${mode.id}`}
              type="button"
              onClick={() => {
                setCreationMode(mode.id);
                setShowModeSelector(false);
                setIsAgentMode(mode.id === 'agent');
              }}
              className={`flex w-full items-center gap-2.5 rounded-[14px] px-2.5 py-2 text-left transition ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="shrink-0">
                <Icon size={14} strokeWidth={1.9} />
              </div>
              <div className="min-w-0 flex-1 text-[12px] font-semibold">{mode.label}</div>
              {isActive ? (
                <Check size={14} strokeWidth={2.2} className="shrink-0" />
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="mt-1 border-t border-slate-200/70 px-1.25 pb-1 pt-1.5">
        <button
          type="button"
          onClick={() => {
            const nextMode = modelMode === 'thinking' ? 'fast' : 'thinking';
            handleModeSwitch(nextMode);
            getStudioUserAssetApi().setWorkspacePreferences({ chatModelMode: nextMode });
          }}
          className={`mb-1 flex w-full items-center justify-between rounded-[14px] px-2.5 py-2 text-left text-[11.5px] font-medium transition ${
            modelMode === 'thinking'
              ? 'bg-amber-50 text-amber-700 shadow-[inset_0_0_0_1px_rgba(253,230,138,0.95)]'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
          title={modelMode === 'thinking' ? '当前：深思模式' : '当前：快速模式'}
          aria-label={modelMode === 'thinking' ? '切换到快速模式' : '切换到深思模式'}
        >
          <span className="flex items-center gap-2">
            {modelMode === 'thinking' ? (
              <Lightbulb size={13} strokeWidth={1.9} />
            ) : (
              <Zap size={13} strokeWidth={1.9} />
            )}
            <span>思考模式</span>
          </span>
          <span className="text-[10px] font-semibold">{agentModeSummaryLabel}</span>
        </button>
        <button
          type="button"
          onClick={() => updateChatWebEnabled(!webEnabled)}
          className={`flex w-full items-center justify-between rounded-[14px] px-2.5 py-2 text-left text-[11.5px] font-medium transition ${
            webEnabled
              ? 'bg-blue-50 text-blue-700 shadow-[inset_0_0_0_1px_rgba(191,219,254,0.95)]'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
          title={agentNetworkSummaryLabel}
          aria-label="联网开关"
        >
          <span className="flex items-center gap-2">
            <Globe size={13} strokeWidth={1.9} />
            <span>联网检索</span>
          </span>
          <span className="text-[10px] font-semibold">{webEnabled ? '开' : '关'}</span>
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="relative flex items-center justify-between px-1.5 py-0.5">
        <div
          className={
            creationMode === 'agent'
              ? 'flex min-w-0 flex-1 justify-end'
              : 'flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2'
          }
        >
          {(creationMode === 'image' || creationMode === 'video') && (
            <>
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                <div className="relative">
                  <button
                    ref={modeSelectorTriggerRef}
                    type="button"
                    onClick={() => setShowModeSelector(!showModeSelector)}
                    className={lovartModePillClass}
                    title={`当前模式：${assistantModeLabel}`}
                    aria-label={`当前模式：${assistantModeLabel}`}
                  >
                    <span>{creationMode === 'image' ? '图片任务' : '视频任务'}</span>
                    <ChevronDown size={14} strokeWidth={2} />
                  </button>
                  {modeSelectorMenu}
                </div>
                <div className="relative">
                  <button
                    ref={creationMode === 'image' ? ratioPickerTriggerRef : videoSettingsTriggerRef}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (creationMode === 'image') {
                        setShowRatioPicker(!showRatioPicker);
                        setShowImageCountPicker(false);
                        setShowImageTextSettings(false);
                      } else {
                        setShowVideoSettingsDropdown(!showVideoSettingsDropdown);
                      }
                      setShowModelPicker(false);
                    }}
                    className={`${unifiedIconButtonClass} ${
                      (creationMode === 'image' && showRatioPicker) ||
                      (creationMode === 'video' && showVideoSettingsDropdown)
                        ? 'bg-slate-900 text-white'
                        : secondaryToolbarButtonClass
                    }`}
                    title={
                      creationMode === 'image'
                        ? `尺寸与分辨率：${imageGenRes} · ${imageGenRatio}`
                        : `视频参数：${videoGenRatio} · ${videoGenDuration}`
                    }
                    aria-label={creationMode === 'image' ? '尺寸与分辨率' : '视频参数'}
                  >
                    {creationMode === 'image' ? (
                      <Layers size={17} strokeWidth={1.9} />
                    ) : (
                      <Activity size={17} strokeWidth={1.9} />
                    )}
                  </button>
                  {creationMode === 'image' && showRatioPicker && (
                    <div
                      ref={ratioPickerPanelRef}
                      className="absolute bottom-full left-0 z-[70] mb-3 w-[260px] rounded-[24px] border border-gray-100 bg-white p-5 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] animate-in fade-in slide-in-from-bottom-2 duration-300"
                    >
                      <div className="mb-4 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                        分辨率
                      </div>
                      <div className="mb-6 flex gap-2">
                        {['1K', '2K', '4K'].map((res) => (
                          <button
                            key={res}
                            onClick={() => setImageGenRes(res)}
                            className={`flex-1 rounded-xl py-1.5 text-[12px] font-bold transition-all ${
                              imageGenRes === res
                                ? 'bg-gray-200 text-black shadow-inner'
                                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                            }`}
                          >
                            {res}
                          </button>
                        ))}
                      </div>
                      <div className="mb-4 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                        Size
                      </div>
                      <div className="grid grid-cols-4 gap-2.5">
                        {[
                          { r: '8:1', i: 'w-6 h-2' },
                          { r: '4:1', i: 'w-6 h-2.5' },
                          { r: '21:9', i: 'w-5 h-2' },
                          { r: '16:9', i: 'w-5 h-3' },
                          { r: '3:2', i: 'w-5 h-3.5' },
                          { r: '4:3', i: 'w-5 h-3.5' },
                          { r: '5:4', i: 'w-4.5 h-4' },
                          { r: '1:1', i: 'w-4 h-4' },
                          { r: '4:5', i: 'w-4 h-4.5' },
                          { r: '3:4', i: 'w-3.5 h-5' },
                          { r: '2:3', i: 'w-3.5 h-5' },
                          { r: '9:16', i: 'w-3 h-5' },
                          { r: '1:4', i: 'w-2.5 h-6' },
                          { r: '1:8', i: 'w-2 h-6' },
                        ].map((item) => (
                          <button
                            key={item.r}
                            onClick={() => {
                              setImageGenRatio(item.r);
                              setShowRatioPicker(false);
                            }}
                            className={`flex flex-col items-center gap-1.5 rounded-xl border py-2.5 transition-all ${
                              imageGenRatio === item.r
                                ? 'border-gray-300 bg-gray-100 ring-1 ring-gray-300'
                                : 'border-gray-100 bg-white hover:border-gray-300'
                            }`}
                          >
                            <div
                              className={`border-[1.5px] border-gray-400 rounded-[2px] ${item.i} ${
                                imageGenRatio === item.r ? 'bg-gray-400' : 'bg-transparent'
                              }`}
                            />
                            <span className="text-[10px] font-bold text-gray-600">
                              {item.r}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {creationMode === 'video' && showVideoSettingsDropdown && (
                    <div
                      ref={videoSettingsPanelRef}
                      onClick={(event) => event.stopPropagation()}
                      className="absolute bottom-full left-0 z-[70] mb-3 flex w-[300px] flex-col gap-5 rounded-[24px] border border-gray-100 bg-white p-5 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] animate-in fade-in slide-in-from-bottom-2 duration-300"
                    >
                      <div className="flex flex-col gap-2.5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                          Generate method
                        </div>
                        <div className="flex rounded-xl bg-gray-100 p-1">
                          {(isSoraVideoModel
                            ? [{ id: 'startEnd', label: '单图参考' }]
                            : [
                                { id: 'startEnd', label: '首尾帧' },
                                { id: 'multiRef', label: '多图参考' },
                              ]
                          ).map((mode) => (
                            <button
                              key={mode.id}
                              onClick={() =>
                                setVideoGenMode(mode.id as 'startEnd' | 'multiRef')
                              }
                              className={`flex-1 rounded-lg py-1.5 text-[12px] font-bold transition-all ${
                                videoGenMode === mode.id
                                  ? 'bg-white text-black shadow-sm'
                                  : 'text-gray-400'
                              }`}
                            >
                              {mode.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2.5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                          Size
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {(isSoraVideoModel
                            ? [
                                { r: '16:9', i: 'w-6 h-3.5' },
                                { r: '9:16', i: 'w-3.5 h-6' },
                              ]
                            : videoGenModel === 'kling-3.0'
                              ? [
                                  { r: '16:9', i: 'w-6 h-3.5' },
                                  { r: '9:16', i: 'w-3.5 h-6' },
                                  { r: '1:1', i: 'w-4 h-4' },
                                ]
                              : [
                                  { r: '16:9', i: 'w-6 h-3.5' },
                                  { r: '9:16', i: 'w-3.5 h-6' },
                                  { r: '1:1', i: 'w-4 h-4' },
                                  { r: '4:3', i: 'w-5 h-4' },
                                  { r: '3:4', i: 'w-4 h-5' },
                                  { r: '21:9', i: 'w-6 h-2.5' },
                                ]
                          ).map((item) => (
                            <button
                              key={item.r}
                              onClick={() => setVideoGenRatio(item.r)}
                              className={`flex h-20 flex-col items-center justify-center gap-2 rounded-xl border py-3.5 transition-all ${
                                videoGenRatio === item.r
                                  ? 'border-gray-200 bg-gray-100'
                                  : 'border-gray-100 bg-white hover:border-gray-200'
                              }`}
                            >
                              <div
                                className={`border-[1.5px] border-gray-400 rounded-[2px] ${item.i} ${
                                  videoGenRatio === item.r ? 'bg-gray-400' : 'bg-transparent'
                                }`}
                              />
                              <span className="text-[11px] font-bold text-gray-600">
                                {item.r}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2.5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                          Duration
                        </div>
                        <div className="flex gap-2">
                          {(
                            isSoraVideoModel
                              ? ['10s', '15s']
                              : videoGenModel === 'kling-3.0'
                                ? ['5s', '10s']
                                : ['4s', '6s', '8s']
                          ).map((sec) => (
                            <button
                              key={sec}
                              onClick={() => setVideoGenDuration(sec)}
                              className={`flex-1 rounded-xl border py-2 text-[12px] font-bold transition-all ${
                                videoGenDuration === sec
                                  ? 'border-gray-200 bg-gray-100 text-black'
                                  : 'border-gray-100 bg-white text-gray-400'
                              }`}
                            >
                              {sec}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    ref={modelPickerTriggerRef}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setModelPickerAnchorRect(event.currentTarget.getBoundingClientRect());
                      setShowModelPicker(!showModelPicker);
                      setShowRatioPicker(false);
                      setShowVideoSettingsDropdown(false);
                      setShowImageCountPicker(false);
                      setShowImageTextSettings(false);
                    }}
                    className={`${unifiedIconButtonClass} ${
                      showModelPicker
                        ? 'bg-slate-900 text-white'
                        : secondaryToolbarButtonClass
                    }`}
                    title="妯″瀷"
                    aria-label="妯″瀷"
                  >
                    {creationMode === 'video' ? (
                      <Activity size={17} strokeWidth={1.9} />
                    ) : (
                      <Banana size={17} strokeWidth={1.9} />
                    )}
                  </button>
                {showModelPicker &&
                  modelPickerAnchorRect &&
                  typeof document !== 'undefined' &&
                  createPortal(
                    <div
                      ref={modelPickerPanelRef}
                      onClick={(event) => event.stopPropagation()}
                      className="fixed z-[220] w-[260px] max-w-[calc(100vw-24px)] rounded-[24px] border border-gray-100 bg-white p-4 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] animate-in fade-in slide-in-from-bottom-2 duration-300"
                      style={{
                        right: Math.max(12, window.innerWidth - modelPickerAnchorRect.right),
                        bottom: Math.max(
                          12,
                          window.innerHeight - modelPickerAnchorRect.top + 12,
                        ),
                      }}
                    >
                      <div className="px-1 mb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        本次任务临时覆盖
                      </div>
                      <div className="px-1 mb-3 text-[11px] text-gray-500 leading-5">
                        设置映射：{activeMappingSummary}
                      </div>
                      <div className="flex flex-col gap-2.5">
                        <input
                          autoFocus
                          type="text"
                          value={
                            creationMode === 'video'
                              ? videoGenModel
                              : effectiveImagePreference
                          }
                          onChange={(event) => {
                            const value = event.target.value;
                            if (creationMode === 'video') {
                              setVideoGenModel(value as VideoModel);
                            } else {
                              setPreferredImageModel(value as ImageModel);
                              setPreferredImageProviderId(null);
                            }
                            setAutoModelSelect(false);
                          }}
                          placeholder={`当前默认来自设置映射：${activePrimaryModel}`}
                          className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-[13px] font-bold text-gray-800 outline-none transition-all placeholder:font-medium placeholder:text-gray-400 hover:bg-white focus:border-black focus:bg-white focus:ring-2 focus:ring-black/5"
                        />

                        <div className="mt-1 flex max-h-[160px] flex-col gap-1 overflow-y-auto pr-1 select-none custom-scrollbar">
                          {(creationMode === 'video' ? visibleVideoOptions : visibleImageOptions).map(
                            (preset) => {
                              const isSelected =
                                (creationMode === 'video' && videoGenModel === preset.id) ||
                                (creationMode === 'image' &&
                                  effectiveImagePreference === preset.id &&
                                  (autoModelSelect ||
                                    (preset.providerId || null) ===
                                      (preferredImageProviderId || null)));

                              return (
                                <button
                                  key={preset.optionKey || preset.id}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (creationMode === 'video') {
                                      setVideoGenModel(preset.id as VideoModel);
                                    } else {
                                      setPreferredImageModel(preset.id as ImageModel);
                                      setPreferredImageProviderId(
                                        preset.providerId || null,
                                      );
                                    }
                                    setAutoModelSelect(false);
                                    setShowModelPicker(false);
                                  }}
                                  className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all ${
                                    isSelected ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'
                                  }`}
                                >
                                  <div className="flex min-w-0 items-center gap-2.5">
                                    <div
                                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                                        isSelected
                                          ? 'bg-white/10 text-white'
                                          : 'border border-gray-100 bg-white text-gray-600 shadow-sm'
                                      }`}
                                    >
                                      <preset.icon size={13} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex min-w-0 flex-col">
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className={`truncate text-[13px] font-bold ${
                                            isSelected
                                              ? 'text-white'
                                              : 'text-gray-900 group-hover:text-black'
                                          }`}
                                        >
                                          {preset.name}
                                        </span>
                                        {preset.badge && (
                                          <span
                                            className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                                              isSelected
                                                ? 'bg-white/20 text-white'
                                                : 'border border-blue-100/50 bg-blue-50 text-blue-500'
                                            }`}
                                          >
                                            {preset.badge}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <Check size={14} className="shrink-0 text-white" />
                                  )}
                                </button>
                              );
                            },
                          )}
                        </div>

                        <div className="mt-1 px-1 text-[10px] font-medium leading-relaxed text-gray-400">
                          默认会优先读取设置里的模型映射；这里选择的是本次任务的临时覆盖模型。若未找到可用通道，可能会导致响应失败。
                        </div>
                      </div>
                    </div>,
                    document.body,
                  )}
                </div>
                {creationMode === 'image' && (
                  <>
                    <div className="relative">
                      <button
                        ref={imageCountPickerTriggerRef}
                        onClick={(event) => {
                          event.stopPropagation();
                          setShowImageCountPicker(!showImageCountPicker);
                          setShowModelPicker(false);
                          setShowRatioPicker(false);
                          setShowVideoSettingsDropdown(false);
                          setShowImageTextSettings(false);
                        }}
                        className={`${unifiedIconButtonClass} ${
                          showImageCountPicker
                            ? 'bg-slate-900 text-white'
                            : secondaryToolbarButtonClass
                        }`}
                        title={`生成数量：${imageGenCount} 张`}
                        aria-label="生成数量"
                      >
                        <Hash size={16} strokeWidth={1.9} />
                      </button>
                      {showImageCountPicker && (
                        <div
                          ref={imageCountPickerPanelRef}
                          onClick={(event) => event.stopPropagation()}
                          className="absolute bottom-full right-0 mb-3 w-[132px] bg-white rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] border border-gray-100 p-2 z-[90]"
                        >
                          <div className="grid grid-cols-2 gap-2">
                            {([1, 2, 3, 4] as const).map((count) => (
                              <button
                                key={count}
                                onClick={() => {
                                  setImageGenCount(count);
                                  setShowImageCountPicker(false);
                                }}
                                className={`h-9 rounded-xl text-[12px] font-bold transition ${
                                  imageGenCount === count
                                    ? 'bg-gray-900 text-white'
                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                }`}
                              >
                                {count} 张
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <button
                        ref={imageTextSettingsTriggerRef}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setShowImageTextSettings(!showImageTextSettings);
                          setShowModelPicker(false);
                          setShowRatioPicker(false);
                          setShowVideoSettingsDropdown(false);
                          setShowImageCountPicker(false);
                        }}
                        className={`${unifiedIconButtonClass} ${
                          showImageTextSettings ||
                          translatePromptToEnglish ||
                          enforceChineseTextInImage ||
                          requiredChineseCopy.trim().length > 0
                            ? 'bg-slate-900 text-white'
                            : secondaryToolbarButtonClass
                        }`}
                        title="文案与语言设置"
                        aria-label="文案与语言设置"
                      >
                        <Type size={16} strokeWidth={1.9} />
                      </button>
                      {showImageTextSettings && (
                        <div
                          ref={imageTextSettingsPanelRef}
                          onClick={(event) => event.stopPropagation()}
                          className="absolute bottom-full right-0 z-[90] mb-3 w-[220px] rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)]"
                        >
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setTranslatePromptToEnglish(!translatePromptToEnglish)
                              }
                              className={`flex items-center justify-between rounded-xl px-3 py-2 text-left text-[12px] font-semibold transition ${
                                translatePromptToEnglish
                                  ? 'bg-blue-50 text-blue-600'
                                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              <span>英文增强</span>
                              {translatePromptToEnglish && <Check size={13} strokeWidth={2.4} />}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setEnforceChineseTextInImage(!enforceChineseTextInImage)
                              }
                              className={`flex items-center justify-between rounded-xl px-3 py-2 text-left text-[12px] font-semibold transition ${
                                enforceChineseTextInImage
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              <span>强制中文文案</span>
                              {enforceChineseTextInImage && (
                                <Check size={13} strokeWidth={2.4} />
                              )}
                            </button>
                            <input
                              type="text"
                              value={requiredChineseCopy}
                              onChange={(event) => setRequiredChineseCopy(event.target.value)}
                              placeholder="指定文案"
                              className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-[12px] font-medium text-gray-700 outline-none focus:border-gray-400"
                              title="可选：指定画面中必须出现的中文文案"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
                <button
                  onClick={() =>
                    !archivedReadOnly &&
                    handleSend(
                      undefined,
                      (creationMode === 'image'
                        ? imageTaskAttachments
                        : videoTaskAttachments
                      ).length > 0
                        ? creationMode === 'image'
                          ? imageTaskAttachments
                          : videoTaskAttachments
                        : undefined,
                      undefined,
                      sendSkill,
                    )
                  }
                  disabled={
                    archivedReadOnly ||
                    (creationMode === 'image'
                      ? imageTaskAttachments.length === 0 && !hasTextContent
                      : videoTaskAttachments.length === 0 && !hasTextContent)
                  }
                  className={`${unifiedIconButtonClass} ${
                    archivedReadOnly ||
                    (creationMode === 'image'
                      ? imageTaskAttachments.length === 0 && !hasTextContent
                      : videoTaskAttachments.length === 0 && !hasTextContent)
                      ? 'bg-slate-100 text-slate-400'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  } disabled:opacity-50`}
                  title={creationMode === 'image' ? '开始图片任务' : '开始视频任务'}
                  aria-label={creationMode === 'image' ? '开始图片任务' : '开始视频任务'}
                >
                  <Zap
                    size={16}
                    fill="currentColor"
                    strokeWidth={0}
                  />
                </button>
              </div>
            </>
          )}

          {creationMode === 'agent' && (
            <div className="flex min-w-0 flex-1 items-center justify-between gap-1.5 px-1.5 pb-1.5 pt-0.5">
              <div className="relative flex min-w-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`${unifiedIconButtonClass} ${secondaryToolbarButtonClass}`}
                  title="添加参考图"
                  aria-label="添加参考图"
                >
                  <Paperclip size={15} strokeWidth={1.9} />
                </button>

                <button
                  ref={modeSelectorTriggerRef}
                  type="button"
                  onClick={() => setShowModeSelector(!showModeSelector)}
                  className={lovartModePillClass}
                  title={`当前模式：${assistantModeLabel}`}
                  aria-label={`当前模式：${assistantModeLabel}`}
                >
                  <span>{assistantModeLabel}</span>
                  <ChevronDown size={14} strokeWidth={2} />
                </button>
                {modeSelectorMenu}
              </div>

              <div className="ml-auto flex min-w-0 items-center justify-end gap-1">
              <div className="relative">
                <button
                  ref={skillBookTriggerRef}
                  type="button"
                  onClick={() => {
                    syncSkillBookPosition();
                    setShowSkillBook(!showSkillBook);
                    setShowModelPreference(false);
                  }}
                  className={`${unifiedIconButtonClass} ${
                    showSkillBook || activeQuickSkillId
                      ? 'bg-slate-900 text-white'
                      : secondaryToolbarButtonClass
                  }`}
                  title={activeQuickSkillId ? 'Skill：已选择' : 'Skill'}
                  aria-label="Skill"
                >
                  <Library size={16} strokeWidth={1.9} />
                </button>
                {activeQuickSkillId ? (
                  <span className={secondaryToolbarActiveDotClass} />
                ) : null}
                {showSkillBook &&
                  skillBookAnchorRect &&
                  typeof document !== 'undefined' &&
                  createPortal(
                    <div
                      ref={skillBookPanelRef}
                      className={`fixed z-[320] flex max-h-[min(62vh,560px)] w-[min(404px,calc(100vw-20px))] max-w-[calc(100vw-20px)] flex-col overflow-hidden rounded-[18px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.985),rgba(250,250,249,0.98))] shadow-[0_28px_72px_-36px_rgba(15,23,42,0.3)] backdrop-blur-md`}
                      style={{
                        right: Math.max(12, window.innerWidth - skillBookAnchorRect.right),
                        bottom: Math.max(12, window.innerHeight - skillBookAnchorRect.top + 12),
                      }}
                    >
                      <div className="flex items-center justify-between border-b border-slate-200/70 px-4 pb-2.5 pt-3.5">
                        <div className="min-w-0">
                          <div className="text-[17px] font-semibold leading-none tracking-[-0.02em] text-slate-900">
                            Skill
                          </div>
                          <div className="mt-1 text-[11px] text-slate-400">
                            选择一套前台执行方式，而不是普通聊天模式。
                          </div>
                        </div>
                        {activeQuickSkillId ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSendSkill?.(null);
                              setActiveQuickSkillPreference(null);
                            }}
                            className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            title="清除当前 Skill"
                            aria-label="清除当前 Skill"
                          >
                            清除
                          </button>
                        ) : null}
                      </div>

                      <div className="px-4 pb-2 pt-2.5">
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                          {SKILL_CATEGORY_TABS.map((tab) => {
                            const isActive = skillCategoryTab === tab.id;
                            return (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => setSkillCategoryTab(tab.id)}
                                className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] transition ${
                                  isActive
                                    ? 'border-slate-300 bg-slate-100 text-slate-900'
                                    : 'border-slate-200/90 bg-white/90 text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700'
                                }`}
                              >
                                {tab.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                        <div className="space-y-2 overflow-y-auto">
                          {shouldShowCreateSkillRow ? (
                            <button
                              type="button"
                              onClick={handleCreateSkillFromConversation}
                              disabled={modelMode !== 'thinking'}
                              className={`group flex w-full items-start gap-3 rounded-[18px] border px-3 py-3 text-left transition ${
                                modelMode === 'thinking'
                                  ? 'border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] hover:border-slate-300/80 hover:bg-slate-50/88'
                                  : 'cursor-not-allowed border-slate-200/70 bg-slate-50/80 opacity-60'
                              }`}
                            >
                              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/70 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.98),rgba(241,245,249,0.94))] text-slate-500">
                                <Sparkles size={15} strokeWidth={1.9} />
                              </div>
                              <div className="min-w-0 flex-1 pt-0.5">
                                <div className="truncate text-[12.5px] font-medium tracking-[-0.01em] text-slate-900">
                                  基于此对话创建 Skill
                                </div>
                                <div className="mt-0.5 line-clamp-2 text-[12px] leading-5 text-slate-500">
                                  {modelMode === 'thinking'
                                    ? '在 Thinking 模式下将对话总结为可复用 Skill。'
                                    : '切到 Thinking 模式后才能创建 Skill。'}
                                </div>
                                {modelMode !== 'thinking' ? (
                                  <div className="mt-1.25 flex min-w-0 flex-wrap items-center gap-1.5">
                                    <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">
                                      需 Thinking
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            </button>
                          ) : null}

                          <div>{blendedSkillEntries.map(renderSkillBookCard)}</div>
                        </div>
                      </div>
                    </div>,
                    document.body,
                  )}
              </div>

              {editingCustomSkillId && editingCustomSkillConfig
                ? createPortal(
                    <div className="fixed inset-0 z-[340] flex items-center justify-center bg-slate-950/14 p-4 backdrop-blur-[2px]">
                      <button
                        type="button"
                        aria-label="关闭 Skill 编辑"
                        className="absolute inset-0"
                        onClick={closeCustomSkillEditor}
                      />
                      <div className="relative z-[341] flex w-[min(480px,calc(100vw-24px))] flex-col overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_28px_72px_-36px_rgba(15,23,42,0.32)]">
                        <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3">
                          <div>
                            <div className="text-[15px] font-semibold text-slate-900">
                              编辑 Skill
                            </div>
                            <div className="mt-1 text-[11px] text-slate-400">
                              让这个 Skill 更像 Lovart 的可复用执行方式，而不只是一个入口。
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={closeCustomSkillEditor}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:text-slate-700"
                          >
                            <X size={14} strokeWidth={2.1} />
                          </button>
                        </div>
                        <div className="space-y-3 px-4 py-4">
                          <label className="block">
                            <div className="mb-1.5 text-[11px] font-medium text-slate-500">
                              Skill 名称
                            </div>
                            <input
                              value={customSkillDraftName}
                              onChange={(event) => setCustomSkillDraftName(event.target.value)}
                              className="w-full rounded-[14px] border border-slate-200 px-3 py-2.5 text-[13px] text-slate-900 outline-none transition focus:border-slate-300"
                              placeholder="例如：胶原炮海报 Skill"
                            />
                          </label>
                          <label className="block">
                            <div className="mb-1.5 text-[11px] font-medium text-slate-500">
                              Skill 摘要
                            </div>
                            <textarea
                              value={customSkillDraftSummary}
                              onChange={(event) => setCustomSkillDraftSummary(event.target.value)}
                              rows={3}
                              className="w-full resize-none rounded-[14px] border border-slate-200 px-3 py-2.5 text-[13px] leading-5 text-slate-900 outline-none transition focus:border-slate-300"
                              placeholder="概括这个 Skill 的适用场景与产出方式"
                            />
                          </label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block">
                              <div className="mb-1.5 text-[11px] font-medium text-slate-500">
                                执行方向
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {(
                                  ['general', 'video', 'social', 'branding', 'commerce'] as SkillRouteIntentOption[]
                                ).map((option) => {
                                  const preset = SKILL_ROUTE_PRESETS[option];
                                  const isActive = customSkillDraftRouteIntent === option;
                                  return (
                                    <button
                                      key={option}
                                      type="button"
                                      onClick={() => setCustomSkillDraftRouteIntent(option)}
                                      className={`rounded-[12px] border px-2 py-2 text-left text-[11px] font-medium transition ${
                                        isActive
                                          ? 'border-slate-900 bg-slate-900 text-white'
                                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                                      }`}
                                    >
                                      {preset.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </label>
                            <label className="block">
                              <div className="mb-1.5 text-[11px] font-medium text-slate-500">
                                跟进方式
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {([
                                  ['direct-run', '直接执行'],
                                  ['auto-clarify', '先补问'],
                                ] as const).map(([value, label]) => {
                                  const isActive = customSkillDraftFollowUpMode === value;
                                  return (
                                    <button
                                      key={value}
                                      type="button"
                                      onClick={() => setCustomSkillDraftFollowUpMode(value)}
                                      className={`rounded-[12px] border px-2 py-2 text-left text-[11px] font-medium transition ${
                                        isActive
                                          ? 'border-slate-900 bg-slate-900 text-white'
                                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            </label>
                          </div>
                          <div className="rounded-[16px] border border-slate-200/80 bg-slate-50 px-3 py-2.5 text-[11px] leading-5 text-slate-500">
                            <div className="font-medium text-slate-700">
                              当前执行摘要
                            </div>
                            <div className="mt-1">
                              {SKILL_ROUTE_PRESETS[customSkillDraftRouteIntent].routeSummary}
                            </div>
                          </div>
                          <label className="block">
                            <div className="mb-1.5 text-[11px] font-medium text-slate-500">
                              可复用执行说明
                            </div>
                            <textarea
                              value={customSkillDraftInstruction}
                              onChange={(event) => setCustomSkillDraftInstruction(event.target.value)}
                              rows={6}
                              className="w-full resize-none rounded-[16px] border border-slate-200 px-3 py-2.5 text-[13px] leading-5 text-slate-900 outline-none transition focus:border-slate-300"
                              placeholder="说明这个 Skill 遇到新任务时，应该先补什么信息、按什么顺序推进、输出成什么形式。"
                            />
                          </label>
                          <div className="rounded-[16px] bg-slate-50 px-3 py-2.5 text-[11px] leading-5 text-slate-500">
                            来源对话：
                            {String(editingCustomSkillConfig.sourceConversationTitle || '当前会话').trim()}
                          </div>
                          {String(
                            editingCustomSkillConfig.examplePrompt ||
                              editingCustomSkillConfig.sourceUserPrompt ||
                              '',
                          ).trim() ? (
                            <div className="rounded-[16px] border border-slate-200/80 bg-white px-3 py-2.5 text-[11px] leading-5 text-slate-500">
                              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                                Example Prompt
                              </div>
                              <div>
                                {String(
                                  editingCustomSkillConfig.examplePrompt ||
                                    editingCustomSkillConfig.sourceUserPrompt ||
                                    '',
                                ).trim()}
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <div className="flex items-center justify-end gap-2 border-t border-slate-200/80 px-4 py-3">
                          <button
                            type="button"
                            onClick={closeCustomSkillEditor}
                            className="inline-flex h-9 items-center rounded-full border border-slate-200 px-4 text-[12px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveCustomSkill}
                            className="inline-flex h-9 items-center rounded-full bg-slate-900 px-4 text-[12px] font-medium text-white transition hover:bg-slate-800"
                          >
                            保存 Skill
                          </button>
                        </div>
                      </div>
                    </div>,
                    document.body,
                  )
                : null}

              <div className="relative shrink-0">
                <button
                  ref={modelPreferenceTriggerRef}
                  onClick={() => setShowModelPreference(!showModelPreference)}
                  className={`${unifiedIconButtonClass} ${
                    showModelPreference
                      ? 'bg-slate-900 text-white'
                      : secondaryToolbarButtonClass
                  }`}
                  aria-label="模型偏好"
                  title="模型偏好"
                >
                  <Box size={16} />
                </button>
                {!autoModelSelect ? (
                  <span className={secondaryToolbarActiveDotClass} />
                ) : null}
                {showModelPreference && (
                  <div
                    ref={modelPreferencePanelRef}
                    className={`absolute bottom-full right-0 z-50 mb-4 w-[286px] max-w-[calc(100vw-24px)] ${floatingPanelClass}`}
                  >
                    <div className="border-b border-slate-200/70 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-slate-900">
                            模型偏好
                          </div>
                          <div className="truncate text-[10px] text-slate-400">
                            {autoModelSelect ? '跟随映射' : currentModelPreferenceLabel}
                          </div>
                        </div>
                        <button
                          onClick={() => setAutoModelSelect(!autoModelSelect)}
                          className={`inline-flex h-7 shrink-0 items-center gap-2 rounded-full border px-2.5 text-[10px] font-semibold transition ${
                            autoModelSelect
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              autoModelSelect ? 'bg-white' : 'bg-slate-400'
                            }`}
                          />
                          自动
                        </button>
                      </div>
                      <div className="mt-2 flex rounded-[14px] bg-slate-100/90 p-1">
                        {['image', 'video', '3d'].map((tab) => (
                          <button
                            key={tab}
                            onClick={() =>
                              setModelPreferenceTab(tab as 'image' | 'video' | '3d')
                            }
                            className={`flex-1 rounded-[10px] py-1.5 text-[10px] font-semibold transition-all duration-200 ${
                              modelPreferenceTab === tab
                                ? 'bg-white text-black shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            {tab === 'image' ? '图片' : tab === 'video' ? '视频' : '3D'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="px-3 pb-3 pt-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          {modelPreferenceTab === 'image'
                            ? 'image'
                            : modelPreferenceTab === 'video'
                              ? 'video'
                              : '3d'}
                        </div>
                        <div className="text-[9px] text-slate-400">{autoModelSelect ? '自动' : '手动'}</div>
                      </div>

                      <div className="mt-2 flex max-h-[236px] flex-col gap-1.5 overflow-y-auto pr-1 select-none custom-scrollbar">
                        {(
                          modelPreferenceTab === 'video'
                            ? visibleVideoOptions
                            : modelPreferenceTab === 'image'
                              ? visibleImageOptions
                              : visible3DOptions
                        ).map((preset) => {
                          const isSelected =
                            (modelPreferenceTab === 'video' &&
                              effectiveVideoPreference === preset.id &&
                              (autoModelSelect ||
                                (preset.providerId || null) ===
                                  (preferredVideoProviderId || null))) ||
                            (modelPreferenceTab === 'image' &&
                              effectiveImagePreference === preset.id &&
                              (autoModelSelect ||
                                (preset.providerId || null) ===
                                  (preferredImageProviderId || null))) ||
                            (modelPreferenceTab === '3d' &&
                              preferred3DModel === preset.id);

                          return (
                            <button
                              key={preset.optionKey || preset.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (modelPreferenceTab === 'video') {
                                  setPreferredVideoModel(preset.id as VideoModel);
                                  setPreferredVideoProviderId(
                                    preset.providerId || null,
                                  );
                                } else if (modelPreferenceTab === 'image') {
                                  setPreferredImageModel(preset.id as ImageModel);
                                  setPreferredImageProviderId(
                                    preset.providerId || null,
                                  );
                                } else {
                                  setPreferred3DModel(preset.id);
                                }
                                setAutoModelSelect(false);
                                setShowModelPreference(false);
                              }}
                              className={`rounded-[14px] border px-3 py-2 text-left transition-all ${
                                isSelected
                                  ? 'border-slate-900/10 bg-slate-100/90 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.45)]'
                                  : 'border-slate-200/70 bg-white hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                                    isSelected
                                      ? 'bg-slate-900 text-white'
                                      : 'border border-slate-200 bg-white text-slate-700'
                                  }`}
                                >
                                  <preset.icon size={15} strokeWidth={2} />
                                </div>
                                <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                      <span
                                        className={`truncate text-[11.5px] font-semibold ${
                                          isSelected ? 'text-slate-900' : 'text-slate-700'
                                        }`}
                                      >
                                        {preset.name}
                                      </span>
                                      {preset.providerName ? (
                                        <span
                                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${
                                            isSelected
                                              ? 'bg-white/90 text-slate-500'
                                              : 'bg-slate-100 text-slate-500'
                                          }`}
                                        >
                                          {preset.providerName}
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="mt-0.5 text-[9px] text-slate-400">
                                      {preset.providerName
                                        ? `${preset.providerName}${preset.time ? ` · ${preset.time}` : ''}`
                                        : preset.time || (autoModelSelect ? '跟随映射' : '手动指定')}
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1.5">
                                    {isSelected ? (
                                      <div className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                                        <Check
                                          size={12}
                                          className="text-black"
                                          strokeWidth={3}
                                        />
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {showStopButton ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className={`${unifiedIconButtonClass} bg-rose-600 text-white hover:bg-rose-500`}
                  title="停止生成"
                  aria-label="停止生成"
                >
                  <X size={16} strokeWidth={2.4} className="text-white" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    canSendAgentMessage &&
                    handleSend(undefined, undefined, undefined, sendSkill)
                  }
                  disabled={!canSendAgentMessage}
                  className={`${unifiedIconButtonClass} ${
                    !canSendAgentMessage
                      ? 'bg-slate-100 text-slate-400'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  } disabled:opacity-50`}
                  title="发送"
                  aria-label="发送"
                >
                  <ArrowUp size={16} strokeWidth={2.4} className="text-current" />
                </button>
              )}
              </div>
            </div>
          )}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) {
            handlePickedFiles(Array.from(event.target.files));
          }
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }}
      />
    </>
  );
};
