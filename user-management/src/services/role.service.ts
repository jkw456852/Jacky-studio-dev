import prisma from '../config/database.js';
import { Prisma } from '@prisma/client';
import { CreateRoleInput, UpdateRoleInput, PaginationInput } from '../types/schemas.js';
import { RoleResponse, RoleListResponse } from '../types/responses.js';
import { AppError } from '../middleware/errorHandler.js';

const permissionSelect = Prisma.validator<Prisma.PermissionSelect>()({
  id: true,
  name: true,
  resource: true,
  action: true,
  description: true,
  createdAt: true,
});

const roleWithPermissionsSelect = Prisma.validator<Prisma.RoleSelect>()({
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  permissions: {
    select: {
      permission: {
        select: permissionSelect,
      },
    },
  },
});

type RoleWithPermissionsRecord = Prisma.RoleGetPayload<{
  select: typeof roleWithPermissionsSelect;
}>;

const mapRoleResponse = (role: RoleWithPermissionsRecord): RoleResponse => ({
  id: role.id,
  name: role.name,
  description: role.description,
  createdAt: role.createdAt,
  updatedAt: role.updatedAt,
  permissions: role.permissions.map(({ permission }) => permission),
});

/**
 * 获取角色列表
 */
export const getRoles = async (pagination: PaginationInput): Promise<RoleListResponse> => {
  const { page, limit } = pagination;
  const skip = (page - 1) * limit;

  const [roles, total] = await Promise.all([
    prisma.role.findMany({
      skip,
      take: limit,
      select: roleWithPermissionsSelect,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.role.count(),
  ]);

  return {
    roles: roles.map(mapRoleResponse),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * 获取单个角色
 */
export const getRoleById = async (id: string): Promise<RoleResponse> => {
  const role = await prisma.role.findUnique({
    where: { id },
    select: roleWithPermissionsSelect,
  });

  if (!role) {
    throw new AppError(404, '角色不存在');
  }

  return mapRoleResponse(role);
};

/**
 * 创建角色
 */
export const createRole = async (input: CreateRoleInput): Promise<RoleResponse> => {
  // 检查角色名是否已存在
  const existingRole = await prisma.role.findUnique({
    where: { name: input.name },
  });

  if (existingRole) {
    throw new AppError(409, '角色名已存在');
  }

  // 创建角色
  const role = await prisma.role.create({
    data: {
      name: input.name,
      description: input.description,
      permissions: input.permissionIds?.length
        ? {
            create: input.permissionIds.map((permissionId) => ({
              permission: {
                connect: { id: permissionId },
              },
            })),
          }
        : undefined,
    },
    select: roleWithPermissionsSelect,
  });

  return mapRoleResponse(role);
};

/**
 * 更新角色
 */
export const updateRole = async (id: string, input: UpdateRoleInput): Promise<RoleResponse> => {
  // 检查角色是否存在
  const existingRole = await prisma.role.findUnique({
    where: { id },
  });

  if (!existingRole) {
    throw new AppError(404, '角色不存在');
  }

  // 如果更新角色名，检查是否与其他角色冲突
  if (input.name && input.name !== existingRole.name) {
    const nameExists = await prisma.role.findUnique({
      where: { name: input.name },
    });

    if (nameExists) {
      throw new AppError(409, '角色名已存在');
    }
  }

  // 构建更新数据
  const updateData: Prisma.RoleUpdateInput = {};

  if (input.name) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description || null;
  if (input.permissionIds !== undefined) {
    updateData.permissions = {
      deleteMany: {},
      ...(input.permissionIds.length > 0
        ? {
            create: input.permissionIds.map((permissionId) => ({
              permission: {
                connect: { id: permissionId },
              },
            })),
          }
        : {}),
    };
  }

  // 更新角色
  const role = await prisma.role.update({
    where: { id },
    data: updateData,
    select: roleWithPermissionsSelect,
  });

  return mapRoleResponse(role);
};

/**
 * 删除角色
 */
export const deleteRole = async (id: string): Promise<void> => {
  const role = await prisma.role.findUnique({
    where: { id },
  });

  if (!role) {
    throw new AppError(404, '角色不存在');
  }

  await prisma.role.delete({
    where: { id },
  });
};
