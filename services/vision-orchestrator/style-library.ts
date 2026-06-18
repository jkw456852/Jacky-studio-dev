import type {
  CanvasElement,
  WorkspaceStyleLibrary,
  WorkspaceStyleLibraryTestCase,
  WorkspaceStyleLibraryTestResult,
  WorkspaceStyleLibraryValidationStatus,
} from "../../types";
import { getStudioUserAssetApi } from "../runtime-assets/api.ts";
import { getStudioStyleLibraryAsset } from "../runtime-assets/studio-registry.ts";

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
      "使用你保存的风格库资产，或把当前运行时风格叠加另存为正式风格库后继续复用。",
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

const trimUrlArray = (value: unknown, limit = 30, maxLength = 2000) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, limit);
};

const normalizeStyleLibraryKind = (
  value: unknown,
): WorkspaceStyleLibrary["kind"] | undefined => {
  const normalized = String(value || "").trim();
  if (
    normalized === "style_library" ||
    normalized === "case_transfer" ||
    normalized === "edit_template"
  ) {
    return normalized;
  }
  return undefined;
};

const normalizeStyleLibraryTestCases = (
  value: unknown,
): WorkspaceStyleLibraryTestCase[] => {
  if (!Array.isArray(value)) return [];
  const normalized: WorkspaceStyleLibraryTestCase[] = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== "object" || normalized.length >= 8) return;
    const raw = item as Record<string, unknown>;
    const title = String(raw.title || "").trim().slice(0, 80);
    const prompt = String(raw.prompt || "").trim().slice(0, 4000);
    if (!title || !prompt) return;
    const id = String(raw.id || "").trim() || `test-case-${index + 1}`;
    const referenceImageUrls = trimUrlArray(raw.referenceImageUrls, 8);
    const aspectRatio = String(raw.aspectRatio || "").trim().slice(0, 20);
    const imageCount = Number(raw.imageCount);
    const model = String(raw.model || "").trim().slice(0, 120);
    const expectedFocus = String(raw.expectedFocus || "").trim().slice(0, 220);
    normalized.push({
      id,
      title,
      prompt,
      referenceImageUrls:
        referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
      aspectRatio: aspectRatio || undefined,
      imageCount:
        imageCount === 1 || imageCount === 2 || imageCount === 3 || imageCount === 4
          ? (imageCount as 1 | 2 | 3 | 4)
          : undefined,
      model: model || undefined,
      expectedFocus: expectedFocus || undefined,
    });
  });
  return normalized;
};

const normalizeStyleLibraryTestResults = (
  value: unknown,
): WorkspaceStyleLibraryTestResult[] => {
  if (!Array.isArray(value)) return [];
  const normalized: WorkspaceStyleLibraryTestResult[] = [];
  value.forEach((item) => {
    if (!item || typeof item !== "object" || normalized.length >= 8) return;
    const raw = item as Record<string, unknown>;
    const caseId = String(raw.caseId || "").trim();
    const outputImageUrls = trimUrlArray(raw.outputImageUrls, 8);
    if (!caseId || outputImageUrls.length === 0) return;
    const createdAt = Number(raw.createdAt);
    const aspectRatio = String(raw.aspectRatio || "").trim().slice(0, 20);
    const imageCount = Number(raw.imageCount);
    const model = String(raw.model || "").trim().slice(0, 120);
    const note = String(raw.note || "").trim().slice(0, 280);
    const libraryVersion = Number(raw.libraryVersion);
    normalized.push({
      caseId,
      outputImageUrls,
      createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
      model: model || undefined,
      aspectRatio: aspectRatio || undefined,
      imageCount:
        imageCount === 1 || imageCount === 2 || imageCount === 3 || imageCount === 4
          ? (imageCount as 1 | 2 | 3 | 4)
          : undefined,
      passed: typeof raw.passed === "boolean" ? raw.passed : undefined,
      note: note || undefined,
      libraryVersion:
        Number.isFinite(libraryVersion) && libraryVersion > 0
          ? Math.floor(libraryVersion)
          : undefined,
    });
  });
  return normalized;
};

const normalizeValidationStatus = (
  value: unknown,
): WorkspaceStyleLibraryValidationStatus | undefined => {
  const normalized = String(value || "").trim();
  if (
    normalized === "untested" ||
    normalized === "pending" ||
    normalized === "passed" ||
    normalized === "failed"
  ) {
    return normalized;
  }
  return undefined;
};

const deriveValidationStatus = (
  latestTestResults: WorkspaceStyleLibraryTestResult[],
): WorkspaceStyleLibraryValidationStatus | undefined => {
  const latest = [...latestTestResults].sort((a, b) => b.createdAt - a.createdAt)[0];
  if (!latest) return undefined;
  if (latest.passed === true) return "passed";
  if (latest.passed === false) return "failed";
  return "pending";
};

