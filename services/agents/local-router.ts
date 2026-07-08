/**
 * 本地关键词预路由
 * 不依赖 API，0 延迟，作为远端路由失败时的降级方案。
 * 当前产品默认单智能体模式：设计类请求统一先进 Coco，再由 Coco 决定 skill 和工作流。
 */

import { AgentType } from '../../types/agent.types';
import { detectOptimizeOnlyIntent } from './prompt-optimizer/intent';
import { AGENT_ROUTE_RULES, CHAT_PATTERNS, EDIT_KEYWORDS, VAGUE_PATTERNS } from './routing-rules';

/**
 * 检测是否为修改/编辑类请求
 */
export function isEditRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return EDIT_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/**
 * 本地关键词路由
 * 除纯闲聊外，其余正常设计/执行请求默认统一进入 coco。
 * @returns 匹配到的智能体类型，未匹配返回 null
 */
export function localPreRoute(message: string): AgentType | null {
  if (detectOptimizeOnlyIntent(message)) {
    return 'prompt-optimizer';
  }

  // 纯闲聊类消息不走设计执行路径
  if (isChatMessage(message)) {
    return null;
  }

  const lower = message.toLowerCase();
  const matchedRule = AGENT_ROUTE_RULES.find((rule) =>
    rule.keywords.some((keyword) => lower.includes(keyword)),
  );

  if (matchedRule) {
    return 'coco';
  }

  if (isEditRequest(message) || isVagueRequest(message) || message.trim().length > 0) {
    return 'coco';
  }

  return null;
}

/**
 * 检测是否为闲聊/问候类消息（不需要走设计执行路径）
 */
export function isChatMessage(message: string): boolean {
  return CHAT_PATTERNS.some((pattern) => pattern.test(message.trim()));
}

/**
 * 检测是否为模糊/不明确的请求
 */
export function isVagueRequest(message: string): boolean {
  return VAGUE_PATTERNS.some((pattern) => pattern.test(message.trim()));
}
