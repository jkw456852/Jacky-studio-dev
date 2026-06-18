import type { ChatMessage } from "../../types";

type SkillData = ChatMessage["skillData"];

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

const getSkillConfig = (skill: SkillData) =>
  skill?.config && typeof skill.config === "object"
    ? (skill.config as Record<string, unknown>)
    : null;

export const getFrontstageSkillId = (skill: SkillData): string => {
  const config = getSkillConfig(skill);
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
  skill: SkillData,
): SkillData => {
  if (!skill) return skill;

  const frontstageId = getFrontstageSkillId(skill);
  const presentation = FRONTSTAGE_SKILL_PRESENTATION[frontstageId];
  if (!presentation) return skill;

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
