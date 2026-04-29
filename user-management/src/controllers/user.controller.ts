import { Request, Response } from 'express';
import * as userService from '../services/user.service.js';
import { PaginationInput } from '../types/schemas.js';
import { getRequiredRouteParam } from '../utils/request.js';

/**
 * 获取用户列表
 * GET /api/users
 */
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  const result = await userService.getUsers(req.query as unknown as PaginationInput);
  res.status(200).json({
    success: true,
    data: result,
  });
};

/**
 * 获取单个用户
 * GET /api/users/:id
 */
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  const user = await userService.getUserById(getRequiredRouteParam(req.params.id));
  res.status(200).json({
    success: true,
    data: user,
  });
};

/**
 * 更新用户
 * PUT /api/users/:id
 */
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const user = await userService.updateUser(getRequiredRouteParam(req.params.id), req.body);
  res.status(200).json({
    success: true,
    data: user,
    message: '用户更新成功',
  });
};

/**
 * 删除用户
 * DELETE /api/users/:id
 */
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  await userService.deleteUser(getRequiredRouteParam(req.params.id));
  res.status(200).json({
    success: true,
    message: '用户删除成功',
  });
};
