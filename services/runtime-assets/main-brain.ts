import { getStudioUserAssetApi } from "./api.ts";
import {
  DEFAULT_MAIN_BRAIN_PREFERENCES,
  normalizeMainBrainPreferences,
} from "./main-brain-shared.ts";

export { normalizeMainBrainPreferences } from "./main-brain-shared.ts";

export interface MainBrainPreferenceBlockOptions {
  topicId?: string | null;
}

const normalizeSummaryItems = (values: string[]): string[] =>
  values
    .map((item) => String(item || "").trim())
    .filter(Boolean);

const pushSummaryList = (
  target: string[],
  label: string,
  values: string[],
  limit = 4,
): void => {
  const normalized = normalizeSummaryItems(values);
  if (normalized.length === 0) return;
  const visible = normalized.slice(0, limit);
  const overflow =
    normalized.length > limit ? ` (+${normalized.length - limit} more)` : "";
  target.push(`- ${label}: ${visible.join("; ")}${overflow}`);
};

const pushSummaryValue = (
  target: string[],
  label: string,
  value: string | number | null | undefined,
): void => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return;
  target.push(`- ${label}: ${normalized}`);
};

const formatBoolean = (value: boolean): string => (value ? "yes" : "no");

const buildSection = (title: string, lines: string[]): string =>
  lines.length > 0 ? [title, ...lines].join("\n") : "";

export const getDefaultMainBrainPreferences = (): string[] => [
  ...DEFAULT_MAIN_BRAIN_PREFERENCES,
];

export const getMainBrainPreferenceLines = (): string[] => {
  const userLines = getStudioUserAssetApi().getMainBrainPreferences();
  const merged = [...DEFAULT_MAIN_BRAIN_PREFERENCES, ...userLines];
  return merged.filter(
    (item, index) => item && merged.findIndex((entry) => entry === item) === index,
  );
};

const buildSoulSummaryLines = (): string[] => {
  const soul = getStudioUserAssetApi().getMainBrainSoul();
  const lines: string[] = [];
  pushSummaryValue(lines, "Persona", soul.persona);
  pushSummaryList(lines, "Tone", soul.tone);
  pushSummaryList(lines, "Working style", soul.workingStyle);
  pushSummaryList(lines, "Restraint rules", soul.restraintRules, 3);
  pushSummaryList(lines, "Self-check rules", soul.selfCheckRules, 3);
  pushSummaryValue(lines, "Risk preference", soul.riskPreference);
  return lines;
};

const buildUserSummaryLines = (): string[] => {
  const user = getStudioUserAssetApi().getMainBrainUser();
  const lines: string[] = [];
  pushSummaryList(lines, "Goals", user.goals, 3);
  pushSummaryList(lines, "Working habits", user.workingHabits, 3);
  pushSummaryList(lines, "Business context", user.businessContext, 3);
  pushSummaryList(lines, "Aesthetic preferences", user.aestheticPreferences, 3);
  pushSummaryList(lines, "Communication style", user.communicationStyle, 3);
  pushSummaryList(lines, "Permanent notes", user.permanentNotes, 3);
  pushSummaryList(lines, "Do-not-store memory cues", user.memoryBlacklist, 3);
  return lines;
};

const buildWorkflowSummaryLines = (): string[] => {
  const workflow = getStudioUserAssetApi().getMainBrainWorkflow();
  const lines: string[] = [];
  pushSummaryValue(
    lines,
    "Default analysis depth",
    workflow.defaultAnalysisDepth,
  );
  pushSummaryValue(lines, "Search policy", workflow.searchPolicy);
  pushSummaryValue(
    lines,
    "Clarify before execution",
    formatBoolean(workflow.clarifyBeforeExecution),
  );
  pushSummaryList(lines, "Tool-use guidelines", workflow.toolUseGuidelines, 4);
  pushSummaryList(
    lines,
    "Failure recovery rules",
    workflow.failureRecoveryRules,
    4,
  );
  lines.push(
    `- Role governance defaults: mode=${workflow.roleGovernanceDefaults.mode}, allowDraft=${formatBoolean(workflow.roleGovernanceDefaults.allowDraft)}, allowAutoPromote=${formatBoolean(workflow.roleGovernanceDefaults.allowAutoPromote)}, allowAutoArchive=${formatBoolean(workflow.roleGovernanceDefaults.allowAutoArchive)}`,
  );
  return lines;
};

