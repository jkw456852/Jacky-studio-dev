import { generateJsonResponse, getBestModelId } from './gemini';

type ValidationResult = {
  pass: boolean;
  reasons: string[];
  suggestedFix?: string;
};

export type { ValidationResult };

const toInlinePart = async (url: string, signal?: AbortSignal): Promise<{ inlineData: { mimeType: string; data: string } }> => {
  try {
    if (/^data:image\/.+;base64,/.test(url)) {
      const m = url.match(/^data:([^;]+);base64,(.+)$/);
      if (!m || !m[1] || !m[2]) {
        throw new Error('invalid data url format');
      }
      return { inlineData: { mimeType: m[1], data: m[2] } };
    }

    const res = await fetch(url, { signal });
    if (!res.ok) {
      throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
    }
    
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('image read failed'));
      reader.readAsDataURL(blob);
    });
    
    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m || !m[1] || !m[2]) {
      throw new Error('convert image failed: invalid base64 format');
    }
    
    return { inlineData: { mimeType: m[1], data: m[2] } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to process image data: ${message}`);
  }
};

function parseValidation(text: string): ValidationResult {
  try {
    if (!text || typeof text !== 'string') {
      return {
        pass: false,
        reasons: ['质检响应为空'],
        suggestedFix: '请检查 API 连接或重试',
      };
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return {
        pass: false,
        reasons: ['质检响应为空'],
        suggestedFix: '请检查 API 连接或重试',
      };
    }

    const json = JSON.parse(trimmed);
    return {
      pass: !!json.pass,
      reasons: Array.isArray(json.reasons) ? json.reasons : (json.reasons ? [String(json.reasons)] : []),
      suggestedFix: typeof json.suggestedFix === 'string' ? json.suggestedFix : undefined,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      pass: false,
      reasons: [`质检响应解析失败: ${errorMsg}`],
      suggestedFix: '请在 prompt 中强调一致性并重试',
    };
  }
}

function isMissingInputValidation(result: ValidationResult): boolean {
  if (result.pass) return false;

  const content = [...(result.reasons || []), result.suggestedFix || '']
    .join('；')
    .toLowerCase();

  if (!content) return false;

  return [
    '未提供待检图',
    '待检图信息缺失',
    '锚点图信息缺失',
    '请上传待检图',
    '请上传锚点',
    '无法进行一致性校验',
    'cannot compare',
    'missing anchor',
    'missing candidate',
    'reference image is missing',
  ].some((keyword) => content.includes(keyword));
}

function isInfrastructureValidationIssue(text: string): boolean {
  const content = String(text || '').toLowerCase();
  if (!content) return false;

  return [
    'validation timeout',
    'timeout',
    'rate limited',
    'too many requests',
    '429',
    '502',
    '503',
    '504',
    'bad gateway',
    'failed to fetch',
    'fetch failed',
    'network',
    'cors',
    'unauthorized',
    'forbidden',
    'api error',
  ].some((keyword) => content.includes(keyword));
}

function shouldBypassApprovedAnchorValidation(result: ValidationResult): boolean {
  if (result.pass) return false;
  if (isMissingInputValidation(result)) return true;

  const content = [...(result.reasons || []), result.suggestedFix || ''].join('；');
  return isInfrastructureValidationIssue(content);
}

async function runWithValidationTimeout(
  runner: (signal: AbortSignal) => Promise<ValidationResult>,
  timeoutMs = 90000,
): Promise<ValidationResult> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await new Promise<ValidationResult>((resolve, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error(`validation timeout after ${Math.round(timeoutMs / 1000)}s`));
      }, timeoutMs);

      runner(controller.signal).then(resolve, reject);
    });
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function validateModelIdentity(anchorSheetUrl: string, generatedUrl: string): Promise<ValidationResult> {
  try {
    return await runWithValidationTimeout(async (signal) => {
      const [anchor, generated] = await Promise.all([
        toInlinePart(anchorSheetUrl, signal),
        toInlinePart(generatedUrl, signal),
      ]);
      const result = await generateJsonResponse({
        model: getBestModelId('text'),
        operation: 'validateModelIdentity',
        temperature: 0.1,
        parts: [
          { text: '你是图像一致性质检器。比较两张图人物是否为同一模特，仅返回 JSON: {"pass":boolean,"reasons":string[],"suggestedFix":string}。重点看脸部骨相、五官比例、肤色和发型。' },
          anchor,
          { text: '上面是模特锚点板。' },
          generated,
          { text: '上面是待检图片。若有明显差异则 pass=false，并给出简短修正建议。' },
        ],
      });
      return parseValidation(result.text);
    });
  } catch (error) {
    console.warn('[validateModelIdentity] validation failed:', error);
    const message = error instanceof Error ? error.message : String(error);
    return {
      pass: false,
      reasons: [`模特检查异常: ${message}`],
      suggestedFix: '请重新上传清晰的模特参考图',
    };
  }
}

export async function validateProductConsistency(
  productAnchorUrl: string,
  generatedUrl: string,
  anchorDescription: string,
  forbiddenChanges: string[],
): Promise<ValidationResult> {
  try {
    return await runWithValidationTimeout(async (signal) => {
      const [anchor, generated] = await Promise.all([
        toInlinePart(productAnchorUrl, signal),
        toInlinePart(generatedUrl, signal),
      ]);
      const result = await generateJsonResponse({
        model: getBestModelId('text'),
        operation: 'validateProductConsistency',
        temperature: 0.1,
        parts: [
          {
            text:
              `你是电商服装一致性质检器。比较产品锚点图与待检图，严格判断产品是否一致。\n锚点描述: ${anchorDescription}\n禁止变化: ${forbiddenChanges.join('；')}\n仅返回 JSON: {"pass":boolean,"reasons":string[],"suggestedFix":string}`,
          },
          anchor,
          { text: '上面是产品锚点图。' },
          generated,
          { text: '上面是待检图。若版型、结构线、颜色块、材质纹理有变化则 pass=false。' },
        ],
      });
      return parseValidation(result.text);
    });
  } catch (error) {
    console.warn('[validateProductConsistency] validation failed:', error);
    const message = error instanceof Error ? error.message : String(error);
    return {
      pass: false,
      reasons: [`产品检查异常: ${message}`],
      suggestedFix: '请确保上传的产品参考图清晰可见',
    };
  }
}

// 冷却缓存：同一对图片 30 秒内不重复调用 API
const _anchorValidationCache = new Map<string, { result: ValidationResult; ts: number }>();
const ANCHOR_VALIDATION_COOLDOWN_MS = 30_000;

export async function validateApprovedAnchorConsistency(
  approvedUrl: string,
  candidateUrl: string,
  summaryText: string,
  forbiddenChanges: string[],
  genPrompt?: string,
): Promise<ValidationResult> {
  if (!approvedUrl || !candidateUrl) {
    return { pass: true, reasons: [] };
  }

  // 用 URL 对作为缓存 key（忽略 summaryText 变化，锚点+候选图不变就复用）
  const cacheKey = `${approvedUrl}||${candidateUrl}`;
  const cached = _anchorValidationCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ANCHOR_VALIDATION_COOLDOWN_MS) {
    console.log('[validateApprovedAnchorConsistency] cache hit, skipping API call');
    return cached.result;
  }

  try {
    // Add timeout wrapper to prevent hanging
    const finalResult = await runWithValidationTimeout(async (signal) => {
      const [anchor, generated] = await Promise.all([
        toInlinePart(approvedUrl, signal),
        toInlinePart(candidateUrl, signal),
      ]);
      const promptSection = genPrompt
        ? `\n生图关键词（最高优先级，与参考图冲突时以此为准）: ${genPrompt}`
        : '';
      const result = await generateJsonResponse({
        model: getBestModelId('text'),
        operation: 'validateApprovedAnchorConsistency',
        temperature: 0.1,
        parts: [
          {
            text:
              `你是通用设计一致性质检器。比较已批准锚点图与待检图，判断是否仍属于同一设计连续版本。${promptSection}\n锚点摘要: ${summaryText || '无'}\n禁止变化: ${(forbiddenChanges || []).join('；') || '无'}\n\n重要规则：若提供了生图关键词，则以关键词描述的设计意图为最终基准；参考图仅作辅助参考，当参考图与关键词存在冲突时，以关键词为准判断待检图是否合格。\n仅返回 JSON: {"pass":boolean,"reasons":string[],"suggestedFix":string}`,
          },
          anchor,
          { text: '上面是已批准的设计锚点图（辅助参考）。' },
          generated,
          { text: '上面是待检图。若主体身份、logo位置、关键配色、结构或文案布局明显偏离基准（关键词优先，无关键词则以锚点图为准），则 pass=false。' },
        ],
      });
      const parsed = parseValidation(result.text);
      if (shouldBypassApprovedAnchorValidation(parsed)) {
        return { pass: true, reasons: [] };
      }
      return parsed;
    });
    _anchorValidationCache.set(cacheKey, { result: finalResult, ts: Date.now() });
    return finalResult;
  } catch (error) {
    console.warn('[validateApprovedAnchorConsistency] validation failed:', error);
    const message = error instanceof Error ? error.message : String(error);
    if (isInfrastructureValidationIssue(message)) {
      return { pass: true, reasons: [] };
    }
    return {
      pass: false,
      reasons: [`一致性质检异常: ${message}`],
      suggestedFix: '请重试或检查图片质量',
    };
  }
}
