import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/authorize.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { updateUserSchema, paginationSchema, idParamSchema } from '../types/schemas.js';

const router = Router();

// 所有用户路由需要认证
router.use(authenticate);

// 获取用户列表 - 需要管理员权限
router.get(
  '/',
  requireAdmin,
  validateQuery(paginationSchema),
  userController.getUsers
);

// 获取单个用户 - 需要管理员权限
router.get(
  '/:id',
  requireAdmin,
  validateParams(idParamSchema),
  userController.getUserById
);

// 更新用户 - 需要管理员权限
router.put(
  '/:id',
  requireAdmin,
  validateParams(idParamSchema),
  validateBody(updateUserSchema),
  userController.updateUser
);

// 删除用户 - 需要管理员权限
router.delete(
  '/:id',
  requireAdmin,
  validateParams(idParamSchema),
  userController.deleteUser
);

export default router;
