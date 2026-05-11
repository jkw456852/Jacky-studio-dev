export const buildRuntimeRolePrompt = (
  basePrompt: string,
  metadata?: Record<string, any>,
): string => {
  // This layer is intentionally task-scoped only.
  // Durable preferences belong to the main-brain layer or the user role addon layer.
  const roleStrategy = String(metadata?.roleStrategy || "").trim();
  const roleStrategyReason = String(metadata?.roleStrategyReason || "").trim();
  const rolePromptAddon = String(metadata?.rolePromptAddon || "").trim();
  const rolePromptLabel = String(metadata?.rolePromptLabel || "").trim();
  const roleDraftTitle = String(metadata?.roleDraft?.title || "").trim();
  const roleDraftSummary = String(metadata?.roleDraft?.summary || "").trim();
  const selectedRoleId = String(metadata?.selectedRoleId || "").trim();
  const selectedRoleSource = String(metadata?.selectedRoleSource || "").trim();
  const baseAgentId = String(metadata?.baseAgentId || "").trim();
  const roleGovernanceMode = String(metadata?.roleGovernanceMode || "").trim();
  const allowMainBrainRoleMutation = metadata?.allowMainBrainRoleMutation === true;
  const allowMainBrainRolePromotion = metadata?.allowMainBrainRolePromotion === true;
  const roleDraftInstructions = Array.isArray(metadata?.roleDraft?.instructions)
    ? metadata.roleDraft.instructions
        .map((item: unknown) => String(item || "").trim())
        .filter(Boolean)
    : [];

  if (
    !rolePromptAddon &&
    !roleStrategy &&
    !roleStrategyReason &&
    !roleDraftTitle &&
    !roleDraftSummary &&
    !selectedRoleId &&
    !selectedRoleSource &&
    !baseAgentId &&
    !roleGovernanceMode &&
    roleDraftInstructions.length === 0 &&
    !allowMainBrainRoleMutation &&
    !allowMainBrainRolePromotion
  ) {
    return basePrompt;
  }

  const runtimeLines = [
    "",
    "# Runtime Role Layer",
    rolePromptLabel ? `- Label: ${rolePromptLabel}` : "",
    selectedRoleId ? `- Selected durable role: ${selectedRoleId}` : "",
    selectedRoleSource ? `- Role source: ${selectedRoleSource}` : "",
    baseAgentId ? `- Base specialist shell: ${baseAgentId}` : "",
    roleGovernanceMode ? `- Governance mode: ${roleGovernanceMode}` : "",
    `- Main-brain durable role mutation allowed: ${allowMainBrainRoleMutation ? 'yes' : 'no'}`,
    `- Main-brain durable role promotion allowed: ${allowMainBrainRolePromotion ? 'yes' : 'no'}`,
    roleStrategy ? `- Strategy: ${roleStrategy}` : "",
    roleStrategyReason ? `- Strategy reason: ${roleStrategyReason}` : "",
    roleDraftTitle ? `- Draft title: ${roleDraftTitle}` : "",
    roleDraftSummary ? `- Draft summary: ${roleDraftSummary}` : "",
    roleDraftInstructions.length > 0
      ? `- Draft instructions:\n${roleDraftInstructions
          .map((item: string) => `  - ${item}`)
          .join("\n")}`
      : "",
    rolePromptAddon ? `- Temporary role instructions:\n${rolePromptAddon}` : "",
    selectedRoleId
      ? "- Treat the selected durable role as the primary role context for this task; do not silently ignore it during planning or execution."
      : "",
    "- Temporary role layers may refine the current task, but they do not by themselves prove that a durable role asset was created, updated, promoted, or archived.",
    "- Never claim a durable role asset has been changed unless later runtime evidence or a confirmed governance audit says so.",
    "- Follow this runtime role layer for the current task without forgetting your core tool constraints.",
  ].filter(Boolean);

  return `${basePrompt}\n${runtimeLines.join("\n")}`;
};
