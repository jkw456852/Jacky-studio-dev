import test from "node:test";
import assert from "node:assert/strict";
import { convertToModelMessages } from "ai";

import { createAssistantChatImageTools } from "./assistant-chat-image-tools.ts";
import { resolveOpenAIImageSize } from "../image-generation/core/openai-image-spec.ts";

const createGeneratedImageResult = (base64 = "aW1hZ2U=") =>
  ({
    image: {
      mediaType: "image/png",
      base64,
      uint8Array: new Uint8Array(),
    },
    images: [
      {
        mediaType: "image/png",
        base64,
        uint8Array: new Uint8Array(),
      },
    ],
    warnings: [],
    responses: [],
    providerMetadata: {},
    usage: {
      inputTokens: undefined,
      outputTokens: undefined,
      totalTokens: undefined,
    },
  }) as any;

test("assistant chat image tools stay empty when disabled", () => {
  const result = createAssistantChatImageTools({
    enabled: false,
    provider: {
      id: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "test-key",
    },
    modelId: "gpt-image-1",
  });

  assert.equal(result.reason, "disabled");
  assert.deepEqual(Object.keys(result.tools), []);
});

test("assistant chat image tools require an API key", () => {
  const result = createAssistantChatImageTools({
    enabled: true,
    provider: {
      id: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "",
    },
    modelId: "gpt-image-1",
  });

  assert.equal(result.reason, "missing_api_key");
  assert.deepEqual(Object.keys(result.tools), []);
});

test("assistant chat image tools register OpenAI-compatible AI SDK createImage tool", async () => {
  let capturedOptions: any = null;
  const result = createAssistantChatImageTools(
    {
      enabled: true,
      provider: {
        id: "plato",
        name: "Plato",
        baseUrl: "https://api.example.test",
        apiKey: "test-key",
      },
      modelId: "GPT Image 2",
      aspectRatio: "3:4",
      resolution: "1K",
      count: 2,
    },
    {
      generateImageFn: async (options: any) => {
        capturedOptions = options;
        return createGeneratedImageResult();
      },
    },
  );

  assert.equal(result.reason, "registered");
  assert.equal(result.providerId, "plato");
  assert.equal(result.modelId, "gpt-image-2");
  assert.deepEqual(Object.keys(result.tools), ["createImage", "upscaleImage"]);

  const abortController = new AbortController();
  const output = await (result.tools.createImage as any).execute(
    {
      prompt: "Create a premium product poster",
      referenceImages: ["data:image/png;base64,cmVm"],
      count: 3,
    },
    { abortSignal: abortController.signal },
  );

  assert.equal(capturedOptions.model.provider, "plato.image");
  assert.equal(capturedOptions.model.modelId, "gpt-image-2");
  assert.equal(capturedOptions.n, 3);
  assert.equal(capturedOptions.maxRetries, 0);
  assert.equal(capturedOptions.abortSignal, abortController.signal);
  assert.equal("maxImagesPerCall" in capturedOptions, false);
  assert.equal(capturedOptions.size, "768x1024");
  assert.deepEqual(capturedOptions.prompt, {
    text: "Create a premium product poster",
    images: ["data:image/png;base64,cmVm"],
  });
  assert.equal(output.images[0].type, "image");
  assert.equal(output.images[0].image, "data:image/png;base64,aW1hZ2U=");
  assert.equal(output.images[0].filename, "generated-image-1.png");
  assert.equal(output.images[0].mediaType, "image/png");
  assert.equal("data" in output.images[0], false);

  const modelOutput = await (result.tools.createImage as any).toModelOutput({
    output,
  });
  assert.deepEqual(modelOutput, {
    type: "content",
    value: [
      {
        type: "text",
        text:
          "Generated 1 image. Provider: Plato. Model: gpt-image-2. " +
          "Size: 768x1024. Aspect ratio: 3:4. Resolution: 1K. " +
          "Images were returned to the UI as tool output and remain available to future createImage calls as references; " +
          "image bytes are intentionally not included in the language-model tool result. " +
          "Prompt: Create a premium product poster",
      },
    ],
  });
});

test("assistant chat image tools can require official AI SDK approval before generation", () => {
  const result = createAssistantChatImageTools({
    enabled: true,
    provider: {
      id: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "test-key",
    },
    modelId: "gpt-image-1",
    requiresApproval: true,
  });

  assert.equal((result.tools.createImage as any).needsApproval, true);
});

