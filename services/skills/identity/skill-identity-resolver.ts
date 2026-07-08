import type { ChatMessage } from "../../../types";
import {
  listLegacySkillCatalogEntries,
  resolveEntryByLegacyConfig,
  resolveEntryByLegacyFrontstageSkillId,
  resolveEntryByLegacySkillData,
  type LegacySkillResolverOptions,
} from "../legacy/legacy-skill-catalog.ts";
import type { AgentSkillData } from "../../../types/agent.types.ts";
import { resolveDraftAwareSkillCatalogDisplayFromEntry } from "../legacy/custom-skill-presentation.ts";
import type {
  LegacySkillCatalogEntry,
  SkillDefinition,
  SkillPreset,
  SkillVersion,
} from "../catalog/skill-object-types.ts";
import { getFrontstageSkillId } from "../../runtime-assets/skill-identity.ts";

export type SkillIdentityScope = "builtin" | "workspace";

export type SkillIdentityResolutionSource =
  | "skill-definition-id"
  | "skill-version-id"
  | "skill-preset-id"
  | "legacy-skill-data"
  | "legacy-config-frontstage-id"
  | "legacy-config-custom-skill"
  | "legacy-frontstage-id";

export interface SkillCanonicalIdentity {
  definitionId: string;
  versionId: string;
  presetId?: string;
  scope: SkillIdentityScope;
  source: SkillIdentityResolutionSource;
  legacy: {
    frontstageSkillId?: string;
    skillDataId?: string;
    customSkillId?: string;
  };
}

export interface SkillIdentityLookup {
  identity: SkillCanonicalIdentity;
  definition: SkillDefinition;
  version: SkillVersion;
  preset: SkillPreset;
  entry: LegacySkillCatalogEntry;
}

export type RuntimeSkillData = ChatMessage["skillData"] | AgentSkillData;

const normalizeString = (value: unknown): string =>
  String(value || "").replace(/\s+/g, " ").trim();

const buildIdentity = (
  entry: LegacySkillCatalogEntry,
  display: {
    definition: SkillDefinition;
    version: SkillVersion;
    preset: SkillPreset;
  },
  source: SkillIdentityResolutionSource,
): SkillCanonicalIdentity => {
  const scope: SkillIdentityScope =
    entry.legacyMetadata.source === "custom-skill" ? "workspace" : "builtin";
  return {
    definitionId: display.definition.id,
    versionId: display.version.id,
    presetId: display.preset.id,
    scope,
    source,
    legacy: {
      frontstageSkillId:
        entry.legacyMetadata.frontstagePreset?.id ||
        getFrontstageSkillId(entry.legacyMetadata.skillData) ||
        undefined,
      skillDataId: entry.legacyMetadata.skillData.id,
      customSkillId: entry.legacyMetadata.customSkill?.id,
    },
  };
};

const getDisplayEntry = (
  entry: LegacySkillCatalogEntry,
): {
  definition: SkillDefinition;
  version: SkillVersion;
  preset: SkillPreset;
} => {
  if (entry.legacyMetadata.source !== "custom-skill") {
    return {
      definition: entry.definition,
      version: entry.version,
      preset: entry.preset,
    };
  }

  const display = resolveDraftAwareSkillCatalogDisplayFromEntry(entry);

  return {
    definition: display.definition,
    version: display.version,
    preset: display.preset || entry.preset,
  };
};

const toLookup = (
  entry: LegacySkillCatalogEntry,
  source: SkillIdentityResolutionSource,
): SkillIdentityLookup => {
  const display = getDisplayEntry(entry);
  return {
    identity: buildIdentity(entry, display, source),
    definition: display.definition,
    version: display.version,
    preset: display.preset,
    entry,
  };
};

const matchesDisplayId = (
  entry: LegacySkillCatalogEntry,
  identifier: {
    kind: "definitionId" | "versionId" | "presetId";
    value: string;
  },
): boolean => {
  const target = normalizeString(identifier.value);
  if (!target) return false;
  const display = getDisplayEntry(entry);

  switch (identifier.kind) {
    case "definitionId":
      return normalizeString(display.definition.id) === target;
    case "versionId":
      return normalizeString(display.version.id) === target;
    case "presetId":
      return normalizeString(display.preset.id) === target;
    default:
      return false;
  }
};

