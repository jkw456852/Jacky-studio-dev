export type LocalizedText = {
  en: string;
  zh: string;
};

export type GptImageInspirationCase = {
  id: number;
  title: string;
  image: string;
  imageAlt: string;
  sourceLabel: string;
  sourceUrl: string;
  prompt: string;
  promptPreview: string;
  category: string;
  styles: string[];
  scenes: string[];
  featured: boolean;
  githubUrl: string;
};

export type GptImageInspirationCategory = {
  id: string;
  value: string;
  anchor: string;
  templateAnchor: string;
  cover: string;
  title: LocalizedText;
  description: LocalizedText;
};

export type GptImageInspirationFacet = {
  id: string;
  value: string;
  title: LocalizedText;
  keywords?: string[];
};

export type GptImageInspirationTemplate = {
  id: string;
  anchor: string;
  cover: string;
  title: LocalizedText;
  description: LocalizedText;
  category: string;
  styles: string[];
  scenes: string[];
  tags: string[];
  useWhen: LocalizedText;
  guidance: LocalizedText | { en: string[]; zh: string[] };
  pitfalls: LocalizedText | { en: string[]; zh: string[] };
  exampleCases: number[];
};

export type GptImageInspirationSupplementalSource = {
  id: string;
  title: string;
  repoUrl: string;
  homepage?: string;
  itemCount: number;
  mode: "gallery-cards" | "reference-only";
  note?: string;
};

export type GptImageInspirationPayload = {
  version: number;
  generatedAt: string;
  stale?: boolean;
  staleReason?: string;
  source: {
    siteUrl: string;
    repoUrl: string;
    owner: string;
    repo: string;
    branch: string;
  };
  repository: string;
  templateDocument: string;
  totalCases: number;
  categories: GptImageInspirationCategory[];
  styles: GptImageInspirationFacet[];
  scenes: GptImageInspirationFacet[];
  templates: GptImageInspirationTemplate[];
  cases: GptImageInspirationCase[];
  supplementalSources?: GptImageInspirationSupplementalSource[];
};

const GPT_IMAGE_INSPIRATION_ASSET_URL =
  "/runtime-assets/gpt-image-inspiration.json";

export const GPT_IMAGE_INSPIRATION_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

const createRandomSeed = (): number => {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    return crypto.getRandomValues(new Uint32Array(1))[0] || Date.now();
  }
  return Math.floor(Math.random() * 0xffffffff) ^ Date.now();
};

const createSeededRandom = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};

export const createGptImageInspirationShuffleSeed = (): number =>
  createRandomSeed();

export const shuffleGptImageInspirationCases = (
  cases: readonly GptImageInspirationCase[],
  seed: number,
): GptImageInspirationCase[] => {
  const next = [...cases];
  const random = createSeededRandom(seed);
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
};

export const fetchGptImageInspiration =
  async (): Promise<GptImageInspirationPayload> => {
    const requestUrl = `${GPT_IMAGE_INSPIRATION_ASSET_URL}?v=${Date.now()}`;
    const response = await fetch(requestUrl, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
      },
    });
    if (!response.ok) {
      throw new Error(
        `Failed to load GPT image inspiration payload: ${response.status}`,
      );
    }
    return response.json();
  };

export const buildGptImageInspirationImageCandidates = (src: string): string[] => {
  const normalized = String(src || "").trim();
  if (!normalized) return [];

  const candidates: string[] = [];

  try {
    const parsed = new URL(normalized);
    if (parsed.hostname === "raw.githubusercontent.com") {
      const [owner, repo, branch, ...pathParts] = parsed.pathname
        .replace(/^\/+/, "")
        .split("/");
      if (owner && repo && branch && pathParts.length > 0) {
        const assetPath = pathParts.join("/");
        candidates.push(`https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${assetPath}`);
        candidates.push(normalized);
        candidates.push(`https://github.com/${owner}/${repo}/raw/${branch}/${assetPath}`);
      }
    } else {
      candidates.push(normalized);
    }
  } catch {
    return [normalized];
  }

  return [...new Set(candidates.filter(Boolean))];
};
