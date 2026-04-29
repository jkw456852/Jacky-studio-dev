import { create } from 'zustand';
import { roleService } from '../services/role.service';
import { Role, Permission } from '../types/user.types';
import { ApiError, PaginationParams } from '../types/api.types';

interface RoleState {
  roles: Role[];
  permissions: Permission[];
  permissionCategories: string[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  isLoading: boolean;
  error: ApiError | null;
  searchQuery: string;
  selectedRoles: string[];
  
  // Actions
  fetchRoles: (params?: PaginationParams) => Promise<void>;
  fetchPermissions: () => Promise<void>;
  searchRoles: (query: string) => Promise<void>;
  createRole: (roleData: any) => Promise<Role | null>;
  updateRole: (id: string, roleData: any) => Promise<Role | null>;
  deleteRole: (id: string) => Promise<boolean>;
  updateRolePermissions: (id: string, permissions: string[]) => Promise<boolean>;
  selectRole: (id: string) => void;
  selectAllRoles: (ids: string[]) => void;
  clearSelectedRoles: () => void;
  setSearchQuery: (query: string) => void;
  clearError: () => void;
}

export const useRoleStore = create<RoleState>()((set, get) => ({
  roles: [],
  permissions: [],
  permissionCategories: [],
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0,
  isLoading: false,
  error: null,
  searchQuery: '',
  selectedRoles: [],

  fetchRoles: async (params?: PaginationParams) => {
    set({ isLoading: true, error: null });
    
    try {
      const currentParams = {
        page: params?.page || get().page,
        limit: params?.limit || get().limit,
        sort: params?.sort,
        order: params?.order,
        search: params?.search || get().searchQuery,
      };
      
      const response = await roleService.getRoles(currentParams);
      
      if (response.success) {
        set({
          roles: response.data.roles,
          total: response.data.total,
          page: response.data.page,
          limit: response.data.limit,
          totalPages: response.data.totalPages,
          isLoading: false,
          error: null,
        });
      } else {
        set({
          isLoading: false,
          error: {
            status: 400,
            message: response.message || '获取角色列表失败',
          },
        });
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error as ApiError,
      });
    }
  },

  fetchPermissions: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await roleService.getPermissions();
      
      if (response.success) {
        set({
          permissions: response.data.permissions,
          permissionCategories: response.data.categories,
          isLoading: false,
          error: null,
        });
      } else {
        set({
          isLoading: false,
          error: {
            status: 400,
            message: response.message || '获取权限列表失败',
          },
        });
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error as ApiError,
      });
    }
  },

  searchRoles: async (query: string) => {
    set({ isLoading: true, error: null, searchQuery: query });
    
    try {
      const response = await roleService.getRoles({
        page: get().page,
        limit: get().limit,
        search: query,
      });
      
      if (response.success) {
        set({
          roles: response.data.roles,
          total: response.data.total,
          page: response.data.page,
          limit: response.data.limit,
          totalPages: response.data.totalPages,
          isLoading: false,
          error: null,
        });
      } else {
        set({
          isLoading: false,
          error: {
            status: 400,
            message: response.message || '搜索角色失败',
          },
        });
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error as ApiError,
      });
    }
  },

  createRole: async (roleData: any) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await roleService.createRole(roleData);
      
      if (response.success) {
        const newRole = response.data;
        
        set((state) => ({
          roles: [newRole, ...state.roles],
          total: state.total + 1,
          isLoading: false,
          error: null,
        }));
        
        return newRole;
      } else {
        set({
          isLoading: false,
          error: {
            status: 400,
            message: response.message || '创建角色失败',
          },
        });
        return null;
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error as ApiError,
      });
      return null;
    }
  },

  updateRole: async (id: string, roleData: any) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await roleService.updateRole(id, roleData);
      
      if (response.success) {
        const updatedRole = response.data;
        
        set((state) => ({
          roles: state.roles.map((role) => 
            role.id === id ? updatedRole : role
          ),
          isLoading: false,
          error: null,
        }));
        
        return updatedRole;
      } else {
        set({
          isLoading: false,
          error: {
            status: 400,
            message: response.message || '更新角色失败',
          },
        });
        return null;
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error as ApiError,
      });
      return null;
    }
  },

  deleteRole: async (id: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await roleService.deleteRole(id);
      
      if (response.success) {
        set((state) => ({
          roles: state.roles.filter((role) => role.id !== id),
          total: state.total - 1,
          selectedRoles: state.selectedRoles.filter((roleId) => roleId !== id),
          isLoading: false,
          error: null,
        }));
        
        return true;
      } else {
        set({
          isLoading: false,
          error: {
            status: 400,
            message: response.message || '删除角色失败',
          },
        });
        return false;
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error as ApiError,
      });
      return false;
    }
  },

  updateRolePermissions: async (id: string, permissions: string[]) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await roleService.updateRolePermissions(id, permissions);
      
      if (response.success) {
        const updatedRole = response.data;
        
        set((state) => ({
          roles: state.roles.map((role) => 
            role.id === id ? updatedRole : role
          ),
          isLoading: false,
          error: null,
        }));
        
        return true;
      } else {
        set({
          isLoading: false,
          error: {
            status: 400,
            message: response.message || '更新角色权限失败',
          },
        });
        return false;
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error as ApiError,
      });
      return false;
    }
  },

  selectRole: (id: string) => {
    set((state) => {
      const isSelected = state.selectedRoles.includes(id);
      
      if (isSelected) {
        return {
          selectedRoles: state.selectedRoles.filter((roleId) => roleId !== id),
        };
      } else {
        return {
          selectedRoles: [...state.selectedRoles, id],
        };
      }
    });
  },

  selectAllRoles: (ids: string[]) => {
    const { selectedRoles } = get();
    const allSelected = ids.every((id) => selectedRoles.includes(id));
    
    if (allSelected) {
      set({ selectedRoles: [] });
    } else {
      set({ selectedRoles: [...ids] });
    }
  },

  clearSelectedRoles: () => {
    set({ selectedRoles: [] });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  clearError: () => {
    set({ error: null });
  },
}));