export type WorkspaceGenerationVariantTrace = {
  variantLabel: string;
  targetElementId: string;
  attempt: number;
  status: "generating" | "retrying" | "succeeded" | "failed";
  updatedAt: number;
  error?: string | null;
  elapsedMs?: number | null;
};

export type WorkspaceGenerationTraceDiagnostic = {
  id: string;
  code: string;
  source:
    | "reference-preflight"
    | "task-planner"
    | "planner"
    | "generation"
    | "host-diagnosis";
  severity: "info" | "warning" | "error";
  message: string;
  repaired: boolean;
  repairSummary?: string | null;
  detail?: string | null;
  timestamp: number;
};

export type WorkspaceGenerationTrace = {
  requestId: string;
  requestElementId: string;
  sourceElementId: string;
  targetElementIds: string[];
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  status:
    | "planning"
    | "planned"
    | "generating"
    | "retrying"
    | "completed"
    | "failed";
  sourcePrompt: string;
  taskMode?: string;
  taskIntent?: string;
  taskReasoningSummary?: string;
  taskToolChain?: string[];
  taskPlanningBrief?: {
    requestType: string;
    deliverableForm: string;
    aspectRatioStrategy: string;
    researchFocus: string[];
    researchDecision?: {
      shouldResearch: boolean;
      mode: string;
      reason: string;
      topics: string[];
      searchQueries: string[];
    } | null;
    modelFitNotes: string[];
    promptDirectives: string[];
    risks: string[];
  } | null;
  taskRoleOverlay?: {
    summary: string;
    mindset: string;
    roles: string[];
    executionDirectives: string[];
  } | null;
  taskPages?: Array<{
    id: string;
    title: string;
    goal: string;
    pageRole: string;
    aspectRatio: string;
  }>;
  composedPrompt?: string;
  composedPromptPreview?: string;
  basePrompt?: string;
  planIntent?: string;
  planStrategy?: string;
  plannerSource?: string;
  plannerModel?: {
    modelId: string;
    providerId?: string | null;
    label?: string | null;
  } | null;
  plannerNotes?: string[];
  referenceRoleMode?: string;
  manualReferenceCount?: number;
  referenceCount?: number;
  model?: string;
  aspectRatio?: string;
  imageSize?: string;
  imageQuality?: string;
  imageCount?: number;
  lastError?: string | null;
  diagnostics?: WorkspaceGenerationTraceDiagnostic[];
  variantResults: WorkspaceGenerationVariantTrace[];
};

const MAX_TRACES = 100;

const tracesByRequestId = new Map<string, WorkspaceGenerationTrace>();
const latestRequestIdByElementId = new Map<string, string>();
const recentRequestIds: string[] = [];

const normalizeTraceDiagnostic = (
  input: WorkspaceGenerationTraceDiagnostic,
): WorkspaceGenerationTraceDiagnostic => ({
  id: String(input.id || "").trim(),
  code: String(input.code || "").trim(),
  source:
    input.source ||
    "host-diagnosis",
  severity: input.severity || "info",
  message: String(input.message || "").trim(),
  repaired: Boolean(input.repaired),
  repairSummary: String(input.repairSummary || "").trim() || null,
  detail: String(input.detail || "").trim() || null,
  timestamp: Number.isFinite(input.timestamp) ? input.timestamp : Date.now(),
});

const touchRecentRequestId = (requestId: string) => {
  const existingIndex = recentRequestIds.indexOf(requestId);
  if (existingIndex >= 0) {
    recentRequestIds.splice(existingIndex, 1);
  }
  recentRequestIds.push(requestId);
  while (recentRequestIds.length > MAX_TRACES) {
    const removedRequestId = recentRequestIds.shift();
    if (!removedRequestId) continue;
    tracesByRequestId.delete(removedRequestId);
    for (const [elementId, latestRequestId] of latestRequestIdByElementId.entries()) {
      if (latestRequestId === removedRequestId) {
        latestRequestIdByElementId.delete(elementId);
      }
    }
  }
};

const bindTraceToElementIds = (trace: WorkspaceGenerationTrace) => {
  const ids = new Set<string>([
    trace.requestElementId,
    trace.sourceElementId,
    ...trace.targetElementIds,
  ]);
  ids.forEach((elementId) => {
    const normalized = String(elementId || "").trim();
    if (!normalized) return;
    latestRequestIdByElementId.set(normalized, trace.requestId);
  });
};

