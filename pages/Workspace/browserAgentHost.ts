import type React from "react";
import type {
  BrowserAgentHostActionDefinition,
  BrowserConsoleEvent,
  BrowserToolExecutorContext,
} from "../../services/browser-agent";
import { registerBrowserTool, unregisterBrowserTool } from "../../services/browser-agent";
import {
  listRecentWorkspaceGenerationTraces,
  readWorkspaceGenerationTraceByElementId,
  readWorkspaceGenerationTraceByRequestId,
} from "./browserAgentGenerationTrace";
import type {
  WorkspaceBrowserAgentElementSummary,
  WorkspaceBrowserAgentSnapshot,
} from "./browserAgentSnapshot";

export const WORKSPACE_BROWSER_AGENT_HOST_ID = "workspace-canvas-main";

export type WorkspaceBrowserAgentActions = {
  setAssistantVisible: (visible: boolean) => void;
  setPreviewUrl: (url: string | null) => void;
  setActiveTool: (tool: string) => void;
  fitToScreen: () => void;
  clearSelection: () => void;
  selectElementById: (elementId: string) => boolean;
  triggerImageGeneration: (elementId: string) =>
    | boolean
    | {
        accepted: boolean;
        elementId: string;
        requestId?: string | null;
        traceStatus?: string | null;
      };
  updateElementControl: (
    elementId: string,
    controlId: string,
    value: unknown,
  ) => { accepted: boolean; reason?: string | null };
  repairGenerationState: (
    elementId: string,
  ) => {
    accepted: boolean;
    reason?: string | null;
    repairedFields?: string[];
    notes?: string[];
  };
  openElementPreviewById: (
    elementId?: string,
  ) => { opened: boolean; reason?: string; url?: string | null };
};

export type WorkspaceElementToolAvailability = {
  id: string;
  title: string;
  description: string;
  kind: "action" | "tool";
  enabled: boolean;
  reason: string | null;
};

export type WorkspaceBrowserAgentModelOption = {
  id: string;
  name: string;
  providerId?: string | null;
  providerName?: string;
  desc?: string;
  time?: string;
};

export type WorkspaceBrowserAgentAspectRatioOption = {
  value: string;
  label: string;
  size?: string;
};

export type WorkspaceElementControlOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export type WorkspaceElementControlDefinition = {
  id: string;
  title: string;
  controlType:
    | "select"
    | "toggle"
    | "textarea"
    | "action"
    | "upload"
    | "readonly";
  source: "element" | "global";
  currentValue: string | boolean | null;
  enabled: boolean;
  reason: string | null;
  options?: WorkspaceElementControlOption[];
  metadata?: Record<string, unknown>;
};

type WorkspaceElementControlInput = Omit<
  WorkspaceElementControlDefinition,
  "reason"
> & {
  reason?: string | null;
};

export type WorkspaceElementControlsReport = {
  targetElementId: string | null;
  targetElementType: string | null;
  panelKind: string | null;
  controls: WorkspaceElementControlDefinition[];
};

export type WorkspaceElementCapabilitiesReport = {
  targetElementId: string | null;
  targetElementType: string | null;
  targetTreeNodeKind: string | null;
  isSelected: boolean;
  isGenerating: boolean;
  hasGenerationTrace: boolean;
  element: WorkspaceBrowserAgentElementSummary | null;
  actions: WorkspaceElementToolAvailability[];
  tools: WorkspaceElementToolAvailability[];
};

export type WorkspaceToolExecutionResult<TPayload = unknown> = {
  ok: boolean;
  tool: string;
  summary: string;
  payload?: TPayload;
  issues?: string[];
  suggestions?: string[];
  retryable?: boolean;
};

export type WorkspaceGenerationObservationPayload = {
  targetElementId: string | null;
  targetElementType: string | null;
  targetTreeNodeKind: string | null;
  panelKind: string | null;
  isSelected: boolean;
  isGenerating: boolean;
  hasGenerationTrace: boolean;
  canGenerate: boolean;
  canPreview: boolean;
  promptPreview: string | null;
  referenceImageCount: number;
  previewImageCount: number;
  enabledActionIds: string[];
  enabledToolIds: string[];
  traceStatus: string | null;
  traceModel: string | null;
  tracePlanIntent: string | null;
  tracePlanStrategy: string | null;
  lastError: string | null;
  variantSummary: {
    total: number;
    succeeded: number;
    failed: number;
    retrying: number;
    generating: number;
  };
  recentActivityKinds: string[];
  recentActivitySummary: string[];
  recommendedNextActions: Array<{
    kind: "tool" | "host_action";
    id: string;
    reason: string;
  }>;
};

export type WorkspaceAwaitGenerationPayload = {
  elementId: string | null;
  requestId: string | null;
  status: string | null;
  terminal: boolean;
  timedOut: boolean;
  elapsedMs: number;
  lastError: string | null;
  variantSummary: {
    total: number;
    succeeded: number;
    failed: number;
    retrying: number;
    generating: number;
  };
  recentActivityKinds: string[];
  recentActivitySummary: string[];
};

export type WorkspaceRepairGenerationStatePayload = {
  accepted: boolean;
  elementId: string | null;
  repairedFields: string[];
  notes: string[];
  reason: string | null;
};

export type WorkspaceGenerationDiagnosisItem = {
  code: string;
  source: string;
  severity: "info" | "warning" | "error";
  message: string;
  repaired: boolean;
  repairSummary: string | null;
  detail: string | null;
};

export type WorkspaceGenerationDiagnosisPayload = {
  elementId: string | null;
  requestId: string | null;
  status: string | null;
  lastError: string | null;
  diagnosisItems: WorkspaceGenerationDiagnosisItem[];
  repairedIssueCount: number;
  unresolvedIssueCount: number;
  recentActivityKinds: string[];
  recentActivitySummary: string[];
  recommendedNextActions: Array<{
    kind: "tool" | "host_action";
    id: string;
    reason: string;
  }>;
};

export const WORKSPACE_BROWSER_AGENT_HOST_ACTIONS: BrowserAgentHostActionDefinition[] = [
  {
    id: "workspace.set_active_tool",
    title: "Set Active Tool",
    description: "Switches the workspace active tool.",
    inputSchema: {
      tool: "string",
    },
    outputSchema: {
      tool: "string",
    },
  },
  {
    id: "workspace.set_assistant_visibility",
    title: "Set Assistant Visibility",
    description: "Shows or hides the workspace assistant sidebar.",
    inputSchema: {
      visible: "boolean",
    },
    outputSchema: {
      visible: "boolean",
    },
  },
  {
    id: "workspace.clear_selection",
    title: "Clear Selection",
    description: "Clears the current canvas selection.",
    inputSchema: {},
    outputSchema: {
      cleared: "boolean",
    },
  },
  {
    id: "workspace.select_element",
    title: "Select Element",
    description: "Selects a canvas element by id.",
    inputSchema: {
      elementId: "string",
    },
    outputSchema: {
      selected: "boolean",
      elementId: "string",
    },
  },
  {
    id: "workspace.fit_to_screen",
    title: "Fit To Screen",
    description: "Fits the current canvas content into the viewport.",
    inputSchema: {},
    outputSchema: {
      fitted: "boolean",
    },
  },
  {
    id: "workspace.open_preview",
    title: "Open Preview",
    description:
      "Opens image preview for the selected element or for the provided element id.",
    inputSchema: {
      elementId: "string",
    },
    outputSchema: {
      opened: "boolean",
      elementId: "string|null",
      url: "string|null",
      reason: "string|null",
    },
  },
  {
    id: "workspace.generate_image",
    title: "Generate Image",
    description:
      "Triggers image generation for the provided element id or the current selected element.",
    inputSchema: {
      elementId: "string",
    },
    outputSchema: {
      accepted: "boolean",
      elementId: "string|null",
      requestId: "string|null",
      traceStatus: "string|null",
    },
  },
  {
    id: "workspace.update_element_control",
    title: "Update Element Control",
    description:
      "Updates a concrete toolbar control value for a target element.",
    inputSchema: {
      elementId: "string",
      controlId: "string",
      value: "unknown",
    },
    outputSchema: {
      accepted: "boolean",
      elementId: "string",
      controlId: "string",
      reason: "string|null",
    },
  },
  {
    id: "workspace.repair_generation_state",
    title: "Repair Generation State",
    description:
      "Repairs common generation-state issues on the current element, such as missing reference chains, stale errors, or missing inherited prompts.",
    inputSchema: {
      elementId: "string",
    },
    outputSchema: {
      accepted: "boolean",
      elementId: "string|null",
      repairedFields: "string[]",
      notes: "string[]",
      reason: "string|null",
    },
  },
  {
    id: "workspace.close_preview",
    title: "Close Preview",
    description: "Closes the workspace preview modal.",
    inputSchema: {},
    outputSchema: {
      closed: "boolean",
    },
  },
];

