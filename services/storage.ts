import type { Project } from '../types/index.ts';
import { resolveProjectThumbnail } from './project-thumbnail.ts';
import { safeLocalStorageRemoveItem } from '../utils/safe-storage.ts';

export const DB_NAME = 'XcStudioDB';
export const STORE_NAME = 'projects';
export const TOPIC_SNAPSHOT_STORE = 'topic_snapshots';
export const TOPIC_MEMORY_ITEM_STORE = 'topic_memory_items';
export const TOPIC_ASSET_STORE = 'topic_assets';
export const CONVERSATION_BACKUP_STORE = 'conversation_backups';
const DB_VERSION = 7;
const deletedConversationIdsByProject = new Map<string, Set<string>>();
const rememberedConversationsByProject = new Map<string, Map<string, ProjectConversation>>();
type ProjectConversation = NonNullable<Project['conversations']>[number];
type ConversationBackupRecord = {
  id: string;
  projectId: string;
  conversationId: string;
  conversation: ProjectConversation;
  updatedAt: number;
};

export const markProjectConversationDeleted = (
  projectId: string | undefined,
  conversationId: string | undefined,
): void => {
  const normalizedProjectId = String(projectId || '').trim();
  const normalizedConversationId = String(conversationId || '').trim();
  if (!normalizedProjectId || !normalizedConversationId) return;

  const existing =
    deletedConversationIdsByProject.get(normalizedProjectId) ?? new Set<string>();
  existing.add(normalizedConversationId);
  deletedConversationIdsByProject.set(normalizedProjectId, existing);
  rememberedConversationsByProject
    .get(normalizedProjectId)
    ?.delete(normalizedConversationId);
};

export const mergeMissingConversationsForSave = (
  existingProject: Project | undefined,
  nextProject: Project,
): Project => {
  const existingConversations = existingProject?.conversations;
  const nextConversations = nextProject.conversations;
  if (
    !Array.isArray(existingConversations) ||
    existingConversations.length === 0 ||
    !Array.isArray(nextConversations)
  ) {
    return nextProject;
  }

  const projectId = String(nextProject.id || '').trim();
  const deletedIds = deletedConversationIdsByProject.get(projectId);
  const nextIds = new Set(
    nextConversations
      .map((conversation) => String(conversation.id || '').trim())
      .filter(Boolean),
  );
  const missingConversations = existingConversations.filter((conversation) => {
    const conversationId = String(conversation.id || '').trim();
    return (
      conversationId &&
      !nextIds.has(conversationId) &&
      !deletedIds?.has(conversationId)
    );
  });

  if (missingConversations.length === 0) {
    return nextProject;
  }

  return {
    ...nextProject,
    conversations: [...nextConversations, ...missingConversations],
  };
};

const countPersistableConversationMessages = (
  conversation: Project["conversations"] extends Array<infer T> ? T : never,
): number => {
  const assistantThreadMessages = Array.isArray(
    conversation.assistantThread?.messages,
  )
    ? conversation.assistantThread.messages.length
    : 0;
  const legacyMessages = Array.isArray(conversation.messages)
    ? conversation.messages.length
    : 0;
  return Math.max(assistantThreadMessages, legacyMessages);
};

const rememberProjectConversations = (project: Project | undefined): void => {
  const projectId = String(project?.id || '').trim();
  const conversations = project?.conversations;
  if (!projectId || !Array.isArray(conversations) || conversations.length === 0) {
    return;
  }

  const deletedIds = deletedConversationIdsByProject.get(projectId);
  const remembered =
    rememberedConversationsByProject.get(projectId) ?? new Map<string, ProjectConversation>();

  for (const conversation of conversations) {
    const conversationId = String(conversation.id || '').trim();
    if (!conversationId || deletedIds?.has(conversationId)) {
      continue;
    }

    const existing = remembered.get(conversationId);
    if (
      !existing ||
      countPersistableConversationMessages(conversation) >=
        countPersistableConversationMessages(existing)
    ) {
      remembered.set(conversationId, conversation);
    }
  }

  rememberedConversationsByProject.set(projectId, remembered);
};

