import assert from "node:assert/strict";
import test from "node:test";
import {
  getStudioUserAssetApi,
  setStudioUserAssetApi,
} from "./api.ts";
import { createLocalStudioUserAssetApi } from "./local-user-assets.ts";
import {
  recordCustomSkillSuccessfulRun,
  removeCustomSkillPreference,
  upsertCustomSkillPreference,
} from "./preferences.ts";

const originalFetch = globalThis.fetch;

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

const withMockWindow = async <T,>(
  storage: Storage,
  run: () => T | Promise<T>,
): Promise<T> => {
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: storage },
    configurable: true,
  });
  try {
    return await run();
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

const withLocalAssetApi = (
  run: (api: ReturnType<typeof createLocalStudioUserAssetApi>) => void | Promise<void>,
) =>
  {
  const storage = createStorageMock();
  return withMockWindow(storage, async () => {
    const originalApi = getStudioUserAssetApi();
    const api = createLocalStudioUserAssetApi();
    setStudioUserAssetApi(api);
    try {
      await run(api);
    } finally {
      setStudioUserAssetApi(originalApi);
      globalThis.fetch = originalFetch;
    }
  });
};

test("recordCustomSkillSuccessfulRun writes latest successful prompt and summary back to custom skill config", async () => {
  await withLocalAssetApi(async () => {
    const skillId = `custom-skill-test-${Date.now()}`;

    upsertCustomSkillPreference({
      id: skillId,
      name: "Test Skill",
      config: {
        isCustomSkill: true,
        summary: "Initial summary",
      },
    });

    await recordCustomSkillSuccessfulRun({
      skill: {
        id: skillId,
        name: "Test Skill",
        iconName: "Sparkles",
        config: {
          isCustomSkill: true,
          mode: "unified-sidebar-agent",
        },
      },
      prompt: "Create a new premium skincare KV.",
      summary: "Aligned tone first, then output the KV plan.",
      outputText: "Generated a reusable KV workflow.",
    });

    const snapshot = getStudioUserAssetApi().getSkillPreferences();
    const config = snapshot.customSkillConfigs?.[skillId] as Record<string, unknown>;

    assert.equal(String(config.lastSuccessfulPrompt || ""), "Create a new premium skincare KV.");
    assert.equal(
      String(config.lastSuccessfulSummary || ""),
      "Aligned tone first, then output the KV plan.",
    );
    assert.equal(
      String(config.lastSuccessfulOutput || ""),
      "Generated a reusable KV workflow.",
    );
    assert.equal(Number(config.successfulRuns || 0) >= 1, true);
  });
});

test("custom skill names are sanitized before becoming stored labels", async () => {
  await withLocalAssetApi(async () => {
    const skillId = `custom-skill-dirty-${Date.now()}`;

    upsertCustomSkillPreference({
      id: skillId,
      name: "Social Media Skill will clarify first",
      config: {
        isCustomSkill: true,
        summary: "Sanitize display name",
      },
    });

    const config = getStudioUserAssetApi().getSkillPreferences().customSkillConfigs?.[
      skillId
    ] as Record<string, unknown>;

    assert.equal(String(config?.name || ""), "Social Media");
  });
});

test("recordCustomSkillSuccessfulRun seeds runtime memory for file-backed custom skills without existing preference entry", async () => {
  await withLocalAssetApi(async () => {
    const skillId = `custom-skill-file-only-${Date.now()}`;
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ url: String(input), init });
      return new Response(
        JSON.stringify({
          item: {
            id: skillId,
            name: "File Skill",
            description: "Base file summary",
            iconName: "Sparkles",
            activationHint: "",
            routeIntent: "general",
            routeLabel: "Custom Skill",
            routeSummary: "",
            preferredSkills: [],
            suggestedTaskMode: "generate",
            followUpMode: "direct-run",
            allowAutonomousRouting: true,
            mode: "unified-sidebar-agent",
            clarifyChecklist: [],
            reusableQuestions: [],
            executionOutline: [],
            executionRecipe: [],
            outputBlueprint: [],
            toolPolicy: [],
            instruction: "",
            examplePrompt: "Turn this blog post into a carousel.",
            sourceConversationTitle: null,
            sourceUserPrompt: "",
            distilledFromConversation: false,
            tags: [],
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }) as typeof fetch;

    await recordCustomSkillSuccessfulRun({
      skill: {
        id: skillId,
        name: "File Skill",
        iconName: "Sparkles",
        config: {
          isCustomSkill: true,
          mode: "unified-sidebar-agent",
          markdownAssetId: skillId,
          summary: "Base file summary",
        },
      },
      prompt: "Turn this blog post into a carousel.",
      summary: "First distilled the hook, then structured the slides.",
      outputText: "Generated a reusable carousel workflow.",
    });

    const config = getStudioUserAssetApi().getSkillPreferences().customSkillConfigs?.[
      skillId
    ] as Record<string, unknown>;

    assert.equal(String(config?.name || ""), "File Skill");
    assert.equal(String(config?.markdownAssetId || ""), skillId);
    assert.equal(
      String(config?.lastSuccessfulPrompt || ""),
      "Turn this blog post into a carousel.",
    );
    assert.equal(Number(config?.successfulRuns || 0), 1);
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0]?.init?.method, "PATCH");
    assert.equal(fetchCalls[0]?.url, `/api/custom-skills/${encodeURIComponent(skillId)}`);
    const body = JSON.parse(String(fetchCalls[0]?.init?.body || "{}"));
    assert.equal(String(body?.patch?.lastSuccessfulPrompt || ""), "Turn this blog post into a carousel.");
    assert.equal(Number(body?.patch?.successfulRuns || 0), 1);
  });
});

