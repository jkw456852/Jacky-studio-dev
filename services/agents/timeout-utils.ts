export type TimeoutExecutor = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
) => Promise<T>;

export interface RunWithTimeoutOptions<T> {
  promise: Promise<T>;
  timeoutMs: number;
  createTimeoutError: () => unknown;
  setTimeoutFn?: typeof globalThis.setTimeout;
  clearTimeoutFn?: typeof globalThis.clearTimeout;
}

export const runWithTimeout = async <T>({
  promise,
  timeoutMs,
  createTimeoutError,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
}: RunWithTimeoutOptions<T>): Promise<T> => {
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeoutFn(
          () => reject(createTimeoutError()),
          timeoutMs,
        ) as ReturnType<typeof globalThis.setTimeout>;
      }),
    ]);
  } finally {
    if (timeoutId !== null) {
      clearTimeoutFn(timeoutId);
    }
  }
};

export const withTimeout: TimeoutExecutor = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> =>
  runWithTimeout({
    promise,
    timeoutMs,
    createTimeoutError: () => new Error(timeoutMessage),
  });
