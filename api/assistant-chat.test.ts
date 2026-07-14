import test, { after } from "node:test";
import assert from "node:assert/strict";
import { safeValidateUIMessages } from "ai";

import {
  ASSISTANT_CHAT_DATA_SCHEMAS,
  ASSISTANT_CHAT_METADATA_SCHEMA,
  ASSISTANT_CHAT_STREAM_TEXT_INCLUDE_SETTINGS,
  buildAssistantChatCallSettings,
  buildAssistantChatProviderOptions,
  buildAssistantChatImageMemoryContext,
  buildAssistantChatSystemPrompt,
  buildAssistantChatVisibleLanguageSystemHint,
  createAssistantChatMessageMetadata,
  deriveAssistantChatDirectiveRequestOverrides,
  extractAssistantChatLatestUserDirectiveMentions,
  getAssistantChatImageMemoryItems,
  getDefaultImageReferenceUrls,
  getLatestUserImageReferenceContexts,
  getLatestUserImageMarkContexts,
  getRecentImageReferenceUrls,
  getLatestUserImageFilePartUrls,
  getRecentGeneratedImageReferenceUrls,
  getRecentUserImageReferenceUrls,
  injectAssistantImageMemoryContext,
  isAssistantChatMultiImageAssetRequest,
  isExplicitAssistantChatImageGenerationRequest,
  preserveAssistantChatServerToolApproval,
  pruneAssistantChatModelMessagesForContext,
  resolveAssistantChatRequestedImageCount,
  resolveAssistantChatEffectiveToolChoice,
  resolveAssistantChatNativeOpenAIImageGeneration,
  resolveAssistantChatRequestedActiveTools,
  resolveAssistantChatStudioWorkflowPrepareStep,
  resolveAssistantChatToolChoice,
  sanitizeAssistantChatActiveTools,
  sanitizeAssistantChatFrontendTools,
  shouldEnableAssistantChatNativeWebSearch,
  stripOversizedImageFilePartsForModelMessages,
} from "./assistant-chat.ts";
import {
  createLanguageModelBundle,
  isOfficialOpenAIProvider,
  normalizeOpenAIBaseURL,
  resolveModelId,
  resolveProviderConfig,
  shouldRequestOpenAIReasoningSummary,
  type AssistantChatProviderConfig,
} from "./assistant-chat-provider.ts";
import { extractAssistantChatWebSearchSources } from "./assistant-chat-web-search.ts";

after(() => {
  // Importing assistant-chat pulls in assistant-ui/AI SDK runtime modules that
  // can leave Node test handles open after assertions finish in this environment.
  process.exitCode = process.exitCode ?? 0;
  setImmediate(() => process.exit(process.exitCode ?? 0));
});

const customProvider: Required<AssistantChatProviderConfig> = {
  id: "custom_1782374003147",
  name: "Custom OpenAI-compatible",
  baseUrl: "https://api.example.test",
  apiKey: "test-key",
};

test("assistant chat disables AI SDK step request-body retention for image-heavy streams", () => {
  assert.deepEqual(ASSISTANT_CHAT_STREAM_TEXT_INCLUDE_SETTINGS, {
    requestBody: false,
  });
});

test("assistant chat message metadata follows AI SDK usage conventions", () => {
  assert.deepEqual(
    createAssistantChatMessageMetadata(
      {
        type: "finish",
        totalUsage: {
          inputTokens: 12,
          outputTokens: 8,
          totalTokens: 20,
        },
      },
      {
        modelId: "gpt-5.4",
        providerId: "custom_1782374003147",
      },
    ),
    {
      usage: {
        inputTokens: 12,
        outputTokens: 8,
        totalTokens: 20,
      },
      modelId: "gpt-5.4",
      providerId: "custom_1782374003147",
    },
  );

  assert.deepEqual(
    createAssistantChatMessageMetadata(
      {
        type: "finish-step",
        response: {
          modelId: "gpt-5.4-chat-step",
        },
      },
      {
        modelId: "gpt-5.4",
        providerId: "custom_1782374003147",
      },
    ),
    {
      modelId: "gpt-5.4-chat-step",
      providerId: "custom_1782374003147",
    },
  );

  assert.equal(
    createAssistantChatMessageMetadata(
      {
        type: "text-delta",
      },
      {
        modelId: "gpt-5.4",
        providerId: "custom_1782374003147",
      },
    ),
    undefined,
  );
});

test("assistant chat validates official AI SDK assistant status data parts", async () => {
  const valid = await safeValidateUIMessages({
    messages: [
      {
        id: "msg-status-valid",
        role: "assistant",
        parts: [
          {
            type: "data-assistant-status",
            data: {
              stage: "tool-start",
              message: "正在调用工具...",
              requestId: "req-1",
              elapsedMs: 12,
              toolName: "createImage",
              providerId: "custom_1782374003147",
              modelId: "gpt-5.4",
            },
          },
        ],
      },
    ],
    dataSchemas: ASSISTANT_CHAT_DATA_SCHEMAS,
  });

  assert.equal(valid.success, true);

  const invalid = await safeValidateUIMessages({
    messages: [
      {
        id: "msg-status-invalid",
        role: "assistant",
        parts: [
          {
            type: "data-assistant-status",
            data: {
              stage: "unknown-stage",
              message: "bad",
              requestId: "req-1",
              elapsedMs: 12,
            },
          },
        ],
      },
    ],
    dataSchemas: ASSISTANT_CHAT_DATA_SCHEMAS,
  });

  assert.equal(invalid.success, false);
});

test("assistant chat validates official AI SDK message metadata", async () => {
  const valid = await safeValidateUIMessages({
    messages: [
      {
        id: "msg-metadata-valid",
        role: "assistant",
        metadata: {
          usage: {
            inputTokens: 12,
            outputTokens: 8,
            totalTokens: 20,
          },
          modelId: "gpt-5.4",
          providerId: "custom_1782374003147",
          submittedFeedback: {
            type: "positive",
          },
          custom: {
            quote: {
              text: "请参考这句话继续",
              messageId: "user-1",
            },
          },
          unknownHistoricalField: {
            preserved: true,
          },
        },
        parts: [{ type: "text", text: "ok" }],
      },
    ],
    metadataSchema: ASSISTANT_CHAT_METADATA_SCHEMA,
  });

  assert.equal(valid.success, true);

  const invalid = await safeValidateUIMessages({
    messages: [
      {
        id: "msg-metadata-invalid",
        role: "assistant",
        metadata: {
          submittedFeedback: {
            type: "maybe",
          },
        },
        parts: [{ type: "text", text: "bad" }],
      },
    ],
    metadataSchema: ASSISTANT_CHAT_METADATA_SCHEMA,
  });

  assert.equal(invalid.success, false);
});

test("custom OpenAI-compatible providers use chat completions, not responses", () => {
  const { model, providerTools } = createLanguageModelBundle(customProvider, "gpt-5.4", {
    hasFunctionTools: false,
    enableNativeWebSearch: true,
  });

  assert.equal(model.provider, "custom_1782374003147.chat");
  assert.equal(model.modelId, "gpt-5.4");
  assert.equal(model.specificationVersion, "v3");
  assert.deepEqual(Object.keys(providerTools), []);
});

test("custom provider ids are never treated as official OpenAI Responses providers", () => {
  assert.equal(
    isOfficialOpenAIProvider({
      id: "custom_1782374003147",
      baseUrl: "https://api.openai.com/v1",
    }),
    false,
  );
});

test("official OpenAI provider can use Responses API provider tools", () => {
  const { model, providerTools } = createLanguageModelBundle(
    {
      id: "openai",
      name: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "test-key",
    },
    "gpt-5.4",
    { hasFunctionTools: false, enableNativeWebSearch: true },
  );

  assert.equal(model.provider, "openai.responses");
  assert.equal(model.specificationVersion, "v3");
  assert.deepEqual(Object.keys(providerTools), ["web_search"]);
});

test("official OpenAI provider can register native Responses image generation when explicitly enabled", () => {
  const nativeOpenAIImageGeneration = {
    model: "gpt-image-1",
    outputFormat: "png" as const,
    quality: "auto" as const,
    size: "1024x1024" as const,
  };
  const { providerTools } = createLanguageModelBundle(
    {
      id: "openai",
      name: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "test-key",
    },
    "gpt-5.4",
    {
      hasFunctionTools: true,
      enableNativeWebSearch: false,
      nativeOpenAIImageGeneration,
    },
  );

  assert.deepEqual(Object.keys(providerTools), ["image_generation"]);
  assert.equal("store" in nativeOpenAIImageGeneration, false);
});

