import type { ChatMessage } from "../../../types";

type AgentData = NonNullable<ChatMessage["agentData"]>;
type WorkflowSkillCall = NonNullable<AgentData["skillCalls"]>[number];
type AgentResearchData = NonNullable<ChatMessage["agentData"]>["research"] extends infer T
  ? NonNullable<T>
  : never;
type AgentResearchCitationItem = NonNullable<
  NonNullable<AgentResearchData["citations"]>[number]
>;
type AgentResearchPageItem = NonNullable<
  NonNullable<AgentResearchData["extractedPages"]>[number]
>;

export type AgentMessageProposal = {
  id: string;
  title?: string;
  description?: string;
  prompt?: string;
  previewUrl?: string;
  concept_image?: string;
  skillCalls?: Array<{
    skillName?: string;
    params?: Record<string, unknown>;
  }>;
};

export type AgentMessageImageCard = {
  url: string;
  title: string;
};

export type AgentMessageExecutionMode =
  | "true_edit"
  | "reference_guided_generate"
  | "generate"
  | "unknown";

export type AgentMessageOneClickView = {
  intro: string;
  sections: Array<{ title: string; body: string }>;
};

export type AgentMessagePlanningBlock = {
  visibleText: string;
  hiddenText: string;
  previewLines: string[];
};

export type AgentMessageResearchCitation = {
  id: string;
  title: string;
  url: string;
  host: string;
  siteName?: string;
  snippet?: string;
  excerpt?: string;
};

export type AgentMessageResearchPage = {
  id: string;
  title: string;
  url: string;
  excerpt?: string;
  cleanedTextExcerpt?: string;
  length?: number;
  error?: string;
};

export type AgentMessageResearchView = {
  status: "searching" | "completed" | "failed";
  statusLabel: string;
  query?: string;
  summary?: string;
  providerLabel?: string;
  fallback: boolean;
  stats: Array<{ label: string; value: string }>;
  steps: Array<{
    key: string;
    label: string;
    status: "done" | "current" | "idle" | "error";
  }>;
  citations: AgentMessageResearchCitation[];
  extractedPages: AgentMessageResearchPage[];
  suggestedQueries: string[];
};

export type AgentMessagePresentationView = {
  kind: "default" | "execution_plan" | "execution_record" | "research";
  statusLabel?: string;
  modeLabel?: string;
  detailTitle?: string;
  detailNotice?: string;
};

const normalizePresentationKind = (
  value: unknown,
): AgentMessagePresentationView["kind"] => {
  const normalized = String(value || "").trim();
  if (
    normalized === "execution_plan" ||
    normalized === "execution_record" ||
    normalized === "research"
  ) {
    return normalized;
  }
  return "default";
};

const normalizeEscapedNewlines = (value: string): string =>
  (value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n");

const LEGACY_MOJIBAKE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/闁圭瑳鍡╂斀濠㈡儼绮剧憴顩?閿涙瓥?/g, "执行失败："],
  [/閹笛嗩攽婢惰精瑙:锛歖?\s*/g, "执行失败："],
  [
    /濞达絿濮峰▓鎴炵▔閹惧磭娼ｉ悹浣瑰礃椤撴悂宕濋埡鍌氼杹闁挎稑鑻惔婊勬媴閻樺啿顥濋柛鎺斿濞撳爼宕ラ崼銉㈠亾閸屾粍鐣卞☉鎾存尭椤?/g,
    "你的专属设计助手，帮你找到最合适的专家",
  ],
  [
    /娴ｇ姷娈戞稉鎾崇潣鐠佹崘顓搁崝鈺傚閿涘苯搴滄担鐘冲閸掔増娓堕崥鍫モ偓鍌滄畱娑撴挸顔?/g,
    "你的专属设计助手，帮你找到最合适的专家",
  ],
];

export const normalizeLegacyAssistantMessageText = (value: string): string => {
  let normalized = normalizeEscapedNewlines(value || "");
  LEGACY_MOJIBAKE_REPLACEMENTS.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement);
  });
  return normalized;
};

const VISUAL_ORCHESTRATION_MARKER = "[Visual Orchestration Plan]";

const truncateText = (value: unknown, maxChars: number): string => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.length > maxChars
    ? `${normalized.slice(0, Math.max(0, maxChars - 1))}…`
    : normalized;
};

const readHostFromUrl = (url: unknown): string => {
  try {
    const host = new URL(String(url || "")).hostname.replace(/^www\./i, "");
    return host || "来源";
  } catch {
    return "来源";
  }
};

