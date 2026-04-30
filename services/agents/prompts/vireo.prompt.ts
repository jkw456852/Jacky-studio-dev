import type { AgentInfo } from "../../../types/agent.types";
import { getRegistryAgentInfo, getRegistryAgentPrompt } from "./registry";

export const VIREO_SYSTEM_PROMPT = getRegistryAgentPrompt("vireo");
export const VIREO_AGENT_INFO: AgentInfo = getRegistryAgentInfo("vireo");
