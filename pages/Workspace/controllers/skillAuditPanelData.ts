import type { ChatMessage } from "../../../types/index.ts";
import type {
  CustomSkillConfigRecord,
  CustomSkillMarkdownAsset,
} from "../../../services/runtime-assets/custom-skill-markdown.ts";
import {
  getFrontstageSkillId,
  getFrontstageSkillLabelKind,
  isUnifiedSidebarAgentSkill,
} from "../../../services/runtime-assets/skill-identity.ts";
import type { StudioSkillPreferencesAsset } from "../../../services/runtime-assets/user-asset-types.ts";
import type {
  LegacySkillCatalogEntry,
  SkillDefinition,
  SkillPreset,
  SkillVersion,
} from "../../../services/skills/catalog/skill-object-types.ts";
import { listLegacySkillCatalogEntries } from "../../../services/skills/legacy/legacy-skill-catalog.ts";
import type { SkillAuditRecord } from "../../../services/skills/governance/skill-governance.ts";
import {
  listSkillAuditTimeline,
  summarizeSkillAuditTimeline,
  type SkillAuditSummary,
  type SkillAuditTimelineEntry,
} from "../../../services/skills/views/skill-audit-view.ts";
import {
  buildSkillGovernanceAuditRecords,
  type SkillGovernancePanelModel,
} from "./skillGovernancePanelData.ts";
import {
  buildCustomSkillStatePresentation,
  buildDraftAwareSkillCatalogDisplay,
} from "./customSkillPresentationData.ts";
import {
  formatCustomSkillStorageLabel,
  type CustomSkillStorageNotice,
} from "./customSkillStorageState.ts";

type RuntimeSkillConfig = Record<string, unknown>;

export interface SkillAuditPanelMetric {
  label: string;
  value: string;
}

export interface SkillAuditPanelModel {
  skillId: string;
  iconName: string;
  title: string;
  kindLabel: string;
  summary: string;
  description?: string;
  sourceLabel: string;
  releaseLabel: string;
  reviewLabel: string;
  versionLabel: string;
  detailItems: SkillAuditPanelMetric[];
  capabilityTags: string[];
  performanceItems: SkillAuditPanelMetric[];
  examplePrompt?: string;
  instruction?: string;
  isCustomSkill: boolean;
  customSkillSourceStatus?: "markdown-backed" | "runtime-only" | "missing-markdown-asset";
  customSkillStorageBadge?: string | null;
  customSkillStorageNotice?: CustomSkillStorageNotice;
  definition: SkillDefinition;
  version: SkillVersion;
  preset: SkillPreset | null;
  auditSummary: SkillAuditSummary;
  timeline: SkillAuditTimelineEntry[];
  governance: SkillGovernancePanelModel | null;
}

export interface BuildSkillAuditPanelModelArgs {
  skillId: string;
  customSkillMarkdownAssets?: CustomSkillMarkdownAsset[];
  skillPreferences: StudioSkillPreferencesAsset;
  recentMessages?: ChatMessage[];
  now?: number;
}

const EVENT_COUNT_LIMIT = 16;

const normalizeText = (value: unknown): string =>
  String(value || "").replace(/\s+/g, " ").trim();

const normalizeTextList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean)
    : [];

const clipText = (value: unknown, maxChars: number): string => {
  const normalized = normalizeText(value);
  return normalized.length > maxChars
    ? `${normalized.slice(0, Math.max(0, maxChars - 1)).trim()}...`
    : normalized;
};

const readRuntimeConfig = (
  args: Pick<BuildSkillAuditPanelModelArgs, "skillPreferences"> & {
    entry: LegacySkillCatalogEntry;
    skillId: string;
  },
): RuntimeSkillConfig => {
  const { entry, skillId, skillPreferences } = args;
  if (entry.legacyMetadata.source === "custom-skill") {
    const mergedConfig =
      entry.legacyMetadata.skillData.config &&
      typeof entry.legacyMetadata.skillData.config === "object"
        ? (entry.legacyMetadata.skillData.config as RuntimeSkillConfig)
        : {};
    const runtimeConfig = skillPreferences.customSkillConfigs?.[skillId] || {};
    return {
      ...mergedConfig,
      ...runtimeConfig,
    };
  }
  return skillPreferences.frontstageSkillRuntimeConfigs?.[skillId] || {};
};

