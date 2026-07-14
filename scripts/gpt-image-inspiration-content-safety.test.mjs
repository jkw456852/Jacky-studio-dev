import assert from "node:assert/strict";
import test from "node:test";

import {
  filterSafeNanobananaSections,
  isNanobananaSectionSafe,
} from "./gpt-image-inspiration-content-safety.mjs";

test("filters Nano Banana NSFW and restricted sections", () => {
  const sections = [
    { id: "demo", title: "动漫 SFW", isRestricted: false },
    { id: "sfw-real", title: "真人 SFW", isRestricted: false },
    { id: "anime-nsfw", title: "动漫（nsfw）", isRestricted: false },
    { id: "real-nsfw", title: "真人 (NSFW)", isRestricted: false },
    { id: "gore", title: "猎奇", isRestricted: true },
  ];

  assert.deepEqual(
    filterSafeNanobananaSections(sections).map((section) => section.id),
    ["demo", "sfw-real"],
  );
});

test("does not inspect safe-section prompt text for standalone NSFW words", () => {
  assert.equal(
    isNanobananaSectionSafe({
      id: "demo",
      title: "动漫 SFW",
      isRestricted: false,
      prompts: [{ content: "Negative prompt: NSFW, nudity" }],
    }),
    true,
  );
});

test("rejects malformed section entries", () => {
  assert.equal(isNanobananaSectionSafe(null), false);
  assert.deepEqual(filterSafeNanobananaSections(null), []);
});
