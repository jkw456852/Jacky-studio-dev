import type { AgentRoleDraft, AgentType } from "../../types/agent.types";
import type { ChatMessage, WorkspaceStyleLibrary } from "../../types/common";
import {
  safeLocalStorageRemoveItem,
  safeLocalStorageSetItem,
} from "../../utils/safe-storage.ts";
import type { StudioUserAssetApi } from "./api.ts";
import type {
  StudioEvolutionRecord,
  StudioUserAssetAuditAction,
  StudioUserAssetAuditEntry,
  StudioUserAssetAuditTargetKind,
  StudioPluginPreferenceEntry,
  StudioPluginPreferencesAsset,
  StudioSkillPreferenceSnapshot,
  StudioSkillPreferencesAsset,
  StudioStoredPromptAddonAsset,
  StudioStoredStyleLibrary,
  StudioStoredRoleDraft,
  StudioUserAssetState,
  StudioUserProfileAsset,
  StudioUserPromptAddonMap,
  StudioUserRoleDraftMap,
  StudioWorkspacePreferencesAsset,
} from "./user-asset-types.ts";
import {
  STUDIO_EVOLUTION_ASSET_VERSION as EVOLUTION_VERSION,
  STUDIO_MAIN_BRAIN_ASSET_VERSION as MAIN_BRAIN_VERSION,
  STUDIO_PLUGIN_PREFERENCES_ASSET_VERSION as PLUGIN_PREFERENCES_VERSION,
  STUDIO_ROLE_ADDON_ASSET_VERSION as ROLE_ADDON_VERSION,
  STUDIO_ROLE_DRAFT_ASSET_VERSION as ROLE_DRAFT_VERSION,
  STUDIO_SKILL_PREFERENCES_ASSET_VERSION as SKILL_PREFERENCES_VERSION,
  STUDIO_STYLE_LIBRARY_ASSET_VERSION as STYLE_LIBRARY_VERSION,
  STUDIO_USER_PROFILE_ASSET_VERSION as USER_PROFILE_VERSION,
  STUDIO_USER_ASSET_STATE_VERSION as USER_ASSET_STATE_VERSION,
  STUDIO_WORKSPACE_PREFERENCES_ASSET_VERSION as WORKSPACE_PREFERENCES_VERSION,
} from "./user-asset-types.ts";
import { normalizeMainBrainPreferences } from "./main-brain-shared.ts";

const USER_ASSET_STORAGE_KEY = "studio_user_assets_v1";
const USER_ASSET_AUDIT_STORAGE_KEY = "studio_user_asset_audit_v1";
const LEGACY_AGENT_PROMPT_ADDON_STORAGE_KEY = "agent_role_prompt_addons_v1";
const LEGACY_ROLE_DRAFT_STORAGE_KEY = "agent_role_drafts_v1";
const LEGACY_BROWSER_AGENT_CHAT_ENABLED_STORAGE_KEY =
  "workspace.browser-agent.chat-enabled";
const LEGACY_ACTIVE_QUICK_SKILL_STORAGE_KEY = "workspace_active_quick_skill";
const LEGACY_SELECTED_IMAGE_MODELS_KEY = "setting_image_models";
const LEGACY_SELECTED_VIDEO_MODELS_KEY = "setting_video_models";
const LEGACY_SELECTED_SCRIPT_MODELS_KEY = "setting_script_models";
const LEGACY_IMAGE_MODEL_POST_PATHS_KEY = "setting_image_model_post_paths";
const LEGACY_VISUAL_ORCHESTRATOR_MODEL_KEY =
  "setting_visual_orchestrator_model";
const LEGACY_BROWSER_AGENT_MODEL_KEY = "setting_browser_agent_model";
const LEGACY_VISUAL_ORCHESTRATOR_MAX_REFERENCE_IMAGES_KEY =
  "setting_visual_orchestrator_max_reference_images";
const LEGACY_VISUAL_ORCHESTRATOR_MAX_INLINE_IMAGE_BYTES_MB_KEY =
  "setting_visual_orchestrator_max_inline_image_bytes_mb";
const LEGACY_VISUAL_CONTINUITY_KEY = "setting_visual_continuity";
const LEGACY_SYSTEM_MODERATION_KEY = "setting_system_moderation";
const LEGACY_AUTO_SAVE_KEY = "setting_auto_save";
const LEGACY_CONCURRENT_COUNT_KEY = "setting_concurrent_count";
const LEGACY_AUTO_MODEL_SELECT_KEY = "workspace_auto_model_select";
const LEGACY_PREFERRED_IMAGE_MODEL_KEY = "workspace_preferred_image_model";
const LEGACY_PREFERRED_IMAGE_PROVIDER_ID_KEY =
  "workspace_preferred_image_provider_id";
const LEGACY_PREFERRED_VIDEO_MODEL_KEY = "workspace_preferred_video_model";
const LEGACY_PREFERRED_VIDEO_PROVIDER_ID_KEY =
  "workspace_preferred_video_provider_id";
const LEGACY_PREFERRED_3D_MODEL_KEY = "workspace_preferred_3d_model";

const DEFAULT_SCRIPT_MODEL = "gemini-3.1-flash-lite-preview";
const DEFAULT_IMAGE_MODEL = "gemini-3-pro-image-preview";
const DEFAULT_VIDEO_MODEL = "veo-3.1-fast-generate-preview";
const DEFAULT_VISUAL_ORCHESTRATOR_MODEL = "auto";
const DEFAULT_BROWSER_AGENT_MODEL = "auto";
const DEFAULT_VISUAL_ORCHESTRATOR_MAX_REFERENCE_IMAGES = 0;
const DEFAULT_VISUAL_ORCHESTRATOR_MAX_INLINE_IMAGE_BYTES_MB = 48;
const DEFAULT_AUTO_IMAGE_OPTION_ID = "Auto";
const MAX_AUDIT_ENTRIES = 12;

const KNOWN_AGENT_IDS: AgentType[] = [
  "coco",
  "vireo",
  "cameron",
  "poster",
  "package",
  "motion",
  "campaign",
  "prompt-optimizer",
];

const KNOWN_AGENT_ID_SET = new Set<AgentType>(KNOWN_AGENT_IDS);

const getLocalStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const isKnownAgentId = (value: string): value is AgentType =>
  KNOWN_AGENT_ID_SET.has(value as AgentType);

const clampInteger = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const readBoolean = (value: unknown, fallback: boolean): boolean => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return fallback;
};

const normalizeStringArray = (value: unknown, limit = 12, maxLength = 180) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, limit);
};

const parseJsonStringArray = (
  raw: string | null,
  fallback: string[],
): string[] => {
  if (!raw) return [...fallback];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...fallback];
    const normalized = parsed
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    return normalized.length > 0 ? normalized : [...fallback];
  } catch {
    return [...fallback];
  }
};

const normalizeImageModelPostPath = (value: unknown): string => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  try {
    if (/^https?:\/\//i.test(raw)) {
      const url = new URL(raw);
      const next = `${url.pathname || ""}${url.search || ""}`.trim();
      return next.startsWith("/") ? next : next ? `/${next}` : "";
    }
  } catch {
    // keep raw fallback
  }

  if (!raw.startsWith("/")) {
    return `/${raw.replace(/^\/+/, "")}`;
  }

  return raw;
};

const normalizeImageModelPostPathMap = (
  raw: unknown,
): Record<string, { withReferences: string; withoutReferences: string }> => {
  if (!raw || typeof raw !== "object") return {};
  return Object.entries(raw as Record<string, unknown>).reduce<
    Record<string, { withReferences: string; withoutReferences: string }>
  >((acc, [key, value]) => {
    const item =
      value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : {};
    const withReferences = normalizeImageModelPostPath(item.withReferences);
    const withoutReferences = normalizeImageModelPostPath(item.withoutReferences);
    if (!withReferences && !withoutReferences) return acc;
    acc[String(key || "").trim()] = {
      withReferences,
      withoutReferences,
    };
    return acc;
  }, {});
};

