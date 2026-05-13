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
  Image as ImageIcon,
  Lightbulb,
  Paperclip,
  PencilLine,
  Sparkles,
  Video,
  X,
  Zap,
  Layers,
  Cloud,
} from 'lucide-react';
import type { ChatMessage, InputBlock, ImageModel, VideoModel } from '../../../types';
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
    { id: 'dall-e-3', name: 'DALL·E 3', desc: "OpenAI's most advanced image model.", time: '120s', icon: Sparkles },
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
  };
  sendSkill?: ChatMessage['skillData'];
  isSoraVideoModel: boolean;
  handlePickedFiles: (files: File[]) => void;
};

type RoleEntityEditorDraft = {
  title: string;
  summary: string;
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
    isSoraVideoModel,
    handlePickedFiles,
  } = props;

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
  const [showAgentRolePicker, setShowAgentRolePicker] = React.useState(false);
  const agentRolePickerTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const agentRolePickerPanelRef = React.useRef<HTMLDivElement | null>(null);
  const [agentRolePickerAnchorRect, setAgentRolePickerAnchorRect] = React.useState<DOMRect | null>(
    null,
  );
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
  const assistantModeLabel =
    creationMode === 'agent'
      ? '主脑对话'
      : creationMode === 'image'
        ? '图片任务'
        : '视频任务';
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
    if (!showAgentRolePicker) return;

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
  const modeSelectorControl = (
    <div className="relative shrink-0">
      <button
        onClick={() => {
          setShowModeSelector(!showModeSelector);
          setShowAgentRolePicker(false);
        }}
        title="切换当前工作方式"
        className={`flex h-9 items-center justify-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-all ${
          creationMode === 'agent'
            ? 'border-slate-200 bg-white text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50'
            : 'border-blue-200 bg-blue-50/70 text-slate-800 shadow-sm hover:border-blue-300 hover:bg-blue-50'
        }`}
      >
        {creationMode === 'agent' && (
          <>
            <Sparkles size={15} className="text-blue-500" /> {assistantModeLabel}
          </>
        )}
        {creationMode === 'image' && (
          <>
            <ImageIcon size={15} /> {assistantModeLabel}
          </>
        )}
        {creationMode === 'video' && (
          <>
            <Video size={15} /> {assistantModeLabel}
          </>
        )}
      </button>
      {showModeSelector && (
        <div className="absolute bottom-full left-0 z-[70] mb-3 w-[220px] overflow-hidden rounded-2xl border border-gray-100 bg-white py-2 shadow-xl">
          <button
            onClick={() => {
              setCreationMode('agent');
              setShowModeSelector(false);
              setShowAgentRolePicker(false);
              setIsAgentMode(true);
            }}
            className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left text-sm font-medium transition hover:bg-gray-50 ${
              creationMode === 'agent' ? 'text-blue-600' : 'text-gray-700'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <Sparkles
                size={14}
                className={creationMode === 'agent' ? 'mt-0.5 text-blue-500' : 'mt-0.5 text-gray-400'}
              />
              <div>
                <div>主脑对话</div>
                <div className="mt-0.5 text-[11px] font-normal text-gray-400">
                  先理解需求，再决定是否调用执行能力
                </div>
              </div>
            </div>
            {creationMode === 'agent' && <Check size={14} strokeWidth={2.5} />}
          </button>
          <button
            onClick={() => {
              setCreationMode('image');
              setShowModeSelector(false);
              setShowAgentRolePicker(false);
              setIsAgentMode(false);
            }}
            className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left text-sm font-medium transition hover:bg-gray-50 ${
              creationMode === 'image' ? 'text-blue-600' : 'text-gray-700'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <ImageIcon
                size={14}
                className={creationMode === 'image' ? 'mt-0.5 text-blue-500' : 'mt-0.5 text-gray-400'}
              />
              <div>
                <div>图片任务</div>
                <div className="mt-0.5 text-[11px] font-normal text-gray-400">
                  进入图片生成、比例、模型与质量设置
                </div>
              </div>
            </div>
            {creationMode === 'image' && <Check size={14} strokeWidth={2.5} />}
          </button>
          <button
            onClick={() => {
              setCreationMode('video');
              setShowModeSelector(false);
              setShowAgentRolePicker(false);
              setIsAgentMode(false);
            }}
            className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left text-sm font-medium transition hover:bg-gray-50 ${
              creationMode === 'video' ? 'text-blue-600' : 'text-gray-700'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <Video
                size={14}
                className={creationMode === 'video' ? 'mt-0.5 text-blue-500' : 'mt-0.5 text-gray-400'}
              />
              <div>
                <div>视频任务</div>
                <div className="mt-0.5 text-[11px] font-normal text-gray-400">
                  进入视频生成与时长等相关设置
                </div>
              </div>
            </div>
            {creationMode === 'video' && <Check size={14} strokeWidth={2.5} />}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="px-3 py-1.5 flex items-center justify-between relative border-t border-gray-100/80">
        {creationMode !== 'agent' && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-2">
            {modeSelectorControl}

            {creationMode === 'image' && (
              <div className="relative">
                <button
                  onClick={() => {
                    setShowRatioPicker(!showRatioPicker);
                    setShowModelPicker(false);
                    setShowVideoSettingsDropdown(false);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-gray-50 rounded-lg transition-colors group"
                >
                  <span className="text-[13px] font-bold text-gray-800">
                    {imageGenRes} · {imageGenRatio}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-gray-400 group-hover:text-gray-600 transition-transform ${
                      showRatioPicker ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {showRatioPicker && (
                  <div className="absolute bottom-full left-0 mb-3 w-[260px] bg-white rounded-[24px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] border border-gray-100 p-5 z-[70] animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-4">
                      分辨率
                    </div>
                    <div className="flex gap-2 mb-6">
                      {['1K', '2K', '4K'].map((res) => (
                        <button
                          key={res}
                          onClick={() => setImageGenRes(res)}
                          className={`flex-1 py-1.5 text-[12px] font-bold rounded-xl transition-all ${
                            imageGenRes === res
                              ? 'bg-gray-200 text-black shadow-inner'
                              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          {res}
                        </button>
                      ))}
                    </div>
                    <div className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-4">
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
                          className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border transition-all ${
                            imageGenRatio === item.r
                              ? 'bg-gray-100 border-gray-300 ring-1 ring-gray-300'
                              : 'border-gray-100 hover:border-gray-300 bg-white'
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
              </div>
            )}

            {creationMode === 'video' && (
              <div className="relative">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowVideoSettingsDropdown(!showVideoSettingsDropdown);
                    setShowRatioPicker(false);
                    setShowModelPicker(false);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-gray-50 rounded-lg transition-colors group"
                >
                  <span className="text-[13px] font-bold text-gray-800">
                    Frames · {videoGenRatio} · {videoGenDuration}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-gray-400 group-hover:text-gray-600 transition-transform ${
                      showVideoSettingsDropdown ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {showVideoSettingsDropdown && (
                  <div
                    onClick={(event) => event.stopPropagation()}
                    className="absolute bottom-full left-0 mb-3 w-[300px] bg-white rounded-[24px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] border border-gray-100 p-5 z-[70] animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col gap-5"
                  >
                    <div className="flex flex-col gap-2.5">
                      <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                        Generate method
                      </div>
                      <div className="flex bg-gray-100 p-1 rounded-xl">
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
                            className={`flex-1 py-1.5 text-[12px] font-bold rounded-lg transition-all ${
                              videoGenMode === mode.id
                                ? 'bg-white shadow-sm text-black'
                                : 'text-gray-400'
                            }`}
                          >
                            {mode.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
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
                            className={`flex flex-col items-center justify-center gap-2 py-3.5 rounded-xl border transition-all h-20 ${
                              videoGenRatio === item.r
                                ? 'bg-gray-100 border-gray-200'
                                : 'border-gray-100 hover:border-gray-200 bg-white'
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
                      <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
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
                            className={`flex-1 py-2 text-[12px] font-bold rounded-xl border transition-all ${
                              videoGenDuration === sec
                                ? 'bg-gray-100 border-gray-200 text-black'
                                : 'bg-white border-gray-100 text-gray-400'
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
            )}
          </div>
        )}

        <div
          className={
            creationMode === 'agent'
              ? 'flex min-w-0 flex-1 justify-end'
              : 'flex items-center gap-3 flex-wrap'
          }
        >
          {(creationMode === 'image' || creationMode === 'video') && (
            <>
              <div className="relative">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowModelPicker(!showModelPicker);
                    setShowRatioPicker(false);
                    setShowVideoSettingsDropdown(false);
                  }}
                  className={`w-9 h-9 flex items-center justify-center rounded-full transition-all border ${
                    showModelPicker
                      ? 'bg-black text-white border-black shadow-lg'
                      : 'bg-white text-gray-400 border-gray-100 hover:border-gray-300 shadow-sm'
                  }`}
                >
                  {creationMode === 'video' ? (
                    <Activity size={18} strokeWidth={2} />
                  ) : (
                    <Banana size={18} strokeWidth={2} />
                  )}
                </button>
                {showModelPicker && (
                  <div className="absolute bottom-full right-0 mb-3 w-[260px] bg-white rounded-[24px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] border border-gray-100 p-4 z-[100] animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                        className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 hover:bg-white focus:bg-white rounded-xl text-[13px] font-bold text-gray-800 outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all placeholder:font-medium placeholder:text-gray-400"
                      />

                      <div className="flex flex-col gap-1 mt-1 max-h-[160px] overflow-y-auto pr-1 select-none custom-scrollbar">
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
                                className={`text-left px-3 py-2.5 rounded-xl transition-all w-full flex items-center justify-between group ${
                                  isSelected ? 'bg-black text-white' : 'hover:bg-gray-100 text-gray-700'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <div
                                    className={`w-6 h-6 rounded-md flex items-center justify-center ${
                                      isSelected
                                        ? 'bg-white/10 text-white'
                                        : 'bg-white shadow-sm border border-gray-100 text-gray-600'
                                    }`}
                                  >
                                    <preset.icon size={13} strokeWidth={2.5} />
                                  </div>
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={`text-[13px] font-bold ${
                                          isSelected
                                            ? 'text-white'
                                            : 'text-gray-900 group-hover:text-black'
                                        }`}
                                      >
                                        {preset.name}
                                      </span>
                                      {preset.badge && (
                                        <span
                                          className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${
                                            isSelected
                                              ? 'bg-white/20 text-white'
                                              : 'bg-blue-50 text-blue-500 border border-blue-100/50'
                                          }`}
                                        >
                                          {preset.badge}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {isSelected && <Check size={14} className="text-white shrink-0" />}
                              </button>
                            );
                          },
                        )}
                      </div>

                      <div className="text-[10px] text-gray-400 font-medium px-1 leading-relaxed mt-1">
                        默认会优先读取设置里的模型映射；这里选择的是本次任务的临时覆盖模型。若未找到通道可能导致响应失败。
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {creationMode === 'image' && (
                  <>
                    <div className="relative">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setShowImageCountPicker(!showImageCountPicker);
                          setShowModelPicker(false);
                          setShowRatioPicker(false);
                          setShowVideoSettingsDropdown(false);
                        }}
                        className={`h-8 px-2.5 rounded-full text-[11px] font-bold border transition inline-flex items-center gap-1.5 ${
                          showImageCountPicker
                            ? 'bg-gray-100 text-gray-900 border-gray-300'
                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                        }`}
                        title="选择本次生成图片数量"
                      >
                        <span>{imageGenCount}张</span>
                        <ChevronDown
                          size={12}
                          className={`transition-transform ${
                            showImageCountPicker ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {showImageCountPicker && (
                        <div
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
                                {count}张
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setTranslatePromptToEnglish(!translatePromptToEnglish)}
                      className={`h-8 px-2.5 rounded-full text-[11px] font-bold border transition ${
                        translatePromptToEnglish
                          ? 'bg-blue-50 text-blue-600 border-blue-200'
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                      title={
                        translatePromptToEnglish
                          ? '当前：提示词会翻译为英文'
                          : '当前：优先保留中文提示词'
                      }
                    >
                      英译
                    </button>
                    <button
                      onClick={() =>
                        setEnforceChineseTextInImage(!enforceChineseTextInImage)
                      }
                      className={`h-8 px-2.5 rounded-full text-[11px] font-bold border transition ${
                        enforceChineseTextInImage
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                      title={
                        enforceChineseTextInImage
                          ? '当前：强制画面文字为中文'
                          : '当前：不强制画面文字中文'
                      }
                    >
                      中文字
                    </button>
                    <input
                      type="text"
                      value={requiredChineseCopy}
                      onChange={(event) => setRequiredChineseCopy(event.target.value)}
                      placeholder="指定文案"
                      className="h-8 w-24 px-2 rounded-full border border-gray-200 text-[11px] font-medium text-gray-700 bg-white focus:outline-none focus:border-gray-400"
                      title="可选：指定画面中必须出现的中文文案"
                    />
                  </>
                )}
                <button
                  onClick={() =>
                    handleSend(
                      undefined,
                      imageGenUploads.length > 0 ? imageGenUploads : [],
                      undefined,
                      sendSkill,
                    )
                  }
                  disabled={
                    imageGenUploads.length === 0 &&
                    inputBlocks.every((block) => block.type === 'text' && !block.text)
                  }
                  className="h-9 pl-3 pr-4 rounded-full flex items-center gap-2 text-[13px] font-bold transition bg-[#f3f4f6] text-[#6b7280] hover:bg-gray-200 hover:text-gray-700 disabled:opacity-50"
                  title={creationMode === 'image' ? '开始图片任务' : '开始视频任务'}
                  aria-label={creationMode === 'image' ? '开始图片任务' : '开始视频任务'}
                >
                  <Zap
                    size={14}
                    fill="currentColor"
                    strokeWidth={0}
                    className="text-blue-400"
                  />
                  <span>{creationMode === 'image' ? '开始图片任务' : '开始视频任务'}</span>
                </button>
              </div>
            </>
          )}

          {creationMode === 'agent' && (
            <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-[24px] border border-slate-200/90 bg-[linear-gradient(135deg,rgba(248,250,252,0.95),rgba(255,255,255,0.98))] px-3 py-2.5 shadow-[0_10px_32px_-24px_rgba(15,23,42,0.42),inset_0_1px_0_rgba(255,255,255,0.78)]">
              <div className="flex flex-wrap items-center gap-2">
                {modeSelectorControl}

                <div className="flex h-9 items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                  <button
                    onClick={() => handleModeSwitch('thinking')}
                    className={`flex h-7 items-center justify-center gap-1 rounded-full px-2.5 text-[11px] font-bold transition ${
                      modelMode === 'thinking'
                        ? 'bg-blue-50 text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                    aria-label="深思模式"
                  >
                    <Lightbulb size={13} />
                    <span>深思</span>
                  </button>
                  <button
                    onClick={() => handleModeSwitch('fast')}
                    className={`flex h-7 items-center justify-center gap-1 rounded-full px-2.5 text-[11px] font-bold transition ${
                      modelMode === 'fast'
                        ? 'bg-amber-50 text-amber-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                    aria-label="快速模式"
                  >
                    <Zap size={13} />
                    <span>快速</span>
                  </button>
                </div>

                <button
                  onClick={() => setWebEnabled(!webEnabled)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold transition ${
                    webEnabled
                      ? 'border-blue-200 bg-blue-50 text-blue-600'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                  title={webEnabled ? '已开启联网搜索' : '当前不联网'}
                  aria-label="联网开关"
                >
                  <Globe size={14} />
                  <span>联网</span>
                </button>

                <div className="flex min-w-0 max-w-full items-center gap-2">
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
                    className={`inline-flex h-9 max-w-full items-center gap-2 rounded-full border px-3 text-[11px] font-bold transition ${
                      agentSelectionMode === 'manual'
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                    title={agentRoleDescription}
                  >
                    <span className="max-w-[180px] truncate">{agentRoleLabel}</span>
                    <ChevronDown
                      size={12}
                      className={`shrink-0 transition-transform ${
                        showAgentRolePicker ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAgentRolePicker(false);
                      openMainBrainInspector();
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50"
                    title="编辑全局偏好"
                  >
                    <Lightbulb size={13} className="text-amber-500" />
                    <span>全局偏好</span>
                  </button>
                  {showAgentRolePicker &&
                    agentRolePickerAnchorRect &&
                    typeof document !== 'undefined' &&
                    createPortal(
                      <div
                        ref={agentRolePickerPanelRef}
                        className="fixed z-[320] w-[min(420px,calc(100vw-24px))] max-w-[calc(100vw-24px)] overflow-hidden rounded-[24px] border border-slate-200 bg-white p-2 shadow-[0_22px_60px_-24px_rgba(15,23,42,0.35)] animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200"
                        style={{
                          right: Math.max(12, window.innerWidth - agentRolePickerAnchorRect.right),
                          bottom: Math.max(
                            12,
                            window.innerHeight - agentRolePickerAnchorRect.top + 12,
                          ),
                        }}
                      >
                      <div className="px-3 pb-3 pt-2">
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          角色选择
                        </div>
                        <div className="mt-1 text-[12px] leading-5 text-slate-500">
                          可以让系统自动分配，也可以固定交给某个角色执行。
                        </div>
                      </div>

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
                        className={`mb-2 flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                          agentSelectionMode === 'auto'
                            ? 'border-blue-200 bg-blue-50/80'
                            : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-slate-800">自动角色</div>
                          <div className="mt-1 text-[12px] leading-5 text-slate-500">
                            先由 Coco 判断任务，再路由给最合适的专家角色。
                          </div>
                          {visibleAutoRoleMeta && (
                            <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2.5">
                              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                                {visibleAutoRoleMeta.isLive ? '本轮角色脑' : '最近临时脑'}
                              </div>
                              <div className="mt-1 flex items-center gap-2 text-[12px] font-semibold text-slate-800">
                                <span className="text-sm leading-none">
                                  {visibleAutoRoleMeta.agent.avatar}
                                </span>
                                <span className="truncate">
                                  {visibleAutoRoleMeta.agent.name}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                  {visibleAutoRoleMeta.roleStrategy}
                                </span>
                              </div>
                              {visibleAutoRoleMeta.draft?.title ? (
                                <div className="mt-1 text-[12px] font-medium leading-5 text-slate-700">
                                  {visibleAutoRoleMeta.draft.title}
                                </div>
                              ) : visibleAutoRoleMeta.isLive ? (
                                <div className="mt-1 text-[12px] font-medium leading-5 text-slate-700">
                                  本轮直接复用现有角色，没有额外创建临时脑
                                </div>
                              ) : null}
                              {visibleAutoRoleMeta.draft?.summary ? (
                                <div className="mt-1 text-[11px] leading-5 text-slate-500">
                                  {visibleAutoRoleMeta.draft.summary}
                                </div>
                              ) : null}
                              {!visibleAutoRoleMeta.draft?.summary &&
                              visibleAutoRoleMeta.roleStrategyReason ? (
                                <div className="mt-1 text-[11px] leading-5 text-slate-500">
                                  {visibleAutoRoleMeta.roleStrategyReason}
                                </div>
                              ) : null}
                              {visibleAutoRoleMeta.draft &&
                              visibleAutoRoleMeta.draft.instructions.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {visibleAutoRoleMeta.draft.instructions
                                    .slice(0, 2)
                                    .map((item) => (
                                      <span
                                        key={`auto-role-draft-${item}`}
                                        className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500"
                                      >
                                        {item}
                                      </span>
                                    ))}
                                </div>
                              ) : null}
                              <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openRoleInspector(visibleAutoRoleMeta.agent.id);
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                                >
                                  <PencilLine size={12} />
                                  {visibleAutoRoleMeta.isLive ? '快速查看' : '查看临时脑'}
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openRoleManagementPanel(visibleAutoRoleMeta.agent.id);
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800"
                                >
                                  <Sparkles size={12} />
                                  角色管理
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        {agentSelectionMode === 'auto' && (
                          <Check size={14} className="mt-0.5 shrink-0 text-blue-500" />
                        )}
                      </div>

                      <div className="space-y-3">
                        {availableDurableRoles.length > 0 && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                            <div className="px-1">
                              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                                长期角色库
                              </div>
                              <div className="mt-1 text-[12px] leading-5 text-slate-500">
                                这里展示真实可持久化的角色实体，绑定后会一并带上治理模式、版本和审计语义。
                              </div>
                            </div>
                            <div className="mt-3 max-h-[220px] space-y-2 overflow-y-auto pr-1">
                              {availableDurableRoles.map((role) => {
                                const isActive =
                                  agentSelectionMode === 'manual' && selectedRoleId === role.id;
                                const roleAgentInfo = getAgentInfo(role.baseAgentId);
                                return (
                                  <div
                                    key={role.id}
                                    className={`flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                                      isActive
                                        ? 'border-amber-200 bg-amber-50/80'
                                        : 'border-slate-200 bg-white hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="min-w-0 flex-1">
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
                                        className="w-full text-left"
                                      >
                                        <div className="flex min-w-0 items-center gap-2">
                                          <span className="text-base leading-none">
                                            {roleAgentInfo.avatar}
                                          </span>
                                          <span className="truncate text-[13px] font-semibold text-slate-800">
                                            {role.title}
                                          </span>
                                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                            {role.status === 'active'
                                              ? '已启用'
                                              : role.status === 'archived'
                                                ? '已归档'
                                                : '草稿'}
                                          </span>
                                        </div>
                                        <div className="mt-1 text-[12px] leading-5 text-slate-500">
                                          {role.summary || `绑定到 ${roleAgentInfo.name} 专家壳`}
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">
                                            {roleAgentInfo.name}
                                          </span>
                                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">
                                            {role.source}
                                          </span>
                                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">
                                            {role.governance.mode}
                                          </span>
                                        </div>
                                      </button>
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            openRoleInspector(role.baseAgentId, role.id);
                                          }}
                                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                                        >
                                          <PencilLine size={12} />
                                          快速查看
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            openRoleManagementPanel(role.baseAgentId, role.id);
                                          }}
                                          className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800"
                                        >
                                          <Sparkles size={12} />
                                          角色管理
                                        </button>
                                      </div>
                                    </div>
                                    {isActive && (
                                      <Check size={14} className="mt-0.5 shrink-0 text-amber-500" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="px-1">
                          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                            内置专家壳
                          </div>
                          <div className="mt-1 text-[12px] leading-5 text-slate-500">
                            直接选择专家壳时，不会绑定 durable role，只会使用该专家的内置定义和用户补充层。
                          </div>
                        </div>

                        <div className="max-h-[min(40vh,300px)] space-y-2 overflow-y-auto pr-1">
                          {availableAgentInfos.map((agent) => {
                            const isActive =
                              agentSelectionMode === 'manual' && !selectedRoleId && pinnedAgentId === agent.id;
                            const isCustomized = hasAgentPromptAddon(agent.id);
                            return (
                              <div
                                key={agent.id}
                                className={`flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                                  isActive
                                    ? 'border-amber-200 bg-amber-50/80'
                                    : 'border-slate-200 bg-white hover:bg-slate-50'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      clearSelectedRoleSelection();
                                      setAgentSelectionMode('manual');
                                      setPinnedAgentId(agent.id);
                                      setShowAgentRolePicker(false);
                                    }}
                                    className="w-full text-left"
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      <span className="text-base leading-none">{agent.avatar}</span>
                                      <span className="truncate text-[13px] font-semibold text-slate-800">
                                        {agent.name}
                                      </span>
                                      {isCustomized && (
                                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                                          自定义规则
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-1 text-[12px] leading-5 text-slate-500">
                                      {agent.description}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {agent.capabilities.slice(0, 3).map((capability) => (
                                        <span
                                          key={`${agent.id}-${capability}`}
                                          className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500"
                                        >
                                          {capability}
                                        </span>
                                      ))}
                                    </div>
                                  </button>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openRoleInspector(agent.id);
                                      }}
                                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                                    >
                                      <PencilLine size={12} />
                                      快速查看
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openRoleManagementPanel(agent.id);
                                      }}
                                      className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800"
                                    >
                                      <Sparkles size={12} />
                                      角色管理
                                    </button>
                                  </div>
                                </div>
                                {isActive && (
                                  <Check size={14} className="mt-0.5 shrink-0 text-amber-500" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      </div>,
                      document.body,
                    )}
                </div>

              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                  title="添加参考图"
                  aria-label="添加参考图"
                >
                  <Paperclip size={17} strokeWidth={1.8} />
                </button>

                <div className="flex items-center gap-2">
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setShowModelPreference(!showModelPreference)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                      aria-label="模型偏好设置"
                    >
                      <Box size={16} />
                    </button>
                    {showModelPreference && (
                      <div className="absolute bottom-full right-0 z-50 mb-4 w-[350px] max-w-[calc(100vw-32px)] rounded-[32px] border border-slate-100 bg-white p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] animate-in fade-in slide-in-from-bottom-3 duration-300">
                        <div className="mb-6 flex items-center justify-between">
                          <h3 className="font-display text-[17px] font-bold tracking-tight text-slate-900">
                            模型偏好
                          </h3>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              自动选择
                            </span>
                            <button
                              onClick={() => setAutoModelSelect(!autoModelSelect)}
                              className={`relative h-6 w-11 rounded-full transition-all duration-300 ${
                                autoModelSelect ? 'bg-black' : 'bg-slate-200 p-0.5'
                              }`}
                            >
                              <motion.div
                                animate={{ x: autoModelSelect ? 24 : 2 }}
                                className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm"
                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                              />
                            </button>
                          </div>
                        </div>

                        <div className="mb-6 flex rounded-2xl bg-slate-100/70 p-1.5">
                          {['image', 'video', '3d'].map((tab) => (
                            <button
                              key={tab}
                              onClick={() =>
                                setModelPreferenceTab(tab as 'image' | 'video' | '3d')
                              }
                              className={`flex-1 rounded-xl py-2 text-[11px] font-bold uppercase tracking-wider transition-all duration-300 ${
                                modelPreferenceTab === tab
                                  ? 'bg-white text-black shadow-sm'
                                  : 'text-slate-400 hover:text-slate-600'
                              }`}
                            >
                              {tab}
                            </button>
                          ))}
                        </div>

                        <div className="space-y-4 px-1 pb-2">
                          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              设置映射
                            </div>
                            <div className="mt-2 text-[12px] font-semibold leading-6 text-slate-700">
                              图像：{mappedImageSummary}
                            </div>
                            <div className="text-[12px] font-semibold leading-6 text-slate-700">
                              视频：{mappedVideoSummary}
                            </div>
                            <div className="text-[12px] font-semibold leading-6 text-slate-700">
                              文本：{mappedScriptSummary}
                            </div>
                          </div>
                          <div className="text-[11px] font-bold uppercase text-slate-600">
                            {modelPreferenceTab === 'image'
                              ? '图像'
                              : modelPreferenceTab === 'video'
                                ? '视频'
                                : '3D'}{' '}
                            生成调度模型
                          </div>
                          <input
                            type="text"
                            value={
                              modelPreferenceTab === 'image'
                                ? effectiveImagePreference
                                : modelPreferenceTab === 'video'
                                  ? effectiveVideoPreference
                                  : preferred3DModel
                            }
                            onChange={(event) => {
                              const value = event.target.value;
                              if (modelPreferenceTab === 'image') {
                                setPreferredImageModel(value as ImageModel);
                                setPreferredImageProviderId(null);
                              } else if (modelPreferenceTab === 'video') {
                                setPreferredVideoModel(value as VideoModel);
                                setPreferredVideoProviderId(null);
                              } else {
                                setPreferred3DModel(value);
                              }
                              setAutoModelSelect(false);
                            }}
                            placeholder={`当前映射：${
                              modelPreferenceTab === 'image'
                                ? mappedImageSummary
                                : modelPreferenceTab === 'video'
                                  ? mappedVideoSummary
                                  : '未配置'
                            }`}
                            className={`w-full rounded-xl border bg-slate-50/60 px-4 py-3 text-[13px] font-bold text-slate-800 outline-none transition-all hover:bg-white focus:bg-white focus:ring-4 focus:ring-black/5 ${
                              !autoModelSelect
                                ? 'border-black'
                                : 'border-slate-200 focus:border-black'
                            }`}
                          />

                          <div className="mt-2 flex max-h-[220px] flex-col gap-1.5 overflow-y-auto border-b border-slate-100 pb-4 pr-2 select-none custom-scrollbar">
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
                                  className={`rounded-2xl border p-3 text-left transition-all ${
                                    isSelected
                                      ? 'border-slate-200/70 bg-slate-50/80 shadow-sm'
                                      : 'border-transparent bg-transparent hover:border-slate-100 hover:bg-slate-50/60'
                                  }`}
                                >
                                  <div className="flex gap-3">
                                    <div
                                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                                        isSelected
                                          ? 'bg-black text-white shadow-sm'
                                          : 'border border-slate-200 bg-white text-slate-700 shadow-sm'
                                      }`}
                                    >
                                      <preset.icon size={16} strokeWidth={2} />
                                    </div>
                                    <div className="flex min-w-0 flex-1 flex-col justify-center">
                                      <div className="mb-0.5 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span
                                            className={`text-[14px] font-bold ${
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
                                          <div className="flex h-5 w-5 items-center justify-center rounded-md border border-slate-200 bg-white shadow-sm">
                                            <Check size={12} className="text-black" strokeWidth={3} />
                                          </div>
                                        )}
                                      </div>
                                      <span className="truncate text-xs font-medium text-slate-500">
                                        {preset.desc}
                                      </span>
                                      {preset.time && (
                                        <div className="mt-1.5 flex items-center">
                                          <span className="rounded-md bg-slate-100/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
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

                          <p className="pt-2 text-[11px] font-medium leading-relaxed text-slate-400">
                            绕过原有选择限制。系统将会将您的请求调度至设定的模型。填入的值须确保您绑定的
                            API 供应商提供支持。<br />
                            若在特定任务中由于未找到模型导致失败，重试前请核对模型标识符。
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() =>
                      handleSend(
                        undefined,
                        undefined,
                        undefined,
                        sendSkill,
                      )
                    }
                    disabled={inputBlocks.every((block) => block.type === 'text' && !block.text)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-slate-800 disabled:opacity-50"
                    title="发送"
                    aria-label="发送"
                  >
                    <ArrowUp size={15} strokeWidth={2.4} className="text-white" />
                  </button>
                </div>
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
                  输入区只保留轻交互；完整版本、发布、回滚和审计流请进入独立角色管理面板。
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
                            ? ` · ${inspectedLatestRoleDraft.summary}`
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