test("official OpenAI provider does not register native web search when disabled", () => {
  const { providerTools } = createLanguageModelBundle(
    {
      id: "openai",
      name: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "test-key",
    },
    "gpt-5.4",
    { hasFunctionTools: false, enableNativeWebSearch: false },
  );

  assert.deepEqual(Object.keys(providerTools), []);
});

test("assistant chat system prompt asks visible reasoning to follow user language", () => {
  const prompt = buildAssistantChatSystemPrompt({
    system: "You are XC Studio.",
    imageModeEnabled: true,
    imageToolAvailable: true,
    latestUserText: "请用中文回答，并展示思考过程",
  });

  assert.ok(prompt);
  assert.match(prompt, /latest user message/);
  assert.match(prompt, /reasoning summaries\/reasoning parts/);
  assert.match(prompt, /Chinese/);
  assert.match(prompt, /本轮用户最新消息使用中文/);
  assert.match(prompt, /不要用英文撰写思考过程/);
  assert.match(prompt, /Image mode is enabled/);
});

test("assistant chat visible language hint only adds Chinese guard for CJK user text", () => {
  assert.match(
    buildAssistantChatVisibleLanguageSystemHint("为什么思考过程是英文的"),
    /不要用英文撰写思考过程/,
  );
  assert.doesNotMatch(
    buildAssistantChatVisibleLanguageSystemHint("Why is the reasoning in English?"),
    /不要用英文撰写思考过程/,
  );
});

test("native web search eligibility only depends on custom web search tools", () => {
  assert.equal(
    shouldEnableAssistantChatNativeWebSearch({
      requested: true,
      webSearchTools: {} as any,
    }),
    true,
  );

  assert.equal(
    shouldEnableAssistantChatNativeWebSearch({
      requested: true,
      webSearchTools: {
        webSearch: {} as any,
      } as any,
    }),
    false,
  );

  assert.equal(
    shouldEnableAssistantChatNativeWebSearch({
      requested: false,
      webSearchTools: {} as any,
    }),
    false,
  );
});

test("official OpenAI reasoning models request reasoning summaries", () => {
  assert.equal(
    shouldRequestOpenAIReasoningSummary(
      {
        id: "openai",
        baseUrl: "https://api.openai.com/v1",
      },
      "gpt-5.4",
    ),
    true,
  );
  assert.equal(
    shouldRequestOpenAIReasoningSummary(customProvider, "gpt-5.4"),
    false,
  );
  assert.equal(
    shouldRequestOpenAIReasoningSummary(
      {
        id: "openai",
        baseUrl: "https://api.openai.com/v1",
      },
      "gpt-5-chat-latest",
    ),
    false,
  );
});

test("OpenAI-compatible base URLs are normalized to /v1", () => {
  assert.equal(normalizeOpenAIBaseURL("https://api.example.test"), "https://api.example.test/v1");
  assert.equal(normalizeOpenAIBaseURL("https://api.example.test/v1"), "https://api.example.test/v1");
});

test("assistant-ui official modelName config is accepted as model id", () => {
  assert.equal(
    resolveModelId(
      {
        config: {
          modelName: "gpt-5.4-from-model-context",
        },
      },
      customProvider,
    ),
    "gpt-5.4-from-model-context",
  );
});

test("assistant-ui modelName can carry AI SDK registry provider prefix", () => {
  const provider = resolveProviderConfig({
    config: {
      modelName: "plato:gpt-5.4",
    },
    providerConfig: {
      provider: {
        id: "plato",
        name: "Plato",
        baseUrl: "https://api.example.test",
        apiKey: "test-key",
      },
    },
  });

  assert.equal(provider.id, "plato");
  assert.equal(
    resolveModelId(
      {
        config: {
          modelName: "plato:gpt-5.4",
        },
      },
      provider,
    ),
    "gpt-5.4",
  );
});

test("assistant-ui modelName provider prefix wins over legacy providerId", () => {
  const provider = resolveProviderConfig({
    config: {
      modelName: "plato:gpt-5.4",
      providerId: "legacy_provider",
      providerName: "Legacy Provider",
    },
  });

  assert.equal(provider.id, "plato");
  assert.equal(
    resolveModelId(
      {
        config: {
          modelName: "plato:gpt-5.4",
          modelId: "legacy-model",
        },
      },
      provider,
    ),
    "gpt-5.4",
  );
});

test("assistant-ui official modelName config wins over legacy modelId", () => {
  assert.equal(
    resolveModelId(
      {
        config: {
          modelId: "gpt-5.4-legacy",
          modelName: "gpt-5.4-official",
        },
      },
      customProvider,
    ),
    "gpt-5.4-official",
  );
});

test("providerConfig carries project provider details outside assistant-ui config", () => {
  const provider = resolveProviderConfig({
    config: {
      modelName: "gpt-5.4",
      apiKey: "official-config-key",
      baseUrl: "https://official-config.example.test/v1",
    },
    providerConfig: {
      provider: {
        id: "custom_provider",
        name: "Custom Provider",
        baseUrl: "https://provider-config.example.test",
        apiKey: "provider-config-key",
      },
    },
  });

  assert.deepEqual(provider, {
    id: "custom_provider",
    name: "Custom Provider",
    baseUrl: "https://provider-config.example.test",
    apiKey: "provider-config-key",
  });
});

test("legacy provider fields in config remain migration fallback", () => {
  const provider = resolveProviderConfig({
    config: {
      providerId: "legacy_provider",
      providerName: "Legacy Provider",
      baseUrl: "https://legacy-provider.example.test",
      apiKey: "legacy-key",
    },
  });

  assert.deepEqual(provider, {
    id: "legacy_provider",
    name: "Legacy Provider",
    baseUrl: "https://legacy-provider.example.test",
    apiKey: "legacy-key",
  });
});

test("assistant-ui reasoning effort maps to official OpenAI provider options", () => {
  assert.deepEqual(
    buildAssistantChatProviderOptions({
      providerId: "openai",
      isGoogleProvider: false,
      isOfficialOpenAIProvider: true,
      modelId: "gpt-5.4",
      reasoningEffort: "high",
    }),
    {
      openai: {
        reasoningEffort: "high",
        reasoningSummary: "auto",
      },
    },
  );
});

test("assistant-ui official OpenAI reasoning effort drops unsupported none and xhigh", () => {
  assert.deepEqual(
    buildAssistantChatProviderOptions({
      providerId: "openai",
      isGoogleProvider: false,
      isOfficialOpenAIProvider: true,
      modelId: "gpt-5.4",
      reasoningEffort: "none",
    }),
    {
      openai: {
        reasoningSummary: "auto",
      },
    },
  );

  assert.deepEqual(
    buildAssistantChatProviderOptions({
      providerId: "openai",
      isGoogleProvider: false,
      isOfficialOpenAIProvider: true,
      modelId: "gpt-5.4",
      reasoningEffort: "xhigh",
    }),
    {
      openai: {
        reasoningSummary: "auto",
      },
    },
  );

  assert.deepEqual(
    buildAssistantChatProviderOptions({
      providerId: "openai",
      isGoogleProvider: false,
      isOfficialOpenAIProvider: true,
      modelId: "gpt-5.1",
      reasoningEffort: "none",
    }),
    {
      openai: {
        reasoningEffort: "none",
        reasoningSummary: "auto",
      },
    },
  );

  assert.deepEqual(
    buildAssistantChatProviderOptions({
      providerId: "openai",
      isGoogleProvider: false,
      isOfficialOpenAIProvider: true,
      modelId: "gpt-5.1-codex-max",
      reasoningEffort: "xhigh",
    }),
    {
      openai: {
        reasoningEffort: "xhigh",
        reasoningSummary: "auto",
      },
    },
  );
});

test("assistant chat toolChoice only forces tools that are actually registered", () => {
  const tools = {
    createImage: {},
  } as any;

  assert.deepEqual(
    resolveAssistantChatToolChoice(
      { type: "tool", toolName: "createImage" },
      tools,
    ),
    { type: "tool", toolName: "createImage" },
  );
  assert.equal(
    resolveAssistantChatToolChoice(
      { type: "tool", toolName: "missingTool" },
      tools,
    ),
    undefined,
  );
  assert.equal(resolveAssistantChatToolChoice("auto", tools), "auto");
  assert.equal(resolveAssistantChatToolChoice("required", tools), "required");
  assert.equal(resolveAssistantChatToolChoice("required", {} as any), undefined);
});

