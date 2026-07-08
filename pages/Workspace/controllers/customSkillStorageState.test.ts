import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCustomSkillDeleteLabel,
  formatCustomSkillStorageBadgeLabel,
  formatCustomSkillStorageLabel,
  getCustomSkillStorageNotice,
  shouldDeleteCustomSkillMarkdownAsset,
} from "./customSkillStorageState.ts";

test("custom skill storage helpers expose distinct labels for each storage state", () => {
  assert.equal(formatCustomSkillStorageLabel("markdown-backed"), "Markdown 已落盘");
  assert.equal(formatCustomSkillStorageLabel("runtime-only"), "仅运行时配置");
  assert.equal(
    formatCustomSkillStorageLabel("missing-markdown-asset"),
    "Markdown 资源缺失",
  );

  assert.equal(formatCustomSkillStorageBadgeLabel("markdown-backed"), null);
  assert.equal(formatCustomSkillStorageBadgeLabel("runtime-only"), "仅运行时");
  assert.equal(
    formatCustomSkillStorageBadgeLabel("missing-markdown-asset"),
    "源文件缺失",
  );
});

test("custom skill storage helpers split delete behavior and notices by state", () => {
  assert.equal(shouldDeleteCustomSkillMarkdownAsset("markdown-backed"), true);
  assert.equal(shouldDeleteCustomSkillMarkdownAsset("runtime-only"), false);
  assert.equal(shouldDeleteCustomSkillMarkdownAsset("missing-markdown-asset"), false);

  assert.equal(formatCustomSkillDeleteLabel("markdown-backed"), "删除 Skill");
  assert.equal(formatCustomSkillDeleteLabel("runtime-only"), "移除本地 Skill");
  assert.equal(
    formatCustomSkillDeleteLabel("missing-markdown-asset"),
    "移除残留 Skill",
  );

  assert.equal(getCustomSkillStorageNotice("runtime-only").tone, "info");
  assert.equal(getCustomSkillStorageNotice("missing-markdown-asset").tone, "warning");
  assert.equal(getCustomSkillStorageNotice("markdown-backed").tone, "neutral");
});
