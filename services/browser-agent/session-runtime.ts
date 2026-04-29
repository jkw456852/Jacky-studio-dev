export type BrowserAgentSessionStatus =
  | "pending"
  | "running"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "cancelled";

export type BrowserAgentSessionStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "cancelled";

export type BrowserAgentSessionStepKind = "tool" | "host_action";

export type BrowserAgentSessionStepSpec = {
  id: string;
  title?: string;
  summary?: string;
  kind: BrowserAgentSessionStepKind;
  toolId?: string;
  hostId?: string;
  actionId?: string;
  input?: Record<string, unknown>;
  continueOnError?: boolean;
};

export type BrowserAgentSessionSpec = {
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  steps: BrowserAgentSessionStepSpec[];
  autoStart?: boolean;
};

export type BrowserAgentSessionStepRecord = {
  id: string;
  title: string;
  summary?: string;
  kind: BrowserAgentSessionStepKind;
  status: BrowserAgentSessionStepStatus;
  toolId?: string;
  hostId?: string | null;
  actionId?: string;
  continueOnError: boolean;
  input: Record<string, unknown>;
  resolvedInput: Record<string, unknown> | null;
  result: unknown;
  error: string | null;
  startedAt?: number;
  completedAt?: number;
};

export type BrowserAgentSessionRecord = {
  id: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  status: BrowserAgentSessionStatus;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  currentStepId: string | null;
  lastError: string | null;
  cancellationRequested: boolean;
  steps: BrowserAgentSessionStepRecord[];
};

type BrowserAgentSessionExecutors = {
  invokeTool: (toolId: string, input?: Record<string, unknown>) => Promise<unknown>;
  invokeHostAction: (
    hostId: string | undefined,
    actionId: string,
    input?: Record<string, unknown>,
  ) => Promise<unknown>;
};

const sessions = new Map<string, BrowserAgentSessionRecord>();
const runningSessions = new Set<string>();
let configuredExecutors: BrowserAgentSessionExecutors | null = null;

export const configureBrowserAgentSessionRuntime = (
  executors: BrowserAgentSessionExecutors,
) => {
  configuredExecutors = executors;
};

