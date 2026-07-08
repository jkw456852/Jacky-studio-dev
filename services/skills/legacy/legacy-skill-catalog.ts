import type { ChatMessage } from "../../../types";
import type { AgentSkillData } from "../../../types/agent.types.ts";
import type {
  CustomSkillConfigRecord,
  CustomSkillMarkdownAsset,
} from "../../runtime-assets/custom-skill-markdown.ts";
import {
  listMergedCustomSkillRecords,
  type MergedCustomSkillRecord,
} from "../../runtime-assets/custom-skill-repository.ts";
import { getFrontstageSkillId } from "../../runtime-assets/skill-identity.ts";
import { listStudioFrontstageSkillPresetAssets } from "../../runtime-assets/studio-registry.ts";
import type {
  StudioFrontstageSkillPresetAsset,
  StudioFrontstageSkillPresetExecutionType,
} from "../../runtime-assets/types.ts";
import type {
  LegacySkillCatalogEntry,
  SkillDefinition,
  SkillExampleSet,
  SkillManifest,
  SkillPerformanceOverlay,
  SkillPreset,
  SkillVersion,
} from "../catalog/skill-object-types.ts";
import { resolveDraftAwareSkillCatalogDisplayFromEntry } from "./custom-skill-presentation.ts";

type LegacySkillData = NonNullable<ChatMessage["skillData"]>;
type RuntimeSkillData = ChatMessage["skillData"] | AgentSkillData;

type RuntimeCustomConfigs = Record<string, Record<string, unknown>> | null | undefined;

export interface LegacySkillCatalogListArgs {
  customSkillMarkdownAssets?: CustomSkillMarkdownAsset[];
  runtimeCustomConfigs?: RuntimeCustomConfigs;
  includeBuiltins?: boolean;
  includeCustomSkills?: boolean;
}

export interface LegacySkillResolverOptions extends LegacySkillCatalogListArgs {
  legacySkillId?: string;
}

const normalizeString = (value: unknown): string =>
  String(value || "").replace(/\s+/g, " ").trim();

const normalizeStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => normalizeString(item)).filter(Boolean)
    : [];

const getConfigRecord = (
  value: unknown,
): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const buildLegacySkillDataFromPreset = (
  asset: StudioFrontstageSkillPresetAsset,
): LegacySkillData => {
  const config: Record<string, unknown> = {
    frontstageSkillId: String(asset.frontstageSkillId || asset.id || "").trim(),
  };

  if (asset.allowAutonomousRouting === true) {
    config.allowAutonomousRouting = true;
  }
  if (asset.mode) config.mode = asset.mode;
  if (asset.routeIntent) config.routeIntent = asset.routeIntent;
  if (asset.routeLabel) config.routeLabel = asset.routeLabel;
  if (asset.routeSummary) config.routeSummary = asset.routeSummary;
  if (asset.preferredSkills?.length) config.preferredSkills = [...asset.preferredSkills];
  if (asset.suggestedTaskMode) config.suggestedTaskMode = asset.suggestedTaskMode;
  if (asset.followUpMode) config.followUpMode = asset.followUpMode;
  if (asset.clarifyChecklist?.length) {
    config.clarifyChecklist = [...asset.clarifyChecklist];
  }
  if (asset.outputBlueprint?.length) {
    config.outputBlueprint = [...asset.outputBlueprint];
  }
  if (asset.reusableQuestions?.length) {
    config.reusableQuestions = [...asset.reusableQuestions];
  }
  if (asset.executionOutline?.length) {
    config.executionOutline = [...asset.executionOutline];
  }
  if (asset.executionRecipe?.length) {
    config.executionRecipe = [...asset.executionRecipe];
  }
  if (asset.instruction) config.instruction = asset.instruction;
  if (asset.examplePrompt) config.examplePrompt = asset.examplePrompt;
  if (asset.toolPolicy?.length) {
    config.toolPolicy = [...asset.toolPolicy];
  }
  if (asset.requiresAttachments === true) {
    config.requiresAttachments = true;
  }

  return {
    id: asset.skillDataId,
    ...(asset.pluginId ? { pluginId: asset.pluginId } : {}),
    name: asset.skillDataName || asset.name,
    iconName: asset.iconName,
    config,
  };
};

