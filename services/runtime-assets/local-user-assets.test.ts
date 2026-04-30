import assert from "node:assert/strict";
import test from "node:test";
import { createLocalStudioUserAssetApi } from "./local-user-assets.ts";

const createStorageMock = (): Storage => {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
};

const withMockWindow = (storage: Storage, run: () => void) => {
  storage.setItem("debug_model_mapping_writes", "off");
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: storage },
    configurable: true,
  });
  try {
    run();
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        configurable: true,
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).window;
    }
  }
};

test("local asset api writes audit checkpoints and can replace snapshot", () => {
  const storage = createStorageMock();
  withMockWindow(storage, () => {
    const api = createLocalStudioUserAssetApi();
    api.setWorkspacePreferences({
      selectedImageModels: ["first-model"],
    });

    const firstAudit = api.listAuditEntries();
    assert.equal(firstAudit.length > 0, true);
    assert.equal(firstAudit[0]?.targetKind, "workspace-preference");

    const snapshot = api.getSnapshot();
    snapshot.mainBrainPreferences.lines = ["brain-a", "brain-b"];
    api.replaceSnapshot(snapshot, {
      audit: {
        action: "update",
        targetKind: "workspace-preference",
        summary: "Applied test snapshot.",
      },
    });

    assert.deepEqual(api.getMainBrainPreferences(), ["brain-a", "brain-b"]);
    assert.equal(api.listAuditEntries()[0]?.summary, "Applied test snapshot.");
  });
});

test("local asset api migrates legacy workspace and quick-skill keys into unified snapshot", () => {
  const storage = createStorageMock();
  storage.setItem("setting_image_models", JSON.stringify(["legacy-image-model"]));
  storage.setItem(
    "workspace_active_quick_skill",
    JSON.stringify({
      id: "legacy-skill",
      name: "Legacy Skill",
      iconName: "Sparkles",
    }),
  );

  withMockWindow(storage, () => {
    const api = createLocalStudioUserAssetApi();
    const snapshot = api.getSnapshot();
    assert.deepEqual(snapshot.workspacePreferences.selectedImageModels, [
      "legacy-image-model",
    ]);
    assert.equal(snapshot.skillPreferences.activeQuickSkill?.id, "legacy-skill");

    const rawUnified = storage.getItem("studio_user_assets_v1");
    assert.equal(Boolean(rawUnified), true);
    assert.equal(Boolean(storage.getItem("workspace_active_quick_skill")), true);
  });
});

test("local asset api can rollback to previous audit checkpoint", () => {
  const storage = createStorageMock();
  withMockWindow(storage, () => {
    const api = createLocalStudioUserAssetApi();
    api.setWorkspacePreferences({
      selectedImageModels: ["first-model"],
    });
    const baselineAuditId = api.listAuditEntries()[0]?.id || "";

    api.setWorkspacePreferences({
      selectedImageModels: ["second-model"],
    });
    assert.deepEqual(api.getWorkspacePreferences().selectedImageModels, [
      "second-model",
    ]);

    api.rollbackToAuditEntry(baselineAuditId);
    assert.deepEqual(api.getWorkspacePreferences().selectedImageModels, [
      "first-model",
    ]);
  });
});
