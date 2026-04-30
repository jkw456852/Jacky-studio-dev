import { getStudioUserAssetApi } from "./api.ts";
import {
  DEFAULT_MAIN_BRAIN_PREFERENCES,
  normalizeMainBrainPreferences,
} from "./main-brain-shared.ts";

export { normalizeMainBrainPreferences } from "./main-brain-shared.ts";

export const getDefaultMainBrainPreferences = (): string[] => [
  ...DEFAULT_MAIN_BRAIN_PREFERENCES,
];

export const getMainBrainPreferenceLines = (): string[] => {
  const userLines = getStudioUserAssetApi().getMainBrainPreferences();
  const merged = [...DEFAULT_MAIN_BRAIN_PREFERENCES, ...userLines];
  return merged.filter(
    (item, index) => item && merged.findIndex((entry) => entry === item) === index,
  );
};

export const getMainBrainPreferenceBlock = (): string => {
  const lines = getMainBrainPreferenceLines();
  if (lines.length === 0) return "";
  return [
    "# User Main Brain Preferences",
    "- The following long-term working preferences come from the user's durable main-brain settings.",
    "- Treat them as active behavior constraints across routing, planning, refactoring, and execution unless they conflict with safety or tool requirements.",
    ...lines.map((item) => `- ${item}`),
  ].join("\n");
};
