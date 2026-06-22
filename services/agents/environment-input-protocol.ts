import type { AgentTask } from '../../types/agent.types.ts';
import { collectReferenceCandidates } from './utils/reference-images.ts';

export interface ResolvedEnvironmentReferences {
  references: string[];
  sourceCount: number;
  truncated: boolean;
  omittedCount: number;
  autoInjectedAttachmentToken?: string;
}

type MarkerAttachmentFile = File & {
  markerInfo?: {
    fullImageUrl?: string;
    normalizedX?: number;
    normalizedY?: number;
    imageWidth?: number;
    imageHeight?: number;
    width?: number;
    height?: number;
  };
  markerName?: string;
  lastAiAnalysis?: string;
};

const dedupeStrings = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const normalized = String(value || '').trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
};

const syncReferenceAliases = (
  call: any,
  references: string[],
  options?: { overwriteAliases?: boolean },
): void => {
  const overwriteAliases = options?.overwriteAliases === true;
  call.params.referenceImages = references;

  if (references.length === 0) {
    delete call.params.referenceImage;
    delete call.params.reference_image_url;
    delete call.params.init_image;
    return;
  }

  const firstRef = references[0];
  if (overwriteAliases || !call.params.referenceImage) {
    call.params.referenceImage = firstRef;
  }
  if (overwriteAliases || !call.params.reference_image_url) {
    call.params.reference_image_url = firstRef;
  }
  if (overwriteAliases || !call.params.init_image) {
    call.params.init_image = firstRef;
  }
};

const appendHintToSmartEditPrompt = (call: any, hintBlock: string): void => {
  let appended = false;

  if (typeof call.params.prompt === 'string' && call.params.prompt.trim()) {
    call.params.prompt = `${call.params.prompt}${hintBlock}`;
    appended = true;
  }

  if (typeof call.params.instruction === 'string' && call.params.instruction.trim()) {
    call.params.instruction = `${call.params.instruction}${hintBlock}`;
    appended = true;
  }

  if (!call.params.parameters) {
    call.params.parameters = {};
  }

  if (
    typeof call.params.parameters.prompt === 'string' &&
    call.params.parameters.prompt.trim()
  ) {
    call.params.parameters.prompt = `${call.params.parameters.prompt}${hintBlock}`;
    appended = true;
  }

  if (!appended) {
    call.params.instruction = hintBlock.trim();
  }
};

const isMarkerAttachment = (file: unknown): file is MarkerAttachmentFile => {
  const info = (file as MarkerAttachmentFile | null | undefined)?.markerInfo;
  return Boolean(info && typeof info.fullImageUrl === 'string' && info.fullImageUrl.trim());
};

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

  syncReferenceAliases(call, references);
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
  let references: string[] = [];

  for (const item of limitedCandidates) {
    const resolved = await resolveAttachmentTokenFn(task, item);
    if (resolved) {
      references.push(resolved);
    }
  }

  references = dedupeStrings(references);

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

  if (call.skillName === 'smartEdit' && Array.isArray(task.input.attachments)) {
    const markerEntries = task.input.attachments
      .map((file, index) => ({ file: file as MarkerAttachmentFile, index }))
      .filter((entry) => isMarkerAttachment(entry.file));

    console.log(
      '[marker-protocol] attachments count:',
      task.input.attachments.length,
      'markers:',
      markerEntries.length,
    );

    if (markerEntries.length > 0) {
      const primary = markerEntries[0].file;
      const primaryInfo = primary.markerInfo!;
      call.params.sourceUrl = primaryInfo.fullImageUrl!;

      if (primaryInfo.imageWidth && primaryInfo.imageHeight) {
        const ratio = primaryInfo.imageWidth / primaryInfo.imageHeight;
        if (ratio > 1.5) call.params.aspectRatio = '16:9';
        else if (ratio < 0.7) call.params.aspectRatio = '9:16';
        else if (ratio > 1.2) call.params.aspectRatio = '4:3';
        else if (ratio < 0.85) call.params.aspectRatio = '3:4';
        else call.params.aspectRatio = '1:1';
      }

      const markerReferenceImages = dedupeStrings(
        (
          await Promise.all(
            markerEntries.map(({ index }) =>
              resolveAttachmentTokenFn(task, `ATTACHMENT_${index}`),
            ),
          )
        ).filter(
          (value): value is string =>
            typeof value === 'string' && value.trim().length > 0,
        ),
      );

      const currentReferenceImages = Array.isArray(call.params.referenceImages)
        ? call.params.referenceImages.filter(
            (value: unknown): value is string =>
              typeof value === 'string' && value.trim().length > 0,
          )
        : [];
      const nonMarkerReferenceImages = currentReferenceImages.filter(
        (value) => !markerReferenceImages.includes(value),
      );
      const mergedReferenceImages = dedupeStrings([
        ...markerReferenceImages,
        ...nonMarkerReferenceImages,
      ]);

      references = mergedReferenceImages;
      syncReferenceAliases(call, mergedReferenceImages, { overwriteAliases: true });

      const markerHints = markerEntries
        .map(({ file }, idx) => {
          const info = file.markerInfo!;
          const label = file.lastAiAnalysis || file.markerName || `Selection ${idx + 1}`;
          const nx = typeof info.normalizedX === 'number' ? info.normalizedX : null;
          const ny = typeof info.normalizedY === 'number' ? info.normalizedY : null;
          if (nx !== null && ny !== null) {
            const xPct = Math.round(nx * 100);
            const yPct = Math.round(ny * 100);
            return `- Marker #${idx + 1} "${label}" is near ${xPct}% from the left and ${yPct}% from the top of the original image.`;
          }
          return `- Marker #${idx + 1} "${label}" identifies the target edit area.`;
        })
        .join('\n');

      const hintBlock = `\n\n[Marker Reference Rule]
- One injected reference image is the same source image with a visible marker overlay.
- Treat that visible marker as the exact user-selected edit anchor.
- Keep the requested addition or change attached to that marked spot instead of relocating it elsewhere in the frame.

[User Marker Coordinates]
${markerHints}
Use the visible marker overlay together with these coordinates to localize the edit. Outside the marked target area, the original image should stay unchanged.`;

      appendHintToSmartEditPrompt(call, hintBlock);

      if (!call.params.parameters) {
        call.params.parameters = {};
      }
      if (!call.params.parameters.preservePrompt) {
        call.params.parameters.preservePrompt =
          'Preserve the original image content, subject, layout, lighting, and all areas outside the marker-selected target area. Only modify the specifically marked area.';
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
