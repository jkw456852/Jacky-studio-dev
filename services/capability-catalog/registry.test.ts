import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findRecipeCapability,
  listRecipeCapabilities,
  listRecipeCapabilitiesByDomain,
  listRecipeCapabilityIds,
} from './registry.ts';

const collectDuplicates = (items: string[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  items.forEach((item) => {
    if (seen.has(item)) {
      duplicates.add(item);
      return;
    }
    seen.add(item);
  });
  return Array.from(duplicates);
};

test('recipe capability registry keeps ids unique and executor metadata complete', () => {
  const capabilities = listRecipeCapabilities();
  const ids = listRecipeCapabilityIds();

  assert.equal(capabilities.length > 0, true);
  assert.equal(ids.length, capabilities.length);
  assert.deepEqual(collectDuplicates(ids), []);

  capabilities.forEach((capability) => {
    assert.equal(Boolean(String(capability.id || '').trim()), true);
    assert.equal(Boolean(String(capability.label || '').trim()), true);
    assert.equal(Boolean(String(capability.executorRef || '').trim()), true);
    assert.equal(Array.isArray(capability.tags), true);
    assert.equal(capability.inputSchema.type, 'object');
    assert.equal(capability.outputSchema.type, 'object');
  });
});

test('recipe capability registry supports case-insensitive lookup and stable domain filtering', () => {
  const imageCapabilities = listRecipeCapabilitiesByDomain('image');

  assert.equal(imageCapabilities.some((item) => item.id === 'image.generate.single'), true);
  assert.equal(imageCapabilities.some((item) => item.id === 'image.edit.smart'), true);
  assert.equal(findRecipeCapability(' IMAGE.EDIT.TOUCH ')?.id, 'image.edit.touch');
  assert.equal(findRecipeCapability('canvas.inspect.runtime')?.kind, 'browser-tool');
  assert.equal(findRecipeCapability('fashion.compose.tryon')?.kind, 'workflow-adapter');
  assert.equal(findRecipeCapability('workflow.execute.recipe')?.kind, 'internal-service');
});

test('recipe capability registry covers the initial phase-1 domains expected by the platform scaffold', () => {
  const capabilities = listRecipeCapabilities();
  const domains = new Set(capabilities.map((item) => item.domain));

  assert.equal(domains.has('asset'), true);
  assert.equal(domains.has('vision'), true);
  assert.equal(domains.has('research'), true);
  assert.equal(domains.has('planning'), true);
  assert.equal(domains.has('image'), true);
  assert.equal(domains.has('fashion'), true);
  assert.equal(domains.has('workflow'), true);
  assert.equal(domains.has('canvas'), true);
  assert.equal(domains.has('package'), true);
});
