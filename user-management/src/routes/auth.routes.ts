import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyCodeSchema,
} from '../types/schemas.js';
import { registerLimiter, loginLimiter } from '../middleware/rateLimit.js';

const router = Router();

// 注册
router.post('/register', registerLimiter, validateBody(registerSchema), authController.register);

// 登录
router.post('/login', loginLimiter, validateBody(loginSchema), authController.login);

// 登出
router.post('/logout', authenticate, authController.logout);

// 获取当前用户信息
router.get('/me', authenticate, authController.getMe);

// 发送验证码 (忘记密码)
router.post('/send-code', validateBody(forgotPasswordSchema), authController.sendCode);

// 验证验证码
router.post('/verify-code', validateBody(verifyCodeSchema), authController.verifyCode);

// 使用Token重置密码
router.post('/reset-password', validateBody(resetPasswordSchema), authController.resetPassword);

// 修改密码 (需认证)
router.post('/change-password', authenticate, validateBody(changePasswordSchema), authController.changePassword);

export default router;
