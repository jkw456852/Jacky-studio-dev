import type { AgentInfo, AgentType } from "../../types/agent.types";
import type { WorkspaceBuiltInStyleLibraryMode } from "../vision-orchestrator/style-library";
import type { WorkspaceStyleLibrary } from "../../types/common";

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
  systems: Record<string, StudioSystemAsset>;
}
