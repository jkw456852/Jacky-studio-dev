import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
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
  Search,
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
import type { AgentType, RoleGovernanceMode } from '../../../types/agent.types';
import {
  getMappedModelConfigs,
  getMappedModelDisplaySummary,
  getMappedPrimaryModelConfig,
  getMappedPrimaryModelLabel,
  getModelDisplayLabel,
} from '../../../services/provider-settings';
import { getAgentInfo, listAgentInfos } from '../../../services/agents';
import {
  buildRoleDraftAddonText,
  clearAgentPromptAddon,
  buildUserCustomRoleAddonBlock,
  getAgentPromptLayers,
  getEffectiveAgentPrompt,
  hasAgentPromptAddon,
  mergePromptAddonWithRoleDraft,
  setAgentPromptAddon,
} from '../../../services/agents/role-config';
import { getAgentRoleProfile } from '../../../services/agents/role-catalog';
import { getStudioUserAssetApi } from '../../../services/runtime-assets/api';
import {
  getDefaultMainBrainPreferences,
  normalizeMainBrainPreferences,
} from '../../../services/runtime-assets/main-brain';
import {
  pinSkillPreference,
  setActiveQuickSkillPreference,
} from '../../../services/runtime-assets/preferences';
import { useAgentStore } from '../../../stores/agent.store';
import { RoleManagementPanel } from './RoleManagementPanel';
import { MainBrainConfigCenter } from './MainBrainConfigCenter';

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
};

const DEFAULT_MODEL_ICON_BY_CATEGORY: Record<'image' | 'video' | '3d', React.ElementType> = {
  image: Sparkles,
  video: Video,
  '3d': Box,
};

const ROLE_SOURCE_LABELS: Record<string, string> = {
  system: '系统内置',
  user: '用户创建',
  temporary: '临时角色',
  promoted: '已提升',
};

const GOVERNANCE_MODE_LABELS: Record<string, string> = {
  manual_only: '手动管理',
  draft_only: '仅草稿',
  approval_required: '需审批',
  auto_manage: '自动管理',
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
  agentSelectionMode: 'auto' | 'manual';
  setAgentSelectionMode: (value: 'auto' | 'manual') => void;
  pinnedAgentId: AgentType;
  setPinnedAgentId: (value: AgentType) => void;
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
  isSoraVideoModel: boolean;
  handlePickedFiles: (files: File[]) => void;
  archivedReadOnly?: boolean;
};

type QuickSkillPreset = {
  id: string;
  name: string;
  description: string;
  category: 'workflow' | 'agent' | 'edit' | 'research';
  icon: React.ElementType;
  skillData: NonNullable<ChatMessage['skillData']>;
};

const QUICK_SKILL_PRESETS: QuickSkillPreset[] = [
  {
    id: 'autonomous-main-brain',
    name: '智能技能编排',
    description: '像 Lovart 一样先理解任务，再自动调用合适能力与流程。',
    category: 'agent',
    icon: Sparkles,
    skillData: {
      id: 'autonomous-main-brain',
      name: '自主 Agent 路由',
      iconName: 'Sparkles',
      config: {
        allowAutonomousRouting: true,
        mode: 'unified-sidebar-agent',
      },
    },
  },
  {
    id: 'ecom-oneclick-workflow',
    name: '电商一键方案',
    description: '围绕商品图与诉求自动补问并推进整套电商工作流。',
    category: 'workflow',
    icon: Library,
    skillData: {
      id: 'ecom-oneclick-workflow',
      name: '电商一键工作流',
      iconName: 'Library',
      config: {
        allowAutonomousRouting: true,
        mode: 'workflow',
      },
    },
  },
  {
    id: 'clothing-studio-workflow',
    name: '服饰工作流',
    description: '适合服饰图、模特图和穿搭任务的多阶段处理流程。',
    category: 'workflow',
    icon: ImageIcon,
    skillData: {
      id: 'clothing-studio-workflow',
      name: '服饰工作流',
      iconName: 'ImageIcon',
      config: {
        allowAutonomousRouting: true,
        mode: 'workflow',
      },
    },
  },
  {
    id: 'cn-detail-page',
    name: '中文详情页',
    description: '基于商品图和 brief 直接产出中文详情页套图。',
    category: 'workflow',
    icon: Box,
    skillData: {
      id: 'cn-detail-page',
      name: '中文详情页套图',
      iconName: 'Box',
    },
  },
  {
    id: 'jkai-oneclick',
    name: 'One Click',
    description: '走 JKAI One-Click 流程，适合快速生成整套方案建议。',
    category: 'workflow',
    icon: Zap,
    skillData: {
      id: 'jkai-oneclick',
      name: 'JKAI One-Click',
      iconName: 'Zap',
    },
  },
];

type RoleEntityEditorDraft = {
  title: string;
  summary: string;
  avatarUrl: string;
  tagsText: string;
  useWhenText: string;
  avoidWhenText: string;
  durableRoleAddon: string;
  governanceMode: RoleGovernanceMode;
  allowMainBrainMutation: boolean;
  allowMainBrainPromotion: boolean;
  allowMainBrainArchive: boolean;
};

