import type { ImageModelPostPathConfig } from "../provider-settings";

export type RuntimeSettingsSource =
  | "global"
  | "workspace"
  | "session"
  | "merged";

export type RuntimeImagePostPathMap = Record<
  string,
  {
    withReferences: string;
    withoutReferences: string;
  }
>;

export type RuntimeSettingsSnapshot = {
  version: string;
  models: {
    script: {
      selected: string[];
    };
    image: {
      selected: string[];
      postPaths: RuntimeImagePostPathMap;
    };
    video: {
      selected: string[];
    };
  };
  visualOrchestrator: {
    model: string;
    maxReferenceImages: number;
    maxInlineImageBytesMb: number;
    continuityEnabled: boolean;
  };
  workspace: {
    autoSave: boolean;
    concurrentCount: number;
    systemModeration: boolean;
  };
  agent: {
    browserRuntimeEnabled: boolean;
    model: string;
    toolAuthoringEnabled: boolean;
    allowConsoleRead: boolean;
    allowWorkflowAuthoring: boolean;
  };
};

export type RuntimeSettingsView<T = RuntimeSettingsSnapshot> = {
  value: Readonly<T>;
  version: string;
  source: RuntimeSettingsSource;
  updatedAt: number;
};

export type RuntimeSettingsStorageShape = {
  selectedScriptModels?: string[];
  selectedImageModels?: string[];
  selectedVideoModels?: string[];
  imageModelPostPaths?: Record<string, ImageModelPostPathConfig>;
  visualOrchestratorModel?: string;
  browserAgentModel?: string;
  visualOrchestratorMaxReferenceImages?: number;
  visualOrchestratorMaxInlineImageBytesMb?: number;
  visualContinuity?: boolean;
  systemModeration?: boolean;
  autoSave?: boolean;
  concurrentCount?: number;
};
