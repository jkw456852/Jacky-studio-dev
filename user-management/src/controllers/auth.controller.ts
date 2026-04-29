import { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';

/**
 * 用户注册
 * POST /api/auth/register
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.register(req.body);
  res.status(201).json({
    success: true,
    data: result,
    message: '注册成功',
  });
};

/**
 * 用户登录
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.login(req.body);
  res.status(200).json({
    success: true,
    data: result,
    message: '登录成功',
  });
};

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
export const getMe = async (req: Request, res: Response): Promise<void> => {
  const user = await authService.getCurrentUser(req.user!.userId);
  res.status(200).json({
    success: true,
    data: user,
  });
};

/**
 * 用户登出
 * POST /api/auth/logout
 */
export const logout = async (_req: Request, res: Response): Promise<void> => {
  // JWT是无状态的，登出通过客户端删除token实现
  // 如果需要黑名单机制，可以使用Redis存储token
  res.status(200).json({
    success: true,
    message: '登出成功',
  });
};

/**
 * 发送验证码
 * POST /api/auth/send-code
 * 错误码: AUTH_006 发送过于频繁
 */
export const sendCode = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.sendCode(req.body);
  res.status(200).json({
    success: true,
    ...result,
  });
};

/**
 * 验证验证码
 * POST /api/auth/verify-code
 * 错误码: AUTH_007 锁定, AUTH_008 不存在或过期, AUTH_009 尝试次数过多, AUTH_010 错误
 */
export const verifyCode = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.verifyCode(req.body);
  res.status(200).json({
    success: true,
    ...result,
  });
};

/**
 * 使用Token重置密码
 * POST /api/auth/reset-password
 * 错误码: AUTH_011 重置令牌无效
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.resetPassword(req.body);
  res.status(200).json({
    success: true,
    ...result,
  });
};

/**
 * 修改密码
 * POST /api/auth/change-password
 */
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.changePassword(req.user!.userId, req.body);
  res.status(200).json({
    success: true,
    ...result,
  });
};
