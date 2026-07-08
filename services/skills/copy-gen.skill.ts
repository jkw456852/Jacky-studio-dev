import { getClient } from '../gemini';
import {
  buildPromptModeCopyPrompt,
  buildStructuredCopyPrompt,
  isPromptModeCopyRequest,
  normalizeCopyText,
  parseCopyResultByMode,
  type CopyGenSkillParams,
} from './copy-gen.shared.ts';

export async function copyGenSkill(params: CopyGenSkillParams): Promise<string[] | string> {
  const promptMode = isPromptModeCopyRequest(params);
  const outputMode =
    promptMode && normalizeCopyText(params.outputMode)
      ? normalizeCopyText(params.outputMode)
      : 'json-array';

  const prompt = promptMode
    ? buildPromptModeCopyPrompt(params)
    : buildStructuredCopyPrompt(params);
  const systemPrompt = normalizeCopyText(params.systemPrompt);

  try {
    const response = await getClient().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          ...(systemPrompt ? [{ text: `[System Instruction]\n${systemPrompt}` }] : []),
          { text: prompt },
        ],
      },
      config: {
        temperature: promptMode ? 0.5 : 0.9,
        ...(outputMode === 'json-array'
          ? { responseMimeType: 'application/json' as const }
          : {}),
      },
    });

    return parseCopyResultByMode(response.text || '', outputMode);
  } catch (error) {
    console.error('Copy generation error:', error);
    return outputMode === 'json-array' ? [] : '';
  }
}
