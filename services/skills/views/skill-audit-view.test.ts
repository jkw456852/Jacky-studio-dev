import assert from "node:assert/strict";
import test from "node:test";

import { createInMemorySkillAuditStore } from "../governance/skill-governance.ts";
import {
  listSkillAuditTimeline,
  summarizeSkillAuditTimeline,
} from "./skill-audit-view.ts";

test("listSkillAuditTimeline maps audit records into UI-friendly timeline rows", () => {
  const store = createInMemorySkillAuditStore({
    now: () => 100,
  });
  store.append({
    eventType: "skill.version.published",
    actor: "publisher-a",
    actorRoles: ["skill_publisher"],
    targetId: "skill_ver__1",
    targetType: "skill-version",
    reason: "publish stable version",
    workspaceId: "workspace-1",
    metadata: {
      toVersionId: "skill_ver__1",
      changedFields: ["manifest", "semver"],
    },
  });

  const rows = listSkillAuditTimeline({
    source: store,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "Version published");
  assert.equal(rows[0].actor, "publisher-a");
  assert.equal(rows[0].metadataSummary.includes("toVersionId: skill_ver__1"), true);
});

test("summarizeSkillAuditTimeline aggregates actors, event counts, and latest timestamp", () => {
  const store = createInMemorySkillAuditStore();
  store.append({
    eventType: "skill.version.created",
    actor: "editor-a",
    actorRoles: ["skill_editor"],
    targetId: "skill_ver__1",
    targetType: "skill-version",
    reason: "create",
    workspaceId: "workspace-1",
    timestamp: 10,
  });
  store.append({
    eventType: "skill.version.reviewed",
    actor: "reviewer-a",
    actorRoles: ["skill_reviewer"],
    targetId: "skill_ver__1",
    targetType: "skill-version",
    reason: "approve",
    workspaceId: "workspace-1",
    timestamp: 20,
  });

  const summary = summarizeSkillAuditTimeline({
    source: store,
  });
  assert.equal(summary.total, 2);
  assert.equal(summary.uniqueActors, 2);
  assert.equal(summary.latestTimestamp, 20);
  assert.equal(summary.byEventType["skill.version.created"], 1);
  assert.equal(summary.byEventType["skill.version.reviewed"], 1);
});