const getRememberedProjectConversations = (
  projectId: string | undefined,
): ProjectConversation[] => {
  const normalizedProjectId = String(projectId || '').trim();
  if (!normalizedProjectId) return [];
  const deletedIds = deletedConversationIdsByProject.get(normalizedProjectId);
  return Array.from(
    rememberedConversationsByProject.get(normalizedProjectId)?.values() ?? [],
  ).filter((conversation) => {
    const conversationId = String(conversation.id || '').trim();
    return conversationId && !deletedIds?.has(conversationId);
  });
};

export const mergeSaferConversationsForSave = (
  existingProject: Project | undefined,
  nextProject: Project,
): Project => {
  const existingConversations = existingProject?.conversations;
  const nextConversations = nextProject.conversations;
  if (
    !Array.isArray(existingConversations) ||
    existingConversations.length === 0 ||
    !Array.isArray(nextConversations)
  ) {
    return nextProject;
  }

  const existingById = new Map(
    existingConversations
      .map((conversation) => [
        String(conversation.id || "").trim(),
        conversation,
      ] as const)
      .filter(([conversationId]) => Boolean(conversationId)),
  );
  const projectId = String(nextProject.id || "").trim();
  const deletedIds = deletedConversationIdsByProject.get(projectId);
  let changed = false;
  const saferConversations = nextConversations.map((conversation) => {
    const conversationId = String(conversation.id || "").trim();
    const existing = conversationId ? existingById.get(conversationId) : undefined;
    if (!conversationId || !existing || deletedIds?.has(conversationId)) {
      return conversation;
    }

    const nextMessageCount = countPersistableConversationMessages(conversation);
    const existingMessageCount = countPersistableConversationMessages(existing);
    if (existingMessageCount <= nextMessageCount) {
      return conversation;
    }

    changed = true;
    return {
      ...conversation,
      assistantThread: existing.assistantThread,
      messages: existing.messages,
    };
  });

  return changed
    ? {
        ...nextProject,
        conversations: saferConversations,
      }
    : nextProject;
};

const getConversationBackupKey = (
  projectId: string,
  conversationId: string,
): string => `${projectId}::${conversationId}`;

export const mergeConversationBackupsIntoProject = (
  project: Project | undefined,
  backupConversations: ProjectConversation[],
): Project | undefined => {
  if (!project || backupConversations.length === 0) {
    return project;
  }

  const projectId = String(project.id || '').trim();
  const deletedIds = deletedConversationIdsByProject.get(projectId);
  const conversations = Array.isArray(project.conversations)
    ? project.conversations
    : [];
  const backupById = new Map(
    backupConversations
      .map((conversation) => [
        String(conversation.id || '').trim(),
        conversation,
      ] as const)
      .filter(([conversationId]) => Boolean(conversationId)),
  );
  const conversationIds = new Set<string>();
  let changed = false;
  const mergedConversations = conversations.map((conversation) => {
    const conversationId = String(conversation.id || '').trim();
    if (!conversationId || deletedIds?.has(conversationId)) {
      return conversation;
    }

    conversationIds.add(conversationId);
    const backup = backupById.get(conversationId);
    if (!backup) {
      return conversation;
    }

    const currentMessageCount = countPersistableConversationMessages(conversation);
    const backupMessageCount = countPersistableConversationMessages(backup);
    const backupHasFullerThread =
      backupMessageCount > currentMessageCount ||
      (
        backupMessageCount === currentMessageCount &&
        (backup.assistantThread?.messages?.length || 0) >
          (conversation.assistantThread?.messages?.length || 0)
      );
    if (!backupHasFullerThread) {
      return conversation;
    }

    changed = true;
    return {
      ...conversation,
      assistantThread: backup.assistantThread,
      messages: backup.messages,
    };
  });
  const missingBackups = backupConversations.filter((conversation) => {
    const conversationId = String(conversation.id || '').trim();
    return (
      conversationId &&
      !conversationIds.has(conversationId) &&
      !deletedIds?.has(conversationId)
    );
  });

  if (!changed && missingBackups.length === 0) {
    return project;
  }

  return {
    ...project,
    conversations: [...mergedConversations, ...missingBackups],
  };
};

