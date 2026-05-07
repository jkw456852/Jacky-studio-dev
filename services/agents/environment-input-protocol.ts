import type { AgentTask } from '../../types/agent.types.ts';
import { collectReferenceCandidates } from './utils/reference-images.ts';

export interface ResolvedEnvironmentReferences {
  references: string[];
  sourceCount: number;
  truncated: boolean;
  omittedCount: number;
  autoInjectedAttachmentToken?: string;
}

export const buildImageAttachmentTokens = (
  attachments?: Array<{ type?: string }>,
): string[] =>
  (attachments || []).flatMap((file, index) =>
    file?.type && file.type.startsWith('image/') ? [`ATTACHMENT_${index}`] : [],
  );

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });

export const inferAspectRatioFromMarkerInfo = (file: File): string | null => {
  const info = (file as any)?.markerInfo;
  if (!info || !info.width || !info.height) {
    return null;
  }

  const ratio = info.width / info.height;
  if (ratio > 1.5) return '16:9';
  if (ratio < 0.7) return '9:16';
  if (ratio > 1.2) return '4:3';
  if (ratio < 0.8) return '3:4';
  return '1:1';
};

export const getPrimaryReferenceParamKey = (skillName: string) =>
  skillName === 'smartEdit' ? 'sourceUrl' : 'referenceImage';

export const resolveAttachmentToken = async (
  task: AgentTask,
  value: string,
): Promise<string | null> => {
  if (!value.startsWith('ATTACHMENT_')) {
    return value;
  }

  const idx = Number.parseInt(value.split('_')[1] || '', 10);
  const selectedProvider = String(task.input.metadata?.imageHostProvider || 'none');
  const preferHostedUrls = selectedProvider !== 'none';

  if (preferHostedUrls) {
    const hostedUrl = task.input.uploadedAttachments?.[idx];
    if (hostedUrl && /^https?:\/\//i.test(hostedUrl)) {
      return hostedUrl;
    }
  }

  const file = task.input.attachments?.[idx];
  if (!file) {
    return null;
  }

  const dataUrl = await fileToDataUrl(file);
  return dataUrl || null;
};

export const autoInjectPrimaryAttachmentToken = (
  task: AgentTask,
  callIndex: number,
): string | null => {
  const imageAttachmentTokens = buildImageAttachmentTokens(task.input.attachments);

  if (imageAttachmentTokens.length === 0) {
    return null;
  }

  const attachIdx =
    imageAttachmentTokens.length === 1 ? 0 : callIndex % imageAttachmentTokens.length;
  return imageAttachmentTokens[attachIdx] || null;
};

export const appendReferenceTruncationNote = (
  prompt: unknown,
  sourceCount: number,
  injectedCount: number,
): string | null => {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return null;
  }

  return `${prompt}\n\nReference note: ${sourceCount} reference images were provided. Due to model input limits, ${injectedCount} representative references were injected. Keep composition, color language, and subject traits consistent with all provided references.`;
};

export const applyResolvedReferenceAliases = (
  call: any,
  references: string[],
): void => {
  if (references.length === 0) {
    return;
  }

  call.params.referenceImages = references;

  const firstRef = references[0];
  if (!call.params.referenceImage) call.params.referenceImage = firstRef;
  if (!call.params.reference_image_url) call.params.reference_image_url = firstRef;
  if (!call.params.init_image) call.params.init_image = firstRef;
};

export interface EnvironmentReferenceProtocolDependencies {
  collectReferenceCandidatesFn?: typeof collectReferenceCandidates;
  resolveAttachmentTokenFn?: typeof resolveAttachmentToken;
  inferAspectRatioFromMarkerInfoFn?: typeof inferAspectRatioFromMarkerInfo;
}

export const applyEnvironmentReferenceProtocol = async ({
  task,
  call,
  callIndex,
  maxReferenceImages,
  dependencies,
}: {
  task: AgentTask;
  call: any;
  callIndex: number;
  maxReferenceImages: number;
  dependencies?: EnvironmentReferenceProtocolDependencies;
}): Promise<ResolvedEnvironmentReferences | null> => {
  if (
    call.skillName !== 'generateImage' &&
    call.skillName !== 'generateVideo' &&
    call.skillName !== 'smartEdit'
  ) {
    return null;
  }

  const collectReferenceCandidatesFn =
    dependencies?.collectReferenceCandidatesFn || collectReferenceCandidates;
  const resolveAttachmentTokenFn =
    dependencies?.resolveAttachmentTokenFn || resolveAttachmentToken;
  const inferAspectRatioFromMarkerInfoFn =
    dependencies?.inferAspectRatioFromMarkerInfoFn || inferAspectRatioFromMarkerInfo;
  const paramKey = getPrimaryReferenceParamKey(call.skillName);
  let autoInjectedAttachmentToken: string | undefined;

  if (
    call.skillName === 'generateImage' &&
    (!Array.isArray(call.params.referenceImages) ||
      call.params.referenceImages.length === 0) &&
    !call.params[paramKey] &&
    task.input.attachments &&
    task.input.attachments.length > 0
  ) {
    const injected = autoInjectPrimaryAttachmentToken(task, callIndex);
    if (injected) {
      call.params[paramKey] = injected;
      autoInjectedAttachmentToken = injected;
    }
  }

  const { limitedCandidates, sourceCount, truncated } =
    collectReferenceCandidatesFn(call.params, task.input, maxReferenceImages);
  const references: string[] = [];

  for (const item of limitedCandidates) {
    const resolved = await resolveAttachmentTokenFn(task, item);
    if (resolved) {
      references.push(resolved);
    }
  }

  if (references.length > 0) {
    applyResolvedReferenceAliases(call, references);

    if (truncated) {
      const truncationNote = appendReferenceTruncationNote(
        call.params.prompt,
        sourceCount,
        references.length,
      );
      if (truncationNote) {
        call.params.prompt = truncationNote;
      }
    }
  }

  const primaryRefValue = call.params[paramKey];
  if (
    typeof primaryRefValue === 'string' &&
    primaryRefValue.startsWith('ATTACHMENT_')
  ) {
    const attachmentIndex = Number.parseInt(primaryRefValue.split('_')[1] || '', 10);
    const resolvedPrimary = await resolveAttachmentTokenFn(task, primaryRefValue);
    if (resolvedPrimary) {
      call.params[paramKey] = resolvedPrimary;
    }

    if (call.skillName === 'smartEdit') {
      const file = task.input.attachments?.[attachmentIndex];
      const inferredAspectRatio = file ? inferAspectRatioFromMarkerInfoFn(file) : null;
      if (inferredAspectRatio) {
        call.params.aspectRatio = inferredAspectRatio;
      }
    }
  }

  return {
    references,
    sourceCount,
    truncated,
    omittedCount: Math.max(0, sourceCount - references.length),
    autoInjectedAttachmentToken,
  };
};
