import {
  editImage,
  refineImagePrompt,
  validateTransparentCutoutResult,
} from '../gemini';
import { generateImageWithProvider } from '../providers';
import { normalizeReferenceToDataUrl } from '../image-reference-resolver.ts';

type SmartEditType =
  | 'background-remove'
  | 'object-remove'
  | 'upscale'
  | 'style-transfer'
  | 'extend';

const resolveSourceAspectRatio = async (
  sourceUrl: string,
): Promise<string | undefined> => {
  try {
    if (typeof document === 'undefined') return undefined;
    const dataUrl = await normalizeReferenceToDataUrl(sourceUrl);
    if (!dataUrl) return undefined;
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });
    if (!img.naturalWidth || !img.naturalHeight) return undefined;
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const d = gcd(img.naturalWidth, img.naturalHeight);
    const w = img.naturalWidth / d;
    const h = img.naturalHeight / d;
    if (w > 10 || h > 10) {
      const r = img.naturalWidth / img.naturalHeight;
      if (Math.abs(r - 16 / 9) < 0.05) return '16:9';
      if (Math.abs(r - 9 / 16) < 0.05) return '9:16';
      if (Math.abs(r - 4 / 3) < 0.05) return '4:3';
      if (Math.abs(r - 3 / 4) < 0.05) return '3:4';
      if (Math.abs(r - 3 / 2) < 0.05) return '3:2';
      if (Math.abs(r - 2 / 3) < 0.05) return '2:3';
      return undefined;
    }
    return `${w}:${h}`;
  } catch {
    return undefined;
  }
};

export interface SmartEditParams {
  sourceUrl?: string;
  editType?: SmartEditType;
  maskImage?: string;
  aspectRatio?: string;
  signal?: AbortSignal;
  parameters?: Record<string, any>;
}

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const pickFirstNonEmptyString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const normalized = value.trim();
    if (normalized) return normalized;
  }
  return undefined;
};

const pickFirstNonEmptyStringArray = (...values: unknown[]): string[] | undefined => {
  for (const value of values) {
    if (Array.isArray(value)) {
      const normalized = value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);
      if (normalized.length > 0) return normalized;
      continue;
    }
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized) return [normalized];
    }
  }
  return undefined;
};

const collectIntentText = (...values: unknown[]): string =>
  values
    .flatMap((value) => {
      if (typeof value === 'string') return [value];
      if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string');
      }
      return [];
    })
    .map((value) => value.trim())
    .filter(Boolean)
    .join('\n')
    .toLowerCase();

const looksLikeBackgroundRemoveIntent = (text: string): boolean => {
  if (!text) return false;
  return (
    text.includes('background-remove') ||
    text.includes('remove background') ||
    text.includes('remove the background') ||
    text.includes('transparent background') ||
    text.includes('transparent png') ||
    text.includes('png with transparency') ||
    text.includes('cutout') ||
    text.includes('knockout') ||
    /(?:^|[^a-z])bg\s*remove(?:[^a-z]|$)/.test(text) ||
    /(?:^|[^a-z])rm\s*bg(?:[^a-z]|$)/.test(text) ||
    text.includes('\u62a0\u56fe') ||
    text.includes('\u53bb\u80cc\u666f') ||
    text.includes('\u900f\u660e\u80cc\u666f') ||
    text.includes('\u900f\u660epng')
  );
};

const looksLikeStyleTransferIntent = (text: string): boolean => {
  if (!text) return false;
  return (
    text.includes('style-transfer') ||
    text.includes('style transfer') ||
    text.includes('restyle') ||
    text.includes('change style') ||
    text.includes('apply style') ||
    text.includes('\u98ce\u683c\u8f6c\u6362') ||
    text.includes('\u6362\u98ce\u683c') ||
    text.includes('\u6539\u98ce\u683c')
  );
};

const looksLikeMetaPrompt = (prompt: string): boolean => {
  const normalized = prompt.toLowerCase();
  return (
    normalized.includes('meta prompt') ||
    normalized.includes('prompt framework') ||
    normalized.includes('rewrite the prompt') ||
    normalized.includes('optimize the prompt') ||
    (prompt.includes('```') && prompt.length > 120)
  );
};

