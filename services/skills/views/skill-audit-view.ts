import type {
  SkillAuditEventType,
  SkillAuditQuery,
  SkillAuditRecord,
  SkillAuditStore,
} from "../governance/skill-governance.ts";

export interface SkillAuditTimelineEntry {
  id: string;
  eventType: SkillAuditEventType;
  title: string;
  actor: string;
  targetId: string;
  targetType: SkillAuditRecord["targetType"];
  timestamp: number;
  reason: string;
  metadataSummary: string[];
}

export interface SkillAuditSummary {
  total: number;
  uniqueActors: number;
  latestTimestamp?: number;
  byEventType: Record<string, number>;
}

export interface ListSkillAuditTimelineArgs extends SkillAuditQuery {
  source: SkillAuditStore | SkillAuditRecord[];
}

const EVENT_LABELS: Record<SkillAuditEventType, string> = {
  "skill.definition.created": "Definition created",
  "skill.version.created": "Version created",
  "skill.version.updated": "Version updated",
  "skill.version.reviewed": "Version reviewed",
  "skill.version.published": "Version published",
  "skill.version.deprecated": "Version deprecated",
  "skill.version.rolled_back": "Version rolled back",
  "skill.run.started": "Run started",
  "skill.run.repaired": "Run repaired",
  "skill.run.fallback": "Run fallback",
  "skill.run.failed": "Run failed",
  "skill.permission.changed": "Permission changed",
};

const matchesAuditQuery = (
  record: SkillAuditRecord,
  query: SkillAuditQuery,
): boolean => {
  if (query.eventType && record.eventType !== query.eventType) return false;
  if (query.actor && record.actor !== query.actor) return false;
  if (query.targetId && record.targetId !== query.targetId) return false;
  if (query.targetType && record.targetType !== query.targetType) return false;
  return true;
};

const readAuditRecords = (
  source: SkillAuditStore | SkillAuditRecord[],
  query: SkillAuditQuery,
): SkillAuditRecord[] =>
  Array.isArray(source)
    ? source
        .filter((record) => matchesAuditQuery(record, query))
        .slice(0, query.limit && query.limit > 0 ? query.limit : undefined)
    : source.list(query);

const toMetadataSummary = (record: SkillAuditRecord): string[] => {
  const metadata = record.metadata ?? {};
  const lines: string[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${key}: ${value.join(", ")}`);
      continue;
    }
    lines.push(`${key}: ${String(value)}`);
  }
  return lines;
};

export const listSkillAuditTimeline = ({
  source,
  ...query
}: ListSkillAuditTimelineArgs): SkillAuditTimelineEntry[] =>
  readAuditRecords(source, query).map((record) => ({
    id: record.id,
    eventType: record.eventType,
    title: EVENT_LABELS[record.eventType],
    actor: record.actor,
    targetId: record.targetId,
    targetType: record.targetType,
    timestamp: record.timestamp,
    reason: record.reason,
    metadataSummary: toMetadataSummary(record),
  }));

export const summarizeSkillAuditTimeline = (
  args: ListSkillAuditTimelineArgs,
): SkillAuditSummary => {
  const records = readAuditRecords(args.source, args);
  const actorIds = new Set<string>();
  const byEventType: Record<string, number> = {};
  let latestTimestamp: number | undefined;

  for (const record of records) {
    actorIds.add(record.actor);
    byEventType[record.eventType] = (byEventType[record.eventType] ?? 0) + 1;
    latestTimestamp =
      latestTimestamp === undefined
        ? record.timestamp
        : Math.max(latestTimestamp, record.timestamp);
  }

  return {
    total: records.length,
    uniqueActors: actorIds.size,
    latestTimestamp,
    byEventType,
  };
};
