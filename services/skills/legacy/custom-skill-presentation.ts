import type {
  CustomSkillConfigRecord,
  CustomSkillMarkdownAsset,
} from "../../runtime-assets/custom-skill-markdown.ts";
import {
  listMergedCustomSkillRecords,
  resolveMergedCustomSkillRecord,
  type MergedCustomSkillRecord,
} from "../../runtime-assets/custom-skill-repository.ts";
import type {
  LegacySkillCatalogEntry,
  SkillDefinition,
  SkillPreset,
  SkillVersion,
} from "../catalog/skill-object-types.ts";
import {
  buildSkillGovernancePanelModel,
  readSkillGovernanceOverlay,
  resolveEditableCustomSkillConfig,
  type SkillGovernancePanelModel,
  type SkillGovernanceSeed,
} from "./custom-skill-governance.ts";

type RuntimeSkillConfig = Record<string, unknown>;

export interface CustomSkillPresentationRecord extends MergedCustomSkillRecord {
  editableConfig: CustomSkillConfigRecord;
  governance: SkillGovernancePanelModel;
}

export interface DraftAwareSkillCatalogDisplay {
  definition: SkillDefinition;
  version: SkillVersion;
  preset: SkillPreset | null;
  runtimeConfig: RuntimeSkillConfig;
  governance: SkillGovernancePanelModel | null;
}

const normalizeText = (value: unknown): string =>
  String(value || "").replace(/\s+/g, " ").trim();

const normalizeTextList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean)
    : [];

const inferCustomExecutorType = (
  config: RuntimeSkillConfig,
): SkillVersion["manifest"]["execution"]["executorType"] => {
  if (normalizeText(config.mode) === "unified-sidebar-agent") {
    return "agent-plan";
  }
  if (normalizeTextList(config.executionRecipe).length > 0) {
    return "agent-plan";
  }
  return "skill-call";
};

const buildGovernanceSeed = (args: {
  skillId: string;
  config: CustomSkillConfigRecord;
  fallbackEntry?: LegacySkillCatalogEntry;
}): SkillGovernanceSeed => {
  const { skillId, config, fallbackEntry } = args;
  if (!fallbackEntry) {
    return {
      skillId,
      config,
    };
  }

  return {
    skillId,
    config,
    fallbackVersionId: fallbackEntry.version.id,
    fallbackSemver: fallbackEntry.version.semver,
    fallbackCreatedAt: fallbackEntry.version.createdAt,
    fallbackUpdatedAt:
      fallbackEntry.version.publishedAt ||
      fallbackEntry.version.createdAt ||
      fallbackEntry.definition.updatedAt,
  };
};

export const buildCustomSkillPresentation = (
  seed: SkillGovernanceSeed,
): Pick<CustomSkillPresentationRecord, "editableConfig" | "governance"> => ({
  editableConfig: resolveEditableCustomSkillConfig(seed),
  governance: buildSkillGovernancePanelModel(seed),
});

export const listCustomSkillPresentationRecords = (args: {
  assets: CustomSkillMarkdownAsset[];
  runtimeCustomConfigs?: Record<string, Record<string, unknown>> | null;
}): CustomSkillPresentationRecord[] =>
  listMergedCustomSkillRecords(args).map((record) => ({
    ...record,
    ...buildCustomSkillPresentation({
      skillId: record.id,
      config: record.config,
    }),
  }));

export const resolveCustomSkillPresentationRecord = (args: {
  skillId: string;
  assets: CustomSkillMarkdownAsset[];
  runtimeCustomConfigs?: Record<string, Record<string, unknown>> | null;
}): CustomSkillPresentationRecord | null => {
  const record = resolveMergedCustomSkillRecord(args);
  if (!record) return null;

  return {
    ...record,
    ...buildCustomSkillPresentation({
      skillId: record.id,
      config: record.config,
    }),
  };
};