export const WORKSPACE_BROWSER_AGENT_TOOL_IDS = [
  "workspace.read_canvas_state",
  "workspace.list_elements",
  "workspace.read_selected_element",
  "workspace.read_workspace_snapshot",
  "workspace.observe_generation_target",
  "workspace.read_element_capabilities",
  "workspace.read_element_controls",
  "workspace.await_generation_completion",
  "workspace.read_generation_trace",
  "workspace.diagnose_generation_trace",
  "workspace.read_recent_generation_activity",
] as const;

type RegisterWorkspaceBrowserAgentToolsArgs = {
  snapshotRef: React.MutableRefObject<WorkspaceBrowserAgentSnapshot>;
  elementSummariesRef: React.MutableRefObject<WorkspaceBrowserAgentElementSummary[]>;
  imageModelOptionsRef: React.MutableRefObject<WorkspaceBrowserAgentModelOption[]>;
  aspectRatioOptionsRef: React.MutableRefObject<WorkspaceBrowserAgentAspectRatioOption[]>;
};

type InvokeWorkspaceBrowserAgentActionArgs = {
  actionId: string;
  input?: Record<string, unknown>;
  snapshot: WorkspaceBrowserAgentSnapshot;
  actions: WorkspaceBrowserAgentActions;
};

type WorkspaceGenerationActivity = {
  id: string;
  level: BrowserConsoleEvent["level"];
  timestamp: number;
  kind: string;
  requestId: string | null;
  elementId: string | null;
  sourceElementId: string | null;
  summary: string;
  context: Record<string, unknown> | null;
};

export const invokeWorkspaceBrowserAgentAction = ({
  actionId,
  input,
  snapshot,
  actions,
}: InvokeWorkspaceBrowserAgentActionArgs) => {
  switch (actionId) {
    case "workspace.set_active_tool": {
      const tool = String(input?.tool || "").trim();
      if (!tool) {
        throw new Error("workspace.set_active_tool requires a tool.");
      }
      actions.setActiveTool(tool);
      return { tool };
    }
    case "workspace.set_assistant_visibility": {
      const visible = Boolean(input?.visible);
      actions.setAssistantVisible(visible);
      return { visible };
    }
    case "workspace.clear_selection": {
      actions.clearSelection();
      return { cleared: true };
    }
    case "workspace.select_element": {
      const elementId = String(input?.elementId || "").trim();
      if (!elementId) {
        throw new Error("workspace.select_element requires an elementId.");
      }
      const selected = actions.selectElementById(elementId);
      return { selected, elementId };
    }
    case "workspace.fit_to_screen": {
      actions.fitToScreen();
      return { fitted: true };
    }
    case "workspace.open_preview": {
      const elementId =
        String(input?.elementId || "").trim() ||
        snapshot.selection.selectedElementId ||
        undefined;
      const result = actions.openElementPreviewById(elementId);
      return {
        opened: result.opened,
        elementId: elementId || null,
        url: result.url || null,
        reason: result.reason || null,
      };
    }
    case "workspace.generate_image": {
      const elementId =
        String(input?.elementId || "").trim() ||
        snapshot.selection.selectedElementId ||
        "";
      if (!elementId) {
        throw new Error("workspace.generate_image requires an elementId or a selection.");
      }
      const accepted = actions.triggerImageGeneration(elementId);
      const payload =
        typeof accepted === "object" && accepted
          ? accepted
          : {
              accepted: Boolean(accepted),
              elementId,
              requestId: null,
              traceStatus: null,
            };
      return {
        accepted: Boolean(payload.accepted),
        elementId: payload.elementId || elementId,
        requestId: payload.requestId || null,
        traceStatus: payload.traceStatus || null,
      };
    }
    case "workspace.update_element_control": {
      const elementId =
        String(input?.elementId || "").trim() ||
        snapshot.selection.selectedElementId ||
        "";
      const controlId = String(input?.controlId || "").trim();
      if (!elementId || !controlId) {
        throw new Error(
          "workspace.update_element_control requires both elementId and controlId.",
        );
      }
      const result = actions.updateElementControl(elementId, controlId, input?.value);
      return {
        accepted: Boolean(result.accepted),
        elementId,
        controlId,
        reason: result.reason || null,
      };
    }
    case "workspace.repair_generation_state": {
      const elementId =
        String(input?.elementId || "").trim() ||
        snapshot.selection.selectedElementId ||
        "";
      if (!elementId) {
        throw new Error("workspace.repair_generation_state requires an elementId or a selection.");
      }
      const result = actions.repairGenerationState(elementId);
      return {
        accepted: Boolean(result.accepted),
        elementId,
        repairedFields: Array.isArray(result.repairedFields)
          ? result.repairedFields
          : [],
        notes: Array.isArray(result.notes) ? result.notes : [],
        reason: result.reason || null,
      };
    }
    case "workspace.close_preview": {
      actions.setPreviewUrl(null);
      return { closed: true };
    }
    default:
      throw new Error(`Unsupported workspace action: ${actionId}`);
  }
};

