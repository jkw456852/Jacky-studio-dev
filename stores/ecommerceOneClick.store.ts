import { create } from 'zustand';
import type {
  EcommerceAnalysisReview,
  EcommerceArchetypeEvolutionProposal,
  EcommerceBatchJob,
  EcommerceCompetitorDeckAnalysis,
  EcommerceCompetitorDeckInput,
  EcommerceCompetitorPlanningContext,
  EcommerceCompetitorStrategyMode,
  EcommerceImageAnalysis,
  EcommercePlatformMode,
  EcommerceModelOption,
  EcommercePlanGroup,
  EcommerceRecommendedType,
  EcommerceResultItem,
  EcommerceStageReview,
  EcommerceSupplementField,
  EcommerceWorkflowImage,
  EcommerceWorkflowMode,
  EcommerceWorkflowStep,
} from '../types/workflow.types';
import { buildCompetitorPlanningContext } from '../utils/ecommerce-competitor-planning';

type ProgressState = {
  done: number;
  total: number;
  text?: string;
};

const normalizeCompetitorStrategyMode = (
  value: unknown,
): EcommerceCompetitorStrategyMode => {
  switch (value) {
    case 'off':
    case 'sequence-only':
    case 'sequence-story':
    case 'full':
      return value;
    default:
      return 'sequence-story';
  }
};

export type EcommerceOneClickSessionState = {
  step: EcommerceWorkflowStep;
  platformMode: EcommercePlatformMode;
  workflowMode: EcommerceWorkflowMode;
  productImages: EcommerceWorkflowImage[];
  competitorDecks: EcommerceCompetitorDeckInput[];
  competitorAnalyses: EcommerceCompetitorDeckAnalysis[];
  competitorPlanningContext: EcommerceCompetitorPlanningContext | null;
  competitorPlanningStrategyMode: EcommerceCompetitorStrategyMode;
  competitorGenerationStrategyMode: EcommerceCompetitorStrategyMode;
  competitorStrategyMode: EcommerceCompetitorStrategyMode;
  description: string;
  analysisSummary: string;
  analysisReview: EcommerceAnalysisReview | null;
  analysisEvolutionProposals: EcommerceArchetypeEvolutionProposal[];
  recommendedTypes: EcommerceRecommendedType[];
  supplementFields: EcommerceSupplementField[];
  imageAnalyses: EcommerceImageAnalysis[];
  imageAnalysisReview: EcommerceStageReview | null;
  planGroups: EcommercePlanGroup[];
  planReview: EcommerceStageReview | null;
  modelOptions: EcommerceModelOption[];
  selectedModelId: string | null;
  batchJobs: EcommerceBatchJob[];
  results: EcommerceResultItem[];
  editingResultUrl: string | null;
  overlayPanelOpen: boolean;
  preferredOverlayTemplateId?: string | null;
  progress: ProgressState;
};

