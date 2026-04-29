import type {
  EcommerceLayoutIntent,
  EcommercePlanItem,
  EcommerceRecommendedType,
} from "../types/workflow.types";

export type LegacyPromptProfileId =
  | "hero"
  | "white-bg"
  | "selling"
  | "comparison"
  | "detail"
  | "scene"
  | "spec"
  | "conversion";

export type LegacyPromptProfile = {
  label: string;
  businessRole: string;
  composition: string;
  background: string;
  lighting: string;
  material: string;
  avoid: string;
};

type LegacyPromptInferenceOptions = {
  groupTitle?: string;
  item?:
    | Pick<
        EcommercePlanItem,
        | "title"
        | "description"
        | "marketingGoal"
        | "keyMessage"
        | "layoutIntent"
      >
    | null
    | undefined;
  title?: string;
  description?: string;
  marketingGoal?: string;
  keyMessage?: string;
  imageRole?: string;
};

const normalizeText = (value: string | null | undefined): string =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const inferLegacyPromptProfile = (
  options: LegacyPromptInferenceOptions,
): LegacyPromptProfileId => {
  const {
    groupTitle,
    item,
    title,
    description,
    marketingGoal,
    keyMessage,
    imageRole,
  } = options;
  const resolvedImageRole = imageRole || item?.layoutIntent?.imageRole;
  switch (resolvedImageRole) {
    case "hero":
      return "hero";
    case "selling-point":
      return "selling";
    case "parameter":
    case "structure":
      return "spec";
    case "detail":
      return "detail";
    case "scene":
      return "scene";
    case "comparison":
      return "comparison";
    case "summary":
      return "conversion";
    default:
      break;
  }

  const seed = [
    groupTitle,
    item?.title,
    item?.description,
    item?.marketingGoal,
    item?.keyMessage,
    item?.layoutIntent?.imageRole,
    title,
    description,
    marketingGoal,
    keyMessage,
    imageRole,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/白底|white|标准商品|平台合规/.test(seed)) return "white-bg";
  if (/comparison|对比|差异|before|after/.test(seed)) return "comparison";
  if (/detail|特写|局部|细节|质地|材质/.test(seed)) return "detail";
  if (/scene|场景|使用|真人|生活方式|lifestyle/.test(seed)) return "scene";
  if (/parameter|spec|参数|尺寸|结构|说明|annotation|structure/.test(seed)) {
    return "spec";
  }
  if (/summary|收口|转化|cta|购买|下单|信任/.test(seed)) return "conversion";
  if (/selling|卖点|功效|优势|亮点/.test(seed)) return "selling";
  return "hero";
};