const matchesSkillId = (
  entry: LegacySkillCatalogEntry,
  skillId: string,
): boolean => {
  const normalizedSkillId = normalizeText(skillId);
  if (!normalizedSkillId) return false;

  if (entry.legacyMetadata.source === "custom-skill") {
    return (
      normalizeText(entry.legacyMetadata.customSkill?.id) === normalizedSkillId ||
      normalizeText(entry.legacyMetadata.skillData.id) === normalizedSkillId
    );
  }

  return (
    normalizeText(entry.legacyMetadata.frontstagePreset?.id) === normalizedSkillId ||
    normalizeText(getFrontstageSkillId(entry.legacyMetadata.skillData)) ===
      normalizedSkillId ||
    normalizeText(entry.legacyMetadata.skillData.id) === normalizedSkillId
  );
};

const resolveCatalogEntry = (
  args: Pick<
    BuildSkillAuditPanelModelArgs,
    "customSkillMarkdownAssets" | "skillId" | "skillPreferences"
  >,
): LegacySkillCatalogEntry | null =>
  listLegacySkillCatalogEntries({
    customSkillMarkdownAssets: args.customSkillMarkdownAssets || [],
    runtimeCustomConfigs: args.skillPreferences.customSkillConfigs || {},
  }).find((entry) => matchesSkillId(entry, args.skillId)) || null;

const formatSourceLabel = (definition: SkillDefinition): string => {
  switch (definition.sourceType) {
    case "builtin":
      return "内置 Skill";
    case "distilled":
      return "对话蒸馏";
    case "plugin":
      return "插件 Skill";
    case "imported":
    default:
      return definition.ownerType === "workspace" ? "工作区 Skill" : "已导入 Skill";
  }
};

const formatReleaseLabel = (version: SkillVersion): string => {
  switch (version.releaseStatus) {
    case "published":
      return "已发布";
    case "deprecated":
      return "已下线";
    case "rolled_back":
      return "已回滚";
    case "draft":
    default:
      return "草稿";
  }
};

const formatReviewLabel = (version: SkillVersion): string => {
  switch (version.reviewStatus) {
    case "approved":
      return "已批准";
    case "reviewing":
      return "审核中";
    case "rejected":
      return "已驳回";
    case "draft":
    default:
      return "待审核";
  }
};

const formatExecutorLabel = (version: SkillVersion): string => {
  switch (version.manifest.execution.executorType) {
    case "workflow-recipe":
      return "工作流";
    case "agent-plan":
      return "Agent 计划";
    case "skill-call":
    default:
      return "Skill 调用";
  }
};

const formatRoutingLabel = (version: SkillVersion): string => {
  switch (version.manifest.routing.mode) {
    case "autonomous":
      return "自动路由";
    case "hybrid":
      return "混合路由";
    case "manual":
    default:
      return "手动选择";
  }
};

const formatFollowUpLabel = (version: SkillVersion): string => {
  switch (version.manifest.routing.followUpMode) {
    case "auto-clarify":
      return "先补问";
    case "direct-run":
      return "直接执行";
    default:
      return "按当前模式";
  }
};

const formatKindLabel = (entry: LegacySkillCatalogEntry): string => {
  switch (getFrontstageSkillLabelKind(entry.legacyMetadata.skillData)) {
    case "workflow":
      return "Workflow";
    case "my-skill":
      return "My Skill";
    case "skill":
    default:
      return isUnifiedSidebarAgentSkill(entry.legacyMetadata.skillData)
        ? "Agent Skill"
        : "Skill";
  }
};

