import { getRuntimeSettingsSnapshot } from "../runtime-settings";
import { ensureBrowserConsoleBridge, readRecentConsoleEvents } from "./console-bridge";
import { planBrowserAgentGoalSession } from "./goal-planner";
import {
  buildBrowserAgentSessionPresetSpec,
  listBrowserAgentSessionPresets,
  readBrowserAgentSessionPreset,
} from "./session-presets";
import {
  appendBrowserAgentSessionSteps,
  cancelBrowserAgentSession,
  configureBrowserAgentSessionRuntime,
  getBrowserAgentSessionStats,
  listBrowserAgentSessions,
  readBrowserAgentSession,
  resumeBrowserAgentSession,
  startBrowserAgentSession,
  type BrowserAgentSessionRecord,
  updateBrowserAgentSessionMetadata,
} from "./session-runtime";
import {
  executeBrowserTool,
  listBrowserTools,
  registerBrowserTool,
  type BrowserToolDefinition,
} from "./tool-registry";

export type BrowserAgentHostActionDefinition = {
  id: string;
  title: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  dangerous?: boolean;
  needsConfirmation?: boolean;
};

export type BrowserAgentHost = {
  id: string;
  kind: "canvas";
  title: string;
  actions: BrowserAgentHostActionDefinition[];
  metadata?: Record<string, unknown>;
  getSnapshot?: () => unknown;
  invokeAction?: (
    actionId: string,
    input?: Record<string, unknown>,
  ) => unknown | Promise<unknown>;
};

export type BrowserAgentHostSummary = {
  id: string;
  kind: BrowserAgentHost["kind"];
  title: string;
  actions: BrowserAgentHostActionDefinition[];
  metadata?: Record<string, unknown>;
  hasSnapshot: boolean;
  canInvokeActions: boolean;
};

export type BrowserAgentRuntimeSnapshot = {
  initialized: boolean;
  hostCount: number;
  toolCount: number;
  settingsVersion: string;
  sessionCount: number;
  runningSessionCount: number;
};

const hosts = new Map<string, BrowserAgentHost>();
let initialized = false;
let builtInToolsRegistered = false;

const normalizeHostActionDefinition = (
  action: BrowserAgentHostActionDefinition,
): BrowserAgentHostActionDefinition => {
  const id = String(action.id || "").trim();
  if (!id) {
    throw new Error("Browser host action id is required.");
  }
  return {
    ...action,
    id,
    title: String(action.title || id).trim(),
    description: String(action.description || "").trim(),
    inputSchema: action.inputSchema || {},
    outputSchema: action.outputSchema || {},
    dangerous: Boolean(action.dangerous),
    needsConfirmation: Boolean(action.needsConfirmation),
  };
};

const summarizeBrowserAgentHost = (
  host: BrowserAgentHost,
): BrowserAgentHostSummary => ({
  id: host.id,
  kind: host.kind,
  title: host.title,
  actions: host.actions.map(normalizeHostActionDefinition),
  metadata: host.metadata ? { ...host.metadata } : undefined,
  hasSnapshot: typeof host.getSnapshot === "function",
  canInvokeActions: typeof host.invokeAction === "function",
});