export const buildLegacyPromptProfile = (
  profile: LegacyPromptProfileId,
): LegacyPromptProfile => {
  switch (profile) {
    case "white-bg":
      return {
        label: "标准白底模板",
        businessRole:
          "承担平台标准展示与合规识别任务，优先把外观、颜色、比例、规格和主体轮廓讲清楚。",
        composition:
          "主体完整、比例统一、居中或标准商品位构图，边缘干净利落，留白稳定，不需要戏剧化视角。",
        background:
          "纯白或极浅白背景，不加入额外场景、情绪化道具或复杂叙事元素，整体像高质量平台标准图。",
        lighting:
          "中性、干净、柔和但清晰的棚拍光，保证颜色准确、边缘利落、阴影克制，不偏色、不发灰。",
        material:
          "材质呈现真实但克制，以轮廓、表面信息、结构识别为主，不追求花哨反光。",
        avoid:
          "不要写成种草氛围图、海报图或生活方式图，也不要加入影响审核和识别的背景元素。",
      };
    case "selling":
      return {
        label: "卖点承接模板",
        businessRole:
          "承担详情页卖点承接与转化说明任务，一张图只讲一个核心卖点，帮助用户快速理解购买理由。",
        composition:
          "商品主体仍是主角，但必须为当前卖点留出清晰说明区、模块区或辅助信息区，形成明确的详情页阅读结构。",
        background:
          "背景可以比主图更功能化，允许轻模块、色块或单一辅助元素，但只能围绕当前卖点服务，不能满屏堆信息。",
        lighting:
          "光线要稳定、清楚、偏解释型，既保住主体质感，也保证卖点相关局部、功能点和说明模块容易被看懂。",
        material:
          "如果卖点涉及材质、功效、工艺或结构，要把相关局部写具体，让材质和功能形成证据感，而不是空喊高级感。",
        avoid:
          "不要把所有卖点塞进一张图，也不要只写“突出卖点”，要明确这张图到底讲哪一个卖点。",
      };
    case "comparison":
      return {
        label: "差异对比模板",
        businessRole:
          "承担差异化价值说明任务，用一张图快速讲清这件商品为什么更值得买。",
        composition:
          "采用清晰的对比式或分区式构图，主商品必须稳居核心位置，对比信息围绕主商品展开，不做成杂乱信息海报。",
        background:
          "背景与版面简洁克制，适合承载对比信息，重点是清楚和决策效率，不依赖花哨场景吸睛。",
        lighting:
          "使用稳定清晰的说明型光线，确保主体外观、差异点和结构细节都容易辨认。",
        material:
          "如果差异点与材质、做工或结构有关，要把对应局部质感写具体，增强可信度。",
        avoid:
          "不要编造不存在的优势，不要让对比版式盖过商品主体，也不要把对比对象做得比主商品更抢眼。",
      };
    case "detail":
      return {
        label: "细节特写模板",
        businessRole:
          "承担品质感、做工感和证据展示任务，通过近景或微距特写建立信任感。",
        composition:
          "聚焦单个细节点位，主体局部可以放大，但仍要让人判断它属于这件商品，不能拍成脱离主体的抽象纹理。",
        background:
          "背景极简，必要时虚化处理，让视线全部落在细节本身，避免场景和装饰分散注意力。",
        lighting:
          "用受控高光、边缘光或近距离柔光，把纹理、切面、工艺层次、结构边界和微观反射打出来。",
        material:
          "明确写出局部材质表现，例如金属边缘、玻璃反射、磨砂颗粒、压纹、液体切面、塑料表层等。",
        avoid:
          "不要只写“细节特写、突出质感”，要明确放大哪个局部、怎么打光、要证明什么。",
      };
    case "scene":
      return {
        label: "使用场景模板",
        businessRole:
          "承担真实使用代入与场景可信度建立任务，让用户知道商品在什么语境中被使用。",
        composition:
          "主体与使用关系同框，但商品仍是主角；人物、手部、家具或空间只作辅助，不能淹没商品。",
        background:
          "用真实但克制的场景支撑代入感，避免做成普通生活照、随手场景照或纯氛围大片。",
        lighting:
          "光线可以更自然，但必须继续服务商品轮廓、品牌识别和关键结构清晰度，不可只剩氛围。",
        material:
          "即使在场景图里，也要保住主体材质、轮廓和结构识别，不让场景把商品质感冲掉。",
        avoid:
          "不要把它写成人物写真、杂志生活照或看背景的情绪图，场景只能服务商品。",
      };
    case "spec":
      return {
        label: "参数结构模板",
        businessRole:
          "承担参数、尺寸、结构或说明任务，重点是理性清楚、专业可信，不靠氛围感取胜。",
        composition:
          "采用理性展示、分栏、分区、引线或标注友好的构图，让模块边界清晰，方便后续承载说明信息。",
        background:
          "背景尽量纯净克制，避免复杂叙事和装饰干扰说明内容，整体更像专业商品说明图。",
        lighting:
          "使用稳定、清晰、说明型布光，让结构边界、材质纹理和参数承载区都容易辨认。",
        material:
          "把结构、材质和连接关系写得更具体，让参数和结构说明有真实感，而不是生硬贴图。",
        avoid:
          "不要写成普通主视觉图，也不要把版面做得像信息挤满的宣传海报。",
      };
    case "conversion":
      return {
        label: "收口转化模板",
        businessRole:
          "承担品质背书、信任建立和购买动机收束任务，让用户更容易完成最终决策。",
        composition:
          "主体突出且稳定，整体更收束、更完整，适合作为详情页后段或转化收口图。",
        background:
          "延续整套页面统一品牌色系或高级中性背景，避免跳脱成另一套视觉语言。",
        lighting:
          "在稳住质感的同时增强可信度和购买确定感，不做炫技式夸张光效。",
        material:
          "把整体品质感、包装完成度和关键材质稳定交代出来，让用户看到的是“靠谱、值、可买”。",
        avoid:
          "不要写成新的卖点图或情绪图，重点是收束和转化，不是再开新叙事。",
      };
    case "hero":
    default:
      return {
        label: "首屏主视觉模板",
        businessRole:
          "承担首图点击与第一印象建立任务，商品必须第一眼立住，优先建立品类、品牌与价值认知。",
        composition:
          "单一主焦点的商业主视觉构图，主体完整清晰，占据主要视觉重心，可用正面或 45 度角建立体积，保留适度留白。",
        background:
          "背景克制、干净、有品牌气质，可用柔和渐变、低干扰几何布景或轻场景线索，但只能衬托主体。",
        lighting:
          "使用商业主光加轮廓光，把体积、边缘和材质打出来，避免平、灰、平均照明。",
        material:
          "明确表现主体材质的真实反射、珠光、金属、玻璃、磨砂或塑料细节，让商品看起来贵、稳、可买。",
        avoid:
          "不要写成普通场景照、概念海报或空泛氛围图，也不要让道具、人物或背景抢走主体。",
      };
  }
};

