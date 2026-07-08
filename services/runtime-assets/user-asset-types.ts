import type {
  AgentRoleDraft,
  AgentType,
  StudioRoleEntity,
  StudioRoleVersionRecord,
  StudioTemporaryRoleDraft,
} from "../../types/agent.types.ts";
import type { WorkspaceStyleLibrary } from "../../types/common.ts";

export const STUDIO_USER_ASSET_STATE_VERSION = 5;
export const STUDIO_MAIN_BRAIN_ASSET_VERSION = 1;
export const STUDIO_MAIN_BRAIN_SOUL_ASSET_VERSION = 1;
export const STUDIO_MAIN_BRAIN_USER_ASSET_VERSION = 1;
export const STUDIO_MAIN_BRAIN_WORKFLOW_ASSET_VERSION = 1;
export const STUDIO_MAIN_BRAIN_MEMORY_ASSET_VERSION = 1;
export const STUDIO_MAIN_BRAIN_HEARTBEAT_ASSET_VERSION = 1;
export const STUDIO_MAIN_BRAIN_BOOTSTRAP_ASSET_VERSION = 1;
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

export type StudioStyleLibraryCandidateStatus =
  | "draft"
  | "ready_for_test"
  | "ready_to_save";

export interface StudioStyleLibraryCandidateAsset extends WorkspaceStyleLibrary {
  id: string;
  slug: string;
  schemaVersion: StudioAssetVersion;
  status: StudioStyleLibraryCandidateStatus;
  sourcePreviewKey?: string;
  sourcePreviewType?: "case" | "template";
  sourceMode?: "default" | "poster-product" | "custom";
  createdAt: number;
  updatedAt: number;
}

export interface StudioMainBrainPreferencesAsset {
  schemaVersion: StudioAssetVersion;
  updatedAt: number;
  lines: string[];
}

export interface StudioUserProfileAsset {
  schemaVersion: StudioAssetVersion;
  updatedAt: number;
  avatarUrl: string;
  preferenceNotes: string[];
  commonTasks: string[];
  aestheticPreferences: string[];
  brandContextNotes: string[];
  memoryNotes: string[];
}

export interface StudioMainBrainSoulAsset {
  schemaVersion: StudioAssetVersion;
  updatedAt: number;
  persona: string;
  tone: string[];
  workingStyle: string[];
  restraintRules: string[];
  selfCheckRules: string[];
  riskPreference: "balanced" | "conservative" | "aggressive";
}

export interface StudioMainBrainUserAsset {
  schemaVersion: StudioAssetVersion;
  updatedAt: number;
  goals: string[];
  workingHabits: string[];
  businessContext: string[];
  aestheticPreferences: string[];
  communicationStyle: string[];
  permanentNotes: string[];
  memoryBlacklist: string[];
}

export type StudioMainBrainAnalysisDepth =
  | "light"
  | "balanced"
  | "deep";

export type StudioMainBrainSearchPolicy =
  | "never"
  | "auto"
  | "prefer";

export interface StudioMainBrainWorkflowRoleGovernanceDefaults {
  mode: "manual_only" | "approval_required" | "auto_manage";
  allowDraft: boolean;
  allowAutoPromote: boolean;
  allowAutoArchive: boolean;
}

export interface StudioMainBrainWorkflowAsset {
  schemaVersion: StudioAssetVersion;
  updatedAt: number;
  defaultAnalysisDepth: StudioMainBrainAnalysisDepth;
  searchPolicy: StudioMainBrainSearchPolicy;
  clarifyBeforeExecution: boolean;
  toolUseGuidelines: string[];
  failureRecoveryRules: string[];
  roleGovernanceDefaults: StudioMainBrainWorkflowRoleGovernanceDefaults;
}

export type StudioMainBrainMemoryCategory =
  | "preference"
  | "background"
  | "aesthetic"
  | "boundary"
  | "project_fact"
  | "workflow"
  | "governance";

export type StudioMainBrainMemorySource =
  | "conversation"
  | "user_explicit"
  | "task_summary"
  | "heartbeat"
  | "manual";

export type StudioMainBrainMemoryStatus =
  | "candidate"
  | "active"
  | "dismissed";

export interface StudioMainBrainMemoryRecord {
  id: string;
  schemaVersion: StudioAssetVersion;
  createdAt: number;
  updatedAt: number;
  category: StudioMainBrainMemoryCategory;
  source: StudioMainBrainMemorySource;
  status: StudioMainBrainMemoryStatus;
  summary: string;
  detail: string;
  evidence: string[];
  tags: string[];
  topicId?: string;
}