test("assistant chat keeps required tool choice for custom OpenAI-compatible providers", () => {
  const tools = {
    createImage: {},
  } as any;

  assert.equal(
    resolveAssistantChatEffectiveToolChoice({
      provider: customProvider,
      requestedToolChoice: "required",
      activeTools: ["createImage"],
      tools,
    }),
    "required",
  );
});

test("assistant chat avoids specific tool choice objects for custom OpenAI-compatible providers", () => {
  const tools = {
    createImage: {},
  } as any;

  assert.equal(
    resolveAssistantChatEffectiveToolChoice({
      provider: customProvider,
      requestedToolChoice: {
        type: "tool",
        toolName: "createImage",
      },
      activeTools: ["createImage"],
      tools,
    }),
    "auto",
  );
});

test("assistant chat keeps required tool choice for official OpenAI providers", () => {
  const tools = {
    createImage: {},
  } as any;

  assert.equal(
    resolveAssistantChatEffectiveToolChoice({
      provider: {
        id: "openai",
        name: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "test-key",
      },
      requestedToolChoice: "required",
      activeTools: ["createImage"],
      tools,
    }),
    "required",
  );
});

test("assistant chat activeTools only keeps registered unique tool names", () => {
  const tools = {
    createImage: {},
    searchWeb: {},
  } as any;

  assert.deepEqual(
    sanitizeAssistantChatActiveTools(
      ["createImage", "searchWeb", "createImage", "missingTool", ""],
      tools,
    ),
    ["createImage", "searchWeb"],
  );
  assert.equal(
    sanitizeAssistantChatActiveTools(["missingTool"], tools),
    undefined,
  );
  assert.equal(
    sanitizeAssistantChatActiveTools(undefined, tools),
    undefined,
  );
});

test("assistant chat only enables native OpenAI image generation for safe matching settings", () => {
  const openaiProvider = {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "test-key",
  };
  const enabled = resolveAssistantChatNativeOpenAIImageGeneration({
    chatProvider: openaiProvider,
    imageGeneration: {
      enabled: true,
      provider: openaiProvider,
      modelId: "gpt-image-1",
      aspectRatio: "1:1",
      resolution: "1K",
      count: 1,
    },
    defaultReferenceImageCount: 0,
    explicitImageToolRequested: true,
  });

  assert.equal(enabled.enabled, true);
  assert.equal(enabled.reason, "registered");
  assert.deepEqual(enabled.tool, {
    model: "gpt-image-1",
    outputFormat: "png",
    quality: "auto",
    size: "1024x1024",
  });

  assert.equal(
    resolveAssistantChatNativeOpenAIImageGeneration({
      chatProvider: customProvider,
      imageGeneration: {
        enabled: true,
        provider: openaiProvider,
        modelId: "gpt-image-1",
        aspectRatio: "1:1",
        resolution: "1K",
        count: 1,
      },
      defaultReferenceImageCount: 0,
      explicitImageToolRequested: true,
    }).reason,
    "provider_not_official_openai",
  );
  assert.equal(
    resolveAssistantChatNativeOpenAIImageGeneration({
      chatProvider: openaiProvider,
      imageGeneration: {
        enabled: true,
        provider: openaiProvider,
        modelId: "gpt-image-1",
        aspectRatio: "16:9",
        resolution: "2K",
        count: 1,
      },
      defaultReferenceImageCount: 0,
      explicitImageToolRequested: true,
    }).reason,
    "unsupported_settings",
  );
  assert.equal(
    resolveAssistantChatNativeOpenAIImageGeneration({
      chatProvider: openaiProvider,
      imageGeneration: {
        enabled: true,
        provider: openaiProvider,
        modelId: "gpt-image-1",
        aspectRatio: "1:1",
        resolution: "1K",
        count: 2,
      },
      defaultReferenceImageCount: 0,
      explicitImageToolRequested: true,
    }).reason,
    "unsupported_settings",
  );
  assert.equal(
    resolveAssistantChatNativeOpenAIImageGeneration({
      chatProvider: openaiProvider,
      imageGeneration: {
        enabled: true,
        provider: openaiProvider,
        modelId: "gpt-image-1",
        aspectRatio: "1:1",
        resolution: "1K",
        count: 1,
      },
      defaultReferenceImageCount: 1,
      explicitImageToolRequested: true,
    }).reason,
    "has_reference_images",
  );
});

test("assistant chat maps automatic image active tool to native OpenAI image generation only when enabled", () => {
  assert.deepEqual(
    resolveAssistantChatRequestedActiveTools({
      requestedActiveTools: ["createImage"],
      nativeOpenAIImageGenerationEnabled: true,
    }),
    ["image_generation"],
  );
  assert.deepEqual(
    resolveAssistantChatRequestedActiveTools({
      requestedActiveTools: ["createImage"],
      nativeOpenAIImageGenerationEnabled: false,
    }),
    ["createImage"],
  );
  assert.equal(
    resolveAssistantChatRequestedActiveTools({
      requestedActiveTools: undefined,
      nativeOpenAIImageGenerationEnabled: true,
    }),
    undefined,
  );
});

test("assistant chat treats product detail-page sets as planned multi-image image tool requests", () => {
  const productImageUrl = `data:image/png;base64,${"cHJvZHVjdA==".repeat(12)}`;
  const messages = [
    {
      id: "user-upload-product",
      role: "user",
      parts: [
        {
          type: "text",
          text: "\u8fd9\u662f\u4ea7\u54c1\u56fe",
        },
        {
          type: "file",
          mediaType: "image/png",
          url: productImageUrl,
          filename: "product.png",
        },
      ],
    },
    {
      id: "user-detail-page-set",
      role: "user",
      parts: [
        {
          type: "text",
          text: "\u89c4\u5212\u5e76\u751f\u6210\u4e00\u5957\u591a\u5f20\u56fe\u7684\u8be6\u60c5\u9875\uff0c\u975e\u5355\u5f20",
        },
      ],
    },
  ] as any;

  assert.equal(
    isAssistantChatMultiImageAssetRequest(
      "\u89c4\u5212\u5e76\u751f\u6210\u4e00\u5957\u591a\u5f20\u56fe\u7684\u8be6\u60c5\u9875\uff0c\u975e\u5355\u5f20",
    ),
    true,
  );
  assert.equal(
    resolveAssistantChatRequestedImageCount(
      "\u89c4\u5212\u5e76\u751f\u6210\u4e00\u5957\u591a\u5f20\u56fe\u7684\u8be6\u60c5\u9875\uff0c\u975e\u5355\u5f20",
    ),
    4,
  );
  assert.equal(
    resolveAssistantChatRequestedImageCount(
      "\u751f\u621012\u9875\u7684\u4e2d\u6587\u4ea7\u54c1\u8be6\u60c5\u9875\uff0c\u8981\u72ec\u7acb\u56fe\u7247",
    ),
    12,
  );
  assert.equal(
    resolveAssistantChatRequestedImageCount(
      "\u751f\u6210120\u9875\u7684\u4e2d\u6587\u4ea7\u54c1\u8be6\u60c5\u9875\uff0c\u8981\u72ec\u7acb\u56fe\u7247",
    ),
    120,
  );
  assert.equal(
    resolveAssistantChatRequestedImageCount(
      "\u751f\u6210\u4e8c\u5341\u9875\u4e2d\u6587\u4ea7\u54c1\u8be6\u60c5\u9875",
    ),
    20,
  );
  assert.equal(
    resolveAssistantChatRequestedImageCount(
      "\u751f\u6210\u4e09\u5341\u4e8c\u5f20\u5546\u54c1\u8be6\u60c5\u9875\u56fe",
    ),
    32,
  );
  assert.equal(
    resolveAssistantChatRequestedImageCount(
      "\u751f\u6210\u4e00\u767e\u4e8c\u5341\u5f20\u5546\u54c1\u8be6\u60c5\u9875\u56fe",
    ),
    120,
  );
  assert.equal(
    resolveAssistantChatRequestedImageCount(
      "\u751f\u6210\u4e00\u5343\u96f6\u4e94\u5f20\u5546\u54c1\u8be6\u60c5\u9875\u56fe",
    ),
    1005,
  );
  assert.equal(
    resolveAssistantChatRequestedImageCount(
      "\u751f\u6210\u4e00\u4e07\u5f20\u5546\u54c1\u8be6\u60c5\u9875\u56fe",
    ),
    10000,
  );
  assert.deepEqual(getDefaultImageReferenceUrls(messages), [productImageUrl]);
  assert.deepEqual(
    deriveAssistantChatDirectiveRequestOverrides({}, messages).activeTools,
    ["listStudioSkills", "planStudioWorkflow", "createImage"],
  );
  assert.deepEqual(
    resolveAssistantChatStudioWorkflowPrepareStep({
      studioWorkflowPlanningRequired: true,
      stepNumber: 0,
      steps: [],
      activeTools: ["listStudioSkills", "planStudioWorkflow", "createImage"],
      toolChoice: "auto",
      tools: {
        listStudioSkills: {},
        planStudioWorkflow: {},
        createImage: {},
      } as any,
    }),
    {
      activeTools: ["listStudioSkills", "planStudioWorkflow"],
      toolChoice: "required",
    },
  );
  assert.deepEqual(
    resolveAssistantChatStudioWorkflowPrepareStep({
      studioWorkflowPlanningRequired: true,
      stepNumber: 1,
      steps: [
        {
          toolResults: [
            {
              type: "tool-result",
              toolName: "planStudioWorkflow",
            },
          ],
        },
      ],
      activeTools: ["listStudioSkills", "planStudioWorkflow", "createImage"],
      toolChoice: "auto",
      tools: {
        listStudioSkills: {},
        planStudioWorkflow: {},
        createImage: {},
      } as any,
    }),
    {
      activeTools: ["listStudioSkills", "planStudioWorkflow", "createImage"],
      toolChoice: "auto",
    },
  );

  const systemPrompt = buildAssistantChatSystemPrompt({
    system: undefined,
    imageModeEnabled: false,
    imageToolAvailable: true,
    studioSkillsToolAvailable: true,
    studioWorkflowPlanToolAvailable: true,
    latestUserText:
      "\u89c4\u5212\u5e76\u751f\u6210\u4e00\u5957\u591a\u5f20\u56fe\u7684\u8be6\u60c5\u9875\uff0c\u975e\u5355\u5f20",
  });
  assert.match(systemPrompt || "", /First write a concise user-visible plan/);
  assert.match(systemPrompt || "", /separate images rather than one collage/);
  assert.match(systemPrompt || "", /use listStudioSkills first/);
  assert.match(systemPrompt || "", /call planStudioWorkflow after listStudioSkills/);
});