const registerBuiltInBrowserTools = () => {
  if (builtInToolsRegistered) return;
  builtInToolsRegistered = true;

  const builtIns: Array<{
    definition: BrowserToolDefinition;
    executor: Parameters<typeof registerBrowserTool>[1];
  }> = [
    {
      definition: {
        id: "browser.wait",
        title: "Wait",
        description: "Pauses the browser-agent workflow for a bounded amount of time.",
        category: "workflow",
        inputSchema: {
          ms: "number",
        },
        outputSchema: {
          waitedMs: "number",
          startedAt: "number",
          completedAt: "number",
        },
        visibility: "agent",
      },
      executor: async (input) => {
        const waitedMs = Math.max(0, Math.min(60_000, Number(input?.ms || 0)));
        const startedAt = Date.now();
        await new Promise<void>((resolve) => {
          window.setTimeout(() => resolve(), waitedMs);
        });
        return {
          waitedMs,
          startedAt,
          completedAt: Date.now(),
        };
      },
    },
    {
      definition: {
        id: "browser.list_tools",
        title: "List Browser Tools",
        description: "Returns registered browser tools.",
        category: "debug",
        inputSchema: {},
        outputSchema: {
          tools: "BrowserToolDefinition[]",
        },
        visibility: "agent",
      },
      executor: () => ({ tools: listBrowserTools() }),
    },
    {
      definition: {
        id: "browser.read_recent_console",
        title: "Read Recent Console",
        description: "Returns recent console events with optional filters.",
        category: "debug",
        inputSchema: {
          level: "log|info|warn|error",
          sourceIncludes: "string",
          limit: "number",
        },
        outputSchema: {
          events: "BrowserConsoleEvent[]",
        },
        visibility: "agent",
      },
      executor: (input) => ({
        events: readRecentConsoleEvents({
          level: input?.level as "log" | "info" | "warn" | "error" | undefined,
          sourceIncludes: String(input?.sourceIncludes || ""),
          limit: Number(input?.limit || 20),
        }),
      }),
    },
    {
      definition: {
        id: "browser.read_host_snapshot",
        title: "Read Host Snapshot",
        description: "Returns a registered browser host summary and live snapshot.",
        category: "debug",
        inputSchema: {
          hostId: "string",
        },
        outputSchema: {
          host: "BrowserAgentHostSummary",
          snapshot: "unknown",
        },
        visibility: "agent",
      },
      executor: (input) => {
        const requestedHostId = String(input?.hostId || "").trim();
        return readBrowserAgentHostSnapshot(requestedHostId || undefined);
      },
    },
    {
      definition: {
        id: "browser.read_host_actions",
        title: "Read Host Actions",
        description: "Returns the registered action definitions for a browser host.",
        category: "debug",
        inputSchema: {
          hostId: "string",
        },
        outputSchema: {
          host: "BrowserAgentHostSummary",
          actions: "BrowserAgentHostActionDefinition[]",
        },
        visibility: "agent",
      },
      executor: (input) => {
        const requestedHostId = String(input?.hostId || "").trim();
        const hostSummary = readBrowserAgentHostSummary(requestedHostId || undefined);
        return {
          host: hostSummary,
          actions: hostSummary.actions,
        };
      },
    },
    {
      definition: {
        id: "browser.invoke_host_action",
        title: "Invoke Host Action",
        description: "Invokes a registered host action with structured input.",
        category: "system",
        inputSchema: {
          hostId: "string",
          actionId: "string",
          input: "Record<string, unknown>",
        },
        outputSchema: {
          hostId: "string",
          actionId: "string",
          result: "unknown",
        },
        visibility: "agent",
      },
      executor: async (input) => {
        const requestedHostId = String(input?.hostId || "").trim();
        const actionId = String(input?.actionId || "").trim();
        return {
          hostId: requestedHostId || null,
          actionId,
          result: await invokeBrowserAgentHostAction(
            requestedHostId || undefined,
            actionId,
            isPlainRecord(input?.input) ? (input?.input as Record<string, unknown>) : {},
          ),
        };
      },
    },
    {
      definition: {
        id: "browser.list_session_presets",
        title: "List Browser Session Presets",
        description: "Returns the available high-level browser-agent session presets.",
        category: "workflow",
        inputSchema: {},
        outputSchema: {
          presets: "BrowserAgentSessionPresetDefinition[]",
        },
        visibility: "agent",
      },
      executor: () => ({
        presets: listBrowserAgentSessionPresets(),
      }),
    },
    {
      definition: {
        id: "browser.plan_goal_session",
        title: "Plan Goal Session",
        description:
          "Uses the configured browser agent model to turn a high-level goal into an executable browser session plan.",
        category: "workflow",
        inputSchema: {
          goal: "string",
          hostId: "string",
          targetElementId: "string",
          includeConsole: "boolean",
          recentConsoleLimit: "number",
          recentSession: "BrowserAgentSessionRecord",
          referenceImages: "string[]",
        },
        outputSchema: {
          plan: "BrowserAgentGoalSessionPlan",
        },
        visibility: "agent",
      },
      executor: async (input) => {
        const includeConsole =
          getRuntimeSettingsSnapshot().value.agent.allowConsoleRead &&
          input?.includeConsole !== false;
        const requestedHostId = String(input?.hostId || "").trim() || undefined;
        const hostSummary = requestedHostId
          ? readBrowserAgentHostSummary(requestedHostId)
          : listBrowserAgentHosts()[0] || null;
        const hostSnapshot = hostSummary
          ? readBrowserAgentHostSnapshot(hostSummary.id).snapshot
          : null;
        const recentConsoleLimit = Math.max(
          0,
          Math.min(20, Number(input?.recentConsoleLimit || 8)),
        );
        const recentConsole = includeConsole
          ? readRecentConsoleEvents({ limit: recentConsoleLimit || 8 })
          : [];

        return {
          plan: await planBrowserAgentGoalSession({
            goal: String(input?.goal || "").trim(),
            host: hostSummary,
            hostSnapshot,
            tools: listBrowserTools(),
            recentConsole,
            recentSession: isPlainRecord(input?.recentSession)
              ? (input?.recentSession as BrowserAgentSessionRecord)
              : null,
            targetElementId: String(input?.targetElementId || "").trim() || null,
            referenceImages: normalizeStringArray(input?.referenceImages, 4),
          }),
        };
      },
    },
    {
      definition: {
        id: "browser.start_goal_session",
        title: "Start Goal Session",
        description:
          "Plans a high-level goal with the browser agent model, then starts the resulting browser session.",
        category: "workflow",
        inputSchema: {
          goal: "string",
          hostId: "string",
          targetElementId: "string",
          includeConsole: "boolean",
          recentConsoleLimit: "number",
          recentSession: "BrowserAgentSessionRecord",
          referenceImages: "string[]",
          autoStart: "boolean",
        },
        outputSchema: {
          plan: "BrowserAgentGoalSessionPlan",
          session: "BrowserAgentSessionRecord",
        },
        visibility: "agent",
      },
      executor: async (input) => {
        const includeConsole =
          getRuntimeSettingsSnapshot().value.agent.allowConsoleRead &&
          input?.includeConsole !== false;
        const requestedHostId = String(input?.hostId || "").trim() || undefined;
        const hostSummary = requestedHostId
          ? readBrowserAgentHostSummary(requestedHostId)
          : listBrowserAgentHosts()[0] || null;
        const hostSnapshot = hostSummary
          ? readBrowserAgentHostSnapshot(hostSummary.id).snapshot
          : null;
        const recentConsoleLimit = Math.max(
          0,
          Math.min(20, Number(input?.recentConsoleLimit || 8)),
        );
        const recentConsole = includeConsole
          ? readRecentConsoleEvents({ limit: recentConsoleLimit || 8 })
          : [];
        const referenceImages = normalizeStringArray(input?.referenceImages, 4);
        const plan = await planBrowserAgentGoalSession({
          goal: String(input?.goal || "").trim(),
          host: hostSummary,
          hostSnapshot,
          tools: listBrowserTools(),
          recentConsole,
          recentSession: isPlainRecord(input?.recentSession)
            ? (input?.recentSession as BrowserAgentSessionRecord)
            : null,
          targetElementId: String(input?.targetElementId || "").trim() || null,
          referenceImages,
        });
        const session = startBrowserAgentSession({
          title: plan.title,
          description: plan.description,
          metadata: {
            goal: String(input?.goal || "").trim(),
            planner: "goal-session",
            plannerModel: plan.plannerModel,
            rationaleSummary: plan.rationaleSummary,
            finalSummary: plan.finalSummary || null,
            taskProfile: plan.taskProfile || null,
            researchNotes: plan.researchNotes || null,
            executionStrategy: plan.executionStrategy || null,
            continuationStatus: plan.done ? "done" : "active",
            continuationCount: 0,
            targetHostId: plan.targetHostId,
            targetElementId: plan.targetElementId,
            plannedAt: plan.plannedAt,
            inputReferenceImages: referenceImages,
          },
          autoStart: input?.autoStart !== false,
          steps: plan.steps,
        });

        return {
          plan,
          session,
        };
      },
    },
    {
      definition: {
        id: "browser.continue_goal_session",
        title: "Continue Goal Session",
        description:
          "Replans the next segment of an existing goal session from its latest observations, appends new steps, and resumes execution.",
        category: "workflow",
        inputSchema: {
          sessionId: "string",
          goal: "string",
          includeConsole: "boolean",
          recentConsoleLimit: "number",
          referenceImages: "string[]",
          autoStart: "boolean",
        },
        outputSchema: {
          plan: "BrowserAgentGoalSessionPlan",
          session: "BrowserAgentSessionRecord",
        },
        visibility: "agent",
      },
      executor: async (input) => {
        const sessionId = String(input?.sessionId || "").trim();
        if (!sessionId) {
          throw new Error("browser.continue_goal_session requires a sessionId.");
        }

        const currentSession = readBrowserAgentSession(sessionId);
        if (!currentSession) {
          throw new Error(`Browser agent session not found: ${sessionId}`);
        }

        const includeConsole =
          getRuntimeSettingsSnapshot().value.agent.allowConsoleRead &&
          input?.includeConsole !== false;
        const targetHostId =
          String(currentSession.metadata?.targetHostId || "").trim() || undefined;
        const hostSummary = targetHostId
          ? readBrowserAgentHostSummary(targetHostId)
          : listBrowserAgentHosts()[0] || null;
        const hostSnapshot = hostSummary
          ? readBrowserAgentHostSnapshot(hostSummary.id).snapshot
          : null;
        const recentConsoleLimit = Math.max(
          0,
          Math.min(20, Number(input?.recentConsoleLimit || 8)),
        );
        const recentConsole = includeConsole
          ? readRecentConsoleEvents({ limit: recentConsoleLimit || 8 })
          : [];
        const referenceImages = normalizeStringArray(
          input?.referenceImages ??
            (Array.isArray(currentSession.metadata?.inputReferenceImages)
              ? currentSession.metadata?.inputReferenceImages
              : []),
          4,
        );
        const goal =
          String(input?.goal || "").trim() ||
          String(currentSession.metadata?.goal || "").trim() ||
          String(currentSession.description || "").trim() ||
          String(currentSession.title || "").trim();

        if (!goal) {
          throw new Error(
            "browser.continue_goal_session could not resolve a goal from input or session metadata.",
          );
        }

        const plan = await planBrowserAgentGoalSession({
          goal,
          host: hostSummary,
          hostSnapshot,
          tools: listBrowserTools(),
          recentConsole,
          recentSession: currentSession,
          targetElementId:
            String(currentSession.metadata?.targetElementId || "").trim() || null,
          referenceImages,
        });

        const nextContinuationCount =
          Number(currentSession.metadata?.continuationCount || 0) + 1;

        const updatedSession = updateBrowserAgentSessionMetadata(sessionId, {
          goal,
          planner: "goal-session-continuation",
          plannerModel: plan.plannerModel,
          rationaleSummary: plan.rationaleSummary,
          finalSummary: plan.finalSummary || null,
          taskProfile: plan.taskProfile || null,
          researchNotes: plan.researchNotes || null,
          executionStrategy: plan.executionStrategy || null,
          continuationStatus: plan.done ? "done" : "active",
          targetHostId: plan.targetHostId,
          targetElementId: plan.targetElementId,
          plannedAt: plan.plannedAt,
          continuationCount: nextContinuationCount,
          inputReferenceImages: referenceImages,
        });

        if (plan.done || plan.steps.length === 0) {
          return {
            plan,
            session: updatedSession,
          };
        }

        const session = appendBrowserAgentSessionSteps(sessionId, plan.steps, {
          autoStart: input?.autoStart !== false,
        });

        return {
          plan,
          session,
        };
      },
    },
    {
      definition: {
        id: "browser.start_session_preset",
        title: "Start Browser Session Preset",
        description:
          "Builds a preset-driven browser-agent session and starts it unless autoStart is false.",
        category: "workflow",
        inputSchema: {
          presetId: "string",
          input: "Record<string, unknown>",
          autoStart: "boolean",
        },
        outputSchema: {
          preset: "BrowserAgentSessionPresetDefinition",
          spec: "BrowserAgentSessionSpec",
          session: "BrowserAgentSessionRecord",
        },
        visibility: "agent",
      },
      executor: (input) => {
        const presetId = String(input?.presetId || "").trim();
        const preset = readBrowserAgentSessionPreset(presetId);
        if (!preset) {
          throw new Error(
            presetId
              ? `Browser session preset not found: ${presetId}`
              : "Browser session preset id is required.",
          );
        }
        const spec = buildBrowserAgentSessionPresetSpec(
          presetId,
          isPlainRecord(input?.input) ? (input?.input as Record<string, unknown>) : {},
        );
        const session = startBrowserAgentSession({
          ...spec,
          autoStart: input?.autoStart !== false,
        });
        return {
          preset,
          spec,
          session,
        };
      },
    },
    {
      definition: {
        id: "browser.start_session",
        title: "Start Browser Session",
        description:
          "Starts a multi-step browser-agent session that can invoke tools and host actions in sequence.",
        category: "system",
        inputSchema: {
          title: "string",
          description: "string",
          metadata: "Record<string, unknown>",
          autoStart: "boolean",
          steps: "BrowserAgentSessionStepSpec[]",
        },
        outputSchema: {
          session: "BrowserAgentSessionRecord",
        },
        visibility: "agent",
      },
      executor: (input) => ({
        session: startBrowserAgentSession({
          title: String(input?.title || "Browser Agent Session").trim(),
          description: String(input?.description || "").trim() || undefined,
          metadata: isPlainRecord(input?.metadata)
            ? (input?.metadata as Record<string, unknown>)
            : {},
          autoStart: input?.autoStart !== false,
          steps: Array.isArray(input?.steps)
            ? (input?.steps as Array<Record<string, unknown>>).map((step) => ({
                id: String(step.id || "").trim(),
                title: String(step.title || "").trim() || undefined,
                kind:
                  String(step.kind || "").trim() === "host_action"
                    ? "host_action"
                    : "tool",
                toolId: String(step.toolId || "").trim() || undefined,
                hostId: String(step.hostId || "").trim() || undefined,
                actionId: String(step.actionId || "").trim() || undefined,
                input: isPlainRecord(step.input)
                  ? (step.input as Record<string, unknown>)
                  : {},
                continueOnError: Boolean(step.continueOnError),
              }))
            : [],
        }),
      }),
    },
    {
      definition: {
        id: "browser.read_session",
        title: "Read Browser Session",
        description: "Reads a browser-agent session record by id.",
        category: "debug",
        inputSchema: {
          sessionId: "string",
        },
        outputSchema: {
          session: "BrowserAgentSessionRecord|null",
        },
        visibility: "agent",
      },
      executor: (input) => ({
        session: readBrowserAgentSession(String(input?.sessionId || "").trim()),
      }),
    },
    {
      definition: {
        id: "browser.update_session_metadata",
        title: "Update Session Metadata",
        description:
          "Merges structured metadata into an existing browser-agent session record.",
        category: "workflow",
        inputSchema: {
          sessionId: "string",
          metadataPatch: "Record<string, unknown>",
        },
        outputSchema: {
          session: "BrowserAgentSessionRecord|null",
        },
        visibility: "agent",
      },
      executor: (input) => {
        const sessionId = String(input?.sessionId || "").trim();
        if (!sessionId) {
          throw new Error("browser.update_session_metadata requires a sessionId.");
        }
        return {
          session: updateBrowserAgentSessionMetadata(
            sessionId,
            isPlainRecord(input?.metadataPatch)
              ? (input?.metadataPatch as Record<string, unknown>)
              : {},
          ),
        };
      },
    },
    {
      definition: {
        id: "browser.resume_session",
        title: "Resume Browser Session",
        description:
          "Resumes an existing browser-agent session by continuing any pending steps.",
        category: "workflow",
        inputSchema: {
          sessionId: "string",
          autoStart: "boolean",
        },
        outputSchema: {
          session: "BrowserAgentSessionRecord|null",
        },
        visibility: "agent",
      },
      executor: (input) => ({
        session: resumeBrowserAgentSession(
          String(input?.sessionId || "").trim(),
          {
            autoStart: input?.autoStart !== false,
          },
        ),
      }),
    },
    {
      definition: {
        id: "browser.list_sessions",
        title: "List Browser Sessions",
        description: "Lists recent browser-agent sessions.",
        category: "debug",
        inputSchema: {
          limit: "number",
        },
        outputSchema: {
          sessions: "BrowserAgentSessionRecord[]",
        },
        visibility: "agent",
      },
      executor: (input) => ({
        sessions: listBrowserAgentSessions(Number(input?.limit || 20)),
      }),
    },
    {
      definition: {
        id: "browser.cancel_session",
        title: "Cancel Browser Session",
        description: "Requests cancellation for a running browser-agent session.",
        category: "system",
        inputSchema: {
          sessionId: "string",
        },
        outputSchema: {
          session: "BrowserAgentSessionRecord|null",
        },
        visibility: "agent",
      },
      executor: (input) => ({
        session: cancelBrowserAgentSession(String(input?.sessionId || "").trim()),
      }),
    },
    {
      definition: {
        id: "browser.read_runtime_settings",
        title: "Read Runtime Settings",
        description: "Returns the normalized runtime settings snapshot.",
        category: "system",
        inputSchema: {},
        outputSchema: {
          settings: "RuntimeSettingsView",
        },
        visibility: "agent",
      },
      executor: () => ({
        settings: getRuntimeSettingsSnapshot(),
      }),
    },
    {
      definition: {
        id: "browser.read_runtime_snapshot",
        title: "Read Runtime Snapshot",
        description: "Returns browser runtime status, hosts, and tool counts.",
        category: "debug",
        inputSchema: {},
        outputSchema: {
          snapshot: "BrowserAgentRuntimeSnapshot",
          hosts: "BrowserAgentHostSummary[]",
        },
        visibility: "agent",
      },
      executor: () => ({
        snapshot: getBrowserAgentRuntimeSnapshot(),
        hosts: listBrowserAgentHosts(),
      }),
    },
  ];

  builtIns.forEach(({ definition, executor }) =>
    registerBrowserTool(definition, executor),
  );
};

