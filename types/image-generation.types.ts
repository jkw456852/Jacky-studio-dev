export type ImageTransportMode =
  | 'openai-generate-json'
  | 'openai-edit-json'
  | 'openai-edit-form'
  | 'gemini-inline';

export interface ImageRequestWarning {
  code:
    | 'MODEL_NORMALIZED'
    | 'ASPECT_RATIO_NORMALIZED'
    | 'SIZE_RESOLVED'
    | 'ROUTE_SWITCHED'
    | 'PAYLOAD_MODE_SWITCHED';
  message: string;
}

export const createImageRequestWarning = (
  code: ImageRequestWarning['code'],
  message: string,
): ImageRequestWarning => ({
  code,
  message: String(message || '').trim(),
});

export interface ImageUserRequestSnapshot {
  requestedModel: string;
  requestedAspectRatio: string;
  requestedImageSize?: string | null;
  requestedExactSize?: string | null;
  requestedImageQuality?: string | null;
  referenceCount: number;
  hasMask: boolean;
}

export interface ImageTransportRequestSnapshot {
  resolvedModel: string;
  resolvedAspectRatio?: string | null;
  resolvedSize?: string | null;
  providerId?: string | null;
  baseUrl?: string | null;
  route?: string | null;
  effectiveRoute?: string | null;
  requestMode?: string | null;
  payloadMode?: ImageTransportMode | null;
  requestFingerprint?: string | null;
  referenceCount: number;
  hasMask: boolean;
  warnings: ImageRequestWarning[];
  transportProfileDigest?: {
    routeStyle?: string;
    requestModes?: string[];
    aspectRatioPolicy?: string;
    pollingMode?: string;
  } | null;
}

export interface ImageResultSnapshot {
  status: 'submitted' | 'completed' | 'failed';
  taskId?: string | null;
  resultKind?: 'data-url' | 'remote-url' | 'empty' | null;
  error?: string | null;
}