const findById = (
  entries: LegacySkillCatalogEntry[],
  predicate: (entry: LegacySkillCatalogEntry) => boolean,
): LegacySkillCatalogEntry | null => entries.find(predicate) || null;

const collectEntries = (
  options?: LegacySkillResolverOptions,
): LegacySkillCatalogEntry[] => listLegacySkillCatalogEntries(options);

export const resolveIdentityByDefinitionId = (
  definitionId: string,
  options?: LegacySkillResolverOptions,
): SkillIdentityLookup | null => {
  const target = normalizeString(definitionId);
  if (!target) return null;
  const entry = findById(
    collectEntries(options),
    (item) => matchesDisplayId(item, { kind: "definitionId", value: target }),
  );
  return entry ? toLookup(entry, "skill-definition-id") : null;
};

export const resolveIdentityByVersionId = (
  versionId: string,
  options?: LegacySkillResolverOptions,
): SkillIdentityLookup | null => {
  const target = normalizeString(versionId);
  if (!target) return null;
  const entry = findById(
    collectEntries(options),
    (item) => matchesDisplayId(item, { kind: "versionId", value: target }),
  );
  return entry ? toLookup(entry, "skill-version-id") : null;
};

export const resolveIdentityByPresetId = (
  presetId: string,
  options?: LegacySkillResolverOptions,
): SkillIdentityLookup | null => {
  const target = normalizeString(presetId);
  if (!target) return null;
  const entry = findById(
    collectEntries(options),
    (item) => matchesDisplayId(item, { kind: "presetId", value: target }),
  );
  return entry ? toLookup(entry, "skill-preset-id") : null;
};

export const resolveIdentityByLegacyFrontstageId = (
  legacyFrontstageId: string,
  options?: LegacySkillResolverOptions,
): SkillIdentityLookup | null => {
  const target = normalizeString(legacyFrontstageId);
  if (!target) return null;
  const entry = resolveEntryByLegacyFrontstageSkillId(target, options);
  return entry ? toLookup(entry, "legacy-frontstage-id") : null;
};

export const resolveIdentityByLegacySkillData = (
  skillData: RuntimeSkillData | null | undefined,
  options?: LegacySkillResolverOptions,
): SkillIdentityLookup | null => {
  const entry = resolveEntryByLegacySkillData(skillData, options);
  return entry ? toLookup(entry, "legacy-skill-data") : null;
};

export const resolveIdentityByLegacyConfig = (
  legacyConfig: Record<string, unknown> | null | undefined,
  options?: LegacySkillResolverOptions,
): SkillIdentityLookup | null => {
  if (!legacyConfig || typeof legacyConfig !== "object") return null;
  const entry = resolveEntryByLegacyConfig(legacyConfig, options);
  if (!entry) return null;

  return toLookup(
    entry,
    (legacyConfig as Record<string, unknown>).isCustomSkill === true
      ? "legacy-config-custom-skill"
      : "legacy-config-frontstage-id",
  );
};

export const resolveSkillIdentity = (
  input:
    | { kind: "definitionId"; value: string }
    | { kind: "versionId"; value: string }
    | { kind: "presetId"; value: string }
    | { kind: "legacyFrontstageId"; value: string }
    | { kind: "legacySkillData"; value: RuntimeSkillData | null | undefined }
    | { kind: "legacyConfig"; value: Record<string, unknown> | null | undefined },
  options?: LegacySkillResolverOptions,
): SkillIdentityLookup | null => {
  switch (input.kind) {
    case "definitionId":
      return resolveIdentityByDefinitionId(input.value, options);
    case "versionId":
      return resolveIdentityByVersionId(input.value, options);
    case "presetId":
      return resolveIdentityByPresetId(input.value, options);
    case "legacyFrontstageId":
      return resolveIdentityByLegacyFrontstageId(input.value, options);
    case "legacySkillData":
      return resolveIdentityByLegacySkillData(input.value, options);
    case "legacyConfig":
      return resolveIdentityByLegacyConfig(input.value, options);
    default:
      return null;
  }
};
