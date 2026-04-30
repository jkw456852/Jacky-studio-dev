import type { AgentRoleDraft, AgentType } from "../../types/agent.types";
import type { WorkspaceStyleLibrary } from "../../types/common";
import type { StudioUserAssetApi } from "./api.ts";
import type {
  StudioEvolutionApprovalStatus,
  StudioEvolutionRecord,
  StudioPluginPreferencesAsset,
  StudioSkillPreferencesAsset,
  StudioStoredRoleDraft,
  StudioStoredStyleLibrary,
  StudioUserAssetAuditEntry,
  StudioUserAssetState,
  StudioUserProfileAsset,
  StudioWorkspacePreferencesAsset,
} from "./user-asset-types.ts";

export type StudioRemoteUserAssetAdapterOptions = {
  endpoint: string;
  fetchImpl?: typeof fetch;
};

type RemoteEnvelope = {
  snapshot: StudioUserAssetState;
  auditEntries: StudioUserAssetAuditEntry[];
};

const createEmptyState = (): StudioUserAssetState => ({
  version: 3,
  updatedAt: Date.now(),
  mainBrainPreferences: {
    schemaVersion: 1,
    updatedAt: Date.now(),
    lines: [],
  },
  userProfile: {
    schemaVersion: 1,
    updatedAt: Date.now(),
    preferenceNotes: [],
    commonTasks: [],
    aestheticPreferences: [],
    brandContextNotes: [],
    memoryNotes: [],
  },
  workspacePreferences: {
    schemaVersion: 1,
    updatedAt: Date.now(),
    selectedScriptModels: ["gemini-3.1-flash-lite-preview"],
    selectedImageModels: ["Auto"],
    selectedVideoModels: ["veo-3.1-fast-generate-preview"],
    imageModelPostPaths: {},
    visualOrchestratorModel: "auto",
    browserAgentModel: "auto",
    visualOrchestratorMaxReferenceImages: 0,
    visualOrchestratorMaxInlineImageBytesMb: 48,
    visualContinuity: true,
    systemModeration: false,
    autoSave: true,
    concurrentCount: 1,
    autoModelSelect: true,
    preferredImageModel: "Nano Banana Pro",
    preferredImageProviderId: null,
    preferredVideoModel: "veo-3.1-fast-generate-preview",
    preferredVideoProviderId: null,
    preferred3DModel: "Auto",
    browserAgentChatEnabled: true,
  },
  skillPreferences: {
    schemaVersion: 1,
    updatedAt: Date.now(),
    activeQuickSkill: null,
    recentSkillIds: [],
    pinnedSkillIds: [],
    customSkillConfigs: {},
  },
  pluginPreferences: {
    schemaVersion: 1,
    updatedAt: Date.now(),
    records: {},
  },
  agentPromptAddons: {},
  latestRoleDrafts: {},
  styleLibraries: {},
  evolutionRecords: {},
});

const clone = <T>(value: T): T => structuredClone(value);