const buildCapabilityTags = (
  entry: LegacySkillCatalogEntry,
  runtimeConfig: RuntimeSkillConfig,
  version: SkillVersion = entry.version,
): string[] => {
  const tags = new Set<string>();

  if (entry.legacyMetadata.source === "custom-skill") {
    tags.add("可复用");
  }
  if (version.manifest.ui.requiresAttachments) {
    tags.add("需要附件");
  }
  if (version.manifest.routing.followUpMode === "auto-clarify") {
    tags.add("会先补问");
  }
  if (version.manifest.routing.followUpMode === "direct-run") {
    tags.add("直接执行");
  }
  if (version.manifest.routing.mode === "autonomous") {
    tags.add("自动路由");
  }
  if (version.manifest.permissions.needsWorkspaceSearch) {
    tags.add("工作区检索");
  }
  if (version.manifest.permissions.needsWeb) {
    tags.add("网络访问");
  }
  if (version.manifest.execution.recipe?.length) {
    tags.add(`${version.manifest.execution.recipe.length} 个配方步骤`);
  }
  if (version.manifest.routing.clarifyChecklist?.length) {
    tags.add(`${version.manifest.routing.clarifyChecklist.length} 个补问字段`);
  }
  if (version.manifest.execution.preferredSkills?.length) {
    tags.add(`${version.manifest.execution.preferredSkills.length} 个优先技能`);
  }
  if (Number(runtimeConfig.successfulRuns || 0) > 0) {
    tags.add(`成功 ${Number(runtimeConfig.successfulRuns || 0)} 次`);
  }

  return [...tags].slice(0, 6);
};

const createAuditRecord = (args: {
  id: string;
  eventType: SkillAuditRecord["eventType"];
  actor: string;
  targetId: string;
  targetType: SkillAuditRecord["targetType"];
  timestamp: number;
  reason: string;
  metadata?: Record<string, unknown>;
}): SkillAuditRecord => ({
  id: args.id,
  eventType: args.eventType,
  actor: args.actor,
  actorRoles: [],
  targetId: args.targetId,
  targetType: args.targetType,
  timestamp: args.timestamp,
  reason: args.reason,
  workspaceId: "workspace",
  metadata: args.metadata,
});

const findResponseMessage = (
  messages: ChatMessage[],
  startIndex: number,
  userMessageId: string,
): ChatMessage | null => {
  for (let index = startIndex + 1; index < messages.length; index += 1) {
    const candidate = messages[index];
    if (candidate.role === "user") return null;
    if (candidate.role !== "model") continue;
    if (
      normalizeText(candidate.responseToMessageId) === normalizeText(userMessageId) ||
      !candidate.responseToMessageId
    ) {
      return candidate;
    }
  }
  return null;
};

