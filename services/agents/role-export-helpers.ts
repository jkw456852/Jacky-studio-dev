import type { AgentType } from "../../types/agent.types";
import { getStudioUserAssetApi } from "../runtime-assets/api";
import { getStudioAgentSystemPrompt } from "../runtime-assets/studio-registry";

export const getBuiltInAgentPrompt = (agentId: AgentType): string =>
  getStudioAgentSystemPrompt(agentId);

export const getAgentPromptAddon = (agentId: AgentType): string =>
  getStudioUserAssetApi().getAgentPromptAddon(agentId);

export const getLatestRoleDraft = (agentId: AgentType) =>
  getStudioUserAssetApi().getLatestRoleDraft(agentId);
