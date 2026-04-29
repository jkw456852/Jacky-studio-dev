import { z } from 'zod';
import { imageGenSkill } from './image-gen.skill';
import { generateJsonResponse, getBestModelId } from '../gemini';
import type { Requirements, WorkflowUiMessage, ClothingAnalysis } from '../../types/workflow.types';
import type { ImageModel } from '../../types';
import { buildRequirementsText } from '../../utils/clothing-prompt';
import { AMAZON_SHOTS } from '../../knowledge/amazonShots';
import { ensureWhiteBackground } from '../image-postprocess';
import { validateModelIdentity, validateProductConsistency } from '../validators';

const requirementsSchema = z.object({
  platform: z.string().min(1),
  description: z.string().min(1),
  targetLanguage: z.string().min(1),
  aspectRatio: z.string().min(1),
  clarity: z.enum(['1K', '2K', '4K']).default('2K'),
  count: z.number().int().min(1).max(10),
  templateId: z.string().optional(),
  styleTags: z.array(z.string()).optional(),
  backgroundTags: z.array(z.string()).optional(),
  cameraTags: z.array(z.string()).optional(),
  focusTags: z.array(z.string()).optional(),
  extraText: z.string().optional(),
});

const requestSchema = z.object({
  productImages: z.array(z.string().url()).min(1).max(6),
  modelImage: z.string().url().optional(),
  modelAnchorSheetUrl: z.string().url().optional(),
  productAnchorUrl: z.string().url().optional(),
  analysis: z.any().optional(),
  requirements: requirementsSchema,
});

const NEGATIVE_PROMPT = `cartoon, illustration, anime, CGI, 3d render, doll-like, plastic skin, over-smoothed face, beauty filter, AI glow,
uncanny face, deformed hands, extra fingers, bad anatomy, warped proportions,
random patterns, wrong stitching, wrong neckline, wrong hem, wrong buttons, text, watermark, logo,
gradient background, gray background, textured backdrop, studio backdrop, props, furniture, room`;

function extractJsonObject(text: string): any {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return {};
      }
    }
    return {};
  }
}

