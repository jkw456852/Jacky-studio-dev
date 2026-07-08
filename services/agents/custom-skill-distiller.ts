import type { ChatMessage } from '../../types';
import { normalizeAgentJsonResponse } from './agent-response-normalizer.ts';
import { buildDefaultExecutionRecipeLines } from '../runtime-assets/frontstage-skill-recipes.ts';

export type DistilledSkillRouteIntent =
  | 'general'
  | 'video'
  | 'social'
  | 'branding'
  | 'commerce';

export interface DistilledCustomSkillSeed {
  name: string;
  summary: string;
  routeIntent: DistilledSkillRouteIntent;
  followUpMode: 'auto-clarify' | 'direct-run';
  activationHint: string;
  instruction: string;
  clarifyChecklist: string[];
  reusableQuestions: string[];
  executionOutline: string[];
  executionRecipe: string[];
  outputBlueprint: string[];
  toolPolicy: string[];
  examplePrompt: string;
  sourceConversationTitle: string | null;
  sourceUserPrompt: string;
}

export interface SuccessfulSkillRunSnapshot {
  prompt: string;
  summary: string;
  outputText: string;
}

type DistillSkillResponse = Partial<DistilledCustomSkillSeed>;

type DistillSkillGenerator = (prompt: string) => Promise<string>;

const MAX_CONVERSATION_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 500;

const normalizeString = (value: unknown) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeParagraph = (value: unknown, maxChars = 220) =>
  normalizeString(value).slice(0, maxChars);

const normalizeRouteIntent = (value: unknown): DistilledSkillRouteIntent => {
  const normalized = normalizeString(value).toLowerCase();
  if (
    normalized === 'video' ||
    normalized === 'social' ||
    normalized === 'branding' ||
    normalized === 'commerce'
  ) {
    return normalized;
  }
  return 'general';
};

const normalizeStringList = (
  value: unknown,
  maxItems: number,
  maxCharsPerItem = 80,
) =>
  Array.isArray(value)
    ? value
        .map((item) => normalizeParagraph(item, maxCharsPerItem))
        .filter(Boolean)
        .slice(0, maxItems)
    : [];

const normalizeSkillCallName = (value: unknown) =>
  normalizeString(value).replace(/\s+/g, '');

const sanitizeConversationMessages = (messages: ChatMessage[]) =>
  messages
    .filter((message) => ['user', 'model'].includes(message.role))
    .slice(-MAX_CONVERSATION_MESSAGES)
    .map((message) => ({
      role: message.role,
      text: normalizeParagraph(
        String(message.text || '')
          .replace(/data:[a-z0-9+\-]+\/[a-z0-9+\-]+;base64,[A-Za-z0-9+/=]+/gi, '[image]')
          .replace(/https?:\/\/[^\s"']{80,}/g, '[url]'),
        MAX_MESSAGE_CHARS,
      ),
    }))
    .filter((message) => message.text);

const inferRouteIntentHeuristically = (
  conversationTitle: string,
  summary: string,
  lastUserPrompt: string,
): DistilledSkillRouteIntent => {
  const combined = `${conversationTitle}\n${summary}\n${lastUserPrompt}`.toLowerCase();

  if (/(video|镜头|分镜|动画|动效|短视频|脚本)/i.test(combined)) {
    return 'video';
  }
  if (/(品牌|brand|kv|campaign|视觉系统|vi|logo|调性)/i.test(combined)) {
    return 'branding';
  }
  if (/(社媒|小红书|封面|海报|social|campaign|帖子|种草|carousel|轮播)/i.test(combined)) {
    return 'social';
  }
  if (/(电商|详情页|商品图|主图|sku|卖点|转化|淘宝|天猫|京东|亚马逊|catalog|目录)/i.test(combined)) {
    return 'commerce';
  }
  return 'general';
};

const inferFollowUpModeHeuristically = (messages: ChatMessage[]) => {
  const recentModelTurns = messages
    .filter((message) => message.role === 'model')
    .slice(-2);
  return recentModelTurns.some((message) =>
    /(请提供|补充|确认|方便说下|还需要|先告诉我|上传|给我看看|\?|？|which|what|need|missing|clarify)/i.test(
      String(message.text || ''),
    ),
  )
    ? 'auto-clarify'
    : 'direct-run';
};

const extractReusableQuestionsHeuristically = (messages: ChatMessage[]) => {
  const assistantTexts = messages
    .filter((message) => message.role === 'model')
    .map((message) => String(message.text || '').trim())
    .filter(Boolean)
    .slice(-4);

  const matches = assistantTexts.flatMap((text) => {
    const candidates = text.match(/[^。！？\n]*[？?]/g) || [];
    return candidates
      .map((item) => normalizeParagraph(item, 60))
      .filter((item) => item.length >= 4 && item.length <= 60);
  });

  return Array.from(new Set(matches)).slice(0, 5);
};

const extractExecutionOutlineHeuristically = (message?: ChatMessage | null): string[] => {
  const text = String(message?.text || '').trim();
  if (!text) return [];

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s>*-]+/, '').trim())
    .filter(Boolean);

  const stepLike = lines.filter((line) =>
    /^(\d+[\.\)、]|第.+步|先|再|然后|最后)/.test(line),
  );
  if (stepLike.length > 0) {
    return Array.from(new Set(stepLike.map((line) => line.slice(0, 80)))).slice(0, 6);
  }

  return lines.slice(0, 4).map((line) => line.slice(0, 80));
};

