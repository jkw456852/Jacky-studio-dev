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

export type WorkspaceGenerationResumeAction = "poll" | "interrupt";

export const resolveWorkspaceGenerationResumeAction = (trace: {
  pollingTask?: { taskId?: string | null } | null;
}): WorkspaceGenerationResumeAction => {
  return String(trace.pollingTask?.taskId || "").trim() ? "poll" : "interrupt";
};
