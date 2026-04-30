import type { AgentInfo } from "../../../types/agent.types";
import { getRegistryAgentInfo, getRegistryAgentPrompt } from "./registry";

export const PACKAGE_SYSTEM_PROMPT = getRegistryAgentPrompt("package");
export const PACKAGE_AGENT_INFO: AgentInfo = getRegistryAgentInfo("package");
