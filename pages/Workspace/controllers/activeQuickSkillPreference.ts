import type { ChatMessage } from "../../../types/index.ts";
import {
  getActiveQuickSkillPreference,
  setActiveQuickSkillPreference,
  SKILL_PREFERENCES_UPDATED_EVENT,
} from "../../../services/runtime-assets/preferences.ts";

type SkillData = ChatMessage["skillData"];
type SetSendSkill = ((skill: SkillData | null) => void) | undefined;

const canUseWindow = (): boolean => typeof window !== "undefined";

export const readActiveQuickSkillPreference = (): SkillData | null =>
  getActiveQuickSkillPreference();

export const clearActiveQuickSkillPreference = (): void => {
  setActiveQuickSkillPreference(null);
};

// High-level adapter: keep active-quick-skill preference updates in one place
// so legacy workflow surfaces cannot each invent their own persisted shape.
export const applyActiveQuickSkill = (
  skill: SkillData,
  setSendSkill?: SetSendSkill,
): void => {
  setSendSkill?.(skill);
  setActiveQuickSkillPreference(skill);
};

export const clearActiveQuickSkill = (setSendSkill?: SetSendSkill): void => {
  setSendSkill?.(null);
  setActiveQuickSkillPreference(null);
};

export const subscribeSkillPreferencesUpdated = (
  listener: EventListener,
): (() => void) => {
  if (!canUseWindow()) {
    return () => {};
  }

  window.addEventListener(SKILL_PREFERENCES_UPDATED_EVENT, listener);
  return () => {
    window.removeEventListener(SKILL_PREFERENCES_UPDATED_EVENT, listener);
  };
};
