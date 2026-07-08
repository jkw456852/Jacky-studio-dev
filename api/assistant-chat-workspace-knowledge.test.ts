import test from "node:test";
import assert from "node:assert/strict";

import {
  extractAssistantChatWorkspaceKnowledgeSources,
  searchAssistantChatWorkspaceKnowledge,
} from "./assistant-chat-workspace-knowledge.ts";

test("assistant workspace knowledge search finds local Studio assets", async () => {
  const result = await searchAssistantChatWorkspaceKnowledge({
    query: "中文详情页 商品 多张图",
    limit: 5,
  });

  assert.ok(result.totalAvailable > 0);
  assert.ok(result.matches.length > 0);
  assert.ok(
    result.matches.some((match) => match.path.includes("cn-detail-page")),
    "expected cn-detail-page knowledge to be discoverable",
  );
  assert.ok(result.guidance.includes("local XC Studio knowledge"));
});

test("assistant workspace knowledge search supports source filtering", async () => {
  const result = await searchAssistantChatWorkspaceKnowledge({
    query: "poster design",
    source: "studio-skills",
    limit: 3,
  });

  assert.ok(result.totalAvailable > 0);
  assert.ok(result.matches.length > 0);
  assert.ok(result.matches.every((match) => match.source === "studio-skills"));
});

test("assistant workspace knowledge sources map to official source-document parts", () => {
  assert.deepEqual(
    extractAssistantChatWorkspaceKnowledgeSources({
      matches: [
        {
          source: "studio-skills",
          path: "studio-skills/cn-detail-page/SKILL.md",
          title: "CN Detail Page",
          excerpt: "Plan a product detail page.",
          score: 42,
        },
        {
          source: "studio-skills",
          path: "studio-skills/cn-detail-page/SKILL.md",
          title: "Duplicate",
          excerpt: "Duplicate should be ignored.",
          score: 10,
        },
        {
          source: "legacy",
          path: "services/skills/old.skill.ts",
          title: "Legacy",
          excerpt: "Should be ignored.",
          score: 9,
        },
      ],
    }),
    [
      {
        source: "studio-skills",
        path: "studio-skills/cn-detail-page/SKILL.md",
        title: "CN Detail Page",
        excerpt: "Plan a product detail page.",
      },
    ],
  );
});

test("assistant workspace knowledge source extraction is not capped by XC Studio", () => {
  const sources = extractAssistantChatWorkspaceKnowledgeSources({
    matches: Array.from({ length: 12 }, (_, index) => ({
      source: "knowledge",
      path: `knowledge/doc-${index + 1}.md`,
      title: `Doc ${index + 1}`,
      excerpt: "Snippet",
      score: 100 - index,
    })),
  });

  assert.equal(sources.length, 12);
  assert.equal(sources[11]?.path, "knowledge/doc-12.md");
});

test("assistant workspace knowledge search keeps legacy runtime fields out", async () => {
  const result = await searchAssistantChatWorkspaceKnowledge({
    query: "workspaceSearch",
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
});
