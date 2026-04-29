import type { ChatMessage } from "../../../types";

type AgentData = NonNullable<ChatMessage["agentData"]>;
type WorkflowSkillCall = NonNullable<AgentData["skillCalls"]>[number];

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

export type AgentMessageOneClickView = {
  intro: string;
  sections: Array<{ title: string; body: string }>;
};

const normalizeEscapedNewlines = (value: string): string =>
  (value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n");

export const deriveAgentMessageContent = (
  message: ChatMessage,
): { cleanText: string; proposals: AgentMessageProposal[] } => {
  if (message.agentData?.proposals && message.agentData.proposals.length > 0) {
    return {
      cleanText: message.text,
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
    cleanText: normalizeEscapedNewlines(
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
      title: matched?.description || matched?.title || `Image ${index + 1}`,
    };
  });
};

export const deriveAgentMessageOneClickView = (
  cleanText: string,
  message: ChatMessage,
): AgentMessageOneClickView => {
  if (
    message.skillData?.id !== "xcai-oneclick" &&
    message.text.indexOf("SKYSPER One-Click") === -1
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
