import { create } from 'zustand';
import { userService } from '../services/user.service';
import { User } from '../types/user.types';
import { ApiError, PaginationParams } from '../types/api.types';

interface UserListState {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  isLoading: boolean;
  error: ApiError | null;
  searchQuery: string;
  selectedUsers: string[];
  
  // Actions
  fetchUsers: (params?: PaginationParams) => Promise<void>;
  searchUsers: (query: string) => Promise<void>;
  createUser: (userData: any) => Promise<User | null>;
  updateUser: (id: string, userData: any) => Promise<User | null>;
  deleteUser: (id: string) => Promise<boolean>;
  deleteSelectedUsers: () => Promise<boolean>;
  updateUserStatus: (id: string, status: 'active' | 'inactive' | 'suspended') => Promise<boolean>;
  updateUserRole: (id: string, role: string) => Promise<boolean>;
  selectUser: (id: string) => void;
  selectAllUsers: (ids: string[]) => void;
  clearSelectedUsers: () => void;
  setSearchQuery: (query: string) => void;
  clearError: () => void;
}

export const useUserStore = create<UserListState>()((set, get) => ({
  users: [],
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0,
  isLoading: false,
  error: null,
  searchQuery: '',
  selectedUsers: [],

  fetchUsers: async (params?: PaginationParams) => {
    set({ isLoading: true, error: null });
    
    try {
      const currentParams = {
        page: params?.page || get().page,
        limit: params?.limit || get().limit,
        sort: params?.sort,
        order: params?.order,
        search: params?.search || get().searchQuery,
      };
      
      const response = await userService.getUsers(currentParams);
      
      if (response.success) {
        set({
          users: response.data.users,
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
            message: response.message || '获取用户列表失败',
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

  searchUsers: async (query: string) => {
    set({ isLoading: true, error: null, searchQuery: query });
    
    try {
      const response = await userService.searchUsers(query, {
        page: get().page,
        limit: get().limit,
      });
      
      if (response.success) {
        set({
          users: response.data.users,
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
            message: response.message || '搜索用户失败',
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

  createUser: async (userData: any) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await userService.createUser(userData);
      
      if (response.success) {
        const newUser = response.data;
        
        set((state) => ({
          users: [newUser, ...state.users],
          total: state.total + 1,
          isLoading: false,
          error: null,
        }));
        
        return newUser;
      } else {
        set({
          isLoading: false,
          error: {
            status: 400,
            message: response.message || '创建用户失败',
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

  updateUser: async (id: string, userData: any) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await userService.updateUser(id, userData);
      
      if (response.success) {
        const updatedUser = response.data;
        
        set((state) => ({
          users: state.users.map((user) => 
            user.id === id ? updatedUser : user
          ),
          isLoading: false,
          error: null,
        }));
        
        return updatedUser;
      } else {
        set({
          isLoading: false,
          error: {
            status: 400,
            message: response.message || '更新用户失败',
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

  deleteUser: async (id: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await userService.deleteUser(id);
      
      if (response.success) {
        set((state) => ({
          users: state.users.filter((user) => user.id !== id),
          total: state.total - 1,
          selectedUsers: state.selectedUsers.filter((userId) => userId !== id),
          isLoading: false,
          error: null,
        }));
        
        return true;
      } else {
        set({
          isLoading: false,
          error: {
            status: 400,
            message: response.message || '删除用户失败',
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

  deleteSelectedUsers: async () => {
    const { selectedUsers } = get();
    
    if (selectedUsers.length === 0) return false;
    
    set({ isLoading: true, error: null });
    
    try {
      const response = await userService.deleteUsers(selectedUsers);
      
      if (response.success) {
        set((state) => ({
          users: state.users.filter((user) => !selectedUsers.includes(user.id)),
          total: state.total - selectedUsers.length,
          selectedUsers: [],
          isLoading: false,
          error: null,
        }));
        
        return true;
      } else {
        set({
          isLoading: false,
          error: {
            status: 400,
            message: response.message || '批量删除用户失败',
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

  updateUserStatus: async (id: string, status: 'active' | 'inactive' | 'suspended') => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await userService.updateUserStatus(id, status);
      
      if (response.success) {
        const updatedUser = response.data;
        
        set((state) => ({
          users: state.users.map((user) => 
            user.id === id ? updatedUser : user
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
            message: response.message || '更新用户状态失败',
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

  updateUserRole: async (id: string, role: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await userService.updateUserRole(id, role);
      
      if (response.success) {
        const updatedUser = response.data;
        
        set((state) => ({
          users: state.users.map((user) => 
            user.id === id ? updatedUser : user
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
            message: response.message || '更新用户角色失败',
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

  selectUser: (id: string) => {
    set((state) => {
      const isSelected = state.selectedUsers.includes(id);
      
      if (isSelected) {
        return {
          selectedUsers: state.selectedUsers.filter((userId) => userId !== id),
        };
      } else {
        return {
          selectedUsers: [...state.selectedUsers, id],
        };
      }
    });
  },

  selectAllUsers: (ids: string[]) => {
    const { selectedUsers } = get();
    const allSelected = ids.every((id) => selectedUsers.includes(id));
    
    if (allSelected) {
      set({ selectedUsers: [] });
    } else {
      set({ selectedUsers: [...ids] });
    }
  },

  clearSelectedUsers: () => {
    set({ selectedUsers: [] });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  clearError: () => {
    set({ error: null });
  },
}));