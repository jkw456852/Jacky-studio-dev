export type OpenAIImageTaskSubmission = {
  taskId: string
  status: string | null
  raw: any
}

export type OpenAIImageResponseParseResult =
  | { kind: 'direct'; image: string }
  | { kind: 'task'; submission: OpenAIImageTaskSubmission }
  | { kind: 'empty' }

export const extractOpenAIImageResult = (payload: any): string | null => {
  const first = Array.isArray(payload?.data) ? payload.data[0] : null
  if (!first) return null

  if (typeof first?.b64_json === 'string' && first.b64_json) {
    return `data:image/png;base64,${first.b64_json}`
  }
  if (typeof first?.url === 'string' && first.url) {
    return first.url
  }
  if (typeof first?.b64 === 'string' && first.b64) {
    return `data:image/png;base64,${first.b64}`
  }
  if (typeof first === 'string' && first) {
    return first.startsWith('data:') ? first : `data:image/png;base64,${first}`
  }

  return null
}

export const extractOpenAIImageTaskSubmission = (
  payload: any,
): OpenAIImageTaskSubmission | null => {
  if (!payload || typeof payload !== 'object') return null

  const first = Array.isArray(payload?.data) ? payload.data[0] : null
  const taskId =
    (typeof payload?.id === 'string' && payload.id) ||
    (typeof payload?.task_id === 'string' && payload.task_id) ||
    (typeof payload?.request_id === 'string' && payload.request_id) ||
    (typeof payload?.requestId === 'string' && payload.requestId) ||
    (typeof first?.id === 'string' && first.id) ||
    (typeof first?.task_id === 'string' && first.task_id) ||
    (typeof first?.request_id === 'string' && first.request_id) ||
    null

  if (!taskId) return null

  const status =
    (typeof payload?.status === 'string' && payload.status) ||
    (typeof payload?.state === 'string' && payload.state) ||
    (typeof first?.status === 'string' && first.status) ||
    (typeof first?.state === 'string' && first.state) ||
    null

  return {
    taskId,
    status: status ? String(status).toLowerCase() : null,
    raw: payload,
  }
}

export const parseOpenAIImageResponse = (
  payload: any,
): OpenAIImageResponseParseResult => {
  const image = extractOpenAIImageResult(payload)
  if (image) return { kind: 'direct', image }

  const submission = extractOpenAIImageTaskSubmission(payload)
  if (submission) return { kind: 'task', submission }

  return { kind: 'empty' }
}
