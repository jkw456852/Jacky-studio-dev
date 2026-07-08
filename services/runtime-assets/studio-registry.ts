import type { AgentInfo, AgentType } from "../../types/agent.types.ts";
import type {
  StudioAgentAsset,
  StudioFrontstageSkillPresetAsset,
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

const stripLegacyCocoMultiAgentSections = (prompt: string): string => {
  const text = String(prompt || '').trim();
  if (!text) return '';

  const stripped = text.replace(
    /\n# 专家智能体名册[\s\S]*$/u,
    '\n# 单智能体执行约定\n- 当前产品默认采用单智能体执行模式：由 Coco 直接理解需求并调用合适的 skills 完成任务。\n- 不要把请求表述为“交给 Cameron / Poster / Vireo / Motion / Package / Campaign 处理”。\n- 如果某种旧专家壳的经验对当前任务有帮助，只能作为内部风格参考吸收，不应在对用户的 analysis、message、preGenerationMessage 或 postGenerationSummary 中宣称发生了 agent handoff。\n- 用户可见描述应使用“我将直接处理 / 我将直接调用相应工具 / 我会按摄影写实逻辑处理”这类单智能体措辞。',
  );

  return stripped.trim();
};

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
  agentId === 'coco'
    ? stripLegacyCocoMultiAgentSections(getStudioAgentAsset(agentId).systemPrompt)
    : getStudioAgentAsset(agentId).systemPrompt;

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

export const getStudioFrontstageSkillPresetAsset = (
  presetId: string,
): StudioFrontstageSkillPresetAsset | null =>
  getStudioRegistryManifest().skillPresets[presetId] || null;

export const listStudioFrontstageSkillPresetAssets =
  (): StudioFrontstageSkillPresetAsset[] =>
    Object.values(getStudioRegistryManifest().skillPresets);

export const getStudioSystemAsset = (systemId: string): StudioSystemAsset =>
  getStudioRegistryManifest().systems[systemId];
