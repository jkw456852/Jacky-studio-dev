import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Clipboard,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Link2,
  Loader2,
  MoveLeft,
  MoveRight,
  RefreshCw,
  ScanSearch,
  Trash2,
  X,
} from "lucide-react";
import {
  useEcommerceOneClickState,
  useEcommerceOneClickStore,
} from "../../../../stores/ecommerceOneClick.store";
import {
  CompetitorDeckExtractError,
  extractCompetitorDeckFromUrl,
  type ExtractedCompetitorDeck,
} from "../../../../services/ecommerce-competitor-import";
import {
  clearPersonalCompetitorBrowserAuth,
  fetchPersonalCompetitorBrowserAuthStatus,
  finishPersonalCompetitorBrowserLogin,
  getPersonalCompetitorBrowserClientId,
  startPersonalCompetitorBrowserLogin,
  type PersonalCompetitorBrowserAuthStatus,
} from "../../../../services/competitor-browser-personal-auth";
import type { CompetitorLivePageImportPreview } from "../../../../services/competitor-page-live-import";
import {
  consumeLatestCompetitorLivePageImport,
  copyTaobaoCurrentPageImportScript,
} from "../../../../services/competitor-page-live-import";
import type {
  EcommerceCompetitorDeckAnalysis,
  EcommerceCompetitorDeckInput,
  EcommerceCompetitorImageAnalysisItem,
  EcommerceCompetitorStrategyMode,
} from "../../../../types/workflow.types";
import { resolveStoredTopicAssetUrl } from "../../../../services/topic-memory";
import {
  dispatchEcommercePlanGroupNavigate,
  rankCompetitorDeckMatchesForPlanGroup,
} from "../../../../utils/ecommerce-competitor-ui";

const ECOM_COMPETITOR_ANALYSIS_PROGRESS_EVENT =
  "ecom-competitor-analysis-progress";

type EcommerceCompetitorAnalysisProgressDetail = {
  phase?: "idle" | "running" | "success" | "failed";
  message?: string;
};

type EcommerceCompetitorStrategyPanelProps = {
  workflowBusy?: boolean;
  onUploadCompetitorDeck?: (
    files: File[],
    targetDeckId?: string,
  ) => Promise<void>;
  onImportCompetitorDeckFromUrl?: (
    url: string,
    options?: { title?: string | null; imageUrls?: string[] | null },
  ) => void | Promise<void>;
  onImportExtractedCompetitorDeck?: (
    deck: ExtractedCompetitorDeck,
    options?: { title?: string | null; imageUrls?: string[] | null },
  ) => void | Promise<void>;
  onSetCompetitorDecks?: (
    decks: EcommerceCompetitorDeckInput[],
  ) => void | Promise<void>;
  onAnalyzeCompetitorDecks?: () => void | Promise<void>;
  onRunCompetitorVisionSmokeTest?: (args?: {
    deckId?: string;
    imageIndex?: number;
    model?: string | null;
  }) => void | Promise<unknown>;
};

const buildDeckFallbackName = (index: number) => `套图 ${index + 1}`;
const IMPORT_PREVIEW_LIMIT = 99;
const TAOBAO_IMPORT_RECOVERY_CODES = new Set([
  "taobao_login_gate_detected",
  "taobao_client_render_only",
  "taobao_browser_login_required",
]);

type ImportRecoveryHint = {
  code: string;
  title: string;
  detail: string;
};

type PreviewImageDimension = {
  width: number;
  height: number;
};

type AnalysisRuntimeStatus = {
  tone: "info" | "success" | "error";
  message: string;
};

const listLimit = (items: string[], max = 4) => items.slice(0, max);

const getImageResolutionMetric = (
  image: ExtractedCompetitorDeck["images"][number],
  dimension?: PreviewImageDimension | null,
): number => {
  const width = Math.max(
    0,
    Number(dimension?.width || image.width || 0),
  );
  const height = Math.max(
    0,
    Number(dimension?.height || image.height || 0),
  );
  return Math.max(width, height);
};

const formatResolutionLabel = (
  image: ExtractedCompetitorDeck["images"][number],
  dimension?: PreviewImageDimension | null,
): string | null => {
  const width = Math.max(
    0,
    Number(dimension?.width || image.width || 0),
  );
  const height = Math.max(
    0,
    Number(dimension?.height || image.height || 0),
  );
  if (width <= 0 || height <= 0) {
    return null;
  }
  return `${width}x${height}`;
};

const moveArrayItem = <T,>(items: T[], fromIndex: number, toIndex: number): T[] => {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items;
  }
  const next = items.slice();
  const [target] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, target);
  return next;
};

const getDeckAnalysis = (
  analyses: EcommerceCompetitorDeckAnalysis[],
  deckId: string,
) => analyses.find((analysis) => analysis.competitorId === deckId) || null;

const getDeckImageAnalyses = (
  deck: EcommerceCompetitorDeckInput,
): EcommerceCompetitorImageAnalysisItem[] =>
  Array.isArray(deck.imageAnalyses)
    ? deck.imageAnalyses
        .slice()
        .sort((left, right) => (left.imageIndex || 0) - (right.imageIndex || 0))
    : [];

const getDeckImageAnalysis = (
  deck: EcommerceCompetitorDeckInput,
  imageId: string,
): EcommerceCompetitorImageAnalysisItem | null =>
  getDeckImageAnalyses(deck).find((item) => item.imageId === imageId) || null;

const COMPETITOR_STRATEGY_MODE_OPTIONS: Array<{
  value: EcommerceCompetitorStrategyMode;
  label: string;
  detail: string;
}> = [
  {
    value: "sequence-story",
    label: "页序 + 叙事",
    detail: "参考竞品的页序结构和叙事推进方式，不强行继承具体视觉。",
  },
  {
    value: "sequence-only",
    label: "只参考页序",
    detail: "只借鉴竞品的页面顺序，不注入叙事和视觉层面的约束。",
  },
  {
    value: "full",
    label: "页序 + 叙事 + 视觉",
    detail: "同时参考竞品的页序、叙事节奏和视觉表达，约束最强。",
  },
  {
    value: "off",
    label: "关闭",
    detail: "不把竞品策略注入到当前阶段，完全按我方方案独立生成。",
  },
];

export const EcommerceCompetitorStrategyPanel: React.FC<
  EcommerceCompetitorStrategyPanelProps