const buildLegacySkillDataFromCustomRecord = (
  record: MergedCustomSkillRecord,
): LegacySkillData => {
  const config = getConfigRecord(record.config) || {};
  return {
    id: record.id,
    name:
      normalizeString(config.name) ||
      normalizeString(record.asset?.name) ||
      "Custom Skill",
    iconName:
      normalizeString(config.iconName) ||
      normalizeString(record.asset?.iconName) ||
      "Sparkles",
    config: {
      ...config,
      isCustomSkill: true,
    },
  };
};

const mapExecutionTypeToManifestKind = (
  executionType: StudioFrontstageSkillPresetExecutionType,
): SkillManifest["kind"] => {
  switch (executionType) {
    case "workflow":
      return "workflow-skill";
    case "agent":
      return "agent-skill";
    default:
      return "tool-skill";
  }
};

const mapExecutionTypeToExecutorType = (
  executionType: StudioFrontstageSkillPresetExecutionType,
): SkillManifest["execution"]["executorType"] => {
  switch (executionType) {
    case "workflow":
      return "workflow-recipe";
    case "agent":
      return "agent-plan";
    default:
      return "skill-call";
  }
};

const mapRouteIntentToPresetTab = (
  routeIntent: unknown,
): SkillPreset["tab"] => {
  switch (normalizeString(routeIntent).toLowerCase()) {
    case "video":
      return "video";
    case "social":
      return "social";
    case "commerce":
      return "commerce";
    case "branding":
      return "branding";
    default:
      return "general";
  }
};

const toStableSuffix = (value: unknown): string =>
  normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";

const buildDefinitionId = (scope: "builtin" | "workspace", key: string): string =>
  `skill_def__${scope}__${toStableSuffix(key)}`;

const buildVersionId = (scope: "builtin" | "workspace", key: string): string =>
  `skill_ver__${scope}__${toStableSuffix(key)}__v1`;

const buildPresetId = (scope: "builtin" | "workspace", key: string): string =>
  `skill_preset__${scope}__${toStableSuffix(key)}`;

const buildBuiltinManifest = (
  asset: StudioFrontstageSkillPresetAsset,
): SkillManifest => ({
  kind: mapExecutionTypeToManifestKind(asset.executionType),
  identity: {
    key: `builtin.${normalizeString(asset.frontstageSkillId || asset.id)}`,
    displayName: normalizeString(asset.name),
    namespace: "builtin",
  },
  inputSchema: {
    type: "object",
    additionalProperties: true,
  },
  ui: {
    iconName: asset.iconName,
    category: asset.category,
    activationHint: asset.activationHint,
    ...(asset.instruction ? { instruction: asset.instruction } : {}),
    ...(asset.requiresAttachments ? { requiresAttachments: true } : {}),
  },
  routing: {
    mode: asset.allowAutonomousRouting === true ? "autonomous" : "manual",
    ...(asset.routeIntent ? { routeIntent: asset.routeIntent } : {}),
    ...(asset.routeLabel ? { routeLabel: asset.routeLabel } : {}),
    ...(asset.routeSummary ? { routeSummary: asset.routeSummary } : {}),
    ...(asset.suggestedTaskMode ? { taskMode: asset.suggestedTaskMode } : {}),
    ...(asset.followUpMode ? { followUpMode: asset.followUpMode } : {}),
    ...(asset.clarifyChecklist?.length
      ? { clarifyChecklist: [...asset.clarifyChecklist] }
      : {}),
    ...(asset.reusableQuestions?.length
      ? { reusableQuestions: [...asset.reusableQuestions] }
      : {}),
  },
  execution: {
    executorType: mapExecutionTypeToExecutorType(asset.executionType),
    ...(asset.preferredSkills?.length
      ? {
          preferredSkills: [...asset.preferredSkills],
          preferredFirstSkill: asset.preferredSkills[0],
        }
      : {}),
    ...(asset.executionRecipe?.length ? { recipe: [...asset.executionRecipe] } : {}),
    ...(asset.toolPolicy?.length ? { toolPolicy: [...asset.toolPolicy] } : {}),
  },
  outputContract: {
    ...(asset.outputBlueprint?.length ? { blueprint: [...asset.outputBlueprint] } : {}),
    ...(asset.executionOutline?.length ? { executionOutline: [...asset.executionOutline] } : {}),
  },
  permissions: {
    ...(asset.preferredSkills?.includes("workspaceSearch")
      ? { needsWorkspaceSearch: true }
      : {}),
  },
  observability: {
    traceLevel: "basic",
    saveInputs: true,
    saveOutputs: true,
    saveIntermediateCalls: true,
  },
  ...(asset.preferredSkills?.length
    ? {
        dependencies: {
          skills: [...asset.preferredSkills],
        },
      }
    : {}),
});

