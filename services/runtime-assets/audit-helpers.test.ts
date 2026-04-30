import assert from "node:assert/strict";
import test from "node:test";
import { buildAssetAuditSummary } from "./audit-helpers.ts";

test("buildAssetAuditSummary renders concise human-readable lines", () => {
  const summary = buildAssetAuditSummary([
    {
      id: "audit_1",
      schemaVersion: 1,
      createdAt: 1,
      action: "update",
      targetKind: "workspace-preference",
      targetId: "models",
      summary: "Updated workspace preferences.",
      snapshot: {} as never,
    },
    {
      id: "audit_2",
      schemaVersion: 1,
      createdAt: 2,
      action: "rollback",
      targetKind: "rollback",
      summary: "Rolled back user assets.",
      snapshot: {} as never,
    },
  ]);

  assert.equal(
    summary.includes("workspace-preference:models | update | Updated workspace preferences."),
    true,
  );
  assert.equal(
    summary.includes("rollback | rollback | Rolled back user assets."),
    true,
  );
});
