import rateLimit from 'express-rate-limit';

/**
 * API速率限制中间件
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 最多100个请求
  message: {
    success: false,
    error: '请求过于频繁，请稍后再试',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * 登录速率限制中间件（更严格）
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 10, // 最多10次尝试
  message: {
    success: false,
    error: '登录尝试过于频繁，请稍后再试',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * 注册速率限制中间件
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 5, // 最多5次注册
  message: {
    success: false,
    error: '注册过于频繁，请稍后再试',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
