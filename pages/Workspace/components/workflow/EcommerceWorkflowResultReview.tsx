import React, { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import type {
  EcommerceBatchJob,
  EcommercePlanGroup,
  EcommerceResultItem,
} from "../../../../types/workflow.types";

export type WorkflowResultImage = EcommerceResultItem;

export const sanitizeDownloadName = (
  value?: string,
  fallback = "ecom-result",
) =>
  (value || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, " ")
    .trim() || fallback;

export const parseResultMeta = (label?: string, fallback = "结果") => {
  const fullLabel = (label || fallback).trim() || fallback;
  const match = fullLabel.match(/^(.*?)(?:\s+v(\d+))$/i);

  return match
    ? {
        fullLabel,
        title: match[1]?.trim() || fullLabel,
        version: `v${match[2]}`,
      }
    : { fullLabel, title: fullLabel, version: null as string | null };
};

const hasConsistencyRisk = (review?: WorkflowResultImage["review"]) => {
  if (!review) return false;

  return /不是同一商品|不像原商品|主体不一致|包装不一致|结构不一致|颜色不一致|偏离参考|商品变样|像另一款|像另一种包装|不是原商品|不是同一个主体/.test(
    [review.summary, ...(review.issues || [])].join(" "),
  );
};

const getGenerationMetaChips = (meta?: WorkflowResultImage["generationMeta"]) => {
  if (!meta) return [];

  const chips: Array<{ text: string; className: string }> = [];

  if (meta.usedModelLabel) {
    chips.push({
      text: `最终模型 ${meta.usedModelLabel}`,
      className: "bg-slate-100 text-slate-700",
    });
  }

  if ((meta.attemptedModels || []).length > 0) {
    chips.push({
      text: `已自动切换 ${meta.attemptedModels.length} 次`,
      className: "bg-amber-100 text-amber-700",
    });
  }

  if (typeof meta.referenceImageCount === "number") {
    chips.push({
      text: `参考图 ${meta.referenceImageCount} 张`,
      className: "bg-sky-100 text-sky-700",
    });
  }

  if (meta.consistencyGuarded) {
    chips.push({
      text: "已启用一致性约束",
      className: "bg-emerald-100 text-emerald-700",
    });
  }

  return chips;
};

const getReviewRiskNote = (review?: WorkflowResultImage["review"]) => {
  if (!review) return null;

  const combinedText = [review.summary, ...(review.issues || [])].join(" ");

  if (hasConsistencyRisk(review)) {
    return {
      text: "主体疑似和参考商品不一致，这类结果会被压分。",
      className: "bg-rose-50 text-rose-700",
    };
  }

  if (/模糊|失焦|不清晰|细节不足|材质不清|质感弱/.test(combinedText)) {
    return {
      text: "清晰度或材质表现不足，影响可用性。",
      className: "bg-amber-50 text-amber-700",
    };
  }

  if (/构图|拥挤|杂乱|主体不突出|卖点不清|视觉中心/.test(combinedText)) {
    return {
      text: "构图或卖点表达不够集中，转化力偏弱。",
      className: "bg-amber-50 text-amber-700",
    };
  }

  if (review.issues.length > 0) {
    return {
      text: `主要问题：${review.issues[0]}`,
      className: "bg-amber-50 text-amber-700",
    };
  }

  return null;
};

type GroupedResultItem = {
  image: WorkflowResultImage;
  meta: ReturnType<typeof parseResultMeta>;
  index: number;
  isPreferred: boolean;
};

type GroupedResultSection = {
  key: string;
  title: string;
  typeTitle?: string;
  planItemId?: string;
  items: GroupedResultItem[];
  selectedCount: number;
  firstIndex: number;
  bestScore: number | null;
  hasPreferred: boolean;
};

type ResultFilter = "all" | "highScore" | "preferred";

const RESULT_GROUP_ACCENTS = [
  {
    shell: "border-sky-200 bg-sky-50/40",
    header: "border-sky-200 bg-white/90",
    badge: "bg-sky-600 text-white",
  },
  {
    shell: "border-emerald-200 bg-emerald-50/40",
    header: "border-emerald-200 bg-white/90",
    badge: "bg-emerald-600 text-white",
  },
  {
    shell: "border-violet-200 bg-violet-50/40",
    header: "border-violet-200 bg-white/90",
    badge: "bg-violet-600 text-white",
  },
  {
    shell: "border-amber-200 bg-amber-50/40",
    header: "border-amber-200 bg-white/90",
    badge: "bg-amber-500 text-white",
  },
] as const;

const getResultGroupAccent = (index: number) =>
  RESULT_GROUP_ACCENTS[index % RESULT_GROUP_ACCENTS.length];

const getResultGroupSourceBadge = (group?: {
  source?: EcommercePlanGroup["source"];
  usedFallback?: boolean;
}) => {
  if (group?.source === "fallback") {
    return {
      text: "该组来自兜底方案池",
      className: "bg-amber-100 text-amber-700",
    };
  }
  if (group?.usedFallback) {
    return {
      text: "该组经过兜底补全",
      className: "bg-blue-100 text-blue-700",
    };
  }
  if (group?.source === "ai") {
    return {
      text: "该组来自 AI 直出",
      className: "bg-emerald-100 text-emerald-700",
    };
  }
  return null;
};

export const buildGroupedResultSections = (
  images: WorkflowResultImage[],
  batchJobs: EcommerceBatchJob[],
  planGroups: EcommercePlanGroup[],
  preferredResultUrl: string | null,
  selectedResultUrls: string[],
): GroupedResultSection[] => {
  const selectedSet = new Set(selectedResultUrls);
  const planMetaById = new Map(
    planGroups.flatMap((group) =>
      group.items.map((item) => [
        item.id,
        {
          typeTitle: group.typeTitle,
          itemTitle: item.title,
        },
      ]),
    ),
  );
  const resultSourceByUrl = new Map(
    batchJobs.flatMap((job) =>
      (job.results || []).map((result) => [
        result.url,
        {
          planItemId: job.planItemId,
          title: planMetaById.get(job.planItemId)?.itemTitle || job.title,
          typeTitle: planMetaById.get(job.planItemId)?.typeTitle,
        },
      ]),
    ),
  );
  const grouped = new Map<string, GroupedResultSection>();

  images.forEach((image, index) => {
    const source = resultSourceByUrl.get(image.url);
    const meta = parseResultMeta(image.label, `结果 ${index + 1}`);
    const groupKey = source?.planItemId || `ungrouped:${meta.title}`;
    const existing = grouped.get(groupKey);
    const nextItem: GroupedResultItem = {
      image,
      meta,
      index,
      isPreferred: preferredResultUrl === image.url,
    };

    if (existing) {
      existing.items.push(nextItem);
      existing.selectedCount += selectedSet.has(image.url) ? 1 : 0;
      if (typeof image.review?.score === "number") {
        existing.bestScore =
          typeof existing.bestScore === "number"
            ? Math.max(existing.bestScore, image.review.score)
            : image.review.score;
      }
      existing.hasPreferred = existing.hasPreferred || nextItem.isPreferred;
      return;
    }

    grouped.set(groupKey, {
      key: groupKey,
      title: source?.title || meta.title,
      typeTitle: source?.typeTitle,
      planItemId: source?.planItemId,
      items: [nextItem],
      selectedCount: selectedSet.has(image.url) ? 1 : 0,
      firstIndex: index,
      bestScore: image.review?.score ?? null,
      hasPreferred: nextItem.isPreferred,
    });
  });

  return Array.from(grouped.values())
    .sort((a, b) => {
      if (a.hasPreferred !== b.hasPreferred) {
        return a.hasPreferred ? -1 : 1;
      }
      if ((a.bestScore ?? -1) !== (b.bestScore ?? -1)) {
        return (b.bestScore ?? -1) - (a.bestScore ?? -1);
      }
      return a.firstIndex - b.firstIndex;
    })
    .map((section) => ({
      ...section,
      items: section.items.sort(
        (a, b) =>
          (b.image.review?.score ?? -1) - (a.image.review?.score ?? -1) ||
          a.index - b.index,
      ),
    }));
};

type Props = {
  images: WorkflowResultImage[];
  batchJobs: EcommerceBatchJob[];
  planGroups: EcommercePlanGroup[];
  preferredResultUrl: string | null;
  title?: string;
  description?: string;
  variant?: "card" | "drawer";
  onPromoteResult?: (url: string) => void;
  onPromoteSelectedResults?: (urls: string[]) => void;
  onDeleteResult?: (url: string) => void;
  onInsertToCanvas?: (url: string, label?: string) => void;
  onPreviewResult?: (url: string) => void;
  onRetryFailedBatch?: () => void | Promise<void>;
};

export const EcommerceWorkflowResultReview: React.FC<Props> = ({
  images,
  batchJobs,
  planGroups,
  preferredResultUrl,
  title = "生成结果",
  description,
  variant = "card",
  onPromoteResult,
  onPromoteSelectedResults,
  onDeleteResult,
  onInsertToCanvas,
  onPreviewResult,
  onRetryFailedBatch,
}) => {
  const [selectedResultUrls, setSelectedResultUrls] = useState<string[]>([]);
  const [isPackagingAll, setIsPackagingAll] = useState(false);
  const [isPackagingSelected, setIsPackagingSelected] = useState(false);
  const [packagingSectionKey, setPackagingSectionKey] = useState<string | null>(
    null,
  );
  const [isRetryingFailedBatch, setIsRetryingFailedBatch] = useState(false);
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [searchText, setSearchText] = useState("");
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    const availableUrls = new Set(images.map((image) => image.url));
    setSelectedResultUrls((prev) =>
      prev.filter((url) => availableUrls.has(url)),
    );
  }, [images]);

  const groupedSections = useMemo(
    () =>
      buildGroupedResultSections(
        images,
        batchJobs,
        planGroups,
        preferredResultUrl,
        selectedResultUrls,
      ),
    [batchJobs, images, planGroups, preferredResultUrl, selectedResultUrls],
  );
  const resultSourceByUrl = useMemo(() => {
    const planMetaById = new Map(
      planGroups.flatMap((group) =>
        group.items.map((item) => [
          item.id,
          {
            typeTitle: group.typeTitle,
            itemTitle: item.title,
          },
        ]),
      ),
    );

    return new Map(
      batchJobs.flatMap((job) =>
        (job.results || []).map((result) => [
          result.url,
          {
            planItemId: job.planItemId,
            title: planMetaById.get(job.planItemId)?.itemTitle || job.title,
            typeTitle: planMetaById.get(job.planItemId)?.typeTitle || null,
          },
        ]),
      ),
    );
  }, [batchJobs, planGroups]);
  const selectedResults = useMemo(
    () => images.filter((image) => selectedResultUrls.includes(image.url)),
    [images, selectedResultUrls],
  );
  const normalizedSearchText = searchText.trim().toLowerCase();
  const visibleSections = useMemo(
    () =>
      groupedSections
        .map((section) => {
          const sectionMatchesSearch =
            normalizedSearchText.length === 0 ||
            [section.title, section.typeTitle, section.planItemId].some(
              (value) => value?.toLowerCase().includes(normalizedSearchText),
            );

          const filteredItems = section.items.filter((item) => {
            const matchesFilter =
              resultFilter === "all"
                ? true
                : resultFilter === "preferred"
                  ? item.isPreferred
                  : (item.image.review?.score ?? 0) >= 90;

            if (!matchesFilter) {
              return false;
            }

            if (sectionMatchesSearch) {
              return true;
            }

            return [
              item.meta.fullLabel,
              item.meta.title,
              item.image.review?.summary,
              item.image.review?.recommendedUse,
            ].some((value) =>
              value?.toLowerCase().includes(normalizedSearchText),
            );
          });

          return {
            ...section,
            items: filteredItems,
            selectedCount: filteredItems.filter((item) =>
              selectedResultUrls.includes(item.image.url),
            ).length,
            bestScore:
              filteredItems.length > 0
                ? filteredItems.reduce<number | null>(
                    (best, item) =>
                      typeof item.image.review?.score === "number"
                        ? Math.max(best ?? -1, item.image.review.score)
                        : best,
                    null,
                  )
                : null,
            hasPreferred: filteredItems.some((item) => item.isPreferred),
          };
        })
        .filter((section) => section.items.length > 0),
    [groupedSections, normalizedSearchText, resultFilter, selectedResultUrls],
  );
  const visibleResults = useMemo(
    () =>
      visibleSections.flatMap((section) =>
        section.items.map((item) => item.image),
      ),
    [visibleSections],
  );
  const displayGroups = useMemo(() => {
    const planGroupByTitle = new Map(
      planGroups.map((group) => [group.typeTitle, group]),
    );
    const grouped = new Map<
      string,
      {
        key: string;
        title: string;
        summary?: string;
        strategy?: EcommercePlanGroup["strategy"];
        platformTags?: string[];
        priority?: EcommercePlanGroup["priority"];
        source?: EcommercePlanGroup["source"];
        usedFallback?: boolean;
        sections: typeof visibleSections;
        totalResults: number;
        bestScore: number | null;
        hasPreferred: boolean;
      }
    >();

    visibleSections.forEach((section) => {
      const matchedGroup =
        (section.typeTitle ? planGroupByTitle.get(section.typeTitle) : null) ||
        null;
      const key = matchedGroup?.typeId || `ungrouped:${section.title}`;
      const current = grouped.get(key) || {
        key,
        title: matchedGroup?.typeTitle || section.typeTitle || "未匹配分组",
        summary: matchedGroup?.summary,
        strategy: matchedGroup?.strategy,
        platformTags: matchedGroup?.platformTags,
        priority: matchedGroup?.priority,
        source: matchedGroup?.source,
        usedFallback: matchedGroup?.usedFallback,
        sections: [],
        totalResults: 0,
        bestScore: null,
        hasPreferred: false,
      };

      current.sections.push(section);
      current.totalResults += section.items.length;
      current.bestScore =
        typeof section.bestScore === "number"
          ? Math.max(current.bestScore ?? -1, section.bestScore)
          : current.bestScore;
      current.hasPreferred = current.hasPreferred || section.hasPreferred;
      grouped.set(key, current);
    });

    return Array.from(grouped.values());
  }, [planGroups, visibleSections]);
  const visibleResultUrls = useMemo(
    () => visibleResults.map((item) => item.url),
    [visibleResults],
  );
  const visibleHighScoreCount = useMemo(
    () =>
      visibleResults.filter((item) => (item.review?.score ?? 0) >= 90).length,
    [visibleResults],
  );
  const visiblePreferredCount = useMemo(
    () =>
      visibleResults.filter((item) => item.url === preferredResultUrl).length,
    [preferredResultUrl, visibleResults],
  );
  const compareResults = selectedResults.slice(0, 2);
  const doneJobs = batchJobs.filter((job) => job.status === "done").length;
  const failedJobs = batchJobs.filter((job) => job.status === "failed").length;
  const allSelected =
    visibleResultUrls.length > 0 &&
    visibleResultUrls.every((url) => selectedResultUrls.includes(url));
  const metricClass =
    variant === "drawer"
      ? "rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3"
      : "rounded-xl border border-gray-200 bg-gray-50 px-3 py-2";
  const sectionGridClass =
    variant === "drawer"
      ? "mt-3 grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4"
      : "mt-3 grid grid-cols-2 gap-2";

  const downloadAllResults = (items: WorkflowResultImage[]) =>
    items.forEach((item, index) => {
      const anchor = document.createElement("a");
      anchor.href = item.url;
      anchor.download = `${sanitizeDownloadName(item.label, `ecom-result-${index + 1}`)}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    });

  const handleDeleteSelected = () => {
    selectedResultUrls.forEach((url) => onDeleteResult?.(url));
    setSelectedResultUrls([]);
  };

  const insertResultsToCanvas = (items: WorkflowResultImage[]) => {
    items.forEach((item) => onInsertToCanvas?.(item.url, item.label));
  };

  const buildManifestPayload = (
    items: WorkflowResultImage[],
    groupTitle?: string,
  ) => ({
    exportedAt: new Date().toISOString(),
    count: items.length,
    groupTitle: groupTitle || null,
    preferredResultUrl,
    hasPreferredResult: items.some((item) => item.url === preferredResultUrl),
    highScoreCount: items.filter((item) => (item.review?.score || 0) >= 90)
      .length,
    items: items.map((item, index) => {
      const meta = parseResultMeta(item.label, `结果 ${index + 1}`);
      const source = resultSourceByUrl.get(item.url);

      return {
        url: item.url,
        label: item.label || meta.fullLabel,
        title: meta.title,
        version: meta.version,
        isPreferred: item.url === preferredResultUrl,
        planItemId: source?.planItemId || null,
        sourceTitle: source?.title || null,
        typeTitle: source?.typeTitle || null,
        review: item.review
          ? {
              score: item.review.score,
              confidence: item.review.confidence,
              summary: item.review.summary,
              strengths: item.review.strengths,
              issues: item.review.issues,
              recommendedUse: item.review.recommendedUse || null,
            }
          : null,
      };
    }),
  });

  const exportResultManifest = (
    items: WorkflowResultImage[],
    filename: string,
    groupTitle?: string,
  ) => {
    const payload = buildManifestPayload(items, groupTitle);

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = `${sanitizeDownloadName(filename)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(blobUrl);
  };

  const exportResultZip = async (
    items: WorkflowResultImage[],
    filename: string,
    groupTitle?: string,
  ) => {
    if (items.length === 0) return;

    const zip = new JSZip();
    const manifest = buildManifestPayload(items, groupTitle);

    await Promise.all(
      items.map(async (item, index) => {
        const meta = parseResultMeta(item.label, `结果 ${index + 1}`);
        const response = await fetch(item.url);
        if (!response.ok) {
          throw new Error(`结果图下载失败：${meta.fullLabel}`);
        }
        const blob = await response.blob();
        const extension =
          blob.type === "image/jpeg" || blob.type === "image/jpg"
            ? "jpg"
            : "png";
        const fileName = `${String(index + 1).padStart(2, "0")}-${sanitizeDownloadName(
          meta.fullLabel,
          `ecom-result-${index + 1}`,
        )}.${extension}`;
        zip.file(fileName, blob);
      }),
    );

    zip.file("manifest.json", JSON.stringify(manifest, null, 2));

    const blob = await zip.generateAsync({ type: "blob" });
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = `${sanitizeDownloadName(filename)}.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(blobUrl);
  };

  const renderBulkButton = (
    label: string,
    onClick: () => void,
    disabled = false,
    tone: "default" | "accent" | "danger" = "default",
  ) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
        disabled
          ? "cursor-not-allowed bg-gray-200 text-gray-400"
          : tone === "accent"
            ? "border border-emerald-200 bg-white text-emerald-700 hover:border-emerald-300"
            : tone === "danger"
              ? "border border-red-200 bg-white text-red-600 hover:border-red-300"
              : "border border-gray-300 bg-white text-gray-700 hover:border-gray-400",
      ].join(" ")}
    >
      {label}
    </button>
  );

  const handleRetryFailedBatch = async () => {
    if (!onRetryFailedBatch || isRetryingFailedBatch) return;
    setIsRetryingFailedBatch(true);
    try {
      await onRetryFailedBatch();
    } finally {
      setIsRetryingFailedBatch(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">{title}</div>
          <p className="mt-1 text-xs leading-6 text-gray-500">
            {description ||
              `当前会话已有 ${images.length} 张可用结果图，可继续筛选、下载和插入画布。`}
          </p>
        </div>
        <div className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-600">
          已选 {selectedResultUrls.length} / {images.length}
        </div>
      </div>

      {images.length > 0 ? (
        <>
          <div
            className={[
              "rounded-2xl border border-gray-200 bg-white p-3",
              variant === "drawer"
                ? "sticky top-[112px] z-[5] shadow-sm"
                : "",
            ].join(" ")}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["all", "全部结果"],
                    ["highScore", "只看高分图"],
                    ["preferred", "只看优选"],
                  ] as Array<[ResultFilter, string]>
                ).map(([value, label]) => {
                  const active = resultFilter === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setResultFilter(value)}
                      className={[
                        "rounded-full px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                        active
                          ? "border border-blue-200 bg-blue-50 text-blue-700"
                          : "border border-gray-300 bg-white text-gray-600 hover:border-gray-400",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-500 md:max-w-sm">
                <span className="shrink-0">搜索</span>
                <input
                  type="text"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="搜索方案标题、类型或评审摘要"
                  className="min-w-0 flex-1 bg-transparent text-[12px] text-gray-700 outline-none placeholder:text-gray-400"
                />
                {searchText ? (
                  <button
                    type="button"
                    onClick={() => setSearchText("")}
                    className="shrink-0 text-[10px] font-semibold text-gray-500 transition hover:text-gray-700 active:scale-[0.99]"
                  >
                    清空
                  </button>
                ) : null}
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-500">
              <span className="rounded-full bg-gray-100 px-3 py-1">
                当前显示 {visibleResults.length} / {images.length}
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1">
                分组 {visibleSections.length} / {groupedSections.length}
              </span>
              {normalizedSearchText ? (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                  搜索词：{searchText}
                </span>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {renderBulkButton(
                allSelected ? "取消全选当前筛选" : "全选当前筛选",
                () =>
                  setSelectedResultUrls(
                    allSelected
                      ? selectedResultUrls.filter(
                          (url) => !visibleResultUrls.includes(url),
                        )
                      : Array.from(
                          new Set([...selectedResultUrls, ...visibleResultUrls]),
                        ),
                  ),
                visibleResultUrls.length === 0,
              )}
              {renderBulkButton(
                "清空选择",
                () => setSelectedResultUrls([]),
                selectedResultUrls.length === 0,
              )}
              {renderBulkButton(
                visibleResults.length === images.length
                  ? "下载全部"
                  : "下载当前筛选",
                () => downloadAllResults(visibleResults),
                visibleResults.length === 0,
              )}
              {renderBulkButton(
                `设为优选${selectedResultUrls.length > 0 ? ` (${selectedResultUrls.length})` : ""}`,
                () =>
                  onPromoteSelectedResults?.(
                    selectedResults.map((item) => item.url),
                  ),
                selectedResultUrls.length === 0,
                "accent",
              )}
              {renderBulkButton(
                `删除已选${selectedResultUrls.length > 0 ? ` (${selectedResultUrls.length})` : ""}`,
                handleDeleteSelected,
                selectedResultUrls.length === 0,
                "danger",
              )}
              {failedJobs > 0
                ? renderBulkButton(
                    isRetryingFailedBatch
                      ? "重试中..."
                      : `重试失败任务 (${failedJobs})`,
                    () => {
                      void handleRetryFailedBatch();
                    },
                    !onRetryFailedBatch || isRetryingFailedBatch,
                  )
                : null}
            </div>

            <details className="rounded-2xl border border-gray-200 bg-gray-50/70">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-[11px] text-gray-600">
                <span className="font-semibold text-gray-800">更多批量操作</span>
                <span className="flex flex-wrap gap-1">
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-gray-500">
                    打包
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-gray-500">
                    导出清单
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-gray-500">
                    插入画布
                  </span>
                </span>
              </summary>
              <div className="flex flex-wrap gap-2 border-t border-gray-200 px-3 py-3">
                {renderBulkButton(
                  isPackagingAll
                    ? "正在打包当前筛选..."
                    : visibleResults.length === images.length
                      ? "打包全部 ZIP"
                      : "打包当前筛选 ZIP",
                  () => {
                    setIsPackagingAll(true);
                    void exportResultZip(
                      visibleResults,
                      visibleResults.length === images.length
                        ? "ecom-all-results"
                        : "ecom-filtered-results",
                    )
                      .catch((error) => {
                        window.alert(
                          error instanceof Error
                            ? error.message
                            : "打包当前筛选结果失败，请稍后重试。",
                        );
                      })
                      .finally(() => setIsPackagingAll(false));
                  },
                  visibleResults.length === 0 ||
                    isPackagingAll ||
                    isPackagingSelected,
                )}
                {renderBulkButton(
                  `下载已选${selectedResultUrls.length > 0 ? ` (${selectedResultUrls.length})` : ""}`,
                  () => downloadAllResults(selectedResults),
                  selectedResultUrls.length === 0,
                )}
                {renderBulkButton(
                  isPackagingSelected
                    ? "正在打包已选..."
                    : `打包已选 ZIP${selectedResultUrls.length > 0 ? ` (${selectedResultUrls.length})` : ""}`,
                  () => {
                    setIsPackagingSelected(true);
                    void exportResultZip(selectedResults, "ecom-selected-results")
                      .catch((error) => {
                        window.alert(
                          error instanceof Error
                            ? error.message
                            : "打包已选结果失败，请稍后重试。",
                        );
                      })
                      .finally(() => setIsPackagingSelected(false));
                  },
                  selectedResultUrls.length === 0 ||
                    isPackagingSelected ||
                    isPackagingAll,
                )}
                {renderBulkButton(
                  visibleResults.length === images.length
                    ? "导出全部清单"
                    : "导出当前筛选清单",
                  () =>
                    exportResultManifest(
                      visibleResults,
                      visibleResults.length === images.length
                        ? "ecom-all-results"
                        : "ecom-filtered-results",
                    ),
                  visibleResults.length === 0,
                )}
                {renderBulkButton(
                  `导出已选清单${selectedResultUrls.length > 0 ? ` (${selectedResultUrls.length})` : ""}`,
                  () => exportResultManifest(selectedResults, "ecom-selected-pack"),
                  selectedResultUrls.length === 0,
                )}
                {renderBulkButton(
                  `插入画布${selectedResultUrls.length > 0 ? ` (${selectedResultUrls.length})` : ""}`,
                  () =>
                    selectedResults.forEach((item) =>
                      onInsertToCanvas?.(item.url, item.label),
                    ),
                  selectedResultUrls.length === 0,
                )}
              </div>
            </details>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
            <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5">
              当前分组 {displayGroups.length}
            </span>
            <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5">
              当前结果 {visibleResults.length}
            </span>
            <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5">
              已完成任务 {doneJobs}/{batchJobs.length || 0}
            </span>
            <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5">
              {failedJobs > 0
                ? `失败任务 ${failedJobs}`
                : visiblePreferredCount > 0
                  ? "当前筛选含优选"
                  : visibleHighScoreCount > 0
                    ? `高分图 ${visibleHighScoreCount}`
                    : preferredResultUrl
                      ? "优选不在当前筛选"
                      : "尚未设优选"}
            </span>
          </div>

          {compareResults.length === 2 ? (
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-gray-900">
                    双图对比
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500">
                    已选 2 张结果，可直接对比构图、质感和卖点表达后再设为优选。
                  </div>
                </div>
                {renderBulkButton("清空对比", () => setSelectedResultUrls([]))}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {compareResults.map((image, index) => {
                  const meta = parseResultMeta(
                    image.label,
                    `结果 ${index + 1}`,
                  );
                  return (
                    <div
                      key={`compare-${image.url}`}
                      className="overflow-hidden rounded-xl border border-white bg-white"
                    >
                      <img
                        src={image.url}
                        alt={meta.fullLabel}
                        className={
                          variant === "drawer"
                            ? "h-72 w-full object-cover"
                            : "h-56 w-full object-cover"
                        }
                      />
                      <div className="border-t border-gray-100 px-3 py-2">
                        <div className="text-xs font-semibold text-gray-900">
                          {meta.fullLabel}
                        </div>
                        {image.review ? (
                          <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-[11px] leading-5 text-gray-600">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-gray-800">
                                评审分 {image.review.score}
                              </span>
                              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-gray-500">
                                置信度：
                                {image.review.confidence === "high"
                                  ? "高"
                                  : image.review.confidence === "medium"
                                    ? "中"
                                    : "低"}
                              </span>
                            </div>
                            <div className="mt-1">{image.review.summary}</div>
                            {image.review.strengths.length > 0 ? (
                              <div className="mt-1 text-emerald-700">
                                优点：{image.review.strengths.join("；")}
                              </div>
                            ) : null}
                            {image.review.issues.length > 0 ? (
                              <div className="mt-1 text-amber-700">
                                问题：{image.review.issues.join("；")}
                              </div>
                            ) : null}
                            {image.review.recommendedUse ? (
                              <div className="mt-1 text-blue-700">
                                建议用途：{image.review.recommendedUse}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {getGenerationMetaChips(image.generationMeta).length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {getGenerationMetaChips(image.generationMeta).map((chip) => (
                              <span
                                key={`${image.url}-${chip.text}`}
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${chip.className}`}
                              >
                                {chip.text}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {getReviewRiskNote(image.review) ? (
                          <div
                            className={`mt-2 rounded-lg px-3 py-2 text-[11px] leading-5 ${getReviewRiskNote(image.review)?.className}`}
                          >
                            {getReviewRiskNote(image.review)?.text}
                          </div>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {renderBulkButton(
                            "设为优选",
                            () => onPromoteResult?.(image.url),
                            !onPromoteResult,
                            "accent",
                          )}
                          {renderBulkButton(
                            "插入画布",
                            () => onInsertToCanvas?.(image.url, image.label),
                            !onInsertToCanvas,
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {displayGroups.length > 0 ? (
            <div className="space-y-4">
              {displayGroups.map((group, groupIndex) => {
                const accent = getResultGroupAccent(groupIndex);
                const sourceBadge = getResultGroupSourceBadge(group);
                const groupUrls = group.sections.flatMap((section) =>
                  section.items.map((item) => item.image.url),
                );
                const groupSelectedCount = group.sections.reduce(
                  (total, section) => total + section.selectedCount,
                  0,
                );
                const allInGroupSelected =
                  groupUrls.length > 0 && groupSelectedCount === groupUrls.length;
                const groupPreferredCount = group.sections.reduce(
                  (total, section) =>
                    total + section.items.filter((item) => item.isPreferred).length,
                  0,
                );
                const groupRiskCount = group.sections.reduce(
                  (total, section) =>
                    total +
                    section.items.filter((item) =>
                      hasConsistencyRisk(item.image.review),
                    ).length,
                  0,
                );

                return (
                  <div
                    key={group.key}
                    className={`rounded-3xl border p-3 ${accent.shell}`}
                  >
                    <div
                      className={`rounded-2xl border px-4 py-4 shadow-sm ${accent.header}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${accent.badge}`}
                            >
                              方案组 {groupIndex + 1}
                            </span>
                            <div className="truncate text-sm font-semibold text-gray-900">
                              {group.title}
                            </div>
                            {sourceBadge ? (
                              <span
                                className={`rounded-full px-2 py-1 text-[10px] font-medium ${sourceBadge.className}`}
                              >
                                {sourceBadge.text}
                              </span>
                            ) : null}
                            {group.hasPreferred ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                                已含首选图
                              </span>
                            ) : null}
                            {typeof group.bestScore === "number" ? (
                              <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                                组内最高评审 {group.bestScore}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2 text-[11px] leading-6 text-gray-600">
                            {group.summary ||
                              `这一组共 ${group.sections.length} 条镜头方案，结果会按方案卡聚合，方便继续筛选和回看版本。`}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-gray-500">
                            <span className="rounded-full bg-white px-2.5 py-1">
                              镜头 {group.sections.length}
                            </span>
                            <span className="rounded-full bg-white px-2.5 py-1">
                              结果 {group.totalResults}
                            </span>
                            <span className="rounded-full bg-white px-2.5 py-1">
                              已选 {groupSelectedCount}
                            </span>
                            {groupPreferredCount > 0 ? (
                              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                                首选 {groupPreferredCount}
                              </span>
                            ) : null}
                            {groupRiskCount > 0 ? (
                              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700">
                                待复核 {groupRiskCount}
                              </span>
                            ) : null}
                            {group.priority ? (
                              <span className="rounded-full bg-gray-100 px-2.5 py-1">
                                优先级 {group.priority}
                              </span>
                            ) : null}
                            {group.platformTags?.slice(0, 3).map((tag) => (
                              <span
                                key={`${group.key}-${tag}`}
                                className="rounded-full bg-slate-100 px-2.5 py-1"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedResultUrls((prev) =>
                                allInGroupSelected
                                  ? prev.filter((url) => !groupUrls.includes(url))
                                  : Array.from(new Set([...prev, ...groupUrls])),
                              )
                            }
                            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition hover:border-gray-400 active:scale-[0.99]"
                          >
                            {allInGroupSelected
                              ? "取消本组"
                              : `选择本组${
                                  groupSelectedCount > 0
                                    ? ` (${groupSelectedCount}/${groupUrls.length})`
                                    : ""
                                }`}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              downloadAllResults(
                                group.sections.flatMap((section) =>
                                  section.items.map((item) => item.image),
                                ),
                              )
                            }
                            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition hover:border-gray-400 active:scale-[0.99]"
                          >
                            下载本组
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              insertResultsToCanvas(
                                group.sections.flatMap((section) =>
                                  section.items.map((item) => item.image),
                                ),
                              )
                            }
                            disabled={!onInsertToCanvas}
                            className={[
                              "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                              onInsertToCanvas
                                ? "border border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                                : "cursor-not-allowed bg-gray-200 text-gray-400",
                            ].join(" ")}
                          >
                            插入本组
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {group.sections.map((section, sectionIndex) => (
                          <span
                            key={`${group.key}-outline-${section.key}`}
                            className="rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[10px] text-gray-600"
                          >
                            组内镜头 {sectionIndex + 1} · {section.title} · {section.items.length} 张
                          </span>
                        ))}
                      </div>
                    </div>

                    <div
                      className={
                        variant === "drawer"
                          ? "mt-3 grid gap-3 xl:grid-cols-2"
                          : "mt-3 grid gap-3"
                      }
                    >
                      {group.sections.map((section) => {
                        const sectionUrls = section.items.map((item) => item.image.url);
                        const allInSectionSelected =
                          section.items.length > 0 &&
                          section.selectedCount === section.items.length;
                        const isExpanded = Boolean(expandedSections[section.key]);
                        const visibleItems =
                          section.items.length > 2 && !isExpanded
                            ? section.items.slice(-2)
                            : section.items;

                        return (
                          <div
                            key={section.key}
                            className="rounded-2xl border border-white/80 bg-white/90 p-3 shadow-sm"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="truncate text-xs font-semibold text-gray-900">
                                    {section.title}
                                  </div>
                                  {section.typeTitle ? (
                                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-600">
                                      {section.typeTitle}
                                    </span>
                                  ) : null}
                                  {section.items.some((item) => item.isPreferred) ? (
                                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-600">
                                      含首选
                                    </span>
                                  ) : null}
                                  {typeof section.bestScore === "number" ? (
                                    <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                                      最高评审 {section.bestScore}
                                    </span>
                                  ) : null}
                                  {section.items.some((item) =>
                                    hasConsistencyRisk(item.image.review),
                                  ) ? (
                                    <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700">
                                      含待复核版本
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-gray-400">
                                  <span>结果 {section.items.length}</span>
                                  <span>
                                    {section.items.length > 1
                                      ? `历史版本 ${section.items.length}`
                                      : "当前仅 1 个版本"}
                                  </span>
                                  {section.planItemId ? (
                                    <span className="truncate">
                                      方案 ID: {section.planItemId}
                                    </span>
                                  ) : (
                                    <span>未匹配到任务来源</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedResultUrls((prev) =>
                                      allInSectionSelected
                                        ? prev.filter(
                                            (url) => !sectionUrls.includes(url),
                                          )
                                        : Array.from(
                                            new Set([...prev, ...sectionUrls]),
                                          ),
                                    )
                                  }
                                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition hover:border-gray-400 active:scale-[0.99]"
                                >
                                  {allInSectionSelected
                                    ? "取消本条"
                                    : `选择本条${
                                        section.selectedCount > 0
                                          ? ` (${section.selectedCount}/${section.items.length})`
                                          : ""
                                      }`}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedSections((prev) => ({
                                      ...prev,
                                      [section.key]: !prev[section.key],
                                    }))
                                  }
                                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition hover:border-gray-400 active:scale-[0.99]"
                                >
                                  {section.items.length > 2
                                    ? isExpanded
                                      ? "收起版本"
                                      : `展开版本 (${section.items.length})`
                                    : "当前 1-2 个版本"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPackagingSectionKey(section.key);
                                    void exportResultZip(
                                      section.items.map((item) => item.image),
                                      `${section.title}-pack`,
                                      section.title,
                                    )
                                      .catch((error) => {
                                        window.alert(
                                          error instanceof Error
                                            ? error.message
                                            : "本条结果打包失败，请稍后重试。",
                                        );
                                      })
                                      .finally(() => setPackagingSectionKey(null));
                                  }}
                                  disabled={packagingSectionKey === section.key}
                                  className={[
                                    "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.99]",
                                    packagingSectionKey === section.key
                                      ? "cursor-wait bg-gray-200 text-gray-400"
                                      : "border border-gray-300 bg-white text-gray-700 hover:border-gray-400",
                                  ].join(" ")}
                                >
                                  {packagingSectionKey === section.key
                                    ? "打包中..."
                                    : "ZIP"}
                                </button>
                              </div>
                            </div>

                            <div className={sectionGridClass}>
                              {visibleItems.map((item) => (
                                <div
                                  key={`${section.key}-${item.image.url}`}
                                  className="group overflow-hidden rounded-xl border border-gray-200 bg-white transition active:scale-[0.995]"
                                >
                                  <img
                                    src={item.image.url}
                                    alt={item.meta.fullLabel}
                                    onClick={() => onPreviewResult?.(item.image.url)}
                                    className={[
                                      variant === "drawer"
                                        ? "h-40 w-full object-cover transition-transform group-hover:scale-105"
                                        : "h-32 w-full object-cover transition-transform group-hover:scale-105",
                                      onPreviewResult ? "cursor-zoom-in" : "",
                                    ].join(" ")}
                                  />
                                  <label className="flex items-center gap-1 border-b border-gray-100 px-2 py-1 text-[10px] text-gray-500">
                                    <input
                                      type="checkbox"
                                      checked={selectedResultUrls.includes(
                                        item.image.url,
                                      )}
                                      onChange={() =>
                                        setSelectedResultUrls((prev) =>
                                          prev.includes(item.image.url)
                                            ? prev.filter(
                                                (url) => url !== item.image.url,
                                              )
                                            : [...prev, item.image.url],
                                        )
                                      }
                                    />
                                    选择此结果
                                  </label>
                                  <div className="px-2 py-1.5">
                                    <div className="mb-2 flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-1">
                                          <span className="truncate text-[10px] font-medium text-gray-700">
                                            {item.meta.title}
                                          </span>
                                          {item.meta.version ? (
                                            <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-600">
                                              {item.meta.version}
                                            </span>
                                          ) : null}
                                          {item.isPreferred ? (
                                            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600">
                                              首选
                                            </span>
                                          ) : null}
                                          {hasConsistencyRisk(item.image.review) ? (
                                            <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold text-rose-700">
                                              待复核
                                            </span>
                                          ) : null}
                                        </div>
                                        <div className="mt-1 text-[10px] text-gray-400">
                                          本条第 {item.index - section.firstIndex + 1} 张
                                        </div>
                                      </div>
                                      <div className="text-[10px] text-gray-400">
                                        {item.image.review
                                          ? `评审 ${item.image.review.score}`
                                          : `#${item.index + 1}`}
                                      </div>
                                    </div>
                                    {item.image.review ? (
                                      <div className="mb-2 rounded-lg bg-gray-50 px-2 py-1.5 text-[10px] leading-5 text-gray-600">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="font-semibold text-gray-800">
                                            评审分 {item.image.review.score}
                                          </span>
                                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] text-gray-500">
                                            {item.image.review.confidence === "high"
                                              ? "高置信"
                                              : item.image.review.confidence ===
                                                  "medium"
                                                ? "中置信"
                                                : "低置信"}
                                          </span>
                                        </div>
                                        <div className="mt-1 line-clamp-2">
                                          {item.image.review.summary}
                                        </div>
                                        {item.image.review.recommendedUse ? (
                                          <div className="mt-1 text-blue-700">
                                            建议用途：{item.image.review.recommendedUse}
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : null}
                                    {getGenerationMetaChips(item.image.generationMeta)
                                      .length > 0 ? (
                                      <div className="mb-2 flex flex-wrap gap-1">
                                        {getGenerationMetaChips(
                                          item.image.generationMeta,
                                        ).map((chip) => (
                                          <span
                                            key={`${item.image.url}-${chip.text}`}
                                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${chip.className}`}
                                          >
                                            {chip.text}
                                          </span>
                                        ))}
                                      </div>
                                    ) : null}
                                    {getReviewRiskNote(item.image.review) ? (
                                      <div
                                        className={`mb-2 rounded-lg px-2 py-1.5 text-[10px] leading-5 ${getReviewRiskNote(item.image.review)?.className}`}
                                      >
                                        {getReviewRiskNote(item.image.review)?.text}
                                      </div>
                                    ) : null}
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => onPromoteResult?.(item.image.url)}
                                        className="text-[10px] text-gray-500 transition hover:text-black active:scale-[0.99]"
                                      >
                                        {item.isPreferred ? "当前首选" : "设为首选"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onPreviewResult?.(item.image.url)
                                        }
                                        className="text-[10px] text-gray-500 transition hover:text-black active:scale-[0.99]"
                                      >
                                        查看大图
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onInsertToCanvas?.(
                                            item.image.url,
                                            item.image.label,
                                          )
                                        }
                                        className="text-[10px] text-gray-700 transition hover:text-black active:scale-[0.99]"
                                      >
                                        插入画布
                                      </button>
                                      <a
                                        href={item.image.url}
                                        download={`${sanitizeDownloadName(item.meta.fullLabel)}.png`}
                                        className="text-[10px] text-gray-500 transition hover:text-black active:scale-[0.99]"
                                      >
                                        下载
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onDeleteResult?.(item.image.url)
                                        }
                                        className="text-[10px] text-gray-500 transition hover:text-red-600 active:scale-[0.99]"
                                      >
                                        删除
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
              <div className="text-sm font-semibold text-gray-700">
                当前筛选下没有匹配结果
              </div>
              <p className="mt-2 text-xs leading-6 text-gray-500">
                可以试试切回“全部结果”，或清空搜索词后再继续筛选与批量操作。
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {renderBulkButton("查看全部结果", () => setResultFilter("all"))}
                {renderBulkButton(
                  "清空搜索",
                  () => setSearchText(""),
                  searchText.trim().length === 0,
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
          <div className="text-sm font-semibold text-gray-700">
            暂时还没有可评审的结果
          </div>
          <p className="mt-2 text-xs leading-6 text-gray-500">
            批量生成产出后，这里会自动按方案项聚合结果，方便继续筛选、下载和插入画布。
          </p>
          {failedJobs > 0 && onRetryFailedBatch ? (
            <div className="mt-4">
              {renderBulkButton(
                isRetryingFailedBatch
                  ? "重试中..."
                  : `重试失败任务 (${failedJobs})`,
                () => {
                  void handleRetryFailedBatch();
                },
                isRetryingFailedBatch,
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