export const upsertWorkspaceGenerationTrace = (
  input: WorkspaceGenerationTrace,
) => {
  const normalized: WorkspaceGenerationTrace = {
    ...input,
    targetElementIds: Array.from(new Set((input.targetElementIds || []).filter(Boolean))),
    taskToolChain: Array.isArray(input.taskToolChain)
      ? input.taskToolChain.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
    taskPlanningBrief:
      input.taskPlanningBrief && typeof input.taskPlanningBrief === "object"
        ? {
            requestType: String(input.taskPlanningBrief.requestType || "").trim(),
            deliverableForm: String(
              input.taskPlanningBrief.deliverableForm || "",
            ).trim(),
            aspectRatioStrategy: String(
              input.taskPlanningBrief.aspectRatioStrategy || "",
            ).trim(),
            researchFocus: Array.isArray(input.taskPlanningBrief.researchFocus)
              ? input.taskPlanningBrief.researchFocus
                  .map((item) => String(item || "").trim())
                  .filter(Boolean)
              : [],
            researchDecision:
              input.taskPlanningBrief.researchDecision &&
              typeof input.taskPlanningBrief.researchDecision === "object"
                ? {
                    shouldResearch: Boolean(
                      input.taskPlanningBrief.researchDecision.shouldResearch,
                    ),
                    mode: String(
                      input.taskPlanningBrief.researchDecision.mode || "",
                    ).trim(),
                    reason: String(
                      input.taskPlanningBrief.researchDecision.reason || "",
                    ).trim(),
                    topics: Array.isArray(
                      input.taskPlanningBrief.researchDecision.topics,
                    )
                      ? input.taskPlanningBrief.researchDecision.topics
                          .map((item) => String(item || "").trim())
                          .filter(Boolean)
                      : [],
                    searchQueries: Array.isArray(
                      input.taskPlanningBrief.researchDecision.searchQueries,
                    )
                      ? input.taskPlanningBrief.researchDecision.searchQueries
                          .map((item) => String(item || "").trim())
                          .filter(Boolean)
                      : [],
                  }
                : null,
            modelFitNotes: Array.isArray(input.taskPlanningBrief.modelFitNotes)
              ? input.taskPlanningBrief.modelFitNotes
                  .map((item) => String(item || "").trim())
                  .filter(Boolean)
              : [],
            promptDirectives: Array.isArray(input.taskPlanningBrief.promptDirectives)
              ? input.taskPlanningBrief.promptDirectives
                  .map((item) => String(item || "").trim())
                  .filter(Boolean)
              : [],
            risks: Array.isArray(input.taskPlanningBrief.risks)
              ? input.taskPlanningBrief.risks
                  .map((item) => String(item || "").trim())
                  .filter(Boolean)
              : [],
          }
        : null,
    taskRoleOverlay:
      input.taskRoleOverlay && typeof input.taskRoleOverlay === "object"
        ? {
            summary: String(input.taskRoleOverlay.summary || "").trim(),
            mindset: String(input.taskRoleOverlay.mindset || "").trim(),
            roles: Array.isArray(input.taskRoleOverlay.roles)
              ? input.taskRoleOverlay.roles
                  .map((item) => String(item || "").trim())
                  .filter(Boolean)
              : [],
            executionDirectives: Array.isArray(
              input.taskRoleOverlay.executionDirectives,
            )
              ? input.taskRoleOverlay.executionDirectives
                  .map((item) => String(item || "").trim())
                  .filter(Boolean)
              : [],
          }
        : null,
    taskPages: Array.isArray(input.taskPages)
      ? input.taskPages
          .map((item) => ({
            id: String(item?.id || "").trim(),
            title: String(item?.title || "").trim(),
            goal: String(item?.goal || "").trim(),
            pageRole: String(item?.pageRole || "").trim(),
            aspectRatio: String(item?.aspectRatio || "").trim(),
          }))
          .filter((item) => item.id && item.title)
      : [],
    plannerNotes: Array.isArray(input.plannerNotes)
      ? input.plannerNotes.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
    diagnostics: Array.isArray(input.diagnostics)
      ? input.diagnostics
          .map((item) => normalizeTraceDiagnostic(item))
          .filter((item) => item.id && item.code && item.message)
      : [],
    variantResults: Array.isArray(input.variantResults)
      ? input.variantResults.map((item) => ({ ...item }))
      : [],
    updatedAt: input.updatedAt || Date.now(),
  };
  tracesByRequestId.set(normalized.requestId, normalized);
  bindTraceToElementIds(normalized);
  touchRecentRequestId(normalized.requestId);
  return normalized;
};

