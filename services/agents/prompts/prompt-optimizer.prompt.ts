import type { AgentInfo } from "../../../types/agent.types";
import { getRegistryAgentInfo, getRegistryAgentPrompt } from "./registry";

export const PROMPT_OPTIMIZER_SYSTEM_PROMPT =
  getRegistryAgentPrompt("prompt-optimizer");

export const PROMPT_OPTIMIZER_AGENT_INFO: AgentInfo =
  getRegistryAgentInfo("prompt-optimizer");
