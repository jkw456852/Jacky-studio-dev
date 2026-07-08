import type { CustomSkillConfigRecord } from "../../runtime-assets/custom-skill-markdown.ts";
import type { SkillAuditRecord } from "../governance/skill-governance.ts";

export const SKILL_GOVERNANCE_OVERLAY_KEY = "skillGovernance";

export type SkillGovernanceReviewStatus =
  | "draft"
  | "reviewing"
  | "approved"
  | "rejected";

export type SkillGovernanceReleaseStatus =
  | "draft"
  | "published"
  | "deprecated"
  | "rolled_back";

export type SkillGovernanceActionId =
  | "submit_review"
  | "approve"
  | "reject"
  | "publish"
  | "rollback";

export interface SkillGovernanceVersionRecord {
  id: string;
  semver: string;
  snapshot: CustomSkillConfigRecord;
  reviewStatus: SkillGovernanceReviewStatus;
  releaseStatus: SkillGovernanceReleaseStatus;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  publishedAt?: number;
  publishedBy?: string;
}

export interface SkillGovernanceAuditEvent {
  id: string;
  eventType: SkillAuditRecord["eventType"];
  actor: string;
  timestamp: number;
  reason: string;
  targetVersionId?: string;
  metadata?: Record<string, unknown>;
}

export interface SkillGovernanceOverlay {
  schemaVersion: 1;
  currentDraftVersionId?: string;
  currentPublishedVersionId?: string;
  versions: SkillGovernanceVersionRecord[];
  auditTrail: SkillGovernanceAuditEvent[];
}

export interface SkillGovernancePanelAction {
  id: SkillGovernanceActionId;
  label: string;
  tone: "primary" | "secondary" | "danger";
  description: string;
  targetVersionId?: string;
}

export interface SkillGovernancePanelVersionItem {
  id: string;
  semver: string;
  reviewLabel: string;
  releaseLabel: string;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
  isWorkingVersion: boolean;
  isPublishedVersion: boolean;
  isRollbackTarget: boolean;
}

export interface SkillGovernancePanelModel {
  workingVersionId: string;
  workingVersionLabel: string;
  publishedVersionId?: string;
  publishedVersionLabel?: string;
  reviewLabel: string;
  releaseLabel: string;
  headline: string;
  supportingText: string;
  hasDraft: boolean;
  actions: SkillGovernancePanelAction[];
  versions: SkillGovernancePanelVersionItem[];
}

export interface SkillGovernanceSeed {
  skillId: string;
  config: CustomSkillConfigRecord;
  fallbackVersionId?: string;
  fallbackSemver?: string;
  fallbackCreatedAt?: number;
  fallbackUpdatedAt?: number;
}

export interface ApplySkillGovernanceDraftEditArgs extends SkillGovernanceSeed {
  nextConfig: CustomSkillConfigRecord;
  actorId?: string;
  now?: number;
}

export interface ApplySkillGovernanceActionArgs extends SkillGovernanceSeed {
  actionId: SkillGovernanceActionId;
  actorId?: string;
  now?: number;
  targetVersionId?: string;
}

