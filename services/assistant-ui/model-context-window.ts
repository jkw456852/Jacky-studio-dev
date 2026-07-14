const ONE_MIB_TOKENS = 1_048_576;

export const resolveAssistantModelContextWindow = (
  modelId: string | null | undefined,
): number | undefined => {
  const normalized = String(modelId || "").trim().toLowerCase();
  if (!normalized) return undefined;

  if (normalized.startsWith("gpt-5.4")) return ONE_MIB_TOKENS;
  if (normalized.startsWith("gpt-5.2")) return 400_000;
  if (normalized.startsWith("gpt-4.1")) return 1_047_576;
  if (normalized.startsWith("gemini-3")) return ONE_MIB_TOKENS;

  return undefined;
};