const parseLegacyImageModelPostPathMap = (
  raw: string | null,
): Record<string, { withReferences: string; withoutReferences: string }> => {
  if (!raw) return {};
  try {
    return normalizeImageModelPostPathMap(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
};

const normalizePromptAddon = (value: unknown): string =>
  String(value || "").trim();

const normalizePromptAddonAsset = (
  agentId: AgentType,
  value: unknown,
): StudioStoredPromptAddonAsset | null => {
  if (typeof value === "string") {
    const normalized = normalizePromptAddon(value);
    if (!normalized) return null;
    return {
      agentId,
      value: normalized,
      schemaVersion: ROLE_ADDON_VERSION,
      updatedAt: Date.now(),
    };
  }
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const normalized = normalizePromptAddon(candidate.value);
  if (!normalized) return null;
  const updatedAt = Number(candidate.updatedAt || Date.now());
  return {
    agentId,
    value: normalized,
    schemaVersion: ROLE_ADDON_VERSION,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
  };
};

const slugify = (value: string): string =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || `style-${Date.now()}`;

const normalizeDraft = (
  draft: Partial<AgentRoleDraft> | null | undefined,
): AgentRoleDraft | null => {
  if (!draft) return null;
  const title = String(draft.title || "").trim();
  const summary = String(draft.summary || "").trim();
  const instructions = Array.isArray(draft.instructions)
    ? draft.instructions
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];
  if (!title && !summary && instructions.length === 0) {
    return null;
  }
  return {
    title,
    summary,
    instructions,
  };
};

const normalizePromptAddonMap = (raw: unknown): StudioUserPromptAddonMap => {
  if (!raw || typeof raw !== "object") return {};
  return Object.entries(raw as Record<string, unknown>).reduce<StudioUserPromptAddonMap>(
    (acc, [key, value]) => {
      if (!isKnownAgentId(key)) return acc;
      const normalized = normalizePromptAddonAsset(key, value);
      if (!normalized) return acc;
      acc[key] = normalized;
      return acc;
    },
    {},
  );
};

const normalizeRoleDraftMap = (raw: unknown): StudioUserRoleDraftMap => {
  if (!raw || typeof raw !== "object") return {};
  return Object.entries(raw as Record<string, unknown>).reduce<StudioUserRoleDraftMap>(
    (acc, [key, value]) => {
      if (!isKnownAgentId(key) || !value || typeof value !== "object")
        return acc;
      const normalizedDraft = normalizeDraft(value as Partial<AgentRoleDraft>);
      if (!normalizedDraft) return acc;
      const candidate = value as Record<string, unknown>;
      acc[key] = {
        agentId: key,
        schemaVersion: ROLE_DRAFT_VERSION,
        updatedAt: Number(candidate.updatedAt || Date.now()),
        roleStrategy:
          candidate.roleStrategy === "augment" ||
          candidate.roleStrategy === "create"
            ? candidate.roleStrategy
            : "reuse",
        roleStrategyReason: String(candidate.roleStrategyReason || "").trim(),
        ...normalizedDraft,
      };
      return acc;
    },
    {},
  );
};

const normalizeUserProfile = (raw: unknown): StudioUserProfileAsset => {
  const value =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const updatedAt = Number(value.updatedAt || Date.now());
  return {
    schemaVersion: USER_PROFILE_VERSION,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
    preferenceNotes: normalizeStringArray(value.preferenceNotes, 24, 180),
    commonTasks: normalizeStringArray(value.commonTasks, 24, 120),
    aestheticPreferences: normalizeStringArray(
      value.aestheticPreferences,
      24,
      140,
    ),
    brandContextNotes: normalizeStringArray(value.brandContextNotes, 24, 180),
    memoryNotes: normalizeStringArray(value.memoryNotes, 24, 180),
  };
};

const normalizeSkillPreferenceSnapshot = (
  raw: unknown,
): StudioSkillPreferenceSnapshot | null => {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = String(value.id || "").trim();
  const name = String(value.name || "").trim();
  const iconName = String(value.iconName || "").trim();
  if (!id || !name || !iconName) return null;
  const config =
    value.config && typeof value.config === "object"
      ? (value.config as Record<string, unknown>)
      : undefined;
  return {
    id,
    name,
    iconName,
    ...(config ? { config } : {}),
  };
};

const normalizeSkillPreferences = (
  raw: unknown,
): StudioSkillPreferencesAsset => {
  const value =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const updatedAt = Number(value.updatedAt || Date.now());
  const customConfigs =
    value.customSkillConfigs && typeof value.customSkillConfigs === "object"
      ? Object.entries(value.customSkillConfigs as Record<string, unknown>).reduce<
          Record<string, Record<string, unknown>>
        >((acc, [key, item]) => {
          if (!item || typeof item !== "object") return acc;
          const normalizedKey = String(key || "").trim();
          if (!normalizedKey) return acc;
          acc[normalizedKey] = item as Record<string, unknown>;
          return acc;
        }, {})
      : {};
  return {
    schemaVersion: SKILL_PREFERENCES_VERSION,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
    activeQuickSkill: normalizeSkillPreferenceSnapshot(value.activeQuickSkill),
    recentSkillIds: normalizeStringArray(value.recentSkillIds, 24, 80),
    pinnedSkillIds: normalizeStringArray(value.pinnedSkillIds, 24, 80),
    customSkillConfigs: customConfigs,
  };
};

const normalizePluginPreferenceEntry = (
  raw: unknown,
): StudioPluginPreferenceEntry | null => {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const pluginId = String(value.pluginId || "").trim();
  if (!pluginId) return null;
  return {
    pluginId,
    enabled: readBoolean(value.enabled, true),
    pinned: readBoolean(value.pinned, false),
    updatedAt: Number(value.updatedAt || Date.now()),
    ...(value.config && typeof value.config === "object"
      ? { config: value.config as Record<string, unknown> }
      : {}),
  };
};

const normalizePluginPreferences = (
  raw: unknown,
): StudioPluginPreferencesAsset => {
  const value =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const updatedAt = Number(value.updatedAt || Date.now());
  const recordsSource =
    value.records && typeof value.records === "object"
      ? (value.records as Record<string, unknown>)
      : {};
  const records = Object.values(recordsSource).reduce<
    Record<string, StudioPluginPreferenceEntry>
  >((acc, item) => {
    const normalized = normalizePluginPreferenceEntry(item);
    if (!normalized) return acc;
    acc[normalized.pluginId] = normalized;
    return acc;
  }, {});
  return {
    schemaVersion: PLUGIN_PREFERENCES_VERSION,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
    records,
  };
};

const normalizeWorkspacePreferences = (
  raw: unknown,
): StudioWorkspacePreferencesAsset => {
  const value =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const updatedAt = Number(value.updatedAt || Date.now());
  const selectedScriptModels = normalizeStringArray(
    value.selectedScriptModels,
    24,
    160,
  );
  const selectedImageModels = normalizeStringArray(
    value.selectedImageModels,
    24,
    160,
  );
  const selectedVideoModels = normalizeStringArray(
    value.selectedVideoModels,
    24,
    160,
  );
  return {
    schemaVersion: WORKSPACE_PREFERENCES_VERSION,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
    selectedScriptModels:
      selectedScriptModels.length > 0
        ? selectedScriptModels
        : [DEFAULT_SCRIPT_MODEL],
    selectedImageModels:
      selectedImageModels.length > 0
        ? selectedImageModels
        : [DEFAULT_AUTO_IMAGE_OPTION_ID],
    selectedVideoModels:
      selectedVideoModels.length > 0
        ? selectedVideoModels
        : [DEFAULT_VIDEO_MODEL],
    imageModelPostPaths: normalizeImageModelPostPathMap(value.imageModelPostPaths),
    visualOrchestratorModel:
      String(value.visualOrchestratorModel || "").trim() ||
      DEFAULT_VISUAL_ORCHESTRATOR_MODEL,
    browserAgentModel:
      String(value.browserAgentModel || "").trim() ||
      DEFAULT_BROWSER_AGENT_MODEL,
    visualOrchestratorMaxReferenceImages: clampInteger(
      value.visualOrchestratorMaxReferenceImages,
      DEFAULT_VISUAL_ORCHESTRATOR_MAX_REFERENCE_IMAGES,
      0,
      64,
    ),
    visualOrchestratorMaxInlineImageBytesMb: clampInteger(
      value.visualOrchestratorMaxInlineImageBytesMb,
      DEFAULT_VISUAL_ORCHESTRATOR_MAX_INLINE_IMAGE_BYTES_MB,
      1,
      64,
    ),
    visualContinuity: readBoolean(value.visualContinuity, true),
    systemModeration: readBoolean(value.systemModeration, false),
    autoSave: readBoolean(value.autoSave, true),
    concurrentCount: clampInteger(value.concurrentCount, 1, 1, 16),
    autoModelSelect: readBoolean(value.autoModelSelect, true),
    preferredImageModel:
      String(value.preferredImageModel || "").trim() || "Nano Banana Pro",
    preferredImageProviderId:
      String(value.preferredImageProviderId || "").trim() || null,
    preferredVideoModel:
      String(value.preferredVideoModel || "").trim() || DEFAULT_VIDEO_MODEL,
    preferredVideoProviderId:
      String(value.preferredVideoProviderId || "").trim() || null,
    preferred3DModel: String(value.preferred3DModel || "").trim() || "Auto",
    browserAgentChatEnabled: readBoolean(value.browserAgentChatEnabled, true),
  };
};

const DEFAULT_WORKSPACE_PREFERENCES = normalizeWorkspacePreferences({});

const arraysEqual = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((item, index) => item === right[index]);

const recordsEqual = (
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean => JSON.stringify(left) === JSON.stringify(right);

const normalizeEvolutionRecord = (raw: unknown): StudioEvolutionRecord | null => {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const title = String(value.title || "").trim().slice(0, 120);
  const summary = String(value.summary || "").trim().slice(0, 280);
  const proposal = String(value.proposal || "").trim().slice(0, 1000);
  if (!title || !summary || !proposal) return null;
  const category = String(value.category || "").trim();
  const source = String(value.source || "").trim();
  const approvalStatus = String(value.approvalStatus || "").trim();
  const id = String(value.id || "").trim() || `evo-${Date.now()}`;
  const createdAt = Number(value.createdAt || Date.now());
  const updatedAt = Number(value.updatedAt || Date.now());
  return {
    id,
    schemaVersion: EVOLUTION_VERSION,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
    category:
      category === "main_brain_preference" ||
      category === "role_strategy" ||
      category === "style_library_strategy" ||
      category === "workflow_strategy"
        ? category
        : "other",
    title,
    summary,
    proposal,
    evidence: normalizeStringArray(value.evidence, 8, 220),
    riskNotes: normalizeStringArray(value.riskNotes, 8, 220),
    source:
      source === "user_feedback" || source === "manual"
        ? source
        : "system_inference",
    approvalStatus:
      approvalStatus === "approved" || approvalStatus === "rejected"
        ? approvalStatus
        : "pending_review",
    reviewerNote:
      String(value.reviewerNote || "").trim().slice(0, 280) || undefined,
  };
};

const normalizeEvolutionRecordMap = (
  raw: unknown,
): Record<string, StudioEvolutionRecord> => {
  if (!raw || typeof raw !== "object") return {};
  return Object.values(raw as Record<string, unknown>).reduce<
    Record<string, StudioEvolutionRecord>
  >((acc, item) => {
    const normalized = normalizeEvolutionRecord(item);
    if (!normalized) return acc;
    acc[normalized.id] = normalized;
    return acc;
  }, {});
};

const normalizeStyleLibrary = (
  raw: unknown,
): StudioStoredStyleLibrary | null => {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const title = String(value.title || "").trim().slice(0, 80);
  const summary = String(value.summary || "").trim().slice(0, 240);
  const referenceInterpretation = String(value.referenceInterpretation || "")
    .trim()
    .slice(0, 280);
  const planningDirectives = Array.isArray(value.planningDirectives)
    ? value.planningDirectives
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const promptDirectives = Array.isArray(value.promptDirectives)
    ? value.promptDirectives
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];
  if (
    !title ||
    !summary ||
    !referenceInterpretation ||
    planningDirectives.length === 0 ||
    promptDirectives.length === 0
  ) {
    return null;
  }
  const id = String(value.id || "").trim() || `style-${Date.now()}`;
  const slug = String(value.slug || "").trim() || slugify(title);
  const createdByRaw = String(value.createdBy || "").trim();
  const createdBy =
    createdByRaw === "system" ||
    createdByRaw === "main-brain" ||
    createdByRaw === "user"
      ? createdByRaw
      : "user";
  const updatedAt = Number(value.updatedAt || Date.now());
  const sourceModeRaw = String(value.sourceMode || "").trim();
  const sourceMode =
    sourceModeRaw === "default" ||
    sourceModeRaw === "poster-product" ||
    sourceModeRaw === "custom"
      ? sourceModeRaw
      : "custom";
  return {
    id,
    slug,
    schemaVersion: STYLE_LIBRARY_VERSION,
    title,
    summary,
    referenceInterpretation,
    planningDirectives,
    promptDirectives,
    createdBy,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
    sourceMode,
  };
};

const normalizeStyleLibraryMap = (
  raw: unknown,
): Record<string, StudioStoredStyleLibrary> => {
  if (!raw || typeof raw !== "object") return {};
  return Object.values(raw as Record<string, unknown>).reduce<
    Record<string, StudioStoredStyleLibrary>
  >((acc, item) => {
    const normalized = normalizeStyleLibrary(item);
    if (!normalized) return acc;
    acc[normalized.id] = normalized;
    return acc;
  }, {});
};

const createEmptyState = (): StudioUserAssetState => ({
  version: USER_ASSET_STATE_VERSION,
  updatedAt: Date.now(),
  mainBrainPreferences: {
    schemaVersion: MAIN_BRAIN_VERSION,
    updatedAt: Date.now(),
    lines: [],
  },
  userProfile: {
    schemaVersion: USER_PROFILE_VERSION,
    updatedAt: Date.now(),
    preferenceNotes: [],
    commonTasks: [],
    aestheticPreferences: [],
    brandContextNotes: [],
    memoryNotes: [],
  },
  workspacePreferences: normalizeWorkspacePreferences({}),
  skillPreferences: normalizeSkillPreferences({}),
  pluginPreferences: normalizePluginPreferences({}),
  agentPromptAddons: {},
  latestRoleDrafts: {},
  styleLibraries: {},
  evolutionRecords: {},
});

const cloneStateSnapshot = (state: StudioUserAssetState): StudioUserAssetState =>
  parseUnifiedState(JSON.stringify(state));

const parseUnifiedState = (raw: string | null): StudioUserAssetState => {
  if (!raw) return createEmptyState();
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const mainBrainRaw = parsed.mainBrainPreferences as
      | Record<string, unknown>
      | undefined;
    const mainBrainUpdatedAt = Number(
      mainBrainRaw?.updatedAt || parsed.updatedAt || Date.now(),
    );
    return {
      version: USER_ASSET_STATE_VERSION,
      updatedAt: Number(parsed.updatedAt || Date.now()),
      mainBrainPreferences: {
        schemaVersion: MAIN_BRAIN_VERSION,
        updatedAt: Number.isFinite(mainBrainUpdatedAt)
          ? mainBrainUpdatedAt
          : Date.now(),
        lines: normalizeMainBrainPreferences(mainBrainRaw?.lines),
      },
      userProfile: normalizeUserProfile(parsed.userProfile),
      workspacePreferences: normalizeWorkspacePreferences(
        parsed.workspacePreferences,
      ),
      skillPreferences: normalizeSkillPreferences(parsed.skillPreferences),
      pluginPreferences: normalizePluginPreferences(parsed.pluginPreferences),
      agentPromptAddons: normalizePromptAddonMap(parsed.agentPromptAddons),
      latestRoleDrafts: normalizeRoleDraftMap(parsed.latestRoleDrafts),
      styleLibraries: normalizeStyleLibraryMap(parsed.styleLibraries),
      evolutionRecords: normalizeEvolutionRecordMap(parsed.evolutionRecords),
    };
  } catch {
    return createEmptyState();
  }
};

