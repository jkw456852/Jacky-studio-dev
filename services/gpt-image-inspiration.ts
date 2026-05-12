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
};

const GPT_IMAGE_INSPIRATION_ASSET_URL =
  "/runtime-assets/gpt-image-inspiration.json";

export const fetchGptImageInspiration =
  async (): Promise<GptImageInspirationPayload> => {
    const response = await fetch(GPT_IMAGE_INSPIRATION_ASSET_URL, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(
        `Failed to load GPT image inspiration payload: ${response.status}`,
      );
    }
    return response.json();
  };

