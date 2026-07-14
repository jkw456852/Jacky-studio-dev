import fs from "node:fs";
import path from "node:path";

const PRIMARY_SOURCE = {
  id: "freestylefly-awesome-gpt-image-2",
  title: "awesome-gpt-image-2",
  owner: "freestylefly",
  repo: "awesome-gpt-image-2",
  branch: "main",
  siteUrl: "https://gpt-image2.canghe.ai/",
};

const REPO_URL = `https://github.com/${PRIMARY_SOURCE.owner}/${PRIMARY_SOURCE.repo}`;
const OUTPUT_PATH = path.join(
  process.cwd(),
  "public",
  "runtime-assets",
  "gpt-image-inspiration.json",
);
const LOCAL_REPO_PATH = path.join(
  process.cwd(),
  "tmp",
  `${PRIMARY_SOURCE.repo}-${PRIMARY_SOURCE.branch}`,
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

const SUPPLEMENTAL_SOURCES = [
  {
    id: "davidwuw0811-boop-awesome-gpt-image2-prompts",
    title: "Awesome GPT Image2 Prompts",
    repo: "davidwuw0811-boop/awesome-gpt-image2-prompts",
    homepage: "https://davidwuw0811-boop.github.io/awesome-gpt-image2-prompts/",
    loader: "json-prompts",
    path: "prompts.json",
  },
  {
    id: "zerolu-awesome-gpt-image",
    title: "Awesome GPT Image",
    repo: "ZeroLu/awesome-gpt-image",
    homepage: "https://cyberbara.com/gpt-image-prompt-library",
    loader: "page-bundle-gallery",
    parser: "zerolu",
  },
  {
    id: "imgedify-awesome-gpt4o-image-prompts",
    title: "Awesome GPT4o Image Prompts",
    repo: "ImgEdify/Awesome-GPT4o-Image-Prompts",
    homepage: "https://imgedify.com/explore",
    loader: "html-gallery",
    urls: [
      "https://cdn.jsdelivr.net/gh/ImgEdify/Awesome-GPT4o-Image-Prompts@main/Prompts.html",
      "https://raw.githubusercontent.com/ImgEdify/Awesome-GPT4o-Image-Prompts/main/Prompts.html",
    ],
    parser: "imgedify",
  },
  {
    id: "youmind-openlab-awesome-gpt-image-2",
    title: "Awesome GPT Image 2",
    repo: "YouMind-OpenLab/awesome-gpt-image-2",
    homepage: "https://youmind.com/gpt-image-2-prompts",
    loader: "readme-gallery",
    readmePath: "README.md",
    parser: "youmind-gpt-image-2",
  },
  {
    id: "youmind-openlab-awesome-nano-banana-pro-prompts",
    title: "Awesome Nano Banana Pro Prompts",
    repo: "YouMind-OpenLab/awesome-nano-banana-pro-prompts",
    homepage: "https://youmind.com/en-US/nano-banana-pro-prompts",
    loader: "readme-gallery",
    readmePath: "README.md",
    parser: "youmind-nano-banana",
  },
  {
    id: "unknowlei-nanobanana-website",
    title: "Nano Banana Website",
    repo: "unknowlei/nanobanana-website",
    homepage: "https://nanobanana-website.vercel.app",
    loader: "remote-json",
    urls: [
      "https://cdn.jsdelivr.net/gh/unknowlei/nanobanana-website@main/public/data.json",
      "https://nanobanana-website.vercel.app/data.json",
    ],
    parser: "nanobanana",
  },
];

const PASSIVE_SOURCES = [
  {
    id: "basketikun-infinite-canvas",
    title: "Infinite Canvas",
    repo: "basketikun/infinite-canvas",
    homepage: "https://canvas.best",
    itemCount: 0,
    note: "Provides integration ideas and UI references, but not a prompt corpus suitable for direct gallery-card ingestion.",
  },
];

const GITHUB_API_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "Jacky-Studio-GptImageInspirationSync/3.0",
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

const readLocalJson = (filePath) => {
  const fullPath = path.join(LOCAL_REPO_PATH, filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Local fallback file not found: ${fullPath}`);
  }
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
};

const withStaleFlag = (payload, reason) => ({
  ...payload,
  generatedAt: payload.generatedAt || new Date().toISOString(),
  stale: true,
  staleReason: reason instanceof Error ? reason.message : String(reason),
});

const fetchText = async (url) => {
  const response = await fetch(url, { headers: GITHUB_API_HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to fetch text from ${url}: ${response.status}`);
  }
  return response.text();
};

