import { apiClient } from './api-client';
import {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  UserResponse,
} from '../types/user.types';
import { ApiResponse } from '../types/api.types';

export class AuthService {
  // 登录
  async login(data: LoginRequest, remember: boolean = false): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/login', data);
    
    if (response.success && response.data.token) {
      apiClient.setToken(response.data.token, remember);
      
      // 存储用户信息
      if (typeof window !== 'undefined') {
        const storage = remember ? localStorage : sessionStorage;
        storage.setItem('user', JSON.stringify(response.data.user));
      }
    }
    
    return response;
  }

  // 注册
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/register', data);
    
    if (response.success && response.data.token) {
      apiClient.setToken(response.data.token, false);
      
      // 存储用户信息
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('user', JSON.stringify(response.data.user));
      }
    }
    
    return response;
  }

  // 登出
  async logout(): Promise<ApiResponse> {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      // 即使API调用失败，也要清除本地存储
    }
    
    // 清除本地存储
    this.clearAuthData();
    
    return {
      success: true,
      data: null,
      message: '登出成功',
      timestamp: new Date().toISOString(),
    };
  }

  // 获取当前用户
  async getCurrentUser(): Promise<UserResponse> {
    return apiClient.get<UserResponse>('/auth/me');
  }

  // 刷新token
  async refreshToken(): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/refresh');
    
    if (response.success && response.data.token) {
      apiClient.setToken(response.data.token, true);
    }
    
    return response;
  }

  // 忘记密码 - 发送重置邮件
  async forgotPassword(email: string): Promise<ApiResponse> {
    return apiClient.post<ApiResponse>('/auth/forgot-password', { email });
  }

  // 重置密码
  async resetPassword(token: string, password: string): Promise<ApiResponse> {
    return apiClient.post<ApiResponse>('/auth/reset-password', { token, password });
  }

  // 验证重置token
  async validateResetToken(token: string): Promise<ApiResponse> {
    return apiClient.get<ApiResponse>(`/auth/validate-reset-token/${token}`);
  }

  // 检查登录状态
  isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    return !!token;
  }

  // 获取当前用户信息
  getCurrentUserFromStorage(): any {
    if (typeof window === 'undefined') return null;
    
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  // 清除认证数据
  clearAuthData(): void {
    apiClient.removeToken();
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('user');
    }
  }

  // 更新用户存储
  updateUserStorage(user: any): void {
    if (typeof window === 'undefined') return;
    
    const storage = localStorage.getItem('auth_token') ? localStorage : sessionStorage;
    storage.setItem('user', JSON.stringify(user));
  }
}

// 导出单例实例
export const authService = new AuthService();