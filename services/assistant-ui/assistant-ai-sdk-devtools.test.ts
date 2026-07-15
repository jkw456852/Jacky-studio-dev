import assert from "node:assert/strict";
import test from "node:test";
import type { LanguageModelMiddleware } from "ai";

import {
  shouldEnableAssistantAiSdkDevTools,
  wrapAssistantLanguageModelWithDevTools,
} from "./assistant-ai-sdk-devtools.ts";

type AssistantLanguageModel = Parameters<
  typeof wrapAssistantLanguageModelWithDevTools
>[0];

const model = {
  specificationVersion: "v3",
  provider: "test",
  modelId: "test-model",
  supportedUrls: {},
  doGenerate: async () => {
    throw new Error("not implemented");
  },
  doStream: async () => {
    throw new Error("not implemented");
  },
} as AssistantLanguageModel;

test("AI SDK DevTools are development-only and can be explicitly disabled", () => {
  assert.equal(
    shouldEnableAssistantAiSdkDevTools({ NODE_ENV: "development" }),
    true,
  );
  assert.equal(
    shouldEnableAssistantAiSdkDevTools({ NODE_ENV: "production" }),
    false,
  );
  assert.equal(
    shouldEnableAssistantAiSdkDevTools({
      NODE_ENV: "development",
      VERCEL_ENV: "production",
    }),
    false,
  );
  assert.equal(
    shouldEnableAssistantAiSdkDevTools({
      NODE_ENV: "development",
      AI_SDK_DEVTOOLS: "off",
    }),
    false,
  );
});

test("production does not load or wrap the language model", async () => {
  let loadCount = 0;
  const result = await wrapAssistantLanguageModelWithDevTools(model, {
    env: { NODE_ENV: "production" },
    loadDevTools: async () => {
      loadCount += 1;
      return {
        devToolsMiddleware: () =>
          ({ specificationVersion: "v3" }) as LanguageModelMiddleware,
      };
    },
  });

  assert.equal(result.enabled, false);
  assert.equal(result.model, model);
  assert.equal(loadCount, 0);
});

test("development uses a fresh official middleware instance per model wrap", async () => {
  let middlewareCount = 0;
  const loadDevTools = async () => ({
    devToolsMiddleware: () => {
      middlewareCount += 1;
      return {} as LanguageModelMiddleware;
    },
  });

  const first = await wrapAssistantLanguageModelWithDevTools(model, {
    env: { NODE_ENV: "development" },
    loadDevTools,
  });
  const second = await wrapAssistantLanguageModelWithDevTools(model, {
    env: { NODE_ENV: "development" },
    loadDevTools,
  });

  assert.equal(first.enabled, true);
  assert.equal(second.enabled, true);
  assert.notEqual(first.model, model);
  assert.notEqual(second.model, model);
  assert.notEqual(first.model, second.model);
  assert.equal(middlewareCount, 2);
});
