import { sanitizeFrontstageSkillName } from './skill-identity.ts';
import {
  normalizeExecutionRecipeLines,
  normalizeFrontstageSkillRouteIntent,
} from './frontstage-skill-recipes.ts';

export type CustomSkillRouteIntent =
  | 'general'
  | 'video'
  | 'social'
  | 'branding'
  | 'commerce';

export interface CustomSkillMarkdownAsset {
  id: string;
  name: string;
  description: string;
  iconName: string;
  activationHint: string;
  frontstageSkillId?: string;
  routeIntent: CustomSkillRouteIntent;
  routeLabel: string;
  routeSummary: string;
  preferredSkills: string[];
  suggestedTaskMode: string;
  followUpMode: 'auto-clarify' | 'direct-run';
  allowAutonomousRouting: boolean;
  mode: string;
  clarifyChecklist: string[];
  reusableQuestions: string[];
  executionOutline: string[];
  executionRecipe: string[];
  outputBlueprint: string[];
  toolPolicy: string[];
  instruction: string;
  examplePrompt: string;
  sourceConversationTitle: string | null;
  sourceUserPrompt: string;
  distilledFromConversation: boolean;
  distillationMethod?: string;
  distilledAt?: number;
  createdAt?: number;
  updatedAt?: number;
  successfulRuns?: number;
  lastSuccessfulAt?: number;
  lastSuccessfulPrompt?: string;
  lastSuccessfulSummary?: string;
  lastSuccessfulOutput?: string;
  tags: string[];
  fileName?: string;
  filePath?: string;
}

export interface CustomSkillConfigRecord extends Record<string, unknown> {
  name?: string;
  description?: string;
  summary?: string;
  iconName?: string;
  activationHint?: string;
  frontstageSkillId?: string;
  routeIntent?: string;
  routeLabel?: string;
  routeSummary?: string;
  preferredSkills?: string[];
  suggestedTaskMode?: string;
  followUpMode?: 'auto-clarify' | 'direct-run';
  allowAutonomousRouting?: boolean;
  mode?: string;
  clarifyChecklist?: string[];
  reusableQuestions?: string[];
  executionOutline?: string[];
  executionRecipe?: string[];
  outputBlueprint?: string[];
  toolPolicy?: string[];
  instruction?: string;
  customInstruction?: string;
  examplePrompt?: string;
  sourceConversationTitle?: string | null;
  sourceUserPrompt?: string;
  distilledFromConversation?: boolean;
  distillationMethod?: string;
  distilledAt?: number;
  createdAt?: number;
  updatedAt?: number;
  successfulRuns?: number;
  lastSuccessfulAt?: number;
  lastSuccessfulPrompt?: string;
  lastSuccessfulSummary?: string;
  lastSuccessfulOutput?: string;
  storageFormat?: string;
  markdownAssetId?: string;
  markdownAssetPath?: string;
  markdownAssetUpdatedAt?: number;
}

const clip = (value: unknown, maxChars: number): string =>
  String(value || '').replace(/\r\n/g, '\n').trim().slice(0, maxChars);

const normalizeStringList = (
  value: unknown,
  maxItems: number,
  maxCharsPerItem: number,
): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => clip(item, maxCharsPerItem))
        .filter(Boolean)
        .slice(0, maxItems)
    : [];

const normalizeRouteIntent = (value: unknown): CustomSkillRouteIntent =>
  normalizeFrontstageSkillRouteIntent(value);

const normalizeCount = (value: unknown): number => {
  const next = Number(value);
  if (!Number.isFinite(next) || next <= 0) return 0;
  return Math.floor(next);
};

const normalizeFollowUpMode = (
  value: unknown,
): 'auto-clarify' | 'direct-run' =>
  clip(value, 40) === 'auto-clarify' ? 'auto-clarify' : 'direct-run';

const parseMarkdownSections = (raw: string): Record<string, string> => {
  const sections: Record<string, string> = {};
  const headingRegex = /^##\s+([^\n]+)\n/gm;
  const headings: Array<{
    title: string;
    headingStart: number;
    contentStart: number;
  }> = [];

  let match = headingRegex.exec(raw);
  while (match) {
    headings.push({
      title: match[1].trim(),
      headingStart: match.index,
      contentStart: headingRegex.lastIndex,
    });
    match = headingRegex.exec(raw);
  }

  headings.forEach((heading, index) => {
    const nextHeadingStart =
      index + 1 < headings.length ? headings[index + 1].headingStart : raw.length;
    sections[heading.title] = raw.slice(heading.contentStart, nextHeadingStart).trim();
  });

  return sections;
};