export const buildDraftAwareSkillCatalogDisplay = (args: {
  entry: LegacySkillCatalogEntry;
  skillId: string;
  runtimeConfig: RuntimeSkillConfig;
}): DraftAwareSkillCatalogDisplay => {
  const { entry, skillId, runtimeConfig } = args;
  if (entry.legacyMetadata.source !== "custom-skill") {
    return {
      definition: entry.definition,
      version: entry.version,
      preset: entry.preset || null,
      runtimeConfig,
      governance: null,
    };
  }

  const governanceSeed = buildGovernanceSeed({
    skillId,
    config: runtimeConfig as CustomSkillConfigRecord,
    fallbackEntry: entry,
  });
  const presentation = buildCustomSkillPresentation(governanceSeed);
  const governanceOverlay = readSkillGovernanceOverlay(governanceSeed);
  const workingGovernanceVersion =
    governanceOverlay.versions.find(
      (version) => version.id === presentation.governance.workingVersionId,
    ) || null;
  const editableConfig = presentation.editableConfig;
  const summary =
    normalizeText(editableConfig.summary) ||
    normalizeText(editableConfig.description) ||
    entry.definition.summary;
  const description =
    normalizeText(editableConfig.instruction || editableConfig.customInstruction) ||
    entry.definition.description;
  const routeIntent = normalizeText(editableConfig.routeIntent);
  const routeLabel = normalizeText(editableConfig.routeLabel);
  const routeSummary = normalizeText(editableConfig.routeSummary);
  const taskMode = normalizeText(editableConfig.suggestedTaskMode);
  const followUpMode = normalizeText(editableConfig.followUpMode);
  const clarifyChecklist = normalizeTextList(editableConfig.clarifyChecklist);
  const reusableQuestions = normalizeTextList(editableConfig.reusableQuestions);
  const preferredSkills = normalizeTextList(editableConfig.preferredSkills);
  const executionRecipe = normalizeTextList(editableConfig.executionRecipe);
  const toolPolicy = normalizeTextList(editableConfig.toolPolicy);
  const outputBlueprint = normalizeTextList(editableConfig.outputBlueprint);
  const executionOutline = normalizeTextList(editableConfig.executionOutline);
  const activationHint = normalizeText(editableConfig.activationHint);
  const iconName = normalizeText(editableConfig.iconName);
  const executorType = inferCustomExecutorType(editableConfig);
  const {
    publishedAt: _legacyPublishedAt,
    publishedBy: _legacyPublishedBy,
    ...legacyVersionBase
  } = entry.version;

  const version: SkillVersion = {
    ...legacyVersionBase,
    id: workingGovernanceVersion?.id || presentation.governance.workingVersionId || entry.version.id,
    semver:
      workingGovernanceVersion?.semver ||
      presentation.governance.workingVersionLabel ||
      entry.version.semver,
    reviewStatus: workingGovernanceVersion?.reviewStatus || entry.version.reviewStatus,
    releaseStatus: workingGovernanceVersion?.releaseStatus || entry.version.releaseStatus,
    createdAt: workingGovernanceVersion?.createdAt ?? entry.version.createdAt,
    createdBy: workingGovernanceVersion?.createdBy || entry.version.createdBy,
    ...(workingGovernanceVersion?.publishedAt !== undefined
      ? { publishedAt: workingGovernanceVersion.publishedAt }
      : {}),
    ...(workingGovernanceVersion?.publishedBy
      ? { publishedBy: workingGovernanceVersion.publishedBy }
      : {}),
    manifest: {
      ...entry.version.manifest,
      kind: executorType === "agent-plan" ? "agent-skill" : "tool-skill",
      identity: {
        ...entry.version.manifest.identity,
        displayName:
          normalizeText(editableConfig.name) || entry.version.manifest.identity.displayName,
      },
      ui: {
        ...entry.version.manifest.ui,
        ...(iconName ? { iconName } : {}),
        ...(routeIntent ? { category: routeIntent } : {}),
        ...(activationHint ? { activationHint } : {}),
        ...(description ? { instruction: description } : {}),
      },
      routing: {
        ...entry.version.manifest.routing,
        mode: editableConfig.allowAutonomousRouting === true ? "autonomous" : "manual",
        ...(routeIntent ? { routeIntent } : {}),
        ...(routeLabel ? { routeLabel } : {}),
        ...(routeSummary ? { routeSummary } : {}),
        ...(taskMode
          ? { taskMode: taskMode as SkillVersion["manifest"]["routing"]["taskMode"] }
          : {}),
        ...(followUpMode === "auto-clarify" || followUpMode === "direct-run"
          ? { followUpMode: followUpMode as "auto-clarify" | "direct-run" }
          : {}),
        ...(clarifyChecklist.length > 0 ? { clarifyChecklist } : {}),
        ...(reusableQuestions.length > 0 ? { reusableQuestions } : {}),
      },
      execution: {
        ...entry.version.manifest.execution,
        executorType,
        ...(preferredSkills.length > 0
          ? {
              preferredSkills,
              preferredFirstSkill: preferredSkills[0],
            }
          : {}),
        ...(executionRecipe.length > 0 ? { recipe: executionRecipe } : {}),
        ...(toolPolicy.length > 0 ? { toolPolicy } : {}),
      },
      outputContract: {
        ...entry.version.manifest.outputContract,
        ...(outputBlueprint.length > 0 ? { blueprint: outputBlueprint } : {}),
        ...(executionOutline.length > 0 ? { executionOutline } : {}),
      },
      permissions: {
        ...entry.version.manifest.permissions,
        ...(preferredSkills.includes("workspaceSearch")
          ? { needsWorkspaceSearch: true }
          : {}),
      },
      ...(preferredSkills.length > 0
        ? {
            dependencies: {
              ...(entry.version.manifest.dependencies || {}),
              skills: preferredSkills,
            },
          }
        : {}),
    },
  };

  return {
    definition: {
      ...entry.definition,
      name: normalizeText(editableConfig.name) || entry.definition.name,
      summary,
      ...(description ? { description } : {}),
      ...(presentation.governance.hasDraft
        ? { currentDraftVersionId: presentation.governance.workingVersionId }
        : {}),
      ...(presentation.governance.publishedVersionId
        ? { currentPublishedVersionId: presentation.governance.publishedVersionId }
        : {}),
      ...(entry.preset?.id ? { defaultPresetId: entry.preset.id } : {}),
      updatedAt: Number(
        editableConfig.updatedAt ||
          workingGovernanceVersion?.updatedAt ||
          entry.definition.updatedAt ||
          0,
      ),
    },
    version,
    preset: entry.preset
      ? {
          ...entry.preset,
          label: normalizeText(editableConfig.name) || entry.preset.label,
          description: summary || entry.preset.description,
          ...(iconName ? { iconName } : {}),
          updatedAt: Number(editableConfig.updatedAt || entry.preset.updatedAt || 0),
        }
      : null,
    runtimeConfig: editableConfig,
    governance: presentation.governance,
  };
};

export const resolveDraftAwareSkillCatalogDisplayFromEntry = (
  entry: LegacySkillCatalogEntry,
): DraftAwareSkillCatalogDisplay => {
  if (entry.legacyMetadata.source !== "custom-skill") {
    return {
      definition: entry.definition,
      version: entry.version,
      preset: entry.preset || null,
      runtimeConfig:
        entry.legacyMetadata.skillData.config &&
        typeof entry.legacyMetadata.skillData.config === "object"
          ? (entry.legacyMetadata.skillData.config as RuntimeSkillConfig)
          : {},
      governance: null,
    };
  }

  return buildDraftAwareSkillCatalogDisplay({
    entry,
    skillId:
      entry.legacyMetadata.customSkill?.id ||
      entry.legacyMetadata.skillData.id,
    runtimeConfig:
      entry.legacyMetadata.skillData.config &&
      typeof entry.legacyMetadata.skillData.config === "object"
        ? (entry.legacyMetadata.skillData.config as RuntimeSkillConfig)
        : {},
  });
};
