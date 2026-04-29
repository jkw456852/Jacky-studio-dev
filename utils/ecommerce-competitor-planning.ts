import type {
  EcommerceCompetitorDeckAnalysis,
  EcommerceCompetitorDeckInput,
  EcommerceCompetitorImageAnalysisItem,
  EcommerceCompetitorPlanningContext,
} from "../types/workflow.types";

const dedupeTextList = (items: Array<string | null | undefined>): string[] =>
  Array.from(
    new Set(
      items
        .map((item) => String(item || "").trim())
        .filter((item) => item.length > 0),
    ),
  );

const flattenPlanningHints = (
  analyses: EcommerceCompetitorDeckAnalysis[],
  key: keyof EcommerceCompetitorDeckAnalysis["planningHints"],
): string[] =>
  dedupeTextList(
    analyses.flatMap((analysis) => analysis.planningHints?.[key] || []),
  );

const trimText = (value: string, maxLength = 34): string => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
};

const splitRawSentences = (value: string): string[] =>
  String(value || "")
    .replace(/\r/g, "\n")
    .split(/[\n。！？；]/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length >= 8);

type CompetitorRoleMeta = {
  key: string;
  label: string;
  storyHint: string;
  keywords: string[];
};

const RAW_ROLE_METAS: CompetitorRoleMeta[] = [
  {
    key: "hero",
    label: "开场定位页",
    storyHint: "先用开场定位页快速说明产品是谁、解决什么问题。",
    keywords: ["首屏", "主视觉", "封面", "开场", "定位", "品牌", "第一页", "第一屏"],
  },
  {
    key: "selling",
    label: "核心卖点页",
    storyHint: "中段优先拆解核心功能，并把技术点翻译成用户收益。",
    keywords: ["卖点", "功能", "利益点", "优势", "性能", "能力", "核心", "亮点"],
  },
  {
    key: "scene",
    label: "场景演示页",
    storyHint: "补使用场景或操作过程，让卖点有真实画面支撑。",
    keywords: ["场景", "家居", "客厅", "卧室", "厨房", "环境", "使用", "操作", "演示"],
  },
  {
    key: "detail",
    label: "细节工艺页",
    storyHint: "用细节特写强化做工、结构和品质感。",
    keywords: ["细节", "材质", "做工", "结构", "部件", "工艺", "设计", "纹理"],
  },
  {
    key: "proof",
    label: "证据对比页",
    storyHint: "加入对比、测试或数据证明，增强可信度。",
    keywords: ["对比", "测试", "实验", "认证", "数据", "证明", "效果", "前后", "实测"],
  },
  {
    key: "spec",
    label: "参数配置页",
    storyHint: "尾段用参数或规格信息做信息收口。",
    keywords: ["参数", "规格", "尺寸", "容量", "续航", "功率", "配置", "噪音"],
  },
  {
    key: "service",
    label: "服务保障页",
    storyHint: "最后补服务保障，承接用户下单顾虑。",
    keywords: ["服务", "售后", "质保", "保障", "安装", "发货", "配送", "客服"],
  },
];

const collectRawAnalysisItems = (
  decks: EcommerceCompetitorDeckInput[],
): Array<
  EcommerceCompetitorImageAnalysisItem & {
    totalImages: number;
  }
> =>
  decks.flatMap((deck) => {
    const totalImages = Array.isArray(deck.images) ? deck.images.length : 0;
    return (Array.isArray(deck.imageAnalyses) ? deck.imageAnalyses : [])
      .filter(
        (item) =>
          item.status === "success" &&
          String(item.responseText || "").trim().length > 0,
      )
      .sort((left, right) => left.imageIndex - right.imageIndex)
      .map((item) => ({
        ...item,
        totalImages,
      }));
  });

const inferRoleMetaForRawAnalysis = (
  item: EcommerceCompetitorImageAnalysisItem & {
    totalImages: number;
  },
): CompetitorRoleMeta => {
  const text = String(item.responseText || "");
  const scored = RAW_ROLE_METAS.map((meta) => ({
    meta,
    score: meta.keywords.reduce(
      (count, keyword) => (text.includes(keyword) ? count + 1 : count),
      0,
    ),
  })).sort((left, right) => right.score - left.score);

  if (scored[0]?.score > 0) {
    return scored[0].meta;
  }

  if (item.imageIndex <= 1) {
    return RAW_ROLE_METAS[0];
  }

  if (item.totalImages > 0 && item.imageIndex >= item.totalImages) {
    return RAW_ROLE_METAS[5];
  }

  return {
    key: "mid",
    label: "中段说明页",
    storyHint: "中段继续展开卖点、场景和解释信息，保持一页一重点。",
    keywords: [],
  };
};

const collectKeywordSentences = (
  items: string[],
  keywords: string[],
  limit: number,
  fallback: string[],
): string[] => {
  const matched = dedupeTextList(
    items.flatMap((item) =>
      splitRawSentences(item)
        .filter((sentence) => keywords.some((keyword) => sentence.includes(keyword)))
        .map((sentence) => trimText(sentence)),
    ),
  );
  return dedupeTextList([...matched, ...fallback]).slice(0, limit);
};