export interface StudioMainBrainMemoryRetentionPolicy {
  maxActiveMemories: number;
  maxCandidateMemories: number;
  autoPromoteSimilarCount: number;
}

export interface StudioMainBrainMemoryAsset {
  schemaVersion: StudioAssetVersion;
  updatedAt: number;
  memoryIndex: string[];
  memoryRecords: Record<string, StudioMainBrainMemoryRecord>;
  pendingMemoryCandidates: string[];
  memoryBlacklists: string[];
  retentionPolicy: StudioMainBrainMemoryRetentionPolicy;
  dailySummary: string[];
}

export type StudioMainBrainHeartbeatCadence =
  | "manual"
  | "daily"
  | "weekly";

export type StudioMainBrainHeartbeatTaskType =
  | "preference_compaction"
  | "failure_summary"
  | "memory_review_reminder"
  | "role_staleness_check"
  | "rule_conflict_check";

export interface StudioMainBrainHeartbeatTask {
  id: string;
  type: StudioMainBrainHeartbeatTaskType;
  title: string;
  enabled: boolean;
  cadence: StudioMainBrainHeartbeatCadence;
  scope: string[];
  lastRunAt: number | null;
  nextRunAt: number | null;
  lastSummary: string;
}

export interface StudioMainBrainHeartbeatAsset {
  schemaVersion: StudioAssetVersion;
  updatedAt: number;
  enabled: boolean;
  cadence: StudioMainBrainHeartbeatCadence;
  scope: string[];
  heartbeatTasks: Record<string, StudioMainBrainHeartbeatTask>;
  recentRunSummary: string[];
  lastRunAt: number | null;
  nextRunAt: number | null;
}

export interface StudioMainBrainBootstrapAsset {
  schemaVersion: StudioAssetVersion;
  updatedAt: number;
  initialized: boolean;
  initializedAt: number | null;
  sourceTemplate: string;
  completedSteps: string[];
  lastRebootstrapAt: number | null;
}

export interface StudioImageModelPostPathConfig {
  withReferences: string;
  withoutReferences: string;
}

export interface StudioWorkspacePreferencesAsset {
  schemaVersion: StudioAssetVersion;
  updatedAt: number;
  chatModelMode: "thinking" | "fast";
  chatWebEnabled: boolean;
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
  frontstageSkillRuntimeConfigs?: Record<string, Record<string, unknown>>;
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
  version: 5;
  updatedAt: number;
  mainBrainPreferences: StudioMainBrainPreferencesAsset;
  mainBrainSoul: StudioMainBrainSoulAsset;
  mainBrainUser: StudioMainBrainUserAsset;
  mainBrainWorkflow: StudioMainBrainWorkflowAsset;
  mainBrainMemory: StudioMainBrainMemoryAsset;
  mainBrainHeartbeat: StudioMainBrainHeartbeatAsset;
  mainBrainBootstrap: StudioMainBrainBootstrapAsset;
  userProfile: StudioUserProfileAsset;
  workspacePreferences: StudioWorkspacePreferencesAsset;
  skillPreferences: StudioSkillPreferencesAsset;
  pluginPreferences: StudioPluginPreferencesAsset;
  agentPromptAddons: StudioUserPromptAddonMap;
  latestRoleDrafts: StudioUserRoleDraftMap;
  roles: Record<string, StudioRoleEntity>;
  temporaryRoleDrafts: Record<string, StudioTemporaryRoleDraft>;
  roleVersions: Record<string, StudioRoleVersionRecord[]>;
  roleAuditEntries: Record<string, StudioRoleVersionRecord[]>;
  styleLibraries: Record<string, StudioStoredStyleLibrary>;
  styleLibraryCandidates: Record<string, StudioStyleLibraryCandidateAsset>;
  evolutionRecords: Record<string, StudioEvolutionRecord>;
}

export type StudioUserAssetAuditAction =
  | "update"
  | "remove"
  | "review"
  | "rollback";

export type StudioUserAssetAuditTargetKind =
  | "main-brain"
  | "main-brain-soul"
  | "main-brain-user"
  | "main-brain-workflow"
  | "main-brain-memory"
  | "main-brain-heartbeat"
  | "main-brain-bootstrap"
  | "user-profile"
  | "workspace-preference"
  | "skill-preference"
  | "plugin-preference"
  | "agent-role-addon"
  | "role-draft"
  | "role-entity"
  | "temporary-role-draft"
  | "role-version"
  | "style-library"
  | "style-library-candidate"
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
