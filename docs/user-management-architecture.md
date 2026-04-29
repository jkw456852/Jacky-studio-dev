# 用户管理系统 - 技术架构设计文档

**版本**: v1.1  
**作者**: 架构师 (Architect)  
**日期**: 2026-04-01  
**状态**: 草稿 (已纳入PM审阅意见)

---

## 一、系统架构概述

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              客户端层                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Web App   │  │  Mobile App │  │   小程序    │  │   其他客户端│    │
│  │ React+TS    │  │ React Native│  │   微信小程序│  │   API集成   │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
└─────────┼────────────────┼────────────────┼────────────────┼───────────┘
          │                │                │                │
          └────────────────┴────────┬───────┴────────────────┘
                                   │ HTTPS
┌──────────────────────────────────┼──────────────────────────────────────┐
│                            网关/负载均衡层                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                      Nginx / API Gateway                            │  │
│  │  • 负载均衡 (Round Robin / Least Connections)                       │  │
│  │  • SSL/TLS 终止                                                      │  │
│  │  • 请求限流 (Rate Limiting)                                          │  │
│  │  • CORS 配置                                                         │  │
│  │  • 请求日志                                                          │  │
│  └──────────────────────────────────┬──────────────────────────────────┘  │
└────────────────────────────────────┼─────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼─────────────────────────────────────┐
│                            安全层                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐        │
│  │   WAF 防火墙     │  │   认证服务        │  │   授权服务        │        │
│  │   Web Application│  │   Authentication  │  │   Authorization   │        │
│  │   Firewall       │  │   (JWT/OAuth2)    │  │   (RBAC/ABAC)     │        │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘        │
└────────────────────────────────────┼─────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼─────────────────────────────────────┐
│                            应用服务层                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    Node.js + Express 服务集群                        │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│  │
│  │  │  用户服务    │  │  认证服务    │  │  角色服务    │  │  权限服务   ││  │
│  │  │ User Service│  │  Auth Svc   │  │  Role Svc   │  │ Permission  ││  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘│  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│  │
│  │  │  会话服务   │  │  审计服务    │  │  通知服务   │  │  统计服务   ││  │
│  │  │ Session Svc│  │  Audit Svc  │  │  Notify Svc │  │  Analytics  ││  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘│  │
│  └──────────────────────────────────┬──────────────────────────────────┘  │
└────────────────────────────────────┼─────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼─────────────────────────────────────┐
│                            数据层                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  PostgreSQL  │  │    Redis     │  │   MongoDB    │  │   文件存储   │  │
│  │  主数据库    │  │  缓存/会话   │  │  日志存储    │  │  OSS/MinIO   │  │
│  │  用户/权限   │  │  Token缓存   │  │  操作日志    │  │  头像/附件   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 分层架构说明

| 层级 | 职责 | 技术选型 |
|------|------|----------|
| **客户端层** | 用户交互界面 | React + TypeScript, React Native, 微信小程序 |
| **网关层** | 流量控制、安全过滤 | Nginx, Kong, AWS ALB |
| **安全层** | 身份认证、权限控制 | JWT, OAuth2, RBAC |
| **应用服务层** | 业务逻辑处理 | Node.js + Express / NestJS |
| **数据层** | 数据持久化、缓存 | PostgreSQL, Redis, MongoDB |

---

## 二、数据库设计

### 2.1 ER图设计

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     users       │       │     roles       │       │   permissions  │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │       │ id (PK)         │
│ username        │       │ name            │       │ name            │
│ email           │       │ description     │       │ resource        │
│ password_hash   │       │ created_at      │       │ action          │
│ phone           │       │ updated_at      │       │ description     │
│ avatar_url      │       │ status          │       │ created_at      │
│ status          │       └────────┬────────┘       └────────┬────────┘
│ email_verified  │                │                         │
│ phone_verified  │                │                         │
│ created_at      │       ┌────────┴────────┐                │
│ updated_at      │       │ user_roles       │       ┌───────┴───────┐
│ last_login_at   │       ├─────────────────┤       │ role_permissions│
└────────┬────────┘       │ user_id (FK)     │       ├─────────────────┤
         │                │ role_id (FK)     │       │ role_id (FK)    │
         │                │ assigned_at      │       │ permission_id   │
         │                │ assigned_by      │       │ (FK)            │
         │                └──────────────────┘       │ granted_at      │
         │                                             └─────────────────┘
         │
