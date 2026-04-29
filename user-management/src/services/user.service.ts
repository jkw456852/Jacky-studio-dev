import prisma from '../config/database.js';
import { Prisma } from '@prisma/client';
import { UpdateUserInput, PaginationInput } from '../types/schemas.js';
import { UserResponse, UserListResponse } from '../types/responses.js';
import { AppError } from '../middleware/errorHandler.js';

const roleSelect = Prisma.validator<Prisma.RoleSelect>()({
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
});

const userWithRolesSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  email: true,
  name: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  roles: {
    select: {
      role: {
        select: roleSelect,
      },
    },
  },
});

type UserWithRolesRecord = Prisma.UserGetPayload<{
  select: typeof userWithRolesSelect;
}>;

const mapUserResponse = (user: UserWithRolesRecord): UserResponse => ({
  id: user.id,
  email: user.email,
  name: user.name,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  roles: user.roles.map(({ role }) => role),
});

/**
 * 获取用户列表
 */
export const getUsers = async (pagination: PaginationInput): Promise<UserListResponse> => {
  const { page, limit } = pagination;
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: limit,
      select: userWithRolesSelect,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count(),
  ]);

  return {
    users: users.map(mapUserResponse),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * 获取单个用户
 */
export const getUserById = async (id: string): Promise<UserResponse> => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: userWithRolesSelect,
  });

  if (!user) {
    throw new AppError(404, '用户不存在');
  }

  return mapUserResponse(user);
};

/**
 * 更新用户
 */
export const updateUser = async (id: string, input: UpdateUserInput): Promise<UserResponse> => {
  // 检查用户是否存在
  const existingUser = await prisma.user.findUnique({
    where: { id },
  });

  if (!existingUser) {
    throw new AppError(404, '用户不存在');
  }

  // 如果更新邮箱，检查是否与其他用户冲突
  if (input.email && input.email !== existingUser.email) {
    const emailExists = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (emailExists) {
      throw new AppError(409, '邮箱已被使用');
    }
  }

  // 构建更新数据
  const updateData: Prisma.UserUpdateInput = {};

  if (input.email) updateData.email = input.email;
  if (input.name !== undefined) updateData.name = input.name || null;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;
  if (input.roleIds !== undefined) {
    updateData.roles = {
      deleteMany: {},
      ...(input.roleIds.length > 0
        ? {
            create: input.roleIds.map((roleId) => ({
              role: {
                connect: { id: roleId },
              },
            })),
          }
        : {}),
    };
  }

  // 更新用户
  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: userWithRolesSelect,
  });

  return mapUserResponse(user);
};

/**
 * 删除用户
 */
export const deleteUser = async (id: string): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new AppError(404, '用户不存在');
  }

  await prisma.user.delete({
    where: { id },
  });
};
