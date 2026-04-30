import type { AgentInfo } from "../../../types/agent.types";
import { getRegistryAgentInfo, getRegistryAgentPrompt } from "./registry";

export const COCO_SYSTEM_PROMPT = getRegistryAgentPrompt("coco");
export const COCO_AGENT_INFO: AgentInfo = getRegistryAgentInfo("coco");
