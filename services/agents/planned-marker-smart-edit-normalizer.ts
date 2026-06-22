const buildMarkerHintBlock = (file: any, attachmentIndex: number): string | null => {
  const info = file?.markerInfo;
  if (!info) {
    return null;
  }

  const label = String(file?.markerName || 'Selection').trim() || 'Selection';
  const xPct =
    typeof info.normalizedX === 'number' && Number.isFinite(info.normalizedX)
      ? Math.round(info.normalizedX * 100)
      : null;
  const yPct =
    typeof info.normalizedY === 'number' && Number.isFinite(info.normalizedY)
      ? Math.round(info.normalizedY * 100)
      : null;
  const coordLine =
    xPct !== null && yPct !== null
      ? `Marker anchor is near ${xPct}% from the left and ${yPct}% from the top of the original image.`
      : 'Marker anchor identifies the exact user-selected edit spot.';

  return [
    '',
    '[Marker Anchor]',
    `Use ATTACHMENT_${attachmentIndex} as the marked source attachment.`,
    `Treat marker "${label}" as the exact user-selected edit anchor.`,
    coordLine,
    'Keep the requested addition or edit attached to that marked spot instead of relocating it elsewhere in the frame.',
  ].join('\n');
};

const appendHintIfMissing = (value: unknown, hintBlock: string): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.includes('[Marker Anchor]')) {
    return value;
  }
  return `${value}\n${hintBlock}`.trim();
};

export const normalizePlannedMarkerSmartEditCalls = ({
  parsedPlan,
  attachments,
  uploadedAttachments,
}: {
  parsedPlan: any;
  attachments?: File[];
  uploadedAttachments?: string[];
}): any => {
  if (!parsedPlan || !Array.isArray(parsedPlan.skillCalls) || parsedPlan.skillCalls.length === 0) {
    return parsedPlan;
  }

  const markerIndex = (attachments || []).findIndex((file) => Boolean((file as any)?.markerInfo));
  if (markerIndex < 0) {
    return parsedPlan;
  }

  const markerFile = attachments?.[markerIndex] as any;
  const token = `ATTACHMENT_${markerIndex}`;
  const uploadedUrl =
    Array.isArray(uploadedAttachments) && typeof uploadedAttachments[markerIndex] === 'string'
      ? uploadedAttachments[markerIndex]
      : null;
  const fullImageUrl =
    typeof markerFile?.markerInfo?.fullImageUrl === 'string'
      ? markerFile.markerInfo.fullImageUrl
      : null;
  const hintBlock = buildMarkerHintBlock(markerFile, markerIndex);

  parsedPlan.skillCalls = parsedPlan.skillCalls.map((call: any) => {
    if (call?.skillName !== 'smartEdit') {
      return call;
    }

    if (!call.params || typeof call.params !== 'object') {
      call.params = {};
    }

    const sourceUrl = typeof call.params.sourceUrl === 'string' ? call.params.sourceUrl : '';
    if (
      !sourceUrl ||
      sourceUrl === uploadedUrl ||
      sourceUrl === fullImageUrl ||
      /^https?:\/\/i\.ibb\.co\//i.test(sourceUrl)
    ) {
      call.params.sourceUrl = token;
    }

    if (!hintBlock) {
      return call;
    }

    const nextInstruction = appendHintIfMissing(call.params.instruction, hintBlock);
    if (nextInstruction) {
      call.params.instruction = nextInstruction;
    } else if (typeof call.params.instruction !== 'string' || !call.params.instruction.trim()) {
      call.params.instruction = hintBlock.trim();
    }

    if (!call.params.parameters || typeof call.params.parameters !== 'object') {
      call.params.parameters = {};
    }

    const nextPrompt = appendHintIfMissing(call.params.parameters.prompt, hintBlock);
    if (nextPrompt) {
      call.params.parameters.prompt = nextPrompt;
    }

    return call;
  });

  return parsedPlan;
};
