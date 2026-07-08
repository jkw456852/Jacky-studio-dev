import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildCustomSkillMarkdownAsset,
  customSkillMarkdownAssetToConfig,
  parseCustomSkillMarkdownAsset,
  serializeCustomSkillMarkdownAsset,
  type CustomSkillConfigRecord,
  type CustomSkillMarkdownAsset,
} from './custom-skill-markdown.ts';

export const DEFAULT_CUSTOM_SKILL_DIRECTORY = path.join(
  'studio-assets',
  'skills',
  'custom',
);

const sanitizeFileSegment = (value: unknown): string =>
  String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const resolveCustomSkillDirectory = (rootDir = process.cwd()) =>
  path.join(rootDir, DEFAULT_CUSTOM_SKILL_DIRECTORY);

const ensureDirectory = async (dir: string) => {
  await fs.mkdir(dir, { recursive: true });
};

const readDirectoryMdFiles = async (dir: string): Promise<string[]> => {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
      .map((entry) => path.join(dir, entry.name));
  } catch (error: any) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
};

const buildCustomSkillFileName = (asset: CustomSkillMarkdownAsset) => {
  const nameSegment = sanitizeFileSegment(asset.name) || 'custom-skill';
  const idSegment = sanitizeFileSegment(asset.id) || `skill-${Date.now()}`;
  return `${nameSegment}--${idSegment}.md`;
};

const readCustomSkillFile = async (
  filePath: string,
): Promise<CustomSkillMarkdownAsset | null> => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return parseCustomSkillMarkdownAsset(raw, {
      fileName: path.basename(filePath),
      filePath,
    });
  } catch (error) {
    console.warn('[custom-skill-files] skip unreadable skill file', filePath, error);
    return null;
  }
};

export const listCustomSkillMarkdownFiles = async (options?: {
  rootDir?: string;
}): Promise<CustomSkillMarkdownAsset[]> => {
  const dir = resolveCustomSkillDirectory(options?.rootDir);
  const files = await readDirectoryMdFiles(dir);
  const parsed = await Promise.all(files.map((filePath) => readCustomSkillFile(filePath)));
  return parsed
    .filter((item): item is CustomSkillMarkdownAsset => Boolean(item))
    .sort((left, right) => {
      const leftTime = Number(left.updatedAt || left.distilledAt || left.createdAt || 0);
      const rightTime = Number(right.updatedAt || right.distilledAt || right.createdAt || 0);
      return rightTime - leftTime;
    });
};

export const saveCustomSkillMarkdownFile = async (args: {
  id: string;
  name: string;
  iconName?: string;
  config?: CustomSkillConfigRecord | null;
  rootDir?: string;
}): Promise<CustomSkillMarkdownAsset> => {
  const dir = resolveCustomSkillDirectory(args.rootDir);
  await ensureDirectory(dir);

  const asset = buildCustomSkillMarkdownAsset({
    id: args.id,
    name: args.name,
    iconName: args.iconName,
    config: args.config || {},
  });
  const existingItems = await listCustomSkillMarkdownFiles({ rootDir: args.rootDir });
  const existingMatch = existingItems.find((item) => item.id === asset.id) || null;
  const fileName = buildCustomSkillFileName(asset);
  const targetPath = path.join(dir, fileName);

  await fs.writeFile(targetPath, serializeCustomSkillMarkdownAsset(asset), 'utf8');

  if (existingMatch?.filePath && path.resolve(existingMatch.filePath) !== path.resolve(targetPath)) {
    try {
      await fs.unlink(existingMatch.filePath);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  return {
    ...asset,
    fileName,
    filePath: targetPath,
  };
};

export const updateCustomSkillMarkdownFile = async (args: {
  skillId: string;
  mutate: (
    current: CustomSkillMarkdownAsset,
  ) =>
    | CustomSkillConfigRecord
    | CustomSkillMarkdownAsset
    | null
    | undefined;
  rootDir?: string;
}): Promise<CustomSkillMarkdownAsset | null> => {
  const existingItems = await listCustomSkillMarkdownFiles({ rootDir: args.rootDir });
  const existingMatch = existingItems.find((item) => item.id === args.skillId) || null;
  if (!existingMatch) return null;

  const nextValue = args.mutate(existingMatch);
  if (!nextValue) return existingMatch;

  const nextConfig =
    'routeIntent' in nextValue &&
    'instruction' in nextValue &&
    'description' in nextValue &&
    'iconName' in nextValue
      ? customSkillMarkdownAssetToConfig(nextValue as CustomSkillMarkdownAsset)
      : (nextValue as CustomSkillConfigRecord);

  const saved = await saveCustomSkillMarkdownFile({
    rootDir: args.rootDir,
    id: existingMatch.id,
    name: String(nextConfig.name || existingMatch.name || 'Custom Skill').trim(),
    iconName: String(nextConfig.iconName || existingMatch.iconName || 'Sparkles').trim(),
    config: {
      ...customSkillMarkdownAssetToConfig(existingMatch),
      ...nextConfig,
      markdownAssetId: existingMatch.id,
      markdownAssetPath: existingMatch.filePath,
      storageFormat: 'markdown-file',
      updatedAt: Date.now(),
    },
  });

  return saved;
};

export const deleteCustomSkillMarkdownFile = async (args: {
  skillId: string;
  rootDir?: string;
}): Promise<boolean> => {
  const existingItems = await listCustomSkillMarkdownFiles({ rootDir: args.rootDir });
  const existingMatch = existingItems.find((item) => item.id === args.skillId) || null;
  if (!existingMatch?.filePath) return false;

  try {
    await fs.unlink(existingMatch.filePath);
    return true;
  } catch (error: any) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
};