export const startBrowserAgentSession = (spec: BrowserAgentSessionSpec) => {
  const now = Date.now();
  const sessionId = `browser-agent-session-${now}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const session: BrowserAgentSessionRecord = {
    id: sessionId,
    title: String(spec.title || "Browser Agent Session").trim(),
    description: String(spec.description || "").trim() || undefined,
    metadata: cloneSerializable(spec.metadata || {}),
    status: spec.autoStart === false ? "pending" : "running",
    createdAt: now,
    updatedAt: now,
    startedAt: spec.autoStart === false ? undefined : now,
    completedAt: undefined,
    currentStepId: null,
    lastError: null,
    cancellationRequested: false,
    steps: (spec.steps || []).map((step, index) => ({
      id: normalizeSessionStepId(step.id, index),
      title: String(step.title || step.id || `Step ${index + 1}`).trim(),
      summary: String(step.summary || "").trim() || undefined,
      kind: step.kind,
      status: "pending",
      toolId: step.toolId ? String(step.toolId).trim() : undefined,
      hostId: step.hostId ? String(step.hostId).trim() : null,
      actionId: step.actionId ? String(step.actionId).trim() : undefined,
      continueOnError: Boolean(step.continueOnError),
      input: cloneSerializable(step.input || {}),
      resolvedInput: null,
      result: null,
      error: null,
    })),
  };

  sessions.set(sessionId, session);
  if (spec.autoStart !== false) {
    void runBrowserAgentSession(sessionId);
  }
  return readBrowserAgentSession(sessionId);
};

export const runBrowserAgentSession = async (sessionId: string) => {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Browser agent session not found: ${sessionId}`);
  }
  if (!configuredExecutors) {
    throw new Error("Browser agent session runtime is not configured.");
  }
  if (runningSessions.has(sessionId)) {
    return readBrowserAgentSession(sessionId);
  }

  runningSessions.add(sessionId);
  patchBrowserAgentSession(sessionId, {
    status: "running",
    startedAt: session.startedAt || Date.now(),
    updatedAt: Date.now(),
    completedAt: undefined,
    lastError: null,
  });

  let completedWithErrors = false;

  try {
    const latest = sessions.get(sessionId);
    if (!latest) {
      throw new Error(`Browser agent session not found: ${sessionId}`);
    }

    for (const step of latest.steps) {
      const liveSession = sessions.get(sessionId);
      if (!liveSession) break;

      if (step.status !== "pending") {
        continue;
      }

      if (liveSession.cancellationRequested) {
        markRemainingStepsCancelled(liveSession, step.id);
        patchBrowserAgentSession(sessionId, {
          status: "cancelled",
          currentStepId: null,
          completedAt: Date.now(),
          updatedAt: Date.now(),
        });
        break;
      }

      patchBrowserAgentSessionStep(sessionId, step.id, {
        status: "running",
        startedAt: Date.now(),
        completedAt: undefined,
        error: null,
      });
      patchBrowserAgentSession(sessionId, {
        currentStepId: step.id,
        updatedAt: Date.now(),
      });

      const currentSession = sessions.get(sessionId);
      const currentStep = currentSession?.steps.find((item) => item.id === step.id) || null;
      if (!currentSession || !currentStep) break;

      const resolvedInput = resolveTemplateValue(
        currentStep.input,
        buildSessionTemplateContext(currentSession),
      ) as Record<string, unknown>;

      patchBrowserAgentSessionStep(sessionId, step.id, {
        resolvedInput: cloneSerializable(resolvedInput || {}),
      });

      try {
        const result =
          currentStep.kind === "tool"
            ? await configuredExecutors.invokeTool(
                String(currentStep.toolId || "").trim(),
                resolvedInput,
              )
            : await configuredExecutors.invokeHostAction(
                currentStep.hostId || undefined,
                String(currentStep.actionId || "").trim(),
                resolvedInput,
              );

        patchBrowserAgentSessionStep(sessionId, step.id, {
          status: "completed",
          result: cloneSerializable(result),
          completedAt: Date.now(),
          error: null,
        });
      } catch (error) {
        const message = formatSessionError(error);
        patchBrowserAgentSessionStep(sessionId, step.id, {
          status: "failed",
          error: message,
          completedAt: Date.now(),
        });
        patchBrowserAgentSession(sessionId, {
          lastError: message,
          updatedAt: Date.now(),
        });
        if (!currentStep.continueOnError) {
          markRemainingStepsSkipped(sessionId, step.id);
          patchBrowserAgentSession(sessionId, {
            status: "failed",
            currentStepId: null,
            completedAt: Date.now(),
            updatedAt: Date.now(),
            lastError: message,
          });
          return readBrowserAgentSession(sessionId);
        }
        completedWithErrors = true;
      }
    }

    const finalSession = sessions.get(sessionId);
    if (finalSession && finalSession.status === "running") {
      patchBrowserAgentSession(sessionId, {
        status: completedWithErrors ? "completed_with_errors" : "completed",
        currentStepId: null,
        completedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  } finally {
    runningSessions.delete(sessionId);
  }

  return readBrowserAgentSession(sessionId);
};

export const cancelBrowserAgentSession = (sessionId: string) => {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Browser agent session not found: ${sessionId}`);
  }
  if (
    session.status === "completed" ||
    session.status === "completed_with_errors" ||
    session.status === "failed" ||
    session.status === "cancelled"
  ) {
    return readBrowserAgentSession(sessionId);
  }
  patchBrowserAgentSession(sessionId, {
    cancellationRequested: true,
    updatedAt: Date.now(),
  });
  return readBrowserAgentSession(sessionId);
};

export const appendBrowserAgentSessionSteps = (
  sessionId: string,
  steps: BrowserAgentSessionStepSpec[],
  options?: {
    autoStart?: boolean;
  },
) => {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Browser agent session not found: ${sessionId}`);
  }
  if (runningSessions.has(sessionId)) {
    throw new Error(
      "Cannot append steps while the browser agent session is still running.",
    );
  }

  const now = Date.now();
  const existingIds = new Set(session.steps.map((step) => step.id));
  const appendedSteps = (steps || []).map((step, index) =>
    buildSessionStepRecord(step, session.steps.length + index, existingIds),
  );

  if (appendedSteps.length === 0) {
    return readBrowserAgentSession(sessionId);
  }

  patchBrowserAgentSession(sessionId, {
    status: "pending",
    currentStepId: null,
    completedAt: undefined,
    cancellationRequested: false,
    updatedAt: now,
    steps: [...session.steps, ...appendedSteps],
  });

  if (options?.autoStart !== false) {
    void runBrowserAgentSession(sessionId);
  }

  return readBrowserAgentSession(sessionId);
};