type EcommerceOneClickStore = {
  sessions: Record<string, EcommerceOneClickSessionState>;
  activeSessionId: string;
  actions: {
    getSession: (sessionId: string) => EcommerceOneClickSessionState;
    setActiveSession: (sessionId: string) => void;
    createSession: (sessionId: string) => void;
    deleteSession: (sessionId: string) => void;
    hydrateSession: (
      payload: Partial<EcommerceOneClickSessionState>,
      sessionId?: string,
    ) => void;
    reset: (sessionId?: string) => void;
    setStep: (step: EcommerceWorkflowStep, sessionId?: string) => void;
    setPlatformMode: (mode: EcommercePlatformMode, sessionId?: string) => void;
    setWorkflowMode: (mode: EcommerceWorkflowMode, sessionId?: string) => void;
    addProductImages: (images: EcommerceWorkflowImage[], sessionId?: string) => void;
    setCompetitorDecks: (
      decks: EcommerceCompetitorDeckInput[],
      sessionId?: string,
    ) => void;
    setCompetitorAnalyses: (
      analyses: EcommerceCompetitorDeckAnalysis[],
      sessionId?: string,
    ) => void;
    setCompetitorPlanningContext: (
      context: EcommerceCompetitorPlanningContext | null,
      sessionId?: string,
    ) => void;
    setCompetitorPlanningStrategyMode: (
      mode: EcommerceCompetitorStrategyMode,
      sessionId?: string,
    ) => void;
    setCompetitorGenerationStrategyMode: (
      mode: EcommerceCompetitorStrategyMode,
      sessionId?: string,
    ) => void;
    setCompetitorStrategyMode: (
      mode: EcommerceCompetitorStrategyMode,
      sessionId?: string,
    ) => void;
    setDescription: (description: string, sessionId?: string) => void;
    setAnalysisSummary: (summary: string, sessionId?: string) => void;
    setAnalysisReview: (
      review: EcommerceAnalysisReview | null,
      sessionId?: string,
    ) => void;
    setAnalysisEvolutionProposals: (
      proposals: EcommerceArchetypeEvolutionProposal[],
      sessionId?: string,
    ) => void;
    setRecommendedTypes: (items: EcommerceRecommendedType[], sessionId?: string) => void;
    setSupplementFields: (fields: EcommerceSupplementField[], sessionId?: string) => void;
    setImageAnalyses: (items: EcommerceImageAnalysis[], sessionId?: string) => void;
    setImageAnalysisReview: (
      review: EcommerceStageReview | null,
      sessionId?: string,
    ) => void;
    setPlanGroups: (groups: EcommercePlanGroup[], sessionId?: string) => void;
    setPlanReview: (review: EcommerceStageReview | null, sessionId?: string) => void;
    setModelOptions: (models: EcommerceModelOption[], sessionId?: string) => void;
    setSelectedModelId: (modelId: string | null, sessionId?: string) => void;
    setBatchJobs: (jobs: EcommerceBatchJob[], sessionId?: string) => void;
    setResults: (images: EcommerceResultItem[], sessionId?: string) => void;
    setEditingResultUrl: (url: string | null, sessionId?: string) => void;
    setOverlayPanelOpen: (open: boolean, sessionId?: string) => void;
    setPreferredOverlayTemplateId: (
      templateId: string | null,
      sessionId?: string,
    ) => void;
    setProgress: (progress: ProgressState, sessionId?: string) => void;
  };
};

const DEFAULT_MODELS: EcommerceModelOption[] = [
  {
    id: 'Nano Banana Pro',
    name: 'Nano Banana Pro',
    provider: 'default',
    promptLanguage: 'en',
    imageSize: '2K',
    webSearch: true,
    thinkingLevel: 'high',
    languageOptions: ['zh', 'en'],
    bestFor: ['高质量商品主视觉', '复杂卖点与质感表达'],
  },
  {
    id: 'NanoBanana2',
    name: 'Nano Banana 2',
    provider: 'default',
    promptLanguage: 'en',
    imageSize: '2K',
    webSearch: true,
    thinkingLevel: 'high',
    languageOptions: ['zh', 'en'],
    bestFor: ['批量电商出图', '高一致性商品视觉'],
  },
  {
    id: 'Seedream5.0',
    name: 'Seedream 5.0',
    provider: 'default',
    promptLanguage: 'zh',
    imageSize: '2K',
    webSearch: false,
    thinkingLevel: 'medium',
    languageOptions: ['zh'],
    bestFor: ['商品主图', '细节特写', '氛围感表达'],
  },
];

const normalizeModelId = (value: string | null | undefined): string => {
  const normalized = String(value || '').trim().toLowerCase();
  if (
    normalized === 'nanobanana2' ||
    normalized === 'nanobanana 2' ||
    normalized === 'nano banana 2' ||
    normalized === 'nanobanana2'
  ) {
    return 'NanoBanana2';
  }
  if (normalized === 'nano banana pro' || normalized === 'nanobanana pro') {
    return 'Nano Banana Pro';
  }
  if (
    normalized === 'seedream5.0' ||
    normalized === 'seedream 5.0' ||
    normalized === 'seedream 4' ||
    normalized === 'seedream4'
  ) {
    return 'Seedream5.0';
  }
  return String(value || '').trim();
};

const normalizeModelName = (value: string | null | undefined): string => {
  const normalizedId = normalizeModelId(value);
  if (normalizedId === 'NanoBanana2') return 'Nano Banana 2';
  if (normalizedId === 'Nano Banana Pro') return 'Nano Banana Pro';
  if (normalizedId === 'Seedream5.0') return 'Seedream 5.0';
  return String(value || '').trim();
};

