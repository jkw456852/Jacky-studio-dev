import { createHash } from "node:crypto";

import type { SkillVersion } from "../catalog/skill-object-types.ts";
import type {
  SkillCatalogStore,
  SkillDraftInput,
  UpdateDraftSkillVersionPatch,
} from "../catalog/store/skill-catalog-store.ts";

export type SkillGovernanceRole =
  | "skill_viewer"
  | "skill_editor"
  | "skill_reviewer"
  | "skill_publisher"
  | "skill_admin";

export type SkillGovernanceAction =
  | "view"
  | "run"
  | "create_draft"
  | "edit_draft"
  | "review"
  | "publish"
  | "deprecate"
  | "rollback"
  | "manage_permissions"
  | "disable";

export interface SkillGovernanceActor {
  id: string;
  roles: SkillGovernanceRole[];
}

export type SkillAuditEventType =
  | "skill.definition.created"
  | "skill.version.created"
  | "skill.version.updated"
  | "skill.version.reviewed"
  | "skill.version.published"
  | "skill.version.deprecated"
  | "skill.version.rolled_back"
  | "skill.run.started"
  | "skill.run.repaired"
  | "skill.run.fallback"
  | "skill.run.failed"
  | "skill.permission.changed";

export type SkillAuditTargetType =
  | "skill-definition"
  | "skill-version"
  | "skill-run"
  | "skill-permission";

export interface SkillAuditRecord {
  id: string;
  eventType: SkillAuditEventType;
  actor: string;
  actorRoles: SkillGovernanceRole[];
  targetId: string;
  targetType: SkillAuditTargetType;
  previousValueHash?: string;
  nextValueHash?: string;
  timestamp: number;
  reason: string;
  workspaceId: string;
  metadata?: Record<string, unknown>;
}

export interface CreateSkillAuditRecordInput {
  eventType: SkillAuditEventType;
  actor: string;
  actorRoles?: SkillGovernanceRole[];
  targetId: string;
  targetType: SkillAuditTargetType;
  previousValueHash?: string;
  nextValueHash?: string;
  timestamp?: number;
  reason: string;
  workspaceId: string;
  metadata?: Record<string, unknown>;
}

export interface SkillAuditQuery {
  eventType?: SkillAuditEventType;
  actor?: string;
  targetId?: string;
  targetType?: SkillAuditTargetType;
  limit?: number;
}

export interface SkillAuditStore {
  append(entry: CreateSkillAuditRecordInput): SkillAuditRecord;
  list(query?: SkillAuditQuery): SkillAuditRecord[];
  clear(): void;
}

export interface CreateInMemorySkillAuditStoreOptions {
  now?: () => number;
}

export interface CreateSkillGovernanceServiceArgs {
  catalog: SkillCatalogStore;
  audits?: SkillAuditStore;
  workspaceId: string;
  hashValue?: (value: unknown) => string;
}

export type SkillReviewDecision = "approved" | "rejected";

export interface SkillGovernanceService {
  audits: SkillAuditStore;
  createDraft(args: {
    actor: SkillGovernanceActor;
    input: SkillDraftInput;
    reason: string;
  }): ReturnType<SkillCatalogStore["createDraftVersion"]>;
  updateDraftVersion(args: {
    actor: SkillGovernanceActor;
    versionId: string;
    patch: UpdateDraftSkillVersionPatch;
    reason: string;
  }): SkillVersion;
  submitVersionForReview(args: {
    actor: SkillGovernanceActor;
    versionId: string;
    reason: string;
  }): SkillVersion;
  reviewVersion(args: {
    actor: SkillGovernanceActor;
    versionId: string;
    decision: SkillReviewDecision;
    reason: string;
  }): SkillVersion;
  publishVersion(args: {
    actor: SkillGovernanceActor;
    versionId: string;
    reason: string;
  }): SkillVersion;
  deprecateVersion(args: {
    actor: SkillGovernanceActor;
    versionId: string;
    reason: string;
  }): SkillVersion;
  rollbackVersion(args: {
    actor: SkillGovernanceActor;
    definitionId: string;
    versionId: string;
    reason: string;
  }): SkillVersion;
  listAuditRecords(query?: SkillAuditQuery): SkillAuditRecord[];
}

const ACTION_ROLES: Record<SkillGovernanceAction, SkillGovernanceRole[]> = {
  view: [
    "skill_viewer",
    "skill_editor",
    "skill_reviewer",
    "skill_publisher",
    "skill_admin",
  ],
  run: [
    "skill_viewer",
    "skill_editor",
    "skill_reviewer",
    "skill_publisher",
    "skill_admin",
  ],
  create_draft: ["skill_editor", "skill_admin"],
  edit_draft: ["skill_editor", "skill_admin"],
  review: ["skill_reviewer", "skill_publisher", "skill_admin"],
  publish: ["skill_publisher", "skill_admin"],
  deprecate: ["skill_publisher", "skill_admin"],
  rollback: ["skill_publisher", "skill_admin"],
  manage_permissions: ["skill_admin"],
  disable: ["skill_admin"],
};