export const resumeBrowserAgentSession = (
  sessionId: string,
  options?: {
    autoStart?: boolean;
  },
) => {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Browser agent session not found: ${sessionId}`);
  }

  const hasPendingSteps = session.steps.some((step) => step.status === "pending");
  if (!hasPendingSteps) {
    return readBrowserAgentSession(sessionId);
  }

  patchBrowserAgentSession(sessionId, {
    status: options?.autoStart === false ? "pending" : "running",
    currentStepId: null,
    completedAt: undefined,
    cancellationRequested: false,
    updatedAt: Date.now(),
  });

  if (options?.autoStart !== false) {
    void runBrowserAgentSession(sessionId);
  }

  return readBrowserAgentSession(sessionId);
};

export const updateBrowserAgentSessionMetadata = (
  sessionId: string,
  metadataPatch: Record<string, unknown>,
) => {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Browser agent session not found: ${sessionId}`);
  }

  patchBrowserAgentSession(sessionId, {
    metadata: cloneSerializable({
      ...(session.metadata || {}),
      ...(metadataPatch || {}),
    }),
    updatedAt: Date.now(),
  });

  return readBrowserAgentSession(sessionId);
};

export const readBrowserAgentSession = (sessionId: string) =>
  cloneSerializable(sessions.get(sessionId) || null);

export const listBrowserAgentSessions = (limit = 20) => {
  const normalizedLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  return Array.from(sessions.values())
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, normalizedLimit)
    .map((session) => cloneSerializable(session));
};

export const getBrowserAgentSessionStats = () => ({
  sessionCount: sessions.size,
  runningSessionCount: runningSessions.size,
});

const patchBrowserAgentSession = (
  sessionId: string,
  patch: Partial<BrowserAgentSessionRecord>,
) => {
  const current = sessions.get(sessionId);
  if (!current) return null;
  const next: BrowserAgentSessionRecord = {
    ...current,
    ...patch,
    id: current.id,
    steps: patch.steps || current.steps,
  };
  sessions.set(sessionId, next);
  return next;
};

const patchBrowserAgentSessionStep = (
  sessionId: string,
  stepId: string,
  patch: Partial<BrowserAgentSessionStepRecord>,
) => {
  const current = sessions.get(sessionId);
  if (!current) return null;
  const nextSteps = current.steps.map((step) =>
    step.id === stepId ? { ...step, ...patch, id: step.id } : step,
  );
  return patchBrowserAgentSession(sessionId, {
    steps: nextSteps,
    updatedAt: Date.now(),
  });
};

