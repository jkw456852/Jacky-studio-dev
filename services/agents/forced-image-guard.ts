import type { AgentTask } from '../../types/agent.types';
import {
  isImageGenerationSkillName,
  isVisualReferenceResolutionSkillName,
} from '../skills/skill-manifest.ts';
import { buildImageAttachmentTokens } from './environment-input-protocol';

export const buildForcedGenerateImageCall = (
  message: string,
  attachments?: File[],
  metadata?: Record<string, any>,
) => {
  let aspectRatio = (metadata?.preferredAspectRatio as string) || '3:4';
  if (/(横版|横屏|宽屏|16:9|landscape)/i.test(message)) {
    aspectRatio = '16:9';
  } else if (/(竖版|竖屏|手机屏|9:16|portrait)/i.test(message)) {
    aspectRatio = '9:16';
  } else if (/(方图|正方形|1:1|square)/i.test(message)) {
    aspectRatio = '1:1';
  } else if (/(4:3)/i.test(message)) {
    aspectRatio = '4:3';
  }

  let layoutDescriptor = '';
  if (aspectRatio === '16:9') layoutDescriptor = 'ultra-wide cinematic 2k masterpiece, 16:9 landscape orientation, expansive detailed view, ';
  else if (aspectRatio === '9:16') layoutDescriptor = 'vertical smartphone 2k wallpaper, 9:16 portrait orientation, vertical detailed composition, ';
  else if (aspectRatio === '4:3') layoutDescriptor = 'high-resolution 2k professional 4:3 presentation layout, ';
  else if (aspectRatio === '3:4') layoutDescriptor = 'high-definition 2k portrait photography, 3:4 orientation, ';
  else if (aspectRatio === '1:1') layoutDescriptor = 'hi-res 2k square format, 1:1 ratio, ';

  const forcedCall: any = {
    skillName: 'generateImage',
    params: {
      prompt: `${layoutDescriptor}${message}, high-impact visual design, clean composition, studio lighting, professional 2k digital art, 8k resolution details`,
      aspectRatio,
      quality: 'hd',
      resolution: '2048x2048',
      model: 'Nano Banana Pro',
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
