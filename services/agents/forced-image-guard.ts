import type { AgentTask } from '../../types/agent.types';
import {
  getImageModelSupportState,
  getNormalizedAspectRatioForImageModel,
  isGptImage2FamilyModel,
} from '../openai-image-presets.ts';
import {
  isImageGenerationSkillName,
  isVisualReferenceResolutionSkillName,
} from '../skills/skill-manifest.ts';
import { buildImageAttachmentTokens } from './environment-input-protocol.ts';

export const extractOriginalUserRequestFromRuntimeMessage = (message: string): string => {
  const normalized = String(message || '').trim();
  if (!normalized) {
    return '';
  }

  const runtimeMatch = normalized.match(
    /\[Original User Request\]\s*([\s\S]*?)\s*\[Runtime State Snapshot\]/i,
  );

  return runtimeMatch?.[1]?.trim() || normalized;
};

const extractAspectRatioFromMessage = (message: string): string | null => {
  const normalized = String(message || "");
  if (/(横版|横屏|宽屏|16\s*[:：]\s*9|landscape)/i.test(normalized)) return '16:9';
  if (/(竖版|竖屏|手机屏|9\s*[:：]\s*16|portrait)/i.test(normalized)) return '9:16';
  if (/(方图|正方形|1\s*[:：]\s*1|square)/i.test(normalized)) return '1:1';
  if (/(3\s*[:：]\s*4)/i.test(normalized)) return '3:4';
  if (/(4\s*[:：]\s*3)/i.test(normalized)) return '4:3';
  return null;
};

const extractImageSizeFromMessage = (
  message: string,
): '1K' | '2K' | '4K' | null => {
  const normalized = String(message || "");
  if (/(4K|4096|3840|超清|超高分辨率)/i.test(normalized)) return '4K';
  if (/(2K|2048|高清|高分辨率)/i.test(normalized)) return '2K';
  if (/(1K|1024)/i.test(normalized)) return '1K';
  return null;
};

const buildLayoutDescriptor = (
  aspectRatio: string,
  imageSize: '1K' | '2K' | '4K',
) => {
  const sizeDescriptor =
    imageSize === '4K'
      ? 'ultra-detailed 4k quality'
      : imageSize === '2K'
        ? 'high-resolution 2k quality'
        : 'clean 1k quality';

  if (aspectRatio === '16:9') {
    return `ultra-wide cinematic composition, 16:9 landscape orientation, ${sizeDescriptor}, expansive detailed view, `;
  }
  if (aspectRatio === '9:16') {
    return `vertical smartphone wallpaper composition, 9:16 portrait orientation, ${sizeDescriptor}, vertical detailed framing, `;
  }
  if (aspectRatio === '4:3') {
    return `${sizeDescriptor}, professional 4:3 presentation layout, `;
  }
  if (aspectRatio === '3:4') {
    return `${sizeDescriptor}, 3:4 portrait photography framing, `;
  }
  if (aspectRatio === '1:1') {
    return `${sizeDescriptor}, square 1:1 composition, `;
  }
  return `${sizeDescriptor}, `;
};

const resolvePreferredImageModel = (metadata?: Record<string, any>): string => {
  const preferred = String(metadata?.preferredImageModel || '').trim();
  return preferred || 'Nano Banana Pro';
};

const resolveNegotiatedImageConfig = ({
  requestedAspectRatio,
  requestedImageSize,
  model,
}: {
  requestedAspectRatio: string;
  requestedImageSize: '1K' | '2K' | '4K';
  model: string;
}) => {
  const normalizedAspectRatio = getNormalizedAspectRatioForImageModel(
    model,
    requestedAspectRatio,
  );
  const support = getImageModelSupportState({
    model,
    aspectRatio: normalizedAspectRatio,
    resolution: requestedImageSize,
  });

  return {
    aspectRatio: normalizedAspectRatio || requestedAspectRatio,
    imageSize: requestedImageSize,
    exactSize:
      isGptImage2FamilyModel(model) && support.actualSize
        ? support.actualSize
        : undefined,
  };
};

