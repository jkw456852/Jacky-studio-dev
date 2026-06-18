import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSidebarBrowserAgentTaskMetadata,
  getPreparedPlanContinuationStatus,
} from './assistantSidebarBrowserAgentMetadata.ts';

test('buildSidebarBrowserAgentTaskMetadata keeps browser-agent chat skill-first', () => {
  const metadata = buildSidebarBrowserAgentTaskMetadata({
    skillData: {
      id: 'autonomous-main-brain',
      name: '自主 Agent 路由',
      iconName: 'Sparkles',
      config: {
        allowAutonomousRouting: true,
      },
    },
    brandContextSummary: '品牌：Demo',
    topicPinnedContext: '当前主题围绕首页改版。',
    conversationConstraintSummary: '保持现有品牌色与模块结构。',
  });

  assert.equal(metadata.allowAutonomousRouting, true);
  assert.equal(metadata.creationMode, 'agent');
  assert.equal(metadata.skillData?.id, 'autonomous-main-brain');
  assert.equal(metadata.brandContextSummary, '品牌：Demo');
  assert.equal(metadata.topicPinnedContext, '当前主题围绕首页改版。');
  assert.equal(
    metadata.conversationConstraintSummary,
    '保持现有品牌色与模块结构。',
  );
});

test('buildSidebarBrowserAgentTaskMetadata omits residual role metadata entirely', () => {
  const metadata = buildSidebarBrowserAgentTaskMetadata({
    skillData: {
      id: 'plain-chat',
      name: '普通对话',
      iconName: 'MessageSquare',
      config: {},
    },
    referenceIntentSummary: '本轮新增 2 张参考图。',
  });

  assert.equal(metadata.allowAutonomousRouting, false);
  assert.equal(metadata.creationMode, undefined);
  assert.equal(metadata.referenceIntentSummary, '本轮新增 2 张参考图。');
  assert.equal('agentSelectionMode' in metadata, false);
  assert.equal('pinnedAgentId' in metadata, false);
  assert.equal('selectedRoleId' in metadata, false);
  assert.equal('baseAgentId' in metadata, false);
});

test('getPreparedPlanContinuationStatus follows planner done flag', () => {
  assert.equal(getPreparedPlanContinuationStatus({ done: true }), 'done');
  assert.equal(getPreparedPlanContinuationStatus({ done: false }), 'active');
  assert.equal(getPreparedPlanContinuationStatus(null), 'active');
});
