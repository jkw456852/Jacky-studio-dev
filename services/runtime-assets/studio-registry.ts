import type { AgentInfo, AgentType } from "../../types/agent.types";
import type {
  StudioAgentAsset,
  StudioPluginAsset,
  StudioRegistryManifest,
  StudioSharedInstructionAsset,
  StudioSpecializationAsset,
  StudioStyleLibraryAsset,
  StudioSystemAsset,
} from "./types.ts";
import { STUDIO_REGISTRY_MANIFEST } from "./generated/studio-registry.generated.ts";

class LocalStudioAssetSource {
  getManifest(): StudioRegistryManifest {
    return STUDIO_REGISTRY_MANIFEST as unknown as StudioRegistryManifest;
  }
}

let studioAssetSource = new LocalStudioAssetSource();

export const setStudioAssetSource = (nextSource: {
  getManifest: () => StudioRegistryManifest;
}) => {
  studioAssetSource = {
    getManifest: () => nextSource.getManifest(),
  };
};

export const getStudioRegistryManifest = (): StudioRegistryManifest =>
  studioAssetSource.getManifest();

export const getStudioSharedInstructions =
  (): StudioSharedInstructionAsset => getStudioRegistryManifest().sharedInstructions;

export const getStudioRoutingAsset = () => getStudioRegistryManifest().routing;

export const getStudioPrimaryAgentIds = (): AgentType[] =>
  [...getStudioRegistryManifest().primaryAgentIds];

export const getStudioAgentAsset = (agentId: AgentType): StudioAgentAsset =>
  getStudioRegistryManifest().agents[agentId];

export const listStudioAgentAssets = (): StudioAgentAsset[] =>
  getStudioPrimaryAgentIds().map((agentId) => getStudioAgentAsset(agentId));

export const getStudioAgentInfo = (agentId: AgentType): AgentInfo =>
  getStudioAgentAsset(agentId).info;

export const getStudioAgentSystemPrompt = (agentId: AgentType): string =>
  getStudioAgentAsset(agentId).systemPrompt;

export const getStudioSpecializationAsset = (
  specializationId: string,
): StudioSpecializationAsset => getStudioRegistryManifest().specializations[specializationId];

export const getStudioStyleLibraryAsset = (
  mode: keyof StudioRegistryManifest["styleLibraries"],
): StudioStyleLibraryAsset => getStudioRegistryManifest().styleLibraries[mode];

export const listStudioStyleLibraryAssets = (): StudioStyleLibraryAsset[] =>
  Object.values(getStudioRegistryManifest().styleLibraries);

export const getStudioPluginAsset = (
  pluginId: string,
): StudioPluginAsset | null =>
  getStudioRegistryManifest().plugins[pluginId] || null;

export const listStudioPluginAssets = (): StudioPluginAsset[] =>
  Object.values(getStudioRegistryManifest().plugins);

export const getStudioSystemAsset = (systemId: string): StudioSystemAsset =>
  getStudioRegistryManifest().systems[systemId];