┌────────┴────────┐       ┌─────────────────┐       ┌─────────────────┐
│   user_sessions │       │   user_profiles  │       │   audit_logs    │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ user_id (FK)    │       │ id (PK)         │
│ user_id (FK)    │       │ first_name      │       │ user_id (FK)    │
│ refresh_token  │       │ last_name       │       │ action          │
│ device_info    │       │ date_of_birth   │       │ resource_type   │
│ ip_address     │       │ gender          │       │ resource_id     │
│ user_agent     │       │ address         │       │ ip_address      │
│ expires_at     │       │ bio             │       │ user_agent      │
│ created_at     │       │ preferences     │       │ old_value       │
│ revoked_at     │       │ created_at      │       │ new_value       │
└─────────────────┘       │ updated_at      │       │ created_at      │
                          └─────────────────┘       └─────────────────┘
```

### 2.2 数据表详细设计

#### 2.2.1 用户表 (users)

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(50) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    phone           VARCHAR(20) UNIQUE,
    avatar_url      VARCHAR(500),
    status          VARCHAR(20) DEFAULT 'active' 
                    CHECK (status IN ('active', 'inactive', 'suspended', 'deleted')),
    email_verified  BOOLEAN DEFAULT FALSE,
    phone_verified  BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at   TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_phone_format CHECK (phone ~* '^\+?[1-9]\d{1,14}$')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_status ON users(status);
```

#### 2.2.2 角色表 (roles)

```sql
CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_system   BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MVP阶段预定义系统角色 (v1.1更新)
INSERT INTO roles (name, description, is_system) VALUES
('admin', '管理员', TRUE),
('user', '普通用户', TRUE);

-- 扩展角色 (第三阶段)
-- ('super_admin', '超级管理员', TRUE),
-- ('guest', '访客', TRUE);
```

#### 2.2.3 权限表 (permissions)

```sql
CREATE TABLE permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) UNIQUE NOT NULL,
    resource    VARCHAR(100) NOT NULL,
    action      VARCHAR(50) NOT NULL,
    description TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT permissions_resource_action UNIQUE (resource, action)
);

-- 示例权限
INSERT INTO permissions (name, resource, action, description) VALUES
('user:create', 'user', 'create', '创建用户'),
('user:read', 'user', 'read', '查看用户'),
('user:update', 'user', 'update', '更新用户'),
('user:delete', 'user', 'delete', '删除用户'),
('role:create', 'role', 'create', '创建角色'),
('role:read', 'role', 'read', '查看角色'),
('role:update', 'role', 'update', '更新角色'),
('role:delete', 'role', 'delete', '删除角色');
```

#### 2.2.4 用户角色关联表 (user_roles)

```sql
CREATE TABLE user_roles (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);
```

#### 2.2.5 角色权限关联表 (role_permissions)

```sql
CREATE TABLE role_permissions (
    role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);
```

#### 2.2.6 用户会话表 (user_sessions)

```sql
CREATE TABLE user_sessions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) NOT NULL,
    device_info   JSONB,
    ip_address    INET,
    user_agent    TEXT,
    expires_at    TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at    TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(refresh_token);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
```

#### 2.2.7 审计日志表 (audit_logs)

```sql
CREATE TABLE audit_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID REFERENCES users(id),
    action        VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id   VARCHAR(255),
    ip_address    INET,
    user_agent    TEXT,
    old_value     JSONB,
    new_value     JSONB,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

#### 2.2.8 验证码表 (verification_codes)

```sql
CREATE TABLE verification_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type        VARCHAR(20) NOT NULL
                CHECK (type IN ('email_verify', 'phone_verify', 'password_reset', 'login_verify')),
    code        VARCHAR(10) NOT NULL,
    target      VARCHAR(255) NOT NULL,  -- email或phone
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    attempts    INTEGER DEFAULT 0,
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_verification_codes_target ON verification_codes(target);
CREATE INDEX idx_verification_codes_user ON verification_codes(user_id);
CREATE INDEX idx_verification_codes_type_target ON verification_codes(type, target);
CREATE INDEX idx_verification_codes_expires ON verification_codes(expires_at);
```

---

## 三、API接口规范

### 3.1 API设计原则

- **RESTful风格**: 使用HTTP动词表示操作
- **版本控制**: `/api/v1/`
- **统一响应格式**: `{ success, data, message, error }`
- **分页规范**: 使用Cursor-based分页

### 3.2 API响应格式

```typescript
// 成功响应
interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

// 错误响应
interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  timestamp: string;
}