const fetchJsonFromUrls = async (urls) => {
  let lastError = null;
  for (const url of urls) {
    try {
      return JSON.parse(await fetchText(url));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No JSON source URL available");
};

const fetchGitHubContent = async (repo, filePath) => {
  const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;
  const response = await fetch(url, { headers: GITHUB_API_HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub content ${repo}/${filePath}: ${response.status}`);
  }
  const payload = await response.json();
  const encoded = String(payload?.content || "").replace(/\s+/g, "");
  if (encoded) {
    return Buffer.from(encoded, "base64").toString("utf8");
  }
  if (payload?.download_url) {
    return fetchText(payload.download_url);
  }
  throw new Error(`GitHub content payload for ${repo}/${filePath} is empty`);
};

const fetchGitHubJson = async (repo, filePath) =>
  JSON.parse(await fetchGitHubContent(repo, filePath));

const fetchPrimaryJson = async (filePath) =>
  fetchJsonFromUrls([
    `https://cdn.jsdelivr.net/gh/${PRIMARY_SOURCE.owner}/${PRIMARY_SOURCE.repo}@${PRIMARY_SOURCE.branch}/${filePath}`,
    `https://raw.githubusercontent.com/${PRIMARY_SOURCE.owner}/${PRIMARY_SOURCE.repo}/${PRIMARY_SOURCE.branch}/${filePath}`,
  ]);

const rawPrimaryAssetUrlFor = (assetPath) => {
  const normalized = String(assetPath || "").replace(/^\/+/, "");
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `https://raw.githubusercontent.com/${PRIMARY_SOURCE.owner}/${PRIMARY_SOURCE.repo}/${PRIMARY_SOURCE.branch}/data/${normalized}`;
};

const cdnRepoAssetUrlFor = (repo, assetPath) => {
  const normalized = String(assetPath || "").replace(/^\/+/, "");
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `https://cdn.jsdelivr.net/gh/${repo}@main/${normalized}`;
};

const normalizePrimaryCases = (casesPayload) => {
  const cases = Array.isArray(casesPayload?.cases) ? casesPayload.cases : [];
  return cases.map((item) => ({
    ...item,
    image: rawPrimaryAssetUrlFor(item.image),
  }));
};

const normalizePrimaryCategories = (styleLibrary) => {
  const categories = Array.isArray(styleLibrary?.categories)
    ? styleLibrary.categories
    : [];
  return categories.map((item) => ({
    ...item,
    cover: rawPrimaryAssetUrlFor(item.cover),
  }));
};

const normalizePrimaryTemplates = (styleLibrary) => {
  const templates = Array.isArray(styleLibrary?.templates)
    ? styleLibrary.templates
    : [];
  return templates.map((item) => ({
    ...item,
    cover: rawPrimaryAssetUrlFor(item.cover),
  }));
};

const normalizePrimaryCasesFromPayload = (payload) => {
  const cases = Array.isArray(payload?.cases) ? payload.cases : [];
  return cases.map((item) => ({
    ...item,
    image: rawPrimaryAssetUrlFor(item.image),
  }));
};

const normalizePrimaryCategoriesFromPayload = (payload) => {
  const categories = Array.isArray(payload?.categories) ? payload.categories : [];
  return categories.map((item) => ({
    ...item,
    cover: rawPrimaryAssetUrlFor(item.cover),
  }));
};

const normalizePrimaryTemplatesFromPayload = (payload) => {
  const templates = Array.isArray(payload?.templates) ? payload.templates : [];
  return templates.map((item) => ({
    ...item,
    cover: rawPrimaryAssetUrlFor(item.cover),
  }));
};

const stripMarkdown = (value) =>
  String(value || "")
    .replace(/!\[[^\]]*]\(([^)]+)\)/g, " ")
    .replace(/<img[^>]*>/gi, " ")
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1")
    .replace(/[`*_>#-]+/g, " ")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const makePromptPreview = (...candidates) => {
  for (const candidate of candidates) {
    const cleaned = stripMarkdown(candidate);
    if (cleaned) {
      return cleaned.length > 180 ? `${cleaned.slice(0, 177).trim()}...` : cleaned;
    }
  }
  return "";
};

const unique = (items) => [...new Set(items.filter(Boolean))];

const inferTaxonomy = ({ title, prompt, categoryKey = "", sourceId = "" }) => {
  const haystack = `${title} ${prompt} ${categoryKey} ${sourceId}`.toLowerCase();
  const styles = [];
  const scenes = [];
  let category = "Other Use Cases";

  const hasAny = (...keywords) => keywords.some((keyword) => haystack.includes(keyword));

  if (hasAny("ui", "dashboard", "app", "web design", "interface", "game ui", "live stream")) {
    category = "UI & Interfaces";
    styles.push("UI");
    scenes.push(hasAny("social", "live stream") ? "Social" : "Tech");
  } else if (hasAny("infographic", "diagram", "map", "schematic", "blueprint", "document", "passport", "slide")) {
    category = hasAny("document", "passport", "slide")
      ? "Documents & Publishing"
      : "Charts & Infographics";
    styles.push(hasAny("document", "passport") ? "Documents" : "Infographic");
    scenes.push(hasAny("education", "explainer", "map", "diagram", "slide") ? "Education" : "Creative");
  } else if (hasAny("poster", "typography", "magazine cover", "flyer", "quote card", "card")) {
    category = "Posters & Typography";
    styles.push("Poster");
    scenes.push(hasAny("fashion", "magazine") ? "Fashion" : "Creative");
  } else if (hasAny("product", "e-commerce", "detail page", "packaging", "marketing", "advertisement", "claw machine")) {
    category = "Products & E-commerce";
    styles.push("Product");
    scenes.push("Commerce");
  } else if (hasAny("brand", "logo", "identity")) {
    category = "Brand & Logos";
    styles.push("Brand");
    scenes.push("Commerce");
  } else if (hasAny("architecture", "interior", "store", "space", "building")) {
    category = "Architecture & Spaces";
    styles.push("Architecture");
    scenes.push("Creative");
  } else if (hasAny("portrait", "photo", "photograph", "iphone", "realistic", "cinematic")) {
    category = "Photography & Realism";
    styles.push("Photography");
    if (hasAny("realistic", "photo", "photograph", "iphone")) {
      styles.push("Realistic");
    }
    scenes.push(hasAny("fashion", "portrait") ? "Fashion" : "Social");
  } else if (hasAny("character", "avatar", "emoji", "illustration", "anime", "3d", "sculpture", "cute")) {
    category = hasAny("character", "avatar", "portrait", "emoji")
      ? "Characters & People"
      : "Illustration & Art";
    styles.push(hasAny("character", "avatar", "emoji") ? "Character" : "Illustration");
    if (hasAny("3d", "emoji", "cute", "miniature")) {
      styles.push("3D");
    }
    scenes.push("Creative");
  } else if (hasAny("history", "ancient", "wuxia", "classical", "dynasty")) {
    category = "History & Classical Themes";
    styles.push("History", "Classical");
    scenes.push("History");
  } else if (hasAny("scene", "story", "comic", "storyboard", "fantasy", "travel", "food")) {
    category = "Scenes & Storytelling";
    styles.push("Scenes");
    if (hasAny("food")) scenes.push("Food");
    if (hasAny("travel")) scenes.push("Travel");
    if (hasAny("story", "comic", "fantasy")) scenes.push("Story");
  }

  if (!styles.length) styles.push("Other Use Cases");
  if (!scenes.length) scenes.push("Creative");

  return {
    category,
    styles: unique(styles),
    scenes: unique(scenes),
  };
};

const buildSupplementalCase = ({
  id,
  title,
  image,
  prompt,
  promptPreview,
  sourceLabel,
  sourceUrl,
  githubUrl,
  categoryKey,
  sourceId,
}) => {
  const taxonomy = inferTaxonomy({
    title,
    prompt,
    categoryKey,
    sourceId,
  });

  return {
    id,
    title: title || `Case ${id}`,
    image,
    imageAlt: title || `Case ${id}`,
    sourceLabel: sourceLabel || "Supplemental Source",
    sourceUrl: sourceUrl || githubUrl || "",
    prompt: String(prompt || "").trim(),
    promptPreview: makePromptPreview(promptPreview, prompt, title),
    category: taxonomy.category,
    styles: taxonomy.styles,
    scenes: taxonomy.scenes,
    featured: false,
    githubUrl: githubUrl || sourceUrl || "",
  };
};

const parseMarkdownImages = (block) => {
  const results = [];
  const htmlImageMatches = block.matchAll(/<img[^>]+src="([^"]+)"/gi);
  for (const match of htmlImageMatches) {
    const src = String(match[1] || "").trim();
    if (src) results.push(src);
  }
  const markdownImageMatches = block.matchAll(/!\[[^\]]*]\(([^)]+)\)/g);
  for (const match of markdownImageMatches) {
    const src = String(match[1] || "").trim();
    if (src) results.push(src);
  }
  return results.filter((src) => !/badge|shields\.io/i.test(src));
};

const parseZeroLuReadme = (readmeText, sourceConfig, nextIdRef) => {
  const sections = [];
  const sectionRegex = /^##\s+(.+?)\n([\s\S]*?)(?=^##\s+|(?![\s\S]))/gm;
  for (const sectionMatch of readmeText.matchAll(sectionRegex)) {
    const sectionTitle = stripMarkdown(sectionMatch[1]);
    const sectionBody = sectionMatch[2];
    if (
      !sectionTitle ||
      /table of contents|resources|contributing|why gpt image 2/i.test(sectionTitle)
    ) {
      continue;
    }
    sections.push({ sectionTitle, sectionBody });
  }

  const cases = [];
  for (const section of sections) {
    const itemRegex = /^###\s+(.+?)\n([\s\S]*?)(?=^###\s+|^##\s+|(?![\s\S]))/gm;
    for (const itemMatch of section.sectionBody.matchAll(itemRegex)) {
      const title = stripMarkdown(itemMatch[1]);
      const block = itemMatch[2];
      const promptMatch = block.match(/\*\*Prompt:\*\*\s*```(?:text)?\n([\s\S]*?)\n```/i);
      if (!title || !promptMatch?.[1]) continue;
      const images = parseMarkdownImages(block).map((item) =>
        cdnRepoAssetUrlFor(sourceConfig.repo, item),
      );
      const sourceMatch =
        block.match(/\*\*Source:\*\*\s*\[(.+?)]\((.+?)\)/i) ||
        block.match(/\*Source:\s*\[(.+?)]\((.+?)\)\*/i);
      const prompt = promptMatch[1].trim();
      const description = stripMarkdown(block.split(/\*\*Prompt:\*\*/i)[0]);
      const image = images[0] || "";
      if (!image) continue;
      cases.push(
        buildSupplementalCase({
          id: nextIdRef.current++,
          title,
          image,
          prompt,
          promptPreview: description || prompt,
          sourceLabel: sourceMatch?.[1] || sourceConfig.title,
          sourceUrl: sourceMatch?.[2] || sourceConfig.homepage,
          githubUrl: sourceConfig.homepage || `https://github.com/${sourceConfig.repo}`,
          categoryKey: section.sectionTitle,
          sourceId: sourceConfig.id,
        }),
      );
    }
  }
  return cases;
};

