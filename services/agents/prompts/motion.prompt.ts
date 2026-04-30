import type { AgentInfo } from "../../../types/agent.types";
import { getRegistryAgentInfo, getRegistryAgentPrompt } from "./registry";

export const MOTION_SYSTEM_PROMPT = getRegistryAgentPrompt("motion");
export const MOTION_AGENT_INFO: AgentInfo = getRegistryAgentInfo("motion");