// 分页响应
interface PaginatedResponse<T> {
  success: true;
  data: {
    items: T[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
  timestamp: string;
}
```

### 3.3 认证相关接口

#### 3.3.1 用户注册

```
POST /api/v1/auth/register

Request:
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "phone": "+8613812345678"
}

Response (201):
{
  "success": true,
  "data": {
    "userId": "uuid",
    "username": "john_doe",
    "email": "john@example.com"
  },
  "message": "注册成功，请查收验证邮件"
}
```

#### 3.3.2 用户登录

```
POST /api/v1/auth/login

Request:
{
  "login": "john@example.com",  // 支持邮箱/用户名/手机号
  "password": "SecurePass123!"
}

Response (200):
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 3600,
    "user": {
      "id": "uuid",
      "username": "john_doe",
      "email": "john@example.com",
      "roles": ["user"]
    }
  }
}
```

#### 3.3.3 刷新Token

```
POST /api/v1/auth/refresh

Request:
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}

Response (200):
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 3600
  }
}
```

#### 3.3.4 发送验证码

```
POST /api/v1/auth/send-code

Request:
{
  "type": "password_reset",  // email_verify | phone_verify | password_reset
  "target": "john@example.com"  // email或phone
}

Response (200):
{
  "success": true,
  "message": "验证码已发送",
  "data": {
    "expiresIn": 600  // 10分钟
  }
}
```

#### 3.3.5 验证验证码

```
POST /api/v1/auth/verify-code

Request:
{
  "type": "password_reset",
  "target": "john@example.com",
  "code": "123456"
}

Response (200):
{
  "success": true,
  "data": {
    "verified": true,
    "token": "reset-token-xxx"  // 用于重置密码的临时token
  }
}
```

#### 3.3.6 重置密码

```
POST /api/v1/auth/reset-password

Request:
{
  "resetToken": "reset-token-xxx",
  "newPassword": "NewSecurePass123!"
}

Response (200):
{
  "success": true,
  "message": "密码重置成功"
}
```

#### 3.3.7 登出

```
POST /api/v1/auth/logout

Headers:
  Authorization: Bearer <accessToken>

Request:
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}

Response (200):
{
  "success": true,
  "message": "登出成功"
}
```

### 3.4 用户管理接口

#### 3.4.1 获取当前用户信息

```
GET /api/v1/users/me

Headers:
  Authorization: Bearer <accessToken>

Response (200):
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "john_doe",
    "email": "john@example.com",
    "phone": "+8613812345678",
    "avatarUrl": "https://...",
    "status": "active",
    "roles": ["user"],
    "permissions": ["user:read", "user:update"],
    "emailVerified": true,
    "phoneVerified": false,
    "createdAt": "2026-04-01T10:00:00Z",
    "lastLoginAt": "2026-04-01T10:30:00Z"
  }
}
```

#### 3.4.2 更新当前用户信息

```
PATCH /api/v1/users/me

Headers:
  Authorization: Bearer <accessToken>

Request:
{
  "phone": "+8613912345678",
  "avatarUrl": "https://..."
}

Response (200):
{
  "success": true,
  "data": { /* updated user object */ },
  "message": "用户信息已更新"
}
```

#### 3.4.3 修改密码

```
POST /api/v1/users/me/password

Headers:
  Authorization: Bearer <accessToken>

Request:
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}

Response (200):
{
  "success": true,
  "message": "密码修改成功"
}
```

#### 3.4.4 获取用户列表 (管理员)

```
GET /api/v1/users?page=1&pageSize=20&status=active&role=user

Headers:
  Authorization: Bearer <accessToken>

Response (200):
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "username": "jane_doe",
        "email": "jane@example.com",
        "status": "active",
        "roles": ["user"],
        "createdAt": "2026-03-01T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

#### 3.4.5 获取指定用户详情 (管理员)

```
GET /api/v1/users/:id

Headers:
  Authorization: Bearer <accessToken>

Response (200):
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "jane_doe",
    "email": "jane@example.com",
    "phone": "+8613912345678",
    "avatarUrl": "https://...",
    "status": "active",
    "roles": ["user"],
    "profile": {
      "firstName": "Jane",
      "lastName": "Doe",
      "dateOfBirth": "1990-01-01",
      "gender": "female",
      "address": "...",
      "bio": "..."
    },
    "emailVerified": true,
    "phoneVerified": true,
    "createdAt": "2026-03-01T10:00:00Z",
    "updatedAt": "2026-04-01T10:00:00Z",
    "lastLoginAt": "2026-04-01T10:30:00Z"
  }
}
```

#### 3.4.6 创建用户 (管理员)