const buildBuiltinCatalogEntry = (
  asset: StudioFrontstageSkillPresetAsset,
): LegacySkillCatalogEntry => {
  const canonicalId = normalizeString(asset.frontstageSkillId || asset.id);
  const definitionId = buildDefinitionId("builtin", canonicalId);
  const versionId = buildVersionId("builtin", canonicalId);
  const presetId = buildPresetId("builtin", asset.id);

  const definition: SkillDefinition = {
    id: definitionId,
    key: `builtin.${canonicalId}`,
    name: normalizeString(asset.name),
    summary: normalizeString(asset.description),
    ownerType: "system",
    ownerId: "system",
    sourceType: "builtin",
    currentPublishedVersionId: versionId,
    defaultPresetId: presetId,
    tags: normalizeStringList(asset.tags),
    status: "active",
    createdAt: 0,
    updatedAt: 0,
  };

  const version: SkillVersion = {
    id: versionId,
    skillDefinitionId: definitionId,
    semver: "1.0.0",
    manifest: buildBuiltinManifest(asset),
    reviewStatus: "approved",
    releaseStatus: "published",
    publishedAt: 0,
    publishedBy: "system",
    createdAt: 0,
    createdBy: "system",
  };

  const preset: SkillPreset = {
    id: presetId,
    skillDefinitionId: definitionId,
    pinnedLocation: "sidebar",
    label: normalizeString(asset.name),
    description: normalizeString(asset.description),
    iconName: asset.iconName,
    tab: asset.tab,
    order: Number(asset.order || 999),
    frontstagePriority: asset.frontstagePriority,
    createdAt: 0,
    updatedAt: 0,
  };

  return {
    definition,
    version,
    preset,
    legacyMetadata: {
      source: "frontstage-preset",
      skillData: buildLegacySkillDataFromPreset(asset),
      frontstagePreset: {
        id: asset.id,
        category: asset.category,
        tab: asset.tab,
        frontstagePriority: asset.frontstagePriority,
        executionType: asset.executionType,
        activationHint: asset.activationHint,
        ...(asset.requiresAttachments ? { requiresAttachments: true } : {}),
        ...(asset.followUpMode ? { followUpMode: asset.followUpMode } : {}),
        ...(asset.notes ? { notes: asset.notes } : {}),
        ...(asset.research ? { research: asset.research } : {}),
        ...(asset.tags?.length ? { tags: [...asset.tags] } : {}),
        ...(asset.sources?.length ? { sources: [...asset.sources] } : {}),
      },
    },
  };
};

