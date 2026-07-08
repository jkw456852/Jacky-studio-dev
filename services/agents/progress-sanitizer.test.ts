import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendSanitizedProgressMessage,
  sanitizeAgentProgressLog,
  sanitizeAgentProgressMessage,
} from './progress-sanitizer.ts';

test('sanitizeAgentProgressMessage harvests human fields from structured payloads', () => {
  const cleaned = sanitizeAgentProgressMessage(
    '{"analysis":"Need answer skill metadata.","skillCalls":[{"skillName":"generateImage","params":{"prompt":"x","providerId":"custom_123"}}],"message":"Current skill is UGC."}',
  );

  assert.equal(cleaned.includes('Current skill is UGC.'), true);
  assert.equal(cleaned.includes('generateImage'), false);
  assert.equal(cleaned.includes('providerId'), false);
  assert.equal(cleaned.includes('custom_123'), false);
});

test('sanitizeAgentProgressLog removes internal-only progress lines', () => {
  const cleaned = sanitizeAgentProgressLog([
    '[Frontstage Skill Contract]\nSkill: Custom Skill\n[Current Request]\nhello',
    'providerId: custom_1777104578189',
    'params: {"prompt":"x"}',
    'Preparing final reply...',
    'Preparing final reply...',
  ]);

  assert.deepEqual(cleaned, ['Preparing final reply...']);
});

test('appendSanitizedProgressMessage collapses progressive prefix expansions', () => {
  let log = appendSanitizedProgressMessage([], '先');
  log = appendSanitizedProgressMessage(log, '先联网');
  log = appendSanitizedProgressMessage(
    log,
    '先联网核实广州今天的实时天气，再直接给你结论。',
  );

  assert.deepEqual(log, ['先联网核实广州今天的实时天气，再直接给你结论。']);
});
