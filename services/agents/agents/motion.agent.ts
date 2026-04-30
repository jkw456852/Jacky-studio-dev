import { EnhancedBaseAgent } from '../enhanced-base-agent';
import { MOTION_AGENT_INFO } from '../prompts/motion.prompt';
import { getEffectiveAgentPrompt } from '../role-config';

export class MotionAgent extends EnhancedBaseAgent {
  get agentInfo() {
    return MOTION_AGENT_INFO;
  }

  get systemPrompt() {
    return getEffectiveAgentPrompt('motion');
  }

  get preferredSkills() {
    return [
      'generateVideo',
      'generateImage',
      'smartEdit'
    ];
  }

  get maxConcurrency() { return 1; } // 视频生成资源重、限速严
}

export const motionAgent = new MotionAgent();