const inferCustomExecutorType = (
  config: Record<string, unknown>,
): SkillManifest["execution"]["executorType"] => {
  if (normalizeString(config.mode) === "unified-sidebar-agent") {
    return "agent-plan";
  }
  if (normalizeStringList(config.executionRecipe).length > 0) {
    return "agent-plan";
  }
  if (normalizeStringList(config.preferredSkills).length > 0) {
    return "skill-call";
  }
  return "skill-call";
};

const buildCustomManifest = (
  record: MergedCustomSkillRecord,
): SkillManifest => {
  const config = getConfigRecord(record.config) || {};
  const executorType = inferCustomExecutorType(config);

  return {
    kind: executorType === "agent-plan" ? "agent-skill" : "tool-skill",
    identity: {
      key: `workspace.${record.id}`,
      displayName:
        normalizeString(config.name) ||
        normalizeString(record.asset?.name) ||
        "Custom Skill",
      namespace: "workspace",
    },
    inputSchema: {
      type: "object",
      additionalProperties: true,
    },
    ui: {
      iconName:
        normalizeString(config.iconName) ||
        normalizeString(record.asset?.iconName) ||
        "Sparkles",
      category: normalizeString(config.routeIntent) || "general",
      activationHint:
        normalizeString(config.activationHint) ||
        "复用这次对话里沉淀下来的执行方式。",
      ...(normalizeString(config.instruction)
        ? { instruction: normalizeString(config.instruction) }
        : {}),
    },
    routing: {
      mode: config.allowAutonomousRouting === true ? "autonomous" : "manual",
      ...(normalizeString(config.routeIntent)
        ? { routeIntent: normalizeString(config.routeIntent) }
        : {}),
      ...(normalizeString(config.suggestedTaskMode)
        ? { taskMode: normalizeString(config.suggestedTaskMode) }
        : {}),
      ...(normalizeString(config.followUpMode) === "auto-clarify" ||
      normalizeString(config.followUpMode) === "direct-run"
        ? {
            followUpMode: normalizeString(config.followUpMode) as
              | "auto-clarify"
              | "direct-run",
          }
        : {}),
      ...(normalizeString(config.routeLabel)
        ? { routeLabel: normalizeString(config.routeLabel) }
        : {}),
      ...(normalizeString(config.routeSummary)
        ? { routeSummary: normalizeString(config.routeSummary) }
        : {}),
      ...(normalizeStringList(config.clarifyChecklist).length > 0
        ? {
            clarifyChecklist: normalizeStringList(config.clarifyChecklist),
          }
        : {}),
      ...(normalizeStringList(config.reusableQuestions).length > 0
        ? {
            reusableQuestions: normalizeStringList(config.reusableQuestions),
          }
        : {}),
    },
    execution: {
      executorType,
      ...(normalizeStringList(config.preferredSkills).length > 0
        ? {
            preferredSkills: normalizeStringList(config.preferredSkills),
            preferredFirstSkill: normalizeStringList(config.preferredSkills)[0],
          }
        : {}),
      ...(normalizeStringList(config.executionRecipe).length > 0
        ? { recipe: normalizeStringList(config.executionRecipe) }
        : {}),
      ...(normalizeStringList(config.toolPolicy).length > 0
        ? { toolPolicy: normalizeStringList(config.toolPolicy) }
        : {}),
    },
    outputContract: {
      ...(normalizeStringList(config.outputBlueprint).length > 0
        ? { blueprint: normalizeStringList(config.outputBlueprint) }
        : {}),
      ...(normalizeStringList(config.executionOutline).length > 0
        ? { executionOutline: normalizeStringList(config.executionOutline) }
        : {}),
    },
    permissions: {
      ...(normalizeStringList(config.preferredSkills).includes("workspaceSearch")
        ? { needsWorkspaceSearch: true }
        : {}),
    },
    observability: {
      traceLevel: "basic",
      saveInputs: true,
      saveOutputs: true,
      saveIntermediateCalls: true,
    },
    ...(normalizeStringList(config.preferredSkills).length > 0
      ? {
          dependencies: {
            skills: normalizeStringList(config.preferredSkills),
          },
        }
      : {}),
  };
};

