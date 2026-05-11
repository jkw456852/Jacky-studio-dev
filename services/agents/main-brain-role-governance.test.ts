import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyMainBrainRoleGovernanceAudit,
  finalizeRoleGovernancePlan,
} from './main-brain-role-governance.ts';
import { getStudioUserAssetApi, setStudioUserAssetApi } from '../runtime-assets/api.ts';
import { createLocalStudioUserAssetApi } from '../runtime-assets/local-user-assets.ts';

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

const withMockWindow = <T,>(storage: Storage, run: () => T): T => {
  storage.setItem('debug_model_mapping_writes', 'off');
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: storage },
    configurable: true,
  });
  try {
    return run();
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', {
        value: originalWindow,
        configurable: true,
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).window;
    }
  }
};

const withLocalAssetApi = (run: (api: ReturnType<typeof createLocalStudioUserAssetApi>) => void) => {
  const storage = createStorageMock();
  withMockWindow(storage, () => {
    const originalApi = getStudioUserAssetApi();
    const api = createLocalStudioUserAssetApi();
    setStudioUserAssetApi(api);
    try {
      run(api);
    } finally {
      setStudioUserAssetApi(originalApi);
    }
  });
};

const createTask = (metadata: Record<string, unknown> = {}) =>
  ({
    id: 'task-main-brain-role-governance',
    agentId: 'coco',
    status: 'completed',
    input: {
      message: '请根据本轮分析调整角色策略',
      context: {},
      metadata,
    },
    createdAt: 1,
    updatedAt: 1,
  }) as any;

test('applyMainBrainRoleGovernanceAudit auto-promotes draft when governance allows it', () => {
  withLocalAssetApi((api) => {
    const audit = applyMainBrainRoleGovernanceAudit({
      task: createTask({
        roleGovernanceMode: 'auto_manage',
        allowMainBrainRolePromotion: true,
        baseAgentId: 'coco',
        topicId: 'topic-1',
      }),
      finalPlan: {
        roleDraft: {
          title: '新品转化专家',
          summary: '面向新品图文和投放策略的长期角色',
          instructions: ['先做结构化拆解', '再给转化优化建议'],
        },
        roleGovernanceAudit: {
          summary: '建议沉淀为正式角色',
          actions: [
            {
              action: 'draft_create',
              reason: '需要先固化候选草案',
            },
            {
              action: 'promote',
              reason: '该能力已稳定，可升级为长期角色',
              requiresHumanApproval: false,
            },
          ],
        },
      },
    });

    const roles = api.listRoles();
    assert.equal(roles.length, 1);
    assert.equal(roles[0]?.title, '新品转化专家');
    assert.equal(roles[0]?.status, 'active');
    assert.equal(roles[0]?.source, 'promoted');
    assert.equal(
      roles[0]?.promptLayers.durableRoleAddon.includes('先做结构化拆解'),
      true,
    );

    const draft = Object.values(api.getSnapshot().temporaryRoleDrafts)[0];
    assert.equal(Boolean(draft?.id), true);
    assert.equal(draft?.promotedRoleId, roles[0]?.id);
    assert.equal(draft?.promotionSuggested, false);
    assert.equal((audit?.summary || '').includes('已自动升级为长期角色'), true);
  });
});

test('applyMainBrainRoleGovernanceAudit keeps promotion as audit-only when permission is insufficient', () => {
  withLocalAssetApi((api) => {
    const audit = applyMainBrainRoleGovernanceAudit({
      task: createTask({
        roleGovernanceMode: 'approval_required',
        allowMainBrainRolePromotion: false,
        baseAgentId: 'coco',
        topicId: 'topic-2',
      }),
      finalPlan: {
        roleDraft: {
          title: '待审批角色草案',
          summary: '需要审批后才能升级',
          instructions: ['先记录结论'],
        },
        roleGovernanceAudit: {
          summary: '建议先保留草案',
          actions: [
            {
              action: 'draft_create',
              reason: '允许先落临时草案',
            },
            {
              action: 'promote',
              reason: '升级正式角色需要人工确认',
              requiresHumanApproval: true,
            },
          ],
        },
      },
    });

    assert.equal(api.listRoles().length, 0);
    assert.equal(Object.values(api.getSnapshot().temporaryRoleDrafts).length, 1);
    assert.equal((audit?.summary || '').includes('仅保留审计建议'), true);
  });
});

test('applyMainBrainRoleGovernanceAudit auto-archives role when mutation permission is enabled', () => {
  withLocalAssetApi((api) => {
    const role = api.saveRole({
      title: '待归档角色',
      summary: '已有替代方案',
      baseAgentId: 'coco',
      status: 'active',
      source: 'user',
    });

    const audit = applyMainBrainRoleGovernanceAudit({
      task: createTask({
        roleGovernanceMode: 'auto_manage',
        allowMainBrainRoleMutation: true,
        selectedRoleId: role?.id,
        baseAgentId: 'coco',
      }),
      finalPlan: {
        roleGovernanceAudit: {
          summary: '旧角色可以归档',
          actions: [
            {
              action: 'archive',
              targetRoleId: role?.id,
              reason: '已有更新版本可替代',
              requiresHumanApproval: false,
            },
          ],
        },
      },
    });

    assert.equal(api.getRoleById(role?.id || '')?.status, 'archived');
    assert.equal((audit?.summary || '').includes(`已自动归档角色 ${role?.id}`), true);
  });
});

