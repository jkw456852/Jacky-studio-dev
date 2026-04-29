import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

export const config = {
  // 数据库
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/user_management',
  },

  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // 服务器配置
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || '*',
  },

  // bcrypt配置
  bcrypt: {
    saltRounds: 12,
  },
} as const;

export type Config = typeof config;
