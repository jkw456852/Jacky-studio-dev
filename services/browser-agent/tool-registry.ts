import {
  getRuntimeSettingsSnapshot,
  type RuntimeSettingsSnapshot,
  type RuntimeSettingsView,
} from "../runtime-settings";
import { readRecentConsoleEvents } from "./console-bridge";

export type BrowserToolCategory =
  | "canvas"
  | "image"
  | "workflow"
  | "debug"
  | "system"
  | "custom";

export type BrowserToolDefinition = {
  id: string;
  title: string;
  description: string;
  category: BrowserToolCategory;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  visibility: "user" | "agent" | "both";
  dangerous?: boolean;
  needsSelection?: boolean;
  needsConfirmation?: boolean;
};

export type BrowserToolExecutorContext = {
  getRuntimeSettings: () => RuntimeSettingsView<RuntimeSettingsSnapshot>;
  readRecentConsoleEvents: typeof readRecentConsoleEvents;
};

export type BrowserToolExecutor = (
  input?: Record<string, unknown>,
  context?: BrowserToolExecutorContext,
) => unknown | Promise<unknown>;

type BrowserToolRecord = {
  definition: BrowserToolDefinition;
  executor?: BrowserToolExecutor;
};

type BrowserToolListener = (tools: BrowserToolDefinition[]) => void;

const registry = new Map<string, BrowserToolRecord>();
const listeners = new Set<BrowserToolListener>();

const emitBrowserToolsChanged = () => {
  const snapshot = listBrowserTools();
  listeners.forEach((listener) => listener(snapshot));
};

export const registerBrowserTool = (
  definition: BrowserToolDefinition,
  executor?: BrowserToolExecutor,
) => {
  const id = String(definition.id || "").trim();
  if (!id) {
    throw new Error("Browser tool id is required.");
  }
  registry.set(id, {
    definition: {
      ...definition,
      id,
      title: String(definition.title || id).trim(),
      description: String(definition.description || "").trim(),
      inputSchema: definition.inputSchema || {},
      visibility: definition.visibility || "agent",
    },
    executor,
  });
  emitBrowserToolsChanged();
};

export const unregisterBrowserTool = (toolId: string) => {
  if (!registry.delete(toolId)) return;
  emitBrowserToolsChanged();
};

export const getBrowserTool = (toolId: string) => registry.get(toolId) || null;

export const listBrowserTools = (): BrowserToolDefinition[] =>
  Array.from(registry.values()).map((record) => record.definition);

export const executeBrowserTool = async (
  toolId: string,
  input?: Record<string, unknown>,
) => {
  const record = registry.get(toolId);
  if (!record) {
    throw new Error(`Browser tool not found: ${toolId}`);
  }
  if (!record.executor) {
    throw new Error(`Browser tool has no executor: ${toolId}`);
  }
  return record.executor(input, {
    getRuntimeSettings: getRuntimeSettingsSnapshot,
    readRecentConsoleEvents,
  });
};

export const subscribeBrowserTools = (listener: BrowserToolListener) => {
  listeners.add(listener);
  listener(listBrowserTools());
  return () => {
    listeners.delete(listener);
  };
};
