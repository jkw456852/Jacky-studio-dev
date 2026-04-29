import { imageGenSkill } from './image-gen.skill';
import { videoGenSkill } from './video-gen.skill';
import { textExtractSkill } from './text-extract.skill';
import { regionAnalyzeSkill } from './region-analyze.skill';
import { copyGenSkill } from './copy-gen.skill';
import { smartEditSkill } from './smart-edit.skill';
import { exportSkill } from './export.skill';
import { touchEditSkill } from './touch-edit.skill';
import { runXcAiOneclick, formatXcaiOneclickResult } from './xcai-oneclick.skill';
import { generateModelSkill } from './generate-model.skill';
import { analyzeClothingProductSkill } from './analyze-clothing-product.skill';
import { clothingStudioSkill } from './clothing-studio.skill';
import { clothingStudioWorkflowSkill } from './clothing-studio-workflow.skill';
import { analyzeListingProductSkill } from './analyze-listing-product.skill';
import { amazonListingSkill } from './amazon-listing.skill';
import { cnDetailPageSkill } from './cn-detail-page.skill';
import {
  ecomAutofillSupplementsSkill,
  ecomAutofillImageAnalysesSkill,
  ecomAutofillPlansSkill,
  ecomAnalyzeImagesSkill,
  ecomAnalyzeProductSkill,
  ecomGeneratePlansSkill,
  ecomReviewGeneratedResultSkill,
  ecomRewritePromptSkill,
  ecomSupplementQuestionsSkill,
} from './ecom-oneclick-workflow.skill';

export { imageGenSkill, videoGenSkill, textExtractSkill, regionAnalyzeSkill, copyGenSkill, smartEditSkill, exportSkill, touchEditSkill, runXcAiOneclick, generateModelSkill, analyzeClothingProductSkill, clothingStudioSkill, clothingStudioWorkflowSkill, analyzeListingProductSkill, amazonListingSkill, cnDetailPageSkill, ecomAnalyzeProductSkill, ecomSupplementQuestionsSkill, ecomAutofillSupplementsSkill, ecomAutofillImageAnalysesSkill, ecomAutofillPlansSkill, ecomAnalyzeImagesSkill, ecomGeneratePlansSkill, ecomRewritePromptSkill, ecomReviewGeneratedResultSkill };

export const AVAILABLE_SKILLS = {
  generateImage: imageGenSkill,
  generateVideo: videoGenSkill,
  extractText: textExtractSkill,
  analyzeRegion: regionAnalyzeSkill,
  generateCopy: copyGenSkill,
  smartEdit: smartEditSkill,
  export: exportSkill,
  touchEdit: touchEditSkill,
  xcaiOneclick: runXcAiOneclick,
  generateModel: generateModelSkill,
  analyzeClothingProduct: analyzeClothingProductSkill,
  clothingStudio: clothingStudioSkill,
  clothingStudioWorkflow: clothingStudioWorkflowSkill,
  analyzeListingProduct: analyzeListingProductSkill,
  amazonListing: amazonListingSkill,
  cnDetailPage: cnDetailPageSkill,
  ecomAnalyzeProduct: ecomAnalyzeProductSkill,
  ecomSupplementQuestions: ecomSupplementQuestionsSkill,
  ecomAutofillSupplements: ecomAutofillSupplementsSkill,
  ecomAutofillImageAnalyses: ecomAutofillImageAnalysesSkill,
  ecomAutofillPlans: ecomAutofillPlansSkill,
  ecomAnalyzeImages: ecomAnalyzeImagesSkill,
  ecomGeneratePlans: ecomGeneratePlansSkill,
  ecomRewritePrompt: ecomRewritePromptSkill,
  ecomReviewGeneratedResult: ecomReviewGeneratedResultSkill,
};

export async function executeSkill(skillName: string, params: any): Promise<any> {
  const skill = AVAILABLE_SKILLS[skillName as keyof typeof AVAILABLE_SKILLS];
  if (!skill) {
    throw new Error(`Skill ${skillName} not found`);
  }
  const result = await skill(params);

  if (skillName === 'xcaiOneclick') {
    return formatXcaiOneclickResult(result as any);
  }

  return result;
}