test("assistant chat image tools use official conditional approval for risky image generation", async () => {
  const result = createAssistantChatImageTools({
    enabled: true,
    provider: {
      id: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "test-key",
    },
    modelId: "gpt-image-1",
  });
  const needsApproval = (result.tools.createImage as any).needsApproval;

  assert.equal(typeof needsApproval, "function");
  assert.equal(await needsApproval({ prompt: "Create one simple icon" }, {}), false);
  assert.equal(
    await needsApproval(
      {
        prompt: "Create separate product detail page images",
        count: 4,
      },
      {},
    ),
    true,
  );
  assert.equal(
    await needsApproval(
      {
        prompt: "Edit this product photo",
        images: ["data:image/png;base64,cmVm"],
      },
      {},
    ),
    true,
  );
});

test("assistant chat image tools require official approval for default product references", async () => {
  const result = createAssistantChatImageTools({
    enabled: true,
    provider: {
      id: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "test-key",
    },
    modelId: "gpt-image-1",
    referenceImages: ["data:image/png;base64,cHJvZHVjdA=="],
  });
  const needsApproval = (result.tools.createImage as any).needsApproval;

  assert.equal(typeof needsApproval, "function");
  assert.equal(
    await needsApproval({ prompt: "Create one product poster" }, {}),
    true,
  );
});

