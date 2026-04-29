import { Router } from 'express';
import * as roleController from '../controllers/role.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/authorize.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { createRoleSchema, updateRoleSchema, paginationSchema, idParamSchema } from '../types/schemas.js';

const router = Router();

// 所有角色路由需要认证和管理员权限
router.use(authenticate);
router.use(requireAdmin);

// 获取角色列表
router.get(
  '/',
  validateQuery(paginationSchema),
  roleController.getRoles
);

// 获取单个角色
router.get(
  '/:id',
  validateParams(idParamSchema),
  roleController.getRoleById
);

// 创建角色
router.post(
  '/',
  validateBody(createRoleSchema),
  roleController.createRole
);

// 更新角色
router.put(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateRoleSchema),
  roleController.updateRole
);

// 删除角色
router.delete(
  '/:id',
  validateParams(idParamSchema),
  roleController.deleteRole
);

export default router;