const extractBracketedArray = (sourceText, marker) => {
  const markerIndex = sourceText.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error(`Marker not found: ${marker}`);
  }

  const startIndex = markerIndex + marker.length - 1;
  let depth = 0;
  let inString = false;
  let stringQuote = "";
  let escaped = false;

  for (let index = startIndex; index < sourceText.length; index += 1) {
    const character = sourceText[index];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === stringQuote) {
        inString = false;
        stringQuote = "";
      }
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      inString = true;
      stringQuote = character;
      continue;
    }

    if (character === "[") {
      depth += 1;
      continue;
    }

    if (character === "]") {
      depth -= 1;
      if (depth === 0) {
        return sourceText.slice(startIndex, index + 1);
      }
    }
  }

  throw new Error(`Array not closed for marker: ${marker}`);
};

const parseZeroLuBundle = (bundleText, sourceConfig, nextIdRef) => {
  const rawArray = extractBracketedArray(bundleText, "let p=[");
  const executableArray = rawArray.replace(
    /h\("([^"]+)"\)/g,
    '"https://raw.githubusercontent.com/ZeroLu/awesome-gpt-image/main/$1"',
  );
  const prompts = Function(`return (${executableArray});`)();
  if (!Array.isArray(prompts)) {
    throw new Error("Cyberbara prompt library payload is not an array");
  }

  const cases = [];
  for (const promptItem of prompts) {
    const slides = Array.isArray(promptItem?.slides) ? promptItem.slides : [];
    const sources = Array.isArray(promptItem?.sources) ? promptItem.sources : [];
    const primarySource = sources[0] || {};
    for (const [slideIndex, slide] of slides.entries()) {
      const image = String(slide?.imageUrl || "").trim();
      const prompt = String(promptItem?.prompt || "").trim();
      const titleBase = stripMarkdown(promptItem?.title || promptItem?.id || "");
      const slideTitle = stripMarkdown(slide?.title || "");
      if (!image || !prompt || !titleBase) continue;

      const title =
        slideTitle && slideTitle !== titleBase
          ? `${titleBase} - ${slideTitle}`
          : titleBase;

      cases.push(
        buildSupplementalCase({
          id: nextIdRef.current++,
          title,
          image,
          prompt,
          promptPreview: prompt,
          sourceLabel: primarySource.label || sourceConfig.title,
          sourceUrl: primarySource.url || sourceConfig.homepage,
          githubUrl: sourceConfig.homepage || `https://github.com/${sourceConfig.repo}`,
          categoryKey: stripMarkdown(promptItem?.category || ""),
          sourceId: `${sourceConfig.id}-${slideIndex}`,
        }),
      );
    }
  }

  return cases;
};

