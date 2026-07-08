import type { AgentInfo } from "../../../types/agent.types";
import { getRegistryAgentInfo, getRegistryAgentPrompt } from "./registry.ts";

export const CAMPAIGN_SYSTEM_PROMPT = getRegistryAgentPrompt("campaign");
export const CAMPAIGN_AGENT_INFO: AgentInfo = getRegistryAgentInfo("campaign");
