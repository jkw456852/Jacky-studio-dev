export interface User {
  id: string;
  email: string;
  username: string;
  fullName?: string;
  avatar?: string;
  phone?: string;
  status: 'active' | 'inactive' | 'suspended';
  role: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface UserCreateRequest {
  email: string;
  username: string;
  password: string;
  fullName?: string;
  phone?: string;
  role: string;
}

export interface UserUpdateRequest {
  email?: string;
  username?: string;
  fullName?: string;
  phone?: string;
  status?: 'active' | 'inactive' | 'suspended';
  role?: string;
}

export interface UserResponse {
  success: boolean;
  data: User;
  message?: string;
}

export interface UsersResponse {
  success: boolean;
  data: {
    users: User[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  message?: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
    refreshToken?: string;
  };
  message?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  fullName?: string;
  phone?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoleCreateRequest {
  name: string;
  description?: string;
  permissions: string[];
}

export interface RoleUpdateRequest {
  name?: string;
  description?: string;
  permissions?: string[];
}

export interface RoleResponse {
  success: boolean;
  data: Role;
  message?: string;
}

export interface RolesResponse {
  success: boolean;
  data: {
    roles: Role[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  message?: string;
}

export interface Permission {
  id: string;
  name: string;
  description?: string;
  category: string;
}

export interface PermissionsResponse {
  success: boolean;
  data: {
    permissions: Permission[];
    categories: string[];
  };
  message?: string;
}