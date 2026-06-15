import type {
  ImageRequestWarning,
  ImageResultSnapshot,
  ImageTransportRequestSnapshot,
  ImageUserRequestSnapshot,
} from '../../types/image-generation.types';

const normalizeWarning = (warning: ImageRequestWarning): ImageRequestWarning => ({
  code: warning.code,
  message: String(warning.message || '').trim(),
});

export const normalizeImageUserRequestSnapshot = (
  input?: ImageUserRequestSnapshot | null,
): ImageUserRequestSnapshot | null => {
  if (!input) return null;
  return {
    requestedModel: String(input.requestedModel || '').trim(),
    requestedAspectRatio: String(input.requestedAspectRatio || '').trim(),
    requestedImageSize: String(input.requestedImageSize || '').trim() || null,
    requestedExactSize: String(input.requestedExactSize || '').trim() || null,
    requestedImageQuality: String(input.requestedImageQuality || '').trim() || null,
    referenceCount: Math.max(0, Number(input.referenceCount || 0)),
    hasMask: Boolean(input.hasMask),
  };
};

export const normalizeImageTransportRequestSnapshot = (
  input?: ImageTransportRequestSnapshot | null,
): ImageTransportRequestSnapshot | null => {
  if (!input) return null;
  return {
    resolvedModel: String(input.resolvedModel || '').trim(),
    resolvedAspectRatio: String(input.resolvedAspectRatio || '').trim() || null,
    resolvedSize: String(input.resolvedSize || '').trim() || null,
    providerId: String(input.providerId || '').trim() || null,
    baseUrl: String(input.baseUrl || '').trim() || null,
    route: String(input.route || '').trim() || null,
    effectiveRoute: String(input.effectiveRoute || '').trim() || null,
    requestMode: String(input.requestMode || '').trim() || null,
    payloadMode: input.payloadMode || null,
    requestFingerprint: String(input.requestFingerprint || '').trim() || null,
    referenceCount: Math.max(0, Number(input.referenceCount || 0)),
    hasMask: Boolean(input.hasMask),
    warnings: Array.isArray(input.warnings)
      ? input.warnings
          .map((item) => normalizeWarning(item))
          .filter((item) => item.code && item.message)
      : [],
    transportProfileDigest: input.transportProfileDigest
      ? {
          routeStyle: String(input.transportProfileDigest.routeStyle || '').trim() || undefined,
          requestModes: Array.isArray(input.transportProfileDigest.requestModes)
            ? input.transportProfileDigest.requestModes
                .map((item) => String(item || '').trim())
                .filter(Boolean)
            : undefined,
          aspectRatioPolicy: String(input.transportProfileDigest.aspectRatioPolicy || '').trim() || undefined,
          pollingMode: String(input.transportProfileDigest.pollingMode || '').trim() || undefined,
        }
      : null,
  };
};

export const normalizeImageResultSnapshot = (
  input?: ImageResultSnapshot | null,
): ImageResultSnapshot | null => {
  if (!input) return null;
  return {
    status: input.status,
    taskId: String(input.taskId || '').trim() || null,
    resultKind: input.resultKind || null,
    error: String(input.error || '').trim() || null,
  };
};
