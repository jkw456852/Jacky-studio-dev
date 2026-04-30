import { EnhancedBaseAgent } from '../enhanced-base-agent';
import { VIREO_AGENT_INFO } from '../prompts/vireo.prompt';
import { getEffectiveAgentPrompt } from '../role-config';

export class VireoAgent extends EnhancedBaseAgent {
  get agentInfo() {
    return VIREO_AGENT_INFO;
  }

  get systemPrompt() {
    return getEffectiveAgentPrompt('vireo');
  }

  get preferredSkills() {
    return [
      'generateVideo',
      'generateImage',
      'smartEdit'
    ];
  }
}

export const vireoAgent = new VireoAgent();