const createAuditEntry = (args: {
  action: StudioUserAssetAuditEntry["action"];
  targetKind: StudioUserAssetAuditEntry["targetKind"];
  targetId?: string;
  summary: string;
  snapshot: StudioUserAssetState;
}): StudioUserAssetAuditEntry => ({
  id: `remote_audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  schemaVersion: 1,
  createdAt: Date.now(),
  action: args.action,
  targetKind: args.targetKind,
  ...(args.targetId ? { targetId: args.targetId } : {}),
  summary: args.summary,
  snapshot: clone(args.snapshot),
});

const ensureFetch = (fetchImpl?: typeof fetch): typeof fetch => {
  const resolved = fetchImpl || globalThis.fetch;
  if (!resolved) {
    throw new Error(
      "Remote StudioUserAssetApi requires fetch. Provide fetchImpl or run in an environment with global fetch.",
    );
  }
  return resolved;
};

const readEnvelope = async (
  endpoint: string,
  fetchImpl: typeof fetch,
): Promise<RemoteEnvelope> => {
  const response = await fetchImpl(endpoint, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(
      `Remote StudioUserAssetApi GET failed: ${response.status} ${response.statusText}`,
    );
  }
  const payload = (await response.json()) as Partial<RemoteEnvelope> | null;
  return {
    snapshot: payload?.snapshot ? clone(payload.snapshot) : createEmptyState(),
    auditEntries: Array.isArray(payload?.auditEntries)
      ? clone(payload!.auditEntries!)
      : [],
  };
};

const writeEnvelope = async (
  endpoint: string,
  fetchImpl: typeof fetch,
  envelope: RemoteEnvelope,
): Promise<RemoteEnvelope> => {
  const response = await fetchImpl(endpoint, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(envelope),
  });
  if (!response.ok) {
    throw new Error(
      `Remote StudioUserAssetApi PUT failed: ${response.status} ${response.statusText}`,
    );
  }
  const payload = (await response.json()) as Partial<RemoteEnvelope> | null;
  return {
    snapshot: payload?.snapshot ? clone(payload.snapshot) : clone(envelope.snapshot),
    auditEntries: Array.isArray(payload?.auditEntries)
      ? clone(payload!.auditEntries!)
      : clone(envelope.auditEntries),
  };
};

const updateRemoteEnvelope = async (
  endpoint: string,
  fetchImpl: typeof fetch,
  mutator: (envelope: RemoteEnvelope) => RemoteEnvelope,
): Promise<RemoteEnvelope> => {
  const current = await readEnvelope(endpoint, fetchImpl);
  return writeEnvelope(endpoint, fetchImpl, mutator(current));
};

const normalizeDraft = (
  agentId: AgentType,
  draft: Partial<AgentRoleDraft> | null | undefined,
  options?: {
    roleStrategy?: "reuse" | "augment" | "create";
    roleStrategyReason?: string;
  },
): StudioStoredRoleDraft | null => {
  if (!draft) return null;
  const title = String(draft.title || "").trim();
  const summary = String(draft.summary || "").trim();
  const instructions = Array.isArray(draft.instructions)
    ? draft.instructions
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];
  if (!title && !summary && instructions.length === 0) return null;
  return {
    agentId,
    title,
    summary,
    instructions,
    schemaVersion: 1,
    updatedAt: Date.now(),
    roleStrategy:
      options?.roleStrategy === "augment" || options?.roleStrategy === "create"
        ? options.roleStrategy
        : "reuse",
    roleStrategyReason: String(options?.roleStrategyReason || "").trim(),
  };
};

const normalizeStyleLibrary = (
  library: WorkspaceStyleLibrary,
  options?: {
    sourceMode?: "default" | "poster-product" | "custom";
    preferredId?: string;
  },
): StudioStoredStyleLibrary | null => {
  const title = String(library.title || "").trim();
  if (!title) return null;
  const id =
    String(options?.preferredId || "").trim() ||
    String((library as { id?: string }).id || "").trim() ||
    `style_${Date.now()}`;
  const slug =
    String((library as { slug?: string }).slug || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "") || id;
  return {
    ...library,
    id,
    slug,
    schemaVersion: 1,
    sourceMode: options?.sourceMode || "custom",
  };
};

export const createRemoteStudioUserAssetApi = (
  options: StudioRemoteUserAssetAdapterOptions,
): StudioUserAssetApi => {
  const endpoint = String(options.endpoint || "").trim();
  const fetchImpl = ensureFetch(options.fetchImpl);
  if (!endpoint) {
    throw new Error("Remote StudioUserAssetApi requires a non-empty endpoint.");
  }

  const getEnvelope = () => readEnvelope(endpoint, fetchImpl);

  const commitSnapshot = async (
    snapshot: StudioUserAssetState,
    audit?: {
      action?: StudioUserAssetAuditEntry["action"];
      targetKind?: StudioUserAssetAuditEntry["targetKind"];
      targetId?: string;
      summary?: string;
    },
  ): Promise<RemoteEnvelope> =>
    updateRemoteEnvelope(endpoint, fetchImpl, (envelope) => {
      const nextSnapshot = clone(snapshot);
      const nextAuditEntries = audit?.summary
        ? [
            createAuditEntry({
              action: audit.action || "update",
              targetKind: audit.targetKind || "workspace-preference",
              targetId: audit.targetId,
              summary: audit.summary,
              snapshot: nextSnapshot,
            }),
            ...envelope.auditEntries,
          ].slice(0, 20)
        : envelope.auditEntries;
      return {
        snapshot: nextSnapshot,
        auditEntries: nextAuditEntries,
      };
    });

  const withSnapshotUpdate = async (
    updater: (snapshot: StudioUserAssetState) => StudioUserAssetState,
    audit: {
      action?: StudioUserAssetAuditEntry["action"];
      targetKind?: StudioUserAssetAuditEntry["targetKind"];
      targetId?: string;
      summary: string;
    },
  ): Promise<StudioUserAssetState> => {
    const current = await getEnvelope();
    const nextSnapshot = updater(clone(current.snapshot));
    return (
      await commitSnapshot(nextSnapshot, {
        action: audit.action,
        targetKind: audit.targetKind,
        targetId: audit.targetId,
        summary: audit.summary,
      })
    ).snapshot;
  };

  return {
    getSnapshot: () => {
      throw new Error("Remote StudioUserAssetApi is async-only. Use getSnapshotAsync-compatible flow or sync through orchestration before direct reads.");
    },

    getMainBrainPreferences: () => {
      throw new Error("Remote StudioUserAssetApi does not support sync reads.");
    },

    setMainBrainPreferences: (lines) => {
      throw new Error(
        `Remote StudioUserAssetApi does not support sync writes. Use replaceSnapshot after async orchestration. Requested lines=${lines.length}.`,
      );
    },

    getUserProfile: () => {
      throw new Error("Remote StudioUserAssetApi does not support sync reads.");
    },

    setUserProfile: (_patch) => {
      throw new Error("Remote StudioUserAssetApi does not support sync writes.");
    },

    getWorkspacePreferences: () => {
      throw new Error("Remote StudioUserAssetApi does not support sync reads.");
    },

    setWorkspacePreferences: (_patch) => {
      throw new Error("Remote StudioUserAssetApi does not support sync writes.");
    },

    getSkillPreferences: () => {
      throw new Error("Remote StudioUserAssetApi does not support sync reads.");
    },

    setSkillPreferences: (_patch) => {
      throw new Error("Remote StudioUserAssetApi does not support sync writes.");
    },

    getPluginPreferences: () => {
      throw new Error("Remote StudioUserAssetApi does not support sync reads.");
    },

    setPluginPreferences: (_patch) => {
      throw new Error("Remote StudioUserAssetApi does not support sync writes.");
    },

    getAgentPromptAddon: (_agentId) => {
      throw new Error("Remote StudioUserAssetApi does not support sync reads.");
    },

    setAgentPromptAddon: (_agentId, _value) => {
      throw new Error("Remote StudioUserAssetApi does not support sync writes.");
    },

    clearAgentPromptAddon: (_agentId) => {
      throw new Error("Remote StudioUserAssetApi does not support sync writes.");
    },

    getLatestRoleDraft: (_agentId) => {
      throw new Error("Remote StudioUserAssetApi does not support sync reads.");
    },

    saveLatestRoleDraft: (agentId, draft, draftOptions) => {
      throw new Error(
        `Remote StudioUserAssetApi does not support sync writes. Persist role draft via replaceSnapshot or a remote orchestration layer. Requested agent=${agentId}, hasDraft=${Boolean(normalizeDraft(agentId, draft, draftOptions))}.`,
      );
    },

    clearLatestRoleDraft: (_agentId) => {
      throw new Error("Remote StudioUserAssetApi does not support sync writes.");
    },

    listStyleLibraries: () => {
      throw new Error("Remote StudioUserAssetApi does not support sync reads.");
    },

    getStyleLibraryById: (_id) => {
      throw new Error("Remote StudioUserAssetApi does not support sync reads.");
    },

    saveStyleLibrary: (library, styleOptions) => {
      throw new Error(
        `Remote StudioUserAssetApi does not support sync writes. Persist style library via replaceSnapshot or a remote orchestration layer. Requested style=${normalizeStyleLibrary(library, styleOptions)?.id || "unknown"}.`,
      );
    },

    removeStyleLibrary: (_id) => {
      throw new Error("Remote StudioUserAssetApi does not support sync writes.");
    },

    listEvolutionRecords: () => {
      throw new Error("Remote StudioUserAssetApi does not support sync reads.");
    },

    getEvolutionRecordById: (_id) => {
      throw new Error("Remote StudioUserAssetApi does not support sync reads.");
    },

    saveEvolutionRecord: (_record, _recordOptions) => {
      throw new Error("Remote StudioUserAssetApi does not support sync writes.");
    },

    reviewEvolutionRecord: (_id, _decision) => {
      throw new Error("Remote StudioUserAssetApi does not support sync writes.");
    },

    listAuditEntries: () => {
      throw new Error("Remote StudioUserAssetApi does not support sync reads.");
    },

    getAuditEntryById: (_id) => {
      throw new Error("Remote StudioUserAssetApi does not support sync reads.");
    },

    rollbackToAuditEntry: (_id) => {
      throw new Error("Remote StudioUserAssetApi does not support sync writes.");
    },

    replaceSnapshot: (snapshot, auditOptions) => {
      throw new Error(
        `Remote StudioUserAssetApi replaceSnapshot is async-only. Use services/runtime-assets/sync-service.ts orchestration with fetch-backed adapter. audit=${auditOptions?.audit?.summary || "none"}`,
      );
    },
  };
};

export const fetchRemoteStudioUserAssetEnvelope = async (
  options: StudioRemoteUserAssetAdapterOptions,
): Promise<RemoteEnvelope> =>
  readEnvelope(String(options.endpoint || "").trim(), ensureFetch(options.fetchImpl));

export const pushRemoteStudioUserAssetEnvelope = async (args: {
  options: StudioRemoteUserAssetAdapterOptions;
  envelope: RemoteEnvelope;
}): Promise<RemoteEnvelope> =>
  writeEnvelope(
    String(args.options.endpoint || "").trim(),
    ensureFetch(args.options.fetchImpl),
    args.envelope,
  );

export const pushRemoteStudioUserAssetSnapshot = async (args: {
  options: StudioRemoteUserAssetAdapterOptions;
  snapshot: StudioUserAssetState;
  audit?: {
    action?: StudioUserAssetAuditEntry["action"];
    targetKind?: StudioUserAssetAuditEntry["targetKind"];
    targetId?: string;
    summary?: string;
  };
}): Promise<RemoteEnvelope> => {
  const current = await fetchRemoteStudioUserAssetEnvelope(args.options);
  const nextSnapshot = clone(args.snapshot);
  const nextAuditEntries = args.audit?.summary
    ? [
        createAuditEntry({
          action: args.audit.action || "update",
          targetKind: args.audit.targetKind || "workspace-preference",
          targetId: args.audit.targetId,
          summary: args.audit.summary,
          snapshot: nextSnapshot,
        }),
        ...current.auditEntries,
      ].slice(0, 20)
    : current.auditEntries;

  return pushRemoteStudioUserAssetEnvelope({
    options: args.options,
    envelope: {
      snapshot: nextSnapshot,
      auditEntries: nextAuditEntries,
    },
  });
};

export const restoreRemoteStudioUserAssetAuditEntry = async (args: {
  options: StudioRemoteUserAssetAdapterOptions;
  auditEntryId: string;
}): Promise<RemoteEnvelope> => {
  const current = await fetchRemoteStudioUserAssetEnvelope(args.options);
  const entry =
    current.auditEntries.find((item) => item.id === String(args.auditEntryId || "").trim()) ||
    null;
  if (!entry) {
    return current;
  }
  return pushRemoteStudioUserAssetSnapshot({
    options: args.options,
    snapshot: entry.snapshot,
    audit: {
      action: "rollback",
      targetKind: "rollback",
      targetId: entry.id,
      summary: `Rolled back remote studio user assets to ${entry.id}.`,
    },
  });
};