const buildTimelineRecords = (
  args: BuildSkillAuditPanelModelArgs & {
    entry: LegacySkillCatalogEntry;
    runtimeConfig: RuntimeSkillConfig;
    definition?: SkillDefinition;
    version?: SkillVersion;
    preset?: SkillPreset | null;
  },
): SkillAuditRecord[] => {
  const { entry, runtimeConfig, recentMessages = [] } = args;
  const definition = args.definition || entry.definition;
  const version = args.version || entry.version;
  const preset = args.preset ?? entry.preset;
  const skillId = normalizeText(args.skillId);
  const records: SkillAuditRecord[] = [];

  records.push(
    createAuditRecord({
      id: `${definition.id}-created`,
      eventType: "skill.definition.created",
      actor: definition.ownerId || "system",
      targetId: definition.id,
      targetType: "skill-definition",
      timestamp: Number(definition.createdAt || 0),
      reason:
        definition.sourceType === "builtin"
          ? "Inherited the current builtin preset baseline."
          : "Created the current skill definition.",
      metadata: {
        key: definition.key,
        sourceType: definition.sourceType,
      },
    }),
  );

  records.push(
    createAuditRecord({
      id: `${version.id}-created`,
      eventType: "skill.version.created",
      actor: version.createdBy || definition.ownerId || "workspace",
      targetId: version.id,
      targetType: "skill-version",
      timestamp: Number(version.createdAt || 0),
      reason:
        version.createdAt > 0
          ? "Created the current executable version."
          : "Preserved the legacy mapped version as the current baseline.",
      metadata: {
        semver: version.semver,
        executorType: version.manifest.execution.executorType,
      },
    }),
  );

  if (version.publishedAt !== undefined || version.releaseStatus === "published") {
    records.push(
      createAuditRecord({
        id: `${version.id}-published`,
        eventType: "skill.version.published",
        actor: version.publishedBy || definition.ownerId || "system",
        targetId: version.id,
        targetType: "skill-version",
        timestamp: Number(version.publishedAt || 0),
        reason:
          version.releaseStatus === "published"
            ? "The current version is active as the published release."
            : "The current version previously entered the publish flow.",
        metadata: {
          semver: version.semver,
          presetId: preset?.id,
        },
      }),
    );
  }

  const versionUpdatedAt =
    entry.legacyMetadata.source === "custom-skill"
      ? Number(runtimeConfig.markdownAssetUpdatedAt || definition.updatedAt || 0)
      : Number(runtimeConfig.updatedAt || 0);
  if (versionUpdatedAt > Number(version.createdAt || 0)) {
    records.push(
      createAuditRecord({
        id: `${version.id}-updated`,
        eventType: "skill.version.updated",
        actor: entry.legacyMetadata.source === "custom-skill" ? "workspace" : "runtime",
        targetId: version.id,
        targetType: "skill-version",
        timestamp: versionUpdatedAt,
        reason:
          entry.legacyMetadata.source === "custom-skill"
            ? "Updated the current skill summary, instruction, or execution settings."
            : "Refreshed the current runtime configuration for this skill.",
        metadata: {
          source:
            entry.legacyMetadata.source === "custom-skill"
              ? "markdown-asset"
              : "runtime-preference",
        },
      }),
    );
  }

  const successfulRuns = Number(runtimeConfig.successfulRuns || 0);
  const lastSuccessfulAt = Number(runtimeConfig.lastSuccessfulAt || 0);
  if (successfulRuns > 0 || lastSuccessfulAt > 0) {
    records.push(
      createAuditRecord({
        id: `${definition.id}-last-success`,
        eventType: "skill.run.started",
        actor: "workspace",
        targetId: definition.id,
        targetType: "skill-run",
        timestamp: lastSuccessfulAt,
        reason:
          successfulRuns > 0
            ? `Recorded ${successfulRuns} successful runs up to the latest success.`
            : "Recorded the latest successful run.",
        metadata: {
          successfulRuns,
          prompt: clipText(
            runtimeConfig.lastSuccessfulPrompt || runtimeConfig.examplePrompt,
            120,
          ),
        },
      }),
    );
  }

  recentMessages.forEach((message, index) => {
    if (message.role !== "user" || !message.skillData) return;
    if (normalizeText(getFrontstageSkillId(message.skillData)) !== skillId) return;

    records.push(
      createAuditRecord({
        id: `${message.id}-started`,
        eventType: "skill.run.started",
        actor: "user",
      targetId: definition.id,
      targetType: "skill-run",
      timestamp: Number(message.timestamp || 0),
      reason: "Triggered a skill run explicitly in the current conversation.",
        metadata: {
          prompt: clipText(message.text, 120),
        },
      }),
    );

    const response = findResponseMessage(recentMessages, index, message.id);
    if (!response) return;
    const responseError =
      normalizeText(response.agentData?.executionTrace?.errorMessage) ||
      normalizeText(response.text && response.error ? response.text : "");
    const failed =
      response.error === true ||
      response.agentData?.executionTrace?.status === "failed" ||
      Boolean(responseError);

    if (!failed) return;
    records.push(
      createAuditRecord({
        id: `${response.id}-failed`,
        eventType: "skill.run.failed",
        actor: "runtime",
        targetId: definition.id,
        targetType: "skill-run",
        timestamp: Number(response.timestamp || 0),
        reason: "This run returned a failure or error state in the current conversation.",
        metadata: {
          error: clipText(responseError || response.text, 160),
        },
      }),
    );
  });

  return records
    .filter((record) => record.reason)
    .sort((left, right) => {
      if (right.timestamp !== left.timestamp) {
        return right.timestamp - left.timestamp;
      }
      return left.id.localeCompare(right.id);
    })
    .slice(0, EVENT_COUNT_LIMIT);
};

