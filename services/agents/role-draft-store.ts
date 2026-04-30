import type { AgentRoleDraft, AgentType } from "../../types/agent.types";
import { getStudioUserAssetApi } from "../runtime-assets/api";
import type { StudioStoredRoleDraft as StoredRoleDraft } from "../runtime-assets/user-asset-types";

export const getLatestAgentRoleDraft = (
  agentId: AgentType,
): StoredRoleDraft | null => {
  return getStudioUserAssetApi().getLatestRoleDraft(agentId);
};

export const saveLatestAgentRoleDraft = (
  agentId: AgentType,
  draft: Partial<AgentRoleDraft> | null | undefined,
  options?: {
    roleStrategy?: "reuse" | "augment" | "create";
    roleStrategyReason?: string;
  },
): void => {
  getStudioUserAssetApi().saveLatestRoleDraft(agentId, draft, options);
};

export const clearLatestAgentRoleDraft = (agentId: AgentType): void => {
  getStudioUserAssetApi().clearLatestRoleDraft(agentId);
};
