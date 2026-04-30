import type { CanvasElement, WorkspaceStyleLibrary } from "../../types";
import { getStudioUserAssetApi } from "../runtime-assets/api";
import { getStudioStyleLibraryAsset } from "../runtime-assets/studio-registry";

export type WorkspaceStyleLibraryMode = NonNullable<
  CanvasElement["genReferenceRoleMode"]
>;

export type WorkspaceBuiltInStyleLibraryMode = Exclude<
  WorkspaceStyleLibraryMode,
  "none" | "custom"
>;

type StyleLibraryModeMeta = {
  label: string;
  hint: string;
};

export const STYLE_LIBRARY_MODE_META: Record<
  WorkspaceStyleLibraryMode,
  StyleLibraryModeMeta
> = {
  none: {
    label: "无约束",
    hint: "关闭默认风格库约束，但仍尽量保留主体与品牌信息。",
  },
  default: {
    label: getStudioStyleLibraryAsset("default").label,
    hint: getStudioStyleLibraryAsset("default").hint,
  },
  "poster-product": {
    label: getStudioStyleLibraryAsset("poster-product").label,
    hint: getStudioStyleLibraryAsset("poster-product").hint,
  },
  custom: {
    label: "自定义",
    hint:
      "由主脑或你自己临时组织出来的风格库，专门描述这次任务的参考图解释方式和生成约束。",
  },
};

export const STYLE_LIBRARY_PRESETS: Record<
  WorkspaceBuiltInStyleLibraryMode,
  WorkspaceStyleLibrary
> = {
  default: getStudioStyleLibraryAsset("default").library,
  "poster-product": getStudioStyleLibraryAsset("poster-product").library,
};

const trimLineArray = (value: unknown, limit = 8, maxLength = 180) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, limit);
};

export const cloneWorkspaceStyleLibrary = (
  library: WorkspaceStyleLibrary,
): WorkspaceStyleLibrary => ({
  id: library.id,
  slug: library.slug,
  title: library.title,
  summary: library.summary,
  referenceInterpretation: library.referenceInterpretation,
  planningDirectives: [...library.planningDirectives],
  promptDirectives: [...library.promptDirectives],
  createdBy: library.createdBy,
  updatedAt: library.updatedAt,
  sourceMode: library.sourceMode,
});

export const normalizeWorkspaceStyleLibrary = (
  value: unknown,
): WorkspaceStyleLibrary | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const title = String(raw.title || "").trim().slice(0, 80);
  const summary = String(raw.summary || "").trim().slice(0, 240);
  const referenceInterpretation = String(raw.referenceInterpretation || "")
    .trim()
    .slice(0, 280);
  const planningDirectives = trimLineArray(raw.planningDirectives, 8, 180);
  const promptDirectives = trimLineArray(raw.promptDirectives, 8, 180);
  const id = String(raw.id || "").trim();
  const slug = String(raw.slug || "").trim();
  const createdBy = String(raw.createdBy || "").trim();
  const sourceMode = String(raw.sourceMode || "").trim();
  const updatedAt = Number(raw.updatedAt);

  if (
    !title ||
    !summary ||
    !referenceInterpretation ||
    planningDirectives.length === 0 ||
    promptDirectives.length === 0
  ) {
    return undefined;
  }

  return {
    id: id || undefined,
    slug: slug || undefined,
    title,
    summary,
    referenceInterpretation,
    planningDirectives,
    promptDirectives,
    createdBy:
      createdBy === "system" ||
      createdBy === "main-brain" ||
      createdBy === "user"
        ? createdBy
        : undefined,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : undefined,
    sourceMode:
      sourceMode === "default" ||
      sourceMode === "poster-product" ||
      sourceMode === "custom"
        ? sourceMode
        : undefined,
  };
};

export const getPresetStyleLibrary = (
  mode: WorkspaceBuiltInStyleLibraryMode,
): WorkspaceStyleLibrary => cloneWorkspaceStyleLibrary(STYLE_LIBRARY_PRESETS[mode]);

export const getStyleLibraryLabel = (
  mode: CanvasElement["genReferenceRoleMode"] | null | undefined,
  customLibrary?: WorkspaceStyleLibrary | null,
) => {
  const normalizedMode = (mode || "default") as WorkspaceStyleLibraryMode;
  if (normalizedMode === "custom") {
    return (
      String(customLibrary?.title || "").trim() ||
      STYLE_LIBRARY_MODE_META.custom.label
    );
  }
  return STYLE_LIBRARY_MODE_META[normalizedMode].label;
};

export const getEffectiveStyleLibrary = (args: {
  mode: CanvasElement["genReferenceRoleMode"] | null | undefined;
  customLibrary?: WorkspaceStyleLibrary | null;
}): WorkspaceStyleLibrary | undefined => {
  const normalizedMode = (args.mode || "default") as WorkspaceStyleLibraryMode;
  if (normalizedMode === "none") {
    return undefined;
  }
  if (normalizedMode === "custom") {
    return normalizeWorkspaceStyleLibrary(args.customLibrary);
  }
  if (normalizedMode === "default" || normalizedMode === "poster-product") {
    return getPresetStyleLibrary(normalizedMode);
  }
  return undefined;
};

export const createStyleLibraryDraftFromMode = (
  mode: CanvasElement["genReferenceRoleMode"] | null | undefined,
  createdBy: WorkspaceStyleLibrary["createdBy"] = "user",
): WorkspaceStyleLibrary => {
  const normalizedMode =
    mode === "poster-product" ? "poster-product" : "default";
  const preset = getPresetStyleLibrary(normalizedMode);
  return {
    ...preset,
    createdBy,
    updatedAt: Date.now(),
    sourceMode: normalizedMode,
  };
};

export const listUserStyleLibraries = (): WorkspaceStyleLibrary[] =>
  getStudioUserAssetApi()
    .listStyleLibraries()
    .map((item) => cloneWorkspaceStyleLibrary(item));

export const listBuiltInStyleLibraries = (): Array<{
  mode: WorkspaceBuiltInStyleLibraryMode;
  library: WorkspaceStyleLibrary;
}> => [
  {
    mode: "default",
    library: getPresetStyleLibrary("default"),
  },
  {
    mode: "poster-product",
    library: getPresetStyleLibrary("poster-product"),
  },
];

export const listLayeredStyleLibraries = () => ({
  builtIn: listBuiltInStyleLibraries(),
  user: listUserStyleLibraries(),
});

export const buildBuiltInStyleLibrarySummary = (): string =>
  listBuiltInStyleLibraries()
    .map(
      ({ mode, library }) =>
        `- ${mode}: ${library.title}
  - Summary: ${library.summary}
  - Reference interpretation: ${library.referenceInterpretation}`,
    )
    .join("\n");

export const buildUserStyleLibrarySummary = (): string =>
  listUserStyleLibraries()
    .map((library) => {
      const promptHint =
        library.promptDirectives[0] || library.planningDirectives[0] || "";
      return `- ${library.id || library.title}: ${library.title}
  - Summary: ${library.summary}
  - Source mode: ${library.sourceMode || "custom"}
  - Reference interpretation: ${library.referenceInterpretation}
  - First directive: ${promptHint || "No directive available"}`;
    })
    .join("\n");

export const summarizeStyleLibrary = (
  library: WorkspaceStyleLibrary | null | undefined,
) => {
  const normalized = normalizeWorkspaceStyleLibrary(library);
  if (!normalized) return "";
  return normalized.summary || normalized.title;
};
