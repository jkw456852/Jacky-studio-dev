import { parseOpenAIImageResponse } from './response-parser.ts'

export type OpenAITransportAuthMode = 'bearer' | 'query'

export type OpenAITransportRequestTuning = {
  timeoutMs?: number
  idleTimeoutMs?: number
  retries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  requestFingerprint?: string
  signal?: AbortSignal
}

const createAbortError = (): DOMException =>
  new DOMException('The operation was aborted.', 'AbortError')

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw createAbortError()
  }
}

const delayWithAbort = (ms: number, signal?: AbortSignal): Promise<void> => {
  if (!signal) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  if (signal.aborted) {
    return Promise.reject(createAbortError())
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort)
      resolve()
    }, ms)

    const handleAbort = () => {
      clearTimeout(timeoutId)
      signal.removeEventListener('abort', handleAbort)
      reject(createAbortError())
    }

    signal.addEventListener('abort', handleAbort, { once: true })
  })
}

export const runOpenAITransportWithFallback = async <T>(args: {
  baseUrl: string
  path: string
  apiKeys: string[]
  authPlans: OpenAITransportAuthMode[]
  contextTag: string
  send: (input: {
    authMode: OpenAITransportAuthMode
    apiKey: string
    keyIndex: number
    apiKeyCount: number
  }) => Promise<Response>
  parseSuccess: (response: Response) => Promise<T>
  isTimeoutError: (error: unknown) => boolean
  shouldTryAlternateAuth: (status: number) => boolean
  isRateLimited: (status: number) => boolean
  isServerError: (status: number) => boolean
  onAuthModeSuccess?: (authMode: OpenAITransportAuthMode) => void
  onAuthModeRejected?: (authMode: OpenAITransportAuthMode, status: number) => void
  onBeforeRequest?: (meta: {
    authMode: OpenAITransportAuthMode
    keyIndex: number
    apiKeyCount: number
  }) => void
  onTransportError?: (meta: {
    authMode: OpenAITransportAuthMode
    keyIndex: number
    apiKeyCount: number
    elapsedMs: number
    error: unknown
    isTimeoutError: boolean
  }) => void
  onResponseError?: (meta: {
    authMode: OpenAITransportAuthMode
    keyIndex: number
    apiKeyCount: number
    elapsedMs: number
    status: number
    errorBody: string
  }) => void
  requestTuning?: OpenAITransportRequestTuning
  shouldContinueOnRateLimit?: (meta: {
    authMode: OpenAITransportAuthMode
    keyIndex: number
    apiKeyCount: number
    status: number
  }) => Promise<boolean> | boolean
  shouldContinueOnServerError?: (meta: {
    authMode: OpenAITransportAuthMode
    keyIndex: number
    apiKeyCount: number
    status: number
    path: string
  }) => Promise<boolean> | boolean
}): Promise<T> => {
  let lastError: any = null

  if (args.apiKeys.length === 0) {
    throw new Error(`${args.contextTag} API failed: no available api keys`)
  }

  for (const authMode of args.authPlans) {
    let keyIndex = 0
    while (keyIndex < args.apiKeys.length) {
      throwIfAborted(args.requestTuning?.signal)
      const apiKey = args.apiKeys[keyIndex]
      const requestStartedAt = Date.now()
      args.onBeforeRequest?.({
        authMode,
        keyIndex,
        apiKeyCount: args.apiKeys.length,
      })

      let response: Response
      try {
        response = await args.send({
          authMode,
          apiKey,
          keyIndex,
          apiKeyCount: args.apiKeys.length,
        })
      } catch (error) {
        const isTimeoutError = args.isTimeoutError(error)
        args.onTransportError?.({
          authMode,
          keyIndex,
          apiKeyCount: args.apiKeys.length,
          elapsedMs: Date.now() - requestStartedAt,
          error,
          isTimeoutError,
        })
        if (isTimeoutError) {
          const timeoutError: any = error instanceof Error ? error : new Error(String(error))
          timeoutError.authMode = authMode
          timeoutError.keyIndex = keyIndex
          timeoutError.retryable = true
          timeoutError.timeout = true
          lastError = timeoutError
          keyIndex += 1
          continue
        }
        throw error
      }

      if (response.ok) {
        args.onAuthModeSuccess?.(authMode)
        return args.parseSuccess(response)
      }

      const errorBody = await response.text().catch(() => '')
      args.onResponseError?.({
        authMode,
        keyIndex,
        apiKeyCount: args.apiKeys.length,
        elapsedMs: Date.now() - requestStartedAt,
        status: response.status,
        errorBody,
      })

      const isRateLimitError = args.isRateLimited(response.status)
      const isServerError = args.isServerError(response.status)
      const err: any = new Error(
        `${args.contextTag} API error: ${response.status} [${authMode}] ${
          isRateLimitError ? 'Rate limited' : isServerError ? 'Server error' : errorBody
        }`,
      )
      err.status = response.status
      err.authMode = authMode
      err.keyIndex = keyIndex
      err.retryable = isRateLimitError || isServerError
      lastError = err

      if (args.shouldTryAlternateAuth(response.status)) {
        args.onAuthModeRejected?.(authMode, response.status)
      }

      if (isRateLimitError) {
        const shouldContinue = await args.shouldContinueOnRateLimit?.({
          authMode,
          keyIndex,
          apiKeyCount: args.apiKeys.length,
          status: response.status,
        })
        if (shouldContinue !== false) {
          if (keyIndex < args.apiKeys.length - 1) {
            keyIndex += 1
          } else {
            break
          }
          continue
        }
      }

      if (isServerError) {
        const shouldContinue = await args.shouldContinueOnServerError?.({
          authMode,
          keyIndex,
          apiKeyCount: args.apiKeys.length,
          status: response.status,
          path: args.path,
        })
        if (shouldContinue !== false) {
          if (keyIndex < args.apiKeys.length - 1) {
            keyIndex += 1
          } else {
            break
          }
          continue
        }
      }

      if (!args.shouldTryAlternateAuth(response.status)) {
        throw err
      }

       keyIndex += 1
     }
  }

  throw lastError || new Error(`${args.contextTag} API failed on all auth strategies`)
}