const parseImgEdifyReadme = (readmeText, sourceConfig, nextIdRef) => {
  const cases = [];
  const itemRegex = /^###\s+(.+?)\n([\s\S]*?)(?=^###\s+|(?![\s\S]))/gm;
  for (const itemMatch of readmeText.matchAll(itemRegex)) {
    const title = stripMarkdown(itemMatch[1]);
    const block = itemMatch[2];
    if (!title || /^table of contents$/i.test(title)) continue;
    const promptMatch = block.match(/- \*\*Prompt Text:\*\*\s*`([\s\S]*?)`\s*- \*\*Example Image:\*\*/i);
    const imageMatch = block.match(/<img[^>]+src="([^"]+)"/i);
    if (!promptMatch?.[1] || !imageMatch?.[1]) continue;
    const authorMatch = block.match(/- \*\*Author:\*\*\s*\[(.+?)]\((.+?)\)/i);
    const description = stripMarkdown(block.split(/- \*\*Model:\*\*/i)[0]);
    cases.push(
      buildSupplementalCase({
        id: nextIdRef.current++,
        title,
        image: imageMatch[1].trim(),
        prompt: promptMatch[1].trim(),
        promptPreview: description,
        sourceLabel: authorMatch?.[1] || sourceConfig.title,
        sourceUrl: authorMatch?.[2] || sourceConfig.homepage,
        githubUrl: sourceConfig.homepage || `https://github.com/${sourceConfig.repo}`,
        categoryKey: title,
        sourceId: sourceConfig.id,
      }),
    );
  }
  return cases;
};

