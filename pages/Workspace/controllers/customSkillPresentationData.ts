import {
  buildCustomSkillPresentation as buildLegacyCustomSkillPresentation,
  buildDraftAwareSkillCatalogDisplay as buildLegacyDraftAwareSkillCatalogDisplay,
  listCustomSkillPresentationRecords as listLegacyCustomSkillPresentationRecords,
  resolveCustomSkillPresentationRecord as resolveLegacyCustomSkillPresentationRecord,
  type CustomSkillPresentationRecord,
  type DraftAwareSkillCatalogDisplay,
} from "../../../services/skills/legacy/custom-skill-presentation.ts";
import type { SkillGovernancePanelModel } from "./skillGovernancePanelData.ts";
import {
  formatCustomSkillStorageBadgeLabel,
  getCustomSkillStorageNotice,
  type CustomSkillStorageNotice,
  type CustomSkillStorageState,
} from "./customSkillStorageState.ts";

export {
  buildLegacyCustomSkillPresentation as buildCustomSkillPresentation,
  buildLegacyDraftAwareSkillCatalogDisplay as buildDraftAwareSkillCatalogDisplay,
  listLegacyCustomSkillPresentationRecords as listCustomSkillPresentationRecords,
  resolveLegacyCustomSkillPresentationRecord as resolveCustomSkillPresentationRecord,
  type CustomSkillPresentationRecord,
  type DraftAwareSkillCatalogDisplay,
};

export interface CustomSkillBookStatusBadge {
  label: string;
  tone: "draft" | "warning";
}

export interface CustomSkillBookStatusNotice {
  tone: "draft" | "info" | "warning";
  text: string;
}

export interface CustomSkillBookSecondaryMeta {
  sourceConversation?: string;
  lastUsedText?: string;
  examplePrompt?: string;
}

export interface CustomSkillBookPresentation {
  description: string;
  metaTokens: string[];
  secondaryMeta: CustomSkillBookSecondaryMeta | null;
  statusBadges: CustomSkillBookStatusBadge[];
  statusNotice: CustomSkillBookStatusNotice | null;
}

export interface CustomSkillStatePresentation extends CustomSkillBookPresentation {
  storageBadge: string | null;
  storageNotice: CustomSkillStorageNotice | null;
}

const normalizeText = (value: unknown): string =>
  String(value || "").replace(/\s+/g, " ").trim();

const formatRelativeCustomSkillTime = (timestamp?: number, now = Date.now()): string => {
  const value = Number(timestamp || 0);
  if (!Number.isFinite(value) || value <= 0) return "";
  const diff = now - value;
  if (diff < 60 * 1000) return "刚刚使用";
  if (diff < 60 * 60 * 1000) {
    return `${Math.max(1, Math.floor(diff / (60 * 1000)))} 分钟前`;
  }
  if (diff < 24 * 60 * 60 * 1000) {
    return `${Math.max(1, Math.floor(diff / (60 * 60 * 1000)))} 小时前`;
  }
  return `${Math.max(1, Math.floor(diff / (24 * 60 * 60 * 1000)))} 天前`;
};

const buildDraftAwareStorageNotice = (args: {
  sourceStatus: CustomSkillStorageState | null | undefined;
  governance: Pick<SkillGovernancePanelModel, "hasDraft" | "supportingText"> | null | undefined;
}): CustomSkillStorageNotice | null => {
  const { governance, sourceStatus } = args;
  if (!sourceStatus) return null;

  const baseNotice = getCustomSkillStorageNotice(sourceStatus);
  if (governance?.hasDraft !== true) {
    return baseNotice;
  }

  switch (sourceStatus) {
    case "runtime-only":
      return {
        ...baseNotice,
        body: "当前草稿不会影响线上版本，发布后会写入 Markdown Skill 文件。",
      };
    case "missing-markdown-asset":
      return {
        ...baseNotice,
        body: "当前草稿不会影响线上版本，发布后会按当前内容重建 Markdown Skill 文件。",
      };
    case "markdown-backed":
    default:
      return baseNotice;
  }
};

