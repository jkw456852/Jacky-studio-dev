import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useForm } from '../hooks/useForm';
import { useAuthStore } from '../stores/auth.store';
import { loginSchema } from '../types/schemas';
import Card from '../components/Layout/Card';
import Form from '../components/Form/Form';
import Input from '../components/Form/Input';
import Button from '../components/Form/Button';
import Checkbox from '../components/Form/Checkbox';
import { Lock, Mail } from 'lucide-react';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isLoading, error, clearError } = useAuthStore();
  
  const [captchaUrl, setCaptchaUrl] = useState<string>('');
  const [captchaLoading, setCaptchaLoading] = useState(false);
  
  const redirect = searchParams.get('redirect') || '/';

  const { formData, errors, isLoading: formLoading, handleChange, handleSubmit, setFieldValue } = useForm({
    schema: loginSchema,
    defaultValues: {
      email: '',
      password: '',
      remember: false,
      captcha: '',
    },
    onSubmit: async (data) => {
      await login(data.email, data.password, data.remember || false);
      
      // 如果登录成功，跳转到目标页面
      if (!error) {
        navigate(redirect);
      }
    },
  });

  // 获取验证码
  const fetchCaptcha = async () => {
    setCaptchaLoading(true);
    try {
      // TODO: 调用后端获取验证码API
      // const response = await fetch('/api/auth/captcha');
      // const data = await response.json();
      // setCaptchaUrl(data.captchaUrl);
      
      // 模拟验证码
      setCaptchaUrl(`/captcha?t=${Date.now()}`);
    } catch (error) {
      console.error('获取验证码失败:', error);
    } finally {
      setCaptchaLoading(false);
    }
  };

  // 监听错误变化，刷新验证码
  useEffect(() => {
    if (error?.message?.includes('验证码')) {
      fetchCaptcha();
    }
    clearError();
  }, [error]);

  // 初始化时获取验证码
  useEffect(() => {
    fetchCaptcha();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    handleSubmit(e);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">用户管理系统</h1>
          <p className="mt-2 text-sm text-gray-600">
            请输入您的账号信息登录
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card padding="lg" shadow="lg">
          <Form
            onSubmit={handleLogin}
            title="登录账号"
            error={error?.message}
          >
            <Input
              label="邮箱地址"
              type="email"
              name="email"
              value={formData.email}
              onChange={(e) => handleChange('email')(e.target.value)}
              error={errors.email}
              placeholder="请输入邮箱"
              leftIcon={<Mail className="h-4 w-4 text-gray-400" />}
              required
              autoComplete="email"
            />

            <Input
              label="密码"
              type="password"
              name="password"
              value={formData.password}
              onChange={(e) => handleChange('password')(e.target.value)}
              error={errors.password}
              placeholder="请输入密码"
              leftIcon={<Lock className="h-4 w-4 text-gray-400" />}
              required
              autoComplete="current-password"
            />

            {/* 验证码区域 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  验证码
                </label>
                <button
                  type="button"
                  onClick={fetchCaptcha}
                  disabled={captchaLoading}
                  className="text-sm text-blue-600 hover:text-blue-500 disabled:text-gray-400"
                >
                  {captchaLoading ? '刷新中...' : '看不清？换一张'}
                </button>
              </div>

              <div className="flex space-x-4">
                <div className="flex-1">
                  <Input
                    type="text"
                    name="captcha"
                    value={formData.captcha}
                    onChange={(e) => handleChange('captcha')(e.target.value)}
                    error={errors.captcha}
                    placeholder="请输入验证码"
                    required
                  />
                </div>
                
                <div className="flex-shrink-0">
                  {captchaUrl ? (
                    <img
                      src={captchaUrl}
                      alt="验证码"
                      className="h-10 rounded border border-gray-300 cursor-pointer"
                      onClick={fetchCaptcha}
                      title="点击刷新验证码"
                    />
                  ) : (
                    <div className="h-10 w-32 rounded border border-gray-300 flex items-center justify-center bg-gray-100">
                      {captchaLoading ? '加载中...' : '获取验证码'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Checkbox
                label="记住登录状态"
                name="remember"
                checked={formData.remember}
                onChange={(e) => handleChange('remember')(e.target.checked)}
              />

              <Link
                to="/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                忘记密码？
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={formLoading || isLoading}
              disabled={formLoading || isLoading}
            >
              登录
            </Button>

            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                还没有账号？{' '}
                <Link
                  to="/register"
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  立即注册
                </Link>
              </p>
            </div>
          </Form>
        </Card>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 text-gray-500">
                或使用以下方式登录
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                // TODO: 第三方登录
                console.log('使用微信登录');
              }}
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.5 2C3.467 2 1 4.467 1 7.5c0 1.423.64 2.694 1.642 3.557L1 13l2.943-1.642C4.806 12.36 6.077 13 7.5 13c3.033 0 5.5-2.467 5.5-5.5S10.533 2 7.5 2z" />
              </svg>
              微信登录
            </Button>

            <Button
              variant="outline"
              size="md"
              onClick={() => {
                // TODO: 第三方登录
                console.log('使用GitHub登录');
              }}
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub登录
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-xs text-gray-500">
          © {new Date().getFullYear()} 用户管理系统. 保留所有权利.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;