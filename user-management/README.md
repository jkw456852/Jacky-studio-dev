# User Management System Backend

Node.js + Express + PostgreSQL + Prisma + TypeScript 后端用户管理系统

## 技术栈

- **运行时**: Node.js 18+
- **框架**: Express.js
- **ORM**: Prisma
- **数据库**: PostgreSQL
- **认证**: JWT (JSON Web Token)
- **验证**: Zod
- **语言**: TypeScript
- **测试**: Jest + Supertest

## 项目结构

```
user-management/
├── src/
│   ├── config/           # 配置文件
│   ├── controllers/      # 控制器
│   ├── middleware/       # 中间件
│   ├── routes/           # 路由
│   ├── services/         # 业务逻辑
│   ├── types/            # 类型定义
│   ├── utils/            # 工具函数
│   └── app.ts            # 应用入口
├── prisma/
│   └── schema.prisma     # 数据库模型
├── tests/                # 测试文件
├── package.json
└── tsconfig.json
```

## API 端点

### 认证接口
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/me` - 获取当前用户信息

### 用户管理
- `GET /api/users` - 获取用户列表
- `GET /api/users/:id` - 获取单个用户
- `PUT /api/users/:id` - 更新用户
- `DELETE /api/users/:id` - 删除用户

### 角色管理
- `GET /api/roles` - 获取角色列表
- `POST /api/roles` - 创建角色
- `GET /api/roles/:id` - 获取单个角色
- `PUT /api/roles/:id` - 更新角色
- `DELETE /api/roles/:id` - 删除角色

### 权限管理
- `GET /api/permissions` - 获取权限列表
- `POST /api/permissions` - 创建权限
- `PUT /api/permissions/:id` - 更新权限
- `DELETE /api/permissions/:id` - 删除权限

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件配置数据库连接
```

### 3. 初始化数据库
```bash
npx prisma migrate dev
npx prisma generate
```

### 4. 启动服务
```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

### 5. 运行测试
```bash
npm test
```

## 环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| DATABASE_URL | PostgreSQL 连接字符串 | postgresql://user:password@localhost:5432/user_management |
| JWT_SECRET | JWT 密钥 | your-secret-key |
| JWT_EXPIRES_IN | JWT 过期时间 | 7d |
| PORT | 服务端口 | 3000 |
| NODE_ENV | 运行环境 | development |

## 数据库模型

### User (用户)
- id: UUID
- email: 邮箱 (唯一)
- password: 密码 (哈希)
- name: 姓名
- isActive: 是否激活
- createdAt: 创建时间
- updatedAt: 更新时间

### Role (角色)
- id: UUID
- name: 角色名 (唯一)
- description: 描述
- createdAt: 创建时间
- updatedAt: 更新时间

### Permission (权限)
- id: UUID
- name: 权限名 (唯一)
- resource: 资源
- action: 操作
- description: 描述
- createdAt: 创建时间

### UserRole (用户角色关联)
- userId: 用户ID
- roleId: 角色ID

### RolePermission (角色权限关联)
- roleId: 角色ID
- permissionId: 权限ID

## 许可证

MIT