const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
};

const defaultHashValue = (value: unknown): string =>
  createHash("sha1").update(stableSerialize(value)).digest("hex");

export const canActorPerformSkillAction = (
  actor: SkillGovernanceActor,
  action: SkillGovernanceAction,
): boolean => {
  const allowedRoles = ACTION_ROLES[action];
  return actor.roles.some((role) => allowedRoles.includes(role));
};

export const assertActorCanPerformSkillAction = (
  actor: SkillGovernanceActor,
  action: SkillGovernanceAction,
): void => {
  if (!canActorPerformSkillAction(actor, action)) {
    throw new Error(`skill_governance_forbidden: ${actor.id} cannot ${action}`);
  }
};

export const isHighRiskSkillVersion = (version: SkillVersion): boolean =>
  version.manifest.permissions.needsFileWrite === true ||
  version.manifest.permissions.needsExternalProvider === true ||
  (version.manifest.permissions.allowedProviders?.length ?? 0) > 0;

export const createInMemorySkillAuditStore = (
  options: CreateInMemorySkillAuditStoreOptions = {},
): SkillAuditStore => {
  const now = options.now ?? (() => Date.now());
  const records: SkillAuditRecord[] = [];
  const getRecordOrder = (record: SkillAuditRecord): number => {
    const suffix = Number(record.id.slice("skill_audit_".length));
    return Number.isFinite(suffix) ? suffix : 0;
  };

  return {
    append(entry) {
      const record: SkillAuditRecord = {
        id: `skill_audit_${records.length + 1}`,
        eventType: entry.eventType,
        actor: entry.actor,
        actorRoles: [...(entry.actorRoles || [])],
        targetId: entry.targetId,
        targetType: entry.targetType,
        previousValueHash: entry.previousValueHash,
        nextValueHash: entry.nextValueHash,
        timestamp: entry.timestamp ?? now(),
        reason: entry.reason,
        workspaceId: entry.workspaceId,
        metadata: entry.metadata ? { ...entry.metadata } : undefined,
      };
      records.push(record);
      return {
        ...record,
        actorRoles: [...record.actorRoles],
        metadata: record.metadata ? { ...record.metadata } : undefined,
      };
    },

    list(query = {}) {
      const out = records.filter((record) => {
        if (query.eventType && record.eventType !== query.eventType) return false;
        if (query.actor && record.actor !== query.actor) return false;
        if (query.targetId && record.targetId !== query.targetId) return false;
        if (query.targetType && record.targetType !== query.targetType) return false;
        return true;
      });
      out.sort((left, right) => {
        if (right.timestamp !== left.timestamp) {
          return right.timestamp - left.timestamp;
        }
        return getRecordOrder(right) - getRecordOrder(left);
      });
      const limited = query.limit && query.limit > 0 ? out.slice(0, query.limit) : out;
      return limited.map((record) => ({
        ...record,
        actorRoles: [...record.actorRoles],
        metadata: record.metadata ? { ...record.metadata } : undefined,
      }));
    },

    clear() {
      records.length = 0;
    },
  };
};

const requireVersion = (
  catalog: SkillCatalogStore,
  versionId: string,
): SkillVersion => {
  const version = catalog.getVersion(versionId);
  if (!version) throw new Error(`skill_version_not_found: ${versionId}`);
  return version;
};

const getVersionGovernedFingerprint = (version: SkillVersion): string =>
  stableSerialize({
    semver: version.semver,
    manifest: version.manifest,
    sourceSnapshot: version.sourceSnapshot,
  });

export const didDraftVersionChangeRequireReview = (
  previous: SkillVersion,
  next: SkillVersion,
): boolean => getVersionGovernedFingerprint(previous) !== getVersionGovernedFingerprint(next);