export const patchWorkspaceGenerationTrace = (
  requestId: string,
  patch: Partial<WorkspaceGenerationTrace>,
) => {
  const current = tracesByRequestId.get(requestId);
  if (!current) return null;
  return upsertWorkspaceGenerationTrace({
    ...current,
    ...patch,
    requestId: current.requestId,
    requestElementId: patch.requestElementId || current.requestElementId,
    sourceElementId: patch.sourceElementId || current.sourceElementId,
    targetElementIds: patch.targetElementIds || current.targetElementIds,
    startedAt: patch.startedAt || current.startedAt,
    sourcePrompt: patch.sourcePrompt || current.sourcePrompt,
    updatedAt: patch.updatedAt || Date.now(),
    variantResults:
      patch.variantResults !== undefined
        ? patch.variantResults
        : current.variantResults,
  });
};

export const updateWorkspaceGenerationVariantTrace = (args: {
  requestId: string;
  variantLabel: string;
  targetElementId: string;
  attempt: number;
  status: WorkspaceGenerationVariantTrace["status"];
  updatedAt?: number;
  error?: string | null;
  elapsedMs?: number | null;
}) => {
  const current = tracesByRequestId.get(args.requestId);
  if (!current) return null;
  const nextVariant: WorkspaceGenerationVariantTrace = {
    variantLabel: args.variantLabel,
    targetElementId: args.targetElementId,
    attempt: args.attempt,
    status: args.status,
    updatedAt: args.updatedAt || Date.now(),
    error: args.error || null,
    elapsedMs: args.elapsedMs ?? null,
  };
  const existingIndex = current.variantResults.findIndex(
    (item) => item.variantLabel === args.variantLabel,
  );
  const variantResults = [...current.variantResults];
  if (existingIndex >= 0) {
    variantResults[existingIndex] = nextVariant;
  } else {
    variantResults.push(nextVariant);
  }
  return patchWorkspaceGenerationTrace(args.requestId, {
    updatedAt: nextVariant.updatedAt,
    variantResults,
  });
};

export const appendWorkspaceGenerationTraceDiagnostics = (
  requestId: string,
  diagnostics: WorkspaceGenerationTraceDiagnostic[],
) => {
  const current = tracesByRequestId.get(requestId);
  if (!current || !Array.isArray(diagnostics) || diagnostics.length === 0) return null;
  const existing = Array.isArray(current.diagnostics) ? current.diagnostics : [];
  const existingIds = new Set(existing.map((item) => item.id));
  const appended = diagnostics
    .map((item) => normalizeTraceDiagnostic(item))
    .filter((item) => item.id && item.code && item.message)
    .filter((item) => {
      if (existingIds.has(item.id)) return false;
      existingIds.add(item.id);
      return true;
    });
  if (appended.length === 0) return current;
  return patchWorkspaceGenerationTrace(requestId, {
    updatedAt: Date.now(),
    diagnostics: [...existing, ...appended],
  });
};

export const readWorkspaceGenerationTraceByElementId = (elementId?: string) => {
  const normalized = String(elementId || "").trim();
  if (!normalized) return null;
  const requestId = latestRequestIdByElementId.get(normalized);
  if (!requestId) return null;
  return tracesByRequestId.get(requestId) || null;
};

export const readWorkspaceGenerationTraceByRequestId = (requestId?: string) => {
  const normalized = String(requestId || "").trim();
  if (!normalized) return null;
  return tracesByRequestId.get(normalized) || null;
};

export const listRecentWorkspaceGenerationTraces = (limit = 10) => {
  const normalizedLimit = Math.max(1, Math.min(MAX_TRACES, limit));
  return recentRequestIds
    .slice(-normalizedLimit)
    .map((requestId) => tracesByRequestId.get(requestId))
    .filter((item): item is WorkspaceGenerationTrace => Boolean(item));
};
