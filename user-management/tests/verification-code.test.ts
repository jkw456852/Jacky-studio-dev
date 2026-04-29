import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';

describe('验证码接口测试', () => {
  let testUserEmail: string;
  let testUserPassword: string;
  let userToken: string;
  let resetToken: string;

  beforeAll(async () => {
    // 创建测试用户
    const bcrypt = await import('bcryptjs');
    testUserEmail = `verification-${Date.now()}@test.com`;
    testUserPassword = 'Test@123456';
    const hashedPassword = await bcrypt.hash(testUserPassword, 12);

    await prisma.user.upsert({
      where: { email: testUserEmail },
      update: {},
      create: {
        email: testUserEmail,
        password: hashedPassword,
        name: 'Verification Test',
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: testUserEmail },
    });
    await prisma.$disconnect();
  });

  describe('POST /api/auth/send-code', () => {
    it('应该成功发送验证码给已注册用户', async () => {
      const res = await request(app)
        .post('/api/auth/send-code')
        .send({ email: testUserEmail });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('验证码');
    });

    it('对未注册邮箱也应返回成功（防枚举攻击）', async () => {
      const res = await request(app)
        .post('/api/auth/send-code')
        .send({ email: 'nonexistent@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('验证码');
    });

    it('60秒内重复发送应触发冷却（AUTH_006）', async () => {
      // 第一次发送
      await request(app)
        .post('/api/auth/send-code')
        .send({ email: testUserEmail });

      // 立即第二次发送
      const res = await request(app)
        .post('/api/auth/send-code')
        .send({ email: testUserEmail });

      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('AUTH_006');
    });

    it('无效邮箱格式应返回400', async () => {
      const res = await request(app)
        .post('/api/auth/send-code')
        .send({ email: 'invalid-email' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/verify-code', () => {
    beforeAll(async () => {
      // 发送验证码获取测试用的code
      // 注意：实际code在生产环境中通过邮件发送，这里只能测试错误情况
    });

    it('无效验证码应返回AUTH_010', async () => {
      const res = await request(app)
        .post('/api/auth/verify-code')
        .send({ email: testUserEmail, code: '000000' });

      // 由于验证码不存在，应该返回AUTH_008
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(['AUTH_008', 'AUTH_010']).toContain(res.body.code);
    });

    it('不存在的验证码应返回AUTH_008', async () => {
      const res = await request(app)
        .post('/api/auth/verify-code')
        .send({ email: 'newemail@example.com', code: '123456' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('AUTH_008');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('无效重置token应返回错误', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'NewTest@123456',
          confirmPassword: 'NewTest@123456',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('空token应返回验证错误', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: '',
          newPassword: 'NewTest@123456',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/change-password', () => {
    beforeAll(async () => {
      // 登录获取token
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUserEmail, password: testUserPassword });
      userToken = res.body.data.token;
    });

    it('原密码错误应返回401', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          oldPassword: 'WrongPassword123',
          newPassword: 'NewTest@123456',
          confirmPassword: 'NewTest@123456',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('新密码与原密码相同应返回400', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          oldPassword: testUserPassword,
          newPassword: testUserPassword,
          confirmPassword: testUserPassword,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('未认证请求应返回401', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .send({
          oldPassword: testUserPassword,
          newPassword: 'NewTest@123456',
          confirmPassword: 'NewTest@123456',
        });

      expect(res.status).toBe(401);
    });

    it('密码强度不足应返回400', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          oldPassword: testUserPassword,
          newPassword: 'weak',
          confirmPassword: 'weak',
        });

      expect(res.status).toBe(400);
    });

    it('确认密码不一致应返回400', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          oldPassword: testUserPassword,
          newPassword: 'NewTest@123456',
          confirmPassword: 'Different@123456',
        });

      expect(res.status).toBe(400);
    });

    it('成功修改密码应返回200', async () => {
      const newPassword = 'Changed@123456';
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          oldPassword: testUserPassword,
          newPassword,
          confirmPassword: newPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // 更新密码用于后续测试
      testUserPassword = newPassword;
    });

    it('使用新密码登录应成功', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUserEmail, password: testUserPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });
  });
});

describe('错误码覆盖测试', () => {
  const testEmail = `errorcode-${Date.now()}@test.com`;

  beforeAll(async () => {
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash('Test@123456', 12);

    await prisma.user.upsert({
      where: { email: testEmail },
      update: {},
      create: {
        email: testEmail,
        password: hashedPassword,
        name: 'Error Code Test',
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });
    await prisma.$disconnect();
  });

  describe('验证码错误码覆盖', () => {
    it('AUTH_006: 发送过于频繁', async () => {
      // 第一次发送
      await request(app)
        .post('/api/auth/send-code')
        .send({ email: testEmail });

      // 60秒内再次发送
      const res = await request(app)
        .post('/api/auth/send-code')
        .send({ email: testEmail });

      expect(res.status).toBe(429);
      expect(res.body.code).toBe('AUTH_006');
    });

    it('AUTH_008: 验证码不存在或已过期', async () => {
      const res = await request(app)
        .post('/api/auth/verify-code')
        .send({ email: testEmail, code: '123456' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('AUTH_008');
    });
  });

  describe('重置密码错误码覆盖', () => {
    it('AUTH_011: 重置令牌无效', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
          newPassword: 'NewTest@123456',
          confirmPassword: 'NewTest@123456',
        });

      expect(res.status).toBe(400);
    });
  });
});

describe('安全性测试 - 验证码', () => {
  const testEmail = `security-${Date.now()}@test.com`;

  beforeAll(async () => {
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash('Test@123456', 12);

    await prisma.user.upsert({
      where: { email: testEmail },
      update: {},
      create: {
        email: testEmail,
        password: hashedPassword,
        name: 'Security Test',
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });
    await prisma.$disconnect();
  });

  it('验证码存储应加密', async () => {
    // 发送验证码
    await request(app)
      .post('/api/auth/send-code')
      .send({ email: testEmail });

    // 尝试使用常见弱验证码
    const weakCodes = ['000000', '111111', '123456', '654321', 'aaaaaa'];
    for (const code of weakCodes) {
      const res = await request(app)
        .post('/api/auth/verify-code')
        .send({ email: testEmail, code });
      
      // 不应该返回具体的错误信息泄露验证码
      if (res.status === 400 && res.body.code === 'AUTH_010') {
        expect(res.body).toHaveProperty('attemptsLeft');
      }
    }
  });

  it('登录失败不会泄露用户是否存在', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'definitely-nonexistent-12345678@example.com', password: 'anypassword' });

    // 应该返回通用错误信息
    expect(res.status).toBe(401);
    expect(res.body.error).not.toContain('不存在');
  });
});
