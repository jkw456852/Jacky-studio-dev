import { AgentType, AgentTask, AgentInfo } from '../../types/agent.types.ts';
import { EnhancedBaseAgent } from './enhanced-base-agent.ts';
import { getStudioPrimaryAgentIds } from '../runtime-assets/studio-registry.ts';
import { cocoAgent } from './agents/coco.agent.ts';
import { vireoAgent } from './agents/vireo.agent.ts';
import { cameronAgent } from './agents/cameron.agent.ts';
import { posterAgent } from './agents/poster.agent.ts';
import { packageAgent } from './agents/package.agent.ts';
import { motionAgent } from './agents/motion.agent.ts';
import { campaignAgent } from './agents/campaign.agent.ts';
import { clothingAgent } from './agents/clothing.agent.ts';
import { promptOptimizerAgent } from './agents/prompt-optimizer.agent.ts';

export const AGENT_REGISTRY: Record<AgentType, EnhancedBaseAgent> = {
  coco: cocoAgent,
  vireo: vireoAgent,
  cameron: cameronAgent,
  poster: posterAgent,
  package: packageAgent,
  motion: motionAgent,
  // campaign remains default; specialized clothing flow is selected via routing
  campaign: campaignAgent,
  // NOTE: ClothingAgent is a specialized prompt bound to 'campaign' AgentType in this codebase.
  // It is used via explicit pin or router keyword logic.
  'prompt-optimizer': promptOptimizerAgent,
};

export const PRIMARY_AGENT_IDS: AgentType[] = getStudioPrimaryAgentIds();

export function getAgentInfo(agentId: AgentType): AgentInfo {
  return AGENT_REGISTRY[agentId].agentInfo;
}

export function listAgentInfos(): AgentInfo[] {
  return PRIMARY_AGENT_IDS.map((agentId) => getAgentInfo(agentId));
}

export async function executeAgentTask(task: AgentTask): Promise<AgentTask> {
  // Normalize agent ID to lowercase (LLM may return "Campaign" instead of "campaign")
  const normalizedId = task.agentId.toLowerCase() as AgentType;
  const agent = AGENT_REGISTRY[normalizedId];
  if (!agent) {
    throw new Error(`Agent ${task.agentId} not found`);
  }
  return agent.execute({ ...task, agentId: normalizedId });
}

// 导出核心模块
export { EnhancedBaseAgent } from './enhanced-base-agent.ts';
export { routeToAgent } from './enhanced-orchestrator.ts';

// 导出本地路由（降级方案）
export { localPreRoute, isChatMessage, isVagueRequest, isEditRequest } from './local-router.ts';

// 导出 Pipeline 系统
export { executePipeline, detectPipeline, PIPELINES } from './pipeline.ts';
export type { Pipeline, PipelineResult } from './pipeline.ts';
