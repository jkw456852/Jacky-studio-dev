import { z } from 'zod';

// 用户注册验证
export const registerSchema = z.object({
  email: z.string().email('无效的邮箱格式'),
  password: z.string().min(8, '密码至少8个字符').max(100, '密码最多100个字符'),
  name: z.string().min(1, '姓名不能为空').max(50, '姓名最多50个字符').optional(),
});

// 用户登录验证
export const loginSchema = z.object({
  email: z.string().email('无效的邮箱格式'),
  password: z.string().min(1, '密码不能为空'),
});

// 更新用户验证
export const updateUserSchema = z.object({
  email: z.string().email('无效的邮箱格式').optional(),
  name: z.string().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
});

// 创建角色验证
export const createRoleSchema = z.object({
  name: z.string().min(1, '角色名不能为空').max(50, '角色名最多50个字符'),
  description: z.string().max(200).optional(),
  permissionIds: z.array(z.string().uuid()).optional(),
});

// 更新角色验证
export const updateRoleSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional(),
  permissionIds: z.array(z.string().uuid()).optional(),
});

// 创建权限验证
export const createPermissionSchema = z.object({
  name: z.string().min(1, '权限名不能为空').max(100, '权限名最多100个字符'),
  resource: z.string().min(1, '资源不能为空').max(50, '资源名最多50个字符'),
  action: z.string().min(1, '操作不能为空').max(50, '操作名最多50个字符'),
  description: z.string().max(200).optional(),
});

// 更新权限验证
export const updatePermissionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  resource: z.string().min(1).max(50).optional(),
  action: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional(),
});

// 分页参数验证
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ID参数验证
export const idParamSchema = z.object({
  id: z.string().uuid('无效的ID格式'),
});

// 忘记密码验证 (发送验证码)
export const forgotPasswordSchema = z.object({
  email: z.string().email('无效的邮箱格式'),
});

// 验证验证码
export const verifyCodeSchema = z.object({
  email: z.string().email('无效的邮箱格式'),
  code: z.string().length(6, '验证码必须为6位'),
});

// 重置密码验证 (通过token)
export const resetPasswordSchema = z.object({
  token: z.string().min(1, '重置令牌不能为空'),
  newPassword: z
    .string()
    .min(8, '密码至少8个字符')
    .max(100, '密码最多100个字符')
    .regex(/[A-Z]/, '密码必须包含大写字母')
    .regex(/[a-z]/, '密码必须包含小写字母')
    .regex(/[0-9]/, '密码必须包含数字')
    .regex(/[^A-Za-z0-9]/, '密码必须包含特殊字符'),
});

// 修改密码验证 (验证原密码)
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, '原密码不能为空'),
  newPassword: z
    .string()
    .min(8, '密码至少8个字符')
    .max(100, '密码最多100个字符')
    .regex(/[A-Z]/, '密码必须包含大写字母')
    .regex(/[a-z]/, '密码必须包含小写字母')
    .regex(/[0-9]/, '密码必须包含数字')
    .regex(/[^A-Za-z0-9]/, '密码必须包含特殊字符'),
});

// 导出类型
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type CreatePermissionInput = z.infer<typeof createPermissionSchema>;
export type UpdatePermissionInput = z.infer<typeof updatePermissionSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
