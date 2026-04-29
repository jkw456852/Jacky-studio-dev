import type {
  EcommerceCopyPlan,
  EcommercePlatformMode,
} from "../types/workflow.types";

type OldFlowArchetype =
  | "digital-gadget"
  | "beauty"
  | "food"
  | "apparel"
  | "general";

const normalizeText = (value: string | null | undefined): string =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const inferOldFlowArchetype = (...texts: Array<string | null | undefined>): OldFlowArchetype => {
  const seed = normalizeText(texts.filter(Boolean).join(" "));

  if (/吹风|美容仪|电动|充电|蓝牙|耳机|风扇|按摩|剃须|仪器|device|gadget|usb|smart|sensor/.test(seed)) {
    return "digital-gadget";
  }
  if (/精华|面霜|护肤|彩妆|口红|粉底|面膜|乳液|serum|cream|makeup|beauty|skincare/.test(seed)) {
    return "beauty";
  }
  if (/咖啡|奶茶|饮料|零食|食品|麦片|果汁|茶|coffee|drink|snack|food/.test(seed)) {
    return "food";
  }
  if (/服装|穿搭|包袋|鞋|帽|饰品|面料|外套|apparel|fashion|bag|shoe|fabric/.test(seed)) {
    return "apparel";
  }
  return "general";
};

const buildVisualProofGrammarLines = (
  archetype: OldFlowArchetype,
): string[] => {
  switch (archetype) {
    case "digital-gadget":
      return [
        "卖点视觉化原理：功能类卖点必须尽量转成结构、路径、状态或交互证据，而不是只写“更强、更智能、更高效”。",
        "优先使用结构透视、局部爆炸、剖面关系、引线标注、数据流、风流/水流/热流路径、before/after、操作动作演示。",
        "信息不足时不要伪造内部结构，可以退回示意化功能层或外部可见部件说明。",
      ];
    case "beauty":
      return [
        "卖点视觉化原理：护肤彩妆类卖点必须尽量转成质地、渗透、成分关系、肤感结果或局部使用状态，不要空喊功效。",
        "优先使用液滴/精华流动、剖面示意、成分关系、显色/延展/起泡状态、before/after、微观纹理放大。",
        "专业感不能做成素材拼贴，商品主体和关键证据必须保持明确主次。",
      ];
    case "food":
      return [
        "卖点视觉化原理：食品饮料类卖点必须尽量转成原料、颗粒、切面、冲泡/蒸腾/挂壁状态和真实食欲证据。",
        "优先使用原料特写、颗粒放大、液体轨迹、蒸汽状态、切面结构、冲泡路径、口感联想细节。",
        "不要为了戏剧化牺牲主体真实形态，也不要伪造用户看不见的功能结构。",
      ];
    case "apparel":
      return [
        "卖点视觉化原理：服饰配件类卖点必须尽量转成版型、垂坠、车线、面料纹理、穿戴关系和搭配语境，而不是只写风格词。",
        "优先使用局部车线特写、面料纹理放大、人体动态、搭配环境、尺寸参照、五金/边角/皮面细节。",
        "不要只做静物氛围，也不要为了搭配感把核心产品识别冲淡。",
      ];
    default:
      return [
        "卖点视觉化原理：抽象卖点必须尽量转成可被看到的证据，如结构关系、局部放大、参数承载、路径示意、场景动作或前后对比。",
        "如果某个卖点无法被视觉化证明，说明它不适合做当前单图主任务，应换成别的图承担。",
      ];
  }
};

const buildVisualSystemLines = (
  platformMode?: EcommercePlatformMode,
  selectedTypes?: Array<{ id: string; title: string; imageCount: number }>,
): string[] => {
  const normalizedTypes = (selectedTypes || []).map((item) =>
    normalizeText(`${item.id} ${item.title}`),
  );
  const hasInfoHeavyType = normalizedTypes.some((text) =>
    /size|structure|ingredient|comparison|steps|spec|参数|结构|尺寸|对比|步骤/.test(
      text,
    ),
  );

  return [
    "整套视觉系统原则：全套图必须像同一品牌详情页系统，而不是不同模型随机生成的散图。",
    "至少统一这些维度：主色/辅色/点缀色、背景材质倾向、光比与色温、镜头语言、UI/说明图形语气、精致度等级。",
    platformMode === "amazon"
      ? "平台倾向：亚马逊类平台优先统一为克制、标准、可读、偏信息化的商业系统。"
      : platformMode === "xiaohongshu" || platformMode === "douyin"
        ? "平台倾向：内容平台可保留更强情绪感，但仍要保持统一镜头语言与品牌世界观。"
        : "平台倾向：详情页导向平台优先统一为可排版、可说明、可落地的商业系统。",
    hasInfoHeavyType
      ? "当前存在结构/参数/对比类图，全套系统必须兼容说明型模块，不能只会做漂亮主视觉。"
      : "即便当前信息型图较少，也要保证后续扩展成详情页时系统感仍能延续。",
  ];
};

