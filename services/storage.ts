import type { Project } from '../types/index.ts';
import { safeLocalStorageRemoveItem } from '../utils/safe-storage.ts';

export const DB_NAME = 'XcStudioDB';
export const STORE_NAME = 'projects';
export const TOPIC_SNAPSHOT_STORE = 'topic_snapshots';
export const TOPIC_MEMORY_ITEM_STORE = 'topic_memory_items';
export const TOPIC_ASSET_STORE = 'topic_assets';
const DB_VERSION = 3;

export const openWorkspaceDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const tx = (event.target as IDBOpenDBRequest).transaction!;
      const oldVersion = event.oldVersion;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(TOPIC_SNAPSHOT_STORE)) {
        db.createObjectStore(TOPIC_SNAPSHOT_STORE, { keyPath: 'memoryKey' });
      } else if (oldVersion < 3) {
        try {
          const store = tx.objectStore(TOPIC_SNAPSHOT_STORE);
          if (!store.indexNames.contains('memoryKey')) {
            store.createIndex('memoryKey', 'memoryKey', { unique: true });
          }
        } catch (e) { console.warn('Upgrade TOPIC_SNAPSHOT_STORE skipped:', e); }
      }

      if (!db.objectStoreNames.contains(TOPIC_MEMORY_ITEM_STORE)) {
        const store = db.createObjectStore(TOPIC_MEMORY_ITEM_STORE, { keyPath: 'id' });
        store.createIndex('memoryKey', 'memoryKey', { unique: false });
        store.createIndex('topicId', 'topicId', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      } else if (oldVersion < 3) {
        try {
          const store = tx.objectStore(TOPIC_MEMORY_ITEM_STORE);
          if (!store.indexNames.contains('memoryKey')) {
            store.createIndex('memoryKey', 'memoryKey', { unique: false });
          }
        } catch (e) { console.warn('Upgrade TOPIC_MEMORY_ITEM_STORE skipped:', e); }
      }

      if (!db.objectStoreNames.contains(TOPIC_ASSET_STORE)) {
        const store = db.createObjectStore(TOPIC_ASSET_STORE, { keyPath: 'assetId' });
        store.createIndex('memoryKey', 'memoryKey', { unique: false });
        store.createIndex('topicId', 'topicId', { unique: false });
        store.createIndex('role', 'role', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      } else if (oldVersion < 3) {
        try {
          const store = tx.objectStore(TOPIC_ASSET_STORE);
          if (!store.indexNames.contains('memoryKey')) {
            store.createIndex('memoryKey', 'memoryKey', { unique: false });
          }
        } catch (e) { console.warn('Upgrade TOPIC_ASSET_STORE skipped:', e); }
      }
    };
  });
};

const openDB = openWorkspaceDB;

export type ProjectSummary = Pick<Project, 'id' | 'title' | 'updatedAt' | 'thumbnail'>;

export const getProjects = async (): Promise<Project[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const projects = request.result as Project[];
        // Sort by updatedAt descending
        projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        resolve(projects);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to load projects', error);
    return [];
  }
};

export const getProjectSummaries = async (): Promise<ProjectSummary[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();
      const summaries: ProjectSummary[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          summaries.sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          );
          resolve(summaries);
          return;
        }

        const value = cursor.value as Project;
        summaries.push({
          id: value.id,
          title: value.title,
          updatedAt: value.updatedAt,
          thumbnail: value.thumbnail,
        });
        cursor.continue();
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to load project summaries', error);
    return [];
  }
};

export const getProject = async (id: string): Promise<Project | undefined> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to load project', error);
    return undefined;
  }
};

export const saveProject = async (project: Project): Promise<void> => {
  try {
    const db = await openDB();
    const { compactProjectForPersist } = await import(
      '../pages/Workspace/controllers/workspacePersistence.ts'
    );
    const compactProject = compactProjectForPersist(project);
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(compactProject);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to save project', error);
  }
};

export const deleteProject = async (id: string): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to delete project', error);
  }
};

const LOCAL_ONLY_URL_PATTERNS = [
  /^blob:/i,
  /^data:/i,
  /^jk-topic-asset:\/\//i,
  /^xc-topic-asset:\/\//i,
  /^ATTACHMENT_/i,
];
const PROJECT_STORE_PERSIST_KEY = 'xc-studio-project';

export interface ProjectLocalRiskItem {
  projectId: string;
  projectTitle: string;
  updatedAt: string;
  localAssetCount: number;
  sampleRefs: string[];
}

const isLocalOnlyAssetReference = (value: string): boolean =>
  LOCAL_ONLY_URL_PATTERNS.some((pattern) => pattern.test(value));

const summarizeAssetReference = (value: string): string => {
  const normalized = String(value || '').trim();
  if (normalized.length <= 96) {
    return normalized;
  }
  return `${normalized.slice(0, 93)}...`;
};

const collectLocalOnlyAssetRefs = (
  value: unknown,
  samples: string[],
  seen: WeakSet<object>,
): number => {
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized || !isLocalOnlyAssetReference(normalized)) {
      return 0;
    }
    if (samples.length < 5) {
      samples.push(summarizeAssetReference(normalized));
    }
    return 1;
  }

  if (!value || typeof value !== 'object') {
    return 0;
  }

  if (seen.has(value as object)) {
    return 0;
  }
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.reduce(
      (total, item) => total + collectLocalOnlyAssetRefs(item, samples, seen),
      0,
    );
  }

  return Object.values(value as Record<string, unknown>).reduce<number>(
    (total, item) => total + collectLocalOnlyAssetRefs(item, samples, seen),
    0,
  );
};

export const scanProjectLocalAssetRisk = (project: Project): ProjectLocalRiskItem | null => {
  const sampleRefs: string[] = [];
  const localAssetCount = collectLocalOnlyAssetRefs(project, sampleRefs, new WeakSet<object>());

  if (localAssetCount <= 0) {
    return null;
  }

  return {
    projectId: String(project.id || '').trim(),
    projectTitle: String(project.title || '未命名项目').trim() || '未命名项目',
    updatedAt: String(project.updatedAt || '').trim(),
    localAssetCount,
    sampleRefs,
  };
};

export const listProjectLocalAssetRisks = async (): Promise<ProjectLocalRiskItem[]> => {
  const projects = await getProjects();
  return projects
    .map((project) => scanProjectLocalAssetRisk(project))
    .filter((item): item is ProjectLocalRiskItem => Boolean(item));
};

export const clearWorkspaceLocalProjectData = async (): Promise<void> => {
  safeLocalStorageRemoveItem(PROJECT_STORE_PERSIST_KEY);

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(
        [STORE_NAME, TOPIC_SNAPSHOT_STORE, TOPIC_MEMORY_ITEM_STORE, TOPIC_ASSET_STORE],
        'readwrite',
      );
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      transaction.objectStore(STORE_NAME).clear();
      transaction.objectStore(TOPIC_SNAPSHOT_STORE).clear();
      transaction.objectStore(TOPIC_MEMORY_ITEM_STORE).clear();
      transaction.objectStore(TOPIC_ASSET_STORE).clear();
    });
  } catch (error) {
    console.error('Failed to clear workspace local project data', error);
    throw error;
  }
};

// Helper to format date
export const formatDate = (date: number | Date): string => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};
