import type { ChatMessage } from "../../../types/index.ts";
import {
  listFrontstageSkillPresets,
  type FrontstageSkillPreset,
} from "../../../services/runtime-assets/frontstage-skill-presets.ts";
import type {
  CustomSkillConfigRecord,
  CustomSkillMarkdownAsset,
} from "../../../services/runtime-assets/custom-skill-markdown.ts";
import {
  listCustomSkillPresentationRecords,
  buildCustomSkillBookPresentation,
  type CustomSkillBookPresentation,
} from "./customSkillPresentationData.ts";

export type SkillBookViewTab = "video" | "social" | "commerce" | "branding";

export interface SkillBookTabDefinition {
  id: SkillBookViewTab;
  label: string;
}

export interface SkillBookHeaderViewModel {
  title: string;
  subtitle: string;
  showClearAction: boolean;
  clearActionLabel: string;
}

export interface SkillBookTriggerViewModel {
  title: string;
  ariaLabel: string;
  highlighted: boolean;
  showActiveIndicator: boolean;
}

export interface SkillBookCreateSkillCtaViewModel {
  visible: boolean;
  enabled: boolean;
  title: string;
  description: string;
  metaBadgeLabel?: string;
}

export interface SkillBookCardActionViewModel {
  id: "audit" | "edit";
  label: string;
  title: string;
  ariaLabel: string;
}

export interface SkillBookCardSecondaryMetaItemViewModel {
  id: "source-conversation" | "last-used" | "example-prompt";
  text: string;
  truncate: boolean;
}

export interface SkillBookCardViewModel {
  id: string;
  name: string;
  description: string;
  activationHint: string;
  category: FrontstageSkillPreset["category"];
  tab: FrontstageSkillPreset["tab"];
  frontstagePriority: FrontstageSkillPreset["frontstagePriority"];
  executionType: FrontstageSkillPreset["executionType"];
  followUpMode?: FrontstageSkillPreset["followUpMode"];
  requiresAttachments?: boolean;
  iconName: string;
  order: number;
  skillData: NonNullable<ChatMessage["skillData"]>;
  isCustomSkill: boolean;
  isActive: boolean;
  showEditAction: boolean;
  showAuditAction: boolean;
  showSecondaryMeta: boolean;
  showStatusNotice: boolean;
  actionDisplay: "group" | "single" | "none";
  actions: SkillBookCardActionViewModel[];
  secondaryMetaItems: SkillBookCardSecondaryMetaItemViewModel[];
  descriptionTone: "default" | "custom" | "warning";
  metaTokenTone: "default" | "custom";
  customSkillSourceStatus?: "markdown-backed" | "runtime-only" | "missing-markdown-asset";
  metaTokens: string[];
  secondaryMeta?: CustomSkillBookPresentation["secondaryMeta"];
  statusBadges?: CustomSkillBookPresentation["statusBadges"];
  statusNotice?: CustomSkillBookPresentation["statusNotice"];
}

export const SKILL_BOOK_TAB_DEFINITIONS: SkillBookTabDefinition[] = [
  { id: "video", label: "Video" },
  { id: "social", label: "Social Media" },
  { id: "commerce", label: "E-Commerce" },
  { id: "branding", label: "Branding" },
];

const normalizeText = (value: unknown): string =>
  String(value || "").replace(/\s+/g, " ").trim();

const getSkillCategoryTabFromRouteIntent = (value: unknown): SkillBookViewTab => {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    normalized === "video" ||
    normalized === "social" ||
    normalized === "commerce" ||
    normalized === "branding"
  ) {
    return normalized;
  }
  return "branding";
};

const buildFrontstageMetaTokens = (preset: FrontstageSkillPreset): string[] => {
  const metaTokens: string[] = [];
  if (preset.requiresAttachments) metaTokens.push("需参考图");
  if (preset.followUpMode === "direct-run") metaTokens.push("直接执行");
  if (!preset.requiresAttachments && preset.followUpMode === "auto-clarify") {
    metaTokens.push("会先补问");
  }
  if (metaTokens.length === 0) {
    metaTokens.push(
      preset.executionType === "workflow"
        ? "Workflow"
        : preset.executionType === "agent"
          ? "Skill"
          : "Skill",
    );
  }
  return metaTokens.slice(0, 2);
};