const inferOutputBlueprintHeuristically = (
  routeIntent: DistilledSkillRouteIntent,
  lastModelMessage?: ChatMessage | null,
) => {
  const text = String(lastModelMessage?.text || '').toLowerCase();
  const blueprint: string[] = [];

  if (routeIntent === 'video') {
    blueprint.push('先给脚本/镜头拆解', '再给视频执行方案');
  } else if (routeIntent === 'branding') {
    blueprint.push('先整理品牌方向', '再输出视觉系统/KV建议');
  } else if (routeIntent === 'social') {
    blueprint.push('先明确传播角度', '再拆分封面/海报/文案资产');
  } else if (routeIntent === 'commerce') {
    blueprint.push('先补齐商品卖点', '再输出转化导向物料方案');
  } else {
    blueprint.push('先澄清目标', '再给执行方案');
  }

  if (/(清单|checklist|步骤|step)/i.test(text)) {
    blueprint.push('适合按步骤清单式输出');
  }
  if (/(表格|table|模块|section)/i.test(text)) {
    blueprint.push('适合模块化结构输出');
  }

  return Array.from(new Set(blueprint)).slice(0, 4);
};

const defaultToolPolicyByRoute = (
  routeIntent: DistilledSkillRouteIntent,
): string[] => {
  switch (routeIntent) {
    case 'video':
      return [
        '先稳定脚本与镜头结构，再决定是否生成关键帧或视频。',
        '关键帧和视频调用都要服务于镜头连续性，不要先做散乱单图。',
      ];
    case 'social':
      return [
        '先定义内容主线和页序，再决定各资产位是否要生成画面。',
        '需要视觉稿时按页面或资产职责分别生成，不要混成一张杂图。',
      ];
    case 'branding':
      return [
        '先统一品牌方向和风格边界，再进入视觉生成。',
        '生成画面只用于验证品牌方向，不要跳过品牌判断直接出图。',
      ];
    case 'commerce':
      return [
        '优先锁定商品真值、卖点和页型结构，再进入物料执行。',
        '不要把多屏、多页的电商任务压缩成单张海报式输出。',
      ];
    case 'general':
    default:
      return [
        '优先复用本次对话里验证过的步骤，不要重新从空白 prompt 开始。',
        '缺少关键信息时先补问，再进入执行。',
      ];
  }
};

const resolveSkillCallCondition = (skillName: string) => {
  switch (skillName) {
    case 'workspaceSearch':
      return 'explicit-research';
    case 'generateImage':
      return 'visual-request';
    case 'generateVideo':
      return 'final-video';
    case 'smartEdit':
      return 'attachment-edit';
    case 'generateCopy':
    default:
      return 'always';
  }
};

const resolveSkillCallGoal = (
  skillName: string,
  title?: unknown,
  description?: unknown,
) => {
  const explicitGoal = normalizeParagraph(title || description || '', 120);
  if (explicitGoal) return explicitGoal;

  switch (skillName) {
    case 'workspaceSearch':
      return '补齐案例、趋势或外部事实依据';
    case 'generateCopy':
      return '先稳定脚本、结构、文案骨架或页序主线';
    case 'generateImage':
      return '验证关键画面、KV、分页视觉或关键帧方向';
    case 'generateVideo':
      return '在脚本和关键帧稳定后推进最终视频生成';
    case 'smartEdit':
      return '基于现有素材做定向编辑，而不是重做整套画面';
    default:
      return `按工作流中的职责执行 ${skillName}`;
  }
};