export const buildCustomSkillStatePresentation = (args: {
  sourceStatus: CustomSkillStorageState | null | undefined;
  governance: Pick<
    SkillGovernancePanelModel,
    "hasDraft" | "workingVersionLabel" | "supportingText"
  > | null | undefined;
  description?: string;
  metaTokens?: string[];
  secondaryMeta?: CustomSkillBookSecondaryMeta | null;
}): CustomSkillStatePresentation => {
  const { governance, sourceStatus } = args;
  const statusBadges: CustomSkillBookStatusBadge[] = [];
  const description = normalizeText(args.description);
  const metaTokens = Array.isArray(args.metaTokens) ? args.metaTokens : [];
  const secondaryMeta = args.secondaryMeta || null;

  if (governance?.hasDraft) {
    statusBadges.push({
      label: `草稿 ${governance.workingVersionLabel}`,
      tone: "draft",
    });
  }
  if (sourceStatus === "missing-markdown-asset") {
    statusBadges.push({
      label: "Markdown 资源缺失",
      tone: "warning",
    });
  }

  if (governance?.hasDraft) {
    if (sourceStatus === "missing-markdown-asset") {
      return {
        description,
        metaTokens,
        secondaryMeta,
        statusBadges,
        statusNotice: {
          tone: "warning",
          text: "原 Markdown 文件缺失；当前草稿不会影响线上版本，发布后会按当前内容重建。",
        },
        storageBadge: formatCustomSkillStorageBadgeLabel(sourceStatus),
        storageNotice: buildDraftAwareStorageNotice({
          sourceStatus,
          governance,
        }),
      };
    }
    if (sourceStatus === "runtime-only") {
      return {
        description,
        metaTokens,
        secondaryMeta,
        statusBadges,
        statusNotice: {
          tone: "info",
          text: "当前只有本地运行时配置；当前草稿不会影响线上版本，发布后会写入 Markdown Skill 文件。",
        },
        storageBadge: formatCustomSkillStorageBadgeLabel(sourceStatus),
        storageNotice: buildDraftAwareStorageNotice({
          sourceStatus,
          governance,
        }),
      };
    }
    return {
      description,
      metaTokens,
      secondaryMeta,
      statusBadges,
      statusNotice: {
        tone: "draft",
        text: governance.supportingText,
      },
      storageBadge: formatCustomSkillStorageBadgeLabel(sourceStatus),
      storageNotice: buildDraftAwareStorageNotice({
        sourceStatus,
        governance,
      }),
    };
  }

  if (sourceStatus === "missing-markdown-asset") {
    return {
      description,
      metaTokens,
      secondaryMeta,
      statusBadges,
      statusNotice: {
        tone: "warning",
        text: "原 Markdown 文件缺失；继续编辑后，发布会按当前内容重建 Markdown Skill 文件。",
      },
      storageBadge: formatCustomSkillStorageBadgeLabel(sourceStatus),
      storageNotice: buildDraftAwareStorageNotice({
        sourceStatus,
        governance,
      }),
    };
  }

  if (sourceStatus === "runtime-only") {
    return {
      description,
      metaTokens,
      secondaryMeta,
      statusBadges,
      statusNotice: {
        tone: "info",
        text: "当前只有本地运行时配置；发布后才会写入 Markdown Skill 文件。",
      },
      storageBadge: formatCustomSkillStorageBadgeLabel(sourceStatus),
      storageNotice: buildDraftAwareStorageNotice({
        sourceStatus,
        governance,
      }),
    };
  }

  return {
    description,
    metaTokens,
    secondaryMeta,
    statusBadges,
    statusNotice: null,
    storageBadge: formatCustomSkillStorageBadgeLabel(sourceStatus),
    storageNotice: buildDraftAwareStorageNotice({
      sourceStatus,
      governance,
    }),
  };
};

export const buildCustomSkillBookPresentation = (
  record: CustomSkillPresentationRecord,
  options?: {
    now?: number;
  },
): CustomSkillBookPresentation => {
  const config = record.editableConfig || record.config;
  const summary = normalizeText(
    config.summary || config.description || record.config.summary || record.config.description,
  );
  const examplePrompt = normalizeText(
    config.examplePrompt || config.sourceUserPrompt || record.config.examplePrompt || record.config.sourceUserPrompt,
  );
  const description =
    summary || examplePrompt || "基于最近一次成功对话沉淀出的可复用 Skill。";

  const metaTokens: string[] = ["My Skill"];
  if (record.sourceStatus === "runtime-only") metaTokens.push("仅运行时");
  if (record.sourceStatus === "missing-markdown-asset") metaTokens.push("源文件缺失");

  const requiresAttachments = Boolean(
    (config as Record<string, unknown>).requiresAttachments ||
      (record.config as Record<string, unknown>).requiresAttachments,
  );
  const followUpMode = normalizeText(config.followUpMode || record.config.followUpMode);
  if (requiresAttachments) metaTokens.push("需参考图");
  if (followUpMode === "direct-run") {
    metaTokens.push("直接执行");
  }
  if (!requiresAttachments && followUpMode === "auto-clarify") {
    metaTokens.push("会先补问");
  }

  const sourceConversation = normalizeText(
    config.sourceConversationTitle || record.config.sourceConversationTitle,
  );
  const lastUsedText = formatRelativeCustomSkillTime(
    Number(config.lastUsedAt || record.config.lastUsedAt || 0),
    options?.now,
  );
  const secondaryMeta: CustomSkillBookSecondaryMeta | null =
    sourceConversation || lastUsedText || (!sourceConversation && examplePrompt)
      ? {
          ...(sourceConversation ? { sourceConversation } : {}),
          ...(lastUsedText ? { lastUsedText } : {}),
          ...(!sourceConversation && examplePrompt ? { examplePrompt } : {}),
        }
      : null;

  const presentation = buildCustomSkillStatePresentation({
    sourceStatus: record.sourceStatus,
    governance: record.governance,
    description,
    metaTokens: metaTokens.slice(0, 2),
    secondaryMeta,
  });
  return {
    description: presentation.description,
    metaTokens: presentation.metaTokens,
    secondaryMeta: presentation.secondaryMeta,
    statusBadges: presentation.statusBadges,
    statusNotice: presentation.statusNotice,
  };
};
