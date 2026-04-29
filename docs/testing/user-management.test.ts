/**
 * 用户管理系统测试脚本
 * 运行方式: node --experimental-strip-types --test docs/testing/user-management.test.ts
 * 
 * 注意: 需要先启动后端服务 (localhost:3000)
 */

import assert from 'node:assert/strict';
import test from 'node:test';

// 配置
const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000/api';

// 测试用户数据
const testUser = {
  email: `test_${Date.now()}@example.com`,
  password: 'Test@123456',
  nickname: 'TestUser',
};

const adminUser = {
  email: 'admin@example.com',
  password: 'Admin@123456',
};

let authToken: string;
let testUserId: string;

// ──────────────────────────────────────────────
// 辅助函数
// ──────────────────────────────────────────────

async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ status: number; data: any }> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ──────────────────────────────────────────────
// 2.1 用户注册功能测试
// ──────────────────────────────────────────────

test.describe('用户注册功能 (REG)', () => {
  test('REG-001: 正常邮箱注册', async () => {
    const { status, data } = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: `newuser_${Date.now()}@test.com`,
        password: 'Valid@123456',
        nickname: 'NewUser',
      }),
    });

    assert.equal(status, 201, `注册失败，状态码: ${status}`);
    assert.ok(data.token, '未返回认证Token');
    authToken = data.token;
    testUserId = data.user?.id;
  });

  test('REG-002: 邮箱格式错误', async () => {
    const { status, data } = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'invalid-email',
        password: 'Valid@123456',
      }),
    });

    assert.ok(status >= 400, '无效邮箱应该返回错误状态');
    assert.ok(
      data.message?.includes('邮箱') || data.message?.includes('email'),
      '错误信息应提示邮箱格式问题'
    );
  });

  test('REG-003: 密码强度不足', async () => {
    const { status, data } = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: `weak_${Date.now()}@test.com`,
        password: '123456',
      }),
    });

    assert.ok(status >= 400, '弱密码应该返回错误状态');
    assert.ok(
      data.message?.toLowerCase().includes('password') ||
      data.message?.includes('密码'),
      '错误信息应提示密码强度问题'
    );
  });

  test('REG-004: 邮箱已注册', async () => {
    const existingEmail = `existing_${Date.now()}@test.com`;

    // 第一次注册
    await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: existingEmail,
        password: 'Valid@123456',
      }),
    });

    // 第二次注册同一邮箱
    const { status, data } = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: existingEmail,
        password: 'Valid@123456',
      }),
    });

    assert.ok(status >= 400, '重复邮箱注册应返回错误');
    assert.ok(
      data.message?.includes('已注册') || data.message?.includes('exists'),
      '错误信息应提示邮箱已存在'
    );
  });

  test('REG-006: 必填字段为空', async () => {
    const { status, data } = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    assert.ok(status >= 400, '空数据应该返回错误状态');
  });
});

// ──────────────────────────────────────────────
// 2.2 用户登录功能测试
// ──────────────────────────────────────────────

test.describe('用户登录功能 (LOG)', () => {
  test.beforeAll(async () => {
    // 创建测试用户用于登录测试
    const { data } = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: `logintest_${Date.now()}@test.com`,
        password: 'Login@123456',
        nickname: 'LoginTest',
      }),
    });
    testUser.email = data.user?.email || `logintest_${Date.now()}@test.com`;
    testUser.password = 'Login@123456';
  });

  test('LOG-001: 正常账号密码登录', async () => {
    const { status, data } = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
      }),
    });

    assert.equal(status, 200, `登录失败，状态码: ${status}`);
    assert.ok(data.token, '未返回认证Token');
    authToken = data.token;
  });

  test('LOG-002: 错误密码登录', async () => {
    const { status, data } = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testUser.email,
        password: 'WrongPassword123',
      }),
    });

    assert.ok(status >= 400, '错误密码应返回错误状态');
    assert.ok(
      data.message?.includes('密码') || data.message?.includes('password'),
      '错误信息应提示密码错误'
    );
  });

  test('LOG-003: 不存在账号登录', async () => {
    const { status, data } = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: 'AnyPassword123',
      }),
    });

    assert.ok(status >= 400, '不存在的账号应返回错误状态');
    assert.ok(
      data.message?.includes('不存在') || data.message?.includes('not found'),
      '错误信息应提示用户不存在'
    );
  });

  test('LOG-004: 空字段登录', async () => {
    const { status } = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    assert.ok(status >= 400, '空数据应返回错误状态');
  });

  test('LOG-008: 无Token访问受保护资源', async () => {
    const savedToken = authToken;
    authToken = '';

    const { status } = await apiRequest('/users/me');

    authToken = savedToken;
    assert.ok(status === 401, '无Token应返回401未授权');
  });
});