const parseSectionList = (value: string | undefined): string[] => {
  const text = clip(value, 20000);
  if (!text) return [];
  return text
    .split('\n')
    .map((line) => line.replace(/^(?:[-*]|\d+\.)\s+/, '').trim())
    .filter(Boolean);
};

const toSection = (title: string, lines: string[]): string =>
  lines.length > 0 ? `## ${title}\n${lines.map((line) => `- ${line}`).join('\n')}\n\n` : '';

const toTextSection = (title: string, value: string): string =>
  clip(value, 4000) ? `## ${title}\n${clip(value, 4000)}\n\n` : '';

export const buildCustomSkillMarkdownAsset = (args: {
  id: string;
  name: string;
  iconName?: string;
  config?: CustomSkillConfigRecord | null;
}): CustomSkillMarkdownAsset => {
  const config = args.config || {};
  const sanitizedName = sanitizeFrontstageSkillName(args.name || config.name || 'Custom Skill');
  const instruction = clip(
    config.instruction || config.customInstruction || '',
    4000,
  );

  return {
    id: clip(args.id, 120),
    name: sanitizedName || 'Custom Skill',
    description: clip(
      config.summary || config.description || '基于对话沉淀出的可复用 Skill 工作流。',
      400,
    ),
    iconName: clip(args.iconName || config.iconName || 'Sparkles', 80) || 'Sparkles',
    activationHint: clip(
      config.activationHint || '复用这次对话里沉淀下来的执行方式。',
      240,
    ),
    frontstageSkillId: clip(config.frontstageSkillId, 120) || undefined,
    routeIntent: normalizeRouteIntent(config.routeIntent),
    routeLabel: clip(config.routeLabel || 'Custom Skill', 120) || 'Custom Skill',
    routeSummary: clip(
      config.routeSummary || 'Reuse the proven workflow from the source conversation.',
      400,
    ),
    preferredSkills: normalizeStringList(config.preferredSkills, 8, 80),
    suggestedTaskMode: clip(config.suggestedTaskMode || 'generate', 40) || 'generate',
    followUpMode: normalizeFollowUpMode(config.followUpMode),
    allowAutonomousRouting: config.allowAutonomousRouting !== false,
    mode: clip(config.mode || 'unified-sidebar-agent', 80) || 'unified-sidebar-agent',
    clarifyChecklist: normalizeStringList(config.clarifyChecklist, 8, 80),
    reusableQuestions: normalizeStringList(config.reusableQuestions, 8, 160),
    executionOutline: normalizeStringList(config.executionOutline, 8, 180),
    executionRecipe: normalizeExecutionRecipeLines(
      config.executionRecipe,
      config.routeIntent,
      8,
    ),
    outputBlueprint: normalizeStringList(config.outputBlueprint, 8, 180),
    toolPolicy: normalizeStringList(config.toolPolicy, 8, 220),
    instruction,
    examplePrompt: clip(
      config.examplePrompt || config.sourceUserPrompt || '',
      1000,
    ),
    sourceConversationTitle: clip(config.sourceConversationTitle, 240) || null,
    sourceUserPrompt: clip(config.sourceUserPrompt, 1000),
    distilledFromConversation: config.distilledFromConversation === true,
    distillationMethod: clip(config.distillationMethod, 120) || undefined,
    distilledAt:
      typeof config.distilledAt === 'number' && Number.isFinite(config.distilledAt)
        ? config.distilledAt
        : undefined,
    createdAt:
      typeof config.createdAt === 'number' && Number.isFinite(config.createdAt)
        ? config.createdAt
        : undefined,
    updatedAt:
      typeof config.updatedAt === 'number' && Number.isFinite(config.updatedAt)
        ? config.updatedAt
        : undefined,
    successfulRuns: normalizeCount(config.successfulRuns) || undefined,
    lastSuccessfulAt:
      typeof config.lastSuccessfulAt === 'number' && Number.isFinite(config.lastSuccessfulAt)
        ? config.lastSuccessfulAt
        : undefined,
    lastSuccessfulPrompt: clip(config.lastSuccessfulPrompt, 1000),
    lastSuccessfulSummary: clip(config.lastSuccessfulSummary, 1200),
    lastSuccessfulOutput: clip(config.lastSuccessfulOutput, 2000),
    tags: normalizeStringList(config.tags, 12, 60),
  };
};

