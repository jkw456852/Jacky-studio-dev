import { EnhancedBaseAgent } from '../enhanced-base-agent';
import { COCO_AGENT_INFO } from '../prompts/coco.prompt';
import { getEffectiveAgentPrompt } from '../role-config';

export class CocoAgent extends EnhancedBaseAgent {
  get agentInfo() {
    return COCO_AGENT_INFO;
  }

  get systemPrompt() {
    return getEffectiveAgentPrompt('coco');
  }

  get preferredSkills() {
    return [
      'generateImage',
      'generateCopy',
      'analyzeRegion',
      'generateVideo'
    ];
  }
}

export const cocoAgent = new CocoAgent();
