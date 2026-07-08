import { extractTextFromImage } from '../gemini';
import { TextExtractSkillParams } from '../../types/skill.types.ts';
 
export async function textExtractSkill(params: TextExtractSkillParams): Promise<string | null> {
  try {
    const result = await extractTextFromImage(params.imageData);
    return result.length > 0 ? result.map((item) => item.text).join('\n') : null;
  } catch (error) {
    console.error('[textExtractSkill] Failed:', error);
    return null;
  }
}