const buildExecutionRecipeFromSkillCalls = (
  skillCalls: Array<Record<string, unknown>>,
  routeIntent: DistilledSkillRouteIntent,
) => {
  const seen = new Set<string>();
  const lines = skillCalls
    .map((call) => {
      const skillName = normalizeSkillCallName(call.skillName);
      if (!skillName || seen.has(skillName)) return '';
      seen.add(skillName);
      return `${resolveSkillCallCondition(skillName)} :: ${skillName} :: ${resolveSkillCallGoal(
        skillName,
        call.title,
        call.description,
      )}`;
    })
    .filter(Boolean)
    .slice(0, 6);

  return lines.length > 0 ? lines : buildDefaultExecutionRecipeLines(routeIntent);
};

const buildExecutionOutlineFromSkillCalls = (
  skillCalls: Array<Record<string, unknown>>,
) =>
  skillCalls
    .map((call) =>
      resolveSkillCallGoal(
        normalizeSkillCallName(call.skillName),
        call.title,
        call.description,
      ),
    )
    .filter(Boolean)
    .slice(0, 6);

const buildToolPolicyFromSkillCalls = (
  skillCalls: Array<Record<string, unknown>>,
  routeIntent: DistilledSkillRouteIntent,
) => {
  const firstSkillName = normalizeSkillCallName(skillCalls[0]?.skillName);
  const policies: string[] = [];

  if (firstSkillName === 'workspaceSearch') {
    policies.push('先补研究和外部依据，再进入创意或视觉执行。');
  } else if (firstSkillName === 'generateCopy') {
    policies.push('先稳定脚本、结构或文案骨架，再进入视觉或视频生成。');
  } else if (firstSkillName === 'generateImage') {
    policies.push('先验证关键视觉方向，再决定是否放大到整套资产。');
  } else if (firstSkillName === 'smartEdit') {
    policies.push('优先在现有素材上做定向编辑，不要一上来重做整套内容。');
  } else if (firstSkillName === 'generateVideo') {
    policies.push('只有在脚本、镜头或关键帧已经明确后，才进入最终视频生成。');
  }

  if (skillCalls.some((call) => normalizeSkillCallName(call.skillName) === 'generateImage')) {
    policies.push('图像生成要服务于工作流中的单个资产职责，不要把多步骤任务压成一张图。');
  }
  if (skillCalls.some((call) => normalizeSkillCallName(call.skillName) === 'generateVideo')) {
    policies.push('视频生成应放在脚本与关键帧稳定之后，而不是跳过前置规划直接出成片。');
  }

  return Array.from(
    new Set([
      ...policies,
      ...defaultToolPolicyByRoute(routeIntent),
    ]),
  ).slice(0, 6);
};

const findTriggerUserMessageForModelMessage = (
  messages: ChatMessage[],
  modelMessage: ChatMessage | null,
) => {
  if (!modelMessage) return null;
  const responseToMessageId = normalizeString(modelMessage.responseToMessageId);
  if (responseToMessageId) {
    const matched = messages.find(
      (message) =>
        message.role === 'user' &&
        normalizeString(message.id) === responseToMessageId,
    );
    if (matched) return matched;
  }

  const modelIndex = messages.findIndex((message) => message.id === modelMessage.id);
  if (modelIndex <= 0) return null;
  for (let index = modelIndex - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      return messages[index];
    }
  }
  return null;
};

const hasMeaningfulExecutionEvidence = (message: ChatMessage) => {
  if (message.role !== 'model' || message.error === true) return false;
  const agentData =
    message.agentData && typeof message.agentData === 'object'
      ? message.agentData
      : null;
  if (!agentData) return false;

  return Boolean(
    (Array.isArray(agentData.skillCalls) && agentData.skillCalls.length > 0) ||
      (Array.isArray(agentData.assets) && agentData.assets.length > 0) ||
      (Array.isArray(agentData.proposals) && agentData.proposals.length > 0) ||
      normalizeString(agentData.postGenerationSummary) ||
      normalizeString(agentData.analysis) ||
      normalizeString(agentData.preGenerationMessage) ||
      normalizeString(agentData.executionTrace?.status) === 'completed',
  );
};

