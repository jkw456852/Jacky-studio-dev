import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { JwtPayload } from '../types/responses.js';
import prisma from '../config/database.js';

const jwtSecret = config.jwt.secret as jwt.Secret;
const jwtExpiresIn = config.jwt.expiresIn as jwt.SignOptions['expiresIn'];

// 扩展Express Request类型
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
    }
  }
}

/**
 * JWT认证中间件
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: '未提供认证令牌',
      });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

      // 验证用户是否存在
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, isActive: true },
      });

      if (!user) {
        res.status(401).json({
          success: false,
          error: '用户不存在',
        });
        return;
      }

      if (!user.isActive) {
        res.status(403).json({
          success: false,
          error: '用户已被禁用',
        });
        return;
      }

      req.user = {
        userId: user.id,
        email: user.email,
      };

      next();
    } catch (jwtError) {
      if (jwtError instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          success: false,
          error: '令牌已过期',
        });
        return;
      }
      if (jwtError instanceof jwt.JsonWebTokenError) {
        res.status(401).json({
          success: false,
          error: '无效的令牌',
        });
        return;
      }
      throw jwtError;
    }
  } catch (error) {
    console.error('认证中间件错误:', error);
    res.status(500).json({
      success: false,
      error: '认证失败',
    });
  }
};

/**
 * 生成JWT令牌
 */
export const generateToken = (userId: string, email: string): string => {
  return jwt.sign({ userId, email }, jwtSecret, { expiresIn: jwtExpiresIn });
};

/**
 * 验证JWT令牌（不作为中间件）
 */
export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, jwtSecret) as JwtPayload;
};
