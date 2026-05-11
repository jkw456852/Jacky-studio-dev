import type { AgentTaskMetadata } from "../../../types/agent.types";
import type { ChatMessage } from "../../../types";
import type { BrowserAgentGoalSessionPlan } from "../../../services/browser-agent";

export type SidebarBrowserAgentTaskMetadata = Pick<
  AgentTaskMetadata,
  | "allowAutonomousRouting"
  | "agentSelectionMode"
  | "pinnedAgentId"
  | "selectedRoleId"
  | "selectedRoleSource"
  | "baseAgentId"
  | "roleGovernanceMode"
  | "allowMainBrainRoleMutation"
  | "allowMainBrainRolePromotion"
  | "creationMode"
  | "skillData"
>;

export const buildSidebarBrowserAgentTaskMetadata = (args: {
  skillData?: ChatMessage["skillData"];
  agentSelectionMode: AgentTaskMetadata["agentSelectionMode"];
  pinnedAgentId?: AgentTaskMetadata["pinnedAgentId"];
  selectedRoleId?: AgentTaskMetadata["selectedRoleId"] | null;
  selectedRoleSource?: AgentTaskMetadata["selectedRoleSource"] | null;
  baseAgentId?: AgentTaskMetadata["baseAgentId"];
  roleGovernanceMode?: AgentTaskMetadata["roleGovernanceMode"];
  allowMainBrainRoleMutation?: AgentTaskMetadata["allowMainBrainRoleMutation"];
  allowMainBrainRolePromotion?: AgentTaskMetadata["allowMainBrainRolePromotion"];
}): SidebarBrowserAgentTaskMetadata => {
  const allowAutonomousRouting = Boolean(
    args.skillData && (args.skillData as any).config?.allowAutonomousRouting,
  );

  return {
    skillData: args.skillData || undefined,
    allowAutonomousRouting,
    agentSelectionMode: args.agentSelectionMode,
    pinnedAgentId:
      args.agentSelectionMode === "manual" ? args.pinnedAgentId : undefined,
    selectedRoleId: args.selectedRoleId || undefined,
    selectedRoleSource: args.selectedRoleSource || undefined,
    baseAgentId: args.baseAgentId,
    roleGovernanceMode: args.roleGovernanceMode,
    allowMainBrainRoleMutation: args.allowMainBrainRoleMutation,
    allowMainBrainRolePromotion: args.allowMainBrainRolePromotion,
    creationMode: allowAutonomousRouting ? "agent" : undefined,
  };
};

export const getPreparedPlanContinuationStatus = (
  plan: Pick<BrowserAgentGoalSessionPlan, "done"> | null | undefined,
): "active" | "done" => (plan?.done === true ? "done" : "active");
