export const resolveLiveWorkspaceGenerationTargetIds = (
  targetElementIds: readonly string[] | null | undefined,
  liveElementIds: readonly string[],
): string[] => {
  const liveIdSet = new Set(liveElementIds.filter(Boolean));
  return Array.from(
    new Set(
      (targetElementIds || [])
        .map((targetId) => String(targetId || "").trim())
        .filter((targetId) => targetId && liveIdSet.has(targetId)),
    ),
  );
};