const buildMemorySummaryLines = (options?: MainBrainPreferenceBlockOptions): string[] => {
  const topicId = String(options?.topicId || "").trim();
  const memory = getStudioUserAssetApi().getMainBrainMemory();
  const lines: string[] = [];
  const activeRecords = Object.values(memory.memoryRecords || {})
    .filter((item) => item?.status === "active")
    .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0));
  const topicRecords = topicId
    ? activeRecords.filter((item) => String(item.topicId || "").trim() === topicId)
    : [];
  const preferredRecords = topicRecords.length > 0 ? topicRecords : activeRecords;
  pushSummaryList(
    lines,
    topicRecords.length > 0
      ? "Topic-linked active memories"
      : "Active long-term memories",
    preferredRecords.map((item) => item.summary),
    4,
  );
  pushSummaryList(lines, "Daily summary cues", memory.dailySummary, 4);
  pushSummaryList(lines, "Memory blacklists", memory.memoryBlacklists, 3);
  if (memory.pendingMemoryCandidates.length > 0) {
    lines.push(
      `- Pending memory candidates: ${memory.pendingMemoryCandidates.length}`,
    );
  }
  return lines;
};

const buildHeartbeatSummaryLines = (): string[] => {
  const heartbeat = getStudioUserAssetApi().getMainBrainHeartbeat();
  const lines: string[] = [];
  pushSummaryValue(lines, "Heartbeat enabled", formatBoolean(heartbeat.enabled));
  if (!heartbeat.enabled) {
    return lines;
  }
  pushSummaryValue(lines, "Heartbeat cadence", heartbeat.cadence);
  pushSummaryList(lines, "Heartbeat scope", heartbeat.scope, 4);
  pushSummaryList(lines, "Heartbeat recent summaries", heartbeat.recentRunSummary, 3);
  const enabledTasks = Object.values(heartbeat.heartbeatTasks || {}).filter((item) => item.enabled);
  if (enabledTasks.length > 0) {
    lines.push(`- Enabled heartbeat tasks: ${enabledTasks.length}`);
    pushSummaryList(
      lines,
      "Heartbeat task highlights",
      enabledTasks
        .sort((left, right) => (right.lastRunAt || right.nextRunAt || 0) - (left.lastRunAt || left.nextRunAt || 0))
        .map((item) => `${item.title} / ${item.cadence} / ${item.lastSummary}`),
      2,
    );
  }
  pushSummaryValue(lines, "Heartbeat last run at", heartbeat.lastRunAt);
  pushSummaryValue(lines, "Heartbeat next run at", heartbeat.nextRunAt);
  return lines;
};

export const getMainBrainPreferenceBlock = (
  options?: MainBrainPreferenceBlockOptions,
): string => {
  const sections = [
    buildSection("# User Main Brain Preferences", [
      "- The following long-term working preferences come from the user's durable main-brain settings.",
      "- Treat them as active behavior constraints across routing, planning, refactoring, and execution unless they conflict with safety or tool requirements.",
      ...getMainBrainPreferenceLines().map((item) => `- ${item}`),
    ]),
    buildSection("# Main Brain Soul Summary", buildSoulSummaryLines()),
    buildSection("# Main Brain User Summary", buildUserSummaryLines()),
    buildSection("# Main Brain Workflow Summary", buildWorkflowSummaryLines()),
    buildSection("# Main Brain Memory Summary", buildMemorySummaryLines(options)),
    buildSection("# Main Brain Heartbeat Summary", buildHeartbeatSummaryLines()),
  ].filter(Boolean);

  return sections.join("\n\n");
};