test("removeCustomSkillPreference clears custom skill catalog metadata", async () => {
  await withLocalAssetApi(async () => {
    const skillId = `custom-skill-remove-${Date.now()}`;

    upsertCustomSkillPreference({
      id: skillId,
      name: "Skill To Remove",
      config: {
        isCustomSkill: true,
        markdownAssetId: skillId,
        summary: "Will be removed",
      },
    });

    removeCustomSkillPreference(skillId);

    const snapshot = getStudioUserAssetApi().getSkillPreferences();
    assert.equal(snapshot.customSkillConfigs?.[skillId], undefined);
    assert.equal(snapshot.recentSkillIds?.includes(skillId), false);
    assert.equal(snapshot.pinnedSkillIds?.includes(skillId), false);
  });
});

test("recordCustomSkillSuccessfulRun writes runtime memory for built-in frontstage skills", async () => {
  await withLocalAssetApi(async () => {
    const skillId = "autonomous-brand-system";

    await recordCustomSkillSuccessfulRun({
      skill: {
        id: "autonomous-main-brain",
        name: "品牌视觉",
        iconName: "Lightbulb",
        config: {
          allowAutonomousRouting: true,
          mode: "unified-sidebar-agent",
          frontstageSkillId: skillId,
          routeIntent: "branding",
          routeLabel: "Branding",
        },
      },
      prompt: "做一版新的高端护肤品牌 KV。",
      summary: "先统一品牌调性和受众，再给 KV 方向与执行顺序。",
      outputText: "先输出品牌支柱，再输出 KV 主张与素材需求。",
    });

    const snapshot = getStudioUserAssetApi().getSkillPreferences();
    const config = snapshot.frontstageSkillRuntimeConfigs?.[skillId] as
      | Record<string, unknown>
      | undefined;

    assert.equal(String(config?.name || ""), "品牌视觉");
    assert.equal(String(config?.lastSuccessfulPrompt || ""), "做一版新的高端护肤品牌 KV。");
    assert.equal(
      String(config?.lastSuccessfulSummary || ""),
      "先统一品牌调性和受众，再给 KV 方向与执行顺序。",
    );
    assert.equal(Number(config?.successfulRuns || 0), 1);
  });
});