const parseImgEdifyHtml = (htmlText, sourceConfig, nextIdRef) => {
  const cases = [];
  const articles = htmlText
    .split(/<article\b/i)
    .slice(1)
    .map((item) => `<article${item}`);

  for (const article of articles) {
    const title = stripMarkdown(article.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || "");
    const image = String(article.match(/<img[^>]+src="([^"]+)"/i)?.[1] || "").trim();
    const paragraphs = [...article.matchAll(/<p[^>]*class="[^"]*text-gray-600[^"]*"[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((match) => stripMarkdown(match[1]))
      .filter(Boolean);
    const summary = paragraphs[0] || "";
    const prompt = paragraphs[paragraphs.length - 1] || "";
    const authorAnchorMatch = article.match(
      /<a href="([^"]+)"[\s\S]*?class="text-blue-600 hover:text-blue-800"[\s\S]*?>\s*([^<]+)\s*<\/a>/i,
    );
    const sourceUrl = String(authorAnchorMatch?.[1] || sourceConfig.homepage || "").trim();
    const sourceLabel = stripMarkdown(authorAnchorMatch?.[2]) || sourceConfig.title;
    if (!title || !image || !prompt) continue;
    cases.push(
      buildSupplementalCase({
        id: nextIdRef.current++,
        title,
        image,
        prompt,
        promptPreview: summary || prompt,
        sourceLabel,
        sourceUrl,
        githubUrl: sourceConfig.homepage || `https://github.com/${sourceConfig.repo}`,
        categoryKey: title,
        sourceId: sourceConfig.id,
      }),
    );
  }
  return cases;
};

const parseYouMindReadme = (readmeText, sourceConfig, nextIdRef) => {
  const cases = [];
  const itemRegex = /^###\s+No\.\s+\d+:\s+(.+?)\n([\s\S]*?)(?=^###\s+No\.|(?![\s\S]))/gm;
  for (const itemMatch of readmeText.matchAll(itemRegex)) {
    const title = stripMarkdown(itemMatch[1]);
    const block = itemMatch[2];
    const descriptionMatch = block.match(/#### .*?Description\s+([\s\S]*?)\n#### .*?Prompt/i);
    const promptMatch = block.match(/#### .*?Prompt\s+```(?:json|text)?\n([\s\S]*?)\n```/i);
    const image = parseMarkdownImages(block)[0] || "";
    const authorMatch = block.match(/- \*\*Author:\*\*\s*\[(.+?)]\((.+?)\)/i);
    const sourceMatch = block.match(/- \*\*Source:\*\*\s*\[(.+?)]\((.+?)\)/i);
    const tryNowMatch = block.match(/\*\*\[[^\]]*Try it now[^\]]*]\((.+?)\)\*\*/i);
    if (!title || !promptMatch?.[1] || !image) continue;
    cases.push(
      buildSupplementalCase({
        id: nextIdRef.current++,
        title,
        image,
        prompt: promptMatch[1].trim(),
        promptPreview: descriptionMatch?.[1] || promptMatch[1],
        sourceLabel: authorMatch?.[1] || sourceConfig.title,
        sourceUrl: sourceMatch?.[2] || sourceConfig.homepage,
        githubUrl:
          tryNowMatch?.[1] || sourceConfig.homepage || `https://github.com/${sourceConfig.repo}`,
        categoryKey: title,
        sourceId: sourceConfig.id,
      }),
    );
  }
  return cases;
};

const parseDavidPromptJson = (items, sourceConfig, nextIdRef) => {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && item.title_en && item.prompt && item.image)
    .map((item) => {
      const title = [item.title_cn, item.title_en].filter(Boolean).join(" / ");
      const sourceUrl =
        /^https?:\/\//i.test(String(item.source || ""))
          ? item.source
          : item.source && String(item.source).includes("/")
            ? `https://github.com/${item.source}`
            : sourceConfig.homepage;
      return buildSupplementalCase({
        id: nextIdRef.current++,
        title,
        image: cdnRepoAssetUrlFor(sourceConfig.repo, item.image),
        prompt: item.prompt,
        promptPreview: item.note || item.title_en || item.title_cn,
        sourceLabel: item.author || sourceConfig.title,
        sourceUrl,
        githubUrl:
          sourceConfig.homepage ||
          `https://github.com/${sourceConfig.repo}/blob/main/prompts.json`,
        categoryKey: item.category || item.category_cn || "",
        sourceId: sourceConfig.id,
      });
    });
};

