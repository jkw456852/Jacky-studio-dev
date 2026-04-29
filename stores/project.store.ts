/**
 * Project Store
 * 管理项目级别的状态：标题、设置、元数据等
 */

import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { BrandInfo, DesignSessionState, DesignTaskMode } from '../types/common';
import { safeLocalStorageStateStorage } from '../utils/safe-storage';

const MAX_PERSIST_LIST = 20;
const MAX_PERSIST_TEXT = 500;

const toTrimmedStringArray = (input: unknown): string[] => {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_PERSIST_LIST)
    .map((item) => item.slice(0, MAX_PERSIST_TEXT));
};

const toTrimmedText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_PERSIST_TEXT);
};

const toTrimmedWebPages = (value: unknown): Array<{ title: string; url: string }> => {
  if (!Array.isArray(value)) return [];
  const pages: Array<{ title: string; url: string }> = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const title = toTrimmedText((item as { title?: unknown }).title);
    const url = toTrimmedText((item as { url?: unknown }).url);
    if (!title || !url) continue;
    pages.push({ title, url });
    if (pages.length >= MAX_PERSIST_LIST) break;
  }
  return pages;
};

const compactDesignSessionForPersist = (session: DesignSessionState): DesignSessionState => ({
  taskMode: 'generate',
  brand: {
    name: toTrimmedText(session.brand?.name),
    colors: toTrimmedStringArray(session.brand?.colors),
    fonts: toTrimmedStringArray(session.brand?.fonts),
    style: toTrimmedText(session.brand?.style),
  },
  styleHints: toTrimmedStringArray(session.styleHints),
  subjectAnchorMode: session.subjectAnchorMode === 'manual' ? 'manual' : 'auto',
  consistencyCheckEnabled: session.consistencyCheckEnabled !== false,
  // 以下字段属于会话级运行时上下文，不跨会话持久化
  subjectAnchors: [],
  approvedAssetIds: [],
  referenceSummary: undefined,
  researchSummary: undefined,
  referenceWebPages: [],
  constraints: toTrimmedStringArray(session.constraints),
  forbiddenChanges: toTrimmedStringArray(session.forbiddenChanges),
});

interface ProjectSettings {
  autoSave: boolean;
  autoSaveInterval: number; // 秒
  defaultImageQuality: '1K' | '2K' | '4K';
  defaultAspectRatio: string;
}

interface ProjectState {
  // 项目基本信息
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  
  // 品牌信息
  brandInfo: BrandInfo;
  designSession: DesignSessionState;
  
  // 项目设置
  settings: ProjectSettings;
  
  // 元数据
  createdAt: number;
  updatedAt: number;
  lastSavedAt: number;
  
  // 统计信息
  stats: {
    totalElements: number;
    totalAssets: number;
    totalMessages: number;
  };
  
  // Actions
  actions: {
    // 项目管理
    setProjectId: (id: string) => void;
    setTitle: (title: string) => void;
    setDescription: (description: string) => void;
    setThumbnail: (thumbnail: string) => void;
    
    // 品牌信息
    setBrandInfo: (brandInfo: Partial<BrandInfo>) => void;
    updateBrandInfo: (updates: Partial<BrandInfo>) => void;
    updateDesignSession: (updates: Partial<DesignSessionState>) => void;
    setTaskMode: (taskMode: DesignTaskMode) => void;
    
    // 设置
    updateSettings: (settings: Partial<ProjectSettings>) => void;
    
    // 元数据
    updateTimestamp: () => void;
    markSaved: () => void;
    
    // 统计
    updateStats: (stats: Partial<ProjectState['stats']>) => void;
    incrementStat: (key: keyof ProjectState['stats'], delta?: number) => void;
    
    // 重置
    reset: () => void;
    loadProject: (projectData: Partial<ProjectState>) => void;
  };
}

const initialState: Omit<ProjectState, 'actions'> = {
  id: '',
  title: '未命名项目',
  description: '',
  thumbnail: '',
  
  brandInfo: {
    name: '',
    colors: [],
    fonts: [],
    style: ''
  },

  designSession: {
    taskMode: 'generate',
    brand: {
      name: '',
      colors: [],
      fonts: [],
      style: '',
    },
    styleHints: [],
    subjectAnchors: [],
    subjectAnchorMode: 'auto',
    consistencyCheckEnabled: true,
    referenceSummary: '',
    constraints: [],
    forbiddenChanges: [],
    approvedAssetIds: [],
    researchSummary: '',
    referenceWebPages: [],
  },
  
  settings: {
    autoSave: true,
    autoSaveInterval: 30,
    defaultImageQuality: '2K',
    defaultAspectRatio: '1:1'
  },
  
  createdAt: Date.now(),
  updatedAt: Date.now(),
  lastSavedAt: 0,
  
  stats: {
    totalElements: 0,
    totalAssets: 0,
    totalMessages: 0
  }
};