const buildSkillBookCardActions = (args: {
  showEditAction: boolean;
  showAuditAction: boolean;
}): {
  actionDisplay: SkillBookCardViewModel["actionDisplay"];
  actions: SkillBookCardActionViewModel[];
} => {
  const actions: SkillBookCardActionViewModel[] = [];
  if (args.showAuditAction) {
    actions.push({
      id: "audit",
      label: "审计",
      title: "查看版本与审计",
      ariaLabel: "查看版本与审计",
    });
  }
  if (args.showEditAction) {
    actions.push({
      id: "edit",
      label: "编辑",
      title: "编辑 Skill",
      ariaLabel: "编辑 Skill",
    });
  }

  return {
    actionDisplay:
      actions.length === 0 ? "none" : actions.length === 1 ? "single" : "group",
    actions,
  };
};

const buildSkillBookSecondaryMetaItems = (
  secondaryMeta?: CustomSkillBookPresentation["secondaryMeta"],
): SkillBookCardSecondaryMetaItemViewModel[] => {
  if (!secondaryMeta) return [];

  const items: SkillBookCardSecondaryMetaItemViewModel[] = [];
  if (secondaryMeta.sourceConversation) {
    items.push({
      id: "source-conversation",
      text: `来源：${secondaryMeta.sourceConversation}`,
      truncate: true,
    });
  }
  if (secondaryMeta.lastUsedText) {
    items.push({
      id: "last-used",
      text: secondaryMeta.lastUsedText,
      truncate: false,
    });
  }
  if (!secondaryMeta.sourceConversation && secondaryMeta.examplePrompt) {
    items.push({
      id: "example-prompt",
      text: `示例：${secondaryMeta.examplePrompt}`,
      truncate: true,
    });
  }
  return items;
};

const toFrontstageSkillBookCard = (preset: FrontstageSkillPreset): SkillBookCardViewModel => {
  const showEditAction = false;
  const showAuditAction = true;
  const cardActions = buildSkillBookCardActions({
    showEditAction,
    showAuditAction,
  });

  return {
    id: preset.id,
    name: preset.name,
    description: preset.description,
    activationHint: preset.activationHint,
    category: preset.category,
    tab: preset.tab,
    frontstagePriority: preset.frontstagePriority,
    executionType: preset.executionType,
    ...(preset.followUpMode ? { followUpMode: preset.followUpMode } : {}),
    ...(preset.requiresAttachments ? { requiresAttachments: true } : {}),
    iconName: preset.iconName,
    order: preset.order,
    skillData: preset.skillData,
    isCustomSkill: false,
    isActive: false,
    showEditAction,
    showAuditAction,
    showSecondaryMeta: false,
    showStatusNotice: false,
    actionDisplay: cardActions.actionDisplay,
    actions: cardActions.actions,
    secondaryMetaItems: [],
    descriptionTone: "default",
    metaTokenTone: "default",
    metaTokens: buildFrontstageMetaTokens(preset),
  };
};

const toCustomSkillBookCard = (args: {
  record: ReturnType<typeof listCustomSkillPresentationRecords>[number];
}): SkillBookCardViewModel | null => {
  const { record } = args;
  const config = record.editableConfig;
  const name = normalizeText(config?.name || record.config?.name || record.asset?.name);
  const iconName = normalizeText(
    config?.iconName || record.config?.iconName || record.asset?.iconName || "Sparkles",
  );
  if (!name) return null;

  const presentation = buildCustomSkillBookPresentation(record);
  const showSecondaryMeta = Boolean(presentation.secondaryMeta);
  const showStatusNotice = Boolean(presentation.statusNotice);
  const isMissingMarkdownAsset = record.sourceStatus === "missing-markdown-asset";
  const showEditAction = true;
  const showAuditAction = true;
  const cardActions = buildSkillBookCardActions({
    showEditAction,
    showAuditAction,
  });
  const secondaryMetaItems = buildSkillBookSecondaryMetaItems(presentation.secondaryMeta);
  return {
    id: record.id,
    name,
    description: presentation.description,
    activationHint: normalizeText(config.activationHint) || "复用这次对话里沉淀下来的执行方式。",
    category: "workflow",
    tab: getSkillCategoryTabFromRouteIntent(config.routeIntent),
    frontstagePriority: "primary",
    executionType: "skill",
    followUpMode:
      config.followUpMode === "auto-clarify" ? "auto-clarify" : "direct-run",
    iconName,
    order: 0,
    skillData: {
      id: record.id,
      name,
      iconName,
      config: {
        ...config,
        isCustomSkill: true,
      } as CustomSkillConfigRecord,
    },
    isCustomSkill: true,
    isActive: false,
    showEditAction,
    showAuditAction,
    showSecondaryMeta,
    showStatusNotice,
    actionDisplay: cardActions.actionDisplay,
    actions: cardActions.actions,
    secondaryMetaItems,
    descriptionTone: isMissingMarkdownAsset ? "warning" : "custom",
    metaTokenTone: "custom",
    customSkillSourceStatus: record.sourceStatus,
    metaTokens: presentation.metaTokens,
    ...(presentation.secondaryMeta ? { secondaryMeta: presentation.secondaryMeta } : {}),
    ...(presentation.statusBadges.length > 0
      ? { statusBadges: presentation.statusBadges }
      : {}),
    ...(presentation.statusNotice ? { statusNotice: presentation.statusNotice } : {}),
  };
};

