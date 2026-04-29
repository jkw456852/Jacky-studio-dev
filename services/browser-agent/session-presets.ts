import type { BrowserAgentSessionSpec, BrowserAgentSessionStepSpec } from "./session-runtime";

export type BrowserAgentSessionPresetDefinition = {
  id: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

type BrowserAgentSessionPresetBuilder = (
  input?: Record<string, unknown>,
) => BrowserAgentSessionSpec;

type ControlUpdateSpec = {
  controlId: string;
  value: unknown;
};

const DEFAULT_WAIT_MS = 1800;
const DEFAULT_FOLLOWUP_WAIT_MS = 2400;
const DEFAULT_ACTIVITY_LIMIT = 8;

const SESSION_PRESETS: Array<{
  definition: BrowserAgentSessionPresetDefinition;
  build: BrowserAgentSessionPresetBuilder;
}> = [
  {
    definition: {
      id: "workspace.inspect_element_context",
      title: "Inspect Workspace Element Context",
      description:
        "Reads the selected or specified workspace element, its capabilities, controls, and latest generation trace context.",
      inputSchema: {
        elementId: "string",
        activityLimit: "number",
      },
      metadata: {
        hostKind: "canvas",
        workflow: "inspection",
      },
    },
    build: (input) => {
      const elementId = readOptionalString(input?.elementId);
      const activityLimit = clampNumber(input?.activityLimit, 1, 20, DEFAULT_ACTIVITY_LIMIT);

      return {
        title: "Inspect Workspace Element Context",
        description: elementId
          ? `Inspect element ${elementId} and its current generation context.`
          : "Inspect the current selected element and its current generation context.",
        metadata: {
          presetId: "workspace.inspect_element_context",
          targetElementId: elementId || null,
        },
        steps: [
          buildToolStep({
            id: "read_selected_element",
            title: "Read Selected Element",
            toolId: "workspace.read_selected_element",
          }),
          buildToolStep({
            id: "read_capabilities",
            title: "Read Element Capabilities",
            toolId: "workspace.read_element_capabilities",
            input: elementId ? { elementId } : {},
          }),
          buildToolStep({
            id: "read_controls",
            title: "Read Element Controls",
            toolId: "workspace.read_element_controls",
            input: elementId ? { elementId } : {},
          }),
          buildToolStep({
            id: "read_trace",
            title: "Read Generation Trace",
            toolId: "workspace.read_generation_trace",
            input: elementId ? { elementId } : {},
          }),
          buildToolStep({
            id: "read_activity",
            title: "Read Recent Generation Activity",
            toolId: "workspace.read_recent_generation_activity",
            input: {
              ...(elementId ? { elementId } : {}),
              limit: activityLimit,
            },
          }),
        ],
      };
    },
  },
  {
    definition: {
      id: "workspace.generate_image_cycle",
      title: "Run Workspace Image Generate Cycle",
      description:
        "Selects a workspace element, optionally updates its controls, triggers generation, waits, and then reads back trace and recent activity.",
      inputSchema: {
        elementId: "string",
        waitMs: "number",
        followupWaitMs: "number",
        activityLimit: "number",
        selectElement: "boolean",
        updates: "Record<string, unknown> | Array<{ controlId: string; value: unknown }>",
      },
      metadata: {
        hostKind: "canvas",
        workflow: "generation",
      },
    },
    build: (input) => {
      const elementId = readRequiredString(
        input?.elementId,
        "workspace.generate_image_cycle preset requires an elementId.",
      );
      const waitMs = clampNumber(input?.waitMs, 250, 60_000, DEFAULT_WAIT_MS);
      const followupWaitMs = clampNumber(
        input?.followupWaitMs,
        250,
        60_000,
        DEFAULT_FOLLOWUP_WAIT_MS,
      );
      const activityLimit = clampNumber(input?.activityLimit, 1, 20, DEFAULT_ACTIVITY_LIMIT);
      const selectElement = normalizeBoolean(input?.selectElement, true);
      const updates = normalizeControlUpdates(input?.updates);
      const steps: BrowserAgentSessionStepSpec[] = [];

      steps.push(
        buildToolStep({
          id: "read_capabilities",
          title: "Read Element Capabilities",
          toolId: "workspace.read_element_capabilities",
          input: { elementId },
        }),
        buildToolStep({
          id: "read_controls",
          title: "Read Element Controls",
          toolId: "workspace.read_element_controls",
          input: { elementId },
        }),
      );

      if (selectElement) {
        steps.push(
          buildHostActionStep({
            id: "select_element",
            title: "Select Element",
            actionId: "workspace.select_element",
            input: { elementId },
          }),
        );
      }

      updates.forEach((update, index) => {
        steps.push(
          buildHostActionStep({
            id: `update_control_${index + 1}`,
            title: `Update Control ${update.controlId}`,
            actionId: "workspace.update_element_control",
            input: {
              elementId,
              controlId: update.controlId,
              value: update.value,
            },
          }),
        );
      });

      steps.push(
        buildHostActionStep({
          id: "generate_image",
          title: "Trigger Image Generation",
          actionId: "workspace.generate_image",
          input: { elementId },
        }),
        buildToolStep({
          id: "await_generation",
          title: "Await Generation Completion",
          toolId: "workspace.await_generation_completion",
          input: {
            elementId,
            requestId: "{{steps.generate_image.result.requestId}}",
            timeoutMs: Math.max(waitMs + followupWaitMs, followupWaitMs),
            pollIntervalMs: Math.min(waitMs, 1800),
            activityLimit,
          },
        }),
        buildToolStep({
          id: "read_trace",
          title: "Read Generation Trace",
          toolId: "workspace.read_generation_trace",
          input: {
            elementId,
            requestId: "{{steps.generate_image.result.requestId}}",
          },
        }),
        buildToolStep({
          id: "read_activity",
          title: "Read Recent Generation Activity",
          toolId: "workspace.read_recent_generation_activity",
          input: {
            elementId,
            requestId: "{{steps.generate_image.result.requestId}}",
            limit: activityLimit,
          },
        }),
      );

      return {
        title: "Run Workspace Image Generate Cycle",
        description: `Generate imagery for workspace element ${elementId}.`,
        metadata: {
          presetId: "workspace.generate_image_cycle",
          targetElementId: elementId,
          updateCount: updates.length,
          waitMs,
          followupWaitMs,
        },
        steps,
      };
    },
  },
];

export const listBrowserAgentSessionPresets = () =>
  SESSION_PRESETS.map(({ definition }) => ({
    ...definition,
  }));

export const readBrowserAgentSessionPreset = (
  presetId: string,
): BrowserAgentSessionPresetDefinition | null => {
  const normalizedPresetId = String(presetId || "").trim();
  if (!normalizedPresetId) return null;
  return (
    SESSION_PRESETS.find((preset) => preset.definition.id === normalizedPresetId)?.definition ||
    null
  );
};

export const buildBrowserAgentSessionPresetSpec = (
  presetId: string,
  input?: Record<string, unknown>,
): BrowserAgentSessionSpec => {
  const normalizedPresetId = String(presetId || "").trim();
  if (!normalizedPresetId) {
    throw new Error("Browser session preset id is required.");
  }
  const preset = SESSION_PRESETS.find(
    (candidate) => candidate.definition.id === normalizedPresetId,
  );
  if (!preset) {
    throw new Error(`Browser session preset not found: ${normalizedPresetId}`);
  }
  const spec = preset.build(input);
  return {
    ...spec,
    title: String(spec.title || preset.definition.title).trim() || preset.definition.title,
    description:
      String(spec.description || "").trim() || preset.definition.description || undefined,
    metadata: {
      presetId: preset.definition.id,
      ...(preset.definition.metadata || {}),
      ...(isPlainRecord(spec.metadata) ? spec.metadata : {}),
    },
    steps: Array.isArray(spec.steps) ? spec.steps.map((step) => ({ ...step })) : [],
  };
};

const buildToolStep = (input: {
  id: string;
  title: string;
  toolId: string;
  input?: Record<string, unknown>;
}): BrowserAgentSessionStepSpec => ({
  id: input.id,
  title: input.title,
  kind: "tool",
  toolId: input.toolId,
  input: input.input || {},
});

const buildHostActionStep = (input: {
  id: string;
  title: string;
  actionId: string;
  input?: Record<string, unknown>;
}): BrowserAgentSessionStepSpec => ({
  id: input.id,
  title: input.title,
  kind: "host_action",
  actionId: input.actionId,
  input: input.input || {},
});

const normalizeControlUpdates = (value: unknown): ControlUpdateSpec[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!isPlainRecord(item)) return null;
        const controlId = readOptionalString(item.controlId);
        if (!controlId) return null;
        return {
          controlId,
          value: item.value,
        };
      })
      .filter((item): item is ControlUpdateSpec => Boolean(item));
  }

  if (!isPlainRecord(value)) {
    return [];
  }

  return Object.entries(value)
    .map(([controlId, nextValue]) => {
      const normalizedControlId = String(controlId || "").trim();
      if (!normalizedControlId) return null;
      return {
        controlId: normalizedControlId,
        value: nextValue,
      };
    })
    .filter((item): item is ControlUpdateSpec => Boolean(item));
};

const readOptionalString = (value: unknown) => {
  const normalized = String(value || "").trim();
  return normalized || "";
};

const readRequiredString = (value: unknown, errorMessage: string) => {
  const normalized = readOptionalString(value);
  if (!normalized) {
    throw new Error(errorMessage);
  }
  return normalized;
};

const clampNumber = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(numericValue)));
};

const normalizeBoolean = (value: unknown, fallback: boolean) => {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return fallback;
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