test('applyMainBrainRoleGovernanceAudit keeps archive as suggestion when mutation permission is disabled', () => {
  withLocalAssetApi((api) => {
    const role = api.saveRole({
      title: '保留中的角色',
      summary: '当前仍需人工判断',
      baseAgentId: 'coco',
      status: 'active',
      source: 'user',
    });

    const audit = applyMainBrainRoleGovernanceAudit({
      task: createTask({
        roleGovernanceMode: 'auto_manage',
        allowMainBrainRoleMutation: false,
        selectedRoleId: role?.id,
        baseAgentId: 'coco',
      }),
      finalPlan: {
        roleGovernanceAudit: {
          summary: '记录归档建议',
          actions: [
            {
              action: 'archive',
              targetRoleId: role?.id,
              reason: '暂时只记录建议',
              requiresHumanApproval: false,
            },
          ],
        },
      },
    });

    assert.equal(api.getRoleById(role?.id || '')?.status, 'active');
    assert.equal((audit?.summary || '').includes('仅记录为建议，未自动执行'), true);
  });
});

test('applyMainBrainRoleGovernanceAudit auto-updates durable prompt addon when mutation permission is enabled', () => {
  withLocalAssetApi((api) => {
    const promptAddonText =
      '输出方案前先做结构化拆解，再明确版式层级、主视觉节奏、CTA 和风险检查。';

    const audit = applyMainBrainRoleGovernanceAudit({
      task: createTask({
        roleGovernanceMode: 'auto_manage',
        allowMainBrainRoleMutation: true,
        baseAgentId: 'poster',
      }),
      finalPlan: {
        roleGovernanceAudit: {
          summary: '长期改写当前专家设定',
          actions: [
            {
              action: 'addon_update',
              targetBaseAgentId: 'poster',
              promptAddonText,
              reason: '用户明确要求直接更新当前专家的长期行为设定',
              requiresHumanApproval: false,
            },
          ],
        },
      },
    });

    assert.equal(api.getAgentPromptAddon('poster'), promptAddonText);
    assert.equal((audit?.summary || '').includes('已自动更新专家壳 poster 的长期 addon'), true);
  });
});

test('applyMainBrainRoleGovernanceAudit keeps addon update as suggestion when mutation permission is disabled', () => {
  withLocalAssetApi((api) => {
    const promptAddonText = '先给结构化拆解，再给执行方案。';

    const audit = applyMainBrainRoleGovernanceAudit({
      task: createTask({
        roleGovernanceMode: 'auto_manage',
        allowMainBrainRoleMutation: false,
        baseAgentId: 'poster',
      }),
      finalPlan: {
        roleGovernanceAudit: {
          summary: '记录长期 addon 改写建议',
          actions: [
            {
              action: 'addon_update',
              targetBaseAgentId: 'poster',
              promptAddonText,
              reason: '当前仅允许记录建议，不能自动改写',
              requiresHumanApproval: false,
            },
          ],
        },
      },
    });

    assert.equal(api.getAgentPromptAddon('poster'), '');
    assert.equal((audit?.summary || '').includes('长期 addon 改写仅记录为建议，未自动执行'), true);
  });
});

test('finalizeRoleGovernancePlan hydrates standard completion plan with persisted addon update audit', () => {
  withLocalAssetApi((api) => {
    const promptAddonText =
      '先做结构化拆解，再明确版式层级、主视觉节奏、CTA 和风险检查。';

    const finalPlan = finalizeRoleGovernancePlan({
      task: createTask({
        roleGovernanceMode: 'auto_manage',
        allowMainBrainRoleMutation: true,
        baseAgentId: 'poster',
      }),
      finalPlan: {
        analysis: '标准专家完成分支',
        suggestions: ['继续观察最近三轮输出稳定性'],
        roleGovernanceAudit: {
          summary: '统一侧栏下直接更新当前专家长期 addon',
          actions: [
            {
              action: 'addon_update',
              targetBaseAgentId: 'poster',
              promptAddonText,
              reason: '用户已经授权直接更新当前专家长期设定',
              requiresHumanApproval: false,
            },
          ],
        },
      },
    });

    assert.equal(api.getAgentPromptAddon('poster'), promptAddonText);
    assert.equal(finalPlan.analysis, '标准专家完成分支');
    assert.equal(finalPlan.suggestions?.[0], '继续观察最近三轮输出稳定性');
    assert.equal(Array.isArray(finalPlan.roleGovernanceAudit?.actions), true);
    assert.equal(
      (finalPlan.roleGovernanceAudit?.summary || '').includes('已自动更新专家壳 poster 的长期 addon'),
      true,
    );
  });
});

test('finalizeRoleGovernancePlan keeps ordinary plans unchanged when no governance audit exists', () => {
  const finalPlan = finalizeRoleGovernancePlan({
    task: createTask({
      baseAgentId: 'coco',
    }),
    finalPlan: {
      analysis: '普通回答',
      suggestions: ['补充更多上下文'],
    },
  });

  assert.deepEqual(finalPlan, {
    analysis: '普通回答',
    suggestions: ['补充更多上下文'],
  });
});
