import type {
  EcommerceCompetitorDeckAnalysis,
  EcommercePlanGroup,
} from "../types/workflow.types";

const normalizeCompetitorHintText = (value: string): string =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "");

const COMPETITOR_ROLE_HINT_RULES: Array<{
  label: string;
  keywords: string[];
}> = [
  { label: "首屏承接位", keywords: ["hero", "首屏", "首图", "封面", "开场", "视觉锤"] },
  { label: "白底卖点位", keywords: ["white-bg", "白底", "卖点", "平铺"] },
  { label: "场景带入位", keywords: ["scene", "场景", "氛围", "使用"] },
  { label: "对比说明位", keywords: ["comparison", "对比", "对照", "差异"] },
  { label: "细节证明位", keywords: ["detail", "细节", "特写", "做工", "材质"] },
  { label: "参数规格位", keywords: ["spec", "参数", "规格", "尺寸"] },
  { label: "转化收口位", keywords: ["conversion", "cta", "转化", "下单", "背书", "保障"] },
  { label: "卖点展开位", keywords: ["selling", "卖点", "优势", "亮点"] },
];

const buildMatchTokens = (texts: Array<string | null | undefined>): string[] =>
  Array.from(
    new Set(
      texts.flatMap((text) =>
        String(text || "")
          .split(/[\s,，。；;、|/()（）【】\[\]<>《》:+-]+/g)
          .map(normalizeCompetitorHintText)
          .filter((token) => token.length >= 2 && token.length <= 24),
      ),
    ),
  ).slice(0, 16);

const buildPlanGroupTexts = (group: EcommercePlanGroup): string[] => [
  group.typeTitle,
  group.summary,
  ...group.items.flatMap((item) => [
    item.title,
    item.description,
    item.marketingGoal,
    item.keyMessage,
    item.composition,
  ]),
];

export const buildEcommercePlanGroupAnchorId = (groupId: string): string =>
  `ecom-plan-group-${String(groupId || "").replace(/[^a-zA-Z0-9_-]/g, "-")}`;

export const ECOMMERCE_PLAN_GROUP_NAVIGATE_EVENT =
  "jkstudio:ecommerce-plan-group-navigate";

export const getCompetitorRoleHintFromTexts = (
  sourceTexts: Array<string | null | undefined>,
  recommendedPageSequence: string[],
): { label: string; matchedText: string } | null => {
  if (
    !Array.isArray(recommendedPageSequence) ||
    recommendedPageSequence.length === 0
  ) {
    return null;
  }

  const sourceText = normalizeCompetitorHintText(sourceTexts.filter(Boolean).join(" "));
  if (!sourceText) {
    return null;
  }

  let bestMatch: { label: string; matchedText: string; score: number } | null = null;

  for (const candidate of recommendedPageSequence.slice(0, 8)) {
    const normalizedCandidate = normalizeCompetitorHintText(candidate);
    if (!normalizedCandidate) {
      continue;
    }

    for (const rule of COMPETITOR_ROLE_HINT_RULES) {
      const score = rule.keywords.reduce((sum, keyword) => {
        const normalizedKeyword = normalizeCompetitorHintText(keyword);
        const candidateMatched =
          normalizedCandidate.includes(normalizedKeyword) ||
          normalizedKeyword.includes(normalizedCandidate);
        const sourceMatched = sourceText.includes(normalizedKeyword);
        return candidateMatched && sourceMatched ? sum + 1 : sum;
      }, 0);

      if (!score) {
        continue;
      }

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          label: rule.label,
          matchedText: candidate,
          score,
        };
      }
    }
  }

  return bestMatch
    ? { label: bestMatch.label, matchedText: bestMatch.matchedText }
    : null;
};

export type EcommerceCompetitorDeckMatch = {
  competitorId: string;
  score: number;
  matchedRoleLabel?: string;
  matchedSequenceText?: string;
};