test("assistant chat restores server tool approval metadata after assistant-ui toolkit conversion", () => {
  const toolkitTools = {
    createImage: {
      description: "Create image.",
      inputSchema: {
        type: "object",
      },
      execute: async () => ({ images: [] }),
    },
    getWeather: {
      description: "Get weather.",
      inputSchema: {
        type: "object",
      },
      execute: async () => ({ temperature: 26 }),
    },
  } as any;
  const serverTools = {
    createImage: {
      needsApproval: true,
    },
    getWeather: {},
  } as any;

  const restored = preserveAssistantChatServerToolApproval(
    toolkitTools,
    serverTools,
  ) as any;

  assert.equal(restored.createImage.needsApproval, true);
  assert.equal(restored.getWeather.needsApproval, undefined);
  assert.notEqual(restored.createImage, toolkitTools.createImage);
  assert.equal(restored.getWeather, toolkitTools.getWeather);
});

test("assistant chat frontend tool sanitization preserves official providerOptions only", () => {
  assert.deepEqual(
    sanitizeAssistantChatFrontendTools({
      createTargetElement: {
        description: " Client tool ",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
        },
        providerOptions: {
          anthropic: {
            deferLoading: true,
          },
        },
      },
      searchWorkspaceKnowledge: {
        description: " Local knowledge search ",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
        },
      },
      clientTool: {
        description: "Unregistered client tool should not be accepted",
        parameters: {
          type: "object",
        },
      },
      legacyTool: {
        description: "Legacy AI SDK tool shape should not be accepted",
        inputSchema: {
          type: "object",
        },
      },
      "image-gen": {
        description: "Old skill tool should not be exposed to assistant-ui",
        parameters: {
          type: "object",
        },
      },
      workspaceSearch: {
        description: "Old workspace search tool should not be exposed",
        parameters: {
          type: "object",
        },
      },
    }),
    {
      createTargetElement: {
        description: "Client tool",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
        },
        providerOptions: {
          anthropic: {
            deferLoading: true,
          },
        },
      },
      searchWorkspaceKnowledge: {
        description: "Local knowledge search",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
        },
      },
    },
  );
});

test("assistant chat extracts latest user image file parts as image references", () => {
  assert.deepEqual(
    getLatestUserImageFilePartUrls([
      {
        id: "user-old",
        role: "user",
        parts: [
          {
            type: "file",
            mediaType: "image/png",
            url: "data:image/png;base64,b2xk",
          },
        ],
      },
      {
        id: "assistant",
        role: "assistant",
        parts: [{ type: "text", text: "ok" }],
      },
      {
        id: "user-latest",
        role: "user",
        parts: [
          { type: "text", text: "Edit this." },
          {
            type: "file",
            mediaType: "image/jpeg",
            url: "data:image/jpeg;base64,bGF0ZXN0",
            filename: "latest.jpg",
          },
          {
            type: "file",
            mediaType: "application/pdf",
            url: "data:application/pdf;base64,cGRm",
          },
        ],
      },
    ] as any),
    ["data:image/jpeg;base64,bGF0ZXN0"],
  );
});

test("assistant chat accepts official assistant-ui image attachment parts as image references", () => {
  const officialImageUrl = "data:image/webp;base64,b2ZmaWNpYWwtaW1hZ2U=";

  const messages = [
    {
      id: "user-official-image",
      role: "user",
      parts: [
        { type: "text", text: "Use this uploaded image." },
        {
          type: "image",
          image: officialImageUrl,
          filename: "official.webp",
        },
      ],
    },
  ] as any;

  assert.deepEqual(getLatestUserImageFilePartUrls(messages), [
    officialImageUrl,
  ]);
  assert.deepEqual(getRecentUserImageReferenceUrls(messages), [
    officialImageUrl,
  ]);
  assert.deepEqual(getRecentImageReferenceUrls(messages), [officialImageUrl]);

  const items = getAssistantChatImageMemoryItems(messages);
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "user-upload");
  assert.equal(items[0].filename, "official.webp");
  assert.equal(items[0].mediaType, "image/webp");
  assert.equal(items[0].referenceAvailable, true);
});

test("assistant chat prefers original canvas and mark image URLs over lightweight previews", () => {
  const previewUrl = "data:image/jpeg;base64,cHJldmlldy1pbWFnZQ==";
  const originalUrl = "https://cdn.example.test/original-product.png";
  const sourceUrl = "https://cdn.example.test/source-product.png";

  const canvasMessages = [
    {
      id: "user-canvas-reference",
      role: "user",
      parts: [
        { type: "text", text: "Use :canvas[image01]{name=canvas-abc} as reference." },
        {
          type: "image",
          image: previewUrl,
          originalUrl,
          canvasImageWidth: 1000,
          canvasImageHeight: 1500,
          filename: "image01-preview.jpg",
        },
      ],
    },
  ] as any;

  assert.deepEqual(getLatestUserImageFilePartUrls(canvasMessages), [
    originalUrl,
  ]);
  assert.deepEqual(getDefaultImageReferenceUrls(canvasMessages), [originalUrl]);
  assert.deepEqual(getLatestUserImageReferenceContexts(canvasMessages), [
    {
      imageUrl: originalUrl,
      imageWidth: 1000,
      imageHeight: 1500,
    },
  ]);

  const markMessages = [
    {
      id: "user-mark-reference",
      role: "user",
      parts: [
        { type: "text", text: "Put a butterfly at :mark[mark01]{name=mark-abc}." },
        {
          type: "image",
          image: previewUrl,
          sourceUrl,
          markerId: "marker-abc",
          markerNormalizedX: 0.42,
          markerNormalizedY: 0.67,
          markerImageWidth: 1200,
          markerImageHeight: 1800,
          filename: "mark01-preview.png",
        },
      ],
    },
  ] as any;

  assert.deepEqual(getLatestUserImageFilePartUrls(markMessages), [sourceUrl]);
  assert.deepEqual(getDefaultImageReferenceUrls(markMessages), [sourceUrl]);
  assert.deepEqual(getLatestUserImageMarkContexts(markMessages), [
    {
      label: "mark01",
      imageUrl: sourceUrl,
      markerId: "marker-abc",
      normalizedX: 0.42,
      normalizedY: 0.67,
      imageWidth: 1200,
      imageHeight: 1800,
    },
  ]);
  assert.deepEqual(getLatestUserImageReferenceContexts(markMessages), [
    {
      imageUrl: sourceUrl,
      imageWidth: 1200,
      imageHeight: 1800,
    },
  ]);
});

