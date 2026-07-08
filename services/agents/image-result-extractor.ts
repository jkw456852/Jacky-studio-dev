import type { GeneratedAsset } from '../../types/agent.types';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const pushUniqueUrl = (
  bucket: string[],
  seen: Set<string>,
  value: unknown,
) => {
  if (!isNonEmptyString(value)) return;
  const normalized = value.trim();
  if (seen.has(normalized)) return;
  seen.add(normalized);
  bucket.push(normalized);
};

export const extractImageUrlsFromResult = (result: unknown): string[] => {
  const urls: string[] = [];
  const seen = new Set<string>();

  if (isNonEmptyString(result)) {
    pushUniqueUrl(urls, seen, result);
    return urls;
  }

  if (!result || typeof result !== 'object') {
    return urls;
  }

  const record = result as Record<string, unknown>;

  pushUniqueUrl(urls, seen, record.url);
  pushUniqueUrl(urls, seen, record.imageUrl);
  pushUniqueUrl(urls, seen, record.anchorUrl);
  pushUniqueUrl(urls, seen, record.editedImage);
  pushUniqueUrl(urls, seen, record.resultImage);
  pushUniqueUrl(urls, seen, record.anchorSheetUrl);

  if (Array.isArray(record.imageUrls)) {
    for (const item of record.imageUrls) {
      pushUniqueUrl(urls, seen, item);
    }
  }

  if (Array.isArray(record.images)) {
    for (const item of record.images) {
      if (isNonEmptyString(item)) {
        pushUniqueUrl(urls, seen, item);
        continue;
      }
      if (item && typeof item === 'object') {
        const imageRecord = item as Record<string, unknown>;
        pushUniqueUrl(urls, seen, imageRecord.url);
        pushUniqueUrl(urls, seen, imageRecord.imageUrl);
      }
    }
  }

  return urls;
};

export const buildImageAssetsFromSkillResults = (
  skillCalls: Array<{
    skillName?: unknown;
    success?: boolean;
    result?: unknown;
    params?: Record<string, unknown>;
  }>,
  agentId: GeneratedAsset['metadata']['agentId'],
): GeneratedAsset[] => {
  const assets: GeneratedAsset[] = [];
  const seen = new Set<string>();

  for (const call of skillCalls || []) {
    if (!call?.success) continue;

    const urls = extractImageUrlsFromResult(call.result);
    for (const url of urls) {
      if (seen.has(url)) continue;
      seen.add(url);
      assets.push({
        id: `asset-${Date.now()}-${Math.random()}`,
        type: 'image',
        url,
        metadata: {
          prompt:
            String(call.params?.prompt || call.params?.editType || '').trim() ||
            undefined,
          model: String(call.params?.model || 'edit').trim() || 'edit',
          agentId,
        },
      });
    }
  }

  return assets;
};
