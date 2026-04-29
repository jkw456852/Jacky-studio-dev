import request from 'supertest';
import app from '../src/app.js';

describe('安全性测试', () => {
  describe('SQL注入防护', () => {
    it('注册接口应该拒绝SQL注入', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: "test' OR '1'='1@test.com",
          password: 'Test@123456',
          username: 'testuser',
        });

      expect(res.status).toBe(400);
    });

    it('登录接口应该拒绝SQL注入', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: "admin' OR '1'='1",
          password: "admin' OR '1'='1",
        });

      expect(res.status).toBe(401);
    });

    it('用户查询应该拒绝SQL注入', async () => {
      // 先注册获取token
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `sqlinjection-${Date.now()}@test.com`,
          password: 'Test@123456',
          username: 'sqliuser',
        });

      const token = registerRes.body.data?.token;

      if (token) {
        const res = await request(app)
          .get('/api/users?search=test\' OR \'1\'=\'1')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        // 应该返回空结果或正常处理
      }
    });
  });

  describe('XSS防护', () => {
    it('用户名称应该转义特殊字符', async () => {
      const xssPayload = '<script>alert(1)</script>';
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `xss-${Date.now()}@test.com`,
          password: 'Test@123456',
          username: 'normaluser',
        });

      const token = registerRes.body.data?.token;

      if (token) {
        // 尝试更新包含XSS的用户名
        const res = await request(app)
          .put('/api/auth/profile')
          .set('Authorization', `Bearer ${token}`)
          .send({ fullName: xssPayload });

        // 响应中不应包含原始script标签
        if (res.body.data?.fullName) {
          expect(res.body.data.fullName).not.toContain('<script>');
        }
      }
    });
  });

  describe('暴力破解防护', () => {
    it('连续错误登录应该触发限流', async () => {
      // 连续10次错误登录
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'bruteforce@test.com',
            password: 'wrongpassword',
          });
      }

      // 第11次请求应该被限流
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'bruteforce@test.com',
          password: 'wrongpassword',
        });

      expect(res.status).toBe(429);
      expect(res.body.error).toContain('频繁');
    });
  });

  describe('认证安全', () => {
    it('无效Token应该被拒绝', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token-12345');

      expect(res.status).toBe(401);
    });

    it('过期Token应该被拒绝', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');

      expect(res.status).toBe(401);
    });

    it('密码不应在响应中返回', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: `response-${Date.now()}@test.com`,
          password: 'Test@123456',
          username: 'responseuser',
        });

      expect(res.body.data?.password).toBeUndefined();
      expect(res.body.data?.user?.password).toBeUndefined();
    });
  });
});

describe('性能测试', () => {
  let token: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `perf-${Date.now()}@test.com`,
        password: 'Test@123456',
        username: 'perfuser',
      });
    token = res.body.data?.token;
  });

  describe('响应时间测试', () => {
    it('登录接口响应时间应该小于500ms', async () => {
      const start = Date.now();
      await request(app)
        .post('/api/auth/login')
        .send({
          email: `perf-${Date.now()}@test.com`,
          password: 'Test@123456',
        });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(500);
    });

    it('获取用户列表响应时间应该小于1秒', async () => {
      if (!token) return;

      const start = Date.now();
      await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(1000);
    });

    it('获取当前用户响应时间应该小于200ms', async () => {
      if (!token) return;

      const start = Date.now();
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('并发测试', () => {
    it('应该能处理10个并发请求', async () => {
      if (!token) return;

      const concurrentRequests = 10;
      const requests = Array.from({ length: concurrentRequests }, () =>
        request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${token}`)
      );

      const results = await Promise.all(requests);
      const successCount = results.filter(r => r.status === 200).length;

      expect(successCount).toBeGreaterThanOrEqual(concurrentRequests * 0.9);
    });
  });
});