test("assistant chat infers uploaded image references from filename when official file MIME is empty", () => {
  const uploadedImageUrl = "https://cdn.example.com/uploaded-reference";

  const messages = [
    {
      id: "user-empty-mime-image",
      role: "user",
      parts: [
        { type: "text", text: "Use this uploaded reference image." },
        {
          type: "file",
          mediaType: "",
          url: uploadedImageUrl,
          filename: "product-reference.webp",
        },
      ],
    },
  ] as any;

  assert.deepEqual(getLatestUserImageFilePartUrls(messages), [
    uploadedImageUrl,
  ]);

  const items = getAssistantChatImageMemoryItems(messages);
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "user-upload");
  assert.equal(items[0].filename, "product-reference.webp");
  assert.equal(items[0].mediaType, "image/webp");
  assert.equal(items[0].referenceAvailable, true);
});

test("assistant chat can use recent generated images as controlled image references", () => {
  const generatedImageUrl = `data:image/png;base64,${"a".repeat(80)}`;
  const messages = [
    {
      id: "user-1",
      role: "user",
      parts: [{ type: "text", text: "生成一张博美" }],
    },
    {
      id: "assistant-1",
      role: "assistant",
      parts: [
        {
          type: "tool-createImage",
          toolCallId: "tool-1",
          state: "output-available",
          input: { prompt: "A pomeranian" },
          output: {
            providerName: "Image Provider",
            modelId: "gpt-image-2",
            images: [
              {
                type: "image",
                image: generatedImageUrl,
                mediaType: "image/png",
                filename: "generated-image-1.png",
              },
            ],
          },
        },
      ],
    },
    {
      id: "user-2",
      role: "user",
      parts: [{ type: "text", text: "把上一张改成赛博朋克风格" }],
    },
  ] as any;

  assert.deepEqual(getRecentGeneratedImageReferenceUrls(messages), [
    generatedImageUrl,
  ]);
  assert.deepEqual(getDefaultImageReferenceUrls(messages), [generatedImageUrl]);
});

test("assistant chat treats official assistant image file parts as generated references", () => {
  const generatedImageUrl = "https://cdn.example.test/assistant-generated.webp";
  const messages = [
    {
      id: "assistant-file-image",
      role: "assistant",
      parts: [
        {
          type: "file",
          mediaType: "image/webp",
          url: generatedImageUrl,
          filename: "assistant-generated.webp",
        },
      ],
    },
    {
      id: "user-edit",
      role: "user",
      parts: [{ type: "text", text: "Edit the previous image into a warmer variant." }],
    },
  ] as any;

  assert.deepEqual(getRecentGeneratedImageReferenceUrls(messages), [
    generatedImageUrl,
  ]);
  assert.deepEqual(getRecentImageReferenceUrls(messages), [generatedImageUrl]);
  assert.deepEqual(getDefaultImageReferenceUrls(messages), [generatedImageUrl]);

  const items = getAssistantChatImageMemoryItems(messages);
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "generated");
  assert.equal(items[0].filename, "assistant-generated.webp");
  assert.equal(items[0].mediaType, "image/webp");
  assert.equal(items[0].referenceAvailable, true);
});

test("assistant chat keeps generated and uploaded images as references for Chinese edit follow-ups", () => {
  const uploadedImageUrl = `data:image/jpeg;base64,${"u".repeat(80)}`;
  const generatedImageUrl = `data:image/png;base64,${"g".repeat(80)}`;
  const messages = [
    {
      id: "user-upload",
      role: "user",
      parts: [
        {
          type: "text",
          text: "\u8fd9\u662f\u539f\u56fe\uff0c\u5148\u6309\u8fd9\u5f20\u751f\u6210\u4e00\u5f20\u56fe",
        },
        {
          type: "file",
          mediaType: "image/jpeg",
          url: uploadedImageUrl,
          filename: "original.jpg",
        },
      ],
    },
    {
      id: "assistant-generated",
      role: "assistant",
      parts: [
        {
          type: "tool-createImage",
          toolCallId: "tool-1",
          state: "output-available",
          output: {
            providerName: "Image Provider",
            modelId: "gpt-image-2",
            images: [
              {
                type: "image",
                image: generatedImageUrl,
                mediaType: "image/png",
                filename: "generated-image-1.png",
              },
            ],
          },
        },
      ],
    },
    {
      id: "user-edit",
      role: "user",
      parts: [
        {
          type: "text",
          text: "\u8fd9\u5f20\u4e0d\u7b26\u5408\u6211\u7684\u9884\u671f\uff0c\u53c2\u8003\u539f\u6765\u56fe\u7247\u7ee7\u7eed\u4fee\u6539",
        },
      ],
    },
  ] as any;

  assert.deepEqual(getDefaultImageReferenceUrls(messages), [
    generatedImageUrl,
    uploadedImageUrl,
  ]);
});

test("assistant chat does not use recent generated images for unrelated new image requests", () => {
  const generatedImageUrl = `data:image/png;base64,${"a".repeat(80)}`;
  assert.deepEqual(
    getDefaultImageReferenceUrls([
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: "tool-createImage",
            toolCallId: "tool-1",
            state: "output-available",
            output: {
              images: [
                {
                  image: generatedImageUrl,
                  mediaType: "image/png",
                },
              ],
            },
          },
        ],
      },
      {
        id: "user-2",
        role: "user",
        parts: [{ type: "text", text: "生成一张全新的猫咪海报" }],
      },
    ] as any),
    [],
  );
});

test("assistant chat can use recent user uploaded images as controlled references", () => {
  const uploadedImageUrl = `data:image/jpeg;base64,${"u".repeat(80)}`;
  const messages = [
    {
      id: "user-1",
      role: "user",
      parts: [
        { type: "text", text: "Here is the product reference." },
        {
          type: "file",
          mediaType: "image/jpeg",
          url: uploadedImageUrl,
          filename: "product.jpg",
        },
      ],
    },
    {
      id: "assistant-1",
      role: "assistant",
      parts: [{ type: "text", text: "I can use it." }],
    },
    {
      id: "user-2",
      role: "user",
      parts: [{ type: "text", text: "Edit the previous image into a poster." }],
    },
  ] as any;

  assert.deepEqual(getRecentUserImageReferenceUrls(messages), [uploadedImageUrl]);
  assert.deepEqual(getRecentImageReferenceUrls(messages), [uploadedImageUrl]);
  assert.deepEqual(getDefaultImageReferenceUrls(messages), [uploadedImageUrl]);
});

test("assistant chat builds text-only image memory without base64 payloads", () => {
  const uploadedImageUrl = `data:image/png;base64,${"a".repeat(80)}`;
  const generatedImageUrl = `data:image/png;base64,${"b".repeat(80)}`;
  const messages = [
    {
      id: "user-upload",
      role: "user",
      parts: [
        {
          type: "file",
          mediaType: "image/png",
          url: uploadedImageUrl,
          filename: "brief.png",
        },
      ],
    },
    {
      id: "assistant-generated",
      role: "assistant",
      parts: [
        {
          type: "tool-createImage",
          toolCallId: "tool-1",
          state: "output-available",
          output: {
            providerName: "Image Provider",
            modelId: "gpt-image-2",
            prompt: "A clean product poster",
            size: "2048x1152",
            aspectRatio: "16:9",
            count: 1,
            images: [{ type: "image", image: generatedImageUrl }],
          },
        },
      ],
    },
    {
      id: "user-latest",
      role: "user",
      parts: [{ type: "text", text: "What images have we used?" }],
    },
  ] as any;

  const items = getAssistantChatImageMemoryItems(messages);
  assert.equal(items.length, 2);
  assert.deepEqual(
    items.map((item) => item.kind),
    ["generated", "user-upload"],
  );

  const context = buildAssistantChatImageMemoryContext(messages);
  assert.match(context, /Thread image memory/);
  assert.match(context, /brief\.png/);
  assert.match(context, /gpt-image-2/);
  assert.match(context, /A clean product poster/);
  assert.doesNotMatch(context, /data:image/);
  assert.doesNotMatch(context, /base64,[ab]+/);

  const injected = injectAssistantImageMemoryContext(
    [
      {
        id: "user-upload",
        role: "user",
        parts: [
          {
            type: "text",
            text: "[Attached image omitted from the language-model prompt.]",
          },
        ],
      },
      {
        id: "user-latest",
        role: "user",
        parts: [{ type: "text", text: "What images have we used?" }],
      },
    ] as any,
    { sourceMessages: messages },
  );

  assert.equal(injected[1].parts[0].type, "text");
  assert.match((injected[1].parts[0] as any).text, /Thread image memory/);
  assert.match((injected[1].parts[1] as any).text, /What images have we used/);
  assert.doesNotMatch(JSON.stringify(injected), /data:image/);
});

