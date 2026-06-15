import assert from 'node:assert/strict'
import test from 'node:test'

import {
  extractOpenAIImageResult,
  extractOpenAIImageTaskSubmission,
  parseOpenAIImageResponse,
} from './response-parser.ts'

test('extractOpenAIImageResult supports b64_json, url, b64 and raw string payloads', () => {
  assert.equal(
    extractOpenAIImageResult({ data: [{ b64_json: 'abc123' }] }),
    'data:image/png;base64,abc123',
  )

  assert.equal(
    extractOpenAIImageResult({ data: [{ url: 'https://example.com/a.png' }] }),
    'https://example.com/a.png',
  )

  assert.equal(
    extractOpenAIImageResult({ data: [{ b64: 'xyz789' }] }),
    'data:image/png;base64,xyz789',
  )

  assert.equal(
    extractOpenAIImageResult({ data: ['raw-base64-string'] }),
    'data:image/png;base64,raw-base64-string',
  )
})

test('extractOpenAIImageTaskSubmission normalizes task identifiers and status', () => {
  const parsed = extractOpenAIImageTaskSubmission({
    request_id: 'task-42',
    status: 'PROCESSING',
  })

  assert.equal(parsed?.taskId, 'task-42')
  assert.equal(parsed?.status, 'processing')
})

test('parseOpenAIImageResponse classifies direct, task and empty payloads', () => {
  assert.deepEqual(
    parseOpenAIImageResponse({ data: [{ url: 'https://example.com/out.png' }] }),
    {
      kind: 'direct',
      image: 'https://example.com/out.png',
    },
  )

  const taskParsed = parseOpenAIImageResponse({ id: 'task-7', status: 'queued' })
  assert.equal(taskParsed.kind, 'task')
  if (taskParsed.kind === 'task') {
    assert.equal(taskParsed.submission.taskId, 'task-7')
    assert.equal(taskParsed.submission.status, 'queued')
  }

  assert.deepEqual(parseOpenAIImageResponse({ data: [] }), { kind: 'empty' })
})
