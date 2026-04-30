import type { AgentType } from "../../types/agent.types";
import type { StudioStoredRoleDraft } from "../runtime-assets/user-asset-types";
import { getMainBrainPreferenceBlock } from "../runtime-assets/main-brain";
import { getStudioAgentSystemPrompt } from "../runtime-assets/studio-registry";
import { getStudioUserAssetApi } from "../runtime-assets/api";

export const getBuiltInAgentPrompt = (agentId: AgentType): string =>
  getStudioAgentSystemPrompt(agentId);

export const getAgentPromptAddon = (agentId: AgentType): string => {
  return getStudioUserAssetApi().getAgentPromptAddon(agentId);
};

export const hasAgentPromptAddon = (agentId: AgentType): boolean =>
  getAgentPromptAddon(agentId).length > 0;

export const setAgentPromptAddon = (
  agentId: AgentType,
  promptAddon: string,
): void => {
  getStudioUserAssetApi().setAgentPromptAddon(agentId, promptAddon);
};

export const clearAgentPromptAddon = (agentId: AgentType): void => {
  getStudioUserAssetApi().clearAgentPromptAddon(agentId);
};

export const buildUserCustomRoleAddonBlock = (promptAddon: string): string => {
  const normalizedAddon = String(promptAddon || "").trim();
  if (!normalizedAddon) return "";
  return `# User Custom Role Addendum
- The following instructions are user-authored role additions for this specific agent.
- Treat them as high-priority behavior constraints unless they conflict with safety or tool requirements.

${normalizedAddon}`;
};

export const buildRoleDraftAddonText = (
  draft: Pick<StudioStoredRoleDraft, "title" | "summary" | "instructions"> | null | undefined,
): string => {
  if (!draft) return "";
  const title = String(draft.title || "").trim();
  const summary = String(draft.summary || "").trim();
  const instructions = Array.isArray(draft.instructions)
    ? draft.instructions
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : [];
  const nextDraft = [
    title ? `Role Draft Title: ${title}` : "",
    summary ? `Role Draft Summary: ${summary}` : "",
    instructions.length > 0
      ? `Role Draft Instructions:\n${instructions.map((item) => `- ${item}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return nextDraft.trim();
};

export const mergePromptAddonWithRoleDraft = (args: {
  currentAddon?: string | null;
  draft?: Pick<StudioStoredRoleDraft, "title" | "summary" | "instructions"> | null;
}) => {
  const currentAddon = String(args.currentAddon || "").trim();
  const nextDraft = buildRoleDraftAddonText(args.draft);
  if (!nextDraft) return currentAddon;
  if (!currentAddon) return nextDraft;
  return `${currentAddon}\n\n${nextDraft}`.trim();
};

export const getAgentPromptLayers = (agentId: AgentType) => {
  const systemBaselinePrompt = getBuiltInAgentPrompt(agentId);
  const mainBrainPreferenceBlock = getMainBrainPreferenceBlock();
  const promptAddon = getAgentPromptAddon(agentId);
  const userAddonBlock = buildUserCustomRoleAddonBlock(promptAddon);

  return {
    systemBaselinePrompt,
    mainBrainPreferenceBlock,
    promptAddon,
    userAddonBlock,
    effectivePrompt: [
      systemBaselinePrompt,
      mainBrainPreferenceBlock,
      userAddonBlock,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
};

export const getEffectiveAgentPrompt = (agentId: AgentType): string => {
  return getAgentPromptLayers(agentId).effectivePrompt;
};