export const rememberLoadedProjectConversationsForPersistence = (
  project: Project | undefined,
): void => {
  rememberProjectConversations(project);
};

export const mergeLoadedProjectConversationsForHydration = (
  project: Project | undefined,
): Project | undefined => {
  const rememberedConversations = getRememberedProjectConversations(project?.id);
  return mergeConversationBackupsIntoProject(project, rememberedConversations);
};

const mergeConversationBackupsIntoNextProject = (
  nextProject: Project,
  backupConversations: ProjectConversation[],
): Project => {
  const mergedProject = mergeConversationBackupsIntoProject(
    nextProject,
    backupConversations,
  );
  return mergedProject ?? nextProject;
};

export const mergeConversationBackupsForSave = (
  existingProject: Project | undefined,
  nextProject: Project,
  backupConversations: ProjectConversation[],
): Project => {
  const rememberedConversations = getRememberedProjectConversations(nextProject.id);
  const recoveryConversations = [
    ...backupConversations,
    ...rememberedConversations,
  ];
  const backedExistingProject = mergeConversationBackupsIntoProject(
    existingProject,
    recoveryConversations,
  );
  const backedNextProject = mergeConversationBackupsIntoNextProject(
    nextProject,
    recoveryConversations,
  );

  return mergeSaferConversationsForSave(
    backedExistingProject,
    mergeMissingConversationsForSave(backedExistingProject, backedNextProject),
  );
};

const readProjectConversationBackups = async (
  db: IDBDatabase,
  projectId: string,
): Promise<ProjectConversation[]> => {
  if (!db.objectStoreNames.contains(CONVERSATION_BACKUP_STORE)) {
    return [];
  }

  return new Promise<ProjectConversation[]>((resolve, reject) => {
    const transaction = db.transaction(CONVERSATION_BACKUP_STORE, 'readonly');
    const store = transaction.objectStore(CONVERSATION_BACKUP_STORE);
    if (!store.indexNames.contains('projectId')) {
      const request = store.openCursor();
      const records: ConversationBackupRecord[] = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          records.sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0));
          resolve(records.map((record) => record.conversation));
          return;
        }

        const record = cursor.value as ConversationBackupRecord;
        if (record?.projectId === projectId && record.conversation) {
          records.push(record);
        }
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
      return;
    }

    const index = store.index('projectId');
    const request = index.getAll(projectId);
    request.onsuccess = () => {
      const records = (request.result as ConversationBackupRecord[])
        .filter((record) => record?.projectId === projectId && record.conversation)
        .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0));
      resolve(records.map((record) => record.conversation));
    };
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
};

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

      if (!db.objectStoreNames.contains(CONVERSATION_BACKUP_STORE)) {
        const store = db.createObjectStore(CONVERSATION_BACKUP_STORE, {
          keyPath: 'id',
        });
        store.createIndex('projectId', 'projectId', { unique: false });
        store.createIndex('conversationId', 'conversationId', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      } else {
        try {
          const store = tx.objectStore(CONVERSATION_BACKUP_STORE);
          if (!store.indexNames.contains('projectId')) {
            store.createIndex('projectId', 'projectId', { unique: false });
          }
          if (!store.indexNames.contains('conversationId')) {
            store.createIndex('conversationId', 'conversationId', { unique: false });
          }
          if (!store.indexNames.contains('updatedAt')) {
            store.createIndex('updatedAt', 'updatedAt', { unique: false });
          }
        } catch (e) { console.warn('Upgrade CONVERSATION_BACKUP_STORE skipped:', e); }
      }
    };
  });
};

