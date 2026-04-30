import { EnhancedBaseAgent } from '../enhanced-base-agent';
import { CAMERON_AGENT_INFO } from '../prompts/cameron.prompt';
import { getEffectiveAgentPrompt } from '../role-config';

export class CameronAgent extends EnhancedBaseAgent {
  get agentInfo() {
    return CAMERON_AGENT_INFO;
  }

  get systemPrompt() {
    return getEffectiveAgentPrompt('cameron');
  }

  get preferredSkills() {
    return [
      'generateImage',
      'generateVideo',
      'generateCopy',
      'analyzeRegion'
    ];
  }
}

export const cameronAgent = new CameronAgent();
