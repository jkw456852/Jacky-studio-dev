import {
  assertRegisteredSkillName,
  normalizeRegisteredSkillName,
} from './skill-manifest.ts';

export type SkillHandler = (params: any) => Promise<any> | any;
export type SkillRegistry = Record<string, SkillHandler>;

export const isOneclickSkillName = (skillName: unknown): boolean => {
  const normalized = normalizeRegisteredSkillName(skillName);
  return normalized === 'jkaiOneclick' || normalized === 'xcaiOneclick';
};

export const resolveSkillHandler = (
  registry: SkillRegistry,
  skillName: unknown,
): SkillHandler => {
  const normalized = assertRegisteredSkillName(skillName);
  const handler = registry[normalized];

  if (!handler) {
    throw new Error(`Skill ${normalized} not registered in registry`);
  }

  return handler;
};

export const formatSkillExecutionResult = ({
  skillName,
  result,
  formatJkaiOneclickResultFn,
}: {
  skillName: unknown;
  result: any;
  formatJkaiOneclickResultFn: (result: any) => string;
}): any => {
  if (isOneclickSkillName(skillName)) {
    return formatJkaiOneclickResultFn(result);
  }

  return result;
};