test("assistant chat image memory does not impose a default project item cap", () => {
  const messages = Array.from({ length: 32 }, (_, index) => ({
    id: `assistant-generated-${index + 1}`,
    role: "assistant",
    parts: [
      {
        type: "tool-createImage",
        toolCallId: `tool-${index + 1}`,
        state: "output-available",
        output: {
          prompt: `Generated image ${index + 1}`,
          images: [
            {
              type: "image",
              image: `https://example.test/generated-${index + 1}.png`,
              mediaType: "image/png",
            },
          ],
        },
      },
    ],
  })) as any;

  assert.equal(getAssistantChatImageMemoryItems(messages).length, 32);
  assert.equal(
    getAssistantChatImageMemoryItems(messages, { maxItems: 7 }).length,
    7,
  );
});

test("assistant chat preserves latest user image data urls within the model budget", () => {
  const compressedDataUrl = `data:image/png;base64,${"a".repeat(18)}`;
  const result = stripOversizedImageFilePartsForModelMessages(
    [
      {
        id: "user-compressed-image",
        role: "user",
        parts: [
          { type: "text", text: "Use this as a reference." },
          {
            type: "file",
            mediaType: "image/png",
            url: compressedDataUrl,
            filename: "reference.png",
          },
        ],
      },
    ] as any,
    { maxDataUrlChars: 40 },
  );

  assert.equal(result.strippedCount, 0);
  assert.equal(result.strippedChars, 0);
  assert.deepEqual(result.messages[0].parts, [
    { type: "text", text: "Use this as a reference." },
    {
      type: "file",
      mediaType: "image/png",
      url: compressedDataUrl,
      filename: "reference.png",
    },
  ]);
});

test("assistant chat prefers original image URLs over data URL previews for model messages", () => {
  const previewDataUrl = `data:image/png;base64,${"a".repeat(18)}`;
  const originalUrl = "https://cdn.example.test/original-reference.png";
  const result = stripOversizedImageFilePartsForModelMessages(
    [
      {
        id: "user-canvas-preview",
        role: "user",
        parts: [
          { type: "text", text: "Use this canvas image." },
          {
            type: "file",
            mediaType: "image/png",
            url: previewDataUrl,
            originalUrl,
            filename: "reference-preview.png",
          },
        ],
      },
    ] as any,
    { maxDataUrlChars: 40 },
  );

  assert.equal(result.modelImageUrlReplacementCount, 1);
  assert.equal(result.strippedCount, 0);
  assert.deepEqual(result.messages[0].parts, [
    { type: "text", text: "Use this canvas image." },
    {
      type: "file",
      mediaType: "image/png",
      url: originalUrl,
      originalUrl,
      filename: "reference-preview.png",
    },
  ]);
});

test("assistant chat prefers source URLs over official image part previews for model messages", () => {
  const previewDataUrl = `data:image/jpeg;base64,${"b".repeat(18)}`;
  const sourceUrl = "https://cdn.example.test/source-reference.jpg";
  const result = stripOversizedImageFilePartsForModelMessages(
    [
      {
        id: "user-mark-preview",
        role: "user",
        parts: [
          { type: "text", text: "Edit this mark." },
          {
            type: "image",
            image: previewDataUrl,
            sourceUrl,
            mediaType: "image/jpeg",
            filename: "mark-preview.jpg",
          },
        ],
      },
    ] as any,
    { maxDataUrlChars: 40 },
  );

  assert.equal(result.modelImageUrlReplacementCount, 1);
  assert.equal(result.strippedCount, 0);
  assert.deepEqual(result.messages[0].parts, [
    { type: "text", text: "Edit this mark." },
    {
      type: "image",
      image: sourceUrl,
      sourceUrl,
      mediaType: "image/jpeg",
      filename: "mark-preview.jpg",
    },
  ]);
});

test("assistant chat counts but preserves latest oversized image data urls for model messages", () => {
  const largeDataUrl = `data:image/png;base64,${"a".repeat(80)}`;
  const result = stripOversizedImageFilePartsForModelMessages(
    [
      {
        id: "user-large-image",
        role: "user",
        parts: [
          { type: "text", text: "Use this as a reference." },
          {
            type: "file",
            mediaType: "image/png",
            url: largeDataUrl,
            filename: "reference.png",
          },
        ],
      },
    ] as any,
    { maxDataUrlChars: 40 },
  );

  assert.equal(result.strippedCount, 1);
  assert.equal(result.strippedChars, largeDataUrl.length);
  assert.deepEqual(result.messages[0].parts, [
    { type: "text", text: "Use this as a reference." },
    {
      type: "file",
      mediaType: "image/png",
      url: largeDataUrl,
      filename: "reference.png",
    },
  ]);
  assert.doesNotMatch(JSON.stringify(result.messages), /omitted from the language-model prompt/);
});

test("assistant chat counts but preserves historical oversized image data urls for model messages", () => {
  const oldLargeDataUrl = `data:image/png;base64,${"a".repeat(80)}`;
  const latestLargeDataUrl = `data:image/png;base64,${"b".repeat(80)}`;
  const result = stripOversizedImageFilePartsForModelMessages(
    [
      {
        id: "user-old-large-image",
        role: "user",
        parts: [
          { type: "text", text: "Old reference." },
          {
            type: "file",
            mediaType: "image/png",
            url: oldLargeDataUrl,
            filename: "old-reference.png",
          },
        ],
      },
      {
        id: "assistant-between",
        role: "assistant",
        parts: [{ type: "text", text: "ok" }],
      },
      {
        id: "user-latest-large-image",
        role: "user",
        parts: [
          { type: "text", text: "Please inspect this latest image." },
          {
            type: "file",
            mediaType: "image/png",
            url: latestLargeDataUrl,
            filename: "latest-reference.png",
          },
        ],
      },
    ] as any,
    { maxDataUrlChars: 40 },
  );

  assert.equal(result.strippedCount, 2);
  assert.equal(
    result.strippedChars,
    oldLargeDataUrl.length + latestLargeDataUrl.length,
  );
  assert.deepEqual(result.messages[0].parts, [
    { type: "text", text: "Old reference." },
    {
      type: "file",
      mediaType: "image/png",
      url: oldLargeDataUrl,
      filename: "old-reference.png",
    },
  ]);
  assert.deepEqual(result.messages[2].parts, [
    { type: "text", text: "Please inspect this latest image." },
    {
      type: "file",
      mediaType: "image/png",
      url: latestLargeDataUrl,
      filename: "latest-reference.png",
    },
  ]);
  assert.doesNotMatch(JSON.stringify(result.messages), /omitted from the language-model prompt/);
});

test("assistant chat preserves latest user official image parts for vision model messages", () => {
  const compressedDataUrl = `data:image/jpeg;base64,${"a".repeat(16)}`;
  const result = stripOversizedImageFilePartsForModelMessages(
    [
      {
        id: "user-compressed-official-image",
        role: "user",
        parts: [
          { type: "text", text: "Use this official image part." },
          {
            type: "image",
            image: compressedDataUrl,
            filename: "official-reference.jpg",
          },
        ],
      },
    ] as any,
    { maxDataUrlChars: 40 },
  );

  assert.equal(result.strippedCount, 0);
  assert.equal(result.strippedImageFilePartCount, 0);
  assert.deepEqual(result.messages[0].parts, [
    { type: "text", text: "Use this official image part." },
    {
      type: "image",
      image: compressedDataUrl,
      filename: "official-reference.jpg",
    },
  ]);
});

test("assistant chat strips generated image tool binary payloads from language model messages", () => {
  const largeDataUrl = `data:image/png;base64,${"a".repeat(80)}`;
  const largeBase64 = "b".repeat(80);
  const result = stripOversizedImageFilePartsForModelMessages(
    [
      {
        id: "assistant-image-result",
        role: "assistant",
        parts: [
          {
            type: "tool-createImage",
            toolCallId: "tool-1",
            state: "output-available",
            input: {
              prompt: "A small pomeranian",
            },
            output: {
              providerName: "Image Provider",
              modelId: "gpt-image-2",
              prompt: "A small pomeranian",
              images: [
                {
                  type: "image",
                  image: largeDataUrl,
                  data: largeBase64,
                  mediaType: "image/png",
                  filename: "generated-image-1.png",
                },
              ],
            },
          },
        ],
      },
    ] as any,
    { maxDataUrlChars: 40 },
  );

  const part = result.messages[0].parts[0] as any;
  assert.equal(result.strippedImageFilePartCount, 0);
  assert.equal(result.strippedBinaryPayloadCount, 2);
  assert.equal(part.output.images.length, 1);
  assert.equal(
    part.output.images[0].image,
    "[omitted generated image binary data from the language-model prompt]",
  );
  assert.equal(
    part.output.images[0].data,
    "[omitted generated image binary data from the language-model prompt]",
  );
  assert.equal(part.output.providerName, "Image Provider");
  assert.equal(part.output.modelId, "gpt-image-2");
});

