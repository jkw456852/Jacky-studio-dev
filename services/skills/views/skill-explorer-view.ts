import type {
  LegacySkillCatalogEntry,
  SkillDefinition,
  SkillPreset,
  SkillVersion,
} from "../catalog/skill-object-types.ts";
import {
  listLegacySkillCatalogEntries,
  type LegacySkillCatalogListArgs,
} from "../legacy/legacy-skill-catalog.ts";
import { resolveDraftAwareSkillCatalogDisplayFromEntry } from "../legacy/custom-skill-presentation.ts";

export interface SkillExplorerCard {
  definitionId: string;
  versionId: string;
  presetId?: string;
  name: string;
  summary: string;
  iconName: string;
  scope: "builtin" | "workspace";
  tab?: SkillPreset["tab"];
  order: number;
  category?: string;
  activationHint?: string;
  frontstagePriority?: "primary" | "secondary";
  tags: string[];
  // Legacy fields the UI can use until it consumes canonical identities exclusively.
  legacy: {
    frontstageSkillId?: string;
    skillDataId?: string;
    customSkillId?: string;
  };
  performance?: {
    successfulRuns: number;
    failedRuns: number;
    lastSuccessfulAt?: number;
    lastFailedAt?: number;
  };
  hasExamples: boolean;
}

export interface SkillExplorerDetail extends SkillExplorerCard {
  definition: SkillDefinition;
  version: SkillVersion;
  preset: SkillPreset;
  manifest: SkillVersion["manifest"];
  examples: Array<{ prompt: string; summary?: string; output?: string }>;
  clarifyChecklist: string[];
  executionRecipe: SkillVersion["manifest"]["execution"]["recipe"];
  outputBlueprint: string[];
  toolPolicy: SkillVersion["manifest"]["execution"]["toolPolicy"];
  notes?: string;
  research?: string;
  sources: string[];
}

export interface ListSkillExplorerArgs extends LegacySkillCatalogListArgs {
  query?: string;
  scope?: "builtin" | "workspace";
  tab?: SkillPreset["tab"];
}

const normalizeQuery = (value: string | undefined): string =>
  String(value ?? "").trim().toLowerCase();

const matchesQuery = (card: SkillExplorerCard, query: string): boolean => {
  if (!query) return true;
  const haystack = [card.name, card.summary, card.tags.join(" "), card.legacy.frontstageSkillId]
    .map((part) => String(part ?? "").toLowerCase())
    .join(" \u00b7 ");
  return haystack.includes(query);
};