const normalizeGenerationImageSize = (
  value: string | undefined,
): '1K' | '2K' | '4K' | undefined => {
  if (value === '1K' || value === '2K' || value === '4K') {
    return value;
  }
  return undefined;
};

const resolveSmartEditModelId = (model: string | undefined): string | undefined => {
  const normalized = String(model || '').trim();
  if (!normalized) return undefined;

  if (normalized === 'Nano Banana Pro' || normalized === 'gemini-3-pro-image-preview') {
    return 'gemini-3-pro-image-preview';
  }
  if (
    normalized === 'NanoBanana2' ||
    normalized === 'Nano Banana 2' ||
    normalized === 'gemini-3.1-flash-image-preview' ||
    normalized === 'nanobanana2'
  ) {
    return 'gemini-3.1-flash-image-preview';
  }
  if (
    normalized === 'Seedream5.0' ||
    normalized === 'Seedream 5.0' ||
    normalized === 'Seedream 4' ||
    normalized === 'doubao-seedream-5-0-260128'
  ) {
    return 'doubao-seedream-5-0-260128';
  }
  if (
    normalized === 'GPT Image 2' ||
    normalized === 'gpt-image-2' ||
    normalized === 'GPT Image 2 All' ||
    normalized === 'gpt-image-2-all'
  ) {
    return 'gpt-image-2';
  }
  if (normalized === 'GPT Image 1.5' || normalized === 'gpt-image-1.5-all') {
    return 'gpt-image-1.5-all';
  }
  if (normalized === 'Flux.2 Max' || normalized === 'flux-pro-max') {
    return 'flux-pro-max';
  }

  return normalized;
};

const isTransparentBackgroundUnsupportedError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || '');
  const normalized = message.toLowerCase();
  return (
    normalized.includes('transparent background is not supported for this model') ||
    (normalized.includes('transparent background') && normalized.includes('not supported'))
  );
};

const resolveBackgroundRemoveEditModel = (model: string | undefined): string | undefined => {
  const normalized = resolveSmartEditModelId(model);
  if (normalized === 'gpt-image-2') {
    return 'gpt-image-1.5-all';
  }
  return normalized;
};

const resolvePreferredImageProviderId = (): string | null => {
  try {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem('workspace_preferred_image_provider_id');
      if (raw) return raw;
    }
  } catch {
    // ignore
  }
  return null;
};

const resolvePreferredImageModel = (): string => {
  try {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem('workspace_preferred_image_model');
      if (raw) return raw;
    }
  } catch {
    // ignore storage errors
  }
  return 'NanoBanana2';
};

