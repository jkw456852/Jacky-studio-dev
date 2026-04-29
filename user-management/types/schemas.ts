import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址').min(1, '邮箱不能为空'),
  password: z.string().min(6, '密码至少6位').max(50, '密码最多50位'),
  remember: z.boolean().optional(),
  captcha: z.string().min(4, '验证码至少4位').max(6, '验证码最多6位').optional(),
});

export const registerSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址').min(1, '邮箱不能为空'),
  username: z.string()
    .min(3, '用户名至少3位')
    .max(20, '用户名最多20位')
    .regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母、数字、下划线和连字符'),
  password: z.string()
    .min(8, '密码至少8位')
    .max(50, '密码最多50位')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/, '密码必须包含大小写字母和数字'),
  confirmPassword: z.string().min(1, '请确认密码'),
  fullName: z.string().max(50, '姓名最多50位').optional(),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '请输入有效的手机号').optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: '两次输入的密码不一致',
  path: ['confirmPassword'],
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址').min(1, '邮箱不能为空'),
  captcha: z.string().min(4, '验证码至少4位').max(6, '验证码最多6位').optional(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, '重置令牌不能为空'),
  password: z.string()
    .min(8, '密码至少8位')
    .max(50, '密码最多50位')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/, '密码必须包含大小写字母和数字'),
  confirmPassword: z.string().min(1, '请确认密码'),
}).refine((data) => data.password === data.confirmPassword, {
  message: '两次输入的密码不一致',
  path: ['confirmPassword'],
});

export const userCreateSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址').min(1, '邮箱不能为空'),
  username: z.string()
    .min(3, '用户名至少3位')
    .max(20, '用户名最多20位')
    .regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母、数字、下划线和连字符'),
  password: z.string()
    .min(8, '密码至少8位')
    .max(50, '密码最多50位')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/, '密码必须包含大小写字母和数字'),
  fullName: z.string().max(50, '姓名最多50位').optional(),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '请输入有效的手机号').optional(),
  role: z.string().min(1, '请选择角色'),
});

export const userUpdateSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址').optional(),
  username: z.string()
    .min(3, '用户名至少3位')
    .max(20, '用户名最多20位')
    .regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母、数字、下划线和连字符')
    .optional(),
  fullName: z.string().max(50, '姓名最多50位').optional(),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '请输入有效的手机号').optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  role: z.string().optional(),
});

export const profileUpdateSchema = z.object({
  fullName: z.string().max(50, '姓名最多50位').optional(),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '请输入有效的手机号').optional(),
  avatar: z.string().url('请输入有效的URL').optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码'),
  newPassword: z.string()
    .min(8, '新密码至少8位')
    .max(50, '新密码最多50位')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/, '密码必须包含大小写字母和数字'),
  confirmPassword: z.string().min(1, '请确认新密码'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: '两次输入的密码不一致',
  path: ['confirmPassword'],
});

export const roleCreateSchema = z.object({
  name: z.string()
    .min(2, '角色名称至少2位')
    .max(30, '角色名称最多30位')
    .regex(/^[a-zA-Z0-9_\-\s]+$/, '角色名称只能包含字母、数字、空格、下划线和连字符'),
  description: z.string().max(200, '描述最多200位').optional(),
  permissions: z.array(z.string()).min(1, '至少选择一个权限'),
});

export const roleUpdateSchema = z.object({
  name: z.string()
    .min(2, '角色名称至少2位')
    .max(30, '角色名称最多30位')
    .regex(/^[a-zA-Z0-9_\-\s]+$/, '角色名称只能包含字母、数字、空格、下划线和连字符')
    .optional(),
  description: z.string().max(200, '描述最多200位').optional(),
  permissions: z.array(z.string()).optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type UserCreateFormData = z.infer<typeof userCreateSchema>;
export type UserUpdateFormData = z.infer<typeof userUpdateSchema>;
export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
export type RoleCreateFormData = z.infer<typeof roleCreateSchema>;
export type RoleUpdateFormData = z.infer<typeof roleUpdateSchema>;