const extractLatestSuccessfulExecutionEvidence = (messages: ChatMessage[]) => {
  const latestSuccessfulModelMessage =
    [...messages]
      .reverse()
      .find((message) => hasMeaningfulExecutionEvidence(message)) || null;
  if (!latestSuccessfulModelMessage?.agentData) {
    return null;
  }

  const triggerUserMessage = findTriggerUserMessageForModelMessage(
    messages,
    latestSuccessfulModelMessage,
  );
  const skillCalls = Array.isArray(latestSuccessfulModelMessage.agentData.skillCalls)
    ? latestSuccessfulModelMessage.agentData.skillCalls
        .filter(
          (call) =>
            Boolean(call) &&
            typeof call === 'object' &&
            Boolean(normalizeSkillCallName((call as Record<string, unknown>).skillName)),
        )
        .filter((call) => call.success !== false)
    : [];

  return {
    triggerUserPrompt: normalizeParagraph(triggerUserMessage?.text || '', 220),
    messageText: normalizeParagraph(latestSuccessfulModelMessage.text || '', 320),
    analysis: normalizeParagraph(
      latestSuccessfulModelMessage.agentData.analysis || '',
      220,
    ),
    preGenerationMessage: normalizeParagraph(
      latestSuccessfulModelMessage.agentData.preGenerationMessage || '',
      220,
    ),
    postGenerationSummary: normalizeParagraph(
      latestSuccessfulModelMessage.agentData.postGenerationSummary || '',
      220,
    ),
    skillCalls,
  };
};

const buildFallbackSkillSeed = ({
  conversationTitle,
  recentMessages,
}: {
  conversationTitle?: string | null;
  recentMessages: ChatMessage[];
}): DistilledCustomSkillSeed => {
  const userMessages = recentMessages.filter((message) => message.role === 'user');
  const modelMessages = recentMessages.filter((message) => message.role === 'model');
  const firstUserMessage = userMessages[0];
  const lastUserMessage = userMessages[userMessages.length - 1];
  const lastModelMessage = modelMessages[modelMessages.length - 1];
  const latestExecutionEvidence =
    extractLatestSuccessfulExecutionEvidence(recentMessages);
  const baseName = normalizeParagraph(
    conversationTitle || firstUserMessage?.text || lastUserMessage?.text || '新 Skill',
    24,
  );
  const summary =
    normalizeParagraph(
      latestExecutionEvidence?.postGenerationSummary ||
        latestExecutionEvidence?.analysis ||
        latestExecutionEvidence?.messageText ||
        lastModelMessage?.text ||
        lastUserMessage?.text ||
        '',
      120,
    ) ||
    '基于当前对话总结出的可复用 Skill。';
  const sourceConversationTitle = normalizeString(conversationTitle) || null;
  const sourceUserPrompt = normalizeParagraph(
    latestExecutionEvidence?.triggerUserPrompt ||
      firstUserMessage?.text ||
      lastUserMessage?.text ||
      '',
    200,
  );
  const routeIntent = inferRouteIntentHeuristically(
    String(sourceConversationTitle || ''),
    summary,
    sourceUserPrompt,
  );
  const followUpMode = inferFollowUpModeHeuristically(recentMessages);
  const reusableQuestions = extractReusableQuestionsHeuristically(recentMessages);
  const executionOutline =
    latestExecutionEvidence && latestExecutionEvidence.skillCalls.length > 0
      ? buildExecutionOutlineFromSkillCalls(latestExecutionEvidence.skillCalls)
      : extractExecutionOutlineHeuristically(lastModelMessage);
  const executionRecipe =
    latestExecutionEvidence && latestExecutionEvidence.skillCalls.length > 0
      ? buildExecutionRecipeFromSkillCalls(
          latestExecutionEvidence.skillCalls,
          routeIntent,
        )
      : buildDefaultExecutionRecipeLines(routeIntent);
  const outputBlueprint = inferOutputBlueprintHeuristically(routeIntent, lastModelMessage);
  const toolPolicy =
    latestExecutionEvidence && latestExecutionEvidence.skillCalls.length > 0
      ? buildToolPolicyFromSkillCalls(
          latestExecutionEvidence.skillCalls,
          routeIntent,
        )
      : defaultToolPolicyByRoute(routeIntent);

  return {
    name: `${baseName || '新'} Skill`,
    summary,
    routeIntent,
    followUpMode,
    activationHint: '基于此对话创建的 Skill Seed，可继续补充配置。',
    instruction:
      normalizeParagraph(lastModelMessage?.text || lastUserMessage?.text || '', 360) ||
      '先复用这次对话里验证过的思路，再根据新的输入补齐缺失信息并继续执行。',
    clarifyChecklist: [],
    reusableQuestions,
    executionOutline,
    executionRecipe,
    outputBlueprint,
    toolPolicy,
    examplePrompt: sourceUserPrompt,
    sourceConversationTitle,
    sourceUserPrompt,
  };
};

