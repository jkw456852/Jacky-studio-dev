import { EnhancedBaseAgent } from '../enhanced-base-agent';
import { POSTER_AGENT_INFO } from '../prompts/poster.prompt';
import { getEffectiveAgentPrompt } from '../role-config';

export class PosterAgent extends EnhancedBaseAgent {
  get agentInfo() {
    return POSTER_AGENT_INFO;
  }

  get systemPrompt() {
    return getEffectiveAgentPrompt('poster');
  }

  get preferredSkills() {
    return [
      'generateImage',
      'generateCopy',
      'extractText'
    ];
  }

  get maxConcurrency() { return 3; } // 图片密集型
}

export const posterAgent = new PosterAgent();
