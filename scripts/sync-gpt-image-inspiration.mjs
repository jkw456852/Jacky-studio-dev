import fs from "node:fs";
import path from "node:path";

const REPO_OWNER = "freestylefly";
const REPO_NAME = "awesome-gpt-image-2";
const REPO_BRANCH = "main";
const SITE_URL = "https://gpt-image2.canghe.ai/";
const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;
const OUTPUT_PATH = path.join(
  process.cwd(),
  "public",
  "runtime-assets",
  "gpt-image-inspiration.json",
);
const LOCAL_REPO_PATH = path.join(
  process.cwd(),
  "tmp",
  "awesome-gpt-image-2-main",
);
const SEED_PATH = path.join(
  process.cwd(),
  "public",
  "runtime-assets",
  "gpt-image-inspiration.seed.json",
);

const DATA_FILES = {
  cases: "data/cases.json",
  styleLibrary: "data/style-library.json",
};

const GITHUB_API_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "Jacky-Studio-GptImageInspirationSync/2.0",
};

const ensureDir = (targetPath) => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
};

const readJsonIfExists = (targetPath) => {
  if (!fs.existsSync(targetPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(targetPath, "utf8"));
  } catch {
    return null;
  }
};

const writePayload = (payload) => {
  ensureDir(OUTPUT_PATH);
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

const fetchJson = async (url) => {
  const response = await fetch(url, { headers: GITHUB_API_HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to fetch JSON from ${url}: ${response.status}`);
  }
  return response.json();
};

const readLocalJson = (filePath) => {
  const fullPath = path.join(LOCAL_REPO_PATH, filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Local fallback file not found: ${fullPath}`);
  }
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
};

const rawUrlFor = (filePath) =>
  `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/${filePath}`;

const assetUrlFor = (assetPath) => {
  const normalized = String(assetPath || "").replace(/^\/+/, "");
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/data/${normalized}`;
};

const withStaleFlag = (payload, reason) => ({
  ...payload,
  generatedAt: payload.generatedAt || new Date().toISOString(),
  stale: true,
  staleReason: reason instanceof Error ? reason.message : String(reason),
});

const normalizeCases = (casesPayload) => {
  const cases = Array.isArray(casesPayload?.cases) ? casesPayload.cases : [];
  return cases.map((item) => ({
    ...item,
    image: assetUrlFor(item.image),
  }));
};

const normalizeCategories = (styleLibrary) => {
  const categories = Array.isArray(styleLibrary?.categories)
    ? styleLibrary.categories
    : [];
  return categories.map((item) => ({
    ...item,
    cover: assetUrlFor(item.cover),
  }));
};

const normalizeTemplates = (styleLibrary) => {
  const templates = Array.isArray(styleLibrary?.templates)
    ? styleLibrary.templates
    : [];
  return templates.map((item) => ({
    ...item,
    cover: assetUrlFor(item.cover),
  }));
};

const buildPayload = (casesPayload, styleLibrary) => ({
  version: 2,
  generatedAt: new Date().toISOString(),
  source: {
    siteUrl: SITE_URL,
    repoUrl: REPO_URL,
    owner: REPO_OWNER,
    repo: REPO_NAME,
    branch: REPO_BRANCH,
  },
  repository: styleLibrary.repository || REPO_URL,
  templateDocument: styleLibrary.templateDocument || "docs/templates.md",
  totalCases: Number(casesPayload.totalCases || 0),
  categories: normalizeCategories(styleLibrary),
  styles: Array.isArray(styleLibrary.styles) ? styleLibrary.styles : [],
  scenes: Array.isArray(styleLibrary.scenes) ? styleLibrary.scenes : [],
  templates: normalizeTemplates(styleLibrary),
  cases: normalizeCases(casesPayload),
});

const sync = async () => {
  const existing = readJsonIfExists(OUTPUT_PATH);
  const seed = readJsonIfExists(SEED_PATH);

  try {
    let casesPayload;
    let styleLibrary;

    try {
      [casesPayload, styleLibrary] = await Promise.all([
        fetchJson(rawUrlFor(DATA_FILES.cases)),
        fetchJson(rawUrlFor(DATA_FILES.styleLibrary)),
      ]);
    } catch (remoteError) {
      console.warn(
        "[sync-gpt-image-inspiration] remote fetch failed, trying local repo fallback:",
        remoteError instanceof Error ? remoteError.message : remoteError,
      );
      casesPayload = readLocalJson(DATA_FILES.cases);
      styleLibrary = readLocalJson(DATA_FILES.styleLibrary);
    }

    const payload = buildPayload(casesPayload, styleLibrary);

    writePayload(payload);
    console.log(
      `[sync-gpt-image-inspiration] wrote ${path.relative(process.cwd(), OUTPUT_PATH)} with ${payload.cases.length} cases and ${payload.templates.length} templates`,
    );
  } catch (error) {
    if (existing) {
      writePayload(withStaleFlag(existing, error));
      console.warn(
        "[sync-gpt-image-inspiration] remote sync failed, kept existing payload:",
        error instanceof Error ? error.message : error,
      );
      return;
    }

    if (seed) {
      writePayload(withStaleFlag(seed, error));
      console.warn(
        "[sync-gpt-image-inspiration] remote sync failed, used seed payload:",
        error instanceof Error ? error.message : error,
      );
      return;
    }

    throw error;
  }
};

sync().catch((error) => {
  console.error("[sync-gpt-image-inspiration] failed:", error);
  process.exitCode = 1;
});
