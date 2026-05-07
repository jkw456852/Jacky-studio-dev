import type { BrowserAgentSessionRecord } from "../../services/browser-agent";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const readBrowserAgentString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
};

export const readBrowserAgentStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : [];

export const resolveBrowserAgentSessionResultElementIds = (
  session: BrowserAgentSessionRecord | null | undefined,
): string[] => {
  const metadataIds = readBrowserAgentStringArray(
    session?.metadata?.resultElementIds,
  );
  if (metadataIds.length > 0) {
    return metadataIds;
  }

  const steps = session?.steps || [];
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index];
    if (step.status !== "completed") continue;
    const resultRecord = isRecord(step.result) ? step.result : null;
    const toolResult = isRecord(resultRecord?.result) ? resultRecord.result : null;
    const payload = isRecord(toolResult?.payload) ? toolResult.payload : null;
    const resultIds = readBrowserAgentStringArray(payload?.resultElementIds);
    if (resultIds.length > 0) {
      return resultIds;
    }
    const singleId = readBrowserAgentString(payload?.resultElementId);
    if (singleId) {
      return [singleId];
    }
  }

  const targetId = readBrowserAgentString(session?.metadata?.targetElementId);
  return targetId ? [targetId] : [];
};

export const resolveBrowserAgentStepElementId = (
  step: BrowserAgentSessionRecord["steps"][number],
  session: BrowserAgentSessionRecord | null | undefined,
): string | null => {
  const resultRecord = isRecord(step.result) ? step.result : null;
  const toolResult = isRecord(resultRecord?.result) ? resultRecord.result : null;
  const payload = isRecord(toolResult?.payload) ? toolResult.payload : null;
  const report = isRecord(resultRecord?.report) ? resultRecord.report : null;

  const candidates = [
    readBrowserAgentString(payload?.resultElementId),
    ...readBrowserAgentStringArray(payload?.resultElementIds),
    readBrowserAgentString(step.resolvedInput?.elementId),
    readBrowserAgentString(payload?.targetElementId),
    readBrowserAgentString(payload?.elementId),
    readBrowserAgentString(report?.targetElementId),
    readBrowserAgentString(resultRecord?.elementId),
    ...resolveBrowserAgentSessionResultElementIds(session),
    readBrowserAgentString(session?.metadata?.targetElementId),
  ].filter(Boolean);

  return candidates[0] || null;
};
