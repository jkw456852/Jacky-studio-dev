import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_SKILL_EDIT_EVENT,
  ACTIVE_SKILL_VIEW_AUDIT_EVENT,
  dispatchActiveSkillEditEvent,
  dispatchActiveSkillViewAuditEvent,
  subscribeActiveSkillEditEvent,
  subscribeActiveSkillViewAuditEvent,
} from "./activeSkillEvents.ts";

test("active skill event helpers expose the expected event names", () => {
  assert.equal(ACTIVE_SKILL_EDIT_EVENT, "workspace:edit-active-skill");
  assert.equal(ACTIVE_SKILL_VIEW_AUDIT_EVENT, "workspace:view-active-skill-audit");
});

test("active skill event helpers become safe no-ops without window", () => {
  const originalWindow = globalThis.window;
  const mutableGlobal = globalThis as typeof globalThis & {
    window?: typeof globalThis.window;
  };
  try {
    delete mutableGlobal.window;

    assert.doesNotThrow(() => dispatchActiveSkillEditEvent());
    assert.doesNotThrow(() => dispatchActiveSkillViewAuditEvent());

    const unsubscribeEdit = subscribeActiveSkillEditEvent(() => {});
    const unsubscribeAudit = subscribeActiveSkillViewAuditEvent(() => {});
    assert.doesNotThrow(() => unsubscribeEdit());
    assert.doesNotThrow(() => unsubscribeAudit());
  } finally {
    if (originalWindow !== undefined) {
      mutableGlobal.window = originalWindow;
    }
  }
});
