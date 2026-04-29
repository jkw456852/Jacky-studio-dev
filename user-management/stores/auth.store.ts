import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services/auth.service';
import { User } from '../types/user.types';
import { ApiError } from '../types/api.types';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: ApiError | null;
  isAuthenticated: boolean;
  
  // Actions
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  register: (email: string, username: string, password: string, fullName?: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
  updateUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,
      isAuthenticated: false,

      login: async (email: string, password: string, remember: boolean) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await authService.login({ email, password }, remember);
          
          if (response.success) {
            set({
              user: response.data.user,
              token: response.data.token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            set({
              isLoading: false,
              error: {
                status: 400,
                message: response.message || '登录失败',
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

      register: async (email: string, username: string, password: string, fullName?: string, phone?: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await authService.register({ email, username, password, fullName, phone });
          
          if (response.success) {
            set({
              user: response.data.user,
              token: response.data.token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            set({
              isLoading: false,
              error: {
                status: 400,
                message: response.message || '注册失败',
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

      logout: async () => {
        set({ isLoading: true });
        
        try {
          await authService.logout();
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          // 即使API调用失败，也要清除本地状态
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      refreshUser: async () => {
        set({ isLoading: true });
        
        try {
          const response = await authService.getCurrentUser();
          
          if (response.success) {
            set({
              user: response.data,
              isLoading: false,
              error: null,
            });
          } else {
            set({
              isLoading: false,
              error: {
                status: 400,
                message: response.message || '获取用户信息失败',
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

      clearError: () => {
        set({ error: null });
      },

      updateUser: (user: User) => {
        set({ user });
        authService.updateUserStorage(user);
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);