export const serializeCustomSkillMarkdownAsset = (
  asset: CustomSkillMarkdownAsset,
): string => {
  const meta = {
    type: 'custom-skill',
    id: asset.id,
    name: asset.name,
    description: asset.description,
    iconName: asset.iconName,
    activationHint: asset.activationHint,
    ...(asset.frontstageSkillId ? { frontstageSkillId: asset.frontstageSkillId } : {}),
    routeIntent: asset.routeIntent,
    routeLabel: asset.routeLabel,
    routeSummary: asset.routeSummary,
    preferredSkills: asset.preferredSkills,
    suggestedTaskMode: asset.suggestedTaskMode,
    followUpMode: asset.followUpMode,
    allowAutonomousRouting: asset.allowAutonomousRouting,
    mode: asset.mode,
    ...(asset.sourceConversationTitle
      ? { sourceConversationTitle: asset.sourceConversationTitle }
      : {}),
    ...(asset.sourceUserPrompt ? { sourceUserPrompt: asset.sourceUserPrompt } : {}),
    ...(asset.distilledFromConversation ? { distilledFromConversation: true } : {}),
    ...(asset.distillationMethod
      ? { distillationMethod: asset.distillationMethod }
      : {}),
    ...(asset.distilledAt ? { distilledAt: asset.distilledAt } : {}),
    ...(asset.createdAt ? { createdAt: asset.createdAt } : {}),
    ...(asset.updatedAt ? { updatedAt: asset.updatedAt } : {}),
    ...(asset.successfulRuns ? { successfulRuns: asset.successfulRuns } : {}),
    ...(asset.lastSuccessfulAt ? { lastSuccessfulAt: asset.lastSuccessfulAt } : {}),
    ...(asset.tags.length > 0 ? { tags: asset.tags } : {}),
  };

  return [
    '```json',
    JSON.stringify(meta, null, 2),
    '```',
    '',
    toTextSection('Instruction', asset.instruction),
    toSection('ClarifyChecklist', asset.clarifyChecklist),
    toSection('ClarifyQuestions', asset.reusableQuestions),
    toSection('ExecutionOutline', asset.executionOutline),
    toSection('ExecutionRecipe', asset.executionRecipe),
    toSection('OutputBlueprint', asset.outputBlueprint),
    toSection('ToolPolicy', asset.toolPolicy),
    toTextSection('ExamplePrompt', asset.examplePrompt),
    toTextSection('LastSuccessfulPrompt', asset.lastSuccessfulPrompt || ''),
    toTextSection('LastSuccessfulSummary', asset.lastSuccessfulSummary || ''),
    toTextSection('LastSuccessfulOutput', asset.lastSuccessfulOutput || ''),
  ]
    .join('\n')
    .trim()
    .concat('\n');
};

export const parseCustomSkillMarkdownAsset = (
  raw: string,
  options?: {
    fileName?: string;
    filePath?: string;
  },
): CustomSkillMarkdownAsset => {
  const normalizedRaw = String(raw || '').replace(/\r\n/g, '\n');
  const metaMatch = normalizedRaw.match(/^```json\s*\n([\s\S]*?)\n```\s*/);
  if (!metaMatch?.[1]) {
    throw new Error('custom_skill_markdown_meta_missing');
  }

  const meta = JSON.parse(metaMatch[1]) as Record<string, unknown>;
  if (clip(meta.type, 80) !== 'custom-skill') {
    throw new Error('custom_skill_markdown_type_invalid');
  }

  const sections = parseMarkdownSections(normalizedRaw.slice(metaMatch[0].length));
  const asset = buildCustomSkillMarkdownAsset({
    id: clip(meta.id, 120),
    name: clip(meta.name, 240),
    iconName: clip(meta.iconName, 80),
    config: {
      summary: clip(meta.description, 400),
      description: clip(meta.description, 400),
      activationHint: clip(meta.activationHint, 240),
      frontstageSkillId: clip(meta.frontstageSkillId, 120),
      routeIntent: clip(meta.routeIntent, 40),
      routeLabel: clip(meta.routeLabel, 120),
      routeSummary: clip(meta.routeSummary, 400),
      preferredSkills: Array.isArray(meta.preferredSkills) ? meta.preferredSkills : [],
      suggestedTaskMode: clip(meta.suggestedTaskMode, 40),
      followUpMode: normalizeFollowUpMode(meta.followUpMode),
      allowAutonomousRouting: meta.allowAutonomousRouting !== false,
      mode: clip(meta.mode, 80),
      instruction: sections.Instruction,
      clarifyChecklist: parseSectionList(sections.ClarifyChecklist),
      reusableQuestions: parseSectionList(sections.ClarifyQuestions),
      executionOutline: parseSectionList(sections.ExecutionOutline),
      executionRecipe: parseSectionList(sections.ExecutionRecipe),
      outputBlueprint: parseSectionList(sections.OutputBlueprint),
      toolPolicy: parseSectionList(sections.ToolPolicy),
      examplePrompt: sections.ExamplePrompt,
      sourceConversationTitle: clip(meta.sourceConversationTitle, 240) || null,
      sourceUserPrompt: clip(meta.sourceUserPrompt, 1000),
      distilledFromConversation: meta.distilledFromConversation === true,
      distillationMethod: clip(meta.distillationMethod, 120),
      distilledAt:
        typeof meta.distilledAt === 'number' && Number.isFinite(meta.distilledAt)
          ? meta.distilledAt
          : undefined,
      createdAt:
        typeof meta.createdAt === 'number' && Number.isFinite(meta.createdAt)
          ? meta.createdAt
          : undefined,
      updatedAt:
        typeof meta.updatedAt === 'number' && Number.isFinite(meta.updatedAt)
          ? meta.updatedAt
          : undefined,
      successfulRuns:
        typeof meta.successfulRuns === 'number' && Number.isFinite(meta.successfulRuns)
          ? meta.successfulRuns
          : undefined,
      lastSuccessfulAt:
        typeof meta.lastSuccessfulAt === 'number' && Number.isFinite(meta.lastSuccessfulAt)
          ? meta.lastSuccessfulAt
          : undefined,
      lastSuccessfulPrompt: sections.LastSuccessfulPrompt,
      lastSuccessfulSummary: sections.LastSuccessfulSummary,
      lastSuccessfulOutput: sections.LastSuccessfulOutput,
      tags: Array.isArray(meta.tags) ? meta.tags : [],
    },
  });

  return {
    ...asset,
    ...(options?.fileName ? { fileName: options.fileName } : {}),
    ...(options?.filePath ? { filePath: options.filePath } : {}),
  };
};

