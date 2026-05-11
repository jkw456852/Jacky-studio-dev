import type { AgentType } from "../../types/agent.types";
import { getEffectiveAgentPrompt } from "./role-config.ts";

export interface ResolveAnalyzePlanSystemPromptArgs {
  agentId: AgentType;
  fallbackSystemPrompt: string;
  metadata?: Record<string, any>;
}

export const resolveAnalyzePlanSystemPrompt = (
  args: ResolveAnalyzePlanSystemPromptArgs,
): string => {
  const topicId =
    typeof args.metadata?.topicId === "string"
      ? args.metadata.topicId.trim()
      : "";
  return (
    getEffectiveAgentPrompt(
      args.agentId,
      topicId ? { topicId } : undefined,
    ) || args.fallbackSystemPrompt
  );
};
