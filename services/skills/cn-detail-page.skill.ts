import { z } from 'zod';
import { analyzeListingProductSkill, type ListingProductAnalysis } from './analyze-listing-product.skill';
import { imageGenSkill } from './image-gen.skill';

const schema = z.object({
  productImages: z.array(z.string()).min(1).max(6),
  brief: z.string().optional(),
  analysis: z.any().optional(),
  shots: z.array(z.any()).optional(),
  count: z.number().int().min(1).max(8).optional(),
  aspectRatio: z.string().optional(),
  imageSize: z.enum(['1K', '2K', '4K']).optional(),
  model: z.string().optional(),
  promptVersion: z.enum(['original', 'new']).optional(),
  textMode: z.enum(['auto', 'withText', 'noText']).optional(),
  ratioMode: z.enum(['adaptive', 'fixed']).optional(),
  fixedAspectRatio: z.string().optional(),
  qualityThreshold: z.number().min(0).max(1).optional(),
  replacementBudget: z.number().int().min(0).max(4).optional(),
  retryPolicy: z.object({
    maxRetriesPerShot: z.number().int().min(1).max(6).optional(),
    tiers: z.array(z.object({
      maxRetries: z.number().int().min(0).max(4).optional(),
      densityScale: z.number().min(0.3).max(1).optional(),
    })).optional(),
  }).optional(),
});

type PromptVersion = 'original' | 'new';
type TextMode = 'auto' | 'withText' | 'noText';
type RatioMode = 'adaptive' | 'fixed';

type RetryTier = { maxRetries: number; densityScale: number };

type ShotImage = { url: string; title: string; shotId?: string };

type AttemptStat = {
  shotId: string;
  title: string;
  attempts: number;
  usedPromptVersion: PromptVersion;
  usedFallbackToOriginal: boolean;
  aspectRatio: string;
};

type QualityScore = {
  shotId: string;
  title: string;
  score: number;
};

export type CnDetailPageResult = {
  images: ShotImage[];
  remainingShots?: any[];
  attemptStats?: AttemptStat[];
  qualityScores?: QualityScore[];
};

const NEGATIVE = [
  'low resolution',
  'blurry',
  'watermark',
  'logo overlay',
  'QR code',
  'mosaic',
  'collage',
  'split-screen',
  'deformed',
  'bad anatomy',
  'extra fingers',
  'garbled text',
  'illegible text',
].join(', ');

const DEFAULT_RETRY_TIERS: RetryTier[] = [
  { maxRetries: 1, densityScale: 1 },
  { maxRetries: 1, densityScale: 0.8 },
  { maxRetries: 1, densityScale: 0.65 },
];

const normalizeAnalysis = (input: any): ListingProductAnalysis => {
  const a = (input || {}) as Partial<ListingProductAnalysis>;
  return {
    category: String(a.category || 'unknown'),
    productNameGuess: String(a.productNameGuess || ''),
    targetAudience: String(a.targetAudience || ''),
    useScenarios: Array.isArray(a.useScenarios) ? a.useScenarios.map((x) => String(x)).filter(Boolean).slice(0, 8) : [],
    priceTier: (a.priceTier === 'budget' || a.priceTier === 'mid' || a.priceTier === 'premium') ? a.priceTier : 'mid',
    keySpecs: Array.isArray(a.keySpecs) ? a.keySpecs.map((x) => String(x)).filter(Boolean).slice(0, 12) : [],
    differentiators: Array.isArray(a.differentiators) ? a.differentiators.map((x) => String(x)).filter(Boolean).slice(0, 12) : [],
    objections: Array.isArray(a.objections) ? a.objections.map((x) => String(x)).filter(Boolean).slice(0, 12) : [],
    recommendedLayoutApproach: String(a.recommendedLayoutApproach || ''),
    recommendedShotPlan: Array.isArray(a.recommendedShotPlan) ? (a.recommendedShotPlan as any[]) : [],
    assumptions: Array.isArray(a.assumptions) ? a.assumptions.map((x) => String(x)).filter(Boolean).slice(0, 12) : [],
  };
};

