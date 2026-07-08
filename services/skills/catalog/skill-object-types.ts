import type { ChatMessage } from "../../../types";
import type {
  StudioFrontstageSkillPresetCategory,
  StudioFrontstageSkillPresetExecutionType,
  StudioFrontstageSkillPresetFollowUpMode,
  StudioFrontstageSkillPresetTab,
} from "../../runtime-assets/types.ts";

export type JsonSchema = Record<string, unknown>;

export type ExecutionRecipeStep = string | Record<string, unknown>;

export type ToolPolicyRule = string | Record<string, unknown>;

export interface RetryPolicy extends Record<string, unknown> {
  strategy?: "retry";
  maxAttempts?: number;
}

export interface FallbackPolicy extends Record<string, unknown> {
  strategy?:
    | "skip"
    | "retry"
    | "degrade-to-chat"
    | "switch-provider"
    | "switch-skill"
    | "abort";
}

export type SkillManifest = {
  kind: "tool-skill" | "workflow-skill" | "agent-skill";
  identity: {
    key: string;
    displayName: string;
    namespace?: string;
  };
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema;
  ui: {
    iconName?: string;
    category?: string;
    activationHint?: string;
    instruction?: string;
    requiresAttachments?: boolean;
  };
  routing: {
    mode: "manual" | "autonomous" | "hybrid";
    routeIntent?: string;
    routeLabel?: string;
    routeSummary?: string;
    taskMode?: "chat" | "research" | "generate" | "edit" | string;
    followUpMode?: "auto-clarify" | "direct-run";
    clarifyChecklist?: string[];
    reusableQuestions?: string[];
  };
  execution: {
    executorType: "skill-call" | "workflow-recipe" | "agent-plan";
    preferredSkills?: string[];
    blockedSkills?: string[];
    preferredFirstSkill?: string;
    recipe?: ExecutionRecipeStep[];
    toolPolicy?: ToolPolicyRule[];
    retryPolicy?: RetryPolicy;
    fallbackPolicy?: FallbackPolicy;
    timeoutMs?: number;
  };
  outputContract: {
    blueprint?: string[];
    artifactTypes?: string[];
    completionCriteria?: string[];
    executionOutline?: string[];
  };
  permissions: {
    needsWeb?: boolean;
    needsWorkspaceSearch?: boolean;
    needsFileWrite?: boolean;
    needsExternalProvider?: boolean;
    allowedProviders?: string[];
  };
  observability: {
    traceLevel: "basic" | "verbose";
    saveInputs: boolean;
    saveOutputs: boolean;
    saveIntermediateCalls: boolean;
  };
  dependencies?: {
    skills?: string[];
    providers?: string[];
    plugins?: string[];
  };
};

export type SkillDefinition = {
  id: string;
  key: string;
  name: string;
  summary: string;
  description?: string;
  ownerType: "system" | "workspace" | "user";
  ownerId: string;
  sourceType: "builtin" | "distilled" | "imported" | "plugin";
  currentDraftVersionId?: string;
  currentPublishedVersionId?: string;
  defaultPresetId?: string;
  tags: string[];
  status: "active" | "disabled" | "archived";
  createdAt: number;
  updatedAt: number;
};

export type SkillVersion = {
  id: string;
  skillDefinitionId: string;
  semver: string;
  manifest: SkillManifest;
  changelog?: string;
  sourceSnapshot?: {
    fromConversationId?: string;
    fromMessageIds?: string[];
    distillationMethod?: string;
  };
  reviewStatus: "draft" | "reviewing" | "approved" | "rejected";
  releaseStatus: "draft" | "published" | "deprecated" | "rolled_back";
  publishedAt?: number;
  publishedBy?: string;
  createdAt: number;
  createdBy: string;
};

export type SkillPreset = {
  id: string;
  skillDefinitionId: string;
  pinnedLocation: "sidebar" | "skill-book" | "hidden";
  label: string;
  description?: string;
  iconName?: string;
  tab?: "video" | "social" | "commerce" | "branding" | "general";
  order?: number;
  frontstagePriority?: "primary" | "secondary";
  visibleToRoles?: string[];
  createdAt: number;
  updatedAt: number;
};

export type SkillRun = {
  id: string;
  conversationId?: string;
  messageId?: string;
  skillDefinitionId: string;
  skillVersionId: string;
  presetId?: string;
  triggerMode: "manual" | "default-assistant" | "api" | "replay";
  status:
    | "queued"
    | "clarifying"
    | "planning"
    | "running"
    | "succeeded"
    | "failed"
    | "cancelled";
  input: {
    prompt: string;
    attachments?: Array<Record<string, unknown>>;
    contextSnapshot?: unknown;
  };
  compiledPlan?: Record<string, unknown>;
  actualCalls?: Array<Record<string, unknown>>;
  output?: {
    text?: string;
    artifacts?: Array<Record<string, unknown>>;
    structured?: unknown;
  };
  clarifyEvents?: Array<Record<string, unknown>>;
  repairEvents?: Array<Record<string, unknown>>;
  fallbackEvents?: Array<Record<string, unknown>>;
  error?: {
    code: string;
    message: string;
    stage?: string;
  };
  metrics?: {
    latencyMs?: number;
    tokensIn?: number;
    tokensOut?: number;
    clarifyRounds?: number;
    fallbackCount?: number;
  };
  auditRefIds?: string[];
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
};

export type SkillExampleSet = {
  id: string;
  skillVersionId: string;
  examples: Array<{
    prompt: string;
    summary?: string;
    output?: string;
    artifacts?: string[];
  }>;
};

export type SkillPerformanceOverlay = {
  skillDefinitionId: string;
  successfulRuns: number;
  failedRuns: number;
  lastSuccessfulAt?: number;
  lastFailedAt?: number;
  commonErrorCodes?: string[];
};

export type LegacySkillCatalogEntry = {
  definition: SkillDefinition;
  version: SkillVersion;
  preset: SkillPreset;
  legacyMetadata: {
    source: "frontstage-preset" | "custom-skill";
    skillData: NonNullable<ChatMessage["skillData"]>;
    frontstagePreset?: {
      id: string;
      category: StudioFrontstageSkillPresetCategory;
      tab: StudioFrontstageSkillPresetTab;
      frontstagePriority: "primary" | "secondary";
      executionType: StudioFrontstageSkillPresetExecutionType;
      activationHint: string;
      requiresAttachments?: boolean;
      followUpMode?: StudioFrontstageSkillPresetFollowUpMode;
      notes?: string;
      research?: string;
      tags?: string[];
      sources?: string[];
    };
    customSkill?: {
      id: string;
      sourceStatus:
        | "markdown-backed"
        | "runtime-only"
        | "missing-markdown-asset";
      lastUsedAt?: number;
    };
  };
  performanceOverlay?: SkillPerformanceOverlay;
  exampleSet?: SkillExampleSet;
};