export const buildLegacyPromptPrincipleLines = (
  profile: LegacyPromptProfileId,
): string[] => {
  switch (profile) {
    case "white-bg":
      return [
        "图型原理：白底图的本质是先完成识别和合规，再做少量品质提升，不能拿情绪感取代商品清楚。",
        "图型原理：主体比例、轮廓边缘、颜色准确和规格感优先级高于氛围、道具和场景故事。",
        "图型原理：如果需要少量文字，也只能做最克制的辅助说明，不能破坏平台标准图气质。",
      ];
    case "selling":
      return [
        "图型原理：卖点图必须先锁定单一卖点，再围绕这一个卖点做主体、文案、证据三点闭环。",
        "图型原理：画面既要像成片，也要像详情页模块，主体区和说明区必须天然分区，不靠后期硬拼。",
        "图型原理：卖点一定要有视觉证据承载，抽象优势必须落成结构、材料、路径、对比或结果。",
      ];
    case "comparison":
      return [
        "图型原理：对比图不是表格截图，而是先有强主商品，再用结构化差异证明为什么它更优。",
        "图型原理：对比关系要一眼可读，标准必须具体落在可见事实，而不是只给结论和口号。",
        "图型原理：信息区可以强，但商品仍要保持第一视觉主角，不允许被对比模块抢戏。",
      ];
    case "detail":
      return [
        "图型原理：细节图的关键是放大一个值得被信任的点，而不是泛泛表现“很精致”。",
        "图型原理：近景、微距、边缘高光、局部切面都要服务证据感，让用户明白这处细节为什么值钱。",
        "图型原理：即使是局部放大，也要保住与主体的归属关系，不能变成脱离商品的抽象纹理海报。",
      ];
    case "scene":
      return [
        "图型原理：场景图必须先解释使用关系，再输出氛围，场景永远是配角而不是主角。",
        "图型原理：人物、手部、空间和光线都只能用来证明商品在真实语境中怎么被使用、为什么更好。",
        "图型原理：场景中的留白要像画面自然长出来的一部分，方便文字原位替换而不显后贴。",
      ];
    case "spec":
      return [
        "图型原理：参数结构图必须像专业商品说明图一样清楚理性，同时保持电商成片的完成度。",
        "图型原理：主体边界、结构关系、引线落点和参数承载区都要天然可读，避免信息挤成一团。",
        "图型原理：这类图不是靠氛围取胜，而是靠秩序、可信度和解释效率取胜。",
      ];
    case "conversion":
      return [
        "图型原理：收口图负责把前面建立的卖点和质感收束成购买确定感，不再开新剧情。",
        "图型原理：整体应更完整、更稳、更可信，像详情页后段的压轴商业成片。",
        "图型原理：少量收束文案要和商品、包装、品质感一起成立，重点是让用户觉得靠谱和值得下单。",
      ];
    case "hero":
    default:
      return [
        "图型原理：首图任务是第一眼价值锤，必须先建立商品主体、价值感和成熟品牌完成度。",
        "图型原理：标题区、卖点区和主体轮廓要在同一次构图里自然成立，看起来像原生电商主图而不是后贴字。",
        "图型原理：背景、装饰、留白和灯光都只为抬主体服务，用户必须先看商品，再读标题，再读卖点。",
      ];
  }
};

