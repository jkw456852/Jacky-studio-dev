import dotenv from 'dotenv';

// 加载测试环境变量
dotenv.config({ path: '.env.test' });

// Jest全局设置
beforeAll(() => {
  // 测试前设置
});

afterAll(async () => {
  // 测试后清理
});
