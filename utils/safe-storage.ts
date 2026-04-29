import type { StateStorage } from 'zustand/middleware';

const isBrowser = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const TRACE_STORAGE_KEYS = new Set<string>([
  'setting_script_models',
  'setting_image_models',
  'setting_video_models',
  'workspace_auto_model_select',
  'workspace_preferred_image_model',
  'workspace_preferred_video_model',
  'workspace_preferred_3d_model',
]);

const shouldTraceStorageWrite = (key: string): boolean => {
  if (!isBrowser()) return false;
  if (!TRACE_STORAGE_KEYS.has(key)) return false;

  // Debug switch: set localStorage.debug_model_mapping_writes = 'off' to disable
  const toggle = window.localStorage.getItem('debug_model_mapping_writes');
  if (!toggle) return true;
  const normalized = toggle.trim().toLowerCase();
  return !(normalized === '0' || normalized === 'false' || normalized === 'off');
};

const summarizeStorageValue = (value: string): unknown => {
  const normalized = String(value ?? '');
  if (normalized.length === 0) return '(empty)';

  try {
    const parsed = JSON.parse(normalized);
    if (Array.isArray(parsed)) {
      return {
        type: 'array',
        length: parsed.length,
        preview: parsed.slice(0, 8),
      };
    }
    if (parsed && typeof parsed === 'object') {
      return {
        type: 'object',
        keys: Object.keys(parsed as Record<string, unknown>).slice(0, 12),
      };
    }
    return parsed;
  } catch {
    return normalized.length > 180
      ? `${normalized.slice(0, 180)}...(len=${normalized.length})`
      : normalized;
  }
};

const printStorageTrace = (
  event: 'setItem' | 'removeItem',
  key: string,
  previousValue: string | null,
  nextValue?: string,
): void => {
  if (!shouldTraceStorageWrite(key)) return;
  const stack = new Error().stack?.split('\n').slice(2, 10).join('\n') || '(stack unavailable)';
  const title =
    event === 'setItem'
      ? `[storage.trace] set ${key}`
      : `[storage.trace] remove ${key}`;
  console.groupCollapsed(title);
  console.info('prev:', summarizeStorageValue(previousValue ?? ''));
  if (event === 'setItem') {
    console.info('next:', summarizeStorageValue(nextValue ?? ''));
  }
  console.info('stack:', stack);
  console.groupEnd();
};

export const isQuotaExceededError = (error: unknown): boolean => {
  const e = error as { name?: string; code?: number; message?: string } | null;
  if (!e) return false;
  if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
  if (e.code === 22 || e.code === 1014) return true;
  const msg = String(e.message || '').toLowerCase();
  return msg.includes('quota') && msg.includes('exceed');
};

export const safeLocalStorageSetItem = (key: string, value: string): boolean => {
  if (!isBrowser()) return false;
  try {
    const previousValue = window.localStorage.getItem(key);
    if (previousValue === value) {
      // No-op write: avoid noise and unnecessary storage churn.
      return true;
    }
    window.localStorage.setItem(key, value);
    printStorageTrace('setItem', key, previousValue, value);
    return true;
  } catch (error) {
    if (isQuotaExceededError(error)) {
      console.warn(`[storage] localStorage quota exceeded while writing key: ${key}`);
      return false;
    }
    console.warn(`[storage] localStorage write failed for key: ${key}`, error);
    return false;
  }
};

export const safeLocalStorageRemoveItem = (key: string): void => {
  if (!isBrowser()) return;
  try {
    const previousValue = window.localStorage.getItem(key);
    if (previousValue === null) {
      // Already removed.
      return;
    }
    window.localStorage.removeItem(key);
    printStorageTrace('removeItem', key, previousValue ?? null);
  } catch (error) {
    console.warn(`[storage] localStorage remove failed for key: ${key}`, error);
  }
};

export const safeLocalStorageStateStorage: StateStorage = {
  getItem: (key) => {
    if (!isBrowser()) return null;
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.warn(`[storage] localStorage read failed for key: ${key}`, error);
      return null;
    }
  },
  setItem: (key, value) => {
    safeLocalStorageSetItem(key, value);
  },
  removeItem: (key) => {
    safeLocalStorageRemoveItem(key);
  },
};