const buildCnDetailPromptOriginal = (analysis: ListingProductAnalysis, shot: any, brief: string): string => {
  return `【原版】你是国内电商详情页视觉总监，请输出高转化中文电商详情页单屏视觉。

产品分析上下文：
- 类目：${analysis.category}
- 核心差异点：${(analysis.differentiators || []).slice(0, 5).join('；') || '按产品图提炼'}
- 用户顾虑：${(analysis.objections || []).slice(0, 5).join('；') || '按常见顾虑处理'}

当前分屏目标：
- 模块：${shot.shotId}
- 标题：${shot.title}
- 营销目标：${shot.marketingGoal}
- 关键信息：${shot.keyMessage}

必须体现：
- ${(shot.mustShow || []).join('\n- ')}

构图要求：${shot.composition}
视觉风格：${shot.styling}
背景要求：${shot.background}

用户补充要求：${brief || '无'}

输出要求：
- 单屏画面，不要拼贴，不要多宫格
- 画面可用于中文详情页，仅预留中文文案安全区
- 严禁在图中渲染任何可见文字（包括中文、英文、数字、logo、水印、二维码）
- 必须严格保持与参考图同一商品：外观、结构、颜色、材质、关键细节不可更改
- 不得凭空新增或删减核心部件，不得替换为其他款式

Negative prompt: ${NEGATIVE}`;
};

