import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  createAssistantChatWebSearchTools,
  extractAssistantChatWebSearchSources,
} from "./assistant-chat-web-search.ts";

const sourcePath = fileURLToPath(new URL("./assistant-chat-web-search.ts", import.meta.url));

test("assistant chat web search tools stay empty when disabled", () => {
  const result = createAssistantChatWebSearchTools({
    enabled: false,
    provider: {
      id: "tavily",
      providerType: "tavily",
      apiKey: "tvly-test",
    },
  });

  assert.equal(result.reason, "disabled");
  assert.deepEqual(Object.keys(result.tools), []);
});

test("assistant chat web search registers Tavily AI SDK tool", () => {
  const result = createAssistantChatWebSearchTools({
    enabled: true,
    provider: {
      id: "tavily",
      providerType: "tavily",
      apiKey: "tvly-test",
    },
    defaults: {
      mode: "web+images",
      webCount: 4,
      timeRange: "week",
      blockedDomains: ["example.com"],
    },
  });

  assert.equal(result.reason, "registered");
  assert.equal(result.providerType, "tavily");
  assert.deepEqual(Object.keys(result.tools), [
    "webSearch",
    "tavilyExtract",
    "tavilyCrawl",
    "tavilyMap",
  ]);
  assert.equal(typeof result.tools.webSearch, "object");
  assert.equal(typeof result.tools.tavilyExtract, "object");
  assert.equal(typeof result.tools.tavilyCrawl, "object");
  assert.equal(typeof result.tools.tavilyMap, "object");
});

test("assistant chat web search registers Exa AI SDK tool", () => {
  const result = createAssistantChatWebSearchTools({
    enabled: true,
    provider: {
      id: "exa",
      providerType: "exa",
      apiKey: "exa-test",
    },
    defaults: {
      mode: "web",
      webCount: 5,
      compressionMode: "balanced",
    },
  });

  assert.equal(result.reason, "registered");
  assert.equal(result.providerType, "exa");
  assert.deepEqual(Object.keys(result.tools), ["webSearch"]);
});

test("assistant chat web search registers Perplexity AI SDK tool", () => {
  const result = createAssistantChatWebSearchTools({
    enabled: true,
    provider: {
      id: "perplexity",
      providerType: "perplexity",
      apiKey: "pplx-test",
    },
  });

  assert.equal(result.reason, "registered");
  assert.equal(result.providerType, "perplexity");
  assert.deepEqual(Object.keys(result.tools), ["webSearch"]);
});

test("assistant chat web search extracts sources from official package result shapes", () => {
  const sources = extractAssistantChatWebSearchSources({
    results: [
      {
        title: "Perplexity result",
        url: "https://example.com/perplexity",
        snippet: "preview",
        date: "2026-01-15",
      },
      {
        title: "Exa parent",
        url: "https://example.com/exa",
        subpages: [
          {
            title: "Exa subpage",
            url: "https://example.com/exa/about",
            summary: "about",
          },
        ],
        extras: {
          links: ["https://example.com/exa/contact"],
          imageLinks: ["https://cdn.example.com/image.png"],
        },
      },
    ],
    resultsMap: {
      docs: [{ title: "Mapped source", url: "https://example.com/mapped" }],
    },
  });

  assert.deepEqual(sources, [
    { title: "Perplexity result", url: "https://example.com/perplexity" },
    { title: "Exa parent", url: "https://example.com/exa" },
    { title: "Exa subpage", url: "https://example.com/exa/about" },
    { title: "https://example.com/exa/contact", url: "https://example.com/exa/contact" },
    { title: "Mapped source", url: "https://example.com/mapped" },
  ]);
});

test("assistant chat web search source extraction is not capped by XC Studio", () => {
  const sources = extractAssistantChatWebSearchSources({
    results: Array.from({ length: 12 }, (_, index) => ({
      title: `Source ${index + 1}`,
      url: `https://example.com/source-${index + 1}`,
    })),
  });

  assert.equal(sources.length, 12);
  assert.equal(sources[11]?.url, "https://example.com/source-12");
});

test("assistant chat web search extracts official source-url parts from nested provider metadata", () => {
  const sources = extractAssistantChatWebSearchSources({
    citations: [
      {
        title: "Citation URL",
        citationUrl: "https://example.com/citation-url",
      },
      {
        title: "Duplicate should be ignored",
        metadata: {
          url: "https://example.com/citation-url",
        },
      },
    ],
    references: [
      {
        name: "Reference href",
        href: "https://example.com/reference-href",
      },
      {
        sourceName: "Nested source",
        source: {
          source_url: "https://example.com/nested-source",
        },
      },
    ],
    organic: [
      {
        hostname: "example.com",
        displayUrl: "https://example.com/display-url",
      },
      {
        title: "Invalid URL",
        url: "example.com/not-http",
      },
    ],
  });

  assert.deepEqual(sources, [
    { title: "Citation URL", url: "https://example.com/citation-url" },
    { title: "Reference href", url: "https://example.com/reference-href" },
    { title: "Nested source", url: "https://example.com/nested-source" },
    { title: "example.com", url: "https://example.com/display-url" },
  ]);
});

test("assistant chat web search requires an API key for registry tools", () => {
  const previousKey = process.env.TAVILY_API_KEY;
  delete process.env.TAVILY_API_KEY;

  try {
    const result = createAssistantChatWebSearchTools({
      enabled: true,
      provider: {
        id: "tavily",
        providerType: "tavily",
        apiKey: "",
      },
    });

    assert.equal(result.reason, "missing_api_key");
    assert.deepEqual(Object.keys(result.tools), []);
  } finally {
    if (previousKey === undefined) {
      delete process.env.TAVILY_API_KEY;
    } else {
      process.env.TAVILY_API_KEY = previousKey;
    }
  }
});

test("assistant chat web search stays on AI SDK tool packages instead of legacy search routes", () => {
  const source = readFileSync(sourcePath, "utf8");

  assert.match(source, /from\s+["']@tavily\/ai-sdk["']/);
  assert.match(source, /from\s+["']@exalabs\/ai-sdk["']/);
  assert.match(source, /from\s+["']@perplexity-ai\/ai-sdk["']/);
  assert.match(source, /\btavilySearch\(/);
  assert.match(source, /\btavilyExtract\(/);
  assert.match(source, /\btavilyCrawl\(/);
  assert.match(source, /\btavilyMap\(/);
  assert.doesNotMatch(source, /\bMath\.min\(10,/);
  assert.doesNotMatch(source, /\bcitations\.slice\(0,\s*8\)/);
  assert.doesNotMatch(source, /from\s+["'][^"']*(?:api\/search|services\/research\/search\.service)/);
  assert.doesNotMatch(source, /\bfetch\s*\(\s*["'`]\/api\/search/);
  assert.doesNotMatch(source, /\bsearchTavily\b|\bsearchExa\b|\bsearchSearxng\b/);
});
