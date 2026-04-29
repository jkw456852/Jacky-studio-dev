import { getRuntimeSettingsSnapshot } from "./snapshot";

export const getVisualOrchestratorSettings = () =>
  getRuntimeSettingsSnapshot().value.visualOrchestrator;

export const getWorkspaceExecutionSettings = () =>
  getRuntimeSettingsSnapshot().value.workspace;

export const getBrowserAgentSettings = () =>
  getRuntimeSettingsSnapshot().value.agent;