const buildCustomExampleSet = (
  versionId: string,
  config: Record<string, unknown>,
): SkillExampleSet | undefined => {
  const examples = [
    {
      prompt: normalizeString(config.examplePrompt),
    },
    {
      prompt: normalizeString(config.lastSuccessfulPrompt),
      summary: normalizeString(config.lastSuccessfulSummary) || undefined,
      output: normalizeString(config.lastSuccessfulOutput) || undefined,
    },
  ]
    .filter((item) => item.prompt)
    .filter(
      (item, index, items) =>
        items.findIndex((candidate) => candidate.prompt === item.prompt) === index,
    );

  if (examples.length === 0) return undefined;

  return {
    id: `skill_examples__${toStableSuffix(versionId)}`,
    skillVersionId: versionId,
    examples,
  };
};

const buildCustomPerformanceOverlay = (
  definitionId: string,
  config: Record<string, unknown>,
): SkillPerformanceOverlay | undefined => {
  const successfulRuns = Number(config.successfulRuns || 0);
  const lastSuccessfulAt = Number(config.lastSuccessfulAt || 0);
  if (successfulRuns <= 0 && lastSuccessfulAt <= 0) {
    return undefined;
  }

  return {
    skillDefinitionId: definitionId,
    successfulRuns: Number.isFinite(successfulRuns) ? Math.max(0, successfulRuns) : 0,
    failedRuns: 0,
    ...(lastSuccessfulAt > 0 ? { lastSuccessfulAt } : {}),
  };
};

const buildCustomCatalogEntry = (
  record: MergedCustomSkillRecord,
): LegacySkillCatalogEntry | null => {
  const skillData = buildLegacySkillDataFromCustomRecord(record);
  const config = getConfigRecord(skillData.config) || {};
  const skillId = normalizeString(record.id);
  const name = normalizeString(skillData.name);
  if (!skillId || !name) return null;

  const definitionId = buildDefinitionId("workspace", skillId);
  const versionId = buildVersionId("workspace", skillId);
  const presetId = buildPresetId("workspace", skillId);

  const definition: SkillDefinition = {
    id: definitionId,
    key: `workspace.${skillId}`,
    name,
    summary:
      normalizeString(config.summary) ||
      normalizeString(config.description) ||
      "基于最近一次成功对话沉淀出的可复用 Skill。",
    description:
      normalizeString(config.instruction) ||
      normalizeString(record.asset?.description) ||
      undefined,
    ownerType: "workspace",
    ownerId: "workspace",
    sourceType: config.distilledFromConversation === true ? "distilled" : "imported",
    currentPublishedVersionId: versionId,
    defaultPresetId: presetId,
    tags: normalizeStringList(record.asset?.tags),
    status: "active",
    createdAt: Number(config.createdAt || record.asset?.createdAt || 0) || 0,
    updatedAt: Number(config.updatedAt || record.asset?.updatedAt || 0) || 0,
  };

  const version: SkillVersion = {
    id: versionId,
    skillDefinitionId: definitionId,
    semver: "1.0.0",
    manifest: buildCustomManifest(record),
    ...(normalizeString(config.distillationMethod)
      ? {
          sourceSnapshot: {
            ...(normalizeString(config.sourceConversationTitle)
              ? {
                  fromConversationId: normalizeString(config.sourceConversationTitle),
                }
              : {}),
            distillationMethod: normalizeString(config.distillationMethod),
          },
        }
      : {}),
    reviewStatus: "approved",
    releaseStatus: "published",
    publishedAt: Number(config.updatedAt || config.createdAt || record.asset?.updatedAt || 0) || 0,
    publishedBy: "workspace",
    createdAt: Number(config.createdAt || record.asset?.createdAt || 0) || 0,
    createdBy: "workspace",
  };

  const preset: SkillPreset = {
    id: presetId,
    skillDefinitionId: definitionId,
    pinnedLocation: "sidebar",
    label: name,
    description: definition.summary,
    iconName: normalizeString(skillData.iconName) || "Sparkles",
    tab: mapRouteIntentToPresetTab(config.routeIntent),
    order: 0,
    frontstagePriority: "primary",
    createdAt: definition.createdAt,
    updatedAt: definition.updatedAt,
  };

  return {
    definition,
    version,
    preset,
    legacyMetadata: {
      source: "custom-skill",
      skillData,
      customSkill: {
        id: skillId,
        sourceStatus: record.sourceStatus,
        ...(Number(config.lastUsedAt || 0) > 0
          ? { lastUsedAt: Number(config.lastUsedAt || 0) }
          : {}),
      },
    },
    performanceOverlay: buildCustomPerformanceOverlay(definitionId, config),
    exampleSet: buildCustomExampleSet(versionId, config),
  };
};

