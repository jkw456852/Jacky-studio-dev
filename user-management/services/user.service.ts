import { apiClient } from './api-client';
import {
  User,
  UserCreateRequest,
  UserUpdateRequest,
  UserResponse,
  UsersResponse,
} from '../types/user.types';
import { ApiResponse, PaginationParams } from '../types/api.types';

export class UserService {
  // 获取用户列表
  async getUsers(params?: PaginationParams): Promise<UsersResponse> {
    const queryParams = new URLSearchParams();
    
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.sort) queryParams.append('sort', params.sort);
    if (params?.order) queryParams.append('order', params.order);
    if (params?.search) queryParams.append('search', params.search);
    
    const url = `/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get<UsersResponse>(url);
  }

  // 获取单个用户
  async getUser(id: string): Promise<UserResponse> {
    return apiClient.get<UserResponse>(`/users/${id}`);
  }

  // 创建用户
  async createUser(data: UserCreateRequest): Promise<UserResponse> {
    return apiClient.post<UserResponse>('/users', data);
  }

  // 更新用户
  async updateUser(id: string, data: UserUpdateRequest): Promise<UserResponse> {
    return apiClient.put<UserResponse>(`/users/${id}`, data);
  }

  // 删除用户
  async deleteUser(id: string): Promise<ApiResponse> {
    return apiClient.delete<ApiResponse>(`/users/${id}`);
  }

  // 批量删除用户
  async deleteUsers(ids: string[]): Promise<ApiResponse> {
    return apiClient.post<ApiResponse>('/users/batch-delete', { ids });
  }

  // 激活/禁用用户
  async updateUserStatus(id: string, status: 'active' | 'inactive' | 'suspended'): Promise<UserResponse> {
    return apiClient.patch<UserResponse>(`/users/${id}/status`, { status });
  }

  // 更新用户角色
  async updateUserRole(id: string, role: string): Promise<UserResponse> {
    return apiClient.patch<UserResponse>(`/users/${id}/role`, { role });
  }

  // 搜索用户
  async searchUsers(query: string, params?: PaginationParams): Promise<UsersResponse> {
    const searchParams = new URLSearchParams();
    searchParams.append('search', query);
    
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.sort) searchParams.append('sort', params.sort);
    if (params?.order) searchParams.append('order', params.order);
    
    const url = `/users/search${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return apiClient.get<UsersResponse>(url);
  }

  // 导出用户列表
  async exportUsers(params?: PaginationParams): Promise<Blob> {
    const queryParams = new URLSearchParams();
    
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.sort) queryParams.append('sort', params.sort);
    if (params?.order) queryParams.append('order', params.order);
    if (params?.search) queryParams.append('search', params.search);
    
    const url = `/users/export${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiClient.get(url, {
      responseType: 'blob',
    });
    
    return response;
  }

  // 获取用户统计
  async getUserStats(): Promise<ApiResponse> {
    return apiClient.get<ApiResponse>('/users/stats');
  }
}

// 导出单例实例
export const userService = new UserService();