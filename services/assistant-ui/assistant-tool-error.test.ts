import assert from "node:assert/strict";
import test from "node:test";

import { parseAssistantToolError } from "./assistant-tool-error.ts";

test("assistant tool errors expose upstream safety rejection details", () => {
  const result = parseAssistantToolError(
    'Assistant chat failed: message=Your request was rejected by the safety system. safety_violations=[sexual]. | requestId=req-123 | imageProviderId=provider-image | imageProviderBaseUrl=https://images.example.com | imageModelId=gpt-image-2',
  );

  assert.equal(result?.title, "上游安全审核拒绝");
  assert.equal(
    result?.message,
    "Your request was rejected by the safety system. safety_violations=[sexual].",
  );
  assert.equal(result?.requestId, "req-123");
  assert.equal(result?.providerId, "provider-image");
  assert.equal(result?.providerBaseUrl, "https://images.example.com");
  assert.equal(result?.modelId, "gpt-image-2");
});

test("assistant tool errors read nested error messages", () => {
  const result = parseAssistantToolError({
    error: {
      message: "Upstream service temporarily unavailable",
    },
  });

  assert.equal(result?.title, "图片供应商返回失败");
  assert.equal(result?.message, "Upstream service temporarily unavailable");
});