const normalizeWorkflowStep = (
  value: EcommerceWorkflowStep | 'LOCK_MODEL' | null | undefined,
): EcommerceWorkflowStep => {
  if (value === 'LOCK_MODEL') {
    return 'FINALIZE_PROMPTS';
  }
  return value || 'WAIT_PRODUCT';
};

const normalizeModelOptions = (
  models: EcommerceModelOption[] | undefined,
): EcommerceModelOption[] => {
  const merged = new Map<string, EcommerceModelOption>();

  DEFAULT_MODELS.forEach((model) => {
    merged.set(model.id, { ...model });
  });

  (models || []).forEach((model) => {
    const normalizedId = normalizeModelId(model.id || model.name);
    if (!normalizedId) {
      return;
    }
    const defaultModel = DEFAULT_MODELS.find((item) => item.id === normalizedId);
    merged.set(normalizedId, {
      ...(defaultModel || model),
      ...model,
      id: normalizedId,
      name: normalizeModelName(model.name || normalizedId),
    });
  });

  return Array.from(merged.values());
};

const dedupeCompetitorDecks = (
  decks: EcommerceCompetitorDeckInput[] | null | undefined,
): EcommerceCompetitorDeckInput[] => {
  if (!Array.isArray(decks) || decks.length === 0) {
    return [];
  }

  const merged = new Map<string, EcommerceCompetitorDeckInput>();

  for (const deck of decks) {
    const id = String(deck?.id || '').trim();
    if (!id) continue;

    const previous = merged.get(id);
    const normalizedImages = Array.isArray(deck.images)
      ? deck.images
          .filter((image) => String(image?.id || image?.url || '').trim().length > 0)
          .map((image, index) => ({
            ...image,
            id: String(image.id || `${id}-image-${index + 1}`).trim(),
            url: String(image.url || '').trim(),
          }))
          .filter((image) => image.url.length > 0)
      : [];

    const nextDeck: EcommerceCompetitorDeckInput = {
      ...previous,
      ...deck,
      id,
      imageAnalyses: (Array.isArray(deck.imageAnalyses) ? deck.imageAnalyses : [])
        .map((item, index) => ({
          ...item,
          id: String(item?.id || `${id}:analysis-${index + 1}`).trim(),
          deckId: id,
          imageId: String(item?.imageId || "").trim(),
          imageUrl: String(item?.imageUrl || "").trim(),
        }))
        .filter(
          (item) =>
            item.imageId.length > 0 &&
            normalizedImages.some((image) => image.id === item.imageId),
        ),
      images: normalizedImages,
    };

    merged.set(id, nextDeck);
  }

  return Array.from(merged.values());
};

const dedupeCompetitorAnalyses = (
  analyses: EcommerceCompetitorDeckAnalysis[] | null | undefined,
): EcommerceCompetitorDeckAnalysis[] => {
  if (!Array.isArray(analyses) || analyses.length === 0) {
    return [];
  }

  const merged = new Map<string, EcommerceCompetitorDeckAnalysis>();

  for (const analysis of analyses) {
    const competitorId = String(analysis?.competitorId || '').trim();
    if (!competitorId) continue;
    merged.set(competitorId, {
      ...analysis,
      competitorId,
    });
  }

  return Array.from(merged.values());
};

const createEmptySession = (): EcommerceOneClickSessionState => ({
  step: 'WAIT_PRODUCT',
  platformMode: 'general',
  workflowMode: 'professional',
  productImages: [],
  competitorDecks: [],
  competitorAnalyses: [],
  competitorPlanningContext: null,
  competitorPlanningStrategyMode: 'sequence-story',
  competitorGenerationStrategyMode: 'sequence-story',
  competitorStrategyMode: 'sequence-story',
  description: '',
  analysisSummary: '',
  analysisReview: null,
  analysisEvolutionProposals: [],
  recommendedTypes: [],
  supplementFields: [],
  imageAnalyses: [],
  imageAnalysisReview: null,
  planGroups: [],
  planReview: null,
  modelOptions: normalizeModelOptions(DEFAULT_MODELS),
  selectedModelId: DEFAULT_MODELS[0]?.id || null,
  batchJobs: [],
  results: [],
  editingResultUrl: null,
  overlayPanelOpen: false,
  preferredOverlayTemplateId: null,
  progress: { done: 0, total: 0, text: '' },
});