export const listFrontstageSkillBookCardModels = (): SkillBookCardViewModel[] =>
  listFrontstageSkillPresets().map(toFrontstageSkillBookCard);

export const listCustomSkillBookCardModels = (args: {
  assets: CustomSkillMarkdownAsset[];
  runtimeCustomConfigs?: Record<string, Record<string, unknown>> | null;
}): SkillBookCardViewModel[] =>
  listCustomSkillPresentationRecords(args)
    .map((record) => toCustomSkillBookCard({ record }))
    .filter((record): record is SkillBookCardViewModel => Boolean(record))
    .sort((left, right) => {
      const leftConfig = left.skillData.config as CustomSkillConfigRecord | undefined;
      const rightConfig = right.skillData.config as CustomSkillConfigRecord | undefined;
      const leftScore = Number(leftConfig?.lastUsedAt || leftConfig?.updatedAt || 0);
      const rightScore = Number(rightConfig?.lastUsedAt || rightConfig?.updatedAt || 0);
      return rightScore - leftScore;
    });

const withActiveSkillState = (
  card: SkillBookCardViewModel,
  activeQuickSkillId?: string | null,
): SkillBookCardViewModel => ({
  ...card,
  isActive: normalizeText(activeQuickSkillId) === card.id,
});

export const listSkillBookCardModels = (args: {
  assets: CustomSkillMarkdownAsset[];
  runtimeCustomConfigs?: Record<string, Record<string, unknown>> | null;
  skillCategoryTab: SkillBookViewTab;
  activeQuickSkillId?: string | null;
  modelMode?: "thinking" | "fast";
  canCreateFromConversation?: boolean;
}): {
  trigger: SkillBookTriggerViewModel;
  header: SkillBookHeaderViewModel;
  createSkillCta: SkillBookCreateSkillCtaViewModel;
  tabs: SkillBookTabDefinition[];
  activeTab: SkillBookViewTab;
  customSkillCards: SkillBookCardViewModel[];
  frontstageSkillCards: SkillBookCardViewModel[];
  blendedSkillCards: SkillBookCardViewModel[];
} => {
  const normalizedActiveQuickSkillId = normalizeText(args.activeQuickSkillId);
  const customSkillCards = listCustomSkillBookCardModels(args).map((card) =>
    withActiveSkillState(card, normalizedActiveQuickSkillId),
  );
  const allFrontstageCards = listFrontstageSkillBookCardModels();
  const inCategory = allFrontstageCards.filter((skill) => skill.tab === args.skillCategoryTab);
  const frontstageSkillCards = (inCategory.length > 0 ? inCategory : allFrontstageCards).map(
    (card) => withActiveSkillState(card, normalizedActiveQuickSkillId),
  );
  const hasActiveQuickSkill = normalizedActiveQuickSkillId.length > 0;

  return {
    trigger: {
      title: hasActiveQuickSkill ? "Skill：已选择" : "Skill",
      ariaLabel: "Skill",
      highlighted: hasActiveQuickSkill,
      showActiveIndicator: hasActiveQuickSkill,
    },
    header: {
      title: "Skill",
      subtitle: "选择一套前台执行方式，而不是普通聊天模式。",
      showClearAction: hasActiveQuickSkill,
      clearActionLabel: "清除",
    },
    createSkillCta: {
      visible: args.canCreateFromConversation === true,
      enabled: args.modelMode === "thinking",
      title: "基于此对话创建 Skill",
      description:
        args.modelMode === "thinking"
          ? "在 Thinking 模式下将对话总结为可复用 Skill。"
          : "切到 Thinking 模式后才能创建 Skill。",
      ...(args.modelMode === "thinking" ? {} : { metaBadgeLabel: "需 Thinking" }),
    },
    tabs: SKILL_BOOK_TAB_DEFINITIONS,
    activeTab: args.skillCategoryTab,
    customSkillCards,
    frontstageSkillCards,
    blendedSkillCards: [...customSkillCards, ...frontstageSkillCards],
  };
};