export const ensureBrowserAgentRuntime = () => {
  if (!initialized) {
    ensureBrowserConsoleBridge();
    configureBrowserAgentSessionRuntime({
      invokeTool: async (toolId, input) => executeBrowserTool(toolId, input),
      invokeHostAction: async (hostId, actionId, input) =>
        invokeBrowserAgentHostAction(hostId, actionId, input),
    });
    registerBuiltInBrowserTools();
    initialized = true;
  }
  return getBrowserAgentRuntimeSnapshot();
};

export const registerBrowserAgentHost = (host: BrowserAgentHost) => {
  ensureBrowserAgentRuntime();
  hosts.set(host.id, {
    ...host,
    title: String(host.title || host.id).trim(),
    actions: Array.isArray(host.actions)
      ? host.actions.map(normalizeHostActionDefinition)
      : [],
  });
};

export const unregisterBrowserAgentHost = (hostId: string) => {
  hosts.delete(hostId);
};

export const getBrowserAgentHost = (hostId: string) => hosts.get(hostId) || null;

export const readBrowserAgentHostSummary = (hostId?: string) => {
  const host =
    (hostId ? getBrowserAgentHost(hostId) : Array.from(hosts.values())[0]) || null;
  if (!host) {
    throw new Error(
      hostId
        ? `Browser host not found: ${hostId}`
        : "No browser host is currently registered.",
    );
  }
  return summarizeBrowserAgentHost(host);
};