const openDB = openWorkspaceDB;

export type ProjectSummary = Pick<Project, 'id' | 'title' | 'updatedAt' | 'thumbnail'>;

export const deleteProjectConversationBackup = async (
  projectId: string | undefined,
  conversationId: string | undefined,
): Promise<void> => {
  const normalizedProjectId = String(projectId || '').trim();
  const normalizedConversationId = String(conversationId || '').trim();
  if (!normalizedProjectId || !normalizedConversationId) return;

  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(CONVERSATION_BACKUP_STORE)) return;
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(CONVERSATION_BACKUP_STORE, 'readwrite');
      const store = transaction.objectStore(CONVERSATION_BACKUP_STORE);
      store.delete(
        getConversationBackupKey(normalizedProjectId, normalizedConversationId),
      );
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch (error) {
    console.warn('Failed to delete conversation backup', error);
  }
};

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
          thumbnail: resolveProjectThumbnail(value) || undefined,
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
    const project = await new Promise<Project | undefined>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!project || !db.objectStoreNames.contains(CONVERSATION_BACKUP_STORE)) {
      rememberProjectConversations(project);
      return project;
    }

    const backupConversations = await readProjectConversationBackups(db, id);

    const mergedProject = mergeConversationBackupsIntoProject(
      project,
      backupConversations,
    );
    rememberProjectConversations(mergedProject);
    return mergedProject;
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
    const existingProject = await new Promise<Project | undefined>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(project.id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const backupConversations = await readProjectConversationBackups(db, project.id);
    const mergedProject = mergeConversationBackupsForSave(
      existingProject,
      project,
      backupConversations,
    );
    rememberProjectConversations(mergedProject);
    const normalizedProject: Project = {
      ...mergedProject,
      thumbnail: resolveProjectThumbnail(mergedProject) || undefined,
    };
    const compactProject = compactProjectForPersist(normalizedProject);
    return new Promise((resolve, reject) => {
      const hasConversationBackupStore =
        db.objectStoreNames.contains(CONVERSATION_BACKUP_STORE);
      const transaction = db.transaction(
        hasConversationBackupStore
          ? [STORE_NAME, CONVERSATION_BACKUP_STORE]
          : [STORE_NAME],
        'readwrite',
      );
      const projectStore = transaction.objectStore(STORE_NAME);
      projectStore.put(compactProject);

      const projectId = String(compactProject.id || '').trim();
      const deletedIds = deletedConversationIdsByProject.get(projectId);
      if (hasConversationBackupStore) {
        const backupStore = transaction.objectStore(CONVERSATION_BACKUP_STORE);
        for (const conversationId of deletedIds || []) {
          backupStore.delete(getConversationBackupKey(projectId, conversationId));
        }
        for (const conversation of compactProject.conversations || []) {
          const conversationId = String(conversation.id || '').trim();
          if (!projectId || !conversationId || deletedIds?.has(conversationId)) {
            continue;
          }
          backupStore.put({
            id: getConversationBackupKey(projectId, conversationId),
            projectId,
            conversationId,
            conversation,
            updatedAt: Date.now(),
          } satisfies ConversationBackupRecord);
        }
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to save project', error);
  }
};

export const deleteProject = async (id: string): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const stores = db.objectStoreNames.contains(CONVERSATION_BACKUP_STORE)
        ? [STORE_NAME, CONVERSATION_BACKUP_STORE]
        : [STORE_NAME];
      const transaction = db.transaction(stores, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(id);
      if (stores.includes(CONVERSATION_BACKUP_STORE)) {
        const backupStore = transaction.objectStore(CONVERSATION_BACKUP_STORE);
        const index = backupStore.index('projectId');
        const request = index.openCursor(IDBKeyRange.only(id));
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          cursor.delete();
          cursor.continue();
        };
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
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