const EMPTY_SESSION = createEmptySession();

const dedupeRecommendedTypes = (
  items: EcommerceRecommendedType[] | null | undefined,
): EcommerceRecommendedType[] => {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const merged = new Map<string, EcommerceRecommendedType>();

  for (const item of items) {
    const id = String(item?.id || '').trim();
    if (!id) continue;

    const previous = merged.get(id);
    if (!previous) {
      merged.set(id, {
        ...item,
        id,
        platformTags: Array.from(new Set(item.platformTags || [])),
        highlights: Array.from(new Set(item.highlights || [])),
        evidence: Array.from(new Set(item.evidence || [])),
      });
      continue;
    }

    merged.set(id, {
      ...previous,
      ...item,
      id,
      title:
        String(item.title || '').trim().length >= String(previous.title || '').trim().length
          ? item.title
          : previous.title,
      description:
        String(item.description || '').trim().length >=
        String(previous.description || '').trim().length
          ? item.description
          : previous.description,
      imageCount: Math.max(previous.imageCount || 0, item.imageCount || 0),
      selected: Boolean(previous.selected || item.selected),
      recommended:
        typeof previous.recommended === 'boolean' || typeof item.recommended === 'boolean'
          ? Boolean(previous.recommended || item.recommended)
          : undefined,
      required:
        typeof previous.required === 'boolean' || typeof item.required === 'boolean'
          ? Boolean(previous.required || item.required)
          : undefined,
      platformTags: Array.from(
        new Set([...(previous.platformTags || []), ...(item.platformTags || [])]),
      ),
      highlights: Array.from(
        new Set([...(previous.highlights || []), ...(item.highlights || [])]),
      ),
      evidence: Array.from(
        new Set([...(previous.evidence || []), ...(item.evidence || [])]),
      ),
      reason:
        String(item.reason || '').trim().length >= String(previous.reason || '').trim().length
          ? item.reason
          : previous.reason,
      goal:
        String(item.goal || '').trim().length >= String(previous.goal || '').trim().length
          ? item.goal
          : previous.goal,
      omittedReason:
        String(item.omittedReason || '').trim().length >=
        String(previous.omittedReason || '').trim().length
          ? item.omittedReason
          : previous.omittedReason,
    });
  }

  return Array.from(merged.values());
};

const getOrCreateSession = (
  sessions: Record<string, EcommerceOneClickSessionState>,
  sessionId: string,
): EcommerceOneClickSessionState => sessions[sessionId] || createEmptySession();