export const listBrowserAgentHosts = (): BrowserAgentHostSummary[] =>
  Array.from(hosts.values()).map(summarizeBrowserAgentHost);

export const readBrowserAgentHostSnapshot = (hostId?: string) => {
  const hostSummary = readBrowserAgentHostSummary(hostId);
  const host = getBrowserAgentHost(hostSummary.id);
  if (!host) {
    throw new Error(`Browser host not found: ${hostSummary.id}`);
  }
  return {
    host: hostSummary,
    snapshot: host.getSnapshot ? host.getSnapshot() : null,
  };
};

export const invokeBrowserAgentHostAction = async (
  hostId: string | undefined,
  actionId: string,
  input?: Record<string, unknown>,
) => {
  const hostSummary = readBrowserAgentHostSummary(hostId);
  const host = getBrowserAgentHost(hostSummary.id);
  if (!host) {
    throw new Error(`Browser host not found: ${hostSummary.id}`);
  }
  const normalizedActionId = String(actionId || "").trim();
  if (!normalizedActionId) {
    throw new Error("Browser host action id is required.");
  }
  const targetAction = host.actions.find(
    (action) => action.id === normalizedActionId,
  );
  if (!targetAction) {
    throw new Error(
      `Browser host action not found: ${hostSummary.id}/${normalizedActionId}`,
    );
  }
  if (typeof host.invokeAction !== "function") {
    throw new Error(
      `Browser host cannot invoke actions: ${hostSummary.id}/${normalizedActionId}`,
    );
  }
  return host.invokeAction(normalizedActionId, input);
};

export const getBrowserAgentRuntimeSnapshot =
  (): BrowserAgentRuntimeSnapshot => ({
    initialized,
    hostCount: hosts.size,
    toolCount: listBrowserTools().length,
    settingsVersion: getRuntimeSettingsSnapshot().version,
    sessionCount: getBrowserAgentSessionStats().sessionCount,
    runningSessionCount: getBrowserAgentSessionStats().runningSessionCount,
  });

export const invokeBrowserAgentTool = async (
  toolId: string,
  input?: Record<string, unknown>,
) => {
  ensureBrowserAgentRuntime();
  return executeBrowserTool(toolId, input);
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeStringArray = (value: unknown, limit: number): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, Math.max(0, limit));
};
