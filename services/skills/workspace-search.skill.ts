import {
  extractWebPage,
  type ResearchSearchMode,
  runResearchSearch,
  shouldForceDetailedExtract,
} from '../research/search.service';

export interface WorkspaceSearchSkillParams {
  query: string;
  mode?: ResearchSearchMode;
  includePageExtracts?: boolean;
  maxExtractPages?: number;
}

export interface WorkspaceSearchCitation {
  title: string;
  url: string;
}

export interface WorkspaceSearchExtract {
  title: string;
  url: string;
  excerpt: string;
  cleanedTextExcerpt: string;
  length: number;
  error?: string;
}

export interface WorkspaceSearchSkillResult {
  kind: 'workspace-search-result';
  requestId: string;
  query: string;
  mode: ResearchSearchMode;
  provider?: {
    web?: string;
    images?: string;
    fallback?: boolean;
  };
  fallback: boolean;
  summary: string;
  suggestedQueries: string[];
  webResults: Array<{
    title: string;
    url: string;
    snippet?: string;
    displayUrl?: string;
    siteName?: string;
    excerpt?: string;
    cleanedTextExcerpt?: string;
    length?: number;
  }>;
  imageResults: Array<{
    title: string;
    imageUrl: string;
    sourcePageUrl?: string;
    siteName?: string;
  }>;
  extractedPages: WorkspaceSearchExtract[];
  citations: WorkspaceSearchCitation[];
}

const truncateText = (value: unknown, maxChars: number): string => {
  const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  if (!text) return '';
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}...`;
};

const normalizeMode = (value: unknown): ResearchSearchMode => {
  if (value === 'images' || value === 'web+images') {
    return value;
  }
  return 'web';
};

const normalizeExtractLimit = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 4;
  return Math.max(0, Math.min(4, Math.floor(numeric)));
};

const readDirectExtractFromResult = (item: {
  title?: string;
  url?: string;
  snippet?: string;
  excerpt?: string;
  cleanedTextExcerpt?: string;
  length?: number;
}): WorkspaceSearchExtract | null => {
  const cleanedTextExcerpt = truncateText(item.cleanedTextExcerpt || '', 1200);
  if (!cleanedTextExcerpt) return null;
  return {
    title: item.title || '',
    url: item.url || '',
    excerpt: truncateText(item.excerpt || item.snippet || '', 240),
    cleanedTextExcerpt,
    length:
      typeof item.length === 'number' && Number.isFinite(item.length)
        ? item.length
        : cleanedTextExcerpt.length,
  };
};

const buildSearchSummary = ({
  query,
  providerLabel,
  fallback,
  webResults,
  imageResults,
  extractedPages,
}: {
  query: string;
  providerLabel: string;
  fallback: boolean;
  webResults: WorkspaceSearchSkillResult['webResults'];
  imageResults: WorkspaceSearchSkillResult['imageResults'];
  extractedPages: WorkspaceSearchExtract[];
}): string => {
  const successfulExtracts = extractedPages.filter((item) => !item.error && item.cleanedTextExcerpt);
  const leadingFacts = successfulExtracts.length > 0
    ? successfulExtracts
        .slice(0, 2)
        .map((item, index) => `${index + 1}. ${item.title}：${truncateText(item.cleanedTextExcerpt || item.excerpt, 160)}`)
        .join(' ')
    : webResults
        .slice(0, 3)
        .map((item, index) => `${index + 1}. ${item.title}：${truncateText(item.snippet || '', 120)}`)
        .join(' ');

  return [
    `已完成针对“${query}”的联网搜索。`,
    `来源：${providerLabel}${fallback ? '（回退模式）' : ''}。`,
    `网页结果 ${webResults.length} 条，图片结果 ${imageResults.length} 条，正文提取 ${successfulExtracts.length} 页。`,
    leadingFacts ? `优先线索：${leadingFacts}` : '',
  ]
    .filter(Boolean)
    .join(' ');
};

export async function workspaceSearchSkill(
  params: WorkspaceSearchSkillParams,
): Promise<WorkspaceSearchSkillResult> {
  const query = String(params?.query || '').trim();
  if (!query) {
    throw new Error('workspaceSearch 缺少 query，无法执行联网搜索。');
  }

  const mode = normalizeMode(params?.mode);
  const includePageExtracts = params?.includePageExtracts !== false;
  const maxExtractPages = normalizeExtractLimit(params?.maxExtractPages);

  const searchResult = await runResearchSearch(query, mode);
  const shouldPreferRealExtract = shouldForceDetailedExtract(
    query,
    searchResult?.provider?.web,
  );
  const webResults = (searchResult.web || []).slice(0, 6).map((item) => ({
    title: item.title,
    url: item.url,
    snippet: truncateText(item.snippet || '', 240) || undefined,
    displayUrl: item.displayUrl,
    siteName: item.siteName,
    excerpt: truncateText(item.excerpt || '', 240) || undefined,
    cleanedTextExcerpt: truncateText(item.cleanedTextExcerpt || '', 1200) || undefined,
    length: typeof item.length === 'number' ? item.length : undefined,
  }));
  const imageResults = (searchResult.images || []).slice(0, 6).map((item) => ({
    title: item.title,
    imageUrl: item.imageUrl,
    sourcePageUrl: item.sourcePageUrl,
    siteName: item.siteName,
  }));

  let extractedPages: WorkspaceSearchExtract[] = [];
  if (includePageExtracts && mode !== 'images' && maxExtractPages > 0 && webResults.length > 0) {
    const directExtractedPages = shouldPreferRealExtract
      ? []
      : webResults
          .slice(0, maxExtractPages)
          .map((item) => readDirectExtractFromResult(item))
          .filter((item): item is WorkspaceSearchExtract => Boolean(item));
    const fallbackTargets = shouldPreferRealExtract
      ? webResults.slice(0, maxExtractPages)
      : webResults
          .slice(0, maxExtractPages)
          .filter((item) => !String(item.cleanedTextExcerpt || '').trim());
    const fallbackExtractedPages = await Promise.all(
      fallbackTargets.map(async (item) => {
        try {
          const page = await extractWebPage(item.url, {
            query,
            providerType: searchResult.provider?.web,
          });
          return {
            title: page.title || item.title,
            url: page.url || item.url,
            excerpt: truncateText(page.excerpt || item.snippet || '', 240),
            cleanedTextExcerpt: truncateText(page.cleanedText || '', 1200),
            length: Number(page.length || 0),
          };
        } catch (error) {
          return {
            title: item.title,
            url: item.url,
            excerpt: truncateText(item.snippet || '', 240),
            cleanedTextExcerpt: '',
            length: 0,
            error: truncateText((error as Error)?.message || error, 180) || 'extract_failed',
          };
        }
      }),
    );
    extractedPages = [...directExtractedPages, ...fallbackExtractedPages];
  }

  const providerLabel = [searchResult.provider?.web, searchResult.provider?.images]
    .filter(Boolean)
    .join(' / ') || 'unknown';

  return {
    kind: 'workspace-search-result',
    requestId: searchResult.requestId,
    query,
    mode,
    provider: searchResult.provider,
    fallback: Boolean(searchResult.provider?.fallback),
    summary: buildSearchSummary({
      query,
      providerLabel,
      fallback: Boolean(searchResult.provider?.fallback),
      webResults,
      imageResults,
      extractedPages,
    }),
    suggestedQueries: (searchResult.hints?.suggestedQueries || []).slice(0, 8),
    webResults,
    imageResults,
    extractedPages,
    citations: webResults.map((item) => ({
      title: item.title,
      url: item.url,
    })),
  };
}
