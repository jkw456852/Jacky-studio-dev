type ResearchEndpoint = "search" | "extract" | "rehost-image";

const ENDPOINT_LABELS: Record<ResearchEndpoint, string> = {
  search: "搜索",
  extract: "网页提取",
  "rehost-image": "图片中转",
};

const FRIENDLY_ERROR_MAP: Record<string, string> = {
  extract_timeout: "网页提取超时，请稍后重试",
  content_too_large: "网页内容过大，暂不支持提取",
  unsupported_content_type: "网页内容类型不支持提取",
  private_network_url_not_allowed: "目标地址不可访问",
  redirected_to_private_network: "目标地址重定向到了不可访问区域",
  url_parse_failed: "目标地址格式不正确，无法提取",
  fetch_failed_401: "目标页面需要登录或验证，暂时无法提取",
  fetch_failed_403: "目标页面拒绝抓取，已保留搜索摘要作为兼容结果",
  fetch_failed_404: "目标页面不存在或已删除，无法提取",
  fetch_failed_408: "目标页面响应超时，请稍后重试",
  fetch_failed_429: "目标页面限流，暂时无法提取",
  fetch_failed_500: "目标站点服务异常，请稍后重试",
  fetch_failed_502: "目标站点网关异常，请稍后重试",
  fetch_failed_503: "目标站点暂时不可用，请稍后再试",
  fetch_failed_504: "目标站点网关超时，请稍后重试",
  missing_imgbb_api_key: "图床未配置，已自动使用原始图片地址",
  research_search_failed: "搜索失败，请稍后重试",
  extract_failed: "网页提取失败，请稍后重试",
  rehost_failed: "图片中转失败，请稍后重试",
};

export class ResearchApiError extends Error {
  endpoint: ResearchEndpoint;
  status?: number;
  code?: string;
  requestId?: string;
  retryable: boolean;

  constructor(params: {
    endpoint: ResearchEndpoint;
    message: string;
    status?: number;
    code?: string;
    requestId?: string;
    retryable: boolean;
  }) {
    super(params.message);
    this.name = "ResearchApiError";
    this.endpoint = params.endpoint;
    this.status = params.status;
    this.code = params.code;
    this.requestId = params.requestId;
    this.retryable = params.retryable;
  }
}

const isRetryableStatus = (status?: number): boolean => {
  if (!status) return true;
  return [408, 409, 425, 429, 500, 502, 503, 504].includes(status);
};

export const normalizeResearchApiError = (
  endpoint: ResearchEndpoint,
  status: number,
  payload: any,
): ResearchApiError => {
  const code = String(payload?.error || `http_${status}`);
  const mapped = FRIENDLY_ERROR_MAP[code];
  const message = mapped || `${ENDPOINT_LABELS[endpoint]}失败 (${status})`;
  return new ResearchApiError({
    endpoint,
    status,
    code,
    requestId: payload?.requestId,
    message,
    retryable: isRetryableStatus(status),
  });
};

export const normalizeUnknownResearchError = (
  endpoint: ResearchEndpoint,
  error: unknown,
): ResearchApiError => {
  if (error instanceof ResearchApiError) return error;

  const raw =
    error instanceof Error ? error.message : String(error || "unknown_error");
  const mapped = FRIENDLY_ERROR_MAP[raw];
  return new ResearchApiError({
    endpoint,
    code: raw,
    message: mapped || `${ENDPOINT_LABELS[endpoint]}失败，请稍后重试`,
    retryable: true,
  });
};