const getDisplayEntry = (
  entry: LegacySkillCatalogEntry,
): {
  definition: SkillDefinition;
  version: SkillVersion;
  preset: SkillPreset | null;
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

const toCard = (entry: LegacySkillCatalogEntry): SkillExplorerCard => {
  const display = getDisplayEntry(entry);
  const scope: "builtin" | "workspace" =
    entry.legacyMetadata.source === "custom-skill" ? "workspace" : "builtin";
  const performance = entry.performanceOverlay
    ? {
        successfulRuns: entry.performanceOverlay.successfulRuns,
        failedRuns: entry.performanceOverlay.failedRuns,
        lastSuccessfulAt: entry.performanceOverlay.lastSuccessfulAt,
        lastFailedAt: entry.performanceOverlay.lastFailedAt,
      }
    : undefined;
  return {
    definitionId: display.definition.id,
    versionId: display.version.id,
    presetId: display.preset?.id || entry.preset.id,
    name: display.definition.name,
    summary: display.definition.summary,
    iconName:
      display.preset?.iconName ||
      display.version.manifest.ui.iconName ||
      entry.legacyMetadata.skillData.iconName,
    scope,
    tab: display.preset?.tab || entry.preset.tab,
    order: display.preset?.order ?? entry.preset.order ?? 999,
    category:
      display.version.manifest.ui.category ||
      entry.legacyMetadata.frontstagePreset?.category,
    activationHint:
      display.version.manifest.ui.activationHint ||
      entry.legacyMetadata.frontstagePreset?.activationHint,
    frontstagePriority:
      display.preset?.frontstagePriority ||
      entry.legacyMetadata.frontstagePreset?.frontstagePriority,
    tags: [...display.definition.tags],
    legacy: {
      frontstageSkillId: entry.legacyMetadata.frontstagePreset?.id,
      skillDataId: entry.legacyMetadata.skillData.id,
      customSkillId: entry.legacyMetadata.customSkill?.id,
    },
    performance,
    hasExamples: Boolean(entry.exampleSet && entry.exampleSet.examples.length > 0),
  };
};

const toDetail = (entry: LegacySkillCatalogEntry): SkillExplorerDetail => {
  const display = getDisplayEntry(entry);
  const card = toCard(entry);
  return {
    ...card,
    definition: display.definition,
    version: display.version,
    preset: display.preset || entry.preset,
    manifest: display.version.manifest,
    examples: (entry.exampleSet?.examples ?? []).map((example) => ({
      prompt: example.prompt,
      summary: example.summary,
      output: example.output,
    })),
    clarifyChecklist: display.version.manifest.routing.clarifyChecklist ?? [],
    executionRecipe: display.version.manifest.execution.recipe ?? [],
    outputBlueprint: display.version.manifest.outputContract.blueprint ?? [],
    toolPolicy: display.version.manifest.execution.toolPolicy ?? [],
    notes: entry.legacyMetadata.frontstagePreset?.notes,
    research: entry.legacyMetadata.frontstagePreset?.research,
    sources: [...(entry.legacyMetadata.frontstagePreset?.sources ?? [])],
  };
};

const matchesDetailIdentifier = (
  entry: LegacySkillCatalogEntry,
  identifier:
    | { kind: "definitionId"; value: string }
    | { kind: "presetId"; value: string }
    | { kind: "versionId"; value: string },
): boolean => {
  const target = String(identifier.value || "").trim();
  if (!target) return false;
  const display = getDisplayEntry(entry);

  switch (identifier.kind) {
    case "definitionId":
      return display.definition.id === target;
    case "presetId":
      return (display.preset || entry.preset)?.id === target;
    case "versionId":
      return display.version.id === target;
    default:
      return false;
  }
};

export const listSkillExplorerCards = (
  args: ListSkillExplorerArgs = {},
): SkillExplorerCard[] => {
  const query = normalizeQuery(args.query);
  const entries = listLegacySkillCatalogEntries({
    customSkillMarkdownAssets: args.customSkillMarkdownAssets,
    runtimeCustomConfigs: args.runtimeCustomConfigs,
    includeBuiltins: args.includeBuiltins,
    includeCustomSkills: args.includeCustomSkills,
  });
  const cards = entries.map(toCard).filter((card) => {
    if (args.scope && card.scope !== args.scope) return false;
    if (args.tab && card.tab !== args.tab) return false;
    return matchesQuery(card, query);
  });
  cards.sort((a, b) => {
    if (a.scope !== b.scope) return a.scope === "builtin" ? -1 : 1;
    return a.order - b.order;
  });
  return cards;
};

export const getSkillExplorerDetail = (
  identifier:
    | { kind: "definitionId"; value: string }
    | { kind: "presetId"; value: string }
    | { kind: "versionId"; value: string },
  args: LegacySkillCatalogListArgs = {},
): SkillExplorerDetail | null => {
  const entries = listLegacySkillCatalogEntries(args);
  const target = String(identifier.value || "").trim();
  if (!target) return null;
  const match = entries.find((entry) => matchesDetailIdentifier(entry, identifier));
  return match ? toDetail(match) : null;
};

export const summarizeSkillExplorer = (
  args: ListSkillExplorerArgs = {},
): {
  total: number;
  builtin: number;
  workspace: number;
  byTab: Record<string, number>;
} => {
  const cards = listSkillExplorerCards(args);
  const summary: { total: number; builtin: number; workspace: number; byTab: Record<string, number> } = {
    total: cards.length,
    builtin: 0,
    workspace: 0,
    byTab: {},
  };
  for (const card of cards) {
    if (card.scope === "builtin") summary.builtin += 1;
    else summary.workspace += 1;
    const tab = card.tab ?? "general";
    summary.byTab[tab] = (summary.byTab[tab] ?? 0) + 1;
  }
  return summary;
};