const buildPerformanceItems = (
  entry: LegacySkillCatalogEntry,
  runtimeConfig: RuntimeSkillConfig,
): SkillAuditPanelMetric[] => {
  const items: SkillAuditPanelMetric[] = [];
  const successfulRuns = Number(runtimeConfig.successfulRuns || 0);
  const lastUsedAt = Number(
    runtimeConfig.lastUsedAt || entry.legacyMetadata.customSkill?.lastUsedAt || 0,
  );
  const lastSuccessfulAt = Number(runtimeConfig.lastSuccessfulAt || 0);
  const examplePrompt = clipText(
    runtimeConfig.examplePrompt ||
      runtimeConfig.sourceUserPrompt ||
      runtimeConfig.lastSuccessfulPrompt,
    80,
  );

  if (successfulRuns > 0) {
    items.push({
      label: "成功次数",
      value: String(successfulRuns),
    });
  }
  if (lastUsedAt > 0) {
    items.push({
      label: "最近使用",
      value: String(lastUsedAt),
    });
  }
  if (lastSuccessfulAt > 0) {
    items.push({
      label: "最近成功",
      value: String(lastSuccessfulAt),
    });
  }
  if (examplePrompt) {
    items.push({
      label: "示例提示",
      value: examplePrompt,
    });
  }

  return items.slice(0, 4);
};