export const useProjectStore = create<ProjectState>()(
  devtools(
  persist(
    immer((set) => ({
      ...initialState,
      
      actions: {
        setProjectId: (id) => set((state) => {
          const isNewProject = state.id !== id;
          if (isNewProject) {
            // 切换到新项目时，清除上个项目遗留的图片引用，避免一致性检测污染
            state.designSession.approvedAssetIds = [];
            state.designSession.subjectAnchors = [];
            state.designSession.subjectAnchorMode = 'auto';
            state.designSession.referenceSummary = '';
            state.designSession.researchSummary = '';
            state.designSession.referenceWebPages = [];
            state.designSession.styleHints = [];
            state.designSession.constraints = [];
            state.designSession.forbiddenChanges = [];
          }
          state.id = id;
          state.updatedAt = Date.now();
        }),
        
        setTitle: (title) => set({ title, updatedAt: Date.now() }),
        
        setDescription: (description) => set({ description, updatedAt: Date.now() }),
        
        setThumbnail: (thumbnail) => set({ thumbnail, updatedAt: Date.now() }),
        
        setBrandInfo: (brandInfo) => set((state) => {
          state.brandInfo = brandInfo as BrandInfo;
          state.designSession.brand = { ...state.designSession.brand, ...state.brandInfo };
          state.updatedAt = Date.now();
        }),
        
        updateBrandInfo: (updates) => set((state) => {
          state.brandInfo = { ...state.brandInfo, ...updates };
          state.designSession.brand = { ...state.designSession.brand, ...state.brandInfo };
          state.updatedAt = Date.now();
        }),

        updateDesignSession: (updates) => set((state) => {
          state.designSession = {
            ...state.designSession,
            ...updates,
            brand: {
              ...state.designSession.brand,
              ...state.brandInfo,
              ...(updates.brand || {}),
            },
            styleHints:
              updates.styleHints !== undefined
                ? updates.styleHints
                : state.designSession.styleHints,
            subjectAnchorMode:
              updates.subjectAnchorMode !== undefined
                ? updates.subjectAnchorMode
                : state.designSession.subjectAnchorMode,
            subjectAnchors:
              updates.subjectAnchors !== undefined
                ? updates.subjectAnchors
                : state.designSession.subjectAnchors,
            constraints:
              updates.constraints !== undefined
                ? updates.constraints
                : state.designSession.constraints,
            forbiddenChanges:
              updates.forbiddenChanges !== undefined
                ? updates.forbiddenChanges
                : state.designSession.forbiddenChanges,
            approvedAssetIds:
              updates.approvedAssetIds !== undefined
                ? updates.approvedAssetIds
                : state.designSession.approvedAssetIds,
          };
          state.updatedAt = Date.now();
        }),

        setTaskMode: (taskMode) => set((state) => {
          state.designSession.taskMode = taskMode;
          state.updatedAt = Date.now();
        }),
        
        updateSettings: (updates) => set((state) => {
          state.settings = { ...state.settings, ...updates };
          state.updatedAt = Date.now();
        }),
        
        updateTimestamp: () => set({ updatedAt: Date.now() }),
        
        markSaved: () => set({ lastSavedAt: Date.now() }),
        
        updateStats: (updates) => set((state) => {
          state.stats = { ...state.stats, ...updates };
        }),
        
        incrementStat: (key, delta = 1) => set((state) => {
          state.stats[key] += delta;
        }),
        
        reset: () => set({
          ...initialState,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }),
        
        loadProject: (projectData) => set((state) => {
          const { actions: _actions, ...safeData } = projectData as any;
          Object.assign(state, safeData);
          state.designSession = {
            ...initialState.designSession,
            ...state.designSession,
            taskMode: 'generate',
            brand: {
              ...initialState.designSession.brand,
              ...state.brandInfo,
              ...(state.designSession?.brand || {}),
            },
            subjectAnchors: [],
            approvedAssetIds: [],
            referenceSummary: '',
            researchSummary: '',
            referenceWebPages: [],
          };
          state.updatedAt = Date.now();
        })
      }
    })),
    {
      name: 'xc-studio-project',
      storage: createJSONStorage(() => safeLocalStorageStateStorage),
      partialize: (state) => ({
        id: state.id,
        title: state.title,
        description: state.description,
        brandInfo: state.brandInfo,
        designSession: compactDesignSessionForPersist(state.designSession),
        settings: state.settings,
        createdAt: state.createdAt,
        updatedAt: state.updatedAt
      })
    }
  ),
  { name: 'ProjectStore' })
);
