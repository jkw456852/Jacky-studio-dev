import type { RuntimeSettingsSnapshot } from "./schema";

export const RUNTIME_SETTINGS_VERSION = "2026-04-27.v1";

export const DEFAULT_RUNTIME_SETTINGS_SNAPSHOT: RuntimeSettingsSnapshot = {
  version: RUNTIME_SETTINGS_VERSION,
  models: {
    script: {
      selected: [],
    },
    image: {
      selected: [],
      postPaths: {},
    },
    video: {
      selected: [],
    },
  },
  visualOrchestrator: {
    model: "auto",
    maxReferenceImages: 0,
    maxInlineImageBytesMb: 48,
    continuityEnabled: true,
  },
  workspace: {
    autoSave: true,
    concurrentCount: 1,
    systemModeration: false,
  },
  agent: {
    browserRuntimeEnabled: true,
    model: "auto",
    toolAuthoringEnabled: false,
    allowConsoleRead: true,
    allowWorkflowAuthoring: false,
  },
};