const buildCnDetailPromptNew = (analysis: ListingProductAnalysis, shot: any, brief: string): string => {
  return `你是一名资深电商视觉总监、工业产品CG分镜策划师、AI生图提示词架构专家。

执行模式（重要）：
- 系统会按模块连续调用你多次，最终生成一套详情页多张单图。
- 你本次只需要生成“当前模块”的1张单图。
- 直接输出图片，不要输出解释、分析、JSON或Markdown文本。

你的任务：
根据用户提供的产品白底图、产品图组、产品名称、卖点信息或简短需求，生成一张适用于电商详情页的高质量中文视觉分屏图。
输出目标不是普通海报，而是可用于详情页落地的专业视觉脚本对应成图。

--------------------------------
一、核心原则
--------------------------------
1. 产品一致性优先级最高：
- 必须严格围绕输入产品生成，不得随意改动产品外观。
- 在当前模块中，产品外轮廓、比例、主色、材质、结构、按钮、接口、透明件、附件、底座、屏幕、摄像头、轮子、手柄、喷嘴、盖板、边缘形态等关键视觉特征保持一致。
- 若输入仅有单角度白底图，也要确保“产品外观绝对统一，不得改款，不得变形，不得重新设计”。

2. 电商详情页逻辑：
- 当前单图必须具备清晰信息层级：标题区、卖点区、功能示意区、结构展示区的布局关系清晰。
- 适配详情页分屏阅读，不做纯艺术化表达。

3. 卖点画面化：
- 抽象卖点必须转为可视元素：结构透视、爆炸图、剖面图、材质特写、发光能量流、水流/风流/热流示意、点云扫描、场景交互、参数信息UI、图标环绕、组件引线、before/after、人体工学演示、渗透路径、纤维放大、空气循环、烹饪状态等。

4. 商业可用性：
- 商业广告级、电商可落地。
- 主视觉冲击力与信息表达效率并重。
- 与整套图保持统一色彩、光影、材质、镜头语言和UI风格。
- 考虑后期替换文案与设计落地。

5. 负面限制：
- 禁止产品变形、改款、无关配件乱入、品牌标识错误、结构错误、材质错误、低清晰度、风格漂移、场景杂乱、卡通化、玩具化、夸张概念化、非本品类错误功能联想。

--------------------------------
二、输入理解（按本次模块执行）
--------------------------------
- 产品品类：${analysis.category || '未知品类'}
- 当前模块：${shot?.shotId || '未命名'} / ${shot?.title || '未命名模块'}
- 当前模块营销目标：${shot?.marketingGoal || '提升转化'}
- 当前模块关键信息：${shot?.keyMessage || '突出核心卖点'}
- 本模块必须体现：${(shot.mustShow || []).join('；') || '保持与商品图一致并突出关键卖点'}
- 构图要求：${shot?.composition || '主体突出、边界清晰、阅读路径明确'}
- 视觉风格：${shot?.styling || '商业广告级、真实材质、高质感'}
- 背景要求：${shot?.background || '简洁背景，突出主体'}
- 用户补充要求：${brief || '无'}

--------------------------------
三、模块与镜头规则（本次单图）
--------------------------------
- 给当前模块配置明确镜头感：主视觉大特写 / 半透视结构镜头 / 爆炸图镜头 / 微观放大镜头 / 使用场景镜头 / 参数信息镜头（选择最匹配本模块的一种或组合）。
- 每个卖点必须有视觉符号：
  - 智能类：扫描线、点云、HUD、数据流、芯片、电路
  - 清洁类：风流、水流、污渍分离、纤维卷入、气旋路径
  - 护肤类：水滴、精华流动、皮肤剖面、成分渗透
  - 食品类：原料、颗粒、蒸汽、液体挂壁、切面、冲泡轨迹
  - 服饰类：面料纹理、车线、垂坠感、人体动态、搭配环境
  - 家居类：收纳分层、空间比例、生活方式场景、材质近景

--------------------------------
四、版式与构图规则
--------------------------------
- 优先画幅：3:4 / 4:5 / 9:16（本次按系统参数执行）。
- 阅读路径明确：从上到下 / 从左到右 / 中轴 / 卡片分区（选一种清晰执行）。
- 构图控制：主体突出、模块边界清晰、重点卖点放大、背景不喧宾夺主、视觉重心稳定、产品尺度一致。

--------------------------------
五、文字与排版规则
--------------------------------
- 允许生成少量清晰可读中文标题/短标签/参数短句；不要密集长段文案。
- 文案层级：主标题 > 副标题 > 标签 > 参数卡片 > 引线标注。
- 排版要求：横排为主、统一对齐、避免过密过小，禁止乱码。
- 如模型对复杂文字不稳定，可保留清晰文案占位并保证版式可替换。

--------------------------------
六、色彩与材质规则
--------------------------------
- 风格方向依据品类自动匹配：高端科技/极简轻奢/医研实验室/自然纯净/母婴柔和/户外硬核/厨电品质/时尚质感/专业工业/新中产家居。
- 色彩必须给出主色、辅色、点缀色、背景色、光影倾向并保持模块统一。
- 材质必须真实：外壳材质、透明件、金属件、表面工艺、反光/漫反射、接触面质感、微观纹理、阴影与反射逻辑。

--------------------------------
七、信息不足时策略
--------------------------------
- 不虚构高风险专属结构。
- 采用稳健型详情页表达：真实、统一、可落地优先。
- 可用“示意化展示/概念化功能可视层/不改变原结构前提下”的方式表达。

--------------------------------
八、最终执行要求
--------------------------------
- 先锁定产品一致性
- 再落实本模块镜头与卖点可视化
- 再补充版式、文字层级、色彩材质、负面约束
- 最终直接输出当前模块成图（单图）

Negative prompt: ${NEGATIVE}`;
};

const buildCnDetailPrompt = (
  analysis: ListingProductAnalysis,
  shot: any,
  brief: string,
  promptVersion: PromptVersion,
): string => {
  return promptVersion === 'new'
    ? buildCnDetailPromptNew(analysis, shot, brief)
    : buildCnDetailPromptOriginal(analysis, shot, brief);
};

