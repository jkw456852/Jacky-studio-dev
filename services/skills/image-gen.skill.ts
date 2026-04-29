import { generateImageWithProvider } from '../providers';
import { ImageGenSkillParams } from '../../types/skill.types';

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

  return generateImageWithProvider(
    {
      prompt: enhancedPrompt,
      providerId: params.providerId,
      aspectRatio: params.aspectRatio,
      imageSize: params.imageSize || '2K',
      imageQuality: params.imageQuality,
      disableTransportRetries: params.disableTransportRetries,
      referenceImage: normalizedReferenceImage,
      referenceImages: params.referenceImages,
      maskImage: params.maskImage,
      referenceStrength: params.referenceStrength,
      referencePriority: params.referencePriority,
      referenceMode: params.referenceMode,
      referenceRoleMode: params.referenceRoleMode,
      promptLanguagePolicy: params.promptLanguagePolicy,
      textPolicy: params.textPolicy,
      consistencyContext: params.consistencyContext,
    },
    params.model
  );
}