test("assistant chat image tools hit the selected OpenAI-compatible image endpoint with the selected model", async () => {
  const originalFetch = globalThis.fetch;
  let capturedRequest:
    | {
        url: string;
        method: string;
        bodyText: string;
      }
    | null = null;

  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;
    const bodyText =
      typeof init?.body === "string"
        ? init.body
        : init?.body instanceof Uint8Array
        ? Buffer.from(init.body).toString("utf8")
        : "";
    capturedRequest = {
      url,
      method: init?.method || "GET",
      bodyText,
    };

    return new Response(JSON.stringify({ data: [{ b64_json: "aW1hZ2U=" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = createAssistantChatImageTools({
      enabled: true,
      provider: {
        id: "custom_1777104578189",
        name: "Selected Image Provider",
        baseUrl: "https://example-image-proxy.test",
        apiKey: "test-key",
      },
      modelId: "gpt-image-2",
      aspectRatio: "16:9",
      resolution: "2K",
      count: 1,
      enforceSettings: true,
    });

    await (result.tools.createImage as any).execute({
      prompt: "Create a cinematic banner",
    });

    assert.deepEqual(capturedRequest, {
      url: "https://example-image-proxy.test/v1/images/generations",
      method: "POST",
      bodyText:
        '{"model":"gpt-image-2","prompt":"Create a cinematic banner","n":1,"size":"2048x1152","response_format":"b64_json"}',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("assistant chat image tools lock ratio, resolution, and count to the image panel when requested", async () => {
  let capturedOptions: any = null;
  const result = createAssistantChatImageTools(
    {
      enabled: true,
      provider: {
        id: "plato",
        name: "Plato",
        baseUrl: "https://api.example.test",
        apiKey: "test-key",
      },
      modelId: "gpt-image-2",
      aspectRatio: "16:9",
      resolution: "2K",
      count: 1,
      enforceSettings: true,
    },
    {
      generateImageFn: async (options: any) => {
        capturedOptions = options;
        return createGeneratedImageResult("bG9ja2VkLXNldHRpbmdz");
      },
    },
  );

  const output = await (result.tools.createImage as any).execute({
    prompt: "Create a wide hero banner",
    aspectRatio: "3:4",
    size: "1024x1024",
    count: 4,
  });

  assert.equal(
    capturedOptions.size,
    resolveOpenAIImageSize("gpt-image-2", "16:9", "2K"),
  );
  assert.equal(capturedOptions.aspectRatio, undefined);
  assert.equal(capturedOptions.n, 1);
  assert.equal(capturedOptions.maxRetries, 0);
  assert.equal(output.providerName, "Plato");
  assert.equal(output.aspectRatio, "16:9");
  assert.equal(output.resolution, "2K");
  assert.equal(output.count, 1);
  assert.equal(output.settingsLocked, true);
});

test("assistant chat image tools fall back to text generation when an OpenAI-compatible edit rejects references", async () => {
  const capturedOptions: any[] = [];
  const result = createAssistantChatImageTools(
    {
      enabled: true,
      provider: {
        id: "plato",
        name: "Plato",
        baseUrl: "https://api.example.test",
        apiKey: "test-key",
      },
      modelId: "gpt-image-2",
      aspectRatio: "9:16",
      resolution: "1K",
      count: 1,
      referenceImages: ["data:image/png;base64,cmVm"],
      enforceSettings: true,
    },
    {
      generateImageFn: async (options: any) => {
        capturedOptions.push(options);
        if (typeof options.prompt !== "string") {
          throw new Error("Invalid image file or mode for image 1");
        }
        return createGeneratedImageResult("ZmFsbGJhY2s=");
      },
    },
  );

  const output = await (result.tools.createImage as any).execute({
    prompt: "Create a vertical product poster",
  });

  assert.equal(capturedOptions.length, 2);
  assert.deepEqual(capturedOptions[0].prompt.images, [
    "data:image/png;base64,cmVm",
  ]);
  assert.equal(capturedOptions[1].prompt, "Create a vertical product poster");
  assert.equal(output.images.length, 1);
  assert.equal(output.images[0].image, "data:image/png;base64,ZmFsbGJhY2s=");
  assert.equal("data" in output.images[0], false);
  assert.equal(output.referenceCount, 0);
  assert.match(
    output.warnings.at(-1),
    /reference image input.*text prompt only/i,
  );
});

test("assistant chat image tools ignore transient blob reference URLs", async () => {
  let capturedOptions: any = null;
  const result = createAssistantChatImageTools(
    {
      enabled: true,
      provider: {
        id: "plato",
        name: "Plato",
        baseUrl: "https://api.example.test",
        apiKey: "test-key",
      },
      modelId: "gpt-image-2",
      aspectRatio: "1:1",
      resolution: "1K",
      count: 1,
      referenceImages: ["blob:http://localhost:3001/not-server-readable"],
    },
    {
      generateImageFn: async (options: any) => {
        capturedOptions = options;
        return createGeneratedImageResult("dGV4dC1vbmx5");
      },
    },
  );

  const output = await (result.tools.createImage as any).execute({
    prompt: "Create a product poster",
  });

  assert.equal(capturedOptions.prompt, "Create a product poster");
  assert.equal(output.referenceCount, 0);
  assert.equal(output.images[0].image, "data:image/png;base64,dGV4dC1vbmx5");
  assert.equal("data" in output.images[0], false);
});

test("assistant chat image tool history remains model-visible as lightweight image memory", async () => {
  const result = createAssistantChatImageTools({
    enabled: true,
    provider: {
      id: "plato",
      name: "Plato",
      baseUrl: "https://api.example.test",
      apiKey: "test-key",
    },
    modelId: "gpt-image-1",
    aspectRatio: "1:1",
    resolution: "1K",
    count: 1,
  });

  const modelMessages = await convertToModelMessages(
    [
      {
        id: "assistant-generated-image",
        role: "assistant",
        parts: [
          {
            type: "tool-createImage",
            toolCallId: "tool-call-create-image-1",
            state: "output-available",
            input: {
              prompt: "Generate a clean product poster",
            },
            output: {
              providerId: "plato",
              modelId: "gpt-image-1",
              prompt: "Generate a clean product poster",
              referenceCount: 0,
              images: [
                {
                  type: "image",
                  image: "data:image/png;base64,cHJldmlvdXMgaW1hZ2U=",
                  filename: "generated-image-1.png",
                  mediaType: "image/png",
                  data: "cHJldmlvdXMgaW1hZ2U=",
                },
              ],
              warnings: [],
              usage: {},
            },
          },
        ],
      },
      {
        id: "user-follow-up",
        role: "user",
        parts: [{ type: "text", text: "Make the previous image warmer." }],
      },
    ] as any,
    {
      tools: result.tools,
    },
  );

  assert.deepEqual(modelMessages[1], {
    role: "tool",
    content: [
      {
        type: "tool-result",
        toolCallId: "tool-call-create-image-1",
        toolName: "createImage",
        output: {
          type: "content",
          value: [
            {
              type: "text",
              text:
                "Generated 1 image. Provider: plato. Model: gpt-image-1. " +
                "Images were returned to the UI as tool output and remain available to future createImage calls as references; " +
                "image bytes are intentionally not included in the language-model tool result. " +
                "Prompt: Generate a clean product poster",
            },
          ],
        },
      },
    ],
  });
});

test("assistant chat image tools use latest user image file parts as fallback references", async () => {
  let capturedOptions: any = null;
  const result = createAssistantChatImageTools(
    {
      enabled: true,
      provider: {
        id: "plato",
        name: "Plato",
        baseUrl: "https://api.example.test",
        apiKey: "test-key",
      },
      modelId: "gpt-image-1",
      aspectRatio: "1:1",
      resolution: "1K",
      count: 1,
      referenceImages: [
        "data:image/png;base64,ZmFsbGJhY2stcmVmZXJlbmNl",
      ],
    },
    {
      generateImageFn: async (options: any) => {
        capturedOptions = options;
        return createGeneratedImageResult("ZmFsbGJhY2stb3V0cHV0");
      },
    },
  );

  const output = await (result.tools.createImage as any).execute({
    prompt: "Edit the attached reference image",
  });

  assert.deepEqual(capturedOptions.prompt, {
    text: "Edit the attached reference image",
    images: ["data:image/png;base64,ZmFsbGJhY2stcmVmZXJlbmNl"],
  });
  assert.equal(output.referenceCount, 1);
});

test("assistant chat image tools prefer official AI SDK image edit fields", async () => {
  let capturedOptions: any = null;
  const result = createAssistantChatImageTools(
    {
      enabled: true,
      provider: {
        id: "openai",
        name: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "test-key",
      },
      modelId: "gpt-image-1",
      aspectRatio: "1:1",
      resolution: "1K",
      count: 1,
    },
    {
      generateImageFn: async (options: any) => {
        capturedOptions = options;
        return createGeneratedImageResult("b2ZmaWNpYWw=");
      },
    },
  );

  const manyImages = Array.from(
    { length: 18 },
    (_, index) => `https://example.test/ref-${index + 1}.png`,
  );

  const output = await (result.tools.createImage as any).execute({
    prompt: "legacy fallback prompt",
    text: "Use these references to create a cohesive campaign key visual",
    images: manyImages,
    referenceImages: ["https://example.test/legacy-extra.png"],
    mask: "data:image/png;base64,bWFzaw==",
    maskImage: "data:image/png;base64,bGVnYWN5LW1hc2s=",
  });

  assert.equal(capturedOptions.prompt.text, "Use these references to create a cohesive campaign key visual");
  assert.deepEqual(capturedOptions.prompt.images, [
    ...manyImages,
    "https://example.test/legacy-extra.png",
  ]);
  assert.equal(capturedOptions.prompt.mask, "data:image/png;base64,bWFzaw==");
  assert.equal(output.referenceCount, 19);
  assert.equal(output.prompt, "Use these references to create a cohesive campaign key visual");
});

test("assistant chat image tools inject canvas mark contexts into createImage prompts", async () => {
  let capturedOptions: any = null;
  const markImageUrl = "https://cdn.example.test/source-product.png";
  const result = createAssistantChatImageTools(
    {
      enabled: true,
      provider: {
        id: "openai",
        name: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "test-key",
      },
      modelId: "gpt-image-1",
      aspectRatio: "1:1",
      resolution: "1K",
      count: 1,
      markContexts: [
        {
          label: "mark01",
          imageUrl: markImageUrl,
          markerId: "marker-abc",
          normalizedX: 0.42,
          normalizedY: 0.67,
          imageWidth: 1200,
          imageHeight: 1800,
        },
      ],
    },
    {
      generateImageFn: async (options: any) => {
        capturedOptions = options;
        return createGeneratedImageResult("bWFyay1lZGl0");
      },
    },
  );

  const output = await (result.tools.createImage as any).execute({
    prompt: "Add a butterfly at mark01.",
  });

  assert.deepEqual(capturedOptions.prompt.images, [markImageUrl]);
  assert.match(capturedOptions.prompt.text, /Add a butterfly at mark01\./);
  assert.match(capturedOptions.prompt.text, /Canvas mark contexts for image tool/);
  assert.match(capturedOptions.prompt.text, /mark01: exact user-selected canvas mark/);
  assert.match(capturedOptions.prompt.text, /x=0\.4200/);
  assert.match(capturedOptions.prompt.text, /y=0\.6700/);
  assert.match(capturedOptions.prompt.text, /source image size 1200x1800px/);
  assert.match(capturedOptions.prompt.text, /markerId marker-abc/);
  assert.equal(output.referenceCount, 1);
  assert.match(output.prompt, /Canvas mark contexts for image tool/);
});

test("assistant chat image tools inherit unlocked canvas reference aspect ratio", async () => {
  let capturedOptions: any = null;
  const referenceImageUrl = "https://cdn.example.test/portrait-product.png";
  const result = createAssistantChatImageTools(
    {
      enabled: true,
      provider: {
        id: "plato",
        name: "Plato",
        baseUrl: "https://api.example.test",
        apiKey: "test-key",
      },
      modelId: "gpt-image-2",
      aspectRatio: "1:1",
      resolution: "1K",
      count: 1,
      referenceImages: [referenceImageUrl],
      referenceImageContexts: [
        {
          imageUrl: referenceImageUrl,
          imageWidth: 1000,
          imageHeight: 1500,
        },
      ],
      enforceSettings: false,
    },
    {
      generateImageFn: async (options: any) => {
        capturedOptions = options;
        return createGeneratedImageResult("cG9ydHJhaXQ=");
      },
    },
  );

  const output = await (result.tools.createImage as any).execute({
    prompt: "Edit this product image into a more premium background",
  });

  assert.equal(
    capturedOptions.size,
    resolveOpenAIImageSize("gpt-image-2", "2:3", "1K"),
  );
  assert.equal(capturedOptions.aspectRatio, undefined);
  assert.deepEqual(capturedOptions.prompt, {
    text: "Edit this product image into a more premium background",
    images: [referenceImageUrl],
  });
  assert.equal(output.aspectRatio, "2:3");
  assert.equal(output.size, "1024x1536");
  assert.equal(output.settingsLocked, false);
});

test("assistant chat image tools inherit unlocked mark reference aspect ratio", async () => {
  let capturedOptions: any = null;
  const markImageUrl = "https://cdn.example.test/marked-product.png";
  const result = createAssistantChatImageTools(
    {
      enabled: true,
      provider: {
        id: "plato",
        name: "Plato",
        baseUrl: "https://api.example.test",
        apiKey: "test-key",
      },
      modelId: "gpt-image-2",
      aspectRatio: "1:1",
      resolution: "1K",
      count: 1,
      markContexts: [
        {
          label: "mark01",
          imageUrl: markImageUrl,
          normalizedX: 0.5,
          normalizedY: 0.4,
          imageWidth: 1080,
          imageHeight: 1920,
        },
      ],
      enforceSettings: false,
    },
    {
      generateImageFn: async (options: any) => {
        capturedOptions = options;
        return createGeneratedImageResult("bWFyay1wb3J0cmFpdA==");
      },
    },
  );

  const output = await (result.tools.createImage as any).execute({
    prompt: "Add a butterfly at mark01",
  });

  assert.equal(
    capturedOptions.size,
    resolveOpenAIImageSize("gpt-image-2", "9:16", "1K"),
  );
  assert.equal(output.aspectRatio, "9:16");
  assert.equal(output.size, "864x1536");
  assert.match(capturedOptions.prompt.text, /source image size 1080x1920px/);
});

test("assistant chat image tools keep locked panel aspect ratio over reference ratio", async () => {
  let capturedOptions: any = null;
  const referenceImageUrl = "https://cdn.example.test/portrait-product.png";
  const result = createAssistantChatImageTools(
    {
      enabled: true,
      provider: {
        id: "plato",
        name: "Plato",
        baseUrl: "https://api.example.test",
        apiKey: "test-key",
      },
      modelId: "gpt-image-2",
      aspectRatio: "1:1",
      resolution: "1K",
      count: 1,
      referenceImages: [referenceImageUrl],
      referenceImageContexts: [
        {
          imageUrl: referenceImageUrl,
          imageWidth: 1000,
          imageHeight: 1500,
        },
      ],
      enforceSettings: true,
    },
    {
      generateImageFn: async (options: any) => {
        capturedOptions = options;
        return createGeneratedImageResult("bG9ja2VkLXNxdWFyZQ==");
      },
    },
  );

  const output = await (result.tools.createImage as any).execute({
    prompt: "Edit this product image into a more premium background",
  });

  assert.equal(
    capturedOptions.size,
    resolveOpenAIImageSize("gpt-image-2", "1:1", "1K"),
  );
  assert.equal(output.aspectRatio, "1:1");
  assert.equal(output.settingsLocked, true);
});

test("assistant chat image tools prefer explicit aspect ratio over reference ratio", async () => {
  let capturedOptions: any = null;
  const referenceImageUrl = "https://cdn.example.test/portrait-product.png";
  const result = createAssistantChatImageTools(
    {
      enabled: true,
      provider: {
        id: "plato",
        name: "Plato",
        baseUrl: "https://api.example.test",
        apiKey: "test-key",
      },
      modelId: "gpt-image-2",
      aspectRatio: "1:1",
      resolution: "1K",
      count: 1,
      referenceImages: [referenceImageUrl],
      referenceImageContexts: [
        {
          imageUrl: referenceImageUrl,
          imageWidth: 1000,
          imageHeight: 1500,
        },
      ],
      enforceSettings: false,
    },
    {
      generateImageFn: async (options: any) => {
        capturedOptions = options;
        return createGeneratedImageResult("d2lkZQ==");
      },
    },
  );

  const output = await (result.tools.createImage as any).execute({
    prompt: "Edit this product image into a wide poster",
    aspectRatio: "16:9",
  });

  assert.equal(
    capturedOptions.size,
    resolveOpenAIImageSize("gpt-image-2", "16:9", "1K"),
  );
  assert.equal(output.aspectRatio, "16:9");
});

test("assistant chat image tools upscale existing images with source URL, inherited ratio, and no redesign prompt", async () => {
  let capturedOptions: any = null;
  const referenceImageUrl = "https://cdn.example.test/source-poster.png";
  const result = createAssistantChatImageTools(
    {
      enabled: true,
      provider: {
        id: "plato",
        name: "Plato",
        baseUrl: "https://api.example.test",
        apiKey: "test-key",
      },
      modelId: "gpt-image-2",
      aspectRatio: "1:1",
      resolution: "1K",
      count: 1,
      referenceImages: [referenceImageUrl],
      referenceImageContexts: [
        {
          imageUrl: referenceImageUrl,
          imageWidth: 1000,
          imageHeight: 1500,
        },
      ],
      enforceSettings: false,
    },
    {
      generateImageFn: async (options: any) => {
        capturedOptions = options;
        return createGeneratedImageResult("dXBzY2FsZWQ=");
      },
    },
  );

  const output = await (result.tools.upscaleImage as any).execute({
    resolution: "4K",
    prompt: "Keep all Chinese text exactly the same.",
  });

  assert.equal(capturedOptions.n, 1);
  assert.equal(
    capturedOptions.size,
    resolveOpenAIImageSize("gpt-image-2", "2:3", "4K"),
  );
  assert.deepEqual(capturedOptions.prompt.images, [referenceImageUrl]);
  assert.match(capturedOptions.prompt.text, /Content-preserving AI super-resolution/);
  assert.match(capturedOptions.prompt.text, /Do not redesign/);
  assert.match(capturedOptions.prompt.text, /Keep all Chinese text exactly the same/);
  assert.equal(output.operation, "upscale");
  assert.equal(output.referenceCount, 1);
  assert.equal(output.aspectRatio, "2:3");
  assert.equal(output.size, resolveOpenAIImageSize("gpt-image-2", "2:3", "4K"));
  assert.equal(output.resolution, "4K");
  assert.equal(output.count, 1);
  assert.equal(output.settingsLocked, false);
});

test("assistant chat image tools reject upscale without a source image", async () => {
  let generateCalled = false;
  const result = createAssistantChatImageTools(
    {
      enabled: true,
      provider: {
        id: "plato",
        name: "Plato",
        baseUrl: "https://api.example.test",
        apiKey: "test-key",
      },
      modelId: "gpt-image-2",
      aspectRatio: "1:1",
      resolution: "1K",
      count: 1,
      enforceSettings: false,
    },
    {
      generateImageFn: async () => {
        generateCalled = true;
        return createGeneratedImageResult("c2hvdWxkLW5vdC1ydW4=");
      },
    },
  );

  await assert.rejects(
    () => (result.tools.upscaleImage as any).execute({ resolution: "4K" }),
    /requires an image reference/,
  );
  assert.equal(generateCalled, false);
});

test("assistant chat image tools do not fallback to text-only generation when upscale reference input fails", async () => {
  let callCount = 0;
  const referenceImageUrl = "https://cdn.example.test/source-poster.png";
  const result = createAssistantChatImageTools(
    {
      enabled: true,
      provider: {
        id: "plato",
        name: "Plato",
        baseUrl: "https://api.example.test",
        apiKey: "test-key",
      },
      modelId: "gpt-image-2",
      aspectRatio: "1:1",
      resolution: "1K",
      count: 1,
      referenceImages: [referenceImageUrl],
      enforceSettings: false,
    },
    {
      generateImageFn: async () => {
        callCount += 1;
        throw new Error("provider rejected reference image");
      },
    },
  );

  await assert.rejects(
    () => (result.tools.upscaleImage as any).execute({ resolution: "4K" }),
    /provider rejected reference image/,
  );
  assert.equal(callCount, 1);
});

test("assistant chat image tools register Google AI SDK image tool with aspect ratio", async () => {
  let capturedOptions: any = null;
  const result = createAssistantChatImageTools(
    {
      enabled: true,
      provider: {
        id: "gemini",
        name: "Gemini",
        baseUrl: "https://generativelanguage.googleapis.com",
        apiKey: "test-key",
      },
      modelId: "Nano Banana Pro",
      aspectRatio: "16:9",
      resolution: "1K",
      count: 1,
    },
    {
      generateImageFn: async (options: any) => {
        capturedOptions = options;
        return createGeneratedImageResult("Z29vZ2xl");
      },
    },
  );

  assert.equal(result.reason, "registered");
  assert.equal(result.modelId, "gemini-3-pro-image-preview");
  assert.deepEqual(Object.keys(result.tools), ["createImage", "upscaleImage"]);

  const output = await (result.tools.createImage as any).execute({
    prompt: "Generate a cinematic hero image",
  });

  assert.equal(capturedOptions.model.provider, "gemini");
  assert.equal(capturedOptions.model.modelId, "gemini-3-pro-image-preview");
  assert.equal(capturedOptions.aspectRatio, "16:9");
  assert.equal(capturedOptions.size, undefined);
  assert.deepEqual(capturedOptions.providerOptions, {
    google: {
      imageConfig: {
        aspectRatio: "16:9",
        imageSize: "1K",
      },
    },
  });
  assert.equal(capturedOptions.prompt, "Generate a cinematic hero image");
  assert.equal(output.images[0].image, "data:image/png;base64,Z29vZ2xl");
});

test("assistant chat image tools support Google image models on custom base URLs", async () => {
  let capturedOptions: any = null;
  const result = createAssistantChatImageTools(
    {
      enabled: true,
      provider: {
        id: "yunwu",
        name: "Yunwu",
        baseUrl: "https://api.example-google-proxy.test",
        apiKey: "test-key",
      },
      modelId: "Nano Banana 2",
      aspectRatio: "3:4",
      resolution: "1K",
      count: 1,
    },
    {
      generateImageFn: async (options: any) => {
        capturedOptions = options;
        return createGeneratedImageResult("Y3VzdG9tLWdvb2dsZQ==");
      },
    },
  );

  assert.equal(result.reason, "registered");
  assert.equal(result.providerId, "yunwu");
  assert.equal(result.modelId, "gemini-3.1-flash-image-preview");

  await (result.tools.createImage as any).execute({
    prompt: "Generate a model product scene",
  });

  assert.equal(capturedOptions.model.provider, "yunwu");
  assert.equal(capturedOptions.model.modelId, "gemini-3.1-flash-image-preview");
  assert.equal(capturedOptions.aspectRatio, "3:4");
  assert.deepEqual(capturedOptions.providerOptions, {
    google: {
      imageConfig: {
        aspectRatio: "3:4",
        imageSize: "1K",
      },
    },
  });
});

test("assistant chat image tools forward Google imageSize from panel settings", async () => {
  let capturedOptions: any = null;
  const result = createAssistantChatImageTools(
    {
      enabled: true,
      provider: {
        id: "gemini",
        name: "Gemini",
        baseUrl: "https://generativelanguage.googleapis.com",
        apiKey: "test-key",
      },
      modelId: "NanoBanana2",
      aspectRatio: "16:9",
      resolution: "2K",
      count: 1,
      enforceSettings: true,
    },
    {
      generateImageFn: async (options: any) => {
        capturedOptions = options;
        return createGeneratedImageResult("Z2VtaW5pLTJL");
      },
    },
  );

  const output = await (result.tools.createImage as any).execute({
    prompt: "Generate a wide concept frame",
    aspectRatio: "1:1",
    count: 4,
  });

  assert.equal(capturedOptions.model.modelId, "gemini-3.1-flash-image-preview");
  assert.equal(capturedOptions.aspectRatio, "16:9");
  assert.deepEqual(capturedOptions.providerOptions, {
    google: {
      imageConfig: {
        aspectRatio: "16:9",
        imageSize: "2K",
      },
    },
  });
  assert.equal(output.aspectRatio, "16:9");
  assert.equal(output.resolution, "2K");
  assert.equal(output.count, 1);
  assert.equal(output.settingsLocked, true);
});

test("assistant chat image tools keep multi-image asset requests from falling back to one image", async () => {
  let capturedOptions: any = null;
  const result = createAssistantChatImageTools(
    {
      enabled: true,
      provider: {
        id: "plato",
        name: "Plato",
        baseUrl: "https://api.example.test",
        apiKey: "test-key",
      },
      modelId: "gpt-image-2",
      aspectRatio: "1:1",
      resolution: "1K",
      count: 1,
      minimumCount: 4,
      referenceImages: ["data:image/png;base64,cHJvZHVjdA=="],
      enforceSettings: false,
    },
    {
      generateImageFn: async (options: any) => {
        capturedOptions = options;
        return {
          ...createGeneratedImageResult("bXVsdGktMQ=="),
          images: [
            {
              mediaType: "image/png",
              base64: "bXVsdGktMQ==",
              uint8Array: new Uint8Array(),
            },
            {
              mediaType: "image/png",
              base64: "bXVsdGktMg==",
              uint8Array: new Uint8Array(),
            },
            {
              mediaType: "image/png",
              base64: "bXVsdGktMw==",
              uint8Array: new Uint8Array(),
            },
            {
              mediaType: "image/png",
              base64: "bXVsdGktNA==",
              uint8Array: new Uint8Array(),
            },
          ],
        } as any;
      },
    },
  );

  const output = await (result.tools.createImage as any).execute({
    prompt:
      "Plan and generate a product detail-page image set as separate images, not a collage.",
  });

  assert.equal(capturedOptions.n, 4);
  assert.deepEqual(capturedOptions.prompt, {
    text:
      "Plan and generate a product detail-page image set as separate images, not a collage.",
    images: ["data:image/png;base64,cHJvZHVjdA=="],
  });
  assert.equal(output.count, 4);
  assert.equal(output.images.length, 4);
  assert.equal(output.referenceCount, 1);
});

test("assistant chat image tools do not impose a project-level maximum image count", async () => {
  let capturedOptions: any = null;
  const requestedCount = 128;
  const result = createAssistantChatImageTools(
    {
      enabled: true,
      provider: {
        id: "plato",
        name: "Plato",
        baseUrl: "https://api.example.test",
        apiKey: "test-key",
      },
      modelId: "gpt-image-2",
      count: 1,
      minimumCount: requestedCount,
      enforceSettings: false,
    },
    {
      generateImageFn: async (options: any) => {
        capturedOptions = options;
        return createGeneratedImageResult();
      },
    },
  );

  await (result.tools.createImage as any).execute({
    prompt: `Generate ${requestedCount} separate product detail-page images, not a collage.`,
  });

  assert.equal(capturedOptions.n, requestedCount);
  assert.equal("maxImagesPerCall" in capturedOptions, false);
});

test("assistant chat image tools reject non-image OpenAI-compatible models", () => {
  const result = createAssistantChatImageTools({
    enabled: true,
    provider: {
      id: "custom",
      baseUrl: "https://api.example.test",
      apiKey: "test-key",
    },
    modelId: "gpt-5.4",
  });

  assert.equal(result.reason, "unsupported_provider");
  assert.deepEqual(Object.keys(result.tools), []);
});