const fallbackPlan = [
  {
    shotId: 'kv',
    title: '首屏KV',
    marketingGoal: '快速建立认知与吸引点击',
    keyMessage: '品牌主张与产品核心价值一眼可见',
    mustShow: ['完整产品主体', '品牌调性', '可放置中文标题的安全区'],
    composition: '主体居中或黄金分割，保留上方/侧边文案区域',
    styling: '高质感商业摄影，干净光线，明确视觉层级',
    background: '简洁高级背景，突出主体',
  },
  {
    shotId: 'selling-point',
    title: '核心卖点',
    marketingGoal: '强调购买理由',
    keyMessage: '把最强卖点视觉化',
    mustShow: ['核心功能细节', '对用户收益的暗示', '可叠加图标/短句的留白'],
    composition: '局部特写+主体结合，信息导向明确',
    styling: '细节锐利，强调材质与工艺',
    background: '浅色或中性背景便于后期排版',
  },
  {
    shotId: 'spec',
    title: '参数材质',
    marketingGoal: '降低决策不确定性',
    keyMessage: '尺寸/材质/结构可信可感知',
    mustShow: ['关键部位结构', '材质纹理', '尺寸对比参考感'],
    composition: '理性展示构图，方便后期加参数标注',
    styling: '电商信息化视觉，简洁清晰',
    background: '纯净背景，强调可读性',
  },
  {
    shotId: 'scenario',
    title: '使用场景',
    marketingGoal: '建立代入感',
    keyMessage: '在真实场景中体现价值',
    mustShow: ['产品在真实使用状态', '用户/手部或环境互动', '场景可信'],
    composition: '生活方式构图，产品仍是视觉中心',
    styling: '自然光或柔和商业布光，真实不过度夸张',
    background: '贴合目标人群的生活场景',
  },
  {
    shotId: 'comparison',
    title: '对比优势',
    marketingGoal: '强化差异化',
    keyMessage: '让用户看见“为什么选你”',
    mustShow: ['产品优势特征', '对比逻辑可视化空间', '清晰层次'],
    composition: '对比叙事构图，主体优势更突出',
    styling: '干净有力，强调可信与专业',
    background: '简洁背景，避免干扰对比信息',
  },
  {
    shotId: 'conversion',
    title: '收尾转化',
    marketingGoal: '推动下单决策',
    keyMessage: '信任背书 + 购买动机收口',
    mustShow: ['产品最终形象', '品质感', '可放置行动引导文案区域'],
    composition: '强收口构图，主体突出且稳定',
    styling: '品牌统一、质感收束、适合作为详情页结尾',
    background: '统一品牌色系或高级中性背景',
  },
];

const normalizeRetryTiers = (raw: any): RetryTier[] => {
  const tiers = Array.isArray(raw) ? raw : [];
  if (tiers.length === 0) return DEFAULT_RETRY_TIERS;
  return tiers
    .map((tier: any) => ({
      maxRetries: Math.max(0, Math.min(4, Number(tier?.maxRetries ?? 1))),
      densityScale: Math.max(0.3, Math.min(1, Number(tier?.densityScale ?? 1))),
    }))
    .filter((tier) => Number.isFinite(tier.maxRetries) && Number.isFinite(tier.densityScale));
};

const classifyViewpoint = (shot: any): string => {
  const seed = `${shot?.shotId || ''} ${shot?.title || ''} ${shot?.composition || ''}`.toLowerCase();
  if (/kv|hero|首屏/.test(seed)) return 'hero';
  if (/spec|参数|结构/.test(seed)) return 'spec';
  if (/scenario|场景|使用/.test(seed)) return 'scenario';
  if (/comparison|对比/.test(seed)) return 'comparison';
  if (/selling|卖点|detail|特写/.test(seed)) return 'detail';
  if (/conversion|收尾|结尾/.test(seed)) return 'closure';
  return 'generic';
};

const dedupeShots = (shots: any[]): any[] => {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const shot of shots) {
    const key = String(shot?.shotId || '').trim() || String(shot?.title || '').trim();
    if (!key) {
      out.push(shot);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(shot);
  }
  return out;
};

const diversifyShots = (shots: any[], count: number): any[] => {
  const picked: any[] = [];
  const usedViewpoints = new Set<string>();
  const pool = [...shots];
  while (picked.length < count && pool.length > 0) {
    const idx = pool.findIndex((shot) => !usedViewpoints.has(classifyViewpoint(shot)));
    const targetIndex = idx >= 0 ? idx : 0;
    const [shot] = pool.splice(targetIndex, 1);
    picked.push(shot);
    usedViewpoints.add(classifyViewpoint(shot));
  }
  return picked;
};