const buildDistillPrompt = ({
  conversationTitle,
  recentMessages,
}: {
  conversationTitle?: string | null;
  recentMessages: ChatMessage[];
}) => {
  const sanitizedMessages = sanitizeConversationMessages(recentMessages);
  const latestExecutionEvidence =
    extractLatestSuccessfulExecutionEvidence(recentMessages);
  const conversationBlock =
    sanitizedMessages.length > 0
      ? sanitizedMessages
          .map((message, index) => `${index + 1}. ${message.role.toUpperCase()}: ${message.text}`)
          .join('\n')
      : 'No usable messages.';
  const executionEvidenceBlock = latestExecutionEvidence
    ? `

Recent successful execution evidence:
- triggering user prompt: ${latestExecutionEvidence.triggerUserPrompt || 'none'}
- assistant analysis: ${latestExecutionEvidence.analysis || 'none'}
- pre-generation message: ${latestExecutionEvidence.preGenerationMessage || 'none'}
- post-generation summary: ${latestExecutionEvidence.postGenerationSummary || 'none'}
- successful skill chain: ${
        latestExecutionEvidence.skillCalls.length > 0
          ? latestExecutionEvidence.skillCalls
              .map((call) => normalizeSkillCallName(call.skillName))
              .filter(Boolean)
              .join(' -> ')
          : 'none'
      }
- assistant output excerpt: ${latestExecutionEvidence.messageText || 'none'}
`
    : `

Recent successful execution evidence:
- none
`;

  return `You are distilling a successful creative-agent conversation into a reusable sidebar Skill seed.

Target behavior reference:
- A Lovart-style Custom Skill captures the conversational path, not just the final answer.
- It should preserve how the agent asked for missing inputs, how it sequenced work, and what output structure it delivered.
- Convert the conversation into a reusable workflow that can run again on new inputs.

Return strict JSON only with these keys:
{
  "name": string,
  "summary": string,
  "routeIntent": "general" | "video" | "social" | "branding" | "commerce",
  "followUpMode": "auto-clarify" | "direct-run",
  "activationHint": string,
  "instruction": string,
  "clarifyChecklist": string[],
  "reusableQuestions": string[],
  "executionOutline": string[],
  "executionRecipe": string[],
  "outputBlueprint": string[],
  "toolPolicy": string[]
}

Rules:
- routeIntent must match the actual workflow focus, not generic wording.
- followUpMode is "auto-clarify" only when the conversation clearly showed the agent asking for missing inputs before executing.
- summarize the workflow path, not the whole project background.
- When recent successful execution evidence is available, treat it as the strongest source of truth for executionRecipe, toolPolicy, outputBlueprint, and source prompt selection.
- reusableQuestions should be concise, reusable questions the agent can ask again.
- executionOutline should be 3 to 6 reusable steps.
- executionRecipe should be 2 to 5 lines using this exact format: "condition :: skillNameOrNone :: goal".
- allowed conditions are: always, explicit-research, visual-request, final-video, attachment-edit.
- allowed skill names are registered runtime skills such as generateImage, generateVideo, workspaceSearch, smartEdit, or none.
- outputBlueprint should describe the structure of the final deliverable in 2 to 5 bullets.
- toolPolicy should describe which type of action to do first and what not to skip.
- Do not include markdown fences or prose outside JSON.

Conversation title: ${normalizeParagraph(conversationTitle || 'Current conversation', 80)}

Conversation:
${conversationBlock}${executionEvidenceBlock}`;
};

const defaultDistillSkillGenerator: DistillSkillGenerator = async (prompt: string) => {
  const { getBestModelSelection, generateJsonResponse } = await import('../gemini.ts');
  const thinkingModel = getBestModelSelection('thinking');
  const response = await generateJsonResponse({
    model: thinkingModel.modelId,
    providerId: thinkingModel.providerId || undefined,
    parts: [{ text: prompt }],
    temperature: 0.2,
    operation: 'distillCustomSkillFromConversation',
  });
  return String(response.text || '{}');
};