export async function smartEditSkill(params: SmartEditParams): Promise<string | null> {
  const rawParams = (params || {}) as Record<string, any>;
  const nestedRawParams = isRecord(rawParams.params) ? rawParams.params : null;
  const topLevelParameters = isRecord(rawParams.parameters) ? rawParams.parameters : null;
  const nestedParameters =
    nestedRawParams && isRecord(nestedRawParams.parameters)
      ? nestedRawParams.parameters
      : null;
  const directParameters = isRecord(params.parameters) ? params.parameters : null;

  params.parameters = {
    ...(nestedParameters || {}),
    ...(topLevelParameters || {}),
    ...(directParameters || {}),
  };

  params.sourceUrl =
    pickFirstNonEmptyString(
      params.sourceUrl,
      rawParams.sourceUrl,
      nestedRawParams?.sourceUrl,
      rawParams.init_image,
      nestedRawParams?.init_image,
      rawParams.referenceImage,
      nestedRawParams?.referenceImage,
      rawParams.reference_image_url,
      nestedRawParams?.reference_image_url,
      rawParams.referenceImageUrl,
      nestedRawParams?.referenceImageUrl,
    ) || '';

  params.maskImage = pickFirstNonEmptyString(
    params.maskImage,
    rawParams.maskImage,
    nestedRawParams?.maskImage,
    rawParams.mask_image,
    nestedRawParams?.mask_image,
  );

  const normalizedPrompt = pickFirstNonEmptyString(
    params.parameters?.prompt,
    rawParams.prompt,
    nestedRawParams?.prompt,
    rawParams.instruction,
    nestedRawParams?.instruction,
  );
  if (normalizedPrompt) {
    params.parameters.prompt = normalizedPrompt;
  }

  const intentText = collectIntentText(
    params.parameters?.prompt,
    rawParams.instruction,
    nestedRawParams?.instruction,
    rawParams.prompt,
    nestedRawParams?.prompt,
    rawParams.editType,
    nestedRawParams?.editType,
    params.editType,
  );
  const explicitEditType = pickFirstNonEmptyString(
    params.editType,
    rawParams.editType,
    nestedRawParams?.editType,
  ) as SmartEditType | undefined;

  if (looksLikeBackgroundRemoveIntent(intentText)) {
    params.editType = 'background-remove';
  } else if (explicitEditType) {
    params.editType = explicitEditType;
  } else if (looksLikeStyleTransferIntent(intentText)) {
    params.editType = 'style-transfer';
  } else {
    params.editType = 'style-transfer';
  }

  params.aspectRatio = pickFirstNonEmptyString(
    params.aspectRatio,
    params.parameters?.aspectRatio,
    rawParams.aspectRatio,
    nestedRawParams?.aspectRatio,
  );

  const editPrompts: Record<SmartEditType, string> = {
    'background-remove':
      'Remove the background from this image, keep only the main subject with transparent background',
    'object-remove': `Remove ${params.parameters?.object || 'the specified object'} from this image seamlessly`,
    upscale: 'Enhance and upscale this image to higher resolution while preserving all details',
    'style-transfer': `Apply ${params.parameters?.style || 'artistic'} style to this image`,
    extend: `Extend this image ${params.parameters?.direction || 'outward'} naturally`,
  };

  const promptTemplate =
    params.parameters?.prompt || editPrompts[params.editType] || 'Edit this image';

  try {
    let finalPrompt = promptTemplate;
    const requestedGenerationModel = pickFirstNonEmptyString(
      params.parameters?.model,
      rawParams.model,
      nestedRawParams?.model,
    );
    const requestedEditModel = pickFirstNonEmptyString(
      params.parameters?.editModel,
      rawParams.editModel,
      nestedRawParams?.editModel,
      requestedGenerationModel,
    );
    const resolvedProviderId =
      pickFirstNonEmptyString(
        params.parameters?.providerId,
        rawParams.providerId,
        nestedRawParams?.providerId,
      ) || resolvePreferredImageProviderId();
    const resolvedAspectRatio =
      pickFirstNonEmptyString(
        params.aspectRatio,
        params.parameters?.aspectRatio,
        rawParams.aspectRatio,
        nestedRawParams?.aspectRatio,
      ) || (params.sourceUrl ? await resolveSourceAspectRatio(params.sourceUrl) : undefined);
    const resolvedImageSize = pickFirstNonEmptyString(
      params.parameters?.imageSize,
      rawParams.imageSize,
      nestedRawParams?.imageSize,
    );
    const resolvedExactSize =
      pickFirstNonEmptyString(
        params.parameters?.exactSize,
        rawParams.exactSize,
        nestedRawParams?.exactSize,
      ) || 'auto';
    const resolvedReferenceImages = pickFirstNonEmptyStringArray(
      params.parameters?.referenceImages,
      rawParams.referenceImages,
      nestedRawParams?.referenceImages,
    );

    const resolvedGenerationModel =
      resolveSmartEditModelId(requestedGenerationModel) ||
      resolveSmartEditModelId(resolvePreferredImageModel()) ||
      (params.editType === 'upscale'
        ? 'gemini-3-pro-image-preview'
        : 'NanoBanana2');
    const resolvedEditModel =
      resolveSmartEditModelId(requestedEditModel) || resolvedGenerationModel;
    const effectiveEditModel =
      params.editType === 'background-remove'
        ? resolveBackgroundRemoveEditModel(resolvedEditModel) || resolvedEditModel
        : resolvedEditModel;

    if (
      params.editType === 'background-remove' &&
      effectiveEditModel !== resolvedEditModel
    ) {
      console.info('[smartEditSkill] background-remove rerouted to transparent-capable edit model', {
        requestedEditModel: resolvedEditModel,
        effectiveEditModel,
      });
    }

    if (looksLikeMetaPrompt(promptTemplate)) {
      console.log('[smartEditSkill] Detected meta-prompt framework, refining with Flash...');
      try {
        const refined = await refineImagePrompt(params.sourceUrl || '', promptTemplate);
        if (refined) {
          finalPrompt = refined;
          console.log('[smartEditSkill] Prompt refined successfully.');
        }
      } catch (refineErr) {
        console.warn('[smartEditSkill] Prompt refinement failed, using raw template:', refineErr);
      }
    }

    let result: string | null = null;

    const shouldUseEditPath =
      Boolean(params.maskImage) ||
      params.editType === 'object-remove' ||
      params.editType === 'background-remove' ||
      params.editType === 'extend' ||
      params.editType === 'upscale';

    if (shouldUseEditPath) {
      const editConfig = {
        sourceImage: params.sourceUrl || '',
        maskImage: params.maskImage,
        signal: params.signal,
        prompt: `${params.parameters?.preservePrompt || 'Preserve identity, layout, lighting, materials, and all untouched areas.'} ${finalPrompt}`.trim(),
        model: effectiveEditModel,
        aspectRatio: resolvedAspectRatio,
        imageSize: resolvedImageSize,
        exactSize: resolvedExactSize,
        background: params.editType === 'background-remove' ? 'transparent' : undefined,
        outputFormat: params.editType === 'background-remove' ? 'png' : undefined,
        providerId: resolvedProviderId,
        referenceImages: resolvedReferenceImages,
      } as any;
      try {
        result = await editImage(editConfig);
      } catch (error) {
        if (
          params.editType === 'background-remove' &&
          effectiveEditModel !== 'gpt-image-1.5-all' &&
          isTransparentBackgroundUnsupportedError(error)
        ) {
          console.warn('[smartEditSkill] transparent background unsupported, retrying with gpt-image-1.5-all');
          result = await editImage({
            ...editConfig,
            model: 'gpt-image-1.5-all',
          });
        } else {
          throw error;
        }
      }
    }

    if (!result) {
      const requestedImageSize = normalizeGenerationImageSize(resolvedImageSize);
      result = await generateImageWithProvider(
        {
          prompt: finalPrompt,
          signal: params.signal,
          providerId: resolvedProviderId,
          aspectRatio: resolvedAspectRatio,
          exactSize: resolvedExactSize,
          imageSize:
            requestedImageSize ||
            (params.editType === 'upscale'
              ? params.parameters?.factor >= 4
                ? '4K'
                : '2K'
              : '1K'),
          referenceImage: params.sourceUrl || '',
          referenceImages: resolvedReferenceImages,
          maskImage: params.maskImage,
          referenceStrength: params.parameters?.referenceStrength,
          referencePriority: params.parameters?.referencePriority,
          referenceMode: params.parameters?.referenceMode,
          referenceRoleMode: params.parameters?.referenceRoleMode,
          promptLanguagePolicy: params.parameters?.promptLanguagePolicy,
          textPolicy: params.parameters?.textPolicy,
          consistencyContext: params.parameters?.consistencyContext,
        },
        resolvedGenerationModel,
      );
    }

    if (!result) {
      throw new Error(
        `Smart edit did not produce an image for editType=${params.editType}`,
      );
    }

    if (params.editType === 'background-remove') {
      const validation = await validateTransparentCutoutResult(result);
      if (!validation.ok) {
        throw new Error(
          validation.reason === 'not-data-url'
            ? '去背景结果不是有效图片。'
            : validation.reason === 'missing-alpha-output'
              ? '去背景结果没有透明通道。'
              : '透明背景校验失败。',
        );
      }
    }

    return result;
  } catch (error) {
    console.error('Smart edit error:', error);
    throw error;
  }
}