const buildRuntimeOnlyCustomSkillRecord = (args: {
  skillId: string;
  skillName?: unknown;
  skillIconName?: unknown;
  config?: Record<string, unknown> | null;
  sourceStatus?: MergedCustomSkillRecord["sourceStatus"];
}): MergedCustomSkillRecord | null => {
  const skillId = normalizeString(args.skillId);
  if (!skillId) return null;
  const rawConfig = getConfigRecord(args.config) || {};
  const sourceStatus =
    args.sourceStatus ||
    (normalizeString(rawConfig.storageFormat) === "markdown-file" ||
    normalizeString(rawConfig.markdownAssetId) ||
    normalizeString(rawConfig.markdownAssetPath)
      ? "missing-markdown-asset"
      : "runtime-only");

  const config = {
    ...rawConfig,
    name: normalizeString(rawConfig.name) || normalizeString(args.skillName) || "Custom Skill",
    iconName:
      normalizeString(rawConfig.iconName) || normalizeString(args.skillIconName) || "Sparkles",
    isCustomSkill: true,
  } satisfies CustomSkillConfigRecord;

  return {
    id: skillId,
    asset: null,
    config,
    sourceStatus,
  };
};

const resolveRuntimeOnlyCustomEntryFromSkillData = (
  skillData: LegacySkillData,
): LegacySkillCatalogEntry | null => {
  const config = getConfigRecord(skillData.config);
  if (!config || config.isCustomSkill !== true) return null;

  const record = buildRuntimeOnlyCustomSkillRecord({
    skillId: normalizeString(skillData.id),
    skillName: skillData.name,
    skillIconName: skillData.iconName,
    config,
  });
  if (!record) return null;

  return buildCustomCatalogEntry(record);
};

const resolveRuntimeOnlyCustomEntryFromConfig = (
  skillId: string,
  config: Record<string, unknown> | null | undefined,
): LegacySkillCatalogEntry | null => {
  const normalizedConfig = getConfigRecord(config);
  if (!normalizedConfig || normalizedConfig.isCustomSkill !== true) return null;

  const record = buildRuntimeOnlyCustomSkillRecord({
    skillId,
    skillName: normalizedConfig.name,
    skillIconName: normalizedConfig.iconName,
    config: normalizedConfig,
  });
  if (!record) return null;

  return buildCustomCatalogEntry(record);
};

const parseRuntimeOnlyCustomSkillIdFromVersionId = (
  versionId: unknown,
): string => {
  const normalizedVersionId = normalizeString(versionId);
  const match = normalizedVersionId.match(/^skill_ver__workspace__(.+)__v\d+$/);
  return match ? normalizeString(match[1]) : "";
};

const inferRuntimeOnlyCustomSkillIdFromConfig = (
  config: Record<string, unknown>,
): string => {
  const governance = getConfigRecord(config.skillGovernance);
  if (!governance) return "";

  return (
    parseRuntimeOnlyCustomSkillIdFromVersionId(governance.currentDraftVersionId) ||
    parseRuntimeOnlyCustomSkillIdFromVersionId(governance.currentPublishedVersionId)
  );
};