const mergeDistilledSeedWithFallback = (
  raw: DistillSkillResponse,
  fallback: DistilledCustomSkillSeed,
): DistilledCustomSkillSeed => {
  const routeIntent = normalizeRouteIntent(raw.routeIntent || fallback.routeIntent);
  const followUpModeRaw = normalizeString(raw.followUpMode || fallback.followUpMode);
  const followUpMode =
    followUpModeRaw === 'auto-clarify' ? 'auto-clarify' : 'direct-run';
  const toolPolicy =
    normalizeStringList(raw.toolPolicy, 6, 120).length > 0
      ? normalizeStringList(raw.toolPolicy, 6, 120)
      : fallback.toolPolicy;

  return {
    ...fallback,
    name: normalizeParagraph(raw.name || fallback.name, 40) || fallback.name,
    summary:
      normalizeParagraph(raw.summary || fallback.summary, 160) || fallback.summary,
    routeIntent,
    followUpMode,
    activationHint:
      normalizeParagraph(raw.activationHint || fallback.activationHint, 120) ||
      fallback.activationHint,
    instruction:
      normalizeParagraph(raw.instruction || fallback.instruction, 420) ||
      fallback.instruction,
    clarifyChecklist:
      normalizeStringList(raw.clarifyChecklist, 6, 30).length > 0
        ? normalizeStringList(raw.clarifyChecklist, 6, 30)
        : fallback.clarifyChecklist,
    reusableQuestions:
      normalizeStringList(raw.reusableQuestions, 6, 80).length > 0
        ? normalizeStringList(raw.reusableQuestions, 6, 80)
        : fallback.reusableQuestions,
    executionOutline:
      normalizeStringList(raw.executionOutline, 6, 100).length > 0
        ? normalizeStringList(raw.executionOutline, 6, 100)
        : fallback.executionOutline,
    executionRecipe:
      normalizeStringList(raw.executionRecipe, 6, 180).length > 0
        ? normalizeStringList(raw.executionRecipe, 6, 180)
        : fallback.executionRecipe,
    outputBlueprint:
      normalizeStringList(raw.outputBlueprint, 5, 100).length > 0
        ? normalizeStringList(raw.outputBlueprint, 5, 100)
        : fallback.outputBlueprint,
    toolPolicy,
  };
};

export const distillCustomSkillFromConversation = async ({
  conversationTitle,
  recentMessages,
  generate = defaultDistillSkillGenerator,
}: {
  conversationTitle?: string | null;
  recentMessages: ChatMessage[];
  generate?: DistillSkillGenerator;
}): Promise<DistilledCustomSkillSeed> => {
  const fallback = buildFallbackSkillSeed({
    conversationTitle,
    recentMessages,
  });

  const sanitizedMessages = sanitizeConversationMessages(recentMessages);
  if (sanitizedMessages.length < 2) {
    return fallback;
  }

  try {
    const prompt = buildDistillPrompt({
      conversationTitle,
      recentMessages,
    });
    const rawText = await generate(prompt);
    const parsed = normalizeAgentJsonResponse(rawText || '{}') as DistillSkillResponse;
    return mergeDistilledSeedWithFallback(parsed, fallback);
  } catch (error) {
    console.warn('[custom-skill-distiller] fallback to heuristic skill seed', error);
    return fallback;
  }
};

export const extractLatestSuccessfulSkillRunSnapshot = (
  recentMessages: ChatMessage[],
): SuccessfulSkillRunSnapshot | null => {
  const latestExecutionEvidence =
    extractLatestSuccessfulExecutionEvidence(recentMessages);
  if (!latestExecutionEvidence) return null;

  const prompt =
    normalizeParagraph(latestExecutionEvidence.triggerUserPrompt, 220) || '';
  const summary =
    normalizeParagraph(
      latestExecutionEvidence.postGenerationSummary ||
        latestExecutionEvidence.analysis ||
        latestExecutionEvidence.preGenerationMessage,
      220,
    ) || '';
  const outputText =
    normalizeParagraph(latestExecutionEvidence.messageText, 600) || '';

  if (!prompt && !summary && !outputText) {
    return null;
  }

  return {
    prompt,
    summary,
    outputText,
  };
};
