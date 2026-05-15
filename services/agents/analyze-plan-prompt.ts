import type { ProjectContext } from '../../types/common';
import type { RoleGovernanceMode } from '../../types/agent.types';
import { buildRuntimeRolePrompt } from './runtime-role.ts';
import {
  buildMainBrainCapabilityPromptSummary,
  buildMainBrainCapabilityTruthSnapshot,
  buildRoleGovernancePromptContract,
} from './main-brain-capability-registry.ts';

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

// 构造 inlineParts 的文本描述，帮助后端理解文本和附件的相对位置
const buildInlinePartsDescription = (
  inlineParts: Array<
    { type: 'text'; text: string } |
    { type: 'image'; attachmentIndex?: number; attachmentLabel?: string }
  > | undefined,
): string => {
  if (!Array.isArray(inlineParts) || inlineParts.length === 0) {
    return '';
  }

  const parts = inlineParts
    .map((part, index) => {
      if (part.type === 'text') {
        const truncated = part.text.length > 100
          ? `${part.text.slice(0, 97)}...`
          : part.text;
        return `  ${index + 1}. [文本] ${truncated}`;
      } else if (part.type === 'image') {
        const label = part.attachmentLabel ? ` (${part.attachmentLabel})` : '';
        return `  ${index + 1}. [图片]${label}`;
      }
      return '';
    })
    .filter(Boolean);

  return parts.length > 0
    ? `用户请求结构:\n${parts.join('\n')}`
    : '';
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
  const isCapabilityBoundaryQuestion =
    /权限|能力|能做什么|会什么|能不能|可不可以|支不支持|支持什么|有没有.*能力|能否/i.test(
      message,
    );
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

  // 从 inlineParts 构造结构化的请求描述
  const inlinePartsDescription = buildInlinePartsDescription(
    metadata?.multimodalContext?.inlineParts,
  );

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

  const hasResearchContext = Boolean(
    metadata?.multimodalContext?.research ||
      (Array.isArray(metadata?.multimodalContext?.referenceWebPages) &&
        metadata.multimodalContext.referenceWebPages.length > 0),
  );
  const researchFailed = metadata?.webResearchStatus === 'failed';
  const researchFailureMessage =
    typeof metadata?.webResearchError === 'string'
      ? truncateText(metadata.webResearchError, 160)
      : '';
  const networkResearchEnabled =
    !researchFailed && (Boolean(metadata?.enableWebSearch) || hasResearchContext);
  const effectivePreferredSkills =
    networkResearchEnabled && allowAutonomousRouting
      ? Array.from(new Set([...preferredSkills, 'workspaceSearch']))
      : preferredSkills;
  const autonomousDecisionContract = allowAutonomousRouting
    ? `
[Autonomous Decision Contract]
- First decide whether the user's request should be answered directly, researched first, or executed with tools.
- If the user is mainly asking a question, prefer a direct answer.
- If the user explicitly asks for investigation, comparison, or fact finding, answer with research-oriented analysis before any tool execution.
- Only return skillCalls when tool execution is genuinely necessary to satisfy the request.
- Do not default to image generation, design execution, or editing unless the request actually asks for it.
- Keep the user's original intent higher priority than any fixed workflow habit.
- When network research is enabled and no attached research answers the question yet, you may actively return a "workspaceSearch" skillCall.
- Prefer "workspaceSearch" for fresh facts, schedules, events, prices, lineup, time-sensitive comparisons, and requests that need web verification.
- The "workspaceSearch" params.query should stay close to the user's actual question, only rewriting when it improves precision.
- When research context is already attached, use it before claiming that you cannot access search or the internet.
- After a successful search tool round, use the returned evidence in the next turn instead of asking the user to repeat the request.
- Do not say you are already searching, checking, fetching, or confirming results unless this turn already contains research results or other concrete returned evidence.
- If this turn has no attached research results and no executed search result yet, never promise "我现在帮你查/马上给你结果" as if the search is already running.
`
    : '';

  const networkResearchCapabilitySection = networkResearchEnabled
    ? `
[Turn Network Research]
- Network research is available for this turn through the workspace search pipeline.
- It may arrive as attached research context, reference web pages, a search-enabled model path, or an executable "workspaceSearch" skillCall.
- Do not say that you have no network search capability or no search tools when this section is present.
- If the user asks about your capability boundary, explain that network research is enabled for this turn via system support and may also be triggered through the workspaceSearch skill.
- If no research context or result summary is attached yet, describe this capability conservatively and do not pretend that a search has already started.
`
    : '';
  const networkResearchFailureSection = researchFailed
    ? `
[Turn Network Research Failure]
- A workspace-backed live search attempt already ran for this turn, but it failed before any verified results were attached.
- Failure detail: ${researchFailureMessage || '检索失败，请稍后重试'}
- Do not say you are searching, checking, fetching, or that you have verified live results.
- If you continue answering, explicitly state that live search failed and the remaining answer is only based on existing model knowledge, not real-time verification.
- If the request depends on fresh facts, current weather, current news, or live external data, prefer asking the user to retry after fixing search/network configuration.
`
    : '';

  const attachedResearch = metadata?.multimodalContext?.research;
  const attachedResearchSection = attachedResearch
    ? `
[Attached Research Results]
- requestId: ${attachedResearch.requestId}
- query: ${attachedResearch.query}
- mode: ${attachedResearch.mode}
- provider: ${attachedResearch.provider?.web || 'unknown'} / ${attachedResearch.provider?.images || 'unknown'}${attachedResearch.provider?.fallback ? ' (fallback)' : ''}
- brief: ${truncateText(attachedResearch.reportBrief || '', 520)}
- full report excerpt:
${truncateText(attachedResearch.reportFull || '', 2200)}
- citations:
${(attachedResearch.citations || [])
  .slice(0, 6)
  .map(
    (citation: { title?: string; url?: string }, index: number) =>
      `  - ${index + 1}. ${citation.title || '未命名来源'} — ${citation.url || ''}`,
  )
  .join('\n') || '  - none'}
- If attached research results exist, answer from them directly instead of saying there is no result.
- For current-info requests such as weather, news, prices, traffic, or schedules, you must first provide a concise fact answer from the attached research before adding any caveat.
- Only say "没有拿到结果" or equivalent when no attached research result exists at all.
- If the sources are partial, summarize the verifiable facts and clearly mark anything that remains uncertain.
`
    : '';

  const networkSkillNote = networkResearchEnabled
    ? '- 联网研究既可能以系统附带研究上下文出现，也可以在需要时通过 workspaceSearch skill 主动触发。'
    : '';
  const roleGovernanceMode: RoleGovernanceMode =
    metadata?.roleGovernanceMode === 'approval_required' ||
    metadata?.roleGovernanceMode === 'auto_manage'
      ? metadata.roleGovernanceMode
      : 'manual_only';
  const selectedRoleId =
    typeof metadata?.selectedRoleId === 'string' ? metadata.selectedRoleId.trim() : '';
  const selectedRoleSource =
    typeof metadata?.selectedRoleSource === 'string'
      ? metadata.selectedRoleSource.trim()
      : '';
  const baseAgentId =
    typeof metadata?.baseAgentId === 'string' ? metadata.baseAgentId.trim() : '';
  const roleGovernanceSection = buildRoleGovernancePromptContract({
    selectedRoleId,
    selectedRoleSource,
    baseAgentId,
    roleGovernanceMode,
    allowMainBrainRoleMutation: metadata?.allowMainBrainRoleMutation === true,
    allowMainBrainRolePromotion: metadata?.allowMainBrainRolePromotion === true,
  });

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
    preferredSkills: effectivePreferredSkills,
    includeInternalModules: allowAutonomousRouting,
    includeSpecialists: allowAutonomousRouting,
    networkResearchEnabled,
    hasResearchContext,
  });
  const capabilityTruthSnapshot = buildMainBrainCapabilityTruthSnapshot({
    preferredSkills: effectivePreferredSkills,
    networkResearchEnabled,
    hasResearchContext,
    roleGovernanceMode,
    allowMainBrainRoleMutation: metadata?.allowMainBrainRoleMutation === true,
    allowMainBrainRolePromotion: metadata?.allowMainBrainRolePromotion === true,
  });
  const capabilityBoundaryAnsweringSection = isCapabilityBoundaryQuestion
    ? `
[Capability Boundary Answering Rules]
- The user is explicitly asking about capability or permission boundaries.
- Answer from the Capability Truth Snapshot first instead of giving a freeform guess.
- Classify capability statements into: directly executable, turn-gated, governance-gated, or partially productized.
- Never describe a registered capability as completely unavailable when it is only gated by this turn or by governance rules.
- If a capability is only conditionally available this turn, say that clearly.
- If a capability is only partially productized, say that clearly instead of claiming full end-to-end delivery.
- Prefer precise statements such as “已注册但本轮未开启” or “已接入但受治理门控” over vague statements like “没有这个能力”.
`
    : '';

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
${effectivePreferredSkills.join(', ')}
${smartEditSection}
${networkSkillNote}