```
POST /api/v1/users

Headers:
  Authorization: Bearer <accessToken>

Request:
{
  "username": "new_user",
  "email": "new@example.com",
  "password": "TempPass123!",
  "phone": "+8613912345678",
  "roleIds": ["uuid-of-user-role"]
}

Response (201):
{
  "success": true,
  "data": { /* created user object */ },
  "message": "用户创建成功"
}
```

#### 3.4.7 更新用户 (管理员)

```
PUT /api/v1/users/:id

Headers:
  Authorization: Bearer <accessToken>

Request:
{
  "status": "suspended",
  "roleIds": ["uuid-of-admin-role"]
}

Response (200):
{
  "success": true,
  "data": { /* updated user object */ },
  "message": "用户已更新"
}
```

#### 3.4.8 删除用户 (管理员)

```
DELETE /api/v1/users/:id

Headers:
  Authorization: Bearer <accessToken>

Response (200):
{
  "success": true,
  "message": "用户已删除"
}
```

### 3.5 角色管理接口

#### 3.5.1 获取角色列表

```
GET /api/v1/roles

Headers:
  Authorization: Bearer <accessToken>

Response (200):
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "admin",
      "description": "管理员",
      "isSystem": true,
      "permissionCount": 10
    }
  ]
}
```

#### 3.5.2 获取角色详情

```
GET /api/v1/roles/:id

Headers:
  Authorization: Bearer <accessToken>

Response (200):
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "admin",
    "description": "管理员",
    "isSystem": true,
    "permissions": [
      {
        "id": "uuid",
        "name": "user:create",
        "resource": "user",
        "action": "create",
        "description": "创建用户"
      }
    ],
    "userCount": 5,
    "createdAt": "2026-01-01T00:00:00Z"
  }
}
```

#### 3.5.3 创建角色

```
POST /api/v1/roles

Headers:
  Authorization: Bearer <accessToken>

Request:
{
  "name": "content_manager",
  "description": "内容管理员",
  "permissionIds": ["uuid1", "uuid2"]
}

Response (201):
{
  "success": true,
  "data": { /* created role object */ }
}
```

#### 3.5.4 更新角色

```
PUT /api/v1/roles/:id

Headers:
  Authorization: Bearer <accessToken>

Request:
{
  "description": "内容管理员 - 可管理文章",
  "permissionIds": ["uuid1", "uuid2", "uuid3"]
}

Response (200):
{
  "success": true,
  "data": { /* updated role object */ }
}
```

#### 3.5.5 删除角色

```
DELETE /api/v1/roles/:id

Headers:
  Authorization: Bearer <accessToken>

Response (200):
{
  "success": true,
  "message": "角色已删除"
}
```

### 3.6 权限管理接口

#### 3.6.1 获取权限列表

```
GET /api/v1/permissions

Headers:
  Authorization: Bearer <accessToken>

Response (200):
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "user:create",
      "resource": "user",
      "action": "create",
      "description": "创建用户"
    }
  ]
}
```

#### 3.6.2 获取权限树

```
GET /api/v1/permissions/tree

Headers:
  Authorization: Bearer <accessToken>

Response (200):
{
  "success": true,
  "data": [
    {
      "resource": "user",
      "actions": [
        { "action": "create", "name": "user:create" },
        { "action": "read", "name": "user:read" },
        { "action": "update", "name": "user:update" },
        { "action": "delete", "name": "user:delete" }
      ]
    },
    {
      "resource": "role",
      "actions": [...]
    }
  ]
}
```

### 3.7 错误码规范

| 错误码 | HTTP状态码 | 说明 |
|--------|-----------|------|
| AUTH_001 | 401 | 无效的访问令牌 |
| AUTH_002 | 401 | 令牌已过期 |
| AUTH_003 | 401 | 刷新令牌无效 |
| AUTH_004 | 403 | 权限不足 |
| AUTH_005 | 429 | 登录尝试过于频繁 |
| AUTH_006 | 429 | 验证码发送过于频繁 |
| AUTH_007 | 429 | 验证码验证已锁定 |
| AUTH_008 | 404 | 验证码不存在或已过期 |
| AUTH_009 | 429 | 验证码尝试次数过多 |
| AUTH_010 | 400 | 验证码错误 |
| AUTH_011 | 400 | 重置令牌无效 |
| USER_001 | 400 | 用户名格式错误 |
| USER_002 | 400 | 邮箱格式错误 |
| USER_003 | 400 | 密码强度不足 |
| USER_004 | 409 | 用户名已存在 |
| USER_005 | 409 | 邮箱已存在 |
| USER_006 | 404 | 用户不存在 |
| USER_007 | 403 | 禁止修改系统用户 |
| ROLE_001 | 404 | 角色不存在 |
| ROLE_002 | 400 | 禁止修改系统角色 |
| ROLE_003 | 400 | 禁止删除有用户的角色 |

