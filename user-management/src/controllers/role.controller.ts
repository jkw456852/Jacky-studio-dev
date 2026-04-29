import { Request, Response } from 'express';
import * as roleService from '../services/role.service.js';
import { PaginationInput } from '../types/schemas.js';
import { getRequiredRouteParam } from '../utils/request.js';

/**
 * 获取角色列表
 * GET /api/roles
 */
export const getRoles = async (req: Request, res: Response): Promise<void> => {
  const result = await roleService.getRoles(req.query as unknown as PaginationInput);
  res.status(200).json({
    success: true,
    data: result,
  });
};

/**
 * 获取单个角色
 * GET /api/roles/:id
 */
export const getRoleById = async (req: Request, res: Response): Promise<void> => {
  const role = await roleService.getRoleById(getRequiredRouteParam(req.params.id));
  res.status(200).json({
    success: true,
    data: role,
  });
};

/**
 * 创建角色
 * POST /api/roles
 */
export const createRole = async (req: Request, res: Response): Promise<void> => {
  const role = await roleService.createRole(req.body);
  res.status(201).json({
    success: true,
    data: role,
    message: '角色创建成功',
  });
};

/**
 * 更新角色
 * PUT /api/roles/:id
 */
export const updateRole = async (req: Request, res: Response): Promise<void> => {
  const role = await roleService.updateRole(getRequiredRouteParam(req.params.id), req.body);
  res.status(200).json({
    success: true,
    data: role,
    message: '角色更新成功',
  });
};

/**
 * 删除角色
 * DELETE /api/roles/:id
 */
export const deleteRole = async (req: Request, res: Response): Promise<void> => {
  await roleService.deleteRole(getRequiredRouteParam(req.params.id));
  res.status(200).json({
    success: true,
    message: '角色删除成功',
  });
};
