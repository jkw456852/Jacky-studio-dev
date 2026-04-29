import { Router } from 'express';
import * as permissionController from '../controllers/permission.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/authorize.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { createPermissionSchema, updatePermissionSchema, paginationSchema, idParamSchema } from '../types/schemas.js';

const router = Router();

// 所有权限路由需要认证和管理员权限
router.use(authenticate);
router.use(requireAdmin);

// 获取权限列表
router.get(
  '/',
  validateQuery(paginationSchema),
  permissionController.getPermissions
);

// 获取单个权限
router.get(
  '/:id',
  validateParams(idParamSchema),
  permissionController.getPermissionById
);

// 创建权限
router.post(
  '/',
  validateBody(createPermissionSchema),
  permissionController.createPermission
);

// 更新权限
router.put(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updatePermissionSchema),
  permissionController.updatePermission
);

// 删除权限
router.delete(
  '/:id',
  validateParams(idParamSchema),
  permissionController.deletePermission
);

export default router;
