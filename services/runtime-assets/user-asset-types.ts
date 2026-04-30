import type { AgentRoleDraft, AgentType } from "../../types/agent.types";
import type { WorkspaceStyleLibrary } from "../../types/common";

export const STUDIO_USER_ASSET_STATE_VERSION = 3;
export const STUDIO_MAIN_BRAIN_ASSET_VERSION = 1;
export const STUDIO_ROLE_ADDON_ASSET_VERSION = 1;
export const STUDIO_ROLE_DRAFT_ASSET_VERSION = 1;
export const STUDIO_STYLE_LIBRARY_ASSET_VERSION = 1;
export const STUDIO_USER_PROFILE_ASSET_VERSION = 1;
export const STUDIO_EVOLUTION_ASSET_VERSION = 1;
export const STUDIO_WORKSPACE_PREFERENCES_ASSET_VERSION = 1;
export const STUDIO_SKILL_PREFERENCES_ASSET_VERSION = 1;
export const STUDIO_PLUGIN_PREFERENCES_ASSET_VERSION = 1;

export type StudioAssetVersion = 1;

export interface StudioStoredPromptAddonAsset {
  agentId: AgentType;
  value: string;
  schemaVersion: StudioAssetVersion;
  updatedAt: number;
}

export type StudioStoredRoleDraft = AgentRoleDraft & {
  agentId: AgentType;
  roleStrategy?: "reuse" | "augment" | "create";
  roleStrategyReason?: string;
  schemaVersion: StudioAssetVersion;
  updatedAt: number;
};

export type StudioUserPromptAddonMap = Partial<
  Record<AgentType, StudioStoredPromptAddonAsset>
>;

export type StudioUserRoleDraftMap = Partial<
  Record<AgentType, StudioStoredRoleDraft>
>;

export interface StudioStoredStyleLibrary extends WorkspaceStyleLibrary {
  id: string;
  slug: string;
  schemaVersion: StudioAssetVersion;
  sourceMode?: "default" | "poster-product" | "custom";
}

export interface StudioMainBrainPreferencesAsset {
  schemaVersion: StudioAssetVersion;
  updatedAt: number;
  lines: string[];
}

export interface StudioUserProfileAsset {
  schemaVersion: StudioAssetVersion;
  updatedAt: number;
  preferenceNotes: string[];
  commonTasks: string[];
  aestheticPreferences: string[];
  brandContextNotes: string[];
  memoryNotes: string[];
}

export interface StudioImageModelPostPathConfig {
  withReferences: string;
  withoutReferences: string;
}

export interface StudioWorkspacePreferencesAsset {
  schemaVersion: StudioAssetVersion;
  updatedAt: number;
  selectedScriptModels: string[];
  selectedImageModels: string[];
  selectedVideoModels: string[];
  imageModelPostPaths: Record<string, StudioImageModelPostPathConfig>;
  visualOrchestratorModel: string;
  browserAgentModel: string;
  visualOrchestratorMaxReferenceImages: number;
  visualOrchestratorMaxInlineImageBytesMb: number;
  visualContinuity: boolean;
  systemModeration: boolean;
  autoSave: boolean;
  concurrentCount: number;
  autoModelSelect: boolean;
  preferredImageModel: string;
  preferredImageProviderId: string | null;
  preferredVideoModel: string;
  preferredVideoProviderId: string | null;
  preferred3DModel: string;
  browserAgentChatEnabled: boolean;
}

export interface StudioSkillPreferenceSnapshot {
  id: string;
  name: string;
  iconName: string;
  config?: Record<string, unknown>;
}

export interface StudioSkillPreferencesAsset {
  schemaVersion: StudioAssetVersion;
  updatedAt: number;
  activeQuickSkill: StudioSkillPreferenceSnapshot | null;
  recentSkillIds: string[];
  pinnedSkillIds: string[];
  customSkillConfigs: Record<string, Record<string, unknown>>;
}

export interface StudioPluginPreferenceEntry {
  pluginId: string;
  enabled: boolean;
  pinned: boolean;
  updatedAt: number;
  config?: Record<string, unknown>;
}

export interface StudioPluginPreferencesAsset {
  schemaVersion: StudioAssetVersion;
  updatedAt: number;
  records: Record<string, StudioPluginPreferenceEntry>;
}

export type StudioEvolutionApprovalStatus =
  | "pending_review"
  | "approved"
  | "rejected";

export interface StudioEvolutionRecord {
  id: string;
  schemaVersion: StudioAssetVersion;
  createdAt: number;
  updatedAt: number;
  category:
    | "main_brain_preference"
    | "role_strategy"
    | "style_library_strategy"
    | "workflow_strategy"
    | "other";
  title: string;
  summary: string;
  proposal: string;
  evidence: string[];
  riskNotes: string[];
  source: "user_feedback" | "system_inference" | "manual";
  approvalStatus: StudioEvolutionApprovalStatus;
  reviewerNote?: string;
}

export interface StudioUserAssetState {
  version: 3;
  updatedAt: number;
  mainBrainPreferences: StudioMainBrainPreferencesAsset;
  userProfile: StudioUserProfileAsset;
  workspacePreferences: StudioWorkspacePreferencesAsset;
  skillPreferences: StudioSkillPreferencesAsset;
  pluginPreferences: StudioPluginPreferencesAsset;
  agentPromptAddons: StudioUserPromptAddonMap;
  latestRoleDrafts: StudioUserRoleDraftMap;
  styleLibraries: Record<string, StudioStoredStyleLibrary>;
  evolutionRecords: Record<string, StudioEvolutionRecord>;
}

export type StudioUserAssetAuditAction =
  | "update"
  | "remove"
  | "review"
  | "rollback";

export type StudioUserAssetAuditTargetKind =
  | "main-brain"
  | "user-profile"
  | "workspace-preference"
  | "skill-preference"
  | "plugin-preference"
  | "agent-role-addon"
  | "role-draft"
  | "style-library"
  | "evolution-record"
  | "rollback";

export interface StudioUserAssetAuditEntry {
  id: string;
  schemaVersion: StudioAssetVersion;
  createdAt: number;
  action: StudioUserAssetAuditAction;
  targetKind: StudioUserAssetAuditTargetKind;
  targetId?: string;
  summary: string;
  snapshot: StudioUserAssetState;
}
