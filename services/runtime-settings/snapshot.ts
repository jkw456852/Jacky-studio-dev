import { loadProviderSettings } from "../provider-settings";
import { normalizeRuntimeSettingsSnapshot } from "./normalize";
import type {
  RuntimeSettingsSnapshot,
  RuntimeSettingsView,
} from "./schema";

type RuntimeSettingsListener = (
  view: RuntimeSettingsView<RuntimeSettingsSnapshot>,
) => void;

let cachedView: RuntimeSettingsView<RuntimeSettingsSnapshot> | null = null;
let listeningToProviderSettings = false;
const listeners = new Set<RuntimeSettingsListener>();

const cloneAndFreeze = <T,>(value: T): Readonly<T> => {
  const cloned = JSON.parse(JSON.stringify(value)) as T;
  return Object.freeze(cloned);
};

const buildRuntimeSettingsView =
  (): RuntimeSettingsView<RuntimeSettingsSnapshot> => {
    const snapshot = normalizeRuntimeSettingsSnapshot(loadProviderSettings());
    return {
      value: cloneAndFreeze(snapshot),
      version: snapshot.version,
      source: "merged",
      updatedAt: Date.now(),
    };
  };

const emitRuntimeSettingsUpdate = () => {
  cachedView = buildRuntimeSettingsView();
  listeners.forEach((listener) => {
    listener(cachedView as RuntimeSettingsView<RuntimeSettingsSnapshot>);
  });
};

const ensureProviderSettingsListener = () => {
  if (listeningToProviderSettings || typeof window === "undefined") return;
  listeningToProviderSettings = true;
  window.addEventListener("provider-settings-updated", emitRuntimeSettingsUpdate);
};

export const getRuntimeSettingsSnapshot =
  (): RuntimeSettingsView<RuntimeSettingsSnapshot> => {
    ensureProviderSettingsListener();
    if (!cachedView) {
      cachedView = buildRuntimeSettingsView();
    }
    return cachedView;
  };

export const refreshRuntimeSettingsSnapshot =
  (): RuntimeSettingsView<RuntimeSettingsSnapshot> => {
    emitRuntimeSettingsUpdate();
    return cachedView as RuntimeSettingsView<RuntimeSettingsSnapshot>;
  };

export const subscribeRuntimeSettings = (
  listener: RuntimeSettingsListener,
): (() => void) => {
  ensureProviderSettingsListener();
  listeners.add(listener);
  listener(getRuntimeSettingsSnapshot());
  return () => {
    listeners.delete(listener);
  };
};
