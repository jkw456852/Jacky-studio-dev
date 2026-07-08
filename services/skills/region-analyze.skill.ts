import { analyzeImageRegion } from '../gemini';
import { RegionAnalyzeSkillParams } from '../../types/skill.types.ts';

export async function regionAnalyzeSkill(params: RegionAnalyzeSkillParams): Promise<string | null> {
  try {
    const result = await analyzeImageRegion(params.imageData);
    return result;
  } catch (error) {
    console.error('[regionAnalyzeSkill] Failed:', error);
    return null;
  }
}
