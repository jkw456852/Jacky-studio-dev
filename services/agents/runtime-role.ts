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
    roleDraftInstructions.length === 0
  ) {
    return basePrompt;
  }

  const runtimeLines = [
    "",
    "# Runtime Role Layer",
    rolePromptLabel ? `- Label: ${rolePromptLabel}` : "",
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
    "- Follow this runtime role layer for the current task without forgetting your core tool constraints.",
  ].filter(Boolean);

  return `${basePrompt}\n${runtimeLines.join("\n")}`;
};
