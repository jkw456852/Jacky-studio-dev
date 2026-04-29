import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from '../hooks/useForm';
import { forgotPasswordSchema } from '../types/schemas';
import Card from '../components/Layout/Card';
import Form from '../components/Form/Form';
import Input from '../components/Form/Input';
import Button from '../components/Form/Button';
import { Mail, RefreshCw, CheckCircle } from 'lucide-react';
import { authService } from '../services/auth.service';

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  const { formData, errors, isLoading: formLoading, handleChange, handleSubmit, resetForm } = useForm({
    schema: forgotPasswordSchema,
    defaultValues: {
      email: '',
      captcha: '',
    },
    onSubmit: async (data) => {
      setIsLoading(true);
      setApiError(null);
      
      try {
        // TODO: 调用后端发送验证码API
        // const response = await authService.forgotPassword(data.email);
        
        // 模拟API调用
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 模拟成功响应
        setSuccess(true);
        setCountdown(60); // 60秒倒计时
        resetForm();
      } catch (error: any) {
        setApiError(error.message || '发送失败，请稍后重试');
      } finally {
        setIsLoading(false);
      }
    },
  });

  // 倒计时处理
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendCode = (e: React.FormEvent) => {
    handleSubmit(e);
  };

  const handleResendCode = () => {
    if (countdown === 0) {
      handleSubmit();
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <h1 className="mt-4 text-2xl font-bold text-gray-900">
              验证邮件已发送
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              我们已向 <span className="font-medium text-gray-900">{formData.email}</span> 发送了重置密码的验证邮件。
            </p>
          </div>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <Card padding="lg" shadow="lg">
            <div className="space-y-4">
              <div className="rounded-md bg-blue-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-blue-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      请查收您的邮箱
                    </h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <ul className="list-disc pl-5 space-y-1">
                        <li>打开我们发送的验证邮件</li>
                        <li>点击邮件中的重置密码链接</li>
                        <li>按照页面提示设置新密码</li>
                        <li>邮件可能在垃圾邮件文件夹中</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => navigate('/login')}
                >
                  返回登录
                </Button>
                <Button
                  variant="outline"
                  fullWidth
                  onClick={handleResendCode}
                  disabled={countdown > 0}
                  loading={isLoading}
                >
                  {countdown > 0 ? `重新发送(${countdown}s)` : '重新发送'}
                </Button>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  没有收到邮件？{' '}
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={countdown > 0}
                    className="font-medium text-blue-600 hover:text-blue-500 disabled:text-gray-400"
                  >
                    {countdown > 0 ? `${countdown}秒后重试` : '点击重发'}
                  </button>
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">用户管理系统</h1>
          <p className="mt-2 text-sm text-gray-600">
            重置您的账号密码
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card padding="lg" shadow="lg">
          <Form
            onSubmit={handleSendCode}
            title="忘记密码"
            subtitle="请输入注册时使用的邮箱地址"
            error={apiError}
          >
            <Input
              label="邮箱地址"
              type="email"
              name="email"
              value={formData.email}
              onChange={(e) => handleChange('email')(e.target.value)}
              error={errors.email}
              placeholder="请输入注册邮箱"
              leftIcon={<Mail className="h-4 w-4 text-gray-400" />}
              required
              autoComplete="email"
              helperText="我们将向该邮箱发送重置密码的验证邮件"
            />

            {/* 验证码区域 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  验证码
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    // TODO: 刷新验证码
                    console.log('刷新验证码');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-500 disabled:text-gray-400"
                >
                  <RefreshCw className="h-4 w-4 inline mr-1" />
                  看不清？换一张
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
                  <div className="h-10 w-32 rounded border border-gray-300 flex items-center justify-center bg-gray-100 text-gray-400">
                    验证码
                  </div>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={formLoading || isLoading}
              disabled={formLoading || isLoading}
            >
              发送重置邮件
            </Button>

            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                想起密码了？{' '}
                <Link
                  to="/login"
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  返回登录
                </Link>
              </p>
            </div>
          </Form>
        </Card>

        <div className="mt-6 rounded-md bg-yellow-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                安全提示
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <ul className="list-disc pl-5 space-y-1">
                  <li>请确保您能访问该邮箱</li>
                  <li>验证邮件有效期为10分钟</li>
                  <li>如未收到邮件，请检查垃圾邮件文件夹</li>
                  <li>如有疑问，请联系客服 support@example.com</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;