export const cloneWorkspaceStyleLibrary = (
  library: WorkspaceStyleLibrary,
): WorkspaceStyleLibrary => ({
  id: library.id,
  slug: library.slug,
  title: library.title,
  summary: library.summary,
  coverImageUrl: library.coverImageUrl,
  kind: library.kind,
  referenceImageUrls: [...(library.referenceImageUrls || [])],
  keywords: [...(library.keywords || [])],
  promptText: library.promptText,
  tags: [...(library.tags || [])],
  description: library.description,
  useCases: [...(library.useCases || [])],
  warnings: [...(library.warnings || [])],
  testCases: (library.testCases || []).map((item) => ({
    ...item,
    referenceImageUrls: [...(item.referenceImageUrls || [])],
  })),
  latestTestResults: (library.latestTestResults || []).map((item) => ({
    ...item,
    outputImageUrls: [...item.outputImageUrls],
  })),
  validationStatus: library.validationStatus,
  latestValidatedAt: library.latestValidatedAt,
  version: library.version,
  referenceInterpretation: library.referenceInterpretation,
  planningDirectives: [...library.planningDirectives],
  promptDirectives: [...library.promptDirectives],
  promptBackbone: [...(library.promptBackbone || [])],
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
  const coverImageUrl = String(raw.coverImageUrl || "").trim().slice(0, 2000);
  const kind = normalizeStyleLibraryKind(raw.kind);
  const referenceImageUrls = trimUrlArray(raw.referenceImageUrls, 30);
  const keywords = trimLineArray(raw.keywords, 16, 80);
  const promptText = String(raw.promptText || "").trim().slice(0, 4000);
  const tags = trimLineArray(raw.tags, 16, 80);
  const description = String(raw.description || "").trim().slice(0, 2000);
  const useCases = trimLineArray(raw.useCases, 12, 180);
  const warnings = trimLineArray(raw.warnings, 12, 180);
  const testCases = normalizeStyleLibraryTestCases(raw.testCases);
  const latestTestResults = normalizeStyleLibraryTestResults(raw.latestTestResults);
  const validationStatus = normalizeValidationStatus(raw.validationStatus);
  const latestValidatedAt = Number(raw.latestValidatedAt);
  const version = Number(raw.version);
  const referenceInterpretation = String(raw.referenceInterpretation || "")
    .trim()
    .slice(0, 280);
  const planningDirectives = trimLineArray(raw.planningDirectives, 8, 180);
  const promptDirectives = trimLineArray(raw.promptDirectives, 8, 180);
  const promptBackbone = trimLineArray(raw.promptBackbone, 8, 220);
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

  const normalizedValidationStatus =
    validationStatus || deriveValidationStatus(latestTestResults) || "untested";
  const normalizedLatestValidatedAt = Number.isFinite(latestValidatedAt)
    ? latestValidatedAt
    : latestTestResults[0]?.createdAt;

  return {
    id: id || undefined,
    slug: slug || undefined,
    title,
    summary,
    coverImageUrl: coverImageUrl || undefined,
    kind,
    referenceImageUrls: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
    keywords: keywords.length > 0 ? keywords : undefined,
    promptText: promptText || undefined,
    tags: tags.length > 0 ? tags : undefined,
    description: description || undefined,
    useCases: useCases.length > 0 ? useCases : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
    testCases: testCases.length > 0 ? testCases : undefined,
    latestTestResults:
      latestTestResults.length > 0 ? latestTestResults : undefined,
    validationStatus: normalizedValidationStatus,
    latestValidatedAt: normalizedLatestValidatedAt,
    version:
      Number.isFinite(version) && version > 0 ? Math.floor(version) : undefined,
    referenceInterpretation,
    planningDirectives,
    promptDirectives,
    promptBackbone,
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
  const normalizedMode = (
    mode === "default" ||
    mode === "poster-product" ||
    mode === "custom"
      ? mode
      : "none"
  ) as WorkspaceStyleLibraryMode;
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
  const normalizedMode = (
    args.mode === "default" ||
    args.mode === "poster-product" ||
    args.mode === "custom"
      ? args.mode
      : "none"
  ) as WorkspaceStyleLibraryMode;
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

export const listStyleLibraryCandidates = (): WorkspaceStyleLibrary[] =>
  getStudioUserAssetApi()
    .listStyleLibraryCandidates()
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
  candidates: listStyleLibraryCandidates(),
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
  - Prompt backbone: ${(library.promptBackbone || []).slice(0, 2).join(" | ") || "None"}
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