const buildCatalogEntries = (
  options?: LegacySkillCatalogListArgs,
): LegacySkillCatalogEntry[] => {
  const includeBuiltins = options?.includeBuiltins !== false;
  const includeCustomSkills = options?.includeCustomSkills !== false;
  const entries: LegacySkillCatalogEntry[] = [];

  if (includeBuiltins) {
    entries.push(
      ...listStudioFrontstageSkillPresetAssets()
        .map(buildBuiltinCatalogEntry)
        .sort((left, right) => (left.preset.order || 999) - (right.preset.order || 999)),
    );
  }

  if (includeCustomSkills) {
    entries.push(
      ...listMergedCustomSkillRecords({
        assets: options?.customSkillMarkdownAssets || [],
        runtimeCustomConfigs: options?.runtimeCustomConfigs,
      })
        .map(buildCustomCatalogEntry)
        .filter((entry): entry is LegacySkillCatalogEntry => Boolean(entry))
        .sort((left, right) => {
          const leftScore = Number(
            left.legacyMetadata.customSkill?.lastUsedAt ||
              left.definition.updatedAt ||
              0,
          );
          const rightScore = Number(
            right.legacyMetadata.customSkill?.lastUsedAt ||
              right.definition.updatedAt ||
              0,
          );
          return rightScore - leftScore;
        }),
    );
  }

  return entries;
};

const matchEntryAgainstSkillData = (
  entry: LegacySkillCatalogEntry,
  skillData: LegacySkillData,
): boolean => {
  if (entry.legacyMetadata.source === "custom-skill") {
    return normalizeString(entry.legacyMetadata.skillData.id) === normalizeString(skillData.id);
  }

  const requestedFrontstageId = getFrontstageSkillId(skillData);
  const entryFrontstageId = getFrontstageSkillId(entry.legacyMetadata.skillData);

  return (
    normalizeString(entryFrontstageId) === normalizeString(requestedFrontstageId) ||
    normalizeString(entry.legacyMetadata.skillData.id) === normalizeString(skillData.id)
  );
};

export const resolveEntryByLegacySkillData = (
  skillData: RuntimeSkillData | null | undefined,
  options?: LegacySkillResolverOptions,
): LegacySkillCatalogEntry | null => {
  if (!skillData) return null;
  const normalizedSkill = skillData as LegacySkillData;

  const matchedEntry =
    buildCatalogEntries(options).find((entry) =>
      matchEntryAgainstSkillData(entry, normalizedSkill),
    ) || null;
  if (matchedEntry) return matchedEntry;

  return resolveRuntimeOnlyCustomEntryFromSkillData(normalizedSkill);
};

export const resolveEntryByLegacyConfig = (
  legacyConfig: Record<string, unknown> | null | undefined,
  options?: LegacySkillResolverOptions,
): LegacySkillCatalogEntry | null => {
  const config = getConfigRecord(legacyConfig);
  if (!config) return null;

  if (config.isCustomSkill === true) {
    const explicitSkillId =
      normalizeString(options?.legacySkillId) ||
      normalizeString(config.markdownAssetId) ||
      inferRuntimeOnlyCustomSkillIdFromConfig(config);
    if (!explicitSkillId) return null;

    const matchedEntry =
      buildCatalogEntries(options).find(
        (entry) =>
          entry.legacyMetadata.source === "custom-skill" &&
          normalizeString(entry.legacyMetadata.customSkill?.id) === explicitSkillId,
      ) || null;
    if (matchedEntry) return matchedEntry;

    return resolveRuntimeOnlyCustomEntryFromConfig(explicitSkillId, config);
  }

  const frontstageSkillId = normalizeString(config.frontstageSkillId);
  if (!frontstageSkillId) return null;

  return (
    buildCatalogEntries(options).find(
      (entry) => {
        if (entry.legacyMetadata.source !== "frontstage-preset") return false;

        return (
          normalizeString(entry.legacyMetadata.frontstagePreset?.id) ===
            frontstageSkillId ||
          normalizeString(getFrontstageSkillId(entry.legacyMetadata.skillData)) ===
            frontstageSkillId ||
          normalizeString(entry.legacyMetadata.skillData.id) === frontstageSkillId
        );
      },
    ) || null
  );
};