const parseNanobananaJson = (payload, sourceConfig, nextIdRef) => {
  const sections = Array.isArray(payload?.sections) ? payload.sections : [];
  const cases = [];
  for (const section of sections) {
    const prompts = Array.isArray(section?.prompts) ? section.prompts : [];
    for (const item of prompts) {
      const images = Array.isArray(item?.images) ? item.images.filter(Boolean) : [];
      const image = String(images[0] || "").trim();
      const prompt = String(item?.content || "").trim();
      const title = stripMarkdown(item?.title || item?.id || "");
      if (!image || !prompt) continue;
      cases.push(
        buildSupplementalCase({
          id: nextIdRef.current++,
          title,
          image,
          prompt,
          promptPreview: item?.notes || prompt,
          sourceLabel: item?.contributor || sourceConfig.title,
          sourceUrl: sourceConfig.homepage,
          githubUrl: sourceConfig.homepage || `https://github.com/${sourceConfig.repo}`,
          categoryKey: stripMarkdown(section?.title || ""),
          sourceId: sourceConfig.id,
        }),
      );
    }
  }
  return cases;
};

const loadSupplementalCases = async (startingId) => {
  const nextIdRef = { current: startingId };
  const allCases = [];
  const caseGroups = [];
  const sourceSummaries = [];

  for (const sourceConfig of SUPPLEMENTAL_SOURCES) {
    let cases = [];
    if (sourceConfig.loader === "json-prompts") {
      const jsonPayload = await fetchGitHubJson(sourceConfig.repo, sourceConfig.path);
      cases = parseDavidPromptJson(jsonPayload, sourceConfig, nextIdRef);
    } else if (sourceConfig.loader === "remote-json") {
      const jsonPayload = await fetchJsonFromUrls(sourceConfig.urls);
      if (sourceConfig.parser === "nanobanana") {
        cases = parseNanobananaJson(jsonPayload, sourceConfig, nextIdRef);
      }
    } else if (sourceConfig.loader === "readme-gallery") {
      const readmeText = await fetchGitHubContent(sourceConfig.repo, sourceConfig.readmePath);
      if (sourceConfig.parser === "zerolu") {
        cases = parseZeroLuReadme(readmeText, sourceConfig, nextIdRef);
      } else if (sourceConfig.parser === "imgedify") {
        cases = parseImgEdifyReadme(readmeText, sourceConfig, nextIdRef);
      } else if (
        sourceConfig.parser === "youmind-gpt-image-2" ||
        sourceConfig.parser === "youmind-nano-banana"
      ) {
        cases = parseYouMindReadme(readmeText, sourceConfig, nextIdRef);
      }
    } else if (sourceConfig.loader === "html-gallery") {
      const htmlText = await fetchText(sourceConfig.urls[0]);
      if (sourceConfig.parser === "imgedify") {
        cases = parseImgEdifyHtml(htmlText, sourceConfig, nextIdRef);
      }
    } else if (sourceConfig.loader === "page-bundle-gallery") {
      const pageHtml = await fetchText(sourceConfig.homepage);
      const chunkMatch = pageHtml.match(
        /\/_next\/static\/chunks\/app\/%5Blocale%5D\/\(landing\)\/gpt-image-prompt-library\/page-[^"' ]+\.js/,
      );
      if (!chunkMatch?.[0]) {
        throw new Error(`Cyberbara bundle chunk not found for ${sourceConfig.homepage}`);
      }
      const chunkUrl = new URL(chunkMatch[0], sourceConfig.homepage).toString();
      const bundleText = await fetchText(chunkUrl);
      if (sourceConfig.parser === "zerolu") {
        cases = parseZeroLuBundle(bundleText, sourceConfig, nextIdRef);
      }
    }

    allCases.push(...cases);
    caseGroups.push({
      sourceId: sourceConfig.id,
      items: cases,
    });
    sourceSummaries.push({
      id: sourceConfig.id,
      title: sourceConfig.title,
      repoUrl: `https://github.com/${sourceConfig.repo}`,
      homepage: sourceConfig.homepage || "",
      itemCount: cases.length,
      mode: "gallery-cards",
    });
  }

  for (const passiveSource of PASSIVE_SOURCES) {
    sourceSummaries.push({
      id: passiveSource.id,
      title: passiveSource.title,
      repoUrl: `https://github.com/${passiveSource.repo}`,
      homepage: passiveSource.homepage,
      itemCount: passiveSource.itemCount,
      mode: "reference-only",
      note: passiveSource.note,
    });
  }

  return {
    cases: allCases,
    caseGroups,
    sourceSummaries,
  };
};

const interleaveCaseGroups = (groups) => {
  const queues = groups
    .map((items) => [...items])
    .filter((items) => items.length > 0);
  const merged = [];
  while (queues.some((items) => items.length > 0)) {
    for (const items of queues) {
      const nextItem = items.shift();
      if (nextItem) merged.push(nextItem);
    }
  }
  return merged;
};

const buildPayload = async (casesPayload, styleLibrary) => {
  const primaryCases = normalizePrimaryCases(casesPayload);
  const maxPrimaryId = primaryCases.reduce(
    (maxValue, item) => Math.max(maxValue, Number(item.id) || 0),
    0,
  );
  const supplemental = await loadSupplementalCases(maxPrimaryId + 1);
  const mergedCases = interleaveCaseGroups([
    primaryCases,
    ...supplemental.caseGroups.map((group) => group.items),
  ]);

  return {
    version: 3,
    generatedAt: new Date().toISOString(),
    source: {
      siteUrl: PRIMARY_SOURCE.siteUrl,
      repoUrl: REPO_URL,
      owner: PRIMARY_SOURCE.owner,
      repo: PRIMARY_SOURCE.repo,
      branch: PRIMARY_SOURCE.branch,
    },
    repository: styleLibrary.repository || REPO_URL,
    templateDocument: styleLibrary.templateDocument || "docs/templates.md",
    totalCases: mergedCases.length,
    categories: normalizePrimaryCategories(styleLibrary),
    styles: Array.isArray(styleLibrary.styles) ? styleLibrary.styles : [],
    scenes: Array.isArray(styleLibrary.scenes) ? styleLibrary.scenes : [],
    templates: normalizePrimaryTemplates(styleLibrary),
    cases: mergedCases,
    supplementalSources: sourceSummariesSorted(supplemental.sourceSummaries),
  };
};

const buildPayloadFromExisting = async (existingPayload) => {
  const primaryCases = normalizePrimaryCasesFromPayload(existingPayload);
  const maxPrimaryId = primaryCases.reduce(
    (maxValue, item) => Math.max(maxValue, Number(item.id) || 0),
    0,
  );
  const supplemental = await loadSupplementalCases(maxPrimaryId + 1);
  const mergedCases = interleaveCaseGroups([
    primaryCases,
    ...supplemental.caseGroups.map((group) => group.items),
  ]);

  return {
    version: 3,
    generatedAt: new Date().toISOString(),
    source: existingPayload?.source || {
      siteUrl: PRIMARY_SOURCE.siteUrl,
      repoUrl: REPO_URL,
      owner: PRIMARY_SOURCE.owner,
      repo: PRIMARY_SOURCE.repo,
      branch: PRIMARY_SOURCE.branch,
    },
    repository: existingPayload?.repository || REPO_URL,
    templateDocument: existingPayload?.templateDocument || "docs/templates.md",
    totalCases: mergedCases.length,
    categories: normalizePrimaryCategoriesFromPayload(existingPayload),
    styles: Array.isArray(existingPayload?.styles) ? existingPayload.styles : [],
    scenes: Array.isArray(existingPayload?.scenes) ? existingPayload.scenes : [],
    templates: normalizePrimaryTemplatesFromPayload(existingPayload),
    cases: mergedCases,
    supplementalSources: sourceSummariesSorted(supplemental.sourceSummaries),
  };
};

const sourceSummariesSorted = (items) =>
  [...items].sort((left, right) => {
    if ((right.itemCount || 0) !== (left.itemCount || 0)) {
      return (right.itemCount || 0) - (left.itemCount || 0);
    }
    return String(left.title || "").localeCompare(String(right.title || ""));
  });

const sync = async () => {
  const existing = readJsonIfExists(OUTPUT_PATH);
  const seed = readJsonIfExists(SEED_PATH);

  try {
    let casesPayload;
    let styleLibrary;
    let payload;

    try {
      [casesPayload, styleLibrary] = await Promise.all([
        fetchPrimaryJson(DATA_FILES.cases),
        fetchPrimaryJson(DATA_FILES.styleLibrary),
      ]);
      payload = await buildPayload(casesPayload, styleLibrary);
    } catch (remoteError) {
      console.warn(
        "[sync-gpt-image-inspiration] primary remote fetch failed, trying local repo fallback:",
        remoteError instanceof Error ? remoteError.message : remoteError,
      );
      try {
        casesPayload = readLocalJson(DATA_FILES.cases);
        styleLibrary = readLocalJson(DATA_FILES.styleLibrary);
        payload = await buildPayload(casesPayload, styleLibrary);
      } catch (localError) {
        if (!existing) {
          throw localError;
        }
        console.warn(
          "[sync-gpt-image-inspiration] local fallback failed, using existing payload as base:",
          localError instanceof Error ? localError.message : localError,
        );
        payload = await buildPayloadFromExisting(existing);
      }
    }
    writePayload(payload);
    console.log(
      `[sync-gpt-image-inspiration] wrote ${path.relative(process.cwd(), OUTPUT_PATH)} with ${payload.cases.length} cases, ${payload.templates.length} templates, and ${payload.supplementalSources.filter((item) => item.itemCount > 0).length} content sources`,
    );
  } catch (error) {
    if (existing) {
      writePayload(withStaleFlag(existing, error));
      console.warn(
        "[sync-gpt-image-inspiration] sync failed, kept existing payload:",
        error instanceof Error ? error.message : error,
      );
      return;
    }

    if (seed) {
      writePayload(withStaleFlag(seed, error));
      console.warn(
        "[sync-gpt-image-inspiration] sync failed, used seed payload:",
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