---

## 四、技术选型说明

### 4.1 后端技术栈

| 组件 | 选型 | 理由 |
|------|------|------|
| **运行时** | Node.js 20 LTS | 稳定可靠，生态丰富 |
| **框架** | Express.js / NestJS | Express灵活轻量，NestJS企业级 |
| **ORM** | Prisma | 类型安全，自动迁移，IDE友好 |
| **验证** | Zod + Joi | 运行时类型验证 |
| **认证** | Passport.js + JWT | 成熟的认证解决方案 |
| **加密** | bcrypt + argon2 | 密码哈希 |
| **日志** | Winston + Morgan | 结构化日志 |
| **缓存** | Redis (ioredis) | 高性能缓存、会话存储 |

### 4.2 前端技术栈

| 组件 | 选型 | 理由 |
|------|------|------|
| **框架** | React 18 + TypeScript | 主流，稳定 |
| **状态管理** | Zustand / Redux Toolkit | 轻量/企业级 |
| **路由** | React Router v6 | 官方推荐 |
| **表单** | React Hook Form + Zod | 性能与验证 |
| **HTTP** | Axios / Fetch | API调用 |
| **UI组件** | Ant Design / Material UI | 快速开发 |

### 4.3 数据库选型

| 数据库 | 用途 | 理由 |
|--------|------|------|
| **PostgreSQL** | 主数据库 | 关系型，功能丰富 |
| **Redis** | 缓存、会话 | 高性能，持久化支持 |
| **MongoDB** | 日志存储 | 灵活schema，高写入 |

### 4.4 基础设施

| 组件 | 选型 | 理由 |
|------|------|------|
| **容器化** | Docker + Docker Compose | 开发/生产一致 |
| **编排** | Kubernetes | 生产级容器编排 |
| **CI/CD** | GitHub Actions / GitLab CI | 自动化流水线 |
| **监控** | Prometheus + Grafana | 可观测性 |
| **日志** | ELK Stack | 集中式日志 |
| **配置** | 环境变量 + ConfigMap | 敏感信息分离 |

---

## 五、安全性设计

### 5.1 认证安全

```
┌─────────────────────────────────────────────────────────────────┐
│                         JWT Token 结构                          │
├─────────────────────────────────────────────────────────────────┤
│  Access Token          │  Refresh Token                         │
├────────────────────────┼────────────────────────────────────────┤
│  有效期: 15分钟-1小时   │  有效期: 7-30天                         │
│  存储: 内存            │  存储: HttpOnly Cookie / 安全存储       │
│  用途: API访问         │  用途: 获取新的Access Token             │
└────────────────────────┴────────────────────────────────────────┘
```

#### 5.1.0 Token刷新策略 (v1.1更新)

```
┌─────────────────────────────────────────────────────────────────┐
│                     Token 刷新流程                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  方案一: Token Rotation (推荐)                                   │
│  ─────────────────────────────────────────────────────────────   │
│  1. 使用Refresh Token换取新Token时                               │
│  2. 同时颁发新的Access Token和Refresh Token                      │
│  3. 将旧的Refresh Token加入黑名单                                │
│  4. 旧Token立即失效，即使被窃取也无法使用                         │
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │ 旧Refresh   │───→│  黑名单     │    │ 新Refresh   │          │
│  │ Token       │    │  Redis TTL  │    │ Token       │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
│                                                                  │
│  方案二: 简单刷新                                                 │
│  ─────────────────────────────────────────────────────────────   │
│  1. 使用Refresh Token换取新Access Token                         │
│  2. Refresh Token保持不变（不建议生产环境使用）                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

##### 黑名单实现

```typescript
// Redis黑名单存储
const refreshTokenBlacklist = 'refresh_token:blacklist';