[Callable Capability Surface]
${networkResearchCapabilitySection}${networkResearchFailureSection}${attachedResearchSection}${capabilitySummary}

[Capability Truth Snapshot]
${capabilityTruthSnapshot}

[Current User Request]
${message}
${inlinePartsDescription ? `\n[Request Structure]\n${inlinePartsDescription}` : ''}

${productSection}${quantitySection}${multiImageSection}${forcedToolSection}${multimodalSection}${topicPinnedContext}${designSessionSection}${visualQaIsolationSection}${visualQaJsonContract}${autonomousDecisionContract}${capabilityBoundaryAnsweringSection}${roleGovernanceSection}
[Response Contract]
- Return executable JSON directly.
- Do not ask the user to click again for confirmation unless confirmation is truly necessary.
- If no tool is needed, leave skillCalls empty or omit it.
- If the user is asking about capability boundaries, prefer a direct capability answer and avoid unnecessary skillCalls.
- Only include proposals when the user explicitly asks to see multiple options, directions, or a series.
- For research-first tasks, you may return a workspaceSearch skillCall instead of generateImage.
- When using workspaceSearch, params must include a concise query; may also include mode, includePageExtracts, and maxExtractPages.
- Never emit planner-only governance capabilities inside skillCalls.
- If you made a role governance decision, include roleGovernanceAudit with a short summary and one or more actions.
- roleGovernanceAudit is for explanation and audit only; it does not mean the durable role asset has already been persisted unless runtime evidence later confirms it.
- When requesting a direct current-role long-term rewrite, use roleGovernanceAudit.actions[].action="addon_update" plus promptAddonText rather than leaving the rewrite only in message.
 