export const buildLegacyPromptProfileLines = (
  profile: LegacyPromptProfileId,
): string[] => {
  const rule = buildLegacyPromptProfile(profile);
  return [
    `图型模板：${rule.label}。${rule.businessRole}`,
    `构图纪律：${rule.composition}`,
    `背景纪律：${rule.background}`,
    `光线纪律：${rule.lighting}`,
    `材质纪律：${rule.material}`,
    `避免事项：${rule.avoid}`,
  ];
};

export const buildLegacyPromptExecutionLines = (
  profile: LegacyPromptProfileId,
): string[] => {
  switch (profile) {
    case "white-bg":
      return [
        "白底图必须像平台可上架的高完成度标准商品图，不要带场景叙事，不要做海报感渐变或情绪灯光。",
        "主体要完整、端正、边缘干净，商品和留白的比例要稳定，让用户先看清外观、结构和规格感。",
        "文字如果存在，也只能做极少量辅助信息，不能抢走商品主体，更不能把白底图做成详情页说明海报。",
      ];
    case "selling":
      return [
        "卖点图只讲一个核心利益点，必须同时出现商品主体、卖点文案和卖点证据三件事，缺一不可。",
        "证据优先用结构透视、局部放大、路径示意、前后对照、功能动作结果或模块拆解来表达，不接受空泛形容词占满版面。",
        "版面要像成熟详情页模块：主体稳，说明区规整，阅读顺序清楚，不要做成贴满标签的杂乱促销海报。",
      ];
    case "scene":
      return [
        "场景图必须先像商品广告，再像生活场景；场景只是证明使用语境，不是主角。",
        "要让用户一眼看懂商品在什么动作、什么位置、解决什么问题，避免拍成普通抓拍、家居照或人物写真。",
        "文字区应顺着场景留白自然落位，商品、动作关系和文案形成一个完整商业画面，而不是后贴说明卡片。",
      ];
    case "comparison":
      return [
        "对比图必须先建立一个强主商品，再让对比信息围绕它展开，不能把画面做成信息表格截图。",
        "差异点要具体落在结构、材质、容量、效果或使用体验上，并且画面里能看到对应证据。",
        "对比区和标题区必须分层清楚，用户要在一眼内读懂“为什么它更好”。",
      ];
    case "detail":
      return [
        "细节图必须明确放大一个关键局部，并让人立刻知道这个局部属于整件商品，不要拍成抽象纹理素材。",
        "要用光线和镜头把工艺、切面、反射、压纹、边缘或连接关系打出来，让细节自己说服用户。",
        "文字只负责点题，不要用长文案掩盖其实没有拍出细节证据的问题。",
      ];
    case "spec":
      return [
        "参数结构图必须理性、清楚、专业，像高质量商品说明模块，而不是普通宣传海报。",
        "要给参数、引线、分区或结构说明留出稳定承载区，边界清楚，避免一坨信息堆在主体周围。",
        "如果讲尺寸、结构或部件关系，画面中必须能看到可对应的主体位置或结构证据。",
      ];
    case "conversion":
      return [
        "收口图的任务是让用户更容易下决策，所以画面要完整、稳定、可信，不再开启新的复杂叙事。",
        "商品主体、品质感、品牌气质和少量收束文案要形成最终成交感，而不是继续做功能说明页。",
        "让整张图看起来像详情页后段的压轴收口图，既稳又值，不花哨，不松散。",
      ];
    case "hero":
    default:
      return [
        "首图必须先交付点击感和第一眼价值感，让商品主体像真正的商业主视觉一样立在画面中央任务位上。",
        "文字不是后贴字幕，而要和主体轮廓、留白、背景布景一起形成原生版式，像成熟电商主图而不是宣传海报模板。",
        "背景、装饰和气氛只能抬主体，不能分走注意力；用户第一眼必须先看到商品，再看到标题，再看到卖点。",
      ];
  }
};

