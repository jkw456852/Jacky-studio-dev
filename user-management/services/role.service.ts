import { apiClient } from './api-client';
import {
  Role,
  RoleCreateRequest,
  RoleUpdateRequest,
  RoleResponse,
  RolesResponse,
  PermissionsResponse,
} from '../types/user.types';
import { ApiResponse, PaginationParams } from '../types/api.types';

export class RoleService {
  // 获取角色列表
  async getRoles(params?: PaginationParams): Promise<RolesResponse> {
    const queryParams = new URLSearchParams();
    
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.sort) queryParams.append('sort', params.sort);
    if (params?.order) queryParams.append('order', params.order);
    if (params?.search) queryParams.append('search', params.search);
    
    const url = `/roles${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get<RolesResponse>(url);
  }

  // 获取单个角色
  async getRole(id: string): Promise<RoleResponse> {
    return apiClient.get<RoleResponse>(`/roles/${id}`);
  }

  // 创建角色
  async createRole(data: RoleCreateRequest): Promise<RoleResponse> {
    return apiClient.post<RoleResponse>('/roles', data);
  }

  // 更新角色
  async updateRole(id: string, data: RoleUpdateRequest): Promise<RoleResponse> {
    return apiClient.put<RoleResponse>(`/roles/${id}`, data);
  }

  // 删除角色
  async deleteRole(id: string): Promise<ApiResponse> {
    return apiClient.delete<ApiResponse>(`/roles/${id}`);
  }

  // 获取权限列表
  async getPermissions(): Promise<PermissionsResponse> {
    return apiClient.get<PermissionsResponse>('/permissions');
  }

  // 获取角色权限
  async getRolePermissions(id: string): Promise<PermissionsResponse> {
    return apiClient.get<PermissionsResponse>(`/roles/${id}/permissions`);
  }

  // 更新角色权限
  async updateRolePermissions(id: string, permissions: string[]): Promise<RoleResponse> {
    return apiClient.put<RoleResponse>(`/roles/${id}/permissions`, { permissions });
  }

  // 获取系统默认角色
  async getSystemRoles(): Promise<RolesResponse> {
    return apiClient.get<RolesResponse>('/roles/system');
  }

  // 检查角色是否在使用中
  async checkRoleInUse(id: string): Promise<ApiResponse> {
    return apiClient.get<ApiResponse>(`/roles/${id}/in-use`);
  }

  // 获取角色统计
  async getRoleStats(): Promise<ApiResponse> {
    return apiClient.get<ApiResponse>('/roles/stats');
  }
}

// 导出单例实例
export const roleService = new RoleService();