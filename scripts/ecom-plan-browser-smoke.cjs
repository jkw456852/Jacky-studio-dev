const fs = require("fs");
const path = require("path");
const os = require("os");

const DEFAULT_APP_URL =
  process.env.ECOM_PLAN_SMOKE_URL ||
  "http://localhost:3001/workspace/plan-smoke";
const ECOMMERCE_LOCAL_CACHE_PREFIX = "jkstudio:ecom-oneclick:";
const LEGACY_ECOMMERCE_LOCAL_CACHE_PREFIX = "xcstudio:ecom-oneclick:";
const DEFAULT_PROVIDER_ID = "yunwu";
const DEFAULT_PROVIDER_BASE_URL = "https://yunwu.ai";
const DEFAULT_PLAYWRIGHT_RUNNER_DIR = path.resolve("tmp/playwright-runner");
const DEFAULT_OUTPUT_DIR = path.resolve("tmp/plan-smoke");
const DEFAULT_CHROME_LEVELDB_DIR = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
  "Google",
  "Chrome",
  "User Data",
  "Default",
  "Local Storage",
  "leveldb",
);

const PLAN_SMOKE_PAYLOAD = {
  selectedTypes: [
    { id: "white_bg", title: "White Background", imageCount: 3 },
    { id: "detail_highlights", title: "Detail Highlights", imageCount: 3 },
    { id: "usage_scene", title: "Usage Scene", imageCount: 4 },
  ],
  brief:
    "Create a compact ecommerce image plan for a premium black leather car seat cover set. Keep silhouette, stitching, material texture, and color family consistent across concepts.",
  platformMode: "general",
  workflowMode: "professional",
  supplementSummary:
    "Priority: clear product identity, ecommerce-ready framing, and stable material texture. Do not change structure or dominant color.",
  imageAnalyses: [
    {
      imageId: "img-front",
      title: "Front View",
      description:
        "Front-facing reference showing the main silhouette and overall material finish.",
      analysisConclusion:
        "Use as the primary identity anchor for shape, surface texture, and stitching rhythm.",
    },
    {
      imageId: "img-angle",
      title: "Angle View",
      description:
        "Three-quarter angle reference showing side wrapping and dimensional depth.",
      analysisConclusion:
        "Use to preserve side fit, edge wrapping, and depth cues.",
    },
    {
      imageId: "img-detail",
      title: "Detail View",
      description:
        "Close-up reference focused on stitching, perforation texture, and finish quality.",
      analysisConclusion:
        "Use to lock in fine material texture and craftsmanship details.",
    },
  ],
};

function resolvePlaywright() {
  const runnerDir = process.env.PLAYWRIGHT_RUNNER_DIR
    ? path.resolve(process.env.PLAYWRIGHT_RUNNER_DIR)
    : DEFAULT_PLAYWRIGHT_RUNNER_DIR;
  const candidates = [
    path.join(runnerDir, "node_modules", "playwright"),
    path.resolve("node_modules/playwright"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }

  throw new Error(
    [
      "Playwright was not found.",
      `Run scripts/run-ecom-plan-browser-smoke.ps1 or install playwright in ${runnerDir}.`,
    ].join(" "),
  );
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function cleanDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  ensureDir(dirPath);
}

function snapshotChromeLevelDb(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(
      `Chrome Local Storage directory was not found: ${sourceDir}`,
    );
  }

  cleanDir(targetDir);
  const entries = fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ldb|log)$/i.test(entry.name));

  if (entries.length === 0) {
    throw new Error(
      `Chrome Local Storage directory has no .ldb or .log files: ${sourceDir}`,
    );
  }

  for (const entry of entries) {
    fs.copyFileSync(
      path.join(sourceDir, entry.name),
      path.join(targetDir, entry.name),
    );
  }
}

function scanSnapshotFiles(snapshotDir) {
  return fs
    .readdirSync(snapshotDir)
    .filter((name) => /\.(ldb|log)$/i.test(name))
    .map((name) => ({
      name,
      mtimeMs: fs.statSync(path.join(snapshotDir, name)).mtimeMs,
      buffer: fs.readFileSync(path.join(snapshotDir, name)),
      text: fs.readFileSync(path.join(snapshotDir, name)).toString("latin1"),
    }));
}