const getAspectRatioForShot = (
  shot: any,
  baseAspectRatio: string,
  ratioMode: RatioMode,
  fixedAspectRatio: string,
): string => {
  if (ratioMode === 'fixed' && fixedAspectRatio) return fixedAspectRatio;
  const seed = `${shot?.shotId || ''} ${shot?.title || ''}`.toLowerCase();
  if (/spec|comparison|参数|对比/.test(seed)) return '4:3';
  if (/detail|selling|卖点|特写/.test(seed)) return '1:1';
  if (/scenario|场景/.test(seed)) return '3:4';
  if (/kv|hero|首屏/.test(seed)) return '3:4';
  return baseAspectRatio;
};

const applyDensityScale = (prompt: string, densityScale: number): string => {
  if (densityScale >= 0.95) return prompt;
  const lines = prompt.split('\n').filter((line) => line.trim().length > 0);
  const keep = Math.max(18, Math.floor(lines.length * densityScale));
  return lines.slice(0, keep).join('\n');
};

const applyTextModeRules = (prompt: string, textMode: TextMode): string => {
  if (textMode === 'withText') {
    return `${prompt}\n\n文字策略：允许少量清晰可读中文标题/短标签，禁止长段堆字，保持可替换排版安全区。`;
  }
  if (textMode === 'noText') {
    return `${prompt}\n\n文字策略：禁止任何可见文字（中文、英文、数字、logo、水印、二维码）。`;
  }
  return `${prompt}\n\n文字策略：可少量清晰中文短句，避免乱码与密集长文。`;
};

const buildShotPrompt = (
  analysis: ListingProductAnalysis,
  shot: any,
  brief: string,
  promptVersion: PromptVersion,
  textMode: TextMode,
  densityScale: number,
): string => {
  const base = buildCnDetailPrompt(analysis, shot, brief, promptVersion);
  return applyTextModeRules(applyDensityScale(base, densityScale), textMode);
};

const scoreOutput = (
  shot: any,
  url: string,
  viewpoint: string,
  usedViewpoints: Set<string>,
): number => {
  if (!url || typeof url !== 'string') return 0;
  let score = 0.45;
  if ((shot?.title || '').length > 1) score += 0.1;
  if ((shot?.mustShow || []).length > 0) score += 0.15;
  if (!usedViewpoints.has(viewpoint)) score += 0.2;
  if (viewpoint !== 'generic') score += 0.1;
  return Math.max(0, Math.min(1, score));
};

