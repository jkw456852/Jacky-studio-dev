import test from "node:test";
import assert from "node:assert/strict";

import {
  createAssistantSidebarImageSettingsState,
  diffAssistantSidebarImageSettingsOperations,
  normalizeAssistantSidebarImageSettingsState,
  serializeAssistantSidebarImageSettingsState,
} from "./assistant-sidebar-image-settings-interactable.ts";

test("image settings interactable normalizes defaults", () => {
  const state = normalizeAssistantSidebarImageSettingsState(undefined);

  assert.deepEqual(state, {
    modeEnabled: false,
    autoModelSelect: true,
    modelId: "",
    providerId: null,
    aspectRatio: "1:1",
    resolution: "1K",
    count: 1,
  });
});

test("image settings interactable creates state from runtime config", () => {
  const state = createAssistantSidebarImageSettingsState({
    imageModeEnabled: true,
    imageGenerationUi: {
      autoModelSelect: false,
      setAutoModelSelect: () => {},
      setImageGenRatio: () => {},
      setImageGenRes: () => {},
      setImageGenCount: () => {},
      setPreferredImageModel: () => {},
      setPreferredImageProviderId: () => {},
    },
    runtimeConfig: {
      modelMode: "fast",
      webEnabled: false,
      researchMode: "off",
      imageGenRatio: "16:9",
      imageGenRes: "2K",
      imageGenCount: 3,
      videoGenRatio: "16:9",
      preferredImageModel: "gpt-image-1",
      preferredImageProviderId: "openai",
      activeImageModel: "flux-kontext-pro",
      activeImageProviderId: "bfl",
      preferredVideoModel: "",
      preferredVideoProviderId: null,
      translatePromptToEnglish: false,
      enforceChineseTextInImage: false,
      requiredChineseCopy: "",
    },
  });

  assert.deepEqual(state, {
    modeEnabled: true,
    autoModelSelect: false,
    modelId: "flux-kontext-pro",
    providerId: "bfl",
    aspectRatio: "16:9",
    resolution: "2K",
    count: 3,
  });
});

test("image settings interactable diffs changed fields into sidebar operations", () => {
  const current = normalizeAssistantSidebarImageSettingsState({
    modeEnabled: false,
    autoModelSelect: true,
    modelId: "gpt-image-1",
    providerId: "openai",
    aspectRatio: "1:1",
    resolution: "1K",
    count: 1,
  });
  const next = normalizeAssistantSidebarImageSettingsState({
    modeEnabled: true,
    autoModelSelect: false,
    modelId: "flux-kontext-pro",
    providerId: "bfl",
    aspectRatio: "16:9",
    resolution: "4K",
    count: 4,
  });

  assert.deepEqual(diffAssistantSidebarImageSettingsOperations({ current, next }), [
    { type: "setModeEnabled", value: true },
    { type: "setAutoModelSelect", value: false },
    { type: "setPreferredImageModel", value: "flux-kontext-pro" },
    { type: "setPreferredImageProviderId", value: "bfl" },
    { type: "setImageGenRatio", value: "16:9" },
    { type: "setImageGenRes", value: "4K" },
    { type: "setImageGenCount", value: 4 },
  ]);
});

test("image settings interactable preserves arbitrary positive image counts", () => {
  const state = normalizeAssistantSidebarImageSettingsState({
    count: 128,
  });

  assert.equal(state.count, 128);
});

test("image settings interactable serialization is stable", () => {
  const serialized = serializeAssistantSidebarImageSettingsState(
    normalizeAssistantSidebarImageSettingsState({
      modeEnabled: true,
      autoModelSelect: false,
      modelId: "gpt-image-1",
      providerId: "openai",
      aspectRatio: "3:4",
      resolution: "2K",
      count: 2,
    }),
  );

  assert.equal(serialized, "1|0|gpt-image-1|openai|3:4|2K|2");
});
