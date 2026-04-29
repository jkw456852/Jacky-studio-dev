import type { EcommerceOneClickSessionState } from "../stores/ecommerceOneClick.store";

type PersistEcommerceWorkflowDebugSnapshotOptions = {
  sessionId: string;
  stage: string;
  session: EcommerceOneClickSessionState;
  note?: string;
};

const trimText = (value: unknown, max = 160): string =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const shouldPersistEcommerceWorkflowDebugSnapshot = (): boolean => {
  if (typeof window === "undefined") return false;
  const host = String(window.location.hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
};

const summarizeSession = (session: EcommerceOneClickSessionState) => ({
  step: session.step,
  platformMode: session.platformMode,
  workflowMode: session.workflowMode,
  progress: {
    done: session.progress.done,
    total: session.progress.total,
    text: trimText(session.progress.text, 160),
  },
  description: trimText(session.description, 300),
  analysisSummary: trimText(session.analysisSummary, 600),
  analysisReview: session.analysisReview
    ? {
        confidence: session.analysisReview.confidence,
        verdict: trimText(session.analysisReview.verdict, 240),
        reviewerNotes: (session.analysisReview.reviewerNotes || []).slice(0, 6),
        risks: (session.analysisReview.risks || []).slice(0, 4),
        source: session.analysisReview.source,
        usedFallback: session.analysisReview.usedFallback,
        fallbackReason: trimText(session.analysisReview.fallbackReason, 200),
      }
    : null,
  recommendedTypes: (session.recommendedTypes || []).slice(0, 16).map((item) => ({
    id: item.id,
    title: trimText(item.title, 80),
    description: trimText(item.description, 180),
    imageCount: item.imageCount,
    priority: item.priority,
    selected: item.selected,
    recommended: item.recommended,
    required: item.required,
    confidence: item.confidence,
    reason: trimText(item.reason, 200),
    goal: trimText(item.goal, 120),
    source: item.source,
    usedFallback: item.usedFallback,
    fallbackReason: trimText(item.fallbackReason, 160),
  })),
  productImages: (session.productImages || []).slice(0, 8).map((image) => ({
    id: image.id,
    name: trimText(image.name, 80),
    source: image.source,
  })),
  competitorDecks: (session.competitorDecks || []).slice(0, 6).map((deck) => ({
    id: deck.id,
    name: trimText(deck.name, 120),
    imageCount: Array.isArray(deck.images) ? deck.images.length : 0,
    referenceUrl: trimText(deck.referenceUrl, 200),
  })),
  competitorAnalyses: (session.competitorAnalyses || []).slice(0, 6).map((analysis) => ({
    competitorId: analysis.competitorId,
    competitorName: trimText(analysis.competitorName, 120),
    pageCount: Array.isArray(analysis.pageSequence) ? analysis.pageSequence.length : 0,
    overview: {
      productPositioning: trimText(analysis.overview?.productPositioning, 120),
      overallStyle: trimText(analysis.overview?.overallStyle, 120),
      narrativePattern: trimText(analysis.overview?.narrativePattern, 120),
      conversionStrategy: trimText(analysis.overview?.conversionStrategy, 120),
    },
    recommendedPageSequence: (analysis.planningHints?.recommendedPageSequence || []).slice(0, 8),
    borrowablePrinciples: (analysis.borrowablePrinciples || []).slice(0, 8),
  })),
  competitorPlanningContext: session.competitorPlanningContext
    ? {
        deckCount: session.competitorPlanningContext.deckCount,
        recommendedPageSequence: (session.competitorPlanningContext.recommendedPageSequence || []).slice(0, 8),
        recommendedStoryOrder: (session.competitorPlanningContext.recommendedStoryOrder || []).slice(0, 8),
        recommendedVisualPrinciples: (session.competitorPlanningContext.recommendedVisualPrinciples || []).slice(0, 8),
        recommendedTextPrinciples: (session.competitorPlanningContext.recommendedTextPrinciples || []).slice(0, 8),
        borrowablePrinciples: (session.competitorPlanningContext.borrowablePrinciples || []).slice(0, 8),
        avoidCopying: (session.competitorPlanningContext.avoidCopying || []).slice(0, 8),
        opportunitiesForOurProduct: (session.competitorPlanningContext.opportunitiesForOurProduct || []).slice(0, 8),
      }
    : null,
  supplementFields: (session.supplementFields || []).slice(0, 12).map((field) => ({
    id: field.id,
    label: trimText(field.label, 80),
    kind: field.kind,
    required: field.required,
    valueSource: field.valueSource,
    valueConfidence: field.valueConfidence,
  })),
  planGroups: (session.planGroups || []).slice(0, 8).map((group) => ({
    typeId: group.typeId,
    typeTitle: trimText(group.typeTitle, 80),
    itemCount: Array.isArray(group.items) ? group.items.length : 0,
    summary: trimText(group.summary, 200),
  })),
});

export const persistEcommerceWorkflowDebugSnapshot = async (
  options: PersistEcommerceWorkflowDebugSnapshotOptions,
) => {
  if (!shouldPersistEcommerceWorkflowDebugSnapshot()) {
    return;
  }

  try {
    const response = await fetch("/api/debug-ecommerce-workflow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: options.sessionId,
        stage: options.stage,
        note: options.note || "",
        snapshot: summarizeSession(options.session),
      }),
    });

    if (!response.ok) {
      const failureText = await response.text().catch(() => "");
      console.warn("[ecommerceWorkflowDebug] snapshot persist failed", {
        sessionId: options.sessionId,
        stage: options.stage,
        status: response.status,
        bodyPreview: failureText.slice(0, 200),
      });
      return;
    }

    const persisted = await response.json().catch(() => null);
    console.info("[ecommerceWorkflowDebug] snapshot persisted", {
      sessionId: options.sessionId,
      stage: options.stage,
      latestSnapshotPath: persisted?.latestSnapshotPath || null,
      dailyLogPath: persisted?.dailyLogPath || null,
    });
  } catch (error) {
    console.warn("[ecommerceWorkflowDebug] snapshot persist failed", {
      sessionId: options.sessionId,
      stage: options.stage,
      error: error instanceof Error ? error.message : String(error || "unknown_error"),
    });
  }
};
