export const ACTIVE_SKILL_EDIT_EVENT = "workspace:edit-active-skill";
export const ACTIVE_SKILL_VIEW_AUDIT_EVENT = "workspace:view-active-skill-audit";

const canUseWindow = (): boolean => typeof window !== "undefined";

const dispatchWindowEvent = (eventName: string): void => {
  if (!canUseWindow()) return;
  window.dispatchEvent(new CustomEvent(eventName));
};

const subscribeWindowEvent = (
  eventName: string,
  listener: EventListener,
): (() => void) => {
  if (!canUseWindow()) {
    return () => {};
  }

  window.addEventListener(eventName, listener);
  return () => {
    window.removeEventListener(eventName, listener);
  };
};

export const dispatchActiveSkillEditEvent = (): void => {
  dispatchWindowEvent(ACTIVE_SKILL_EDIT_EVENT);
};

export const dispatchActiveSkillViewAuditEvent = (): void => {
  dispatchWindowEvent(ACTIVE_SKILL_VIEW_AUDIT_EVENT);
};

export const subscribeActiveSkillEditEvent = (
  listener: EventListener,
): (() => void) => subscribeWindowEvent(ACTIVE_SKILL_EDIT_EVENT, listener);

export const subscribeActiveSkillViewAuditEvent = (
  listener: EventListener,
): (() => void) => subscribeWindowEvent(ACTIVE_SKILL_VIEW_AUDIT_EVENT, listener);
