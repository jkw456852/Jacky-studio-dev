import {
  customSkillMarkdownAssetToConfig,
  type CustomSkillConfigRecord,
  type CustomSkillMarkdownAsset,
} from './custom-skill-markdown.ts';

export interface MergedCustomSkillRecord {
  id: string;
  asset: CustomSkillMarkdownAsset | null;
  config: CustomSkillConfigRecord;
  sourceStatus:
    | 'markdown-backed'
    | 'runtime-only'
    | 'missing-markdown-asset';
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isMarkdownBackedRuntimeConfig = (value: unknown): boolean => {
  if (!isObjectRecord(value)) return false;
  return (
    String(value.storageFormat || '').trim() === 'markdown-file' ||
    String(value.markdownAssetId || '').trim().length > 0 ||
    String(value.markdownAssetPath || '').trim().length > 0
  );
};

export const mergeCustomSkillConfigRecord = (args: {
  asset?: CustomSkillMarkdownAsset | null;
  runtimeConfig?: Record<string, unknown> | null;
}): CustomSkillConfigRecord => {
  const fileConfig = args.asset ? customSkillMarkdownAssetToConfig(args.asset) : {};
  const runtimeConfig =
    args.runtimeConfig && isObjectRecord(args.runtimeConfig) ? args.runtimeConfig : {};

  return {
    ...fileConfig,
    ...runtimeConfig,
    ...fileConfig,
    ...(args.asset?.id ? { markdownAssetId: args.asset.id } : {}),
    ...(args.asset?.filePath ? { markdownAssetPath: args.asset.filePath } : {}),
    isCustomSkill: true,
  };
};

export const listMergedCustomSkillRecords = (args: {
  assets: CustomSkillMarkdownAsset[];
  runtimeCustomConfigs?: Record<string, Record<string, unknown>> | null;
}): MergedCustomSkillRecord[] => {
  const assets = Array.isArray(args.assets) ? args.assets : [];
  const runtimeConfigs = args.runtimeCustomConfigs || {};
  const records = new Map<string, MergedCustomSkillRecord>();

  assets.forEach((asset) => {
    if (!asset?.id) return;
    records.set(asset.id, {
      id: asset.id,
      asset,
      config: mergeCustomSkillConfigRecord({
        asset,
        runtimeConfig: runtimeConfigs[asset.id],
      }),
      sourceStatus: 'markdown-backed',
    });
  });

  Object.entries(runtimeConfigs).forEach(([skillId, runtimeConfig]) => {
    if (!skillId || records.has(skillId)) return;
    const sourceStatus = isMarkdownBackedRuntimeConfig(runtimeConfig)
      ? 'missing-markdown-asset'
      : 'runtime-only';
    records.set(skillId, {
      id: skillId,
      asset: null,
      config: mergeCustomSkillConfigRecord({
        runtimeConfig,
      }),
      sourceStatus,
    });
  });

  return [...records.values()];
};

export const resolveMergedCustomSkillRecord = (args: {
  skillId: string;
  assets: CustomSkillMarkdownAsset[];
  runtimeCustomConfigs?: Record<string, Record<string, unknown>> | null;
}): MergedCustomSkillRecord | null => {
  const normalizedId = String(args.skillId || '').trim();
  if (!normalizedId) return null;

  const asset = (Array.isArray(args.assets) ? args.assets : []).find(
    (item) => item?.id === normalizedId,
  );
  const runtimeConfig = args.runtimeCustomConfigs?.[normalizedId];
  if (!asset && !runtimeConfig) return null;

  return {
    id: normalizedId,
    asset: asset || null,
    config: mergeCustomSkillConfigRecord({
      asset,
      runtimeConfig,
    }),
    sourceStatus: asset
      ? 'markdown-backed'
      : isMarkdownBackedRuntimeConfig(runtimeConfig)
        ? 'missing-markdown-asset'
        : 'runtime-only',
  };
};

export const listMissingMarkdownAssetSkillIds = (args: {
  assets: CustomSkillMarkdownAsset[];
  runtimeCustomConfigs?: Record<string, Record<string, unknown>> | null;
}): string[] =>
  listMergedCustomSkillRecords(args)
    .filter((record) => record.sourceStatus === 'missing-markdown-asset')
    .map((record) => record.id);

export const upsertCustomSkillMarkdownAsset = (args: {
  assets: CustomSkillMarkdownAsset[];
  asset: CustomSkillMarkdownAsset;
}): CustomSkillMarkdownAsset[] => {
  const nextAsset = args.asset;
  if (!nextAsset?.id) return Array.isArray(args.assets) ? [...args.assets] : [];

  const existing = Array.isArray(args.assets) ? args.assets : [];
  const withoutCurrent = existing.filter((item) => item?.id !== nextAsset.id);
  return [nextAsset, ...withoutCurrent].sort((left, right) => {
    const leftTime = Number(left?.updatedAt || left?.distilledAt || left?.createdAt || 0);
    const rightTime = Number(right?.updatedAt || right?.distilledAt || right?.createdAt || 0);
    return rightTime - leftTime;
  });
};

export const mergePersistedCustomSkillConfig = (args: {
  asset: CustomSkillMarkdownAsset;
  runtimeConfig?: Record<string, unknown> | null;
}): CustomSkillConfigRecord =>
  mergeCustomSkillConfigRecord({
    asset: args.asset,
    runtimeConfig: args.runtimeConfig || customSkillMarkdownAssetToConfig(args.asset),
  });
