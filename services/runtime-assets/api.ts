import type {
  AgentRoleDraft,
  AgentType,
  StudioRoleEntity,
  StudioRoleVersionRecord,
  StudioTemporaryRoleDraft,
} from "../../types/agent.types";
import type { WorkspaceStyleLibrary } from "../../types/common";
import { createLocalStudioUserAssetApi } from "./local-user-assets.ts";
import { createRemoteStudioUserAssetApi } from "./remote-user-assets.ts";
import type {
  StudioEvolutionApprovalStatus,
  StudioEvolutionRecord,
  StudioMainBrainBootstrapAsset,
  StudioMainBrainHeartbeatAsset,
  StudioMainBrainMemoryAsset,
  StudioMainBrainSoulAsset,
  StudioMainBrainUserAsset,
  StudioMainBrainWorkflowAsset,
  StudioUserAssetAuditEntry,
  StudioPluginPreferencesAsset,
  StudioSkillPreferencesAsset,
  StudioUserProfileAsset,
  StudioWorkspacePreferencesAsset,
  StudioStoredStyleLibrary,
  StudioStoredRoleDraft,
  StudioUserAssetState,
} from "./user-asset-types.ts";

export interface StudioUserAssetApi {
  getSnapshot(): StudioUserAssetState;
  getMainBrainPreferences(): string[];
  setMainBrainPreferences(lines: string[]): StudioUserAssetState;
  getMainBrainSoul(): StudioMainBrainSoulAsset;
  setMainBrainSoul(
    patch: Partial<Omit<StudioMainBrainSoulAsset, "schemaVersion" | "updatedAt">>,
  ): StudioUserAssetState;
  getMainBrainUser(): StudioMainBrainUserAsset;
  setMainBrainUser(
    patch: Partial<Omit<StudioMainBrainUserAsset, "schemaVersion" | "updatedAt">>,
  ): StudioUserAssetState;
  getMainBrainWorkflow(): StudioMainBrainWorkflowAsset;
  setMainBrainWorkflow(
    patch: Partial<
      Omit<StudioMainBrainWorkflowAsset, "schemaVersion" | "updatedAt">
    >,
  ): StudioUserAssetState;
  getMainBrainMemory(): StudioMainBrainMemoryAsset;
  setMainBrainMemory(
    patch: Partial<Omit<StudioMainBrainMemoryAsset, "schemaVersion" | "updatedAt">>,
  ): StudioUserAssetState;
  getMainBrainHeartbeat(): StudioMainBrainHeartbeatAsset;
  setMainBrainHeartbeat(
    patch: Partial<
      Omit<StudioMainBrainHeartbeatAsset, "schemaVersion" | "updatedAt">
    >,
  ): StudioUserAssetState;
  getMainBrainBootstrap(): StudioMainBrainBootstrapAsset;
  setMainBrainBootstrap(
    patch: Partial<
      Omit<StudioMainBrainBootstrapAsset, "schemaVersion" | "updatedAt">
    >,
  ): StudioUserAssetState;
  getUserProfile(): StudioUserProfileAsset;
  setUserProfile(
    patch: Partial<Omit<StudioUserProfileAsset, "schemaVersion" | "updatedAt">>,
  ): StudioUserAssetState;
  getWorkspacePreferences(): StudioWorkspacePreferencesAsset;
  setWorkspacePreferences(
    patch: Partial<
      Omit<StudioWorkspacePreferencesAsset, "schemaVersion" | "updatedAt">
    >,
  ): StudioUserAssetState;
  getSkillPreferences(): StudioSkillPreferencesAsset;
  setSkillPreferences(
    patch: Partial<
      Omit<StudioSkillPreferencesAsset, "schemaVersion" | "updatedAt">
    >,
  ): StudioUserAssetState;
  getPluginPreferences(): StudioPluginPreferencesAsset;
  setPluginPreferences(
    patch: Partial<
      Omit<StudioPluginPreferencesAsset, "schemaVersion" | "updatedAt">
    >,
  ): StudioUserAssetState;
  getAgentPromptAddon(agentId: AgentType): string;
  setAgentPromptAddon(
    agentId: AgentType,
    value: string,
  ): StudioUserAssetState;
  clearAgentPromptAddon(agentId: AgentType): StudioUserAssetState;
  getLatestRoleDraft(agentId: AgentType): StudioStoredRoleDraft | null;
  saveLatestRoleDraft(
    agentId: AgentType,
    draft: Partial<AgentRoleDraft> | null | undefined,
    options?: {
      roleStrategy?: "reuse" | "augment" | "create";
      roleStrategyReason?: string;
    },
  ): StudioUserAssetState;
  clearLatestRoleDraft(agentId: AgentType): StudioUserAssetState;
  listRoles(): StudioRoleEntity[];
  getRoleById(roleId: string): StudioRoleEntity | null;
  saveRole(
    role: Partial<StudioRoleEntity>,
    options?: {
      preferredId?: string;
    },
  ): StudioRoleEntity | null;
  archiveRole(roleId: string): StudioUserAssetState;
  duplicateRole(roleId: string): StudioRoleEntity | null;
  saveTemporaryRoleDraft(
    draft: Partial<StudioTemporaryRoleDraft>,
  ): StudioTemporaryRoleDraft | null;
  promoteTemporaryRole(
    draftId: string,
    options?: {
      targetRoleId?: string | null;
    },
  ): StudioRoleEntity | null;
  listRoleVersions(roleId: string): StudioRoleVersionRecord[];
  rollbackRoleVersion(
    roleId: string,
    version: number,
  ): StudioRoleEntity | null;
  listStyleLibraries(): StudioStoredStyleLibrary[];
  getStyleLibraryById(id: string): StudioStoredStyleLibrary | null;
  saveStyleLibrary(
    library: WorkspaceStyleLibrary,
    options?: {
      sourceMode?: "default" | "poster-product" | "custom";
      preferredId?: string;
    },
  ): StudioStoredStyleLibrary | null;
  removeStyleLibrary(id: string): StudioUserAssetState;
  listEvolutionRecords(): StudioEvolutionRecord[];
  getEvolutionRecordById(id: string): StudioEvolutionRecord | null;
  saveEvolutionRecord(
    record: Partial<
      Omit<
        StudioEvolutionRecord,
        "id" | "schemaVersion" | "createdAt" | "updatedAt" | "approvalStatus"
      >
    >,
    options?: {
      preferredId?: string;
      approvalStatus?: StudioEvolutionApprovalStatus;
      reviewerNote?: string;
    },
  ): StudioEvolutionRecord | null;
  reviewEvolutionRecord(
    id: string,
    decision: {
      approvalStatus: Exclude<StudioEvolutionApprovalStatus, "pending_review">;
      reviewerNote?: string;
    },
  ): StudioUserAssetState;
  listAuditEntries(): StudioUserAssetAuditEntry[];
  getAuditEntryById(id: string): StudioUserAssetAuditEntry | null;
  rollbackToAuditEntry(id: string): StudioUserAssetState;
  replaceSnapshot(
    snapshot: StudioUserAssetState,
    options?: {
      audit?: {
        action?: "update" | "rollback";
        targetKind?: StudioUserAssetAuditEntry["targetKind"];
        targetId?: string;
        summary?: string;
      };
    },
  ): StudioUserAssetState;
}

let studioUserAssetApi: StudioUserAssetApi = createLocalStudioUserAssetApi();

export const getStudioUserAssetApi = (): StudioUserAssetApi => studioUserAssetApi;

export const setStudioUserAssetApi = (nextApi: StudioUserAssetApi): void => {
  studioUserAssetApi = nextApi;
};

export const createStudioUserAssetApi = (options?: {
  mode?: "local" | "remote";
  remote?: {
    endpoint: string;
    fetchImpl?: typeof fetch;
  };
}): StudioUserAssetApi => {
  if (options?.mode === "remote" && options.remote?.endpoint) {
    return createRemoteStudioUserAssetApi(options.remote);
  }
  return createLocalStudioUserAssetApi();
};