test("assistant chat omits unsupported generic file parts from custom provider model messages", () => {
  const result = stripOversizedImageFilePartsForModelMessages(
    [
      {
        id: "user-pdf-custom-provider",
        role: "user",
        parts: [
          { type: "text", text: "Read this file." },
          {
            type: "file",
            mediaType: "application/pdf",
            url: "data:application/pdf;base64,JVBERi0xLjQK",
            filename: "brief.pdf",
          },
        ],
      },
    ] as any,
    {
      provider: customProvider,
      modelId: "gpt-5.4",
    },
  );

  assert.equal(result.strippedUnsupportedFilePartCount, 1);
  assert.deepEqual(result.messages[0].parts, [
    { type: "text", text: "Read this file." },
    {
      type: "text",
      text:
        "[Attached file \"brief.pdf\" (application/pdf) omitted from the language-model prompt " +
        "because the selected provider/model does not support generic AI SDK file parts. " +
        "The official UIMessage file part remains stored in the thread history.]",
    },
  ]);
});

test("assistant chat preserves file parts for official providers that support them", () => {
  const pdfMessage = {
    id: "user-pdf",
    role: "user",
    parts: [
      {
        type: "file",
        mediaType: "application/pdf",
        url: "data:application/pdf;base64,JVBERi0xLjQK",
        filename: "brief.pdf",
      },
    ],
  } as any;
  const audioMessage = {
    id: "user-audio",
    role: "user",
    parts: [
      {
        type: "file",
        mediaType: "audio/mpeg",
        url: "data:audio/mpeg;base64,SUQz",
        filename: "voice.mp3",
      },
    ],
  } as any;

  assert.deepEqual(
    stripOversizedImageFilePartsForModelMessages([pdfMessage], {
      provider: {
        id: "gemini",
        name: "Google",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta",
        apiKey: "test-key",
      },
      modelId: "gemini-2.5-flash",
    }).messages[0].parts,
    pdfMessage.parts,
  );
  assert.deepEqual(
    stripOversizedImageFilePartsForModelMessages([pdfMessage], {
      provider: {
        id: "openai",
        name: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "test-key",
      },
      modelId: "gpt-5",
    }).messages[0].parts,
    pdfMessage.parts,
  );
  assert.deepEqual(
    stripOversizedImageFilePartsForModelMessages([audioMessage], {
      provider: {
        id: "openai",
        name: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "test-key",
      },
      modelId: "gpt-4o-audio-preview",
    }).messages[0].parts,
    audioMessage.parts,
  );
});

test("assistant chat infers supported PDF file parts from filename when uploads use octet-stream", () => {
  const pdfMessage = {
    id: "user-pdf-generic-mime",
    role: "user",
    parts: [
      {
        type: "file",
        mediaType: "application/octet-stream",
        url: "data:application/octet-stream;base64,JVBERi0xLjQK",
        filename: "brief.pdf",
      },
    ],
  } as any;

  assert.deepEqual(
    stripOversizedImageFilePartsForModelMessages([pdfMessage], {
      provider: {
        id: "openai",
        name: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "test-key",
      },
      modelId: "gpt-5",
    }).messages[0].parts,
    pdfMessage.parts,
  );
});

test("assistant chat prunes historical reasoning and old tool calls with AI SDK pruneMessages", () => {
  const pruned = pruneAssistantChatModelMessagesForContext([
    {
      role: "user",
      content: [{ type: "text", text: "old request" }],
    },
    {
      role: "assistant",
      content: [
        { type: "reasoning", text: "old reasoning" },
        {
          type: "tool-call",
          toolCallId: "old-tool",
          toolName: "createImage",
          input: { prompt: "old image" },
        },
      ],
    },
    {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: "old-tool",
          toolName: "createImage",
          output: { images: [{ url: "https://example.test/old.png" }] },
        },
      ],
    },
    {
      role: "user",
      content: [{ type: "text", text: "latest request" }],
    },
    {
      role: "assistant",
      content: [
        { type: "reasoning", text: "latest reasoning" },
        {
          type: "tool-call",
          toolCallId: "latest-tool",
          toolName: "getWeather",
          input: { query: "Shanghai" },
        },
      ],
    },
    {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: "latest-tool",
          toolName: "getWeather",
          output: { temperature: 28 },
        },
      ],
    },
  ] as any);

  assert.deepEqual(
    pruned.flatMap((message: any) =>
      Array.isArray(message.content)
        ? message.content.map((part: any) => part.type)
        : [],
    ),
    ["text", "text", "tool-call", "tool-result"],
  );
  assert.equal(JSON.stringify(pruned).includes("old-tool"), false);
  assert.equal(JSON.stringify(pruned).includes("latest-tool"), true);
  assert.equal(JSON.stringify(pruned).includes("old reasoning"), false);
  assert.equal(JSON.stringify(pruned).includes("latest reasoning"), false);
});

test("assistant-ui directive mentions are extracted from the latest user message only", () => {
  assert.deepEqual(
    extractAssistantChatLatestUserDirectiveMentions([
      {
        id: "user-old",
        role: "user",
        parts: [
          {
            type: "text",
            text: ":context[Web search]{name=web-search}",
          },
        ],
      },
      {
        id: "assistant-1",
        role: "assistant",
        parts: [{ type: "text", text: "Older reply" }],
      },
      {
        id: "user-latest",
        role: "user",
        parts: [
          {
            type: "text",
            text:
              "Help me with this :context[Weather]{name=weather} and :tool[Search]{name=searchWeb}",
          },
        ],
      },
    ] as any),
    [
      {
        type: "context",
        id: "weather",
        label: "Weather",
      },
      {
        type: "tool",
        id: "searchWeb",
        label: "Search",
      },
    ],
  );
});

test("assistant-ui weather directive upgrades weather config and tool choice when no explicit tool selection exists", () => {
  assert.deepEqual(
    deriveAssistantChatDirectiveRequestOverrides(
      {
        webSearch: {
          enabled: false,
        },
        weather: undefined,
        activeTools: undefined,
        toolChoice: "auto",
      },
      [
        {
          id: "user-1",
          role: "user",
          parts: [
            {
              type: "text",
              text: ":context[Weather]{name=weather} Shanghai today",
            },
          ],
        },
      ] as any,
    ),
    {
      directiveMentions: [
        {
          type: "context",
          id: "weather",
          label: "Weather",
        },
      ],
      explicitWebSearchRequested: false,
      explicitWeatherRequested: true,
      explicitImageGenerationRequested: false,
      webSearch: {
        enabled: false,
      },
      weather: {
        enabled: true,
      },
      activeTools: ["getWeather"],
      toolChoice: {
        type: "tool",
        toolName: "getWeather",
      },
    },
  );
});

test("assistant-ui web directive enables web search without overriding explicit active tool selection", () => {
  assert.deepEqual(
    deriveAssistantChatDirectiveRequestOverrides(
      {
        webSearch: undefined,
        weather: undefined,
        activeTools: ["createImage"],
        toolChoice: {
          type: "tool",
          toolName: "createImage",
        },
      },
      [
        {
          id: "user-1",
          role: "user",
          parts: [
            {
              type: "text",
              text:
                ":context[Web search]{name=web-search} :context[Weather]{name=weather}",
            },
          ],
        },
      ] as any,
    ),
    {
      directiveMentions: [
        {
          type: "context",
          id: "web-search",
          label: "Web search",
        },
        {
          type: "context",
          id: "weather",
          label: "Weather",
        },
      ],
      explicitWebSearchRequested: true,
      explicitWeatherRequested: true,
      explicitImageGenerationRequested: false,
      webSearch: {
        enabled: true,
      },
      weather: {
        enabled: true,
      },
      activeTools: ["createImage"],
      toolChoice: {
        type: "tool",
        toolName: "createImage",
      },
    },
  );
});

