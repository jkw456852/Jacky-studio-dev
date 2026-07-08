import type { ChatMessage } from "../../types";
import { listLegacyPresetSkillCatalogEntries } from "../skills/legacy/legacy-skill-catalog.ts";
import type {
  StudioFrontstageSkillPresetAsset,
  StudioFrontstageSkillPresetCategory,
  StudioFrontstageSkillPresetExecutionType,
  StudioFrontstageSkillPresetFollowUpMode,
  StudioFrontstageSkillPresetTab,
} from "./types.ts";
import type { LegacySkillCatalogEntry } from "../skills/catalog/skill-object-types.ts";

export type FrontstageSkillPreset = {
  id: string;
  name: string;
  description: string;
  category: StudioFrontstageSkillPresetCategory;
  tab: StudioFrontstageSkillPresetTab;
  frontstagePriority: "primary" | "secondary";
  executionType: StudioFrontstageSkillPresetExecutionType;
  activationHint: string;
  requiresAttachments?: boolean;
  followUpMode?: StudioFrontstageSkillPresetFollowUpMode;
  iconName: string;
  order: number;
  skillData: NonNullable<ChatMessage["skillData"]>;
  notes?: string;
  research?: string;
  tags?: string[];
  sources?: string[];
};

const toFrontstageSkillPreset = (entry: LegacySkillCatalogEntry): FrontstageSkillPreset => {
  const presetMetadata = entry.legacyMetadata.frontstagePreset!;
  return {
    id: presetMetadata.id,
    name: entry.definition.name,
    description: entry.definition.summary,
    category: presetMetadata.category,
    tab: presetMetadata.tab,
    frontstagePriority: presetMetadata.frontstagePriority,
    executionType: presetMetadata.executionType,
    activationHint: presetMetadata.activationHint,
    ...(presetMetadata.requiresAttachments ? { requiresAttachments: true } : {}),
    ...(presetMetadata.followUpMode ? { followUpMode: presetMetadata.followUpMode } : {}),
    iconName: entry.preset.iconName || entry.legacyMetadata.skillData.iconName,
    order: entry.preset.order || 999,
    skillData: entry.legacyMetadata.skillData,
    ...(presetMetadata.notes ? { notes: presetMetadata.notes } : {}),
    ...(presetMetadata.research ? { research: presetMetadata.research } : {}),
    ...(presetMetadata.tags?.length ? { tags: [...presetMetadata.tags] } : {}),
    ...(presetMetadata.sources?.length ? { sources: [...presetMetadata.sources] } : {}),
  };
};

export const listFrontstageSkillPresets = (): FrontstageSkillPreset[] =>
  listLegacyPresetSkillCatalogEntries()
    .map(toFrontstageSkillPreset)
    .sort((left, right) => left.order - right.order);