export const registerWorkspaceBrowserAgentTools = ({
  snapshotRef,
  elementSummariesRef,
  imageModelOptionsRef,
  aspectRatioOptionsRef,
}: RegisterWorkspaceBrowserAgentToolsArgs) => {
  registerBrowserTool(
    {
      id: "workspace.read_canvas_state",
      title: "Read Canvas State",
      description:
        "Returns the current workspace canvas state, selection summary, and element counts.",
      category: "canvas",
      inputSchema: {},
      outputSchema: {
        project: "WorkspaceBrowserAgentSnapshot.project",
        canvas: "WorkspaceBrowserAgentSnapshot.canvas",
        selection: "WorkspaceBrowserAgentSnapshot.selection",
        elements: "WorkspaceBrowserAgentSnapshot.elements",
      },
      visibility: "agent",
    },
    () => {
      const snapshot = snapshotRef.current;
      return {
        project: snapshot.project,
        canvas: snapshot.canvas,
        selection: {
          selectedElementId: snapshot.selection.selectedElementId,
          selectedElementIds: snapshot.selection.selectedElementIds,
          selectedCount: snapshot.selection.selectedCount,
          hasMultiSelection: snapshot.selection.hasMultiSelection,
        },
        elements: snapshot.elements,
      };
    },
  );

  registerBrowserTool(
    {
      id: "workspace.list_elements",
      title: "List Elements",
      description:
        "Returns summarized canvas elements so an agent can inspect and reference element ids.",
      category: "canvas",
      inputSchema: {
        type: "string",
        limit: "number",
        generatingOnly: "boolean",
      },
      outputSchema: {
        elements: "WorkspaceBrowserAgentElementSummary[]",
      },
      visibility: "agent",
    },
    (input) => {
      const requestedType = String(input?.type || "").trim();
      const limit = Math.max(1, Math.min(200, Number(input?.limit || 100)));
      const generatingOnly = Boolean(input?.generatingOnly);
      const filtered = elementSummariesRef.current.filter((element) => {
        if (requestedType && element.type !== requestedType) return false;
        if (generatingOnly && !element.generation.isGenerating) return false;
        return true;
      });
      return {
        elements: filtered.slice(0, limit),
      };
    },
  );

  registerBrowserTool(
    {
      id: "workspace.read_selected_element",
      title: "Read Selected Element",
      description:
        "Returns the current workspace selection and the primary selected element summary.",
      category: "canvas",
      inputSchema: {},
      outputSchema: {
        selection: "WorkspaceBrowserAgentSnapshot.selection",
      },
      visibility: "agent",
    },
    () => ({
      selection: snapshotRef.current.selection,
    }),
  );

  registerBrowserTool(
    {
      id: "workspace.read_workspace_snapshot",
      title: "Read Workspace Snapshot",
      description:
        "Returns the full normalized workspace host snapshot for agent orchestration.",
      category: "canvas",
      inputSchema: {},
      outputSchema: {
        snapshot: "WorkspaceBrowserAgentSnapshot",
      },
      visibility: "agent",
    },
    () => ({
      snapshot: snapshotRef.current,
    }),
  );

  registerBrowserTool(
    {
      id: "workspace.observe_generation_target",
      title: "Observe Generation Target",
      description:
        "Returns a structured observation result for a target element, including capabilities, controls, trace, activity, issues, and recommended next actions.",
      category: "image",
      inputSchema: {
        elementId: "string",
        activityLimit: "number",
      },
      outputSchema: {
        result: "WorkspaceToolExecutionResult<WorkspaceGenerationObservationPayload>",
      },
      visibility: "agent",
    },
    (input, context) => {
      const requestedElementId =
        String(input?.elementId || "").trim() ||
        snapshotRef.current.selection.selectedElementId ||
        "";
      const activityLimit = Math.max(1, Math.min(12, Number(input?.activityLimit || 6)));
      const capabilities = buildWorkspaceElementCapabilitiesReport({
        elementId: requestedElementId || null,
        snapshot: snapshotRef.current,
        elementSummaries: elementSummariesRef.current,
      });
      const controls = buildWorkspaceElementControlsReport({
        elementId: requestedElementId || null,
        snapshot: snapshotRef.current,
        elementSummaries: elementSummariesRef.current,
        imageModelOptions: imageModelOptionsRef.current,
        aspectRatioOptions: aspectRatioOptionsRef.current,
      });
      const trace = requestedElementId
        ? readWorkspaceGenerationTraceByElementId(requestedElementId)
        : null;
      const activities = readWorkspaceImageGenerationEvents(context)
        .map(toWorkspaceGenerationActivity)
        .filter((activity): activity is WorkspaceGenerationActivity => Boolean(activity))
        .filter((activity) => {
          if (!requestedElementId) return true;
          return (
            activity.elementId === requestedElementId ||
            activity.sourceElementId === requestedElementId
          );
        })
        .slice(-activityLimit);

      return {
        result: buildWorkspaceGenerationObservationResult({
          capabilities,
          controls,
          trace,
          activities,
        }),
      };
    },
  );

  registerBrowserTool(
    {
      id: "workspace.read_element_capabilities",
      title: "Read Element Capabilities",
      description:
        "Returns the available actions and inspection tools for a target workspace element.",
      category: "canvas",
      inputSchema: {
        elementId: "string",
      },
      outputSchema: {
        report: "WorkspaceElementCapabilitiesReport",
      },
      visibility: "agent",
    },
    (input) => {
      const requestedElementId =
        String(input?.elementId || "").trim() ||
        snapshotRef.current.selection.selectedElementId ||
        "";
      return {
        report: buildWorkspaceElementCapabilitiesReport({
          elementId: requestedElementId || null,
          snapshot: snapshotRef.current,
          elementSummaries: elementSummariesRef.current,
        }),
      };
    },
  );

  registerBrowserTool(
    {
      id: "workspace.read_element_controls",
      title: "Read Element Controls",
      description:
        "Returns the concrete parameter controls that are currently relevant for a target element.",
      category: "canvas",
      inputSchema: {
        elementId: "string",
      },
      outputSchema: {
        report: "WorkspaceElementControlsReport",
      },
      visibility: "agent",
    },
    (input) => {
      const requestedElementId =
        String(input?.elementId || "").trim() ||
        snapshotRef.current.selection.selectedElementId ||
        "";
      return {
        report: buildWorkspaceElementControlsReport({
          elementId: requestedElementId || null,
          snapshot: snapshotRef.current,
          elementSummaries: elementSummariesRef.current,
          imageModelOptions: imageModelOptionsRef.current,
          aspectRatioOptions: aspectRatioOptionsRef.current,
        }),
      };
    },
  );

  registerBrowserTool(
    {
      id: "workspace.await_generation_completion",
      title: "Await Generation Completion",
      description:
        "Waits for the current generation cycle to reach a terminal trace status, then returns a structured summary.",
      category: "image",
      inputSchema: {
        elementId: "string",
        requestId: "string",
        timeoutMs: "number",
        pollIntervalMs: "number",
        activityLimit: "number",
      },
      outputSchema: {
        result: "WorkspaceToolExecutionResult<WorkspaceAwaitGenerationPayload>",
      },
      visibility: "agent",
    },
    async (input, context) => {
      const requestedElementId =
        String(input?.elementId || "").trim() ||
        snapshotRef.current.selection.selectedElementId ||
        "";
      const requestedRequestId = String(input?.requestId || "").trim();
      const timeoutMs = Math.max(500, Math.min(120_000, Number(input?.timeoutMs || 45_000)));
      const pollIntervalMs = Math.max(
        200,
        Math.min(5_000, Number(input?.pollIntervalMs || 1_200)),
      );
      const activityLimit = Math.max(1, Math.min(12, Number(input?.activityLimit || 6)));

      if (!requestedElementId) {
        return {
          result: {
            ok: false,
            tool: "workspace.await_generation_completion",
            summary: "No target element is available for generation waiting.",
            issues: ["No elementId was provided and no element is currently selected."],
            retryable: true,
            payload: {
              elementId: null,
              requestId: null,
              status: null,
              terminal: false,
              timedOut: false,
              elapsedMs: 0,
              lastError: null,
              variantSummary: summarizeGenerationVariants([]),
              recentActivityKinds: [],
              recentActivitySummary: [],
            },
          },
        };
      }

      const startedAt = Date.now();
      let trace = requestedRequestId
        ? readWorkspaceGenerationTraceByRequestId(requestedRequestId)
        : readWorkspaceGenerationTraceByElementId(requestedElementId);

      while (Date.now() - startedAt < timeoutMs) {
        trace = requestedRequestId
          ? readWorkspaceGenerationTraceByRequestId(requestedRequestId)
          : readWorkspaceGenerationTraceByElementId(requestedElementId);
        const status = String(trace?.status || "").trim();
        if (status === "completed" || status === "failed") {
          break;
        }
        await sleep(pollIntervalMs);
      }

      trace = requestedRequestId
        ? readWorkspaceGenerationTraceByRequestId(requestedRequestId)
        : readWorkspaceGenerationTraceByElementId(requestedElementId);
      const elapsedMs = Date.now() - startedAt;
      const status = String(trace?.status || "").trim() || null;
      const terminal = status === "completed" || status === "failed";
      const timedOut = !terminal;
      const activities = readWorkspaceImageGenerationEvents(context)
        .map(toWorkspaceGenerationActivity)
        .filter((activity): activity is WorkspaceGenerationActivity => Boolean(activity))
        .filter((activity) => {
          if (requestedRequestId && activity.requestId === requestedRequestId) {
            return true;
          }
          return (
            activity.elementId === requestedElementId ||
            activity.sourceElementId === requestedElementId
          );
        })
        .slice(-activityLimit);
      const variantSummary = summarizeGenerationVariants(trace?.variantResults || []);
      const lastError = String(trace?.lastError || "").trim() || null;

      if (!trace) {
        return {
          result: {
            ok: false,
            tool: "workspace.await_generation_completion",
            summary: `No generation trace appeared for element ${requestedElementId} within ${elapsedMs}ms.`,
            issues: [
              "The generation trigger may not have started a trace yet, or the target element is invalid.",
            ],
            retryable: true,
            payload: {
              elementId: requestedElementId,
              requestId: requestedRequestId || null,
              status: null,
              terminal: false,
              timedOut: true,
              elapsedMs,
              lastError: null,
              variantSummary,
              recentActivityKinds: activities.map((item) => item.kind),
              recentActivitySummary: activities.map((item) => item.summary),
            },
          },
        };
      }

      return {
        result: {
          ok: status === "completed",
          tool: "workspace.await_generation_completion",
          summary: timedOut
            ? `Generation for ${requestedElementId} is still ${status || "running"} after ${elapsedMs}ms.`
            : status === "completed"
              ? `Generation for ${requestedElementId} completed in ${elapsedMs}ms.`
              : `Generation for ${requestedElementId} failed in ${elapsedMs}ms.`,
          issues:
            timedOut || status === "failed"
              ? [lastError || "The generation cycle did not reach a successful terminal state."]
              : undefined,
          suggestions:
            timedOut
              ? [
                  "Inspect the latest trace or activity and decide whether to keep waiting, retry, or adjust controls.",
                ]
              : status === "failed"
                ? [
                    "Inspect the trace and controls before retrying or replanning the next step.",
                  ]
                : undefined,
          retryable: timedOut || status === "failed",
          payload: {
            elementId: requestedElementId,
            requestId: trace.requestId || requestedRequestId || null,
            status,
            terminal,
            timedOut,
            elapsedMs,
            lastError,
            variantSummary,
            recentActivityKinds: activities.map((item) => item.kind),
            recentActivitySummary: activities.map((item) => item.summary),
          },
        },
      };
    },
  );

  registerBrowserTool(
    {
      id: "workspace.read_generation_trace",
      title: "Read Generation Trace",
      description:
        "Returns the latest structured orchestration and generation trace for an element.",
      category: "image",
      inputSchema: {
        elementId: "string",
        requestId: "string",
      },
      outputSchema: {
        trace: "WorkspaceGenerationTrace|null",
      },
      visibility: "agent",
    },
    (input) => {
      const requestedElementId =
        String(input?.elementId || "").trim() ||
        snapshotRef.current.selection.selectedElementId ||
        "";
      const requestedRequestId = String(input?.requestId || "").trim();
      return {
        trace: requestedRequestId
          ? readWorkspaceGenerationTraceByRequestId(requestedRequestId)
          : requestedElementId
            ? readWorkspaceGenerationTraceByElementId(requestedElementId)
          : null,
      };
    },
  );

  registerBrowserTool(
    {
      id: "workspace.diagnose_generation_trace",
      title: "Diagnose Generation Trace",
      description:
        "Analyzes the latest generation trace, activity, and control context to explain what failed, what was auto-repaired, and what should happen next.",
      category: "image",
      inputSchema: {
        elementId: "string",
        requestId: "string",
        activityLimit: "number",
      },
      outputSchema: {
        result: "WorkspaceToolExecutionResult<WorkspaceGenerationDiagnosisPayload>",
      },
      visibility: "agent",
    },
    (input, context) => {
      const requestedElementId =
        String(input?.elementId || "").trim() ||
        snapshotRef.current.selection.selectedElementId ||
        "";
      const requestedRequestId = String(input?.requestId || "").trim();
      const activityLimit = Math.max(1, Math.min(12, Number(input?.activityLimit || 8)));
      const capabilities = buildWorkspaceElementCapabilitiesReport({
        elementId: requestedElementId || null,
        snapshot: snapshotRef.current,
        elementSummaries: elementSummariesRef.current,
      });
      const controls = buildWorkspaceElementControlsReport({
        elementId: requestedElementId || null,
        snapshot: snapshotRef.current,
        elementSummaries: elementSummariesRef.current,
        imageModelOptions: imageModelOptionsRef.current,
        aspectRatioOptions: aspectRatioOptionsRef.current,
      });
      const trace = requestedRequestId
        ? readWorkspaceGenerationTraceByRequestId(requestedRequestId)
        : requestedElementId
          ? readWorkspaceGenerationTraceByElementId(requestedElementId)
          : null;
      const activities = readWorkspaceImageGenerationEvents(context)
        .map(toWorkspaceGenerationActivity)
        .filter((activity): activity is WorkspaceGenerationActivity => Boolean(activity))
        .filter((activity) => {
          if (requestedRequestId && activity.requestId === requestedRequestId) {
            return true;
          }
          if (!requestedElementId) return true;
          return (
            activity.elementId === requestedElementId ||
            activity.sourceElementId === requestedElementId
          );
        })
        .slice(-activityLimit);
      const runtimeErrors = readRelevantRuntimeErrorEvents(context, trace);

      return {
        result: buildWorkspaceGenerationDiagnosisResult({
          capabilities,
          controls,
          trace,
          activities,
          runtimeErrors,
        }),
      };
    },
  );

  registerBrowserTool(
    {
      id: "workspace.read_recent_generation_activity",
      title: "Read Recent Generation Activity",
      description:
        "Returns recent planner and image-generation activity extracted from workspace console events.",
      category: "image",
      inputSchema: {
        elementId: "string",
        requestId: "string",
        limit: "number",
      },
      outputSchema: {
        activities: "WorkspaceGenerationActivity[]",
      },
      visibility: "agent",
    },
    (input, context) => {
      const requestedElementId = String(input?.elementId || "").trim();
      const requestedRequestId = String(input?.requestId || "").trim();
      const limit = Math.max(1, Math.min(20, Number(input?.limit || 8)));
      const events = readWorkspaceImageGenerationEvents(context);
      const fallbackTraces =
        !requestedElementId && events.length === 0
          ? listRecentWorkspaceGenerationTraces(limit).map((trace) => ({
              id: trace.requestId,
              level: "info" as const,
              timestamp: trace.updatedAt,
              kind: `trace.${trace.status}`,
              requestId: trace.requestId,
              elementId: trace.requestElementId,
              sourceElementId: trace.sourceElementId,
              summary: [
                trace.status,
                trace.taskMode ? `taskMode=${trace.taskMode}` : null,
                trace.model ? `model=${trace.model}` : null,
                trace.planIntent ? `intent=${trace.planIntent}` : null,
                trace.planStrategy ? `strategy=${trace.planStrategy}` : null,
              ]
                .filter(Boolean)
                .join(" | "),
              context: {
                requestId: trace.requestId,
                composedPromptPreview: trace.composedPromptPreview || null,
                lastError: trace.lastError || null,
              },
            }))
          : [];
      const activities = events
        .map(toWorkspaceGenerationActivity)
        .filter((activity): activity is WorkspaceGenerationActivity => Boolean(activity))
        .filter((activity) => {
          if (requestedRequestId && activity.requestId === requestedRequestId) {
            return true;
          }
          if (!requestedElementId) return true;
          return (
            activity.elementId === requestedElementId ||
            activity.sourceElementId === requestedElementId
          );
        });
      return {
        activities:
          activities.length > 0 ? activities.slice(-limit) : fallbackTraces.slice(-limit),
      };
    },
  );

  return () => {
    WORKSPACE_BROWSER_AGENT_TOOL_IDS.forEach((toolId) => unregisterBrowserTool(toolId));
  };
};

