import type { AgentType } from "../../types/agent.types";
import { getStudioUserAssetApi } from "../runtime-assets/api";
import { listStudioAgentAssets } from "../runtime-assets/studio-registry";

export type AgentRoleStrategy = "reuse" | "augment" | "create";

export interface AgentRoleProfile {
  agentId: AgentType;
  purpose: string;
  useWhen: string[];
  avoidWhen: string[];
  adaptWhen: string[];
  dynamicRolePolicy: string;
}

const ROLE_CATALOG: Record<AgentType, AgentRoleProfile> = Object.fromEntries(
  listStudioAgentAssets().map((asset) => [asset.id, asset.roleProfile]),
) as Record<AgentType, AgentRoleProfile>;

export const getAgentRoleProfile = (agentId: AgentType): AgentRoleProfile =>
  ROLE_CATALOG[agentId];

export const listAgentRoleProfiles = (): AgentRoleProfile[] =>
  Object.values(ROLE_CATALOG);

export const buildAgentRoleCatalogSummary = (): string =>
  listAgentRoleProfiles()
    .map(
      (profile) =>
        `- ${profile.agentId}: ${profile.purpose}
  - Use when: ${profile.useWhen.join(" | ")}
  - Avoid when: ${profile.avoidWhen.join(" | ")}
  - Adapt when: ${profile.adaptWhen.join(" | ")}
      - Dynamic role policy: ${profile.dynamicRolePolicy}`,
    )
    .join("\n");

export const buildDurableRoleAddonSummary = (): string => {
  const api = getStudioUserAssetApi();
  return listAgentRoleProfiles()
    .map((profile) => {
      const addon = api.getAgentPromptAddon(profile.agentId);
      if (!addon) return "";
      const clippedAddon =
        addon.length > 220 ? `${addon.slice(0, 220).trim()}...` : addon;
      return `- ${profile.agentId}: has durable user role addon\n  - Addon summary: ${clippedAddon}`;
    })
    .filter(Boolean)
    .join("\n");
};

export const buildLatestRoleDraftSummary = (): string => {
  const api = getStudioUserAssetApi();
  return listAgentRoleProfiles()
    .map((profile) => {
      const draft = api.getLatestRoleDraft(profile.agentId);
      if (!draft) return "";
      const instructions = draft.instructions.slice(0, 3).join(" | ");
      return `- ${profile.agentId}: latest temporary role draft available
  - Strategy: ${draft.roleStrategy || "reuse"}
  - Why: ${draft.roleStrategyReason || "No explicit reason recorded."}
  - Draft title: ${draft.title || "Untitled"}
  - Draft summary: ${draft.summary || "No summary"}
  - Draft instructions: ${instructions || "No instructions"}`;
    })
    .filter(Boolean)
    .join("\n");
};
