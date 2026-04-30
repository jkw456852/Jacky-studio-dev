import type { AgentInfo, AgentType } from "../../../types/agent.types";
import {
  getStudioAgentInfo,
  getStudioAgentSystemPrompt,
  getStudioSharedInstructions,
  getStudioSystemAsset,
} from "../../runtime-assets/studio-registry";
import { getMainBrainPreferenceBlock } from "../../runtime-assets/main-brain";

export const getRegistryAgentPrompt = (agentId: AgentType): string =>
  [getStudioAgentSystemPrompt(agentId), getMainBrainPreferenceBlock()]
    .filter(Boolean)
    .join("\n\n");

export const getRegistryAgentInfo = (agentId: AgentType): AgentInfo =>
  getStudioAgentInfo(agentId);

export const getRegistrySharedInstructions = () => getStudioSharedInstructions();

export const getRegistrySystemPrompt = (systemId: string): string =>
  [getStudioSystemAsset(systemId).prompt, getMainBrainPreferenceBlock()]
    .filter(Boolean)
    .join("\n\n");