export const buildCompetitorPlanningContext = (
  analyses: EcommerceCompetitorDeckAnalysis[],
): EcommerceCompetitorPlanningContext | null => {
  if (!Array.isArray(analyses) || analyses.length === 0) {
    return null;
  }

  return {
    deckCount: analyses.length,
    recommendedPageSequence: flattenPlanningHints(
      analyses,
      "recommendedPageSequence",
    ),
    recommendedStoryOrder: flattenPlanningHints(
      analyses,
      "recommendedStoryOrder",
    ),
    recommendedVisualPrinciples: flattenPlanningHints(
      analyses,
      "recommendedVisualPrinciples",
    ),
    recommendedTextPrinciples: flattenPlanningHints(
      analyses,
      "recommendedTextPrinciples",
    ),
    borrowablePrinciples: dedupeTextList(
      analyses.flatMap((analysis) => analysis.borrowablePrinciples || []),
    ),
    avoidCopying: dedupeTextList(
      analyses.flatMap((analysis) => analysis.avoidCopying || []),
    ),
    opportunitiesForOurProduct: dedupeTextList(
      analyses.flatMap((analysis) => analysis.opportunitiesForOurProduct || []),
    ),
  };
};

export const buildCompetitorPlanningContextFromRawImageAnalyses = (
  decks: EcommerceCompetitorDeckInput[],
): EcommerceCompetitorPlanningContext | null => {
  if (!Array.isArray(decks) || decks.length === 0) {
    return null;
  }

  const successfulDecks = decks.filter((deck) =>
    (Array.isArray(deck.imageAnalyses) ? deck.imageAnalyses : []).some(
      (item) =>
        item.status === "success" &&
        String(item.responseText || "").trim().length > 0,
    ),
  );
  const rawItems = collectRawAnalysisItems(successfulDecks);
  if (rawItems.length === 0) {
    return null;
  }

  const roleMetas = rawItems.map((item) => inferRoleMetaForRawAnalysis(item));
  const orderedRoleLabels = dedupeTextList(roleMetas.map((item) => item.label));
  const rawTexts = rawItems.map((item) => String(item.responseText || ""));
  const opportunities = [
    orderedRoleLabels.includes("核心卖点页")
      ? "把技术点改写成用户收益标题，不只堆功能名词。"
      : null,
    orderedRoleLabels.includes("场景演示页")
      ? "补真实使用场景，让画面直接证明卖点成立。"
      : null,
    orderedRoleLabels.includes("证据对比页")
      ? "增加对比或实测证据页，提升说服力。"
      : null,
    orderedRoleLabels.includes("细节工艺页")
      ? "补材质和结构细节特写，增强品质感。"
      : null,
    orderedRoleLabels.includes("参数配置页")
      ? "把关键规格整理成低阅读成本的信息页收口。"
      : null,
    "按“定位 -> 卖点 -> 场景 -> 证明 -> 收口”的顺序组织自家详情页。",
  ];

  return {
    deckCount: successfulDecks.length,
    recommendedPageSequence: orderedRoleLabels.slice(0, 8),
    recommendedStoryOrder: dedupeTextList(
      roleMetas.map((item) => item.storyHint),
    ).slice(0, 6),
    recommendedVisualPrinciples: collectKeywordSentences(
      rawTexts,
      ["版式", "结构", "视觉", "配图", "主标题", "视觉重点", "图文"],
      4,
      [
        "尽量保持一屏只讲一个核心信息，让主标题先抓住视线。",
        "让配图直接为文案主张提供视觉证明，而不是只放装饰图。",
        "优先使用层次清晰的版式，把标题、解释和补充信息分层展示。",
      ],
    ),
    recommendedTextPrinciples: collectKeywordSentences(
      rawTexts,
      ["文案", "标题", "利益点", "递进", "组织", "表达", "痛点", "技术点"],
      4,
      [
        "标题先讲用户收益，再补技术支撑和解释信息。",
        "正文按“主标题 -> 解释 -> 补充信息”递进，不要同层堆字。",
        "少讲抽象术语，多讲用户能直接感知的结果。",
      ],
    ),
    borrowablePrinciples: collectKeywordSentences(
      rawTexts,
      ["借鉴", "值得", "表达方式", "转化逻辑", "图文", "契合", "直观"],
      5,
      [
        "把技术能力翻译成用户最关心的实际收益。",
        "让图片和文案说同一件事，避免图文各讲各的。",
        "每页只承担一个清晰职责，减少信息打架。",
      ],
    ),
    avoidCopying: collectKeywordSentences(
      rawTexts,
      ["不确定", "看不清", "没有说明", "未说明", "笼统", "概括"],
      4,
      [
        "不要照抄竞品原文标题和卖点句式，要换成自家商品的真实证据。",
        "不要沿用竞品里看不清或没有说明清楚的信息。",
        "不要只搬技术名词，必须同步补上用户收益和使用场景。",
      ],
    ),
    opportunitiesForOurProduct: dedupeTextList(opportunities).slice(0, 5),
  };
};