test("assistant-ui tool mentions can enable native tool families", () => {
  assert.deepEqual(
    deriveAssistantChatDirectiveRequestOverrides(
      {
        webSearch: undefined,
        weather: undefined,
        imageGeneration: undefined,
        activeTools: undefined,
        toolChoice: "auto",
      },
      [
        {
          id: "user-1",
          role: "user",
          parts: [
            {
              type: "text",
              text:
                ":tool[Web search]{name=webSearch} :tool[Image]{name=createImage} help me compare directions",
            },
          ],
        },
      ] as any,
    ),
    {
      directiveMentions: [
        {
          type: "tool",
          id: "webSearch",
          label: "Web search",
        },
        {
          type: "tool",
          id: "createImage",
          label: "Image",
        },
      ],
      explicitWebSearchRequested: true,
      explicitWeatherRequested: false,
      explicitImageGenerationRequested: false,
      webSearch: {
        enabled: true,
      },
      weather: undefined,
      activeTools: ["createImage"],
      toolChoice: "auto",
    },
  );
});

test("assistant-ui image tool mention does not force image generation by itself", () => {
  assert.deepEqual(
    deriveAssistantChatDirectiveRequestOverrides(
      {
        webSearch: undefined,
        weather: undefined,
        imageGeneration: undefined,
        activeTools: undefined,
        toolChoice: "auto",
      },
      [
        {
          id: "user-1",
          role: "user",
          parts: [
            {
              type: "text",
              text: ":tool[Image]{name=createImage} let's discuss the art direction first",
            },
          ],
        },
      ] as any,
    ),
    {
      directiveMentions: [
        {
          type: "tool",
          id: "createImage",
          label: "Image",
        },
      ],
      explicitWebSearchRequested: false,
      explicitWeatherRequested: false,
      explicitImageGenerationRequested: false,
      webSearch: undefined,
      weather: undefined,
      activeTools: ["createImage"],
      toolChoice: "auto",
    },
  );
});

test("assistant chat recognizes explicit image generation requests", () => {
  assert.equal(
    isExplicitAssistantChatImageGenerationRequest("帮我生成一张圣诞节产品海报"),
    true,
  );
  assert.equal(
    isExplicitAssistantChatImageGenerationRequest("Create a 16:9 product poster"),
    true,
  );
  assert.equal(
    isExplicitAssistantChatImageGenerationRequest("我们先聊聊这张图的构图方向"),
    false,
  );
});

test("assistant image mode limits active tools without forcing image generation while chatting", () => {
  assert.deepEqual(
    deriveAssistantChatDirectiveRequestOverrides(
      {
        webSearch: undefined,
        weather: undefined,
        imageGeneration: {
          enabled: true,
          enforceSettings: true,
        },
        activeTools: undefined,
        toolChoice: "auto",
      },
      [
        {
          id: "user-1",
          role: "user",
          parts: [
            {
              type: "text",
              text: "我们先聊聊这张图的构图方向",
            },
          ],
        },
      ] as any,
    ),
    {
      directiveMentions: [],
      explicitWebSearchRequested: false,
      explicitWeatherRequested: false,
      explicitImageGenerationRequested: false,
      webSearch: undefined,
      weather: undefined,
      activeTools: ["createImage"],
      toolChoice: "auto",
    },
  );
});

test("assistant image mode narrows tools without forcing createImage for explicit generation requests", () => {
  assert.deepEqual(
    deriveAssistantChatDirectiveRequestOverrides(
      {
        webSearch: undefined,
        weather: undefined,
        imageGeneration: {
          enabled: true,
          enforceSettings: true,
        },
        activeTools: undefined,
        toolChoice: "auto",
      },
      [
        {
          id: "user-1",
          role: "user",
          parts: [
            {
              type: "text",
              text: "帮我生成一张圣诞节产品海报",
            },
          ],
        },
      ] as any,
    ),
    {
      directiveMentions: [],
      explicitWebSearchRequested: false,
      explicitWeatherRequested: false,
      explicitImageGenerationRequested: true,
      webSearch: undefined,
      weather: undefined,
      activeTools: ["createImage"],
      toolChoice: "auto",
    },
  );
});

test("assistant explicit image generation requests narrow tools without forcing createImage without image mode", () => {
  assert.deepEqual(
    deriveAssistantChatDirectiveRequestOverrides(
      {
        webSearch: undefined,
        weather: undefined,
        imageGeneration: {
          enabled: true,
          enforceSettings: false,
        },
        activeTools: undefined,
        toolChoice: "auto",
      },
      [
        {
          id: "user-1",
          role: "user",
          parts: [
            {
              type: "text",
              text: "Create a 16:9 product poster for a skincare launch",
            },
          ],
        },
      ] as any,
    ),
    {
      directiveMentions: [],
      explicitWebSearchRequested: false,
      explicitWeatherRequested: false,
      explicitImageGenerationRequested: true,
      webSearch: undefined,
      weather: undefined,
      activeTools: ["createImage"],
      toolChoice: "auto",
    },
  );
});

test("assistant-ui reasoning effort maps to Gemini 3 thinking level", () => {
  assert.deepEqual(
    buildAssistantChatProviderOptions({
      providerId: "gemini",
      isGoogleProvider: true,
      isOfficialOpenAIProvider: false,
      modelId: "gemini-3.1-pro-preview",
      reasoningEffort: "medium",
    }),
    {
      google: {
        thinkingConfig: {
          thinkingLevel: "medium",
          includeThoughts: true,
        },
      },
    },
  );
});

test("assistant-ui reasoning effort keeps Gemini 2.5 thoughts without invalid thinking level", () => {
  assert.deepEqual(
    buildAssistantChatProviderOptions({
      providerId: "gemini",
      isGoogleProvider: true,
      isOfficialOpenAIProvider: false,
      modelId: "gemini-2.5-pro",
      reasoningEffort: "high",
    }),
    {
      google: {
        thinkingConfig: {
          includeThoughts: true,
        },
      },
    },
  );
});

test("assistant-ui reasoning effort maps to OpenAI-compatible provider options", () => {
  assert.deepEqual(
    buildAssistantChatProviderOptions({
      providerId: "custom-openai",
      isGoogleProvider: false,
      isOfficialOpenAIProvider: false,
      modelId: "gpt-5.4",
      reasoningEffort: "low",
    }),
    {
      openaiCompatible: {
        reasoningEffort: "low",
      },
      customOpenai: {
        reasoningEffort: "low",
      },
    },
  );
});

test("assistant-ui OpenAI-compatible reasoning effort preserves provider-specific none and xhigh", () => {
  assert.deepEqual(
    buildAssistantChatProviderOptions({
      providerId: "custom-openai",
      isGoogleProvider: false,
      isOfficialOpenAIProvider: false,
      modelId: "gpt-5.4",
      reasoningEffort: "none",
    }),
    {
      openaiCompatible: {
        reasoningEffort: "none",
      },
      customOpenai: {
        reasoningEffort: "none",
      },
    },
  );

  assert.deepEqual(
    buildAssistantChatProviderOptions({
      providerId: "custom-openai",
      isGoogleProvider: false,
      isOfficialOpenAIProvider: false,
      modelId: "gpt-5.4",
      reasoningEffort: "xhigh",
    }),
    {
      openaiCompatible: {
        reasoningEffort: "xhigh",
      },
      customOpenai: {
        reasoningEffort: "xhigh",
      },
    },
  );
});

test("assistant chat web search sources extract canonical url/title pairs", () => {
  assert.deepEqual(
    extractAssistantChatWebSearchSources({
      citations: [
        {
          title: "Primary citation",
          url: "https://example.com/one",
        },
      ],
      sources: [
        {
          title: "Duplicate source",
          url: "https://example.com/one",
        },
        {
          name: "Source fallback title",
          url: "https://example.com/two",
        },
      ],
      results: [
        {
          title: "Result title",
          link: "https://example.com/three",
        },
      ],
    }),
    [
      {
        title: "Primary citation",
        url: "https://example.com/one",
      },
      {
        title: "Source fallback title",
        url: "https://example.com/two",
      },
      {
        title: "Result title",
        url: "https://example.com/three",
      },
    ],
  );
});

test("assistant-ui call settings map to AI SDK v6 call settings", () => {
  assert.deepEqual(
    buildAssistantChatCallSettings({
      maxTokens: 1200,
      temperature: 0.4,
      topP: 0.9,
      presencePenalty: 0.1,
      frequencyPenalty: 0.2,
      seed: 42,
      headers: {
        "x-test": "ok",
      },
    }),
    {
      maxOutputTokens: 1200,
      temperature: 0.4,
      topP: 0.9,
      presencePenalty: 0.1,
      frequencyPenalty: 0.2,
      seed: 42,
      headers: {
        "x-test": "ok",
      },
    },
  );
});