export const createSkillGovernanceService = ({
  catalog,
  audits = createInMemorySkillAuditStore(),
  workspaceId,
  hashValue = defaultHashValue,
}: CreateSkillGovernanceServiceArgs): SkillGovernanceService => {
  const writeAudit = ({
    eventType,
    actor,
    targetId,
    targetType,
    reason,
    previousValue,
    nextValue,
    metadata,
  }: {
    eventType: SkillAuditEventType;
    actor: SkillGovernanceActor;
    targetId: string;
    targetType: SkillAuditTargetType;
    reason: string;
    previousValue?: unknown;
    nextValue?: unknown;
    metadata?: Record<string, unknown>;
  }) =>
    audits.append({
      eventType,
      actor: actor.id,
      actorRoles: actor.roles,
      targetId,
      targetType,
      previousValueHash:
        previousValue === undefined ? undefined : hashValue(previousValue),
      nextValueHash: nextValue === undefined ? undefined : hashValue(nextValue),
      reason,
      workspaceId,
      metadata,
    });

  const collectApprovedReviewerIds = (versionId: string): Set<string> =>
    new Set(
      audits
        .list({
          eventType: "skill.version.reviewed",
          targetId: versionId,
        })
        .filter((record) => record.metadata?.decision === "approved")
        .map((record) => record.actor),
    );

  return {
    audits,

    createDraft({ actor, input, reason }) {
      assertActorCanPerformSkillAction(actor, "create_draft");
      const previousDefinition = catalog.getDefinition(input.definition.id);
      const version = catalog.createDraftVersion(input);
      const nextDefinition = catalog.getDefinition(input.definition.id);

      if (!previousDefinition && nextDefinition) {
        writeAudit({
          eventType: "skill.definition.created",
          actor,
          targetId: nextDefinition.id,
          targetType: "skill-definition",
          reason,
          nextValue: nextDefinition,
        });
      }

      writeAudit({
        eventType: "skill.version.created",
        actor,
        targetId: version.id,
        targetType: "skill-version",
        reason,
        nextValue: version,
        metadata: {
          skillDefinitionId: version.skillDefinitionId,
        },
      });

      return version;
    },

    updateDraftVersion({ actor, versionId, patch, reason }) {
      assertActorCanPerformSkillAction(actor, "edit_draft");
      const previous = requireVersion(catalog, versionId);
      let next = catalog.updateDraftVersion(versionId, patch);
      const reviewReset =
        next.reviewStatus !== "draft" &&
        didDraftVersionChangeRequireReview(previous, next);
      if (reviewReset) {
        next = catalog.updateVersionReviewStatus(versionId, "draft", actor.id);
      }
      writeAudit({
        eventType: "skill.version.updated",
        actor,
        targetId: versionId,
        targetType: "skill-version",
        reason,
        previousValue: previous,
        nextValue: next,
        metadata: {
          changedFields: Object.keys(patch).sort(),
          reviewReset,
          fromReviewStatus: previous.reviewStatus,
          toReviewStatus: next.reviewStatus,
        },
      });
      return next;
    },

    submitVersionForReview({ actor, versionId, reason }) {
      assertActorCanPerformSkillAction(actor, "edit_draft");
      const previous = requireVersion(catalog, versionId);
      const next = catalog.updateVersionReviewStatus(versionId, "reviewing", actor.id);
      writeAudit({
        eventType: "skill.version.updated",
        actor,
        targetId: versionId,
        targetType: "skill-version",
        reason,
        previousValue: previous,
        nextValue: next,
        metadata: {
          fromReviewStatus: previous.reviewStatus,
          toReviewStatus: next.reviewStatus,
        },
      });
      return next;
    },

    reviewVersion({ actor, versionId, decision, reason }) {
      assertActorCanPerformSkillAction(actor, "review");
      const previous = requireVersion(catalog, versionId);
      const next = catalog.updateVersionReviewStatus(versionId, decision, actor.id);
      writeAudit({
        eventType: "skill.version.reviewed",
        actor,
        targetId: versionId,
        targetType: "skill-version",
        reason,
        previousValue: previous,
        nextValue: next,
        metadata: {
          decision,
        },
      });
      return next;
    },

    publishVersion({ actor, versionId, reason }) {
      assertActorCanPerformSkillAction(actor, "publish");
      const previous = requireVersion(catalog, versionId);
      if (isHighRiskSkillVersion(previous)) {
        const approvedBy = collectApprovedReviewerIds(versionId);
        if (approvedBy.size < 2) {
          throw new Error(`skill_version_requires_dual_approval: ${versionId}`);
        }
      }
      const next = catalog.publishVersion(versionId, actor.id);
      writeAudit({
        eventType: "skill.version.published",
        actor,
        targetId: versionId,
        targetType: "skill-version",
        reason,
        previousValue: previous,
        nextValue: next,
      });
      return next;
    },

    deprecateVersion({ actor, versionId, reason }) {
      assertActorCanPerformSkillAction(actor, "deprecate");
      const previous = requireVersion(catalog, versionId);
      const next = catalog.deprecateVersion(versionId, actor.id);
      writeAudit({
        eventType: "skill.version.deprecated",
        actor,
        targetId: versionId,
        targetType: "skill-version",
        reason,
        previousValue: previous,
        nextValue: next,
      });
      return next;
    },

    rollbackVersion({ actor, definitionId, versionId, reason }) {
      assertActorCanPerformSkillAction(actor, "rollback");
      const currentDefinition = catalog.getDefinition(definitionId);
      const previousPublishedVersionId = currentDefinition?.currentPublishedVersionId;
      const previous = requireVersion(catalog, versionId);
      const next = catalog.rollbackToVersion(definitionId, versionId, actor.id);
      writeAudit({
        eventType: "skill.version.rolled_back",
        actor,
        targetId: versionId,
        targetType: "skill-version",
        reason,
        previousValue: previous,
        nextValue: next,
        metadata: {
          fromVersionId: previousPublishedVersionId,
          toVersionId: versionId,
        },
      });
      return next;
    },

    listAuditRecords(query = {}) {
      return audits.list(query);
    },
  };
};
