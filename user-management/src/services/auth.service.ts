import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import { config } from '../config/index.js';
import { generateToken } from '../middleware/auth.js';
import {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  VerifyCodeInput,
  ResetPasswordInput,
  ChangePasswordInput,
} from '../types/schemas.js';
import { AuthResponse, UserResponse } from '../types/responses.js';
import { AppError } from '../middleware/errorHandler.js';

const VERIFICATION_CODE_EXPIRES_IN = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const VERIFY_LOCK_DURATION = 15 * 60 * 1000;
const SEND_COOLDOWN = 60 * 1000;
const shortLivedJwtExpiresIn = '10m' as jwt.SignOptions['expiresIn'];
const jwtSecret = config.jwt.secret as jwt.Secret;

type VerificationCodeRecord = {
  code: string;
  userId: string;
  attempts: number;
  expiresAt: number;
  lockedUntil?: number;
};

type AuthGlobalState = typeof globalThis & {
  __verificationCodes?: Map<string, VerificationCodeRecord>;
  __authCooldowns?: Map<string, number>;
};

const authGlobal = globalThis as AuthGlobalState;

export const ErrorCodes = {
  AUTH_006: '验证码发送过于频繁',
  AUTH_007: '验证已锁定',
  AUTH_008: '验证码不存在或已过期',
  AUTH_009: '验证尝试次数过多',
  AUTH_010: '验证码错误',
  AUTH_011: '重置令牌无效',
} as const;

const getVerificationStore = (): Map<string, VerificationCodeRecord> => {
  if (!authGlobal.__verificationCodes) {
    authGlobal.__verificationCodes = new Map<string, VerificationCodeRecord>();
  }

  return authGlobal.__verificationCodes;
};

const getCooldownStore = (): Map<string, number> => {
  if (!authGlobal.__authCooldowns) {
    authGlobal.__authCooldowns = new Map<string, number>();
  }

  return authGlobal.__authCooldowns;
};

export const register = async (input: RegisterInput): Promise<AuthResponse> => {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existingUser) {
    throw new AppError(409, '邮箱已被注册');
  }

  const hashedPassword = await bcrypt.hash(input.password, config.bcrypt.saltRounds);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      password: hashedPassword,
      name: input.name,
    },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const token = generateToken(user.id, user.email);

  return {
    token,
    user: user as UserResponse,
  };
};

export const login = async (input: LoginInput): Promise<AuthResponse> => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      name: true,
      password: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError(401, '邮箱或密码错误');
  }

  if (!user.isActive) {
    throw new AppError(403, '账户已被禁用');
  }

  const isValidPassword = await bcrypt.compare(input.password, user.password);

  if (!isValidPassword) {
    throw new AppError(401, '邮箱或密码错误');
  }

  const token = generateToken(user.id, user.email);
  const { password: _password, ...userWithoutPassword } = user;

  return {
    token,
    user: userWithoutPassword as UserResponse,
  };
};

export const getCurrentUser = async (userId: string): Promise<UserResponse> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      roles: {
        select: {
          role: {
            select: {
              id: true,
              name: true,
              description: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new AppError(404, '用户不存在');
  }

  return {
    ...user,
    roles: user.roles.map(({ role }) => role),
  };
};

export const forgotPassword = async (
  input: ForgotPasswordInput
): Promise<{ message: string }> => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    return { message: '如果邮箱存在，重置链接已发送' };
  }

  const resetToken = jwt.sign(
    { userId: user.id, type: 'password-reset' },
    jwtSecret,
    { expiresIn: shortLivedJwtExpiresIn }
  );

  console.log(`密码重置令牌已生成 for ${user.email}: ${resetToken}`);

  return { message: '如果邮箱存在，重置链接已发送' };
};