export const customSkillMarkdownAssetToConfig = (
  asset: CustomSkillMarkdownAsset,
): CustomSkillConfigRecord => ({
  name: asset.name,
  iconName: asset.iconName,
  summary: asset.description,
  description: asset.description,
  activationHint: asset.activationHint,
  frontstageSkillId: asset.frontstageSkillId,
  routeIntent: asset.routeIntent,
  routeLabel: asset.routeLabel,
  routeSummary: asset.routeSummary,
  preferredSkills: [...asset.preferredSkills],
  suggestedTaskMode: asset.suggestedTaskMode,
  followUpMode: asset.followUpMode,
  allowAutonomousRouting: asset.allowAutonomousRouting,
  mode: asset.mode,
  clarifyChecklist: [...asset.clarifyChecklist],
  reusableQuestions: [...asset.reusableQuestions],
  executionOutline: [...asset.executionOutline],
  executionRecipe: [...asset.executionRecipe],
  outputBlueprint: [...asset.outputBlueprint],
  toolPolicy: [...asset.toolPolicy],
  instruction: asset.instruction,
  customInstruction: asset.instruction,
  examplePrompt: asset.examplePrompt,
  sourceConversationTitle: asset.sourceConversationTitle,
  sourceUserPrompt: asset.sourceUserPrompt,
  distilledFromConversation: asset.distilledFromConversation,
  ...(asset.distillationMethod
    ? { distillationMethod: asset.distillationMethod }
    : {}),
  ...(asset.distilledAt ? { distilledAt: asset.distilledAt } : {}),
  ...(asset.createdAt ? { createdAt: asset.createdAt } : {}),
  ...(asset.updatedAt ? { updatedAt: asset.updatedAt } : {}),
  ...(asset.successfulRuns ? { successfulRuns: asset.successfulRuns } : {}),
  ...(asset.lastSuccessfulAt ? { lastSuccessfulAt: asset.lastSuccessfulAt } : {}),
  ...(asset.lastSuccessfulPrompt
    ? { lastSuccessfulPrompt: asset.lastSuccessfulPrompt }
    : {}),
  ...(asset.lastSuccessfulSummary
    ? { lastSuccessfulSummary: asset.lastSuccessfulSummary }
    : {}),
  ...(asset.lastSuccessfulOutput
    ? { lastSuccessfulOutput: asset.lastSuccessfulOutput }
    : {}),
  isCustomSkill: true,
  storageFormat: 'markdown-file',
  markdownAssetId: asset.id,
  ...(asset.filePath ? { markdownAssetPath: asset.filePath } : {}),
  ...(asset.updatedAt ? { markdownAssetUpdatedAt: asset.updatedAt } : {}),
});
