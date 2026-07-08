import type { WorkspaceStyleLibrary } from "../../types";
import { normalizeWorkspaceStyleLibrary } from "./style-library.ts";

export type StyleLibraryDraftTestCase = {
  id: string;
  title: string;
  prompt: string;
  referenceImageUrlsText: string;
  aspectRatio: string;
  imageCount: string;
  model: string;
  expectedFocus: string;
};

export const createEmptyStyleLibraryDraftTestCase = (): StyleLibraryDraftTestCase => ({
  id: `draft-case-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  title: "",
  prompt: "",
  referenceImageUrlsText: "",
  aspectRatio: "",
  imageCount: "",
  model: "",
  expectedFocus: "",
});

export type StyleLibraryDraftTestResult = {
  caseId: string;
  outputImageUrlsText: string;
  createdAt: string;
  model: string;
  aspectRatio: string;
  imageCount: string;
  passed: "pending" | "passed" | "failed";
  note: string;
};

export const createEmptyStyleLibraryDraftTestResult = (): StyleLibraryDraftTestResult => ({
  caseId: "",
  outputImageUrlsText: "",
  createdAt: String(Date.now()),
  model: "",
  aspectRatio: "",
  imageCount: "",
  passed: "pending",
  note: "",
});

export type StyleLibraryDraftState = {
  title: string;
  summary: string;
  kind: NonNullable<WorkspaceStyleLibrary["kind"]>;
  coverImageUrl: string;
  referenceImageUrlsText: string;
  keywordsText: string;
  promptText: string;
  tagsText: string;
  description: string;
  useCasesText: string;
  warningsText: string;
  referenceInterpretation: string;
  planningDirectivesText: string;
  promptBackboneText: string;
  promptDirectivesText: string;
  testCases: StyleLibraryDraftTestCase[];
  latestTestResults: StyleLibraryDraftTestResult[];
};

const toLineText = (values: string[] | undefined) =>
  Array.isArray(values) ? values.join("\n") : "";

const toDraftImageCount = (value: number | undefined): string => {
  if (!Number.isFinite(value) || Number(value) <= 0) return "";
  return String(Math.floor(Number(value)));
};

const parseDraftImageCount = (value: string): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
};

export const buildStyleLibraryDraft = (
  library?: WorkspaceStyleLibrary | null,
): StyleLibraryDraftState => {
  const normalized = normalizeWorkspaceStyleLibrary(library);
  return {
    title: normalized?.title || "",
    summary: normalized?.summary || "",
    kind: normalized?.kind || "style_library",
    coverImageUrl: normalized?.coverImageUrl || "",
    referenceImageUrlsText: toLineText(normalized?.referenceImageUrls),
    keywordsText: toLineText(normalized?.keywords),
    promptText: normalized?.promptText || "",
    tagsText: toLineText(normalized?.tags),
    description: normalized?.description || "",
    useCasesText: toLineText(normalized?.useCases),
    warningsText: toLineText(normalized?.warnings),
    referenceInterpretation: normalized?.referenceInterpretation || "",
    planningDirectivesText: toLineText(normalized?.planningDirectives),
    promptBackboneText: toLineText(normalized?.promptBackbone),
    promptDirectivesText: toLineText(normalized?.promptDirectives),
    testCases:
      normalized?.testCases?.map((item) => ({
        id: item.id,
        title: item.title,
        prompt: item.prompt,
        referenceImageUrlsText: toLineText(item.referenceImageUrls),
        aspectRatio: item.aspectRatio || "",
        imageCount: toDraftImageCount(item.imageCount),
        model: item.model || "",
        expectedFocus: item.expectedFocus || "",
      })) || [],
    latestTestResults:
      normalized?.latestTestResults?.map((item) => ({
        caseId: item.caseId,
        outputImageUrlsText: toLineText(item.outputImageUrls),
        createdAt: String(item.createdAt || Date.now()),
        model: item.model || "",
        aspectRatio: item.aspectRatio || "",
        imageCount: toDraftImageCount(item.imageCount),
        passed:
          item.passed === true ? "passed" : item.passed === false ? "failed" : "pending",
        note: item.note || "",
      })) || [],
  };
};

export const parseDirectiveText = (value: string) =>
  String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

export const buildStyleLibraryFromDraft = (
  draft: StyleLibraryDraftState,
  createdBy: WorkspaceStyleLibrary["createdBy"] = "user",
  baseLibrary?: WorkspaceStyleLibrary | null,
): WorkspaceStyleLibrary | undefined =>
  normalizeWorkspaceStyleLibrary({
    id: baseLibrary?.id,
    slug: baseLibrary?.slug,
    title: draft.title,
    summary: draft.summary,
    kind: draft.kind,
    coverImageUrl: String(draft.coverImageUrl || "").trim() || undefined,
    referenceImageUrls: parseDirectiveText(draft.referenceImageUrlsText),
    keywords: parseDirectiveText(draft.keywordsText),
    promptText: String(draft.promptText || "").trim() || undefined,
    tags: parseDirectiveText(draft.tagsText),
    description: String(draft.description || "").trim() || undefined,
    useCases: parseDirectiveText(draft.useCasesText),
    warnings: parseDirectiveText(draft.warningsText),
    testCases: draft.testCases
      .map((item) => ({
        id: String(item.id || "").trim(),
        title: String(item.title || "").trim(),
        prompt: String(item.prompt || "").trim(),
        referenceImageUrls: parseDirectiveText(item.referenceImageUrlsText),
        aspectRatio: String(item.aspectRatio || "").trim() || undefined,
        imageCount: parseDraftImageCount(item.imageCount),
        model: String(item.model || "").trim() || undefined,
        expectedFocus: String(item.expectedFocus || "").trim() || undefined,
      }))
      .filter((item) => item.title && item.prompt),
    latestTestResults: draft.latestTestResults
      .map((item) => ({
        caseId: String(item.caseId || "").trim(),
        outputImageUrls: parseDirectiveText(item.outputImageUrlsText),
        createdAt: Number(item.createdAt || Date.now()),
        model: String(item.model || "").trim() || undefined,
        aspectRatio: String(item.aspectRatio || "").trim() || undefined,
        imageCount: parseDraftImageCount(item.imageCount),
        passed:
          item.passed === "passed"
            ? true
            : item.passed === "failed"
              ? false
              : undefined,
        note: String(item.note || "").trim() || undefined,
      }))
      .filter((item) => item.caseId && item.outputImageUrls.length > 0),
    referenceInterpretation: draft.referenceInterpretation,
    planningDirectives: parseDirectiveText(draft.planningDirectivesText),
    promptBackbone: parseDirectiveText(draft.promptBackboneText),
    promptDirectives: parseDirectiveText(draft.promptDirectivesText),
    createdBy,
    updatedAt: Date.now(),
  });