export const resetPassword = async (
  input: ResetPasswordInput
): Promise<{ message: string }> => {
  let decoded: { userId: string; type: string };

  try {
    decoded = jwt.verify(input.token, jwtSecret) as { userId: string; type: string };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(400, '重置链接已过期');
    }

    throw new AppError(400, '无效的重置链接');
  }

  if (decoded.type !== 'password-reset') {
    throw new AppError(400, '无效的重置链接');
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
  });

  if (!user) {
    throw new AppError(404, '用户不存在');
  }

  const hashedPassword = await bcrypt.hash(input.newPassword, config.bcrypt.saltRounds);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  return { message: '密码重置成功，请使用新密码登录' };
};

export const changePassword = async (
  userId: string,
  input: ChangePasswordInput
): Promise<{ message: string }> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true },
  });

  if (!user) {
    throw new AppError(404, '用户不存在');
  }

  const isValidPassword = await bcrypt.compare(input.oldPassword, user.password);

  if (!isValidPassword) {
    throw new AppError(401, '原密码错误');
  }

  const isSamePassword = await bcrypt.compare(input.newPassword, user.password);

  if (isSamePassword) {
    throw new AppError(400, '新密码不能与原密码相同');
  }

  const hashedPassword = await bcrypt.hash(input.newPassword, config.bcrypt.saltRounds);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  return { message: '密码修改成功' };
};

export const sendCode = async (input: ForgotPasswordInput): Promise<{ message: string }> => {
  const { email } = input;
  const now = Date.now();
  const cooldownStore = getCooldownStore();
  const verificationStore = getVerificationStore();
  const lastSend = cooldownStore.get(email);

  if (lastSend && now - lastSend < SEND_COOLDOWN) {
    const remaining = Math.ceil((SEND_COOLDOWN - (now - lastSend)) / 1000);
    throw new AppError(429, ErrorCodes.AUTH_006, { code: 'AUTH_006', remaining });
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return { message: '如果邮箱存在，验证码已发送' };
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedCode = await bcrypt.hash(code, 6);

  verificationStore.set(email, {
    code: hashedCode,
    userId: user.id,
    attempts: 0,
    expiresAt: now + VERIFICATION_CODE_EXPIRES_IN,
  });

  cooldownStore.set(email, now);
  console.log(`验证码已发送 to ${email}: ${code}`);

  return { message: '验证码已发送' };
};

export const verifyCode = async (
  input: VerifyCodeInput
): Promise<{ resetToken: string }> => {
  const { email, code } = input;
  const now = Date.now();
  const verificationStore = getVerificationStore();
  const record = verificationStore.get(email);

  if (!record) {
    throw new AppError(400, ErrorCodes.AUTH_008, { code: 'AUTH_008' });
  }

  if (now > record.expiresAt) {
    verificationStore.delete(email);
    throw new AppError(400, ErrorCodes.AUTH_008, { code: 'AUTH_008' });
  }

  if (record.lockedUntil && now < record.lockedUntil) {
    const remaining = Math.ceil((record.lockedUntil - now) / 1000);
    throw new AppError(429, ErrorCodes.AUTH_007, { code: 'AUTH_007', remaining });
  }

  const isValid = await bcrypt.compare(code, record.code);

  if (!isValid) {
    record.attempts += 1;

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      record.lockedUntil = now + VERIFY_LOCK_DURATION;
      verificationStore.set(email, record);
      throw new AppError(429, ErrorCodes.AUTH_009, {
        code: 'AUTH_009',
        lockedUntil: record.lockedUntil,
      });
    }

    verificationStore.set(email, record);
    throw new AppError(400, ErrorCodes.AUTH_010, {
      code: 'AUTH_010',
      attemptsLeft: MAX_VERIFY_ATTEMPTS - record.attempts,
    });
  }

  const resetToken = jwt.sign(
    { userId: record.userId, type: 'password-reset', email },
    jwtSecret,
    { expiresIn: shortLivedJwtExpiresIn }
  );

  verificationStore.delete(email);

  return { resetToken };
};