export const buildOldFlowPlanningContextBlock = (options: {
  brief?: string;
  platformMode?: EcommercePlatformMode;
  supplementSummary?: string;
  selectedTypes?: Array<{ id: string; title: string; imageCount: number }>;
}): string => {
  const { brief, platformMode, supplementSummary, selectedTypes } = options;
  const archetype = inferOldFlowArchetype(brief);

  return [
    "老流程规划原理：",
    "详情页设计原则：先定整套页序职责，再定每张图的单一商业任务，不要让单图承担整套信息。",
    "详情页设计原则：每张图都必须同时考虑主体区、标题区、卖点区、说明区或证据区的层级关系。",
    "详情页设计原则：补充信息优先用来约束证据表达、结构说明、版式承载和文案主次，而不是只堆更多修饰词。",
    supplementSummary
      ? `补充信息优先约束：${supplementSummary}`
      : "补充信息不足时，优先围绕商品识别、证据表达与版式承载能力做保守规划。",
    ...buildVisualProofGrammarLines(archetype),
    ...buildVisualSystemLines(platformMode, selectedTypes),
  ]
    .filter(Boolean)
    .join("\n");
};

export const buildOldFlowSingleImagePrincipleLines = (options: {
  brief?: string;
  platformMode?: EcommercePlatformMode;
  groupTitle: string;
  itemTitle: string;
  itemDescription?: string;
}): string[] => {
  const { brief, platformMode, groupTitle, itemTitle, itemDescription } = options;
  const archetype = inferOldFlowArchetype(
    brief,
    groupTitle,
    itemTitle,
    itemDescription,
  );

  return [
    "输出目标不是普通海报，而是可直接落地到详情页/主图场景的专业电商成图。",
    "当前单图必须有清晰信息层级，让主体区、标题区、卖点区、功能说明区或结构展示区的关系一眼看懂。",
    "每张图只承担一个最核心的商业任务，不要把整套详情页的所有信息塞进一张图里。",
    "卖点不能只停留在抽象形容词，必须变成可见证据，如结构透视、局部特写、材质放大、before/after、路径示意、参数承载、引线标注或真实动作结果。",
    "要先锁定商品一致性，再落实当前模块镜头与卖点视觉化，最后再补充版式、文字层级、色彩材质与限制条件。",
    "必须兼顾商业冲击力和信息表达效率，既要像成片，也要让用户快速读懂为什么值得买。",
    ...buildVisualProofGrammarLines(archetype),
    ...buildVisualSystemLines(platformMode),
  ];
};

export const buildOldFlowDirectTextPrincipleLines = (
  copyPlan?: EcommerceCopyPlan | null,
): string[] => {
  const hasCopy =
    Boolean(copyPlan?.headline) ||
    Boolean(copyPlan?.subheadline) ||
    Boolean(copyPlan?.badge) ||
    Boolean(copyPlan?.priceLabel) ||
    Boolean(copyPlan?.priceValue) ||
    Boolean(copyPlan?.priceNote) ||
    Boolean(copyPlan?.cta) ||
    Boolean(copyPlan?.featureTags?.length) ||
    Boolean(copyPlan?.bullets?.length) ||
    Boolean(copyPlan?.comparisonRows?.length) ||
    Boolean(copyPlan?.comparisonTitle);

  if (!hasCopy) {
    return [];
  }

  return [
    "本次主路线不是无字底图，也不是先预留空白等后期再排版。",
    "请直接生成一张已经带有完整营销文案的电商成片，让商品、文字、留白、装饰在同一次生成里自然成立。",
    "文字必须像成熟电商海报原生排版的一部分，而不是后贴字幕或随意悬浮标签。",
    "文字数量要克制，优先做清晰的主标题、副标题、角标、价格或短卖点，不要扩写成长段说明。",
    "如果模型无法稳定渲染长中文，宁可缩短成更清晰的短句，也不要退回无字图。",
    "系统后续会做原位擦字和可编辑替换，所以优先保证当前成片完成度、层级感和原生排版美感。",
  ];
};

export const buildOldFlowPromptPolishLines = (): string[] => [
  "输出目标不是普通好看海报，而是可直接用于电商主图/详情页的专业商业成片。",
  "先锁定同一商品主体一致性，再把当前这张图的单一商业任务讲清楚，不要把整套信息塞进一张图。",
  "必须让卖点变成可见证据，而不是抽象口号；优先用结构、特写、参数、引线、对比、路径或动作结果来表达。",
  "请保证画面里主体区、标题区、卖点区、功能说明区的层级关系清楚，阅读路径一眼能懂。",
];