{
  "analysis": "用中文简要分析用户需求",
  "preGenerationMessage": "如果要调用视觉工具，先用中文说明你将如何处理参考图、风格和构图；如果要先联网检索，也可以说明你将先核实哪些事实；否则可省略",
  "skillCalls": [
    {
      "skillName": "workspaceSearch",
      "params": {
        "query": "澳门今年 kspark 什么时候举办，压轴是谁",
        "mode": "web",
        "includePageExtracts": true,
        "maxExtractPages": 2
      }
    }
  ],
  "roleGovernanceAudit": {
    "summary": "本轮决定沿用当前长期角色，并按其 baseAgentId 执行。",
    "actions": [
      {
        "action": "bind",
        "targetRoleId": "role_brand_designer",
        "targetBaseAgentId": "poster",
        "governanceMode": "approval_required",
        "requiresHumanApproval": false,
        "reason": "当前任务与该长期角色的定位一致，无需新增或改写角色资产。"
      },
      {
        "action": "addon_update",
        "targetBaseAgentId": "poster",
        "governanceMode": "auto_manage",
        "requiresHumanApproval": false,
        "promptAddonText": "输出海报方案前先给出版式结构拆解，再明确主视觉层级、标题节奏、CTA 与留白约束。",
        "reason": "用户明确要求长期改写当前专家的行为设定。"
      }
    ]
  },
  "message": "用中文直接回答用户，或总结你将执行的动作",
  "postGenerationSummary": "工具执行后，用中文简短复盘结果亮点；如果未执行工具可省略",
  "suggestions": ["可选的后续建议 1", "可选的后续建议 2"]
}`;

  return {
    fullPrompt,
    historyCount: historyMessages.length,
  };
};