export const buildForcedGenerateImageCall = (
  message: string,
  attachments?: File[],
  metadata?: Record<string, any>,
) => {
  const actionableMessage =
    extractOriginalUserRequestFromRuntimeMessage(message) || String(message || '');
  const model = resolvePreferredImageModel(metadata);
  const providerId =
    typeof metadata?.preferredImageProviderId === 'string' &&
      metadata.preferredImageProviderId.trim()
      ? metadata.preferredImageProviderId.trim()
      : undefined;
  const messageAspectRatio = extractAspectRatioFromMessage(actionableMessage);
  const requestedAspectRatio =
    messageAspectRatio ||
    (typeof metadata?.preferredAspectRatio === 'string'
      ? metadata.preferredAspectRatio
      : '') ||
    '3:4';
  const requestedImageSize =
    extractImageSizeFromMessage(actionableMessage) ||
    (metadata?.preferredImageSize as '1K' | '2K' | '4K' | undefined) ||
    '2K';
  const negotiated = resolveNegotiatedImageConfig({
    requestedAspectRatio,
    requestedImageSize,
    model,
  });
  const aspectRatio = negotiated.aspectRatio;
  const imageSize = negotiated.imageSize;
  const layoutDescriptor = buildLayoutDescriptor(aspectRatio, imageSize);

  const forcedCall: any = {
    skillName: 'generateImage',
    params: {
      prompt: `${layoutDescriptor}${actionableMessage}, high-impact visual design, clean composition, studio lighting, premium digital art, crisp realistic detail`,
      aspectRatio,
      imageSize,
      quality: 'hd',
      model,
      ...(providerId ? { providerId } : {}),
      ...(negotiated.exactSize ? { exactSize: negotiated.exactSize } : {}),
    },
  };

  if (attachments && attachments.length > 0) {
    const attachmentRefs = buildImageAttachmentTokens(attachments);
    const primaryRef = attachmentRefs[0];
    if (attachmentRefs.length === 0 || !primaryRef) {
      return forcedCall;
    }

    forcedCall.params.referenceImages = attachmentRefs;
    forcedCall.params.referenceImage = primaryRef;
    forcedCall.params.reference_image_url = primaryRef;
    forcedCall.params.init_image = primaryRef;
    forcedCall.params.referencePriority = attachmentRefs.length > 1 ? 'all' : 'first';
    forcedCall.params.referenceMode = 'product';
  }

  return forcedCall;
};

export const ensureForcedImagePlan = ({
  parsedPlan,
  message,
  attachments,
  metadata,
}: {
  parsedPlan: any;
  message: string;
  attachments?: File[];
  metadata?: Record<string, any>;
}) => {
  const topCalls = Array.isArray(parsedPlan.skillCalls) ? parsedPlan.skillCalls : [];
  const proposalCalls = Array.isArray(parsedPlan.proposals)
    ? parsedPlan.proposals.flatMap((p: any) =>
        Array.isArray(p.skillCalls) ? p.skillCalls : [],
      )
    : [];
  const hasGenerateImage = [...topCalls, ...proposalCalls].some((c: any) =>
    isImageGenerationSkillName(c?.skillName),
  );

  if (!hasGenerateImage) {
    parsedPlan.skillCalls = [
      buildForcedGenerateImageCall(message, attachments, metadata),
    ];
    parsedPlan.message = '已触发强制出图流程，正在为您生成图像。';
  }

  return parsedPlan;
};

export const validateForcedSkillAttachments = (call: any, task: AgentTask) => {
  if (
    isVisualReferenceResolutionSkillName(call.skillName) &&
    task.input.metadata?.forceSkills
  ) {
    const refKey = call.skillName === 'smartEdit' ? 'sourceUrl' : 'referenceImage';
    const refVal = call.params?.[refKey];
    const requiresAttachment =
      (typeof refVal === 'string' && refVal.startsWith('ATTACHMENT_')) ||
      call.skillName === 'smartEdit';

    if (
      requiresAttachment &&
      (!task.input.attachments || task.input.attachments.length === 0)
    ) {
      throw new Error('执行方案时缺少参考附件，请先在输入区保留产品图或标记图后再执行。');
    }
  }
};