const toPlanItems = async (requirements: Requirements, analysis?: ClothingAnalysis | null) => {
  const count = Math.max(1, Math.min(10, requirements.count || 6));
  const pType = analysis?.productType || 'unknown';
  const shotCandidates = AMAZON_SHOTS.filter((s) => s.when.includes(pType as any) || pType === 'unknown')
    .sort((a, b) => a.priority - b.priority)
    .slice(0, Math.max(count, 4));
  const shotMap = new Map(AMAZON_SHOTS.map((s) => [s.key, s]));

  const reqText = buildRequirementsText(requirements);
  const requirementsJson = JSON.stringify(requirements || {}, null, 2);
  const shotHints = [
    ...(analysis?.recommendedPoses || []),
    ...(analysis?.shotListHints || []),
  ].filter(Boolean).join(', ') || 'none';
  const isSet = analysis?.isSet ? 'yes' : 'no';

  const planSchema = z.object({
    items: z.array(z.object({
      label: z.string(),
      shotKey: z.string(),
      shotSpec: z.string().optional(),
      prompt: z.string().optional(),
      count: z.number().int().min(1).max(10).default(1),
    })).min(1),
  });

  const toFallbackItem = (idx: number) => {
    const shot = shotCandidates[idx % Math.max(shotCandidates.length, 1)] || AMAZON_SHOTS[0];
    const shotSpec = `${shot?.promptHint || 'full body front view'}; ${requirements.description}; ${reqText}`;
    return {
      label: shot?.name || `组图 ${idx + 1}`,
      shotKey: shot?.key || 'hero_full_front',
      shotSpec,
      prompt: shotSpec,
    };
  };

  const normalizePlan = (items: Array<{ label?: string; shotKey?: string; shotSpec?: string; prompt?: string; count?: number }>) => {
    const flattened: Array<{ label: string; shotKey: string; shotSpec: string; prompt: string }> = [];
    for (const item of items) {
      const shot = shotMap.get(String(item.shotKey || '').trim());
      if (!shot) continue;
      const repeats = Math.max(1, Math.min(10, Number(item.count || 1)));
      const shotSpec = String(item.shotSpec || item.prompt || shot.promptHint || '').trim();
      const prompt = shotSpec || shot.promptHint;
      for (let i = 0; i < repeats; i += 1) {
        flattened.push({
          label: String(item.label || shot.name || '').trim() || `组图 ${flattened.length + 1}`,
          shotKey: shot.key,
          shotSpec: prompt,
          prompt,
        });
      }
    }

    const ensured = flattened.slice(0, count);
    while (ensured.length < count) {
      ensured.push(toFallbackItem(ensured.length));
    }
    return ensured.map((item, idx) => ({ ...item, label: item.label || `组图 ${idx + 1}` }));
  };

  try {
    const planResult = await generateJsonResponse({
      model: getBestModelId('text'),
      operation: 'clothingStudio.plan',
      temperature: 0.3,
      parts: [{
        text: `你是资深电商服装摄影导演与分镜规划师。请基于产品分析结果与镜头知识库，生成一份“镜头计划 plan”。

输入：
- productType: ${analysis?.productType || 'unknown'}
- isSet: ${isSet}
- shotHints: ${shotHints}
- constraints:
  - background: pure white (#FFFFFF)
  - priority: emphasize garment realism & details, avoid occlusion
  - default: no accessories (bag/jewelry/hat), unless user explicitly requests
- requirements:
${requirementsJson}
- shotLibrary (amazonShots):
${JSON.stringify(shotCandidates)}

规则：
1) 必须从 shotLibrary 中挑选镜头（用 shotKey 标识），并可按需要重复某些镜头用于不同构图（如主图+更紧的3/4）。
2) 每个镜头都要写清楚“SHOT_SPEC”（姿势/构图/裁切范围/角度/不遮挡要求），用于后续生成 prompt。
3) 输出 items 总数量必须 = requirements.count（若未给 count，默认 6，且不超过 10）。
4) 优先顺序：Hero 主图（全身正面） > 背面 > 3/4 > 弹力/面料演示 > 细节特写。
5) 如果 productType=set（套装），优先使用稳定站姿与全身比例展示，避免扭转导致上下装错位。
6) 规划必须“商业感”：强调光感、质感、清晰细节，但不引入场景/道具。

输出 JSON（严格结构）：
{
  "items": [
    {
      "label": "用于UI展示的镜头名",
      "shotKey": "必须来自 shotLibrary.key",
      "shotSpec": "用于生成的具体镜头说明（英文更好）",
      "count": 1
    }
  ]
}`,
      }],
    });

    const parsedPlanJson = extractJsonObject(planResult.text || '');
    const parsed = planSchema.safeParse(parsedPlanJson);
    if (parsed.success) {
      return normalizePlan(parsed.data.items);
    }
  } catch {
  }

  return Array.from({ length: count }).map((_, idx) => toFallbackItem(idx));
};

function buildMaterialHints(materialGuess?: string[]): string {
  if (!materialGuess || materialGuess.length === 0) {
    return 'Show realistic fabric texture with proper weight and drape.';
  }
  
  const hints: string[] = [];
  const materialStr = materialGuess.join(' ').toLowerCase();
  
  if (/弹力|stretch|弹性|elastic/i.test(materialStr)) {
    hints.push('Show realistic stretch tension lines gently at waist/underarm without deformation.');
  }
  if (/针织|knit|针织衫|毛衣/i.test(materialStr)) {
    hints.push('Visible knit texture and scale consistency, soft fuzz, no plastic sheen.');
  }
  if (/缎面|satin|丝绸|silk|缎/i.test(materialStr)) {
    hints.push('Controlled specular highlights, smooth drape, no metallic look.');
  }
  if (/棉|cotton|纯棉/i.test(materialStr)) {
    hints.push('Natural cotton texture with subtle matte finish, soft wrinkles, no synthetic shine.');
  }
  if (/牛仔|denim|牛仔裤/i.test(materialStr)) {
    hints.push('Denim texture with visible twill lines, natural indigo fading, no plastic coating.');
  }
  if (/毛呢|wool|羊毛|大衣/i.test(materialStr)) {
    hints.push('Wool texture with soft nap, natural bulkiness, no synthetic smoothness.');
  }
  if (/雪纺| chiffon|薄纱/i.test(materialStr)) {
    hints.push('Sheer chiffon with delicate drape, lightweight flow, no stiff appearance.');
  }
  if (/皮革|leather|皮毛/i.test(materialStr)) {
    hints.push('Natural leather grain texture, subtle sheen, realistic wrinkles at stress points.');
  }
  
  if (hints.length === 0) {
    hints.push('Show realistic fabric texture with proper weight and drape.');
  }
  
  return hints.join(' ');
}

