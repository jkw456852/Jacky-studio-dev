import prisma from '../config/database.js';
import { CreatePermissionInput, UpdatePermissionInput, PaginationInput } from '../types/schemas.js';
import { PermissionResponse, PermissionListResponse } from '../types/responses.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * 获取权限列表
 */
export const getPermissions = async (pagination: PaginationInput): Promise<PermissionListResponse> => {
  const { page, limit } = pagination;
  const skip = (page - 1) * limit;

  const [permissions, total] = await Promise.all([
    prisma.permission.findMany({
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        resource: true,
        action: true,
        description: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.permission.count(),
  ]);

  return {
    permissions,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * 获取单个权限
 */
export const getPermissionById = async (id: string): Promise<PermissionResponse> => {
  const permission = await prisma.permission.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      resource: true,
      action: true,
      description: true,
      createdAt: true,
    },
  });

  if (!permission) {
    throw new AppError(404, '权限不存在');
  }

  return permission;
};

/**
 * 创建权限
 */
export const createPermission = async (input: CreatePermissionInput): Promise<PermissionResponse> => {
  // 检查权限名是否已存在
  const existingPermission = await prisma.permission.findUnique({
    where: { name: input.name },
  });

  if (existingPermission) {
    throw new AppError(409, '权限名已存在');
  }

  // 创建权限
  const permission = await prisma.permission.create({
    data: {
      name: input.name,
      resource: input.resource,
      action: input.action,
      description: input.description,
    },
    select: {
      id: true,
      name: true,
      resource: true,
      action: true,
      description: true,
      createdAt: true,
    },
  });

  return permission;
};

/**
 * 更新权限
 */
export const updatePermission = async (id: string, input: UpdatePermissionInput): Promise<PermissionResponse> => {
  // 检查权限是否存在
  const existingPermission = await prisma.permission.findUnique({
    where: { id },
  });

  if (!existingPermission) {
    throw new AppError(404, '权限不存在');
  }

  // 如果更新权限名，检查是否与其他权限冲突
  if (input.name && input.name !== existingPermission.name) {
    const nameExists = await prisma.permission.findUnique({
      where: { name: input.name },
    });

    if (nameExists) {
      throw new AppError(409, '权限名已存在');
    }
  }

  // 构建更新数据
  const updateData: {
    name?: string;
    resource?: string;
    action?: string;
    description?: string | null;
  } = {};

  if (input.name) updateData.name = input.name;
  if (input.resource) updateData.resource = input.resource;
  if (input.action) updateData.action = input.action;
  if (input.description !== undefined) updateData.description = input.description || null;

  // 更新权限
  const permission = await prisma.permission.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      resource: true,
      action: true,
      description: true,
      createdAt: true,
    },
  });

  return permission;
};

/**
 * 删除权限
 */
export const deletePermission = async (id: string): Promise<void> => {
  const permission = await prisma.permission.findUnique({
    where: { id },
  });

  if (!permission) {
    throw new AppError(404, '权限不存在');
  }

  await prisma.permission.delete({
    where: { id },
  });
};
