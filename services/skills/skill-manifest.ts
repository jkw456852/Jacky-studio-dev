export const REGISTERED_SKILL_NAMES = [
  'generateImage',
  'generateVideo',
  'extractText',
  'analyzeRegion',
  'generateCopy',
  'smartEdit',
  'export',
  'touchEdit',
  'jkaiOneclick',
  'xcaiOneclick',
  'generateModel',
  'analyzeClothingProduct',
  'clothingStudio',
  'clothingStudioWorkflow',
  'analyzeListingProduct',
  'amazonListing',
  'cnDetailPage',
  'ecomAnalyzeProduct',
  'ecomSupplementQuestions',
  'ecomAutofillSupplements',
  'ecomAutofillImageAnalyses',
  'ecomAutofillPlans',
  'ecomAnalyzeImages',
  'ecomGeneratePlans',
  'ecomRewritePrompt',
  'ecomReviewGeneratedResult',
] as const;

export type RegisteredSkillName = (typeof REGISTERED_SKILL_NAMES)[number];

export const SUPPORTED_SKILL_NAMES = new Set<string>(REGISTERED_SKILL_NAMES);

export const SKILL_ALIASES: Record<string, RegisteredSkillName> = {
  imageGenSkill: 'generateImage',
  videoGenSkill: 'generateVideo',
  copyGenSkill: 'generateCopy',
  textExtractSkill: 'extractText',
  regionAnalyzeSkill: 'analyzeRegion',
  smartEditSkill: 'smartEdit',
  exportSkill: 'export',
  touchEditSkill: 'touchEdit',
};

const VISUAL_GENERATION_SKILL_NAMES = new Set<RegisteredSkillName>([
  'generateImage',
  'generateVideo',
]);

const VISUAL_EDIT_SKILL_NAMES = new Set<RegisteredSkillName>([
  'smartEdit',
  'touchEdit',
]);

const VISUAL_REFERENCE_RESOLUTION_SKILL_NAMES = new Set<RegisteredSkillName>([
  'generateImage',
  'generateVideo',
  'smartEdit',
]);

const ASSET_PRODUCING_SKILL_NAMES = new Set<RegisteredSkillName>([
  'generateImage',
  'generateVideo',
  'smartEdit',
  'touchEdit',
]);

export const normalizeRegisteredSkillName = (skillName: unknown): string => {
  const normalized = String(skillName || '').trim();
  return SKILL_ALIASES[normalized] || normalized;
};

export const resolveRegisteredSkillName = (
  skillName: unknown,
): RegisteredSkillName | null => {
  const normalized = normalizeRegisteredSkillName(skillName);
  return SUPPORTED_SKILL_NAMES.has(normalized)
    ? (normalized as RegisteredSkillName)
    : null;
};

export const isRegisteredSkillName = (
  skillName: unknown,
): skillName is RegisteredSkillName => resolveRegisteredSkillName(skillName) !== null;

export const assertRegisteredSkillName = (
  skillName: unknown,
): RegisteredSkillName => {
  const resolved = resolveRegisteredSkillName(skillName);
  if (!resolved) {
    throw new Error(`Skill ${skillName} not found`);
  }
  return resolved;
};

export const isImageGenerationSkillName = (skillName: unknown): boolean =>
  resolveRegisteredSkillName(skillName) === 'generateImage';

export const isVideoGenerationSkillName = (skillName: unknown): boolean =>
  resolveRegisteredSkillName(skillName) === 'generateVideo';

export const isVisualGenerationSkillName = (skillName: unknown): boolean => {
  const resolved = resolveRegisteredSkillName(skillName);
  return !!resolved && VISUAL_GENERATION_SKILL_NAMES.has(resolved);
};

export const isVisualEditSkillName = (skillName: unknown): boolean => {
  const resolved = resolveRegisteredSkillName(skillName);
  return !!resolved && VISUAL_EDIT_SKILL_NAMES.has(resolved);
};

export const isVisualReferenceResolutionSkillName = (
  skillName: unknown,
): boolean => {
  const resolved = resolveRegisteredSkillName(skillName);
  return !!resolved && VISUAL_REFERENCE_RESOLUTION_SKILL_NAMES.has(resolved);
};

export const isAssetProducingSkillName = (skillName: unknown): boolean => {
  const resolved = resolveRegisteredSkillName(skillName);
  return !!resolved && ASSET_PRODUCING_SKILL_NAMES.has(resolved);
};