export const pollOpenAICompatibleImageResult = async (args: {
  taskId: string
  contextTag: string
  fetchJson: (path: string, contextTag: string) => Promise<any>
  intervalMs?: number
  maxAttempts?: number
  signal?: AbortSignal
}): Promise<string | null> => {
  const pollPaths = [
    `/v1/images/${args.taskId}`,
    `/v1/images/generations/${args.taskId}`,
    `/v1/images/edits/${args.taskId}`,
    `/v1/tasks/${args.taskId}`,
  ]

  const intervalMs = Math.max(250, Number(args.intervalMs || 5000))
  const maxAttempts = Math.max(1, Number(args.maxAttempts || 60))
  let lastError: any = null

  for (let index = 0; index < maxAttempts; index += 1) {
    throwIfAborted(args.signal)
    await delayWithAbort(intervalMs, args.signal)

    for (const pollPath of pollPaths) {
      throwIfAborted(args.signal)
      try {
        const payload = await args.fetchJson(pollPath, `${args.contextTag}.poll`)
        const parsed = parseOpenAIImageResponse(payload)
        if (parsed.kind === 'direct') {
          return parsed.image
        }

        const status = parsed.kind === 'task' ? parsed.submission.status || null : null
        if (status && ['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
          throw new Error(`openai image polling failed: ${JSON.stringify(payload).slice(0, 280)}`)
        }
      } catch (error) {
        lastError = error
      }
    }
  }

  if (lastError) {
    throw lastError
  }

  throw new Error('openai image polling timeout')
}