function redactSecrets(value) {
  return String(value || "")
    .replace(/([?&]key=)([^&]+)/gi, "$1***")
    .replace(/(sk-[0-9A-Za-z_-]{10,})/g, "sk-***")
    .replace(/(AIza[0-9A-Za-z_-]{10,})/g, "AIza***");
}

function findProviderCredential(files) {
  const candidates = [];

  for (const file of files) {
    const matches = [
      ...file.text.matchAll(
        /yunwu_api_key[\s\S]{0,160}?(sk-[0-9A-Za-z_-]{20,})/g,
      ),
    ];
    for (const match of matches) {
      const index = match.index || 0;
      const snippet = file.text.slice(
        Math.max(0, index - 320),
        Math.min(file.text.length, index + 520),
      );
      const baseUrlMatch =
        snippet.match(
          /base_url[\s\S]{0,80}?(https?:\/\/[A-Za-z0-9./:_-]+)/,
        ) ||
        snippet.match(
          /baseUrl[\s\S]{0,80}?(https?:\/\/[A-Za-z0-9./:_-]+)/,
        );
      const baseUrl = baseUrlMatch
        ? baseUrlMatch[1]
        : DEFAULT_PROVIDER_BASE_URL;
      const score =
        (baseUrl.includes("yunwu.ai") ? 100 : 0) +
        (/localhost|127\.0\.0\.1|Jacky-Studio|jacky-studio|JK|XC-STUDIO|xc-studio/i.test(
          snippet,
        )
          ? 50
          : 0) +
        file.mtimeMs / 1e12;

      candidates.push({
        providerId: DEFAULT_PROVIDER_ID,
        apiKey: match[1],
        baseUrl,
        sourceFile: file.name,
        score,
        mtimeMs: file.mtimeMs,
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.score - a.score || b.mtimeMs - a.mtimeMs);
  return candidates[0];
}

function extractBalancedJsonObject(text) {
  const start = text.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

function extractJsonAfterCacheKey(buffer, startIndex) {
  for (
    let offset = startIndex;
    offset < Math.min(buffer.length - 1, startIndex + 512);
    offset += 1
  ) {
    if (buffer[offset] === 0x7b && buffer[offset + 1] === 0x00) {
      const decoded = buffer
        .slice(offset, Math.min(buffer.length, offset + 240000))
        .toString("utf16le");
      const candidate = extractBalancedJsonObject(decoded);
      if (!candidate) continue;

      try {
        return JSON.parse(candidate);
      } catch {
        continue;
      }
    }
  }

  return null;
}

function findLatestEcommerceCache(files) {
  const prefixes = [
    Buffer.from(ECOMMERCE_LOCAL_CACHE_PREFIX, "utf8"),
    Buffer.from(LEGACY_ECOMMERCE_LOCAL_CACHE_PREFIX, "utf8"),
  ];
  const candidates = [];

  for (const file of files) {
    for (const prefix of prefixes) {
      let index = file.buffer.indexOf(prefix);
      while (index >= 0) {
        const keySlice = file.buffer
          .slice(index, Math.min(file.buffer.length, index + 220))
          .toString("latin1");
        const keyMatch = keySlice.match(
          /(?:jkstudio|xcstudio):ecom-oneclick:[A-Za-z0-9:_\-]+/,
        );
        const cache = extractJsonAfterCacheKey(file.buffer, index);

        if (keyMatch && cache && typeof cache === "object") {
          candidates.push({
            key: keyMatch[0],
            cache,
            savedAt: Number(cache?.savedAt || 0),
            file: file.name,
            mtimeMs: file.mtimeMs,
          });
        }

        index = file.buffer.indexOf(prefix, index + prefix.length);
      }
    }
  }

  candidates.sort((a, b) => b.savedAt - a.savedAt || b.mtimeMs - a.mtimeMs);
  return candidates[0] || null;
}

function buildProviderStorage(credential) {
  const providers = [
    {
      id: "yunwu",
      name: "Yunwu",
      baseUrl: credential.baseUrl || DEFAULT_PROVIDER_BASE_URL,
      apiKey: credential.apiKey,
    },
    {
      id: "plato",
      name: "Plato",
      baseUrl: "https://api.bltcy.ai",
      apiKey: "",
    },
    {
      id: "gemini",
      name: "Gemini",
      baseUrl: "https://generativelanguage.googleapis.com",
      apiKey: "",
    },
  ];

  return {
    api_provider: credential.providerId || DEFAULT_PROVIDER_ID,
    api_providers: JSON.stringify(providers),
    yunwu_api_key: credential.apiKey,
  };
}

function summarizeResult(result) {
  const groups = Array.isArray(result?.groups) ? result.groups : [];
  const totalItems = groups.reduce(
    (sum, group) =>
      sum + (Array.isArray(group?.items) ? group.items.length : 0),
    0,
  );

  return {
    groupCount: groups.length,
    totalItems,
    groupSummaries: groups.map((group) => ({
      typeTitle: group?.typeTitle || "",
      summaryLength: String(group?.summary || "").trim().length,
      strategyCount: Array.isArray(group?.strategy)
        ? group.strategy.length
        : 0,
      itemCount: Array.isArray(group?.items) ? group.items.length : 0,
      itemTitles: Array.isArray(group?.items)
        ? group.items.map((item) => item?.title || "")
        : [],
    })),
    reviewVerdict: result?.review?.verdict || "",
    reviewRisks: Array.isArray(result?.review?.risks)
      ? result.review.risks
      : [],
  };
}

function summarizePromptPreparation(jobs) {
  const list = Array.isArray(jobs) ? jobs : [];
  const preparedJobs = list.filter(
    (job) =>
      job?.promptStatus === "done" &&
      String(job?.finalPrompt || "").trim().length > 0,
  );
  const failedJobs = list.filter(
    (job) =>
      job?.promptStatus !== "done" ||
      String(job?.finalPrompt || "").trim().length === 0,
  );

  return {
    totalJobs: list.length,
    preparedJobs: preparedJobs.length,
    failedJobs: failedJobs.length,
    promptLengths: list.map((job) => ({
      planItemId: job?.planItemId || "",
      title: job?.title || "",
      promptStatus: job?.promptStatus || "idle",
      finalPromptLength: String(job?.finalPrompt || "").trim().length,
    })),
  };
}

function trimText(value, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function summarizeSupplementFields(fields) {
  if (!Array.isArray(fields) || fields.length === 0) {
    return "";
  }

  return fields
    .map((field) => {
      const label = trimText(field?.label, 60);
      if (!label) return "";

      if (typeof field?.value === "string") {
        const value = trimText(field.value, 120);
        return value ? `${label}: ${value}` : "";
      }

      if (Array.isArray(field?.value)) {
        const value = field.value
          .map((item) => trimText(item, 40))
          .filter(Boolean)
          .slice(0, 5)
          .join(" / ");
        return value ? `${label}: ${value}` : "";
      }

      return "";
    })
    .filter(Boolean)
    .slice(0, 8)
    .join("\n");
}

function buildPayloadFromCache(cache) {
  const selectedTypes = Array.isArray(cache?.recommendedTypes)
    ? cache.recommendedTypes
        .filter((item) => item?.selected)
        .map((item) => ({
          id: String(item.id || "").trim(),
          title: trimText(item.title, 60),
          imageCount:
            Number(item.imageCount || 0) > 0 ? Number(item.imageCount) : 3,
        }))
        .filter((item) => item.id && item.title)
    : [];

  const imageAnalyses = Array.isArray(cache?.imageAnalyses)
    ? cache.imageAnalyses
        .map((item, index) => ({
          imageId: String(item?.imageId || `cache-image-${index + 1}`).trim(),
          title: trimText(item?.title, 60),
          description: trimText(item?.description, 220),
          analysisConclusion: trimText(item?.analysisConclusion, 180),
        }))
        .filter((item) => item.title && item.description)
    : [];

  return {
    selectedTypes,
    brief: trimText(cache?.description, 1000),
    platformMode:
      String(cache?.platformMode || "general").trim() || "general",
    workflowMode:
      String(cache?.workflowMode || "professional").trim() || "professional",
    supplementSummary: summarizeSupplementFields(cache?.supplementFields),
    imageAnalyses,
  };
}

async function run() {
  const { chromium } = resolvePlaywright();
  const outputDir = DEFAULT_OUTPUT_DIR;
  const snapshotDir = path.resolve("tmp/chrome-localstorage-snapshot-runtime");
  ensureDir(outputDir);

  snapshotChromeLevelDb(DEFAULT_CHROME_LEVELDB_DIR, snapshotDir);
  const files = scanSnapshotFiles(snapshotDir);
  const credential = findProviderCredential(files);

  if (!credential?.apiKey) {
    throw new Error("Could not find `yunwu_api_key` in Chrome Local Storage.");
  }

  const storageSeed = buildProviderStorage(credential);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const debugTrace = {
    console: [],
    pageErrors: [],
    responses: [],
  };

  await page.addInitScript((seed) => {
    Object.entries(seed).forEach(([key, value]) => {
      window.localStorage.setItem(key, String(value));
    });
  }, storageSeed);

  page.on("console", (message) => {
    debugTrace.console.push({
      type: message.type(),
      text: message.text(),
    });
  });

  page.on("pageerror", (error) => {
    debugTrace.pageErrors.push({
      message: error.message,
      stack: error.stack || "",
    });
  });

  page.on("response", async (response) => {
    const url = response.url();
    if (
      !/chat\/completions|generateContent|models\/[^/]+:generateContent/i.test(
        url,
      )
    ) {
      return;
    }

    let bodyText = "";
    try {
      bodyText = await response.text();
    } catch (error) {
      bodyText = `<<unreadable:${error.message}>>`;
    }

    debugTrace.responses.push({
      url: redactSecrets(url),
      status: response.status(),
      body: redactSecrets(bodyText),
    });
  });

  try {
    await page.goto(DEFAULT_APP_URL, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });

    const cacheProbe = await page.evaluate((prefixes) => {
      const candidates = [];
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key || !prefixes.some((prefix) => key.startsWith(prefix))) {
          continue;
        }
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;

        try {
          const parsed = JSON.parse(raw);
          candidates.push({
            key,
            savedAt: Number(parsed?.savedAt || 0),
            cache: parsed,
          });
        } catch (error) {
          candidates.push({
            key,
            savedAt: 0,
            cache: null,
            parseError: String(error?.message || error),
          });
        }
      }
      candidates.sort((a, b) => b.savedAt - a.savedAt);
      return candidates[0] || null;
    }, [ECOMMERCE_LOCAL_CACHE_PREFIX, LEGACY_ECOMMERCE_LOCAL_CACHE_PREFIX]);

    const snapshotCacheProbe = findLatestEcommerceCache(files);
    const pageCachePayload = cacheProbe?.cache
      ? buildPayloadFromCache(cacheProbe.cache)
      : null;
    const snapshotCachePayload = snapshotCacheProbe?.cache
      ? buildPayloadFromCache(snapshotCacheProbe.cache)
      : null;
    const isUsableCachePayload = (payload) =>
      Boolean(payload) &&
      Array.isArray(payload.selectedTypes) &&
      payload.selectedTypes.length > 0 &&
      Array.isArray(payload.imageAnalyses) &&
      payload.imageAnalyses.length > 0;

    let finalPayload = PLAN_SMOKE_PAYLOAD;
    let payloadSource = "built-in-smoke-payload";
    let payloadTopicKey = "";
    if (isUsableCachePayload(pageCachePayload)) {
      finalPayload = pageCachePayload;
      payloadSource = "page-local-cache";
      payloadTopicKey = cacheProbe?.key || "";
    } else if (isUsableCachePayload(snapshotCachePayload)) {
      finalPayload = snapshotCachePayload;
      payloadSource = "snapshot-local-cache";
      payloadTopicKey = snapshotCacheProbe?.key || "";
    }

    const resultBundle = await page.evaluate(async (payload) => {
      const skill = await import("/services/skills/ecom-oneclick-workflow.skill.ts");
      const { executeSkill } = await import("/services/skills/index.ts");

      const MAX_GENERATION_REFERENCE_IMAGES = 3;
      const AUTO_FINALIZE_PROMPT_FEEDBACK =
        "Rewrite the prompt into a clean final Chinese prompt that is ready for Nano Banana 2 / Gemini image generation. Keep product identity stable and remove redundant defensive wording.";

      const extractRewrittenPrompt = (value) =>
        typeof value === "string"
          ? value.trim()
          : typeof value?.prompt === "string"
            ? value.prompt.trim()
            : "";

      const buildBatchJobs = (groups) =>
        (Array.isArray(groups) ? groups : []).flatMap((group) =>
          (Array.isArray(group?.items) ? group.items : []).map((item) => ({
            id: `ecom-job-${group?.typeId || "group"}-${item?.id || "item"}`,
            planItemId: item?.id || "",
            title: item?.title || "",
            prompt: item?.promptOutline || "",
            status: "idle",
            promptStatus: "idle",
            imageStatus: "idle",
            finalPrompt: "",
            results: [],
          })),
        );

      const getRelevantImageAnalyses = (session, referenceImageIds) => {
        const prioritized = (session.imageAnalyses || []).filter((item) =>
          (referenceImageIds || []).includes(item.imageId),
        );
        const fallback = (session.imageAnalyses || []).filter(
          (item) =>
            item.usableAsReference &&
            !prioritized.some((candidate) => candidate.imageId === item.imageId),
        );

        return [...prioritized, ...fallback].slice(
          0,
          MAX_GENERATION_REFERENCE_IMAGES,
        );
      };

      const buildGenerationBasePrompt = ({
        session,
        groupTitle,
        item,
        relevantAnalyses,
        supplementSummary,
      }) => {
        const mustShow = (item.mustShow || []).filter(Boolean).join(" / ");
        const platformFit = (item.platformFit || [])
          .filter(Boolean)
          .join(" / ");
        const riskNotes = (item.riskNotes || []).filter(Boolean).join(" / ");
        const analysisAnchors = relevantAnalyses
          .map((analysis, index) =>
            [
              `Reference ${index + 1}: ${analysis.title}`,
              analysis.angle ? `Angle: ${analysis.angle}` : "",
              `Description: ${analysis.description}`,
              analysis.analysisConclusion
                ? `Conclusion: ${analysis.analysisConclusion}`
                : "",
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n\n");

        return [
          `Generate an ecommerce concept for ${groupTitle} / ${item.title}.`,
          "",
          "Product identity:",
          session.description || "Use the provided product references.",
          analysisAnchors,
          mustShow ? `Must show: ${mustShow}` : "",
          "",
          "Execution requirements:",
          item.description ? `Description: ${item.description}` : "",
          item.marketingGoal ? `Marketing goal: ${item.marketingGoal}` : "",
          item.keyMessage ? `Key message: ${item.keyMessage}` : "",
          item.promptOutline ? `Draft prompt: ${item.promptOutline}` : "",
          item.composition ? `Composition: ${item.composition}` : "",
          item.styling ? `Styling: ${item.styling}` : "",
          item.background ? `Background: ${item.background}` : "",
          item.lighting ? `Lighting: ${item.lighting}` : "",
          `Aspect ratio: ${item.ratio || "1:1"}`,
          platformFit ? `Platform fit: ${platformFit}` : "",
          supplementSummary ? `Supplement summary:\n${supplementSummary}` : "",
          riskNotes ? `Risk notes: ${riskNotes}` : "",
          "",
          "Keep the same product silhouette, material texture, color family, and stitching logic across the final composition.",
        ]
          .filter(Boolean)
          .join("\n");
      };

      const planResponse = await skill.ecomGeneratePlansSkill(payload);
      const normalizedPlanResponse = JSON.parse(JSON.stringify(planResponse));
      const groups = Array.isArray(normalizedPlanResponse?.groups)
        ? normalizedPlanResponse.groups
        : [];
      const session = {
        description: String(payload?.brief || "").trim(),
        imageAnalyses: (
          Array.isArray(payload?.imageAnalyses) ? payload.imageAnalyses : []
        ).map((item) => ({
          imageId: String(item?.imageId || "").trim(),
          title: String(item?.title || "").trim(),
          description: String(item?.description || "").trim(),
          analysisConclusion: String(item?.analysisConclusion || "").trim(),
          angle: String(item?.angle || "").trim(),
          usableAsReference:
            typeof item?.usableAsReference === "boolean"
              ? item.usableAsReference
              : true,
        })),
      };
      const supplementSummary = String(payload?.supplementSummary || "").trim();
      const jobs = buildBatchJobs(groups);

      for (const job of jobs) {
        const group = groups.find(
          (candidate) =>
            Array.isArray(candidate?.items) &&
            candidate.items.some((item) => item?.id === job.planItemId),
        );
        const planItem =
          group?.items?.find((candidate) => candidate?.id === job.planItemId) ||
          null;

        if (!group || !planItem) {
          job.promptStatus = "failed";
          job.status = "failed";
          job.error = "Plan item was not found.";
          continue;
        }

        const relevantAnalyses = getRelevantImageAnalyses(
          session,
          Array.isArray(planItem.referenceImageIds)
            ? planItem.referenceImageIds
            : [],
        );
        const basePrompt = buildGenerationBasePrompt({
          session,
          groupTitle: group.typeTitle || job.title,
          item: {
            ...planItem,
            promptOutline: job.prompt || planItem.promptOutline || job.title,
            ratio: planItem.ratio || "1:1",
          },
          relevantAnalyses,
          supplementSummary,
        });

        try {
          job.status = "generating";
          job.promptStatus = "generating";
          const rewriteResult = await executeSkill("ecomRewritePrompt", {
            productDescription: session.description,
            typeTitle: group.typeTitle || job.title,
            planTitle: job.title,
            planDescription: planItem.description,
            currentPrompt: basePrompt,
            supplementSummary,
            targetRatio: planItem.ratio || "1:1",
            feedback: AUTO_FINALIZE_PROMPT_FEEDBACK,
            imageAnalyses: relevantAnalyses.map((item) => ({
              title: item.title,
              description: item.description,
              analysisConclusion: item.analysisConclusion,
              angle: item.angle,
            })),
          });
          const finalPrompt = extractRewrittenPrompt(rewriteResult) || basePrompt;

          if (!finalPrompt) {
            throw new Error("Prompt rewrite returned an empty result.");
          }

          job.status = "idle";
          job.promptStatus = "done";
          job.imageStatus = "idle";
          job.finalPrompt = finalPrompt;
          job.error = undefined;
        } catch (error) {
          job.status = "failed";
          job.promptStatus = "failed";
          job.imageStatus = "idle";
          job.error = error instanceof Error ? error.message : String(error);
        }
      }

      return JSON.parse(
        JSON.stringify({
          planResult: normalizedPlanResponse,
          promptJobs: jobs,
        }),
      );
    }, finalPayload);

    const result = resultBundle?.planResult || {};
    const promptJobs = Array.isArray(resultBundle?.promptJobs)
      ? resultBundle.promptJobs
      : [];
    const summary = summarizeResult(result);
    const promptPreparation = summarizePromptPreparation(promptJobs);
    const payloadPath = path.join(outputDir, "latest-result.json");
    const promptPath = path.join(outputDir, "latest-prompts.json");
    const summaryPath = path.join(outputDir, "latest-summary.json");
    const debugPath = path.join(outputDir, "latest-debug.json");

    fs.writeFileSync(payloadPath, JSON.stringify(result, null, 2), "utf8");
    fs.writeFileSync(promptPath, JSON.stringify(promptJobs, null, 2), "utf8");
    fs.writeFileSync(
      summaryPath,
      JSON.stringify(
        {
          appUrl: DEFAULT_APP_URL,
          providerId: credential.providerId,
          providerBaseUrl: credential.baseUrl,
          providerSourceFile: credential.sourceFile,
          payloadSource,
          payloadTopicKey,
          payloadSelectedTypeIds: (finalPayload.selectedTypes || []).map(
            (item) => item.id,
          ),
          generatedAt: new Date().toISOString(),
          summary,
          promptPreparation,
        },
        null,
        2,
      ),
      "utf8",
    );
    fs.writeFileSync(debugPath, JSON.stringify(debugTrace, null, 2), "utf8");

    if (summary.groupCount === 0 || summary.totalItems === 0) {
      throw new Error(
        `Plan generation returned no items. Check ${payloadPath} and ${debugPath}.`,
      );
    }

    if (
      promptPreparation.totalJobs === 0 ||
      promptPreparation.failedJobs > 0
    ) {
      throw new Error(
        `Prompt preparation failed. Check ${promptPath}, ${summaryPath}, and ${debugPath}.`,
      );
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          appUrl: DEFAULT_APP_URL,
          providerSourceFile: credential.sourceFile,
          payloadSource,
          payloadTopicKey,
          groupCount: summary.groupCount,
          totalItems: summary.totalItems,
          reviewVerdict: summary.reviewVerdict,
          output: {
            result: payloadPath,
            prompts: promptPath,
            summary: summaryPath,
            debug: debugPath,
          },
          promptPreparation,
          groups: summary.groupSummaries,
        },
        null,
        2,
      ),
    );
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

run().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
