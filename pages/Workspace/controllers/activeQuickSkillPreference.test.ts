import assert from "node:assert/strict";
import test from "node:test";

import {
  applyActiveQuickSkill,
  clearActiveQuickSkill,
  clearActiveQuickSkillPreference,
  readActiveQuickSkillPreference,
  subscribeSkillPreferencesUpdated,
} from "./activeQuickSkillPreference.ts";

test("active quick skill preference helpers are safe without window", () => {
  const originalWindow = globalThis.window;
  const mutableGlobal = globalThis as typeof globalThis & {
    window?: typeof globalThis.window;
  };
  try {
    delete mutableGlobal.window;

    assert.doesNotThrow(() => {
      void readActiveQuickSkillPreference();
    });
    assert.doesNotThrow(() => clearActiveQuickSkillPreference());

    const unsubscribe = subscribeSkillPreferencesUpdated(() => {});
    assert.doesNotThrow(() => unsubscribe());
  } finally {
    if (originalWindow !== undefined) {
      mutableGlobal.window = originalWindow;
    }
  }
});

test("applyActiveQuickSkill forwards to setSendSkill and persists preference", () => {
  const calls: Array<unknown> = [];
  const setSendSkill = (skill: unknown) => {
    calls.push(skill);
  };
  const skill = {
    name: "stub",
    iconName: "Sparkles",
    config: { id: "skill-1" },
  } as unknown as Parameters<typeof applyActiveQuickSkill>[0];

  assert.doesNotThrow(() => applyActiveQuickSkill(skill, setSendSkill));
  assert.equal(calls.length, 1);
  assert.strictEqual(calls[0], skill);
});

test("applyActiveQuickSkill tolerates undefined setSendSkill", () => {
  const skill = {
    name: "stub",
    iconName: "Sparkles",
    config: { id: "skill-1" },
  } as unknown as Parameters<typeof applyActiveQuickSkill>[0];
  assert.doesNotThrow(() => applyActiveQuickSkill(skill, undefined));
});

test("clearActiveQuickSkill forwards null to setSendSkill", () => {
  const calls: Array<unknown> = [];
  const setSendSkill = (skill: unknown) => {
    calls.push(skill);
  };
  assert.doesNotThrow(() => clearActiveQuickSkill(setSendSkill));
  assert.equal(calls.length, 1);
  assert.strictEqual(calls[0], null);
});

test("clearActiveQuickSkill tolerates undefined setSendSkill", () => {
  assert.doesNotThrow(() => clearActiveQuickSkill(undefined));
});