export const buildSkillAuditPanelModel = (
  args: BuildSkillAuditPanelModelArgs,
): SkillAuditPanelModel | null => {
  const skillId = normalizeText(args.skillId);
  if (!skillId) return null;

  const entry = resolveCatalogEntry({
    skillId,
    customSkillMarkdownAssets: args.customSkillMarkdownAssets,
    skillPreferences: args.skillPreferences,
  });
  if (!entry) return null;

  const runtimeConfig = readRuntimeConfig({
    entry,
    skillId,
    skillPreferences: args.skillPreferences,
  });
  const displayEntry = buildDraftAwareSkillCatalogDisplay({
    entry,
    skillId,
    runtimeConfig,
  });
  const displayDefinition = displayEntry.definition;
  const displayVersion = displayEntry.version;
  const displayPreset = displayEntry.preset;
  const displayRuntimeConfig = displayEntry.runtimeConfig;
  const displayGovernance = displayEntry.governance;
  const preset = displayPreset || entry.preset || null;
  const governanceTimelineRecords =
    entry.legacyMetadata.source === "custom-skill"
      ? buildSkillGovernanceAuditRecords({
          skillId,
          config: runtimeConfig as CustomSkillConfigRecord,
          fallbackVersionId: entry.version.id,
          fallbackSemver: entry.version.semver,
          fallbackCreatedAt: entry.version.createdAt,
          fallbackUpdatedAt:
            entry.version.publishedAt || entry.version.createdAt || entry.definition.updatedAt,
        })
      : [];
  const shouldUseDisplayVersionAsTimelineBase =
    entry.legacyMetadata.source === "custom-skill" &&
    Boolean(displayGovernance?.hasDraft) &&
    governanceTimelineRecords.length === 0;
  const timelineRecords = buildTimelineRecords({
    ...args,
    entry,
    runtimeConfig: displayRuntimeConfig,
    ...(shouldUseDisplayVersionAsTimelineBase
      ? {
          definition: displayDefinition,
          version: displayVersion,
          preset: displayPreset,
        }
      : {}),
  });
  const mergedTimelineRecords = [...timelineRecords, ...governanceTimelineRecords]
    .sort((left, right) => {
      if (right.timestamp !== left.timestamp) {
        return right.timestamp - left.timestamp;
      }
      return left.id.localeCompare(right.id);
    })
    .slice(0, EVENT_COUNT_LIMIT);

  const timeline = listSkillAuditTimeline({
    source: mergedTimelineRecords,
  }).map((item) => ({
    ...item,
    metadataSummary: item.metadataSummary.slice(0, 3),
  }));
  const auditSummary = summarizeSkillAuditTimeline({
    source: mergedTimelineRecords,
  });
  const displayExamplePrompt = clipText(
    displayRuntimeConfig.examplePrompt ||
      displayRuntimeConfig.sourceUserPrompt ||
      displayRuntimeConfig.lastSuccessfulPrompt ||
      entry.exampleSet?.examples?.[0]?.prompt,
    240,
  );
  const displayInstruction = clipText(
    displayRuntimeConfig.instruction ||
      displayRuntimeConfig.customInstruction ||
      displayVersion.manifest.ui.instruction,
    400,
  );
  const displaySummary =
    displayDefinition.summary || entry.definition.summary || "当前 Skill 暂无摘要。";
  const customSkillSourceStatus = entry.legacyMetadata.customSkill?.sourceStatus;
  const customSkillStatePresentation = customSkillSourceStatus
    ? buildCustomSkillStatePresentation({
        sourceStatus: customSkillSourceStatus,
        governance: displayGovernance,
      })
    : null;

  return {
    skillId,
    iconName:
      displayPreset?.iconName ||
      displayVersion.manifest.ui.iconName ||
      entry.legacyMetadata.skillData.iconName,
    title: displayDefinition.name,
    kindLabel: formatKindLabel(entry),
    summary: displaySummary,
    description: displayDefinition.description,
    sourceLabel: formatSourceLabel(displayDefinition),
    releaseLabel: displayGovernance?.releaseLabel || formatReleaseLabel(displayVersion),
    reviewLabel: displayGovernance?.reviewLabel || formatReviewLabel(displayVersion),
    versionLabel: displayGovernance?.workingVersionLabel || displayVersion.semver,
    detailItems: [
      {
        label: "Skill Key",
        value: displayDefinition.key,
      },
      {
        label: "定义 ID",
        value: displayDefinition.id,
      },
      {
        label: "版本 ID",
        value: displayGovernance?.workingVersionId || displayVersion.id,
      },
      {
        label: "预设 ID",
        value: displayPreset?.id || "未绑定",
      },
      {
        label: "路由模式",
        value: formatRoutingLabel(displayVersion),
      },
      {
        label: "执行器",
        value: formatExecutorLabel(displayVersion),
      },
      {
        label: "跟进方式",
        value: formatFollowUpLabel(displayVersion),
      },
      {
        label: "来源会话",
        value:
          clipText(
            displayRuntimeConfig.sourceConversationTitle ||
              displayVersion.sourceSnapshot?.fromConversationId,
            120,
          ) || "无",
      },
      ...(entry.legacyMetadata.source === "custom-skill"
        ? [
            {
              label: "存储状态",
              value: formatCustomSkillStorageLabel(customSkillSourceStatus),
            },
          ]
        : []),
    ].filter((item) => item.value),
    capabilityTags: buildCapabilityTags(entry, displayRuntimeConfig, displayVersion),
    performanceItems: buildPerformanceItems(entry, displayRuntimeConfig),
    examplePrompt: displayExamplePrompt || undefined,
    instruction: displayInstruction || undefined,
    isCustomSkill: entry.legacyMetadata.source === "custom-skill",
    ...(customSkillStatePresentation
      ? {
          customSkillStorageBadge: customSkillStatePresentation.storageBadge,
          customSkillStorageNotice: customSkillStatePresentation.storageNotice,
        }
      : {}),
    ...(customSkillSourceStatus ? { customSkillSourceStatus } : {}),
    definition: displayDefinition,
    version: displayVersion,
    preset: displayPreset,
    auditSummary: {
      ...auditSummary,
      latestTimestamp:
        auditSummary.latestTimestamp && auditSummary.latestTimestamp > 0
          ? auditSummary.latestTimestamp
          : undefined,
    },
    timeline,
    governance: displayGovernance,
  };
};