const normalizeResearchCitation = (
  item: AgentResearchCitationItem,
  index: number,
): AgentMessageResearchCitation | null => {
  const url = String(item?.url || "").trim();
  if (!/^https?:\/\//i.test(url)) return null;
  const title = String(item?.title || "").trim() || `来源 ${index + 1}`;

  return {
    id: `${url}#${index}`,
    title,
    url,
    host: String(item?.host || "").trim() || readHostFromUrl(url),
    siteName: String(item?.siteName || "").trim() || undefined,
    snippet: truncateText(item?.snippet, 220) || undefined,
    excerpt: truncateText(item?.excerpt, 360) || undefined,
  };
};

const normalizeResearchPage = (
  item: AgentResearchPageItem,
  index: number,
): AgentMessageResearchPage | null => {
  const url = String(item?.url || "").trim();
  if (!/^https?:\/\//i.test(url)) return null;

  return {
    id: `${url}#page-${index}`,
    title: String(item?.title || "").trim() || `网页摘录 ${index + 1}`,
    url,
    excerpt: truncateText(item?.excerpt, 260) || undefined,
    cleanedTextExcerpt: truncateText(item?.cleanedTextExcerpt, 600) || undefined,
    length: typeof item?.length === "number" ? item.length : undefined,
    error: truncateText(item?.error, 180) || undefined,
  };
};

export const deriveAgentMessagePlanningBlock = (
  cleanText: string,
): AgentMessagePlanningBlock | null => {
  const normalized = normalizeEscapedNewlines(cleanText).trim();
  const markerIndex = normalized.indexOf(VISUAL_ORCHESTRATION_MARKER);
  if (markerIndex < 0) return null;

  const visibleText = normalized.slice(0, markerIndex).trim();
  const hiddenText = normalized.slice(markerIndex).trim();
  if (!hiddenText) return null;

  const previewLines = hiddenText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^\[.*\]$/.test(line))
    .slice(0, 3);

  return {
    visibleText,
    hiddenText,
    previewLines,
  };
};

export const deriveAgentMessageContent = (
  message: ChatMessage,
): { cleanText: string; proposals: AgentMessageProposal[] } => {
  if (message.agentData?.proposals && message.agentData.proposals.length > 0) {
    return {
      cleanText: normalizeLegacyAssistantMessageText(message.text),
      proposals: message.agentData.proposals.map((proposal) => ({
        id: proposal.id,
        title: proposal.title,
        description: proposal.description,
        prompt: proposal.prompt,
        previewUrl: proposal.previewUrl,
        concept_image: proposal.concept_image,
        skillCalls: proposal.skillCalls,
      })),
    };
  }

  const hasExecuted =
    (message.agentData?.imageUrls?.length || 0) > 0 ||
    (message.agentData?.assets?.length || 0) > 0;

  const proposalRegex = /```json:generation\n([\s\S]*?)\n```/g;
  const foundProposals: AgentMessageProposal[] = [];
  let match: RegExpExecArray | null;
  let parsedIndex = 0;

  while ((match = proposalRegex.exec(message.text)) !== null) {
    try {
      if (!hasExecuted) {
        const parsed = JSON.parse(match[1]) as Partial<AgentMessageProposal>;
        foundProposals.push({
          id: parsed.id || `parsed-proposal-${parsedIndex}`,
          title: parsed.title,
          description: parsed.description,
          prompt: parsed.prompt,
          previewUrl: parsed.previewUrl,
          concept_image: parsed.concept_image,
          skillCalls: parsed.skillCalls,
        });
        parsedIndex += 1;
      }
    } catch (error) {
      console.error("Failed to parse generation proposal", error);
    }
  }

  return {
    cleanText: normalizeLegacyAssistantMessageText(
      message.text.replace(proposalRegex, "").trim(),
    ),
    proposals: foundProposals,
  };
};

export const deriveAgentMessageImageCards = (
  agentData: ChatMessage["agentData"],
): AgentMessageImageCard[] => {
  const urls: string[] = agentData?.imageUrls || [];
  const skillCalls: WorkflowSkillCall[] = agentData?.skillCalls || [];
  const successfulImageCalls = skillCalls.filter(
    (skillCall): skillCall is WorkflowSkillCall & { success: true } =>
      Boolean(skillCall?.success) && skillCall?.skillName === "generateImage",
  );

  return urls.map((url, index) => {
    const matched = successfulImageCalls[index];
    return {
      url,
      title: matched?.description || matched?.title || `鍥剧墖 ${index + 1}`,
    };
  });
};

export const deriveAgentMessagePresentation = (
  agentData: ChatMessage["agentData"],
): AgentMessagePresentationView | null => {
  const presentation = agentData?.presentation;
  if (!presentation) return null;

  const statusLabel = truncateText(presentation.statusLabel, 40) || undefined;
  const modeLabel = truncateText(presentation.modeLabel, 40) || undefined;
  const detailTitle = truncateText(presentation.detailTitle, 40) || undefined;
  const detailNotice = truncateText(presentation.detailNotice, 220) || undefined;

  if (!statusLabel && !modeLabel && !detailTitle && !detailNotice) {
    return {
      kind: normalizePresentationKind(presentation.kind),
    };
  }

  return {
    kind: normalizePresentationKind(presentation.kind),
    statusLabel,
    modeLabel,
    detailTitle,
    detailNotice,
  };
};

export const deriveAgentMessageExecutionMode = (
  agentData: ChatMessage["agentData"],
): AgentMessageExecutionMode => {
  const skillCalls: WorkflowSkillCall[] = agentData?.skillCalls || [];
  const successfulSmartEdit = skillCalls.find(
    (skillCall) =>
      Boolean(skillCall?.success) && skillCall?.skillName === "smartEdit",
  );
  const successfulGenerate = skillCalls.find(
    (skillCall) =>
      Boolean(skillCall?.success) && skillCall?.skillName === "generateImage",
  );

  if (successfulSmartEdit) {
    const editType = String(successfulSmartEdit.params?.editType || "").trim();
    const hasMask = Boolean(successfulSmartEdit.params?.maskImage);
    const isStructuredEdit =
      hasMask ||
      editType === "object-remove" ||
      editType === "background-remove" ||
      editType === "style-transfer" ||
      editType === "extend";
    return isStructuredEdit ? "true_edit" : "reference_guided_generate";
  }

  if (successfulGenerate) {
    return "generate";
  }

  return "unknown";
};

export const deriveAgentMessageOneClickView = (
  cleanText: string,
  message: ChatMessage,
): AgentMessageOneClickView => {
  if (
    message.skillData?.id !== "jkai-oneclick" &&
    message.skillData?.id !== "xcai-oneclick" &&
    message.text.indexOf("SKYSPER One-Click") === -1 &&
    message.text.indexOf("JKAI One-Click") === -1
  ) {
    return { intro: "", sections: [] };
  }

  const sections: AgentMessageOneClickView["sections"] = [];
  const lines = cleanText.split("\n");
  const intro: string[] = [];
  let currentTitle = "";
  let currentBody: string[] = [];

  const pushCurrent = () => {
    if (currentTitle && currentBody.length > 0) {
      sections.push({ title: currentTitle, body: currentBody.join("\n").trim() });
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/^##\s+/.test(line)) {
      pushCurrent();
      currentTitle = line.replace(/^##\s+/, "").trim();
      currentBody = [];
    } else if (!currentTitle) {
      intro.push(rawLine);
    } else {
      currentBody.push(rawLine);
    }
  }

  pushCurrent();
  return { intro: intro.join("\n").trim(), sections };
};

export const deriveAgentMessageResearchView = (
  message: ChatMessage,
): AgentMessageResearchView | null => {
  const research = message.agentData?.research;
  if (!research) return null;

  const citations = (research.citations || [])
    .map((item, index) => normalizeResearchCitation(item, index))
    .filter((item): item is AgentMessageResearchCitation => Boolean(item));

  const extractedPages = (research.extractedPages || [])
    .map((item, index) => normalizeResearchPage(item, index))
    .filter((item): item is AgentMessageResearchPage => Boolean(item));

  const stats = [
    research.webCount ? { label: "网页", value: String(research.webCount) } : null,
    research.imageCount ? { label: "图片", value: String(research.imageCount) } : null,
    research.extractedCount
      ? { label: "摘录", value: String(research.extractedCount) }
      : null,
    citations.length > 0 ? { label: "引用", value: String(citations.length) } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  const status = research.status;
  const statusLabel =
    status === "searching"
      ? "检索中"
      : status === "failed"
        ? "检索失败"
        : "已检索";

  const steps: AgentMessageResearchView["steps"] = [
    {
      key: "query",
      label: "构造查询",
      status: "done",
    },
    {
      key: "search",
      label: "搜索网页",
      status:
        status === "searching"
          ? "current"
          : status === "failed"
            ? "error"
            : "done",
    },
    {
      key: "extract",
      label: "提取正文",
      status:
        status === "searching"
          ? "idle"
          : status === "failed"
            ? "idle"
            : extractedPages.length > 0
              ? "done"
              : "idle",
    },
    {
      key: "answer",
      label: "整理回答",
      status:
        status === "searching" ? "idle" : status === "failed" ? "idle" : "done",
    },
  ];

  return {
    status,
    statusLabel,
    query: truncateText(research.query, 140) || undefined,
    summary: truncateText(research.summary, 220) || undefined,
    providerLabel: truncateText(research.providerLabel, 80) || undefined,
    fallback: Boolean(research.fallback),
    stats,
    steps,
    citations,
    extractedPages,
    suggestedQueries: (research.suggestedQueries || [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 6),
  };
};

export const deriveProposalPrompt = (
  proposal: AgentMessageProposal,
): string => {
  const promptFromSkillCall = proposal.skillCalls?.find(
    (skillCall) => skillCall?.skillName === "generateImage",
  )?.params?.prompt;

  return (
    proposal.prompt ||
    (typeof proposal.skillCalls?.[0]?.params?.prompt === "string"
      ? proposal.skillCalls[0]?.params?.prompt
      : "") ||
    (typeof promptFromSkillCall === "string" ? promptFromSkillCall : "")
  );
};

const JSON_LIKE_RESPONSE_RE =
  /^\s*[\[{][\s\S]*"(analysis|skillCalls|preGenerationMessage|postGenerationSummary|message|suggestions)"[\s\S]*[\]}]\s*$/i;

const trimWrappedQuotes = (value: string): string => {
  const normalized = String(value || "").trim();
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    return normalized.slice(1, -1).trim();
  }
  return normalized;
};

const parseJsonLikeMessagePayload = (
  value: string,
): {
  message: string;
  analysis: string;
  preGenerationMessage: string;
  postGenerationSummary: string;
  suggestions: string[];
} | null => {
  const normalized = normalizeEscapedNewlines(value).trim();
  if (!normalized || !JSON_LIKE_RESPONSE_RE.test(normalized)) return null;

  try {
    const parsed = JSON.parse(normalized) as Record<string, unknown>;
    const suggestions = Array.isArray(parsed?.suggestions)
      ? parsed.suggestions
          .map((item) => String(item || "").trim())
          .filter(Boolean)
          .slice(0, 6)
      : [];

    return {
      message: trimWrappedQuotes(String(parsed?.message || "")),
      analysis: trimWrappedQuotes(String(parsed?.analysis || "")),
      preGenerationMessage: trimWrappedQuotes(
        String(parsed?.preGenerationMessage || ""),
      ),
      postGenerationSummary: trimWrappedQuotes(
        String(parsed?.postGenerationSummary || ""),
      ),
      suggestions,
    };
  } catch {
    return null;
  }
};

export const deriveUserFacingAssistantText = (
  rawText: string,
  agentData?: ChatMessage["agentData"],
): string => {
  const normalizedText = normalizeLegacyAssistantMessageText(rawText || "").trim();
  const parsed = parseJsonLikeMessagePayload(normalizedText);
  if (parsed) {
    return (
      parsed.message ||
      parsed.postGenerationSummary ||
      trimWrappedQuotes(String(agentData?.postGenerationSummary || "")) ||
      parsed.preGenerationMessage ||
      trimWrappedQuotes(String(agentData?.preGenerationMessage || "")) ||
      ""
    );
  }

  return normalizedText;
};

export const deriveLiveUserFacingText = (
  streamingText: string,
  reasoningText: string,
  progressMessage?: string,
): string => {
  const directText = deriveUserFacingAssistantText(streamingText);
  if (directText) return directText;

  const reasoningPayload = parseJsonLikeMessagePayload(reasoningText);
  if (reasoningPayload) {
    return (
      reasoningPayload.message ||
      reasoningPayload.postGenerationSummary ||
      reasoningPayload.preGenerationMessage ||
      ""
    );
  }

  const normalizedProgress = String(progressMessage || "").trim();
  if (normalizedProgress) return normalizedProgress;

  return "";
};

export const deriveThinkingSummary = (
  reasoningText: string,
  progressMessage?: string,
): string => {
  const reasoningPayload = parseJsonLikeMessagePayload(reasoningText);
  if (reasoningPayload) {
    const steps = [
      reasoningPayload.preGenerationMessage,
      reasoningPayload.message,
      reasoningPayload.postGenerationSummary,
    ]
      .map((item) => String(item || "").trim())
      .filter(Boolean);

    if (steps.length > 0) {
      return Array.from(new Set(steps)).join("\n");
    }
  }

  const normalizedReasoning = normalizeLegacyAssistantMessageText(reasoningText).trim();
  if (
    normalizedReasoning &&
    !JSON_LIKE_RESPONSE_RE.test(normalizedReasoning) &&
    normalizedReasoning.length <= 280
  ) {
    return normalizedReasoning;
  }

  return String(progressMessage || "").trim();
};

