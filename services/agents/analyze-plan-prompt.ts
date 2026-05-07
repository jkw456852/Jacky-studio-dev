import type { ProjectContext } from '../../types/common';
import { buildRuntimeRolePrompt } from './runtime-role';
import { buildMainBrainCapabilityPromptSummary } from './main-brain-capability-registry';

const MAX_ANALYZE_HISTORY_MESSAGES = 4;
const MAX_MESSAGE_TEXT_CHARS = 1200;
const MAX_TOPIC_CONTEXT_CHARS = 1200;
const MAX_REFERENCE_SUMMARY_CHARS = 400;
const MAX_BRAND_INFO_CHARS = 400;

const truncateText = (value: unknown, maxChars: number): string => {
  const text = typeof value === 'string' ? value : String(value ?? '');
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}...`;
};

const compactJson = (value: unknown, maxChars: number): string => {
  try {
    return truncateText(JSON.stringify(value || {}), maxChars);
  } catch {
    return '{}';
  }
};

export interface AnalyzePlanPromptInput {
  agentId: string;
  systemPrompt: string;
  preferredSkills: string[];
  message: string;
  context: ProjectContext;
  attachments?: File[];
  uploadedAttachments?: string[];
  metadata?: Record<string, any>;
  forceImageToolCall: boolean;
  allowAutonomousRouting: boolean;
}

export interface AnalyzePlanPromptOutput {
  fullPrompt: string;
  historyCount: number;
}

export const buildAnalyzePlanPrompt = ({
  agentId,
  systemPrompt,
  preferredSkills,
  message,
  context,
  attachments,
  uploadedAttachments,
  metadata,
  forceImageToolCall,
  allowAutonomousRouting,
}: AnalyzePlanPromptInput): AnalyzePlanPromptOutput => {
  const hasAttachments = Boolean(attachments && attachments.length > 0);
  const isEdit =
    /换成|改成|改为|替换|修改|调整|变成|去掉|删除|移除|去背景|换背景|换颜色|改颜色|抠图|高清|放大画质|upscale|remove|replace|recolor|edit/i.test(
      message,
    );
  const isMultiImage =
    /(\d+)\s*(张|个)|一套图|一组|系列|多张|多套/i.test(message);
  const truncateUrl = (s: string) =>
    s.length > 60 ? `${s.slice(0, 57)}...` : s;

  const smartEditSection = isEdit
    ? `
[Smart Edit Rules]
- If the user is asking to edit an existing image, prefer the smartEdit skill instead of generateImage.
- Supported edit types:
  - object-remove: remove a target object
  - background-remove: remove the background
  - recolor: change an object's color
  - replace: replace one object with another
  - upscale: improve resolution
- When editing attachments, sourceUrl should use "ATTACHMENT_X".
`
    : '';

  const promptLanguagePolicy: 'original-zh' | 'translate-en' =
    metadata?.promptLanguagePolicy === 'translate-en'
      ? 'translate-en'
      : 'original-zh';
  const promptLanguageRule =
    promptLanguagePolicy === 'translate-en'
      ? 'prompt 字段必须使用英文，其他说明字段继续使用中文。'
      : 'prompt 字段可以使用中文，并优先保留用户原始中文意图。';

  const productSection =
    hasAttachments && !['cameron'].includes(agentId)
      ? `
[Product Recognition Rules]
- If the user attached images, treat them as the primary source of truth for the product or subject.
- Carefully identify the subject's type, material, color, silhouette, branding, details, and constraints from the attachments.
- If you generate images, each prompt must begin with a concrete visual description of the actual subject, not a generic category name.
- Never drift away from the attached subject into unrelated random products or scenes.
- If the user provided multiple subject images and wants generation, use them as references instead of collapsing everything into only the first image.
`
      : '';

  const quantitySection = `
[Quantity Rules]
- Default to exactly 1 proposal.
- Only return multiple proposals when the user explicitly asks for multiple images, a set, a series, or several options.
- If the user asks for edits, default to 1 proposal unless they explicitly request variants.
- Do not create extra proposals just because multiple attachments exist.
`;

  const multiImageSection = isMultiImage
    ? `
