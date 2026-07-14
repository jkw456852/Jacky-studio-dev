export type AssistantToolErrorDetails = {
  title: string;
  message: string;
  raw: string;
  requestId?: string;
  providerId?: string;
  providerBaseUrl?: string;
  modelId?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toErrorText = (value: unknown, seen = new Set<unknown>()): string => {
  if (typeof value === "string") return value.trim();
  if (value instanceof Error) return value.message.trim();
  if (!isRecord(value) || seen.has(value)) return "";
  seen.add(value);

  for (const key of ["errorText", "message", "error", "cause", "data"]) {
    const text = toErrorText(value[key], seen);
    if (text) return text;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
};

const readErrorField = (
  segments: string[],
  field: string,
): string | undefined => {
  const prefix = `${field}=`;
  const segment = segments.find((item) => item.startsWith(prefix));
  const value = segment?.slice(prefix.length).trim();
  return value || undefined;
};

const getErrorTitle = (message: string): string => {
  if (/safety|safety_violations|content[-_ ]?filter|moderation|sexual/i.test(message)) {
    return "上游安全审核拒绝";
  }
  if (/timeout|timed out|deadline exceeded/i.test(message)) {
    return "图片供应商响应超时";
  }
  if (/rate.?limit|too many requests|\b429\b/i.test(message)) {
    return "图片供应商请求受限";
  }
  if (/unauthorized|forbidden|invalid api key|\b401\b|\b403\b/i.test(message)) {
    return "图片供应商拒绝访问";
  }
  return "图片供应商返回失败";
};

export const parseAssistantToolError = (
  error: unknown,
): AssistantToolErrorDetails | null => {
  const raw = toErrorText(error);
  if (!raw) return null;

  const normalized = raw
    .replace(/^Assistant chat failed:\s*/i, "")
    .trim();
  const segments = normalized.split(/\s+\|\s+/).map((item) => item.trim());
  const firstSegment = segments[0] || normalized;
  const message = firstSegment.replace(/^message=/i, "").trim() || normalized;
  const providerId =
    readErrorField(segments, "imageProviderId") ||
    readErrorField(segments, "providerId");
  const providerBaseUrl =
    readErrorField(segments, "imageProviderBaseUrl") ||
    readErrorField(segments, "providerBaseUrl");
  const modelId =
    readErrorField(segments, "imageModelId") ||
    readErrorField(segments, "modelId");

  return {
    title: getErrorTitle(normalized),
    message,
    raw,
    requestId: readErrorField(segments, "requestId"),
    providerId,
    providerBaseUrl,
    modelId,
  };
};
