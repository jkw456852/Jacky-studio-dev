import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractVisibleThoughtTrace,
  normalizeAgentJsonResponse,
} from './agent-response-normalizer.ts';

test('normalizeAgentJsonResponse extracts balanced object before trailing prose', () => {
  const result = normalizeAgentJsonResponse(
    '{"analysis":"ok","skillCalls":[{"skillName":"generateImage","params":{"prompt":"demo"}}]} extra trailing text',
  );

  assert.equal(result.analysis, 'ok');
  assert.equal(result.skillCalls.length, 1);
  assert.equal(result.skillCalls[0].skillName, 'generateImage');
});

test('normalizeAgentJsonResponse unwraps fenced json payload', () => {
  const result = normalizeAgentJsonResponse(
    '```json\n{"message":"done","proposals":[{"id":"p1"}]}\n```',
  );

  assert.equal(result.message, 'done');
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].id, 'p1');
});

test('normalizeAgentJsonResponse preserves visible thought trace when planner returns natural language first', () => {
  const result = normalizeAgentJsonResponse(
    '先联网核实广州白云区今天的天气，再整理成简洁结论给你。',
  );

  assert.equal(result.message, '先联网核实广州白云区今天的天气，再整理成简洁结论给你。');
  assert.deepEqual(result.thoughtTrace, [
    '先联网核实广州白云区今天的天气，再整理成简洁结论给你。',
  ]);
  assert.deepEqual(result.skillCalls, []);
});

test('extractVisibleThoughtTrace ignores structured json and keeps user-facing thought lines', () => {
  assert.deepEqual(
    extractVisibleThoughtTrace('先确认来源\n然后补上关键数值'),
    ['先确认来源', '然后补上关键数值'],
  );
  assert.deepEqual(
    extractVisibleThoughtTrace('{"analysis":"先确认来源","message":"done"}'),
    [],
  );
});

test('normalizeAgentJsonResponse merges leading thought prefix with trailing json payload', () => {
  const result = normalizeAgentJsonResponse(
    '我先联网核实广州白云区今天的天气。\n{"analysis":"先查天气来源","message":"done","skillCalls":[{"skillName":"workspaceSearch","params":{"query":"广州白云区今天的天气"}}]}',
  );

  assert.equal(result.message, 'done');
  assert.equal(result.analysis, '先查天气来源');
  assert.equal(result.skillCalls.length, 1);
  assert.deepEqual(result.thoughtTrace, [
    '我先联网核实广州白云区今天的天气。',
  ]);
});


test('extractVisibleThoughtTrace does not mirror a plain final answer as thoughts', () => {
  // A typical assistant reply that is the FINAL answer (no thinking markers).
  // Previously this was wrongly mirrored into the thought trace, which made
  // the "查看思考过程" panel show the same content as the visible reply.
  const reply = '已成功为您生成涩谷街头的日本美女 Cosplay 摄影图（比例 4:3，具备写实镜头感）。\n本次任务由 Cameron（摄影与写实专家） 调度执行。';
  assert.deepEqual(extractVisibleThoughtTrace(reply), []);
});

test('normalizeAgentJsonResponse does not emit thoughtTrace for a plain final answer', () => {
  const reply = '已成功为您生成涩谷街头的日本美女 Cosplay 摄影图（比例 4:3，具备写实镜头感）。';
  const result = normalizeAgentJsonResponse(reply);
  assert.equal(result.message, reply);
  assert.equal(result.thoughtTrace, undefined);
});