export const buildLegacyLayoutIntentDefaults = (
  profile: LegacyPromptProfileId,
): EcommerceLayoutIntent => {
  switch (profile) {
    case "white-bg":
      return {
        imageRole: "hero",
        layoutMode: "center-focus-with-edge-space",
        componentNeed: "text-only",
        reservedAreas: ["annotation"],
      };
    case "selling":
      return {
        imageRole: "selling-point",
        layoutMode: "split-info",
        componentNeed: "text-and-icons",
        reservedAreas: ["headline", "body", "annotation"],
      };
    case "comparison":
      return {
        imageRole: "comparison",
        layoutMode: "split-info",
        componentNeed: "comparison-heavy",
        reservedAreas: ["headline", "comparison", "annotation"],
      };
    case "detail":
      return {
        imageRole: "detail",
        layoutMode: "right-copy",
        componentNeed: "annotation-heavy",
        reservedAreas: ["headline", "annotation"],
      };
    case "scene":
      return {
        imageRole: "scene",
        layoutMode: "left-copy",
        componentNeed: "text-and-icons",
        reservedAreas: ["headline", "body"],
      };
    case "spec":
      return {
        imageRole: "parameter",
        layoutMode: "split-info",
        componentNeed: "annotation-heavy",
        reservedAreas: ["stats", "body", "annotation"],
      };
    case "conversion":
      return {
        imageRole: "summary",
        layoutMode: "center-focus-with-edge-space",
        componentNeed: "text-and-icons",
        reservedAreas: ["headline", "body", "annotation"],
      };
    case "hero":
    default:
      return {
        imageRole: "hero",
        layoutMode: "center-focus-with-edge-space",
        componentNeed: "text-and-icons",
        reservedAreas: ["headline", "subheadline", "annotation"],
      };
  }
};

export const buildLegacyTypeTemplateLibraryBlock = (options: {
  selectedTypes?: Array<
    Pick<EcommerceRecommendedType, "id" | "title" | "imageCount">
  >;
}): string => {
  const selectedTypes = (options.selectedTypes || []).filter((item) =>
    Boolean(String(item?.title || item?.id || "").trim()),
  );
  if (selectedTypes.length === 0) {
    return "";
  }

  const lines = selectedTypes.slice(0, 8).flatMap((item, index) => {
    const profile = inferLegacyPromptProfile({
      groupTitle: item.title,
      title: item.title,
      description: item.id,
    });
    const profileConfig = buildLegacyPromptProfile(profile);
    const principleLines = buildLegacyPromptPrincipleLines(profile).slice(0, 2);
    const layoutIntent = buildLegacyLayoutIntentDefaults(profile);

    return [
      `${index + 1}. 图型「${item.title}」优先调用 ${profileConfig.label}。`,
      `职责归位：${profileConfig.businessRole}`,
      ...principleLines,
      `默认版式倾向：${layoutIntent.layoutMode || "center-focus-with-edge-space"} / ${layoutIntent.componentNeed || "text-and-icons"}`,
    ];
  });

  return ["老流程图型级模板库：", ...lines].join("\n");
};
