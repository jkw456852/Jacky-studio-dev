import { User, Role, Permission } from '@prisma/client';

// 用户信息（不含密码）
export interface UserResponse {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  roles?: RoleResponse[];
}

// 用户列表响应
export interface UserListResponse {
  users: UserResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 角色信息
export interface RoleResponse {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  permissions?: PermissionResponse[];
}

// 角色列表响应
export interface RoleListResponse {
  roles: RoleResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 权限信息
export interface PermissionResponse {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string | null;
  createdAt: Date;
}

// 权限列表响应
export interface PermissionListResponse {
  permissions: PermissionResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// JWT载荷
export interface JwtPayload {
  userId: string;
  email: string;
}

// JWT响应
export interface AuthResponse {
  token: string;
  user: UserResponse;
}

// API响应格式
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 扩展Prisma User类型（添加关系）
export interface UserWithRoles extends User {
  roles: Array<Role & { permissions: Permission[] }>;
}

// 扩展Prisma Role类型
export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}
