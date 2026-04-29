import { Request, Response } from 'express';
import * as permissionService from '../services/permission.service.js';
import { PaginationInput } from '../types/schemas.js';
import { getRequiredRouteParam } from '../utils/request.js';

/**
 * 获取权限列表
 * GET /api/permissions
 */
export const getPermissions = async (req: Request, res: Response): Promise<void> => {
  const result = await permissionService.getPermissions(req.query as unknown as PaginationInput);
  res.status(200).json({
    success: true,
    data: result,
  });
};

/**
 * 获取单个权限
 * GET /api/permissions/:id
 */
export const getPermissionById = async (req: Request, res: Response): Promise<void> => {
  const permission = await permissionService.getPermissionById(getRequiredRouteParam(req.params.id));
  res.status(200).json({
    success: true,
    data: permission,
  });
};

/**
 * 创建权限
 * POST /api/permissions
 */
export const createPermission = async (req: Request, res: Response): Promise<void> => {
  const permission = await permissionService.createPermission(req.body);
  res.status(201).json({
    success: true,
    data: permission,
    message: '权限创建成功',
  });
};

/**
 * 更新权限
 * PUT /api/permissions/:id
 */
export const updatePermission = async (req: Request, res: Response): Promise<void> => {
  const permission = await permissionService.updatePermission(
    getRequiredRouteParam(req.params.id),
    req.body
  );
  res.status(200).json({
    success: true,
    data: permission,
    message: '权限更新成功',
  });
};

/**
 * 删除权限
 * DELETE /api/permissions/:id
 */
export const deletePermission = async (req: Request, res: Response): Promise<void> => {
  await permissionService.deletePermission(getRequiredRouteParam(req.params.id));
  res.status(200).json({
    success: true,
    message: '权限删除成功',
  });
};
