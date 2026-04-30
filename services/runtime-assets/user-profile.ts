import { getStudioUserAssetApi } from "./api.ts";

export const getUserProfileSummaryLines = (): string[] => {
  const profile = getStudioUserAssetApi().getUserProfile();
  return [
    ...profile.preferenceNotes,
    ...profile.commonTasks.map((item) => `Common task: ${item}`),
    ...profile.aestheticPreferences.map((item) => `Aesthetic preference: ${item}`),
    ...profile.brandContextNotes.map((item) => `Brand context: ${item}`),
    ...profile.memoryNotes.map((item) => `Memory note: ${item}`),
  ].filter(Boolean);
};