export interface SkillGovernanceMutationResult {
  overlay: SkillGovernanceOverlay;
  nextRuntimeConfig: CustomSkillConfigRecord;
  persistedConfig?: CustomSkillConfigRecord;
  workingVersion: SkillGovernanceVersionRecord;
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeText = (value: unknown): string =>
  String(value || "").replace(/\s+/g, " ").trim();

const deepClone = <T>(value: T): T => {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
};

const stripGovernanceOverlay = (
  config: CustomSkillConfigRecord | null | undefined,
): CustomSkillConfigRecord => {
  const next = {
    ...deepClone((config || {}) as CustomSkillConfigRecord),
  };
  delete next[SKILL_GOVERNANCE_OVERLAY_KEY];
  return next;
};

const sanitizeSnapshotConfig = (
  config: CustomSkillConfigRecord | null | undefined,
): CustomSkillConfigRecord => {
  const next = stripGovernanceOverlay(config);
  if (typeof next.name === "string") {
    next.name = normalizeText(next.name);
  }
  if (typeof next.iconName === "string") {
    next.iconName = normalizeText(next.iconName);
  }
  return next;
};

const normalizeTimestamp = (value: unknown, fallback: number): number => {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : fallback;
};

const sanitizeVersionSuffix = (value: string): string =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "custom-skill";

const buildFallbackVersionId = (skillId: string, ordinal: number): string =>
  `skill_ver__workspace__${sanitizeVersionSuffix(skillId)}__v${ordinal}`;

const toSemverTuple = (value: string): [number, number, number] => {
  const match = normalizeText(value).match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return [1, 0, 0];
  return [
    Number.parseInt(match[1], 10) || 1,
    Number.parseInt(match[2], 10) || 0,
    Number.parseInt(match[3], 10) || 0,
  ];
};

const bumpMinorSemver = (value: string): string => {
  const [major, minor] = toSemverTuple(value);
  return `${major}.${minor + 1}.0`;
};

const sortVersionsDescending = (
  versions: SkillGovernanceVersionRecord[],
): SkillGovernanceVersionRecord[] =>
  [...versions].sort((left, right) => {
    const leftStamp = Number(left.publishedAt || left.updatedAt || left.createdAt || 0);
    const rightStamp = Number(
      right.publishedAt || right.updatedAt || right.createdAt || 0,
    );
    if (rightStamp !== leftStamp) return rightStamp - leftStamp;
    return right.id.localeCompare(left.id);
  });

const sortGovernanceAuditEvents = (
  events: SkillGovernanceAuditEvent[],
): SkillGovernanceAuditEvent[] =>
  [...events].sort((left, right) => {
    if (right.timestamp !== left.timestamp) {
      return right.timestamp - left.timestamp;
    }
    return right.id.localeCompare(left.id);
  });

const readReviewStatus = (value: unknown): SkillGovernanceReviewStatus => {
  switch (normalizeText(value)) {
    case "reviewing":
      return "reviewing";
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "draft":
    default:
      return "draft";
  }
};

const readReleaseStatus = (value: unknown): SkillGovernanceReleaseStatus => {
  switch (normalizeText(value)) {
    case "published":
      return "published";
    case "deprecated":
      return "deprecated";
    case "rolled_back":
      return "rolled_back";
    case "draft":
    default:
      return "draft";
  }
};

const formatReviewLabel = (value: SkillGovernanceReviewStatus): string => {
  switch (value) {
    case "reviewing":
      return "审核中";
    case "approved":
      return "已批准";
    case "rejected":
      return "已驳回";
    case "draft":
    default:
      return "待审核";
  }
};

const formatReleaseLabel = (value: SkillGovernanceReleaseStatus): string => {
  switch (value) {
    case "published":
      return "已发布";
    case "deprecated":
      return "已下线";
    case "rolled_back":
      return "已回滚";
    case "draft":
    default:
      return "草稿";
  }
};

export const formatSkillGovernanceTimestamp = (value?: number): string => {
  const timestamp = Number(value || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "未记录";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
};

const buildBaselineVersionRecord = (
  seed: SkillGovernanceSeed,
): SkillGovernanceVersionRecord => {
  const fallbackCreatedAt = normalizeTimestamp(seed.fallbackCreatedAt, 0);
  const fallbackUpdatedAt = normalizeTimestamp(
    seed.config.updatedAt,
    normalizeTimestamp(seed.fallbackUpdatedAt, fallbackCreatedAt),
  );

  return {
    id:
      normalizeText(seed.fallbackVersionId) || buildFallbackVersionId(seed.skillId, 1),
    semver: normalizeText(seed.fallbackSemver) || "1.0.0",
    snapshot: sanitizeSnapshotConfig(seed.config),
    reviewStatus: "approved",
    releaseStatus: "published",
    createdAt: fallbackCreatedAt,
    updatedAt: fallbackUpdatedAt,
    createdBy: "workspace",
    publishedAt: fallbackUpdatedAt || fallbackCreatedAt || undefined,
    publishedBy: "workspace",
  };
};

const readGovernanceVersionRecord = (
  value: unknown,
  fallbackTimestamp: number,
): SkillGovernanceVersionRecord | null => {
  if (!isObjectRecord(value)) return null;
  const id = normalizeText(value.id);
  const semver = normalizeText(value.semver) || "1.0.0";
  const snapshotSource =
    isObjectRecord(value.snapshot) && !Array.isArray(value.snapshot)
      ? (value.snapshot as CustomSkillConfigRecord)
      : isObjectRecord(value.config)
        ? (value.config as CustomSkillConfigRecord)
        : null;
  if (!id || !snapshotSource) return null;

  const createdAt = normalizeTimestamp(value.createdAt, fallbackTimestamp);
  const updatedAt = normalizeTimestamp(value.updatedAt, createdAt);
  const publishedAt = normalizeTimestamp(value.publishedAt, 0) || undefined;

  return {
    id,
    semver,
    snapshot: sanitizeSnapshotConfig(snapshotSource),
    reviewStatus: readReviewStatus(value.reviewStatus),
    releaseStatus: readReleaseStatus(value.releaseStatus),
    createdAt,
    updatedAt,
    createdBy: normalizeText(value.createdBy) || "workspace",
    ...(publishedAt ? { publishedAt } : {}),
    ...(normalizeText(value.publishedBy)
      ? { publishedBy: normalizeText(value.publishedBy) }
      : {}),
  };
};

const readGovernanceAuditEvent = (
  value: unknown,
  fallbackIndex: number,
): SkillGovernanceAuditEvent | null => {
  if (!isObjectRecord(value)) return null;
  const eventType = normalizeText(value.eventType) as SkillAuditRecord["eventType"];
  const actor = normalizeText(value.actor) || "workspace";
  const reason = normalizeText(value.reason);
  const timestamp = normalizeTimestamp(value.timestamp, 0);
  if (!eventType || !reason || !timestamp) return null;

  return {
    id:
      normalizeText(value.id) ||
      `skill_gov_event_${fallbackIndex}_${timestamp}`,
    eventType,
    actor,
    timestamp,
    reason,
    ...(normalizeText(value.targetVersionId)
      ? { targetVersionId: normalizeText(value.targetVersionId) }
      : {}),
    ...(isObjectRecord(value.metadata)
      ? { metadata: deepClone(value.metadata as Record<string, unknown>) }
      : {}),
  };
};

const getOverlayRaw = (
  config: CustomSkillConfigRecord | null | undefined,
): Record<string, unknown> | null => {
  if (!config) return null;
  const value = config[SKILL_GOVERNANCE_OVERLAY_KEY];
  return isObjectRecord(value) ? value : null;
};

const getVersionById = (
  overlay: SkillGovernanceOverlay,
  versionId?: string | null,
): SkillGovernanceVersionRecord | null => {
  const normalizedId = normalizeText(versionId);
  if (!normalizedId) return null;
  return overlay.versions.find((version) => version.id === normalizedId) || null;
};

const getWorkingVersion = (
  overlay: SkillGovernanceOverlay,
): SkillGovernanceVersionRecord => {
  const draftVersion = getVersionById(overlay, overlay.currentDraftVersionId);
  if (draftVersion) return draftVersion;
  const publishedVersion = getVersionById(overlay, overlay.currentPublishedVersionId);
  if (publishedVersion) return publishedVersion;
  return sortVersionsDescending(overlay.versions)[0];
};

const getPublishedVersion = (
  overlay: SkillGovernanceOverlay,
): SkillGovernanceVersionRecord | null =>
  getVersionById(overlay, overlay.currentPublishedVersionId);

const buildRuntimeConfigWithOverlay = (args: {
  liveConfig: CustomSkillConfigRecord;
  overlay: SkillGovernanceOverlay;
}): CustomSkillConfigRecord => ({
  ...sanitizeSnapshotConfig(args.liveConfig),
  [SKILL_GOVERNANCE_OVERLAY_KEY]: deepClone(args.overlay),
});

const appendAuditTrailEvent = (
  overlay: SkillGovernanceOverlay,
  event: Omit<SkillGovernanceAuditEvent, "id">,
): SkillGovernanceOverlay => {
  const auditEvent: SkillGovernanceAuditEvent = {
    id: `skill_gov_event_${event.timestamp}_${overlay.auditTrail.length + 1}`,
    ...event,
  };

  return {
    ...overlay,
    auditTrail: sortGovernanceAuditEvents([...overlay.auditTrail, auditEvent]),
  };
};

const resolveNextVersionOrdinal = (overlay: SkillGovernanceOverlay): number =>
  overlay.versions.reduce((maxValue, version) => {
    const match = version.id.match(/__v(\d+)$/);
    const current = match ? Number.parseInt(match[1], 10) : 0;
    return Number.isFinite(current) ? Math.max(maxValue, current) : maxValue;
  }, 0) + 1;

const buildDraftVersionFromPublished = (args: {
  overlay: SkillGovernanceOverlay;
  seed: SkillGovernanceSeed;
  nextConfig: CustomSkillConfigRecord;
  actorId: string;
  now: number;
}): SkillGovernanceVersionRecord => {
  const currentPublished =
    getPublishedVersion(args.overlay) || buildBaselineVersionRecord(args.seed);
  const nextOrdinal = resolveNextVersionOrdinal(args.overlay);

  return {
    id: buildFallbackVersionId(args.seed.skillId, nextOrdinal),
    semver: bumpMinorSemver(currentPublished.semver),
    snapshot: sanitizeSnapshotConfig(args.nextConfig),
    reviewStatus: "draft",
    releaseStatus: "draft",
    createdAt: args.now,
    updatedAt: args.now,
    createdBy: args.actorId,
  };
};

const getRollbackTarget = (
  overlay: SkillGovernanceOverlay,
): SkillGovernanceVersionRecord | null => {
  const publishedVersion = getPublishedVersion(overlay);
  if (!publishedVersion) return null;
  return (
    sortVersionsDescending(overlay.versions).find(
      (version) =>
        version.id !== publishedVersion.id &&
        (version.releaseStatus === "published" ||
          version.releaseStatus === "deprecated" ||
          version.releaseStatus === "rolled_back"),
    ) || null
  );
};

export const readSkillGovernanceOverlay = (
  seed: SkillGovernanceSeed,
): SkillGovernanceOverlay => {
  const fallbackTimestamp = normalizeTimestamp(
    seed.config.updatedAt,
    normalizeTimestamp(seed.fallbackUpdatedAt, Date.now()),
  );
  const raw = getOverlayRaw(seed.config);
  const baseline = buildBaselineVersionRecord(seed);

  const rawVersions = Array.isArray(raw?.versions) ? raw?.versions : [];
  const versions = rawVersions
    .map((item) => readGovernanceVersionRecord(item, fallbackTimestamp))
    .filter((item): item is SkillGovernanceVersionRecord => Boolean(item));

  const baselineIndex = versions.findIndex((version) => version.id === baseline.id);
  if (baselineIndex >= 0) {
    const currentPublishedSnapshot =
      versions[baselineIndex].releaseStatus === "published" ||
      normalizeText(raw?.currentPublishedVersionId) === baseline.id
        ? sanitizeSnapshotConfig(seed.config)
        : versions[baselineIndex].snapshot;
    versions[baselineIndex] = {
      ...versions[baselineIndex],
      snapshot: currentPublishedSnapshot,
      updatedAt: normalizeTimestamp(seed.config.updatedAt, versions[baselineIndex].updatedAt),
      publishedAt:
        versions[baselineIndex].releaseStatus === "published"
          ? normalizeTimestamp(
              seed.config.updatedAt,
              normalizeTimestamp(
                versions[baselineIndex].publishedAt,
                versions[baselineIndex].updatedAt,
              ),
            )
          : versions[baselineIndex].publishedAt,
    };
  } else {
    versions.push(baseline);
  }

  const rawAuditTrail = Array.isArray(raw?.auditTrail) ? raw?.auditTrail : [];
  const auditTrail = rawAuditTrail
    .map((item, index) => readGovernanceAuditEvent(item, index))
    .filter((item): item is SkillGovernanceAuditEvent => Boolean(item));

  const currentDraftVersionId = normalizeText(raw?.currentDraftVersionId) || undefined;
  const currentPublishedVersionId =
    normalizeText(raw?.currentPublishedVersionId) || baseline.id;

  return {
    schemaVersion: 1,
    ...(currentDraftVersionId &&
    versions.some((version) => version.id === currentDraftVersionId)
      ? { currentDraftVersionId }
      : {}),
    ...(currentPublishedVersionId &&
    versions.some((version) => version.id === currentPublishedVersionId)
      ? { currentPublishedVersionId }
      : {}),
    versions: sortVersionsDescending(versions),
    auditTrail: sortGovernanceAuditEvents(auditTrail),
  };
};

export const resolveEditableCustomSkillConfig = (
  seed: SkillGovernanceSeed,
): CustomSkillConfigRecord => {
  const overlay = readSkillGovernanceOverlay(seed);
  const draftVersion = getVersionById(overlay, overlay.currentDraftVersionId);
  return draftVersion
    ? deepClone(draftVersion.snapshot)
    : sanitizeSnapshotConfig(seed.config);
};

export const buildSkillGovernancePanelModel = (
  seed: SkillGovernanceSeed,
): SkillGovernancePanelModel => {
  const overlay = readSkillGovernanceOverlay(seed);
  const workingVersion = getWorkingVersion(overlay);
  const publishedVersion = getPublishedVersion(overlay);
  const rollbackTarget = !overlay.currentDraftVersionId
    ? getRollbackTarget(overlay)
    : null;
  const hasDraft = Boolean(
    overlay.currentDraftVersionId &&
      overlay.currentDraftVersionId !== overlay.currentPublishedVersionId,
  );

  const actions: SkillGovernancePanelAction[] = [];
  if (hasDraft) {
    if (
      workingVersion.reviewStatus === "draft" ||
      workingVersion.reviewStatus === "rejected"
    ) {
      actions.push({
        id: "submit_review",
        label: "提交评审",
        tone: "secondary",
        description: "把当前草稿送入评审状态。",
      });
    }
    if (workingVersion.reviewStatus === "reviewing") {
      actions.push({
        id: "approve",
        label: "批准",
        tone: "primary",
        description: "确认当前草稿可以进入发布环节。",
      });
      actions.push({
        id: "reject",
        label: "驳回",
        tone: "danger",
        description: "退回当前草稿，继续补充或修改。",
      });
    }
    if (workingVersion.reviewStatus === "approved") {
      actions.push({
        id: "publish",
        label: "发布",
        tone: "primary",
        description: "把当前草稿写回正式 Skill，并切成线上版本。",
      });
    }
  } else if (rollbackTarget) {
    actions.push({
      id: "rollback",
      label: `回滚到 ${rollbackTarget.semver}`,
      tone: "secondary",
      description: "恢复上一版已发布配置。",
      targetVersionId: rollbackTarget.id,
    });
  }

  let headline = `线上版本 ${publishedVersion?.semver || workingVersion.semver} 已发布`;
  let supportingText = "后续编辑会先形成新的草稿，再进入评审与发布。";
  if (hasDraft) {
    switch (workingVersion.reviewStatus) {
      case "reviewing":
        headline = `草稿 ${workingVersion.semver} 审核中`;
        supportingText = "当前草稿正在等待通过或驳回。";
        break;
      case "approved":
        headline = `草稿 ${workingVersion.semver} 待发布`;
        supportingText = "已经通过评审，可以发布为新的线上版本。";
        break;
      case "rejected":
        headline = `草稿 ${workingVersion.semver} 已驳回`;
        supportingText = "继续修改草稿后，可以重新提交评审。";
        break;
      case "draft":
      default:
        headline = `草稿 ${workingVersion.semver} 待评审`;
        supportingText = "当前变更还未进入评审，不会影响线上版本。";
        break;
    }
  } else if (rollbackTarget) {
    supportingText = `如需恢复，可回滚到 ${rollbackTarget.semver}。`;
  }

  return {
    workingVersionId: workingVersion.id,
    workingVersionLabel: workingVersion.semver,
    ...(publishedVersion
      ? {
          publishedVersionId: publishedVersion.id,
          publishedVersionLabel: publishedVersion.semver,
        }
      : {}),
    reviewLabel: formatReviewLabel(workingVersion.reviewStatus),
    releaseLabel: formatReleaseLabel(workingVersion.releaseStatus),
    headline,
    supportingText,
    hasDraft,
    actions,
    versions: sortVersionsDescending(overlay.versions).map((version) => ({
      id: version.id,
      semver: version.semver,
      reviewLabel: formatReviewLabel(version.reviewStatus),
      releaseLabel: formatReleaseLabel(version.releaseStatus),
      createdAt: version.createdAt,
      updatedAt: version.updatedAt,
      publishedAt: version.publishedAt,
      isWorkingVersion: version.id === workingVersion.id,
      isPublishedVersion: version.id === publishedVersion?.id,
      isRollbackTarget: version.id === rollbackTarget?.id,
    })),
  };
};

export const buildSkillGovernanceAuditRecords = (
  seed: SkillGovernanceSeed,
): SkillAuditRecord[] => {
  const overlay = readSkillGovernanceOverlay(seed);
  return overlay.auditTrail.map((event) => ({
    id: event.id,
    eventType: event.eventType,
    actor: event.actor,
    actorRoles: [],
    targetId: event.targetVersionId || seed.skillId,
    targetType: "skill-version",
    timestamp: event.timestamp,
    reason: event.reason,
    workspaceId: "workspace",
    metadata: event.metadata ? deepClone(event.metadata) : undefined,
  }));
};

export const applySkillGovernanceDraftEdit = (
  args: ApplySkillGovernanceDraftEditArgs,
): SkillGovernanceMutationResult => {
  const now = normalizeTimestamp(args.now, Date.now());
  const actorId = normalizeText(args.actorId) || "workspace";
  let overlay = readSkillGovernanceOverlay(args);
  const currentPublished =
    getPublishedVersion(overlay) || buildBaselineVersionRecord(args);
  let workingVersion = getVersionById(overlay, overlay.currentDraftVersionId);

  if (!workingVersion) {
    workingVersion = buildDraftVersionFromPublished({
      overlay,
      seed: args,
      nextConfig: args.nextConfig,
      actorId,
      now,
    });
    overlay = {
      ...overlay,
      currentDraftVersionId: workingVersion.id,
      versions: sortVersionsDescending([...overlay.versions, workingVersion]),
    };
    overlay = appendAuditTrailEvent(overlay, {
      eventType: "skill.version.created",
      actor: actorId,
      timestamp: now,
      reason: `创建草稿版本 ${workingVersion.semver}。`,
      targetVersionId: workingVersion.id,
      metadata: {
        publishedVersionId: currentPublished.id,
      },
    });
  }

  const finalWorkingVersion: SkillGovernanceVersionRecord = {
    ...(workingVersion || buildDraftVersionFromPublished({
      overlay,
      seed: args,
      nextConfig: args.nextConfig,
      actorId,
      now,
    })),
    snapshot: sanitizeSnapshotConfig(args.nextConfig),
    reviewStatus: "draft",
    releaseStatus: "draft",
    updatedAt: now,
  };

  overlay = {
    ...overlay,
    currentDraftVersionId: finalWorkingVersion.id,
    versions: sortVersionsDescending(
      overlay.versions.map((version) =>
        version.id === finalWorkingVersion.id ? finalWorkingVersion : version,
      ),
    ),
  };
  overlay = appendAuditTrailEvent(overlay, {
    eventType: "skill.version.updated",
    actor: actorId,
    timestamp: now,
    reason: `更新草稿版本 ${finalWorkingVersion.semver}。`,
    targetVersionId: finalWorkingVersion.id,
    metadata: {
      reviewStatus: finalWorkingVersion.reviewStatus,
      releaseStatus: finalWorkingVersion.releaseStatus,
    },
  });

  return {
    overlay,
    nextRuntimeConfig: buildRuntimeConfigWithOverlay({
      liveConfig: currentPublished.snapshot,
      overlay,
    }),
    workingVersion: finalWorkingVersion,
  };
};

export const applySkillGovernanceAction = (
  args: ApplySkillGovernanceActionArgs,
): SkillGovernanceMutationResult => {
  const now = normalizeTimestamp(args.now, Date.now());
  const actorId = normalizeText(args.actorId) || "workspace";
  let overlay = readSkillGovernanceOverlay(args);
  let workingVersion = getWorkingVersion(overlay);
  const publishedVersion = getPublishedVersion(overlay);

  if (args.actionId === "submit_review") {
    if (!overlay.currentDraftVersionId) {
      throw new Error("skill_governance_draft_required");
    }
    workingVersion = {
      ...workingVersion,
      reviewStatus: "reviewing",
      updatedAt: now,
    };
    overlay = {
      ...overlay,
      versions: sortVersionsDescending(
        overlay.versions.map((version) =>
          version.id === workingVersion.id ? workingVersion : version,
        ),
      ),
    };
    overlay = appendAuditTrailEvent(overlay, {
      eventType: "skill.version.updated",
      actor: actorId,
      timestamp: now,
      reason: `提交草稿 ${workingVersion.semver} 进入评审。`,
      targetVersionId: workingVersion.id,
      metadata: {
        reviewStatus: "reviewing",
      },
    });
    return {
      overlay,
      nextRuntimeConfig: buildRuntimeConfigWithOverlay({
        liveConfig: publishedVersion?.snapshot || sanitizeSnapshotConfig(args.config),
        overlay,
      }),
      workingVersion,
    };
  }

  if (args.actionId === "approve" || args.actionId === "reject") {
    if (!overlay.currentDraftVersionId) {
      throw new Error("skill_governance_draft_required");
    }
    workingVersion = {
      ...workingVersion,
      reviewStatus: args.actionId === "approve" ? "approved" : "rejected",
      updatedAt: now,
    };
    overlay = {
      ...overlay,
      versions: sortVersionsDescending(
        overlay.versions.map((version) =>
          version.id === workingVersion.id ? workingVersion : version,
        ),
      ),
    };
    overlay = appendAuditTrailEvent(overlay, {
      eventType: "skill.version.reviewed",
      actor: actorId,
      timestamp: now,
      reason:
        args.actionId === "approve"
          ? `批准草稿 ${workingVersion.semver}。`
          : `驳回草稿 ${workingVersion.semver}。`,
      targetVersionId: workingVersion.id,
      metadata: {
        decision: args.actionId === "approve" ? "approved" : "rejected",
      },
    });
    return {
      overlay,
      nextRuntimeConfig: buildRuntimeConfigWithOverlay({
        liveConfig: publishedVersion?.snapshot || sanitizeSnapshotConfig(args.config),
        overlay,
      }),
      workingVersion,
    };
  }

  if (args.actionId === "publish") {
    if (!overlay.currentDraftVersionId) {
      throw new Error("skill_governance_draft_required");
    }
    if (workingVersion.reviewStatus !== "approved") {
      throw new Error("skill_governance_approval_required");
    }
    const previousPublishedId = overlay.currentPublishedVersionId;
    const nextVersions = overlay.versions.map((version) => {
      if (version.id === workingVersion.id) {
        return {
          ...version,
          reviewStatus: "approved" as const,
          releaseStatus: "published" as const,
          updatedAt: now,
          publishedAt: now,
          publishedBy: actorId,
        };
      }
      if (version.id === previousPublishedId && version.id !== workingVersion.id) {
        return {
          ...version,
          releaseStatus: "deprecated" as const,
          updatedAt: now,
        };
      }
      return version;
    });
    overlay = {
      ...overlay,
      currentDraftVersionId: undefined,
      currentPublishedVersionId: workingVersion.id,
      versions: sortVersionsDescending(nextVersions),
    };
    if (previousPublishedId && previousPublishedId !== workingVersion.id) {
      overlay = appendAuditTrailEvent(overlay, {
        eventType: "skill.version.deprecated",
        actor: actorId,
        timestamp: now,
        reason: `将上一线上版本 ${previousPublishedId} 标记为历史版本。`,
        targetVersionId: previousPublishedId,
      });
    }
    overlay = appendAuditTrailEvent(overlay, {
      eventType: "skill.version.published",
      actor: actorId,
      timestamp: now,
      reason: `发布草稿 ${workingVersion.semver} 为新的线上版本。`,
      targetVersionId: workingVersion.id,
      metadata: {
        previousPublishedVersionId: previousPublishedId,
      },
    });

    const persistedConfig = sanitizeSnapshotConfig(workingVersion.snapshot);
    const publishedWorkingVersion = getVersionById(overlay, workingVersion.id);
    if (!publishedWorkingVersion) {
      throw new Error("skill_governance_published_version_missing");
    }

    return {
      overlay,
      nextRuntimeConfig: buildRuntimeConfigWithOverlay({
        liveConfig: persistedConfig,
        overlay,
      }),
      persistedConfig,
      workingVersion: publishedWorkingVersion,
    };
  }

  if (args.actionId === "rollback") {
    const currentPublishedVersion = getPublishedVersion(overlay);
    if (!currentPublishedVersion) {
      throw new Error("skill_governance_published_version_required");
    }
    const rollbackTarget =
      getVersionById(overlay, args.targetVersionId) || getRollbackTarget(overlay);
    if (!rollbackTarget) {
      throw new Error("skill_governance_rollback_target_missing");
    }

    const nextVersions = overlay.versions.map((version) => {
      if (version.id === currentPublishedVersion.id) {
        return {
          ...version,
          releaseStatus: "rolled_back" as const,
          updatedAt: now,
        };
      }
      if (version.id === rollbackTarget.id) {
        return {
          ...version,
          releaseStatus: "published" as const,
          reviewStatus: "approved" as const,
          updatedAt: now,
          publishedAt: now,
          publishedBy: actorId,
        };
      }
      return version;
    });
    overlay = {
      ...overlay,
      currentPublishedVersionId: rollbackTarget.id,
      versions: sortVersionsDescending(nextVersions),
    };
    overlay = appendAuditTrailEvent(overlay, {
      eventType: "skill.version.rolled_back",
      actor: actorId,
      timestamp: now,
      reason: `把线上版本从 ${currentPublishedVersion.semver} 回滚到 ${rollbackTarget.semver}。`,
      targetVersionId: rollbackTarget.id,
      metadata: {
        fromVersionId: currentPublishedVersion.id,
        toVersionId: rollbackTarget.id,
      },
    });

    const liveVersion = getVersionById(overlay, rollbackTarget.id);
    if (!liveVersion) {
      throw new Error("skill_governance_rollback_version_missing");
    }
    const persistedConfig = sanitizeSnapshotConfig(liveVersion.snapshot);

    return {
      overlay,
      nextRuntimeConfig: buildRuntimeConfigWithOverlay({
        liveConfig: persistedConfig,
        overlay,
      }),
      persistedConfig,
      workingVersion: liveVersion,
    };
  }

  throw new Error(`skill_governance_action_unsupported: ${args.actionId}`);
};