// Token刷新时将旧Token加入黑名单
async function refreshTokens(oldRefreshToken: string, newRefreshToken: string) {
  // 1. 验证旧Token
  const payload = verifyRefreshToken(oldRefreshToken);
  
  // 2. 将旧Token加入黑名单 (TTL = 旧Token剩余有效期)
  const ttl = payload.exp - Math.floor(Date.now() / 1000);
  await redis.setex(
    `${refreshTokenBlacklist}:${oldRefreshToken}`,
    ttl,
    'revoked'
  );
  
  // 3. 存储新Refresh Token
  await saveRefreshToken(payload.userId, newRefreshToken);
  
  // 4. 生成新Access Token
  const newAccessToken = generateAccessToken(payload.userId);
  
  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

// 验证时检查黑名单
async function validateRefreshToken(token: string) {
  // 检查是否在黑名单
  const isBlacklisted = await redis.exists(`${refreshTokenBlacklist}:${token}`);
  if (isBlacklisted) {
    throw new Error('Token已失效');
  }
  return verifyRefreshToken(token);
}
```

##### 旧Token处理策略对比

| 策略 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **Token Rotation** | 安全性高，被盗后立即失效 | 实现复杂，需维护黑名单 | 生产环境（推荐） |
| **家族Token限制** | 可限制同一Refresh Token使用次数 | 仍存在旧Token被盗风险 | 需要控制登录设备数 |
| **简单刷新** | 实现简单 | 安全性较低 | 开发/测试环境 |

##### 推荐配置

```typescript
const tokenConfig = {
  accessToken: {
    expiresIn: '1h',           // Access Token有效期
    secret: process.env.JWT_ACCESS_SECRET,
  },
  refreshToken: {
    expiresIn: '7d',           // Refresh Token有效期
    rotation: true,             // 启用Token Rotation
    singleUse: true,            // 每次刷新生成新Token
    blacklistTTL: '1d',         // 黑名单保留时间
  }
};
```

#### 5.1.1 密码策略

- **最小长度**: 8字符
- **必须包含**:
  - 大写字母 (A-Z)
  - 小写字母 (a-z)
  - 数字 (0-9)
  - 特殊字符 (!@#$%^&*)
- **哈希算法**: Argon2id (首选) 或 bcrypt (成本因子 >= 12)
- **历史记录**: 不允许使用最近5次密码

#### 5.1.2 登录安全

- **暴力破解防护**: 
  - 5次失败后锁定15分钟
  - 渐进式锁定 (15min, 1h, 24h, 永久)
- **多因素认证 (MFA)**: TOTP / 短信 / 邮件验证码
- **异常登录检测**: 新设备 / 新IP / 异地登录警告

### 5.2 授权设计 (RBAC)

```
┌─────────────────────────────────────────────────────────────────┐
│                         权限检查流程                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  请求 ──→ 中间件 ──→ Token验证 ──→ 权限检查 ──→ 业务逻辑        │
│                    │           │           │                    │
│                    │           │           └──→ 403 Forbidden  │
│                    │           │                                 │
│                    │           └──→ 401 Unauthorized            │
│                    │                                              │
│                    └──→ 400 Bad Request                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 5.2.1 权限实现

```typescript
// 权限装饰器示例
@RequirePermission('user:create')
async createUser(@Body() dto: CreateUserDto) { ... }

// 中间件权限检查
const permissionMiddleware = (required: string[]) => {
  return async (req, res, next) => {
    const user = req.user;
    const userPermissions = await getUserPermissions(user.id);
    
    const hasPermission = required.every(p => 
      userPermissions.includes(p)
    );
    
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: { code: 'AUTH_004', message: '权限不足' }
      });
    }
    
    next();
  };
};
```

### 5.3 数据安全

#### 5.3.1 敏感数据处理

```typescript
// 敏感字段脱敏
const sanitizeUser = (user: User) => ({
  ...user,
  password: undefined,
  phone: maskPhone(user.phone),      // 138****5678
  idCard: maskIdCard(user.idCard),    // 110***********1234
  email: maskEmail(user.email),       // j***@example.com
});
```

#### 5.3.2 SQL注入防护

- 使用 Prisma ORM 参数化查询
- 禁止字符串拼接 SQL
- 严格输入验证

#### 5.3.3 XSS防护

- 输入过滤: 移除HTML/JS标签
- 输出编码: HTML转义
- Content-Type: application/json

#### 5.3.4 CSRF防护

- SameSite Cookie
- CSRF Token
- CORS 严格配置

### 5.4 审计日志

```typescript
// 审计日志记录
interface AuditLogEntry {
  userId: string;
  action: 'login' | 'logout' | 'create' | 'update' | 'delete';
  resourceType: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  timestamp: Date;
}
```

### 5.5 验证码存储方案 (v1.1新增)

#### 5.5.1 方案对比

| 特性 | Redis | PostgreSQL |
|------|-------|------------|
| **性能** | 极高 (内存操作) | 中等 (磁盘IO) |
| **TTL支持** | 原生支持 | 需手动清理 |
| **查询能力** | 有限 | 强大 |
| **持久化** | 可选 | 持久 |
| **实现复杂度** | 低 | 低 |
| **适用验证码类型** | 临时性验证码 | 需要审计追溯的验证码 |

#### 5.5.2 推荐方案：Redis + DB混合

```
┌─────────────────────────────────────────────────────────────────┐
│                    验证码存储架构                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  验证码生成 → Redis(快速验证) → DB(审计追溯)                      │
│      │                                    │                      │
│      │         ┌──────────────────────┐    │                      │
│      └────────→│      Redis          │    │                      │
│                │  Key: vc:{target}    │    │                      │
│                │  Value: {code, type} │    │                      │
│                │  TTL: 10分钟         │    │                      │
│                └──────────────────────┘    │                      │
│                                             │                      │
│                ┌──────────────────────┐    │                      │
│                │    PostgreSQL        │←───┘                      │
│                │  verification_codes  │                           │
│                │  - 完整记录          │                           │
│                │  - 用于审计分析       │                           │
│                └──────────────────────┘                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 5.5.3 Redis存储结构

```typescript
// Redis Key设计
const verificationKeys = {
  code: (type: string, target: string) => `vc:${type}:${target}`,
  attempts: (type: string, target: string) => `vc_attempts:${type}:${target}`,
  lockout: (type: string, target: string) => `vc_lockout:${type}:${target}`,
};

// 验证码存储
interface RedisVerificationCode {
  code: string;           // 验证码 (加密存储)
  userId?: string;        // 关联用户ID
  attempts: number;        // 尝试次数
  createdAt: string;       // 创建时间
}

// 存储验证码
async function storeVerificationCode(
  type: string,
  target: string,
  code: string,
  userId?: string
) {
  const key = verificationKeys.code(type, target);
  const data: RedisVerificationCode = {
    code: await hashCode(code),  // 哈希存储，防泄露
    userId,
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  // 存储到Redis，TTL 10分钟
  await redis.setex(key, 600, JSON.stringify(data));
}

// 同时异步写入数据库（审计用）
await db.verificationCodes.create({
  type,
  code: await hashCode(code),
  target,
  userId,
  expiresAt: new Date(Date.now() + 10 * 60 * 1000),
});
```

#### 5.5.4 验证码安全策略

```typescript
// 验证码安全配置
const verificationConfig = {
  codeLength: 6,              // 验证码长度
  expiresIn: 600,              // 有效期: 10分钟
  maxAttempts: 5,               // 最大验证尝试次数
  lockoutDuration: 900,        // 锁定时间: 15分钟
  sendCooldown: 60,             // 发送间隔: 60秒
  dailyLimit: 10,               // 每日发送上限
};

// 验证流程
async function verifyCode(
  type: string,
  target: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const key = verificationKeys.code(type, target);

  // 1. 检查发送频率限制
  const cooldownKey = `${key}:cooldown`;
  if (await redis.exists(cooldownKey)) {
    return { success: false, error: 'AUTH_006' }; // 发送过于频繁
  }

  // 2. 检查锁定状态
  const lockoutKey = verificationKeys.lockout(type, target);
  if (await redis.exists(lockoutKey)) {
    return { success: false, error: 'AUTH_007' }; // 账户已锁定
  }

  // 3. 获取验证码
  const data = await redis.get(key);
  if (!data) {
    return { success: false, error: 'AUTH_008' }; // 验证码不存在
  }

  const verification: RedisVerificationCode = JSON.parse(data);

  // 4. 检查是否过期 (Redis TTL已自动处理)
  // 5. 检查尝试次数
  if (verification.attempts >= verificationConfig.maxAttempts) {
    // 锁定账户
    await redis.setex(lockoutKey, verificationConfig.lockoutDuration, 'locked');
    await redis.del(key);
    return { success: false, error: 'AUTH_009' }; // 尝试次数过多
  }

  // 6. 验证验证码
  const isValid = await verifyHash(code, verification.code);
  if (!isValid) {
    // 增加尝试次数
    verification.attempts += 1;
    await redis.setex(key, await redis.ttl(key), JSON.stringify(verification));
    return { success: false, error: 'AUTH_010' }; // 验证码错误
  }

  // 7. 验证成功，删除验证码
  await redis.del(key);

  return { success: true };
}
```

#### 5.5.5 验证码接口 (补充)

```
POST /api/v1/auth/send-code    - 发送验证码
POST /api/v1/auth/verify-code  - 验证验证码
POST /api/v1/auth/reset-password - 使用验证Token重置密码
```

---

## 六、技术风险评估

### 6.1 高风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| JWT密钥泄露 | 极高 | 低 | 密钥轮换、HSM存储、环境隔离 |
| 数据库注入 | 极高 | 中 | ORM、参数化查询、WAF |
| 密码泄露 | 高 | 中 | Argon2哈希、加密传输、登录限制 |

### 6.2 中风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 会话劫持 | 高 | 中 | HTTPS、HttpOnly、Secure Cookie |
| CSRF攻击 | 中 | 中 | SameSite Cookie、CSRF Token |
| 暴力破解 | 中 | 高 | 登录限制、MFA、设备绑定 |
| 数据泄露 | 高 | 低 | 加密存储、脱敏、日志审计 |

### 6.3 低风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 权限绕过 | 中 | 低 | 严格的权限检查、代码审计 |
| 依赖漏洞 | 中 | 中 | 定期依赖审计、NPM审计 |
| 配置错误 | 中 | 低 | 配置模板、环境分离 |

---

## 七、部署架构

### 7.1 开发环境

```
┌─────────────────────────────────────────────────────────────────┐
│                        开发环境架构                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐                                               │
│  │   Docker     │                                               │
│  │   Compose    │                                               │
│  ├──────────────┤                                               │
│  │ PostgreSQL   │  :5432                                        │
│  │ Redis        │  :6379                                        │
│  │ MongoDB      │  :27017                                       │
│  │ Backend API  │  :3000                                        │
│  │ Frontend     │  :5173                                        │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 生产环境

```
┌─────────────────────────────────────────────────────────────────┐
│                        生产环境架构                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Load Balancer (ALB)                  │    │
│  └───────────────────────────┬─────────────────────────────┘    │
│                              │                                    │
│          ┌───────────────────┼───────────────────┐               │
│          │                   │                   │               │
│  ┌───────▼───────┐   ┌───────▼───────┐   ┌───────▼───────┐      │
│  │   Node.js     │   │   Node.js     │   │   Node.js     │      │
│  │   Pod 1       │   │   Pod 2       │   │   Pod 3       │      │
│  └───────┬───────┘   └───────┬───────┘   └───────┬───────┘      │
│          │                   │                   │               │
│  ┌───────▼───────────────────▼───────────────────▼───────┐        │
│  │                    Redis Cluster                       │        │
│  │              (主从复制 + Sentinel)                     │        │
│  └────────────────────────────────────────────────────────┘        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │                    PostgreSQL Primary                     │     │
│  │                          +                               │     │
│  │              PostgreSQL Replica (读写分离)                │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │                      MongoDB Replica                     │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 八、项目目录结构

```
user-management/
├── backend/
│   ├── src/
│   │   ├── config/           # 配置文件
│   │   │   ├── database.ts
│   │   │   ├── redis.ts
│   │   │   └── jwt.ts
│   │   ├── modules/          # 功能模块
│   │   │   ├── auth/
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth.middleware.ts
│   │   │   │   └── dto/
│   │   │   ├── user/
│   │   │   │   ├── user.controller.ts
│   │   │   │   ├── user.service.ts
│   │   │   │   ├── user.repository.ts
│   │   │   │   └── dto/
│   │   │   ├── role/
│   │   │   │   ├── role.controller.ts
│   │   │   │   ├── role.service.ts
│   │   │   │   └── dto/
│   │   │   └── permission/
│   │   ├── common/           # 公共模块
│   │   │   ├── decorators/
│   │   │   ├── filters/
│   │   │   ├── guards/
│   │   │   ├── interceptors/
│   │   │   └── pipes/
│   │   ├── database/         # 数据库
│   │   │   ├── prisma/
│   │   │   └── migrations/
│   │   └── utils/            # 工具函数
│   ├── prisma/
│   │   └── schema.prisma
│   ├── tests/
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── api/              # API调用
│   │   ├── components/       # 组件
│   │   ├── hooks/           # 自定义Hook
│   │   ├── pages/           # 页面
│   │   ├── stores/          # 状态管理
│   │   ├── types/           # 类型定义
│   │   └── utils/           # 工具函数
│   ├── package.json
│   └── tsconfig.json
│
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
└── README.md
```

---

## 九、下一步工作

1. **PM**: 提供完整的用户故事和业务流程
2. **Backend**: 基于架构文档设计详细的数据库Schema
3. **Frontend**: 设计UI/UX原型
4. **QA**: 编写测试用例和测试计划

---

*文档版本: v1.1 | 最后更新: 2026-04-01 | 更新内容: MVP角色调整、验证码存储方案、Token刷新策略*