const readWorkspaceImageGenerationEvents = (
  context?: BrowserToolExecutorContext,
): BrowserConsoleEvent[] => {
  if (!context) return [];
  return context.readRecentConsoleEvents({
    limit: 50,
  }).filter((event) => String(event.message || "").includes("[workspace.imggen]"));
};

const RELEVANT_RUNTIME_ERROR_PATTERNS = [
  /maximum update depth exceeded/i,
  /err_file_not_found/i,
  /an error occurred in one of your react components/i,
  /unhandled promise rejection/i,
  /failed to load image/i,
  /cannot read properties of undefined/i,
  /cannot destructure property/i,
];

const readRelevantRuntimeErrorEvents = (
  context?: BrowserToolExecutorContext,
  trace?: ReturnType<typeof readWorkspaceGenerationTraceByElementId>,
) => {
  if (!context) return [];
  const minTimestamp = Math.max(
    0,
    Number(trace?.startedAt || 0) - 10_000,
  );
  return context
    .readRecentConsoleEvents({
      level: "error",
      limit: 20,
    })
    .filter((event) => event.timestamp >= minTimestamp)
    .filter((event) => {
      const message = String(event.message || "");
      const source = String(event.source || "");
      if (
        source.includes("window.error") ||
        source.includes("window.unhandledrejection")
      ) {
        return true;
      }
      return RELEVANT_RUNTIME_ERROR_PATTERNS.some((pattern) =>
        pattern.test(message),
      );
    });
};