> = ({
  workflowBusy = false,
  onUploadCompetitorDeck,
  onImportCompetitorDeckFromUrl,
  onImportExtractedCompetitorDeck,
  onSetCompetitorDecks,
  onAnalyzeCompetitorDecks,
  onRunCompetitorVisionSmokeTest,
}) => {
  const state = useEcommerceOneClickState();
  const setCompetitorPlanningStrategyMode = useEcommerceOneClickStore(
    (store) => store.actions.setCompetitorPlanningStrategyMode,
  );
  const setCompetitorGenerationStrategyMode = useEcommerceOneClickStore(
    (store) => store.actions.setCompetitorGenerationStrategyMode,
  );
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPreviewingImport, setIsPreviewingImport] = useState(false);
  const [importPreviewError, setImportPreviewError] = useState<string | null>(
    null,
  );
  const [importPreview, setImportPreview] = useState<ExtractedCompetitorDeck | null>(
    null,
  );
  const [importPreviewSource, setImportPreviewSource] = useState<
    "url" | "live-page"
  >("url");
  const [selectedPreviewUrls, setSelectedPreviewUrls] = useState<string[]>([]);
  const [importRecoveryHint, setImportRecoveryHint] =
    useState<ImportRecoveryHint | null>(null);
  const [personalBrowserAuthStatus, setPersonalBrowserAuthStatus] =
    useState<PersonalCompetitorBrowserAuthStatus | null>(null);
  const [isPersonalBrowserAuthBusy, setIsPersonalBrowserAuthBusy] = useState(false);
  const [personalBrowserAuthMessage, setPersonalBrowserAuthMessage] = useState<string | null>(null);
  const [resolvedImageUrls, setResolvedImageUrls] = useState<
    Record<string, string>
  >({});
  const [expandedDeckIds, setExpandedDeckIds] = useState<string[]>([]);
  const [pendingUploadDeckId, setPendingUploadDeckId] = useState<string | null>(
    null,
  );
  const [isCopyingLivePageScript, setIsCopyingLivePageScript] = useState(false);
  const [isLoadingLivePageImport, setIsLoadingLivePageImport] = useState(false);
  const [livePageImportMessage, setLivePageImportMessage] = useState<string | null>(
    null,
  );
  const [previewResolutionFilter, setPreviewResolutionFilter] = useState(0);
  const [previewImageDimensions, setPreviewImageDimensions] = useState<
    Record<string, PreviewImageDimension>
  >({});
  const [previewLightboxImage, setPreviewLightboxImage] = useState<
    ExtractedCompetitorDeck["images"][number] | null
  >(null);
  const [analysisRuntimeStatus, setAnalysisRuntimeStatus] =
    useState<AnalysisRuntimeStatus | null>(null);
  const [isRunningVisionSmokeTest, setIsRunningVisionSmokeTest] = useState(false);

  const hasDecks = state.competitorDecks.length > 0;
  const rawAnalysisImageCount = useMemo(
    () =>
      state.competitorDecks.reduce(
        (count, deck) =>
          count +
          getDeckImageAnalyses(deck).filter((item) => item.status === "success").length,
        0,
      ),
    [state.competitorDecks],
  );
  const totalCompetitorImageCount = useMemo(
    () =>
      state.competitorDecks.reduce(
        (count, deck) => count + (Array.isArray(deck.images) ? deck.images.length : 0),
        0,
      ),
    [state.competitorDecks],
  );
  const hasAnalysis =
    state.competitorAnalyses.length > 0 || rawAnalysisImageCount > 0;
  const summary = state.competitorPlanningContext;
  const canAnalyze =
    hasDecks &&
    !workflowBusy &&
    !isUploading &&
    !isImporting &&
    !isPreviewingImport &&
    !isAnalyzing;
  const currentPlanningStrategyMode =
    state.competitorPlanningStrategyMode ||
    state.competitorStrategyMode ||
    "sequence-story";
  const currentGenerationStrategyMode =
    state.competitorGenerationStrategyMode ||
    state.competitorStrategyMode ||
    "sequence-story";
  const currentPlanningStrategyModeMeta =
    COMPETITOR_STRATEGY_MODE_OPTIONS.find(
      (option) => option.value === currentPlanningStrategyMode,
    ) || COMPETITOR_STRATEGY_MODE_OPTIONS[0];
  const currentGenerationStrategyModeMeta =
    COMPETITOR_STRATEGY_MODE_OPTIONS.find(
      (option) => option.value === currentGenerationStrategyMode,
    ) || COMPETITOR_STRATEGY_MODE_OPTIONS[0];
  const personalBrowserClientId = useMemo(
    () => getPersonalCompetitorBrowserClientId(),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const nextEntries = await Promise.all(
        state.competitorDecks.flatMap((deck) =>
          (deck.images || []).map(async (image) => {
            const resolved = await resolveStoredTopicAssetUrl(image.url);
            return [image.id, resolved || ""] as const;
          }),
        ),
      );

      if (cancelled) {
        return;
      }

      setResolvedImageUrls(
        Object.fromEntries(
          nextEntries.filter((entry) => String(entry[1] || "").trim().length > 0),
        ),
      );
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [state.competitorDecks]);

  useEffect(() => {
    const handleAnalysisProgress = (event: Event) => {
      const detail = (event as CustomEvent<EcommerceCompetitorAnalysisProgressDetail>)
        .detail;
      if (!detail?.message) {
        return;
      }

      setAnalysisRuntimeStatus({
        tone:
          detail.phase === "failed"
            ? "error"
            : detail.phase === "success"
              ? "success"
              : "info",
        message: detail.message,
      });
    };

    window.addEventListener(
      ECOM_COMPETITOR_ANALYSIS_PROGRESS_EVENT,
      handleAnalysisProgress as EventListener,
    );
    return () => {
      window.removeEventListener(
        ECOM_COMPETITOR_ANALYSIS_PROGRESS_EVENT,
        handleAnalysisProgress as EventListener,
      );
    };
  }, []);

  const refreshPersonalBrowserAuthStatus = async () => {
    try {
      const status = await fetchPersonalCompetitorBrowserAuthStatus();
      setPersonalBrowserAuthStatus(status);
    } catch (error) {
      setPersonalBrowserAuthMessage(
        error instanceof Error ? error.message : "读取浏览器授权状态失败。",
      );
    }
  };

  useEffect(() => {
    void refreshPersonalBrowserAuthStatus();
  }, []);

  useEffect(() => {
    setPreviewResolutionFilter(0);
  }, [importPreview?.url, importPreview?.images.length]);

  useEffect(() => {
    if (!previewLightboxImage) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewLightboxImage(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewLightboxImage]);

  useEffect(() => {
    if (!importPreview || (importPreview.images || []).length === 0) {
      setPreviewImageDimensions({});
      return;
    }

    let cancelled = false;
    const candidates = (importPreview.images || []).slice(0, IMPORT_PREVIEW_LIMIT);

    const run = async () => {
      const entries = await Promise.all(
        candidates.map(
          (image) =>
            new Promise<readonly [string, PreviewImageDimension | null]>(
              (resolve) => {
                if (
                  typeof image.width === "number" &&
                  image.width > 0 &&
                  typeof image.height === "number" &&
                  image.height > 0
                ) {
                  resolve([
                    image.url,
                    { width: image.width, height: image.height },
                  ] as const);
                  return;
                }

                const probe = new Image();
                probe.onload = () => {
                  resolve([
                    image.url,
                    {
                      width: Number(probe.naturalWidth || 0),
                      height: Number(probe.naturalHeight || 0),
                    },
                  ] as const);
                };
                probe.onerror = () => {
                  resolve([image.url, null] as const);
                };
                probe.src = image.url;
              },
            ),
        ),
      );

      if (cancelled) {
        return;
      }

      setPreviewImageDimensions(
        Object.fromEntries(
          entries.filter(
            (entry): entry is readonly [string, PreviewImageDimension] =>
              Boolean(entry[1]?.width) && Boolean(entry[1]?.height),
          ),
        ),
      );
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [importPreview]);

  const previewResolutionMax = useMemo(
    () =>
      Math.max(
        0,
        ...((importPreview?.images || []).map((image) =>
          getImageResolutionMetric(image, previewImageDimensions[image.url]),
        ) || [0]),
      ),
    [importPreview, previewImageDimensions],
  );

  const previewResolutionThreshold = useMemo(() => {
    if (previewResolutionFilter <= 0 || previewResolutionMax <= 0) {
      return 0;
    }
    return Math.round((previewResolutionMax * previewResolutionFilter) / 100);
  }, [previewResolutionFilter, previewResolutionMax]);

  const filteredPreviewImages = useMemo(() => {
    const images = (importPreview?.images || []).slice(0, IMPORT_PREVIEW_LIMIT);
    if (previewResolutionThreshold <= 0) {
      return images;
    }
    return images.filter(
      (image) =>
        getImageResolutionMetric(image, previewImageDimensions[image.url]) >=
        previewResolutionThreshold,
    );
  }, [importPreview, previewImageDimensions, previewResolutionThreshold]);

  useEffect(() => {
    const allowed = new Set(filteredPreviewImages.map((image) => image.url));
    setSelectedPreviewUrls((current) =>
      current.filter((item) => allowed.has(item)),
    );
  }, [filteredPreviewImages]);

  const visibleSelectedPreviewCount = useMemo(
    () =>
      filteredPreviewImages.reduce(
        (count, image) =>
          selectedPreviewUrls.includes(image.url) ? count + 1 : count,
        0,
      ),
    [filteredPreviewImages, selectedPreviewUrls],
  );

  const allFilteredPreviewImagesSelected =
    filteredPreviewImages.length > 0 &&
    visibleSelectedPreviewCount === filteredPreviewImages.length;

  const previewResolutionSummary =
    previewResolutionThreshold > 0
      ? `>= ${previewResolutionThreshold}px`
      : "\u5168\u90e8";

  const strategyStats = useMemo(
    () => [
      {
        label: "竞品套数",
        value: String(summary?.deckCount || state.competitorDecks.length || 0),
      },
      {
        label: "已分析",
        value:
          rawAnalysisImageCount > 0
            ? `${rawAnalysisImageCount}/${totalCompetitorImageCount || 0} 张`
            : `${state.competitorAnalyses.length}/${state.competitorDecks.length || 0} 套`,
      },
      {
        label: "建议页序",
        value: String(summary?.recommendedPageSequence.length || 0),
      },
    ],
    [
      rawAnalysisImageCount,
      state.competitorAnalyses.length,
      state.competitorDecks.length,
      totalCompetitorImageCount,
      summary?.deckCount,
      summary?.recommendedPageSequence.length,
    ],
  );

  const currentPlanSequence = useMemo(
    () =>
      (state.planGroups || []).map((group, index) => ({
        id: group.typeId,
        order: index + 1,
        title: group.typeTitle,
        closestDecks: rankCompetitorDeckMatchesForPlanGroup({
          group,
          analyses: state.competitorAnalyses || [],
          recommendedPageSequence: summary?.recommendedPageSequence || [],
          maxResults: 2,
        }).map((match, matchIndex) => {
          const analysisIndex = state.competitorAnalyses.findIndex(
            (candidate) => candidate.competitorId === match.competitorId,
          );
          const analysis =
            analysisIndex >= 0 ? state.competitorAnalyses[analysisIndex] : null;
          return {
            competitorId: match.competitorId,
            label:
              analysis?.competitorName ||
              `套图 ${analysisIndex >= 0 ? analysisIndex + 1 : matchIndex + 1}`,
          };
        }),
      })),
    [state.competitorAnalyses, state.planGroups, summary?.recommendedPageSequence],
  );

  const scrollToPlanGroup = (groupId: string) => {
    dispatchEcommercePlanGroupNavigate(groupId);
  };

  const updateDecks = async (nextDecks: EcommerceCompetitorDeckInput[]) => {
    if (!onSetCompetitorDecks) {
      return;
    }
    await onSetCompetitorDecks(nextDecks);
  };

  const updateSingleDeck = async (
    deckId: string,
    patch: Partial<EcommerceCompetitorDeckInput>,
  ) => {
    const nextDecks = state.competitorDecks.map((deck) =>
      deck.id === deckId ? { ...deck, ...patch } : deck,
    );
    await updateDecks(nextDecks);
  };

  const handleRemoveDeck = async (deckId: string) => {
    await updateDecks(state.competitorDecks.filter((deck) => deck.id !== deckId));
  };

  const handleMoveDeck = async (fromIndex: number, toIndex: number) => {
    await updateDecks(moveArrayItem(state.competitorDecks, fromIndex, toIndex));
  };

  const handleRemoveDeckImage = async (deckId: string, imageId: string) => {
    const nextDecks = state.competitorDecks
      .map((deck) => {
        if (deck.id !== deckId) {
          return deck;
        }
        return {
          ...deck,
          images: (deck.images || [])
            .filter((image) => image.id !== imageId)
            .map((image, index) => ({
              ...image,
              pageIndex: index + 1,
            })),
        };
      })
      .filter((deck) => (deck.images || []).length > 0);

    await updateDecks(nextDecks);
  };

  const handleMoveDeckImage = async (
    deckId: string,
    fromIndex: number,
    toIndex: number,
  ) => {
    const nextDecks = state.competitorDecks.map((deck) => {
      if (deck.id !== deckId) {
        return deck;
      }
      const nextImages = moveArrayItem(deck.images || [], fromIndex, toIndex).map(
        (image, index) => ({
          ...image,
          pageIndex: index + 1,
        }),
      );
      return {
        ...deck,
        images: nextImages,
      };
    });
    await updateDecks(nextDecks);
  };

  const toggleDeckAnalysis = (deckId: string) => {
    setExpandedDeckIds((current) =>
      current.includes(deckId)
        ? current.filter((item) => item !== deckId)
        : [...current, deckId],
    );
  };

  const handlePickDeckFiles = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || []).filter((file) =>
      file.type.startsWith("image/"),
    );
    event.target.value = "";

    if (files.length === 0 || !onUploadCompetitorDeck) {
      return;
    }

    setIsUploading(true);
    try {
      await onUploadCompetitorDeck(files, pendingUploadDeckId || undefined);
    } finally {
      setIsUploading(false);
      setPendingUploadDeckId(null);
    }
  };

  const handleAnalyze = async () => {
    if (!onAnalyzeCompetitorDecks) {
      return;
    }

    setAnalysisRuntimeStatus({
      tone: "info",
      message: "正在分析竞品截图，请稍等...",
    });
    setIsAnalyzing(true);
    try {
      await onAnalyzeCompetitorDecks();
      setAnalysisRuntimeStatus({
        tone: "success",
        message: "竞品策略分析完成，已更新到当前面板。",
      });
    } catch {
      setAnalysisRuntimeStatus((current) =>
        current?.tone === "error"
          ? current
          : {
              tone: "error",
              message: "竞品策略分析失败，请检查当前 API 配置或稍后重试。",
            },
      );
      // The controller already writes the workflow error into shared state.
      // Swallow here so React doesn't report an uncaught event-handler promise.
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRunVisionSmokeTest = async () => {
    if (!onRunCompetitorVisionSmokeTest) {
      return;
    }

    setAnalysisRuntimeStatus({
      tone: "info",
      message: "正在跑视觉烟测，检查当前 provider 是否真的读到了图片内容...",
    });
    setIsRunningVisionSmokeTest(true);
    try {
      const result = await onRunCompetitorVisionSmokeTest();
      const payload = result as
        | {
            responsePreview?: string;
            responseText?: string;
            imageIndex?: number;
            latestSnapshotPath?: string | null;
          }
        | null
        | undefined;
      const preview = String(
        payload?.responsePreview || payload?.responseText || "",
      ).trim();
      setAnalysisRuntimeStatus({
        tone: preview ? "success" : "error",
        message: preview
          ? `视觉烟测已返回第 ${payload?.imageIndex || 1} 张图的结果：${preview.slice(0, 120)}`
          : "视觉烟测没有返回有效内容，说明当前 provider 可能没有真正读到图片。",
      });
    } catch {
      setAnalysisRuntimeStatus({
        tone: "error",
        message: "视觉烟测执行失败。",
      });
    } finally {
      setIsRunningVisionSmokeTest(false);
    }
  };

  const handleStartPersonalBrowserLogin = async () => {
    setIsPersonalBrowserAuthBusy(true);
    setPersonalBrowserAuthMessage(null);
    try {
      const status = await startPersonalCompetitorBrowserLogin();
      setPersonalBrowserAuthStatus(status);
      setPersonalBrowserAuthMessage(
        "已拉起浏览器授权流程，请在打开的页面完成登录后回到这里点“完成校验”。",
      );
    } catch (error) {
      setPersonalBrowserAuthMessage(
        error instanceof Error ? error.message : "发起浏览器授权失败。",
      );
    } finally {
      void refreshPersonalBrowserAuthStatus();
      setIsPersonalBrowserAuthBusy(false);
    }
  };

  const handleFinishPersonalBrowserLogin = async () => {
    setIsPersonalBrowserAuthBusy(true);
    setPersonalBrowserAuthMessage(null);
    try {
      const status = await finishPersonalCompetitorBrowserLogin();
      setPersonalBrowserAuthStatus(status);
      setPersonalBrowserAuthMessage(
        "已完成当前浏览器个人授权校验，现在可以读取你当前登录态下的竞品页面了。",
      );
    } catch (error) {
      setPersonalBrowserAuthMessage(
        error instanceof Error ? error.message : "完成浏览器授权校验失败。",
      );
    } finally {
      void refreshPersonalBrowserAuthStatus();
      setIsPersonalBrowserAuthBusy(false);
    }
  };

  const handleClearPersonalBrowserAuth = async () => {
    setIsPersonalBrowserAuthBusy(true);
    setPersonalBrowserAuthMessage(null);
    try {
      const status = await clearPersonalCompetitorBrowserAuth();
      setPersonalBrowserAuthStatus(status);
      setPersonalBrowserAuthMessage("已清除当前浏览器个人授权状态。");
    } catch (error) {
      setPersonalBrowserAuthMessage(
        error instanceof Error ? error.message : "清除浏览器授权状态失败。",
      );
    } finally {
      void refreshPersonalBrowserAuthStatus();
      setIsPersonalBrowserAuthBusy(false);
    }
  };

  const clearImportPreview = () => {
    setImportPreview(null);
    setImportPreviewSource("url");
    setSelectedPreviewUrls([]);
    setImportPreviewError(null);
    setImportRecoveryHint(null);
    setPreviewImageDimensions({});
    setPreviewResolutionFilter(0);
    setPreviewLightboxImage(null);
  };

  const applyImportedPreview = (
    extracted: ExtractedCompetitorDeck | CompetitorLivePageImportPreview,
    source: "url" | "live-page",
  ) => {
    const previewImages = (extracted.images || []).slice(0, IMPORT_PREVIEW_LIMIT);
    setImportPreview({
      ...extracted,
      images: previewImages,
    });
    setImportPreviewSource(source);
    setSelectedPreviewUrls([]);
  };

  const handlePasteCompetitorImages = async (
    event: React.ClipboardEvent<HTMLDivElement>,
  ) => {
    if (!onUploadCompetitorDeck || workflowBusy || isUploading || isImporting) {
      return;
    }

    const files = Array.from(event.clipboardData.items || [])
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));

    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    setIsUploading(true);
    setImportPreviewError(null);

    try {
      await onUploadCompetitorDeck(files);
      setImportRecoveryHint(null);
      setImportUrl("");
    } finally {
      setIsUploading(false);
    }
  };

  const handlePreviewImportFromUrl = async () => {
    const normalizedUrl = importUrl.trim();
    if (!normalizedUrl) {
      return;
    }

    setIsPreviewingImport(true);
    setImportPreviewError(null);
    setImportRecoveryHint(null);
    setLivePageImportMessage(null);
    try {
      const extracted = await extractCompetitorDeckFromUrl(normalizedUrl, {
        clientId: personalBrowserClientId,
      });
      applyImportedPreview(extracted, "url");
    } catch (error) {
      setImportPreview(null);
      setImportPreviewSource("url");
      setSelectedPreviewUrls([]);
      if (
        error instanceof CompetitorDeckExtractError &&
        TAOBAO_IMPORT_RECOVERY_CODES.has(error.code)
      ) {
        setImportRecoveryHint({
          code: error.code,
          title: "当前链接需要换成浏览器侧导入",
          detail:
            error.code === "taobao_browser_login_required"
              ? "这个淘宝页面需要你自己的登录态才能拿到完整图片，建议复制导入脚本到已登录页面执行，再回来读取结果。"
              : "这个页面更适合从当前页控制台直接导入。复制脚本到商品详情页执行后，再回来读取最近一次结果会更稳。",
        });
      }
      setImportPreviewError(
        error instanceof Error
          ? error.message
          : String(error || "Failed to preview competitor images."),
      );
    } finally {
      setIsPreviewingImport(false);
    }
  };

  const handleCopyLivePageImportScript = async () => {
    setIsCopyingLivePageScript(true);
    setLivePageImportMessage(null);
    setImportPreviewError(null);
    try {
      await copyTaobaoCurrentPageImportScript({
        clientId: personalBrowserClientId,
      });
      setLivePageImportMessage(
        "\u5df2\u590d\u5236\u5f53\u524d\u9875\u5bfc\u5165\u811a\u672c\u3002\u8bf7\u5230\u4f60\u81ea\u5df1\u5df2\u767b\u5f55\u7684\u6dd8\u5b9d\u8be6\u60c5\u9875\u63a7\u5236\u53f0\u7c98\u8d34\u56de\u8f66\uff0c\u7136\u540e\u56de\u6765\u70b9\u201c\u8bfb\u53d6\u6700\u8fd1\u4e00\u6b21\u5bfc\u5165\u7ed3\u679c\u201d\u3002",
      );
    } catch (error) {
      setLivePageImportMessage(
        error instanceof Error
          ? error.message
          : "\u590d\u5236\u5f53\u524d\u9875\u5bfc\u5165\u811a\u672c\u5931\u8d25\u3002",
      );
    } finally {
      setIsCopyingLivePageScript(false);
    }
  };

  const handleLoadLivePageImport = async () => {
    setIsLoadingLivePageImport(true);
    setImportPreviewError(null);
    setImportRecoveryHint(null);
    setLivePageImportMessage(null);
    try {
      const extracted = await consumeLatestCompetitorLivePageImport({
        clientId: personalBrowserClientId,
      });
      applyImportedPreview(extracted, "live-page");
      setImportUrl(extracted.url || "");
      setLivePageImportMessage(
        "\u5df2\u8bfb\u53d6\u5230\u6700\u8fd1\u4e00\u6b21\u5f53\u524d\u9875\u5bfc\u5165\u7ed3\u679c\uff0c\u53ef\u4ee5\u5148\u52fe\u9009\u4fdd\u7559\u56fe\u7247\u518d\u5bfc\u5165\u3002",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLivePageImportMessage(
        message === "pending_import_not_found"
          ? "\u8fd8\u6ca1\u6709\u8bfb\u5230\u5f53\u524d\u9875\u63d0\u4ea4\u7ed3\u679c\u3002\u8bf7\u5148\u5728\u6dd8\u5b9d\u8be6\u60c5\u9875\u6267\u884c\u521a\u624d\u590d\u5236\u7684\u5bfc\u5165\u811a\u672c\u3002"
          : message,
      );
    } finally {
      setIsLoadingLivePageImport(false);
    }
  };

  const handleTogglePreviewImage = (imageUrl: string) => {
    setSelectedPreviewUrls((current) =>
      current.includes(imageUrl)
        ? current.filter((item) => item !== imageUrl)
        : [...current, imageUrl],
    );
  };

  const handleToggleAllPreviewImages = () => {
    const imageUrls = filteredPreviewImages.map((item) => item.url);
    if (imageUrls.length === 0) {
      return;
    }

    setSelectedPreviewUrls((current) =>
      imageUrls.every((url) => current.includes(url)) ? [] : imageUrls,
    );
  };

  const handleImportFromPreview = async () => {
    if (!importPreview) {
      return;
    }

    if (visibleSelectedPreviewCount === 0) {
      setImportPreviewError("至少选择 1 张图片后才能导入。");
      return;
    }

    setIsImporting(true);
    try {
      if (importPreviewSource === "live-page") {
        if (!onImportExtractedCompetitorDeck) {
          throw new Error(
            "\u5f53\u524d\u9875\u5bfc\u5165\u901a\u9053\u672a\u63a5\u5165\u5b8c\u6574\u3002",
          );
        }
        await onImportExtractedCompetitorDeck(importPreview, {
          title: importPreview.title,
          imageUrls: selectedPreviewUrls,
        });
      } else {
        if (!onImportCompetitorDeckFromUrl) {
          throw new Error(
            "\u94fe\u63a5\u5bfc\u5165\u901a\u9053\u672a\u63a5\u5165\u5b8c\u6574\u3002",
          );
        }
        await onImportCompetitorDeckFromUrl(importPreview.url || importUrl.trim(), {
          title: importPreview.title,
          imageUrls: selectedPreviewUrls,
        });
      }
      setImportUrl("");
      clearImportPreview();
    } catch {
      // The controller already writes the workflow error into shared state.
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {previewLightboxImage ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4"
          onClick={() => setPreviewLightboxImage(null)}
        >
          <div
            className="relative max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewLightboxImage(null)}
              className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black"
              aria-label="关闭预览"
            >
              <X size={18} />
            </button>
            <div className="border-b border-gray-100 px-4 py-3 pr-14">
              <div className="text-sm font-semibold text-gray-900">
                {previewLightboxImage.name || "预览大图"}
              </div>
              <div className="mt-1 text-[11px] text-gray-500">
                {"双击缩略图可放大查看，按 Esc 关闭"}
              </div>
            </div>
            <div className="flex max-h-[calc(92vh-68px)] items-center justify-center overflow-auto bg-gray-50 p-4">
              <img
                src={previewLightboxImage.url}
                alt={previewLightboxImage.name || "preview-lightbox"}
                className="max-h-full w-auto max-w-full rounded-2xl object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
      <section className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">
              竞品详情页策略参考
            </div>
            <p className="mt-1 text-xs leading-5 text-gray-600">
              上传多套竞品详情页截图，提炼页序、叙事和视觉策略，用于后续方案规划与生图提示注入。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePickDeckFiles}
            />
            <button
              type="button"
              onClick={() => {
                setPendingUploadDeckId(null);
                uploadInputRef.current?.click();
              }}
              disabled={isUploading || workflowBusy}
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-gray-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
              上传竞品截图
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              className="inline-flex items-center gap-2 rounded-2xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <ScanSearch size={14} />}
              {hasAnalysis ? "重新分析策略" : "分析竞品策略"}
            </button>
            <button
              type="button"
              onClick={() => {
                void handleRunVisionSmokeTest();
              }}
              disabled={!hasDecks || workflowBusy || isUploading || isImporting || isAnalyzing || isRunningVisionSmokeTest}
              className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
            >
              {isRunningVisionSmokeTest ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              视觉烟测
            </button>
          </div>
        </div>
        {analysisRuntimeStatus ? (
          <div
            className={`mt-3 rounded-2xl border px-3 py-2 text-[11px] leading-5 shadow-sm ${
              analysisRuntimeStatus.tone === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : analysisRuntimeStatus.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-sky-200 bg-sky-50 text-sky-700"
            }`}
          >
            <div className="flex items-center gap-2">
              {isAnalyzing && analysisRuntimeStatus.tone === "info" ? (
                <Loader2 size={12} className="shrink-0 animate-spin" />
              ) : null}
              <span>{analysisRuntimeStatus.message}</span>
            </div>
          </div>
        ) : null}

        <div className="mt-3 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-3 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-gray-900">
                个人浏览器授权
              </div>
              <div className="mt-1 text-[11px] leading-5 text-gray-600">
                用你当前浏览器自己的登录态读取个人可见的竞品页面。{`\u3000`}
                {personalBrowserAuthStatus?.configured
                  ? "当前已完成授权，可以直接读取登录后的页面内容。"
                  : personalBrowserAuthStatus?.loginInProgress
                    ? "授权流程进行中，请在浏览器完成登录后回到这里点“完成校验”。"
                    : "还没有授权，首次使用前需要先走一遍浏览器登录校验。"}
              </div>
              <div className="mt-1 text-[10px] text-gray-400">
                clientId: {personalBrowserClientId}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleStartPersonalBrowserLogin();
                }}
                disabled={isPersonalBrowserAuthBusy}
                className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-sky-700 transition hover:border-sky-300 hover:text-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPersonalBrowserAuthBusy ? "处理中..." : "开始授权"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleFinishPersonalBrowserLogin();
                }}
                disabled={isPersonalBrowserAuthBusy}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition hover:border-gray-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                完成校验
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleClearPersonalBrowserAuth();
                }}
                disabled={isPersonalBrowserAuthBusy || !personalBrowserAuthStatus?.configured}
                className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-600 transition hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                清除授权
              </button>
            </div>
          </div>
          {personalBrowserAuthMessage ? (
            <div className="mt-3 rounded-2xl border border-sky-100 bg-white/80 px-3 py-2 text-[11px] leading-5 text-sky-700">
              {personalBrowserAuthMessage}
            </div>
          ) : null}
        </div>

        <div className="mt-3 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-3 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-gray-900">
                {"\u6dd8\u5b9d\u5f53\u524d\u9875\u5bfc\u5165"}
              </div>
              <div className="mt-1 text-[11px] leading-5 text-gray-600">
                {
                  "\u4e0d\u8d70\u670d\u52a1\u7aef\u786c\u6293\u3002\u7531\u4f60\u81ea\u5df1\u5728\u5df2\u767b\u5f55\u7684\u6dd8\u5b9d\u8be6\u60c5\u9875\u91cc\u6267\u884c\u5bfc\u5165\u811a\u672c\uff0c\u518d\u56de\u5230\u8fd9\u91cc\u8bfb\u53d6\u7ed3\u679c\uff0c\u66f4\u4e0d\u5bb9\u6613\u88ab\u98ce\u63a7\u62e6\u622a\u3002"
                }
              </div>
              <div className="mt-2 text-[10px] leading-5 text-gray-400">
                {
                  "\u6b65\u9aa4\uff1a1. \u590d\u5236\u5bfc\u5165\u811a\u672c  2. \u5728\u6dd8\u5b9d\u5f53\u524d\u9875\u63a7\u5236\u53f0\u7c98\u8d34\u6267\u884c  3. \u56de\u6765\u8bfb\u53d6\u6700\u8fd1\u4e00\u6b21\u5bfc\u5165\u7ed3\u679c"
                }
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleCopyLivePageImportScript();
                }}
                disabled={isCopyingLivePageScript}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCopyingLivePageScript ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Clipboard size={12} />
                )}
                {"\u590d\u5236\u5bfc\u5165\u811a\u672c"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleLoadLivePageImport();
                }}
                disabled={isLoadingLivePageImport}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition hover:border-gray-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoadingLivePageImport ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <RefreshCw size={12} />
                )}
                {"\u8bfb\u53d6\u6700\u8fd1\u4e00\u6b21\u7ed3\u679c"}
              </button>
            </div>
          </div>
          {livePageImportMessage ? (
            <div className="mt-3 rounded-2xl border border-emerald-100 bg-white/80 px-3 py-2 text-[11px] leading-5 text-emerald-700">
              {livePageImportMessage}
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            inputMode="url"
            value={importUrl}
            onChange={(event) => {
              setImportUrl(event.target.value);
              setImportPreviewError(null);
              setImportRecoveryHint(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handlePreviewImportFromUrl();
              }
            }}
            disabled={
              workflowBusy ||
              isUploading ||
              isImporting ||
              isPreviewingImport ||
              isAnalyzing
            }
            placeholder={
              "\u7c98\u8d34\u5546\u54c1\u94fe\u63a5\uff0c\u81ea\u52a8\u6293\u53d6\u4e3b\u56fe\u548c\u8be6\u60c5\u56fe"
            }
            className="min-w-0 flex-1 rounded-2xl border border-amber-200 bg-white px-3 py-2 text-xs text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-amber-300 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-gray-100"
          />
          <button
            type="button"
            onClick={() => {
              void handlePreviewImportFromUrl();
            }}
            disabled={
              workflowBusy ||
              isUploading ||
              isImporting ||
              isPreviewingImport ||
              isAnalyzing ||
              importUrl.trim().length === 0
            }
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-700 transition hover:border-amber-300 hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPreviewingImport ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Link2 size={14} />
            )}
            {isPreviewingImport
              ? "\u6b63\u5728\u89e3\u6790\u94fe\u63a5"
              : "\u5148\u9884\u89c8\u6293\u53d6"}
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-amber-700/80">
          {
            "\u4f60\u53ef\u4ee5\u5148\u770b\u7cfb\u7edf\u6293\u5230\u4e86\u54ea\u4e9b\u56fe\uff0c\u624b\u52a8\u52fe\u9009\u540e\u518d\u5bfc\u5165\u6210\u7ade\u54c1\u5957\u56fe\u3002"
          }
        </p>
        {importPreviewError ? (
          <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-[11px] leading-5 text-red-600">
            {importPreviewError}
          </div>
        ) : null}
        {importPreview ? (
          <div className="mt-3 rounded-2xl border border-amber-200/80 bg-white/85 p-3 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-gray-900">
                  {importPreview.title || "\u94fe\u63a5\u6293\u53d6\u9884\u89c8"}
                </div>
                <div className="mt-1 text-[11px] leading-5 text-gray-600">
                  {importPreview.platformHint
                    ? `\u7ad9\u70b9\u89c4\u5219\uff1a${importPreview.platformHint}`
                    : "\u7ad9\u70b9\u89c4\u5219\uff1a\u901a\u7528\u9875\u9762\u6293\u53d6"}
                  {importPreviewSource === "live-page"
                    ? "\u3000\u6765\u6e90\uff1a\u5f53\u524d\u9875\u63d0\u4ea4"
                    : "\u3000\u6765\u6e90\uff1a\u94fe\u63a5\u89e3\u6790"}
                  {importPreview.extractionMode === "browser"
                    ? "\u3000\u63d0\u53d6\u65b9\u5f0f\uff1a\u6d4f\u89c8\u5668\u6e32\u67d3"
                    : "\u3000\u63d0\u53d6\u65b9\u5f0f\uff1a\u9759\u6001\u9875\u9762"}
                  {`\u3000`}
                  {`\u9884\u89c8 ${importPreview.images.length}/${IMPORT_PREVIEW_LIMIT} \u5f20\u5019\u9009\u56fe`}
                  {`\u3000\u6700\u591a\u53ef\u5bfc\u5165 ${IMPORT_PREVIEW_LIMIT} \u5f20`}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleAllPreviewImages}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
                >
                  {allFilteredPreviewImagesSelected
                    ? "\u5168\u90e8\u53d6\u6d88"
                    : "\u5168\u9009"}
                </button>
                <button
                  type="button"
                  onClick={clearImportPreview}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
                >
                  {"\u6536\u8d77\u9884\u89c8"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleImportFromPreview();
                  }}
                  disabled={
                    isImporting ||
                    isPreviewingImport ||
                    visibleSelectedPreviewCount === 0
                  }
                  className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {isImporting ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Link2 size={12} />
                  )}
                  {isImporting
                    ? "\u6b63\u5728\u5bfc\u5165"
                    : `\u5bfc\u5165\u5df2\u52fe\u9009 ${visibleSelectedPreviewCount} \u5f20`}
                </button>
              </div>
            </div>
            <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50/60 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold text-gray-800">
                    {"\u5206\u8fa8\u7387\u7b5b\u9009"}
                  </div>
                  <div className="mt-1 text-[11px] leading-5 text-gray-600">
                    {"\u5411\u53f3\u62d6\u52a8\uff0c\u53ea\u4fdd\u7559\u5206\u8fa8\u7387\u66f4\u9ad8\u7684\u56fe\u7247\u3002"}
                    {`\u3000`}
                    {`\u5f53\u524d\uff1a${previewResolutionSummary}`}
                    {`\u3000`}
                    {`\u663e\u793a ${filteredPreviewImages.length}/${importPreview.images.length} \u5f20`}
                  </div>
                </div>
                <div className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-amber-700">
                  {previewResolutionMax > 0
                    ? `\u6700\u9ad8 ${previewResolutionMax}px`
                    : "\u6682\u65e0\u5206\u8fa8\u7387\u4fe1\u606f"}
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={previewResolutionFilter}
                onChange={(event) =>
                  setPreviewResolutionFilter(Number(event.target.value) || 0)
                }
                className="mt-3 h-2 w-full cursor-pointer accent-amber-500"
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {filteredPreviewImages.map((image, index) => {
                const checked = selectedPreviewUrls.includes(image.url);
                const resolutionLabel = formatResolutionLabel(
                  image,
                  previewImageDimensions[image.url],
                );
                return (
                  <div
                    key={`${image.url}-${index}`}
                    className={[
                      "overflow-hidden rounded-2xl border bg-white text-left transition",
                      checked
                        ? "border-emerald-300 bg-emerald-50/70 shadow-sm shadow-emerald-100"
                        : "border-gray-200 bg-white hover:border-gray-300",
                    ].join(" ")}
                  >
                      <div
                        className="relative aspect-[4/5] cursor-zoom-in overflow-hidden bg-gray-100"
                        onDoubleClick={() => setPreviewLightboxImage(image)}
                        title="双击查看大图"
                      >
                      <img
                        src={image.url}
                        alt={image.name || `preview-${index + 1}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      <div
                        className={[
                          "absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-medium text-white",
                          checked ? "bg-emerald-600/90" : "bg-black/65",
                        ].join(" ")}
                      >
                        {checked ? "\u5df2\u4fdd\u7559" : "\u53cc\u51fb\u9884\u89c8"}
                      </div>
                      <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-medium text-gray-700">
                        {index + 1}
                      </div>
                    </div>
                    <div className="space-y-1 px-3 py-2">
                      <div className="line-clamp-2 text-[11px] font-medium leading-5 text-gray-800">
                        {image.name || "\u672a\u547d\u540d\u5019\u9009\u56fe"}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {resolutionLabel ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
                            {resolutionLabel}
                          </span>
                        ) : null}
                        {image.origin ? (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                            {image.origin}
                          </span>
                        ) : null}
                        {typeof image.score === "number" ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">
                            {`score ${image.score}`}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span
                          className={[
                            "text-[10px]",
                            checked ? "text-emerald-700" : "text-gray-400",
                          ].join(" ")}
                        >
                          {checked
                            ? "\u5df2\u52fe\u9009\u5bfc\u5165"
                            : "\u53ef\u5355\u72ec\u70b9\u201c\u4fdd\u7559\u201d"}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleTogglePreviewImage(image.url)}
                          className={[
                            "rounded-full px-3 py-1 text-[11px] font-semibold transition",
                            checked
                              ? "bg-emerald-600 text-white hover:bg-emerald-700"
                              : "border border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100",
                          ].join(" ")}
                        >
                          {checked ? "\u5df2\u4fdd\u7559" : "\u70b9\u51fb\u4fdd\u7559"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredPreviewImages.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed border-amber-200 bg-white/80 px-4 py-4 text-[11px] leading-5 text-gray-500">
                {"\u5f53\u524d\u6ed1\u6761\u7b5b\u9009\u540e\u6ca1\u6709\u5269\u4f59\u56fe\u7247\u3002\u53ef\u4ee5\u5f80\u5de6\u8c03\u56de\uff0c\u663e\u793a\u66f4\u591a\u56fe\u3002"}
              </div>
            ) : null}
          </div>
        ) : null}
        {importRecoveryHint ? (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-3 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-gray-900">
                  {importRecoveryHint.title}
                </div>
                <p className="mt-1 text-[11px] leading-5 text-gray-600">
                  {importRecoveryHint.detail}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPendingUploadDeckId(null);
                    uploadInputRef.current?.click();
                  }}
                  disabled={isUploading || workflowBusy}
                  className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-700 transition hover:border-amber-300 hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUploading ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <ImagePlus size={12} />
                  )}
                  上传图片
                </button>
                <button
                  type="button"
                  onClick={() => setImportRecoveryHint(null)}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
                >
                  关闭
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleCopyLivePageImportScript();
                  }}
                  disabled={isCopyingLivePageScript}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCopyingLivePageScript ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Clipboard size={12} />
                  )}
                  复制导入脚本
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleLoadLivePageImport();
                  }}
                  disabled={isLoadingLivePageImport}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition hover:border-gray-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoadingLivePageImport ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  读取结果
                </button>
              </div>
            </div>
            <div
              tabIndex={0}
              onPaste={(event) => {
                void handlePasteCompetitorImages(event);
              }}
              className="mt-3 rounded-2xl border border-dashed border-amber-300 bg-white/85 px-4 py-4 text-[11px] leading-5 text-gray-600 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            >
              <div className="font-medium text-gray-800">也可以直接粘贴截图</div>
              <div className="mt-1">
                聚焦到这里后直接按 `Ctrl+V` / `Cmd+V`，系统会把剪贴板图片补进当前竞品区。
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {strategyStats.map((item) => (
            <span
              key={item.label}
              className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-medium text-gray-600"
            >
              {item.label} {item.value}
            </span>
          ))}
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-amber-200/70 bg-white/75 p-3">
            <div className="text-xs font-semibold text-gray-900">规划阶段竞品策略</div>
            <div className="mt-1 text-[11px] leading-5 text-gray-600">
              {`当前为${currentPlanningStrategyModeMeta.label}：${currentPlanningStrategyModeMeta.detail}`}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {COMPETITOR_STRATEGY_MODE_OPTIONS.map((option) => (
                <button
                  key={`planning-${option.value}`}
                  type="button"
                  onClick={() => setCompetitorPlanningStrategyMode(option.value)}
                  className={[
                    "rounded-full border px-3 py-1.5 text-[11px] font-medium transition",
                    currentPlanningStrategyMode === option.value
                      ? "border-amber-300 bg-amber-100 text-amber-900"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200/70 bg-white/75 p-3">
            <div className="text-xs font-semibold text-gray-900">生图阶段竞品策略</div>
            <div className="mt-1 text-[11px] leading-5 text-gray-600">
              {`当前为${currentGenerationStrategyModeMeta.label}：${currentGenerationStrategyModeMeta.detail}`}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {COMPETITOR_STRATEGY_MODE_OPTIONS.map((option) => (
                <button
                  key={`generation-${option.value}`}
                  type="button"
                  onClick={() => setCompetitorGenerationStrategyMode(option.value)}
                  className={[
                    "rounded-full border px-3 py-1.5 text-[11px] font-medium transition",
                    currentGenerationStrategyMode === option.value
                      ? "border-amber-300 bg-amber-100 text-amber-900"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!hasDecks ? (
          <div className="mt-4 rounded-2xl border border-dashed border-amber-200 bg-white/70 px-4 py-3 text-xs leading-5 text-gray-500">
            至少上传 1 套竞品截图后，才会生成竞品策略摘要，并注入到后续规划和生图上下文。
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {state.competitorDecks.map((deck, deckIndex) => {
              const deckName = deck.name?.trim() || buildDeckFallbackName(deckIndex);
              return (
                <div
                  key={deck.id}
                  className="rounded-2xl border border-white/80 bg-white/85 p-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <input
                        value={deck.name || ""}
                        onChange={(event) =>
                          void updateSingleDeck(deck.id, { name: event.target.value })
                        }
                        placeholder={deckName}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none transition focus:border-amber-300"
                      />
                      <input
                        value={deck.referenceUrl || ""}
                        onChange={(event) =>
                          void updateSingleDeck(deck.id, {
                            referenceUrl: event.target.value,
                          })
                        }
                        placeholder="可选：填写该套竞品原始链接，方便回查来源"
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 outline-none transition focus:border-amber-300"
                      />
                      <textarea
                        value={deck.notes || ""}
                        onChange={(event) =>
                          void updateSingleDeck(deck.id, { notes: event.target.value })
                        }
                        placeholder="可选：补充这套竞品的定位、卖点或你关注的观察点"
                        rows={2}
                        className="mt-2 w-full resize-none rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs leading-5 text-gray-600 outline-none transition focus:border-amber-300"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleRemoveDeck(deck.id)}
                      className="inline-flex items-center gap-1 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600 transition hover:border-red-200 hover:text-red-700"
                    >
                      <Trash2 size={13} />
                      删除套图
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                      {deck.images.length} 张图片
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleMoveDeck(deckIndex, deckIndex - 1)}
                      disabled={deckIndex === 0}
                      className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      上移一套
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleMoveDeck(deckIndex, deckIndex + 1)}
                      disabled={deckIndex === state.competitorDecks.length - 1}
                      className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      下移一套
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingUploadDeckId(deck.id);
                        uploadInputRef.current?.click();
                      }}
                      className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
                    >
                      继续上传
                    </button>
                    {deck.referenceUrl ? (
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] text-gray-600">
                        已填写来源链接
                      </span>
                    ) : null}
                    {hasAnalysis ? (
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] text-blue-700">
                        已生成策略分析
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(deck.images || []).map((image, imageIndex) => {
                      const previewUrl = resolvedImageUrls[image.id];
                      return (
                        <div
                          key={image.id}
                          className="rounded-xl border border-gray-200 bg-gray-50 p-1.5"
                        >
                          <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-gray-500">
                            <span>{`图 ${imageIndex + 1}`}</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  void handleMoveDeckImage(
                                    deck.id,
                                    imageIndex,
                                    imageIndex - 1,
                                  )
                                }
                                disabled={imageIndex === 0}
                                className="rounded-md border border-gray-200 bg-white p-1 text-gray-500 transition hover:border-gray-300 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <MoveLeft size={10} />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleMoveDeckImage(
                                    deck.id,
                                    imageIndex,
                                    imageIndex + 1,
                                  )
                                }
                                disabled={imageIndex === deck.images.length - 1}
                                className="rounded-md border border-gray-200 bg-white p-1 text-gray-500 transition hover:border-gray-300 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <MoveRight size={10} />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleRemoveDeckImage(deck.id, image.id)
                                }
                                className="rounded-md border border-red-100 bg-red-50 p-1 text-red-500 transition hover:border-red-200 hover:text-red-700"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                          {previewUrl ? (
                            <img
                              src={previewUrl}
                              alt={image.name || deckName}
                              className="h-16 w-12 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="flex h-16 w-12 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white text-[10px] text-gray-400">
                              预览
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-gray-900">逐图竞品原始分析</div>
                        <div className="mt-1 text-[11px] leading-5 text-gray-600">
                          这里展示每张图的原始视觉与结构分析结果，方便判断这套竞品有没有被正确理解。
                        </div>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-amber-700">
                        {`${getDeckImageAnalyses(deck).filter((item) => item.status === "success").length}/${deck.images.length} 已分析`}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {(deck.images || []).map((image, imageIndex) => {
                        const imageAnalysis = getDeckImageAnalysis(deck, image.id);
                        const status = imageAnalysis?.status || "idle";
                        const cardTone =
                          status === "success"
                            ? "border-emerald-100 bg-white"
                            : status === "failed"
                              ? "border-red-100 bg-red-50/60"
                              : status === "running"
                                ? "border-blue-100 bg-blue-50/60"
                                : "border-gray-200 bg-white/80";
                        const badgeTone =
                          status === "success"
                            ? "bg-emerald-50 text-emerald-700"
                            : status === "failed"
                              ? "bg-red-50 text-red-700"
                              : status === "running"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-gray-100 text-gray-600";
                        const statusLabel =
                          status === "success"
                            ? "成功"
                            : status === "failed"
                              ? "失败"
                              : status === "running"
                                ? "分析中"
                                : "待分析";
                        return (
                          <div
                            key={`${deck.id}-${image.id}-raw-analysis`}
                            className={`rounded-2xl border p-3 shadow-sm ${cardTone}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="shrink-0">
                                {resolvedImageUrls[image.id] ? (
                                  <img
                                    src={resolvedImageUrls[image.id]}
                                    alt={image.name || deckName}
                                    className="h-20 w-16 rounded-xl object-cover"
                                  />
                                ) : (
                                  <div className="flex h-20 w-16 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white text-[10px] text-gray-400">
                                    预览
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700">
                                    {`图 ${imageIndex + 1}`}
                                  </span>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeTone}`}>
                                    {statusLabel}
                                  </span>
                                </div>
                                {imageAnalysis?.responseModel || imageAnalysis?.providerId ? (
                                  <div className="mt-2 text-[10px] text-gray-500">
                                    {(imageAnalysis?.responseModel || imageAnalysis?.requestedModel || "") +
                                      (imageAnalysis?.providerId ? ` / ${imageAnalysis.providerId}` : "")}
                                  </div>
                                ) : null}
                                <div className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-[11px] leading-5 text-gray-700">
                                  {imageAnalysis?.responseText?.trim()
                                    ? imageAnalysis.responseText
                                    : status === "running"
                                      ? "正在分析这张图片..."
                                      : "还没有返回原始分析结果，跑完分析后会显示在这里。"}
                                </div>
                                {imageAnalysis?.errorMessage ? (
                                  <div className="mt-2 text-[11px] leading-5 text-red-600">
                                    {imageAnalysis.errorMessage}
                                  </div>
                                ) : null}
                                {imageAnalysis?.latestDebugPath ? (
                                  <div className="mt-2 break-all text-[10px] text-gray-400">
                                    Debug: {imageAnalysis.latestDebugPath}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {(() => {
                    const analysis = getDeckAnalysis(state.competitorAnalyses, deck.id);
                    if (!analysis) {
                      return null;
                    }

                    const expanded = expandedDeckIds.includes(deck.id);

                    return (
                      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
                        <button
                          type="button"
                          onClick={() => toggleDeckAnalysis(deck.id)}
                          className="flex w-full items-center justify-between gap-3 text-left"
                        >
                          <div>
                            <div className="text-xs font-semibold text-gray-900">
                              该套竞品策略摘要
                            </div>
                            <div className="mt-1 text-[11px] leading-5 text-gray-600">
                              {analysis.overview.narrativePattern || "展开查看这套竞品的整体结构总结"}
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-blue-700">
                            {expanded ? "收起" : "展开"}
                            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </span>
                        </button>

                        {expanded ? (
                          <div className="mt-3 space-y-3">
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="rounded-2xl bg-white p-3">
                                <div className="text-[11px] font-semibold text-gray-900">
                                  整体概览
                                </div>
                                <ul className="mt-2 space-y-1 text-[11px] leading-5 text-gray-600">
                                  <li>{`- 产品定位：${analysis.overview.productPositioning || "未提及"}`}</li>
                                  <li>{`- 整体风格：${analysis.overview.overallStyle || "未提及"}`}</li>
                                  <li>{`- 叙事方式：${analysis.overview.narrativePattern || "未提及"}`}</li>
                                  <li>{`- 转化策略：${analysis.overview.conversionStrategy || "未提及"}`}</li>
                                </ul>
                              </div>
                              <div className="rounded-2xl bg-white p-3">
                                <div className="text-[11px] font-semibold text-gray-900">
                                  共性模式
                                </div>
                                <ul className="mt-2 space-y-1 text-[11px] leading-5 text-gray-600">
                                  {listLimit(analysis.globalPatterns.commonLayoutPatterns, 3).map((item) => (
                                    <li key={item}>- {item}</li>
                                  ))}
                                  {listLimit(analysis.globalPatterns.commonTextStrategies, 2).map((item) => (
                                    <li key={item}>- {item}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            <div className="rounded-2xl bg-white p-3">
                              <div className="text-[11px] font-semibold text-gray-900">
                                页序拆解
                              </div>
                              <div className="mt-2 space-y-2">
                                {analysis.pageSequence.map((page) => (
                                  <div
                                    key={`${analysis.competitorId}-${page.pageIndex}`}
                                    className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2"
                                  >
                                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                      <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-gray-700">
                                        {`第 ${page.pageIndex} 页`}
                                      </span>
                                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                                        {page.pageRole}
                                      </span>
                                      <span className="rounded-full bg-white px-2 py-0.5 text-gray-600">
                                        {`文本密度 ${page.textDensity}`}
                                      </span>
                                    </div>
                                    <div className="mt-2 grid gap-1 text-[11px] leading-5 text-gray-600 md:grid-cols-2">
                                      <div>{`主题概括：${page.titleSummary || "未提及"}`}</div>
                                      <div>{`业务任务：${page.businessTask || "未提及"}`}</div>
                                      <div>{`关键卖点：${page.keySellingPoint || "未提及"}`}</div>
                                      <div>{`版式方式：${page.layoutPattern || "未提及"}`}</div>
                                      <div>{`证据表达：${page.evidenceStyle || "未提及"}`}</div>
                                      <div>{`备注：${page.notes || "未提及"}`}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {summary ? (
        <section className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                竞品策略摘要卡
              </div>
              <p className="mt-1 text-xs leading-5 text-gray-600">
                这部分会直接并入后续方案规划提示，影响页序、叙事顺序和文案表达方式。
              </p>
            </div>
            <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-medium text-blue-700">
              已注入后续规划上下文
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-white/85 p-3">
              <div className="text-xs font-semibold text-gray-900">建议页序</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {listLimit(summary.recommendedPageSequence, 6).map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] text-blue-700"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-white/85 p-3">
              <div className="text-xs font-semibold text-gray-900">建议叙事顺序</div>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-gray-600">
                {listLimit(summary.recommendedStoryOrder, 4).map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-white/85 p-3">
              <div className="text-xs font-semibold text-gray-900">可借鉴原则</div>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-gray-600">
                {listLimit(summary.borrowablePrinciples, 4).map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-white/85 p-3">
              <div className="text-xs font-semibold text-gray-900">避免照抄</div>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-gray-600">
                {listLimit(summary.avoidCopying, 4).map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-3 rounded-2xl bg-white/85 p-3">
            <div className="text-xs font-semibold text-gray-900">我们的机会点</div>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-gray-600">
              {listLimit(summary.opportunitiesForOurProduct, 5).map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>

          <div className="mt-3 rounded-2xl bg-white/85 p-3">
            <div className="text-xs font-semibold text-gray-900">
              竞品页序 {"->"} 我方方案页序对照
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3">
                <div className="text-[11px] font-semibold text-blue-900">
                  竞品建议页序
                </div>
                <div className="mt-2 space-y-2">
                  {summary.recommendedPageSequence.length > 0 ? (
                    summary.recommendedPageSequence.slice(0, 8).map((item, index) => (
                      <div
                        key={`${item}-${index}`}
                        className="flex items-start gap-2 text-[11px] leading-5 text-blue-900"
                      >
                        <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-blue-700">
                          {index + 1}
                        </span>
                        <span>{item}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-[11px] text-blue-700/80">
                      还没有形成稳定的竞品页序建议。
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3">
                <div className="text-[11px] font-semibold text-emerald-900">
                  当前我方方案页序
                </div>
                <div className="mt-2 space-y-2">
                  {currentPlanSequence.length > 0 ? (
                    currentPlanSequence.slice(0, 8).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => scrollToPlanGroup(item.id)}
                        className="w-full rounded-xl border border-emerald-100 bg-white/80 px-2.5 py-2 text-left transition hover:border-emerald-200 hover:bg-white"
                      >
                        <div className="flex items-start gap-2 text-[11px] leading-5 text-emerald-900">
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                            {item.order}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">{item.title}</div>
                            {item.closestDecks.length > 0 ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {item.closestDecks.map((deck) => (
                                  <span
                                    key={`${item.id}-${deck.competitorId}`}
                                    className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700"
                                  >
                                    {`更像：${deck.label}`}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <span className="shrink-0 text-[10px] font-medium text-emerald-700">
                            定位
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-[11px] text-emerald-700/80">
                      方案页序会在生成方案分组后显示在这里。
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
};
