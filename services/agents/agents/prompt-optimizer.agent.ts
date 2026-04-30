import { EnhancedBaseAgent } from '../enhanced-base-agent';
import {
  PROMPT_OPTIMIZER_AGENT_INFO,
} from '../prompts/prompt-optimizer.prompt';
import { getEffectiveAgentPrompt } from '../role-config';

export class PromptOptimizerAgent extends EnhancedBaseAgent {
  get agentInfo() {
    return PROMPT_OPTIMIZER_AGENT_INFO;
  }

  get systemPrompt() {
    return getEffectiveAgentPrompt('prompt-optimizer');
  }

  get preferredSkills() {
    return [];
  }

  get maxConcurrency() {
    return 4;
  }
}

export const promptOptimizerAgent = new PromptOptimizerAgent();
