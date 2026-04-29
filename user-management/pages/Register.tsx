import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from '../hooks/useForm';
import { useAuthStore } from '../stores/auth.store';
import { registerSchema } from '../types/schemas';
import Card from '../components/Layout/Card';
import Form from '../components/Form/Form';
import Input from '../components/Form/Input';
import Button from '../components/Form/Button';
import { User, Mail, Lock, Phone, Check } from 'lucide-react';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, isLoading, error } = useAuthStore();
  
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak');
  const [showPassword, setShowPassword] = useState(false);

  const { formData, errors, isLoading: formLoading, handleChange, handleSubmit } = useForm({
    schema: registerSchema,
    defaultValues: {
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
      fullName: '',
      phone: '',
    },
    onSubmit: async (data) => {
      await register(data.email, data.username, data.password, data.fullName, data.phone);
      
      // 如果注册成功，跳转到登录页或首页
      if (!error) {
        navigate('/login?from=register');
      }
    },
  });

  // 检查密码强度
  const checkPasswordStrength = (password: string) => {
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const length = password.length;

    if (length >= 8 && hasLower && hasUpper && hasNumber) {
      setPasswordStrength('strong');
    } else if (length >= 6 && (hasLower || hasUpper) && hasNumber) {
      setPasswordStrength('medium');
    } else {
      setPasswordStrength('weak');
    }
  };

  const handlePasswordChange = (value: string) => {
    handleChange('password')(value);
    checkPasswordStrength(value);
  };

  const handleRegister = (e: React.FormEvent) => {
    handleSubmit(e);
  };

  const passwordRequirements = [
    { label: '至少8位字符', met: formData.password.length >= 8 },
    { label: '包含小写字母', met: /[a-z]/.test(formData.password) },
    { label: '包含大写字母', met: /[A-Z]/.test(formData.password) },
    { label: '包含数字', met: /\d/.test(formData.password) },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">用户管理系统</h1>
          <p className="mt-2 text-sm text-gray-600">
            创建您的个人账号
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card padding="lg" shadow="lg">
          <Form
            onSubmit={handleRegister}
            title="注册新账号"
            subtitle="请填写以下信息完成注册"
            error={error?.message}
          >
            <Input
              label="邮箱地址"
              type="email"
              name="email"
              value={formData.email}
              onChange={(e) => handleChange('email')(e.target.value)}
              error={errors.email}
              placeholder="请输入有效的邮箱地址"
              leftIcon={<Mail className="h-4 w-4 text-gray-400" />}
              required
              autoComplete="email"
            />

            <Input
              label="用户名"
              type="text"
              name="username"
              value={formData.username}
              onChange={(e) => handleChange('username')(e.target.value)}
              error={errors.username}
              placeholder="3-20位字母、数字、下划线或连字符"
              leftIcon={<User className="h-4 w-4 text-gray-400" />}
              required
              autoComplete="username"
              helperText="用户名将用于登录和显示"
            />

            <Input
              label="姓名"
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={(e) => handleChange('fullName')(e.target.value)}
              error={errors.fullName}
              placeholder="请输入您的真实姓名"
              leftIcon={<User className="h-4 w-4 text-gray-400" />}
              autoComplete="name"
            />

            <Input
              label="手机号"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={(e) => handleChange('phone')(e.target.value)}
              error={errors.phone}
              placeholder="请输入11位手机号"
              leftIcon={<Phone className="h-4 w-4 text-gray-400" />}
              autoComplete="tel"
            />

            <div className="space-y-2">
              <Input
                label="密码"
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                error={errors.password}
                placeholder="请输入密码"
                leftIcon={<Lock className="h-4 w-4 text-gray-400" />}
                required
                autoComplete="new-password"
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-sm text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? '隐藏' : '显示'}
                  </button>
                }
              />

              {/* 密码强度指示器 */}
              {formData.password && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          passwordStrength === 'weak'
                            ? 'bg-red-500 w-1/3'
                            : passwordStrength === 'medium'
                            ? 'bg-yellow-500 w-2/3'
                            : 'bg-green-500 w-full'
                        }`}
                      />
                    </div>
                    <span className="text-xs font-medium capitalize">
                      {passwordStrength === 'weak' && '弱'}
                      {passwordStrength === 'medium' && '中等'}
                      {passwordStrength === 'strong' && '强'}
                    </span>
                  </div>

                  {/* 密码要求 */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {passwordRequirements.map((req, index) => (
                      <div
                        key={index}
                        className={`flex items-center space-x-1 ${
                          req.met ? 'text-green-600' : 'text-gray-500'
                        }`}
                      >
                        <Check className="h-3 w-3" />
                        <span>{req.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Input
                label="确认密码"
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword')(e.target.value)}
                error={errors.confirmPassword}
                placeholder="请再次输入密码"
                leftIcon={<Lock className="h-4 w-4 text-gray-400" />}
                required
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="terms"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  required
                />
                <label htmlFor="terms" className="ml-2 block text-sm text-gray-700">
                  我已阅读并同意{' '}
                  <Link to="/terms" className="text-blue-600 hover:text-blue-500">
                    用户协议
                  </Link>{' '}
                  和{' '}
                  <Link to="/privacy" className="text-blue-600 hover:text-blue-500">
                    隐私政策
                  </Link>
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="newsletter"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="newsletter" className="ml-2 block text-sm text-gray-700">
                  接收产品更新和推广信息（可选）
                </label>
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
              注册账号
            </Button>

            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                已有账号？{' '}
                <Link
                  to="/login"
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  立即登录
                </Link>
              </p>
            </div>
          </Form>
        </Card>
      </div>

      <div className="mt-8 text-center">
        <p className="text-xs text-gray-500">
          © {newDate().getFullYear()} 用户管理系统. 保留所有权利.
        </p>
      </div>
    </div>
  );
};

function newDate() {
  return new Date();
}

export default RegisterPage;