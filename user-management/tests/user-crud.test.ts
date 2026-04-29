import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';

describe('用户CRUD接口测试', () => {
  let adminToken: string;
  let userToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // 创建管理员
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash('Admin123!@#', 12);

    const admin = await prisma.user.upsert({
      where: { email: 'admin-crud@example.com' },
      update: {},
      create: {
        email: 'admin-crud@example.com',
        password: hashedPassword,
        name: 'Admin CRUD',
      },
    });

    const adminRole = await prisma.role.upsert({
      where: { name: 'admin' },
      update: {},
      create: { name: 'admin', description: 'Administrator' },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
      update: {},
      create: { userId: admin.id, roleId: adminRole.id },
    });

    // 创建普通用户
    const hashedUserPassword = await bcrypt.hash('User123!@#', 12);
    const testUser = await prisma.user.upsert({
      where: { email: 'user-crud@example.com' },
      update: {},
      create: {
        email: 'user-crud@example.com',
        password: hashedUserPassword,
        name: 'Test User',
      },
    });

    const userRole = await prisma.role.upsert({
      where: { name: 'user' },
      update: {},
      create: { name: 'user', description: 'Regular user' },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: testUser.id, roleId: userRole.id } },
      update: {},
      create: { userId: testUser.id, roleId: userRole.id },
    });

    testUserId = testUser.id;

    // 获取Token
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin-crud@example.com', password: 'Admin123!@#' });
    adminToken = adminRes.body.data.token;

    const userRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user-crud@example.com', password: 'User123!@#' });
    userToken = userRes.body.data.token;
  });

  afterAll(async () => {
    await prisma.userRole.deleteMany({
      where: { user: { email: { in: ['admin-crud@example.com', 'user-crud@example.com'] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['admin-crud@example.com', 'user-crud@example.com'] } },
    });
    await prisma.role.deleteMany({ where: { name: { startsWith: 'test-role-' } } });
    await prisma.$disconnect();
  });

  describe('GET /api/users', () => {
    it('管理员应该能获取用户列表', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.users)).toBe(true);
    });

    it('普通用户不应该能获取用户列表', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('未认证请求应该被拒绝', async () => {
      const res = await request(app).get('/api/users');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/users/:id', () => {
    it('管理员应该能获取用户详情', async () => {
      const res = await request(app)
        .get(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testUserId);
    });

    it('普通用户不应该能获取其他用户详情', async () => {
      const res = await request(app)
        .get(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/users/:id', () => {
    it('管理员应该能更新用户信息', async () => {
      const res = await request(app)
        .put(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ fullName: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('应该验证邮箱格式', async () => {
      const res = await request(app)
        .put(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'invalid-email' });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/users/:id', () => {
    let userToDeleteId: string;

    beforeAll(async () => {
      // 创建一个待删除的用户
      const bcrypt = await import('bcryptjs');
      const hashed = await bcrypt.hash('Delete123!@#', 12);
      const user = await prisma.user.create({
        data: {
          email: `delete-${Date.now()}@test.com`,
          password: hashed,
          name: 'To Delete',
        },
      });
      userToDeleteId = user.id;
    });

    it('管理员应该能删除用户', async () => {
      const res = await request(app)
        .delete(`/api/users/${userToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('普通用户不应该能删除用户', async () => {
      const res = await request(app)
        .delete(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });
});
