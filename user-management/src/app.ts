import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';

const app = express();

// 安全中间件
app.use(helmet());

// CORS配置
app.use(cors({
  origin: config.server.corsOrigin,
  credentials: true,
}));

// 请求日志
if (config.server.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// 请求体解析
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API限流
app.use('/api', apiLimiter);

// API路由
app.use('/api', routes);

// 健康检查
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// 404处理
app.use(notFoundHandler);

// 错误处理
app.use(errorHandler);

// 启动服务器
const { port } = config.server;

app.listen(port, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║         User Management API Server                  ║
╠════════════════════════════════════════════════════╣
║  Environment: ${config.server.nodeEnv.padEnd(35)}║
║  Port:        ${port.toString().padEnd(35)}║
║  Database:    PostgreSQL                           ║
╚════════════════════════════════════════════════════╝

API Endpoints:
  POST   /api/auth/register    - Register new user
  POST   /api/auth/login       - User login
  POST   /api/auth/logout      - User logout
  GET    /api/auth/me          - Get current user
  GET    /api/users            - List users (admin)
  GET    /api/users/:id        - Get user (admin)
  PUT    /api/users/:id        - Update user (admin)
  DELETE /api/users/:id        - Delete user (admin)
  GET    /api/roles            - List roles (admin)
  POST   /api/roles            - Create role (admin)
  GET    /api/roles/:id        - Get role (admin)
  PUT    /api/roles/:id        - Update role (admin)
  DELETE /api/roles/:id        - Delete role (admin)
  GET    /api/permissions      - List permissions (admin)
  POST   /api/permissions      - Create permission (admin)
  PUT    /api/permissions/:id  - Update permission (admin)
  DELETE /api/permissions/:id  - Delete permission (admin)
`);
});

export default app;
