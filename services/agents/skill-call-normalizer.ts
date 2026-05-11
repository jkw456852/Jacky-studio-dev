import type { AgentTask } from '../../types/agent.types.ts';
import {
  assertRegisteredSkillName,
  normalizeRegisteredSkillName,
  SKILL_ALIASES,
  SUPPORTED_SKILL_NAMES,
} from '../skills/skill-manifest.ts';

export { SKILL_ALIASES, SUPPORTED_SKILL_NAMES };

export const normalizeSkillName = (skillName: unknown): string =>
  normalizeRegisteredSkillName(skillName);

export const parseSkillParamsString = (rawParams: string): Record<string, any> => {
  try {
    let cleanedParams = rawParams.trim();
    const codeBlockMatch = cleanedParams.match(
      /```(?:json)?\s*\n?([\s\S]*?)\n?```/,
    );
    if (codeBlockMatch) {
      cleanedParams = codeBlockMatch[1].trim();
    }
    const parsed = JSON.parse(cleanedParams);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const buildGenerateImageTextPolicy = (textRenderPolicy: unknown) => {
  if (!textRenderPolicy || typeof textRenderPolicy !== 'object') {
    return undefined;
  }

  const policy = textRenderPolicy as {
    enforceChinese?: boolean;
    requiredCopy?: string;
  };

  return {
    enforceChinese: policy.enforceChinese !== false,
    requiredCopy:
      typeof policy.requiredCopy === 'string'
        ? policy.requiredCopy.trim() || undefined
        : undefined,
  };
};

export const normalizeImageReferenceParams = (call: any): any => {
  if (!call?.params || typeof call.params !== 'object') return call;
  const params = call.params as Record<string, any>;

  const aliasRef =
    params.referenceImage ||
    params.referenceImageUrl ||
    params.reference_image_url ||
    params.initImage ||
    params.init_image;

  if (aliasRef && !params.referenceImage) {
    params.referenceImage = aliasRef;
  }

  return { ...call, params };
};

export const normalizeSkillCalls = (skillCalls: any[]) =>
  (skillCalls || []).map((rawCall) => {
    const call = normalizeImageReferenceParams(rawCall);
    call.skillName = normalizeSkillName(call.skillName);
    return call;
  });

export const ensureSkillParamsObject = (call: any) => {
  if (typeof call.params === 'string') {
    call.params = parseSkillParamsString(call.params);
  }

  if (!call.params || typeof call.params !== 'object') {
    call.params = {};
  }

  return call;
};

export const assertSkillExists = (call: any) => {
  call.skillName = assertRegisteredSkillName(call?.skillName);
};

export const injectExecutionPreferences = (call: any, task: AgentTask) => {
  const preferredAspectRatio = task.input.metadata?.preferredAspectRatio;
  const preferredImageModel = task.input.metadata?.preferredImageModel;
  const preferredImageProviderId = task.input.metadata?.preferredImageProviderId;
  const preferredImageSize = task.input.metadata?.preferredImageSize;
  const creationMode = task.input.metadata?.creationMode;
  const promptLanguagePolicy =
    task.input.metadata?.promptLanguagePolicy === 'translate-en'
      ? 'translate-en'
      : 'original-zh';
  const textRenderPolicy = task.input.metadata?.textRenderPolicy;

  if (
    typeof preferredAspectRatio === 'string' &&
    preferredAspectRatio &&
    ((creationMode === 'image' && call.skillName === 'generateImage') ||
      (creationMode === 'video' && call.skillName === 'generateVideo'))
  ) {
    call.params = call.params || {};
    call.params.aspectRatio = preferredAspectRatio;
  }

  if (call.skillName === 'generateImage') {
    call.params = call.params || {};

    if (
      typeof preferredImageModel === 'string' &&
      preferredImageModel.trim() &&
      !call.params.model
    ) {
      call.params.model = preferredImageModel.trim();
    }

    if (
      typeof preferredImageProviderId === 'string' &&
      preferredImageProviderId.trim() &&
      !call.params.providerId
    ) {
      call.params.providerId = preferredImageProviderId.trim();
    }

    if (
      typeof preferredImageSize === 'string' &&
      preferredImageSize &&
      !call.params.imageSize
    ) {
      call.params.imageSize = preferredImageSize;
    }

    if (!call.params.promptLanguagePolicy) {
      call.params.promptLanguagePolicy = promptLanguagePolicy;
    }
    if (!call.params.textPolicy) {
      const imageTextPolicy = buildGenerateImageTextPolicy(textRenderPolicy);
      if (imageTextPolicy) {
        call.params.textPolicy = imageTextPolicy;
      }
    }
  }

  return call;
};
