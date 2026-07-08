export interface StructuredCopyGenSkillParams {
  copyType?: 'headline' | 'tagline' | 'body' | 'slogan' | 'description';
  brandName?: string;
  product?: string;
  targetAudience?: string;
  tone?: 'professional' | 'casual' | 'playful' | 'luxury' | 'urgent';
  keyMessage?: string;
  maxLength?: number;
  variations?: number;
}

export interface PromptCopyGenSkillParams {
  prompt?: string;
  systemPrompt?: string;
  outputMode?: 'json-array' | 'markdown' | 'plain-text';
  variationCount?: number;
}

export type CopyGenSkillParams = StructuredCopyGenSkillParams & PromptCopyGenSkillParams;

export const normalizeCopyText = (value: unknown) => String(value || '').trim();

export const buildStructuredCopyPrompt = (params: CopyGenSkillParams) => {
  const copyType = normalizeCopyText(params.copyType || 'headline');
  const brandName = normalizeCopyText(params.brandName || 'Unknown Brand');
  const product = normalizeCopyText(params.product || 'Unknown Product');
  const targetAudience = normalizeCopyText(params.targetAudience || 'General audience');
  const tone = normalizeCopyText(params.tone || 'professional');
  const keyMessage = normalizeCopyText(
    params.keyMessage || 'Highlight the core value clearly.',
  );
  const maxLength = Number.isFinite(Number(params.maxLength))
    ? Math.max(1, Math.floor(Number(params.maxLength)))
    : null;
  const variations = Number.isFinite(Number(params.variations))
    ? Math.max(1, Math.min(8, Math.floor(Number(params.variations))))
    : 3;

  return [
    `Generate ${variations} ${copyType} variations for:`,
    `Brand: ${brandName}`,
    `Product: ${product}`,
    `Audience: ${targetAudience}`,
    `Tone: ${tone}`,
    `Key Message: ${keyMessage}`,
    maxLength ? `Max Length: ${maxLength} characters` : '',
    '',
    'Return only the text variations as a JSON array of strings.',
  ]
    .filter(Boolean)
    .join('\n');
};

export const buildPromptModeCopyPrompt = (params: CopyGenSkillParams) => {
  const prompt = normalizeCopyText(params.prompt);
  const outputMode =
    normalizeCopyText(params.outputMode || 'json-array') === 'markdown'
      ? 'markdown'
      : normalizeCopyText(params.outputMode || 'json-array') === 'plain-text'
        ? 'plain-text'
        : 'json-array';
  const variationCount = Number.isFinite(
    Number(params.variationCount || params.variations),
  )
    ? Math.max(
        1,
        Math.min(8, Math.floor(Number(params.variationCount || params.variations))),
      )
    : 3;

  const formatInstruction =
    outputMode === 'markdown'
      ? 'Return the result in concise markdown.'
      : outputMode === 'plain-text'
        ? 'Return the result as plain text.'
        : 'Return only a JSON array of strings.';

  return [
    prompt,
    '',
    `Generate ${variationCount} high-signal planning or copy outputs unless the prompt explicitly requests a single final answer.`,
    formatInstruction,
  ]
    .filter(Boolean)
    .join('\n');
};

export const isPromptModeCopyRequest = (params: CopyGenSkillParams) =>
  normalizeCopyText(params.prompt).length > 0;

export const parseCopyResultByMode = (rawText: string, outputMode: string) => {
  if (outputMode === 'markdown' || outputMode === 'plain-text') {
    return rawText.trim();
  }

  try {
    const parsed = JSON.parse(rawText || '[]');
    if (Array.isArray(parsed)) {
      return parsed.map((item) => normalizeCopyText(item)).filter(Boolean);
    }
  } catch {
  }

  const fallback = rawText
    .split('\n')
    .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean);
  return fallback;
};