const normalizeRoleEditorTextList = (
  value: string,
  mode: 'line' | 'tag' = 'line',
): string[] => {
  const segments = mode === 'tag' ? value.split(/[\n,，]/) : value.split(/\r?\n/);
  return segments.map((item) => item.trim()).filter(Boolean);
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
    agentSelectionMode,
    setAgentSelectionMode,
    pinnedAgentId,
    setPinnedAgentId,
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
  const mappedScriptSummary = getMappedModelDisplaySummary('script');
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
          desc:
            preset?.desc ||
            (config.providerName
              ? `当前已在设置中映射到 ${config.providerName}`
              : '当前已在设置中映射'),
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
          desc:
            preset?.desc ||
            (config.providerName
              ? `当前已在设置中映射到 ${config.providerName}`
              : '当前已在设置中映射'),
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
  const [showAgentRolePicker, setShowAgentRolePicker] = React.useState(false);
  const [showSkillBook, setShowSkillBook] = React.useState(false);
  const [skillBookQuery, setSkillBookQuery] = React.useState('');
  const [rolePickerQuery, setRolePickerQuery] = React.useState('');
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
  const agentRolePickerTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const agentRolePickerPanelRef = React.useRef<HTMLDivElement | null>(null);
  const skillBookTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const skillBookPanelRef = React.useRef<HTMLDivElement | null>(null);
  const [agentRolePickerAnchorRect, setAgentRolePickerAnchorRect] = React.useState<DOMRect | null>(
    null,
  );
  const modelPickerTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const modelPickerPanelRef = React.useRef<HTMLDivElement | null>(null);
  const modelPreferenceTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const modelPreferencePanelRef = React.useRef<HTMLDivElement | null>(null);
  const [modelPickerAnchorRect, setModelPickerAnchorRect] = React.useState<DOMRect | null>(null);
  const [skillBookAnchorRect, setSkillBookAnchorRect] = React.useState<DOMRect | null>(null);
  const [roleInspectorAgentId, setRoleInspectorAgentId] = React.useState<AgentType | null>(null);
  const [roleInspectorRoleId, setRoleInspectorRoleId] = React.useState<string | null>(null);
  const [showRoleManagementPanel, setShowRoleManagementPanel] = React.useState(false);
  const [roleInspectorDraft, setRoleInspectorDraft] = React.useState('');
  const [roleEntityDraft, setRoleEntityDraft] = React.useState<RoleEntityEditorDraft | null>(null);
  const [roleEntityBaseline, setRoleEntityBaseline] = React.useState<RoleEntityEditorDraft | null>(null);
  const [roleInspectorRevision, setRoleInspectorRevision] = React.useState(0);
  const [showMainBrainInspector, setShowMainBrainInspector] = React.useState(false);
  const [mainBrainDraft, setMainBrainDraft] = React.useState('');
  const currentAutoRoleSession = useAgentStore((state) => state.currentAutoRoleSession);
  const videoStartFrame = useAgentStore((state) => state.generation.videoStartFrame);
  const videoEndFrame = useAgentStore((state) => state.generation.videoEndFrame);
  const videoMultiRefs = useAgentStore((state) => state.generation.videoMultiRefs);
  const selectedRoleId = useAgentStore((state) => state.selectedRoleId);
  const selectedRoleSource = useAgentStore((state) => state.selectedRoleSource);
  const setSelectedRoleSelection = useAgentStore(
    (state) => state.actions.setSelectedRoleSelection,
  );
  const clearSelectedRoleSelection = useAgentStore(
    (state) => state.actions.clearSelectedRoleSelection,
  );
  const availableAgentInfos = React.useMemo(() => listAgentInfos(), []);
  const userAssetApi = React.useMemo(() => getStudioUserAssetApi(), []);
  const skillPreferences = React.useMemo(
    () => userAssetApi.getSkillPreferences(),
    [sendSkill, userAssetApi],
  );
  const pinnedSkillIds = skillPreferences.pinnedSkillIds || [];
  const recentSkillIds = skillPreferences.recentSkillIds || [];
  const availableDurableRoles = React.useMemo(
    () => userAssetApi.listRoles(),
    [roleInspectorRevision, userAssetApi],
  );
  const selectedDurableRole = React.useMemo(
    () => (selectedRoleId ? userAssetApi.getRoleById(selectedRoleId) : null),
    [roleInspectorRevision, selectedRoleId, userAssetApi],
  );
  const resolvedPinnedAgentId = selectedDurableRole?.baseAgentId || pinnedAgentId;
  const pinnedAgentInfo = getAgentInfo(resolvedPinnedAgentId);
  const agentRoleLabel =
    agentSelectionMode === 'manual'
      ? selectedDurableRole?.title || pinnedAgentInfo.name
      : '自动角色';
  const agentRoleDescription =
    agentSelectionMode === 'manual'
      ? selectedDurableRole?.summary ||
        `绑定到 ${pinnedAgentInfo.name} 专家壳${
          selectedRoleSource ? ` · 来源 ${selectedRoleSource}` : ''
        }`
      : '由 Coco 先判断，再交给最合适的角色';
  const openRoleInspector = React.useCallback(
    (agentId: AgentType, roleId?: string | null) => {
      setRoleInspectorAgentId(agentId);
      setRoleInspectorRoleId(roleId || null);
      setShowRoleManagementPanel(false);
      setRoleInspectorDraft(userAssetApi.getAgentPromptAddon(agentId));
    },
    [userAssetApi],
  );
  const openRoleManagementPanel = React.useCallback(
    (agentId: AgentType, roleId?: string | null) => {
      setRoleInspectorAgentId(agentId);
      setRoleInspectorRoleId(roleId || null);
      setShowRoleManagementPanel(true);
      setRoleInspectorDraft(userAssetApi.getAgentPromptAddon(agentId));
    },
    [userAssetApi],
  );
  const closeRoleInspector = React.useCallback(() => {
    setRoleInspectorAgentId(null);
    setRoleInspectorRoleId(null);
    setShowRoleManagementPanel(false);
    setRoleInspectorDraft('');
  }, []);
  const openMainBrainInspector = React.useCallback(() => {
    setMainBrainDraft(userAssetApi.getMainBrainPreferences().join('\n'));
    setShowMainBrainInspector(true);
  }, [userAssetApi]);
  const closeMainBrainInspector = React.useCallback(() => {
    setShowMainBrainInspector(false);
    setMainBrainDraft('');
  }, []);
  const syncAgentRolePickerPosition = React.useCallback(() => {
    if (!agentRolePickerTriggerRef.current) return;
    setAgentRolePickerAnchorRect(agentRolePickerTriggerRef.current.getBoundingClientRect());
  }, []);
  const syncModelPickerPosition = React.useCallback(() => {
    if (!modelPickerTriggerRef.current) return;
    setModelPickerAnchorRect(modelPickerTriggerRef.current.getBoundingClientRect());
  }, []);
  const syncSkillBookPosition = React.useCallback(() => {
    if (!skillBookTriggerRef.current) return;
    setSkillBookAnchorRect(skillBookTriggerRef.current.getBoundingClientRect());
  }, []);
  const inspectedAgentInfo = roleInspectorAgentId
    ? getAgentInfo(roleInspectorAgentId)
    : null;
  const inspectedDurableRole = roleInspectorRoleId
    ? userAssetApi.getRoleById(roleInspectorRoleId)
    : null;
  const inspectedRoleVersions = React.useMemo(
    () =>
      inspectedDurableRole ? userAssetApi.listRoleVersions(inspectedDurableRole.id) : [],
    [inspectedDurableRole?.id, roleInspectorRevision, userAssetApi],
  );
  const inspectedRoleAuditEntries = React.useMemo(
    () =>
      inspectedDurableRole
        ? userAssetApi
            .listAuditEntries()
            .filter(
              (entry) =>
                entry.targetId === inspectedDurableRole.id &&
                (entry.targetKind === 'role-entity' || entry.targetKind === 'role-version'),
            )
        : [],
    [inspectedDurableRole?.id, roleInspectorRevision, userAssetApi],
  );
  const inspectedRoleProfile = roleInspectorAgentId
    ? getAgentRoleProfile(roleInspectorAgentId)
    : null;
  const inspectedLatestRoleDraft = roleInspectorAgentId
    ? userAssetApi.getLatestRoleDraft(roleInspectorAgentId)
    : null;
  const latestAutoRoleDraftMeta = React.useMemo(() => {
    const drafts = availableAgentInfos
      .map((agent) => {
        const draft = userAssetApi.getLatestRoleDraft(agent.id);
        return draft ? { agent, draft } : null;
      })
      .filter(
        (
          item,
        ): item is {
          agent: (typeof availableAgentInfos)[number];
          draft: NonNullable<ReturnType<typeof userAssetApi.getLatestRoleDraft>>;
        } => Boolean(item),
      )
      .sort((left, right) => right.draft.updatedAt - left.draft.updatedAt);

    return drafts[0] || null;
  }, [availableAgentInfos, roleInspectorRevision, userAssetApi]);
  const currentAutoRoleMeta = React.useMemo(() => {
    if (!currentAutoRoleSession) return null;
    return {
      agent: getAgentInfo(currentAutoRoleSession.targetAgent),
      roleStrategy: currentAutoRoleSession.roleStrategy,
      roleStrategyReason: currentAutoRoleSession.roleStrategyReason,
      draft: currentAutoRoleSession.roleDraft,
      updatedAt: currentAutoRoleSession.updatedAt,
      isLive: true,
    };
  }, [currentAutoRoleSession]);
  const visibleAutoRoleMeta = React.useMemo(() => {
    if (currentAutoRoleMeta) {
      return currentAutoRoleMeta;
    }
    if (!latestAutoRoleDraftMeta) {
      return null;
    }
    return {
      agent: latestAutoRoleDraftMeta.agent,
      roleStrategy: latestAutoRoleDraftMeta.draft.roleStrategy || 'reuse',
      roleStrategyReason: latestAutoRoleDraftMeta.draft.roleStrategyReason || '',
      draft: {
        title: latestAutoRoleDraftMeta.draft.title,
        summary: latestAutoRoleDraftMeta.draft.summary,
        instructions: latestAutoRoleDraftMeta.draft.instructions,
      },
      updatedAt: latestAutoRoleDraftMeta.draft.updatedAt,
      isLive: false,
    };
  }, [currentAutoRoleMeta, latestAutoRoleDraftMeta]);
  const autoExecutionStrategyLabel = React.useMemo(() => {
    if (!visibleAutoRoleMeta) return '';
    if (visibleAutoRoleMeta.roleStrategy === 'create') return '新建方案';
    if (visibleAutoRoleMeta.roleStrategy === 'augment') return '临时补充';
    return '沿用现有方式';
  }, [visibleAutoRoleMeta]);
  const autoExecutionSummary = React.useMemo(() => {
    if (!visibleAutoRoleMeta) return '';
    const primary = String(visibleAutoRoleMeta.draft?.title || '').trim();
    if (primary) return primary;
    return String(
      visibleAutoRoleMeta.draft?.summary || visibleAutoRoleMeta.roleStrategyReason || '',
    )
      .replace(/\s+/g, ' ')
      .trim();
  }, [visibleAutoRoleMeta]);
  const normalizedRolePickerQuery = rolePickerQuery.trim().toLowerCase();
  const filteredDurableRoles = React.useMemo(
    () =>
      availableDurableRoles.filter((role) => {
        if (!normalizedRolePickerQuery) return true;
        const roleAgentInfo = getAgentInfo(role.baseAgentId);
        return [
          role.title,
          role.summary,
          role.source,
          role.governance.mode,
          roleAgentInfo.name,
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedRolePickerQuery);
      }),
    [availableDurableRoles, normalizedRolePickerQuery],
  );
  const filteredAgentInfos = React.useMemo(
    () =>
      availableAgentInfos.filter((agent) => {
        if (!normalizedRolePickerQuery) return true;
        return [agent.name, ...agent.capabilities]
          .join(' ')
          .toLowerCase()
          .includes(normalizedRolePickerQuery);
      }),
    [availableAgentInfos, normalizedRolePickerQuery],
  );
  const currentRoleStatusMeta =
    agentSelectionMode === 'auto'
      ? {
          badge: '自动分配',
          title: '自动角色',
          summary: visibleAutoRoleMeta?.draft?.title || '由 Coco 先判断，再调用合适的专家与技能',
          accentClass: 'bg-blue-50 text-blue-700 border-blue-200/80',
        }
      : selectedDurableRole
        ? {
            badge: '已绑定角色',
            title: selectedDurableRole.title,
            summary:
              selectedDurableRole.summary || `绑定到 ${pinnedAgentInfo.name} 专家壳`,
            accentClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
          }
        : {
            badge: '已锁定专家',
            title: pinnedAgentInfo.name,
            summary: agentRoleDescription,
            accentClass: 'bg-slate-100 text-slate-700 border-slate-200/90',
          };
  const getRoleSourceLabel = React.useCallback(
    (source?: string | null) => ROLE_SOURCE_LABELS[String(source || '')] || '未标记来源',
    [],
  );
  const getGovernanceModeLabel = React.useCallback(
    (mode?: string | null) =>
      GOVERNANCE_MODE_LABELS[String(mode || '')] || '未设置治理',
    [],
  );
  const roleEntryStatusLabel =
    agentSelectionMode === 'manual'
      ? selectedRoleId
        ? '固定角色'
        : '固定专家'
      : '自动分配';
  const roleEntryTitle =
    agentSelectionMode === 'manual' ? '执行方式' : '自动执行';
  const roleEntryDescription =
    agentSelectionMode === 'manual'
      ? selectedDurableRole?.summary || `当前固定到 ${pinnedAgentInfo.name}`
      : '默认由 Coco 判断任务并自动选择合适执行路径';
  const assistantModeLabel =
    creationMode === 'agent'
      ? 'Agent'
      : creationMode === 'image'
        ? '图片任务'
        : '视频任务';
  const skillPresetMap = React.useMemo(
    () => new Map(QUICK_SKILL_PRESETS.map((skill) => [skill.id, skill])),
    [],
  );
  const activeQuickSkillId = String(sendSkill?.id || '').trim();
  const visibleQuickSkills = React.useMemo(() => {
    const normalizedQuery = skillBookQuery.trim().toLowerCase();
    const base = QUICK_SKILL_PRESETS.filter((skill) => {
      if (!normalizedQuery) return true;
      return (
        skill.name.toLowerCase().includes(normalizedQuery) ||
        skill.description.toLowerCase().includes(normalizedQuery)
      );
    });

    return [...base].sort((left, right) => {
      const leftPinned = pinnedSkillIds.includes(left.id) ? 1 : 0;
      const rightPinned = pinnedSkillIds.includes(right.id) ? 1 : 0;
      if (leftPinned !== rightPinned) return rightPinned - leftPinned;
      const leftRecentIndex = recentSkillIds.indexOf(left.id);
      const rightRecentIndex = recentSkillIds.indexOf(right.id);
      const normalizedLeftRecent = leftRecentIndex === -1 ? 999 : leftRecentIndex;
      const normalizedRightRecent = rightRecentIndex === -1 ? 999 : rightRecentIndex;
      if (normalizedLeftRecent !== normalizedRightRecent) {
        return normalizedLeftRecent - normalizedRightRecent;
      }
      return left.name.localeCompare(right.name, 'zh-CN');
    });
  }, [pinnedSkillIds, recentSkillIds, skillBookQuery]);
  const recentQuickSkills = React.useMemo(
    () =>
      recentSkillIds
        .map((id) => skillPresetMap.get(id))
        .filter((item): item is QuickSkillPreset => Boolean(item)),
    [recentSkillIds, skillPresetMap],
  );
  const pinnedQuickSkills = React.useMemo(
    () =>
      pinnedSkillIds
        .map((id) => skillPresetMap.get(id))
        .filter((item): item is QuickSkillPreset => Boolean(item)),
    [pinnedSkillIds, skillPresetMap],
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
  const unifiedIconButtonClass =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200';
  const secondaryToolbarButtonClass =
    'bg-white text-slate-500 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)] hover:bg-slate-50 hover:text-slate-700';
  const secondaryToolbarActiveDotClass =
    'absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-white bg-slate-900';
  const lovartModePillClass =
    'inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-[12px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900';
  const inspectedBuiltInPrompt = roleInspectorAgentId
    ? getAgentPromptLayers(roleInspectorAgentId).systemBaselinePrompt
    : '';
  const inspectedPromptAddon = roleInspectorAgentId
    ? userAssetApi.getAgentPromptAddon(roleInspectorAgentId)
    : '';
  const inspectedEffectivePrompt = roleInspectorAgentId
    ? getEffectiveAgentPrompt(roleInspectorAgentId)
    : '';
  const inspectedMainBrainBlock = roleInspectorAgentId
    ? getAgentPromptLayers(roleInspectorAgentId).mainBrainPreferenceBlock
    : '';
  const mainBrainStoredLines = React.useMemo(
    () => userAssetApi.getMainBrainPreferences(),
    [roleInspectorRevision, userAssetApi],
  );
  const mainBrainDefaultText = React.useMemo(
    () => getDefaultMainBrainPreferences().join('\n'),
    [],
  );
  const mainBrainDirty =
    normalizeMainBrainPreferences(mainBrainDraft).join('\n') !==
    normalizeMainBrainPreferences(mainBrainStoredLines).join('\n');
  const inspectedPromptDirty =
    roleInspectorAgentId !== null &&
    roleInspectorDraft.trim() !== inspectedPromptAddon.trim();
  const inspectedHasAddon =
    roleInspectorAgentId !== null && hasAgentPromptAddon(roleInspectorAgentId);
  const buildRoleEntityEditorDraft = (): RoleEntityEditorDraft | null => {
    if (!roleInspectorAgentId || !inspectedAgentInfo) return null;
    return {
      title:
        inspectedDurableRole?.title ||
        inspectedLatestRoleDraft?.title ||
        `${inspectedAgentInfo.name} 自定义角色`,
      summary:
        inspectedDurableRole?.summary ||
        inspectedLatestRoleDraft?.summary ||
        inspectedRoleProfile?.purpose ||
        '',
      avatarUrl: inspectedDurableRole?.avatarUrl || '',
      tagsText: inspectedDurableRole?.tags.join('，') || '',
      useWhenText:
        inspectedDurableRole?.useWhen.join('\n') || inspectedRoleProfile?.useWhen.join('\n') || '',
      avoidWhenText:
        inspectedDurableRole?.avoidWhen.join('\n') ||
        inspectedRoleProfile?.avoidWhen.join('\n') ||
        '',
      durableRoleAddon:
        inspectedDurableRole?.promptLayers.durableRoleAddon ||
        roleInspectorDraft.trim() ||
        (inspectedLatestRoleDraft ? buildRoleDraftAddonText(inspectedLatestRoleDraft) : ''),
      governanceMode: inspectedDurableRole?.governance.mode || 'approval_required',
      allowMainBrainMutation: inspectedDurableRole?.governance.allowMainBrainMutation || false,
      allowMainBrainPromotion: inspectedDurableRole?.governance.allowMainBrainPromotion || false,
      allowMainBrainArchive: inspectedDurableRole?.governance.allowMainBrainArchive || false,
    };
  };
  const roleEntityDirty = React.useMemo(
    () =>
      Boolean(roleEntityDraft) &&
      Boolean(roleEntityBaseline) &&
      JSON.stringify(roleEntityDraft) !== JSON.stringify(roleEntityBaseline),
    [roleEntityBaseline, roleEntityDraft],
  );
  const roleEntityCanSubmit = Boolean(roleEntityDraft?.title.trim());
  React.useEffect(() => {
    if (!showRoleManagementPanel) {
      setRoleEntityDraft(null);
      setRoleEntityBaseline(null);
      return;
    }
    const nextDraft = buildRoleEntityEditorDraft();
    setRoleEntityDraft(nextDraft);
    setRoleEntityBaseline(nextDraft);
  }, [showRoleManagementPanel, roleInspectorAgentId, roleInspectorRoleId, roleInspectorRevision]);
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
    if (!showAgentRolePicker) {
      setRolePickerQuery('');
      return;
    }

    syncAgentRolePickerPosition();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (agentRolePickerPanelRef.current?.contains(target)) return;
      if (agentRolePickerTriggerRef.current?.contains(target)) return;
      setShowAgentRolePicker(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAgentRolePicker(false);
      }
    };
    const handleViewportChange = () => {
      syncAgentRolePickerPosition();
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
  }, [showAgentRolePicker, syncAgentRolePickerPosition]);
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
  const handleSavePromptAddon = React.useCallback(() => {
    if (!roleInspectorAgentId) return;
    setAgentPromptAddon(roleInspectorAgentId, roleInspectorDraft);
    setRoleInspectorDraft(userAssetApi.getAgentPromptAddon(roleInspectorAgentId));
    setRoleInspectorRevision((value) => value + 1);
  }, [roleInspectorAgentId, roleInspectorDraft, userAssetApi]);
  const handleResetPromptAddon = React.useCallback(() => {
    if (!roleInspectorAgentId) return;
    clearAgentPromptAddon(roleInspectorAgentId);
    setRoleInspectorDraft('');
    setRoleInspectorRevision((value) => value + 1);
  }, [roleInspectorAgentId]);
  const handleApplyLatestRoleDraft = React.useCallback(() => {
    if (!inspectedLatestRoleDraft) return;
    const nextDraft = buildRoleDraftAddonText(inspectedLatestRoleDraft);
    setRoleInspectorDraft((current) =>
      current.trim()
        ? `${current.trim()}\n\n${nextDraft}`
        : nextDraft,
    );
  }, [inspectedLatestRoleDraft]);
  const handleSaveLatestRoleDraftAsFormalRole = React.useCallback(() => {
    if (!roleInspectorAgentId || !inspectedLatestRoleDraft) return;
    const persistedDraft = userAssetApi.saveTemporaryRoleDraft({
      targetRoleId: roleInspectorRoleId || selectedRoleId || null,
      targetBaseAgentId: roleInspectorAgentId,
      title: inspectedLatestRoleDraft.title,
      summary: inspectedLatestRoleDraft.summary,
      instructions: inspectedLatestRoleDraft.instructions,
      roleStrategy: inspectedLatestRoleDraft.roleStrategy || 'augment',
      roleStrategyReason:
        inspectedLatestRoleDraft.roleStrategyReason || '从专家壳最近自动草案提升为长期角色。',
      promotionSuggested: true,
    });
    if (!persistedDraft) return;
    const promotedRole = userAssetApi.promoteTemporaryRole(persistedDraft.id, {
      targetRoleId: roleInspectorRoleId || selectedRoleId || null,
    });
    if (!promotedRole) return;
    setPinnedAgentId(promotedRole.baseAgentId);
    setSelectedRoleSelection({
      roleId: promotedRole.id,
      roleSource: promotedRole.source,
      baseAgentId: promotedRole.baseAgentId,
      governanceMode: promotedRole.governance.mode,
      allowMainBrainRoleMutation: promotedRole.governance.allowMainBrainMutation,
      allowMainBrainRolePromotion: promotedRole.governance.allowMainBrainPromotion,
    });
    setRoleInspectorRoleId(promotedRole.id);
    setRoleInspectorRevision((value) => value + 1);
  }, [
    inspectedLatestRoleDraft,
    roleInspectorAgentId,
    roleInspectorRoleId,
    selectedRoleId,
    setPinnedAgentId,
    setSelectedRoleSelection,
    userAssetApi,
  ]);
  const handleClearLatestRoleDraft = React.useCallback(() => {
    if (!roleInspectorAgentId) return;
    userAssetApi.clearLatestRoleDraft(roleInspectorAgentId);
    setRoleInspectorRevision((value) => value + 1);
  }, [roleInspectorAgentId, userAssetApi]);
  const handleRoleEntityDraftChange = React.useCallback((patch: Partial<RoleEntityEditorDraft>) => {
    setRoleEntityDraft((current) => (current ? { ...current, ...patch } : current));
  }, []);
  const handleResetRoleEntityDraft = React.useCallback(() => {
    setRoleEntityDraft(roleEntityBaseline ? { ...roleEntityBaseline } : null);
  }, [roleEntityBaseline]);
  const handleSaveRoleEntity = React.useCallback(() => {
    if (!roleInspectorAgentId || !roleEntityDraft) return;
    const savedRole = userAssetApi.saveRole(
      {
        ...(inspectedDurableRole ? { id: inspectedDurableRole.id } : {}),
        title: roleEntityDraft.title,
        summary: roleEntityDraft.summary,
        avatarUrl: roleEntityDraft.avatarUrl.trim(),
        baseAgentId: roleInspectorAgentId,
        source: inspectedDurableRole?.source || 'user',
        status: inspectedDurableRole?.status || 'active',
        tags: normalizeRoleEditorTextList(roleEntityDraft.tagsText, 'tag'),
        useWhen: normalizeRoleEditorTextList(roleEntityDraft.useWhenText, 'line'),
        avoidWhen: normalizeRoleEditorTextList(roleEntityDraft.avoidWhenText, 'line'),
        toolPolicy: inspectedDurableRole?.toolPolicy || {
          allowedSkills: [],
          blockedSkills: [],
          canRouteSubtasks: true,
          canUseNetworkResearch: true,
        },
        routingPolicy: inspectedDurableRole?.routingPolicy || {
          priority: 100,
          keywords: [],
          preferredTaskModes: [],
          autoRouteEligible: true,
        },
        promptLayers: {
          systemBaseline: inspectedDurableRole?.promptLayers.systemBaseline || inspectedBuiltInPrompt,
          mainBrainShared: inspectedDurableRole?.promptLayers.mainBrainShared || inspectedMainBrainBlock,
          durableRoleAddon: roleEntityDraft.durableRoleAddon.trim(),
        },
        governance: {
          mode: roleEntityDraft.governanceMode,
          requiresHumanApproval: roleEntityDraft.governanceMode !== 'auto_manage',
          allowMainBrainMutation: roleEntityDraft.allowMainBrainMutation,
          allowMainBrainPromotion: roleEntityDraft.allowMainBrainPromotion,
          allowMainBrainArchive: roleEntityDraft.allowMainBrainArchive,
        },
      },
      {
        preferredId: inspectedDurableRole?.id,
      },
    );
    if (!savedRole) return;
    setAgentSelectionMode('manual');
    setPinnedAgentId(savedRole.baseAgentId);
    setSelectedRoleSelection({
      roleId: savedRole.id,
      roleSource: savedRole.source,
      baseAgentId: savedRole.baseAgentId,
      governanceMode: savedRole.governance.mode,
      allowMainBrainRoleMutation: savedRole.governance.allowMainBrainMutation,
      allowMainBrainRolePromotion: savedRole.governance.allowMainBrainPromotion,
    });
    setRoleInspectorRoleId(savedRole.id);
    setRoleInspectorRevision((value) => value + 1);
  }, [
    inspectedBuiltInPrompt,
    inspectedDurableRole,
    inspectedMainBrainBlock,
    roleEntityDraft,
    roleInspectorAgentId,
    setAgentSelectionMode,
    setPinnedAgentId,
    setSelectedRoleSelection,
    userAssetApi,
  ]);
  const handlePublishRole = React.useCallback(() => {
    if (!inspectedDurableRole) return;
    const publishedRole = userAssetApi.saveRole(
      {
        ...inspectedDurableRole,
        status: 'active',
      },
      {
        preferredId: inspectedDurableRole.id,
      },
    );
    if (!publishedRole) return;
    if (selectedRoleId === publishedRole.id) {
      setPinnedAgentId(publishedRole.baseAgentId);
      setSelectedRoleSelection({
        roleId: publishedRole.id,
        roleSource: publishedRole.source,
        baseAgentId: publishedRole.baseAgentId,
        governanceMode: publishedRole.governance.mode,
        allowMainBrainRoleMutation: publishedRole.governance.allowMainBrainMutation,
        allowMainBrainRolePromotion: publishedRole.governance.allowMainBrainPromotion,
      });
    }
    setRoleInspectorRoleId(publishedRole.id);
    setRoleInspectorRevision((value) => value + 1);
  }, [inspectedDurableRole, selectedRoleId, setPinnedAgentId, setSelectedRoleSelection, userAssetApi]);
  const handleArchiveRole = React.useCallback(() => {
    if (!inspectedDurableRole) return;
    userAssetApi.archiveRole(inspectedDurableRole.id);
    const archivedRole = userAssetApi.getRoleById(inspectedDurableRole.id);
    if (!archivedRole) return;
    if (selectedRoleId === archivedRole.id) {
      setPinnedAgentId(archivedRole.baseAgentId);
      clearSelectedRoleSelection();
      setAgentSelectionMode('manual');
    }
    setRoleInspectorRoleId(archivedRole.id);
    setRoleInspectorRevision((value) => value + 1);
  }, [
    clearSelectedRoleSelection,
    inspectedDurableRole,
    selectedRoleId,
    setAgentSelectionMode,
    setPinnedAgentId,
    userAssetApi,
  ]);
  const handleRollbackRoleVersion = React.useCallback(
    (version: number) => {
      if (!inspectedDurableRole) return;
      const restoredRole = userAssetApi.rollbackRoleVersion(inspectedDurableRole.id, version);
      if (!restoredRole) return;
      if (selectedRoleId === restoredRole.id) {
        setPinnedAgentId(restoredRole.baseAgentId);
        setSelectedRoleSelection({
          roleId: restoredRole.id,
          roleSource: restoredRole.source,
          baseAgentId: restoredRole.baseAgentId,
          governanceMode: restoredRole.governance.mode,
          allowMainBrainRoleMutation: restoredRole.governance.allowMainBrainMutation,
          allowMainBrainRolePromotion: restoredRole.governance.allowMainBrainPromotion,
        });
      }
      setRoleInspectorRoleId(restoredRole.id);
      setRoleInspectorRevision((value) => value + 1);
    },
    [inspectedDurableRole, selectedRoleId, setPinnedAgentId, setSelectedRoleSelection, userAssetApi],
  );
  const handleSaveMainBrainPreferences = React.useCallback(() => {
    userAssetApi.setMainBrainPreferences(normalizeMainBrainPreferences(mainBrainDraft));
    setMainBrainDraft(userAssetApi.getMainBrainPreferences().join('\n'));
    setRoleInspectorRevision((value) => value + 1);
  }, [mainBrainDraft, userAssetApi]);
  const handleResetMainBrainPreferences = React.useCallback(() => {
    userAssetApi.setMainBrainPreferences([]);
    setMainBrainDraft('');
    setRoleInspectorRevision((value) => value + 1);
  }, [userAssetApi]);
  const modeOptions = [
    {
      id: 'agent' as const,
      label: 'Agent',
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
                setShowAgentRolePicker(false);
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
          onClick={() =>
            handleModeSwitch(modelMode === 'thinking' ? 'fast' : 'thinking')
          }
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
          onClick={() => setWebEnabled(!webEnabled)}
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
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2 px-2 pb-2 pt-0.5">
              <div className="relative flex min-w-0 items-center gap-1.5">
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
                  <span>Agent</span>
                  <ChevronDown size={14} strokeWidth={2} />
                </button>
                {modeSelectorMenu}
              </div>

              <div className="ml-auto flex min-w-0 items-center justify-end gap-1.5">
              <div className="hidden">
                <button
                  onClick={() => setWebEnabled(!webEnabled)}
                  className={`${unifiedIconButtonClass} ${
                    webEnabled
                      ? 'bg-blue-50 text-blue-600 shadow-[inset_0_0_0_1px_rgba(191,219,254,0.95)]'
                      : secondaryToolbarButtonClass
                  }`}
                  title={webEnabled ? '已开启联网检索' : '当前不联网'}
                  aria-label="联网开关"
                >
                  <Globe size={16} strokeWidth={1.9} />
                </button>
                {webEnabled ? <span className={secondaryToolbarActiveDotClass} /> : null}
              </div>

              <div className="relative">
                <button
                  ref={agentRolePickerTriggerRef}
                  type="button"
                  onClick={(event) => {
                    setAgentRolePickerAnchorRect(event.currentTarget.getBoundingClientRect());
                    setShowAgentRolePicker(!showAgentRolePicker);
                    setShowModeSelector(false);
                    setShowModelPicker(false);
                    setShowRatioPicker(false);
                    setShowVideoSettingsDropdown(false);
                  }}
                  className={`${unifiedIconButtonClass} ${
                    agentSelectionMode === 'manual'
                      ? 'bg-amber-50 text-amber-700 shadow-[inset_0_0_0_1px_rgba(253,230,138,0.95)]'
                      : secondaryToolbarButtonClass
                  }`}
                  title={agentSelectionMode === 'manual' ? `执行偏好：${agentRoleLabel}` : '执行偏好：自动分配'}
                  aria-label={agentSelectionMode === 'manual' ? `执行偏好：${agentRoleLabel}` : '执行偏好：自动分配'}
                >
                  <Sparkles size={16} strokeWidth={1.9} />
                </button>
                {agentSelectionMode === 'manual' ? (
                  <span className={secondaryToolbarActiveDotClass} />
                ) : null}
                {showAgentRolePicker &&
                  agentRolePickerAnchorRect &&
                  typeof document !== 'undefined' &&
                  createPortal(
                    <div
                      ref={agentRolePickerPanelRef}
                      className="fixed z-[320] flex max-h-[min(78vh,760px)] w-[min(352px,calc(100vw-24px))] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-[24px] border border-slate-200/90 bg-white p-2 shadow-[0_22px_60px_-24px_rgba(15,23,42,0.28)] animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200"
                      style={{
                        right: Math.max(12, window.innerWidth - agentRolePickerAnchorRect.right),
                        bottom: Math.max(
                          12,
                          window.innerHeight - agentRolePickerAnchorRect.top + 12,
                        ),
                      }}
                    >
                      <div className="sticky top-0 z-10 rounded-[20px] bg-white px-2.5 pb-2 pt-1.5">
                        <div className="flex items-center justify-between gap-3 px-1">
                          <div className="text-[13px] font-semibold text-slate-900">
                            执行方式
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              openRoleManagementPanel(resolvedPinnedAgentId);
                              setShowAgentRolePicker(false);
                            }}
                            className="inline-flex h-7 items-center rounded-full bg-slate-100 px-2.5 text-[10px] font-medium text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
                          >
                            管理
                          </button>
                        </div>
                        <div className="relative mt-2.5">
                          <Search
                            size={13}
                            strokeWidth={1.8}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                          />
                          <input
                            type="text"
                            value={rolePickerQuery}
                            onChange={(event) => setRolePickerQuery(event.target.value)}
                            placeholder="搜索方式或专家"
                            className="h-8.5 w-full rounded-2xl bg-slate-50/90 pl-9 pr-10 text-[11px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:bg-white shadow-[inset_0_0_0_1px_rgba(226,232,240,0.95)]"
                          />
                          {rolePickerQuery ? (
                            <button
                              type="button"
                              onClick={() => setRolePickerQuery('')}
                              className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                              title="清空搜索"
                              aria-label="清空搜索"
                            >
                              <X size={12} strokeWidth={2.2} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2.5">
                        <div className="space-y-1.5">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              clearSelectedRoleSelection();
                              setAgentSelectionMode('auto');
                              setShowAgentRolePicker(false);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                clearSelectedRoleSelection();
                                setAgentSelectionMode('auto');
                                setShowAgentRolePicker(false);
                              }
                            }}
                            className={`flex w-full items-center justify-between gap-3 rounded-[14px] border px-2.5 py-2.5 text-left transition ${
                              agentSelectionMode === 'auto'
                                ? 'border-sky-200 bg-sky-50/80 shadow-[0_8px_18px_-20px_rgba(14,165,233,0.75)]'
                                : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              {visibleAutoRoleMeta ? (
                                <span className="text-base leading-none">
                                  {visibleAutoRoleMeta.agent.avatar}
                                </span>
                              ) : (
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                                  <Sparkles size={13} />
                                </span>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="text-[12px] font-semibold text-slate-800">
                                    自动选择
                                  </div>
                                  <span className="rounded-full bg-slate-100/90 px-2 py-0.5 text-[9px] font-medium text-slate-400">
                                    推荐
                                  </span>
                                </div>
                                <div className="truncate text-[10.5px] text-slate-500">
                                  {visibleAutoRoleMeta && autoExecutionStrategyLabel
                                    ? `${autoExecutionStrategyLabel} · ${autoExecutionSummary || '先判断任务，再分配最合适的执行方式。'}`
                                    : autoExecutionSummary || '先判断任务，再分配最合适的执行方式。'}
                                </div>
                              </div>
                            </div>
                            {agentSelectionMode === 'auto' ? (
                              <Check size={15} className="shrink-0 text-sky-500" />
                            ) : null}
                          </div>

                          <div className="space-y-1">
                            <div className="px-1 text-[9px] font-medium tracking-[0.1em] text-slate-300">
                              手动选择
                            </div>
                            <div className="max-h-[min(44vh,360px)] overflow-y-auto pr-1">
                              {filteredDurableRoles.length > 0 ? (
                                <div className="space-y-0.5">
                                  {filteredDurableRoles.map((role) => {
                                    const isActive =
                                      agentSelectionMode === 'manual' && selectedRoleId === role.id;
                                    const roleAgentInfo = getAgentInfo(role.baseAgentId);
                                    return (
                                      <div
                                        key={role.id}
                                        className={`flex items-center justify-between gap-3 rounded-[12px] px-2.5 py-2 transition ${
                                          isActive
                                            ? 'bg-amber-50/90 shadow-[inset_0_0_0_1px_rgba(253,230,138,0.9)]'
                                            : 'hover:bg-slate-50/80'
                                        }`}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setAgentSelectionMode('manual');
                                            setPinnedAgentId(role.baseAgentId);
                                            setSelectedRoleSelection({
                                              roleId: role.id,
                                              roleSource: role.source,
                                              baseAgentId: role.baseAgentId,
                                              governanceMode: role.governance.mode,
                                              allowMainBrainRoleMutation:
                                                role.governance.allowMainBrainMutation,
                                              allowMainBrainRolePromotion:
                                                role.governance.allowMainBrainPromotion,
                                            });
                                            setShowAgentRolePicker(false);
                                          }}
                                          className="min-w-0 flex flex-1 items-center gap-3 text-left"
                                        >
                                          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(226,232,240,0.95)]">
                                            {role.avatarUrl ? (
                                              <img
                                                src={role.avatarUrl}
                                                alt={role.title}
                                                className="h-full w-full object-cover"
                                              />
                                            ) : (
                                              <span className="text-sm leading-none">
                                                {roleAgentInfo.avatar}
                                              </span>
                                            )}
                                          </span>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                              <span className="truncate text-[12px] font-semibold text-slate-800">
                                                {role.title}
                                              </span>
                                              {isActive ? (
                                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-medium text-amber-700">
                                                  当前
                                                </span>
                                              ) : null}
                                            </div>
                                            <div className="truncate text-[10.5px] text-slate-500">
                                              {role.summary || `固定到 ${roleAgentInfo.name}`}
                                            </div>
                                          </div>
                                        </button>
                                        {isActive ? (
                                          <Check size={14} className="shrink-0 text-amber-500" />
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}

                              {filteredAgentInfos.length > 0 ? (
                                <div className={filteredDurableRoles.length > 0 ? 'mt-1.5 space-y-0.5' : 'space-y-0.5'}>
                                  {filteredAgentInfos.map((agent) => {
                                    const isActive =
                                      agentSelectionMode === 'manual' &&
                                      !selectedRoleId &&
                                      pinnedAgentId === agent.id;
                                    const isCustomized = hasAgentPromptAddon(agent.id);
                                    return (
                                      <div
                                        key={agent.id}
                                        className={`flex items-center justify-between gap-3 rounded-[12px] px-2.5 py-2 transition ${
                                          isActive
                                            ? 'bg-amber-50/90 shadow-[inset_0_0_0_1px_rgba(253,230,138,0.9)]'
                                            : 'hover:bg-slate-50/80'
                                        }`}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => {
                                            clearSelectedRoleSelection();
                                            setAgentSelectionMode('manual');
                                            setPinnedAgentId(agent.id);
                                            setShowAgentRolePicker(false);
                                          }}
                                          className="min-w-0 flex flex-1 items-center gap-3 text-left"
                                        >
                                          <span className="text-base leading-none">{agent.avatar}</span>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                              <span className="truncate text-[12px] font-semibold text-slate-800">
                                                {agent.name}
                                              </span>
                                              {isActive ? (
                                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-medium text-amber-700">
                                                  当前
                                                </span>
                                              ) : null}
                                            </div>
                                            <div className="truncate text-[10.5px] text-slate-500">
                                              {[...agent.capabilities.slice(0, 2), agent.description]
                                                .filter(Boolean)
                                                .join(' 路 ')}
                                            </div>
                                          </div>
                                        </button>
                                        {isActive ? (
                                          <Check size={14} className="shrink-0 text-amber-500" />
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}

                              {filteredDurableRoles.length === 0 && filteredAgentInfos.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-3 text-[12px] leading-5 text-slate-500">
                                  {normalizedRolePickerQuery
                                    ? '没有匹配的方式，试试换个关键词。'
                                    : '还没有可直接选择的执行方式。'}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>,
                    document.body,
                  )}
              </div>

              <div className="hidden">
                <button
                  type="button"
                  onClick={() => {
                    setShowAgentRolePicker(false);
                    openMainBrainInspector();
                  }}
                  className={`${unifiedIconButtonClass} ${secondaryToolbarButtonClass}`}
                  title="编辑全局偏好：影响长期语气、项目类型和创作偏好"
                  aria-label="编辑全局偏好"
                >
                  <Lightbulb size={16} className="text-amber-500" />
                </button>
                {mainBrainStoredLines.length > 0 ? (
                  <span className={secondaryToolbarActiveDotClass} />
                ) : null}
              </div>

              <div className="relative">
                <button
                  ref={skillBookTriggerRef}
                  type="button"
                  onClick={() => {
                    syncSkillBookPosition();
                    setShowSkillBook(!showSkillBook);
                    setShowAgentRolePicker(false);
                    setShowModelPreference(false);
                  }}
                  className={`${unifiedIconButtonClass} ${
                    showSkillBook || activeQuickSkillId
                      ? 'bg-slate-900 text-white'
                      : secondaryToolbarButtonClass
                  }`}
                  title={activeQuickSkillId ? '技能库：已选择技能' : '技能库'}
                  aria-label="技能库"
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
                      className="fixed z-[320] flex max-h-[min(76vh,720px)] w-[min(376px,calc(100vw-24px))] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-[24px] border border-slate-200/90 bg-white p-2 shadow-[0_18px_46px_-26px_rgba(15,23,42,0.24)]"
                      style={{
                        right: Math.max(12, window.innerWidth - skillBookAnchorRect.right),
                        bottom: Math.max(12, window.innerHeight - skillBookAnchorRect.top + 12),
                      }}
                    >
                      <div className="sticky top-0 z-10 rounded-[20px] bg-white px-2 pb-2 pt-1.5">
                        <div className="flex items-center justify-between gap-2.5">
                          <div className="text-[13px] font-semibold text-slate-900">
                            技能
                          </div>
                          {activeQuickSkillId ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSendSkill?.(null);
                                setActiveQuickSkillPreference(null);
                              }}
                              className="inline-flex h-7 items-center justify-center rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                            >
                              清除
                            </button>
                          ) : null}
                        </div>

                        <div className="relative mt-2.5">
                          <Search
                            size={13}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                          />
                          <input
                            type="text"
                            value={skillBookQuery}
                            onChange={(event) => setSkillBookQuery(event.target.value)}
                            placeholder="搜索技能"
                            className="h-9 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-[11.5px] font-medium text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white"
                          />
                        </div>
                      </div>

                      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                        {pinnedQuickSkills.length > 0 ? (
                          <div className="mt-2">
                            <div className="mb-1.5 text-[10px] font-medium text-slate-400">
                              甯哥敤
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {pinnedQuickSkills.map((skill) => (
                                <button
                                  key={`pinned-${skill.id}`}
                                  type="button"
                                  onClick={() => {
                                    setSendSkill?.(skill.skillData);
                                    setActiveQuickSkillPreference(skill.skillData);
                                    setShowSkillBook(false);
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.25 text-[10px] font-medium text-slate-700 transition hover:border-slate-300"
                                >
                                  <skill.icon size={12} strokeWidth={2} />
                                  {skill.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {recentQuickSkills.length > 0 && !pinnedQuickSkills.length ? (
                          <div className="mt-2">
                            <div className="mb-1.5 text-[10px] font-medium text-slate-400">
                              最近
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {recentQuickSkills.slice(0, 4).map((skill) => (
                                <button
                                  key={`recent-${skill.id}`}
                                  type="button"
                                  onClick={() => {
                                    setSendSkill?.(skill.skillData);
                                    setActiveQuickSkillPreference(skill.skillData);
                                    setShowSkillBook(false);
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.25 text-[10px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                                >
                                  <skill.icon size={12} strokeWidth={2} />
                                  {skill.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-2.5">
                          <div className="mb-1.5 text-[10px] font-medium text-slate-400">
                            全部
                          </div>
                        </div>
                        <div className="max-h-[min(42vh,320px)] space-y-0.5 overflow-y-auto pr-1">
                          {visibleQuickSkills.map((skill) => {
                            const isActive = activeQuickSkillId === skill.id;
                            const isPinned = pinnedSkillIds.includes(skill.id);
                            return (
                              <div
                                key={skill.id}
                                data-skill-book-card={skill.id}
                                className={`rounded-[14px] border px-2.5 py-1.5 transition ${
                                  isActive
                                    ? 'border-slate-900 bg-slate-900/95 text-white'
                                    : 'border-transparent bg-transparent hover:border-slate-200 hover:bg-slate-50/90'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <button
                                    type="button"
                                    data-skill-book-select={skill.id}
                                    onClick={() => {
                                      setSendSkill?.(skill.skillData);
                                      setActiveQuickSkillPreference(skill.skillData);
                                      setShowSkillBook(false);
                                    }}
                                    className="min-w-0 flex-1 text-left"
                                  >
                                    <div className="flex items-center gap-2">
                                      <div
                                        className={`flex h-6 w-6 items-center justify-center rounded-full ${
                                          isActive ? 'bg-white/14 text-white' : 'bg-slate-100 text-slate-600'
                                        }`}
                                      >
                                        <skill.icon size={13} strokeWidth={1.9} />
                                      </div>
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <div className="truncate text-[11.5px] font-semibold">
                                              {skill.name}
                                            </div>
                                            {isActive ? (
                                              <span className="shrink-0 rounded-full bg-white/12 px-1.5 py-0.5 text-[9px] font-semibold text-slate-100">
                                                当前
                                              </span>
                                            ) : null}
                                            <span
                                              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                                                isActive
                                                ? 'bg-white/12 text-slate-100'
                                                : skill.category === 'agent'
                                                  ? 'bg-blue-50 text-blue-600'
                                                  : skill.category === 'workflow'
                                                    ? 'bg-amber-50 text-amber-700'
                                                  : skill.category === 'edit'
                                                    ? 'bg-emerald-50 text-emerald-700'
                                                    : 'bg-slate-100 text-slate-500'
                                            }`}
                                          >
                                            {skill.category === 'agent'
                                              ? '编排'
                                              : skill.category === 'workflow'
                                                ? '工作流'
                                                : skill.category === 'edit'
                                                  ? '编辑'
                                                  : '研究'}
                                          </span>
                                        </div>
                                        {skill.description ? (
                                          <div
                                            className={`mt-0.5 line-clamp-1 text-[9px] leading-4 ${
                                              isActive ? 'text-slate-200' : 'text-slate-500'
                                            }`}
                                          >
                                            {skill.description}
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  </button>
                                  <button
                                    type="button"
                                    data-skill-book-pin={skill.id}
                                    onClick={() => pinSkillPreference(skill.id, !isPinned)}
                                    className={`rounded-full px-2 py-0.75 text-[9px] font-medium transition ${
                                      isActive
                                        ? 'bg-white/12 text-white'
                                        : isPinned
                                          ? 'bg-amber-50 text-amber-700'
                                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                                  >
                                    {isPinned ? '已置顶' : '置顶'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>,
                    document.body,
                  )}
              </div>

              <div className="hidden">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`${unifiedIconButtonClass} ${secondaryToolbarButtonClass}`}
                  title="添加参考图"
                  aria-label="添加参考图"
                >
                  <Paperclip size={16} strokeWidth={1.9} />
                </button>
                {inlineAttachmentFiles.length > 0 ? (
                  <span className={secondaryToolbarActiveDotClass} />
                ) : null}
              </div>

              <div className="relative shrink-0">
                <button
                  ref={modelPreferenceTriggerRef}
                  onClick={() => setShowModelPreference(!showModelPreference)}
                  className={`${unifiedIconButtonClass} ${
                    showModelPreference
                      ? 'bg-slate-900 text-white'
                      : secondaryToolbarButtonClass
                  }`}
                  aria-label="模型偏好设置"
                  title="模型偏好设置"
                >
                  <Box size={16} />
                </button>
                {!autoModelSelect ? (
                  <span className={secondaryToolbarActiveDotClass} />
                ) : null}
                {showModelPreference && (
                  <div
                    ref={modelPreferencePanelRef}
                    className="absolute bottom-full right-0 z-50 mb-4 w-[340px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[24px] border border-slate-200/85 bg-white shadow-[0_20px_48px_-24px_rgba(15,23,42,0.26)] animate-in fade-in slide-in-from-bottom-3 duration-300"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3.5">
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold tracking-tight text-slate-900">
                          模型偏好
                        </div>
                      </div>
                      <button
                        onClick={() => setAutoModelSelect(!autoModelSelect)}
                        className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-[11px] font-semibold transition ${
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

                    <div className="px-4 pt-3">
                      <div className="flex rounded-2xl bg-slate-100/90 p-1">
                        {['image', 'video', '3d'].map((tab) => (
                          <button
                            key={tab}
                            onClick={() =>
                              setModelPreferenceTab(tab as 'image' | 'video' | '3d')
                            }
                            className={`flex-1 rounded-xl py-2 text-[11px] font-semibold transition-all duration-200 ${
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

                    <div className="px-4 pb-4 pt-3">
                      <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 px-3 py-2.5">
                        <div className="mb-1.5 text-[10px] font-semibold tracking-[0.14em] text-slate-400">
                          当前映射
                        </div>
                        <div className="space-y-1.5 text-[11.5px] leading-5 text-slate-600">
                          <div>图像：{mappedImageSummary}</div>
                          <div>视频：{mappedVideoSummary}</div>
                          <div>文本：{mappedScriptSummary}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-[10px] font-semibold tracking-[0.14em] text-slate-400">
                          {modelPreferenceTab === 'image'
                            ? '图片模型'
                            : modelPreferenceTab === 'video'
                              ? '视频模型'
                              : '3D 模型'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {autoModelSelect ? '跟随映射' : '手动选择'}
                        </div>
                      </div>

                      <div className="mt-2.5 flex max-h-[248px] flex-col gap-2 overflow-y-auto pr-1 select-none custom-scrollbar">
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
                              className={`rounded-[18px] border px-3 py-2.5 text-left transition-all ${
                                isSelected
                                  ? 'border-slate-900/10 bg-slate-100/90 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.45)]'
                                  : 'border-slate-200/70 bg-white hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                                    isSelected
                                      ? 'bg-slate-900 text-white'
                                      : 'border border-slate-200 bg-white text-slate-700'
                                  }`}
                                >
                                  <preset.icon size={16} strokeWidth={2} />
                                </div>
                                <div className="flex min-w-0 flex-1 flex-col justify-center">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`text-[13px] font-semibold ${
                                          isSelected ? 'text-slate-900' : 'text-slate-700'
                                        }`}
                                      >
                                        {preset.name}
                                      </span>
                                      {preset.badge && (
                                        <span className="rounded-md border border-blue-100/50 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-500">
                                          {preset.badge}
                                        </span>
                                      )}
                                    </div>
                                    {isSelected && (
                                      <div className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                                        <Check
                                          size={12}
                                          className="text-black"
                                          strokeWidth={3}
                                        />
                                      </div>
                                    )}
                                  </div>
                                  <span className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
                                    {preset.desc}
                                  </span>
                                  {preset.time && (
                                    <div className="mt-1.5 flex items-center">
                                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">
                                        {preset.time}
                                      </span>
                                    </div>
                                  )}
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
      {roleInspectorAgentId && inspectedAgentInfo && !showRoleManagementPanel && (
        <div className="fixed inset-0 z-[138] flex items-center justify-center bg-slate-950/32 p-4 backdrop-blur-[3px]">
          <button
            type="button"
            aria-label="close role quick inspector"
            onClick={closeRoleInspector}
            className="absolute inset-0"
          />
          <div className="relative z-[139] flex max-h-[min(74vh,720px)] w-[min(760px,100%)] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_72px_-24px_rgba(15,23,42,0.42)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xl leading-none">{inspectedAgentInfo.avatar}</span>
                  <h3 className="text-[18px] font-bold text-slate-900">
                    {inspectedDurableRole ? inspectedDurableRole.title : `${inspectedAgentInfo.name} 快速查看`}
                  </h3>
                  {inspectedDurableRole ? (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                      durable role
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-[13px] leading-6 text-slate-500">
                  输入区只保留轻交互；完整版本、发布、回滚和审计流程请进入独立角色管理面板。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    openRoleManagementPanel(roleInspectorAgentId, roleInspectorRoleId)
                  }
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-slate-800"
                >
                  <Sparkles size={13} />
                  打开角色管理
                </button>
                <button
                  type="button"
                  onClick={closeRoleInspector}
                  className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="grid gap-4 overflow-y-auto px-6 py-5 lg:grid-cols-[1fr_1fr]">
              <section className="rounded-3xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    当前绑定概览
                  </div>
                  <p className="mt-2 text-[12px] leading-5 text-slate-500">
                    这里优先确认当前会话到底是绑定长期角色，还是只在使用专家壳。
                  </p>
                </div>
                <div className="space-y-4 px-5 py-4 text-[12px] leading-6 text-slate-700">
                  <div>
                    <div className="font-semibold text-slate-900">专家壳</div>
                    <div className="mt-1 text-slate-600">{inspectedAgentInfo.name}</div>
                  </div>
                  {inspectedDurableRole ? (
                    <>
                      <div>
                        <div className="font-semibold text-slate-900">长期角色摘要</div>
                        <div className="mt-1 text-slate-600">
                          {inspectedDurableRole.summary || '当前没有摘要。'}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                          来源 {inspectedDurableRole.source}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                          状态 {inspectedDurableRole.status}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                          治理 {inspectedDurableRole.governance.mode}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                          版本 v{inspectedDurableRole.version}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-slate-500">
                      当前没有绑定 durable role，仍处于“内置专家壳 + 用户补充层”模式。
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    轻交互动作
                  </div>
                  <p className="mt-2 text-[12px] leading-5 text-slate-500">
                    保留最常用的会话内动作；复杂编辑、审计与回滚不再塞在输入区里。
                  </p>
                </div>
                <div className="space-y-4 px-5 py-4 text-[12px] leading-6 text-slate-700">
                  {inspectedLatestRoleDraft ? (
                    <>
                      <div>
                        <div className="font-semibold text-slate-900">最近自动草案</div>
                        <div className="mt-1 text-slate-600">
                          {inspectedLatestRoleDraft.title || '未命名草案'}
                          {inspectedLatestRoleDraft.summary
                            ? ` 路 ${inspectedLatestRoleDraft.summary}`
                            : ''}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleApplyLatestRoleDraft}
                          className="rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800"
                        >
                          应用到补充层
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveLatestRoleDraftAsFormalRole}
                          className="rounded-full border border-slate-200 px-4 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                        >
                          升级为正式角色
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-slate-500">
                      当前没有可快速处理的自动草案。
                    </div>
                  )}
                  <div className="rounded-2xl bg-slate-50/70 px-4 py-3 text-[11px] leading-5 text-slate-500">
                    若要查看完整提示词层、版本记录、治理权限、发布和回滚，请使用上方“打开角色管理”。
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
      {showRoleManagementPanel && roleInspectorAgentId && inspectedAgentInfo && (
        <RoleManagementPanel
          agentId={roleInspectorAgentId}
          roleId={roleInspectorRoleId}
          roleInspectorDraft={roleInspectorDraft}
          inspectedHasAddon={inspectedHasAddon}
          inspectedPromptDirty={inspectedPromptDirty}
          inspectedBuiltInPrompt={inspectedBuiltInPrompt}
          inspectedMainBrainBlock={inspectedMainBrainBlock}
          inspectedEffectivePrompt={inspectedEffectivePrompt}
          inspectedDurableRole={inspectedDurableRole}
          inspectedRoleVersions={inspectedRoleVersions}
          inspectedRoleProfile={inspectedRoleProfile}
          inspectedLatestRoleDraft={inspectedLatestRoleDraft}
          selectedRoleId={selectedRoleId}
          inspectedRoleAuditEntries={inspectedRoleAuditEntries}
          roleEntityDraft={roleEntityDraft || undefined}
          roleEntityDirty={roleEntityDirty}
          roleEntityCanSubmit={roleEntityCanSubmit}
          onClose={closeRoleInspector}
          onDraftChange={setRoleInspectorDraft}
          onResetPromptAddon={handleResetPromptAddon}
          onSavePromptAddon={handleSavePromptAddon}
          onApplyLatestRoleDraft={handleApplyLatestRoleDraft}
          onSaveLatestRoleDraftAsFormalRole={handleSaveLatestRoleDraftAsFormalRole}
          onClearLatestRoleDraft={handleClearLatestRoleDraft}
          onRoleEntityDraftChange={handleRoleEntityDraftChange}
          onSaveRoleEntity={handleSaveRoleEntity}
          onResetRoleEntityDraft={handleResetRoleEntityDraft}
          onRollbackRoleVersion={handleRollbackRoleVersion}
          onPublishRole={handlePublishRole}
          onArchiveRole={handleArchiveRole}
        />
      )}
      {showMainBrainInspector && (
        <MainBrainConfigCenter
          onClose={closeMainBrainInspector}
          userAssetApi={userAssetApi}
          revision={roleInspectorRevision}
          onSaved={() => setRoleInspectorRevision((value) => value + 1)}
          legacyPreferenceDraft={mainBrainDraft}
          legacyPreferenceDirty={mainBrainDirty}
          legacyPreferenceDefaultText={mainBrainDefaultText}
          legacyPreferenceStoredCount={mainBrainStoredLines.length}
          onLegacyPreferenceDraftChange={setMainBrainDraft}
          onSaveLegacyPreferences={handleSaveMainBrainPreferences}
          onResetLegacyPreferences={handleResetMainBrainPreferences}
        />
      )}
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
