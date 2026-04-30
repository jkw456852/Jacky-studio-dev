import type { AgentInfo } from "../../../types/agent.types";
import { getRegistryAgentInfo, getRegistryAgentPrompt } from "./registry";

export const POSTER_SYSTEM_PROMPT = getRegistryAgentPrompt("poster");
export const POSTER_AGENT_INFO: AgentInfo = getRegistryAgentInfo("poster");
