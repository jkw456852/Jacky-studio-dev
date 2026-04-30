import type { AgentInfo } from "../../../types/agent.types";
import { getRegistryAgentInfo, getRegistryAgentPrompt } from "./registry";

export const CAMERON_SYSTEM_PROMPT = getRegistryAgentPrompt("cameron");
export const CAMERON_AGENT_INFO: AgentInfo = getRegistryAgentInfo("cameron");
