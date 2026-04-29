import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';

describe('角色管理接口测试', () => {
  let adminToken: string;
  let testRoleId: string;

  beforeAll(async () => {
    // 创建管理员用户
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash('Admin123!@#', 12);

    const admin = await prisma.user.upsert({
      where: { email: 'admin-test@example.com' },
      update: {},
      create: {
        email: 'admin-test@example.com',
        password: hashedPassword,
        name: 'Admin Test',
      },
    });

    // 创建admin角色
    const adminRole = await prisma.role.upsert({
      where: { name: 'admin' },
      update: {},
      create: { name: 'admin', description: 'Administrator role' },
    });

    // 分配角色
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: admin.id,
          roleId: adminRole.id,
        },
      },
      update: {},
      create: {
        userId: admin.id,
        roleId: adminRole.id,
      },
    });

    // 登录获取token
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin-test@example.com',
        password: 'Admin123!@#',
      });

    adminToken = res.body.data.token;
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.userRole.deleteMany({
      where: { user: { email: 'admin-test@example.com' } },
    });
    await prisma.user.deleteMany({
      where: { email: 'admin-test@example.com' },
    });
    await prisma.role.deleteMany({
      where: { name: { startsWith: 'test-role-' } },
    });
    await prisma.$disconnect();
  });

  describe('POST /api/roles', () => {
    it('应该成功创建角色', async () => {
      const roleName = `test-role-${Date.now()}`;
      const res = await request(app)
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: roleName,
          description: 'Test role',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(roleName);
      testRoleId = res.body.data.id;
    });

    it('不应该创建重复角色', async () => {
      const res = await request(app)
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'admin',
          description: 'Duplicate role',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/roles', () => {
    it('应该返回角色列表', async () => {
      const res = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.roles)).toBe(true);
    });
  });

  describe('GET /api/roles/:id', () => {
    it('应该返回角色详情', async () => {
      const res = await request(app)
        .get(`/api/roles/${testRoleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testRoleId);
    });
  });

  describe('PUT /api/roles/:id', () => {
    it('应该成功更新角色', async () => {
      const res = await request(app)
        .put(`/api/roles/${testRoleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'Updated description',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toBe('Updated description');
    });
  });

  describe('DELETE /api/roles/:id', () => {
    it('应该成功删除角色', async () => {
      const res = await request(app)
        .delete(`/api/roles/${testRoleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
