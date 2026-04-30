import { useEffect, useState } from "react";
import { useAgentStore } from "../../../stores/agent.store";
import type {
  ChatMessage,
  CnDetailPromptVersion,
  CnDetailRatioMode,
  CnDetailRetryPolicy,
  CnDetailTextMode,
  ConversationSession,
} from "../../../types";
import {
  getActiveQuickSkillPreference,
  getPluginPreferenceRecord,
  recordPluginActivation,
  setActiveQuickSkillPreference,
} from "../../../services/runtime-assets/preferences";
import { getStudioPluginAsset } from "../../../services/runtime-assets/studio-registry";

type AssistantSkillData = NonNullable<ChatMessage["skillData"]>;

type QuickSkillKind =
  | "amazon"
  | "cn-detail"
  | "social"
  | "brochure"
  | "storyboard"
  | "clothing"
  | "ecommerce"
  | "oneclick";

type QuickSkillEntry = {
  id: string;
  pluginId: string;
  label: string;
  iconName: string;
  kind: QuickSkillKind;
};

const normalizeSkillSignature = (
  skill: ChatMessage["skillData"] | null | undefined,
) => {
  if (!skill) return "";
  return JSON.stringify({
    id: skill.id || "",
    name: skill.name || "",
    iconName: skill.iconName || "",
    config: skill.config || null,
  });
};

const STORYBOARD_SKILL: AssistantSkillData = {
  id: "cameron",
  pluginId: "quick-skills",
  name: "分镜故事板",
  iconName: "Film",
};

const AMAZON_LISTING_SKILL: AssistantSkillData = {
  id: "amazon-listing",
  pluginId: "quick-skills",
  name: "亚马逊产品套图",
  iconName: "Store",
  config: {
    twoStep: true,
    defaults: {
      aspectRatio: "3:4",
      count: 3,
      imageSize: "2K",
      model: "nanobanana2",
    },
  },
};

const SOCIAL_MEDIA_SKILL: AssistantSkillData = {
  id: "social-media",
  pluginId: "quick-skills",
  name: "社交媒体",
  iconName: "Globe",
  config: { twoStep: true },
};

const BROCHURE_SKILL: AssistantSkillData = {
  id: "brochure",
  pluginId: "quick-skills",
  name: "营销宣传册",
  iconName: "FileText",
  config: { twoStep: true },
};

const CLOTHING_SKILL: AssistantSkillData = {
  id: "clothing-studio-workflow",
  pluginId: "quick-skills",
  name: "服装棚拍组图",
  iconName: "Shirt",
  config: {
    twoStep: true,
    defaults: {
      aspectRatio: "3:4",
      count: 3,
      model: "nanobanana2",
    },
  },
};

const ECOMMERCE_ONE_CLICK_WORKFLOW_SKILL: AssistantSkillData = {
  id: "ecom-oneclick-workflow",
  pluginId: "quick-skills",
  name: "电商一键工作流",
  iconName: "Package",
  config: {
    workflow: "ecommerce-oneclick",
  },
};

const ONE_CLICK_SKILL: AssistantSkillData = {
  id: "xcai-oneclick",
  pluginId: "quick-skills",
  name: "SKYSPER视觉",
  iconName: "Compass",
  config: {
    mode: "standard",
    outputs: {
      startup_pack: true,
      p0_strategy: true,
      p1_visual: true,
      p2_copy: true,
      p3_main_image: true,
      p4_secondary_images: true,
      p5_aplus: true,
      final_image_generation: false,
    },
  },
};

const DEFAULT_CN_DETAIL_RETRY_POLICY: CnDetailRetryPolicy = {
  maxRetriesPerShot: 3,
  tiers: [
    { maxRetries: 1, densityScale: 1 },
    { maxRetries: 1, densityScale: 0.8 },
    { maxRetries: 1, densityScale: 0.65 },
  ],
};

type UseAssistantSidebarQuickSkillsArgs = {
  conversations: ConversationSession[];
  setConversations: React.Dispatch<React.SetStateAction<ConversationSession[]>>;
  activeConversationId: string;
  creationMode: "agent" | "image" | "video";
  onOpenEcommerceWorkflow?: () => void;
  handleSend: (
    overridePrompt?: string,
    overrideAttachments?: File[],
    overrideWeb?: boolean,
    skillData?: ChatMessage["skillData"],
  ) => Promise<void>;
};