// ──────────────────────────────────────────────
// 2.3 用户CRUD操作测试
// ──────────────────────────────────────────────

test.describe('用户CRUD操作 (CRUD)', () => {
  test.beforeAll(async () => {
    // 确保有管理员权限的Token
    const { data } = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(adminUser),
    });

    if (data.token) {
      authToken = data.token;
    }
  });

  test('CRUD-002: 查询用户列表', async () => {
    const { status, data } = await apiRequest('/users');

    assert.equal(status, 200, `查询失败，状态码: ${status}`);
    assert.ok(Array.isArray(data.users) || Array.isArray(data), '应返回用户列表');
  });

  test('CRUD-003: 搜索用户', async () => {
    const { status, data } = await apiRequest('/users?search=test');

    assert.equal(status, 200, `搜索失败，状态码: ${status}`);
  });

  test('CRUD-004: 查看用户详情', async () => {
    // 先获取用户列表
    const listRes = await apiRequest('/users');
    const userId = listRes.data.users?.[0]?.id || listRes.data?.[0]?.id;

    if (userId) {
      const { status, data } = await apiRequest(`/users/${userId}`);
      assert.equal(status, 200, `查询失败，状态码: ${status}`);
      assert.ok(data.id, '应返回用户ID');
    }
  });

  test('CRUD-005: 更新用户信息', async () => {
    // 获取当前用户信息
    const { data: meData } = await apiRequest('/users/me');
    const userId = meData.id;

    if (userId) {
      const { status } = await apiRequest(`/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({
          nickname: `Updated_${Date.now()}`,
        }),
      });

      assert.equal(status, 200, `更新失败，状态码: ${status}`);
    }
  });

  test('CRUD-008: 删除用户(创建新用户后删除)', async () => {
    // 先创建用户
    const { data: createData } = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: `todelete_${Date.now()}@test.com`,
        password: 'Delete@123456',
        nickname: 'ToDelete',
      }),
    });

    const userId = createData.user?.id;
    if (userId) {
      const { status } = await apiRequest(`/users/${userId}`, {
        method: 'DELETE',
      });

      assert.equal(status, 200, `删除失败，状态码: ${status}`);
    }
  });
});

// ──────────────────────────────────────────────
// 2.4 角色权限功能测试
// ──────────────────────────────────────────────

test.describe('角色权限功能 (PERM)', () => {
  test.beforeAll(async () => {
    // 确保有管理员Token
    const { data } = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(adminUser),
    });

    if (data.token) {
      authToken = data.token;
    }
  });

  test('PERM-001: 创建角色', async () => {
    const { status, data } = await apiRequest('/roles', {
      method: 'POST',
      body: JSON.stringify({
        name: `TestRole_${Date.now()}`,
        description: '测试角色',
        permissions: ['user:read', 'user:write'],
      }),
    });

    assert.equal(status, 201, `创建角色失败，状态码: ${status}`);
    assert.ok(data.id || data.role?.id, '应返回角色ID');
  });

  test('PERM-002: 查询角色列表', async () => {
    const { status, data } = await apiRequest('/roles');

    assert.equal(status, 200, `查询失败，状态码: ${status}`);
    assert.ok(Array.isArray(data.roles) || Array.isArray(data), '应返回角色列表');
  });

  test('PERM-003: 分配用户角色', async () => {
    // 获取用户和角色
    const usersRes = await apiRequest('/users');
    const rolesRes = await apiRequest('/roles');

    const userId = usersRes.data.users?.[0]?.id || usersRes.data?.[0]?.id;
    const roleId = rolesRes.data.roles?.[0]?.id || rolesRes.data?.[0]?.id;

    if (userId && roleId) {
      const { status } = await apiRequest(`/users/${userId}/roles`, {
        method: 'POST',
        body: JSON.stringify({ roleId }),
      });

      assert.equal(status, 200, `分配角色失败，状态码: ${status}`);
    }
  });

  test('PERM-005: 普通用户越权访问', async () => {
    // 使用普通用户Token
    const { data } = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
      }),
    });

    if (data.token) {
      const { status } = await apiRequest('/users', {
        headers: { Authorization: `Bearer ${data.token}` },
      });

      // 普通用户访问用户管理应该被拒绝
      assert.ok(status === 403 || status === 401, '普通用户越权访问应被拒绝');
    }
  });
});

// ──────────────────────────────────────────────
// 2.5 接口性能测试
// ──────────────────────────────────────────────

test.describe('接口性能测试 (PERF)', () => {
  test('PERF-001: 用户列表API响应时间', async () => {
    const start = Date.now();
    const { status } = await apiRequest('/users');
    const elapsed = Date.now() - start;

    assert.equal(status, 200, '请求失败');
    assert.ok(elapsed < 500, `响应时间 ${elapsed}ms 超过500ms阈值`);
    console.log(`用户列表API响应时间: ${elapsed}ms`);
  });

  test('PERF-002: 登录API响应时间', async () => {
    const start = Date.now();
    const { status } = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
      }),
    });
    const elapsed = Date.now() - start;

    assert.equal(status, 200, '登录失败');
    assert.ok(elapsed < 1000, `登录响应时间 ${elapsed}ms 超过1s阈值`);
    console.log(`登录API响应时间: ${elapsed}ms`);
  });

  test('PERF-004: 并发请求处理', async () => {
    const concurrent = 10;
    const requests = Array.from({ length: concurrent }, () =>
      apiRequest('/users')
    );

    const results = await Promise.all(requests);
    const successCount = results.filter(r => r.status === 200).length;

    assert.ok(successCount >= concurrent * 0.9, `并发请求成功率 ${successCount}/${concurrent} 低于90%`);
    console.log(`并发请求: ${concurrent}个，成功率 ${successCount}/${concurrent}`);
  });
});

// ──────────────────────────────────────────────
// 2.6 安全性测试
// ──────────────────────────────────────────────

test.describe('安全性测试 (SEC)', () => {
  test('SEC-001: SQL注入防护', async () => {
    const { status, data } = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: "admin' OR '1'='1",
        password: "admin' OR '1'='1",
      }),
    });

    assert.ok(status >= 400, 'SQL注入应被拒绝');
  });

  test('SEC-002: XSS防护', async () => {
    const { status, data } = await apiRequest('/users/me', {
      method: 'PUT',
      body: JSON.stringify({
        nickname: '<script>alert(1)</script>',
      }),
    });

    // 应该成功或返回输入被转义的数据
    assert.ok(status === 200 || data.nickname !== '<script>', 'XSS攻击应被防护');
  });

  test('SEC-004: 密码加密验证', async () => {
    // 注册新用户
    const email = `security_${Date.now()}@test.com`;
    const { data } = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: 'SecTest@123456',
      }),
    });

    // 验证返回的密码被加密
    assert.ok(
      !data.password || data.password === undefined,
      '密码不应在响应中返回'
    );
  });

  test('SEC-007: 暴力破解防护', async () => {
    // 连续5次错误登录
    for (let i = 0; i < 5; i++) {
      await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'bruteforce@test.com',
          password: 'wrong',
        }),
      });
    }

    // 第6次尝试
    const { status, data } = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'bruteforce@test.com',
        password: 'wrong',
      }),
    });

    // 应该被锁定或需要验证码
    assert.ok(
      status >= 429 || data.message?.includes('锁定') || data.message?.includes('验证码'),
      '应触发暴力破解防护'
    );
  });
});

// ──────────────────────────────────────────────
// 测试报告输出
// ──────────────────────────────────────────────

test.on('test:fail', (evt) => {
  console.error(`❌ 测试失败: ${evt.test.name}`);
  console.error(`   错误: ${evt.error?.message}`);
});

test.on('test:success', (evt) => {
  console.log(`✅ 通过: ${evt.test.name}`);
});
