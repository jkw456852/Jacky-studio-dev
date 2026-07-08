import type { ChatMessage } from "../../types";
import type { AgentSkillData } from "../../types/agent.types.ts";

type SkillData = ChatMessage["skillData"] | AgentSkillData | null | undefined;

const FRONTSTAGE_SKILL_PRESENTATION: Record<
  string,
  {
    name: string;
    iconName: string;
  }
> = {
  "autonomous-video-director": {
    name: "\u89c6\u9891\u521b\u4f5c",
    iconName: "Video",
  },
  "autonomous-social-campaign": {
    name: "\u793e\u5a92\u5185\u5bb9",
    iconName: "Hash",
  },
  "autonomous-brand-system": {
    name: "\u54c1\u724c\u89c6\u89c9",
    iconName: "Lightbulb",
  },
  "ecom-oneclick-workflow": {
    name: "\u7535\u5546\u4e00\u952e\u5de5\u4f5c\u6d41",
    iconName: "Library",
  },
  "clothing-studio-workflow": {
    name: "\u670d\u9970\u5de5\u4f5c\u6d41",
    iconName: "ImageIcon",
  },
  "cn-detail-page": {
    name: "\u4e2d\u6587\u8be6\u60c5\u9875\u5957\u56fe",
    iconName: "Box",
  },
  "jkai-oneclick": {
    name: "JKAI One-Click",
    iconName: "Zap",
  },
};

const SKILL_NAME_ROUTE_LABELS = [
  "Social Media",
  "Branding",
  "Video",
  "E-Commerce",
  "Custom Skill",
];

const SKILL_NAME_EXECUTION_HINTS = [
  "\u4f1a\u5148\u8865\u95ee",
  "\u81ea\u52a8\u8def\u7531",
  "\u76f4\u63a5\u6267\u884c",
  "will clarify first",
  "auto route",
  "direct run",
  "浼氬厛琛ラ棶",
  "鑷\ue044姩璺\ue21c敱",
  "鐩存帴鎵ц\ue511",
];

const getSkillConfig = (skill: SkillData) =>
  skill?.config && typeof skill.config === "object"
    ? (skill.config as Record<string, unknown>)
    : null;

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildSuffixPatterns = () => {
  const routeAlternation = SKILL_NAME_ROUTE_LABELS.map(escapeRegExp).join("|");
  const executionAlternation = SKILL_NAME_EXECUTION_HINTS.map(escapeRegExp).join("|");

  return [
    new RegExp(
      `\\s+(?:${routeAlternation})(?:\\s+Skill)?(?:\\s+(?:${executionAlternation}))*\\s*$`,
      "i",
    ),
    new RegExp(
      `\\s+Skill\\s+(?:${executionAlternation})\\s*$`,
      "i",
    ),
    new RegExp(`\\s+(?:${executionAlternation})\\s*$`, "i"),
  ];
};

const SKILL_NAME_SUFFIX_PATTERNS = buildSuffixPatterns();

export const sanitizeFrontstageSkillName = (value: unknown): string => {
  const original = String(value || "").replace(/\s+/g, " ").trim();
  if (!original) return "";

  let next = original;
  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of SKILL_NAME_SUFFIX_PATTERNS) {
      const candidate = next.replace(pattern, "").trim();
      if (candidate && candidate !== next) {
        next = candidate;
        changed = true;
      }
    }
  }

  return next || original;
};

export const getFrontstageSkillId = (skill: SkillData): string => {
  const config = getSkillConfig(skill);
  if (config?.isCustomSkill === true) {
    return String(skill?.id || "").trim();
  }
  const frontstageId = String(config?.frontstageSkillId || "").trim();
  if (frontstageId) return frontstageId;
  return String(skill?.id || "").trim();
};

export const isUnifiedSidebarAgentSkill = (skill: SkillData): boolean => {
  const config = getSkillConfig(skill);
  return (
    config?.allowAutonomousRouting === true &&
    config?.mode === "unified-sidebar-agent"
  );
};

export const getFrontstageSkillLabelKind = (
  skill: SkillData,
): "skill" | "workflow" | "my-skill" => {
  const config = getSkillConfig(skill);
  if (config?.isCustomSkill === true) return "my-skill";

  const skillId = String(skill?.id || "").trim();
  if (
    skillId === "ecom-oneclick-workflow" ||
    skillId === "clothing-studio-workflow"
  ) {
    return "workflow";
  }

  return "skill";
};

export const normalizeFrontstageSkillPresentation = (
  skill: ChatMessage["skillData"],
): ChatMessage["skillData"] => {
  if (!skill) return skill;

  const frontstageId = getFrontstageSkillId(skill);
  const presentation = FRONTSTAGE_SKILL_PRESENTATION[frontstageId];
  const sanitizedName = sanitizeFrontstageSkillName(skill.name);
  if (!presentation) {
    return sanitizedName && sanitizedName !== skill.name
      ? {
          ...skill,
          name: sanitizedName,
        }
      : skill;
  }

  const config = getSkillConfig(skill);
  const nextConfig =
    config && String(config.frontstageSkillId || "").trim() !== frontstageId
      ? { ...config, frontstageSkillId: frontstageId }
      : config;

  return {
    ...skill,
    name: presentation.name,
    iconName: presentation.iconName,
    ...(nextConfig ? { config: nextConfig } : {}),
  };
};
