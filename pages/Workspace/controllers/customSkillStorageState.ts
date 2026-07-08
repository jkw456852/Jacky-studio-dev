export type CustomSkillStorageState =
  | "markdown-backed"
  | "runtime-only"
  | "missing-markdown-asset";

export interface CustomSkillStorageNotice {
  tone: "neutral" | "info" | "warning";
  title: string;
  body: string;
}

export const formatCustomSkillStorageLabel = (
  state: CustomSkillStorageState | null | undefined,
): string => {
  switch (state) {
    case "runtime-only":
      return "仅运行时配置";
    case "missing-markdown-asset":
      return "Markdown 资源缺失";
    case "markdown-backed":
    default:
      return "Markdown 已落盘";
  }
};

export const formatCustomSkillStorageBadgeLabel = (
  state: CustomSkillStorageState | null | undefined,
): string | null => {
  switch (state) {
    case "runtime-only":
      return "仅运行时";
    case "missing-markdown-asset":
      return "源文件缺失";
    case "markdown-backed":
    default:
      return null;
  }
};

export const formatCustomSkillDeleteLabel = (
  state: CustomSkillStorageState | null | undefined,
): string => {
  switch (state) {
    case "runtime-only":
      return "移除本地 Skill";
    case "missing-markdown-asset":
      return "移除残留 Skill";
    case "markdown-backed":
    default:
      return "删除 Skill";
  }
};

export const getCustomSkillStorageNotice = (
  state: CustomSkillStorageState | null | undefined,
): CustomSkillStorageNotice => {
  switch (state) {
    case "runtime-only":
      return {
        tone: "info",
        title: "当前只有运行时配置",
        body: "保存会继续更新本地 runtime 配置；发布后才会写入 Markdown Skill 文件。",
      };
    case "missing-markdown-asset":
      return {
        tone: "warning",
        title: "原 Markdown 文件缺失",
        body: "当前仍保留 runtime overlay。你可以继续编辑，发布时会按当前内容重建 Markdown Skill 文件。",
      };
    case "markdown-backed":
    default:
      return {
        tone: "neutral",
        title: "当前 Skill 已落盘",
        body: "现在的编辑会先生成或更新 draft；发布后再把内容同步到 Markdown Skill 文件。",
      };
  }
};

export const shouldDeleteCustomSkillMarkdownAsset = (
  state: CustomSkillStorageState | null | undefined,
): boolean => state === "markdown-backed";
