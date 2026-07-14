import test from "node:test";
import assert from "node:assert/strict";

import {
  listAssistantChatStudioSkills,
  planAssistantChatStudioWorkflow,
} from "./assistant-chat-studio-skills.ts";

test("assistant Studio skills catalog matches product detail-page multi-image work", async () => {
  const result = await listAssistantChatStudioSkills({
    query: "根据产品图生成一套多张中文详情页",
    limit: 3,
  });

  assert.ok(result.totalAvailable >= result.matches.length);
  assert.equal(result.matches[0]?.id, "cn-detail-page");
  assert.equal(result.matches[0]?.tab, "commerce");
  assert.ok(result.guidance.includes("Studio"));
  assert.ok(result.guidance.includes("createImage"));
});

test("assistant Studio skills catalog supports tab filtering and limits", async () => {
  const result = await listAssistantChatStudioSkills({
    query: "品牌视觉系统和 KV 延展",
    tab: "branding",
    limit: 2,
  });

  assert.equal(result.matches.length, 2);
  assert.ok(result.matches.every((skill) => skill.tab === "branding"));
});

test("assistant Studio skills catalog keeps legacy mojibake out of model-visible output", async () => {
  const result = await listAssistantChatStudioSkills({
    query: "详情页",
    limit: 8,
  });
  const serialized = JSON.stringify(result);

  assert.doesNotMatch(
    serialized,
    /[\uFFFD\u9365\u9471\u6FB6\u5A11\u6748\u93BC\u7D31\u6C8C]/,
  );
  assert.doesNotMatch(
    serialized,
    /\bexecuteSkill\b|\bskillData\b|\bagentData\b|\bChatMessage\b/,
  );
  assert.doesNotMatch(serialized, /\bimages\/referenceImages\b/);
});

test("assistant Studio workflow planning returns structured deliverables for multi-image product pages", async () => {
  const result = await planAssistantChatStudioWorkflow({
    request:
      "\u89c4\u5212\u5e76\u751f\u6210\u4e00\u5957\u591a\u5f20\u56fe\u7684\u8be6\u60c5\u9875\uff0c\u975e\u5355\u5f20",
    imageCount: 4,
    referenceImageCount: 1,
  });

  assert.equal(result.workflowType, "product-detail-page");
  assert.equal(result.workflowId, "cn-detail-page");
  assert.equal(result.imageCount, 4);
  assert.equal(result.referenceImageCount, 1);
  assert.equal(result.deliverables.length, 4);
  assert.equal(result.plan.length, 4);
  assert.equal(result.createImageGuidance.useSeparateImages, true);
  assert.equal(result.createImageGuidance.count, 4);
  assert.equal(result.createImageGuidance.passReferenceImages, true);
  assert.equal(result.createImageGuidance.recommendedInput.count, 4);
  assert.equal(
    result.createImageGuidance.recommendedInput.images,
    "pass-current-reference-images",
  );
  assert.match(
    result.createImageGuidance.recommendedInput.negativeInstruction,
    /collage|four-grid|contact sheet|multi-panel/,
  );
  assert.ok(
    result.deliverables.every((deliverable, index) => {
      return (
        deliverable.index === index + 1 &&
        deliverable.promptBrief.includes(`Separate image ${index + 1} of 4`) &&
        deliverable.promptBrief.includes("Do not compose this as a collage") &&
        deliverable.mustPreserve.some((rule) =>
          rule.includes("Preserve the uploaded/reference product appearance"),
        )
      );
    }),
  );

  const serialized = JSON.stringify(result);
  assert.doesNotMatch(
    serialized,
    /\bexecuteSkill\b|\bskillData\b|\bagentData\b|\bChatMessage\b/,
  );
  assert.doesNotMatch(serialized, /\bimages\/referenceImages\b/);
  assert.match(serialized, /official createImage images input/);
});

test("assistant Studio workflow planning preserves explicit image and reference counts without project cap", async () => {
  const result = await planAssistantChatStudioWorkflow({
    request: "Generate 24 separate Chinese product detail-page images, not one collage.",
    imageCount: 24,
    referenceImageCount: 32,
  });

  assert.equal(result.workflowType, "product-detail-page");
  assert.equal(result.imageCount, 24);
  assert.equal(result.referenceImageCount, 32);
  assert.equal(result.deliverables.length, 24);
  assert.equal(result.plan.length, 24);
  assert.equal(result.createImageGuidance.count, 24);
  assert.equal(result.createImageGuidance.recommendedInput.count, 24);
  assert.ok(
    result.deliverables.every((deliverable, index) =>
      deliverable.promptBrief.includes(`Separate image ${index + 1} of 24`),
    ),
  );
});
