import type { AgentInfo, AgentType } from "../../types/agent.types.ts";
import type { WorkspaceBuiltInStyleLibraryMode } from "../vision-orchestrator/style-library.ts";
import type { WorkspaceStyleLibrary } from "../../types/common.ts";

export interface StudioAgentRoleProfile {
  agentId: AgentType;
  purpose: string;
  useWhen: string[];
  avoidWhen: string[];
  adaptWhen: string[];
  dynamicRolePolicy: string;
}

export interface StudioAgentAsset {
  id: AgentType;
  info: AgentInfo;
  roleProfile: StudioAgentRoleProfile;
  systemPrompt: string;
  promptTemplate: string;
  notes?: string;
  tags?: string[];
}

export interface StudioSpecializationAsset {
  id: string;
  info: Omit<AgentInfo, "id"> & { id?: string };
  systemPrompt: string;
  promptTemplate: string;
  ownerAgentId: AgentType;
  notes?: string;
  tags?: string[];
}

export interface StudioStyleLibraryAsset {
  mode: WorkspaceBuiltInStyleLibraryMode;
  label: string;
  hint: string;
  library: WorkspaceStyleLibrary;
  notes?: string;
}

export interface StudioPluginAsset {
  id: string;
  name: string;
  label: string;
  description: string;
  category: "quick-skill" | "workflow" | "integration" | "other";
  skillId?: string;
  defaultEnabled?: boolean;
  defaultPinned?: boolean;
  notes?: string;
  tags?: string[];
}

export type StudioFrontstageSkillPresetCategory =
  | "workflow"
  | "agent"
  | "edit"
  | "research";

export type StudioFrontstageSkillPresetExecutionType =
  | "agent"
  | "workflow"
  | "skill";

export type StudioFrontstageSkillPresetTab =
  | "video"
  | "social"
  | "commerce"
  | "branding";

export type StudioFrontstageSkillPresetFollowUpMode =
  | "auto-clarify"
  | "direct-run";

export interface StudioFrontstageSkillPresetAsset {
  id: string;
  name: string;
  description: string;
  category: StudioFrontstageSkillPresetCategory;
  tab: StudioFrontstageSkillPresetTab;
  frontstagePriority: "primary" | "secondary";
  executionType: StudioFrontstageSkillPresetExecutionType;
  activationHint: string;
  iconName: string;
  order: number;
  skillDataId: string;
  skillDataName?: string;
  pluginId?: string;
  requiresAttachments?: boolean;
  followUpMode?: StudioFrontstageSkillPresetFollowUpMode;
  allowAutonomousRouting?: boolean;
  mode?: string;
  frontstageSkillId?: string;
  routeIntent?: string;
  routeLabel?: string;
  routeSummary?: string;
  preferredSkills?: string[];
  suggestedTaskMode?: string;
  clarifyChecklist?: string[];
  outputBlueprint?: string[];
  reusableQuestions?: string[];
  executionOutline?: string[];
  executionRecipe?: string[];
  toolPolicy?: string[];
  instruction?: string;
  examplePrompt?: string;
  notes?: string;
  research?: string;
  tags?: string[];
  sources?: string[];
}

export interface StudioRouteRule {
  agent: AgentType;
  keywords: string[];
  priority: number;
  label: string;
}

export interface StudioRoutingAsset {
  rules: StudioRouteRule[];
  editKeywords: string[];
  chatPatterns: string[];
  vaguePatterns: string[];
  promptBlock: string;
}

export interface StudioSharedInstructionAsset {
  imagenGoldenFormula: string;
  jsonRules: string;
  interactionRules: string;
  corePlanningBrain: string;
  deliverableDecompositionBrain: string;
  planningSelfCheckBrain: string;
  unifiedAgentBrain: string;
}

export interface StudioSystemAsset {
  id: string;
  title: string;
  summary?: string;
  prompt: string;
  promptTemplate: string;
}

export interface StudioRegistryManifest {
  version: number;
  generatedAt: string;
  sourceRoot: string;
  primaryAgentIds: AgentType[];
  sharedInstructions: StudioSharedInstructionAsset;
  routing: StudioRoutingAsset;
  agents: Record<AgentType, StudioAgentAsset>;
  specializations: Record<string, StudioSpecializationAsset>;
  styleLibraries: Record<WorkspaceBuiltInStyleLibraryMode, StudioStyleLibraryAsset>;
  plugins: Record<string, StudioPluginAsset>;
  skillPresets: Record<string, StudioFrontstageSkillPresetAsset>;
  systems: Record<string, StudioSystemAsset>;
}