const toWorkspaceGenerationActivity = (
  event: BrowserConsoleEvent,
): WorkspaceGenerationActivity | null => {
  const kind = extractWorkspaceGenerationKind(event.message);
  if (!kind) return null;
  const context = parseFirstJsonPayload(event.payload || []);
  const requestId = readStringField(context, "requestId");
  const elementId = readStringField(context, "elementId");
  const sourceElementId = readStringField(context, "sourceElementId");
  return {
    id: event.id,
    level: event.level,
    timestamp: event.timestamp,
    kind,
    requestId,
    elementId,
    sourceElementId,
    summary: buildWorkspaceGenerationSummary(kind, context),
    context,
  };
};

const extractWorkspaceGenerationKind = (message: string): string | null => {
  const match = String(message || "").match(/\[workspace\.imggen\]\s+([a-z.]+)/i);
  return match?.[1] ? match[1].trim() : null;
};

const parseFirstJsonPayload = (
  payload: string[],
): Record<string, unknown> | null => {
  for (const item of payload) {
    const candidate = String(item || "").trim();
    if (!candidate.startsWith("{") && !candidate.startsWith("[")) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      continue;
    }
  }
  return null;
};

const readStringField = (
  context: Record<string, unknown> | null,
  key: string,
): string | null => {
  const value = context?.[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const buildWorkspaceGenerationSummary = (
  kind: string,
  context: Record<string, unknown> | null,
) => {
  const taskMode = readStringField(context, "taskMode");
  const planIntent = readStringField(context, "planIntent");
  const planStrategy = readStringField(context, "planStrategy");
  const model = readStringField(context, "model");
  const variant = readStringField(context, "variant");
  const taskUnitTitle = readStringField(context, "taskUnitTitle");
  const error = readStringField(context, "error");
  const parts = [kind];
  if (taskMode) parts.push(`taskMode=${taskMode}`);
  if (variant) parts.push(`variant=${variant}`);
  if (taskUnitTitle) parts.push(`page=${taskUnitTitle}`);
  if (model) parts.push(`model=${model}`);
  if (planIntent) parts.push(`intent=${planIntent}`);
  if (planStrategy) parts.push(`strategy=${planStrategy}`);
  if (error) parts.push(`error=${error}`);
  return parts.join(" | ");
};

const buildWorkspaceGenerationObservationResult = ({
  capabilities,
  controls,
  trace,
  activities,
}: {
  capabilities: WorkspaceElementCapabilitiesReport;
  controls: WorkspaceElementControlsReport;
  trace: ReturnType<typeof readWorkspaceGenerationTraceByElementId>;
  activities: WorkspaceGenerationActivity[];
}): WorkspaceToolExecutionResult<WorkspaceGenerationObservationPayload> => {
  const element = capabilities.element;
  const canGenerate = capabilities.actions.some(
    (action) => action.id === "workspace.generate_image" && action.enabled,
  );
  const canPreview = capabilities.actions.some(
    (action) => action.id === "workspace.open_preview" && action.enabled,
  );
  const issues: string[] = [];
  const suggestions: string[] = [];
  const recommendedNextActions: WorkspaceGenerationObservationPayload["recommendedNextActions"] =
    [];

  if (!element) {
    issues.push("Target element was not found.");
    suggestions.push("Select a valid canvas element before continuing.");
    recommendedNextActions.push({
      kind: "tool",
      id: "workspace.read_selected_element",
      reason: "Resolve the current workspace target first.",
    });
    return {
      ok: false,
      tool: "workspace.observe_generation_target",
      summary: "No valid target element is available yet.",
      issues,
      suggestions,
      retryable: true,
      payload: {
        targetElementId: capabilities.targetElementId,
        targetElementType: capabilities.targetElementType,
        targetTreeNodeKind: capabilities.targetTreeNodeKind,
        panelKind: controls.panelKind,
        isSelected: capabilities.isSelected,
        isGenerating: capabilities.isGenerating,
        hasGenerationTrace: capabilities.hasGenerationTrace,
        canGenerate,
        canPreview,
        promptPreview: null,
        referenceImageCount: 0,
        previewImageCount: 0,
        enabledActionIds: [],
        enabledToolIds: [],
        traceStatus: null,
        traceModel: null,
        tracePlanIntent: null,
        tracePlanStrategy: null,
        lastError: null,
        variantSummary: {
          total: 0,
          succeeded: 0,
          failed: 0,
          retrying: 0,
          generating: 0,
        },
        recentActivityKinds: [],
        recentActivitySummary: [],
        recommendedNextActions,
      },
    };
  }

  const variantSummary = summarizeGenerationVariants(trace?.variantResults || []);
  const enabledActionIds = capabilities.actions
    .filter((item) => item.enabled)
    .map((item) => item.id);
  const enabledToolIds = capabilities.tools
    .filter((item) => item.enabled)
    .map((item) => item.id);

  if (capabilities.isGenerating) {
    suggestions.push("Wait for the current generation cycle to finish, then inspect the structured result.");
    recommendedNextActions.push({
      kind: "tool",
      id: "workspace.await_generation_completion",
      reason: "A generation cycle is already in progress.",
    });
  }

  if (trace?.status === "failed" || variantSummary.failed > 0) {
    issues.push(trace?.lastError || "The latest generation cycle contains failures.");
    suggestions.push("Inspect the trace and controls before retrying the next generation.");
    recommendedNextActions.push({
      kind: "tool",
      id: "workspace.diagnose_generation_trace",
      reason: "Explain the failure cause, repaired issues, and remaining risks before retrying.",
    });
    recommendedNextActions.push({
      kind: "host_action",
      id: "workspace.repair_generation_state",
      reason: "Repair the current element state before deciding whether a retry is safe.",
    });
    if (canGenerate) {
      recommendedNextActions.push({
        kind: "host_action",
        id: "workspace.generate_image",
        reason: "The element can be retried after inspection or adjustment.",
      });
    }
  }

  if (!trace && canGenerate) {
    suggestions.push("No generation trace exists yet; the element is ready for a first run.");
    recommendedNextActions.push({
      kind: "host_action",
      id: "workspace.generate_image",
      reason: "This element appears ready for generation.",
    });
  }

  if (controls.controls.length > 0) {
    recommendedNextActions.push({
      kind: "tool",
      id: "workspace.read_element_controls",
      reason: "Inspect the concrete editable controls before mutating state.",
    });
  }

  if (canPreview && trace?.status === "completed") {
    suggestions.push("Open preview if you need to inspect the latest generated asset.");
    recommendedNextActions.push({
      kind: "host_action",
      id: "workspace.open_preview",
      reason: "A completed output is available for review.",
    });
  }

  const summary = buildWorkspaceObservationSummary({
    element,
    canGenerate,
    trace,
    variantSummary,
    activityCount: activities.length,
  });

  return {
    ok: issues.length === 0 || capabilities.isGenerating || canGenerate,
    tool: "workspace.observe_generation_target",
    summary,
    issues: issues.length > 0 ? issues : undefined,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
    retryable: Boolean(canGenerate || capabilities.isGenerating),
    payload: {
      targetElementId: capabilities.targetElementId,
      targetElementType: capabilities.targetElementType,
      targetTreeNodeKind: capabilities.targetTreeNodeKind,
      panelKind: controls.panelKind,
      isSelected: capabilities.isSelected,
      isGenerating: capabilities.isGenerating,
      hasGenerationTrace: capabilities.hasGenerationTrace,
      canGenerate,
      canPreview,
      promptPreview: element.generation.promptPreview || null,
      referenceImageCount: element.content.referenceImageCount,
      previewImageCount: element.content.previewImageCount,
      enabledActionIds,
      enabledToolIds,
      traceStatus: trace?.status || null,
      traceModel: trace?.model || null,
      tracePlanIntent: trace?.planIntent || null,
      tracePlanStrategy: trace?.planStrategy || null,
      lastError: trace?.lastError || null,
      variantSummary,
      recentActivityKinds: activities.map((item) => item.kind),
      recentActivitySummary: activities.map((item) => item.summary),
      recommendedNextActions,
    },
  };
};

const buildWorkspaceGenerationDiagnosisResult = ({
  capabilities,
  controls,
  trace,
  activities,
  runtimeErrors,
}: {
  capabilities: WorkspaceElementCapabilitiesReport;
  controls: WorkspaceElementControlsReport;
  trace: ReturnType<typeof readWorkspaceGenerationTraceByElementId>;
  activities: WorkspaceGenerationActivity[];
  runtimeErrors: BrowserConsoleEvent[];
}): WorkspaceToolExecutionResult<WorkspaceGenerationDiagnosisPayload> => {
  const canGenerate = capabilities.actions.some(
    (action) => action.id === "workspace.generate_image" && action.enabled,
  );
  const canPreview = capabilities.actions.some(
    (action) => action.id === "workspace.open_preview" && action.enabled,
  );
  const diagnosisItems: WorkspaceGenerationDiagnosisItem[] = [];
  const recommendedNextActions: WorkspaceGenerationDiagnosisPayload["recommendedNextActions"] =
    [];

  (trace?.diagnostics || []).forEach((item) => {
    diagnosisItems.push({
      code: item.code,
      source: item.source,
      severity: item.severity,
      message: item.message,
      repaired: Boolean(item.repaired),
      repairSummary: item.repairSummary || null,
      detail: item.detail || null,
    });
  });

  if (
    trace?.lastError &&
    !diagnosisItems.some((item) => item.message === trace.lastError)
  ) {
    diagnosisItems.push({
      code: "last_error",
      source: "generation",
      severity: trace.status === "failed" ? "error" : "warning",
      message: trace.lastError,
      repaired: false,
      repairSummary: null,
      detail: null,
    });
  }

  if (
    (trace?.manualReferenceCount || 0) > 0 &&
    (trace?.referenceCount || 0) === 0
  ) {
    diagnosisItems.push({
      code: "reference_chain_empty",
      source: "reference-preflight",
      severity: "error",
      message: "The element had reference images configured, but none reached the generation planner.",
      repaired: false,
      repairSummary: null,
      detail: null,
    });
  }

  if (
    trace?.taskMode === "set" &&
    (!Array.isArray(trace.taskPages) || trace.taskPages.length === 0)
  ) {
    diagnosisItems.push({
      code: "set_pages_missing",
      source: "task-planner",
      severity: "error",
      message: "The task was classified as a multi-page set, but the plan does not currently expose page cards.",
      repaired: false,
      repairSummary: null,
      detail: null,
    });
  }

  if (activities.some((item) => item.kind === "task-planner.failed")) {
    diagnosisItems.push({
      code: "task_planner_failed",
      source: "task-planner",
      severity: "error",
      message: "The task planner failed before image generation started.",
      repaired: false,
      repairSummary: null,
      detail: null,
    });
  }

  if (activities.some((item) => item.kind === "planner.failed")) {
    diagnosisItems.push({
      code: "planner_failed",
      source: "planner",
      severity: "error",
      message: "The visual orchestration planner failed while composing the generation prompt.",
      repaired: false,
      repairSummary: null,
      detail: null,
    });
  }

  runtimeErrors.forEach((event) => {
    diagnosisItems.push({
      code: "runtime_error",
      source: event.source || "runtime",
      severity: "error",
      message: String(event.message || "A runtime error was captured."),
      repaired: false,
      repairSummary: null,
      detail: Array.isArray(event.payload) ? event.payload.join(" | ") : null,
    });
  });

  const uniqueDiagnosisItems = diagnosisItems.filter((item, index, list) => {
    const key = `${item.code}|${item.message}|${item.repaired}`;
    return list.findIndex((candidate) => {
      const candidateKey = `${candidate.code}|${candidate.message}|${candidate.repaired}`;
      return candidateKey === key;
    }) === index;
  });

  const repairedIssueCount = uniqueDiagnosisItems.filter((item) => item.repaired).length;
  const unresolvedIssueCount = uniqueDiagnosisItems.filter(
    (item) => !item.repaired && item.severity !== "info",
  ).length;
  const hasReferenceIssue = uniqueDiagnosisItems.some(
    (item) =>
      item.source === "reference-preflight" &&
      item.severity !== "info" &&
      !item.repaired,
  );

  if (hasReferenceIssue) {
    recommendedNextActions.push({
      kind: "tool",
      id: "workspace.read_element_controls",
      reason: "Inspect the current reference-image control and verify the input chain.",
    });
    if (capabilities.targetElementId) {
      recommendedNextActions.push({
        kind: "host_action",
        id: "workspace.repair_generation_state",
        reason: "Rebuild the current element reference chain from available preview inputs before retrying.",
      });
    }
  }

  const hasRuntimeIssue = uniqueDiagnosisItems.some(
    (item) =>
      String(item.source || "").includes("window.") ||
      String(item.source || "").includes("runtime") ||
      /maximum update depth exceeded|react component/i.test(item.message),
  );

  if (hasRuntimeIssue && capabilities.targetElementId) {
    recommendedNextActions.push({
      kind: "host_action",
      id: "workspace.repair_generation_state",
      reason: "Reset stale generation error state and repair the current element before deciding whether to retry.",
    });
  }

  if (trace?.status === "failed" && canGenerate) {
    recommendedNextActions.push({
      kind: "host_action",
      id: "workspace.generate_image",
      reason: "Retry only after reviewing the diagnosis and fixing the relevant controls.",
    });
  }

  if (canPreview && trace?.status === "completed") {
    recommendedNextActions.push({
      kind: "host_action",
      id: "workspace.open_preview",
      reason: "Review the latest output together with the diagnosis results.",
    });
  }

  if (recommendedNextActions.length === 0 && canGenerate) {
    recommendedNextActions.push({
      kind: "host_action",
      id: "workspace.generate_image",
      reason: "No blocking structural issue is visible; the element is ready for execution.",
    });
  }

  const summary =
    unresolvedIssueCount > 0
      ? `Detected ${unresolvedIssueCount} unresolved generation issue(s) for ${capabilities.targetElementId || "the current element"}.`
      : repairedIssueCount > 0
        ? `Detected ${repairedIssueCount} repaired issue(s); the latest trace already shows self-healing activity.`
        : trace
          ? `No structural generation issue is visible in the latest trace for ${capabilities.targetElementId || "the current element"}.`
          : "No generation trace is available yet, so there is nothing concrete to diagnose.";

  return {
    ok: unresolvedIssueCount === 0,
    tool: "workspace.diagnose_generation_trace",
    summary,
    issues:
      unresolvedIssueCount > 0
        ? uniqueDiagnosisItems
            .filter((item) => !item.repaired && item.severity !== "info")
            .map((item) => item.message)
        : undefined,
    suggestions:
      hasReferenceIssue
        ? [
            "At least one reference input is unreadable. Re-upload the original reference image if the preview fallback is unavailable or too low fidelity.",
          ]
        : hasRuntimeIssue
          ? [
              "A browser/runtime error was captured during this run. Inspect the runtime diagnosis before retrying so the same UI-state fault does not loop again.",
            ]
        : trace?.status === "failed"
          ? [
              "Inspect the diagnosis items before retrying so the next run does not repeat the same planner or reference failure.",
            ]
          : undefined,
    retryable: Boolean(canGenerate || capabilities.isGenerating),
    payload: {
      elementId: capabilities.targetElementId,
      requestId: trace?.requestId || null,
      status: trace?.status || null,
      lastError: trace?.lastError || null,
      diagnosisItems: uniqueDiagnosisItems,
      repairedIssueCount,
      unresolvedIssueCount,
      recentActivityKinds: activities.map((item) => item.kind),
      recentActivitySummary: activities.map((item) => item.summary),
      recommendedNextActions,
    },
  };
};

const summarizeGenerationVariants = (
  variants: Array<{ status: string }> = [],
) => ({
  total: variants.length,
  succeeded: variants.filter((item) => item.status === "succeeded").length,
  failed: variants.filter((item) => item.status === "failed").length,
  retrying: variants.filter((item) => item.status === "retrying").length,
  generating: variants.filter((item) => item.status === "generating").length,
});

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const buildWorkspaceObservationSummary = ({
  element,
  canGenerate,
  trace,
  variantSummary,
  activityCount,
}: {
  element: WorkspaceBrowserAgentElementSummary;
  canGenerate: boolean;
  trace: ReturnType<typeof readWorkspaceGenerationTraceByElementId>;
  variantSummary: ReturnType<typeof summarizeGenerationVariants>;
  activityCount: number;
}) => {
  const parts = [
    `element=${element.id}`,
    element.grouping.treeNodeKind ? `kind=${element.grouping.treeNodeKind}` : null,
    trace?.status ? `trace=${trace.status}` : null,
    trace?.model ? `model=${trace.model}` : null,
    variantSummary.total > 0
      ? `variants=${variantSummary.succeeded}/${variantSummary.total} succeeded`
      : null,
    canGenerate ? "ready_to_generate=true" : null,
    activityCount > 0 ? `recent_activity=${activityCount}` : null,
  ];
  return parts.filter(Boolean).join(" | ");
};

const buildWorkspaceElementCapabilitiesReport = ({
  elementId,
  snapshot,
  elementSummaries,
}: {
  elementId: string | null;
  snapshot: WorkspaceBrowserAgentSnapshot;
  elementSummaries: WorkspaceBrowserAgentElementSummary[];
}): WorkspaceElementCapabilitiesReport => {
  const normalizedElementId = String(elementId || "").trim() || null;
  const element =
    (normalizedElementId
      ? elementSummaries.find((item) => item.id === normalizedElementId)
      : null) || null;
  const hasGenerationTrace = Boolean(
    normalizedElementId && readWorkspaceGenerationTraceByElementId(normalizedElementId),
  );
  const isSelected =
    Boolean(normalizedElementId) &&
    (snapshot.selection.selectedElementId === normalizedElementId ||
      snapshot.selection.selectedElementIds.includes(normalizedElementId as string));
  const canPreview = Boolean(element && isPreviewableElement(element));
  const canGenerate = Boolean(element && isGeneratableElement(element));
  const isGenerating = Boolean(element?.generation.isGenerating);

  const actions: WorkspaceElementToolAvailability[] = [
    buildAvailability({
      kind: "action",
      id: "workspace.select_element",
      title: "Select Element",
      description: "Select this element in the workspace.",
      enabled: Boolean(element && !isSelected),
      reason: !element
        ? "Target element was not found."
        : isSelected
          ? "Element is already selected."
          : null,
    }),
    buildAvailability({
      kind: "action",
      id: "workspace.open_preview",
      title: "Open Preview",
      description: "Open the element preview if it has a previewable asset.",
      enabled: canPreview,
      reason: !element
        ? "Target element was not found."
        : canPreview
          ? null
          : "Element has no previewable asset.",
    }),
    buildAvailability({
      kind: "action",
      id: "workspace.update_element_control",
      title: "Update Element Control",
      description: "Write a concrete toolbar control value for this element.",
      enabled: Boolean(element && getWorkspaceElementPanelKind(element)),
      reason: !element
        ? "Target element was not found."
        : getWorkspaceElementPanelKind(element)
          ? null
          : "This element does not currently expose a mapped toolbar panel.",
    }),
    buildAvailability({
      kind: "action",
      id: "workspace.generate_image",
      title: "Generate Image",
      description: "Trigger image generation for this element.",
      enabled: canGenerate && !isGenerating,
      reason: !element
        ? "Target element was not found."
        : !canGenerate
          ? "Element does not currently have a runnable image-generation configuration."
          : isGenerating
            ? "Element is already generating."
            : null,
    }),
  ];

  const tools: WorkspaceElementToolAvailability[] = [
    buildAvailability({
      kind: "tool",
      id: "workspace.observe_generation_target",
      title: "Observe Generation Target",
      description:
        "Read a structured observation result with summary, issues, and recommended next actions.",
      enabled: Boolean(element),
      reason: element ? null : "Target element was not found.",
    }),
    buildAvailability({
      kind: "tool",
      id: "workspace.read_element_controls",
      title: "Read Element Controls",
      description: "Inspect the concrete toolbar controls for this element.",
      enabled: Boolean(element && getWorkspaceElementPanelKind(element)),
      reason: !element
        ? "Target element was not found."
        : getWorkspaceElementPanelKind(element)
          ? null
          : "This element does not currently expose a mapped toolbar panel.",
    }),
    buildAvailability({
      kind: "tool",
      id: "workspace.await_generation_completion",
      title: "Await Generation Completion",
      description: "Wait until the current generation cycle reaches a terminal status or times out.",
      enabled: Boolean(element && (hasGenerationTrace || isGenerating || canGenerate)),
      reason: !element
        ? "Target element was not found."
        : hasGenerationTrace || isGenerating || canGenerate
          ? null
          : "No generation cycle is available to wait on yet.",
    }),
    buildAvailability({
      kind: "tool",
      id: "workspace.read_generation_trace",
      title: "Read Generation Trace",
      description: "Read the latest structured orchestration and generation trace.",
      enabled: Boolean(element && (hasGenerationTrace || isGenerating || canGenerate)),
      reason: !element
        ? "Target element was not found."
        : hasGenerationTrace || isGenerating || canGenerate
          ? null
          : "No generation trace is available for this element yet.",
    }),
    buildAvailability({
      kind: "tool",
      id: "workspace.read_recent_generation_activity",
      title: "Read Recent Generation Activity",
      description: "Inspect recent planner and generation events for this element.",
      enabled: Boolean(element),
      reason: element ? null : "Target element was not found.",
    }),
    buildAvailability({
      kind: "tool",
      id: "workspace.read_selected_element",
      title: "Read Selected Element",
      description: "Inspect the current selected element summary.",
      enabled: snapshot.selection.selectedCount > 0,
      reason:
        snapshot.selection.selectedCount > 0 ? null : "No element is currently selected.",
    }),
  ];

  return {
    targetElementId: normalizedElementId,
    targetElementType: element?.type || null,
    targetTreeNodeKind: element?.grouping.treeNodeKind || null,
    isSelected: Boolean(isSelected),
    isGenerating,
    hasGenerationTrace,
    element,
    actions,
    tools,
  };
};

const buildAvailability = (
  input: WorkspaceElementToolAvailability,
): WorkspaceElementToolAvailability => ({
  ...input,
  reason: input.enabled ? null : input.reason || "Unavailable.",
});

const isPreviewableElement = (element: WorkspaceBrowserAgentElementSummary) =>
  element.content.hasOriginalUrl ||
  element.content.hasProxyUrl ||
  element.content.hasImageUrl ||
  element.content.previewImageCount > 0 ||
  element.content.referenceImageCount > 0;

const isGeneratableElement = (element: WorkspaceBrowserAgentElementSummary) =>
  element.generation.hasPrompt ||
  (element.grouping.treeNodeKind === "image" && Boolean(element.grouping.nodeParentId));

const buildWorkspaceElementControlsReport = ({
  elementId,
  snapshot,
  elementSummaries,
  imageModelOptions,
  aspectRatioOptions,
}: {
  elementId: string | null;
  snapshot: WorkspaceBrowserAgentSnapshot;
  elementSummaries: WorkspaceBrowserAgentElementSummary[];
  imageModelOptions: WorkspaceBrowserAgentModelOption[];
  aspectRatioOptions: WorkspaceBrowserAgentAspectRatioOption[];
}): WorkspaceElementControlsReport => {
  const normalizedElementId = String(elementId || "").trim() || null;
  const element =
    (normalizedElementId
      ? elementSummaries.find((item) => item.id === normalizedElementId)
      : null) || null;
  const panelKind = getWorkspaceElementPanelKind(element);
  if (!element || !panelKind) {
    return {
      targetElementId: normalizedElementId,
      targetElementType: element?.type || null,
      panelKind,
      controls: [],
    };
  }

  const controls: WorkspaceElementControlDefinition[] = [];
  if (panelKind === "tree-prompt-toolbar" || panelKind === "empty-gen-image-panel") {
    controls.push(
      buildElementControl({
        id: "genPrompt",
        title: "Prompt",
        controlType: "textarea",
        source: "element",
        currentValue: element.generation.promptPreview || "",
        enabled: true,
        metadata: {
          truncated: Boolean(element.generation.promptPreview?.endsWith("...")),
        },
      }),
      buildElementControl({
        id: "genModel",
        title: "Model",
        controlType: "select",
        source: "element",
        currentValue:
          element.generation.model
            ? buildModelOptionValue({
                id: element.generation.model,
                providerId: element.generation.providerId || null,
                name: element.generation.model,
              })
            : null,
        enabled: imageModelOptions.length > 0,
        reason:
          imageModelOptions.length > 0 ? null : "No mapped image models are available.",
        options: imageModelOptions.map((option) => ({
          value: buildModelOptionValue(option),
          label: option.providerName ? `${option.name} / ${option.providerName}` : option.name,
          description: option.desc || option.time,
        })),
      }),
      buildElementControl({
        id: "genImageCount",
        title: "Image Count",
        controlType: "select",
        source: "element",
        currentValue: String(element.generation.imageCount || 1),
        enabled: true,
        options: IMAGE_COUNT_CONTROL_OPTIONS,
      }),
      buildElementControl({
        id: "genResolution",
        title: "Resolution",
        controlType: "select",
        source: "element",
        currentValue: element.generation.resolution || "1K",
        enabled: true,
        options: IMAGE_RESOLUTION_CONTROL_OPTIONS,
      }),
      buildElementControl({
        id: "genAspectRatio",
        title: "Aspect Ratio",
        controlType: "select",
        source: "element",
        currentValue: element.generation.aspectRatio || "1:1",
        enabled: aspectRatioOptions.length > 0,
        reason:
          aspectRatioOptions.length > 0 ? null : "No aspect ratio options are currently loaded.",
        options: aspectRatioOptions.map((option) => ({
          value: option.value,
          label: option.label,
          description: option.size,
        })),
      }),
      buildElementControl({
        id: "genImageQuality",
        title: "Quality",
        controlType: "select",
        source: "element",
        currentValue: element.generation.quality || "medium",
        enabled: true,
        options: IMAGE_QUALITY_CONTROL_OPTIONS,
      }),
      buildElementControl({
        id: "genRefImages",
        title: "Reference Images",
        controlType: "upload",
        source: "element",
        currentValue: String(element.content.referenceImageCount),
        enabled: true,
        metadata: {
          referenceImageCount: element.content.referenceImageCount,
          previewImageCount: element.content.previewImageCount,
        },
      }),
      buildElementControl({
        id: "generate",
        title: "Generate",
        controlType: "action",
        source: "element",
        currentValue: null,
        enabled: isGeneratableElement(element) && !element.generation.isGenerating,
        reason: !isGeneratableElement(element)
          ? "Element does not currently have a runnable generation prompt."
          : element.generation.isGenerating
            ? "Element is already generating."
            : null,
      }),
    );
  }

  if (panelKind === "tree-prompt-toolbar") {
    controls.unshift(
      buildElementControl({
        id: "treeNodeTone",
        title: "Node Tone",
        controlType: "select",
        source: "element",
        currentValue: element.grouping.treeNodeTone || "lavender",
        enabled: true,
        options: TREE_PROMPT_TONE_CONTROL_OPTIONS,
      }),
    );
    controls.push(
      buildElementControl({
        id: "genReferenceRoleMode",
        title: "Style Library",
        controlType: "select",
        source: "element",
        currentValue: element.generation.referenceRoleMode || "default",
        enabled: true,
        options: buildStyleLibraryControlOptions(element),
      }),
      buildElementControl({
        id: "genInfiniteRetry",
        title: "Berserk Retry",
        controlType: "toggle",
        source: "element",
        currentValue: element.generation.infiniteRetry,
        enabled: true,
      }),
    );
  }

  if (panelKind === "image-toolbar") {
    controls.push(
      buildElementControl({
        id: "preview",
        title: "Preview",
        controlType: "action",
        source: "element",
        currentValue: null,
        enabled: isPreviewableElement(element),
        reason: isPreviewableElement(element) ? null : "Element has no previewable asset.",
      }),
      buildElementControl({
        id: "read_generation_trace",
        title: "Read Generation Trace",
        controlType: "readonly",
        source: "element",
        currentValue: readWorkspaceGenerationTraceByElementId(normalizedElementId || "") ? "available" : "none",
        enabled: true,
      }),
    );
  }

  return {
    targetElementId: normalizedElementId,
    targetElementType: element.type,
    panelKind,
    controls,
  };
};

const buildElementControl = (
  input: WorkspaceElementControlInput,
): WorkspaceElementControlDefinition => ({
  ...input,
  reason: input.enabled ? null : input.reason || "Unavailable.",
});

const getWorkspaceElementPanelKind = (
  element: WorkspaceBrowserAgentElementSummary | null,
) => {
  if (!element) return null;
  if (element.grouping.treeNodeKind === "prompt") return "tree-prompt-toolbar";
  if (element.type === "gen-image") {
    return isPreviewableElement(element) ? "image-toolbar" : "empty-gen-image-panel";
  }
  if (element.type === "image") return "image-toolbar";
  return null;
};

const buildStyleLibraryControlOptions = (
  element: WorkspaceBrowserAgentElementSummary,
): WorkspaceElementControlOption[] => {
  const canUsePosterProductMode = element.content.referenceImageCount >= 2;
  return [
    {
      value: "none",
      label: "None",
      description: "Disable hidden orchestration constraints.",
    },
    {
      value: "default",
      label: "Default",
      description: "Use the general visual-orchestration style library.",
    },
    {
      value: "poster-product",
      label: "Poster/Product",
      description: canUsePosterProductMode
        ? "Use poster reference + product reference mode."
        : "Requires at least two reference images.",
      disabled: !canUsePosterProductMode,
    },
  ];
};

const buildModelOptionValue = (option: WorkspaceBrowserAgentModelOption) =>
  option.providerId ? `${option.id}::${option.providerId}` : option.id;

const IMAGE_COUNT_CONTROL_OPTIONS: WorkspaceElementControlOption[] = [
  { value: "1", label: "1p" },
  { value: "2", label: "2p" },
  { value: "3", label: "3p" },
  { value: "4", label: "4p" },
];

const IMAGE_RESOLUTION_CONTROL_OPTIONS: WorkspaceElementControlOption[] = [
  { value: "1K", label: "1K" },
  { value: "2K", label: "2K" },
  { value: "4K", label: "4K" },
];

const IMAGE_QUALITY_CONTROL_OPTIONS: WorkspaceElementControlOption[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const TREE_PROMPT_TONE_CONTROL_OPTIONS: WorkspaceElementControlOption[] = [
  { value: "lavender", label: "Lavender" },
  { value: "mint", label: "Mint" },
  { value: "peach", label: "Peach" },
  { value: "sky", label: "Sky" },
  { value: "sand", label: "Sand" },
];
