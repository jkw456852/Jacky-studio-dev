import type { AgentTaskMetadata } from "../../../types/agent.types";
import type { ChatMessage } from "../../../types";
import type { BrowserAgentGoalSessionPlan } from "../../../services/browser-agent";

export type SidebarBrowserAgentTaskMetadata = Pick<
  AgentTaskMetadata,
  | "allowAutonomousRouting"
  | "creationMode"
  | "skillData"
  | "brandContextSummary"
  | "topicPinnedContext"
  | "conversationConstraintSummary"
  | "referenceIntentSummary"
  | "memoryCaptureSummary"
  | "knowledgeCaptureItems"
>;

export const buildSidebarBrowserAgentTaskMetadata = (args: {
  skillData?: ChatMessage["skillData"];
  brandContextSummary?: AgentTaskMetadata["brandContextSummary"];
  topicPinnedContext?: AgentTaskMetadata["topicPinnedContext"];
  conversationConstraintSummary?: AgentTaskMetadata["conversationConstraintSummary"];
  referenceIntentSummary?: AgentTaskMetadata["referenceIntentSummary"];
  memoryCaptureSummary?: AgentTaskMetadata["memoryCaptureSummary"];
  knowledgeCaptureItems?: AgentTaskMetadata["knowledgeCaptureItems"];
}): SidebarBrowserAgentTaskMetadata => {
  const allowAutonomousRouting = Boolean(
    args.skillData && (args.skillData as any).config?.allowAutonomousRouting,
  );

  return {
    skillData: args.skillData || undefined,
    allowAutonomousRouting,
    brandContextSummary: args.brandContextSummary || undefined,
    topicPinnedContext: args.topicPinnedContext || undefined,
    conversationConstraintSummary:
      args.conversationConstraintSummary || undefined,
    referenceIntentSummary: args.referenceIntentSummary || undefined,
    memoryCaptureSummary: args.memoryCaptureSummary || undefined,
    knowledgeCaptureItems: args.knowledgeCaptureItems?.filter(Boolean) || undefined,
    creationMode: allowAutonomousRouting ? "agent" : undefined,
  };
};

export const getPreparedPlanContinuationStatus = (
  plan: Pick<BrowserAgentGoalSessionPlan, "done"> | null | undefined,
): "active" | "done" => (plan?.done === true ? "done" : "active");