export const useEcommerceOneClickStore = create<EcommerceOneClickStore>((set, get) => ({
  sessions: {},
  activeSessionId: '',

  actions: {
    getSession: (sessionId: string) => get().sessions[sessionId] || createEmptySession(),

    setActiveSession: (sessionId: string) => {
      set((state) => {
        const sessions = { ...state.sessions };
        if (!sessions[sessionId]) {
          sessions[sessionId] = createEmptySession();
        }
        return {
          sessions,
          activeSessionId: sessionId,
        };
      });
    },

    createSession: (sessionId: string) => {
      set((state) => ({
        sessions: {
          ...state.sessions,
          [sessionId]: createEmptySession(),
        },
      }));
    },

    deleteSession: (sessionId: string) => {
      set((state) => {
        const sessions = { ...state.sessions };
        delete sessions[sessionId];
        return {
          sessions,
          activeSessionId: state.activeSessionId === sessionId ? '' : state.activeSessionId,
        };
      });
    },

    hydrateSession: (
      payload: Partial<EcommerceOneClickSessionState>,
      sessionId?: string,
    ) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        const competitorDecks = dedupeCompetitorDecks(
          payload.competitorDecks || session.competitorDecks,
        );
        const competitorAnalyses = dedupeCompetitorAnalyses(
          payload.competitorAnalyses || session.competitorAnalyses,
        );
        const competitorPlanningContext =
          payload.competitorPlanningContext !== undefined
            ? payload.competitorPlanningContext
            : competitorAnalyses.length > 0
              ? buildCompetitorPlanningContext(competitorAnalyses)
              : session.competitorPlanningContext;
        return {
          sessions: {
            ...state.sessions,
            [targetId]: {
              ...createEmptySession(),
              ...session,
              ...payload,
              step: normalizeWorkflowStep(payload.step || session.step),
              competitorDecks,
              competitorAnalyses,
              competitorPlanningContext,
              competitorPlanningStrategyMode:
                payload.competitorPlanningStrategyMode !== undefined
                  ? normalizeCompetitorStrategyMode(
                      payload.competitorPlanningStrategyMode,
                    )
                  : payload.competitorStrategyMode !== undefined
                    ? normalizeCompetitorStrategyMode(payload.competitorStrategyMode)
                    : session.competitorPlanningStrategyMode,
              competitorGenerationStrategyMode:
                payload.competitorGenerationStrategyMode !== undefined
                  ? normalizeCompetitorStrategyMode(
                      payload.competitorGenerationStrategyMode,
                    )
                  : payload.competitorStrategyMode !== undefined
                    ? normalizeCompetitorStrategyMode(payload.competitorStrategyMode)
                    : session.competitorGenerationStrategyMode,
              competitorStrategyMode:
                payload.competitorStrategyMode !== undefined
                  ? normalizeCompetitorStrategyMode(payload.competitorStrategyMode)
                  : session.competitorStrategyMode,
              recommendedTypes: dedupeRecommendedTypes(
                payload.recommendedTypes || session.recommendedTypes,
              ),
              modelOptions: normalizeModelOptions(
                payload.modelOptions || session.modelOptions,
              ),
              selectedModelId:
                normalizeModelId(
                  payload.selectedModelId || session.selectedModelId,
                ) || DEFAULT_MODELS[0]?.id || null,
              editingResultUrl:
                payload.editingResultUrl !== undefined
                  ? payload.editingResultUrl
                  : session.editingResultUrl,
              overlayPanelOpen:
                typeof payload.overlayPanelOpen === 'boolean'
                  ? payload.overlayPanelOpen
                  : session.overlayPanelOpen,
              preferredOverlayTemplateId:
                payload.preferredOverlayTemplateId !== undefined
                  ? payload.preferredOverlayTemplateId
                  : session.preferredOverlayTemplateId,
            },
          },
        };
      });
    },

    reset: (sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => ({
        sessions: {
          ...state.sessions,
          [targetId]: createEmptySession(),
        },
      }));
    },

    setStep: (step: EcommerceWorkflowStep, sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, step },
          },
        };
      });
    },

    setPlatformMode: (platformMode: EcommercePlatformMode, sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, platformMode },
          },
        };
      });
    },

    setWorkflowMode: (workflowMode: EcommerceWorkflowMode, sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, workflowMode },
          },
        };
      });
    },

    addProductImages: (images: EcommerceWorkflowImage[], sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        const next = [...session.productImages];
        for (const image of images) {
          if (next.length >= 9) break;
          if (next.some((item) => item.url === image.url)) continue;
          next.push(image);
        }
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, productImages: next },
          },
        };
      });
    },

    setCompetitorDecks: (
      decks: EcommerceCompetitorDeckInput[],
      sessionId?: string,
    ) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: {
              ...session,
              competitorDecks: dedupeCompetitorDecks(decks),
            },
          },
        };
      });
    },

    setCompetitorAnalyses: (
      analyses: EcommerceCompetitorDeckAnalysis[],
      sessionId?: string,
    ) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        const normalizedAnalyses = dedupeCompetitorAnalyses(analyses);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: {
              ...session,
              competitorAnalyses: normalizedAnalyses,
              competitorPlanningContext:
                normalizedAnalyses.length > 0
                  ? buildCompetitorPlanningContext(normalizedAnalyses)
                  : null,
            },
          },
        };
      });
    },

    setCompetitorPlanningContext: (
      competitorPlanningContext: EcommerceCompetitorPlanningContext | null,
      sessionId?: string,
    ) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, competitorPlanningContext },
          },
        };
      });
    },

    setCompetitorPlanningStrategyMode: (
      competitorPlanningStrategyMode: EcommerceCompetitorStrategyMode,
      sessionId?: string,
    ) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: {
              ...session,
              competitorPlanningStrategyMode: normalizeCompetitorStrategyMode(
                competitorPlanningStrategyMode,
              ),
            },
          },
        };
      });
    },

    setCompetitorGenerationStrategyMode: (
      competitorGenerationStrategyMode: EcommerceCompetitorStrategyMode,
      sessionId?: string,
    ) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: {
              ...session,
              competitorGenerationStrategyMode: normalizeCompetitorStrategyMode(
                competitorGenerationStrategyMode,
              ),
            },
          },
        };
      });
    },

    setCompetitorStrategyMode: (
      competitorStrategyMode: EcommerceCompetitorStrategyMode,
      sessionId?: string,
    ) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: {
              ...session,
              competitorPlanningStrategyMode: normalizeCompetitorStrategyMode(
                competitorStrategyMode,
              ),
              competitorGenerationStrategyMode: normalizeCompetitorStrategyMode(
                competitorStrategyMode,
              ),
              competitorStrategyMode: normalizeCompetitorStrategyMode(
                competitorStrategyMode,
              ),
            },
          },
        };
      });
    },

    setDescription: (description: string, sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, description },
          },
        };
      });
    },

    setAnalysisSummary: (summary: string, sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, analysisSummary: summary },
          },
        };
      });
    },

    setAnalysisReview: (
      review: EcommerceAnalysisReview | null,
      sessionId?: string,
    ) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, analysisReview: review },
          },
        };
      });
    },

    setAnalysisEvolutionProposals: (
      proposals: EcommerceArchetypeEvolutionProposal[],
      sessionId?: string,
    ) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, analysisEvolutionProposals: proposals },
          },
        };
      });
    },

    setRecommendedTypes: (items: EcommerceRecommendedType[], sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: {
              ...session,
              recommendedTypes: dedupeRecommendedTypes(items),
            },
          },
        };
      });
    },

    setSupplementFields: (fields: EcommerceSupplementField[], sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, supplementFields: fields },
          },
        };
      });
    },

    setImageAnalyses: (items: EcommerceImageAnalysis[], sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, imageAnalyses: items },
          },
        };
      });
    },

    setImageAnalysisReview: (
      review: EcommerceStageReview | null,
      sessionId?: string,
    ) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, imageAnalysisReview: review },
          },
        };
      });
    },

    setPlanGroups: (groups: EcommercePlanGroup[], sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, planGroups: groups },
          },
        };
      });
    },

    setPlanReview: (review: EcommerceStageReview | null, sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, planReview: review },
          },
        };
      });
    },

    setModelOptions: (models: EcommerceModelOption[], sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        const normalizedModels = normalizeModelOptions(models);
        const selectedModelId =
          normalizedModels.find(
            (item) => item.id === normalizeModelId(session.selectedModelId),
          )?.id ||
          normalizedModels[0]?.id ||
          null;
        return {
          sessions: {
            ...state.sessions,
            [targetId]: {
              ...session,
              modelOptions: normalizedModels,
              selectedModelId,
            },
          },
        };
      });
    },

    setSelectedModelId: (modelId: string | null, sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: {
              ...session,
              selectedModelId: normalizeModelId(modelId),
            },
          },
        };
      });
    },

    setBatchJobs: (jobs: EcommerceBatchJob[], sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, batchJobs: jobs },
          },
        };
      });
    },

    setResults: (images: EcommerceResultItem[], sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, results: images },
          },
        };
      });
    },

    setEditingResultUrl: (editingResultUrl: string | null, sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, editingResultUrl },
          },
        };
      });
    },

    setOverlayPanelOpen: (overlayPanelOpen: boolean, sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, overlayPanelOpen },
          },
        };
      });
    },

    setPreferredOverlayTemplateId: (
      preferredOverlayTemplateId: string | null,
      sessionId?: string,
    ) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, preferredOverlayTemplateId },
          },
        };
      });
    },

    setProgress: (progress: ProgressState, sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, progress },
          },
        };
      });
    },
  },
}));

export const useEcommerceOneClickState = (): EcommerceOneClickSessionState => {
  const sessions = useEcommerceOneClickStore((state) => state.sessions);
  const activeSessionId = useEcommerceOneClickStore((state) => state.activeSessionId);
  return sessions[activeSessionId] || EMPTY_SESSION;
};

export const ecommerceOneClickActions = useEcommerceOneClickStore.getState().actions;