function buildForbiddenChanges(forbiddenChanges?: string[]): string {
  if (!forbiddenChanges || forbiddenChanges.length === 0) {
    return '- Do not change garment construction, color, or design elements';
  }
  return forbiddenChanges.map(f => `- ${f}`).join('\n');
}

export type ClothingStudioWorkflowResult = {
  ui: WorkflowUiMessage;
  images?: Array<{ url: string; label?: string }>;
  failedItems?: Array<{ index: number; prompt: string; label?: string }>;
};

export async function clothingStudioWorkflowSkill(params: {
  productImages: string[];
  modelImage?: string;
  preferredImageModel?: ImageModel;
  modelAnchorSheetUrl?: string;
  productAnchorUrl?: string;
  analysis?: ClothingAnalysis | null;
  requirements?: Requirements;
  retryFailedItems?: Array<{ index: number; prompt: string; label?: string }>;
  onProgress?: (done: number, total: number, text?: string) => void;
  signal?: AbortSignal;
}): Promise<ClothingStudioWorkflowResult> {
  const productImages = params.productImages || [];
  if (productImages.length < 1) {
    return { ui: { type: 'clothingStudio.product', productCount: 0, max: 6 } };
  }

  if (!params.modelAnchorSheetUrl && !params.modelImage) {
    return { ui: { type: 'clothingStudio.needModel' } };
  }

  if (!params.requirements) {
    return {
      ui: {
        type: 'clothingStudio.requirementsForm',
        defaults: {
          platform: 'taobao',
          description: '标准电商棚拍风格：主体清晰、颜色准确、背景干净，突出面料与版型细节。',
          targetLanguage: 'visual-only',
          aspectRatio: '3:4',
          clarity: '2K',
          count: 1,
          templateId: 'ecom_clean',
          styleTags: [],
          backgroundTags: [],
          cameraTags: [],
          focusTags: [],
          extraText: '',
        },
      },
    };
  }

  const parsed = requestSchema.parse({
    productImages,
    modelImage: params.modelImage,
    modelAnchorSheetUrl: params.modelAnchorSheetUrl,
    productAnchorUrl: params.productAnchorUrl,
    analysis: params.analysis,
    requirements: params.requirements,
  });

  const ratio = parsed.requirements.aspectRatio || '3:4';
  const clarity = parsed.requirements.clarity || '2K';
  const planItems = params.retryFailedItems && params.retryFailedItems.length > 0
    ? params.retryFailedItems
    : await toPlanItems(parsed.requirements as Requirements, parsed.analysis as ClothingAnalysis | null);

  const productAnchorUrl = parsed.productAnchorUrl || parsed.productImages[0];
  const modelAnchorUrl = parsed.modelAnchorSheetUrl || parsed.modelImage || '';
  
  const analysis = parsed.analysis;
  const materialHints = buildMaterialHints(analysis?.materialGuess);
  const forbiddenChanges = buildForbiddenChanges(analysis?.forbiddenChanges);
  const anchorDescription = analysis?.anchorDescription || 'Maintain garment construction details';

  const results: Array<{ url: string; label?: string }> = [];
  const failedItems: Array<{ index: number; prompt: string; label?: string }> = [];
  const total = planItems.length;

  for (let i = 0; i < total; i += 1) {
    if (params.signal?.aborted) {
      break;
    }

    const item: any = planItems[i];
    params.onProgress?.(i, total, `正在生成第 ${i + 1}/${total} 张：${item.label || ''}`);

    const shotSpec = item.shotSpec || item.prompt || '';
    
    const generationPrompt = `Use reference[0] as the ONLY MODEL identity anchor sheet (same person across all outputs).
Use reference[1] as the ONLY PRODUCT anchor (garment facts only).

CRITICAL: Do NOT copy the lighting, image quality, compression artifacts, styling, or aesthetics of reference[1].
Reference[1] is ONLY for garment construction and product details.

IDENTITY LOCK (must match reference[0]):
- Same face shape, eyes, nose, lips, hairstyle, hairline, skin tone, and body proportions.
- Natural human skin texture (pores, subtle imperfections). No plastic skin, no beauty filter, no "AI glow".
- No sunglasses, no jewelry, no hat, no bag, no extra accessories (unless explicitly requested in SHOT_SPEC).

PRODUCT LOCK (must match reference[1] exactly):
- Reproduce the garment construction EXACTLY as described:
  ${anchorDescription}
- Absolutely forbidden changes:
  ${forbiddenChanges}
- Keep neckline shape, armhole/sleeve cut, hem shape/length, seams/panels, stitching placement, button count/size/position (if any), fabric thickness, stretch behavior, sheen level, and color tone consistent.
- No invented design elements. No random patterns. No text or logos.

MATERIAL REALISM (must):
${materialHints}
- Preserve fine fabric texture and micro-contrast. Clean, sharp garment edges. Accurate color and neutral white balance.

HIGH-END COMMERCIAL STUDIO LOOK (photorealistic catalog):
- Full-frame camera look, 85mm lens, f/8, ISO 100, studio strobe.
- Lighting: large soft key + fill + subtle rim light; even exposure; controlled highlights; realistic specular response on fabric.
- Retouching: high-end catalog retouching (clean but realistic). Keep fabric texture; do not oversmooth skin.

BACKGROUND (strict):
- Pure solid white background #FFFFFF, seamless.
- No props, no room, no scenery, no gradients, no texture.
- Allow only a very soft, natural contact shadow under the feet (no gray background).

COMPOSITION:
- Centered, straight perspective, no wide-angle distortion.
- Do not crop head/hands/feet unless SHOT_SPEC explicitly requests a close-up.

SHOT_SPEC:
${shotSpec}`;

    const finalBasePrompt = `${generationPrompt}

AVOID:
${NEGATIVE_PROMPT}`;

    try {
      let passUrl: string | null = null;
      let finalPrompt = finalBasePrompt;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const url = await imageGenSkill({
          prompt: finalPrompt,
          model: params.preferredImageModel || 'Nano Banana Pro',
          aspectRatio: ratio,
          imageSize: clarity,
          referenceImages: [modelAnchorUrl, productAnchorUrl, ...parsed.productImages].filter(Boolean),
        });

        if (!url) continue;

        const whiteBgUrl = await ensureWhiteBackground(url);
        
        let identityCheck: any = { pass: true, reasons: [] };
        let productCheck: any = { pass: true, reasons: [] };
        
        try {
          identityCheck = await validateModelIdentity(modelAnchorUrl, whiteBgUrl);
        } catch (error) {
          console.warn('[validateModelIdentity] 人物一致性检查失败:', error);
          identityCheck = { pass: false, reasons: ['人物检查异常'], suggestedFix: '请重新上传清晰的模特参考图' };
        }
        
        try {
          productCheck = await validateProductConsistency(
            productAnchorUrl,
            whiteBgUrl,
            parsed.analysis?.anchorDescription || '保持服装结构与颜色一致',
            parsed.analysis?.forbiddenChanges || ['不要改变版型和颜色'],
          );
        } catch (error) {
          console.warn('[validateProductConsistency] 产品一致性检查失败:', error);
          productCheck = { pass: false, reasons: ['产品检查异常'], suggestedFix: '请确保上传的产品参考图清晰可见' };
        }

        if (identityCheck.pass && productCheck.pass) {
          passUrl = whiteBgUrl;
          break;
        }

        const fixes = [identityCheck.suggestedFix, productCheck.suggestedFix].filter(Boolean).join('; ');
        finalPrompt = `${finalPrompt}\nFix consistency issues: ${fixes}`;
      }

      if (!passUrl) {
        failedItems.push({ index: i, prompt: item.prompt, label: item.label });
      } else {
        results.push({ url: passUrl, label: item.label });
      }
    } catch {
      failedItems.push({ index: i, prompt: item.prompt, label: item.label });
    }
  }

  params.onProgress?.(total, total, '生成完成');

  return {
    ui: { type: 'clothingStudio.results', images: results },
    images: results,
    failedItems,
  };
}