export const useAssistantSidebarQuickSkills = ({
  conversations,
  setConversations,
  activeConversationId,
  creationMode,
  onOpenEcommerceWorkflow,
  handleSend,
}: UseAssistantSidebarQuickSkillsArgs) => {
  const inputBlocks = useAgentStore((state) => state.composer.inputBlocks);
  const webEnabled = useAgentStore((state) => state.webEnabled);

  const [activeQuickSkill, setActiveQuickSkill] = useState<
    ChatMessage["skillData"] | null
  >(() => getActiveQuickSkillPreference());
  const [cnDetailPromptVersion, setCnDetailPromptVersion] =
    useState<CnDetailPromptVersion>("new");
  const [cnDetailTextMode, setCnDetailTextMode] =
    useState<CnDetailTextMode>("auto");
  const [cnDetailRatioMode, setCnDetailRatioMode] =
    useState<CnDetailRatioMode>("adaptive");

  useEffect(() => {
    const currentConversation = conversations.find(
      (conversation) => conversation.id === activeConversationId,
    );
    const skill =
      (
        currentConversation as ConversationSession & {
          meta?: { activeQuickSkill?: ChatMessage["skillData"] | null };
        }
      )?.meta?.activeQuickSkill || null;
    const nextSkillSignature = normalizeSkillSignature(skill);
    const currentSkillSignature = normalizeSkillSignature(activeQuickSkill);
    if (nextSkillSignature !== currentSkillSignature) {
      setActiveQuickSkill(skill);
    }
    if (skill?.id === "cn-detail-page") {
      const defaults = skill?.config?.defaults || {};
      const promptVersion = defaults.promptVersion;
      const textMode = defaults.textMode;
      const ratioMode = defaults.ratioMode;
      const nextPromptVersion =
        promptVersion === "original" ? "original" : "new";
      const nextTextMode =
        textMode === "withText" || textMode === "noText" ? textMode : "auto";
      const nextRatioMode = ratioMode === "fixed" ? "fixed" : "adaptive";

      if (cnDetailPromptVersion !== nextPromptVersion) {
        setCnDetailPromptVersion(nextPromptVersion);
      }
      if (cnDetailTextMode !== nextTextMode) {
        setCnDetailTextMode(nextTextMode);
      }
      if (cnDetailRatioMode !== nextRatioMode) {
        setCnDetailRatioMode(nextRatioMode);
      }
    }
  }, [
    activeConversationId,
    activeQuickSkill,
    cnDetailPromptVersion,
    cnDetailRatioMode,
    cnDetailTextMode,
    conversations,
  ]);

  const setConversationQuickSkill = (
    conversationId: string,
    skill: ChatMessage["skillData"] | null,
  ) => {
    setConversations((previous) => {
      let changed = false;
      const nextConversations = previous.map((conversation) => {
        if (conversation.id !== conversationId) return conversation;
        const currentSkill =
          (
            conversation as ConversationSession & {
              meta?: { activeQuickSkill?: ChatMessage["skillData"] | null };
            }
          ).meta?.activeQuickSkill || null;
        if (
          normalizeSkillSignature(currentSkill) ===
          normalizeSkillSignature(skill)
        ) {
          return conversation;
        }
        changed = true;
        const nextMeta = {
          ...((
            conversation as ConversationSession & {
              meta?: Record<string, unknown>;
            }
          ).meta || {}),
          activeQuickSkill: skill || undefined,
        };
        return { ...conversation, meta: nextMeta } as ConversationSession;
      });
      return changed ? nextConversations : previous;
    });
  };

  const setActiveQuickSkillSynced = (
    skill: ChatMessage["skillData"] | null,
  ) => {
    setActiveQuickSkill(skill);
    setActiveQuickSkillPreference(skill);
    if (activeConversationId) {
      setConversationQuickSkill(activeConversationId, skill);
    }
  };

  const createCnDetailSkillData = (
    promptVersion: CnDetailPromptVersion,
    textMode: CnDetailTextMode = cnDetailTextMode,
    ratioMode: CnDetailRatioMode = cnDetailRatioMode,
  ): AssistantSkillData => ({
    id: "cn-detail-page",
    pluginId: "quick-skills",
    name: "中文详情页套图",
    iconName: "Store",
    config: {
      twoStep: true,
      defaults: {
        aspectRatio: "3:4",
        count: 6,
        imageSize: "2K",
        model: "nanobanana2",
        promptVersion,
        textMode,
        ratioMode,
        fixedAspectRatio: ratioMode === "fixed" ? "3:4" : "",
        qualityThreshold: 0.68,
        replacementBudget: 2,
        retryPolicy: DEFAULT_CN_DETAIL_RETRY_POLICY,
      },
    },
  });

  const readCurrentInputText = () =>
    inputBlocks
      .filter((block) => block.type === "text")
      .map((block) => block.text || "")
      .join(" ")
      .trim();

  const buildQuickSkillPrompt = (base: string) => {
    const extra = readCurrentInputText();
    if (!extra) return base;
    return `${base}\n补充要求：${extra}`;
  };

  const handleSendWithQuickSkill = (
    overridePrompt?: string,
    overrideAttachments?: File[],
    overrideWeb?: boolean,
    skillData?: ChatMessage["skillData"],
  ) => {
    const fallbackSkill =
      creationMode === "agent" ? activeQuickSkill || undefined : undefined;
    return handleSend(
      overridePrompt,
      overrideAttachments,
      overrideWeb,
      skillData || fallbackSkill,
    );
  };

  const sendPresetQuickSkill = (
    basePrompt: string,
    skillData: AssistantSkillData,
    options?: {
      persistAsActive?: boolean;
      enrichPrompt?: boolean;
    },
  ) => {
    if (skillData.pluginId) {
      recordPluginActivation(skillData.pluginId);
    }
    if (options?.persistAsActive) {
      setActiveQuickSkillSynced(skillData);
    }
    const prompt =
      options?.enrichPrompt === false
        ? basePrompt
        : buildQuickSkillPrompt(basePrompt);
    void handleSend(prompt, undefined, webEnabled, skillData);
  };

  const syncCnDetailSkill = (
    promptVersion: CnDetailPromptVersion,
    textMode: CnDetailTextMode,
    ratioMode: CnDetailRatioMode,
  ) => {
    if (activeQuickSkill?.id !== "cn-detail-page") return;
    setActiveQuickSkillSynced(
      createCnDetailSkillData(promptVersion, textMode, ratioMode),
    );
  };

  const quickSkillPluginId = "quick-skills";
  const quickSkillPluginAsset = getStudioPluginAsset(quickSkillPluginId);
  const quickSkillPluginPreference =
    getPluginPreferenceRecord(quickSkillPluginId);
  const quickSkillPluginEnabled =
    quickSkillPluginPreference?.enabled ??
    quickSkillPluginAsset?.defaultEnabled ??
    true;
  const quickSkillPluginPinned =
    quickSkillPluginPreference?.pinned ??
    quickSkillPluginAsset?.defaultPinned ??
    false;

  const quickSkillEntries: QuickSkillEntry[] = [
    {
      id: AMAZON_LISTING_SKILL.id,
      pluginId: quickSkillPluginId,
      label: AMAZON_LISTING_SKILL.name,
      iconName: AMAZON_LISTING_SKILL.iconName,
      kind: "amazon",
    },
    {
      id: "cn-detail-page",
      pluginId: quickSkillPluginId,
      label: "中文详情页套图",
      iconName: "Store",
      kind: "cn-detail",
    },
    {
      id: SOCIAL_MEDIA_SKILL.id,
      pluginId: quickSkillPluginId,
      label: SOCIAL_MEDIA_SKILL.name,
      iconName: SOCIAL_MEDIA_SKILL.iconName,
      kind: "social",
    },
    {
      id: BROCHURE_SKILL.id,
      pluginId: quickSkillPluginId,
      label: BROCHURE_SKILL.name,
      iconName: BROCHURE_SKILL.iconName,
      kind: "brochure",
    },
    {
      id: STORYBOARD_SKILL.id,
      pluginId: quickSkillPluginId,
      label: STORYBOARD_SKILL.name,
      iconName: STORYBOARD_SKILL.iconName,
      kind: "storyboard",
    },
    {
      id: CLOTHING_SKILL.id,
      pluginId: quickSkillPluginId,
      label: CLOTHING_SKILL.name,
      iconName: CLOTHING_SKILL.iconName,
      kind: "clothing",
    },
    {
      id: ECOMMERCE_ONE_CLICK_WORKFLOW_SKILL.id,
      pluginId: quickSkillPluginId,
      label: ECOMMERCE_ONE_CLICK_WORKFLOW_SKILL.name,
      iconName: ECOMMERCE_ONE_CLICK_WORKFLOW_SKILL.iconName,
      kind: "ecommerce",
    },
    {
      id: ONE_CLICK_SKILL.id,
      pluginId: quickSkillPluginId,
      label: ONE_CLICK_SKILL.name,
      iconName: ONE_CLICK_SKILL.iconName,
      kind: "oneclick",
    },
  ];

  return {
    activeQuickSkill,
    cnDetailPromptVersion,
    cnDetailTextMode,
    cnDetailRatioMode,
    handleSendWithQuickSkill,
    clearActiveQuickSkill: () => setActiveQuickSkillSynced(null),
    quickSkillsProps: {
      quickSkillPluginEnabled,
      quickSkillPluginPinned,
      quickSkillEntries,
      isCnDetailActive: activeQuickSkill?.id === "cn-detail-page",
      cnDetailPromptVersion,
      cnDetailTextMode,
      cnDetailRatioMode,
      onSendAmazonListing: () =>
        sendPresetQuickSkill(
          "请帮我设计一套亚马逊产品 Listing 图。",
          AMAZON_LISTING_SKILL,
        ),
      onSendCnDetail: () => {
        const skill = createCnDetailSkillData(
          cnDetailPromptVersion,
          cnDetailTextMode,
          cnDetailRatioMode,
        );
        setActiveQuickSkillSynced(skill);
        void handleSend(
          buildQuickSkillPrompt("请帮我设计一套国内电商中文详情页"),
          undefined,
          webEnabled,
          skill,
        );
      },
      onSelectCnDetailPromptVersion: (value: CnDetailPromptVersion) => {
        setCnDetailPromptVersion(value);
        syncCnDetailSkill(value, cnDetailTextMode, cnDetailRatioMode);
      },
      onSelectCnDetailTextMode: (value: CnDetailTextMode) => {
        setCnDetailTextMode(value);
        syncCnDetailSkill(cnDetailPromptVersion, value, cnDetailRatioMode);
      },
      onSelectCnDetailRatioMode: (value: CnDetailRatioMode) => {
        setCnDetailRatioMode(value);
        syncCnDetailSkill(cnDetailPromptVersion, cnDetailTextMode, value);
      },
      onSendSocialMedia: () =>
        sendPresetQuickSkill(
          "请帮我设计一套社交媒体视觉素材。",
          SOCIAL_MEDIA_SKILL,
        ),
      onSendBrochure: () =>
        sendPresetQuickSkill("请帮我设计一套营销宣传册。", BROCHURE_SKILL),
      onSendStoryboard: () =>
        sendPresetQuickSkill(
          "请基于参考图开始分镜故事板创作。",
          STORYBOARD_SKILL,
        ),
      onSendClothing: () =>
        sendPresetQuickSkill("请帮我进行服装棚拍组图设计。", CLOTHING_SKILL, {
          persistAsActive: true,
          enrichPrompt: false,
        }),
      onSendEcommerceOneClick: () => {
        setActiveQuickSkillSynced(ECOMMERCE_ONE_CLICK_WORKFLOW_SKILL);
        onOpenEcommerceWorkflow?.();
      },
      onSendOneClick: () =>
        sendPresetQuickSkill("执行一键全流程。", ONE_CLICK_SKILL, {
          enrichPrompt: false,
        }),
    },
  };
};
