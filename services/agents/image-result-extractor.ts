import type { GeneratedAsset } from '../../types/agent.types';
import { extractImageUrlsFromResult } from '../image-generation/core/image-result-extractor.ts';

export { extractImageUrlsFromResult };

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
