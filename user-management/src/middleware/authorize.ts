import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database.js';

/**
 * 权限检查中间件工厂
 */
export const requirePermission = (resource: string, action: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: '未认证',
        });
        return;
      }

      // 获取用户的所有角色和权限
      const userWithRoles = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!userWithRoles) {
        res.status(401).json({
          success: false,
          error: '用户不存在',
        });
        return;
      }

      // 收集所有权限
      const permissions = new Set<string>();
      for (const userRole of userWithRoles.roles) {
        for (const rolePermission of userRole.role.permissions) {
          permissions.add(
            `${rolePermission.permission.resource}:${rolePermission.permission.action}`
          );
        }
      }

      // 检查是否有所需权限
      const requiredPermission = `${resource}:${action}`;
      if (!permissions.has(requiredPermission) && !permissions.has(`${resource}:*`)) {
        res.status(403).json({
          success: false,
          error: '没有权限执行此操作',
        });
        return;
      }

      next();
    } catch (error) {
      console.error('权限检查错误:', error);
      res.status(500).json({
        success: false,
        error: '权限检查失败',
      });
    }
  };
};

/**
 * 管理员检查中间件
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: '未认证',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: '用户不存在',
      });
      return;
    }

    // 检查是否有管理员角色
    const isAdmin = user.roles.some((ur) => ur.role.name === 'admin');

    if (!isAdmin) {
      res.status(403).json({
        success: false,
        error: '需要管理员权限',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('管理员检查错误:', error);
    res.status(500).json({
      success: false,
      error: '管理员检查失败',
    });
  }
};
