import { generateImageWithProvider } from '../providers';
import { ImageGenSkillParams } from '../../types/skill.types.ts';
import { negotiateImageToolRequest } from '../image-generation/request-negotiator.ts';

export async function imageGenSkill(params: ImageGenSkillParams): Promise<string | null> {
  let enhancedPrompt = params.prompt;
  const normalizedReferenceImage =
    params.referenceImage ||
    params.referenceImageUrl ||
    params.reference_image_url ||
    params.initImage ||
    params.init_image;

  if (params.brandContext?.colors?.length) {
    enhancedPrompt += `, color palette: ${params.brandContext.colors.join(', ')}`;
  }

  if (params.brandContext?.style) {
    enhancedPrompt += `, style: ${params.brandContext.style}`;
  }

  const negotiated = negotiateImageToolRequest({
    prompt: enhancedPrompt,
    model: params.model,
    signal: params.signal,
    providerId: params.providerId,
    aspectRatio: params.aspectRatio,
    imageSize: params.imageSize,
    exactSize: params.exactSize,
    imageQuality: params.imageQuality,
    quality: params.quality,
    background: params.background,
    outputFormat: params.outputFormat,
    outputCompression: params.outputCompression,
    moderation: params.moderation,
    n: params.n,
    partialImages: params.partialImages,
    stream: params.stream,
    style: params.style,
    responseFormat: params.responseFormat,
    disableTransportRetries: params.disableTransportRetries,
    referenceImage: normalizedReferenceImage,
    referenceImages: params.referenceImages,
    maskImage: params.maskImage,
    inputFidelity: params.inputFidelity,
    referenceStrength: params.referenceStrength,
    referencePriority: params.referencePriority,
    referenceMode: params.referenceMode,
    referenceRoleMode: params.referenceRoleMode,
    promptLanguagePolicy: params.promptLanguagePolicy,
    textPolicy: params.textPolicy,
    consistencyContext: params.consistencyContext,
    onSubmitted: params.onSubmitted,
    onTransportPrepared: params.onTransportPrepared,
  });

  return generateImageWithProvider(negotiated.request, negotiated.normalized.model || params.model);
}