const rankCompetitorDeckMatchesForTexts = ({
  sourceTexts,
  analyses,
  recommendedPageSequence,
  maxResults = 2,
}: {
  sourceTexts: Array<string | null | undefined>;
  analyses: EcommerceCompetitorDeckAnalysis[];
  recommendedPageSequence: string[];
  maxResults?: number;
}): EcommerceCompetitorDeckMatch[] => {
  if (!Array.isArray(analyses) || analyses.length === 0) {
    return [];
  }

  const roleHint = getCompetitorRoleHintFromTexts(
    sourceTexts,
    recommendedPageSequence,
  );
  const sourceTokens = buildMatchTokens(sourceTexts);
  const matchedSequenceText = normalizeCompetitorHintText(roleHint?.matchedText || "");
  const roleKeywords =
    COMPETITOR_ROLE_HINT_RULES.find((rule) => rule.label === roleHint?.label)?.keywords.map(
      normalizeCompetitorHintText,
    ) || [];

  return analyses
    .map((analysis) => {
      const candidateTexts = [
        ...(analysis.planningHints?.recommendedPageSequence || []),
        analysis.overview?.productPositioning,
        analysis.overview?.overallStyle,
        analysis.overview?.narrativePattern,
        analysis.overview?.conversionStrategy,
        ...(analysis.borrowablePrinciples || []),
        ...(analysis.globalPatterns?.commonPageRoles || []),
        ...(analysis.globalPatterns?.commonSellingPointOrder || []),
        ...(analysis.globalPatterns?.commonLayoutPatterns || []),
        ...(analysis.globalPatterns?.commonTextStrategies || []),
        ...((analysis.pageSequence || []).flatMap((page) => [
          page.pageRole,
          page.titleSummary,
          page.businessTask,
          page.keySellingPoint,
          page.layoutPattern,
          page.evidenceStyle,
          page.notes,
        ]) || []),
      ];

      const normalizedTexts = candidateTexts
        .map((text) => normalizeCompetitorHintText(String(text || "")))
        .filter(Boolean);

      let score = 0;

      if (
        matchedSequenceText &&
        normalizedTexts.some(
          (text) =>
            text.includes(matchedSequenceText) || matchedSequenceText.includes(text),
        )
      ) {
        score += 5;
      }

      const roleHits = roleKeywords.filter((keyword) =>
        normalizedTexts.some((text) => text.includes(keyword)),
      ).length;
      score += Math.min(4, roleHits * 2);

      const tokenHits = sourceTokens.filter((token) =>
        normalizedTexts.some((text) => text.includes(token) || token.includes(text)),
      ).length;
      score += Math.min(3, tokenHits);

      return {
        competitorId: analysis.competitorId,
        score,
        matchedRoleLabel: roleHint?.label,
        matchedSequenceText: roleHint?.matchedText,
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, maxResults));
};

export const rankCompetitorDeckMatchesForPlanGroup = ({
  group,
  analyses,
  recommendedPageSequence,
  maxResults = 2,
}: {
  group: EcommercePlanGroup;
  analyses: EcommerceCompetitorDeckAnalysis[];
  recommendedPageSequence: string[];
  maxResults?: number;
}): EcommerceCompetitorDeckMatch[] =>
  rankCompetitorDeckMatchesForTexts({
    sourceTexts: buildPlanGroupTexts(group),
    analyses,
    recommendedPageSequence,
    maxResults,
  });

export const rankCompetitorDeckMatchesForPlanItem = ({
  groupTitle,
  groupSummary,
  item,
  analyses,
  recommendedPageSequence,
  maxResults = 2,
}: {
  groupTitle: string;
  groupSummary?: string | null;
  item: EcommercePlanGroup["items"][number];
  analyses: EcommerceCompetitorDeckAnalysis[];
  recommendedPageSequence: string[];
  maxResults?: number;
}): EcommerceCompetitorDeckMatch[] =>
  rankCompetitorDeckMatchesForTexts({
    sourceTexts: [
      groupTitle,
      groupSummary,
      item.title,
      item.description,
      item.marketingGoal,
      item.keyMessage,
      item.composition,
    ],
    analyses,
    recommendedPageSequence,
    maxResults,
  });

export const dispatchEcommercePlanGroupNavigate = (groupId: string): void => {
  if (typeof window === "undefined" || !groupId) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(ECOMMERCE_PLAN_GROUP_NAVIGATE_EVENT, {
      detail: { groupId },
    }),
  );
};