const buildSessionStepRecord = (
  step: BrowserAgentSessionStepSpec,
  index: number,
  existingIds?: Set<string>,
): BrowserAgentSessionStepRecord => {
  const id = normalizeSessionStepId(step.id, index, existingIds);
  existingIds?.add(id);
  return {
    id,
    title: String(step.title || step.id || `Step ${index + 1}`).trim(),
    summary: String(step.summary || "").trim() || undefined,
    kind: step.kind,
    status: "pending",
    toolId: step.toolId ? String(step.toolId).trim() : undefined,
    hostId: step.hostId ? String(step.hostId).trim() : null,
    actionId: step.actionId ? String(step.actionId).trim() : undefined,
    continueOnError: Boolean(step.continueOnError),
    input: cloneSerializable(step.input || {}),
    resolvedInput: null,
    result: null,
    error: null,
  };
};

const markRemainingStepsSkipped = (sessionId: string, afterStepId: string) => {
  const current = sessions.get(sessionId);
  if (!current) return;
  let afterCurrentStep = false;
  const nextSteps = current.steps.map((step) => {
    if (step.id === afterStepId) {
      afterCurrentStep = true;
      return step;
    }
    if (!afterCurrentStep || step.status !== "pending") {
      return step;
    }
    return {
      ...step,
      status: "skipped" as const,
      completedAt: Date.now(),
      error: "Skipped after previous step failure.",
    };
  });
  patchBrowserAgentSession(sessionId, {
    steps: nextSteps,
    updatedAt: Date.now(),
  });
};

const markRemainingStepsCancelled = (
  session: BrowserAgentSessionRecord,
  currentStepId: string,
) => {
  let afterCurrentStep = false;
  const nextSteps = session.steps.map((step) => {
    if (step.id === currentStepId) {
      afterCurrentStep = true;
      return step;
    }
    if (!afterCurrentStep || step.status !== "pending") {
      return step;
    }
    return {
      ...step,
      status: "cancelled" as const,
      completedAt: Date.now(),
      error: "Cancelled before execution.",
    };
  });
  patchBrowserAgentSession(session.id, {
    steps: nextSteps,
  });
};

const normalizeSessionStepId = (
  value: string,
  index: number,
  existingIds?: Set<string>,
) => {
  const normalized = String(value || "").trim();
  const fallback = normalized || `step_${index + 1}`;
  if (!existingIds || !existingIds.has(fallback)) {
    return fallback;
  }

  let suffix = 2;
  let candidate = `${fallback}_${suffix}`;
  while (existingIds.has(candidate)) {
    suffix += 1;
    candidate = `${fallback}_${suffix}`;
  }
  return candidate;
};

const buildSessionTemplateContext = (session: BrowserAgentSessionRecord) => {
  const steps: Record<string, BrowserAgentSessionStepRecord> = {};
  session.steps.forEach((step) => {
    steps[step.id] = step;
  });
  return {
    session,
    steps,
  };
};

const resolveTemplateValue = (value: unknown, context: Record<string, unknown>): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => resolveTemplateValue(item, context));
  }
  if (isPlainRecord(value)) {
    const next: Record<string, unknown> = {};
    Object.entries(value).forEach(([key, item]) => {
      next[key] = resolveTemplateValue(item, context);
    });
    return next;
  }
  if (typeof value !== "string") {
    return value;
  }

  const exactMatch = value.match(/^\{\{\s*([^}]+)\s*\}\}$/);
  if (exactMatch) {
    return readTemplatePath(context, exactMatch[1]);
  }

  return value.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, path: string) => {
    const resolved = readTemplatePath(context, path);
    if (resolved === null || resolved === undefined) return "";
    return typeof resolved === "string" ? resolved : JSON.stringify(resolved);
  });
};

const readTemplatePath = (context: Record<string, unknown>, path: string): unknown => {
  return String(path || "")
    .split(".")
    .filter(Boolean)
    .reduce<unknown>((current, segment) => {
      if (!current || typeof current !== "object") {
        return undefined;
      }
      return (current as Record<string, unknown>)[segment];
    }, context);
};

const formatSessionError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message || error.name || "Unknown session error";
  }
  return String(error || "Unknown session error");
};

const cloneSerializable = <T>(value: T): T => {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