export const resolveEntryByLegacyFrontstageSkillId = (
  legacyFrontstageSkillId: string,
  options?: LegacySkillResolverOptions,
): LegacySkillCatalogEntry | null => {
  const normalizedId = normalizeString(legacyFrontstageSkillId);
  if (!normalizedId) return null;

  const matchedEntry =
    buildCatalogEntries(options).find((entry) => {
      if (entry.legacyMetadata.source === "custom-skill") {
        return normalizeString(entry.legacyMetadata.customSkill?.id) === normalizedId;
      }

      return (
        normalizeString(entry.legacyMetadata.frontstagePreset?.id) === normalizedId ||
        normalizeString(getFrontstageSkillId(entry.legacyMetadata.skillData)) === normalizedId
      );
    }) || null;
  if (matchedEntry) return matchedEntry;

  const runtimeOnlyConfig =
    options?.runtimeCustomConfigs &&
    typeof options.runtimeCustomConfigs === "object"
      ? getConfigRecord(options.runtimeCustomConfigs[normalizedId])
      : null;
  if (!runtimeOnlyConfig) return null;

  return resolveRuntimeOnlyCustomEntryFromConfig(normalizedId, runtimeOnlyConfig);
};

export const listLegacyPresetSkillCatalogEntries = (): LegacySkillCatalogEntry[] =>
  buildCatalogEntries({
    includeBuiltins: true,
    includeCustomSkills: false,
  });

export const listLegacyCustomSkillCatalogEntries = (
  args: Required<Pick<LegacySkillCatalogListArgs, "customSkillMarkdownAssets">> & {
    runtimeCustomConfigs?: RuntimeCustomConfigs;
  },
): LegacySkillCatalogEntry[] =>
  buildCatalogEntries({
    includeBuiltins: false,
    includeCustomSkills: true,
    customSkillMarkdownAssets: args.customSkillMarkdownAssets,
    runtimeCustomConfigs: args.runtimeCustomConfigs,
  });

export const listLegacySkillCatalogEntries = (
  options?: LegacySkillCatalogListArgs,
): LegacySkillCatalogEntry[] => buildCatalogEntries(options);

export const resolveSkillDefinitionByLegacySkillData = (
  skillData: RuntimeSkillData | null | undefined,
  options?: LegacySkillResolverOptions,
): SkillDefinition | null =>
  (() => {
    const entry = resolveEntryByLegacySkillData(skillData, options);
    if (!entry) return null;
    return resolveDraftAwareSkillCatalogDisplayFromEntry(entry).definition;
  })();

export const resolveSkillVersionByLegacyConfig = (
  legacyConfig: Record<string, unknown> | null | undefined,
  options?: LegacySkillResolverOptions,
): SkillVersion | null =>
  (() => {
    const entry = resolveEntryByLegacyConfig(legacyConfig, options);
    if (!entry) return null;
    return resolveDraftAwareSkillCatalogDisplayFromEntry(entry).version;
  })();

export const resolvePresetByLegacyFrontstageSkillId = (
  legacyFrontstageSkillId: string,
  options?: LegacySkillResolverOptions,
): SkillPreset | null => {
  const entry = resolveEntryByLegacyFrontstageSkillId(legacyFrontstageSkillId, options);
  if (!entry) return null;
  return resolveDraftAwareSkillCatalogDisplayFromEntry(entry).preset;
};