export async function cnDetailPageSkill(raw: unknown): Promise<CnDetailPageResult> {
  const params = schema.parse(raw);
  const productImages = params.productImages.slice(0, 6);
  const brief = String(params.brief || '').trim();
  const count = Math.max(1, Math.min(8, Number(params.count ?? 6)));
  const aspectRatio = String(params.aspectRatio || '3:4');
  const imageSize = (params.imageSize || '2K') as '1K' | '2K' | '4K';
  const model = String(params.model || 'nanobanana2');
  const promptVersion: PromptVersion = params.promptVersion === 'original' ? 'original' : 'new';
  const textMode: TextMode = params.textMode || 'auto';
  const ratioMode: RatioMode = params.ratioMode === 'fixed' ? 'fixed' : 'adaptive';
  const fixedAspectRatio = String(params.fixedAspectRatio || '').trim();
  const qualityThreshold = Math.max(0, Math.min(1, Number(params.qualityThreshold ?? 0.68)));
  const replacementBudget = Math.max(0, Math.min(4, Number(params.replacementBudget ?? 2)));
  const retryTiers = normalizeRetryTiers(params.retryPolicy?.tiers);
  const maxRetriesPerShot = Math.max(1, Math.min(6, Number(params.retryPolicy?.maxRetriesPerShot ?? 3)));

  let analysis: ListingProductAnalysis;
  if (params.analysis) {
    analysis = normalizeAnalysis(params.analysis);
  } else {
    try {
      analysis = normalizeAnalysis(
        await analyzeListingProductSkill({
          productImages,
          brief,
          platform: 'cn',
        }),
      );
    } catch (e) {
      console.warn('[cnDetailPageSkill] analyzeListingProduct failed, using fallback plan', e);
      analysis = normalizeAnalysis({ category: 'unknown', recommendedShotPlan: [] });
    }
  }

  const overrideShots = Array.isArray(params.shots) ? params.shots : [];
  const shotPoolBase = overrideShots.length > 0
    ? overrideShots
    : (Array.isArray(analysis.recommendedShotPlan) && analysis.recommendedShotPlan.length > 0
      ? analysis.recommendedShotPlan
      : fallbackPlan);

  const dedupedPool = dedupeShots(shotPoolBase);
  const shotPool = diversifyShots(dedupedPool, count);

  const images: ShotImage[] = [];
  const producedShotIds = new Set<string>();
  const usedViewpoints = new Set<string>();
  const attemptStats: AttemptStat[] = [];
  const qualityScores: QualityScore[] = [];

  let remainingReplacementBudget = replacementBudget;

  for (let i = 0; i < shotPool.length; i += 1) {
    const shot = shotPool[i];
    const shotId = typeof shot?.shotId === 'string' ? shot.shotId : `shot-${i + 1}`;
    const shotTitle = shot?.title || `详情页第 ${i + 1} 屏`;
    const shotAspectRatio = getAspectRatioForShot(shot, aspectRatio, ratioMode, fixedAspectRatio);

    let attempts = 0;
    let usedPromptVersion: PromptVersion = promptVersion;
    let usedFallbackToOriginal = false;
    let bestUrl = '';

    const tryGenerate = async (version: PromptVersion): Promise<string> => {
      usedPromptVersion = version;
      for (const tier of retryTiers) {
        for (let retry = 0; retry <= tier.maxRetries; retry += 1) {
          if (attempts >= maxRetriesPerShot) return '';
          attempts += 1;

          const prompt = buildShotPrompt(
            analysis,
            shot,
            brief,
            version,
            textMode,
            tier.densityScale,
          );

          const url = await imageGenSkill({
            prompt,
            model,
            aspectRatio: shotAspectRatio,
            imageSize,
            referenceImages: productImages,
            referenceMode: 'product',
            referencePriority: productImages.length > 1 ? 'all' : 'first',
            referenceStrength: 0.9,
            textPolicy: textMode === 'withText'
              ? { enforceChinese: true }
              : undefined,
          });

          if (url && typeof url === 'string') return url;
        }
      }
      return '';
    };

    bestUrl = await tryGenerate(promptVersion);

    if (!bestUrl && promptVersion === 'new') {
      usedFallbackToOriginal = true;
      bestUrl = await tryGenerate('original');
    }

    if (!bestUrl) {
      attemptStats.push({
        shotId,
        title: shotTitle,
        attempts,
        usedPromptVersion,
        usedFallbackToOriginal,
        aspectRatio: shotAspectRatio,
      });
      continue;
    }

    const viewpoint = classifyViewpoint(shot);
    let score = scoreOutput(shot, bestUrl, viewpoint, usedViewpoints);

    if (score < qualityThreshold && remainingReplacementBudget > 0) {
      remainingReplacementBudget -= 1;
      const replacementUrl = await tryGenerate(promptVersion === 'new' ? 'new' : 'original');
      if (replacementUrl) {
        bestUrl = replacementUrl;
        score = Math.max(score, scoreOutput(shot, bestUrl, viewpoint, usedViewpoints));
      }
    }

    qualityScores.push({ shotId, title: shotTitle, score });

    if (shotId) producedShotIds.add(shotId);
    usedViewpoints.add(viewpoint);

    images.push({
      url: bestUrl,
      title: shotTitle,
      shotId,
    });

    attemptStats.push({
      shotId,
      title: shotTitle,
      attempts,
      usedPromptVersion,
      usedFallbackToOriginal,
      aspectRatio: shotAspectRatio,
    });
  }

  const remainingShots = shotPool.filter((s: any, idx: number) => {
    const sid = typeof s?.shotId === 'string' ? s.shotId : `shot-${idx + 1}`;
    return !producedShotIds.has(sid);
  });

  return {
    images,
    remainingShots: remainingShots.length > 0 ? remainingShots : undefined,
    attemptStats,
    qualityScores,
  };
}