[Multi Image Rules]
- When multiple proposals are required, each proposal must have its own skillCalls.
- Each proposal should differ in purpose, layout, angle, or communication focus.
- Do not return fewer proposals than the user explicitly requested.
`
    : '';

  const forcedToolSection =
    forceImageToolCall && !allowAutonomousRouting
      ? `
[Forced Tool Rule]
- This request has already been classified as a must-execute visual task.
- Do not answer with message-only output.
- You must return executable skillCalls.
- At least one skillCall must use "generateImage".
`
      : '';

  const multimodalRefUrls = (
    metadata?.multimodalContext?.referenceImageUrls || []
  )
    .filter((u: string) => /^https?:\/\//i.test(u))
    .slice(0, 4);
  const multimodalReferenceSummary =
    typeof metadata?.multimodalContext?.referenceSummary === 'string'
      ? truncateText(
          metadata.multimodalContext.referenceSummary.trim(),
          MAX_REFERENCE_SUMMARY_CHARS,
        )
      : '';
  const multimodalSection =
    multimodalRefUrls.length > 0
      ? `
[Multimodal References]
${multimodalRefUrls
  .map((url: string, index: number) => `- REF_URL_${index}: ${url}`)
  .join('\n')}
- Reference summary: ${multimodalReferenceSummary || 'Treat these images as multi-angle or multi-detail references of the same subject unless the user says otherwise.'}
- When building image tool params, prefer using \`referenceImages\` for multi-reference cases.
- If only one reference is needed, you may also set \`referenceImage\`.
- If you use \`ATTACHMENT_N\`, keep the corresponding \`referenceImage\` or \`referenceImages\` field present.
`
      : '';

  const topicPinnedContext =
    typeof metadata?.topicPinnedContext === 'string' &&
    metadata.topicPinnedContext.trim().length > 0
      ? `
[Pinned Topic Context]
${truncateText(metadata.topicPinnedContext, MAX_TOPIC_CONTEXT_CHARS)}
`
      : '';

  const isolateVisualQa = metadata?.multimodalContext?.isolateVisualQa === true;
  const designSession = context.designSession;
  const historyMessages = (
    isolateVisualQa ? [] : context.conversationHistory || []
  ).slice(-MAX_ANALYZE_HISTORY_MESSAGES);
  const compactConversationHistory = historyMessages
    .map((msg) => {
      const roleName = msg.role === 'user' ? '用户' : '助手';
      const cleanText = truncateText(
        String(msg.text || '')
          .replace(
            /data:[a-z0-9+\-]+\/[a-z0-9+\-]+;base64,[A-Za-z0-9+/=]+/gi,
            '[图片]',
          )
          .replace(/https?:\/\/[^\s"']{80,}/g, '[URL]'),
        MAX_MESSAGE_TEXT_CHARS,
      );
      const cleanAttachments = (msg.attachments || [])
        .slice(0, 3)
        .map((a: string) =>
          /^data:/.test(a) ? '[已上传图片]' : a.length > 120 ? '[URL]' : a,
        );
      const attachmentsText =
        cleanAttachments.length > 0
          ? ` [附件: ${cleanAttachments.join(', ')}${(msg.attachments?.length || 0) > 3 ? ', ...' : ''}]`
          : '';
      return `${roleName}: ${cleanText}${attachmentsText}`;
    })
    .join('\n');

  const designSessionSection =
    !isolateVisualQa && designSession
      ? `
[Design Session]
- task mode: ${designSession.taskMode}
- approved assets: ${(designSession.approvedAssetIds || [])
  .slice(-3)
  .map(truncateUrl)
  .join(', ') || 'none'}
- subject anchors: ${(designSession.subjectAnchors || [])
  .slice(-3)
  .map(truncateUrl)
  .join(', ') || 'none'}
- reference summary: ${truncateText(
          designSession.referenceSummary || 'none',
          MAX_REFERENCE_SUMMARY_CHARS,
        )}
- forbidden changes: ${(designSession.forbiddenChanges || []).join(', ') || 'none'}
`
      : '';

  const visualQaIsolationSection = isolateVisualQa
    ? `
[Visual QA Isolation]
- Answer only from the current attachments and current user request.
- Do not treat old generation logs, design plans, or poster descriptions as facts about this image.
- If history conflicts with the current image, trust the current visible image.
- Unless the user explicitly asks for generation or design, do recognition, explanation, analysis, and clarification only.
`
    : '';

  const visualQaJsonContract = isolateVisualQa
    ? `
[Visual QA Output Contract]
- Return pure Q and A only.
- Do not return skillCalls.
- Do not return proposals.
- Do not return preGenerationMessage.
- Do not return postGenerationSummary.
- message must directly answer the user about the current image.
`
    : '';

  const autonomousDecisionContract = allowAutonomousRouting
    ? `
[Autonomous Decision Contract]
- First decide whether the user's request should be answered directly, researched first, or executed with tools.
- If the user is mainly asking a question, prefer a direct answer.
- If the user explicitly asks for investigation, comparison, or fact finding, answer with research-oriented analysis before any tool execution.
- Only return skillCalls when tool execution is genuinely necessary to satisfy the request.
- Do not default to image generation, design execution, or editing unless the request actually asks for it.
- Keep the user's original intent higher priority than any fixed workflow habit.
`
    : '';

  const attachmentSection = (attachments || [])
    .map((file, index) => {
      const info = (file as any).markerInfo;
      const markerName = (file as any).markerName;
      const uploadedUrl =
        uploadedAttachments && uploadedAttachments[index]
          ? `\n  - public preview: ${uploadedAttachments[index]}`
          : '';

      if (info) {
        const ratio = (info.width / info.height).toFixed(2);
        return `- 附件 ${index + 1}: [画布选区]${markerName ? ` (${markerName})` : ''}，尺寸 ${info.width}x${info.height}，比例 ${ratio}。引用标记为 "ATTACHMENT_${index}"。${uploadedUrl}`;
      }

      return `- 附件 ${index + 1}: ${file.name}${markerName ? ` (${markerName})` : ''}，类型 ${file.type}。引用标记为 "ATTACHMENT_${index}"。${uploadedUrl}`;
    })
    .join('\n');

  const capabilitySummary = buildMainBrainCapabilityPromptSummary({
    preferredSkills,
    includeInternalModules: allowAutonomousRouting,
    includeSpecialists: allowAutonomousRouting,
  });

  const fullPrompt = `${buildRuntimeRolePrompt(systemPrompt, metadata)}

[Language Rule]
- 所有 analysis、message、title、description、suggestions 等说明性字段必须使用中文。
- ${promptLanguageRule}

[Project Context]
- project title: ${context.projectTitle}
- brand info: ${compactJson(context.brandInfo || {}, MAX_BRAND_INFO_CHARS)}
- existing asset count: ${context.existingAssets.length}

[Attachments]
${attachmentSection || '- none'}

[Conversation Context]
${compactConversationHistory || '无'}

[Available Skills]
${preferredSkills.join(', ')}
${smartEditSection}

[Callable Capability Surface]
${capabilitySummary}

[Current User Request]
${message}

${productSection}${quantitySection}${multiImageSection}${forcedToolSection}${multimodalSection}${topicPinnedContext}${designSessionSection}${visualQaIsolationSection}${visualQaJsonContract}${autonomousDecisionContract}
[Response Contract]
- Return executable JSON directly.
- Do not ask the user to click again for confirmation unless confirmation is truly necessary.
- If no tool is needed, leave skillCalls empty or omit it.
- Only include proposals when the user explicitly asks to see multiple options, directions, or a series.

{
  "analysis": "用中文简要分析用户需求",
  "preGenerationMessage": "如果要调用视觉工具，先用中文说明你将如何处理参考图、风格和构图；否则可省略",
  "skillCalls": [
    {
      "skillName": "generateImage",
      "params": {
        "prompt": "...",
        "referenceImages": ["ATTACHMENT_0"],
        "referenceImage": "ATTACHMENT_0",
        "aspectRatio": "1:1",
        "model": "Nano Banana Pro"
      }
    }
  ],
  "message": "用中文直接回答用户，或总结你将执行的动作",
  "postGenerationSummary": "工具执行后，用中文简短复盘结果亮点；如果未执行工具可省略",
  "suggestions": ["可选的后续建议 1", "可选的后续建议 2"]
}`;

  return {
    fullPrompt,
    historyCount: historyMessages.length,
  };
};
