import { imageGenSkill } from './image-gen.skill';
import { videoGenSkill } from './video-gen.skill';
import { textExtractSkill } from './text-extract.skill';
import { regionAnalyzeSkill } from './region-analyze.skill';
import { copyGenSkill } from './copy-gen.skill';
import { smartEditSkill } from './smart-edit.skill';
import { exportSkill } from './export.skill';
import { touchEditSkill } from './touch-edit.skill';
import { workspaceSearchSkill } from './workspace-search.skill';
import { runJkAiOneclick, formatJkaiOneclickResult } from './xcai-oneclick.skill';
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
import { REGISTERED_SKILL_NAMES } from './skill-manifest.ts';
import { formatSkillExecutionResult, resolveSkillHandler } from './skill-runtime.ts';
import {
  isAssetProducingSkillName,
  isVideoGenerationSkillName,
} from './skill-manifest.ts';

export { imageGenSkill, videoGenSkill, textExtractSkill, regionAnalyzeSkill, copyGenSkill, smartEditSkill, exportSkill, touchEditSkill, workspaceSearchSkill, runJkAiOneclick, generateModelSkill, analyzeClothingProductSkill, clothingStudioSkill, clothingStudioWorkflowSkill, analyzeListingProductSkill, amazonListingSkill, cnDetailPageSkill, ecomAnalyzeProductSkill, ecomSupplementQuestionsSkill, ecomAutofillSupplementsSkill, ecomAutofillImageAnalysesSkill, ecomAutofillPlansSkill, ecomAnalyzeImagesSkill, ecomGeneratePlansSkill, ecomRewritePromptSkill, ecomReviewGeneratedResultSkill };

export const AVAILABLE_SKILLS = {
  generateImage: imageGenSkill,
  generateVideo: videoGenSkill,
  extractText: textExtractSkill,
  analyzeRegion: regionAnalyzeSkill,
  generateCopy: copyGenSkill,
  smartEdit: smartEditSkill,
  export: exportSkill,
  touchEdit: touchEditSkill,
  workspaceSearch: workspaceSearchSkill,
  jkaiOneclick: runJkAiOneclick,
  xcaiOneclick: runJkAiOneclick,
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
} satisfies Record<(typeof REGISTERED_SKILL_NAMES)[number], (params: any) => any>;

export async function executeSkill(skillName: string, params: any): Promise<any> {
  const skill = resolveSkillHandler(AVAILABLE_SKILLS, skillName);
  const result = await skill(params);
  const normalizedSkillName = skillName;
  if (
    isAssetProducingSkillName(normalizedSkillName) &&
    (result === null || result === undefined || result === '')
  ) {
    throw new Error(
      `${normalizedSkillName} completed without producing a ${
        isVideoGenerationSkillName(normalizedSkillName) ? 'video' : 'image'
      } result`,
    );
  }

  return formatSkillExecutionResult({
    skillName,
    result,
    formatJkaiOneclickResultFn: formatJkaiOneclickResult,
  });
}