const parseLegacyPromptAddonMap = (
  raw: string | null,
): StudioUserPromptAddonMap => {
  if (!raw) return {};
  try {
    return normalizePromptAddonMap(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return {};
  }
};

const parseLegacyRoleDraftMap = (
  raw: string | null,
): StudioUserRoleDraftMap => {
  if (!raw) return {};
  try {
    return normalizeRoleDraftMap(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return {};
  }
};

const parseLegacyQuickSkill = (
  raw: string | null,
): StudioSkillPreferenceSnapshot | null => {
  if (!raw) return null;
  try {
    return normalizeSkillPreferenceSnapshot(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
};

const readLegacyWorkspacePreferences = (
  storage: Storage,
): Partial<StudioWorkspacePreferencesAsset> => ({
  selectedScriptModels: parseJsonStringArray(
    storage.getItem(LEGACY_SELECTED_SCRIPT_MODELS_KEY),
    [DEFAULT_SCRIPT_MODEL],
  ),
  selectedImageModels: parseJsonStringArray(
    storage.getItem(LEGACY_SELECTED_IMAGE_MODELS_KEY),
    [DEFAULT_AUTO_IMAGE_OPTION_ID],
  ),
  selectedVideoModels: parseJsonStringArray(
    storage.getItem(LEGACY_SELECTED_VIDEO_MODELS_KEY),
    [DEFAULT_VIDEO_MODEL],
  ),
  imageModelPostPaths: parseLegacyImageModelPostPathMap(
    storage.getItem(LEGACY_IMAGE_MODEL_POST_PATHS_KEY),
  ),
  visualOrchestratorModel:
    storage.getItem(LEGACY_VISUAL_ORCHESTRATOR_MODEL_KEY) ||
    DEFAULT_VISUAL_ORCHESTRATOR_MODEL,
  browserAgentModel:
    storage.getItem(LEGACY_BROWSER_AGENT_MODEL_KEY) ||
    DEFAULT_BROWSER_AGENT_MODEL,
  visualOrchestratorMaxReferenceImages: clampInteger(
    storage.getItem(LEGACY_VISUAL_ORCHESTRATOR_MAX_REFERENCE_IMAGES_KEY),
    DEFAULT_VISUAL_ORCHESTRATOR_MAX_REFERENCE_IMAGES,
    0,
    64,
  ),
  visualOrchestratorMaxInlineImageBytesMb: clampInteger(
    storage.getItem(LEGACY_VISUAL_ORCHESTRATOR_MAX_INLINE_IMAGE_BYTES_MB_KEY),
    DEFAULT_VISUAL_ORCHESTRATOR_MAX_INLINE_IMAGE_BYTES_MB,
    1,
    64,
  ),
  visualContinuity: readBoolean(
    storage.getItem(LEGACY_VISUAL_CONTINUITY_KEY),
    true,
  ),
  systemModeration: readBoolean(
    storage.getItem(LEGACY_SYSTEM_MODERATION_KEY),
    false,
  ),
  autoSave: readBoolean(storage.getItem(LEGACY_AUTO_SAVE_KEY), true),
  concurrentCount: clampInteger(
    storage.getItem(LEGACY_CONCURRENT_COUNT_KEY),
    1,
    1,
    16,
  ),
  autoModelSelect: readBoolean(
    storage.getItem(LEGACY_AUTO_MODEL_SELECT_KEY),
    true,
  ),
  preferredImageModel:
    String(storage.getItem(LEGACY_PREFERRED_IMAGE_MODEL_KEY) || "").trim() ||
    "Nano Banana Pro",
  preferredImageProviderId:
    String(storage.getItem(LEGACY_PREFERRED_IMAGE_PROVIDER_ID_KEY) || "").trim() ||
    null,
  preferredVideoModel:
    String(storage.getItem(LEGACY_PREFERRED_VIDEO_MODEL_KEY) || "").trim() ||
    DEFAULT_VIDEO_MODEL,
  preferredVideoProviderId:
    String(storage.getItem(LEGACY_PREFERRED_VIDEO_PROVIDER_ID_KEY) || "").trim() ||
    null,
  preferred3DModel:
    String(storage.getItem(LEGACY_PREFERRED_3D_MODEL_KEY) || "").trim() || "Auto",
  browserAgentChatEnabled: readBoolean(
    storage.getItem(LEGACY_BROWSER_AGENT_CHAT_ENABLED_STORAGE_KEY),
    true,
  ),
});

const mergePromptAddons = (
  base: StudioUserPromptAddonMap,
  fallback: StudioUserPromptAddonMap,
): StudioUserPromptAddonMap => {
  const next: StudioUserPromptAddonMap = { ...base };
  for (const agentId of KNOWN_AGENT_IDS) {
    if (!next[agentId] && fallback[agentId]) {
      next[agentId] = fallback[agentId];
    }
  }
  return next;
};

const mergeRoleDrafts = (
  base: StudioUserRoleDraftMap,
  fallback: StudioUserRoleDraftMap,
): StudioUserRoleDraftMap => {
  const next: StudioUserRoleDraftMap = { ...base };
  for (const agentId of KNOWN_AGENT_IDS) {
    const current = next[agentId];
    const legacy = fallback[agentId];
    if (!legacy) continue;
    if (!current || legacy.updatedAt > current.updatedAt) {
      next[agentId] = legacy;
    }
  }
  return next;
};

const mergeWorkspacePreferences = (
  base: StudioWorkspacePreferencesAsset,
  fallback: Partial<StudioWorkspacePreferencesAsset>,
): StudioWorkspacePreferencesAsset =>
  normalizeWorkspacePreferences({
    ...fallback,
    ...base,
    selectedScriptModels:
      fallback.selectedScriptModels &&
      !arraysEqual(
        fallback.selectedScriptModels,
        DEFAULT_WORKSPACE_PREFERENCES.selectedScriptModels,
      ) &&
      arraysEqual(
        base.selectedScriptModels,
        DEFAULT_WORKSPACE_PREFERENCES.selectedScriptModels,
      )
        ? fallback.selectedScriptModels
        : base.selectedScriptModels,
    selectedImageModels:
      fallback.selectedImageModels &&
      !arraysEqual(
        fallback.selectedImageModels,
        DEFAULT_WORKSPACE_PREFERENCES.selectedImageModels,
      ) &&
      arraysEqual(
        base.selectedImageModels,
        DEFAULT_WORKSPACE_PREFERENCES.selectedImageModels,
      )
        ? fallback.selectedImageModels
        : base.selectedImageModels,
    selectedVideoModels:
      fallback.selectedVideoModels &&
      !arraysEqual(
        fallback.selectedVideoModels,
        DEFAULT_WORKSPACE_PREFERENCES.selectedVideoModels,
      ) &&
      arraysEqual(
        base.selectedVideoModels,
        DEFAULT_WORKSPACE_PREFERENCES.selectedVideoModels,
      )
        ? fallback.selectedVideoModels
        : base.selectedVideoModels,
    imageModelPostPaths: {
      ...(fallback.imageModelPostPaths || {}),
      ...(base.imageModelPostPaths || {}),
    },
    visualOrchestratorModel:
      fallback.visualOrchestratorModel &&
      fallback.visualOrchestratorModel !==
        DEFAULT_WORKSPACE_PREFERENCES.visualOrchestratorModel &&
      base.visualOrchestratorModel ===
        DEFAULT_WORKSPACE_PREFERENCES.visualOrchestratorModel
        ? fallback.visualOrchestratorModel
        : base.visualOrchestratorModel,
    browserAgentModel:
      fallback.browserAgentModel &&
      fallback.browserAgentModel !== DEFAULT_WORKSPACE_PREFERENCES.browserAgentModel &&
      base.browserAgentModel === DEFAULT_WORKSPACE_PREFERENCES.browserAgentModel
        ? fallback.browserAgentModel
        : base.browserAgentModel,
    visualOrchestratorMaxReferenceImages:
      fallback.visualOrchestratorMaxReferenceImages !== undefined &&
      fallback.visualOrchestratorMaxReferenceImages !==
        DEFAULT_WORKSPACE_PREFERENCES.visualOrchestratorMaxReferenceImages &&
      base.visualOrchestratorMaxReferenceImages ===
        DEFAULT_WORKSPACE_PREFERENCES.visualOrchestratorMaxReferenceImages
        ? fallback.visualOrchestratorMaxReferenceImages
        : base.visualOrchestratorMaxReferenceImages,
    visualOrchestratorMaxInlineImageBytesMb:
      fallback.visualOrchestratorMaxInlineImageBytesMb !== undefined &&
      fallback.visualOrchestratorMaxInlineImageBytesMb !==
        DEFAULT_WORKSPACE_PREFERENCES.visualOrchestratorMaxInlineImageBytesMb &&
      base.visualOrchestratorMaxInlineImageBytesMb ===
        DEFAULT_WORKSPACE_PREFERENCES.visualOrchestratorMaxInlineImageBytesMb
        ? fallback.visualOrchestratorMaxInlineImageBytesMb
        : base.visualOrchestratorMaxInlineImageBytesMb,
    visualContinuity:
      fallback.visualContinuity !== undefined &&
      fallback.visualContinuity !== DEFAULT_WORKSPACE_PREFERENCES.visualContinuity &&
      base.visualContinuity === DEFAULT_WORKSPACE_PREFERENCES.visualContinuity
        ? fallback.visualContinuity
        : base.visualContinuity,
    systemModeration:
      fallback.systemModeration !== undefined &&
      fallback.systemModeration !== DEFAULT_WORKSPACE_PREFERENCES.systemModeration &&
      base.systemModeration === DEFAULT_WORKSPACE_PREFERENCES.systemModeration
        ? fallback.systemModeration
        : base.systemModeration,
    autoSave:
      fallback.autoSave !== undefined &&
      fallback.autoSave !== DEFAULT_WORKSPACE_PREFERENCES.autoSave &&
      base.autoSave === DEFAULT_WORKSPACE_PREFERENCES.autoSave
        ? fallback.autoSave
        : base.autoSave,
    concurrentCount:
      fallback.concurrentCount !== undefined &&
      fallback.concurrentCount !== DEFAULT_WORKSPACE_PREFERENCES.concurrentCount &&
      base.concurrentCount === DEFAULT_WORKSPACE_PREFERENCES.concurrentCount
        ? fallback.concurrentCount
        : base.concurrentCount,
    autoModelSelect:
      fallback.autoModelSelect !== undefined &&
      fallback.autoModelSelect !== DEFAULT_WORKSPACE_PREFERENCES.autoModelSelect &&
      base.autoModelSelect === DEFAULT_WORKSPACE_PREFERENCES.autoModelSelect
        ? fallback.autoModelSelect
        : base.autoModelSelect,
    preferredImageModel:
      fallback.preferredImageModel &&
      fallback.preferredImageModel !==
        DEFAULT_WORKSPACE_PREFERENCES.preferredImageModel &&
      base.preferredImageModel === DEFAULT_WORKSPACE_PREFERENCES.preferredImageModel
        ? fallback.preferredImageModel
        : base.preferredImageModel,
    preferredImageProviderId:
      fallback.preferredImageProviderId &&
      fallback.preferredImageProviderId !==
        DEFAULT_WORKSPACE_PREFERENCES.preferredImageProviderId &&
      base.preferredImageProviderId ===
        DEFAULT_WORKSPACE_PREFERENCES.preferredImageProviderId
        ? fallback.preferredImageProviderId
        : base.preferredImageProviderId,
    preferredVideoModel:
      fallback.preferredVideoModel &&
      fallback.preferredVideoModel !==
        DEFAULT_WORKSPACE_PREFERENCES.preferredVideoModel &&
      base.preferredVideoModel === DEFAULT_WORKSPACE_PREFERENCES.preferredVideoModel
        ? fallback.preferredVideoModel
        : base.preferredVideoModel,
    preferredVideoProviderId:
      fallback.preferredVideoProviderId &&
      fallback.preferredVideoProviderId !==
        DEFAULT_WORKSPACE_PREFERENCES.preferredVideoProviderId &&
      base.preferredVideoProviderId ===
        DEFAULT_WORKSPACE_PREFERENCES.preferredVideoProviderId
        ? fallback.preferredVideoProviderId
        : base.preferredVideoProviderId,
    preferred3DModel:
      fallback.preferred3DModel &&
      fallback.preferred3DModel !== DEFAULT_WORKSPACE_PREFERENCES.preferred3DModel &&
      base.preferred3DModel === DEFAULT_WORKSPACE_PREFERENCES.preferred3DModel
        ? fallback.preferred3DModel
        : base.preferred3DModel,
    browserAgentChatEnabled:
      fallback.browserAgentChatEnabled !== undefined &&
      fallback.browserAgentChatEnabled !==
        DEFAULT_WORKSPACE_PREFERENCES.browserAgentChatEnabled &&
      base.browserAgentChatEnabled ===
        DEFAULT_WORKSPACE_PREFERENCES.browserAgentChatEnabled
        ? fallback.browserAgentChatEnabled
        : base.browserAgentChatEnabled,
  });

const mergeSkillPreferences = (
  base: StudioSkillPreferencesAsset,
  fallback: Partial<StudioSkillPreferencesAsset>,
): StudioSkillPreferencesAsset =>
  normalizeSkillPreferences({
    ...fallback,
    ...base,
    customSkillConfigs: {
      ...(fallback.customSkillConfigs || {}),
      ...(base.customSkillConfigs || {}),
    },
    activeQuickSkill: base.activeQuickSkill || fallback.activeQuickSkill || null,
  });

const mergePluginPreferences = (
  base: StudioPluginPreferencesAsset,
  fallback: Partial<StudioPluginPreferencesAsset>,
): StudioPluginPreferencesAsset =>
  normalizePluginPreferences({
    ...fallback,
    ...base,
    records: {
      ...(fallback.records || {}),
      ...(base.records || {}),
    },
  });

const hasAnyStateValue = (state: StudioUserAssetState): boolean =>
  state.mainBrainPreferences.lines.length > 0 ||
  state.userProfile.preferenceNotes.length > 0 ||
  state.userProfile.commonTasks.length > 0 ||
  state.userProfile.aestheticPreferences.length > 0 ||
  state.userProfile.brandContextNotes.length > 0 ||
  state.userProfile.memoryNotes.length > 0 ||
  Object.keys(state.workspacePreferences.imageModelPostPaths).length > 0 ||
  state.workspacePreferences.selectedScriptModels.length > 0 ||
  state.workspacePreferences.selectedImageModels.length > 0 ||
  state.workspacePreferences.selectedVideoModels.length > 0 ||
  Boolean(state.skillPreferences.activeQuickSkill) ||
  state.skillPreferences.recentSkillIds.length > 0 ||
  state.skillPreferences.pinnedSkillIds.length > 0 ||
  Object.keys(state.skillPreferences.customSkillConfigs).length > 0 ||
  Object.keys(state.pluginPreferences.records).length > 0 ||
  Object.keys(state.agentPromptAddons).length > 0 ||
  Object.keys(state.latestRoleDrafts).length > 0 ||
  Object.keys(state.styleLibraries).length > 0 ||
  Object.keys(state.evolutionRecords).length > 0;

const clearLegacyWorkspacePreferenceKeys = (): void => {
  [
    LEGACY_BROWSER_AGENT_CHAT_ENABLED_STORAGE_KEY,
    LEGACY_ACTIVE_QUICK_SKILL_STORAGE_KEY,
    LEGACY_SELECTED_IMAGE_MODELS_KEY,
    LEGACY_SELECTED_VIDEO_MODELS_KEY,
    LEGACY_SELECTED_SCRIPT_MODELS_KEY,
    LEGACY_IMAGE_MODEL_POST_PATHS_KEY,
    LEGACY_VISUAL_ORCHESTRATOR_MODEL_KEY,
    LEGACY_BROWSER_AGENT_MODEL_KEY,
    LEGACY_VISUAL_ORCHESTRATOR_MAX_REFERENCE_IMAGES_KEY,
    LEGACY_VISUAL_ORCHESTRATOR_MAX_INLINE_IMAGE_BYTES_MB_KEY,
    LEGACY_VISUAL_CONTINUITY_KEY,
    LEGACY_SYSTEM_MODERATION_KEY,
    LEGACY_AUTO_SAVE_KEY,
    LEGACY_CONCURRENT_COUNT_KEY,
    LEGACY_AUTO_MODEL_SELECT_KEY,
    LEGACY_PREFERRED_IMAGE_MODEL_KEY,
    LEGACY_PREFERRED_IMAGE_PROVIDER_ID_KEY,
    LEGACY_PREFERRED_VIDEO_MODEL_KEY,
    LEGACY_PREFERRED_VIDEO_PROVIDER_ID_KEY,
    LEGACY_PREFERRED_3D_MODEL_KEY,
  ].forEach((key) => safeLocalStorageRemoveItem(key));
};

const mirrorWorkspacePreferencesToLegacyKeys = (
  workspacePreferences: StudioWorkspacePreferencesAsset,
): void => {
  safeLocalStorageSetItem(
    LEGACY_SELECTED_SCRIPT_MODELS_KEY,
    JSON.stringify(workspacePreferences.selectedScriptModels),
  );
  safeLocalStorageSetItem(
    LEGACY_SELECTED_IMAGE_MODELS_KEY,
    JSON.stringify(workspacePreferences.selectedImageModels),
  );
  safeLocalStorageSetItem(
    LEGACY_SELECTED_VIDEO_MODELS_KEY,
    JSON.stringify(workspacePreferences.selectedVideoModels),
  );
  safeLocalStorageSetItem(
    LEGACY_IMAGE_MODEL_POST_PATHS_KEY,
    JSON.stringify(workspacePreferences.imageModelPostPaths),
  );
  safeLocalStorageSetItem(
    LEGACY_VISUAL_ORCHESTRATOR_MODEL_KEY,
    workspacePreferences.visualOrchestratorModel ||
      DEFAULT_VISUAL_ORCHESTRATOR_MODEL,
  );
  safeLocalStorageSetItem(
    LEGACY_BROWSER_AGENT_MODEL_KEY,
    workspacePreferences.browserAgentModel || DEFAULT_BROWSER_AGENT_MODEL,
  );
  safeLocalStorageSetItem(
    LEGACY_VISUAL_ORCHESTRATOR_MAX_REFERENCE_IMAGES_KEY,
    String(workspacePreferences.visualOrchestratorMaxReferenceImages),
  );
  safeLocalStorageSetItem(
    LEGACY_VISUAL_ORCHESTRATOR_MAX_INLINE_IMAGE_BYTES_MB_KEY,
    String(workspacePreferences.visualOrchestratorMaxInlineImageBytesMb),
  );
  safeLocalStorageSetItem(
    LEGACY_VISUAL_CONTINUITY_KEY,
    workspacePreferences.visualContinuity ? "true" : "false",
  );
  safeLocalStorageSetItem(
    LEGACY_SYSTEM_MODERATION_KEY,
    workspacePreferences.systemModeration ? "true" : "false",
  );
  safeLocalStorageSetItem(
    LEGACY_AUTO_SAVE_KEY,
    workspacePreferences.autoSave ? "true" : "false",
  );
  safeLocalStorageSetItem(
    LEGACY_CONCURRENT_COUNT_KEY,
    String(workspacePreferences.concurrentCount),
  );
  safeLocalStorageSetItem(
    LEGACY_AUTO_MODEL_SELECT_KEY,
    workspacePreferences.autoModelSelect ? "true" : "false",
  );
  safeLocalStorageSetItem(
    LEGACY_PREFERRED_IMAGE_MODEL_KEY,
    workspacePreferences.preferredImageModel,
  );
  safeLocalStorageSetItem(
    LEGACY_PREFERRED_IMAGE_PROVIDER_ID_KEY,
    workspacePreferences.preferredImageProviderId || "",
  );
  safeLocalStorageSetItem(
    LEGACY_PREFERRED_VIDEO_MODEL_KEY,
    workspacePreferences.preferredVideoModel,
  );
  safeLocalStorageSetItem(
    LEGACY_PREFERRED_VIDEO_PROVIDER_ID_KEY,
    workspacePreferences.preferredVideoProviderId || "",
  );
  safeLocalStorageSetItem(
    LEGACY_PREFERRED_3D_MODEL_KEY,
    workspacePreferences.preferred3DModel,
  );
  safeLocalStorageSetItem(
    LEGACY_BROWSER_AGENT_CHAT_ENABLED_STORAGE_KEY,
    workspacePreferences.browserAgentChatEnabled ? "true" : "false",
  );
};

const mirrorSkillPreferencesToLegacyKeys = (
  skillPreferences: StudioSkillPreferencesAsset,
): void => {
  if (skillPreferences.activeQuickSkill) {
    safeLocalStorageSetItem(
      LEGACY_ACTIVE_QUICK_SKILL_STORAGE_KEY,
      JSON.stringify(skillPreferences.activeQuickSkill),
    );
    return;
  }
  safeLocalStorageRemoveItem(LEGACY_ACTIVE_QUICK_SKILL_STORAGE_KEY);
};

const writeUnifiedState = (state: StudioUserAssetState): void => {
  const nextState: StudioUserAssetState = {
    version: USER_ASSET_STATE_VERSION,
    updatedAt: Date.now(),
    mainBrainPreferences: {
      schemaVersion: MAIN_BRAIN_VERSION,
      updatedAt: Date.now(),
      lines: normalizeMainBrainPreferences(state.mainBrainPreferences.lines),
    },
    userProfile: normalizeUserProfile(state.userProfile),
    workspacePreferences: normalizeWorkspacePreferences(
      state.workspacePreferences,
    ),
    skillPreferences: normalizeSkillPreferences(state.skillPreferences),
    pluginPreferences: normalizePluginPreferences(state.pluginPreferences),
    agentPromptAddons: normalizePromptAddonMap(state.agentPromptAddons),
    latestRoleDrafts: normalizeRoleDraftMap(state.latestRoleDrafts),
    styleLibraries: normalizeStyleLibraryMap(state.styleLibraries),
    evolutionRecords: normalizeEvolutionRecordMap(state.evolutionRecords),
  };

  if (!hasAnyStateValue(nextState)) {
    safeLocalStorageRemoveItem(USER_ASSET_STORAGE_KEY);
    safeLocalStorageRemoveItem(LEGACY_AGENT_PROMPT_ADDON_STORAGE_KEY);
    safeLocalStorageRemoveItem(LEGACY_ROLE_DRAFT_STORAGE_KEY);
    clearLegacyWorkspacePreferenceKeys();
    safeLocalStorageRemoveItem(LEGACY_ACTIVE_QUICK_SKILL_STORAGE_KEY);
    return;
  }

  safeLocalStorageSetItem(USER_ASSET_STORAGE_KEY, JSON.stringify(nextState));
  safeLocalStorageRemoveItem(LEGACY_AGENT_PROMPT_ADDON_STORAGE_KEY);
  safeLocalStorageRemoveItem(LEGACY_ROLE_DRAFT_STORAGE_KEY);
  mirrorWorkspacePreferencesToLegacyKeys(nextState.workspacePreferences);
  mirrorSkillPreferencesToLegacyKeys(nextState.skillPreferences);
};

const normalizeAuditEntry = (
  value: unknown,
): StudioUserAssetAuditEntry | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = String(raw.id || "").trim();
  const createdAt = Number(raw.createdAt || 0);
  const action = String(raw.action || "").trim() as StudioUserAssetAuditAction;
  const targetKind = String(
    raw.targetKind || "",
  ).trim() as StudioUserAssetAuditTargetKind;
  const summary = String(raw.summary || "").trim();
  if (!id || !createdAt || !action || !targetKind || !summary) return null;
  return {
    id,
    schemaVersion: 1,
    createdAt,
    action,
    targetKind,
    ...(String(raw.targetId || "").trim()
      ? { targetId: String(raw.targetId || "").trim() }
      : {}),
    summary,
    snapshot: cloneStateSnapshot(raw.snapshot as StudioUserAssetState),
  };
};

const readAuditEntries = (): StudioUserAssetAuditEntry[] => {
  const storage = getLocalStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(USER_ASSET_AUDIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeAuditEntry(item))
      .filter(Boolean) as StudioUserAssetAuditEntry[];
  } catch {
    return [];
  }
};

const writeAuditEntries = (entries: StudioUserAssetAuditEntry[]): void => {
  if (entries.length === 0) {
    safeLocalStorageRemoveItem(USER_ASSET_AUDIT_STORAGE_KEY);
    return;
  }
  safeLocalStorageSetItem(
    USER_ASSET_AUDIT_STORAGE_KEY,
    JSON.stringify(entries.slice(0, MAX_AUDIT_ENTRIES)),
  );
};

const appendAuditEntry = (input: {
  state: StudioUserAssetState;
  action: StudioUserAssetAuditAction;
  targetKind: StudioUserAssetAuditTargetKind;
  targetId?: string;
  summary: string;
}): void => {
  const nextEntry: StudioUserAssetAuditEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    schemaVersion: 1,
    createdAt: Date.now(),
    action: input.action,
    targetKind: input.targetKind,
    ...(input.targetId ? { targetId: input.targetId } : {}),
    summary: input.summary,
    snapshot: cloneStateSnapshot(input.state),
  };
  writeAuditEntries([nextEntry, ...readAuditEntries()]);
};

const commitUnifiedState = (
  state: StudioUserAssetState,
  audit?: {
    action: StudioUserAssetAuditAction;
    targetKind: StudioUserAssetAuditTargetKind;
    targetId?: string;
    summary: string;
  },
): StudioUserAssetState => {
  writeUnifiedState(state);
  const nextState = readState();
  if (audit?.summary) {
    appendAuditEntry({
      state: nextState,
      action: audit.action,
      targetKind: audit.targetKind,
      targetId: audit.targetId,
      summary: audit.summary,
    });
  }
  return nextState;
};

const readState = (): StudioUserAssetState => {
  const storage = getLocalStorage();
  if (!storage) return createEmptyState();

  const unified = parseUnifiedState(storage.getItem(USER_ASSET_STORAGE_KEY));
  const legacyAddons = parseLegacyPromptAddonMap(
    storage.getItem(LEGACY_AGENT_PROMPT_ADDON_STORAGE_KEY),
  );
  const legacyDrafts = parseLegacyRoleDraftMap(
    storage.getItem(LEGACY_ROLE_DRAFT_STORAGE_KEY),
  );
  const legacyWorkspacePreferences = readLegacyWorkspacePreferences(storage);
  const legacyQuickSkill = parseLegacyQuickSkill(
    storage.getItem(LEGACY_ACTIVE_QUICK_SKILL_STORAGE_KEY),
  );

  const merged: StudioUserAssetState = {
    version: USER_ASSET_STATE_VERSION,
    updatedAt: Math.max(unified.updatedAt, Date.now()),
    mainBrainPreferences: {
      schemaVersion: MAIN_BRAIN_VERSION,
      updatedAt: unified.mainBrainPreferences.updatedAt || Date.now(),
      lines: normalizeMainBrainPreferences(unified.mainBrainPreferences.lines),
    },
    userProfile: normalizeUserProfile(unified.userProfile),
    workspacePreferences: mergeWorkspacePreferences(
      unified.workspacePreferences,
      legacyWorkspacePreferences,
    ),
    skillPreferences: mergeSkillPreferences(unified.skillPreferences, {
      activeQuickSkill: legacyQuickSkill,
    }),
    pluginPreferences: mergePluginPreferences(unified.pluginPreferences, {}),
    agentPromptAddons: mergePromptAddons(unified.agentPromptAddons, legacyAddons),
    latestRoleDrafts: mergeRoleDrafts(unified.latestRoleDrafts, legacyDrafts),
    styleLibraries: normalizeStyleLibraryMap(unified.styleLibraries),
    evolutionRecords: normalizeEvolutionRecordMap(unified.evolutionRecords),
  };

  const shouldMigrateLegacy =
    Object.keys(legacyAddons).length > 0 ||
    Object.keys(legacyDrafts).length > 0 ||
    Boolean(legacyQuickSkill);
  const normalizedUnified = JSON.stringify(unified);
  const normalizedMerged = JSON.stringify(merged);
  if (shouldMigrateLegacy || normalizedUnified !== normalizedMerged) {
    writeUnifiedState(merged);
  }

  return merged;
};

export const createLocalStudioUserAssetApi = (): StudioUserAssetApi => ({
  getSnapshot: () => readState(),

  getMainBrainPreferences: () => [...readState().mainBrainPreferences.lines],

  setMainBrainPreferences: (lines) => {
    const state = readState();
    state.mainBrainPreferences = {
      schemaVersion: MAIN_BRAIN_VERSION,
      updatedAt: Date.now(),
      lines: normalizeMainBrainPreferences(lines),
    };
    return commitUnifiedState(state, {
      action: "update",
      targetKind: "main-brain",
      summary: "Updated durable main-brain preferences.",
    });
  },

  getUserProfile: () => normalizeUserProfile(readState().userProfile),

  setUserProfile: (patch) => {
    const state = readState();
    state.userProfile = normalizeUserProfile({
      ...state.userProfile,
      ...patch,
      updatedAt: Date.now(),
    });
    return commitUnifiedState(state, {
      action: "update",
      targetKind: "user-profile",
      summary: "Updated user profile preferences.",
    });
  },

  getWorkspacePreferences: () =>
    normalizeWorkspacePreferences(readState().workspacePreferences),

  setWorkspacePreferences: (patch) => {
    const state = readState();
    state.workspacePreferences = normalizeWorkspacePreferences({
      ...state.workspacePreferences,
      ...patch,
      updatedAt: Date.now(),
    });
    return commitUnifiedState(state, {
      action: "update",
      targetKind: "workspace-preference",
      summary: "Updated workspace preferences.",
    });
  },

  getSkillPreferences: () =>
    normalizeSkillPreferences(readState().skillPreferences),

  setSkillPreferences: (patch) => {
    const state = readState();
    state.skillPreferences = normalizeSkillPreferences({
      ...state.skillPreferences,
      ...patch,
      updatedAt: Date.now(),
    });
    return commitUnifiedState(state, {
      action: "update",
      targetKind: "skill-preference",
      summary: "Updated skill preferences.",
    });
  },

  getPluginPreferences: () =>
    normalizePluginPreferences(readState().pluginPreferences),

  setPluginPreferences: (patch) => {
    const state = readState();
    state.pluginPreferences = normalizePluginPreferences({
      ...state.pluginPreferences,
      ...patch,
      updatedAt: Date.now(),
    });
    return commitUnifiedState(state, {
      action: "update",
      targetKind: "plugin-preference",
      summary: "Updated plugin preferences.",
    });
  },

  getAgentPromptAddon: (agentId) =>
    normalizePromptAddon(readState().agentPromptAddons[agentId]?.value),

  setAgentPromptAddon: (agentId, value) => {
    const state = readState();
    const normalized = normalizePromptAddon(value);
    if (normalized) {
      state.agentPromptAddons[agentId] = {
        agentId,
        value: normalized,
        schemaVersion: ROLE_ADDON_VERSION,
        updatedAt: Date.now(),
      };
    } else {
      delete state.agentPromptAddons[agentId];
    }
    return commitUnifiedState(state, {
      action: normalized ? "update" : "remove",
      targetKind: "agent-role-addon",
      targetId: agentId,
      summary: normalized
        ? `Updated durable role addon for ${agentId}.`
        : `Removed durable role addon for ${agentId}.`,
    });
  },

  clearAgentPromptAddon: (agentId) => {
    const state = readState();
    delete state.agentPromptAddons[agentId];
    return commitUnifiedState(state, {
      action: "remove",
      targetKind: "agent-role-addon",
      targetId: agentId,
      summary: `Cleared durable role addon for ${agentId}.`,
    });
  },

  getLatestRoleDraft: (agentId) => readState().latestRoleDrafts[agentId] || null,

  saveLatestRoleDraft: (agentId, draft, options) => {
    const state = readState();
    const normalizedDraft = normalizeDraft(draft);
    if (!normalizedDraft) {
      delete state.latestRoleDrafts[agentId];
      return commitUnifiedState(state, {
        action: "remove",
        targetKind: "role-draft",
        targetId: agentId,
        summary: `Removed latest role draft for ${agentId}.`,
      });
    }
    state.latestRoleDrafts[agentId] = {
      agentId,
      schemaVersion: ROLE_DRAFT_VERSION,
      updatedAt: Date.now(),
      roleStrategy:
        options?.roleStrategy === "augment" || options?.roleStrategy === "create"
          ? options.roleStrategy
          : "reuse",
      roleStrategyReason: String(options?.roleStrategyReason || "").trim(),
      ...normalizedDraft,
    };
    return commitUnifiedState(state, {
      action: "update",
      targetKind: "role-draft",
      targetId: agentId,
      summary: `Saved latest role draft for ${agentId}.`,
    });
  },

  clearLatestRoleDraft: (agentId) => {
    const state = readState();
    delete state.latestRoleDrafts[agentId];
    return commitUnifiedState(state, {
      action: "remove",
      targetKind: "role-draft",
      targetId: agentId,
      summary: `Cleared latest role draft for ${agentId}.`,
    });
  },

  listStyleLibraries: () =>
    Object.values(readState().styleLibraries).sort(
      (left, right) => (right.updatedAt || 0) - (left.updatedAt || 0),
    ),

  getStyleLibraryById: (id) => {
    const normalizedId = String(id || "").trim();
    if (!normalizedId) return null;
    return readState().styleLibraries[normalizedId] || null;
  },

  saveStyleLibrary: (library, options) => {
    const normalized = normalizeStyleLibrary({
      ...library,
      id: String(options?.preferredId || "").trim() || undefined,
      slug: slugify(String(library.title || "")),
      sourceMode: options?.sourceMode || "custom",
      createdBy: library.createdBy || "user",
      updatedAt: Date.now(),
    });
    if (!normalized) return null;
    const state = readState();
    state.styleLibraries[normalized.id] = normalized;
    return (
      commitUnifiedState(state, {
        action: "update",
        targetKind: "style-library",
        targetId: normalized.id,
        summary: `Saved style library ${normalized.title}.`,
      }).styleLibraries[normalized.id] || null
    );
  },

  removeStyleLibrary: (id) => {
    const normalizedId = String(id || "").trim();
    const state = readState();
    if (normalizedId) {
      delete state.styleLibraries[normalizedId];
    }
    return commitUnifiedState(state, {
      action: "remove",
      targetKind: "style-library",
      targetId: normalizedId || undefined,
      summary: normalizedId
        ? `Removed style library ${normalizedId}.`
        : "Removed style library entry.",
    });
  },

  listEvolutionRecords: () =>
    Object.values(readState().evolutionRecords).sort(
      (left, right) => (right.updatedAt || 0) - (left.updatedAt || 0),
    ),

  getEvolutionRecordById: (id) => {
    const normalizedId = String(id || "").trim();
    if (!normalizedId) return null;
    return readState().evolutionRecords[normalizedId] || null;
  },

  saveEvolutionRecord: (record, options) => {
    const normalized = normalizeEvolutionRecord({
      ...record,
      id: String(options?.preferredId || "").trim() || undefined,
      approvalStatus: options?.approvalStatus || "pending_review",
      reviewerNote: options?.reviewerNote || "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    if (!normalized) return null;
    const state = readState();
    const existing = state.evolutionRecords[normalized.id];
    state.evolutionRecords[normalized.id] = {
      ...normalized,
      createdAt: existing?.createdAt || normalized.createdAt,
    };
    return (
      commitUnifiedState(state, {
        action: "update",
        targetKind: "evolution-record",
        targetId: normalized.id,
        summary: `Saved evolution record ${normalized.title}.`,
      }).evolutionRecords[normalized.id] || null
    );
  },

  reviewEvolutionRecord: (id, decision) => {
    const normalizedId = String(id || "").trim();
    const state = readState();
    const current = state.evolutionRecords[normalizedId];
    if (!current) {
      return state;
    }
    state.evolutionRecords[normalizedId] = {
      ...current,
      approvalStatus: decision.approvalStatus,
      reviewerNote: String(decision.reviewerNote || "").trim() || undefined,
      updatedAt: Date.now(),
    };
    return commitUnifiedState(state, {
      action: "review",
      targetKind: "evolution-record",
      targetId: normalizedId,
      summary: `Reviewed evolution record ${normalizedId} as ${decision.approvalStatus}.`,
    });
  },

  listAuditEntries: () => readAuditEntries(),

  getAuditEntryById: (id) => {
    const normalizedId = String(id || "").trim();
    if (!normalizedId) return null;
    return readAuditEntries().find((entry) => entry.id === normalizedId) || null;
  },

  rollbackToAuditEntry: (id) => {
    const normalizedId = String(id || "").trim();
    const entry =
      readAuditEntries().find((item) => item.id === normalizedId) || null;
    if (!entry) return readState();
    return commitUnifiedState(cloneStateSnapshot(entry.snapshot), {
      action: "rollback",
      targetKind: "rollback",
      targetId: normalizedId,
      summary: `Rolled back user assets to audit checkpoint ${normalizedId}.`,
    });
  },

  replaceSnapshot: (snapshot, options) =>
    commitUnifiedState(cloneStateSnapshot(snapshot), {
      action: options?.audit?.action || "update",
      targetKind: options?.audit?.targetKind || "workspace-preference",
      targetId: options?.audit?.targetId,
      summary:
        options?.audit?.summary || "Replaced durable studio user asset snapshot.",
    }),
});
