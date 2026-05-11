import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GOVERNANCE_CAPABILITIES,
  MAIN_BRAIN_CAPABILITY_MANIFEST,
} from './main-brain-capability-manifest.ts';
import {
  findGovernanceCapabilityByExecutorKey,
  listGovernanceCapabilityExecutorKeys,
  listMainBrainCapabilities,
} from './main-brain-capability-registry.ts';

test('main brain capability manifest keeps governance coverage metadata complete', () => {
  assert.equal(MAIN_BRAIN_CAPABILITY_MANIFEST.length >= GOVERNANCE_CAPABILITIES.length, true);

  for (const capability of GOVERNANCE_CAPABILITIES) {
    assert.equal(Boolean(capability.id), true, `missing id for ${capability.label}`);
    assert.equal(Boolean(capability.executorKey), true, `missing executorKey for ${capability.id}`);
    assert.equal(
      capability.auditChannel,
      'roleGovernanceAudit',
      `unexpected auditChannel for ${capability.id}`,
    );
    assert.equal(Boolean(capability.permissionPolicy), true, `missing permissionPolicy for ${capability.id}`);
    assert.equal(Boolean(capability.mutation), true, `missing mutation envelope metadata for ${capability.id}`);
    assert.equal(Boolean(capability.exampleAction), true, `missing exampleAction for ${capability.id}`);
  }
});

test('governance executor registry stays aligned with manifest executor keys', () => {
  const executorKeys = listGovernanceCapabilityExecutorKeys();

  assert.equal(executorKeys.length, GOVERNANCE_CAPABILITIES.length);

  for (const executorKey of executorKeys) {
    const capability = findGovernanceCapabilityByExecutorKey(executorKey);
    assert.equal(Boolean(capability), true, `executorKey ${executorKey} is not resolvable`);
  }
});

test('main brain capability registry exposes manifest entries without loss', () => {
  const capabilities = listMainBrainCapabilities();

  assert.equal(capabilities.length, MAIN_BRAIN_CAPABILITY_MANIFEST.length);
  assert.equal(
    capabilities.some((item) => item.id === 'roleAddonUpdate' && item.executorKey === 'addon_update'),
    true,
  );
});
