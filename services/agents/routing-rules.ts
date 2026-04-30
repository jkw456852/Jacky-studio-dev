import { AgentType } from '../../types/agent.types';
import { getStudioRoutingAsset } from '../runtime-assets/studio-registry';

export interface RouteRule {
  keywords: string[];
  agent: AgentType;
  priority: number;
  label: string;
}

const routingAsset = getStudioRoutingAsset();

export const AGENT_ROUTE_RULES: RouteRule[] = routingAsset.rules;

export const EDIT_KEYWORDS = routingAsset.editKeywords;

export const CHAT_PATTERNS = routingAsset.chatPatterns.map(
  (pattern) => new RegExp(pattern, 'i'),
);

export const VAGUE_PATTERNS = routingAsset.vaguePatterns.map(
  (pattern) => new RegExp(pattern, 'i'),
);

export const ROUTING_RULES_PROMPT_BLOCK = routingAsset.promptBlock;
