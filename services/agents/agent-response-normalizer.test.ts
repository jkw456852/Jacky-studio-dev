import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAgentJsonResponse } from './agent-response-normalizer.ts';

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
