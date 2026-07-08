import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hasUsableApiKeyForProviderId,
  resolveFirstUsableProviderId,
} from './provider-config.ts';

const createLocalStorageStub = () => {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
};

test('provider-config helpers ignore placeholder ids and pick usable key-backed providers', () => {
  const storage = createLocalStorageStub();
  storage.setItem(
    'api_providers',
    JSON.stringify([
      {
        id: 'custom-openai',
        name: 'Custom OpenAI',
        baseUrl: 'https://example.com',
        apiKey: 'sk-test',
      },
    ]),
  );

  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: storage },
    configurable: true,
  });

  assert.equal(hasUsableApiKeyForProviderId('default'), false);
  assert.equal(hasUsableApiKeyForProviderId('custom-openai'), true);
  assert.equal(
    resolveFirstUsableProviderId(['default', 'custom-openai', 'gemini']),
    'custom-openai',
  );
});
